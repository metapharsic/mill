require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const pool = require('../src/db/pool');

async function checkSchema() {
  const tables = ['stock_ledger', 'grn_items', 'grn', 'materials', 'installed_assets', 'po_items', 'purchase_orders'];
  for (const t of tables) {
    const { rows } = await pool.query(`
      SELECT column_name, data_type, udt_name 
      FROM information_schema.columns 
      WHERE table_name = $1 
      ORDER BY ordinal_position
    `, [t]);
    console.log(`=== TABLE: ${t} ===`);
    console.log(rows.map(r => `  ${r.column_name}: ${r.data_type} (${r.udt_name})`).join('\n'));
  }
  await pool.end();
}
checkSchema().catch(console.error);
