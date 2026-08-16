-- Bearing checklist: add numeric readings (temp, vibration) alongside F/S B/S status dropdowns,
-- plus static bearing catalog numbers on the equipment master record.
ALTER TABLE equipment
  ADD COLUMN IF NOT EXISTS bearing_no_fs VARCHAR(40),
  ADD COLUMN IF NOT EXISTS bearing_no_bs VARCHAR(40);

ALTER TABLE equipment_inspection
  ADD COLUMN IF NOT EXISTS fs_temp NUMERIC(6,2),
  ADD COLUMN IF NOT EXISTS bs_temp NUMERIC(6,2),
  ADD COLUMN IF NOT EXISTS fs_vibration NUMERIC(6,2),
  ADD COLUMN IF NOT EXISTS bs_vibration NUMERIC(6,2);

INSERT INTO schema_migrations (filename) VALUES ('migration_bearing_readings_expand.sql')
ON CONFLICT (filename) DO NOTHING;
