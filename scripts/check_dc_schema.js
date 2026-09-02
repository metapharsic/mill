const path = require('path');
const pool = require(path.join(__dirname, '../backend/src/db/pool'));

async function checkDCSchema() {
  const client = await pool.connect();
  const t1 = await client.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'inbound_dc' ORDER BY ordinal_position");
  console.log('--- inbound_dc columns ---');
  t1.rows.forEach(r => console.log(`  ${r.column_name}: ${r.data_type}`));

  const t2 = await client.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'inbound_dc_items' ORDER BY ordinal_position");
  console.log('\n--- inbound_dc_items columns ---');
  t2.rows.forEach(r => console.log(`  ${r.column_name}: ${r.data_type}`));

  client.release();
  await pool.end();
}

checkDCSchema().catch(console.error);
