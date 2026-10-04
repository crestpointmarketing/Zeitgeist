# Research workspace release

Added 2026-10-04. This extends the fixed forward-validation release. Existing
model parameters and the historical publication gate are unchanged.

## User workflow

- `/research`: durable model experiments, daily briefs, portfolio studies and
  comparison evidence for AI CFO. The page can close while work continues.
- `/watchlist`: independent rows with atomic add/remove and optional daily research
  for five stocks. The migration imports at most 30 legacy metadata entries once.
  New code never reimports deleted entries. Old app versions still write metadata;
  reconcile any such changes explicitly before restoring the new version.
- Tasks show queued/running/ready/failed/cancelled, accumulated processing time,
  saved results, JSON exports and unread state. The sidebar shows unread results.
  Running work is bounded, not instantly cancellable. Queued tasks can be cancelled.
- Daily briefs retain the actual completed session, evidence, source URLs and
  missing inputs. Change calculations use the new snapshot's adjustment basis and
  only an exact prior-session bar; unavailable comparisons remain null.
- Comparison tasks collect 2–5 server-validated stock snapshots. AI CFO retrieves
  only a completed daily/comparison job owned by the caller, cites dated evidence,
  and persists its context reference on the conversation. Browser text cannot
  replace the stored prices. Context is a saved snapshot, not a live feed.

## Queue and scheduling

This application uses its own durable Postgres task table and fenced lease RPCs,
not an in-memory queue or a pgmq installation. Keeping the lease, job state and
account controls in one transaction allows the existing quota system to be reused.

- One globally active worker, 90-second lease, 60-second HTTP deadline. Bridge
  processes retain independent 20/25/45-second hard deadlines.
- One step per invocation: model fit; snapshot collection; AI brief; a single
  portfolio/comparison ticker; final portfolio calculation. Checkpoints survive
  interrupted workers. Only the current, unexpired lease can commit a step.
- Three attempts per step; transient failures are delayed one minute. Failed and
  cancelled jobs can explicitly retry from their saved stage. Every external
  attempt uses the existing account/global budget; retries are not free AI calls.
- Queue limits: 12 active jobs per account, 200 active globally, 100 new jobs per
  account per UTC rolling day. Identical manual inputs deduplicate per UTC date.
  Demo exemption covers the established API quotas, not queue capacity controls.
- Next.js `after()` starts one worker after submission. Supabase Cron provides
  durable continuation even without an open browser. `zeitgeist-research-worker`
  runs every minute; `zeitgeist-daily-research` checks eligibility every 15 minutes.
  Existing `zeitgeist-forward-validation` remains unchanged and hourly.
- New cron calls `/api/cron/research`, using the same Vault secret/CRON_SECRET
  pair. No keys in scheduler SQL, browser output or repository. Daily scheduling
  uses XNYS actual closes, including holidays/early closes, and a 20-minute delay.
  New automatic tasks are considered for 18 hours after a close, never a weekend
  multi-day backfill. Current scheduler scan is capped at 1,000 enabled settings;
  larger scale requires a paginated scheduler and measured capacity expansion.
- Daily opt-out cancels queued automatic work; a running step may finish. At most
  five enabled stocks per user. No outbound notification emails or broker orders.

## Forecast comparison and intervals

Forward performance can compare selected models only on the intersection of
stock, origin, target, input fingerprint and matching observed returns. Each
model's publication count remains visible. This is not an automatic ranking.

New published prospective records can receive a frozen 80% nominal error band.
The calibration uses only same-model/version outcomes known before recording,
whose targets precede the current origin. Select non-overlapping chronological
windows, at most 100 and at least 30; compute the finite-sample 80% absolute-error
quantile. Lower return is bounded at -100%. Withheld predictions have no interval.
Unavailable calibration stays explicit. Old forecasts are not backfilled and
intervals cannot be updated, even by service_role. Observed coverage is measured
only after targets settle. Pooling past errors across stocks and changing market
conditions prevents a guaranteed coverage claim. Small/overlapping evaluation
samples remain disclosed. There are currently no mature calibrated bands.

## Portfolio study

The existing fork-adapted engine now accepts 2–6 independently fetched US USD
histories and long-only custom weights totalling 100%. It aligns at least 313
sessions: 252 training returns and 60 untouched test returns. Compare custom,
equal and training-period minimum-variance weights (60% fitted position cap).
Daily rebalancing includes 10 bps per side, entry and liquidation. The UI shows
curves, return, drawdown, weights, training correlations and every daily value.
This uses adjusted history, not executable fills, taxes or variable market impact.

## Schema / release ordering

1. Apply `20261004_research_workspace.sql` and `20261004_prediction_intervals.sql`
   once, after the previous forward migrations. Production applied on 2026-10-04.
2. Deploy and verify the new app and private Python bridge.
3. Apply `20261004_research_scheduler.sql` once. Never configure duplicate Vercel
   jobs. Observe both the HTTP response and worker heartbeat, not SQL dispatch alone.

Authenticated accounts can read only their own tasks and watchlist. They cannot
read job checkpoints, inject results or invoke worker/budget impersonation RPCs.
RLS covers all new tables. Watchlist mutations and task actions use narrow RPCs.
The internal tables/leases remain server-only. Existing forecast immutability is
preserved. No auth credentials are stored with a task.

## Operations, recovery and limits

`/research/status` shows the dispatcher timestamp, last worker response, own task
success/failure counts/rate and processing P95 over the latest 700 tasks in seven
days. Processing excludes queue waiting. Normal job lists show the latest 100;
results are fetched on selection. Notifications poll each minute; task lists every
15 seconds only while visible. Existing API provider logs remain in Vercel.

For a local application-data backup on Windows with PowerShell 7:

```powershell
node scripts/backup-app-data.mjs
# Run scripts/recovery-schema.sql read-only in Supabase; save the JSON result at:
# reports/backups/schema-workspace.json
node scripts/restore-app-data-drill.mjs
```

The backup uses AES-256-GCM; its random key is protected with Windows DPAPI for
the current OS user. `ZEITGEIST_PWSH` can specify an alternate pwsh executable.
Only the local user/machine can ordinarily recover that protected key; this is
not an off-machine disaster-recovery solution. The restore script uses isolated
PostgreSQL (PGlite), verifies row values (normalizing timestamp representation),
primary/unique/check constraints and application foreign keys. It never connects
to production. Artifacts are in ignored `reports/`; retain the encrypted backup,
protected key and schema together. No plaintext data export belongs in Git.

Auth users, passwords, Vault, RLS policies, hosting and transaction-consistent
PITR restoration are explicitly outside this data-only drill. Full disaster
recovery still requires Supabase-managed backups/PITR and a separate recovery
environment. Do not mistake successful application-row restoration for that.

Before code rollback, disable both new Supabase cron jobs; database scheduling
survives Vercel rollbacks. Keep additive tables and saved records. Preserve the
hourly forward-validation job if rolling back to that release. Do not move tags.

## Verification

112 Node tests; 13 bridge tests; 22 prediction/portfolio tests (147 total).
Type checking, lint and production build pass. Rollback SQL probes cover account
isolation, limits, first-write dedupe, exclusive worker leases and permissions.
Local demo: 32 API checks for four real workflows, plus 7 cancellation/crash/retry
checks. Ten concurrent equal submissions return one ID. Sixty reads/auth checks,
concurrency 10: no unexpected responses; local P95 298ms. This is bounded pressure
testing, not certification of heavy model throughput. Seven application tables
restored from encrypted backup with exact typed row checks and foreign keys.
390/320px mobile views have no horizontal page overflow. Email recovery delivery
was user-confirmed; the separately authorized signup alias reached confirmed
state in Supabase. Production evidence and final source revision go in handoff.md.
