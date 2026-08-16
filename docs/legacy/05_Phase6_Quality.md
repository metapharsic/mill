# Phase 6 — Quality Control Module

## Scope
QC test entry for reels (final QC) and incoming materials (GRN QC). NCR management. QC gate enforcement.

## DB Tables
- `quality_tests` — one row per test event

## QC Gate Rule (NON-NEGOTIABLE)
- Reel cannot move to `In Warehouse` without a `quality_tests` row with `result='Pass'` for that reel
- GRN cannot update stock_ledger without QC approval
- Server enforces this — frontend only reflects state

---

## 1. QC TEST ENTRY

### QC Test List
**API:** GET `/api/quality/tests?type=&result=&date=`

| Column | DB Source | Filter |
|--------|-----------|--------|
| Test No | quality_tests.test_number | search |
| Date | quality_tests.test_date | range |
| Type | quality_tests.test_type | dropdown |
| Reference | reel_number or grn_number | — |
| Grade | grades.name (if reel) | — |
| Result | quality_tests.result | dropdown |
| Tested By | users.name | — |

### Test Type Options
`Incoming` (for GRN materials) / `Process` (mid-production) / `Final` (reel-end)

### Result Options
`Pass` / `Fail` / `Hold` (re-test needed)

---

### Create QC Test Form → `quality_tests` table

**Header**
| UI Label | Input | DB Column | Validation |
|----------|-------|-----------|------------|
| Test No | text (auto) | test_number | server-gen `QT-YYYYMMDD-NNNN` |
| Test Type | dropdown | test_type | required |
| Test Date | date | test_date | ≤ today |
| Reference Type | radio | — | Reel / GRN |
| Reel | dropdown (if Reel) | reel_id → reels.id | filtered: status=QC Pending |
| GRN | dropdown (if GRN) | grn_id → grn.id | filtered: status=QC Pending |
| Sample Size | number | sample_size | optional |
| Tested By | auto (req.user) | tested_by | — |

**Auto-fill on Reel select:** grade, gsm, machine, shift — display read-only

**Paper Parameters (all optional — only fill what's tested)**
| UI Label | Input | DB Column | Unit | Target Range |
|----------|-------|-----------|------|-------------|
| GSM | number | gsm | g/m² | per grade spec |
| Moisture % | number | moisture_pct | % | 4–8% typical |
| Caliper | number | caliper_micron | μm | per spec |
| Burst Factor | number | burst_factor | — | per spec |
| Cobb Value | number | cobb_value | g/m² | < 35 typical |
| Brightness % | number | brightness_pct | % | per grade |
| Thickness | number | thickness_micron | μm | — |
| Width (mm) | number | width_mm | mm | — |
| Weight (kg) | number | weight_kg | kg | — |
| Tensile Strength | number | tensile_strength | kN/m | — |
| Tear Strength | number | tear_strength | mN | — |
| Porosity | number | porosity | ml/min | — |
| pH Value | number | ph_value | — | 6.5–8.5 |

**Inline specification comparison:** Show target min/max next to each input (from grades table). Highlight out-of-spec values in red.

**Result Section**
| UI Label | Input | DB Column | Validation |
|----------|-------|-----------|------------|
| Overall Result | dropdown | result | Pass / Fail / Hold |
| Failure Reasons | multi-select | failure_reasons (JSONB) | if result=Fail |
| NCR Required | checkbox | ncr_required | auto-true if result=Fail |
| Remarks | textarea | remarks | optional |

**Failure Reason Options (multi-select):**
GSM Out of Range / High Moisture / Low Burst Factor / High Cobb / Caliper Defect / Surface Defect / Width Defect / Weight Shortage / Contamination / Other

### QC Test Buttons
| Button | API | Auth | Effect |
|--------|-----|------|--------|
| Save Test | POST `/api/quality/tests` | role ≥ 2 | creates test, result=Hold |
| Mark Pass | PUT `/api/quality/tests/:id/pass` | role ≥ 2 | see below |
| Mark Fail | PUT `/api/quality/tests/:id/fail` | role ≥ 2 | see below |
| Re-test | PUT `/api/quality/tests/:id/retest` | role ≥ 2 | status→Hold, new test form |
| Print Certificate | client PDF | — | — |

**On Pass (ACID tx):**
```sql
UPDATE quality_tests SET result='Pass', passed_at=NOW() WHERE id=$1;
UPDATE reels SET quality_status='Approved', status='In Warehouse' WHERE id=reel_id;
INSERT INTO audit_log (module='Quality', action='QC_PASSED', record_id=test_id, ...);
```

**On Fail (ACID tx):**
```sql
UPDATE quality_tests SET result='Fail', failed_at=NOW(), ncr_required=true WHERE id=$1;
UPDATE reels SET quality_status='Rejected', status='Rejected' WHERE id=reel_id;
INSERT INTO audit_log (module='Quality', action='NCR_RAISED', record_id=test_id, ...);
```

---

## 2. QC DASHBOARD

**API:** GET `/api/quality/dashboard`

### KPI Cards
| Widget | DB Source |
|--------|-----------|
| Tests Today | COUNT WHERE test_date=today |
| Pass Rate % | COUNT(Pass)/COUNT(*) WHERE test_date ≥ month_start |
| Reels Pending QC | COUNT(reels) WHERE status='QC Pending' |
| NCRs This Month | COUNT WHERE ncr_required=true AND test_date ≥ month_start |
| Avg Moisture % | AVG(moisture_pct) WHERE test_date ≥ month_start |
| Avg Burst Factor | AVG(burst_factor) WHERE test_date ≥ month_start |

### Grade-wise Pass Rate
**API:** GET `/api/quality/stats?group=grade`
Columns: Grade, Tests, Pass, Fail, Pass Rate %, Avg GSM, Avg Moisture

### Parameter Trend Chart (last 30 days)
Data: AVG(gsm), AVG(moisture_pct) per day
Display: Line chart with UCL/LCL control limits

### NCR List
Show all `ncr_required=true` tests with status, reel ref, failure reasons
Quick-action: "Corrective Action Taken" button → marks NCR closed

---

## 3. QC PENDING REELS TABLE

**API:** GET `/api/production/reels?status=QC Pending`
Shows all reels awaiting QC.
Each row: **"Start QC Test"** button → opens QC test form pre-filled with reel data.
