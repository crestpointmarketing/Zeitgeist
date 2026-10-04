"""Freeze the exact model inputs and exchange calendar for prospective recording."""
from datetime import date, timedelta
import numpy as np
from forecast_engine import date_of


def evidence(bars):
    import exchange_calendars as xcals
    calendar = xcals.get_calendar('XNYS')
    last = date.fromisoformat(date_of(bars[-1]))
    future = calendar.sessions_in_range(last + timedelta(days=1), last + timedelta(days=30))[:5]
    if len(future) != 5: raise ValueError('Missing future exchange sessions')
    closes = np.array([b['c'] for b in bars])
    return dict(bars=bars, next_open=calendar.session_open(future[0]).isoformat(),
                target_close=calendar.session_close(future[-1]).isoformat(),
                target_date=future[-1].strftime('%Y-%m-%d'),
                drift_return_pct=float(np.expm1(np.diff(np.log(closes[-61:])).mean()*5)*100))
