-- Migration: Material Section and Machine Links & MCN Equipment
-- Run: psql -U postgres -d mk_paper_mill -f db/migration_material_section_machine.sql

-- 1. Alter materials table
ALTER TABLE materials
  ADD COLUMN IF NOT EXISTS section_id INTEGER REFERENCES plant_sections(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS machine_id INTEGER REFERENCES machines(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS section_equipment_id INTEGER REFERENCES section_equipment(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_materials_section_id ON materials(section_id);
CREATE INDEX IF NOT EXISTS idx_materials_machine_id ON materials(machine_id);
CREATE INDEX IF NOT EXISTS idx_materials_section_equipment_id ON materials(section_equipment_id);

-- 2. Insert missing plant_sections if any
INSERT INTO plant_sections (section_code, name, icon, description, sort_order, is_active)
VALUES
  ('CLOTHING', 'Clothing Section', '🧵', 'Paper Machine Clothing & Fabrics', 16, true),
  ('MISC', 'Miscellaneous Section', '📦', 'General Mill & Common Utilities', 99, true)
ON CONFLICT (section_code) DO NOTHING;

INSERT INTO schema_migrations (filename) VALUES ('migration_material_section_machine.sql')
ON CONFLICT (filename) DO NOTHING;
