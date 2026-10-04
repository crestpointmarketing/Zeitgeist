# Comparison protocol v2 verification — 2026-10-04

Baseline restore tag: `v2026.10.04-stable` (`3ce6166`).
Development branch: `codex/prediction-validation-v2`.
Protocol: `fork-comparison-v2`. Primary ensemble and publication gate are unchanged.

## Live fixed-symbol smoke benchmark

DSA/Yahoo adjusted daily history through 2026-10-02, 754 observations per symbol;
30 historical five-session windows, fixed settings. Runs took 13.78–17.23 seconds
on the current workstation, within the 45-second worker limit. This is a timing
observation, not a cloud performance guarantee.

All values below are five-session return MAE in percentage points (lower is better).

| Symbol | Ensemble | Extra Trees | Random Forest | Ridge | Flat | Drift | Primary qualified |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| AAPL | 3.056 | 2.998 | 3.115 | 3.095 | 3.001 | 2.891 | No |
| MSFT | 4.430 | 4.388 | 4.509 | 4.597 | 4.257 | 4.550 | No |
| NVDA | 4.147 | 4.106 | 4.190 | 4.234 | 4.071 | 4.110 | No |
| TSLA | 5.242 | 5.188 | 5.327 | 5.023 | 4.854 | 5.204 | No |

No symbol met the primary gate. No consistent improvement from the new comparator
is established. No settings were changed to improve these displayed results; no
retrospective winner is substituted as the primary model. A future change informed
by these results requires new held-out evidence before claiming improvement.

Data fingerprints: AAPL `9d17627183ebb3c2`, MSFT `c24b9bf082a29b98`,
NVDA `91155d1c11c47ff0`, TSLA `2eb37bf34333911f`. Complete local observations and
timings are in ignored `reports/prediction-v2-benchmark/`. All four Python JSON
reports passed the actual TypeScript parser, including candidate-metric
recalculation and ensemble-identity checks. Re-run the documented benchmark rather
than assuming the same adjusted history or fingerprint persists indefinitely.

Browser verification with demo: a real local AAPL experiment returned v2, changing
the selector updated the historical comparison chart, CSV contained its header plus
30 observations, and the JSON report was actually downloaded and parsed (30 windows,
all three comparators). No document overflow at 320px or 390px; tables scroll within
their own regions. Captured browser error logs were empty. Local screenshot:
`reports/prediction-v2-mobile.png`.

## Regression coverage

82 Node tests, 9 DSA tests and 8 prediction tests pass (99 total), with lint and a
production build. New checks cover future-mutation invariance for every comparator,
train-only scaling boundaries through that invariance test, matching candidate
metrics, no comparator promotion, missing observations, ensemble identity, zero
baseline headroom, time-block diagnostics and export contents. v1 reports remain
accepted for rolling deployment compatibility.

This is an experimental research feature, not a validated profitable strategy.
Email delivery, large-scale load, independent prospective forecasting and trading
costs remain outside this verification.
