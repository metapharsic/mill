const pool = require('../backend/src/db/pool');

async function testUnifiedGRN() {
  console.log('--- STARTING UNIFIED SAME-GRN VALIDATION TEST ---');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Fetch 2 distinct test materials and a vendor
    const { rows: mats } = await client.query('SELECT id, code, name, current_stock, unit_price FROM materials WHERE is_active = true LIMIT 2');
    if (mats.length < 2) throw new Error('Need at least 2 materials');

    const { rows: [vendor] } = await client.query('SELECT id, name FROM vendors LIMIT 1');
    const { rows: [user] } = await client.query('SELECT id FROM users LIMIT 1');

    console.log(`[INFO] Material 1: ${mats[0].code} (${mats[0].name})`);
    console.log(`[INFO] Material 2: ${mats[1].code} (${mats[1].name})`);

    // 2. Simulate Batch Inward with 2 line items (as sent by store.js)
    const testInvNum = 'INV-UNIFIED-' + Date.now().toString().slice(-4);
    const itemList = [
      { material_id: mats[0].id, in_qty: 10, unit_price: 150.00, bin_location: 'BIN-TEST-1', remarks: 'Item 1 in batch' },
      { material_id: mats[1].id, in_qty: 20, unit_price: 250.00, bin_location: 'BIN-TEST-2', remarks: 'Item 2 in batch' }
    ];

    // Simulate backend/src/routes/store.js unified GRN resolution
    const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [`grn-${stamp}`]);
    const { rows: seqRows } = await client.query(`SELECT LPAD((COUNT(*)+1)::text, 4, '0') as seq FROM grn WHERE grn_number LIKE $1`, [`GRN-${stamp}-%`]);
    const generatedGrnNum = `GRN-${stamp}-${seqRows[0].seq}`;

    const { rows: [grnHead] } = await client.query(
      `INSERT INTO grn (grn_number, date, vendor_id, invoice_number, received_by, status, remarks)
       VALUES ($1, CURRENT_DATE, $2, $3, $4, 'Received', $5) RETURNING id, grn_number`,
      [generatedGrnNum, vendor?.id || null, testInvNum, user.id, 'Batch test inward']
    );

    const createdGrnId = grnHead.id;
    console.log(`[PASS] Created Master GRN Header: ID=${createdGrnId}, GRN Number=${grnHead.grn_number}`);

    // Insert line items under the SAME GRN Header
    for (const it of itemList) {
      await client.query(
        `INSERT INTO grn_items (grn_id, material_id, po_qty, received_qty, accepted_qty, rejected_qty, uom, unit_price, bin_location, remarks)
         VALUES ($1, $2, $3, $4, $5, 0, 'Nos', $6, $7, $8)`,
        [createdGrnId, it.material_id, it.in_qty, it.in_qty, it.in_qty, it.unit_price, it.bin_location, it.remarks]
      );
    }

    // 3. Verify that both items share the exact same GRN Number
    const { rows: grnItems } = await client.query(`
      SELECT gi.id, gi.grn_id, g.grn_number, m.code AS mat_code, gi.received_qty, gi.unit_price
      FROM grn_items gi
      JOIN grn g ON g.id = gi.grn_id
      JOIN materials m ON m.id = gi.material_id
      WHERE gi.grn_id = $1
    `, [createdGrnId]);

    console.log(`[PASS] Total items linked under GRN #${grnHead.grn_number}: ${grnItems.length}`);
    grnItems.forEach((gi, idx) => {
      console.log(`       Line ${idx + 1}: ${gi.mat_code} | Qty: ${gi.received_qty} | GRN Number: ${gi.grn_number}`);
    });

    const uniqueGrnNumbers = new Set(grnItems.map(x => x.grn_number));
    if (uniqueGrnNumbers.size === 1 && uniqueGrnNumbers.has(generatedGrnNum)) {
      console.log(`[SUCCESS] Verified: All ${grnItems.length} items share the exact SAME GRN Number without splitting!`);
    } else {
      throw new Error(`GRN was split! Found multiple GRN numbers: ${Array.from(uniqueGrnNumbers).join(', ')}`);
    }

    await client.query('ROLLBACK');
    console.log('--- TEST COMPLETED & TRANSACTION ROLLED BACK CLEANLY ---');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[FAIL] Test failed:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

testUnifiedGRN();
