#!/usr/bin/env bash
# Clone smogon/pokemon-showdown at a pinned SHA and build dist/sim.
# The npm package lags the repo (0.11.11 = 2026-07-28, no Reg M-C), so we
# build from source. Bump SHOWDOWN_SHA when a new regulation lands upstream
# (check: https://github.com/smogon/pokemon-showdown/commits/master/config/formats.ts).
set -euo pipefail
SHOWDOWN_SHA="${SHOWDOWN_SHA:-2ddfa0476f82}"
HERE="$(cd "$(dirname "$0")/.." && pwd)"
DEST="$HERE/vendor/pokemon-showdown"
if [ -d "$DEST/.git" ] && [ "$(git -C "$DEST" rev-parse --short=12 HEAD)" = "$SHOWDOWN_SHA" ] && [ -f "$DEST/dist/sim/index.js" ]; then
    echo "pokemon-showdown already at $SHOWDOWN_SHA"; exit 0
fi
rm -rf "$DEST"
git clone -q https://github.com/smogon/pokemon-showdown.git "$DEST"
git -C "$DEST" checkout -q "$SHOWDOWN_SHA"
(cd "$DEST" && npm install --no-audit --no-fund --silent && node build)
echo "$SHOWDOWN_SHA" > "$HERE/vendor/SHOWDOWN_SHA"
test -f "$DEST/dist/sim/index.js" && echo "built pokemon-showdown @ $SHOWDOWN_SHA"
