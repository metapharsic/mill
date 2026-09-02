const path = require('path');
const fs = require('fs');
const pool = require(path.join(__dirname, '../backend/src/db/pool'));

async function checkGRN() {
  console.log('=== INSPECTING CURRENT GRN TABLE ===');
  const cols = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'grn' ORDER BY ordinal_position");
  console.log('Columns:', cols.rows.map(c => `${c.column_name} (${c.data_type})`).join(', '));

  const { rows: grns } = await pool.query('SELECT * FROM grn ORDER BY id DESC');
  console.log(`\nTotal GRN records: ${grns.length}`);
  for (const g of grns) {
    console.log(`ID: ${g.id} | No: ${g.grn_number} | GatePass: ${g.gate_pass_id} | PO: ${g.po_id} | Vendor: ${g.vendor_id} | Invoice: ${g.invoice_no || g.invoice_number || 'N/A'} | Status: ${g.status} | Created: ${g.created_at}`);
  }

  console.log('\n=== INSPECTING INBOUND DELIVERY CHALLANS ===');
  const { rows: dcs } = await pool.query('SELECT * FROM inbound_delivery_challans ORDER BY id DESC');
  console.log(`Total Inbound DCs: ${dcs.length}`);
  for (const dc of dcs) {
    console.log(`DC ID: ${dc.id} | DC No: ${dc.dc_number} | GRN No: ${dc.grn_number || dc.grn_id || 'N/A'} | Matched: ${dc.is_matched} | Date: ${dc.dc_date} | Created: ${dc.created_at}`);
  }

  console.log('\n=== INSPECTING GATE PASSES (INWARD) ===');
  const { rows: gps } = await pool.query("SELECT * FROM gate_passes WHERE pass_type = 'inward' OR pass_type = 'INWARD' ORDER BY id DESC LIMIT 20");
  console.log(`Total Inward Gate Passes: ${gps.length}`);
  for (const gp of gps) {
    console.log(`GP ID: ${gp.id} | GP No: ${gp.gate_pass_number || gp.pass_number} | Challan: ${gp.challan_number} | PO: ${gp.po_id} | Created: ${gp.created_at}`);
  }

  console.log('\n=== INSPECTING STOCK LEDGER INWARD MOVEMENTS ===');
  const { rows: ledgerIn } = await pool.query("SELECT * FROM stock_ledger WHERE transaction_type IN ('inward', 'grn', 'INWARD', 'GRN', 'purchase', 'PURCHASE') ORDER BY id DESC LIMIT 20");
  console.log(`Recent Inward Stock Ledger rows: ${ledgerIn.length}`);
  for (const l of ledgerIn) {
    console.log(`Ledger ID: ${l.id} | Type: ${l.transaction_type} | Ref: ${l.reference_number || l.reference_id} | Mat ID: ${l.material_id} | Qty: ${l.quantity} | Date: ${l.date} | Created: ${l.created_at}`);
  }

  await pool.end();
}

checkGRN().catch(err => {
  console.error(err);
  process.exit(1);
});
