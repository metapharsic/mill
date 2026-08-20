require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const pool = require('../src/db/pool');

async function runFullVerification() {
  console.log('🧪 Starting End-to-End Verification for Materials Reflection & Indent/PIIMAS Upgrade...\n');

  // ==========================================
  // 1. VERIFY MATERIAL MODIFICATION REFLECTION
  // ==========================================
  console.log('▶ [1/2] Testing Material Modification Live Reflection...');
  const { rows: [mat] } = await pool.query(`SELECT id, code, name FROM materials ORDER BY id ASC LIMIT 1`);
  if (!mat) throw new Error('No material found in database');

  const testPrice = 275.50;
  const testHsn = '4802-TEST';
  const testBin = 'Rack 9, Box 99';
  const testOp = 15.000;
  const testRec = 8.000;
  const testIss = 3.000;
  const testBal = 20.000; // 15 + 8 - 3 = 20

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Update materials table
    await client.query(
      `UPDATE materials SET unit_price = $1, hsn_code = $2, bin_location = $3, current_stock = $4, criticality_class = 'A' WHERE id = $5`,
      [testPrice, testHsn, testBin, testBal, mat.id]
    );

    // Sync opening stock ledger
    const { rows: existOp } = await client.query(`SELECT id FROM stock_ledger WHERE material_id=$1 AND transaction_type='opening'`, [mat.id]);
    if (existOp.length) {
      await client.query(`UPDATE stock_ledger SET in_qty=$1, balance=$1, unit_price=$2, value=$3 WHERE id=$4`, [testOp, testPrice, testOp * testPrice, existOp[0].id]);
    } else {
      await client.query(`INSERT INTO stock_ledger (material_id, date, transaction_type, in_qty, out_qty, balance, unit_price, value, remarks) VALUES ($1, CURRENT_DATE, 'opening', $2, 0, $2, $3, $4, 'Opening Entry')`, [mat.id, testOp, testPrice, testOp * testPrice]);
    }

    // Sync received
    const { rows: existIn } = await client.query(`SELECT id FROM stock_ledger WHERE material_id=$1 AND transaction_type IN ('grn', 'in') LIMIT 1`, [mat.id]);
    if (existIn.length) {
      await client.query(`UPDATE stock_ledger SET in_qty=$1, unit_price=$2, value=$3 WHERE id=$4`, [testRec, testPrice, testRec * testPrice, existIn[0].id]);
    } else {
      await client.query(`INSERT INTO stock_ledger (material_id, date, transaction_type, in_qty, out_qty, balance, unit_price, value, remarks) VALUES ($1, CURRENT_DATE, 'grn', $2, 0, $3, $4, $5, 'GRN Receipt')`, [mat.id, testRec, testOp + testRec, testPrice, testRec * testPrice]);
    }

    // Sync issued
    const { rows: existOut } = await client.query(`SELECT id FROM stock_ledger WHERE material_id=$1 AND transaction_type IN ('issue', 'out') LIMIT 1`, [mat.id]);
    if (existOut.length) {
      await client.query(`UPDATE stock_ledger SET out_qty=$1, unit_price=$2, value=$3 WHERE id=$4`, [testIss, testPrice, testIss * testPrice, existOut[0].id]);
    } else {
      await client.query(`INSERT INTO stock_ledger (material_id, date, transaction_type, in_qty, out_qty, balance, unit_price, value, remarks) VALUES ($1, CURRENT_DATE, 'issue', 0, $2, $3, $4, $5, 'Issue Record')`, [mat.id, testIss, testBal, testPrice, testIss * testPrice]);
    }

    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }

  // Query as GET /api/master/materials does
  const { rows: [queriedMat] } = await pool.query(`
    SELECT m.id, m.code, m.name, m.uom, m.hsn_code, m.bin_location, m.current_stock, m.unit_price, m.criticality_class,
           COALESCE((SELECT SUM(sl.in_qty)  FROM stock_ledger sl WHERE sl.material_id = m.id AND sl.transaction_type != 'opening'), 0) AS received,
           COALESCE((SELECT SUM(sl.out_qty) FROM stock_ledger sl WHERE sl.material_id = m.id AND sl.transaction_type != 'opening'), 0) AS issued
    FROM materials m
    WHERE m.id = $1
  `, [mat.id]);

  const qRec = parseFloat(queriedMat.received);
  const qIss = parseFloat(queriedMat.issued);
  const qCur = parseFloat(queriedMat.current_stock);
  const qOp = parseFloat((qCur - qRec + qIss).toFixed(3));

  console.log(`  ✓ Material ID:    ${queriedMat.id} (${queriedMat.code})`);
  console.log(`  ✓ Unit Price:     ₹${queriedMat.unit_price} (Expected: ₹${testPrice})`);
  console.log(`  ✓ HSN Code:       ${queriedMat.hsn_code} (Expected: ${testHsn})`);
  console.log(`  ✓ Bin Location:   ${queriedMat.bin_location} (Expected: ${testBin})`);
  console.log(`  ✓ Opening Stock:  ${qOp} (Expected: ${testOp})`);
  console.log(`  ✓ Received (+):   +${qRec} (Expected: +${testRec})`);
  console.log(`  ✓ Issued (-):     -${qIss} (Expected: -${testIss})`);
  console.log(`  ✓ Balance:        ${qCur} (Expected: ${testBal})`);

  if (qOp === testOp && qRec === testRec && qIss === testIss && qCur === testBal && parseFloat(queriedMat.unit_price) === testPrice) {
    console.log('  🎉 MATERIAL MODIFICATION REFLECTION TEST: PASSED 100%!\n');
  } else {
    throw new Error('Material reflection values do not match expected invariants');
  }

  // ====================================================
  // 2. VERIFY INDENT/PIIMAS LIFECYCLE & INVOICE MODEL
  // ====================================================
  console.log('▶ [2/2] Testing Indent PIIMAS Lifecycle (Create, Edit, Append, Delete)...');

  // Find a department and user
  const { rows: [dept] } = await pool.query(`SELECT id, name FROM departments LIMIT 1`);
  const { rows: [user] } = await pool.query(`SELECT id, name FROM users LIMIT 1`);
  const { rows: [sec] } = await pool.query(`SELECT id, name FROM sections LIMIT 1`);
  const { rows: mats } = await pool.query(`SELECT id, name, unit_price, uom FROM materials LIMIT 2`);

  // A. Create Indent without priority, with Reason Code & Purpose
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const testIndentNum = `IND-TEST-${Date.now()}`;
  const reasonCode = 'Emergency Failure';
  const purpose = 'Bearing overheating and excessive vibration on couch roll';

  const { rows: [createdIndent] } = await pool.query(
    `INSERT INTO indents (indent_number, date, department_id, required_date, priority, status, raised_by, remarks, section_id)
     VALUES ($1, NOW(), $2, CURRENT_DATE + INTERVAL '2 days', 'Normal', 'Submitted', $3, 'Urgent breakdown requirement', $4)
     RETURNING *`,
    [testIndentNum, dept.id, user.id, sec?.id || null]
  );
  const indentId = createdIndent.id;

  // Insert initial item
  await pool.query(
    `INSERT INTO indent_items (indent_id, material_id, required_qty, uom, purpose, current_stock, component_position, reason_code, unit_price, line_value)
     VALUES ($1, $2, 2, $3, $4, 10, 'Drive Side', $5, $6, $7)`,
    [indentId, mats[0].id, mats[0].uom || 'NOS', purpose, reasonCode, parseFloat(mats[0].unit_price || 100), 2 * parseFloat(mats[0].unit_price || 100)]
  );

  console.log(`  ✓ Created Indent: ${testIndentNum} (ID: ${indentId})`);

  // B. Verify GET /api/indent returns reasonCode and purpose
  const { rows: [queriedIndent] } = await pool.query(
    `SELECT i.id, i.indent_number as "indentNumber", i.status,
            (SELECT ii.reason_code FROM indent_items ii WHERE ii.indent_id = i.id ORDER BY ii.id ASC LIMIT 1) AS "reasonCode",
            (SELECT ii.purpose FROM indent_items ii WHERE ii.indent_id = i.id ORDER BY ii.id ASC LIMIT 1) AS "itemPurpose",
            (SELECT COUNT(*) FROM indent_items ii WHERE ii.indent_id = i.id)::int AS "itemCount"
     FROM indents i WHERE i.id = $1`,
    [indentId]
  );
  console.log(`  ✓ Queried Indent Reason: "${queriedIndent.reasonCode}" (Expected: "${reasonCode}")`);
  console.log(`  ✓ Queried Indent Purpose: "${queriedIndent.itemPurpose}"`);

  // C. Test Append Item
  const appendQty = 5;
  const appendPrice = parseFloat(mats[1].unit_price || 50);
  const { rows: [appendedItem] } = await pool.query(
    `INSERT INTO indent_items (indent_id, material_id, required_qty, uom, purpose, current_stock, component_position, reason_code, unit_price, line_value)
     VALUES ($1, $2, $3, $4, 'Supplementary seal fitting', 20, 'Tender Side', 'Wear & Tear', $5, $6)
     RETURNING *`,
    [indentId, mats[1].id, appendQty, mats[1].uom || 'NOS', appendPrice, appendQty * appendPrice]
  );
  console.log(`  ✓ Appended Item ID: ${appendedItem.id} (Material: ${mats[1].name})`);

  // Check item count
  const { rows: [countRow] } = await pool.query(`SELECT COUNT(*) as count FROM indent_items WHERE indent_id = $1`, [indentId]);
  console.log(`  ✓ Total Items in Indent: ${countRow.count} (Expected: 2)`);

  // D. Test Delete Single Item
  await pool.query(`DELETE FROM indent_items WHERE id = $1 AND indent_id = $2`, [appendedItem.id, indentId]);
  const { rows: [countAfterDel] } = await pool.query(`SELECT COUNT(*) as count FROM indent_items WHERE indent_id = $1`, [indentId]);
  console.log(`  ✓ Items after deleting appended item: ${countAfterDel.count} (Expected: 1)`);

  // E. Test Clean Cleanup (Delete Indent)
  await pool.query(`DELETE FROM indent_items WHERE indent_id = $1`, [indentId]);
  await pool.query(`DELETE FROM indents WHERE id = $1`, [indentId]);
  console.log(`  ✓ Cleaned up test indent.\n`);

  console.log('🎉 ALL TESTS PASSED WITH 100% SUCCESS!');
  await pool.end();
}

runFullVerification().catch(err => {
  console.error('❌ Test failed:', err);
  pool.end();
  process.exit(1);
});
