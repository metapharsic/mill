const pool = require('../backend/src/db/pool');

async function checkHolly() {
  const { rows } = await pool.query("SELECT id, equipment_name, sno, section_id FROM section_equipment WHERE LOWER(equipment_name) LIKE '%holly%'");
  console.log('Holly rolls in section_equipment:', rows);
  await pool.end();
}

checkHolly().catch(console.error);
