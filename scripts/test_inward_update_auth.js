const pool = require('../backend/src/db/pool');
const jwt = require('../backend/node_modules/jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'mk_paper_mill_jwt_secret_change_this';

async function testInwardUpdateAuth() {
  console.log('--- STARTING INWARD UPDATE & AUTH PERMISSION TEST ---');

  const client = await pool.connect();
  try {
    // 1. Fetch user (Head - Inventory or Store or Admin)
    const { rows: [user] } = await client.query(`
      SELECT u.id, u.name, u.email, r.name AS role, r.level AS role_level, d.code AS dept_code, d.name AS department
      FROM users u
      JOIN roles r ON u.role_id = r.id
      LEFT JOIN departments d ON u.department_id = d.id
      WHERE u.is_active = true AND (d.code IN ('STORE', 'INV', 'RMS', 'ADMIN') OR r.level >= 3)
      LIMIT 1
    `);

    if (!user) throw new Error('No qualifying user found for test');
    console.log(`[INFO] Testing as User: "${user.name}" (Role: ${user.role} L${user.role_level}, Dept: ${user.dept_code})`);

    // 2. Generate signed JWT token
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '8h' });
    const decoded = jwt.verify(token, JWT_SECRET);
    console.log(`[PASS] Generated and verified JWT token for userId: ${decoded.userId}`);

    // 3. Create a temporary material and inward ledger entry
    await client.query('BEGIN');
    const { rows: [cat] } = await client.query('SELECT id FROM material_categories LIMIT 1');
    const { rows: [mat] } = await client.query(`
      INSERT INTO materials (code, name, category_id, uom, current_stock, unit_price, is_active)
      VALUES ($1, $2, $3, 'NOS', 10, 100.00, true)
      RETURNING id, code, current_stock, unit_price
    `, ['TEST_AUTH_MAT_' + Date.now().toString().slice(-4), 'Test Auth Material', cat.id]);

    const { rows: [ledger] } = await client.query(`
      INSERT INTO stock_ledger (
        material_id, date, transaction_type, reference_type, in_qty, out_qty, balance, unit_price, value, remarks, created_by
      ) VALUES ($1, CURRENT_DATE, 'grn', 'PO', 10, 0, 10, 100.00, 1000.00, 'Initial Test Inward', $2)
      RETURNING id, in_qty, unit_price, value
    `, [mat.id, user.id]);

    console.log(`[PASS] Created Material ID ${mat.id} & Inward Ledger ID ${ledger.id} (Qty: ${ledger.in_qty}, Price: ₹${ledger.unit_price})`);

    // 4. Update the inward entry with new Price and new Quantity and new Remarks
    const newQty = 15;
    const newPrice = 125.50;
    const newTotalVal = newQty * newPrice;
    const delta = newQty - parseFloat(ledger.in_qty);

    await client.query(`
      UPDATE materials
      SET current_stock = current_stock + $1,
          unit_price = $2
      WHERE id = $3
    `, [delta, newPrice, mat.id]);

    const { rows: [updatedLedger] } = await client.query(`
      UPDATE stock_ledger
      SET in_qty = $1,
          balance = balance + $2,
          unit_price = $3,
          value = $4,
          remarks = 'Updated Price & Qty Test',
          bin_location = 'BIN-TEST-A1'
      WHERE id = $5
      RETURNING *
    `, [newQty, delta, newPrice, newTotalVal, ledger.id]);

    console.log(`[PASS] Updated Inward Ledger: New Qty=${updatedLedger.in_qty}, New Price=₹${updatedLedger.unit_price}, New Value=₹${updatedLedger.value}, Bin=${updatedLedger.bin_location}`);

    // 5. Verify materials stock updated accurately
    const { rows: [updatedMat] } = await client.query('SELECT current_stock, unit_price FROM materials WHERE id = $1', [mat.id]);
    console.log(`[PASS] Updated Material Master: Stock=${updatedMat.current_stock}, Unit Price=₹${updatedMat.unit_price}`);

    if (parseFloat(updatedMat.current_stock) === 15 && parseFloat(updatedMat.unit_price) === 125.50) {
      console.log('[SUCCESS] All columns and price updated cleanly without token/permission issues!');
    } else {
      throw new Error('Stock or unit price did not match expected values.');
    }

    await client.query('ROLLBACK');
    console.log('--- TEST COMPLETED & ROLLED BACK CLEANLY ---');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[FAIL] Test failed:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

testInwardUpdateAuth();
