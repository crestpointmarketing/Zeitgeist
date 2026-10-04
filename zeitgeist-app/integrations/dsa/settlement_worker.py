"""Retrieve both completed closes on the same adjustment basis; never refit a model."""
import contextlib
from datetime import date, datetime, timedelta, timezone
import json
import sys


def settle(frame, origin, target, now):
    import exchange_calendars as xcals
    from worker import completed_bars
    calendar = xcals.get_calendar('XNYS')
    sessions = calendar.sessions_in_range(origin, target)
    if len(sessions) != 6 or sessions[0].strftime('%Y-%m-%d') != origin or sessions[-1].strftime('%Y-%m-%d') != target:
        raise ValueError('Expected exactly five future sessions')
    if calendar.session_close(target).to_pydatetime() + timedelta(minutes=20) > now:
        raise ValueError('Target session is not complete')
    bars = completed_bars(frame, now)
    indexed = {datetime.fromtimestamp(b['t']/1000, timezone.utc).date().isoformat():b for b in bars}
    if any(s.strftime('%Y-%m-%d') not in indexed for s in sessions):
        raise ValueError('Missing realized session; never substitute a neighboring date')
    return [indexed[s.strftime('%Y-%m-%d')] for s in sessions]


def main():
    repo, ticker, _, origin, target = sys.argv[1:]
    sys.path.insert(0, repo)
    with contextlib.redirect_stdout(sys.stderr):
        import yfinance as yf
        from data_provider.yfinance_fetcher import YfinanceFetcher
        info=yf.Ticker(ticker).get_info()
        if info.get('symbol','').upper()!=ticker or info.get('currency')!='USD' or info.get('exchange') not in {'NMS','NGM','NCM','NYQ','PCX','ASE','BTS','BATS'}:
            raise ValueError('Unverified security')
        now=datetime.now(timezone.utc)
        frame=YfinanceFetcher().get_daily_data(ticker,start_date=origin,end_date=(date.fromisoformat(target)+timedelta(days=1)).isoformat())
        bars=settle(frame,origin,target,now)
    print(json.dumps(dict(ticker=ticker,origin=origin,target=target,bars=bars,
                         source='DSA / Yahoo Finance (adjusted)',retrieved_at=now.isoformat()),allow_nan=False))


if __name__=='__main__':main()
