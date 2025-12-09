# Pokémon MCP Server

An MCP (Model Context Protocol) server for Pokémon team building and validation, powered by Pokémon Showdown data.

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

## Installation

1. Clone this repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Build the project:
   ```bash
   npm run build
   ```

## Configuration

Add this server to your MCP client configuration. For Claude Desktop, add to your `claude_desktop_config.json`:

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

## Available Tools

| Tool | Description |
|------|-------------|
| `lookup_pokemon` | Get detailed Pokémon information |
| `validate_moveset` | Check if a moveset is legal |
| `validate_team` | Validate team against format rules |
| `suggest_team_coverage` | Analyze team coverage and suggest improvements |

## Data Source

All Pokémon data comes from [Pokémon Showdown](https://github.com/smogon/pokemon-showdown), the most popular competitive Pokémon battle simulator.

## License

MIT

## Contributing

This is a learning project for building MCP servers. Feel free to fork and experiment!
