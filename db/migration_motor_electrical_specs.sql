-- F2 gap fix: KW/RPM/Bearing-No-FS/Bearing-No-BS were never captured (only HP+Amps landed on equipment table,
-- and only for the granular bearing-checklist rolls, not this separate motor electrical master list).
-- Dedicated table — source's "Machine" section bucket is coarser than the app's 21 granular plant sections
-- (WIRE/PRESS/POPE_REEL/CALENDER/CRANES/VACUUM etc all fall under one "Machine" label here), so this is NOT
-- forced onto equipment.section_id — that would require guessing a lossy many-to-one mapping.
CREATE TABLE IF NOT EXISTS motor_electrical_specs (
  id             SERIAL PRIMARY KEY,
  sr_no          INTEGER,
  motor_name     VARCHAR(150) NOT NULL,
  kw             NUMERIC(8,2),
  hp             NUMERIC(8,2),
  rpm            INTEGER,
  full_amp       NUMERIC(8,2),
  bearing_no_fs  VARCHAR(40),
  bearing_no_bs  VARCHAR(40),
  section_label  VARCHAR(50) NOT NULL,  -- raw source label: Pulp Mill / Machine / Starch / Rewinder / ETP / Boiler
  created_at     TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_motor_specs_section ON motor_electrical_specs(section_label);

INSERT INTO schema_migrations (filename) VALUES ('migration_motor_electrical_specs.sql')
ON CONFLICT (filename) DO NOTHING;
