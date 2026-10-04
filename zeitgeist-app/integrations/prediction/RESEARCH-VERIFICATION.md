# Extended research verification — 2026-10-04

Protocol `fork-research-v1`; parameters fixed before these runs. Each symbol was fetched once through DSA/Yahoo, with the same adjusted 754 completed sessions ending 2026-10-02 supplied to every requested module. Every isolated experiment had a 45-second deadline. No failed experiment was dropped.

## Observed results

54/54 requested module evaluations completed: all 29 modules on AAPL, plus LSTM, bidirectional GRU, XGBoost, evolution strategy and risk diagnostics on MSFT/NVDA/TSLA/GOOGL/AMZN. All 54 raw Python reports also passed the actual TypeScript parser, including independent score/gate/accounting validation. This is a functional and limited retrospective benchmark, not broad market or prospective validation.

Only AAPL bidirectional GRU passed the historical prediction gate (MAE 2.740924 percentage points versus flat 3.001049 and drift 2.891294; threshold 2.746729). This marginal pass across many tested candidates does not establish generalization. It is not automatically selected as the primary model. The other five stocks had no passing prediction among their three tested candidates.

Elapsed time below excludes the shared provider fetch and includes one Python process startup. Local Windows CPU timing is not a cloud latency guarantee.

| Ticker | Module | Seconds | MAE (pp) | Gate |
| --- | --- | ---: | ---: | --- |
| AAPL | `lstm` | 7.64 | 2.8120 | Not passed |
| AAPL | `bidirectional_lstm` | 9.41 | 2.7703 | Not passed |
| AAPL | `two_path_lstm` | 9.00 | 2.7907 | Not passed |
| AAPL | `gru` | 8.66 | 2.8213 | Not passed |
| AAPL | `bidirectional_gru` | 13.43 | 2.7409 | Pass |
| AAPL | `two_path_gru` | 9.95 | 2.9541 | Not passed |
| AAPL | `rnn` | 8.18 | 2.8420 | Not passed |
| AAPL | `bidirectional_rnn` | 8.91 | 2.7662 | Not passed |
| AAPL | `two_path_rnn` | 11.11 | 2.9621 | Not passed |
| AAPL | `lstm_seq2seq` | 9.95 | 2.8513 | Not passed |
| AAPL | `bidirectional_lstm_seq2seq` | 12.44 | 2.7648 | Not passed |
| AAPL | `lstm_vae` | 10.49 | 2.8290 | Not passed |
| AAPL | `gru_seq2seq` | 11.19 | 2.8071 | Not passed |
| AAPL | `bidirectional_gru_seq2seq` | 14.98 | 2.7753 | Not passed |
| AAPL | `gru_vae` | 26.24 | 2.8255 | Not passed |
| AAPL | `transformer` | 19.96 | 2.9205 | Not passed |
| AAPL | `cnn_seq2seq` | 10.96 | 3.1153 | Not passed |
| AAPL | `dilated_cnn_seq2seq` | 14.36 | 3.2689 | Not passed |
| AAPL | `autoencoder` | 8.43 | 2.7547 | Not passed |
| AAPL | `adaboost` | 7.71 | 2.9656 | Not passed |
| AAPL | `bagging` | 7.11 | 3.0332 | Not passed |
| AAPL | `xgboost` | 9.65 | 2.8519 | Not passed |
| AAPL | `arima` | 2.41 | 3.0434 | Not passed |
| AAPL | `temporal_stack` | 13.68 | 2.8175 | Not passed |
| AAPL | `paper_ma` | 1.89 | — | Not a prediction |
| AAPL | `paper_turtle` | 1.87 | — | Not a prediction |
| AAPL | `paper_evolution` | 3.12 | — | Not a prediction |
| AAPL | `paper_qlearning` | 3.65 | — | Not a prediction |
| AAPL | `risk_diagnostics` | 3.96 | — | Not a prediction |
| MSFT | `lstm` | 5.60 | 4.3340 | Not passed |
| MSFT | `bidirectional_gru` | 8.71 | 4.4018 | Not passed |
| MSFT | `xgboost` | 4.82 | 4.4378 | Not passed |
| MSFT | `paper_evolution` | 1.80 | — | Not a prediction |
| MSFT | `risk_diagnostics` | 1.60 | — | Not a prediction |
| NVDA | `lstm` | 5.55 | 3.9883 | Not passed |
| NVDA | `bidirectional_gru` | 8.52 | 4.0017 | Not passed |
| NVDA | `xgboost` | 5.10 | 4.0117 | Not passed |
| NVDA | `paper_evolution` | 1.84 | — | Not a prediction |
| NVDA | `risk_diagnostics` | 1.58 | — | Not a prediction |
| TSLA | `lstm` | 5.58 | 5.1374 | Not passed |
| TSLA | `bidirectional_gru` | 7.74 | 5.0960 | Not passed |
| TSLA | `xgboost` | 4.98 | 5.3287 | Not passed |
| TSLA | `paper_evolution` | 1.65 | — | Not a prediction |
| TSLA | `risk_diagnostics` | 1.65 | — | Not a prediction |
| GOOGL | `lstm` | 5.58 | 3.8796 | Not passed |
| GOOGL | `bidirectional_gru` | 8.26 | 3.8905 | Not passed |
| GOOGL | `xgboost` | 3.47 | 3.8157 | Not passed |
| GOOGL | `paper_evolution` | 1.64 | — | Not a prediction |
| GOOGL | `risk_diagnostics` | 1.62 | — | Not a prediction |
| AMZN | `lstm` | 5.56 | 3.3266 | Not passed |
| AMZN | `bidirectional_gru` | 8.39 | 3.4647 | Not passed |
| AMZN | `xgboost` | 4.97 | 3.2913 | Not passed |
| AMZN | `paper_evolution` | 1.71 | — | Not a prediction |
| AMZN | `risk_diagnostics` | 1.64 | — | Not a prediction |

## Paper-strategy comparison

150 held-out open-to-open intervals, prior-close signals, 10 bps per side including terminal liquidation. These are simulations, not live results.

| Ticker | Strategy | Net return | Buy-and-hold net return | Max drawdown |
| --- | --- | ---: | ---: | ---: |
| AAPL | `paper_evolution` | 14.58% | 22.13% | 12.47% |
| AAPL | `paper_ma` | 15.21% | 22.13% | 11.32% |
| AAPL | `paper_qlearning` | 0.00% | 22.13% | 0.00% |
| AAPL | `paper_turtle` | 13.80% | 22.13% | 10.36% |
| AMZN | `paper_evolution` | 20.55% | 21.36% | 16.55% |
| GOOGL | `paper_evolution` | 12.22% | 12.22% | 20.33% |
| MSFT | `paper_evolution` | -14.25% | 33.15% | 15.81% |
| NVDA | `paper_evolution` | 30.02% | 30.28% | 16.22% |
| TSLA | `paper_evolution` | -6.41% | -10.82% | 23.47% |

## Offline portfolio CLI

Six supplied snapshots also completed the portfolio study. Training ended 2026-07-09; the untouched 60-session test ran 2026-07-10 through 2026-10-02. After the defined turnover costs, minimum-variance allocation returned 12.46% and equal weights returned 7.54%. This does not establish either allocation as suitable for a user.

## Automated and interaction checks

- 92 Node API/schema/cancellation/quota and existing regression tests.
- 10 DSA bridge tests, including authentication, model allowlist, model-keyed caching and shared worker deadline.
- 10 primary prediction tests plus 9 extended research tests.
- Extended tests mutate future data for all 19 neural and all five classical routes, verify train-only scaling/labels, frozen strategy policies/fees, and portfolio weights unaffected by future test prices.
- Lint, TypeScript and production build pass.
- Local browser checks: select/run prediction, keyboard historical-window slider, cancel/retry paper simulation and risk diagnostics.
- Production checks and deployment identity are recorded in the root handoff after release.

## Reproduce

From `zeitgeist-app`, using a Python environment with both requirements files installed:

```powershell
python -m unittest discover -s integrations/prediction -p "test_*.py"
python -m unittest discover -s integrations/dsa -p "test_*.py"
npm test
npm run lint
npm run build
python integrations/prediction/research_benchmark.py --dsa-repo ../daily_stock_analysis --tickers AAPL --models all --output reports/research-aapl
python integrations/prediction/research_benchmark.py --dsa-repo ../daily_stock_analysis --tickers MSFT NVDA TSLA GOOGL AMZN --models lstm bidirectional_gru xgboost paper_evolution risk_diagnostics --output reports/research-other
python integrations/prediction/portfolio_research.py --snapshots reports/research-aapl/AAPL-snapshot.json reports/research-other/MSFT-snapshot.json --output reports/portfolio.json
```

Use the actual DSA checkout path; the paths above are examples. Provider corrections, corporate-action adjustments, date changes, hardware and dependency/platform numerics can change subsequent results. Raw snapshots/reports remain in ignored `reports/`; do not commit account tokens or provider keys with them.
