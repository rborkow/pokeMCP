CREATE TABLE IF NOT EXISTS tournament_event (
  id               TEXT PRIMARY KEY NOT NULL,
  slug             TEXT NOT NULL UNIQUE,
  name             TEXT NOT NULL,
  event_date       TEXT NOT NULL,
  players          INTEGER NOT NULL,
  format           TEXT NOT NULL,
  regulation_id    TEXT NOT NULL,
  source_url       TEXT NOT NULL,
  data_json        TEXT NOT NULL,
  fetched_at       TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tournament_event_reg_date
  ON tournament_event (regulation_id, event_date DESC);

CREATE TABLE IF NOT EXISTS tournament_team (
  id               TEXT PRIMARY KEY NOT NULL,
  event_id         TEXT NOT NULL REFERENCES tournament_event(id) ON DELETE CASCADE,
  placing          INTEGER NOT NULL,
  player           TEXT NOT NULL,
  record_json      TEXT,
  team_json        TEXT NOT NULL,
  fetched_at       TEXT NOT NULL,
  UNIQUE(event_id, placing)
);

CREATE INDEX IF NOT EXISTS idx_tournament_team_event_place
  ON tournament_team (event_id, placing);

CREATE TABLE IF NOT EXISTS ingestion_job (
  id               TEXT PRIMARY KEY NOT NULL,
  job_type         TEXT NOT NULL,
  started_at       TEXT NOT NULL,
  finished_at      TEXT,
  status           TEXT NOT NULL,
  fetched_count    INTEGER NOT NULL DEFAULT 0,
  error_message    TEXT
);

CREATE INDEX IF NOT EXISTS idx_ingestion_job_type_started
  ON ingestion_job (job_type, started_at DESC);
