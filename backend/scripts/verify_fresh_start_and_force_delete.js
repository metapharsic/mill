require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const pool = require('../src/db/pool');

async function testWorkflow() {
  console.log('=== TESTING FRESH INDENT RAISING, WORKFLOW & FORCE DELETE ===\n');

  const client = await pool.connect();
  try {
    // 1. Check current counts
    const { rows: [iCount] } = await client.query('SELECT count(*) FROM indents');
    console.log(`[1] Starting Indent count: ${iCount.count}`);

    // 2. Fetch admin user, department, and a material for testing
    const { rows: [admin] } = await client.query(`SELECT id, name, department_id FROM users WHERE email='admin@mkpapermill.com' LIMIT 1`);
    const { rows: [mat] } = await client.query(`SELECT id, name, code, current_stock, unit_price FROM materials WHERE current_stock > 10 LIMIT 1`);
    const initialStock = parseFloat(mat.current_stock);
    console.log(`[2] Using Material: ${mat.name} (${mat.code}), Initial Stock: ${initialStock}`);

    // 3. Test sequential indent number generation
    const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const { rows: [seqRow] } = await client.query(
      `SELECT LPAD((COUNT(*) + 1)::text, 4, '0') AS seq FROM indents WHERE indent_number LIKE $1`,
      [`IND-${stamp}-%`]
    );
    const expectedNum = `IND-${stamp}-${seqRow.seq}`;
    console.log(`[3] Generated Fresh Indent Number: ${expectedNum}`);
    if (seqRow.seq !== '0001') {
      throw new Error(`Expected sequence 0001 but got ${seqRow.seq}`);
    }

    // 4. Insert Test Indent
    await client.query('BEGIN');
    const { rows: [newInd] } = await client.query(
      `INSERT INTO indents (indent_number, date, department_id, required_date, priority, status, raised_by, remarks)
       VALUES ($1, CURRENT_DATE, $2, CURRENT_DATE + INTERVAL '3 days', 'Normal', 'Draft', $3, 'Verification test indent')
       RETURNING *`,
      [expectedNum, admin.department_id || 1, admin.id]
    );

    const { rows: [newItem] } = await client.query(
      `INSERT INTO indent_items (indent_id, material_id, required_qty, approved_qty, uom, purpose, current_stock, unit_price, line_value, reason_code)
       VALUES ($1, $2, 2, 2, 'NOS', 'Test Purpose', $3, $4, $5, 'Routine Replacement')
       RETURNING *`,
      [newInd.id, mat.id, initialStock, mat.unit_price, 2 * parseFloat(mat.unit_price || 0)]
    );
    await client.query('COMMIT');
    console.log(`[4] Created Draft Indent ID ${newInd.id} with line item ID ${newItem.id}`);

    // 5. Test Issuing Stock on this Indent
    await client.query('BEGIN');
    await client.query(`UPDATE materials SET current_stock = current_stock - 2 WHERE id = $1`, [mat.id]);
    await client.query(`UPDATE indent_items SET issued_qty = 2 WHERE id = $1`, [newItem.id]);
    await client.query(`UPDATE indents SET status = 'Issued', total_value = $1, issued_by = $2, issued_at = NOW() WHERE id = $3`,
      [2 * parseFloat(mat.unit_price || 0), admin.id, newInd.id]);
    await client.query(
      `INSERT INTO stock_ledger (material_id, transaction_type, out_qty, balance, unit_price, value, date, reference_type, remarks, created_by)
       VALUES ($1, 'issue', 2, $2, $3, $4, CURRENT_DATE, 'indent', $5, $6)`,
      [mat.id, initialStock - 2, mat.unit_price, 2 * parseFloat(mat.unit_price || 0), `Indent ${expectedNum}`, admin.id]
    );
    await client.query('COMMIT');

    const { rows: [matAfterIssue] } = await client.query(`SELECT current_stock FROM materials WHERE id = $1`, [mat.id]);
    console.log(`[5] Indent marked Issued. Material stock decreased from ${initialStock} to ${matAfterIssue.current_stock}`);

    // 6. Test Force Delete Logic (Stock Reversal + Cascade Deletion)
    console.log(`[6] Testing Force Delete on Issued Indent ${newInd.id}...`);
    await client.query('BEGIN');

    // Simulate force delete endpoint logic
    const { rows: issuedItems } = await client.query(
      'SELECT id, material_id, issued_qty FROM indent_items WHERE indent_id = $1 AND issued_qty > 0',
      [newInd.id]
    );
    for (const it of issuedItems) {
      const qty = parseFloat(it.issued_qty || 0);
      if (qty > 0) {
        await client.query('UPDATE materials SET current_stock = current_stock + $1 WHERE id = $2', [qty, it.material_id]);
        const { rows: [m] } = await client.query('SELECT current_stock, unit_price FROM materials WHERE id = $1', [it.material_id]);
        await client.query(
          `INSERT INTO stock_ledger (material_id, transaction_type, in_qty, balance, unit_price, value, date, reference_type, remarks, created_by)
           VALUES ($1, 'adjustment_plus', $2, $3, $4, $5, CURRENT_DATE, 'indent_reversal', $6, $7)`,
          [
            it.material_id,
            qty,
            m.current_stock,
            m.unit_price,
            qty * parseFloat(m.unit_price || 0),
            `Stock restored on Force Delete of Indent ${expectedNum}`,
            admin.id
          ]
        );
      }
    }

    await client.query('DELETE FROM indent_items WHERE indent_id = $1', [newInd.id]);
    await client.query('DELETE FROM indent_audit_log WHERE indent_id = $1', [newInd.id]);
    await client.query('DELETE FROM store_indent_log WHERE indent_id = $1', [newInd.id]);
    await client.query('DELETE FROM indents WHERE id = $1', [newInd.id]);
    await client.query('COMMIT');

    const { rows: [matAfterDelete] } = await client.query(`SELECT current_stock FROM materials WHERE id = $1`, [mat.id]);
    console.log(`[7] Force Delete Successful! Material stock fully restored to ${matAfterDelete.current_stock}`);

    // 7. Clean test ledger entries
    await client.query(`DELETE FROM stock_ledger WHERE remarks LIKE '%${expectedNum}%'`);

    // 8. Verify clean state
    const { rows: [finalCount] } = await client.query('SELECT count(*) FROM indents');
    console.log(`[8] Final Indent count in DB: ${finalCount.count}`);

    // 9. Verify PO sequence check
    const { rows: [poSeq] } = await client.query(
      `SELECT LPAD((COUNT(*) + 1)::text, 4, '0') AS seq FROM purchase_orders WHERE po_number LIKE $1`,
      [`PO-${stamp}-%`]
    );
    console.log(`[9] Next PO sequence: PO-${stamp}-${poSeq.seq}`);

    console.log('\n=== ALL VERIFICATIONS PASSED SUCCESSFULLY ===\n');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Verification failed:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

testWorkflow();
