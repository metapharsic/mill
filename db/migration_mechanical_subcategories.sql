-- Sub-categorize Mechanical store items per Projects_Requirement/MECHANICAL STORE AUGUST-2026.xlsx
-- (one real subcategory per live sheet in that workbook; legacy/duplicate sheets and the
-- non-item "Sheet1" pump-master sheet were excluded — see session audit).
ALTER TABLE material_categories ADD COLUMN IF NOT EXISTS parent_id INTEGER REFERENCES material_categories(id);

INSERT INTO material_categories (name, code, type, parent_id)
SELECT v.name, v.code, 'Mechanical', mech.id
FROM (VALUES
  ('Bearing', 'MECH-BRG'),
  ('Oil Seal', 'MECH-OSL'),
  ('Tyre Coupling & Pin Bush', 'MECH-TCP'),
  ('Pump Sleeve', 'MECH-PSL'),
  ('V-Belt', 'MECH-VBT'),
  ('Welding Rods', 'MECH-WLD'),
  ('Blade/Cutting Wheel & Grinding', 'MECH-BLD'),
  ('Valve', 'MECH-VLV'),
  ('Check Nut & Washer', 'MECH-CNW'),
  ('Gauges', 'MECH-GUG'),
  ('Shaft & Impeller', 'MECH-SFT'),
  ('SS/MS Pipe Fitting', 'MECH-PIP'),
  ('Nozzles', 'MECH-NOZ'),
  ('Lubricants', 'MECH-LUB'),
  ('Compressor', 'MECH-CMP'),
  ('Pulley', 'MECH-PUL'),
  ('Bolts & Nuts/Washers', 'MECH-BNW')
) AS v(name, code)
CROSS JOIN (SELECT id FROM material_categories WHERE code = 'MECH') AS mech
ON CONFLICT (code) DO NOTHING;
