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
7. `evaluate_team paste=… seed=<fixed>`; then change ONE thing and re-run with the same seed.
   Report the delta with its caveat (heuristic policy, not skilled play). `simulate_matchup`
   (same seed, `opponentPaste=`) against the hardest opponents for lead stats. After `evaluate_team`,
   run `triage_losses` (same seed) for a typed loss-cause histogram and `grade_leads` against the
   two hardest opponents. Jev answers are graded guesses — report its confidence and whether it
   agrees with the sim.
8. Output: final paste + a table of "why each mon", the 3 hardest opponents, and the unverified
   assumptions.

## Rules
- Quote the `_Source: …_` line each tool returns when stating a fact.
- Champions has no Tera and no EVs/IVs; never suggest either.
- One Mega per team (Omni Ring). The Mega's held item is its Mega Stone; post-Mega types/ability
  come from `lookup_pokemon`.
- If a tool says data is missing/expired/not cached, run the refresh command it names
  (references/workflow.md) rather than guessing.
