-- migrate_holidays_loans.sql
-- Run: psql -U postgres -d mk_paper_mill -f db/migrate_holidays_loans.sql

-- ── HOLIDAYS ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS holidays (
  id           SERIAL PRIMARY KEY,
  holiday_date DATE         NOT NULL,
  name         VARCHAR(100) NOT NULL,
  holiday_type VARCHAR(20)  NOT NULL DEFAULT 'National', -- National / State / Optional / Restricted
  year         INTEGER      NOT NULL,
  is_active    BOOLEAN      DEFAULT true,
  created_at   TIMESTAMPTZ  DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_holidays_date ON holidays(holiday_date);

-- Seed FY 2025-26 national holidays (India)
INSERT INTO holidays(holiday_date, name, holiday_type, year) VALUES
  ('2025-01-26','Republic Day','National',2025),
  ('2025-03-14','Holi','National',2025),
  ('2025-04-14','Dr Ambedkar Jayanti','National',2025),
  ('2025-04-18','Good Friday','National',2025),
  ('2025-05-01','Maharashtra Day','State',2025),
  ('2025-08-15','Independence Day','National',2025),
  ('2025-10-02','Gandhi Jayanti','National',2025),
  ('2025-10-02','Dussehra','National',2025),
  ('2025-10-20','Diwali','National',2025),
  ('2025-11-05','Guru Nanak Jayanti','National',2025),
  ('2025-12-25','Christmas','National',2025),
  ('2026-01-26','Republic Day','National',2026),
  ('2026-03-03','Holi','National',2026),
  ('2026-04-03','Good Friday','National',2026),
  ('2026-04-14','Dr Ambedkar Jayanti','National',2026),
  ('2026-05-01','Maharashtra Day','State',2026),
  ('2026-08-15','Independence Day','National',2026),
  ('2026-10-02','Gandhi Jayanti','National',2026),
  ('2026-11-10','Diwali','National',2026),
  ('2026-12-25','Christmas','National',2026)
ON CONFLICT DO NOTHING;

-- ── EMPLOYEE LOANS & ADVANCES ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS employee_loans (
  id             SERIAL PRIMARY KEY,
  employee_id    INTEGER       NOT NULL REFERENCES employees(id),
  loan_type      VARCHAR(20)   NOT NULL DEFAULT 'advance', -- loan / advance
  amount         NUMERIC(12,2) NOT NULL,
  disbursed_date DATE          NOT NULL,
  monthly_emi    NUMERIC(10,2) NOT NULL DEFAULT 0,
  outstanding    NUMERIC(12,2) NOT NULL,
  status         VARCHAR(20)   NOT NULL DEFAULT 'active', -- active / closed
  notes          TEXT,
  approved_by    INTEGER REFERENCES users(id),
  created_at     TIMESTAMPTZ   DEFAULT now()
);

-- ── SCHEMA MIGRATION TRACKING ─────────────────────────────────────────────────
-- migrate.js records this file in schema_migrations(filename) itself.
-- (Removed an INSERT INTO schema_migrations(version,description) that did not
--  match the (filename,applied_at) schema migrate.js uses — it failed the file.)
