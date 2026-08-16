# Phase 2 — Master Data Module

## Scope
Users, Departments, Machines, Grades, Vendors, Customers, Materials, Material Categories.
All master data = soft-delete only (`is_active = false`).

---

## 1. USERS PAGE

### List View
**API:** GET `/api/users?dept=&role=&is_active=`
**DB:** `SELECT u.id, u.name, u.email, u.employee_code, r.name as role, d.name as dept, u.is_active, u.last_login FROM users u JOIN roles r ON r.id=u.role_id JOIN departments d ON d.id=u.department_id`

| Column | DB Source | Sortable | Filterable |
|--------|-----------|----------|------------|
| Employee Code | users.employee_code | Y | N |
| Name | users.name | Y | Y (search) |
| Email | users.email | Y | Y (search) |
| Role | roles.name | N | Y (dropdown) |
| Department | departments.name | N | Y (dropdown) |
| Last Login | users.last_login | Y | N |
| Status | users.is_active | N | Y (toggle) |

### Add/Edit User Form → `users` table
| UI Label | Input | DB Column | Validation | API |
|----------|-------|-----------|------------|-----|
| Employee Code | text (auto) | employee_code | unique, auto-gen EMP-NNNN | server-gen |
| Full Name | text | name | required, max 100 | required |
| Email | email | email | required, unique, valid email | required |
| Password | password | password_hash | min 8 chars, bcrypt on save | required on create |
| Role | dropdown | role_id → roles.id | required | GET /api/users/roles |
| Department | dropdown | department_id → departments.id | required | GET /api/users/departments |
| Phone | tel | phone | 10 digits | optional |
| Address | textarea | address | max 300 | optional |
| Shift | dropdown | default_shift | Day/Night/General | optional |
| Is Active | toggle | is_active | default true | — |

**Buttons:**
- **Save User** → POST `/api/users` (create) or PUT `/api/users/:id` (edit)
- **Reset Password** → POST `/api/users/:id/reset-password` — sets temp password, emails user
- **Deactivate** → PUT `/api/users/:id` with `{is_active: false}` — NEVER DELETE
- **Change Password** → POST `/api/auth/change-password` — `{old, new, confirm}`

**Dropdowns sourced from:**
- Role: GET `/api/users/roles` → `SELECT id, name, level FROM roles ORDER BY level`
- Department: GET `/api/users/departments` → `SELECT id, name, code FROM departments ORDER BY name`

---

## 2. MACHINES PAGE

### List View
**API:** GET `/api/master/machines`
**DB:** `SELECT id, name, code, machine_type, capacity_tpd, ideal_speed_mpm, is_active FROM machines ORDER BY name`

| Column | DB Source |
|--------|-----------|
| Machine Code | machines.code |
| Name | machines.name |
| Type | machines.machine_type |
| Capacity (TPD) | machines.capacity_tpd |
| Ideal Speed (mpm) | machines.ideal_speed_mpm |
| Status | machines.is_active |

### Add/Edit Machine Form → `machines` table
| UI Label | Input | DB Column | Validation |
|----------|-------|-----------|------------|
| Machine Code | text | code | unique, e.g. PM1, PM2, RW1 |
| Machine Name | text | name | required, max 50 |
| Machine Type | dropdown | machine_type | Paper Machine/Rewinder/Cutter/Pulper |
| Capacity (MT/day) | number | capacity_tpd | > 0, 2 decimal |
| Ideal Speed (mpm) | number | ideal_speed_mpm | > 0 |
| Installation Date | date | installation_date | optional |
| Manufacturer | text | manufacturer | optional |
| Model No | text | model_number | optional |
| Is Active | toggle | is_active | default true |
| Notes | textarea | notes | optional |

**Buttons:**
- **Save Machine** → POST/PUT `/api/master/machines`
- **Deactivate** → PUT with `{is_active: false}`
- **View OEE** → links to Production→OEE filtered by machine

---

## 3. GRADES PAGE

### List View
**API:** GET `/api/production/grades`
**DB:** `SELECT id, name, code, gsm_min, gsm_max, description, is_active FROM grades ORDER BY name`

### Add/Edit Grade Form → `grades` table
| UI Label | Input | DB Column | Validation |
|----------|-------|-----------|------------|
| Grade Code | text | code | unique, max 10 |
| Grade Name | text | name | required, max 100 |
| GSM Min | number | gsm_min | > 0 |
| GSM Max | number | gsm_max | >= gsm_min |
| Description | textarea | description | optional |
| Is Active | toggle | is_active | default true |

**Buttons:**
- **Save Grade** → POST/PUT `/api/production/grades`
- **Deactivate** → PUT with `{is_active: false}`

---

## 4. VENDORS PAGE

### List View
**API:** GET `/api/master/vendors?is_active=`
**DB:** `SELECT id, name, code, city, gstin, payment_terms, rating, is_active FROM vendors ORDER BY name`

| Column | DB Source |
|--------|-----------|
| Vendor Code | vendors.code |
| Name | vendors.name |
| City | vendors.city |
| GSTIN | vendors.gstin |
| Payment Terms | vendors.payment_terms |
| Rating | vendors.rating |
| Status | vendors.is_active |

### Add/Edit Vendor Form → `vendors` table
| UI Label | Input | DB Column | Validation |
|----------|-------|-----------|------------|
| Vendor Code | text (auto) | code | unique, auto-gen VND-NNNN |
| Vendor Name | text | name | required |
| Contact Person | text | contact_person | optional |
| Phone | tel | phone | optional |
| Email | email | email | valid email |
| Address | textarea | address | optional |
| City | text | city | optional |
| State | text | state | optional |
| PIN Code | text | pincode | 6 digits |
| GSTIN | text | gstin | 15-char GST format |
| PAN | text | pan | 10-char PAN format |
| Bank Name | text | bank_name | optional |
| Account No | text | bank_account | optional |
| IFSC | text | ifsc | optional |
| Payment Terms | dropdown | payment_terms | Immediate/15 days/30 days/45 days/60 days |
| Credit Limit (₹) | number | credit_limit | ≥ 0 |
| Material Category | multi-select | vendor_categories (JSONB) | optional |
| Rating | number 1-5 | rating | 1-5 |
| Notes | textarea | notes | optional |
| Is Active | toggle | is_active | default true |

**Buttons:**
- **Save Vendor** → POST/PUT `/api/master/vendors`
- **View Purchase History** → GET `/api/purchase/po?vendor_id=X`
- **Deactivate** → PUT with `{is_active: false}`

---

## 5. CUSTOMERS PAGE

### List View
**API:** GET `/api/master/customers?is_active=`

| Column | DB Source |
|--------|-----------|
| Customer Code | customers.code |
| Name | customers.name |
| City | customers.city |
| GSTIN | customers.gstin |
| Credit Limit | customers.credit_limit |
| Outstanding | computed from sales_orders |
| Status | customers.is_active |

### Add/Edit Customer Form → `customers` table
| UI Label | Input | DB Column | Validation |
|----------|-------|-----------|------------|
| Customer Code | text (auto) | code | unique, auto-gen CST-NNNN |
| Customer Name | text | name | required |
| Contact Person | text | contact_person | optional |
| Phone | tel | phone | optional |
| Email | email | email | valid email |
| Billing Address | textarea | billing_address | required |
| Shipping Address | textarea | shipping_address | optional |
| City | text | city | optional |
| State | text | state | optional |
| PIN Code | text | pincode | 6 digits |
| GSTIN | text | gstin | 15-char GST |
| PAN | text | pan | 10-char PAN |
| Credit Limit (₹) | number | credit_limit | ≥ 0 |
| Payment Terms | dropdown | payment_terms | Immediate/15/30/45/60 days |
| Grade Preference | multi-select | preferred_grades (JSONB) | from grades table |
| Notes | textarea | notes | optional |
| Is Active | toggle | is_active | default true |

**Buttons:**
- **Save Customer** → POST/PUT `/api/master/customers`
- **View Orders** → GET `/api/sales/orders?customer_id=X`
- **Deactivate** → PUT with `{is_active: false}`

---

## 6. MATERIAL CATEGORIES PAGE

### List View + Form → `material_categories` table
| UI Label | Input | DB Column | Validation |
|----------|-------|-----------|------------|
| Category Name | text | name | required, unique |
| Category Code | text | code | unique, max 10 |
| Description | textarea | description | optional |
| Is Active | toggle | is_active | default true |

**API:** GET/POST/PUT `/api/master/categories`

---

## 7. MATERIALS PAGE

### List View
**API:** GET `/api/master/materials?category=&is_active=`
Shows: code, name, category, uom, current_stock, reorder_level, last_price, is_active
Color-code rows: red if `current_stock <= reorder_level`

### Add/Edit Material Form → `materials` table
| UI Label | Input | DB Column | Validation |
|----------|-------|-----------|------------|
| Material Code | text (auto) | code | unique, auto-gen MAT-NNNN |
| Material Name | text | name | required |
| Category | dropdown | category_id → material_categories.id | required |
| Unit of Measure | dropdown | uom | KG/MT/LTR/NOS/PKT/DRUM/BAG/ROLL |
| Reorder Level | number | reorder_level | ≥ 0 |
| Min Order Qty | number | min_order_qty | ≥ 0 |
| Lead Time (days) | number | lead_time_days | ≥ 0 |
| Last Purchase Price | number | last_price | ≥ 0 |
| HSN Code | text | hsn_code | optional |
| GST % | number | gst_rate | 0/5/12/18/28 |
| Specification | textarea | specification | optional |
| Storage Conditions | text | storage_conditions | optional |
| Is Active | toggle | is_active | default true |

**Buttons:**
- **Save Material** → POST/PUT `/api/master/materials`
- **View Stock Ledger** → GET `/api/inventory/ledger?material_id=X`
- **View GRN History** → GET `/api/inventory/grn?material_id=X`
- **Deactivate** → PUT with `{is_active: false}`

---

## 8. DEPARTMENTS (read-only for normal users)
20 departments seeded in schema. Admin only can add/edit.
**API:** GET `/api/users/departments`
Dropdown source for: User form, Indent form, Employee form.
