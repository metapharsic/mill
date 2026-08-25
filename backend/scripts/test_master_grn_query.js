const pool = require('../src/db/pool');

async function test() {
  const { rows } = await pool.query(`
    SELECT g.id, g.grn_number, g.date, g.status, g.vehicle_number, g.challan_number,
           g.invoice_number, g.order_number, g.order_date, g.remarks, g.created_at,
           COALESCE(g.total_taxable, (SELECT SUM(taxable_amount) FROM grn_items gi WHERE gi.grn_id = g.id), 0) AS total_taxable,
           COALESCE(g.total_gst, (SELECT SUM(cgst_amount + sgst_amount + igst_amount) FROM grn_items gi WHERE gi.grn_id = g.id), 0) AS total_gst,
           COALESCE(g.grand_total, (SELECT SUM(total_amount) FROM grn_items gi WHERE gi.grn_id = g.id), 0) AS grand_total,
           v.id AS "vendorId", v.name AS "vendorName", v.code AS "vendorCode",
           v.gstin AS "vendorGstin", v.state AS "vendorState", v.city AS "vendorCity",
           v.address AS "vendorAddress", v.mobile AS "vendorMobile",
           u.name AS "createdByName",
           COALESCE((SELECT COUNT(*) FROM grn_items gi WHERE gi.grn_id = g.id), 0)::int AS "itemCount",
           COALESCE((SELECT SUM(gi.received_qty) FROM grn_items gi WHERE gi.grn_id = g.id), 0)::numeric(12,3) AS "totalQty",
           COALESCE(
             (SELECT json_agg(
               json_build_object(
                 'id', gi.id,
                 'material_id', gi.material_id,
                 'materialCode', m.code,
                 'materialName', m.name,
                 'uom', gi.uom,
                 'hsnCode', m.hsn_code,
                 'categoryName', mc.name,
                 'received_qty', gi.received_qty,
                 'unit_price', gi.unit_price,
                 'discount_pct', gi.discount_pct,
                 'taxable_amount', gi.taxable_amount,
                 'gst_pct', gi.gst_pct,
                 'cgst_amount', gi.cgst_amount,
                 'sgst_amount', gi.sgst_amount,
                 'igst_amount', gi.igst_amount,
                 'total_amount', gi.total_amount,
                 'batch_number', gi.batch_number,
                 'bin_location', gi.bin_location,
                 'remarks', gi.remarks
               ) ORDER BY gi.id ASC
             ) FROM grn_items gi
               JOIN materials m ON gi.material_id = m.id
               LEFT JOIN material_categories mc ON m.category_id = mc.id
               WHERE gi.grn_id = g.id
             ), '[]'::json
           ) AS items
    FROM grn g
    LEFT JOIN vendors v ON g.vendor_id = v.id
    LEFT JOIN users u ON g.received_by = u.id
    ORDER BY g.id DESC
    LIMIT 10
  `);

  console.log(`Fetched ${rows.length} master GRNs`);
  rows.forEach(r => {
    console.log(`GRN ${r.grn_number} | Date: ${r.date?.toISOString().slice(0,10)} | Vendor: ${r.vendorName} | Invoice: ${r.invoice_number} | Items: ${r.itemCount} | Qty: ${r.totalQty} | Taxable: ₹${r.total_taxable} | GST: ₹${r.total_gst} | Grand Total: ₹${r.grand_total}`);
  });

  const grn34 = rows.find(r => r.grn_number === '202608-34');
  if (grn34) {
    console.log('\n--- Details for 202608-34 ---');
    console.log(`Items in 202608-34: ${grn34.items.length}`);
    console.table(grn34.items.map(it => ({ code: it.materialCode, name: it.materialName, qty: it.received_qty, price: it.unit_price, taxable: it.taxable_amount, gst_pct: it.gst_pct, total: it.total_amount })));
  }

  await pool.end();
}

test();
