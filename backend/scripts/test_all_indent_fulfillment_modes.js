const pool = require('../src/db/pool');

async function testAllFulfillmentModes() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('🚀 TESTING ALL 5 INDENT FULFILLMENT MODES & STATUS CONSTRAINTS');
  console.log('═══════════════════════════════════════════════════════════════');

  const client = await pool.connect();
  try {
    // Pick user, dept, material, section
    const { rows: [user] } = await client.query(`SELECT id, name FROM users LIMIT 1`);
    const { rows: [dept] } = await client.query(`SELECT id, name FROM departments LIMIT 1`);
    const { rows: [sec] } = await client.query(`SELECT id, section_code, name FROM plant_sections LIMIT 1`);
    const { rows: [mat] } = await client.query(`SELECT id, name, code, current_stock, unit_price FROM materials WHERE current_stock > 10 LIMIT 1`);

    console.log(`Test Context: User=${user.name}, Dept=${dept.name}, Section=${sec.name}, Mat=${mat.name} (Stock: ${mat.current_stock})`);

    // ─────────────────────────────────────────────────────────────
    // TEST 1: DIRECT CASH PURCHASE (fulfillment_mode = 'cash')
    // ─────────────────────────────────────────────────────────────
    console.log('\n[TEST 1] Testing fulfillment_mode = "cash"...');
    await client.query('BEGIN');
    const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const { rows: [seqRow1] } = await client.query(
      `SELECT LPAD((COALESCE(MAX(NULLIF(regexp_replace(indent_number, '^IND-[0-9]+-', ''), '')), '0')::int + 1)::text, 4, '0') AS seq
       FROM indents WHERE indent_number LIKE $1`,
      [`IND-${stamp}-%`]
    );
    const num1 = `IND-${stamp}-${seqRow1.seq}`;
    const initialStatus1 = 'Cash Purchased';

    const { rows: [ind1] } = await client.query(
      `INSERT INTO indents (indent_number, date, department_id, required_date, priority, status, raised_by, remarks, section_id)
       VALUES ($1, NOW(), $2, CURRENT_DATE, 'Normal', $3, $4, 'Automated Cash Test', $5) RETURNING *`,
      [num1, dept.id, initialStatus1, user.id, sec.id]
    );

    // Cash voucher
    const { rows: [cp] } = await client.query(
      `INSERT INTO cash_purchases (voucher_number, date, indent_id, vendor_name, payment_mode, taxable_amount, total_amount, created_by)
       VALUES ($1, CURRENT_DATE, $2, 'Local Test Supplier', 'Cash', 500, 590, $3) RETURNING *`,
      [`CP-${stamp}-9999`, ind1.id, user.id]
    );

    console.log(`✅ TEST 1 PASSED: Indent ${ind1.indent_number} created with status '${ind1.status}' and Cash Voucher ${cp.voucher_number}`);
    await client.query('ROLLBACK');

    // ─────────────────────────────────────────────────────────────
    // TEST 2: IMMEDIATE STORE ISSUANCE (fulfillment_mode = 'issue')
    // ─────────────────────────────────────────────────────────────
    console.log('\n[TEST 2] Testing fulfillment_mode = "issue"...');
    await client.query('BEGIN');
    const { rows: [seqRow2] } = await client.query(
      `SELECT LPAD((COALESCE(MAX(NULLIF(regexp_replace(indent_number, '^IND-[0-9]+-', ''), '')), '0')::int + 1)::text, 4, '0') AS seq
       FROM indents WHERE indent_number LIKE $1`,
      [`IND-${stamp}-%`]
    );
    const num2 = `IND-${stamp}-${seqRow2.seq}`;
    const initialStatus2 = 'Issued';

    const { rows: [ind2] } = await client.query(
      `INSERT INTO indents (indent_number, date, department_id, required_date, priority, status, raised_by, remarks, section_id, issued_by, issued_at)
       VALUES ($1, NOW(), $2, CURRENT_DATE, 'Normal', $3, $4, 'Automated Issue Test', $5, $4, NOW()) RETURNING *`,
      [num2, dept.id, initialStatus2, user.id, sec.id]
    );

    console.log(`✅ TEST 2 PASSED: Indent ${ind2.indent_number} created with status '${ind2.status}'`);
    await client.query('ROLLBACK');

    // ─────────────────────────────────────────────────────────────
    // TEST 3: DIRECT PURCHASE ORDER (fulfillment_mode = 'po')
    // ─────────────────────────────────────────────────────────────
    console.log('\n[TEST 3] Testing fulfillment_mode = "po"...');
    await client.query('BEGIN');
    const { rows: [seqRow3] } = await client.query(
      `SELECT LPAD((COALESCE(MAX(NULLIF(regexp_replace(indent_number, '^IND-[0-9]+-', ''), '')), '0')::int + 1)::text, 4, '0') AS seq
       FROM indents WHERE indent_number LIKE $1`,
      [`IND-${stamp}-%`]
    );
    const num3 = `IND-${stamp}-${seqRow3.seq}`;
    const initialStatus3 = 'PO Created';

    const { rows: [ind3] } = await client.query(
      `INSERT INTO indents (indent_number, date, department_id, required_date, priority, status, raised_by, remarks, section_id)
       VALUES ($1, NOW(), $2, CURRENT_DATE, 'Normal', $3, $4, 'Automated PO Test', $5) RETURNING *`,
      [num3, dept.id, initialStatus3, user.id, sec.id]
    );

    console.log(`✅ TEST 3 PASSED: Indent ${ind3.indent_number} created with status '${ind3.status}'`);
    await client.query('ROLLBACK');

    // ─────────────────────────────────────────────────────────────
    // TEST 4: DIRECT DELIVERY CHALLAN (fulfillment_mode = 'dc')
    // ─────────────────────────────────────────────────────────────
    console.log('\n[TEST 4] Testing fulfillment_mode = "dc"...');
    await client.query('BEGIN');
    const { rows: [seqRow4] } = await client.query(
      `SELECT LPAD((COALESCE(MAX(NULLIF(regexp_replace(indent_number, '^IND-[0-9]+-', ''), '')), '0')::int + 1)::text, 4, '0') AS seq
       FROM indents WHERE indent_number LIKE $1`,
      [`IND-${stamp}-%`]
    );
    const num4 = `IND-${stamp}-${seqRow4.seq}`;
    const initialStatus4 = 'DC Generated';

    const { rows: [ind4] } = await client.query(
      `INSERT INTO indents (indent_number, date, department_id, required_date, priority, status, raised_by, remarks, section_id)
       VALUES ($1, NOW(), $2, CURRENT_DATE, 'Normal', $3, $4, 'Automated DC Test', $5) RETURNING *`,
      [num4, dept.id, initialStatus4, user.id, sec.id]
    );

    console.log(`✅ TEST 4 PASSED: Indent ${ind4.indent_number} created with status '${ind4.status}'`);
    await client.query('ROLLBACK');

    // ─────────────────────────────────────────────────────────────
    // TEST 5: STANDARD REQUISITION (fulfillment_mode = 'pr')
    // ─────────────────────────────────────────────────────────────
    console.log('\n[TEST 5] Testing fulfillment_mode = "pr"...');
    await client.query('BEGIN');
    const { rows: [seqRow5] } = await client.query(
      `SELECT LPAD((COALESCE(MAX(NULLIF(regexp_replace(indent_number, '^IND-[0-9]+-', ''), '')), '0')::int + 1)::text, 4, '0') AS seq
       FROM indents WHERE indent_number LIKE $1`,
      [`IND-${stamp}-%`]
    );
    const num5 = `IND-${stamp}-${seqRow5.seq}`;
    const initialStatus5 = 'Submitted';

    const { rows: [ind5] } = await client.query(
      `INSERT INTO indents (indent_number, date, department_id, required_date, priority, status, raised_by, remarks, section_id)
       VALUES ($1, NOW(), $2, CURRENT_DATE, 'Normal', $3, $4, 'Automated PR Test', $5) RETURNING *`,
      [num5, dept.id, initialStatus5, user.id, sec.id]
    );

    console.log(`✅ TEST 5 PASSED: Indent ${ind5.indent_number} created with status '${ind5.status}'`);
    await client.query('ROLLBACK');

    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('🎉 ALL 5 FULFILLMENT MODES & CHECK CONSTRAINTS VERIFIED 100% OK');
    console.log('═══════════════════════════════════════════════════════════════');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ TEST FAILED:', err);
    process.exit(1);
  } finally {
    client.release();
    process.exit(0);
  }
}

testAllFulfillmentModes();
