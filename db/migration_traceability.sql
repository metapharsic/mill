-- Migration: Enhanced Store & Asset Traceability Schema
-- Creates machine_positions, installed_assets, asset_events, and indent_comments

CREATE TABLE IF NOT EXISTS machine_positions (
  id SERIAL PRIMARY KEY,
  machine_id INTEGER REFERENCES machines(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  code VARCHAR(50) UNIQUE NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS installed_assets (
  id SERIAL PRIMARY KEY,
  asset_number VARCHAR(30) UNIQUE,
  material_id INTEGER REFERENCES materials(id) ON DELETE RESTRICT,
  serial_number VARCHAR(100),
  batch_number VARCHAR(100),
  machine_id INTEGER REFERENCES machines(id) ON DELETE RESTRICT,
  position_id INTEGER REFERENCES machine_positions(id) ON DELETE RESTRICT,
  indent_id INTEGER, -- links to store_issues.id
  grn_item_id INTEGER,
  requested_by INTEGER REFERENCES users(id),
  approved_by INTEGER REFERENCES users(id),
  issued_by INTEGER REFERENCES users(id),
  purchase_price NUMERIC(12,2) DEFAULT 0.00,
  installed_at TIMESTAMP DEFAULT NOW(),
  status VARCHAR(20) DEFAULT 'In Service', -- In Service | Failed | Removed | Scrapped | Returned
  retired_at TIMESTAMP,
  failure_reason TEXT,
  expected_lifespan_days INTEGER DEFAULT 365
);

CREATE TABLE IF NOT EXISTS asset_events (
  id SERIAL PRIMARY KEY,
  asset_id INTEGER REFERENCES installed_assets(id) ON DELETE CASCADE,
  event_type VARCHAR(30) NOT NULL, -- Installed | Failed | Removed | Scrapped | Repaired
  event_date TIMESTAMP DEFAULT NOW(),
  recorded_by INTEGER REFERENCES users(id),
  remarks TEXT
);

CREATE TABLE IF NOT EXISTS indent_comments (
  id SERIAL PRIMARY KEY,
  issue_id INTEGER REFERENCES store_issues(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Extend store_issues table with tracking columns
ALTER TABLE store_issues 
  ADD COLUMN IF NOT EXISTS indent_type VARCHAR(30) DEFAULT 'Consumable',
  ADD COLUMN IF NOT EXISTS machine_id INTEGER REFERENCES machines(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS position_id INTEGER REFERENCES machine_positions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS justification TEXT,
  ADD COLUMN IF NOT EXISTS estimated_value NUMERIC(12,2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS required_by_date DATE DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS issue_option VARCHAR(20) DEFAULT 'full',
  ADD COLUMN IF NOT EXISTS substitute_material_id INTEGER REFERENCES materials(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS serial_number VARCHAR(100),
  ADD COLUMN IF NOT EXISTS batch_number VARCHAR(100),
  ADD COLUMN IF NOT EXISTS acknowledged_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS acknowledged_by INTEGER REFERENCES users(id);

-- Extend materials table
ALTER TABLE materials
  ADD COLUMN IF NOT EXISTS is_serialized BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS expected_lifespan_days INTEGER DEFAULT 365;

-- Seed default machine positions for testing
INSERT INTO machine_positions (machine_id, name, code)
SELECT m.id, 'Dryer Section 5 / Drive End Bearing', 'PM-DRY5-DEBRG'
FROM machines m LIMIT 1
ON CONFLICT (code) DO NOTHING;

INSERT INTO machine_positions (machine_id, name, code)
SELECT m.id, 'Press Section 2 / Top Roll', 'PM-PRSS2-TPROLL'
FROM machines m LIMIT 1
ON CONFLICT (code) DO NOTHING;
