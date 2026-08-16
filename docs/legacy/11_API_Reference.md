# API Reference — All Endpoints

Base URL: `http://localhost:5000`
Auth: `Authorization: Bearer <jwt_token>` on every protected route.
Response: `{ success: bool, data: any, total?: number, message?: string }`

---

## AUTH — /api/auth

| Method | Path | Auth | Body / Params | Description |
|--------|------|------|--------------|-------------|
| POST | /api/auth/login | none | `{email, password}` | Returns JWT + user object |
| GET | /api/auth/me | token | — | Returns current user |
| POST | /api/auth/change-password | token | `{old_password, new_password}` | Change own password |
| POST | /api/users/:id/reset-password | role≥5 | `{new_password}` | Admin reset |

---

## USERS — /api/users

| Method | Path | Auth | Body / Params | Description |
|--------|------|------|--------------|-------------|
| GET | /api/users | role≥3 | `?dept=&role=&is_active=&search=&page=&limit=` | List users |
| POST | /api/users | role≥5 | user object | Create user |
| GET | /api/users/:id | role≥3 | — | Get user |
| PUT | /api/users/:id | role≥5 | user object | Update user |
| GET | /api/users/roles | token | — | List all roles |
| GET | /api/users/departments | token | — | List all departments |

---

## MASTER DATA — /api/master

| Method | Path | Auth | Body / Params | Description |
|--------|------|------|--------------|-------------|
| GET | /api/master/machines | token | `?is_active=` | List machines |
| POST | /api/master/machines | role≥4 | machine obj | Create machine |
| PUT | /api/master/machines/:id | role≥4 | machine obj | Update machine |
| GET | /api/master/vendors | token | `?is_active=&search=` | List vendors |
| POST | /api/master/vendors | role≥3 | vendor obj | Create vendor |
| PUT | /api/master/vendors/:id | role≥3 | vendor obj | Update vendor |
| GET | /api/master/customers | token | `?is_active=&search=` | List customers |
| POST | /api/master/customers | role≥3 | customer obj | Create customer |
| PUT | /api/master/customers/:id | role≥3 | customer obj | Update customer |
| GET | /api/master/materials | token | `?category=&is_active=&search=` | List materials |
| POST | /api/master/materials | role≥3 | material obj | Create material |
| PUT | /api/master/materials/:id | role≥3 | material obj | Update material |
| GET | /api/master/categories | token | — | List material categories |
| POST | /api/master/categories | role≥4 | category obj | Create category |
| PUT | /api/master/categories/:id | role≥4 | category obj | Update category |

---

## DASHBOARD — /api/dashboard

| Method | Path | Auth | Params | Description |
|--------|------|------|--------|-------------|
| GET | /api/dashboard | token | — | All KPIs in one call (12 parallel queries) |

Returns: `{ production_today, production_month, reels_today, avg_efficiency, shift_breakdown, low_stock, pending_indents, pending_grn, open_breakdowns, pending_dispatch, pending_so, utility_today, quality_stats }`

---

## PRODUCTION — /api/production

| Method | Path | Auth | Body / Params | Description |
|--------|------|------|--------------|-------------|
| GET | /api/production/machines | token | `?is_active=true` | List machines (dropdown) |
| GET | /api/production/grades | token | `?is_active=true` | List grades (dropdown) |
| GET | /api/production/shifts | token | `?date=&machine_id=&page=&limit=` | List shifts |
| POST | /api/production/shifts | role≥2 | shift obj | Open shift |
| GET | /api/production/shifts/:id | token | — | Get shift |
| PUT | /api/production/shifts/:id | role≥2 | `{end_time, closing_remarks, ...}` | Update shift |
| PUT | /api/production/shifts/:id/close | role≥2 | close fields | Close shift → triggers summary |
| GET | /api/production/reels | token | `?date=&shift_id=&machine_id=&grade_id=&status=&search=&page=&limit=` | List reels |
| POST | /api/production/reels | role≥1 | reel obj | Create reel |
| GET | /api/production/reels/:id | token | — | Get reel detail |
| PUT | /api/production/reels/:id | role≥1 | reel obj | Update reel |
| PUT | /api/production/reels/:id/send-qc | role≥1 | — | status → QC Pending |
| GET | /api/production/downtime | token | `?date=&machine_id=&category=&page=&limit=` | List downtime |
| POST | /api/production/downtime | role≥1 | downtime obj | Log downtime |
| PUT | /api/production/downtime/:id/close | role≥1 | `{end_time}` | Close downtime |
| GET | /api/production/summary | token | `?date=&month=&machine_id=&group=` | Production summary / charts |
| GET | /api/production/oee | token | `?machine_id=&date_from=&date_to=` | OEE computation |

---

## INVENTORY — /api/inventory

| Method | Path | Auth | Body / Params | Description |
|--------|------|------|--------------|-------------|
| GET | /api/inventory/dashboard | token | — | Stock KPIs |
| GET | /api/inventory/reorder-alerts | token | — | Materials below reorder |
| GET | /api/inventory/grn | token | `?date=&vendor_id=&status=&page=&limit=` | List GRNs |
| POST | /api/inventory/grn | role≥2 | grn + items | Create GRN |
| GET | /api/inventory/grn/:id | token | — | GRN detail with items |
| PUT | /api/inventory/grn/:id | role≥2 | updates | Update GRN |
| PUT | /api/inventory/grn/:id/submit | role≥2 | — | status → QC Pending |
| PUT | /api/inventory/grn/:id/approve | role≥2 | — | ACID: approve + stock_ledger IN |
| PUT | /api/inventory/grn/:id/reject | role≥2 | `{reason}` | Reject GRN |
| GET | /api/inventory/ledger | token | `?material_id=&date_from=&date_to=&type=&page=&limit=` | Stock ledger |
| POST | /api/inventory/adjustment | role≥3 | adjustment obj | Stock adjustment |
| POST | /api/inventory/issue | role≥2 | issue obj | Issue material → stock_ledger OUT |

---

## INDENT — /api/indent

| Method | Path | Auth | Body / Params | Description |
|--------|------|------|--------------|-------------|
| GET | /api/indent | token | `?dept=&status=&priority=&date=&page=&limit=` | List indents |
| POST | /api/indent | token | indent + items | Create indent |
| GET | /api/indent/:id | token | — | Indent detail |
| PUT | /api/indent/:id | token | updates | Update indent |
| PUT | /api/indent/:id/submit | token | — | status → Submitted |
| PUT | /api/indent/:id/approve/l1 | role≥2 | — | L1 approval |
| PUT | /api/indent/:id/approve/l2 | role≥3 | — | L2 approval |
| PUT | /api/indent/:id/approve/l3 | role≥4 | — | L3 approval |
| PUT | /api/indent/:id/reject | role≥2 | `{reason}` | Reject indent |

---

## PURCHASE — /api/purchase

| Method | Path | Auth | Body / Params | Description |
|--------|------|------|--------------|-------------|
| GET | /api/purchase/dashboard | token | — | Procurement KPIs |
| GET | /api/purchase/po | token | `?vendor_id=&status=&date=&page=&limit=` | List POs |
| POST | /api/purchase/po | role≥2 | po + items | Create PO |
| GET | /api/purchase/po/:id | token | — | PO detail |
| PUT | /api/purchase/po/:id | role≥2 | updates | Update PO |
| PUT | /api/purchase/po/:id/submit | role≥2 | — | status → Pending Approval |
| PUT | /api/purchase/po/:id/approve | role≥3 | — | Approve PO |
| PUT | /api/purchase/po/:id/reject | role≥3 | `{reason}` | Reject PO |
| PUT | /api/purchase/po/:id/cancel | role≥4 | `{reason}` | Cancel PO |
| POST | /api/purchase/po/:id/email | role≥3 | — | Email PO to vendor |
| GET | /api/purchase/vendor-performance | role≥3 | `?vendor_id=&date_from=&date_to=` | Vendor KPIs |

---

## QUALITY — /api/quality

| Method | Path | Auth | Body / Params | Description |
|--------|------|------|--------------|-------------|
| GET | /api/quality/dashboard | token | — | QC KPIs |
| GET | /api/quality/tests | token | `?type=&result=&date=&reel_id=&grn_id=&page=&limit=` | List tests |
| POST | /api/quality/tests | role≥2 | test obj | Create QC test |
| GET | /api/quality/tests/:id | token | — | Test detail |
| PUT | /api/quality/tests/:id/pass | role≥2 | — | ACID: Pass + update reel/grn |
| PUT | /api/quality/tests/:id/fail | role≥2 | `{failure_reasons}` | ACID: Fail + NCR |
| PUT | /api/quality/tests/:id/retest | role≥2 | — | status → Hold, allow new test |
| PUT | /api/quality/tests/:id/close-ncr | role≥3 | `{corrective_action}` | Close NCR |
| GET | /api/quality/stats | token | `?group=grade&date_from=&date_to=` | QC statistics |

---

## MAINTENANCE — /api/maintenance

| Method | Path | Auth | Body / Params | Description |
|--------|------|------|--------------|-------------|
| GET | /api/maintenance/dashboard | token | — | Maintenance KPIs |
| GET | /api/maintenance/schedule | token | `?machine_id=&status=` | List PM schedule |
| POST | /api/maintenance/schedule | role≥3 | schedule obj | Create PM entry |
| PUT | /api/maintenance/schedule/:id | role≥3 | updates | Update PM entry |
| PUT | /api/maintenance/schedule/:id/complete | role≥2 | `{date}` | Mark PM done, advance next_due |
| PUT | /api/maintenance/schedule/:id/skip | role≥2 | `{reason}` | Skip, advance date |
| GET | /api/maintenance/logs | token | `?machine_id=&type=&date=&page=&limit=` | List logs |
| POST | /api/maintenance/logs | role≥2 | log obj | Create maintenance log |
| GET | /api/maintenance/logs/:id | token | — | Log detail |
| PUT | /api/maintenance/logs/:id | role≥2 | updates | Update log |
| PUT | /api/maintenance/logs/:id/complete | role≥2 | `{end_time, spare_parts_used}` | Complete + deduct parts |
| POST | /api/maintenance/breakdown | role≥1 | breakdown obj | Log breakdown + downtime (ACID) |

---

## SALES — /api/sales

| Method | Path | Auth | Body / Params | Description |
|--------|------|------|--------------|-------------|
| GET | /api/sales/dashboard | token | — | Sales KPIs |
| GET | /api/sales/orders | token | `?customer_id=&status=&date=&page=&limit=` | List SOs |
| POST | /api/sales/orders | role≥2 | SO obj | Create SO |
| GET | /api/sales/orders/:id | token | — | SO detail |
| PUT | /api/sales/orders/:id | role≥2 | updates | Update SO |
| PUT | /api/sales/orders/:id/confirm | role≥3 | — | Confirm SO |
| PUT | /api/sales/orders/:id/cancel | role≥3 | `{reason}` | Cancel SO |
| POST | /api/sales/orders/:id/email | role≥2 | — | Email SO to customer |
| POST | /api/sales/invoice | role≥3 | `{dispatch_order_id}` | Generate invoice |

---

## DISPATCH — /api/dispatch

| Method | Path | Auth | Body / Params | Description |
|--------|------|------|--------------|-------------|
| GET | /api/dispatch | token | `?status=&date=&so_id=&page=&limit=` | List DOs |
| POST | /api/dispatch | role≥2 | DO + items | Create dispatch order |
| GET | /api/dispatch/:id | token | — | DO detail |
| PUT | /api/dispatch/:id/loading | role≥2 | — | status → Loading |
| PUT | /api/dispatch/:id/loaded | role≥2 | — | status → Loaded |
| PUT | /api/dispatch/:id/dispatch | role≥3 | — | ACID: Dispatch + update reels + SO |
| PUT | /api/dispatch/:id/delivered | role≥2 | `{delivered_at}` | Mark delivered |
| GET | /api/dispatch/available-reels | token | `?grade_id=&gsm_min=&gsm_max=` | Reels eligible for dispatch |

---

## UTILITY — /api/utility

| Method | Path | Auth | Body / Params | Description |
|--------|------|------|--------------|-------------|
| GET | /api/utility/dashboard | token | `?date=` | Utility KPIs |
| GET | /api/utility/readings | token | `?date=&shift=&page=&limit=` | List readings |
| POST | /api/utility/readings | role≥1 | reading obj | Log utility reading |
| PUT | /api/utility/readings/:id | role≥1 | updates | Update reading (same shift) |
| GET | /api/utility/trends | token | `?days=30` | Trend data for charts |

---

## HR — /api/hr

| Method | Path | Auth | Body / Params | Description |
|--------|------|------|--------------|-------------|
| GET | /api/hr/employees | role≥2 | `?dept=&status=&search=&page=&limit=` | List employees |
| POST | /api/hr/employees | role≥3 | employee obj | Create employee |
| GET | /api/hr/employees/:id | role≥2 | — | Employee detail |
| PUT | /api/hr/employees/:id | role≥3 | updates | Update employee |
| GET | /api/hr/attendance | role≥2 | `?date=&employee_id=&dept=&status=&page=&limit=` | List attendance |
| POST | /api/hr/attendance | role≥2 | attendance obj | Single attendance |
| POST | /api/hr/attendance/bulk | role≥2 | `[{employee_id, date, status, ...}]` | Bulk attendance upsert |
| PUT | /api/hr/attendance/mark-holiday | role≥3 | `{date, dept_id?}` | Mark holiday |
| GET | /api/hr/attendance/summary | role≥2 | `?month=&dept=` | Monthly summary |

---

## REPORTS — /api/reports

| Method | Path | Auth | Params | Description |
|--------|------|------|--------|-------------|
| GET | /api/reports/production | token | `?date_from=&date_to=&machine=&grade=&format=` | Production report |
| GET | /api/reports/inventory | token | `?date_from=&date_to=&material=&format=` | Stock movement report |
| GET | /api/reports/purchase | token | `?date_from=&date_to=&vendor=&format=` | Purchase report |
| GET | /api/reports/quality | token | `?date_from=&date_to=&grade=&format=` | QC report |
| GET | /api/reports/maintenance | token | `?date_from=&date_to=&machine=&format=` | Maintenance report |
| GET | /api/reports/sales | token | `?date_from=&date_to=&customer=&format=` | Sales report |
| GET | /api/reports/utility | token | `?date_from=&date_to=&format=` | Utility report |
| GET | /api/reports/hr | role≥3 | `?month=&dept=&format=` | HR / attendance report |

`?format=csv` returns CSV download, default JSON.

---

## AUDIT — /api/audit

| Method | Path | Auth | Params | Description |
|--------|------|------|--------|-------------|
| GET | /api/audit | role≥4 | `?module=&user_id=&date=&page=&limit=` | Audit log viewer |

---

## ERROR RESPONSES

| HTTP | Condition | Response |
|------|-----------|---------|
| 400 | Validation failed | `{success:false, message:"field: reason"}` |
| 401 | No token / invalid token | `{success:false, message:"Authentication required"}` |
| 403 | Insufficient role level | `{success:false, message:"Insufficient permissions"}` |
| 404 | Record not found | `{success:false, message:"Not found"}` |
| 409 | Duplicate (unique constraint) | `{success:false, message:"Already exists"}` |
| 422 | Business rule violation | `{success:false, message:"specific rule message"}` |
| 500 | Server error | `{success:false, message:"Internal server error"}` |

Business rule 422 examples:
- "Reel must be in QC Pending status to submit test"
- "Stock insufficient: available 45.000 KG, requested 60.000 KG"
- "Reel has not passed QC — cannot dispatch"
- "Indent must be L3 Approved to create PO"
