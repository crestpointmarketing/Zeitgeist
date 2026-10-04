"""Explicit, sequential live smoke benchmark. No tuning, credentials or AI calls.

Run from the app root with --dsa-repo pointing at the configured fork checkout.
Reports contain public market observations and model outputs, not account data.
"""
import argparse
from datetime import datetime, timezone
import json
from pathlib import Path
import re
import subprocess
import sys
import time


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--dsa-repo', required=True)
    parser.add_argument('--tickers', nargs='+', default=['AAPL', 'MSFT', 'NVDA', 'TSLA'])
    parser.add_argument('--output', required=True)
    args = parser.parse_args()
    tickers = list(dict.fromkeys(t.upper() for t in args.tickers))
    if not all(re.fullmatch('[A-Z]{1,5}', t) for t in tickers) or len(tickers) > 12:
        parser.error('Provide at most 12 US ticker symbols')
    worker = Path(__file__).resolve().parent.parent / 'dsa' / 'forecast_worker.py'
    output = Path(args.output)
    output.mkdir(parents=True, exist_ok=True)
    rows = []
    for ticker in tickers:
        started = time.monotonic()
        try:
            result = subprocess.run([sys.executable, str(worker), args.dsa_repo, ticker, '0'],
                                    capture_output=True, text=True, timeout=45, check=True)
            report = json.loads(result.stdout)
            (output / f'{ticker}.json').write_text(json.dumps(report, indent=2, allow_nan=False), encoding='utf-8')
            rows.append({'ticker': ticker, 'status': 'ok', 'seconds': round(time.monotonic() - started, 2),
                         'version': report['version'], 'data_hash': report['data_hash'],
                         'as_of': report['as_of'], 'history_bars': report['history_bars'],
                         'qualified': report['qualified'],
                         'metrics': {key: report['backtest'][key] for key in ['model', 'flat', 'drift']},
                         'candidates': report['backtest']['candidates']})
        except (subprocess.SubprocessError, ValueError, KeyError) as error:
            # Never drop failed symbols from the benchmark's denominator.
            rows.append({'ticker': ticker, 'status': 'failed', 'seconds': round(time.monotonic() - started, 2),
                         'reason': type(error).__name__})
        print(json.dumps(rows[-1]), flush=True)
    summary = {'generated_at': datetime.now(timezone.utc).isoformat(), 'requested_tickers': tickers,
               'purpose': 'Fixed-parameter smoke comparison; selected symbols are not evidence of generalization or profitability.',
               'results': rows}
    (output / 'summary.json').write_text(json.dumps(summary, indent=2, allow_nan=False), encoding='utf-8')
    return 1 if any(row['status'] != 'ok' for row in rows) else 0


if __name__ == '__main__':
    sys.exit(main())
