# Production Module — Full Workflow & Rules

## Overview
Core paper manufacturing data entry: shifts, reels (paper rolls), downtime events, OEE calculation,
Daily Production Reports (DPR), shift reports, and chemical consumption per shift.

## Key Files
| File | Purpose |
|---|---|
| `backend/src/routes/production.js` | All production endpoints (1072 lines) |
| `backend/src/routes/dpsImport.js` | DPS Excel import (Daily Performance Statement) |
| `frontend/src/pages/Production.jsx` | Production UI |
| `frontend/src/pages/DailyReport.jsx` | DPR UI |

## Database Tables
| Table | Purpose |
|---|---|
| `shifts` | Shift records (Open/Closed, Day/Night) |
| `reels` | Individual paper reel data |
| `downtime_entries` | Machine downtime events |
| `production_summary` | Aggregated daily/shift summaries |
| `daily_production_reports` | Full DPR headers |
| `dpr_gsm_breakup` | DPR: GSM-wise production breakdown |
| `dpr_chemical_lines` | DPR: Chemical consumption per line |
| `dpr_downtime_lines` | DPR: Downtime reasons in DPR |
| `dpr_grade_standards` | Standard consumption ratios per grade |
| `shift_reports` | Section-wise shift reports |
| `chemical_consumption` | Chemical usage per shift per chemical |
| `downtime_reason_codes` | Master list of reason codes |

## API Endpoints (all require auth)

### Shifts
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/production/shifts` | L1+ | List shifts (filter: date, machine_id) |
| POST | `/production/shifts` | L2+ | Open a new shift |
| PUT | `/production/shifts/:id` | L2+ | Close shift (sets status=Closed, end_time) |

### Reels
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/production/reels` | L1+ | List reels (filter: date, shift, machine_id, status, grade_id) — paginated |
| POST | `/production/reels` | L1+ | Create reel (auto-generates reel_number + barcode, auto-deducts pulp/chemicals) |
| PUT | `/production/reels/:id/status` | L2+ | Advance reel status (enforced state machine) |

### Downtime
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/production/downtime` | L1+ | List downtime entries (filter: date, machine_id, category) |
| POST | `/production/downtime` | L1+ | Log downtime event |
| PUT | `/production/downtime/:id/close` | L2+ | Close downtime (auto-computes duration) |

### OEE
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/production/oee?date=` | L1+ | OEE per machine. Source 1: `daily_production_reports`. Fallback: reel aggregates |

### Production Summary
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/production/summary?from=&to=` | L1+ | Production summary from `production_summary` table |

### Daily Production Report (DPR)
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/production/daily-report?date=&machine_id=` | L1+ | Full assembled DPR with ratios, variance vs standards, 7-day weekly avg |
| GET | `/production/daily-report/list?from=&to=` | L1+ | DPR list (headers only) |
| GET | `/production/daily-report/autofill?date=&machine_id=` | L1+ | Pre-fills DPR form from reels, utility, chemical modules |
| POST/PUT | `/production/daily-report` | L2+ | Create/Update DPR header and child lines |

### Shift Reports
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/production/shift-reports` | L1+ | List shift reports (filter: date, shift_type, section) |
| POST | `/production/shift-reports` | L1+ | Upsert shift report (`ON CONFLICT (date, shift_type, section)`) |

### Chemical Consumption
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/production/chemical-consumption?date=` | L1+ | Chemical consumption records |
| POST | `/production/chemical-consumption` | L1+ | Log chemical consumption for shift |

## Reel Number Format
Auto-generated: `MK-YYYYMMDD-{MACHCODE}-{4-digit sequence}`
Example: `MK-20260717-PM01-0001`

Barcode: `MK-{reelNumber}-{timestamp}`

## Reel Status Machine (VALID_TRANSITIONS — enforced server-side)
```
In Production  →  QC Pending    (by L2+)
QC Pending     →  QC Done       (by L2+)
QC Done        →  In Warehouse  (by L2+)
QC Done        →  Rejected      (by L2+)
In Warehouse   →  Dispatched    (by Sales dispatch)
```
Any other transition is rejected with 400 error. Transitions are logged to audit_log.

## Auto Material Deduction on Reel Save
When a reel is saved with `weight_kg > 0`, the server automatically:
1. Finds Pulp/Starch material (CHEM category): deducts `weight_kg × 0.90`
2. Finds first non-pulp additive: deducts `weight_kg × 0.02`
3. Updates `materials.current_stock`
4. Creates `stock_ledger` entries (type=Issue, reference_type=Production)
All inside the same ACID transaction.

## OEE Calculation
```
OEE = Availability × Performance × Quality

Availability = RunningMinutes / (RunningMinutes + DownMinutes)
Performance  = ActualSpeed / DesignSpeed (capped at 100%)
Quality      = FinishProductionMt / PMCProductionMt

Data source 1 (preferred): daily_production_reports.running_minutes, .down_minutes, .machine_speed_avg
Data source 2 (fallback):  aggregated from reels table for the day
```

## DPR Autofill Sources
DPR autofill (`/daily-report/autofill`) pulls from:
- `reels` → PMC production (all reels), finish (QC Approved), GSM breakup
- `utility_readings` → power units, DG units, steam (MT), coal/husk (MT)
- `chemical_consumption` → per-chemical daily totals

## DPR Chemical Variance vs Standards
Standards are in `dpr_grade_standards` table (grade-specific + DEFAULT fallback).
For each chemical line: `variance = actual_kg_per_ton - std_kg_per_ton`
Status = 'ALERT' if `|variance| > 5% of std`.
Tracked chemicals: starch, PAC, surface size, coagulant, deformer, retention aid, SE-Bond, Sigmaexor/ETP.

## Efficiency Calculation (server-side, not client)
```
efficiency_pct = ((production_time_min - break_time_min - downtime_min) / production_time_min) × 100
Clamped: 0 ≤ efficiency_pct ≤ 100
```

## Downtime Categories
Mechanical | Electrical | Process | Quality | Break | Changeover

## Rules
1. Only L2+ can open/close shifts — operators cannot
2. Reel status transitions are strictly enforced (VALID_TRANSITIONS object)
3. Cannot self-approve a quality test (tested_by != approver, unless L4+)
4. Past shift data changes: require L4+ (no soft rule currently enforced, but convention)
5. DPR must be filled daily per machine — autofill reduces double entry
6. `downtime_min` on reel should match sum of downtime_entries for that reel (integrity check)
7. All mutations (shift open/close, reel create, downtime log) write to audit_log in same transaction

## Indexes
- `idx_reels_shift` — shift_id queries
- `idx_reels_machine` — machine_id queries
- `idx_reels_date` — date range queries on start_time
- `idx_reels_status` — status filter queries

## Kafka Events Published
| Event | Trigger |
|---|---|
| (none currently on production routes) | — |

Note: chemical consumption and DPR routes use direct DB only. Kafka publish is in store/indent routes.

## 2-Stage Manufacturing Architecture (PPC & Slitting-Rewinding)

> Detailed Master Architecture & Roadmap: See [`PPC_SLITTING_ARCHITECTURE_AND_PHASES.md`](./PPC_SLITTING_ARCHITECTURE_AND_PHASES.md) and DDL migration [`db/migration_ppc_slitting_foundation.sql`](../../../db/migration_ppc_slitting_foundation.sql).

### Overview
1. **Stage 1: Production Planning (PPC)** — Translates Sales Order MT to required finished reels ($G_w$), builds cutting patterns ($N$-cuts) across machine deckle, and calculates set multipliers ($K_w$).
2. **Stage 2: Slitting-Rewinding (Shopfloor Execution)** — Mounts parent `jumbo_reels` on rewinder, sets dynamic knife positions (`ppc_pattern_cuts`), captures physical scale authority weights for finished `slit_reels` ($H$), and reconciles edge trim/broke ($T$) within $\pm 0.5\%$ mass balance tolerance.

### Implementation Phasing
- **Phase 1:** Database Foundation & Genealogy Tracking (`jumbo_reels`, `slit_reels`, `slitting_waste_log`).
- **Phase 2:** Shopfloor Slitting Touchscreen Console, Scale Authority & Mass Balance ACID Gate ($\pm 0.5\%$).
- **Phase 3:** PPC Planning Studio, Order Backlog Aggregation & Dynamic Cutting Pattern Builder ($K_w$ sets).
- **Phase 4:** Algorithmic 1D-CSP Deckle Optimizer & DPR/WhatsApp Yield Variance Analytics.

## Common Query Patterns
```sql
-- Today's total production
SELECT SUM(weight_kg)/1000 AS mt, COUNT(*) AS reels
FROM reels WHERE DATE(start_time) = CURRENT_DATE AND status != 'Rejected';

-- OEE from reels
SELECT
  SUM(production_time_min - COALESCE(downtime_min,0)) / NULLIF(SUM(production_time_min),0) AS availability,
  AVG(efficiency_pct) AS avg_efficiency,
  AVG(reject_pct) AS reject_rate
FROM reels WHERE DATE(start_time) = $1 AND machine_id = $2;

-- Downtime pareto
SELECT category, SUM(duration_min) AS total_min
FROM downtime_entries WHERE DATE(start_time) BETWEEN $1 AND $2
GROUP BY category ORDER BY total_min DESC;
```

