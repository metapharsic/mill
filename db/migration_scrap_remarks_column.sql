-- Pre-existing bug found during Doc31 fixes: scrap.js POST/PUT both referenced a remarks column
-- that scrap_records never had. Adding it — cheaper and more correct than stripping the field the code
-- already expects to write/read.
ALTER TABLE scrap_records ADD COLUMN IF NOT EXISTS remarks TEXT;

INSERT INTO schema_migrations (filename) VALUES ('migration_scrap_remarks_column.sql')
ON CONFLICT (filename) DO NOTHING;
