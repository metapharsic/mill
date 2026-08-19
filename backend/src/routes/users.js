const router = require('express').Router();
const bcrypt = require('bcryptjs');
const pool = require('../db/pool');
const { auth, requireLevel } = require('../middleware/auth');
// Express 4 does not forward rejected promises from async handlers — without this wrapper a DB
// error leaves the request hanging forever (client spins, no response). Same pattern as inventory.js.
const ar = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// GET /api/users
router.get('/', auth, requireLevel(3), async (req, res) => {
  try {
    const { is_active, department_id, sort_by, sort_order = 'ASC' } = req.query;
    const params = [];
    const where = [];

    if (is_active === 'true' || is_active === 'false') {
      params.push(is_active === 'true');
      where.push(`u.is_active = $${params.length}`);
    }

    if (department_id) {
      params.push(parseInt(department_id));
      where.push(`u.department_id = $${params.length}`);
    }

    // Level 3 Department Heads see their own department users + any operators
    const isDeptHead = (req.user?.role_level || 1) === 3;
    if (isDeptHead && req.user?.department_id) {
      params.push(req.user.department_id);
      where.push(`(u.department_id = $${params.length} OR r.level <= 2)`);
    }

    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const sortMap = {
      code: 'u.employee_code',
      employee_code: 'u.employee_code',
      name: 'u.name',
      email: 'u.email',
      role: 'r.level',
      role_level: 'r.level',
      department: 'd.name',
      section: 's.name',
      section_name: 's.name',
      shift: 'u.shift',
      is_active: 'u.is_active',
      last_login: 'u.last_login',
      created_at: 'u.created_at'
    };
    const direction = String(sort_order).toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
    const orderExpr = sort_by && sortMap[sort_by]
      ? `${sortMap[sort_by]} ${direction} NULLS LAST, u.name ASC`
      : `r.level DESC, u.name ASC`;

    const { rows } = await pool.query(
      `SELECT u.id, u.employee_code, u.name, u.email, u.mobile, u.shift,
              u.is_active, u.last_login, u.created_at, u.role_id, u.department_id, u.section_id,
              r.name AS role, r.level AS role_level,
              d.name AS department,
              s.name AS section_name, s.code AS section_code
       FROM users u
       JOIN roles r ON u.role_id = r.id
       LEFT JOIN departments d ON u.department_id = d.id
       LEFT JOIN sections s ON u.section_id = s.id
       ${whereClause}
       ORDER BY ${orderExpr}`,
      params
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// POST /api/users — Allow Level >= 3 (Store Managers / Dept Heads) to add operators/assistants
router.post('/', auth, requireLevel(3), async (req, res) => {
  const { employee_code, name, email, mobile, password, role_id, department_id, section_id, shift } = req.body;
  if (!name || !email || !password || !role_id)
    return res.status(400).json({ success: false, message: 'name, email, password, role_id required' });

  // Security: Level 3 Managers can only create Level 1 or 2 users for their department
  const userLevel = req.user?.role_level || 1;
  if (userLevel === 3) {
    const { rows: [targetRole] } = await pool.query('SELECT level FROM roles WHERE id = $1', [role_id]);
    if (targetRole && targetRole.level >= 3) {
      return res.status(403).json({ success: false, message: 'Managers can only create Operator and Supervisor accounts' });
    }
  }

  try {
    const hash = await bcrypt.hash(password, 10);
    const { rows } = await pool.query(
      `INSERT INTO users (employee_code, name, email, mobile, password_hash, role_id, department_id, section_id, shift, is_active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9, true) RETURNING id, name, email, employee_code, department_id, section_id`,
      [employee_code || `EMP-${Math.floor(1000 + Math.random() * 9000)}`, name, email, mobile || null, hash, role_id, department_id || null, section_id || null, shift || 'General']
    );
    res.status(201).json({ success: true, data: rows[0] });
  } catch (err) {
    if (err.code === '23505')
      return res.status(409).json({ success: false, message: 'Email or employee code already exists' });
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// PUT /api/users/:id — Allow Level >= 3 (Managers) to update operators
router.put('/:id', auth, requireLevel(3), async (req, res) => {
  const { name, email, mobile, role_id, department_id, section_id, shift, is_active } = req.body;
  try {
    await pool.query(
      `UPDATE users SET
         name=COALESCE($1, name),
         email=COALESCE($2, email),
         mobile=COALESCE($3, mobile),
         role_id=COALESCE($4, role_id),
         department_id=COALESCE($5, department_id),
         section_id=COALESCE($6, section_id),
         shift=COALESCE($7, shift),
         is_active=COALESCE($8, is_active),
         updated_at=NOW()
       WHERE id=$9`,
      [name, email, mobile, role_id, department_id, section_id, shift, is_active, req.params.id]
    );
    res.json({ success: true, message: 'User updated' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// DELETE /api/users/:id — Deactivate / Soft Delete
router.delete('/:id', auth, requireLevel(3), async (req, res) => {
  try {
    await pool.query('UPDATE users SET is_active = false, updated_at = NOW() WHERE id = $1', [req.params.id]);
    res.json({ success: true, message: 'User deactivated successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /api/users/roles
router.get('/roles', auth, ar(async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM roles ORDER BY level');
  res.json({ success: true, data: rows });
}));

// GET /api/users/departments
router.get('/departments', auth, ar(async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM departments ORDER BY name');
  res.json({ success: true, data: rows });
}));

// GET /api/users/sections
router.get('/sections', auth, ar(async (req, res) => {
  const { rows } = await pool.query('SELECT id, name, code, department_id FROM sections ORDER BY name');
  res.json({ success: true, data: rows });
}));

// POST /api/users/:id/reset-password
router.post('/:id/reset-password', auth, requireLevel(3), async (req, res) => {
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

router.use((err, req, res, next) => {
  if (err.code === '23505') return res.status(409).json({ success: false, message: 'Record already exists (duplicate)' });
  console.error(err);
  res.status(500).json({ success: false, message: 'Server error' });
});

module.exports = router;
