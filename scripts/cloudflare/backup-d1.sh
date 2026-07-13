#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
destination="${BACKUP_DIR:-${repo_root}/.backups/cloudflare/${timestamp}}"

if (($# == 0)); then
    databases=("pokemcp-meta-history" "pokemcp-prep")
else
    databases=("$@")
fi

mkdir -p "${destination}"
chmod 700 "${destination}"

for database in "${databases[@]}"; do
    sql_file="${destination}/${database}.sql"
    bookmark_file="${destination}/${database}.bookmark.json"
    validation_db="${destination}/${database}.validation.sqlite3"

    echo "Capturing Time Travel bookmark for ${database}"
    bunx wrangler d1 time-travel info "${database}" --json > "${bookmark_file}"

    echo "Exporting ${database}"
    bunx wrangler d1 export "${database}" --remote --output "${sql_file}"

    echo "Validating ${database} export"
    sqlite3 "${validation_db}" < "${sql_file}"
    integrity="$(sqlite3 "${validation_db}" "PRAGMA integrity_check;")"
    if [[ "${integrity}" != "ok" ]]; then
        echo "Backup validation failed for ${database}: ${integrity}" >&2
        exit 1
    fi
    rm "${validation_db}"
    shasum -a 256 "${sql_file}" > "${sql_file}.sha256"
    chmod 600 "${sql_file}" "${sql_file}.sha256" "${bookmark_file}"
done

"${repo_root}/scripts/cloudflare/capture-state.sh" "${destination}"

echo "Validated backups written to ${destination}"
