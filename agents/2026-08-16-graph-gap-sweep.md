# Session: Whole-codebase gap sweep (graph-model multi-agent)

## Trigger
User: "do you see any gaps in the entire flow, or logic, decision, dependencies —
use the multi agent model like graph technology to fix and resolve, show status
of each agent."

## Approach
1. Grounded a real baseline myself first (not guessed): swept all backend route
   files with `node --check` (all clean), confirmed all 27 route files mounted
   in server.js (no orphans).
2. Dispatched 1 read-only graph-analysis scout agent using GitNexus/codegraph
   MCP tools to find structural gaps a grep pass would miss (dead code, shadowed
   routes, blast-radius hotspots) — deliberately read-only so 3 parallel fix
   agents could write without racing it.
3. Dispatched 3 fix agents split by STRICT, DISJOINT file ownership (no two
   agents could ever touch the same file):
   - Plant modules: production, quality, laboratory, sales, utility, ehs,
     scrap, sections, security, warehouse, admin, telemetry, events,
     chemicals, dpsImport.
   - Commercial chains: purchase, finance, inventory, store, indent, master,
     dashboard, reports, hr, maintenance, users, auth, middleware/*. Also
     traced 4 end-to-end business chains for logic/decision/dependency gaps
     (not just per-file bugs).
   - Frontend: all of frontend/src/** — reachability, render smoke-test,
     frontend-backend contract check.
4. As the scout agent's findings landed, routed each one to whichever fix
   agent owned that file via SendMessage, rather than fixing directly or
   letting agents guess at scope.
5. Session hit connection drops + a monthly spend-limit wall mid-sweep; all
   3 agents were resumed from their saved transcripts (not restarted cold)
   once the limit cleared.

## Findings — graph scout (read-only)
- **CRITICAL**: 22 Plant Sections nav links dead (NAV_KEYS missing sections-*
  keys, permission-guard redirect fires before the page can render).
- **CRITICAL**: "Download Template" button always 500s (route shadowing —
  `/materials/:id` registered before `/materials/excel-template`, first-match
  wins in Express).
- **HIGH**: 2 endpoints could hang the browser forever (`GET /users/roles`,
  `/users/departments` — bare async, no try/catch, no wrapper; Express 4
  doesn't forward async rejections).
- **HIGH**: `DELETE /materials/:id` registered twice at different permission
  levels (1 vs 3) — the looser one silently won.
- **MEDIUM**: `ar()` error-wrapper semantics inconsistent across 12+ route
  files, some responding directly (bypassing router error middleware), some
  calling `next(err)`.
- **MEDIUM**: 6 more items (unguarded awaits in dpsImport, ChemicalStore
  page-vs-nav coupling, 5 unreachable PAGE_COMPONENTS mappings, dead
  events.js — later confirmed genuinely mounted/live, not dead, just
  frontend-uncalled, a product question not a bug, duplicate `auditLog`
  implementations with incompatible signatures, dead exports).
- Verified clean app-wide: no truncation damage beyond an earlier-repaired
  quality.js handler; all 424 route handlers have a response path; no
  unmounted route files; all 324 frontend fetch call sites resolve to a
  real backend route (zero 404s).
- Noted: GitNexus indexes a *different* working-tree copy (`C:\Project\MK
  Paper Mill`) than this repo — its impact/context results may not reflect
  the actual code. Worth re-pointing or re-indexing.

## Fixes landed — plant-modules agent (7 real bugs, all live-verified)
1. `quality.js` DEPT_JOIN fanned test counts up to ~2x on multi-equipment
   machines (LATERAL LIMIT 1 fix).
2. `quality.js` grn-inspect referenced a nonexistent column, causing the
   WHOLE transaction (stock updates included) to roll back on every GRN
   rejection with a reject qty > 0 — not just the notification.
3. `sections.js` critical-alarm auto-link to maintenance always 500'd
   (wrong column names + wrong destructuring).
4. `production.js` chemical_consumption 500'd on GET for most users and on
   every POST (referenced a machine_id column that doesn't exist on that
   table).
5. `utility.js` daily-summary dashboard 500'd (wrong reels column name).
6. `scrap.js` edit silently nulled status on every save (no COALESCE).
7. `dpsImport.js` import handler unwrapped — any throw before its internal
   try/catch hung the browser forever with no response. Verified the fix
   with a standalone repro script proving the unwrapped/wrapped behavior
   difference, not just code review.
- Verified clean: transaction safety (connect/release/rollback balanced
  1:1) across 23 transaction blocks in 15 files; no employee_id/emp_id
  confusion; no unquoted camelCase aliases; no COUNT-from-LIMIT bugs;
  events.js genuinely live and mounted, not dead.

## Fixes landed — frontend agent (4 real bugs, all live-verified both roles)
1. 22 dead Plant Sections pages — fixed per scout's diagnosis.
2. Chemicals page unreachable by URL for anyone — split `canAccess`
   (authorization) from `filterNav` (nav-hiding only), so hiding a link from
   the sidebar no longer blocks direct-URL access.
3. **Found independently**: Production.jsx hard-crashed to a blank screen
   for every single user — 4 variables used (toast state, button disabled
   states, close-shift dialog target) but never declared with useState,
   throwing ReferenceError and unmounting the whole page.
4. **Found independently**: Materials.jsx KPI cards (Opening/Received/
   Issued/Valuation) were computed by summing only the current 30-row
   paginated page instead of the full ~1086-material dataset — real
   valuation was ₹2.39Cr, UI showed ₹24.8L (~10x off). Added a proper
   unpaginated aggregate fetch.
- Flagged (fixed by the commercial-chain agent instead, see below):
  `GET /api/indent` 500ing for every user.
- Full page-by-page reachability + render smoke-test table across Admin and
  Store Manager roles — all clean after fixes, two roles' worth of access
  gating verified correct (Store Manager correctly denied HR/Admin/Users/
  Plant-Sections-outside-Production).

## Fixes landed — commercial-chains agent (biggest single agent, ~15 items)
**Chain 1 — Procure-to-Pay: was fully broken, now PASS.**
`vendor_bills.approved_by/approved_at` and the ENTIRE `vendor_payments`
table were missing from the live db despite finance.js/purchase.js code
depending on them — every bill-approve/vendor-payment/p2p-pipeline call
500'd. Also missing: 6 vendor bank-detail columns, breaking vendor
create/update. All added via `db/migration_vendor_bills_payments_fix.sql`.
Also fixed a bill-summary search query missing two joins it referenced.
Live-proved full pipeline: PO -> bill -> approve -> pay -> p2p-pipeline
shows PAYMENT_DISBURSED, balance ₹0.

**Chain 2 — Requisition-to-Consumption: was fully broken, now PASS.**
Two independent breaks stacked: (a) `reports.js` joined on
`reference_type = 'INDENT'` (uppercase) while live data is lowercase
`'indent'` — never matched, all consumption collapsed into "General Mill
Operations"; (b) deeper — `indent.js`'s actual issue route never wrote
`reference_id` into `stock_ledger` at all, so 9 of 10 live indent-issue
ledger rows had NULL reference_id — no join-case fix alone could have
worked. Fixed both. Also found live: the ENTIRE Indent/PIIMAS module
(`GET /api/indent`, `/:id`) 500'd for every user —
`cancelled_by`/`cancellation_reason`/`cancelled_at` referenced in code but
missing from the `indents` table. Added via ALTER TABLE, verified real
data now returns.

**Chain 3 — Maintenance-to-Store: confirmed broken, flagged not forced.**
`maintenance_logs.spare_parts_used` is free-text JSON with zero FK to
indent_items/stock_ledger. "Cost per machine" reporting is fiction —
`maintenance_logs.cost` is always NULL in live data. This needs a schema/
product decision, correctly not patched blind.

**Chain 4 — Role/permission consistency: 3 more gaps, fixed.**
- The scout's DELETE-materials duplicate-route finding, fixed (kept level
  3, matches its sibling restore route).
- The scout's excel-template route-shadow finding, fixed (moved literal
  route above the :id route).
- `users.js`: 5 handlers total were bare async with no wrapper (not just
  the 2 the scout found) — all wrapped, plus a router-level error handler
  added.
- `helpers.js`'s shared `ar()` was responding directly instead of calling
  `next(err)`, making every consumer's own duplicate-key-to-409 error
  middleware permanently dead code app-wide. Fixed to match the
  `.catch(next)` convention used elsewhere.
- Also fixed on request from the plant-modules agent (routed cross-team):
  `reports.js`'s `EXTRACT(EPOCH FROM (date - date))` MTBF bug (date minus
  date is an integer in Postgres, not an interval — throws live).
- Noted, not fixed: `reports.js` default date ranges use JS UTC
  `toISOString()` vs Postgres server-local `CURRENT_DATE` — same-day
  transactions can fall outside a report's default window by up to a day.

## Result
~20 real bugs found and fixed across the whole stack, several of them
entire-module-down severity (Indent/PIIMAS and Finance's payment chain
were both 500ing for every single user before this sweep). All fixes
live-verified with real psql queries and HTTP round-trips, not just code
review. Two genuine open items correctly flagged rather than force-fixed
since they need product/schema decisions, not mechanical patches.

## Open items (see checkpoint.json -> openItems)
1. 95% of materials have no unit_price — pricing data pass needed.
2. Maintenance-to-Store spares consumption has no FK link — cost-per-machine
   reporting needs a schema decision.
3. reports.js UTC-vs-server-local date default mismatch — minor, needs a
   standardization decision.
