# Phase 12 — Finance

Route: `/api/finance` → `backend/src/routes/finance.js`
Auth pattern: `{ auth, requireLevel }` from `../middleware/auth` (legacy — not helpers.js).

All routes: `requireLevel(3)` — Manager, PlantHead, Admin only.
No dedicated finance tables — all derived from existing tables.

---

## Source Tables

### sales_orders
```
id           SERIAL PRIMARY KEY
so_number    VARCHAR(30) UNIQUE NOT NULL
date         DATE NOT NULL
customer_id  INTEGER FK → customers.id
grade_id     INTEGER FK → grades.id
qty_mt       NUMERIC(10,3) NOT NULL
fulfilled_mt NUMERIC(10,3) DEFAULT 0
rate_per_kg  NUMERIC(8,2)
total_value  NUMERIC(14,2)       -- rate_per_kg × qty_mt × 1000, usually
status       VARCHAR(20) CHECK IN ('Pending','In Production','Ready','Partial','Dispatched','Cancelled')
```

### purchase_orders
```
id          SERIAL PRIMARY KEY
po_number   VARCHAR(30) UNIQUE NOT NULL
date        DATE NOT NULL
vendor_id   INTEGER FK → vendors.id
grand_total NUMERIC(14,2)
status      VARCHAR(20) CHECK IN ('Draft','Approved','Sent','Partial','Received','Closed','Cancelled')
```

### materials
```
current_stock  NUMERIC(12,3)
unit_price     NUMERIC(12,2)   -- last purchase price
category_id    INTEGER FK → material_categories.id
is_active      BOOLEAN
```

### customers
```
credit_limit  NUMERIC(14,2)
credit_days   INTEGER
is_active     BOOLEAN
```

### vendors
```
credit_days  INTEGER
is_active    BOOLEAN
```

---

## 1. ACCOUNTS RECEIVABLE (AR)

`GET /api/finance/ar`
Lookback: 1 year from NOW().

```sql
SELECT c.id, c.code, c.name,
       c.credit_limit AS "creditLimit",
       c.credit_days AS "creditDays",
       COUNT(so.id) AS total_orders,
       COALESCE(SUM(so.total_value),0) AS total_billed,
       COALESCE(SUM(
         CASE WHEN so.status NOT IN ('Dispatched','Cancelled')
         THEN so.total_value ELSE 0 END
       ),0) AS outstanding
FROM customers c
LEFT JOIN sales_orders so ON so.customer_id=c.id
  AND so.date >= NOW()-INTERVAL '1 year'
WHERE c.is_active=true
GROUP BY c.id, c.code, c.name, c.credit_limit, c.credit_days
ORDER BY outstanding DESC
```

**outstanding** = orders where status NOT IN (`Dispatched`,`Cancelled`).
`Dispatched` = delivered → considered settled. Not payment-based.

Server-side:
```js
const totalOutstanding = rows.reduce((s,r) => s + parseFloat(r.outstanding||0), 0);
const totalBilled = rows.reduce((s,r) => s + parseFloat(r.total_billed||0), 0);
```

Response:
```json
{
  "data": {
    "customers": [
      { "id": 1, "code": "C001", "name": "ABC Paper",
        "creditLimit": 500000, "creditDays": 30,
        "total_orders": 12, "total_billed": 480000, "outstanding": 120000 }
    ],
    "totalOutstanding": 120000,
    "totalBilled": 480000
  }
}
```

---

## 2. ACCOUNTS PAYABLE (AP)

`GET /api/finance/ap`
Lookback: 1 year from NOW().

```sql
SELECT v.id, v.code, v.name,
       v.credit_days AS "creditDays",
       COUNT(po.id) AS total_pos,
       COALESCE(SUM(po.grand_total),0) AS total_ordered,
       COALESCE(SUM(
         CASE WHEN po.status NOT IN ('Received','Closed','Cancelled')
         THEN po.grand_total ELSE 0 END
       ),0) AS outstanding
FROM vendors v
LEFT JOIN purchase_orders po ON po.vendor_id=v.id
  AND po.date >= NOW()-INTERVAL '1 year'
WHERE v.is_active=true
GROUP BY v.id, v.code, v.name, v.credit_days
ORDER BY outstanding DESC
```

**outstanding** = POs where status NOT IN (`Received`,`Closed`,`Cancelled`).
`Received` or `Closed` = paid/settled.

Response:
```json
{
  "data": {
    "vendors": [
      { "id": 1, "code": "V001", "name": "XYZ Chemicals",
        "creditDays": 45, "total_pos": 8, "total_ordered": 320000, "outstanding": 80000 }
    ],
    "totalOutstanding": 80000
  }
}
```

---

## 3. STOCK VALUATION

`GET /api/finance/stock-valuation`

```sql
SELECT mc.name AS category, mc.type,
       COUNT(m.id) AS items,
       COALESCE(SUM(m.current_stock * m.unit_price),0) AS value
FROM materials m
JOIN material_categories mc ON mc.id=m.category_id
WHERE m.is_active=true
GROUP BY mc.id, mc.name, mc.type
ORDER BY value DESC
```

Method: `current_stock × unit_price` (last purchase price). Not FIFO.

Server-side:
```js
const totalValue = rows.reduce((s,r) => s + parseFloat(r.value||0), 0);
```

Response:
```json
{
  "data": {
    "byCategory": [
      { "category": "Raw Material", "type": "RawMaterial", "items": 12, "value": 450000 },
      { "category": "Chemicals",    "type": "Chemical",    "items": 8,  "value": 120000 }
    ],
    "totalValue": 570000
  }
}
```

---

## 4. FINANCIAL SUMMARY

`GET /api/finance/summary`
Period: current calendar month (`YYYY-MM-01` to today).

3 parallel queries, `$1` = first day of current month:

```sql
-- Revenue: non-cancelled SOs this month
SELECT COALESCE(SUM(total_value),0) AS revenue
FROM sales_orders
WHERE DATE(date) >= $1 AND status != 'Cancelled'

-- Spend: non-cancelled POs this month
SELECT COALESCE(SUM(grand_total),0) AS spend
FROM purchase_orders
WHERE DATE(date) >= $1 AND status != 'Cancelled'

-- Stock value: active materials (not date-filtered)
SELECT COALESCE(SUM(current_stock * unit_price),0) AS value
FROM materials WHERE is_active=true
```

`grossMargin = monthRevenue - monthSpend`
Not net — labour/utility/overhead excluded.

Response:
```json
{
  "data": {
    "monthRevenue": 1200000,
    "monthSpend": 850000,
    "stockValue": 570000,
    "grossMargin": 350000
  }
}
```

---

## Rules

- No dedicated finance tables — never create one without deliberate schema change
- DO NOT store pre-computed totals — always compute fresh from source
- All 4 routes require `role_level >= 3`
- AR outstanding = order-status-based, not payment-based
- AP outstanding = order-status-based, not payment-based
- Stock valuation = last unit_price × current_stock, not FIFO
- `pg` driver returns NUMERIC as strings → always `parseFloat()` before arithmetic
