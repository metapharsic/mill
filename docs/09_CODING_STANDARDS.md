# MK Paper Mill ERP — Coding Standards

> Rules every AI assistant and developer MUST follow when writing code for this project.
> These are not suggestions — they are requirements enforced by AGENTS.md.

---

## 1. Before Writing Any Code

### MANDATORY Pre-Checks
1. Read `01_ARCHITECTURE.md` to understand the system
2. Run impact analysis: `codegraph_impact({ target: "symbolName", direction: "upstream" })`
3. Check `06_MODULE_CATALOG.md` to understand which module you're working in
4. Check `07_BUSINESS_ROLES.md` for auth requirements of the feature
5. Review `05_WORKFLOWS.md` if the feature involves a multi-step business process

---

## 2. Backend Standards

### Route File Structure
```javascript
// Always require auth at top unless explicitly public
const { auth, requireLevel, requireStore } = require('../middleware/auth');
const pool = require('../db/pool');  // ALWAYS import from here, never new Pool()
const router = require('express').Router();

// Route pattern
router.get('/path', auth, requireLevel(3), async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM table WHERE id = $1',  // Parameterized ALWAYS
      [req.params.id]
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('[ModuleName]', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
```

### SQL Rules
```javascript
// CORRECT - parameterized
pool.query('SELECT * FROM users WHERE id = $1', [userId])

// WRONG - string concatenation (SQL injection risk, NEVER do this)
pool.query(`SELECT * FROM users WHERE id = ${userId}`)
```

### Transaction Pattern (for multi-step writes)
```javascript
const client = await pool.connect();
try {
  await client.query('BEGIN');
  await client.query('UPDATE indents SET status=$1 WHERE id=$2', ['Issued', indentId]);
  await client.query('INSERT INTO store_indent_log ...', [...params]);  // MANDATORY with indent changes
  await client.query('COMMIT');
} catch (err) {
  await client.query('ROLLBACK');
  throw err;
} finally {
  client.release();
}
```

### Soft Deletes
```javascript
// CORRECT
await pool.query('UPDATE materials SET is_active=false WHERE id=$1', [id])

// WRONG - never hard delete master data
await pool.query('DELETE FROM materials WHERE id=$1', [id])
```

### Response Format
```javascript
// Success
res.json({ success: true, data: rows })
res.json({ success: true, data: rows, total: count })

// Error
res.status(400).json({ success: false, message: 'Descriptive error message' })
res.status(403).json({ success: false, message: 'Insufficient permissions' })
res.status(500).json({ success: false, message: 'Server error' })
```

### Mandatory Middleware on Stock Routes
```javascript
// ALL routes that deduct stock MUST have requireStore
router.post('/issue', auth, requireStore, async (req, res) => { ... })
router.post('/adjustment', auth, requireStore, requireLevel(3), async (req, res) => { ... })
```

---

## 3. Frontend Standards

### Component Structure
```jsx
import React, { useState, useEffect } from 'react'

// API helper (pattern used across all pages)
const token = localStorage.getItem('mk_token')
async function apiFetch(path, opts = {}) {
  const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...opts.headers,
    },
    ...opts,
  })
  return res.json().catch(() => ({ success: false }))
}

export default function ModulePage() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    apiFetch('module/endpoint').then(r => {
      if (r.success) setData(r.data)
    }).finally(() => setLoading(false))
  }, [])

  return <div style={styles.container}>...</div>
}

const styles = {
  container: { padding: 24 },
  // ... all styles as JS objects
}
```

### Styling Rules
```jsx
// CORRECT - inline JS object styles
<div style={{ padding: 24, background: '#f8f8f8', borderRadius: 8 }}>

// WRONG - className with Tailwind or external CSS
<div className="p-6 bg-gray-100 rounded-lg">

// WRONG - importing CSS files (except global styles in main.jsx)
import './Component.css'
```

### Icons
```jsx
// CORRECT
import { Plus, Edit, Trash2, Save, X } from 'lucide-react'
<Plus size={16} />

// WRONG - any other icon library
import { FaPlus } from 'react-icons/fa'
```

### State Management
```jsx
// CORRECT - local state with hooks
const [list, setList] = useState([])
const [selected, setSelected] = useState(null)
const [formOpen, setFormOpen] = useState(false)

// WRONG - no Redux, Zustand, Recoil, or Context (except AuthContext)
```

### No Class Components
```jsx
// CORRECT
export default function MyComponent() { ... }
const MyComponent = () => { ... }

// WRONG
class MyComponent extends React.Component { ... }
```

### Auth-Gated UI
```jsx
// Use user from AuthContext to show/hide UI
import { useAuth } from '../context/AuthContext'
const { user } = useAuth()

// Show only for managers and above
{user.role_level >= 3 && <button>Approve</button>}

// Show only for HR admin
{user.is_hr_admin && <button>Generate Payroll</button>}

// Show only for store staff
{(user.dept_code === 'STORE' || user.role_level >= 5) && <button>Issue</button>}
```

---

## 4. Database Migration Standards

### Adding New Tables
1. Create `db/migration_<descriptive_name>.sql`
2. Always use `IF NOT EXISTS` or `IF NOT EXISTS COLUMN`
3. Add appropriate indexes
4. Document in `03_DATABASE_SCHEMA.md`
5. Run via: `cd backend && npm run db:migrate`

### Migration File Template
```sql
-- Migration: migration_<feature_name>.sql
-- Purpose: <description>
-- Date: YYYY-MM-DD

CREATE TABLE IF NOT EXISTS new_table (
  id SERIAL PRIMARY KEY,
  -- ... columns
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add columns safely
ALTER TABLE existing_table
  ADD COLUMN IF NOT EXISTS new_column VARCHAR(50);

CREATE INDEX IF NOT EXISTS idx_new_table_col ON new_table(column_name);
```

---

## 5. Naming Conventions

### Backend
- Route files: `kebab-case.js` (e.g., `purchase.js`, `dpsImport.js`)
- Functions: `camelCase` (e.g., `computeSectionKPISnapshot`)
- DB columns: `snake_case` (e.g., `created_at`, `is_active`, `role_level`)
- API paths: `kebab-case` (e.g., `/api/purchase-orders`, `/api/read-all`)

### Frontend
- Component files: `PascalCase.jsx` (e.g., `Production.jsx`, `ChemicalStore.jsx`)
- Functions: `camelCase` (e.g., `handleSubmit`, `fetchData`)
- Style objects: `camelCase keys` (e.g., `{ borderRadius: 8, fontSize: 13 }`)
- State vars: `camelCase` (e.g., `const [isOpen, setIsOpen]`)

### Database
- Table names: `snake_case`, plural (e.g., `purchase_orders`, `quality_tests`)
- Column names: `snake_case` (e.g., `created_at`, `vendor_id`, `is_active`)
- FK columns: `<table_singular>_id` (e.g., `vendor_id`, `machine_id`)
- Index names: `idx_<table>_<column>` (e.g., `idx_reels_status`)

---

## 6. Error Handling

### Backend
```javascript
// Always wrap in try/catch
try {
  const { rows } = await pool.query(...)
  res.json({ success: true, data: rows })
} catch (err) {
  console.error('[ModuleName] operation description:', err.message)
  res.status(500).json({ success: false, message: 'Server error' })
}

// Use specific error messages for user-facing errors
if (!req.body.field) {
  return res.status(400).json({ success: false, message: 'Field name is required' })
}
```

### Frontend
```javascript
// Always handle API errors
const r = await apiFetch('module/endpoint', opts)
if (!r.success) {
  alert(r.message || 'An error occurred')  // Or use toast/notification
  return
}
```

---

## 7. Security Checklist (Before Every PR)

- [ ] All new routes have `auth` middleware
- [ ] Stock-deduction routes have `requireStore` middleware
- [ ] No SQL string concatenation anywhere
- [ ] Sensitive data not logged to console in production
- [ ] User input validated/sanitized before DB insert
- [ ] File upload routes restrict file types (multer filters)
- [ ] New tables have appropriate `is_active` for soft-deletes if applicable

---

## 8. Performance Guidelines

- Index columns used in WHERE clauses on large tables
- Use `LIMIT` on list queries (default page size: 50-100)
- Avoid `SELECT *` — specify needed columns
- Use `COUNT(*) FILTER (WHERE ...)` for conditional counts in one query
- Prefer `INSERT ... ON CONFLICT DO UPDATE` over separate SELECT+INSERT
- Paginate large datasets: `LIMIT $1 OFFSET $2`

---

## 9. Testing Before Merging

```bash
# Check server starts cleanly
cd backend && npm start

# Check DB migrations apply cleanly
cd backend && npm run db:migrate

# Run preflight checks
cd backend && npm run preflight

# Check sync status
cd backend && npm run synccheck

# Check frontend builds
cd frontend && npm run build
```

---

*Last updated: 2026-07-17 | These standards are enforced by rules in AGENTS.md*
