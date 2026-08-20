require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const pool = require('../src/db/pool');

async function testMaterialEntry() {
  console.log('🧪 Testing Material Entry and Stock Ledger Invariants...\n');

  // 1. Get or create a category
  const { rows: [cat] } = await pool.query(`SELECT id FROM material_categories WHERE code = 'MECH-VLV' OR code = 'QC' LIMIT 1`);
  const catId = cat.id;

  const testCode = 'MV-TEST-001';
  // Clean up if previous test run
  await pool.query('DELETE FROM stock_ledger WHERE material_id IN (SELECT id FROM materials WHERE code = $1)', [testCode]);
  await pool.query('DELETE FROM materials WHERE code = $1', [testCode]);

  // 2. Simulate POST /api/master/materials
  const opQty = 12.001;
  const inQty = 5.000;
  const outQty = 0.000;
  const stockVal = 17.001;
  const price = 100.00;

  const client = await pool.connect();
  let matId;
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `INSERT INTO materials (code, name, category_id, uom, hsn_code, bin_location, current_stock, unit_price, criticality_class, is_active)
       VALUES ($1, $2, $3, 'NOS', $4, $5, $6, $7, $8, true)
       RETURNING id, code, name, current_stock, unit_price, hsn_code, bin_location`,
      [testCode, '0.5" PISTON VALVES TEST', catId, '4802', 'Rack 2, Box 4', stockVal, price, 'A']
    );
    matId = rows[0].id;

    // Opening record
    await client.query(
      `INSERT INTO stock_ledger (material_id, date, transaction_type, in_qty, out_qty, balance, unit_price, value, remarks)
       VALUES ($1, CURRENT_DATE, 'opening', $2, 0, $2, $3, $4, 'Opening Stock / Master Entry')`,
      [matId, opQty, price, opQty * price]
    );

    // Initial received record
    if (inQty > 0) {
      await client.query(
        `INSERT INTO stock_ledger (material_id, date, transaction_type, in_qty, out_qty, balance, unit_price, value, remarks)
         VALUES ($1, CURRENT_DATE, 'grn', $2, 0, $3, $4, $5, 'Initial Receipt / Master Creation')`,
        [matId, inQty, opQty + inQty, price, inQty * price]
      );
    }

    await client.query('COMMIT');
    console.log(`✅ Material created successfully: ID ${matId}, Code: ${testCode}`);
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }

  // 3. Query as Materials.jsx does
  const { rows: [queried] } = await pool.query(`
    SELECT m.id, m.code, m.name, m.uom, m.hsn_code, m.bin_location, m.current_stock, m.unit_price, m.criticality_class, m.is_active,
           COALESCE((SELECT SUM(sl.in_qty)  FROM stock_ledger sl WHERE sl.material_id = m.id AND sl.transaction_type != 'opening'), 0) AS received,
           COALESCE((SELECT SUM(sl.out_qty) FROM stock_ledger sl WHERE sl.material_id = m.id AND sl.transaction_type != 'opening'), 0) AS issued
    FROM materials m
    WHERE m.id = $1
  `, [matId]);

  const rec = parseFloat(queried.received);
  const iss = parseFloat(queried.issued);
  const cur = parseFloat(queried.current_stock);
  const op = parseFloat((cur - rec + iss).toFixed(3));

  console.log('\n--- Queried Result for UI Table ---');
  console.log(`Code:         ${queried.code}`);
  console.log(`Name:         ${queried.name}`);
  console.log(`HSN Code:     ${queried.hsn_code}`);
  console.log(`Rack / Box:   ${queried.bin_location}`);
  console.log(`Opening:      ${op} (Expected: 12.001)`);
  console.log(`Received:     +${rec} (Expected: +5.000)`);
  console.log(`Issue:        -${iss} (Expected: -0.000)`);
  console.log(`Balance:      ${cur} (Expected: 17.001)`);
  console.log(`Unit Price:   ₹${queried.unit_price} (Expected: ₹100.00)`);
  console.log(`Stock Value:  ₹${(cur * queried.unit_price).toFixed(2)} (Expected: ₹1700.10)`);
  console.log(`Crit Class:   ${queried.criticality_class} (Expected: A)`);
  console.log(`Status:       ${queried.is_active ? 'Active' : 'Inactive'}`);

  if (op === 12.001 && rec === 5.0 && cur === 17.001) {
    console.log('\n🎉 ALL STOCK MOVEMENT INVARIANTS PASS 100%!');
  } else {
    console.error('\n❌ INVARIANT MISMATCH');
  }

  // 4. Test Update (Edit Material)
  await pool.query(
    `UPDATE materials SET name = '0.5" PISTON VALVES / BELLOW SEAL GLOBE VALVE', unit_price = 110.00 WHERE id = $1`,
    [matId]
  );
  const { rows: [updated] } = await pool.query('SELECT name, unit_price FROM materials WHERE id = $1', [matId]);
  console.log(`\n✅ Updated Material: Name: "${updated.name}", Price: ₹${updated.unit_price}`);

  // Cleanup test record
  await pool.query('DELETE FROM stock_ledger WHERE material_id = $1', [matId]);
  await pool.query('DELETE FROM materials WHERE id = $1', [matId]);
  console.log('\n🧹 Cleaned up test record.');

  await pool.end();
}

testMaterialEntry().catch(err => {
  console.error(err);
  pool.end();
  process.exit(1);
});
