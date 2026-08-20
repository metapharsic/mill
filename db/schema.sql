-- MK Paper Mill ERP Database Schema
-- PostgreSQL

-- ============================================================
-- CORE: USERS, ROLES, SESSIONS
-- ============================================================

CREATE TABLE departments (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  code VARCHAR(20) NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT NOW()
);

INSERT INTO departments (name, code) VALUES
  ('Production', 'PROD'),
  ('Raw Material Store', 'RMS'),
  ('Inventory', 'INV'),
  ('Store Management', 'STORE'),
  ('Indent Management', 'INDENT'),
  ('Purchase', 'PUR'),
  ('Quality', 'QC'),
  ('Maintenance', 'MAINT'),
  ('Utility', 'UTIL'),
  ('Dispatch', 'DISP'),
  ('Sales', 'SALES'),
  ('HR & Payroll', 'HR'),
  ('Security', 'SEC'),
  ('Laboratory', 'LAB'),
  ('Finance', 'FIN'),
  ('Administration', 'ADMIN'),
  ('EHS', 'EHS'),
  ('Scrap Management', 'SCRAP'),
  ('Packing', 'PACK'),
  ('Finished Goods Warehouse', 'FGW');

CREATE TABLE roles (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE,
  level INTEGER NOT NULL, -- 1=operator, 2=supervisor, 3=manager, 4=plant_head, 5=admin
  permissions JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW()
);

INSERT INTO roles (name, level, permissions) VALUES
  ('Operator', 1, '{"view": true, "entry": true}'),
  ('Shift Supervisor', 2, '{"view": true, "entry": true, "approve_l1": true}'),
  ('Manager', 3, '{"view": true, "entry": true, "approve_l1": true, "approve_l2": true}'),
  ('Plant Head', 4, '{"view": true, "entry": true, "approve_l1": true, "approve_l2": true, "approve_l3": true}'),
  ('Admin', 5, '{"view": true, "entry": true, "approve_l1": true, "approve_l2": true, "approve_l3": true, "manage_users": true, "manage_system": true}');

CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  employee_code VARCHAR(20) UNIQUE,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(150) UNIQUE,
  mobile VARCHAR(15),
  password_hash VARCHAR(255) NOT NULL,
  role_id INTEGER REFERENCES roles(id),
  department_id INTEGER REFERENCES departments(id),
  shift VARCHAR(10), -- Day / Night / General
  is_active BOOLEAN DEFAULT true,
  last_login TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Default admin
INSERT INTO users (employee_code, name, email, mobile, password_hash, role_id, department_id)
VALUES ('EMP001', 'Admin', 'admin@mkpapermill.com', '9999999999',
  '$2b$10$placeholder', -- replace with bcrypt hash of 'Admin@1234'
  5, 16);

CREATE TABLE sessions (
  id VARCHAR(128) PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL
);

-- ============================================================
-- PRODUCTION MODULE
-- ============================================================

CREATE TABLE machines (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  code VARCHAR(20) UNIQUE,
  type VARCHAR(50), -- Paper Machine, Rewinder, Cutter
  capacity_tpd NUMERIC(10,2), -- tons per day
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE grades (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  code VARCHAR(20) UNIQUE,
  gsm_min NUMERIC(6,2),
  gsm_max NUMERIC(6,2),
  description TEXT,
  is_active BOOLEAN DEFAULT true
);

CREATE TABLE shifts (
  id SERIAL PRIMARY KEY,
  date DATE NOT NULL,
  shift_type VARCHAR(10) NOT NULL CHECK (shift_type IN ('Day', 'Night')),
  start_time TIMESTAMP NOT NULL,
  end_time TIMESTAMP NOT NULL,
  supervisor_id INTEGER REFERENCES users(id),
  machine_id INTEGER REFERENCES machines(id),
  remarks TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE reels (
  id SERIAL PRIMARY KEY,
  reel_number VARCHAR(50) UNIQUE NOT NULL,
  barcode VARCHAR(100) UNIQUE,
  shift_id INTEGER REFERENCES shifts(id),
  machine_id INTEGER REFERENCES machines(id),
  grade_id INTEGER REFERENCES grades(id),
  operator_id INTEGER REFERENCES users(id),
  -- Paper specs
  gsm NUMERIC(6,2),
  width_mm NUMERIC(8,2),
  length_m NUMERIC(10,2),
  weight_kg NUMERIC(10,3),
  moisture_pct NUMERIC(5,2),
  -- Process data
  speed_mpm NUMERIC(8,2), -- meters per minute
  steam_pressure NUMERIC(8,2),
  steam_consumption NUMERIC(10,2),
  water_consumption NUMERIC(10,2),
  -- Time
  start_time TIMESTAMP,
  end_time TIMESTAMP,
  production_time_min INTEGER,
  break_time_min INTEGER DEFAULT 0,
  downtime_min INTEGER DEFAULT 0,
  -- Performance
  efficiency_pct NUMERIC(5,2),
  reject_pct NUMERIC(5,2),
  -- Quality status
  quality_status VARCHAR(20) DEFAULT 'Pending' CHECK (quality_status IN ('Pending', 'Approved', 'Rejected', 'Hold')),
  -- Customer order link
  sales_order_id INTEGER,
  -- Location in FG warehouse
  rack_location VARCHAR(50),
  -- Status
  status VARCHAR(30) DEFAULT 'In Production' CHECK (status IN ('In Production', 'QC Pending', 'QC Done', 'In Warehouse', 'Dispatched', 'Rejected')),
  remarks TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE downtime_entries (
  id SERIAL PRIMARY KEY,
  shift_id INTEGER REFERENCES shifts(id),
  machine_id INTEGER REFERENCES machines(id),
  reel_id INTEGER REFERENCES reels(id),
  start_time TIMESTAMP NOT NULL,
  end_time TIMESTAMP,
  duration_min INTEGER,
  category VARCHAR(50), -- Mechanical, Electrical, Process, Quality, Break, Changeover
  reason TEXT,
  corrective_action TEXT,
  reported_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE production_summary (
  id SERIAL PRIMARY KEY,
  date DATE NOT NULL,
  shift_type VARCHAR(10) NOT NULL,
  machine_id INTEGER REFERENCES machines(id),
  total_reels INTEGER DEFAULT 0,
  total_production_kg NUMERIC(12,3) DEFAULT 0,
  total_reject_kg NUMERIC(12,3) DEFAULT 0,
  net_production_kg NUMERIC(12,3) DEFAULT 0,
  avg_gsm NUMERIC(6,2),
  avg_moisture NUMERIC(5,2),
  avg_speed NUMERIC(8,2),
  avg_efficiency NUMERIC(5,2),
  total_downtime_min INTEGER DEFAULT 0,
  total_steam NUMERIC(12,2) DEFAULT 0,
  total_water NUMERIC(12,2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(date, shift_type, machine_id)
);

-- ============================================================
-- RAW MATERIAL & INVENTORY
-- ============================================================

CREATE TABLE material_categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  code VARCHAR(20) UNIQUE,
  type VARCHAR(30) -- RawMaterial, Chemical, Packing, Spare, Other
);

INSERT INTO material_categories (name, code, type) VALUES
  ('Waste Paper', 'WP', 'RawMaterial'),
  ('Pulp', 'PULP', 'RawMaterial'),
  ('Chemicals', 'CHEM', 'Chemical'),
  ('Starch', 'STARCH', 'Chemical'),
  ('Dyes', 'DYE', 'Chemical'),
  ('Alum', 'ALUM', 'Chemical'),
  ('Rosin', 'ROSIN', 'Chemical'),
  ('Packing Materials', 'PACK', 'Packing'),
  ('Spare Parts', 'SPARE', 'Spare'),
  ('Fuel', 'FUEL', 'RawMaterial'),
  ('Lubricants', 'LUB', 'Chemical');

CREATE TABLE materials (
  id SERIAL PRIMARY KEY,
  code VARCHAR(30) UNIQUE NOT NULL,
  name VARCHAR(150) NOT NULL,
  category_id INTEGER REFERENCES material_categories(id),
  uom VARCHAR(20) NOT NULL, -- KG, MT, LTR, NOS, BAG
  hsn_code VARCHAR(20),
  reorder_level NUMERIC(12,3) DEFAULT 0,
  min_stock NUMERIC(12,3) DEFAULT 0,
  max_stock NUMERIC(12,3) DEFAULT 0,
  current_stock NUMERIC(12,3) DEFAULT 0,
  unit_price NUMERIC(12,2) DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE warehouses (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL,
  code VARCHAR(20) UNIQUE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

INSERT INTO warehouses (name, code) VALUES
  ('Main Store - MK Mill', 'MAIN'),
  ('Spare Parts Store', 'SPARES'),
  ('Chemical Store', 'CHEM'),
  ('Raw Material Bay', 'RAWMAT'),
  ('Paper Machine Area', 'PMAREA');

CREATE TABLE vendors (
  id SERIAL PRIMARY KEY,
  code VARCHAR(20) UNIQUE,
  name VARCHAR(150) NOT NULL,
  gstin VARCHAR(20),
  pan VARCHAR(12),
  address TEXT,
  city VARCHAR(100),
  state VARCHAR(100),
  pincode VARCHAR(10),
  contact_person VARCHAR(100),
  mobile VARCHAR(15),
  email VARCHAR(150),
  payment_terms VARCHAR(50),
  credit_days INTEGER DEFAULT 30,
  rating NUMERIC(3,1) DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE grn (
  id SERIAL PRIMARY KEY,
  grn_number VARCHAR(30) UNIQUE NOT NULL,
  date DATE NOT NULL,
  vendor_id INTEGER REFERENCES vendors(id),
  po_id INTEGER,
  vehicle_number VARCHAR(20),
  challan_number VARCHAR(50),
  invoice_number VARCHAR(50),
  received_by INTEGER REFERENCES users(id),
  status VARCHAR(20) DEFAULT 'Draft' CHECK (status IN ('Draft', 'Received', 'QC Pending', 'QC Done', 'Approved', 'Rejected')),
  remarks TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE grn_items (
  id SERIAL PRIMARY KEY,
  grn_id INTEGER REFERENCES grn(id) ON DELETE CASCADE,
  material_id INTEGER REFERENCES materials(id),
  po_qty NUMERIC(12,3),
  received_qty NUMERIC(12,3),
  accepted_qty NUMERIC(12,3),
  rejected_qty NUMERIC(12,3) DEFAULT 0,
  uom VARCHAR(20),
  unit_price NUMERIC(12,2),
  batch_number VARCHAR(50),
  mfg_date DATE,
  expiry_date DATE,
  bin_location VARCHAR(30),
  remarks TEXT
);

CREATE TABLE stock_ledger (
  id SERIAL PRIMARY KEY,
  material_id INTEGER REFERENCES materials(id),
  date DATE NOT NULL,
  transaction_type VARCHAR(30) NOT NULL, -- GRN, Issue, Return, Transfer, Adjustment, Scrap
  reference_id INTEGER,
  reference_type VARCHAR(30),
  in_qty NUMERIC(12,3) DEFAULT 0,
  out_qty NUMERIC(12,3) DEFAULT 0,
  balance NUMERIC(12,3) NOT NULL,
  unit_price NUMERIC(12,2),
  value NUMERIC(15,2),
  batch_number VARCHAR(50),
  bin_location VARCHAR(30),
  remarks TEXT,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  vendor_id INTEGER REFERENCES vendors(id) -- direct/Fast-Inward vendor link; added by migration_stock_ledger_vendor_id.sql
);

-- ============================================================
-- INDENT & PURCHASE
-- ============================================================

CREATE TABLE indents (
  id SERIAL PRIMARY KEY,
  indent_number VARCHAR(30) UNIQUE NOT NULL,
  date DATE NOT NULL,
  department_id INTEGER REFERENCES departments(id),
  required_date DATE,
  priority VARCHAR(10) DEFAULT 'Normal' CHECK (priority IN ('Low', 'Normal', 'High', 'Urgent')),
  status VARCHAR(20) DEFAULT 'Draft' CHECK (status IN ('Draft', 'Submitted', 'L1 Approved', 'L2 Approved', 'L3 Approved', 'Approved', 'PO Created', 'Issued', 'Closed', 'Rejected', 'Cancelled')),
  raised_by INTEGER REFERENCES users(id),
  l1_approved_by INTEGER REFERENCES users(id),
  l1_approved_at TIMESTAMP,
  l2_approved_by INTEGER REFERENCES users(id),
  l2_approved_at TIMESTAMP,
  l3_approved_by INTEGER REFERENCES users(id),
  l3_approved_at TIMESTAMP,
  remarks TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE indent_items (
  id SERIAL PRIMARY KEY,
  indent_id INTEGER REFERENCES indents(id) ON DELETE CASCADE,
  material_id INTEGER REFERENCES materials(id),
  required_qty NUMERIC(12,3),
  approved_qty NUMERIC(12,3),
  uom VARCHAR(20),
  purpose TEXT,
  current_stock NUMERIC(12,3)
);

CREATE TABLE purchase_orders (
  id SERIAL PRIMARY KEY,
  po_number VARCHAR(30) UNIQUE NOT NULL,
  date DATE NOT NULL,
  vendor_id INTEGER REFERENCES vendors(id),
  indent_id INTEGER,
  delivery_date DATE,
  payment_terms VARCHAR(50),
  status VARCHAR(20) DEFAULT 'Draft' CHECK (status IN ('Draft', 'Approved', 'Sent', 'Partial', 'Received', 'Closed', 'Cancelled')),
  total_value NUMERIC(15,2),
  gst_value NUMERIC(12,2),
  grand_total NUMERIC(15,2),
  approved_by INTEGER REFERENCES users(id),
  created_by INTEGER REFERENCES users(id),
  remarks TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE po_items (
  id SERIAL PRIMARY KEY,
  po_id INTEGER REFERENCES purchase_orders(id) ON DELETE CASCADE,
  material_id INTEGER REFERENCES materials(id),
  qty NUMERIC(12,3),
  received_qty NUMERIC(12,3) DEFAULT 0,
  uom VARCHAR(20),
  unit_price NUMERIC(12,2),
  gst_pct NUMERIC(5,2),
  total NUMERIC(15,2)
);

-- ============================================================
-- QUALITY
-- ============================================================

CREATE TABLE quality_tests (
  id SERIAL PRIMARY KEY,
  test_number VARCHAR(30) UNIQUE NOT NULL,
  test_type VARCHAR(30) NOT NULL, -- Incoming, Process, Final, Customer
  reference_type VARCHAR(30), -- Reel, GRN, Batch
  reference_id INTEGER,
  tested_by INTEGER REFERENCES users(id),
  test_date TIMESTAMP DEFAULT NOW(),
  -- Paper quality parameters
  gsm NUMERIC(6,2),
  moisture_pct NUMERIC(5,2),
  caliper_micron NUMERIC(8,2),
  burst_factor NUMERIC(8,2),
  cobb_value NUMERIC(8,2),
  brightness_pct NUMERIC(5,2),
  thickness_micron NUMERIC(8,2),
  width_mm NUMERIC(8,2),
  weight_kg NUMERIC(10,3),
  tensile_strength NUMERIC(8,2),
  tear_strength NUMERIC(8,2),
  -- Result
  result VARCHAR(20) DEFAULT 'Pending' CHECK (result IN ('Pending', 'Pass', 'Fail', 'Hold')),
  remarks TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- MAINTENANCE
-- ============================================================

CREATE TABLE maintenance_schedule (
  id SERIAL PRIMARY KEY,
  machine_id INTEGER REFERENCES machines(id),
  maintenance_type VARCHAR(30) NOT NULL, -- Preventive, Predictive, Breakdown, Lubrication
  title VARCHAR(200) NOT NULL,
  frequency_days INTEGER,
  last_done DATE,
  next_due DATE,
  estimated_hours NUMERIC(5,2),
  assigned_to INTEGER REFERENCES users(id),
  status VARCHAR(20) DEFAULT 'Scheduled' CHECK (status IN ('Scheduled', 'In Progress', 'Done', 'Overdue', 'Cancelled')),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE maintenance_logs (
  id SERIAL PRIMARY KEY,
  schedule_id INTEGER REFERENCES maintenance_schedule(id),
  machine_id INTEGER REFERENCES machines(id),
  date DATE NOT NULL,
  maintenance_type VARCHAR(30),
  description TEXT,
  work_done TEXT,
  spare_parts_used JSONB DEFAULT '[]',
  start_time TIMESTAMP,
  end_time TIMESTAMP,
  duration_hours NUMERIC(5,2),
  cost NUMERIC(12,2),
  performed_by INTEGER REFERENCES users(id),
  status VARCHAR(20) DEFAULT 'Completed',
  created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- SALES & DISPATCH
-- ============================================================

CREATE TABLE customers (
  id SERIAL PRIMARY KEY,
  code VARCHAR(20) UNIQUE,
  name VARCHAR(150) NOT NULL,
  gstin VARCHAR(20),
  pan VARCHAR(12),
  address TEXT,
  city VARCHAR(100),
  state VARCHAR(100),
  pincode VARCHAR(10),
  contact_person VARCHAR(100),
  mobile VARCHAR(15),
  email VARCHAR(150),
  credit_limit NUMERIC(15,2) DEFAULT 0,
  credit_days INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE sales_orders (
  id SERIAL PRIMARY KEY,
  so_number VARCHAR(30) UNIQUE NOT NULL,
  date DATE NOT NULL,
  customer_id INTEGER REFERENCES customers(id),
  delivery_date DATE,
  grade_id INTEGER REFERENCES grades(id),
  gsm NUMERIC(6,2),
  width_mm NUMERIC(8,2),
  qty_mt NUMERIC(12,3),
  fulfilled_mt NUMERIC(12,3) DEFAULT 0,
  rate_per_kg NUMERIC(10,2),
  total_value NUMERIC(15,2),
  status VARCHAR(20) DEFAULT 'Pending' CHECK (status IN ('Pending', 'In Production', 'Ready', 'Partial', 'Dispatched', 'Cancelled')),
  remarks TEXT,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE dispatch_orders (
  id SERIAL PRIMARY KEY,
  do_number VARCHAR(30) UNIQUE NOT NULL,
  date DATE NOT NULL,
  so_id INTEGER REFERENCES sales_orders(id),
  customer_id INTEGER REFERENCES customers(id),
  vehicle_number VARCHAR(20),
  driver_name VARCHAR(100),
  driver_mobile VARCHAR(15),
  transporter VARCHAR(150),
  lr_number VARCHAR(50),
  eway_bill VARCHAR(30),
  invoice_number VARCHAR(30),
  total_weight_kg NUMERIC(12,3),
  total_reels INTEGER,
  status VARCHAR(20) DEFAULT 'Loading' CHECK (status IN ('Loading', 'Loaded', 'Dispatched', 'Delivered', 'Returned')),
  dispatched_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE dispatch_items (
  id SERIAL PRIMARY KEY,
  dispatch_id INTEGER REFERENCES dispatch_orders(id) ON DELETE CASCADE,
  reel_id INTEGER REFERENCES reels(id),
  weight_kg NUMERIC(10,3)
);

-- ============================================================
-- UTILITY READINGS
-- ============================================================

CREATE TABLE utility_readings (
  id SERIAL PRIMARY KEY,
  date DATE NOT NULL,
  shift_type VARCHAR(10),
  reading_time TIMESTAMP NOT NULL,
  -- Power
  power_units NUMERIC(12,2),
  dg_units NUMERIC(12,2),
  -- Steam / Boiler
  steam_generated_mt NUMERIC(10,3),
  coal_consumed_kg NUMERIC(10,3),
  boiler_pressure NUMERIC(8,2),
  boiler_temp NUMERIC(8,2),
  -- Water
  fresh_water_kl NUMERIC(10,3),
  process_water_kl NUMERIC(10,3),
  -- Compressed Air
  air_pressure NUMERIC(8,2),
  -- ETP
  etp_inlet_kl NUMERIC(10,3),
  etp_outlet_kl NUMERIC(10,3),
  -- Recorded by
  recorded_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- HR
-- ============================================================

CREATE TABLE employees (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  employee_code VARCHAR(20) UNIQUE,
  name VARCHAR(100) NOT NULL,
  department_id INTEGER REFERENCES departments(id),
  designation VARCHAR(100),
  doj DATE,
  dob DATE,
  gender VARCHAR(10),
  mobile VARCHAR(15),
  email VARCHAR(150),
  aadhar VARCHAR(20),
  pan VARCHAR(12),
  pf_number VARCHAR(30),
  esic_number VARCHAR(30),
  bank_account VARCHAR(30),
  bank_name VARCHAR(100),
  ifsc VARCHAR(20),
  basic_salary NUMERIC(12,2),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE attendance (
  id SERIAL PRIMARY KEY,
  employee_id INTEGER REFERENCES employees(id),
  date DATE NOT NULL,
  shift_type VARCHAR(10),
  in_time TIMESTAMP,
  out_time TIMESTAMP,
  hours_worked NUMERIC(5,2),
  status VARCHAR(20) DEFAULT 'Present' CHECK (status IN ('Present', 'Absent', 'Half Day', 'Leave', 'Holiday', 'OT')),
  remarks TEXT,
  UNIQUE(employee_id, date)
);

-- ============================================================
-- AUDIT LOG
-- ============================================================

CREATE TABLE audit_log (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  action VARCHAR(50) NOT NULL,
  module VARCHAR(50),
  record_id INTEGER,
  old_data JSONB,
  new_data JSONB,
  ip_address VARCHAR(45),
  created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX idx_reels_shift ON reels(shift_id);
CREATE INDEX idx_reels_machine ON reels(machine_id);
CREATE INDEX idx_reels_date ON reels(start_time);
CREATE INDEX idx_reels_status ON reels(status);
CREATE INDEX idx_stock_ledger_material ON stock_ledger(material_id);
CREATE INDEX idx_stock_ledger_date ON stock_ledger(date);
CREATE INDEX idx_audit_log_user ON audit_log(user_id);
CREATE INDEX idx_audit_log_module ON audit_log(module, created_at);
CREATE INDEX idx_attendance_date ON attendance(date);
CREATE INDEX idx_utility_date ON utility_readings(date);

CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  title VARCHAR(200) NOT NULL,
  message TEXT NOT NULL,
  link VARCHAR(255),
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS eod_reports (
  id SERIAL PRIMARY KEY,
  report_date DATE NOT NULL,
  summary_json JSONB NOT NULL,
  status VARCHAR(50) DEFAULT 'Sent',
  sent_by INTEGER REFERENCES users(id),
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  recipients TEXT,
  notes TEXT
);


