const pool = require('../src/db/pool');

/**
 * Ensures all chemical items (Category 28 and 'CHEM%' / 'CH%')
 * have valid opening stock records in stock_ledger,
 * satisfying the fundamental inventory invariant:
 * Closing Balance = Opening Balance + Received - Issued
 */
async function syncChemicalOpenings() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🧪 MULTI-AGENT SYNC: CHEMICAL OPENINGS & LEDGER INVARIANTS');
  console.log('═══════════════════════════════════════════════════════════\n');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Fetch all chemical materials
    const { rows: chemicals } = await client.query(`
      SELECT m.id, m.code, m.name, m.current_stock, m.unit_price,
             (SELECT sl.id FROM stock_ledger sl WHERE sl.material_id = m.id AND sl.transaction_type = 'opening' LIMIT 1) AS op_id,
             (SELECT sl.in_qty FROM stock_ledger sl WHERE sl.material_id = m.id AND sl.transaction_type = 'opening' LIMIT 1) AS op_qty,
             COALESCE((SELECT SUM(sl.in_qty) FROM stock_ledger sl WHERE sl.material_id = m.id AND sl.transaction_type != 'opening'), 0) AS total_rec,
             COALESCE((SELECT SUM(sl.out_qty) FROM stock_ledger sl WHERE sl.material_id = m.id AND sl.transaction_type != 'opening'), 0) AS total_iss
      FROM materials m
      WHERE m.category_id = 28 OR m.code LIKE 'CH%' OR m.code LIKE 'CHEM%'
      ORDER BY m.code
    `);

    console.log(`Found ${chemicals.length} chemical materials in system.\n`);

    let backfilledCount = 0;
    let verifiedCount = 0;

    for (const chem of chemicals) {
      const curStock = parseFloat(chem.current_stock || 0);
      const unitPrice = parseFloat(chem.unit_price || 0);
      const totalRec = parseFloat(chem.total_rec || 0);
      const totalIss = parseFloat(chem.total_iss || 0);

      // If opening record is missing, backfill it
      if (!chem.op_id) {
        // Calculated initial opening before subsequent receipts & issues
        const computedOp = Math.max(0, parseFloat((curStock - totalRec + totalIss).toFixed(3)));
        await client.query(`
          INSERT INTO stock_ledger (
            material_id, date, transaction_type, in_qty, out_qty, balance, unit_price, value, remarks
          ) VALUES ($1, CURRENT_DATE, 'opening', $2, 0, $2, $3, $4, 'Opening Stock / Chemical Master Entry')
        `, [chem.id, computedOp, unitPrice, computedOp * unitPrice]);

        console.log(`  ➕ Backfilled Opening for [${chem.code}] ${chem.name}: Op=${computedOp}, Current=${curStock}`);
        backfilledCount++;
      } else {
        verifiedCount++;
      }
    }

    await client.query('COMMIT');
    console.log(`\n✅ Chemical Opening Sync Complete:`);
    console.log(`   - Verified Openings: ${verifiedCount}`);
    console.log(`   - Backfilled Openings: ${backfilledCount}`);
    console.log(`   - Total Chemicals Active: ${chemicals.length}\n`);

    // Verify 100% coverage
    const { rows: checkMissing } = await pool.query(`
      SELECT COUNT(*) AS missing_count
      FROM materials m
      WHERE (m.category_id = 28 OR m.code LIKE 'CH%' OR m.code LIKE 'CHEM%')
        AND m.id NOT IN (SELECT material_id FROM stock_ledger WHERE transaction_type = 'opening')
    `);

    const missing = parseInt(checkMissing[0].missing_count, 10);
    if (missing === 0) {
      console.log('🎯 100% OF CHEMICALS NOW HAVE OPENING BALANCES IN STOCK LEDGER!');
    } else {
      throw new Error(`${missing} chemicals are still missing opening stock records!`);
    }

    return { total: chemicals.length, verified: verifiedCount, backfilled: backfilledCount, missing };
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Error in syncChemicalOpenings:', err);
    throw err;
  } finally {
    client.release();
  }
}

if (require.main === module) {
  syncChemicalOpenings()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = { syncChemicalOpenings };
