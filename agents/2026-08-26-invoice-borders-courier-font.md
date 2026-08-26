# 2026-08-26 — Invoice borders + Courier monospace figures

## Request
"The invoices doesnt have the borders, and the item and calculation should be
done in courier font. for all the invoices."

## Root cause
Print CSS for invoices (`#print-document`, `#a3-print-wrapper` scope, from the
prior 1dfe08e fix) only styled visibility/layout — no border rules, no figure
font override. Also, that CSS only targets real `<table>` markup, so
table-based invoices (A3InvoicePrintModal.jsx, Purchase.jsx) could be fixed
with a plain table/th/td rule, but HR.jsx's payslip (`SlipRow`, a `<div>` row
component) and Store.jsx's SIV voucher (plain `<div><b>Label:</b> value</div>`
rows) have zero `<table>` elements and would not be touched by a table-only
rule.

## Fix
- `frontend/src/styles/global.css`: added `border: 1px solid #000` +
  `border-collapse: collapse` to `table/th/td` inside `#print-document` and
  `#a3-print-wrapper`, `font-family: Courier New, Courier, monospace` on
  `td`. Added a second rule for a new shared `.invoice-line` /
  `.invoice-line-value` class pair to cover non-table invoice rows.
- `frontend/src/pages/HR.jsx`: `SlipRow` div now has `className="invoice-line"`,
  its amount `<span>` has `className="invoice-line-value"`.
- `frontend/src/pages/Store.jsx`: SIV voucher modal's item/figure `<div>` rows
  now carry `className="invoice-line"`, with `.invoice-line-value` on the
  Issued Quantity / Store Balance Remaining / Valuation figures.

## Build & commit
- Rebuilt frontend via the scratch-dir workaround (Linux VM node_modules
  incompatible with Windows-mounted frontend/); new hash
  `index-D6D_l_W4.css` / `index-vX2V4JHT.js`, copied into real `frontend/dist`.
- Verified `git fetch origin` showed local == origin/main before committing
  (no divergence from any concurrent agent work).
- Committed as `8c53f31` on top of `1dfe08e`.

## Still needed from user
- `git push origin main` from your own machine (no stored GitHub creds in
  this sandbox) — or run `push_to_github.bat`.
- Restart backend is NOT required (frontend-only change); just hard-refresh
  the browser once the rebuilt `dist` is what's being served (or restart if
  serving via `:5000` static and it was already running against stale dist
  — restarting is always safe if unsure).
