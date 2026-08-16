# Quality Module — Full Workflow & Rules

## Overview
Paper quality testing for incoming GRNs, in-process reels, and final products.
Implements maker-checker principle: tester cannot certify own test (unless L4+).

## Key Files
| File | Purpose |
|---|---|
| `backend/src/routes/quality.js` | All quality endpoints (228 lines) |
| `frontend/src/pages/Quality.jsx` | Quality UI |
| DB: `quality_tests` | Core table |

## Database Tables
| Table | Purpose |
|---|---|
| `quality_tests` | All test records with parameters and result |

## Test Number Format
Advisory-locked sequence: `QT-YYYYMMDD-{4-digit seq}`
Same advisory lock pattern as indents: `pg_advisory_xact_lock(hashtext('qt-{date}'))`.

## API Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/quality/tests` | L1+ | List tests (filter: result, test_type) — paginated |
| POST | `/quality/tests` | L2+ | Create test (result starts as 'Pending') |
| PUT | `/quality/tests/:id` | L2+ | Update measurement values only (NOT result — use /pass /fail /retest) |
| PUT | `/quality/tests/:id/pass` | L2+ | Mark test as Pass (with maker-checker + side effects) |
| PUT | `/quality/tests/:id/fail` | L2+ | Mark test as Fail (NCR raised in audit_log) |
| PUT | `/quality/tests/:id/retest` | L2+ | Reset to Pending for re-test |
| GET | `/quality/stats` | L1+ | Pass/fail rates by result and test type |

## Test Types
| Type | When Created | Reference |
|---|---|---|
| Incoming | On GRN receipt | reference_type='GRN', reference_id=grn.id |
| Process | During production (operator flags) | reference_type='Reel', reference_id=reel.id |
| Final | Reel completion (auto or manual) | reference_type='Reel', reference_id=reel.id |
| Customer | Customer complaint/return | reference_type='Customer', reference_id=customer.id |

## Result Values
| Result | Meaning | Side Effects |
|---|---|---|
| Pending | Test created, measurements not finalised | None |
| Pass | All params within spec | If Reel: quality_status='Approved', status='In Warehouse'. If GRN: status='Approved' |
| Fail | One or more params out of spec | If Reel: quality_status='Rejected', status='Rejected'. NCR logged in audit_log |
| Hold | Borderline — re-test pending | Reel remains on hold, cannot be dispatched |

## Quality Parameters (for paper reels)
| Parameter | DB Column | Unit | Description |
|---|---|---|---|
| GSM | `gsm` | g/m² | Grammage |
| Moisture | `moisture_pct` | % | Paper moisture content (target 5-10%) |
| Caliper | `caliper_micron` | μm | Thickness |
| Burst Factor | `burst_factor` | — | Bursting strength factor |
| Cobb Value | `cobb_value` | g/m² | Water absorption (target < 30) |
| Brightness | `brightness_pct` | % | Optical brightness |
| Thickness | `thickness_micron` | μm | Paper thickness |
| Width | `width_mm` | mm | Paper width |
| Weight | `weight_kg` | kg | Reel weight |
| Tensile Strength | `tensile_strength` | kN/m | MD + CD tensile |
| Tear Strength | `tear_strength` | mN | Tearing resistance |

## Maker-Checker Rule
- A tester CANNOT certify their own test (Pass or Fail) if role_level < 4
- `tested_by === req.user.id && role_level < 4` → 403 error
- L4+ can certify any test (override)
- This prevents quality falsification

## NCR (Non-Conformance Report)
When a test is marked Fail:
- `auditLog()` inserts into `audit_log` with action='NCR_RAISED'
- `module='Quality'`, `record_id=quality_test.id`
- All NCRs queryable via audit_log for compliance reporting

## Stats Endpoint Response
```json
{
  "byResult": [{"result": "Pass", "count": 120}, {"result": "Fail", "count": 5}],
  "byType": [{"test_type": "Final", "result": "Pass", "count": 100}],
  "avgParams": {"avgGsm": 75.2, "avgMoisture": 7.1, "avgBurst": 24.5, "avgCobb": 28.3}
}
```

## Rules
1. `POST /tests`: result always starts as 'Pending' (body result is ignored if provided as Pass/Fail)
2. Result changes ONLY via /pass, /fail, /retest endpoints — NOT via PUT /tests/:id
3. Maker-checker: different user must certify (unless L4+)
4. Reel hold: `quality_status='Hold'` means reel CANNOT be dispatched
5. Retest: resets quality_status to 'Pending' on linked reel
6. GRN QC: Pass sets `grn.status='Approved'`; Fail should manually update accepted/rejected qty

## Side-Effect Chain (critical to understand)
```
Pass test → reel.quality_status = 'Approved' + reel.status = 'In Warehouse'
          → Reel appears in FG Warehouse module
          → Reel becomes eligible for dispatch

Fail test → reel.quality_status = 'Rejected' + reel.status = 'Rejected'
          → NCR logged in audit_log
          → Reel excluded from production totals
          → Reel cannot be dispatched
```

## Common Query Patterns
```sql
-- Today's pass rate
SELECT
  COUNT(*) FILTER (WHERE result='Pass') AS pass,
  COUNT(*) FILTER (WHERE result='Fail') AS fail,
  COUNT(*) FILTER (WHERE result='Pending') AS pending
FROM quality_tests WHERE DATE(test_date) = CURRENT_DATE;

-- Average quality params for approved reels this month
SELECT AVG(gsm), AVG(moisture_pct), AVG(burst_factor)
FROM quality_tests
WHERE result='Pass' AND DATE_TRUNC('month', test_date) = DATE_TRUNC('month', CURRENT_DATE);
```
