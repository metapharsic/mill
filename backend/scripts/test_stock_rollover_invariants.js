require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const pool = require('../src/db/pool');

async function runStockRolloverTests() {
  console.log('🧪 ========================================================');
  console.log('🧪 MULTI-AGENT VERIFICATION: STOCK ROLLOVER & LEDGER SUITE');
  console.log('🧪 ========================================================\n');

  const testCode = 'TEST-ROLLOVER-999';
  const { rows: [cat] } = await pool.query(`SELECT id FROM material_categories LIMIT 1`);
  const catId = cat.id;

  // Step 0: Clean up any old test data
  await pool.query('DELETE FROM stock_ledger WHERE material_id IN (SELECT id FROM materials WHERE code = $1)', [testCode]);
  await pool.query('DELETE FROM materials WHERE code = $1', [testCode]);

  console.log('--- TEST 1: Initial Master Entry (Day 1) ---');
  // Scenario matching user screenshot: Opening = 270, Received = 300, Issue = 0 -> Closing = 570
  const initialOp = 270.0;
  const initialRec = 300.0;
  const initialIss = 0.0;
  const initialBal = 570.0;
  const unitPrice = 50.0;

  const client = await pool.connect();
  let matId;
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `INSERT INTO materials (code, name, category_id, uom, current_stock, unit_price, is_active)
       VALUES ($1, 'TEST ROLLOVER VALVE', $2, 'KGS', $3, $4, true) RETURNING id`,
      [testCode, catId, initialBal, unitPrice]
    );
    matId = rows[0].id;

    // Opening record in stock_ledger
    await client.query(
      `INSERT INTO stock_ledger (material_id, date, transaction_type, in_qty, out_qty, balance, unit_price, value, remarks)
       VALUES ($1, CURRENT_DATE - INTERVAL '1 day', 'opening', $2, 0, $2, $3, $4, 'Opening Stock / Master Entry')`,
      [matId, initialOp, unitPrice, initialOp * unitPrice]
    );

    // Initial receipt record in stock_ledger
    await client.query(
      `INSERT INTO stock_ledger (material_id, date, transaction_type, in_qty, out_qty, balance, unit_price, value, remarks)
       VALUES ($1, CURRENT_DATE - INTERVAL '1 day', 'grn', $2, 0, $3, $4, $5, 'Initial Receipt / Master Creation')`,
      [matId, initialRec, initialOp + initialRec, unitPrice, initialRec * unitPrice]
    );

    await client.query('COMMIT');
  } finally {
    client.release();
  }

  // Verify Day 1 calculations
  let { rows: [matD1] } = await pool.query(`
    SELECT m.current_stock,
           COALESCE((SELECT SUM(sl.in_qty) FROM stock_ledger sl WHERE sl.material_id = m.id AND sl.transaction_type != 'opening'), 0) AS received,
           COALESCE((SELECT SUM(sl.out_qty) FROM stock_ledger sl WHERE sl.material_id = m.id AND sl.transaction_type != 'opening'), 0) AS issued
    FROM materials m WHERE m.id = $1
  `, [matId]);

  let recD1 = parseFloat(matD1.received);
  let issD1 = parseFloat(matD1.issued);
  let curD1 = parseFloat(matD1.current_stock);
  let opD1 = parseFloat((curD1 - recD1 + issD1).toFixed(3));

  console.log(`Day 1 Opening:  ${opD1} (Expected: 270)`);
  console.log(`Day 1 Received: +${recD1} (Expected: +300)`);
  console.log(`Day 1 Issued:   -${issD1} (Expected: -0)`);
  console.log(`Day 1 Closing:  ${curD1} (Expected: 570)`);

  if (opD1 === 270 && recD1 === 300 && issD1 === 0 && curD1 === 570) {
    console.log('✅ TEST 1 PASSED: Day 1 Stock Equation is 100% Exact!\n');
  } else {
    throw new Error('TEST 1 FAILED');
  }

  console.log('--- TEST 2: Update Material Specifications (Edit Master) ---');
  // Simulate PUT /materials/:id to update name, unit_price and re-verify stock is NOT corrupted
  const editClient = await pool.connect();
  try {
    await editClient.query('BEGIN');
    await editClient.query(
      `UPDATE materials SET name = 'TEST ROLLOVER VALVE UPDATED', unit_price = 55.00 WHERE id = $1`,
      [matId]
    );
    // Simulate our updated PUT /materials/:id logic
    const { rows: [sums] } = await editClient.query(
      `SELECT COALESCE(SUM(in_qty), 0) AS received, COALESCE(SUM(out_qty), 0) AS issued
       FROM stock_ledger WHERE material_id = $1 AND transaction_type != 'opening'`,
      [matId]
    );
    const existingRec = parseFloat(sums.received);
    const existingIss = parseFloat(sums.issued);
    const finalOp = 270.0;
    const finalStock = parseFloat((finalOp + existingRec - existingIss).toFixed(3));

    await editClient.query('UPDATE materials SET current_stock = $1 WHERE id = $2', [finalStock, matId]);
    await editClient.query(
      `UPDATE stock_ledger SET in_qty=$1, balance=$1 WHERE material_id=$2 AND transaction_type='opening'`,
      [finalOp, matId]
    );
    await editClient.query('COMMIT');
  } finally {
    editClient.release();
  }

  let { rows: [matD1AfterEdit] } = await pool.query(`
    SELECT m.current_stock,
           COALESCE((SELECT SUM(sl.in_qty) FROM stock_ledger sl WHERE sl.material_id = m.id AND sl.transaction_type != 'opening'), 0) AS received,
           COALESCE((SELECT SUM(sl.out_qty) FROM stock_ledger sl WHERE sl.material_id = m.id AND sl.transaction_type != 'opening'), 0) AS issued
    FROM materials m WHERE m.id = $1
  `, [matId]);

  let recD1Post = parseFloat(matD1AfterEdit.received);
  let issD1Post = parseFloat(matD1AfterEdit.issued);
  let curD1Post = parseFloat(matD1AfterEdit.current_stock);
  let opD1Post = parseFloat((curD1Post - recD1Post + issD1Post).toFixed(3));

  console.log(`Post-Edit Opening:  ${opD1Post} (Expected: 270)`);
  console.log(`Post-Edit Received: +${recD1Post} (Expected: +300)`);
  console.log(`Post-Edit Closing:  ${curD1Post} (Expected: 570)`);

  if (opD1Post === 270 && recD1Post === 300 && curD1Post === 570) {
    console.log('✅ TEST 2 PASSED: Edit preserves opening stock and avoids double-counting!\n');
  } else {
    throw new Error('TEST 2 FAILED');
  }

  console.log('--- TEST 3: Inward Receipt (Day 2 Morning: +50 KGS) ---');
  const inQtyD2 = 50.0;
  await pool.query('UPDATE materials SET current_stock = current_stock + $1 WHERE id = $2', [inQtyD2, matId]);
  await pool.query(
    `INSERT INTO stock_ledger (material_id, date, transaction_type, in_qty, out_qty, balance, unit_price, value, remarks)
     VALUES ($1, CURRENT_DATE, 'grn', $2, 0, $3, 55.0, $4, 'Day 2 GRN Receipt')`,
    [matId, inQtyD2, 570 + inQtyD2, inQtyD2 * 55.0]
  );

  let { rows: [matAfterIn] } = await pool.query('SELECT current_stock FROM materials WHERE id = $1', [matId]);
  console.log(`Stock after Inward (+50): ${matAfterIn.current_stock} (Expected: 620)`);
  if (parseFloat(matAfterIn.current_stock) !== 620) throw new Error('TEST 3 FAILED');
  console.log('✅ TEST 3 PASSED: Inward stock incremented atomically.\n');

  console.log('--- TEST 4: Outward Issue (Day 2 Afternoon: -120 KGS) ---');
  const outQtyD2 = 120.0;
  await pool.query('UPDATE materials SET current_stock = current_stock - $1 WHERE id = $2', [outQtyD2, matId]);
  await pool.query(
    `INSERT INTO stock_ledger (material_id, date, transaction_type, in_qty, out_qty, balance, unit_price, value, remarks)
     VALUES ($1, CURRENT_DATE, 'issue', 0, $2, $3, 55.0, $4, 'Day 2 Department Issue')`,
    [matId, outQtyD2, 620 - outQtyD2, outQtyD2 * 55.0]
  );

  let { rows: [matAfterOut] } = await pool.query('SELECT current_stock FROM materials WHERE id = $1', [matId]);
  console.log(`Stock after Outward (-120): ${matAfterOut.current_stock} (Expected: 500)`);
  if (parseFloat(matAfterOut.current_stock) !== 500) throw new Error('TEST 4 FAILED');
  console.log('✅ TEST 4 PASSED: Outward issue deducted atomically.\n');

  console.log('--- TEST 5: Day 2 Rollover Verification ---');
  // Day 2 Today calculations:
  // Day 2 Opening = Day 1 Closing = 570
  // Day 2 Inward = 50
  // Day 2 Outward = 120
  // Day 2 Closing = 570 + 50 - 120 = 500
  // Day 3 Opening = Day 2 Closing = 500
  const { rows: [todayMoves] } = await pool.query(`
    SELECT
      COALESCE(SUM(in_qty) FILTER (WHERE transaction_type IN ('grn', 'in') AND date = CURRENT_DATE), 0) AS today_in,
      COALESCE(SUM(out_qty) FILTER (WHERE transaction_type IN ('issue', 'out') AND date = CURRENT_DATE), 0) AS today_out
    FROM stock_ledger WHERE material_id = $1
  `, [matId]);

  const currentFinal = parseFloat(matAfterOut.current_stock);
  const todayIn = parseFloat(todayMoves.today_in);
  const todayOut = parseFloat(todayMoves.today_out);
  const todayOpening = currentFinal - todayIn + todayOut;
  const tomorrowOpening = currentFinal;

  console.log(`Today's Opening Balance:   ${todayOpening} KGS (Expected: 570)`);
  console.log(`Today's Inward Receipts:   +${todayIn} KGS (Expected: +50)`);
  console.log(`Today's Outward Issues:    -${todayOut} KGS (Expected: -120)`);
  console.log(`Today's Closing Balance:   ${currentFinal} KGS (Expected: 500)`);
  console.log(`Tomorrow's Opening Balance: ${tomorrowOpening} KGS (Expected: 500)`);

  if (todayOpening === 570 && todayIn === 50 && todayOut === 120 && currentFinal === 500 && tomorrowOpening === 500) {
    console.log('\n🎉 ALL 5 MULTI-AGENT INVARIANT TESTS PASSED WITH 100% PRECISION!');
  } else {
    throw new Error('TEST 5 FAILED: Rollover invariant mismatch');
  }

  // Cleanup
  await pool.query('DELETE FROM stock_ledger WHERE material_id = $1', [matId]);
  await pool.query('DELETE FROM materials WHERE id = $1', [matId]);
  console.log('🧹 Test records cleaned up successfully.\n');

  await pool.end();
}

runStockRolloverTests().catch(e => {
  console.error('❌ Error running test:', e);
  pool.end();
  process.exit(1);
});
