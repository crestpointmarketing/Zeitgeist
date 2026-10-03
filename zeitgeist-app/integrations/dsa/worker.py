"""Use the fork's existing Yahoo fetcher; timestamps are actual NYSE session closes."""
import contextlib
from datetime import datetime, timedelta, timezone
import json
import sys


def completed_bars(frame, now):
    import exchange_calendars as xcals
    import pandas as pd
    calendar = xcals.get_calendar('XNYS')
    bars = []
    for _, row in frame.iterrows():
        day = pd.Timestamp(row['date']).strftime('%Y-%m-%d')
        if not calendar.is_session(day):
            continue
        close = calendar.session_close(day).to_pydatetime()
        # Allow the source to settle after the official close, including early-close days.
        if close + timedelta(minutes=20) > now:
            continue
        bars.append({**{short: float(row[long]) for short, long in
                      [('o', 'open'), ('h', 'high'), ('l', 'low'), ('c', 'close'), ('v', 'volume')]},
                     't': int(close.timestamp() * 1000)})
    return sorted(bars, key=lambda bar: bar['t'])


def main():
    repo, ticker, days = sys.argv[1:]
    sys.path.insert(0, repo)
    with contextlib.redirect_stdout(sys.stderr):
        from data_provider.yfinance_fetcher import YfinanceFetcher
        now = datetime.now(timezone.utc)
        start = (now - timedelta(days=max(int(days), 30))).strftime('%Y-%m-%d')
        # Yahoo end is exclusive. Calendar filtering below excludes uncompleted sessions.
        end = (now + timedelta(days=1)).strftime('%Y-%m-%d')
        frame = YfinanceFetcher().get_daily_data(ticker, start_date=start, end_date=end)
        bars = completed_bars(frame, now)
        cutoff = (now - timedelta(days=int(days))).date().isoformat()
        selected = [bar for bar in bars if datetime.fromtimestamp(bar['t'] / 1000, timezone.utc).date().isoformat() >= cutoff]
        if len(selected) < 2:
            raise ValueError('At least two completed sessions are required')
    print(json.dumps({'ticker': ticker, 'source': 'DSA / Yahoo Finance (adjusted)', 'bars': selected}, allow_nan=False))


if __name__ == '__main__':
    main()
