# Mode System Architecture

## Overview

Implement a two-level hierarchy: **Mode** (Singles vs VGC) determines the experience, **Format** (specific tier/regulation) is selected within each mode.

```
┌────────────────────────────────────────────────────────────┐
│  PokeMCP   [⚔️ Singles | 🏆 VGC]              [settings]   │
├────────────────────────────────────────────────────────────┤
│  Format: [Gen 9 OU ▼]                                      │  ← Only shows formats for current mode
└────────────────────────────────────────────────────────────┘
```

## Why Mode > Format Hierarchy?

1. **Different games**: Singles and VGC have fundamentally different team building philosophies
2. **Different data sources**: Smogon stats vs Pikalytics/Victory Road
3. **Different UI needs**: VGC needs "Bring 4" picker, speed tiers matter differently
4. **Reduced cognitive load**: Don't overwhelm users with 20+ format options at once
5. **Cleaner UX**: Mode is a big decision, format is a refinement

---

## State Architecture

### Option A: Derived Mode (Recommended for v1)

Mode is computed from format - minimal changes, leverages existing `isDoublesFormat()`.

```typescript
// stores/team-store.ts
interface TeamState {
  format: FormatId;
  team: TeamPokemon[];
  // ... existing fields
}

// Derived helper (not stored)
export function useMode() {
  const format = useTeamStore((s) => s.format);
  return isDoublesFormat(format) ? "vgc" : "singles";
}
```

**Pros**: Minimal store changes, single source of truth
**Cons**: Mode switch requires knowing a format to switch to

### Option B: Explicit Mode (Recommended for v2)

Mode is stored explicitly, format must be compatible.

```typescript
// stores/team-store.ts
type Mode = "singles" | "vgc";

interface TeamState {
  mode: Mode;
  format: FormatId;
  team: TeamPokemon[];

  setMode: (mode: Mode) => void; // Also sets default format for mode
  setFormat: (format: FormatId) => void; // Validates against current mode
}

const DEFAULT_FORMATS: Record<Mode, FormatId> = {
  singles: "gen9ou",
  vgc: "gen9vgc2024regh", // Should be dynamic - current regulation
};
```

**Pros**: Cleaner semantics, mode is first-class concept
**Cons**: More migration work, potential state inconsistency

---

## Component Changes

### 1. Header / Mode Toggle

**New component**: `ModeToggle.tsx`

```typescript
// components/layout/ModeToggle.tsx
export function ModeToggle() {
  const mode = useMode(); // or from store if Option B
  const setFormat = useTeamStore((s) => s.setFormat);
  const team = useTeamStore((s) => s.team);
  const [pendingMode, setPendingMode] = useState<Mode | null>(null);

  const handleModeChange = (newMode: Mode) => {
    if (team.length > 0) {
      setPendingMode(newMode); // Show confirmation
    } else {
      setFormat(DEFAULT_FORMATS[newMode]);
    }
  };

  return (
    <div className="flex rounded-lg border bg-muted p-1">
      <ModeButton
        mode="singles"
        icon={Swords}
        active={mode === "singles"}
        onClick={() => handleModeChange("singles")}
      />
      <ModeButton
        mode="vgc"
        icon={Trophy}
        active={mode === "vgc"}
        onClick={() => handleModeChange("vgc")}
      />
    </div>
  );
}
```

### 2. FormatSelector (Simplified)

Only shows formats for current mode:

```typescript
// components/layout/FormatSelector.tsx
export function FormatSelector() {
  const mode = useMode();
  const { format, setFormat } = useTeamStore();

  // Filter formats by mode
  const availableFormats = FORMATS.filter((f) => {
    if (mode === "vgc") {
      return f.category === "doubles"; // or isDoublesFormat(f.id)
    }
    return f.category !== "doubles"; // singles, gen8, gen7
  });

  // Group by generation/category
  const groupedFormats = groupFormatsByCategory(availableFormats, mode);

  return (
    <Select value={format} onValueChange={setFormat}>
      {/* Render grouped formats */}
    </Select>
  );
}
```

### 3. ThreatMatrix (Mode-Aware)

```typescript
// components/analysis/ThreatMatrix.tsx
export function ThreatMatrix() {
  const mode = useMode();
  const { team, format } = useTeamStore();

  // Different data source per mode
  const { data: threats } = mode === "vgc"
    ? useVGCMetaThreats(format)  // Future: Pikalytics data
    : useMetaThreats(format);    // Smogon data

  // Different visualization per mode
  if (mode === "vgc") {
    return (
      <VGCThreatMatrix
        team={team}
        threats={threats}
        // Show lead matchups, speed tiers, etc.
      />
    );
  }

  return (
    <SinglesThreatMatrix
      team={team}
      threats={threats}
      // Show individual matchups, hazard pressure, etc.
    />
  );
}
```

### 4. TeamGrid (VGC: Bring 4 Selector)

```typescript
// components/team/TeamGrid.tsx
export function TeamGrid() {
  const mode = useMode();
  const { team } = useTeamStore();
  const [selectedFour, setSelectedFour] = useState<number[]>([]);

  return (
    <div>
      {/* Always show 6 slots for team building */}
      <div className="grid grid-cols-3 gap-4">
        {[0, 1, 2, 3, 4, 5].map((slot) => (
          <TeamSlot key={slot} slot={slot} pokemon={team[slot]} />
        ))}
      </div>

      {/* VGC: Add "Bring 4" simulator */}
      {mode === "vgc" && team.length >= 4 && (
        <BringFourSelector
          team={team}
          selected={selectedFour}
          onSelect={setSelectedFour}
        />
      )}
    </div>
  );
}
```

### 5. AI Coach Context

```typescript
// lib/ai/context.ts
export function buildSystemPrompt(
  personalityId: PersonalityId,
  format: string,
  teamSize: number,
  mode: Mode // Add mode parameter
) {
  const personality = PERSONALITIES[personalityId];

  const modeContext = mode === "vgc"
    ? `You are coaching for VGC (Video Game Championships), the official Pokemon doubles format.
       Key VGC concepts:
       - Bring 6, pick 4 at team preview
       - Speed control is essential (Tailwind, Trick Room, Icy Wind)
       - Protect is mandatory on most Pokemon
       - Spread moves hit both opponents
       - Restricted Pokemon rules vary by regulation
       - Focus on lead combinations and back-line synergy`
    : `You are coaching for Smogon Singles, a fan-organized 6v6 format.
       Key Singles concepts:
       - Entry hazards (Stealth Rock, Spikes) are crucial
       - Pivoting with U-turn/Volt Switch maintains momentum
       - Recovery moves provide longevity
       - Status conditions (Toxic, Will-O-Wisp) wear down opponents
       - Team preview doesn't affect in-battle selection`;

  return `${personality.systemPrompt}\n\n${modeContext}\n\nCurrent format: ${format}`;
}
```

### 6. WelcomeOverlay (Mode-First Selection)

```typescript
// components/welcome/WelcomeOverlay.tsx
export function WelcomeOverlay() {
  const [step, setStep] = useState<"mode" | "action">("mode");
  const [selectedMode, setSelectedMode] = useState<Mode | null>(null);

  if (step === "mode") {
    return (
      <ModeSelection
        onSelect={(mode) => {
          setSelectedMode(mode);
          setStep("action");
        }}
      />
    );
  }

  // Then show Generate/Import/Build options
  // Archetypes are already filtered by format via getArchetypesForFormat()
}
```

---

## Data Layer Changes

### Current: Smogon Stats for Everything

```typescript
// lib/mcp-client.ts - current
async getMetaThreats(format?: string) {
  return this.callTool("get_meta_threats", { format });
}
```

### Future: Mode-Aware Data Sources

```typescript
// lib/data-sources/index.ts
interface DataSource {
  getMetaThreats(format: string): Promise<Threat[]>;
  getUsageStats(pokemon: string, format: string): Promise<UsageStats>;
  getSpeedTiers(format: string): Promise<SpeedTier[]>;
}

// lib/data-sources/smogon.ts
export const smogonDataSource: DataSource = {
  getMetaThreats: (format) => mcpClient.getMetaThreats(format),
  getUsageStats: (pokemon, format) => mcpClient.getPopularSets(pokemon, format),
  getSpeedTiers: () => { throw new Error("Not available for Smogon"); },
};

// lib/data-sources/pikalytics.ts (future)
export const pikalyticsDataSource: DataSource = {
  getMetaThreats: async (format) => {
    // Fetch from Pikalytics API
    const res = await fetch(`https://pikalytics.com/api/...`);
    return transformPikalyticsData(await res.json());
  },
  getSpeedTiers: async (format) => {
    // VGC-specific speed tier data
  },
};

// Hook that selects data source by mode
export function useDataSource() {
  const mode = useMode();
  return mode === "vgc" ? pikalyticsDataSource : smogonDataSource;
}
```

---

## Implementation Phases

### Phase 1: Mode Toggle + Filtered Formats (MVP)
- [ ] Add `ModeToggle` component to header
- [ ] Add `useMode()` hook (derived from format)
- [ ] Update `FormatSelector` to filter formats by mode
- [ ] Update default format logic when mode changes
- [ ] Add confirmation dialog for mode switch with existing team

**Estimated scope**: ~200 lines changed, 1 new component

### Phase 2: Mode-Aware UI Components
- [ ] `ThreatMatrix` shows mode-appropriate analysis
- [ ] `TeamGrid` adds "Bring 4" selector for VGC
- [ ] `TypeCoverage` highlights mode-relevant coverage
- [ ] AI prompts enhanced with mode context

**Estimated scope**: ~400 lines changed, 2-3 new components

### Phase 3: VGC-Specific Features
- [ ] Speed tier visualization
- [ ] Lead combination suggestions
- [ ] Damage calc integration
- [ ] Pikalytics data source (if API available)

**Estimated scope**: New feature modules, ~1000+ lines

### Phase 4: Polish & Advanced
- [ ] Mode-specific AI personalities (Wolfe Glick for VGC?)
- [ ] Tournament team import (Victory Road, RK9 Labs)
- [ ] Regulation auto-detection
- [ ] Team preview simulator with matchup predictions

---

## File Changes Summary

| File | Change Type | Description |
|------|-------------|-------------|
| `components/layout/ModeToggle.tsx` | **New** | Mode selector component |
| `components/layout/Header.tsx` | Modify | Add ModeToggle |
| `components/layout/FormatSelector.tsx` | Modify | Filter formats by mode |
| `stores/team-store.ts` | Modify | Add mode (Phase 1: derived, Phase 2: explicit) |
| `lib/ai/archetypes.ts` | Keep | Already has `isDoublesFormat()` |
| `types/pokemon.ts` | Modify | Add `Mode` type, format filtering helpers |
| `components/analysis/ThreatMatrix.tsx` | Modify | Mode-aware rendering |
| `components/team/TeamGrid.tsx` | Modify | Add Bring 4 for VGC |
| `components/team/BringFourSelector.tsx` | **New** | VGC team preview picker |
| `lib/ai/context.ts` | Modify | Mode-aware prompts |

---

## Questions to Resolve

1. **Pikalytics API access**: Is there a public API, or do we need to scrape/cache?
2. **VGC regulation updates**: How to auto-detect current regulation vs hardcoding?
3. **Cross-mode teams**: Should importing a Singles team in VGC mode warn/convert?
4. **Persistence**: Remember last mode per user, or always default to one?
5. **URL sharing**: Should shared team URLs encode mode, or derive from format?
