# DSA market-data integration

Zeitgeist calls a narrow Python service that reuses `YfinanceFetcher` from
[your DSA fork](https://github.com/crestpointmarketing/daily_stock_analysis).
Verified against commit `be148f39ce3be8bc7f9c2d5b0ad77cd31655e78f`.
DSA is an external checkout, under its own MIT license; retain its LICENSE when distributing it.

## Scope

- US alphabetic symbols, completed daily OHLCV, Yahoo auto-adjusted prices.
- Actual NYSE closing timestamps, including holidays and early closes; a 20-minute settlement buffer.
- Shared 5-minute cache (64 entries), one upstream worker, 25-second hard subprocess timeout.
- Server-only bearer authentication. No DSA admin API, scheduler, notifications, portfolio or global watchlist.
- Supabase remains the authority for Zeitgeist accounts, quotas, snapshots and conversations.
- The AI receives the actual source and indicators. Provider identity separates analysis caches.
- Reject missing/zero/invalid prices, duplicate sessions, future timestamps and data over 7 days old.

The history adapter does not supply company profiles or exchange metadata. Next.js enriches those from Polygon when available. A separate bridge endpoint now supplies quarterly financial statements.
Related news is now obtained independently by Next.js using the existing Polygon key (see below).
Yahoo-adjusted prices may differ from Polygon's adjustment policy; a snapshot always uses one provider.
No silent fallback blends their bars. A source outage produces an explicit error.

## Setup

Clone the fork outside this application and check out the verified commit. Create an isolated Python 3.13 environment:

```powershell
python -m venv integrations/dsa/.venv
integrations/dsa/.venv/Scripts/python -m pip install -r integrations/dsa/requirements.txt
```

Copy `.env.example` in this directory to `.env`. Set an absolute `DSA_REPO_PATH` and
a random service token of at least 32 characters. Generate one locally with
`python -c "import secrets; print(secrets.token_urlsafe(36))"`.
Set the same token in the application's ignored `.env.local`:

```dotenv
MARKET_DATA_PROVIDER=dsa
DSA_BASE_URL=http://127.0.0.1:8001
DSA_SERVICE_TOKEN=<same locally generated token>
```

Start the service, then build/start Next.js in another terminal:

```powershell
integrations/dsa/.venv/Scripts/python -m uvicorn bridge:app --app-dir integrations/dsa --host 127.0.0.1 --port 8001
```

The current workstation uses the isolated environment in the sibling DSA checkout:
`../../daily_stock_analysis/.venv-zeitgeist/Scripts/python` instead of the executable above.
Neither service is installed as an operating-system startup service. Restart both after closing their terminals.
For remote hosting use a supervised Python service, HTTPS, secret storage, and a reachable internal URL;
Next.js rejects sending this token over remote plain HTTP. A serverless Next deployment needs an external Python host.

## Verification

```powershell
npm test
npm run lint
npm run build
integrations/dsa/.venv/Scripts/python -m unittest discover -s integrations/dsa -p test_bridge.py
```

The Python tests read the local `.env` for the DSA checkout path and replace the token in memory with a test value.
They cover authentication, invalid symbols, process timeouts, Thanksgiving and early close timing.
The TypeScript tests cover provider failures, transport credentials, invalid data, cache isolation and the
Polygon same-session timestamp regression. Live evidence is in `reports/dsa-live-verification.json`.

## Rollback and next stages

Set `MARKET_DATA_PROVIDER=polygon`, keep the existing Polygon key, and restart Next.js.
No database migration or data deletion is required. Older calculation-version snapshots must be refreshed.

Financial statements and per-user watchlists are now implemented. Background research jobs and scheduled notifications remain outside the current local release.
The Stock-Prediction-Models fork remains research material: no notebook, training job, accuracy claim or price forecast
from that repository has been added to production. Any experiment needs chronological out-of-sample evaluation first.

## Local acceptance — 2026-10-03

- 36 TypeScript tests and 3 Python tests passed. Type checking and production build passed.
- ESLint reported no errors and 7 pre-existing warnings outside this integration.
- AAPL, MSFT, NVDA and TSLA each returned 21 bars through both the internal service and authenticated Next API; all four snapshots persisted successfully.
- The logged-in browser rendered AAPL at $333.69, +$3.37 (+1.02%), the 21-session chart, DSA provenance and a completed AI analysis.
- Evidence: `reports/dsa-live-verification.json`, `reports/dsa-app-verification.json`, `reports/dsa-integrated-dashboard.png` (paths relative to the application root).
- No remote deployment, Git push or prediction-model training was performed.

## Related news and AI citations — second stage

The application fetches `/v2/reference/news` with the existing `POLYGON_API_KEY`, independently of
`MARKET_DATA_PROVIDER`. No new search account is required. The DSA fork's SearchService was inspected;
it requires configured search providers, so it is not enabled or presented as the current news source.

- Price and news requests run in parallel under the existing authenticated stock quota. News has a
  5-second upstream timeout and uses the bounded 5-minute Polygon request cache.
- Missing credentials, errors and malformed envelopes return an explicit optional-news status; they do not fail the price snapshot.
- Up to 5 usable articles from the previous 7 days are retained. Each must include the requested ticker,
  a publication timestamp no later than retrieval, publisher and a public HTTPS link. URLs are deduplicated
  and tracking parameters removed. Titles and provider excerpts are bounded to 250 and 500 characters.
- This is related coverage, not a claim that every result describes a company-specific event. The full
  articles are not downloaded or independently verified. A publication date is not an event date.
- News is saved in the same trusted Supabase snapshot. No migration or new public endpoint is needed.
  Historical snapshots without news remain compatible and are labeled for refresh.
- The News & sources tab displays headlines, publishers, timestamps, original links and AI interpretations.
  News published after the most recent price session is marked explicitly and must not explain that prior price move.
- AI prompt version `daily-evidence-v4-news` treats excerpts as untrusted data. Structured news interpretations
  must cite supplied source IDs. Unknown IDs are rejected. Links come from the snapshot, not model-generated URLs.
  ID validation confirms source membership; it does not prove that an interpretation is factually correct.
- News content and status participate in the analysis cache identity; retrieval time alone does not.
- Financial statements and calibrated sentiment/forecast scores remain unavailable.

Refresh prices to obtain a new news snapshot. If news is unavailable, the user can still use technical analysis.
Changing the price provider to Polygon does not disable news; removing its key leaves DSA prices available with
an explicit `not_configured` news status. The existing daily stock quota also bounds news calls.

### Second-stage acceptance

44 TypeScript tests passed, including eight news-specific regression tests. Production build and type
checking passed; lint retains the same 7 pre-existing warnings. The price Python adapter was unchanged.
AAPL, MSFT, NVDA and TSLA each returned HTTP 200, 21 price bars and 5 recent news items through the authenticated
application API. AAPL AI interpretation completed with supplied source references; clicking [N5] moved to
the matching article. The 390px mobile viewport had no horizontal overflow. Proof files are
`reports/news-live-verification.json`, `reports/news-desktop.png`, and `reports/news-mobile.png`.

These checks cover the integration and its data boundaries, not the factual correctness of publishers or
model interpretations. No upstream DSA source edits, remote deployment, Git push or model training occurred.

## Company profiles and quarterly financials — third stage

Next.js now optionally enriches each snapshot using the existing Polygon company-reference endpoint
(name, business description, exchange, market capitalization) and `/v1/financials/{ticker}` on the private bridge.
The latter uses the already-installed yfinance dependency to retrieve **quarterly income statements** and
`financialCurrency`. It does not use the DSA fundamental bundle because that bundle can substitute TTM
figures when quarterly fields are missing; this screen requires explicit, consistent quarterly periods.

The existing Polygon key returned 403 for its current income-statements endpoint. Its old experimental
financials endpoint returned 410 during testing. The implementation does not depend on either endpoint.
Reference: https://massive.com/docs/rest/stocks/fundamentals/income-statements

- Price, profile, news and financial calls run in parallel under the existing authenticated stock quota.
  Company-profile failure keeps the ticker fallback. Financial failure keeps prices and news.
- The financial subprocess has a 10-second hard deadline; Next.js waits at most 12 seconds.
  Price and financial workers have independent concurrency locks, with at most one of each running.
  A shared, locked 64-entry cache retains financial results for one hour and prices for five minutes.
- Store up to six provider-labeled quarterly periods. Display the latest four, each in its stated currency.
  Fields: revenue, net income, operating income and diluted EPS. No TTM/annual fallback, balance sheet or cash flow.
- Keep missing fields null, zero values zero and losses negative. Net margin uses the same quarter's net income
  and revenue. Revenue YoY requires an earlier period 365 +/- 20 days away, with positive prior revenue.
- A latest period older than 180 days is marked stale and excluded from AI financial interpretation.
- Filing dates are not available. Period-end dates are **not** publication dates; this dataset is unsuitable
  for historical point-in-time backtests without filing-date evidence. Yahoo period labels are preserved.
- Financial fields, currency and status enter the v5 analysis cache identity. Structured AI interpretations
  must reference a supplied, fresh period. The server continues to reject model-supplied invented key metrics.
- Snapshots remain in the existing Supabase JSON payload; no schema migration is required. Old snapshots
  without financials stay compatible and offer a refresh. No additional credentials or paid subscription were added.

Reverting to the earlier app version removes enrichment without deleting data. Stopping the bridge leaves
financials unavailable (and DSA prices unavailable unless MARKET_DATA_PROVIDER is changed to polygon).

### Third-stage acceptance — 2026-10-03

- 49 TypeScript tests and 5 Python tests passed; type checking and production build passed. Seven existing lint warnings remain.
- Authenticated AAPL, MSFT, NVDA and TSLA requests returned company names, XNAS exchange metadata, 21 price bars,
  and five quarterly income periods in USD. All snapshots were persisted.
- The rapid four-symbol run returned news for three stocks; TSLA's optional news status was unavailable while
  its price and financial data succeeded. Existing upstream news limits still apply; no paid quota was bypassed.
- AAPL's browser view showed the quarterly table, calculated ratios, profile and completed AI financial interpretation.
  The 390px mobile test had document width equal to viewport width; only the table scrolls horizontally.
- Evidence: `reports/financials-live-verification.json`, `reports/financials-desktop.png`, `reports/financials-mobile.png`.
- No upstream fork source edits, Git push or online deployment. Local Python and Next services were restarted.

## Three financial statements — fourth stage

The same authenticated financial endpoint now returns three independent collections: `periods` (income),
`balance_sheet`, and `cash_flow`. The Python worker exclusively requests yfinance's `quarterly_income_stmt`,
`quarterly_balance_sheet` and `quarterly_cashflow`; it never falls back to annual or TTM data. Income and
cash flow are period flows, while balance-sheet columns are balances at each date. Provider dates and
financialCurrency are preserved, with up to six periods per statement visible in horizontally scrollable tables.

Balance fields are total assets, total liabilities (net minority interest), stockholders' equity, cash and
cash equivalents, and total debt. Cash-flow fields are operating cash flow, signed capital expenditure,
and provider-reported free cash flow. Negative equity and cash flows are valid; missing values stay null.
Free cash flow is not synthesized when absent, and is not treated as net income.

Each statement has its own ready/stale/unavailable status. A missing or failed statement retrieval does
not erase other returned statements. The existing 10-second whole-worker deadline still applies; a timeout
of the entire collection results in optional financial data being unavailable. The bridge keeps the price service independent.

Prompt/cache version is `daily-evidence-v6-statements`. Stale statement arrays are removed from model input,
even when another statement is fresh. Every structured interpretation must identify its statement type
and a date actually supplied in that fresh statement. No cross-statement date alignment is manufactured.
Income-only older snapshots stay compatible and show the other statements as unavailable until refreshed.
The income statement table now shows all retained periods, including the prior-year comparison base.

Filing dates, audit assurance and historic point-in-time availability remain unavailable. These are
provider-normalized financial fields, not copies of complete SEC filings. No new credentials, paid
subscription, database migration or external notification was introduced.

### Fourth-stage acceptance — 2026-10-03

53 TypeScript tests and 7 Python tests passed. Production build and type checking passed; the same seven
existing lint warnings remain. Authenticated AAPL, MSFT, NVDA and TSLA requests returned all three statements
as ready, with five periods each. TSLA's negative free cash flow remained negative. AAPL's live AI response
included separate income, cash-flow and balance-sheet interpretations referencing their actual dates.
The mobile document did not overflow horizontally; each table had its own scroll container.

Evidence: `reports/three-statements-verification.json`, `reports/three-statements-desktop.png`,
`reports/three-statements-mobile.png`. Local services were restarted. No Git push, upstream DSA source
modification, paid subscription change or online deployment was performed.

## Current combined startup

After installing the Python requirements and configuring the two environment files, `npm run dev:all` or `npm run start:all` from the application root starts both services. Production startup requires `npm run build` first. The launcher searches `integrations/dsa/.venv`, then the configured DSA checkout's `.venv-zeitgeist`; `DSA_PYTHON` overrides this with an explicit executable. It verifies configuration without printing secrets, refuses occupied ports, waits for `/health`, and stops its own children together. A remote HTTPS bridge is left under its own supervisor.

The dated acceptance sections above record incremental stages. For the latest full validation, see `reports/PROJECT-COMPLETION-2026-10-03.html` in the app root.
