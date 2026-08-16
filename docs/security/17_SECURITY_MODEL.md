# MK Paper Mill ERP — Security Model

> **AI INSTRUCTION:** Read this before adding or editing any backend API endpoint or modifying authentication flows.
> You must strictly enforce the role level and department checks documented below.

---

## 1. Authentication Flow & Token Management

The system utilizes stateless JWT (JSON Web Tokens) for authenticating users. 

### JWT Settings
* **Secret Key Source:** `process.env.JWT_SECRET` (defaults to `'mk_paper_mill_jwt_secret_change_this'`)
* **Transport Method:** HTTP Authorization Header using Bearer scheme (`Authorization: Bearer <token>`)
* **Token Lifetime:** Typically 8 hours.

### Authentication Middleware (`auth`)
Found in [auth.js](file:///c:/Project/MK%20Paper%20Mill/backend/src/middleware/auth.js). For every incoming request, it:
1. Validates the existence and format of the `Authorization` header.
2. Decodes the user ID from the token payload.
3. Performs a database query on the `users` table to fetch full context and permissions:
   * Joins `roles` to get the role level, name, and permissions.
   * Joins `departments` to get the department code.
   * Checks the `employees` table to assign `emp_id` and check if the user is a department head (`is_dept_head`).
4. Attaches this enriched user object to `req.user`.

---

## 2. Security Middleware Checks

### Role Level Check (`requireLevel`)
Restricts access based on the integer `role_level` (1 to 5):
```javascript
const requireLevel = (minLevel) => (req, res, next) => {
  if (req.user.role_level < minLevel) {
    return res.status(403).json({ success: false, message: 'Insufficient permissions' });
  }
  next();
};
```

### Store Department Check (`requireStore`)
Ensures that only Store staff or System Admins can execute critical stock deductions or adjustments:
```javascript
const requireStore = (req, res, next) => {
  if (req.user.role_level >= 5) return next(); // Admin bypass
  if (req.user.dept_code === 'STORE') return next();
  return res.status(403).json({ success: false, message: 'Store staff only' });
};
```

---

## 3. The Password Change Gate (`must_change_password`)

To enforce security on newly created or reset accounts, the system flags users with `must_change_password = true`.

### How it is enforced:
In [auth.js](file:///c:/Project/MK%20Paper%20Mill/backend/src/middleware/auth.js#L35):
1. The auth middleware blocks **all** endpoints if the user has `must_change_password === true`.
2. An **Allowlist** of routes bypasses this check so the user can actually update their password and query their profile:
   * `/api/auth/change-password`
   * `/api/auth/me`
   * `/api/auth/logout`
3. Any other route accessed while flagged returns a `403 Forbidden` with:
   ```json
   { "success": false, "message": "Password change required before continuing", "mustChangePassword": true }
   ```

---

## 4. Personal Identifiable Information (PII) Masking

HR data is sensitive. The backend masks specific fields in returned JSON payloads based on the requester's identity and privileges.

### Masking Rules:
Sensitive data fields: `aadhar`, `pan`, `bank_account`.

```javascript
// Example helper used in HR route handlers:
function maskTail(val) {
  if (!val) return '';
  const s = String(val);
  return s.length <= 4 ? s : '*'.repeat(s.length - 4) + s.slice(-4);
}
```

### Privilege Hierarchy:
1. **Self Access:** An employee querying their own records (via `/hr/employees/me`) always receives unmasked data.
2. **HR Admin Access:** Users where `req.user.is_hr_admin === true` (HR Department + Role Level >= 3) receive fully unmasked data.
3. **Plant Head/Admin:** Level 4 and Level 5 users receive fully unmasked data.
4. **General/Manager Access:** All other users (including department heads viewing their staff) receive **masked** Aadhar, PAN, and Bank Accounts, and have `basic_salary` hidden entirely.

---

## 5. Summary of Security Matrix

| Action | Min Role Level | Department Constraint | Masking Applied? |
|---|---|---|---|
| Read Own Data | Level 1 (Any) | None | No (Unmasked) |
| Read Department Staff | Level 3 (Manager) | Must match employee's department | Yes (Masked) |
| Read All Employee Records | Level 4 / HR Admin | HR Department only if Level 3 | No (Unmasked) |
| Modify Master Data | Level 5 (Admin) | None | N/A |
| Approve Store Issue/Adjust | Level 2 / Level 3 | STORE Department | N/A |
| Confirm Payments | Level 4 (Plant Head) | None | N/A |
| Submit Indent | Level 1 (Any) | None | N/A |
| Approve L1 Indent | Level 3 (Manager) | STORE Department (Store HOD) | N/A |
| Approve L2/L3 Indent | Level 4 (Plant Head) | None | N/A |
