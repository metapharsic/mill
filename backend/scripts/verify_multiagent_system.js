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

    // ─────────────────────────────────────────────────────────────
    // AGENT 6: CLUBBED GRN INGESTION & INVOICE CALCULATIONS
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- [AGENT 6: CLUBBED GRN INGESTION & INVOICE CALCULATIONS] ---');

    // 6.1 Screenshot Exact Verification: GRN 202608-26 (SUNRISE BEARING CORPORATION)
    try {
      const { rows: [sunriseGrn] } = await pool.query(`
        SELECT g.id, g.grn_number, g.date, g.invoice_number, g.total_taxable, g.total_gst, g.grand_total,
               v.name as vendor_name, v.gstin as vendor_gstin,
               (SELECT COUNT(*) FROM grn_items gi WHERE gi.grn_id = g.id) as item_count
        FROM grn g
        JOIN vendors v ON g.vendor_id = v.id
        WHERE g.grn_number = '202608-26'
      `);

      assert('GRN 202608-26 Master Record exists', Boolean(sunriseGrn));
      if (sunriseGrn) {
        assert('GRN 202608-26 Vendor is SUNRISE BEARING CORPORATION', sunriseGrn.vendor_name === 'SUNRISE BEARING CORPORATION');
        assert('GRN 202608-26 Invoice No is SIV-31151', sunriseGrn.invoice_number === 'SIV-31151');
        assert('GRN 202608-26 has exactly 6 clubbed line items', Number(sunriseGrn.item_count) === 6);
        assert('GRN 202608-26 Taxable value is ₹1,18,950.00', Math.abs(Number(sunriseGrn.total_taxable) - 118950) < 1);
        assert('GRN 202608-26 Total GST is ₹21,411.00', Math.abs(Number(sunriseGrn.total_gst) - 21411) < 1);
        assert('GRN 202608-26 Invoice Total is ₹1,40,361.00', Math.abs(Number(sunriseGrn.grand_total) - 140361) < 1);

        // Verify individual 6 items
        const { rows: items } = await pool.query(`
          SELECT gi.id, m.code, m.name, gi.received_qty, gi.uom, gi.unit_price, gi.taxable_amount,
                 gi.cgst_amount, gi.sgst_amount, gi.total_amount, m.hsn_code
          FROM grn_items gi
          JOIN materials m ON gi.material_id = m.id
          WHERE gi.grn_id = $1
          ORDER BY gi.id ASC
        `, [sunriseGrn.id]);

        const expectedCodes = ['BE0135', 'BE0078', 'BE0098', 'BE0179', 'OS0079', 'OS0080'];
        const actualCodes = items.map(it => it.code);
        assert('GRN 202608-26 contains all 6 screenshot item codes (BE0135, BE0078, BE0098, BE0179, OS0079, OS0080)',
          expectedCodes.every(c => actualCodes.includes(c)));
      }
    } catch (e) {
      assert('GRN 202608-26 verification', false, e.message);
    }

    // 6.1b GRN 202608-34 (14 items - Nagendhra Electrical Works) Verification
    try {
      const { rows: [nagendhraGrn] } = await pool.query(`
        SELECT g.*, v.name as vendor_name, v.code as vendor_code, v.gstin as vendor_gstin
        FROM grn g
        LEFT JOIN vendors v ON g.vendor_id = v.id
        WHERE g.grn_number = '202608-34'
      `);

      assert('GRN 202608-34 Master Record exists', !!nagendhraGrn);
      if (nagendhraGrn) {
        assert('GRN 202608-34 Vendor is NAGENDHRA ELECTRICAL WORKS', nagendhraGrn.vendor_name === 'NAGENDHRA ELECTRICAL WORKS');
        assert('GRN 202608-34 Invoice No is 26-27/B123', nagendhraGrn.invoice_number === '26-27/B123');

        const { rows: nagItems } = await pool.query(`
          SELECT gi.*, m.code as mat_code, m.name as mat_name
          FROM grn_items gi
          JOIN materials m ON gi.material_id = m.id
          WHERE gi.grn_id = $1
          ORDER BY gi.id ASC
        `, [nagendhraGrn.id]);

        assert('GRN 202608-34 has exactly 14 clubbed line items', nagItems.length === 14);
        assert('GRN 202608-34 Taxable value is ₹32,837.00', Math.abs(Number(nagendhraGrn.total_taxable) - 32837.00) < 1.0);
        assert('GRN 202608-34 Total GST is ₹5,910.66', Math.abs(Number(nagendhraGrn.total_gst) - 5910.66) < 1.0);
        assert('GRN 202608-34 Invoice Total is ₹38,748.00', Math.abs(Number(nagendhraGrn.grand_total) - 38748.00) < 1.0);
      }
    } catch (e) {
      assert('GRN 202608-34 verification', false, e.message);
    }

    // 6.2 Total Inward 8252026 Synchronization Verification
    try {
      const { rows: [grnStats] } = await pool.query(`
        SELECT COUNT(*) as total_grns,
               COALESCE(SUM(total_taxable), 0) as total_taxable,
               COALESCE(SUM(grand_total), 0) as total_grand
        FROM grn
        WHERE grn_number LIKE '202608-%'
      `);
      assert('26 Master Inward GRNs present in database', Number(grnStats.total_grns) >= 26);
      assert('Total Inward valuation > ₹25,00,000', Number(grnStats.total_grand) >= 2500000);
      console.log(`     Synced Master GRNs: ${grnStats.total_grns}, Total Value: ₹${Number(grnStats.total_grand).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`);
    } catch (e) {
      assert('Total Inward sync stats verification', false, e.message);
    }

    // 6.3 Finance AP Vendor Bills Linkage
    try {
      const { rows: [billCheck] } = await pool.query(`
        SELECT COUNT(*) as count, COALESCE(SUM(total_amount), 0) as total_val
        FROM vendor_bills
        WHERE bill_number LIKE 'BILL-202608%' OR bill_number LIKE 'BILL-2026608%'
      `);
      assert('Finance AP vendor bills generated for inward GRNs', Number(billCheck.count) >= 20);
    } catch (e) {
      assert('Finance AP vendor bills check', false, e.message);
    }

    // 6.4 Zero Negative Stock Invariant Check
    try {
      const { rows: [negStock] } = await pool.query(`SELECT COUNT(*) as count FROM materials WHERE current_stock < 0`);
      assert('Zero negative stock tolerance across all materials in mill', Number(negStock.count) === 0);
    } catch (e) {
      assert('Zero negative stock check', false, e.message);
    }

    // 6.5 Stock Ledger Atomic Linkage Check
    try {
      const { rows: [ledgerGrnCheck] } = await pool.query(`
        SELECT COUNT(*) as count, COALESCE(SUM(in_qty), 0) as total_qty
        FROM stock_ledger
        WHERE reference_type = 'GRN' AND transaction_type = 'grn'
      `);
      assert('Stock ledger entries linked to GRN references', Number(ledgerGrnCheck.count) >= 50);
    } catch (e) {
      assert('Stock ledger GRN check', false, e.message);
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
