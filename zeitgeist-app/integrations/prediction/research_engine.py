"""Selected-model research report. One bounded module per request, no live trades."""
from datetime import datetime, timedelta, timezone, date
import hashlib
import json
import numpy as np
from forecast_engine import validate_bars, date_of, metrics, COMMIT

NEURAL_IDS = ('lstm', 'bidirectional_lstm', 'two_path_lstm', 'gru', 'bidirectional_gru', 'two_path_gru',
              'rnn', 'bidirectional_rnn', 'two_path_rnn', 'lstm_seq2seq', 'bidirectional_lstm_seq2seq', 'lstm_vae',
              'gru_seq2seq', 'bidirectional_gru_seq2seq', 'gru_vae', 'transformer', 'cnn_seq2seq', 'dilated_cnn_seq2seq', 'autoencoder')
CLASSICAL_IDS = ('adaboost', 'bagging', 'xgboost', 'arima', 'temporal_stack')
STRATEGY_IDS = ('paper_ma', 'paper_turtle', 'paper_evolution', 'paper_qlearning')
MODEL_IDS = (*NEURAL_IDS, *CLASSICAL_IDS, *STRATEGY_IDS, 'risk_diagnostics')


def evaluate_research(bars, ticker, name, now=None):
    if name not in MODEL_IDS: raise ValueError('Unsupported research model')
    now = now or datetime.now(timezone.utc)
    close = validate_bars(bars, now)
    import exchange_calendars as xcals
    last = date.fromisoformat(date_of(bars[-1]))
    future = [s.strftime('%Y-%m-%d') for s in xcals.get_calendar('XNYS').sessions_in_range(last + timedelta(days=1), last + timedelta(days=30))[:5]]
    result = dict(version='fork-research-v1', fork_commit=COMMIT, ticker=ticker, model=name,
                  generated_at=now.isoformat(), as_of=date_of(bars[-1]), history_start=date_of(bars[0]),
                  history_bars=len(bars), data_hash=hashlib.sha256(json.dumps(bars, sort_keys=True).encode()).hexdigest()[:16],
                  source='DSA / Yahoo Finance (adjusted)', last_close=float(close[-1]),
                  prediction=None, strategy=None, risk=None)
    if name in STRATEGY_IDS:
        from paper_strategies import evaluate_strategy
        result.update(kind='strategy', strategy=evaluate_strategy(bars, name))
    elif name == 'risk_diagnostics':
        from risk_research import diagnostics
        result.update(kind='risk', risk=diagnostics(bars, future))
    else:
        if name in NEURAL_IDS:
            from sequence_models import predict_sequence, sequence_rows
            rows = sequence_rows(bars)
            predict = lambda origin: predict_sequence(bars, origin, name, rows)
        else:
            from stack_models import predict_stack
            predict = lambda origin: predict_stack(bars, origin, name)
        windows = []
        for origin in range(len(bars) - 151, len(bars) - 1, 5):
            path, labels_through = predict(origin)
            drift = float(np.expm1(np.diff(np.log(close[origin - 60:origin + 1])).mean() * 5))
            windows.append(dict(origin=date_of(bars[origin]), target=date_of(bars[origin + 5]),
                                training_labels_through=date_of(bars[labels_through]),
                                predicted_return_pct=float(path[-1] * 100), actual_return_pct=float((close[origin + 5] / close[origin] - 1) * 100),
                                drift_return_pct=drift * 100))
        actual = [w['actual_return_pct'] / 100 for w in windows]
        score = metrics([w['predicted_return_pct'] / 100 for w in windows], actual)
        flat = metrics(np.zeros(30), actual); drift = metrics([w['drift_return_pct'] / 100 for w in windows], actual)
        qualified = score['mae_pp'] < .95 * min(flat['mae_pp'], drift['mae_pp'])
        target = None
        if qualified:
            path, _ = predict(len(bars) - 1)
            target = dict(date=future[-1], price=float(close[-1] * (1 + path[-1])), return_pct=float(path[-1] * 100))
        result.update(kind='prediction', prediction=dict(windows=windows, model=score, flat=flat, drift=drift,
                                                        qualified=qualified, forecast=target))
    return result
