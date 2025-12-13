# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A Model Context Protocol (MCP) server for Pokémon competitive team building, deployed on Cloudflare Workers. Provides tools for Pokémon lookup, moveset/team validation, type coverage analysis, and usage statistics from Smogon. Includes RAG (Retrieval-Augmented Generation) capabilities for strategic advice using Cloudflare Vectorize and AI Workers.

**Deployed URL:** https://pokemon-mcp-cloudflare.rborkows.workers.dev

## Development Commands

### Essential Commands
```bash
# Type checking (required before deployment)
npm run type-check

# Linting and formatting (uses Biome)
npm run lint
npm run lint:fix
npm run format

# Local development server
npm run dev

# Deploy to production (prefer CI/CD - merging to main auto-deploys)
npm run deploy:production
```

### Stats Management
```bash
# Fetch latest Smogon usage statistics (rate-limited, ~45 seconds)
npm run fetch-stats

# Upload all fetched stats to KV (skips empty formats)
npm run upload-stats

# Or upload individual format manually
npx wrangler kv key put --remote --namespace-id=58525ad4ec5c454eb3e1ae7586414483 "gen9ou" --path="src/cached-stats/gen9ou.json"
```

**Update Schedule:**
- Smogon publishes new stats monthly (around the 1st-5th of each month)
- Run `npm run fetch-stats && npm run upload-stats` monthly to update
- The fetch script has 2-second delays between requests to be polite to Smogon
- Stats files are cached locally in `src/cached-stats/` for reference

**Supported Formats for Stats:**
- Gen 9: OU, Ubers, UU, RU, NU, PU, LC, VGC 2024 Reg F/H, Doubles OU
- Gen 8: OU, UU, RU (Ubers, NU, LC have limited data)
- Gen 7: OU, UU, RU, NU (Ubers, LC have limited data)

### Debugging & Monitoring
```bash
# Tail production logs in real-time
npm run tail
npm run tail:staging
npm run tail:production

# Test endpoints (when deployed)
# https://<worker-url>/test-ingestion - Trigger RAG ingestion for test Pokemon
# https://<worker-url>/test-kv - Verify KV storage access
# https://<worker-url>/test-rag?q=your+query - Test RAG query
# https://<worker-url>/debug-vectors - Inspect vector metadata
```

## Architecture

### Cloudflare Infrastructure

**Multi-layered Cloudflare stack:**
- **Workers**: Serverless compute for MCP requests (src/index.ts)
- **Durable Objects**: Stateful MCP session management (PokemonMCP class in src/index.ts)
- **KV Namespaces**:
  - `POKEMON_STATS`: Cached Smogon usage statistics
  - `STRATEGY_DOCS`: Raw strategy documents (chunks) for RAG
- **Vectorize**: Vector database for semantic search (pokemon-strategy-index)
- **AI Workers**: Text embeddings for RAG (@cf/baai/bge-base-en-v1.5)
- **Scheduled Triggers**: Weekly cron job (Sunday 3 AM) for content ingestion

### Environment Configuration

Three environments defined in wrangler.jsonc:
- **development** (default): Uses production KV/Vectorize
- **staging**: Separate KV namespaces, Saturday 4 AM cron
- **production**: Production resources, Sunday 3 AM cron

Each environment has its own:
- Worker name (pokemon-mcp-{env})
- KV namespace IDs
- Vectorize index
- Cron schedule

### Core Components

**MCP Server (src/index.ts)**
- Entry point: `export default` Cloudflare Worker with fetch handler
- `PokemonMCP` class extends `McpAgent` from agents library
- Routes:
  - `/mcp`: MCP protocol endpoint
  - `/sse`: Server-sent events transport
  - `/`: Server info JSON
  - `/test-*`: Debug endpoints

**Tools Layer (src/tools.ts)**
- Synchronous tools using bundled Pokémon Showdown data
- `lookupPokemon`: Species info, stats, abilities, tier
- `validateMoveset`: Check move legality via learnsets
- `validateTeam`: Species clause, team composition rules
- `suggestTeamCoverage`: Type effectiveness analysis

**Stats Layer (src/stats.ts)**
- Async tools querying Cloudflare KV
- Uses Smogon usage statistics JSON (cached monthly)
- `getPopularSets`: Most used moves/items/abilities/spreads
- `getMetaThreats`: Top Pokemon by usage %
- `getTeammates`: Common partners from actual teams
- `getChecksCounters`: Win/loss rates against specific Pokemon
- `getMetagameStats`: Format-level statistics

**Data Loading (src/data-loader.ts)**
- Imports from `smogon` package (Pokémon Showdown data)
- Helper functions: `getPokemon`, `getMove`, `getPokemonLearnset`, `toID`
- Direct imports at build time (no runtime fetches)

### RAG Pipeline

**Purpose**: Semantic search over Smogon strategy articles for strategic advice beyond stats.

**Ingestion Pipeline (src/ingestion/):**
1. **Scraper** (scraper.ts): Fetches HTML from smogon.com/dex/sv/pokemon/{name}
2. **Chunker** (chunker.ts): Splits strategy articles into sections (overview, moveset, counters, teammates)
3. **Embedder** (embedder.ts): Generates embeddings via Cloudflare AI Workers
4. **Indexer** (indexer.ts): Stores chunks in KV (`STRATEGY_DOCS`) and vectors in Vectorize

**Orchestrator** (ingestion/orchestrator.ts):
- `runIngestionPipeline()`: Processes top 50 Pokemon per format (triggered by cron)
- `runTestIngestion()`: Manually test with specific Pokemon
- Supports formats: Gen 9/8/7 Singles (OU/Ubers/UU/RU/NU/PU/LC), Gen 9 VGC

**Query Pipeline (src/rag/):**
1. **Embedder**: Convert query to vector
2. **Search** (search.ts): Vector similarity search in Vectorize, fetch content from KV
3. **Rerank** (rerank.ts): Boost scores by metadata (format/pokemon match)
4. **Filter**: Remove results below minScore (default 0.5)
5. **Format** (format.ts): Return structured JSON or text

**RAG Tools:**
- `query_strategy`: Natural language questions about strategy
- `search_strategic_content`: Filtered search by pokemon/format/section

### Data Sources

**Bundled at build time:**
- `smogon` package: Pokedex, moves, abilities, learnsets, format data

**Fetched/Cached in KV:**
- Smogon usage stats: Monthly JSON files from smogon.com/stats/
- Strategy docs: Scraped and chunked from smogon.com/dex/

## Code Style

**Linter:** Biome (not ESLint/Prettier)
- Indent: 4 spaces (tabs)
- Line width: 100 characters
- Always run `npm run lint:fix` and `npm run format` before committing

**TypeScript:**
- `strict: false` (Cloudflare Workers compatibility)
- `moduleResolution: "bundler"`
- Uses .js extensions in imports (e.g., `from './tools.js'`)

## Supported Formats

**Gen 9:** OU, Ubers, UU, RU, NU, PU, LC, VGC Regulation F/G/H
**Gen 8:** OU, Ubers, UU, RU, NU, PU, LC
**Gen 7:** OU, Ubers, UU, RU, NU, PU, LC

Format IDs use lowercase: `gen9ou`, `gen9vgc2024regh`, etc.

## Key Implementation Details

**Pokemon Naming:**
- Use `toID()` for all lookups (removes spaces, lowercases, handles special chars)
- Forms: "Landorus-Therian" → `landorustherian`
- Megas: "Charizard-Mega-X" → `charizardmegax`

**KV Data Structure:**
Stats stored as: `{ data: UsageStatistics, info: { ... } }`
Strategy docs stored with chunk IDs: `{pokemon}-{format}-{section}-{index}`

**Vector Metadata:**
```typescript
{
  pokemon: string,
  format: string,
  sectionType: "overview" | "moveset" | "counters" | "teammates",
  chunkId: string // KV key
}
```

**Error Handling:**
- Tools return user-friendly error strings (not exceptions)
- Log errors with `console.error` for Cloudflare dashboard
- Use `ctx.waitUntil()` for background tasks (ingestion)

## CI/CD Pipeline

**GitHub Actions Workflows:**

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `build.yml` | Pull requests | Build verification for PRs |
| `deploy-production.yml` | Merge to main | Auto-deploy all services |
| `update-stats.yml` | Monthly (5th) or manual | Update Smogon statistics |

**Deployment Flow:**
1. Push changes to a feature branch
2. Create PR → triggers `build.yml` checks
3. Merge to main → triggers `deploy-production.yml`
4. All three services deploy automatically:
   - MCP Worker → https://api.pokemcp.com
   - Teambuilder → https://www.pokemcp.com
   - Documentation → https://docs.pokemcp.com

**Required GitHub Secrets:**
- `CLOUDFLARE_API_TOKEN` - Cloudflare API token with Workers/Pages permissions
- `CLOUDFLARE_ACCOUNT_ID` - Your Cloudflare account ID

## Testing Changes

1. Run `npm run dev` to start local Wrangler server
2. Test MCP tools via `/test-rag?q=...` or `/test-kv` endpoints
3. Create a PR - CI will verify builds pass
4. After merge, deployment is automatic

## Common Tasks

**Adding a new tool:**
1. Implement function in src/tools.ts or src/stats.ts
2. Register in src/index.ts `init()` with Zod schema
3. Update endpoint list in root handler (line 348)

**Adding a new format:**
1. Add format to src/ingestion/orchestrator.ts FORMATS array
2. Ensure stats exist in KV for that format
3. Update README.md supported formats list

**Updating usage stats (monthly):**

Option 1 - GitHub Action (recommended):
- Runs automatically on the 5th of each month
- Or trigger manually: Actions → "Update Smogon Stats" → Run workflow

Option 2 - Manual:
1. `npm run fetch-stats` (downloads from Smogon, ~45 seconds)
2. `npm run upload-stats` (uploads to KV, requires Cloudflare auth)
3. Commit and push changes to trigger deploy
