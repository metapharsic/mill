-- Migration: 8 Critical Pre-Go-Live Fixes
-- Creates payments and payrolls tables

CREATE TABLE IF NOT EXISTS payments (
  id SERIAL PRIMARY KEY,
  payment_number VARCHAR(30) UNIQUE,
  sales_order_id INTEGER REFERENCES sales_orders(id) ON DELETE RESTRICT,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_mode VARCHAR(30) NOT NULL, -- Cash | Bank | Cheque | Other
  reference_number VARCHAR(100),
  recorded_by INTEGER REFERENCES users(id),
  remarks TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payrolls (
  id SERIAL PRIMARY KEY,
  employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,
  month VARCHAR(7) NOT NULL, -- YYYY-MM
  present_days INTEGER DEFAULT 0,
  basic_salary NUMERIC(12,2) NOT NULL,
  allowances NUMERIC(12,2) DEFAULT 0.00,
  deductions NUMERIC(12,2) DEFAULT 0.00,
  net_salary NUMERIC(12,2) NOT NULL,
  status VARCHAR(20) DEFAULT 'Draft', -- Draft | Paid
  paid_date DATE,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(employee_id, month)
);
