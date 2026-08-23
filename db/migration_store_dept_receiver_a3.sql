BEGIN;

-- ============================================================================
-- 1. SEED & EXPAND DEPARTMENTS (Covering all 11+ mill departments from Pic 2)
-- Production, Mech, Elec, Lab, Boiler, Rewinder, Admin, Stores, Housekeeping, Other
-- ============================================================================
INSERT INTO departments (name, code) VALUES
  ('Production', 'PROD'),
  ('Mechanical', 'MECH'),
  ('Electrical', 'ELEC'),
  ('Laboratory', 'LAB'),
  ('Boiler & Utilities', 'BOILER'),
  ('Rewinder & Finishing', 'REWINDER'),
  ('Administration', 'ADMIN'),
  ('Store Management', 'STORE'),
  ('Housekeeping', 'HK'),
  ('EHS & Safety', 'EHS'),
  ('Quality Control', 'QC'),
  ('Raw Material Store', 'RMS'),
  ('Inventory', 'INV'),
  ('Indent Management', 'INDENT'),
  ('Purchase', 'PUR'),
  ('Maintenance', 'MAINT'),
  ('Utility', 'UTIL'),
  ('Dispatch', 'DISP'),
  ('Sales', 'SALES'),
  ('HR & Payroll', 'HR'),
  ('Security', 'SEC'),
  ('Finance', 'FIN'),
  ('Scrap Management', 'SCRAP'),
  ('Packing', 'PACK'),
  ('Finished Goods Warehouse', 'FGW'),
  ('Other / General Mill', 'OTHER')
ON CONFLICT (code) DO UPDATE 
SET name = EXCLUDED.name;

-- Ensure category column on departments exists
ALTER TABLE departments ADD COLUMN IF NOT EXISTS category VARCHAR(50);
UPDATE departments SET category = 'Production & Operations' WHERE code IN ('PROD', 'BOILER', 'REWINDER', 'UTIL', 'MAINT');
UPDATE departments SET category = 'Technical & Maintenance' WHERE code IN ('MECH', 'ELEC');
UPDATE departments SET category = 'Materials & Stores' WHERE code IN ('STORE', 'RMS', 'INV', 'INDENT', 'PACK', 'FGW');
UPDATE departments SET category = 'Quality & Lab' WHERE code IN ('QC', 'LAB');
UPDATE departments SET category = 'Commercial & Admin' WHERE code IN ('FIN', 'HR', 'ADMIN', 'PUR', 'SALES', 'DISP');
UPDATE departments SET category = 'Safety, Facility & General' WHERE code IN ('EHS', 'SEC', 'SCRAP', 'HK', 'OTHER');

-- ============================================================================
-- 2. ENHANCE INDENTS & INDENT_ITEMS WITH RECEIVER SIGNATURE & SIV TRACKING
-- ============================================================================
ALTER TABLE indents
  ADD COLUMN IF NOT EXISTS receiver_name VARCHAR(150),
  ADD COLUMN IF NOT EXISTS receiver_emp_code VARCHAR(50),
  ADD COLUMN IF NOT EXISTS receiver_signature_note TEXT,
  ADD COLUMN IF NOT EXISTS receiver_signed_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS receiver_signed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS fitment_date DATE,
  ADD COLUMN IF NOT EXISTS fitment_location VARCHAR(150),
  ADD COLUMN IF NOT EXISTS observations TEXT,
  ADD COLUMN IF NOT EXISTS sm_approved_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS sm_approved_at TIMESTAMP;

ALTER TABLE indent_items
  ADD COLUMN IF NOT EXISTS receiver_name VARCHAR(150),
  ADD COLUMN IF NOT EXISTS receiver_emp_code VARCHAR(50),
  ADD COLUMN IF NOT EXISTS receiver_signed_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS fitment_date DATE,
  ADD COLUMN IF NOT EXISTS observations TEXT,
  ADD COLUMN IF NOT EXISTS photo_url TEXT;

-- ============================================================================
-- 3. ENHANCE STORE_ISSUES WITH RECEIVER SIGNATURE & ACKNOWLEDGEMENT
-- ============================================================================
CREATE TABLE IF NOT EXISTS store_issues (
  id SERIAL PRIMARY KEY,
  issue_number VARCHAR(50) UNIQUE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  material_id INTEGER REFERENCES materials(id) ON DELETE RESTRICT,
  department_id INTEGER REFERENCES departments(id) ON DELETE RESTRICT,
  quantity NUMERIC(12,3) NOT NULL,
  unit_price NUMERIC(12,2) DEFAULT 0,
  total_value NUMERIC(15,2) DEFAULT 0,
  purpose TEXT,
  remarks TEXT,
  status VARCHAR(30) DEFAULT 'Issued',
  issued_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  receiver_name VARCHAR(150),
  receiver_emp_code VARCHAR(50),
  receiver_signature_note TEXT,
  receiver_signed_at TIMESTAMP,
  receiver_signed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE store_issues
  ADD COLUMN IF NOT EXISTS receiver_name VARCHAR(150),
  ADD COLUMN IF NOT EXISTS receiver_emp_code VARCHAR(50),
  ADD COLUMN IF NOT EXISTS receiver_signature_note TEXT,
  ADD COLUMN IF NOT EXISTS receiver_signed_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS receiver_signed_by INTEGER REFERENCES users(id) ON DELETE SET NULL;

-- ============================================================================
-- 4. ENHANCE GRN & GRN_ITEMS WITH FULL A3 GST INVOICE COMMERCIAL FIELDS
-- ============================================================================
ALTER TABLE grn
  ADD COLUMN IF NOT EXISTS cases_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS eway_bill_no VARCHAR(50),
  ADD COLUMN IF NOT EXISTS transport_name VARCHAR(150),
  ADD COLUMN IF NOT EXISTS vehicle_weight VARCHAR(50),
  ADD COLUMN IF NOT EXISTS due_date DATE,
  ADD COLUMN IF NOT EXISTS order_number VARCHAR(50),
  ADD COLUMN IF NOT EXISTS order_date DATE,
  ADD COLUMN IF NOT EXISTS prepared_by VARCHAR(100),
  ADD COLUMN IF NOT EXISTS checked_by VARCHAR(100),
  ADD COLUMN IF NOT EXISTS payment_mode VARCHAR(50) DEFAULT 'Credit',
  ADD COLUMN IF NOT EXISTS total_taxable NUMERIC(15,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_gst NUMERIC(15,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS grand_total NUMERIC(15,2) DEFAULT 0;

ALTER TABLE grn_items
  ADD COLUMN IF NOT EXISTS discount_pct NUMERIC(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS other_charges NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS taxable_amount NUMERIC(15,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS gst_pct NUMERIC(5,2) DEFAULT 18,
  ADD COLUMN IF NOT EXISTS tax_type VARCHAR(20) DEFAULT 'intra',
  ADD COLUMN IF NOT EXISTS cgst_pct NUMERIC(5,2) DEFAULT 9,
  ADD COLUMN IF NOT EXISTS sgst_pct NUMERIC(5,2) DEFAULT 9,
  ADD COLUMN IF NOT EXISTS igst_pct NUMERIC(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cgst_amount NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sgst_amount NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS igst_amount NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_amount NUMERIC(15,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS old_mrp NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS mrp NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS trade_price NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pack_size VARCHAR(50),
  ADD COLUMN IF NOT EXISTS dis_qty NUMERIC(12,3) DEFAULT 0;

COMMIT;
