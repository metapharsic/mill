# 2026-08-29 — Inbound DC surfaced in Store reporting/analytics

## Request
"Include the DC in the reporting as well, with accurate sync option" — i.e.
surface `inbound_dc` data (pending match / matched-ready-for-GRN / converted
counts, provisional value pending reconciliation, invoice-vs-computed
mismatches) inside existing reporting/analytics screens, with a way to make
sure the numbers are never stale.

## Off-limits check first
`frontend/src/pages/Reports.jsx` (the global Reports page) is off-limits for
this task even though the user said "reporting". Investigated the app for
another safe, already-existing analytics surface:
- `frontend/src/pages/StoreDashboard.jsx` (route `store-dashboard`, sidebar
  "Store Analytics & Reports") — a dedicated live-analytics dashboard for
  Store Management, fed by `GET /api/store/dashboard-analytics`, with its
  own KPI-card grid, its own "Refresh" button, and its own auto-refresh
  timer. This is the natural home: the Inbound DC feature itself lives in
  Store Management, and this page already exists purely for
  reporting/analytics, separate from the global Reports.jsx.
- No other dedicated analytics/dashboard component was found outside
  Reports.jsx/Quality.jsx (`Dashboard.jsx` is the org-wide home dashboard,
  not store-specific).

Used `StoreDashboard.jsx` — did not touch `Store.jsx`'s dashboard tab, and
did not touch Reports.jsx or Quality.jsx.

## Backend: `GET /api/inbound-dc/summary`
Added to `backend/src/routes/inboundDc.js`, placed *before* the existing
`GET /:id` route (Express route order matters — `/summary` would otherwise
be swallowed as an `:id` param). Runs three live SQL queries against
`inbound_dc` / `inbound_dc_items` / `stock_ledger` on every call — no
caching layer, by design, so the response always reflects the current DB
state:
- status counts: `pendingMatch`, `matchedAwaitingGrn`, `convertedToGrn`,
  `cancelled`, `totalDcs`
- `provisionalValuePending` — sum of `stock_ledger.value` for
  `provisional_grn` rows tied to DCs still in `received`/`invoice_matched`
- `matchedValue` — sum of `invoice_total` for matched/converted DCs
- `mismatchCount` / `mismatches[]` — DCs where the keyed `invoice_total`
  disagrees (>₹1) with items × catalog `unit_price`, a coarse sanity flag
  (the authoritative per-line override still happens at GRN time)

Verified with `node -c` after fixing the route-order issue.

## Frontend: Inbound DC card on Store Dashboard
Added a self-contained section to `frontend/src/pages/StoreDashboard.jsx`
(new `dcSummary`/`dcSummaryLoading` state, a `loadDcSummary` callback fired
on mount) rendered as its own `S.card` block just above the existing charts
workspace, styled with the page's own `S.kpiCard` tiles (same classNames/
inline-style tokens already used by the page's other KPI cards):
- Pending Match, Matched Ready-for-GRN, Converted to GRN, Provisional Value
  Pending (₹), Invoice Mismatches (red left-border when > 0)
- A "Refresh" button (matching the page's existing refresh button style)
  that re-calls `GET /api/inbound-dc/summary` on demand — this, paired with
  the backend having no caching layer, is the "accurate sync option": every
  refresh click reflects the live DB, not a cached page snapshot.

This is additive only — the existing `dashboard-analytics` KPI grid,
charts, and `loadAnalytics`/`config` logic were left untouched.

## Docs / checkpoint
- Appended a section to `Projects_Requirement/inbound_dc_workflow.md`
  describing the new endpoint, the dashboard block, and the manual-refresh
  sync behavior.
- Added one line to `checkpoint.json` `openItems` (local edit only, not
  staged/committed — that file is owned by another concurrent agent).

## Not done / left for a human
- `backend/scripts/migrate_inbound_dc.js` still has not been run against
  the real DB, so `/api/inbound-dc/summary` (like the rest of the Inbound
  DC feature) will error against `inbound_dc`/`inbound_dc_items` not
  existing until that migration runs.
- Did not extend `backend/scripts/test_inbound_dc_integration.js` this
  round (kept the change surface minimal); the summary query's shape is
  simple enough (plain aggregates) that it can be sanity-checked the same
  way as the rest of that script when someone next touches it.
