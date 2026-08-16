# Phase 4 — Inventory Module

## Scope
GRN entry, stock ledger, material issue, stock balance, reorder alerts, bin management.

## DB Tables
- `materials` — master with `current_stock` cache
- `material_categories` — groups
- `stock_ledger` — every stock movement (double-entry style)
- `grn` — goods receipt note header
- `grn_items` — line items per GRN

## Stock Movement Rule
Every movement = one `stock_ledger` row. Cache `materials.current_stock` updates in same ACID tx.

---

## 1. GRN (Goods Receipt Note)

### GRN List
**API:** GET `/api/inventory/grn?date=&vendor_id=&status=`

| Column | DB Source | Filter |
|--------|-----------|--------|
| GRN Number | grn.grn_number | search |
| Date | grn.date | date range |
| Vendor | vendors.name | dropdown |
| PO Ref | purchase_orders.po_number | — |
| Items | COUNT(grn_items) | — |
| Status | grn.status | dropdown |
| Received By | users.name | — |

### GRN Status Options
`Draft` → `Received` → `QC Pending` → `Approved` → `Rejected`

### GRN Header Form → `grn` table
| UI Label | Input | DB Column | Validation |
|----------|-------|-----------|------------|
| GRN Number | text (auto) | grn_number | server-gen: `GRN-YYYYMMDD-NNNN` |
| Date | date | date | required, ≤ today |
| Vendor | dropdown | vendor_id → vendors.id | required |
| PO Reference | dropdown (opt) | po_id → purchase_orders.id | nullable, filtered by vendor |
| Vehicle Number | text | vehicle_number | optional |
| Challan Number | text | challan_number | optional |
| Invoice Number | text | invoice_number | optional |
| Invoice Date | date | invoice_date | optional |
| Invoice Amount (₹) | number | invoice_amount | optional |

**Dropdown Sources:**
- Vendor: GET `/api/master/vendors?is_active=true`
- PO Reference: GET `/api/purchase/po?vendor_id=X&status=Approved` (filtered after vendor selected)

### GRN Line Items Form → `grn_items` table (dynamic rows — add/remove)
| UI Label | Input | DB Column | Validation |
|----------|-------|-----------|------------|
| Material | dropdown | material_id → materials.id | required |
| PO Qty | number (auto-fill if PO linked) | po_qty | from po_items |
| Received Qty | number | received_qty | required, > 0 |
| Accepted Qty | number | accepted_qty | ≤ received_qty |
| Rejected Qty | number (auto) | rejected_qty | = received - accepted |
| Unit Price (₹) | number | unit_price | ≥ 0 |
| Batch Number | text | batch_number | optional |
| Mfg Date | date | mfg_date | optional |
| Expiry Date | date | expiry_date | > mfg_date if both set |
| Bin Location | text | bin_location | optional |
| Remarks | text | remarks | optional |

**Add Line Item button** → appends new row (client-side, no API call)
**Remove Line** → removes row (client-side)

### GRN Buttons
| Button | Action | API | Condition |
|--------|--------|-----|-----------|
| Save Draft | saves without approving | POST `/api/inventory/grn` | always |
| Submit for QC | status → QC Pending | PUT `/api/inventory/grn/:id/submit` | status=Draft |
| Approve GRN | status → Approved + stock_ledger IN | PUT `/api/inventory/grn/:id/approve` | role_level ≥ 2 |
| Reject GRN | status → Rejected | PUT `/api/inventory/grn/:id/reject` | role_level ≥ 2 |
| Print GRN | client-side PDF | — | always |

**On Approve (ACID tx):**
1. `UPDATE grn SET status='Approved'`
2. For each grn_item: `INSERT INTO stock_ledger (material_id, date, transaction_type='GRN', in_qty=accepted_qty, reference_id=grn.id, ...)`
3. `UPDATE materials SET current_stock = current_stock + accepted_qty WHERE id = material_id`
4. `INSERT INTO audit_log (...)`

---

## 2. STOCK LEDGER

### Ledger List View
**API:** GET `/api/inventory/ledger?material_id=&date_from=&date_to=&type=`

| Column | DB Source |
|--------|-----------|
| Date | stock_ledger.date |
| Material | materials.name |
| Transaction Type | stock_ledger.transaction_type |
| IN Qty | stock_ledger.in_qty |
| OUT Qty | stock_ledger.out_qty |
| Balance | stock_ledger.balance |
| Reference | stock_ledger.reference_number |
| Created By | users.name |

**Transaction Type Filter:** GRN / Issue / Return / Adjustment / Opening

**Filters:**
- Material: GET `/api/master/materials` (dropdown)
- Date range: date pickers
- Type: static dropdown

### No edit/delete on stock_ledger. Add Adjustment only:

### Adjustment Form → `stock_ledger` table
| UI Label | Input | DB Column | Validation |
|----------|-------|-----------|------------|
| Material | dropdown | material_id | required |
| Date | date | date | ≤ today |
| Adjustment Type | dropdown | — | Add / Deduct |
| Quantity | number | in_qty or out_qty | > 0 |
| Reason | textarea | reason | required |
| Approved By | dropdown | approved_by → users.id | role_level ≥ 3 |

**Button: Save Adjustment** → POST `/api/inventory/adjustment`
Sets `transaction_type='Adjustment'`, updates `materials.current_stock`

---

## 3. MATERIAL ISSUE

### Issue Form → `stock_ledger` table (type=Issue)
| UI Label | Input | DB Column | Validation |
|----------|-------|-----------|------------|
| Issue Number | text (auto) | reference_number | auto-gen ISS-YYYYMMDD-NNNN |
| Date | date | date | ≤ today |
| Department | dropdown | issued_to_dept → departments.id | required |
| Indent Reference | dropdown (opt) | indent_id | nullable |
| Material | dropdown | material_id | required, is_active=true |
| Quantity | number | out_qty | > 0, ≤ current_stock |
| UOM | text (auto) | — | from material |
| Purpose | text | purpose | required |
| Issued By | auto (req.user) | created_by | — |

**Stock validation:** Show current_stock live as user selects material. Error if qty > current_stock.

**Button: Issue Material** → POST `/api/inventory/issue`
ACID tx: insert stock_ledger + decrement materials.current_stock

---

## 4. STOCK DASHBOARD

**API:** GET `/api/inventory/dashboard`

### KPI Cards
| Widget | DB Source |
|--------|-----------|
| Total Materials | COUNT(materials) WHERE is_active=true |
| Total Stock Value (₹) | SUM(current_stock × last_price) |
| Below Reorder | COUNT WHERE current_stock ≤ reorder_level |
| Zero Stock | COUNT WHERE current_stock = 0 |
| GRN This Month | COUNT(grn) WHERE date ≥ month_start |
| Issues This Month | COUNT(stock_ledger) WHERE type=Issue, date ≥ month_start |

### Reorder Alert Table
**API:** GET `/api/inventory/reorder-alerts`
**DB:** `SELECT m.*, m.current_stock, m.reorder_level, m.min_order_qty FROM materials m WHERE m.current_stock <= m.reorder_level AND m.is_active = true ORDER BY (m.current_stock / NULLIF(m.reorder_level,0)) ASC`

| Column | Notes |
|--------|-------|
| Material | name + code |
| Current Stock | red if 0, orange if ≤ reorder |
| Reorder Level | — |
| Min Order Qty | — |
| Last Purchase Price | — |
| Quick Action | "Raise Indent" button → pre-fills indent form |

### Category-wise Stock Chart
Data: SUM(current_stock × last_price) GROUP BY material_categories.name
Display: Donut chart

### Stock Movement Chart (last 30 days)
Data: SUM(in_qty), SUM(out_qty) per day
Display: Dual-line chart
