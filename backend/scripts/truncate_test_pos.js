const pool = require('../src/db/pool');

/**
 * Truncates all test-generated Purchase Orders and PO items,
 * clears any foreign key references, and resets sequence identities.
 */
async function truncateTestPurchaseOrders() {
  console.log('🧹 ======================================================================');
  console.log('🧹 TRUNCATING TEST PURCHASE ORDERS & RESETTING PROCUREMENT IDENTITY');
  console.log('🧹 ======================================================================\n');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Check existing counts
    const { rows: [beforePo] } = await client.query('SELECT COUNT(*) AS count FROM purchase_orders');
    const { rows: [beforeItems] } = await client.query('SELECT COUNT(*) AS count FROM po_items');
    console.log(`📊 Found ${beforePo.count} Purchase Orders and ${beforeItems.count} PO Line Items to truncate.`);

    // 2. Disassociate foreign key references in gate_passes and material_rejections
    const { rowCount: gpCleared } = await client.query('UPDATE gate_passes SET po_id = NULL WHERE po_id IS NOT NULL');
    console.log(`🔗 Disassociated ${gpCleared} gate_passes linking to test POs.`);

    const { rowCount: mrCleared } = await client.query('UPDATE material_rejections SET po_id = NULL WHERE po_id IS NOT NULL');
    console.log(`🔗 Disassociated ${mrCleared} material_rejections linking to test POs.`);

    // 3. Clear grn references if any
    const { rowCount: grnCleared } = await client.query('UPDATE grn SET po_id = NULL WHERE po_id IS NOT NULL');
    console.log(`🔗 Disassociated ${grnCleared} grn records linking to test POs.`);

    // 4. Delete all PO items
    await client.query('DELETE FROM po_items');
    console.log('🗑️ Cleared po_items table.');

    // 5. Delete all Purchase Orders
    await client.query('DELETE FROM purchase_orders');
    console.log('🗑️ Cleared purchase_orders table.');

    // 6. Reset Sequences
    await client.query("SELECT setval(pg_get_serial_sequence('purchase_orders', 'id'), 1, false)");
    await client.query("SELECT setval(pg_get_serial_sequence('po_items', 'id'), 1, false)");
    console.log('🔄 Reset purchase_orders and po_items ID sequence counters to 1.');

    await client.query('COMMIT');

    // 7. Verify 0 records remain
    const { rows: [afterPo] } = await pool.query('SELECT COUNT(*) AS count FROM purchase_orders');
    const { rows: [afterItems] } = await pool.query('SELECT COUNT(*) AS count FROM po_items');

    console.log('\n======================================================================');
    console.log(`🎉 SUCCESS: ${afterPo.count} POs and ${afterItems.count} PO items remaining. Slate is 100% pristine!`);
    console.log('======================================================================\n');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Failed to truncate test purchase orders:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

truncateTestPurchaseOrders();
