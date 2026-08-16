# Store ERP Workflow Wiring — 2026-08-13

5 parallel agents verified + wired full DML across the 11-step store flow:
vendor/item creation → PR/indent → PO → GRN → stock intake → dept-wise issue.

## Fixed
- **Vendor/Item**: materials & vendors PUT had no-COALESCE bug (partial edit nulled
  unrelated fields) — fixed both. `is_serialized`/`expected_lifespan_days` existed in db
  but were invisible to the UI — wired end to end.
- **Indent (PR)**: Draft indents had no edit path, create-once only — added full edit.
- **PO/GRN**: GRN submit form sent snake_case, backend wanted camelCase — **entire GRN
  entry flow was dead on arrival**. Also GRN-from-PO never updated `po_items.received_qty`
  or flipped PO status. Added accounts-dept notification on GRN completion (was missing).
- **Dept issue**: `store_issues` had no edit/cancel, no dept-wise breakdown view despite
  the data supporting it — added both + a dept-summary endpoint.

## Excel provisioning check (separate read-only pass)
All 958 real item codes from Electrical/Mechanical/Stationery excels confirmed present
in `materials`, categorization essentially correct (7 welding-rod codes debatably filed
under GEN instead of MECH). `Metapharsic_Master_2000_Item_CMMS_Ledger.xlsx` confirmed
fabricated demo data, not real mill records.
