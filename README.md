# Pokémon MCP Server

An MCP (Model Context Protocol) server for Pokémon team building and validation, powered by Pokémon Showdown data and Smogon usage statistics.

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

### 📊 Smogon Usage Statistics (NEW!)
Access real competitive data from thousands of battles:
- **Popular Sets**: Most used moves, items, abilities, and EV spreads
- **Meta Threats**: Top Pokémon by usage percentage
- **Teammates**: Common team partners based on actual teams
- **Checks & Counters**: What beats your Pokémon (with KO rates)
- **Metagame Stats**: Overall format statistics and trends

## Installation

### Option 1: From Source (Development)

1. Clone this repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Build the project:
   ```bash
   npm run build
   ```

### Option 2: NPM Package (Coming Soon)

```bash
npm install -g pokemon-mcp-server
```

### Option 3: Docker

```bash
docker pull rborkow/pokemon-mcp-server
```

## Configuration

Add this server to your MCP client configuration. For Claude Desktop, add to your `claude_desktop_config.json`:

**From Source:**
```json
{
  "mcpServers": {
    "pokemon": {
      "command": "node",
      "args": ["/path/to/pokeMCP/build/index.js"]
    }
  }
}
```

**From NPM:**
```json
{
  "mcpServers": {
    "pokemon": {
      "command": "pokemon-mcp"
    }
  }
}
```

**From Docker:**
```json
{
  "mcpServers": {
    "pokemon": {
      "command": "docker",
      "args": ["run", "-i", "--rm", "rborkow/pokemon-mcp-server"]
    }
  }
}
```

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
- **Usage Statistics**: [Smogon University](https://www.smogon.com/stats/) - Real competitive battle data updated monthly

## Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md) for detailed instructions on:
- Publishing to NPM
- Building Docker containers
- Creating GitHub releases
- Distributing binaries

## Roadmap

- [ ] Publish to NPM registry
- [ ] Add caching for Smogon stats
- [ ] Support for VGC formats
- [ ] Battle simulator integration
- [ ] Team import/export (Showdown format)
- [ ] Damage calculator
- [ ] Speed tier checker

## License

MIT

## Contributing

Contributions welcome! Please feel free to submit a Pull Request. For major changes, please open an issue first to discuss what you would like to change.

## Acknowledgments

- [Pokémon Showdown](https://github.com/smogon/pokemon-showdown) for comprehensive Pokémon data
- [Smogon University](https://www.smogon.com/) for competitive battle statistics
- [@pkmn](https://github.com/pkmn) for excellent Pokémon tooling and APIs
