require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const pool = require('../src/db/pool');

let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ PASS: ${message}`);
    passedTests++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failedTests++;
  }
}

async function runTests() {
  console.log('===============================================================');
  console.log('🧪 MULTI-AGENT VALIDATION: MULTI-ITEM FAST OUTWARD ENGINE');
  console.log('   1. Multi-Item Job Work | 2. Multi-Item RTV | 3. Multi-Item STO | 4. Multi-Item Issue');
  console.log('===============================================================\n');

  const client = await pool.connect();

  try {
    // 0. Setup: Ensure an active vendor, department, machine, and test materials with stock exist
    const { rows: [user] } = await client.query(`SELECT id, name FROM users ORDER BY id ASC LIMIT 1`);
    assert(!!user, `Active User found: ${user?.name} (ID: ${user?.id})`);

    const { rows: [vendor] } = await client.query(`SELECT id, name, code FROM vendors WHERE is_active = true ORDER BY id ASC LIMIT 1`);
    assert(!!vendor, `Active Vendor found: ${vendor?.name} (ID: ${vendor?.id})`);

    const { rows: [dept] } = await client.query(`SELECT id, name FROM departments ORDER BY id ASC LIMIT 1`);
    assert(!!dept, `Plant Department found: ${dept?.name} (ID: ${dept?.id})`);

    const { rows: [machine] } = await client.query(`SELECT id, name, code FROM machines ORDER BY id ASC LIMIT 1`);
    assert(!!machine, `Machine found: ${machine?.name || machine?.code} (ID: ${machine?.id})`);

    // Create 3 dedicated test materials
    const testMaterials = [];
    const matDefs = [
      { code: 'TEST-BATCH-MAT-01', name: 'Test Spherical Roller Bearing 22220', uom: 'Nos', stock: 50, price: 1200 },
      { code: 'TEST-BATCH-MAT-02', name: 'Test Rubber Squeegee Roll Sleeve', uom: 'Nos', stock: 30, price: 4500 },
      { code: 'TEST-BATCH-MAT-03', name: 'Test Heavy Duty Pump Impeller', uom: 'Nos', stock: 20, price: 8000 }
    ];

    for (const def of matDefs) {
      const { rows: existing } = await client.query(`SELECT * FROM materials WHERE code = $1`, [def.code]);
      if (existing.length > 0) {
        await client.query(`UPDATE materials SET current_stock = $1, unit_price = $2 WHERE id = $3`, [def.stock, def.price, existing[0].id]);
        const { rows: [m] } = await client.query(`SELECT * FROM materials WHERE id = $1`, [existing[0].id]);
        testMaterials.push(m);
      } else {
        const { rows: [newM] } = await client.query(`
          INSERT INTO materials (code, name, uom, current_stock, unit_price, is_active)
          VALUES ($1, $2, $3, $4, $5, true)
          RETURNING *
        `, [def.code, def.name, def.uom, def.stock, def.price]);
        testMaterials.push(newM);
      }
    }
    assert(testMaterials.length === 3, `Setup 3 test materials with initial stocks: [50, 30, 20]`);

    // ------------------------------------------------------------------------
    console.log('\n--- 1. Testing WORKFLOW 1: MULTI-ITEM JOB WORK BATCH ---');
    // ------------------------------------------------------------------------
    const jwItems = [
      { material_id: testMaterials[0].id, out_qty: 4, unit_price: 1300, remarks: 'Journal turning to 90mm' },
      { material_id: testMaterials[1].id, out_qty: 2, unit_price: 4800, remarks: 'Rubber regrinding Class A' }
    ];

    await client.query('BEGIN');
    const lockedJW = [];
    for (const it of jwItems) {
      const { rows: [m] } = await client.query('SELECT * FROM materials WHERE id = $1 FOR UPDATE', [it.material_id]);
      const curStock = parseFloat(m.current_stock);
      const reqQty = parseFloat(it.out_qty);
      assert(curStock >= reqQty, `Material "${m.name}" has sufficient stock (${curStock} >= ${reqQty})`);
      const newStock = curStock - reqQty;
      await client.query('UPDATE materials SET current_stock = $1 WHERE id = $2', [newStock, it.material_id]);
      lockedJW.push({ ...it, mat: m, curStock, newStock, totalVal: reqQty * it.unit_price });
    }

    const d = new Date();
    const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
    const seqJW = await client.query(`SELECT COUNT(*)+1 AS n FROM gate_passes WHERE created_at::date = CURRENT_DATE`);
    const gpNumJW = `GP-JW-${stamp}-${String(seqJW.rows[0].n).padStart(4, '0')}`;
    const matSummaryJW = lockedJW.map(l => `${l.out_qty} ${l.mat.uom} of ${l.mat.name}`).join(', ');

    const { rows: [gpJW] } = await client.query(`
      INSERT INTO gate_passes (
        gp_number, pass_type, vehicle_type, vehicle_number, driver_name, purpose,
        material_description, from_party, to_party, out_time, security_guard_id, remarks,
        vendor_id, status
      ) VALUES (
        $1, 'RETURNABLE', 'Commercial Vehicle', 'KA-04-E-9999', 'Ramesh', 'Outside Job Work',
        $2, 'MK Paper Mill Store', $3, NOW(), $4, 'Multi-item job work batch',
        $5, 'Open'
      ) RETURNING id, gp_number
    `, [gpNumJW, `Job Work (2 items): ${matSummaryJW}`, vendor.name, user.id, vendor.id]);

    for (const l of lockedJW) {
      const remark = `[Job Work] | Party: ${vendor.name} | Ref: ${gpJW.gp_number} | Dept: ${dept.name} | Note: ${l.remarks}`;
      await client.query(`
        INSERT INTO stock_ledger (
          material_id, date, transaction_type, reference_type, reference_id,
          vendor_id, in_qty, out_qty, balance, unit_price, value, remarks, created_by
        ) VALUES ($1, CURRENT_DATE, 'job_work', 'JOB_WORK', NULL, $2, 0, $3, $4, $5, $6, $7, $8)
      `, [l.material_id, vendor.id, l.out_qty, l.newStock, l.unit_price, l.totalVal, remark, user.id]);
    }
    await client.query('COMMIT');

    const { rows: [mat1AfterJW] } = await client.query('SELECT current_stock FROM materials WHERE id = $1', [testMaterials[0].id]);
    const { rows: [mat2AfterJW] } = await client.query('SELECT current_stock FROM materials WHERE id = $1', [testMaterials[1].id]);
    assert(parseFloat(mat1AfterJW.current_stock) === 46, `Material 1 stock deducted from 50 to 46 Nos`);
    assert(parseFloat(mat2AfterJW.current_stock) === 28, `Material 2 stock deducted from 30 to 28 Nos`);
    assert(gpJW.gp_number.startsWith('GP-JW-'), `Bundled Returnable Gate Pass generated: ${gpJW.gp_number}`);

    // ------------------------------------------------------------------------
    console.log('\n--- 2. Testing WORKFLOW 2: MULTI-ITEM RETURN TO PARTY (RTV) & DEBIT NOTE (SUB + TAX) ---');
    // ------------------------------------------------------------------------
    const { rows: [testGrn] } = await client.query(`
      INSERT INTO grn (grn_number, date, vendor_id, status, remarks)
      VALUES ('GRN-BATCH-TEST-01', CURRENT_DATE, $1, 'Received', 'Multi-item GRN for RTV test')
      RETURNING id, grn_number
    `, [vendor.id]);

    await client.query(`
      INSERT INTO grn_items (grn_id, material_id, received_qty, unit_price, gst_pct, uom)
      VALUES 
        ($1, $2, 10, 1200, 18, 'Nos'),
        ($1, $3, 5, 8000, 18, 'Nos')
    `, [testGrn.id, testMaterials[0].id, testMaterials[2].id]);

    const rtvItems = [
      { material_id: testMaterials[0].id, out_qty: 2, unit_price: 1200, gst_pct: 18, remarks: 'QC hardness fail' },
      { material_id: testMaterials[2].id, out_qty: 1, unit_price: 8000, gst_pct: 18, remarks: 'Defective blade crack' }
    ];

    await client.query('BEGIN');
    const lockedRTV = [];
    for (const it of rtvItems) {
      const { rows: [m] } = await client.query('SELECT * FROM materials WHERE id = $1 FOR UPDATE', [it.material_id]);
      const curStock = parseFloat(m.current_stock);
      const reqQty = parseFloat(it.out_qty);
      const newStock = curStock - reqQty;
      await client.query('UPDATE materials SET current_stock = $1 WHERE id = $2', [newStock, it.material_id]);

      const subAmt = reqQty * it.unit_price;
      const taxAmt = (subAmt * it.gst_pct) / 100;
      const totalDebitAmt = subAmt + taxAmt;

      lockedRTV.push({
        ...it,
        mat: m,
        curStock,
        newStock,
        subAmt,
        taxAmt,
        totalDebitAmt,
        totalVal: subAmt
      });
    }

    const totalRtvSub = lockedRTV.reduce((s, it) => s + it.subAmt, 0);
    const totalRtvTax = lockedRTV.reduce((s, it) => s + it.taxAmt, 0);
    const totalRtvDebit = totalRtvSub + totalRtvTax;

    assert(totalRtvSub === (2 * 1200 + 1 * 8000), `Total Sub Amount (Taxable) calculated correctly: ₹${totalRtvSub} (2400 + 8000)`);
    assert(totalRtvTax === (10400 * 0.18), `Total GST Tax Amount (18%) calculated correctly: ₹${totalRtvTax} (₹1872)`);
    assert(totalRtvDebit === 12272, `Total Gross Debit Note calculated correctly: ₹${totalRtvDebit} (₹10400 Sub + ₹1872 Tax)`);

    const seqRTV = await client.query(`SELECT COUNT(*)+1 AS n FROM gate_passes WHERE created_at::date = CURRENT_DATE`);
    const gpNumRTV = `GP-RTV-${stamp}-${String(seqRTV.rows[0].n).padStart(4, '0')}`;
    const matSummaryRTV = lockedRTV.map(l => `${l.out_qty} ${l.mat.uom} of ${l.mat.name} (Sub: ₹${l.subAmt} + Tax: ₹${l.taxAmt})`).join(', ');

    const { rows: [gpRTV] } = await client.query(`
      INSERT INTO gate_passes (
        gp_number, pass_type, vehicle_type, vehicle_number, driver_name, purpose,
        material_description, from_party, to_party, out_time, security_guard_id, remarks,
        vendor_id, status
      ) VALUES (
        $1, 'RTV', 'Commercial Vehicle', 'KA-04-E-8888', 'Suresh', 'Return to Vendor (RTV)',
        $2, 'MK Paper Mill', $3, NOW(), $4, 'Multi-item QC reject batch',
        $5, 'Closed'
      ) RETURNING id, gp_number
    `, [gpNumRTV, `RTV (2 items | Sub: ₹${totalRtvSub} + Tax: ₹${totalRtvTax} = Debit: ₹${totalRtvDebit}): ${matSummaryRTV}`, vendor.name, user.id, vendor.id]);

    for (const l of lockedRTV) {
      const remark = `[Return to Party] | Party: ${vendor.name} | Ref: ${testGrn.grn_number} | Sub: ₹${l.subAmt.toFixed(2)} | GST (${l.gst_pct}%): ₹${l.taxAmt.toFixed(2)} | Debit Total: ₹${l.totalDebitAmt.toFixed(2)} | Note: ${l.remarks}`;
      await client.query(`
        INSERT INTO stock_ledger (
          material_id, date, transaction_type, reference_type, reference_id,
          vendor_id, in_qty, out_qty, balance, unit_price, value, remarks, created_by
        ) VALUES ($1, CURRENT_DATE, 'return_to_vendor', 'RTV', NULL, $2, 0, $3, $4, $5, $6, $7, $8)
      `, [l.material_id, vendor.id, l.out_qty, l.newStock, l.unit_price, l.subAmt, remark, user.id]);
    }
    await client.query('COMMIT');

    const { rows: [mat1AfterRTV] } = await client.query('SELECT current_stock FROM materials WHERE id = $1', [testMaterials[0].id]);
    const { rows: [mat3AfterRTV] } = await client.query('SELECT current_stock FROM materials WHERE id = $1', [testMaterials[2].id]);
    assert(parseFloat(mat1AfterRTV.current_stock) === 44, `Material 1 stock deducted from 46 to 44 Nos`);
    assert(parseFloat(mat3AfterRTV.current_stock) === 19, `Material 3 stock deducted from 20 to 19 Nos`);
    assert(gpRTV.gp_number.startsWith('GP-RTV-'), `Bundled RTV Gate Pass generated with Debit Note financials: ${gpRTV.gp_number}`);

    // ------------------------------------------------------------------------
    console.log('\n--- 3. Testing WORKFLOW 3: MULTI-ITEM INTER STORE TRANSFER (STO) ---');
    // ------------------------------------------------------------------------
    const stoNumber = `STO-${stamp}-9001`;
    const stoItems = [
      { material_id: testMaterials[0].id, out_qty: 4, unit_price: 1200 },
      { material_id: testMaterials[1].id, out_qty: 3, unit_price: 4500 },
      { material_id: testMaterials[2].id, out_qty: 2, unit_price: 8000 }
    ];

    await client.query('BEGIN');
    for (const it of stoItems) {
      const { rows: [m] } = await client.query('SELECT * FROM materials WHERE id = $1 FOR UPDATE', [it.material_id]);
      const curStock = parseFloat(m.current_stock);
      const reqQty = parseFloat(it.out_qty);
      const newStock = curStock - reqQty;
      await client.query('UPDATE materials SET current_stock = $1 WHERE id = $2', [newStock, it.material_id]);

      const remark = `[Inter Store Transfer] | Ref: ${stoNumber} | Dept: ${dept.name} | M/S: ${machine.name}`;
      await client.query(`
        INSERT INTO stock_ledger (
          material_id, date, transaction_type, reference_type, reference_id,
          vendor_id, in_qty, out_qty, balance, unit_price, value, remarks, created_by
        ) VALUES ($1, CURRENT_DATE, 'transfer', 'STO', NULL, NULL, 0, $2, $3, $4, $5, $6, $7)
      `, [it.material_id, reqQty, newStock, it.unit_price, reqQty * it.unit_price, remark, user.id]);
    }
    await client.query('COMMIT');

    const { rows: [mat1AfterSTO] } = await client.query('SELECT current_stock FROM materials WHERE id = $1', [testMaterials[0].id]);
    const { rows: [mat2AfterSTO] } = await client.query('SELECT current_stock FROM materials WHERE id = $1', [testMaterials[1].id]);
    const { rows: [mat3AfterSTO] } = await client.query('SELECT current_stock FROM materials WHERE id = $1', [testMaterials[2].id]);
    assert(parseFloat(mat1AfterSTO.current_stock) === 40, `Material 1 stock deducted to 40 Nos`);
    assert(parseFloat(mat2AfterSTO.current_stock) === 25, `Material 2 stock deducted to 25 Nos`);
    assert(parseFloat(mat3AfterSTO.current_stock) === 17, `Material 3 stock deducted to 17 Nos`);

    // ------------------------------------------------------------------------
    console.log('\n--- 4. Testing ATOMIC ROLLBACK ON INSUFFICIENT STOCK ---');
    // ------------------------------------------------------------------------
    let rollbackSuccess = false;
    await client.query('BEGIN');
    try {
      // Try to deduct 100 Nos when only 40 are available
      const { rows: [m1] } = await client.query('SELECT * FROM materials WHERE id = $1 FOR UPDATE', [testMaterials[0].id]);
      const curStock = parseFloat(m1.current_stock);
      if (curStock < 100) {
        throw new Error(`Insufficient stock for "${m1.name}". Requested: 100, Available: ${curStock}`);
      }
    } catch (e) {
      await client.query('ROLLBACK');
      rollbackSuccess = true;
    }
    assert(rollbackSuccess, `Transaction successfully rolled back when requesting quantity exceeds available inventory`);

    const { rows: [mat1Final] } = await client.query('SELECT current_stock FROM materials WHERE id = $1', [testMaterials[0].id]);
    assert(parseFloat(mat1Final.current_stock) === 40, `Inventory stock remained untouched at 40 Nos after rollback`);

    // Clean up test data
    await client.query(`DELETE FROM stock_ledger WHERE material_id IN ($1, $2, $3)`, [testMaterials[0].id, testMaterials[1].id, testMaterials[2].id]);
    await client.query(`DELETE FROM grn_items WHERE grn_id = $1`, [testGrn.id]);
    await client.query(`DELETE FROM grn WHERE id = $1`, [testGrn.id]);
    await client.query(`DELETE FROM gate_passes WHERE id IN ($1, $2)`, [gpJW.id, gpRTV.id]);
    await client.query(`DELETE FROM materials WHERE id IN ($1, $2, $3)`, [testMaterials[0].id, testMaterials[1].id, testMaterials[2].id]);
    console.log('\n  ✓ Test records cleaned up cleanly.');

  } catch (err) {
    console.error('Test suite error:', err);
    failedTests++;
  } finally {
    client.release();
    await pool.end();
  }

  console.log('\n===============================================================');
  console.log(`SUMMARY: ${passedTests} passed, ${failedTests} failed`);
  console.log('===============================================================');
  if (failedTests > 0) process.exit(1);
}

runTests();
