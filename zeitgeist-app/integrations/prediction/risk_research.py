"""Fork-inspired conditional-volatility simulation and causal outlier diagnostics."""
import numpy as np
from sklearn.svm import OneClassSVM
from sklearn.preprocessing import StandardScaler


def diagnostics(bars, future):
    from forecast_engine import date_of
    close = np.array([b['c'] for b in bars]); returns = np.diff(np.log(close))
    variance = float(returns[-252:].var(ddof=1))
    for value in returns[-60:]: variance = .94 * variance + .06 * value ** 2
    rng = np.random.default_rng(42); paths = 2000
    values = np.full(paths, close[-1]); variances = np.full(paths, variance)
    scenarios = []
    for day in future:
        shocks = rng.normal(size=paths) * np.sqrt(variances)
        values *= np.exp(returns[-252:].mean() + shocks)
        variances = .94 * variances + .06 * shocks ** 2
        p10, p50, p90 = np.quantile(values, [.1, .5, .9])
        scenarios.append(dict(date=day, p10=float(p10), p50=float(p50), p90=float(p90)))
    observations = []
    for i in range(len(bars) - 20, len(bars)):
        past = returns[max(0, i - 253):i - 1].reshape(-1, 1)
        scaler = StandardScaler().fit(past)
        model = OneClassSVM(nu=.05, gamma='scale').fit(scaler.transform(past))
        value = float(returns[i - 1]); z = float((value - past.mean()) / max(past.std(ddof=1), 1e-8))
        observations.append(dict(date=date_of(bars[i]), return_pct=float(np.expm1(value) * 100),
                                 z_score=z, svm_outlier=bool(model.predict(scaler.transform([[value]]))[0] < 0)))
    changes = np.diff(close[-15:]); gains, losses = np.maximum(changes, 0).mean(), np.maximum(-changes, 0).mean()
    rsi = 50. if gains == losses == 0 else 100. if losses == 0 else float(100 - 100 / (1 + gains / losses))
    return dict(ewma_daily_volatility_pct=float(np.sqrt(variance) * 100), rsi14=rsi,
                scenarios=scenarios, observations=observations)
