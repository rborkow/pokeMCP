---
name: champions-teambuilding
description: Use when building, reviewing or testing a Pokémon Champions VGC team. Drives the champions-mcp tools in a fixed order and cites sources.
version: 1.0.0
metadata:
  hermes:
    tags: [pokemon, vgc, champions, teambuilding]
---

# Champions VGC team building

All facts come from `mcp_champions_*` tools. Never recall legality, stats, movepools or usage from
memory — the regulation rotates every ~3 months and Champions rebalances moves and trims movepools.

## Order of operations (every session)
1. `meta_snapshot` (no args) — read regulation status + freshness. If the regulation is `expired`
   or usage is flagged as a previous regulation, say so before any advice.
2. `get_regulation` (no args) once if you need the full roster/Mega list.
3. Build or take the user's team as a Showdown paste (`paste` arg). EV lines are **Stat Points**
   (0–32 per stat, 66 total) — see references/stat-points.md.
4. `validate_team paste=…` — fix every problem before analysis. Movepools are level-up only;
   confirm any non-obvious move with `lookup_pokemon` (`moves: true`).
5. Per Pokémon: `get_usage type=pokemon pokemon=…` (ladder sets) and
   `get_tournament_teams pokemon=…` (proven sets). Prefer tournament sets when the ladder month is
   a previous regulation.
6. Speed/bulk: `calc_stats pokemon=… statPoints={hp:32,…} nature=…`; key KOs: `calc_damage
   attacker={species,…} defender={…} move=…` (doubles field is the default).
7. `list_findings regulation=<current regulation>` — use only relevant, non-stale evidence and cite
   its run IDs; treat `hypothesis` as unverified. `evaluate_team paste=… seed=<fixed>` automatically
   records a run ID; then change ONE thing and re-run with the same seed. Use `compare_runs` only when
   it reports comparable settings/opponents/seeds, and cite both IDs. Report the delta with its caveat
   (heuristic policy, not skilled play). `simulate_matchup`
   (same seed, `opponentPaste=`) against the hardest opponents for lead stats. After `evaluate_team`,
   run `triage_losses` (same seed) for a typed loss-cause histogram and `grade_leads` against the
   two hardest opponents. Jev answers are graded guesses — report its confidence and whether it
   agrees with the sim.
8. Output: final paste + a table of "why each mon", the 3 hardest opponents, and the unverified
   assumptions.
9. When an important result informs advice, `replay_run runId=<id>` first. It must be `verified`; an
   `incompatible` replay is not evidence of failure or success. Record a finding manually only with
   exact run IDs, regulation, limitations, and `hypothesis` unless repeated evidence supports it.

## Rules
- Quote the `_Source: …_` line each tool returns when stating a fact.
- Champions has no Tera and no EVs/IVs; never suggest either.
- One Mega per team (Omni Ring). The Mega's held item is its Mega Stone; post-Mega types/ability
  come from `lookup_pokemon`.
- If a tool says data is missing/expired/not cached, run the refresh command it names
  (references/workflow.md) rather than guessing.

## Simple Beam mechanics (verified against the live sim @ 2ddfa0476f82; tools don't expose these)
- Only 3 legal mons learn it in the mod: Sirfetch'd, Farfetch'd, Audino.
- It is *windowed* suppression: `clearVolatile()` resets `ability = baseAbility`, so the target
  gets its original ability back the moment it switches out. Skill Swap is the permanent version.
- Absorbs the beam: Good as Gold (`onTryHit` status block — logs `-immune`), Illusion, Multitype
  (cantsuppress). Other M-C abilities are beammable: Defiant, Competitive, No Guard, Pixilate,
  Aerilate, Prankster, Intimidate, Speed Boost, Protean/Libero, Serene Grace, Synchronize.
- Mega-evolved targets CAN be beamed (formeChange sets the Mega ability, the beam overwrites it);
  on switch the Mega ability returns because baseAbility was updated by the Mega.
- Buff hazard: Simple doubles positive stages too — beaming Speed Boost (Scolipede, Blaziken)
  or Moxie/Soul-Heart makes them stronger. Check the target's ability before aiming.
- Never generalize a finding across regulations or call a heuristic result skilled play. Keep test-only
  findings test-only; findings are data in the durable memory, while this skill is procedure.
