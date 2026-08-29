# 2026-08-29 — New feature: Inbound Delivery Challan (DC) workflow

## Request
Close a gap in the PO→GRN flow: currently GRN only exists 1:1 against an
Approved PO, created atomically together with the vendor invoice info. There
was no "goods physically received, invoice not here yet" state — build one.

## What was built
- **Migration** `backend/scripts/migrate_inbound_dc.js` (idempotent,
  `CREATE TABLE IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS`, follows the
  `migrate_vendor_bank_details.js` pattern) — creates `inbound_dc` and
  `inbound_dc_items`. **NOT RUN** — no DB access from this sandbox.
- **Route** `backend/src/routes/inboundDc.js`, mounted at `/api/inbound-dc` in
  `backend/src/server.js`:
  - `POST /` create DC + items, provisional stock bump + `stock_ledger` row
    tagged `transaction_type='provisional_grn'`.
  - `GET /`, `GET /:id`.
  - `POST /:id/match-invoice` records invoice number/date + an explicit
    `party_name_confirmed` checkbox, moves status to `invoice_matched`.
  - `POST /:id/grn` converts a matched DC into a real `grn`/`grn_items` row
    set with `po_id = NULL` (confirmed nullable live via
    `truncate_test_pos.js`, which sets it to NULL), and re-tags the earlier
    provisional ledger row to `transaction_type='grn'` instead of adding
    stock a second time.
- **Frontend** new page `frontend/src/pages/InboundDC.jsx` (kept separate
  from the already-huge `Store.jsx`, which another agent is concurrently
  editing) with 3 tabs: Receive DC, Pending Invoice Match, Matched/Ready for
  GRN. Wired into `App.jsx` (imports, `NAV_KEYS`, `PAGE_COMPONENTS`,
  `PAGE_TITLES`), `Sidebar.jsx` (new nav item under "Store & Indent", reusing
  the already-imported `PackageCheck` icon), and `data/permissions.js` (same
  dept gate as `store-reports`).
- **Docs** `Projects_Requirement/inbound_dc_workflow.md`.

## Verified before writing (live repo facts, not assumed)
- Read the real PO→GRN code in `backend/src/routes/purchase.js`
  (`POST /po/:id/grn`) to mirror exact column names for `grn`/`grn_items`/
  `stock_ledger` inserts, and the `auth`/`requireLevel`/`requireStore`
  middleware pattern.
- `vendors` table confirmed to exist (via `migrate_vendor_bank_details.js`
  already altering it), so `inbound_dc.vendor_id` gets a real FK. The
  migration script still defensively checks `to_regclass('public.vendors')`
  live before adding the FK, in case that changes before it's run.
- `grn.po_id` confirmed nullable (`truncate_test_pos.js` sets it to NULL) —
  so the plan's "PO optional" requirement needed no compromise.
- No CHECK constraint found anywhere on `stock_ledger.transaction_type` in
  the codebase (it's used as free text: `'grn'`, `'issue'`, `'in'`, `'out'`,
  `'opening'`) — safe to add a new value `'provisional_grn'`.
- Checked `frontend/src/pages/Indent.jsx` for a free-text inbound vendor-DC
  field to upgrade to a dropdown per the plan — none exists; its "DC" is an
  unrelated outward MATERIAL_OUT dispatch challan feature. Skipped that step
  as instructed rather than inventing a field.

## Verification
- `node --check` passed on `migrate_inbound_dc.js`, `inboundDc.js`, and
  `server.js`.
- `git fetch origin`, compared `git log` local vs `origin/main` before
  committing — no divergence.

## CRITICAL — pending manual steps
1. `node backend/scripts/migrate_inbound_dc.js` against the real database.
2. Restart the backend Node process.
3. Rebuild/redeploy the frontend per the repo's normal flow.

Nothing in this feature works until step 1 and 2 are done.
