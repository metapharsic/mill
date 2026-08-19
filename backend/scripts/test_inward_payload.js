require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const pool = require('../src/db/pool');

async function testInwardPayload() {
  console.log('Testing exact Inward payload with price "35.75"...');

  // Let's find material STARCH or any material
  const { rows: [mat] } = await pool.query(`SELECT id, code, name FROM materials WHERE code = 'CHSTP001' OR name ILIKE '%STARCH%' LIMIT 1`);
  const matId = mat ? mat.id : (await pool.query(`SELECT id FROM materials LIMIT 1`)).rows[0].id;
  console.log('Using Material:', matId, mat ? mat.code : '');

  // Let's find PO PO-20260818-0002 or any PO
  const { rows: [po] } = await pool.query(`SELECT id, po_number, vendor_id FROM purchase_orders WHERE po_number = 'PO-20260818-0002' LIMIT 1`);
  console.log('Found PO:', po);

  const payload = {
    material_id: String(matId),
    in_qty: "25000.000",
    unit_price: "35.75",
    inward_type: "grn",
    reference_type: "PO",
    reference_id: po ? po.po_number : "PO-20260818-0002",
    vendor_id: po ? String(po.vendor_id) : "1",
    vendor_name: "SUKHIJIT STRACH MILLS",
    bin_location: "",
    batch_number: "",
    quality_status: "Accepted",
    remarks: "Auto-populated from PO PO-20260818-0002"
  };

  // Now let's execute the exact steps in /api/store/inward
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. PO lookup
    const { rows: [foundPo] } = await client.query(
      `SELECT po.id, po.vendor_id, v.name as vendor_name FROM purchase_orders po LEFT JOIN vendors v ON po.vendor_id = v.id WHERE po.po_number = $1`,
      [payload.reference_id]
    );
    console.log('Resolved PO:', foundPo);

    const resolvedPoId = foundPo ? foundPo.id : null;
    const poVendorId = foundPo ? foundPo.vendor_id : null;
    const poVendorName = foundPo ? foundPo.vendor_name : null;
    const vendorIdNum = /^\d+$/.test(String(payload.vendor_id)) ? parseInt(payload.vendor_id) : (poVendorId || null);
    const resolvedVendorName = payload.vendor_name || poVendorName || '';

    // Check GRN creation
    const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const { rows: seqRows } = await client.query(`SELECT LPAD((COUNT(*)+1)::text, 4, '0') as seq FROM grn WHERE grn_number LIKE $1`, [`GRN-${stamp}-%`]);
    const grnNum = `GRN-${stamp}-${seqRows[0].seq}`;

    const { rows: [grnHead] } = await client.query(
      `INSERT INTO grn (grn_number, date, vendor_id, po_id, gate_pass_id, vehicle_number, challan_number, invoice_number, received_by, status, remarks)
       VALUES ($1, CURRENT_DATE, $2, $3, $4, $5, $6, $7, $8, 'Received', $9) RETURNING id`,
      [grnNum, vendorIdNum, resolvedPoId || null, null, null, null, null, 1, payload.remarks || null]
    );
    console.log('Created GRN:', grnHead);

    const qty = parseFloat(payload.in_qty);
    const price = parseFloat(payload.unit_price);
    const totalVal = qty * price;

    await client.query(`
      UPDATE materials
      SET current_stock = current_stock + $1,
          bin_location = COALESCE($2, bin_location),
          unit_price = CASE WHEN $3::numeric > 0 THEN $3::numeric ELSE unit_price END
      WHERE id = $4
    `, [qty, null, price, matId]);

    const remarkFull = `[GRN ${grnNum}] | Ref: ${payload.reference_id} | Party: ${resolvedVendorName} | QC: ${payload.quality_status} | ${payload.remarks}`;

    const { rows: [ledger] } = await client.query(`
      INSERT INTO stock_ledger (
        material_id, date, transaction_type, reference_type, reference_id,
        in_qty, out_qty, balance, unit_price, value,
        batch_number, bin_location, remarks, created_by, vendor_id
      ) VALUES (
        $1, CURRENT_DATE, $2, $3, $4,
        $5, 0, $6, $7, $8,
        $9, $10, $11, $12, $13
      ) RETURNING *
    `, [
      matId, 'grn', 'GRN', grnHead.id,
      qty, 25000, price, totalVal,
      null, null, remarkFull, 1, vendorIdNum
    ]);
    console.log('Inserted Stock Ledger:', ledger.id);

    // grn_items
    await client.query(
      `INSERT INTO grn_items (grn_id, material_id, po_qty, received_qty, accepted_qty, rejected_qty, uom, unit_price, bin_location, batch_number, remarks)
       VALUES ($1, $2, $3, $4, $5, 0, $6, $7, $8, $9, $10)`,
      [grnHead.id, matId, qty, qty, qty, 'KGS', price, null, null, payload.remarks || null]
    );
    console.log('Inserted GRN Items successfully');

    // installed_assets check
    const { rows: [matRow] } = await client.query(`SELECT m.*, mc.name as cat_name FROM materials m LEFT JOIN material_categories mc ON m.category_id = mc.id WHERE m.id = $1`, [matId]);
    console.log('Material Row:', matRow.name, 'Category:', matRow.cat_name, 'is_serialized:', matRow.is_serialized);

    await client.query('ROLLBACK');
    console.log('Transaction test rolled back successfully without error in this snippet.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('ERROR CAUGHT IN TEST:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

testInwardPayload().catch(console.error);
