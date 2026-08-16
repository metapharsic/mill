# Mechanical Store Sub-Categorization — 2026-08-13

Source: `Projects_Requirement/MECHANICAL STORE AUGUST-2026.xlsx` (21 sheets).

## Schema
`material_categories.parent_id` added (self-referencing, general feature — any category
can have a parent). 17 real subcategories seeded under Mechanical (excluded 3 legacy
duplicate sheets + 1 non-item pump-master sheet). See `db/migration_mechanical_subcategories.sql`.

## Data
- 623 materials reassigned from generic Mechanical into correct subcategory by item code.
- 26 items across two passes were genuinely never provisioned (9 Compressor, 6 Pulley,
  1 Nozzle, 5 more bearings, 1 valve, 4 bolts/washers) — inserted honestly at stock=0.
  See `db/migration_mechanical_missing_items.sql`.
- 17 `materials.name` values were wrong (db had truncated model numbers, excel carries
  full brand+spec text, e.g. "ZVL 23044 KW33MC3") — corrected via reusable importer.

## Reusable importer
`backend/scripts/import_mechanical_store.js` — single source of truth for the excel→db
column mapping. Runs standalone (`node scripts/import_mechanical_store.js --dry-run`) or
via the app: `POST /api/master/materials/sync-mechanical` (dry-run + confirm), triggered
from a "⟳ Sync Mechanical from Excel" button in Materials.jsx. Never touches stock
quantities — PHY STOCK/RECEIVED/ISSUE/BALANCE columns are deliberately skipped (writing
them would corrupt live stock_ledger accuracy).

## Open — needs a human decision (not auto-resolved)
4 item codes have genuinely conflicting descriptions between db and current excel
(same code, different physical item — likely code reuse/renumbering upstream). Full list
in `checkpoint.json` → `openItems`. Two of these (`GCW0002`, `GSSBN0023`) are also
duplicated *within the excel itself* — a source-file defect, not just a db/excel mismatch.

## UI additions
- Materials.jsx category filter/form now hierarchical (`<optgroup>` per parent).
- Category-filtered material list no longer truncated to 30 rows (was hiding most of
  a 170+ item subcategory).
- Read-only Balance/Received/Issued display in item edit modal, computed live from
  `stock_ledger` — never hand-editable, can't drift from real transaction history.
