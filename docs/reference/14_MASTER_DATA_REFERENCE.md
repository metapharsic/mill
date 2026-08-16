# MK Paper Mill ERP — Master Data Reference

> **AI INSTRUCTION:** Read this before writing any INSERT or SELECT that uses lookup/reference tables.
> Use the exact codes listed here — wrong codes silently break business logic.

---

## Departments

| id (approx) | code | name | category |
|---|---|---|---|
| 1 | `PROD` | Production | production |
| 2 | `QC` | Quality Control | production |
| 3 | `MAINT` | Maintenance | support |
| 4 | `STORE` | Store | support |
| 5 | `HR` | Human Resources | management |
| 6 | `UTIL` | Utilities | support |
| 7 | `ADMIN` | Administration | management |
| 8 | `LAB` | Laboratory | production |
| 9 | `EHS` | EHS | support |
| 10 | `SEC` | Security | support |
| 11 | `FIN` | Finance | management |
| 12 | `PURCHASE` | Purchase | support |
| 13 | `SALES` | Sales | management |

> **Never hardcode department IDs** — always join via `departments.code`. IDs can vary per installation.

---

## Roles & Levels

| level | name | Typical Role |
|---|---|---|
| 1 | Operator / Technician | Shop-floor data entry |
| 2 | Supervisor | Can approve routine requests |
| 3 | Manager / HOD | Department decisions, HR leave approval |
| 4 | Plant Head / GM | Financial approvals, payroll sign-off |
| 5 | Admin / IT | System configuration, user management |

> `requireLevel(N)` blocks anyone with `role_level < N`.

---

## Machines

| code | name | Notes |
|---|---|---|
| `PM1` | Paper Machine 1 | Primary production machine |
| `PM2` | Paper Machine 2 | Secondary machine (if active) |
| `RW1` | Rewinder 1 | Reel rewinding |
| `RW2` | Rewinder 2 | |
| `CH1` | Cutter Head 1 | Sheeting/cutting |

> Machine codes are set in `machines.code`. Query live: `SELECT id, code, name FROM machines WHERE is_active=true ORDER BY name`

---

## Grades

Paper grades tracked in the `grades` table:

| code | name | GSM Range | Notes |
|---|---|---|---|
| `KRAFT` | Kraft Paper | 70–120 | Packing grade |
| `MAP` | Maplitho | 60–100 | Writing/printing |
| `NEWS` | Newsprint | 45–55 | Newspaper printing |
| `MG` | MG Paper | 30–60 | Tissue/wrapping |
| `WRT` | Writing | 60–90 | Notebooks/stationery |
| `BOX` | Board | 150–300 | Packaging board |

> Query live for accurate list: `SELECT id, code, name FROM grades WHERE is_active=true ORDER BY name`

---

## Material Categories

| id (approx) | code | name | type |
|---|---|---|---|
| 1 | `RAW` | Raw Material | raw |
| 2 | `SPARE` | Spare Parts | spare |
| 3 | `CHEM` | Chemicals | chemical |
| 4 | `CONS` | Consumables | consumable |
| 5 | `PACK` | Packaging Material | packaging |
| 6 | `FUEL` | Fuel | fuel |
| 7 | `ELEC` | Electrical | electrical |
| 8 | `INS` | Instruments/Gauges | instrument |
| 9 | `LUBT` | Lubricants | lubricant |
| 10 | `SAFETY` | Safety Items | safety |
| 11 | `STATIONARY` | Stationery | general |

> **Note:** Category IDs were reset in `migration_inventory_category_reset.sql`. Always join on `code`, never hardcode `category_id`.

---

## Plant Sections (21 sections)

### Production Dept (PROD)
| section_code | name |
|---|---|
| `PULPMILL` | Pulp Mill |
| `CENTRICLEANER` | Centri Cleaner |
| `WIRE` | Wire Section |
| `PRESS` | Press Section |
| `UNIRUN` | Unirun |
| `PRE_DRYER` | Pre-Dryer |
| `SIZE_PRESS` | Size Press |
| `POST_DRYER` | Post-Dryer |
| `CALENDER` | Calender |
| `POPE_REEL` | Pope Reel |
| `REWINDER` | Rewinder |
| `CRANES` | Cranes |

### QC / Lab Dept
| section_code | name |
|---|---|
| `LAB` | Laboratory |
| `SIZE_KITCHEN` | Size Kitchen |
| `STARCH_KITCHEN` | Starch Kitchen |

### Utilities Dept (UTIL)
| section_code | name |
|---|---|
| `BOILER` | Boiler House |
| `STEAM_COND` | Steam Condensate |
| `ETP` | Effluent Treatment Plant |
| `COMPRESSORS` | Compressors |
| `VACUUM` | Vacuum System |

### Store Dept
| section_code | name |
|---|---|
| `STORE` | Store |

---

## Reel Statuses

| status | Set By | Meaning |
|---|---|---|
| `In Production` | Production | Being made on machine |
| `QC Pending` | Production (operator) | Ready for QC test |
| `QC Done` | Quality | QC completed |
| `In Warehouse` | Quality (on Pass) | QC approved, in FG store |
| `Rejected` | Quality (on Fail) | Failed QC — scrapped |
| `Dispatched` | Sales | Sent to customer |

---

## Indent Statuses

| status | Meaning |
|---|---|
| `Draft` | Created, not submitted |
| `Submitted` | Sent for approval |
| `L1 Approved` | Store Head approved |
| `Approved` | Plant Head approved (ready to issue) |
| `Issued` | Stock issued — ack pending |
| `Closed` | All items acknowledged |
| `Rejected` | Rejected at any stage |
| `Cancelled` | Cancelled by raiser |

---

## Quality Test Result Values

| result | Meaning |
|---|---|
| `Pending` | Test created, not yet finalized |
| `Pass` | All parameters within spec |
| `Fail` | One or more parameters out of spec |
| `Hold` | Borderline — re-test pending |

---

## Leave Types

| code | name | Default Days/Year |
|---|---|---|
| `EL` | Earned Leave | 15 |
| `SL` | Sick Leave | 10 |
| `CL` | Casual Leave | 10 |
| `CO` | Comp Off | As earned |
| `LWP` | Leave Without Pay | Unlimited (salary deducted) |

---

## Attendance Status Values

| status | Description |
|---|---|
| `Present` | Full day |
| `Absent` | Not present |
| `Half Day` | Half shift |
| `Leave` | On approved leave |
| `Holiday` | Company holiday |
| `OT` | Overtime |

---

## Maintenance Types

| type | Description |
|---|---|
| `Preventive` | Fixed-interval scheduled servicing |
| `Predictive` | Condition-based (vibration, temp) |
| `Breakdown` | Emergency / unplanned |
| `Lubrication` | Greasing/oiling schedule |

## Maintenance Priority Levels

| priority | Urgency |
|---|---|
| `Critical` | Immediate (< 1 hour) |
| `High` | Within 24 hours |
| `Medium` | Within 1 week |
| `Low` | Planned |

---

## Stock Ledger Transaction Types

| type | Direction | Trigger |
|---|---|---|
| `GRN` | In | GRN approved |
| `Issue` | Out | Store issue / Indent issue |
| `Return` | In | Material returned |
| `Transfer` | In+Out | Inter-location transfer |
| `Adjustment` | In or Out | Manual correction |
| `Scrap` | Out | Written off |

---

## Notification Types

| type | Usage | Color |
|---|---|---|
| `critical` | High-value transactions, LTI incidents | Red |
| `warning` | Low stock alerts, overdue acks | Yellow |
| `info` | Leave approved, payroll ready, general | Blue |

---

## Auto-Generated Number Formats

| Module | Format | Example |
|---|---|---|
| Reel | `MK-YYYYMMDD-{MACHCODE}-{NNNN}` | `MK-20260717-PM01-0001` |
| Indent | `IND-YYYYMMDD-{NNNN}` | `IND-20260717-0001` |
| Store Issue | `SI-YYYYMMDD-{NNNN}` | `SI-20260717-0001` |
| GRN | `GRN-YYYYMMDD-{NNNN}` | `GRN-20260717-0001` |
| Purchase Order | `PO-YYYYMMDD-{NNNN}` | `PO-20260717-0001` |
| Sales Order | `SO-YYYYMMDD-{NNNN}` | `SO-20260717-0001` |
| Dispatch Order | `DO-YYYYMMDD-{NNNN}` | `DO-20260717-0001` |
| Quality Test | `QT-YYYYMMDD-{NNNN}` | `QT-20260717-0001` |
| Asset | `AST-YYYYMMDD-{NNNN}` | `AST-20260717-0001` |
| Pack | `PACK-YYYYMMDD-{NNNN}` | `PACK-20260717-0001` |

> All sequences reset daily. NNNN is zero-padded to 4 digits.
> Indent and Quality Test use `pg_advisory_xact_lock(hashtext(...))` for concurrency safety.

---

## Shift Derivation Logic

```javascript
// Used in: inventory.js, store.js, production.js
const deriveShift = (explicit) => {
  if (explicit === 'Day' || explicit === 'Night') return explicit;
  const hr = new Date().getHours();
  return (hr >= 6 && hr < 18) ? 'Day' : 'Night';
};
// Day shift:   06:00 – 17:59
// Night shift: 18:00 – 05:59
```

---

## High-Value Transaction Thresholds

Used in inventory.js `notifyHighTxn()`:
```javascript
const HIGH_VALUE = 100000;  // ₹1,00,000
const HIGH_PCT   = 0.5;     // 50% of current stock in one go
```
Triggers notification to STORE L3+ and org-wide L4+, plus Kafka EVENTS_CRIT publish.

---

## Key Environment Variables

| Variable | Purpose | Default |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://postgres:password@localhost:5432/mk_paper_mill` |
| `JWT_SECRET` | JWT signing key | `mk_paper_mill_jwt_secret_change_this` ⚠️ CHANGE IN PROD |
| `PORT` | Backend port | `5000` |
| `KAFKA_BROKERS` | Kafka broker(s) | Optional — system works without it |
| `VITE_API_URL` | Frontend API base URL | `''` (proxied via Vite) |
| `NODE_ENV` | Environment | `development` |
