# Store Module — Complete Reference

**Route file:** `backend/src/routes/store.js`
**Mount point:** `/api/store` (registered in `server.js`)
**Import pattern:** `const { pool, requireAuth, requireLevel, ar } = require('../middleware/helpers')`
**Migration:** `db/migration_phase14.sql`

> **Two parts in this doc:**
> - **Part A — CURRENT (live code).** What `store.js` does today. Simple issue → approve → deduct.
> - **Part B — PROPOSED (to build).** New indent workflow: department raises indent → permission gate → STORE issues + logs → admin sees every step as progress. Tables + routes below DO NOT exist yet. Build per this spec.

---

# PART A — CURRENT (live in store.js)

---

## Database Tables

### store_issues
```sql
CREATE TABLE store_issues (
  id            SERIAL PRIMARY KEY,
  issue_number  VARCHAR(30) UNIQUE,
  issue_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  material_id   INTEGER REFERENCES materials(id),
  department_id INTEGER REFERENCES departments(id),
  quantity      NUMERIC(12,3) NOT NULL,
  unit          VARCHAR(20),            -- copied from materials.unit on create
  purpose       TEXT,
  issued_by     INTEGER REFERENCES users(id),   -- req.user.id on create
  approved_by   INTEGER REFERENCES users(id),   -- req.user.id on approve
  status        VARCHAR(20) DEFAULT 'Pending',  -- Pending | Issued | Rejected
  remarks       TEXT,
  created_at    TIMESTAMP DEFAULT NOW()
);
```

Status values (no DB CHECK constraint — enforced in route logic):
- `Pending` — created, waiting approval
- `Issued` — approved, stock deducted
- `Rejected` — rejected, no stock change

### materials (columns used by store)
```
id            SERIAL PRIMARY KEY
code          VARCHAR(30)
name          VARCHAR(100) NOT NULL
unit          VARCHAR(20)
current_stock NUMERIC(12,3) DEFAULT 0
min_stock     NUMERIC(12,3) DEFAULT 0
unit_price    NUMERIC(12,2)
category_id   INTEGER FK → material_categories.id
is_active     BOOLEAN DEFAULT true
```

### stock_ledger (columns used by store approve)
```
id                SERIAL PRIMARY KEY
material_id       INTEGER FK → materials.id
transaction_type  VARCHAR(30)     -- 'Issue' for store issues
reference_type    VARCHAR(50)     -- 'StoreIssue'
reference_id      INTEGER         -- store_issues.id
in_qty            NUMERIC(12,3) DEFAULT 0
out_qty           NUMERIC(12,3)   -- quantity issued
balance           NUMERIC(12,3)   -- running balance after transaction
remarks           TEXT            -- 'Store issue'
date              TIMESTAMP DEFAULT NOW()
```
Indexes: `idx_stock_ledger_material_id`, `idx_stock_ledger_date`

`transaction_type` all possible values: `GRN | Issue | Return | Transfer | Adjustment | Scrap`
Store module only writes `Issue` type.

---

## API Endpoints

---

### GET /api/store/rawmaterials

**Auth:** `requireAuth` (any logged-in user)
**Purpose:** Get all active raw materials with low-stock flag.

**Request:** No params, no body.

**SQL:**
```sql
SELECT m.id, m.name, m.code, m.unit,
       m.current_stock, m.min_stock, m.unit_price,
       mc.name AS categoryName,
       (m.current_stock <= m.min_stock) AS lowStock
FROM materials m
LEFT JOIN material_categories mc ON m.category_id = mc.id
WHERE m.is_active = true
ORDER BY mc.name, m.name
```

`lowStock` = true when `current_stock <= min_stock` (not `reorder_level` — uses `min_stock`).

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "Caustic Soda",
      "code": "RM001",
      "unit": "KG",
      "current_stock": "250.000",
      "min_stock": "100.000",
      "unit_price": "45.00",
      "categoryName": "Chemicals",
      "lowStock": false
    },
    {
      "id": 2,
      "name": "Alum",
      "code": "RM002",
      "unit": "KG",
      "current_stock": "50.000",
      "min_stock": "100.000",
      "unit_price": "12.00",
      "categoryName": "Chemicals",
      "lowStock": true
    }
  ]
}
```

**Note:** `current_stock`, `min_stock`, `unit_price` returned as strings — pg NUMERIC → JS string. Frontend must `parseFloat()` before arithmetic.

**Frontend use:** Populate material dropdown on issue form. Show red badge on rows where `lowStock = true`.

---

### GET /api/store/issues

**Auth:** `requireAuth`
**Purpose:** List issue requests with optional filters.

**Query params:**
| Param | Type | Description |
|-------|------|-------------|
| from | YYYY-MM-DD | Filter `issue_date >= from` |
| to | YYYY-MM-DD | Filter `issue_date <= to` |
| status | string | Filter by exact status: `Pending` / `Issued` / `Rejected` |

All params optional. No params → returns all records ordered by newest first, LIMIT 200.

**Filter logic (dynamic WHERE with parameterized values):**
```js
const { from, to, status } = req.query;
let where = ['1=1'];
const vals = [];
if (from)   { vals.push(from);   where.push(`si.issue_date >= $${vals.length}`) }
if (to)     { vals.push(to);     where.push(`si.issue_date <= $${vals.length}`) }
if (status) { vals.push(status); where.push(`si.status = $${vals.length}`) }
```

**SQL:**
```sql
SELECT si.*,
       m.name AS materialName, m.unit,
       d.name AS departmentName,
       u.name AS issuedByName
FROM store_issues si
LEFT JOIN materials m  ON si.material_id  = m.id
LEFT JOIN departments d ON si.department_id = d.id
LEFT JOIN users u      ON si.issued_by    = u.id
WHERE 1=1
  [AND si.issue_date >= $1]
  [AND si.issue_date <= $2]
  [AND si.status = $3]
ORDER BY si.created_at DESC
LIMIT 200
```

`approved_by` name NOT joined — only `issuedByName`. If you need approver name, add `LEFT JOIN users u2 ON si.approved_by = u2.id`.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 5,
      "issue_number": "SI-20260628-0001",
      "issue_date": "2026-06-28",
      "material_id": 1,
      "department_id": 3,
      "quantity": "10.000",
      "unit": "KG",
      "purpose": "Boiler cleaning",
      "issued_by": 4,
      "approved_by": null,
      "status": "Pending",
      "remarks": null,
      "created_at": "2026-06-28T10:30:00.000Z",
      "materialName": "Caustic Soda",
      "departmentName": "Boiler",
      "issuedByName": "Ravi Kumar"
    }
  ]
}
```

---

### POST /api/store/issues

**Auth:** `requireAuth` (any logged-in user can raise a request)
**Purpose:** Create new issue request. Status starts as `Pending`.

**Request body:**
```json
{
  "materialId": 1,
  "departmentId": 3,
  "quantity": 10,
  "purpose": "Boiler cleaning",
  "remarks": "Urgent"
}
```

| Field | Required | Type | DB Column |
|-------|----------|------|-----------|
| materialId | YES | integer | material_id |
| departmentId | YES | integer | department_id |
| quantity | YES | number > 0 | quantity NUMERIC(12,3) |
| purpose | YES | string | purpose TEXT |
| remarks | NO | string | remarks TEXT |

**Issue number generation — exact code:**
```js
const date = new Date();
const seq = await pool.query(
  `SELECT COUNT(*)+1 AS n FROM store_issues WHERE issue_date::date = CURRENT_DATE`
);
const pad = (n, l) => String(n).padStart(l, '0');
const num = `SI-${date.getFullYear()}${pad(date.getMonth()+1,2)}${pad(date.getDate(),2)}-${pad(seq.rows[0].n, 4)}`;
// Example: SI-20260628-0003
```

Sequence resets daily — counts issues for today only.
Race condition possible under parallel requests — not a concern for this app (single-user concurrent).

**Unit auto-fetch:**
```js
const mat = await pool.query('SELECT unit FROM materials WHERE id = $1', [materialId]);
const unit = mat.rows[0]?.unit;  // null if material not found
```
No validation if materialId not found — unit will be null. Frontend must send valid materialId.

**INSERT:**
```sql
INSERT INTO store_issues
  (issue_number, material_id, department_id, quantity, unit, purpose, issued_by, remarks)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
RETURNING id
```
- `issued_by` = `req.user.id` (server-set, not from body)
- `issue_date` = `CURRENT_DATE` (DB default)
- `status` = `'Pending'` (DB default)
- `approved_by` = NULL (set only on approve)

**Response:** Only id + issue number returned, not full row.
```json
{
  "success": true,
  "data": {
    "id": 5,
    "issueNumber": "SI-20260628-0001"
  }
}
```

**Error cases:**
| Scenario | HTTP | Response |
|----------|------|----------|
| DB error | 500 | `{ success: false, message: 'Server error' }` (via ar()) |

No explicit validation — if `materialId` or `departmentId` is invalid FK, Postgres throws FK violation → ar() catches → 500. Frontend must validate before sending.

---

### PUT /api/store/issues/:id/approve

**Auth:** `requireAuth` + `requireLevel(2)` — Supervisor+ only
**Purpose:** Approve pending issue. Deducts stock. Writes ledger entry. ACID transaction.

**Request:** No body needed.
**URL param:** `:id` = `store_issues.id`

**Full transaction — 5 steps:**

```js
const client = await pool.connect();
try {
  await client.query('BEGIN');

  // STEP 1: Fetch issue record
  const iss = await client.query('SELECT * FROM store_issues WHERE id=$1', [id]);
  if (!iss.rows[0]) throw new Error('Not found');
  const si = iss.rows[0];

  // STEP 2: Guard — only Pending can be approved
  if (si.status !== 'Pending') throw new Error('Already processed');

  // STEP 3: Stock sufficiency check
  const mat = await client.query(
    'SELECT current_stock FROM materials WHERE id=$1',
    [si.material_id]
  );
  if (parseFloat(mat.rows[0].current_stock) < parseFloat(si.quantity))
    throw new Error('Insufficient stock');

  // STEP 4a: Deduct from materials.current_stock
  await client.query(
    `UPDATE materials SET current_stock = current_stock - $1 WHERE id = $2`,
    [si.quantity, si.material_id]
  );

  // STEP 4b: Get last ledger balance for this material
  const bal = await client.query(
    'SELECT balance FROM stock_ledger WHERE material_id=$1 ORDER BY id DESC LIMIT 1',
    [si.material_id]
  );
  const prevBalance = parseFloat(bal.rows[0]?.balance || 0);
  const newBal = prevBalance - parseFloat(si.quantity);

  // STEP 4c: Insert ledger row
  await client.query(`
    INSERT INTO stock_ledger
      (material_id, transaction_type, reference_type, reference_id, out_qty, balance, remarks)
    VALUES ($1, 'Issue', 'StoreIssue', $2, $3, $4, 'Store issue')
  `, [si.material_id, si.id, si.quantity, newBal]);

  // STEP 5: Update issue status
  await client.query(
    `UPDATE store_issues SET status='Issued', approved_by=$1 WHERE id=$2`,
    [req.user.id, id]
  );

  await client.query('COMMIT');
  res.json({ success: true });

} catch(e) {
  await client.query('ROLLBACK');
  res.status(400).json({ success: false, message: e.message });  // 400 not 500
} finally {
  client.release();  // ALWAYS — even if throw
}
```

**Critical behavior:**
- Errors return **HTTP 400** with exact error message (not 500) — intentional, all errors here are business logic failures
- `balance` in ledger = running balance after deduction, not a recalculated total
- If material has no prior ledger rows → `prevBalance = 0` → `newBal = 0 - quantity` (goes negative — no guard)
- Both `materials.current_stock` and `stock_ledger` update in same transaction — if either fails, both roll back

**Response (success):**
```json
{ "success": true }
```

**Error responses (HTTP 400):**
```json
{ "success": false, "message": "Not found" }
{ "success": false, "message": "Already processed" }
{ "success": false, "message": "Insufficient stock" }
```

**State after approve:**
- `store_issues.status` = `'Issued'`
- `store_issues.approved_by` = approver's user id
- `materials.current_stock` reduced by `si.quantity`
- `stock_ledger` has new row: `transaction_type='Issue'`, `reference_type='StoreIssue'`, `reference_id=si.id`

---

### PUT /api/store/issues/:id/reject

**Auth:** `requireAuth` + `requireLevel(2)` — Supervisor+
**Purpose:** Reject pending issue. No stock change. No ledger entry.

**Request:** No body needed.
**URL param:** `:id` = `store_issues.id`

**SQL:**
```sql
UPDATE store_issues SET status='Rejected' WHERE id=$1
```

No status guard — can reject already-Issued records (route doesn't check). Frontend should hide reject button on non-Pending issues.

**Response:**
```json
{ "success": true }
```

**Error cases:**
| Scenario | HTTP | Response |
|----------|------|----------|
| DB error | 500 | `{ success: false, message: 'Server error' }` |

---

## State Machine

```
         CREATE
           │
           ▼
        Pending
        /     \
  APPROVE     REJECT
      │           │
      ▼           ▼
   Issued      Rejected
```

- `Pending → Issued`: stock deducted, ledger written, approved_by set
- `Pending → Rejected`: no stock change, no ledger, approved_by stays null
- `Issued → *`: no transition (route doesn't block, but should never happen in flow)
- `Rejected → *`: no transition

---

## Business Rules

1. Any authenticated user can CREATE an issue request
2. Only `role_level >= 2` (Supervisor+) can APPROVE or REJECT
3. `issued_by` = server-set from JWT — never trust body
4. `approved_by` = server-set on approve — never trust body
5. Stock check uses `parseFloat()` — pg returns NUMERIC as string
6. Balance in `stock_ledger` = last balance − quantity (not recalculated from scratch)
7. If material has never had a ledger entry → previous balance = 0 → new balance goes negative (no guard — DBA should seed initial balances via GRN entries)
8. Issue number sequence resets per day (`COUNT(*)+1 WHERE issue_date::date = CURRENT_DATE`)
9. `unit` is copied from `materials.unit` at create time — stored on issue record so future material edits don't break history
10. LIMIT 200 on list — no pagination. Date-filter to narrow results if needed.

---

## Frontend Integration

### Issue Form
```
Material dropdown  → GET /api/store/rawmaterials → show name + code + current_stock + unit
Department dropdown → GET /api/admin/departments
Quantity input     → number, enforce > 0
Purpose input      → text, required
Remarks input      → text, optional
```

### Issue List Page
```
Filter bar: from-date | to-date | status dropdown (All / Pending / Issued / Rejected)
Table columns:
  Issue # | Date | Material | Department | Qty | Unit | Purpose | Status | Requested By | Action

Action buttons (show by status):
  Pending  → [Approve] [Reject]   (only if role_level >= 2)
  Issued   → [View only]
  Rejected → [View only]
```

### Low Stock Alert
Materials where `lowStock = true` from `/api/store/rawmaterials`.
Show count on store module icon or dashboard card.

### After Approve
Refresh both:
- `/api/store/issues` (status changed to Issued)
- `/api/store/rawmaterials` (stock reduced)

---

## Error Handling Summary

| Endpoint | Possible errors | HTTP |
|----------|----------------|------|
| GET /rawmaterials | DB down | 500 |
| GET /issues | DB down | 500 |
| POST /issues | FK violation (bad materialId/deptId) | 500 |
| PUT /:id/approve | Not found | 400 |
| PUT /:id/approve | Already processed | 400 |
| PUT /:id/approve | Insufficient stock | 400 |
| PUT /:id/approve | DB error mid-transaction | 400 (ROLLBACK first) |
| PUT /:id/reject | DB down | 500 |
| Any | No/bad JWT token | 401 |
| Approve/Reject | role_level < 2 | 403 |

---
---

# PART B — PROPOSED: Indent → Permission → Issue → Progress

> **STATUS: design spec. Not coded yet.** Tables, routes, guards below must be built. Follow exact shapes.

## Big Idea

Old way: one user make "issue", supervisor approve, stock drop. All mushed together.

New way: split into 3 jobs, 3 different people:

```
1. DEPARTMENT  raise INDENT     ("we need 10kg caustic soda")
2. APPROVER    give PERMISSION  (approve or reject the indent)   ← the permission gate
3. STORE       do ISSUANCE      (store hand over material + log stock drop)   ← store only
4. ADMIN       watch PROGRESS   (see every step, who did what, when)
```

Department cannot drop stock. Only STORE drop stock + write ledger. Approver only say yes/no.
Admin see whole chain like tracking parcel.

---

## Workflow — Full State Machine

```
[Dept user] raise indent
        │
        ▼
   ┌──────────┐
   │ Requested│───[Requester] cancel (only here)──► Cancelled (end)
   └────┬─────┘
        │  [Approver level>=2]  PERMISSION GATE
        ├──── reject ──► Rejected (end, reason stored)
        │
        ▼  approve
   ┌──────────┐
   │ Approved │
   └────┬─────┘
        │  [STORE dept only]  ISSUANCE (deduct stock + ledger)
        │
        ├── issue full qty ─────────────► Issued
        │
        └── issue part qty ─────────────► Partially Issued
                                              │ issue rest later
                                              ▼
                                           Issued
        │
        ▼  [Dept user] acknowledge got material
     Closed (end)
```

Every arrow = one row written to `store_indent_log`. That log = admin progress feed.

Status set (7):
`Requested | Approved | Rejected | Partially Issued | Issued | Closed | Cancelled`

---

## New Tables (add to a new migration: `db/migration_store_indents.sql`)

### store_indents
```sql
CREATE TABLE IF NOT EXISTS store_indents (
  id             SERIAL PRIMARY KEY,
  indent_number  VARCHAR(30) UNIQUE,              -- INDT-YYYYMMDD-NNNN
  indent_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  department_id  INTEGER REFERENCES departments(id),   -- requesting dept
  material_id    INTEGER REFERENCES materials(id),
  qty_requested  NUMERIC(12,3) NOT NULL,
  qty_issued     NUMERIC(12,3) DEFAULT 0,          -- store fills on issue (cumulative)
  unit           VARCHAR(20),                      -- copied from materials.unit
  purpose        TEXT,
  priority       VARCHAR(20) DEFAULT 'Normal',     -- Low | Normal | High | Urgent
  status         VARCHAR(20) DEFAULT 'Requested',
       -- Requested | Approved | Rejected | Partially Issued | Issued | Closed | Cancelled
  requested_by   INTEGER REFERENCES users(id),     -- req.user.id on create
  approved_by    INTEGER REFERENCES users(id),     -- set on approve
  approved_at    TIMESTAMP,
  issued_by      INTEGER REFERENCES users(id),     -- STORE user, set on issue
  issued_at      TIMESTAMP,
  closed_by      INTEGER REFERENCES users(id),     -- dept user, set on close
  closed_at      TIMESTAMP,
  reject_reason  TEXT,
  remarks        TEXT,
  created_at     TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_store_indents_status ON store_indents(status);
CREATE INDEX IF NOT EXISTS idx_store_indents_dept   ON store_indents(department_id);
CREATE INDEX IF NOT EXISTS idx_store_indents_date   ON store_indents(indent_date);
```

### store_indent_log  (the progress timeline — admin reads this)
```sql
CREATE TABLE IF NOT EXISTS store_indent_log (
  id          SERIAL PRIMARY KEY,
  indent_id   INTEGER REFERENCES store_indents(id) ON DELETE CASCADE,
  action      VARCHAR(30),    -- Raised | Approved | Rejected | Issued | PartIssued | Closed | Cancelled
  from_status VARCHAR(20),
  to_status   VARCHAR(20),
  actor_id    INTEGER REFERENCES users(id),
  actor_name  VARCHAR(100),   -- snapshot, so log survives user edits
  actor_role  VARCHAR(50),    -- snapshot of role at action time
  qty         NUMERIC(12,3),  -- qty issued (only on issue actions), else null
  note        TEXT,
  created_at  TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_indent_log_indent ON store_indent_log(indent_id);
CREATE INDEX IF NOT EXISTS idx_indent_log_created ON store_indent_log(created_at);
```

**Rule:** every state change writes ONE log row, inside the SAME transaction as the change. Log row never written alone. No state change without log row. This guarantee = admin always see true history.

---

## Permission Model (who can do what)

| Action | Who | Guard |
|--------|-----|-------|
| Raise indent | any logged-in user | `requireAuth` |
| Cancel own indent (Requested only) | requester | `requireAuth` + ownership check |
| Approve / Reject (PERMISSION GATE) | Supervisor+ | `requireAuth` + `requireLevel(2)` |
| **Issue material (STORE ONLY)** | Store dept staff | `requireAuth` + `requireStore` (new guard) |
| Close / acknowledge | requesting dept user | `requireAuth` |
| View progress of one indent | any logged-in user | `requireAuth` |
| View ALL indents progress feed | Admin / PlantHead | `requireAuth` + `requireLevel(4)` |

### New guard: `requireStore` (add to auth.js)
Issuance is store-only. Level alone not enough — must be STORE department OR Admin.

```js
// backend/src/middleware/auth.js  — add and export
const requireStore = (req, res, next) => {
  // Admin (level 5) always allowed. Otherwise must be Store department.
  if (req.user.role_level >= 5) return next();
  if (req.user.dept_code === 'STORE') return next();
  return res.status(403).json({ success: false, message: 'Store staff only' });
};
module.exports = { auth, requireLevel, requireStore };
```
Then in helpers.js re-export it:
```js
const { auth: requireAuth, requireLevel, requireStore } = require('./auth');
module.exports = { pool, requireAuth, requireLevel, requireStore, ar };
```
Needs a `STORE` department row (departments.code = 'STORE') and store staff users assigned to it.

---

## New Endpoints (mount under `/api/store`)

| Method | Path | Guard | Job |
|--------|------|-------|-----|
| POST | `/indents` | requireAuth | Dept raise indent |
| GET | `/indents` | requireAuth | List indents (filters) |
| GET | `/indents/:id` | requireAuth | One indent + full progress log |
| PUT | `/indents/:id/approve` | requireLevel(2) | Permission gate — grant |
| PUT | `/indents/:id/reject` | requireLevel(2) | Permission gate — deny |
| PUT | `/indents/:id/issue` | requireStore | STORE issue + deduct + ledger + log |
| PUT | `/indents/:id/close` | requireAuth | Dept acknowledge receipt |
| PUT | `/indents/:id/cancel` | requireAuth | Requester cancel (Requested only) |
| GET | `/indents/:id/progress` | requireAuth | Timeline of one indent |
| GET | `/admin/progress` | requireLevel(4) | Admin: all indents live feed |

---

### POST /api/store/indents  — Department raises indent

**Body:**
```json
{
  "materialId": 1,
  "departmentId": 3,
  "qtyRequested": 10,
  "purpose": "Boiler descaling",
  "priority": "High",
  "remarks": "Need before night shift"
}
```

**Logic:**
1. Generate `indent_number`: `INDT-YYYYMMDD-NNNN` (same daily-sequence pattern as SI)
2. Copy `unit` from `materials.unit`
3. INSERT indent, `status='Requested'`, `requested_by=req.user.id`
4. INSERT log row: `action='Raised'`, `from_status=NULL`, `to_status='Requested'`, actor = req.user

All in ONE transaction (indent + first log row together).

**Response:**
```json
{ "success": true, "data": { "id": 12, "indentNumber": "INDT-20260628-0001", "status": "Requested" } }
```

---

### PUT /api/store/indents/:id/approve  — PERMISSION GATE (grant)

**Guard:** `requireLevel(2)`
**No stock change here.** Approver only grant permission.

**Transaction:**
```js
const client = await pool.connect();
try {
  await client.query('BEGIN');
  const r = await client.query('SELECT * FROM store_indents WHERE id=$1 FOR UPDATE', [id]);
  const ind = r.rows[0];
  if (!ind) throw new Error('Not found');
  if (ind.status !== 'Requested') throw new Error('Only Requested indent can be approved');

  await client.query(
    `UPDATE store_indents SET status='Approved', approved_by=$1, approved_at=NOW() WHERE id=$2`,
    [req.user.id, id]
  );
  await client.query(`
    INSERT INTO store_indent_log (indent_id, action, from_status, to_status, actor_id, actor_name, actor_role, note)
    VALUES ($1,'Approved','Requested','Approved',$2,$3,$4,$5)
  `, [id, req.user.id, req.user.name, req.user.role, req.body.note || null]);

  await client.query('COMMIT');
  res.json({ success: true });
} catch(e) {
  await client.query('ROLLBACK');
  res.status(400).json({ success: false, message: e.message });
} finally { client.release(); }
```

`FOR UPDATE` lock — stop two approvers double-processing same indent.

---

### PUT /api/store/indents/:id/reject  — PERMISSION GATE (deny)

**Guard:** `requireLevel(2)`
**Body:** `{ "reason": "Stock reserved for PM2" }`

- Guard: `status='Requested'` only
- `UPDATE ... SET status='Rejected', reject_reason=$reason, approved_by=req.user.id, approved_at=NOW()`
- Log row: `action='Rejected'`, `to_status='Rejected'`, note = reason
- No stock change.

---

### PUT /api/store/indents/:id/issue  — STORE ONLY (the issuance + logging)

**Guard:** `requireStore`
**This is the ONLY place stock drops.** Store hand over material, system log it.
**Body:** `{ "qtyIssued": 10, "note": "Handed to Ravi" }`  (qtyIssued ≤ qty_requested − qty_issued)

**Transaction (full):**
```js
const client = await pool.connect();
try {
  await client.query('BEGIN');

  // 1. lock indent
  const r = await client.query('SELECT * FROM store_indents WHERE id=$1 FOR UPDATE', [id]);
  const ind = r.rows[0];
  if (!ind) throw new Error('Not found');
  if (!['Approved','Partially Issued'].includes(ind.status))
    throw new Error('Indent must be Approved before issue');

  // 2. validate qty
  const qty = parseFloat(req.body.qtyIssued);
  const remaining = parseFloat(ind.qty_requested) - parseFloat(ind.qty_issued);
  if (!(qty > 0)) throw new Error('Qty must be > 0');
  if (qty > remaining) throw new Error(`Only ${remaining} ${ind.unit} remaining to issue`);

  // 3. stock check
  const mat = await client.query('SELECT current_stock FROM materials WHERE id=$1', [ind.material_id]);
  if (parseFloat(mat.rows[0].current_stock) < qty) throw new Error('Insufficient stock');

  // 4. deduct stock
  await client.query('UPDATE materials SET current_stock = current_stock - $1 WHERE id=$2',
    [qty, ind.material_id]);

  // 5. ledger row (running balance)
  const bal = await client.query(
    'SELECT balance FROM stock_ledger WHERE material_id=$1 ORDER BY id DESC LIMIT 1',
    [ind.material_id]);
  const newBal = parseFloat(bal.rows[0]?.balance || 0) - qty;
  await client.query(`
    INSERT INTO stock_ledger
      (material_id, transaction_type, reference_type, reference_id, out_qty, balance, remarks)
    VALUES ($1,'Issue','StoreIndent',$2,$3,$4,'Indent issue')
  `, [ind.material_id, ind.id, qty, newBal]);

  // 6. update indent qty + status
  const newIssued = parseFloat(ind.qty_issued) + qty;
  const fullyDone = newIssued >= parseFloat(ind.qty_requested);
  const newStatus = fullyDone ? 'Issued' : 'Partially Issued';
  await client.query(`
    UPDATE store_indents
    SET qty_issued=$1, status=$2, issued_by=$3, issued_at=NOW()
    WHERE id=$4
  `, [newIssued, newStatus, req.user.id, id]);

  // 7. progress log
  await client.query(`
    INSERT INTO store_indent_log
      (indent_id, action, from_status, to_status, actor_id, actor_name, actor_role, qty, note)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
  `, [id, fullyDone ? 'Issued' : 'PartIssued', ind.status, newStatus,
      req.user.id, req.user.name, req.user.role, qty, req.body.note || null]);

  await client.query('COMMIT');
  res.json({ success: true, data: { status: newStatus, qtyIssued: newIssued } });
} catch(e) {
  await client.query('ROLLBACK');
  res.status(400).json({ success: false, message: e.message });
} finally { client.release(); }
```

**Why only store:** `requireStore` guard. Approver (Supervisor/Manager) gives permission but CANNOT issue unless also Store dept. Keeps physical custody honest — different hand approves vs hands-over.

**Partial issue:** store gives what available now → `Partially Issued`. Issue rest later → `Issued`. Each issue = own ledger row + own log row.

---

### PUT /api/store/indents/:id/close  — dept acknowledge

**Guard:** `requireAuth`
- Guard: `status='Issued'`
- `UPDATE ... SET status='Closed', closed_by=req.user.id, closed_at=NOW()`
- Log: `action='Closed'`, `to_status='Closed'`

---

### PUT /api/store/indents/:id/cancel  — requester pull back

**Guard:** `requireAuth` + ownership (`requested_by = req.user.id`) OR level 4+
- Guard: `status='Requested'` only (cannot cancel after permission granted)
- `UPDATE ... SET status='Cancelled'`
- Log: `action='Cancelled'`, `to_status='Cancelled'`

---

### GET /api/store/indents/:id/progress  — one indent timeline

```sql
SELECT action, from_status, to_status, actor_name, actor_role, qty, note, created_at
FROM store_indent_log
WHERE indent_id = $1
ORDER BY created_at ASC
```

**Response (the progress steps admin/user see):**
```json
{
  "success": true,
  "data": {
    "indent": { "indentNumber": "INDT-20260628-0001", "status": "Issued",
                "qtyRequested": 10, "qtyIssued": 10, "materialName": "Caustic Soda" },
    "timeline": [
      { "step": 1, "action": "Raised",   "to_status": "Requested", "actor_name": "Ravi (Boiler)",  "created_at": "...10:00" },
      { "step": 2, "action": "Approved", "to_status": "Approved",  "actor_name": "Suresh (Supervisor)", "note": "OK", "created_at": "...10:15" },
      { "step": 3, "action": "Issued",   "to_status": "Issued",    "actor_name": "Mohan (Store)", "qty": 10, "created_at": "...10:40" }
    ]
  }
}
```

---

### GET /api/store/admin/progress  — ADMIN live feed of all indents

**Guard:** `requireLevel(4)` — PlantHead / Admin
**Params:** `?status=&department_id=&from=&to=`

Admin see every indent + current stage + last action, like control tower.

```sql
SELECT i.id, i.indent_number, i.indent_date, i.status, i.priority,
       i.qty_requested, i.qty_issued, i.unit,
       m.name AS materialName,
       d.name AS departmentName,
       ru.name AS requestedBy,
       au.name AS approvedBy,
       iu.name AS issuedBy,
       -- newest log line as "current step"
       (SELECT l.action || ' by ' || l.actor_name
          FROM store_indent_log l
         WHERE l.indent_id = i.id
         ORDER BY l.created_at DESC LIMIT 1) AS lastStep,
       (SELECT l.created_at FROM store_indent_log l
         WHERE l.indent_id = i.id ORDER BY l.created_at DESC LIMIT 1) AS lastStepAt
FROM store_indents i
LEFT JOIN materials m  ON i.material_id  = m.id
LEFT JOIN departments d ON i.department_id = d.id
LEFT JOIN users ru ON i.requested_by = ru.id
LEFT JOIN users au ON i.approved_by  = au.id
LEFT JOIN users iu ON i.issued_by    = iu.id
WHERE 1=1 [AND i.status=$N] [AND i.department_id=$N] [AND i.indent_date BETWEEN $N AND $N]
ORDER BY i.created_at DESC
LIMIT 200
```

Also return a stage-count summary for dashboard cards:
```sql
SELECT status, COUNT(*) AS count FROM store_indents GROUP BY status
```
```json
{
  "data": {
    "indents": [ ... ],
    "summary": {
      "Requested": 4, "Approved": 2, "Partially Issued": 1,
      "Issued": 8, "Closed": 20, "Rejected": 1, "Cancelled": 0
    }
  }
}
```

---

## Business Rules (Part B)

1. **Three hands, three jobs.** Dept raises. Approver permits. Store issues. Never same step.
2. **Only STORE drops stock.** `requireStore` guard on `/issue`. Approver permission ≠ permission to issue.
3. **Permission gate is mandatory.** Indent MUST be `Approved` before any issue. Cannot skip.
4. **Every step logged.** No status change without a `store_indent_log` row in same transaction. Admin progress depends on it — never bypass.
5. **Log snapshots actor name + role** — so history stays true even if user renamed/role-changed later.
6. **`FOR UPDATE` lock** on indent in approve/reject/issue — block double-processing.
7. **Partial issue allowed** — `qty_issued` accumulates; status `Partially Issued` until full, then `Issued`.
8. **Cancel only before approval.** After permission granted, requester cannot pull back — must go through reject (by approver) or full flow.
9. **Stock can go negative guard** — issue checks `current_stock >= qty` first. Reject if short. (Different from Part A old approve which also checked but ledger balance still could go negative if no seed — seed via GRN.)
10. **Indent number** `INDT-YYYYMMDD-NNNN`, daily sequence, distinct from `SI-` (Part A) and `IND` finance prefix in system_settings.

---

## Build Checklist (for dev)

- [ ] `db/migration_store_indents.sql` — create `store_indents` + `store_indent_log` + indexes
- [x] `STORE` department already seeded (schema.sql, code='STORE'). `INDENT` department also exists. Just assign store staff users to STORE dept.
- [ ] `auth.js` — add + export `requireStore`
- [ ] `helpers.js` — re-export `requireStore`
- [ ] `store.js` — add 10 indent routes above
- [ ] Wrap every state-change route in transaction (indent UPDATE + log INSERT together)
- [ ] Frontend: Indent form (dept), Approval inbox (approver), Issue desk (store), Progress timeline view (all), Admin control-tower feed (level 4+)
- [ ] Keep Part A issue routes as-is OR migrate old `/issues` to new indent flow (decide with client)
