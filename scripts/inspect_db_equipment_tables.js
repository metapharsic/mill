const pool = require('../backend/src/db/pool');

async function inspectTables() {
  console.log('=== CHECKING EXISTING TABLES AND DATA RELATED TO MCN / EQUIPMENT ===');

  const queries = [
    { name: 'sections', sql: 'SELECT * FROM sections LIMIT 10' },
    { name: 'plant_sections', sql: 'SELECT * FROM plant_sections LIMIT 10' },
    { name: 'machines', sql: 'SELECT * FROM machines LIMIT 10' },
    { name: 'equipment', sql: 'SELECT * FROM equipment LIMIT 10' },
    { name: 'section_equipment', sql: 'SELECT * FROM section_equipment LIMIT 10' },
    { name: 'machine_positions', sql: 'SELECT * FROM machine_positions LIMIT 10' },
    { name: 'motor_electrical_specs', sql: 'SELECT * FROM motor_electrical_specs LIMIT 10' },
    { name: 'installed_assets', sql: 'SELECT * FROM installed_assets LIMIT 10' }
  ];

  for (const q of queries) {
    try {
      const { rows } = await pool.query(q.sql);
      console.log(`\nTable "${q.name}": ${rows.length} rows returned (sample)`);
      if (rows.length > 0) {
        console.log('Columns:', Object.keys(rows[0]));
        console.log('Sample 1st row:', JSON.stringify(rows[0]));
      }
      const countRes = await pool.query(`SELECT COUNT(*) FROM ${q.name}`);
      console.log(`Total row count in "${q.name}":`, countRes.rows[0].count);
    } catch (err) {
      console.log(`\nTable "${q.name}": ERROR or Table does not exist (${err.message})`);
    }
  }

  await pool.end();
}

inspectTables().catch(console.error);
