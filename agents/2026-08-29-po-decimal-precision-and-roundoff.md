# 2026-08-29 — PO create: remove per-item rounding, add manual round-off

## Request (with screenshot evidence)
Unit Rate input in Create PO rejected `69.49153` with browser message
"nearest valid values are 69.49 and 69.5" -- user wants that removed, and a
manual round-off option added at the overall PO total level instead.

## Fix 1 — decimal precision
`frontend/src/pages/Purchase.jsx` Create PO item grid: qty/unit-rate/disc%/
other-charge inputs had `step="0.001"`/`step="0.01"`, which makes the
browser's native HTML5 validation reject any value not aligned to that
step. Changed all four to `step="any"` -- disables step-alignment
validation entirely while staying a proper number input. No more forced
rounding on typed values.

## Fix 2 — manual round-off on PO totals
Added a "Round Off (Rs)" input to the Create PO summary footer (between
Total Tax and Grand Total), wired to new `form.roundoff` state.
`grandTotal = subtotal + totalTax + roundoff`. Backend `POST /po` and
`PUT /po/:id` updated to accept/store `roundoff`.

## CRITICAL — DB migration required before this can go live
`purchase_orders` has NO `roundoff` column in the database today (verified
across all existing migration scripts). Wrote
`backend/scripts/migrate_po_roundoff.js` (`ALTER TABLE purchase_orders ADD
COLUMN IF NOT EXISTS roundoff numeric(15,2) DEFAULT 0`) but this sandbox
has NO database connection (`ECONNREFUSED 127.0.0.1:5432`) -- could not run
it. **Until someone runs this migration against the real DB, PO
create/edit will throw "column roundoff does not exist" and BREAK.** This
must happen before backend restart/deploy of this commit.

## Verification
- `node --check backend/src/routes/purchase.js` passed.
- Rebuilt frontend, new hash `index-CQ2qzc5-.js`.
- Commit `d31ef9e` on top of `165d2f2`, only Purchase.jsx, purchase.js, and
  the new migration script touched. Other-agent files confirmed untouched.

## Still needed from user (in this exact order)
1. Run `node backend/scripts/migrate_po_roundoff.js` against the real
   database.
2. Restart the backend.
3. Hard-refresh browser.
4. Push from own machine.
