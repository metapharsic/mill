const pool = require('../src/db/pool');

async function listLogins() {
  const { rows } = await pool.query(`
    SELECT u.id, u.name, u.email, r.name AS role, r.level AS role_level, d.name AS department
    FROM users u
    JOIN roles r ON u.role_id = r.id
    LEFT JOIN departments d ON u.department_id = d.id
    WHERE u.is_active = true
    ORDER BY r.level DESC, u.id ASC;
  `);

  console.log('📌 ACTIVE USERS & PERMISSION LEVELS:');
  console.table(rows);
  await pool.end();
}

listLogins();
