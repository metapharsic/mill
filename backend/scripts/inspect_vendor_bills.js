require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const pool = require('../src/db/pool');

async function main() {
  const tables = ['vendor_bills', 'vendors'];
  for (const t of tables) {
    const { rows } = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = $1 
      ORDER BY ordinal_position
    `, [t]);
    console.log(`=== TABLE: ${t} ===`);
    console.log(rows.map(r => `  ${r.column_name}: ${r.data_type}`).join('\n'));
  }
  await pool.end();
}

main().catch(console.error);
