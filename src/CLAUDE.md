# MCP Worker (Cloudflare Workers)

Entry point for the Pokemon MCP server deployed at `api.pokemcp.com`.

## Module Dependency Graph

```
index.ts (routes + PokemonMCP and IngestionCoordinator Durable Objects)
├── tool-registry.ts (central registry of all 7 tools)
│   ├── tools.ts (4 sync tools: lookup_pokemon, validate_moveset, validate_team, suggest_team_coverage)
│   ├── stats.ts (get_usage_stats — one tool, `type` enum selects the stat view)
│   ├── rag/query.ts (query_strategy — consolidated RAG search)
│   └── meta-history.ts (get_meta_trends — D1-backed usage history)
├── data-loader.ts (imports from data/*.ts — bundled at build time)
├── logging.ts (anonymized R2 interaction logging)
├── share.ts (/api/team/* shared-team storage) + og/ (OG image rendering)
├── admin.ts (Cloudflare Access-protected admin API)
└── ingestion/coordinator.ts (Durable Object alarm chain; seeded by the cron)
```

## Tool Categories

| Category | File | Needs Env Bindings | Count |
|----------|------|--------------------|-------|
| Sync (bundled data) | `tools.ts` | No | 4 |
| Stats (KV) | `stats.ts` | `POKEMON_STATS` KV | 1 (`get_usage_stats`, `type` enum) |
| RAG (Vectorize+KV) | `rag/query.ts` | `VECTOR_INDEX` + `STRATEGY_DOCS` KV + `AI` | 1 (`query_strategy`) |
| Meta history (D1) | `meta-history.ts` | `META_DB` D1 | 1 (`get_meta_trends`) |

`tool-registry.ts` is the single source of truth for all tool definitions. Both the MCP `init()` and the `/api/tools` REST endpoint consume it.

## HTTP Endpoints

| Path | Method | Purpose |
|------|--------|---------|
| `/mcp` | POST | MCP protocol (Durable Object) |
| `/sse` | GET | SSE transport for MCP |
| `/api/tools` | POST | Stateless REST tool invocation (origin allowlist + 30 req/min/IP) |
| `/health` | GET | Deploy health / secret-presence booleans |
| `/api/feedback` | POST | User feedback to R2 |
| `/api/team/share` | POST | Store a shared team in KV, returns short id |
| `/api/team/:id` | GET | Fetch a shared team |
| `/og/team/:id` | GET | OG image (satori + resvg WASM) for a shared team |
| `/admin/*` | GET | Analytics/admin API (Cloudflare Access JWT required) |
| `/` | GET | Server info JSON |

CORS allows: `pokemcp.com`, `docs.pokemcp.com`, `localhost:3000`, `localhost:3001`.

## Data Layer

- `data-loader.ts` imports static `.ts` files from `data/` (pokedex, moves, learnsets, abilities, items, typechart)
- These are extracted from the `smogon` npm package and bundled at build time
- Always use `toID()` for Pokemon/move name normalization

## Ingestion Pipeline (`ingestion/`)

```
scheduled() ──seed()──▶ coordinator.ts (DO alarm chain)
                          └─ per alarm: orchestrator.ts ingestFormat()
                               → scraper.ts → chunker.ts → embedder.ts → indexer.ts
```

- The weekly cron only builds the format list and seeds the `IngestionCoordinator`
  Durable Object; it rethrows on failure so the cron run shows as failed
- The coordinator processes the queue one alarm at a time: max 25 Pokemon per
  alarm (subrequest budget), 10s spacing, one retry per failed format, loud
  completion summary + `ingestion_run` Analytics Engine datapoint
- Queue/retry logic is a pure state machine in `coordinator-state.ts`
  (unit-tested in `__tests__/ingestion-coordinator.test.ts`)
- Top 50 Pokemon per format; scraper uses the `smogon` package's `Analyses`
  class (RPC API, not HTML scraping) with a 500ms politeness delay
- Chunk sizes: 800 tokens for overview, 600 for moveset/counters sections
- Embedder: `@cf/baai/bge-base-en-v1.5` via Workers AI (768-dim vectors)
- Indexer: vectors to Vectorize (batches of 100) with display-name `pokemon`
  plus `toID()`-normalized `pokemon_id` metadata; full content to
  `STRATEGY_DOCS` KV (180-day TTL)

## RAG Query Pipeline (`rag/`)

```
query.ts → search.ts (vector similarity) → rerank.ts (metadata boosts) → format.ts
```

**Reranking boosts**: format match +0.1, pokemon match +0.05, recency +0.02 (decays over 30 days), duplicate pokemon penalty -0.05 per occurrence. Minimum score threshold: 0.5.

## Logging (`logging.ts`)

- `withLogging()` wraps all tool executions with timing and R2 storage
- 10% sampling rate, max 4000 char response truncation
- Sanitizes PII (removes nicknames from team data)
- R2 path: `logs/YYYY/MM/DD/HH/{uuid}.json`
- The REST path passes `ctx` so the R2 write runs via `ctx.waitUntil()`; the
  MCP (Durable Object) path currently logs fire-and-forget without it

## Error Handling

- Tool handlers return user-friendly error strings (never throw)
- Use `console.error` for Cloudflare dashboard visibility
- Use `ctx.waitUntil()` for background tasks (ingestion, logging)
