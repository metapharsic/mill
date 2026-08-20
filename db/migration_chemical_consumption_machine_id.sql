-- Adds machine_id to chemical_consumption so entries can be attributed to a
-- plant section (via section_equipment) for department-ownership enforcement.
ALTER TABLE chemical_consumption
  ADD COLUMN IF NOT EXISTS machine_id INTEGER REFERENCES machines(id);

INSERT INTO schema_migrations (filename)
VALUES ('migration_chemical_consumption_machine_id.sql')
ON CONFLICT (filename) DO NOTHING;
