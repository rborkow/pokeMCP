# Pokémon MCP Server

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Deploy](https://github.com/rborkow/pokeMCP/actions/workflows/deploy-production.yml/badge.svg)](https://github.com/rborkow/pokeMCP/actions/workflows/deploy-production.yml)
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
Access real competitive data from thousands of battles with cached data for instant responses:
- **Popular Sets**: Most used moves, items, abilities, and EV spreads
- **Meta Threats**: Top Pokémon by usage percentage
- **Teammates**: Common team partners based on actual teams
- **Checks & Counters**: What beats your Pokémon (with KO rates)
- **Metagame Stats**: Overall format statistics and trends

**Supported Formats:**
- Gen 9: OU, Ubers, UU, RU, NU, PU, LC, VGC 2024 Reg F/H, Doubles OU
- Gen 8: OU, Ubers, UU, RU, NU, PU, LC
- Gen 7: OU, Ubers, UU, RU, NU, LC

*Note: VGC 2025/2026 formats automatically fall back to the most recent available data*

## Deployment

Deployed on Cloudflare Workers and Pages:

- **Team Builder**: https://www.pokemcp.com
- **MCP API**: https://api.pokemcp.com/mcp
- **Documentation**: https://docs.pokemcp.com

### Deploy Your Own

1. Install Wrangler CLI:
   ```bash
   npm install -g wrangler
   ```

2. Clone and setup:
   ```bash
   git clone https://github.com/rborkow/pokeMCP.git
   cd pokeMCP
   npm install
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
   npm run fetch-stats
   ```

6. Deploy:
   ```bash
   npm run deploy
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
- `VECTORIZE` - Vector database for semantic search
- `AI` - Cloudflare AI binding for embeddings

### Updating Cached Stats

Stats are cached in Cloudflare KV for instant access. To update:

1. Run the fetch script:
   ```bash
   npm run fetch-stats
   ```

2. Upload to KV (the namespace ID is in `wrangler.jsonc`):
   ```bash
   npx wrangler kv key put --remote --namespace-id=YOUR_NAMESPACE_ID "gen9ou" --path="src/cached-stats/gen9ou.json"
   # Repeat for other formats: gen9ubers, gen9uu, gen9ru, gen9nu, gen9pu, gen9lc, gen9vgc2024regf, gen9vgc2024regh
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

### Lookup a Pokémon

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
  "format": "OU"
}
```

Validates the team against OU format rules.

### Analyze Team Coverage

```
Tool: suggest_team_coverage
Arguments: {
  "current_team": ["Garchomp", "Ferrothorn", "Rotom-Wash"],
  "format": "OU"
}
```

Shows team weaknesses, resistances, and suggests types to add.

### Get Popular Sets

```
Tool: get_popular_sets
Arguments: {
  "pokemon": "Garchomp",
  "format": "gen9ou"
}
```

Returns the most popular moves, items, abilities, and EV spreads from real competitive play.

### Check Meta Threats

```
Tool: get_meta_threats
Arguments: {
  "format": "gen9ou",
  "limit": 20
}
```

Shows the top 20 most used Pokémon in the format with usage percentages.

### Find Teammates

```
Tool: get_teammates
Arguments: {
  "pokemon": "Garchomp",
  "format": "gen9ou"
}
```

Discovers which Pokémon are commonly paired with Garchomp on teams.

### Identify Checks & Counters

```
Tool: get_checks_counters
Arguments: {
  "pokemon": "Garchomp",
  "format": "gen9ou"
}
```

Shows which Pokémon are most effective against Garchomp with battle statistics.

### View Metagame Stats

```
Tool: get_metagame_stats
Arguments: {
  "format": "gen9ou"
}
```

Overall format statistics including total battles and top Pokémon.

## Available Tools

| Tool | Description |
|------|-------------|
| **Basic Tools** | |
| `lookup_pokemon` | Get detailed Pokémon information |
| `validate_moveset` | Check if a moveset is legal |
| `validate_team` | Validate team against format rules |
| `suggest_team_coverage` | Analyze team coverage and suggest improvements |
| **Usage Stats Tools** | |
| `get_popular_sets` | Get most used moves/items/abilities from competitive play |
| `get_meta_threats` | See top Pokémon by usage percentage |
| `get_teammates` | Find common team partners |
| `get_checks_counters` | Identify effective counters with battle stats |
| `get_metagame_stats` | View overall format statistics |

## Data Sources

- **Pokémon Data**: [Pokémon Showdown](https://github.com/smogon/pokemon-showdown) - Complete Pokédex, moves, abilities, and learnsets
- **Usage Statistics**: [Smogon University](https://www.smogon.com/stats/) - Real competitive battle data updated monthly, cached in Cloudflare KV

## Development

```bash
# Install dependencies
npm install

# Run type checking
npm run type-check

# Start local development server
npm run dev

# Deploy to Cloudflare
npm run deploy
```

## Architecture

- **Cloudflare Workers**: Serverless compute for handling MCP requests
- **Cloudflare KV**: Distributed key-value storage for cached Smogon statistics
- **Durable Objects**: Stateful coordination for MCP sessions
- **Direct Imports**: Pokémon Showdown data bundled at build time for instant access

## Security

### CORS Policy

The API restricts cross-origin requests to known domains:
- `www.pokemcp.com`, `pokemcp.com` (Team Builder)
- `docs.pokemcp.com` (Documentation)
- `localhost:3000/3001` (Local development)

Requests from other origins will receive a 403 error.

### Rate Limiting

Configure rate limiting in the Cloudflare dashboard:

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

MIT

## Contributing

Contributions welcome! Please feel free to submit a Pull Request. For major changes, please open an issue first to discuss what you would like to change.

## Acknowledgments

- [Pokémon Showdown](https://github.com/smogon/pokemon-showdown) for comprehensive Pokémon data
- [Smogon University](https://www.smogon.com/) for competitive battle statistics
- [Cloudflare Workers](https://workers.cloudflare.com/) for serverless deployment platform
