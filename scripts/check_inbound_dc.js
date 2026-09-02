const path = require('path');
const pool = require(path.join(__dirname, '../backend/src/db/pool'));

async function checkInboundDC() {
  const client = await pool.connect();
  const { rows } = await client.query(`
    SELECT d.id, d.dc_no, d.dc_date, d.vendor_id, v.name as vendor_name, d.status, d.created_at,
           (SELECT COUNT(*) FROM inbound_dc_items i WHERE i.inbound_dc_id = d.id) as item_count
    FROM inbound_dc d
    LEFT JOIN vendors v ON v.id = d.vendor_id
    ORDER BY d.id DESC;
  `);
  console.log(`\n=== INBOUND_DC TABLE: ${rows.length} records ===`);
  rows.forEach(r => console.log(`  ID: ${r.id} | DC#: ${r.dc_no} | Date: ${r.dc_date} | Vendor: ${r.vendor_name} | Status: ${r.status} | Items: ${r.item_count}`));

  client.release();
  await pool.end();
}

checkInboundDC().catch(console.error);
