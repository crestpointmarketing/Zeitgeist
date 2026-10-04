"""Adapted from Stock-Prediction-Models (Apache-2.0); see PROVENANCE.md.

Modified: fixed seeds, bounded trees, return targets, no global encoder/scaler,
and log-return Monte Carlo with per-horizon quantiles instead of pooled prices.
"""
import numpy as np
from sklearn.ensemble import ExtraTreesRegressor, RandomForestRegressor, GradientBoostingRegressor
from sklearn.linear_model import Ridge
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler


def regressors():
    # Original notebook's ExtraTrees/RandomForest members, modernized and bounded.
    settings = dict(n_estimators=64, max_depth=6, min_samples_leaf=8,
                    random_state=42, n_jobs=1)
    return [ExtraTreesRegressor(**settings), RandomForestRegressor(**settings)]


def linear_comparator():
    # New Zeitgeist comparator, not an upstream notebook model. Scaling is fit
    # separately inside each historical training window, never on future rows.
    return make_pipeline(StandardScaler(), Ridge(alpha=10.0))


def boosted_regressor():
    # Additional member from the same upstream stacking notebook. Fixed before
    # evaluation; bounded CPU and shallow trees instead of its 500 estimators.
    return GradientBoostingRegressor(n_estimators=64, learning_rate=.03,
                                     max_depth=2, min_samples_leaf=12,
                                     loss='huber', random_state=42)


def simulate(closes, days=5, paths=2000):
    returns = np.diff(np.log(closes[-253:]))
    # The empirical log-return mean already includes the log-price drift.
    # Do not subtract variance twice as in the old notebook.
    drift, volatility = float(returns.mean()), float(returns.std(ddof=1))
    shocks = np.random.default_rng(42).normal(drift, volatility, (paths, days))
    prices = closes[-1] * np.exp(np.cumsum(shocks, axis=1))
    return np.quantile(prices, [0.1, 0.5, 0.9], axis=0).T
