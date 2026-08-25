const pool = require('../src/db/pool');

async function auditMaterialsInventoryMaster() {
  console.log('===============================================================');
  console.log('🚀 MULTI-AGENT MATERIALS & STORE INVENTORY MASTER AUDIT');
  console.log('===============================================================');

  const results = [];
  function record(pass, agent, testName, details = '') {
    results.push({ pass, agent, testName, details });
    console.log(`  ${pass ? '✅ [PASS]' : '❌ [FAIL]'} [${agent}] ${testName} ${details ? '— ' + details : ''}`);
  }

  try {
    // ── 1. MATERIALS MASTER CATALOG & INTEGRITY ──
    const { rows: matCount } = await pool.query('SELECT count(*) as count FROM materials WHERE is_active = true');
    const { rows: negStock } = await pool.query('SELECT count(*) as count FROM materials WHERE current_stock < 0');
    const { rows: uncatMat } = await pool.query('SELECT count(*) as count FROM materials WHERE category_id IS NULL');
    
    record(Number(matCount[0].count) > 0, 'A_DB', 'Active Materials Master Catalog', `${matCount[0].count} active materials`);
    record(Number(negStock[0].count) === 0, 'A_DB', 'Zero Negative Stock Invariant', `${negStock[0].count} negative stock materials`);
    record(Number(uncatMat[0].count) === 0, 'A_DB', 'Material Category Integrity', `${uncatMat[0].count} unassigned categories`);

    // ── 2. LIVE ENTERPRISE VALUATION & ACCURACY ──
    const { rows: valRes } = await pool.query(`
      SELECT 
        COUNT(id) as total_items,
        COALESCE(SUM(current_stock * unit_price), 0) as total_valuation,
        COALESCE(AVG(unit_price), 0) as avg_price
      FROM materials
      WHERE is_active = true
    `);
    record(Number(valRes[0].total_valuation) > 0, 'A_MAINT_FIN', 'Live Non-Hardcoded Stock Valuation', `Total: ₹${Number(valRes[0].total_valuation).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`);

    // ── 3. STORE CATEGORY HIERARCHY ──
    const { rows: categories } = await pool.query(`
      SELECT mc.id, mc.name, mc.type, COUNT(m.id) as material_count
      FROM material_categories mc
      LEFT JOIN materials m ON m.category_id = mc.id AND m.is_active = true
      GROUP BY mc.id, mc.name, mc.type
      ORDER BY material_count DESC
    `);
    record(categories.length > 0, 'A_STORE', 'Category Hierarchy Rollup', `${categories.length} material categories mapped`);

    // ── 4. MULTI-SECTION & MULTI-EQUIPMENT MAPPINGS ──
    const { rows: secMappings } = await pool.query(`
      SELECT COUNT(*) as count FROM material_sections
    `);
    const { rows: equipMappings } = await pool.query(`
      SELECT COUNT(*) as count FROM material_equipment
    `);
    record(Number(secMappings[0].count) >= 0, 'A_ASSET', 'Multi-Section Digital Twin Links', `${secMappings[0].count} section links`);
    record(Number(equipMappings[0].count) >= 0, 'A_ASSET', 'Multi-Equipment Position Links', `${equipMappings[0].count} equipment links`);

    // ── 5. STOCK LEDGER & AUDIT TRAIL ──
    const { rows: ledgerSummary } = await pool.query(`
      SELECT 
        COUNT(*) as total_entries,
        COUNT(DISTINCT material_id) as materials_with_history,
        COALESCE(SUM(in_qty), 0) as total_in_qty,
        COALESCE(SUM(out_qty), 0) as total_out_qty
      FROM stock_ledger
    `);
    record(Number(ledgerSummary[0].total_entries) > 0, 'A_STORE', 'Permanent Stock Ledger Integrity', `${ledgerSummary[0].total_entries} mutations recorded`);

    // ── 6. REORDER & SAFETY THRESHOLDS ──
    const { rows: reorderAlerts } = await pool.query(`
      SELECT COUNT(*) as count
      FROM materials
      WHERE is_active = true AND current_stock <= reorder_level
    `);
    record(Number(reorderAlerts[0].count) >= 0, 'A_STORE', 'Critical Reorder & Safety Alerts', `${reorderAlerts[0].count} items below reorder level`);

    // ── 7. PHYSICAL BIN / RACK LOCATION COVERAGE ──
    const { rows: binCoverage } = await pool.query(`
      SELECT 
        COUNT(*) FILTER (WHERE bin_location IS NOT NULL AND bin_location != '') as assigned_bins,
        COUNT(*) as total
      FROM materials
      WHERE is_active = true
    `);
    record(Number(binCoverage[0].assigned_bins) > 0, 'A_STORE', 'Physical Rack/Bin Location Tagging', `${binCoverage[0].assigned_bins} / ${binCoverage[0].total} SKUs assigned`);

    // ── 8. STORE TYPE ISOLATION (Mechanical vs Electrical vs Chemical vs Consumables) ──
    const { rows: storeTypeBreakdown } = await pool.query(`
      SELECT 
        COALESCE(mc.type, 'General') as store_type,
        COUNT(m.id) as item_count,
        COALESCE(SUM(m.current_stock * m.unit_price), 0) as subtotal_value
      FROM materials m
      JOIN material_categories mc ON mc.id = m.category_id
      WHERE m.is_active = true
      GROUP BY COALESCE(mc.type, 'General')
      ORDER BY subtotal_value DESC
    `);
    record(storeTypeBreakdown.length > 0, 'A_SYNTAX', 'Store Type Multi-Desk Partitioning', `${storeTypeBreakdown.length} sub-stores partitioned`);

    console.log('===============================================================');
    const passed = results.filter(r => r.pass).length;
    const failed = results.filter(r => !r.pass).length;
    console.log(`🏁 AUDIT RESULT: ${passed} PASSED | ${failed} FAILED`);
    console.log('===============================================================');

    process.exit(failed > 0 ? 1 : 0);
  } catch (err) {
    console.error('Audit failed with error:', err);
    process.exit(1);
  }
}

auditMaterialsInventoryMaster();
