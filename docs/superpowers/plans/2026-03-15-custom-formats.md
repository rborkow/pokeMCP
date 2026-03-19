# Custom Formats Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add structured custom format support to the teambuilder with rule toggles, preset templates, soft validation, URL sharing, and AI awareness.

**Architecture:** A `CustomFormat` type defines rule primitives (banlists, clauses, gimmick toggles, type restrictions). The team store gains an optional `customFormat` field. The AI system prompt receives custom rules as a structured block. Soft validation warns (never blocks) when teams violate rules. URL sharing encodes custom format as a separate `&fmt=` param.

**Tech Stack:** TypeScript, React, Zustand, shadcn/ui (Dialog, Tabs, Switch, Input), Vitest, Tailwind CSS 4

**Spec:** `docs/superpowers/specs/2026-03-15-custom-formats-and-draft-league-design.md`

---

## File Structure

| File | Responsibility |
|------|---------------|
| `src/types/custom-format.ts` | CustomFormat interface, default rules, preset templates, encode/decode helpers |
| `src/lib/validation/custom-format.ts` | Soft validation: check team against custom rules, return FormatWarning[] |
| `src/lib/ai/context.ts` (modify) | Inject custom format rules into system prompt, refactor getGimmickGuidance |
| `src/stores/team-store.ts` (modify) | Add `customFormat` to state + persistence + actions |
| `src/lib/share.ts` (modify) | Encode/decode custom format in URL `&fmt=` param |
| `src/lib/ai/index.ts` (modify) | Pass `customFormat` through to API route |
| `src/app/api/ai/claude/stream/route.ts` (modify) | Accept `customFormat`, pass to prompt building, use baseFormat for stats |
| `src/types/pokemon.ts` (modify) | Extend `getFormatDisplayName` to handle custom format names |
| `src/components/layout/FormatSelector.tsx` (modify) | Add "Custom Format..." entry, show custom format name when active |
| `src/components/layout/CustomFormatDialog.tsx` | Format builder dialog with rule sections |
| `src/components/team/CustomFormatWarnings.tsx` | Render soft validation warnings |

All paths relative to `apps/teambuilder/`.

---

## Prerequisites

Before starting any tasks, install required shadcn components:

```bash
cd apps/teambuilder && npx shadcn@latest add switch label separator
```

---

## Chunk 1: Data Model, Defaults, Presets, Encoding

### Task 1: CustomFormat type and defaults

**Files:**
- Create: `apps/teambuilder/src/types/custom-format.ts`
- Test: `apps/teambuilder/src/__tests__/custom-format.test.ts`

- [ ] **Step 1: Write the test file for CustomFormat defaults**

```typescript
// apps/teambuilder/src/__tests__/custom-format.test.ts
import { describe, it, expect } from "vitest";
import {
    type CustomFormat,
    createDefaultRules,
    createCustomFormat,
    CUSTOM_FORMAT_PRESETS,
} from "@/types/custom-format";

describe("CustomFormat", () => {
    describe("createDefaultRules", () => {
        it("returns standard OU defaults for gen 9 singles", () => {
            const rules = createDefaultRules(9, "singles");
            expect(rules.clauses.speciesClause).toBe(true);
            expect(rules.clauses.sleepClause).toBe(true);
            expect(rules.gimmicks.terastallization).toBe(true);
            expect(rules.gimmicks.dynamax).toBe(false);
            expect(rules.gimmicks.megaEvolution).toBe(false);
            expect(rules.gimmicks.zMoves).toBe(false);
            expect(rules.teamSize).toBe(6);
            expect(rules.bannedPokemon).toEqual([]);
        });

        it("enables dynamax for gen 8 doubles", () => {
            const rules = createDefaultRules(8, "doubles");
            expect(rules.gimmicks.dynamax).toBe(true);
            expect(rules.gimmicks.terastallization).toBe(false);
            expect(rules.clauses.dynamaxClause).toBe(false);
        });

        it("enables mega evolution and z-moves for gen 7", () => {
            const rules = createDefaultRules(7, "singles");
            expect(rules.gimmicks.megaEvolution).toBe(true);
            expect(rules.gimmicks.zMoves).toBe(true);
            expect(rules.gimmicks.terastallization).toBe(false);
        });

        it("disables dynamax for gen 8 singles (Smogon ban)", () => {
            const rules = createDefaultRules(8, "singles");
            expect(rules.gimmicks.dynamax).toBe(false);
            expect(rules.clauses.dynamaxClause).toBe(true);
        });
    });

    describe("createCustomFormat", () => {
        it("generates a format with UUID id", () => {
            const cf = createCustomFormat("Test Format", 9, "gen9ou", "singles");
            expect(cf.id).toBeTruthy();
            expect(cf.name).toBe("Test Format");
            expect(cf.baseGen).toBe(9);
            expect(cf.baseFormat).toBe("gen9ou");
            expect(cf.battleType).toBe("singles");
            expect(cf.rules).toBeDefined();
        });
    });

    describe("CUSTOM_FORMAT_PRESETS", () => {
        it("has at least 4 presets", () => {
            expect(CUSTOM_FORMAT_PRESETS.length).toBeGreaterThanOrEqual(4);
        });

        it("monotype preset has type restriction", () => {
            const mono = CUSTOM_FORMAT_PRESETS.find((p) => p.id === "monotype");
            expect(mono).toBeDefined();
            expect(mono!.rules.typeRestriction?.mode).toBe("monotype");
        });

        it("anything goes preset has all clauses off", () => {
            const ag = CUSTOM_FORMAT_PRESETS.find((p) => p.id === "anything-goes");
            expect(ag).toBeDefined();
            expect(ag!.rules.clauses.speciesClause).toBe(false);
            expect(ag!.rules.clauses.sleepClause).toBe(false);
        });
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/teambuilder && npx vitest run src/__tests__/custom-format.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement the custom-format type file**

```typescript
// apps/teambuilder/src/types/custom-format.ts
import type { PokemonType } from "./pokemon";

export interface CustomFormatRules {
    typeRestriction?: {
        mode: "monotype" | "include" | "exclude";
        types: PokemonType[];
    };

    bannedPokemon: string[];
    bannedMoves: string[];
    bannedItems: string[];
    bannedAbilities: string[];

    clauses: {
        speciesClause: boolean;
        sleepClause: boolean;
        evasionClause: boolean;
        ohkoClause: boolean;
        moodyClause: boolean;
        dynamaxClause: boolean;
        teraTypeClause: boolean;
    };

    teamSize: number;
    levelCap?: number;

    gimmicks: {
        terastallization: boolean;
        dynamax: boolean;
        megaEvolution: boolean;
        zMoves: boolean;
    };

    itemClause: boolean;
    noItems: boolean;
}

export interface CustomFormat {
    id: string;
    name: string;
    baseGen: 7 | 8 | 9;
    baseFormat: string;
    battleType: "singles" | "doubles";
    rules: CustomFormatRules;
}

/**
 * Create default rules based on generation and battle type.
 * Mirrors standard Smogon OU defaults for each gen.
 */
export function createDefaultRules(
    gen: 7 | 8 | 9,
    battleType: "singles" | "doubles",
): CustomFormatRules {
    return {
        bannedPokemon: [],
        bannedMoves: [],
        bannedItems: [],
        bannedAbilities: [],
        clauses: {
            speciesClause: true,
            sleepClause: true,
            evasionClause: true,
            ohkoClause: true,
            moodyClause: true,
            dynamaxClause: gen === 8 && battleType === "singles",
            teraTypeClause: false,
        },
        teamSize: 6,
        gimmicks: {
            terastallization: gen >= 9,
            dynamax: gen === 8 && battleType === "doubles",
            megaEvolution: gen === 7,
            zMoves: gen === 7,
        },
        itemClause: false,
        noItems: false,
    };
}

/**
 * Create a new custom format with defaults for the given generation.
 */
export function createCustomFormat(
    name: string,
    baseGen: 7 | 8 | 9,
    baseFormat: string,
    battleType: "singles" | "doubles",
): CustomFormat {
    return {
        id: crypto.randomUUID(),
        name,
        baseGen,
        baseFormat,
        battleType,
        rules: createDefaultRules(baseGen, battleType),
    };
}

/** Preset template definition — same as CustomFormat but with a fixed id for lookup. */
export type CustomFormatPreset = CustomFormat;

export const CUSTOM_FORMAT_PRESETS: CustomFormatPreset[] = [
    {
        id: "monotype",
        name: "Monotype",
        baseGen: 9,
        baseFormat: "gen9ou",
        battleType: "singles",
        rules: {
            ...createDefaultRules(9, "singles"),
            typeRestriction: { mode: "monotype", types: [] }, // user picks type
        },
    },
    {
        id: "anything-goes",
        name: "Anything Goes",
        baseGen: 9,
        baseFormat: "gen9ou",
        battleType: "singles",
        rules: {
            ...createDefaultRules(9, "singles"),
            clauses: {
                speciesClause: false,
                sleepClause: false,
                evasionClause: false,
                ohkoClause: false,
                moodyClause: false,
                dynamaxClause: false,
                teraTypeClause: false,
            },
        },
    },
    {
        id: "1v1",
        name: "1v1",
        baseGen: 9,
        baseFormat: "gen9ou",
        battleType: "singles",
        rules: {
            ...createDefaultRules(9, "singles"),
            teamSize: 3,
        },
    },
    {
        id: "draft-league",
        name: "Draft League",
        baseGen: 9,
        baseFormat: "gen9ou",
        battleType: "singles",
        rules: createDefaultRules(9, "singles"),
    },
    {
        id: "little-cup",
        name: "Little Cup",
        baseGen: 9,
        baseFormat: "gen9lc",
        battleType: "singles",
        rules: {
            ...createDefaultRules(9, "singles"),
            levelCap: 5,
        },
    },
];
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/teambuilder && npx vitest run src/__tests__/custom-format.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/teambuilder/src/types/custom-format.ts apps/teambuilder/src/__tests__/custom-format.test.ts
git commit -m "feat(teambuilder): add CustomFormat type, defaults, and preset templates"
```

---

### Task 2: URL encoding/decoding for custom formats

**Files:**
- Modify: `apps/teambuilder/src/lib/share.ts`
- Test: `apps/teambuilder/src/__tests__/custom-format.test.ts` (extend)
- Create: helper functions in `apps/teambuilder/src/types/custom-format.ts` (extend)

- [ ] **Step 1: Add encoding tests to custom-format.test.ts**

```typescript
// Append to apps/teambuilder/src/__tests__/custom-format.test.ts
import {
    encodeCustomFormat,
    decodeCustomFormat,
} from "@/types/custom-format";

describe("Custom format encoding/decoding", () => {
    it("round-trips a custom format through encode/decode", () => {
        const cf = createCustomFormat("Test", 9, "gen9ou", "singles");
        cf.rules.bannedPokemon = ["Landorus-Therian", "Heatran"];
        cf.rules.typeRestriction = { mode: "monotype", types: ["Fire"] };

        const encoded = encodeCustomFormat(cf);
        expect(typeof encoded).toBe("string");
        expect(encoded.length).toBeGreaterThan(0);

        const decoded = decodeCustomFormat(encoded);
        expect(decoded).not.toBeNull();
        expect(decoded!.name).toBe("Test");
        expect(decoded!.baseGen).toBe(9);
        expect(decoded!.rules.bannedPokemon).toEqual(["Landorus-Therian", "Heatran"]);
        expect(decoded!.rules.typeRestriction?.mode).toBe("monotype");
    });

    it("produces URL-safe strings (no +, /, =)", () => {
        const cf = createCustomFormat("Special Ch@rs!", 9, "gen9ou", "singles");
        const encoded = encodeCustomFormat(cf);
        expect(encoded).not.toMatch(/[+/=]/);
    });

    it("returns null for invalid encoded strings", () => {
        expect(decodeCustomFormat("not-valid-base64!!!")).toBeNull();
    });

    it("returns null for empty string", () => {
        expect(decodeCustomFormat("")).toBeNull();
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/teambuilder && npx vitest run src/__tests__/custom-format.test.ts`
Expected: FAIL — encodeCustomFormat not found

- [ ] **Step 3: Add encode/decode functions to custom-format.ts**

Add to the end of `apps/teambuilder/src/types/custom-format.ts`:

```typescript
/**
 * Encode a CustomFormat into a URL-safe base64 string.
 * Only includes non-default values to keep the string compact.
 */
export function encodeCustomFormat(cf: CustomFormat): string {
    const json = JSON.stringify({
        n: cf.name,
        g: cf.baseGen,
        bf: cf.baseFormat,
        bt: cf.battleType,
        r: cf.rules,
    });
    const base64 = btoa(unescape(encodeURIComponent(json)));
    return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Decode a URL-safe base64 string back into a CustomFormat.
 * Returns null if decoding fails.
 */
export function decodeCustomFormat(encoded: string): CustomFormat | null {
    if (!encoded) return null;
    try {
        let base64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
        while (base64.length % 4) base64 += "=";
        const json = decodeURIComponent(escape(atob(base64)));
        const data = JSON.parse(json);
        return {
            id: crypto.randomUUID(),
            name: data.n,
            baseGen: data.g,
            baseFormat: data.bf,
            battleType: data.bt,
            rules: data.r,
        };
    } catch {
        return null;
    }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/teambuilder && npx vitest run src/__tests__/custom-format.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/teambuilder/src/types/custom-format.ts apps/teambuilder/src/__tests__/custom-format.test.ts
git commit -m "feat(teambuilder): add custom format URL encoding/decoding"
```

---

### Task 3: Extend share.ts to support `&fmt=` param

**Files:**
- Modify: `apps/teambuilder/src/lib/share.ts`
- Test: `apps/teambuilder/src/__tests__/share.test.ts` (extend)

- [ ] **Step 1: Add tests for custom format in share URLs**

Append to `apps/teambuilder/src/__tests__/share.test.ts`:

```typescript
import { createCustomFormat, encodeCustomFormat } from "@/types/custom-format";

describe("share with custom formats", () => {
    it("generateShareUrl includes fmt param when customFormat provided", () => {
        const cf = createCustomFormat("Mono Fire", 9, "gen9ou", "singles");
        const url = generateShareUrl(sampleTeam, "gen9ou", cf);
        expect(url).toContain("&fmt=");
    });

    it("generateShareUrl omits fmt param when no customFormat", () => {
        const url = generateShareUrl(sampleTeam, "gen9ou");
        expect(url).not.toContain("&fmt=");
    });

    it("encodeTeamForUrl uses baseFormat as format prefix for custom formats", () => {
        const encoded = encodeTeamForUrl(sampleTeam, "gen9ou");
        const decoded = decodeTeamFromUrl(encoded);
        expect(decoded?.format).toBe("gen9ou");
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/teambuilder && npx vitest run src/__tests__/share.test.ts`
Expected: FAIL — generateShareUrl signature mismatch

- [ ] **Step 3: Update share.ts**

In `apps/teambuilder/src/lib/share.ts`, modify `generateShareUrl` to accept an optional `CustomFormat`:

```typescript
// Add import at top:
import type { CustomFormat } from "@/types/custom-format";
import { encodeCustomFormat } from "@/types/custom-format";

// Update generateShareUrl signature (line 63):
export function generateShareUrl(
    team: TeamPokemon[],
    format: string,
    customFormat?: CustomFormat,
): string {
    const encoded = encodeTeamForUrl(team, format);
    if (!encoded) return "";

    const origin =
        typeof window !== "undefined" ? window.location.origin : "https://www.pokemcp.com";

    let url = `${origin}?team=${encoded}`;
    if (customFormat) {
        url += `&fmt=${encodeCustomFormat(customFormat)}`;
    }
    return url;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/teambuilder && npx vitest run src/__tests__/share.test.ts`
Expected: PASS (existing tests should still pass since customFormat is optional)

- [ ] **Step 5: Commit**

```bash
git add apps/teambuilder/src/lib/share.ts apps/teambuilder/src/__tests__/share.test.ts
git commit -m "feat(teambuilder): extend share URLs with custom format encoding"
```

---

## Chunk 2: Soft Validation

### Task 4: Custom format validation function

**Files:**
- Create: `apps/teambuilder/src/lib/validation/custom-format.ts`
- Test: `apps/teambuilder/src/__tests__/custom-format-validation.test.ts`

- [ ] **Step 1: Write validation tests**

```typescript
// apps/teambuilder/src/__tests__/custom-format-validation.test.ts
import { describe, it, expect } from "vitest";
import { validateCustomFormat, type FormatWarning } from "@/lib/validation/custom-format";
import { createCustomFormat } from "@/types/custom-format";
import type { TeamPokemon } from "@/types/pokemon";

const makeMon = (name: string, overrides?: Partial<TeamPokemon>): TeamPokemon => ({
    pokemon: name,
    moves: ["Tackle"],
    ...overrides,
});

describe("validateCustomFormat", () => {
    it("returns empty array for valid team with no restrictions", () => {
        const cf = createCustomFormat("Test", 9, "gen9ou", "singles");
        const team = [makeMon("Garchomp"), makeMon("Heatran")];
        expect(validateCustomFormat(team, cf)).toEqual([]);
    });

    it("warns about banned Pokemon", () => {
        const cf = createCustomFormat("Test", 9, "gen9ou", "singles");
        cf.rules.bannedPokemon = ["Garchomp"];
        const team = [makeMon("Garchomp"), makeMon("Heatran")];
        const warnings = validateCustomFormat(team, cf);
        expect(warnings).toHaveLength(1);
        expect(warnings[0].level).toBe("warning");
        expect(warnings[0].pokemon).toBe("Garchomp");
        expect(warnings[0].message).toContain("banned");
    });

    it("warns about banned moves", () => {
        const cf = createCustomFormat("Test", 9, "gen9ou", "singles");
        cf.rules.bannedMoves = ["Earthquake"];
        const team = [makeMon("Garchomp", { moves: ["Earthquake", "Dragon Claw"] })];
        const warnings = validateCustomFormat(team, cf);
        expect(warnings).toHaveLength(1);
        expect(warnings[0].message).toContain("Earthquake");
    });

    it("warns about banned items", () => {
        const cf = createCustomFormat("Test", 9, "gen9ou", "singles");
        cf.rules.bannedItems = ["Life Orb"];
        const team = [makeMon("Garchomp", { item: "Life Orb" })];
        const warnings = validateCustomFormat(team, cf);
        expect(warnings).toHaveLength(1);
        expect(warnings[0].message).toContain("Life Orb");
    });

    it("warns about banned abilities", () => {
        const cf = createCustomFormat("Test", 9, "gen9ou", "singles");
        cf.rules.bannedAbilities = ["Rough Skin"];
        const team = [makeMon("Garchomp", { ability: "Rough Skin" })];
        const warnings = validateCustomFormat(team, cf);
        expect(warnings).toHaveLength(1);
        expect(warnings[0].message).toContain("Rough Skin");
    });

    it("warns about team size exceeding limit", () => {
        const cf = createCustomFormat("Test", 9, "gen9ou", "singles");
        cf.rules.teamSize = 3;
        const team = [makeMon("A"), makeMon("B"), makeMon("C"), makeMon("D")];
        const warnings = validateCustomFormat(team, cf);
        expect(warnings.some((w) => w.message.includes("3"))).toBe(true);
    });

    it("warns about duplicate items when itemClause is on", () => {
        const cf = createCustomFormat("Test", 9, "gen9ou", "singles");
        cf.rules.itemClause = true;
        const team = [
            makeMon("Garchomp", { item: "Leftovers" }),
            makeMon("Heatran", { item: "Leftovers" }),
        ];
        const warnings = validateCustomFormat(team, cf);
        expect(warnings.some((w) => w.message.includes("Leftovers"))).toBe(true);
    });

    it("warns about items when noItems is on", () => {
        const cf = createCustomFormat("Test", 9, "gen9ou", "singles");
        cf.rules.noItems = true;
        const team = [makeMon("Garchomp", { item: "Life Orb" })];
        const warnings = validateCustomFormat(team, cf);
        expect(warnings).toHaveLength(1);
        expect(warnings[0].message).toContain("not allowed");
    });

    it("warns about tera type when terastallization is off", () => {
        const cf = createCustomFormat("Test", 9, "gen9ou", "singles");
        cf.rules.gimmicks.terastallization = false;
        const team = [makeMon("Garchomp", { teraType: "Fire" })];
        const warnings = validateCustomFormat(team, cf);
        expect(warnings.some((w) => w.message.toLowerCase().includes("tera"))).toBe(true);
    });

    it("warns about level exceeding level cap", () => {
        const cf = createCustomFormat("Test", 9, "gen9lc", "singles");
        cf.rules.levelCap = 5;
        const team = [makeMon("Gastly", { level: 50 })];
        const warnings = validateCustomFormat(team, cf);
        expect(warnings.some((w) => w.message.includes("level"))).toBe(true);
    });

    it("warns about duplicate species when species clause is on", () => {
        const cf = createCustomFormat("Test", 9, "gen9ou", "singles");
        cf.rules.clauses.speciesClause = true;
        const team = [makeMon("Garchomp"), makeMon("Garchomp")];
        const warnings = validateCustomFormat(team, cf);
        expect(warnings.some((w) => w.message.toLowerCase().includes("species clause"))).toBe(true);
    });

    it("does not warn about duplicate species when species clause is off", () => {
        const cf = createCustomFormat("Test", 9, "gen9ou", "singles");
        cf.rules.clauses.speciesClause = false;
        const team = [makeMon("Garchomp"), makeMon("Garchomp")];
        const warnings = validateCustomFormat(team, cf);
        expect(warnings.some((w) => w.message.toLowerCase().includes("species clause"))).toBe(false);
    });

    it("returns empty array for empty team", () => {
        const cf = createCustomFormat("Test", 9, "gen9ou", "singles");
        cf.rules.bannedPokemon = ["Garchomp"];
        expect(validateCustomFormat([], cf)).toEqual([]);
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/teambuilder && npx vitest run src/__tests__/custom-format-validation.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement validation function**

```typescript
// apps/teambuilder/src/lib/validation/custom-format.ts
import type { TeamPokemon } from "@/types/pokemon";
import type { CustomFormat } from "@/types/custom-format";

/** Reuses the same shape as VGCTeamWarning for unified rendering. */
export interface FormatWarning {
    level: "error" | "warning" | "info";
    message: string;
    pokemon?: string;
    suggestion?: string;
}

/**
 * Validate a team against custom format rules.
 * Returns soft warnings — never blocks team building.
 */
export function validateCustomFormat(
    team: TeamPokemon[],
    customFormat: CustomFormat,
): FormatWarning[] {
    if (team.length === 0) return [];

    const warnings: FormatWarning[] = [];
    const { rules } = customFormat;

    // Team size
    if (team.length > rules.teamSize) {
        warnings.push({
            level: "warning",
            message: `Team has ${team.length} Pokemon but this format allows ${rules.teamSize}`,
        });
    }

    // Normalize for case-insensitive comparison
    const banned = new Set(rules.bannedPokemon.map((p) => p.toLowerCase()));
    const bannedMoves = new Set(rules.bannedMoves.map((m) => m.toLowerCase()));
    const bannedItems = new Set(rules.bannedItems.map((i) => i.toLowerCase()));
    const bannedAbilities = new Set(rules.bannedAbilities.map((a) => a.toLowerCase()));

    // Track items for item clause
    const seenItems = new Map<string, string>(); // lowercase item -> first pokemon name

    for (const mon of team) {
        const name = mon.pokemon;
        const nameLower = name.toLowerCase();

        // Banned Pokemon
        if (banned.has(nameLower)) {
            warnings.push({
                level: "warning",
                message: `${name} is banned in this format`,
                pokemon: name,
                suggestion: `Remove ${name} or change format rules`,
            });
        }

        // Banned moves
        for (const move of mon.moves) {
            if (bannedMoves.has(move.toLowerCase())) {
                warnings.push({
                    level: "warning",
                    message: `${move} is banned in this format`,
                    pokemon: name,
                    suggestion: `Replace ${move} on ${name}`,
                });
            }
        }

        // Banned items
        if (mon.item && bannedItems.has(mon.item.toLowerCase())) {
            warnings.push({
                level: "warning",
                message: `${mon.item} is banned in this format`,
                pokemon: name,
                suggestion: `Replace ${mon.item} on ${name}`,
            });
        }

        // Banned abilities
        if (mon.ability && bannedAbilities.has(mon.ability.toLowerCase())) {
            warnings.push({
                level: "warning",
                message: `${mon.ability} is banned in this format`,
                pokemon: name,
                suggestion: `Change ${name}'s ability`,
            });
        }

        // No items rule
        if (rules.noItems && mon.item) {
            warnings.push({
                level: "warning",
                message: `Items are not allowed in this format but ${name} holds ${mon.item}`,
                pokemon: name,
            });
        }

        // Item clause (no duplicate items)
        if (rules.itemClause && mon.item) {
            const itemLower = mon.item.toLowerCase();
            const existing = seenItems.get(itemLower);
            if (existing) {
                warnings.push({
                    level: "warning",
                    message: `${mon.item} is held by both ${existing} and ${name} (Item Clause)`,
                    pokemon: name,
                });
            } else {
                seenItems.set(itemLower, name);
            }
        }

        // Gimmick: Tera type set but terastallization disabled
        if (!rules.gimmicks.terastallization && mon.teraType) {
            warnings.push({
                level: "info",
                message: `${name} has Tera Type ${mon.teraType} but Terastallization is disabled`,
                pokemon: name,
            });
        }

        // Level cap
        if (rules.levelCap && mon.level && mon.level > rules.levelCap) {
            warnings.push({
                level: "warning",
                message: `${name} is level ${mon.level} but this format has a level cap of ${rules.levelCap}`,
                pokemon: name,
            });
        }
    }

    // Species Clause: no duplicate species
    // Uses case-insensitive comparison on display names (not toID())
    if (rules.clauses.speciesClause) {
        const seen = new Map<string, string>();
        for (const mon of team) {
            const key = mon.pokemon.toLowerCase();
            const existing = seen.get(key);
            if (existing) {
                warnings.push({
                    level: "warning",
                    message: `${mon.pokemon} appears multiple times (Species Clause)`,
                    pokemon: mon.pokemon,
                });
            } else {
                seen.set(key, mon.pokemon);
            }
        }
    }

    return warnings;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/teambuilder && npx vitest run src/__tests__/custom-format-validation.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/teambuilder/src/lib/validation/custom-format.ts apps/teambuilder/src/__tests__/custom-format-validation.test.ts
git commit -m "feat(teambuilder): add soft validation for custom format rules"
```

---

## Chunk 3: Store Integration and AI Context

### Task 5: Add customFormat to team store

**Files:**
- Modify: `apps/teambuilder/src/stores/team-store.ts`
- Test: `apps/teambuilder/src/__tests__/team-store.test.ts` (extend)

- [ ] **Step 1: Add store tests**

Append to `apps/teambuilder/src/__tests__/team-store.test.ts`:

```typescript
import { createCustomFormat } from "@/types/custom-format";

describe("custom format in team store", () => {
    beforeEach(() => {
        useTeamStore.getState().clearTeam();
        useTeamStore.getState().setCustomFormat(null);
    });

    it("starts with null customFormat", () => {
        expect(useTeamStore.getState().customFormat).toBeNull();
    });

    it("sets and clears custom format", () => {
        const cf = createCustomFormat("Test", 9, "gen9ou", "singles");
        useTeamStore.getState().setCustomFormat(cf);
        expect(useTeamStore.getState().customFormat).not.toBeNull();
        expect(useTeamStore.getState().customFormat!.name).toBe("Test");

        useTeamStore.getState().setCustomFormat(null);
        expect(useTeamStore.getState().customFormat).toBeNull();
    });

    it("setting custom format updates format to baseFormat", () => {
        const cf = createCustomFormat("Test", 8, "gen8ou", "singles");
        useTeamStore.getState().setCustomFormat(cf);
        expect(useTeamStore.getState().format).toBe("gen8ou");
    });

    it("setting a standard format clears customFormat", () => {
        const cf = createCustomFormat("Test", 9, "gen9ou", "singles");
        useTeamStore.getState().setCustomFormat(cf);
        expect(useTeamStore.getState().customFormat).not.toBeNull();

        useTeamStore.getState().setFormat("gen9uu");
        expect(useTeamStore.getState().customFormat).toBeNull();
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/teambuilder && npx vitest run src/__tests__/team-store.test.ts`
Expected: FAIL — setCustomFormat not a function

- [ ] **Step 3: Modify team-store.ts**

In `apps/teambuilder/src/stores/team-store.ts`:

1. Add import at top (line 3):
```typescript
import type { CustomFormat } from "@/types/custom-format";
```

2. Extend `TeamState` interface (after line 11, add):
```typescript
    customFormat: CustomFormat | null;
```

3. Add action to interface (after line 23):
```typescript
    setCustomFormat: (customFormat: CustomFormat | null) => void;
```

4. Add to initial state (after line 32):
```typescript
            customFormat: null,
```

5. Add `setCustomFormat` action (after `setFormat` action, around line 48):
```typescript
            setCustomFormat: (customFormat) => {
                if (customFormat) {
                    const format = customFormat.baseFormat as FormatId;
                    const mode: Mode = isFormatValidForMode(format, "vgc") ? "vgc" : "singles";
                    set({ customFormat, format, mode });
                } else {
                    set({ customFormat: null });
                }
            },
```

6. Modify `setFormat` to clear customFormat (replace lines 44-48):
```typescript
            setFormat: (format) => {
                const mode: Mode = isFormatValidForMode(format, "vgc") ? "vgc" : "singles";
                set({ format, mode, customFormat: null });
            },
```

7. Extend `partialize` to include customFormat (line 134-138):
```typescript
            partialize: (state) => ({
                mode: state.mode,
                format: state.format,
                team: state.team,
                customFormat: state.customFormat,
            }),
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/teambuilder && npx vitest run src/__tests__/team-store.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/teambuilder/src/stores/team-store.ts apps/teambuilder/src/__tests__/team-store.test.ts
git commit -m "feat(teambuilder): add customFormat to team store with persistence"
```

---

### Task 6: Inject custom format rules into AI system prompt

**Files:**
- Modify: `apps/teambuilder/src/lib/ai/context.ts`
- Test: `apps/teambuilder/src/__tests__/context.test.ts` (extend)

- [ ] **Step 1: Add context tests**

Append to `apps/teambuilder/src/__tests__/context.test.ts`. Also update the existing import at line 2 to include `buildSystemPrompt`:

```typescript
// Update existing import to add buildSystemPrompt:
// import { formatTeamContext, buildUserMessage, buildSystemPrompt } from "@/lib/ai/context";
import { createCustomFormat } from "@/types/custom-format";

describe("buildSystemPrompt with custom format", () => {
    it("includes custom format rules block when customFormat provided", () => {
        const cf = createCustomFormat("Mono Fire", 9, "gen9ou", "singles");
        cf.rules.typeRestriction = { mode: "monotype", types: ["Fire"] };
        cf.rules.bannedPokemon = ["Heatran"];

        const prompt = buildSystemPrompt("oak", "gen9ou", 3, "singles", cf);
        expect(prompt).toContain("CUSTOM FORMAT RULES");
        expect(prompt).toContain("Mono Fire");
        expect(prompt).toContain("Monotype");
        expect(prompt).toContain("Fire");
        expect(prompt).toContain("Heatran");
    });

    it("omits custom format block when customFormat is undefined", () => {
        const prompt = buildSystemPrompt("oak", "gen9ou", 3, "singles");
        expect(prompt).not.toContain("CUSTOM FORMAT RULES");
    });

    it("includes stats disclaimer for custom format", () => {
        const cf = createCustomFormat("Test", 9, "gen9ou", "singles");
        const prompt = buildSystemPrompt("oak", "gen9ou", 3, "singles", cf);
        expect(prompt).toContain("custom format");
    });

    it("uses correct gimmick guidance for gen 8 custom format", () => {
        const cf = createCustomFormat("Gen 8 Custom", 8, "gen8ou", "singles");
        const prompt = buildSystemPrompt("oak", "gen8ou", 3, "singles", cf);
        // Should not mention Tera
        expect(prompt).not.toContain("TERASTALLIZATION (Gen 9");
        expect(prompt).toContain("Terastallization is DISABLED");
    });

    it("respects custom gimmick overrides — gen 9 with tera disabled", () => {
        const cf = createCustomFormat("No Tera", 9, "gen9ou", "singles");
        cf.rules.gimmicks.terastallization = false;
        const prompt = buildSystemPrompt("oak", "gen9ou", 3, "singles", cf);
        // Should NOT have default Gen 9 tera guidance
        expect(prompt).not.toContain("EVERY Pokemon should have a tera_type specified");
        // Should have the disabled note
        expect(prompt).toContain("DISABLED");
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/teambuilder && npx vitest run src/__tests__/context.test.ts`
Expected: FAIL — buildSystemPrompt called with 5 args but only accepts 4

- [ ] **Step 3: Modify context.ts**

In `apps/teambuilder/src/lib/ai/context.ts`:

1. Add import at top:
```typescript
import type { CustomFormat } from "@/types/custom-format";
```

2. Add `buildCustomFormatContext` function (before `buildSystemPrompt`, around line 415):
```typescript
/**
 * Build a structured rules block for the AI system prompt from a CustomFormat.
 */
function buildCustomFormatContext(cf: CustomFormat): string {
    const lines: string[] = [
        "\nCUSTOM FORMAT RULES (User-Defined):",
        `- Name: ${cf.name}`,
        `- Base: Gen ${cf.baseGen}, ${cf.battleType === "singles" ? "Singles" : "Doubles"}`,
    ];

    if (cf.rules.typeRestriction) {
        const types = cf.rules.typeRestriction.types.join(", ") || "(user picks type)";
        lines.push(`- Type Restriction: ${cf.rules.typeRestriction.mode} — ${types}`);
    }

    if (cf.rules.bannedPokemon.length > 0) {
        lines.push(`- Banned Pokemon: ${cf.rules.bannedPokemon.join(", ")}`);
    }
    if (cf.rules.bannedMoves.length > 0) {
        lines.push(`- Banned Moves: ${cf.rules.bannedMoves.join(", ")}`);
    }
    if (cf.rules.bannedItems.length > 0) {
        lines.push(`- Banned Items: ${cf.rules.bannedItems.join(", ")}`);
    }
    if (cf.rules.bannedAbilities.length > 0) {
        lines.push(`- Banned Abilities: ${cf.rules.bannedAbilities.join(", ")}`);
    }

    const activeClauses = Object.entries(cf.rules.clauses)
        .filter(([, v]) => v)
        .map(([k]) => k.replace(/([A-Z])/g, " $1").trim());
    if (activeClauses.length > 0) {
        lines.push(`- Clauses: ${activeClauses.join(", ")}`);
    }

    const activeGimmicks = Object.entries(cf.rules.gimmicks)
        .filter(([, v]) => v)
        .map(([k]) => k.replace(/([A-Z])/g, " $1").trim());
    lines.push(`- Gimmicks: ${activeGimmicks.length > 0 ? activeGimmicks.join(", ") : "None"}`);
    lines.push(`- Team Size: ${cf.rules.teamSize}`);

    if (cf.rules.levelCap) {
        lines.push(`- Level Cap: ${cf.rules.levelCap}`);
    }
    if (cf.rules.noItems) {
        lines.push("- Items: NOT ALLOWED");
    } else if (cf.rules.itemClause) {
        lines.push("- Item Clause: No duplicate items");
    }

    lines.push("");
    lines.push("IMPORTANT: Respect ALL custom rules above. Custom rules take priority over");
    lines.push("standard format rules. Warn the user if their request conflicts with these");
    lines.push("rules but still fulfill it.");
    lines.push("");
    lines.push(`Note: Usage stats are from ${cf.baseFormat.toUpperCase()} since this is a custom format — data may not perfectly reflect this ruleset.`);

    return lines.join("\n");
}
```

3. Update `buildSystemPrompt` signature (line 418) to accept optional customFormat:
```typescript
export function buildSystemPrompt(
    personalityId: PersonalityId,
    format: string,
    teamSize: number,
    mode: Mode = "singles",
    customFormat?: CustomFormat,
): string {
```

4. Inside `buildSystemPrompt`, replace the gimmick guidance line (line 426):

Replace:
```typescript
    const gimmickGuidance = getGimmickGuidance(format);
```
With:
```typescript
    // When custom format is active, use its gimmick settings instead of deriving from format string
    const gimmickGuidance = customFormat
        ? getGimmickGuidanceForCustomFormat(customFormat)
        : getGimmickGuidance(format);
    const customFormatContext = customFormat ? buildCustomFormatContext(customFormat) : "";
```

5. Add the `getGimmickGuidanceForCustomFormat` function (before `buildSystemPrompt`):

```typescript
/**
 * Generate gimmick guidance based on custom format's explicit gimmick toggles.
 * Unlike getGimmickGuidance which parses format strings, this uses the structured rules.
 */
function getGimmickGuidanceForCustomFormat(cf: CustomFormat): string {
    const parts: string[] = [];

    if (cf.rules.gimmicks.terastallization) {
        parts.push(`
TERASTALLIZATION (Enabled in this custom format):
- EVERY Pokemon should have a tera_type specified
- Choose Tera types strategically for offense, defense, or coverage
- Consider the team's Tera type diversity`);
    }

    if (cf.rules.gimmicks.dynamax) {
        parts.push(`
DYNAMAX (Enabled in this custom format):
- Any Pokemon can Dynamax once per battle (doubles HP, boosts moves)
- Max Moves have secondary effects (Max Airstream boosts Speed, etc.)
- Plan which Pokemon will Dynamax`);
    }

    if (cf.rules.gimmicks.megaEvolution) {
        parts.push(`
MEGA EVOLUTION (Enabled in this custom format):
- Pokemon holding Mega Stones can Mega Evolve once per battle
- Include "-Mega" suffix for Mega forms
- Only one Mega Evolution user per team`);
    }

    if (cf.rules.gimmicks.zMoves) {
        parts.push(`
Z-MOVES (Enabled in this custom format):
- One Pokemon can hold a Z-Crystal for a powerful one-time Z-Move
- Type Z-Crystals boost any move of that type`);
    }

    if (!cf.rules.gimmicks.terastallization) {
        parts.push("\nNote: Terastallization is DISABLED — do NOT set tera_type on Pokemon.");
    }

    return parts.join("\n");
}
```

6. In the return template literal, add `${customFormatContext}` after `${gimmickGuidance}` (around line 465):

Replace:
```typescript
${gimmickGuidance}
```
With:
```typescript
${gimmickGuidance}
${customFormatContext}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/teambuilder && npx vitest run src/__tests__/context.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/teambuilder/src/lib/ai/context.ts apps/teambuilder/src/__tests__/context.test.ts
git commit -m "feat(teambuilder): inject custom format rules into AI system prompt"
```

---

### Task 7: Thread customFormat through API route and streaming

**Files:**
- Modify: `apps/teambuilder/src/app/api/ai/claude/stream/route.ts`
- Modify: `apps/teambuilder/src/lib/ai/index.ts`

- [ ] **Step 1: Update route.ts to accept and use customFormat**

In `apps/teambuilder/src/app/api/ai/claude/stream/route.ts`:

1. Add import (top of file):
```typescript
import type { CustomFormat } from "@/types/custom-format";
```

2. Extend request body destructuring (line 71-79), add `customFormat`:
```typescript
        const {
            message,
            team = [],
            format = "gen9ou",
            mode = "singles",
            enableThinking,
            personality: personalityId = DEFAULT_PERSONALITY,
            chatHistory = [],
            customFormat,
        } = await request.json();
```

3. When custom format is active, use baseFormat for stats. Replace the parallel fetch block (lines 99-107):
```typescript
        const statsFormat = customFormat?.baseFormat ?? format;
        const [metaThreats, popularSetsContext, teammateAnalysis, strategyContext] =
            await Promise.all([
                fetchMetaThreats(statsFormat),
                fetchPopularSetsContext(message, statsFormat),
                team.length > 0 && team.length < 6
                    ? fetchTeammateAnalysis(team as TeamPokemon[], statsFormat)
                    : Promise.resolve(""),
                fetchStrategyContext(message, statsFormat),
            ]);
```

4. Pass customFormat to buildSystemPrompt (lines 111-116):
```typescript
        const systemPrompt = buildSystemPrompt(
            personalityId as PersonalityId,
            format,
            team.length,
            mode,
            customFormat as CustomFormat | undefined,
        );
```

- [ ] **Step 2: Update index.ts to pass customFormat**

In `apps/teambuilder/src/lib/ai/index.ts`:

1. Add import:
```typescript
import type { CustomFormat } from "@/types/custom-format";
```

2. Add `customFormat` to `StreamChatMessageOptions` interface:
```typescript
    customFormat?: CustomFormat;
```

3. Add `customFormat` to the destructured params in `streamChatMessage`:
```typescript
    customFormat,
```

4. Add `customFormat` to the fetch body:
```typescript
        body: JSON.stringify({
            message,
            team,
            format,
            mode,
            personality,
            enableThinking,
            chatHistory: formatChatHistory(chatHistory),
            customFormat,
        }),
```

- [ ] **Step 3: Run full test suite to verify nothing broke**

Run: `cd apps/teambuilder && npx vitest run`
Expected: All tests PASS

- [ ] **Step 4: Commit**

```bash
git add apps/teambuilder/src/app/api/ai/claude/stream/route.ts apps/teambuilder/src/lib/ai/index.ts
git commit -m "feat(teambuilder): thread customFormat through API route and streaming"
```

---

## Chunk 4: UI — FormatSelector and CustomFormatDialog

> **Prerequisite:** Chunk 3 (Task 5) must be complete — `customFormat` and `setCustomFormat` must exist on the team store.

### Task 8: Add "Custom Format..." to FormatSelector

**Files:**
- Modify: `apps/teambuilder/src/components/layout/FormatSelector.tsx`
- Modify: `apps/teambuilder/src/types/pokemon.ts`

- [ ] **Step 1: Update getFormatDisplayName to handle custom formats**

In `apps/teambuilder/src/types/pokemon.ts`, modify `getFormatDisplayName` (lines 239-242):

```typescript
export function getFormatDisplayName(formatId: string, customFormatName?: string): string {
    if (customFormatName) return customFormatName;
    const format = FORMATS.find((f) => f.id === formatId);
    return format?.name ?? formatId.toUpperCase();
}
```

- [ ] **Step 2: Add Custom Format entry and dialog trigger to FormatSelector**

In `apps/teambuilder/src/components/layout/FormatSelector.tsx`:

1. Add imports:
```typescript
import { Settings2 } from "lucide-react";
import { useTeamStore } from "@/stores/team-store";
```
(Already imports useTeamStore, so just add Settings2)

2. Add state for dialog:
```typescript
    const { mode, format, setFormat, team, customFormat, setCustomFormat } = useTeamStore();
    const [showCustomDialog, setShowCustomDialog] = useState(false);
```

3. Update format display name to use custom format name:
```typescript
    const currentFormatName = customFormat
        ? customFormat.name
        : getFormatDisplayName(format);
```

4. Add separator and "Custom Format..." item at the end of the DropdownMenuContent, before the closing `</DropdownMenuContent>`:
```tsx
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                        onClick={() => setShowCustomDialog(true)}
                        className="gap-2"
                    >
                        <Settings2 className="h-4 w-4" />
                        <span>Custom Format...</span>
                    </DropdownMenuItem>
```

5. Add the CustomFormatDialog import and render (after the AlertDialog):
```tsx
            {showCustomDialog && (
                <CustomFormatDialog
                    open={showCustomDialog}
                    onOpenChange={setShowCustomDialog}
                    initialFormat={customFormat}
                    onSave={(cf) => {
                        setCustomFormat(cf);
                        setShowCustomDialog(false);
                    }}
                />
            )}
```

6. Add import for CustomFormatDialog at top:
```typescript
import { CustomFormatDialog } from "./CustomFormatDialog";
```

- [ ] **Step 3: Run type check to verify**

Run: `cd apps/teambuilder && npx tsc --noEmit`
Expected: This will fail until Task 9 creates CustomFormatDialog — that's OK. Move to Task 9.

- [ ] **Step 4: Commit (with Task 9)**

Commit together with Task 9 after the dialog is created.

---

### Task 9: Build CustomFormatDialog component

**Files:**
- Create: `apps/teambuilder/src/components/layout/CustomFormatDialog.tsx`

This is the largest single component. It uses shadcn Dialog, Tabs, Switch, Input, Select, and Badge components.

- [ ] **Step 1: Check which shadcn components are already installed**

Run: `ls apps/teambuilder/src/components/ui/ | grep -E "dialog|tabs|switch|select|badge|input|label|separator"`

If any are missing, install them:
```bash
cd apps/teambuilder && npx shadcn@latest add <missing-component>
```

- [ ] **Step 2: Create CustomFormatDialog.tsx**

Create `apps/teambuilder/src/components/layout/CustomFormatDialog.tsx`:

```tsx
"use client";

import { useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { TYPES, type PokemonType } from "@/types/pokemon";
import {
    type CustomFormat,
    type CustomFormatRules,
    createCustomFormat,
    createDefaultRules,
    CUSTOM_FORMAT_PRESETS,
} from "@/types/custom-format";
import { cn } from "@/lib/utils";

interface CustomFormatDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    initialFormat: CustomFormat | null;
    onSave: (format: CustomFormat) => void;
}

const BASE_FORMATS: { gen: 7 | 8 | 9; label: string; default: string }[] = [
    { gen: 9, label: "Gen 9", default: "gen9ou" },
    { gen: 8, label: "Gen 8", default: "gen8ou" },
    { gen: 7, label: "Gen 7", default: "gen7ou" },
];

const CLAUSE_LABELS: Record<keyof CustomFormatRules["clauses"], string> = {
    speciesClause: "Species Clause",
    sleepClause: "Sleep Clause",
    evasionClause: "Evasion Clause",
    ohkoClause: "OHKO Clause",
    moodyClause: "Moody Clause",
    dynamaxClause: "Dynamax Clause",
    teraTypeClause: "Tera Type Clause",
};

const GIMMICK_LABELS: Record<keyof CustomFormatRules["gimmicks"], string> = {
    terastallization: "Terastallization",
    dynamax: "Dynamax",
    megaEvolution: "Mega Evolution",
    zMoves: "Z-Moves",
};

export function CustomFormatDialog({
    open,
    onOpenChange,
    initialFormat,
    onSave,
}: CustomFormatDialogProps) {
    const [name, setName] = useState(initialFormat?.name ?? "");
    const [baseGen, setBaseGen] = useState<7 | 8 | 9>(initialFormat?.baseGen ?? 9);
    const [battleType, setBattleType] = useState<"singles" | "doubles">(
        initialFormat?.battleType ?? "singles",
    );
    const [rules, setRules] = useState<CustomFormatRules>(
        initialFormat?.rules ?? createDefaultRules(9, "singles"),
    );

    // Banlist text inputs
    const [bannedPokemonText, setBannedPokemonText] = useState(
        initialFormat?.rules.bannedPokemon.join(", ") ?? "",
    );
    const [bannedMovesText, setBannedMovesText] = useState(
        initialFormat?.rules.bannedMoves.join(", ") ?? "",
    );
    const [bannedItemsText, setBannedItemsText] = useState(
        initialFormat?.rules.bannedItems.join(", ") ?? "",
    );
    const [bannedAbilitiesText, setBannedAbilitiesText] = useState(
        initialFormat?.rules.bannedAbilities.join(", ") ?? "",
    );

    const handleGenChange = (gen: 7 | 8 | 9) => {
        setBaseGen(gen);
        setRules(createDefaultRules(gen, battleType));
    };

    const handleBattleTypeChange = (bt: "singles" | "doubles") => {
        setBattleType(bt);
        setRules(createDefaultRules(baseGen, bt));
    };

    const handleLoadPreset = (preset: CustomFormat) => {
        setName(preset.name);
        setBaseGen(preset.baseGen);
        setBattleType(preset.battleType);
        setRules({ ...preset.rules });
        setBannedPokemonText(preset.rules.bannedPokemon.join(", "));
        setBannedMovesText(preset.rules.bannedMoves.join(", "));
        setBannedItemsText(preset.rules.bannedItems.join(", "));
        setBannedAbilitiesText(preset.rules.bannedAbilities.join(", "));
    };

    const updateClause = (key: keyof CustomFormatRules["clauses"], value: boolean) => {
        setRules((prev) => ({
            ...prev,
            clauses: { ...prev.clauses, [key]: value },
        }));
    };

    const updateGimmick = (key: keyof CustomFormatRules["gimmicks"], value: boolean) => {
        setRules((prev) => ({
            ...prev,
            gimmicks: { ...prev.gimmicks, [key]: value },
        }));
    };

    const parseCsvList = (text: string): string[] =>
        text
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);

    const handleSave = () => {
        const baseFormat =
            BASE_FORMATS.find((f) => f.gen === baseGen)?.default ?? "gen9ou";

        const finalRules: CustomFormatRules = {
            ...rules,
            bannedPokemon: parseCsvList(bannedPokemonText),
            bannedMoves: parseCsvList(bannedMovesText),
            bannedItems: parseCsvList(bannedItemsText),
            bannedAbilities: parseCsvList(bannedAbilitiesText),
        };

        const cf: CustomFormat = initialFormat
            ? { ...initialFormat, name: name || "Custom Format", baseGen, baseFormat, battleType, rules: finalRules }
            : createCustomFormat(name || "Custom Format", baseGen, baseFormat, battleType);

        // If we created a fresh one, override the default rules
        if (!initialFormat) {
            cf.rules = finalRules;
        }

        onSave(cf);
    };

    const handleTypeToggle = (type: string) => {
        const current = rules.typeRestriction?.types ?? [];
        const mode = rules.typeRestriction?.mode ?? "monotype";
        const newTypes = current.includes(type)
            ? current.filter((t) => t !== type)
            : mode === "monotype"
              ? [type] // monotype allows only one
              : [...current, type];

        setRules((prev) => ({
            ...prev,
            typeRestriction: newTypes.length > 0
                ? { mode, types: newTypes as PokemonType[] }
                : undefined,
        }));
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Custom Format</DialogTitle>
                </DialogHeader>

                {/* Presets */}
                <div className="flex flex-wrap gap-2">
                    {CUSTOM_FORMAT_PRESETS.map((preset) => (
                        <Button
                            key={preset.id}
                            variant="outline"
                            size="sm"
                            onClick={() => handleLoadPreset(preset)}
                        >
                            {preset.name}
                        </Button>
                    ))}
                </div>

                <Separator />

                {/* Name */}
                <div className="space-y-2">
                    <Label htmlFor="format-name">Format Name</Label>
                    <Input
                        id="format-name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="My Custom Format"
                    />
                </div>

                {/* Base Gen + Battle Type */}
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label>Generation</Label>
                        <div className="flex gap-1">
                            {BASE_FORMATS.map((f) => (
                                <Button
                                    key={f.gen}
                                    variant={baseGen === f.gen ? "default" : "outline"}
                                    size="sm"
                                    onClick={() => handleGenChange(f.gen)}
                                >
                                    {f.label}
                                </Button>
                            ))}
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label>Battle Type</Label>
                        <div className="flex gap-1">
                            <Button
                                variant={battleType === "singles" ? "default" : "outline"}
                                size="sm"
                                onClick={() => handleBattleTypeChange("singles")}
                            >
                                Singles
                            </Button>
                            <Button
                                variant={battleType === "doubles" ? "default" : "outline"}
                                size="sm"
                                onClick={() => handleBattleTypeChange("doubles")}
                            >
                                Doubles
                            </Button>
                        </div>
                    </div>
                </div>

                <Separator />

                {/* Type Restriction */}
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <Label>Type Restriction</Label>
                        <div className="flex gap-1">
                            {(["monotype", "include", "exclude"] as const).map((mode) => (
                                <Button
                                    key={mode}
                                    variant={rules.typeRestriction?.mode === mode ? "default" : "outline"}
                                    size="sm"
                                    className="text-xs"
                                    onClick={() => {
                                        if (rules.typeRestriction?.mode === mode) {
                                            setRules((prev) => ({ ...prev, typeRestriction: undefined }));
                                        } else {
                                            setRules((prev) => ({
                                                ...prev,
                                                typeRestriction: { mode, types: prev.typeRestriction?.types ?? [] },
                                            }));
                                        }
                                    }}
                                >
                                    {mode}
                                </Button>
                            ))}
                        </div>
                    </div>
                    {rules.typeRestriction && (
                        <div className="flex flex-wrap gap-1">
                            {TYPES.map((type) => (
                                <Button
                                    key={type}
                                    variant={rules.typeRestriction?.types.includes(type) ? "default" : "outline"}
                                    size="sm"
                                    className="text-xs h-7 px-2"
                                    onClick={() => handleTypeToggle(type)}
                                >
                                    {type}
                                </Button>
                            ))}
                        </div>
                    )}
                </div>

                <Separator />

                {/* Banlists */}
                <div className="space-y-3">
                    <Label className="text-sm font-semibold">Banlists</Label>
                    <div className="space-y-2">
                        <Label htmlFor="banned-pokemon" className="text-xs text-muted-foreground">
                            Banned Pokemon (comma-separated)
                        </Label>
                        <Input
                            id="banned-pokemon"
                            value={bannedPokemonText}
                            onChange={(e) => setBannedPokemonText(e.target.value)}
                            placeholder="Landorus-Therian, Heatran"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="banned-moves" className="text-xs text-muted-foreground">
                            Banned Moves
                        </Label>
                        <Input
                            id="banned-moves"
                            value={bannedMovesText}
                            onChange={(e) => setBannedMovesText(e.target.value)}
                            placeholder="Baton Pass, Swagger"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="banned-items" className="text-xs text-muted-foreground">
                            Banned Items
                        </Label>
                        <Input
                            id="banned-items"
                            value={bannedItemsText}
                            onChange={(e) => setBannedItemsText(e.target.value)}
                            placeholder="King's Rock, Bright Powder"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="banned-abilities" className="text-xs text-muted-foreground">
                            Banned Abilities
                        </Label>
                        <Input
                            id="banned-abilities"
                            value={bannedAbilitiesText}
                            onChange={(e) => setBannedAbilitiesText(e.target.value)}
                            placeholder="Shadow Tag, Arena Trap"
                        />
                    </div>
                </div>

                <Separator />

                {/* Clauses */}
                <div className="space-y-3">
                    <Label className="text-sm font-semibold">Clauses</Label>
                    <div className="grid grid-cols-2 gap-2">
                        {(Object.entries(CLAUSE_LABELS) as [keyof CustomFormatRules["clauses"], string][]).map(
                            ([key, label]) => (
                                <div key={key} className="flex items-center justify-between gap-2">
                                    <Label htmlFor={key} className="text-xs">
                                        {label}
                                    </Label>
                                    <Switch
                                        id={key}
                                        checked={rules.clauses[key]}
                                        onCheckedChange={(v) => updateClause(key, v)}
                                    />
                                </div>
                            ),
                        )}
                    </div>
                </div>

                <Separator />

                {/* Gimmicks */}
                <div className="space-y-3">
                    <Label className="text-sm font-semibold">Gimmicks</Label>
                    <div className="grid grid-cols-2 gap-2">
                        {(Object.entries(GIMMICK_LABELS) as [keyof CustomFormatRules["gimmicks"], string][]).map(
                            ([key, label]) => (
                                <div key={key} className="flex items-center justify-between gap-2">
                                    <Label htmlFor={key} className="text-xs">
                                        {label}
                                    </Label>
                                    <Switch
                                        id={key}
                                        checked={rules.gimmicks[key]}
                                        onCheckedChange={(v) => updateGimmick(key, v)}
                                    />
                                </div>
                            ),
                        )}
                    </div>
                </div>

                <Separator />

                {/* Team Composition */}
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="team-size">Team Size</Label>
                        <Input
                            id="team-size"
                            type="number"
                            min={1}
                            max={6}
                            value={rules.teamSize}
                            onChange={(e) =>
                                setRules((prev) => ({
                                    ...prev,
                                    teamSize: Math.max(1, Math.min(6, Number(e.target.value))),
                                }))
                            }
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="level-cap">Level Cap (optional)</Label>
                        <Input
                            id="level-cap"
                            type="number"
                            min={1}
                            max={100}
                            value={rules.levelCap ?? ""}
                            onChange={(e) =>
                                setRules((prev) => ({
                                    ...prev,
                                    levelCap: e.target.value ? Number(e.target.value) : undefined,
                                }))
                            }
                            placeholder="100"
                        />
                    </div>
                </div>

                {/* Item restrictions */}
                <div className="flex gap-6">
                    <div className="flex items-center gap-2">
                        <Switch
                            id="item-clause"
                            checked={rules.itemClause}
                            onCheckedChange={(v) => setRules((prev) => ({ ...prev, itemClause: v }))}
                        />
                        <Label htmlFor="item-clause" className="text-xs">
                            Item Clause
                        </Label>
                    </div>
                    <div className="flex items-center gap-2">
                        <Switch
                            id="no-items"
                            checked={rules.noItems}
                            onCheckedChange={(v) => setRules((prev) => ({ ...prev, noItems: v }))}
                        />
                        <Label htmlFor="no-items" className="text-xs">
                            No Items
                        </Label>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button onClick={handleSave}>Save Format</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
```

- [ ] **Step 3: Run type check**

Run: `cd apps/teambuilder && npx tsc --noEmit`
Expected: PASS (or only pre-existing errors)

- [ ] **Step 4: Commit Tasks 8 + 9 together**

```bash
git add apps/teambuilder/src/components/layout/CustomFormatDialog.tsx apps/teambuilder/src/components/layout/FormatSelector.tsx apps/teambuilder/src/types/pokemon.ts
git commit -m "feat(teambuilder): add Custom Format dialog and FormatSelector entry"
```

---

### Task 10: CustomFormatWarnings component

**Files:**
- Create: `apps/teambuilder/src/components/team/CustomFormatWarnings.tsx`

- [ ] **Step 1: Create the warnings display component**

```tsx
// apps/teambuilder/src/components/team/CustomFormatWarnings.tsx
"use client";

import { useTeamStore } from "@/stores/team-store";
import { validateCustomFormat, type FormatWarning } from "@/lib/validation/custom-format";
import { AlertTriangle, Info } from "lucide-react";
import { cn } from "@/lib/utils";

export function CustomFormatWarnings() {
    const { team, customFormat } = useTeamStore();

    if (!customFormat || team.length === 0) return null;

    const warnings = validateCustomFormat(team, customFormat);
    if (warnings.length === 0) return null;

    return (
        <div className="space-y-1 px-2 py-1">
            {warnings.map((w, i) => (
                <div
                    key={`${w.pokemon ?? "team"}-${i}`}
                    className={cn(
                        "flex items-start gap-2 rounded-md px-3 py-2 text-xs",
                        w.level === "warning" && "bg-amber-500/10 text-amber-400",
                        w.level === "info" && "bg-blue-500/10 text-blue-400",
                        w.level === "error" && "bg-red-500/10 text-red-400",
                    )}
                >
                    {w.level === "info" ? (
                        <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                    ) : (
                        <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                    )}
                    <div>
                        <span>{w.message}</span>
                        {w.suggestion && (
                            <span className="ml-1 text-muted-foreground">{w.suggestion}</span>
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
}
```

- [ ] **Step 2: Wire into page layout**

Find where the team grid is rendered in `apps/teambuilder/src/app/page.tsx` and add `<CustomFormatWarnings />` below it. Look for the existing TeamGrid component and add the warnings right after:

```tsx
import { CustomFormatWarnings } from "@/components/team/CustomFormatWarnings";

// After <TeamGrid /> in the JSX:
<CustomFormatWarnings />
```

- [ ] **Step 3: Run type check and dev server**

Run: `cd apps/teambuilder && npx tsc --noEmit`
Expected: PASS

Run: `cd apps/teambuilder && npm run dev` (manual visual check)

- [ ] **Step 4: Commit**

```bash
git add apps/teambuilder/src/components/team/CustomFormatWarnings.tsx apps/teambuilder/src/app/page.tsx
git commit -m "feat(teambuilder): add custom format warnings display below team grid"
```

---

## Chunk 5: Wire callers to pass customFormat

### Task 11: Update ChatPanel to pass customFormat through streaming

**Files:**
- Find: where `streamChatMessage` is called in the chat components (likely `apps/teambuilder/src/components/chat/ChatPanel.tsx` or similar)

- [ ] **Step 1: Find the call site**

Run: `grep -rn "streamChatMessage" apps/teambuilder/src/ --include="*.tsx" --include="*.ts" | grep -v "node_modules" | grep -v "__tests__"`

- [ ] **Step 2: Update the call site to include customFormat**

At the call site, add `customFormat` from the team store:

```typescript
const { customFormat } = useTeamStore();

// In the streamChatMessage call, add:
customFormat: customFormat ?? undefined,
```

- [ ] **Step 3: Run the full test suite**

Run: `cd apps/teambuilder && npx vitest run`
Expected: All tests PASS

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(teambuilder): wire customFormat from store through chat streaming"
```

---

### Task 12: Update URL loading to handle `&fmt=` param

**Files:**
- Modify: `apps/teambuilder/src/hooks/useUrlTeam.ts` (or wherever URL params are parsed)
- Modify: `apps/teambuilder/src/stores/team-store.ts` if `loadFromUrlParam` needs updating

- [ ] **Step 1: Find URL param handling**

Run: `grep -rn "searchParams\|useSearchParams\|team=" apps/teambuilder/src/ --include="*.tsx" --include="*.ts" | grep -v node_modules | grep -v __tests__`

- [ ] **Step 2: Add fmt param parsing**

At the location where `team=` is parsed from URL params, add parsing for `fmt=`:

```typescript
import { decodeCustomFormat } from "@/types/custom-format";

// After parsing team param:
const fmtParam = searchParams.get("fmt");
if (fmtParam) {
    const customFormat = decodeCustomFormat(fmtParam);
    if (customFormat) {
        useTeamStore.getState().setCustomFormat(customFormat);
    }
}
```

- [ ] **Step 3: Run test suite**

Run: `cd apps/teambuilder && npx vitest run`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(teambuilder): parse custom format from shared URL fmt param"
```

---

### Task 13: Final integration test — run full suite and type check

- [ ] **Step 1: Run all tests**

Run: `cd apps/teambuilder && npx vitest run`
Expected: All PASS

- [ ] **Step 2: Run type check**

Run: `cd apps/teambuilder && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Run linting**

Run: `npm run lint:fix && npm run format`
Expected: PASS

- [ ] **Step 4: Manual smoke test**

Run: `cd apps/teambuilder && npm run dev`
1. Open http://localhost:3000
2. Click format selector → "Custom Format..."
3. Load "Monotype" preset, pick Fire type, save
4. Verify format name shows "Monotype" in header
5. Add a non-Fire Pokemon → verify amber warning appears
6. Send a chat message → verify AI mentions custom format rules
7. Share team → verify URL contains `&fmt=` param

- [ ] **Step 5: Final commit if any lint/format changes**

```bash
git add -A
git commit -m "chore(teambuilder): lint and format custom format files"
```
