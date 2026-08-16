-- Migration: Seed equipment and link departments to plant sections (Ph17-F)

-- 1. Add department_id to plant_sections table
ALTER TABLE plant_sections
  ADD COLUMN IF NOT EXISTS department_id INTEGER REFERENCES departments(id);

-- 2. Link plant sections to their respective departments
-- Production (id = 1)
UPDATE plant_sections SET department_id = 1 WHERE section_code IN (
  'PULP', 'CENTRI', 'WIRE', 'VACUUM', 'PRESS', 'UNIRUN', 'PREDRYER', 
  'SIZEPRESS', 'SIZEKITCHEN', 'POSTDRYER', 'CALENDER', 'POPE', 'REWINDER', 'STARCHKITCHEN'
);
-- Maintenance (id = 8)
UPDATE plant_sections SET department_id = 8 WHERE section_code IN ('CRANES');
-- Utility (id = 9)
UPDATE plant_sections SET department_id = 9 WHERE section_code IN ('STEAMCOND', 'ETP', 'BOILER', 'COMPRESSORS');
-- Laboratory (id = 14)
UPDATE plant_sections SET department_id = 14 WHERE section_code IN ('LAB');
-- Store Management (id = 4)
UPDATE plant_sections SET department_id = 4 WHERE section_code IN ('STORE');

-- 3. Seed section_equipment table
INSERT INTO section_equipment (section_id, machine_id, tag_name, equipment_name, equipment_type, is_critical, is_active)
VALUES
  -- Pulp Mill (Section 2, id matches PULP)
  ((SELECT id FROM plant_sections WHERE section_code='PULP'), 1, 'PULP-REF-01', 'PM1 Refiner 1', 'Refiner', true, true),
  ((SELECT id FROM plant_sections WHERE section_code='PULP'), 2, 'PULP-REF-02', 'PM2 Refiner 1', 'Refiner', true, true),
  
  -- Centricleaner (Section 3, CENTRI)
  ((SELECT id FROM plant_sections WHERE section_code='CENTRI'), 1, 'PM1-CENT-01', 'PM1 Centricleaner Bank', 'Cleaner', false, true),
  ((SELECT id FROM plant_sections WHERE section_code='CENTRI'), 2, 'PM2-CENT-01', 'PM2 Centricleaner Bank', 'Cleaner', false, true),

  -- Wire Section (WIRE)
  ((SELECT id FROM plant_sections WHERE section_code='WIRE'), 1, 'PM1-WIRE-01', 'PM1 Forming Fabric', 'Wire/Fabric', true, true),
  ((SELECT id FROM plant_sections WHERE section_code='WIRE'), 2, 'PM2-WIRE-01', 'PM2 Forming Fabric', 'Wire/Fabric', true, true),

  -- Vacuum (VACUUM)
  ((SELECT id FROM plant_sections WHERE section_code='VACUUM'), 1, 'PM1-VAC-01', 'PM1 Vacuum Pump A', 'Vacuum Pump', true, true),
  ((SELECT id FROM plant_sections WHERE section_code='VACUUM'), 2, 'PM2-VAC-01', 'PM2 Vacuum Pump A', 'Vacuum Pump', true, true),

  -- Press Section (PRESS)
  ((SELECT id FROM plant_sections WHERE section_code='PRESS'), 1, 'PM1-PRES-01', 'PM1 Press Roll', 'Press Roll', true, true),
  ((SELECT id FROM plant_sections WHERE section_code='PRESS'), 2, 'PM2-PRES-01', 'PM2 Shoe Press', 'Press Roll', true, true),

  -- Unirun (UNIRUN)
  ((SELECT id FROM plant_sections WHERE section_code='UNIRUN'), 1, 'PM1-UNI-01', 'PM1 Unirun Blow Box', 'Other', false, true),
  ((SELECT id FROM plant_sections WHERE section_code='UNIRUN'), 2, 'PM2-UNI-01', 'PM2 Unirun Blow Box', 'Other', false, true),

  -- Pre Dryer (PREDRYER)
  ((SELECT id FROM plant_sections WHERE section_code='PREDRYER'), 1, 'PM1-DRY-01', 'PM1 Pre-Dryer Cylinders', 'Dryer Cylinder', true, true),
  ((SELECT id FROM plant_sections WHERE section_code='PREDRYER'), 2, 'PM2-DRY-01', 'PM2 Pre-Dryer Cylinders', 'Dryer Cylinder', true, true),

  -- Size Press (SIZEPRESS)
  ((SELECT id FROM plant_sections WHERE section_code='SIZEPRESS'), 1, 'PM1-SIZE-01', 'PM1 Size Press Roll', 'Press Roll', true, true),
  ((SELECT id FROM plant_sections WHERE section_code='SIZEPRESS'), 2, 'PM2-SIZE-01', 'PM2 Size Press Roll', 'Press Roll', true, true),

  -- Size Kitchen (SIZEKITCHEN)
  ((SELECT id FROM plant_sections WHERE section_code='SIZEKITCHEN'), 1, 'KITCH-STARCH-01', 'PM1 Size Kitchen Cooker', 'Tank/Chest', false, true),
  ((SELECT id FROM plant_sections WHERE section_code='SIZEKITCHEN'), 2, 'KITCH-STARCH-02', 'PM2 Size Kitchen Cooker', 'Tank/Chest', false, true),

  -- Post Dryer (POSTDRYER)
  ((SELECT id FROM plant_sections WHERE section_code='POSTDRYER'), 1, 'PM1-PDRY-01', 'PM1 Post-Dryer Cylinders', 'Dryer Cylinder', true, true),
  ((SELECT id FROM plant_sections WHERE section_code='POSTDRYER'), 2, 'PM2-PDRY-01', 'PM2 Post-Dryer Cylinders', 'Dryer Cylinder', true, true),

  -- Calender (CALENDER)
  ((SELECT id FROM plant_sections WHERE section_code='CALENDER'), 1, 'PM1-CAL-01', 'PM1 Calender Nip', 'Roll', true, true),
  ((SELECT id FROM plant_sections WHERE section_code='CALENDER'), 2, 'PM2-CAL-01', 'PM2 Calender Nip', 'Roll', true, true),

  -- Pope Reel (POPE)
  ((SELECT id FROM plant_sections WHERE section_code='POPE'), 1, 'PM1-POPE-01', 'PM1 Pope Drum', 'Reel', true, true),
  ((SELECT id FROM plant_sections WHERE section_code='POPE'), 2, 'PM2-POPE-01', 'PM2 Pope Drum', 'Reel', true, true),

  -- Rewinder (REWINDER)
  ((SELECT id FROM plant_sections WHERE section_code='REWINDER'), 3, 'RW1-SLIT-01', 'Rewinder 1 Slitter Blades', 'Winder', true, true),
  ((SELECT id FROM plant_sections WHERE section_code='REWINDER'), 4, 'CT1-KNIFE-01', 'Cutter 1 Rotary Knife', 'Other', true, true),

  -- Starch Kitchen (STARCHKITCHEN)
  ((SELECT id FROM plant_sections WHERE section_code='STARCHKITCHEN'), NULL, 'STARCH-COOK-01', 'Wet-End Starch Cooker', 'Tank/Chest', false, true),

  -- Steam & Condensate (STEAMCOND)
  ((SELECT id FROM plant_sections WHERE section_code='STEAMCOND'), NULL, 'STEAM-DIST-01', 'Dryer Steam Header', 'Other', true, true),

  -- ETP (ETP)
  ((SELECT id FROM plant_sections WHERE section_code='ETP'), NULL, 'ETP-AER-01', 'ETP Aerator 1', 'Aerator', true, true),
  ((SELECT id FROM plant_sections WHERE section_code='ETP'), NULL, 'ETP-PUMP-01', 'ETP Inlet Feed Pump', 'Pump', true, true),

  -- Boiler (BOILER)
  ((SELECT id FROM plant_sections WHERE section_code='BOILER'), NULL, 'BOILER-1', 'Rice Husk Boiler 1', 'Boiler', true, true),
  ((SELECT id FROM plant_sections WHERE section_code='BOILER'), NULL, 'BOILER-FWP', 'Boiler Feed Water Pump', 'Pump', true, true),

  -- Lab (LAB)
  ((SELECT id FROM plant_sections WHERE section_code='LAB'), NULL, 'LAB-RHOM-01', 'Lab Rhometer Tester', 'Sensor', false, true),

  -- Cranes (CRANES)
  ((SELECT id FROM plant_sections WHERE section_code='CRANES'), NULL, 'CRANE-JUMBO', 'EOT Pope Reel Crane', 'Crane', true, true),

  -- Compressors (COMPRESSORS)
  ((SELECT id FROM plant_sections WHERE section_code='COMPRESSORS'), NULL, 'COMP-SCREW-01', 'Screw Compressor A', 'Compressor', true, true),

  -- Store (STORE)
  ((SELECT id FROM plant_sections WHERE section_code='STORE'), NULL, 'STORE-SHELF-01', 'Store Inventory Racking', 'Other', false, true)
ON CONFLICT (tag_name) DO NOTHING;
