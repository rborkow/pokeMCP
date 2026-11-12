#!/usr/bin/env bash
# Post-deploy verification: hit the health endpoint on each worker. The MCP
# Worker must report every gateway-critical secret as populated; the website
# no longer calls an AI provider, so it only has to respond. Exits non-zero
# on a missing secret or an unreachable worker.
#
# Usage:
#   ./scripts/verify-deploy.sh                           # prod defaults
#   MCP_URL=https://api.pokemcp.com TB_URL=https://www.pokemcp.com ./scripts/verify-deploy.sh

set -euo pipefail

MCP_URL="${MCP_URL:-https://api.pokemcp.com}"
TB_URL="${TB_URL:-https://www.pokemcp.com}"

if ! command -v jq >/dev/null 2>&1; then
    echo "error: jq is required (brew install jq)" >&2
    exit 2
fi

fail=0

check() {
    local name=$1
    local url=$2
    local body
    if ! body=$(curl -fsS --max-time 10 "$url"); then
        echo "  ❌ $name: request to $url failed"
        fail=1
        return
    fi
    echo "  $name: $body"
    if ! echo "$body" | jq -e '.gateway | to_entries | all(.value == true)' >/dev/null 2>&1; then
        local missing
        missing=$(echo "$body" | jq -r '.gateway | to_entries | map(select(.value == false)) | map(.key) | join(", ")')
        echo "  ❌ $name is missing secrets: ${missing:-unknown}"
        fail=1
    fi
}

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

echo "Checking gateway secret presence:"
check "MCP Worker   " "$MCP_URL/health"
echo "Checking the website responds:"
check_up "Teambuilder  " "$TB_URL/api/health"

if [ "$fail" -ne 0 ]; then
    echo
    echo "❌ A worker is unreachable or missing gateway secrets."
    echo "   Set with: bunx wrangler secret put <NAME> --name <worker>"
    exit 1
fi

echo
echo "✅ Both workers respond and the MCP Worker reports its gateway secrets present."
