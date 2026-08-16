-- Migration: Seed Machine Positions and Digital Twin Installed Assets

-- 1. Insert Standard Machine Positions for Paper Machine 1 & Plant Equipment
INSERT INTO machine_positions (machine_id, name, code, is_active)
SELECT 1, 'Forming Wire Section / Breast Roll Position', 'PM1-WIRE-BRST', true
WHERE NOT EXISTS (SELECT 1 FROM machine_positions WHERE code = 'PM1-WIRE-BRST');

INSERT INTO machine_positions (machine_id, name, code, is_active)
SELECT 1, '1st Press Bottom Felt Position (15.1x3.5m)', 'PM1-PRSS1-BTMFLT', true
WHERE NOT EXISTS (SELECT 1 FROM machine_positions WHERE code = 'PM1-PRSS1-BTMFLT');

INSERT INTO machine_positions (machine_id, name, code, is_active)
SELECT 1, '1st Unirun Group Voith Position (41x3.5m)', 'PM1-UNIRUN-GRP1', true
WHERE NOT EXISTS (SELECT 1 FROM machine_positions WHERE code = 'PM1-UNIRUN-GRP1');

INSERT INTO machine_positions (machine_id, name, code, is_active)
SELECT 1, 'Dryer Group #1 / Cylinder #3 Drive Bearing', 'PM1-DRY1-CYL3-DE', true
WHERE NOT EXISTS (SELECT 1 FROM machine_positions WHERE code = 'PM1-DRY1-CYL3-DE');

INSERT INTO machine_positions (machine_id, name, code, is_active)
SELECT 1, 'Calender Stack / Top Chilled Roll Bearing', 'PM1-CAL-TPROLL', true
WHERE NOT EXISTS (SELECT 1 FROM machine_positions WHERE code = 'PM1-CAL-TPROLL');

INSERT INTO machine_positions (machine_id, name, code, is_active)
SELECT 2, 'Paper Machine 2 / Wire Forming Table', 'PM2-WIRE-TBL', true
WHERE NOT EXISTS (SELECT 1 FROM machine_positions WHERE code = 'PM2-WIRE-TBL');

INSERT INTO machine_positions (machine_id, name, code, is_active)
SELECT 3, 'Rewinder 1 / Slitter Arbor Drive Bearing', 'RW1-SLIT-DE', true
WHERE NOT EXISTS (SELECT 1 FROM machine_positions WHERE code = 'RW1-SLIT-DE');

-- 2. Mark High-Criticality Clothing & Bearings as is_serialized = true
UPDATE materials SET is_serialized = true, expected_lifespan_days = 365 WHERE code IN ('URG001', 'PF0004', 'BE0171', 'BE0172', 'BE0173', 'MIMP022');

-- 3. Seed Initial Live Digital Twin Installed Assets
INSERT INTO installed_assets (
  asset_number, material_id, serial_number, batch_number, machine_id, position_id,
  requested_by, approved_by, issued_by, purchase_price, installed_at, status, expected_lifespan_days
)
SELECT
  'AST-20260701-0001',
  m.id,
  'VOITH-SN-12595227',
  'LOT-2026-VTH-01',
  1,
  (SELECT id FROM machine_positions WHERE code = 'PM1-UNIRUN-GRP1' LIMIT 1),
  1, 1, 1,
  COALESCE(m.unit_price, 45000.00),
  NOW() - INTERVAL '44 days',
  'active',
  365
FROM materials m
WHERE m.code = 'URG001'
  AND NOT EXISTS (SELECT 1 FROM installed_assets WHERE asset_number = 'AST-20260701-0001');

INSERT INTO installed_assets (
  asset_number, material_id, serial_number, batch_number, machine_id, position_id,
  requested_by, approved_by, issued_by, purchase_price, installed_at, status, expected_lifespan_days
)
SELECT
  'AST-20260615-0002',
  m.id,
  'VOITH-PF-12759027',
  'LOT-2026-VTH-02',
  1,
  (SELECT id FROM machine_positions WHERE code = 'PM1-PRSS1-BTMFLT' LIMIT 1),
  1, 1, 1,
  COALESCE(m.unit_price, 85000.00),
  NOW() - INTERVAL '60 days',
  'active',
  180
FROM materials m
WHERE m.code = 'PF0004'
  AND NOT EXISTS (SELECT 1 FROM installed_assets WHERE asset_number = 'AST-20260615-0002');

INSERT INTO installed_assets (
  asset_number, material_id, serial_number, batch_number, machine_id, position_id,
  requested_by, approved_by, issued_by, purchase_price, installed_at, status, expected_lifespan_days
)
SELECT
  'AST-20260510-0003',
  m.id,
  'SKF-626-99418',
  'LOT-2026-SKF-88',
  1,
  (SELECT id FROM machine_positions WHERE code = 'PM1-DRY1-CYL3-DE' LIMIT 1),
  1, 1, 1,
  COALESCE(m.unit_price, 1250.00),
  NOW() - INTERVAL '95 days',
  'active',
  730
FROM materials m
WHERE m.code = 'BE0171'
  AND NOT EXISTS (SELECT 1 FROM installed_assets WHERE asset_number = 'AST-20260510-0003');
