require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const pool = require('../src/db/pool');

async function main() {
  const grnCount = await pool.query(`SELECT COUNT(*) FROM grn`);
  const grnItemsCount = await pool.query(`SELECT COUNT(*) FROM grn_items`);
  const ledgerCount = await pool.query(`SELECT COUNT(*) FROM stock_ledger WHERE transaction_type = 'grn' OR reference_type = 'IGRN'`);
  const grns = await pool.query(`
    SELECT g.id, g.grn_number, g.date, g.invoice_number, g.total_value, g.grand_total, v.name as vendor_name,
      (SELECT COUNT(*) FROM grn_items gi WHERE gi.grn_id = g.id) as item_count
    FROM grn g
    LEFT JOIN vendors v ON g.vendor_id = v.id
    ORDER BY g.id DESC
    LIMIT 15
  `);
  
  console.log('GRN count in grn table:', grnCount.rows[0].count);
  console.log('GRN items count in grn_items table:', grnItemsCount.rows[0].count);
  console.log('GRN entries in stock_ledger:', ledgerCount.rows[0].count);
  console.log('\nLatest GRNs:');
  console.table(grns.rows);

  // Check inward / stock_ledger references
  const ledgerRefTypes = await pool.query(`
    SELECT reference_type, transaction_type, COUNT(*), SUM(in_qty) as total_in, SUM(value) as total_val
    FROM stock_ledger
    GROUP BY reference_type, transaction_type
  `);
  console.log('\nStock ledger transaction summary:');
  console.table(ledgerRefTypes.rows);

  await pool.end();
}

main().catch(console.error);
