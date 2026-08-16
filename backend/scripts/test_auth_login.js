require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const pool = require('../src/db/pool');
const bcrypt = require('bcryptjs');

async function testLogin() {
  const { rows: users } = await pool.query('SELECT id, email, password_hash FROM users WHERE is_active = true LIMIT 5');
  console.log('Active users count:', users.length);
  for (const u of users) {
    console.log('Testing user:', u.email);
    try {
      const { rows } = await pool.query(
        `SELECT u.*, r.name AS role, r.level AS role_level, r.permissions,
                d.name AS department, d.code AS dept_code
         FROM users u
         JOIN roles r ON u.role_id = r.id
         LEFT JOIN departments d ON u.department_id = d.id
         WHERE u.email = $1 AND u.is_active = true`,
        [u.email]
      );
      const user = rows[0];
      const empRec = await pool.query(
        `SELECT id AS emp_id, is_dept_head FROM employees
         WHERE user_id = $1 AND is_active = true ORDER BY id LIMIT 1`,
        [user.id]
      );
      console.log('  -> Success for', u.email, 'emp:', empRec.rows[0]);
    } catch (e) {
      console.error('  -> Failed for', u.email, e);
    }
  }
  pool.end();
}
testLogin();
