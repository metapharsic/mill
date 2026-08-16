# Users, Credentials, Roles & Responsibilities

> **STATUS: design spec + seed credentials.** Login sheet, keen role duties per user, admin-assigns-users flow.
> Base `users`/`roles`/`departments` tables already exist. New = seed logins + admin user-management endpoints.

---

> **SECURITY WARNING — read before deploy.**
> The passwords below are *default seed passwords* for first login only. They are intentionally simple so the team can get in. Before any production / VPS deployment you MUST:
> 1. Force a password change on first login for every account.
> 2. Rotate the `admin` and `planthead` passwords to strong unique values.
> 3. Never commit real production password hashes to git.
> Passwords here are stored as bcrypt hashes (cost 10), never plain text.

---

## 1. Credential Sheet (default seed logins)

All emails `@mkpapermill.com`. All default passwords must be changed on first login.

### Org-wide
| # | Name | Email (login) | Password | Role | Level | Department |
|---|------|---------------|----------|------|-------|-----------|
| 1 | Admin | admin@mkpapermill.com | `Admin@1234` | Admin | 5 | Administration |
| 2 | Plant Head | planthead@mkpapermill.com | `Plant@1234` | Plant Head | 4 | Administration |

### Department Heads (Manager L3 — one per department)
| # | Name | Email (login) | Password | Dept | Dept ID |
|---|------|---------------|----------|------|:------:|
| 3 | Head - Production | head.prod@mkpapermill.com | `Head@1234` | Production | 1 |
| 4 | Head - Raw Material Store | head.rms@mkpapermill.com | `Head@1234` | Raw Material Store | 2 |
| 5 | Head - Inventory | head.inv@mkpapermill.com | `Head@1234` | Inventory | 3 |
| 6 | Head - Store Management | head.store@mkpapermill.com | `Head@1234` | Store Management | 4 |
| 7 | Head - Indent Management | head.indent@mkpapermill.com | `Head@1234` | Indent Management | 5 |
| 8 | Head - Purchase | head.pur@mkpapermill.com | `Head@1234` | Purchase | 6 |
| 9 | Head - Quality | head.qc@mkpapermill.com | `Head@1234` | Quality | 7 |
| 10 | Head - Maintenance | head.maint@mkpapermill.com | `Head@1234` | Maintenance | 8 |
| 11 | Head - Utility | head.util@mkpapermill.com | `Head@1234` | Utility | 9 |
| 12 | Head - Dispatch | head.disp@mkpapermill.com | `Head@1234` | Dispatch | 10 |
| 13 | Head - Sales | head.sales@mkpapermill.com | `Head@1234` | Sales | 11 |
| 14 | Head - HR & Payroll | head.hr@mkpapermill.com | `Head@1234` | HR & Payroll | 12 |
| 15 | Head - Security | head.sec@mkpapermill.com | `Head@1234` | Security | 13 |
| 16 | Head - Laboratory | head.lab@mkpapermill.com | `Head@1234` | Laboratory | 14 |
| 17 | Head - Finance | head.fin@mkpapermill.com | `Head@1234` | Finance | 15 |
| 18 | Head - Administration | head.admin@mkpapermill.com | `Head@1234` | Administration | 16 |
| 19 | Head - EHS | head.ehs@mkpapermill.com | `Head@1234` | EHS | 17 |
| 20 | Head - Scrap Management | head.scrap@mkpapermill.com | `Head@1234` | Scrap Management | 18 |
| 21 | Head - Packing | head.pack@mkpapermill.com | `Head@1234` | Packing | 19 |
| 22 | Head - Finished Goods WH | head.fgw@mkpapermill.com | `Head@1234` | Finished Goods Warehouse | 20 |

### Special operational logins
| # | Name | Email (login) | Password | Role | Level | Dept |
|---|------|---------------|----------|------|-------|------|
| 23 | Store Issue Desk | store@mkpapermill.com | `Store@1234` | Shift Supervisor | 2 | Store Management |

### Sample staff (template — make more per dept via HR)
| Name | Email pattern | Password | Role | Level |
|------|--------------|----------|------|-------|
| Supervisor | spv.<deptcode>@mkpapermill.com | `Spv@1234` | Shift Supervisor | 2 |
| Operator | op.<deptcode>@mkpapermill.com | `Op@1234` | Operator | 1 |

Example: `spv.prod@mkpapermill.com`, `op.qc@mkpapermill.com`.

---

## 2. Keen Roles & Responsibilities

### Level-based (what each level CAN do)
| Level | Role | Core power | Cannot do |
|-------|------|-----------|-----------|
| 1 | Operator | Enter data (reels, readings, tests, indents). View own dept. | Approve anything. See other depts. |
| 2 | Shift Supervisor | Operator powers + approve shift entries, mark attendance, run store issue desk, L1 quick approvals. | Approve POs/SOs. Change settings. |
| 3 | Department Head Manager | Approve OWN dept work, approve store indents, manage dept staff data, dept reports. | Touch other depts. Write system settings. |
| 4 | Plant Head | Main approver — approve ANY dept, high-value escalation, see all footsteps, all reports. | Manage users. Write system settings. |
| 5 | Admin | Everything — assign users/roles, write settings, all modules, all data, audit. | (nothing blocked) |

### Department Head duties (keen — each head owns these)
| Head | Owns / Responsible for | Approves |
|------|------------------------|----------|
| **Production** | Reels output, shift plan, machine efficiency/OEE, downtime entry | production entries, store indents for PROD |
| **Raw Material Store** | RM receipts, GRN entry, RM stock accuracy | GRN, RM store indents |
| **Inventory** | Stock accuracy all stores, stock_ledger integrity, reorder levels, valuation | stock adjustments, transfers |
| **Store Management** | Material custody, issue desk oversight, store indent approval | store indents, issues |
| **Indent Management** | Route indents to right approver, track pending/overdue indents | indent priority/routing |
| **Purchase** | Vendors, POs, indent→PO conversion, vendor rating | POs (up to limit), vendor onboarding |
| **Quality** | Quality tests, pass/fail/hold reels, GRN QC | QC results, reel release |
| **Maintenance** | Machine breakdown, preventive schedule, spare indents, downtime cause | maintenance jobs, MAINT store indents |
| **Utility** | Power/steam/coal/water readings, boiler params, utility cost | utility entries |
| **Dispatch** | Dispatch orders, loading, vehicle, delivery proof | dispatch orders |
| **Sales** | Customers, sales orders, credit limit watch, fulfillment | sales orders (up to limit) |
| **HR & Payroll** | Employee master, attendance, leave, payroll basics | attendance, leave, employee changes |
| **Security** | Gate passes, vehicle in/out, weighbridge net weight, visitors | gate pass close |
| **Laboratory** | Lab samples (paper/water/effluent/chemical), results | lab results |
| **Finance** | AR/AP, stock valuation, monthly summary, credit control | finance reports (read), credit flags |
| **Administration** | Master data, departments, roles view, helps Admin with settings | dept/master data changes |
| **EHS** | Incidents, safety, environmental compliance, LTI tracking | incident closure |
| **Scrap Management** | Scrap records, disposal method, scrap sale | scrap records, disposal |
| **Packing** | Packing records, wrap material, label printing | packing entries |
| **Finished Goods WH** | FG reels in warehouse, dispatch readiness, FG stock | FG movements |

**Universal head rule:** a Department Head Manager approves ONLY their own department's records. Guard checks `record.department_id === req.user.department_id`. Cross-department approval needs Plant Head (L4) or Admin (L5).

---

## 3. Admin Assigns Users (user management)

Only Admin (L5) creates logins and assigns role + department. Plant Head (L4) can view, not create.

### Endpoints (mount `/api/admin/users`)
| Method | Path | Guard | Job |
|--------|------|-------|-----|
| GET | `/users` | requireLevel(4) | List all users (view) |
| GET | `/users/:id` | requireLevel(4) | One user detail |
| POST | `/users` | requireLevel(5) | Create login + assign role/dept |
| PUT | `/users/:id` | requireLevel(5) | Change role/dept/shift/active |
| PUT | `/users/:id/reset-password` | requireLevel(5) | Reset to a new password |
| PUT | `/users/:id/deactivate` | requireLevel(5) | Soft-disable login |

### POST /api/admin/users — create + assign
**Body:**
```json
{
  "name": "Ravi Kumar",
  "email": "op.prod@mkpapermill.com",
  "mobile": "9812345678",
  "password": "Op@1234",
  "roleId": 1,
  "departmentId": 1,
  "shift": "Day",
  "employeeCode": "EMP-PROD-007"
}
```
**Logic:**
```js
const hash = await bcrypt.hash(password, 10);   // never store plain
const { rows } = await pool.query(`
  INSERT INTO users (employee_code, name, email, mobile, password_hash, role_id, department_id, shift, is_active)
  VALUES ($1,$2,$3,$4,$5,$6,$7,$8,true)
  RETURNING id, name, email, role_id, department_id
`, [employeeCode, name, email, mobile, hash, roleId, departmentId, shift]);

// footstep log
await audit(null, {
  userId: req.user.id, module: 'admin', action: 'create_user',
  entityType: 'user', entityId: rows[0].id,
  newVal: { email, roleId, departmentId }, ip: req.ip
});
```
- `email` UNIQUE — duplicate → 400 "Email already exists"
- `roleId` must be 1–5; `departmentId` must exist
- Admin chooses level AND department = the "assign" step

**Response:**
```json
{ "success": true, "data": { "id": 45, "email": "op.prod@mkpapermill.com" } }
```

### PUT /api/admin/users/:id — reassign role/dept
**Body:** `{ "roleId": 3, "departmentId": 4, "shift": "General", "isActive": true }`
```sql
UPDATE users SET role_id=$1, department_id=$2, shift=$3, is_active=$4, updated_at=NOW()
WHERE id=$5
```
Promote/demote (change level) or move to another department here. Writes audit_log with old + new values.

### PUT /api/admin/users/:id/reset-password
**Body:** `{ "newPassword": "Temp@1234" }`
```js
const hash = await bcrypt.hash(newPassword, 10);
await pool.query('UPDATE users SET password_hash=$1, updated_at=NOW() WHERE id=$2', [hash, id]);
// audit: action='reset_password' — DO NOT log the password itself
```

### PUT /api/admin/users/:id/deactivate
```sql
UPDATE users SET is_active=false, updated_at=NOW() WHERE id=$1
```
NEVER hard-delete a user. `auth.js` already blocks login when `is_active=false`.

### Assign rules (hard)
1. Only Admin (L5) creates users or changes a user's `role_id` / `department_id`.
2. Admin cannot create another L5 Admin without... (decide: allow, but every L5 creation is audit-logged red-flag).
3. Every create/update/reset/deactivate writes an `audit_log` row → admin footstep feed (doc 19 §5).
4. Password always bcrypt — never accept or store plain text; never log password value.
5. Role+department assigned together at create — a login is useless without both.
6. New user must change password on first login (set a `must_change_password` flag — see below).

### Optional: force-change-on-first-login flag
```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT true;
```
- Seeded + admin-created users → `true`
- On successful first login with must_change=true → frontend forces password reset before anything else
- After change → set `false`

---

## 4. Seed File

Combine into one runnable seed (run AFTER schema + dept-category migration):
```
db/seed_logins.sql
  ├─ Plant Head (Plant@1234)
  ├─ 20 Department Heads (Head@1234)
  ├─ Store Issue Desk (Store@1234)
  └─ sample Supervisor + Operator per dept (optional)
```
Generate each bcrypt hash:
```bash
node -e "console.log(require('bcrypt').hashSync('Head@1234',10))"
```
Use `ON CONFLICT (email) DO NOTHING` so re-run is safe.

Admin (`admin@mkpapermill.com` / `Admin@1234`) already seeded by `init.js`.

---

## 5. Build Checklist

- [ ] `db/seed_logins.sql` — Plant Head + 20 dept heads + store desk (bcrypt hashes)
- [ ] `ALTER TABLE users ADD must_change_password BOOLEAN DEFAULT true`
- [ ] `admin.js` — add 6 `/users` endpoints (create/update/reset/deactivate/list/detail)
- [ ] Guard: create/assign = `requireLevel(5)`; view = `requireLevel(4)`
- [ ] Every user-mgmt action calls `audit()` (doc 19 §5) — admin footstep
- [ ] Dept-head approval guard: `record.department_id === req.user.department_id` unless level >= 4
- [ ] Frontend: Admin "Users" page (create form with role + dept dropdowns, reset/deactivate buttons)
- [ ] Frontend: first-login force-password-change screen
- [ ] After deploy: rotate admin + plant head passwords, force-change all `Head@1234`
