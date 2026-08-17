-- ====================================================================
-- MIGRATION: Paper Machine Clothing (PMC) & Serialized Assets Integrity
-- Ensures 100% Unique Serial Numbering, Lifespan Tracking & Digital Twin
-- ====================================================================

-- 1. Ensure all Clothing category materials are strictly marked as is_serialized = true
UPDATE materials 
SET is_serialized = true,
    expected_lifespan_days = CASE
      WHEN code LIKE 'BW%' OR code LIKE 'TW%' OR name ILIKE '%wire%' THEN 90
      WHEN code LIKE 'PF%' OR name ILIKE '%press felt%' OR name ILIKE '%felt%' THEN 60
      WHEN code LIKE 'DS%' OR code LIKE 'URG%' OR name ILIKE '%dryer%' OR name ILIKE '%unirun%' THEN 365
      ELSE 180
    END,
    criticality_class = 'A'
WHERE category_id IN (
  SELECT id FROM material_categories WHERE name ILIKE '%cloth%' OR code = 'CLOTH'
) OR name ILIKE '%press felt%' OR name ILIKE '%forming wire%' OR name ILIKE '%dryer screen%';

-- 2. Add Unique Index on installed_assets for active/in-stock serial numbers
CREATE UNIQUE INDEX IF NOT EXISTS idx_installed_assets_unique_active_serial 
ON installed_assets (LOWER(TRIM(serial_number))) 
WHERE serial_number IS NOT NULL AND status NOT IN ('retired', 'scrapped');

-- 3. Add helper columns to installed_assets if missing
ALTER TABLE installed_assets ADD COLUMN IF NOT EXISTS running_hours NUMERIC DEFAULT 0;
ALTER TABLE installed_assets ADD COLUMN IF NOT EXISTS tonnage_produced NUMERIC DEFAULT 0;
ALTER TABLE installed_assets ADD COLUMN IF NOT EXISTS cost_per_ton NUMERIC DEFAULT 0;
ALTER TABLE installed_assets ADD COLUMN IF NOT EXISTS vendor_id INTEGER;
ALTER TABLE installed_assets ADD COLUMN IF NOT EXISTS grn_id INTEGER;

-- 4. Seed / Update standard Paper Machine Clothing machine positions if missing
INSERT INTO machine_positions (machine_id, code, name, is_active)
SELECT 1, 'PM1-WIRE-TOP', 'PM1 Forming Section / Top Wire Position (20.25x3.65m)', true
WHERE NOT EXISTS (SELECT 1 FROM machine_positions WHERE code = 'PM1-WIRE-TOP');

INSERT INTO machine_positions (machine_id, code, name, is_active)
SELECT 1, 'PM1-WIRE-BTM', 'PM1 Forming Section / Bottom Wire Position (44.95x3.65m)', true
WHERE NOT EXISTS (SELECT 1 FROM machine_positions WHERE code = 'PM1-WIRE-BTM');

INSERT INTO machine_positions (machine_id, code, name, is_active)
SELECT 1, 'PM1-PRSS1-TOPFLT', 'PM1 1st Press Section / Top Felt Position (15.1x3.5m)', true
WHERE NOT EXISTS (SELECT 1 FROM machine_positions WHERE code = 'PM1-PRSS1-TOPFLT');

INSERT INTO machine_positions (machine_id, code, name, is_active)
SELECT 1, 'PM1-DRY-GRP1', 'PM1 Dryer Section / Group #1 Screen Position (29x3.5m)', true
WHERE NOT EXISTS (SELECT 1 FROM machine_positions WHERE code = 'PM1-DRY-GRP1');

INSERT INTO machine_positions (machine_id, code, name, is_active)
SELECT 1, 'PM1-DRY-GRP2', 'PM1 Dryer Section / Group #2 Screen Position (32x3.5m)', true
WHERE NOT EXISTS (SELECT 1 FROM machine_positions WHERE code = 'PM1-DRY-GRP2');
