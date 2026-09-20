# champions-mcp

Local stdio MCP server for Pokémon Champions VGC team-building (Reg M-C). It wraps a
vendored Pokémon Showdown build (the `champions` mod + `@smogon/calc` gen 0) plus Smogon
usage and Limitless tournament caches, and is meant to be driven by Hermes.

## Prerequisites

    cd packages/champions-mcp && bun run vendor   # or `bun run champions:vendor` from repo root

Builds the pinned Showdown SHA (recorded in `vendor/`, gitignored) into `vendor/pokemon-showdown/dist/sim`.
Start the server: `bun run bin/champions-mcp.ts` (works from any cwd).

## Tools

| Tool | What it does |
|---|---|
| `ping` | Health check. |
| `get_regulation` | Current regulation: dates, rules, legal roster, Mega list. |
| `validate_team` | Showdown validator: legality, Flat Rules bans, clauses, 66 Stat Point rule. |
| `lookup_pokemon` | Champions dex entry; `moves: true` for the full legal movepool. |
| `calc_stats` | Level-50 stats from base stats + Stat Points + nature. |
| `calc_damage` | Damage ranges via `@smogon/calc` gen 0 with champions-mod overrides. |
| `get_usage` | Smogon ladder usage (falls back to the previous regulation with a warning). |
| `get_tournament_teams` | Top-cut teams from the Limitless cache; usage/events/per-Pokémon sets. |
| `meta_snapshot` | One-call digest: regulation status + ladder + tournament usage + freshness. |
| `simulate_matchup` | Your team vs one opponent team; win rate, ties, leads. |
| `evaluate_team` | Your team vs the cached opponent pool; Overall + hardest opponents. |
| `grade_leads` | Rank all 15 opening leads: seeded sim bring/lead sampling + Jev p. |
| `triage_losses` | Jev-typed loss-cause histogram over sim logs. |
| `get_run` / `list_runs` | Retrieve/list integrity-checked local experiment artifacts. |
| `replay_run` | Fail-closed compatibility check and replay from the stored opponent snapshot. |
| `compare_runs` | A/B metrics only when settings, opponent snapshots, and seeds match. |
| `record_finding` / `list_findings` | Regulation-scoped evidence notes; test-only notes remain hidden by default. |

## Durable experiment memory

Successful `simulate_matchup` and `evaluate_team` calls automatically return a `run_id` and write
an immutable artifact. By default these live at `packages/champions-mcp/data/experiment-memory`,
resolved relative to the package (never the caller cwd). Set `CHAMPIONS_MEMORY_ROOT=/safe/path` to
use a backupable local root; the default raw artifacts are gitignored because they include battle logs.
Persistence is part of tool success: if an artifact cannot be written, the simulation call fails rather
than claiming a recorded run.

    simulate_matchup paste="..." opponentPaste="..." games=10 seed=7
    get_run runId=<returned-id>
    replay_run runId=<returned-id>

Replay verifies the artifact digest and runner/policy/team/Showdown/vendor/dependency fingerprints
before simulating. It uses the run's exact ordered opponent snapshot, so later pool edits do not affect
it. A changed simulator or policy reports `incompatible` without running. A compatible replay compares
winner, turns, leads, summaries, and protocol log content; it removes only Showdown `|t:|` timestamp
lines. Equal wins alone are not verification, and old runtimes are not restored automatically.

    record_finding claim="Test-only sample result" regulation=champions-regmc \
      evidenceRunIds='["<returned-id>"]' limitations="10 heuristic games; not skilled play" \
      status=hypothesis testOnly=true
    list_findings regulation=champions-regmc

Findings require existing integrity-valid run IDs, preserve revisions/contradictions, are never promoted
automatically, and must be interpreted as heuristic evidence rather than skilled-play or universal truth.

## Data refresh

- `bun run scripts/fetch-usage.ts` — Smogon chaos usage → `data/usage/*.json.gz`
- `bun run scripts/build-opponent-pool.ts` — tournament cache + usage → `data/opponents/regmc.json`
- Tournament cache lives in the root repo: `bun run fetch-tournaments` (`src/cached-tournaments/`)
- `scripts/refresh-data.sh` runs all three and commits data-only changes; Hermes cron calls it
  daily via `~/.hermes/scripts/champions-refresh.sh`.

## Hermes wiring

    hermes mcp add champions   # spawns bin/champions-mcp.ts via bun (see `hermes config get mcp_servers.champions`)

Project skill: `.hermes/skills/champions-teambuilding/SKILL.md`. Cron: daily data refresh +
weekly regulation watch (`hermes cron list`).

## Notes

- **Stat Points**: Champions uses 66 Stat Points total (max 32 per stat), not EVs. In pastes,
  the `EVs:` line carries Stat Points; `calc_*` args take `statPoints: {hp,atk,def,spa,spd,spe}`.
- **Sim caveat**: matches run under a greedy heuristic policy (damage-max + Protect/Fake Out,
  no prediction). `evaluate_team` and `simulate_matchup` default to `policy: "heuristic-sample"`:
  each game samples a seeded random 4-of-6 bring and lead order, so every slot is exercised and
  a single-set edit — even in slots 5–6 — moves the number. Pass `policy: "heuristic"` for the
  fixed slots-1–4 bring (lead 1+2); there, edits to slots 5–6 are invisible by construction.
  Win rates measure the heuristic, not skilled play.
