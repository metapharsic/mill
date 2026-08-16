-- M12: CMMS Spares — extend materials table with all 15 Excel columns
-- Run: psql -U postgres -d mk_paper_mill -f db/migration_cmms_spares.sql

-- 1. Add CMMS-specific columns to materials table
ALTER TABLE materials
  ADD COLUMN IF NOT EXISTS section_context        VARCHAR(120),
  ADD COLUMN IF NOT EXISTS criticality_class       VARCHAR(5)   CHECK (criticality_class IN ('A','B','C')),
  ADD COLUMN IF NOT EXISTS procurement_strategy    VARCHAR(200),
  ADD COLUMN IF NOT EXISTS oem_supplier            VARCHAR(250),
  ADD COLUMN IF NOT EXISTS last_audit_cycle        VARCHAR(80),
  ADD COLUMN IF NOT EXISTS calibration_protocol    VARCHAR(300),
  ADD COLUMN IF NOT EXISTS reorder_buffer          NUMERIC(10,2) DEFAULT 0;

-- 2. Seed 8 CMMS component-group categories
INSERT INTO material_categories (name, code, type) VALUES
  ('Major Rotating Assemblies',    'CAT-ROT',   'Spare'),
  ('Mechanical Consumables',       'CAT-MCH',   'Spare'),
  ('Wear Items / Components',      'CAT-WEAR',  'Spare'),
  ('Instrumentation & Sensors',    'CAT-INST',  'Spare'),
  ('Valves & Flow Controls',       'CAT-VALV',  'Spare'),
  ('Seals & Fluid Boundaries',     'CAT-SEAL',  'Spare'),
  ('Fasteners & Structural Hardware','CAT-FAST', 'Spare'),
  ('Drives & Transmission Elements','CAT-DRV',  'Spare')
ON CONFLICT (code) DO NOTHING;
