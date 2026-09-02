const path = require('path');
const pool = require(path.join(__dirname, '../backend/src/db/pool'));

async function inspect5Days() {
  const client = await pool.connect();
  const dates = ['2026-08-28', '2026-08-29', '2026-08-30', '2026-08-31', '2026-09-01', '2026-09-02'];
  
  console.log('='.repeat(90));
  console.log('📅 DAY-BY-DAY BREAKDOWN FOR LAST 5+ DAYS (2026-08-28 TO 2026-09-02)');
  console.log('='.repeat(90));

  for (const d of dates) {
    console.log(`\n──────────────────── DATE: ${d} ────────────────────`);
    
    // 1. PR / Indents
    const { rows: prs } = await client.query(`
      SELECT indent_number, status, department_id, created_at
      FROM indents
      WHERE created_at::date = $1 OR date = $1
      ORDER BY id ASC;
    `, [d]);
    console.log(`  📌 PRs/Indents (${prs.length}):`);
    prs.forEach(p => console.log(`     - ${p.indent_number} | Status: ${p.status} | Created: ${p.created_at?.toISOString()}`));

    // 2. POs
    const { rows: pos } = await client.query(`
      SELECT po.po_number, po.status, v.name as vendor, po.created_at, po.date
      FROM purchase_orders po
      LEFT JOIN vendors v ON v.id = po.vendor_id
      WHERE po.created_at::date = $1 OR po.date = $1
      ORDER BY po.id ASC;
    `, [d]);
    console.log(`  🛒 Purchase Orders (${pos.length}):`);
    pos.forEach(p => console.log(`     - ${p.po_number} | Status: ${p.status} | Vendor: ${p.vendor} | Date: ${p.date}`));

    // 3. Gate Passes / DCs
    const { rows: gps } = await client.query(`
      SELECT gp_number, pass_type, status, challan_number, invoice_number, created_at, date
      FROM gate_passes
      WHERE created_at::date = $1 OR date = $1
      ORDER BY id ASC;
    `, [d]);
    console.log(`  🚚 Gate Passes / DCs (${gps.length}):`);
    gps.forEach(g => console.log(`     - ${g.gp_number} | Type: ${g.pass_type} | Status: ${g.status} | Challan: ${g.challan_number || 'N/A'}`));

    // 4. GRNs (Loaded Inventory)
    const { rows: grns } = await client.query(`
      SELECT g.grn_number, g.status, v.name as vendor, g.created_at, g.date,
             (SELECT COUNT(*) FROM grn_items gi WHERE gi.grn_id = g.id) as items
      FROM grn g
      LEFT JOIN vendors v ON v.id = g.vendor_id
      WHERE g.created_at::date = $1 OR g.date = $1
      ORDER BY g.id ASC;
    `, [d]);
    console.log(`  📦 GRNs / Inward (${grns.length}):`);
    grns.forEach(g => console.log(`     - ${g.grn_number} | Status: ${g.status} | Vendor: ${g.vendor} | Items: ${g.items} | Date: ${g.date}`));

    // 5. Invoices / Vendor Bills
    const { rows: bills } = await client.query(`
      SELECT vb.bill_number, vb.status, vb.vendor_invoice_number, vb.total_amount, v.name as vendor, vb.created_at, vb.invoice_date
      FROM vendor_bills vb
      LEFT JOIN vendors v ON v.id = vb.vendor_id
      WHERE vb.created_at::date = $1 OR vb.invoice_date = $1
      ORDER BY vb.id ASC;
    `, [d]);
    console.log(`  🧾 Invoices / Bills (${bills.length}):`);
    bills.forEach(b => console.log(`     - ${b.bill_number} | Inv: ${b.vendor_invoice_number} | ₹${b.total_amount} | Vendor: ${b.vendor} | Date: ${b.invoice_date}`));
  }

  client.release();
  await pool.end();
}

inspect5Days().catch(console.error);
