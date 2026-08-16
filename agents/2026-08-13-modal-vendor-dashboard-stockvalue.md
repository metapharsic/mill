# Session: Modal positioning fix, vendor sync, dashboard overhaul, stock value audit

## 1. Modal-at-page-bottom bug (root cause, not guessed)
Actually opened the app in a browser and measured the broken modal's DOM rect
instead of blind-patching CSS. Found: `App.jsx`'s `.page-enter` wrapper (every
page) runs a `pageIn` animation with `fill-mode: both`, which per CSS spec
holds `transform: translateY(0) scale(1)` (identity, invisible) PERMANENTLY
after the animation ends — and any transform on an ancestor, even identity,
traps `position:fixed` descendants inside it instead of the true viewport.
Every modal in the entire app was affected, on every page, for as long as
that page was displayed. Confirmed with `getBoundingClientRect()`: overlay
was 5047px tall (matching page content height) instead of 720px viewport.
First fix attempt (`el.style.transform='none'`) didn't work — CSS animations
with fill-mode outrank plain inline styles. Real fix: strip the `.page-enter`
class via `onAnimationEnd`, killing the animation's held effect entirely.
Verified live: overlay rect became exactly `{top:0,left:0,1280x720}`.

Also paginated Store Management's Inward/Outward desks (were dumping 30+ rows
with zero pagination — the literal "page too long" complaint), 20/page with
Prev/Next, matching the Materials page pattern.

## 2. Vendor sync (4 agents across 2 rounds)
- Found 2 separate `/vendors` GET routes (master.js, purchase.js) hand-maintaining
  near-duplicate SQL that could silently drift. Unified into a shared
  `getVendors()`/`countVendors()` helper in `middleware/helpers.js`.
- Inventory.jsx GRN vendor dropdown was showing inactive vendors — fixed.
- Store.jsx "Fast Inward Entry" vendor field was pure free-text, zero link to
  the vendors table. Live proof: same real vendor spelled two ways across
  historical GRN rows ("SUNRISE BEARING CORPORATION" vs "SUN RISE...").
  Converted to a live dropdown; found stock_ledger had no vendor_id column at
  all (deeper than a UI issue) — added via migration
  `db/migration_stock_ledger_vendor_id.sql`, wired the insert route and
  vendor-wise report to use it. A follow-up agent then caught that the
  dropdown *displayed* correctly but was still SENDING vendor_name not
  vendor_id — fixed that too. Full loop live-verified: dropdown pick ->
  payload -> stock_ledger.vendor_id -> vendor-wise report, with real test
  data (`directInwardCount:2` showed up correctly for Test Vendor Co).

Security note: one backend agent unnecessarily grepped `backend/.env` for
JWT_SECRET mid-task and printed it into its own tool trace (not surfaced to
the user-facing conversation). Recommended rotating JWT_SECRET as precaution.

## 3. Dashboard overhaul (2 agents, split by file ownership to avoid clobbering)
Backend (`dashboard.js`, exclusive owner):
- Real bug: `alert_count` reused the `LIMIT 10` display query's row count, so
  it always showed "≤10" low stock alerts no matter what. True number: 263.
  Fixed with a dedicated unbounded COUNT query.
- Added 8 new KPIs pulling from this session's validated work: dead-stock
  value, vendor on-time%/reject%, avg PO cycle days, PO aging buckets,
  pending high-value indents needing real approval, Tier-1 auto-advance
  health check, indents stuck >2 days.

Frontend (`Dashboard.jsx`, exclusive owner, built defensively so it didn't
need to block on the backend agent's timing):
- Fixed QualityDashboard's Avg Brightness tile always showing fake "0.0"
  instead of "—" for missing data.
- Added error handling to all 11 dept dashboards (failed fetch used to hang
  on "Loading..." forever).
- Wired drill-down navigation on every KPI tile across all 11 dashboards.
- Added new widgets (dead-stock value, vendor performance, PO aging) gated on
  field presence — confirmed live that a widget picked up the backend's new
  field correctly with zero coordination needed.

## 4. Stock value audit (2 agents; frontend agent hit monthly spend limit
mid-task, one fix verified complete by me afterward)

Backend trace found:
- All of Dashboard/Finance/`/stores` report agree on ₹94,52,229.77 (correct,
  whole-company).
- Materials/Inventory page shows ₹47,53,129.41 — NOT a bug, its default
  filter excludes the Chemical category; the two numbers sum correctly
  (47.53L + 46.99L chemical = 94.52L). Flagged as a labeling gap, not a bug.
- REAL BUG found+fixed: Store Dept Reports' category-wise view had a SQL
  join-fan-out (materials joined directly to stock_ledger before aggregating,
  so each material's value got counted once per ledger row) — was showing
  ₹2,67,69,578.87, 2.8x the true total. Fixed via a pre-aggregated CTE,
  verified live back to the correct ₹94,52,229.77.
- Quantified two serious, previously-underestimated data risks:
  - 183 of 202 materials with ledger history (90.6%) have current_stock
    drifted from the ledger — not "15+ materials" as first estimated. ~80%
    of the entire reported stock value (₹75.68L) sits on drifted materials.
  - 1,025 of 1,077 active materials (95.2%) have unit_price = 0 or NULL.
    The whole ₹94.52L valuation is carried by just 52 priced materials —
    everything else is valuation-invisible. Bigger blind spot than the drift.

Frontend agent (before hitting spend limit) found+fixed: Materials page's
"below reorder" count was computed client-side over only the current
paginated 30-row page (`materials.filter(...)`), showing "3 below reorder"
instead of the real 263. Wired a live fetch to the real
`/api/inventory/reorder-alerts` endpoint. Verified complete and correct by
me after the agent died — the fetch call and endpoint both check out, count
matches dashboard's 263 exactly. Checked the remaining pages (Inventory.jsx,
StoreDeptReports.jsx) myself for the same partial-page-sum pattern — clean,
both already aggregate from full server responses.

## Open items (see checkpoint.json -> openItems)
1. current_stock/ledger drift on 183 materials, ~Rs 75.68L at risk — data cleanup.
2. 95% of active materials have no unit_price — pricing data pass needed.
3. Partial-issue indents still show as fully "Issued" — needs new status if wanted.
4. Materials page vs Dashboard show different (both correct, different scope)
   stock value numbers with no label distinguishing them — cosmetic fix.
