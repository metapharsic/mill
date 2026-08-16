-- ============================================================
-- Daily Production Report (DPR) — Production module consolidated daily artifact
-- Mirrors the mill's daily WhatsApp PM/C report:
--   PM/C prod + GSM-wise sets/MT + running/down hrs + downtime reasons
--   + chemical consumption (kg/ton) + furnish + power (unit/ton) + boiler (steam/ton)
-- All per-ton ratios are COMPUTED server-side on read (denominator = pmc_production_mt),
-- never stored — matches doc 02 "computed server-side, never stored".
-- Safe to re-run: all IF NOT EXISTS. Tracking via migrate.js schema_migrations(filename).
-- ============================================================

-- Header — one consolidated report per date per machine
CREATE TABLE IF NOT EXISTS daily_production_reports (
  id                   SERIAL PRIMARY KEY,
  report_date          DATE          NOT NULL,
  machine_id           INTEGER       REFERENCES machines(id),
  -- production
  pmc_production_mt    NUMERIC(12,3) DEFAULT 0,   -- PM/C Prod — denominator for ALL ratios
  finish_production_mt NUMERIC(12,3) DEFAULT 0,   -- Finish production
  total_sets           INTEGER       DEFAULT 0,
  running_minutes      INTEGER       DEFAULT 0,   -- stored minutes; shown HH:MM
  down_minutes         INTEGER       DEFAULT 0,
  -- furnish (raw pulp input)
  furnish_local_mt     NUMERIC(12,3) DEFAULT 0,
  furnish_occ_mt       NUMERIC(12,3) DEFAULT 0,
  furnish_total_mt     NUMERIC(12,3) DEFAULT 0,
  -- power
  power_units          NUMERIC(12,2) DEFAULT 0,
  dg_units             NUMERIC(12,2) DEFAULT 0,
  -- boiler
  rice_husk_mt         NUMERIC(12,3) DEFAULT 0,
  total_steam_mt       NUMERIC(12,3) DEFAULT 0,
  status               VARCHAR(20)   DEFAULT 'Draft' CHECK (status IN ('Draft','Submitted','Approved')),
  remarks              TEXT,
  created_by           INTEGER       REFERENCES users(id),
  approved_by          INTEGER       REFERENCES users(id),
  created_at           TIMESTAMPTZ   DEFAULT now(),
  updated_at           TIMESTAMPTZ   DEFAULT now(),
  UNIQUE (report_date, machine_id)
);
CREATE INDEX IF NOT EXISTS idx_dpr_date ON daily_production_reports(report_date DESC);

-- GSM-wise production breakup (e.g. 140/22 - 23 set - 39.000 MT)
CREATE TABLE IF NOT EXISTS dpr_gsm_breakup (
  id            SERIAL PRIMARY KEY,
  report_id     INTEGER NOT NULL REFERENCES daily_production_reports(id) ON DELETE CASCADE,
  gsm           NUMERIC(6,1) NOT NULL,        -- 140
  bf            NUMERIC(6,1),                 -- 22  (BF / deckle code from "140/22")
  sets          INTEGER       DEFAULT 0,
  production_mt NUMERIC(12,3) DEFAULT 0,
  sort_order    INTEGER       DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_dpr_gsm_report ON dpr_gsm_breakup(report_id);

-- Chemical consumption lines (kg/ton computed on read off pmc_production_mt)
CREATE TABLE IF NOT EXISTS dpr_chemical_lines (
  id            SERIAL PRIMARY KEY,
  report_id     INTEGER NOT NULL REFERENCES daily_production_reports(id) ON DELETE CASCADE,
  chemical_name VARCHAR(100) NOT NULL,        -- Starch / PAC / Surface Size / Coagulant ...
  chemical_id   INTEGER REFERENCES materials(id),  -- optional link to material master
  qty_kg        NUMERIC(12,3) DEFAULT 0,
  sort_order    INTEGER DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_dpr_chem_report ON dpr_chemical_lines(report_id);

-- Downtime reasons (summarised per report — "01:00 hrs loss due to 1st press vacuum box bolt broken")
CREATE TABLE IF NOT EXISTS dpr_downtime_lines (
  id         SERIAL PRIMARY KEY,
  report_id  INTEGER NOT NULL REFERENCES daily_production_reports(id) ON DELETE CASCADE,
  shift      VARCHAR(20),                     -- Day / Night / Day+Night
  minutes    INTEGER DEFAULT 0,
  reason     TEXT,
  sort_order INTEGER DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_dpr_dt_report ON dpr_downtime_lines(report_id);
