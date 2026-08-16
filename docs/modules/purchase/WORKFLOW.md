# Purchase Module — Full Workflow & Rules

## Overview
Vendor management, Purchase Orders from indent-to-PO, GRN tracking, and vendor performance.
Purchase module feeds into Inventory (GRN) and Finance (payment) modules.

## Key Files
| File | Purpose |
|---|---|
| `backend/src/routes/purchase.js` | All purchase endpoints |
| `frontend/src/pages/Purchase.jsx` | Purchase UI |
| DB: `purchase_orders`, `po_items`, `vendors`, `grn` | Core tables |

## Database Tables
| Table | Purpose |
|---|---|
| `purchase_orders` | PO headers |
| `po_items` | PO line items |
| `vendors` | Vendor master |
| `grn` | Goods Receipt Notes (shared with inventory) |
| `grn_items` | GRN line items |

## PO Number Format
Auto-generated: `PO-YYYYMMDD-{4-digit seq}`
Example: `PO-20260717-0001`

## API Endpoints

### Vendors
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/purchase/vendors` | L1+ | Vendor list (active, with ratings) |
| POST | `/purchase/vendors` | L3+ | Add new vendor |
| PUT | `/purchase/vendors/:id` | L3+ | Update vendor |

### Purchase Orders
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/purchase/orders` | L1+ | List POs (filter: status, vendor_id, from, to) |
| GET | `/purchase/orders/:id` | L1+ | Single PO + items |
| POST | `/purchase/orders` | L3+ | Create PO |
| PUT | `/purchase/orders/:id` | L3+ | Update PO (items, terms, delivery date) |
| PUT | `/purchase/orders/:id/approve` | L4+ | Draft → Approved |
| PUT | `/purchase/orders/:id/send` | L3+ | Approved → Sent (to vendor) |
| PUT | `/purchase/orders/:id/close` | L3+ | Close PO after full receipt + payment |
| PUT | `/purchase/orders/:id/cancel` | L4+ | Cancel PO |

### GRN (shared with inventory)
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/purchase/grn` | L1+ | List GRNs for purchase tracking |
| POST | `/purchase/grn` | L2+ | Create GRN (receipt against PO) |

## Purchase Order Status Flow
```
Draft → Approved → Sent → Partial → Received → Closed
     ↘ Cancelled (L4+ only)
```

| Status | Meaning |
|---|---|
| Draft | PO created, not yet approved |
| Approved | L4+ approved, ready to send |
| Sent | PO sent to vendor (PDF/email) |
| Partial | Some items received, balance pending |
| Received | All items received (GRN created) |
| Closed | Payment confirmed, PO closed |
| Cancelled | Cancelled by L4+ |

## PO Fields
| Field | Description |
|---|---|
| `po_number` | Auto-generated PO number |
| `vendor_id` | FK → vendors |
| `indent_id` | FK → indents (if originated from indent) |
| `delivery_date` | Expected delivery date |
| `payment_terms` | Payment terms (30 days, advance, etc.) |
| `total_value` | SUM(po_items.total) + tax |
| `tax_pct` | GST percentage |
| `status` | PO status |

## PO Item Fields
| Field | Description |
|---|---|
| `material_id` | FK → materials |
| `description` | Item description |
| `uom` | Unit of measure |
| `quantity` | Ordered quantity |
| `received_qty` | How much received so far |
| `unit_price` | Price per unit |
| `total` | `quantity × unit_price` |

## Vendor Fields
| Field | Description |
|---|---|
| `name` | Vendor company name |
| `code` | Unique vendor code |
| `gst_number` | GSTIN |
| `pan` | PAN number |
| `mobile` | Contact number |
| `email` | Email |
| `address` | Address |
| `city` | City |
| `bank_account` | Bank account for payment |
| `ifsc` | IFSC code |
| `rating` | Vendor performance rating (auto-updated) |
| `is_active` | Soft-delete flag |

## Indent-to-PO Flow
1. Indent reaches `Approved` status
2. Purchase team creates PO linking `indent_id = indent.id`
3. PO items mapped from `indent_items`
4. L4+ approves PO
5. PO sent to vendor
6. Vendor delivers: GRN created (receipt)
7. GRN approved: stock updated in inventory
8. Finance records payment → PO closed

## Vendor Performance Rating
Updated after each PO completes:
- On-time delivery: +score
- Quality pass rate: +score
- Invoice accuracy: +score
- Composite rating: 1-5 stars
- Monthly average updated in `vendors.rating`

## Rules
1. Always select vendor from `vendors` master — no free-text vendor names
2. PO must be approved by L4+ before sending to vendor
3. PO total = SUM(po_items.total) × (1 + tax_pct/100)
4. Partial receipts: update `po_items.received_qty` on each GRN
5. Close PO only when ALL items received AND Finance confirms payment
6. Cancel PO: L4+ only, only if status IN ('Draft', 'Approved', 'Sent')
7. Vendor deactivation: `is_active=false` — do not delete vendors with PO history

## Common Query Patterns
```sql
-- Open POs by vendor
SELECT po.po_number, v.name AS vendor, po.delivery_date,
       po.total_value, po.status
FROM purchase_orders po
LEFT JOIN vendors v ON v.id = po.vendor_id
WHERE po.status NOT IN ('Received', 'Closed', 'Cancelled')
ORDER BY po.delivery_date ASC;

-- Vendor performance this month
SELECT v.name, COUNT(po.id) AS pos,
       SUM(po.total_value) AS total_value,
       AVG(v.rating) AS avg_rating
FROM purchase_orders po
JOIN vendors v ON v.id = po.vendor_id
WHERE po.created_at >= DATE_TRUNC('month', CURRENT_DATE)
GROUP BY v.id, v.name ORDER BY total_value DESC;
```
