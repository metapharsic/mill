-- ============================================================
-- Daily Performance Statement ENGINE — feeder artifacts + standards
-- Principle: report ASSEMBLES from department transactions, not typed by hand.
-- Fills the 3 gaps that block auto-assembly:
--   1. furnish_mix_log     — Raw Material / Pulp dept furnish batches (was MISSING)
--   2. downtime_reason_codes — coded downtime master (was free-text only)
--   3. dpr_grade_standards  — per-ton norms so variance can be computed
-- Safe to re-run: IF NOT EXISTS + ON CONFLICT. Tracked by migrate.js (filename).
-- ============================================================

-- ── 1. FURNISH MIX LOG (Raw Material / Pulp dept) ────────────────────────────
CREATE TABLE IF NOT EXISTS furnish_mix_log (
  id                SERIAL PRIMARY KEY,
  batch_number      VARCHAR(60) UNIQUE,
  report_date       DATE NOT NULL,
  machine_id        INTEGER REFERENCES machines(id),
  shift_type        VARCHAR(10),
  local_furnish_kg  NUMERIC(14,2) DEFAULT 0,
  occ_furnish_kg    NUMERIC(14,2) DEFAULT 0,
  other_furnish_kg  NUMERIC(14,2) DEFAULT 0,
  local_lot         VARCHAR(60),
  occ_lot           VARCHAR(60),
  local_moisture    NUMERIC(5,2),
  occ_moisture      NUMERIC(5,2),
  prepared_by       INTEGER REFERENCES users(id),
  remarks           TEXT,
  created_at        TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_furnish_date ON furnish_mix_log(report_date, machine_id);

-- ── 2. DOWNTIME REASON CODE MASTER (coded, hierarchical — no free text) ──────
CREATE TABLE IF NOT EXISTS downtime_reason_codes (
  id            SERIAL PRIMARY KEY,
  reason_code   VARCHAR(30) UNIQUE NOT NULL,
  category      VARCHAR(30) NOT NULL,   -- Mechanical / Electrical / Process / Utility / Planned / Other
  subcategory   VARCHAR(50),
  component     VARCHAR(100),
  description   VARCHAR(200) NOT NULL,
  is_breakdown  BOOLEAN DEFAULT true,
  severity      VARCHAR(20) DEFAULT 'Medium',
  typical_minutes INTEGER,
  is_active     BOOLEAN DEFAULT true
);
INSERT INTO downtime_reason_codes (reason_code, category, subcategory, component, description, is_breakdown, severity, typical_minutes) VALUES
  ('MECH-VBOX-001','Mechanical','Breakdown','1st Press Vacuum Box','Vacuum box bolt broken/cracked', true, 'Medium', 60),
  ('MECH-VBOX-002','Mechanical','Breakdown','1st Press Vacuum Box','Vacuum box seal strip worn', true, 'Medium', 45),
  ('MECH-PRESS-001','Mechanical','Breakdown','Press Section','Press roll bearing failure', true, 'High', 120),
  ('MECH-DRYER-001','Mechanical','Breakdown','Dryer Section','Dryer steam joint leak', true, 'High', 90),
  ('PROC-PBRK-001','Process','Paper Break','Press Section','Paper break at press', false, 'Low', 25),
  ('PROC-PBRK-002','Process','Paper Break','Dryer Section','Paper break at dryer', false, 'Low', 30),
  ('PROC-GRDCHG-001','Process','Grade Change',NULL,'Grade change (GSM/width)', false, 'Low', 45),
  ('UTIL-POWERCUT-001','Utility','Power Failure',NULL,'External power failure (grid)', true, 'High', 65),
  ('UTIL-STEAM-001','Utility','Steam Failure',NULL,'Low steam pressure', true, 'Medium', 30),
  ('PLAN-MAINT-001','Planned','Maintenance',NULL,'Planned maintenance stop', false, 'Low', NULL)
ON CONFLICT (reason_code) DO NOTHING;

-- link DPR downtime lines to the coded master (optional FK by code)
ALTER TABLE dpr_downtime_lines ADD COLUMN IF NOT EXISTS reason_code VARCHAR(30);

-- ── 3. PER-TON STANDARDS (norms for variance) ────────────────────────────────
CREATE TABLE IF NOT EXISTS dpr_grade_standards (
  id                     SERIAL PRIMARY KEY,
  grade_code             VARCHAR(20) UNIQUE NOT NULL,   -- 'DEFAULT' or '140/22'
  -- chemical kg/ton norms
  starch_kg_per_ton      NUMERIC(8,3) DEFAULT 0,
  pac_kg_per_ton         NUMERIC(8,3) DEFAULT 0,
  surface_size_kg_per_ton NUMERIC(8,3) DEFAULT 0,
  coagulant_kg_per_ton   NUMERIC(8,3) DEFAULT 0,
  deformer_kg_per_ton    NUMERIC(8,3) DEFAULT 0,
  retention_kg_per_ton   NUMERIC(8,3) DEFAULT 0,
  -- utility norms
  power_unit_per_ton     NUMERIC(8,3) DEFAULT 0,
  steam_mt_per_ton       NUMERIC(8,3) DEFAULT 0,
  husk_mt_per_ton        NUMERIC(8,3) DEFAULT 0,
  yield_pct              NUMERIC(5,2) DEFAULT 0,
  is_active              BOOLEAN DEFAULT true
);
INSERT INTO dpr_grade_standards
  (grade_code, starch_kg_per_ton, pac_kg_per_ton, surface_size_kg_per_ton, coagulant_kg_per_ton,
   deformer_kg_per_ton, retention_kg_per_ton, power_unit_per_ton, steam_mt_per_ton, husk_mt_per_ton, yield_pct)
VALUES
  ('DEFAULT', 28.0, 1.5, 0.5, 0.4, 0.3, 0.1, 230.0, 1.600, 0.280, 91.0)
ON CONFLICT (grade_code) DO NOTHING;
