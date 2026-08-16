# Phase 9 — Utility & HR Modules

---

## PART A: UTILITY MODULE

## Scope
Hourly/shift utility readings for power, steam, water, coal. Derived KPIs for efficiency monitoring.

## DB Tables
- `utility_readings` — one row per shift per reading time

---

## 1. UTILITY READING ENTRY

### Reading List
**API:** GET `/api/utility/readings?date=&shift=`

| Column | DB Source |
|--------|-----------|
| Date | utility_readings.date |
| Shift | utility_readings.shift_type |
| Reading Time | utility_readings.reading_time |
| Grid Power (units) | utility_readings.power_units |
| DG Power (units) | utility_readings.dg_units |
| Total Power | power_units + dg_units |
| Steam (MT) | utility_readings.steam_generated_mt |
| Coal (kg) | utility_readings.coal_consumed_kg |
| Fresh Water (KL) | utility_readings.fresh_water_kl |
| Recorded By | users.name |

### Utility Reading Form → `utility_readings` table
| UI Label | Input | DB Column | Validation |
|----------|-------|-----------|------------|
| Date | date | date | ≤ today |
| Shift | dropdown | shift_type | Day / Night |
| Reading Time | datetime | reading_time | required |
| Grid Power (units) | number | power_units | ≥ 0 |
| DG Power (units) | number | dg_units | ≥ 0 |
| Steam Generated (MT) | number | steam_generated_mt | ≥ 0 |
| Coal Consumed (kg) | number | coal_consumed_kg | ≥ 0 |
| Boiler Pressure (bar) | number | boiler_pressure | 0–20 |
| Boiler Temp (°C) | number | boiler_temp | 0–250 |
| Fresh Water (KL) | number | fresh_water_kl | ≥ 0 |
| Process Water (KL) | number | process_water_kl | ≥ 0 |
| Air Pressure (bar) | number | air_pressure | 0–15 |
| ETP Inlet (KL) | number | etp_inlet_kl | ≥ 0 |
| ETP Outlet (KL) | number | etp_outlet_kl | ≥ 0 |
| Notes | textarea | notes | optional |
| Recorded By | auto (req.user) | recorded_by | — |

**Buttons:**
- **Save Reading** → POST `/api/utility/readings`
- **Edit** → PUT `/api/utility/readings/:id` (same shift only)

---

## 2. UTILITY DASHBOARD

**API:** GET `/api/utility/dashboard?date=`

### KPI Cards (today)
| Widget | DB Source | Unit |
|--------|-----------|------|
| Total Power | SUM(power_units + dg_units) WHERE date=today | Units |
| Steam Generated | SUM(steam_generated_mt) WHERE date=today | MT |
| Coal Consumed | SUM(coal_consumed_kg) WHERE date=today | KG |
| Fresh Water | SUM(fresh_water_kl) WHERE date=today | KL |
| Steam Efficiency | SUM(steam_mt)/SUM(coal_kg) WHERE date=today | MT/MT (target >2.5) |
| Power Intensity | total_power / net_production_kg WHERE date=today | units/kg |

**Derived KPIs (server-side, never stored):**
```js
steam_efficiency  = steam_generated_mt / coal_consumed_kg;       // target: >2.5
power_intensity   = (power_units + dg_units) / net_production_kg; // benchmark per plant
specific_water    = fresh_water_kl / net_production_mt;           // KL/MT
etp_recovery_pct  = etp_outlet_kl / etp_inlet_kl * 100;
```

### Trend Charts (last 30 days)
- Power consumption (grid vs DG): dual bar chart
- Steam efficiency: line chart with target line at 2.5
- Specific water: line chart

---

## PART B: HR MODULE

## Scope
Employee master, shift assignment, attendance marking, leave tracking.

## DB Tables
- `employees` — employee master
- `attendance` — daily attendance records
- Linked to: `users` (employee may also be a system user), `departments`, `shifts`

---

## 3. EMPLOYEE MASTER

### Employee List
**API:** GET `/api/hr/employees?dept=&status=`

| Column | DB Source |
|--------|-----------|
| Employee Code | employees.employee_code |
| Name | employees.name |
| Department | departments.name |
| Designation | employees.designation |
| Shift | employees.default_shift |
| Phone | employees.phone |
| Status | employees.is_active |

### Employee Form → `employees` table
| UI Label | Input | DB Column | Validation |
|----------|-------|-----------|------------|
| Employee Code | text (auto) | employee_code | unique, auto-gen EMP-NNNN |
| Full Name | text | name | required |
| Father/Husband Name | text | guardian_name | optional |
| Date of Birth | date | dob | ≥ 18 years ago |
| Gender | dropdown | gender | Male / Female / Other |
| Phone | tel | phone | 10 digits |
| Alt Phone | tel | alt_phone | optional |
| Email | email | email | optional |
| Address | textarea | address | required |
| Emergency Contact | text | emergency_contact | optional |
| Department | dropdown | department_id → departments.id | required |
| Designation | text | designation | required |
| Date of Joining | date | date_of_joining | ≤ today |
| Employment Type | dropdown | employment_type | Permanent / Contract / Casual / Trainee |
| Default Shift | dropdown | default_shift | Day / Night / General |
| PAN | text | pan | 10-char |
| Aadhaar | text | aadhaar | 12 digits, masked display |
| Bank Account | text | bank_account | optional |
| IFSC | text | ifsc | optional |
| PF Account | text | pf_account | optional |
| ESI Number | text | esi_number | optional |
| Is Active | toggle | is_active | default true |
| System User | dropdown (opt) | user_id → users.id | link to login user |

**Buttons:**
- **Save Employee** → POST/PUT `/api/hr/employees`
- **Mark Inactive** → PUT with `{is_active: false, last_working_day: today}`
- **View Attendance** → redirect to attendance filtered by employee_id

---

## 4. ATTENDANCE

### Attendance List
**API:** GET `/api/hr/attendance?date=&employee_id=&dept=&status=`

| Column | DB Source |
|--------|-----------|
| Employee | employees.name |
| Date | attendance.date |
| Shift | attendance.shift_type |
| In Time | attendance.in_time |
| Out Time | attendance.out_time |
| Working Hours | out_time - in_time |
| OT Hours | overtime_hours |
| Status | attendance.status |

### Attendance Status Options
`Present` / `Absent` / `Half Day` / `Leave` / `Holiday` / `Weekly Off`

### Mark Attendance Form → `attendance` table
**UNIQUE(employee_id, date)** — upsert on conflict

| UI Label | Input | DB Column | Validation |
|----------|-------|-----------|------------|
| Date | date | date | ≤ today |
| Employee | dropdown | employee_id → employees.id | required |
| Shift | dropdown | shift_type | Day / Night / General |
| Status | dropdown | status | required |
| In Time | time | in_time | if status=Present/Half Day |
| Out Time | time | out_time | > in_time if provided |
| OT Hours | number | overtime_hours | ≥ 0 |
| Remarks | text | remarks | optional |

**Bulk Attendance (common workflow):**
- Select Date + Department → Load all employees
- Table: each employee row, Status dropdown, In/Out time columns
- **Submit All** → POST `/api/hr/attendance/bulk` — upsert all rows in single TX

**Buttons:**
- **Save Attendance** → POST `/api/hr/attendance` (single)
- **Bulk Mark** → POST `/api/hr/attendance/bulk`
- **Mark Holiday** → PUT `/api/hr/attendance/mark-holiday` with `{date}` — sets all to Holiday

### Attendance Summary
**API:** GET `/api/hr/attendance/summary?month=&dept=`
Columns: Employee, Present Days, Absent, Leave, OT Hours, Attendance %
