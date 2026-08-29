# 2026-08-29 — PO appended items not saving/reflecting properly

## Request
"po appended are not saving. make sure for all the appended item, its
saving and reflecting properly."

## Root cause
`backend/src/routes/purchase.js`, `PUT /po/:id` (the route behind Purchase.jsx's
Edit PO modal, which is how items get appended to an already-created PO):
did `DELETE FROM po_items WHERE po_id=$1` then re-INSERTed every item fresh
on every save -- including simply appending one new line. This wiped
`received_qty` (maintained separately by the GRN-receiving flow elsewhere in
the same file) back to 0/NULL for every EXISTING line on the PO, not just the
new one, and re-issued new row ids. The save itself reported success (no
error), so the bug was invisible until checking actual received/remaining
quantities on a PO that already had partial GRN receipts against it -- which
matches "appended items not saving/reflecting properly."

## Fix
Before the delete, snapshot existing `po_items.received_qty` keyed by
`material_id`. When re-inserting, carry the matched `received_qty` forward
instead of defaulting to 0. Added a code comment warning against
reintroducing this. Verified duplicate-material double-append is already
blocked by an existing `seen`-set check earlier in the same route -- no
separate fix needed there.

## Verification
- `node --check backend/src/routes/purchase.js` → syntax OK
- `git fetch origin` confirmed no divergence before commit
- Committed ONLY `backend/src/routes/purchase.js` (confirmed via git status,
  nothing else swept in)
- Commit: `529c33f` on top of `7fdece1`

## Still needed from user
- **Restart the backend Node process** (stop/start script) -- route files
  are not hot-reloaded (`watch:false`), so this fix does nothing until
  restarted.
- Push from own machine.
- No frontend rebuild needed (backend-only fix).
