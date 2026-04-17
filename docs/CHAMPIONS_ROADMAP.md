# Pokémon Champions Roadmap

This document tracks the phased rollout of Champions support. If you are
picking this up: start by reading [`src/regulations/`](../src/regulations/)
and [`apps/teambuilder/src/lib/champions-utils.ts`](../apps/teambuilder/src/lib/champions-utils.ts)
— those are the load-bearing abstractions.

**Phase status:**

| Phase | Status | Notes |
|-------|--------|-------|
| 1     | ✅ merged | Regulation abstraction, allow-list validator, teambuilder UI |
| 2     | ✅ merged | `showdownFormatId` mapping for usage stats |
| 3a    | ✅ shipped | Mega data model + Omni Ring "one Mega per team" validator rule |
| 3b    | ✅ shipped | Post-Mega types in TypeCoverage + ThreatMatrix |
| 4a    | pending | VP-aware team model |
| 4b    | pending | Champions move overlay |

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

## Phase 3 — Mega Evolution (shipped)

### PR 3a — Mega data model + Omni Ring rule (shipped)

- `src/regulations/mega-data.ts` — `MegaForm` interface and
  `CHAMPIONS_REGMA_MEGAS`: full post-Mega types/ability/stats for the
  seven returning Gen 6/7 Megas; Meganium-Mega marked
  `championsExclusive` with pending data.
- `RegulationSet.allowedMegas: string[]` → `megaForms: MegaForm[]` (type
  + Reg M-A config migrated).
- `src/regulations/mega-helpers.ts` — `isChampionsMegaStone()` and
  `findMegaFormForItem()` for validator + UI reuse.
- `src/regulations/validator.ts` — Omni Ring rule: team-level "at most
  one Mega Stone" check, separate from the Item Clause so mixed-Mega
  teams (Charizardite X + Gardevoirite) are caught.

### PR 3b — Post-Mega types in the analysis panels (shipped)

- `apps/teambuilder/src/lib/data/champions-megas.ts` — client-side mirror
  of the MCP Mega data. Keep in sync with the worker until Phase 4b
  unifies via RPC.
- `apps/teambuilder/src/lib/champions-utils.ts` — `getActiveMegaSlot`,
  `getActiveMegaForm`, `getEffectiveTypes`, `isActiveMegaDataPending`.
  The Omni Ring rule means the active Mega is auto-detected (slot
  holding a Mega Stone that matches its species), so **no picker was
  needed** — a simplification from the original plan.
- `TypeCoverage.tsx` + `ThreatMatrix.tsx` — use `getEffectiveTypes()`
  for defensive analysis; show an amber Omni Ring banner naming the
  active Mega and its post-Mega types (or "data pending" for
  championsExclusive).
- Tests in `apps/teambuilder/src/__tests__/champions-utils.test.ts`.

### Simplifications vs the original plan

- **No MegaPicker component.** Because the validator constrains teams
  to one Mega Stone, the active Mega is unambiguous — the analysis
  can auto-detect it. If a future regulation allows multiple Mega
  Stones per team, revisit this decision and add a picker.
- **Client-side data mirror** rather than an MCP RPC. Eight entries is
  cheap to duplicate; a `get_mega_forms` tool would add a network round
  trip to every TypeCoverage render. Revisit if the list grows past
  ~50 entries or drifts between client and server.

### Not done (deferred)

- **Mega Stone warning in the edit dialog.** `isChampionsMegaStone()`
  is exported; wiring a "second Mega Stone" hint into
  `PokemonEditDialog` is a separate, small PR if someone wants it.
- **Mega-evolve/switch priority warning.** The "Mega-evolve and switch
  share a priority band" note is a surface-level UX hint; we chose to
  skip it rather than half-model turn order. Add as a tooltip in
  `SpeedTiers` if it matters.

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
