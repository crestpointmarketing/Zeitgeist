"""Read-only, authenticated DSA adapter. No DSA admin API, scheduler or user data."""
import hmac
import json
import os
from pathlib import Path
import subprocess
import sys
import threading
import time
from datetime import date
from collections import OrderedDict

from dotenv import load_dotenv
from fastapi import FastAPI, Header, HTTPException, Query

load_dotenv(Path(__file__).with_name('.env'))
TOKEN = os.environ.get('DSA_SERVICE_TOKEN', '')
REPO = Path(os.environ.get('DSA_REPO_PATH', '')).resolve()
if len(TOKEN) < 32 or not (REPO / 'data_provider' / 'yfinance_fetcher.py').is_file():
    raise RuntimeError('Configure DSA_SERVICE_TOKEN (32+ characters) and DSA_REPO_PATH')

app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)
cache = OrderedDict()
lock = threading.Lock()
financials_lock = threading.Lock()
forecast_lock = threading.Lock()
cache_lock = threading.Lock()


@app.get('/health')
def health():
    return {'status': 'ok'}


@app.get('/v1/history/{ticker}')
def history(ticker: str, days: int = Query(30, ge=5, le=90), authorization: str = Header('')):
    return run_request(ticker, days, authorization, 'history')


@app.get('/v1/financials/{ticker}')
def financials(ticker: str, authorization: str = Header('')):
    return run_request(ticker, 30, authorization, 'financials')


@app.get('/v1/forecast/{ticker}')
def forecast(ticker: str, authorization: str = Header('')):
    return run_request(ticker, 1100, authorization, 'forecast')


@app.get('/v1/research/{ticker}')
def research(ticker: str, model: str = Query(..., pattern='^[a-z_]{3,40}$'), authorization: str = Header('')):
    return run_request(ticker, 1100, authorization, 'research', model)


@app.get('/v1/settlement/{ticker}')
def settlement(ticker: str, origin: str, target: str, authorization: str = Header('')):
    return run_request(ticker, 10, authorization, 'settlement', origin=origin, target=target)


def run_request(ticker, days, authorization, kind, model=None, origin=None, target=None):
    if not hmac.compare_digest(authorization, 'Bearer ' + TOKEN):
        raise HTTPException(401, 'Unauthorized')
    if not ticker.isascii() or not ticker.isalpha() or not 1 <= len(ticker) <= 5 or ticker != ticker.upper():
        raise HTTPException(400, 'Invalid US symbol')
    if kind == 'research':
        # Registry has no neural runtime import; reject arbitrary worker arguments.
        prediction_path = str(Path(__file__).resolve().parent.parent / 'prediction')
        if prediction_path not in sys.path:
            sys.path.insert(0, prediction_path)
        from research_engine import MODEL_IDS
        if model not in MODEL_IDS: raise HTTPException(400, 'Unsupported research model')
    if kind == 'settlement':
        try:
            first, last = date.fromisoformat(origin), date.fromisoformat(target)
            if origin != first.isoformat() or target != last.isoformat() or not 5 <= (last-first).days <= 15:
                raise ValueError('Invalid horizon')
        except (ValueError, TypeError): raise HTTPException(400, 'Invalid settlement dates') from None
    key = (kind, ticker, days) + ((model,) if kind == 'research' else (origin,target) if kind == 'settlement' else ())
    # A warm result requires no worker. Other symbols must not block cache hits.
    with cache_lock:
        cached = cache.get(key)
    if cached and cached[0] > time.monotonic():
        return cached[1]
    # Bound upstream concurrency; avoid unbounded work after client timeouts.
    worker_lock = {'history': lock, 'settlement': lock, 'financials': financials_lock, 'forecast': forecast_lock, 'research': forecast_lock}[kind]
    if not worker_lock.acquire(timeout=2):
        raise HTTPException(429, 'Market data worker is busy')
    try:
        # Another request may have populated this key while we waited.
        with cache_lock:
            cached = cache.get(key)
        if cached and cached[0] > time.monotonic():
            return cached[1]
        try:
            script = {'history': 'worker.py', 'settlement': 'settlement_worker.py', 'financials': 'financials_worker.py', 'forecast': 'forecast_worker.py', 'research': 'research_worker.py'}[kind]
            command = [sys.executable, str(Path(__file__).with_name(script)), str(REPO), ticker, str(days)]
            if kind == 'research': command.append(model)
            if kind == 'settlement': command.extend([origin,target])
            result = subprocess.run(command,
                                    capture_output=True, text=True, encoding='utf-8', timeout={'history': 25, 'settlement': 20, 'financials': 10, 'forecast': 45, 'research': 45}[kind], cwd=REPO)
            if result.returncode:
                raise HTTPException(502, 'Upstream market data unavailable')
            payload = json.loads(result.stdout)
        except subprocess.TimeoutExpired:
            raise HTTPException(504, 'Market data request timed out') from None
        except (ValueError, OSError):
            raise HTTPException(502, 'Invalid market data response') from None
        with cache_lock:
            if len(cache) >= 64:
                cache.popitem(last=False)
            cache[key] = (time.monotonic() + (300 if kind == 'history' else 3600), payload)
        return payload
    finally:
        worker_lock.release()
