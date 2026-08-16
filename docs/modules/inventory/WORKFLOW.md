# Inventory / GRN Module — Full Workflow & Rules

## Overview
Material master management, Goods Receipt Notes (GRN), stock ledger, and inventory valuation.
GRN is the primary inward movement trigger. All stock movements go through stock_ledger.

## Key Files
| File | Purpose |
|---|---|
| `backend/src/routes/inventory.js` | All inventory/GRN endpoints (556 lines) |
| `frontend/src/pages/Inventory.jsx` | Inventory UI |

## Database Tables
| Table | Purpose |
|---|---|
| `materials` | Material master (items, spares, chemicals) |
| `material_categories` | Categories (code, name, type) |
| `grn` | Goods Receipt Note headers |
| `grn_items` | Line items per GRN |
| `stock_ledger` | All stock movements |
| `installed_assets` | Serialized items in service |

## API Endpoints

### Categories
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/inventory/categories` | L1+ | All material categories |

### Materials (Item Master)
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/inventory/materials` | L1+ | List materials (filter: categoryId, search) — paginated |
| GET | `/inventory/materials/:id` | L1+ | Single material with stock detail |
| POST | `/inventory/materials` | L3+ | Create new material |
| PUT | `/inventory/materials/:id` | L3+ | Update material (name, price, levels) |
| DELETE | `/inventory/materials/:id` | L4+ | Soft-delete: `is_active=false` |

### GRN
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/inventory/grn` | L1+ | List GRNs (filter: status, vendor_id, from, to) |
| GET | `/inventory/grn/:id` | L1+ | Single GRN + items |
| POST | `/inventory/grn` | L2+ | Create GRN (status=Pending, links to PO) |
| PUT | `/inventory/grn/:id/approve` | L3+ | Approve GRN → updates stock (ACID) |
| PUT | `/inventory/grn/:id/reject` | L3+ | Reject GRN |

### Stock Ledger
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/inventory/ledger` | L1+ | Stock ledger (filter: material_id, from, to, type) |
| GET | `/inventory/valuation` | L3+ | Stock valuation report (current_stock × unit_price) |

### Adjustments
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/inventory/adjustment` | requireStore + L3+ | Manual stock adjustment with reason |

## GRN Number Format
Auto-generated: `GRN-YYYYMMDD-{4-digit seq}` using `buildSequenceNumber()` helper.

## GRN Flow (ACID on approval)
```
POST /grn → grn.status = 'Pending'
  (contains: vendor_id, po_id, receive_date, invoice_number, items[])

PUT /grn/:id/approve (L3+):
  BEGIN
    FOR each grn_item:
      accepted_qty = item.accepted_qty (after QC inspection)
      rejected_qty = item.quantity - accepted_qty
      materials.current_stock += accepted_qty
      INSERT stock_ledger (type='GRN', reference_type='GRN', in_qty=accepted_qty)
    grn.status = 'Approved'
    If QC required: quality_status triggers quality_tests creation
  COMMIT
```

## GRN Item Fields
| Field | Description |
|---|---|
| `material_id` | FK → materials |
| `po_item_id` | FK → po_items (links to purchase order line) |
| `quantity` | Received quantity |
| `accepted_qty` | QC-accepted quantity |
| `rejected_qty` | QC-rejected quantity |
| `unit_price` | Price per unit at receipt |
| `bin_location` | Where stored (e.g., "A1-R2-S3") |
| `batch_number` | Batch/lot number |
| `expiry_date` | For chemicals/consumables |
| `qc_required` | Whether QC test needed before acceptance |
| `qc_status` | Pending / Pass / Fail |

## Material Categories (from material_categories.code)
| Code | Type | Examples |
|---|---|---|
| CHEM | Chemical | Alum, Starch, PAC, Dyes |
| SPARE | Spare Part | Bearings, belts, seals |
| CONS | Consumable | Lubricants, filters, rags |
| RAW | Raw Material | Pulp, waste paper |
| PACK | Packaging | Wrapping paper, straps |
| FUEL | Fuel | Coal, rice husk |
| ELEC | Electrical | Cables, switches |
| INS | Instrument | Sensors, gauges |

## Material Fields
| Field | Description |
|---|---|
| `code` | Unique item code |
| `name` | Item description |
| `category_id` | FK → material_categories |
| `uom` | Unit of measure (KG, NOS, LTR, MTR, etc.) |
| `current_stock` | Running stock balance (cache) |
| `min_stock` | Minimum stock level (alert if below) |
| `max_stock` | Maximum stock level (advisory) |
| `reorder_level` | Trigger reorder when stock hits this |
| `unit_price` | Standard cost per unit |
| `is_active` | Soft-delete flag |
| `is_serialized` | If true: track as installed asset |
| `expected_lifespan_days` | For serialized: expected service life |

## High-Value Transaction Alerts
From `notifyHighTxn()` function in inventory.js:
- Triggered when: `value > ₹1,00,000` OR `qty > 50% of current_stock`
- Notifies: STORE dept L3+ + org-wide L4+
- Kafka event published to `TOPICS.EVENTS_CRIT`

## Shift Auto-Derivation
```javascript
const deriveShift = (explicit) => {
  if (explicit === 'Day' || explicit === 'Night') return explicit;
  const hr = new Date().getHours();
  return (hr >= 6 && hr < 18) ? 'Day' : 'Night';
};
```
All stock ledger entries are tagged with shift type.

## Rules
1. NEVER directly manipulate `materials.current_stock` — always via GRN approval or stock_ledger entry
2. All inward stock updates: in SAME transaction as stock_ledger INSERT
3. Soft-delete only: `is_active=false` (L4+ required)
4. Material codes must be unique — enforce at DB level (UNIQUE constraint)
5. GRN must reference a PO (po_id) for purchase-triggered receipts
6. Free-receive (without PO) allowed but requires L3+ approval
7. bin_location must be set on GRN items for proper warehouse tracking

## Stock Valuation
```sql
SELECT m.name, m.current_stock, m.unit_price,
       m.current_stock * m.unit_price AS stock_value
FROM materials m
WHERE m.is_active = true AND m.current_stock > 0
ORDER BY stock_value DESC;
```

## Common Query Patterns
```sql
-- Low stock alerts
SELECT name, code, current_stock, min_stock, uom
FROM materials
WHERE is_active = true AND current_stock <= min_stock
ORDER BY (current_stock / NULLIF(min_stock,0)) ASC;

-- GRN pending QC
SELECT g.grn_number, v.name AS vendor, g.receive_date, g.invoice_number
FROM grn g
LEFT JOIN vendors v ON v.id = g.vendor_id
WHERE g.status = 'Pending'
ORDER BY g.receive_date ASC;

-- Material movement for period
SELECT date, transaction_type, in_qty, out_qty, balance, remarks
FROM stock_ledger
WHERE material_id = $1 AND date BETWEEN $2 AND $3
ORDER BY id ASC;
```
