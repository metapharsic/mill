# MK Paper Mill ERP — API Contracts

> All endpoints return `{ success: boolean, data?: any, message?: string }`
> All protected routes require: `Authorization: Bearer <token>`
> Base URL: `/api`

---

## Auth (`/api/auth`)

| Method | Path | Auth | Body | Returns |
|---|---|---|---|---|
| POST | `/auth/login` | None | `{ email, password }` | `{ token, user }` |
| GET | `/auth/me` | Required | — | `{ user }` |
| POST | `/auth/change-password` | Required | `{ current_password, new_password }` | `{ message }` |

**User object returned on login:**
```json
{
  "id": 1,
  "name": "string",
  "email": "string",
  "employee_code": "string",
  "role": "string",
  "role_level": 1-5,
  "permissions": {},
  "department": "string",
  "dept_code": "string",
  "shift": "Day|Night|General",
  "must_change_password": false,
  "department_id": 1,
  "emp_id": null,
  "is_dept_head": false,
  "is_hr_admin": false
}
```

---

## Dashboard (`/api/dashboard`)

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/dashboard` | Required | KPI summary, production stats, alerts |
| GET | `/dashboard/alerts` | Required | Active system alerts |

---

## Production (`/api/production`)

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/production/reels` | Required | List reels with filters |
| POST | `/production/reels` | L2+ | Create new reel |
| PUT | `/production/reels/:id` | L2+ | Update reel |
| GET | `/production/shifts` | Required | List shifts |
| POST | `/production/shifts` | L2+ | Create shift |
| GET | `/production/downtime` | Required | Downtime entries |
| POST | `/production/downtime` | Required | Log downtime |
| GET | `/production/summary` | Required | Production summary |
| GET | `/production/dpr` | Required | Daily Production Report |

### DPS Import (`/api/production/dpr`)
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/production/dpr/import` | L3+ | Import DPS Excel file |

---

## Master Data (`/api/master`)

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/master/machines` | Required | List machines |
| POST | `/master/machines` | L4+ | Add machine |
| PUT | `/master/machines/:id` | L4+ | Update machine |
| GET | `/master/grades` | Required | List paper grades |
| POST | `/master/grades` | L4+ | Add grade |
| GET | `/master/departments` | Required | List departments |
| GET | `/master/materials` | Required | List materials/items |
| POST | `/master/materials` | L3+ | Add material |
| PUT | `/master/materials/:id` | L3+ | Update material |
| GET | `/master/customers` | Required | List customers |
| POST | `/master/customers` | L3+ | Add customer |
| GET | `/master/vendors` | Required | List vendors |
| POST | `/master/vendors` | L3+ | Add vendor |

---

## Inventory (`/api/inventory`)

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/inventory/grn` | Required | List GRNs |
| POST | `/inventory/grn` | Required | Create GRN |
| PUT | `/inventory/grn/:id` | Required | Update GRN |
| GET | `/inventory/stock` | Required | Current stock levels |
| GET | `/inventory/ledger` | Required | Stock ledger entries |
| POST | `/inventory/adjustment` | L3+ | Stock adjustment |

---

## Indent / PIIMAS (`/api/indent`)

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/indent` | Required | List indents |
| POST | `/indent` | Required | Create indent |
| PUT | `/indent/:id` | Required | Update indent |
| POST | `/indent/:id/submit` | Required | Submit for approval |
| POST | `/indent/:id/approve` | L2+ | Approve indent (L1/L2/L3) |
| POST | `/indent/:id/reject` | L2+ | Reject indent |
| GET | `/indent/:id/items` | Required | Get indent items |
| POST | `/indent/:id/issue` | requireStore | Issue materials from store |
| POST | `/indent/:id/ack` | Required | Acknowledge receipt |

> **IMPORTANT:** All stock-deduction routes MUST use `requireStore` middleware

---

## Purchase (`/api/purchase`)

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/purchase/orders` | Required | List purchase orders |
| POST | `/purchase/orders` | L3+ | Create PO |
| PUT | `/purchase/orders/:id` | L3+ | Update PO |
| POST | `/purchase/orders/:id/approve` | L4+ | Approve PO |
| GET | `/purchase/vendors` | Required | List vendors |

---

## Quality (`/api/quality`)

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/quality/tests` | Required | List quality tests |
| POST | `/quality/tests` | Required | Create quality test |
| PUT | `/quality/tests/:id` | Required | Update test results |
| POST | `/quality/tests/:id/approve` | L3+ | Approve/reject test |
| GET | `/quality/parameters` | Required | Quality parameter standards |

---

## Maintenance (`/api/maintenance`)

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/maintenance/schedule` | Required | List scheduled maintenance |
| POST | `/maintenance/schedule` | L3+ | Add maintenance task |
| GET | `/maintenance/logs` | Required | Maintenance work logs |
| POST | `/maintenance/logs` | Required | Log completed work |
| GET | `/maintenance/equipment` | Required | Equipment list |
| GET | `/maintenance/bearings` | Required | Bearing check data |
| POST | `/maintenance/bearings` | Required | Log bearing reading |

---

## Sales (`/api/sales`)

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/sales/orders` | Required | List sales orders |
| POST | `/sales/orders` | L3+ | Create sales order |
| PUT | `/sales/orders/:id` | L3+ | Update sales order |
| GET | `/sales/dispatch` | Required | List dispatches |
| POST | `/sales/dispatch` | Required | Create dispatch |
| PUT | `/sales/dispatch/:id` | Required | Update dispatch |

---

## Store (`/api/store`)

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/store/stock` | Required | Store stock levels |
| POST | `/store/issue` | **requireStore** | Issue items from store |
| POST | `/store/receive` | **requireStore** | Receive items into store |
| GET | `/store/ledger` | Required | Store transaction ledger |
| POST | `/store/adjustment` | requireStore + L3+ | Stock adjustment |
| GET | `/store/indent-log` | Required | Indent issue log |

---

## HR (`/api/hr`)

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/hr/employees` | is_hr_admin | List employees |
| POST | `/hr/employees` | is_hr_admin | Add employee |
| PUT | `/hr/employees/:id` | is_hr_admin | Update employee |
| GET | `/hr/attendance` | Required | Attendance records |
| POST | `/hr/attendance` | Required | Mark attendance |
| GET | `/hr/payroll` | is_hr_admin | Payroll records |
| POST | `/hr/payroll/generate` | is_hr_admin | Generate payroll |
| GET | `/hr/leaves` | Required | Leave requests |
| POST | `/hr/leaves` | Required | Apply for leave |
| PUT | `/hr/leaves/:id/approve` | is_hr_admin | Approve/reject leave |
| POST | `/hr/employees/:id/documents` | is_hr_admin | Upload HR documents |
| GET | `/hr/notifications` | Required | User notifications |
| PUT | `/hr/notifications/:id/read` | Required | Mark notification read |
| PUT | `/hr/notifications/read-all` | Required | Mark all read |

---

## Finance (`/api/finance`)

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/finance/ledger` | L3+ | Financial ledger |
| POST | `/finance/entries` | L3+ | Create journal entry |
| GET | `/finance/reports` | L3+ | Financial reports |
| POST | `/finance/payments/confirm` | L4+ | Confirm payment |

---

## Utility (`/api/utility`)

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/utility/readings` | Required | Utility readings |
| POST | `/utility/readings` | Required | Log utility reading |
| GET | `/utility/summary` | Required | Utility summary/trends |

---

## Sections / Plant Monitoring (`/api/sections`)

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/sections` | Required | All plant sections |
| GET | `/sections/:code` | Required | Section details + readings |
| GET | `/sections/:id/kpi` | Required | Section KPI snapshot |
| POST | `/sections/:id/readings` | Required | Log process reading |
| GET | `/sections/:id/alarms` | Required | Section alarms |

---

## Laboratory (`/api/laboratory`)

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/laboratory/tests` | Required | Lab test records |
| POST | `/laboratory/tests` | Required | Create lab test |

---

## EHS (`/api/ehs`)

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/ehs/incidents` | Required | Incident reports |
| POST | `/ehs/incidents` | Required | Report incident |
| GET | `/ehs/compliance` | L3+ | Compliance records |

---

## Security (`/api/security`)

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/security/logs` | Required | Gate entry/exit logs |
| POST | `/security/logs` | Required | Log entry/exit |
| GET | `/security/visitors` | Required | Visitor records |

---

## Chemicals (`/api/chemicals`)

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/chemicals/stock` | Required | Chemical stock levels |
| POST | `/chemicals/issue` | requireStore | Issue chemicals |
| POST | `/chemicals/receive` | requireStore | Receive chemicals |
| GET | `/chemicals/ledger` | Required | Chemical usage ledger |

---

## Scrap (`/api/scrap`)

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/scrap/records` | Required | Scrap records |
| POST | `/scrap/records` | Required | Log scrap |

---

## Warehouse (`/api/warehouse`)

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/warehouse/stock` | Required | FG warehouse stock |
| GET | `/warehouse/reels` | Required | Reel locations |
| PUT | `/warehouse/reels/:id/location` | Required | Update reel location |

---

## Admin (`/api/admin`)

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/admin/users` | L5 | All users |
| POST | `/admin/users` | L5 | Create user |
| PUT | `/admin/users/:id` | L5 | Update user |
| PUT | `/admin/users/:id/reset-password` | L5 | Reset password |
| GET | `/admin/audit-log` | L5 | System audit log |
| GET | `/admin/roles` | L5 | Roles |

---

## Users (`/api/users`)

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/users` | L4+ | User list |
| PUT | `/users/:id` | L4+ | Update user |

---

## Reports (`/api/reports`)

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/reports/production` | L3+ | Production reports |
| GET | `/reports/quality` | L3+ | Quality reports |
| GET | `/reports/inventory` | L3+ | Inventory reports |
| GET | `/reports/hr` | is_hr_admin | HR reports |
| GET | `/reports/finance` | L4+ | Financial reports |

---

## Telemetry (`/api/telemetry`)

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/telemetry/data` | Required | Real-time sensor data |
| POST | `/telemetry/data` | Required | Push telemetry reading |

---

## System

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/health` | None | Health check: `{ status: "ok", time }` |
| GET | `/metrics` | None | Prometheus metrics |
| GET | `/api/dev/progress` | None (dev) | Dev checkpoint progress |

---

## Error Response Format

```json
{
  "success": false,
  "message": "Human-readable error description"
}
```

HTTP status codes used: 200 (success), 400 (bad request), 401 (unauthorized), 403 (forbidden), 404 (not found), 429 (rate limited), 500 (server error)

---

*Last updated: 2026-07-17 | See 03_DATABASE_SCHEMA for table details*
