// Integration / "db sync" test for the Inbound DC -> Invoice Match -> GRN
// workflow (backend/src/routes/inboundDc.js, backend/scripts/migrate_inbound_dc.js).
//
// What this checks, live against a real Postgres connection:
//   1. inbound_dc / inbound_dc_items tables exist with the columns the
//      routes and Store.jsx card actually rely on (schema drift check --
//      this is the "db sync" verification requested alongside the tests).
//   2. The receive -> match-invoice -> grn lifecycle's core writes work
//      end-to-end at the SQL level (materials.current_stock bump,
//      stock_ledger provisional_grn row, inbound_dc status transitions,
//      grn/grn_items creation, and the provisional->grn ledger re-tag) --
//      exercising the same statements the Express routes run, without
//      needing a running HTTP server.
//
// SAFETY: everything happens inside ONE transaction that is ALWAYS rolled
// back in a `finally` block, whether the test passes or throws. Nothing
// this script does is ever committed to the real database -- it is safe to
// run against a shared/staging DB. It seeds its own throwaway
// material/vendor rows (unique per run via Date.now()) so it never touches
// real production rows even before the rollback.
//
// This sandbox has no DB access (pool.connect() will ECONNREFUSED here --
// that's expected and NOT a bug in this script). Run this on a machine that
// can reach the real Postgres instance:
//   node backend/scripts/test_inbound_dc_integration.js

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const pool = require('../src/db/pool');
const assert = require('assert');
const { computeLineValue } = require('../src/utils/dcInvoiceMatch');

async function main() {
  console.log('=== Inbound DC / Invoice Match — Integration + DB-Sync Test ===\n');
  let client;
  try {
    client = await pool.connect();
  } catch (e) {
    console.log('Could not connect to the database (expected in the build sandbox):');
    console.log('  ' + e.message);
    console.log('\nThis script is meant to be run by the user on a machine with real DB');
    console.log('access. Nothing was tested. Exiting 0 (not a failure of this script).');
    process.exit(0);
  }

  let ok = true;
  try {
    await client.query('BEGIN');

    // ---- 1. Schema / "db sync" check -----------------------------------
    console.log('-- Schema check --');
    const { rows: dcCols } = await client.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'inbound_dc'`
    );
    const { rows: itemCols } = await client.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'inbound_dc_items'`
    );
    const dcColNames = dcCols.map(r => r.column_name);
    const itemColNames = itemCols.map(r => r.column_name);

    const requiredDcCols = [
      'id', 'dc_no', 'dc_date', 'vendor_id', 'vehicle_number', 'remarks', 'status',
      'invoice_number', 'invoice_date', 'matched_by', 'matched_at',
      'party_name', 'invoice_total', 'grn_id', 'created_by', 'created_at'
    ];
    const requiredItemCols = ['id', 'inbound_dc_id', 'material_id', 'qty', 'unit', 'batch_no'];

    const missingDc = requiredDcCols.filter(c => !dcColNames.includes(c));
    const missingItem = requiredItemCols.filter(c => !itemColNames.includes(c));

    if (missingDc.length || missingItem.length) {
      ok = false;
      console.log('  FAIL  schema is out of sync with backend/scripts/migrate_inbound_dc.js');
      if (missingDc.length) console.log(`        inbound_dc missing columns: ${missingDc.join(', ')}`);
      if (missingItem.length) console.log(`        inbound_dc_items missing columns: ${missingItem.join(', ')}`);
      console.log('        -> run: node backend/scripts/migrate_inbound_dc.js');
    } else {
      console.log('  PASS  inbound_dc and inbound_dc_items have all expected columns');
      console.log(`        (party_name / invoice_total present -- migration has been run)`);
    }

    // If the schema isn't there, nothing below can work -- stop here but
    // still fall through to the rollback in `finally`.
    if (!ok) {
      throw new Error('Schema check failed; skipping lifecycle exercise (see above)');
    }

    // ---- 2. Seed throwaway test data -----------------------------------
    console.log('\n-- Seeding throwaway test rows (will be rolled back) --');
    const stamp = Date.now();
    const { rows: [mat] } = await client.query(
      `INSERT INTO materials (code, name, uom, current_stock, unit_price, is_active)
       VALUES ($1, 'DC-Integration-Test Material', 'Nos', 10, 100.00, true)
       RETURNING id, current_stock, unit_price`,
      [`TEST-DCMAT-${stamp}`]
    );
    const { rows: [vendor] } = await client.query(
      `INSERT INTO vendors (code, name, is_active) VALUES ($1, 'DC Integration Test Vendor', true) RETURNING id`,
      [`TEST-DCVEND-${stamp}`]
    );
    console.log(`  seeded material #${mat.id}, vendor #${vendor.id}`);

    // ---- 3. Exercise POST / (receive DC) logic --------------------------
    const { rows: [dc] } = await client.query(
      `INSERT INTO inbound_dc (dc_no, dc_date, vendor_id, status, created_by)
       VALUES ($1, CURRENT_DATE, $2, 'received', NULL) RETURNING *`,
      [`TEST-IDC-${stamp}`, vendor.id]
    );
    const qty = 5;
    const { rows: [item] } = await client.query(
      `INSERT INTO inbound_dc_items (inbound_dc_id, material_id, qty, unit)
       VALUES ($1, $2, $3, 'Nos') RETURNING *`,
      [dc.id, mat.id, qty]
    );
    const newStock = parseFloat(mat.current_stock) + qty;
    await client.query(`UPDATE materials SET current_stock=$1 WHERE id=$2`, [newStock, mat.id]);
    await client.query(
      `INSERT INTO stock_ledger (material_id, date, transaction_type, reference_type, reference_id, in_qty, out_qty, balance, unit_price, value, remarks, vendor_id)
       VALUES ($1, CURRENT_DATE, 'provisional_grn', 'INBOUND_DC', $2, $3, 0, $4, $5, $6, 'integration test', $7)`,
      [mat.id, dc.id, qty, newStock, mat.unit_price, qty * mat.unit_price, vendor.id]
    );

    const { rows: [stockAfterReceive] } = await client.query(`SELECT current_stock FROM materials WHERE id=$1`, [mat.id]);
    assert.strictEqual(parseFloat(stockAfterReceive.current_stock), newStock, 'stock should bump provisionally on receipt');
    console.log(`  PASS  provisional stock bump on receipt (${mat.current_stock} -> ${stockAfterReceive.current_stock})`);

    // ---- 4. Exercise match-invoice transition ---------------------------
    const partyName = 'DC Integration Test Vendor';
    const invoiceTotal = 590; // 5 * 100 = 500 taxable + 90 tax (18%)
    const { rows: [matched] } = await client.query(
      `UPDATE inbound_dc SET status='invoice_matched', invoice_number=$1, party_name=$2, invoice_total=$3, matched_at=NOW()
       WHERE id=$4 RETURNING *`,
      ['TEST-INV-001', partyName, invoiceTotal, dc.id]
    );
    assert.strictEqual(matched.status, 'invoice_matched');
    console.log('  PASS  DC transitions received -> invoice_matched');

    // ---- 5. Verify computeLineValue agrees with the invoice total -------
    // (this is the same pure function backend/src/routes/inboundDc.js now
    // uses for the GRN line insert, and Store.jsx mirrors client-side)
    const { totalValue } = computeLineValue(qty, 100, 0, 90);
    assert.ok(Math.abs(totalValue - invoiceTotal) < 1, 'computed line total should match seeded invoice total');
    console.log(`  PASS  computeLineValue(${qty}, 100, 0%, tax 90) = ${totalValue} matches invoice_total ${invoiceTotal}`);

    // ---- 6. Exercise GRN creation + provisional ledger re-tag -----------
    const { rows: [grn] } = await client.query(
      `INSERT INTO grn (grn_number, date, vendor_id, po_id, invoice_number, status, remarks)
       VALUES ($1, CURRENT_DATE, $2, NULL, $3, 'Received', $4) RETURNING *`,
      [`TEST-GRN-${stamp}`, vendor.id, 'TEST-INV-001', `Party Name: ${partyName}`]
    );
    await client.query(
      `INSERT INTO grn_items (grn_id, material_id, po_qty, received_qty, accepted_qty, rejected_qty, uom, unit_price, discount_pct, taxable_amount, total_amount, gst_pct)
       VALUES ($1, $2, $3, $4, $5, 0, 'Nos', $6, $7, $8, $9, $10)`,
      [grn.id, mat.id, qty, qty, qty, 100, 0, qty * 100, totalValue, 18]
    );
    await client.query(
      `UPDATE stock_ledger SET transaction_type='grn', reference_type='GRN', reference_id=$1
       WHERE material_id=$2 AND reference_type='INBOUND_DC' AND reference_id=$3 AND transaction_type='provisional_grn'`,
      [grn.id, mat.id, dc.id]
    );
    await client.query(`UPDATE inbound_dc SET status='grn_done', grn_id=$1 WHERE id=$2`, [grn.id, dc.id]);

    const { rows: [ledgerRow] } = await client.query(
      `SELECT transaction_type, reference_type, reference_id FROM stock_ledger WHERE material_id=$1 AND reference_id=$2 AND transaction_type='grn'`,
      [mat.id, grn.id]
    );
    assert.ok(ledgerRow, 'provisional ledger row should be re-tagged to grn, not duplicated');
    console.log('  PASS  provisional_grn ledger row re-tagged to grn (no double stock count)');

    const { rows: countRows } = await client.query(
      `SELECT COUNT(*)::int AS c FROM stock_ledger WHERE material_id=$1 AND reference_id IN ($2,$3)`,
      [mat.id, dc.id, grn.id]
    );
    assert.strictEqual(countRows[0].c, 1, 'exactly one ledger row should exist for this material across DC+GRN (re-tag, not insert)');
    console.log('  PASS  no duplicate ledger row created by the GRN step');

    console.log('\n=== All integration checks passed ===');
  } catch (e) {
    ok = false;
    console.log('\n  FAIL  ' + e.message);
  } finally {
    // ALWAYS roll back -- this script must never leave test data committed.
    try {
      await client.query('ROLLBACK');
      console.log('\n(transaction rolled back — no data was persisted)');
    } catch (rollbackErr) {
      console.log('\nWARNING: rollback itself failed: ' + rollbackErr.message);
    }
    client.release();
    await pool.end();
  }
  process.exit(ok ? 0 : 1);
}

main();
