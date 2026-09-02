const path = require('path');
const pool = require(path.join(__dirname, '../backend/src/db/pool'));

async function syncAllDataForVisibility() {
  const client = await pool.connect();
  
  console.log('='.repeat(90));
  console.log('🔄 SYNCING ALL ERP DATA FOR 100% APPLICATION VISIBILITY (NO DUPLICATES)');
  console.log('='.repeat(90));

  try {
    await client.query('BEGIN');

    // 1. Synchronize Inbound DCs from GRN challan numbers
    console.log('\n--- 1. SYNCHRONIZING INBOUND DELIVERY CHALLANS (DC) ---');
    const { rows: grnWithChallans } = await client.query(`
      SELECT g.id, g.grn_number, g.date, g.vendor_id, g.vehicle_number, 
             g.challan_number, g.invoice_number, g.total_value, g.grand_total,
             g.created_at, v.name as vendor_name
      FROM grn g
      LEFT JOIN vendors v ON v.id = g.vendor_id
      WHERE g.challan_number IS NOT NULL AND TRIM(g.challan_number) != ''
      ORDER BY g.id ASC;
    `);
    console.log(`  Found ${grnWithChallans.length} GRNs with Challan Numbers.`);

    let syncedDCs = 0;
    for (const g of grnWithChallans) {
      const dcNo = g.challan_number.trim();
      
      // Check if this DC + GRN combination already exists in inbound_dc
      const { rows: existingDC } = await client.query(`
        SELECT id FROM inbound_dc 
        WHERE (dc_no = $1 AND vendor_id = $2) OR grn_id = $3
      `, [dcNo, g.vendor_id, g.id]);

      if (existingDC.length === 0) {
        // Insert new Inbound DC
        const { rows: [newDc] } = await client.query(`
          INSERT INTO inbound_dc (
            dc_no, dc_date, vendor_id, vehicle_number, remarks, 
            status, invoice_number, party_name, invoice_total, 
            grn_id, created_by, created_at
          ) VALUES ($1, $2, $3, $4, $5, 'grn_done', $6, $7, $8, $9, 1, $10)
          RETURNING id;
        `, [
          dcNo, 
          g.date || g.created_at, 
          g.vendor_id, 
          g.vehicle_number || null, 
          `Auto-synced from GRN ${g.grn_number}`,
          g.invoice_number || null,
          g.vendor_name || null,
          g.grand_total || g.total_value || 0,
          g.id,
          g.created_at
        ]);

        // Copy items from grn_items
        const { rows: grnItems } = await client.query(`
          SELECT material_id, received_qty, unit_price
          FROM grn_items
          WHERE grn_id = $1
        `, [g.id]);

        for (const gi of grnItems) {
          await client.query(`
            INSERT INTO inbound_dc_items (inbound_dc_id, material_id, qty)
            VALUES ($1, $2, $3);
          `, [newDc.id, gi.material_id, gi.received_qty]);
        }

        syncedDCs++;
      }
    }
    console.log(`  ✅ Synced ${syncedDCs} Inbound DCs into inbound_dc table (0 duplicates).`);

    // 2. Verify total Inbound DCs now
    const { rows: dcCount } = await client.query('SELECT COUNT(*) as count FROM inbound_dc');
    console.log(`  Total Inbound DCs in DB: ${dcCount[0].count}`);

    // 3. Verify PRs / Indents visibility
    console.log('\n--- 2. VERIFYING PR / INDENT VISIBILITY ---');
    const { rows: prRows } = await client.query(`
      SELECT COUNT(*) as total,
             COUNT(*) FILTER (WHERE status = 'Closed') as closed,
             COUNT(*) FILTER (WHERE status = 'Approved') as approved,
             COUNT(*) FILTER (WHERE status = 'Submitted') as submitted,
             COUNT(*) FILTER (WHERE status = 'Draft') as draft
      FROM indents;
    `);
    console.log(`  PR Summary: Total ${prRows[0].total} (Submitted: ${prRows[0].submitted}, Approved: ${prRows[0].approved}, Closed: ${prRows[0].closed})`);

    // 4. Verify POs visibility
    console.log('\n--- 3. VERIFYING PURCHASE ORDERS VISIBILITY ---');
    const { rows: poRows } = await client.query(`
      SELECT COUNT(*) as total,
             COUNT(*) FILTER (WHERE status = 'Draft') as draft,
             COUNT(*) FILTER (WHERE status = 'Approved') as approved,
             COUNT(*) FILTER (WHERE status = 'Received') as received,
             COUNT(*) FILTER (WHERE status = 'Closed') as closed
      FROM purchase_orders;
    `);
    console.log(`  PO Summary: Total ${poRows[0].total} (Draft: ${poRows[0].draft}, Approved: ${poRows[0].approved}, Received: ${poRows[0].received})`);

    // 5. Verify GRN / Inward visibility
    console.log('\n--- 4. VERIFYING GRN / INWARD VISIBILITY ---');
    const { rows: grnRows } = await client.query(`
      SELECT COUNT(*) as total,
             COUNT(DISTINCT vendor_id) as vendors,
             COALESCE(SUM(total_value), 0) as total_value
      FROM grn;
    `);
    console.log(`  GRN Summary: Total ${grnRows[0].total} headers | Total Value: ₹${Number(grnRows[0].total_value).toLocaleString('en-IN')}`);

    // 6. Verify Vendor Bills visibility
    console.log('\n--- 5. VERIFYING VENDOR BILLS / INVOICES VISIBILITY ---');
    const { rows: billRows } = await client.query(`
      SELECT COUNT(*) as total,
             COUNT(*) FILTER (WHERE status = 'Paid') as paid,
             COUNT(*) FILTER (WHERE status = 'Unpaid') as unpaid,
             COALESCE(SUM(total_amount), 0) as total_amount
      FROM vendor_bills;
    `);
    console.log(`  Bill Summary: Total ${billRows[0].total} bills | Paid: ${billRows[0].paid} | Total Amount: ₹${Number(billRows[0].total_amount).toLocaleString('en-IN')}`);

    await client.query('COMMIT');
    console.log('\n✅ ALL DATA SYNCED & COMMITTED SUCCESSFULLY WITH FULL INTEGRITY!');

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Sync Error:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

syncAllDataForVisibility().catch(console.error);
