# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A monorepo for **VGC Teambuilder**, a read-only MCP (Model Context Protocol) connector for
competitive Pokémon Champions team building, plus its content website and documentation site.
Claude and ChatGPT, through the connector, are the only interfaces.

**The connector:** `https://api.pokemcp.com/mcp` serves an authless MCP server (Streamable HTTP)
intended for the Claude and ChatGPT directories. Its 12 tools live in `src/connector/`: Pokémon
lookup, move and team legality, defensive type analysis, usage statistics and usage trends, for
Champions regulations only. The legacy `/sse` and `/api/tools` endpoints stay retired
(`410 Gone`). See [`src/CLAUDE.md`](src/CLAUDE.md).

**Monorepo Structure:**

- `src/` - MCP Worker (Cloudflare Workers) — see [`src/CLAUDE.md`](src/CLAUDE.md)
- `apps/teambuilder/` - The website: results, reports, Pokémon pages. No team builder, accounts or AI (OpenNext on Cloudflare Workers) — see [`apps/teambuilder/CLAUDE.md`](apps/teambuilder/CLAUDE.md)
- `apps/docs/` - Nextra documentation site (Cloudflare Pages) — see [`apps/CLAUDE.md`](apps/CLAUDE.md)

**Deployed URLs:**

- MCP Worker: https://api.pokemcp.com
- Teambuilder UI: https://www.pokemcp.com
- Documentation: https://docs.pokemcp.com

## Development Commands

### Essential Commands

Package manager: **Bun 1.3+** (the `packageManager` field in each `package.json` pins the version).

```bash
# Install deps
bun install

# Type checking (required before deployment)
bun run type-check

# Linting and formatting (uses Biome)
bun run lint
bun run lint:fix
bun run format

# Local development server
bun run dev

# Deploy to production — prefer CI/CD: merging to main triggers Cloudflare Workers Builds
bun run deploy:production
```

### Monorepo Apps

```bash
# Teambuilder (Next.js UI)
bun run dev:teambuilder        # Start dev server (port 3000)
cd apps/teambuilder && bun run test:run      # Run Vitest tests
cd apps/teambuilder && bun run test:coverage # Coverage report

# Documentation (Nextra)
bun run dev:docs               # Start dev server (port 3001)
```

### Stats Management

```bash
# Fetch latest Smogon usage statistics (rate-limited, ~45 seconds)
bun run fetch-stats

# Upload all fetched stats to KV (skips empty formats)
bun run upload-stats
```

> Always upload via `bun run upload-stats` — the worker only reads the sharded
> keys it writes (`{format}:_index` + `{format}:{pokemonid}`). Putting a whole
> stats JSON under a bare format key (e.g. `"gen9ou"`) stores data the server
> never reads.

**Update Schedule:**

- Smogon publishes new stats monthly (around the 1st-5th of each month)
- Run `bun run discover-formats && bun run fetch-stats && bun run upload-stats` monthly to update
- VGC formats are auto-discovered from Smogon's stats directory — new regulations are picked up automatically
- The fetch script has 2-second delays between requests to be polite to Smogon
- Stats files are written to `src/cached-stats/`, a gitignored local working directory — KV is
  the source of truth; the monthly workflow uploads the raw dumps as a 30-day workflow artifact
  (`smogon-stats-<run id>`) for inspection instead of committing them
- Discovered formats are saved to `src/discovered-formats.json` (also uploaded to KV; nothing reads that copy now)
- `bun run generate-reports` builds the publishable meta-report MDX + per-Pokémon trend JSON
  (`apps/teambuilder/src/content/reports/` + `src/data/mons/`) straight from Smogon's monthly
  chaos archives. Deterministic tables always; narrative sections only when `ANTHROPIC_API_KEY`
  is set (`NARRATIVE=0` to skip). The monthly GitHub Action runs it and opens a review PR —
  reports publish at https://www.pokemcp.com/reports on merge. Hand-written manifest entries
  (no `generated: true` flag) are never overwritten.

**Supported Formats for Stats:**

- Gen 9: OU, Ubers, UU, RU, NU, PU, LC, VGC 2026 Reg F, Doubles OU (VGC formats auto-discovered)
- Gen 8: OU, UU, RU (Ubers, NU, LC have limited data)
- Gen 7: OU, UU, RU, NU (Ubers, LC have limited data)
- Pokémon Champions: Reg M-A (`champions-regma`). Smogon publishes these under a
  `gen9champions…` prefix (e.g. `gen9championsvgc2026regma`). The format pulled is
  driven by each regulation's `showdownFormatId` (see `src/regulations/`), not the
  VGC/doubles discovery patterns — `fetch-stats` reads it from the registry. The
  stats tools transparently remap `champions-regma` → the Smogon id via
  `resolveStatsFormat`.

### Debugging & Monitoring

```bash
# Tail production logs in real-time
bun run tail
bun run tail:staging
bun run tail:production
```

## Architecture

### Cloudflare Infrastructure

- **Workers**: the MCP worker (`src/index.ts`) and the website
- **Durable Objects**: none in use. `/mcp` is served statelessly by the Worker. `PokemonMCP`
  (the old per-session object) and `IngestionCoordinator` remain only as classes an applied
  migration names
- **KV**: `POKEMON_STATS` (current-month usage statistics and each regulation's eligible list),
  `SHARED_TEAMS` (legacy shared-team links)
- **D1**: `META_DB` (`pokemcp-meta-history`) — monthly usage history and tournament results
- **Rate limiting**: `MCP_RATE_LIMITER`, a per-IP ceiling on `/mcp`
- **Analytics Engine**: `ANALYTICS` — tool-call counts for the admin dashboard
- **R2**: `pokemcp-interaction-logs` — feedback submissions; interaction logging is off
- **Scheduled trigger**: one daily cron (06:00 UTC, production only) that pulls new tournament
  results from Limitless (`src/tournaments/ingestion.ts`)

The worker calls no AI model. The search index, strategy-document store and Workers AI binding
that powered the old strategy-search tool were removed in November 2026.

### Environment Configuration

Three environments defined in wrangler.jsonc, each with its own worker name
(`pokemon-mcp-{env}`) — but **all three currently bind the same production
KV namespaces, D1 database, and R2 bucket**. Treat any
`--remote` dev session or staging deploy as touching production data. Only
the production env has a cron trigger (the daily tournament refresh).

> ⚠️ Known gap (from the 2026-07 audit): staging is not isolated and fails
> open on `/admin/*` auth if `CF_ACCESS_TEAM_DOMAIN` is unset. Provision real
> staging namespaces before using it for anything sensitive.

## Code Style

**Linter:** Biome (not ESLint/Prettier)

- Indent: 4 spaces (tabs)
- Line width: 100 characters
- Always run `bun run lint:fix` and `bun run format` before committing

**TypeScript:**

- `strict: false` (Cloudflare Workers compatibility)
- `moduleResolution: "bundler"`
- Uses .js extensions in imports (e.g., `from './tools.js'`)

## Supported Formats

**Gen 9:** OU, Ubers, UU, RU, NU, PU, LC, VGC 2026 Reg F, Doubles OU (VGC formats auto-discovered)
**Gen 8:** OU, Ubers, UU, RU, NU, PU, LC
**Gen 7:** OU, Ubers, UU, RU, NU, PU, LC

Format IDs use lowercase: `gen9ou`, `gen9vgc2024regh`, etc.

## Key Implementation Details

**Pokemon Naming:**

- Use `toID()` for all lookups (removes spaces, lowercases, handles special chars)
- Forms: "Landorus-Therian" → `landorustherian`
- Megas: "Charizard-Mega-X" → `charizardmegax`

See [`src/CLAUDE.md`](src/CLAUDE.md) for KV data structures, vector metadata, error handling patterns, and module dependency graph.

## CI/CD Pipeline

Cloudflare owns all production deploys. GitHub Actions only runs PR build verification and the
monthly stats refresh.

**GitHub Actions Workflows:**

| Workflow               | Trigger                 | Purpose                                                    |
| ---------------------- | ----------------------- | ---------------------------------------------------------- |
| `build.yml`            | Pull requests           | Build verification (worker dry-run, teambuilder, docs)     |
| `update-stats.yml`     | Monthly (5th) or manual | Fetch Smogon stats, push to `main` (Cloudflare redeploys)  |
| `deploy.yml`           | Manual (choice input)   | Manual deploy of worker/teambuilder/docs (`--env production`) |
| `backfill-history.yml` | Manual                  | Backfill D1 meta-history from Smogon archives              |

**Cloudflare Deploy Projects:**

| Project                       | Surface         | Deploy on push to `main`                  |
| ----------------------------- | --------------- | ----------------------------------------- |
| Workers Builds `pokemon-mcp-production`   | MCP Worker      | `bunx wrangler deploy --env production`   |
| Workers Builds `pokemcp-teambuilder`      | Teambuilder UI  | `bun run pages:build && bunx wrangler deploy --config wrangler.toml` |
| Pages Git integration                     | Documentation   | `bun run build` in `apps/docs/`           |

**Deployment Flow:**

1. Push changes to a feature branch
2. Create PR → triggers `build.yml` checks (bun install + lint/build/dry-run)
3. Merge to main → Cloudflare Workers Builds / Pages pick up the push and redeploy:
   - MCP Worker → https://api.pokemcp.com
   - Teambuilder → https://www.pokemcp.com
   - Documentation → https://docs.pokemcp.com

**Required GitHub Secrets (for `build.yml` and `update-stats.yml`):**

- `CLOUDFLARE_API_TOKEN` - Cloudflare API token with Workers/KV permissions
- `CLOUDFLARE_ACCOUNT_ID` - Your Cloudflare account ID

**Runtime secrets** (set once on each Cloudflare Worker via the dashboard; no longer set on every
deploy):

- `pokemon-mcp-production`: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `CF_ACCESS_TEAM_DOMAIN`
- `pokemcp-teambuilder`: none. The site has no accounts and calls no AI provider.

Neither worker calls an AI model. The only AI use left is the report narrative in
`scripts/generate-reports.ts`, which runs in GitHub Actions with the repo's `ANTHROPIC_API_KEY`
secret and is reviewed in a PR before it publishes.

**Verify after deploy:**

```bash
./scripts/verify-deploy.sh                             # hits prod defaults
MCP_URL=... TB_URL=... ./scripts/verify-deploy.sh      # staging/dev override
```

Checks that each worker's health endpoint responds. For the connector itself, connect an MCP
client to `https://api.pokemcp.com/mcp` and call a tool; the tools are read-only.
`bun run probe-connector` times a new connection and one call of each kind against production.

## Testing Changes

### MCP Worker Testing

1. Run `bun run test` for the unit suite (`node --test` over `src/__tests__/`).
   `connector.test.ts` drives every public tool through an MCP SDK client.
2. Run `bun run dev` to start a local Wrangler server, then connect an MCP client
   (for example the MCP Inspector) to `http://localhost:8787/mcp`. Local KV and D1
   start empty, so stats and trend tools return their "unavailable" errors until
   seeded with `wrangler kv bulk put --local` / `wrangler d1 execute --local`.
3. Create a PR - CI will verify builds pass
4. After merge, Cloudflare Workers Builds redeploys automatically

### Team Builder Testing

```bash
cd apps/teambuilder
bun run test:run        # Run all tests
bun run test:coverage   # Run with coverage report
```

See [`apps/teambuilder/CLAUDE.md`](apps/teambuilder/CLAUDE.md) for test structure and coverage targets.

## Common Tasks

**Adding a public connector tool:**

1. Implement it in `src/connector/` returning `ok(data, text)` or `fail(message)`;
   failures reach the client as tool errors, so the message must be actionable and
   free of internal details
2. Add it to `CONNECTOR_TOOLS` in `src/connector/tools.ts` with a title, an accurate
   description, and input and output schemas — one operation per tool, no `type`
   switches (directory reviews require this)
3. Cover it in `src/__tests__/connector.test.ts`, then run `bun run generate-tool-docs`

**Adding a new Champions regulation (e.g. M-D):**

1. Add `src/regulations/champions-reg<x>.ts` and register it in `registry.ts`; set the
   previous regulation's `endDate`. Defaults (stats tools, Limitless ingestion, reports)
   follow the newest regulation that has `showdownFormatId` / `limitlessFormatId` set
2. Find the official eligible-Pokémon page and set `officialLegalityUrl`. Run
   `bun run fetch-champions-legality -- <id>`; if it throws on a new form label, add the
   mapping in `champions-html-parser.ts`. Cross-check the list against the ladder data
3. `bun run upload-champions-legality` (production KV) — team validation fails loudly
   for the regulation until this is done
4. Megas come from the bundled dex snapshot, which lags. Add any Mega seen on the ladder
   but missing from it to the pending list in `mega-data.ts` (stone id from the ladder's
   item ids)
5. Run the "Update Smogon Stats" workflow from `main`, then "Backfill Metagame History"
   for the new format id if the regulation started more than a month ago

**Updating usage stats (monthly):**

Option 1 - GitHub Action (recommended):

- Runs automatically on the 5th of each month, but waits for manual approval of the
  `production` environment — unapproved runs time out after 30 days, so check the Actions
  tab if stats look stale
- Only ever dispatch it from `main`: it rebases onto and pushes to `main`
- An ended regulation resolves to its last published month, so its final snapshot is kept
- Discovers new formats, fetches stats, and uploads — all automated
- Or trigger manually: Actions → "Update Smogon Stats" → Run workflow

Option 2 - Manual:

1. `bun run discover-formats` (discovers available VGC formats from Smogon)
2. `bun run fetch-stats` (downloads from Smogon, ~45 seconds)
3. `bun run upload-stats` (uploads to KV, requires Cloudflare auth)
4. Commit `src/discovered-formats.json` if it changed — the stats dumps in `src/cached-stats/`
   are gitignored (KV is the source of truth); a push to main triggers a Cloudflare redeploy

### Website (`apps/teambuilder`)

The site is content only: tournament results, meta reports, Pokémon pages and the privacy
policy. PokeMCP Prep, saved teams, accounts and every AI feature were retired in November 2026;
Claude and ChatGPT, through the connector, are the only interfaces. See
[`apps/teambuilder/CLAUDE.md`](apps/teambuilder/CLAUDE.md) for routes, what the retirement left
behind and the `build/` ignore-rule trap.
