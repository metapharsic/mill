# 2026-08-29 — Live crash: po_items.remarks column missing

## Request (with screenshot evidence)
Right after the previous round's PO fix, saving/creating a PO now throws
`column "remarks" of relation "po_items" does not exist`.

## Root cause
The `po_items` INSERT (touched in the earlier 529c33f received_qty fix)
always included `remarks` (the per-line Description/Specifications text
field visible in the PO item grid), but the real `po_items` table never had
that column -- confirmed against `db/schema.sql`. Found a pre-existing
`db/migration_po_remarks_and_status.sql` file that was clearly meant to add
this column but was never actually run as a script. `purchase.js` itself
needed no code changes -- the INSERT was correct, the database was just
missing the column underneath it.

## Fix
New `backend/scripts/migrate_po_items_remarks.js` (same pattern as the
prior round's `migrate_po_roundoff.js`): `ALTER TABLE po_items ADD COLUMN
IF NOT EXISTS remarks text`. Re-verified no OTHER po_items columns are
missing -- everything else the INSERT references is already covered by the
earlier `migrate_po_grn_charges_and_gst.js`.

## Verification
- `node --check` passed on the new script.
- `git fetch origin`, no divergence, committed only the new script:
  `b7a716e` on top of `8563821`.

## CRITICAL -- user now has TWO pending migrations
Both must be run against the real database before PO create/edit works at
all (order doesn't matter, both are idempotent/safe to re-run):
```
node backend/scripts/migrate_po_roundoff.js
node backend/scripts/migrate_po_items_remarks.js
```
Then restart the backend, then retest PO create/save.
