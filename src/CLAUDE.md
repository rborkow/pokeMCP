# MCP Worker (Cloudflare Workers)

Entry point for the Pokemon MCP server deployed at `api.pokemcp.com`.

## Module Dependency Graph

```
index.ts (routes + PokemonMCP Durable Object)
├── tool-registry.ts (central registry of all 11 tools)
│   ├── tools.ts (4 sync tools: lookup, validate_moveset, validate_team, suggest_coverage)
│   ├── stats.ts (5 async tools: popular_sets, meta_threats, teammates, checks_counters, metagame_stats)
│   └── rag/query.ts (2 RAG tools: query_strategy, search_strategic_content)
├── data-loader.ts (imports from data/*.ts — bundled at build time)
├── logging.ts (anonymized R2 interaction logging)
└── ingestion/orchestrator.ts (cron-triggered pipeline)
```

## Tool Categories

| Category | File | Needs Env Bindings | Count |
|----------|------|--------------------|-------|
| Sync (bundled data) | `tools.ts` | No | 4 |
| Stats (KV) | `stats.ts` | `POKEMON_STATS` KV | 5 |
| RAG (Vectorize+KV) | `rag/query.ts` | `VECTOR_INDEX` + `STRATEGY_DOCS` KV + `AI` | 2 |

`tool-registry.ts` is the single source of truth for all tool definitions. Both the MCP `init()` and the `/api/tools` REST endpoint consume it.

## HTTP Endpoints

| Path | Method | Purpose |
|------|--------|---------|
| `/mcp` | POST | MCP protocol (Durable Object) |
| `/sse` | GET | SSE transport for MCP |
| `/api/tools` | POST | Stateless REST tool invocation |
| `/ai/chat` | POST | AI assistant for teambuilder (Claude) |
| `/api/feedback` | POST | User feedback to R2 |
| `/` | GET | Server info JSON |

CORS allows: `pokemcp.com`, `docs.pokemcp.com`, `localhost:3000`, `localhost:3001`.

## Data Layer

- `data-loader.ts` imports static `.ts` files from `data/` (pokedex, moves, learnsets, abilities, items, typechart)
- These are extracted from the `smogon` npm package and bundled at build time
- Always use `toID()` for Pokemon/move name normalization

## Ingestion Pipeline (`ingestion/`)

```
orchestrator.ts → scraper.ts → chunker.ts → embedder.ts → indexer.ts
```

- Processes top 50 Pokemon per format via weekly cron
- Scraper uses the `smogon` package's `Analyses` class (RPC API, not HTML scraping)
- Chunk sizes: 800 tokens for overview, 600 for moveset/counters sections
- Embedder: `@cf/baai/bge-base-en-v1.5` via Workers AI (768-dim vectors)
- Indexer: vectors to Vectorize (batches of 100), full content to `STRATEGY_DOCS` KV (180-day TTL)

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
- Uses `ctx.waitUntil()` so logging does not block responses

## Error Handling

- Tool handlers return user-friendly error strings (never throw)
- Use `console.error` for Cloudflare dashboard visibility
- Use `ctx.waitUntil()` for background tasks (ingestion, logging)
