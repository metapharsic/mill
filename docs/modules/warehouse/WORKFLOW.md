# FG Warehouse Module — Full Workflow & Rules

## Overview
Finished Goods Warehouse: tracks QC-approved reels in storage, packing operations
(wrap/strap), pack number assignment, label printing, and grade-based inventory.

## Key Files
| File | Purpose |
|---|---|
| `backend/src/routes/warehouse.js` | All warehouse endpoints |
| `frontend/src/pages/FGWarehouse.jsx` | Warehouse UI |
| DB: `reels`, `packing_records` | Core tables |

## Database Tables
| Table | Purpose |
|---|---|
| `reels` | Reels with status='In Warehouse' are FG stock |
| `packing_records` | Packing records per reel (pack number, wrap material) |

## API Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/warehouse/reels` | L1+ | FG reels in warehouse (filter: gradeId, from, to) — max 500 |
| GET | `/warehouse/packing` | L1+ | Packing records (filter: from, to) |
| POST | `/warehouse/packing` | L1+ | Create packing record for a reel |
| PUT | `/warehouse/packing/:id/label` | L1+ | Mark label as printed |
| GET | `/warehouse/grades` | L1+ | Active grades dropdown |

## Reel in Warehouse
A reel appears in the FG Warehouse when:
- `reel.status = 'In Warehouse'` (set by Quality module on test pass)
- `reel.quality_status = 'Approved'`

Reel leaves the FG Warehouse when:
- `reel.status = 'Dispatched'` (set by Sales dispatch)

## Pack Number Format
Auto-generated: `PACK-YYYYMMDD-{4-digit seq}` (seq resets daily)
Example: `PACK-20260717-0001`

## Packing Record Fields
| Field | Description |
|---|---|
| `pack_number` | Auto-generated packing number |
| `reel_id` | FK → reels (the reel being packed) |
| `packing_type` | Roll / Pallet / Bundle |
| `wrap_material` | HDPE Wrap / Kraft Paper / Stretch Film |
| `net_weight_kg` | Net weight of reel |
| `gross_weight_kg` | Gross weight with packaging |
| `packed_by` | FK → users |
| `label_printed` | Boolean — has address label been printed |
| `remarks` | Notes |

## Warehouse Summary (from GET /reels response)
```json
{
  "summary": {
    "totalReels": 45,
    "totalWeight": 112500,
    "grades": 3
  }
}
```

## Packing Types
| Type | Usage |
|---|---|
| Roll | Standard paper reel — as-is |
| Pallet | Multiple small rolls on pallet |
| Bundle | Sheeted/cut paper bundled |

## Wrap Materials
| Material | Usage |
|---|---|
| HDPE Wrap | Standard moisture protection |
| Kraft Paper | Economy wrapping |
| Stretch Film | Pallet wrapping |
| Combination | HDPE + Kraft paper |

## Rack Location (from reels table)
- `reels.rack_location` — where reel is physically stored (e.g., "R3-A2")
- Format: Row-Aisle (R = Row, A = Aisle), e.g., "R1-A1" through "R10-A5"
- Updated when reel arrives in warehouse from production floor

## FIFO Rule
For dispatch fulfillment:
- When multiple reels of same grade+GSM available, pick OLDEST first
- Order by `reels.created_at ASC` when selecting for dispatch

## Rules
1. Only status='In Warehouse' reels appear in FG Warehouse — enforced by query `WHERE r.status = 'In Warehouse'`
2. Packing record is optional but recommended before dispatch (enables label printing)
3. Label printing: once `label_printed=true`, no further updates needed
4. `net_weight_kg` should match `reel.weight_kg` (tare of packaging = gross - net)
5. FIFO for dispatch: always select oldest reel of matching grade+GSM
6. Do NOT modify reel.status from this module — status is managed by Production and Sales

## Common Query Patterns
```sql
-- FG stock by grade
SELECT g.name AS grade, g.code, COUNT(r.id) AS reels,
       SUM(r.weight_kg)/1000 AS total_mt,
       AVG(r.gsm) AS avg_gsm
FROM reels r
JOIN grades g ON g.id = r.grade_id
WHERE r.status = 'In Warehouse'
GROUP BY g.id, g.name, g.code ORDER BY total_mt DESC;

-- Oldest reel per grade for FIFO dispatch
SELECT r.id, r.reel_number, r.weight_kg, r.gsm, r.rack_location, r.created_at
FROM reels r
WHERE r.status = 'In Warehouse' AND r.grade_id = $1
ORDER BY r.created_at ASC LIMIT 1;

-- Unpacked reels in warehouse
SELECT r.reel_number, r.weight_kg, g.name AS grade
FROM reels r
LEFT JOIN packing_records pr ON pr.reel_id = r.id
LEFT JOIN grades g ON g.id = r.grade_id
WHERE r.status = 'In Warehouse' AND pr.id IS NULL
ORDER BY r.created_at ASC;
```
