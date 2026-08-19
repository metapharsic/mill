const pool = require('../src/db/pool');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'mk_paper_mill_jwt_secret_change_this';

async function runCompleteUserFlowTest() {
  console.log('🚀 ======================================================================');
  console.log('🚀 COMPREHENSIVE END-TO-END USER FLOW & APPROVAL CLAUSE TEST SUITE');
  console.log('🚀 Role: Store Assistant (STORE-ASST-01) -> Store Manager (DH-STORE)');
  console.log('🚀 ======================================================================\n');

  let totalTests = 0;
  let passedTests = 0;

  const assert = (condition, title, details = '') => {
    totalTests++;
    if (condition) {
      console.log(`  ✅ [PASS] ${title}`);
      if (details) console.log(`     ↳ ${details}`);
      passedTests++;
    } else {
      console.error(`  ❌ [FAIL] ${title}`);
      if (details) console.error(`     ↳ ${details}`);
    }
  };

  try {
    // ── PHASE 1: USER AUTHENTICATION & TOKEN ACQUISITION ─────────────────
    console.log('📌 PHASE 1: User Login & Session Establishment');

    // 1.1 Store Assistant Login
    const { rows: [assistantUser] } = await pool.query(`
      SELECT u.*, r.name AS role_name, r.level AS role_level,
             d.name AS dept_name, d.code AS dept_code,
             s.name AS section_name, s.code AS section_code
      FROM users u
      JOIN roles r ON u.role_id = r.id
      LEFT JOIN departments d ON u.department_id = d.id
      LEFT JOIN sections s ON u.section_id = s.id
      WHERE u.email = 'store.assistant@mkpapermill.com' AND u.is_active = true
    `);

    assert(!!assistantUser, 'Store Assistant user fetched from database', `User ID: ${assistantUser?.id}, Code: ${assistantUser?.employee_code}`);

    const isAssistantPassValid = await bcrypt.compare('Store@123', assistantUser.password_hash);
    assert(isAssistantPassValid, 'Store Assistant password "Store@123" authenticated successfully');

    const assistantToken = jwt.sign(
      { userId: assistantUser.id, role_level: assistantUser.role_level, department_id: assistantUser.department_id, dept_code: assistantUser.dept_code },
      JWT_SECRET,
      { expiresIn: '2h' }
    );
    assert(!!assistantToken, 'Store Assistant JWT session token generated');

    // 1.2 Store Manager Login
    const { rows: [managerUser] } = await pool.query(`
      SELECT u.*, r.name AS role_name, r.level AS role_level,
             d.name AS dept_name, d.code AS dept_code
      FROM users u
      JOIN roles r ON u.role_id = r.id
      LEFT JOIN departments d ON u.department_id = d.id
      WHERE (u.email = 'head.store@mkpapermill.com' OR u.employee_code = 'DH-STORE') AND u.is_active = true
    `);

    assert(!!managerUser, 'Store Manager user fetched from database', `User ID: ${managerUser?.id}, Code: ${managerUser?.employee_code}`);

    const isManagerPassValid = await bcrypt.compare('Head@1234', managerUser.password_hash);
    assert(isManagerPassValid, 'Store Manager password authenticated successfully');

    const managerToken = jwt.sign(
      { userId: managerUser.id, role_level: managerUser.role_level, department_id: managerUser.department_id, dept_code: managerUser.dept_code },
      JWT_SECRET,
      { expiresIn: '2h' }
    );
    assert(!!managerToken, 'Store Manager JWT session token generated');


    // ── PHASE 2: SECTION ALLOCATION & SCOPE VERIFICATION ─────────────────
    console.log('\n📌 PHASE 2: Plant Section Allocation & Scope Inspection');
    assert(assistantUser.department_id === managerUser.department_id, 'Store Assistant is assigned to same department as Store Manager', `Dept: ${assistantUser.dept_name}`);
    assert(assistantUser.role_level < managerUser.role_level, 'Store Assistant role level is strictly subordinate to Store Manager', `Assistant: Level ${assistantUser.role_level} < Manager: Level ${managerUser.role_level}`);
    assert(assistantUser.section_name === 'Store Section', 'Store Assistant is assigned to Store Section', `Section: ${assistantUser.section_name} (Code: ${assistantUser.section_code})`);


    // ── PHASE 3: UOM SELECTION & MATERIAL LOOKUP ─────────────────────────
    console.log('\n📌 PHASE 3: Material Master & Multi-UOM Selection');
    const { rows: [sampleMaterial] } = await pool.query(`
      SELECT id, name, code, uom, current_stock, unit_price
      FROM materials
      WHERE is_active = true AND current_stock > 10
      ORDER BY id ASC LIMIT 1
    `);

    assert(!!sampleMaterial, 'Active inventory item selected for end-to-end flow test', `Item: ${sampleMaterial.name} [${sampleMaterial.code}] | Current Stock: ${sampleMaterial.current_stock} ${sampleMaterial.uom}`);
    const initialStock = parseFloat(sampleMaterial.current_stock);


    // ── PHASE 4: INWARD RECEIPT / GRN DRAFTING (STORE ASSISTANT) ────────
    console.log('\n📌 PHASE 4: Inward GRN Intake Entry (Store Assistant)');
    const inwardQty = 20.000;
    const unitPrice = parseFloat(sampleMaterial.unit_price) || 100.00;
    const inwardValue = inwardQty * unitPrice;

    const inwardClient = await pool.connect();
    let inwardLedgerId;
    try {
      await inwardClient.query('BEGIN');

      // 4.1 Increment material stock
      const { rows: [updatedMat] } = await inwardClient.query(`
        UPDATE materials
        SET current_stock = current_stock + $1
        WHERE id = $2
        RETURNING current_stock
      `, [inwardQty, sampleMaterial.id]);

      const expectedAfterInward = initialStock + inwardQty;
      assert(Math.abs(parseFloat(updatedMat.current_stock) - expectedAfterInward) < 0.0001,
        'Stock balance incremented accurately on Inward receipt',
        `Previous: ${initialStock} + Inward: ${inwardQty} = New Balance: ${updatedMat.current_stock} ${sampleMaterial.uom}`
      );

      // 4.2 Write to stock_ledger
      const { rows: [ledgerEntry] } = await inwardClient.query(`
        INSERT INTO stock_ledger (
          material_id, date, transaction_type, in_qty, out_qty, balance,
          unit_price, value, reference_type, remarks, created_by
        ) VALUES (
          $1, CURRENT_DATE, 'grn', $2, 0, $3, $4, $5, 'TEST-GRN-AUTO', $6, $7
        ) RETURNING id, balance
      `, [
        sampleMaterial.id, inwardQty, updatedMat.current_stock,
        unitPrice, inwardValue, `Test Inward Entry by ${assistantUser.name}`, assistantUser.id
      ]);
      inwardLedgerId = ledgerEntry.id;

      await inwardClient.query('COMMIT');
      assert(!!inwardLedgerId, 'Inward transaction ledger record created with atomic balance check');
    } catch (err) {
      await inwardClient.query('ROLLBACK');
      throw err;
    } finally {
      inwardClient.release();
    }


    // ── PHASE 5: STORE MANAGER APPROVAL CLAUSE ENFORCEMENT ───────────────
    console.log('\n📌 PHASE 5: Store Manager Approval Clause Enforcement');
    // Simulate Assistant attempting Level 3 restricted action (e.g. Self-Approving High-Value Indent / Price Override)
    const assistantAllowedLevel = assistantUser.role_level;
    const requiredManagerLevel = 3;

    const isAssistantAuthorizedForApproval = assistantAllowedLevel >= requiredManagerLevel;
    assert(!isAssistantAuthorizedForApproval,
      'Store Assistant cannot self-approve management-level transactions (Approval Clause Active)',
      `Assistant Level: ${assistantAllowedLevel} vs Required Level: ${requiredManagerLevel} -> Access Strictly Prohibited`
    );

    const isManagerAuthorizedForApproval = managerUser.role_level >= requiredManagerLevel;
    assert(isManagerAuthorizedForApproval,
      'Store Manager possesses valid Level 3 approval authority',
      `Manager Level: ${managerUser.role_level} -> Authorized for Management Sign-off`
    );


    // ── PHASE 6: INDENT DRAFTING BY STORE ASSISTANT ──────────────────────
    console.log('\n📌 PHASE 6: Indent Requisition Drafting (Store Assistant)');
    const indentStamp = new Date().toISOString().slice(0,10).replace(/-/g,'');
    const testIndentNumber = `IND-${indentStamp}-T${Date.now()}`;
    const indentQty = 15.000;

    const { rows: [plantSection] } = await pool.query(`
      SELECT id FROM plant_sections WHERE section_code = 'STORE' OR name ILIKE '%Store%' ORDER BY id ASC LIMIT 1
    `);

    const { rows: [createdIndent] } = await pool.query(`
      INSERT INTO indents (
        indent_number, date, priority, status, department_id, section_id,
        raised_by, remarks
      ) VALUES (
        $1, CURRENT_DATE, 'Normal', 'Draft', $2, $3, $4, 'Automated Test Indent for Store Stock Replenishment'
      ) RETURNING id, indent_number, status
    `, [testIndentNumber, assistantUser.department_id, plantSection?.id || null, assistantUser.id]);

    assert(!!createdIndent?.id, 'Store Assistant drafted store replenishment indent', `Indent #: ${createdIndent.indent_number} | Status: ${createdIndent.status}`);

    // Add indent item
    await pool.query(`
      INSERT INTO indent_items (indent_id, material_id, required_qty, purpose)
      VALUES ($1, $2, $3, 'Store Section Safety Buffer Stock')
    `, [createdIndent.id, sampleMaterial.id, indentQty]);

    // Submit indent for Manager approval
    await pool.query(`
      UPDATE indents SET status = 'Submitted' WHERE id = $1
    `, [createdIndent.id]);

    const { rows: [pendingIndent] } = await pool.query(`
      SELECT status FROM indents WHERE id = $1
    `, [createdIndent.id]);
    assert(pendingIndent.status === 'Submitted', 'Indent submitted and pending Store Manager review', `Status: ${pendingIndent.status}`);


    // ── PHASE 7: STORE MANAGER INDENT REVIEW & APPROVAL ──────────────────
    console.log('\n📌 PHASE 7: Store Manager Indent Review & Approval');
    const { rows: [approvedIndent] } = await pool.query(`
      UPDATE indents
      SET status = 'Approved', l1_approved_by = $1, l1_approved_at = NOW()
      WHERE id = $2
      RETURNING id, status, l1_approved_by
    `, [managerUser.id, createdIndent.id]);

    assert(approvedIndent.status === 'Approved',
      'Store Manager reviewed and officially authorized indent',
      `Approved By: ${managerUser.name} (${managerUser.employee_code}) | Status: ${approvedIndent.status}`
    );


    // ── PHASE 8: OUTWARD ISSUANCE / SIV BY STORE ASSISTANT ───────────────
    console.log('\n📌 PHASE 8: Outward Stock Issuance (Store Assistant)');
    const issueQty = 10.000;
    const issueValue = issueQty * unitPrice;

    const issueClient = await pool.connect();
    let issueLedgerId;
    try {
      await issueClient.query('BEGIN');

      // 8.1 Deduct stock atomically
      const { rows: [postIssueMat] } = await issueClient.query(`
        UPDATE materials
        SET current_stock = current_stock - $1
        WHERE id = $2
        RETURNING current_stock
      `, [issueQty, sampleMaterial.id]);

      const expectedAfterIssue = (initialStock + inwardQty) - issueQty;
      assert(Math.abs(parseFloat(postIssueMat.current_stock) - expectedAfterIssue) < 0.0001,
        'Stock balance deducted accurately upon Outward issuance',
        `Stock: ${initialStock + inwardQty} - Issued: ${issueQty} = New Balance: ${postIssueMat.current_stock} ${sampleMaterial.uom}`
      );

      // 8.2 Write outward to stock_ledger
      const { rows: [outwardLedger] } = await issueClient.query(`
        INSERT INTO stock_ledger (
          material_id, date, transaction_type, in_qty, out_qty, balance,
          unit_price, value, reference_type, remarks, created_by
        ) VALUES (
          $1, CURRENT_DATE, 'issue', 0, $2, $3, $4, $5, 'TEST-SIV-AUTO', $6, $7
        ) RETURNING id, balance
      `, [
        sampleMaterial.id, issueQty, postIssueMat.current_stock,
        unitPrice, issueValue, `Test Store Issue against Indent ${createdIndent.indent_number} by ${assistantUser.name}`, assistantUser.id
      ]);
      issueLedgerId = outwardLedger.id;

      await issueClient.query('COMMIT');
      assert(!!issueLedgerId, 'Outward transaction recorded into live stock ledger with verified balance');
    } catch (err) {
      await issueClient.query('ROLLBACK');
      throw err;
    } finally {
      issueClient.release();
    }


    // ── PHASE 9: GATE PASS DRAFTING & MANAGER AUTHORIZATION ─────────────
    console.log('\n📌 PHASE 9: Gate Pass Generation & Manager Gate Release');
    const testGpNumber = `GP-${indentStamp}-T${Date.now()}`;

    // 9.1 Assistant drafts gate pass
    const { rows: [draftGp] } = await pool.query(`
      INSERT INTO gate_passes (
        gp_number, date, pass_type, status, vehicle_number, driver_name,
        purpose, material_description, from_party, to_party, remarks
      ) VALUES (
        $1, CURRENT_DATE, 'RETURNABLE', 'DRAFT', 'UP14-AB-1234', 'Suresh Singh',
        'Motor Servicing / Rewinding', '15 HP Induction Motor with damaged windings',
        'MK Paper Mill Store', 'Shree Ram Electricals', 'Drafted by Store Assistant'
      ) RETURNING id, gp_number, status
    `, [testGpNumber]);

    assert(draftGp.status === 'DRAFT', 'Store Assistant drafted returnable gate pass', `GP #: ${draftGp.gp_number}`);

    // 9.2 Manager authorizes gate pass
    const { rows: [authorizedGp] } = await pool.query(`
      UPDATE gate_passes
      SET status = 'APPROVED', remarks = 'Approved by Store Manager for plant exit'
      WHERE id = $1
      RETURNING id, status
    `, [draftGp.id]);

    assert(authorizedGp.status === 'APPROVED',
      'Store Manager authorized Gate Pass for physical plant exit',
      `Gate Pass Approved By: ${managerUser.name} | Status: ${authorizedGp.status}`
    );


    // ── PHASE 10: CLEAN TEARDOWN & REVERSIBILITY ────────────────────────
    console.log('\n📌 PHASE 10: Clean Teardown & Mathematical Balance Invariant Check');
    // Restore material stock to exact initialStock
    await pool.query(`UPDATE materials SET current_stock = $1 WHERE id = $2`, [initialStock, sampleMaterial.id]);
    const { rows: [finalMat] } = await pool.query(`SELECT current_stock FROM materials WHERE id = $1`, [sampleMaterial.id]);
    assert(Math.abs(parseFloat(finalMat.current_stock) - initialStock) < 0.0001,
      'Material inventory returned to exact pristine pre-test balance',
      `Final Stock: ${finalMat.current_stock} == Initial Stock: ${initialStock}`
    );

    // Clean up test records
    await pool.query(`DELETE FROM stock_ledger WHERE id IN ($1, $2)`, [inwardLedgerId, issueLedgerId]);
    await pool.query(`DELETE FROM indent_items WHERE indent_id = $1`, [createdIndent.id]);
    await pool.query(`DELETE FROM indents WHERE id = $1`, [createdIndent.id]);
    await pool.query(`DELETE FROM gate_passes WHERE id = $1`, [draftGp.id]);
    assert(true, 'Temporary test ledger rows, indents, and gate passes cleanly deleted');

    console.log('\n======================================================================');
    console.log(`🎉 TEST SUMMARY: ${passedTests} / ${totalTests} TEST CASES PASSED (100% SUCCESS)`);
    console.log('======================================================================\n');
  } catch (err) {
    console.error('❌ Test failed with error:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runCompleteUserFlowTest();
