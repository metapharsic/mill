const pool = require('../src/db/pool');

async function main() {
  const tables = [
    'indents', 'indent_items', 'purchase_orders', 'po_items',
    'store_inward', 'store_outward', 'store_issues', 'stock_ledger',
    'materials', 'categories', 'departments', 'vendors'
  ];
  for (const t of tables) {
    try {
      const cols = await pool.query(
        "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = $1 ORDER BY ordinal_position",
        [t]
      );
      console.log(`\n=== ${t} (${cols.rows.length} columns) ===`);
      console.log(cols.rows.map(c => `${c.column_name} (${c.data_type})`).join(', '));
    } catch (e) {
      console.log(`${t} error: ${e.message}`);
    }
  }
  await pool.end();
}

main().catch(err => {
  console.error(err);
  pool.end();
});
