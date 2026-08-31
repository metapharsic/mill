# 2026-08-29 — GRN print: align to definitive reference format

## Request
User uploaded the definitive GRN reference file (row-by-row extracted content) after
last session's GRN print rebuild (commits ec54dfb, 750afe9). Asked to diff the current
`frontend/src/pages/Store.jsx` GRN print voucher against this exact spec and fix only
label-wording/order deltas.

## Deltas found and fixed
- Title badge changed from "GOODS RECEIPT NOTE (GRN)" to "GRN IN-WORD" (exact heading
  text from the reference).
- Supplier/vendor info block reordered to match spec: Supplier Name -> Party Name ->
  Address -> Cell No -> GST No (was: Name -> Vendor Code -> GSTIN -> State -> Address ->
  Cell No). Vendor Code / State of Supply kept as supplementary lines after GST No
  since the app has no separate "Party Name" field distinct from vendor name — reused
  `vendorName`/`partyName` fallback.
- Item table rebuilt to the spec's exact 8 columns/order: S.NO, Item Code, Product Name,
  Qty, Rate/Price, Discount %, GST %, Total Amount (previously had extra HSN/SAC, UOM,
  Taxable Val columns and separate CGST/SGST/IGST columns). GST % column now shows the
  combined rate (CGST+SGST, or IGST for inter-state) rather than split columns — the
  split breakdown is preserved in the totals block below, matching the reference's flow.
- Totals block: "Sub Total (Taxable):" relabeled to "Sub Total:" so the label reads
  "Sub Total:" both pre-discount and post-discount (matches reference row27/row29 where
  "Sub Total" appears twice).
- Bank Details block moved to sit to the LEFT of the totals column (was previously a
  full-width block below the totals grid). Amount-in-words line moved to below the
  combined Bank Details/Totals grid, per spec order.

## Typo correction (flagged, not silently applied)
Reference source literally spells the field "Total Purchade Amount:" — this is a typo
in the customer's own template. Kept the corrected spelling "Total Purchase Amount:"
in the printed output since this document is issued to vendors; this was already
correct going into this session (no change needed there), just confirming/flagging it
per the user's explicit instruction not to silently reproduce the source typo.

## Off-limits
No changes to PO print, Quality.jsx, Reports.jsx, e2e/*, playwright.config.js,
pull_logs/, checkpoint.json (git-wise — edited locally only per instructions).

## Deploy note
Frontend needs rebuild + redeploy before this is visible in production.
