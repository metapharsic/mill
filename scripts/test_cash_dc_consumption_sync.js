const pool = require('../backend/src/db/pool');
const { generateItemConsumptionExcel } = require('../backend/src/services/inventoryExcelExporter');

async function testAll() {
  console.log('================================================================');
  console.log('🧪 VERIFYING CASH PURCHASE, JOB WORK DC, & CONSUMPTION ENGINE');
  console.log('================================================================\n');

  try {
    // 1. Verify Cash Purchases DDL & Records
    console.log('1. Testing Cash Purchase Table & Sample Query...');
    const cpRes = await pool.query(`
      SELECT cp.*, cp.voucher_number as "voucherNumber", cp.vendor_name as "vendorName",
             COALESCE((SELECT COUNT(*) FROM cash_purchase_items cpi WHERE cpi.cash_purchase_id = cp.id), 0)::int AS "itemCount"
      FROM cash_purchases cp
      ORDER BY cp.id DESC
      LIMIT 5
    `);
    console.log(`  ✓ Cash Purchases Query Passed (${cpRes.rows.length} records retrieved)`);
    if (cpRes.rows.length > 0) {
      console.log(`    Sample Voucher: ${cpRes.rows[0].voucherNumber} | Vendor: ${cpRes.rows[0].vendorName} | Items: ${cpRes.rows[0].itemCount}`);
    }

    // 2. Verify Item-Wise Consumption Excel Generation
    console.log('\n2. Testing Item-Wise Consumption Excel Generation...');
    const excelRes = await generateItemConsumptionExcel({ from: '2026-01-01', to: '2026-12-31' });
    console.log(`  ✓ Excel Buffer Generated Successfully!`);
    console.log(`    Filename: ${excelRes.filename}`);
    console.log(`    Size: ${(excelRes.buffer.length / 1024).toFixed(2)} KB`);

    // 3. Verify Job Work Transactions
    console.log('\n3. Testing Outward Job Work Records...');
    const jwRes = await pool.query(`
      SELECT sl.id, sl.date, sl.transaction_type, sl.out_qty, sl.remarks, m.name as "material_name", m.code as "material_code"
      FROM stock_ledger sl
      LEFT JOIN materials m ON m.id = sl.material_id
      WHERE sl.transaction_type IN ('job_work', 'out', 'transfer')
      ORDER BY sl.id DESC
      LIMIT 5
    `);
    console.log(`  ✓ Job Work Outward Ledger Query Passed (${jwRes.rows.length} records retrieved)`);

    console.log('\n================================================================');
    console.log('✅ ALL VERIFICATION TESTS PASSED SUCCESSFULLY!');
    console.log('================================================================');
    process.exit(0);
  } catch (err) {
    console.error('❌ Verification Error:', err);
    process.exit(1);
  }
}

testAll();
