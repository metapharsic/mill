require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const pool = require('../src/db/pool');

function assert(condition, message) {
  if (!condition) {
    console.error(`  ❌ FAIL: ${message}`);
    process.exit(1);
  }
  console.log(`  ✓ PASS: ${message}`);
}

async function runValidation() {
  console.log('===============================================================');
  console.log('🧪 MULTI-AGENT VALIDATION: UNIVERSAL RAW MATERIAL GRN STOCK SYNC');
  console.log('===============================================================');

  const client = await pool.connect();
  try {
    const { rows: [user] } = await client.query('SELECT * FROM users ORDER BY id ASC LIMIT 1');
    const { rows: [vendor] } = await client.query('SELECT * FROM vendors WHERE is_active = true LIMIT 1');
    const { rows: [wastePaperMat] } = await client.query("SELECT * FROM materials WHERE name ILIKE '%NDLKC%' OR code ILIKE '%RM-NDL%' LIMIT 1");
    const { rows: [chemMat] } = await client.query("SELECT * FROM materials WHERE name ILIKE '%starch%' LIMIT 1");

    assert(Boolean(user), `User found: ${user?.name} (ID: ${user?.id})`);
    assert(Boolean(vendor), `Vendor found: ${vendor?.name} (ID: ${vendor?.id})`);
    assert(Boolean(wastePaperMat), `Waste Paper Material found: ${wastePaperMat?.name} (ID: ${wastePaperMat?.id}, Stock: ${wastePaperMat?.current_stock})`);
    assert(Boolean(chemMat), `Chemical Material found: ${chemMat?.name} (ID: ${chemMat?.id}, Stock: ${chemMat?.current_stock})`);

    const initialWPStock = parseFloat(wastePaperMat.current_stock);
    const initialChemStock = parseFloat(chemMat.current_stock);

    // ------------------------------------------------------------------------
    console.log('\n--- 1. Testing FAST INWARD GRN FOR RAW MATERIAL (Waste Paper) ---');
    // ------------------------------------------------------------------------
    await client.query('BEGIN');
    const inQtyWP = 15.5;
    const wpPrice = parseFloat(wastePaperMat.unit_price || 22000);
    const newStockWP = initialWPStock + inQtyWP;

    await client.query(
      `UPDATE materials SET current_stock = $1 WHERE id = $2`,
      [newStockWP, wastePaperMat.id]
    );

    const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const { rows: [seqRes] } = await client.query(`SELECT COUNT(*)+1 AS n FROM grn WHERE date = CURRENT_DATE`);
    const grnNum = `GRN-${stamp}-${String(seqRes.n).padStart(4, '0')}`;

    const { rows: [grnHead] } = await client.query(`
      INSERT INTO grn (grn_number, date, vendor_id, status, received_by, remarks)
      VALUES ($1, CURRENT_DATE, $2, 'Received', $3, 'Test Fast Inward Raw Material')
      RETURNING id, grn_number
    `, [grnNum, vendor.id, user.id]);

    await client.query(`
      INSERT INTO grn_items (grn_id, material_id, po_qty, received_qty, accepted_qty, rejected_qty, uom, unit_price, taxable_amount, total_amount)
      VALUES ($1, $2, $3, $3, $3, 0, $4, $5, $6, $6)
    `, [grnHead.id, wastePaperMat.id, inQtyWP, wastePaperMat.uom, wpPrice, inQtyWP * wpPrice]);

    const { rows: [ledgerEntry] } = await client.query(`
      INSERT INTO stock_ledger (
        material_id, date, transaction_type, reference_type, reference_id,
        in_qty, out_qty, balance, unit_price, value, remarks, created_by, vendor_id
      ) VALUES (
        $1, CURRENT_DATE, 'grn', 'GRN', $2,
        $3, 0, $4, $5, $6, $7, $8, $9
      ) RETURNING id
    `, [
      wastePaperMat.id, grnHead.id,
      inQtyWP, newStockWP, wpPrice, inQtyWP * wpPrice,
      `[GRN ${grnHead.grn_number}] | Party: ${vendor.name} | RM Yard Inward`,
      user.id, vendor.id
    ]);

    await client.query('COMMIT');
    assert(Boolean(ledgerEntry.id), `GRN ${grnHead.grn_number} created and ledger entry #${ledgerEntry.id} recorded.`);

    // ------------------------------------------------------------------------
    console.log('\n--- 2. Testing RAW MATERIALS STORE QUERY LIVE REFLECTION ---');
    // ------------------------------------------------------------------------
    const { rows: rawStoreRows } = await pool.query(`
      SELECT m.id, m.name, m.code, m.current_stock, (m.current_stock * m.unit_price) AS valuation, mc.name as category_name
      FROM materials m
      LEFT JOIN material_categories mc ON m.category_id = mc.id
      WHERE m.id = $1 AND (mc.type = 'Raw Material' OR mc.name ILIKE '%waste%' OR mc.code IN ('CHEM', 'RM', 'WP', 'PULP'))
    `, [wastePaperMat.id]);

    assert(rawStoreRows.length === 1, `Raw Material Store query includes waste paper material.`);
    assert(parseFloat(rawStoreRows[0].current_stock) === newStockWP, `Raw Material Store live stock reflects increment: ${rawStoreRows[0].current_stock} MT (Initial: ${initialWPStock} + ${inQtyWP})`);

    // ------------------------------------------------------------------------
    console.log('\n--- 3. Testing INWARD RECEIPTS (view=items) DATA INTEGRITY ---');
    // ------------------------------------------------------------------------
    const { rows: inwardItems } = await pool.query(`
      SELECT sl.id, sl.date, sl.material_id, sl.in_qty, sl.balance, sl.unit_price, sl.value,
             m.name AS "materialName", m.code AS "materialCode", m.uom, mc.name AS "categoryName"
      FROM stock_ledger sl
      JOIN materials m ON sl.material_id = m.id
      LEFT JOIN material_categories mc ON m.category_id = mc.id
      WHERE sl.id = $1
    `, [ledgerEntry.id]);

    assert(inwardItems.length === 1, `Inward receipts item view returns line item record.`);
    assert(inwardItems[0].materialName === wastePaperMat.name, `Item view contains correct material name: ${inwardItems[0].materialName}`);
    assert(parseFloat(inwardItems[0].in_qty) === inQtyWP, `Item view contains correct in_qty: ${inwardItems[0].in_qty}`);
    assert(parseFloat(inwardItems[0].balance) === newStockWP, `Item view contains correct balance: ${inwardItems[0].balance}`);

    // ------------------------------------------------------------------------
    console.log('\n--- 4. CLEANUP TEST TRANSACTIONS AND RESTORE INITIAL STOCK ---');
    // ------------------------------------------------------------------------
    await client.query('UPDATE materials SET current_stock = $1 WHERE id = $2', [initialWPStock, wastePaperMat.id]);
    await client.query('DELETE FROM stock_ledger WHERE id = $1', [ledgerEntry.id]);
    await client.query('DELETE FROM grn_items WHERE grn_id = $1', [grnHead.id]);
    await client.query('DELETE FROM grn WHERE id = $1', [grnHead.id]);

    const { rows: [restoredMat] } = await pool.query('SELECT current_stock FROM materials WHERE id = $1', [wastePaperMat.id]);
    assert(parseFloat(restoredMat.current_stock) === initialWPStock, `Waste Paper material stock restored cleanly to: ${restoredMat.current_stock}`);

    console.log('\n===============================================================');
    console.log('SUMMARY: All Raw Material GRN stock synchronization tests PASSED.');
    console.log('===============================================================');

  } catch (err) {
    console.error('Test execution error:', err);
    process.exit(1);
  } finally {
    client.release();
    pool.end();
  }
}

runValidation();
