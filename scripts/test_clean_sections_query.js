const pool = require('../backend/src/db/pool');

async function testCleanQuery() {
  const { rows: secs } = await pool.query(`
    SELECT id, name, code, is_active FROM sections WHERE is_active = true ORDER BY name ASC
  `);
  console.log(`Active Master Sections (${secs.length}):`);
  console.table(secs.slice(0, 20));

  const { rows: [eqCount] } = await pool.query('SELECT count(*) FROM section_equipment WHERE is_active = true');
  console.log(`Active Section Equipment Count: ${eqCount.count}`);

  await pool.end();
}

testCleanQuery().catch(console.error);
