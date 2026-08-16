# Phase 8 — Sales & Dispatch Module

## Scope
Sales order creation, dispatch planning, reel picking (QC-approved only), dispatch execution, invoice generation.

## DB Tables
- `sales_orders` — SO header
- `dispatch_orders` — DO header
- `dispatch_items` — reels per dispatch
- `customers` — master (read-only here)

## Dispatch Gate (NON-NEGOTIABLE)
Only reels with `status='In Warehouse' AND quality_status='Approved'` can be dispatched.
Server-side enforcement — no bypass.

---

## 1. SALES ORDERS

### SO List
**API:** GET `/api/sales/orders?customer_id=&status=&date=`

| Column | DB Source | Filter |
|--------|-----------|--------|
| SO Number | sales_orders.so_number | search |
| Date | sales_orders.date | range |
| Customer | customers.name | dropdown |
| Grade | grades.name | dropdown |
| GSM | sales_orders.gsm | — |
| Qty (MT) | sales_orders.qty_mt | — |
| Rate (₹/kg) | sales_orders.rate_per_kg | — |
| Value (₹) | computed qty_mt×1000×rate_per_kg | — |
| Fulfilled (MT) | sales_orders.fulfilled_mt | — |
| Balance (MT) | qty_mt - fulfilled_mt | — |
| Delivery Date | sales_orders.delivery_date | range |
| Status | sales_orders.status | dropdown |

### SO Status Options
`Pending` / `Confirmed` / `In Production` / `Partially Dispatched` / `Dispatched` / `Cancelled`

### Create SO Form → `sales_orders` table
| UI Label | Input | DB Column | Validation |
|----------|-------|-----------|------------|
| SO Number | text (auto) | so_number | server-gen `SO-YYYYMMDD-NNNN` |
| Date | date | date | today |
| Customer | dropdown | customer_id → customers.id | required |
| Delivery Date | date | delivery_date | > today |
| Grade | dropdown | grade_id → grades.id | required |
| GSM | number | gsm | optional specification |
| Width (mm) | number | width_mm | optional |
| Qty (MT) | number | qty_mt | > 0 |
| Rate (₹/kg) | number | rate_per_kg | > 0 |
| Discount % | number | discount_pct | 0–100 |
| GST % | number | gst_rate | 0/5/12/18/28 |
| GST Type | radio (auto) | gst_type | CGST+SGST / IGST (based on state) |
| Payment Terms | dropdown | payment_terms | auto-fill from customer |
| Remarks | textarea | remarks | optional |

**Auto-computation (show live):**
- Subtotal = qty_mt × 1000 × rate_per_kg
- Discount = subtotal × discount_pct/100
- Taxable = subtotal - discount
- CGST/SGST or IGST = taxable × gst_rate/100
- Grand Total = taxable + GST

**Dropdowns:**
- Customer: GET `/api/master/customers?is_active=true` — on select, auto-fill payment_terms, state (for GST type)
- Grade: GET `/api/production/grades?is_active=true`

### SO Buttons
| Button | API | Auth | Condition |
|--------|-----|------|-----------|
| Save SO | POST `/api/sales/orders` | role ≥ 2 | new |
| Confirm | PUT `/api/sales/orders/:id/confirm` | role ≥ 3 | status=Pending |
| Cancel | PUT `/api/sales/orders/:id/cancel` | role ≥ 3 | status=Pending or Confirmed |
| Create Dispatch | redirect to Dispatch form | role ≥ 2 | status=Confirmed or Partially Dispatched |
| Print SO | client PDF | — | any |
| Email to Customer | POST `/api/sales/orders/:id/email` | role ≥ 2 | status=Confirmed |

---

## 2. DISPATCH

### Dispatch List
**API:** GET `/api/dispatch?status=&date=`

| Column | DB Source | Filter |
|--------|-----------|--------|
| DO Number | dispatch_orders.do_number | search |
| Date | dispatch_orders.date | range |
| SO Reference | sales_orders.so_number | — |
| Customer | customers.name | dropdown |
| Vehicle No | dispatch_orders.vehicle_number | search |
| Reels | COUNT(dispatch_items) | — |
| Weight (MT) | SUM(reels.weight_kg)/1000 | — |
| Status | dispatch_orders.status | dropdown |
| Driver | dispatch_orders.driver_name | — |

### Dispatch Status Options
`Draft` / `Loading` / `Loaded` / `Dispatched` / `Delivered` / `Cancelled`

### Create Dispatch Form → `dispatch_orders` + `dispatch_items`

**Header → `dispatch_orders` table**
| UI Label | Input | DB Column | Validation |
|----------|-------|-----------|------------|
| DO Number | text (auto) | do_number | server-gen `DO-YYYYMMDD-NNNN` |
| Date | date | date | today |
| SO Reference | dropdown | so_id → sales_orders.id | required, status≠Cancelled |
| Customer | auto-fill | customer_id | from SO |
| Delivery Address | textarea | delivery_address | auto-fill from customer |
| Vehicle Number | text | vehicle_number | required |
| Driver Name | text | driver_name | required |
| Driver Phone | tel | driver_phone | 10 digits |
| Transporter | text | transporter_name | optional |
| E-Way Bill No | text | eway_bill_number | optional |
| Remarks | textarea | remarks | optional |

**Reel Picker (cross-module — reads `reels` table)**

Filter panel:
| Filter | Source |
|--------|--------|
| Grade | from SO grade_id (auto-filter) |
| GSM Range | from SO gsm (±10 tolerance) |
| Available Stock | reels WHERE status='In Warehouse' AND quality_status='Approved' AND not already in another DO |

Reel Table (multi-select checkboxes):
| Column | DB Source |
|--------|-----------|
| ☐ | checkbox |
| Reel Number | reels.reel_number |
| Machine | machines.name |
| Grade | grades.name |
| GSM | reels.gsm |
| Width (mm) | reels.width_mm |
| Weight (kg) | reels.weight_kg |
| QC Status | reels.quality_status (always Approved here) |
| Date Made | DATE(reels.start_time) |

**Selected Reels Summary:** Total Reels: N, Total Weight: X MT, Value: ₹Y

### Dispatch Items → `dispatch_items` table (generated from selected reels)
| DB Column | Source |
|-----------|--------|
| dispatch_order_id | DO header |
| reel_id | selected reel |
| weight_kg | reels.weight_kg |
| rate_per_kg | SO rate_per_kg |
| amount | weight_kg × rate_per_kg |

### Dispatch Buttons
| Button | API | Auth | Condition |
|--------|-----|------|-----------|
| Save Draft | POST `/api/dispatch` | role ≥ 2 | new |
| Start Loading | PUT `/api/dispatch/:id/loading` | role ≥ 2 | status=Draft |
| Confirm Loaded | PUT `/api/dispatch/:id/loaded` | role ≥ 2 | status=Loading |
| Dispatch | PUT `/api/dispatch/:id/dispatch` | role ≥ 3 | status=Loaded |
| Mark Delivered | PUT `/api/dispatch/:id/delivered` | role ≥ 2 | status=Dispatched |
| Generate Invoice | POST `/api/sales/invoice` | role ≥ 3 | status=Dispatched |
| Print DO | client PDF | — | any |
| Print Invoice | client PDF after generate | — | after invoice created |

**On Dispatch (ACID tx):**
```sql
UPDATE dispatch_orders SET status='Dispatched', dispatched_at=NOW() WHERE id=$1;
UPDATE reels SET status='Dispatched' WHERE id IN (SELECT reel_id FROM dispatch_items WHERE dispatch_order_id=$1);
UPDATE sales_orders SET fulfilled_mt = fulfilled_mt + (dispatched_weight_kg/1000);
-- If fulfilled_mt >= qty_mt → status='Dispatched'
-- Else → status='Partially Dispatched'
INSERT INTO audit_log (module='Dispatch', action='DO_DISPATCHED', ...);
```

---

## 3. INVOICE GENERATION

**API:** POST `/api/sales/invoice` with `{dispatch_order_id}`

**GST Computation (server-side):**
```js
const sameState = company.state === customer.state;
const taxable = total_amount * (1 - discount_pct/100);
if (sameState) {
  cgst = taxable * gst_rate / 200;
  sgst = taxable * gst_rate / 200;
  igst = 0;
} else {
  igst = taxable * gst_rate / 100;
  cgst = sgst = 0;
}
const grand_total = taxable + cgst + sgst + igst;
```

Invoice fields: Invoice No (INV-YYYYMMDD-NNNN), DO reference, SO reference, customer details, reel-wise table, GST breakup, grand total, terms.

---

## 4. SALES DASHBOARD

**API:** GET `/api/sales/dashboard`

### KPI Cards
| Widget | DB Source |
|--------|-----------|
| Open Orders (MT) | SUM(qty_mt-fulfilled_mt) WHERE status IN (Pending, Confirmed, In Production, Partially Dispatched) |
| Dispatches Today | COUNT(dispatch_orders) WHERE date=today AND status=Dispatched |
| Revenue This Month | SUM(dispatch_items.amount) WHERE date ≥ month_start |
| Reels Available | COUNT(reels) WHERE status=In Warehouse, quality_status=Approved |
| Overdue Orders | COUNT WHERE delivery_date < today AND status ≠ Dispatched |
| Pending Invoices | COUNT DO WHERE status=Dispatched, invoice_id IS NULL |

### Customer-wise Order Summary
Columns: Customer, Open Orders (MT), Dispatched (month), Value (₹), Overdue?
