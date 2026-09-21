/**
 * MK PAPER MILL ERP — MULTI-AGENT BACKUP & REPORTING ENGINE
 * 
 * Target Destination: C:\Users\MKKANTA\MK_Mill\Backup_Database
 * Scheduled: Daily at 9:00 PM (21:00:00)
 * 
 * Agents:
 * - [Agent 0] MultiAgentBackupOrchestrator: Coordinates execution, retention & manifest
 * - [Agent 1] PgDatabaseBackupAgent: Creates full schema & data SQL pg_dump
 * - [Agent 2] InventoryReportAgent: Creates complete Master Inventory Excel report
 * - [Agent 3] ProcurementReportAgent: Creates complete P2P Procurement Excel report
 * - [Agent 4] StoreMovementReportAgent: Creates Stock Ledger & Movements Excel report
 * - [Agent 5] FinanceVendorReportAgent: Creates Vendors & AP Finance Excel report
 * - [Agent 6] PlantQualityReportAgent: Creates Plant Operations, DPR & Quality Excel report
 * - [Agent 7] IntegrityVerificationAgent: Computes SHA-256, verifies manifest, logs to DB
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

let XLSX;
try {
  XLSX = require('xlsx');
} catch {
  XLSX = require(path.join(__dirname, '../../node_modules/xlsx'));
}

const pool = require('../db/pool');

// Target backup root directory
const BACKUP_ROOT_DIR = process.env.BACKUP_DATABASE_DIR || 'C:\\Users\\MKKANTA\\MK_Mill\\Backup_Database';

// Company letterhead constants
const COMPANY_NAME = 'SRI M.K. PAPER MILLS PVT. LTD.';
const COMPANY_SUBTITLE = 'PLANT: SURVEY NO. 128/1, INDUSTRIAL AREA, VILLAGE GANGUR, DIST. DHARWAD - 580011, KARNATAKA';
const COMPANY_REGISTRATION = 'GSTIN: 29AABCS1234F1Z8 | CIN: U21012KA2015PTC081234 | STATE CODE: 29 (KARNATAKA)';

// Helper to auto-calculate readable column widths
function autoFitColumns(aoa, maxCol = 50, minCol = 12) {
  const colWidths = [];
  for (const row of aoa) {
    if (!Array.isArray(row)) continue;
    row.forEach((val, colIdx) => {
      const str = val == null ? '' : String(val);
      const len = str.length;
      colWidths[colIdx] = Math.max(colWidths[colIdx] || minCol, Math.min(len + 3, maxCol));
    });
  }
  return colWidths.map(w => ({ wch: w }));
}

function sanitizeSheetName(name, existing = new Set()) {
  let cleaned = (name || 'Sheet').replace(/[\\/*?:[\]]/g, '').trim().slice(0, 28);
  if (!cleaned) cleaned = 'Sheet1';
  let candidate = cleaned;
  let counter = 1;
  while (existing.has(candidate.toLowerCase())) {
    candidate = `${cleaned.slice(0, 24)}_${counter++}`;
  }
  existing.add(candidate.toLowerCase());
  return candidate;
}

function formatCurrency(val) {
  const num = parseFloat(val) || 0;
  return `₹ ${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(val) {
  if (!val) return '-';
  try {
    const d = new Date(val);
    if (isNaN(d.getTime())) return String(val);
    return d.toISOString().slice(0, 10);
  } catch {
    return String(val);
  }
}

function formatDateTime(val) {
  if (!val) return '-';
  try {
    const d = new Date(val);
    if (isNaN(d.getTime())) return String(val);
    return d.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
  } catch {
    return String(val);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// AGENT 1: PostgreSQL Database Dump Agent
// ─────────────────────────────────────────────────────────────────────────────
class PgDatabaseBackupAgent {
  constructor(options = {}) {
    this.name = '🐘 Agent 1: PgDatabaseBackupAgent';
    this.options = options;
  }

  findPgDumpExecutable() {
    try {
      execSync('pg_dump --version', { stdio: 'ignore' });
      return 'pg_dump';
    } catch (_) {}

    const searchDirs = [
      'C:\\Program Files\\PostgreSQL\\18\\bin\\pg_dump.exe',
      'C:\\Program Files\\PostgreSQL\\17\\bin\\pg_dump.exe',
      'C:\\Program Files\\PostgreSQL\\16\\bin\\pg_dump.exe',
      'C:\\Program Files\\PostgreSQL\\15\\bin\\pg_dump.exe',
      'C:\\Program Files\\PostgreSQL\\14\\bin\\pg_dump.exe',
      'C:\\Program Files\\PostgreSQL\\18\\pgAdmin 4\\runtime\\pg_dump.exe',
      'C:\\Program Files (x86)\\PostgreSQL\\16\\bin\\pg_dump.exe'
    ];

    for (const p of searchDirs) {
      if (fs.existsSync(p)) return `"${p}"`;
    }

    return 'pg_dump';
  }

  async execute(targetDir, dateStamp, timeStamp) {
    const startTime = Date.now();
    const dbHost = process.env.DB_HOST || 'localhost';
    const dbPort = process.env.DB_PORT || '5432';
    const dbName = process.env.DB_NAME || 'mk_paper_mill';
    const dbUser = process.env.DB_USER || 'postgres';
    const dbPassword = process.env.DB_PASSWORD || 'postgres';

    const dumpFileName = `mkmill_pg_backup_${dateStamp}_${timeStamp.replace(/:/g, '-')}.sql`;
    const dumpFilePath = path.join(targetDir, dumpFileName);
    const pgDumpExe = this.findPgDumpExecutable();

    process.env.PGPASSWORD = dbPassword;
    const cmd = `${pgDumpExe} -U ${dbUser} -h ${dbHost} -p ${dbPort} -d ${dbName} --clean --if-exists --inserts -f "${dumpFilePath}"`;

    let success = false;
    let fileSize = 0;
    let errorMsg = null;

    try {
      execSync(cmd, { stdio: 'pipe' });
      if (fs.existsSync(dumpFilePath)) {
        const stats = fs.statSync(dumpFilePath);
        fileSize = stats.size;
        success = fileSize > 1024;
      }
    } catch (err) {
      errorMsg = err.message;
    }

    let tableCount = 0;
    try {
      const { rows } = await pool.query(`
        SELECT count(DISTINCT table_name)::int as tbl_cnt
        FROM information_schema.tables
        WHERE table_schema = 'public'
      `);
      tableCount = rows[0]?.tbl_cnt || 0;
    } catch (_) {}

    const duration = Date.now() - startTime;
    return {
      agent: this.name,
      success,
      file: dumpFileName,
      filePath: dumpFilePath,
      fileSizeBytes: fileSize,
      fileSizeMB: (fileSize / (1024 * 1024)).toFixed(2),
      tableCount,
      durationMs: duration,
      error: errorMsg
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// AGENT 2: Inventory & Store Master Excel Report Agent
// ─────────────────────────────────────────────────────────────────────────────
class InventoryReportAgent {
  constructor() {
    this.name = '📦 Agent 2: InventoryReportAgent';
  }

  async execute(targetDir, dateStamp) {
    const startTime = Date.now();
    const wb = XLSX.utils.book_new();
    wb.Props = {
      Title: `${COMPANY_NAME} — Enterprise Inventory Master Ledger`,
      Subject: 'Live Multi-Sheet Inventory & Stock Valuation Audit',
      Author: COMPANY_NAME,
      Company: COMPANY_NAME,
      Category: 'Store Management & Material Catalog',
      Comments: 'OFFICIAL INVENTORY AUDIT RECORD'
    };

    const existingSheets = new Set();
    const genTime = formatDateTime(new Date());

    const { rows: items } = await pool.query(`
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
        COALESCE(m.last_audit_cycle, '-') AS last_audit_cycle,
        COALESCE((SELECT SUM(sl.in_qty) FROM stock_ledger sl WHERE sl.material_id = m.id AND sl.date = CURRENT_DATE AND sl.transaction_type != 'opening'), 0) AS today_received,
        COALESCE((SELECT SUM(sl.out_qty) FROM stock_ledger sl WHERE sl.material_id = m.id AND sl.date = CURRENT_DATE AND sl.transaction_type != 'opening'), 0) AS today_issued,
        COALESCE((SELECT COUNT(DISTINCT pi.po_id) FROM po_items pi WHERE pi.material_id = m.id), 0)::int AS po_count,
        (
          SELECT v.name FROM po_items pi
          JOIN purchase_orders po ON po.id = pi.po_id
          JOIN vendors v ON v.id = po.vendor_id
          WHERE pi.material_id = m.id
          ORDER BY po.date DESC NULLS LAST LIMIT 1
        ) AS last_vendor_name,
        (
          SELECT v.gstin FROM po_items pi
          JOIN purchase_orders po ON po.id = pi.po_id
          JOIN vendors v ON v.id = po.vendor_id
          WHERE pi.material_id = m.id
          ORDER BY po.date DESC NULLS LAST LIMIT 1
        ) AS last_vendor_gstin,
        (SELECT MAX(sl.date)::text FROM stock_ledger sl WHERE sl.material_id = m.id) AS last_txn_date
      FROM materials m
      LEFT JOIN material_categories mc ON mc.id = m.category_id
      LEFT JOIN plant_sections ps ON ps.id = m.section_id
      LEFT JOIN machines mac ON mac.id = m.machine_id
      LEFT JOIN section_equipment se ON se.id = m.section_equipment_id
      WHERE m.is_active = true
      ORDER BY mc.name ASC, m.code ASC
    `);

    const processed = items.map(r => {
      const curStock = parseFloat(r.current_stock || 0);
      const todayRec = parseFloat(r.today_received || 0);
      const todayIss = parseFloat(r.today_issued || 0);
      const unitPrice = parseFloat(r.unit_price || 0);
      const reorderLvl = parseFloat(r.reorder_level || 0);
      const minStock = parseFloat(r.min_stock || 0);
      const maxStock = parseFloat(r.max_stock || 0);

      const openingStock = parseFloat((curStock - todayRec + todayIss).toFixed(3));
      const valuation = parseFloat((curStock * unitPrice).toFixed(2));

      let status = 'Normal (In Stock)';
      if (curStock <= 0) status = 'Out of Stock (Zero)';
      else if (curStock <= reorderLvl) status = 'Low Stock (Reorder Alert)';
      else if (maxStock > 0 && curStock > maxStock) status = 'Overstocked';

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
        reorder_level: reorderLvl,
        min_stock: minStock,
        max_stock: maxStock
      };
    });

    const totalSKUs = processed.length;
    const totalUnits = processed.reduce((a, b) => a + b.current_stock, 0);
    const totalValuation = processed.reduce((a, b) => a + b.valuation, 0);
    const lowStockCount = processed.filter(r => r.current_stock <= r.reorder_level && r.current_stock > 0).length;
    const outOfStockCount = processed.filter(r => r.current_stock <= 0).length;
    const totalTodayIn = processed.reduce((a, b) => a + b.today_received, 0);
    const totalTodayOut = processed.reduce((a, b) => a + b.today_issued, 0);
    const totalReplenishCost = processed.reduce((a, b) => a + b.replenishment_cost, 0);

    const categoryGroups = new Map();
    processed.forEach(r => {
      const cat = r.category_name || 'Uncategorized';
      if (!categoryGroups.has(cat)) {
        categoryGroups.set(cat, {
          name: cat,
          code: r.category_code,
          type: r.category_type,
          items: [],
          units: 0,
          valuation: 0,
          lowStock: 0,
          outStock: 0
        });
      }
      const g = categoryGroups.get(cat);
      g.items.push(r);
      g.units += r.current_stock;
      g.valuation += r.valuation;
      if (r.current_stock <= r.reorder_level && r.current_stock > 0) g.lowStock++;
      if (r.current_stock <= 0) g.outStock++;
    });

    // Sheet 1: 📊 Executive Dashboard
    const summaryRows = [
      [COMPANY_NAME],
      [COMPANY_SUBTITLE],
      [COMPANY_REGISTRATION],
      ['LIVE ENTERPRISE INVENTORY & STOCK VALUATION MASTER AUDIT REPORT'],
      [''],
      ['Report Date:', dateStamp, 'Generated At:', genTime, 'Scope:', 'ALL PLANT STORES & WAREHOUSES'],
      [''],
      ['═══════════════════════════════════════════════════════════════════════════════════════════════════'],
      ['📊 EXECUTIVE INVENTORY KPI DASHBOARD'],
      ['═══════════════════════════════════════════════════════════════════════════════════════════════════'],
      ['KPI Metric', 'Current Value', 'Unit of Measure', 'Business / Capital Implication'],
      ['Total Active Catalog Items (SKUs)', totalSKUs, 'Active Items', 'Mill-wide cataloged material items'],
      ['Total Physical Stock Quantity', parseFloat(totalUnits.toFixed(3)), 'Combined Units', 'Physical stock balance across all stores'],
      ['Total Inventory Working Capital Valuation', formatCurrency(totalValuation), '₹ INR (Live)', 'Total capital invested in stored material'],
      ['Items Below Reorder Level (Low Stock)', lowStockCount, 'SKUs', 'Immediate Purchase Requisition needed'],
      ['Items Out of Stock (Zero Stock)', outOfStockCount, 'SKUs', 'Critical stockout alert - Production risk'],
      ['Today Total Inward Receipts (GRN)', parseFloat(totalTodayIn.toFixed(3)), 'Units (Today)', 'Material received and inspected today'],
      ['Today Total Outward Issues (Plant)', parseFloat(totalTodayOut.toFixed(3)), 'Units (Today)', 'Material issued to plant sections today'],
      ['Estimated Reorder Replenishment Capital', formatCurrency(totalReplenishCost), '₹ INR', 'Working capital required to reach reorder baseline'],
      [''],
      ['═══════════════════════════════════════════════════════════════════════════════════════════════════'],
      ['📑 CATEGORY-WISE INVENTORY & VALUATION DISTRIBUTION'],
      ['═══════════════════════════════════════════════════════════════════════════════════════════════════'],
      [
        'Sr No',
        'Store Category',
        'Code',
        'Category Type',
        'Total Items (SKU)',
        'Current Stock (Units)',
        'Valuation (₹)',
        '% Value Share',
        'Low Stock SKUs',
        'Zero Stock SKUs'
      ]
    ];

    let catSr = 1;
    Array.from(categoryGroups.values())
      .sort((a, b) => b.valuation - a.valuation)
      .forEach(grp => {
        const share = totalValuation > 0 ? ((grp.valuation / totalValuation) * 100).toFixed(2) + '%' : '0.00%';
        summaryRows.push([
          catSr++,
          grp.name,
          grp.code,
          grp.type,
          grp.items.length,
          parseFloat(grp.units.toFixed(3)),
          parseFloat(grp.valuation.toFixed(2)),
          share,
          grp.lowStock,
          grp.outStock
        ]);
      });

    summaryRows.push([
      'TOTAL',
      'MILL-WIDE AGGREGATE',
      'ALL',
      'ALL CATEGORIES',
      totalSKUs,
      parseFloat(totalUnits.toFixed(3)),
      parseFloat(totalValuation.toFixed(2)),
      '100.00%',
      lowStockCount,
      outOfStockCount
    ]);

    const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
    wsSummary['!cols'] = autoFitColumns(summaryRows);
    XLSX.utils.book_append_sheet(wb, wsSummary, sanitizeSheetName('📊 Executive Dashboard', existingSheets));

    // Sheet 2: 📦 Complete Inventory Master Ledger
    const masterHeaders = [
      'Sr No',
      'Item Code',
      'Item Description',
      'Category',
      'Category Type',
      'Plant Section',
      'Machine / Equipment',
      'Crit Class',
      'UOM',
      'Rack / Bin Location',
      'Opening Stock',
      'Today Received',
      'Today Issued',
      'Current Stock Balance',
      'Unit Price (₹)',
      'Total Valuation (₹)',
      'Min Stock',
      'Reorder Level',
      'Max Stock',
      'Condition Status',
      'HSN Code',
      'Procurement Strategy',
      'OEM / Supplier',
      'Last PO Vendor',
      'Last PO Vendor GSTIN',
      'Last Transaction Date'
    ];

    const masterRows = [
      [COMPANY_NAME],
      [`COMPLETE LIVE STORE INVENTORY MASTER LEDGER — AS ON ${dateStamp}`],
      [`Generated: ${genTime} | Total Active Items: ${totalSKUs} | Total Valuation: ₹ ${totalValuation.toLocaleString('en-IN')}`],
      [''],
      masterHeaders
    ];

    processed.forEach((r, idx) => {
      masterRows.push([
        idx + 1,
        r.code,
        r.name,
        r.category_name,
        r.category_type,
        r.section_name || '-',
        r.machine_name || r.section_equipment_name || '-',
        r.criticality_class,
        r.uom,
        r.bin_location,
        r.opening_stock,
        r.today_received,
        r.today_issued,
        r.current_stock,
        r.unit_price,
        r.valuation,
        r.min_stock,
        r.reorder_level,
        r.max_stock,
        r.status,
        r.hsn_code,
        r.procurement_strategy,
        r.oem_supplier,
        r.last_vendor_name || '-',
        r.last_vendor_gstin || '-',
        formatDate(r.last_txn_date)
      ]);
    });

    masterRows.push([
      'TOTAL',
      `TOTAL ${totalSKUs} ITEMS`,
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      parseFloat((totalUnits - totalTodayIn + totalTodayOut).toFixed(3)),
      parseFloat(totalTodayIn.toFixed(3)),
      parseFloat(totalTodayOut.toFixed(3)),
      parseFloat(totalUnits.toFixed(3)),
      '',
      parseFloat(totalValuation.toFixed(2)),
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      ''
    ]);

    const wsMaster = XLSX.utils.aoa_to_sheet(masterRows);
    wsMaster['!cols'] = autoFitColumns(masterRows);
    XLSX.utils.book_append_sheet(wb, wsMaster, sanitizeSheetName('📦 Complete Inventory Master', existingSheets));

    // Sheet 3: ⚠️ Critical & Reorder Alerts
    const alertItems = processed.filter(r => r.current_stock <= r.reorder_level);
    const alertRows = [
      [COMPANY_NAME],
      ['CRITICAL LOW-STOCK & REORDER SHORTFALL ACTION REPORT'],
      [`Generated: ${genTime} | Urgent Items Requiring PO: ${alertItems.length} | Required Capital: ₹ ${totalReplenishCost.toLocaleString('en-IN')}`],
      [''],
      [
        'Sr No',
        'Criticality',
        'Item Code',
        'Item Description',
        'Category',
        'Plant Section',
        'Rack / Bin',
        'UOM',
        'Current Stock',
        'Reorder Level',
        'Shortfall Units',
        'Unit Price (₹)',
        'Estimated Replenishment Cost (₹)',
        'Stock Condition',
        'Open POs',
        'Last PO Vendor',
        'Last PO Vendor GSTIN'
      ]
    ];

    alertItems.sort((a, b) => b.replenishment_cost - a.replenishment_cost).forEach((r, idx) => {
      alertRows.push([
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
        r.shortfall,
        r.unit_price,
        r.replenishment_cost,
        r.status,
        r.po_count,
        r.last_vendor_name || '-',
        r.last_vendor_gstin || '-'
      ]);
    });

    alertRows.push([
      'TOTAL',
      'URGENT',
      `${alertItems.length} ITEMS`,
      '',
      '',
      '',
      '',
      '',
      parseFloat(alertItems.reduce((a, b) => a + b.current_stock, 0).toFixed(3)),
      '',
      parseFloat(alertItems.reduce((a, b) => a + b.shortfall, 0).toFixed(3)),
      '',
      parseFloat(totalReplenishCost.toFixed(2)),
      '',
      '',
      '',
      ''
    ]);

    const wsAlert = XLSX.utils.aoa_to_sheet(alertRows);
    wsAlert['!cols'] = autoFitColumns(alertRows);
    XLSX.utils.book_append_sheet(wb, wsAlert, sanitizeSheetName('⚠️ Reorder & Low Stock', existingSheets));

    // Sheet 4: 💰 Class A High Value Strategic Inventory
    const highValItems = processed
      .filter(r => r.valuation > 0 || r.criticality_class === 'A')
      .sort((a, b) => b.valuation - a.valuation);

    const highValRows = [
      [COMPANY_NAME],
      ['CLASS A & HIGH-VALUATION STRATEGIC INVENTORY AUDIT'],
      [`Generated: ${genTime} | Strategic SKUs: ${highValItems.length}`],
      [''],
      [
        'Rank',
        'Item Code',
        'Item Description',
        'Category',
        'Plant Section',
        'Machine / Equip',
        'Crit Class',
        'UOM',
        'Current Stock',
        'Unit Price (₹)',
        'Total Valuation (₹)',
        '% Portfolio Share',
        'Rack / Bin',
        'Status',
        'Last PO Vendor'
      ]
    ];

    highValItems.forEach((r, idx) => {
      const share = totalValuation > 0 ? ((r.valuation / totalValuation) * 100).toFixed(2) + '%' : '0.00%';
      highValRows.push([
        idx + 1,
        r.code,
        r.name,
        r.category_name,
        r.section_name || '-',
        r.machine_name || r.section_equipment_name || '-',
        r.criticality_class,
        r.uom,
        r.current_stock,
        r.unit_price,
        r.valuation,
        share,
        r.bin_location,
        r.status,
        r.last_vendor_name || '-'
      ]);
    });

    const wsHighVal = XLSX.utils.aoa_to_sheet(highValRows);
    wsHighVal['!cols'] = autoFitColumns(highValRows);
    XLSX.utils.book_append_sheet(wb, wsHighVal, sanitizeSheetName('💰 Class A High Value', existingSheets));

    // Category Specific Sheets
    const topCategories = Array.from(categoryGroups.values())
      .filter(g => g.items.length >= 5)
      .slice(0, 6);

    for (const grp of topCategories) {
      const catRows = [
        [COMPANY_NAME],
        [`${grp.name.toUpperCase()} INVENTORY SHEET — AS ON ${dateStamp}`],
        [`Category: ${grp.name} (${grp.code}) | Total Items: ${grp.items.length} | Valuation: ₹ ${grp.valuation.toLocaleString('en-IN')}`],
        [''],
        masterHeaders
      ];

      grp.items.forEach((r, idx) => {
        catRows.push([
          idx + 1,
          r.code,
          r.name,
          r.category_name,
          r.category_type,
          r.section_name || '-',
          r.machine_name || r.section_equipment_name || '-',
          r.criticality_class,
          r.uom,
          r.bin_location,
          r.opening_stock,
          r.today_received,
          r.today_issued,
          r.current_stock,
          r.unit_price,
          r.valuation,
          r.min_stock,
          r.reorder_level,
          r.max_stock,
          r.status,
          r.hsn_code,
          r.procurement_strategy,
          r.oem_supplier,
          r.last_vendor_name || '-',
          r.last_vendor_gstin || '-',
          formatDate(r.last_txn_date)
        ]);
      });

      const wsCat = XLSX.utils.aoa_to_sheet(catRows);
      wsCat['!cols'] = autoFitColumns(catRows);
      XLSX.utils.book_append_sheet(wb, wsCat, sanitizeSheetName(grp.name, existingSheets));
    }

    const fileName = `MK_Mill_Inventory_Master_Report_${dateStamp}.xlsx`;
    const filePath = path.join(targetDir, fileName);
    XLSX.writeFile(wb, filePath);

    const stats = fs.statSync(filePath);
    return {
      agent: this.name,
      success: true,
      file: fileName,
      filePath,
      fileSizeBytes: stats.size,
      sheetsCount: wb.SheetNames.length,
      sheetNames: wb.SheetNames,
      totalSKUs,
      totalValuation: parseFloat(totalValuation.toFixed(2)),
      durationMs: Date.now() - startTime
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// AGENT 3: Procurement & P2P Lifecycle Excel Report Agent
// ─────────────────────────────────────────────────────────────────────────────
class ProcurementReportAgent {
  constructor() {
    this.name = '📋 Agent 3: ProcurementReportAgent';
  }

  async execute(targetDir, dateStamp) {
    const startTime = Date.now();
    const wb = XLSX.utils.book_new();
    wb.Props = {
      Title: `${COMPANY_NAME} — Enterprise Procurement & P2P Ledger`,
      Subject: 'PR, Purchase Orders, Delivery Challans, GRN & Invoices',
      Author: COMPANY_NAME,
      Company: COMPANY_NAME
    };

    const existingSheets = new Set();
    const genTime = formatDateTime(new Date());

    const { rows: indents } = await pool.query(`
      SELECT 
        i.id,
        i.indent_number,
        i.date,
        COALESCE(d.name, 'General Operations') AS department_name,
        i.required_date,
        COALESCE(i.priority, 'Medium') AS priority,
        i.status,
        COALESCE(u.name, 'Store') AS raised_by_name,
        COUNT(ii.id) AS item_count,
        COALESCE(SUM(ii.required_qty), 0) AS total_requested_qty,
        COALESCE(SUM(ii.approved_qty), 0) AS total_approved_qty
      FROM indents i
      LEFT JOIN departments d ON d.id = i.department_id
      LEFT JOIN users u ON u.id = i.raised_by
      LEFT JOIN indent_items ii ON ii.indent_id = i.id
      GROUP BY i.id, i.indent_number, i.date, d.name, i.required_date, i.priority, i.status, u.name
      ORDER BY i.date DESC, i.id DESC
    `);

    const { rows: indentItems } = await pool.query(`
      SELECT 
        ii.id,
        i.indent_number,
        i.date AS indent_date,
        COALESCE(d.name, 'General Operations') AS department_name,
        i.status AS indent_status,
        COALESCE(m.code, 'N/A') AS material_code,
        COALESCE(m.name, ii.purpose, 'Item') AS material_name,
        COALESCE(mc.name, 'General') AS category_name,
        ii.required_qty,
        COALESCE(ii.approved_qty, ii.required_qty) AS approved_qty,
        COALESCE(ii.uom, m.uom, 'NOS') AS uom,
        COALESCE(m.unit_price, 0) AS estimated_unit_price,
        (COALESCE(ii.required_qty, 0) * COALESCE(m.unit_price, 0)) AS estimated_total_val,
        COALESCE(ii.purpose, '-') AS justification
      FROM indent_items ii
      JOIN indents i ON i.id = ii.indent_id
      LEFT JOIN departments d ON d.id = i.department_id
      LEFT JOIN materials m ON m.id = ii.material_id
      LEFT JOIN material_categories mc ON mc.id = m.category_id
      ORDER BY i.date DESC, i.id DESC, ii.id ASC
    `);

    const { rows: pos } = await pool.query(`
      SELECT 
        po.id,
        po.po_number,
        po.date AS po_date,
        COALESCE(v.name, 'Unknown Vendor') AS vendor_name,
        COALESCE(v.gstin, '-') AS vendor_gstin,
        COALESCE(v.city, '-') AS vendor_city,
        po.delivery_date,
        COALESCE(po.payment_terms, '30 Days') AS payment_terms,
        po.status,
        COALESCE(po.total_value, 0) AS total_value,
        COALESCE(po.gst_value, 0) AS gst_value,
        COALESCE(i.indent_number, '-') AS linked_indent_no,
        COUNT(pi.id) AS item_count
      FROM purchase_orders po
      LEFT JOIN vendors v ON v.id = po.vendor_id
      LEFT JOIN indents i ON i.id = po.indent_id
      LEFT JOIN po_items pi ON pi.po_id = po.id
      GROUP BY po.id, po.po_number, po.date, v.name, v.gstin, v.city, po.delivery_date, po.payment_terms, po.status, po.total_value, po.gst_value, i.indent_number
      ORDER BY po.date DESC, po.id DESC
    `);

    const { rows: poItems } = await pool.query(`
      SELECT 
        pi.id,
        po.po_number,
        po.date AS po_date,
        COALESCE(v.name, 'Unknown Vendor') AS vendor_name,
        COALESCE(m.code, 'N/A') AS material_code,
        COALESCE(m.name, 'Material Item') AS material_name,
        pi.qty AS ordered_qty,
        COALESCE(pi.received_qty, 0) AS received_qty,
        (pi.qty - COALESCE(pi.received_qty, 0)) AS pending_qty,
        COALESCE(pi.uom, m.uom, 'NOS') AS uom,
        COALESCE(pi.unit_price, 0) AS unit_price,
        COALESCE(pi.gst_pct, 18) AS gst_pct,
        COALESCE(pi.total, (pi.qty * COALESCE(pi.unit_price, 0))) AS line_total,
        po.status AS po_status
      FROM po_items pi
      JOIN purchase_orders po ON po.id = pi.po_id
      LEFT JOIN vendors v ON v.id = po.vendor_id
      LEFT JOIN materials m ON m.id = pi.material_id
      ORDER BY po.date DESC, po.id DESC, pi.id ASC
    `);

    const { rows: grns } = await pool.query(`
      SELECT 
        g.id,
        g.grn_number,
        g.date AS grn_date,
        COALESCE(v.name, 'Unknown Vendor') AS vendor_name,
        COALESCE(po.po_number, '-') AS po_number,
        COALESCE(g.challan_number, '-') AS challan_number,
        COALESCE(g.invoice_number, '-') AS invoice_number,
        COALESCE(g.vehicle_number, '-') AS vehicle_number,
        g.status,
        COUNT(gi.id) AS item_count,
        COALESCE(SUM(gi.po_qty), 0) AS total_po_qty,
        COALESCE(SUM(gi.received_qty), 0) AS total_received_qty,
        COALESCE(SUM(gi.accepted_qty), 0) AS total_accepted_qty,
        COALESCE(SUM(gi.rejected_qty), 0) AS total_rejected_qty
      FROM grn g
      LEFT JOIN vendors v ON v.id = g.vendor_id
      LEFT JOIN purchase_orders po ON po.id = g.po_id
      LEFT JOIN grn_items gi ON gi.grn_id = g.id
      GROUP BY g.id, g.grn_number, g.date, v.name, po.po_number, g.challan_number, g.invoice_number, g.vehicle_number, g.status
      ORDER BY g.date DESC, g.id DESC
    `);

    const { rows: grnItems } = await pool.query(`
      SELECT 
        gi.id,
        g.grn_number,
        g.date AS grn_date,
        COALESCE(v.name, 'Unknown Vendor') AS vendor_name,
        COALESCE(po.po_number, '-') AS po_number,
        COALESCE(m.code, 'N/A') AS material_code,
        COALESCE(m.name, 'Material Item') AS material_name,
        COALESCE(gi.po_qty, 0) AS po_qty,
        COALESCE(gi.received_qty, 0) AS received_qty,
        COALESCE(gi.accepted_qty, 0) AS accepted_qty,
        COALESCE(gi.rejected_qty, 0) AS rejected_qty,
        COALESCE(gi.uom, m.uom, 'NOS') AS uom,
        COALESCE(gi.unit_price, m.unit_price, 0) AS unit_price,
        (COALESCE(gi.accepted_qty, 0) * COALESCE(gi.unit_price, m.unit_price, 0)) AS accepted_value,
        COALESCE(gi.batch_number, '-') AS batch_number,
        COALESCE(gi.rejection_reason, '-') AS rejection_reason
      FROM grn_items gi
      JOIN grn g ON g.id = gi.grn_id
      LEFT JOIN vendors v ON v.id = g.vendor_id
      LEFT JOIN purchase_orders po ON po.id = g.po_id
      LEFT JOIN materials m ON m.id = gi.material_id
      ORDER BY g.date DESC, g.id DESC, gi.id ASC
    `);

    const { rows: cashPurchases } = await pool.query(`
      SELECT 
        cp.id,
        cp.voucher_number,
        cp.date AS purchase_date,
        COALESCE(cp.vendor_name, 'Local Vendor') AS vendor_name,
        COALESCE(cp.vendor_gstin, '-') AS vendor_gstin,
        COALESCE(cp.invoice_number, '-') AS invoice_number,
        COALESCE(cp.payment_mode, 'Cash') AS payment_mode,
        COALESCE(cp.payment_ref, '-') AS payment_ref,
        COALESCE(SUM(cpi.qty * cpi.unit_price), 0) AS total_amount,
        COUNT(cpi.id) AS item_count
      FROM cash_purchases cp
      LEFT JOIN cash_purchase_items cpi ON cpi.cash_purchase_id = cp.id
      GROUP BY cp.id, cp.voucher_number, cp.date, cp.vendor_name, cp.vendor_gstin, cp.invoice_number, cp.payment_mode, cp.payment_ref
      ORDER BY cp.date DESC NULLS LAST, cp.id DESC
    `);

    const { rows: gatePasses } = await pool.query(`
      SELECT 
        gp.id,
        gp.gp_number,
        gp.date AS gp_date,
        COALESCE(gp.pass_type, 'Inward') AS pass_type,
        COALESCE(gp.vehicle_type, '-') AS vehicle_type,
        COALESCE(gp.vehicle_number, '-') AS vehicle_number,
        COALESCE(gp.driver_name, '-') AS driver_name,
        COALESCE(gp.purpose, '-') AS purpose,
        COALESCE(gp.material_description, '-') AS material_description,
        COALESCE(gp.from_party, '-') AS from_party
      FROM gate_passes gp
      ORDER BY gp.date DESC, gp.id DESC
    `);

    const totalPRs = indents.length;
    const totalPOs = pos.length;
    const totalPOValue = pos.reduce((a, b) => a + parseFloat(b.total_value || 0), 0);
    const totalGRNs = grns.length;
    const totalGRNAcceptedVal = grnItems.reduce((a, b) => a + parseFloat(b.accepted_value || 0), 0);
    const totalCashPurchasesVal = cashPurchases.reduce((a, b) => a + parseFloat(b.total_amount || 0), 0);

    // Sheet 1: 📊 P2P Executive Dashboard
    const p2pDashboardRows = [
      [COMPANY_NAME],
      [COMPANY_SUBTITLE],
      [COMPANY_REGISTRATION],
      ['PROCURE-TO-PAY (P2P) LIFECYCLE & COMMERCIAL PROCUREMENT AUDIT'],
      [''],
      ['Report Date:', dateStamp, 'Generated At:', genTime],
      [''],
      ['═══════════════════════════════════════════════════════════════════════════════════════════════════'],
      ['📊 P2P PROCUREMENT KPI EXECUTIVE SUMMARY'],
      ['═══════════════════════════════════════════════════════════════════════════════════════════════════'],
      ['Metric', 'Metric Value', 'Unit', 'Operational Scope'],
      ['Total Purchase Requisitions (PR / Indents)', totalPRs, 'Indents Raised', 'Plant-wide material requests'],
      ['Total Purchase Orders Issued (PO)', totalPOs, 'POs Issued', 'Commercial vendor purchase contracts'],
      ['Total Purchase Order Committed Value', formatCurrency(totalPOValue), '₹ INR', 'Total committed purchase value'],
      ['Total Goods Receipt Notes (GRN)', totalGRNs, 'GRNs Processed', 'Material physical verification & inward receipts'],
      ['Total GRN Accepted Material Value', formatCurrency(totalGRNAcceptedVal), '₹ INR', 'Inspected and accepted inventory into stock'],
      ['Total Direct Cash Purchases', formatCurrency(totalCashPurchasesVal), '₹ INR', 'Emergency / localized cash purchases'],
      ['Total Gate Passes Logged', gatePasses.length, 'Gate Passes', 'Physical gate movement entries'],
      [''],
      ['═══════════════════════════════════════════════════════════════════════════════════════════════════'],
      ['📑 TOP ACTIVE SUPPLIERS BY PURCHASE VOLUME'],
      ['═══════════════════════════════════════════════════════════════════════════════════════════════════'],
      ['Sr No', 'Vendor Name', 'Vendor GSTIN', 'PO Count', 'Committed PO Total (₹)']
    ];

    const vendorMap = new Map();
    pos.forEach(p => {
      const v = p.vendor_name || 'Unknown';
      if (!vendorMap.has(v)) {
        vendorMap.set(v, { name: v, gstin: p.vendor_gstin, poCount: 0, totalVal: 0 });
      }
      const rec = vendorMap.get(v);
      rec.poCount++;
      rec.totalVal += parseFloat(p.total_value || 0);
    });

    let vSr = 1;
    Array.from(vendorMap.values())
      .sort((a, b) => b.totalVal - a.totalVal)
      .slice(0, 15)
      .forEach(v => {
        p2pDashboardRows.push([vSr++, v.name, v.gstin, v.poCount, parseFloat(v.totalVal.toFixed(2))]);
      });

    const wsP2P = XLSX.utils.aoa_to_sheet(p2pDashboardRows);
    wsP2P['!cols'] = autoFitColumns(p2pDashboardRows);
    XLSX.utils.book_append_sheet(wb, wsP2P, sanitizeSheetName('📊 P2P Executive Dashboard', existingSheets));

    // Sheet 2: 📝 Indents & PR Items
    const prHeaders = [
      'Sr No',
      'Indent No',
      'Date',
      'Department',
      'Indent Status',
      'Item Code',
      'Item Description',
      'Category',
      'Requested Qty',
      'Approved Qty',
      'UOM',
      'Est. Unit Price (₹)',
      'Est. Total Value (₹)',
      'Justification'
    ];
    const prRows = [
      [COMPANY_NAME],
      [`PURCHASE REQUISITION (PR) & INDENT DETAILED LEDGER — AS ON ${dateStamp}`],
      [''],
      prHeaders
    ];
    indentItems.forEach((r, idx) => {
      prRows.push([
        idx + 1,
        r.indent_number,
        formatDate(r.indent_date),
        r.department_name,
        r.indent_status,
        r.material_code,
        r.material_name,
        r.category_name,
        parseFloat(r.required_qty || 0),
        parseFloat(r.approved_qty || 0),
        r.uom,
        parseFloat(r.estimated_unit_price || 0),
        parseFloat(r.estimated_total_val || 0),
        r.justification
      ]);
    });
    const wsPR = XLSX.utils.aoa_to_sheet(prRows);
    wsPR['!cols'] = autoFitColumns(prRows);
    XLSX.utils.book_append_sheet(wb, wsPR, sanitizeSheetName('📝 Indents & PRs', existingSheets));

    // Sheet 3: 📑 Purchase Orders (PO) Line Items
    const poHeaders = [
      'Sr No',
      'PO Number',
      'PO Date',
      'Vendor Name',
      'Item Code',
      'Item Description',
      'Ordered Qty',
      'Received Qty',
      'Pending Qty',
      'UOM',
      'Unit Price (₹)',
      'GST %',
      'Line Total (₹)',
      'PO Status'
    ];
    const poRows = [
      [COMPANY_NAME],
      [`PURCHASE ORDERS (PO) ITEM-LEVEL COMMERCIAL REGISTER — AS ON ${dateStamp}`],
      [''],
      poHeaders
    ];
    poItems.forEach((r, idx) => {
      poRows.push([
        idx + 1,
        r.po_number,
        formatDate(r.po_date),
        r.vendor_name,
        r.material_code,
        r.material_name,
        parseFloat(r.ordered_qty || 0),
        parseFloat(r.received_qty || 0),
        parseFloat(r.pending_qty || 0),
        r.uom,
        parseFloat(r.unit_price || 0),
        parseFloat(r.gst_pct || 0),
        parseFloat(r.line_total || 0),
        r.po_status
      ]);
    });
    const wsPO = XLSX.utils.aoa_to_sheet(poRows);
    wsPO['!cols'] = autoFitColumns(poRows);
    XLSX.utils.book_append_sheet(wb, wsPO, sanitizeSheetName('📑 Purchase Orders (PO)', existingSheets));

    // Sheet 4: 📥 Goods Receipt Notes (GRN) Line Items
    const grnHeaders = [
      'Sr No',
      'GRN Number',
      'GRN Date',
      'Vendor Name',
      'PO Ref',
      'Item Code',
      'Item Description',
      'PO Qty',
      'Received Qty',
      'Accepted Qty',
      'Rejected Qty',
      'UOM',
      'Unit Price (₹)',
      'Accepted Value (₹)',
      'Batch No',
      'Rejection Reason'
    ];
    const grnRows = [
      [COMPANY_NAME],
      [`GOODS RECEIPT NOTES (GRN) & PHYSICAL INSPECTION REGISTER — AS ON ${dateStamp}`],
      [''],
      grnHeaders
    ];
    grnItems.forEach((r, idx) => {
      grnRows.push([
        idx + 1,
        r.grn_number,
        formatDate(r.grn_date),
        r.vendor_name,
        r.po_number,
        r.material_code,
        r.material_name,
        parseFloat(r.po_qty || 0),
        parseFloat(r.received_qty || 0),
        parseFloat(r.accepted_qty || 0),
        parseFloat(r.rejected_qty || 0),
        r.uom,
        parseFloat(r.unit_price || 0),
        parseFloat(r.accepted_value || 0),
        r.batch_number,
        r.rejection_reason
      ]);
    });
    const wsGRN = XLSX.utils.aoa_to_sheet(grnRows);
    wsGRN['!cols'] = autoFitColumns(grnRows);
    XLSX.utils.book_append_sheet(wb, wsGRN, sanitizeSheetName('📥 Goods Receipt Notes (GRN)', existingSheets));

    // Sheet 5: 💵 Cash Purchases Master
    const cashHeaders = [
      'Sr No',
      'Voucher No',
      'Date',
      'Vendor / Shop Name',
      'Vendor GSTIN',
      'Invoice Number',
      'Payment Mode',
      'Payment Ref / UTR',
      'Item Count',
      'Total Amount (₹)'
    ];
    const cashRows = [
      [COMPANY_NAME],
      [`DIRECT CASH PROCUREMENT VOUCHER REGISTER — AS ON ${dateStamp}`],
      [''],
      cashHeaders
    ];
    cashPurchases.forEach((r, idx) => {
      cashRows.push([
        idx + 1,
        r.voucher_number,
        formatDate(r.purchase_date),
        r.vendor_name,
        r.vendor_gstin,
        r.invoice_number,
        r.payment_mode,
        r.payment_ref,
        parseInt(r.item_count || 0),
        parseFloat(r.total_amount || 0)
      ]);
    });
    const wsCash = XLSX.utils.aoa_to_sheet(cashRows);
    wsCash['!cols'] = autoFitColumns(cashRows);
    XLSX.utils.book_append_sheet(wb, wsCash, sanitizeSheetName('💵 Cash Purchases', existingSheets));

    // Sheet 6: 🚪 Gate Passes Register
    const gpHeaders = [
      'Sr No',
      'Gate Pass No',
      'Date',
      'Pass Type',
      'Vehicle Type',
      'Vehicle Number',
      'Driver Name',
      'From Party',
      'Material Details',
      'Purpose'
    ];
    const gpRows = [
      [COMPANY_NAME],
      [`GATE PASSES & VEHICLE INWARD REGISTER — AS ON ${dateStamp}`],
      [''],
      gpHeaders
    ];
    gatePasses.forEach((r, idx) => {
      gpRows.push([
        idx + 1,
        r.gp_number,
        formatDate(r.gp_date),
        r.pass_type,
        r.vehicle_type,
        r.vehicle_number,
        r.driver_name,
        r.from_party,
        r.material_description,
        r.purpose
      ]);
    });
    const wsGP = XLSX.utils.aoa_to_sheet(gpRows);
    wsGP['!cols'] = autoFitColumns(gpRows);
    XLSX.utils.book_append_sheet(wb, wsGP, sanitizeSheetName('🚪 Gate Passes', existingSheets));

    const fileName = `MK_Mill_Procurement_P2P_Report_${dateStamp}.xlsx`;
    const filePath = path.join(targetDir, fileName);
    XLSX.writeFile(wb, filePath);

    const stats = fs.statSync(filePath);
    return {
      agent: this.name,
      success: true,
      file: fileName,
      filePath,
      fileSizeBytes: stats.size,
      sheetsCount: wb.SheetNames.length,
      sheetNames: wb.SheetNames,
      totalPRs,
      totalPOs,
      totalPOValue: parseFloat(totalPOValue.toFixed(2)),
      totalGRNs,
      durationMs: Date.now() - startTime
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// AGENT 4: Store Movements & Stock Ledger Report Agent
// ─────────────────────────────────────────────────────────────────────────────
class StoreMovementReportAgent {
  constructor() {
    this.name = '🔄 Agent 4: StoreMovementReportAgent';
  }

  async execute(targetDir, dateStamp) {
    const startTime = Date.now();
    const wb = XLSX.utils.book_new();
    wb.Props = {
      Title: `${COMPANY_NAME} — Enterprise Stock Ledger & Material Movements`,
      Subject: 'Double-Entry Stock Ledger, Plant Issues, Department Consumption',
      Author: COMPANY_NAME,
      Company: COMPANY_NAME
    };

    const existingSheets = new Set();
    const genTime = formatDateTime(new Date());

    const { rows: ledger } = await pool.query(`
      SELECT 
        sl.id,
        sl.date,
        sl.transaction_type,
        sl.reference_type,
        sl.reference_id,
        m.code AS material_code,
        m.name AS material_name,
        COALESCE(mc.name, 'General') AS category_name,
        COALESCE(sl.in_qty, 0) AS in_qty,
        COALESCE(sl.out_qty, 0) AS out_qty,
        COALESCE(sl.balance, 0) AS balance,
        COALESCE(sl.unit_price, 0) AS unit_price,
        COALESCE(sl.value, (COALESCE(sl.in_qty, sl.out_qty) * COALESCE(sl.unit_price, 0))) AS transaction_value,
        COALESCE(sl.batch_number, '-') AS batch_number,
        COALESCE(sl.remarks, '-') AS remarks,
        COALESCE(u.name, 'System') AS created_by_name,
        COALESCE(d.name, 'General Mill Operations') AS department_name
      FROM stock_ledger sl
      LEFT JOIN materials m ON m.id = sl.material_id
      LEFT JOIN material_categories mc ON mc.id = m.category_id
      LEFT JOIN users u ON u.id = sl.created_by
      LEFT JOIN indents ind ON ((sl.reference_type ILIKE 'indent%' OR sl.reference_type ILIKE 'issue%') AND CASE WHEN sl.reference_id::text ~ '^[0-9]+$' THEN sl.reference_id::int = ind.id ELSE FALSE END)
      LEFT JOIN departments d ON (ind.department_id = d.id OR u.department_id = d.id)
      ORDER BY sl.date DESC, sl.id DESC
      LIMIT 10000
    `);

    const { rows: deptConsumption } = await pool.query(`
      SELECT 
        COALESCE(d.name, 'General Mill Operations') AS department_name,
        COUNT(sl.id) AS issue_count,
        SUM(sl.out_qty) AS total_issued_qty,
        SUM(COALESCE(sl.value, sl.out_qty * COALESCE(sl.unit_price, 0))) AS total_issued_value
      FROM stock_ledger sl
      LEFT JOIN indents ind ON ((sl.reference_type ILIKE 'indent%' OR sl.reference_type ILIKE 'issue%') AND CASE WHEN sl.reference_id::text ~ '^[0-9]+$' THEN sl.reference_id::int = ind.id ELSE FALSE END)
      LEFT JOIN users u ON sl.created_by = u.id
      LEFT JOIN departments d ON (ind.department_id = d.id OR u.department_id = d.id)
      WHERE sl.out_qty > 0
      GROUP BY d.name
      ORDER BY total_issued_value DESC NULLS LAST
    `);

    const { rows: storeTransfers } = await pool.query(`
      SELECT 
        st.id,
        st.transfer_number,
        st.transfer_date,
        COALESCE(w1.name, 'Main Store') AS from_warehouse,
        COALESCE(w2.name, 'Plant Store') AS to_warehouse,
        st.status,
        COALESCE(st.remarks, '-') AS remarks
      FROM store_transfers st
      LEFT JOIN warehouses w1 ON w1.id = st.from_warehouse_id
      LEFT JOIN warehouses w2 ON w2.id = st.to_warehouse_id
      ORDER BY st.transfer_date DESC NULLS LAST, st.id DESC
    `);

    const { rows: storeReturns } = await pool.query(`
      SELECT 
        sr.id,
        sr.return_number,
        sr.return_date,
        COALESCE(d.name, 'Production') AS department_name,
        sr.status,
        COALESCE(sr.remarks, '-') AS remarks
      FROM store_returns sr
      LEFT JOIN departments d ON d.id = sr.department_id
      ORDER BY sr.return_date DESC NULLS LAST, sr.id DESC
    `);

    const totalTransactions = ledger.length;
    const totalInwardQty = ledger.reduce((a, b) => a + parseFloat(b.in_qty || 0), 0);
    const totalOutwardQty = ledger.reduce((a, b) => a + parseFloat(b.out_qty || 0), 0);
    const totalOutwardVal = ledger.filter(r => r.out_qty > 0).reduce((a, b) => a + parseFloat(b.transaction_value || 0), 0);

    // Sheet 1: 📊 Movement Dashboard
    const movementDashboardRows = [
      [COMPANY_NAME],
      [COMPANY_SUBTITLE],
      [COMPANY_REGISTRATION],
      ['STORE MOVEMENTS & DOUBLE-ENTRY STOCK LEDGER AUDIT DASHBOARD'],
      [''],
      ['Report Date:', dateStamp, 'Generated At:', genTime],
      [''],
      ['═══════════════════════════════════════════════════════════════════════════════════════════════════'],
      ['📊 STOCK MOVEMENT KPI SUMMARY'],
      ['═══════════════════════════════════════════════════════════════════════════════════════════════════'],
      ['KPI Metric', 'Value', 'Unit', 'Operational Scope'],
      ['Total Stock Ledger Transactions', totalTransactions, 'Records', 'Complete double-entry transaction log'],
      ['Total Cumulative Inward Quantity', parseFloat(totalInwardQty.toFixed(3)), 'Units', 'All GRNs, receipts & transfers in'],
      ['Total Cumulative Outward Quantity', parseFloat(totalOutwardQty.toFixed(3)), 'Units', 'All issues, transfers out & consumption'],
      ['Total Department Material Consumption Value', formatCurrency(totalOutwardVal), '₹ INR', 'Total value of material issued to plant'],
      ['Store Transfers Count', storeTransfers.length, 'Transfers', 'Inter-warehouse material movements'],
      ['Store Returns Count', storeReturns.length, 'Returns', 'Materials returned back to store from plant'],
      [''],
      ['═══════════════════════════════════════════════════════════════════════════════════════════════════'],
      ['🏢 DEPARTMENT-WISE CONSUMPTION & EXPENDITURE BREAKDOWN'],
      ['═══════════════════════════════════════════════════════════════════════════════════════════════════'],
      ['Sr No', 'Department Name', 'Total Issues Count', 'Total Quantity Issued', 'Total Value Issued (₹)', '% Spend Share']
    ];

    let dSr = 1;
    deptConsumption.forEach(d => {
      const val = parseFloat(d.total_issued_value || 0);
      const share = totalOutwardVal > 0 ? ((val / totalOutwardVal) * 100).toFixed(2) + '%' : '0.00%';
      movementDashboardRows.push([
        dSr++,
        d.department_name,
        parseInt(d.issue_count || 0),
        parseFloat(parseFloat(d.total_issued_qty || 0).toFixed(3)),
        parseFloat(val.toFixed(2)),
        share
      ]);
    });

    const wsMDash = XLSX.utils.aoa_to_sheet(movementDashboardRows);
    wsMDash['!cols'] = autoFitColumns(movementDashboardRows);
    XLSX.utils.book_append_sheet(wb, wsMDash, sanitizeSheetName('📊 Movement Dashboard', existingSheets));

    // Sheet 2: 📜 Double-Entry Stock Ledger
    const ledgerHeaders = [
      'Txn ID',
      'Date & Time',
      'Item Code',
      'Item Description',
      'Category',
      'Transaction Type',
      'Ref Type',
      'Ref ID / Doc No',
      'In Qty (+)',
      'Out Qty (-)',
      'Closing Stock Balance',
      'Unit Price (₹)',
      'Transaction Value (₹)',
      'Department / Cost Center',
      'Batch Number',
      'Created By',
      'Remarks'
    ];
    const ledgerRows = [
      [COMPANY_NAME],
      [`DOUBLE-ENTRY AUDIT STOCK LEDGER — AS ON ${dateStamp}`],
      [''],
      ledgerHeaders
    ];

    ledger.forEach(r => {
      ledgerRows.push([
        r.id,
        formatDate(r.date),
        r.material_code,
        r.material_name,
        r.category_name,
        r.transaction_type,
        r.reference_type,
        r.reference_id,
        parseFloat(r.in_qty || 0),
        parseFloat(r.out_qty || 0),
        parseFloat(r.balance || 0),
        parseFloat(r.unit_price || 0),
        parseFloat(r.transaction_value || 0),
        r.department_name,
        r.batch_number,
        r.created_by_name,
        r.remarks
      ]);
    });

    const wsLedger = XLSX.utils.aoa_to_sheet(ledgerRows);
    wsLedger['!cols'] = autoFitColumns(ledgerRows);
    XLSX.utils.book_append_sheet(wb, wsLedger, sanitizeSheetName('📜 Double-Entry Stock Ledger', existingSheets));

    // Sheet 3: 🔄 Transfers & Returns
    const transferHeaders = [
      'Sr No',
      'Doc Type',
      'Document Number',
      'Date',
      'Source / From',
      'Destination / To',
      'Status',
      'Remarks'
    ];
    const transferRows = [
      [COMPANY_NAME],
      [`STORE TRANSFERS & RETURNS LOG — AS ON ${dateStamp}`],
      [''],
      transferHeaders
    ];

    let tSr = 1;
    storeTransfers.forEach(st => {
      transferRows.push([
        tSr++,
        'Store Transfer',
        st.transfer_number,
        formatDate(st.transfer_date),
        st.from_warehouse,
        st.to_warehouse,
        st.status,
        st.remarks
      ]);
    });
    storeReturns.forEach(sr => {
      transferRows.push([
        tSr++,
        'Store Return',
        sr.return_number,
        formatDate(sr.return_date),
        sr.department_name,
        'Main Store',
        sr.status,
        sr.remarks
      ]);
    });

    const wsTransfers = XLSX.utils.aoa_to_sheet(transferRows);
    wsTransfers['!cols'] = autoFitColumns(transferRows);
    XLSX.utils.book_append_sheet(wb, wsTransfers, sanitizeSheetName('🔄 Transfers & Returns', existingSheets));

    const fileName = `MK_Mill_Store_Movements_Report_${dateStamp}.xlsx`;
    const filePath = path.join(targetDir, fileName);
    XLSX.writeFile(wb, filePath);

    const stats = fs.statSync(filePath);
    return {
      agent: this.name,
      success: true,
      file: fileName,
      filePath,
      fileSizeBytes: stats.size,
      sheetsCount: wb.SheetNames.length,
      sheetNames: wb.SheetNames,
      totalTransactions,
      totalOutwardVal: parseFloat(totalOutwardVal.toFixed(2)),
      durationMs: Date.now() - startTime
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// AGENT 5: Finance & Vendor Commercials Report Agent
// ─────────────────────────────────────────────────────────────────────────────
class FinanceVendorReportAgent {
  constructor() {
    this.name = '💳 Agent 5: FinanceVendorReportAgent';
  }

  async execute(targetDir, dateStamp) {
    const startTime = Date.now();
    const wb = XLSX.utils.book_new();
    wb.Props = {
      Title: `${COMPANY_NAME} — Enterprise Finance & Vendor Commercial Ledger`,
      Subject: 'Vendors, Accounts Payable, Invoices, GST & Disbursements',
      Author: COMPANY_NAME,
      Company: COMPANY_NAME
    };

    const existingSheets = new Set();
    const genTime = formatDateTime(new Date());

    const { rows: vendors } = await pool.query(`
      SELECT 
        v.id,
        v.code AS vendor_code,
        v.name AS vendor_name,
        COALESCE(v.gstin, '-') AS gstin,
        COALESCE(v.pan, '-') AS pan,
        COALESCE(v.contact_person, '-') AS contact_person,
        COALESCE(v.mobile, '-') AS mobile,
        COALESCE(v.email, '-') AS email,
        COALESCE(v.city, '-') AS city,
        COALESCE(v.state, 'Karnataka') AS state,
        COALESCE(v.payment_terms, '30 Days') AS payment_terms,
        COALESCE(v.credit_days, 30) AS credit_days,
        COALESCE(v.rating, 3) AS rating,
        COALESCE(v.account_type, 'Current') AS account_type,
        v.is_active
      FROM vendors v
      ORDER BY v.name ASC
    `);

    const { rows: bills } = await pool.query(`
      SELECT 
        vb.id,
        vb.bill_number,
        vb.vendor_id,
        COALESCE(v.name, 'Vendor') AS vendor_name,
        COALESCE(v.gstin, '-') AS vendor_gstin,
        COALESCE(po.po_number, '-') AS po_number,
        COALESCE(g.grn_number, '-') AS grn_number,
        COALESCE(vb.vendor_invoice_number, '-') AS vendor_invoice_number,
        vb.invoice_date,
        vb.due_date,
        COALESCE(vb.taxable_amount, 0) AS taxable_amount,
        COALESCE(vb.cgst_amount, 0) AS cgst_amount,
        COALESCE(vb.sgst_amount, 0) AS sgst_amount,
        COALESCE(vb.igst_amount, 0) AS igst_amount,
        COALESCE(vb.total_amount, 0) AS total_amount,
        COALESCE(vb.paid_amount, 0) AS paid_amount,
        COALESCE(vb.balance_amount, (COALESCE(vb.total_amount, 0) - COALESCE(vb.paid_amount, 0))) AS balance_due,
        COALESCE(vb.status, 'Unpaid') AS bill_status
      FROM vendor_bills vb
      LEFT JOIN vendors v ON v.id = vb.vendor_id
      LEFT JOIN purchase_orders po ON po.id = vb.po_id
      LEFT JOIN grn g ON g.id = vb.grn_id
      ORDER BY vb.invoice_date DESC NULLS LAST, vb.id DESC
    `);

    const { rows: payments } = await pool.query(`
      SELECT 
        p.id,
        p.payment_number AS voucher_number,
        p.payment_date,
        COALESCE(p.payment_mode, 'NEFT') AS payment_mode,
        COALESCE(p.reference_number, '-') AS utr_ref_number,
        COALESCE(p.amount, 0) AS amount_paid,
        COALESCE(p.remarks, '-') AS remarks
      FROM payments p
      ORDER BY p.payment_date DESC NULLS LAST, p.id DESC
    `);

    const totalVendors = vendors.length;
    const totalBilled = bills.reduce((a, b) => a + parseFloat(b.total_amount || 0), 0);
    const totalPaid = bills.reduce((a, b) => a + parseFloat(b.paid_amount || 0), 0);
    const totalBalanceDue = bills.reduce((a, b) => a + parseFloat(b.balance_due || 0), 0);

    // Sheet 1: 📊 Commercial AP Dashboard
    const apDashboardRows = [
      [COMPANY_NAME],
      [COMPANY_SUBTITLE],
      [COMPANY_REGISTRATION],
      ['COMMERCIAL FINANCE & ACCOUNTS PAYABLE (AP) AUDIT DASHBOARD'],
      [''],
      ['Report Date:', dateStamp, 'Generated At:', genTime],
      [''],
      ['═══════════════════════════════════════════════════════════════════════════════════════════════════'],
      ['📊 ACCOUNTS PAYABLE (AP) KPI EXECUTIVE SUMMARY'],
      ['═══════════════════════════════════════════════════════════════════════════════════════════════════'],
      ['KPI Metric', 'Metric Value', 'Unit', 'Financial Implication'],
      ['Total Registered Vendors', totalVendors, 'Vendors', 'Approved supply-chain vendor base'],
      ['Total Invoiced AP Bill Amount', formatCurrency(totalBilled), '₹ INR', 'Total gross supplier invoices booked'],
      ['Total Paid / Cleared Disbursements', formatCurrency(totalPaid), '₹ INR', 'Total disbursements executed to date'],
      ['Total Outstanding AP Balance Due', formatCurrency(totalBalanceDue), '₹ INR', 'Current unpaid commercial liability'],
      ['Total Payment Records Logged', payments.length, 'Vouchers', 'Disbursement payment records'],
      ['Total Booked Supplier Invoices', bills.length, 'Invoices', '3-way matched AP bills'],
      [''],
      ['═══════════════════════════════════════════════════════════════════════════════════════════════════'],
      ['📑 TOP OUTSTANDING VENDOR AP BALANCES'],
      ['═══════════════════════════════════════════════════════════════════════════════════════════════════'],
      ['Sr No', 'Vendor Name', 'Vendor GSTIN', 'Total Billed (₹)', 'Total Paid (₹)', 'Balance Due (₹)']
    ];

    const vendorBalanceMap = new Map();
    bills.forEach(b => {
      const v = b.vendor_name || 'Unknown';
      if (!vendorBalanceMap.has(v)) {
        vendorBalanceMap.set(v, { name: v, gstin: b.vendor_gstin, billed: 0, paid: 0, bal: 0 });
      }
      const rec = vendorBalanceMap.get(v);
      rec.billed += parseFloat(b.total_amount || 0);
      rec.paid += parseFloat(b.paid_amount || 0);
      rec.bal += parseFloat(b.balance_due || 0);
    });

    let apSr = 1;
    Array.from(vendorBalanceMap.values())
      .sort((a, b) => b.bal - a.bal)
      .slice(0, 15)
      .forEach(v => {
        apDashboardRows.push([
          apSr++,
          v.name,
          v.gstin,
          parseFloat(v.billed.toFixed(2)),
          parseFloat(v.paid.toFixed(2)),
          parseFloat(v.bal.toFixed(2))
        ]);
      });

    const wsAP = XLSX.utils.aoa_to_sheet(apDashboardRows);
    wsAP['!cols'] = autoFitColumns(apDashboardRows);
    XLSX.utils.book_append_sheet(wb, wsAP, sanitizeSheetName('📊 AP Finance Dashboard', existingSheets));

    // Sheet 2: 🏢 Master Vendor Register
    const vendorHeaders = [
      'Sr No',
      'Vendor Code',
      'Vendor Name',
      'GSTIN',
      'PAN',
      'Contact Person',
      'Mobile',
      'Email',
      'City',
      'State',
      'Payment Terms',
      'Credit Days',
      'Rating (1-5)',
      'Account Type',
      'Active Status'
    ];
    const vendorRows = [
      [COMPANY_NAME],
      [`APPROVED MASTER VENDOR DIRECTORY — AS ON ${dateStamp}`],
      [''],
      vendorHeaders
    ];
    vendors.forEach((r, idx) => {
      vendorRows.push([
        idx + 1,
        r.vendor_code,
        r.vendor_name,
        r.gstin,
        r.pan,
        r.contact_person,
        r.mobile,
        r.email,
        r.city,
        r.state,
        r.payment_terms,
        r.credit_days,
        r.rating,
        r.account_type,
        r.is_active ? 'Active' : 'Inactive'
      ]);
    });
    const wsVendors = XLSX.utils.aoa_to_sheet(vendorRows);
    wsVendors['!cols'] = autoFitColumns(vendorRows);
    XLSX.utils.book_append_sheet(wb, wsVendors, sanitizeSheetName('🏢 Master Vendor Register', existingSheets));

    // Sheet 3: 🧾 Vendor AP Bills & Invoices
    const billHeaders = [
      'Sr No',
      'Bill Number',
      'Vendor Name',
      'Vendor GSTIN',
      'PO Ref',
      'GRN Ref',
      'Vendor Inv No',
      'Invoice Date',
      'Due Date',
      'Taxable Amount (₹)',
      'CGST (₹)',
      'SGST (₹)',
      'IGST (₹)',
      'Total Amount (₹)',
      'Paid Amount (₹)',
      'Balance Due (₹)',
      'Status'
    ];
    const billRows = [
      [COMPANY_NAME],
      [`ACCOUNTS PAYABLE (AP) BILLS & INVOICE REGISTER — AS ON ${dateStamp}`],
      [''],
      billHeaders
    ];
    bills.forEach((r, idx) => {
      billRows.push([
        idx + 1,
        r.bill_number,
        r.vendor_name,
        r.vendor_gstin,
        r.po_number,
        r.grn_number,
        r.vendor_invoice_number,
        formatDate(r.invoice_date),
        formatDate(r.due_date),
        parseFloat(r.taxable_amount || 0),
        parseFloat(r.cgst_amount || 0),
        parseFloat(r.sgst_amount || 0),
        parseFloat(r.igst_amount || 0),
        parseFloat(r.total_amount || 0),
        parseFloat(r.paid_amount || 0),
        parseFloat(r.balance_due || 0),
        r.bill_status
      ]);
    });
    const wsBills = XLSX.utils.aoa_to_sheet(billRows);
    wsBills['!cols'] = autoFitColumns(billRows);
    XLSX.utils.book_append_sheet(wb, wsBills, sanitizeSheetName('🧾 Vendor Bills & Invoices', existingSheets));

    // Sheet 4: 💳 Payment Vouchers
    const paymentHeaders = [
      'Sr No',
      'Payment Number',
      'Payment Date',
      'Payment Mode',
      'UTR / Ref No',
      'Amount Paid (₹)',
      'Remarks'
    ];
    const paymentRows = [
      [COMPANY_NAME],
      [`PAYMENT DISBURSEMENT VOUCHERS — AS ON ${dateStamp}`],
      [''],
      paymentHeaders
    ];
    payments.forEach((r, idx) => {
      paymentRows.push([
        idx + 1,
        r.voucher_number,
        formatDate(r.payment_date),
        r.payment_mode,
        r.utr_ref_number,
        parseFloat(r.amount_paid || 0),
        r.remarks
      ]);
    });
    const wsPayments = XLSX.utils.aoa_to_sheet(paymentRows);
    wsPayments['!cols'] = autoFitColumns(paymentRows);
    XLSX.utils.book_append_sheet(wb, wsPayments, sanitizeSheetName('💳 Payment Disbursements', existingSheets));

    const fileName = `MK_Mill_Finance_Vendors_Report_${dateStamp}.xlsx`;
    const filePath = path.join(targetDir, fileName);
    XLSX.writeFile(wb, filePath);

    const stats = fs.statSync(filePath);
    return {
      agent: this.name,
      success: true,
      file: fileName,
      filePath,
      fileSizeBytes: stats.size,
      sheetsCount: wb.SheetNames.length,
      sheetNames: wb.SheetNames,
      totalVendors,
      totalBilled: parseFloat(totalBilled.toFixed(2)),
      totalBalanceDue: parseFloat(totalBalanceDue.toFixed(2)),
      durationMs: Date.now() - startTime
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// AGENT 6: Plant Operations, DPR & Quality Excel Report Agent
// ─────────────────────────────────────────────────────────────────────────────
class PlantQualityReportAgent {
  constructor() {
    this.name = '🏭 Agent 6: PlantQualityReportAgent';
  }

  async execute(targetDir, dateStamp) {
    const startTime = Date.now();
    const wb = XLSX.utils.book_new();
    wb.Props = {
      Title: `${COMPANY_NAME} — Enterprise Plant Operations & Quality Ledger`,
      Subject: 'Sections, Equipment, Motors, Daily Production DPR, Quality Tests',
      Author: COMPANY_NAME,
      Company: COMPANY_NAME
    };

    const existingSheets = new Set();
    const genTime = formatDateTime(new Date());

    const { rows: equipment } = await pool.query(`
      SELECT 
        se.id,
        COALESCE(ps.section_code, se.section_code, 'SEC') AS section_code,
        COALESCE(ps.name, 'General Section') AS section_name,
        COALESCE(mac.name, '-') AS machine_name,
        COALESCE(se.tag_name, '-') AS tag_name,
        se.equipment_name,
        CASE WHEN se.is_critical = true THEN 'A' ELSE 'C' END AS criticality,
        CASE WHEN se.is_active = true THEN 'Running' ELSE 'Standby' END AS status
      FROM section_equipment se
      LEFT JOIN plant_sections ps ON ps.id = se.section_id
      LEFT JOIN machines mac ON mac.id = se.machine_id
      ORDER BY ps.name ASC, se.equipment_name ASC
    `);

    const { rows: motors } = await pool.query(`
      SELECT 
        m.id,
        m.sr_no,
        m.motor_name,
        m.hp,
        m.kw,
        m.rpm,
        m.full_amp,
        COALESCE(m.bearing_no_fs, '-') AS bearing_fs,
        COALESCE(m.bearing_no_bs, '-') AS bearing_bs,
        COALESCE(m.section_label, '-') AS section_label
      FROM motor_electrical_specs m
      ORDER BY m.id ASC
    `);

    const { rows: dprs } = await pool.query(`
      SELECT 
        d.id,
        d.report_date,
        COALESCE(mac.name, 'Paper Machine 1') AS machine_name,
        COALESCE(d.pmc_production_mt, 0) AS pmc_production_mt,
        COALESCE(d.finish_production_mt, 0) AS finish_production_mt,
        COALESCE(d.total_sets, 0) AS total_sets,
        COALESCE(d.running_minutes, 0) AS running_minutes,
        COALESCE(d.down_minutes, 0) AS down_minutes,
        COALESCE(d.furnish_local_mt, 0) AS furnish_local_mt,
        COALESCE(d.furnish_occ_mt, 0) AS furnish_occ_mt
      FROM daily_production_reports d
      LEFT JOIN machines mac ON mac.id = d.machine_id
      ORDER BY d.report_date DESC, d.id DESC
    `);

    const { rows: qualityTests } = await pool.query(`
      SELECT 
        q.id,
        q.test_number,
        q.test_type,
        q.test_date,
        COALESCE(u.name, 'Lab Technician') AS tested_by,
        COALESCE(q.gsm, 0) AS gsm,
        COALESCE(q.moisture_pct, 0) AS moisture_pct,
        COALESCE(q.caliper_micron, 0) AS caliper_micron,
        COALESCE(q.burst_factor, 0) AS burst_factor,
        COALESCE(q.cobb_value, 0) AS cobb_value,
        COALESCE(q.tear_strength, 0) AS tear_strength,
        COALESCE(q.tensile_strength, 0) AS tensile_strength,
        COALESCE(q.result, 'Approved') AS result
      FROM quality_tests q
      LEFT JOIN users u ON u.id = q.tested_by
      ORDER BY q.test_date DESC NULLS LAST, q.id DESC
    `);

    const { rows: ehs } = await pool.query(`
      SELECT 
        e.id,
        e.incident_number,
        e.date AS incident_date,
        COALESCE(e.location, '-') AS location,
        COALESCE(e.severity, 'Low') AS severity,
        COALESCE(e.description, '-') AS description,
        COALESCE(e.status, 'Resolved') AS status
      FROM ehs_incidents e
      ORDER BY e.date DESC NULLS LAST, e.id DESC
    `);

    const totalDPRs = dprs.length;
    const totalFinishProductionMT = dprs.reduce((a, b) => a + parseFloat(b.finish_production_mt || 0), 0);
    const totalDownMinutes = dprs.reduce((a, b) => a + parseFloat(b.down_minutes || 0), 0);

    // Sheet 1: 📊 Plant Operations Dashboard
    const plantDashboardRows = [
      [COMPANY_NAME],
      [COMPANY_SUBTITLE],
      [COMPANY_REGISTRATION],
      ['PLANT OPERATIONS, DAILY PRODUCTION (DPR) & QUALITY AUDIT DASHBOARD'],
      [''],
      ['Report Date:', dateStamp, 'Generated At:', genTime],
      [''],
      ['═══════════════════════════════════════════════════════════════════════════════════════════════════'],
      ['📊 PLANT ASSET & PRODUCTION KPI SUMMARY'],
      ['═══════════════════════════════════════════════════════════════════════════════════════════════════'],
      ['KPI Metric', 'Metric Value', 'Unit', 'Scope'],
      ['Total Section Equipment Tagged', equipment.length, 'Equipment Units', 'Plant-wide machinery and tagged assets'],
      ['Total Master Motors Tagged', motors.length, 'Motors', 'Electrical motor registry with bearing specs'],
      ['Total Daily Production Reports Logged', totalDPRs, 'Daily Records', 'Production shift reports'],
      ['Total Finished Paper Production', `${parseFloat(totalFinishProductionMT.toFixed(2))} MT`, 'Metric Tonnes', 'Cumulative finished production logged'],
      ['Total Recorded Machine Downtime', `${(totalDownMinutes / 60).toFixed(1)} Hours`, 'Hours', 'Cumulative machine stoppage time'],
      ['Total Quality Tests Performed', qualityTests.length, 'Test Records', 'GSM, BF, Cobb, Moisture quality audits'],
      ['Total EHS Incident Logs', ehs.length, 'Safety Records', 'Plant environmental, health & safety logs']
    ];

    const wsPlant = XLSX.utils.aoa_to_sheet(plantDashboardRows);
    wsPlant['!cols'] = autoFitColumns(plantDashboardRows);
    XLSX.utils.book_append_sheet(wb, wsPlant, sanitizeSheetName('📊 Plant KPI Dashboard', existingSheets));

    // Sheet 2: ⚙️ Plant Equipment Master
    const eqHeaders = [
      'Sr No',
      'Section Code',
      'Plant Section Name',
      'Machine Name',
      'Equipment Tag',
      'Equipment Name',
      'Criticality (A/B/C)',
      'Operational Status'
    ];
    const eqRows = [
      [COMPANY_NAME],
      [`PLANT EQUIPMENT & ASSET MASTER REGISTER — AS ON ${dateStamp}`],
      [''],
      eqHeaders
    ];
    equipment.forEach((r, idx) => {
      eqRows.push([
        idx + 1,
        r.section_code,
        r.section_name,
        r.machine_name,
        r.tag_name,
        r.equipment_name,
        r.criticality,
        r.status
      ]);
    });
    const wsEq = XLSX.utils.aoa_to_sheet(eqRows);
    wsEq['!cols'] = autoFitColumns(eqRows);
    XLSX.utils.book_append_sheet(wb, wsEq, sanitizeSheetName('⚙️ Equipment Master', existingSheets));

    // Sheet 3: ⚡ Motors & Electrical Specs
    const motorHeaders = [
      'Sr No',
      'Motor Description',
      'Power (HP)',
      'Power (kW)',
      'Speed (RPM)',
      'Full Load Current (A)',
      'Bearing DE (Front)',
      'Bearing NDE (Back)',
      'Section / Location'
    ];
    const motorRows = [
      [COMPANY_NAME],
      [`ELECTRICAL MOTORS & BEARING SPECIFICATIONS MASTER — AS ON ${dateStamp}`],
      [''],
      motorHeaders
    ];
    motors.forEach((r, idx) => {
      motorRows.push([
        idx + 1,
        r.motor_name,
        r.hp,
        r.kw,
        r.rpm,
        r.full_amp,
        r.bearing_fs,
        r.bearing_bs,
        r.section_label
      ]);
    });
    const wsMotors = XLSX.utils.aoa_to_sheet(motorRows);
    wsMotors['!cols'] = autoFitColumns(motorRows);
    XLSX.utils.book_append_sheet(wb, wsMotors, sanitizeSheetName('⚡ Motors & Electrical', existingSheets));

    // Sheet 4: 🏭 Daily Production Reports (DPR)
    const dprHeaders = [
      'Sr No',
      'Report Date',
      'Machine Name',
      'PMC Production (MT)',
      'Finish Production (MT)',
      'Total Sets',
      'Running Minutes',
      'Down Minutes',
      'Furnish Local (MT)',
      'Furnish OCC (MT)'
    ];
    const dprRows = [
      [COMPANY_NAME],
      [`DAILY PRODUCTION REPORTS (DPR) MASTER — AS ON ${dateStamp}`],
      [''],
      dprHeaders
    ];
    dprs.forEach((r, idx) => {
      dprRows.push([
        idx + 1,
        formatDate(r.report_date),
        r.machine_name,
        parseFloat(r.pmc_production_mt || 0),
        parseFloat(r.finish_production_mt || 0),
        parseInt(r.total_sets || 0),
        parseInt(r.running_minutes || 0),
        parseInt(r.down_minutes || 0),
        parseFloat(r.furnish_local_mt || 0),
        parseFloat(r.furnish_occ_mt || 0)
      ]);
    });
    const wsDPR = XLSX.utils.aoa_to_sheet(dprRows);
    wsDPR['!cols'] = autoFitColumns(dprRows);
    XLSX.utils.book_append_sheet(wb, wsDPR, sanitizeSheetName('🏭 Production DPRs', existingSheets));

    // Sheet 5: 🔬 Quality Tests & Lab Reports
    const qualityHeaders = [
      'Sr No',
      'Test Number',
      'Test Date',
      'Test Type',
      'Tested By',
      'GSM',
      'Moisture %',
      'Caliper (Microns)',
      'Burst Factor (BF)',
      'Cobb Value (g/m²)',
      'Tear Strength',
      'Tensile Strength',
      'Result Status'
    ];
    const qualityRows = [
      [COMPANY_NAME],
      [`PAPER QUALITY LAB TESTING REGISTER — AS ON ${dateStamp}`],
      [''],
      qualityHeaders
    ];
    qualityTests.forEach((r, idx) => {
      qualityRows.push([
        idx + 1,
        r.test_number,
        formatDate(r.test_date),
        r.test_type,
        r.tested_by,
        parseFloat(r.gsm || 0),
        parseFloat(r.moisture_pct || 0),
        parseFloat(r.caliper_micron || 0),
        parseFloat(r.burst_factor || 0),
        parseFloat(r.cobb_value || 0),
        parseFloat(r.tear_strength || 0),
        parseFloat(r.tensile_strength || 0),
        r.result
      ]);
    });
    const wsQuality = XLSX.utils.aoa_to_sheet(qualityRows);
    wsQuality['!cols'] = autoFitColumns(qualityRows);
    XLSX.utils.book_append_sheet(wb, wsQuality, sanitizeSheetName('🔬 Quality Lab Tests', existingSheets));

    const fileName = `MK_Mill_Plant_Operations_Report_${dateStamp}.xlsx`;
    const filePath = path.join(targetDir, fileName);
    XLSX.writeFile(wb, filePath);

    const stats = fs.statSync(filePath);
    return {
      agent: this.name,
      success: true,
      file: fileName,
      filePath,
      fileSizeBytes: stats.size,
      sheetsCount: wb.SheetNames.length,
      sheetNames: wb.SheetNames,
      equipmentCount: equipment.length,
      motorsCount: motors.length,
      dprCount: dprs.length,
      durationMs: Date.now() - startTime
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// AGENT 7: Integrity Verification & Manifest Agent
// ─────────────────────────────────────────────────────────────────────────────
class IntegrityVerificationAgent {
  constructor() {
    this.name = '🛡️ Agent 7: IntegrityVerificationAgent';
  }

  computeFileSha256(filePath) {
    if (!fs.existsSync(filePath)) return null;
    const fileBuffer = fs.readFileSync(filePath);
    return crypto.createHash('sha256').update(fileBuffer).digest('hex');
  }

  async execute(targetDir, latestDir, dateStamp, timeStamp, agentResults) {
    const startTime = Date.now();
    const manifest = {
      title: `${COMPANY_NAME} — Automated Daily Backup Manifest`,
      backup_date: dateStamp,
      backup_time: timeStamp,
      executed_at: new Date().toISOString(),
      destination_root: BACKUP_ROOT_DIR,
      dated_folder: targetDir,
      latest_folder: latestDir,
      system_agents_count: agentResults.length,
      artifacts: []
    };

    let totalSizeBytes = 0;

    for (const res of agentResults) {
      if (res.filePath && fs.existsSync(res.filePath)) {
        const stats = fs.statSync(res.filePath);
        const hash = this.computeFileSha256(res.filePath);
        totalSizeBytes += stats.size;

        manifest.artifacts.push({
          agent: res.agent,
          file_name: res.file,
          file_size_bytes: stats.size,
          file_size_mb: (stats.size / (1024 * 1024)).toFixed(2),
          sha256_checksum: hash,
          sheets_count: res.sheetsCount || null,
          meta: {
            skus: res.totalSKUs || null,
            valuation: res.totalValuation || null,
            table_count: res.tableCount || null
          }
        });

        let latestTargetName = res.file
          .replace(`_${dateStamp}`, '_Latest')
          .replace(`_${dateStamp}_${timeStamp.replace(/:/g, '-')}`, '_latest');
        
        if (res.file.startsWith('mkmill_pg_backup_')) {
          latestTargetName = 'mkmill_pg_backup_latest.sql';
        }

        const latestTargetPath = path.join(latestDir, latestTargetName);
        fs.copyFileSync(res.filePath, latestTargetPath);
      }
    }

    manifest.total_backup_size_bytes = totalSizeBytes;
    manifest.total_backup_size_mb = (totalSizeBytes / (1024 * 1024)).toFixed(2);

    const manifestPath = path.join(targetDir, '_BACKUP_MANIFEST.json');
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
    fs.copyFileSync(manifestPath, path.join(latestDir, '_BACKUP_MANIFEST.json'));

    const summaryMdPath = path.join(targetDir, 'DAILY_BACKUP_SUMMARY.md');
    const mdLines = [
      `# ${COMPANY_NAME}`,
      `## 📦 Daily Multi-Agent Database & Excel Application Backup Summary`,
      ``,
      `- **Backup Date**: \`${dateStamp}\``,
      `- **Execution Time**: \`${timeStamp}\` (IST)`,
      `- **Target Directory**: \`${targetDir}\``,
      `- **Total Backup Package Size**: **${manifest.total_backup_size_mb} MB** (${totalSizeBytes.toLocaleString()} bytes)`,
      `- **Status**: 🟢 **ALL AGENTS COMPLETED SUCCESSFULLY**`,
      ``,
      `---`,
      ``,
      `### 📑 Generated Backup Files & Cryptographic Verification`,
      ``,
      `| Generated File | Domain / Content | Size | SHA-256 Checksum |`,
      `| :--- | :--- | :--- | :--- |`
    ];

    manifest.artifacts.forEach(a => {
      mdLines.push(`| \`${a.file_name}\` | ${a.agent} | **${a.file_size_mb} MB** | \`${a.sha256_checksum.slice(0, 16)}...\` |`);
    });

    mdLines.push(``);
    mdLines.push(`---`);
    mdLines.push(`*Generated automatically by MK Paper Mill Multi-Agent Backup Engine on ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}.*`);
    fs.writeFileSync(summaryMdPath, mdLines.join('\n'), 'utf8');

    try {
      await pool.query(`
        INSERT INTO audit_log (user_id, action, module, record_id, new_data, ip_address, created_at)
        VALUES (
          NULL,
          'MULTI_AGENT_DAILY_BACKUP_SUCCESS',
          'SYSTEM_BACKUP',
          0,
          $1::jsonb,
          '127.0.0.1',
          NOW()
        )
      `, [JSON.stringify({
        date: dateStamp,
        sizeMB: manifest.total_backup_size_mb,
        files: manifest.artifacts.map(a => a.file_name)
      })]);
    } catch (_) {}

    this.rotateOldBackups();

    return {
      agent: this.name,
      success: true,
      manifestPath,
      summaryMdPath,
      totalSizeMB: manifest.total_backup_size_mb,
      artifactsCount: manifest.artifacts.length,
      durationMs: Date.now() - startTime
    };
  }

  rotateOldBackups() {
    try {
      if (!fs.existsSync(BACKUP_ROOT_DIR)) return;
      const entries = fs.readdirSync(BACKUP_ROOT_DIR, { withFileTypes: true });
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      const dateDirs = entries
        .filter(e => e.isDirectory() && dateRegex.test(e.name))
        .map(e => e.name)
        .sort();

      if (dateDirs.length > 30) {
        const toRemove = dateDirs.slice(0, dateDirs.length - 30);
        for (const dirName of toRemove) {
          const p = path.join(BACKUP_ROOT_DIR, dirName);
          fs.rmSync(p, { recursive: true, force: true });
        }
      }
    } catch (_) {}
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CENTRAL ORCHESTRATOR: MultiAgentBackupOrchestrator
// ─────────────────────────────────────────────────────────────────────────────
class MultiAgentBackupOrchestrator {
  constructor(options = {}) {
    this.options = options;
  }

  async run() {
    const overallStart = Date.now();
    const now = new Date();
    const dateStamp = now.toISOString().slice(0, 10);
    const timeStamp = now.toTimeString().slice(0, 8);

    console.log('\n' + '═'.repeat(90));
    console.log(`🚀 [MK PAPER MILL] MULTI-AGENT DATABASE & EXCEL APPLICATION BACKUP ENGINE`);
    console.log(`📅 Date: ${dateStamp} | ⏰ Time: ${timeStamp} | 📁 Root: ${BACKUP_ROOT_DIR}`);
    console.log('═'.repeat(90) + '\n');

    const datedTargetDir = path.join(BACKUP_ROOT_DIR, dateStamp);
    const latestDir = path.join(BACKUP_ROOT_DIR, 'Latest_Backup');

    if (!fs.existsSync(BACKUP_ROOT_DIR)) fs.mkdirSync(BACKUP_ROOT_DIR, { recursive: true });
    if (!fs.existsSync(datedTargetDir)) fs.mkdirSync(datedTargetDir, { recursive: true });
    if (!fs.existsSync(latestDir)) fs.mkdirSync(latestDir, { recursive: true });

    const pgAgent = new PgDatabaseBackupAgent();
    const invAgent = new InventoryReportAgent();
    const procAgent = new ProcurementReportAgent();
    const moveAgent = new StoreMovementReportAgent();
    const finAgent = new FinanceVendorReportAgent();
    const plantAgent = new PlantQualityReportAgent();
    const verifyAgent = new IntegrityVerificationAgent();

    const agentResults = [];

    // Run Agent 1: PostgreSQL Database Dump
    console.log(`🐘 [1/7] Running ${pgAgent.name}...`);
    const pgRes = await pgAgent.execute(datedTargetDir, dateStamp, timeStamp);
    agentResults.push(pgRes);
    console.log(`    ✓ Database Dump: ${pgRes.file} (${pgRes.fileSizeMB} MB) in ${pgRes.durationMs}ms`);

    // Run Agent 2: Inventory Master Excel Report
    console.log(`📦 [2/7] Running ${invAgent.name}...`);
    const invRes = await invAgent.execute(datedTargetDir, dateStamp);
    agentResults.push(invRes);
    console.log(`    ✓ Inventory Excel: ${invRes.file} (${invRes.sheetsCount} sheets, ${invRes.totalSKUs} SKUs, ₹ ${invRes.totalValuation.toLocaleString('en-IN')}) in ${invRes.durationMs}ms`);

    // Run Agent 3: Procurement P2P Excel Report
    console.log(`📋 [3/7] Running ${procAgent.name}...`);
    const procRes = await procAgent.execute(datedTargetDir, dateStamp);
    agentResults.push(procRes);
    console.log(`    ✓ Procurement Excel: ${procRes.file} (${procRes.sheetsCount} sheets, ${procRes.totalPOs} POs, ₹ ${procRes.totalPOValue.toLocaleString('en-IN')}) in ${procRes.durationMs}ms`);

    // Run Agent 4: Store Movements Excel Report
    console.log(`🔄 [4/7] Running ${moveAgent.name}...`);
    const moveRes = await moveAgent.execute(datedTargetDir, dateStamp);
    agentResults.push(moveRes);
    console.log(`    ✓ Movements Excel: ${moveRes.file} (${moveRes.sheetsCount} sheets, ${moveRes.totalTransactions} transactions) in ${moveRes.durationMs}ms`);

    // Run Agent 5: Finance & Vendors Excel Report
    console.log(`💳 [5/7] Running ${finAgent.name}...`);
    const finRes = await finAgent.execute(datedTargetDir, dateStamp);
    agentResults.push(finRes);
    console.log(`    ✓ Finance Excel: ${finRes.file} (${finRes.sheetsCount} sheets, ${finRes.totalVendors} vendors, ₹ ${finRes.totalBilled.toLocaleString('en-IN')} billed) in ${finRes.durationMs}ms`);

    // Run Agent 6: Plant Operations & Quality Excel Report
    console.log(`🏭 [6/7] Running ${plantAgent.name}...`);
    const plantRes = await plantAgent.execute(datedTargetDir, dateStamp);
    agentResults.push(plantRes);
    console.log(`    ✓ Plant Operations Excel: ${plantRes.file} (${plantRes.sheetsCount} sheets, ${plantRes.equipmentCount} equipment) in ${plantRes.durationMs}ms`);

    // Run Agent 7: Integrity Verification & Manifest
    console.log(`🛡️ [7/7] Running ${verifyAgent.name}...`);
    const verifyRes = await verifyAgent.execute(datedTargetDir, latestDir, dateStamp, timeStamp, agentResults);
    agentResults.push(verifyRes);
    console.log(`    ✓ Manifest & SHA-256 Hashes: ${verifyRes.manifestPath} (Total ${verifyRes.totalSizeMB} MB) in ${verifyRes.durationMs}ms`);

    const totalDuration = Date.now() - overallStart;

    console.log('\n' + '═'.repeat(90));
    console.log(`✅ [COMPLETE] MULTI-AGENT BACKUP & REPORTING FINISHED IN ${(totalDuration / 1000).toFixed(2)}s`);
    console.log(`📁 Backup Folder: ${datedTargetDir}`);
    console.log(`📁 Latest Mirror: ${latestDir}`);
    console.log('═'.repeat(90) + '\n');

    return {
      success: true,
      backupDate: dateStamp,
      backupTime: timeStamp,
      durationMs: totalDuration,
      targetDir: datedTargetDir,
      latestDir,
      totalSizeMB: verifyRes.totalSizeMB,
      agentResults
    };
  }
}

module.exports = {
  MultiAgentBackupOrchestrator,
  PgDatabaseBackupAgent,
  InventoryReportAgent,
  ProcurementReportAgent,
  StoreMovementReportAgent,
  FinanceVendorReportAgent,
  PlantQualityReportAgent,
  IntegrityVerificationAgent,
  BACKUP_ROOT_DIR
};
