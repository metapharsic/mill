const pool = require('../backend/src/db/pool');

async function checkExtra() {
  const { rows } = await pool.query('SELECT id, name, sno FROM equipment WHERE sno IS NOT NULL');
  const counts = {};
  rows.forEach(r => {
    counts[r.sno] = (counts[r.sno] || []).concat(r);
  });
  Object.keys(counts).forEach(sno => {
    if (counts[sno].length > 1) {
      console.log(`Duplicate sno in equipment: ${sno}:`, counts[sno]);
    }
  });
  await pool.end();
}

checkExtra().catch(console.error);
