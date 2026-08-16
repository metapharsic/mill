# Database Migration Execution Report
> **Database:** `mk_paper_mill` @ localhost:5432  
> **Execution Date:** August 9, 2026  
> **Executed By:** Antigravity Agent  
> **Backup File:** `db/backup_before_migration_20260809.sql` ✅

---

## Execution Summary

| Step | Action | Status | Rows Affected |
|------|--------|--------|--------------|
| 0 — Backup | Full DB backup before migration | ✅ Done | — |
| A1 — Bearings | UPDATE stock corrections | ✅ Done | 28 rows |
| A2 — Oil Seals | UPDATE stock corrections | ✅ Done | 11 rows |
| A3 — Pump Sleeves | UPDATE stock corrections | ✅ Done | 8 rows |
| A4 — Clothing | UPDATE stock corrections | ✅ Done | 4 rows |
| B — Mechanical INSERTs | 18 sub-sections, 508 SQL statements | ✅ Done | 459 new + 49 skipped |
| C — Electrical INSERTs | 4 sheets: ECT, ERE, EMC, ELEG | ✅ Done | 168 new |
| D — Stationery INSERTs | 32 items STA001–STA032 | ✅ Done | 32 new |
| **TOTAL** | | ✅ **COMPLETE** | **51 updated + 659 inserted** |

> **Zero errors across all parts. Zero schema changes made.**

---

## Before vs After

| Metric | Before | After |
|--------|--------|-------|
| Total rows in `materials` | 299 | **958** |
| `material_categories` rows | 11 | **11** (unchanged) |
| Other tables affected | 0 | **0** |
| Schema changes | None | **None** |

---

## PART A — Stock Corrections Executed (51 UPDATEs)

### A1 — Bearings: 28 rows updated ✅

| Code | Old Stock | New Stock | Δ |
|------|----------|----------|---|
| BE0003 | 4 | **5** | +1 |
| BE0007 | 11 | **10** | -1 |
| BE0008 | 1 | **2** | +1 |
| BE0011 | 4 | **2** | -2 |
| BE0014 | 7 | **6** | -1 |
| BE0015 | 1 | **0** | -1 |
| BE0016 | 1 | **4** | +3 |
| BE0017 | 0 | **4** | +4 |
| BE0018 | 8 | **7** | -1 |
| BE0021 | 3 | **2** | -1 |
| BE0022 | 0 | **13** | +13 |
| BE0023 | 5 | **0** | -5 |
| BE0024 | 2 | **6** | +4 |
| BE0032 | 11 | **10** | -1 |
| BE0034 | 7 | **6** | -1 |
| BE0036 | 6 | **4** | -2 |
| BE0037 | 1 | **2** | +1 |
| BE0038 | 6 | **3** | -3 |
| BE0064 | 0 | **1** | +1 |
| BE0085 | 11 | **1** | -10 |
| BE0095 | 3 | **1** | -2 |
| BE0096 | 0 | **1** | +1 |
| BE0106 | 12 | **10** | -2 |
| BE0118 | 1 | **0** | -1 |
| BE0133 | 0 | **1** | +1 |
| BE0144 | 0 | **1** | +1 |
| BE0168 | 2 | **3** | +1 |
| BE0170 | 0 | **10** | +10 |

### A2 — Oil Seals: 11 rows updated ✅

| Code | Old Stock | New Stock | Δ |
|------|----------|----------|---|
| OS0020 | 6 | **5** | -1 |
| OS0021 | 1 | **0** | -1 |
| OS0022 | 10 | **9** | -1 |
| OS0024 | 8 | **7** | -1 |
| OS0031 | 8 | **3** | -5 |
| OS0034 | 11 | **10** | -1 |
| OS0037 | 12 | **11** | -1 |
| OS0057 | 14 | **12** | -2 |
| OS0064 | 4 | **2** | -2 |
| OS0072 | 2 | **1** | -1 |
| OS0077 | 0 | **1** | +1 |

### A3 — Pump Sleeves: 8 rows updated ✅

| Code | Old Stock | New Stock | Δ |
|------|----------|----------|---|
| MPS0007 | 2 | **1** | -1 |
| MPS0010 | 11 | **10** | -1 |
| MPS0012 | 1 | **3** | +2 |
| MPS0014 | 0 | **2** | +2 |
| MPS0016 | 4 | **3** | -1 |
| MPS0020 | 0 | **3** | +3 |
| MPS0024 | 0 | **2** | +2 |
| MPS0027 | 1 | **6** | +5 |

### A4 — Clothing: 4 rows updated ✅

| Code | Item | Old Stock | New Stock | Δ |
|------|------|----------|----------|---|
| TW0001 | TOP WIRE | 2 | **1** | -1 |
| BW0001 | BOTTOM WIRE | 2 | **1** | -1 |
| PF0003 | PRESS FELTS TOP | 3 | **2** | -1 |
| URG001 | 1ST UNIRUN GROUP | 0 | **1** | +1 |

---

## PART B — New Mechanical Store Items (459 inserted, 49 skipped)

> The 49 skipped = Tyres (10), Tyre Couplings (11), and Pump Sleeves (27+1) which were **already in the database** — correctly skipped by `ON CONFLICT DO NOTHING`.

| Section | Sheet Source | Code Format | Count Inserted |
|---------|-------------|------------|---------------|
| B1 | Mechanical — Bearing sheet | BE0171–BE0173 | **3** new bearings |
| B2 | Mechanical — V-BELT | MVB0001–MVB0027 | **27** |
| B3 | Mechanical — TYRE | TF, TP codes | **0** (already in DB, skipped) |
| B4 | Mechanical — TYRE COUPLING, PIN BUSH | TCF, TCP, CPB | **0** (already in DB, skipped) |
| B5 | Mechanical — VALVE | MV0001–MV0043, MNRV001–MNRV009 | **52** |
| B6 | Mechanical — CHECK NUT & WASHER | MCNW0001–MCNW0026 | **26** |
| B7 | Mechanical — GUAGES | MGU0001–MGU0014 | **14** |
| B8 | Mechanical — SHAFT & IMPELLER | MIMP001–MIMP026, MIMS001–MIMS017 | **43** |
| B9 | Mechanical — WELDING RODS | SSR0001–SSR0002, MSR0001–MSR0003, TWE0001–TWE0002 | **7** |
| B10 | Mechanical — BLADE + Grinding Wheels | DB, GBW, GGW, GCW, GEP, GRK, GRC | **12** |
| B11 | Mechanical — LUBRICANTS | LGO0001, LGR0001–LGR0002, LHO0001, LLOC001 | **5** |
| B12 | Mechanical — NOZZLES | MNO001–MNO005 | **5** |
| B13 | Mechanical — PENUM CYLINDER KITS | PCK, PUE, PUM, PUC, PUT, PUTU | **54** |
| B14 | Mechanical — PENUMATICS & HYDRAULICS | PFRL, PREG, PNCV, PCV, PDV, PRV, PSM, PSH, PBR, PCY | **16** |
| B15 | Mechanical — GENERAL | GECR, GEGR, GBFP, GMSB, GHTBN, GSSAB, GSSCAS, GSSCS, GSSBN, GSSSB, GSSFT | **99** |
| B16 | Mechanical — SS,MS PIPE FITTING | MSSC, MSSR, MSSBE, MMSF, MSTF, MSPN, MSSS, MSSHX | **73** |
| B17 | Mechanical — CHEMICAL sheet | CH prefix codes | **23** |
| B18 | Mechanical — PUMP SLEEVE | MPS codes | **0** (already in DB, skipped) |
| **TOTAL** | | | **459 new + 49 skipped** |

---

## PART C — Electrical Store Items (168 inserted) ✅

| Sheet | Code Format | Description | Inserted |
|-------|------------|-------------|---------|
| CONTACTOR | ECT0001–ECT0036 | Siemens, Schneider power contactors (9A–160A) | **36** |
| RELAY | ERE0001–ERE0025 | Thermal overload relays, timer relays, auxiliary relays | **25** |
| MCB | EMC0001–EMC0024 | MCBs, Fuses (Eaton, L&T, C&S), ACBs, Isolators | **24** |
| ELE GENERAL | ELEG0001–ELEG0083 | Motor starters, pressure switches, cable lugs, motor fans, terminal plates | **83** |
| **TOTAL** | | | **168** |

---

## PART D — Stationery Items (32 inserted) ✅

| Code Range | Items | Inserted |
|-----------|-------|---------|
| STA001–STA032 | Registers, Files, Pens, Markers, Staplers, Batteries, Binder Clips, Calculator, A4 Paper | **32** |

---

## Final Verified State — DB After Migration

### Category Breakdown (from live DB query)

| Category | Code | Items After Migration |
|----------|------|----------------------|
| Bearings | BE | **173** (170 original + 3 new) |
| Oil Seals | OS | 73 |
| Pump Sleeves | MPS | 27 |
| V-Belts | MVB | **27** (new) |
| Valves | MV/MNRV | **52** (new) |
| Check Nuts | MCNW | **26** (new) |
| Gauges | MGU | **14** (new) |
| Shaft & Impeller | MIMP/MIMS | **43** (new) |
| Pneumatic Kits | PCK/PU | **54** (new) |
| Pneumatics & Hydraulics | PFRL/PCV etc. | **16** (new) |
| General Bolts/Tools | GE/GM/GS/GB | **102** (new) |
| Pipe Fittings | MSS/MMS | **73** (new) |
| Chemicals | CH | **23** (new) |
| Welding Rods | SSR/MSR/TWE | **7** (new) |
| Blades & Grinding Wheels | DB/GBW/GCW | **9** (new — 12 inserted, 9 net unique) |
| Lubricants | LGO/LGR/LHO/LLOC | **5** (new) |
| Nozzles | MNO | **5** (new) |
| Tyres | TF/TP | 10 (unchanged) |
| Tyre Couplings | TC/CPB | 11 (unchanged) |
| Clothing | BW/TW/DS/PF/URG | 8 (stock corrected) |
| Contactors | ECT | **36** (new) |
| Relays | ERE | **25** (new) |
| MCBs/Fuses | EMC | **24** (new) |
| Electrical General | ELEG | **83** (new) |
| Stationery | STA | **32** (new) |
| **GRAND TOTAL** | | **958 items** |

### Category-Level Summary (from DB `material_categories`)

| Category Name | Code | DB Count After |
|--------------|------|---------------|
| Mechanical | MECH | 539 |
| General | GEN | 118 |
| Hydraulic & Pneumatic | HYDPNEU | 70 |
| Electrical | ELEC | 168 |
| Chemical | CHEM | 23 |
| Clothing | CLOTH | 8 |
| Stationary | STAT | 32 |
| Capital Goods | CAPEX | 0 |
| Drive & Motors | DRIVE | 0 |
| Packing | PACK | 0 |
| Spare Parts | SPARE | 0 |
| **TOTAL** | | **958** |

---

## Spot Check Verification (Live DB Sample)

| Code | Name | Current Stock | Source Sheet | Status |
|------|------|--------------|-------------|--------|
| BE0022 | 6209-zz | **13** | Bearing (July 21) | ✅ Correct |
| BE0085 | 23044 BE-XL-K | **1** | Bearing (July 21) | ✅ Correct (was 11) |
| OS0031 | 50-75-12/10 | **3** | Final Oil Seal | ✅ Correct (was 8) |
| MPS0027 | HOLY ROLL SLEEVE | **6** | Pump Sleeve | ✅ Correct (was 1) |
| TW0001 | TOP WIRE | **1** | Clothing | ✅ Correct (was 2) |
| URG001 | 1ST UNIRUN GROUP | **1** | Clothing | ✅ Correct (was 0) |
| MVB0001 | V-BELT SPB 1850 | 3 | V-BELT sheet | ✅ New item |
| MV0001 | 1.5" GLOBE VALVE | 0 | VALVE sheet | ✅ New item |
| ECT0001 | SIEMENS AIR BREAK CONTACTOR (9A) | 3 | CONTACTOR sheet | ✅ New item |
| ERE0001 | SCHNEIDER RELAY LRD 07 | 2 | RELAY sheet | ✅ New item |
| EMC0001 | EATON 80 AMPS FUSE | 8 | MCB sheet | ✅ New item |
| ELEG0001 | MOTOR STATR 9-14 AMP | 0 | ELE GENERAL | ✅ New item |
| STA001 | REGISTERS 100 PAGE | 18 | STATIONERY | ✅ New item |
| LGO0001 | SERVO GEAR OIL 320 | 100 | LUBRICANTS | ✅ New item |
| MGU0001 | Pressure Gauge 0-16 kg/cm² | 1 | GUAGES | ✅ New item |

---

## Schema Integrity Check

| Check | Result |
|-------|--------|
| New tables created? | ❌ None |
| Columns added/removed? | ❌ None |
| Foreign key violations? | ❌ None |
| Other tables modified? | ❌ None — only `materials` |
| Database structure changed? | ❌ Completely unchanged |
| Backup available? | ✅ `db/backup_before_migration_20260809.sql` |

---

## Items NOT Changed (as expected)

| Item Group | Reason |
|-----------|--------|
| Tyres (TF/TP — 10 items) | Already in DB, correctly skipped |
| Tyre Couplings (TCF/TCP/CPB — 11 items) | Already in DB, correctly skipped |
| Pump Sleeves (MPS — 27 items) | Already in DB, stock corrected via Part A |
| Clothing (BW/TW/DS/PF/URG — 8 items) | Already in DB, stock corrected via Part A |
| Bearings (BE0001–BE0170) | Already in DB, 28 had stock corrected |
| Oil Seals (OS — 73 items) | Already in DB, 11 had stock corrected |
| `stock_ledger` table | Intentionally skipped (per your instruction) |
| All 89 other tables | Not touched at all |

---

## Files Created During Migration

| File | Purpose |
|------|---------|
| `db/backup_before_migration_20260809.sql` | Full DB backup (safety net) |
| `db/migration_part_A.sql` | 51 UPDATE statements |
| `db/migration_part_B.sql` | 508 INSERT statements (mechanical) |
| `db/migration_part_C.sql` | 168 INSERT statements (electrical) |
| `db/migration_part_D.sql` | 32 INSERT statements (stationery) |

> All 4 migration SQL files are saved in the `db/` folder for reference and re-execution if needed.

---

> [!NOTE]
> The migration is complete. The `materials` table has grown from **299 → 958 items** with data from all 3 spreadsheets. You can now cross-check this report against the physical spreadsheets.
