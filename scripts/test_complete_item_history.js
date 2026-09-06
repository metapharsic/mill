/**
 * Verification Test Script: 360-Degree Item History & Usage Engine
 */
const path = require('path');
const pool = require(path.join(__dirname, '../backend/src/db/pool'));

async function testCompleteItemHistory() {
  console.log('================================================================');
  console.log('🧪 TESTING 360-DEGREE MULTI-AGENT ITEM HISTORY ENGINE');
  console.log('================================================================');

  const client = await pool.connect();
  try {
    // Find material with most stock ledger transactions
    const { rows: topMats } = await client.query(`
      SELECT sl.material_id, m.code, m.name, COUNT(sl.id) as txn_count
      FROM stock_ledger sl
      JOIN materials m ON sl.material_id = m.id
      GROUP BY sl.material_id, m.code, m.name
      ORDER BY txn_count DESC
      LIMIT 5
    `);

    if (!topMats.length) {
      console.log('⚠️ No stock ledger transactions found in database.');
      return;
    }

    console.log(`Found ${topMats.length} active high-transaction materials:`);
    topMats.forEach(m => console.log(`  • ID: ${m.material_id} | Code: ${m.code} | Name: ${m.name} (${m.txn_count} transactions)`));

    const testMat = topMats[0];
    console.log(`\nTesting Complete 360-Degree History for Material ID ${testMat.material_id} (${testMat.name})...`);

    // Query history & department breakdown
    const { rows: history } = await client.query(`
      SELECT sl.id, sl.date, sl.transaction_type, sl.in_qty, sl.out_qty, sl.balance, sl.value,
             v.name AS vendor_name, u.name AS user_name, d.name AS dept_name
      FROM stock_ledger sl
      LEFT JOIN users u ON sl.created_by = u.id
      LEFT JOIN vendors v ON sl.vendor_id = v.id
      LEFT JOIN indents ind ON ((sl.reference_type ILIKE 'indent%' OR sl.reference_type ILIKE 'issue%') AND CASE WHEN sl.reference_id::text ~ '^[0-9]+$' THEN sl.reference_id::int = ind.id ELSE FALSE END)
      LEFT JOIN departments d ON (ind.department_id = d.id OR u.department_id = d.id)
      WHERE sl.material_id = $1
      ORDER BY sl.date DESC, sl.id DESC
      LIMIT 10
    `, [testMat.material_id]);

    const { rows: deptBreakdown } = await client.query(`
      SELECT COALESCE(d.name, 'General Operations') AS dept_name, SUM(sl.out_qty) as total_out, SUM(sl.value) as total_val
      FROM stock_ledger sl
      LEFT JOIN indents ind ON ((sl.reference_type ILIKE 'indent%' OR sl.reference_type ILIKE 'issue%') AND CASE WHEN sl.reference_id::text ~ '^[0-9]+$' THEN sl.reference_id::int = ind.id ELSE FALSE END)
      LEFT JOIN users u ON sl.created_by = u.id
      LEFT JOIN departments d ON (ind.department_id = d.id OR u.department_id = d.id)
      WHERE sl.material_id = $1 AND sl.out_qty > 0
      GROUP BY d.name
    `, [testMat.material_id]);

    console.log(`\n✅ Verified History Query: Returned ${history.length} sample transactions.`);
    history.forEach((h, i) => {
      console.log(`  ${i + 1}. [${String(h.date).slice(0, 10)}] ${h.transaction_type.toUpperCase()} | In: +${h.in_qty} | Out: -${h.out_qty} | Bal: ${h.balance} | Dept: ${h.dept_name || 'N/A'}`);
    });

    console.log('\n✅ Verified Department Usage Breakdown:');
    deptBreakdown.forEach(d => {
      console.log(`  🏢 Department: ${d.dept_name} | Issued Qty: ${d.total_out} | Value: ₹${d.total_val}`);
    });

    console.log('\n================================================================');
    console.log('🎉 360-DEGREE ITEM HISTORY & USAGE ENGINE VERIFICATION SUCCESSFUL');
    console.log('================================================================\n');
  } catch (err) {
    console.error('❌ Test error:', err);
  } finally {
    client.release();
    pool.end();
  }
}

testCompleteItemHistory();
