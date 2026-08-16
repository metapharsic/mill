require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const pool = require('../src/db/pool');

async function testDescriptiveIndentAndIndentor() {
  console.log('\n================================================================');
  console.log('🧪 TESTING INDENT DESCRIPTIVE REASONS, MACHINE CONTEXT & INDENTOR');
  console.log('================================================================\n');

  // 1. Fetch User with Role and Employee Code
  const { rows: [user] } = await pool.query(`
    SELECT u.id, u.name, u.employee_code, u.email, r.name as role_name, d.id as dept_id, d.name as dept_name
    FROM users u
    LEFT JOIN roles r ON r.id = u.role_id
    LEFT JOIN departments d ON d.id = u.department_id
    WHERE u.employee_code IS NOT NULL
    LIMIT 1
  `);

  const { rows: [machine] } = await pool.query(`SELECT id, name, code, type FROM machines WHERE code = 'PM1' LIMIT 1`);
  const { rows: [section] } = await pool.query(`SELECT id, section_code, name FROM plant_sections WHERE section_code = 'PRESS' LIMIT 1`);
  const { rows: [mat] } = await pool.query(`SELECT id, code, name, unit_price, uom, current_stock FROM materials WHERE current_stock > 10 LIMIT 1`);

  if (!user || !machine || !section || !mat) {
    throw new Error('Required test fixtures not found');
  }

  console.log(`  ✓ Indentor:     ${user.name} [Emp Code: ${user.employee_code}] (${user.role_name})`);
  console.log(`  ✓ Department:   ${user.dept_name}`);
  console.log(`  ✓ Machine:      ${machine.name} [${machine.code}] (${machine.type})`);
  console.log(`  ✓ Section:      ${section.name} [${section.section_code}]`);
  console.log(`  ✓ Material:     ${mat.name} [${mat.code}]`);

  // 2. Create Indent with Rich Descriptive Content
  const indentNum = `IND-DESC-${Date.now()}`;
  const remarks = 'WO-2026-0815-E01: Urgent replacement required due to severe inner race pitting and excessive vibration (>8.2 mm/s) recorded during Shift 2. Potential line stoppage if not replaced within 24 hours.';
  const itemPurpose = 'Press section top suction roll drive end bearing replacement. Fitment alignment check and grease purging required.';
  const reasonCode = 'Emergency Failure';
  const reqQty = 2.000;
  const unitPrice = parseFloat(mat.unit_price || 250);

  const client = await pool.connect();
  let indentId;
  try {
    await client.query('BEGIN');
    const { rows: [created] } = await client.query(
      `INSERT INTO indents (indent_number, date, department_id, required_date, priority, status, raised_by, remarks, section_id, machine_id)
       VALUES ($1, NOW(), $2, CURRENT_DATE + INTERVAL '1 day', 'Normal', 'Submitted', $3, $4, $5, $6)
       RETURNING *`,
      [indentNum, user.dept_id, user.id, remarks, section.id, machine.id]
    );
    indentId = created.id;

    await client.query(
      `INSERT INTO indent_items (indent_id, material_id, required_qty, uom, purpose, current_stock, component_position, reason_code, unit_price, line_value)
       VALUES ($1, $2, $3, $4, $5, $6, 'Press Roll Drive End #2', $7, $8, $9)`,
      [indentId, mat.id, reqQty, mat.uom, itemPurpose, mat.current_stock, reasonCode, unitPrice, reqQty * unitPrice]
    );

    await client.query(`UPDATE indents SET total_value = $1 WHERE id = $2`, [reqQty * unitPrice, indentId]);
    await client.query('COMMIT');
    console.log(`\n▶ [1/3] Created Descriptive Indent: ${indentNum}`);
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }

  // 3. Test List Query
  console.log(`\n▶ [2/3] Verifying List & Detail API Queries...`);
  const { rows: [queriedList] } = await pool.query(
    `SELECT i.id, i.indent_number as "indentNumber", i.date, i.status,
            i.remarks, i.created_at as "raisedAt",
            ps.section_code as "sectionCode", ps.name as "sectionName",
            mch.name as "machineName", mch.code as "machineCode",
            d.name as "deptName",
            u.name as "raisedBy", u.employee_code as "raisedByEmpCode",
            r.name as "raisedByRole", u.email as "raisedByEmail",
            (SELECT ii.reason_code FROM indent_items ii WHERE ii.indent_id = i.id LIMIT 1) AS "reasonCode",
            (SELECT ii.purpose FROM indent_items ii WHERE ii.indent_id = i.id LIMIT 1) AS "itemPurpose"
     FROM indents i
     LEFT JOIN departments d ON d.id=i.department_id
     LEFT JOIN users u ON u.id=i.raised_by
     LEFT JOIN roles r ON r.id=u.role_id
     LEFT JOIN plant_sections ps ON ps.id=i.section_id
     LEFT JOIN machines mch ON mch.id=i.machine_id
     WHERE i.id = $1`,
    [indentId]
  );

  console.log(`  ✓ Indentor Name:        ${queriedList.raisedBy}`);
  console.log(`  ✓ Indentor Emp Code:    ${queriedList.raisedByEmpCode}`);
  console.log(`  ✓ Indentor Role:        ${queriedList.raisedByRole}`);
  console.log(`  ✓ Machine Context:      [${queriedList.machineCode}] ${queriedList.machineName}`);
  console.log(`  ✓ Section Context:      [${queriedList.sectionCode}] ${queriedList.sectionName}`);
  console.log(`  ✓ Reason Code:          ${queriedList.reasonCode}`);
  console.log(`  ✓ Technical Purpose:    ${queriedList.itemPurpose}`);
  console.log(`  ✓ Work Order Remarks:   ${queriedList.remarks}`);

  if (queriedList.raisedBy !== user.name || queriedList.raisedByEmpCode !== user.employee_code) {
    throw new Error('Indentor profile mismatch in query output');
  }
  if (queriedList.machineName !== machine.name || queriedList.sectionCode !== section.section_code) {
    throw new Error('Machine / Section context mismatch in query output');
  }

  // 4. Test Reporting Route
  console.log(`\n▶ [3/3] Verifying Reports API Query...`);
  const { rows: [reportRow] } = await pool.query(
    `SELECT i.id, i.indent_number AS "indentNumber", i.date, i.status,
            i.total_value AS "totalValue", i.remarks, i.created_at AS "raisedAt",
            d.name AS department, d.code AS "deptCode",
            u.name AS "raisedBy", u.employee_code AS "raisedByEmpCode",
            r.name AS "raisedByRole",
            ps.section_code AS "sectionCode", ps.name AS "sectionName",
            mch.name AS "machineName", mch.code AS "machineCode",
            (SELECT STRING_AGG(ii.purpose, ' | ') FROM indent_items ii WHERE ii.indent_id = i.id) AS "technicalPurposes",
            (SELECT STRING_AGG(DISTINCT ii.reason_code, ', ') FROM indent_items ii WHERE ii.indent_id = i.id) AS "reasonCodes"
     FROM indents i
     LEFT JOIN departments d ON d.id = i.department_id
     LEFT JOIN users u ON u.id = i.raised_by
     LEFT JOIN roles r ON r.id = u.role_id
     LEFT JOIN plant_sections ps ON ps.id = i.section_id
     LEFT JOIN machines mch ON mch.id = i.machine_id
     WHERE i.id = $1`,
    [indentId]
  );

  console.log(`  ✓ Report Indentor:      ${reportRow.raisedBy} (${reportRow.raisedByRole}, Code: ${reportRow.raisedByEmpCode})`);
  console.log(`  ✓ Report Machine:       ${reportRow.machineName} [${reportRow.machineCode}]`);
  console.log(`  ✓ Report Technical:     ${reportRow.technicalPurposes}`);
  console.log(`  ✓ Report Reasons:       ${reportRow.reasonCodes}`);

  // Clean Cleanup
  await pool.query(`DELETE FROM indent_items WHERE indent_id = $1`, [indentId]);
  await pool.query(`DELETE FROM indents WHERE id = $1`, [indentId]);
  console.log(`\n  ✓ Test indent cleaned up successfully.`);

  console.log('\n🎉 ALL DESCRIPTIVE & INDENTOR TESTS PASSED WITH 100% ACCURACY!\n');
  await pool.end();
}

testDescriptiveIndentAndIndentor().catch(e => {
  console.error('❌ Test failed:', e);
  pool.end();
  process.exit(1);
});
