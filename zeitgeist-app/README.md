# Zeitgeist

Next.js stock analysis and AI CFO chat, using Polygon, Anthropic and Supabase.

The shared visual system, component conventions and responsive verification checklist are documented in [DESIGN.md](DESIGN.md).

## Setup

1. Install Node.js 22 and run `npm ci` in this directory.
2. Copy `.env.example` to `.env.local` and set provider credentials and the Supabase URL/anon key. Never put provider secrets in `NEXT_PUBLIC_*` variables.
3. For a new Supabase project, run `supabase/schema.sql` once. For both new and existing projects, apply `supabase/migrations/20261002_api_usage.sql`, then `supabase/migrations/20261003_generation_cache.sql`, once each in order. Set `SUPABASE_SERVICE_ROLE_KEY` on the server; never expose it through a public environment variable.
4. Configure Supabase Auth site/redirect URLs for your deployment and `/auth/callback`. Stock endpoints and CFO chat require a signed-in account.
5. If using the DSA bridge, complete [its setup](integrations/dsa/README.md), then run `npm run dev:all`. Otherwise run `npm run dev`. Open http://localhost:3001.
6. For the local production build, run `npm run build`, then `npm run start:all`. This starts the configured local Python bridge and Next.js together. Ctrl+C stops their child processes. Occupied ports are reported without killing an existing service. Set `DSA_PYTHON` to an absolute Python executable if using a different virtual environment.

`npm run build` does not require credentials. Runtime API calls require the relevant keys and database migration. Missing usage controls fail closed with HTTP 503; no paid provider call should proceed.

## Data and model behavior

- Prices are completed trading-session closes, not live quotes. Changes compare against the preceding available session close; dates use New York time. Market status comes from the provider, or is explicitly unknown.
- AI results must pass runtime validation. Empty or malformed output is rejected; missing price projections are `null` and appear as unavailable, never fabricated.
- Related Polygon news includes original links, publication times, provider excerpts and validated AI source references. Missing credentials, rate limits and empty results have separate states. Headlines published after the price close cannot explain that earlier move.
- Optional Yahoo quarterly income, balance-sheet and cash-flow statements are displayed separately, with provider dates and currency. Each section has its own freshness status; stale sections are excluded from AI interpretation. No annual/TTM fallback or inferred filing dates.
- Profile data uses Polygon when available. Prices and optional evidence load independently of AI analysis; AI failures leave market data visible.
- Watchlists hold up to 30 symbols in the signed-in user's Supabase Auth metadata. This is a private preference, never an authorization claim. No additional SQL migration is needed. Concurrent edits from two devices use last-write-wins behavior; a transactional watchlist table is appropriate if collaborative editing is introduced.
- Forgot-password and password-reset screens use Supabase recovery. Allow `/auth/callback?next=/reset-password` (including URL-encoded equivalents) for the deployment origin in Supabase Auth redirects; configure email delivery there. Open a PKCE recovery link in the browser that requested it. Email delivery has not been exercised against the demo address.
- Conversation read/write failures remain visible and retryable; stored conversation handoff IDs are scoped to the account.
- `ANTHROPIC_MODEL` and `ANTHROPIC_CHAT_MODEL` select the models. Verify access to configured model names with your provider account before deployment.

## Cost controls

Quotas are enforced atomically in Postgres across application instances. Stored usage is independent of conversations: deleting a chat does not restore quota.

| Feature | Per user/day | Per user/minute | All users/day |
| --- | ---: | ---: | ---: |
| Stock analysis (both endpoints combined) | 10 | 3 | 200 |
| CFO chat | 50 | 6 | 1,000 |
| Stock data | 60 | 20 | 2,000 |

Days reset at midnight UTC. Each user may have two requests in flight. Reservations expire after 180 seconds if a process dies; normal completions release them. Usage is charged when a reservation succeeds, including provider failures. Clients cannot override limits or request automatic retries. Change quotas through a new SQL migration.

Request bodies are limited to 64 KiB while being read. Analysis prompts have a 20,000-character ceiling and a 2,500-output-token cap. Chat accepts only text, uses at most 20 messages / 20,000 context characters, limits a user message to 4,000 characters and caps output at 1,200 tokens. Provider automatic retries are disabled. These bound usage; they are not an exact dollar-denominated billing limit. Configure a provider spending limit separately where available.

## Verification

Run `npm test`, `npx tsc --noEmit`, `npm run lint` and `npm run build`.
Tests exercise actual source with mocked external-service boundaries; they make no paid AI calls. SQL tests in `tests/usage.sql` require a disposable PostgreSQL database with Supabase-compatible `auth.uid()`, roles and the schema/migration. Do not run the SQL tests against production.

Also run `tests/generation.sql` in the disposable database to verify cache locking, fenced completion, idempotency, permissions and deletion behavior. Run `npm audit` to check the installed dependency lockfile.

## Price-first flow and shared analysis

`GET /api/stock?ticker=AAPL` returns prices, history, evidence and a server-created `snapshot_id`. The UI displays prices immediately, then posts `{ "snapshot_id": "..." }` to `/api/analyze`. Raw client-supplied market data is no longer accepted by that endpoint. HTTP 202 means another request is generating the same result; the client polls without reserving additional AI quota. AI failures preserve the prices and allow retrying only analysis. Switching symbols cancels obsolete client requests.

Snapshots and completed analyses expire after 24 hours. Identical provider inputs, model and prompt version share one analysis across accounts. Cache hits and pending requests do not consume AI quota; fetching prices still consumes stock quota. Generation leases expire after 120 seconds after a crash. Expired market snapshots and analysis jobs are removed opportunistically during subsequent claims. Increment `PROMPT_VERSION` when changing prompts or result semantics.

Chat retries reuse the original user message ID. A database claim coalesces simultaneous submissions; stored replies are replayed without another model call or quota reservation. A retry with different text under the same ID is rejected. Chat cache records are removed with their conversation. Failed generations can be retried and may consume a new reservation.

The evidence panel identifies the provider, trading date, history range, retrieval time and missing sources. SMA5, SMA20 and period return are calculated in code. Model confidence is a self-assessment, not measured prediction accuracy. Live provider and authentication behavior still require staging verification with your deployment credentials.

## DSA market data

An optional authenticated Python adapter now reuses the daily_stock_analysis fork. See [integration setup, verification and rollback](integrations/dsa/README.md). Polygon remains the default when no provider is configured.

## Operations and deployment boundary

The portable release summary is in [DELIVERY.md](DELIVERY.md). Detailed local acceptance artifacts are in `reports/PROJECT-COMPLETION-2026-10-03.html`; that private reports directory is intentionally excluded from Git. The earlier design audit is historical.

The repository-root `vercel.json` deploys the Next.js website and a separate private DSA container together using Vercel Services. Import the repository root (`./`) with the Services preset. Only `web` has a public rewrite; its service binding supplies `DSA_BASE_URL` automatically. Do not manually configure that variable on Vercel. Set `PORT=8001`, `MARKET_DATA_PROVIDER=dsa`, the shared `DSA_SERVICE_TOKEN`, and the existing Supabase/Anthropic/Polygon keys as project environment variables. The container uses `Dockerfile.vercel` at the application root; the session middleware runs on Node.js. Store all provider keys in hosting secrets. The bridge `/health` endpoint checks process readiness only, not Yahoo or AI availability. Scheduled reports and email notifications are not enabled.

A successful build and local live tests do not certify deployment configuration. Before public launch, verify deployed Supabase redirect URLs and email delivery, host-specific request timeouts, database backups, provider usage rights, and quota/cost monitoring. The free news tier can still throttle bursts. Yahoo financials are normalized provider data, not audited filing extraction. No original notebook accuracy claim is shipped; the separate experimental model lab displays its own retrospective test results and limitations.

`npm audit` currently reports five high-severity findings in the development-only Next ESLint → fast-glob → micromatch → braces chain. The registry's latest braces release is still affected; no compatible patched version was available during acceptance. Do not downgrade Next to the audit tool's suggested older major. Production-only audit is recorded separately. Recheck when upstream publishes a patch.

## Experimental model lab (second fork)

The research page's **Model lab** tab runs an opt-in five-session experiment adapted from your Stock-Prediction-Models fork: Random Forest + Extra Trees and separate Monte Carlo scenarios. See [source attribution and exact protocol](integrations/prediction/PROVENANCE.md). Update the bridge environment with `python -m pip install -r integrations/dsa/requirements.txt` and restart the combined services.

It fetches a longer independent DSA history, verifies USD US-listed securities, runs 30 chronological test windows, compares two simple baselines, and withholds the tree price forecast if the baseline gate fails. The Monte Carlo band is an illustrative distribution, not calibrated confidence. Existing prices and AI research do not wait for this experiment. It consumes one existing market-data quota reservation and no AI quota.

Run `python -m unittest discover -s integrations/prediction -p test_forecast.py` using the integration virtual environment, in addition to the existing test commands. There is no database migration, trading execution, scheduler or automatic model promotion. The old notebook accuracy figures and TensorFlow models are not reproduced as validated results.

## AI output and quota diagnostics

Analysis now requests schema-constrained JSON using Anthropic `output_config.format`, while retaining local size, numeric and source-reference checks. See [Anthropic structured-output documentation](https://platform.claude.com/docs/en/build-with-claude/structured-outputs). Stronger constraints unsupported by the provider grammar remain enforced locally. No automatic paid retry is added and the 2,500 output-token ceiling remains. An override model without JSON-schema support can set `ANTHROPIC_STRUCTURED_OUTPUTS=false`; local validation remains mandatory.

The fixed schema is additional request overhead beyond the 20,000-character evidence prompt cap. Truncated outputs are rejected explicitly. A failed schema check logs field paths and issue codes, not the response content. AI errors are displayed prominently without hiding market data. When the existing database quota denies a request and this user's daily count is at least 10, the UI reports the next UTC reset and does not offer an immediate ineffective retry. This explanatory threshold matches the existing quota migration; change both together if revising that migration. No usage counters are reset by the application.

Administrators can exempt an individual account from application usage limits by setting the boolean `app_metadata.quota_exempt` to `true` through the Supabase Admin API. All analysis, chat, stock and model-lab reservations then skip application daily, minute, global and account concurrency budgets without incrementing shared counters. Each reservation verifies current metadata with `auth.getUser()`; user-editable metadata and cached session claims cannot grant this privilege. Set the flag to `false` to revoke it immediately. Authentication, input validation, request deadlines, generation deduplication, worker capacity and external-provider limits still apply. Existing ordinary-account database quotas are unchanged; no migration is needed. On 2026-10-03, the owner requested and enabled this exemption for the existing demo account.
