# Equipment Inspection Enhancement — Bearing Checklist (Ph32)

> **STATUS: CLOSED.** Source: `machine.xlsx` / `machine 1.xlsx` (Downloads), 14-section bearing inspection checklist, PM1 only.
> Decision made 2026-07-10: built direct-entry form, NOT excel-upload, NOT SCADA. See rationale below.
> Built 2026-07-10: 196 rolls seeded (PM1), schema patched, bulk-submit + grid API, frontend grid tab, critical→notifications wired, dashboard summary tile, kafka broadcast, dept-scoped write-gate (`hasBearingWriteAccess` — PROD/QC/MAINT/UTIL/STORE write, others read-only, mirrors `30_RoleBased_PlantSections_RBAC.md`), mobile stacked layout (`@media max-width:640px`, card-style rows). Vite compile-checked clean.
> PM2 (second paper machine): no source excel exists, explicitly decided 2026-07-10 to leave it unseeded rather than clone/fabricate PM1's roll list — PM2 may differ, guessing risks a checklist that doesn't match the real machine. Revisit when a real PM2 source (excel/PDF/plant walkthrough) shows up. Not a bug, a settled scope call.
>
> **Added 2026-07-10 (round 2): scan/photo attach + Excel export/import.** `inspection_round_scans` table, 3 new routes (`/scan`, `/export/:sectionId`, `/import/:sectionId`), 3 new frontend buttons (Export Excel, Import Excel, Attach Scan). All live-tested: export produces the exact source-excel shape with current data baked in; re-imported that same file and it round-tripped correctly (25/25 matched, 0 unmatched, critical count detected); scan upload + static-serve confirmed. See §8.

---

## 1. Problem

Daily walkaround bearing checks (F/S = Free Side, B/S = Bearing/Drive Side) done on paper/excel today, 14 sections, ~200+ individually named rolls/components. App's `equipment` + `equipment_inspection` tables exist but too coarse:

- `equipment` seed has 1-2 generic rows per section (e.g. "PM1 Press Roll"). Excel has 26 named rolls for Wire section alone.
- `equipment_inspection` stores ONE `status` per equipment per date. Excel needs TWO independent readings (F/S, B/S) per roll per check.

## 2. Decision: direct-entry form (not excel-upload, not SCADA)

| Option | Verdict | Why |
|---|---|---|
| Daily excel upload | ❌ Rejected | Still manual typing + extra upload step, no live alert on Critical, excel becomes shadow source-of-truth outside DB, no audit trail. |
| SCADA/PLC auto-feed | ❌ Rejected (for this data) | Bearing F/S B/S is a human visual/tactile check — no sensor exists on these rolls today. SCADA can only report what a sensor measures. |
| **Direct-entry form in app** | ✅ Correct | Operator fills grid on tablet during rounds → straight to DB. Reuses `equipment_inspection`, `inspector_id` audit already present. |
| Excel-upload, ONE TIME only | ✅ Correct, but only for seeding equipment master (see Phase E1) | This excel IS the equipment master list — reuse `dpsImport.js` pattern once to bulk-seed 200+ equipment rows, not as recurring workflow. |

---

## 3. Schema changes required

```sql
-- Ph32: add bearing-side granularity to equipment_inspection
ALTER TABLE equipment_inspection
  ADD COLUMN IF NOT EXISTS fs_status VARCHAR(30) CHECK (fs_status IN ('Normal','Needs Attention','Critical')),
  ADD COLUMN IF NOT EXISTS bs_status VARCHAR(30) CHECK (bs_status IN ('Normal','Needs Attention','Critical')),
  ADD COLUMN IF NOT EXISTS shift VARCHAR(10) CHECK (shift IN ('Day','Night'));

-- drop old single-status requirement (keep column for backward compat, nullable)
ALTER TABLE equipment_inspection ALTER COLUMN status DROP NOT NULL;
```

Equipment master expansion — seed ~200+ rows, one per named roll, keyed to `plant_sections`:

```sql
-- Ph32: granular roll-level equipment seed (source: machine.xlsx sheets)
-- Pattern per row: (section_id, seq, code, name, type, is_active)
-- Example for Wire section (26 rolls):
INSERT INTO equipment (section_id, name, code, type) VALUES
  ((SELECT id FROM plant_sections WHERE section_code='WIRE'), 'Bottom Headbox', 'PM1-WIRE-01', 'Headbox'),
  ((SELECT id FROM plant_sections WHERE section_code='WIRE'), 'Holly Roll-1', 'PM1-WIRE-02', 'Roll'),
  ((SELECT id FROM plant_sections WHERE section_code='WIRE'), 'Holly Roll-2', 'PM1-WIRE-03', 'Roll'),
  -- ... remaining 23 Wire rows, then repeat pattern for all 14 sections
ON CONFLICT (code) DO NOTHING;
```
Full row list = extract every "Section/Equipment/Rolls" column value from all 14 sheets in `machine.xlsx` — that file IS the seed source, don't hand-retype it.

---

## 4. API changes (`backend/src/routes/maintenance.js`)

Current: `POST /inspections`, `requireLevel(1)` — single status per equipment.

New:
```js
// POST /inspections/bearing-check — bulk grid submit for one section walkaround
router.post('/inspections/bearing-check', auth, requireLevel(1), ar(async (req, res) => {
  const { section_id, shift, readings=[] } = req.body;
  // readings: [{ equipment_id, fs_status, bs_status, remarks }]
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const r of readings) {
      await client.query(
        `INSERT INTO equipment_inspection (equipment_id, inspector_id, fs_status, bs_status, shift, check_date, remarks)
         VALUES ($1,$2,$3,$4,$5,CURRENT_DATE,$6)`,
        [r.equipment_id, req.user.id, r.fs_status, r.bs_status, shift, r.remarks||null]
      );
      if (r.fs_status === 'Critical' || r.bs_status === 'Critical') {
        // trigger notification to section head / maintenance dept — reuse existing notifications pattern (hr.js)
      }
    }
    await client.query('COMMIT');
    res.json({ success:true, count: readings.length });
  } catch(e) { await client.query('ROLLBACK'); throw e; }
  finally { client.release(); }
}));

// GET /inspections/grid/:sectionId — fetch equipment list + last reading, for form pre-fill
router.get('/inspections/grid/:sectionId', auth, ar(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT e.id, e.name, e.code,
            (SELECT fs_status FROM equipment_inspection WHERE equipment_id=e.id ORDER BY check_date DESC LIMIT 1) AS last_fs,
            (SELECT bs_status FROM equipment_inspection WHERE equipment_id=e.id ORDER BY check_date DESC LIMIT 1) AS last_bs
     FROM equipment e WHERE e.section_id=$1 AND e.is_active=true ORDER BY e.id`,
    [req.params.sectionId]
  );
  res.json({ success:true, data:rows });
}));
```
Critical-flag notification reuses the notification insert pattern already in `hr.js` (`notifications` table) — don't build a new mechanism.

---

## 5. Frontend — phased build (`frontend/src/pages/Maintenance.jsx`)

File already has a tab pattern (`tab` state, `['schedule','logs','equipment']`, line 119) and an `equipment`/`inspections` state pair (lines 9-10) wired to the old single-status F1/F2 inspection. Bearing checklist is a NEW 4th tab, `'bearing-check'`, added to the existing array — not a separate page, keep it inside `Maintenance.jsx` alongside PM Schedule / Work Logs / Equipment.

| Sub-phase | What | Status |
|---|---|---|
| **E4a — Section picker** | Section dropdown above the grid, mirrors excel's 14 sheet-tabs. On change, fetches `GET /inspections/grid/:sectionId`. | ✅ Done |
| **E4b — Grid render** | Table: rows = rolls from grid API, columns = Roll Name, F/S, B/S, Remarks. Pre-fills from `lastFs`/`lastBs`. | ✅ Done |
| **E4c — Row-level state** | `bcReadings` state keyed by `equipment_id`, `patchBc()` patches one key without re-rendering the whole grid. | ✅ Done |
| **E4d — Bulk submit** | "Submit Round" button builds `readings[]` from row state, one `POST /inspections/bearing-check` call. | ✅ Done, verified live |
| **E4e — Critical highlight** | Row background flips red when F/S or B/S = Critical. | ✅ Done |
| **E4f — Role gate** | `hasBearingWriteAccess(user)` — PROD/QC/MAINT/UTIL/STORE dept_code or level5 writes; everyone else sees plain text instead of dropdowns, submit controls hidden entirely. Mirrors `PlantSection.jsx`/`30_RoleBased_PlantSections_RBAC.md` pattern. | ✅ Done, vite compile-checked |
| **E4g — Mobile layout** | `@media (max-width:640px)` + `.bearing-grid` class — table collapses to stacked cards, `data-label` attrs drive the `::before` labels per cell. | ✅ Done, vite compile-checked |

All 7 sub-phases closed. Live browser click-test not run (cross-project preview-tool restriction — see session notes), but vite serves the file with a clean transform (200, no error overlay) confirming no syntax break.

---

## 5b. Scan/photo + Excel export/import (added 2026-07-10, round 2)

Worker-facing convenience layer on top of the grid — three new pieces, all reuse existing patterns (multer disk-storage from `hr.js`, `xlsx` package already a dep, notification/kafka wiring from §4).

| Feature | Route | What it does |
|---|---|---|
| **Scan/photo attach** | `POST /inspections/bearing-check/scan` (multer disk, jpg/png/pdf, 10MB) | Attach a photo of the physical paper checklist or a filled printout to a round. Stored in `inspection_round_scans`, served at `/uploads/maintenance/...`. Shown as pill-links above the grid once uploaded. |
| **Excel export** | `GET /inspections/bearing-check/export/:sectionId` | Downloads current grid as `.xlsx`, same row shape as the original `machine.xlsx` sheets (Sr.No / Section-Equipment-Rolls / F/S / B/S) plus a Remarks column, pre-filled with latest readings. Use for printing, offline reference, or handing to someone without app access. |
| **Excel import** | `POST /inspections/bearing-check/import/:sectionId` (multer memory, xlsx only, 5MB) | Upload a filled sheet (e.g. someone did the round on paper/excel offline), matches rows by exact roll-name text against `equipment.name` in that section, bulk-inserts via the same transaction+kafka+notification path as the manual grid submit. Unmatched names come back in the response so you know what didn't map. |

**Live-tested round-trip**: exported Wire section → edited 2 cells offline → re-imported → 25/25 matched, 0 unmatched, critical flag correctly detected and fired the same notification path as a manual submit. Scan upload confirmed end-to-end (upload → DB row → static file reachable at 200).

**Why this shape, not something fancier**: export/import deliberately match the ORIGINAL excel's column order — so a worker who's more comfortable in excel than the web grid can keep working there, and it still lands in the same DB/notification pipeline. No separate "excel workflow" was built — it's the same pipe, different entry point.

---

## 6. Phased rollout

| Phase | What | Depends on |
|---|---|---|
| **E1** | One-time bulk import: extract all rows from `machine.xlsx` 14 sheets → generate `equipment` seed migration (~200+ rows) | none — do first |
| **E2** | Migration: `fs_status`/`bs_status`/`shift` columns on `equipment_inspection` | E1 |
| **E3** | Backend: `POST /inspections/bearing-check`, `GET /inspections/grid/:sectionId` | E2 |
| **E4** | Frontend: section-tab grid form, F/S+B/S dropdowns, remarks, submit | E3 |
| **E5** | Critical-status notification wiring (reuse `notifications` table/pattern) | E3 |
| **E6** | Dashboard tile: sections with pending/overdue inspection, count of Critical bearings open | E4, E5 |

Do E1-E3 before touching frontend — no point building a grid UI against a schema that doesn't have the columns yet.

---

## 7. What NOT to build

- No excel-upload as recurring daily workflow for this data — one-time seed only (E1).
- No SCADA wiring for bearing F/S/B/S — no sensor exists on these rolls; revisit only if capex adds vibration/temp sensors to specific bearings.
- No new notification mechanism — reuse existing `notifications` table pattern from HR module.
