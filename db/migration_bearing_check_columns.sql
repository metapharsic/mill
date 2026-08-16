-- Ph32 E2: bearing-side granularity on equipment_inspection (F/S, B/S split)
ALTER TABLE equipment_inspection
  ADD COLUMN IF NOT EXISTS fs_status VARCHAR(30) CHECK (fs_status IN ('Normal','Needs Attention','Critical')),
  ADD COLUMN IF NOT EXISTS bs_status VARCHAR(30) CHECK (bs_status IN ('Normal','Needs Attention','Critical')),
  ADD COLUMN IF NOT EXISTS shift VARCHAR(10) CHECK (shift IN ('Day','Night'));

ALTER TABLE equipment_inspection ALTER COLUMN status DROP NOT NULL;

INSERT INTO schema_migrations (filename) VALUES ('migration_bearing_check_columns.sql')
ON CONFLICT (filename) DO NOTHING;
