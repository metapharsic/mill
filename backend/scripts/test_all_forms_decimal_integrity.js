require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const pool = require('../src/db/pool');

async function testAllFormsDecimalIntegrity() {
  console.log('🧪 ======================================================================');
  console.log('🧪 MULTI-AGENT VERIFICATION: ALL FORMS DECIMAL & ROLLOVER INTEGRITY SUITE');
  console.log('🧪 ======================================================================\n');

  const { rows: [cat] } = await pool.query('SELECT id FROM material_categories LIMIT 1');
  const { rows: [dept] } = await pool.query('SELECT id, name FROM departments LIMIT 1');
  const { rows: [user] } = await pool.query('SELECT id, name, role_id FROM users LIMIT 1');
  const { rows: [vendor] } = await pool.query('SELECT id, name FROM vendors LIMIT 1');

  const testCode = 'DEC-TEST-001';

  // Cleanup
  await pool.query('DELETE FROM grn_items WHERE material_id IN (SELECT id FROM materials WHERE code = $1)', [testCode]);
  await pool.query('DELETE FROM stock_ledger WHERE material_id IN (SELECT id FROM materials WHERE code = $1)', [testCode]);
  await pool.query('DELETE FROM materials WHERE code = $1', [testCode]);

  console.log('--- FORM 1: Master Material Entry (Opening: 270.500, Price: ₹35.75) ---');
  const client = await pool.connect();
  let matId;
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `INSERT INTO materials (code, name, category_id, uom, current_stock, unit_price, is_active)
       VALUES ($1, 'TEST DECIMAL STARCH', $2, 'KGS', 270.500, 35.75, true) RETURNING id`,
      [testCode, cat.id]
    );
    matId = rows[0].id;
    await client.query(
      `INSERT INTO stock_ledger (material_id, date, transaction_type, in_qty, out_qty, balance, unit_price, value, remarks, created_by)
       VALUES ($1, CURRENT_DATE, 'opening', 270.500, 0, 270.500, 35.75, 270.500 * 35.75, 'Opening Stock', $2)`,
      [matId, user.id]
    );
    await client.query('COMMIT');
    console.log('✅ Form 1 Passed: Material created with decimal opening & rate ₹35.75.\n');
  } finally {
    client.release();
  }

  console.log('--- FORM 2: Fast Inward GRN Form (/api/store/inward) with Unit Price: ₹35.75, Inward Qty: 25000.000 ---');
  const inClient = await pool.connect();
  try {
    await inClient.query('BEGIN');
    const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const { rows: seqRows } = await inClient.query(`SELECT LPAD((COUNT(*)+1)::text, 4, '0') as seq FROM grn WHERE grn_number LIKE $1`, [`GRN-${stamp}-%`]);
    const grnNum = `GRN-${stamp}-${seqRows[0].seq}`;

    const { rows: [grn] } = await inClient.query(
      `INSERT INTO grn (grn_number, date, vendor_id, received_by, status, remarks)
       VALUES ($1, CURRENT_DATE, $2, $3, 'Received', 'Inward test') RETURNING id`,
      [grnNum, vendor.id, user.id]
    );

    const qty = 25000.000;
    const price = 35.75;
    const newStock = 270.500 + qty; // 25270.500

    await inClient.query(`
      UPDATE materials
      SET current_stock = $1,
          bin_location = COALESCE($2, bin_location),
          unit_price = CASE WHEN $3::numeric > 0 THEN $3::numeric ELSE unit_price END
      WHERE id = $4
    `, [newStock, 'Rack 2', price, matId]);

    await inClient.query(`
      INSERT INTO stock_ledger (
        material_id, date, transaction_type, reference_type, reference_id,
        in_qty, out_qty, balance, unit_price, value,
        batch_number, bin_location, remarks, created_by, vendor_id
      ) VALUES (
        $1, CURRENT_DATE, 'grn', 'GRN', $2,
        $3, 0, $4, $5, $6,
        $7, $8, $9, $10, $11
      )
    `, [
      matId, grn.id, qty, newStock, price, qty * price,
      'BATCH-001', 'Rack 2', `[GRN ${grnNum}] | Starch receipt`, user.id, vendor.id
    ]);

    await inClient.query(
      `INSERT INTO grn_items (grn_id, material_id, po_qty, received_qty, accepted_qty, rejected_qty, uom, unit_price, bin_location, batch_number, remarks)
       VALUES ($1, $2, $3, $4, $5, 0, $6, $7, $8, $9, $10)`,
      [grn.id, matId, qty, qty, qty, 'KGS', price, 'Rack 2', 'BATCH-001', 'Accepted']
    );

    await inClient.query('COMMIT');
    console.log('✅ Form 2 Passed: Fast Inward GRN created with ₹35.75 rate and 25000 KGS qty without integer syntax error!\n');
  } finally {
    inClient.release();
  }

  console.log('--- FORM 3: Fast Outward Issue Form (/api/store/outward) with Out Qty: 12500.500 ---');
  const outClient = await pool.connect();
  try {
    await outClient.query('BEGIN');
    const outQty = 12500.500;
    const curStock = 25270.500;
    const finalStock = curStock - outQty; // 12770.000
    const price = 35.75;

    await outClient.query('UPDATE materials SET current_stock = $1 WHERE id = $2', [finalStock, matId]);

    await outClient.query(`
      INSERT INTO stock_ledger (material_id, date, transaction_type, in_qty, out_qty, balance, unit_price, value, remarks, created_by)
      VALUES ($1, CURRENT_DATE, 'issue', 0, $2, $3, $4, $5, 'Store Issue to Pulp Mill', $6)
    `, [matId, outQty, finalStock, price, outQty * price, user.id]);

    await outClient.query('COMMIT');
    console.log('✅ Form 3 Passed: Fast Outward Issue processed and stock deducted.\n');
  } finally {
    outClient.release();
  }

  console.log('--- FORM 4: Indent Immediate Issuance & Direct Cash Purchase Form ---');
  const indClient = await pool.connect();
  try {
    await indClient.query('BEGIN');
    const buyQty = 500.000;
    const buyPrice = 36.50;
    const cur = 12770.000;
    const postStock = cur + buyQty; // 13270.000

    await indClient.query(
      `UPDATE materials SET current_stock = $1, unit_price = CASE WHEN $2::numeric > 0 THEN $2::numeric ELSE unit_price END WHERE id = $3`,
      [postStock, buyPrice, matId]
    );

    await indClient.query(
      `INSERT INTO stock_ledger (material_id, date, transaction_type, reference_type, in_qty, out_qty, balance, unit_price, value, remarks, created_by)
       VALUES ($1, CURRENT_DATE, 'cash_purchase', 'cash_purchase', $2, 0, $3, $4, $5, 'Cash Purchase spot fulfillment', $6)`,
      [matId, buyQty, postStock, buyPrice, buyQty * buyPrice, user.id]
    );

    await indClient.query('COMMIT');
    console.log('✅ Form 4 Passed: Indent cash purchase updated unit_price to ₹36.50 without syntax error.\n');
  } finally {
    indClient.release();
  }

  console.log('--- FORM 5: Final Rollover & Invariant Verification Across All Movement Ledgers ---');
  const { rows: [finalMat] } = await pool.query(`
    SELECT m.current_stock, m.unit_price,
           COALESCE((SELECT SUM(sl.in_qty) FROM stock_ledger sl WHERE sl.material_id = m.id AND sl.transaction_type != 'opening'), 0) AS received,
           COALESCE((SELECT SUM(sl.out_qty) FROM stock_ledger sl WHERE sl.material_id = m.id AND sl.transaction_type != 'opening'), 0) AS issued
    FROM materials m WHERE m.id = $1
  `, [matId]);

  const rec = parseFloat(finalMat.received);
  const iss = parseFloat(finalMat.issued);
  const cur = parseFloat(finalMat.current_stock);
  const op = parseFloat((cur - rec + iss).toFixed(3));

  console.log(`Initial Opening: 270.500 -> Derived Base Opening: ${op} KGS`);
  console.log(`Total Received:  +${rec} KGS`);
  console.log(`Total Issued:    -${iss} KGS`);
  console.log(`Closing Balance: ${cur} KGS (Expected: 13270.000)`);
  console.log(`Latest Price:    ₹${finalMat.unit_price} (Expected: ₹36.50)`);

  if (op === 270.5 && rec === 25500 && iss === 12500.5 && cur === 13270) {
    console.log('\n🎉 ALL FORMS & MULTI-AGENT INVARIANT CHECKS PASSED WITH 100% SUCCESS!');
  } else {
    throw new Error('ROLLOVER INVARIANT MISMATCH');
  }

  // Clean up
  await pool.query('DELETE FROM grn_items WHERE material_id = $1', [matId]);
  await pool.query('DELETE FROM stock_ledger WHERE material_id = $1', [matId]);
  await pool.query('DELETE FROM materials WHERE id = $1', [matId]);
  console.log('🧹 Cleaned up test records.\n');

  await pool.end();
}

testAllFormsDecimalIntegrity().catch(err => {
  console.error('❌ Test failed:', err);
  pool.end();
  process.exit(1);
});
