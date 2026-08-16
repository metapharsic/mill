-- M8: Migration for remaining Paper Forms (F1 to F6)
-- F5: Plant sections
CREATE TABLE IF NOT EXISTS sections (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(100) NOT NULL UNIQUE,
  code          VARCHAR(20) UNIQUE,
  department_id INTEGER REFERENCES departments(id),
  is_active     BOOLEAN DEFAULT true,
  created_at    TIMESTAMP DEFAULT NOW()
);

-- F1/F2: Equipment (Motors/Rolls/Pumps with HP/Amps)
CREATE TABLE IF NOT EXISTS equipment (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(100) NOT NULL,
  code          VARCHAR(50) UNIQUE NOT NULL,
  type          VARCHAR(50) NOT NULL, -- Motor, Roll, Pump, etc.
  section_id    INTEGER REFERENCES sections(id),
  hp            NUMERIC(8,2),
  amps          NUMERIC(8,2),
  is_active     BOOLEAN DEFAULT true,
  created_at    TIMESTAMP DEFAULT NOW()
);

-- F1: Equipment Inspection Log
CREATE TABLE IF NOT EXISTS equipment_inspection (
  id              SERIAL PRIMARY KEY,
  equipment_id    INTEGER REFERENCES equipment(id) ON DELETE CASCADE,
  inspector_id    INTEGER REFERENCES users(id),
  status          VARCHAR(30) DEFAULT 'Normal' CHECK (status IN ('Normal', 'Needs Attention', 'Critical')),
  check_date      DATE NOT NULL DEFAULT CURRENT_DATE,
  next_check_date DATE,
  remarks         TEXT,
  created_at      TIMESTAMP DEFAULT NOW()
);

-- F3: Daily Shift Report (Machine/Pulp/ETP shifts log)
CREATE TABLE IF NOT EXISTS shift_reports (
  id            SERIAL PRIMARY KEY,
  date          DATE NOT NULL,
  shift_type    VARCHAR(10) NOT NULL CHECK (shift_type IN ('Day', 'Night')),
  section       VARCHAR(50) NOT NULL, -- Machine Room, Pulp Mill, ETP
  operator_id   INTEGER REFERENCES users(id),
  data          JSONB NOT NULL DEFAULT '{}'::jsonb, -- dynamic log fields
  remarks       TEXT,
  created_at    TIMESTAMP DEFAULT NOW(),
  UNIQUE(date, shift_type, section)
);

-- F4: Daily Chemical Consumption & Costing
CREATE TABLE IF NOT EXISTS chemical_consumption (
  id            SERIAL PRIMARY KEY,
  date          DATE NOT NULL,
  shift_type    VARCHAR(10) NOT NULL,
  chemical_id   INTEGER REFERENCES materials(id), -- assumes materials stores chemicals
  qty_consumed  NUMERIC(12,3) NOT NULL DEFAULT 0,
  unit_cost     NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_cost    NUMERIC(14,2) NOT NULL DEFAULT 0,
  recorded_by   INTEGER REFERENCES users(id),
  created_at    TIMESTAMP DEFAULT NOW()
);

-- F6: ETP readings
CREATE TABLE IF NOT EXISTS etp_readings (
  id            SERIAL PRIMARY KEY,
  date          DATE NOT NULL DEFAULT CURRENT_DATE,
  reading_time  TIME NOT NULL,
  ph            NUMERIC(4,2),
  cod           NUMERIC(8,2), -- mg/L
  bod           NUMERIC(8,2), -- mg/L
  tss           NUMERIC(8,2), -- mg/L
  tds           NUMERIC(8,2), -- mg/L
  flow_rate     NUMERIC(8,2), -- m3/hr
  logged_by     INTEGER REFERENCES users(id),
  remarks       TEXT,
  created_at    TIMESTAMP DEFAULT NOW()
);

-- Seed plant sections using exact ID mapped from DB
INSERT INTO sections (name, code, department_id) VALUES
  ('Paper Machine Wire Part', 'WIRE', (SELECT id FROM departments WHERE code='PROD')),
  ('Paper Machine Press Part', 'PRESS', (SELECT id FROM departments WHERE code='PROD')),
  ('Paper Machine Dryer Part', 'DRYER', (SELECT id FROM departments WHERE code='PROD')),
  ('Pulp Mill Digester', 'DIGEST', (SELECT id FROM departments WHERE code='PROD')),
  ('ETP Aeration Tank', 'ETP_AER', (SELECT id FROM departments WHERE code='EHS'))
ON CONFLICT (name) DO NOTHING;

