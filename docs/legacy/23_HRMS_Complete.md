# HRMS — Complete Workflow, Role Matrix & Integration
# Phase 16 — Human Resource Management System
# Stack: Node.js/Express + React 18 + PostgreSQL (existing PaperMES architecture)
# Last updated: 2026-06-30

---

## 1. HRMS Architecture & Integration Map

```
┌──────────────────────────────────────────────────────────────────┐
│                    PAPERMES ECOSYSTEM (existing)                   │
│                                                                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐            │
│  │  Production  │  │  Store /     │  │  Finance /   │            │
│  │  / Quality   │◄─►  Inventory  │◄─►  Accounts    │            │
│  └──────┬───────┘  └──────────────┘  └──────┬───────┘            │
│         │                                    │                    │
│  ┌──────▼───────────────────────────────────▼───────┐            │
│  │                  HRMS (Ph16 — new)                │            │
│  │  Employee Master → Attendance → Leave → Payroll   │            │
│  │  Appraisal → Training → Documents → Onboarding    │            │
│  └──────────────────────────────────────────────────┘            │
│         │                                                         │
│  ┌──────▼───────┐  ┌──────────────┐  ┌──────────────┐            │
│  │  Biometric   │  │  Indent /    │  │  Govt Portals│            │
│  │  Devices     │  │  PIIMAS      │  │  EPFO / ESIC │            │
│  └──────────────┘  └──────────────┘  └──────────────┘            │
└──────────────────────────────────────────────────────────────────┘
```

**Integration with existing modules:**
- `employees.user_id → users.id` — login account linked to employee
- `indents.raised_by → users.id` — all PIIMAS indents carry employee identity
- `maintenance_logs.performed_by → users.id` — maintenance by employee
- `attendance.shift_type` aligns with `shifts.shift_type` (Production module)
- `payroll_details` → posts journal entries to Finance module
- `department_id` shared across HR, Production, Store, etc.

---

## 2. Role & Privilege Matrix

### 2.1 Role Levels (existing — no change to numbering)

| Level | Role Name | HRMS Power |
|-------|-----------|-----------|
| **5** | **Admin** | Full HRMS superuser. Create employees, run payroll, view all data, override any action. Same as HR Admin for HR module. |
| **5-HR** | **HR Admin** | `dept_code='HR' AND role_level >= 3`. Full HRMS control: employee CRUD, payroll run, leave override, appraisal setup, document access. |
| **4** | **Plant Head / GM** | Approve payroll final. View all employee data. Override leave. No employee CRUD. |
| **3** | **Department Head** | Manage own-dept employees only. Approve leaves, mark/review attendance, initiate appraisals, view own-dept payslips. Approve onboarding for own dept. |
| **2** | **Supervisor / Foreman** | Mark attendance (own dept). View own-dept employee list. No pay data access. |
| **1** | **Employee (Operator)** | Self-service: view own payslip, apply leave, view own attendance, update personal info (restricted fields), view own appraisal. |

### 2.2 Employee Type: Head vs Normal

Every `employees` row has `is_dept_head BOOLEAN`. When true:
- Login shows approval queues (leaves, attendance regularization)
- Backend guard: `req.user.role_level >= 3` or `employees.is_dept_head = true` for approval actions
- Dept filtering: record `department_id === req.user.department_id` always enforced (unless L4+)

```js
// Standard dept-head guard — use in every approval route
const isDeptHead = req.user.role_level >= 3;
const isHRAdmin  = req.user.dept_code === 'HR' && req.user.role_level >= 3;
const isSysAdmin = req.user.role_level >= 5;
const isPlantHead = req.user.role_level >= 4;

// Cross-dept access: only HR Admin, Plant Head, Admin
const canSeeAllDepts = isHRAdmin || isPlantHead;
```

### 2.3 Login → Privilege Flow

```
POST /api/auth/login
  → verifies password
  → JWT payload: { id, name, email, role, role_level, dept_code, department_id, shift, emp_id }
  → frontend reads role_level + dept_code → renders correct sidebar sections

Sidebar sections (role-gated):
  L1 Employee:   My Profile | My Attendance | My Leaves | My Payslip
  L2 Supervisor: + Team Attendance | Mark Attendance
  L3 Dept Head:  + Leave Approvals | Team Reports | Appraisal | Onboarding
  L3 HR Admin:   + Employee CRUD | Payroll | All Leaves | Documents | Training | Settings
  L4 Plant Head: + All Reports | Payroll Approval | All Departments (read)
  L5 Admin:      All of above + User Management + System Settings
```

---

## 3. Department Mapping (Paper Mill — 20 Depts)

| Dept ID | Code | Department | Head Login | HRMS Role |
|---------|------|-----------|-----------|----------|
| D01 | PULP | Stock Preparation | head.pulp@mkpapermill.com | Dept Head (L3) |
| D02 | WET | Paper Machine - Wet End | head.wet@mkpapermill.com | Dept Head (L3) |
| D03 | DRY | Paper Machine - Dry End | head.dry@mkpapermill.com | Dept Head (L3) |
| D04 | FIN | Finishing | head.fin2@mkpapermill.com | Dept Head (L3) |
| D05 | CHEM | Chemical & Sizing | head.chem@mkpapermill.com | Dept Head (L3) |
| D06 | UTIL | Utilities - Steam | head.util@mkpapermill.com | Dept Head (L3) |
| D07 | UTLG | Utilities - General | head.utlg@mkpapermill.com | Dept Head (L3) |
| D08 | ENV | Environment | head.env@mkpapermill.com | Dept Head (L3) |
| D09 | QC | Quality Control | head.qc@mkpapermill.com | Dept Head (L3) |
| D10 | STORE | Stores & Procurement | head.store@mkpapermill.com | Dept Head (L3) |
| D11 | ELEC | Electrical | head.elec@mkpapermill.com | Dept Head (L3) |
| D12 | INST | Instrumentation | head.inst@mkpapermill.com | Dept Head (L3) |
| D13 | MECH | Mechanical Maintenance | head.mech@mkpapermill.com | Dept Head (L3) |
| D14 | CIVIL | Civil & Projects | head.civil@mkpapermill.com | Dept Head (L3) |
| D15 | IT | IT & Automation | head.it@mkpapermill.com | Dept Head (L3) |
| D16 | HR | HR & Admin | head.hr@mkpapermill.com | **HR Admin** |
| D17 | FIN | Finance & Accounts | head.fin@mkpapermill.com | Dept Head (L3) |
| D18 | SAFE | Safety & Fire | head.ehs@mkpapermill.com | Dept Head (L3) |
| D19 | PLAN | Production Planning | head.plan@mkpapermill.com | Dept Head (L3) |
| D20 | DISP | Sales & Dispatch | head.disp@mkpapermill.com | Dept Head (L3) |

**Hierarchy per department:**
```
VP/GM (L4) → DGM → Sr. Manager → Manager (L3) → Dy. Manager → 
Asst. Manager → Sr. Engineer (L2) → Engineer → Jr. Engineer → 
Supervisor/Foreman (L2) → Technician/Operator (L1) → Helper/Trainee (L1)
```

---

## 4. Database Schema — New HRMS Tables

All in migration: `db/migration_hrms_ph16.sql`

### 4.1 Expand `employees` Table

```sql
-- Add to existing employees table
ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS middle_name       VARCHAR(50),
  ADD COLUMN IF NOT EXISTS father_name       VARCHAR(100),
  ADD COLUMN IF NOT EXISTS blood_group       VARCHAR(5),
  ADD COLUMN IF NOT EXISTS nationality       VARCHAR(30) DEFAULT 'Indian',
  ADD COLUMN IF NOT EXISTS marital_status    VARCHAR(20),
  ADD COLUMN IF NOT EXISTS permanent_address TEXT,
  ADD COLUMN IF NOT EXISTS current_address   TEXT,
  ADD COLUMN IF NOT EXISTS emergency_contact VARCHAR(100),
  ADD COLUMN IF NOT EXISTS emergency_mobile  VARCHAR(15),
  ADD COLUMN IF NOT EXISTS photo_url         VARCHAR(255),
  ADD COLUMN IF NOT EXISTS employment_type   VARCHAR(30) DEFAULT 'Permanent',
  -- Permanent | Probation | Contract | Trainee | Apprentice | Daily Wage | Consultant
  ADD COLUMN IF NOT EXISTS grade             VARCHAR(20),  -- E1/E2/M1/M2 etc
  ADD COLUMN IF NOT EXISTS reporting_to      INTEGER REFERENCES employees(id),
  ADD COLUMN IF NOT EXISTS shift_pattern     VARCHAR(20) DEFAULT 'General',
  -- General | 3Shift | 12Hour
  ADD COLUMN IF NOT EXISTS confirmation_date DATE,
  ADD COLUMN IF NOT EXISTS probation_end     DATE,
  ADD COLUMN IF NOT EXISTS date_of_leaving   DATE,
  ADD COLUMN IF NOT EXISTS separation_type   VARCHAR(30),
  -- Resignation | Termination | Retirement | Contract End | Death | VRS
  ADD COLUMN IF NOT EXISTS uan_number        VARCHAR(20),   -- EPFO UAN
  ADD COLUMN IF NOT EXISTS gratuity_nomination TEXT,
  ADD COLUMN IF NOT EXISTS is_dept_head      BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS cost_center       VARCHAR(30),
  ADD COLUMN IF NOT EXISTS updated_at        TIMESTAMP DEFAULT NOW();
```

### 4.2 New: `employee_leave_types` — Leave Policy Master

```sql
CREATE TABLE IF NOT EXISTS employee_leave_types (
  id              SERIAL PRIMARY KEY,
  code            VARCHAR(10) UNIQUE NOT NULL,  -- CL, SL, EL, ML, PL, CO, LOP, OD
  name            VARCHAR(50) NOT NULL,
  annual_quota    NUMERIC(5,1),                 -- days per year (null = unlimited for LOP)
  carry_forward   BOOLEAN DEFAULT false,
  max_carry       NUMERIC(5,1),                 -- max days to carry to next year
  encashable      BOOLEAN DEFAULT false,
  min_notice_days INTEGER DEFAULT 0,            -- days before leave must be applied
  medical_cert_required INTEGER DEFAULT 0,      -- require cert if consecutive days > this
  is_active       BOOLEAN DEFAULT true,
  created_at      TIMESTAMP DEFAULT NOW()
);
```

### 4.3 New: `employee_leave_balances` — Annual Leave Ledger

```sql
CREATE TABLE IF NOT EXISTS employee_leave_balances (
  id              SERIAL PRIMARY KEY,
  employee_id     INTEGER NOT NULL REFERENCES employees(id),
  year            INTEGER NOT NULL,
  leave_type_id   INTEGER NOT NULL REFERENCES employee_leave_types(id),
  opening_balance NUMERIC(5,1) DEFAULT 0,
  credited        NUMERIC(5,1) DEFAULT 0,
  availed         NUMERIC(5,1) DEFAULT 0,
  encashed        NUMERIC(5,1) DEFAULT 0,
  lapsed          NUMERIC(5,1) DEFAULT 0,
  closing_balance NUMERIC(5,1) GENERATED ALWAYS AS
                  (opening_balance + credited - availed - encashed - lapsed) STORED,
  UNIQUE (employee_id, year, leave_type_id)
);
```

### 4.4 New: `leave_applications` — Leave Requests

```sql
CREATE TABLE IF NOT EXISTS leave_applications (
  id              SERIAL PRIMARY KEY,
  employee_id     INTEGER NOT NULL REFERENCES employees(id),
  leave_type_id   INTEGER NOT NULL REFERENCES employee_leave_types(id),
  from_date       DATE NOT NULL,
  to_date         DATE NOT NULL,
  days_count      NUMERIC(4,1) NOT NULL,
  half_day        BOOLEAN DEFAULT false,
  half_day_slot   VARCHAR(10),                  -- First | Second
  reason          TEXT NOT NULL,
  contact_number  VARCHAR(15),
  doc_url         VARCHAR(255),                 -- medical cert etc
  status          VARCHAR(20) DEFAULT 'Pending',
  -- Pending | HOD_Approved | HR_Approved | Rejected | Cancelled
  hod_id          INTEGER REFERENCES users(id),
  hod_remarks     TEXT,
  hod_actioned_at TIMESTAMP,
  hr_id           INTEGER REFERENCES users(id),
  hr_remarks      TEXT,
  hr_actioned_at  TIMESTAMP,
  applied_at      TIMESTAMP DEFAULT NOW(),
  created_at      TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_leave_emp ON leave_applications(employee_id, from_date DESC);
CREATE INDEX idx_leave_status ON leave_applications(status);
```

### 4.5 New: `payroll_runs` — Monthly Payroll Header

```sql
CREATE TABLE IF NOT EXISTS payroll_runs (
  id              SERIAL PRIMARY KEY,
  month           INTEGER NOT NULL,             -- 1-12
  year            INTEGER NOT NULL,
  status          VARCHAR(20) DEFAULT 'Draft',
  -- Draft | Calculated | Reviewed | Approved | Disbursed
  total_employees INTEGER,
  total_gross     NUMERIC(14,2),
  total_deductions NUMERIC(14,2),
  total_net_pay   NUMERIC(14,2),
  calculated_by   INTEGER REFERENCES users(id),
  calculated_at   TIMESTAMP,
  approved_by     INTEGER REFERENCES users(id),
  approved_at     TIMESTAMP,
  remarks         TEXT,
  created_at      TIMESTAMP DEFAULT NOW(),
  UNIQUE (month, year)
);
```

### 4.6 New: `payroll_details` — Per-Employee Per-Month Payslip

```sql
CREATE TABLE IF NOT EXISTS payroll_details (
  id              SERIAL PRIMARY KEY,
  run_id          INTEGER NOT NULL REFERENCES payroll_runs(id),
  employee_id     INTEGER NOT NULL REFERENCES employees(id),
  month           INTEGER NOT NULL,
  year            INTEGER NOT NULL,
  -- Attendance
  working_days    INTEGER,
  paid_days       NUMERIC(4,1),
  lop_days        NUMERIC(4,1) DEFAULT 0,
  ot_hours        NUMERIC(5,2) DEFAULT 0,
  -- Earnings (JSONB — flexible per employee's salary structure)
  earnings        JSONB NOT NULL DEFAULT '{}',
  -- { basic, da, hra, conveyance, special, ot_amount, shift_allowance, production_bonus, gross }
  -- Deductions
  deductions      JSONB NOT NULL DEFAULT '{}',
  -- { pf_employee, esi_employee, pt, tds, advance, loan_emi, canteen, total }
  gross_salary    NUMERIC(12,2) NOT NULL,
  total_deductions NUMERIC(12,2) NOT NULL,
  net_pay         NUMERIC(12,2) NOT NULL,
  -- Employer costs
  pf_employer     NUMERIC(10,2) DEFAULT 0,
  esi_employer    NUMERIC(10,2) DEFAULT 0,
  -- YTD running totals
  ytd_gross       NUMERIC(14,2) DEFAULT 0,
  ytd_tds         NUMERIC(12,2) DEFAULT 0,
  ytd_pf          NUMERIC(12,2) DEFAULT 0,
  payslip_url     VARCHAR(255),                 -- generated PDF link
  created_at      TIMESTAMP DEFAULT NOW(),
  UNIQUE (run_id, employee_id)
);
```

### 4.7 New: `salary_structures` — Employee CTC Breakdown

```sql
CREATE TABLE IF NOT EXISTS salary_structures (
  id              SERIAL PRIMARY KEY,
  employee_id     INTEGER NOT NULL REFERENCES employees(id),
  effective_from  DATE NOT NULL,
  effective_to    DATE,                         -- null = current
  ctc_annual      NUMERIC(12,2) NOT NULL,
  basic_monthly   NUMERIC(10,2) NOT NULL,
  da_monthly      NUMERIC(10,2) DEFAULT 0,
  hra_monthly     NUMERIC(10,2) DEFAULT 0,
  conveyance      NUMERIC(8,2)  DEFAULT 1600,
  medical_allow   NUMERIC(8,2)  DEFAULT 1250,
  special_allow   NUMERIC(10,2) DEFAULT 0,     -- balancing figure
  shift_allow     NUMERIC(8,2)  DEFAULT 0,
  lta_annual      NUMERIC(10,2) DEFAULT 0,
  pf_applicable   BOOLEAN DEFAULT true,
  esi_applicable  BOOLEAN DEFAULT false,        -- auto-set if gross <= 21000
  pt_state        VARCHAR(30)   DEFAULT 'Maharashtra',
  tax_regime      VARCHAR(10)   DEFAULT 'New', -- Old | New (IT regime)
  created_by      INTEGER REFERENCES users(id),
  created_at      TIMESTAMP DEFAULT NOW()
);
```

### 4.8 New: `attendance_regularization` — Missed Punch Requests

```sql
CREATE TABLE IF NOT EXISTS attendance_regularization (
  id              SERIAL PRIMARY KEY,
  employee_id     INTEGER NOT NULL REFERENCES employees(id),
  attendance_date DATE NOT NULL,
  missed_punch    VARCHAR(5) NOT NULL,          -- IN | OUT
  claimed_time    TIMESTAMP NOT NULL,
  reason          VARCHAR(50) NOT NULL,
  -- ForgotPunch | DeviceError | OnDuty | OfficialWork | Other
  remarks         TEXT,
  doc_url         VARCHAR(255),
  status          VARCHAR(20) DEFAULT 'Pending',
  -- Pending | HOD_Approved | HR_Approved | Rejected
  hod_id          INTEGER REFERENCES users(id),
  hod_remarks     TEXT,
  hod_actioned_at TIMESTAMP,
  hr_id           INTEGER REFERENCES users(id),
  hr_remarks      TEXT,
  hr_actioned_at  TIMESTAMP,
  applied_at      TIMESTAMP DEFAULT NOW()
);
```

### 4.9 New: `appraisal_cycles` — Performance Review Calendar

```sql
CREATE TABLE IF NOT EXISTS appraisal_cycles (
  id              SERIAL PRIMARY KEY,
  cycle_name      VARCHAR(100) NOT NULL,
  financial_year  VARCHAR(10) NOT NULL,         -- "2026-2027"
  goal_set_start  DATE,
  goal_set_end    DATE,
  self_review_start DATE,
  self_review_end DATE,
  mgr_review_start DATE,
  mgr_review_end  DATE,
  normalization_date DATE,
  status          VARCHAR(20) DEFAULT 'Planning',
  -- Planning | GoalSetting | SelfReview | ManagerReview | Completed
  created_by      INTEGER REFERENCES users(id),
  created_at      TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS appraisal_goals (
  id              SERIAL PRIMARY KEY,
  cycle_id        INTEGER NOT NULL REFERENCES appraisal_cycles(id),
  employee_id     INTEGER NOT NULL REFERENCES employees(id),
  kra_title       VARCHAR(200) NOT NULL,
  kra_description TEXT,
  target_value    VARCHAR(100),                 -- "450 TPD" or "95%"
  weight_pct      NUMERIC(5,2) NOT NULL,
  self_achievement VARCHAR(100),
  self_rating     NUMERIC(3,1),
  self_comments   TEXT,
  mgr_rating      NUMERIC(3,1),
  mgr_comments    TEXT,
  final_rating    NUMERIC(3,1),
  submitted_at    TIMESTAMP,
  mgr_reviewed_at TIMESTAMP,
  created_at      TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS appraisal_competencies (
  id              SERIAL PRIMARY KEY,
  cycle_id        INTEGER NOT NULL REFERENCES appraisal_cycles(id),
  employee_id     INTEGER NOT NULL REFERENCES employees(id),
  competency      VARCHAR(100) NOT NULL,
  -- TechnicalKnowledge | Safety | Teamwork | Leadership | ProblemSolving | Communication
  self_rating     NUMERIC(3,1),
  mgr_rating      NUMERIC(3,1),
  final_rating    NUMERIC(3,1),
  weight_pct      NUMERIC(5,2) DEFAULT 0,
  created_at      TIMESTAMP DEFAULT NOW()
);
```

### 4.10 New: `training_programs` + `training_attendance`

```sql
CREATE TABLE IF NOT EXISTS training_programs (
  id              SERIAL PRIMARY KEY,
  title           VARCHAR(200) NOT NULL,
  training_type   VARCHAR(30) NOT NULL,
  -- Technical | Safety | Regulatory | Soft Skills | On Job
  dept_id         INTEGER REFERENCES departments(id),  -- null = all depts
  trainer_name    VARCHAR(100),
  trainer_type    VARCHAR(20) DEFAULT 'Internal',      -- Internal | External
  duration_hours  NUMERIC(5,1),
  start_date      DATE NOT NULL,
  end_date        DATE NOT NULL,
  max_participants INTEGER,
  venue           VARCHAR(200),
  is_mandatory    BOOLEAN DEFAULT false,
  certificate_valid_months INTEGER,                    -- 0 = no expiry
  status          VARCHAR(20) DEFAULT 'Scheduled',
  -- Scheduled | InProgress | Completed | Cancelled
  created_by      INTEGER REFERENCES users(id),
  created_at      TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS training_attendance (
  id              SERIAL PRIMARY KEY,
  training_id     INTEGER NOT NULL REFERENCES training_programs(id),
  employee_id     INTEGER NOT NULL REFERENCES employees(id),
  enrolled_at     TIMESTAMP DEFAULT NOW(),
  attendance_status VARCHAR(20) DEFAULT 'Enrolled',
  -- Enrolled | Attended | Absent | Completed
  pre_score       INTEGER,                             -- 0-100
  post_score      INTEGER,                             -- 0-100
  certificate_url VARCHAR(255),
  cert_valid_till DATE,
  remarks         TEXT,
  UNIQUE (training_id, employee_id)
);
```

### 4.11 New: `employee_documents` — Document Vault

```sql
CREATE TABLE IF NOT EXISTS employee_documents (
  id              SERIAL PRIMARY KEY,
  employee_id     INTEGER NOT NULL REFERENCES employees(id),
  doc_category    VARCHAR(30) NOT NULL,
  -- Identity | Education | Statutory | Employment | Medical | Other
  doc_type        VARCHAR(50) NOT NULL,
  -- Aadhaar | PAN | Passport | DrivingLicense | Degree | PF_Nomination | ESI_Nomination |
  -- MedicalCert | BackgroundVerification | OfferLetter | AppointmentLetter | ITDeclaration
  doc_number      VARCHAR(100),
  issue_date      DATE,
  expiry_date     DATE,
  file_url        VARCHAR(255) NOT NULL,
  verified        BOOLEAN DEFAULT false,
  verified_by     INTEGER REFERENCES users(id),
  verified_at     TIMESTAMP,
  is_active       BOOLEAN DEFAULT true,
  uploaded_by     INTEGER REFERENCES users(id),
  created_at      TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_emp_docs ON employee_documents(employee_id, doc_category);
```

### 4.12 New: `onboarding_checklist` — Day-1 to Confirmation

```sql
CREATE TABLE IF NOT EXISTS onboarding_checklist (
  id              SERIAL PRIMARY KEY,
  employee_id     INTEGER NOT NULL REFERENCES employees(id),
  task_seq        INTEGER NOT NULL,
  task_name       VARCHAR(200) NOT NULL,
  task_owner      VARCHAR(30) NOT NULL,         -- HR | IT | Safety | Admin | HOD | Store | Finance
  due_date        DATE,
  completed       BOOLEAN DEFAULT false,
  completed_by    INTEGER REFERENCES users(id),
  completed_at    TIMESTAMP,
  remarks         TEXT,
  UNIQUE (employee_id, task_seq)
);
```

### 4.13 New: `separation_records` — Exit Management

```sql
CREATE TABLE IF NOT EXISTS separation_records (
  id              SERIAL PRIMARY KEY,
  employee_id     INTEGER NOT NULL REFERENCES employees(id),
  separation_type VARCHAR(30) NOT NULL,
  resignation_date DATE,
  notice_period_days INTEGER,
  last_working_day DATE,
  resignation_url VARCHAR(255),
  exit_interview_done BOOLEAN DEFAULT false,
  exit_interview_rating INTEGER,               -- 1-5
  fnf_amount      NUMERIC(14,2),
  fnf_approved_by INTEGER REFERENCES users(id),
  fnf_approved_at TIMESTAMP,
  status          VARCHAR(20) DEFAULT 'Initiated',
  -- Initiated | Clearance | ExitInterview | FnFCalculated | Approved | Closed
  created_at      TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS clearance_items (
  id              SERIAL PRIMARY KEY,
  separation_id   INTEGER NOT NULL REFERENCES separation_records(id),
  dept_name       VARCHAR(50) NOT NULL,
  cleared         BOOLEAN DEFAULT false,
  dues_amount     NUMERIC(10,2) DEFAULT 0,
  assets_returned TEXT,                        -- JSON-like text list
  cleared_by      INTEGER REFERENCES users(id),
  cleared_at      TIMESTAMP,
  remarks         TEXT
);
```

---

## 5. API Routes Map — HRMS (mount under `/api/hr`)

Add to `backend/src/routes/hr.js` and mount in `server.js`.

### 5.1 Employee Master

| Method | Endpoint | Guard | Action |
|--------|----------|-------|--------|
| GET | `/employees` | L1+ | List with filter (dept, status, search) — own dept only if L1/L2 |
| GET | `/employees/:id` | L1+ | Detail — own record if L1, own dept if L2/L3, all if L4+ |
| POST | `/employees` | isHRAdmin or L5 | Create employee (HR only) |
| PUT | `/employees/:id` | isHRAdmin or L5 | Update employee |
| PUT | `/employees/:id/deactivate` | isHRAdmin or L5 | Soft exit |
| GET | `/employees/:id/history` | L3+ | Audit trail of all changes |
| GET | `/employees/:id/timeline` | L3+ | Full lifecycle timeline |
| GET | `/employees/self` | L1 | Own employee record |

### 5.2 Attendance (expanded from existing)

| Method | Endpoint | Guard | Action |
|--------|----------|-------|--------|
| GET | `/attendance` | L1+ | List (date, employee_id, dept) |
| POST | `/attendance` | L2+ | Single upsert |
| POST | `/attendance/bulk` | L2+ | Bulk mark (own dept) |
| GET | `/attendance/summary` | L1+ | Summary by date |
| POST | `/attendance/regularize` | L1+ | Submit regularization request |
| GET | `/attendance/regularize` | L2+ | List pending requests (own dept) |
| PUT | `/attendance/regularize/:id/hod` | L3+ | HOD approve/reject |
| PUT | `/attendance/regularize/:id/hr` | isHRAdmin | HR final approve/reject |
| POST | `/attendance/lock` | isHRAdmin | Lock month for payroll |

### 5.3 Leave Management

| Method | Endpoint | Guard | Action |
|--------|----------|-------|--------|
| GET | `/leaves/types` | L1+ | All leave type policies |
| GET | `/leaves/balances/:emp_id` | L1+ | Own only if L1 |
| POST | `/leaves/apply` | L1+ | Apply leave |
| GET | `/leaves/applications` | L1+ | List (own if L1, dept if L3, all if isHRAdmin) |
| PUT | `/leaves/:id/hod-action` | L3+ | HOD approve/reject (own dept) |
| PUT | `/leaves/:id/hr-action` | isHRAdmin | HR approve/reject/override |
| DELETE | `/leaves/:id/cancel` | L1+ | Cancel own pending leave |
| GET | `/leaves/calendar` | L2+ | Team leave calendar (dept) |
| GET | `/leaves/pending-approvals` | L3+ | Pending for own dept |

### 5.4 Payroll

| Method | Endpoint | Guard | Action |
|--------|----------|-------|--------|
| POST | `/payroll/runs` | isHRAdmin | Create payroll run (month/year) |
| POST | `/payroll/runs/:id/calculate` | isHRAdmin | Trigger payroll calculation |
| GET | `/payroll/runs` | L4+ or isHRAdmin | List all runs |
| GET | `/payroll/runs/:id` | L4+ or isHRAdmin | Run detail + summary |
| PUT | `/payroll/runs/:id/approve` | L4+ | Plant Head / Admin approval |
| GET | `/payroll/details/:emp_id` | L1+ | Own only if L1; dept if L3; all if isHRAdmin |
| GET | `/payroll/details/:emp_id/:month/:year` | L1+ | Monthly payslip |
| GET | `/payroll/payslip/:emp_id/:month/:year` | L1+ | PDF download |
| GET | `/payroll/bank-file/:run_id` | isHRAdmin or L4+ | NEFT bank file |
| GET | `/payroll/statutory/pf-ecr/:run_id` | isHRAdmin | EPFO ECR format |
| GET | `/payroll/statutory/esi/:run_id` | isHRAdmin | ESIC format |

### 5.5 Salary Structures

| Method | Endpoint | Guard | Action |
|--------|----------|-------|--------|
| GET | `/salary-structures/:emp_id` | isHRAdmin or L4+ | Current + history |
| POST | `/salary-structures` | isHRAdmin | Create/revise salary |

### 5.6 Leave Types Admin

| Method | Endpoint | Guard | Action |
|--------|----------|-------|--------|
| GET | `/leave-types` | L1+ | List |
| POST | `/leave-types` | isHRAdmin | Create |
| PUT | `/leave-types/:id` | isHRAdmin | Update |

### 5.7 Appraisals

| Method | Endpoint | Guard | Action |
|--------|----------|-------|--------|
| GET | `/appraisals/cycles` | L3+ | List cycles |
| POST | `/appraisals/cycles` | isHRAdmin | Create cycle |
| GET | `/appraisals/:cycle_id/goals/:emp_id` | L1+ | Own only if L1 |
| POST | `/appraisals/:cycle_id/goals` | isHRAdmin or L3+ | Set goals for employee |
| PUT | `/appraisals/goals/:id/self` | L1+ | Self-rate own goal |
| PUT | `/appraisals/goals/:id/manager` | L3+ | Manager rate (own dept) |
| GET | `/appraisals/summary/:emp_id/:cycle_id` | L3+ | Final rating summary |

### 5.8 Training

| Method | Endpoint | Guard | Action |
|--------|----------|-------|--------|
| GET | `/training` | L1+ | List programs |
| POST | `/training` | isHRAdmin or L3+ | Create program |
| POST | `/training/:id/enroll` | L2+ | Enroll employees |
| POST | `/training/:id/attendance` | L2+ | Mark training attendance |
| GET | `/training/certificates/:emp_id` | L1+ | Own certificates |
| GET | `/training/expiring` | isHRAdmin | Certs expiring in 30 days |

### 5.9 Documents

| Method | Endpoint | Guard | Action |
|--------|----------|-------|--------|
| GET | `/documents/:emp_id` | L1+ | Own only if L1 |
| POST | `/documents/upload` | L1+ | Upload own; HR for others |
| PUT | `/documents/:id/verify` | isHRAdmin | Verify document |
| DELETE | `/documents/:id` | isHRAdmin | Soft delete (is_active=false) |

### 5.10 Onboarding

| Method | Endpoint | Guard | Action |
|--------|----------|-------|--------|
| GET | `/onboarding/:emp_id` | L2+ | Checklist status |
| PUT | `/onboarding/task/:id` | L2+ | Mark task complete |
| POST | `/onboarding/:emp_id/create` | isHRAdmin | Create onboarding checklist |

### 5.11 Separations / Exit

| Method | Endpoint | Guard | Action |
|--------|----------|-------|--------|
| POST | `/separations` | L1+ or isHRAdmin | Initiate separation |
| GET | `/separations/:id` | isHRAdmin or L3+ | Detail |
| PUT | `/separations/:id/clearance/:dept` | L3+ | Dept clearance |
| GET | `/separations/:id/fnf` | isHRAdmin | F&F calculation |
| PUT | `/separations/:id/fnf/approve` | L4+ | Approve F&F |

---

## 6. Payroll Calculation Engine (Backend Logic)

```js
// backend/src/routes/hr.js — payroll calculate
async function calculatePayroll(runId, month, year) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const employees = await client.query(
      `SELECT e.*, ss.basic_monthly, ss.da_monthly, ss.hra_monthly,
              ss.conveyance, ss.medical_allow, ss.special_allow,
              ss.shift_allow, ss.pf_applicable, ss.esi_applicable, ss.tax_regime
       FROM employees e
       JOIN salary_structures ss ON ss.employee_id = e.id
         AND ss.effective_from <= $1
         AND (ss.effective_to IS NULL OR ss.effective_to >= $1)
       WHERE e.is_active = true`,
      [`${year}-${String(month).padStart(2,'0')}-01`]
    );

    for (const emp of employees.rows) {
      // 1. Attendance for month
      const att = await client.query(
        `SELECT COUNT(*) FILTER (WHERE status='Present' OR status='OT') AS present,
                COUNT(*) FILTER (WHERE status='Leave') AS leaves,
                COUNT(*) FILTER (WHERE status='Absent') AS absent,
                COALESCE(SUM(EXTRACT(HOUR FROM (out_time - in_time))),0) AS ot_hours
         FROM attendance
         WHERE employee_id = $1 AND date_part('month', date) = $2 AND date_part('year', date) = $3`,
        [emp.id, month, year]
      );
      const attRow = att.rows[0];
      const workingDays = 26; // configurable
      const paidDays = Math.min(parseFloat(attRow.present || 0), workingDays);
      const lopDays = Math.max(0, parseFloat(attRow.absent || 0));
      const otHours = parseFloat(attRow.ot_hours || 0);

      // 2. Per-day rate for LOP
      const dailyRate = emp.basic_monthly / 26;
      const lopDeduction = lopDays * dailyRate;

      // 3. OT rate (Factories Act: 2x hourly rate of basic)
      const hourlyRate = emp.basic_monthly / (26 * 8);
      const otAmount = otHours * hourlyRate * 2;

      // 4. Gross computation
      const basic    = emp.basic_monthly - (lopDays > 0 ? lopDeduction * 0.5 : 0);
      const da       = emp.da_monthly;
      const hra      = emp.hra_monthly;
      const convey   = emp.conveyance;
      const special  = emp.special_allow;
      const shiftAlw = emp.shift_allow;
      const gross    = basic + da + hra + convey + special + shiftAlw + otAmount;

      // 5. Deductions
      const pfBase       = Math.min(basic + da, 15000);
      const pfEmployee   = emp.pf_applicable ? Math.round(pfBase * 0.12) : 0;
      const pfEmployer   = emp.pf_applicable ? Math.round(pfBase * 0.12) : 0;
      const esiApply     = emp.esi_applicable || gross <= 21000;
      const esiEmployee  = esiApply ? Math.round(gross * 0.0075) : 0;
      const esiEmployer  = esiApply ? Math.round(gross * 0.0325) : 0;
      const pt           = getPT(gross, emp.pt_state);  // Maharashtra slab
      const tds          = 0; // compute from annual projected income — simplified here
      const totalDeductions = pfEmployee + esiEmployee + pt + tds;
      const netPay       = Math.round(gross - totalDeductions);

      // 6. Upsert payroll_details
      await client.query(
        `INSERT INTO payroll_details
           (run_id, employee_id, month, year, working_days, paid_days, lop_days, ot_hours,
            earnings, deductions, gross_salary, total_deductions, net_pay, pf_employer, esi_employer)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
         ON CONFLICT (run_id, employee_id) DO UPDATE SET
           paid_days=$6, lop_days=$7, ot_hours=$8,
           earnings=$9, deductions=$10, gross_salary=$11,
           total_deductions=$12, net_pay=$13, pf_employer=$14, esi_employer=$15`,
        [runId, emp.id, month, year, workingDays, paidDays, lopDays, otHours,
         JSON.stringify({ basic, da, hra, conveyance: convey, special, shiftAlw, ot_amount: otAmount, gross }),
         JSON.stringify({ pf_employee: pfEmployee, esi_employee: esiEmployee, pt, tds, total: totalDeductions }),
         gross, totalDeductions, netPay, pfEmployer, esiEmployer]
      );
    }

    // Update run totals
    await client.query(
      `UPDATE payroll_runs SET
         total_employees = (SELECT COUNT(*) FROM payroll_details WHERE run_id=$1),
         total_gross = (SELECT SUM(gross_salary) FROM payroll_details WHERE run_id=$1),
         total_deductions = (SELECT SUM(total_deductions) FROM payroll_details WHERE run_id=$1),
         total_net_pay = (SELECT SUM(net_pay) FROM payroll_details WHERE run_id=$1),
         status = 'Calculated', calculated_at = NOW()
       WHERE id = $1`,
      [runId]
    );

    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally { client.release(); }
}

// Professional Tax — Maharashtra slab
function getPT(grossMonthly, state) {
  if (state !== 'Maharashtra') return 0;
  if (grossMonthly <= 7500) return 0;
  if (grossMonthly <= 10000) return 175;
  return 200; // Feb special: 300
}
```

---

## 7. Leave Balance Engine

```js
// Accrue Earned Leave — run 1st of each month via cron
// EL accrual: 1 day per 20 working days = 15/year (Factories Act minimum)
async function accrueMonthlyEL(month, year) {
  const EL_TYPE_CODE = 'EL';
  const leaveType = await pool.query(`SELECT id FROM employee_leave_types WHERE code=$1`, [EL_TYPE_CODE]);
  const ltId = leaveType.rows[0].id;

  const employees = await pool.query(`SELECT id FROM employees WHERE is_active=true`);
  for (const emp of employees.rows) {
    await pool.query(
      `INSERT INTO employee_leave_balances (employee_id, year, leave_type_id, credited)
       VALUES ($1, $2, $3, 1.25)
       ON CONFLICT (employee_id, year, leave_type_id)
       DO UPDATE SET credited = employee_leave_balances.credited + 1.25`,
      [emp.id, year, ltId]
    );
  }
}

// Deduct leave on approval
async function deductLeave(employeeId, leaveTypeId, days, year) {
  const bal = await pool.query(
    `SELECT closing_balance FROM employee_leave_balances
     WHERE employee_id=$1 AND year=$2 AND leave_type_id=$3`,
    [employeeId, year, leaveTypeId]
  );
  if (!bal.rows.length || parseFloat(bal.rows[0].closing_balance) < days) {
    throw new Error('Insufficient leave balance — LOP will apply');
  }
  await pool.query(
    `UPDATE employee_leave_balances SET availed = availed + $1
     WHERE employee_id=$2 AND year=$3 AND leave_type_id=$4`,
    [days, employeeId, year, leaveTypeId]
  );
}
```

---

## 8. Onboarding Workflow

### State Machine
```
NewHireCreated → DocumentsCollected → BiometricEnrolled → InductionDone
              → ProbationStarted → ProbationReview → Confirmed
```

### Default 20-Task Checklist (auto-created on employee create)
Insert into `onboarding_checklist` with `completed=false`:

| seq | task_name | task_owner |
|-----|-----------|-----------|
| 1 | Original document verification | HR |
| 2 | Employee ID creation in system | HR |
| 3 | Biometric enrollment (fingerprint + face) | IT |
| 4 | ID card generation | HR |
| 5 | Bank account form submission | Finance |
| 6 | PF registration (UAN) | HR |
| 7 | ESI registration (if applicable) | HR |
| 8 | IT declaration collection | HR |
| 9 | Safety induction training | Safety |
| 10 | Department section induction | HOD |
| 11 | PPE issuance | Store |
| 12 | Tool/equipment handover | Store |
| 13 | IT asset issuance | IT |
| 14 | Locker/uniform assignment | Admin |
| 15 | Canteen registration | Admin |
| 16 | Reporting manager introduction | HOD |
| 17 | Buddy/mentor assignment | HOD |
| 18 | Plant tour | Safety |
| 19 | Emergency assembly point briefing | Safety |
| 20 | Joining report signed | HR |

Auto-trigger: create 20 rows in `onboarding_checklist` inside same ACID tx as `INSERT INTO employees`.

---

## 9. Offboarding / Exit Workflow

### State Machine
```
Initiated → Clearance (all depts) → ExitInterview → FnFCalculated → PlantHead_Approval → Closed
```

### F&F Auto-Calculation (server-side)

```js
async function calculateFnF(separationId) {
  const sep = await pool.query(`SELECT * FROM separation_records WHERE id=$1`, [separationId]);
  const emp = await pool.query(`SELECT e.*, ss.basic_monthly FROM employees e
    JOIN salary_structures ss ON ss.employee_id=e.id AND ss.effective_to IS NULL
    WHERE e.id=$1`, [sep.rows[0].employee_id]);

  const lastDay = sep.rows[0].last_working_day;
  const doj = emp.rows[0].doj;
  const serviceYears = (new Date(lastDay) - new Date(doj)) / (365.25 * 24 * 3600 * 1000);

  // Gratuity: eligible if >= 5 years. 15/26 × basic × years
  const gratuity = serviceYears >= 5
    ? Math.round((emp.rows[0].basic_monthly / 26) * 15 * Math.floor(serviceYears))
    : 0;

  // EL encashment
  const elBal = await pool.query(
    `SELECT closing_balance FROM employee_leave_balances
     WHERE employee_id=$1 AND year=EXTRACT(YEAR FROM NOW())
     AND leave_type_id=(SELECT id FROM employee_leave_types WHERE code='EL')`,
    [emp.rows[0].id]
  );
  const elDays = parseFloat(elBal.rows[0]?.closing_balance || 0);
  const elEncashment = Math.round((emp.rows[0].basic_monthly / 26) * elDays);

  return { gratuity, elEncashment, totalFnF: gratuity + elEncashment };
}
```

---

## 10. Frontend Pages (HRMS) — `frontend/src/pages/`

| Page File | Route Key | Role Guard | Description |
|-----------|----------|-----------|-------------|
| `HR.jsx` | `hr` | L1+ | HRMS hub — tabs based on role |
| `MyProfile.jsx` | `my-profile` | L1 | Self-service: own details |
| `MyAttendance.jsx` | `my-attendance` | L1 | Own attendance + regularize |
| `MyLeaves.jsx` | `my-leaves` | L1 | Own leave balance + apply |
| `MyPayslip.jsx` | `my-payslip` | L1 | Own payslips + download |
| `TeamAttendance.jsx` | `team-attendance` | L2+ | Mark/view team attendance |
| `LeaveApprovals.jsx` | `leave-approvals` | L3+ | Approve/reject team leaves |
| `Appraisal.jsx` | `appraisal` | L1+ | Goals + ratings (role-gated tabs) |
| `Training.jsx` | `training` | L1+ | Programs, enroll, certs |
| `PayrollMgmt.jsx` | `payroll-mgmt` | isHRAdmin or L4+ | Run + approve payroll |
| `HRAdmin.jsx` | `hr-admin` | isHRAdmin | Employee CRUD, documents, onboarding |

### Sidebar Additions (add to Sidebar.jsx NAV array)

```js
// Add group "HR & People" — visible only if logged in (L1+)
// Sub-items shown based on role_level + dept_code

// L1 Employee (everyone)
{ key: 'my-profile',    label: 'My Profile',     icon: '👤', group: 'HR & People', minLevel: 1 },
{ key: 'my-attendance', label: 'My Attendance',  icon: '📅', group: 'HR & People', minLevel: 1 },
{ key: 'my-leaves',     label: 'My Leaves',      icon: '🌴', group: 'HR & People', minLevel: 1 },
{ key: 'my-payslip',    label: 'My Payslip',     icon: '💰', group: 'HR & People', minLevel: 1 },

// L2+ Supervisor
{ key: 'team-attendance', label: 'Team Attendance', icon: '📋', group: 'HR & People', minLevel: 2 },

// L3+ Dept Head
{ key: 'leave-approvals', label: 'Leave Approvals', icon: '✅', group: 'HR & People', minLevel: 3 },
{ key: 'appraisal',       label: 'Appraisal',        icon: '📊', group: 'HR & People', minLevel: 3 },
{ key: 'training',        label: 'Training',          icon: '🎓', group: 'HR & People', minLevel: 2 },

// HR Admin (dept_code=HR && L3+) or Admin (L5)
{ key: 'hr-admin',      label: 'HR Master',      icon: '🏢', group: 'HR & People', hrAdminOnly: true },
{ key: 'payroll-mgmt',  label: 'Payroll',        icon: '🧮', group: 'HR & People', minLevel: 4, orHRAdmin: true },
```

```jsx
// Sidebar filter logic
const isHRAdmin = user.dept_code === 'HR' && user.role_level >= 3;
const navItems = ALL_NAV.filter(item => {
  if (item.hrAdminOnly) return isHRAdmin || user.role_level >= 5;
  if (item.orHRAdmin) return isHRAdmin || user.role_level >= (item.minLevel || 1);
  return user.role_level >= (item.minLevel || 1);
});
```

---

## 11. JWT Token Extension

Add to JWT payload on login (extend `auth.js`):

```js
// In POST /api/auth/login, after user fetch
const empRecord = await pool.query(
  `SELECT e.id as emp_id, e.is_dept_head, e.employment_type, e.grade
   FROM employees e WHERE e.user_id = $1 AND e.is_active = true`,
  [user.id]
);

const token = jwt.sign({
  id:            user.id,
  name:          user.name,
  email:         user.email,
  role:          user.role_name,
  role_level:    user.role_level,
  dept_code:     user.dept_code,
  department_id: user.department_id,
  shift:         user.shift,
  // HRMS additions:
  emp_id:        empRecord.rows[0]?.emp_id || null,
  is_dept_head:  empRecord.rows[0]?.is_dept_head || false,
  is_hr_admin:   user.dept_code === 'HR' && user.role_level >= 3,
}, process.env.JWT_SECRET, { expiresIn: '12h' });
```

---

## 12. Sync Logic with Existing Modules

| Event | Source Module | HRMS Action |
|-------|-------------|-------------|
| `indent.raised_by` | PIIMAS | Linked to `employees.user_id` → shows on employee timeline |
| `maintenance_logs.performed_by` | Maintenance | Linked → employee training record auto-suggests |
| `quality_tests.tested_by` | Quality | Linked → competency tracking |
| `attendance.shift_type` | HR | Must align with Production `shifts` shift_type values |
| `payroll_details` generated | HR | Post journal entry to Finance module (AR/AP) |
| `employee.separation` | HR | Auto-deactivate `users.is_active = false` on last working day |
| `training.is_mandatory` | HR | Safety induction required before biometric activation |

---

## 13. Business Rules — NON-NEGOTIABLE

1. **NEVER delete employees** — `is_active=false` only. Retain records 30+ years.
2. **NEVER compute payslip on frontend** — all salary math server-side.
3. **NEVER skip audit_log** on: employee edit, salary revision, payroll run, leave approval, document verify.
4. **NEVER allow payroll run** unless attendance is locked for the month (`attendance_lock` table).
5. **NEVER allow L1 employee** to see other employees' salary, PAN, Aadhaar, bank details.
6. **NEVER allow dept head** to approve leaves/attendance of other departments (check `record.employee.department_id === req.user.department_id` — unless `is_hr_admin || role_level >= 4`).
7. **NEVER allow payroll approval** below L4 (Plant Head) — even HR Admin can only prepare, not approve.
8. **NEVER store biometric templates** in raw form — AES-256 encrypted only.
9. **NEVER allow leave** against a locked payroll month without HR override.
10. **NEVER allow F&F** if ANY clearance item is pending.

---

## 14. Phase Build Order — HRMS (Ph16)

| Phase | Module | Status |
|-------|--------|--------|
| Ph16-A | DB migration (migration_hrms_ph16.sql) — ALTER employees + 12 new tables | ⬜ Todo |
| Ph16-B | Backend routes expansion — attendance regularize, leave types, leave applications | ⬜ Todo |
| Ph16-C | Payroll engine routes — salary structures, payroll runs, payslip | ⬜ Todo |
| Ph16-D | Frontend L1 ESS — MyProfile, MyAttendance, MyLeaves, MyPayslip | ⬜ Todo |
| Ph16-E | Frontend L2/L3 — TeamAttendance, LeaveApprovals, Onboarding | ⬜ Todo |
| Ph16-F | Frontend HR Admin — HRAdmin CRUD, PayrollMgmt, Documents | ⬜ Todo |
| Ph16-G | Appraisal module — cycles, goals, self-rating, manager rating | ⬜ Todo |
| Ph16-H | Training module — programs, enrollment, certificates | ⬜ Todo |
| Ph16-I | Exit module — separations, clearance, F&F | ⬜ Todo |
| Ph16-J | JWT extension + sidebar HRMS group | ⬜ Todo |
| Ph16-K | Leave balance accrual cron + payroll cron hooks | ⬜ Todo |
| Ph16-L | Reports — headcount, payroll register, leave utilization, attrition | ⬜ Todo |

---

## 15. HRMS Reports

| Report | Endpoint | Key Data |
|--------|----------|---------|
| Headcount | GET /api/hr/reports/headcount | By dept, grade, employment type |
| Attendance Summary | GET /api/hr/reports/attendance | By dept, month, status breakdown |
| Payroll Register | GET /api/hr/reports/payroll-register | All employees, month/year, earnings/deductions |
| Leave Utilization | GET /api/hr/reports/leave-utilization | By type, employee, dept |
| Attrition | GET /api/hr/reports/attrition | By separation type, dept, month |
| Manpower Cost/Ton | GET /api/hr/reports/cost-per-ton | Total payroll ÷ production MT |
| Training Compliance | GET /api/hr/reports/training | Mandatory vs completed per dept |
| PF ECR | GET /api/hr/payroll/statutory/pf-ecr | EPFO filing format |
| ESI Monthly | GET /api/hr/payroll/statutory/esi | ESIC filing format |

All reports: `?from=YYYY-MM-DD&to=YYYY-MM-DD` + `?dept=&format=pdf|excel|csv`.

---

## 16. Security Notes (HRMS-specific)

- Payroll data (`payroll_details.earnings`, `.deductions`) — never log to console
- PAN, Aadhaar, bank_account — mask in API responses for L1: `****1234`
- Document downloads — signed URL or auth-gated stream — never direct file path
- Salary structure — only isHRAdmin or L4+ can GET; L1 can only see own net_pay
- Audit log EVERY: salary revision, role change, payroll run, leave override, document verify
- All HR mutations go through ACID transactions — partial payroll forbidden
