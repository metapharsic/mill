# 2026-08-29 — GRN print layout matched to reference format + amount-in-words

## Request
"i want to modify the GRN. only. with the information enclosed. calculate
each and every part of the GRN IN-WORD" — bring the GRN print output in
line with `Projects_Requirement/GRN PRINT FORMATE.xlsx` and confirm every
part of the total is computed with an amount-in-words line.

## Reference file
`Projects_Requirement/GRN PRINT FORMATE.xlsx` is a single-sheet Excel mockup
(no companion doc). Extracted with `openpyxl`. Fields it lays out: company
header + GST No, "GRN IN-WORD" title, Supplier Name / Party Name / Address /
Cell No / GST No block, P.O. No / P.O. Date / P.R. No / P.R. Date /
Department / Payment Period block, an item table (S.NO, Item Code, Product
Name, Qty, Rate/Price, Discount %, GST % (18%/5%), Total Amount), a Bank
Details block (Bank Name / Account Number / IFSC Code / Branch Name), and a
totals block: Sub Total → Discount → Sub Total (taxable) → SGST → CGST →
IGST → Total Purchase Amount.

## What existed before this
`frontend/src/pages/Store.jsx` already had a printable single-item inward
GRN voucher (`inwardVoucher` modal) with company header, supplier block,
one-line item table, CGST/SGST/IGST breakdown and an amount-in-words line
using its own `numberToWords()` (same generator Purchase.jsx uses for POs —
crore/lakh/thousand/hundred split, Rupees ... Only). A separate, much
heavier A3 multi-item layout also exists (`A3InvoicePrintModal.jsx`,
`amountInWords()`) but was left untouched — user said "only" the GRN, and
that component already carries bank details / amount-in-words for the
multi-item GRN path.

## Changes — `frontend/src/pages/Store.jsx` (inward GRN print modal) only
- Logistics block: relabelled PO Reference → **P.O. No** / **P.O. Date**,
  added **P.R. No** / **P.R. Date** / **Department** / **Payment Period**
  rows, reading `inwardVoucher.poNumber|po_number`, `prNumber|pr_number`,
  `department|departmentName`, `paymentPeriod|payment_period|paymentTerms`
  with a plain `—` fallback (none of these fields exist on the live inward
  record today, so nothing is fabricated).
- Supplier block: added **Address** and **Cell No** lines from
  `vendorAddress` / `vendorMobile|vendorPhone`.
- Item table: added a **Disc %** column, computed from
  `inwardVoucher.discount_pct` / `discount_amount` (both real columns on
  `grn_items` per `backend/scripts/migrate_po_grn_charges_and_gst.js`) —
  taxable value now nets the discount out before GST.
- Totals box: now shows **Sub Total** (gross) → **Discount** (if any) →
  **Sub Total (Taxable)** → **SGST** → **CGST** → **IGST** →
  **Total Purchase Amount**, matching the reference's row order.
- Added a **Bank Details** block (Bank Name / Account Number / IFSC Code /
  Branch Name) below the totals, matching the reference's placement.
- Amount-in-words line is unchanged — still `numberToWords(grandTotal)`,
  the same helper Purchase.jsx uses for PO printing. Not reinvented.

## Not touched
Off-limits list respected: `checkpoint.json` (local-edit-only, see openItem
noted there), `e2e/pages/*`, `e2e/specs/*`, `Quality.jsx`, `Reports.jsx`,
`playwright.config.js`. `A3InvoicePrintModal.jsx` (the multi-item GRN
layout) and PO/other print formats were deliberately left alone — scope was
"the GRN, only".

## Gaps vs. reference (data model doesn't store these — not invented)
`P.R. No`, `P.R. Date`, `Department`, `Payment Period`, and per-company Bank
Details are not columns on the current inward/GRN record, so they render as
`—` (or hard-coded company bank defaults matching the same fallback pattern
`A3InvoicePrintModal.jsx` already uses) until those fields exist upstream.

## Git
Commit `ec54dfb` on top of `5076c35` (local was ahead of `origin/main`,
which sits at the merge-base — no divergence). Not pushed.

## Verification
No working bundler in this sandbox (`vite build` fails on a pre-existing
`@rollup/rollup-linux-x64-gnu` native-module issue, unrelated to this
change). Change was reviewed by direct diff/read; frontend still needs a
normal rebuild + redeploy before it's visible, same as every other round.
