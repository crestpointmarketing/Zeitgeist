"use client";

import { useState } from 'react';
import type { ForecastReport } from '@/lib/forecast-schema';
import { backtestCsv, diagnostics, improvement, MODEL_LABELS, windowMetrics, windowReturn, type ComparedModel } from '@/lib/forecast-diagnostics';

const gain = (value: number | null) => value === null ? 'N/A · zero baseline error' : `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;

export function ForecastComparison({ report }: { report: ForecastReport }) {
  const [selected, setSelected] = useState<ComparedModel>('model');
  const [windowIndex, setWindowIndex] = useState(29);
  const models: ComparedModel[] = report.backtest.candidates
    ? ['model', 'extra_trees', 'random_forest', 'ridge', ...(report.backtest.candidates.gradient_boosting ? ['gradient_boosting'] as const : []), 'flat', 'drift'] : ['model', 'flat', 'drift'];
  const key = models.includes(selected) ? selected : 'model';
  const d = diagnostics(report), windows = report.backtest.windows;
  const actual = windows.map(w => w.actual_return_pct), predicted = windows.map(w => windowReturn(w, key)!);
  const low = Math.min(0, ...actual, ...predicted), high = Math.max(0, ...actual, ...predicted);
  const span = Math.max(high - low, .1), padding = span * .12;
  const y = (value: number) => 180 - (value - low + padding) / (span + padding * 2) * 150;
  const x = (i: number) => 54 + i / (windows.length - 1) * 530;
  const line = (values: number[]) => values.map((v, i) => `${x(i)},${y(v)}`).join(' ');
  const inspected = windows[windowIndex];
  const prediction = predicted[windowIndex];
  return <section className="space-y-6" aria-label="Model comparison and reliability">
    <div className="border-b border-border pb-5">
      <h3 className="font-semibold">Why this result?</h3>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">Primary model MAE: <strong className="text-foreground tabular-nums">{report.backtest.model.mae_pp.toFixed(4)} pp</strong>. Publication requires it to be strictly below <strong className="text-foreground tabular-nums">{d.threshold.toFixed(4)} pp</strong> (95% of the stronger baseline’s error). Displayed numbers are rounded; the check uses full precision.</p>
      <dl className="mt-4 grid gap-4 sm:grid-cols-2"><div><dt className="text-xs text-muted-foreground">Error reduction vs. unchanged price</dt><dd className="mt-1 tabular-nums">{gain(d.flatImprovement)}</dd></div><div><dt className="text-xs text-muted-foreground">Error reduction vs. drift</dt><dd className="mt-1 tabular-nums">{gain(d.driftImprovement)}</dd></div></dl>
      <p className="mt-3 text-xs leading-6 text-muted-foreground">Positive means less error, negative means more error. This measures historical prediction error, not investment return. A zero-error baseline cannot be beaten by this gate.</p>
    </div>
    <div>
      <h3 className="font-semibold">Compare the models</h3>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">All models use the same 30 historical targets. The tree ensemble remains the preselected primary model. Comparators never replace it just because they look better on these test windows.</p>
      {report.backtest.candidates && <p className="mt-2 text-xs leading-6 text-muted-foreground">Ridge is a new fixed-parameter linear comparator (alpha 10). Its scaler is fit only on each window’s training data. No settings are tuned on these test results.</p>}
      {report.backtest.candidates?.gradient_boosting && <div className="mt-4 rounded-lg border border-border p-4"><h4 className="text-sm font-semibold">Gradient Boosting · price and volume model</h4><p className="mt-2 text-xs leading-6 text-muted-foreground">An additional model adapted from the fork’s stacking notebook. It uses past returns, price momentum, trading ranges and relative volume. It must independently clear the same 5% baseline gate before a target is shown.</p>{report.boosted_forecast ? <p className="mt-3 text-sm text-cyan-300">Additional experimental target: ${report.boosted_forecast.price.toFixed(2)} ({report.boosted_forecast.return_pct.toFixed(2)}%) · {report.target_date}. This historical comparison is not independent confirmation of future accuracy.</p> : <p className="mt-3 text-sm text-amber-300">No Gradient Boosting target: it did not clear both baselines.</p>}</div>}
      <div className="mt-4 overflow-x-auto" role="region" aria-label="Model comparison table" tabIndex={0}><table className="w-full min-w-[540px] text-left text-sm"><caption className="sr-only">Historical return errors in percentage points; lower is better. Relative improvement uses the stronger baseline.</caption><thead className="text-muted-foreground"><tr><th className="py-3">Model</th><th>MAE (pp)</th><th>RMSE (pp)</th><th>Error reduction</th></tr></thead><tbody>{models.map(model => {
        const m = windowMetrics(windows, model)!;
        return <tr key={model} className="border-t border-border"><th className="py-3 pr-3 font-medium">{MODEL_LABELS[model]}</th><td className="tabular-nums">{m.mae_pp.toFixed(3)}</td><td className="tabular-nums">{m.rmse_pp.toFixed(3)}</td><td className="tabular-nums">{gain(improvement(m.mae_pp, Math.min(report.backtest.flat.mae_pp, report.backtest.drift.mae_pp)))}</td></tr>;
      })}</tbody></table></div>
    </div>
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="font-semibold">Predicted vs. actual returns</h3><label className="text-xs text-muted-foreground">Compare model <select className="ml-2 max-w-full rounded-lg border border-border bg-card px-2 py-2 text-foreground" value={key} onChange={event => setSelected(event.target.value as ComparedModel)}>{models.map(model => <option value={model} key={model}>{MODEL_LABELS[model]}</option>)}</select></label></div>
      <p className="mt-2 text-xs leading-6 text-muted-foreground">Each point is a completed five-session test window. These are historical predictions, not future price paths.</p>
      <div className="mt-3 flex gap-5 text-xs"><span className="text-blue-300">━ Actual</span><span className="text-cyan-300">┄ {MODEL_LABELS[key]}</span></div>
      <svg viewBox="0 0 620 220" className="mt-2 w-full" role="img" aria-label={`Historical five-session returns: ${MODEL_LABELS[key]} versus actual; all 30 values are available in the CSV download.`}>
        <line x1="54" x2="584" y1={y(0)} y2={y(0)} stroke="#28455f" strokeDasharray="3 5"/>
        <text x="48" y={y(high)} textAnchor="end" fill="#a9c0dc" fontSize="11">{high.toFixed(1)}%</text><text x="48" y={y(low)} textAnchor="end" fill="#a9c0dc" fontSize="11">{low.toFixed(1)}%</text>
        <polyline points={line(actual)} fill="none" stroke="#93c5fd" strokeWidth="2"/><polyline points={line(predicted)} fill="none" stroke="#22d3ee" strokeWidth="2" strokeDasharray="5 4"/>
        <line x1={x(windowIndex)} x2={x(windowIndex)} y1="20" y2="185" stroke="#a9c0dc" strokeOpacity=".45" strokeDasharray="2 4"/>
        <circle cx={x(windowIndex)} cy={y(actual[windowIndex])} r="4" fill="#93c5fd"/><circle cx={x(windowIndex)} cy={y(prediction)} r="4" fill="#22d3ee"/>
        <text x="54" y="210" fill="#a9c0dc" fontSize="11">{windows[0].target}</text><text x="584" y="210" textAnchor="end" fill="#a9c0dc" fontSize="11">{windows.at(-1)!.target}</text>
      </svg>
      <label className="block text-xs text-muted-foreground">Inspect historical window · {windowIndex + 1} of 30<input className="mt-3 block w-full accent-cyan-400" type="range" min="0" max="29" step="1" value={windowIndex} onChange={event => setWindowIndex(Number(event.target.value))} aria-label="Historical test window" aria-valuetext={`Window ${windowIndex + 1}, ${inspected.origin} to ${inspected.target}`}/></label>
      <div className="mt-4 rounded-lg border border-border p-4" aria-live="polite" aria-atomic="true"><p className="text-sm font-medium">{inspected.origin} → {inspected.target}</p><dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3"><div><dt className="text-xs text-muted-foreground">Predicted return</dt><dd className="mt-1 tabular-nums">{prediction.toFixed(2)}%</dd></div><div><dt className="text-xs text-muted-foreground">Actual return</dt><dd className="mt-1 tabular-nums">{inspected.actual_return_pct.toFixed(2)}%</dd></div><div><dt className="text-xs text-muted-foreground">Absolute error</dt><dd className="mt-1 tabular-nums">{Math.abs(prediction - inspected.actual_return_pct).toFixed(2)} pp</dd></div></dl><p className="mt-3 text-xs text-muted-foreground">Training labels available through {inspected.training_labels_through}. Use the slider or arrow keys to inspect each window.</p></div>
    </div>
    <div><h3 className="font-semibold">Does performance hold across the sample?</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">Three consecutive blocks of 10 windows reveal changes hidden by the average. They are descriptive slices of the same backtest, not additional independent validation or a new publication gate.</p>
      <div className="mt-4 grid gap-3 xl:grid-cols-3">{d.blocks.map((block, i) => <div key={block.start} className="rounded-lg border border-border p-4"><p className="text-sm font-medium">{['Earlier', 'Middle', 'Recent'][i]} 10 windows</p><p className="mt-1 text-xs text-muted-foreground">{block.start} – {block.end}</p><p className="mt-3 text-sm tabular-nums">Primary MAE {block.model.toFixed(3)} pp</p><p className="mt-1 text-xs text-muted-foreground">Flat {block.flat.toFixed(3)} · Drift {block.drift.toFixed(3)} pp</p><p className={`mt-3 text-xs ${block.passes ? 'text-teal-300' : 'text-amber-300'}`}>{block.passes ? 'Clears the 5% comparison in this block' : 'Does not clear both baselines in this block'}</p></div>)}</div>
    </div>
    <div className="flex flex-wrap gap-3"><a className="app-button-secondary text-sm" download={`${report.ticker}-${report.as_of}-backtest.csv`} href={`data:text/csv;charset=utf-8,${encodeURIComponent(backtestCsv(report))}`}>Download backtest CSV</a><a className="app-button-secondary text-sm" download={`${report.ticker}-${report.as_of}-experiment.json`} href={`data:application/json;charset=utf-8,${encodeURIComponent(JSON.stringify(report, null, 2))}`}>Download full report</a></div>
  </section>;
}
