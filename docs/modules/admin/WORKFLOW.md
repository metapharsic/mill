# Admin Module — Full Workflow & Rules

## Overview
System administration for user management, role assignment, department management,
audit log viewing, and system configuration. All actions logged to audit_log.

## Key Files
| File | Purpose |
|---|---|
| `backend/src/routes/admin.js` | Admin endpoints |
| `frontend/src/pages/Admin.jsx` | Admin UI |
| DB: `users`, `roles`, `departments`, `audit_log` | Core tables |

## Access: Level 5 (Admin) ONLY for all write operations

## API Endpoints

### Users
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/admin/users` | L3+ | List users (filter: dept, role, is_active) |
| GET | `/admin/users/:id` | L3+ | Single user detail |
| POST | `/admin/users` | L5 | Create user account |
| PUT | `/admin/users/:id` | L5 | Update user |
| PUT | `/admin/users/:id/reset-password` | L4+ | Reset to temp password |
| PUT | `/admin/users/:id/deactivate` | L5 | Soft-deactivate user |
| PUT | `/admin/users/:id/activate` | L5 | Re-activate user |

### Roles
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/admin/roles` | L3+ | List roles |
| POST | `/admin/roles` | L5 | Create role |

### Departments
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/admin/departments` | L1+ | List departments |
| POST | `/admin/departments` | L5 | Create department |
| PUT | `/admin/departments/:id` | L5 | Update department |

### Audit Log
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/admin/audit-log` | L4+ | Audit log (filter: module, action, user_id, from, to) |

### System
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/admin/stats` | L4+ | System stats (user counts, active sessions) |

## User Fields
| Field | Description |
|---|---|
| `name` | Full name |
| `username` | Login username (unique) |
| `password_hash` | bcrypt hash — never expose |
| `role_id` | FK → roles |
| `role_level` | Denormalized level (1-5) |
| `department_id` | FK → departments |
| `dept_code` | Denormalized dept code |
| `employee_code` | Links to employees table |
| `is_active` | Soft-delete flag |
| `must_change_password` | Force password change on next login |

## Password Reset Flow
```
PUT /admin/users/:id/reset-password (L4+):
  1. Generate temp password (random 8 chars)
  2. bcrypt hash temp password
  3. UPDATE users SET password_hash=$1, must_change_password=true WHERE id=$2
  4. Return temp password ONCE (not stored in plaintext)
  5. User MUST change password on next login (server blocks all routes until changed)
```

## must_change_password Gate
When `users.must_change_password = true`:
- Auth middleware sets flag on `req.user`
- All routes EXCEPT these 3 are blocked:
  1. `POST /api/auth/change-password`
  2. `GET /api/auth/me`
  3. `POST /api/auth/logout`
- Return 403 with message: "Password change required"

## Role Assignment Rule
Constraint: `cannot assign role with level >= own level`
- L5 Admin can assign any level (1-5)
- L4 Plant Head can assign up to L3
- L3 Manager cannot assign roles
(Enforced in POST /admin/users and PUT /admin/users/:id)

## Audit Log Table Schema
```sql
audit_log (
  id SERIAL PRIMARY KEY,
  user_id INTEGER,           -- Who did it
  action VARCHAR(100),       -- SHIFT_OPENED, REEL_CREATED, NCR_RAISED, etc.
  module VARCHAR(50),        -- Production, Quality, HR, etc.
  record_id INTEGER,         -- Which record was affected
  old_data JSONB,            -- State before
  new_data JSONB,            -- State after
  ip_address VARCHAR(45),    -- Client IP
  created_at TIMESTAMPTZ DEFAULT NOW()
)
```

## Common Action Codes in Audit Log
| Action | Module |
|---|---|
| SHIFT_OPENED / SHIFT_CLOSED | Production |
| REEL_CREATED / REEL_STATUS_CHANGED | Production |
| DOWNTIME_LOGGED / DOWNTIME_CLOSED | Production |
| NCR_RAISED | Quality |
| USER_CREATED / USER_UPDATED | Admin |
| PASSWORD_RESET | Admin |
| PAYROLL_GENERATED / PAYROLL_APPROVED | HR |

## Department Fields
| Field | Description |
|---|---|
| `name` | Department full name |
| `code` | Short code (PROD, QC, MAINT, STORE, HR, UTIL, ADMIN, etc.) |
| `category` | production / support / management |
| `is_active` | Soft-delete flag |

## Rules
1. Admin cannot deactivate their own account
2. Password reset: L4+ can reset anyone's password; L5 for all
3. Never hard-delete users — `is_active=false` only
4. All user mutations auto-logged to audit_log
5. Username must be unique — DB UNIQUE constraint
6. Role assignment: cannot exceed own role_level (except L5 Admin)
7. Department codes must be unique — used throughout as `dept_code` shortcut

## Common Query Patterns
```sql
-- Active user count by department
SELECT d.name, COUNT(*) AS users
FROM users u JOIN departments d ON d.id = u.department_id
WHERE u.is_active = true
GROUP BY d.id, d.name ORDER BY users DESC;

-- Recent admin actions
SELECT u.name AS admin, al.action, al.module, al.created_at
FROM audit_log al
JOIN users u ON u.id = al.user_id
WHERE al.module = 'Admin'
ORDER BY al.created_at DESC LIMIT 50;

-- Users with pending password change
SELECT name, username, dept_code FROM users
WHERE must_change_password = true AND is_active = true;
```
