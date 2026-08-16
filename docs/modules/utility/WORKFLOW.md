# Utility Module — Full Workflow & Rules

## Overview
Tracks all energy and resource consumption: grid power, DG power, steam, boiler, coal/husk,
water (fresh + process), compressed air, and ETP (effluent treatment plant) data per shift.
Feeds into DPR autofill and section KPI snapshots.

## Key Files
| File | Purpose |
|---|---|
| `backend/src/routes/utility.js` | All utility endpoints (143 lines) |
| `frontend/src/pages/Utility.jsx` | Utility data entry UI |
| DB: `utility_readings` | Per-shift/reading utility data |

## Database Tables
| Table | Purpose |
|---|---|
| `utility_readings` | Individual readings per date+shift |

## API Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/utility/readings` | L1+ | List readings (filter: date, shift_type, page, limit) |
| POST | `/utility/readings` | L1+ | Log a reading |
| PUT | `/utility/readings/:id` | L3+ | Correct a reading |
| GET | `/utility/summary` | L1+ | Daily summary with efficiency metrics |

## Reading Fields
| Field | Unit | Description |
|---|---|---|
| `date` | YYYY-MM-DD | Reading date |
| `shift_type` | Day/Night | Shift |
| `reading_time` | TIMESTAMPTZ | Exact time of reading |
| `power_units` | kWh | Grid power consumed |
| `dg_units` | kWh | DG (diesel generator) power |
| `steam_generated_mt` | MT | Steam produced by boiler |
| `coal_consumed_kg` | KG | Coal/husk burnt |
| `boiler_pressure` | bar | Boiler steam pressure |
| `boiler_temp` | °C | Boiler steam temperature |
| `fresh_water_kl` | KL | Fresh water intake |
| `process_water_kl` | KL | Process/recycled water |
| `air_pressure` | bar | Compressed air header pressure |
| `etp_inlet_kl` | KL | ETP influent flow |
| `etp_outlet_kl` | KL | ETP effluent flow (compliance-critical) |

## Daily Summary — Computed Metrics
The `/utility/summary` endpoint computes:
```
steam_efficiency = (total_steam_mt × 1000) / total_coal_kg  [kg steam per kg coal]
power_intensity  = (total_power + total_dg) / production_kg  [kWh per kg paper]
specific_water   = total_fresh_water_kl / production_mt       [KL per MT paper]
```
Production data joined from `reels` table for the same date.

## ETP Data (Environmental Compliance)
- `etp_inlet_kl` and `etp_outlet_kl` are compliance-critical
- ETP outlet is reported to CPCB/SPCB regulators
- NEVER falsify or skip ETP readings
- ETP efficiency = 1 - (outlet_kl / inlet_kl) if both > 0

## DPR Integration
DPR autofill (`GET /production/daily-report/autofill`) pulls from utility_readings:
```sql
SELECT COALESCE(SUM(power_units),0), COALESCE(SUM(dg_units),0),
       COALESCE(SUM(steam_generated_mt),0), COALESCE(SUM(coal_consumed_kg),0)/1000.0
FROM utility_readings WHERE date = $1
```

## KPI Cron Integration
`section_kpi_snapshots` are computed hourly by server.js cron from:
- `section_process_readings` (for BOILER, ETP, COMPRESSORS sections)
- `utility_readings` feeds into UTIL department section KPIs

## Rules
1. Any user (L1+) can enter utility readings for their shift
2. Date range queries always required — no unbounded full-table scans
3. Corrections: L3+ only (audit-controlled change to environmental data)
4. ETP outlet data is compliance-critical — must not be falsified, ever
5. Multiple readings per shift allowed (per `reading_time` timestamp)
6. Required fields: `date` AND `reading_time` — reject without them

## Common Query Patterns
```sql
-- Monthly utility summary
SELECT DATE_TRUNC('month', date) AS month,
       SUM(power_units + dg_units) AS total_power_kwh,
       SUM(steam_generated_mt) AS total_steam_mt,
       SUM(fresh_water_kl + process_water_kl) AS total_water_kl,
       SUM(coal_consumed_kg) AS total_coal_kg
FROM utility_readings
WHERE date BETWEEN $1 AND $2
GROUP BY 1 ORDER BY 1;

-- Energy intensity trend
SELECT date, SUM(power_units + dg_units) AS power_kwh
FROM utility_readings
WHERE date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY date ORDER BY date;
```
