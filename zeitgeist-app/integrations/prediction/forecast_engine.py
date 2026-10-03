"""Fixed-protocol walk-forward experiment; never executes trades or calls an LLM."""
from datetime import datetime, timedelta, timezone
import hashlib
import json
import numpy as np
from fork_models import regressors, simulate

VERSION = 'fork-trees-v1'
COMMIT = '33266732b0b16188b565e0aeb6b24efa71161f6a'
HORIZON = 5
LAG = 20
TEST_WINDOWS = 30
MIN_BARS = 400


def validate_bars(bars, now):
    if not MIN_BARS <= len(bars) <= 900:
        raise ValueError('Need 400–900 completed trading sessions')
    previous = 0
    for bar in bars:
        values = [bar[k] for k in ['o', 'h', 'l', 'c', 'v', 't']]
        if not all(np.isfinite(v) for v in values):
            raise ValueError('Nonfinite history')
        if min(bar[k] for k in ['o', 'h', 'l', 'c']) <= 0 or bar['v'] < 0:
            raise ValueError('Invalid history')
        if bar['l'] > min(bar['o'], bar['c']) or bar['h'] < max(bar['o'], bar['c']):
            raise ValueError('Inconsistent OHLC')
        if bar['t'] <= previous or bar['t'] > now.timestamp() * 1000:
            raise ValueError('History is unsorted, duplicated or incomplete')
        previous = bar['t']
    if now.timestamp() * 1000 - bars[-1]['t'] > 7 * 86400000:
        raise ValueError('History is stale')
    import exchange_calendars as xcals
    expected = xcals.get_calendar('XNYS').sessions_in_range(date_of(bars[0]), date_of(bars[-1]))
    if [s.strftime('%Y-%m-%d') for s in expected] != [date_of(bar) for bar in bars]:
        raise ValueError('Missing or duplicate trading sessions')
    return np.array([bar['c'] for bar in bars], dtype=float)


def features(closes, origin):
    # Everything here is observable at origin's close, never at the target close.
    returns = np.diff(np.log(closes[origin - LAG:origin + 1]))
    return np.r_[returns, returns[-5:].mean(), returns.mean(), returns.std()]


def training_data(closes, origin):
    # Purge labels extending beyond the prediction origin. Bound training to 504 rows.
    indices = np.arange(max(LAG, origin - HORIZON - 503), origin - HORIZON + 1)
    if len(indices) < 200:
        raise ValueError('Insufficient mature training labels')
    x = np.array([features(closes, int(i)) for i in indices])
    y = np.log(closes[indices + HORIZON] / closes[indices])
    return x, y, indices


def predict_at(closes, origin, factory=regressors):
    x, y, indices = training_data(closes, origin)
    query = features(closes, origin).reshape(1, -1)
    predictions = []
    for model in factory():
        model.fit(x, y)
        predictions.append(float(model.predict(query)[0]))
    return float(np.expm1(np.mean(predictions))), int(indices[-1] + HORIZON)


def metrics(predictions, actual):
    errors = np.array(predictions) - np.array(actual)
    return {'mae_pp': float(np.mean(np.abs(errors)) * 100),
            'rmse_pp': float(np.sqrt(np.mean(errors ** 2)) * 100)}


def date_of(bar):
    return datetime.fromtimestamp(bar['t'] / 1000, timezone.utc).date().isoformat()


def evaluate(bars, ticker, now=None, factory=regressors):
    now = now or datetime.now(timezone.utc)
    closes = validate_bars(bars, now)
    final_origin = len(closes) - 1
    # 30 adjacent, non-overlapping five-session targets; no random split/tuning.
    origins = range(final_origin - HORIZON * TEST_WINDOWS, final_origin, HORIZON)
    windows = []
    for origin in origins:
        prediction, trained_through = predict_at(closes, origin, factory)
        actual = float(closes[origin + HORIZON] / closes[origin] - 1)
        drift = float(np.expm1(np.diff(np.log(closes[origin - 60:origin + 1])).mean() * HORIZON))
        windows.append({'origin': date_of(bars[origin]), 'target': date_of(bars[origin + HORIZON]),
                        'training_labels_through': date_of(bars[trained_through]),
                        'model_return_pct': prediction * 100, 'actual_return_pct': actual * 100,
                        'drift_return_pct': drift * 100})
    actual = [w['actual_return_pct'] / 100 for w in windows]
    model = metrics([w['model_return_pct'] / 100 for w in windows], actual)
    flat = metrics(np.zeros(len(windows)), actual)
    drift = metrics([w['drift_return_pct'] / 100 for w in windows], actual)
    directional = [w for w in windows if abs(w['actual_return_pct']) > 1e-10]
    direction_hit = (sum(np.sign(w['actual_return_pct']) == np.sign(w['model_return_pct'])
                         for w in directional) / len(directional) * 100) if directional else None
    # An operational display gate, not a significance test or investment recommendation.
    qualified = model['mae_pp'] < 0.95 * min(flat['mae_pp'], drift['mae_pp'])
    prediction, _ = predict_at(closes, final_origin, factory)
    import exchange_calendars as xcals
    from datetime import date
    last_day = date.fromisoformat(date_of(bars[-1]))
    future = xcals.get_calendar('XNYS').sessions_in_range(last_day + timedelta(days=1), last_day + timedelta(days=30))[:HORIZON]
    if len(future) != HORIZON:
        raise ValueError('Future trading calendar unavailable')
    scenarios = simulate(closes)
    return {
        'version': VERSION, 'fork_commit': COMMIT, 'ticker': ticker,
        'source': 'DSA / Yahoo Finance (adjusted)', 'currency': 'USD',
        'generated_at': now.isoformat(), 'as_of': date_of(bars[-1]),
        'history_start': date_of(bars[0]), 'history_bars': len(bars),
        'data_hash': hashlib.sha256(json.dumps(bars, sort_keys=True).encode()).hexdigest()[:16],
        'horizon_sessions': HORIZON, 'last_close': float(closes[-1]),
        'target_date': future[-1].strftime('%Y-%m-%d'), 'qualified': qualified,
        'forecast': {'price': float(closes[-1] * (1 + prediction)), 'return_pct': prediction * 100} if qualified else None,
        'backtest': {'windows': windows, 'model': model, 'flat': flat, 'drift': drift,
                     'direction_hit_pct': direction_hit, 'direction_samples': len(directional)},
        'simulation': [{'date': day.strftime('%Y-%m-%d'), 'p10': float(values[0]),
                        'p50': float(values[1]), 'p90': float(values[2])}
                       for day, values in zip(future, scenarios)],
    }
