import { z } from 'zod';

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v => Number.isFinite(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v);
const finite = z.number().finite();
const positive = finite.positive();
const metric = z.object({ mae_pp: finite.nonnegative(), rmse_pp: finite.nonnegative() });
const candidateReturns = z.object({ extra_trees: finite.gt(-100), random_forest: finite.gt(-100), ridge: finite.gt(-100), gradient_boosting: finite.gt(-100).optional() });
const candidateMetrics = z.object({ extra_trees: metric, random_forest: metric, ridge: metric, gradient_boosting: metric.optional() });
export const forecastSchema = z.object({
  version: z.enum(['fork-trees-v1', 'fork-comparison-v2', 'fork-comparison-v3']), fork_commit: z.literal('33266732b0b16188b565e0aeb6b24efa71161f6a'),
  ticker: z.string().regex(/^[A-Z]{1,5}$/), source: z.literal('DSA / Yahoo Finance (adjusted)'), currency: z.literal('USD'),
  generated_at: z.string().datetime({ offset: true }), as_of: day, history_start: day,
  history_bars: z.number().int().min(400).max(900), data_hash: z.string().regex(/^[a-f0-9]{16}$/),
  horizon_sessions: z.literal(5), last_close: positive, target_date: day, qualified: z.boolean(),
  forecast: z.object({ price: positive, return_pct: finite.gt(-100) }).nullable(),
  boosted_forecast: z.object({ price: positive, return_pct: finite.gt(-100) }).nullable().optional(),
  backtest: z.object({
    model: metric, flat: metric, drift: metric, candidates: candidateMetrics.optional(), direction_hit_pct: finite.min(0).max(100).nullable(),
    direction_samples: z.number().int().min(0).max(30),
    windows: z.array(z.object({ origin: day, target: day, training_labels_through: day,
      model_return_pct: finite.gt(-100), actual_return_pct: finite.gt(-100), drift_return_pct: finite.gt(-100), candidate_returns_pct: candidateReturns.optional() })).length(30),
  }),
  simulation: z.array(z.object({ date: day, p10: positive, p50: positive, p90: positive })).length(5),
});
export type ForecastReport = z.infer<typeof forecastSchema>;

/** Reject wrong-symbol, stale, time-leaking, internally inconsistent experiment reports. */
export function parseForecast(value: unknown, ticker: string, now = Date.now()): ForecastReport {
  const data = forecastSchema.parse(value);
  const generated = Date.parse(data.generated_at), last = Date.parse(data.as_of);
  if (data.ticker !== ticker || generated > now + 60_000 || now - generated > 2 * 3600_000 || last > now || now - last > 8 * 86400_000 || data.history_start >= data.as_of || data.target_date <= data.as_of) throw new Error('Invalid experiment date or ticker');
  const windows = data.backtest.windows;
  for (const [i, window] of windows.entries()) {
    if (window.training_labels_through > window.origin || window.origin >= window.target || window.origin < data.history_start || window.target > data.as_of || (i && windows[i - 1].target !== window.origin)) throw new Error('Invalid walk-forward split');
  }
  if (windows.at(-1)!.target !== data.as_of) throw new Error('Backtest does not end at the latest session');
  const closeEnough = (a: number, b: number) => Math.abs(a - b) <= 1e-6 * Math.max(1, Math.abs(b));
  const hasCandidates = Boolean(data.backtest.candidates);
  if (data.version !== 'fork-trees-v1' && !hasCandidates) throw new Error('Missing comparator metrics');
  const hasBoosted = Boolean(data.backtest.candidates?.gradient_boosting);
  if (data.version === 'fork-comparison-v3' && (!hasBoosted || data.boosted_forecast === undefined)) throw new Error('Missing boosted experiment');
  if (windows.some(w => (w.candidate_returns_pct?.gradient_boosting !== undefined) !== hasBoosted)) throw new Error('Incomplete boosted observations');
  if (windows.some(w => Boolean(w.candidate_returns_pct) !== hasCandidates)) throw new Error('Incomplete comparator observations');
  if (hasCandidates) {
    const candidateKeys = ['extra_trees', 'random_forest', 'ridge', ...(hasBoosted ? ['gradient_boosting'] as const : [])] as const;
    for (const key of candidateKeys) {
      const errors = windows.map(w => w.candidate_returns_pct![key]! - w.actual_return_pct);
      const mae = errors.reduce((sum, e) => sum + Math.abs(e), 0) / errors.length;
      const rmse = Math.sqrt(errors.reduce((sum, e) => sum + e * e, 0) / errors.length);
      if (!closeEnough(mae, data.backtest.candidates![key]!.mae_pp) || !closeEnough(rmse, data.backtest.candidates![key]!.rmse_pp)) throw new Error('Comparator metrics do not match observations');
    }
    for (const w of windows) {
      const values = w.candidate_returns_pct!;
      const ensemble = Math.expm1((Math.log1p(values.extra_trees / 100) + Math.log1p(values.random_forest / 100)) / 2) * 100;
      if (!closeEnough(ensemble, w.model_return_pct)) throw new Error('Primary model differs from the fixed tree ensemble');
    }
  }
  for (const key of ['model', 'flat', 'drift'] as const) {
    const errors = windows.map(w => (key === 'flat' ? 0 : key === 'model' ? w.model_return_pct : w.drift_return_pct) - w.actual_return_pct);
    const mae = errors.reduce((sum, e) => sum + Math.abs(e), 0) / errors.length;
    const rmse = Math.sqrt(errors.reduce((sum, e) => sum + e * e, 0) / errors.length);
    if (!closeEnough(mae, data.backtest[key].mae_pp) || !closeEnough(rmse, data.backtest[key].rmse_pp)) throw new Error('Backtest metrics do not match observations');
  }
  const directional = windows.filter(w => Math.abs(w.actual_return_pct) > 1e-10);
  const hit = directional.filter(w => Math.sign(w.actual_return_pct) === Math.sign(w.model_return_pct)).length;
  if (data.backtest.direction_samples !== directional.length || (directional.length ? data.backtest.direction_hit_pct === null || !closeEnough(data.backtest.direction_hit_pct, hit / directional.length * 100) : data.backtest.direction_hit_pct !== null)) throw new Error('Invalid direction score');
  const qualified = data.backtest.model.mae_pp < .95 * Math.min(data.backtest.flat.mae_pp, data.backtest.drift.mae_pp);
  if (data.qualified !== qualified || Boolean(data.forecast) !== qualified) throw new Error('Forecast bypasses baseline gate');
  if (data.forecast && !closeEnough(data.forecast.price, data.last_close * (1 + data.forecast.return_pct / 100))) throw new Error('Invalid forecast price');
  if (hasBoosted) {
    const passed = data.backtest.candidates!.gradient_boosting!.mae_pp < .95 * Math.min(data.backtest.flat.mae_pp, data.backtest.drift.mae_pp);
    if (Boolean(data.boosted_forecast) !== passed) throw new Error('Boosted forecast bypasses baseline gate');
  } else if (data.boosted_forecast) throw new Error('Unexpected boosted forecast');
  if (data.boosted_forecast && !closeEnough(data.boosted_forecast.price, data.last_close * (1 + data.boosted_forecast.return_pct / 100))) throw new Error('Invalid boosted target');
  for (const [i, point] of data.simulation.entries()) {
    if (point.p10 > point.p50 || point.p50 > point.p90 || point.date <= (i ? data.simulation[i - 1].date : data.as_of)) throw new Error('Invalid simulation quantiles');
  }
  if (data.simulation.at(-1)!.date !== data.target_date) throw new Error('Mismatched forecast horizons');
  return data;
}
