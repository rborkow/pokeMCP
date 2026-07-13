#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
workdir="$(mktemp -d)"
trap 'rm -rf "${workdir}"' EXIT

meta_empty="${workdir}/meta-empty.db"
meta_existing="${workdir}/meta-existing.db"
prep_empty="${workdir}/prep-empty.db"
prep_existing="${workdir}/prep-existing.db"

# Every migration must build a clean database from zero.
sqlite3 "${meta_empty}" < "${repo_root}/migrations/d1/0001_meta_history.sql"
sqlite3 "${meta_empty}" < "${repo_root}/migrations/d1/0002_tournament_newsroom.sql"
sqlite3 "${prep_empty}" < "${repo_root}/apps/teambuilder/migrations/prep/0001_prep.sql"

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

# The initial account migration is intentionally idempotent so a populated
# local fixture remains readable when the schema is replayed in CI.
sqlite3 "${prep_existing}" < "${repo_root}/apps/teambuilder/migrations/prep/0001_prep.sql"
sqlite3 "${prep_existing}" <<'SQL'
INSERT INTO "user" (
  "id", "name", "email", "emailVerified", "createdAt", "updatedAt"
) VALUES ('user-1', 'Migration Test', 'migration@example.invalid', 1, 1, 1);
INSERT INTO prep_team (
  id, user_id, name, format, data_json, created_at, updated_at
) VALUES (
  'team-1', 'user-1', 'Test team', 'champions-regmb', '{}',
  '2026-07-13T00:00:00.000Z', '2026-07-13T00:00:00.000Z'
);
SQL
sqlite3 "${prep_existing}" < "${repo_root}/apps/teambuilder/migrations/prep/0001_prep.sql"

prep_rows="$(sqlite3 "${prep_existing}" "SELECT COUNT(*) FROM prep_team;")"
[[ "${prep_rows}" == "1" ]]

for database in "${meta_empty}" "${meta_existing}" "${prep_empty}" "${prep_existing}"; do
    integrity="$(sqlite3 "${database}" "PRAGMA integrity_check;")"
    foreign_keys="$(sqlite3 "${database}" "PRAGMA foreign_key_check;")"
    [[ "${integrity}" == "ok" ]]
    [[ -z "${foreign_keys}" ]]
done

echo "D1 migrations passed empty and populated database checks"
