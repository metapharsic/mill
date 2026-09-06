const XLSX = require('xlsx');
const pool = require('../db/pool');

/**
 * MK Paper Mill — Enterprise Inventory Excel Exporter
 * Generates multi-sheet, category-wise, formatted Excel workbooks
 * with live database calculations, daily stock rollover, and store manager options.
 */

function getStoreTypeFilter(storeType, prefix = 'mc') {
  if (!storeType || storeType === 'all_store' || storeType === 'store') {
    return `(${prefix}.type IN ('Mechanical', 'Electrical', 'Consumable', 'Spare Part', 'Raw Material') OR ${prefix}.id IN (28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,50,51,52,53,54,55,56,57,58,59,60,61,62,63,64))`;
  }
  if (storeType === 'mechanical') {
    return `(${prefix}.type = 'Mechanical' OR ${prefix}.name ILIKE '%Mech%' OR ${prefix}.code LIKE 'MECH%' OR ${prefix}.id IN (31,36,39,40,41,42,43,44,45,46,47,48,49,50,51,52,53,54,55))`;
  }
  if (storeType === 'electrical') {
    return `(${prefix}.type = 'Electrical' OR ${prefix}.name ILIKE '%Elec%' OR ${prefix}.code LIKE 'ELEC%' OR ${prefix}.id IN (30,56,57,58,59,60))`;
  }
  if (storeType === 'consumable') {
    return `(${prefix}.type = 'Consumable' OR ${prefix}.id IN (29,33,34,35))`;
  }
  if (storeType === 'chemical') {
    return `(${prefix}.id = 28 OR ${prefix}.code LIKE 'CHEM%' OR ${prefix}.name ILIKE '%Chem%' OR ${prefix}.name ILIKE '%Chemical%')`;
  }
  if (storeType === 'all') {
    return '1=1';
  }
  return '1=1';
}

function sanitizeSheetName(name, existingNames = new Set()) {
  let cleaned = (name || 'Sheet')
    .replace(/[\\/*?:[\]]/g, '')
    .trim()
    .slice(0, 28);
  if (!cleaned) cleaned = 'Category';
  let candidate = cleaned;
  let counter = 1;
  while (existingNames.has(candidate.toLowerCase())) {
    candidate = `${cleaned.slice(0, 25)}_${counter++}`;
  }
  existingNames.add(candidate.toLowerCase());
  return candidate;
}

function autoFitColumns(aoa) {
  const colWidths = [];
  for (const row of aoa) {
    if (!Array.isArray(row)) continue;
    row.forEach((val, colIdx) => {
      const str = val == null ? '' : String(val);
      const len = str.length;
      colWidths[colIdx] = Math.max(colWidths[colIdx] || 10, Math.min(len + 3, 50));
    });
  }
  return colWidths.map(w => ({ wch: w }));
}

async function generateInventoryExcel(options = {}) {
  const {
    store_type = 'all',
    category_id,
    stock_status = 'all',
    criticality = 'all',
    section_id,
    machine_id,
    search,
    include_category_sheets = true,
    include_summary_sheet = true,
    include_reorder_sheet = true,
    include_high_value_sheet = false,
    include_slow_moving_sheet = false,
    include_pricing = true,
    include_technical = true,
    include_movement = true,
    target_date,
    user_name = 'Store Manager'
  } = options;

  const conditions = ['m.is_active = true'];
  const params = [];
  let p = 1;

  if (category_id) {
    conditions.push(`m.category_id = $${p++}`);
    params.push(parseInt(category_id));
  } else if (store_type && store_type !== 'all') {
    conditions.push(getStoreTypeFilter(store_type, 'mc'));
  }

  if (stock_status === 'in_stock') {
    conditions.push(`m.current_stock > 0`);
  } else if (stock_status === 'low_stock') {
    conditions.push(`m.current_stock <= m.reorder_level`);
  } else if (stock_status === 'out_of_stock') {
    conditions.push(`m.current_stock <= 0`);
  }

  if (criticality && criticality !== 'all') {
    conditions.push(`UPPER(m.criticality_class) = $${p++}`);
    params.push(criticality.toUpperCase());
  }

  if (section_id) {
    conditions.push(`m.section_id = $${p++}`);
    params.push(parseInt(section_id));
  }

  if (machine_id) {
    conditions.push(`m.machine_id = $${p++}`);
    params.push(parseInt(machine_id));
  }

  if (search) {
    conditions.push(`(m.name ILIKE $${p} OR m.code ILIKE $${p} OR m.hsn_code ILIKE $${p} OR m.bin_location ILIKE $${p})`);
    params.push(`%${search}%`);
    p++;
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  // Main data query with dynamic roll-over calculations
  const query = `
    SELECT 
      m.id,
      m.code,
      m.name,
      m.category_id,
      COALESCE(mc.name, 'Uncategorized') AS category_name,
      COALESCE(mc.code, 'GEN') AS category_code,
      COALESCE(mc.type, 'General') AS category_type,
      m.section_id,
      ps.name AS section_name,
      ps.section_code AS section_code,
      m.machine_id,
      mac.name AS machine_name,
      m.section_equipment_id,
      se.equipment_name AS section_equipment_name,
      COALESCE(m.criticality_class, 'C') AS criticality_class,
      COALESCE(m.uom, 'NOS') AS uom,
      COALESCE(m.bin_location, '-') AS bin_location,
      COALESCE(m.hsn_code, '-') AS hsn_code,
      COALESCE(m.min_stock, 0) AS min_stock,
      COALESCE(m.reorder_level, 0) AS reorder_level,
      COALESCE(m.max_stock, 0) AS max_stock,
      COALESCE(m.current_stock, 0) AS current_stock,
      COALESCE(m.unit_price, 0) AS unit_price,
      (COALESCE(m.current_stock, 0) * COALESCE(m.unit_price, 0)) AS valuation,
      COALESCE(m.procurement_strategy, 'Standard') AS procurement_strategy,
      COALESCE(m.oem_supplier, '-') AS oem_supplier,
      COALESCE(m.calibration_protocol, '-') AS calibration_protocol,
      COALESCE(m.last_audit_cycle, '-') AS last_audit_cycle,
      COALESCE(m.expected_lifespan_days, 365) AS expected_lifespan_days,
      m.is_active,
      m.created_at,
      COALESCE((SELECT COUNT(DISTINCT pi.po_id) FROM po_items pi WHERE pi.material_id = m.id), 0)::int AS po_count,
      (
        SELECT v.name FROM po_items pi
        JOIN purchase_orders po ON po.id = pi.po_id
        JOIN vendors v ON v.id = po.vendor_id
        WHERE pi.material_id = m.id
        ORDER BY po.date DESC NULLS LAST, po.id DESC
        LIMIT 1
      ) AS last_vendor_name,
      (
        SELECT v.gstin FROM po_items pi
        JOIN purchase_orders po ON po.id = pi.po_id
        JOIN vendors v ON v.id = po.vendor_id
        WHERE pi.material_id = m.id
        ORDER BY po.date DESC NULLS LAST, po.id DESC
        LIMIT 1
      ) AS last_vendor_gstin,
      COALESCE((SELECT SUM(sl.in_qty) FROM stock_ledger sl WHERE sl.material_id = m.id AND sl.date = CURRENT_DATE AND sl.transaction_type != 'opening'), 0) AS today_received,
      COALESCE((SELECT SUM(sl.out_qty) FROM stock_ledger sl WHERE sl.material_id = m.id AND sl.date = CURRENT_DATE AND sl.transaction_type != 'opening'), 0) AS today_issued,
      (SELECT MAX(sl.date)::text FROM stock_ledger sl WHERE sl.material_id = m.id) AS last_txn_date
    FROM materials m
    LEFT JOIN material_categories mc ON mc.id = m.category_id
    LEFT JOIN plant_sections ps ON ps.id = m.section_id
    LEFT JOIN machines mac ON mac.id = m.machine_id
    LEFT JOIN section_equipment se ON se.id = m.section_equipment_id
    ${whereClause}
    ORDER BY mc.name ASC, m.code ASC
  `;

  const { rows } = await pool.query(query, params);

  // Process rows with roll-over math
  const processedRows = rows.map(r => {
    const curStock = parseFloat(r.current_stock || 0);
    const todayRec = parseFloat(r.today_received || 0);
    const todayIss = parseFloat(r.today_issued || 0);
    const unitPrice = parseFloat(r.unit_price || 0);
    const minStock = parseFloat(r.min_stock || 0);
    const reorderLvl = parseFloat(r.reorder_level || 0);
    const maxStock = parseFloat(r.max_stock || 0);

    const openingStock = parseFloat((curStock - todayRec + todayIss).toFixed(3));
    const valuation = parseFloat((curStock * unitPrice).toFixed(2));

    let status = 'Normal';
    if (curStock <= 0) {
      status = 'Out of Stock';
    } else if (curStock <= reorderLvl) {
      status = 'Low Stock (Reorder)';
    } else if (maxStock > 0 && curStock > maxStock) {
      status = 'Overstocked';
    }

    const shortfall = Math.max(0, parseFloat((reorderLvl - curStock).toFixed(3)));
    const replenishmentCost = parseFloat((shortfall * unitPrice).toFixed(2));

    return {
      ...r,
      opening_stock: openingStock,
      today_received: todayRec,
      today_issued: todayIss,
      current_stock: curStock,
      unit_price: unitPrice,
      valuation,
      status,
      shortfall,
      replenishment_cost: replenishmentCost,
      min_stock: minStock,
      reorder_level: reorderLvl,
      max_stock: maxStock
    };
  });

  // Calculate Global Aggregates
  const totalSKUs = processedRows.length;
  const totalUnits = processedRows.reduce((acc, r) => acc + r.current_stock, 0);
  const totalValuation = processedRows.reduce((acc, r) => acc + r.valuation, 0);
  const lowStockCount = processedRows.filter(r => r.current_stock <= r.reorder_level && r.current_stock > 0).length;
  const outOfStockCount = processedRows.filter(r => r.current_stock <= 0).length;
  const totalTodayIn = processedRows.reduce((acc, r) => acc + r.today_received, 0);
  const totalTodayOut = processedRows.reduce((acc, r) => acc + r.today_issued, 0);
  const totalReplenishmentInvestment = processedRows.reduce((acc, r) => acc + r.replenishment_cost, 0);

  // Group by Category
  const categoryGroups = new Map();
  processedRows.forEach(r => {
    const catName = r.category_name || 'Uncategorized';
    if (!categoryGroups.has(catName)) {
      categoryGroups.set(catName, {
        name: catName,
        code: r.category_code,
        type: r.category_type,
        items: [],
        totalUnits: 0,
        totalValuation: 0,
        lowStockItems: 0,
        outOfStockItems: 0,
        todayIn: 0,
        todayOut: 0
      });
    }
    const grp = categoryGroups.get(catName);
    grp.items.push(r);
    grp.totalUnits += r.current_stock;
    grp.totalValuation += r.valuation;
    if (r.current_stock <= r.reorder_level && r.current_stock > 0) grp.lowStockItems++;
    if (r.current_stock <= 0) grp.outOfStockItems++;
    grp.todayIn += r.today_received;
    grp.todayOut += r.today_issued;
  });

  // Build Excel Workbook
  const wb = XLSX.utils.book_new();
  wb.Props = {
    Title: 'Sri M.K. Paper Mills Pvt. Ltd. — Enterprise Inventory Master Ledger',
    Subject: 'Live Multi-Sheet Inventory & Working Capital Valuation Audit',
    Author: 'Sri M.K. Paper Mills Pvt. Ltd.',
    Company: 'Sri M.K. Paper Mills Pvt. Ltd.',
    Category: 'Enterprise Store Management & Inventory Ledger',
    Comments: 'OFFICIAL SYSTEM WATERMARK: SRI M.K. PAPER MILLS PVT. LTD. — CONFIDENTIAL'
  };

  const existingSheetNames = new Set();
  const reportDate = target_date || new Date().toISOString().slice(0, 10);
  const genTime = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

  // ─────────────────────────────────────────────────────────────────────────────
  // SHEET 1: 📊 Executive Summary & Category Breakdown
  // ─────────────────────────────────────────────────────────────────────────────
  if (include_summary_sheet) {
    const summaryData = [
      ['SRI M.K. PAPER MILLS PVT. LTD.'],
      ['PLANT: SURVEY NO. 128/1, INDUSTRIAL AREA, VILLAGE GANGUR, DIST. DHARWAD - 580011, KARNATAKA'],
      ['GSTIN: 29AABCS1234F1Z8 | CIN: U21012KA2015PTC081234 | STATE CODE: 29 (KARNATAKA)'],
      ['LIVE ENTERPRISE INVENTORY & CATEGORY VALUATION MASTER REPORT [WATERMARK: OFFICIAL AUDIT LEDGER]'],
      [''],
      ['Report Date:', reportDate, 'Generated At:', genTime, 'Generated By:', user_name],
      ['Store Scope:', store_type.toUpperCase(), 'Status Filter:', stock_status.toUpperCase(), 'Criticality:', criticality.toUpperCase()],
      [''],
      ['───────────────────────────────────────────────────────────────────────────────────────────────────'],
      ['📊 EXECUTIVE INVENTORY KPI SUMMARY DASHBOARD'],
      ['───────────────────────────────────────────────────────────────────────────────────────────────────'],
      ['Key Metric', 'Metric Value', 'Unit / Details', 'Financial / Operational Impact'],
      ['Total Active Material SKUs', totalSKUs, 'Items / Catalog Records', 'Mill-wide active inventory items'],
      ['Total Physical Stock In Hand', parseFloat(totalUnits.toFixed(3)), 'Combined Units', 'All stores aggregate quantity'],
      ['Total Inventory Valuation', parseFloat(totalValuation.toFixed(2)), '₹ INR', 'Live computed stock valuation (Qty × Unit Price)'],
      ['Items Below Reorder Level', lowStockCount, 'SKUs', 'Immediate replenishment required'],
      ['Zero Stock (Out of Stock)', outOfStockCount, 'SKUs', 'Critical stockout alert'],
      ['Today Total Inward Receipts (GRN)', parseFloat(totalTodayIn.toFixed(3)), 'Units (Today)', 'Material received today'],
      ['Today Total Outward Issues (Plant)', parseFloat(totalTodayOut.toFixed(3)), 'Units (Today)', 'Material issued today'],
      ['Est. Reorder Replenishment Cost', parseFloat(totalReplenishmentInvestment.toFixed(2)), '₹ INR', 'Capital required to bring stock to reorder level'],
      [''],
      ['───────────────────────────────────────────────────────────────────────────────────────────────────'],
      ['📑 CATEGORY-WISE INVENTORY & VALUATION BREAKDOWN'],
      ['───────────────────────────────────────────────────────────────────────────────────────────────────'],
      [
        'Sr No',
        'Category Name',
        'Category Code',
        'Category Type',
        'Total Items (SKU)',
        'Stock in Hand (Units)',
        'Valuation (₹)',
        '% Value Share',
        'Low Stock SKUs',
        'Zero Stock SKUs',
        'Today Inward',
        'Today Outward'
      ]
    ];

    let srNo = 1;
    Array.from(categoryGroups.values()).sort((a, b) => b.totalValuation - a.totalValuation || b.items.length - a.items.length).forEach(grp => {
      const pctShare = totalValuation > 0 ? parseFloat(((grp.totalValuation / totalValuation) * 100).toFixed(2)) : 0;
      summaryData.push([
        srNo++,
        grp.name,
        grp.code,
        grp.type,
        grp.items.length,
        parseFloat(grp.totalUnits.toFixed(3)),
        parseFloat(grp.totalValuation.toFixed(2)),
        `${pctShare}%`,
        grp.lowStockItems,
        grp.outOfStockItems,
        parseFloat(grp.todayIn.toFixed(3)),
        parseFloat(grp.todayOut.toFixed(3))
      ]);
    });

    // Summary Total Row
    summaryData.push([
      'TOTAL',
      'MILL-WIDE AGGREGATE',
      'ALL',
      'ALL TYPES',
      totalSKUs,
      parseFloat(totalUnits.toFixed(3)),
      parseFloat(totalValuation.toFixed(2)),
      '100.00%',
      lowStockCount,
      outOfStockCount,
      parseFloat(totalTodayIn.toFixed(3)),
      parseFloat(totalTodayOut.toFixed(3))
    ]);

    const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
    wsSummary['!cols'] = autoFitColumns(summaryData);
    const summarySheetName = sanitizeSheetName('📊 Executive Summary', existingSheetNames);
    XLSX.utils.book_append_sheet(wb, wsSummary, summarySheetName);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // SHEET 2: 📦 Complete Inventory Master Ledger
  // ─────────────────────────────────────────────────────────────────────────────
  function buildMasterHeader() {
    const headers = ['Sr No', 'Item Code', 'Item Description', 'Category', 'Category Type', 'Plant Section', 'Machine / Equipment', 'Crit Class', 'UOM', 'Rack / Box'];
    if (include_movement) {
      headers.push('Opening Stock (Yesterday)', 'Received (Today)', 'Issued (Today)', 'Current Balance (Today)');
    } else {
      headers.push('Current Stock Balance');
    }
    if (include_pricing) {
      headers.push('Unit Price (₹)', 'Total Valuation (₹)');
    }
    headers.push('Min Stock', 'Reorder Level', 'Max Stock', 'Stock Status');
    if (include_technical) {
      headers.push('HSN Code', 'Procurement Strategy', 'OEM / Supplier', 'Lifespan (Days)', 'Calibration', 'Last Audit Cycle', 'Linked POs', 'Vendor Name (Last PO)', 'Vendor GSTIN (Last PO)', 'Last Txn Date');
    }
    return headers;
  }

  function formatMasterRow(r, index) {
    const row = [
      index + 1,
      r.code,
      r.name,
      r.category_name,
      r.category_type,
      r.section_name || '-',
      r.machine_name || r.section_equipment_name || '-',
      r.criticality_class,
      r.uom,
      r.bin_location
    ];

    if (include_movement) {
      row.push(r.opening_stock, r.today_received, r.today_issued, r.current_stock);
    } else {
      row.push(r.current_stock);
    }

    if (include_pricing) {
      row.push(r.unit_price, r.valuation);
    }

    row.push(r.min_stock, r.reorder_level, r.max_stock, r.status);

    if (include_technical) {
      row.push(
        r.hsn_code,
        r.procurement_strategy,
        r.oem_supplier,
        r.expected_lifespan_days,
        r.calibration_protocol,
        r.last_audit_cycle,
        r.po_count,
        r.last_vendor_name || '-',
        r.last_vendor_gstin || '-',
        r.last_txn_date || '-'
      );
    }
    return row;
  }

  const masterHeaders = buildMasterHeader();
  const masterData = [
    ['MK PAPER MILL — COMPLETE LIVE INVENTORY MASTER LEDGER'],
    [`Generated: ${genTime} | Total Records: ${totalSKUs} | Total Valuation: ₹${totalValuation.toLocaleString('en-IN')}`],
    [''],
    masterHeaders
  ];

  processedRows.forEach((r, idx) => {
    masterData.push(formatMasterRow(r, idx));
  });

  // Master Total Row
  const totalRow = ['TOTAL', `TOTAL ITEMS: ${totalSKUs}`, '', '', '', '', '', '', '', ''];
  if (include_movement) {
    totalRow.push(
      parseFloat((totalUnits - totalTodayIn + totalTodayOut).toFixed(3)),
      parseFloat(totalTodayIn.toFixed(3)),
      parseFloat(totalTodayOut.toFixed(3)),
      parseFloat(totalUnits.toFixed(3))
    );
  } else {
    totalRow.push(parseFloat(totalUnits.toFixed(3)));
  }
  if (include_pricing) {
    totalRow.push('', parseFloat(totalValuation.toFixed(2)));
  }
  totalRow.push('', '', '', '');
  if (include_technical) {
    totalRow.push('', '', '', '', '', '', '', '', '', '');
  }
  masterData.push(totalRow);

  const wsMaster = XLSX.utils.aoa_to_sheet(masterData);
  wsMaster['!cols'] = autoFitColumns(masterData);
  const masterSheetName = sanitizeSheetName('📦 Complete Inventory', existingSheetNames);
  XLSX.utils.book_append_sheet(wb, wsMaster, masterSheetName);

  // ─────────────────────────────────────────────────────────────────────────────
  // SHEETS 3..N: Dedicated Category Sheets
  // ─────────────────────────────────────────────────────────────────────────────
  if (include_category_sheets && categoryGroups.size > 1) {
    categoryGroups.forEach((grp, catName) => {
      if (!grp.items.length) return;
      const catSheetData = [
        [`MK PAPER MILL — ${catName.toUpperCase()} INVENTORY SHEET`],
        [`Category: ${catName} (${grp.code}) | Type: ${grp.type} | Total Items: ${grp.items.length} | Valuation: ₹${grp.totalValuation.toLocaleString('en-IN')}`],
        [''],
        masterHeaders
      ];

      grp.items.forEach((item, i) => {
        catSheetData.push(formatMasterRow(item, i));
      });

      // Category total row
      const catTotalRow = ['TOTAL', `${grp.items.length} ITEMS`, '', '', '', '', '', '', '', ''];
      if (include_movement) {
        catTotalRow.push(
          parseFloat((grp.totalUnits - grp.todayIn + grp.todayOut).toFixed(3)),
          parseFloat(grp.todayIn.toFixed(3)),
          parseFloat(grp.todayOut.toFixed(3)),
          parseFloat(grp.totalUnits.toFixed(3))
        );
      } else {
        catTotalRow.push(parseFloat(grp.totalUnits.toFixed(3)));
      }
      if (include_pricing) {
        catTotalRow.push('', parseFloat(grp.totalValuation.toFixed(2)));
      }
      catTotalRow.push('', '', '', '');
      if (include_technical) {
        catTotalRow.push('', '', '', '', '', '', '', '', '', '');
      }
      catSheetData.push(catTotalRow);

      const wsCat = XLSX.utils.aoa_to_sheet(catSheetData);
      wsCat['!cols'] = autoFitColumns(catSheetData);
      const sheetName = sanitizeSheetName(grp.name, existingSheetNames);
      XLSX.utils.book_append_sheet(wb, wsCat, sheetName);
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // SHEET: ⚠️ Critical & Reorder Alerts
  // ─────────────────────────────────────────────────────────────────────────────
  if (include_reorder_sheet) {
    const alertItems = processedRows.filter(r => r.current_stock <= r.reorder_level);
    const alertData = [
      ['MK PAPER MILL — CRITICAL LOW-STOCK & REORDER SHORTFALL ACTION REPORT'],
      [`Generated: ${genTime} | Urgent Action Items: ${alertItems.length} | Est. Replenishment Cost: ₹${totalReplenishmentInvestment.toLocaleString('en-IN')}`],
      [''],
      [
        'Sr No',
        'Criticality',
        'Item Code',
        'Item Description',
        'Category',
        'Plant Section',
        'Rack / Box',
        'UOM',
        'Current Stock',
        'Reorder Level',
        'Minimum Stock',
        'Shortfall Units',
        'Unit Price (₹)',
        'Est. Replenishment Cost (₹)',
        'Stock Condition',
        'Procurement Strategy',
        'OEM / Supplier',
        'Open POs',
        'Vendor Name (Last PO)',
        'Vendor GSTIN (Last PO)'
      ]
    ];

    alertItems
      .sort((a, b) => {
        const critOrder = { A: 1, B: 2, C: 3 };
        const cA = critOrder[a.criticality_class] || 99;
        const cB = critOrder[b.criticality_class] || 99;
        if (cA !== cB) return cA - cB;
        return b.replenishment_cost - a.replenishment_cost;
      })
      .forEach((r, idx) => {
        alertData.push([
          idx + 1,
          r.criticality_class,
          r.code,
          r.name,
          r.category_name,
          r.section_name || '-',
          r.bin_location,
          r.uom,
          r.current_stock,
          r.reorder_level,
          r.min_stock,
          r.shortfall,
          r.unit_price,
          r.replenishment_cost,
          r.status,
          r.procurement_strategy,
          r.oem_supplier,
          r.po_count,
          r.last_vendor_name || '-',
          r.last_vendor_gstin || '-'
        ]);
      });

    // Alert Total Row
    alertData.push([
      'TOTAL',
      'URGENT',
      `${alertItems.length} ITEMS`,
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      parseFloat(alertItems.reduce((acc, r) => acc + r.shortfall, 0).toFixed(3)),
      '',
      parseFloat(totalReplenishmentInvestment.toFixed(2)),
      '',
      '',
      '',
      '',
      '',
      ''
    ]);

    const wsAlert = XLSX.utils.aoa_to_sheet(alertData);
    wsAlert['!cols'] = autoFitColumns(alertData);
    const alertSheetName = sanitizeSheetName('⚠️ Reorder & Low Stock', existingSheetNames);
    XLSX.utils.book_append_sheet(wb, wsAlert, alertSheetName);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // SHEET: 💰 Class A High Value Strategic Inventory
  // ─────────────────────────────────────────────────────────────────────────────
  if (include_high_value_sheet) {
    const highValItems = processedRows
      .filter(r => r.valuation > 0 || r.criticality_class === 'A')
      .sort((a, b) => b.valuation - a.valuation);

    const highValData = [
      ['MK PAPER MILL — STRATEGIC HIGH-VALUATION & CLASS A INVENTORY AUDIT'],
      [`Generated: ${genTime} | Total Strategic Items: ${highValItems.length} | Combined Valuation: ₹${highValItems.reduce((acc, r) => acc + r.valuation, 0).toLocaleString('en-IN')}`],
      [''],
      [
        'Rank',
        'Item Code',
        'Item Description',
        'Category',
        'Plant Section',
        'Machine',
        'Crit Class',
        'UOM',
        'Current Stock',
        'Unit Price (₹)',
        'Total Valuation (₹)',
        '% Portfolio Share',
        'Rack / Box',
        'Min Stock',
        'Reorder Level',
        'Status',
        'Last Vendor (PO)'
      ]
    ];

    highValItems.forEach((r, idx) => {
      const share = totalValuation > 0 ? parseFloat(((r.valuation / totalValuation) * 100).toFixed(2)) : 0;
      highValData.push([
        idx + 1,
        r.code,
        r.name,
        r.category_name,
        r.section_name || '-',
        r.machine_name || '-',
        r.criticality_class,
        r.uom,
        r.current_stock,
        r.unit_price,
        r.valuation,
        `${share}%`,
        r.bin_location,
        r.min_stock,
        r.reorder_level,
        r.status,
        r.last_vendor_name || '-'
      ]);
    });

    const wsHighVal = XLSX.utils.aoa_to_sheet(highValData);
    wsHighVal['!cols'] = autoFitColumns(highValData);
    const highValSheetName = sanitizeSheetName('💰 Class A High Value', existingSheetNames);
    XLSX.utils.book_append_sheet(wb, wsHighVal, highValSheetName);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // SHEET: ⏳ Slow & Dead Stock Capital Recovery
  // ─────────────────────────────────────────────────────────────────────────────
  if (include_slow_moving_sheet) {
    const slowMovingItems = processedRows
      .filter(r => r.current_stock > 0 && (!r.last_txn_date || (new Date() - new Date(r.last_txn_date)) / (1000 * 60 * 60 * 24) > 60))
      .sort((a, b) => b.valuation - a.valuation);

    const slowMovingData = [
      ['MK PAPER MILL — SLOW & DEAD STOCK CAPITAL RECOVERY AUDIT'],
      [`Generated: ${genTime} | Inactive Items (>60 Days): ${slowMovingItems.length} | Locked Working Capital: ₹${slowMovingItems.reduce((acc, r) => acc + r.valuation, 0).toLocaleString('en-IN')}`],
      [''],
      [
        'Sr No',
        'Item Code',
        'Item Description',
        'Category',
        'Plant Section',
        'Rack / Box',
        'UOM',
        'Current Stock (Dormant)',
        'Unit Price (₹)',
        'Locked Capital (₹)',
        'Crit Class',
        'Last Transaction Date',
        'Days Inactive',
        'Action Recommendation'
      ]
    ];

    slowMovingItems.forEach((r, idx) => {
      const daysInactive = r.last_txn_date ? Math.floor((new Date() - new Date(r.last_txn_date)) / (1000 * 60 * 60 * 24)) : '>180';
      slowMovingData.push([
        idx + 1,
        r.code,
        r.name,
        r.category_name,
        r.section_name || '-',
        r.bin_location,
        r.uom,
        r.current_stock,
        r.unit_price,
        r.valuation,
        r.criticality_class,
        r.last_txn_date || 'No Movement Recorded',
        daysInactive,
        r.valuation > 50000 ? 'Audit Physical Condition / Review Machine Need' : 'Store Re-allocation / Scrap Consideration'
      ]);
    });

    const wsSlow = XLSX.utils.aoa_to_sheet(slowMovingData);
    wsSlow['!cols'] = autoFitColumns(slowMovingData);
    const slowSheetName = sanitizeSheetName('⏳ Slow & Dead Stock', existingSheetNames);
    XLSX.utils.book_append_sheet(wb, wsSlow, slowSheetName);
  }

  const fileBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  const filenameStamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const filename = `MK_Mill_Inventory_${store_type}_${filenameStamp}.xlsx`;

  return {
    buffer: fileBuffer,
    filename,
    meta: {
      totalSKUs,
      totalUnits,
      totalValuation,
      lowStockCount,
      outOfStockCount,
      categoriesCount: categoryGroups.size,
      sheetsCount: wb.SheetNames.length,
      sheetNames: wb.SheetNames
    }
  };
}

async function generateSingleItemHistoryExcel(materialId) {
  const { rows: [mat] } = await pool.query(`
    SELECT m.*, mc.name AS category_name, mc.code AS category_code
    FROM materials m
    LEFT JOIN material_categories mc ON m.category_id = mc.id
    WHERE m.id = $1
  `, [materialId]);

  if (!mat) throw new Error('Material not found');

  const { rows: history } = await pool.query(`
    SELECT 
      sl.id,
      sl.date,
      sl.transaction_type,
      sl.reference_type,
      sl.reference_id,
      sl.in_qty,
      sl.out_qty,
      sl.balance,
      sl.unit_price,
      sl.value,
      sl.batch_number,
      sl.remarks,
      sl.created_at,
      u.name AS created_by_name,
      v.name AS vendor_name,
      g.grn_number,
      ind.indent_number,
      dept.name AS department_name
    FROM stock_ledger sl
    LEFT JOIN users u ON sl.created_by = u.id
    LEFT JOIN vendors v ON sl.vendor_id = v.id
    LEFT JOIN grn g ON (sl.reference_type = 'GRN' AND CASE WHEN sl.reference_id::text ~ '^[0-9]+$' THEN sl.reference_id::int = g.id ELSE FALSE END)
    LEFT JOIN indents ind ON ((sl.reference_type ILIKE 'indent%' OR sl.reference_type ILIKE 'issue%') AND CASE WHEN sl.reference_id::text ~ '^[0-9]+$' THEN sl.reference_id::int = ind.id ELSE FALSE END)
    LEFT JOIN departments dept ON (ind.department_id = dept.id OR u.department_id = dept.id)
    WHERE sl.material_id = $1
    ORDER BY sl.date DESC, sl.id DESC
  `, [materialId]);

  const { rows: deptBreakdown } = await pool.query(`
    SELECT 
      COALESCE(d.name, 'General Mill Operations') AS department_name,
      COUNT(sl.id) AS issue_count,
      SUM(sl.out_qty) AS total_issued_qty,
      SUM(sl.value) AS total_issued_value
    FROM stock_ledger sl
    LEFT JOIN indents ind ON ((sl.reference_type ILIKE 'indent%' OR sl.reference_type ILIKE 'issue%') AND CASE WHEN sl.reference_id::text ~ '^[0-9]+$' THEN sl.reference_id::int = ind.id ELSE FALSE END)
    LEFT JOIN users u ON sl.created_by = u.id
    LEFT JOIN departments d ON (ind.department_id = d.id OR u.department_id = d.id)
    WHERE sl.material_id = $1 AND sl.out_qty > 0
    GROUP BY d.name
    ORDER BY total_issued_qty DESC
  `, [materialId]);

  const { rows: sectionAllocations } = await pool.query(`
    SELECT 
      ps.name AS section_name,
      ps.section_code,
      se.equipment_name,
      se.tag_name
    FROM material_sections ms
    JOIN plant_sections ps ON ms.section_id = ps.id
    LEFT JOIN material_equipment me ON me.material_id = ms.material_id
    LEFT JOIN section_equipment se ON me.section_equipment_id = se.id
    WHERE ms.material_id = $1
  `, [materialId]);

  const wb = XLSX.utils.book_new();

  // SHEET 1: PRODUCT SPECIFICATIONS
  const specData = [
    ['SRI M.K. PAPER MILLS PRIVATE LIMITED'],
    ['MATERIAL MASTER SPECIFICATIONS & INVENTORY AUDIT REPORT'],
    [`Generated On: ${new Date().toLocaleString('en-IN')}`],
    [''],
    ['ATTRIBUTES', 'VALUE'],
    ['Material Code / SKU', mat.code],
    ['Material Description', mat.name],
    ['Category', mat.category_name || 'Store Item'],
    ['Unit of Measure (UOM)', mat.uom],
    ['Current Stock Balance', `${parseFloat(mat.current_stock || 0).toLocaleString('en-IN')} ${mat.uom}`],
    ['Unit Price (₹)', parseFloat(mat.unit_price || 0)],
    ['Total Valuation (₹)', parseFloat(mat.current_stock || 0) * parseFloat(mat.unit_price || 0)],
    ['Reorder Level', mat.reorder_level || 0],
    ['Min Stock Level', mat.min_stock || 0],
    ['Max Stock Level', mat.max_stock || 0],
    ['Bin Location', mat.bin_location || 'Unassigned'],
    ['HSN Code', mat.hsn_code || '-'],
    ['Criticality Class', mat.criticality_class || 'C'],
    ['Procurement Strategy', mat.procurement_strategy || '-'],
    ['OEM / Vendor Supplier', mat.oem_supplier || '-'],
    [''],
    ['ASSIGNED PLANT SECTIONS & EQUIPMENT CONTEXT'],
    ['Section Code', 'Section Name', 'Machine Name', 'Equipment Tag']
  ];

  if (sectionAllocations.length === 0) {
    specData.push(['-', 'General Store / Unassigned', '-', '-']);
  } else {
    sectionAllocations.forEach(sec => {
      specData.push([sec.section_code || 'SEC', sec.section_name, sec.machine_name || '-', `${sec.equipment_name || ''} (${sec.tag_name || ''})`]);
    });
  }

  const wsSpec = XLSX.utils.aoa_to_sheet(specData);
  wsSpec['!cols'] = autoFitColumns(specData);
  XLSX.utils.book_append_sheet(wb, wsSpec, 'Product Summary');

  // SHEET 2: COMPLETE TRANSACTION LEDGER
  const ledgerData = [
    ['SRI M.K. PAPER MILLS PRIVATE LIMITED'],
    [`COMPLETE TRANSACTION LEDGER — ${mat.code} (${mat.name})`],
    [`Total Records: ${history.length}`],
    [''],
    ['S.No', 'Date & Time', 'Txn Type', 'In Qty', 'Out Qty', 'Balance Stock', 'Rate (₹)', 'Transaction Value (₹)', 'Department / Indent', 'Vendor Name / GRN #', 'Batch Number', 'Logged By', 'Remarks']
  ];

  let totIn = 0;
  let totOut = 0;
  let totVal = 0;

  history.forEach((h, idx) => {
    const inQty = parseFloat(h.in_qty || 0);
    const outQty = parseFloat(h.out_qty || 0);
    const val = parseFloat(h.value || 0);
    totIn += inQty;
    totOut += outQty;
    totVal += val;

    ledgerData.push([
      idx + 1,
      h.date ? String(h.date).slice(0, 10) : (h.created_at ? new Date(h.created_at).toLocaleDateString() : '-'),
      (h.transaction_type || 'TXN').toUpperCase(),
      inQty > 0 ? inQty : 0,
      outQty > 0 ? outQty : 0,
      parseFloat(h.balance || 0),
      parseFloat(h.unit_price || 0),
      val,
      h.department_name || (h.indent_number ? `Indent: ${h.indent_number}` : '-'),
      h.vendor_name || (h.grn_number ? `GRN: ${h.grn_number}` : '-'),
      h.batch_number || '-',
      h.created_by_name || 'System',
      h.remarks || '-'
    ]);
  });

  ledgerData.push(['']);
  ledgerData.push(['TOTALS', '', '', totIn, totOut, '', '', totVal, '', '', '', '', '']);

  const wsLedger = XLSX.utils.aoa_to_sheet(ledgerData);
  wsLedger['!cols'] = autoFitColumns(ledgerData);
  XLSX.utils.book_append_sheet(wb, wsLedger, 'Transaction Ledger');

  // SHEET 3: DEPARTMENT CONSUMPTION USAGE
  const deptData = [
    ['SRI M.K. PAPER MILLS PRIVATE LIMITED'],
    [`DEPARTMENT USAGE & CONSUMPTION BREAKDOWN — ${mat.code}`],
    [''],
    ['S.No', 'Department Name', 'Total Issues Count', 'Total Issued Quantity', 'UOM', 'Total Issued Value (₹)']
  ];

  deptBreakdown.forEach((d, idx) => {
    deptData.push([
      idx + 1,
      d.department_name,
      parseInt(d.issue_count || 0),
      parseFloat(d.total_issued_qty || 0),
      mat.uom,
      parseFloat(d.total_issued_value || 0)
    ]);
  });

  const wsDept = XLSX.utils.aoa_to_sheet(deptData);
  wsDept['!cols'] = autoFitColumns(deptData);
  XLSX.utils.book_append_sheet(wb, wsDept, 'Department Usage');

  const fileBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  const sanitizedCode = (mat.code || 'ITEM').replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `MK_Mill_Item_History_${sanitizedCode}_${new Date().toISOString().slice(0, 10)}.xlsx`;

  return { buffer: fileBuffer, filename };
}

async function generateItemConsumptionExcel(options = {}) {
  const { from, to, departmentId, categoryId, materialId } = options;
  
  const params = [];
  const dateFilter = [];
  if (from) { params.push(from); dateFilter.push(`sl.date >= $${params.length}`); }
  if (to)   { params.push(to);   dateFilter.push(`sl.date <= $${params.length}`); }
  const dateClause = dateFilter.length ? 'AND ' + dateFilter.join(' AND ') : '';

  const matFilter = [];
  if (materialId) { params.push(materialId); matFilter.push(`m.id = $${params.length}`); }
  if (categoryId) { params.push(categoryId); matFilter.push(`m.category_id = $${params.length}`); }
  const matClause = matFilter.length ? 'AND ' + matFilter.join(' AND ') : '';

  const itemsRes = await pool.query(`
    SELECT
      m.id, m.code, m.name, m.uom, m.current_stock, m.min_stock, m.reorder_level, m.unit_price,
      m.bin_location, mc.name AS "categoryName",
      COUNT(sl.id) FILTER (WHERE sl.transaction_type IN ('issue','out','return_to_vendor','transfer')) AS "issueCount",
      COALESCE(SUM(sl.out_qty) FILTER (WHERE sl.transaction_type IN ('issue','out','return_to_vendor','transfer')), 0) AS "totalIssuedQty",
      COALESCE(SUM(sl.value) FILTER (WHERE sl.transaction_type IN ('issue','out','return_to_vendor','transfer')), 0) AS "totalIssuedValue",
      COALESCE(SUM(sl.in_qty) FILTER (WHERE sl.transaction_type IN ('grn','return','in')), 0) AS "totalReceivedQty",
      CASE WHEN m.current_stock > 0
        THEN ROUND(COALESCE(SUM(sl.out_qty) FILTER (WHERE sl.transaction_type IN ('issue','out','return_to_vendor','transfer')), 0) / m.current_stock, 2)
        ELSE 0 END AS "turnoverRate"
    FROM materials m
    LEFT JOIN material_categories mc ON m.category_id = mc.id
    LEFT JOIN stock_ledger sl ON sl.material_id = m.id ${dateClause}
    WHERE m.is_active = true ${matClause}
    GROUP BY m.id, m.code, m.name, m.uom, m.current_stock, m.min_stock, m.reorder_level, m.unit_price, m.bin_location, mc.name
    ORDER BY "totalIssuedValue" DESC, "totalIssuedQty" DESC
    LIMIT 1000
  `, params);

  // Department wise breakdown
  const deptParams = [];
  const deptFilter = [];
  if (from) { deptParams.push(from); deptFilter.push(`si.issue_date >= $${deptParams.length}`); }
  if (to)   { deptParams.push(to);   deptFilter.push(`si.issue_date <= $${deptParams.length}`); }
  if (departmentId) { deptParams.push(departmentId); deptFilter.push(`si.department_id = $${deptParams.length}`); }
  if (materialId) { deptParams.push(materialId); deptFilter.push(`si.material_id = $${deptParams.length}`); }
  const deptClause = deptFilter.length ? 'WHERE ' + deptFilter.join(' AND ') : '';

  const deptRes = await pool.query(`
    SELECT d.name AS "deptName", m.code AS "materialCode", m.name AS "materialName", m.uom,
           COUNT(si.id)::int AS "issueCount",
           COALESCE(SUM(si.quantity), 0) AS "totalQty",
           COALESCE(SUM(si.estimated_value), 0) AS "totalValue"
    FROM store_issues si
    LEFT JOIN departments d ON si.department_id = d.id
    LEFT JOIN materials m ON si.material_id = m.id
    ${deptClause}
    GROUP BY d.name, m.code, m.name, m.uom
    ORDER BY "totalValue" DESC
    LIMIT 1000
  `, deptParams);

  const wb = XLSX.utils.book_new();

  // Sheet 1
  const s1Data = [
    ['SRI M.K. PAPER MILLS PRIVATE LIMITED'],
    [`ITEM-WISE CONSUMPTION REPORT (${from || 'Beginning'} TO ${to || 'Present'})`],
    [''],
    ['S.No', 'Material Code', 'Material Name', 'Category', 'Bin', 'Current Stock', 'UOM', 'Unit Price (₹)', 'Issued Qty', 'Issued Value (₹)', 'Received Qty', 'Turnover Rate']
  ];

  let totIssuedVal = 0;
  itemsRes.rows.forEach((it, idx) => {
    const val = parseFloat(it.totalIssuedValue || 0);
    totIssuedVal += val;
    s1Data.push([
      idx + 1,
      it.code,
      it.name,
      it.categoryName || 'General',
      it.bin_location || '—',
      parseFloat(it.current_stock || 0),
      it.uom || 'NOS',
      parseFloat(it.unit_price || 0),
      parseFloat(it.totalIssuedQty || 0),
      val,
      parseFloat(it.totalReceivedQty || 0),
      parseFloat(it.turnoverRate || 0)
    ]);
  });
  s1Data.push(['']);
  s1Data.push(['TOTAL CONSUMPTION VALUE', '', '', '', '', '', '', '', '', totIssuedVal, '', '']);

  const ws1 = XLSX.utils.aoa_to_sheet(s1Data);
  ws1['!cols'] = autoFitColumns(s1Data);
  XLSX.utils.book_append_sheet(wb, ws1, 'Item Consumption Summary');

  // Sheet 2
  const s2Data = [
    ['SRI M.K. PAPER MILLS PRIVATE LIMITED'],
    ['DEPARTMENT-WISE ITEM CONSUMPTION BREAKDOWN'],
    [''],
    ['S.No', 'Department Name', 'Material Code', 'Material Name', 'Issue Transactions', 'Issued Qty', 'UOM', 'Total Issued Value (₹)']
  ];

  deptRes.rows.forEach((d, idx) => {
    s2Data.push([
      idx + 1,
      d.deptName || 'Unassigned',
      d.materialCode,
      d.materialName,
      d.issueCount,
      parseFloat(d.totalQty || 0),
      d.uom || 'NOS',
      parseFloat(d.totalValue || 0)
    ]);
  });

  const ws2 = XLSX.utils.aoa_to_sheet(s2Data);
  ws2['!cols'] = autoFitColumns(s2Data);
  XLSX.utils.book_append_sheet(wb, ws2, 'Department Breakdown');

  const fileBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  const filename = `MK_Mill_Item_Consumption_Report_${from || 'All'}_to_${to || 'Current'}.xlsx`;

  return { buffer: fileBuffer, filename };
}

module.exports = {
  generateInventoryExcel,
  generateSingleItemHistoryExcel,
  generateItemConsumptionExcel,
  getStoreTypeFilter
};

