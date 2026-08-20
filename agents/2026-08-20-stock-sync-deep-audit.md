# Session: Deep audit — daily rollover invariant + PR-PO-GRN-stock sync — 2026-08-20 (part 3)

## Trigger
User did not trust the prior "100% verified" / "0 drift" checkpoint claims and asked
for a real double-check of: (1) the opening/received/issued/closing daily-rollover
math, (2) PR→PO sync, (3) PO→GRN→stock_ledger→current_stock sync. Ran as 3 parallel
agents, strict disjoint file ownership, explicitly instructed not to trust prior
claims and re-derive correctness from the actual SQL/code.

## Agent A — master.js daily rollover invariant
Enumerated every `transaction_type` value written anywhere in the app (12+ distinct
values: opening, grn, issue/Issue, return, return_to_vendor, transfer, cash_purchase,
adjustment_plus, Adjustment, GRN Reject, sale, receipt — far more than the 3 the test
script simulates). Date/timezone check passed — no JS-UTC-vs-Postgres-server-local
bug found in any stock_ledger write path (unlike the known reports.js bug).

**Real bug found+fixed**: `GET /materials/:id` in master.js used a narrow
`transaction_type IN ('grn','in')` / `IN ('issue','out')` whitelist instead of
`!= 'opening'` (the pattern correctly used by the other 2 endpoints in the same
file) — silently dropping returns, transfers, cash purchases, adjustments, RTV,
sales, and capitalized `Issue` from the daily total. Any material touched by one of
those types today would show a wrong Opening/Received/Issued in
`ProductDetailModal.jsx` (confirmed as the one consumer of this exact endpoint).
Fixed to match the other two endpoints' filter. The "100% pass" test script wasn't
lying — it just never exercised the 9+ real transaction types that exist outside its
own simulation.

## Agent B — PR(Indent)→PO sync
Found there are two independent conversion paths (`POST /po` with an optional
`indent_id`, and `POST /indent/:id/convert-to-po`) and both had real bugs:
1. **Double-PO bug**: neither path checked the indent's current status or reliably
   excluded existing non-Cancelled POs before creating another — an indent could be
   converted twice, or converted while still Draft/Submitted. Fixed with a
   `FOR UPDATE`-locked guard requiring `Approved` status + no live PO on both routes.
2. **Cancelled-PO orphan bug**: cancelling a PO (`PUT /po/:id/cancel`) never reverted
   the linked indent's status back to `Approved` (unlike `DELETE /po/:id`, which
   already did) — combined with bug 1's tighter guard, this would have permanently
   stuck the indent. Fixed to mirror the delete route's rollback.
3. **GST double-application bug**: `convert-to-po` computed each line's `total` as
   `qty*price*1.18`, while every other PO-creation path in the codebase (manual
   `POST /po`, `PUT /po/:id`) uses GST-exclusive `qty*price` for the line total —
   every indent-converted PO's line items were silently inflated by the GST amount
   versus a manually-raised PO for identical data. Fixed to match.
Flagged, not fixed (needs a product decision): qty/price edits on a linked PO never
sync back to the source indent (confirmed intentional one-way copy, not a bug) — added
a minimal, additive `indentRequiredQty` field to `GET /po/:id` so the UI *can* show
requested-vs-ordered qty later, without changing any write behavior. Also flagged an
unused `approved_qty` column and a `requireLevel(2)` vs `requireLevel(3)` inconsistency
between the two conversion routes as policy questions, not bugs.

## Agent C — PO→GRN→stock_ledger→materials.current_stock sync
Verified `received_qty` accumulation and PO status-flip logic (Partial/Received) are
correct, GRN creation is atomic and correctly typed, and GRN-edit delta math doesn't
double-count. Then, checking the "0 drift" claim directly rather than trusting it,
**found and fixed 2 real, systemic drift bugs**:
1. **Indent-based store issue** (`PUT /issues/:id/approve`): wrote the pre-deduction
   `mat.current_stock` into the ledger's `balance` column instead of the correctly
   computed post-deduction `newBal` — every indent-driven issue recorded a ledger
   balance too high by exactly the issued quantity. Fixed.
2. **Warehouse transfers** (`PUT /transfers/:id/dispatch` and `.../receive`): both
   routes wrote `stock_ledger` rows implying a stock change but **never actually
   updated `materials.current_stock`** — the only two stock-affecting routes in the
   file missing that UPDATE. The receive-side ledger balance also didn't even add the
   incoming qty. Fixed both — added the missing UPDATE, corrected the receive balance.
Flagged, not fixed: no idempotency guard against a duplicate GRN POST (retry would
double-count) — architectural gap, not a regression, out of minimal-fix scope; and
store.js's fast-inward path has no accepted/rejected split (only purchase.js's
`POST /po/:id/grn` route does) — a functional gap in RTV tracking if a rejection is
introduced later via GRN-edit, not a stock-sync bug.

## Result
The prior "100% verified" / "0 drift" claims did NOT fully hold under a real
re-derivation — 4 genuine bugs found and fixed across the 3 audits (1 in the daily
rollover display, 3 in the PR-PO-GRN-stock chain), plus 2 double-PO/orphan-indent
bugs. All fixes are minimal, scoped, transaction-safe, and match existing code
style. `node --check` clean on every edited file. Several items correctly flagged
as needing a product decision rather than force-fixed.

## Open items (see checkpoint.json -> openItems)
1. No idempotency guard on GRN/inward POST — a duplicate HTTP retry can double-count
   stock. Needs a request-dedup strategy (idempotency key or similar) — not fixed.
2. PO qty/price edits don't sync back to the source indent (intentional, one-way) —
   `indentRequiredQty` now exposed on `GET /po/:id` so UI *can* surface the gap; no
   frontend consumption wired yet.
3. `indent_items.approved_qty` is a dead/unused column — never populated by any
   approval step. Flagged for cleanup or wiring, not touched.
4. `convert-to-po` (requireLevel 2) vs `POST /po` (requireLevel 3) — inconsistent
   privilege threshold for functionally the same action. Needs a policy call.
5. store.js's fast-inward GRN path has no accepted/rejected split at creation time —
   only purchase.js's GRN route does. If a rejection is added later via GRN-edit, no
   material_rejections row is created for RTV tracking.
