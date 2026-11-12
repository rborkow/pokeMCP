#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
workdir="$(mktemp -d)"
trap 'rm -rf "${workdir}"' EXIT

meta_empty="${workdir}/meta-empty.db"
meta_existing="${workdir}/meta-existing.db"

# Every migration must build a clean database from zero.
sqlite3 "${meta_empty}" < "${repo_root}/migrations/d1/0001_meta_history.sql"
sqlite3 "${meta_empty}" < "${repo_root}/migrations/d1/0002_tournament_newsroom.sql"

# The tournament migration must preserve an already-populated metagame store.
sqlite3 "${meta_existing}" < "${repo_root}/migrations/d1/0001_meta_history.sql"
sqlite3 "${meta_existing}" <<'SQL'
INSERT INTO meta_snapshot (
  format, date, cutoff, num_battles, total_pokemon, source, fetched_at
) VALUES (
  'gen9championsvgc2026regmb', '2026-07', 1500, 100, 1, 'smogon-chaos',
  '2026-07-13T00:00:00.000Z'
);
INSERT INTO usage_snapshot (
  format, date, source, pokemon_id, display_name, usage, raw_count, rank, set_json
) VALUES (
  'gen9championsvgc2026regmb', '2026-07', 'smogon-chaos', 'pikachu', 'Pikachu',
  0.1, 10, 1, NULL
);
SQL
sqlite3 "${meta_existing}" < "${repo_root}/migrations/d1/0002_tournament_newsroom.sql"

meta_rows="$(sqlite3 "${meta_existing}" "SELECT COUNT(*) FROM usage_snapshot;")"
[[ "${meta_rows}" == "1" ]]

for database in "${meta_empty}" "${meta_existing}"; do
    integrity="$(sqlite3 "${database}" "PRAGMA integrity_check;")"
    foreign_keys="$(sqlite3 "${database}" "PRAGMA foreign_key_check;")"
    [[ "${integrity}" == "ok" ]]
    [[ -z "${foreign_keys}" ]]
done

echo "D1 migrations passed empty and populated database checks"
