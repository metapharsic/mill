const pool = require('../src/db/pool');

async function runStoreReportsAudit() {
  console.log('===============================================================');
  console.log('🚀 MULTI-AGENT STORE REPORTS & ANALYTICS AUDIT');
  console.log('===============================================================');

  const results = [];
  function record(pass, agent, testName, detail = '') {
    results.push({ pass, agent, testName, detail });
    console.log(`  ${pass ? '✅ [PASS]' : '❌ [FAIL]'} [${agent}] ${testName} ${detail ? '(' + detail + ')' : ''}`);
  }

  try {
    // 1. Department-wise Consumption Aggregates
    const deptSummary = await pool.query(`
      SELECT
        d.id AS "departmentId",
        d.name AS "departmentName",
        COUNT(sl.id) AS "totalIssues",
        COALESCE(SUM(sl.out_qty), 0) AS "totalQuantity",
        COALESCE(SUM(sl.value), 0) AS "totalValuation"
      FROM departments d
      LEFT JOIN stock_ledger sl ON (
        sl.remarks ILIKE '%' || d.name || '%'
        AND sl.transaction_type IN ('issue', 'out', 'return_to_vendor', 'transfer')
      )
      GROUP BY d.id, d.name
      ORDER BY "totalValuation" DESC
    `);
    record(deptSummary.rowCount > 0, 'A_STORE_REP', 'Department-wise Consumption Matrix', `${deptSummary.rowCount} depts analyzed`);

    // 2. ABC Material Valuation Classification
    const abcSummary = await pool.query(`
      SELECT 
        CASE 
          WHEN (current_stock * unit_price) >= 50000 OR unit_price >= 25000 THEN 'A (High Value)'
          WHEN (current_stock * unit_price) >= 10000 OR unit_price >= 5000 THEN 'B (Medium Value)'
          ELSE 'C (Standard / Bulk)'
        END AS "abcClass",
        COUNT(id) AS "itemCount",
        COALESCE(SUM(current_stock * unit_price), 0) AS "totalValuation"
      FROM materials
      WHERE is_active = true
      GROUP BY 1
    `);
    record(abcSummary.rowCount > 0, 'A_STORE_REP', 'ABC Material Classification Analytics', `${abcSummary.rowCount} ABC tiers calculated`);

    // 3. Item-Wise Consumption & Turnover Rate
    const itemWise = await pool.query(`
      SELECT
        m.id, m.code, m.name, m.current_stock, m.unit_price,
        COUNT(sl.id) FILTER (WHERE sl.transaction_type IN ('issue','out','return_to_vendor','transfer')) AS "issueCount",
        COALESCE(SUM(sl.value) FILTER (WHERE sl.transaction_type IN ('issue','out','return_to_vendor','transfer')), 0) AS "totalIssuedValue"
      FROM materials m
      LEFT JOIN stock_ledger sl ON sl.material_id = m.id
      WHERE m.is_active = true
      GROUP BY m.id, m.code, m.name, m.current_stock, m.unit_price
      ORDER BY "totalIssuedValue" DESC
      LIMIT 10
    `);
    record(itemWise.rowCount > 0, 'A_STORE_REP', 'Item-Wise Consumption Drilldown', `${itemWise.rowCount} items retrieved`);

    // 4. Category-Wise Hierarchy Rollup
    const catWise = await pool.query(`
      WITH mat_agg AS (
        SELECT category_id,
               COUNT(*) AS item_count,
               COALESCE(SUM(current_stock * unit_price), 0) AS stock_value
        FROM materials
        WHERE is_active = true
        GROUP BY category_id
      )
      SELECT
        mc.id, mc.name,
        COALESCE(ma.item_count, 0) AS "itemCount",
        COALESCE(ma.stock_value, 0) AS "stockValue"
      FROM material_categories mc
      LEFT JOIN mat_agg ma ON ma.category_id = mc.id
      ORDER BY "stockValue" DESC
    `);
    record(catWise.rowCount > 0, 'A_STORE_REP', 'Category-Wise Hierarchy & Store Valuation', `${catWise.rowCount} categories computed`);

    // 5. Physical Bin & Rack Location
    const binData = await pool.query(`
      SELECT
        COALESCE(m.bin_location, 'UNASSIGNED') AS "binLocation",
        COUNT(m.id) AS "itemCount",
        COALESCE(SUM(m.current_stock * m.unit_price), 0) AS "totalValue"
      FROM materials m
      WHERE m.is_active = true
      GROUP BY COALESCE(m.bin_location, 'UNASSIGNED')
      ORDER BY "totalValue" DESC
    `);
    record(binData.rowCount > 0, 'A_STORE_REP', 'Physical Bin/Rack Location Auditing', `${binData.rowCount} bin zones calculated`);

    // 6. Vendor Performance & Inward Value
    const vendorData = await pool.query(`
      SELECT
        v.id, v.name,
        COUNT(DISTINCT g.id) AS "grnCount",
        COALESCE(SUM(gi.accepted_qty * gi.unit_price), 0) AS "totalInwardValue"
      FROM vendors v
      LEFT JOIN grn g ON g.vendor_id = v.id
      LEFT JOIN grn_items gi ON gi.grn_id = g.id
      GROUP BY v.id, v.name
      HAVING COUNT(DISTINCT g.id) > 0
      ORDER BY "totalInwardValue" DESC
    `);
    record(vendorData.rowCount > 0, 'A_STORE_REP', 'Vendor-Wise Intake & Performance Analytics', `${vendorData.rowCount} active vendors tracked`);

    // 7. Fast / Slow / Dead Stock Movement Classification
    const movementData = await pool.query(`
      SELECT
        m.id, m.code, m.name, m.current_stock, (m.current_stock * m.unit_price) AS "stockValue",
        CASE
          WHEN COUNT(sl.id) FILTER (WHERE sl.transaction_type IN ('issue','out','return_to_vendor','transfer')) = 0 THEN 'DEAD'
          WHEN COUNT(sl.id) FILTER (WHERE sl.transaction_type IN ('issue','out','return_to_vendor','transfer')) >= 5 THEN 'FAST'
          ELSE 'SLOW'
        END AS "movementClass"
      FROM materials m
      LEFT JOIN stock_ledger sl ON sl.material_id = m.id AND sl.date >= (CURRENT_DATE - INTERVAL '90 days')
      WHERE m.is_active = true
      GROUP BY m.id, m.code, m.name, m.current_stock, m.unit_price
    `);
    const deadCount = movementData.rows.filter(r => r.movementClass === 'DEAD').length;
    const fastCount = movementData.rows.filter(r => r.movementClass === 'FAST').length;
    const slowCount = movementData.rows.filter(r => r.movementClass === 'SLOW').length;
    record(movementData.rowCount > 0, 'A_STORE_REP', 'Fast/Slow/Dead Stock Velocity Analysis', `Dead: ${deadCount}, Slow: ${slowCount}, Fast: ${fastCount}`);

    // 8. Plant Section & Granular Equipment Inventory
    const plantSections = await pool.query(`
      SELECT ps.id, ps.name, COUNT(m.id) AS "materialCount", COALESCE(SUM(m.current_stock * m.unit_price), 0) AS "sectionValuation"
      FROM plant_sections ps
      LEFT JOIN materials m ON m.section_id = ps.id AND m.is_active = true
      GROUP BY ps.id, ps.name
      ORDER BY "sectionValuation" DESC
    `);
    record(plantSections.rowCount > 0, 'A_ASSET', 'Plant Section Inventory & Equipment Granularity', `${plantSections.rowCount} active sections verified`);

    console.log('===============================================================');
    const passed = results.filter(r => r.pass).length;
    const failed = results.filter(r => !r.pass).length;
    console.log(`🏁 STORE REPORTS AUDIT: ${passed} PASSED, ${failed} FAILED`);
    console.log('===============================================================');

    process.exit(failed > 0 ? 1 : 0);
  } catch (err) {
    console.error('Audit failed with error:', err);
    process.exit(1);
  }
}

runStoreReportsAudit();
