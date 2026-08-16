# Departments, Logins & Approvers

> **STATUS: design spec.** Categories + per-department logins + approver chain + admin footstep view.
> Base tables (`departments`, `roles`, `users`, `audit_log`) already exist. New = `departments.category` column, seed logins, approver mapping.

20 departments today (schema.sql). 5 role levels. Now: group them, give each its own login, set who approves, let admin watch every footstep.

---

## 1. Department Categories (group 20 into 6 clusters)

| # | Category | Departments (code) |
|---|----------|--------------------|
| A | **Production & Operations** | Production (PROD), Utility (UTIL), Maintenance (MAINT) |
| B | **Materials & Stores** | Raw Material Store (RMS), Inventory (INV), Store Management (STORE), Indent Management (INDENT), Packing (PACK), Finished Goods Warehouse (FGW) |
| C | **Quality & Lab** | Quality (QC), Laboratory (LAB) |
| D | **Supply Chain** | Purchase (PUR), Sales (SALES), Dispatch (DISP) |
| E | **Commercial & Admin** | Finance (FIN), HR & Payroll (HR), Administration (ADMIN) |
| F | **Safety & Compliance** | EHS (EHS), Security (SEC), Scrap Management (SCRAP) |

Count: A=3, B=6, C=2, D=3, E=3, F=3 = **20**. All covered.

### Migration — add category column
```sql
-- db/migration_dept_categories.sql
ALTER TABLE departments ADD COLUMN IF NOT EXISTS category VARCHAR(40);

UPDATE departments SET category='Production & Operations' WHERE code IN ('PROD','UTIL','MAINT');
UPDATE departments SET category='Materials & Stores'      WHERE code IN ('RMS','INV','STORE','INDENT','PACK','FGW');
UPDATE departments SET category='Quality & Lab'           WHERE code IN ('QC','LAB');
UPDATE departments SET category='Supply Chain'            WHERE code IN ('PUR','SALES','DISP');
UPDATE departments SET category='Commercial & Admin'      WHERE code IN ('FIN','HR','ADMIN');
UPDATE departments SET category='Safety & Compliance'     WHERE code IN ('EHS','SEC','SCRAP');
```

Now query departments grouped:
```sql
SELECT category, COUNT(*) AS depts, STRING_AGG(code, ', ') AS codes
FROM departments GROUP BY category ORDER BY category;
```

---

## 2. Role Levels (recap — already seeded)

| Level | Role | Permissions JSONB |
|-------|------|-------------------|
| 1 | Operator | view, entry |
| 2 | Shift Supervisor | + approve_l1 |
| 3 | Manager | + approve_l2 |
| 4 | Plant Head | + approve_l3 |
| 5 | Admin | + manage_users, manage_system |

Login lives in `users` table: `email`, `password_hash` (bcrypt), `role_id`, `department_id`, `shift`.

---

## 3. Logins — Separate Per Department

**Rule:** every department gets its own logins. One person, one login, tied to ONE `department_id` + ONE `role_id`.

### Email convention
```
<role>.<deptcode>@mkpapermill.com   (lowercase)

head.prod@mkpapermill.com     → Production Department Head (Manager L3)
spv.prod@mkpapermill.com      → Production Supervisor (L2)
op.prod@mkpapermill.com       → Production Operator (L1)
head.store@mkpapermill.com    → Store Department Head
store@mkpapermill.com         → Store issue desk login (issues material)
planthead@mkpapermill.com     → Plant Head (L4, org-wide)
admin@mkpapermill.com         → Admin (L5, already exists)
```

### Each department gets (minimum)
| Login | Role level | Job |
|-------|-----------|-----|
| 1 Department Head | 3 (Manager) | approves own dept work, the L1 approver |
| 1+ Supervisor | 2 | day-to-day approve, entry |
| 1+ Operator | 1 | data entry only |

Org-wide (not tied to one dept's work):
| Login | Level | Dept |
|-------|-------|------|
| Plant Head | 4 | Administration |
| Admin | 5 | Administration (exists) |

### Seed SQL — 20 department heads (one per dept)
Department ids = insert order in schema.sql (1=PROD … 20=FGW).
`role_id=3` = Manager. Password = bcrypt of `Head@1234` (replace placeholder hash).

```sql
-- db/seed_department_heads.sql
-- password_hash below must be bcrypt('Head@1234'); generate once, paste.
INSERT INTO users (employee_code, name, email, mobile, password_hash, role_id, department_id) VALUES
 ('DH-PROD',  'Head - Production',        'head.prod@mkpapermill.com',   '9000000001', '$BCRYPT$', 3, 1),
 ('DH-RMS',   'Head - Raw Material Store','head.rms@mkpapermill.com',    '9000000002', '$BCRYPT$', 3, 2),
 ('DH-INV',   'Head - Inventory',         'head.inv@mkpapermill.com',    '9000000003', '$BCRYPT$', 3, 3),
 ('DH-STORE', 'Head - Store Management',  'head.store@mkpapermill.com',  '9000000004', '$BCRYPT$', 3, 4),
 ('DH-INDENT','Head - Indent Management', 'head.indent@mkpapermill.com', '9000000005', '$BCRYPT$', 3, 5),
 ('DH-PUR',   'Head - Purchase',          'head.pur@mkpapermill.com',    '9000000006', '$BCRYPT$', 3, 6),
 ('DH-QC',    'Head - Quality',           'head.qc@mkpapermill.com',     '9000000007', '$BCRYPT$', 3, 7),
 ('DH-MAINT', 'Head - Maintenance',       'head.maint@mkpapermill.com',  '9000000008', '$BCRYPT$', 3, 8),
 ('DH-UTIL',  'Head - Utility',           'head.util@mkpapermill.com',   '9000000009', '$BCRYPT$', 3, 9),
 ('DH-DISP',  'Head - Dispatch',          'head.disp@mkpapermill.com',   '9000000010', '$BCRYPT$', 3, 10),
 ('DH-SALES', 'Head - Sales',             'head.sales@mkpapermill.com',  '9000000011', '$BCRYPT$', 3, 11),
 ('DH-HR',    'Head - HR & Payroll',      'head.hr@mkpapermill.com',     '9000000012', '$BCRYPT$', 3, 12),
 ('DH-SEC',   'Head - Security',          'head.sec@mkpapermill.com',    '9000000013', '$BCRYPT$', 3, 13),
 ('DH-LAB',   'Head - Laboratory',        'head.lab@mkpapermill.com',    '9000000014', '$BCRYPT$', 3, 14),
 ('DH-FIN',   'Head - Finance',           'head.fin@mkpapermill.com',    '9000000015', '$BCRYPT$', 3, 15),
 ('DH-ADMIN', 'Head - Administration',    'head.admin@mkpapermill.com',  '9000000016', '$BCRYPT$', 3, 16),
 ('DH-EHS',   'Head - EHS',               'head.ehs@mkpapermill.com',    '9000000017', '$BCRYPT$', 3, 17),
 ('DH-SCRAP', 'Head - Scrap Management',  'head.scrap@mkpapermill.com',  '9000000018', '$BCRYPT$', 3, 18),
 ('DH-PACK',  'Head - Packing',           'head.pack@mkpapermill.com',   '9000000019', '$BCRYPT$', 3, 19),
 ('DH-FGW',   'Head - Finished Goods WH', 'head.fgw@mkpapermill.com',    '9000000020', '$BCRYPT$', 3, 20)
ON CONFLICT (email) DO NOTHING;

-- Plant Head (org-wide L4)
INSERT INTO users (employee_code, name, email, mobile, password_hash, role_id, department_id)
VALUES ('PH-001','Plant Head','planthead@mkpapermill.com','9000000099','$BCRYPT$',4,16)
ON CONFLICT (email) DO NOTHING;

-- Store issue desk login (Store dept, L2) — does the issuance
INSERT INTO users (employee_code, name, email, mobile, password_hash, role_id, department_id)
VALUES ('STORE-DESK','Store Issue Desk','store@mkpapermill.com','9000000004','$BCRYPT$',2,4)
ON CONFLICT (email) DO NOTHING;
```

Generate bcrypt hash:
```bash
node -e "console.log(require('bcrypt').hashSync('Head@1234',10))"
```

Operators/Supervisors per dept → create via HR module (`POST /api/hr/employees` then create login), not seeded here. Each gets `department_id` of their dept.

---

## 4. Approver Hierarchy

Two tiers. Who gives permission depends on WHAT and HOW BIG.

```
        DEPARTMENT WORK (indent, issue, entry)
                    │
            ┌───────▼────────┐
   L1       │ DEPARTMENT HEAD │   ← Manager (level 3) of that department
 approval   │   MANAGER       │     approves own dept's requests
            └───────┬────────┘
                    │ if value/qty above threshold
            ┌───────▼────────┐
   L2       │  PLANT HEAD     │   ← level 4, MAIN APPROVER, org-wide
 approval   │ (main approver) │     escalation + cross-department
            └───────┬────────┘
                    │
            ┌───────▼────────┐
            │     ADMIN       │   ← level 5, sees all, final authority
            └────────────────┘
```

### Who approves what
| Work | L1 approver (dept head) | L2 / main approver |
|------|------------------------|--------------------|
| Store indent (normal) | Requesting dept's Head Manager | — |
| Store indent (high value/qty) | Dept Head Manager | Plant Head |
| Purchase indent → PO | Purchase Head | Plant Head (above limit) |
| Leave / attendance | HR Head | Plant Head |
| Scrap disposal | Scrap Head | Plant Head (if sale) |
| EHS incident closure | EHS Head | Plant Head (High/Critical) |
| System settings change | — | Admin only (L5) |

**Main approvers** = Plant Head (L4) + Admin (L5). They can approve anything any department.
**Department Head Managers** = the 20 Manager (L3) logins, one per dept. Each approves only own department's work (`req.user.department_id` must match).

### Threshold table (system_settings — configurable)
| Key | Default | Meaning |
|-----|---------|---------|
| approval_threshold_value | 50000 | above ₹50k → needs Plant Head L2 |
| approval_threshold_qty | 1000 | above 1000 units → needs Plant Head L2 |

Add these keys to `system_settings` seed.

---

## 5. Admin Sees Every Footstep

Two log sources. Admin reads both.

### (a) store_indent_log — per-indent timeline (from doc 18, Part B)
Every indent step: Raised → Approved → Issued → Closed. Already designed.

### (b) audit_log — global footstep log (table already in schema.sql)
```
audit_log:
  id, user_id, module, action, entity_type, entity_id,
  old_value JSONB, new_value JSONB, ip_address, created_at
```
Indexes: `audit_log(user_id)`, `audit_log(module, created_at)`.

**Rule:** every write action (create/update/approve/reject/issue/delete) across ALL modules inserts one `audit_log` row. Helper:

```js
// backend/src/middleware/helpers.js — add audit() helper
async function audit(client, { userId, module, action, entityType, entityId, oldVal, newVal, ip }) {
  await (client || pool).query(`
    INSERT INTO audit_log (user_id, module, action, entity_type, entity_id, old_value, new_value, ip_address)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
  `, [userId, module, action, entityType, entityId,
      oldVal ? JSON.stringify(oldVal) : null,
      newVal ? JSON.stringify(newVal) : null, ip || null]);
}
module.exports = { pool, requireAuth, requireLevel, requireStore, ar, audit };
```
Pass `client` when inside a transaction so audit row commits/rolls back with the change.

### Admin footstep endpoints
| Method | Path | Guard | Shows |
|--------|------|-------|-------|
| GET | `/api/admin/footsteps` | requireLevel(4) | global audit_log feed, all modules |
| GET | `/api/admin/footsteps/user/:id` | requireLevel(4) | one user's every action |
| GET | `/api/admin/footsteps/department/:id` | requireLevel(4) | all actions by users of one dept |
| GET | `/api/admin/approvers` | requireLevel(4) | list dept heads + main approvers + what each approved |

**Global footstep feed:**
```sql
SELECT al.id, al.module, al.action, al.entity_type, al.entity_id,
       al.created_at,
       u.name AS userName, u.email,
       r.name AS roleName, r.level AS roleLevel,
       d.name AS departmentName, d.category AS departmentCategory
FROM audit_log al
LEFT JOIN users u       ON al.user_id = u.id
LEFT JOIN roles r       ON u.role_id = r.id
LEFT JOIN departments d ON u.department_id = d.id
WHERE 1=1
  [AND al.module=$N] [AND u.department_id=$N] [AND al.created_at BETWEEN $N AND $N]
ORDER BY al.created_at DESC
LIMIT 300
```

**Approvers view — who are the gatekeepers + their activity:**
```sql
SELECT u.id, u.name, u.email,
       r.name AS roleName, r.level AS roleLevel,
       d.name AS departmentName, d.category,
       CASE WHEN r.level >= 4 THEN 'Main Approver'
            WHEN r.level = 3  THEN 'Department Head Manager'
            ELSE 'Staff' END AS approverType,
       COUNT(al.id) FILTER (WHERE al.action IN ('approve','reject','issue')) AS approval_actions
FROM users u
JOIN roles r ON u.role_id = r.id
LEFT JOIN departments d ON u.department_id = d.id
LEFT JOIN audit_log al ON al.user_id = u.id
WHERE u.is_active = true AND r.level >= 3
GROUP BY u.id, u.name, u.email, r.name, r.level, d.name, d.category
ORDER BY r.level DESC, d.name
```

Returns: every Department Head Manager (L3) + Main Approver (L4/L5), with how many approve/reject/issue actions each did. Admin control tower.

**Response shape:**
```json
{
  "success": true,
  "data": {
    "mainApprovers": [
      { "name": "Plant Head", "roleLevel": 4, "approverType": "Main Approver", "approval_actions": 42 },
      { "name": "Admin", "roleLevel": 5, "approverType": "Main Approver", "approval_actions": 8 }
    ],
    "departmentHeads": [
      { "name": "Head - Store Management", "department": "Store Management", "category": "Materials & Stores", "approval_actions": 31 },
      { "name": "Head - Production", "department": "Production", "category": "Production & Operations", "approval_actions": 27 }
    ]
  }
}
```

---

## 6. Permission Matrix (by category)

| Category | Operator L1 | Supervisor L2 | Dept Head Mgr L3 | Plant Head L4 | Admin L5 |
|----------|:---:|:---:|:---:|:---:|:---:|
| Production & Operations | entry | approve entry | approve dept | approve all | all |
| Materials & Stores | raise indent | issue (STORE only) | approve indent | approve high-value | all |
| Quality & Lab | record test | approve result | approve dept | — | all |
| Supply Chain | entry | approve | approve PO/SO | approve above limit | all |
| Commercial & Admin | entry | — | approve dept | finance approve | settings, users |
| Safety & Compliance | report incident | approve | close incident | approve High/Critical | all |

**Hard rules:**
- Dept Head Manager approves ONLY own department (`req.user.department_id` match)
- Plant Head + Admin = main approvers, any department
- Store issuance = STORE dept only (`requireStore` guard, doc 18)
- System settings write = Admin (L5) only

---

## 7. Build Checklist

- [ ] `db/migration_dept_categories.sql` — add `departments.category` + UPDATE 6 groups
- [ ] `db/seed_department_heads.sql` — 20 dept head logins + Plant Head + Store desk (bcrypt passwords)
- [ ] Add `approval_threshold_value` + `approval_threshold_qty` to `system_settings` seed
- [ ] `helpers.js` — add `audit()` helper, export it
- [ ] Call `audit()` on every write across all route files (pass transaction client when in BEGIN/COMMIT)
- [ ] `admin.js` — add 4 footstep/approver endpoints
- [ ] Dept-head approval guard: check `req.user.department_id` matches the record's department (unless level>=4)
- [ ] Frontend: dept-grouped login dashboard, Admin footstep feed page, Approvers control-tower page
- [ ] Force password change on first login for all seeded `Head@1234` accounts

---

## 8. Indent Tab Visibility (implemented)

| Tab | Who sees |
|-----|----------|
| 📋 Indents | Everyone — dept heads see own dept only; Store/Admin see all |
| ➕ Raise | Everyone (L1+) |
| ✅ Approve | Store Head (STORE dept, L3) + Admin/PlantHead (L4+) |
| 📦 Issue | Store dept only (any level) |
| 🤝 Acknowledge | All dept heads (L3+) |
| 📊 Analytics | Admin + Plant Head (L4+) |
| 📅 Calendar | All managers (L3+) |

Approval chain: **Raised → Store Head L1 → Admin/PlantHead L2 → Approved → Store issues → HOD acks → Closed**
