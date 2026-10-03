# Production deployment — 2026-10-03

Website: https://zeitgeist-eight-blush.vercel.app

Vercel project: `crestpointmarketings-projects/zeitgeist`. Production branch: `main`.

## Architecture

Import the repository root (`./`), using the Services preset and the root `vercel.json`. The `web` Next.js service owns all public routes. The `dsa` service runs `Dockerfile.vercel` and is internal; the `web` binding injects `DSA_BASE_URL`. This uses Vercel's Services and Container Images beta features. Do not set a localhost DSA URL in production. Session middleware uses Node.js because Services does not accept Edge middleware.

Project environment variables: the two public Supabase values, server-only Supabase service role, Anthropic key and model names, Polygon key, shared DSA token, `MARKET_DATA_PROVIDER=dsa`, `ANTHROPIC_STRUCTURED_OUTPUTS=true`, and `PORT=8001`. Values are managed in Vercel and never committed. The Python image pins the first fork commit and includes the second fork's adapted modules and licenses. Its cache and concurrency locks are per container instance; account budgets remain in Supabase.

Supabase Site URL is the production origin above. The redirect allowlist includes its `/auth/callback**` path and retains the existing localhost callback for development. Demo retains the owner-authorized account quota exemption.

## Verified on deployment 5596e44

- Vercel production deployment `dpl_BTdMZwHPsB8YyudMmYRRHwXDdrJc` reached Ready; Next.js and container builds succeeded.
- Public homepage returned 200; unauthenticated stock request returned 401.
- Demo signed in through the production browser and opened its saved conversations.
- AAPL, MSFT, NVDA and TSLA stock endpoints returned 200 and 21 daily bars. AAPL/MSFT/NVDA financial evidence was ready.
- TSLA analysis endpoint returned 200 with a ready result.
- TSLA model lab returned 200 with 755 sessions; baseline qualification was false, correctly withholding the tree target.
- AI CFO streamed a reply without a stream error; the saved user message and assistant reply were reopened in the production browser.
- 66 TypeScript tests passed during deployment preparation; the 14 Python tests passed during the preceding integration acceptance.

Email delivery, recovery emails and third-party OAuth providers were not exercised by these checks. Container readiness alone does not establish provider availability; the authenticated endpoint tests above verified the deployed data path. Provider throttling and data availability can still change.
