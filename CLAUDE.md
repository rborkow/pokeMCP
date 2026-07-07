# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A monorepo containing an MCP (Model Context Protocol) server for Pokémon competitive team building, plus a team builder web UI and documentation site. The MCP server is deployed on Cloudflare Workers and provides tools for Pokémon lookup, moveset/team validation, type coverage analysis, and usage statistics from Smogon. Includes RAG (Retrieval-Augmented Generation) capabilities for strategic advice using Cloudflare Vectorize and AI Workers.

**Monorepo Structure:**

- `src/` - MCP Worker (Cloudflare Workers) — see [`src/CLAUDE.md`](src/CLAUDE.md)
- `apps/teambuilder/` - Next.js team building UI (OpenNext on Cloudflare Workers) — see [`apps/teambuilder/CLAUDE.md`](apps/teambuilder/CLAUDE.md)
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
- Discovered formats are saved to `src/discovered-formats.json` and uploaded to KV for the ingestion pipeline
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

**Multi-layered Cloudflare stack:**

- **Workers**: Serverless compute for MCP requests (src/index.ts)
- **Durable Objects**: Stateful MCP session management (PokemonMCP) and the
  weekly ingestion alarm chain (IngestionCoordinator in src/ingestion/coordinator.ts)
- **KV Namespaces**:
  - `POKEMON_STATS`: Cached Smogon usage statistics
  - `STRATEGY_DOCS`: Raw strategy documents (chunks) for RAG
- **Vectorize**: Vector database for semantic search (pokemon-strategy-index)
- **AI Workers**: Text embeddings for RAG (@cf/baai/bge-base-en-v1.5)
- **AI Gateway**: Proxy for Anthropic API calls — automatic token/cost tracking, request logging, caching (gateway ID: `pokemcp`)
- **R2 Bucket**: pokemcp-interaction-logs for anonymized fine-tuning data
- **Scheduled Triggers**: Weekly cron (Sunday 3 AM, production only) seeds the
  IngestionCoordinator Durable Object, which ingests one format slice per alarm

### Environment Configuration

Three environments defined in wrangler.jsonc, each with its own worker name
(`pokemon-mcp-{env}`) — but **all three currently bind the same production
KV namespaces, Vectorize index, D1 database, and R2 bucket**. Treat any
`--remote` dev session or staging deploy as touching production data. Only
the production env has a cron trigger (Sunday 3 AM ingestion seed).

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
- `pokemcp-teambuilder`: `ANTHROPIC_API_KEY`, `CLOUDFLARE_AI_GATEWAY_URL`, `CF_AIG_TOKEN`

All Anthropic traffic runs through the teambuilder worker (`/api/ai/claude/stream` +
`/api/ai/interview/stream`), which routes through the Cloudflare AI Gateway (`pokemcp`). The MCP
Worker uses Workers AI for embeddings, also gateway-routed. The MCP Worker never calls Anthropic.

**Verify secrets after deploy:**

```bash
./scripts/verify-deploy.sh                             # hits prod defaults
MCP_URL=... TB_URL=... ./scripts/verify-deploy.sh      # staging/dev override
```

Hits `/health` on each worker, which returns booleans for each expected secret (never values).
Run after any secret rotation or new worker deploy — exits non-zero if any secret is missing.

## Testing Changes

### MCP Worker Testing

1. Run `bun run test` for the unit suite (`node --test` over `src/__tests__/`)
2. Run `bun run dev` to start a local Wrangler server, then exercise tools via
   REST: `curl -X POST localhost:8787/api/tools -H 'content-type: application/json' -d '{"tool":"lookup_pokemon","args":{"name":"Great Tusk"}}'`
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

**Adding a new tool:**

1. Implement function in `src/tools.ts` or `src/stats.ts`
2. Register in `src/tool-registry.ts` with Zod schema
3. Tool is auto-available via MCP `init()` and `/api/tools` REST endpoint

**Adding a new format:**

1. For VGC/doubles: formats are auto-discovered — just run `bun run discover-formats`
2. For singles: add format to the SINGLES_FORMATS array in `src/ingestion/orchestrator.ts`
3. Add Smogon format name mapping in `src/ingestion/scraper.ts` (VGC formats auto-generate names)
4. Update README.md supported formats list

**Updating usage stats (monthly):**

Option 1 - GitHub Action (recommended):

- Runs automatically on the 5th of each month
- Discovers new formats, fetches stats, and uploads — all automated
- Or trigger manually: Actions → "Update Smogon Stats" → Run workflow

Option 2 - Manual:

1. `bun run discover-formats` (discovers available VGC formats from Smogon)
2. `bun run fetch-stats` (downloads from Smogon, ~45 seconds)
3. `bun run upload-stats` (uploads to KV, requires Cloudflare auth)
4. Commit `src/discovered-formats.json` if it changed — the stats dumps in `src/cached-stats/`
   are gitignored (KV is the source of truth); a push to main triggers a Cloudflare redeploy

### Team Builder AI Tasks

As of v2 the teambuilder is chat-first: landing at `/`, LLM-driven interview, inline response cards, and a Grid mode behind `?mode=grid`. See [`apps/teambuilder/CLAUDE.md`](apps/teambuilder/CLAUDE.md) for the v2 directory layout, routes, architecture walkthrough, and step-by-step how-tos (new archetype, new personality, new response-card kind, new interview step, system-prompt edits, `modify_team` schema changes).
