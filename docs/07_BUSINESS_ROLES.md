# MK Paper Mill ERP — Business Roles & Permissions

> Defines who can do what in the system. Read this before implementing any authorization logic.

---

## Role Hierarchy

```
Level 5: Admin (system-wide superuser)
    |
Level 4: Plant Head (plant-wide approval authority)
    |
Level 3: Manager (dept-level approvals + reports)
    |
Level 2: Shift Supervisor (L1 approvals, shift oversight)
    |
Level 1: Operator (data entry + view)
```

---

## Role Definitions

### Level 1 — Operator
- **Who:** Machine operators, floor workers, data entry staff
- **Can do:**
  - View all data in their own department
  - Enter production data (reels, downtime)
  - Mark attendance
  - Log utility readings
  - Apply for leave
  - Raise indent drafts
  - View notifications
- **Cannot do:** Approve anything, manage users, access other departments' sensitive data

---

### Level 2 — Shift Supervisor
- **Who:** Shift-in-charge, senior operators
- **Can do:** Everything Level 1 PLUS:
  - L1 approve indents
  - Submit shifts
  - Override reel data in current shift
  - Mark attendance for their team
- **Cannot do:** L2/L3 approvals, financial entries, HR admin

---

### Level 3 — Manager
- **Who:** Department managers, HODs
- **Can do:** Everything Level 2 PLUS:
  - L2 approve indents
  - Create/approve purchase orders
  - Approve quality tests
  - View department financial data
  - Schedule maintenance
  - Manage materials/vendors
  - Generate department-level reports
- **Cannot do:** L3 indent approval (that's Plant Head), user management, system admin

---

### Level 4 — Plant Head
- **Who:** Plant manager, GM Operations
- **Can do:** Everything Level 3 PLUS:
  - L3 approve indents (triggers PO creation)
  - Approve purchase orders above threshold
  - View all department data
  - Approve payroll
  - Confirm payments
  - Plant-wide reports
- **Cannot do:** System configuration, user role changes

---

### Level 5 — Admin
- **Who:** IT Admin, System Administrator
- **Can do:** Everything PLUS:
  - Create/edit/deactivate users
  - Assign roles and departments
  - Reset passwords
  - View audit logs
  - System configuration
  - Access all data across all departments
- **Note:** Admin role bypasses requireStore guard

---

## Special Roles / Flags

### `is_hr_admin`
- **Condition:** `dept_code === 'HR' && role_level >= 3`
- **Grants:** Full access to HR module (employees, payroll, leaves, docs)
- **Note:** A Manager in HR dept gets HR admin powers; same role in Prod dept does not

### `is_dept_head`
- **Condition:** Set on `employees` record (`is_dept_head=true`)
- **Grants:** Receives escalation notifications for their department's indents
- **Note:** Different from role_level — a Level 2 supervisor can be dept_head

### `requireStore`
- **Condition:** `dept_code === 'STORE' OR role_level >= 5`
- **Grants:** Ability to issue/deduct stock from store
- **MANDATORY:** All stock-deduction API routes must use this middleware

---

## Department Codes & Their Primary Roles

| Dept Code | Department | Primary Access |
|---|---|---|
| PROD | Production | Production, Daily Report, Grades, Machines |
| RMS | Raw Material Store | Raw Material, Inventory, GRN |
| INV | Inventory | Inventory, GRN, Stock Ledger |
| STORE | Store Management | Store, Indent issue, Stock |
| INDENT | Indent Management | Indent, PIIMAS |
| PUR | Purchase | Purchase Orders, Vendors |
| QC | Quality | Quality Tests, GRN QC |
| MAINT | Maintenance | Maintenance, Equipment |
| UTIL | Utility | Utility Readings, Sections |
| DISP | Dispatch | Dispatch, FG Warehouse |
| SALES | Sales | Sales Orders, Customers |
| HR | HR & Payroll | Employees, Attendance, Payroll |
| SEC | Security | Gate Log, Visitors |
| LAB | Laboratory | Lab Tests |
| FIN | Finance | Finance Ledger, Payments |
| ADMIN | Administration | All (admin users) |
| EHS | EHS | Incidents, Compliance |
| SCRAP | Scrap Management | Scrap Records |
| PACK | Packing | Packing Records |
| FGW | Finished Goods Warehouse | FG Stock, Rack Locations |

---

## Permission Matrix (Module Access by Role Level)

| Module | L1 | L2 | L3 | L4 | L5 |
|---|---|---|---|---|---|
| Dashboard | View | View | View | View | View |
| Production - View | Yes | Yes | Yes | Yes | Yes |
| Production - Enter | Yes | Yes | Yes | Yes | Yes |
| Production - Approve | No | Yes | Yes | Yes | Yes |
| Quality - View | Yes | Yes | Yes | Yes | Yes |
| Quality - Enter | Yes | Yes | Yes | Yes | Yes |
| Quality - Approve | No | No | Yes | Yes | Yes |
| Indent - Raise | Yes | Yes | Yes | Yes | Yes |
| Indent - L1 Approve | No | Yes | Yes | Yes | Yes |
| Indent - L2 Approve | No | No | Yes | Yes | Yes |
| Indent - L3 Approve | No | No | No | Yes | Yes |
| Indent - Issue (Store) | No | No | No | No | Yes (or STORE dept) |
| Purchase - View | Yes | Yes | Yes | Yes | Yes |
| Purchase - Create PO | No | No | Yes | Yes | Yes |
| Purchase - Approve PO | No | No | No | Yes | Yes |
| HR - View Own | Yes | Yes | Yes | Yes | Yes |
| HR - Admin | No | No | HR+L3 | HR+L4 | Yes |
| Finance - View | No | No | Yes | Yes | Yes |
| Finance - Confirm Payment | No | No | No | Yes | Yes |
| Reports - Dept | Yes | Yes | Yes | Yes | Yes |
| Reports - All | No | No | No | Yes | Yes |
| Admin - Users | No | No | No | No | Yes |
| Admin - Roles | No | No | No | No | Yes |
| Admin - Audit Log | No | No | No | No | Yes |

---

## Approval Chains

### Indent Approval
```
Raised by: L1/L2/L3/L4/L5 (any dept)
L1 Approve: L2+ (usually dept supervisor)
L2 Approve: L3+ (usually dept manager)
L3 Approve: L4+ (Plant Head) -> triggers PO
Reject: At any level by approver
```

### Purchase Order Approval
```
Created by: L3+ (Purchase dept)
Approved by: L4+ (Plant Head)
```

### Payroll Approval
```
Generated by: HR Admin (HR dept + L3+)
Approved by: L4+ (Plant Head)
```

### Quality Test Approval
```
Test entered by: L1+ (Lab/QC dept)
Approved by: L3+ (Quality Manager)
```

---

## Security Considerations

1. **JWT tokens expire in 8 hours** — users must re-login after shift
2. **Brute force protection:** 50 login attempts per IP per 15 minutes
3. **Production:** JWT_SECRET must be >=32 chars; server refuses to start otherwise
4. **Must-change-password:** New users set with temp passwords are blocked until changed
5. **Soft deletes:** Deactivated users cannot login (`is_active=false` check in auth middleware)
6. **Audit log:** All admin actions logged with user_id, action, old/new data, IP

---

*Last updated: 2026-07-17 | See 01_ARCHITECTURE for guard middleware details*
