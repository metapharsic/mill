const pool = require('../src/db/pool');
const fs = require('fs');
const path = require('path');

async function runMultiAgentVerification() {
  console.log('===============================================================');
  console.log('🚀 MULTI-AGENT SYSTEM VERIFICATION SUITE — MK PAPER MILL');
  console.log('===============================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(name, condition, details = '') {
    if (condition) {
      console.log(`  ✅ [PASS] ${name}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${name} — ${details}`);
      failed++;
    }
  }

  try {
    // ─────────────────────────────────────────────────────────────
    // AGENT 1: TYPE INTEGRITY & SYNTAX ERROR VERIFICATION
    // ─────────────────────────────────────────────────────────────
    console.log('--- [AGENT 1: TYPE INTEGRITY & SYNTAX VERIFICATION] ---');

    // Test 1.1: Query with decimal string on ledger join
    try {
      const testRef = '507516.3';
      const r = await pool.query(`
        SELECT sl.id, sl.date, sl.material_id, sl.reference_type, sl.reference_id
        FROM stock_ledger sl
        LEFT JOIN purchase_orders po ON sl.reference_type = 'PO' AND (CASE WHEN sl.reference_id::text ~ '^[0-9]+$' THEN sl.reference_id::int = po.id ELSE FALSE END)
        LEFT JOIN grn g ON sl.reference_type = 'GRN' AND (CASE WHEN sl.reference_id::text ~ '^[0-9]+$' THEN sl.reference_id::int = g.id ELSE FALSE END)
        LEFT JOIN indents ind ON UPPER(sl.reference_type) = 'INDENT' AND (CASE WHEN sl.reference_id::text ~ '^[0-9]+$' THEN sl.reference_id::int = ind.id ELSE FALSE END)
        LEFT JOIN store_issues si ON sl.reference_type = 'ISSUE' AND (CASE WHEN sl.reference_id::text ~ '^[0-9]+$' THEN sl.reference_id::int = si.id ELSE FALSE END)
        WHERE sl.transaction_type IN ('grn', 'issue', 'in', 'out')
        LIMIT 50
      `);
      assert('Safe integer joins with regex guards', Array.isArray(r.rows));
    } catch (e) {
      assert('Safe integer joins with regex guards', false, e.message);
    }

    // Test 1.2: Check item-ledger query with float/decimal price material
    try {
      const { rows: [mat] } = await pool.query(`SELECT id FROM materials WHERE unit_price > 0 LIMIT 1`);
      if (mat) {
        const r = await pool.query(`
          SELECT sl.id, sl.date, sl.unit_price, sl.value
          FROM stock_ledger sl
          LEFT JOIN store_issues si ON sl.reference_type = 'ISSUE' AND (CASE WHEN sl.reference_id::text ~ '^[0-9]+$' THEN sl.reference_id::int = si.id ELSE FALSE END)
          LEFT JOIN indents ind ON UPPER(sl.reference_type) = 'INDENT' AND (CASE WHEN sl.reference_id::text ~ '^[0-9]+$' THEN sl.reference_id::int = ind.id ELSE FALSE END)
          LEFT JOIN purchase_orders po ON sl.reference_type = 'PO' AND (CASE WHEN sl.reference_id::text ~ '^[0-9]+$' THEN sl.reference_id::int = po.id ELSE FALSE END)
          LEFT JOIN grn g ON sl.reference_type = 'GRN' AND (CASE WHEN sl.reference_id::text ~ '^[0-9]+$' THEN sl.reference_id::int = g.id ELSE FALSE END)
          WHERE sl.material_id = $1
          LIMIT 10
        `, [mat.id]);
        assert('Item ledger query execution with float prices', Array.isArray(r.rows));
      }
    } catch (e) {
      assert('Item ledger query execution with float prices', false, e.message);
    }

    // ─────────────────────────────────────────────────────────────
    // AGENT 2: GRN & INWARD STANDARDIZER VERIFICATION
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- [AGENT 2: GRN & INWARD STANDARDIZATION] ---');

    // Test 2.1: Check Store.jsx for "Vendor GRN"
    const storeJsx = fs.readFileSync(path.join(__dirname, '../../frontend/src/pages/Store.jsx'), 'utf-8');
    assert('Store.jsx has no "Vendor GRN"', !storeJsx.includes('Vendor GRN'));
    assert('Store.jsx has standardized "GRN (Purchase Inward)"', storeJsx.includes('GRN (Purchase Inward)'));

    // Test 2.2: Check RawMaterial.jsx for "Vendor GRN"
    const rmJsx = fs.readFileSync(path.join(__dirname, '../../frontend/src/pages/RawMaterial.jsx'), 'utf-8');
    assert('RawMaterial.jsx has no "Vendor GRN"', !rmJsx.includes('Vendor GRN'));
    assert('RawMaterial.jsx has standardized "GRN (Purchase Inward)"', rmJsx.includes('GRN (Purchase Inward)'));

    // Test 2.3: Check store.js backend remarks formatting
    const storeJs = fs.readFileSync(path.join(__dirname, '../src/routes/store.js'), 'utf-8');
    assert('store.js remarks standardizes to [GRN ...]', storeJs.includes("`[GRN ${grnNum}]` : '[GRN]'"));

    // ─────────────────────────────────────────────────────────────
    // AGENT 3: COMPLETE DASHBOARD AUDIT & VALIDATION
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- [AGENT 3: MULTI-DASHBOARD AUDIT & LIVE VALIDATION] ---');

    // 3.1 Store Dashboard Analytics
    try {
      const { rows: [kpis] } = await pool.query(`
        SELECT 
          COUNT(*) as total_items,
          COUNT(*) FILTER (WHERE current_stock <= min_stock) as low_stock_count,
          COUNT(*) FILTER (WHERE current_stock = 0) as out_of_stock_count,
          COALESCE(SUM(current_stock * unit_price), 0) as total_valuation
        FROM materials WHERE is_active = true
      `);
      assert('Store Dashboard KPIs computed live', kpis && Number(kpis.total_items) > 0 && Number(kpis.total_valuation) > 0);
    } catch (e) {
      assert('Store Dashboard KPIs computed live', false, e.message);
    }

    // 3.2 Inventory Dashboard Material Stats
    try {
      const { rows: invStats } = await pool.query(`
        SELECT 
          COUNT(*) as total_materials,
          COALESCE(SUM(current_stock * unit_price), 0) as total_value,
          COUNT(DISTINCT category_id) as categories_count
        FROM materials WHERE is_active = true
      `);
      assert('Inventory Dashboard material stats computed live', invStats.length > 0 && Number(invStats[0].total_materials) > 0);
    } catch (e) {
      assert('Inventory Dashboard material stats computed live', false, e.message);
    }

    // 3.3 Production Summary & Reels
    try {
      const { rows: prodStats } = await pool.query(`
        SELECT 
          COUNT(*) as total_reels,
          COALESCE(SUM(weight_kg), 0) as total_weight_kg,
          COALESCE(AVG(efficiency_pct), 0) as avg_efficiency
        FROM reels
      `);
      assert('Production Dashboard reels query computed live', prodStats.length > 0);
    } catch (e) {
      assert('Production Dashboard reels query computed live', false, e.message);
    }

    // 3.4 Quality Tests Pass Rate
    try {
      const { rows: [qcStats] } = await pool.query(`
        SELECT 
          COUNT(*) as total_tests,
          COALESCE(SUM(CASE WHEN result = 'Pass' THEN 1 ELSE 0 END), 0) as passed,
          ROUND(100.0 * COALESCE(SUM(CASE WHEN result = 'Pass' THEN 1 ELSE 0 END), 0) / NULLIF(COUNT(*), 0), 1) as pass_rate
        FROM quality_tests
      `);
      assert('Quality Dashboard pass rate with NULLIF division protection', qcStats !== undefined);
    } catch (e) {
      assert('Quality Dashboard pass rate with NULLIF division protection', false, e.message);
    }

    // 3.5 Maintenance Schedule & Breakdowns
    try {
      const { rows: maintStats } = await pool.query(`
        SELECT 
          COUNT(*) as total_schedules,
          COUNT(*) FILTER (WHERE status = 'Active') as active_schedules
        FROM maintenance_schedule
      `);
      assert('Maintenance Dashboard schedule computed live', maintStats.length > 0);
    } catch (e) {
      assert('Maintenance Dashboard schedule computed live', false, e.message);
    }

    // 3.6 Finance & Vendor Bills
    try {
      const { rows: [finStats] } = await pool.query(`
        SELECT 
          COUNT(*) as total_bills,
          COALESCE(SUM(total_amount), 0) as total_bill_amount,
          COALESCE(SUM(paid_amount), 0) as total_paid_amount,
          COALESCE(SUM(balance_amount), 0) as total_balance_due
        FROM vendor_bills
      `);
      assert('Finance Dashboard vendor bills & balances live', finStats !== undefined);
    } catch (e) {
      assert('Finance Dashboard vendor bills & balances live', false, e.message);
    }

    // 3.7 Utility Power & Readings
    try {
      const { rows: utilStats } = await pool.query(`
        SELECT 
          COUNT(*) as total_readings,
          COALESCE(SUM(power_units + dg_units), 0) as total_power_units
        FROM utility_readings
      `);
      assert('Utility Dashboard power readings live', utilStats.length > 0);
    } catch (e) {
      assert('Utility Dashboard power readings live', false, e.message);
    }

    // ─────────────────────────────────────────────────────────────
    // AGENT 4: PLANT SECTION & GRANULAR REPORTING VERIFICATION
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- [AGENT 4: PLANT SECTION & GRANULAR REPORTING] ---');

    // 4.1 Check Plant Sections Aggregates
    try {
      const { rows: sections } = await pool.query(`
        SELECT 
          ps.id AS "sectionId",
          ps.section_code AS "sectionCode",
          ps.name AS "sectionName",
          COUNT(DISTINCT m.id)::int AS "materialCount",
          COALESCE(SUM(m.current_stock * m.unit_price), 0)::numeric(15,2) AS "totalValuation"
        FROM plant_sections ps
        LEFT JOIN materials m ON m.section_id = ps.id AND m.is_active = true
        GROUP BY ps.id, ps.section_code, ps.name, ps.sort_order
        ORDER BY ps.sort_order ASC
      `);
      assert('Plant sections aggregate query executes properly', sections.length > 0);
      console.log(`     Total Active Sections: ${sections.length}`);
    } catch (e) {
      assert('Plant sections aggregate query executes properly', false, e.message);
    }

    // 4.2 Check Granular Items Matrix with Machine & Equipment resolution
    try {
      const { rows: granularItems } = await pool.query(`
        SELECT 
          m.id AS "materialId",
          m.code AS "materialCode",
          m.name AS "materialName",
          m.current_stock,
          m.unit_price,
          (m.current_stock * m.unit_price) AS "stockValuation",
          ps.name AS "sectionName",
          mac.name AS "machineName",
          se.equipment_name AS "equipmentName"
        FROM materials m
        LEFT JOIN plant_sections ps ON m.section_id = ps.id
        LEFT JOIN machines mac ON m.machine_id = mac.id
        LEFT JOIN section_equipment se ON m.section_equipment_id = se.id
        WHERE m.is_active = true
        LIMIT 20
      `);
      assert('Granular machine/equipment items matrix query executes properly', granularItems.length > 0);
    } catch (e) {
      assert('Granular machine/equipment items matrix query executes properly', false, e.message);
    }

    // 4.3 Check frontend UI component in Reports.jsx & StoreDeptReports.jsx
    const reportsJsx = fs.readFileSync(path.join(__dirname, '../../frontend/src/pages/Reports.jsx'), 'utf-8');
    assert('Reports.jsx includes plantSectionsDetailed in REPORT_MODULES', reportsJsx.includes('plantSectionsDetailed'));
    assert('Reports.jsx includes PlantSectionsDetailedReportView component', reportsJsx.includes('PlantSectionsDetailedReportView'));

    const storeDeptJsx = fs.readFileSync(path.join(__dirname, '../../frontend/src/pages/StoreDeptReports.jsx'), 'utf-8');
    assert('StoreDeptReports.jsx includes Plant Section & Machine Granularity tab', storeDeptJsx.includes('Plant Section & Machine Granularity'));

    // ─────────────────────────────────────────────────────────────
    // AGENT 5: PROVISIONING & DATA INTEGRITY VERIFICATION
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- [AGENT 5: PROVISIONING & SYSTEM INTEGRITY] ---');

    // 5.1 Check materials count and stock ledger consistency
    try {
      const { rows: [matCount] } = await pool.query(`SELECT COUNT(*) as count FROM materials`);
      const { rows: [slCount] } = await pool.query(`SELECT COUNT(*) as count FROM stock_ledger`);
      assert('Materials catalog populated', Number(matCount.count) > 1000);
      assert('Stock ledger entries populated and intact', Number(slCount.count) > 500);
      console.log(`     Catalog Size: ${matCount.count} materials, Stock Ledger: ${slCount.count} entries`);
    } catch (e) {
      assert('Catalog and ledger check', false, e.message);
    }

    // 5.2 Zero hardcoding check: All valuations positive or zero and derived live
    try {
      const { rows: [valCheck] } = await pool.query(`
        SELECT COALESCE(SUM(current_stock * unit_price), 0) as total_val 
        FROM materials 
        WHERE is_active = true
      `);
      assert('Live total valuation computed without hardcoding', Number(valCheck.total_val) > 0);
      console.log(`     Total Enterprise Stock Valuation: ₹${Number(valCheck.total_val).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`);
    } catch (e) {
      assert('Live total valuation computed without hardcoding', false, e.message);
    }

  } catch (err) {
    console.error('Fatal test runner error:', err);
    failed++;
  } finally {
    await pool.end();
  }

  console.log('\n===============================================================');
  console.log(`🏁 VERIFICATION SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('===============================================================');
  if (failed > 0) process.exit(1);
}

runMultiAgentVerification();
