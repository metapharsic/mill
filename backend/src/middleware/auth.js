require('dotenv').config();
const jwt = require('jsonwebtoken');
const pool = require('../db/pool');
const JWT_SECRET = process.env.JWT_SECRET || 'mk_paper_mill_jwt_secret_change_this';

const auth = async (req, res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'No token provided' });
  }
  const token = header.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const { rows } = await pool.query(
      `SELECT u.id, u.name, u.email, u.employee_code, u.shift, u.must_change_password,
              u.department_id,
              r.name AS role, r.level AS role_level, r.permissions,
              d.name AS department, d.code AS dept_code,
              (SELECT e.id FROM employees e
                 WHERE e.user_id = u.id AND e.is_active = true
                 ORDER BY e.id LIMIT 1) AS emp_id,
              COALESCE((SELECT e.is_dept_head FROM employees e
                 WHERE e.user_id = u.id AND e.is_active = true
                 ORDER BY e.id LIMIT 1), false) AS is_dept_head
       FROM users u
       JOIN roles r ON u.role_id = r.id
       LEFT JOIN departments d ON u.department_id = d.id
       WHERE u.id = $1 AND u.is_active = true`,
      [decoded.userId]
    );
    if (!rows.length) return res.status(401).json({ success: false, message: 'User not found' });
    req.user = rows[0];
    // HRMS derived flag — HR Admin = HR dept + manager level or above (doc 23 §2.2, cursorrules §29)
    req.user.is_hr_admin = req.user.dept_code === 'HR' && (req.user.role_level || 0) >= 3;
    // Doc31 #24: block everything except change-password/me/logout until temp password is rotated
    const ALLOWLIST = ['/api/auth/change-password', '/api/auth/me', '/api/auth/logout'];
    if (req.user.must_change_password && !ALLOWLIST.includes(req.originalUrl.split('?')[0])) {
      return res.status(403).json({ success: false, message: 'Password change required before continuing', mustChangePassword: true });
    }
    next();
  } catch {
    return res.status(401).json({ success: false, message: 'Invalid token' });
  }
};

const requireLevel = (minLevel) => (req, res, next) => {
  if (req.user.role_level < minLevel) {
    return res.status(403).json({ success: false, message: 'Insufficient permissions' });
  }
  next();
};

const requireStore = (req, res, next) => {
  if (!req.user) return res.status(401).json({ success: false, message: 'Authentication required' });
  if ((req.user.role_level || 0) >= 4) return next();
  if (req.user.dept_code === 'STORE' || req.user.department === 'Store Management' || req.user.department === 'Store') return next();
  return res.status(403).json({ success: false, message: 'Store staff or administrator only' });
};

module.exports = { auth, requireLevel, requireStore };
