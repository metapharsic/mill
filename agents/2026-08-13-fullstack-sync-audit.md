# Full-Stack Sync Audit — 2026-08-13

6 parallel agents audited schema/backend/frontend/workflow alignment across every module.

## Fixed (16 real breaks)
- `production.js` — `assembleDPR()` crashed every DPR call (undefined `hist`)
- `indent.js` — approval chain wrote statuses illegal per db constraint; widened constraint
- `hr.js` — loans route wrong column (`emp_code`→`employee_code`); `req.user.employee_id`→`emp_id` (3 spots)
- `chemicals.js` — sales-pick status case mismatch (`'pending'`→`'Pending'`)
- `purchase.js` — undefined var crash on PO-from-indent; GRN route targeted nonexistent table
- `reports.js` — sales report INNER JOIN excluded chemical-only sales
- `users.js` — toggle-active silently nulled user's role/department (no COALESCE)
- `maintenance.js` — schedule edit form silently blanked fields on save
- `dashboard.js` — most dept dashboards showed permanent 0/dash (missing aggregates)
- Cosmetic: dead `telemetry_expansion.js` deleted, lab/scrap alias casing normalized, payment-confirm UI wired

## Clean (no action)
Auth, Admin, Security, Employees/Attendance/Leave/Payroll, Materials/Stock, Store Indents,
Warehouse, Sections, Quality, Finance, DPS-Import, Events, EHS, Utility.
