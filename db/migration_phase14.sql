-- Phase 14 Migration: Store, Scrap, Packing, Security, Lab, EHS, Admin
-- Run: psql -U postgres -d mk_paper_mill -f db/migration_phase14.sql

CREATE TABLE IF NOT EXISTS store_issues (
  id SERIAL PRIMARY KEY,
  issue_number VARCHAR(30) UNIQUE,
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  material_id INTEGER REFERENCES materials(id),
  department_id INTEGER REFERENCES departments(id),
  quantity NUMERIC(12,3) NOT NULL,
  unit VARCHAR(20),
  purpose TEXT,
  issued_by INTEGER REFERENCES users(id),
  approved_by INTEGER REFERENCES users(id),
  status VARCHAR(20) DEFAULT 'Pending',
  remarks TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS scrap_records (
  id SERIAL PRIMARY KEY,
  scrap_number VARCHAR(30) UNIQUE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  scrap_type VARCHAR(50),
  source_department_id INTEGER REFERENCES departments(id),
  quantity_kg NUMERIC(12,3) NOT NULL,
  description TEXT,
  disposal_method VARCHAR(50),
  buyer_name VARCHAR(100),
  sale_amount NUMERIC(12,2) DEFAULT 0,
  recorded_by INTEGER REFERENCES users(id),
  status VARCHAR(20) DEFAULT 'Pending',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS packing_records (
  id SERIAL PRIMARY KEY,
  pack_number VARCHAR(30) UNIQUE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  reel_id INTEGER REFERENCES reels(id),
  packing_type VARCHAR(50),
  wrap_material VARCHAR(50),
  net_weight_kg NUMERIC(10,3),
  gross_weight_kg NUMERIC(10,3),
  label_printed BOOLEAN DEFAULT false,
  packed_by INTEGER REFERENCES users(id),
  remarks TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS gate_passes (
  id SERIAL PRIMARY KEY,
  gp_number VARCHAR(30) UNIQUE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  pass_type VARCHAR(20) NOT NULL,
  vehicle_type VARCHAR(30),
  vehicle_number VARCHAR(20),
  driver_name VARCHAR(100),
  purpose VARCHAR(100),
  material_description TEXT,
  from_party VARCHAR(100),
  to_party VARCHAR(100),
  in_time TIMESTAMP,
  out_time TIMESTAMP,
  weight_in NUMERIC(10,3),
  weight_out NUMERIC(10,3),
  net_weight NUMERIC(10,3),
  security_guard_id INTEGER REFERENCES users(id),
  status VARCHAR(20) DEFAULT 'Open',
  remarks TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS lab_samples (
  id SERIAL PRIMARY KEY,
  sample_number VARCHAR(30) UNIQUE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  sample_type VARCHAR(50),
  source_ref VARCHAR(100),
  collected_by INTEGER REFERENCES users(id),
  tested_by INTEGER REFERENCES users(id),
  brightness NUMERIC(6,2),
  opacity NUMERIC(6,2),
  ph_value NUMERIC(5,2),
  ash_content NUMERIC(6,2),
  moisture NUMERIC(6,2),
  cod NUMERIC(10,3),
  bod NUMERIC(10,3),
  tss NUMERIC(10,3),
  ph_water NUMERIC(5,2),
  concentration NUMERIC(10,3),
  purity NUMERIC(6,2),
  result VARCHAR(20) DEFAULT 'Pending',
  remarks TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ehs_incidents (
  id SERIAL PRIMARY KEY,
  incident_number VARCHAR(30) UNIQUE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  incident_time TIME,
  incident_type VARCHAR(50),
  severity VARCHAR(20),
  location VARCHAR(100),
  department_id INTEGER REFERENCES departments(id),
  description TEXT NOT NULL,
  injured_person VARCHAR(100),
  root_cause TEXT,
  corrective_action TEXT,
  reported_by INTEGER REFERENCES users(id),
  status VARCHAR(20) DEFAULT 'Open',
  closure_date DATE,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS system_settings (
  id SERIAL PRIMARY KEY,
  key VARCHAR(100) UNIQUE NOT NULL,
  value TEXT,
  category VARCHAR(50),
  label VARCHAR(100),
  updated_by INTEGER REFERENCES users(id),
  updated_at TIMESTAMP DEFAULT NOW()
);

INSERT INTO system_settings (key, value, category, label) VALUES
  ('company_name', 'MK Paper Mill', 'Company', 'Company Name'),
  ('company_address', '', 'Company', 'Address'),
  ('company_phone', '', 'Company', 'Phone'),
  ('company_email', '', 'Company', 'Email'),
  ('company_gst', '', 'Company', 'GST Number'),
  ('company_pan', '', 'Company', 'PAN'),
  ('financial_year_start', '04', 'System', 'Financial Year Start Month'),
  ('low_stock_alert_days', '7', 'System', 'Low Stock Alert Days'),
  ('sequence_prefix_indent', 'IND', 'System', 'Indent Prefix'),
  ('sequence_prefix_po', 'PO', 'System', 'PO Prefix'),
  ('sequence_prefix_so', 'SO', 'System', 'SO Prefix'),
  ('sequence_prefix_do', 'DO', 'System', 'DO Prefix')
ON CONFLICT (key) DO NOTHING;
