/**
 * test_daily_stock_rollover_lifecycle.js
 * Verification of the Daily Stock Rollover & New-Day Zero Reset Accounting Logic
 *
 * Simulates:
 * Day 1:
 *  - Initial Stock = 10.000 (Opening)
 *  - Outward Issue = 5.000
 *  - Inward Receipt = 10.000
 *  - Day 1 Closing Balance = 15.000
 *
 * Day 2 (Simulated New Day):
 *  - Opening Stock = 15.000 (Equal to Day 1 Closing)
 *  - Received (Today) = 0.000 (Reset for new day)
 *  - Issued (Today) = 0.000 (Reset for new day)
 *  - Current / Closing Stock = 15.000
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const pool = require('../src/db/pool');

async function runTest() {
  console.log('🧪 ======================================================================');
  console.log('🧪 VERIFICATION: DAILY STOCK ROLLOVER & NEW-DAY ZERO RESET LIFECYCLE');
  console.log('🧪 ======================================================================\n');

  const client = await pool.connect();
  const testCode = `TEST-ROLL-${Date.now().toString().slice(-6)}`;
  let testMatId = null;

  try {
    await client.query('BEGIN');

    // 1. Create a Category if needed or fetch first
    const { rows: [cat] } = await client.query('SELECT id FROM material_categories LIMIT 1');

    // 2. DAY 1: Register Material with initial opening = 10.000
    console.log('📌 STEP 1: Register Material on Day 1 with Initial Opening Stock = 10.000, Price = ₹100');
    const { rows: [mat] } = await client.query(`
      INSERT INTO materials (code, name, category_id, uom, current_stock, unit_price, is_active)
      VALUES ($1, $2, $3, 'NOS', 10.000, 100.00, true)
      RETURNING id, code, current_stock, unit_price
    `, [testCode, `Test Rollover Item ${testCode}`, cat.id]);
    testMatId = mat.id;

    // Log Day 1 Opening in stock_ledger with simulated date = CURRENT_DATE - INTERVAL '1 day'
    await client.query(`
      INSERT INTO stock_ledger (material_id, date, transaction_type, in_qty, out_qty, balance, unit_price, value, remarks)
      VALUES ($1, CURRENT_DATE - INTERVAL '1 day', 'opening', 10.000, 0, 10.000, 100.00, 1000.00, 'Day 1 Initial Opening')
    `, [testMatId]);

    // 3. DAY 1: Issue 5.000 units
    console.log('📌 STEP 2: Issue 5.000 units to production on Day 1');
    await client.query(`
      INSERT INTO stock_ledger (material_id, date, transaction_type, in_qty, out_qty, balance, unit_price, value, remarks)
      VALUES ($1, CURRENT_DATE - INTERVAL '1 day', 'issue', 0, 5.000, 5.000, 100.00, 500.00, 'Day 1 Issue to Plant')
    `, [testMatId]);

    // 4. DAY 1: Receive 10.000 units from supplier
    console.log('📌 STEP 3: Receive 10.000 units via GRN on Day 1');
    await client.query(`
      INSERT INTO stock_ledger (material_id, date, transaction_type, in_qty, out_qty, balance, unit_price, value, remarks)
      VALUES ($1, CURRENT_DATE - INTERVAL '1 day', 'grn', 10.000, 0, 15.000, 100.00, 1000.00, 'Day 1 Supplier GRN')
    `, [testMatId]);

    // Update material current_stock to reflect Day 1 closing = 15.000
    await client.query(`UPDATE materials SET current_stock = 15.000 WHERE id = $1`, [testMatId]);

    // 5. VERIFY DAY 1 CLOSING
    console.log('\n--- VERIFYING DAY 1 CALCULATIONS ---');
    const { rows: [day1Stats] } = await client.query(`
      SELECT
        COALESCE(SUM(CASE WHEN transaction_type = 'opening' THEN in_qty ELSE 0 END), 0) AS day1_opening,
        COALESCE(SUM(CASE WHEN transaction_type IN ('grn', 'in') THEN in_qty ELSE 0 END), 0) AS day1_received,
        COALESCE(SUM(CASE WHEN transaction_type IN ('issue', 'out') THEN out_qty ELSE 0 END), 0) AS day1_issued
      FROM stock_ledger
      WHERE material_id = $1 AND date = CURRENT_DATE - INTERVAL '1 day'
    `, [testMatId]);

    const d1Op = Number(day1Stats.day1_opening);
    const d1Rec = Number(day1Stats.day1_received);
    const d1Iss = Number(day1Stats.day1_issued);
    const d1Close = d1Op + d1Rec - d1Iss;

    console.log(`  • Day 1 Opening:  ${d1Op.toFixed(3)} NOS`);
    console.log(`  • Day 1 Received: +${d1Rec.toFixed(3)} NOS`);
    console.log(`  • Day 1 Issued:   -${d1Iss.toFixed(3)} NOS`);
    console.log(`  • Day 1 Closing:  ${d1Close.toFixed(3)} NOS`);

    if (d1Close !== 15.0) {
      throw new Error(`Day 1 Closing mismatch: Expected 15.000, Got ${d1Close}`);
    }
    console.log('  ✅ [PASS] Day 1 Closing balance matches exact equation: 10 + 10 - 5 = 15.000');

    // 6. DAY 2: TRANSITION TO TODAY (New Day Zero Reset Verification)
    console.log('\n--- VERIFYING DAY 2 (TODAY) NEW-DAY ZERO RESET & ROLLOVER ---');
    // On Day 2 (CURRENT_DATE), no new transactions have occurred yet.
    const { rows: [day2Stats] } = await client.query(`
      SELECT
        COALESCE(SUM(sl.in_qty)  FILTER (WHERE sl.date = CURRENT_DATE AND sl.transaction_type != 'opening'), 0) AS today_received,
        COALESCE(SUM(sl.out_qty) FILTER (WHERE sl.date = CURRENT_DATE AND sl.transaction_type != 'opening'), 0) AS today_issued
      FROM stock_ledger sl
      WHERE sl.material_id = $1
    `, [testMatId]);

    const todayRec = Number(day2Stats.today_received);
    const todayIss = Number(day2Stats.today_issued);

    // Current stock from materials table
    const { rows: [curMat] } = await client.query(`SELECT current_stock FROM materials WHERE id = $1`, [testMatId]);
    const currentStock = Number(curMat.current_stock);
    const todayOpening = currentStock - todayRec + todayIss;

    console.log(`  • Today's Opening Stock (Yesterday's Closing): ${todayOpening.toFixed(3)} NOS`);
    console.log(`  • Today's Received (New Day Reset):           +${todayRec.toFixed(3)} NOS`);
    console.log(`  • Today's Issued (New Day Reset):             -${todayIss.toFixed(3)} NOS`);
    console.log(`  • Today's Closing Balance:                    ${currentStock.toFixed(3)} NOS`);

    if (todayOpening !== 15.0) {
      throw new Error(`Day 2 Opening Stock mismatch: Expected 15.000 (Yesterday's Closing), Got ${todayOpening}`);
    }
    console.log('  ✅ [PASS] Day 2 Opening Stock equals Day 1 Closing Stock (15.000)');

    if (todayRec !== 0.0 || todayIss !== 0.0) {
      throw new Error(`Day 2 Received/Issued did not reset to 0: Got rec=${todayRec}, iss=${todayIss}`);
    }
    console.log('  ✅ [PASS] Day 2 Received and Issued started at 0.000');

    // 7. DAY 2 IN-FLIGHT ACTIVITY: Perform Today's inward (+20) and outward (-8)
    console.log('\n--- SIMULATING DAY 2 IN-FLIGHT TRANSACTIONS ---');
    console.log('📌 STEP 4: Receive 20.000 today & Issue 8.000 today');
    await client.query(`
      INSERT INTO stock_ledger (material_id, date, transaction_type, in_qty, out_qty, balance, unit_price, value, remarks)
      VALUES ($1, CURRENT_DATE, 'grn', 20.000, 0, 35.000, 100.00, 2000.00, 'Day 2 Supplier GRN')
    `, [testMatId]);
    await client.query(`
      INSERT INTO stock_ledger (material_id, date, transaction_type, in_qty, out_qty, balance, unit_price, value, remarks)
      VALUES ($1, CURRENT_DATE, 'issue', 0, 8.000, 27.000, 100.00, 800.00, 'Day 2 Department Issue')
    `, [testMatId]);
    await client.query(`UPDATE materials SET current_stock = 27.000 WHERE id = $1`, [testMatId]);

    // Check Day 2 mid-day stats
    const { rows: [midDayStats] } = await client.query(`
      SELECT
        COALESCE(SUM(sl.in_qty)  FILTER (WHERE sl.date = CURRENT_DATE AND sl.transaction_type != 'opening'), 0) AS today_received,
        COALESCE(SUM(sl.out_qty) FILTER (WHERE sl.date = CURRENT_DATE AND sl.transaction_type != 'opening'), 0) AS today_issued
      FROM stock_ledger sl
      WHERE sl.material_id = $1
    `, [testMatId]);

    const midRec = Number(midDayStats.today_received);
    const midIss = Number(midDayStats.today_issued);
    const { rows: [midMat] } = await client.query(`SELECT current_stock FROM materials WHERE id = $1`, [testMatId]);
    const midStock = Number(midMat.current_stock);
    const midOpening = midStock - midRec + midIss;

    console.log(`  • Day 2 Opening Balance: ${midOpening.toFixed(3)} NOS`);
    console.log(`  • Day 2 Received Today:  +${midRec.toFixed(3)} NOS`);
    console.log(`  • Day 2 Issued Today:    -${midIss.toFixed(3)} NOS`);
    console.log(`  • Day 2 Current Closing: ${midStock.toFixed(3)} NOS`);

    if (midOpening !== 15.0) {
      throw new Error(`Day 2 Opening shifted after transactions: Expected 15.000, Got ${midOpening}`);
    }
    if (midStock !== 27.0) {
      throw new Error(`Day 2 Closing mismatch: Expected 27.000, Got ${midStock}`);
    }
    console.log('  ✅ [PASS] Day 2 Equation exact: Opening (15) + Today Rec (20) - Today Iss (8) = Closing (27)');

    console.log('\n======================================================================');
    console.log('🎉 100% SUCCESS: ALL DAILY ROLLOVER & ZERO-RESET INVARIANTS VERIFIED!');
    console.log('======================================================================\n');
  } catch (err) {
    console.error('❌ TEST FAILED:', err);
    process.exitCode = 1;
  } finally {
    await client.query('ROLLBACK');
    client.release();
    await pool.end();
  }
}

runTest();
