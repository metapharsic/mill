# MK Paper Mill ERP — Migration Sequence

> **AI INSTRUCTION:** Read this before writing any SQL migration. Check if the column/table
> you need already exists. Never add a column without `IF NOT EXISTS`. Run `npm run db:migrate`
> to apply new migrations. Track all new files in `schema_migrations` table.

---

## How Migrations Work

```bash
# Apply all pending migrations
cd backend && npm run db:migrate

# Check migration status
cd backend && npm run db:status

# Entry point
backend/src/db/migrate.js  → reads db/*.sql, checks schema_migrations table
```

Every applied migration is recorded in:
```sql
schema_migrations (filename VARCHAR PRIMARY KEY, applied_at TIMESTAMPTZ)
```

New migration files must use `IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS` — safe to re-run.

---

## Baseline Schema

| File | Purpose |
|---|---|
| `db/schema.sql` | Complete baseline — all core tables created here |
| `db/phase3_migration.sql` | Phase 3 additions (early stage) |

**Read `schema.sql` first** before writing queries — it defines the foundation.

---

## Migration Files (Chronological Order)

| # | File | What It Adds / Changes |
|---|---|---|
| 1 | `schema.sql` | Baseline: users, roles, departments, machines, grades, reels, shifts, materials, stock_ledger, quality_tests, indents, indent_items, purchase_orders, sales_orders, customers, vendors, maintenance_schedule, maintenance_logs, audit_log, notifications |
| 2 | `phase3_migration.sql` | Phase 3 early additions to core tables |
| 3 | `migration_store_indents.sql` | `store_indents` table (older PIIMAS v1 — superseded by `indents`) |
| 4 | `migration_paper_forms.sql` | `sections` table (F5), shift_reports (F3), chemical_consumption (F4), facility readings |
| 5 | `migration_plant_sections.sql` | `plant_sections`, `section_process_readings`, `section_alarms`, `section_kpi_snapshots` |
| 6 | `migration_seed_sections.sql` | Seed data: 21 plant sections mapped to departments |
| 7 | `migration_phase14.sql` | `store_issues`, `scrap_records`, `packing_records`, `gate_logs`, `visitors`, `gate_passes`, `lab_tests`, `ehs_incidents` |
| 8 | `migration_hrms_ph16.sql` | Full HRMS: `employees`, `attendance`, `payroll`, `payroll_items`, `leaves`, `leave_balances`, `hr_documents` |
| 9 | `migration_hrms_employee_cols.sql` | Additional employee columns: aadhar, pan, pf_number, esic_number, bank_account, bank_name, ifsc, user_id, is_dept_head |
| 10 | `migrate_holidays_loans.sql` | `holidays` table, `employee_loans`, `loan_repayments` |
| 11 | `migration_piimas.sql` | Extends `indents`: l1/l2 approvals, issued_by, issued_at, closed_at, ack_status. Creates `indent_items` ext columns, `indent_audit_log` |
| 12 | `migration_approval_matrix.sql` | `approval_matrix` table — tier-based approval rules (min_value, max_value, tier, required_level) |
| 13 | `migration_daily_production_report.sql` | `daily_production_reports`, `dpr_gsm_breakup`, `dpr_chemical_lines`, `dpr_downtime_lines` |
| 14 | `migration_dpr_engine.sql` | `dpr_grade_standards` — per-grade chemical/utility consumption standards |
| 15 | `migration_dps_excel_fields.sql` | `dps_imports` table, additional columns for DPS Excel import compatibility |
| 16 | `migration_inventory_category_reset.sql` | **DESTRUCTIVE** — wiped old 19 categories, rebuilt 11 new ones (CHEM, SPARE, CONS, RAW, PACK, FUEL, ELEC, INS...). Backup taken first |
| 17 | `migration_materials_bin_location.sql` | `materials.bin_location VARCHAR(30)` |
| 18 | `migration_traceability.sql` | `machine_positions`, `installed_assets`, `asset_events`, `indent_comments` |
| 19 | `migration_store_shift_tracking.sql` | `stock_ledger.shift VARCHAR(10)`, `stock_ledger.is_high_txn BOOLEAN` |
| 20 | `migration_cmms_spares.sql` | CMMS spare parts tracking columns on `maintenance_logs` |
| 21 | `migration_bearing_check_columns.sql` | Bearing check columns: temperature, vibration, rpm, noise on bearing check tables |
| 22 | `migration_bearing_equipment_seed.sql` | Seed: equipment master data + bearing point registry (21,510 bytes — large seed) |
| 23 | `migration_bearing_scan_photo.sql` | `bearing_check_rounds.scan_photo_url VARCHAR(500)` |
| 24 | `migration_bearing_readings_expand.sql` | Expanded bearing reading columns |
| 25 | `migration_motor_electrical_specs.sql` | `motor_electrical_specs` table — KW, RPM, bearing FS/BS per motor |
| 26 | `migration_equipment_seed_ph17f.sql` | `plant_sections.department_id` FK added. Equipment → section linkage seeded |
| 27 | `migration_reels_ph17d.sql` | `reels.bf INTEGER`, `reels.deckle VARCHAR`, `reels.reject_reason TEXT` |
| 28 | `migration_grade_fidelity_ph17e.sql` | Insert missing chemical materials (category_id=3). Add standard columns to `dpr_grade_standards`. Seed per-grade standards |
| 29 | `migration_deep_analysis_ph19_22.sql` | Phase 19-22 deep analysis: additional reporting columns, cross-module join optimizations |
| 30 | `migration_production_enhancements.sql` | `machines.design_speed_mpm`, `machines.ideal_speed_mpm` — for OEE performance calculation |
| 31 | `migration_downtime_reason_code_id.sql` | `downtime_entries.reason_code_id INTEGER` FK → `downtime_reason_codes` |
| 32 | `migration_payment_confirm.sql` | `payments.status`, `payments.confirmed_by`, `payments.confirmed_at` — maker-checker on payments |
| 33 | `migration_adjustment_approval.sql` | Stock adjustment approval workflow columns |
| 34 | `migration_scada_boiler_energy.sql` | `boiler_performance_logs`, additional SCADA/telemetry tables for real-time section data |
| 35 | `migration_scrap_remarks_column.sql` | `scrap_records.remarks TEXT` — bug fix (code expected column that didn't exist) |
| 36 | `migration_critical_fixes.sql` | Critical bug fixes: missing FK constraints, index additions, data integrity patches |
| 37 | `migration_dept_categories.sql` | `departments.category VARCHAR` — classifies depts as production/support/management |

---

## Seed Files (Data, Not Schema)

| File | Purpose | Safe to Re-run? |
|---|---|---|
| `seed_logins.sql` | Default user accounts (admin, operators per dept) | `ON CONFLICT DO NOTHING` ✅ |
| `seed_leave_balances.sql` | Initial leave balances for all employees | `ON CONFLICT DO NOTHING` ✅ |
| `seed_store_inventory_import.sql` | Full store inventory (65KB — large) | `ON CONFLICT DO NOTHING` ✅ |
| `seed_motor_electrical_specs.sql` | Motor specs seed (14KB) | `ON CONFLICT DO NOTHING` ✅ |
| `import_store_inventory.py` | Python script for store inventory bulk import | Manual run only |

---

## Key Columns Added Per Table (Quick Reference)

### `reels` — columns added after baseline
| Column | Migration |
|---|---|
| `bf` | migration_reels_ph17d.sql |
| `deckle` | migration_reels_ph17d.sql |
| `reject_reason` | migration_reels_ph17d.sql |

### `materials` — columns added after baseline
| Column | Migration |
|---|---|
| `bin_location` | migration_materials_bin_location.sql |
| `is_serialized` | migration_traceability.sql |
| `expected_lifespan_days` | migration_traceability.sql |

### `stock_ledger` — columns added after baseline
| Column | Migration |
|---|---|
| `shift` | migration_store_shift_tracking.sql |
| `is_high_txn` | migration_store_shift_tracking.sql |

### `employees` — columns added after baseline
| Column | Migration |
|---|---|
| `aadhar`, `pan`, `pf_number`, `esic_number` | migration_hrms_employee_cols.sql |
| `bank_account`, `bank_name`, `ifsc` | migration_hrms_employee_cols.sql |
| `user_id`, `is_dept_head` | migration_hrms_employee_cols.sql |

### `machines` — columns added after baseline
| Column | Migration |
|---|---|
| `design_speed_mpm` | migration_production_enhancements.sql |
| `ideal_speed_mpm` | migration_production_enhancements.sql |

### `indents` — columns added after baseline
| Column | Migration |
|---|---|
| `l1_approved_by`, `l1_approved_at` | migration_piimas.sql |
| `l2_approved_by`, `l2_approved_at` | migration_piimas.sql |
| `issued_by`, `issued_at`, `closed_at` | migration_piimas.sql |

### `payments` — columns added after baseline
| Column | Migration |
|---|---|
| `status`, `confirmed_by`, `confirmed_at` | migration_payment_confirm.sql |

### `plant_sections` — columns added after baseline
| Column | Migration |
|---|---|
| `department_id` | migration_equipment_seed_ph17f.sql |

### `scrap_records` — columns added after baseline
| Column | Migration |
|---|---|
| `remarks` | migration_scrap_remarks_column.sql |

---

## Writing a New Migration

```sql
-- Migration: migration_<feature_name>.sql
-- Purpose: <what this does>
-- Date: YYYY-MM-DD
-- Safe to re-run: YES (uses IF NOT EXISTS)

-- Add columns
ALTER TABLE table_name
  ADD COLUMN IF NOT EXISTS new_column VARCHAR(50),
  ADD COLUMN IF NOT EXISTS another_column INTEGER DEFAULT 0;

-- Create new table
CREATE TABLE IF NOT EXISTS new_table (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add index
CREATE INDEX IF NOT EXISTS idx_new_table_name ON new_table(name);

-- Register migration
INSERT INTO schema_migrations (filename)
VALUES ('migration_<feature_name>.sql')
ON CONFLICT (filename) DO NOTHING;
```

> [!IMPORTANT]
> Always use `ADD COLUMN IF NOT EXISTS` — never bare `ADD COLUMN`.
> Always register in `schema_migrations` at the end.
> Always use `CREATE TABLE IF NOT EXISTS`.
