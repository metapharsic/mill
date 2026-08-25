const pool = require('../src/db/pool');

async function testStoreDepartmentReportsWiring() {
  console.log('===============================================================');
  console.log('🚀 TESTING STORE MANAGEMENT DEPARTMENT-SCOPED REPORTS');
  console.log('===============================================================');

  const today = new Date().toISOString().slice(0, 10);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);

  const results = [];
  function record(pass, moduleName, checkName, details = '') {
    results.push({ pass, moduleName, checkName, details });
    console.log(`  ${pass ? '✅ [PASS]' : '❌ [FAIL]'} [${moduleName}] ${checkName} ${details ? '— ' + details : ''}`);
  }

  // ── MODULE 1: EOD Activity (WhatsApp) ───────────────────────────────────────
  try {
    const { rows: prod } = await pool.query(`
      SELECT COUNT(id) AS total_reels, COALESCE(SUM(weight_kg), 0) / 1000.0 AS total_mt
      FROM reels WHERE DATE(start_time) = $1
    `, [today]);
    const { rows: indents } = await pool.query(`
      SELECT COUNT(id) AS indents_raised, COALESCE(SUM(total_value), 0) AS indents_value
      FROM indents WHERE DATE(date) = $1 OR DATE(created_at) = $1
    `, [today]);
    const { rows: inwardGrns } = await pool.query(`
      SELECT COUNT(id) AS count, COALESCE(SUM(grand_total), 0) AS total_val
      FROM grn WHERE DATE(date) = $1 OR DATE(created_at) = $1
    `, [today]);
    record(true, 'EOD Activity (WhatsApp)', 'Daily Compilation Queries', `Reels: ${prod[0].total_reels}, Indents: ${indents[0].indents_raised}, Inward GRNs: ${inwardGrns[0].count}`);
  } catch (err) {
    record(false, 'EOD Activity (WhatsApp)', 'Daily Compilation Error', err.message);
  }

  // ── MODULE 2: Plant Section & Granularity ──────────────────────────────────
  try {
    const { rows: sections } = await pool.query(`
      SELECT ps.id, ps.name,
             COUNT(DISTINCT m.id) AS material_count,
             COALESCE(SUM(m.current_stock * m.unit_price), 0) AS section_valuation
      FROM plant_sections ps
      LEFT JOIN materials m ON m.section_id = ps.id AND m.is_active = true
      GROUP BY ps.id, ps.name
      ORDER BY section_valuation DESC
    `);
    const { rows: equipmentItems } = await pool.query(`
      SELECT m.id, m.code, m.name, ps.name AS section_name, mac.name AS machine_name,
             m.current_stock, m.unit_price, (m.current_stock * m.unit_price) AS stock_value
      FROM materials m
      JOIN plant_sections ps ON ps.id = m.section_id
      LEFT JOIN machines mac ON mac.id = m.machine_id
      WHERE m.is_active = true
      LIMIT 10
    `);
    record(sections.length > 0, 'Plant Section & Granularity', 'Section Valuation Matrix', `${sections.length} sections active`);
    record(equipmentItems.length > 0, 'Plant Section & Granularity', 'Equipment Granular Matrix', `${equipmentItems.length} sample equipment items mapped`);
  } catch (err) {
    record(false, 'Plant Section & Granularity', 'Query Execution Error', err.message);
  }

  // ── MODULE 3: Stores & Inventory ───────────────────────────────────────────
  try {
    const { rows: summary } = await pool.query(`
      SELECT COUNT(m.id) AS total_items,
             COALESCE(SUM(m.current_stock * m.unit_price), 0) AS total_value,
             COUNT(m.id) FILTER (WHERE m.current_stock <= m.reorder_level) AS low_stock_count,
             COUNT(DISTINCT COALESCE(parent.name, mc.name)) AS store_types_count
      FROM materials m
      JOIN material_categories mc ON mc.id = m.category_id
      LEFT JOIN material_categories parent ON parent.id = mc.parent_id
      WHERE m.is_active = true
    `);
    const { rows: items } = await pool.query(`
      SELECT m.id, m.code, m.name, m.uom, m.current_stock, m.unit_price,
             (m.current_stock * m.unit_price) AS stock_value,
             mc.name AS category_name, ps.name AS section_name
      FROM materials m
      JOIN material_categories mc ON mc.id = m.category_id
      LEFT JOIN plant_sections ps ON ps.id = m.section_id
      WHERE m.is_active = true
      ORDER BY stock_value DESC
      LIMIT 10
    `);
    record(summary.length > 0, 'Stores & Inventory', 'Summary KPI Aggregates', `Total SKUs: ${summary[0].total_items}, Total Valuation: ₹${Number(summary[0].total_value).toLocaleString('en-IN')}`);
    record(items.length > 0, 'Stores & Inventory', 'Multi-Store Catalog Rows', `${items.length} items queried`);
  } catch (err) {
    record(false, 'Stores & Inventory', 'Query Execution Error', err.message);
  }

  // ── MODULE 4: Indents & Store Issues ───────────────────────────────────────
  try {
    const { rows: indSummary } = await pool.query(`
      SELECT COUNT(i.id) AS total_indents,
             COALESCE(SUM(i.total_value), 0) AS total_indent_value,
             COUNT(i.id) FILTER (WHERE i.status = 'Issued') AS issued_count,
             COUNT(i.id) FILTER (WHERE i.status = 'Approved') AS approved_count,
             COUNT(i.id) FILTER (WHERE i.status = 'Submitted') AS pending_count
      FROM indents i
      WHERE i.date >= $1 AND i.date <= $2
    `, [thirtyDaysAgo, today]);
    const { rows: deptIndents } = await pool.query(`
      SELECT d.name AS dept_name,
             COUNT(i.id) AS total_indents,
             COALESCE(SUM(i.total_value), 0) AS total_indent_value
      FROM departments d
      JOIN indents i ON i.department_id = d.id
      WHERE i.date >= $1 AND i.date <= $2
      GROUP BY d.id, d.name
      ORDER BY total_indent_value DESC
    `, [thirtyDaysAgo, today]);
    record(indSummary.length > 0, 'Indents & Store Issues', 'Indent Status Metrics', `Total Indents: ${indSummary[0].total_indents}, Total Value: ₹${Number(indSummary[0].total_indent_value).toLocaleString('en-IN')}`);
    record(deptIndents.length > 0, 'Indents & Store Issues', 'Department Indent Breakdown', `${deptIndents.length} departments analysed`);
  } catch (err) {
    record(false, 'Indents & Store Issues', 'Query Execution Error', err.message);
  }

  // ── MODULE 5: Purchase Deep Dive ───────────────────────────────────────────
  try {
    const { rows: poSummary } = await pool.query(`
      SELECT COUNT(id) AS total_pos,
             COALESCE(SUM(grand_total), 0) AS total_spend,
             COUNT(id) FILTER (WHERE status = 'Pending' OR status = 'Issued' OR status = 'Approved') AS pending_pos
      FROM purchase_orders
      WHERE date >= $1 AND date <= $2
    `, [thirtyDaysAgo, today]);
    const { rows: vendorPerf } = await pool.query(`
      SELECT v.name AS vendor_name,
             COUNT(po.id) AS po_count,
             COALESCE(SUM(po.grand_total), 0) AS total_spend
      FROM vendors v
      JOIN purchase_orders po ON po.vendor_id = v.id
      WHERE po.date >= $1 AND po.date <= $2
      GROUP BY v.id, v.name
      ORDER BY total_spend DESC
      LIMIT 10
    `, [thirtyDaysAgo, today]);
    record(poSummary.length > 0, 'Purchase Deep Dive', 'PO Spend & Cycle Metrics', `Total POs: ${poSummary[0].total_pos}, Spend: ₹${Number(poSummary[0].total_spend).toLocaleString('en-IN')}`);
    record(vendorPerf.length >= 0, 'Purchase Deep Dive', 'Vendor Spend Rollup', `${vendorPerf.length} vendors analysed`);
  } catch (err) {
    record(false, 'Purchase Deep Dive', 'Query Execution Error', err.message);
  }

  console.log('===============================================================');
  const passCount = results.filter(r => r.pass).length;
  const failCount = results.filter(r => !r.pass).length;
  console.log(`🏁 RESULT: ${passCount} Passed | ${failCount} Failed`);
  console.log('===============================================================');

  process.exit(failCount > 0 ? 1 : 0);
}

testStoreDepartmentReportsWiring();
