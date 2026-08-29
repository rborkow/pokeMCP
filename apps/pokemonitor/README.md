# pokemonitor

Automated **daily reporting** for the [pokeMCP](https://www.pokemcp.com) app. A standalone Cloudflare
Worker that, once a day, gathers metrics, has Claude write the narrative, and delivers the report by
email + an authenticated dashboard.

## What it reports

- **Provider AI usage (AI Gateway)** — the authoritative Anthropic spend figure: requests, tokens
  in/out, cost, success/failure, cached, and duration, broken down by provider / model / `source`
  metadata (web, interview, report, prep, pokemonitor), with a 7-day trend. Read from the AI
  Gateway logs API (`GET /accounts/{account}/ai-gateway/gateways/{gateway}/logs`). When this
  source is unavailable the report says usage is UNKNOWN — it never substitutes a zero.
- **Instrumented product AI usage** — the `ai_chat` telemetry pokeMCP emits into the
  `pokemcp-analytics` Analytics Engine dataset: requests, tokens, estimated cost, cache-hit rate,
  and breakdowns by source / format / personality. Clearly labeled as a secondary metric: it only
  covers routes that emit telemetry. The report flags stale telemetry instead of implying $0.
- **Query types & interactions** — tool-call distribution, success rate, and latency, plus a sampled
  digest from the `pokemcp-interaction-logs` R2 bucket (top Pokémon, formats, example interactions).
- **Compute & storage** — per-Worker requests/errors/CPU and R2 object/byte counts via the Cloudflare
  GraphQL Analytics API.
- **Visitors** — unique visits, page views, top pages/countries/referrers via Cloudflare Web Analytics
  (RUM).

A single Claude (Opus 4.8) call turns the assembled metrics into an executive summary, notable changes,
query-interaction insights, cost commentary, and anomalies. (Managed Agents would be overkill for a
fixed daily report — this is a deterministic pipeline with one summarization call.)

## Architecture

```
cron (08:00 UTC daily)
  └─ gather (parallel, fault-tolerant)
       ├─ AI Gateway logs REST  (provider-side usage + spend — primary)
       ├─ Analytics Engine SQL  (instrumented ai_chat telemetry + tool counts)
       ├─ Cloudflare GraphQL    (Workers compute, R2 storage, RUM visitors)
       └─ R2 interaction logs   (sampled "what are people asking" digest)
  └─ one Claude call (structured output)
  └─ render HTML → store in R2 → email (Resend) + serve dashboard
```

`src/sources/*` fetch data, `src/report/*` aggregate → summarize → render, `src/deliver/*` store + email,
`src/index.ts` wires the cron and the dashboard `fetch` handler.

## Setup

1. **Install & create the reports bucket**
   ```sh
   bun install
   npx wrangler r2 bucket create pokemonitor-reports
   ```

2. **Fill in `wrangler.jsonc` vars**
   - `CLOUDFLARE_ACCOUNT_ID` — the account that owns the pokeMCP resources.
   - `CF_ANALYTICS_SITE_TAG` — after enabling Web Analytics (step 4).
   - `WORKER_SCRIPTS` — already set to the two production Workers.

3. **Set secrets** (`npx wrangler secret put <NAME>`; for local dev copy `.dev.vars.example` → `.dev.vars`)
   - `CLOUDFLARE_API_TOKEN` — **Account Analytics: Read** (Analytics Engine SQL + GraphQL) **+
     AI Gateway: Read** (provider-side usage). Without the AI Gateway permission the gateway
     source degrades to an explicit "usage UNKNOWN" warning, never a zero.
   - `ANTHROPIC_API_KEY` — the Claude call.
   - `RESEND_API_KEY` — email; the sender domain in `REPORT_EMAIL_FROM` must be verified in Resend.
   - `CF_ACCESS_TEAM_DOMAIN` — protects the dashboard behind Cloudflare Access (e.g. `team.cloudflareaccess.com`).
   - `REPORT_RUN_TOKEN` *(optional)* — lets you trigger `/run?token=…` in production without an Access session.

### AI Gateway routing for pokemonitor's own Claude call (operator step)

`AI_GATEWAY_ID=pokemcp` is already set in `wrangler.jsonc` and used for the logs API. To also
route pokemonitor's daily summarization call through that gateway (so it shows up in the gateway
breakdowns with `source=pokemonitor`), set two additional secrets:

```sh
npx wrangler secret put CLOUDFLARE_AI_GATEWAY_URL   # https://gateway.ai.cloudflare.com/v1/<account_id>/pokemcp/anthropic
npx wrangler secret put CF_AIG_TOKEN                # gateway auth token, if the gateway requires one
```

Both are optional; until they are set the summarization call goes directly to Anthropic and is
simply absent from the gateway breakdowns. No secret values are ever logged or committed.

4. **Enable Web Analytics on the teambuilder app** (one line in pokeMCP)
   - Create a Web Analytics site in the Cloudflare dashboard for `www.pokemcp.com`; copy the **site token**
     and **site tag**.
   - Set `NEXT_PUBLIC_CF_ANALYTICS_TOKEN` in `apps/teambuilder/wrangler.toml` (the RUM beacon is already
     wired in `apps/teambuilder/src/app/layout.tsx`) and redeploy teambuilder.
   - Put the **site tag** in `CF_ANALYTICS_SITE_TAG` here.

## Local testing

```sh
bun run dev
# Dashboard auth is bypassed in dev (no CF_ACCESS_TEAM_DOMAIN).
open "http://localhost:8787/run?date=2026-06-06"            # generate + serve a report for a day
open "http://localhost:8787/run?date=2026-06-06&format=json"# see delivery result + source warnings
open "http://localhost:8787/run?date=2026-06-06&email=1"    # also send the email via Resend
open "http://localhost:8787/"                               # dashboard index (lists stored reports)
```

Validate sources independently first: the `format=json` run surfaces any per-source `warnings` (e.g. a
GraphQL field that needs adjusting for your account — see below). `/health` is an unauthenticated
liveness check.

## Deploy

```sh
npx wrangler deploy
```

The cron (`0 8 * * *`) then generates yesterday's report each morning. Protect the deployed Worker's
hostname with a Cloudflare Access application matching `CF_ACCESS_TEAM_DOMAIN`.

## Notes

- **GraphQL field names**: Cloudflare's analytics GraphQL schema can vary by account/plan. Each query in
  `src/sources/cloudflareGraphql.ts` is isolated — a failure degrades that section to “No data” and adds a
  `warnings` entry rather than failing the run. If `compute`/`storage`/`visitors` come back empty, check
  the warnings and adjust the query field names against your account's schema (GraphQL introspection).
- **Usage truthfulness**: when the gateway source fails (missing permission/config) the report and
  email subject state that provider usage is unknown — instrumented `ai_chat` totals are never
  presented as the total Anthropic spend. Stale instrumented telemetry (no `ai_chat` events in the
  window) is flagged in Warnings rather than read as $0.
- **No new instrumentation needed for product routes**: `ai_chat` telemetry flows from pokeMCP's
  teambuilder analytics module. The `source` blob distinguishes `web` (chat/claude, interview,
  meta-report routes) from `prep` (the `/api/prep/coach` matchup coach).
- **Cost**: one Opus call/day over a few KB of metrics — negligible.

## Quality checks

```sh
bun run type-check   # tsc --noEmit
bun run lint         # biome lint
bun run format       # biome format --write
bun run test         # vitest run (usage-reporting truthfulness + gateway aggregation)
```
