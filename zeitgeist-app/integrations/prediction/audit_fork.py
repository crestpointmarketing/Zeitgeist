"""Inventory the pinned fork without executing any notebook or importing its code."""
import argparse
import hashlib
import json
from pathlib import Path
import re


def main():
    p=argparse.ArgumentParser();p.add_argument('--repo',required=True);p.add_argument('--output',required=True);a=p.parse_args()
    root=Path(a.repo).resolve();records=[]
    neural={1:'lstm',2:'bidirectional_lstm',3:'two_path_lstm',4:'gru',5:'bidirectional_gru',6:'two_path_gru',7:'rnn',8:'bidirectional_rnn',9:'two_path_rnn',10:'lstm_seq2seq',11:'bidirectional_lstm_seq2seq',12:'lstm_vae',13:'gru_seq2seq',14:'bidirectional_gru_seq2seq',15:'gru_vae',16:'transformer',17:'cnn_seq2seq',18:'dilated_cnn_seq2seq'}
    for path in sorted(root.rglob('*')):
        if path.suffix not in {'.py','.ipynb'} or '.git' in path.parts:continue
        data=path.read_bytes();relative=path.relative_to(root).as_posix()
        if path.suffix=='.ipynb':
            notebook=json.loads(data);source='\n'.join(''.join(c.get('source',[])) for c in notebook.get('cells',[]) if c.get('cell_type')=='code')
        else:source=data.decode('utf-8')
        match=re.match(r'deep-learning/(\d+)\.',relative)
        module=neural.get(int(match.group(1))) if match else None
        if module:status='architecture rewritten';reason='Modern bounded PyTorch adaptation; not identical code or upstream accuracy.'
        elif relative=='stacking/autoencoder.py' or relative=='deep-learning/autoencoder.py':module='autoencoder';status='architecture rewritten';reason='Train-only reconstruction bottleneck and Ridge head.'
        elif relative.startswith('stacking/'):
            module='temporal_stack / classical catalog';status='partially adapted';reason='RF/ET/GB/AdaBoost/Bagging/XGBoost/ARIMA available; original combined full-data encoder pipeline replaced with purged temporal stacking.'
        elif relative=='agent/1.turtle-agent.ipynb':module='paper_turtle';status='strategy adapted';reason='Close breakout, next-open execution, costs and terminal inventory accounting.'
        elif relative=='agent/2.moving-average-agent.ipynb':module='paper_ma';status='strategy adapted';reason='Fixed 5/20 lookbacks; next-open execution and costs.'
        elif relative=='agent/5.q-learning-agent.ipynb':module='paper_qlearning';status='family adaptation';reason='Bounded tabular Q learning, not a reproduction of the original neural Q agent.'
        elif relative in {'agent/6.evolution-strategy-agent.ipynb','free-agent/evolution-strategy-agent.ipynb'}:module='paper_evolution';status='family adaptation';reason='Seeded training-only evolution search; frozen out-of-sample policy.'
        elif relative.startswith(('agent/','free-agent/','realtime-agent/')):status='not migrated';reason='Other RL/novelty/Bayesian variants need a separate validated environment; live broker/server behavior is excluded. Inventoried as research references.'
        elif relative=='simulation/portfolio-optimization.ipynb':module='portfolio_research.py';status='offline adaptation';reason='Train-only covariance, capped long-only weights, costs and 60-session untouched test. No online multi-symbol UI.'
        elif relative=='simulation/monte-carlo-dynamic-volatility.ipynb':module='risk_diagnostics';status='simulation adapted';reason='Conditional EWMA volatility, seeded paths; uncalibrated scenarios.'
        elif relative in {'simulation/monte-carlo-drift.ipynb','simulation/monte-carlo-simple.ipynb'}:module='primary simulation';status='simulation adapted';reason='Empirical log-return drift with horizon-specific quantiles.'
        elif relative in {'misc/outliers.ipynb','misc/overbought-oversold.ipynb'}:module='risk_diagnostics';status='partially adapted';reason='Causal SVM, z-scores and simple RSI; no future-fit detector or automatic trading signal.'
        else:status='reference only';reason='Dataset-specific study, supporting legacy code, sentiment-dependent or non-stock demo; no verified matching live inputs. Not represented as an implemented model.'
        records.append(dict(path=relative,sha256=hashlib.sha256(data).hexdigest(),status=status,module=module,reason=reason,
                            code_lines=len(source.splitlines()),classes=re.findall(r'^class (\w+)',source,re.M)))
    output=Path(a.output);output.write_text(json.dumps(dict(repository='https://github.com/crestpointmarketing/Stock-Prediction-Models',commit='33266732b0b16188b565e0aeb6b24efa71161f6a',files=records),indent=2),encoding='utf-8')
    print(json.dumps({'inventoried_files':len(records),'by_status':{s:sum(r['status']==s for r in records) for s in sorted({r['status'] for r in records})}}))


if __name__=='__main__':main()
