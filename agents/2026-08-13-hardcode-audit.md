# Hardcoded-Data Audit — 2026-08-13

6 parallel agents checked all 35 frontend pages for data that should be db-fetched
instead of baked into JS arrays.

## Fixed (9 real violations)
- `Login.jsx` — removed dev-scaffold quick-login with a real user's email hardcoded
- `HR.jsx` — leave-type list now fetched from `/api/hr/leave-types` (was missing PL/HL types)
- `Maintenance.jsx` — Add-Motor section dropdown now live-fetched (2 offered sections didn't exist)
- `Dashboard.jsx` — "Pending Indents Value" KPI was a permanent hardcoded dash
- `Indent.jsx` — section list now fetched from `/api/sections` (was drifted)
- `Machines.jsx` — section sidebar now live-fetched (icon/type kept as local lookup maps, not db data)
- `Purchase.jsx` — `WAREHOUSES` had zero backing table; created `warehouses` table + endpoint
- `MasterData.jsx` — fake 4-department array replaced with real fetch (db has 20)
- `DailyReport.jsx` — date input defaulted to a hardcoded past date instead of today

## Clean
Everything else across all 35 pages — verified each suspicious array against live schema
before flagging; small fixed enums matching db CHECK constraints are correctly left as-is.
