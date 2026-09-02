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
  console.log('🧪 MULTI-AGENT VALIDATION: FAST OUTWARD ISSUE WORKFLOWS');
  console.log('   1. Job Work | 2. Return to Party | 3. Inter Store Transfer');
  console.log('===============================================================\n');

  const client = await pool.connect();

  try {
    // 0. Setup: Ensure an active vendor, department, machine, and material with stock exist
    const { rows: [user] } = await client.query(`SELECT id, name FROM users ORDER BY id ASC LIMIT 1`);
    assert(!!user, `Active User found: ${user?.name} (ID: ${user?.id})`);

    const { rows: [vendor] } = await client.query(`SELECT id, name, code FROM vendors WHERE is_active = true ORDER BY id ASC LIMIT 1`);
    assert(!!vendor, `Active Vendor found: ${vendor?.name} (ID: ${vendor?.id})`);

    const { rows: [dept] } = await client.query(`SELECT id, name FROM departments ORDER BY id ASC LIMIT 1`);
    assert(!!dept, `Plant Department found: ${dept?.name} (ID: ${dept?.id})`);

    const { rows: [machine] } = await client.query(`SELECT id, name, code FROM machines ORDER BY id ASC LIMIT 1`);
    assert(!!machine, `Machine found: ${machine?.name || machine?.code} (ID: ${machine?.id})`);

    // Create or select a dedicated test material with known stock
    let testMat;
    const { rows: matRows } = await client.query(`SELECT * FROM materials WHERE code = 'TEST-OUTWARD-01'`);
    if (matRows.length > 0) {
      testMat = matRows[0];
      await client.query(`UPDATE materials SET current_stock = 100, unit_price = 250 WHERE id = $1`, [testMat.id]);
    } else {
      const { rows: [newMat] } = await client.query(`
        INSERT INTO materials (code, name, uom, current_stock, unit_price, is_active)
        VALUES ('TEST-OUTWARD-01', 'Test Mechanical Roller Shaft', 'Nos', 100, 250, true)
        RETURNING *
      `);
      testMat = newMat;
    }
    assert(!!testMat, `Test Material ready: ${testMat.name} (Initial Stock: 100 Nos @ ₹250)`);

    // ------------------------------------------------------------------------
    console.log('\n--- 1. Testing WORKFLOW 1: JOB WORK ---');
    // ------------------------------------------------------------------------
    const initialStockJW = 100;
    const jwQty = 5;
    const jwRate = 300; // Custom job work valuation rate

    // Simulate POST /api/store/outward for Job Work
    await client.query('BEGIN');
    const { rows: [matLockedJW] } = await client.query('SELECT * FROM materials WHERE id = $1 FOR UPDATE', [testMat.id]);
    const newStockJW = parseFloat(matLockedJW.current_stock) - jwQty;
    const totalValJW = jwQty * jwRate;
    await client.query('UPDATE materials SET current_stock = $1 WHERE id = $2', [newStockJW, testMat.id]);

    const d = new Date();
    const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
    const seqJW = await client.query(`SELECT COUNT(*)+1 AS n FROM gate_passes WHERE created_at::date = CURRENT_DATE`);
    const gpNumJW = `GP-JW-${stamp}-${String(seqJW.rows[0].n).padStart(4, '0')}`;

    const { rows: [gpJW] } = await client.query(`
      INSERT INTO gate_passes (
        gp_number, pass_type, vehicle_type, vehicle_number, driver_name, purpose,
        material_description, from_party, to_party, out_time, security_guard_id, remarks,
        vendor_id, status
      ) VALUES (
        $1, 'RETURNABLE', 'Commercial Vehicle', 'KA-01-AB-1234', 'Ramesh Kumar', 'Bearing journal turning & re-sleeving',
        $2, 'MK Paper Mill Main Store', $3, NOW(), $4, 'Job work outward test',
        $5, 'Open'
      ) RETURNING id, gp_number
    `, [gpNumJW, `Job Work: ${jwQty} Nos of ${testMat.name}`, vendor.name, user.id, vendor.id]);

    const remarkJW = `[Job Work] | Party: ${vendor.name} | Ref: ${gpJW.gp_number} | Dept: ${dept.name} | M/S: ${machine.name} | Purpose: Bearing journal turning`;
    const { rows: [ledgerJW] } = await client.query(`
      INSERT INTO stock_ledger (
        material_id, date, transaction_type, reference_type, reference_id,
        vendor_id, in_qty, out_qty, balance, unit_price, value, remarks, created_by
      ) VALUES (
        $1, CURRENT_DATE, 'job_work', 'JOB_WORK', NULL,
        $2, 0, $3, $4, $5, $6, $7, $8
      ) RETURNING *
    `, [testMat.id, vendor.id, jwQty, newStockJW, jwRate, totalValJW, remarkJW, user.id]);
    await client.query('COMMIT');

    assert(parseFloat(ledgerJW.out_qty) === jwQty, `Stock Ledger recorded out_qty: ${jwQty}`);
    assert(parseFloat(ledgerJW.balance) === 95, `Stock Ledger recorded new balance: 95 Nos`);
    assert(ledgerJW.transaction_type === 'job_work', `Transaction type is strictly 'job_work'`);
    assert(ledgerJW.vendor_id === vendor.id, `Stock ledger links vendor_id: ${vendor.id}`);
    assert(gpJW.gp_number.startsWith('GP-JW-'), `Returnable Gate Pass generated: ${gpJW.gp_number}`);

    // ------------------------------------------------------------------------
    console.log('\n--- 2. Testing WORKFLOW 2: RETURN TO PARTY (RTV) ---');
    // ------------------------------------------------------------------------
    // Seed a dummy GRN record to test vendor GRN material lookup
    const { rows: [testGrn] } = await client.query(`
      INSERT INTO grn (grn_number, date, vendor_id, status, remarks)
      VALUES ('GRN-TEST-999', CURRENT_DATE, $1, 'Received', 'Test GRN for RTV')
      RETURNING id, grn_number
    `, [vendor.id]);

    await client.query(`
      INSERT INTO grn_items (grn_id, material_id, received_qty, unit_price, uom)
      VALUES ($1, $2, 20, 240, 'Nos')
    `, [testGrn.id, testMat.id]);

    // Query vendor GRN materials endpoint logic
    const { rows: vGrnMats } = await client.query(`
      SELECT DISTINCT ON (gi.material_id, g.id)
        gi.material_id, m.name AS "materialName", gi.unit_price AS "unitPrice",
        gi.received_qty AS "receivedQty", g.grn_number AS "grnNumber"
      FROM grn_items gi
      JOIN grn g ON gi.grn_id = g.id
      JOIN materials m ON gi.material_id = m.id
      WHERE g.vendor_id = $1
    `, [vendor.id]);
    assert(vGrnMats.length > 0, `Vendor GRN Materials lookup successfully retrieved ${vGrnMats.length} item(s)`);

    const rtvQty = 3;
    const rtvRate = 240;
    await client.query('BEGIN');
    const { rows: [matLockedRTV] } = await client.query('SELECT * FROM materials WHERE id = $1 FOR UPDATE', [testMat.id]);
    const newStockRTV = parseFloat(matLockedRTV.current_stock) - rtvQty;
    const totalValRTV = rtvQty * rtvRate;
    await client.query('UPDATE materials SET current_stock = $1 WHERE id = $2', [newStockRTV, testMat.id]);

    const seqRTV = await client.query(`SELECT COUNT(*)+1 AS n FROM gate_passes WHERE created_at::date = CURRENT_DATE`);
    const gpNumRTV = `GP-RTV-${stamp}-${String(seqRTV.rows[0].n).padStart(4, '0')}`;

    const { rows: [gpRTV] } = await client.query(`
      INSERT INTO gate_passes (
        gp_number, pass_type, vehicle_type, vehicle_number, driver_name, purpose,
        material_description, from_party, to_party, out_time, security_guard_id, remarks,
        vendor_id, status
      ) VALUES (
        $1, 'RTV', 'Commercial Vehicle', 'KA-01-XY-5678', 'Suresh', 'Return to Vendor (RTV)',
        $2, 'MK Paper Mill', $3, NOW(), $4, 'QC Reject return',
        $5, 'Closed'
      ) RETURNING id, gp_number
    `, [gpNumRTV, `RTV: ${rtvQty} Nos of ${testMat.name}`, vendor.name, user.id, vendor.id]);

    const remarkRTV = `[Return to Party] | Party: ${vendor.name} | Ref: ${testGrn.grn_number} | Dept: ${dept.name} | Purpose: QC Spec Failure`;
    const { rows: [ledgerRTV] } = await client.query(`
      INSERT INTO stock_ledger (
        material_id, date, transaction_type, reference_type, reference_id,
        vendor_id, in_qty, out_qty, balance, unit_price, value, remarks, created_by
      ) VALUES (
        $1, CURRENT_DATE, 'return_to_vendor', 'RTV', NULL,
        $2, 0, $3, $4, $5, $6, $7, $8
      ) RETURNING *
    `, [testMat.id, vendor.id, rtvQty, newStockRTV, rtvRate, totalValRTV, remarkRTV, user.id]);
    await client.query('COMMIT');

    assert(parseFloat(ledgerRTV.out_qty) === rtvQty, `RTV Outward recorded out_qty: ${rtvQty}`);
    assert(parseFloat(ledgerRTV.balance) === 92, `RTV Outward recorded new balance: 92 Nos`);
    assert(ledgerRTV.transaction_type === 'return_to_vendor', `Transaction type is strictly 'return_to_vendor'`);
    assert(gpRTV.gp_number.startsWith('GP-RTV-'), `RTV Outward Gate Pass generated: ${gpRTV.gp_number}`);

    // ------------------------------------------------------------------------
    console.log('\n--- 3. Testing WORKFLOW 3: INTER STORE TRANSFER ---');
    // ------------------------------------------------------------------------
    const stoQty = 10;
    const stoRate = 250;
    const stoNumber = `STO-${stamp}-0001`;

    await client.query('BEGIN');
    const { rows: [matLockedSTO] } = await client.query('SELECT * FROM materials WHERE id = $1 FOR UPDATE', [testMat.id]);
    const newStockSTO = parseFloat(matLockedSTO.current_stock) - stoQty;
    const totalValSTO = stoQty * stoRate;
    await client.query('UPDATE materials SET current_stock = $1 WHERE id = $2', [newStockSTO, testMat.id]);

    const remarkSTO = `[Inter Store Transfer] | Ref: ${stoNumber} | Dept: ${dept.name} | M/S: ${machine.name} | To: Electrical Sub-Store Keeper | Purpose: Shift replenishment`;
    const { rows: [ledgerSTO] } = await client.query(`
      INSERT INTO stock_ledger (
        material_id, date, transaction_type, reference_type, reference_id,
        vendor_id, in_qty, out_qty, balance, unit_price, value, remarks, created_by
      ) VALUES (
        $1, CURRENT_DATE, 'transfer', 'STO', NULL,
        NULL, 0, $2, $3, $4, $5, $6, $7
      ) RETURNING *
    `, [testMat.id, stoQty, newStockSTO, stoRate, totalValSTO, remarkSTO, user.id]);
    await client.query('COMMIT');

    assert(parseFloat(ledgerSTO.out_qty) === stoQty, `STO Transfer recorded out_qty: ${stoQty}`);
    assert(parseFloat(ledgerSTO.balance) === 82, `STO Transfer recorded new balance: 82 Nos`);
    assert(ledgerSTO.transaction_type === 'transfer', `Transaction type is strictly 'transfer'`);

    // ------------------------------------------------------------------------
    console.log('\n--- 4. Testing DML UPDATE & DELETE ON OUTWARD TRANSACTIONS ---');
    // ------------------------------------------------------------------------
    // Update Job Work outward: modify quantity from 5 to 7
    await client.query('BEGIN');
    const oldQty = parseFloat(ledgerJW.out_qty);
    const newQtyUpdated = 7;
    const { rows: [matCur] } = await client.query('SELECT current_stock, unit_price FROM materials WHERE id = $1 FOR UPDATE', [testMat.id]);
    const revertedStock = parseFloat(matCur.current_stock) + oldQty - newQtyUpdated;
    await client.query('UPDATE materials SET current_stock = $1 WHERE id = $2', [revertedStock, testMat.id]);
    const { rows: [updatedLedger] } = await client.query(`
      UPDATE stock_ledger SET out_qty = $1, balance = $2, value = $3 WHERE id = $4 RETURNING *
    `, [newQtyUpdated, revertedStock, newQtyUpdated * parseFloat(matCur.unit_price), ledgerJW.id]);
    await client.query('COMMIT');

    assert(parseFloat(updatedLedger.out_qty) === 7, `DML Update adjusted out_qty to 7`);
    assert(parseFloat(updatedLedger.balance) === 80, `DML Update adjusted material stock balance to 80`);

    // Clean up test records
    await client.query(`DELETE FROM stock_ledger WHERE material_id = $1`, [testMat.id]);
    await client.query(`DELETE FROM grn_items WHERE grn_id = $1`, [testGrn.id]);
    await client.query(`DELETE FROM grn WHERE id = $1`, [testGrn.id]);
    await client.query(`DELETE FROM gate_passes WHERE id IN ($1, $2)`, [gpJW.id, gpRTV.id]);
    await client.query(`DELETE FROM materials WHERE id = $1`, [testMat.id]);
    console.log('\n  ✓ Test records cleaned up cleanly.');

  } catch (err) {
    console.error('Test suite encountered an error:', err);
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
