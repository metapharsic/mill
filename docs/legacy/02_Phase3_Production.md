# Phase 3 — Production MES Module

## Scope
Shift management, reel tracking, downtime logging, OEE dashboard, production summary.

## DB Tables
- `shifts` — one row per shift per machine per day
- `reels` — one row per paper reel produced
- `downtime_entries` — one row per downtime event
- `production_summary` — daily/shift aggregate cache
- `machines` — master (read-only here)
- `grades` — master (read-only here)

---

## 1. SHIFT MANAGEMENT

### Shift List
**API:** GET `/api/production/shifts?date=&machine_id=`
**DB:** `SELECT s.*, m.name as machine, u.name as supervisor, COUNT(r.id) as reel_count, SUM(r.weight_kg) as total_weight FROM shifts s JOIN machines m ON m.id=s.machine_id JOIN users u ON u.id=s.supervisor_id LEFT JOIN reels r ON r.shift_id=s.id GROUP BY s.id, m.name, u.name ORDER BY s.date DESC, s.start_time DESC`

| Column | DB Source |
|--------|-----------|
| Date | shifts.date |
| Shift Type | shifts.shift_type |
| Machine | machines.name |
| Supervisor | users.name |
| Start Time | shifts.start_time |
| End Time | shifts.end_time |
| Reels | COUNT(reels) |
| Production (MT) | SUM(reels.weight_kg)/1000 |
| Status | shifts.status |

### Open Shift Form → `shifts` table
| UI Label | Input | DB Column | Validation |
|----------|-------|-----------|------------|
| Date | date | date | required, not future |
| Shift Type | dropdown | shift_type | Day / Night |
| Machine | dropdown | machine_id → machines.id | required, is_active=true |
| Supervisor | dropdown | supervisor_id → users.id | role_level ≥ 2 |
| Start Time | datetime | start_time | required |
| Opening Meter Reading | number | opening_meter | optional |
| Remarks | textarea | remarks | optional |

**Dropdowns:**
- Machine: GET `/api/production/machines` → `{id, name, code}`
- Supervisor: GET `/api/users?role_level_min=2` → `{id, name}`

**Buttons:**
- **Open Shift** → POST `/api/production/shifts` — creates shift, status=`Open`
- **Close Shift** → PUT `/api/production/shifts/:id/close` — sets end_time, status=`Closed`, triggers production_summary insert
- **View Reels** → filters reel list by shift_id

### Close Shift — additional fields
| UI Label | Input | DB Column |
|----------|-------|-----------|
| End Time | datetime | end_time |
| Closing Meter Reading | number | closing_meter |
| Total Break Time (min) | number | total_break_min |
| Summary Remarks | textarea | closing_remarks |

---

## 2. REEL TRACKING

### Reel List
**API:** GET `/api/production/reels?date=&shift_id=&machine_id=&grade_id=&status=`
**DB:** Complex join with shifts, machines, grades, users

| Column | DB Source | Filter |
|--------|-----------|--------|
| Reel Number | reels.reel_number | search |
| Machine | machines.name | dropdown |
| Grade | grades.name | dropdown |
| GSM | reels.gsm | range |
| Width (mm) | reels.width_mm | — |
| Weight (kg) | reels.weight_kg | — |
| Efficiency % | reels.efficiency_pct | — |
| Moisture % | reels.moisture_pct | — |
| Start Time | reels.start_time | date |
| Status | reels.status | dropdown |
| QC Status | reels.quality_status | dropdown |

### Reel Status Filter Options
`In Production` / `QC Pending` / `QC Done` / `In Warehouse` / `Dispatched` / `Rejected`

### Save Reel Form → `reels` table

**Section: Identification (auto-filled)**
| UI Label | Input | DB Column | Auto Source |
|----------|-------|-----------|-------------|
| Reel Number | text (read-only) | reel_number | server: `MK-YYYYMMDD-PM{n}-NNNN` |
| Shift | dropdown | shift_id → shifts.id | open shifts for today |
| Machine | dropdown (locked if shift selected) | machine_id | from shift |
| Operator | dropdown | operator_id → users.id | role=Operator |

**Section: Paper Specification**
| UI Label | Input | DB Column | Validation |
|----------|-------|-----------|------------|
| Grade | dropdown | grade_id → grades.id | required |
| GSM | number | gsm | 10–500, required |
| Width (mm) | number | width_mm | 100–10000 |
| Length (m) | number | length_m | optional |

**Section: Production Data**
| UI Label | Input | DB Column | Validation |
|----------|-------|-----------|------------|
| Weight (kg) | number | weight_kg | > 0, required |
| Start Time | datetime | start_time | required |
| End Time | datetime | end_time | > start_time |
| Production Time (min) | number (auto-computed) | production_time_min | = (end-start) in minutes |
| Break Time (min) | number | break_time_min | ≥ 0 |
| Downtime (min) | number | downtime_min | ≥ 0 |
| Efficiency % | number (auto) | efficiency_pct | computed server-side |
| Speed (mpm) | number | speed_mpm | optional |
| Reject % | number | reject_pct | 0–100 |

**Section: Process Parameters**
| UI Label | Input | DB Column | Validation |
|----------|-------|-----------|------------|
| Moisture % | number | moisture_pct | 0–20 |
| Steam Pressure (bar) | number | steam_pressure | 0–20 |
| Steam Consumed (kg) | number | steam_consumption | ≥ 0 |
| Water Consumed (KL) | number | water_consumption | ≥ 0 |

**Section: Linking (optional)**
| UI Label | Input | DB Column |
|----------|-------|-----------|
| Sales Order | dropdown (opt) | sales_order_id → sales_orders.id |
| Remarks | textarea | remarks |

**Efficiency auto-compute (show live):**
```
efficiency_pct = ((production_time_min - break_time_min - downtime_min) / production_time_min) * 100
```

**Buttons:**
- **Save Reel** → POST `/api/production/reels` — sets `status='QC Pending'`
- **Edit Reel** → PUT `/api/production/reels/:id` — only if `status='In Production'` or `status='QC Pending'`
- **Send to QC** → PUT `/api/production/reels/:id/send-qc` — `status → 'QC Pending'`
- **Print Barcode** → client-side: generate barcode from reel_number

---

## 3. DOWNTIME LOG

### Downtime List
**API:** GET `/api/production/downtime?date=&machine_id=&category=`

| Column | DB Source |
|--------|-----------|
| Machine | machines.name |
| Shift | shifts.shift_type + shifts.date |
| Reel (opt) | reels.reel_number |
| Start Time | downtime_entries.start_time |
| End Time | downtime_entries.end_time |
| Duration (min) | downtime_entries.duration_min (computed: end-start) |
| Category | downtime_entries.category |
| Reason | downtime_entries.reason |

### Log Downtime Form → `downtime_entries` table
| UI Label | Input | DB Column | Validation |
|----------|-------|-----------|------------|
| Machine | dropdown | machine_id → machines.id | required |
| Shift | dropdown | shift_id → shifts.id | open shifts |
| Reel (opt) | dropdown | reel_id → reels.id | nullable, filtered by machine |
| Start Time | datetime | start_time | required |
| End Time | datetime | end_time | nullable (blank = ongoing) |
| Category | dropdown | category | Mechanical / Electrical / Process / Quality / Changeover / Planned / Other |
| Reason | textarea | reason | required |
| Corrective Action | textarea | corrective_action | optional |

**Buttons:**
- **Log Downtime** → POST `/api/production/downtime`
- **Close Downtime** → PUT `/api/production/downtime/:id/close` — sets end_time
- **Link to Maintenance** → POST `/api/maintenance/logs` (cross-module)

---

## 4. PRODUCTION SUMMARY DASHBOARD

**API:** GET `/api/production/summary?date=&month=&machine_id=`

### KPI Cards (top row)
| Widget | DB Source | Formula |
|--------|-----------|---------|
| Today Production (MT) | reels | SUM(weight_kg)/1000 WHERE date=today |
| Month Production (MT) | reels | SUM(weight_kg)/1000 WHERE date>=month_start |
| Today Reels | reels | COUNT WHERE date=today |
| Avg Efficiency % | reels | AVG(efficiency_pct) WHERE date=today |
| Today Downtime (hrs) | downtime_entries | SUM(duration_min)/60 WHERE date=today |
| OEE % (today) | computed | Availability × Performance × Quality |

### Shift Breakdown Table
| Column | Source |
|--------|--------|
| Shift | shifts.shift_type |
| Machine | machines.name |
| Reels | COUNT |
| Production (MT) | SUM |
| Avg Efficiency | AVG |
| Downtime (min) | SUM |

### Machine-wise Production Chart
Data: GET `/api/production/summary?group=machine` → `[{machine, weight_kg, reel_count}]`

### Grade-wise Production Chart
Data: GET `/api/production/summary?group=grade` → `[{grade, weight_kg, reel_count}]`

---

## 5. OEE DASHBOARD

**API:** GET `/api/production/oee?machine_id=&date_from=&date_to=`

Computation (server-side, never stored):
```sql
WITH shift_data AS (
  SELECT
    machine_id,
    SUM(EXTRACT(EPOCH FROM (end_time - start_time))/60) AS shift_min,
    SUM(total_break_min) AS break_min
  FROM shifts WHERE date BETWEEN $1 AND $2 GROUP BY machine_id
),
downtime_data AS (
  SELECT machine_id, SUM(duration_min) AS total_downtime
  FROM downtime_entries WHERE DATE(start_time) BETWEEN $1 AND $2 GROUP BY machine_id
),
reel_data AS (
  SELECT machine_id,
    AVG(speed_mpm) AS avg_speed,
    SUM(weight_kg) AS total_weight,
    SUM(reject_pct * weight_kg / 100) AS reject_weight
  FROM reels WHERE DATE(start_time) BETWEEN $1 AND $2 GROUP BY machine_id
)
SELECT
  m.name,
  (s.shift_min - COALESCE(d.total_downtime,0)) / s.shift_min AS availability,
  r.avg_speed / m.ideal_speed_mpm AS performance,
  (r.total_weight - r.reject_weight) / r.total_weight AS quality
FROM machines m JOIN shift_data s ON s.machine_id=m.id ...
```

Display: Gauge chart per machine (0–100%), table with A × P × Q breakdown.
