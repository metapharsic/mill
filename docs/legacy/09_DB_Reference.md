# Database Reference — Full Table Map

DB: `mk_paper_mill` | PostgreSQL | localhost:5432

---

## MASTER TABLES

### `departments`
| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL PK | — |
| name | VARCHAR(100) | unique |
| code | VARCHAR(20) | unique, e.g. PROD, MAINT |
| is_active | BOOLEAN | default true |
| created_at | TIMESTAMP | — |

Seeded: 20 departments including Production, Quality, Maintenance, Stores, Purchase, Sales, HR, Finance, IT, Admin...

### `roles`
| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL PK | — |
| name | VARCHAR(50) | unique |
| level | INT | 1=Operator, 2=Supervisor, 3=Manager, 4=PlantHead, 5=Admin |
| permissions | JSONB | module-level access flags |

### `users`
| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL PK | — |
| employee_code | VARCHAR(20) | unique |
| name | VARCHAR(100) | NOT NULL |
| email | VARCHAR(150) | unique, NOT NULL |
| password_hash | VARCHAR(255) | bcrypt |
| role_id | INT → roles.id | NOT NULL |
| department_id | INT → departments.id | NOT NULL |
| phone | VARCHAR(15) | — |
| address | TEXT | — |
| default_shift | VARCHAR(10) | Day/Night/General |
| is_active | BOOLEAN | default true |
| last_login | TIMESTAMP | updated on login |
| created_at | TIMESTAMP | — |
| updated_at | TIMESTAMP | — |

### `machines`
| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL PK | — |
| name | VARCHAR(50) | NOT NULL |
| code | VARCHAR(20) | unique (PM1, PM2, RW1, CT1) |
| machine_type | VARCHAR(50) | Paper Machine/Rewinder/Cutter/Pulper |
| capacity_tpd | NUMERIC(10,2) | MT per day |
| ideal_speed_mpm | NUMERIC(10,2) | meters per min |
| installation_date | DATE | — |
| manufacturer | VARCHAR(100) | — |
| model_number | VARCHAR(50) | — |
| status | VARCHAR(20) | Running/Down/Idle/Maintenance |
| notes | TEXT | — |
| is_active | BOOLEAN | default true |

Seeded: PM1, PM2, RW1, CT1

### `grades`
| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL PK | — |
| name | VARCHAR(100) | NOT NULL |
| code | VARCHAR(20) | unique |
| gsm_min | NUMERIC(6,1) | — |
| gsm_max | NUMERIC(6,1) | — |
| description | TEXT | — |
| is_active | BOOLEAN | default true |

Seeded: Kraft, Writing, Newsprint, Board, Tissue

---

## PRODUCTION TABLES

### `shifts`
| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL PK | — |
| date | DATE | NOT NULL |
| shift_type | VARCHAR(10) | Day/Night |
| machine_id | INT → machines.id | NOT NULL |
| supervisor_id | INT → users.id | NOT NULL |
| start_time | TIMESTAMP | NOT NULL |
| end_time | TIMESTAMP | nullable (if open) |
| opening_meter | NUMERIC(12,2) | — |
| closing_meter | NUMERIC(12,2) | — |
| total_break_min | INT | default 0 |
| remarks | TEXT | — |
| closing_remarks | TEXT | — |
| status | VARCHAR(10) | Open/Closed |
| created_at | TIMESTAMP | — |

UNIQUE(date, shift_type, machine_id)

### `reels`
| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL PK | — |
| reel_number | VARCHAR(30) | unique, NOT NULL |
| shift_id | INT → shifts.id | NOT NULL |
| machine_id | INT → machines.id | NOT NULL |
| grade_id | INT → grades.id | NOT NULL |
| operator_id | INT → users.id | — |
| sales_order_id | INT → sales_orders.id | nullable |
| gsm | NUMERIC(6,1) | NOT NULL |
| width_mm | NUMERIC(8,1) | — |
| length_m | NUMERIC(10,2) | — |
| weight_kg | NUMERIC(10,3) | NOT NULL |
| moisture_pct | NUMERIC(5,2) | — |
| speed_mpm | NUMERIC(8,2) | — |
| steam_pressure | NUMERIC(6,2) | — |
| steam_consumption | NUMERIC(10,2) | — |
| water_consumption | NUMERIC(10,2) | — |
| start_time | TIMESTAMP | NOT NULL |
| end_time | TIMESTAMP | — |
| production_time_min | INT | — |
| break_time_min | INT | default 0 |
| downtime_min | INT | default 0 |
| efficiency_pct | NUMERIC(5,2) | — |
| reject_pct | NUMERIC(5,2) | default 0 |
| status | VARCHAR(20) | In Production/QC Pending/QC Done/In Warehouse/Dispatched/Rejected |
| quality_status | VARCHAR(20) | Pending/Approved/Rejected |
| remarks | TEXT | — |
| created_by | INT → users.id | — |
| created_at | TIMESTAMP | — |
| updated_at | TIMESTAMP | — |

INDEX: (shift_id), (machine_id), (start_time), (status), (grade_id)

### `downtime_entries`
| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL PK | — |
| machine_id | INT → machines.id | NOT NULL |
| shift_id | INT → shifts.id | NOT NULL |
| reel_id | INT → reels.id | nullable |
| maintenance_log_id | INT → maintenance_logs.id | nullable |
| start_time | TIMESTAMP | NOT NULL |
| end_time | TIMESTAMP | nullable (ongoing) |
| duration_min | INT | computed on close |
| category | VARCHAR(30) | Mechanical/Electrical/Process/Quality/Changeover/Planned/Other |
| reason | TEXT | NOT NULL |
| corrective_action | TEXT | — |
| created_by | INT → users.id | — |
| created_at | TIMESTAMP | — |

### `production_summary`
| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL PK | — |
| date | DATE | NOT NULL |
| shift_type | VARCHAR(10) | — |
| machine_id | INT → machines.id | — |
| total_reels | INT | — |
| total_weight_kg | NUMERIC(12,3) | — |
| avg_efficiency_pct | NUMERIC(5,2) | — |
| total_downtime_min | INT | — |
| oee_pct | NUMERIC(5,2) | — |
| created_at | TIMESTAMP | — |

UNIQUE(date, shift_type, machine_id)

---

## INVENTORY TABLES

### `material_categories`
| Column | Type |
|--------|------|
| id | SERIAL PK |
| name | VARCHAR(100) unique |
| code | VARCHAR(10) unique |
| description | TEXT |
| is_active | BOOLEAN |

### `materials`
| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL PK | — |
| code | VARCHAR(20) | unique |
| name | VARCHAR(200) | NOT NULL |
| category_id | INT → material_categories.id | NOT NULL |
| uom | VARCHAR(20) | KG/MT/LTR/NOS/PKT/DRUM/BAG/ROLL |
| current_stock | NUMERIC(15,3) | cache, always ≥ 0 |
| reorder_level | NUMERIC(15,3) | — |
| min_order_qty | NUMERIC(15,3) | — |
| lead_time_days | INT | — |
| last_price | NUMERIC(12,2) | — |
| hsn_code | VARCHAR(10) | — |
| gst_rate | NUMERIC(4,1) | 0/5/12/18/28 |
| specification | TEXT | — |
| storage_conditions | TEXT | — |
| is_active | BOOLEAN | default true |

### `grn`
| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL PK | — |
| grn_number | VARCHAR(30) | unique |
| date | DATE | NOT NULL |
| vendor_id | INT → vendors.id | NOT NULL |
| po_id | INT → purchase_orders.id | nullable |
| vehicle_number | VARCHAR(20) | — |
| challan_number | VARCHAR(30) | — |
| invoice_number | VARCHAR(30) | — |
| invoice_date | DATE | — |
| invoice_amount | NUMERIC(12,2) | — |
| status | VARCHAR(20) | Draft/Received/QC Pending/Approved/Rejected |
| received_by | INT → users.id | — |
| approved_by | INT → users.id | — |
| approved_at | TIMESTAMP | — |
| created_at | TIMESTAMP | — |

### `grn_items`
| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL PK | — |
| grn_id | INT → grn.id | NOT NULL |
| material_id | INT → materials.id | NOT NULL |
| po_qty | NUMERIC(15,3) | — |
| received_qty | NUMERIC(15,3) | NOT NULL |
| accepted_qty | NUMERIC(15,3) | NOT NULL |
| rejected_qty | NUMERIC(15,3) | auto = received - accepted |
| unit_price | NUMERIC(12,2) | — |
| batch_number | VARCHAR(50) | — |
| mfg_date | DATE | — |
| expiry_date | DATE | — |
| bin_location | VARCHAR(30) | — |
| remarks | TEXT | — |

### `stock_ledger`
| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL PK | — |
| material_id | INT → materials.id | NOT NULL |
| date | DATE | NOT NULL |
| transaction_type | VARCHAR(20) | GRN/Issue/Return/Adjustment/Opening/Maintenance |
| in_qty | NUMERIC(15,3) | — |
| out_qty | NUMERIC(15,3) | — |
| balance | NUMERIC(15,3) | NOT NULL |
| reference_id | INT | grn_id / indent_id / maintenance_log_id |
| reference_number | VARCHAR(30) | human-readable ref |
| reason | TEXT | — |
| created_by | INT → users.id | — |
| created_at | TIMESTAMP | — |

INDEX: (material_id, date)
NEVER DELETE or UPDATE rows in stock_ledger.

---

## PROCUREMENT TABLES

### `indents`
| Column | Type |
|--------|------|
| id | SERIAL PK |
| indent_number | VARCHAR(30) unique |
| date | DATE |
| department_id | INT → departments.id |
| required_date | DATE |
| priority | VARCHAR(10) Low/Normal/High/Urgent |
| purpose | TEXT |
| remarks | TEXT |
| status | VARCHAR(20) |
| raised_by | INT → users.id |
| l1_approved_by | INT → users.id |
| l1_approved_at | TIMESTAMP |
| l2_approved_by | INT → users.id |
| l2_approved_at | TIMESTAMP |
| l3_approved_by | INT → users.id |
| l3_approved_at | TIMESTAMP |
| rejected_by | INT → users.id |
| rejected_at | TIMESTAMP |
| rejection_reason | TEXT |
| created_at | TIMESTAMP |

### `indent_items`
| Column | Type |
|--------|------|
| id | SERIAL PK |
| indent_id | INT → indents.id |
| material_id | INT → materials.id |
| required_qty | NUMERIC(15,3) |
| uom | VARCHAR(20) |
| estimated_cost | NUMERIC(12,2) |
| preferred_vendor_id | INT → vendors.id nullable |
| specification | TEXT |
| purpose | TEXT |

### `purchase_orders`
| Column | Type |
|--------|------|
| id | SERIAL PK |
| po_number | VARCHAR(30) unique |
| date | DATE |
| vendor_id | INT → vendors.id |
| indent_id | INT → indents.id nullable |
| delivery_date | DATE |
| payment_terms | VARCHAR(30) |
| billing_address | TEXT |
| delivery_address | TEXT |
| total_amount | NUMERIC(14,2) |
| status | VARCHAR(20) |
| created_by | INT → users.id |
| approved_by | INT → users.id |
| approved_at | TIMESTAMP |
| notes | TEXT |
| created_at | TIMESTAMP |

### `po_items`
| Column | Type |
|--------|------|
| id | SERIAL PK |
| po_id | INT → purchase_orders.id |
| material_id | INT → materials.id |
| qty | NUMERIC(15,3) |
| received_qty | NUMERIC(15,3) default 0 |
| uom | VARCHAR(20) |
| unit_price | NUMERIC(12,2) |
| discount_pct | NUMERIC(5,2) default 0 |
| gst_rate | NUMERIC(4,1) |
| amount | NUMERIC(14,2) |
| gst_amount | NUMERIC(14,2) |
| total | NUMERIC(14,2) |
| delivery_date | DATE |
| specification | TEXT |

---

## QUALITY TABLE

### `quality_tests`
| Column | Type |
|--------|------|
| id | SERIAL PK |
| test_number | VARCHAR(30) unique |
| test_type | VARCHAR(20) Incoming/Process/Final |
| test_date | DATE |
| reel_id | INT → reels.id nullable |
| grn_id | INT → grn.id nullable |
| sample_size | INT |
| gsm | NUMERIC(6,1) |
| moisture_pct | NUMERIC(5,2) |
| caliper_micron | NUMERIC(8,2) |
| burst_factor | NUMERIC(8,2) |
| cobb_value | NUMERIC(8,2) |
| brightness_pct | NUMERIC(5,2) |
| thickness_micron | NUMERIC(8,2) |
| width_mm | NUMERIC(8,1) |
| weight_kg | NUMERIC(10,3) |
| tensile_strength | NUMERIC(8,2) |
| tear_strength | NUMERIC(8,2) |
| porosity | NUMERIC(8,2) |
| ph_value | NUMERIC(4,2) |
| result | VARCHAR(10) Pass/Fail/Hold |
| failure_reasons | JSONB |
| ncr_required | BOOLEAN default false |
| ncr_closed | BOOLEAN default false |
| remarks | TEXT |
| tested_by | INT → users.id |
| passed_at | TIMESTAMP |
| failed_at | TIMESTAMP |
| created_at | TIMESTAMP |

---

## MAINTENANCE TABLES

### `maintenance_schedule`
| Column | Type |
|--------|------|
| id | SERIAL PK |
| machine_id | INT → machines.id |
| task_name | VARCHAR(200) |
| description | TEXT |
| maintenance_type | VARCHAR(30) |
| frequency | VARCHAR(20) Daily/.../Annual |
| last_done | DATE |
| next_due | DATE |
| assigned_to | INT → users.id |
| estimated_duration_hrs | NUMERIC(6,2) |
| checklist | JSONB |
| parts_required | JSONB |
| status | VARCHAR(20) |
| is_active | BOOLEAN |

### `maintenance_logs`
| Column | Type |
|--------|------|
| id | SERIAL PK |
| machine_id | INT → machines.id |
| maintenance_type | VARCHAR(30) |
| schedule_id | INT → maintenance_schedule.id nullable |
| date | DATE |
| description | VARCHAR(200) |
| problem_description | TEXT |
| work_done | TEXT |
| root_cause | TEXT |
| corrective_action | TEXT |
| start_time | TIMESTAMP |
| end_time | TIMESTAMP |
| duration_hrs | NUMERIC(6,2) |
| cost | NUMERIC(12,2) |
| performed_by | INT → users.id |
| assisted_by | TEXT |
| spare_parts_used | JSONB |
| machine_stopped | BOOLEAN |
| production_loss_mt | NUMERIC(10,3) |
| status | VARCHAR(20) |
| created_at | TIMESTAMP |

---

## SALES TABLES

### `customers`
| Column | Type |
|--------|------|
| id | SERIAL PK |
| code | VARCHAR(20) unique |
| name | VARCHAR(200) |
| contact_person | VARCHAR(100) |
| phone | VARCHAR(15) |
| email | VARCHAR(150) |
| billing_address | TEXT |
| shipping_address | TEXT |
| city | VARCHAR(50) |
| state | VARCHAR(50) |
| pincode | VARCHAR(10) |
| gstin | VARCHAR(15) |
| pan | VARCHAR(10) |
| credit_limit | NUMERIC(14,2) |
| payment_terms | VARCHAR(30) |
| preferred_grades | JSONB |
| notes | TEXT |
| is_active | BOOLEAN |

### `vendors`
Same structure as customers + `bank_name`, `bank_account`, `ifsc`, `rating`, `vendor_categories (JSONB)`

### `sales_orders`
| Column | Type |
|--------|------|
| id | SERIAL PK |
| so_number | VARCHAR(30) unique |
| date | DATE |
| customer_id | INT → customers.id |
| delivery_date | DATE |
| grade_id | INT → grades.id |
| gsm | NUMERIC(6,1) |
| width_mm | NUMERIC(8,1) |
| qty_mt | NUMERIC(10,3) |
| rate_per_kg | NUMERIC(10,2) |
| discount_pct | NUMERIC(5,2) |
| gst_rate | NUMERIC(4,1) |
| gst_type | VARCHAR(10) CGST+SGST/IGST |
| payment_terms | VARCHAR(30) |
| fulfilled_mt | NUMERIC(10,3) default 0 |
| status | VARCHAR(30) |
| remarks | TEXT |
| created_by | INT → users.id |
| created_at | TIMESTAMP |

### `dispatch_orders`
| Column | Type |
|--------|------|
| id | SERIAL PK |
| do_number | VARCHAR(30) unique |
| date | DATE |
| so_id | INT → sales_orders.id |
| customer_id | INT → customers.id |
| delivery_address | TEXT |
| vehicle_number | VARCHAR(20) |
| driver_name | VARCHAR(100) |
| driver_phone | VARCHAR(15) |
| transporter_name | VARCHAR(100) |
| eway_bill_number | VARCHAR(20) |
| status | VARCHAR(20) |
| dispatched_at | TIMESTAMP |
| remarks | TEXT |
| created_by | INT → users.id |
| created_at | TIMESTAMP |

### `dispatch_items`
| Column | Type |
|--------|------|
| id | SERIAL PK |
| dispatch_order_id | INT → dispatch_orders.id |
| reel_id | INT → reels.id |
| weight_kg | NUMERIC(10,3) |
| rate_per_kg | NUMERIC(10,2) |
| amount | NUMERIC(14,2) |

---

## UTILITY TABLE

### `utility_readings`
| Column | Type |
|--------|------|
| id | SERIAL PK |
| date | DATE |
| shift_type | VARCHAR(10) |
| reading_time | TIMESTAMP |
| power_units | NUMERIC(12,2) |
| dg_units | NUMERIC(12,2) |
| steam_generated_mt | NUMERIC(10,3) |
| coal_consumed_kg | NUMERIC(12,2) |
| boiler_pressure | NUMERIC(6,2) |
| boiler_temp | NUMERIC(6,2) |
| fresh_water_kl | NUMERIC(10,3) |
| process_water_kl | NUMERIC(10,3) |
| air_pressure | NUMERIC(6,2) |
| etp_inlet_kl | NUMERIC(10,3) |
| etp_outlet_kl | NUMERIC(10,3) |
| notes | TEXT |
| recorded_by | INT → users.id |
| created_at | TIMESTAMP |

---

## HR TABLES

### `employees`
| Column | Type |
|--------|------|
| id | SERIAL PK |
| employee_code | VARCHAR(20) unique |
| user_id | INT → users.id nullable |
| name | VARCHAR(100) |
| guardian_name | VARCHAR(100) |
| dob | DATE |
| gender | VARCHAR(10) |
| phone | VARCHAR(15) |
| alt_phone | VARCHAR(15) |
| email | VARCHAR(150) |
| address | TEXT |
| emergency_contact | TEXT |
| department_id | INT → departments.id |
| designation | VARCHAR(100) |
| date_of_joining | DATE |
| employment_type | VARCHAR(20) |
| default_shift | VARCHAR(10) |
| pan | VARCHAR(10) |
| aadhaar | VARCHAR(12) |
| bank_account | VARCHAR(30) |
| ifsc | VARCHAR(11) |
| pf_account | VARCHAR(20) |
| esi_number | VARCHAR(20) |
| is_active | BOOLEAN |
| last_working_day | DATE |

### `attendance`
| Column | Type |
|--------|------|
| id | SERIAL PK |
| employee_id | INT → employees.id |
| date | DATE |
| shift_type | VARCHAR(10) |
| in_time | TIME |
| out_time | TIME |
| overtime_hours | NUMERIC(4,2) |
| status | VARCHAR(20) |
| remarks | TEXT |
| created_by | INT → users.id |
| created_at | TIMESTAMP |

UNIQUE(employee_id, date)

---

## AUDIT TABLE

### `audit_log`
| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL PK | — |
| user_id | INT → users.id | who did it |
| action | VARCHAR(50) | NOUN_VERB format |
| module | VARCHAR(30) | Production/Quality/etc |
| record_id | INT | affected row id |
| old_data | JSONB | before state |
| new_data | JSONB | after state |
| ip_address | VARCHAR(45) | — |
| created_at | TIMESTAMP | — |

INDEX: (user_id), (module), (created_at)
NEVER DELETE audit_log rows.

### `sessions`
| Column | Type |
|--------|------|
| id | SERIAL PK |
| user_id | INT → users.id |
| token_hash | VARCHAR(255) |
| ip_address | VARCHAR(45) |
| user_agent | TEXT |
| created_at | TIMESTAMP |
| expires_at | TIMESTAMP |
| is_active | BOOLEAN |
