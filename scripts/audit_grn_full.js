const path = require('path');
const pool = require(path.join(__dirname, '../backend/src/db/pool'));

async function inspectGrn() {
  console.log('=== ALL GRNS WITH ITEM COUNTS & DETAILS ===');
  const { rows } = await pool.query(`
    SELECT 
      g.id, 
      g.grn_number, 
      g.date, 
      g.created_at, 
      g.status, 
      g.invoice_number, 
      g.challan_number,
      v.name as vendor_name,
      COUNT(gi.id) as item_count,
      COALESCE(SUM(gi.received_qty), 0) as total_qty,
      COALESCE(SUM(gi.total_amount), 0) as total_amount
    FROM grn g
    LEFT JOIN vendors v ON g.vendor_id = v.id
    LEFT JOIN grn_items gi ON gi.grn_id = g.id
    GROUP BY g.id, g.grn_number, g.date, g.created_at, g.status, g.invoice_number, g.challan_number, v.name
    ORDER BY g.id DESC;
  `);

  console.log(`Total GRN records: ${rows.length}\n`);
  for (const r of rows) {
    console.log(`ID: ${String(r.id).padStart(3)} | GRN: ${r.grn_number.padEnd(20)} | Date: ${String(r.date).slice(0,10)} | Items: ${r.item_count} | Qty: ${Number(r.total_qty).toFixed(2)} | Val: ₹${Number(r.total_amount).toFixed(2)} | Vendor: ${r.vendor_name || 'N/A'} | Inv: ${r.invoice_number || 'N/A'}`);
  }

  console.log('\n=== CHECKING IF ANY GRN ITEMS EXIST WITHOUT A GRN HEADER ===');
  const orphanItems = await pool.query(`
    SELECT gi.id, gi.grn_id, gi.material_id, gi.received_qty, gi.created_at
    FROM grn_items gi
    LEFT JOIN grn g ON gi.grn_id = g.id
    WHERE g.id IS NULL;
  `);
  console.log(`Orphan items count: ${orphanItems.rows.length}`);

  console.log('\n=== CHECKING STOCK LEDGER GRN INWARD TRANSACTIONS WITHOUT GRN RECORD ===');
  const ledgerGrns = await pool.query(`
    SELECT sl.id, sl.transaction_type, sl.reference_id, sl.reference_type, sl.quantity, sl.date, sl.created_at, m.name as mat_name
    FROM stock_ledger sl
    LEFT JOIN materials m ON sl.material_id = m.id
    WHERE sl.transaction_type ILIKE '%grn%' OR sl.transaction_type ILIKE '%inward%' OR sl.transaction_type = 'in'
    ORDER BY sl.id DESC
    LIMIT 30;
  `);
  console.log(`Recent Stock Ledger GRN/Inward entries: ${ledgerGrns.rows.length}`);
  for (const l of ledgerGrns.rows) {
    console.log(`Ledger #${l.id} | Type: ${l.transaction_type} | Ref: ${l.reference_id} (${l.reference_type}) | Material: ${l.mat_name} | Qty: ${l.quantity} | Date: ${l.date} | Created: ${l.created_at}`);
  }

  await pool.end();
}

inspectGrn().catch(err => {
  console.error(err);
  process.exit(1);
});
