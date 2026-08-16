# Phase 11 — HR

Route: `/api/hr` → `backend/src/routes/hr.js`
Auth pattern: `{ auth, requireLevel }` from `../middleware/auth` (legacy — not helpers.js).

---

## DB Tables

### employees (exact columns)
```
id              SERIAL PRIMARY KEY
employee_code   VARCHAR(30)
name            VARCHAR(100) NOT NULL
department_id   INTEGER FK → departments.id
designation     VARCHAR(100)
doj             DATE                         -- date of joining
dob             DATE                         -- date of birth
gender          VARCHAR(10)
mobile          VARCHAR(15)
email           VARCHAR(100)
aadhar          VARCHAR(20)
pan             VARCHAR(15)
pf_number       VARCHAR(30)
esic_number     VARCHAR(30)
bank_account    VARCHAR(30)
bank_name       VARCHAR(100)
ifsc            VARCHAR(15)
basic_salary    NUMERIC(12,2) DEFAULT 0
user_id         INTEGER FK → users.id        -- link to login account, nullable
is_active       BOOLEAN DEFAULT true
created_at      TIMESTAMP DEFAULT NOW()
```
Total: 20 columns (18 form fields + id + created_at).

### attendance (exact columns)
```
id           SERIAL PRIMARY KEY
employee_id  INTEGER NOT NULL FK → employees.id
date         DATE NOT NULL
shift_type   VARCHAR(20)     -- 'Day'|'Night'|'General'
status       VARCHAR(20)     -- CHECK IN ('Present','Absent','Half Day','Leave','Holiday','OT')
in_time      TIMESTAMP
out_time     TIMESTAMP
hours_worked NUMERIC(5,2)
remarks      TEXT
created_at   TIMESTAMP DEFAULT NOW()
UNIQUE (employee_id, date)   -- upsert key
```
Index: `idx_attendance_date` on `attendance(date)`.

Status valid values: `Present | Absent | Half Day | Leave | Holiday | OT`
— OT = Overtime. Must include OT in dropdowns.

---

## 1. EMPLOYEES

### List
`GET /api/hr/employees`
Auth: any authenticated user
Params: `?dept=&search=&is_active=true&page=1&limit=30`

```sql
SELECT e.id, e.employee_code AS "employeeCode", e.name, e.designation,
       e.mobile, e.email, e.doj, e.gender,
       e.basic_salary AS "basicSalary",
       e.is_active AS "isActive",
       e.user_id AS "userId",
       d.name AS "deptName"
FROM employees e
LEFT JOIN departments d ON d.id=e.department_id
[WHERE e.is_active=$N]
  [AND e.department_id=$N]
  [AND (e.name ILIKE $N OR e.employee_code ILIKE $N)]
ORDER BY e.name ASC
LIMIT $N OFFSET $N
```

Response: `{ success: true, data: [...], total: N }`

### Detail
`GET /api/hr/employees/:id`

```sql
SELECT e.*, d.name AS "deptName"
FROM employees e LEFT JOIN departments d ON d.id=e.department_id
WHERE e.id=$1
```

### Create
`POST /api/hr/employees`
Auth: `requireLevel(3)` — Manager+

Form fields → DB columns:
| UI Label | DB Column | Type | Notes |
|----------|-----------|------|-------|
| Employee Code | employee_code | VARCHAR(30) | optional |
| Name | name | VARCHAR(100) | required |
| Department | department_id | FK | optional dropdown |
| Designation | designation | VARCHAR(100) | optional |
| Date of Joining | doj | DATE | optional |
| Date of Birth | dob | DATE | optional |
| Gender | gender | VARCHAR(10) | optional |
| Mobile | mobile | VARCHAR(15) | optional |
| Email | email | VARCHAR(100) | optional |
| Aadhar | aadhar | VARCHAR(20) | optional |
| PAN | pan | VARCHAR(15) | optional |
| PF Number | pf_number | VARCHAR(30) | optional |
| ESIC Number | esic_number | VARCHAR(30) | optional |
| Bank Account | bank_account | VARCHAR(30) | optional |
| Bank Name | bank_name | VARCHAR(100) | optional |
| IFSC | ifsc | VARCHAR(15) | optional |
| Basic Salary | basic_salary | NUMERIC(12,2) | default 0 |
| User ID | user_id | FK → users.id | optional — link to login |

```sql
INSERT INTO employees
  (employee_code,name,department_id,designation,doj,dob,gender,
   mobile,email,aadhar,pan,pf_number,esic_number,
   bank_account,bank_name,ifsc,basic_salary,user_id,is_active)
VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,true)
RETURNING *
```

### Update
`PUT /api/hr/employees/:id`
Auth: `requireLevel(3)`
Same fields as create + `is_active` boolean.

### Deactivate
Set `is_active=false` via PUT. NEVER hard-delete.

---

## 2. ATTENDANCE

### List
`GET /api/hr/attendance`
Auth: any authenticated user
Params: `?date=YYYY-MM-DD&employee_id=&page=1&limit=50`
Default date: today.

```sql
SELECT a.id, a.date,
       a.shift_type AS "shiftType",
       a.status,   -- Present|Absent|Half Day|Leave|Holiday|OT
       a.in_time AS "inTime", a.out_time AS "outTime",
       a.hours_worked AS "hoursWorked", a.remarks,
       e.name AS "employeeName", e.employee_code AS "employeeCode",
       d.name AS "deptName"
FROM attendance a
JOIN employees e ON e.id=a.employee_id
LEFT JOIN departments d ON d.id=e.department_id
WHERE a.date=$1 [AND a.employee_id=$N]
ORDER BY e.name ASC
LIMIT $N OFFSET $N
```

### Mark Attendance — Single (UPSERT)
`POST /api/hr/attendance`
Auth: `requireLevel(2)` — Supervisor+

UNIQUE constraint `(employee_id, date)` → upsert, never error on re-mark.

```sql
INSERT INTO attendance
  (employee_id, date, shift_type, status, in_time, out_time, hours_worked, remarks)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
ON CONFLICT (employee_id, date) DO UPDATE SET
  shift_type=$3, status=$4, in_time=$5, out_time=$6, hours_worked=$7, remarks=$8
RETURNING *
```

`hours_worked` — server-side only:
```js
let hours = null;
if (in_time && out_time) hours = (new Date(out_time) - new Date(in_time)) / 3600000;
```
Never accept hours from frontend.

Form fields:
| UI Label | DB Column | Valid values |
|----------|-----------|-------------|
| Employee | employee_id | FK → employees.id |
| Date | date | YYYY-MM-DD |
| Shift Type | shift_type | Day / Night / General |
| Status | status | Present / Absent / Half Day / Leave / Holiday / **OT** |
| In Time | in_time | datetime, optional |
| Out Time | out_time | datetime, must be > in_time |
| Remarks | remarks | optional |

### Bulk Attendance
`POST /api/hr/attendance/bulk`
Auth: `requireLevel(2)`
Body: `{ date, shift_type, records: [{ employee_id, status }] }`

ACID transaction — all rows in one BEGIN/COMMIT:
```js
const client = await pool.connect();
await client.query('BEGIN');
for (const r of records) {
  await client.query(
    `INSERT INTO attendance (employee_id, date, shift_type, status)
     VALUES ($1,$2,$3,$4)
     ON CONFLICT (employee_id, date) DO UPDATE SET shift_type=$3, status=$4`,
    [r.employee_id, date, shift_type, r.status]
  );
}
await client.query('COMMIT');
```
One failure → entire batch rolls back.

### Attendance Summary
`GET /api/hr/attendance/summary`
Params: `?date=YYYY-MM-DD`

```sql
SELECT status, COUNT(*) AS count
FROM attendance
WHERE date=$1
GROUP BY status
```
Plus separately: `SELECT COUNT(*) FROM employees WHERE is_active=true` → `totalActive`.

Response:
```json
{
  "data": {
    "date": "2026-06-28",
    "byStatus": [
      { "status": "Present", "count": 45 },
      { "status": "Absent",  "count": 3  },
      { "status": "OT",      "count": 2  }
    ],
    "totalActive": 50
  }
}
```

---

## 3. Shift Types
| Value | Hours |
|-------|-------|
| Day | 06:00–14:00 |
| Night | 22:00–06:00 |
| General | 09:00–17:00 |

`General` added by `db/phase3_migration.sql` (ALTER TABLE shifts ADD CONSTRAINT …).

---

## 4. Business Rules

- NEVER delete employees — `is_active=false` only
- Re-marking same employee+date updates via ON CONFLICT — no error thrown
- `hours_worked` always server-computed — never accept from client
- `attendance.status` has 6 valid values: `Present | Absent | Half Day | Leave | Holiday | OT`
- `employees.user_id` links to login account — optional; NULL if employee has no login
- Department dropdown source: `GET /api/admin/departments` or `GET /api/users/departments`
