const pool = require('../src/db/pool');

async function recalculate() {
  console.log('Recalculating all legacy grn_items and grn headers...');
  
  const res1 = await pool.query(`
    UPDATE grn_items
    SET taxable_amount = ROUND((unit_price * received_qty * (1 - COALESCE(discount_pct, 0)/100.0))::numeric, 2),
        cgst_amount = CASE WHEN COALESCE(igst_amount, 0) = 0 THEN ROUND(((unit_price * received_qty * (1 - COALESCE(discount_pct, 0)/100.0)) * (COALESCE(gst_pct, 18) / 200.0))::numeric, 2) ELSE 0 END,
        sgst_amount = CASE WHEN COALESCE(igst_amount, 0) = 0 THEN ROUND(((unit_price * received_qty * (1 - COALESCE(discount_pct, 0)/100.0)) * (COALESCE(gst_pct, 18) / 200.0))::numeric, 2) ELSE 0 END,
        igst_amount = CASE WHEN COALESCE(igst_amount, 0) > 0 THEN ROUND(((unit_price * received_qty * (1 - COALESCE(discount_pct, 0)/100.0)) * (COALESCE(gst_pct, 18) / 100.0))::numeric, 2) ELSE 0 END,
        total_amount = ROUND(((unit_price * received_qty * (1 - COALESCE(discount_pct, 0)/100.0)) * (1 + COALESCE(gst_pct, 18) / 100.0))::numeric, 2)
    WHERE unit_price > 0 AND (taxable_amount = 0 OR total_amount = 0);
  `);
  console.log(`Updated ${res1.rowCount} grn_items lines.`);

  const res2 = await pool.query(`
    UPDATE grn g
    SET total_taxable = COALESCE(sub.sum_taxable, 0),
        total_gst = COALESCE(sub.sum_gst, 0),
        grand_total = COALESCE(sub.sum_total, 0)
    FROM (
      SELECT grn_id,
             SUM(taxable_amount) as sum_taxable,
             SUM(cgst_amount + sgst_amount + igst_amount) as sum_gst,
             SUM(total_amount) as sum_total
      FROM grn_items
      GROUP BY grn_id
    ) sub
    WHERE g.id = sub.grn_id AND (g.grand_total = 0 OR g.total_taxable = 0) AND sub.sum_total > 0;
  `);
  console.log(`Updated ${res2.rowCount} grn header records.`);

  process.exit(0);
}

recalculate().catch(e => {
  console.error(e);
  process.exit(1);
});
