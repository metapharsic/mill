const pool = require('../src/db/pool');

async function seed() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    console.log('📦 Seeding Master Data...');
    // Vendor
    const v = await client.query(`INSERT INTO vendors (name, email, mobile, address) VALUES ('Global Scrap', 'global@scrap', '123', 'Yard') RETURNING id`);
    const vendorId = v.rows[0].id;

    // Customer
    const c = await client.query(`INSERT INTO customers (name, email, mobile, address) VALUES ('Premium Packagers', 'prem@pack', '456', 'St') RETURNING id`);
    const customerId = c.rows[0].id;

    // Material
    const m = await client.query(`INSERT INTO materials (code, name, category_id, uom) VALUES ('OCC-99', 'Premium OCC', 1, 'MT') RETURNING id`);
    const matId = m.rows[0].id;

    console.log('🛒 Seeding Purchase & Inventory...');
    // PO
    const po = await client.query(`INSERT INTO purchase_orders (po_number, vendor_id, date, status) VALUES ('PO-9999', $1, NOW(), 'Approved') RETURNING id`, [vendorId]);
    const poId = po.rows[0].id;
    await client.query(`INSERT INTO po_items (po_id, material_id, qty, unit_price) VALUES ($1, $2, 200, 15000)`, [poId, matId]);
    
    // Removed inventory insert

    console.log('🏭 Seeding Production & Quality...');
    // Reels
    const r1 = await client.query(`INSERT INTO reels (reel_number, machine_id, grade_id, gsm, bf, weight_kg, status) VALUES ('R-9991', 1, 1, 150, 22, 2500, 'In Warehouse') RETURNING id`);
    const r2 = await client.query(`INSERT INTO reels (reel_number, machine_id, grade_id, gsm, bf, weight_kg, status) VALUES ('R-9992', 1, 1, 150, 22, 2450, 'In Warehouse') RETURNING id`);
    const r1Id = r1.rows[0].id, r2Id = r2.rows[0].id;

    console.log('💼 Seeding Sales...');
    // SO
    const so = await client.query(`INSERT INTO sales_orders (so_number, customer_id, status) VALUES ('SO-9999', $1, 'Confirmed') RETURNING id`, [customerId]);
    const soId = so.rows[0].id;
    await client.query(`INSERT INTO sales_order_items (so_id, grade_id, gsm, qty_mt, rate_per_mt) VALUES ($1, 1, 150, 4.95, 32000)`, [soId]);

    await client.query('COMMIT');
    console.log('🎉 Seed Complete! Check your Dashboard and tables!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ SQL Seeding Error:', err.message);
  } finally {
    client.release();
    pool.end();
  }
}

seed();
