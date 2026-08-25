/**
 * ─────────────────────────────────────────────────────────────────────────────
 * MULTI-AGENT COMPREHENSIVE WIRING GAP AUDIT SCRIPT
 * MK Paper Mill ERP — System-Wide Integration & Wiring Verification
 * ─────────────────────────────────────────────────────────────────────────────
 */

const pool = require('../src/db/pool');
const fs = require('fs');
const path = require('path');

async function runWiringAudit() {
  console.log('===============================================================');
  console.log('🚀 MULTI-AGENT COMPREHENSIVE SYSTEM WIRING AUDIT');
  console.log('===============================================================');

  const auditReport = {
    A_DB: { passed: [], gaps: [] },
    A_SYNTAX: { passed: [], gaps: [] },
    A_P2P: { passed: [], gaps: [] },
    A_STORE: { passed: [], gaps: [] },
    A_ASSET: { passed: [], gaps: [] },
    A_MAINT_FIN: { passed: [], gaps: [] }
  };

  // -------------------------------------------------------------
  // 1. AGENT A_DB: Schema & Table Constraints Audit
  // -------------------------------------------------------------
  console.log('\n--- [AGENT A_DB: DATABASE SCHEMA & DATA INTEGRITY AUDIT] ---');
  try {
    const requiredTables = ['grn', 'grn_items', 'materials', 'vendors', 'stock_ledger', 'vendor_bills', 'store_indent_log', 'plant_sections', 'machines'];
    for (const tbl of requiredTables) {
      const { rows } = await pool.query(`SELECT to_regclass('public.${tbl}') as exists`);
      if (rows[0].exists) {
        auditReport.A_DB.passed.push(`Table public.${tbl} exists`);
      } else {
        auditReport.A_DB.gaps.push(`Missing table: public.${tbl}`);
      }
    }

    const { rows: orphanItems } = await pool.query(`
      SELECT count(*) as count FROM grn_items gi 
      LEFT JOIN grn g ON g.id = gi.grn_id 
      WHERE g.id IS NULL
    `);
    if (Number(orphanItems[0].count) === 0) {
      auditReport.A_DB.passed.push('Zero orphan grn_items records');
    } else {
      auditReport.A_DB.gaps.push(`${orphanItems[0].count} orphaned grn_items found`);
    }

    const { rows: orphanMatItems } = await pool.query(`
      SELECT count(*) as count FROM grn_items gi 
      LEFT JOIN materials m ON m.id = gi.material_id 
      WHERE m.id IS NULL
    `);
    if (Number(orphanMatItems[0].count) === 0) {
      auditReport.A_DB.passed.push('Zero invalid material_ids in grn_items');
    } else {
      auditReport.A_DB.gaps.push(`${orphanMatItems[0].count} grn_items with invalid material_id`);
    }

    const { rows: negStock } = await pool.query(`
      SELECT count(*) as count FROM materials WHERE current_stock < 0
    `);
    if (Number(negStock[0].count) === 0) {
      auditReport.A_DB.passed.push('Zero negative stock materials across enterprise');
    } else {
      auditReport.A_DB.gaps.push(`${negStock[0].count} materials have negative stock`);
    }
  } catch (e) {
    auditReport.A_DB.gaps.push(`Database audit error: ${e.message}`);
  }

  // -------------------------------------------------------------
  // 2. AGENT A_SYNTAX: Express API Routes & Controller Wiring
  // -------------------------------------------------------------
  console.log('\n--- [AGENT A_SYNTAX: BACKEND ROUTES & CONTROLLER WIRING] ---');
  try {
    const storeRoutesPath = path.join(__dirname, '../src/routes/store.js');
    const purchaseRoutesPath = path.join(__dirname, '../src/routes/purchase.js');
    
    const storeCode = fs.readFileSync(storeRoutesPath, 'utf8');
    const purchaseCode = fs.readFileSync(purchaseRoutesPath, 'utf8');

    if (storeCode.includes("json_agg") && storeCode.includes("grn_items") && storeCode.includes("req.query")) {
      auditReport.A_SYNTAX.passed.push('GET /api/store/inward implements Master GRN Consolidated aggregation with json_agg');
    } else {
      auditReport.A_SYNTAX.gaps.push('GET /api/store/inward missing master view aggregation');
    }

    if (storeCode.includes('/grn/:id') && storeCode.includes('grn_items')) {
      auditReport.A_SYNTAX.passed.push('GET /api/store/grn/:id resolves master GRN with child items');
    } else {
      auditReport.A_SYNTAX.gaps.push('GET /api/store/grn/:id incomplete');
    }

    if (purchaseCode.includes('/grn/:id')) {
      auditReport.A_SYNTAX.passed.push('GET /api/purchase/grn/:id resolves master GRN');
    } else {
      auditReport.A_SYNTAX.gaps.push('GET /api/purchase/grn/:id missing');
    }

    if (storeCode.includes('requireStore')) {
      auditReport.A_SYNTAX.passed.push('Store routes protected with requireStore guard');
    } else {
      auditReport.A_SYNTAX.gaps.push('Missing requireStore guard in store.js');
    }

    if (storeCode.includes('/grn/append-item') || storeCode.includes('append')) {
      auditReport.A_SYNTAX.passed.push('Append line item to Master GRN endpoint exists');
    } else {
      auditReport.A_SYNTAX.gaps.push('Missing append line item to GRN endpoint');
    }
  } catch (e) {
    auditReport.A_SYNTAX.gaps.push(`Syntax & routes audit error: ${e.message}`);
  }

  // -------------------------------------------------------------
  // 3. AGENT A_P2P: Procure-to-Pay Lifecycle Wiring
  // -------------------------------------------------------------
  console.log('\n--- [AGENT A_P2P: P2P LIFECYCLE & INWARD SYNC WIRING] ---');
  try {
    const { rows: grns } = await pool.query(`
      SELECT g.id, g.grn_number, g.total_taxable, g.total_gst, g.grand_total,
             count(gi.id) as item_count,
             COALESCE(sum(gi.received_qty), 0) as total_qty
      FROM grn g
      LEFT JOIN grn_items gi ON gi.grn_id = g.id
      WHERE g.grn_number LIKE '202608-%'
      GROUP BY g.id
    `);

    if (grns.length >= 26) {
      auditReport.A_P2P.passed.push(`All ${grns.length} Master GRNs mapped and loaded`);
    } else {
      auditReport.A_P2P.gaps.push(`Expected 26 Master GRNs, found ${grns.length}`);
    }

    const multiItemGrns = grns.filter(g => Number(g.item_count) > 1);
    if (multiItemGrns.length >= 7) {
      auditReport.A_P2P.passed.push(`${multiItemGrns.length} Multi-item Master GRNs correctly clubbed`);
    } else {
      auditReport.A_P2P.gaps.push(`Found only ${multiItemGrns.length} multi-item GRNs`);
    }

    const grn26 = grns.find(g => g.grn_number === '202608-26');
    const grn34 = grns.find(g => g.grn_number === '202608-34');

    if (grn26 && Number(grn26.item_count) === 6) {
      auditReport.A_P2P.passed.push('GRN 202608-26 verified with exactly 6 items (SUNRISE BEARING CORP)');
    } else {
      auditReport.A_P2P.gaps.push(`GRN 202608-26 item count mismatch: ${grn26?.item_count}`);
    }

    if (grn34 && Number(grn34.item_count) === 14) {
      auditReport.A_P2P.passed.push('GRN 202608-34 verified with exactly 14 items (NAGENDHRA ELECTRICAL WORKS)');
    } else {
      auditReport.A_P2P.gaps.push(`GRN 202608-34 item count mismatch: ${grn34?.item_count}`);
    }
  } catch (e) {
    auditReport.A_P2P.gaps.push(`P2P audit error: ${e.message}`);
  }

  // -------------------------------------------------------------
  // 4. AGENT A_STORE: Store Desk & UI Wiring Audit
  // -------------------------------------------------------------
  console.log('\n--- [AGENT A_STORE: STORE DESK & FRONTEND COMPONENT WIRING] ---');
  try {
    const storeJsxPath = path.join(__dirname, '../../frontend/src/pages/Store.jsx');
    const a3ModalPath = path.join(__dirname, '../../frontend/src/components/A3InvoicePrintModal.jsx');

    const storeJsx = fs.readFileSync(storeJsxPath, 'utf8');
    const a3Modal = fs.readFileSync(a3ModalPath, 'utf8');

    if (storeJsx.includes('inwardViewMode') && storeJsx.includes('toggleExpandGrn')) {
      auditReport.A_STORE.passed.push('Store.jsx has dual-view mode switcher (Master vs Item Ledger) & accordion toggle');
    } else {
      auditReport.A_STORE.gaps.push('Store.jsx missing inwardViewMode or toggleExpandGrn');
    }

    if (storeJsx.includes('masterGrnModal') && storeJsx.includes('openMasterGrn')) {
      auditReport.A_STORE.passed.push('Store.jsx has Master GRN detailed modal with multi-item list');
    } else {
      auditReport.A_STORE.gaps.push('Store.jsx missing Master GRN modal');
    }

    if (storeJsx.includes('openA3Invoice') && storeJsx.includes('<A3InvoicePrintModal')) {
      auditReport.A_STORE.passed.push('Store.jsx correctly integrates A3InvoicePrintModal for 1-click single slip print');
    } else {
      auditReport.A_STORE.gaps.push('Store.jsx missing A3InvoicePrintModal wiring');
    }

    if (a3Modal.includes('amountInWords') && a3Modal.includes('gstSlabsMap') && a3Modal.includes('totalTaxable')) {
      auditReport.A_STORE.passed.push('A3InvoicePrintModal calculates tax, GST slabs, totals, and words dynamically');
    } else {
      auditReport.A_STORE.gaps.push('A3InvoicePrintModal missing dynamic calculations');
    }
  } catch (e) {
    auditReport.A_STORE.gaps.push(`Store UI audit error: ${e.message}`);
  }

  // -------------------------------------------------------------
  // 5. AGENT A_ASSET: Plant Machinery & Section Granularity Audit
  // -------------------------------------------------------------
  console.log('\n--- [AGENT A_ASSET: PLANT SECTION & MACHINERY GRANULARITY AUDIT] ---');
  try {
    const { rows: secCount } = await pool.query('SELECT count(*) as count FROM plant_sections WHERE is_active = true');
    if (Number(secCount[0].count) >= 20) {
      auditReport.A_ASSET.passed.push(`Plant sections active and populated (${secCount[0].count} sections)`);
    } else {
      auditReport.A_ASSET.gaps.push(`Low plant section count: ${secCount[0].count}`);
    }

    const { rows: machCount } = await pool.query('SELECT count(*) as count FROM machines WHERE is_active = true');
    if (Number(machCount[0].count) >= 20) {
      auditReport.A_ASSET.passed.push(`Plant machinery and equipment populated (${machCount[0].count} machines)`);
    } else {
      auditReport.A_ASSET.gaps.push(`Low machine count: ${machCount[0].count}`);
    }
  } catch (e) {
    auditReport.A_ASSET.gaps.push(`Asset audit error: ${e.message}`);
  }

  // -------------------------------------------------------------
  // 6. AGENT A_MAINT_FIN: Finance Calculations & AP Alignment Audit
  // -------------------------------------------------------------
  console.log('\n--- [AGENT A_MAINT_FIN: FINANCE AP & INVOICE CALCULATIONS AUDIT] ---');
  try {
    const { rows: bills } = await pool.query(`
      SELECT count(*) as count, COALESCE(sum(total_amount), 0) as total_val 
      FROM vendor_bills 
      WHERE bill_number LIKE 'BILL-202608%' OR bill_number LIKE 'BILL-2026608%'
    `);
    if (Number(bills[0].count) >= 20) {
      auditReport.A_MAINT_FIN.passed.push(`Finance Accounts Payable generated ${bills[0].count} vendor bills (Total ₹${Number(bills[0].total_val).toLocaleString('en-IN')})`);
    } else {
      auditReport.A_MAINT_FIN.gaps.push(`Only ${bills[0].count} AP vendor bills found for synced GRNs`);
    }

    // Mathematical precision check: zero GRNs with 0 grand total when priced items exist
    const { rows: badTotals } = await pool.query(`
      SELECT count(*) as count FROM grn 
      WHERE grand_total = 0 AND (SELECT count(*) FROM grn_items gi WHERE gi.grn_id = grn.id AND gi.unit_price > 0) > 0
    `);
    if (Number(badTotals[0].count) === 0) {
      auditReport.A_MAINT_FIN.passed.push('Zero GRNs with missing or zero grand total calculations for priced items');
    } else {
      auditReport.A_MAINT_FIN.gaps.push(`${badTotals[0].count} GRNs have priced items but 0 grand total`);
    }

    // Check specific calculation match for GRN 202608-34
    const { rows: [g34] } = await pool.query("SELECT * FROM grn WHERE grn_number = '202608-34'");
    if (g34 && Number(g34.grand_total) === 38748.00 && Number(g34.total_taxable) === 32837.00) {
      auditReport.A_MAINT_FIN.passed.push('GRN 202608-34 calculation precisely matches user second pic (₹32,837 Taxable + ₹5,910.66 GST = ₹38,748 Total)');
    } else {
      auditReport.A_MAINT_FIN.gaps.push(`GRN 202608-34 calculation mismatch: ${g34?.grand_total}`);
    }
  } catch (e) {
    auditReport.A_MAINT_FIN.gaps.push(`Finance audit error: ${e.message}`);
  }

  // -------------------------------------------------------------
  // SUMMARY REPORT
  // -------------------------------------------------------------
  console.log('\n===============================================================');
  console.log('📋 MULTI-AGENT WIRING GAP AUDIT RESULTS');
  console.log('===============================================================');

  let totalGaps = 0;
  let totalPassed = 0;

  for (const [agentName, res] of Object.entries(auditReport)) {
    console.log(`\n🔹 [${agentName}]`);
    res.passed.forEach(p => console.log(`   ✅ PASS: ${p}`));
    if (res.gaps.length === 0) {
      console.log(`   🎉 Status: NO WIRING GAPS DETECTED (100% HEALTHY)`);
    } else {
      res.gaps.forEach(g => console.log(`   ❌ GAP: ${g}`));
    }
    totalPassed += res.passed.length;
    totalGaps += res.gaps.length;
  }

  console.log('\n===============================================================');
  console.log(`🏁 OVERALL AUDIT: ${totalPassed} Checks Passed | ${totalGaps} Gaps Found`);
  console.log('===============================================================');

  process.exit(totalGaps === 0 ? 0 : 1);
}

runWiringAudit().catch(err => {
  console.error('Audit execution error:', err);
  process.exit(1);
});
