# Live Demo — Bearing Checklist (Wire Section example)

> Ref doc for demoing, training, or building similar grid-checklist features. Pairs with `Documentation/32_Equipment_Inspection_Enhancement.md` (design/build spec) and `Documentation/31_Workflow_Loopholes_And_Fixes.md` (RBAC pattern reused here).

---

## 1. Access

| What | Value |
|---|---|
| URL | `http://localhost:9990` (dev) — matches `start_9990.ps1`, `vite.config.js` port 9990 |
| Backend API | `http://localhost:5000/api/maintenance/...` |
| Test login (full access) | `admin@mkpapermill.com` / `admin123` |
| Test login (dept-scoped write) | any `PROD`/`QC`/`MAINT`/`UTIL`/`STORE` dept user, e.g. `head.store@mkpapermill.com` / `admin123` |
| Test login (read-only) | any user outside those 5 depts — sees grid, no dropdowns |

---

## 2. Navigation path

```
Login screen
  └─ Sidebar → Maintenance
       └─ Top tab bar: [PM Schedule] [Work Logs] [Equipment & Inspections (F1/F2)] [Bearing Checklist]  ← click last one
            └─ Section dropdown → pick "Wire Section (WIRE)"
                 └─ Grid loads: 25 rows, live from DB
```

File: `frontend/src/pages/Maintenance.jsx` — tab state `tab==='bearing'`, 4th entry in the tab array.

---

## 3. Component map (what each piece is, what it maps to)

| On screen | What it is | Backend/DB |
|---|---|---|
| Section dropdown | Picks which of 14 plant sections' checklist to load | `GET /api/maintenance/inspections/grid/:sectionId` → `sections` table |
| Shift dropdown | Day / Night — which round this is | passed in submit payload, stored on `equipment_inspection.shift` |
| Submit Round button | Saves the whole grid in ONE call, not per-row | `POST /api/maintenance/inspections/bearing-check` |
| Grid row (e.g. "Bottom Headbox") | One physical roll/component | `equipment` table row, `section_id` FK to Wire |
| F/S dropdown | Free-Side bearing status: Normal / Needs Attention / Critical | `equipment_inspection.fs_status` |
| B/S dropdown | Bearing/Drive-Side bearing status, same 3 options | `equipment_inspection.bs_status` |
| Remarks box | Free text note per roll | `equipment_inspection.remarks` |
| Red row background | Auto-highlight when F/S or B/S = Critical | client-side check, no DB flag needed |
| "View only" banner | Shows if your login's dept can't write | `hasBearingWriteAccess(user)` — checks `dept_code` against `['PROD','QC','MAINT','UTIL','STORE']` or `role_level>=5` |

---

## 4. Workflow, start to finish

1. Log in as a write-access user.
2. Maintenance → Bearing Checklist tab.
3. Pick section (e.g. Wire). Grid loads with yesterday's last reading pre-filled per roll (`lastFs`/`lastBs` from API).
4. Pick shift (Day/Night).
5. Walk the section, update F/S + B/S dropdown per roll as you check each bearing. Type remarks if something's off.
6. Hit **Submit Round** — one API call, all 25 rows saved at once, `ACID` transaction (all-or-nothing).
7. If ANY row got marked Critical:
   - Kafka event fires (`mkpm.events.critical` topic) — for any downstream system listening.
   - A notification lands in-app for every MAINT dept head (level3+) and plant head/admin (level4+) — they see it via the notification bell.
8. Grid refreshes, shows your just-submitted readings as the new "last reading" baseline for next round.

---

## 5. Where the row list came from (one-time load, already done)

Your `machine.xlsx` (14 sheets, one per plant section) got read once and its rows inserted straight into the `equipment` table — see `db/migration_bearing_equipment_seed.sql`. **You never re-upload the excel.** The grid IS the checklist now, permanently in Postgres. 196 rolls total across all 14 sections (Wire=25, Press variants, Unirun, Dryers, Pop-Reel, Rewinder, Vaccum, Steam, Size Kitchen/Press, Calender, CC).

If you ever get a similar excel for a NEW machine (e.g. PM2), same pattern: extract rows → generate a seed migration → run it once → grid picks it up automatically, no frontend change needed.

---

## 5b. Scan/Export/Import buttons (added round 2)

Three extra buttons next to Submit Round:

| Button | Who sees it | What it does |
|---|---|---|
| **⬇ Export Excel** | everyone (even read-only depts) | Downloads current section's grid as `.xlsx` — same shape as your original paper-form excel, plus current F/S/B/S/Remarks baked in. Good for printing or offline reference. |
| **⬆ Import Excel** | write-access depts only | Upload a filled `.xlsx` (matches export format) — matches rows by roll NAME text, bulk-applies F/S/B/S/Remarks in one go. Unmatched names get reported back, not silently dropped. |
| **📷 Attach Scan** | write-access depts only | Upload a photo (jpg/png) or PDF of the physical paper checklist as evidence — shows up as a clickable pill above the grid, tagged with who uploaded + when. |

**Why this matters for the worker**: if someone's more comfortable filling excel offline (or the tablet/laptop isn't handy during the walkaround), they can do it on paper or excel, then either photograph it (Attach Scan — audit trail) or type it into the excel template (Import Excel — actually updates the live data). Both paths land in the exact same database, same notification pipeline, same audit trail as typing it into the web grid directly.

---

## 6. Reuse this pattern for a new feature

1. Get the source data shape (excel/PDF/paper form).
2. Design schema: one table for the "thing being checked" (like `equipment`), one table for "the check itself" (like `equipment_inspection`).
3. Backend: `GET .../grid/:parentId` (list + last reading) + `POST .../bulk-action` (one round, one save, ACID transaction).
4. Frontend: add a tab to the relevant existing page (don't build a new page unless the feature stands alone), reuse `hasXWriteAccess(user)` dept-gate pattern, reuse the `@media(max-width:640px)` stacked-card CSS for mobile.
5. Critical/flagged rows → reuse `notifications` table insert + kafka `publish()` pattern, don't invent a new alert mechanism.
