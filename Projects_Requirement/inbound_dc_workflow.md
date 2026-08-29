# Inbound Delivery Challan (DC) Workflow

## The gap this closes
Previously, `grn` / `grn_items` could only be created via `POST /api/purchase/po/:id/grn`,
which requires an Approved/Partial Purchase Order and asks for invoice info
(`invoice_number`, `challan_number`) in the very same request that creates the
stock-in. In real operation, goods routinely arrive at the gate on a vendor's
delivery challan (DC) *before* the invoice is available (invoice comes by post/
email days later, or needs price/quantity reconciliation). There was no way to
get material into usable stock the day it physically arrives without also
having the invoice in hand at that moment.

## New tables (backend/scripts/migrate_inbound_dc.js — NOT YET RUN)
- `inbound_dc` — id, dc_no, dc_date, vendor_id (FK vendors, if that table
  exists live), vehicle_number, remarks, status
  (`received` → `invoice_matched` → `grn_done`, or `cancelled`),
  invoice_number, invoice_date, matched_by, matched_at, grn_id, created_by,
  created_at.
- `inbound_dc_items` — id, inbound_dc_id (FK), material_id (FK materials),
  qty, unit, batch_no.

## New API endpoints (backend/src/routes/inboundDc.js, mounted at
`/api/inbound-dc` in backend/src/server.js)
- `POST /api/inbound-dc` — create a DC + items. In one transaction: inserts
  the DC and its items, bumps `materials.current_stock` for each item, and
  writes a `stock_ledger` row with `transaction_type = 'provisional_grn'`
  (reference_type `INBOUND_DC`) — a clearly-flagged provisional stock
  increase, before any invoice has been matched.
- `GET /api/inbound-dc` — list, filterable by `status` and `vendor_id`.
- `GET /api/inbound-dc/:id` — one DC with its items.
- `POST /api/inbound-dc/:id/match-invoice` — records `invoice_number`,
  `invoice_date`, and a required `party_name_confirmed` boolean; moves status
  `received` → `invoice_matched`. Deliberately simple — no fuzzy string
  matching, just an explicit user confirmation.
- `POST /api/inbound-dc/:id/grn` — converts an `invoice_matched` DC into a
  real `grn` + `grn_items` row set (PO is optional/absent — `po_id` is NULL,
  confirmed nullable live). Re-tags the earlier `provisional_grn` stock_ledger
  row(s) to `transaction_type = 'grn'` pointing at the new GRN — stock is
  NOT re-added at this step, since it was already added at DC-receipt time.
  Sets `inbound_dc.status = 'grn_done'` and `inbound_dc.grn_id`.

## New UI (frontend/src/pages/InboundDC.jsx, nav key `inbound-dc`)
Registered in `App.jsx` (page map, nav keys, titles), `Sidebar.jsx` (under the
"Store & Indent" group), and `data/permissions.js` (same department gate as
`store-reports`: Store Management / Inventory / Raw Material Store /
Purchase). Three tabs:
1. **Receive DC** — vendor picker, DC No/Date, vehicle number, remarks, and a
   repeatable item-row grid (material, qty, unit, batch no). Submits to
   `POST /api/inbound-dc`.
2. **Pending Invoice Match** — table of `status='received'` DCs with a
   "Match Invoice" button opening a small modal (invoice number/date + a
   required "party name matches" checkbox).
3. **Matched — Ready for GRN** — table of `status='invoice_matched'` DCs
   with a "Create GRN" button.

## Manual steps required before this works
1. Run the migration: `node backend/scripts/migrate_inbound_dc.js`
   (idempotent — safe to re-run).
2. Restart the backend Node process so it picks up the new route file and
   `server.js` registration.
3. Rebuild/redeploy the frontend per the repo's normal build flow.

## Known limitations / deviations from a fuller spec
- `party_name_confirmed` is a simple user checkbox, not automated fuzzy
  matching against the vendor record — intentional per the implementation
  plan ("no complex fuzzy matching needed").
- Indent.jsx was checked for a free-text inbound-vendor-DC reference field to
  upgrade to a dropdown (per an earlier plan item) — none exists. The only
  "DC" concept already in Indent.jsx is an unrelated *outward* material
  dispatch challan (`dc_type: 'MATERIAL_OUT'`), so no change was made there.
