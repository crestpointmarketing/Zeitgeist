# Local verification — 2026-10-03

Implemented on `codex/prediction-lab`, following the first integration at `241eb23`.

## Scope

The Model lab adapts the second fork's RandomForest/ExtraTrees ensemble members and Monte Carlo simulation. It uses the first fork's market-data bridge. The original TensorFlow encoder, XGBoost stack, notebooks and trading agents are not deployed. See [PROVENANCE.md](PROVENANCE.md) for source commit, license and evaluation details.

## Checks

- 65 TypeScript tests and 14 Python tests passed; lint, type checking and production build passed.
- Live workers returned 755 sessions through 2026-10-02 for AAPL, MSFT, NVDA and TSLA.
- Authenticated browser execution returned the TSLA report with 30 test windows and five Monte Carlo scenario dates.

Five-session return MAE, in percentage points:

| Symbol | Tree ensemble | Flat baseline | Drift baseline | Forecast gate |
| --- | ---: | ---: | ---: | --- |
| AAPL | 3.055 | 3.001 | 2.891 | Failed |
| MSFT | 4.430 | 4.257 | 4.550 | Failed |
| NVDA | 4.147 | 4.071 | 4.110 | Failed |
| TSLA | 5.242 | 4.854 | 5.204 | Failed |

None qualified for publication of a tree-model price target. Reports expose the comparisons and illustrative simulation instead of presenting failed models as reliable forecasts. Results describe this local data snapshot only.

## AI status correction

The screenshot's prices were loaded; the missing fields belonged to AI analysis. A provider result failed local validation, and the demo account subsequently reached the existing ten-analysis daily cap. Error details now appear at the top of the insight panel, with an explicit reset time for daily exhaustion. Quota counts were not reset.

Analysis requests now request JSON Schema output and retain strict local validation. Request construction, validation, truncation and quota handling are covered by tests. A successful real-provider response under the new schema remains unverified because the account's daily allowance was exhausted. Existing price and model-lab functions remain usable under their separate market-data quota.
