const express = require('express')
const bcrypt = require('bcryptjs')
const router = express.Router()
const { pool, requireAuth, requireLevel, ar, audit } = require('../middleware/helpers')

// ─── System settings ───────────────────────────────────────────────────────────

router.get('/settings', requireAuth, requireLevel(4), ar(async (req, res) => {
  const { rows } = await pool.query('SELECT key, value, category, label FROM system_settings ORDER BY category, key')
  res.json({ success: true, data: rows })
}))

router.put('/settings', requireAuth, requireLevel(4), ar(async (req, res) => {
  const { settings } = req.body
  for (const s of settings) {
    await pool.query(
      `UPDATE system_settings SET value=$1, updated_by=$2, updated_at=NOW() WHERE key=$3`,
      [s.value, req.user.id, s.key]
    )
  }
  await audit(null, { userId: req.user.id, module: 'admin', action: 'update_settings', ip: req.ip })
  res.json({ success: true })
}))

// ─── Departments ───────────────────────────────────────────────────────────────

router.get('/departments', requireAuth, ar(async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM departments ORDER BY category, name')
  res.json({ success: true, data: rows })
}))

router.post('/departments', requireAuth, requireLevel(5), ar(async (req, res) => {
  const { name, code } = req.body
  const { rows } = await pool.query(
    'INSERT INTO departments (name, code) VALUES ($1, $2) RETURNING *',
    [name, code.toUpperCase()]
  )
  res.json({ success: true, data: rows[0] })
}))

// ─── Roles ─────────────────────────────────────────────────────────────────────

router.get('/roles', requireAuth, requireLevel(4), ar(async (req, res) => {
  const { rows } = await pool.query('SELECT id, name, level, permissions FROM roles ORDER BY level')
  res.json({ success: true, data: rows })
}))

// ─── User management ───────────────────────────────────────────────────────────

router.get('/users', requireAuth, requireLevel(4), ar(async (req, res) => {
  const { rows } = await pool.query(`
    SELECT u.id, u.employee_code, u.name, u.email, u.mobile, u.shift,
           u.is_active, u.must_change_password, u.last_login, u.created_at,
           r.id AS role_id, r.name AS role_name, r.level AS role_level,
           d.id AS department_id, d.name AS department_name, d.code AS dept_code, d.category
    FROM users u
    JOIN roles r ON u.role_id = r.id
    LEFT JOIN departments d ON u.department_id = d.id
    ORDER BY r.level DESC, d.name, u.name
  `)
  res.json({ success: true, data: rows })
}))

router.get('/users/:id', requireAuth, requireLevel(4), ar(async (req, res) => {
  const { rows } = await pool.query(`
    SELECT u.id, u.employee_code, u.name, u.email, u.mobile, u.shift,
           u.is_active, u.must_change_password, u.last_login, u.created_at,
           r.id AS role_id, r.name AS role_name, r.level AS role_level,
           d.id AS department_id, d.name AS department_name, d.code AS dept_code, d.category
    FROM users u
    JOIN roles r ON u.role_id = r.id
    LEFT JOIN departments d ON u.department_id = d.id
    WHERE u.id = $1
  `, [req.params.id])
  if (!rows.length) return res.status(404).json({ success: false, message: 'User not found' })
  res.json({ success: true, data: rows[0] })
}))

router.post('/users', requireAuth, requireLevel(5), ar(async (req, res) => {
  const { name, email, mobile, password, roleId, departmentId, shift, employeeCode } = req.body
  if (!name || !email || !password || !roleId || !departmentId)
    return res.status(400).json({ success: false, message: 'name, email, password, roleId, departmentId required' })
  const hash = await bcrypt.hash(password, 10)
  const { rows } = await pool.query(`
    INSERT INTO users (employee_code, name, email, mobile, password_hash, role_id, department_id, shift, must_change_password, is_active)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,true,true)
    RETURNING id, name, email, role_id, department_id
  `, [employeeCode || null, name, email, mobile || null, hash, roleId, departmentId, shift || null])
  await audit(null, { userId: req.user.id, module: 'admin', action: 'create_user',
    entityId: rows[0].id, newVal: { email, roleId, departmentId }, ip: req.ip })
  res.json({ success: true, data: rows[0] })
}))

router.put('/users/:id', requireAuth, requireLevel(5), ar(async (req, res) => {
  const { roleId, departmentId, shift, isActive, name, mobile } = req.body
  const old = await pool.query('SELECT role_id, department_id, shift, is_active FROM users WHERE id=$1', [req.params.id])
  if (!old.rows.length) return res.status(404).json({ success: false, message: 'User not found' })
  await pool.query(`
    UPDATE users SET role_id=COALESCE($1,role_id), department_id=COALESCE($2,department_id),
      shift=COALESCE($3,shift), is_active=COALESCE($4,is_active),
      name=COALESCE($5,name), mobile=COALESCE($6,mobile), updated_at=NOW()
    WHERE id=$7
  `, [roleId, departmentId, shift, isActive, name, mobile, req.params.id])
  await audit(null, { userId: req.user.id, module: 'admin', action: 'update_user',
    entityId: +req.params.id, oldVal: old.rows[0], newVal: req.body, ip: req.ip })
  res.json({ success: true })
}))

router.put('/users/:id/reset-password', requireAuth, requireLevel(5), ar(async (req, res) => {
  const { newPassword } = req.body
  if (!newPassword || newPassword.length < 6)
    return res.status(400).json({ success: false, message: 'Password must be 6+ chars' })
  const hash = await bcrypt.hash(newPassword, 10)
  await pool.query(
    'UPDATE users SET password_hash=$1, must_change_password=true, updated_at=NOW() WHERE id=$2',
    [hash, req.params.id]
  )
  await audit(null, { userId: req.user.id, module: 'admin', action: 'reset_password',
    entityId: +req.params.id, ip: req.ip })
  res.json({ success: true })
}))

router.put('/users/:id/deactivate', requireAuth, requireLevel(5), ar(async (req, res) => {
  await pool.query('UPDATE users SET is_active=false, updated_at=NOW() WHERE id=$1', [req.params.id])
  await audit(null, { userId: req.user.id, module: 'admin', action: 'deactivate_user',
    entityId: +req.params.id, ip: req.ip })
  res.json({ success: true })
}))

router.put('/users/:id/activate', requireAuth, requireLevel(5), ar(async (req, res) => {
  await pool.query('UPDATE users SET is_active=true, updated_at=NOW() WHERE id=$1', [req.params.id])
  await audit(null, { userId: req.user.id, module: 'admin', action: 'activate_user',
    entityId: +req.params.id, ip: req.ip })
  res.json({ success: true })
}))

// ─── Footsteps (global audit feed) ────────────────────────────────────────────

router.get('/footsteps', requireAuth, requireLevel(4), ar(async (req, res) => {
  const { module: mod, department_id, from, to, limit = 200 } = req.query
  const conds = ['1=1']
  const vals = []
  if (mod)           { conds.push(`al.module=$${vals.length+1}`);              vals.push(mod) }
  if (department_id) { conds.push(`u.department_id=$${vals.length+1}`);        vals.push(+department_id) }
  if (from)          { conds.push(`al.created_at>=$${vals.length+1}::date`);   vals.push(from) }
  if (to)            { conds.push(`al.created_at<$${vals.length+1}::date + 1`);vals.push(to) }
  vals.push(Math.min(+limit, 500))
  const { rows } = await pool.query(`
    SELECT al.id, al.module, al.action, al.record_id, al.created_at,
           u.name AS user_name, u.email,
           r.name AS role_name, r.level AS role_level,
           d.name AS department_name, d.category AS department_category
    FROM audit_log al
    LEFT JOIN users u       ON al.user_id = u.id
    LEFT JOIN roles r       ON u.role_id = r.id
    LEFT JOIN departments d ON u.department_id = d.id
    WHERE ${conds.join(' AND ')}
    ORDER BY al.created_at DESC
    LIMIT $${vals.length}
  `, vals)
  res.json({ success: true, data: rows })
}))

router.get('/footsteps/user/:id', requireAuth, requireLevel(4), ar(async (req, res) => {
  const { rows } = await pool.query(`
    SELECT al.id, al.module, al.action, al.record_id, al.old_data, al.new_data, al.created_at,
           u.name AS user_name, r.name AS role_name, d.name AS department_name
    FROM audit_log al
    LEFT JOIN users u       ON al.user_id = u.id
    LEFT JOIN roles r       ON u.role_id = r.id
    LEFT JOIN departments d ON u.department_id = d.id
    WHERE al.user_id = $1
    ORDER BY al.created_at DESC LIMIT 300
  `, [req.params.id])
  res.json({ success: true, data: rows })
}))

router.get('/footsteps/department/:id', requireAuth, requireLevel(4), ar(async (req, res) => {
  const { rows } = await pool.query(`
    SELECT al.id, al.module, al.action, al.record_id, al.created_at,
           u.name AS user_name, r.name AS role_name
    FROM audit_log al
    LEFT JOIN users u       ON al.user_id = u.id
    LEFT JOIN roles r       ON u.role_id = r.id
    WHERE u.department_id = $1
    ORDER BY al.created_at DESC LIMIT 300
  `, [req.params.id])
  res.json({ success: true, data: rows })
}))

// ─── Approvers control tower ───────────────────────────────────────────────────

router.get('/approvers', requireAuth, requireLevel(4), ar(async (req, res) => {
  const { rows } = await pool.query(`
    SELECT u.id, u.name, u.email, u.is_active,
           r.name AS role_name, r.level AS role_level,
           d.name AS department_name, d.category,
           CASE WHEN r.level >= 4 THEN 'Main Approver'
                WHEN r.level = 3  THEN 'Department Head Manager'
                ELSE 'Staff' END AS approver_type,
           COUNT(al.id) FILTER (WHERE al.action IN ('approve','reject','issue','Approved','Rejected','Issued')) AS approval_actions
    FROM users u
    JOIN roles r ON u.role_id = r.id
    LEFT JOIN departments d ON u.department_id = d.id
    LEFT JOIN audit_log al ON al.user_id = u.id
    WHERE u.is_active = true AND r.level >= 3
    GROUP BY u.id, u.name, u.email, u.is_active, r.name, r.level, d.name, d.category
    ORDER BY r.level DESC, d.name
  `)
  const mainApprovers = rows.filter(r => r.role_level >= 4)
  const departmentHeads = rows.filter(r => r.role_level === 3)
  res.json({ success: true, data: { mainApprovers, departmentHeads } })
}))

// ─── Audit log (legacy endpoint kept) ─────────────────────────────────────────

router.get('/audit', requireAuth, requireLevel(4), ar(async (req, res) => {
  const { rows } = await pool.query(`
    SELECT al.*, u.name AS userName
    FROM audit_log al
    LEFT JOIN users u ON al.user_id = u.id
    ORDER BY al.created_at DESC LIMIT 200
  `)
  res.json({ success: true, data: rows })
}))

// ─── DB stats ─────────────────────────────────────────────────────────────────

router.get('/stats', requireAuth, requireLevel(4), ar(async (req, res) => {
  const { rows } = await pool.query(`
    SELECT
      (SELECT COUNT(*) FROM users WHERE is_active=true)         AS users,
      (SELECT COUNT(*) FROM materials WHERE is_active=true)     AS materials,
      (SELECT COUNT(*) FROM reels)                               AS reels,
      (SELECT COUNT(*) FROM purchase_orders)                    AS pos,
      (SELECT COUNT(*) FROM sales_orders)                       AS sos,
      (SELECT COUNT(*) FROM employees WHERE is_active=true)     AS employees,
      (SELECT COUNT(*) FROM store_indents)                      AS indents
  `)
  res.json({ success: true, data: rows[0] })
}))

module.exports = router
