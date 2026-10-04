"""Offline portfolio study adapted from the fork's simulation notebook.

Uses supplied validated histories, train-only covariance and an untouched 60-session
test. No portfolio advice, account holdings, broker connections or trading orders.
"""
import numpy as np
from scipy.optimize import minimize
from forecast_engine import date_of, validate_bars


def allocation_curve(returns, weights, fee=.001):
    current = np.zeros(len(weights)); equity = 1.; result = []
    for i, changes in enumerate(returns):
        turnover = float(np.abs(weights - current).sum())
        gross = float(weights @ changes)
        factor = (1 - fee * turnover) * (1 + gross)
        if i == len(returns) - 1: factor *= 1 - fee
        equity *= factor
        current = weights * (1 + changes) / (1 + gross)
        result.append(float(equity))
    return result


def evaluate_portfolio(histories, now):
    if not 2 <= len(histories) <= 6: raise ValueError('Use two to six aligned securities')
    maps = {}
    for ticker, bars in histories.items():
        validate_bars(bars, now)
        maps[ticker] = {date_of(b): b['c'] for b in bars}
    dates = sorted(set.intersection(*(set(v) for v in maps.values())))
    if len(dates) < 313: raise ValueError('Need at least 313 shared sessions')
    tickers = sorted(maps)
    closes = np.array([[maps[t][d] for t in tickers] for d in dates])
    returns = closes[1:] / closes[:-1] - 1
    train, test = returns[-312:-60], returns[-60:]
    covariance = np.cov(train, rowvar=False)
    covariance = .9 * covariance + .1 * np.diag(np.diag(covariance)) + np.eye(len(tickers)) * 1e-10
    equal = np.ones(len(tickers)) / len(tickers)
    fit = minimize(lambda w: float(w @ covariance @ w) * 1e4, equal, method='SLSQP',
                   bounds=[(0., .6)] * len(tickers), constraints={'type':'eq','fun':lambda w: w.sum()-1},
                   options={'maxiter':100,'ftol':1e-10})
    if not fit.success or abs(fit.x.sum()-1)>1e-6: raise ValueError('Portfolio optimization did not converge')
    return dict(version='portfolio-research-v1', tickers=tickers, training_through=dates[-61],
                test_start=dates[-60], test_end=dates[-1], weights=dict(zip(tickers, map(float, fit.x))),
                cost_bps_per_side=10, optimized_equity=allocation_curve(test,fit.x),
                equal_weight_equity=allocation_curve(test,equal), dates=dates[-60:])


def main():
    """Evaluate explicitly supplied benchmark snapshots; never fetch account holdings."""
    import argparse
    from datetime import datetime, timezone
    import json
    from pathlib import Path
    import re
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--snapshots', nargs='+', required=True)
    parser.add_argument('--output', required=True)
    args = parser.parse_args()
    if not 2 <= len(args.snapshots) <= 6:
        parser.error('Provide two to six distinct ticker snapshots')
    histories = {}
    for filename in args.snapshots:
        snapshot = json.loads(Path(filename).read_text(encoding='utf-8'))
        ticker = snapshot['ticker']
        if not re.fullmatch('[A-Z]{1,5}', ticker) or ticker in histories:
            parser.error('Snapshots must contain distinct US ticker identifiers')
        histories[ticker] = snapshot['bars']
    report = evaluate_portfolio(histories, datetime.now(timezone.utc))
    Path(args.output).write_text(json.dumps(report, indent=2, allow_nan=False), encoding='utf-8')
    print(json.dumps({'tickers': report['tickers'], 'test_start': report['test_start'],
                      'test_end': report['test_end'], 'sessions': len(report['dates'])}))


if __name__ == '__main__':
    main()
