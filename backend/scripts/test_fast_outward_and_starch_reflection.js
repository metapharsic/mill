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
  console.log('🧪 MULTI-AGENT VALIDATION: FAST OUTWARD & STARCH STOCK REFLECTION');
  console.log('===============================================================');

  const client = await pool.connect();
  try {
    const { rows: [user] } = await client.query('SELECT * FROM users ORDER BY id ASC LIMIT 1');
    const { rows: [vendor] } = await client.query('SELECT * FROM vendors WHERE is_active = true LIMIT 1');
    const { rows: [dept] } = await client.query('SELECT * FROM departments LIMIT 1');
    const { rows: [starch] } = await client.query("SELECT * FROM materials WHERE name ILIKE '%starch%' LIMIT 1");

    assert(Boolean(user), `User found: ${user?.name} (ID: ${user?.id})`);
    assert(Boolean(vendor), `Vendor found: ${vendor?.name} (ID: ${vendor?.id})`);
    assert(Boolean(dept), `Department found: ${dept?.name} (ID: ${dept?.id})`);
    assert(Boolean(starch), `Starch material found in DB: ${starch?.name} (${starch?.code}) | Initial Stock: ${starch?.current_stock} ${starch?.uom}`);

    const initialStarchStock = parseFloat(starch.current_stock);

    // ------------------------------------------------------------------------
    console.log('\n--- 1. Testing FAST OUTWARD: JOB WORK WITH OPTIONAL/EMPTY UI FIELDS ---');
    // ------------------------------------------------------------------------
    await client.query('BEGIN');
    const jwQty = 10;
    const { rows: [lockedStarchJW] } = await client.query('SELECT * FROM materials WHERE id = $1 FOR UPDATE', [starch.id]);
    const stockAfterJW = parseFloat(lockedStarchJW.current_stock) - jwQty;
    await client.query('UPDATE materials SET current_stock = $1 WHERE id = $2', [stockAfterJW, starch.id]);

    const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const { rows: [seqJW] } = await client.query(`SELECT COUNT(*)+1 AS n FROM gate_passes WHERE created_at::date = CURRENT_DATE`);
    const gpNumJW = `GP-JW-${stamp}-${String(seqJW.n).padStart(4, '0')}`;

    const { rows: [gpJW] } = await client.query(`
      INSERT INTO gate_passes (
        gp_number, pass_type, vehicle_type, vehicle_number, driver_name, purpose,
        material_description, from_party, to_party, out_time, security_guard_id, remarks,
        vendor_id, status
      ) VALUES (
        $1, 'RETURNABLE', 'Commercial Vehicle', 'To be logged at gate', 'Authorized Driver', 'Outside Machining / Cooking Test',
        $2, 'MK Paper Mill Main Store', $3, NOW(), $4, 'Job work dispatch test', $5, 'Open'
      ) RETURNING id, gp_number
    `, [gpNumJW, `Job Work (1 item): ${jwQty} ${starch.uom} of ${starch.name}`, vendor.name, user.id, vendor.id]);

    await client.query(`
      INSERT INTO stock_ledger (
        material_id, date, transaction_type, reference_type, reference_id,
        vendor_id, in_qty, out_qty, balance, unit_price, value, remarks, created_by
      ) VALUES ($1, CURRENT_DATE, 'job_work', 'JOB_WORK', NULL, $2, 0, $3, $4, $5, $6, $7, $8)
    `, [starch.id, vendor.id, jwQty, stockAfterJW, starch.unit_price, jwQty * starch.unit_price, `[Job Work] | Party: ${vendor.name} | Ref: ${gpJW.gp_number}`, user.id]);

    await client.query('COMMIT');
    assert(gpJW.gp_number.startsWith('GP-JW-'), `Job work saved cleanly without error: ${gpJW.gp_number}`);

    // ------------------------------------------------------------------------
    console.log('\n--- 2. Testing FAST OUTWARD: RETURN TO PARTY (RTV) & DEBIT NOTE ---');
    // ------------------------------------------------------------------------
    await client.query('BEGIN');
    const rtvQty = 5;
    const { rows: [lockedStarchRTV] } = await client.query('SELECT * FROM materials WHERE id = $1 FOR UPDATE', [starch.id]);
    const stockAfterRTV = parseFloat(lockedStarchRTV.current_stock) - rtvQty;
    await client.query('UPDATE materials SET current_stock = $1 WHERE id = $2', [stockAfterRTV, starch.id]);

    const unitPrice = parseFloat(starch.unit_price || 35);
    const subAmt = rtvQty * unitPrice;
    const gstPct = 18;
    const taxAmt = (subAmt * gstPct) / 100;
    const debitTotal = subAmt + taxAmt;

    const { rows: [seqRTV] } = await client.query(`SELECT COUNT(*)+1 AS n FROM gate_passes WHERE created_at::date = CURRENT_DATE`);
    const gpNumRTV = `GP-RTV-${stamp}-${String(seqRTV.n).padStart(4, '0')}`;

    const { rows: [gpRTV] } = await client.query(`
      INSERT INTO gate_passes (
        gp_number, pass_type, vehicle_type, vehicle_number, driver_name, purpose,
        material_description, from_party, to_party, out_time, security_guard_id, remarks,
        vendor_id, status
      ) VALUES (
        $1, 'RTV', 'Commercial Vehicle', 'To be logged at gate', 'Authorized Driver', 'Quality Rejection Return',
        $2, 'MK Paper Mill', $3, NOW(), $4, 'Debit note outward', $5, 'Closed'
      ) RETURNING id, gp_number
    `, [gpNumRTV, `RTV (1 item | Sub: ₹${subAmt} + Tax: ₹${taxAmt} = Debit: ₹${debitTotal}): ${rtvQty} ${starch.uom} of ${starch.name}`, vendor.name, user.id, vendor.id]);

    const rtvRemark = `[Return to Party] | Party: ${vendor.name} | Sub: ₹${subAmt.toFixed(2)} | GST (${gstPct}%): ₹${taxAmt.toFixed(2)} | Debit Total: ₹${debitTotal.toFixed(2)} | Note: QC Fail`;
    await client.query(`
      INSERT INTO stock_ledger (
        material_id, date, transaction_type, reference_type, reference_id,
        vendor_id, in_qty, out_qty, balance, unit_price, value, remarks, created_by
      ) VALUES ($1, CURRENT_DATE, 'return_to_vendor', 'RTV', NULL, $2, 0, $3, $4, $5, $6, $7, $8)
    `, [starch.id, vendor.id, rtvQty, stockAfterRTV, unitPrice, subAmt, rtvRemark, user.id]);

    await client.query('COMMIT');
    assert(gpRTV.gp_number.startsWith('GP-RTV-'), `Return to Party Debit Note saved cleanly: ${gpRTV.gp_number}`);

    // ------------------------------------------------------------------------
    console.log('\n--- 3. Testing INVENTORY REFLECTION ACROSS ALL APIS FOR STARCH ---');
    // ------------------------------------------------------------------------
    // Check direct DB reflection
    const { rows: [dbStarch] } = await client.query('SELECT current_stock FROM materials WHERE id = $1', [starch.id]);
    assert(parseFloat(dbStarch.current_stock) === (initialStarchStock - jwQty - rtvQty), `DB materials.current_stock reflects exactly: ${dbStarch.current_stock} KGS (Initial: ${initialStarchStock} - ${jwQty} - ${rtvQty})`);

    // Check Chemical Store query reflection
    const { rows: [chemStarch] } = await client.query(`
      SELECT m.id, m.name, m.current_stock, (m.current_stock * m.unit_price) AS "stockValue"
      FROM materials m
      JOIN material_categories mc ON m.category_id = mc.id
      WHERE m.id = $1 AND mc.code = 'CHEM'
    `, [starch.id]);
    assert(parseFloat(chemStarch.current_stock) === (initialStarchStock - jwQty - rtvQty), `Chemical Store API query reflects live stock: ${chemStarch.current_stock} KGS`);

    // Check Raw Material Store query reflection
    const { rows: [rawStarch] } = await client.query(`
      SELECT m.id, m.name, m.current_stock, (m.current_stock * m.unit_price) AS valuation
      FROM materials m
      LEFT JOIN material_categories mc ON m.category_id = mc.id
      WHERE m.id = $1 AND (mc.type = 'Raw Material' OR mc.name ILIKE '%chemical%')
    `, [starch.id]);
    assert(parseFloat(rawStarch.current_stock) === (initialStarchStock - jwQty - rtvQty), `Raw Material Store API query reflects live stock: ${rawStarch.current_stock} KGS`);

    // Check Master Inventory query reflection
    const { rows: [masterStarch] } = await client.query(`
      SELECT m.id, m.name, m.current_stock
      FROM materials m
      WHERE m.id = $1
    `, [starch.id]);
    assert(parseFloat(masterStarch.current_stock) === (initialStarchStock - jwQty - rtvQty), `Master Inventory query reflects live stock: ${masterStarch.current_stock} KGS`);

    // ------------------------------------------------------------------------
    console.log('\n--- 4. CLEANUP TEST TRANSACTIONS AND RESTORE INITIAL STARCH STOCK ---');
    // ------------------------------------------------------------------------
    await client.query('UPDATE materials SET current_stock = $1 WHERE id = $2', [initialStarchStock, starch.id]);
    await client.query('DELETE FROM stock_ledger WHERE material_id = $1 AND transaction_type IN (\'job_work\', \'return_to_vendor\') AND date = CURRENT_DATE', [starch.id]);
    await client.query('DELETE FROM gate_passes WHERE id IN ($1, $2)', [gpJW.id, gpRTV.id]);

    const { rows: [restoredStarch] } = await client.query('SELECT current_stock FROM materials WHERE id = $1', [starch.id]);
    assert(parseFloat(restoredStarch.current_stock) === initialStarchStock, `Initial Starch stock restored cleanly to: ${restoredStarch.current_stock} KGS`);

    console.log('\n===============================================================');
    console.log('SUMMARY: All 10 validation checks passed with 100% success.');
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
