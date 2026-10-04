# Fork-derived prediction lab

Source: [crestpointmarketing/Stock-Prediction-Models](https://github.com/crestpointmarketing/Stock-Prediction-Models), originally by huseinzol05 and contributors, commit `33266732b0b16188b565e0aeb6b24efa71161f6a`. Its LICENSE is Apache-2.0 (the README badge is inconsistent). The complete license is retained alongside this file. The upstream checkout contains no NOTICE file. SHA-256 fingerprints of the reviewed notebooks are in SOURCE_MANIFEST.json.

## Adapted modules (modified 2026-10-03)

- `stacking/stack-encoder-ensemble-xgb.ipynb`: reuse the RandomForestRegressor and ExtraTreesRegressor members. The modernized `fork_models.py` combines their mean log-return predictions. Use fixed seeds, 64 trees each, depth 6, minimum leaf size 8 and one CPU job per model. The original TensorFlow encoder, full-data scaler, XGBoost stacking and training-set evaluation are removed, not silently replaced under the original model's name.
- `simulation/monte-carlo-drift.ipynb`: adapt the random-shock exponential path simulation. Fit empirical log-return mean and standard deviation on the last 252 returns. Do not subtract variance again. Simulate 2,000 seeded paths, take separate 10/50/90 percentiles at each of five sessions, and never pool all horizons into one distribution.

## Evaluation protocol

Fetch up to 1,100 calendar days through the first fork's YfinanceFetcher. Verify ticker, USD currency and supported US exchange. Require 400–900 complete, positive, finite daily observations, continuous NYSE sessions and a latest close no older than seven days. Reject insufficient or inconsistent inputs; no bundled historical CSV fallback.

Predict five-session cumulative return using 20 lagged log returns, five-/20-session means and 20-session volatility. Trees need no scaler. At origin t, training labels must end at or before t (`training_origin + 5 <= t`). Use at most 504 mature training rows. Refit with the same fixed settings for each of 30 consecutive non-overlapping five-session held-out windows. Later training may include earlier test outcomes once they are historically observable. There is no random split, hyperparameter search, early stopping on test data, or synthetic accuracy formula.

Report MAE/RMSE of five-session returns in percentage points, plus the sign hit rate on non-flat targets. Compare against unchanged price (zero return) and a trailing-60-session log-drift baseline, calculated separately at each origin. Publish a tree forecast only if its MAE is strictly less than 95% of BOTH baseline MAEs. This operational gate is not a statistical significance test. Always expose failed backtests and label the simulation as illustrative rather than measured confidence.

The small latest-window comparison does not establish profitability, statistical significance, robustness across regimes or calibrated uncertainty. Yahoo's currently adjusted history is not point-in-time archival data; corporate-action revisions and symbol selection limit this retrospective test. No trading strategy, costs, slippage or portfolio risk are modeled. Monte Carlo assumes stationary independent normally distributed log returns and can underestimate shocks.

## Comparison extension — 2026-10-04

Protocol `fork-comparison-v2` retains the preselected tree ensemble and the same
publication gate. It also reports the Extra Trees and Random Forest members
separately on exactly the same 30 test windows. No additional tree fits are needed.

A new Zeitgeist-authored Ridge comparator uses `StandardScaler` followed by
`Ridge(alpha=10.0)` on the same feature rows and mature return labels. This is not
claimed as code from the upstream notebooks. The scaler is fitted anew inside each
historical training window; neither it nor the estimator sees future targets.
Alpha and all other model settings are fixed before the reported evaluation.

Comparator results are diagnostic only: no retrospective winner selection, no
automatic promotion and no additional future price target are introduced. All
candidate metrics are recomputed from their observations at the TypeScript boundary,
which also verifies the ensemble's mean-log-return identity. The three 10-window
blocks in the UI are descriptive slices, not independent holdouts or new gates.
Percentage error reduction is not investment return. Monte Carlo remains separate
and uncalibrated. The client accepts v1 reports during a rolling deployment; v2
reports must contain all comparator observations and metrics.

The reproducible live smoke benchmark is `benchmark.py`. It runs a fixed requested
symbol list sequentially, retains failures, records timings and per-symbol data
fingerprints, and exports JSON reports. It makes no AI calls and tunes no settings.
Its selected symbols do not establish cross-market generalization. Example:

```powershell
python integrations/prediction/benchmark.py --dsa-repo /path/to/daily_stock_analysis --tickers AAPL MSFT NVDA TSLA --output reports/prediction-v2-benchmark
```

## Gradient Boosting extension — 2026-10-04

`fork-comparison-v3` adapts the `GradientBoostingRegressor` member from the same
`stacking/stack-encoder-ensemble-xgb.ipynb` (already fingerprinted in the manifest).
Its original 500 estimators / 0.1 learning rate are replaced with fixed 64 estimators,
0.03 learning rate, depth 2, minimum 12 observations per leaf, Huber loss and seed 42.
These settings are declared before the v3 smoke comparison; no search/tuning is run.

The new model uses the existing 23 return features plus nine causal OHLCV features:
close relative to trailing 5/20-session averages, same-session log close/open,
current/5-session/21-session high-low ranges divided by close, close location within
the day's range (0.5 for a zero range), and two trailing relative log-volume measures.
`log1p(volume)` handles zero volume without fabricated activity. All 32 features
use only information available at the prediction origin's close. Mature training
labels, 504-row cap, 30 test windows and five-session target are unchanged.

The original ensemble remains primary. Gradient Boosting may publish an additional
explicitly labeled experimental target only if its own MAE is strictly below 95%
of both baseline MAEs. Its latest target is fitted on labels available at the latest
close; no target is returned when it fails the gate. Both gates and price/return
arithmetic are independently verified at the web-service boundary. Comparing more
models creates selection risk: a historical pass is not independent prospective
validation, and the app does not automatically promote a retrospective winner.

v1/v2 reports remain readable during rollout. v3 reports must include Gradient
Boosting observations, consistent metrics and an explicit nullable target. The
feature work is new Zeitgeist adaptation, not a claim that the original notebook
used this feature set or evaluation. No new Python dependency or paid AI call is added.

## Runtime (all protocols)

The bridge has a separate one-worker forecast lock, a 45-second subprocess deadline and a one-hour in-memory cache. The existing market budget governs authenticated `/api/forecast` calls, including cached requests. No paid AI call is made. CPU workers cannot receive browser-specified tree counts, horizons or filesystem paths. No SQL migration or model binary deserialization is needed. Model reports are not passed to the LLM as established facts.

Install updated `integrations/dsa/requirements.txt` in the bridge virtual environment. No runtime clone of the second fork is needed: the adapted modules and retained license ship here. Run `python -m unittest discover -s integrations/prediction -p test_forecast.py` in that environment. Restart both services after changes.
