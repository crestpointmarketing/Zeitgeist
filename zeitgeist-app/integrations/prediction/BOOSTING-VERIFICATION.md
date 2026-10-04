# Gradient Boosting validation — 2026-10-04

Protocol: `fork-comparison-v3`. Source and fixed parameters: [PROVENANCE.md](PROVENANCE.md).
Third fork: `crestpointmarketing/Stock-Prediction-Models`, commit `33266732b0b16188b565e0aeb6b24efa71161f6a`.

Each symbol used 754 adjusted daily bars through 2026-10-02 and the same 30 chronological five-session windows for every candidate. MAE is measured in percentage points of five-session return. Parameters were fixed before this run. The independent publication gate requires more than 5% lower MAE than both flat and drift baselines.

| Symbol | Original ensemble MAE | Gradient Boosting MAE | Flat MAE | Drift MAE | GB gate | Runtime seconds |
| --- | ---: | ---: | ---: | ---: | --- | ---: |
| AAPL | 3.054927 | 2.904034 | 3.001049 | 2.891294 | Fail | 24.43 |
| MSFT | 4.429447 | 4.462936 | 4.257030 | 4.550341 | Fail | 27.40 |
| NVDA | 4.146734 | 4.080129 | 4.070731 | 4.110279 | Fail | 28.76 |
| TSLA | 5.241625 | 5.462932 | 4.853593 | 5.203701 | Fail | 21.13 |
| GOOGL | 3.707972 | 3.824927 | 3.777575 | 3.972187 | Fail | 22.98 |
| AMZN | 3.429202 | 3.360941 | 3.258313 | 3.639639 | Fail | 13.58 |

GB improves on the original ensemble for three symbols and worsens for three. Neither the primary ensemble nor GB qualified for any of these six symbols. No current price target was published. This does not establish general predictive accuracy, trading profitability, or a calibrated interval. Multiple model comparisons and reused evaluation periods can create selection bias; further tuning needs fresh holdout data. Current adjusted Yahoo histories are not a point-in-time dataset and may be revised between fetches.

Data fingerprints in symbol order above: `6ebb494361df2ecd`, `2a81dedc73489394`, `e5a906ed00e9346b`, `2eb37bf34333911f`, `52be2f05032f4423`, `7609e76822fc4c99`.

Validation: 85 Node, 10 prediction Python, and 9 DSA tests passed, as did lint and the production build. Tests cover future-data perturbation, finite zero-volume/range features, per-window metric recomputation, model identity and independent target gate/price arithmetic. All six real Python reports passed the actual TypeScript parser. Browser checks covered cancellation and retry, GB selection, keyboard historical-window selection and 320px layout.

Reproduce from `zeitgeist-app` with the configured Python environment:

```text
python integrations/prediction/benchmark.py --dsa-repo <daily_stock_analysis checkout> --tickers AAPL MSFT NVDA TSLA GOOGL AMZN --output reports/prediction-v3-benchmark
```

Raw local reports are ignored by Git; the portable findings are retained here. Historical v2 results remain in `COMPARISON-VERIFICATION.md`.
