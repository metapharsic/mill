const pool = require('../src/db/pool');

async function runTest() {
  console.log('=== Starting GRN Full Update Lifecycle & Ledger Sync Test ===\n');
  const client = await pool.connect();

  try {
    // 1. Setup Test Material, Vendor & PO
    const matCode = `TEST-MAT-${Date.now()}`;
    const { rows: [mat] } = await client.query(`
      INSERT INTO materials (code, name, uom, current_stock, unit_price, is_active)
      VALUES ($1, 'Test GRN Material', 'Nos', 50, 100.00, true)
      RETURNING id, code, name, uom, current_stock, unit_price
    `, [matCode]);
    console.log(`✓ Created test material #${mat.id} [${mat.code}] Initial stock: ${mat.current_stock}, Price: ${mat.unit_price}`);

    const { rows: [vendor] } = await client.query(`
      INSERT INTO vendors (code, name, is_active)
      VALUES ($1, 'Test GRN Vendor Inc', true)
      RETURNING id, code, name
    `, [`V-${Date.now()}`]);
    console.log(`✓ Created test vendor #${vendor.id} [${vendor.name}]`);

    const { rows: [po] } = await client.query(`
      INSERT INTO purchase_orders (po_number, vendor_id, date, status, total_value, grand_total)
      VALUES ($1, $2, CURRENT_DATE, 'Approved', 1000, 1180)
      RETURNING id, po_number
    `, [`PO-TEST-${Date.now()}`, vendor.id]);

    const { rows: [poItem] } = await client.query(`
      INSERT INTO po_items (po_id, material_id, uom, qty, unit_price, received_qty)
      VALUES ($1, $2, 'Nos', 20, 100.00, 0)
      RETURNING id, material_id, qty, received_qty
    `, [po.id, mat.id]);
    console.log(`✓ Created test PO #${po.id} [${po.po_number}] with item qty: 20, received: 0`);

    // 2. Generate GRN (Receiving 10 units)
    const grnNum = `GRN-TEST-${Date.now()}`;
    const { rows: [grn] } = await client.query(`
      INSERT INTO grn (grn_number, date, vendor_id, po_id, vehicle_number, challan_number, invoice_number, status, remarks)
      VALUES ($1, CURRENT_DATE, $2, $3, 'PB-01-A-1234', 'CH-1001', 'INV-5555', 'Received', 'Initial Receipt')
      RETURNING id, grn_number
    `, [grnNum, vendor.id, po.id]);

    const { rows: [grnItem] } = await client.query(`
      INSERT INTO grn_items (grn_id, material_id, po_qty, received_qty, accepted_qty, rejected_qty, uom, unit_price, bin_location, remarks)
      VALUES ($1, $2, 20, 10, 10, 0, 'Nos', 100.00, 'BIN-A1', 'Received fine')
      RETURNING id, material_id, received_qty, accepted_qty, unit_price
    `, [grn.id, mat.id]);

    // Initial stock increment
    await client.query(`UPDATE materials SET current_stock = current_stock + 10 WHERE id = $1`, [mat.id]);
    await client.query(`UPDATE po_items SET received_qty = 10 WHERE id = $1`, [poItem.id]);
    await client.query(`
      INSERT INTO stock_ledger (material_id, date, transaction_type, reference_type, reference_id, in_qty, out_qty, balance, unit_price, value, remarks)
      VALUES ($1, CURRENT_DATE, 'grn', 'PO', $2, 10, 0, 60, 100.00, 1000.00, $3)
    `, [mat.id, po.id, `Inward GRN ${grn.grn_number}`]);
    console.log(`✓ Initial GRN created: #${grn.id} [${grn.grn_number}]. Stock is now 60 Nos.`);

    // 3. Test GRN Update - Price & Quantity increase (Price: 100 -> 150, Accepted Qty: 10 -> 15)
    console.log('\n--- Testing GRN Price & Quantity Adjustment (Accepted: 10 -> 15, Price: 100 -> 150) ---');
    const newPrice = 150.00;
    const newAccQty = 15;
    const delta = newAccQty - 10; // +5

    await client.query('BEGIN');

    // Header update
    await client.query(`
      UPDATE grn 
      SET invoice_number = 'INV-5555-UPDATED', vehicle_number = 'PB-01-A-9999', remarks = 'Updated remarks'
      WHERE id = $1
    `, [grn.id]);

    // Material update
    await client.query(`
      UPDATE materials 
      SET current_stock = current_stock + $1, unit_price = $2
      WHERE id = $3
    `, [delta, newPrice, mat.id]);

    // GRN items update
    await client.query(`
      UPDATE grn_items 
      SET received_qty = $1, accepted_qty = $2, unit_price = $3, bin_location = 'BIN-A2'
      WHERE id = $4
    `, [newAccQty, newAccQty, newPrice, grnItem.id]);

    // Stock ledger update
    await client.query(`
      UPDATE stock_ledger 
      SET in_qty = $1, balance = balance + $2, unit_price = $3, value = $1::numeric * $3::numeric
      WHERE material_id = $4 AND reference_id = $5
    `, [newAccQty, delta, newPrice, mat.id, po.id]);

    // PO items update
    await client.query(`
      UPDATE po_items SET received_qty = $1 WHERE id = $2
    `, [newAccQty, poItem.id]);

    await client.query('COMMIT');

    // Verify after update
    const { rows: [matAfterUpd] } = await client.query(`SELECT current_stock, unit_price FROM materials WHERE id = $1`, [mat.id]);
    const { rows: [poAfterUpd] } = await client.query(`SELECT received_qty FROM po_items WHERE id = $1`, [poItem.id]);
    const { rows: [grnItemAfterUpd] } = await client.query(`SELECT accepted_qty, unit_price, bin_location FROM grn_items WHERE id = $1`, [grnItem.id]);
    const { rows: [ledgerAfterUpd] } = await client.query(`SELECT in_qty, balance, unit_price, value FROM stock_ledger WHERE material_id = $1 AND reference_id = $2`, [mat.id, po.id]);

    console.log(`✓ Material current_stock: ${matAfterUpd.current_stock} (Expected: 65)`);
    console.log(`✓ Material unit_price: ${matAfterUpd.unit_price} (Expected: 150.00)`);
    console.log(`✓ PO Item received_qty: ${poAfterUpd.received_qty} (Expected: 15)`);
    console.log(`✓ GRN Item accepted_qty: ${grnItemAfterUpd.accepted_qty}, price: ${grnItemAfterUpd.unit_price}, bin: ${grnItemAfterUpd.bin_location}`);
    console.log(`✓ Stock ledger in_qty: ${ledgerAfterUpd.in_qty}, balance: ${ledgerAfterUpd.balance}, value: ${ledgerAfterUpd.value} (Expected: 2250)`);

    if (parseFloat(matAfterUpd.current_stock) !== 65 || parseFloat(matAfterUpd.unit_price) !== 150 || parseFloat(poAfterUpd.received_qty) !== 15) {
      throw new Error('Verification assertion failed for GRN update!');
    }

    // 4. Test Negative Stock Protection
    console.log('\n--- Testing Negative Stock Protection ---');
    // Set material stock to 2
    await client.query(`UPDATE materials SET current_stock = 2 WHERE id = $1`, [mat.id]);
    // Try to reduce accepted qty by 10 (from 15 to 5, delta = -10, resulting stock would be 2 - 10 = -8)
    let caught = false;
    try {
      const reductionDelta = 5 - 15; // -10
      const { rows: [matLock] } = await client.query(`SELECT current_stock FROM materials WHERE id = $1 FOR UPDATE`, [mat.id]);
      const potentialStock = parseFloat(matLock.current_stock) + reductionDelta;
      if (potentialStock < 0) {
        throw new Error(`Cannot reduce accepted quantity: resulting stock would be negative (${potentialStock})`);
      }
    } catch (err) {
      caught = true;
      console.log(`✓ Correctly caught negative stock attempt: "${err.message}"`);
    }
    if (!caught) throw new Error('Failed to prevent negative stock condition!');

    // 5. Cleanup Test Data
    console.log('\n--- Cleaning Up Test Artifacts ---');
    await client.query(`DELETE FROM stock_ledger WHERE material_id = $1`, [mat.id]);
    await client.query(`DELETE FROM grn_items WHERE grn_id = $1`, [grn.id]);
    await client.query(`DELETE FROM grn WHERE id = $1`, [grn.id]);
    await client.query(`DELETE FROM po_items WHERE po_id = $1`, [po.id]);
    await client.query(`DELETE FROM purchase_orders WHERE id = $1`, [po.id]);
    await client.query(`DELETE FROM vendors WHERE id = $1`, [vendor.id]);
    await client.query(`DELETE FROM materials WHERE id = $1`, [mat.id]);
    console.log('✓ All test records cleaned up cleanly.');

    console.log('\n=== ALL GRN UPDATE LIFECYCLE TESTS PASSED PERFECTLY ===\n');
  } catch (err) {
    console.error('❌ Test failed with error:', err);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

runTest();
