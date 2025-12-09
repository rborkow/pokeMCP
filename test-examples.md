# Test Examples

Use these examples to test the Pokémon MCP server:

## Example 1: Lookup Garchomp

```json
{
  "pokemon": "Garchomp"
}
```

Expected: Stats, abilities (Sand Veil, Rough Skin), tier info (OU)

## Example 2: Validate Dragon Dance Garchomp

```json
{
  "pokemon": "Garchomp",
  "moves": ["Earthquake", "Dragon Claw", "Swords Dance", "Fire Fang"],
  "generation": "9"
}
```

Expected: All moves should be legal

## Example 3: Invalid Moveset

```json
{
  "pokemon": "Garchomp",
  "moves": ["Earthquake", "Dragon Claw", "Flamethrower", "Ice Beam"]
}
```

Expected: Flamethrower and Ice Beam should be flagged as illegal (Garchomp can't learn them)

## Example 4: Validate OU Team

```json
{
  "team": [
    {
      "pokemon": "Garchomp",
      "moves": ["Earthquake", "Dragon Claw", "Swords Dance", "Fire Fang"],
      "ability": "Rough Skin"
    },
    {
      "pokemon": "Ferrothorn",
      "moves": ["Stealth Rock", "Spikes", "Power Whip", "Gyro Ball"],
      "ability": "Iron Barbs"
    },
    {
      "pokemon": "Rotom-Wash",
      "moves": ["Volt Switch", "Hydro Pump", "Will-O-Wisp", "Thunderbolt"],
      "ability": "Levitate"
    }
  ],
  "format": "OU"
}
```

Expected: Valid team

## Example 5: Species Clause Violation

```json
{
  "team": [
    {
      "pokemon": "Garchomp",
      "moves": ["Earthquake", "Dragon Claw", "Swords Dance", "Fire Fang"],
      "ability": "Rough Skin"
    },
    {
      "pokemon": "Garchomp",
      "moves": ["Earthquake", "Outrage", "Stone Edge", "Fire Blast"],
      "ability": "Sand Veil"
    }
  ],
  "format": "OU"
}
```

Expected: Species Clause violation (duplicate Garchomp)

## Example 6: Team Coverage Analysis

```json
{
  "current_team": ["Garchomp", "Ferrothorn", "Rotom-Wash", "Toxapex"],
  "format": "OU"
}
```

Expected: Analysis showing team is weak to Ground, Fire, and Fighting types
