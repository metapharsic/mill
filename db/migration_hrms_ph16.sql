-- ============================================================
-- Ph16 HRMS Migration — MK Paper Mill
-- Run as: psql -U postgres -d mk_paper_mill -f db/migration_hrms_ph16.sql
-- Safe to re-run: all CREATE TABLE statements utilize IF NOT EXISTS
-- ============================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────
-- 1. LEAVE TYPES MASTER
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS employee_leave_types (
  id              SERIAL PRIMARY KEY,
  code            VARCHAR(10)  NOT NULL UNIQUE,
  name            VARCHAR(100) NOT NULL,
  annual_quota    NUMERIC(5,2),            -- NULL = unlimited / as-earned
  carry_forward   BOOLEAN      DEFAULT false,
  max_carry_days  INTEGER      DEFAULT 0,
  encashable      BOOLEAN      DEFAULT false,
  paid            BOOLEAN      DEFAULT true,
  gender_restrict VARCHAR(10)  DEFAULT NULL, -- 'Female' for Maternity
  min_service_days INTEGER     DEFAULT 0,
  description     TEXT,
  is_active       BOOLEAN      DEFAULT true,
  created_at      TIMESTAMPTZ  DEFAULT now()
);

-- seed standard leave types
INSERT INTO employee_leave_types (code, name, annual_quota, carry_forward, max_carry_days, encashable, paid, gender_restrict, min_service_days)
VALUES
  ('CL',  'Casual Leave',     12,  false, 0,  false, true,  NULL,     0),
  ('SL',  'Sick Leave',       12,  false, 0,  false, true,  NULL,     0),
  ('EL',  'Earned Leave',     21,  true,  45, true,  true,  NULL,     240),
  ('CO',  'Comp Off',         NULL,false, 0,  false, true,  NULL,     0),
  ('ML',  'Maternity Leave',  182, false, 0,  false, true,  'Female', 80),
  ('PL',  'Paternity Leave',  15,  false, 0,  false, true,  'Male',   0),
  ('LOP', 'Loss of Pay',      NULL,false, 0,  false, false, NULL,     0),
  ('HL',  'Holiday',          NULL,false, 0,  false, true,  NULL,     0)
ON CONFLICT (code) DO NOTHING;

-- ─────────────────────────────────────────────────────────────
-- 2. LEAVE BALANCES LEDGER (per employee per year)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS employee_leave_balances (
  id                SERIAL PRIMARY KEY,
  employee_id       INTEGER      NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  leave_type_id     INTEGER      NOT NULL REFERENCES employee_leave_types(id),
  year              INTEGER      NOT NULL,
  opening_balance   NUMERIC(6,2) DEFAULT 0,
  credited          NUMERIC(6,2) DEFAULT 0,
  availed           NUMERIC(6,2) DEFAULT 0,
  encashed          NUMERIC(6,2) DEFAULT 0,
  lapsed            NUMERIC(6,2) DEFAULT 0,
  closing_balance   NUMERIC(6,2) GENERATED ALWAYS AS (opening_balance + credited - availed - encashed - lapsed) STORED,
  updated_at        TIMESTAMPTZ  DEFAULT now(),
  UNIQUE (employee_id, leave_type_id, year)
);
CREATE INDEX IF NOT EXISTS idx_leave_bal_emp_year ON employee_leave_balances(employee_id, year);

-- ─────────────────────────────────────────────────────────────
-- 3. LEAVE APPLICATIONS
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS leave_applications (
  id              SERIAL PRIMARY KEY,
  employee_id     INTEGER      NOT NULL REFERENCES employees(id),
  leave_type_id   INTEGER      NOT NULL REFERENCES employee_leave_types(id),
  from_date       DATE         NOT NULL,
  to_date         DATE         NOT NULL,
  days            NUMERIC(5,2) NOT NULL,
  half_day        BOOLEAN      DEFAULT false,
  reason          TEXT,
  status          VARCHAR(20)  DEFAULT 'Pending'  CHECK (status IN ('Pending','Approved','Rejected','Cancelled','Revoked')),
  applied_on      TIMESTAMPTZ  DEFAULT now(),
  approved_by     INTEGER      REFERENCES users(id),
  approved_on     TIMESTAMPTZ,
  rejection_reason TEXT,
  document_url    TEXT,
  balance_before  NUMERIC(6,2),
  balance_after   NUMERIC(6,2),
  created_at      TIMESTAMPTZ  DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_leave_app_emp ON leave_applications(employee_id, from_date);
CREATE INDEX IF NOT EXISTS idx_leave_app_status ON leave_applications(status);

-- ─────────────────────────────────────────────────────────────
-- 4. SALARY STRUCTURES
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS salary_structures (
  id              SERIAL PRIMARY KEY,
  code            VARCHAR(20)   NOT NULL UNIQUE,
  name            VARCHAR(100)  NOT NULL,
  grade           VARCHAR(20),
  basic_pct       NUMERIC(5,2)  DEFAULT 100,  -- % of CTC that is basic
  hra_pct         NUMERIC(5,2)  DEFAULT 40,   -- % of basic
  da_pct          NUMERIC(5,2)  DEFAULT 20,   -- % of basic
  conv_fixed      NUMERIC(10,2) DEFAULT 1600, -- fixed conveyance per month
  medical_fixed   NUMERIC(10,2) DEFAULT 1250,
  special_pct     NUMERIC(5,2)  DEFAULT 0,    -- % of basic for special allowance
  is_active       BOOLEAN       DEFAULT true,
  created_at      TIMESTAMPTZ   DEFAULT now()
);

-- seed standard structures
INSERT INTO salary_structures (code, name, grade, basic_pct, hra_pct, da_pct, conv_fixed, medical_fixed)
VALUES
  ('STR-WORKER',   'Worker Grade',         'W', 60, 40, 20, 1600, 1250),
  ('STR-SUPERVISOR','Supervisor Grade',     'S', 50, 40, 15, 1600, 1250),
  ('STR-MANAGER',  'Manager Grade',        'M', 45, 40, 10, 1600, 1250),
  ('STR-HEAD',     'Department Head',      'H', 40, 40, 10, 2000, 1250),
  ('STR-ADMIN',    'Admin / Senior Staff', 'A', 40, 40, 10, 2000, 1250)
ON CONFLICT (code) DO NOTHING;

-- ─────────────────────────────────────────────────────────────
-- 5. EMPLOYEE SALARY ASSIGNMENTS
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS employee_salary_assignments (
  id                  SERIAL PRIMARY KEY,
  employee_id         INTEGER      NOT NULL REFERENCES employees(id),
  salary_structure_id INTEGER      NOT NULL REFERENCES salary_structures(id),
  effective_from      DATE         NOT NULL,
  effective_to        DATE,
  created_by          INTEGER      REFERENCES users(id),
  created_at          TIMESTAMPTZ  DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sal_assign_emp ON employee_salary_assignments(employee_id, effective_from);

-- ─────────────────────────────────────────────────────────────
-- 6. PAYROLL RUNS (monthly run headers)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payroll_runs (
  id              SERIAL PRIMARY KEY,
  month           DATE          NOT NULL UNIQUE, -- always 1st of month
  status          VARCHAR(20)   DEFAULT 'Draft'  CHECK (status IN ('Draft','Processing','Approved','Paid','Cancelled')),
  total_employees INTEGER,
  total_gross     NUMERIC(14,2),
  total_deductions NUMERIC(14,2),
  total_net       NUMERIC(14,2),
  generated_by    INTEGER       REFERENCES users(id),
  approved_by     INTEGER       REFERENCES users(id),
  paid_by         INTEGER       REFERENCES users(id),
  approved_at     TIMESTAMPTZ,
  paid_at         TIMESTAMPTZ,
  remarks         TEXT,
  created_at      TIMESTAMPTZ   DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────
-- 7. PAYROLL DETAILS (per employee per run, component-level)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payroll_details (
  id                  SERIAL PRIMARY KEY,
  payroll_run_id      INTEGER      NOT NULL REFERENCES payroll_runs(id) ON DELETE CASCADE,
  employee_id         INTEGER      NOT NULL REFERENCES employees(id),
  salary_structure_id INTEGER      REFERENCES salary_structures(id),
  working_days        INTEGER      DEFAULT 26,
  present_days        INTEGER,
  lop_days            INTEGER      DEFAULT 0,
  -- earnings
  basic               NUMERIC(12,2) DEFAULT 0,
  hra                 NUMERIC(12,2) DEFAULT 0,
  da                  NUMERIC(12,2) DEFAULT 0,
  conveyance          NUMERIC(12,2) DEFAULT 0,
  medical             NUMERIC(12,2) DEFAULT 0,
  special_allowance   NUMERIC(12,2) DEFAULT 0,
  overtime_amount     NUMERIC(12,2) DEFAULT 0,
  other_earnings      NUMERIC(12,2) DEFAULT 0,
  gross_salary        NUMERIC(12,2) DEFAULT 0,
  -- deductions
  pf_employee         NUMERIC(12,2) DEFAULT 0,
  pf_employer         NUMERIC(12,2) DEFAULT 0,
  esic_employee       NUMERIC(12,2) DEFAULT 0,
  esic_employer       NUMERIC(12,2) DEFAULT 0,
  professional_tax    NUMERIC(12,2) DEFAULT 0,
  tds                 NUMERIC(12,2) DEFAULT 0,
  advance_recovery    NUMERIC(12,2) DEFAULT 0,
  loan_recovery       NUMERIC(12,2) DEFAULT 0,
  other_deductions    NUMERIC(12,2) DEFAULT 0,
  total_deductions    NUMERIC(12,2) DEFAULT 0,
  net_salary          NUMERIC(12,2) DEFAULT 0,
  -- payment
  payment_mode        VARCHAR(20)   DEFAULT 'Bank',
  payment_status      VARCHAR(20)   DEFAULT 'Draft' CHECK (payment_status IN ('Draft','Approved','Paid')),
  payment_date        DATE,
  transaction_ref     VARCHAR(100),
  created_at          TIMESTAMPTZ   DEFAULT now(),
  UNIQUE (payroll_run_id, employee_id)
);
CREATE INDEX IF NOT EXISTS idx_payroll_det_emp ON payroll_details(employee_id, payroll_run_id);

-- ─────────────────────────────────────────────────────────────
-- 8. ATTENDANCE REGULARIZATION
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS attendance_regularization (
  id              SERIAL PRIMARY KEY,
  employee_id     INTEGER      NOT NULL REFERENCES employees(id),
  attendance_date DATE         NOT NULL,
  in_time         TIME,
  out_time        TIME,
  reason          TEXT         NOT NULL,
  status          VARCHAR(20)  DEFAULT 'Pending' CHECK (status IN ('Pending','Approved','Rejected')),
  applied_on      TIMESTAMPTZ  DEFAULT now(),
  approved_by     INTEGER      REFERENCES users(id),
  approved_on     TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at      TIMESTAMPTZ  DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_att_reg_emp ON attendance_regularization(employee_id, attendance_date);

-- ─────────────────────────────────────────────────────────────
-- 9. APPRAISAL CYCLES
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS appraisal_cycles (
  id              SERIAL PRIMARY KEY,
  name            VARCHAR(100) NOT NULL,
  year            INTEGER      NOT NULL,
  cycle_type      VARCHAR(20)  DEFAULT 'Annual' CHECK (cycle_type IN ('Annual','Half-Yearly','Quarterly')),
  start_date      DATE         NOT NULL,
  end_date        DATE         NOT NULL,
  goal_set_deadline DATE,
  self_review_deadline DATE,
  manager_review_deadline DATE,
  status          VARCHAR(20)  DEFAULT 'Draft' CHECK (status IN ('Draft','Active','Completed','Cancelled')),
  created_by      INTEGER      REFERENCES users(id),
  created_at      TIMESTAMPTZ  DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────
-- 10. APPRAISAL GOALS (per employee per cycle)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS appraisal_goals (
  id              SERIAL PRIMARY KEY,
  cycle_id        INTEGER      NOT NULL REFERENCES appraisal_cycles(id) ON DELETE CASCADE,
  employee_id     INTEGER      NOT NULL REFERENCES employees(id),
  goal_title      VARCHAR(200) NOT NULL,
  description     TEXT,
  weightage       NUMERIC(5,2) DEFAULT 0,    -- % of total score
  kpi_target      TEXT,
  kpi_actual      TEXT,
  self_rating     NUMERIC(3,1),              -- 1.0 – 5.0
  manager_rating  NUMERIC(3,1),
  final_rating    NUMERIC(3,1),
  set_by          INTEGER      REFERENCES users(id),
  created_at      TIMESTAMPTZ  DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_appr_goals_emp ON appraisal_goals(employee_id, cycle_id);

-- ─────────────────────────────────────────────────────────────
-- 11. APPRAISAL COMPETENCIES
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS appraisal_competencies (
  id              SERIAL PRIMARY KEY,
  cycle_id        INTEGER      NOT NULL REFERENCES appraisal_cycles(id) ON DELETE CASCADE,
  employee_id     INTEGER      NOT NULL REFERENCES employees(id),
  competency      VARCHAR(100) NOT NULL,
  self_rating     NUMERIC(3,1),
  manager_rating  NUMERIC(3,1),
  comments        TEXT,
  created_at      TIMESTAMPTZ  DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────
-- 12. TRAINING PROGRAMS
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS training_programs (
  id              SERIAL PRIMARY KEY,
  title           VARCHAR(200) NOT NULL,
  category        VARCHAR(50),               -- Safety / Technical / Soft Skills / HR / Compliance
  trainer_name    VARCHAR(100),
  trainer_type    VARCHAR(20)  DEFAULT 'Internal' CHECK (trainer_type IN ('Internal','External','Online')),
  venue           VARCHAR(200),
  scheduled_date  DATE,
  duration_hours  NUMERIC(5,2),
  max_nominees    INTEGER,
  department_ids  INTEGER[],                 -- target depts (NULL = all)
  status          VARCHAR(20)  DEFAULT 'Planned' CHECK (status IN ('Planned','Completed','Cancelled')),
  notes           TEXT,
  created_by      INTEGER      REFERENCES users(id),
  created_at      TIMESTAMPTZ  DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────
-- 13. TRAINING ATTENDANCE
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS training_attendance (
  id              SERIAL PRIMARY KEY,
  training_id     INTEGER      NOT NULL REFERENCES training_programs(id) ON DELETE CASCADE,
  employee_id     INTEGER      NOT NULL REFERENCES employees(id),
  nominated_by    INTEGER      REFERENCES users(id),
  status          VARCHAR(20)  DEFAULT 'Nominated' CHECK (status IN ('Nominated','Attended','Absent','Cancelled')),
  feedback        TEXT,
  score           NUMERIC(5,2),
  certificate_url TEXT,
  attended_on     DATE,
  created_at      TIMESTAMPTZ  DEFAULT now(),
  UNIQUE (training_id, employee_id)
);
CREATE INDEX IF NOT EXISTS idx_training_att_emp ON training_attendance(employee_id);

-- ─────────────────────────────────────────────────────────────
-- 14. EMPLOYEE DOCUMENTS
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS employee_documents (
  id              SERIAL PRIMARY KEY,
  employee_id     INTEGER      NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  doc_type        VARCHAR(50)  NOT NULL,  -- Offer Letter / Appointment / Appraisal / PF / ESIC / ID Proof / Bank / Other
  doc_name        VARCHAR(200) NOT NULL,
  file_url        TEXT         NOT NULL,
  file_size_kb    INTEGER,
  uploaded_by     INTEGER      REFERENCES users(id),
  valid_from      DATE,
  valid_to        DATE,
  is_confidential BOOLEAN      DEFAULT false,
  notes           TEXT,
  created_at      TIMESTAMPTZ  DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_emp_docs_emp ON employee_documents(employee_id, doc_type);

-- ─────────────────────────────────────────────────────────────
-- 15. ONBOARDING CHECKLIST
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS onboarding_tasks_master (
  id            SERIAL PRIMARY KEY,
  task_title    VARCHAR(200) NOT NULL,
  responsible   VARCHAR(50)  DEFAULT 'HR',  -- HR / IT / Finance / Dept Head / Employee
  dept_code     VARCHAR(20),
  due_days      INTEGER      DEFAULT 1,     -- days from DOJ
  is_active     BOOLEAN      DEFAULT true,
  sort_order    INTEGER      DEFAULT 0
);

INSERT INTO onboarding_tasks_master (task_title, responsible, due_days, sort_order) VALUES
  ('Collect signed offer letter',                   'HR',        0,  1),
  ('Issue appointment letter',                      'HR',        1,  2),
  ('Collect ID proof (Aadhaar + PAN)',              'HR',        1,  3),
  ('Open bank account / collect bank details',      'Finance',   3,  4),
  ('PF registration (UAN activation)',              'HR',        3,  5),
  ('ESIC registration (if applicable)',             'HR',        3,  6),
  ('Issue company ID card + access card',           'HR',        2,  7),
  ('Laptop / workstation provisioning',             'IT',        1,  8),
  ('Email account creation',                        'IT',        1,  9),
  ('ERP system access setup',                       'IT',        2, 10),
  ('Department orientation session',                'Dept Head', 1, 11),
  ('Safety induction training',                     'EHS',       1, 12),
  ('Introduce to team members',                     'Dept Head', 1, 13),
  ('Review job description with manager',           'Dept Head', 3, 14),
  ('Set 30-day onboarding goals',                   'Dept Head', 5, 15),
  ('Collect educational certificates (attested)',   'HR',        7, 16),
  ('Medical examination (if required)',             'HR',        7, 17),
  ('Add to payroll',                                'Finance',   3, 18),
  ('Confirm probation period end date',             'HR',        1, 19),
  ('30-day check-in meeting with HR',               'HR',       30, 20)
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS onboarding_checklist (
  id              SERIAL PRIMARY KEY,
  employee_id     INTEGER      NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  task_id         INTEGER      NOT NULL REFERENCES onboarding_tasks_master(id),
  due_date        DATE,
  status          VARCHAR(20)  DEFAULT 'Pending' CHECK (status IN ('Pending','In Progress','Done','NA')),
  completed_by    INTEGER      REFERENCES users(id),
  completed_on    TIMESTAMPTZ,
  notes           TEXT,
  created_at      TIMESTAMPTZ  DEFAULT now(),
  UNIQUE (employee_id, task_id)
);
CREATE INDEX IF NOT EXISTS idx_onboard_emp ON onboarding_checklist(employee_id);

-- ─────────────────────────────────────────────────────────────
-- 16. SEPARATION RECORDS
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS separation_records (
  id                  SERIAL PRIMARY KEY,
  employee_id         INTEGER      NOT NULL REFERENCES employees(id),
  separation_type     VARCHAR(30)  NOT NULL CHECK (separation_type IN ('Resignation','Termination','Retirement','Absconding','Contract End','Death')),
  resignation_date    DATE,
  last_working_date   DATE,
  notice_period_days  INTEGER,
  notice_served_days  INTEGER,
  notice_buyout       BOOLEAN      DEFAULT false,
  reason              TEXT,
  status              VARCHAR(20)  DEFAULT 'Initiated' CHECK (status IN ('Initiated','Clearance Pending','FF Pending','Completed','Revoked')),
  -- gratuity
  service_years       NUMERIC(5,2),
  gratuity_amount     NUMERIC(12,2),  -- 15/26 × basic × service_years
  -- payouts
  leave_encashment    NUMERIC(12,2),
  bonus_payable       NUMERIC(12,2),
  deductions          NUMERIC(12,2),
  net_ff_amount       NUMERIC(12,2),
  ff_paid_date        DATE,
  -- process
  initiated_by        INTEGER      REFERENCES users(id),
  approved_by         INTEGER      REFERENCES users(id),
  closed_by           INTEGER      REFERENCES users(id),
  created_at          TIMESTAMPTZ  DEFAULT now(),
  updated_at          TIMESTAMPTZ  DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sep_emp ON separation_records(employee_id);

-- ─────────────────────────────────────────────────────────────
-- 17. CLEARANCE ITEMS (per dept per separation)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS clearance_items (
  id                SERIAL PRIMARY KEY,
  separation_id     INTEGER      NOT NULL REFERENCES separation_records(id) ON DELETE CASCADE,
  department_id     INTEGER      REFERENCES departments(id),
  dept_name         VARCHAR(100),
  item_description  VARCHAR(200) NOT NULL,
  status            VARCHAR(20)  DEFAULT 'Pending' CHECK (status IN ('Pending','Cleared','Rejected')),
  cleared_by        INTEGER      REFERENCES users(id),
  cleared_on        TIMESTAMPTZ,
  remarks           TEXT,
  created_at        TIMESTAMPTZ  DEFAULT now()
);

-- seed standard clearance items per dept
CREATE OR REPLACE FUNCTION seed_clearance_items(p_sep_id INTEGER) RETURNS VOID AS $$
BEGIN
  INSERT INTO clearance_items (separation_id, dept_name, item_description) VALUES
    (p_sep_id, 'IT',         'Return laptop / PC / peripherals'),
    (p_sep_id, 'IT',         'Revoke system and ERP access'),
    (p_sep_id, 'Security',   'Return ID card and access badge'),
    (p_sep_id, 'HR',         'Return appointment / policy documents'),
    (p_sep_id, 'Finance',    'Settle advances and outstanding loans'),
    (p_sep_id, 'Store',      'Return tools / equipment / uniform'),
    (p_sep_id, 'Dept Head',  'Knowledge transfer completed'),
    (p_sep_id, 'HR',         'Issue experience certificate');
END;
$$ LANGUAGE plpgsql;

-- ─────────────────────────────────────────────────────────────
-- INDEXES ON EXISTING TABLES (ensure fast self-service queries)
-- ─────────────────────────────────────────────────────────────
DO $$
BEGIN
  -- employees.user_id — used by all /me routes
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename='employees' AND indexname='idx_employees_user_id') THEN
    CREATE INDEX idx_employees_user_id ON employees(user_id);
  END IF;
  -- attendance.employee_id + date — /attendance/me monthly filter
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename='attendance' AND indexname='idx_attendance_emp_date') THEN
    CREATE INDEX idx_attendance_emp_date ON attendance(employee_id, date);
  END IF;
  -- payrolls.employee_id — /payroll/me
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename='payrolls' AND indexname='idx_payrolls_employee_id') THEN
    CREATE INDEX idx_payrolls_employee_id ON payrolls(employee_id);
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────
-- TRACK MIGRATION
-- migrate.js records this file in schema_migrations(filename) itself.
-- (Earlier this block INSERTed into schema_migrations(version,description),
--  which does not match the (filename,applied_at) schema migrate.js creates —
--  that mismatch aborted the whole migration. Removed.)
-- ─────────────────────────────────────────────────────────────

COMMIT;

-- ─────────────────────────────────────────────────────────────
-- VERIFY
-- ─────────────────────────────────────────────────────────────
SELECT tablename FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'employee_leave_types','employee_leave_balances','leave_applications',
    'salary_structures','employee_salary_assignments',
    'payroll_runs','payroll_details',
    'attendance_regularization',
    'appraisal_cycles','appraisal_goals','appraisal_competencies',
    'training_programs','training_attendance',
    'employee_documents',
    'onboarding_tasks_master','onboarding_checklist',
    'separation_records','clearance_items'
  )
ORDER BY tablename;
