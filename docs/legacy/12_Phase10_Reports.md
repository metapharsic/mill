# Phase 10 — Reports

Route: `/api/reports` → `backend/src/routes/reports.js`
Auth pattern: `{ auth, requireLevel }` from `../middleware/auth` (legacy — not helpers.js).

---

## Key Source Tables (exact schema)

### reels
```
reel_number     VARCHAR(30)  UNIQUE NOT NULL
start_time      TIMESTAMP    NOT NULL
machine_id      INTEGER      FK → machines.id
grade_id        INTEGER      FK → grades.id
gsm             NUMERIC(8,2)
weight_kg       NUMERIC(10,3)
efficiency_pct  NUMERIC(5,2)
moisture_pct    NUMERIC(5,2)
downtime_min    INTEGER      DEFAULT 0
steam_consumption NUMERIC(10,3)
water_consumption NUMERIC(10,3)
status          VARCHAR(30)  CHECK IN ('In Production','QC Pending','QC Done','In Warehouse','Dispatched','Rejected')
quality_status  VARCHAR(20)  CHECK IN ('Pending','Approved','Rejected','Hold')
```

### quality_tests
```
test_number  VARCHAR(30)  UNIQUE NOT NULL
test_date    TIMESTAMP    NOT NULL
test_type    VARCHAR(50)
result       VARCHAR(20)  CHECK IN ('Pending','Pass','Fail','Hold')
gsm          NUMERIC(8,2)
moisture_pct NUMERIC(5,2)
burst_factor NUMERIC(8,3)
tested_by    INTEGER      FK → users.id
```

### utility_readings
```
date              DATE        NOT NULL
shift_type        VARCHAR(20)
power_units       NUMERIC(10,3)
dg_units          NUMERIC(10,3)
steam_generated_mt NUMERIC(10,3)
coal_consumed_kg  NUMERIC(10,3)
fresh_water_kl    NUMERIC(10,3)
boiler_pressure   NUMERIC(8,2)
boiler_temp       NUMERIC(8,2)
```
Index: `utility_readings(date)`

### machines (phase3 addition)
```
code           VARCHAR(20)   -- added by phase3_migration.sql
ideal_speed_mpm NUMERIC(8,2) DEFAULT 0  -- for OEE
```

---

## 1. PRODUCTION REPORT

`GET /api/reports/production`
Auth: `requireLevel(2)` — Supervisor+
Params: `?from=YYYY-MM-DD&to=YYYY-MM-DD&machine_id=&grade_id=`

### SQL — Summary
```sql
SELECT COUNT(*) AS total_reels,
       COALESCE(SUM(weight_kg),0) AS total_kg,
       COALESCE(SUM(weight_kg),0)/1000 AS total_mt,
       COALESCE(AVG(efficiency_pct),0) AS avg_efficiency,
       COALESCE(AVG(gsm),0) AS avg_gsm,
       COALESCE(AVG(moisture_pct),0) AS avg_moisture,
       COALESCE(SUM(downtime_min),0) AS total_downtime_min,
       COALESCE(SUM(steam_consumption),0) AS total_steam,
       COALESCE(SUM(water_consumption),0) AS total_water
FROM reels r
WHERE DATE(r.start_time) BETWEEN $1 AND $2
  [AND r.machine_id=$N] [AND r.grade_id=$N]
```

### SQL — By Machine
```sql
SELECT m.name AS machine, m.code,
       COUNT(r.id) AS reels,
       COALESCE(SUM(r.weight_kg),0) AS total_kg,
       COALESCE(AVG(r.efficiency_pct),0) AS avg_efficiency
FROM reels r JOIN machines m ON m.id=r.machine_id
WHERE DATE(r.start_time) BETWEEN $1 AND $2
  [AND filters]
GROUP BY m.id, m.name, m.code
ORDER BY total_kg DESC
```

### SQL — By Grade
```sql
SELECT g.name AS grade, g.code,
       COUNT(r.id) AS reels,
       COALESCE(SUM(r.weight_kg),0) AS total_kg,
       COALESCE(AVG(r.gsm),0) AS avg_gsm
FROM reels r JOIN grades g ON g.id=r.grade_id
WHERE DATE(r.start_time) BETWEEN $1 AND $2
  [AND filters]
GROUP BY g.id, g.name, g.code
ORDER BY total_kg DESC
```

### SQL — Reel Detail (LIMIT 500)
```sql
SELECT r.reel_number AS "reelNumber", r.start_time AS "startTime",
       r.gsm, r.weight_kg AS "weightKg", r.efficiency_pct AS "efficiencyPct",
       r.moisture_pct AS "moisturePct",
       r.status,           -- 'In Production'|'QC Pending'|'QC Done'|'In Warehouse'|'Dispatched'|'Rejected'
       r.quality_status AS "qualityStatus",  -- 'Pending'|'Approved'|'Rejected'|'Hold'
       m.name AS machine, g.name AS grade
FROM reels r
JOIN machines m ON m.id=r.machine_id
JOIN grades g ON g.id=r.grade_id
WHERE DATE(r.start_time) BETWEEN $1 AND $2
ORDER BY r.start_time DESC LIMIT 500
```

### Response
```json
{
  "success": true,
  "data": {
    "from": "YYYY-MM-DD", "to": "YYYY-MM-DD",
    "summary": {
      "total_reels": 0, "total_kg": 0, "total_mt": 0,
      "avg_efficiency": 0, "avg_gsm": 0, "avg_moisture": 0,
      "total_downtime_min": 0, "total_steam": 0, "total_water": 0
    },
    "byMachine": [{ "machine": "", "code": "", "reels": 0, "total_kg": 0, "avg_efficiency": 0 }],
    "byGrade":   [{ "grade": "",   "code": "", "reels": 0, "total_kg": 0, "avg_gsm": 0 }],
    "reels": [{
      "reelNumber": "", "startTime": "", "gsm": 0, "weightKg": 0,
      "efficiencyPct": 0, "moisturePct": 0,
      "status": "", "qualityStatus": "", "machine": "", "grade": ""
    }]
  }
}
```

Index used: `idx_reels_start_time` on `reels(start_time)`. Optional filters hit `idx_reels_machine_id`, `idx_reels_machine_id`.

---

## 2. INVENTORY REPORT

`GET /api/reports/inventory`
Auth: `requireLevel(2)`
Params: `?category_id=&low_stock=true`

### SQL
```sql
SELECT m.code, m.name,
       mc.name AS category, mc.type AS "categoryType",
       m.uom,
       m.current_stock AS "currentStock",
       m.reorder_level AS "reorderLevel",
       m.min_stock AS "minStock",
       m.max_stock AS "maxStock",
       m.unit_price AS "unitPrice",
       m.current_stock * m.unit_price AS value,
       (m.current_stock <= m.reorder_level) AS "belowReorder"
FROM materials m
JOIN material_categories mc ON mc.id=m.category_id
WHERE m.is_active=true
  [AND m.category_id=$N]
  [AND m.current_stock<=m.reorder_level]  -- only if ?low_stock=true
ORDER BY mc.name, m.name
```

### JS aggregation (server-side)
```js
const totalValue = rows.reduce((s, r) => s + parseFloat(r.value || 0), 0);
const alertCount = rows.filter(r => r.belowReorder).length;
```

### Response
```json
{
  "success": true,
  "data": {
    "materials": [{ "code": "", "name": "", "category": "", "categoryType": "", "uom": "",
                    "currentStock": 0, "reorderLevel": 0, "minStock": 0, "maxStock": 0,
                    "unitPrice": 0, "value": 0, "belowReorder": false }],
    "totalValue": 0,
    "alertCount": 0
  }
}
```

---

## 3. QUALITY REPORT

`GET /api/reports/quality`
Auth: `requireLevel(2)`
Params: `?from=&to=`

### SQL — Summary
```sql
SELECT COUNT(*) AS total,
       SUM(CASE WHEN result='Pass' THEN 1 ELSE 0 END) AS passed,
       SUM(CASE WHEN result='Fail' THEN 1 ELSE 0 END) AS failed,
       SUM(CASE WHEN result='Hold' THEN 1 ELSE 0 END) AS held,
       ROUND(100.0*SUM(CASE WHEN result='Pass' THEN 1 ELSE 0 END)/NULLIF(COUNT(*),0),2) AS pass_rate
FROM quality_tests
WHERE DATE(test_date) BETWEEN $1 AND $2
```

### SQL — By Type
```sql
SELECT test_type,
       COUNT(*) AS total,
       SUM(CASE WHEN result='Pass' THEN 1 ELSE 0 END) AS passed,
       SUM(CASE WHEN result='Fail' THEN 1 ELSE 0 END) AS failed
FROM quality_tests
WHERE DATE(test_date) BETWEEN $1 AND $2
GROUP BY test_type
```

### SQL — Test Detail (LIMIT 500)
```sql
SELECT qt.test_number AS "testNumber", qt.test_type AS "testType",
       qt.test_date AS "testDate",
       qt.result,  -- 'Pending'|'Pass'|'Fail'|'Hold'
       qt.gsm, qt.moisture_pct AS "moisturePct", qt.burst_factor AS "burstFactor",
       u.name AS "testedBy"
FROM quality_tests qt
LEFT JOIN users u ON u.id=qt.tested_by
WHERE DATE(qt.test_date) BETWEEN $1 AND $2
ORDER BY qt.test_date DESC LIMIT 500
```

### Response
```json
{
  "success": true,
  "data": {
    "from": "YYYY-MM-DD", "to": "YYYY-MM-DD",
    "summary": { "total": 0, "passed": 0, "failed": 0, "held": 0, "pass_rate": 0 },
    "byType": [{ "test_type": "", "total": 0, "passed": 0, "failed": 0 }],
    "tests": [{
      "testNumber": "", "testType": "", "testDate": "",
      "result": "", "gsm": 0, "moisturePct": 0, "burstFactor": 0, "testedBy": ""
    }]
  }
}
```

---

## 4. SALES REPORT

`GET /api/reports/sales`
Auth: `requireLevel(3)` — Manager+ only
Params: `?from=&to=`

### Source: `sales_orders`
```
status CHECK IN ('Pending','In Production','Ready','Partial','Dispatched','Cancelled')
qty_mt         NUMERIC(10,3)
fulfilled_mt   NUMERIC(10,3)
total_value    NUMERIC(14,2)
rate_per_kg    NUMERIC(8,2)
customer_id    FK → customers.id
grade_id       FK → grades.id
```

### SQL — Summary
```sql
SELECT COUNT(*) AS total_orders,
       COALESCE(SUM(qty_mt),0) AS total_qty_mt,
       COALESCE(SUM(fulfilled_mt),0) AS total_fulfilled_mt,
       COALESCE(SUM(total_value),0) AS total_value
FROM sales_orders
WHERE DATE(date) BETWEEN $1 AND $2
```

### SQL — By Customer
```sql
SELECT c.name AS customer,
       COUNT(so.id) AS orders,
       COALESCE(SUM(so.qty_mt),0) AS qty_mt,
       COALESCE(SUM(so.total_value),0) AS value
FROM sales_orders so
JOIN customers c ON c.id=so.customer_id
WHERE DATE(so.date) BETWEEN $1 AND $2
GROUP BY c.id, c.name
ORDER BY value DESC
```

### SQL — Order Detail
```sql
SELECT so.so_number AS "soNumber", so.date,
       so.status,  -- 'Pending'|'In Production'|'Ready'|'Partial'|'Dispatched'|'Cancelled'
       so.qty_mt AS "qtyMt", so.fulfilled_mt AS "fulfilledMt",
       so.rate_per_kg AS "ratePerKg", so.total_value AS "totalValue",
       c.name AS customer, g.name AS grade
FROM sales_orders so
JOIN customers c ON c.id=so.customer_id
JOIN grades g ON g.id=so.grade_id
WHERE DATE(so.date) BETWEEN $1 AND $2
ORDER BY so.date DESC
```

### Response
```json
{
  "success": true,
  "data": {
    "from": "YYYY-MM-DD", "to": "YYYY-MM-DD",
    "summary": { "total_orders": 0, "total_qty_mt": 0, "total_fulfilled_mt": 0, "total_value": 0 },
    "byCustomer": [{ "customer": "", "orders": 0, "qty_mt": 0, "value": 0 }],
    "orders": [{
      "soNumber": "", "date": "", "status": "", "qtyMt": 0, "fulfilledMt": 0,
      "ratePerKg": 0, "totalValue": 0, "customer": "", "grade": ""
    }]
  }
}
```

---

## 5. UTILITY REPORT

`GET /api/reports/utility`
Auth: `requireLevel(2)`
Params: `?from=&to=`

### SQL — Summary
```sql
SELECT COALESCE(SUM(power_units+dg_units),0) AS total_power,
       COALESCE(SUM(steam_generated_mt),0) AS total_steam,
       COALESCE(SUM(coal_consumed_kg),0) AS total_coal,
       COALESCE(SUM(fresh_water_kl),0) AS total_water,
       COALESCE(AVG(boiler_pressure),0) AS avg_pressure,
       COALESCE(AVG(boiler_temp),0) AS avg_temp
FROM utility_readings
WHERE date BETWEEN $1 AND $2
```

### SQL — By Date+Shift
```sql
SELECT date, shift_type,
       COALESCE(SUM(power_units+dg_units),0) AS power,
       COALESCE(SUM(steam_generated_mt),0) AS steam,
       COALESCE(SUM(coal_consumed_kg),0) AS coal,
       COALESCE(SUM(fresh_water_kl),0) AS water
FROM utility_readings
WHERE date BETWEEN $1 AND $2
GROUP BY date, shift_type
ORDER BY date DESC, shift_type
```

### Response
```json
{
  "success": true,
  "data": {
    "from": "YYYY-MM-DD", "to": "YYYY-MM-DD",
    "summary": {
      "total_power": 0, "total_steam": 0, "total_coal": 0,
      "total_water": 0, "avg_pressure": 0, "avg_temp": 0
    },
    "byDate": [{ "date": "", "shift_type": "", "power": 0, "steam": 0, "coal": 0, "water": 0 }]
  }
}
```

---

## Rules

- All endpoints: read-only — no INSERT/UPDATE
- Default date range: today if `?from`/`?to` not supplied
- LIMIT 500 on reel detail, LIMIT 500 on quality test detail — no pagination
- Sales report requires level 3; all others level 2
- Print: `window.print()` — no PDF lib. Add `@media print { background: white; color: black; }`
- `totalValue` / `alertCount` always computed server-side from rows — never from a second query
