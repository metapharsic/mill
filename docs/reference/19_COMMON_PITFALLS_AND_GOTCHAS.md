# MK Paper Mill ERP — Common Pitfalls & Gotchas

> **AI INSTRUCTION:** Read this before implementing or refactoring any code.
> These are project-specific patterns and bugs that frequently occur when writing 
> Node.js/Express, raw PostgreSQL, or state-based React code in this project.

---

## 1. Backend: Database Connection Leaks

The most critical backend bug is leaking database connections by failing to release clients checked out from the pool.

### ❌ The Bad Pattern (Leak)
```javascript
router.put('/items/:id', auth, async (req, res) => {
  const client = await pool.connect();
  await client.query('BEGIN');
  // If an error is thrown here, client.release() is never called!
  const { rows } = await client.query('UPDATE ...');
  await client.query('COMMIT');
  client.release();
  res.json({ success: true });
});
```

###  The Good Pattern (Safe Release)
Always wrap connection checkout inside a `try...catch...finally` block to ensure the client is **always** released back to the pool, even if a query throws an error or the transaction rolls back.

```javascript
router.put('/items/:id', auth, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query('UPDATE ...');
    await client.query('COMMIT');
    res.json({ success: true, data: rows[0] });
  } catch (e) {
    await client.query('ROLLBACK');
    // Forward the error to the Express error handler
    throw e; 
  } finally {
    client.release(); // Enforces connection return
  }
});
```

---

## 2. Backend: Parameter Index Mismatch in Multi-Statements

When writing raw SQL, index placeholders (`$1`, `$2`, etc.) must strictly match their index position in the array. This gets tricky with conditional clauses.

### ❌ The Bad Pattern (Index Out of Order)
```javascript
const conds = [];
const params = [];
if (status) {
  conds.push('status = $1'); // Hardcoded index!
  params.push(status);
}
if (gradeId) {
  conds.push('grade_id = $2'); // Hardcoded index will break if status is missing!
  params.push(gradeId);
}
```

###  The Good Pattern (Dynamic Index Increment)
Use a dynamic index counter to build SQL strings cleanly.

```javascript
const conds = [];
const params = [];
let p = 1;

if (status) {
  conds.push(`status = $${p++}`);
  params.push(status);
}
if (gradeId) {
  conds.push(`grade_id = $${p++}`);
  params.push(gradeId);
}
```

---

## 3. Backend: Route Order Collision in Express

In Express, routes are evaluated in the order they are defined. Static paths defined after parameterized paths will be hijacked.

### ❌ The Bad Pattern (Collision)
```javascript
router.get('/:id', auth, handler1);      // Parametric path
router.get('/summary', auth, handler2);  // "/summary" is caught as id = "summary"!
```

###  The Good Pattern (Correct Order)
Define static/sub-level paths **before** generic parametric paths:

```javascript
router.get('/summary', auth, handler2);
router.get('/:id', auth, handler1);
```

---

## 4. Backend: Swallowing Errors or Crashes

Uncaught rejected promises inside async route handlers will cause Node.js to exit or crash if the handler is not caught properly.

### ❌ The Bad Pattern (Uncaught Async Handler)
```javascript
router.get('/items', auth, async (req, res) => {
  const { rows } = await pool.query('SELECT ...'); // Thrown errors result in unhandled rejection
  res.json({ success: true, data: rows });
});
```

###  The Good Pattern (Error-Handling Wrapper)
Always wrap async routes in the `ar` (async route handler wrapper) imported from the helper module:

```javascript
const { ar } = require('../middleware/helpers');

router.get('/items', auth, ar(async (req, res) => {
  const { rows } = await pool.query('SELECT ...');
  res.json({ success: true, data: rows });
}));
```

---

## 5. Frontend: Reset on Refresh (No URL State)

Because the UI uses state-based routing (`active` page state in App.jsx), reloading the web page resets the user to the Dashboard.

### Gotchas:
*   **Deep Links:** Do not write buttons that redirect users using `window.location.href` to route pages. Use the passed-in `setActive` function prop instead.
*   **Browser Back Button:** Do not expect the browser back button to work. If a page has sub-screens (e.g. view indent detail vs edit indent), handle it via a sub-state key in the page component.

---

## 6. Frontend: Missing Authorization Headers on File Uploads

File uploads using `<input type="file">` must include the JWT token. Standard HTML forms will fail with a `401 Unauthorized` error.

###  The Good Pattern (Multipart Upload Fetch)
```javascript
const handleUpload = async (file) => {
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch('/api/hr/upload', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('token')}` // Mandatory!
      // Do NOT set Content-Type header here; browser must auto-set boundary
    },
    body: formData
  });
  return res.json();
};
```

---

## 7. Database: Safe String Escaping

Never construct query strings by concatenation. This leads to SQL Injection vulnerabilities.

### ❌ The Bad Pattern (Vulnerable)
```javascript
const query = `SELECT * FROM materials WHERE name ILIKE '%${search}%'`; // Vulnerable!
```

###  The Good Pattern (Safe Parameterization)
```javascript
const query = `SELECT * FROM materials WHERE name ILIKE $1`;
const params = [`%${search}%`];
```
