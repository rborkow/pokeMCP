# Pokémon Name Autocomplete

**Date:** 2026-04-18
**Status:** Approved

## Problem

The "Add Pokémon" / "Edit Pokémon" dialog (`apps/teambuilder/src/components/team/PokemonEditDialog.tsx`) uses a plain text input for the species name. Users must know the exact canonical spelling (e.g. `Landorus-Therian`, `Charizard-Mega-X`) before downstream enrichment (abilities, popular moves, popular items) can fire. Typos silently disable enrichment and produce invalid teams.

## Decision Summary

- **Data source:** Hybrid — local `POKEMON_TYPES` for name suggestions, MCP for legality and the existing ability/move enrichment.
- **UI pattern:** shadcn combobox (`cmdk` + `@radix-ui/react-popover`).
- **Row content:** sprite + display name.
- **Open trigger:** on focus, always.
- **Match:** substring (contains), case-insensitive. No fuzzy matching.
- **Legality:** soft filter — legal group first, "Other" group dimmed below, never hard-hidden.
- **Delivery:** single PR covering both MCP Worker and teambuilder surfaces.

---

## Architecture

Three components:

1. **New MCP tool `get_legal_pokemon`** — server-side, returns legal species IDs for a format.
2. **New client hook `useLegalPokemon(format)`** — TanStack Query wrapper, caches `staleTime: Infinity` per format.
3. **New client component `PokemonCombobox`** — drop-in replacement for the current `<Input>` in the dialog.

### Data flow

```
POKEMON_TYPES (bundled)
  → derive canonical POKEMON_LIST once (module-level)
  → PokemonCombobox substring-filters by user query
  → partition results using useLegalPokemon(format) membership
  → render: "Legal in {format}" group + "Other" group (dimmed)
```

---

## Component 1: `get_legal_pokemon` MCP tool

**Files:**
- `src/tools.ts` — implementation
- `src/tool-registry.ts` — registration

**Input:**
```ts
{ format: string }  // e.g. "gen9ou"
```

**Output:**
```ts
{ legal: string[] }  // canonical Pokémon IDs (toID() output)
```

### Implementation notes

- Uses Showdown's per-format legality lookup. The MCP server already has `@pkmn/*` dependencies — the exact API (`Dex.forFormat(...)` or equivalent) will be confirmed during implementation. If the running dependencies don't expose per-format legality directly, fall back to bundling Showdown's `teambuilder-tables.json` on the server (bounded risk; contained to this tool).
- IDs are emitted via `toID()` to match the client's canonical ID convention (lowercase, no spaces/hyphens).
- Unknown/invalid format → return `{ legal: [] }`. Client treats empty as "no legality known" and shows ungrouped results.
- Server-side memoization per format ID (pure function of format).

### Zod schema

```ts
{
    name: "get_legal_pokemon",
    description: "Returns the list of Pokémon species legal in a given format",
    inputSchema: z.object({
        format: z.string().describe("Format ID, e.g. 'gen9ou'")
    }),
}
```

### Payload size

~800 IDs for a format like gen9ou, ~6–10 KB uncompressed. Compresses well; one round trip per session per format.

---

## Component 2: Canonical Pokémon list

**File:** `apps/teambuilder/src/lib/data/pokemon-list.ts` (new)

```ts
export interface PokemonListEntry {
    id: string;           // canonical, e.g. "landorustherian"
    displayName: string;  // e.g. "Landorus-Therian"
    types: PokemonType[];
}

export const POKEMON_LIST: readonly PokemonListEntry[] = /* derived once at module load */;
```

### Derivation

`POKEMON_TYPES` has three aliases per species: compact (`charizardmegax`), hyphenated (`charizard-mega-x`), and spaced (`charizard mega x`). The canonical ID is the compact form (no hyphens, no spaces).

Procedure:
1. Iterate `POKEMON_TYPES` keys.
2. Select keys with no hyphen and no space → these are canonical IDs.
3. For each canonical ID, find a sibling alias containing hyphens (if present) to recover the display name.
4. Title-case each hyphen-separated segment: `charizard-mega-x` → `Charizard-Mega-X`.
5. Base species with no form variant → plain title-case: `charizard` → `Charizard`.
6. Sort alphabetically by `displayName`.

### Expected size

~1,500–2,000 entries. `cmdk` handles this list size fine with a custom substring filter; virtualization is not required.

---

## Component 3: `PokemonCombobox`

**File:** `apps/teambuilder/src/components/team/PokemonCombobox.tsx` (new)

### Props

```ts
interface PokemonComboboxProps {
    value: string;
    onChange: (name: string) => void;
    format: string;
    id?: string;
    placeholder?: string;
}
```

### Structure

```
<Popover>
  <PopoverTrigger asChild>
    <Input> (styled to match current dialog inputs, chevron icon on the right)
  </PopoverTrigger>
  <PopoverContent> (width = trigger width, max-h-80, overflow-y-auto)
    <Command filter={substringFilter}>
      <CommandInput /> (mirrors trigger value as user types)
      <CommandEmpty>No Pokémon match "{query}"</CommandEmpty>
      <CommandGroup heading="Legal in {format}">
        {legalMatches.map(row)}
      </CommandGroup>
      <CommandGroup heading="Other">
        {illegalMatches.map(row)}  // class="opacity-60"
      </CommandGroup>
    </Command>
  </PopoverContent>
</Popover>
```

Each row renders `<PokemonSprite size="sm" />` + `displayName`.

### Behaviors

- **Open:** on focus, on click, on typing. Closes on Esc, blur, or selection.
- **Value coupling:** the trigger input shows the raw user-typed string. Selection writes the canonical `displayName` via `onChange`. Free-typed values that don't match any row are preserved on blur (so users can still type exotic forms not in the list).
- **Filter:** custom `filter` passed to `cmdk` — `displayName.toLowerCase().includes(query.toLowerCase())`. Bypasses cmdk's default fuzzy scorer.
- **Grouping:** partition the filtered set by `legalSet.has(id)`.
  - When `legalSet` is still loading or empty, render a single ungrouped list under "All Pokémon".
  - When `legalSet` is populated, render the two groups; "Other" rows get `opacity-60`.
- **Loading state:** do not block the dropdown on `useLegalPokemon`. Show ungrouped list immediately; groups materialize on query resolution.
- **Keyboard:** ↑/↓ navigate, Enter selects, Esc closes, Tab closes and moves focus forward — all native to `cmdk`.

### Styling

Tailwind + `cn()` per house style. Matches the existing dialog `<Select>` trigger aesthetic so the field looks native to the dialog.

---

## Integration point

**File:** `apps/teambuilder/src/components/team/PokemonEditDialog.tsx`

Replace the current `<Input>` block at lines 80–88:

```tsx
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

No other changes to the dialog. The existing `usePokemonData(editedPokemon.pokemon, format, open)` hook continues to trigger once the name reaches length 2+.

---

## Dependencies

Two new packages in `apps/teambuilder/package.json`:

- `cmdk` — command menu primitive, ~5 KB gzipped
- `@radix-ui/react-popover` — headless popover, ~5 KB gzipped

Both are standard shadcn ecosystem packages, maintained alongside Radix.

---

## Accessibility

`cmdk` provides ARIA semantics out of the box: `role="combobox"`, `aria-expanded`, `aria-activedescendant`, `aria-selected`. Group headings are presentational (excluded from keyboard navigation by cmdk).

The existing `<label htmlFor="edit-pokemon-name">` binds to the combobox input via the `id` prop.

---

## Testing

### Client tests

**File:** `apps/teambuilder/src/__tests__/components/PokemonCombobox.test.tsx` (new)

1. Renders with initial value visible in the input.
2. Opens dropdown on focus.
3. Substring filter: typing "therian" shows Landorus-Therian, Thundurus-Therian, Tornadus-Therian.
4. Selecting a row calls `onChange` with the canonical display name.
5. Free-typed value is preserved if the user doesn't select a suggestion (blur without pick).
6. When `legalSet` is non-empty: legal rows render under "Legal in {format}", illegal rows render under "Other" with dimmed styling.
7. When `useLegalPokemon` is loading: rows render ungrouped under "All Pokémon".
8. Empty-query case shows the full list.

**File:** `apps/teambuilder/src/__tests__/pokemon-list.test.ts` (new)

- Derived list is non-empty and has no duplicate IDs (expected count in the 1,500–2,000 range).
- Title-casing correct for Mega, Therian, and regional forms.
- Sorted alphabetically by `displayName`.

### Server tests

Add a test for `get_legal_pokemon` following the existing MCP tool test patterns (confirm location during implementation; likely in `src/__tests__/` or similar).

Cases:
- Known format (`gen9ou`) → returns a non-empty array of canonical IDs.
- Unknown format (`garbage`) → returns `{ legal: [] }`.
- Known format with format-specific banlist → banned species excluded.

---

## Out of scope (explicitly deferred)

- Virtualization of the dropdown (~1,500 rows does not require it).
- Recent or frequently used picks surfaced at top.
- Fuzzy matching or typo tolerance.
- National Pokédex ordering.
- Type-colored badges in rows.
- Hard format filter (soft filter chosen deliberately to preserve experimentation).

## Alternatives considered

- **Server-side autocomplete per keystroke** — rejected: adds latency and network traffic for data we already have bundled.
- **Native HTML `<datalist>`** — rejected: no sprite support, inconsistent styling across browsers.
- **Bundling Showdown's `teambuilder-tables.json` on the client** — rejected: adds several hundred KB to initial bundle; a cached MCP round trip per session is cheaper.
- **Hard format filter** — rejected: blocks legitimate exploration and cross-format use; downstream `validate_team` already surfaces legality errors.
- **Phased delivery (autocomplete first, legality later)** — considered and rejected in favor of a single cohesive PR covering both the MCP tool and the UI.
