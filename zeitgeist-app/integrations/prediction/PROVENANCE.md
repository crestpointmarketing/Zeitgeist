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

## Extended research catalog — 2026-10-04

`fork-research-v1` adds an independently selected module beside the primary v3
ensemble. It does not pick the best historical model automatically. The complete
source inventory and exclusions are in `FORK-COVERAGE.md` and `FORK_COVERAGE.json`.

### Sequence architectures

All 18 numbered `deep-learning` notebook architecture routes are rewritten in
`sequence_models.py` using CPU PyTorch. This is architectural reuse with substantial
changes, not a line-for-line TensorFlow port or a reproduction of original scores.
LSTM/GRU/RNN have plain, bidirectional and two-path variants. Two-path means separate
20-session and 5-session encoders here. Encoder–decoder variants use five learned
step embeddings and an LSTM/GRU decoder; variational versions use a Gaussian latent
with KL weight 0.001, sampled in training and replaced by its mean for inference.
The Transformer has one two-head encoder with sinusoidal positions. CNNs use only
left padding (two dilation-1 layers, or dilations 1/2/4), followed by a GRU decoder.
Bidirectional processing spans observed history only, never the future target.

Each input contains 20 sessions of log-close changes, high-low range divided by
close, and changes in log1p volume. Use up to 252 mature examples and five next-day
log-return labels. Input and label scalers are fitted only to those examples.
Settings fixed before evaluation: seed 42, width 12, 12 full-batch epochs, Adam
learning rate 0.005, weight decay 0.001, gradient norm cap 1. The autoencoder route
fits a 60–24–6–24–60 reconstruction network for 12 epochs (Adam 0.005, no decay),
then a Ridge(alpha=10) head on the encoded training examples. Every historical
origin starts fresh; no training checkpoint, future-fit scaler, test tuning or
test-based early stopping is used. These small bounded fits are not comprehensive
deep-learning training or proof that an architecture is competitive.

### Classical and stacked models

`stack_models.py` adapts AdaBoost (32 trees, depth 3, leaf 12, rate .03), Bagging
(32 trees, depth 5, leaf 12), XGBoost (32 trees, depth 2, rate .03, lambda 10), and
ARIMA(1,1,0), no trend, trailing 252 log closes. The first three use the same 32
causal features as v3. Temporal stacking uses Extra Trees (16 trees, depth 4,
leaf 12), XGBoost and Ridge(alpha=10), with a Ridge(alpha=1) meta-model. Three
chronological out-of-fold blocks occupy the second half of the training examples;
five overlapping target rows are purged at each fit boundary. The meta-model sees
only those historical out-of-time predictions. All bases are then refitted using
available mature labels. Seeds are 42; CPU jobs are limited to one.

All 24 new prediction modules use the existing 30-window five-session evaluation
and independent 5% improvement gate against both baselines. Scores and the final
target arithmetic are recomputed/checked at both API and browser boundaries.
Direct five-session estimators do not expose an invented daily forecast curve.
Running many models increases selection bias: a marginal historical pass is not
prospective validation or a calibrated probability. The primary ensemble is unchanged.

### Paper strategies, risk and offline portfolio study

Four historical long/cash simulations adapt the moving-average (5/20), turtle
(20-session entry/10-session exit), evolution and Q-learning families. Evolution
uses a seeded 20-generation, 20-population search on training data only; Q-learning
is a deliberately small tabular six-state/two-action policy trained for 20 passes,
not the original neural Q agent. Both policies freeze before the 150 test intervals.
Signals use the prior close; executions use the next open; ten basis points per
side apply to entries, exits and final liquidation. Buy-and-hold uses identical
entry/exit costs. Full position, return, turnover and equity accounting is exported
and independently recalculated in TypeScript. Adjusted bars, fractional shares,
fixed costs and absence of market impact/taxes limit realism. No orders are sent.

Risk diagnostics combine an EWMA volatility process (decay .94) with 2,000 seeded
five-session paths and separate p10/p50/p90 quantiles, a training-only scaled
OneClassSVM (nu .05), return z-scores and simple-average RSI14. All last-20-session
outlier checks use earlier returns. These are uncalibrated scenarios and descriptive
indicators, not actionable forecasts or measured confidence.

`portfolio_research.py` is an offline CLI for 2–6 explicitly supplied snapshots:
252 training returns, covariance shrunk 10% to its diagonal, long-only minimum
variance weights capped at 60%, followed by an untouched 60-session test. Compare
equal weights with the same daily rebalancing and ten-basis-point turnover costs,
including entry and final liquidation. No account holdings or live portfolio UI.

## Runtime (all protocols)

The bridge shares one worker lock between primary forecasts and new research, with a 45-second subprocess deadline and a one-hour in-memory cache keyed by ticker and module. The existing market budget governs authenticated `/api/forecast` and `/api/model-research` calls, including cached requests. No paid AI call is made. CPU workers cannot receive browser-specified tree counts, horizons or filesystem paths. No SQL migration or model binary deserialization is needed. Model reports are not passed to the LLM as established facts. Browser cancellation stops waiting; it does not promise to stop or refund work already running on the server.

Install `integrations/dsa/requirements.txt` and `integrations/prediction/requirements.txt` in the bridge virtual environment. Research adds pinned CPU PyTorch, XGBoost and statsmodels; Linux uses `xgboost-cpu` and libgomp. No runtime clone of the third fork is needed: the adapted modules and retained license ship here. Run `python -m unittest discover -s integrations/prediction -p 'test_*.py'` in that environment. Restart both services after changes. Reproduction commands and measured results are in `RESEARCH-VERIFICATION.md`.
