"use client";
import { useEffect, useRef, useState } from 'react';
import { FlaskConical, LoaderCircle, Play, CheckCircle2, ShieldAlert } from 'lucide-react';
import type { ForecastReport } from '@/lib/forecast-schema';

const dollars = (v: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(v);
const percent = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`;

export function ForecastResults({ report: r }: { report: ForecastReport }) {
  const points = [{ date: r.as_of, p10: r.last_close, p50: r.last_close, p90: r.last_close }, ...r.simulation];
  const low = Math.min(...points.map(p => p.p10)), high = Math.max(...points.map(p => p.p90));
  const padding = Math.max((high - low) * .15, .01);
  const y = (price: number) => 160 - (price - low + padding) / (high - low + 2 * padding) * 140;
  const x = (i: number) => 48 + i * 96;
  const line = (key: 'p10' | 'p50' | 'p90') => points.map((p, i) => `${x(i)},${y(p[key])}`).join(' ');
  const band = `${line('p90')} ${[...points].reverse().map((p, i) => `${x(points.length - i - 1)},${y(p.p10)}`).join(' ')}`;
  return <div className="space-y-6">
    <div className={`rounded-xl border p-5 ${r.qualified ? 'border-teal-400/25 bg-teal-400/5' : 'border-amber-400/25 bg-amber-400/5'}`}>
      <h3 className="flex items-center gap-2 font-semibold">{r.qualified ? <CheckCircle2 size={18} className="text-teal-300"/> : <ShieldAlert size={18} className="text-amber-300"/>}{r.qualified ? 'Passed this historical baseline comparison' : 'No model forecast published'}</h3>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{r.qualified ? 'Five-session return MAE was at least 5% lower than both baselines. This small historical test does not establish a reliable trading edge.' : 'The tree ensemble did not reduce five-session return MAE by at least 5% against both baselines. Its backtest remains visible; it is not promoted as a price forecast.'}</p>
      {r.forecast && <p className="mt-4 text-xl font-semibold text-teal-300">Experimental target: {dollars(r.forecast.price)} <span className="text-sm">({percent(r.forecast.return_pct)}) · {r.target_date}</span></p>}
    </div>
    <div><h3 className="font-semibold">Walk-forward backtest</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">30 consecutive, non-overlapping five-session test windows. Each fit uses only labels available at that window’s origin. Fixed model settings; no test-period tuning.</p>
      <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[400px] text-left text-sm"><caption className="sr-only">Five-session return prediction error; lower is better. Units are percentage points.</caption><thead className="text-muted-foreground"><tr><th className="py-3">Model</th><th>MAE (pp)</th><th>RMSE (pp)</th></tr></thead><tbody>{([['model','Tree ensemble'],['flat','Unchanged price'],['drift','60-session drift']] as const).map(([key,label]) => <tr className="border-t border-border" key={key}><th className="py-3 font-medium">{label}</th><td className="tabular-nums">{r.backtest[key].mae_pp.toFixed(3)}</td><td className="tabular-nums">{r.backtest[key].rmse_pp.toFixed(3)}</td></tr>)}</tbody></table></div>
      <p className="mt-3 text-xs leading-6 text-muted-foreground">Directional hit rate: {r.backtest.direction_hit_pct === null ? 'Unavailable' : `${r.backtest.direction_hit_pct.toFixed(1)}%`} across {r.backtest.direction_samples} non-flat targets. This is a historical sample, not a confidence score or expected profit. MAE/RMSE measure five-session return error, not dollars.</p>
    </div>
    <div className="rounded-xl border border-border bg-primary/5 p-4"><h3 className="font-semibold">Monte Carlo scenarios</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">A separate illustration using 252 observed log returns and 2,000 simulated paths. The shaded 10th–90th percentile band is not a calibrated confidence interval. It can miss market shocks.</p>
      <svg className="mt-4 w-full" viewBox="0 0 580 200" role="img" aria-label={`Five-session simulated price scenarios for ${r.ticker}. Median ${dollars(r.simulation[4].p50)} on ${r.target_date}. Exact values in the table below.`}><line x1="48" x2="528" y1="160" y2="160" stroke="#28455f"/><polygon points={band} fill="#22d3ee" fillOpacity=".13"/><polyline points={line('p50')} fill="none" stroke="#22d3ee" strokeWidth="2.5" strokeDasharray="5 4"/><circle cx="48" cy={y(r.last_close)} r="4" fill="#60a5fa"/><text x="48" y="185" fontSize="11" fill="#a9c0dc">{r.as_of}</text><text x="528" y="185" textAnchor="end" fontSize="11" fill="#a9c0dc">{r.target_date}</text><text x="48" y="12" fontSize="11" fill="#a9c0dc">{dollars(low)} – {dollars(high)}</text></svg>
      <details><summary className="cursor-pointer text-sm text-primary">View scenario values</summary><div className="mt-3 overflow-x-auto"><table className="w-full min-w-[400px] text-left text-xs"><thead><tr><th>Date</th><th>10th percentile</th><th>Median</th><th>90th percentile</th></tr></thead><tbody>{r.simulation.map(p => <tr key={p.date} className="border-t border-border"><td className="py-3">{p.date}</td><td>{dollars(p.p10)}</td><td>{dollars(p.p50)}</td><td>{dollars(p.p90)}</td></tr>)}</tbody></table></div></details>
    </div>
    <details><summary className="cursor-pointer text-sm text-primary">Inspect all 30 test windows</summary><div className="mt-3 overflow-x-auto"><table className="w-full min-w-[620px] text-left text-xs"><thead><tr><th>Origin / labels available through</th><th>Target</th><th>Tree return</th><th>Actual return</th><th>Drift return</th></tr></thead><tbody>{r.backtest.windows.map(w => <tr key={w.origin} className="border-t border-border"><td className="py-3">{w.origin} / {w.training_labels_through}</td><td>{w.target}</td><td>{percent(w.model_return_pct)}</td><td>{percent(w.actual_return_pct)}</td><td>{percent(w.drift_return_pct)}</td></tr>)}</tbody></table></div></details>
    <p className="text-xs leading-6 text-muted-foreground">Source: {r.source}. {r.history_bars} sessions from {r.history_start} to {r.as_of}; last adjusted close {dollars(r.last_close)}. This experiment uses its own longer DSA history, independently of the selected quote provider. Current adjusted data may incorporate later corporate-action revisions; this is not a point-in-time trading simulation. No transaction costs or strategy returns are measured.</p>
    <p className="break-words text-xs leading-6 text-muted-foreground">Version: {r.version} · Data fingerprint: {r.data_hash} · Generated: {r.generated_at}. Adapted from <a className="text-primary underline" href={`https://github.com/crestpointmarketing/Stock-Prediction-Models/tree/${r.fork_commit}`} target="_blank" rel="noopener noreferrer">your Stock-Prediction-Models fork</a> under Apache-2.0. The old TensorFlow encoder, original accuracy metric and trading agents are not used.</p>
  </div>;
}

export function ForecastLab({ ticker }: { ticker: string }) {
  const [report, setReport] = useState<ForecastReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  async function run() {
    if (controller.current && !controller.current.signal.aborted) return;
    const active = new AbortController(); controller.current = active;
    setRunning(true); setError(null);
    try {
      const response = await fetch('/api/forecast', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ticker }), signal: AbortSignal.any([active.signal, AbortSignal.timeout(55_000)]) });
      const body = await response.json();
      if (!response.ok || !body.success) throw new Error(typeof body.error?.message === 'string' ? body.error.message : 'Experiment unavailable. Please retry later.');
      if (!active.signal.aborted) setReport(body.data);
    } catch (err) { if (!active.signal.aborted) setError(err instanceof Error ? err.message : 'Experiment unavailable.'); }
    finally { if (!active.signal.aborted) { setRunning(false); controller.current = null; } }
  }
  return <section className="space-y-6 p-5 sm:p-7" aria-label="Prediction experiment"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="app-eyebrow">Experimental · Five trading sessions</p><h2 className="mt-2 flex items-center gap-2 text-xl font-semibold"><FlaskConical className="text-primary" size={22}/>Model lab · {ticker}</h2></div><button className="app-button" disabled={running} onClick={() => void run()}>{running ? <LoaderCircle className="animate-spin" size={17}/> : <Play size={17}/>} {running ? 'Evaluating…' : report ? 'Run again' : 'Run experiment'}</button></div><p className="text-sm leading-7 text-muted-foreground">Random Forest + Extra Trees from the second fork, adapted for chronological evaluation. Runs on demand, uses one market-data request from your budget, and makes no paid AI call. Allow up to a minute. Results are cached for one hour.</p>{running && <p role="status" className="text-sm text-primary">Loading completed sessions and evaluating 30 historical windows…</p>}{error && <p role="alert" className="rounded-xl border border-destructive/30 p-4 text-sm text-destructive">{error}</p>}{report && <ForecastResults report={report}/>}</section>;
}
