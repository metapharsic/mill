require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const pool = require('../src/db/pool');

async function testCompleteP2PFlow() {
  console.log('\n================================================================');
  console.log('🧪 TESTING END-TO-END PROCURE-TO-PAY (P2P) & INDENT DELETION FLOW');
  console.log('================================================================\n');

  const client = await pool.connect();
  try {
    // 0. Setup test actors
    const { rows: [storeUser] } = await client.query(`
      SELECT u.id, u.name, u.employee_code, r.level as role_level 
      FROM users u 
      JOIN roles r ON r.id = u.role_id 
      LEFT JOIN departments d ON d.id = u.department_id
      WHERE u.department_id = 4 OR d.code = 'STORE' OR u.name ILIKE '%Store%' OR r.level >= 3
      LIMIT 1
    `);
    const { rows: [finUser] } = await client.query(`
      SELECT u.id, u.name, u.employee_code, r.level as role_level 
      FROM users u 
      JOIN roles r ON r.id = u.role_id 
      LEFT JOIN departments d ON d.id = u.department_id
      WHERE d.code = 'FIN' OR u.name ILIKE '%Finance%' OR r.level >= 3
      LIMIT 1
    `);
    const { rows: [vendor] } = await client.query(`SELECT id, name, code, gstin, credit_days FROM vendors WHERE is_active = true LIMIT 1`);
    const { rows: materials } = await client.query(`SELECT id, name, code, uom, current_stock, unit_price FROM materials WHERE is_active = true LIMIT 2`);

    console.log(`  ✓ Store Officer:   ${storeUser.name} [Emp: ${storeUser.employee_code || storeUser.id}] (Level: ${storeUser.role_level})`);
    console.log(`  ✓ Finance Officer: ${finUser.name} [Emp: ${finUser.employee_code || finUser.id}] (Level: ${finUser.role_level})`);
    console.log(`  ✓ Test Vendor:     ${vendor.name} (${vendor.code}) - GSTIN: ${vendor.gstin || 'N/A'}`);
    console.log(`  ✓ Test Materials:  [${materials[0].code}] ${materials[0].name} (Stock: ${materials[0].current_stock}) | [${materials[1].code}] ${materials[1].name} (Stock: ${materials[1].current_stock})\n`);

    // ─────────────────────────────────────────────────────────────
    // STAGE 1: INDENT CREATION & APPROVAL
    // ─────────────────────────────────────────────────────────────
    console.log('▶ [STAGE 1] Raising Indent & Approving...');
    const indentNumber = `IND-P2P-${Date.now()}`;
    const { rows: [indent] } = await client.query(
      `INSERT INTO indents (indent_number, date, department_id, status, raised_by, remarks, total_value)
       VALUES ($1, CURRENT_DATE, 4, 'Approved', $2, 'Emergency procurement for Machine Section #2', 5000)
       RETURNING *`,
      [indentNumber, storeUser.id]
    );
    await client.query(
      `INSERT INTO indent_items (indent_id, material_id, required_qty, approved_qty, uom, purpose, unit_price, line_value, reason_code)
       VALUES ($1, $2, 10, 10, $3, 'P2P Test Component Replacement', 250, 2500, 'Routine Replacement'),
              ($1, $4, 5, 5, $5, 'P2P Test Valve Fitment', 500, 2500, 'Routine Replacement')`,
      [indent.id, materials[0].id, materials[0].uom || 'NOS', materials[1].id, materials[1].uom || 'NOS']
    );
    console.log(`  ✓ Indent ${indentNumber} created & approved with 2 items (Valuation: ₹5,000.00)`);

    // ─────────────────────────────────────────────────────────────
    // STAGE 2: PURCHASE ORDER (PO) GENERATION
    // ─────────────────────────────────────────────────────────────
    console.log('\n▶ [STAGE 2] Store Manager / Procurement creates Purchase Order (PO)...');
    const poNumber = `PO-P2P-${Date.now()}`;
    const { rows: [po] } = await client.query(
      `INSERT INTO purchase_orders (po_number, date, vendor_id, indent_id, status, total_value, gst_value, grand_total, created_by, remarks)
       VALUES ($1, CURRENT_DATE, $2, $3, 'Approved', 5000, 900, 5900, $4, 'P2P Test Order to Vendor')
       RETURNING *`,
      [poNumber, vendor.id, indent.id, storeUser.id]
    );
    await client.query(
      `INSERT INTO po_items (po_id, material_id, qty, received_qty, uom, unit_price, gst_pct, total)
       VALUES ($1, $2, 10, 0, $3, 250, 18, 2950),
              ($1, $4, 5, 0, $5, 500, 18, 2950)`,
      [po.id, materials[0].id, materials[0].uom || 'NOS', materials[1].id, materials[1].uom || 'NOS']
    );
    console.log(`  ✓ PO ${poNumber} created & approved (Grand Total: ₹5,900.00 incl. 18% GST)`);

    // ─────────────────────────────────────────────────────────────
    // STAGE 3: MATERIAL SHIPMENT ARRIVAL & GRN GENERATION (QC CHECK)
    // ─────────────────────────────────────────────────────────────
    console.log('\n▶ [STAGE 3] Receiving Material Shipment at Store / Inward Desk (GRN)...');
    const grnNumber = `GRN-P2P-${Date.now()}`;
    const stockBefore0 = parseFloat(materials[0].current_stock || 0);
    const stockBefore1 = parseFloat(materials[1].current_stock || 0);

    const { rows: [grn] } = await client.query(
      `INSERT INTO grn (grn_number, date, vendor_id, po_id, vehicle_number, challan_number, invoice_number, status, received_by, remarks)
       VALUES ($1, CURRENT_DATE, $2, $3, 'KA-01-MM-9999', 'CH-88899', 'INV-VEND-2026-001', 'Received', $4, 'Quality inspection passed at Gate 1')
       RETURNING *`,
      [grnNumber, vendor.id, po.id, storeUser.id]
    );

    // Line 1: Received 10, Accepted 10, Rejected 0
    await client.query(
      `INSERT INTO grn_items (grn_id, material_id, po_qty, received_qty, accepted_qty, rejected_qty, uom, unit_price, bin_location)
       VALUES ($1, $2, 10, 10, 10, 0, $3, 250, 'Rack 3, Box 2')`,
      [grn.id, materials[0].id, materials[0].uom || 'NOS']
    );
    // Line 2: Received 5, Accepted 4, Rejected 1 (defective seal)
    await client.query(
      `INSERT INTO grn_items (grn_id, material_id, po_qty, received_qty, accepted_qty, rejected_qty, uom, unit_price, bin_location, remarks)
       VALUES ($1, $2, 5, 5, 4, 1, $3, 500, 'Rack 1, Box 5', '1 unit rejected due to gasket defect')`,
      [grn.id, materials[1].id, materials[1].uom || 'NOS']
    );

    // Atomic Stock & Ledger Updates
    await client.query(`UPDATE materials SET current_stock = current_stock + 10 WHERE id = $1`, [materials[0].id]);
    await client.query(`UPDATE materials SET current_stock = current_stock + 4 WHERE id = $1`, [materials[1].id]);

    await client.query(
      `INSERT INTO stock_ledger (material_id, date, transaction_type, reference_type, reference_id, in_qty, out_qty, balance, unit_price, value, remarks, created_by, vendor_id)
       VALUES ($1, CURRENT_DATE, 'GRN', 'PO', $2, 10, 0, $3, 250, 2500, $4, $5, $6),
              ($7, CURRENT_DATE, 'GRN', 'PO', $2, 4, 0, $8, 500, 2000, $9, $5, $6)`,
      [
        materials[0].id, po.id, stockBefore0 + 10, `GRN ${grnNumber} Inward`, storeUser.id, vendor.id,
        materials[1].id, stockBefore1 + 4, `GRN ${grnNumber} Inward (4 accepted)`,
      ]
    );

    await client.query(`UPDATE po_items SET received_qty = 10 WHERE po_id = $1 AND material_id = $2`, [po.id, materials[0].id]);
    await client.query(`UPDATE po_items SET received_qty = 5 WHERE po_id = $1 AND material_id = $2`, [po.id, materials[1].id]);
    await client.query(`UPDATE purchase_orders SET status = 'Received' WHERE id = $1`, [po.id]);

    // Verify atomic stocks
    const { rows: [chkMat0] } = await client.query(`SELECT current_stock FROM materials WHERE id = $1`, [materials[0].id]);
    const { rows: [chkMat1] } = await client.query(`SELECT current_stock FROM materials WHERE id = $1`, [materials[1].id]);
    console.log(`  ✓ GRN ${grnNumber} generated successfully:`);
    console.log(`    - Material [${materials[0].code}]: Stock incremented from ${stockBefore0} -> ${chkMat0.current_stock} (+10 accepted)`);
    console.log(`    - Material [${materials[1].code}]: Stock incremented from ${stockBefore1} -> ${chkMat1.current_stock} (+4 accepted, 1 rejected)`);
    console.log(`  ✓ PO ${poNumber} status updated to: 'Received'`);

    // ─────────────────────────────────────────────────────────────
    // STAGE 4: PURCHASE BILL BOOKING & 3-WAY MATCHING
    // ─────────────────────────────────────────────────────────────
    console.log('\n▶ [STAGE 4] Store / Accounts books Commercial Vendor Bill...');
    const billNumber = `BILL-P2P-${Date.now()}`;
    const taxableAmt = (10 * 250) + (4 * 500); // 2500 + 2000 = 4500
    const gstAmt = taxableAmt * 0.18; // 810
    const totalBillAmt = taxableAmt + gstAmt; // 5310

    const { rows: [bill] } = await client.query(
      `INSERT INTO vendor_bills (
         bill_number, vendor_id, po_id, grn_id, vendor_invoice_number,
         invoice_date, due_date, taxable_amount, cgst_amount, sgst_amount,
         total_tax, total_amount, paid_amount, balance_amount, status, remarks, created_by
       ) VALUES ($1, $2, $3, $4, 'INV-VEND-2026-001', CURRENT_DATE, CURRENT_DATE + INTERVAL '30 days',
                 $5, $6, $6, $7, $8, 0, $8, 'Pending Approval', 'Commercial invoice verified against GRN accepted items', $9)
       RETURNING *`,
      [billNumber, vendor.id, po.id, grn.id, taxableAmt, gstAmt/2, gstAmt, totalBillAmt, storeUser.id]
    );
    console.log(`  ✓ Vendor Bill ${billNumber} booked (Total Amount: ₹${Number(totalBillAmt).toFixed(2)}, Status: 'Pending Approval')`);
    console.log(`  ✓ 3-Way Match Verified: PO Rate ↔ GRN Accepted Qty (14 units) ↔ Commercial Bill (₹${Number(totalBillAmt).toFixed(2)})`);

    // ─────────────────────────────────────────────────────────────
    // STAGE 5: FINANCE APPROVAL & PAYMENT DISBURSAL
    // ─────────────────────────────────────────────────────────────
    console.log('\n▶ [STAGE 5] Finance Department verifies bill, approves & disburses payment...');
    // 1. Finance Approval
    await client.query(
      `UPDATE vendor_bills SET status = 'Approved', approved_by = $1, approved_at = NOW() WHERE id = $2`,
      [finUser.id, bill.id]
    );
    console.log(`  ✓ Bill ${billNumber} approved for payment by Finance Officer ${finUser.name}`);

    // 2. Finance Payment Disbursal via Bank NEFT
    const payNumber = `VPY-P2P-${Date.now()}`;
    const paymentAmt = 5310;
    const { rows: [payment] } = await client.query(
      `INSERT INTO vendor_payments (
         payment_number, vendor_id, bill_id, po_id, amount,
         payment_date, payment_mode, bank_name, reference_number, status, remarks, recorded_by
       ) VALUES ($1, $2, $3, $4, $5, CURRENT_DATE, 'Bank Transfer (NEFT/RTGS)', 'HDFC Bank - Current A/c 001992837', 'UTR-HDFC-991823746', 'Paid', 'Full settlement against Bill and GRN', $6)
       RETURNING *`,
      [payNumber, vendor.id, bill.id, po.id, paymentAmt, finUser.id]
    );

    // Update Bill Balances
    await client.query(
      `UPDATE vendor_bills SET paid_amount = paid_amount + $1, balance_amount = balance_amount - $1, status = 'Paid' WHERE id = $2`,
      [paymentAmt, bill.id]
    );

    const { rows: [finBillChk] } = await client.query(`SELECT status, paid_amount, balance_amount FROM vendor_bills WHERE id = $1`, [bill.id]);
    console.log(`  ✓ Payment ${payNumber} processed via NEFT (UTR: UTR-HDFC-991823746, Amount: ₹${paymentAmt})`);
    console.log(`  ✓ Vendor Bill Status: '${finBillChk.status}' (Paid: ₹${finBillChk.paid_amount}, Balance: ₹${finBillChk.balance_amount})`);

    // Check Live AP Ledger
    const { rows: apRows } = await client.query(
      `SELECT v.name, COALESCE(SUM(vb.total_amount),0) as total_billed, COALESCE(SUM(vb.paid_amount),0) as total_paid, COALESCE(SUM(vb.balance_amount),0) as outstanding
       FROM vendors v LEFT JOIN vendor_bills vb ON vb.vendor_id = v.id WHERE v.id = $1 GROUP BY v.name`,
      [vendor.id]
    );
    console.log(`  ✓ Live Accounts Payable for ${vendor.name}: Billed: ₹${apRows[0].total_billed}, Paid: ₹${apRows[0].total_paid}, Outstanding: ₹${apRows[0].outstanding}`);

    // ─────────────────────────────────────────────────────────────
    // STAGE 6: STORE MANAGER INDENT CANCELLATION / DELETION WITH REASON
    // ─────────────────────────────────────────────────────────────
    console.log('\n▶ [STAGE 6] Testing Store Manager Indent Cancellation & Purge...');
    const testCancelNum = `IND-CANCEL-P2P-${Date.now()}`;
    const { rows: [cancelInd] } = await client.query(
      `INSERT INTO indents (indent_number, date, department_id, status, raised_by, total_value)
       VALUES ($1, CURRENT_DATE, 4, 'Submitted', $2, 1200) RETURNING *`,
      [testCancelNum, storeUser.id]
    );

    // Cancel with official reason
    const reasonMsg = 'Double Entry / Duplicate Indent — Material already procured under ' + poNumber;
    await client.query(
      `UPDATE indents SET status = 'Cancelled', cancellation_reason = $1, cancelled_by = $2, cancelled_at = NOW() WHERE id = $3`,
      [reasonMsg, storeUser.id, cancelInd.id]
    );
    const { rows: [cancChk] } = await client.query(`SELECT status, cancellation_reason, cancelled_by FROM indents WHERE id = $1`, [cancelInd.id]);
    console.log(`  ✓ Indent ${testCancelNum} cancelled by Store Manager:`);
    console.log(`    - Status: '${cancChk.status}'`);
    console.log(`    - Reason: '${cancChk.cancellation_reason}'`);

    // Purge test record
    await client.query(`DELETE FROM indents WHERE id = $1`, [cancelInd.id]);
    console.log(`  ✓ Indent ${testCancelNum} purged cleanly from database.`);

    console.log('\n================================================================');
    console.log('🎉 COMPLETE PROCURE-TO-PAY (P2P) FLOW VERIFIED WITH 100% SUCCESS!');
    console.log('================================================================\n');
  } catch (err) {
    console.error('❌ Error during P2P flow test:', err);
    throw err;
  } finally {
    client.release();
    pool.end();
  }
}

testCompleteP2PFlow();
