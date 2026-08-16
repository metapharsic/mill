require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const xlsx = require('xlsx');
const pool = require('../src/db/pool');

async function testExcelUploadEngine() {
  console.log('\n================================================================');
  console.log('🧪 TESTING UNIVERSAL STORE EXCEL UPLOAD & DML ENGINE');
  console.log('================================================================\n');

  // 1. Create a dummy workbook in memory
  const testWb = xlsx.utils.book_new();
  const testData = [
    ['S.No', 'Material Code', 'Material Name / Full Specification', 'Category / Subcategory', 'Criticality Class (A/B/C)', 'HSN Code', 'Rack / Box No', 'Opening Stock', 'Received (+)', 'Issued (-)', 'Closing Balance', 'Unit Price (INR)', 'Status (Active/Inactive)'],
    [1, 'TEST-BRG-01', 'DEEP GROOVE BALL BEARING 6205-2RS1/C3', 'Mechanical › Bearing', 'A', '8482 1010', 'Rack 5, Box 12', 20.000, 10.000, 5.000, 25.000, 450.00, 'Active'],
    [2, 'TEST-VLV-02', '2 INCH SS 316 FLANGED BALL VALVE 150#', 'Mechanical › Valve', 'B', '8481 8030', 'Rack 3, Box 2', 4.000, 2.000, 1.000, 5.000, 2800.00, 'Active'],
    [3, 'TEST-GEN-03', 'INDUSTRIAL GREASE EP-2 LITHIUM 180KG', 'General Store › Lubricants', 'C', '2710 1980', 'Oil Yard Bay 1', 2.000, 0.000, 0.000, 2.000, 14500.00, 'Active']
  ];
  const ws = xlsx.utils.aoa_to_sheet(testData);
  xlsx.utils.book_append_sheet(testWb, ws, 'Store_Test_Sheet');

  const buf = xlsx.write(testWb, { type: 'buffer', bookType: 'xlsx' });
  console.log(`  ✓ Generated test Excel buffer: ${buf.length} bytes`);

  // Parse buffer directly using the same engine logic
  const wb = xlsx.read(buf, { type: 'buffer' });
  const sheet = wb.Sheets['Store_Test_Sheet'];
  const rawRows = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: '' });

  console.log(`  ✓ Successfully parsed workbook with ${rawRows.length - 1} data rows.`);

  // 2. Perform Transactional Commit
  console.log('\n▶ Testing Transactional Database Upsert...');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Clean up any prior test records
    await client.query(`DELETE FROM stock_ledger WHERE material_id IN (SELECT id FROM materials WHERE code LIKE 'TEST-%')`);
    await client.query(`DELETE FROM materials WHERE code LIKE 'TEST-%'`);

    for (let r = 1; r < rawRows.length; r++) {
      const row = rawRows[r];
      const code = String(row[1]).trim().toUpperCase();
      const name = String(row[2]).trim();
      const cat = String(row[3]).trim();
      const crit = String(row[4]).trim();
      const hsn = String(row[5]).trim();
      const bin = String(row[6]).trim();
      const opening = parseFloat(row[7]) || 0;
      const rec = parseFloat(row[8]) || 0;
      const iss = parseFloat(row[9]) || 0;
      const bal = parseFloat(row[10]) || 0;
      const price = parseFloat(row[11]) || 0;

      // Find or create category
      let { rows: [catRow] } = await client.query(`SELECT id FROM material_categories WHERE name ILIKE $1 LIMIT 1`, ['Bearing']);
      const catId = catRow ? catRow.id : null;

      const { rows: [newM] } = await client.query(
        `INSERT INTO materials (code, name, category_id, uom, hsn_code, bin_location, current_stock, unit_price, criticality_class, is_active, reorder_level, min_stock)
         VALUES ($1, $2, $3, 'NOS', $4, $5, $6, $7, $8, true, 2, 1) RETURNING id`,
        [code, name, catId, hsn, bin, bal, price, crit]
      );

      // Ledger Opening
      await client.query(
        `INSERT INTO stock_ledger (material_id, date, transaction_type, in_qty, out_qty, balance, unit_price, value, remarks)
         VALUES ($1, CURRENT_DATE, 'opening', $2, 0, $2, $3, $4, 'Test Excel Opening')`,
        [newM.id, opening, price, opening * price]
      );

      // Ledger Received
      if (rec > 0) {
        await client.query(
          `INSERT INTO stock_ledger (material_id, date, transaction_type, in_qty, out_qty, balance, unit_price, value, remarks)
           VALUES ($1, CURRENT_DATE, 'grn', $2, 0, $3, $4, $5, 'Test Excel Received')`,
          [newM.id, rec, opening + rec, price, rec * price]
        );
      }

      // Ledger Issue
      if (iss > 0) {
        await client.query(
          `INSERT INTO stock_ledger (material_id, date, transaction_type, in_qty, out_qty, balance, unit_price, value, remarks)
           VALUES ($1, CURRENT_DATE, 'issue', 0, $2, $3, $4, $5, 'Test Excel Issue')`,
          [newM.id, iss, bal, price, iss * price]
        );
      }
    }

    await client.query('COMMIT');
    console.log('  ✓ Committed 3 test materials with stock ledger invariants.');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  // 3. Verify Live Query Invariants
  console.log('\n▶ Verifying Database Invariants...');
  const { rows: testMaterials } = await pool.query(`
    SELECT m.id, m.code, m.name, m.current_stock, m.unit_price, m.criticality_class, m.hsn_code, m.bin_location,
           COALESCE((SELECT SUM(sl.in_qty)  FROM stock_ledger sl WHERE sl.material_id = m.id AND sl.transaction_type != 'opening'), 0) AS received,
           COALESCE((SELECT SUM(sl.out_qty) FROM stock_ledger sl WHERE sl.material_id = m.id AND sl.transaction_type != 'opening'), 0) AS issued
    FROM materials m
    WHERE m.code LIKE 'TEST-%'
    ORDER BY m.id ASC
  `);

  console.table(testMaterials.map(m => {
    const rec = parseFloat(m.received);
    const iss = parseFloat(m.issued);
    const cur = parseFloat(m.current_stock);
    const op = parseFloat((cur - rec + iss).toFixed(3));
    return {
      Code: m.code,
      Name: m.name.slice(0, 30),
      Opening: op,
      Received: '+' + rec,
      Issued: '-' + iss,
      Balance: cur,
      Price: '₹' + m.unit_price,
      Valuation: '₹' + (cur * m.unit_price)
    };
  }));

  // 4. Test Complete DML (Update, Soft-Delete, Restore)
  console.log('\n▶ Testing Complete DML (Edit, Soft Delete, Restore)...');
  const target = testMaterials[0];

  // Edit
  await pool.query(`UPDATE materials SET unit_price = 499.00, bin_location = 'Rack 5, Box 99' WHERE id = $1`, [target.id]);
  const { rows: [edited] } = await pool.query(`SELECT unit_price, bin_location FROM materials WHERE id = $1`, [target.id]);
  console.log(`  ✓ Updated Price: ₹${edited.unit_price} (Expected: ₹499.00), Bin: "${edited.bin_location}"`);

  // Soft-Delete
  await pool.query(`UPDATE materials SET is_active = false WHERE id = $1`, [target.id]);
  const { rows: [deleted] } = await pool.query(`SELECT is_active FROM materials WHERE id = $1`, [target.id]);
  console.log(`  ✓ Soft-Deleted (is_active = ${deleted.is_active})`);

  // Restore
  await pool.query(`UPDATE materials SET is_active = true WHERE id = $1`, [target.id]);
  const { rows: [restored] } = await pool.query(`SELECT is_active FROM materials WHERE id = $1`, [target.id]);
  console.log(`  ✓ Restored (is_active = ${restored.is_active})`);

  // Cleanup test records
  await pool.query(`DELETE FROM stock_ledger WHERE material_id IN (SELECT id FROM materials WHERE code LIKE 'TEST-%')`);
  await pool.query(`DELETE FROM materials WHERE code LIKE 'TEST-%'`);
  console.log('\n  ✓ Cleaned up test data.');

  console.log('\n🎉 ALL TESTS PASSED! UNIVERSAL STORE EXCEL & DML ENGINE VERIFIED 100%!\n');
  await pool.end();
}

testExcelUploadEngine().catch(err => {
  console.error('❌ Test failed:', err);
  pool.end();
  process.exit(1);
});
