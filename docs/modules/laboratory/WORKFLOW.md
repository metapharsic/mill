# Laboratory Module — Full Workflow & Rules

## Overview
Chemical and process lab tests for production QA. Distinct from Quality module (which handles
paper physical properties). Laboratory handles water analysis, pulp consistency, starch checks,
chemical concentration tests, and effluent lab tests.

## Key Files
| File | Purpose |
|---|---|
| `backend/src/routes/laboratory.js` | Lab endpoints |
| `frontend/src/pages/Laboratory.jsx` | Lab UI |
| DB: `lab_tests`, `lab_parameters` | Core tables |

## Difference from Quality Module
| Aspect | Quality Module | Laboratory Module |
|---|---|---|
| Focus | Paper physical properties | Chemical/process lab tests |
| Tests | GSM, moisture, burst, cobb | pH, COD, BOD, consistency |
| Reference | Reels, GRNs | Process points, ETP, chemicals |
| Result | Approves/rejects reels | Advises process adjustments |

## API Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/lab/tests` | L1+ | List lab tests (filter: date, test_type, result) |
| GET | `/lab/tests/:id` | L1+ | Single test detail |
| POST | `/lab/tests` | L2+ | Create lab test |
| PUT | `/lab/tests/:id` | L2+ | Update test results |
| PUT | `/lab/tests/:id/approve` | L3+ | Approve/sign off test |
| GET | `/lab/parameters` | L1+ | Test parameter master |
| GET | `/lab/summary` | L2+ | Summary stats by test type |

## Lab Test Types
| Type | What is Tested | Parameters |
|---|---|---|
| Water Analysis | Process / fresh water | pH, TDS, Turbidity, Hardness, COD, BOD |
| Pulp Consistency | Stock consistency | Freeness (CSF), Fiber length, Consistency % |
| Chemical Check | Chemical concentration | Active %, ppm concentration |
| Starch Check | Starch solution | Viscosity, Concentration, Degree of cook |
| ETP Effluent | Effluent treatment output | pH, COD, BOD, TSS, Color |
| Stock pH | Paper machine stock | pH, Conductivity, Zeta potential |
| Coating | Surface coating | Viscosity, Solids % |

## Lab Test Fields
| Field | Description |
|---|---|
| `test_date` | Date of test |
| `test_time` | Time of test |
| `shift_type` | Day/Night |
| `test_type` | Category (see types above) |
| `sample_point` | Where sample was taken |
| `parameter_name` | What was measured |
| `value` | Measured value |
| `unit` | Unit of measure |
| `spec_min` / `spec_max` | Specification range |
| `result` | Within Spec / Out of Spec / Pending |
| `remarks` | Observations |
| `tested_by` | FK → users |
| `approved_by` | FK → users (L3+ sign-off) |

## ETP Lab Integration
ETP lab tests are compliance-critical:
- pH: must be 6.5 - 8.5 (regulatory limit)
- COD: must be < 250 mg/L (CPCB standard)
- BOD: must be < 30 mg/L
- TSS: must be < 100 mg/L
- Color: must be within SPCB limits
Out-of-spec results trigger automatic alert to UTIL dept head

## Pulp Freeness (CSF)
- Canadian Standard Freeness
- Target: grade-specific (typically 250-500 CSF for printing paper)
- Low freeness: slower drainage → lower machine speed
- High freeness: coarser paper → higher porosity

## Rules
1. LAB dept staff (L1+) can enter test results
2. L3+ (Lab Manager) approves/signs off tests
3. Out-of-spec results: auto-flag and notify department head
4. ETP tests: NEVER skip — regulatory compliance requirement
5. Test results inform production process adjustments (not block production)
6. Historical test data retained indefinitely for trend analysis

## Common Query Patterns
```sql
-- Today's water analysis
SELECT test_time, sample_point, parameter_name, value, unit, spec_min, spec_max, result
FROM lab_tests
WHERE test_date = CURRENT_DATE AND test_type = 'Water Analysis'
ORDER BY test_time;

-- ETP compliance trend
SELECT DATE_TRUNC('week', test_date) AS week,
       AVG(CASE WHEN parameter_name = 'COD' THEN value END) AS avg_cod,
       AVG(CASE WHEN parameter_name = 'BOD' THEN value END) AS avg_bod,
       AVG(CASE WHEN parameter_name = 'pH' THEN value END) AS avg_ph
FROM lab_tests
WHERE test_type = 'ETP Effluent'
  AND test_date >= CURRENT_DATE - INTERVAL '3 months'
GROUP BY 1 ORDER BY 1;
```
