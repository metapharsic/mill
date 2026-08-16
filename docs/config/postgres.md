# PostgreSQL

- **Version:** 14+ (Windows service)
- **Host/Port:** `localhost:5432`
- **Database:** `mk_paper_mill`
- **User/Password:** `postgres` / `postgres` (dev — plain text, see security note)
- **Pool:** `backend/src/db/pool.js` (reads `backend/.env` `DB_*`)

## Migrations

- Runner: `scripts/migrate.js` — applies `db/*.sql` in order, tracked in table
  **`schema_migrations(filename, applied_at)`**. Re-running is safe (skips applied).
- Commands:
  - Status: `node scripts/migrate.js --status`
  - Apply pending: `node scripts/migrate.js`
- Base schema: `db/schema.sql` (via `npm run db:init`), never a migration.

> ⚠️ Migration files must NOT `INSERT INTO schema_migrations(version,...)` — the
> real table is `(filename, applied_at)`. A mismatched insert aborts the whole
> file (this bit us on the HRMS + holidays migrations — now fixed).

## Key table groups

| Domain | Tables |
|--------|--------|
| Core | departments, roles, users, sessions, employees |
| Production | machines, grades, shifts, reels, downtime_entries, production_summary |
| Daily Report (DPR) | daily_production_reports, dpr_gsm_breakup, dpr_chemical_lines, dpr_downtime_lines, dpr_grade_standards, furnish_mix_log, downtime_reason_codes |
| HRMS (Ph16) | employee_leave_types/balances, leave_applications, payroll_runs/details, salary_structures, appraisal_*, training_*, employee_documents, onboarding_*, separation_records, clearance_items, holidays, employee_loans |
| Consumption/Utility | chemical_consumption, utility_readings |

## How to modify
- **New table / column:** add a new `db/migration_*.sql` (idempotent: `IF NOT EXISTS`) → `node scripts/migrate.js`.
- **Never** hard-delete employees / reports — soft-delete (`is_active=false`).

## Security note
Passwords are plain `postgres/postgres` for local dev. Before any deployment:
rotate DB creds, move to env-only, restrict `pg_hba.conf`.

## Change log
- 2026-07-05 — DPR engine tables (furnish_mix_log, downtime_reason_codes, dpr_grade_standards) added.
