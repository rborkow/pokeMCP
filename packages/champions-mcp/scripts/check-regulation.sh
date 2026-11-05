#!/usr/bin/env bash
# Stable output (no timestamps): newest Champions VGC format names upstream + our vendored SHA.
set -euo pipefail
curl -sfL https://raw.githubusercontent.com/smogon/pokemon-showdown/master/config/formats.ts \
 | grep -o 'Gen 9 Champions\] VGC 2026 Reg M-[A-Z]' | sort -u
echo "vendored: $(cat /Users/rborkows/projects/pokeMCP/packages/champions-mcp/vendor/SHOWDOWN_SHA)"
