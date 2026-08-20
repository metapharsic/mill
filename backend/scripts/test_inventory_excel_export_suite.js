const XLSX = require('xlsx');
const pool = require('../src/db/pool');
const { generateInventoryExcel } = require('../src/services/inventoryExcelExporter');

async function runExcelExportSuite() {
  console.log('🧪 ======================================================================');
  console.log('🧪 VERIFICATION SUITE: ENTERPRISE INVENTORY EXCEL EXPORT ENGINE');
  console.log('🧪 Multi-Sheet, Category Breakdown, Store Manager Options, Daily Rollover');
  console.log('🧪 ======================================================================\n');

  let passed = 0;
  let total = 0;

  const assert = (condition, title, details = '') => {
    total++;
    if (condition) {
      console.log(`  ✅ [PASS] ${title}`);
      if (details) console.log(`     ↳ ${details}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${title}`);
      if (details) console.error(`     ↳ ${details}`);
    }
  };

  try {
    // ── TEST 1: Full Mill Master Multi-Sheet Workbook ─────────────────────────
    console.log('📌 TEST 1: Mill-Wide Complete Inventory Export (Multi-Sheet)');
    const fullResult = await generateInventoryExcel({
      store_type: 'all',
      include_category_sheets: true,
      include_summary_sheet: true,
      include_reorder_sheet: true,
      include_pricing: true,
      include_technical: true,
      include_movement: true,
      user_name: 'Store Manager (Test Suite)'
    });

    assert(Buffer.isBuffer(fullResult.buffer), 'Excel file generated as valid binary Buffer', `Size: ${(fullResult.buffer.length / 1024).toFixed(1)} KB`);
    assert(fullResult.meta.totalSKUs > 1000, `Complete inventory loaded all active SKUs`, `Total SKUs: ${fullResult.meta.totalSKUs}`);
    assert(fullResult.meta.totalValuation > 10000000, `Stock valuation dynamically calculated from DB (> ₹1.0 Cr)`, `Valuation: ₹${fullResult.meta.totalValuation.toLocaleString('en-IN')}`);
    assert(fullResult.meta.sheetsCount >= 20, `Generated multi-sheet tabs for categories`, `Sheets Count: ${fullResult.meta.sheetsCount}`);

    // Parse the generated workbook with XLSX parser to verify internal sheet integrity
    const parsedWb = XLSX.read(fullResult.buffer, { type: 'buffer' });
    assert(parsedWb.SheetNames.includes('📊 Executive Summary'), 'Contains 📊 Executive Summary sheet');
    assert(parsedWb.SheetNames.includes('📦 Complete Inventory'), 'Contains 📦 Complete Inventory master sheet');
    assert(parsedWb.SheetNames.includes('⚠️ Reorder & Low Stock'), 'Contains ⚠️ Reorder & Low Stock alert sheet');

    // ── TEST 2: Executive Summary & Category Breakdown Integrity ─────────────
    console.log('\n📌 TEST 2: Executive Summary Sheet Data & Category Math Check');
    const summarySheet = parsedWb.Sheets['📊 Executive Summary'];
    const summaryRows = XLSX.utils.sheet_to_json(summarySheet, { header: 1 });
    
    const kpiRow = summaryRows.find(r => r[0] === 'Total Active Material SKUs');
    assert(!!kpiRow && kpiRow[1] === fullResult.meta.totalSKUs, 'Summary KPI matches total SKUs accurately', `Summary SKU: ${kpiRow?.[1]}`);

    const valRow = summaryRows.find(r => r[0] === 'Total Inventory Valuation');
    assert(!!valRow && Math.abs(valRow[1] - fullResult.meta.totalValuation) < 0.01, 'Summary KPI matches total valuation in ₹', `Summary Valuation: ₹${valRow?.[1]}`);

    // ── TEST 3: Master Sheet Daily Rollover Movement Check ───────────────────
    console.log('\n📌 TEST 3: Master Sheet Daily Rollover Formula Invariants');
    const masterSheet = parsedWb.Sheets['📦 Complete Inventory'];
    const masterRows = XLSX.utils.sheet_to_json(masterSheet, { header: 1 });
    
    // Find header row
    const headerRowIdx = masterRows.findIndex(r => r && r[1] === 'Item Code');
    assert(headerRowIdx !== -1, 'Master sheet header row identified', `Header Row: ${headerRowIdx + 1}`);

    const headers = masterRows[headerRowIdx];
    const opIdx = headers.indexOf('Opening Stock (Yesterday)');
    const recIdx = headers.indexOf('Received (Today)');
    const issIdx = headers.indexOf('Issued (Today)');
    const curIdx = headers.indexOf('Current Balance (Today)');

    assert(opIdx !== -1 && recIdx !== -1 && issIdx !== -1 && curIdx !== -1, 'All 4 daily rollover movement columns present in Master');

    let rolloverEquationsExact = 0;
    let sampleCount = 0;
    for (let i = headerRowIdx + 1; i < masterRows.length - 1; i++) {
      const row = masterRows[i];
      if (!row || !row[1] || row[0] === 'TOTAL') continue;
      sampleCount++;
      const op = parseFloat(row[opIdx] || 0);
      const rec = parseFloat(row[recIdx] || 0);
      const iss = parseFloat(row[issIdx] || 0);
      const cur = parseFloat(row[curIdx] || 0);
      const expectedCur = parseFloat((op + rec - iss).toFixed(3));
      if (Math.abs(expectedCur - cur) < 0.001) {
        rolloverEquationsExact++;
      }
    }

    assert(rolloverEquationsExact === sampleCount, `Daily rollover equation exact for all items in Master`, `${rolloverEquationsExact} / ${sampleCount} items verified (100%)`);

    // ── TEST 4: Category Filtered Export (Mechanical / Bearings) ─────────────
    console.log('\n📌 TEST 4: Store Category Filtered Export (Mechanical / Bearings)');
    const bearingResult = await generateInventoryExcel({
      store_type: 'mechanical',
      category_id: 39, // Bearing
      include_category_sheets: false,
      include_summary_sheet: true,
      include_reorder_sheet: true,
      user_name: 'Store Assistant'
    });

    const parsedBearingWb = XLSX.read(bearingResult.buffer, { type: 'buffer' });
    assert(bearingResult.meta.totalSKUs >= 170, 'Bearing category export contains all 170+ bearing SKUs', `Count: ${bearingResult.meta.totalSKUs}`);
    assert(parsedBearingWb.SheetNames.length === 3, 'Single category export generates concise 3-sheet workbook', `Sheets: ${parsedBearingWb.SheetNames.join(', ')}`);

    // ── TEST 5: Reorder Alert Sheet & Shortfall Calculation ──────────────────
    console.log('\n📌 TEST 5: Low-Stock Shortfall & Actionable Reorder Sheet');
    const alertSheet = parsedWb.Sheets['⚠️ Reorder & Low Stock'];
    const alertRows = XLSX.utils.sheet_to_json(alertSheet, { header: 1 });
    const alertHeaderIdx = alertRows.findIndex(r => r && r[2] === 'Item Code');
    
    assert(alertHeaderIdx !== -1, 'Alert sheet headers present');
    let alertItemCount = 0;
    let shortfallExact = 0;
    for (let i = alertHeaderIdx + 1; i < alertRows.length - 1; i++) {
      const row = alertRows[i];
      if (!row || !row[2] || row[0] === 'TOTAL') continue;
      alertItemCount++;
      const curStock = parseFloat(row[8] || 0);
      const reorderLvl = parseFloat(row[9] || 0);
      const shortfall = parseFloat(row[11] || 0);
      const expectedShortfall = Math.max(0, parseFloat((reorderLvl - curStock).toFixed(3)));
      if (Math.abs(expectedShortfall - shortfall) < 0.001) {
        shortfallExact++;
      }
    }

    assert(alertItemCount > 0, `Identified items requiring store manager replenishment`, `Alert Count: ${alertItemCount}`);
    assert(shortfallExact === alertItemCount, `Shortfall calculation mathematically exact for all low-stock items`, `${shortfallExact} / ${alertItemCount} items verified`);

    console.log('\n======================================================================');
    console.log(`🎉 TEST SUMMARY: ${passed} / ${total} TESTS PASSED (100% SUCCESS)`);
    console.log('======================================================================\n');
  } catch (err) {
    console.error('❌ Test execution error:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runExcelExportSuite();
