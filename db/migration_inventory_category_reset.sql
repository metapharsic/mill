-- Full inventory wipe + category rebuild. User-confirmed destructive op, backup taken first
-- (db/backups/pre_inventory_wipe_*.dump). Old 19 categories replaced with 11 new ones.
BEGIN;

TRUNCATE materials CASCADE;
TRUNCATE material_categories CASCADE;

INSERT INTO material_categories (name, code, type) VALUES
  ('Chemical', 'CHEM', 'Raw Material'),
  ('Clothing', 'CLOTH', 'Consumable'),
  ('Electrical', 'ELEC', 'Spare Part'),
  ('Mechanical', 'MECH', 'Spare Part'),
  ('Spare Parts', 'SPARE', 'Spare Part'),
  ('Stationary', 'STAT', 'Consumable'),
  ('Packing', 'PACK', 'Consumable'),
  ('General', 'GEN', 'Consumable'),
  ('Hydraulic & Pneumatic', 'HYDPNEU', 'Spare Part'),
  ('Drive & Motors', 'DRIVE', 'Spare Part'),
  ('Capital Goods', 'CAPEX', 'Asset');

INSERT INTO schema_migrations (filename) VALUES ('migration_inventory_category_reset.sql')
ON CONFLICT (filename) DO NOTHING;

COMMIT;
