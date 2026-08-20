require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const pool = require('../src/db/pool');

async function inspect() {
  const { rows: tables } = await pool.query(`
    SELECT table_name FROM information_schema.tables 
    WHERE table_schema = 'public' 
      AND (table_name LIKE '%fin%' OR table_name LIKE '%acc%' OR table_name LIKE '%vouch%' OR table_name LIKE '%pay%' OR table_name LIKE '%ledg%' OR table_name LIKE '%pur%')
    ORDER BY table_name
  `);
  console.log('Finance/Procurement tables:', tables.map(t => t.table_name));

  const targets = [
    'indents', 'indent_items',
    'purchase_orders', 'po_items',
    'grn', 'grn_items',
    'vendors', 'materials', 'stock_ledger',
    'vendor_bills', 'bills', 'purchase_invoices',
    'payments', 'vendor_payments', 'finance_vouchers'
  ];

  for (const t of targets) {
    const { rows: cols } = await pool.query(
      `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = $1 ORDER BY ordinal_position`,
      [t]
    );
    if (cols.length) {
      console.log(`\n=== Table: ${t} (${cols.length} columns) ===`);
      console.log(cols.map(c => `${c.column_name}: ${c.data_type}`).join(', '));
    } else {
      console.log(`\n--- Table: ${t} does NOT exist yet ---`);
    }
  }

  pool.end();
}

inspect().catch(e => {
  console.error(e);
  pool.end();
});
