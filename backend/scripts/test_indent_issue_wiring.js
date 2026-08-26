const pool = require('../src/db/pool');

async function testIndentIssue() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('🧪 TESTING INDENT IMMEDIATE STORE ISSUANCE WIRING');
  console.log('═══════════════════════════════════════════════════════\n');

  const client = await pool.connect();
  try {
    // 1. Get sample user, department, section, machine, material
    const userRes = await client.query('SELECT id, name, department_id, role_id FROM users WHERE is_active = true LIMIT 1');
    const deptRes = await client.query('SELECT id, name FROM departments LIMIT 1');
    const secRes = await client.query('SELECT id, name, section_code FROM plant_sections LIMIT 1');
    const machRes = await client.query('SELECT id, name FROM machines LIMIT 1');
    const matRes = await client.query('SELECT id, name, code, current_stock, unit_price, uom FROM materials WHERE current_stock > 2 AND is_active = true LIMIT 2');

    console.log('Test Fixtures:');
    console.log('- User:', userRes.rows[0]);
    console.log('- Department:', deptRes.rows[0]);
    console.log('- Section:', secRes.rows[0]);
    console.log('- Machine:', machRes.rows[0]);
    console.log('- Materials:', matRes.rows);

    if (!matRes.rows.length) {
      console.log('No materials with stock > 2 found!');
      return;
    }

    const testPayload = {
      department_id: deptRes.rows[0]?.id,
      required_date: new Date().toISOString().slice(0, 10),
      priority: 'Normal',
      remarks: 'Test Immediate Issuance Wiring',
      section: String(secRes.rows[0]?.id),
      machine_id: String(machRes.rows[0]?.id),
      fulfillment_mode: 'issue',
      items: [
        {
          material_id: matRes.rows[0].id,
          required_qty: 1,
          uom: matRes.rows[0].uom,
          unit_price: 150,
          purpose: 'Testing immediate issue wiring',
          component_position: 'Drive Side #1',
          reason_code: 'Routine Replacement'
        }
      ]
    };

    console.log('\n2. Testing Execution of Issue Flow Logic in Transaction...');
    await client.query('BEGIN');

    // Simulate backend sequence generator
    const d = new Date();
    const stamp = `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;
    const seq = await client.query('SELECT COUNT(*)+1 AS n FROM indents WHERE date::date = CURRENT_DATE');
    const num = `IND-${stamp}-${String(seq.rows[0].n).padStart(4,'0')}`;

    let secId = null;
    if (testPayload.section) {
      const { rows: pRows } = await client.query('SELECT id FROM plant_sections WHERE id = $1', [parseInt(testPayload.section)]);
      if (pRows.length) secId = pRows[0].id;
    }
    const machId = testPayload.machine_id ? parseInt(testPayload.machine_id) : null;

    const { rows: indRows } = await client.query(
      `INSERT INTO indents (indent_number,date,department_id,required_date,priority,status,raised_by,remarks,section_id,machine_id)
       VALUES ($1,NOW(),$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [num, testPayload.department_id, testPayload.required_date, testPayload.priority, 'Issued', userRes.rows[0].id, testPayload.remarks, secId, machId]
    );
    const id = indRows[0].id;

    let totalVal = 0;
    const insertedItems = [];
    for (const it of testPayload.items) {
      const { rows: mat } = await client.query(`SELECT current_stock, unit_price, uom, is_serialized, expected_lifespan_days FROM materials WHERE id=$1`, [it.material_id]);
      const price = it.unit_price !== undefined && it.unit_price !== '' ? parseFloat(it.unit_price) : parseFloat(mat[0]?.unit_price || 0);
      const qty = parseFloat(it.required_qty || 0);
      const lVal = qty * price;
      totalVal += lVal;

      const itemUom = mat[0]?.uom || it.uom || 'NOS';
      const { rows: [iItem] } = await client.query(
        `INSERT INTO indent_items (indent_id,material_id,required_qty,uom,purpose,current_stock,component_position,reason_code,unit_price,line_value,maintenance_log_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
        [id, it.material_id, qty, itemUom, it.purpose||'', mat[0]?.current_stock||0, it.component_position||null, it.reason_code||'Routine Replacement', price, lVal, null]
      );
      insertedItems.push({ ...iItem, uom: itemUom, current_stock: mat[0]?.current_stock });
    }

    await client.query(`UPDATE indents SET total_value = $1 WHERE id = $2`, [totalVal, id]);

    // Issue fulfillment branch
    for (const it of insertedItems) {
      const qty = parseFloat(it.required_qty || 0);
      const { rows: [matLocked] } = await client.query(`SELECT current_stock FROM materials WHERE id = $1 FOR UPDATE`, [it.material_id]);
      const avail = parseFloat(matLocked?.current_stock || 0);
      if (avail < qty) {
        throw new Error(`Insufficient stock for material ID ${it.material_id} (Available: ${avail}, Requested: ${qty})`);
      }

      await client.query(`UPDATE materials SET current_stock = current_stock - $1 WHERE id = $2`, [qty, it.material_id]);

      const { rows: [matAfter] } = await client.query(`SELECT current_stock, unit_price FROM materials WHERE id = $1`, [it.material_id]);
      const price = parseFloat(it.unit_price || matAfter?.unit_price || 0);

      await client.query(
        `INSERT INTO stock_ledger (material_id, transaction_type, out_qty, balance, unit_price, value, date, reference_type, reference_id, remarks, created_by)
         VALUES ($1, 'issue', $2, $3, $4, $5, CURRENT_DATE, 'indent', $6, $7, $8)`,
        [it.material_id, qty, matAfter.current_stock, price, qty * price, id, `Immediate Issuance from Indent ${num}`, userRes.rows[0].id]
      );

      await client.query(
        `UPDATE indent_items SET issued_qty = $1, unit_price = $2, line_value = $3, ack_status = 'pending' WHERE id = $4`,
        [qty, price, qty * price, it.id]
      );
    }

    await client.query(
      `UPDATE indents SET status = 'Issued', issued_by = $1, issued_at = NOW() WHERE id = $2`,
      [userRes.rows[0].id, id]
    );

    await client.query(
      `INSERT INTO indent_audit_log (indent_id, action, old_status, new_status, user_id, remarks)
       VALUES ($1, 'issue', 'Submitted', 'Issued', $2, $3)`,
      [id, userRes.rows[0].id, `Immediate store issuance executed on indent creation`]
    );

    // Also check store_indent_log table insertion
    await client.query(
      `INSERT INTO store_indent_log (indent_id, action, from_status, to_status, actor_id, actor_name, actor_role, note)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [id, 'Issued', 'Draft', 'Issued', userRes.rows[0].id, userRes.rows[0].name, 'Tester', 'Immediate store issuance on creation']
    );

    console.log('✅ Flow succeeded without error!');
    await client.query('ROLLBACK'); // Roll back test changes cleanly
    console.log('✅ Cleanly rolled back test transaction.');

  } catch (err) {
    console.error('❌ Error executing issue flow:', err);
    await client.query('ROLLBACK');
  } finally {
    client.release();
    process.exit(0);
  }
}

testIndentIssue();
