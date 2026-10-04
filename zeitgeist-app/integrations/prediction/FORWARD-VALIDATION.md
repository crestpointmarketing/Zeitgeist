# Forward validation protocol

Added 2026-10-04. This measures newly recorded five-session predictions after their
outcomes occur. It does not turn historical backtests into forward performance.

## Recording

Authenticated `/api/forecast` and `/api/model-research` record their own validated
server results. There is no API to submit a prediction from the browser. The
original v3 tree ensemble and Gradient Boosting have separate entries; each of
the 24 research prediction modules has its own model ID. Strategy and risk
modules are not price forecasts and are not recorded here.

The first `(account, ticker, model ID, protocol version, origin session)` wins.
`INSERT ... ON CONFLICT DO NOTHING` preserves it across retries, cache hits,
re-runs and later data revisions. The server role has no UPDATE privilege on
these records. Model parameters or feature changes require a protocol version
bump. A code revision, exact input bars, SHA-256 input digest, complete validated
report, provider data hash, baseline, and exchange calendar dates are frozen.
Deleting the owning account cascades its records; this is not a public audit log.

The database supplies `recorded_at`. To count as prospective, an entry must be
recorded before the next XNYS session opens and generated within the preceding
two hours. Late records are visible but excluded. Failed publication gates store
`qualified=false` and a null prediction, never an implied zero-return forecast.
Their outcomes may be observed, but they are excluded from model error metrics.

If persistence fails, the experiment still returns its validated research result
with an explicit recording warning. Missing evidence during a rolling deployment
also produces a warning. Retrying can save a record; it never overwrites one.

## Outcome checks

Supabase Cron schedules `dispatch_forecast_check()` at minute 15 of every UTC
hour, job name `zeitgeist-forward-validation`. It uses `pg_net` to call the fixed
production URL `/api/cron/forecast-settlement`. `CRON_SECRET` is a server-only
random value of at least 32 characters, configured for Vercel Production and
stored as `zeitgeist_forecast_cron_secret` in Supabase Vault. The dispatcher reads
it at runtime and sends a Bearer token; its SQL contains no plaintext secret.
Only the server role may call the dispatcher. Matching User-Agent headers do not
authenticate the HTTP endpoint. Preview deployments have no scheduled checks.
See [Supabase scheduling](https://supabase.com/docs/guides/functions/schedule-functions)
and [Cron quickstart](https://supabase.com/docs/guides/cron/quickstart).

The initial Vercel Services deployment accepted a top-level `crons` key without
registering a job in the dashboard. The key has been removed. Supabase is the sole
scheduler; do not configure a second scheduler in Vercel.

A database lease prevents overlapping workers. It expires after 90 seconds;
only the lease owner can release it. Each 60-second invocation reads the oldest
100 due records and handles at most two distinct ticker/origin/target groups.
Bridge workers have a 20-second limit; failed groups retry after an hour.
Conditional pending-only updates preserve completed outcomes on retries.
Failure summaries are recorded as failed, not successful completion.

The target is exactly five future XNYS trading sessions, including holidays and
early closes. Checks become due 20 minutes after that session closes. The private
bridge fetches the origin and all five future sessions from DSA / Yahoo Finance
in one adjusted history query. All six exact sessions must exist. Missing target
data remains pending; nearby dates and incomplete sessions are never substituted.

Actual return = `(current adjusted target close / current adjusted origin close - 1) * 100`.
This uses one adjustment basis across splits/dividends. The original forecast is
not changed, and the current/original origin adjustment ratio and observed bars
are saved. No model is retrained during checking. Provider revisions can still
affect adjusted returns; settled results are not silently recomputed.

## Scorecard and account isolation

Model lab → Forward performance shows the signed-in account's records, filtered
by current ticker or all their stocks. The view/export covers the last 90 days,
limited to the latest 500 entries with an explicit truncation notice. Recent
details show 20 entries; JSON export includes every entry in the current view.
RLS also protects direct database reads. Full model inputs are stored for server
audit, not embedded in ordinary API responses or the UI export.

MAE, RMSE, flat-baseline MAE, drift-baseline MAE and directional hit rate use the
same set of prospective, qualified, settled records for each model/version.
Errors are in percentage points of five-session returns. The fixed drift is the
mean log return of the 60 trailing sessions compounded over five sessions. Flat
actual outcomes are excluded from direction scoring. No ranked winner or automatic
model promotion is produced. Overlapping windows and small samples are not proof
of accuracy; per-model counts may cover different stocks and are not a fair ranking.

## Operations and recovery

- Apply `supabase/migrations/20261004_forward_validation.sql` once. It is additive;
  the existing app can run while the new tables are present. Applied to the
  production project on 2026-10-04.
- Store the matching secret through Supabase Vault's UI, then apply
  `20261004_forward_scheduler.sql`. It enables pg_cron/pg_net, adds dispatch
  metadata, and creates the fixed-target dispatcher and named job. Rotations
  must update both Vault and the Vercel environment followed by redeployment.
- `tests/forward.sql` checks immutable insert semantics, timing, role grants,
  cross-account RLS and lease ownership inside a rollback-only transaction. Run
  it only while no reconciliation worker holds the lease.
- Inspect `forecast_reconciliation.last_completed_at` and `summary` using the
  server role. The timestamp means the last worker finished, even if summary says
  `failed`; it does not mean any prediction matured. Expired leases recover on the
  next invocation. `forecast_checks` retains attempts, next retry, reason and outcome.
- The dispatch timestamp/request ID are separate from worker completion. Cron
  history reporting SQL success only means the HTTP request was queued. Inspect
  `net._http_response` for that ID (status_code, timed_out, error_msg, content) and
  the reconciliation heartbeat to confirm HTTP execution. Do not select request
  headers or decrypted Vault values in logs. pg_net response history is temporary.
- Existing records are never backfilled from old experiments. The first records
  based on 2026-10-02 close target 2026-10-09. Real performance is unknown until
  those outcomes are available.
- No email alerts or broker execution. This is an account-level research record.
  At larger scale, replace the small hourly batch with a durable queue before
  promising timely checks for a large backlog.
- Rollback: deactivate `zeitgeist-forward-validation` in Supabase Cron before
  deploying the previous application tag. Database jobs persist across Vercel
  rollbacks. Preserve the additive tables and records. Do not drop data or move
  existing release tags. Reactivate the same job when the endpoint is restored.

## Verification

Before release: Node route/security/statistics tests; Python calendar and private
bridge tests; existing model regression suites; production build; rollback-only
live SQL probes; demo-account API and responsive UI checks. Live verification and
the final deployed source revision are recorded at the top of `handoff.md`.
