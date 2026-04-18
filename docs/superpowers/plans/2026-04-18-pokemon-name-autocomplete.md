# Pokémon Name Autocomplete Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the plain text input in the Pokémon add/edit dialog with a combobox that suggests species from a bundled list, soft-filtered by per-format legality fetched via a new MCP tool.

**Architecture:** Three components — (1) a new `get_legal_pokemon` MCP tool exposing Showdown format-legality data from the server, (2) a bundled canonical Pokémon list derived once from `POKEMON_TYPES`, (3) a `PokemonCombobox` React component built from shadcn's `cmdk` + Radix Popover primitives and wired into `PokemonEditDialog`.

**Tech Stack:** TypeScript, Cloudflare Workers (Zod, Showdown data bundled server-side), Next.js 16, React 19, TanStack Query v5, `cmdk`, `@radix-ui/react-popover`, Tailwind 4, Vitest, React Testing Library.

**Spec:** `docs/superpowers/specs/2026-04-18-pokemon-name-autocomplete-design.md`

---

## File Structure

**Server (`/Users/rborkows/projects/pokeMCP/src/`):**
- Create: `legal-pokemon.ts` — pure function `getLegalPokemon({format})` returning `{ legal: string[] }`.
- Modify: `tool-registry.ts` — register the new tool.
- Create: `__tests__/legal-pokemon.test.ts` — unit tests.

**Client (`/Users/rborkows/projects/pokeMCP/apps/teambuilder/src/`):**
- Modify: `package.json` — add `cmdk`, `@radix-ui/react-popover`.
- Create: `components/ui/command.tsx` — shadcn Command primitive.
- Create: `components/ui/popover.tsx` — shadcn Popover primitive.
- Create: `lib/data/pokemon-list.ts` — derives `POKEMON_LIST` from `POKEMON_TYPES`.
- Modify: `lib/mcp-client.ts` — add `getLegalPokemon()` method + `useLegalPokemon()` hook.
- Create: `components/team/PokemonCombobox.tsx` — the new component.
- Modify: `components/team/PokemonEditDialog.tsx` — replace the `<Input>` at lines 80–88.
- Create: `__tests__/pokemon-list.test.ts`.
- Create: `__tests__/components/PokemonCombobox.test.tsx`.

---

## Task 1: Install new client dependencies

**Files:**
- Modify: `apps/teambuilder/package.json`
- Modify: `apps/teambuilder/package-lock.json`

- [ ] **Step 1: Install cmdk and Radix Popover**

Run from repo root:
```bash
cd apps/teambuilder && npm install cmdk @radix-ui/react-popover
```

Expected: both packages appear in `dependencies` in `apps/teambuilder/package.json`. `package-lock.json` updates.

- [ ] **Step 2: Verify type-check still passes**

Run from repo root:
```bash
cd apps/teambuilder && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/teambuilder/package.json apps/teambuilder/package-lock.json
git commit -m "Add cmdk and Radix Popover deps for Pokemon combobox"
```

---

## Task 2: Add shadcn Command primitive

**Files:**
- Create: `apps/teambuilder/src/components/ui/command.tsx`

- [ ] **Step 1: Create the Command primitive**

Write the file with the standard shadcn Command wrapper (copy verbatim — this is boilerplate; the styling classes use Tailwind 4 conventions already present in the repo):

```tsx
"use client";

import { Command as CommandPrimitive } from "cmdk";
import * as React from "react";
import { cn } from "@/lib/utils";

const Command = React.forwardRef<
    React.ElementRef<typeof CommandPrimitive>,
    React.ComponentPropsWithoutRef<typeof CommandPrimitive>
>(({ className, ...props }, ref) => (
    <CommandPrimitive
        ref={ref}
        className={cn(
            "flex h-full w-full flex-col overflow-hidden rounded-md bg-popover text-popover-foreground",
            className,
        )}
        {...props}
    />
));
Command.displayName = CommandPrimitive.displayName;

const CommandInput = React.forwardRef<
    React.ElementRef<typeof CommandPrimitive.Input>,
    React.ComponentPropsWithoutRef<typeof CommandPrimitive.Input>
>(({ className, ...props }, ref) => (
    <div className="flex items-center border-b px-3" cmdk-input-wrapper="">
        <CommandPrimitive.Input
            ref={ref}
            className={cn(
                "flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50",
                className,
            )}
            {...props}
        />
    </div>
));
CommandInput.displayName = CommandPrimitive.Input.displayName;

const CommandList = React.forwardRef<
    React.ElementRef<typeof CommandPrimitive.List>,
    React.ComponentPropsWithoutRef<typeof CommandPrimitive.List>
>(({ className, ...props }, ref) => (
    <CommandPrimitive.List
        ref={ref}
        className={cn("max-h-80 overflow-y-auto overflow-x-hidden", className)}
        {...props}
    />
));
CommandList.displayName = CommandPrimitive.List.displayName;

const CommandEmpty = React.forwardRef<
    React.ElementRef<typeof CommandPrimitive.Empty>,
    React.ComponentPropsWithoutRef<typeof CommandPrimitive.Empty>
>((props, ref) => (
    <CommandPrimitive.Empty ref={ref} className="py-6 text-center text-sm" {...props} />
));
CommandEmpty.displayName = CommandPrimitive.Empty.displayName;

const CommandGroup = React.forwardRef<
    React.ElementRef<typeof CommandPrimitive.Group>,
    React.ComponentPropsWithoutRef<typeof CommandPrimitive.Group>
>(({ className, ...props }, ref) => (
    <CommandPrimitive.Group
        ref={ref}
        className={cn(
            "overflow-hidden p-1 text-foreground [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:text-muted-foreground",
            className,
        )}
        {...props}
    />
));
CommandGroup.displayName = CommandPrimitive.Group.displayName;

const CommandItem = React.forwardRef<
    React.ElementRef<typeof CommandPrimitive.Item>,
    React.ComponentPropsWithoutRef<typeof CommandPrimitive.Item>
>(({ className, ...props }, ref) => (
    <CommandPrimitive.Item
        ref={ref}
        className={cn(
            "relative flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none data-[disabled=true]:pointer-events-none data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground data-[disabled=true]:opacity-50",
            className,
        )}
        {...props}
    />
));
CommandItem.displayName = CommandPrimitive.Item.displayName;

export { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList };
```

- [ ] **Step 2: Type-check**

```bash
cd apps/teambuilder && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/teambuilder/src/components/ui/command.tsx
git commit -m "Add shadcn Command primitive"
```

---

## Task 3: Add shadcn Popover primitive

**Files:**
- Create: `apps/teambuilder/src/components/ui/popover.tsx`

- [ ] **Step 1: Create the Popover primitive**

```tsx
"use client";

import * as PopoverPrimitive from "@radix-ui/react-popover";
import * as React from "react";
import { cn } from "@/lib/utils";

const Popover = PopoverPrimitive.Root;
const PopoverTrigger = PopoverPrimitive.Trigger;
const PopoverAnchor = PopoverPrimitive.Anchor;

const PopoverContent = React.forwardRef<
    React.ElementRef<typeof PopoverPrimitive.Content>,
    React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>
>(({ className, align = "start", sideOffset = 4, ...props }, ref) => (
    <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
            ref={ref}
            align={align}
            sideOffset={sideOffset}
            className={cn(
                "z-50 w-72 rounded-md border bg-popover p-0 text-popover-foreground shadow-md outline-none",
                className,
            )}
            {...props}
        />
    </PopoverPrimitive.Portal>
));
PopoverContent.displayName = PopoverPrimitive.Content.displayName;

export { Popover, PopoverAnchor, PopoverContent, PopoverTrigger };
```

- [ ] **Step 2: Type-check**

```bash
cd apps/teambuilder && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/teambuilder/src/components/ui/popover.tsx
git commit -m "Add shadcn Popover primitive"
```

---

## Task 4: Server — derive canonical legal list (TDD, failing tests first)

**Files:**
- Create: `src/legal-pokemon.ts`
- Create: `src/__tests__/legal-pokemon.test.ts`

**Context for the implementer:** The server already exposes `getPokedex()` (from `src/data-loader.ts`) which returns an object keyed by Showdown ID. Each entry has `num`, `name`, and optional `isNonstandard` + `baseSpecies`. The `getPokemonFormatData(name)` function returns `{ tier?, doublesTier?, natDexTier?, isNonstandard? }` from `src/data/formats-data.ts`. Champions regulation formats have their own allow-list reachable via `loadRegulation(id, env)` from `src/regulations/loader.ts`, returning `{ allowedPokemonIds: Set<string> }`.

Legality heuristic:
1. Parse generation number from format ID: `gen9ou` → 9, `champions-regma` → Champions branch.
2. For Champions/regulation formats: return `Array.from(allowedPokemonIds)`.
3. For other formats: iterate Pokédex; include entries where:
   - `species.num > 0` (exclude negative "meta" entries)
   - pokedex `species.isNonstandard` is not `"CAP"`, not `"Unobtainable"`, not `"Future"`
   - `formatData.isNonstandard !== "Past"` when the requested gen is 9 (i.e. the species exists in Gen 9); generations < 9 fall back to including the entry as long as its `num` is ≤ that gen's max Dex number (Gen 7: 807, Gen 8: 905, Gen 9: 1025 — use constants).
   - For singles formats (match `/^gen\d+(ou|uu|ru|nu|pu|lc|zu)$/`): exclude species whose `formatData.tier` equals `"Uber"` or `"AG"`. This is an approximation; it keeps the UX useful without requiring a full tier chart.
   - For `gen*ubers`: no extra tier filtering.
   - For `gen*doubles*`, `gen*vgc*`, `gen*bss*`: skip tier filtering (doubles/VGC legality is driven by format banlists that we aren't modeling here — empty or approximate is acceptable; return everything that passes the gen + nonstandard checks).

- [ ] **Step 1: Write the failing tests**

Create `src/__tests__/legal-pokemon.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { getLegalPokemon } from "../legal-pokemon.js";

// Mock env only needed for Champions branch; pass undefined for non-Champions.
const ENV_STUB = undefined as unknown as Env;

describe("getLegalPokemon", () => {
    it("returns a non-empty list for gen9ou", async () => {
        const result = await getLegalPokemon({ format: "gen9ou" }, ENV_STUB);
        expect(result.legal.length).toBeGreaterThan(100);
    });

    it("returns only canonical IDs (lowercase alphanumerics)", async () => {
        const { legal } = await getLegalPokemon({ format: "gen9ou" }, ENV_STUB);
        for (const id of legal) {
            expect(id).toMatch(/^[a-z0-9]+$/);
        }
    });

    it("excludes Uber species in gen9ou", async () => {
        const { legal } = await getLegalPokemon({ format: "gen9ou" }, ENV_STUB);
        // Koraidon and Miraidon are Ubers in Gen 9 OU
        expect(legal).not.toContain("koraidon");
        expect(legal).not.toContain("miraidon");
    });

    it("includes Uber species in gen9ubers", async () => {
        const { legal } = await getLegalPokemon({ format: "gen9ubers" }, ENV_STUB);
        expect(legal).toContain("koraidon");
    });

    it("excludes Past-only forms from Gen 9 formats", async () => {
        const { legal } = await getLegalPokemon({ format: "gen9ou" }, ENV_STUB);
        // Mega evolutions are "Past" in Gen 9 and should not appear
        expect(legal).not.toContain("charizardmegax");
    });

    it("returns an empty array for unknown formats", async () => {
        const { legal } = await getLegalPokemon({ format: "totally-fake" }, ENV_STUB);
        expect(legal).toEqual([]);
    });

    // Champions formats need a KV binding to hydrate their allow-list.
    // Add a dedicated integration test under a separate worker-test harness
    // as follow-up; leave as .todo here so the red flag is visible.
    it.todo("returns the regulation allow-list for Champions formats");
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/rborkows/projects/pokeMCP && npx vitest run src/__tests__/legal-pokemon.test.ts
```

Expected: all tests fail with "Cannot find module '../legal-pokemon.js'".

- [ ] **Step 3: Implement `legal-pokemon.ts`**

Create `src/legal-pokemon.ts`:

```ts
import { getPokedex, getPokemonFormatData, toID } from "./data-loader.js";
import { isRegulationId } from "./regulations/registry.js";
import { loadRegulation } from "./regulations/loader.js";

const MAX_DEX_NUM_BY_GEN: Record<number, number> = {
    7: 807,
    8: 905,
    9: 1025,
};

const SINGLES_TIER_FORMAT_RE = /^gen\d+(ou|uu|ru|nu|pu|lc|zu)$/;
const UBER_TIERS = new Set(["Uber", "AG"]);

function parseGenFromFormat(format: string): number | null {
    const m = format.match(/^gen(\d+)/);
    return m ? Number.parseInt(m[1], 10) : null;
}

export async function getLegalPokemon(
    args: { format: string },
    env: Env,
): Promise<{ legal: string[] }> {
    const format = args.format.toLowerCase().trim();
    if (!format) return { legal: [] };

    // Champions / regulation formats: use the allow-list from the registry.
    if (isRegulationId(format)) {
        try {
            const regulation = await loadRegulation(format, env);
            return { legal: Array.from(regulation.allowedPokemonIds) };
        } catch {
            return { legal: [] };
        }
    }

    const gen = parseGenFromFormat(format);
    if (gen === null) return { legal: [] };

    const maxDex = MAX_DEX_NUM_BY_GEN[gen];
    if (!maxDex) return { legal: [] };

    const isSinglesTierFormat = SINGLES_TIER_FORMAT_RE.test(format);

    const pokedex = getPokedex();
    const legal: string[] = [];

    for (const [id, species] of Object.entries(pokedex)) {
        if (species.num <= 0) continue;
        if (species.num > maxDex) continue;

        // Exclude CAP (Create-A-Pokémon) and Pokestar "species" from the dex.
        if (species.isNonstandard) continue;

        const fd = getPokemonFormatData(species.name);

        // For Gen 9, "Past" format-data means the form is not in Gen 9 (e.g. Megas).
        if (gen === 9 && fd?.isNonstandard === "Past") continue;

        // Soft singles tier filter — drop Ubers from OU-and-below formats.
        if (isSinglesTierFormat && fd?.tier && UBER_TIERS.has(fd.tier)) continue;

        legal.push(toID(id));
    }

    return { legal };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Users/rborkows/projects/pokeMCP && npx vitest run src/__tests__/legal-pokemon.test.ts
```

Expected: all non-skipped tests pass.

- [ ] **Step 5: Type-check**

```bash
cd /Users/rborkows/projects/pokeMCP && npm run type-check
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/legal-pokemon.ts src/__tests__/legal-pokemon.test.ts
git commit -m "Add getLegalPokemon server helper with format-aware filtering"
```

---

## Task 5: Server — register `get_legal_pokemon` in tool registry

**Files:**
- Modify: `src/tool-registry.ts`

- [ ] **Step 1: Import and register**

At the top of `src/tool-registry.ts`, add to the imports:

```ts
import { getLegalPokemon } from "./legal-pokemon.js";
```

Then append a new entry to `TOOL_REGISTRY` (after the existing entries, before the closing `];`):

```ts
{
    name: "get_legal_pokemon",
    description: "Return canonical Pokémon IDs legal in a given format (soft-filtered: used for autocomplete grouping, not full legality enforcement)",
    schema: {
        format: z.string().describe("Format ID, e.g. 'gen9ou' or 'champions-regma'"),
    },
    execute: async (args, env) => {
        const result = await getLegalPokemon(args as { format: string }, env);
        return JSON.stringify(result);
    },
},
```

- [ ] **Step 2: Type-check**

```bash
cd /Users/rborkows/projects/pokeMCP && npm run type-check
```

Expected: no errors.

- [ ] **Step 3: Lint**

```bash
cd /Users/rborkows/projects/pokeMCP && npm run lint
```

Expected: no errors (run `npm run lint:fix` if only fixable issues appear).

- [ ] **Step 4: Commit**

```bash
git add src/tool-registry.ts
git commit -m "Register get_legal_pokemon MCP tool"
```

---

## Task 6: Client — `useLegalPokemon` hook

**Files:**
- Modify: `apps/teambuilder/src/lib/mcp-client.ts`

- [ ] **Step 1: Add the client method**

Inside the `MCPClient` class in `apps/teambuilder/src/lib/mcp-client.ts`, add a new method alongside the other tool wrappers (e.g. right after `queryStrategy`):

```ts
async getLegalPokemon(format: string) {
    return this.callTool<{ legal: string[] }>("get_legal_pokemon", { format });
}
```

- [ ] **Step 2: Add the React Query hook**

Near the bottom of the same file, alongside the other `useQuery`-based hooks (e.g. `usePokemonLookup`), add:

```ts
export function useLegalPokemon(format: string) {
    return useQuery({
        queryKey: ["legal-pokemon", format],
        queryFn: async () => {
            const response = await mcpClient.getLegalPokemon(format);
            return new Set(response.legal);
        },
        enabled: !!format,
        staleTime: Number.POSITIVE_INFINITY, // legality is stable within a session
    });
}
```

- [ ] **Step 3: Type-check**

```bash
cd apps/teambuilder && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/teambuilder/src/lib/mcp-client.ts
git commit -m "Add useLegalPokemon hook for autocomplete grouping"
```

---

## Task 7: Client — derive canonical `POKEMON_LIST` (TDD, failing tests first)

**Files:**
- Create: `apps/teambuilder/src/lib/data/pokemon-list.ts`
- Create: `apps/teambuilder/src/__tests__/pokemon-list.test.ts`

**Context for the implementer:** `POKEMON_TYPES` (in `apps/teambuilder/src/lib/data/pokemon-data-generated.ts`) has three keys per form: compact (`charizardmegax`), hyphenated (`charizard-mega-x`), spaced (`charizard mega x`). The canonical ID we want is the compact form. Display names come from title-casing the hyphenated variant — e.g. `charizard-mega-x` → `Charizard-Mega-X`. Base species with no form variant just get capitalized (`charizard` → `Charizard`).

- [ ] **Step 1: Write the failing tests**

Create `apps/teambuilder/src/__tests__/pokemon-list.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { POKEMON_LIST } from "@/lib/data/pokemon-list";

describe("POKEMON_LIST", () => {
    it("has entries in the expected size range", () => {
        expect(POKEMON_LIST.length).toBeGreaterThan(1400);
        expect(POKEMON_LIST.length).toBeLessThan(2500);
    });

    it("has unique canonical IDs", () => {
        const ids = new Set(POKEMON_LIST.map((p) => p.id));
        expect(ids.size).toBe(POKEMON_LIST.length);
    });

    it("canonical IDs contain only lowercase alphanumerics", () => {
        for (const p of POKEMON_LIST) {
            expect(p.id).toMatch(/^[a-z0-9]+$/);
        }
    });

    it("includes key base species with capitalized display names", () => {
        const pikachu = POKEMON_LIST.find((p) => p.id === "pikachu");
        expect(pikachu).toBeDefined();
        expect(pikachu?.displayName).toBe("Pikachu");
    });

    it("formats Mega forms as 'Charizard-Mega-X'", () => {
        const megaX = POKEMON_LIST.find((p) => p.id === "charizardmegax");
        expect(megaX).toBeDefined();
        expect(megaX?.displayName).toBe("Charizard-Mega-X");
    });

    it("formats Therian forms as 'Landorus-Therian'", () => {
        const entry = POKEMON_LIST.find((p) => p.id === "landorustherian");
        expect(entry).toBeDefined();
        expect(entry?.displayName).toBe("Landorus-Therian");
    });

    it("is sorted alphabetically by displayName", () => {
        for (let i = 1; i < POKEMON_LIST.length; i++) {
            expect(
                POKEMON_LIST[i - 1].displayName.localeCompare(POKEMON_LIST[i].displayName),
            ).toBeLessThanOrEqual(0);
        }
    });

    it("attaches the species types array", () => {
        const pikachu = POKEMON_LIST.find((p) => p.id === "pikachu");
        expect(pikachu?.types).toEqual(["Electric"]);
    });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd apps/teambuilder && npx vitest run src/__tests__/pokemon-list.test.ts
```

Expected: all tests fail with "Cannot find module '@/lib/data/pokemon-list'".

- [ ] **Step 3: Implement `pokemon-list.ts`**

Create `apps/teambuilder/src/lib/data/pokemon-list.ts`:

```ts
import { POKEMON_TYPES } from "./pokemon-data-generated";

// POKEMON_TYPES' inner type isn't exported (the file is auto-generated), so
// we use string[] here. Validation/UI code already treats types as strings.
export interface PokemonListEntry {
    id: string;
    displayName: string;
    types: string[];
}

function capitalize(word: string): string {
    if (!word) return word;
    return word[0].toUpperCase() + word.slice(1);
}

function titleCaseHyphenated(hyphenated: string): string {
    return hyphenated.split("-").map(capitalize).join("-");
}

function buildList(): PokemonListEntry[] {
    // Group POKEMON_TYPES keys by canonical ID (the compact key with no
    // hyphens and no spaces).
    const canonical = new Map<string, { hyphenated?: string; types: string[] }>();

    for (const [key, types] of Object.entries(POKEMON_TYPES) as Array<[string, string[]]>) {
        const compact = key.replace(/[-\s]/g, "").toLowerCase();
        const entry = canonical.get(compact) ?? { types };
        if (key === compact) {
            // The canonical (compact) key — register baseline.
            canonical.set(compact, entry);
            continue;
        }
        if (key.includes("-") && !key.includes(" ")) {
            entry.hyphenated = key;
        }
        canonical.set(compact, entry);
    }

    const list: PokemonListEntry[] = [];
    for (const [id, entry] of canonical.entries()) {
        const displayName = entry.hyphenated
            ? titleCaseHyphenated(entry.hyphenated)
            : capitalize(id);
        list.push({ id, displayName, types: entry.types });
    }

    list.sort((a, b) => a.displayName.localeCompare(b.displayName));
    return list;
}

export const POKEMON_LIST: readonly PokemonListEntry[] = buildList();
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd apps/teambuilder && npx vitest run src/__tests__/pokemon-list.test.ts
```

Expected: all tests pass. If the "size range" test fails because `POKEMON_TYPES` is larger/smaller than expected, adjust the bounds to match actual count and commit. If display-name tests fail, inspect the offending entry and refine `titleCaseHyphenated` / `capitalize` for the edge case.

- [ ] **Step 5: Commit**

```bash
git add apps/teambuilder/src/lib/data/pokemon-list.ts apps/teambuilder/src/__tests__/pokemon-list.test.ts
git commit -m "Add canonical POKEMON_LIST derivation from POKEMON_TYPES"
```

---

## Task 8: Client — `PokemonCombobox` skeleton (popover + input + static list)

**Files:**
- Create: `apps/teambuilder/src/components/team/PokemonCombobox.tsx`
- Create: `apps/teambuilder/src/__tests__/components/PokemonCombobox.test.tsx`

**Context:** Build the component incrementally across Tasks 8, 9, 10, 11. Task 8 gets the popover opening and rendering an ungrouped list of suggestions with substring filtering. Sprites and legality grouping come later.

- [ ] **Step 1: Write the failing tests**

Create `apps/teambuilder/src/__tests__/components/PokemonCombobox.test.tsx`:

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PokemonCombobox } from "@/components/team/PokemonCombobox";

// Stub out useLegalPokemon — we test grouping separately in Task 11.
vi.mock("@/lib/mcp-client", async () => {
    const actual = await vi.importActual<Record<string, unknown>>("@/lib/mcp-client");
    return {
        ...actual,
        useLegalPokemon: () => ({ data: undefined, isLoading: false }),
    };
});

function renderWithClient(ui: React.ReactElement) {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

describe("PokemonCombobox", () => {
    it("renders the current value in the trigger input", () => {
        renderWithClient(
            <PokemonCombobox value="Pikachu" onChange={() => {}} format="gen9ou" />,
        );
        expect(screen.getByDisplayValue("Pikachu")).toBeInTheDocument();
    });

    it("opens the popover on focus and shows suggestions", () => {
        renderWithClient(<PokemonCombobox value="" onChange={() => {}} format="gen9ou" />);
        const input = screen.getByRole("combobox");
        fireEvent.focus(input);
        // When open with empty query, the list should render many items; check one
        // reliable option is present.
        expect(screen.getByText("Pikachu")).toBeInTheDocument();
    });

    it("substring-filters suggestions", () => {
        renderWithClient(<PokemonCombobox value="" onChange={() => {}} format="gen9ou" />);
        const input = screen.getByRole("combobox");
        fireEvent.focus(input);
        fireEvent.change(input, { target: { value: "therian" } });
        expect(screen.getByText("Landorus-Therian")).toBeInTheDocument();
        expect(screen.queryByText("Pikachu")).not.toBeInTheDocument();
    });

    it("calls onChange with the canonical display name when a suggestion is clicked", () => {
        const onChange = vi.fn();
        renderWithClient(<PokemonCombobox value="" onChange={onChange} format="gen9ou" />);
        const input = screen.getByRole("combobox");
        fireEvent.focus(input);
        fireEvent.change(input, { target: { value: "landorus-th" } });
        fireEvent.click(screen.getByText("Landorus-Therian"));
        expect(onChange).toHaveBeenCalledWith("Landorus-Therian");
    });

    it("shows an empty state when no suggestions match", () => {
        renderWithClient(<PokemonCombobox value="" onChange={() => {}} format="gen9ou" />);
        const input = screen.getByRole("combobox");
        fireEvent.focus(input);
        fireEvent.change(input, { target: { value: "zzzzzzz" } });
        expect(screen.getByText(/No Pokémon match/i)).toBeInTheDocument();
    });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd apps/teambuilder && npx vitest run src/__tests__/components/PokemonCombobox.test.tsx
```

Expected: all tests fail with "Cannot find module '@/components/team/PokemonCombobox'".

- [ ] **Step 3: Implement the component skeleton**

Create `apps/teambuilder/src/components/team/PokemonCombobox.tsx`:

```tsx
"use client";

import { ChevronsUpDown } from "lucide-react";
import * as React from "react";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { POKEMON_LIST } from "@/lib/data/pokemon-list";
import { useLegalPokemon } from "@/lib/mcp-client";
import { cn } from "@/lib/utils";

interface PokemonComboboxProps {
    value: string;
    onChange: (name: string) => void;
    format: string;
    id?: string;
    placeholder?: string;
}

export function PokemonCombobox({
    value,
    onChange,
    format,
    id,
    placeholder,
}: PokemonComboboxProps) {
    const [open, setOpen] = React.useState(false);
    const [query, setQuery] = React.useState(value);

    // Keep internal query in sync when the parent resets the value.
    React.useEffect(() => {
        setQuery(value);
    }, [value]);

    // Substring filter — overrides cmdk's default fuzzy scorer.
    const substringFilter = React.useCallback(
        (itemValue: string, search: string) =>
            itemValue.toLowerCase().includes(search.toLowerCase()) ? 1 : 0,
        [],
    );

    // Legality data — unused here, wired in Task 11.
    useLegalPokemon(format);

    const handleSelect = (displayName: string) => {
        onChange(displayName);
        setQuery(displayName);
        setOpen(false);
    };

    const handleInputChange = (next: string) => {
        setQuery(next);
        onChange(next);
        if (!open) setOpen(true);
    };

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <div className="relative">
                    <input
                        id={id}
                        role="combobox"
                        aria-expanded={open}
                        value={query}
                        placeholder={placeholder}
                        onFocus={() => setOpen(true)}
                        onChange={(e) => handleInputChange(e.target.value)}
                        className={cn(
                            "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 pr-8 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
                        )}
                    />
                    <ChevronsUpDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 opacity-50" />
                </div>
            </PopoverTrigger>
            <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                <Command filter={substringFilter}>
                    <CommandInput
                        value={query}
                        onValueChange={handleInputChange}
                        placeholder="Search Pokémon…"
                    />
                    <CommandList>
                        <CommandEmpty>No Pokémon match "{query}"</CommandEmpty>
                        <CommandGroup heading="All Pokémon">
                            {POKEMON_LIST.map((p) => (
                                <CommandItem
                                    key={p.id}
                                    value={p.displayName}
                                    onSelect={() => handleSelect(p.displayName)}
                                >
                                    {p.displayName}
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd apps/teambuilder && npx vitest run src/__tests__/components/PokemonCombobox.test.tsx
```

Expected: all tests pass. If the "opens on focus and shows Pikachu" test fails because cmdk hides items before the user types, relax to look for `screen.getAllByRole("option").length > 0` instead.

- [ ] **Step 5: Type-check**

```bash
cd apps/teambuilder && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add apps/teambuilder/src/components/team/PokemonCombobox.tsx apps/teambuilder/src/__tests__/components/PokemonCombobox.test.tsx
git commit -m "Add PokemonCombobox skeleton with substring filter"
```

---

## Task 9: Client — add sprite rendering to combobox rows

**Files:**
- Modify: `apps/teambuilder/src/components/team/PokemonCombobox.tsx`
- Modify: `apps/teambuilder/src/__tests__/components/PokemonCombobox.test.tsx`

- [ ] **Step 1: Add a sprite assertion to the test**

In `apps/teambuilder/src/__tests__/components/PokemonCombobox.test.tsx`, add a new test after the existing ones (inside the `describe`):

```tsx
it("renders a sprite next to each suggestion", () => {
    renderWithClient(<PokemonCombobox value="" onChange={() => {}} format="gen9ou" />);
    const input = screen.getByRole("combobox");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "pikachu" } });
    // PokemonSprite renders an <img alt={pokemon}> inside each option.
    expect(screen.getByAltText("Pikachu")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run to verify the new test fails**

```bash
cd apps/teambuilder && npx vitest run src/__tests__/components/PokemonCombobox.test.tsx
```

Expected: only the new "renders a sprite" test fails.

- [ ] **Step 3: Render a sprite inside each `CommandItem`**

In `apps/teambuilder/src/components/team/PokemonCombobox.tsx`, add an import:

```tsx
import { PokemonSprite } from "./PokemonSprite";
```

Then update each `CommandItem` body from:
```tsx
<CommandItem key={p.id} value={p.displayName} onSelect={() => handleSelect(p.displayName)}>
    {p.displayName}
</CommandItem>
```
to:
```tsx
<CommandItem key={p.id} value={p.displayName} onSelect={() => handleSelect(p.displayName)}>
    <PokemonSprite pokemon={p.displayName} size="sm" className="shrink-0" />
    <span>{p.displayName}</span>
</CommandItem>
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd apps/teambuilder && npx vitest run src/__tests__/components/PokemonCombobox.test.tsx
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/teambuilder/src/components/team/PokemonCombobox.tsx apps/teambuilder/src/__tests__/components/PokemonCombobox.test.tsx
git commit -m "Render sprites in PokemonCombobox rows"
```

---

## Task 10: Client — legality grouping (legal + other)

**Files:**
- Modify: `apps/teambuilder/src/components/team/PokemonCombobox.tsx`
- Modify: `apps/teambuilder/src/__tests__/components/PokemonCombobox.test.tsx`

- [ ] **Step 1: Add the grouping tests**

In `apps/teambuilder/src/__tests__/components/PokemonCombobox.test.tsx`, ADD (don't replace) the following tests inside the `describe` block. These tests rewire the `useLegalPokemon` mock on a per-test basis using `vi.doMock` isolation — use `vi.mocked` if already imported. The simplest pattern given the top-level `vi.mock` is to promote the mock to a stateful stub:

Replace the top-level mock block with:
```tsx
const legalPokemonStub: { data: Set<string> | undefined; isLoading: boolean } = {
    data: undefined,
    isLoading: false,
};
vi.mock("@/lib/mcp-client", async () => {
    const actual = await vi.importActual<Record<string, unknown>>("@/lib/mcp-client");
    return {
        ...actual,
        useLegalPokemon: () => legalPokemonStub,
    };
});

// Reset the stub between tests so earlier tests don't leak grouping state.
import { beforeEach } from "vitest";
beforeEach(() => {
    legalPokemonStub.data = undefined;
    legalPokemonStub.isLoading = false;
});
```

Then add tests:
```tsx
it("shows an ungrouped list while legality is loading", () => {
    legalPokemonStub.data = undefined;
    legalPokemonStub.isLoading = true;
    renderWithClient(<PokemonCombobox value="" onChange={() => {}} format="gen9ou" />);
    fireEvent.focus(screen.getByRole("combobox"));
    expect(screen.queryByText(/Legal in/i)).not.toBeInTheDocument();
    expect(screen.getByText(/All Pokémon/i)).toBeInTheDocument();
});

it("groups results into 'Legal in {format}' and 'Other' when legality is available", () => {
    legalPokemonStub.data = new Set(["pikachu"]);
    legalPokemonStub.isLoading = false;
    renderWithClient(<PokemonCombobox value="" onChange={() => {}} format="gen9ou" />);
    fireEvent.focus(screen.getByRole("combobox"));
    expect(screen.getByText(/Legal in gen9ou/i)).toBeInTheDocument();
    expect(screen.getByText("Other")).toBeInTheDocument();
});

it("skips the 'Other' group when all filtered results are legal", () => {
    legalPokemonStub.data = new Set(["pikachu"]);
    legalPokemonStub.isLoading = false;
    renderWithClient(<PokemonCombobox value="" onChange={() => {}} format="gen9ou" />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "pikachu" } });
    expect(screen.queryByText("Other")).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd apps/teambuilder && npx vitest run src/__tests__/components/PokemonCombobox.test.tsx
```

Expected: the new grouping tests fail.

- [ ] **Step 3: Implement grouping in the component**

In `apps/teambuilder/src/components/team/PokemonCombobox.tsx`, replace the single-group body with dynamic grouping:

```tsx
const { data: legalSet } = useLegalPokemon(format);

const { legal, other } = React.useMemo(() => {
    if (!legalSet || legalSet.size === 0) {
        return { legal: null, other: null };
    }
    const legalRows: typeof POKEMON_LIST = [];
    const otherRows: typeof POKEMON_LIST = [];
    for (const p of POKEMON_LIST) {
        if (legalSet.has(p.id)) legalRows.push(p);
        else otherRows.push(p);
    }
    return { legal: legalRows, other: otherRows };
}, [legalSet]);
```

Then render the three cases. Replace the single `CommandGroup` with:

```tsx
{legal === null || other === null ? (
    <CommandGroup heading="All Pokémon">
        {POKEMON_LIST.map((p) => (
            <CommandItem
                key={p.id}
                value={p.displayName}
                onSelect={() => handleSelect(p.displayName)}
            >
                <PokemonSprite pokemon={p.displayName} size="sm" className="shrink-0" />
                <span>{p.displayName}</span>
            </CommandItem>
        ))}
    </CommandGroup>
) : (
    <>
        <CommandGroup heading={`Legal in ${format}`}>
            {legal.map((p) => (
                <CommandItem
                    key={p.id}
                    value={p.displayName}
                    onSelect={() => handleSelect(p.displayName)}
                >
                    <PokemonSprite pokemon={p.displayName} size="sm" className="shrink-0" />
                    <span>{p.displayName}</span>
                </CommandItem>
            ))}
        </CommandGroup>
        <CommandGroup heading="Other">
            {other.map((p) => (
                <CommandItem
                    key={p.id}
                    value={p.displayName}
                    onSelect={() => handleSelect(p.displayName)}
                    className="opacity-60"
                >
                    <PokemonSprite pokemon={p.displayName} size="sm" className="shrink-0" />
                    <span>{p.displayName}</span>
                </CommandItem>
            ))}
        </CommandGroup>
    </>
)}
```

**Note on "skips 'Other' when all filtered results are legal":** `cmdk` automatically hides a `CommandGroup` when all its items are filtered out (they receive `data-hidden`), so no extra JS logic is needed for that test.

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd apps/teambuilder && npx vitest run src/__tests__/components/PokemonCombobox.test.tsx
```

Expected: all tests pass.

- [ ] **Step 5: Type-check**

```bash
cd apps/teambuilder && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add apps/teambuilder/src/components/team/PokemonCombobox.tsx apps/teambuilder/src/__tests__/components/PokemonCombobox.test.tsx
git commit -m "Group combobox suggestions by format legality"
```

---

## Task 11: Wire `PokemonCombobox` into `PokemonEditDialog`

**Files:**
- Modify: `apps/teambuilder/src/components/team/PokemonEditDialog.tsx`

- [ ] **Step 1: Replace the `<Input>` block with the combobox**

Open `apps/teambuilder/src/components/team/PokemonEditDialog.tsx`. Add an import next to the other team-component imports:

```tsx
import { PokemonCombobox } from "./PokemonCombobox";
```

Remove the `Input` import if it becomes unused (also check the nickname field — if that still uses `<Input>`, keep the import).

Replace lines 80–88 (the Pokémon name block):

```tsx
{/* Pokemon Name */}
<div className="space-y-2">
    <label htmlFor="edit-pokemon-name" className="text-sm font-medium">Pokemon</label>
    <Input
        id="edit-pokemon-name"
        value={editedPokemon.pokemon}
        onChange={(e) => updateField("pokemon", e.target.value)}
        placeholder="e.g. Garchomp, Landorus-Therian"
    />
</div>
```

with:

```tsx
{/* Pokemon Name */}
<div className="space-y-2">
    <label htmlFor="edit-pokemon-name" className="text-sm font-medium">Pokemon</label>
    <PokemonCombobox
        id="edit-pokemon-name"
        value={editedPokemon.pokemon}
        onChange={(name) => updateField("pokemon", name)}
        format={format}
        placeholder="e.g. Garchomp, Landorus-Therian"
    />
</div>
```

- [ ] **Step 2: Type-check**

```bash
cd apps/teambuilder && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Run the full teambuilder test suite**

```bash
cd apps/teambuilder && npm run test:run
```

Expected: all tests pass. If pre-existing tests against `PokemonEditDialog` assert against a plain `<input>` for the Pokémon name, update them to use the combobox's `role="combobox"` selector or stub the combobox. Minimal edits only — do not rewrite unrelated tests.

- [ ] **Step 4: Lint**

```bash
cd apps/teambuilder && npx biome check src/components/team/PokemonEditDialog.tsx src/components/team/PokemonCombobox.tsx
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add apps/teambuilder/src/components/team/PokemonEditDialog.tsx
git commit -m "Use PokemonCombobox for species field in edit dialog"
```

---

## Task 12: Full verification

**Files:** none modified

- [ ] **Step 1: Run the root type-check**

```bash
cd /Users/rborkows/projects/pokeMCP && npm run type-check
```

Expected: no errors.

- [ ] **Step 2: Run the root lint**

```bash
cd /Users/rborkows/projects/pokeMCP && npm run lint
```

Expected: no errors. Run `npm run lint:fix` and re-run if fixable-only issues appear.

- [ ] **Step 3: Run server tests**

```bash
cd /Users/rborkows/projects/pokeMCP && npx vitest run
```

Expected: all tests pass.

- [ ] **Step 4: Run teambuilder tests**

```bash
cd apps/teambuilder && npm run test:run
```

Expected: all tests pass.

- [ ] **Step 5: Manual smoke test**

Start both local services — the MCP Worker (so `useLegalPokemon` has a real backend) and the teambuilder:

```bash
# Terminal 1
cd /Users/rborkows/projects/pokeMCP && npm run dev
# Terminal 2
cd /Users/rborkows/projects/pokeMCP && npm run dev:teambuilder
```

Open http://localhost:3000, click an empty team slot to open "Add Pokemon". Verify:
1. Focus on the Pokémon field opens a dropdown with a scrollable list.
2. Typing "therian" narrows to Landorus-Therian, Thundurus-Therian, Tornadus-Therian.
3. Rows display a sprite + name.
4. After a brief moment (first-time MCP round trip), the list splits into "Legal in gen9ou" and "Other", with Ubers (Koraidon, Miraidon) dimmed under "Other".
5. Selecting a row populates the field; the existing ability/moves enrichment still fires.
6. Switch the format (e.g. to `gen9ubers` via the format selector) and reopen the dialog — Ubers now appear under "Legal in gen9ubers".

If any of these fail, fix in a follow-up commit before considering the plan done.

- [ ] **Step 6: Final commit (only if any fixes applied above)**

Nothing to do if Step 5 passed clean.

---

## Out of scope (deferred per spec)

- Virtualized dropdown (unnecessary at ~1,500 rows).
- Recent/frequently-used picks surfaced at the top.
- Fuzzy matching.
- National Pokédex ordering.
- Type-colored badges on rows.
- Hard format filter (soft filter chosen deliberately).
- Doubles/VGC tier-based filtering (returns the full gen list in those formats).
