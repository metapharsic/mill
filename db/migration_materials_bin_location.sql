ALTER TABLE materials ADD COLUMN IF NOT EXISTS bin_location VARCHAR(30);
INSERT INTO schema_migrations (filename) VALUES ('migration_materials_bin_location.sql')
ON CONFLICT (filename) DO NOTHING;
