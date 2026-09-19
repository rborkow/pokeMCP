#!/usr/bin/env bash
# Refresh Champions data. Prints only when something changed (cron --no-agent stays quiet otherwise).
set -euo pipefail
cd /Users/rborkows/projects/pokeMCP
export PATH="/Users/rborkows/.bun/bin:/Users/rborkows/.hermes/node/bin:$PATH"
log=/tmp/champions-refresh.log
snapshot() { git status --short src/cached-tournaments packages/champions-mcp/data | md5; }
before="$(snapshot)"
bun run fetch-tournaments >"$log" 2>&1 || { echo "fetch-tournaments failed: $(tail -3 "$log")"; exit 1; }
bun run --cwd packages/champions-mcp fetch-usage >>"$log" 2>&1 || echo "fetch-usage failed (non-fatal): $(tail -2 "$log")"
bun run --cwd packages/champions-mcp build-opponent-pool >>"$log" 2>&1 || { echo "build-opponent-pool failed: $(tail -3 "$log")"; exit 1; }
after="$(snapshot)"
if [ "$before" != "$after" ]; then
  # Guard: never sweep unrelated work into the data commit. Anything other than
  # the two data paths (and the untracked .hermes/ scratch dir) means the tree
  # is dirty — leave the refreshed files in place but skip committing.
  dirty="$(git status --short | grep -v -e '^?? \.hermes' -e 'src/cached-tournaments' -e 'packages/champions-mcp/data' || true)"
  if [ -n "$dirty" ]; then
    echo "Champions data refreshed but NOT committed — working tree has other changes:"
    echo "$dirty"
    exit 0
  fi
  git add src/cached-tournaments packages/champions-mcp/data
  git commit -qm "data(champions): refresh tournaments/usage $(date +%F)" -- src/cached-tournaments packages/champions-mcp/data
  echo "Champions data refreshed and committed: $(git log -1 --format=%h) on $(git rev-parse --abbrev-ref HEAD)"
fi
