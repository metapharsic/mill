# Session: Strict chain validation — Gate Pass, QC, AP Settlement — 2026-08-20 (part 4)

## Trigger
User asked for strict validation of the full PR→PO→Gate Pass→GRN→QC→AP Settlement
chain (functionality, logic flow, decisions, dependencies, tabs/UI) and wanted honest
suggestions if something looks wrong. PR→PO and PO→GRN→stock were already deep-audited
in part 3 today; this round covers the three remaining links. Ran as 3 parallel
agents, strict disjoint file ownership, plus one direct follow-up fix.

## Agent — Gate Pass (security.js + Security.jsx)
Lifecycle mostly real and wired, but found and fixed 3 real gaps: `PUT /passes/:id`
existed server-side with zero UI entry point (added Edit button+modal); that same
route was missing the `requireGuard` permission check every other gate-pass mutation
route has (any authenticated user of any department could edit a pass — fixed); and
`POST /passes` didn't reject a gate pass created against a Cancelled PO (fixed).
Also found `security.js`'s `POST /rtv-pass` is dead code — the live RTV path is
actually `store.js`'s own route, Security.jsx never calls the security.js one.

**Suggestions flagged (process decisions, not bugs)**: gate pass is not mandatory
before GRN today (store.js's inward accepts zero gate-pass linkage); nothing stops
a guard marking a truck "OUT" before Store ever GRNs it; two duplicate RTV/edit code
paths exist across store.js and security.js risking future drift; some pass types
(VISITOR, RETURNABLE) are defined but never reachable from the UI.

## Agent — QC (quality.js + Quality.jsx)
**Critical bug found+fixed**: GRN creation already applies the accepted/rejected
split to `materials.current_stock` and `material_rejections` at intake time — QC's
`grn-inspect` route then ran afterward and blindly re-applied the FULL quantity again,
meaning a QC decision was double-counting stock and duplicating rejection/debit-note
rows, not correcting anything. Fixed to diff against the existing decision and apply
only the delta. A second, compounding bug: `Quality.jsx` never sent `grnItemId` in its
inspection payload, so the backend update silently no-op'd on every real inspection —
fixed by threading the id through. Also removed a fake-fallback that fabricated a
bogus inspection line (wrong material, hardcoded 100/100/0 qty) when the real GRN
items failed to load, letting a real accept/reject decision get submitted against
made-up data.

**What QC actually is**: both an incoming-GRN inspection layer AND a standalone
lab-testing module (Process/Final/Customer tests on Reels) — not purely one or the
other. **Suggestion flagged**: QC is a correction layer today, not a mandatory gate —
the accept/reject split is already decided and applied by whoever keys in the GRN,
before QC ever sees it; if the business wants "nothing counts as stock until QC signs
off," that needs the GRN routes themselves changed to hold qty out of current_stock
pending inspection (a real schema/flow redesign, not a quick patch — not attempted).

## Agent — AP Settlement (finance.js + Finance.jsx)
**Critical bug found+fixed**: vendor bills had zero server-side validation tying the
billed amount to the GRN's ACCEPTED (post-QC) value — a bill's taxable amount was
purely operator-entered. Added a guard in `finance.js`'s `POST /bills`: when a
`grn_id` is given, rejects the bill if the amount exceeds the GRN's accepted value by
more than a 2% tolerance. Also found and fixed 2 more real money-correctness bugs in
`finance.js`: `GET /ap`'s AP Ledger numbers were inflated by a one-to-many × one-to-many
join fan-out (vendors × bills × POs cross-joining, same bug class this codebase's own
purchase.js already has a documented LATERAL-subquery fix for elsewhere) — fixed with
LATERAL subqueries; and `GET /payments/vendor`'s `totalAmount` was summed over only
the paginated 100-row page instead of the full result set — fixed with a real SUM().
Double-payment guard verified genuinely solid (`FOR UPDATE` row lock before balance
check, no race condition).

**Suggestion flagged (not fixed, policy call)**: bill-approval and payment-disbursement
both only require role_level 3 with no check preventing the same person doing both —
no maker-checker segregation, even though the codebase already has that exact pattern
for customer-payment confirmation. Recommend applying it here too.

## Follow-up direct fix — purchase.js (not part of any agent's file ownership)
The AP-Settlement agent found the SAME accepted-vs-ordered-value bug exists in
`purchase.js`'s `POST /po/:id/bill` — the actual live route the Purchase module UI
uses to book bills (Finance.jsx has no "create bill" form of its own, only
approve/pay) — but couldn't fix it since purchase.js wasn't in its edit scope. This
was the more serious instance since it's the primary path: `taxable_amount` defaulted
to `po.total_value` (the full ORDERED value) whenever omitted, meaning an unbilled
amount could silently become "pay the full PO" with zero indication anything was
rejected at QC. Fixed directly after the agents finished: taxable_amount is now
required (no fallback), and the same GRN-accepted-value 2% guard from finance.js was
added here too. `node --check` clean, committed.

## Result
7 real bugs found and fixed across Gate Pass, QC, and AP Settlement (2 permission/
wiring gaps in Gate Pass, 2 stock-double-count/dead-payload bugs in QC, 3
money-correctness bugs in AP + 1 matching fix in purchase.js's live bill-booking
path). The QC double-counting and the bill-defaults-to-full-PO-value bugs were the
most serious — both meant real financial/stock numbers were silently wrong, not just
cosmetic. Several genuine process-design questions flagged rather than force-fixed
(gate pass not mandatory before GRN, QC not a mandatory stock gate, no maker-checker
on AP approve/pay).

## Open items (see checkpoint.json -> openItems)
1. Gate pass linkage to GRN is optional today — decide if it should be mandatory.
2. QC is a correction layer, not a mandatory hold-back gate on current_stock — decide
   if that's the intended design or needs a flow change.
3. No maker-checker segregation between AP bill-approval and payment-disbursement.
4. Dead/duplicate RTV code path in security.js (store.js's is the live one) — decide
   whether to delete or consolidate.
5. Unreachable gate-pass types (VISITOR, RETURNABLE) defined but never used by the UI.
