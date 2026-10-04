# Zeitgeist
Financial clarity with AI.

**Start here: [handoff.md](handoff.md)** — current release, architecture, configuration,
verification, deployment, rollback and known limitations. Read this before continuing work.

Production: https://zeitgeiststocks.com

Research workspace: durable experiments, daily watchlist briefs, portfolio studies,
evidence-linked AI CFO conversations and forward model evaluation. See the
[release protocol](zeitgeist-app/integrations/prediction/RESEARCH-WORKSPACE.md)
for scheduling, statistical limits, recovery and verification.

Application commands run from `zeitgeist-app/`. The repository-root `vercel.json`
deploys both the Next.js web service and the private Python data/model service.
