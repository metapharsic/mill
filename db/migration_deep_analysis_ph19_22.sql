-- Migration: Deep Analysis Tables (Ph20-A + Ph21-A)
-- Run: psql -U postgres -d mk_paper_mill -f db/migration_deep_analysis_ph19_22.sql

-- ============================================================
-- Ph20-A: QUALITY LAB TESTS (linked to reels)
-- ============================================================
CREATE TABLE IF NOT EXISTS quality_lab_tests (
  id                BIGSERIAL PRIMARY KEY,
  reel_id           INTEGER REFERENCES reels(id) ON DELETE SET NULL,
  section_id        INTEGER REFERENCES plant_sections(id),
  shift_id          INTEGER REFERENCES shifts(id),
  test_time         TIMESTAMP NOT NULL DEFAULT NOW(),
  -- Formation quality
  freeness_csf      NUMERIC(7,2),          -- mL  (Canadian Standard Freeness)
  consistency_pct   NUMERIC(5,3),          -- %   (stock consistency at box)
  -- Paper quality
  basis_weight_gsm  NUMERIC(7,3),          -- g/m²
  burst_factor      NUMERIC(6,2),          -- BF
  moisture_pct      NUMERIC(5,2),          -- %
  tensile_md        NUMERIC(8,2),          -- N/m (Machine Direction)
  tensile_cd        NUMERIC(8,2),          -- N/m (Cross Direction)
  cobb_size         NUMERIC(7,3),          -- g/m² (sizing quality)
  -- Cleanliness
  dirt_count        NUMERIC(8,3),          -- mm²/m²
  -- Rewinder / finish
  trim_loss_mm      NUMERIC(7,2),          -- total trim (mm)
  slit_count        SMALLINT,              -- number of slits
  -- Meta
  lab_by            INTEGER REFERENCES users(id),
  remarks           TEXT,
  created_at        TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_qlt_reel     ON quality_lab_tests(reel_id);
CREATE INDEX IF NOT EXISTS idx_qlt_section  ON quality_lab_tests(section_id, test_time DESC);
CREATE INDEX IF NOT EXISTS idx_qlt_shift    ON quality_lab_tests(shift_id, test_time DESC);

-- ============================================================
-- Ph21-A: MACHINE EVENTS (paper break, web wrap, e-stop, etc.)
-- ============================================================
CREATE TABLE IF NOT EXISTS machine_events (
  id                BIGSERIAL PRIMARY KEY,
  section_id        INTEGER REFERENCES plant_sections(id),
  equipment_id      INTEGER REFERENCES section_equipment(id),
  -- Classification
  event_type        VARCHAR(30) NOT NULL CHECK (event_type IN (
                      'paper_break','web_wrap','emergency_stop',
                      'roll_change','chemical_alarm','instrument_fault','other'
                    )),
  severity          VARCHAR(10) NOT NULL DEFAULT 'Warning' CHECK (severity IN ('Critical','Warning','Info')),
  -- Timing
  event_time        TIMESTAMP NOT NULL DEFAULT NOW(),
  duration_min      NUMERIC(7,2),          -- how long event lasted
  resumed_at        TIMESTAMP,
  -- Root cause
  root_cause_code   VARCHAR(50),           -- maps to downtime_reason_codes
  location_detail   VARCHAR(100),          -- e.g. "press nip #2", "4th dryer cylinder"
  description       TEXT,
  -- Links
  downtime_entry_id INTEGER REFERENCES downtime_entries(id),
  alarm_id          INTEGER REFERENCES section_alarms(id),
  -- Operator
  reported_by       INTEGER REFERENCES users(id),
  resolved_by       INTEGER REFERENCES users(id),
  resolution_note   TEXT,
  -- Kafka
  kafka_published   BOOLEAN DEFAULT false,
  created_at        TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_me_section_time  ON machine_events(section_id, event_time DESC);
CREATE INDEX IF NOT EXISTS idx_me_equipment     ON machine_events(equipment_id, event_time DESC);
CREATE INDEX IF NOT EXISTS idx_me_event_type    ON machine_events(event_type, severity);
