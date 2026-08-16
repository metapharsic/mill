# Phase 5 — Procurement Module (Indent + Purchase Orders)

## Scope
Indent creation, multi-level approval, PO generation, PO approval, GRN linkage.

## DB Tables
- `indents` — header
- `indent_items` — line items
- `purchase_orders` — PO header
- `po_items` — PO line items

## Approval Flow
```
Draft → Submitted → L1 Approved → L2 Approved → L3 Approved → PO Created
                  ↘            ↘              ↘ Rejected (any level)
```
- L1: role_level ≥ 2 (Supervisor)
- L2: role_level ≥ 3 (Manager)
- L3: role_level ≥ 4 (PlantHead)

---

## 1. INDENT

### Indent List
**API:** GET `/api/indent?dept=&status=&priority=&date=`

| Column | DB Source | Filter |
|--------|-----------|--------|
| Indent No | indents.indent_number | search |
| Date | indents.date | range |
| Department | departments.name | dropdown |
| Items | COUNT(indent_items) | — |
| Priority | indents.priority | dropdown |
| Required Date | indents.required_date | — |
| Status | indents.status | dropdown |
| Raised By | users.name | — |

### Indent Status Options
`Draft` / `Submitted` / `L1 Approved` / `L2 Approved` / `L3 Approved` / `Rejected` / `PO Created` / `Closed`

### Create Indent Form → `indents` + `indent_items`

**Header Fields → `indents` table**
| UI Label | Input | DB Column | Validation |
|----------|-------|-----------|------------|
| Indent No | text (auto) | indent_number | server-gen `IND-YYYYMMDD-NNNN` |
| Date | date | date | today, read-only |
| Department | dropdown | department_id → departments.id | required |
| Required By Date | date | required_date | > today |
| Priority | dropdown | priority | Low / Normal / High / Urgent |
| Purpose | text | purpose | required |
| Remarks | textarea | remarks | optional |

**Line Items (dynamic) → `indent_items` table**
| UI Label | Input | DB Column | Validation |
|----------|-------|-----------|------------|
| Material | dropdown | material_id → materials.id | required |
| Current Stock | number (auto-fill) | — | read-only, from materials |
| Reorder Level | number (auto-fill) | — | read-only |
| Required Qty | number | required_qty | > 0 |
| UOM | text (auto) | uom | from material |
| Preferred Vendor | dropdown (opt) | preferred_vendor_id → vendors.id | optional |
| Last Price (₹) | number (auto-fill) | — | read-only, from materials |
| Est. Cost (₹) | number (auto) | estimated_cost | = qty × last_price |
| Specification | text | specification | optional |

**Dropdowns:**
- Material: GET `/api/master/materials?is_active=true` — on select, auto-fill current_stock, uom, last_price
- Vendor: GET `/api/master/vendors?material_id=X` — filtered by vendor_categories

### Indent Buttons
| Button | API | Auth | Condition |
|--------|-----|------|-----------|
| Save Draft | POST `/api/indent` | any | new |
| Submit | PUT `/api/indent/:id/submit` | raiser | status=Draft |
| Approve L1 | PUT `/api/indent/:id/approve/l1` | role ≥ 2 | status=Submitted |
| Approve L2 | PUT `/api/indent/:id/approve/l2` | role ≥ 3 | status=L1 Approved |
| Approve L3 | PUT `/api/indent/:id/approve/l3` | role ≥ 4 | status=L2 Approved |
| Reject | PUT `/api/indent/:id/reject` | approver | any approval stage |
| Create PO | redirect to PO form | role ≥ 3 | status=L3 Approved |
| Print Indent | client PDF | — | any |

**On Reject:** Set `status='Rejected'`, save `rejection_reason` in `indents.remarks`.

---

## 2. PURCHASE ORDER

### PO List
**API:** GET `/api/purchase/po?vendor_id=&status=&date=`

| Column | DB Source | Filter |
|--------|-----------|--------|
| PO Number | purchase_orders.po_number | search |
| Date | purchase_orders.date | range |
| Vendor | vendors.name | dropdown |
| Indent Ref | indents.indent_number | search |
| Items | COUNT(po_items) | — |
| Total Value (₹) | purchase_orders.total_amount | range |
| Status | purchase_orders.status | dropdown |
| Created By | users.name | — |

### PO Status Options
`Draft` / `Pending Approval` / `Approved` / `Partially Received` / `Received` / `Cancelled`

### Create PO Form → `purchase_orders` + `po_items`

**Header Fields → `purchase_orders` table**
| UI Label | Input | DB Column | Validation |
|----------|-------|-----------|------------|
| PO Number | text (auto) | po_number | server-gen `PO-YYYYMMDD-NNNN` |
| Date | date | date | today |
| Vendor | dropdown | vendor_id → vendors.id | required |
| Indent Reference | dropdown | indent_id → indents.id | optional, filtered L3 Approved |
| Delivery Date | date | delivery_date | > today |
| Payment Terms | dropdown | payment_terms | auto-fill from vendor |
| Billing Address | text | billing_address | company address |
| Delivery Address | text | delivery_address | plant address |
| Notes | textarea | notes | optional |

**Line Items (dynamic) → `po_items` table**
| UI Label | Input | DB Column | Validation |
|----------|-------|-----------|------------|
| Material | dropdown | material_id → materials.id | required |
| Indent Qty | number (auto-fill) | — | from indent_items |
| Order Qty | number | qty | > 0 |
| UOM | text (auto) | uom | from material |
| Unit Price (₹) | number | unit_price | > 0 |
| GST % | number | gst_rate | from material |
| Discount % | number | discount_pct | 0–100 |
| Amount (₹) | number (auto) | amount | = qty × price × (1-disc/100) |
| GST Amount (₹) | number (auto) | gst_amount | = amount × gst_rate/100 |
| Total (₹) | number (auto) | total | = amount + gst_amount |
| Delivery Date | date | delivery_date | optional per line |
| Specification | text | specification | optional |

**Totals row (auto-computed, display-only):**
- Sub-total, Total GST (CGST/SGST/IGST split), Grand Total

**PO Buttons**
| Button | API | Auth | Condition |
|--------|-----|------|-----------|
| Save Draft | POST `/api/purchase/po` | role ≥ 2 | new |
| Send for Approval | PUT `/api/purchase/po/:id/submit` | role ≥ 2 | status=Draft |
| Approve PO | PUT `/api/purchase/po/:id/approve` | role ≥ 3 | status=Pending Approval |
| Reject PO | PUT `/api/purchase/po/:id/reject` | role ≥ 3 | status=Pending Approval |
| Create GRN (receive) | redirect GRN form pre-filled | role ≥ 2 | status=Approved |
| Cancel PO | PUT `/api/purchase/po/:id/cancel` | role ≥ 4 | not yet received |
| Print PO | client PDF | — | any |
| Email to Vendor | POST `/api/purchase/po/:id/email` | role ≥ 3 | status=Approved |

**On Approve (ACID tx):**
1. `UPDATE purchase_orders SET status='Approved', approved_by=req.user.id, approved_at=NOW()`
2. `INSERT INTO audit_log (module='Purchase', action='PO_APPROVED', ...)`

**PO Closure (auto, triggered on GRN approve):**
```sql
-- Check if all items received
SELECT COUNT(*) FROM po_items
WHERE po_id=$1 AND received_qty < qty
-- If 0 rows → UPDATE purchase_orders SET status='Received'
```

---

## 3. PROCUREMENT DASHBOARD

**API:** GET `/api/purchase/dashboard`

### KPI Cards
| Widget | DB Source |
|--------|-----------|
| Pending Indents | COUNT(indents) WHERE status IN (Submitted, L1 Approved, L2 Approved) |
| Pending PO Approval | COUNT(purchase_orders) WHERE status=Pending Approval |
| Open POs (Value) | SUM(total_amount) WHERE status IN (Approved, Partially Received) |
| Overdue POs | COUNT WHERE delivery_date < today AND status ≠ Received |
| Month PO Value | SUM WHERE date ≥ month_start |
| Pending GRNs | COUNT(grn) WHERE status IN (Received, QC Pending) |

### Vendor Performance Table
**API:** GET `/api/purchase/vendor-performance`
Columns: Vendor, Total POs, On-Time %, Rejection %, Avg Lead Time (days)
