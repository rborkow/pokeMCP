#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
web_root="${repo_root}/apps/teambuilder"

required_worker_secrets=(
    "CF_AIG_TOKEN"
    "CLOUDFLARE_AI_GATEWAY_URL"
)
# The website needs no secrets: it has no accounts and calls no AI provider.

assert_secret_names() {
    local inventory="$1"
    shift
    local missing=0
    for name in "$@"; do
        if ! rg -q "\"name\": \"${name}\"" <<< "${inventory}"; then
            echo "Missing Worker secret: ${name}" >&2
            missing=1
        fi
    done
    return "${missing}"
}

cd "${repo_root}"
bunx wrangler whoami

echo "Checking D1 databases and restore bookmarks"
for database in pokemcp-meta-history; do
    bunx wrangler d1 info "${database}" --json
    bunx wrangler d1 time-travel info "${database}" --json
done

echo "Checking production Worker secrets"
worker_secrets="$(bunx wrangler secret list --env production --format json)"
assert_secret_names "${worker_secrets}" "${required_worker_secrets[@]}"

echo "Checking migration state"
bunx wrangler d1 migrations list META_DB --remote --env production

echo "Checking deployed versions"
bunx wrangler deployments list --env production
(
    cd "${web_root}"
    bunx wrangler deployments list --config wrangler.toml
)

echo "Validating deployment bundles"
bunx wrangler deploy --dry-run --env production --outdir /tmp/pokemcp-preflight-worker
(
    cd "${web_root}"
    bunx wrangler deploy --dry-run --config wrangler.toml --outdir /tmp/pokemcp-preflight-web
)

echo "Cloudflare relaunch preflight passed"
