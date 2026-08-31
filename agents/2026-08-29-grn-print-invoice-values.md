# 2026-08-31 — GRN print: verify invoice-matched values are the source of truth (audit, no bug found)

## Request
User clarified the earlier GRN-print rebuild (ec54dfb): every number on the
printed GRN — rate, disc%, GST%, per-line amounts, grand total, and the
amount-in-words line — must trace back to the actual vendor invoice values
captured in the Store.jsx "Match Vendor Invoice Against Received DC(s)"
tick-mark flow (POSTed through `/api/inbound-dc/:id/grn`), never the stale
PO/catalog price.

## Investigation
1. `backend/src/routes/inboundDc.js` `POST /:id/grn` — for each DC line it
   looks up `overrideMap[it.id]` (the invoice-matched `unit_price` /
   `discount_pct` / `gst_amount` submitted from the Store.jsx tick-mark UI)
   and, when present, writes exactly those values into the new
   `grn_items` row (`unit_price`, `discount_pct`, `taxable_amount`,
   `total_amount`, `gst_pct` via the shared `computeLineValue()` helper).
   The catalog `materials.unit_price` is only a fallback used when no
   override was submitted. So the invoice-matched numbers already land in
   `grn_items`, not just an audit trail — no bug here.
2. GRN print path: `Store.jsx openA3Invoice()` -> `GET /api/store/grn/:id`
   (`backend/src/routes/store.js`) and its fallback `GET
   /api/purchase/grn/:id` (`backend/src/routes/purchase.js`) both select
   `gi.*` straight off `grn_items` for the item table (unit_price,
   discount_pct, taxable_amount, total_amount, gst_pct), only left-joining
   `po_items`/`materials` for HSN/name/category metadata and a GST% or
   taxable/total fallback when a row genuinely has nulls — price/discount
   are never re-pulled from `po_items` or `materials`. Confirmed both the
   new inbound_dc/invoice-match path and the old PO->GRN path
   (`purchase.js`'s `/po/:id/grn`) land in the same `grn_items` table and
   are read by the same print fetch, so both print off actual
   received/invoiced values.
3. `frontend/src/components/A3InvoicePrintModal.jsx` (the actual GRN print
   component) builds `processedItems` from that same `items` array —
   per-line price/disc/GST come from `it.unit_price` / `it.discount_pct` /
   `it.taxable_amount` / `it.total_amount` (i.e. `grn_items` columns), and
   `totalTaxable`/`totalGst`/`totalLineVal` are accumulated from those same
   per-line values. `grandTotal = computedSubTotal + roundOffNum` (not a
   separately-fetched `grn.grand_total`), and `amountInWords(grandTotal)`
   consumes that identical number. The GST-slab summary table, the grid
   line totals, "NET PAYABLE" line, and the words line are all derived from
   one shared computation — nothing forks off a stale/separate total.

## Outcome
No mismatch found. The prior round (this session's earlier GRN-print
rebuild plus the inbound_dc GRN route) already got this right: grn_items is
the sole source of truth for both GRN-creation paths, and the print modal's
grid, grand total, and amount-in-words line all derive from the same
computed values — no code changes were necessary.

## Files reviewed (unchanged)
- `backend/src/routes/inboundDc.js` (`POST /:id/grn`)
- `backend/src/routes/store.js` (`GET /grn/:id`)
- `backend/src/routes/purchase.js` (`GET /grn/:id`, `POST /po/:id/grn`)
- `frontend/src/pages/Store.jsx` (`openA3Invoice`)
- `frontend/src/components/A3InvoicePrintModal.jsx`

## Off-limits
Not touched: e2e/pages, e2e/specs, Quality.jsx, Reports.jsx,
playwright.config.js, pull_logs/. checkpoint.json openItems note added
locally only, not committed.
