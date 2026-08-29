# 2026-08-29 — Invoice round-off made manually editable

## Request
"as senior store manager, the round off should be given to user, rather
hardcoding, make sure for all the invoices round off should be manually
entered."

## Investigation
Grepped every invoice/voucher surface for round-off handling. Found exactly
2 real problem spots (everything else was either fine or an unrelated
`Math.round` for progress bars/payroll, not invoices):

1. `frontend/src/components/A3InvoicePrintModal.jsx` (the shared A3 GST
   voucher print/preview used by Indent.jsx, Store.jsx, Purchase.jsx):
   `roundOff` was purely `Math.round()`-derived with zero way to override.
2. `frontend/src/pages/Purchase.jsx` vendor bill entry form: `billForm`
   already HAD a `roundoff` key and the backend already accepted/stored it
   from the request body as-is -- but no `<input>` was ever rendered for it,
   so it was permanently stuck at 0, unreachable by any user.

Backend (`purchase.js`, `finance.js`, `indent.js`) needed NO changes -- all
three already read `roundoff` straight from `req.body` and persist it,
never computing/overriding it server-side.

## Fix
- A3InvoicePrintModal: added a live editable number input, seeded from the
  same `Math.round()` suggestion (so it's not blank/zero by default) but
  fully overridable; screen shows the input (no-print class), the actual
  printed page shows the resulting plain value.
- Purchase.jsx: added the missing "Round Off (Rs)" input bound to
  `billForm.roundoff`, matching the neighboring tax-field input style.

## Verification
- `git fetch origin`, confirmed no divergence.
- Committed only the 2 touched files: `06e3181` on top of `e647383`.
- Confirmed via `git status` after commit: all 13 other-agent in-progress
  files (checkpoint.json, e2e/*, Quality.jsx, Reports.jsx,
  playwright.config.js) still sit exactly as before, untouched.
- Rebuilt frontend, new hash `index-BMzWKLj4.js`, deployed to
  `frontend/dist/`.

## Still needed from user
- Push from own machine.
- Hard-refresh browser (frontend-only change, no backend restart needed).
