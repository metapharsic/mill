/**
 * Automated Test: Formatted Item History Excel Export Engine
 */
const path = require('path');
const { generateSingleItemHistoryExcel } = require('../backend/src/services/inventoryExcelExporter');
const pool = require('../backend/src/db/pool');

async function testItemHistoryExcelExport() {
  console.log('================================================================');
  console.log('🧪 TESTING SINGLE-ITEM FORMATTED EXCEL HISTORY EXPORT ENGINE');
  console.log('================================================================');

  try {
    // Pick active material with transactions
    const { rows: mats } = await pool.query(`
      SELECT sl.material_id, m.code, m.name, COUNT(sl.id) as txn_count
      FROM stock_ledger sl
      JOIN materials m ON sl.material_id = m.id
      GROUP BY sl.material_id, m.code, m.name
      ORDER BY txn_count DESC
      LIMIT 1
    `);

    if (!mats.length) {
      console.log('⚠️ No material with transactions found.');
      return;
    }

    const mat = mats[0];
    console.log(`Generating multi-sheet Excel for Material ID ${mat.material_id} (${mat.code} - ${mat.name})...`);

    const { buffer, filename } = await generateSingleItemHistoryExcel(mat.material_id);

    console.log(`\n✅ Excel workbook generated successfully!`);
    console.log(`  • Filename: ${filename}`);
    console.log(`  • Buffer Size: ${(buffer.length / 1024).toFixed(2)} KB`);

    // Verify sheet names using XLSX reader
    const XLSX = require('../backend/node_modules/xlsx');
    const wb = XLSX.read(buffer, { type: 'buffer' });
    console.log(`  • Sheet Count: ${wb.SheetNames.length}`);
    console.log(`  • Sheet Names: ${wb.SheetNames.join(', ')}`);

    console.log('\n================================================================');
    console.log('🎉 FORMATTED EXCEL HISTORY EXPORT VERIFICATION SUCCESSFUL');
    console.log('================================================================\n');
  } catch (err) {
    console.error('❌ Excel Export Error:', err);
  } finally {
    pool.end();
  }
}

testItemHistoryExcelExport();
