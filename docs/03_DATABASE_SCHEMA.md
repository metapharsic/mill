# MK Paper Mill ERP — Database Schema Reference

> **Database:** PostgreSQL · **DB Name:** mk_paper_mill
> All queries must be parameterized. Never string-concatenate SQL.
> Never hard-delete from tables marked (soft-delete).

---

## Entity Relationship Overview

```
departments <-- users --> roles
     |
     +-- employees (HR)
     +-- indents --> indent_items --> materials
                         |
                    purchase_orders --> po_items
                         |
                         grn --> grn_items --> stock_ledger

machines <-- shifts --> reels --> quality_tests
                |
           downtime_entries
           production_summary

customers <-- sales_orders --> dispatch_orders --> dispatch_items --> reels

employees --> attendance
employees --> payroll (via hr migration tables)

plant_sections --> section_process_readings --> section_kpi_snapshots
               --> section_alarms

users --> notifications
users --> audit_log
```

---

## Core / Auth Tables

### `departments`
| Column | Type | Notes |
|---|---|---|
| id | SERIAL PK | |
| name | VARCHAR(100) UNIQUE | |
| code | VARCHAR(20) UNIQUE | PROD, RMS, INV, STORE, INDENT, PUR, QC, MAINT, UTIL, DISP, SALES, HR, SEC, LAB, FIN, ADMIN, EHS, SCRAP, PACK, FGW |
| created_at | TIMESTAMP | |

### `roles`
| Column | Type | Notes |
|---|---|---|
| id | SERIAL PK | |
| name | VARCHAR(50) UNIQUE | Operator, Shift Supervisor, Manager, Plant Head, Admin |
| level | INTEGER | 1=Operator, 2=Supervisor, 3=Manager, 4=Plant Head, 5=Admin |
| permissions | JSONB | `{"view", "entry", "approve_l1", "approve_l2", "approve_l3", "manage_users", "manage_system"}` |
| created_at | TIMESTAMP | |

### `users` (soft-delete)
| Column | Type | Notes |
|---|---|---|
| id | SERIAL PK | |
| employee_code | VARCHAR(20) UNIQUE | |
| name | VARCHAR(100) | |
| email | VARCHAR(150) UNIQUE | Login credential |
| mobile | VARCHAR(15) | |
| password_hash | VARCHAR(255) | bcrypt hash |
| role_id | FK -> roles | |
| department_id | FK -> departments | |
| shift | VARCHAR(10) | Day / Night / General |
| is_active | BOOLEAN | Soft-delete flag |
| must_change_password | BOOLEAN | Forces password reset on next login |
| last_login | TIMESTAMP | |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |

### `sessions`
| Column | Type | Notes |
|---|---|---|
| id | VARCHAR(128) PK | |
| user_id | FK -> users | CASCADE delete |
| created_at | TIMESTAMP | |
| expires_at | TIMESTAMP | |

---

## Production Module

### `machines` (soft-delete)
| Column | Type | Notes |
|---|---|---|
| id | SERIAL PK | |
| name | VARCHAR(100) | |
| code | VARCHAR(20) UNIQUE | |
| type | VARCHAR(50) | Paper Machine, Rewinder, Cutter |
| capacity_tpd | NUMERIC(10,2) | Tons per day |
| is_active | BOOLEAN | |

### `grades` (soft-delete)
| Column | Type | Notes |
|---|---|---|
| id | SERIAL PK | |
| name | VARCHAR(100) | |
| code | VARCHAR(20) UNIQUE | |
| gsm_min / gsm_max | NUMERIC(6,2) | GSM range |
| is_active | BOOLEAN | |

### `shifts`
| Column | Type | Notes |
|---|---|---|
| id | SERIAL PK | |
| date | DATE | |
| shift_type | VARCHAR(10) | CHECK IN ('Day','Night') |
| start_time / end_time | TIMESTAMP | |
| supervisor_id | FK -> users | |
| machine_id | FK -> machines | |

### `reels`
| Column | Type | Notes |
|---|---|---|
| id | SERIAL PK | |
| reel_number | VARCHAR(50) UNIQUE | |
| barcode | VARCHAR(100) UNIQUE | |
| shift_id / machine_id / grade_id / operator_id | FK | |
| gsm, width_mm, length_m, weight_kg, moisture_pct | NUMERIC | Paper specs |
| speed_mpm, steam_pressure, steam_consumption, water_consumption | NUMERIC | Process data |
| start_time / end_time | TIMESTAMP | |
| production_time_min, break_time_min, downtime_min | INTEGER | |
| efficiency_pct, reject_pct | NUMERIC | |
| quality_status | VARCHAR(20) | Pending/Approved/Rejected/Hold |
| status | VARCHAR(30) | In Production/QC Pending/QC Done/In Warehouse/Dispatched/Rejected |
| rack_location | VARCHAR(50) | FG warehouse location |

### `downtime_entries`
| Column | Type | Notes |
|---|---|---|
| shift_id / machine_id / reel_id | FK | |
| start_time / end_time | TIMESTAMP | |
| duration_min | INTEGER | |
| category | VARCHAR(50) | Mechanical/Electrical/Process/Quality/Break/Changeover |
| reason / corrective_action | TEXT | |

### `production_summary`
| Column | Type | Notes |
|---|---|---|
| date, shift_type, machine_id | | UNIQUE constraint |
| total_reels, total_production_kg, total_reject_kg, net_production_kg | | Aggregates |
| avg_gsm, avg_moisture, avg_speed, avg_efficiency | NUMERIC | |
| total_downtime_min, total_steam, total_water | | |

---

## Inventory / Raw Material

### `material_categories`
| Column | Type | Notes |
|---|---|---|
| id | SERIAL PK | |
| name | VARCHAR(100) UNIQUE | |
| code | VARCHAR(20) UNIQUE | |
| type | VARCHAR(30) | RawMaterial/Chemical/Packing/Spare/Other |

### `materials` (soft-delete)
| Column | Type | Notes |
|---|---|---|
| id | SERIAL PK | |
| code | VARCHAR(30) UNIQUE | |
| name | VARCHAR(150) | |
| category_id | FK -> material_categories | |
| uom | VARCHAR(20) | KG, MT, LTR, NOS, BAG |
| hsn_code | VARCHAR(20) | |
| reorder_level / min_stock / max_stock / current_stock | NUMERIC(12,3) | |
| unit_price | NUMERIC(12,2) | |
| is_active | BOOLEAN | |

### `vendors` (soft-delete)
| Column | Type | Notes |
|---|---|---|
| id | SERIAL PK | |
| code | VARCHAR(20) UNIQUE | |
| gstin / pan | VARCHAR | GST/tax info |
| payment_terms | VARCHAR(50) | |
| credit_days | INTEGER | Default 30 |
| rating | NUMERIC(3,1) | |

### `grn` (Goods Receipt Note)
| Column | Type | Notes |
|---|---|---|
| grn_number | VARCHAR(30) UNIQUE | |
| vendor_id / po_id | FK | |
| status | VARCHAR(20) | Draft/Received/QC Pending/QC Done/Approved/Rejected |

### `grn_items`
| Column | Type | Notes |
|---|---|---|
| grn_id | FK -> grn CASCADE | |
| material_id | FK -> materials | |
| po_qty / received_qty / accepted_qty / rejected_qty | NUMERIC | |
| bin_location | VARCHAR(30) | |

### `stock_ledger`
| Column | Type | Notes |
|---|---|---|
| material_id | FK -> materials | |
| transaction_type | VARCHAR(30) | GRN/Issue/Return/Transfer/Adjustment/Scrap |
| in_qty / out_qty / balance | NUMERIC | |
| reference_id / reference_type | | Links to source document |

---

## Indent & Purchase

### `indents`
| Column | Type | Notes |
|---|---|---|
| indent_number | VARCHAR(30) UNIQUE | |
| department_id | FK -> departments | |
| priority | VARCHAR(10) | Low/Normal/High/Urgent |
| status | VARCHAR(20) | Draft/Submitted/L1 Approved/L2 Approved/L3 Approved/Approved/PO Created/Issued/Closed/Rejected/Cancelled |
| raised_by | FK -> users | |
| l1_approved_by / l1_approved_at | FK+TIMESTAMP | |
| l2_approved_by / l2_approved_at | FK+TIMESTAMP | |
| l3_approved_by / l3_approved_at | FK+TIMESTAMP | |

### `indent_items`
| Column | Type | Notes |
|---|---|---|
| indent_id | FK -> indents CASCADE | |
| material_id | FK -> materials | |
| required_qty / approved_qty | NUMERIC | |
| purpose | TEXT | |
| current_stock | NUMERIC | Snapshot at time of indent |

### `purchase_orders`
| Column | Type | Notes |
|---|---|---|
| po_number | VARCHAR(30) UNIQUE | |
| vendor_id | FK -> vendors | |
| status | VARCHAR(20) | Draft/Approved/Sent/Partial/Received/Closed/Cancelled |
| total_value / gst_value / grand_total | NUMERIC | |

### `po_items`
| Column | Type | Notes |
|---|---|---|
| po_id | FK -> purchase_orders CASCADE | |
| material_id | FK -> materials | |
| qty / received_qty / unit_price / gst_pct / total | NUMERIC | |

---

## Quality

### `quality_tests`
| Column | Type | Notes |
|---|---|---|
| test_number | VARCHAR(30) UNIQUE | |
| test_type | VARCHAR(30) | Incoming/Process/Final/Customer |
| reference_type / reference_id | | Links to Reel, GRN, Batch |
| gsm, moisture_pct, caliper_micron, burst_factor, cobb_value, brightness_pct | NUMERIC | Paper quality params |
| tensile_strength, tear_strength, thickness_micron, width_mm, weight_kg | NUMERIC | |
| result | VARCHAR(20) | Pending/Pass/Fail/Hold |

---

## Maintenance

### `maintenance_schedule`
| Column | Type | Notes |
|---|---|---|
| machine_id | FK -> machines | |
| maintenance_type | VARCHAR(30) | Preventive/Predictive/Breakdown/Lubrication |
| frequency_days | INTEGER | Repeat interval |
| last_done / next_due | DATE | |
| status | VARCHAR(20) | Scheduled/In Progress/Done/Overdue/Cancelled |

### `maintenance_logs`
| Column | Type | Notes |
|---|---|---|
| schedule_id | FK -> maintenance_schedule | |
| spare_parts_used | JSONB | `[]` array of parts |
| duration_hours / cost | NUMERIC | |
| status | VARCHAR(20) | Completed |

---

## Sales & Dispatch

### `customers` (soft-delete)
| Column | Type | Notes |
|---|---|---|
| code | VARCHAR(20) UNIQUE | |
| credit_limit / credit_days | NUMERIC / INTEGER | |

### `sales_orders`
| Column | Type | Notes |
|---|---|---|
| so_number | VARCHAR(30) UNIQUE | |
| customer_id / grade_id | FK | |
| qty_mt / fulfilled_mt | NUMERIC | |
| status | VARCHAR(20) | Pending/In Production/Ready/Partial/Dispatched/Cancelled |

### `dispatch_orders`
| Column | Type | Notes |
|---|---|---|
| do_number | VARCHAR(30) UNIQUE | |
| so_id / customer_id | FK | |
| eway_bill / lr_number | VARCHAR | Logistics |
| status | VARCHAR(20) | Loading/Loaded/Dispatched/Delivered/Returned |

### `dispatch_items`
| Column | Type | Notes |
|---|---|---|
| dispatch_id | FK CASCADE | |
| reel_id | FK -> reels | |

---

## Utility

### `utility_readings`
| Column | Type | Notes |
|---|---|---|
| date / shift_type / reading_time | | |
| power_units / dg_units | NUMERIC | Electricity |
| steam_generated_mt / coal_consumed_kg / boiler_pressure / boiler_temp | NUMERIC | Boiler |
| fresh_water_kl / process_water_kl | NUMERIC | Water |
| air_pressure | NUMERIC | Compressed air |
| etp_inlet_kl / etp_outlet_kl | NUMERIC | Effluent treatment |

---

## HR

### `employees`
| Column | Type | Notes |
|---|---|---|
| user_id | FK -> users | Links HR employee to system user |
| employee_code | VARCHAR(20) UNIQUE | |
| doj / dob | DATE | Date of joining / birth |
| aadhar / pan | VARCHAR | Identity docs |
| pf_number / esic_number | VARCHAR | Statutory |
| bank_account / bank_name / ifsc | VARCHAR | Payroll |
| basic_salary | NUMERIC(12,2) | |
| is_active | BOOLEAN | Soft-delete |

### `attendance`
| Column | Type | Notes |
|---|---|---|
| employee_id | FK -> employees | |
| date | DATE | UNIQUE(employee_id, date) |
| shift_type | VARCHAR(10) | |
| in_time / out_time | TIMESTAMP | |
| status | VARCHAR(20) | Present/Absent/Half Day/Leave/Holiday/OT |

---

## System / Audit

### `notifications`
| Column | Type | Notes |
|---|---|---|
| user_id | FK -> users CASCADE | |
| type | VARCHAR(50) | info/warning/error |
| title | VARCHAR(200) | |
| ref_table / ref_id | | Links to source record |
| is_read | BOOLEAN | |

### `audit_log`
| Column | Type | Notes |
|---|---|---|
| user_id | FK -> users | |
| action | VARCHAR(50) | |
| module | VARCHAR(50) | |
| record_id | INTEGER | |
| old_data / new_data | JSONB | Before/after snapshot |
| ip_address | VARCHAR(45) | |

---

## Key Indexes

```sql
idx_reels_shift          ON reels(shift_id)
idx_reels_machine        ON reels(machine_id)
idx_reels_date           ON reels(start_time)
idx_reels_status         ON reels(status)
idx_stock_ledger_material ON stock_ledger(material_id)
idx_stock_ledger_date    ON stock_ledger(date)
idx_audit_log_user       ON audit_log(user_id)
idx_audit_log_module     ON audit_log(module, created_at)
idx_attendance_date      ON attendance(date)
idx_utility_date         ON utility_readings(date)
idx_notif_user           ON notifications(user_id, is_read, created_at DESC)
```

---

## Migration Files (in /db/)

| File | Purpose |
|---|---|
| `schema.sql` | Baseline schema (core tables) |
| `migration_hrms_ph16.sql` | Full HR/Payroll tables |
| `migration_piimas.sql` | Indent acknowledgment system |
| `migration_plant_sections.sql` | Plant section monitoring |
| `migration_maintenance.sql` | CMMS (bearing, equipment) |
| `migration_dpr_engine.sql` | Daily Production Report engine |
| `migration_traceability.sql` | Reel traceability |
| `migration_approval_matrix.sql` | Multi-level approval |
| `migration_paper_forms.sql` | Paper forms/formats |

> To apply migrations: `cd backend && npm run db:migrate`
> To check status: `cd backend && npm run db:status`

---

*Last updated: 2026-07-17 | See 04_API_CONTRACTS for endpoint details*
