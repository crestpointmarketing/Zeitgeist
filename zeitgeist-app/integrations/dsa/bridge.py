"""Read-only, authenticated DSA adapter. No DSA admin API, scheduler or user data."""
import hmac
import json
import os
from pathlib import Path
import subprocess
import sys
import threading
import time
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


def run_request(ticker, days, authorization, kind):
    if not hmac.compare_digest(authorization, 'Bearer ' + TOKEN):
        raise HTTPException(401, 'Unauthorized')
    if not ticker.isascii() or not ticker.isalpha() or not 1 <= len(ticker) <= 5 or ticker != ticker.upper():
        raise HTTPException(400, 'Invalid US symbol')
    key = (kind, ticker, days)
    # A warm result requires no worker. Other symbols must not block cache hits.
    with cache_lock:
        cached = cache.get(key)
    if cached and cached[0] > time.monotonic():
        return cached[1]
    # Bound upstream concurrency; avoid unbounded work after client timeouts.
    worker_lock = {'history': lock, 'financials': financials_lock, 'forecast': forecast_lock}[kind]
    if not worker_lock.acquire(timeout=2):
        raise HTTPException(429, 'Market data worker is busy')
    try:
        # Another request may have populated this key while we waited.
        with cache_lock:
            cached = cache.get(key)
        if cached and cached[0] > time.monotonic():
            return cached[1]
        try:
            script = {'history': 'worker.py', 'financials': 'financials_worker.py', 'forecast': 'forecast_worker.py'}[kind]
            result = subprocess.run([sys.executable, str(Path(__file__).with_name(script)), str(REPO), ticker, str(days)],
                                    capture_output=True, text=True, encoding='utf-8', timeout={'history': 25, 'financials': 10, 'forecast': 45}[kind], cwd=REPO)
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
