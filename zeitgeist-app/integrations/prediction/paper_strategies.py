"""Read-only historical strategy experiments; no broker, orders or live agent.

Fork-inspired moving average, turtle, evolutionary and Q-learning routes.
Signals at a close execute at the NEXT open, with costs and no leverage.
"""
import numpy as np

STRATEGIES = ('paper_ma', 'paper_turtle', 'paper_evolution', 'paper_qlearning')
FEE = .001  # ten basis points per side, including entry and terminal liquidation


def state_features(closes, i):
    p = closes[i - 20:i + 1]
    return np.array([1., np.log(p[-1] / p[-6]) * 20,
                     np.log(p[-5:].mean() / p[-20:].mean()) * 20,
                     np.diff(np.log(p)).std() * 20])


def simulate_positions(opens, positions, start):
    equity, benchmark, old = 1., 1., 0.
    records = []
    for offset, position in enumerate(positions):
        j = start + offset
        market = opens[j + 1] / opens[j] - 1
        turnover = abs(position - old)
        # Apply fees before the holding return, and charge liquidation at the end.
        factor = (1 - FEE * turnover) * (1 + position * market)
        benchmark_factor = (1 - FEE if offset == 0 else 1) * (1 + market)
        terminal = offset == len(positions) - 1
        if terminal:
            factor *= 1 - FEE * position
            benchmark_factor *= 1 - FEE
        equity *= factor; benchmark *= benchmark_factor
        records.append(dict(position=float(position), market_return_pct=float(market * 100),
                            net_return_pct=float((factor - 1) * 100),
                            benchmark_return_pct=float((benchmark_factor - 1) * 100),
                            turnover=float(turnover + (position if terminal else 0)),
                            equity=float(equity), benchmark_equity=float(benchmark)))
        old = position
    return records


def positions_for(bars, name, start):
    close, opens = [np.array([b[key] for b in bars], dtype=float) for key in ['c', 'o']]
    positions = []; held = 0.
    if name == 'paper_evolution':
        # Freeze policy on the pre-test segment. No test P&L enters this search.
        train_start = max(21, start - 200)
        x = np.array([state_features(close, j - 1) for j in range(train_start, start - 1)])
        rng = np.random.default_rng(42); weights = np.zeros(4)
        for _ in range(20):
            noise = rng.normal(size=(20, 4))
            rewards = []
            for n in noise:
                p = (x @ (weights + .1 * n) > 0).astype(float)
                rewards.append(np.log(simulate_positions(opens, p, train_start)[-1]['equity']))
            rewards = np.asarray(rewards)
            if rewards.std() > 1e-10:
                weights += .03 * noise.T @ ((rewards - rewards.mean()) / rewards.std()) / 20
    elif name == 'paper_qlearning':
        q = np.zeros((6, 2)); rng = np.random.default_rng(42)
        def state(i, position):
            momentum = close[i] / close[i - 5] - 1
            return (0 if momentum < -.01 else 2 if momentum > .01 else 1) * 2 + int(position)
        for _ in range(20):
            previous = 0
            for j in range(max(21, start - 252), start - 1):
                s = state(j - 1, previous)
                action = int(rng.integers(2)) if rng.random() < .1 else int(np.argmax(q[s]))
                reward = (1 - FEE * abs(action - previous)) * (1 + action * (opens[j + 1] / opens[j] - 1)) - 1
                next_state = state(j, action)
                q[s, action] += .1 * (reward + .9 * np.max(q[next_state]) - q[s, action])
                previous = action
    for j in range(start, len(bars) - 1):
        i = j - 1
        if name == 'paper_ma':
            held = float(close[i - 4:i + 1].mean() > close[i - 19:i + 1].mean())
        elif name == 'paper_turtle':
            if close[i] > close[i - 20:i].max(): held = 1.
            elif close[i] < close[i - 10:i].min(): held = 0.
        elif name == 'paper_evolution':
            held = float(state_features(close, i) @ weights > 0)
        elif name == 'paper_qlearning':
            held = float(np.argmax(q[state(i, held)]))
        else:
            raise ValueError('Unsupported paper strategy')
        positions.append(held)
    return positions


def evaluate_strategy(bars, name):
    from forecast_engine import date_of
    start = len(bars) - 151
    positions = positions_for(bars, name, start)
    records = simulate_positions(np.array([b['o'] for b in bars]), positions, start)
    for offset, record in enumerate(records):
        j = start + offset
        record.update(signal_date=date_of(bars[j - 1]), execution_date=date_of(bars[j]), date=date_of(bars[j + 1]))
    curve = np.r_[1., [r['equity'] for r in records]]
    benchmark = np.r_[1., [r['benchmark_equity'] for r in records]]
    drawdown = lambda values: float((1 - values / np.maximum.accumulate(values)).max() * 100)
    return dict(training_through=date_of(bars[start - 1]), cost_bps_per_side=10,
                return_pct=float((curve[-1] - 1) * 100), benchmark_return_pct=float((benchmark[-1] - 1) * 100),
                max_drawdown_pct=drawdown(curve), benchmark_drawdown_pct=drawdown(benchmark),
                turnover=float(sum(r['turnover'] for r in records)), observations=records)
