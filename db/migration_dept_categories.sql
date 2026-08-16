-- M4: Department categories + must_change_password + approval thresholds
-- Run via: node scripts/migrate.js

ALTER TABLE departments ADD COLUMN IF NOT EXISTS category VARCHAR(40);

UPDATE departments SET category='Production & Operations' WHERE code IN ('PROD','UTIL','MAINT');
UPDATE departments SET category='Materials & Stores'      WHERE code IN ('RMS','INV','STORE','INDENT','PACK','FGW');
UPDATE departments SET category='Quality & Lab'           WHERE code IN ('QC','LAB');
UPDATE departments SET category='Supply Chain'            WHERE code IN ('PUR','SALES','DISP');
UPDATE departments SET category='Commercial & Admin'      WHERE code IN ('FIN','HR','ADMIN');
UPDATE departments SET category='Safety & Compliance'     WHERE code IN ('EHS','SEC','SCRAP');

ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT false;

INSERT INTO system_settings (key, value, category, label) VALUES
  ('approval_threshold_value', '50000', 'Approvals', 'High Value Threshold (INR) — needs Plant Head'),
  ('approval_threshold_qty',   '1000',  'Approvals', 'High Qty Threshold (units) — needs Plant Head')
ON CONFLICT (key) DO NOTHING;
