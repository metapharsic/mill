# Chemical Store Module — Full Workflow & Rules

## Overview
Dedicated tracking of chemicals used in paper production: receipt, issuance (with requireStore),
consumption tracking, MSDS management, expiry alerts, and dosing reports.
Separate from general store for safety and compliance reasons.

## Key Files
| File | Purpose |
|---|---|
| `backend/src/routes/chemicals.js` | Chemical store endpoints |
| `frontend/src/pages/ChemicalStore.jsx` | Chemical store UI |
| DB: `chemical_inventory`, `chemical_transactions`, `msds_documents` | Core tables |

## Difference from General Store
| Aspect | General Store | Chemical Store |
|---|---|---|
| Items | Spares, consumables, raw materials | Chemicals only |
| Tracking | By quantity/weight | By quantity + batch + MSDS |
| Safety | Standard handling | MSDS required for each item |
| Expiry | Optional | Mandatory tracking |
| Dosing | Not tracked | Per-shift dosing report |

## API Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/chemicals/inventory` | L1+ | Chemical inventory list |
| GET | `/chemicals/inventory/:id` | L1+ | Single chemical detail |
| POST | `/chemicals/inventory` | L3+ | Add new chemical to master |
| GET | `/chemicals/transactions` | L1+ | Issue/receipt transactions |
| POST | `/chemicals/receive` | requireStore + L2+ | Receive chemicals into store |
| POST | `/chemicals/issue` | requireStore + L2+ | Issue chemicals to dept |
| GET | `/chemicals/dosing-report` | L1+ | Chemical dosing vs production |
| GET | `/chemicals/expiry-alerts` | L1+ | Chemicals near/past expiry |
| GET | `/chemicals/msds` | L1+ | MSDS documents list |
| POST | `/chemicals/msds` | L3+ | Upload MSDS document |

## Chemical Inventory Fields
| Field | Description |
|---|---|
| `chemical_name` | Full chemical name |
| `cas_number` | CAS registry number |
| `chemical_code` | Internal code |
| `uom` | Unit of measure (KG/LTR) |
| `current_stock` | Running balance |
| `min_stock` | Reorder level |
| `unit_price` | Cost per unit |
| `msds_url` | Link to MSDS document |
| `expiry_date` | Batch expiry date |
| `batch_number` | Current batch number |
| `hazard_class` | Hazardous material class |
| `storage_conditions` | Temperature/humidity requirements |
| `is_active` | Soft-delete flag |

## Chemicals Typically Stocked
| Chemical | Use | CAS |
|---|---|---|
| Alum (Aluminum Sulfate) | Sizing / pH control | 10043-01-3 |
| Rosin | Surface sizing | — |
| Starch | Surface sizing / wet end | — |
| PAC (Poly Aluminum Chloride) | Coagulant/flocculant | 1327-41-9 |
| OBA (Optical Brightener) | Whiteness enhancement | — |
| Cationic Starch | Retention aid | — |
| Biocide | Microbial control | — |
| Defoamer | Foam control | — |
| SE-Bond | Dry strength agent | — |
| Dyes | Paper coloring | Grade-specific |
| Caustic Soda | pH control / pulping | 1310-73-2 |
| Chlorine/Bleach | Bleaching (if used) | 7782-50-5 |
| Hydrogen Peroxide | Bleaching | 7722-84-1 |
| EDTA | Chelating agent | 60-00-4 |
| Sigmaexor | ETP treatment | — |

## Chemical Transaction Fields
| Field | Description |
|---|---|
| `chemical_id` | FK → chemical_inventory |
| `transaction_type` | Receipt / Issue / Adjustment / Scrap |
| `date` | Transaction date |
| `shift_type` | Day/Night |
| `quantity` | Amount transacted |
| `batch_number` | Chemical batch |
| `department_id` | Issuing to (for Issue transactions) |
| `reference` | Indent number / PO number |
| `issued_by` | FK → users |
| `remarks` | Notes |

## CRITICAL: requireStore on All Issue Routes
```javascript
// ALWAYS — no exceptions
router.post('/issue', requireAuth, requireStore, async (req, res) => { ... })
router.post('/receive', requireAuth, requireStore, requireLevel(2), async (req, res) => { ... })
```

## Expiry Alert Logic
- Alert if `expiry_date <= CURRENT_DATE + 30 days`
- Critical: `expiry_date <= CURRENT_DATE` (already expired)
- Warning: `30 days >= days_to_expiry > 0`
- Expired chemicals MUST NOT be issued — validation in issue route

## Dosing Report
`GET /chemicals/dosing-report?from=&to=`:
- Cross-references chemical issues with production output
- Calculates: kg of chemical per MT of paper (dosing rate)
- Compares with standard dosing rate (from `dpr_grade_standards`)
- Flags ALERT if dosing rate deviates > 5% from standard

## MSDS Requirements
- Every chemical in inventory must have MSDS linked
- MSDS must be current (annual review)
- MSDS displayed to any user who requests
- Emergency procedures embedded in MSDS
- Storage and handling instructions from MSDS

## Hazard Classes (GHS)
| Class | Examples |
|---|---|
| 1 - Explosive | — (none typically in paper mill) |
| 2 - Flammable | Solvents, propane |
| 3 - Oxidizer | Bleach, hydrogen peroxide |
| 4 - Corrosive | Caustic soda, acids |
| 5 - Irritant | Alum, PAC, dyes |
| 6 - Health hazard | Biocides |

## Rules
1. requireStore on ALL issue/receive routes — mandatory, no exceptions
2. Expired chemicals must not be issued (validation: `expiry_date >= CURRENT_DATE`)
3. MSDS must exist before chemical is added to master
4. Batch tracking: every receipt must have batch number
5. Caustic soda / bleach: PPE check required before issue (note in remarks)
6. Hazard Class 3/4 chemicals: L3+ approval required for issue
7. Monthly reconciliation: sum of issues must match consumption + ending stock

## Common Query Patterns
```sql
-- Chemical stock with expiry status
SELECT c.chemical_name, c.current_stock, c.uom, c.expiry_date,
       c.batch_number,
       CASE
         WHEN c.expiry_date < CURRENT_DATE THEN 'Expired'
         WHEN c.expiry_date < CURRENT_DATE + 30 THEN 'Expiring Soon'
         ELSE 'OK'
       END AS expiry_status
FROM chemical_inventory c
WHERE c.is_active = true
ORDER BY c.expiry_date ASC NULLS LAST;

-- Monthly chemical consumption
SELECT c.chemical_name, SUM(ct.quantity) AS total_consumed,
       c.uom
FROM chemical_transactions ct
JOIN chemical_inventory c ON c.id = ct.chemical_id
WHERE ct.transaction_type = 'Issue'
  AND ct.date BETWEEN $1 AND $2
GROUP BY c.id, c.chemical_name, c.uom
ORDER BY total_consumed DESC;
```
