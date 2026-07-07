# Pokémon MCP Server

[![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-blue.svg)](https://www.gnu.org/licenses/agpl-3.0)
[![Build](https://github.com/rborkow/pokeMCP/actions/workflows/build.yml/badge.svg)](https://github.com/rborkow/pokeMCP/actions/workflows/build.yml)

An MCP (Model Context Protocol) server for Pokémon team building and validation, powered by Pokémon Showdown data and Smogon usage statistics. Deployed on Cloudflare Workers for fast, reliable access.

**Try it now:** [Team Builder UI](https://www.pokemcp.com) | [API Documentation](https://docs.pokemcp.com) | [MCP Endpoint](https://api.pokemcp.com/mcp)

## Team Builder UI

A full-featured web application for building competitive Pokemon teams:

- **AI Coach**: Claude-powered assistant with personality themes (Professor Kukui, Professor Oak, Rival Blue)
- **Team Archetypes**: Guided team generation with strategic presets:
  - Singles: Hyper Offense, Bulky Offense, Balance, Stall, Weather
  - Doubles/VGC: Goodstuffs, Trick Room, Tailwind, Sun, Rain, Sand
  - Goblin Mode: Wolfe Glick-inspired creative/unorthodox teams
- **Format Selection**: Quick Singles/VGC toggle with support for Gen 7-9 formats
- **Analysis Tools**:
  - Type Coverage: Visual breakdown of team weaknesses and resistances
  - Threat Matrix: Matchup analysis against top meta threats with usage weighting
  - Speed Tiers: Calculated speed stats at Level 50 with benchmarks and speed control detection
- **VGC Features**: Bring Four selector for team preview practice
- **Import/Export**: Full Showdown format support with shareable URLs
- **Welcome Flow**: Easy onboarding - generate a team with archetype, import, or build from scratch

## Features

### 🔍 Pokémon Lookup
Look up detailed information about any Pokémon including:
- Base stats and BST (Base Stat Total)
- Types and abilities (including hidden abilities)
- Tier information (OU, Ubers, etc.)
- Evolution chains
- Physical characteristics

### ✅ Moveset Validation
Validate whether a Pokémon can legally learn a set of moves:
- Checks move legality across generations
- Shows learning methods (Level-up, TM, Egg move, etc.)
- Identifies illegal moves

### 👥 Team Validation
Validate full teams against competitive format rules:
- Species Clause (no duplicate Pokémon)
- Move legality checking
- Ability validation
- Maximum 6 Pokémon, 4 moves each

### 💡 Team Coverage Analysis
Analyze your team's type coverage and weaknesses:
- Identifies defensive weaknesses
- Shows resistances
- Type distribution analysis
- Suggestions for filling gaps

### 📊 Smogon Usage Statistics
Access real competitive data from thousands of battles with cached data for instant responses (all exposed via the single `get_usage_stats` tool, selected with a `type` argument):
- **Popular Sets** (`popular_sets`): Most used moves, items, abilities, and EV spreads
- **Meta Threats** (`meta_threats`): Top Pokémon by usage percentage
- **Teammates** (`teammates`): Common team partners based on actual teams
- **Checks & Counters** (`checks_counters`): What beats your Pokémon (with KO rates)
- **Metagame Stats** (`metagame`): Overall format statistics and trends

### 🧠 Strategic Advice
Search Smogon strategy write-ups with semantic (RAG) search via `query_strategy`:
- Natural-language questions about movesets, counters, and teammates
- Optional filters by Pokémon, format, and section type (overview/moveset/counters/teammates)
- Powered by Cloudflare Vectorize + Workers AI embeddings

### 📈 Metagame Trends
Analyze how a format evolves month over month via `get_meta_trends`:
- A single Pokémon's usage trend over time
- Format-wide risers/fallers/entrants/dropouts between two snapshots
- Usage momentum (slope, EWMA, volatility, acceleration)
- An overall evolution summary
- Backed by a Cloudflare D1 time-series store; tuned for VGC/doubles and Pokémon Champions regulations

**Supported Formats:**
- **Pokémon Champions:** Reg M-A (2026-04-08 – 2026-06-17) and Reg M-B (current, since 2026-06-17) *(partial — Mega Evolution and Victory Point mechanics are not yet fully modeled; see [`docs/CHAMPIONS_ROADMAP.md`](docs/CHAMPIONS_ROADMAP.md))*
- Gen 9: OU, Ubers, UU, RU, NU, PU, LC, VGC 2026 Reg I (current), Doubles OU
- Gen 8: OU, UU, RU, Doubles OU *(Ubers, NU, PU, LC have minimal usage data on Smogon)*
- Gen 7: OU, Ubers, UU, RU, NU, Doubles OU *(PU, LC have minimal usage data on Smogon)*

*VGC/Doubles formats are auto-discovered monthly from Smogon's stats directory (see `src/discovered-formats.json`); new regulations are picked up automatically — no code changes needed. Pokémon Champions regulations (`champions-regma`, `champions-regmb`) have a rotating allow-list fetched from the official legality page and are mapped internally to Smogon's `gen9championsvgc2026regm*` usage-stats files; run `bun run fetch-champions-legality && bun run upload-champions-legality` when a new regulation ships. Format IDs are lowercase and case-sensitive.*

## Deployment

Deployed on Cloudflare Workers and Pages:

- **Team Builder**: https://www.pokemcp.com
- **MCP API**: https://api.pokemcp.com/mcp
- **Documentation**: https://docs.pokemcp.com

### Deploy Your Own

1. Install Wrangler CLI:
   ```bash
   bun install -g wrangler
   ```

2. Clone and setup:
   ```bash
   git clone https://github.com/rborkow/pokeMCP.git
   cd pokeMCP
   bun install
   ```

3. Login to Cloudflare:
   ```bash
   wrangler login
   ```

4. Configure environment variables (for AI Chat):
   ```bash
   # Team Builder requires Anthropic API key for AI coach
   cp apps/teambuilder/.env.example apps/teambuilder/.env.local
   # Edit .env.local and add your ANTHROPIC_API_KEY
   ```

   Get your API key from [Anthropic Console](https://console.anthropic.com/).

5. (Optional) Fetch latest stats:
   ```bash
   bun run fetch-stats
   ```

6. Deploy:
   ```bash
   bun run deploy
   ```

### Environment Variables

| Variable | Location | Required | Description |
|----------|----------|----------|-------------|
| `ANTHROPIC_API_KEY` | Team Builder | Yes* | Anthropic API key for AI coach chat |
| `NEXT_PUBLIC_MCP_URL` | Team Builder | No | MCP API URL (defaults to api.pokemcp.com) |

*Required only if running the Team Builder locally with AI chat enabled.

**Cloudflare Bindings** (configured in `wrangler.jsonc`):
- `POKEMON_STATS` - KV namespace for cached Smogon statistics
- `STRATEGY_DOCS` - KV namespace for RAG documents
- `VECTOR_INDEX` - Vectorize database for semantic search
- `META_DB` - D1 database for metagame usage history (`get_meta_trends`)
- `AI` - Cloudflare AI binding for embeddings

### Updating Cached Stats

Stats are cached in Cloudflare KV as sharded keys — `{format}:_index` (lightweight per-format usage index) and `{format}:{pokemonid}` (full stat blob per Pokémon) — so the worker only reads what a request needs. The worker never reads a single monolithic per-format key, so don't hand-`wrangler kv key put` a whole JSON file. To update:

1. Discover the latest VGC/doubles formats and fetch stats from Smogon:
   ```bash
   bun run discover-formats
   bun run fetch-stats
   ```

2. Upload everything to KV (reads every file in `src/cached-stats/`, builds the sharded keys, and bulk-uploads them; the namespace ID defaults to the one in `wrangler.jsonc` and can be overridden with `KV_NAMESPACE_ID`):
   ```bash
   bun run upload-stats
   ```

## Usage in Claude

### Claude.ai (Recommended)

Add as a Custom Connector in Claude.ai Settings:

1. Go to Settings → Integrations → Custom Connectors
2. Add new connector:
   - URL: `https://api.pokemcp.com/mcp`
   - No authentication required
3. Start using all tools in conversations

*Learn more at: https://pokemcp.com*

*Requires: Claude Pro, Team, or Enterprise*

### Example Prompts

Once connected, try:
- "What are the base stats for Garchomp?"
- "Is this moveset legal for Garchomp: Earthquake, Dragon Claw, Swords Dance, Fire Fang?"
- "What are the most popular moves and items for Garchomp in Gen 9 OU?"
- "Show me the top threats in Gen 9 OU"
- "What are common teammates for Garchomp?"
- "What Pokémon counter Garchomp effectively?"

## Usage Examples

PokéMCP exposes **7 tools**. The four basic tools run entirely on bundled Pokémon Showdown
data; `get_usage_stats`, `get_meta_trends`, and `query_strategy` read from Cloudflare KV/D1/
Vectorize and need the `env` bindings the Worker provides.

### Look Up a Pokémon

```
Tool: lookup_pokemon
Arguments: { "pokemon": "Garchomp" }
```

Returns detailed stats, abilities, tier information, and more.

### Validate a Moveset

```
Tool: validate_moveset
Arguments: {
  "pokemon": "Garchomp",
  "moves": ["Earthquake", "Dragon Claw", "Swords Dance", "Fire Fang"],
  "generation": "9"
}
```

Checks if Garchomp can legally learn all these moves in Generation 9.

### Validate a Team

```
Tool: validate_team
Arguments: {
  "team": [
    {
      "pokemon": "Garchomp",
      "moves": ["Earthquake", "Dragon Claw", "Swords Dance", "Fire Fang"],
      "ability": "Rough Skin",
      "item": "Focus Sash"
    },
    {
      "pokemon": "Ferrothorn",
      "moves": ["Stealth Rock", "Spikes", "Power Whip", "Gyro Ball"],
      "ability": "Iron Barbs"
    }
  ],
  "format": "gen9ou"
}
```

Validates the team against `gen9ou` rules (Species Clause, move/ability legality, team size).
Pass a Pokémon Champions regulation id (e.g. `"format": "champions-regmb"`) to route through the
dedicated regulation validator instead of the Showdown-format path.

### Analyze Team Coverage

```
Tool: suggest_team_coverage
Arguments: {
  "current_team": ["Garchomp", "Ferrothorn", "Rotom-Wash"],
  "format": "gen9ou"
}
```

Shows team weaknesses, resistances, and suggests types to add.

### Get Usage Statistics

```
Tool: get_usage_stats
Arguments: {
  "type": "checks_counters",
  "pokemon": "Garchomp",
  "format": "gen9ou",
  "limit": 10
}
```

One consolidated tool for all Smogon usage stats — set `type` to `popular_sets`, `meta_threats`,
`teammates`, `checks_counters`, or `metagame` to pick the view. `pokemon` is required for
`popular_sets`, `teammates`, and `checks_counters`; `format` defaults to `gen9ou`.

### Analyze Metagame Trends

```
Tool: get_meta_trends
Arguments: {
  "type": "shifts",
  "format": "champions-regmb",
  "window": 3
}
```

Reads the Cloudflare D1 usage-history store to show how a format moves over time. `type` is
`usage_trend` (needs `pokemon`), `shifts`, `momentum`, or `evolution_summary`. `format` defaults to
the newest Pokémon Champions regulation with published Smogon stats (currently `champions-regmb`).

### Query Strategy

```
Tool: query_strategy
Arguments: {
  "query": "How do I counter Kingambit in gen9ou?",
  "format": "gen9ou"
}
```

Semantic (RAG) search over Smogon strategy write-ups. Add `pokemon` and/or `sectionType`
(`overview`, `moveset`, `counters`, `teammates`) to filter results.

## Available Tools

<!-- AUTOGEN:TOOLS:BEGIN -->
| Tool | Description |
|------|-------------|
| `lookup_pokemon` | Look up Pokémon stats, types, abilities, and moves |
| `validate_moveset` | Check if a moveset is legal for a Pokémon |
| `validate_team` | Validate a team against format rules (Showdown formats and Pokémon Champions regulations) |
| `suggest_team_coverage` | Suggest Pokémon to improve team type coverage |
| `get_usage_stats` | Get Smogon competitive usage statistics |
| `get_meta_trends` | Analyze how a metagame evolves over time: a Pokémon's usage trend over months, format-wide shifts (risers/fallers/entrants/dropouts) between two dates, usage momentum, or an overall evolution summary. Tuned for VGC/doubles. |
| `query_strategy` | Search Smogon strategy guides with optional filters |
<!-- AUTOGEN:TOOLS:END -->

## Data Sources

- **Pokémon Data**: [Pokémon Showdown](https://github.com/smogon/pokemon-showdown) - Complete Pokédex, moves, abilities, and learnsets
- **Usage Statistics**: [Smogon University](https://www.smogon.com/stats/) - Real competitive battle data updated monthly, cached in Cloudflare KV (sharded per-Pokémon keys)
- **Metagame History**: Cloudflare D1 time-series database populated by `scripts/backfill-history.ts` / `scripts/append-history.ts`, powering `get_meta_trends`
- **Strategy Content**: Smogon strategy articles, chunked and embedded into Cloudflare Vectorize for `query_strategy`

## Development

```bash
# Install dependencies
bun install

# Run type checking
bun run type-check

# Start local development server
bun run dev

# Deploy to Cloudflare
bun run deploy
```

## Architecture

- **Cloudflare Workers**: Serverless compute for handling MCP requests
- **Cloudflare KV**: Distributed key-value storage for cached Smogon statistics and RAG documents
- **Cloudflare D1**: Time-series metagame usage history (`get_meta_trends`)
- **Cloudflare Vectorize**: Vector database for semantic strategy search (`query_strategy`)
- **Durable Objects**: Stateful coordination for MCP sessions and weekly RAG ingestion
- **Direct Imports**: Pokémon Showdown data bundled at build time for instant access

## Security

### CORS Policy

The API restricts cross-origin requests to known domains:
- `www.pokemcp.com`, `pokemcp.com` (Team Builder)
- `docs.pokemcp.com` (Documentation)
- `localhost:3000/3001` (Local development)

Requests from other origins will receive a 403 error.

### Rate Limiting

`/api/tools` enforces its own KV-backed limit of **30 requests per minute per IP** (keyed on
`CF-Connecting-IP`); requests over the limit get a `429` with `{"error": "Rate limited. Please try again later."}`.

For additional protection, you can also configure rate limiting in the Cloudflare dashboard:

1. Go to **Security → WAF → Rate limiting rules**
2. Create a rule for your Worker domain:
   - **Expression**: `(http.host eq "api.pokemcp.com")`
   - **Requests per minute**: 60 (adjust as needed)
   - **Action**: Block for 1 minute

For advanced rate limiting, consider [Cloudflare Rate Limiting](https://developers.cloudflare.com/waf/rate-limiting-rules/).

### Known Issues

The MCP server depends on `@modelcontextprotocol/sdk` which has known vulnerabilities (DNS rebinding, ReDoS). These are upstream issues that cannot be fixed locally. The vulnerabilities are low-risk for this use case:
- **DNS rebinding**: Only affects local development servers, not production Cloudflare Workers
- **ReDoS**: Requires malicious input to MCP protocol, mitigated by Cloudflare's request limits

Track upstream fixes: [MCP SDK Security Advisories](https://github.com/modelcontextprotocol/typescript-sdk/security)

### Best Practices

- Never commit `.env` or `.env.local` files (already in `.gitignore`)
- Rotate API keys if exposed
- Use Cloudflare's built-in DDoS protection for production

## License

[GNU Affero General Public License v3.0 (AGPL-3.0)](LICENSE)

## Contributing

Contributions welcome! Please feel free to submit a Pull Request. For major changes, please open an issue first to discuss what you would like to change.

## Acknowledgments

- [Pokémon Showdown](https://github.com/smogon/pokemon-showdown) for comprehensive Pokémon data
- [Smogon University](https://www.smogon.com/) for competitive battle statistics
- [Cloudflare Workers](https://workers.cloudflare.com/) for serverless deployment platform
