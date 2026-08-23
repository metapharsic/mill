const pool = require('../backend/src/db/pool');
const fs = require('fs');
const path = require('path');

async function run() {
  console.log('Applying migration_store_dept_receiver_a3.sql...');
  const sql = fs.readFileSync(path.join(__dirname, '../db/migration_store_dept_receiver_a3.sql'), 'utf8');
  await pool.query(sql);
  console.log('Migration applied successfully!');
  
  const { rows: depts } = await pool.query('SELECT code, name, category FROM departments ORDER BY id');
  console.log(`Total active departments: ${depts.length}`);
  depts.forEach(d => console.log(` - [${d.code}] ${d.name} (${d.category})`));

  await pool.end();
}

run().catch(err => {
  console.error('Migration error:', err);
  process.exit(1);
});
