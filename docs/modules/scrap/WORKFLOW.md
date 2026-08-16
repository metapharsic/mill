# Scrap Module — Full Workflow & Rules

## Overview
Tracks scrap and waste generated during production. Records type, quantity, disposal method,
and buyer for scrap sales. Feeds into production loss analysis and cost reporting.

## Key Files
| File | Purpose |
|---|---|
| `backend/src/routes/scrap.js` | All scrap endpoints |
| `frontend/src/pages/Scrap.jsx` | Scrap management UI |
| DB: `scrap_records` | Core table |

## Database Tables
| Table | Purpose |
|---|---|
| `scrap_records` | Individual scrap generation and disposal records |

## API Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/scrap` | L1+ | List scrap records (filter: from, to, scrapType) |
| GET | `/scrap/:id` | L1+ | Single scrap record |
| POST | `/scrap` | L2+ | Log new scrap record |
| PUT | `/scrap/:id` | L2+ | Update scrap record (type, qty, status, remarks) |

## Scrap Record Fields
| Field | Type | Description |
|---|---|---|
| `date` | DATE | Date of scrap generation |
| `shift_type` | Day/Night | Shift during which scrap occurred |
| `machine_id` | INTEGER | FK → machines (which machine generated scrap) |
| `scrap_type` | VARCHAR | Category of scrap (see types below) |
| `quantity_kg` | NUMERIC | Weight of scrap in kg |
| `description` | TEXT | Detail of what was scrapped and why |
| `disposal_method` | VARCHAR | How scrap was disposed |
| `buyer_name` | VARCHAR | Scrap dealer/buyer name |
| `sale_amount` | NUMERIC | Revenue from scrap sale (default 0) |
| `status` | VARCHAR | Pending / Disposed / Sold |
| `remarks` | TEXT | Additional notes (added via `migration_scrap_remarks_column.sql`) |

## Scrap Types
| Type | Description |
|---|---|
| Paper Broke | Paper that broke during manufacturing |
| Edge Trim | Edges cut during slitting/rewinding |
| Off-Grade | Reels that failed quality and cannot be sold |
| Machine Waste | Paper waste from machine startup/stops |
| Wire Section | Wire/fabric waste |
| Chemical Waste | Chemical containers, spent chemicals |
| Metal Scrap | Metal filings, worn parts |
| Rejects | Customer-rejected material returned |

## Disposal Methods
| Method | Description |
|---|---|
| Sold to Dealer | Commercial scrap sale |
| Own Recycling | Repulped back into production (broke) |
| Disposed | Waste disposal (landfill/authorized) |
| Returned to Vendor | Vendor returns/credits |

## Scrap Status Flow
```
Pending → Sold (when sale_amount set + buyer_name set)
        → Disposed (when disposal_method set)
```

## Integration with Production
- Rejected reels (`reels.status='Rejected'`) should be logged as Off-Grade scrap
- Paper broke from downtime events → Paper Broke scrap log
- Edge trim from rewinder → Edge Trim log
- Monthly scrap report: cross-referenced with production to compute scrap rate %

## Rules
1. L2+ to create scrap records (supervisors log scrap)
2. L3+ to authorize disposal (manager approval for permanent removal)
3. Sold scrap: `sale_amount` and `buyer_name` mandatory
4. Broke paper: `quantity_kg` should match sum of broke entries in shift
5. NEVER delete scrap records — update status to Disposed/Sold

## Common Query Patterns
```sql
-- Monthly scrap by type
SELECT scrap_type, SUM(quantity_kg) AS total_kg, SUM(sale_amount) AS revenue
FROM scrap_records
WHERE date BETWEEN $1 AND $2
GROUP BY scrap_type ORDER BY total_kg DESC;

-- Scrap rate vs production
SELECT
  DATE_TRUNC('month', s.date) AS month,
  SUM(s.quantity_kg) AS scrap_kg,
  (SELECT SUM(r.weight_kg) FROM reels r
   WHERE DATE_TRUNC('month', r.start_time) = DATE_TRUNC('month', s.date)) AS production_kg,
  ROUND(SUM(s.quantity_kg) * 100.0 /
    NULLIF((SELECT SUM(r.weight_kg) FROM reels r
            WHERE DATE_TRUNC('month', r.start_time) = DATE_TRUNC('month', s.date)), 0), 2) AS scrap_pct
FROM scrap_records s
WHERE s.date >= CURRENT_DATE - INTERVAL '6 months'
GROUP BY 1 ORDER BY 1;

-- Pending disposal (unsold/undisposed scrap)
SELECT date, machine_id, scrap_type, quantity_kg, description
FROM scrap_records
WHERE status = 'Pending'
ORDER BY date ASC;
```
