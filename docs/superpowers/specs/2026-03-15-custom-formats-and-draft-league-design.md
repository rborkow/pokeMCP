# Custom Formats & Draft League Advisory

**Date:** 2026-03-15
**Status:** Approved

## Problem

Users are attempting to use the teambuilder for two unsupported use cases:

1. **Custom formats** — novel rulesets like Monotype, no-items, custom banlists. Currently, formats are fully hardcoded in both the MCP server and the teambuilder UI.
2. **Draft league planning** — "I drafted these 12 Pokemon, help me build a team of 6 for this week's matchup." No concept of a draft pool exists today.

## Decisions

- **Custom formats:** Structured rule toggles with soft validation (warnings, not hard blocks). Shareable via URL. Preset templates for popular community formats.
- **Draft league:** Advisory overlay on existing Singles mode, not a third mode. User enters their pool, AI constrains suggestions to it.
- **Gimmicks:** Tied to base generation for now. Cross-gen mixing (Megas + Tera) is a future extension.
- **Enforcement level:** Soft validation — amber warnings when rules are violated, never hard blocks.
- **Sharing:** Custom format rules encoded as compact base64 in URL params, extending the existing `share.ts` pattern.

---

## Feature 1: Custom Formats

### Overview

A "Custom Format..." option in the format selector opens a Format Builder Dialog with structured rule toggles. Popular community formats (Monotype, Anything Goes, 1v1) are available as preset templates. The AI respects custom rules via an injected system prompt block, and soft validation warns when teams violate rules.

### Data Model

```typescript
// apps/teambuilder/src/types/custom-format.ts

interface CustomFormat {
    id: string;                    // Generated UUID for local storage
    name: string;                  // User-given name, e.g. "Fire Monotype"
    baseGen: 7 | 8 | 9;           // Determines gimmick rules + stats fallback
    baseFormat: string;            // Stats fallback format, e.g. "gen9ou"
    battleType: "singles" | "doubles";

    rules: {
        // Type restrictions
        typeRestriction?: {
            mode: "monotype" | "include" | "exclude";
            types: string[];       // e.g. ["Fire"] for monotype
        };

        // Banlists
        bannedPokemon: string[];
        bannedMoves: string[];
        bannedItems: string[];
        bannedAbilities: string[];

        // Clause toggles (defaults match standard OU)
        clauses: {
            speciesClause: boolean;     // Default true
            sleepClause: boolean;       // Default true
            evasionClause: boolean;     // Default true
            ohkoClause: boolean;        // Default true
            moodyClause: boolean;       // Default true
            dynamaxClause: boolean;     // Default true for gen8 singles
            teraTypeClause: boolean;    // Limit one Tera type per team
        };

        // Team composition
        teamSize: number;           // 1-6, default 6
        levelCap?: number;          // e.g. 5 for LC, 50 for VGC

        // Gimmick toggles (defaults derived from baseGen)
        gimmicks: {
            terastallization: boolean;  // Gen 9 default on
            dynamax: boolean;           // Gen 8 default off for singles
            megaEvolution: boolean;     // Gen 7
            zMoves: boolean;            // Gen 7
        };

        // Item restrictions
        itemClause: boolean;        // No duplicate items
        noItems: boolean;           // No held items at all
    };
}
```

### Preset Templates

Seed the Format Builder with common community formats:

| Preset | Base | Key Rules |
|--------|------|-----------|
| Monotype | Gen 9 OU | `typeRestriction: monotype`, user picks type |
| Anything Goes | Gen 9 AG | All clauses off, no bans |
| 1v1 | Gen 9 1v1 | `teamSize: 3` (build up to 3 Pokemon) |
| Draft League | Gen 9 OU | Species Clause on, standard clauses |
| Little Cup | Gen 9 LC | `levelCap: 5` |

### URL Sharing

Encode only non-default rule values as JSON, then base64 URL-safe encode. This extends the existing `share.ts` pattern:

```
Current:  ?team={base64-team}          (format embedded in team blob as prefix)
Extended: ?team={base64-team}&fmt={base64-custom-format}
```

When a custom format is active, the team blob's embedded format prefix uses the `baseFormat` string (e.g. "gen9ou") so that `decodeTeamFromUrl` can still parse the team without custom format support. The `fmt` param is the custom format definition (non-default values only). If `fmt` is present, it takes precedence over the embedded format. If `fmt` is absent, the URL represents a standard format team as before — fully backward compatible.

A typical custom format encodes to ~40-80 characters. Full format definitions (with long banlists) stay under 500 characters.

### AI Integration

When a custom format is active, inject a structured block into `buildSystemPrompt()`:

```
CUSTOM FORMAT RULES (User-Defined):
- Name: Fire Monotype
- Base: Gen 9, Singles
- Type Restriction: Monotype Fire — ALL Pokemon must be Fire type
- Banned Pokemon: Heatran, Volcarona
- Banned Moves: None
- Clauses: Species Clause ON, Sleep Clause ON
- Gimmicks: Terastallization ON
- Team Size: 6

IMPORTANT: Respect ALL custom rules above. Custom rules take priority over
standard format rules. Warn the user if their request conflicts with these
rules but still fulfill it.
```

Gimmick guidance derives from `baseGen`. The existing `getGimmickGuidance()` function parses generation from a format string via regex and also checks for "vgc"/"doubles" substrings, so it needs to be refactored to accept a `{ gen: number, battleType: string }` config object (or a new `getGimmickGuidanceForCustomFormat(customFormat)` wrapper). This is a required change in `context.ts`.

`buildSystemPrompt()` currently accepts `(personalityId, format, teamSize, mode)`. Add an optional `customFormat?: CustomFormat` parameter. When present, the custom format rules block is injected into the system prompt (which is cacheable via the existing `cache_control: { type: "ephemeral" }` pattern at the API route level). The `format` param should receive `customFormat.baseFormat` for stats fetching purposes.

Stats fall back to `baseFormat` (e.g. `gen9ou`) with a disclaimer to the AI: "Stats are from Gen 9 OU since this is a custom format — usage data may not perfectly reflect this ruleset."

### Soft Validation

A `validateCustomFormat(team, customFormat)` function checks:

- Type restriction compliance (all Pokemon match required type)
- Banned Pokemon/moves/items/abilities not present
- Team size within limit
- Level cap respected
- Item clause (no duplicates) if enabled
- Gimmick usage matches toggles (e.g. no Tera Type set if Tera is off)

Returns an array of `FormatWarning` objects reusing the same shape as the existing `VGCTeamWarning` interface from `vgc-analysis.ts` (`level`, `message`, `pokemon?`, `suggestion?`). This enables Phase 3's unified `TeamWarnings` component to render both VGC and custom format warnings with the same component. Displayed as amber banners following the existing VGC warning pattern.

### UI Flow

1. `FormatSelector` dropdown gains a divider + "Custom Format..." option at bottom
2. Opens `CustomFormatDialog` — a multi-section dialog:
   - Name input + Base Gen selector + Battle Type toggle
   - Collapsible sections: Type Restrictions, Banlists, Clauses, Gimmicks, Team Composition
   - "Load Preset" button in top-right for templates
3. On save, `customFormat` is stored in Zustand alongside the team
4. `FormatSelector` button shows the custom format name instead of a standard format
5. Warnings render below the team grid

---

## Feature 2: Draft League Advisory

### Overview

A draft pool overlay that layers on top of the existing team builder. Users enter their drafted Pokemon pool (and optionally their opponent's pool), and the AI constrains all suggestions to that pool. No draft pool management, pick/ban tracking, or point budgets — purely advisory.

### Data Model

```typescript
// apps/teambuilder/src/stores/draft-store.ts

interface DraftPool {
    myPool: string[];           // Pokemon species names (up to ~15)
    opponentPool?: string[];    // Optional opponent's pool
    format: string;             // Standard format ID (e.g. "gen9ou") for stats
    customFormat?: CustomFormat; // Optional custom format (overrides format for rules)
    notes?: string;             // Optional matchup notes
}
// When customFormat is set, use customFormat.baseFormat for stats queries
// and customFormat.rules for validation. When absent, use format directly.
```

Stored in a separate Zustand store with localStorage persistence.

### UI Flow

1. Welcome Overlay gains a fourth option card: "Draft League" with a `Users` icon (alongside Generate, Import, Build Your Own). This sets a `isDraftMode: true` flag in the draft store — it does NOT add a new `Mode` value.
2. Clicking it opens `DraftPoolSetup` — a pool entry screen:
   - Textarea for "My Pool" (one Pokemon per line or comma-separated)
   - Each name validated against the Pokedex with inline warnings for typos
   - Toggle to show "Opponent's Pool" textarea
   - Format selector (defaults to Gen 9 OU, can use a custom format)
3. After entering pools, the main team builder opens with a collapsible `DraftPoolBanner`:
   - Shows pool as clickable chips
   - Color-coded: grey (available), green (on team)
   - If opponent pool is set, second row shows their Pokemon
4. Normal chat interaction — AI is constrained to the pool
5. Pool can be edited/cleared via the banner

### AI Integration

When a draft pool is active, inject into the system prompt:

```
DRAFT LEAGUE MODE:
Your draft pool (ONLY suggest Pokemon from this list):
- Garchomp
- Landorus-Therian
- Heatran
- Rotom-Wash
- Rillaboom
- Urshifu-Rapid-Strike
- Kingambit
- Iron Valiant
- Clefable
- Toxapex
- Corviknight
- Dragapult

Opponent's pool (build to counter these threats):
- Gholdengo
- Great Tusk
- Iron Bundle
- ...

CRITICAL CONSTRAINT: Every Pokemon you suggest MUST come from the draft pool
above. If the user asks for a Pokemon not in their pool, explain that it's
not available and suggest the closest alternative from their pool.

When building a team of 6, consider:
1. Which of your Pokemon best counter the opponent's threats?
2. What coverage holes does the opponent have that you can exploit?
3. Build for the specific matchup, not general metagame strength
```

### Soft Validation

When the team is built, validate that all members are in `myPool`. Violations show as amber warnings using the same `CustomFormatWarnings` component pattern. This catches edge cases where the AI suggests something off-pool or the user manually adds a Pokemon.

---

## Feature Overlap

Draft leagues and custom formats compose naturally:

1. **Draft League preset:** One of the preset templates in the Format Builder is "Draft League" with standard OU-ish defaults.
2. **Custom format on draft pools:** The `DraftPool.format` field can reference a `CustomFormat` ID. When active, the AI receives both pool constraints and custom format rules.
3. **Shared validation UI:** Both features use the same warning display pattern. A unified `TeamWarnings` component renders warnings from custom format rules and draft pool violations together.

---

## Implementation Phases

### Phase 1: Custom Formats

**New files:**
- `apps/teambuilder/src/types/custom-format.ts` — CustomFormat interface, preset templates, encode/decode
- `apps/teambuilder/src/components/layout/CustomFormatDialog.tsx` — Format builder dialog
- `apps/teambuilder/src/lib/validation/custom-format.ts` — Soft validation logic
- `apps/teambuilder/src/components/team/CustomFormatWarnings.tsx` — Warning display

**Modified files:**
- `apps/teambuilder/src/stores/team-store.ts` — Add `customFormat: CustomFormat | null` to state + persistence
- `apps/teambuilder/src/types/pokemon.ts` — Extend `FormatDefinition` and helper functions (`getFormatDisplayName` to handle custom formats). `Mode` type unchanged.
- `apps/teambuilder/src/components/layout/FormatSelector.tsx` — Add "Custom Format..." entry
- `apps/teambuilder/src/lib/ai/context.ts` — Inject custom format rules into system prompt
- `apps/teambuilder/src/lib/share.ts` — Extend URL encoding for custom formats
- `apps/teambuilder/src/app/api/ai/claude/stream/route.ts` — Add `customFormat` to request body destructuring, pass to `buildSystemPrompt()`, use `customFormat.baseFormat` for stats/MCP queries

### Phase 2: Draft League Advisory

**New files:**
- `apps/teambuilder/src/stores/draft-store.ts` — DraftPool state + persistence
- `apps/teambuilder/src/components/draft/DraftPoolInput.tsx` — Pool entry form
- `apps/teambuilder/src/components/draft/DraftPoolBanner.tsx` — Collapsible chip display
- `apps/teambuilder/src/components/draft/DraftPoolSetup.tsx` — Setup screen

**Modified files:**
- `apps/teambuilder/src/lib/ai/context.ts` — Add buildDraftPoolContext()
- `apps/teambuilder/src/components/welcome/WelcomeOverlay.tsx` — Add "Draft League" card
- `apps/teambuilder/src/app/page.tsx` — Render DraftPoolBanner
- `apps/teambuilder/src/app/api/ai/claude/stream/route.ts` — Accept draftPool in request body

### Phase 3: Integration & Polish

- Connect draft pool format field to custom formats
- Unified TeamWarnings component
- Unit tests for validation, encoding, prompt building
- Mobile responsiveness for new dialogs

---

## Out of Scope (Future)

- Cross-gen gimmick mixing (Megas + Tera in same format)
- Full draft pool management (pick/ban phases, point budgets, season tracking)
- Server-side custom format storage (short-code sharing via KV)
- Custom format discovery/browsing (community format library)
- Hard validation (blocking illegal teams rather than warning)
