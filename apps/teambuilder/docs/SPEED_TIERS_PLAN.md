# Speed Tiers Feature Plan

## Overview
VGC players need to know speed relationships to make team preview decisions and in-battle plays. This feature would calculate and display speed tiers for a team.

## MVP Requirements

### Data Needed
- Base Speed stats (already in pokemon data)
- EV/IV/Nature calculations (already parsing EVs/nature from team)
- Common speed benchmarks for the format

### Speed Calculation Formula
```
finalSpeed = floor((floor((2 * baseSpe + IV + floor(EV/4)) * level / 100) + 5) * natureModifier)
```
- Level 50 for VGC
- Nature modifier: 1.1 (positive), 1.0 (neutral), 0.9 (negative)

### Display Features

1. **Speed Stat Column in Team Display**
   - Show calculated speed stat next to each Pokemon
   - Color-code: Fast (green), Medium (yellow), Slow (red)

2. **Speed Tier Card (New Analysis Tab)**
   - List team Pokemon sorted by speed
   - Show speed benchmarks from meta (e.g., "outspeeds max speed Garchomp")
   - Speed under modifiers:
     - After Tailwind (×2)
     - Under Trick Room (priority based)
     - After Icy Wind (-1 stage = ×0.67)
     - With Choice Scarf (×1.5)

3. **Speed Comparison Matrix**
   - Your team vs common meta threats
   - Show who outspeeds who at neutral
   - Highlight potential speed ties

### Implementation Phases

**Phase 1: Basic Speed Display**
```typescript
// lib/speed-calc.ts
function calculateSpeed(pokemon: TeamPokemon): number {
  const baseSpeed = getPokemonBaseStats(pokemon.pokemon).spe;
  const speedEV = pokemon.evs?.spe ?? 0;
  const speedIV = pokemon.ivs?.spe ?? 31;
  const level = pokemon.level ?? 50;
  const natureModifier = getNatureModifier(pokemon.nature, "spe");

  return Math.floor(
    (Math.floor((2 * baseSpeed + speedIV + Math.floor(speedEV / 4)) * level / 100) + 5)
    * natureModifier
  );
}
```

**Phase 2: Speed Modifiers**
```typescript
function getSpeedWithModifiers(speed: number, modifiers: SpeedModifiers): SpeedInfo {
  return {
    base: speed,
    tailwind: speed * 2,
    scarf: Math.floor(speed * 1.5),
    paralyzed: Math.floor(speed * 0.5),
    icyWind: Math.floor(speed * 0.67), // -1 stage
    trickRoom: speed, // just flag it
  };
}
```

**Phase 3: Meta Benchmarks**
- Pull common Pokemon speeds from format usage data
- Create benchmark tiers: "outspeeds uninvested base 100s", "outspeeds max Landorus", etc.

### UI Component Structure
```
<SpeedTiers>
  <SpeedHeader />  // "Your Team Speed Tiers"
  <SpeedList>
    {sortedTeam.map(pokemon => (
      <SpeedRow
        pokemon={pokemon}
        speed={calculateSpeed(pokemon)}
        modifiers={getSpeedWithModifiers(...)}
        benchmarks={getSpeedBenchmarks(format)}
      />
    ))}
  </SpeedList>
  <SpeedLegend />  // Explain Tailwind, TR, etc.
</SpeedTiers>
```

### Data Requirements
- Need base stats access (currently available via pokemon-types.ts pattern)
- May need to expand `getPokemonBaseStats()` function

### Estimated Effort
- Phase 1 (basic): ~2-3 hours
- Phase 2 (modifiers): ~1-2 hours
- Phase 3 (benchmarks): ~2-3 hours

### Dependencies
- Base stat data for all Pokemon
- Nature effect calculations
- Format-specific usage data for benchmarks

## Future Enhancements
- Speed creeping suggestions ("if you add 4 more EVs, you outspeed X")
- Tailwind vs Trick Room matchup simulator
- Import opponent's team preview for head-to-head comparison
