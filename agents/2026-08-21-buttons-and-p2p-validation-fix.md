# Agent Session: 2026-08-21 — Broken UI Buttons Fix + P2P Validation Repair + Git Restore Point

## Trigger
User ran `scripts/multi_agent_system_validation.js` (external multi-agent audit tool) against live DB.
Result: 45 checks passed, 2 failed — both in [A_P2P] Procurement/Gate Pass/QC/RTV agent block:
- "Master Vendor and Material available for P2P transaction" — FAILED
- "A_P2P Execution Error" — FAILED (runtime error)

Also fixed separately this session: 5 reported "not functioning" Store.jsx buttons.

## Part 1 — Broken buttons (5 parallel agents, disjoint files)

| Button | Root cause | Fix |
|---|---|---|
| 📊 Excel Master Export | `InventoryExportModal.jsx` did `if (!isOpen) return null` BEFORE its 18 `useState` hooks — React hook-order crash the instant modal opened (component stays mounted, hook count changes 0→18) | Moved the early-return below all hooks, right before JSX return |
| 📊 Executive Dashboard | Pending Indents KPI query missing `'L3 Approved'`/`'Partially Issued'` statuses (had a dead `'Pending'` term instead) — undercounted/zeroed the KPI | Fixed status IN-list in `backend/src/routes/store.js`. Also added the already-computed-but-never-rendered "Out of Stock" KPI tile + Customization Studio toggle in `StoreDashboard.jsx` |
| 📱 WhatsApp EOD Report | `GET /api/reports/eod` gated `requireLevel(2)`, but frontend shows the button to ALL users (`Reports.jsx` comment: "EOD Activity (WhatsApp) is available to all users") — level-1 users got silent 403, empty message, dead button | Removed `requireLevel(2)` from `GET /eod` only; kept `POST /eod/send` and `GET /eod/history` admin-gated |
| + New Inward (GRN) | `GST_SLABS` referenced in Store.jsx's inward form but never defined/imported in that file — `ReferenceError` crashed the modal on open | Added local `const GST_SLABS = [...]` in Store.jsx |
| + New Outward (Issue) | Mostly fine (stock-deduct path correct, matches transfer-fix pattern from prior audit). Minor: zero-stock material's qty `max` used `|| 999999` — falsy `0` meant no client-side cap on out-of-stock items (backend still blocked it safely) | Changed `||` to `??` on the `max` attribute |

Files touched: `frontend/src/components/InventoryExportModal.jsx`, `frontend/src/pages/Store.jsx`, `frontend/src/pages/StoreDashboard.jsx`, `backend/src/routes/store.js`, `backend/src/routes/reports.js`.
⚠️ Flagged for user: the WhatsApp EOD fix widens report-read access from level-2+ to all authenticated users — matches the frontend's own stated intent, user confirmed OK.

Committed as `f2d3578` and pushed to `origin/main` same session.

## Part 2 — A_P2P validation failure

**Diagnosis (confirmed):** `multi_agent_system_validation.js` requires a live `vendors` row and a live `materials` row with `is_active = true` to build a test PO→GatePass→GRN→Rejection→RTV chain. Zero such rows existed at time of the failed run → `vendor`/`material` came back `undefined` → first assertion failed, then every later query in that block dereferenced `vendor.id`/`material.id` on `undefined` → TypeError → caught as the second failure ("A_P2P Execution Error"). One root cause, two reported failures.

Schema confirms `is_active BOOLEAN DEFAULT true` on both tables — an all-inactive/empty state is not the schema default, so this is a live-data state issue on the user's DB, not a code defect. No script in the repo was found that bulk-deactivates or bulk-deletes vendors/materials (checked `truncate_test_pos.js` and everything under `backend/scripts/patch/` — all scoped to specific ids/test-only codes).

**Fix delivered:** new idempotent repair script `backend/scripts/patch/ensure_active_vendor_material.js` — checks for an active vendor/material, and only if none exists, either flips the oldest existing row active or (only if the table is completely empty) inserts one minimal clearly-labeled seed row. Never deletes, never runs automatically, safe to re-run. `node --check` clean.

**User action needed (local DB, not runnable from sandbox):**
```
cd backend && node scripts/patch/ensure_active_vendor_material.js
```
Then re-run `scripts/multi_agent_system_validation.js` to confirm A_P2P now passes.

## Git
This session's fixes (Part 1) committed `f2d3578`, pushed. Part 2 (this file + checkpoint updates + new script) committed and pushed in same follow-up commit — see checkpoint/README.md and git log for exact hash.
