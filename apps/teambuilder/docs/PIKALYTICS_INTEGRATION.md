# Pikalytics Integration - Future Planning

## Why Pikalytics?

Currently the MCP server uses Smogon usage statistics. While excellent for Singles formats, VGC players primarily use **Pikalytics** for:

1. **VGC-specific data** - Smogon stats are derived from ladder play; Pikalytics tracks tournament results
2. **Partner analysis** - What Pokemon are commonly paired together
3. **Spread analysis** - Common EV spreads optimized for VGC damage calcs
4. **Regional differences** - Data from different tournament circuits

## Current State

- MCP server fetches from `smogon.com/stats/`
- Stats cached in Cloudflare KV (`POKEMON_STATS` namespace)
- Refresh schedule: Monthly via GitHub Action

## Integration Approaches

### Option 1: Dual Data Source

Keep Smogon for Singles, add Pikalytics for VGC:

```typescript
// stats.ts
async function getUsageStats(format: string): Promise<UsageStats> {
  if (isVGCFormat(format)) {
    return fetchPikalyticsStats(format);
  }
  return fetchSmogonStats(format);
}
```

**Pros:**
- Best of both worlds
- Accurate data for each community

**Cons:**
- Two codepaths to maintain
- Pikalytics API access/terms unclear

### Option 2: Pikalytics API Integration

Pikalytics has a public-facing website. Options:

1. **Scraping** (Not recommended)
   - Fragile, could break
   - May violate ToS

2. **Official API** (If available)
   - Need to check if they offer API access
   - May require partnership/attribution

3. **Community Data Sources**
   - VGC community often shares data
   - Could aggregate from multiple sources

### Option 3: Build Our Own VGC Stats

Aggregate from:
- Pokemon Showdown VGC ladder replays
- Official tournament results (Victory Road, etc.)
- Community-submitted teams

## Data We'd Want from Pikalytics

```typescript
interface PikalyticsData {
  pokemon: string;
  usage: number;          // % of teams
  winRate?: number;       // Tournament win rate

  // Top items/abilities/moves
  items: { name: string; usage: number }[];
  abilities: { name: string; usage: number }[];
  moves: { name: string; usage: number }[];

  // VGC-specific
  teraTypes: { type: string; usage: number }[];
  evSpreads: {
    spread: string;  // "252 HP / 4 Def / 252 SpD"
    nature: string;
    usage: number;
  }[];

  // Partner data (critical for VGC)
  teammates: {
    pokemon: string;
    usage: number;  // % of teams with both
  }[];

  // Speed tier info
  commonSpeedBenchmarks: {
    description: string;  // "Outspeeds max speed Garchomp"
    speed: number;
  }[];
}
```

## Research Findings (January 2026)

### Pikalytics Access Status

**No public API available.** Investigation found:
- No documented API endpoints
- Website uses JavaScript-rendered content (not easily scrapeable)
- SSL/TLS issues when attempting programmatic access
- Contact email available (pikalytics@gmail.com) for partnership inquiries

### Current Data Availability
Pikalytics covers:
- VGC 2026 Regulation F (current) - both base and Best-of-3 variants
- VGC 2025 Regulations G-J (legacy)
- Historical VGC formats back to Gen 4
- Battle Stadium formats

**URL Structure:**
- Base: `https://pikalytics.com/pokedex/gen9vgc2026regf`
- Bo3: `https://pikalytics.com/pokedex/gen9vgc2026regfbo3`

### Recommendation
**Use enhanced Smogon VGC data** as primary source:
- Already have VGC format data (gen9vgc2024regh, gen9vgc2025regi, etc.)
- Includes abilities, items, moves, spreads, teammates
- Updates monthly via existing pipeline

Consider reaching out to Pikalytics team if:
- User demand is high for tournament-specific data
- We want to add win rate analysis
- Partnership/attribution deal possible

## Implementation Roadmap

### Phase 1: Research ✅ COMPLETE
- [x] Check Pikalytics ToS - No public API
- [x] Look for official API documentation - None found
- [x] Explore alternative VGC data sources - Smogon VGC is viable
- [ ] Consider reaching out to Pikalytics team - Deferred

### Phase 2: Data Schema
- [ ] Design unified stats interface that works for both sources
- [ ] Add VGC-specific fields (teammates, tera types)
- [ ] Update MCP server types

### Phase 3: Backend Integration
- [ ] Add Pikalytics fetch/cache layer
- [ ] Update KV storage for VGC data
- [ ] Add format-aware data routing

### Phase 4: Frontend Updates
- [ ] Update threat matrix for VGC data
- [ ] Add teammate suggestions
- [ ] Show VGC-specific spreads

## Alternative: Enhanced Smogon VGC Data

Smogon does have VGC format stats (gen9vgc2024regh, etc.). We could:

1. Prioritize VGC-specific data from Smogon stats
2. Extract teammate data from check/counter analysis
3. Use moveset data for spread recommendations

This is lower effort but may be less accurate than Pikalytics.

## Resources

- Pikalytics: https://pikalytics.com
- Smogon Stats: https://www.smogon.com/stats/
- Victory Road (VGC news): https://victoryroadvgc.com
- VGC Stats Twitter accounts

## Decision Needed

Before implementing:
1. Confirm Pikalytics data access is feasible/legal
2. Decide on data refresh frequency for VGC (tournaments update weekly)
3. Consider attribution requirements

---

**Status: PLANNING**
**Priority: Medium** (Current Smogon VGC stats work, but Pikalytics would be better)
**Effort: High** (New data source, caching, API changes)
