import type { ForecastReport } from './forecast-schema';

export type BacktestWindow = ForecastReport['backtest']['windows'][number];
export type ComparedModel = 'model' | 'flat' | 'drift' | 'extra_trees' | 'random_forest' | 'ridge';
export const MODEL_LABELS: Record<ComparedModel, string> = {
  model: 'Tree ensemble (primary)', flat: 'Unchanged price', drift: '60-session drift',
  extra_trees: 'Extra Trees', random_forest: 'Random Forest', ridge: 'Ridge (comparator)',
};
export function windowReturn(w: BacktestWindow, key: ComparedModel): number | null {
  if (key === 'flat') return 0;
  if (key === 'model') return w.model_return_pct;
  if (key === 'drift') return w.drift_return_pct;
  return w.candidate_returns_pct?.[key] ?? null;
}
export function windowMetrics(windows: BacktestWindow[], key: ComparedModel) {
  const predictions = windows.map(w => windowReturn(w, key));
  if (!windows.length || predictions.some(v => v === null)) return null;
  const errors = windows.map((w, i) => predictions[i]! - w.actual_return_pct);
  return { mae_pp: errors.reduce((sum, e) => sum + Math.abs(e), 0) / errors.length,
    rmse_pp: Math.sqrt(errors.reduce((sum, e) => sum + e * e, 0) / errors.length) };
}
export function improvement(model: number, baseline: number): number | null {
  return baseline > 0 ? (baseline - model) / baseline * 100 : null;
}
export function diagnostics(report: ForecastReport) {
  const { model, flat, drift, windows } = report.backtest;
  const threshold = .95 * Math.min(flat.mae_pp, drift.mae_pp);
  return { threshold, flatImprovement: improvement(model.mae_pp, flat.mae_pp),
    driftImprovement: improvement(model.mae_pp, drift.mae_pp),
    blocks: [0, 10, 20].map(start => {
      const sample = windows.slice(start, start + 10);
      const model = windowMetrics(sample, 'model')!, flat = windowMetrics(sample, 'flat')!, drift = windowMetrics(sample, 'drift')!;
      return { start: sample[0].origin, end: sample.at(-1)!.target, model: model.mae_pp,
        flat: flat.mae_pp, drift: drift.mae_pp, passes: model.mae_pp < .95 * Math.min(flat.mae_pp, drift.mae_pp) };
    }) };
}
export function backtestCsv(report: ForecastReport): string {
  const header = 'ticker,version,data_hash,origin,target,training_labels_through,actual_return_pct,ensemble_return_pct,extra_trees_return_pct,random_forest_return_pct,ridge_return_pct,drift_return_pct,flat_return_pct';
  return [header, ...report.backtest.windows.map(w => [report.ticker, report.version, report.data_hash, w.origin, w.target,
    w.training_labels_through, w.actual_return_pct, w.model_return_pct, w.candidate_returns_pct?.extra_trees ?? '',
    w.candidate_returns_pct?.random_forest ?? '', w.candidate_returns_pct?.ridge ?? '', w.drift_return_pct, 0].join(','))].join('\r\n');
}
