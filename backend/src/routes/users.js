const router = require('express').Router();
const bcrypt = require('bcryptjs');
const pool = require('../db/pool');
const { auth, requireLevel } = require('../middleware/auth');

// GET /api/users
router.get('/', auth, requireLevel(3), async (req, res) => {
  try {
    const { is_active } = req.query;
    const params = [];
    let where = '';
    if (is_active === 'true' || is_active === 'false') {
      params.push(is_active === 'true');
      where = `WHERE u.is_active = $1`;
    }
    const { rows } = await pool.query(
      `SELECT u.id, u.employee_code, u.name, u.email, u.mobile, u.shift,
              u.is_active, u.last_login, u.created_at, u.role_id, u.department_id,
              r.name AS role, r.level AS role_level,
              d.name AS department
       FROM users u
       JOIN roles r ON u.role_id = r.id
       LEFT JOIN departments d ON u.department_id = d.id
       ${where}
       ORDER BY u.name`,
      params
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// POST /api/users
router.post('/', auth, requireLevel(5), async (req, res) => {
  const { employee_code, name, email, mobile, password, role_id, department_id, shift } = req.body;
  if (!name || !email || !password || !role_id)
    return res.status(400).json({ success: false, message: 'name, email, password, role_id required' });
  try {
    const hash = await bcrypt.hash(password, 10);
    const { rows } = await pool.query(
      `INSERT INTO users (employee_code, name, email, mobile, password_hash, role_id, department_id, shift)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id, name, email, employee_code`,
      [employee_code, name, email, mobile, hash, role_id, department_id, shift]
    );
    res.status(201).json({ success: true, data: rows[0] });
  } catch (err) {
    if (err.code === '23505')
      return res.status(409).json({ success: false, message: 'Email or employee code already exists' });
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// PUT /api/users/:id
router.put('/:id', auth, requireLevel(5), async (req, res) => {
  const { name, email, mobile, role_id, department_id, shift, is_active } = req.body;
  try {
    await pool.query(
      `UPDATE users SET name=COALESCE($1,name), email=COALESCE($2,email), mobile=COALESCE($3,mobile),
       role_id=COALESCE($4,role_id), department_id=COALESCE($5,department_id), shift=COALESCE($6,shift),
       is_active=COALESCE($7,is_active), updated_at=NOW()
       WHERE id=$8`,
      [name, email, mobile, role_id, department_id, shift, is_active, req.params.id]
    );
    res.json({ success: true, message: 'User updated' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /api/users/roles
router.get('/roles', auth, async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM roles ORDER BY level');
  res.json({ success: true, data: rows });
});

// GET /api/users/departments
router.get('/departments', auth, async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM departments ORDER BY name');
  res.json({ success: true, data: rows });
});

// POST /api/users/:id/reset-password
router.post('/:id/reset-password', auth, requireLevel(5), async (req, res) => {
  const { new_password } = req.body;
  if (!new_password || new_password.length < 6)
    return res.status(400).json({ success: false, message: 'Password min 6 chars' });

  try {
    const hash = await bcrypt.hash(new_password, 10);
    await pool.query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [hash, req.params.id]);
    res.json({ success: true, message: 'Password reset' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
