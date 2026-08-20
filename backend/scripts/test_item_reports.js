const pool = require('../src/db/pool');

async function runTests() {
  console.log('=== RUNNING ITEM-WISE REPORTS & WHATSAPP ENGINE TEST SUITE ===\n');

  try {
    // 1. Test Item-Wise Movement Ledger Query
    console.log('[1/4] Testing Item-Wise Movement Ledger Query...');
    const f = '2026-01-01';
    const t = '2026-12-31';

    const itemWiseRes = await pool.query(`
      WITH ledger_in_after AS (
        SELECT material_id, COALESCE(SUM(in_qty), 0) AS in_qty, COALESCE(SUM(value), 0) AS in_val
        FROM stock_ledger WHERE date >= $1 AND transaction_type IN ('grn', 'in') GROUP BY material_id
      ),
      ledger_out_after AS (
        SELECT material_id, COALESCE(SUM(out_qty), 0) AS out_qty, COALESCE(SUM(value), 0) AS out_val
        FROM stock_ledger WHERE date >= $1 AND transaction_type IN ('issue', 'out') GROUP BY material_id
      ),
      period_in AS (
        SELECT material_id, COALESCE(SUM(in_qty), 0) AS period_in_qty, COALESCE(SUM(value), 0) AS period_in_val
        FROM stock_ledger WHERE date BETWEEN $1 AND $2 AND transaction_type IN ('grn', 'in') GROUP BY material_id
      ),
      period_out AS (
        SELECT material_id, COALESCE(SUM(out_qty), 0) AS period_out_qty, COALESCE(SUM(value), 0) AS period_out_val
        FROM stock_ledger WHERE date BETWEEN $1 AND $2 AND transaction_type IN ('issue', 'out') GROUP BY material_id
      )
      SELECT m.id, m.code, m.name, m.uom,
             COALESCE(parent.name, mc.name) AS store_name,
             m.current_stock AS current_stock,
             (m.current_stock - COALESCE(lia.in_qty, 0) + COALESCE(loa.out_qty, 0)) AS opening_stock,
             COALESCE(pin.period_in_qty, 0) AS inward_qty,
             COALESCE(pin.period_in_val, 0) AS inward_val,
             COALESCE(pout.period_out_qty, 0) AS outward_qty,
             COALESCE(pout.period_out_val, 0) AS outward_val,
             ((m.current_stock - COALESCE(lia.in_qty, 0) + COALESCE(loa.out_qty, 0)) + COALESCE(pin.period_in_qty, 0) - COALESCE(pout.period_out_qty, 0)) AS closing_stock,
             m.unit_price,
             CASE
               WHEN m.current_stock <= (m.reorder_level * 0.5) THEN 'Critical Shortage'
               WHEN m.current_stock <= m.reorder_level THEN 'Reorder Required'
               ELSE 'Optimal'
             END AS stock_status
      FROM materials m
      JOIN material_categories mc ON mc.id = m.category_id
      LEFT JOIN material_categories parent ON parent.id = mc.parent_id
      LEFT JOIN ledger_in_after lia ON lia.material_id = m.id
      LEFT JOIN ledger_out_after loa ON loa.material_id = m.id
      LEFT JOIN period_in pin ON pin.material_id = m.id
      LEFT JOIN period_out pout ON pout.material_id = m.id
      WHERE m.is_active = true
      LIMIT 5
    `, [f, t]);

    console.log(`✓ Item-Wise ledger returned ${itemWiseRes.rows.length} sample items.`);
    if (itemWiseRes.rows.length > 0) {
      console.log('  Sample item:', {
        code: itemWiseRes.rows[0].code,
        name: itemWiseRes.rows[0].name,
        opening: itemWiseRes.rows[0].opening_stock,
        inward: itemWiseRes.rows[0].inward_qty,
        outward: itemWiseRes.rows[0].outward_qty,
        closing: itemWiseRes.rows[0].closing_stock,
        status: itemWiseRes.rows[0].stock_status
      });
    }

    // 2. Test Item Individual Transaction Audit Timeline
    console.log('\n[2/4] Testing Item Transaction Audit Timeline Query...');
    if (itemWiseRes.rows.length > 0) {
      const sampleMatId = itemWiseRes.rows[0].id;
      const ledgerRes = await pool.query(`
        SELECT sl.id, sl.date, sl.transaction_type, sl.in_qty, sl.out_qty, sl.balance AS balance_qty,
               COALESCE(v.name, si_dept.name, ind_dept.name, 'Mill Store') AS party_name,
               COALESCE(po.po_number, ind.indent_number, g.grn_number, ('VOUCHER-' || sl.id)) AS voucher_number
        FROM stock_ledger sl
        LEFT JOIN vendors v ON sl.vendor_id = v.id
        LEFT JOIN store_issues si ON sl.reference_type = 'ISSUE' AND sl.reference_id = si.id
        LEFT JOIN indents ind ON sl.reference_type = 'INDENT' AND sl.reference_id = ind.id
        LEFT JOIN departments si_dept ON si.department_id = si_dept.id
        LEFT JOIN departments ind_dept ON ind.department_id = ind_dept.id
        LEFT JOIN purchase_orders po ON sl.reference_type = 'PO' AND sl.reference_id = po.id
        LEFT JOIN grn g ON sl.reference_type = 'GRN' AND sl.reference_id = g.id
        WHERE sl.material_id = $1
        ORDER BY sl.date DESC, sl.id DESC
        LIMIT 5
      `, [sampleMatId]);
      console.log(`✓ Transaction timeline returned ${ledgerRes.rows.length} vouchers for item ID ${sampleMatId}.`);
    }

    // 3. Test Item Consumption by Department Matrix
    console.log('\n[3/4] Testing Item Consumption Matrix by Department Query...');
    const consumptionRes = await pool.query(`
      SELECT COALESCE(si_dept.name, ind_dept.name, 'General Mill Operations') AS dept_name,
             m.code AS mat_code, m.name AS mat_name,
             COUNT(sl.id) AS issue_count,
             COALESCE(SUM(sl.out_qty), 0) AS total_qty_consumed,
             COALESCE(SUM(sl.value), 0) AS total_consumption_value
      FROM stock_ledger sl
      JOIN materials m ON sl.material_id = m.id
      JOIN material_categories mc ON m.category_id = mc.id
      LEFT JOIN store_issues si ON sl.reference_type = 'ISSUE' AND sl.reference_id = si.id
      LEFT JOIN indents ind ON sl.reference_type = 'INDENT' AND sl.reference_id = ind.id
      LEFT JOIN departments si_dept ON si.department_id = si_dept.id
      LEFT JOIN departments ind_dept ON ind.department_id = ind_dept.id
      WHERE sl.transaction_type IN ('issue', 'out') AND sl.out_qty > 0
      GROUP BY si_dept.name, ind_dept.name, m.code, m.name
      LIMIT 5
    `);
    console.log(`✓ Consumption matrix returned ${consumptionRes.rows.length} rows.`);

    // 4. Test Top Item Issues & Critical Stock Alerts for EOD
    console.log('\n[4/4] Testing EOD Top Item Issues & Critical Shortage Queries...');
    const topIssuesRes = await pool.query(`
      SELECT sl.id, sl.out_qty, sl.value, m.code AS mat_code, m.name AS mat_name, m.uom
      FROM stock_ledger sl
      JOIN materials m ON sl.material_id = m.id
      WHERE sl.transaction_type IN ('issue', 'out') AND sl.out_qty > 0
      ORDER BY sl.value DESC
      LIMIT 5
    `);
    console.log(`✓ Top high-value issues queried: ${topIssuesRes.rows.length} items.`);

    const criticalStockRes = await pool.query(`
      SELECT m.id, m.code, m.name, m.current_stock, m.reorder_level
      FROM materials m
      WHERE m.is_active = true AND m.current_stock <= m.reorder_level
      LIMIT 5
    `);
    console.log(`✓ Critical shortage alerts queried: ${criticalStockRes.rows.length} items below reorder level.`);

    console.log('\n=== ALL ITEM-WISE REPORTS & EOD DATA QUERIES PASSED WITH 100% SUCCESS ===');
    process.exit(0);
  } catch (err) {
    console.error('❌ Test suite failed:', err);
    process.exit(1);
  }
}

runTests();
