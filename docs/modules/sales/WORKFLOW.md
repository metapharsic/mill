# Sales & Dispatch Module — Full Workflow & Rules

## Overview
Customer Sales Order management and finished goods dispatch. Tracks orders from creation through
reel fulfillment, QC approval, dispatch with transport documents, and invoice generation.

## Key Files
| File | Purpose |
|---|---|
| `backend/src/routes/sales.js` | All sales endpoints (323 lines) |
| `frontend/src/pages/Sales.jsx` | Sales UI |
| DB: `sales_orders`, `customers`, `dispatch_orders`, `dispatch_items` | Core tables |

## Database Tables
| Table | Purpose |
|---|---|
| `sales_orders` | Order headers |
| `customers` | Customer master |
| `dispatch_orders` | Dispatch / delivery notes |
| `dispatch_items` | Reels dispatched per delivery |

## SO Number Format
Auto-generated: `SO-YYYYMMDD-{4-digit seq}`
Example: `SO-20260717-0001`

## Dispatch Number Format
Auto-generated: `DO-YYYYMMDD-{4-digit seq}`

## API Endpoints

### Customers
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/sales/customers` | L1+ | Active customers dropdown |
| POST | `/sales/customers` | L3+ | Add new customer |
| PUT | `/sales/customers/:id` | L3+ | Update customer |

### Sales Orders
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/sales/orders` | L1+ | List SOs (filter: status, customer_id, page, limit) |
| GET | `/sales/orders/:id` | L1+ | Single SO |
| POST | `/sales/orders` | L3+ | Create SO |
| PUT | `/sales/orders/:id` | L3+ | Update SO (status, delivery_date, remarks) |
| PUT | `/sales/orders/:id/confirm` | L3+ | Pending → Confirmed |
| PUT | `/sales/orders/:id/cancel` | L3+ | Cancel SO (if not dispatched) |

### Dispatch
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/sales/dispatch` | L1+ | Dispatch orders list |
| GET | `/sales/dispatch/:id` | L1+ | Single dispatch with items |
| POST | `/sales/dispatch` | L3+ | Create dispatch order |
| PUT | `/sales/dispatch/:id/complete` | L3+ | Complete dispatch (updates SO.fulfilled_mt) |

## Sales Order Fields
| Field | Description |
|---|---|
| `so_number` | Auto-generated SO number |
| `customer_id` | FK → customers |
| `delivery_date` | Expected delivery date |
| `grade_id` | FK → grades (paper grade) |
| `gsm` | Target GSM |
| `width_mm` | Target width in mm |
| `qty_mt` | Ordered quantity in metric tons |
| `fulfilled_mt` | How much has been dispatched |
| `rate_per_kg` | Price per kg (KG basis) |
| `total_value` | `qty_mt × 1000 × rate_per_kg` |
| `status` | Order status |

## Sales Order Status Flow
```
Pending → Confirmed → In Production → Ready → Partial → Dispatched
        ↘ Cancelled
```

| Status | Meaning |
|---|---|
| Pending | Order received, not yet confirmed |
| Confirmed | Order confirmed by sales L3+ |
| In Production | Reels linked to this SO are being made |
| Ready | All required reels QC approved, ready to dispatch |
| Partial | Some qty dispatched, more pending |
| Dispatched | Fully dispatched (fulfilled_mt >= qty_mt) |
| Cancelled | Order cancelled |

## Dispatch Order Fields
| Field | Description |
|---|---|
| `so_id` | FK → sales_orders |
| `dispatch_date` | Date of dispatch |
| `vehicle_number` | Truck registration number |
| `lr_number` | Lorry Receipt number (from transporter) |
| `transporter` | Transport company name |
| `eway_bill_number` | E-way bill (required for interstate) |
| `gross_weight` | Total weight in kg |
| `tare_weight` | Vehicle tare weight in kg |
| `net_weight` | Actual dispatched weight |

## Reel Linking to Sales Orders
- `reels.sales_order_id` can be set at reel creation time
- Or linked later when production knows which SO the reel fulfills
- Dispatch items reference `reel_id` directly

## Dispatch Rules
1. Only QC-Approved reels (`quality_status='Approved'`) can be dispatched
2. Reel `status` must be `'In Warehouse'` before dispatch
3. After dispatch: `reel.status = 'Dispatched'`
4. After dispatch: `sales_orders.fulfilled_mt += dispatched_weight/1000`
5. LR number mandatory (proof of pickup)
6. E-way bill mandatory for interstate movement (value > ₹50,000)

## Customer Fields
| Field | Description |
|---|---|
| `code` | Unique customer code |
| `name` | Customer name |
| `mobile` | Contact number |
| `email` | Contact email |
| `city` | City |
| `gst_number` | GSTIN for invoicing |
| `credit_limit` | Maximum outstanding allowed |
| `credit_days` | Payment due in N days |
| `is_active` | Soft-delete flag |

## Credit Limit Enforcement
Check: `current_outstanding + new_order_value <= credit_limit`
- Outstanding = sum of unpaid invoices for customer
- Block SO creation if credit limit would be exceeded (if implemented — check frontend validation)

## Kafka Events Published
| Event | Trigger |
|---|---|
| `sales.order.created` | POST /orders |
| `sales.order.updated` | PUT /orders/:id |
| `sales.order.confirmed` | PUT /orders/:id/confirm |
| `sales.dispatch.created` | POST /dispatch |

Topic: `TOPICS.EVENTS_ALL`

## Rules
1. L3+ to create/modify SOs (Sales Manager minimum)
2. L3+ to create dispatch orders
3. Only QC-Approved + In Warehouse reels can be dispatched
4. fulfilled_mt updated atomically with dispatch completion
5. Customers must be in customers master — no free-text customer names
6. SO can be cancelled only if `status IN ('Pending', 'Confirmed')` — not once In Production
7. Rate and total_value calculated server-side: `total_value = qty_mt × 1000 × rate_per_kg`

## Common Query Patterns
```sql
-- Open orders with production status
SELECT so.so_number, c.name AS customer, g.name AS grade,
       so.qty_mt, so.fulfilled_mt,
       so.qty_mt - so.fulfilled_mt AS pending_mt
FROM sales_orders so
LEFT JOIN customers c ON c.id = so.customer_id
LEFT JOIN grades g ON g.id = so.grade_id
WHERE so.status NOT IN ('Dispatched', 'Cancelled')
ORDER BY so.delivery_date ASC;

-- Dispatch summary for period
SELECT DATE_TRUNC('month', d.dispatch_date) AS month,
       SUM(d.net_weight)/1000 AS total_mt,
       COUNT(DISTINCT d.id) AS dispatches
FROM dispatch_orders d
WHERE d.dispatch_date BETWEEN $1 AND $2
GROUP BY 1 ORDER BY 1;
```
