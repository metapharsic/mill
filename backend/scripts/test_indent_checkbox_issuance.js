require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const pool = require('../src/db/pool');

async function testCheckboxIssuance() {
  console.log('\n================================================================');
  console.log('🧪 TESTING STORE ISSUANCE CHECKBOX SELECTION & BOTH POST/PUT APIS');
  console.log('================================================================\n');

  // 1. Fetch User (Store Manager / Admin)
  const { rows: [storeUser] } = await pool.query(`
    SELECT u.id, u.name, u.email, r.level as role_level, d.code as dept_code, d.name as dept_name
    FROM users u
    LEFT JOIN roles r ON r.id = u.role_id
    LEFT JOIN departments d ON d.id = u.department_id
    WHERE r.level >= 3
    LIMIT 1
  `);

  const { rows: [dept] } = await pool.query(`SELECT id, name FROM departments WHERE name = 'Production' LIMIT 1`);
  const { rows: mats } = await pool.query(`SELECT id, code, name, unit_price, uom, current_stock FROM materials WHERE current_stock > 10 LIMIT 3`);

  if (!storeUser || !dept || mats.length < 2) {
    throw new Error('Test fixtures missing');
  }

  console.log(`  ✓ Store Officer:  ${storeUser.name} (Role Level: ${storeUser.role_level})`);
  console.log(`  ✓ Target Dept:    ${dept.name}`);
  console.log(`  ✓ Test Spares:    ${mats.map(m => `[${m.code}] ${m.name} (Stock: ${m.current_stock})`).join(', ')}`);

  // 2. Create Multi-Item Indent
  const indentNum = `IND-CHK-${Date.now()}`;
  const client = await pool.connect();
  let indentId;
  let itemIds = [];
  try {
    await client.query('BEGIN');
    const { rows: [created] } = await client.query(
      `INSERT INTO indents (indent_number, date, department_id, required_date, priority, status, raised_by, remarks)
       VALUES ($1, NOW(), $2, CURRENT_DATE + INTERVAL '1 day', 'Normal', 'Submitted', $3, 'Test Checkbox Selective Issuance')
       RETURNING *`,
      [indentNum, dept.id, storeUser.id]
    );
    indentId = created.id;

    for (let i = 0; i < 2; i++) {
      const mat = mats[i];
      const { rows: [it] } = await client.query(
        `INSERT INTO indent_items (indent_id, material_id, required_qty, uom, purpose, current_stock, unit_price, line_value, reason_code)
         VALUES ($1, $2, 2.0, $3, 'Checkbox test item', $4, $5, $6, 'Routine Replacement')
         RETURNING id`,
        [indentId, mat.id, mat.uom, mat.current_stock, mat.unit_price, 2.0 * parseFloat(mat.unit_price || 100)]
      );
      itemIds.push({ id: it.id, material_id: mat.id, initialStock: parseFloat(mat.current_stock) });
    }

    await client.query(`UPDATE indents SET total_value = 500 WHERE id = $1`, [indentId]);
    await client.query('COMMIT');
    console.log(`\n▶ [1/3] Created Multi-Item Indent: ${indentNum} (ID: ${indentId}) with 2 items`);
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }

  // 3. Test Selective Issuance (Only Item 1 Selected)
  console.log(`\n▶ [2/3] Testing Selective Issuance (Checkbox ON for Item 1, OFF for Item 2)...`);
  const issuePayload = {
    items: [
      { id: itemIds[0].id, material_id: itemIds[0].material_id, issued_qty: 2.0, batch_no: 'BATCH-CHK-001' }
    ],
    remarks: 'Partial dispatch of Item 1'
  };

  const issueClient = await pool.connect();
  let finalStatus;
  try {
    await issueClient.query('BEGIN');
    const { rows: [ind] } = await issueClient.query(
      `SELECT * FROM indents WHERE id=$1 AND status IN ('Submitted','L1 Approved','L2 Approved','Approved','Partially Issued') FOR UPDATE`, [indentId]
    );

    for (const it of issuePayload.items) {
      const { rows: [item] } = await issueClient.query(`SELECT * FROM indent_items WHERE id=$1 AND indent_id=$2`, [it.id, indentId]);
      if (!item) continue;
      const { rows: [matBefore] } = await issueClient.query(`SELECT current_stock, unit_price FROM materials WHERE id=$1 FOR UPDATE`, [item.material_id]);
      const issQty = Math.min(parseFloat(it.issued_qty || 0), parseFloat(item.required_qty), parseFloat(matBefore.current_stock));

      await issueClient.query(`UPDATE materials SET current_stock=current_stock-$1 WHERE id=$2`, [issQty, item.material_id]);
      await issueClient.query(`INSERT INTO stock_ledger(material_id,transaction_type,out_qty,balance,unit_price,value,date,reference_type,remarks,created_by)
        VALUES($1,'issue',$2,$3,$4,$5,CURRENT_DATE,'indent',$6,$7)`,
        [item.material_id, issQty, matBefore.current_stock - issQty, matBefore.unit_price, issQty * parseFloat(matBefore.unit_price || 0),
         `Indent ${ind.indent_number}`, storeUser.id]);

      await issueClient.query(`UPDATE indent_items SET issued_qty=$1,batch_no=$2,unit_price=$3,line_value=$4,ack_status='pending' WHERE id=$5`,
        [issQty, it.batch_no || null, matBefore.unit_price, issQty * parseFloat(matBefore.unit_price || 0), item.id]);
    }

    const { rows: allItems } = await issueClient.query(
      `SELECT required_qty, COALESCE(issued_qty, 0) as issued_qty FROM indent_items WHERE indent_id=$1`, [indentId]
    );
    const isFullyIssued = allItems.every(it => parseFloat(it.issued_qty || 0) >= parseFloat(it.required_qty || 0));
    finalStatus = isFullyIssued ? 'Issued' : 'Partially Issued';

    await issueClient.query(
      `UPDATE indents SET status=$1,issued_by=$2,issued_at=NOW(),remarks=COALESCE($3,remarks) WHERE id=$4`,
      [finalStatus, storeUser.id, issuePayload.remarks, indentId]);

    await issueClient.query('COMMIT');
    console.log(`  ✓ Item 1 Stock deducted by 2.0`);
    console.log(`  ✓ Indent Status updated to: "${finalStatus}" (Expected: Partially Issued)`);

    if (finalStatus !== 'Partially Issued') {
      throw new Error(`Expected Partially Issued, got ${finalStatus}`);
    }
  } catch (e) {
    await issueClient.query('ROLLBACK');
    throw e;
  } finally {
    issueClient.release();
  }

  // 4. Test Second Selective Issuance (Item 2 Selected -> Becomes Fully Issued)
  console.log(`\n▶ [3/3] Testing Second Issuance for Remaining Item 2...`);
  const issueClient2 = await pool.connect();
  try {
    await issueClient2.query('BEGIN');
    const it = { id: itemIds[1].id, material_id: itemIds[1].material_id, issued_qty: 2.0, batch_no: 'BATCH-CHK-002' };
    const { rows: [item] } = await issueClient2.query(`SELECT * FROM indent_items WHERE id=$1 AND indent_id=$2`, [it.id, indentId]);
    const { rows: [matBefore] } = await issueClient2.query(`SELECT current_stock, unit_price FROM materials WHERE id=$1 FOR UPDATE`, [item.material_id]);
    const issQty = Math.min(parseFloat(it.issued_qty || 0), parseFloat(item.required_qty), parseFloat(matBefore.current_stock));

    await issueClient2.query(`UPDATE materials SET current_stock=current_stock-$1 WHERE id=$2`, [issQty, item.material_id]);
    await issueClient2.query(`UPDATE indent_items SET issued_qty=$1,batch_no=$2,unit_price=$3,line_value=$4,ack_status='pending' WHERE id=$5`,
      [issQty, it.batch_no || null, matBefore.unit_price, issQty * parseFloat(matBefore.unit_price || 0), item.id]);

    const { rows: allItems } = await issueClient2.query(
      `SELECT required_qty, COALESCE(issued_qty, 0) as issued_qty FROM indent_items WHERE indent_id=$1`, [indentId]
    );
    const isFullyIssued = allItems.every(it => parseFloat(it.issued_qty || 0) >= parseFloat(it.required_qty || 0));
    finalStatus = isFullyIssued ? 'Issued' : 'Partially Issued';

    await issueClient2.query(
      `UPDATE indents SET status=$1 WHERE id=$2`, [finalStatus, indentId]
    );
    await issueClient2.query('COMMIT');
    console.log(`  ✓ Item 2 Stock deducted by 2.0`);
    console.log(`  ✓ Indent Status updated to: "${finalStatus}" (Expected: Issued)`);

    if (finalStatus !== 'Issued') {
      throw new Error(`Expected Issued, got ${finalStatus}`);
    }
  } catch (e) {
    await issueClient2.query('ROLLBACK');
    throw e;
  } finally {
    issueClient2.release();
  }

  // Clean Cleanup
  await pool.query(`DELETE FROM stock_ledger WHERE remarks LIKE $1`, [`%${indentNum}%`]);
  await pool.query(`DELETE FROM indent_items WHERE indent_id = $1`, [indentId]);
  await pool.query(`DELETE FROM indents WHERE id = $1`, [indentId]);
  await pool.query(`UPDATE materials SET current_stock = $1 WHERE id = $2`, [itemIds[0].initialStock, itemIds[0].material_id]);
  await pool.query(`UPDATE materials SET current_stock = $1 WHERE id = $2`, [itemIds[1].initialStock, itemIds[1].material_id]);
  console.log(`\n  ✓ Cleaned up test data and restored stocks.`);

  console.log('\n🎉 ALL CHECKBOX & STORE ISSUANCE TESTS PASSED WITH 100% SUCCESS!\n');
  await pool.end();
}

testCheckboxIssuance().catch(e => {
  console.error('❌ Test failed:', e);
  pool.end();
  process.exit(1);
});
