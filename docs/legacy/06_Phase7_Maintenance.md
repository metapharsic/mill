# Phase 7 — Maintenance Module

## Scope
Preventive maintenance (PM) scheduling, breakdown logging, MTTR/MTBF tracking, spare parts consumption.

## DB Tables
- `maintenance_schedule` — PM plan per machine
- `maintenance_logs` — actual maintenance records
- `downtime_entries` — linked on breakdown (cross-module)
- `materials` / `stock_ledger` — spare parts deduction

---

## 1. PM SCHEDULE

### PM Schedule List
**API:** GET `/api/maintenance/schedule?machine_id=&status=`

| Column | DB Source | Filter |
|--------|-----------|--------|
| Machine | machines.name | dropdown |
| Task | maintenance_schedule.task_name | — |
| Frequency | maintenance_schedule.frequency | dropdown |
| Last Done | maintenance_schedule.last_done | — |
| Next Due | maintenance_schedule.next_due | date range |
| Status | maintenance_schedule.status | dropdown |
| Assigned To | users.name | — |

**Next Due Alert:** Highlight rows where `next_due ≤ today + 7` in orange. `next_due < today` in red.

### PM Status Options
`Scheduled` / `Due` / `Overdue` / `In Progress` / `Completed` / `Skipped`

### Create PM Schedule Form → `maintenance_schedule` table
| UI Label | Input | DB Column | Validation |
|----------|-------|-----------|------------|
| Machine | dropdown | machine_id → machines.id | required |
| Task Name | text | task_name | required |
| Task Description | textarea | description | optional |
| Maintenance Type | dropdown | maintenance_type | Lubrication / Inspection / Replacement / Cleaning / Calibration |
| Frequency | dropdown | frequency | Daily / Weekly / Fortnightly / Monthly / Quarterly / Half-Yearly / Annual |
| Next Due Date | date | next_due | required |
| Assigned To | dropdown | assigned_to → users.id | optional |
| Estimated Duration (hrs) | number | estimated_duration_hrs | > 0 |
| Checklist Items | dynamic list | checklist (JSONB) | optional |
| Parts Required | dynamic list | parts_required (JSONB) | material_id + qty each |
| Is Active | toggle | is_active | default true |

**Dropdowns:**
- Machine: GET `/api/production/machines`
- Assigned To: GET `/api/users?dept=Maintenance`
- Parts Required: GET `/api/master/materials?category=Spare Parts`

**Buttons:**
- **Save Schedule** → POST `/api/maintenance/schedule`
- **Mark Complete** → PUT `/api/maintenance/schedule/:id/complete` — sets last_done=today, computes next_due from frequency
- **Skip** → PUT `/api/maintenance/schedule/:id/skip` — records skip reason, advances next_due

**Next Due Computation (server-side on complete):**
```js
const freq = { Daily:1, Weekly:7, Fortnightly:14, Monthly:30, Quarterly:91, 'Half-Yearly':182, Annual:365 };
const next_due = new Date(today);
next_due.setDate(next_due.getDate() + freq[schedule.frequency]);
```

---

## 2. MAINTENANCE LOG

### Maintenance Log List
**API:** GET `/api/maintenance/logs?machine_id=&type=&date=`

| Column | DB Source | Filter |
|--------|-----------|--------|
| Date | maintenance_logs.date | range |
| Machine | machines.name | dropdown |
| Type | maintenance_logs.maintenance_type | dropdown |
| Task | maintenance_logs.description | search |
| Duration (hrs) | maintenance_logs.duration_hrs | — |
| Downtime Linked | downtime_entries.id present? | — |
| Cost (₹) | maintenance_logs.cost | — |
| Status | maintenance_logs.status | dropdown |
| Performed By | users.name | — |

### Maintenance Type Options
`PM` (preventive) / `Breakdown` / `Lubrication` / `Inspection` / `Overhaul` / `Calibration`

### Log Maintenance Form → `maintenance_logs` table
| UI Label | Input | DB Column | Validation |
|----------|-------|-----------|------------|
| Machine | dropdown | machine_id → machines.id | required |
| Maintenance Type | dropdown | maintenance_type | required |
| Schedule Reference | dropdown (opt) | schedule_id → maintenance_schedule.id | nullable, filtered by machine |
| Date | date | date | ≤ today |
| Description | text | description | required |
| Problem Found | textarea | problem_description | if type=Breakdown |
| Work Done | textarea | work_done | required |
| Start Time | datetime | start_time | required |
| End Time | datetime | end_time | > start_time |
| Duration (hrs) | number (auto) | duration_hrs | computed from times |
| Cost (₹) | number | cost | ≥ 0 |
| Performed By | dropdown | performed_by → users.id | required |
| Assisted By | text | assisted_by | optional |
| Parts Used | dynamic table | spare_parts_used (JSONB) | see below |
| Root Cause | textarea | root_cause | required if type=Breakdown |
| Corrective Action | textarea | corrective_action | required if type=Breakdown |
| Status | dropdown | status | Completed / In Progress / Pending Parts |

**Parts Used Dynamic Table (per row):**
| UI Label | Input | DB Column (in JSONB) | Stock check |
|----------|-------|---------------------|------------|
| Material | dropdown | material_id | GET /api/master/materials?category=Spare Parts |
| Qty Used | number | qty_used | > 0, ≤ current_stock |
| UOM | text (auto) | uom | from material |
| Unit Cost | number (auto) | unit_cost | from materials.last_price |

**Breakdown-specific extra fields:**
| UI Label | Input | DB Column |
|----------|-------|-----------|
| Was Machine Stopped? | checkbox | machine_stopped |
| Production Loss (MT) | number | production_loss_mt |
| Downtime Duration (min) | number | downtime_min (links to downtime_entries) |

### Maintenance Log Buttons
| Button | API | Condition | Effect |
|--------|-----|-----------|--------|
| Save Log | POST `/api/maintenance/logs` | — | creates log |
| Complete | PUT `/api/maintenance/logs/:id/complete` | role ≥ 2 | status=Completed, deducts parts |
| Log Breakdown | POST `/api/maintenance/breakdown` | any | special: also inserts downtime |
| Print Work Order | client PDF | — | — |

**On Log Breakdown (ACID tx):**
```sql
INSERT INTO maintenance_logs (..., maintenance_type='Breakdown') RETURNING id;
INSERT INTO downtime_entries (machine_id, shift_id, start_time, category='Mechanical', maintenance_log_id=^id);
-- Update machines.status = 'Down' if machine_stopped=true
```

**On Complete with parts (ACID tx):**
```sql
UPDATE maintenance_logs SET status='Completed' WHERE id=$1;
FOR each part in spare_parts_used:
  INSERT INTO stock_ledger (material_id, out_qty=qty_used, transaction_type='Maintenance', reference_id=log.id);
  UPDATE materials SET current_stock = current_stock - qty_used WHERE id=material_id;
INSERT INTO audit_log (...);
```

---

## 3. MAINTENANCE DASHBOARD

**API:** GET `/api/maintenance/dashboard`

### KPI Cards
| Widget | DB | Formula |
|--------|-----|---------|
| PM Due (next 7 days) | maintenance_schedule | COUNT WHERE next_due ≤ today+7 AND status=Scheduled |
| PM Overdue | maintenance_schedule | COUNT WHERE next_due < today AND status≠Completed |
| Open Breakdowns | maintenance_logs | COUNT WHERE type=Breakdown AND status≠Completed |
| MTTR (avg hrs) | maintenance_logs | AVG(duration_hrs) WHERE type=Breakdown AND month |
| Maintenance Cost (month) | maintenance_logs | SUM(cost) WHERE date ≥ month_start |
| PM Compliance % | maintenance_schedule | completed_on_time / total scheduled × 100 |

### Machine Health Table
| Column | Source |
|--------|--------|
| Machine | machines.name |
| Status | machines.status |
| Last PM | MAX(date) WHERE type=PM |
| Next PM Due | MIN(next_due) FROM schedule |
| Breakdowns (month) | COUNT WHERE type=Breakdown, date ≥ month_start |
| MTBF (hrs) | operating_hrs / breakdown_count |
| MTTR (hrs) | AVG(duration_hrs) WHERE type=Breakdown |

### MTBF / MTTR Trend Chart
Per machine, per month — bar chart
