#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
destination="${1:?Pass the backup directory to receive Cloudflare state files}"
web_root="${repo_root}/apps/teambuilder"
if [[ "${destination}" != /* ]]; then
    destination="${repo_root}/${destination#./}"
fi

mkdir -p "${destination}/release-state"
chmod 700 "${destination}/release-state"

date -u +%Y-%m-%dT%H:%M:%SZ > "${destination}/release-state/captured-at.txt"
git -C "${repo_root}" rev-parse HEAD > "${destination}/release-state/git-head.txt"
bunx wrangler d1 list --json > "${destination}/release-state/d1-databases.json"
bunx wrangler deployments list --env production --json > "${destination}/release-state/analysis-deployments.json"
bunx wrangler secret list --env production --format json > "${destination}/release-state/analysis-secret-names.json"
(
    cd "${web_root}"
    bunx wrangler deployments list --config wrangler.toml --json > "${destination}/release-state/web-deployments.json"
    bunx wrangler secret list --config wrangler.toml --format json > "${destination}/release-state/web-secret-names.json"
)
cp "${repo_root}/wrangler.jsonc" "${destination}/release-state/analysis-wrangler.jsonc"
cp "${web_root}/wrangler.toml" "${destination}/release-state/web-wrangler.toml"
chmod 600 "${destination}/release-state/"*
