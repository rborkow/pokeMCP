-- Metagame evolution time-series store (D1).
--
-- Holds one snapshot per (format, date, source). KV (POKEMON_STATS) remains the
-- source of truth for the *current* month used by the existing stats tools; this
-- database holds *history* and powers the get_meta_trends tool.
--
-- Apply with:
--   wrangler d1 migrations apply META_DB --local     (dev)
--   wrangler d1 migrations apply META_DB --remote    (staging/production)

-- One row per (format, date) ingestion.
CREATE TABLE IF NOT EXISTS meta_snapshot (
  format        TEXT NOT NULL,        -- resolved Showdown id, e.g. gen9vgc2026regf
  date          TEXT NOT NULL,        -- 'YYYY-MM' (or finer for non-smogon sources)
  cutoff        INTEGER,              -- info.cutoff (rating weighting threshold)
  num_battles   INTEGER,              -- info["number of battles"]
  total_pokemon INTEGER,             -- count of Pokémon in this snapshot
  source        TEXT NOT NULL DEFAULT 'smogon-chaos',  -- 'limitless' etc. later
  fetched_at    TEXT NOT NULL,        -- ISO timestamp of ingest
  PRIMARY KEY (format, date, source)
);

-- One row per (format, date, source, pokemon). Scalar time series for every
-- Pokémon every month; compact top-N set data (set_json) only for mons above a
-- usage cutoff. INSERT OR REPLACE on this PK makes re-ingesting a month idempotent.
CREATE TABLE IF NOT EXISTS usage_snapshot (
  format       TEXT NOT NULL,
  date         TEXT NOT NULL,         -- 'YYYY-MM'
  source       TEXT NOT NULL DEFAULT 'smogon-chaos',
  pokemon_id   TEXT NOT NULL,         -- toID(name)
  display_name TEXT NOT NULL,
  usage        REAL NOT NULL,         -- fraction 0..1 (same scale as KV index)
  raw_count    INTEGER,
  rank         INTEGER NOT NULL,      -- precomputed: 1 = highest usage in snapshot
  set_json     TEXT,                  -- compact top-N sets; NULL below cutoff
  PRIMARY KEY (format, date, source, pokemon_id)
);

-- One Pokémon over time:  WHERE format=? AND source=? AND pokemon_id=? ORDER BY date
CREATE INDEX IF NOT EXISTS idx_usage_mon_time
  ON usage_snapshot (format, source, pokemon_id, date);

-- One month's full board ranked:  WHERE format=? AND source=? AND date=? ORDER BY rank
CREATE INDEX IF NOT EXISTS idx_usage_format_date_rank
  ON usage_snapshot (format, source, date, rank);
