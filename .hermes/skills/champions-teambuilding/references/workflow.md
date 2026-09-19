# Data refresh workflow (run from repo root: /Users/rborkows/projects/pokeMCP)

When a champions tool says data is missing / expired / not cached, run the command it names —
never substitute recalled numbers.

## New regulation lands

1. Edit `packages/champions-mcp/src/regulation.ts` (start/end dates, displayName) and bump
   `SHOWDOWN_SHA` in `packages/champions-mcp/scripts/vendor-showdown.sh` to the new upstream SHA.
2. `bun run champions:vendor && bun run champions:test`
3. Commit; refresh usage/tournaments below once the month publishes.

`check-regulation.sh` (~/.hermes/scripts/champions-regulation.sh) prints the newest upstream
Champions VGC format names plus our vendored SHA — run it to detect a rotation.

## Monthly ladder usage (Smogon chaos dump)

    bun run --cwd packages/champions-mcp fetch-usage

## Tournaments + opponent pool (Limitless)

    bun run fetch-tournaments && bun run --cwd packages/champions-mcp build-opponent-pool

## One-shot

    ~/.hermes/scripts/champions-refresh.sh   # does all three, commits data changes only

After any refresh, commit the changed data (`packages/champions-mcp/data`,
`src/cached-tournaments`) so the cache history is reproducible.

## Hermes cron (already installed)

- `champions-data-refresh` — daily 07:00, `--no-agent`, runs `~/.hermes/scripts/champions-refresh.sh`
- `champions-regulation-watch` — Mondays 08:00, monitor-script `~/.hermes/scripts/champions-regulation.sh`;
  the agent only wakes when the upstream format list or vendored SHA changes.

`~/.hermes/scripts/champions-*.sh` are thin `exec bash <repo script>` wrappers, not symlinks:
Hermes cron rejects script paths that resolve outside `~/.hermes/scripts/` ("escapes the scripts
directory via traversal"). Also add a regulation entry under `src/regulations/` (root worker) when
a new set lands — see `src/regulations/champions-regmc.ts` for the template.
