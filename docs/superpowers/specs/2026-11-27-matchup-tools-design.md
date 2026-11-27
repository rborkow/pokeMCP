# Matchup tools: design (approved by Rob, 2026-11-27)

Two questions, two tools (directory rules: one operation per tool).

| Question | Tool | Input | Answer |
|---|---|---|---|
| "Do I have a good counter to X?" | `find_counters` | One threat (name, or a full set), optionally my team | Each team member's verdict against X with the numbers. If nothing on the team handles it, the meta Pokémon that would |
| "How do I play this matchup?" | `plan_matchup` | My six and their six (open team sheets show species, items, abilities and moves) | Which four to bring, which two to lead, their biggest threats and who handles each, and the Speed swings under Tailwind and Trick Room |

Both are deterministic calculations on the same code as `calculate_damage`, `compare_speed` and
`check_team_threats` (`src/connector/matchup.ts`: resolveSet, runDamage, bestHit, getFinalSpeed).
No simulation, no win rates, no listing change.

## find_counters

**Input:** `threat` (name plus optional nature, stat points, item, ability and moves; anything left
out comes from the threat's most common set in the regulation); `team` (optional, one to six sets);
`format`; `suggest` (default true: look in the meta when the team has no answer); `limit` for
suggestions (default 5).

**For each team member** (and each suggestion candidate: the top 40 by usage, legal, not already on
the team):
- **Takes:** the threat's hardest hit into it, as a % range and a KO verdict
- **Deals:** its hardest hit into the threat, likewise
- **Speed:** faster, slower or tied, normally and under Trick Room

**Verdict, defined in the description so the model can explain it:**
- **Counter:** takes at most 50% from the threat's hardest hit, so it survives two hits, and
  2HKOs the threat or better
- **Check:** moves first and KOs before the threat can KO it, but can't take repeated hits
- **Trade:** each KOs the other in the same number of hits, and Speed decides
- **Loses:** anything else

**Output:** the threat's set as assumed; per-member rows with the numbers and the verdict; the best
answer on the team; `suggestions[]` (with usage %) when no member reaches Check or better; and the
assumptions (single hits, no screens or stat changes, spreads from usage where not given).

**Doubles caveats it states:** no partner support, no spread-move reduction unless the move is
spread, and Intimidate and Fake Out are not counted. Those belong to plan_matchup.

## plan_matchup

**Input:** `team` (six sets; moves default to usage), `opponent` (six; names alone are allowed,
open-team-sheet fields when known, spreads from usage otherwise), `format`.

**Computes:**
1. A 6×6 matrix: my hardest hit into each of theirs and theirs into mine (% range and KO verdict),
   plus Speed order normally, under Tailwind (either side) and under Trick Room.
2. **Their threats:** each opponent Pokémon ranked by how many of mine it outspeeds and KOs.
3. **Bring four:** score all 15 four-of-six subsets by how well they answer their six (each opponent
   Pokémon's best Counter/Check in the subset, weighted by how threatening it is), minus how many of
   the four any single opponent Pokémon sweeps. Small bonuses for speed control (Tailwind, Trick
   Room, Icy Wind) and disruption (Fake Out, Intimidate) when their team is weak to it.
4. **Lead two:** among the 6 pairs in the chosen four, the pair with the best worst case against
   their likely leads. Likely leads come from usage data (lead frequency, if published) or else all
   15 of their pairs.
5. **Reasons, not prose:** for each pick, the facts behind it ("Rillaboom: Fake Out pressure; your
   only Counter to Urshifu"). The model writes the game plan from these.

**Output:** `bring`, `lead`, `back`, `threats[]` (who answers each and how), `speedNotes`
(Tailwind and Trick Room swings), the matrix, `alternatives` (the next two bring options with their
scores), and `assumptions`.

**Cost:** about 6 × 6 × 4 moves × 2 directions ≈ 300 damage calculations, with subsets and leads
scored from that one matrix. Well within one request.

## How it fits the rest
- **MCP Apps:** plan_matchup's matrix is exactly the "threat matrix" view planned for phase 1. That
  view should become plan_matchup's, and the planned app-only `get_threat_matrix` tool isn't needed.
- **Simulation:** later, the bot can test a plan ("this bring and lead wins N of 20"). That's
  research until it passes an agreed strength test.
- **suggest_teammates** (earlier draft): find_counters' suggestions cover the "what fills my gap"
  part. I'd park suggest_teammates.
- **check_team_threats** stays as the broad scan against the meta. find_counters is the deep dive on
  one threat.

## Build order
1. `find_counters` first: smaller, mostly reuses check_team_threats internals, about 1–2 days with tests.
2. `plan_matchup`: about 3–4 days, most of it spent on the bring and lead scoring and its tests.
3. The phase 1 view for plan_matchup, after Claude's directory review.

## Decisions (Rob, 2026-11-27)
1. The verdict definitions above (Counter, Check, Trade, Loses) are approved.
2. plan_matchup accepts an opponent given as names alone; spreads, items and moves then come from
   usage, and the result says so.
3. The names are `find_counters` and `plan_matchup`.
