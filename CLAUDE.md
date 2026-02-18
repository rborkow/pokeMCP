# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A monorepo containing an MCP (Model Context Protocol) server for Pokémon competitive team building, plus a team builder web UI and documentation site. The MCP server is deployed on Cloudflare Workers and provides tools for Pokémon lookup, moveset/team validation, type coverage analysis, and usage statistics from Smogon. Includes RAG (Retrieval-Augmented Generation) capabilities for strategic advice using Cloudflare Vectorize and AI Workers.

**Monorepo Structure:**
- `src/` - MCP Worker (Cloudflare Workers) — see [`src/CLAUDE.md`](src/CLAUDE.md)
- `apps/teambuilder/` - Next.js team building UI (Cloudflare Pages) — see [`apps/teambuilder/CLAUDE.md`](apps/teambuilder/CLAUDE.md)
- `apps/docs/` - Nextra documentation site (Cloudflare Pages) — see [`apps/CLAUDE.md`](apps/CLAUDE.md)

**Deployed URLs:**
- MCP Worker: https://api.pokemcp.com
- Teambuilder UI: https://www.pokemcp.com
- Documentation: https://docs.pokemcp.com

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

### Monorepo Apps
```bash
# Teambuilder (Next.js UI)
npm run dev:teambuilder        # Start dev server (port 3000)
cd apps/teambuilder && npm run test:run      # Run Vitest tests
cd apps/teambuilder && npm run test:coverage # Coverage report

# Documentation (Nextra)
npm run dev:docs               # Start dev server (port 3001)
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
- **R2 Bucket**: pokemcp-interaction-logs for anonymized fine-tuning data
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

See [`src/CLAUDE.md`](src/CLAUDE.md) for KV data structures, vector metadata, error handling patterns, and module dependency graph.

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

### MCP Worker Testing
1. Run `npm run dev` to start local Wrangler server
2. Test MCP tools via `/test-rag?q=...` or `/test-kv` endpoints
3. Create a PR - CI will verify builds pass
4. After merge, deployment is automatic

### Team Builder Testing
```bash
cd apps/teambuilder
npm run test:run        # Run all tests
npm run test:coverage   # Run with coverage report
```

See [`apps/teambuilder/CLAUDE.md`](apps/teambuilder/CLAUDE.md) for test structure and coverage targets.

## Common Tasks

**Adding a new tool:**
1. Implement function in `src/tools.ts` or `src/stats.ts`
2. Register in `src/tool-registry.ts` with Zod schema
3. Tool is auto-available via MCP `init()` and `/api/tools` REST endpoint

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

### Team Builder AI Tasks

See [`apps/teambuilder/CLAUDE.md`](apps/teambuilder/CLAUDE.md) for directory layout and conventions. Key files for AI changes:

**Adding a new team archetype:**
1. Add archetype to `apps/teambuilder/src/lib/ai/archetypes.ts`
2. Include: `id`, `name`, `description`, `icon`, `prompt`, `keyFeatures`, `formats`
3. Set `formats` to "singles", "doubles", or "both"
4. Add tests in `apps/teambuilder/src/__tests__/archetypes.test.ts`

**Adding a new AI personality:**
1. Add to `apps/teambuilder/src/lib/ai/personalities.ts`
2. Include: `id`, `name`, `systemPromptPrefix`, `praiseStyle`, `criticismStyle`
3. Add tests in `apps/teambuilder/src/__tests__/personalities.test.ts`

**Modifying Claude's system prompt:**
- Edit `apps/teambuilder/src/lib/ai/context.ts` (`buildSystemPrompt()`, `getGimmickGuidance()`, `formatTeamContext()`)

**Modifying the modify_team tool schema:**
- Edit `apps/teambuilder/src/lib/ai/tools.ts` → update `ModifyTeamInput` interface → update system prompt in `context.ts`
