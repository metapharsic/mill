# Reports Module — Full Workflow & Rules

## Overview
Cross-module reporting with CSV export, multi-dimensional aggregation, and management dashboards.
All reports support date range filtering. CSV export via BOM-prefixed UTF-8 for Excel compatibility.

## Key Files
| File | Purpose |
|---|---|
| `backend/src/routes/reports.js` | All report endpoints |
| `frontend/src/pages/Reports.jsx` | Reports UI |

## CSV Export Format
All reports support `?format=csv` query parameter.
CSV helper functions:
- `escCSV()` — escapes commas, quotes, newlines
- `sendCSV()` — sets Content-Type header, adds BOM prefix (`\uFEFF`) for Excel

## API Endpoints

### Production Reports
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/reports/production` | L2+ | Production report (filter: from, to, machine_id, grade_id) |
| GET | `/reports/production?format=csv` | L2+ | Same as CSV download |

Response structure:
```json
{
  "summary": { "total_reels", "total_kg", "total_mt", "avg_efficiency", "avg_gsm", "avg_moisture", "total_downtime_min" },
  "byMachine": [{ "machine", "code", "reels", "total_kg", "avg_efficiency" }],
  "byGrade": [{ "grade", "code", "reels", "total_kg", "avg_gsm" }],
  "reels": [{ "reelNumber", "startTime", "machine", "grade", "gsm", "weightKg", "efficiencyPct", "status" }]
}
```

### Inventory Reports
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/reports/inventory` | L2+ | Current stock levels (filter: category_id, low_stock) |
| GET | `/reports/inventory?format=csv` | L2+ | CSV download |

### Quality Reports
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/reports/quality` | L2+ | QC test results (filter: from, to, result, test_type) |
| GET | `/reports/quality?format=csv` | L2+ | CSV download |

### Maintenance Reports
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/reports/maintenance` | L2+ | Maintenance work log (filter: from, to, machine_id, type) |

### Utility Reports
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/reports/utility` | L2+ | Utility consumption (filter: from, to) |

### HR Reports
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/reports/hr/attendance` | is_hr_admin | Attendance summary (filter: month, year, dept) |
| GET | `/reports/hr/payroll` | is_hr_admin | Payroll summary (filter: month, year) |
| GET | `/reports/hr/attendance?format=csv` | is_hr_admin | CSV download |

### Financial Reports
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/reports/finance` | L4+ | Financial summary (P&L, payables, receivables) |

### Indent / Store Reports
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/reports/indent` | L2+ | Indent analytics (filter: from, to, dept) |
| GET | `/reports/store` | L2+ | Store issue and stock report |

## Report Access Levels
| Report | Minimum Level | Notes |
|---|---|---|
| Production | L2 | Daily supervisor report |
| Inventory | L2 | Stock levels |
| Quality | L2 | QC summary |
| Maintenance | L2 | Work log |
| Utility | L2 | Consumption data |
| HR Attendance | is_hr_admin | Sensitive data |
| HR Payroll | is_hr_admin | Financial PII |
| Financial P&L | L4 | Plant Head only |
| Indent/Store | L2 | Operational |

## Production Report Details
```sql
-- Core query
SELECT COUNT(*), SUM(weight_kg), SUM(weight_kg)/1000 AS mt,
       AVG(efficiency_pct), AVG(gsm), AVG(moisture_pct),
       SUM(downtime_min), SUM(steam_consumption), SUM(water_consumption)
FROM reels r WHERE DATE(r.start_time) BETWEEN $1 AND $2
  [AND r.machine_id = $3] [AND r.grade_id = $4]

-- By machine
SELECT m.name, COUNT(*), SUM(weight_kg), AVG(efficiency_pct)
FROM reels r JOIN machines m ... GROUP BY m.id

-- By grade  
SELECT g.name, COUNT(*), SUM(weight_kg), AVG(gsm)
FROM reels r JOIN grades g ... GROUP BY g.id
```

## Rules
1. Date range filters are MANDATORY for all report queries (prevent full table scans)
2. Default range: today if from/to not provided
3. CSV export: BOM prefix required for Excel UTF-8 compatibility
4. Max rows: production reel detail limited to 500 rows (use CSV for full data)
5. No aggregation queries without WHERE clause — always filter by at least date range
6. Financial reports: L4+ only — never expose P&L to operational users

## Inventory Report Details
```json
{
  "materials": [
    {
      "code", "name", "categoryName", "uom",
      "currentStock", "minStock", "unitPrice",
      "stockValue",
      "lowStock": true/false
    }
  ],
  "summary": { "totalItems", "lowStockItems", "totalValue" }
}
```

## CSV Export Headers (Production)
```
Reel No, Start Time, Machine, Grade, GSM, Weight (kg), Efficiency %, Moisture %, Status, Quality Status
```

## Common Patterns
```sql
-- GSM-wise production summary
SELECT r.gsm, COUNT(*) AS reels, SUM(r.weight_kg)/1000 AS mt
FROM reels r
WHERE DATE(r.start_time) BETWEEN $1 AND $2 AND r.status != 'Rejected'
GROUP BY r.gsm ORDER BY r.gsm;

-- Downtime pareto
SELECT d.category, SUM(d.duration_min) AS total_min,
       ROUND(SUM(d.duration_min) * 100.0 / SUM(SUM(d.duration_min)) OVER (), 1) AS pct
FROM downtime_entries d
WHERE DATE(d.start_time) BETWEEN $1 AND $2
GROUP BY d.category ORDER BY total_min DESC;
```
