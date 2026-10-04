"""Selected research module; inherits the same verified DSA history acquisition."""
import contextlib
from datetime import datetime, timedelta, timezone
import json
from pathlib import Path
import sys


def main():
    repo, ticker, _, model = sys.argv[1:]
    sys.path.insert(0, repo)
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent / 'prediction'))
    with contextlib.redirect_stdout(sys.stderr):
        from research_engine import evaluate_research, MODEL_IDS
        if model not in MODEL_IDS: raise ValueError('Unsupported research model')
        from data_provider.yfinance_fetcher import YfinanceFetcher
        from worker import completed_bars
        import yfinance as yf
        info = yf.Ticker(ticker).get_info()
        if info.get('symbol', '').upper() != ticker or info.get('currency') != 'USD' or info.get('exchange') not in {'NMS', 'NGM', 'NCM', 'NYQ', 'PCX', 'ASE', 'BTS', 'BATS'}:
            raise ValueError('Only verified USD US-listed securities are supported')
        now = datetime.now(timezone.utc)
        frame = YfinanceFetcher().get_daily_data(ticker,
            start_date=(now - timedelta(days=1100)).strftime('%Y-%m-%d'),
            end_date=(now + timedelta(days=1)).strftime('%Y-%m-%d'))
        report = evaluate_research(completed_bars(frame, now), ticker, model, now)
    print(json.dumps(report, allow_nan=False))


if __name__ == '__main__': main()
