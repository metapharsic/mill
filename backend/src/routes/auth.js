require('dotenv').config();
const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../db/pool');
const JWT_SECRET = process.env.JWT_SECRET || 'mk_paper_mill_jwt_secret_change_this';
const { auth } = require('../middleware/auth');

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const identifier = String(email || '').trim();
  if (!identifier || !password)
    return res.status(400).json({ success: false, message: 'Email / Employee ID and password required' });

  try {
    const { rows } = await pool.query(
      `SELECT u.*, r.name AS role, r.level AS role_level, r.permissions,
              d.name AS department, d.code AS dept_code
       FROM users u
       JOIN roles r ON u.role_id = r.id
       LEFT JOIN departments d ON u.department_id = d.id
       WHERE (LOWER(u.email) = LOWER($1) OR UPPER(u.employee_code) = UPPER($1) OR LOWER(u.name) = LOWER($1))
         AND u.is_active = true`,
      [identifier]
    );
    if (!rows.length)
      return res.status(401).json({ success: false, message: 'Invalid credentials' });

    const user = rows[0];
    if (!user.password_hash) {
      return res.status(401).json({ success: false, message: 'Account password not configured' });
    }

    const valid = await bcrypt.compare(String(password), user.password_hash);
    if (!valid)
      return res.status(401).json({ success: false, message: 'Invalid credentials' });

    await pool.query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);

    // HRMS link — own employee record (doc 23 §11)
    let emp = {};
    try {
      const empRec = await pool.query(
        `SELECT id AS emp_id, is_dept_head FROM employees
         WHERE user_id = $1 AND is_active = true ORDER BY id LIMIT 1`,
        [user.id]
      );
      emp = empRec.rows[0] || {};
    } catch (empErr) {
      console.warn('Employees lookup skipped:', empErr.message);
    }

    const token = jwt.sign(
      { userId: user.id },
      JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
    );

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        employee_code: user.employee_code,
        role: user.role,
        role_level: user.role_level,
        permissions: user.permissions,
        department: user.department,
        dept_code: user.dept_code,
        shift: user.shift,
        must_change_password: user.must_change_password,
        department_id: user.department_id,
        // HRMS additions
        emp_id: emp.emp_id || null,
        is_dept_head: emp.is_dept_head || false,
        is_hr_admin: user.dept_code === 'HR' && (user.role_level || 0) >= 3,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, message: 'Server error: ' + err.message });
  }
});

// GET /api/auth/me
router.get('/me', auth, (req, res) => {
  res.json({ success: true, user: req.user });
});

// POST /api/auth/change-password
router.post('/change-password', auth, async (req, res) => {
  const { current_password, new_password } = req.body;
  if (!current_password || !new_password)
    return res.status(400).json({ success: false, message: 'Both passwords required' });
  if (new_password.length < 6)
    return res.status(400).json({ success: false, message: 'Password min 6 chars' });
  try {
    const { rows } = await pool.query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
    const valid = await bcrypt.compare(current_password, rows[0].password_hash);
    if (!valid)
      return res.status(401).json({ success: false, message: 'Current password wrong' });
    const hash = await bcrypt.hash(new_password, 10);
    await pool.query('UPDATE users SET password_hash = $1, must_change_password = false, updated_at = NOW() WHERE id = $2', [hash, req.user.id]);
    res.json({ success: true, message: 'Password changed' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
