"""Verified long history for the queued portfolio workflow; no model fit."""
import contextlib
from datetime import datetime, timedelta, timezone
import json
from pathlib import Path
import sys

if __name__=='__main__':
    repo,ticker,_=sys.argv[1:]
    sys.path.insert(0,repo)
    sys.path.insert(0,str(Path(__file__).resolve().parent.parent/'prediction'))
    with contextlib.redirect_stdout(sys.stderr):
        from data_provider.yfinance_fetcher import YfinanceFetcher
        from worker import completed_bars
        from forecast_engine import validate_bars
        import yfinance as yf
        info=yf.Ticker(ticker).get_info()
        if info.get('symbol','').upper()!=ticker or info.get('currency')!='USD' or info.get('exchange') not in {'NMS','NGM','NCM','NYQ','PCX','ASE','BTS','BATS'}:
            raise ValueError('Only verified USD US-listed securities are supported')
        now=datetime.now(timezone.utc)
        frame=YfinanceFetcher().get_daily_data(ticker,start_date=(now-timedelta(days=1100)).strftime('%Y-%m-%d'),end_date=(now+timedelta(days=1)).strftime('%Y-%m-%d'))
        bars=completed_bars(frame,now)
        validate_bars(bars,now)
    print(json.dumps({'ticker':ticker,'bars':bars,'source':'DSA / Yahoo Finance (adjusted)'},allow_nan=False))
