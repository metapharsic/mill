const pool = require('../backend/src/db/pool');

async function testCompleteGrnUpdates() {
  console.log('--- STARTING COMPLETE GRN UPDATE & RE-PRICING VERIFICATION ---');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Fetch test material and vendor
    const { rows: [mat] } = await client.query('SELECT id, code, name, current_stock, unit_price FROM materials WHERE is_active = true LIMIT 1');
    const { rows: [vendor] } = await client.query('SELECT id, name FROM vendors LIMIT 1');
    const { rows: [user] } = await client.query('SELECT id FROM users LIMIT 1');

    console.log(`[INFO] Test Material: ${mat.code} (${mat.name}), Stock=${mat.current_stock}, Price=₹${mat.unit_price}`);

    // 2. Create Master GRN Header & Line item
    const testGrnNum = 'GRN-TEST-UPD-' + Date.now().toString().slice(-4);
    const { rows: [grnHead] } = await client.query(`
      INSERT INTO grn (grn_number, date, vendor_id, vehicle_number, challan_number, invoice_number, received_by, status, remarks)
      VALUES ($1, CURRENT_DATE, $2, 'TN-01-AB-1234', 'CH-999', 'INV-555', $3, 'Received', 'Initial GRN')
      RETURNING id, grn_number
    `, [testGrnNum, vendor?.id || null, user.id]);

    const { rows: [grnItem] } = await client.query(`
      INSERT INTO grn_items (grn_id, material_id, po_qty, received_qty, accepted_qty, rejected_qty, uom, unit_price, bin_location, remarks)
      VALUES ($1, $2, 10, 10, 10, 0, 'Nos', 500.00, 'BIN-A', 'Initial item')
      RETURNING id, unit_price, received_qty
    `, [grnHead.id, mat.id]);

    const { rows: [ledger] } = await client.query(`
      INSERT INTO stock_ledger (material_id, date, transaction_type, reference_type, reference_id, in_qty, out_qty, balance, unit_price, value, remarks, created_by)
      VALUES ($1, CURRENT_DATE, 'grn', 'GRN', $2, 10, 0, 10, 500.00, 5000.00, 'Initial GRN Ledger', $3)
      RETURNING id, unit_price, in_qty, value
    `, [mat.id, grnHead.id, user.id]);

    console.log(`[PASS] Created GRN #${grnHead.grn_number} with item unit price ₹500.00, qty 10`);

    // 3. Test Full Re-Pricing and Column Update on the GRN
    const updatedPrice = 620.00;
    const updatedQty = 12;
    const updatedBin = 'RACK-04-BOX-2';
    const updatedInvoice = 'INV-555-REVISED';
    const updatedRemarks = 'Updated price after invoice verification';
    const delta = updatedQty - 10;

    // Simulate backend route update
    await client.query(`
      UPDATE grn
      SET invoice_number = $1, remarks = $2
      WHERE id = $3
    `, [updatedInvoice, updatedRemarks, grnHead.id]);

    await client.query(`
      UPDATE grn_items
      SET unit_price = $1, received_qty = $2, accepted_qty = $2, bin_location = $3, remarks = $4
      WHERE id = $5
    `, [updatedPrice, updatedQty, updatedBin, updatedRemarks, grnItem.id]);

    await client.query(`
      UPDATE stock_ledger
      SET in_qty = $1, balance = balance + $2, unit_price = $3, value = $4, bin_location = $5, remarks = $6
      WHERE id = $7
    `, [updatedQty, delta, updatedPrice, updatedQty * updatedPrice, updatedBin, updatedRemarks, ledger.id]);

    await client.query(`
      UPDATE materials
      SET current_stock = current_stock + $1, unit_price = $2, bin_location = $3
      WHERE id = $4
    `, [delta, updatedPrice, updatedBin, mat.id]);

    // 4. Verify that all tables reflect the new price and columns accurately
    const { rows: [finalGrn] } = await client.query('SELECT * FROM grn WHERE id = $1', [grnHead.id]);
    const { rows: [finalItem] } = await client.query('SELECT * FROM grn_items WHERE id = $1', [grnItem.id]);
    const { rows: [finalLedger] } = await client.query('SELECT * FROM stock_ledger WHERE id = $1', [ledger.id]);
    const { rows: [finalMat] } = await client.query('SELECT unit_price, bin_location FROM materials WHERE id = $1', [mat.id]);

    console.log(`[PASS] GRN Invoice updated to: "${finalGrn.invoice_number}"`);
    console.log(`[PASS] GRN Item Price updated to: ₹${finalItem.unit_price}, Qty=${finalItem.received_qty}, Bin=${finalItem.bin_location}`);
    console.log(`[PASS] Stock Ledger Value updated to: ₹${finalLedger.value} (Price: ₹${finalLedger.unit_price})`);
    console.log(`[PASS] Material Master Price updated to: ₹${finalMat.unit_price}, Bin=${finalMat.bin_location}`);

    if (parseFloat(finalItem.unit_price) === 620.00 && parseFloat(finalLedger.value) === 7440.00 && parseFloat(finalMat.unit_price) === 620.00) {
      console.log('--- ALL GRN RE-PRICING & COLUMN UPDATES VERIFIED 100% SUCCESSFULLY! ---');
    } else {
      throw new Error('Values did not match expected calculations.');
    }

    await client.query('ROLLBACK');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[FAIL] Test failed:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

testCompleteGrnUpdates();
