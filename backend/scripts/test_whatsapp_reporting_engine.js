const pool = require('../src/db/pool');
const waGen = require('../src/services/whatsappReportGenerator');

async function runTests() {
  console.log('===============================================================');
  console.log('🧪 TESTING WHATSAPP MULTI-DIMENSIONAL REPORTING ENGINE');
  console.log('===============================================================\n');

  let passed = 0;
  let failed = 0;
  const d = new Date().toISOString().slice(0, 10);

  try {
    console.log(`--- 1. Testing Raw Database Aggregations for Date: ${d} ---`);

    // 1. Detailed GRNs
    const detailedGrnRes = await pool.query(`
      SELECT g.id, g.grn_number, g.date, g.total_value, g.grand_total, g.status, g.invoice_number,
             v.name AS vendor_name, v.code AS vendor_code,
             po.po_number,
             COALESCE(
               json_agg(
                 json_build_object(
                   'material_id', gi.material_id,
                   'mat_code', m.code,
                   'mat_name', m.name,
                   'uom', m.uom,
                   'received_qty', gi.received_qty,
                   'accepted_qty', gi.accepted_qty,
                   'rejected_qty', gi.rejected_qty,
                   'unit_price', gi.unit_price,
                   'total_amount', gi.total_amount,
                   'section_name', ps.name,
                   'machine_name', COALESCE(se.equipment_name, mac.name)
                 )
               ) FILTER (WHERE gi.id IS NOT NULL), '[]'::json
             ) AS items
      FROM grn g
      LEFT JOIN vendors v ON g.vendor_id = v.id
      LEFT JOIN purchase_orders po ON g.po_id = po.id
      LEFT JOIN grn_items gi ON g.id = gi.grn_id
      LEFT JOIN materials m ON gi.material_id = m.id
      LEFT JOIN plant_sections ps ON ps.id = m.section_id
      LEFT JOIN machines mac ON mac.id = m.machine_id
      LEFT JOIN section_equipment se ON se.id = m.section_equipment_id
      WHERE DATE(g.date) = $1 OR DATE(g.created_at) = $1
      GROUP BY g.id, g.grn_number, g.date, g.total_value, g.grand_total, g.status, g.invoice_number, v.name, v.code, po.po_number
      ORDER BY g.id DESC
    `, [d]);
    console.log(`  ✅ [PASS] Detailed GRN Query executed cleanly (Found ${detailedGrnRes.rows.length} GRNs)`);
    passed++;

    // 2. Detailed Indents
    const detailedIndentsRes = await pool.query(`
      SELECT i.id, i.indent_number, i.date, i.required_date, i.priority, i.status, i.total_value,
             d.name AS dept_name, d.code AS dept_code,
             u.name AS raised_by_name,
             COALESCE(
               json_agg(
                 json_build_object(
                   'material_id', ii.material_id,
                   'mat_code', m.code,
                   'mat_name', m.name,
                   'uom', ii.uom,
                   'required_qty', ii.required_qty,
                   'approved_qty', ii.approved_qty,
                   'issued_qty', ii.issued_qty,
                   'pending_qty', GREATEST(0, (COALESCE(ii.required_qty, 0) - COALESCE(ii.issued_qty, 0))),
                   'unit_price', ii.unit_price,
                   'line_value', ii.line_value,
                   'section_name', ps.name,
                   'machine_name', mac.name
                 )
               ) FILTER (WHERE ii.id IS NOT NULL), '[]'::json
             ) AS items
      FROM indents i
      JOIN departments d ON i.department_id = d.id
      LEFT JOIN users u ON i.raised_by = u.id
      LEFT JOIN indent_items ii ON i.id = ii.indent_id
      LEFT JOIN materials m ON ii.material_id = m.id
      LEFT JOIN plant_sections ps ON ps.id = ii.section_id OR (ii.section_id IS NULL AND ps.id = m.section_id)
      LEFT JOIN machines mac ON mac.id = ii.machine_id OR (ii.machine_id IS NULL AND mac.id = m.machine_id)
      WHERE DATE(i.date) = $1 OR DATE(i.created_at) = $1
      GROUP BY i.id, i.indent_number, i.date, i.required_date, i.priority, i.status, i.total_value, d.name, d.code, u.name
      ORDER BY i.id DESC
    `, [d]);
    console.log(`  ✅ [PASS] Detailed Indent Query executed cleanly (Found ${detailedIndentsRes.rows.length} Indents)`);
    passed++;

    // 3. Mill Inventory Catalog Totals
    const catalogTotalsRes = await pool.query(`
      SELECT COUNT(id) AS total_active_materials,
             COALESCE(SUM(current_stock * unit_price), 0) AS total_inventory_valuation,
             COALESCE(SUM(current_stock), 0) AS total_stock_units
      FROM materials
      WHERE is_active = true
    `);
    const catTotals = catalogTotalsRes.rows[0];
    console.log(`  ✅ [PASS] Mill Inventory Totals: ${catTotals.total_active_materials} active materials | ₹${Number(catTotals.total_inventory_valuation).toLocaleString('en-IN')} total stock valuation`);
    passed++;

    // 4. Mock Sample EOD Dataset for Template Generation
    const sampleEodData = {
      date: d,
      compiledAt: new Date().toISOString(),
      production: {
        totalReels: 42,
        totalKg: 125400,
        totalMt: 125.4,
        avgEfficiency: 92.5,
        avgGsm: 140.2,
        avgMoisture: 7.2,
        downtimeMin: 35
      },
      utility: {
        powerUnits: 28400,
        steamMt: 185.0,
        coalKg: 24000,
        waterKl: 320,
        specificPowerKwhPerMt: 226.5
      },
      quality: {
        totalTests: 18,
        passed: 18,
        failed: 0,
        held: 0,
        passRate: 100
      },
      maintenance: {
        breakdowns: 1,
        downtimeMin: 35,
        affectedMachines: 'Paper Machine 1 (Wire Section)'
      },
      commercial: {
        ordersBooked: 3,
        bookedMt: 110.0,
        bookedValue: 4200000,
        dispatchedMt: 95.5,
        dispatchedValue: 3650000
      },
      storeAndIndents: {
        indentsRaised: 5,
        indentsIssued: 3,
        indentsValue: 148500,
        stockReceivedQty: 250,
        stockIssuedQty: 180,
        stockIssueValue: 126400,
        stockReceivedValue: 285000
      },
      indentsByDept: [
        { dept_name: 'Mechanical Maintenance', dept_code: 'MECH', total_indents: 2, total_indent_value: 65000, issued_count: 2, approved_count: 0, pending_count: 0 },
        { dept_name: 'Paper Machine Production', dept_code: 'PM1', total_indents: 2, total_indent_value: 58500, issued_count: 1, approved_count: 1, pending_count: 0 },
        { dept_name: 'Chemical & Lab', dept_code: 'LAB', total_indents: 1, total_indent_value: 25000, issued_count: 0, approved_count: 0, pending_count: 1 }
      ],
      indentsList: [
        { id: 101, indent_number: 'IND-2026-0801', dept_name: 'Mechanical Maintenance', total_value: 45000, status: 'Issued', raised_by_name: 'Ramesh K', items_count: 3 },
        { id: 102, indent_number: 'IND-2026-0802', dept_name: 'Paper Machine Production', total_value: 38500, status: 'Approved', raised_by_name: 'Suresh P', items_count: 2 }
      ],
      detailedIndents: [
        {
          id: 101, indent_number: 'IND-2026-0801', dept_name: 'Mechanical Maintenance', priority: 'High', status: 'Issued', total_value: 45000, raised_by_name: 'Ramesh K',
          items: [
            { material_id: 1, mat_code: 'BRG-6205-2RS', mat_name: 'Deep Groove Ball Bearing 6205', uom: 'NOS', required_qty: 4, issued_qty: 4, pending_qty: 0, unit_price: 1250, line_value: 5000, section_name: 'Press Section' },
            { material_id: 2, mat_code: 'OIL-SEAL-80', mat_name: 'High Temp Viton Oil Seal 80x100x12', uom: 'NOS', required_qty: 2, issued_qty: 2, pending_qty: 0, unit_price: 2500, line_value: 5000, section_name: 'Dryer Section' }
          ]
        }
      ],
      categoryWiseStore: [
        { category_name: 'Mechanical Spares', store_type: 'Store', total_materials_count: 140, total_stock_qty: 850, total_stock_valuation: 1450000, outward_qty: 12, outward_value: 48000, inward_qty: 20, inward_value: 95000 },
        { category_name: 'Chemical Store', store_type: 'Store', total_materials_count: 35, total_stock_qty: 12400, total_stock_valuation: 3200000, outward_qty: 150, outward_value: 62000, inward_qty: 200, inward_value: 140000 },
        { category_name: 'Electrical Spares', store_type: 'Store', total_materials_count: 85, total_stock_qty: 420, total_stock_valuation: 980000, outward_qty: 8, outward_value: 16400, inward_qty: 30, inward_value: 50000 }
      ],
      inwardGRNs: [
        { id: 201, mat_code: 'ALUM-PAC-LIQ', mat_name: 'Polyaluminium Chloride (PAC Liquid 18%)', uom: 'KG', in_qty: 5000, value: 125000, vendor_name: 'Grasim Chemicals Ltd', po_number: 'PO-2026-0042', section_name: 'Pulp Mill' },
        { id: 202, mat_code: 'BRG-22220-E1', mat_name: 'Spherical Roller Bearing 22220 E1 FAG', uom: 'NOS', in_qty: 4, value: 48000, vendor_name: 'SKF Industrial Distributors', po_number: 'PO-2026-0045', section_name: 'Press Section' }
      ],
      detailedGrns: [
        {
          id: 201, grn_number: 'GRN-2026-0112', vendor_name: 'Grasim Chemicals Ltd', po_number: 'PO-2026-0042', invoice_number: 'INV-9941', total_value: 125000, status: 'Received',
          items: [
            { material_id: 10, mat_code: 'ALUM-PAC-LIQ', mat_name: 'Polyaluminium Chloride (PAC Liquid 18%)', uom: 'KG', received_qty: 5000, accepted_qty: 5000, unit_price: 25, total_amount: 125000, section_name: 'Pulp Mill' }
          ]
        }
      ],
      outwardIssues: [
        { id: 301, mat_code: 'BRG-6205-2RS', mat_name: 'Deep Groove Ball Bearing 6205', uom: 'NOS', out_qty: 4, value: 5000, dept_name: 'Mechanical Maintenance', section_name: 'Press Section', machine_name: 'PM1 Press Roll 2', current_stock: 16, reorder_level: 10, remarks: 'Replaced during shift shutdown' },
        { id: 302, mat_code: 'ALUM-PAC-LIQ', mat_name: 'Polyaluminium Chloride (PAC Liquid 18%)', uom: 'KG', out_qty: 1200, value: 30000, dept_name: 'Paper Machine Production', section_name: 'Pulp Mill', current_stock: 3800, reorder_level: 2000, remarks: 'Shift A sizing dosage' }
      ],
      criticalLowStock: [
        { id: 5, code: 'BELT-SPC-4000', name: 'Wedge Belt SPC 4000 Optibelt', uom: 'NOS', current_stock: 1, reorder_level: 4, unit_price: 3200, store_name: 'Mechanical Store' }
      ],
      purchases: [
        { id: 401, po_number: 'PO-2026-0048', vendor_name: 'Aditya Birla Chemicals', total_value: 240000, grand_total: 283200, status: 'Approved', items_count: 2 }
      ],
      totalReceivedValue: 285000,
      totalReceivedQty: 5004,
      totalMillInventoryValuation: 5630000,
      totalActiveMaterials: 260
    };

    console.log('\n--- 2. Testing 5 WhatsApp Formatted Message Generators ---');

    // Generator 1: Master Report
    const masterText = waGen.generateMasterWhatsAppReport(sampleEodData, {
      customRemarks: 'Daily stock verification completed without discrepancies.',
      senderSignOff: 'Store Manager · MK Paper Mill'
    });
    if (masterText && masterText.includes('MK PAPER MILL — EXECUTIVE EOD DIGEST') && masterText.includes('EXECUTIVE STORE & PLANT SCORECARD')) {
      console.log(`  ✅ [PASS] Template 1 (Master Executive Digest) generated (${masterText.length} chars)`);
      passed++;
    } else {
      console.error('  ❌ [FAIL] Template 1 generation failed');
      failed++;
    }

    // Generator 2: GRN Receipts Report
    const grnText = waGen.generateGrnWhatsAppReport(sampleEodData, {
      customRemarks: 'All chemical tankers inspected and sample quality passed.',
      senderSignOff: 'Store Inward Team'
    });
    if (grnText && grnText.includes('INWARD GRN RECEIPTS') && grnText.includes('Grasim Chemicals Ltd')) {
      console.log(`  ✅ [PASS] Template 2 (GRN Inward Receipts Digest) generated (${grnText.length} chars)`);
      passed++;
    } else {
      console.error('  ❌ [FAIL] Template 2 generation failed');
      failed++;
    }

    // Generator 3: Indents & Requisitions Report
    const indentText = waGen.generateIndentWhatsAppReport(sampleEodData, {
      customRemarks: 'PM1 maintenance indents expedited for night shift.',
      senderSignOff: 'Store Requisition Control'
    });
    if (indentText && indentText.includes('DEPARTMENT INDENTS') && indentText.includes('Mechanical Maintenance')) {
      console.log(`  ✅ [PASS] Template 3 (Department Indents Digest) generated (${indentText.length} chars)`);
      passed++;
    } else {
      console.error('  ❌ [FAIL] Template 3 generation failed');
      failed++;
    }

    // Generator 4: Item & Material Wise Movement Report
    const itemText = waGen.generateItemWiseWhatsAppReport(sampleEodData, {
      senderSignOff: 'Material Ledger Officer'
    });
    if (itemText && itemText.includes('MATERIAL & ITEM MOVEMENTS') && itemText.includes('Deep Groove Ball Bearing 6205')) {
      console.log(`  ✅ [PASS] Template 4 (Material & Item Movement Digest) generated (${itemText.length} chars)`);
      passed++;
    } else {
      console.error('  ❌ [FAIL] Template 4 generation failed');
      failed++;
    }

    // Generator 5: Inventory & Valuation Report
    const invText = waGen.generateInventoryValuationReport(sampleEodData, {
      customRemarks: 'Monthly store valuation updated from live inventory ledger.',
      senderSignOff: 'Head of Stores & Materials'
    });
    if (invText && invText.includes('INVENTORY & STORE VALUATION') && invText.includes('Mechanical Spares')) {
      console.log(`  ✅ [PASS] Template 5 (Store Inventory & Valuation Digest) generated (${invText.length} chars)`);
      passed++;
    } else {
      console.error('  ❌ [FAIL] Template 5 generation failed');
      failed++;
    }

  } catch (err) {
    console.error('❌ [ERROR] Test suite exception:', err);
    failed++;
  } finally {
    await pool.end();
  }

  console.log('\n===============================================================');
  console.log(`🏁 TEST SUMMARY: ${passed} PASSED | ${failed} FAILED`);
  console.log('===============================================================');

  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
