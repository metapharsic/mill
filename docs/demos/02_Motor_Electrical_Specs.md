# Live Demo — Motor Electrical Specs (F2)

> Fixes the gap: checkpoint's "F2 Motor electrical list" was marked done but only ever captured HP+Amps. KW, RPM, Bearing-No-FS, Bearing-No-BS were never provisioned anywhere until 2026-07-10.

---

## 1. Access

| What | Value |
|---|---|
| URL | `http://localhost:9990` |
| Backend API | `http://localhost:5000/api/master/motors...` |
| View access | any logged-in user |
| Edit access | `role_level >= 4` (Plant Head/Admin) — Add/Delete buttons only show for these |

---

## 2. Navigation path

```
Login screen
  └─ Sidebar → Maintenance
       └─ Top tab bar: [PM Schedule] [Work Logs] [Equipment & Inspections (F1/F2)] [Bearing Checklist] [Motor Specs (F2)]  ← last tab
            └─ Section filter dropdown → "All sections" or pick one of 6: Pulp Mill / Machine / Starch / Rewinder / ETP / Boiler
                 └─ Table: 165 motors total, live from DB
```

---

## 3. Component map

| On screen | Maps to |
|---|---|
| Section dropdown | `section_label` column — one of 6 raw labels from the source form (NOT the app's 21 granular plant sections — see §5) |
| Table columns | Sr, Motor Name, KW, HP, RPM, Full-Amp, Bearing No-FS, Bearing No-BS, Section |
| + Add Motor button | level4+ only, opens modal, all fields optional except Motor Name + Section |
| 🗑 delete icon | level4+ only, hard delete (no soft-delete/restore on this table — it's spec data, not a live record with history) |

---

## 4. Data — 165 motors, exact source match

| Section | Count |
|---|---|
| Pulp Mill | 40 |
| Machine | 62 |
| Starch | 12 |
| Rewinder | 10 |
| ETP | 18 |
| Boiler | 23 |

---

## 5. Why a separate table, not the `equipment` table

The bearing-checklist grid uses `equipment` + `equipment_inspection`, keyed to the app's 21 granular plant sections (WIRE, PRESS, POPE_REEL, CALENDER, CRANES, VACUUM, etc — see `19_Departments_Logins_Approvers.md`). This motor list's source form uses a coarser 6-bucket grouping — one "Machine" section covers what the app splits into ~10 granular sections. Forcing this data onto `equipment.section_id` would mean guessing which of ~10 sections each "Machine" motor actually belongs to — a lossy, error-prone mapping. Kept as its own `motor_electrical_specs` table with a plain `section_label` text field instead — accurate to source, no guessing.

If a future need arises to cross-link a specific motor to its exact granular plant section (e.g. "TOP WIRE MOTOR" → `WIRE` section), that's a manual one-time mapping exercise, not something to auto-guess.
