const pool = require('../src/db/pool');

async function test() {
  const { rows: poCols } = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'purchase_orders'");
  const { rows: itemCols } = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'po_items'");
  console.log('purchase_orders columns:', poCols.map(c => c.column_name));
  console.log('po_items columns:', itemCols.map(c => c.column_name));
  await pool.end();
}

test().catch(console.error);
