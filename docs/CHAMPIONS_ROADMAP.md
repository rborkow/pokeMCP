# Pokémon Champions Roadmap

This document proposes a concrete PR breakdown for Phases 2–4 of Champions
support. It is grounded in the files Phase 1 actually touched, not the plan
as originally specified. If you are picking this up: start by reading
[`src/regulations/`](../src/regulations/) — that is the load-bearing
abstraction for everything below.

## Phase 1 recap — what was actually built

New code:

- `src/regulations/types.ts` — `RegulationSet`, `LoadedRegulation`,
  `LegalityKvBlob`, `MoveOverride`. Intentionally concrete about Phase 1
  concerns (allow-list, item clause, 4-move cap, L50, 6/4). Phase 3 and
  Phase 4 extend this, they don't replace it.
- `src/regulations/registry.ts` — single registered regulation today:
  `champions-regma`. Adding M-B is one import + one array entry.
- `src/regulations/champions-regma.ts` — static config: dates, Mega allow
  list (not yet enforced), KV key, official URL, empty move overrides.
- `src/regulations/loader.ts` — hydrates a regulation from KV.
  **Fails loudly** if legality is missing; never falls back to an empty
  list.
- `src/regulations/validator.ts` — pure validator against a
  `LoadedRegulation`. Shares no code with the legacy Showdown validator.
- `src/regulations/champions-html-parser.ts` — defensive parser for the
  official Champions web-view HTML. Throws if it finds < 50 names so
  structural shifts surface immediately.
- `scripts/fetch-champions-legality.ts` + `scripts/upload-champions-legality.ts`
  — ingestion pair modelled on `fetch-stats`/`upload-stats`.
- `src/__tests__/` (first tests in the root package) — validator fixtures
  and HTML parser regressions. Runs via `npm test` using Node's built-in
  test runner + tsx (no new deps).
- Teambuilder: `champions-regma` added to `FORMATS`, `champions` added to
  `FormatCategory`, `isChampionsFormat()` helper, a Champions chip on the
  home page, and a "VP mechanics not yet modeled" notice in SpeedTiers.

Modified code:

- `src/tools.ts` — `validateTeam` now dispatches via `validateTeamForFormat`,
  which picks between the Showdown validator and the regulation validator
  by format id. The Showdown path is **unchanged**.
- `src/tool-registry.ts` — `validate_team` tool is now async, accepts
  `level` in the team schema, and documents the new format ids.
- `src/stats.ts` — `unavailableStatsMessage()` centralises the "no stats"
  message and returns a Champions-aware variant for `champions-*` formats.
- `apps/teambuilder/src/types/pokemon.ts` — `FormatCategory` gains
  `"champions"`; `getFormatsForMode`/`isFormatValidForMode` accept Champions
  under VGC mode.

### Assumptions that held

- Format dispatch is the right seam. The existing Showdown validator does
  not need to learn about regulations; Champions lives beside it.
- KV is the right cache for the allow-list. It's cheap, we already pay for
  the namespace, and ingestion is monthly at most.
- The teambuilder already discriminates VGC vs Singles via a `Mode`.
  Champions slots under VGC cleanly because it's a doubles-shaped format;
  no new mode was needed.

### Assumptions that did not hold

- **"Add Champions to the existing VGC validator."** The VGC validator in
  `src/tools.ts` is a loose collection of tier/clause checks that doesn't
  model formats cleanly — it dispatches with string-matching on format
  substrings (`format.startsWith("gen9") || format.includes("vgc202")`).
  Extending it in place would entangle Champions with Gen 9 assumptions
  (Tera types, EV/IV caps). The Phase 1 refactor keeps these worlds
  separate: Champions gets its own validator, and the Showdown path is
  left alone. The same split should apply going forward — do not merge
  them.
- **"Pikalytics scraper might be needed."** Skipped entirely, matching
  the brief. Smogon auto-discovery will pick Champions up when Showdown
  publishes; no other sources are needed for Phase 1 or Phase 2.

---

## Phase 2 — usage stats for Champions (1 small PR)

**Status: mostly automatic.** The monthly discovery pipeline
(`scripts/discover-formats.ts`) already matches `^gen\d+vgc` and
`^gen\d+doubles`. If Showdown starts publishing `gen9vgc2026regma` (or
similar), it flows through `fetch-stats`, `upload-stats`, and the ingestion
cron with no code changes.

### What this PR does

1. Teach `src/regulations/champions-regma.ts` about an optional
   `showdownFormatId` field so the regulation can point at its Smogon stats
   identifier when one exists.
2. Add a helper in `src/stats.ts` that transparently maps
   `format: "champions-regma"` to `showdownFormatId` when populated, so the
   MCP `get_usage_stats` tool works against Champions without the caller
   caring where the stats live.
3. When `showdownFormatId` is unset (pre-Showdown-publication), keep the
   current behavior: `unavailableStatsMessage()` explains why.

### Risk / surface area

Very low. Touches two files. No schema changes. The mapping is purely
additive.

### Files

- `src/regulations/types.ts` — add optional `showdownFormatId`.
- `src/regulations/champions-regma.ts` — leave empty until Showdown
  publishes; flip when it does.
- `src/stats.ts` — one-line translation in each tool entry point, or a
  shared `resolveFormat()` helper.

---

## Phase 3 — Mega Evolution data modeling (1 medium PR + 1 follow-up)

**This is the architecturally meaty phase.** Megas change a Pokémon's
type, base stats, ability, and speed band mid-battle. Our type coverage
and threat matrix panels currently assume static types — they need to
learn about "potentially Mega" states.

### Why this is non-trivial

- `apps/teambuilder/src/components/analysis/TypeCoverage.tsx` and
  `ThreatMatrix.tsx` both key off `getPokemonTypes()`. They need either
  a "post-Mega" variant or a dual-state rendering.
- The Omni Ring in Reg M-A means a **team can hold one Mega Evolution
  per battle**. That's a team-level state, not a per-Pokémon flag, and
  doesn't fit the current `TeamPokemon` shape.
- Mega-evolve and switch share a priority band — that's the Phase 3
  rule. The existing `src/tools.ts` `validateTeam` doesn't model turn
  order at all, so we only need to surface this as a warning in the UI;
  nothing to validate server-side.

### PR 3a — Mega data (medium)

1. Add `src/regulations/mega-data.ts`: for each Pokémon name in
   `CHAMPIONS_REGMA.allowedMegas`, record post-Mega type(s), post-Mega
   base stats, post-Mega ability, and the Mega Stone item (Charizardite-X,
   etc.).
2. Extend `RegulationSet` with `megaForms: Record<string, MegaForm>`
   instead of the current flat `allowedMegas: string[]`. Migrate the
   existing list.
3. Extend `validator.ts` to enforce "at most one Mega Stone held per
   team" once we're ready. Phase 1 left item-clause loose (one of each
   item), which **already** catches this case incidentally for doubled
   Megas of the same form, but not mixed Megas.
4. Add `isChampionsMegaStone(item: string)` and surface in the
   teambuilder so the edit dialog can warn when a second Mega Stone is
   placed.

### PR 3b — post-Mega type coverage UI (medium)

1. `apps/teambuilder/src/lib/data/pokemon-types.ts`: add a sibling
   `getPostMegaTypes(pokemon)` that reads from the Champions mega data
   module.
2. `TypeCoverage.tsx` + `ThreatMatrix.tsx`: render "base + Mega" side by
   side when the team is in a Champions format and a Mega candidate is
   present. Keep the existing rendering for non-Champions.
3. Add a new `components/analysis/MegaPicker.tsx` that lets the user mark
   which Pokémon is the intended Mega for this battle, persisted in the
   team store. Drives which post-Mega types the analysis panels show.

### Risk

- Medium. The TypeCoverage component has hard-coded type chart
  assumptions that will need a small refactor to accept "effective types"
  rather than "declared types".
- Low for the regulation-side code — the additions are additive.

---

## Phase 4 — VP spreads + Champions move overlay (1 large PR, or split into 2)

This is the phase where Showdown data stops being authoritative.

### Why this is the riskiest

- **`TeamPokemon.evs` / `.ivs`** are assumed throughout the codebase:
  `src/types.ts`, `apps/teambuilder/src/types/pokemon.ts`,
  `showdown-parser.ts`, `speed-calc.ts`, `validation/pokemon.ts`,
  and every component that displays a stat block. Swapping EVs for VPs
  requires a coordinated migration.
- **Speed tiers are already known-wrong** for Champions (we call this
  out in the SpeedTiers notice today). Fixing them requires the VP
  model.
- Showdown import/export uses the EV syntax. We either add a second
  dialect for Champions (cleaner) or extend the existing one
  (backwards-incompatible). Recommend cleaner.

### PR 4a — VP-aware team model (large)

1. Extend `TeamPokemon` with an optional
   `victoryPoints?: Partial<BaseStats>` and
   `championsPerfectStats?: boolean` flag.
2. In the teambuilder, detect Champions format in the edit dialog and
   swap the EV/IV/nature sub-form for a VP allocator. Keep the old UI for
   Showdown formats.
3. Update `speed-calc.ts` to use the Champions VP formula when the team
   is in a Champions format. Remove the amber notice from SpeedTiers once
   this lands.
4. Update `lib/validation/pokemon.ts` with Champions-aware caps (once
   TPC documents them authoritatively — currently inferred from
   community data).

### PR 4b — Champions move overlay

1. Populate `CHAMPIONS_REGMA.moveOverrides` with the known-divergent
   moves (Dire Claw nerf, etc.).
2. Add `getMoveForRegulation(moveName, regulation)` to
   `src/regulations/` that merges Showdown move data with the overlay.
3. Route all move-data lookups in the MCP worker's tool paths through
   this helper when a Champions format is active. Teambuilder can follow
   once it ingests the move data client-side.

### Risk

- **High** for 4a. The EV/IV assumption is baked deep; expect to touch
  ~15–25 files across both `src/` and `apps/teambuilder/`.
- **Low** for 4b, which is additive.

---

## What to do first

If you have one weekend:

1. Merge Phase 2 when Showdown publishes Champions. One afternoon.
2. Start Phase 3a (Mega data). This is the highest user-visible value
   for Reg M-A players and doesn't require any migration.
3. **Do not** start Phase 4 without first nailing down whether TPC
   publishes VP caps publicly. Without authoritative caps, community
   inference will drift from reality and the feature becomes a
   maintenance burden.

## Things to consciously skip (and why)

- **Damage calculation.** Porygon Labs covers this; we'd be duplicating.
- **Champions 3v3 BSS.** Out of scope in the brief; not worth the split
  cognitive load while the doubles format is still stabilising.
- **Server-side turn order validation (Mega priority).** The validator
  never validates turns; surfacing as a warning in the UI is the right
  abstraction and three orders of magnitude less work.
