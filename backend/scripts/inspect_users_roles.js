const pool = require('../src/db/pool');

async function inspect() {
  const { rows: roles } = await pool.query('SELECT * FROM roles ORDER BY level ASC');
  console.log('--- ROLES ---');
  console.table(roles);

  const { rows: users } = await pool.query(`
    SELECT u.id, u.employee_code, u.name, u.email, u.mobile, r.name as role_name, r.level, d.name as dept_name, u.is_active
    FROM users u
    LEFT JOIN roles r ON u.role_id = r.id
    LEFT JOIN departments d ON u.department_id = d.id
    ORDER BY u.id ASC
  `);
  console.log('--- USERS ---');
  console.table(users);

  await pool.end();
}

inspect().catch(console.error);
