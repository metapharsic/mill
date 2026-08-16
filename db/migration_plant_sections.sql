-- M11: Plant Sections Module
-- Run: psql -U postgres -d mk_paper_mill -f db/migration_plant_sections.sql

-- ============================================================
-- MASTER REGISTRY
-- ============================================================
CREATE TABLE IF NOT EXISTS plant_sections (
  id            SERIAL PRIMARY KEY,
  section_code  VARCHAR(30) UNIQUE NOT NULL,
  name          VARCHAR(100) NOT NULL,
  icon          VARCHAR(10),
  description   TEXT,
  sort_order    INTEGER DEFAULT 0,
  is_active     BOOLEAN DEFAULT true,
  created_at    TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- EQUIPMENT PER SECTION
-- ============================================================
CREATE TABLE IF NOT EXISTS section_equipment (
  id                SERIAL PRIMARY KEY,
  section_id        INTEGER REFERENCES plant_sections(id),
  machine_id        INTEGER REFERENCES machines(id),
  tag_name          VARCHAR(50) UNIQUE NOT NULL,
  equipment_name    VARCHAR(150) NOT NULL,
  equipment_type    VARCHAR(50),
  manufacturer      VARCHAR(100),
  model_number      VARCHAR(100),
  serial_number     VARCHAR(100),
  installation_date DATE,
  rated_capacity    VARCHAR(50),
  design_pressure   VARCHAR(30),
  design_temp       VARCHAR(30),
  motor_kw          NUMERIC(8,2),
  rpm               INTEGER,
  is_critical       BOOLEAN DEFAULT false,
  is_active         BOOLEAN DEFAULT true,
  remarks           TEXT,
  created_at        TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- TIME-SERIES PROCESS READINGS
-- ============================================================
CREATE TABLE IF NOT EXISTS section_process_readings (
  id             BIGSERIAL PRIMARY KEY,
  section_id     INTEGER REFERENCES plant_sections(id),
  equipment_id   INTEGER REFERENCES section_equipment(id),
  tag_name       VARCHAR(50) NOT NULL,
  parameter_name VARCHAR(100) NOT NULL,
  value          NUMERIC(12,4),
  uom            VARCHAR(20),
  reading_time   TIMESTAMP NOT NULL DEFAULT NOW(),
  shift_id       INTEGER REFERENCES shifts(id),
  recorded_by    INTEGER REFERENCES users(id),
  source         VARCHAR(20) DEFAULT 'Manual' CHECK (source IN ('Manual','SCADA','Auto')),
  created_at     TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_spr_section_time ON section_process_readings(section_id, reading_time DESC);
CREATE INDEX IF NOT EXISTS idx_spr_tag_time     ON section_process_readings(tag_name, reading_time DESC);

-- ============================================================
-- ALARM LOG
-- ============================================================
CREATE TABLE IF NOT EXISTS section_alarms (
  id                 SERIAL PRIMARY KEY,
  section_id         INTEGER REFERENCES plant_sections(id),
  equipment_id       INTEGER REFERENCES section_equipment(id),
  tag_name           VARCHAR(50),
  alarm_code         VARCHAR(30),
  alarm_type         VARCHAR(20) NOT NULL CHECK (alarm_type IN ('Critical','Warning','Info')),
  description        TEXT NOT NULL,
  triggered_at       TIMESTAMP NOT NULL DEFAULT NOW(),
  acknowledged_at    TIMESTAMP,
  acknowledged_by    INTEGER REFERENCES users(id),
  resolved_at        TIMESTAMP,
  resolution_note    TEXT,
  maintenance_log_id INTEGER REFERENCES maintenance_logs(id),
  created_at         TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_alarms_section ON section_alarms(section_id, triggered_at DESC);
CREATE INDEX IF NOT EXISTS idx_alarms_active  ON section_alarms(section_id, resolved_at) WHERE resolved_at IS NULL;

-- ============================================================
-- SOPs
-- ============================================================
CREATE TABLE IF NOT EXISTS section_sops (
  id          SERIAL PRIMARY KEY,
  section_id  INTEGER REFERENCES plant_sections(id),
  sop_type    VARCHAR(30) NOT NULL CHECK (sop_type IN ('Startup','Shutdown','Emergency','Changeover','Cleaning')),
  title       VARCHAR(200) NOT NULL,
  version     VARCHAR(10) DEFAULT '1.0',
  steps       JSONB NOT NULL DEFAULT '[]',
  approved_by INTEGER REFERENCES users(id),
  approved_at TIMESTAMP,
  is_active   BOOLEAN DEFAULT true,
  created_at  TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- HOURLY KPI SNAPSHOT (All-Sections aggregator)
-- ============================================================
CREATE TABLE IF NOT EXISTS section_kpi_snapshots (
  id            SERIAL PRIMARY KEY,
  section_id    INTEGER REFERENCES plant_sections(id),
  snapshot_time TIMESTAMP NOT NULL,
  kpi_data      JSONB NOT NULL DEFAULT '{}',
  created_at    TIMESTAMP DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_kpi_section_hour
  ON section_kpi_snapshots(section_id, date_trunc('hour', snapshot_time));

-- ============================================================
-- SEED: 21 PLANT SECTIONS
-- ============================================================
INSERT INTO plant_sections (section_code, name, icon, description, sort_order) VALUES
  ('ALL',           'All Sections',          '🌐', 'Unified plant-wide aggregator dashboard', 0),
  ('PULP',          'Pulp Mill',             '🪵', 'Converts raw fiber into clean refined pulp', 1),
  ('CENTRI',        'Centricleaner',         '🌀', 'Centrifugal removal of fine/heavy contaminants', 2),
  ('WIRE',          'Wire Section',          '🕸️', 'Sheet forming — dilute stock drained through forming fabric', 3),
  ('VACUUM',        'Vacuum',                '💨', 'Controlled vacuum for wire/press/felt dewatering', 4),
  ('PRESS',         'Press Section',         '🗜️', 'Mechanical water removal — 20% to 42–50% dryness', 5),
  ('UNIRUN',        'Unirun',                '🏃', 'Single-felt closed draw transfer press→dryer', 6),
  ('PREDRYER',      'Pre Dryer',             '🔥', 'Steam-heated cylinders — 50% to 92–95% dryness', 7),
  ('SIZEPRESS',     'Size Press',            '📏', 'Surface starch/sizing application', 8),
  ('SIZEKITCHEN',   'Size Kitchen',          '🍳', 'Starch cooking and supply for size press', 9),
  ('POSTDRYER',     'Post Dryer',            '☀️', 'Final drying after size press to 94–96%', 10),
  ('CALENDER',      'Calender',              '🛢️', 'Smoothness/gloss/caliper improvement via nip', 11),
  ('POPE',          'Pope Reel',             '⭕', 'Winds finished paper into parent jumbo reel', 12),
  ('REWINDER',      'Rewinder',              '🔄', 'Slits parent reel into customer roll specs', 13),
  ('STARCHKITCHEN', 'Starch Kitchen',        '🧪', 'Wet-end starch preparation for retention/strength', 14),
  ('STEAMCOND',     'Steam & Condensate',    '💧', 'Steam distribution and condensate recovery circuit', 15),
  ('ETP',           'ETP',                   '🍀', 'Effluent treatment — primary/secondary/tertiary', 16),
  ('BOILER',        'Boiler',                '🌋', 'Steam generation and co-generation', 17),
  ('LAB',           'Lab',                   '🔬', 'Quality control testing of RM/in-process/FG', 18),
  ('CRANES',        'Cranes',                '🏗️', 'Material handling — EOT/Gantry/Jib hoists', 19),
  ('COMPRESSORS',   'Compressors & Air Dryer','🌬️','Instrument air and service air generation', 20)
ON CONFLICT (section_code) DO NOTHING;
