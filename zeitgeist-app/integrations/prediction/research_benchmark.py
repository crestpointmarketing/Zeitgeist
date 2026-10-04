"""Snapshot-based smoke benchmark; identical bars for every selected module.

Can evaluate an explicit local snapshot or fetch public DSA history once per symbol.
Each module runs in its own bounded process; failures remain in the summary.
"""
import argparse
import contextlib
from datetime import datetime, timedelta, timezone
import json
from pathlib import Path
import re
import subprocess
import sys
import time
from research_engine import MODEL_IDS


def fetch_snapshot(repo, ticker):
    sys.path.insert(0, str(Path(repo).resolve()))
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent / 'dsa'))
    from data_provider.yfinance_fetcher import YfinanceFetcher
    from worker import completed_bars
    import yfinance as yf
    info=yf.Ticker(ticker).get_info()
    if info.get('symbol','').upper()!=ticker or info.get('currency')!='USD' or info.get('exchange') not in {'NMS','NGM','NCM','NYQ','PCX','ASE','BTS','BATS'}:
        raise ValueError('Unsupported security')
    now=datetime.now(timezone.utc)
    frame=YfinanceFetcher().get_daily_data(ticker,start_date=(now-timedelta(days=1100)).strftime('%Y-%m-%d'),end_date=(now+timedelta(days=1)).strftime('%Y-%m-%d'))
    return dict(ticker=ticker,bars=completed_bars(frame,now))


def main():
    p=argparse.ArgumentParser();p.add_argument('--dsa-repo');p.add_argument('--tickers',nargs='+',default=['AAPL'])
    p.add_argument('--models',nargs='+',default=['lstm','gru','transformer','autoencoder','temporal_stack','arima','paper_evolution','paper_qlearning','risk_diagnostics'])
    p.add_argument('--output');p.add_argument('--evaluate-file');p.add_argument('--model');a=p.parse_args()
    if a.evaluate_file:
        from research_engine import evaluate_research
        data=json.loads(Path(a.evaluate_file).read_text(encoding='utf-8'))
        with contextlib.redirect_stdout(sys.stderr):report=evaluate_research(data['bars'],data['ticker'],a.model)
        print(json.dumps(report,allow_nan=False));return 0
    if not a.dsa_repo or not a.output:p.error('Provide --dsa-repo and --output')
    tickers=list(dict.fromkeys(t.upper() for t in a.tickers));models=list(MODEL_IDS) if a.models==['all'] else list(dict.fromkeys(a.models))
    if len(tickers)>6 or not all(re.fullmatch('[A-Z]{1,5}',t) for t in tickers) or not all(m in MODEL_IDS for m in models):p.error('Unsupported ticker or model')
    output=Path(a.output).resolve();output.mkdir(parents=True,exist_ok=True);rows=[]
    for ticker in tickers:
        snapshot=output/f'{ticker}-snapshot.json'
        try:
            with contextlib.redirect_stdout(sys.stderr): data=fetch_snapshot(a.dsa_repo,ticker)
            snapshot.write_text(json.dumps(data,allow_nan=False),encoding='utf-8')
        except Exception as error:
            rows.append(dict(ticker=ticker,model='all',status='failed',reason=type(error).__name__))
            print(json.dumps(rows[-1]),flush=True)
            continue
        for model in models:
            started=time.monotonic()
            try:
                response=subprocess.run([sys.executable,str(Path(__file__).resolve()),'--evaluate-file',str(snapshot),'--model',model],capture_output=True,text=True,encoding='utf-8',timeout=45,check=True)
                report=json.loads(response.stdout)
                (output/f'{ticker}-{model}.json').write_text(json.dumps(report,allow_nan=False),encoding='utf-8')
                pred=report['prediction'];strategy=report['strategy']
                row=dict(ticker=ticker,model=model,status='ok',seconds=round(time.monotonic()-started,2),data_hash=report['data_hash'],kind=report['kind'],
                         qualified=pred['qualified'] if pred else None,mae_pp=pred['model']['mae_pp'] if pred else None,
                         flat_mae_pp=pred['flat']['mae_pp'] if pred else None,drift_mae_pp=pred['drift']['mae_pp'] if pred else None,
                         paper_return_pct=strategy['return_pct'] if strategy else None)
            except (subprocess.SubprocessError,ValueError,KeyError) as error:
                row=dict(ticker=ticker,model=model,status='failed',seconds=round(time.monotonic()-started,2),reason=type(error).__name__)
            rows.append(row);print(json.dumps(row),flush=True)
            (output/'summary.json').write_text(json.dumps(dict(generated_at=datetime.now(timezone.utc).isoformat(),results=rows),indent=2),encoding='utf-8')
    (output/'summary.json').write_text(json.dumps(dict(generated_at=datetime.now(timezone.utc).isoformat(),results=rows),indent=2),encoding='utf-8')
    return int(any(row['status']!='ok' for row in rows))


if __name__=='__main__':sys.exit(main())
