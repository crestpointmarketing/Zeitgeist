"""Fixed-protocol walk-forward experiment; never executes trades or calls an LLM."""
from datetime import datetime, timedelta, timezone
import hashlib
import json
import numpy as np
from fork_models import regressors, simulate, linear_comparator, boosted_regressor

VERSION = 'fork-comparison-v3'
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


def market_features(bars, origin):
    """Price/volume features observable at this session's close; no future rows."""
    if origin < LAG:
        raise ValueError('Insufficient feature lookback')
    sample = bars[origin - LAG:origin + 1]
    close = np.array([b['c'] for b in sample], dtype=float)
    volume = np.array([b['v'] for b in sample], dtype=float)
    last = sample[-1]
    ranges = np.array([(b['h'] - b['l']) / b['c'] for b in sample], dtype=float)
    log_volume = np.log1p(volume)
    return np.r_[features(close, LAG),
                 np.log(close[-1] / close[-5:].mean()),
                 np.log(close[-1] / close[-20:].mean()),
                 np.log(last['c'] / last['o']),
                 ranges[-1], ranges[-5:].mean(), ranges.mean(),
                 (last['c'] - last['l']) / (last['h'] - last['l']) if last['h'] > last['l'] else .5,
                 log_volume[-1] - log_volume[-20:].mean(),
                 log_volume[-5:].mean() - log_volume[-20:].mean()]


def predict_boosted_at(bars, origin, feature_rows=None):
    closes = np.array([b['c'] for b in bars], dtype=float)
    _, targets, indices = training_data(closes, origin)
    # Optional precomputed rows are each built only from that row's past.
    rows = feature_rows if feature_rows is not None else {int(i): market_features(bars, int(i)) for i in [*indices, origin]}
    model = boosted_regressor().fit(np.array([rows[int(i)] for i in indices]), targets)
    prediction = float(np.expm1(model.predict(np.asarray(rows[origin]).reshape(1, -1))[0]))
    if not np.isfinite(prediction) or prediction <= -1:
        raise ValueError('Invalid boosted prediction')
    return prediction


def training_data(closes, origin):
    # Purge labels extending beyond the prediction origin. Bound training to 504 rows.
    indices = np.arange(max(LAG, origin - HORIZON - 503), origin - HORIZON + 1)
    if len(indices) < 200:
        raise ValueError('Insufficient mature training labels')
    x = np.array([features(closes, int(i)) for i in indices])
    y = np.log(closes[indices + HORIZON] / closes[indices])
    return x, y, indices


def predict_candidates_at(closes, origin, factory=regressors):
    x, y, indices = training_data(closes, origin)
    query = features(closes, origin).reshape(1, -1)
    predictions = []
    models = factory()
    if len(models) != 2:
        raise ValueError('Expected the fixed Extra Trees and Random Forest pair')
    for model in models:
        model.fit(x, y)
        predictions.append(float(model.predict(query)[0]))
    linear = linear_comparator().fit(x, y)
    values = {'model': float(np.expm1(np.mean(predictions))),
              'extra_trees': float(np.expm1(predictions[0])),
              'random_forest': float(np.expm1(predictions[1])),
              'ridge': float(np.expm1(linear.predict(query)[0]))}
    if not all(np.isfinite(value) and value > -1 for value in values.values()):
        raise ValueError('Invalid model prediction')
    return values, int(indices[-1] + HORIZON)


def predict_at(closes, origin, factory=regressors):
    values, trained_through = predict_candidates_at(closes, origin, factory)
    return values['model'], trained_through


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
    feature_rows = {i: market_features(bars, i) for i in range(LAG, len(bars))}
    for origin in origins:
        predictions, trained_through = predict_candidates_at(closes, origin, factory)
        predictions['gradient_boosting'] = predict_boosted_at(bars, origin, feature_rows)
        actual = float(closes[origin + HORIZON] / closes[origin] - 1)
        drift = float(np.expm1(np.diff(np.log(closes[origin - 60:origin + 1])).mean() * HORIZON))
        windows.append({'origin': date_of(bars[origin]), 'target': date_of(bars[origin + HORIZON]),
                        'training_labels_through': date_of(bars[trained_through]),
                        'model_return_pct': predictions['model'] * 100, 'actual_return_pct': actual * 100,
                        'candidate_returns_pct': {key: predictions[key] * 100 for key in ['extra_trees', 'random_forest', 'ridge', 'gradient_boosting']},
                        'drift_return_pct': drift * 100})
    actual = [w['actual_return_pct'] / 100 for w in windows]
    model = metrics([w['model_return_pct'] / 100 for w in windows], actual)
    flat = metrics(np.zeros(len(windows)), actual)
    drift = metrics([w['drift_return_pct'] / 100 for w in windows], actual)
    candidates = {key: metrics([w['candidate_returns_pct'][key] / 100 for w in windows], actual)
                  for key in ['extra_trees', 'random_forest', 'ridge', 'gradient_boosting']}
    directional = [w for w in windows if abs(w['actual_return_pct']) > 1e-10]
    direction_hit = (sum(np.sign(w['actual_return_pct']) == np.sign(w['model_return_pct'])
                         for w in directional) / len(directional) * 100) if directional else None
    # An operational display gate, not a significance test or investment recommendation.
    qualified = model['mae_pp'] < 0.95 * min(flat['mae_pp'], drift['mae_pp'])
    prediction, _ = predict_at(closes, final_origin, factory)
    boosted_qualified = candidates['gradient_boosting']['mae_pp'] < .95 * min(flat['mae_pp'], drift['mae_pp'])
    boosted_prediction = predict_boosted_at(bars, final_origin, feature_rows) if boosted_qualified else None
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
        'boosted_forecast': {'price': float(closes[-1] * (1 + boosted_prediction)), 'return_pct': boosted_prediction * 100} if boosted_prediction is not None else None,
        'backtest': {'windows': windows, 'model': model, 'flat': flat, 'drift': drift, 'candidates': candidates,
                     'direction_hit_pct': direction_hit, 'direction_samples': len(directional)},
        'simulation': [{'date': day.strftime('%Y-%m-%d'), 'p10': float(values[0]),
                        'p50': float(values[1]), 'p90': float(values[2])}
                       for day, values in zip(future, scenarios)],
    }
