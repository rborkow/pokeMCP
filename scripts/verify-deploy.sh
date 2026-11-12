#!/usr/bin/env bash
# Post-deploy verification: check that each worker responds. Neither worker
# needs runtime secrets to serve requests any more, so there is nothing else to
# confirm here. Exits non-zero if a worker is unreachable.
#
# Usage:
#   ./scripts/verify-deploy.sh                           # prod defaults
#   MCP_URL=https://api.pokemcp.com TB_URL=https://www.pokemcp.com ./scripts/verify-deploy.sh

set -euo pipefail

MCP_URL="${MCP_URL:-https://api.pokemcp.com}"
TB_URL="${TB_URL:-https://www.pokemcp.com}"

fail=0

check_up() {
    local name=$1
    local url=$2
    local body
    if ! body=$(curl -fsS --max-time 10 "$url"); then
        echo "  ❌ $name: request to $url failed"
        fail=1
        return
    fi
    echo "  $name: $body"
}

echo "Checking each worker responds:"
check_up "MCP Worker   " "$MCP_URL/health"
check_up "Website      " "$TB_URL/api/health"

if [ "$fail" -ne 0 ]; then
    echo
    echo "❌ A worker did not respond."
    exit 1
fi

echo
echo "✅ Both workers respond."
