const pool = require('../backend/src/db/pool');

async function inspectSections() {
  const { rows: ps } = await pool.query('SELECT id, section_code, name FROM plant_sections ORDER BY id ASC');
  console.log('plant_sections:');
  ps.forEach(p => console.log(`  [ID: ${p.id}] Code: "${p.section_code}" | Name: "${p.name}"`));

  const { rows: s } = await pool.query('SELECT id, code, name FROM sections ORDER BY id ASC');
  console.log('\nsections:');
  s.forEach(x => console.log(`  [ID: ${x.id}] Code: "${x.code}" | Name: "${x.name}"`));

  await pool.end();
}

inspectSections().catch(console.error);
