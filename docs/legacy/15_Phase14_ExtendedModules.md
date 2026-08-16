# Phase 14 — Extended Modules

Migration: `db/migration_phase14.sql`
Import pattern: ALL route files use `require('../middleware/helpers')` for `{ pool, requireAuth, requireLevel, ar }`.

| Module | Route | File | Tables |
|--------|-------|------|--------|
| Store | /api/store | routes/store.js | materials, store_issues, stock_ledger |
| Scrap | /api/scrap | routes/scrap.js | scrap_records, departments |
| Warehouse | /api/warehouse | routes/warehouse.js | reels, packing_records, grades |
| Security | /api/security | routes/security.js | gate_passes |
| Laboratory | /api/laboratory | routes/laboratory.js | lab_samples |
| EHS | /api/ehs | routes/ehs.js | ehs_incidents, departments |
| Admin | /api/admin | routes/admin.js | system_settings, departments, roles, audit_log |

---

## 1. STORE

### Tables

#### store_issues (migration_phase14.sql)
```
id            SERIAL PRIMARY KEY
issue_number  VARCHAR(30) UNIQUE
issue_date    DATE NOT NULL DEFAULT CURRENT_DATE
material_id   INTEGER FK → materials.id
department_id INTEGER FK → departments.id
quantity      NUMERIC(12,3) NOT NULL
unit          VARCHAR(20)                    -- copied from materials.unit on create
purpose       TEXT
issued_by     INTEGER FK → users.id
approved_by   INTEGER FK → users.id          -- set on approval
status        VARCHAR(20) DEFAULT 'Pending'  -- 'Pending'|'Issued'|'Rejected'
remarks       TEXT
created_at    TIMESTAMP DEFAULT NOW()
```

#### materials (relevant columns)
```
current_stock  NUMERIC(12,3)
min_stock      NUMERIC(12,3)
unit           VARCHAR(20)
unit_price     NUMERIC(12,2)
category_id    FK → material_categories.id
is_active      BOOLEAN
```

#### stock_ledger (relevant columns)
```
material_id       INTEGER FK → materials.id
transaction_type  VARCHAR(30)  -- GRN|Issue|Return|Transfer|Adjustment|Scrap
date              TIMESTAMP
in_qty            NUMERIC(12,3) DEFAULT 0
out_qty           NUMERIC(12,3) DEFAULT 0
balance           NUMERIC(12,3)
reference         VARCHAR(100)
notes             TEXT
```
Index: `idx_stock_ledger_material_id`, `idx_stock_ledger_date`.

### 1a. Raw Materials List
`GET /api/store/rawmaterials` — `requireAuth`

```sql
SELECT m.id, m.name, m.code, m.unit, m.current_stock, m.min_stock, m.unit_price,
       mc.name AS categoryName,
       (m.current_stock <= m.min_stock) AS lowStock
FROM materials m
LEFT JOIN material_categories mc ON m.category_id = mc.id
WHERE m.is_active = true
ORDER BY mc.name, m.name
```

### 1b. Store Issues List
`GET /api/store/issues` — `requireAuth`
Params: `?from=&to=&status=`

```sql
SELECT si.*, m.name AS materialName, m.unit,
       d.name AS departmentName, u.name AS issuedByName
FROM store_issues si
LEFT JOIN materials m ON si.material_id = m.id
LEFT JOIN departments d ON si.department_id = d.id
LEFT JOIN users u ON si.issued_by = u.id
WHERE [date/status filters]
ORDER BY si.created_at DESC LIMIT 200
```

### 1c. Create Issue
`POST /api/store/issues` — `requireAuth`

Issue number format: `SI-YYYYMMDD-NNNN`
```js
const seq = await pool.query(
  `SELECT COUNT(*)+1 AS n FROM store_issues WHERE issue_date::date = CURRENT_DATE`
);
const num = `SI-${YYYYMMDD}-${String(seq.rows[0].n).padStart(4,'0')}`;
```

Form fields:
| DB Column | Type | Validation |
|-----------|------|------------|
| material_id | FK → materials.id | required |
| department_id | FK → departments.id | required |
| quantity | NUMERIC(12,3) | > 0 |
| purpose | TEXT | required |
| remarks | TEXT | optional |

`unit` auto-copied from `materials.unit`. `issued_by` = `req.user.id`. `status` = `Pending`.

### 1d. Approve Issue (ACID)
`PUT /api/store/issues/:id/approve` — `requireLevel(2)`

Transaction steps:
1. SELECT issue → verify `status = 'Pending'`
2. SELECT material → check `current_stock >= si.quantity`
3. `UPDATE materials SET current_stock = current_stock - si.quantity WHERE id=$1`
4. INSERT `stock_ledger`: `transaction_type='Issue'`, `out_qty=si.quantity`, `balance=prev-qty`, `reference=issue_number`
5. `UPDATE store_issues SET status='Issued', approved_by=req.user.id WHERE id=$1`

Stock check:
```js
if (parseFloat(mat.current_stock) < parseFloat(si.quantity))
  return res.status(400).json({ success: false, message: 'Insufficient stock' });
```

### 1e. Reject Issue
`PUT /api/store/issues/:id/reject` — `requireLevel(2)`
```sql
UPDATE store_issues SET status='Rejected' WHERE id=$1 RETURNING *
```

### Issue State Machine
```
Pending → Issued  (approve: deducts stock + ledger entry)
Pending → Rejected (no stock change)
```
No transitions from Issued or Rejected.

---

## 2. SCRAP

### Table: scrap_records (migration_phase14.sql)
```
id                   SERIAL PRIMARY KEY
scrap_number         VARCHAR(30) UNIQUE
date                 DATE NOT NULL DEFAULT CURRENT_DATE
scrap_type           VARCHAR(50)   -- 'Paper'|'Plastic'|'Metal'|'Chemical'|'Other'
source_department_id INTEGER FK → departments.id
quantity_kg          NUMERIC(12,3) NOT NULL
description          TEXT
disposal_method      VARCHAR(50)   -- 'Sale'|'Recycle'|'Dispose'|'Incinerate'
buyer_name           VARCHAR(100)
sale_amount          NUMERIC(12,2) DEFAULT 0
recorded_by          INTEGER FK → users.id
status               VARCHAR(20) DEFAULT 'Pending'  -- 'Pending'|'Disposed'|'Sold'
created_at           TIMESTAMP DEFAULT NOW()
```
No `remarks` column in this table.

### 2a. List
`GET /api/scrap` — `requireAuth`
Params: `?from=&to=&status=`

```sql
SELECT sr.*, d.name AS departmentName, u.name AS recordedByName
FROM scrap_records sr
LEFT JOIN departments d ON sr.source_department_id = d.id
LEFT JOIN users u ON sr.recorded_by = u.id
WHERE [filters]
ORDER BY sr.created_at DESC LIMIT 200
```

### 2b. Create
`POST /api/scrap` — `requireAuth`

Scrap number: `SCR-YYYYMMDD-NNNN`

Form fields:
| DB Column | Type | Validation |
|-----------|------|------------|
| scrap_type | VARCHAR(50) | Paper/Plastic/Metal/Chemical/Other |
| source_department_id | FK → departments.id | required |
| quantity_kg | NUMERIC(12,3) | > 0 |
| description | TEXT | required |
| disposal_method | VARCHAR(50) | Sale/Recycle/Dispose/Incinerate |
| buyer_name | VARCHAR(100) | optional |
| sale_amount | NUMERIC(12,2) | ≥ 0, default 0 |

`recorded_by` = `req.user.id`.

### 2c. Update
`PUT /api/scrap/:id` — `requireAuth`
Updates: `scrap_type, quantity_kg, description, disposal_method, buyer_name, sale_amount, status`
No `remarks` — not in schema.

---

## 3. WAREHOUSE (Finished Goods)

### Tables

#### packing_records (migration_phase14.sql)
```
id              SERIAL PRIMARY KEY
pack_number     VARCHAR(30) UNIQUE
date            DATE NOT NULL DEFAULT CURRENT_DATE
reel_id         INTEGER FK → reels.id
packing_type    VARCHAR(50)    -- 'Stretch Wrap'|'Cardboard'|'PP Strap'|'Other'
wrap_material   VARCHAR(50)
net_weight_kg   NUMERIC(10,3)
gross_weight_kg NUMERIC(10,3)
label_printed   BOOLEAN DEFAULT false
packed_by       INTEGER FK → users.id
remarks         TEXT
created_at      TIMESTAMP DEFAULT NOW()
```

#### reels (relevant for warehouse)
```
status  VARCHAR(30) CHECK IN ('In Production','QC Pending','QC Done','In Warehouse','Dispatched','Rejected')
```
Warehouse only shows reels where `status = 'In Warehouse'`.

### 3a. Warehouse Reels
`GET /api/warehouse/reels` — `requireAuth`
Params: `?gradeId=&from=&to=`

```sql
SELECT r.*, g.name AS gradeName, m.name AS machineName,
       pr.pack_number AS packNumber,
       pr.packing_type AS packingType
FROM reels r
LEFT JOIN grades g ON r.grade_id = g.id
LEFT JOIN machines m ON r.machine_id = m.id
LEFT JOIN packing_records pr ON pr.reel_id = r.id
WHERE r.status = 'In Warehouse'
  [AND r.grade_id=$N]
  [AND r.created_at::date >= $N]
  [AND r.created_at::date <= $N]
ORDER BY r.created_at DESC LIMIT 500
```

Summary computed from rows:
```js
totalReels: rows.length
totalWeight: rows.reduce((s,r) => s + parseFloat(r.net_weight_kg||0), 0)
grades: [...new Set(rows.map(r => r.gradeName))].length
```

### 3b. Packing Records List
`GET /api/warehouse/packing` — `requireAuth`
Params: `?from=&to=`

```sql
SELECT pr.*, r.reel_number, g.name AS gradeName, u.name AS packedByName
FROM packing_records pr
LEFT JOIN reels r ON pr.reel_id = r.id
LEFT JOIN grades g ON r.grade_id = g.id
LEFT JOIN users u ON pr.packed_by = u.id
WHERE [date filters on pr.date]
ORDER BY pr.created_at DESC LIMIT 200
```

### 3c. Create Packing Record
`POST /api/warehouse/packing` — `requireAuth`

Pack number: `PACK-YYYYMMDD-NNNN`

Form fields:
| DB Column | Type | Validation |
|-----------|------|------------|
| reel_id | FK → reels.id | required, must have status='In Warehouse' |
| packing_type | VARCHAR(50) | Stretch Wrap/Cardboard/PP Strap/Other |
| wrap_material | VARCHAR(50) | text |
| net_weight_kg | NUMERIC(10,3) | > 0 |
| gross_weight_kg | NUMERIC(10,3) | > net_weight_kg |
| remarks | TEXT | optional |

`packed_by` = `req.user.id`.

### 3d. Mark Label Printed
`PUT /api/warehouse/packing/:id/label` — `requireAuth`
```sql
UPDATE packing_records SET label_printed=true WHERE id=$1 RETURNING *
```

### 3e. Grades Dropdown
`GET /api/warehouse/grades` — `requireAuth`
```sql
SELECT id, name, code FROM grades WHERE is_active=true ORDER BY name
```

---

## 4. SECURITY (Gate Passes)

### Table: gate_passes (migration_phase14.sql)
```
id                   SERIAL PRIMARY KEY
gp_number            VARCHAR(30) UNIQUE
date                 DATE NOT NULL DEFAULT CURRENT_DATE
pass_type            VARCHAR(20) NOT NULL     -- 'IN'|'OUT'|'INOUT'
vehicle_type         VARCHAR(30)              -- 'Truck'|'Tempo'|'Car'|'Bike'|'Other'
vehicle_number       VARCHAR(20)
driver_name          VARCHAR(100)
purpose              VARCHAR(100)             -- 'Material IN'|'Material OUT'|'Visit'|'Labour'|'Other'
material_description TEXT
from_party           VARCHAR(100)
to_party             VARCHAR(100)
in_time              TIMESTAMP                -- set to NOW() on create
out_time             TIMESTAMP                -- set on close
weight_in            NUMERIC(10,3)            -- tare weight (kg)
weight_out           NUMERIC(10,3)            -- gross weight (kg)
net_weight           NUMERIC(10,3)            -- ABS(weight_in - weight_out)
security_guard_id    INTEGER FK → users.id
status               VARCHAR(20) DEFAULT 'Open'  -- 'Open'|'Closed'
remarks              TEXT
created_at           TIMESTAMP DEFAULT NOW()
```

### 4a. Gate Pass List
`GET /api/security/passes` — `requireAuth`
Params: `?from=&to=&passType=&status=`

Summary from all records (no date filter):
```json
{ "open": N, "today": N, "inToday": N, "outToday": N }
```

### 4b. Create Gate Pass
`POST /api/security/passes` — `requireAuth`

Gate pass number: `GP-YYYYMMDD-NNNN`
`in_time` = `NOW()`. `security_guard_id` = `req.user.id`. `status` = `Open`.

Form fields:
| DB Column | Type | Validation |
|-----------|------|------------|
| pass_type | VARCHAR(20) | IN/OUT/INOUT — required |
| vehicle_type | VARCHAR(30) | Truck/Tempo/Car/Bike/Other |
| vehicle_number | VARCHAR(20) | required |
| driver_name | VARCHAR(100) | required |
| purpose | VARCHAR(100) | required |
| material_description | TEXT | optional |
| from_party | VARCHAR(100) | optional |
| to_party | VARCHAR(100) | optional |
| weight_in | NUMERIC(10,3) | optional, tare weight |
| remarks | TEXT | optional |

### 4c. Close (Vehicle Out)
`PUT /api/security/passes/:id/out` — `requireAuth`
Body: `{ weightOut }`

```js
net_weight = Math.abs(parseFloat(weight_in) - parseFloat(weightOut))
```
```sql
UPDATE gate_passes
SET out_time=NOW(), weight_out=$1, net_weight=$2, status='Closed'
WHERE id=$3
RETURNING *
```

### Gate Pass State Machine
```
Open → Closed
```
No re-open after Closed.

---

## 5. LABORATORY

### Table: lab_samples (migration_phase14.sql)
```
id            SERIAL PRIMARY KEY
sample_number VARCHAR(30) UNIQUE
date          DATE NOT NULL DEFAULT CURRENT_DATE
sample_type   VARCHAR(50)      -- 'Paper'|'Water'|'Chemical'|'Effluent'
source_ref    VARCHAR(100)     -- reel number / GRN number / free text
collected_by  INTEGER FK → users.id
tested_by     INTEGER FK → users.id   -- set when result entered
brightness    NUMERIC(6,2)            -- % (Paper)
opacity       NUMERIC(6,2)            -- % (Paper)
ph_value      NUMERIC(5,2)            -- pH (Paper/Water)
ash_content   NUMERIC(6,2)            -- % (Paper)
moisture      NUMERIC(6,2)            -- % (Paper)
cod           NUMERIC(10,3)           -- mg/L Chemical Oxygen Demand (Water/Effluent)
bod           NUMERIC(10,3)           -- mg/L Biological Oxygen Demand (Water/Effluent)
tss           NUMERIC(10,3)           -- mg/L Total Suspended Solids (Water/Effluent)
ph_water      NUMERIC(5,2)            -- pH (Water/Effluent)
concentration NUMERIC(10,3)           -- (Chemical)
purity        NUMERIC(6,2)            -- % (Chemical)
result        VARCHAR(20) DEFAULT 'Pending'   -- 'Pending'|'Pass'|'Fail'
remarks       TEXT
created_at    TIMESTAMP DEFAULT NOW()
```

Sample parameters by type:
| Sample Type | Use these columns |
|-------------|------------------|
| Paper | brightness, opacity, ph_value, ash_content, moisture |
| Water | cod, bod, tss, ph_water |
| Effluent | cod, bod, tss, ph_water |
| Chemical | concentration, purity |

All param columns nullable — only fill relevant ones.

### 5a. Sample List
`GET /api/laboratory/samples` — `requireAuth`
Params: `?from=&to=&sampleType=&result=`

Summary (all records, no date filter):
```json
{ "total": N, "pending": N, "passed": N, "failed": N }
```

### 5b. Create Sample
`POST /api/laboratory/samples` — `requireAuth`

Sample number: `LAB-YYYYMMDD-NNNN`
`collected_by` = `req.user.id`. `result` defaults to `Pending`.

Form fields: `sample_type`, `source_ref`, then the relevant numeric params for the type, `remarks`.

### 5c. Set Result
`PUT /api/laboratory/samples/:id/result` — `requireAuth`
Body: `{ result, remarks }`

Valid result values: `Pass` or `Fail` only.
```js
if (!['Pass','Fail'].includes(result))
  return res.status(400).json({ success: false, message: 'Invalid result' });
```
Sets `tested_by = req.user.id` on the row.

---

## 6. EHS (Environment, Health & Safety)

### Table: ehs_incidents (migration_phase14.sql)
```
id               SERIAL PRIMARY KEY
incident_number  VARCHAR(30) UNIQUE
date             DATE NOT NULL DEFAULT CURRENT_DATE
incident_time    TIME                      -- !! TIME not TIMESTAMP — just HH:MM:SS
incident_type    VARCHAR(50)               -- 'LTI'|'Near Miss'|'First Aid'|'Fire'|'Environmental'|'Other'
severity         VARCHAR(20)               -- 'Low'|'Medium'|'High'|'Critical'
location         VARCHAR(100)
department_id    INTEGER FK → departments.id
description      TEXT NOT NULL
injured_person   VARCHAR(100)              -- name or 'N/A'
root_cause       TEXT
corrective_action TEXT
reported_by      INTEGER FK → users.id
status           VARCHAR(20) DEFAULT 'Open'  -- 'Open'|'Under Investigation'|'Closed'
closure_date     DATE                      -- set when status → Closed
created_at       TIMESTAMP DEFAULT NOW()
```

CRITICAL: `incident_time` is `TIME` type — store as `HH:MM:SS` string. NOT a full timestamp.

### 6a. Incident List
`GET /api/ehs/incidents` — `requireAuth`
Params: `?from=&to=&severity=&status=`

Summary (all records, no date filter):
```json
{ "total": N, "open": N, "highSeverity": N, "last30Days": N, "lti": N }
```
- `highSeverity` = COUNT WHERE severity IN ('High','Critical')
- `lti` = COUNT WHERE incident_type = 'LTI'
- `last30Days` = COUNT WHERE date >= NOW()-INTERVAL '30 days'

### 6b. Create Incident
`POST /api/ehs/incidents` — `requireAuth`

Incident number: `EHS-YYYYMMDD-NNNN`
`reported_by` = `req.user.id`. `status` = `Open`.

Form fields:
| DB Column | Type | Validation |
|-----------|------|------------|
| incident_type | VARCHAR(50) | LTI/Near Miss/First Aid/Fire/Environmental/Other |
| severity | VARCHAR(20) | Low/Medium/High/Critical |
| location | VARCHAR(100) | required |
| department_id | FK → departments.id | optional |
| description | TEXT | required |
| injured_person | VARCHAR(100) | required (use 'N/A' if none) |
| incident_time | TIME | optional — HH:MM format |
| root_cause | TEXT | optional |
| corrective_action | TEXT | optional |

### 6c. Update (Investigation/Closure)
`PUT /api/ehs/incidents/:id` — `requireAuth`
Body: `{ rootCause, correctiveAction, status, closureDate }`

```sql
UPDATE ehs_incidents
SET root_cause=$1, corrective_action=$2, status=$3, closure_date=$4
WHERE id=$5
RETURNING *
```

Set `closure_date` when `status='Closed'`. Leave NULL otherwise.

### 6d. Departments Dropdown
`GET /api/ehs/departments` — `requireAuth`
```sql
SELECT id, name FROM departments ORDER BY name
```

### Incident State Machine
```
Open → Under Investigation → Closed
```

---

## 7. ADMIN

All endpoints: `requireLevel(4)` minimum — PlantHead+.
PUT settings: `requireLevel(5)` — Admin ONLY.

### Table: system_settings (migration_phase14.sql)
```
id         SERIAL PRIMARY KEY
key        VARCHAR(100) UNIQUE NOT NULL
value      TEXT
category   VARCHAR(50)
label      VARCHAR(100)
updated_by INTEGER FK → users.id
updated_at TIMESTAMP DEFAULT NOW()
```

Seeded keys:
| key | category | default value |
|-----|----------|---------------|
| company_name | Company | 'MK Paper Mill' |
| company_address | Company | '' |
| company_phone | Company | '' |
| company_email | Company | '' |
| company_gst | Company | '' |
| company_pan | Company | '' |
| financial_year_start | System | '04' |
| low_stock_alert_days | System | '7' |
| sequence_prefix_indent | System | 'IND' |
| sequence_prefix_po | System | 'PO' |
| sequence_prefix_so | System | 'SO' |
| sequence_prefix_do | System | 'DO' |

### 7a. Get Settings
`GET /api/admin/settings` — `requireLevel(4)`
```sql
SELECT key, value, category, label FROM system_settings ORDER BY category, key
```

### 7b. Save Settings
`PUT /api/admin/settings` — `requireLevel(5)`
Body: `{ settings: [{ key, value }] }`

Loop — UPDATE only, no INSERT:
```sql
UPDATE system_settings
SET value=$1, updated_by=$2, updated_at=NOW()
WHERE key=$3
```

### 7c. Departments CRUD
`GET /api/admin/departments` — `requireAuth`
```sql
SELECT * FROM departments ORDER BY name
```

`POST /api/admin/departments` — `requireLevel(5)`
Body: `{ name, code }`
```js
code = code.toUpperCase(); // forced
```
```sql
INSERT INTO departments (name, code) VALUES ($1, $2) RETURNING *
```

### 7d. Roles List
`GET /api/admin/roles` — `requireLevel(4)`
```sql
SELECT id, name, level, permissions FROM roles ORDER BY level
```
Read-only — no update API for roles.

| level | name |
|-------|------|
| 1 | Operator |
| 2 | Supervisor |
| 3 | Manager |
| 4 | PlantHead |
| 5 | Admin |

### 7e. Audit Log
`GET /api/admin/audit` — `requireLevel(4)`
```sql
SELECT al.*, u.name AS userName
FROM audit_log al
LEFT JOIN users u ON al.user_id = u.id
ORDER BY al.created_at DESC LIMIT 200
```
Index: `idx_audit_log_module_created_at` on `audit_log(module, created_at)`.

### 7f. DB Stats
`GET /api/admin/stats` — `requireLevel(4)`
```sql
SELECT
  (SELECT COUNT(*) FROM users WHERE is_active=true) AS users,
  (SELECT COUNT(*) FROM materials WHERE is_active=true) AS materials,
  (SELECT COUNT(*) FROM reels) AS reels,
  (SELECT COUNT(*) FROM purchase_orders) AS pos,
  (SELECT COUNT(*) FROM sales_orders) AS sos,
  (SELECT COUNT(*) FROM employees WHERE is_active=true) AS employees
```
