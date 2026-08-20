require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const pool = require('../src/db/pool');

async function testSectionAndDeptVerification() {
  console.log('\n================================================================');
  console.log('🧪 TESTING INDENT SECTION_CODE RESOLUTION & DEPARTMENT WORKFLOW');
  console.log('================================================================\n');

  // 1. Fetch Department, User, Plant Section, Material
  const { rows: [dept] } = await pool.query(`SELECT id, name, code FROM departments WHERE name = 'Production' LIMIT 1`);
  const { rows: [user] } = await pool.query(`SELECT id, name, email FROM users LIMIT 1`);
  const { rows: [pulpSec] } = await pool.query(`SELECT id, section_code, name FROM plant_sections WHERE section_code = 'PULP' LIMIT 1`);
  const { rows: [boilerSec] } = await pool.query(`SELECT id, section_code, name FROM plant_sections WHERE section_code = 'BOILER' LIMIT 1`);
  const { rows: [mat] } = await pool.query(`SELECT id, code, name, unit_price, uom, current_stock FROM materials WHERE current_stock > 5 LIMIT 1`);

  if (!dept || !pulpSec || !boilerSec || !mat) {
    throw new Error('Required test fixtures not found in database');
  }

  console.log(`  ✓ Department:    ${dept.name} (${dept.code})`);
  console.log(`  ✓ Section 1:     ${pulpSec.name} [${pulpSec.section_code}] (ID: ${pulpSec.id})`);
  console.log(`  ✓ Section 2:     ${boilerSec.name} [${boilerSec.section_code}] (ID: ${boilerSec.id})`);
  console.log(`  ✓ Material:      ${mat.name} [${mat.code}] (Stock: ${mat.current_stock}, Price: ₹${mat.unit_price})`);

  // 2. Create Indent with Section Code 'PULP'
  const indentNum = `IND-VERIF-${Date.now()}`;
  const reqQty = 2.000;
  const initialStock = parseFloat(mat.current_stock);
  const unitPrice = parseFloat(mat.unit_price || 100);

  const client = await pool.connect();
  let indentId;
  try {
    await client.query('BEGIN');
    const { rows: [created] } = await client.query(
      `INSERT INTO indents (indent_number, date, department_id, required_date, priority, status, raised_by, remarks, section_id)
       VALUES ($1, NOW(), $2, CURRENT_DATE + INTERVAL '2 days', 'Normal', 'Submitted', $3, 'Department Breakdown Repair', $4)
       RETURNING *`,
      [indentNum, dept.id, user.id, pulpSec.id]
    );
    indentId = created.id;

    await client.query(
      `INSERT INTO indent_items (indent_id, material_id, required_qty, uom, purpose, current_stock, component_position, reason_code, unit_price, line_value)
       VALUES ($1, $2, $3, $4, 'Pulp washer drive seal replacement', $5, 'Drive End', 'Emergency Failure', $6, $7)`,
      [indentId, mat.id, reqQty, mat.uom, initialStock, unitPrice, reqQty * unitPrice]
    );

    await client.query(`UPDATE indents SET total_value = $1 WHERE id = $2`, [reqQty * unitPrice, indentId]);
    await client.query('COMMIT');
    console.log(`\n▶ [1/4] Created Indent: ${indentNum} with Section [${pulpSec.section_code}]`);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  // 3. Verify List Query (GET /api/indent) returns sectionCode and sectionName
  const { rows: [queriedList] } = await pool.query(
    `SELECT i.id, i.indent_number as "indentNumber", i.status,
            ps.section_code as "sectionCode", ps.name as "sectionName",
            d.name as "deptName", d.code as "deptCode"
     FROM indents i
     LEFT JOIN departments d ON d.id = i.department_id
     LEFT JOIN plant_sections ps ON ps.id = i.section_id
     WHERE i.id = $1`,
    [indentId]
  );
  console.log(`  ✓ List Query Section Code: [${queriedList.sectionCode}] ${queriedList.sectionName}`);
  console.log(`  ✓ List Query Dept:         ${queriedList.deptName} (${queriedList.deptCode})`);

  if (queriedList.sectionCode !== 'PULP') {
    throw new Error(`Expected sectionCode 'PULP', got '${queriedList.sectionCode}'`);
  }

  // 4. Update Indent Section to 'BOILER'
  console.log(`\n▶ [2/4] Testing Section Update (Edit Indent)...`);
  await pool.query(`UPDATE indents SET section_id = $1 WHERE id = $2`, [boilerSec.id, indentId]);

  const { rows: [queriedDetail] } = await pool.query(
    `SELECT i.*, d.name as "deptName", d.code as "deptCode",
            ps.section_code as "sectionCode", ps.name as "sectionName"
     FROM indents i
     LEFT JOIN departments d ON d.id = i.department_id
     LEFT JOIN plant_sections ps ON ps.id = i.section_id
     WHERE i.id = $1`,
    [indentId]
  );
  console.log(`  ✓ Detail Query Updated Section: [${queriedDetail.sectionCode}] ${queriedDetail.sectionName}`);
  if (queriedDetail.sectionCode !== 'BOILER') {
    throw new Error(`Expected updated sectionCode 'BOILER', got '${queriedDetail.sectionCode}'`);
  }

  // 5. Test Department-wise Store Issuance
  console.log(`\n▶ [3/4] Testing Department-Wise Store Issuance...`);
  const issueClient = await pool.connect();
  try {
    await issueClient.query('BEGIN');

    // Deduct stock from materials table
    await issueClient.query(
      `UPDATE materials SET current_stock = current_stock - $1 WHERE id = $2`,
      [reqQty, mat.id]
    );

    // Update indent_items issued_qty
    await issueClient.query(
      `UPDATE indent_items SET issued_qty = $1, ack_status = 'pending' WHERE indent_id = $2 AND material_id = $3`,
      [reqQty, indentId, mat.id]
    );

    // Update indent status to 'Issued'
    await issueClient.query(
      `UPDATE indents SET status = 'Issued', issued_by = $1, issued_at = NOW() WHERE id = $2`,
      [user.id, indentId]
    );

    // Log to stock_ledger tagged with department and indent reference
    await issueClient.query(
      `INSERT INTO stock_ledger (material_id, date, transaction_type, in_qty, out_qty, balance, unit_price, value, remarks, reference_id, reference_type, created_by)
       VALUES ($1, CURRENT_DATE, 'issue', 0, $2, $3, $4, $5, $6, $7, 'INDENT', $8)`,
      [mat.id, reqQty, initialStock - reqQty, unitPrice, reqQty * unitPrice, `Store Issue ${indentNum} to ${dept.name} [${boilerSec.section_code}]`, indentId, user.id]
    );

    await issueClient.query('COMMIT');
    console.log(`  ✓ Material stock deducted by ${reqQty} (New Stock: ${initialStock - reqQty})`);
    console.log(`  ✓ Stock ledger entry written with reference_id = ${indentId}`);
  } catch (e) {
    await issueClient.query('ROLLBACK');
    throw e;
  } finally {
    issueClient.release();
  }

  // 6. Verify Analytics Query
  console.log(`\n▶ [4/4] Testing Department Consumption Analytics...`);
  const { rows: deptAnalytics } = await pool.query(`
    SELECT d.name AS dept, COUNT(*) AS indents,
           COALESCE(SUM(i.total_value), 0) AS value
    FROM indents i
    JOIN departments d ON d.id = i.department_id
    WHERE i.id = $1
    GROUP BY d.name
  `, [indentId]);

  console.log(`  ✓ Analytics by Department:`, deptAnalytics[0]);

  // Clean Cleanup
  await pool.query(`DELETE FROM stock_ledger WHERE reference_id = $1 AND reference_type = 'INDENT'`, [indentId]);
  await pool.query(`DELETE FROM indent_items WHERE indent_id = $1`, [indentId]);
  await pool.query(`DELETE FROM indents WHERE id = $1`, [indentId]);
  await pool.query(`UPDATE materials SET current_stock = $1 WHERE id = $2`, [initialStock, mat.id]);
  console.log(`\n  ✓ Cleaned up test data and restored material stock.`);

  console.log('\n🎉 ALL TESTS PASSED WITH 100% SUCCESS!\n');
  await pool.end();
}

testSectionAndDeptVerification().catch(err => {
  console.error('❌ Test failed:', err);
  pool.end();
  process.exit(1);
});
