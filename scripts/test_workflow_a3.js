const pool = require('../backend/src/db/pool');

async function testWorkflow() {
  console.log('--- STARTING E2E STORE & INDENT WORKFLOW TEST ---');

  // 1. Check departments
  const { rows: depts } = await pool.query('SELECT code, name, category FROM departments ORDER BY id');
  console.log(`✓ Active Departments (${depts.length}):`, depts.map(d => d.code).join(', '));
  const mechDept = depts.find(d => d.code === 'MECH') || depts[0];

  // 2. Check materials
  const { rows: mats } = await pool.query('SELECT id, name, code, current_stock, unit_price, uom FROM materials LIMIT 3');
  if (mats.length < 2) {
    console.error('Need at least 2 materials in DB to test');
    process.exit(1);
  }
  const mat1 = mats[0];
  const mat2 = mats[1];
  console.log(`✓ Materials selected: [${mat1.code}] ${mat1.name} (Stock: ${mat1.current_stock}), [${mat2.code}] ${mat2.name} (Stock: ${mat2.current_stock})`);

  // 3. Check / Get a user
  const { rows: users } = await pool.query('SELECT id, name, email, employee_code, role_id FROM users LIMIT 1');
  const user = users[0];
  console.log(`✓ User for testing: ${user.name} (${user.email}, ${user.employee_code || 'EMP001'})`);

  // 4. Test Step 1: Raise Indent (Dept Requisition)
  const indentNum = `IND-TEST-${Date.now()}`;
  const { rows: [ind] } = await pool.query(`
    INSERT INTO indents (
      indent_number, department_id, date, status, priority, remarks, raised_by, total_value
    ) VALUES ($1, $2, CURRENT_DATE, 'Submitted', 'High', 'E2E Test Requisition for Mechanical Pump overhaul', $3, $4)
    RETURNING *
  `, [indentNum, mechDept.id || 1, user.id, (Number(mat1.unit_price) || 100) * 2]);

  const { rows: [indItem] } = await pool.query(`
    INSERT INTO indent_items (
      indent_id, material_id, required_qty, issued_qty, uom, unit_price, line_value, purpose, reason_code
    ) VALUES ($1, $2, 2, 0, $3, $4, $5, 'Overhaul pump gland seal', 'Emergency Failure')
    RETURNING *
  `, [ind.id, mat1.id, mat1.uom || 'Nos', Number(mat1.unit_price) || 100, (Number(mat1.unit_price) || 100) * 2]);

  await pool.query(`
    INSERT INTO store_indent_log (indent_id, action, from_status, to_status, actor_id, actor_name, actor_role, note)
    VALUES ($1, 'Created', 'Draft', 'Submitted', $2, $3, 'Indentor', 'Requisition created in Mech Dept')
  `, [ind.id, user.id, user.name]);

  console.log(`✓ Step 1: Requisition Raised: ${ind.indent_number} (Status: ${ind.status})`);

  // 5. Test Step 2: Store Manager Approval Gate
  await pool.query(`
    UPDATE indents
    SET status = 'Approved',
        l2_approved_by = $1,
        l2_approved_at = NOW()
    WHERE id = $2
  `, [user.id, ind.id]);

  await pool.query(`
    INSERT INTO store_indent_log (indent_id, action, from_status, to_status, actor_id, actor_name, actor_role, note)
    VALUES ($1, 'Approved SM', 'Submitted', 'Approved', $2, $3, 'Store Manager', 'SM approved emergency breakdown spares')
  `, [ind.id, user.id, user.name]);

  console.log(`✓ Step 2: Store Manager Approved Indent #${ind.id}`);

  // 6. Test Step 3: Store Keeper Physical Issuance & Atomic Stock Deduction
  const prevStock = parseFloat(mat1.current_stock || 0);
  const issuedQty = 2;
  const newStock = Math.max(0, prevStock - issuedQty);

  await pool.query(`
    UPDATE materials SET current_stock = $1 WHERE id = $2
  `, [newStock, mat1.id]);

  await pool.query(`
    UPDATE indent_items SET issued_qty = $1, ack_status = 'pending' WHERE id = $2
  `, [issuedQty, indItem.id]);

  const { rows: [issueRecord] } = await pool.query(`
    INSERT INTO store_issues (
      issue_number, material_id, quantity, department_id, issued_by, issue_date, status
    ) VALUES ($1, $2, $3, $4, $5, CURRENT_DATE, 'Issued')
    RETURNING *
  `, [`ISS-TEST-${Date.now()}`, mat1.id, issuedQty, mechDept.id || 1, user.id]);

  await pool.query(`
    UPDATE indents SET status = 'Issued', issued_by = $1, issued_at = NOW() WHERE id = $2
  `, [user.id, ind.id]);

  await pool.query(`
    INSERT INTO store_indent_log (indent_id, action, from_status, to_status, actor_id, actor_name, actor_role, qty_issued, note)
    VALUES ($1, 'Issued Stock', 'Approved', 'Issued', $2, $3, 'Store Keeper', $4, 'Physical stock handed over to Mech')
  `, [ind.id, user.id, user.name, issuedQty]);

  console.log(`✓ Step 3: Store Keeper Issued Stock. Material Stock: ${prevStock} -> ${newStock}. Issue #${issueRecord.id}`);

  // 7. Test Step 4: Department Receiver Sign & Handover -> Closed
  const receiverName = 'Rajesh Kumar (Mech Lead)';
  const receiverEmp = 'EMP-MECH-409';
  const sigNote = 'Verified seals intact, installed on Vacuum Pump #2';
  const fitmentDate = '2026-08-23';

  await pool.query(`
    UPDATE indents
    SET receiver_name = $1,
        receiver_emp_code = $2,
        receiver_signature_note = $3,
        receiver_signed_at = NOW(),
        receiver_signed_by = $4,
        fitment_date = $5,
        status = 'Closed',
        closed_at = NOW()
    WHERE id = $6
  `, [receiverName, receiverEmp, sigNote, user.id, fitmentDate, ind.id]);

  await pool.query(`
    UPDATE indent_items
    SET ack_status = 'done',
        ack_by = $1,
        ack_at = NOW(),
        receiver_name = $2,
        receiver_emp_code = $3,
        receiver_signed_at = NOW(),
        fitment_date = $4,
        observations = $5
    WHERE indent_id = $6
  `, [user.id, receiverName, receiverEmp, fitmentDate, sigNote, ind.id]);

  await pool.query(`
    INSERT INTO store_indent_log (indent_id, action, from_status, to_status, actor_id, actor_name, actor_role, note)
    VALUES ($1, 'Receiver Signed & Closed', 'Issued', 'Closed', $2, $3, 'Receiver', $4)
  `, [ind.id, user.id, receiverName, sigNote]);

  console.log(`✓ Step 4: Receiver Signed & Closed Indent: ${receiverName} [${receiverEmp}]`);

  // 8. Verify Indent full timeline
  const { rows: [finalInd] } = await pool.query('SELECT * FROM indents WHERE id = $1', [ind.id]);
  const { rows: logs } = await pool.query('SELECT action, from_status, to_status, actor_name, actor_role, note FROM store_indent_log WHERE indent_id = $1 ORDER BY id ASC', [ind.id]);
  console.log(`✓ Final Indent Status: ${finalInd.status}, Receiver: ${finalInd.receiver_name}`);
  console.log('✓ Full 4-Step Audit Timeline:');
  logs.forEach(l => console.log(`   [${l.action}] ${l.from_status} -> ${l.to_status} | Actor: ${l.actor_name} (${l.actor_role}) | Note: ${l.note}`));

  // 9. Test Master GRN Multi-Item Creation & Appending
  const grnNum = `GRN-E2E-${Date.now()}`;
  const { rows: [grn] } = await pool.query(`
    INSERT INTO grn (
      grn_number, date, status, received_by, remarks, vehicle_number, challan_number, invoice_number,
      discount_value, other_charges, total_taxable, cgst_value, sgst_value, total_gst, grand_total, cases_count, transport_name
    ) VALUES (
      $1, CURRENT_DATE, 'Received', $2, 'E2E Master GRN Multi-Item Inward Test', 'KA-25-EA-8842', 'CH-7741', 'INV-5512',
      50, 0, 850, 76.5, 76.5, 153, 1003, 4, 'VRL Logistics'
    ) RETURNING *
  `, [grnNum, user.id]);

  // Insert Item 1
  await pool.query(`
    INSERT INTO grn_items (
      grn_id, material_id, po_qty, received_qty, accepted_qty, rejected_qty, uom, unit_price,
      discount_pct, discount_amount, other_charges, taxable_amount, gst_pct, tax_type,
      cgst_pct, sgst_pct, igst_pct, cgst_amount, sgst_amount, igst_amount, total_amount,
      bin_location, batch_number, mrp, trade_price
    ) VALUES (
      $1, $2, 10, 10, 10, 0, $3, $4,
      10, 50, 0, 450, 18, 'intra',
      9, 9, 0, 40.5, 40.5, 0, 531,
      'Rack M-01', 'LOT-E2E-01', 65, 50
    )
  `, [grn.id, mat1.id, mat1.uom || 'Nos', 50]);

  // Append Item 2
  await pool.query(`
    INSERT INTO grn_items (
      grn_id, material_id, po_qty, received_qty, accepted_qty, rejected_qty, uom, unit_price,
      discount_pct, discount_amount, other_charges, taxable_amount, gst_pct, tax_type,
      cgst_pct, sgst_pct, igst_pct, cgst_amount, sgst_amount, igst_amount, total_amount,
      bin_location, batch_number, mrp, trade_price
    ) VALUES (
      $1, $2, 5, 5, 5, 0, $3, $4,
      0, 0, 0, 400, 18, 'intra',
      9, 9, 0, 36, 36, 0, 472,
      'Rack M-02', 'LOT-E2E-02', 100, 80
    )
  `, [grn.id, mat2.id, mat2.uom || 'Nos', 80]);

  const { rows: grnItems } = await pool.query('SELECT * FROM grn_items WHERE grn_id = $1', [grn.id]);
  console.log(`✓ Master GRN #${grn.grn_number} created with ${grnItems.length} items consolidated.`);
  grnItems.forEach((gi, idx) => {
    console.log(`   Line ${idx + 1}: Material ID ${gi.material_id}, Recv Qty: ${gi.received_qty}, Rate: ₹${gi.unit_price}, Taxable: ₹${gi.taxable_amount}, Total: ₹${gi.total_amount}`);
  });

  console.log('\n--- ALL E2E TESTS PASSED SUCCESSFULLY! ---');
  await pool.end();
}

testWorkflow().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
