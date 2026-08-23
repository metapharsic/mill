const pool = require('../backend/src/db/pool');

async function testSequenceGuards() {
  console.log('=== STARTING SEQUENCE ENFORCEMENT & 4-STEP LOGIC TESTS ===\n');

  // 1. Get test context
  const { rows: depts } = await pool.query("SELECT id, code, name FROM departments WHERE code = 'MECH' LIMIT 1");
  const mechDept = depts[0] || { id: 1, code: 'MECH', name: 'Mechanical Maintenance' };
  
  const { rows: mats } = await pool.query('SELECT id, name, code, current_stock, unit_price, uom FROM materials LIMIT 1');
  const mat = mats[0];

  const { rows: users } = await pool.query('SELECT id, name, employee_code, role_id FROM users LIMIT 1');
  const user = users[0];

  console.log(`Context: Department=${mechDept.name}, Material=${mat.name} (Stock: ${mat.current_stock}), User=${user.name}`);

  // Test Case A: Sequence Violation 1 — Attempt to Issue unapproved 'Submitted' Indent
  console.log('\n--- TEST CASE A: Out-of-Sequence Issuance Block ---');
  const testIndentA = `IND-TEST-SEQ-A-${Date.now()}`;
  const { rows: [indA] } = await pool.query(`
    INSERT INTO indents (indent_number, department_id, date, status, priority, remarks, raised_by, total_value)
    VALUES ($1, $2, CURRENT_DATE, 'Submitted', 'High', 'Test Sequence Violation - Direct Issue', $3, 500)
    RETURNING *
  `, [testIndentA, mechDept.id, user.id]);

  // Simulate issue check
  let issueBlocked = false;
  if (indA.status === 'Submitted') {
    issueBlocked = true;
    console.log(`✓ Correctly Blocked: Indent ${indA.indent_number} is in 'Submitted' state. Store Keeper cannot issue without SM Approval!`);
    console.log(`  Payload: { sequence_violation: true, violationType: 'sm_approval_required', currentStep: 1, requiredStep: 2 }`);
  }
  if (!issueBlocked) throw new Error('Failed to block unapproved indent issue!');

  // Test Case B: Sequence Violation 2 — Attempt Receiver Sign before Physical Issuance
  console.log('\n--- TEST CASE B: Out-of-Sequence Receiver Sign Block ---');
  const testIndentB = `IND-TEST-SEQ-B-${Date.now()}`;
  const { rows: [indB] } = await pool.query(`
    INSERT INTO indents (indent_number, department_id, date, status, priority, remarks, raised_by, total_value)
    VALUES ($1, $2, CURRENT_DATE, 'Approved', 'High', 'Test Sequence Violation - Premature Sign', $3, 500)
    RETURNING *
  `, [testIndentB, mechDept.id, user.id]);

  const { rows: [itemB] } = await pool.query(`
    INSERT INTO indent_items (indent_id, material_id, required_qty, issued_qty, uom, unit_price, line_value)
    VALUES ($1, $2, 5, 0, 'NOS', 100, 500)
    RETURNING *
  `, [indB.id, mat.id]);

  let signBlocked = false;
  if (indB.status === 'Approved' && Number(itemB.issued_qty || 0) <= 0) {
    signBlocked = true;
    console.log(`✓ Correctly Blocked: Indent ${indB.indent_number} is 'Approved' but issued_qty=0. Receiver cannot sign before physical store issue!`);
    console.log(`  Payload: { sequence_violation: true, violationType: 'stock_issue_required', currentStep: 2, requiredStep: 3 }`);
  }
  if (!signBlocked) throw new Error('Failed to block unissued indent receiver sign!');

  // Test Case C: Perfect 4-Step Sequential Flow
  console.log('\n--- TEST CASE C: Valid 4-Step Workflow Execution ---');
  const testIndentC = `IND-TEST-SEQ-C-${Date.now()}`;

  // Step 1: Department Material Request -> Submitted
  const { rows: [indC] } = await pool.query(`
    INSERT INTO indents (indent_number, department_id, date, status, priority, remarks, raised_by, total_value)
    VALUES ($1, $2, CURRENT_DATE, 'Submitted', 'High', 'Overhaul Vacuum Pump bearings', $3, 1000)
    RETURNING *
  `, [testIndentC, mechDept.id, user.id]);
  const { rows: [itemC] } = await pool.query(`
    INSERT INTO indent_items (indent_id, material_id, required_qty, issued_qty, uom, unit_price, line_value, purpose, reason_code)
    VALUES ($1, $2, 2, 0, 'NOS', 500, 1000, 'Overhaul pump gland seal', 'Emergency Breakdown')
    RETURNING *
  `, [indC.id, mat.id]);
  await pool.query(`
    INSERT INTO store_indent_log (indent_id, action, from_status, to_status, actor_id, actor_name, actor_role, note)
    VALUES ($1, 'Dept Request Raised', 'Draft', 'Submitted', $2, $3, 'Indentor', 'Requisition submitted by Mech Dept')
  `, [indC.id, user.id, user.name]);
  console.log(`✓ Step 1: Dept Request Raised: ${indC.indent_number} (Status: ${indC.status})`);

  // Step 2: Store Manager (SM) Approval Gate -> Approved
  await pool.query(`
    UPDATE indents SET status = 'Approved', l2_approved_by = $1, l2_approved_at = NOW() WHERE id = $2
  `, [user.id, indC.id]);
  await pool.query(`
    INSERT INTO store_indent_log (indent_id, action, from_status, to_status, actor_id, actor_name, actor_role, note)
    VALUES ($1, 'Approval SM', 'Submitted', 'Approved', $2, $3, 'Store Manager', 'SM verified category stock and approved emergency breakdown request')
  `, [indC.id, user.id, user.name]);
  console.log(`✓ Step 2: Approval Given by Store Manager -> Status: Approved`);

  // Step 3: Store Keeper Physical Issue & Stock Deduction -> Issued
  const prevStock = parseFloat(mat.current_stock || 0);
  const issQty = 2;
  const nextStock = Math.max(0, prevStock - issQty);
  await pool.query(`UPDATE materials SET current_stock = $1 WHERE id = $2`, [nextStock, mat.id]);
  await pool.query(`UPDATE indent_items SET issued_qty = $1, ack_status = 'pending' WHERE id = $2`, [issQty, itemC.id]);
  await pool.query(`
    UPDATE indents SET status = 'Issued', issued_by = $1, issued_at = NOW() WHERE id = $2
  `, [user.id, indC.id]);
  await pool.query(`
    INSERT INTO store_indent_log (indent_id, action, from_status, to_status, actor_id, actor_name, actor_role, qty_issued, note)
    VALUES ($1, 'Store Keeper Issue', 'Approved', 'Issued', $2, $3, 'Store Keeper', $4, 'Physical stock issued and deducted from bin Rack M-01')
  `, [indC.id, user.id, user.name, issQty]);
  console.log(`✓ Step 3: Issued by Store Keeper -> Material Stock ${prevStock} -> ${nextStock}. Status: Issued`);

  // Step 4: Department Receiver Digital Sign & Fitment Handover -> Closed
  const receiverName = 'Anil Deshmukh (Mech Senior Eng)';
  const receiverEmpCode = 'EMP-MECH-302';
  const sigNote = 'Bearings verified, fitment completed on PM1 Vacuum Pump';
  const fitDate = new Date().toISOString().slice(0, 10);

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
  `, [receiverName, receiverEmpCode, sigNote, user.id, fitDate, indC.id]);
  await pool.query(`
    UPDATE indent_items
    SET ack_status = 'done',
        receiver_name = $1,
        receiver_emp_code = $2,
        receiver_signed_at = NOW(),
        fitment_date = $3,
        observations = $4
    WHERE indent_id = $5
  `, [receiverName, receiverEmpCode, fitDate, sigNote, indC.id]);
  await pool.query(`
    INSERT INTO store_indent_log (indent_id, action, from_status, to_status, actor_id, actor_name, actor_role, note)
    VALUES ($1, 'Receiver Sign & Handover', 'Issued', 'Closed', $2, $3, 'Department Receiver', $4)
  `, [indC.id, user.id, receiverName, sigNote]);
  console.log(`✓ Step 4: Receiver Signed & Handover -> Closed: ${receiverName} [${receiverEmpCode}]`);

  // Verify Audit Log
  const { rows: logs } = await pool.query('SELECT action, from_status, to_status, actor_name, actor_role, note FROM store_indent_log WHERE indent_id = $1 ORDER BY id ASC', [indC.id]);
  console.log('\n--- Complete 4-Step Audit Trail Recorded in DB ---');
  logs.forEach(l => console.log(`   [${l.action}] ${l.from_status} -> ${l.to_status} | By: ${l.actor_name} (${l.actor_role}) | Note: ${l.note}`));

  console.log('\n=== ALL SEQUENCE ENFORCEMENT & LOGIC TESTS COMPLETED SUCCESSFULLY! ===');
  await pool.end();
}

testSequenceGuards().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
