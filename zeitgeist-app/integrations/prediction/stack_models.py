"""Bounded reimplementations of the fork's classical/stacking model routes."""
import numpy as np
from sklearn.ensemble import AdaBoostRegressor, BaggingRegressor, ExtraTreesRegressor
from sklearn.tree import DecisionTreeRegressor
from sklearn.linear_model import Ridge
from forecast_engine import training_data, market_features

STACK_MODELS = ('adaboost', 'bagging', 'xgboost', 'arima', 'temporal_stack')


def factory(name):
    if name == 'adaboost':
        return AdaBoostRegressor(DecisionTreeRegressor(max_depth=3, min_samples_leaf=12),
                                 n_estimators=32, learning_rate=.03, random_state=42)
    if name == 'bagging':
        return BaggingRegressor(DecisionTreeRegressor(max_depth=5, min_samples_leaf=12),
                                n_estimators=32, random_state=42, n_jobs=1)
    if name == 'xgboost':
        from xgboost import XGBRegressor
        return XGBRegressor(n_estimators=32, max_depth=2, learning_rate=.03,
                            reg_lambda=10., objective='reg:squarederror', n_jobs=1, random_state=42)
    raise ValueError('Unknown classical model')


def predict_stack(bars, origin, name):
    closes = np.array([b['c'] for b in bars], dtype=float)
    if name == 'arima':
        from statsmodels.tsa.arima.model import ARIMA
        model = ARIMA(np.log(closes[max(0, origin - 251):origin + 1]), order=(1, 1, 0), trend='n').fit()
        path = np.expm1(np.asarray(model.forecast(5)) - np.log(closes[origin]))
    else:
        _, y, indices = training_data(closes, origin)
        # Same origin-bound labels as the primary model, with causal OHLCV inputs.
        x = np.array([market_features(bars, int(i)) for i in indices])
        query = market_features(bars, origin).reshape(1, -1)
        if name == 'temporal_stack':
            # Meta-model learns ONLY out-of-time base predictions. Purge five
            # overlapping target sessions at each internal training boundary.
            def bases():
                return [ExtraTreesRegressor(n_estimators=16, max_depth=4, min_samples_leaf=12, random_state=42, n_jobs=1),
                        factory('xgboost'), Ridge(alpha=10.)]
            oof, target = [], []
            for block in np.array_split(np.arange(len(x) // 2, len(x)), 3):
                end = int(block[0]) - 5
                trained = [m.fit(x[:end], y[:end]) for m in bases()]
                oof.extend(np.column_stack([m.predict(x[block]) for m in trained]))
                target.extend(y[block])
            meta = Ridge(alpha=1.).fit(np.asarray(oof), target)
            inputs = np.array([m.fit(x, y).predict(query)[0] for m in bases()]).reshape(1, -1)
            value = float(meta.predict(inputs)[0])
        else:
            value = float(factory(name).fit(x, y).predict(query)[0])
        path = np.expm1(np.arange(1, 6) / 5 * value)
    if not np.all(np.isfinite(path)) or np.any(path <= -1):
        raise ValueError('Invalid classical forecast')
    return path, origin
