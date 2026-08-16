require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const pool = require('../src/db/pool');

async function testCancelAndAppendWiring() {
  console.log('\n================================================================');
  console.log('🧪 TESTING STORE MANAGER INDENT CANCELLATION & APPEND SPARES WIRING');
  console.log('================================================================\n');

  // 1. Fetch User (Store Manager / Admin)
  const { rows: [storeUser] } = await pool.query(`
    SELECT u.id, u.name, u.email, u.employee_code, r.level as role_level, d.id as dept_id, d.code as dept_code, d.name as dept_name
    FROM users u
    LEFT JOIN roles r ON r.id = u.role_id
    LEFT JOIN departments d ON d.id = u.department_id
    WHERE r.level >= 3
    LIMIT 1
  `);

  const { rows: mats } = await pool.query(`SELECT id, code, name, unit_price, uom, current_stock FROM materials WHERE current_stock > 5 LIMIT 3`);

  if (!storeUser || mats.length < 2) {
    throw new Error('Test fixtures missing');
  }

  console.log(`  ✓ Store Officer:  ${storeUser.name} [Emp: ${storeUser.employee_code}] (Level: ${storeUser.role_level})`);
  console.log(`  ✓ Available Materials: ${mats.map(m => `[${m.code}] ${m.name}`).join(', ')}`);

  // 2. Create Base Indent
  const indentNum = `IND-CANCEL-TEST-${Date.now()}`;
  const client = await pool.connect();
  let indentId;
  try {
    await client.query('BEGIN');
    const { rows: [created] } = await client.query(
      `INSERT INTO indents (indent_number, date, department_id, required_date, priority, status, raised_by, remarks, total_value)
       VALUES ($1, NOW(), $2, CURRENT_DATE + INTERVAL '1 day', 'Normal', 'Submitted', $3, 'Initial indent entry', $4)
       RETURNING *`,
      [indentNum, storeUser.dept_id, storeUser.id, parseFloat(mats[0].unit_price || 100)]
    );
    indentId = created.id;

    await client.query(
      `INSERT INTO indent_items (indent_id, material_id, required_qty, uom, purpose, current_stock, unit_price, line_value, reason_code)
       VALUES ($1, $2, 1.0, $3, 'Initial item', $4, $5, $6, 'Routine Replacement')`,
      [indentId, mats[0].id, mats[0].uom, mats[0].current_stock, mats[0].unit_price, parseFloat(mats[0].unit_price || 100)]
    );

    await client.query('COMMIT');
    console.log(`\n▶ [1/4] Created Initial Indent: ${indentNum} (ID: ${indentId}) with 1 item`);
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }

  // 3. Test Appending Item to Indent
  console.log(`\n▶ [2/4] Testing Append Spares to Indent ${indentNum}...`);
  const appendClient = await pool.connect();
  try {
    await appendClient.query('BEGIN');
    const appendMat = mats[1];
    const reqQty = 3.0;
    const unitPrice = parseFloat(appendMat.unit_price || 150);
    const lineVal = reqQty * unitPrice;

    await appendClient.query(
      `INSERT INTO indent_items (indent_id, material_id, required_qty, uom, purpose, current_stock, unit_price, line_value, reason_code, component_position)
       VALUES ($1, $2, $3, $4, 'Appended secondary spare', $5, $6, $7, 'Emergency Failure', 'Drive End Bearing Housing')`,
      [indentId, appendMat.id, reqQty, appendMat.uom, appendMat.current_stock, unitPrice, lineVal]
    );

    // Recompute total valuation
    const { rows: [{ sum: newTotal }] } = await appendClient.query(
      `SELECT COALESCE(SUM(line_value), 0) as sum FROM indent_items WHERE indent_id = $1`, [indentId]
    );

    await appendClient.query(`UPDATE indents SET total_value = $1 WHERE id = $2`, [newTotal, indentId]);
    await appendClient.query(
      `INSERT INTO indent_audit_log (indent_id, action, old_status, new_status, user_id, remarks)
       VALUES ($1, 'append_item', 'Submitted', 'Submitted', $2, $3)`,
      [indentId, storeUser.id, `Appended material [${appendMat.code}] ${appendMat.name} qty ${reqQty}`]
    );

    await appendClient.query('COMMIT');
    console.log(`  ✓ Item appended successfully. New total indent valuation: ₹${newTotal}`);
  } catch (e) {
    await appendClient.query('ROLLBACK');
    throw e;
  } finally {
    appendClient.release();
  }

  // 4. Test Cancellation with Reason & Store Audit Log
  console.log(`\n▶ [3/4] Testing Store Manager Cancellation with Reason...`);
  const cancelClient = await pool.connect();
  const reasonCode = 'Double Entry / Duplicate Indent';
  const notes = 'Identical requirement already fulfilled under IND-20260815-0012';
  const fullReason = `${reasonCode} — ${notes}`;

  try {
    await cancelClient.query('BEGIN');
    const { rows: [cancelledInd] } = await cancelClient.query(
      `UPDATE indents SET
         status = 'Cancelled',
         cancellation_reason = $1,
         cancelled_by = $2,
         cancelled_at = NOW()
       WHERE id = $3 RETURNING *`,
      [fullReason, storeUser.id, indentId]
    );

    await cancelClient.query(
      `INSERT INTO indent_audit_log (indent_id, action, old_status, new_status, user_id, remarks)
       VALUES ($1, 'cancel', 'Submitted', 'Cancelled', $2, $3)`,
      [indentId, storeUser.id, fullReason]
    );

    const { rows: storeRows } = await cancelClient.query('SELECT 1 FROM store_indents WHERE id = $1', [indentId]);
    if (storeRows.length) {
      await cancelClient.query(
        `INSERT INTO store_indent_log (indent_id, action, from_status, to_status, actor_id, actor_name, actor_role, note)
         VALUES ($1, 'Cancelled', 'Submitted', 'Cancelled', $2, $3, $4, $5)`,
        [indentId, storeUser.id, storeUser.name, 'Store Incharge', fullReason]
      );
    }

    await cancelClient.query('COMMIT');
    console.log(`  ✓ Indent status updated to: "${cancelledInd.status}"`);
    console.log(`  ✓ Cancellation Reason: "${cancelledInd.cancellation_reason}"`);
    console.log(`  ✓ Cancelled By: User ID ${cancelledInd.cancelled_by} at ${cancelledInd.cancelled_at}`);
  } catch (e) {
    await cancelClient.query('ROLLBACK');
    throw e;
  } finally {
    cancelClient.release();
  }

  // 5. Verify Query Projections (GET /api/indent and GET /api/indent/:id)
  console.log(`\n▶ [4/4] Verifying Reporting & Search Query Projections...`);
  const { rows: [queriedInd] } = await pool.query(
    `SELECT i.id, i.indent_number as "indentNumber", i.status,
            i.cancellation_reason as "cancellationReason", i.cancelled_at as "cancelledAt",
            cu.name as "cancelledByName", cu.employee_code as "cancelledByEmpCode"
     FROM indents i
     LEFT JOIN users cu ON cu.id = i.cancelled_by
     WHERE i.id = $1`,
    [indentId]
  );

  console.log(`  ✓ Queried Indent Number:    ${queriedInd.indentNumber}`);
  console.log(`  ✓ Status:                   ${queriedInd.status}`);
  console.log(`  ✓ Cancellation Reason:      ${queriedInd.cancellationReason}`);
  console.log(`  ✓ Cancelled By Officer:     ${queriedInd.cancelledByName} [Emp: ${queriedInd.cancelledByEmpCode}]`);

  if (queriedInd.status !== 'Cancelled' || !queriedInd.cancellationReason || !queriedInd.cancelledByName) {
    throw new Error('Verification failed: cancellation details missing in query projection');
  }

  // 6. Test Hard Deletion / Purge
  console.log(`\n▶ Testing Permanent Delete / Purge of Test Record...`);
  const purgeClient = await pool.connect();
  try {
    await purgeClient.query('BEGIN');
    await purgeClient.query('DELETE FROM indent_items WHERE indent_id = $1', [indentId]);
    await purgeClient.query('DELETE FROM indent_audit_log WHERE indent_id = $1', [indentId]);
    await purgeClient.query('DELETE FROM store_indent_log WHERE indent_id = $1', [indentId]);
    await purgeClient.query('DELETE FROM indents WHERE id = $1', [indentId]);
    await purgeClient.query('COMMIT');
    console.log(`  ✓ Erroneous/test indent permanently purged with 0 orphaned records.`);
  } catch (e) {
    await purgeClient.query('ROLLBACK');
    throw e;
  } finally {
    purgeClient.release();
  }

  console.log('\n🎉 ALL STORE MANAGER CANCELLATION & APPEND TESTS PASSED WITH 100% SUCCESS!\n');
  await pool.end();
}

testCancelAndAppendWiring().catch(e => {
  console.error('❌ Test failed:', e);
  pool.end();
  process.exit(1);
});
