const pool = require('../src/db/pool');

async function check() {
  const { rows: grns } = await pool.query("SELECT * FROM grn WHERE grn_number = '202608-34'");
  console.log('GRN:', grns[0]);
  if (grns.length) {
    const { rows: items } = await pool.query(`
      SELECT gi.id, m.code, m.name, gi.received_qty, gi.uom, gi.unit_price, gi.taxable_amount, gi.cgst_amount, gi.sgst_amount, gi.total_amount
      FROM grn_items gi
      JOIN materials m ON m.id = gi.material_id
      WHERE gi.grn_id = $1
      ORDER BY gi.id ASC
    `, [grns[0].id]);
    console.log('Items Count:', items.length);
    console.table(items);
  }
  await pool.end();
}

check();
