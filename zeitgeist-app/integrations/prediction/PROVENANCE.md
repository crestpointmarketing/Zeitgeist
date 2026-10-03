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

## Runtime

The bridge has a separate one-worker forecast lock, a 45-second subprocess deadline and a one-hour in-memory cache. The existing market budget governs authenticated `/api/forecast` calls, including cached requests. No paid AI call is made. CPU workers cannot receive browser-specified tree counts, horizons or filesystem paths. No SQL migration or model binary deserialization is needed. Model reports are not passed to the LLM as established facts.

Install updated `integrations/dsa/requirements.txt` in the bridge virtual environment. No runtime clone of the second fork is needed: the adapted modules and retained license ship here. Run `python -m unittest discover -s integrations/prediction -p test_forecast.py` in that environment. Restart both services after changes.
