-- Migration: Ph17-E Grade & Master Fidelity
-- Adds missing chemical materials, adds standard columns to dpr_grade_standards, and seeds per-grade standards.

-- 1. Insert missing chemical materials (category_id = 3 is Chemicals)
INSERT INTO materials (name, code, category_id, uom, is_active, current_stock, reorder_level)
VALUES 
  ('Deformer', 'CHEM-041', 3, 'kg', true, 1000.0, 100.0),
  ('SE Bond 102', 'CHEM-042', 3, 'kg', true, 1000.0, 100.0),
  ('Sigmaexor ETP', 'CHEM-040', 3, 'kg', true, 1000.0, 100.0)
ON CONFLICT (code) DO NOTHING;

-- 2. Add standard columns to dpr_grade_standards
ALTER TABLE dpr_grade_standards
  ADD COLUMN IF NOT EXISTS se_bond_kg_per_ton NUMERIC(8,3) DEFAULT 0.000,
  ADD COLUMN IF NOT EXISTS sigmaexor_etp_kg_per_ton NUMERIC(8,3) DEFAULT 0.000;

-- 3. Seed per-grade standards for KP, WP, NP, BRD, TIS
INSERT INTO dpr_grade_standards (
  grade_code, starch_kg_per_ton, pac_kg_per_ton, surface_size_kg_per_ton, 
  coagulant_kg_per_ton, deformer_kg_per_ton, retention_kg_per_ton,
  se_bond_kg_per_ton, sigmaexor_etp_kg_per_ton,
  power_unit_per_ton, steam_mt_per_ton, husk_mt_per_ton, yield_pct, is_active
) VALUES
  ('KP', 35.000, 1.800, 0.600, 0.500, 0.400, 0.120, 0.200, 0.150, 240.000, 1.700, 0.300, 92.00, true),
  ('WP', 20.000, 1.200, 0.400, 0.300, 0.250, 0.080, 0.100, 0.100, 220.000, 1.500, 0.250, 90.00, true),
  ('NP', 15.000, 1.000, 0.300, 0.200, 0.200, 0.060, 0.050, 0.080, 200.000, 1.400, 0.220, 89.00, true),
  ('BRD', 40.000, 2.000, 0.800, 0.600, 0.500, 0.150, 0.300, 0.200, 260.000, 1.800, 0.320, 93.00, true),
  ('TIS', 10.000, 0.800, 0.200, 0.150, 0.150, 0.050, 0.020, 0.050, 180.000, 1.300, 0.200, 88.00, true)
ON CONFLICT (grade_code) DO NOTHING;
