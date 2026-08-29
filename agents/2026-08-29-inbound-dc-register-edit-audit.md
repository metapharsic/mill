# 2026-08-29 — Inbound DC: Register, Edit, Cancel + Audit Trail

## Request
"How can i see list of DC created, the entire DML operation, and Editing
with the same things we have done for indents and all. the features should
be applied here as well. and reporting should be updated." — i.e. give
`inbound_dc` the same treatment Indent already has: a full register/list
view, edit capability, and an audit trail of every create/update/delete
operation.

## Investigation first
- `frontend/src/pages/Indent.jsx` has an "All Indents Register" tab (list +
  filters + click-through detail) and a force-delete (permanent purge, with
  compensating stock restore) gated behind `window.confirm(...)`.
- `backend/src/routes/indent.js` writes its own bespoke `indent_audit_log`
  table (indent_id, action, old_status, new_status, user_id, remarks) on
  every status transition.
- A **generic** `audit_log` table already exists and is reused across
  finance.js, production.js, purchase.js and master.js via a shared
  `audit(clientOrNull, {...})` helper in
  `backend/src/middleware/helpers.js` (user_id, module, action, record_id,
  old_data, new_data, ip_address as JSON). `admin.js`'s footsteps endpoints
  already query it the same way a per-record history view would need to.

Decision: reuse the generic `audit_log` + `helpers.audit()` for Inbound DC
(`module: 'InboundDC'`) rather than inventing a third audit pattern or
copying indent's bespoke table — it's the more standard, lower-friction fit
for a brand-new module with no existing audit table of its own.

## Backend changes (`backend/src/routes/inboundDc.js`)
- Imported `{ audit }` from `../middleware/helpers`.
- `POST /` (create), `POST /:id/match-invoice`, `POST /:id/grn` each now
  write one `audit_log` row (CREATE / MATCH_INVOICE / GRN_CONVERTED).
- New `PUT /:id` — edit DC header + items. Guard: only while
  `status='received'`; otherwise 400 "Only DCs still awaiting invoice match
  ('received') can be edited." Reverses the old items' provisional stock/
  ledger effect (adjustment_minus rows, retags the old provisional_grn rows
  to `provisional_grn_superseded`) before deleting and re-inserting the item
  set with fresh `provisional_grn` ledger rows — mirrors the compensating-
  ledger pattern indent's force-delete already uses. Writes an UPDATE audit
  row.
- New `DELETE /:id` — cancel, not a hard delete (`status='cancelled'`).
  Guard: refused once `status='grn_done'` ("Void the GRN instead") and if
  already cancelled. Reverses provisional stock (adjustment_minus, retags
  ledger to `provisional_grn_reversed`). Writes a CANCEL audit row.
- New `GET /:id/history` — reads `audit_log WHERE module='InboundDC' AND
  record_id=:id`, joined to `users` for the actor name, same shape as
  `admin.js`'s existing footsteps queries.

## Frontend changes (`frontend/src/pages/InboundDC.jsx`)
- New "All Inbound DCs Register" tab: status filter dropdown (all / received
  / invoice_matched / grn_done / cancelled), manual Refresh, table of DC No,
  Date, Vendor, Status badge, Invoice No, Value, Item count, and per-row
  actions.
- Edit modal (reuses `SearchableSelect` for vendor/material, same field
  layout as the Receive form) — Edit button shown only for `status=
  'received'` rows, calls `PUT /inbound-dc/:id`.
- Cancel action — shown for `received`/`invoice_matched` rows, gated behind
  `window.confirm(...)` (matches the existing confirm convention in
  Indent.jsx/Store.jsx), calls `DELETE /inbound-dc/:id`.
- History modal — lists that DC's `audit_log` rows (action, user, time),
  calls `GET /inbound-dc/:id/history`.

## Reporting (`frontend/src/pages/StoreDashboard.jsx`)
Added a "Cancelled" KPI tile to the existing "Inbound DC & Invoice Match"
card. The `GET /inbound-dc/summary` endpoint already returned `cancelled`
from the prior round — only the missing UI tile was added. No caching
introduced; register/history reads are live queries like everything else in
this feature.

## Docs
Appended a "Register, Edit, Cancel + Audit Trail" section to
`Projects_Requirement/inbound_dc_workflow.md`. Added one `checkpoint.json`
`openItems` line (edited locally only, not staged/committed — gitignored,
tracked by a different agent).

## Verification
- `node --check backend/src/routes/inboundDc.js` — pass.
- Brace/paren balance check on the full `InboundDC.jsx` after edits — pass
  (0/0). No bundler/babel-parser available for this file in this sandbox
  this round; JSX changes were hand-reviewed against the file's existing
  patterns instead of tool-verified.
- No live DB in this sandbox — routes are logic-verified only, not run
  against real data.

## Off-limits confirmed untouched
`checkpoint.json` (git-tracking — edited locally only), `e2e/pages/*.js`,
`e2e/specs/*.spec.js` (no new test added this round — kept scope tight per
instructions saying it's optional), `frontend/src/pages/Quality.jsx`,
`frontend/src/pages/Reports.jsx`, `playwright.config.js`, `pull_logs/`.

## Still open (same standing caveats as every prior round on this feature)
1. `backend/scripts/migrate_inbound_dc.js` has NOT been run against the DB.
2. Backend/frontend have not been restarted/rebuilt since these changes.
3. User decision (carried over from the previous round): keep or remove
   the now-partially-redundant `InboundDC.jsx` "Pending"/"Ready" tabs given
   Store.jsx's tick-mark flow — this round adds the Register/Edit/Cancel/
   History tabs to the same file, so that decision now also covers whether
   those stay here or move if the page is ever retired.
