const pool = require('../src/db/pool');

async function backfillPrices() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Update materials where unit_price is 0 using latest price from stock_ledger
    const r1 = await client.query(`
      UPDATE materials m
      SET unit_price = sl.unit_price
      FROM (
        SELECT DISTINCT ON (material_id) material_id, unit_price
        FROM stock_ledger
        WHERE unit_price > 0
        ORDER BY material_id, id DESC
      ) sl
      WHERE m.id = sl.material_id AND (m.unit_price = 0 OR m.unit_price IS NULL);
    `);
    console.log(`Updated ${r1.rowCount} materials from stock_ledger`);

    // Update materials where unit_price is still 0 using latest price from po_items
    const r2 = await client.query(`
      UPDATE materials m
      SET unit_price = pi.unit_price
      FROM (
        SELECT DISTINCT ON (material_id) material_id, unit_price
        FROM po_items
        WHERE unit_price > 0
        ORDER BY material_id, id DESC
      ) pi
      WHERE m.id = pi.material_id AND (m.unit_price = 0 OR m.unit_price IS NULL);
    `);
    console.log(`Updated ${r2.rowCount} materials from po_items`);

    // Update materials where unit_price is still 0 using latest price from grn_items
    const r3 = await client.query(`
      UPDATE materials m
      SET unit_price = gi.unit_price
      FROM (
        SELECT DISTINCT ON (material_id) material_id, unit_price
        FROM grn_items
        WHERE unit_price > 0
        ORDER BY material_id, id DESC
      ) gi
      WHERE m.id = gi.material_id AND (m.unit_price = 0 OR m.unit_price IS NULL);
    `);
    console.log(`Updated ${r3.rowCount} materials from grn_items`);

    await client.query('COMMIT');
    console.log('Price backfill complete!');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('Error during price backfill:', e);
  } finally {
    client.release();
    process.exit(0);
  }
}

backfillPrices();
