-- ============================================================
-- Ph16 HRMS — employees table column expansion (doc 23 §4.1, cursorrules §29)
-- Was omitted from migration_hrms_ph16.sql. All ADD COLUMN IF NOT EXISTS — safe to re-run.
-- Tracking handled by migrate.js (schema_migrations.filename).
-- ============================================================

ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS middle_name         VARCHAR(50),
  ADD COLUMN IF NOT EXISTS father_name         VARCHAR(100),
  ADD COLUMN IF NOT EXISTS blood_group         VARCHAR(5),
  ADD COLUMN IF NOT EXISTS nationality         VARCHAR(30) DEFAULT 'Indian',
  ADD COLUMN IF NOT EXISTS marital_status      VARCHAR(20),
  ADD COLUMN IF NOT EXISTS permanent_address   TEXT,
  ADD COLUMN IF NOT EXISTS current_address     TEXT,
  ADD COLUMN IF NOT EXISTS emergency_contact   VARCHAR(100),
  ADD COLUMN IF NOT EXISTS emergency_mobile    VARCHAR(15),
  ADD COLUMN IF NOT EXISTS photo_url           VARCHAR(255),
  ADD COLUMN IF NOT EXISTS employment_type     VARCHAR(30) DEFAULT 'Permanent',
  -- Permanent | Probation | Contract | Trainee | Apprentice | Daily Wage | Consultant
  ADD COLUMN IF NOT EXISTS grade               VARCHAR(20),
  ADD COLUMN IF NOT EXISTS reporting_to        INTEGER REFERENCES employees(id),
  ADD COLUMN IF NOT EXISTS shift_pattern       VARCHAR(20) DEFAULT 'General',
  -- General | 3Shift | 12Hour
  ADD COLUMN IF NOT EXISTS confirmation_date   DATE,
  ADD COLUMN IF NOT EXISTS probation_end       DATE,
  ADD COLUMN IF NOT EXISTS date_of_leaving     DATE,
  ADD COLUMN IF NOT EXISTS separation_type     VARCHAR(30),
  -- Resignation | Termination | Retirement | Contract End | Death | VRS
  ADD COLUMN IF NOT EXISTS uan_number          VARCHAR(20),
  ADD COLUMN IF NOT EXISTS gratuity_nomination TEXT,
  ADD COLUMN IF NOT EXISTS is_dept_head        BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS cost_center         VARCHAR(30),
  ADD COLUMN IF NOT EXISTS updated_at          TIMESTAMP DEFAULT NOW();

-- Backfill is_dept_head from existing L3+ logins linked to an employee record
UPDATE employees e
SET is_dept_head = true
FROM users u
JOIN roles r ON r.id = u.role_id
WHERE e.user_id = u.id
  AND r.level >= 3
  AND e.is_dept_head = false;
