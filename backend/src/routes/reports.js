const router = require('express').Router();
const pool = require('../db/pool');
const { auth, requireLevel } = require('../middleware/auth');
const { publish } = require('../kafka');
const waGen = require('../services/whatsappReportGenerator');
const ar = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// ── CSV helper ────────────────────────────────────────────────────────────────
function escCSV(v) {
  if (v == null) return '';
  const s = String(v);
  return s.includes(',') || s.includes('"') || s.includes('\n')
    ? `"${s.replace(/"/g, '""')}"` : s;
}
function toCSV(headers, rows) {
  const head = headers.map(escCSV).join(',');
  const body = rows.map(r => r.map(escCSV).join(',')).join('\r\n');
  return head + '\r\n' + body;
}
function sendCSV(res, filename, headers, rows) {
  const csv = toCSV(headers, rows);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send('\uFEFF' + csv); // BOM for Excel UTF-8
}

// ── 1. MASTER END-OF-DAY (EOD) COMPILER & DISPATCHER ─────────────────────────
async function compileEOD(targetDate) {
  const d = targetDate || new Date().toISOString().slice(0, 10);

  const [
    prodRes,
    reelsRes,
    utilityRes,
    qualityRes,
    downtimeRes,
    salesRes,
    dispatchRes,
    indentsRes,
    stockMoveRes,
    hrRes,
    alarmsRes,
    indentsByDeptRes,
    indentsListRes,
    categoryStoreRes,
    purchaseOrdersRes,
    inwardGrnRes,
    outwardIssuesRes,
    topItemIssuesRes,
    criticalLowStockRes,
    detailedGrnRes,
    detailedIndentsRes,
    catalogTotalsRes
  ] = await Promise.all([
    // Production summary for date
    pool.query(`
      SELECT COUNT(id) AS total_reels,
             COALESCE(SUM(weight_kg), 0) AS total_kg,
             COALESCE(SUM(weight_kg), 0) / 1000.0 AS total_mt,
             COALESCE(AVG(efficiency_pct), 0) AS avg_efficiency,
             COALESCE(AVG(gsm), 0) AS avg_gsm,
             COALESCE(AVG(moisture_pct), 0) AS avg_moisture,
             COALESCE(SUM(downtime_min), 0) AS total_downtime_min
      FROM reels WHERE DATE(start_time) = $1
    `, [d]),

    // Reels breakdown by machine
    pool.query(`
      SELECT m.name AS machine, m.code,
             COUNT(r.id) AS reels,
             COALESCE(SUM(r.weight_kg), 0) AS total_kg,
             COALESCE(AVG(r.efficiency_pct), 0) AS avg_efficiency
      FROM reels r
      JOIN machines m ON m.id = r.machine_id
      WHERE DATE(r.start_time) = $1
      GROUP BY m.id, m.name, m.code
    `, [d]),

    // Utility & Power for date
    pool.query(`
      SELECT COALESCE(SUM(power_units + dg_units), 0) AS total_power_units,
             COALESCE(SUM(steam_generated_mt), 0) AS total_steam_mt,
             COALESCE(SUM(coal_consumed_kg), 0) AS total_coal_kg,
             COALESCE(SUM(fresh_water_kl), 0) AS total_water_kl,
             COALESCE(AVG(boiler_pressure), 0) AS avg_boiler_pressure,
             COALESCE(AVG(boiler_temp), 0) AS avg_boiler_temp
      FROM utility_readings WHERE date = $1
    `, [d]),

    // Quality stats for date
    pool.query(`
      SELECT COUNT(*) AS total_tests,
             COALESCE(SUM(CASE WHEN result = 'Pass' THEN 1 ELSE 0 END), 0) AS passed,
             COALESCE(SUM(CASE WHEN result = 'Fail' THEN 1 ELSE 0 END), 0) AS failed,
             COALESCE(SUM(CASE WHEN result = 'Hold' THEN 1 ELSE 0 END), 0) AS held,
             ROUND(100.0 * COALESCE(SUM(CASE WHEN result = 'Pass' THEN 1 ELSE 0 END), 0) / NULLIF(COUNT(*), 0), 1) AS pass_rate
      FROM quality_tests WHERE DATE(test_date) = $1
    `, [d]),

    // Downtimes for date
    pool.query(`
      SELECT COUNT(d.id) AS breakdown_count,
             COALESCE(SUM(d.duration_min), 0) AS total_downtime_min,
             COALESCE(STRING_AGG(DISTINCT m.name, ', '), 'None') AS affected_machines
      FROM downtime_entries d
      LEFT JOIN machines m ON m.id = d.machine_id
      WHERE DATE(d.start_time) = $1
    `, [d]),

    // Sales Orders booked on date
    pool.query(`
      SELECT COUNT(id) AS new_orders,
             COALESCE(SUM(qty_mt), 0) AS booked_mt,
             COALESCE(SUM(total_value), 0) AS booked_value
      FROM sales_orders WHERE DATE(date) = $1
    `, [d]),

    // Dispatches executed on date (dispatch_orders table)
    pool.query(`
      SELECT COUNT(id) AS dispatches_count,
             COALESCE(SUM(total_weight_kg) / 1000.0, 0) AS dispatched_mt,
             COALESCE(SUM(total_reels), 0) AS dispatched_reels
      FROM dispatch_orders WHERE DATE(date) = $1
    `, [d]),

    // Indents & Store Issues on date
    pool.query(`
      SELECT COUNT(id) AS indents_raised,
             COALESCE(SUM(CASE WHEN status = 'Issued' THEN 1 ELSE 0 END), 0) AS indents_issued,
             COALESCE(SUM(total_value), 0) AS indents_value
      FROM indents WHERE DATE(date) = $1 OR DATE(created_at) = $1
    `, [d]),

    // Stock Ledger movement on date
    pool.query(`
      SELECT COALESCE(SUM(in_qty), 0) AS total_received_qty,
             COALESCE(SUM(value) FILTER (WHERE in_qty > 0), 0) AS total_received_value,
             COALESCE(SUM(out_qty), 0) AS total_issued_qty,
             COALESCE(SUM(value) FILTER (WHERE out_qty > 0), 0) AS total_issue_value
      FROM stock_ledger WHERE date = $1
    `, [d]),

    // HR Attendance on date
    pool.query(`
      SELECT COUNT(a.id) FILTER (WHERE a.status = 'Present') AS present,
             COUNT(a.id) FILTER (WHERE a.status = 'Absent') AS absent,
             COUNT(a.id) FILTER (WHERE a.status = 'Leave') AS on_leave
      FROM attendance a WHERE a.date = $1
    `, [d]),

    // Section Alarms on date
    pool.query(`
      SELECT COUNT(id) AS total_alarms,
             COALESCE(SUM(CASE WHEN resolved_at IS NULL THEN 1 ELSE 0 END), 0) AS active_alarms
      FROM section_alarms WHERE DATE(created_at) = $1
    `, [d]),

    // Indents grouped by Department
    pool.query(`
      SELECT d.id AS dept_id, d.name AS dept_name, d.code AS dept_code,
             COUNT(i.id) AS total_indents,
             COALESCE(SUM(i.total_value), 0) AS total_indent_value,
             COALESCE(SUM(CASE WHEN i.status IN ('Issued', 'Partially Issued') THEN 1 ELSE 0 END), 0) AS issued_count,
             COALESCE(SUM(CASE WHEN i.status = 'Approved' THEN 1 ELSE 0 END), 0) AS approved_count,
             COALESCE(SUM(CASE WHEN i.status = 'Submitted' THEN 1 ELSE 0 END), 0) AS pending_count
      FROM departments d
      JOIN indents i ON d.id = i.department_id AND (DATE(i.date) = $1 OR DATE(i.created_at) = $1)
      GROUP BY d.id, d.name, d.code
      ORDER BY total_indent_value DESC, total_indents DESC
    `, [d]),

    // Detailed Indents List for date
    pool.query(`
      SELECT i.id, i.indent_number, i.status, i.priority, i.total_value, i.date, i.created_at,
             d.name AS dept_name, d.code AS dept_code,
             u.name AS raised_by_name,
             COUNT(ii.id) AS items_count
      FROM indents i
      JOIN departments d ON i.department_id = d.id
      LEFT JOIN users u ON i.raised_by = u.id
      LEFT JOIN indent_items ii ON i.id = ii.indent_id
      WHERE DATE(i.date) = $1 OR DATE(i.created_at) = $1
      GROUP BY i.id, i.indent_number, i.status, i.priority, i.total_value, i.date, i.created_at, d.name, d.code, u.name
      ORDER BY i.id DESC
    `, [d]),

    // Category-Wise Store Movements with Valuation
    pool.query(`
      SELECT COALESCE(mc.name, 'General / Consumables') AS category_name,
             COALESCE(parent.name, mc.name, 'Store') AS store_type,
             COUNT(DISTINCT m.id) AS total_materials_count,
             COALESCE(SUM(m.current_stock * m.unit_price), 0) AS total_stock_valuation,
             COALESCE(SUM(m.current_stock), 0) AS total_stock_qty,
             COUNT(sl.id) FILTER (WHERE sl.out_qty > 0) AS items_issued_count,
             COALESCE(SUM(sl.out_qty), 0) AS outward_qty,
             COALESCE(SUM(sl.value) FILTER (WHERE sl.out_qty > 0), 0) AS outward_value,
             COUNT(sl.id) FILTER (WHERE sl.in_qty > 0) AS items_received_count,
             COALESCE(SUM(sl.in_qty), 0) AS inward_qty,
             COALESCE(SUM(sl.value) FILTER (WHERE sl.in_qty > 0), 0) AS inward_value
      FROM material_categories mc
      LEFT JOIN material_categories parent ON parent.id = mc.parent_id
      LEFT JOIN materials m ON mc.id = m.category_id AND m.is_active = true
      LEFT JOIN stock_ledger sl ON m.id = sl.material_id AND sl.date = $1
      GROUP BY mc.name, parent.name, mc.type
      ORDER BY outward_value DESC, inward_value DESC
    `, [d]),

    // Purchase Orders on Date
    pool.query(`
      SELECT po.id, po.po_number, po.status, po.total_value, po.grand_total, po.date,
             v.name AS vendor_name, v.code AS vendor_code,
             COUNT(poi.id) AS items_count
      FROM purchase_orders po
      LEFT JOIN vendors v ON po.vendor_id = v.id
      LEFT JOIN po_items poi ON po.id = poi.po_id
      WHERE DATE(po.date) = $1 OR DATE(po.created_at) = $1
      GROUP BY po.id, po.po_number, po.status, po.total_value, po.grand_total, po.date, v.name, v.code
      ORDER BY po.id DESC
    `, [d]),

    // Inward GRN Receipts (Received against PO)
    pool.query(`
      SELECT sl.id, sl.date, sl.in_qty, sl.value, sl.batch_number, sl.remarks,
             m.code AS mat_code, m.name AS mat_name, m.uom,
             ps.name AS section_name, COALESCE(se.equipment_name, mac.name) AS machine_name,
             v.name AS vendor_name,
             po.po_number, po.id AS po_id
      FROM stock_ledger sl
      JOIN materials m ON sl.material_id = m.id
      LEFT JOIN plant_sections ps ON ps.id = m.section_id
      LEFT JOIN machines mac ON mac.id = m.machine_id
      LEFT JOIN section_equipment se ON se.id = m.section_equipment_id
      LEFT JOIN vendors v ON sl.vendor_id = v.id
      LEFT JOIN purchase_orders po ON sl.reference_type = 'PO' AND (CASE WHEN sl.reference_id::text ~ '^[0-9]+$' THEN sl.reference_id::int = po.id ELSE FALSE END)
      WHERE sl.date = $1 AND sl.transaction_type IN ('grn', 'in')
      ORDER BY sl.id DESC
    `, [d]),

    // Outward Issues
    pool.query(`
      SELECT sl.id, sl.date, sl.out_qty, sl.value, sl.remarks,
             m.code AS mat_code, m.name AS mat_name, m.uom, m.current_stock, m.reorder_level,
             ps.name AS section_name, COALESCE(se.equipment_name, mac.name) AS machine_name,
             COALESCE(d.name, (
               SELECT d2.name FROM indents ind JOIN departments d2 ON ind.department_id = d2.id
               WHERE (CASE WHEN sl.reference_id::text ~ '^[0-9]+$' THEN sl.reference_id::int = ind.id ELSE FALSE END) AND UPPER(sl.reference_type) = 'INDENT' LIMIT 1
             ), 'General Mill') AS dept_name
      FROM stock_ledger sl
      JOIN materials m ON sl.material_id = m.id
      LEFT JOIN plant_sections ps ON ps.id = m.section_id
      LEFT JOIN machines mac ON mac.id = m.machine_id
      LEFT JOIN section_equipment se ON se.id = m.section_equipment_id
      LEFT JOIN store_issues si ON sl.reference_type = 'ISSUE' AND (CASE WHEN sl.reference_id::text ~ '^[0-9]+$' THEN sl.reference_id::int = si.id ELSE FALSE END)
      LEFT JOIN departments d ON si.department_id = d.id
      WHERE sl.date = $1 AND sl.transaction_type IN ('issue', 'out')
      ORDER BY sl.value DESC, sl.id DESC
    `, [d]),

    // Top 5 High-Value Item Issues on Date
    pool.query(`
      SELECT sl.id, sl.out_qty, sl.value, sl.remarks,
             m.code AS mat_code, m.name AS mat_name, m.uom, m.unit_price, m.current_stock, m.reorder_level,
             ps.name AS section_name, COALESCE(se.equipment_name, mac.name) AS machine_name,
             COALESCE(d.name, (
               SELECT d2.name FROM indents ind JOIN departments d2 ON ind.department_id = d2.id
               WHERE (CASE WHEN sl.reference_id::text ~ '^[0-9]+$' THEN sl.reference_id::int = ind.id ELSE FALSE END) AND UPPER(sl.reference_type) = 'INDENT' LIMIT 1
             ), 'General Mill') AS dept_name
      FROM stock_ledger sl
      JOIN materials m ON sl.material_id = m.id
      LEFT JOIN plant_sections ps ON ps.id = m.section_id
      LEFT JOIN machines mac ON mac.id = m.machine_id
      LEFT JOIN section_equipment se ON se.id = m.section_equipment_id
      LEFT JOIN store_issues si ON sl.reference_type = 'ISSUE' AND (CASE WHEN sl.reference_id::text ~ '^[0-9]+$' THEN sl.reference_id::int = si.id ELSE FALSE END)
      LEFT JOIN departments d ON si.department_id = d.id
      WHERE sl.date = $1 AND sl.transaction_type IN ('issue', 'out') AND sl.out_qty > 0
      ORDER BY sl.value DESC
      LIMIT 8
    `, [d]),

    // Critical Low Stock Alerts (Stock <= Reorder Level)
    pool.query(`
      SELECT m.id, m.code, m.name, m.uom, m.current_stock, m.reorder_level, m.unit_price,
             (m.current_stock * m.unit_price) AS stock_value,
             mc.name AS category_name,
             ps.name AS section_name, COALESCE(se.equipment_name, mac.name) AS machine_name,
             COALESCE(parent.name, mc.name) AS store_name
      FROM materials m
      JOIN material_categories mc ON mc.id = m.category_id
      LEFT JOIN material_categories parent ON parent.id = mc.parent_id
      LEFT JOIN plant_sections ps ON ps.id = m.section_id
      LEFT JOIN machines mac ON mac.id = m.machine_id
      LEFT JOIN section_equipment se ON se.id = m.section_equipment_id
      WHERE m.is_active = true AND m.current_stock <= m.reorder_level
      ORDER BY (m.reorder_level - m.current_stock) DESC, (m.current_stock * m.unit_price) DESC
      LIMIT 10
    `),

    // Detailed GRN records with line items
    pool.query(`
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
    `, [d]),

    // Detailed Indents with line items
    pool.query(`
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
    `, [d]),

    // Mill active catalog totals
    pool.query(`
      SELECT COUNT(id) AS total_active_materials,
             COALESCE(SUM(current_stock * unit_price), 0) AS total_inventory_valuation,
             COALESCE(SUM(current_stock), 0) AS total_stock_units
      FROM materials
      WHERE is_active = true
    `)
  ]);

  const prod = prodRes.rows[0] || {};
  const util = utilityRes.rows[0] || {};
  const qa = qualityRes.rows[0] || {};
  const dt = downtimeRes.rows[0] || {};
  const so = salesRes.rows[0] || {};
  const disp = dispatchRes.rows[0] || {};
  const ind = indentsRes.rows[0] || {};
  const st = stockMoveRes.rows[0] || {};
  const hr = hrRes.rows[0] || {};
  const al = alarmsRes.rows[0] || {};
  const catTotals = catalogTotalsRes.rows[0] || {};

  const indentsByDept = indentsByDeptRes.rows || [];
  const indentsList = indentsListRes.rows || [];
  const categoryWiseStore = categoryStoreRes.rows || [];
  const purchases = purchaseOrdersRes.rows || [];
  const inwardGRNs = inwardGrnRes.rows || [];
  const outwardIssues = outwardIssuesRes.rows || [];
  const topItemIssues = (topItemIssuesRes?.rows?.length ? topItemIssuesRes.rows : outwardIssues.slice(0, 8));
  const criticalLowStock = criticalLowStockRes?.rows || [];
  const detailedGrns = detailedGrnRes?.rows || [];
  const detailedIndents = detailedIndentsRes?.rows || [];

  const totalMtVal = Number(prod.total_mt || 0);
  const totalPowerUnits = Number(util.total_power_units || 0);
  const specificPower = totalMtVal > 0 ? (totalPowerUnits / totalMtVal) : 0;
  const specificSteam = totalMtVal > 0 ? (Number(util.total_steam_mt || 0) / totalMtVal) : 0;

  const totalReceivedVal = Number(st.total_received_value || inwardGRNs.reduce((a, b) => a + Number(b.value || 0), 0));
  const totalIssuedVal = Number(st.total_issue_value || outwardIssues.reduce((a, b) => a + Number(b.value || 0), 0));
  const totalMillVal = Number(catTotals.total_inventory_valuation || 0);

  const compiled = {
    date: d,
    compiledAt: new Date().toISOString(),
    production: {
      totalReels: Number(prod.total_reels || 0),
      totalKg: Number(prod.total_kg || 0),
      totalMt: totalMtVal,
      avgEfficiency: Number(prod.avg_efficiency || 0),
      avgGsm: Number(prod.avg_gsm || 0),
      avgMoisture: Number(prod.avg_moisture || 0),
      downtimeMin: Number(prod.total_downtime_min || 0),
      byMachine: reelsRes.rows
    },
    utility: {
      powerUnits: totalPowerUnits,
      steamMt: Number(util.total_steam_mt || 0),
      coalKg: Number(util.total_coal_kg || 0),
      waterKl: Number(util.total_water_kl || 0),
      boilerPressure: Number(util.avg_boiler_pressure || 0),
      boilerTemp: Number(util.avg_boiler_temp || 0),
      specificPowerKwhPerMt: specificPower,
      specificSteamMtPerMt: specificSteam
    },
    quality: {
      totalTests: Number(qa.total_tests || 0),
      passed: Number(qa.passed || 0),
      failed: Number(qa.failed || 0),
      held: Number(qa.held || 0),
      passRate: Number(qa.pass_rate || 100)
    },
    maintenance: {
      breakdowns: Number(dt.breakdown_count || 0),
      downtimeMin: Number(dt.total_downtime_min || 0),
      affectedMachines: dt.affected_machines || 'None'
    },
    commercial: {
      ordersBooked: Number(so.new_orders || 0),
      bookedMt: Number(so.booked_mt || 0),
      bookedValue: Number(so.booked_value || 0),
      dispatchesCount: Number(disp.dispatches_count || 0),
      dispatchedMt: Number(disp.dispatched_mt || 0),
      dispatchedValue: Number(so.booked_value || 0)
    },
    storeAndIndents: {
      indentsRaised: Number(ind.indents_raised || 0),
      indentsIssued: Number(ind.indents_issued || 0),
      indentsValue: Number(ind.indents_value || 0),
      stockReceivedQty: Number(st.total_received_qty || 0),
      stockReceivedValue: totalReceivedVal,
      stockIssuedQty: Number(st.total_issued_qty || 0),
      stockIssueValue: totalIssuedVal
    },
    totalReceivedValue: totalReceivedVal,
    totalReceivedQty: Number(st.total_received_qty || 0),
    totalMillInventoryValuation: totalMillVal,
    totalActiveMaterials: Number(catTotals.total_active_materials || 0),
    indentsByDept,
    indentsList,
    detailedIndents,
    categoryWiseStore,
    purchases,
    inwardGRNs,
    detailedGrns,
    outwardIssues,
    topItemIssues,
    criticalLowStock,
    hr: {
      present: Number(hr.present || 0),
      absent: Number(hr.absent || 0),
      onLeave: Number(hr.on_leave || 0)
    },
    safety: {
      totalAlarms: Number(al.total_alarms || 0),
      activeAlarms: Number(al.active_alarms || 0)
    }
  };

  return compiled;
}

// GET /api/reports/whatsapp-digest — Get compiled data + pre-formatted WhatsApp text
router.get('/whatsapp-digest', auth, ar(async (req, res) => {
  const { date, type = 'master', remarks = '', signOff = '' } = req.query;
  const targetDate = date || new Date().toISOString().slice(0, 10);
  const data = await compileEOD(targetDate);

  const cfg = {
    customRemarks: remarks,
    senderSignOff: signOff
  };

  let whatsappText = '';
  switch (type) {
    case 'grn':
      whatsappText = waGen.generateGrnWhatsAppReport(data, cfg);
      break;
    case 'indent':
      whatsappText = waGen.generateIndentWhatsAppReport(data, cfg);
      break;
    case 'item':
      whatsappText = waGen.generateItemWiseWhatsAppReport(data, cfg);
      break;
    case 'inventory':
      whatsappText = waGen.generateInventoryValuationReport(data, cfg);
      break;
    case 'master':
    default:
      whatsappText = waGen.generateMasterWhatsAppReport(data, cfg);
      break;
  }

  res.json({
    success: true,
    type,
    date: targetDate,
    data,
    whatsappText
  });
}));

// POST /api/reports/whatsapp-digest/preview — Dynamic WhatsApp Formatter
router.post('/whatsapp-digest/preview', auth, ar(async (req, res) => {
  const { date, type = 'master', config = {} } = req.body || {};
  const targetDate = date || new Date().toISOString().slice(0, 10);
  const data = await compileEOD(targetDate);

  let whatsappText = '';
  switch (type) {
    case 'grn':
      whatsappText = waGen.generateGrnWhatsAppReport(data, config);
      break;
    case 'indent':
      whatsappText = waGen.generateIndentWhatsAppReport(data, config);
      break;
    case 'item':
      whatsappText = waGen.generateItemWiseWhatsAppReport(data, config);
      break;
    case 'inventory':
      whatsappText = waGen.generateInventoryValuationReport(data, config);
      break;
    case 'master':
    default:
      whatsappText = waGen.generateMasterWhatsAppReport(data, config);
      break;
  }

  res.json({
    success: true,
    type,
    date: targetDate,
    whatsappText
  });
}));

// GET /api/reports/eod — Get compiled EOD Mill Digest
router.get('/eod', auth, ar(async (req, res) => {
  const { date } = req.query;
  const targetDate = date || new Date().toISOString().slice(0, 10);
  const data = await compileEOD(targetDate);

  if (req.query.format === 'csv') {
    const headers = ['Module', 'Metric', 'Value', 'Unit'];
    const p = data.production, u = data.utility, q = data.quality, m = data.maintenance, c = data.commercial, s = data.storeAndIndents;
    const rows = [
      ['Production', 'Total Reels', p.totalReels, 'Reels'],
      ['Production', 'Total Net Weight', p.totalMt.toFixed(3), 'MT'],
      ['Production', 'Average Efficiency', p.avgEfficiency.toFixed(1), '%'],
      ['Production', 'Average GSM', p.avgGsm.toFixed(1), 'GSM'],
      ['Utility', 'Power Consumed', u.powerUnits.toFixed(0), 'Units'],
      ['Utility', 'Steam Generated', u.steamMt.toFixed(2), 'MT'],
      ['Utility', 'Coal Consumed', u.coalKg.toFixed(0), 'KG'],
      ['Utility', 'Fresh Water', u.waterKl.toFixed(0), 'KL'],
      ['Quality', 'Total Tests', q.totalTests, 'Tests'],
      ['Quality', 'Pass Rate', `${q.passRate}%`, '%'],
      ['Maintenance', 'Breakdowns', m.breakdowns, 'Count'],
      ['Maintenance', 'Total Downtime', m.downtimeMin, 'Minutes'],
      ['Commercial', 'Dispatched', c.dispatchedMt.toFixed(3), 'MT'],
      ['Commercial', 'Orders Booked Value', `Rs. ${c.bookedValue.toLocaleString('en-IN')}`, 'INR'],
      ['Store', 'Items Issued Value', `Rs. ${s.stockIssueValue.toLocaleString('en-IN')}`, 'INR'],
    ];
    return sendCSV(res, `EOD_Mill_Report_${targetDate}.csv`, headers, rows);
  }

  res.json({ success: true, data });
}));

// POST /api/reports/eod/send — 1-Click Send & Archive Master EOD Report
router.post('/eod/send', auth, requireLevel(2), ar(async (req, res) => {
  const { date, recipients, notes } = req.body || {};
  const targetDate = date || new Date().toISOString().slice(0, 10);
  const data = await compileEOD(targetDate);

  const { rows } = await pool.query(
    `INSERT INTO eod_reports (report_date, summary_json, status, sent_by, sent_at, recipients, notes)
     VALUES ($1, $2, 'Sent', $3, NOW(), $4, $5)
     RETURNING *`,
    [targetDate, JSON.stringify(data), req.user.id, recipients || 'Management / All Plant Heads', notes || null]
  );

  // Publish broadcast event
  try {
    publish('mkpm.reports.events', String(rows[0].id), {
      event: 'report.eod_sent',
      reportId: rows[0].id,
      date: targetDate,
      sentBy: req.user.name,
      timestamp: new Date()
    });
  } catch { }

  res.json({
    success: true,
    message: `End of Day (EOD) Report for ${targetDate} compiled and sent successfully in one go!`,
    data,
    record: rows[0]
  });
}));

// GET /api/reports/eod/history — Past EOD reports list
router.get('/eod/history', auth, requireLevel(2), ar(async (req, res) => {
  const { rows } = await pool.query(`
    SELECT r.id, r.report_date AS "reportDate", r.status, r.sent_at AS "sentAt",
           r.recipients, r.notes, u.name AS "sentByName",
           (r.summary_json->'production'->>'totalMt')::numeric AS "totalMt",
           (r.summary_json->'commercial'->>'dispatchedMt')::numeric AS "dispatchedMt",
           (r.summary_json->'utility'->>'powerUnits')::numeric AS "powerUnits"
    FROM eod_reports r
    LEFT JOIN users u ON u.id = r.sent_by
    ORDER BY r.sent_at DESC LIMIT 50
  `);
  res.json({ success: true, data: rows });
}));

// ── 2. STORES & INVENTORY REPORT ─────────────────────────────────────────────
router.get('/stores', auth, requireLevel(2), ar(async (req, res) => {
  const { store_type, category_id, section_id, machine_id, low_stock, search } = req.query;
  const conds = ['m.is_active = true'];
  const params = [];
  let p = 1;

  if (category_id) {
    conds.push(`(m.category_id = $${p} OR mc.parent_id = $${p})`);
    params.push(category_id);
    p++;
  }
  if (section_id) {
    conds.push(`m.section_id = $${p}`);
    params.push(parseInt(section_id));
    p++;
  }
  if (machine_id) {
    conds.push(`(m.machine_id = $${p} OR se.machine_id = $${p})`);
    params.push(parseInt(machine_id));
    p++;
  }
  if (store_type) {
    conds.push(`(mc.type ILIKE $${p} OR parent.name ILIKE $${p} OR mc.name ILIKE $${p})`);
    params.push(`%${store_type}%`);
    p++;
  }
  if (low_stock === 'true') {
    conds.push(`m.current_stock <= m.reorder_level`);
  }
  if (search) {
    conds.push(`(m.name ILIKE $${p} OR m.code ILIKE $${p} OR m.hsn_code ILIKE $${p} OR ps.name ILIKE $${p} OR mac.name ILIKE $${p} OR se.equipment_name ILIKE $${p})`);
    params.push(`%${search}%`);
    p++;
  }

  const where = conds.join(' AND ');

  const [itemsRes, summaryRes] = await Promise.all([
    pool.query(`
      SELECT m.id, m.code, m.name, m.uom, m.hsn_code,
             m.bin_location AS "binLocation",
             m.current_stock AS "currentStock",
             m.reorder_level AS "reorderLevel",
             m.min_stock AS "minStock",
             m.max_stock AS "maxStock",
             m.unit_price AS "unitPrice",
             (m.current_stock * m.unit_price) AS "stockValue",
             m.criticality_class AS "criticalityClass",
             mc.name AS "categoryName",
             mc.code AS "categoryCode",
             m.section_id AS "sectionId",
             ps.name AS "sectionName",
             m.machine_id AS "machineId",
             mac.name AS "machineName",
             m.section_equipment_id AS "sectionEquipmentId",
             se.equipment_name AS "equipmentName",
             COALESCE(parent.name, mc.name) AS "storeName",
             COALESCE((SELECT SUM(sl.in_qty) FROM stock_ledger sl WHERE sl.material_id = m.id), 0) AS received,
             COALESCE((SELECT SUM(sl.out_qty) FROM stock_ledger sl WHERE sl.material_id = m.id), 0) AS issued
      FROM materials m
      JOIN material_categories mc ON mc.id = m.category_id
      LEFT JOIN material_categories parent ON parent.id = mc.parent_id
      LEFT JOIN plant_sections ps ON ps.id = m.section_id
      LEFT JOIN machines mac ON mac.id = m.machine_id
      LEFT JOIN section_equipment se ON se.id = m.section_equipment_id
      WHERE ${where}
      ORDER BY ps.name NULLS LAST, parent.name NULLS FIRST, mc.name, m.name
      LIMIT 1000
    `, params),

    pool.query(`
      SELECT COUNT(m.id) AS total_items,
             COALESCE(SUM(m.current_stock * m.unit_price), 0) AS total_value,
             COUNT(m.id) FILTER (WHERE m.current_stock <= m.reorder_level) AS low_stock_count,
             COUNT(DISTINCT COALESCE(parent.name, mc.name)) AS store_types_count
      FROM materials m
      JOIN material_categories mc ON mc.id = m.category_id
      LEFT JOIN material_categories parent ON parent.id = mc.parent_id
      LEFT JOIN plant_sections ps ON ps.id = m.section_id
      LEFT JOIN machines mac ON mac.id = m.machine_id
      LEFT JOIN section_equipment se ON se.id = m.section_equipment_id
      WHERE ${where}
    `, params)
  ]);

  if (req.query.format === 'csv') {
    const headers = ['Code', 'Item Name', 'Section', 'Machine / Equipment', 'Store', 'Subcategory', 'UOM', 'HSN Code', 'Rack/Box', 'Opening Bal', 'Received', 'Issued', 'Current Stock', 'Unit Price', 'Stock Value', 'Criticality'];
    const csvRows = itemsRes.rows.map(r => {
      const rec = Number(r.received || 0);
      const iss = Number(r.issued || 0);
      const cur = Number(r.currentStock || 0);
      const op = cur - rec + iss;
      return [r.code, r.name, r.sectionName || '—', r.equipmentName || r.machineName || '—', r.storeName, r.categoryName, r.uom, r.hsn_code, r.binLocation, op.toFixed(3), rec.toFixed(3), iss.toFixed(3), cur.toFixed(3), r.unitPrice, r.stockValue, r.criticalityClass || '—'];
    });
    return sendCSV(res, `stores_inventory_report.csv`, headers, csvRows);
  }

  res.json({
    success: true,
    data: {
      summary: summaryRes.rows[0],
      items: itemsRes.rows
    }
  });
}));

// ── 2A. ITEM-WISE STORE MOVEMENT & VALUATION LEDGER ─────────────────────────
router.get('/stores/item-wise', auth, requireLevel(2), ar(async (req, res) => {
  const { from, to, store_type, category_id, section_id, machine_id, criticality, low_stock, search, page = 1, limit = 500 } = req.query;
  const f = from || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const t = to || new Date().toISOString().slice(0, 10);

  const conds = ['m.is_active = true'];
  const params = [f, t];
  let p = 3;

  if (category_id) {
    conds.push(`(m.category_id = $${p} OR mc.parent_id = $${p})`);
    params.push(category_id);
    p++;
  }
  if (section_id) {
    conds.push(`m.section_id = $${p}`);
    params.push(parseInt(section_id));
    p++;
  }
  if (machine_id) {
    conds.push(`(m.machine_id = $${p} OR se.machine_id = $${p})`);
    params.push(parseInt(machine_id));
    p++;
  }
  if (store_type) {
    conds.push(`(mc.type ILIKE $${p} OR parent.name ILIKE $${p} OR mc.name ILIKE $${p})`);
    params.push(`%${store_type}%`);
    p++;
  }
  if (criticality) {
    conds.push(`m.criticality_class = $${p}`);
    params.push(criticality);
    p++;
  }
  if (low_stock === 'true') {
    conds.push(`m.current_stock <= m.reorder_level`);
  }
  if (search) {
    conds.push(`(m.name ILIKE $${p} OR m.code ILIKE $${p} OR m.hsn_code ILIKE $${p} OR m.bin_location ILIKE $${p} OR ps.name ILIKE $${p} OR mac.name ILIKE $${p} OR se.equipment_name ILIKE $${p})`);
    params.push(`%${search}%`);
    p++;
  }

  const where = conds.join(' AND ');

  const [itemsRes, summaryRes] = await Promise.all([
    pool.query(`
      WITH ledger_in_after AS (
        SELECT material_id, COALESCE(SUM(in_qty), 0) AS in_qty, COALESCE(SUM(value), 0) AS in_val
        FROM stock_ledger WHERE date >= $1 AND transaction_type IN ('grn', 'in') GROUP BY material_id
      ),
      ledger_out_after AS (
        SELECT material_id, COALESCE(SUM(out_qty), 0) AS out_qty, COALESCE(SUM(value), 0) AS out_val
        FROM stock_ledger WHERE date >= $1 AND transaction_type IN ('issue', 'out') GROUP BY material_id
      ),
      period_in AS (
        SELECT material_id, COALESCE(SUM(in_qty), 0) AS period_in_qty, COALESCE(SUM(value), 0) AS period_in_val
        FROM stock_ledger WHERE date BETWEEN $1 AND $2 AND transaction_type IN ('grn', 'in') GROUP BY material_id
      ),
      period_out AS (
        SELECT material_id, COALESCE(SUM(out_qty), 0) AS period_out_qty, COALESCE(SUM(value), 0) AS period_out_val
        FROM stock_ledger WHERE date BETWEEN $1 AND $2 AND transaction_type IN ('issue', 'out') GROUP BY material_id
      )
      SELECT m.id, m.code, m.name, m.uom, m.hsn_code,
             m.bin_location AS "binLocation",
             m.unit_price AS "unitPrice",
             m.reorder_level AS "reorderLevel",
             m.min_stock AS "minStock",
             m.max_stock AS "maxStock",
             m.criticality_class AS "criticalityClass",
             mc.name AS "categoryName",
             mc.code AS "categoryCode",
             m.section_id AS "sectionId",
             ps.name AS "sectionName",
             m.machine_id AS "machineId",
             mac.name AS "machineName",
             m.section_equipment_id AS "sectionEquipmentId",
             se.equipment_name AS "equipmentName",
             COALESCE(parent.name, mc.name) AS "storeName",
             m.current_stock AS "currentStock",
             (m.current_stock - COALESCE(lia.in_qty, 0) + COALESCE(loa.out_qty, 0)) AS "openingStock",
             COALESCE(pin.period_in_qty, 0) AS "inwardQty",
             COALESCE(pin.period_in_val, 0) AS "inwardValue",
             COALESCE(pout.period_out_qty, 0) AS "outwardQty",
             COALESCE(pout.period_out_val, 0) AS "outwardValue",
             ((m.current_stock - COALESCE(lia.in_qty, 0) + COALESCE(loa.out_qty, 0)) + COALESCE(pin.period_in_qty, 0) - COALESCE(pout.period_out_qty, 0)) AS "closingStock",
             (((m.current_stock - COALESCE(lia.in_qty, 0) + COALESCE(loa.out_qty, 0)) + COALESCE(pin.period_in_qty, 0) - COALESCE(pout.period_out_qty, 0)) * m.unit_price) AS "closingValue",
             (m.current_stock * m.unit_price) AS "stockValue",
             CASE
               WHEN m.current_stock <= (m.reorder_level * 0.5) THEN 'Critical Shortage'
               WHEN m.current_stock <= m.reorder_level THEN 'Reorder Required'
               WHEN m.max_stock > 0 AND m.current_stock >= m.max_stock THEN 'Overstocked'
               ELSE 'Optimal'
             END AS "stockStatus"
      FROM materials m
      JOIN material_categories mc ON mc.id = m.category_id
      LEFT JOIN material_categories parent ON parent.id = mc.parent_id
      LEFT JOIN plant_sections ps ON ps.id = m.section_id
      LEFT JOIN machines mac ON mac.id = m.machine_id
      LEFT JOIN section_equipment se ON se.id = m.section_equipment_id
      LEFT JOIN ledger_in_after lia ON lia.material_id = m.id
      LEFT JOIN ledger_out_after loa ON loa.material_id = m.id
      LEFT JOIN period_in pin ON pin.material_id = m.id
      LEFT JOIN period_out pout ON pout.material_id = m.id
      WHERE ${where}
      ORDER BY ps.name NULLS LAST, parent.name NULLS FIRST, mc.name, m.name
      LIMIT $${p} OFFSET $${p + 1}
    `, [...params, parseInt(limit), (parseInt(page) - 1) * parseInt(limit)]),

    pool.query(`
      SELECT COUNT(m.id) AS total_items,
             COALESCE(SUM(m.current_stock * m.unit_price), 0) AS total_valuation,
             COUNT(m.id) FILTER (WHERE m.current_stock <= m.reorder_level) AS low_stock_count,
             COUNT(m.id) FILTER (WHERE m.current_stock <= (m.reorder_level * 0.5)) AS critical_shortage_count,
             COALESCE(SUM(pin.period_in_val), 0) AS total_inward_value,
             COALESCE(SUM(pout.period_out_val), 0) AS total_outward_value
      FROM materials m
      JOIN material_categories mc ON mc.id = m.category_id
      LEFT JOIN material_categories parent ON parent.id = mc.parent_id
      LEFT JOIN plant_sections ps ON ps.id = m.section_id
      LEFT JOIN machines mac ON mac.id = m.machine_id
      LEFT JOIN section_equipment se ON se.id = m.section_equipment_id
      LEFT JOIN (
        SELECT material_id, COALESCE(SUM(value), 0) AS period_in_val
        FROM stock_ledger WHERE date BETWEEN $1 AND $2 AND transaction_type IN ('grn', 'in') GROUP BY material_id
      ) pin ON pin.material_id = m.id
      LEFT JOIN (
        SELECT material_id, COALESCE(SUM(value), 0) AS period_out_val
        FROM stock_ledger WHERE date BETWEEN $1 AND $2 AND transaction_type IN ('issue', 'out') GROUP BY material_id
      ) pout ON pout.material_id = m.id
      WHERE ${where}
    `, params)
  ]);

  if (req.query.format === 'csv') {
    const headers = ['Item Code', 'Item Description', 'Section', 'Machine / Equipment', 'Store Type', 'Category', 'UOM', 'HSN Code', 'Bin Location', 'Criticality Class', 'Opening Qty', 'Inward Qty (GRN)', 'Inward Value (₹)', 'Outward Qty (Issues)', 'Outward Value (₹)', 'Closing Qty', 'Closing Value (₹)', 'Unit Rate (₹)', 'Stock Status'];
    const rows = itemsRes.rows.map(r => [
      r.code,
      r.name,
      r.sectionName || '—',
      r.equipmentName || r.machineName || '—',
      r.storeName,
      r.categoryName,
      r.uom,
      r.hsn_code || '—',
      r.binLocation || '—',
      r.criticalityClass || 'Routine',
      Number(r.openingStock || 0).toFixed(3),
      Number(r.inwardQty || 0).toFixed(3),
      Number(r.inwardValue || 0).toFixed(2),
      Number(r.outwardQty || 0).toFixed(3),
      Number(r.outwardValue || 0).toFixed(2),
      Number(r.closingStock || 0).toFixed(3),
      Number(r.closingValue || 0).toFixed(2),
      Number(r.unitPrice || 0).toFixed(2),
      r.stockStatus
    ]);
    return sendCSV(res, `item_wise_store_movement_report_${f}_to_${t}.csv`, headers, rows);
  }

  res.json({
    success: true,
    data: {
      from: f,
      to: t,
      summary: summaryRes.rows[0],
      items: itemsRes.rows,
      page: parseInt(page),
      limit: parseInt(limit)
    }
  });
}));

// ── 2B. ITEM INDIVIDUAL TRANSACTION AUDIT TIMELINE ──────────────────────────
router.get('/stores/item-ledger/:id', auth, requireLevel(2), ar(async (req, res) => {
  const { id } = req.params;
  const { rows: [mat] } = await pool.query(`
    SELECT m.*, mc.name AS category_name, COALESCE(parent.name, mc.name) AS store_name
    FROM materials m
    JOIN material_categories mc ON mc.id = m.category_id
    LEFT JOIN material_categories parent ON parent.id = mc.parent_id
    WHERE m.id = $1
  `, [id]);

  if (!mat) return res.status(404).json({ success: false, message: 'Material not found' });

  const { rows: ledger } = await pool.query(`
    SELECT sl.id, sl.date, sl.created_at AS "createdAt", sl.transaction_type AS "transactionType",
           sl.reference_type AS "referenceType", sl.reference_id AS "referenceId",
           sl.in_qty AS "inQty", sl.out_qty AS "outQty", sl.balance AS "balanceQty",
           sl.unit_price AS "unitPrice", sl.value, sl.batch_number AS "batchNumber", sl.remarks,
           COALESCE(v.name, si_dept.name, ind_dept.name, 'Mill Store') AS "partyName",
           COALESCE(po.po_number, ind.indent_number, g.grn_number, ('VOUCHER-' || sl.id)) AS "voucherNumber",
           u.name AS "createdByName"
    FROM stock_ledger sl
    LEFT JOIN vendors v ON sl.vendor_id = v.id
    LEFT JOIN store_issues si ON sl.reference_type = 'ISSUE' AND (CASE WHEN sl.reference_id::text ~ '^[0-9]+$' THEN sl.reference_id::int = si.id ELSE FALSE END)
    LEFT JOIN indents ind ON UPPER(sl.reference_type) = 'INDENT' AND (CASE WHEN sl.reference_id::text ~ '^[0-9]+$' THEN sl.reference_id::int = ind.id ELSE FALSE END)
    LEFT JOIN departments si_dept ON si.department_id = si_dept.id
    LEFT JOIN departments ind_dept ON ind.department_id = ind_dept.id
    LEFT JOIN purchase_orders po ON sl.reference_type = 'PO' AND (CASE WHEN sl.reference_id::text ~ '^[0-9]+$' THEN sl.reference_id::int = po.id ELSE FALSE END)
    LEFT JOIN grn g ON sl.reference_type = 'GRN' AND (CASE WHEN sl.reference_id::text ~ '^[0-9]+$' THEN sl.reference_id::int = g.id ELSE FALSE END)
    LEFT JOIN users u ON sl.created_by = u.id
    WHERE sl.material_id = $1
    ORDER BY sl.date DESC, sl.id DESC
    LIMIT 300
  `, [id]);

  res.json({
    success: true,
    data: {
      material: mat,
      transactions: ledger
    }
  });
}));

// ── 2C. ITEM-WISE DEPARTMENT CONSUMPTION MATRIX ──────────────────────────────
router.get('/stores/consumption-by-item', auth, requireLevel(2), ar(async (req, res) => {
  const { from, to, department_id, category_id, search } = req.query;
  const f = from || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const t = to || new Date().toISOString().slice(0, 10);

  const conds = [
    `sl.transaction_type IN ('issue', 'out')`,
    `sl.out_qty > 0`,
    `sl.date BETWEEN $1 AND $2`
  ];
  const params = [f, t];
  let p = 3;

  if (department_id) {
    conds.push(`(si.department_id = $${p} OR ind.department_id = $${p})`);
    params.push(department_id);
    p++;
  }
  if (category_id) {
    conds.push(`(m.category_id = $${p} OR mc.parent_id = $${p})`);
    params.push(category_id);
    p++;
  }
  if (search) {
    conds.push(`(m.name ILIKE $${p} OR m.code ILIKE $${p})`);
    params.push(`%${search}%`);
    p++;
  }

  const where = conds.join(' AND ');

  const [itemsRes, deptSummaryRes, prodRes] = await Promise.all([
    pool.query(`
      SELECT COALESCE(si_dept.name, ind_dept.name, 'General Mill Operations') AS "departmentName",
             COALESCE(si_dept.id, ind_dept.id, 0) AS "departmentId",
             m.id AS "materialId", m.code AS "materialCode", m.name AS "materialName", m.uom,
             m.criticality_class AS "criticalityClass",
             mc.name AS "categoryName",
             COALESCE(parent.name, mc.name) AS "storeName",
             COUNT(sl.id) AS "issueEventsCount",
             COALESCE(SUM(sl.out_qty), 0) AS "totalQuantityConsumed",
             COALESCE(SUM(sl.value), 0) AS "totalConsumptionValue",
             COALESCE(AVG(sl.unit_price), m.unit_price) AS "avgUnitRate"
      FROM stock_ledger sl
      JOIN materials m ON sl.material_id = m.id
      JOIN material_categories mc ON m.category_id = mc.id
      LEFT JOIN material_categories parent ON parent.id = mc.parent_id
      LEFT JOIN store_issues si ON sl.reference_type = 'ISSUE' AND (CASE WHEN sl.reference_id::text ~ '^[0-9]+$' THEN sl.reference_id::int = si.id ELSE FALSE END)
      LEFT JOIN indents ind ON UPPER(sl.reference_type) = 'INDENT' AND (CASE WHEN sl.reference_id::text ~ '^[0-9]+$' THEN sl.reference_id::int = ind.id ELSE FALSE END)
      LEFT JOIN departments si_dept ON si.department_id = si_dept.id
      LEFT JOIN departments ind_dept ON ind.department_id = ind_dept.id
      WHERE ${where}
      GROUP BY si_dept.name, ind_dept.name, si_dept.id, ind_dept.id, m.id, m.code, m.name, m.uom, m.criticality_class, mc.name, parent.name, m.unit_price
      ORDER BY "totalConsumptionValue" DESC
      LIMIT 1000
    `, params),

    pool.query(`
      SELECT COALESCE(si_dept.name, ind_dept.name, 'General Mill Operations') AS "departmentName",
             COUNT(DISTINCT m.id) AS "uniqueMaterialsCount",
             COUNT(sl.id) AS "totalIssuesCount",
             COALESCE(SUM(sl.value), 0) AS "departmentTotalValue"
      FROM stock_ledger sl
      JOIN materials m ON sl.material_id = m.id
      JOIN material_categories mc ON m.category_id = mc.id
      LEFT JOIN material_categories parent ON parent.id = mc.parent_id
      LEFT JOIN store_issues si ON sl.reference_type = 'ISSUE' AND sl.reference_id = si.id
      LEFT JOIN indents ind ON UPPER(sl.reference_type) = 'INDENT' AND sl.reference_id = ind.id
      LEFT JOIN departments si_dept ON si.department_id = si_dept.id
      LEFT JOIN departments ind_dept ON ind.department_id = ind_dept.id
      WHERE ${where}
      GROUP BY si_dept.name, ind_dept.name
      ORDER BY "departmentTotalValue" DESC
    `, params),

    pool.query(`
      SELECT COALESCE(SUM(weight_kg) / 1000.0, 0) AS total_mt
      FROM reels
      WHERE DATE(start_time) BETWEEN $1 AND $2
    `, [f, t])
  ]);

  const prodMt = Number(prodRes.rows[0]?.total_mt || 0);
  const totalValue = itemsRes.rows.reduce((sum, r) => sum + Number(r.totalConsumptionValue || 0), 0);
  const costPerMt = prodMt > 0 ? (totalValue / prodMt) : 0;

  if (req.query.format === 'csv') {
    const headers = ['Department', 'Material Code', 'Material Name', 'Store Type', 'Category', 'UOM', 'Criticality', 'Issue Events', 'Qty Consumed', 'Avg Unit Rate (₹)', 'Total Value (₹)', 'Cost per MT Paper (₹)'];
    const rows = itemsRes.rows.map(r => [
      r.departmentName,
      r.materialCode,
      r.materialName,
      r.storeName,
      r.categoryName,
      r.uom,
      r.criticalityClass || 'Routine',
      r.issueEventsCount,
      Number(r.totalQuantityConsumed).toFixed(3),
      Number(r.avgUnitRate).toFixed(2),
      Number(r.totalConsumptionValue).toFixed(2),
      prodMt > 0 ? (Number(r.totalConsumptionValue) / prodMt).toFixed(2) : '—'
    ]);
    return sendCSV(res, `item_consumption_by_dept_${f}_${t}.csv`, headers, rows);
  }

  res.json({
    success: true,
    data: {
      from: f,
      to: t,
      productionMt: prodMt,
      totalConsumptionValue: totalValue,
      costPerMtPaper: costPerMt,
      byDepartment: deptSummaryRes.rows,
      items: itemsRes.rows
    }
  });
}));

// ── 3. DOWNTIME & BREAKDOWN REPORT ───────────────────────────────────────────
router.get('/downtime', auth, requireLevel(2), ar(async (req, res) => {
  const { from, to, machine_id, section_id } = req.query;
  const f = from || new Date().toISOString().slice(0, 10);
  const t = to || new Date().toISOString().slice(0, 10);

  const conds = [`d.start_time >= $1::date AND d.start_time <= $2::date + interval '1 day'`];
  const params = [f, t];
  let p = 3;

  if (machine_id) { conds.push(`d.machine_id = $${p++}`); params.push(machine_id); }

  const where = conds.join(' AND ');

  const [summaryRes, byMachineRes, entriesRes] = await Promise.all([
    pool.query(`
      SELECT COUNT(d.id) AS total_events,
             COALESCE(SUM(d.duration_min), 0) AS total_downtime_min,
             COALESCE(AVG(d.duration_min), 0) AS avg_duration_min,
             COUNT(DISTINCT d.machine_id) AS machines_affected
      FROM downtime_entries d
      JOIN machines m ON m.id = d.machine_id
      WHERE ${where}
    `, params),

    pool.query(`
      SELECT m.name AS machine, m.code,
             COUNT(d.id) AS events,
             COALESCE(SUM(d.duration_min), 0) AS total_min,
             COALESCE(AVG(d.duration_min), 0) AS mttr_min
      FROM downtime_entries d
      JOIN machines m ON m.id = d.machine_id
      WHERE ${where}
      GROUP BY m.id, m.name, m.code
      ORDER BY total_min DESC
    `, params),

    pool.query(`
      SELECT d.id, d.start_time AS "startTime", d.end_time AS "endTime",
             d.duration_min AS "durationMin", d.category AS "reasonCategory",
             d.reason, d.corrective_action AS "actionTaken",
             m.name AS machine, m.code AS "machineCode"
      FROM downtime_entries d
      JOIN machines m ON m.id = d.machine_id
      WHERE ${where}
      ORDER BY d.start_time DESC
      LIMIT 500
    `, params)
  ]);

  if (req.query.format === 'csv') {
    const headers = ['Machine', 'Code', 'Start Time', 'End Time', 'Duration (Min)', 'Category', 'Reason', 'Action Taken'];
    const rows = entriesRes.rows.map(r => [r.machine, r.machineCode, r.startTime?.toISOString().slice(0, 16).replace('T', ' '), r.endTime ? r.endTime.toISOString().slice(0, 16).replace('T', ' ') : 'Ongoing', r.durationMin, r.reasonCategory, r.reason, r.actionTaken]);
    return sendCSV(res, `downtime_report_${f}_${t}.csv`, headers, rows);
  }

  res.json({
    success: true,
    data: {
      from: f, to: t,
      summary: summaryRes.rows[0],
      byMachine: byMachineRes.rows,
      entries: entriesRes.rows
    }
  });
}));

// ── 4. INDENTS & STORE ISSUES REPORT ─────────────────────────────────────────
router.get('/indents', auth, requireLevel(2), ar(async (req, res) => {
  const { from, to, status, department_id } = req.query;
  const f = from || new Date().toISOString().slice(0, 10);
  const t = to || new Date().toISOString().slice(0, 10);

  const conds = [`DATE(i.created_at) BETWEEN $1 AND $2`];
  const params = [f, t];
  let p = 3;

  if (status) { conds.push(`i.status = $${p++}`); params.push(status); }
  if (department_id) { conds.push(`i.department_id = $${p++}`); params.push(department_id); }

  const where = conds.join(' AND ');

  const [summaryRes, byDeptRes, indentsRes] = await Promise.all([
    pool.query(`
      SELECT COUNT(i.id) AS total_indents,
             COALESCE(SUM(i.total_value), 0) AS total_value,
             COUNT(i.id) FILTER (WHERE i.status = 'Issued') AS issued_count,
             COUNT(i.id) FILTER (WHERE i.status = 'Approved') AS approved_count,
             COUNT(i.id) FILTER (WHERE i.status = 'Submitted') AS pending_count
      FROM indents i WHERE ${where}
    `, params),

    pool.query(`
      SELECT d.name AS department,
             COUNT(i.id) AS indents_count,
             COALESCE(SUM(i.total_value), 0) AS total_value,
             COUNT(i.id) FILTER (WHERE i.status = 'Issued') AS issued
      FROM indents i
      LEFT JOIN departments d ON d.id = i.department_id
      WHERE ${where}
      GROUP BY d.id, d.name
      ORDER BY total_value DESC
    `, params),

    pool.query(`
      SELECT i.id, i.indent_number AS "indentNumber", i.date, i.status, i.priority,
             i.total_value AS "totalValue", i.remarks, i.created_at AS "raisedAt",
             i.cancellation_reason AS "cancellationReason", i.cancelled_at AS "cancelledAt",
             cu.name AS "cancelledByName", cu.employee_code AS "cancelledByEmpCode",
             d.name AS department, d.code AS "deptCode",
             u.name AS "raisedBy", u.employee_code AS "raisedByEmpCode",
             r.name AS "raisedByRole", u.email AS "raisedByEmail",
             ps.section_code AS "sectionCode", ps.name AS "sectionName",
             mch.name AS "machineName", mch.code AS "machineCode",
             (SELECT STRING_AGG(ii.purpose, ' | ') FROM indent_items ii WHERE ii.indent_id = i.id) AS "technicalPurposes",
             (SELECT STRING_AGG(DISTINCT ii.reason_code, ', ') FROM indent_items ii WHERE ii.indent_id = i.id) AS "reasonCodes",
             (SELECT COUNT(*) FROM indent_items ii WHERE ii.indent_id = i.id)::int AS "itemCount",
             (SELECT STRING_AGG(DISTINCT v.name, ', ') FROM purchase_orders po JOIN vendors v ON v.id = po.vendor_id WHERE po.indent_id = i.id) AS "vendorNames",
             (SELECT STRING_AGG(DISTINCT po.po_number, ', ') FROM purchase_orders po WHERE po.indent_id = i.id) AS "poNumbers"
      FROM indents i
      LEFT JOIN departments d ON d.id = i.department_id
      LEFT JOIN users u ON u.id = i.raised_by
      LEFT JOIN roles r ON r.id = u.role_id
      LEFT JOIN users cu ON cu.id = i.cancelled_by
      LEFT JOIN plant_sections ps ON ps.id = i.section_id
      LEFT JOIN machines mch ON mch.id = i.machine_id
      WHERE ${where}
      ORDER BY i.created_at DESC
      LIMIT 500
    `, params)
  ]);

  if (req.query.format === 'csv') {
    const headers = [
      'Indent No', 'Date', 'Department', 'Plant Section', 'Machine / Equipment',
      'Raised By (Indentor)', 'Indentor Employee Code', 'Designation / Role',
      'Reason Codes', 'Technical Justification / Purpose',
      'Status', 'Cancellation Reason', 'Total Value (INR)', 'Work Order / Remarks',
      'Vendor Name (if Purchased)', 'PO Number(s)'
    ];
    const rows = indentsRes.rows.map(r => [
      r.indentNumber,
      r.date?.toISOString().slice(0, 10),
      r.department,
      r.sectionCode ? `[${r.sectionCode}] ${r.sectionName || ''}` : 'Plant General',
      r.machineName ? `[${r.machineCode}] ${r.machineName}` : 'General Spares',
      r.raisedBy,
      r.raisedByEmpCode || '—',
      r.raisedByRole || 'Technical Staff',
      r.reasonCodes || 'Routine Replacement',
      r.technicalPurposes || 'General mill replacement',
      r.status,
      r.cancellationReason || '—',
      r.totalValue,
      r.remarks || '—',
      r.vendorNames || '—',
      r.poNumbers || '—'
    ]);
    return sendCSV(res, `indents_report_${f}_${t}.csv`, headers, rows);
  }

  res.json({
    success: true,
    data: {
      from: f, to: t,
      summary: summaryRes.rows[0],
      byDepartment: byDeptRes.rows,
      indents: indentsRes.rows
    }
  });
}));

// ── 5. PRODUCTION REPORT ──────────────────────────────────────────────────────
router.get('/production', auth, requireLevel(2), ar(async (req, res) => {
  const { from, to, machine_id, grade_id } = req.query;
  const f = from || new Date().toISOString().slice(0, 10);
  const t = to || new Date().toISOString().slice(0, 10);
  const conds = [`DATE(r.start_time) BETWEEN $1 AND $2`];
  const params = [f, t]; let p = 3;
  if (machine_id) { conds.push(`r.machine_id=$${p++}`); params.push(machine_id); }
  if (grade_id) { conds.push(`r.grade_id=$${p++}`); params.push(grade_id); }
  const where = conds.join(' AND ');

  const fmt = req.query.format;
  const [summary, byMachine, byGrade, reels] = await Promise.all([
    pool.query(
      `SELECT COUNT(*) as total_reels,
              COALESCE(SUM(weight_kg),0) as total_kg,
              COALESCE(SUM(weight_kg),0)/1000.0 as total_mt,
              COALESCE(AVG(efficiency_pct),0) as avg_efficiency,
              COALESCE(AVG(gsm),0) as avg_gsm,
              COALESCE(AVG(moisture_pct),0) as avg_moisture,
              COALESCE(SUM(downtime_min),0) as total_downtime_min,
              COALESCE(SUM(steam_consumption),0) as total_steam,
              COALESCE(SUM(water_consumption),0) as total_water
       FROM reels r WHERE ${where}`, params),
    pool.query(
      `SELECT m.name as machine, m.code,
              COUNT(r.id) as reels, COALESCE(SUM(r.weight_kg),0) as total_kg,
              COALESCE(AVG(r.efficiency_pct),0) as avg_efficiency
       FROM reels r JOIN machines m ON m.id=r.machine_id WHERE ${where}
       GROUP BY m.id,m.name,m.code ORDER BY total_kg DESC`, params),
    pool.query(
      `SELECT g.name as grade, g.code,
              COUNT(r.id) as reels, COALESCE(SUM(r.weight_kg),0) as total_kg,
              COALESCE(AVG(r.gsm),0) as avg_gsm
       FROM reels r JOIN grades g ON g.id=r.grade_id WHERE ${where}
       GROUP BY g.id,g.name,g.code ORDER BY total_kg DESC`, params),
    pool.query(
      `SELECT r.reel_number as "reelNumber", r.start_time as "startTime",
              r.gsm, r.weight_kg as "weightKg", r.efficiency_pct as "efficiencyPct",
              r.moisture_pct as "moisturePct", r.status, r.quality_status as "qualityStatus",
              m.name as machine, g.name as grade
       FROM reels r
       JOIN machines m ON m.id=r.machine_id JOIN grades g ON g.id=r.grade_id
       WHERE ${where} ORDER BY r.start_time DESC LIMIT 500`, params),
  ]);
  if (fmt === 'csv') {
    const headers = ['Reel No', 'Start Time', 'Machine', 'Grade', 'GSM', 'Weight (kg)', 'Efficiency %', 'Moisture %', 'Status', 'Quality Status'];
    const rows = reels.rows.map(r => [r.reelNumber, r.startTime?.toISOString().slice(0, 16).replace('T', ' '), r.machine, r.grade, r.gsm, r.weightKg, r.efficiencyPct, r.moisturePct, r.status, r.qualityStatus]);
    return sendCSV(res, `production_${f}_${t}.csv`, headers, rows);
  }
  res.json({ success: true, data: { from: f, to: t, summary: summary.rows[0], byMachine: byMachine.rows, byGrade: byGrade.rows, reels: reels.rows } });
}));

// ── 6. INVENTORY REPORT ───────────────────────────────────────────────────────
router.get('/inventory', auth, requireLevel(2), ar(async (req, res) => {
  const { category_id, low_stock } = req.query;
  const conds = ['m.is_active=true']; const params = []; let p = 1;
  if (category_id) { conds.push(`m.category_id=$${p++}`); params.push(category_id); }
  if (low_stock === 'true') conds.push(`m.current_stock<=m.reorder_level`);
  const where = conds.join(' AND ');
  const { rows } = await pool.query(
    `SELECT m.code, m.name, mc.name as category, mc.type as "categoryType",
            m.uom, m.current_stock as "currentStock", m.reorder_level as "reorderLevel",
            m.min_stock as "minStock", m.max_stock as "maxStock", m.unit_price as "unitPrice",
            m.current_stock*m.unit_price as value,
            CASE WHEN m.current_stock<=m.reorder_level THEN true ELSE false END as "belowReorder"
     FROM materials m JOIN material_categories mc ON mc.id=m.category_id
     WHERE ${where} ORDER BY mc.name,m.name`, params);
  const totalValue = rows.reduce((s, r) => s + parseFloat(r.value || 0), 0);
  const alertCount = rows.filter(r => r.belowReorder).length;
  if (req.query.format === 'csv') {
    const headers = ['Code', 'Name', 'Category', 'Type', 'UOM', 'Current Stock', 'Reorder Level', 'Min Stock', 'Max Stock', 'Unit Price', 'Stock Value', 'Alert'];
    const csvRows = rows.map(r => [r.code, r.name, r.category, r.categoryType, r.uom, r.currentStock, r.reorderLevel, r.minStock, r.maxStock, r.unitPrice, r.value, r.belowReorder ? 'LOW STOCK' : 'OK']);
    return sendCSV(res, `inventory_${new Date().toISOString().slice(0, 10)}.csv`, headers, csvRows);
  }
  res.json({ success: true, data: { materials: rows, totalValue, alertCount } });
}));

// ── 7. QUALITY REPORT ─────────────────────────────────────────────────────────
router.get('/quality', auth, requireLevel(2), ar(async (req, res) => {
  const { from, to } = req.query;
  const f = from || new Date().toISOString().slice(0, 10);
  const t = to || new Date().toISOString().slice(0, 10);
  const [summary, byType, tests] = await Promise.all([
    pool.query(
      `SELECT COUNT(*) as total,
              SUM(CASE WHEN result='Pass' THEN 1 ELSE 0 END) as passed,
              SUM(CASE WHEN result='Fail' THEN 1 ELSE 0 END) as failed,
              SUM(CASE WHEN result='Hold' THEN 1 ELSE 0 END) as held,
              ROUND(100.0*SUM(CASE WHEN result='Pass' THEN 1 ELSE 0 END)/NULLIF(COUNT(*),0),2) as pass_rate
       FROM quality_tests WHERE DATE(test_date) BETWEEN $1 AND $2`, [f, t]),
    pool.query(
      `SELECT test_type, COUNT(*) as total,
              SUM(CASE WHEN result='Pass' THEN 1 ELSE 0 END) as passed,
              SUM(CASE WHEN result='Fail' THEN 1 ELSE 0 END) as failed
       FROM quality_tests WHERE DATE(test_date) BETWEEN $1 AND $2
       GROUP BY test_type ORDER BY total DESC`, [f, t]),
    pool.query(
      `SELECT qt.test_number as "testNumber", qt.test_type as "testType",
              qt.test_date as "testDate", qt.result,
              qt.gsm, qt.moisture_pct as "moisturePct", qt.burst_factor as "burstFactor",
              u.name as "testedBy"
       FROM quality_tests qt LEFT JOIN users u ON u.id=qt.tested_by
       WHERE DATE(qt.test_date) BETWEEN $1 AND $2 ORDER BY qt.test_date DESC LIMIT 500`, [f, t]),
  ]);
  if (req.query.format === 'csv') {
    const headers = ['Test No', 'Test Type', 'Test Date', 'Result', 'GSM', 'Moisture %', 'Burst Factor', 'Tested By'];
    const csvRows = tests.rows.map(r => [r.testNumber, r.testType, r.testDate?.toISOString().slice(0, 10), r.result, r.gsm, r.moisturePct, r.burstFactor, r.testedBy]);
    return sendCSV(res, `quality_${f}_${t}.csv`, headers, csvRows);
  }
  res.json({ success: true, data: { from: f, to: t, summary: summary.rows[0], byType: byType.rows, tests: tests.rows } });
}));

// ── 8. SALES REPORT ───────────────────────────────────────────────────────────
router.get('/sales', auth, requireLevel(2), ar(async (req, res) => {
  const { from, to } = req.query;
  const f = from || new Date().toISOString().slice(0, 10);
  const t = to || new Date().toISOString().slice(0, 10);
  const [summary, byCustomer, orders] = await Promise.all([
    pool.query(
      `SELECT COUNT(*) as total_orders,
              COALESCE(SUM(qty_mt),0) as total_qty_mt,
              COALESCE(SUM(fulfilled_mt),0) as total_fulfilled_mt,
              COALESCE(SUM(total_value),0) as total_value
       FROM sales_orders WHERE DATE(date) BETWEEN $1 AND $2`, [f, t]),
    pool.query(
      `SELECT c.name as customer,
              COUNT(so.id) as orders, COALESCE(SUM(so.qty_mt),0) as qty_mt,
              COALESCE(SUM(so.total_value),0) as value
       FROM sales_orders so JOIN customers c ON c.id=so.customer_id
       WHERE DATE(so.date) BETWEEN $1 AND $2
       GROUP BY c.id,c.name ORDER BY value DESC`, [f, t]),
    pool.query(
      `SELECT so.so_number as "soNumber", so.date, so.status,
              so.qty_mt as "qtyMt", so.fulfilled_mt as "fulfilledMt",
              so.rate_per_kg as "ratePerKg", so.total_value as "totalValue",
              c.name as customer, g.name as grade
       FROM sales_orders so
       LEFT JOIN customers c ON c.id=so.customer_id LEFT JOIN grades g ON g.id=so.grade_id
       WHERE DATE(so.date) BETWEEN $1 AND $2 ORDER BY so.date DESC LIMIT 500`, [f, t]),
  ]);
  if (req.query.format === 'csv') {
    const headers = ['SO No', 'Date', 'Customer', 'Grade', 'Qty (MT)', 'Fulfilled (MT)', 'Rate/kg', 'Total Value', 'Status'];
    const csvRows = orders.rows.map(r => [r.soNumber, r.date?.toISOString().slice(0, 10), r.customer, r.grade, r.qtyMt, r.fulfilledMt, r.ratePerKg, r.totalValue, r.status]);
    return sendCSV(res, `sales_${f}_${t}.csv`, headers, csvRows);
  }
  res.json({ success: true, data: { from: f, to: t, summary: summary.rows[0], byCustomer: byCustomer.rows, orders: orders.rows } });
}));

// ── 9. UTILITY REPORT ─────────────────────────────────────────────────────────
router.get('/utility', auth, requireLevel(2), ar(async (req, res) => {
  const { from, to } = req.query;
  const f = from || new Date().toISOString().slice(0, 10);
  const t = to || new Date().toISOString().slice(0, 10);
  const [summary, byDate] = await Promise.all([
    pool.query(
      `SELECT COALESCE(SUM(power_units+dg_units),0) as total_power,
              COALESCE(SUM(steam_generated_mt),0) as total_steam,
              COALESCE(SUM(coal_consumed_kg),0) as total_coal,
              COALESCE(SUM(fresh_water_kl),0) as total_water,
              COALESCE(AVG(boiler_pressure),0) as avg_pressure,
              COALESCE(AVG(boiler_temp),0) as avg_temp
       FROM utility_readings WHERE date BETWEEN $1 AND $2`, [f, t]),
    pool.query(
      `SELECT date, shift_type,
              COALESCE(SUM(power_units+dg_units),0) as power,
              COALESCE(SUM(steam_generated_mt),0) as steam,
              COALESCE(SUM(coal_consumed_kg),0) as coal,
              COALESCE(SUM(fresh_water_kl),0) as water
       FROM utility_readings WHERE date BETWEEN $1 AND $2
       GROUP BY date,shift_type ORDER BY date DESC,shift_type`, [f, t]),
  ]);
  if (req.query.format === 'csv') {
    const headers = ['Date', 'Shift', 'Power (units)', 'Steam (MT)', 'Coal (kg)', 'Fresh Water (KL)'];
    const csvRows = byDate.rows.map(r => [r.date?.toISOString().slice(0, 10), r.shift_type, r.power, r.steam, r.coal, r.water]);
    return sendCSV(res, `utility_${f}_${t}.csv`, headers, csvRows);
  }
  res.json({ success: true, data: { from: f, to: t, summary: summary.rows[0], byDate: byDate.rows } });
}));

// ── 10. MAINTENANCE REPORT ────────────────────────────────────────────────────
router.get('/maintenance', auth, requireLevel(2), ar(async (req, res) => {
  const { from, to } = req.query;
  const f = from || new Date().toISOString().slice(0, 10);
  const t = to || new Date().toISOString().slice(0, 10);
  const { rows } = await pool.query(
    `SELECT m.id as machine_id, m.name as machine, m.code,
            COUNT(d.id) as breakdown_count,
            COALESCE(SUM(d.duration_min),0) as total_downtime_min,
            CASE WHEN COUNT(d.id) > 0 THEN COALESCE(SUM(d.duration_min),0) / COUNT(d.id) ELSE 0 END as mttr_min,
            CASE WHEN COUNT(d.id) > 0 THEN (($2::date - $1::date) * 24 * 60 / COUNT(d.id)) ELSE 0 END as mtbf_min
     FROM machines m
     LEFT JOIN downtime_entries d ON m.id = d.machine_id AND d.start_time >= $1::date AND d.start_time <= $2::date + interval '1 day'
     GROUP BY m.id, m.name, m.code
     ORDER BY m.name`, [f, t]
  );
  if (req.query.format === 'csv') {
    const headers = ['Machine', 'Code', 'Breakdowns', 'Total Downtime (min)', 'MTTR (min)', 'MTBF (min)'];
    const csvRows = rows.map(r => [r.machine, r.code, r.breakdown_count, r.total_downtime_min, r.mttr_min, r.mtbf_min]);
    return sendCSV(res, `maintenance_${f}_${t}.csv`, headers, csvRows);
  }
  res.json({ success: true, data: { from: f, to: t, byMachine: rows } });
}));

// ── 11. HR REPORT ─────────────────────────────────────────────────────────────
router.get('/hr', auth, requireLevel(2), ar(async (req, res) => {
  const { from, to } = req.query;
  const f = from || new Date().toISOString().slice(0, 10);
  const t = to || new Date().toISOString().slice(0, 10);
  const { rows } = await pool.query(
    `SELECT d.id as department_id, d.name as department,
            COUNT(a.id) filter (where a.status = 'Present') as present_count,
            COUNT(a.id) filter (where a.status = 'Absent') as absent_count,
            COUNT(a.id) filter (where a.status = 'Leave') as leave_count,
            COUNT(a.id) filter (where a.status = 'Holiday') as holiday_count,
            COUNT(a.id) filter (where a.punch_in > '09:15:00'::time) as late_count
     FROM departments d
     LEFT JOIN employees e ON d.id = e.department_id
     LEFT JOIN attendance a ON e.id = a.employee_id AND a.date >= $1 AND a.date <= $2
     GROUP BY d.id, d.name
     ORDER BY d.name`, [f, t]
  );
  if (req.query.format === 'csv') {
    const headers = ['Department', 'Present', 'Absent', 'Leave', 'Holiday', 'Late'];
    const csvRows = rows.map(r => [r.department, r.present_count, r.absent_count, r.leave_count, r.holiday_count, r.late_count]);
    return sendCSV(res, `hr_${f}_${t}.csv`, headers, csvRows);
  }
  res.json({ success: true, data: { from: f, to: t, byDepartment: rows } });
}));

// ══════════════════════════════════════════════════════════════════════════
// GRANULAR DEPARTMENT-WISE REPORTS (HR / Maintenance / Purchase / Finance / EHS)
// ══════════════════════════════════════════════════════════════════════════

// ── 12. HR DEPT REPORT (granular) ────────────────────────────────────────────
// Sliceable by department_id, date range, employee_id. Drill-down: dept summary -> employee rows.
router.get('/hr-detailed', auth, requireLevel(2), ar(async (req, res) => {
  const { from, to, department_id, employee_id } = req.query;
  const f = from || new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().slice(0, 10);
  const t = to || new Date().toISOString().slice(0, 10);

  const empConds = ['e.is_active = true'];
  const empParams = [];
  let ep = 1;
  if (department_id) { empConds.push(`e.department_id = $${ep++}`); empParams.push(department_id); }
  if (employee_id) { empConds.push(`e.id = $${ep++}`); empParams.push(employee_id); }
  const empWhere = empConds.join(' AND ');

  const [byDept, headcountTrend, employeeRows, payrollTrend, leaveUtil] = await Promise.all([
    // Department summary: attendance %, leave util, payroll cost, headcount
    pool.query(`
      SELECT d.id AS "departmentId", d.name AS department,
             COUNT(DISTINCT e.id) FILTER (WHERE e.is_active = true) AS headcount,
             COUNT(a.id) FILTER (WHERE a.status = 'Present') AS present_days,
             COUNT(a.id) FILTER (WHERE a.status = 'Absent') AS absent_days,
             COUNT(a.id) FILTER (WHERE a.status = 'Leave') AS leave_days,
             COUNT(a.id) AS total_marked_days,
             ROUND(100.0 * COUNT(a.id) FILTER (WHERE a.status = 'Present') / NULLIF(COUNT(a.id), 0), 1) AS attendance_pct,
             COALESCE(SUM(e.basic_salary) FILTER (WHERE e.is_active = true), 0) AS monthly_payroll_cost
      FROM departments d
      LEFT JOIN employees e ON e.department_id = d.id ${department_id ? 'AND e.department_id = $3' : ''}
      LEFT JOIN attendance a ON a.employee_id = e.id AND a.date BETWEEN $1 AND $2
      GROUP BY d.id, d.name
      ORDER BY d.name
    `, department_id ? [f, t, department_id] : [f, t]),

    // Headcount trend by month (joins DOJ vs current employees)
    pool.query(`
      SELECT TO_CHAR(gs, 'YYYY-MM') AS month,
             COUNT(e.id) FILTER (WHERE e.doj <= (gs + INTERVAL '1 month' - INTERVAL '1 day')::date) AS headcount
      FROM generate_series($1::date - INTERVAL '5 months', $1::date, INTERVAL '1 month') gs
      LEFT JOIN employees e ON e.is_active = true ${department_id ? 'AND e.department_id = $2' : ''}
      GROUP BY gs ORDER BY gs
    `, department_id ? [t, department_id] : [t]),

    // Drill-down: employee-level attendance & leave rows
    pool.query(`
      SELECT e.id, e.employee_code AS "employeeCode", e.name, e.designation,
             d.name AS department,
             COUNT(a.id) FILTER (WHERE a.status = 'Present') AS present,
             COUNT(a.id) FILTER (WHERE a.status = 'Absent') AS absent,
             COUNT(a.id) FILTER (WHERE a.status = 'Leave') AS leave,
             COUNT(a.id) FILTER (WHERE a.status = 'Half Day') AS half_day,
             ROUND(100.0 * COUNT(a.id) FILTER (WHERE a.status = 'Present') / NULLIF(COUNT(a.id), 0), 1) AS "attendancePct",
             e.basic_salary AS "basicSalary"
      FROM employees e
      LEFT JOIN departments d ON d.id = e.department_id
      LEFT JOIN attendance a ON a.employee_id = e.id AND a.date BETWEEN $1 AND $2
      WHERE ${empWhere}
      GROUP BY e.id, e.employee_code, e.name, e.designation, d.name
      ORDER BY d.name, e.name
      LIMIT 1000
    `, [f, t, ...empParams]),

    // Payroll cost trend (last 6 payroll runs)
    pool.query(`
      SELECT TO_CHAR(pr.month, 'YYYY-MM') AS month, pr.status,
             pr.total_employees AS "totalEmployees",
             pr.total_gross AS "totalGross", pr.total_deductions AS "totalDeductions",
             pr.total_net AS "totalNet"
      FROM payroll_runs pr
      WHERE pr.month BETWEEN ($1::date - INTERVAL '6 months') AND $2::date
      ORDER BY pr.month
    `, [f, t]),

    // Leave utilization by leave type
    pool.query(`
      SELECT lt.name AS "leaveType", COUNT(la.id) AS applications,
             COALESCE(SUM(la.days), 0) AS "totalDays",
             COUNT(la.id) FILTER (WHERE la.status = 'Approved') AS approved,
             COUNT(la.id) FILTER (WHERE la.status = 'Pending') AS pending,
             COUNT(la.id) FILTER (WHERE la.status = 'Rejected') AS rejected
      FROM leave_applications la
      JOIN employee_leave_types lt ON lt.id = la.leave_type_id
      JOIN employees e ON e.id = la.employee_id
      WHERE la.from_date BETWEEN $1 AND $2 ${department_id ? 'AND e.department_id = $3' : ''}
      GROUP BY lt.name ORDER BY "totalDays" DESC
    `, department_id ? [f, t, department_id] : [f, t])
  ]);

  if (req.query.format === 'csv') {
    const headers = ['Emp Code', 'Name', 'Designation', 'Department', 'Present', 'Absent', 'Leave', 'Half Day', 'Attendance %', 'Basic Salary'];
    const rows = employeeRows.rows.map(r => [r.employeeCode, r.name, r.designation, r.department, r.present, r.absent, r.leave, r.half_day, r.attendancePct, r.basicSalary]);
    return sendCSV(res, `hr_detailed_${f}_${t}.csv`, headers, rows);
  }

  res.json({
    success: true,
    data: { from: f, to: t, byDepartment: byDept.rows, headcountTrend: headcountTrend.rows, employees: employeeRows.rows, payrollTrend: payrollTrend.rows, leaveUtilization: leaveUtil.rows }
  });
}));

// ── 13. MAINTENANCE DEPT REPORT (granular) ───────────────────────────────────
// PM completion, MTTR/MTBF, breakdown frequency by machine/section, spares consumption, cost per section.
router.get('/maintenance-detailed', auth, requireLevel(2), ar(async (req, res) => {
  const { from, to, machine_id, section_id } = req.query;
  const f = from || new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().slice(0, 10);
  const t = to || new Date().toISOString().slice(0, 10);

  const dtConds = [`d.start_time >= $1::date AND d.start_time <= $2::date + interval '1 day'`];
  const dtParams = [f, t]; let dp = 3;
  if (machine_id) { dtConds.push(`d.machine_id = $${dp++}`); dtParams.push(machine_id); }
  const dtWhere = dtConds.join(' AND ');

  const meConds = [`me.event_time >= $1::date AND me.event_time <= $2::date + interval '1 day'`];
  const meParams = [f, t]; let mp = 3;
  if (section_id) { meConds.push(`me.section_id = $${mp++}`); meParams.push(section_id); }
  const meWhere = meConds.join(' AND ');

  const [pmCompletion, mttrMtbf, breakdownFreq, sparesConsumption, costPerSection, breakdownRows, logRows] = await Promise.all([
    // PM completion rate
    pool.query(`
      SELECT COUNT(*) AS total_scheduled,
             COUNT(*) FILTER (WHERE status = 'Done') AS completed,
             COUNT(*) FILTER (WHERE status = 'Overdue') AS overdue,
             ROUND(100.0 * COUNT(*) FILTER (WHERE status = 'Done') / NULLIF(COUNT(*) FILTER (WHERE status != 'Cancelled'), 0), 1) AS completion_pct
      FROM maintenance_schedule ms
      WHERE ms.next_due BETWEEN $1 AND $2 ${machine_id ? 'AND ms.machine_id = $3' : ''}
    `, machine_id ? [f, t, machine_id] : [f, t]),

    // MTTR / MTBF by machine
    pool.query(`
      SELECT m.id AS "machineId", m.name AS machine, m.code,
             COUNT(d.id) AS breakdown_count,
             COALESCE(SUM(d.duration_min), 0) AS total_downtime_min,
             CASE WHEN COUNT(d.id) > 0 THEN ROUND(COALESCE(SUM(d.duration_min), 0)::numeric / COUNT(d.id), 1) ELSE 0 END AS mttr_min,
             CASE WHEN COUNT(d.id) > 0 THEN ROUND((($2::date - $1::date) * 24 * 60 / COUNT(d.id))::numeric, 1) ELSE 0 END AS mtbf_min
      FROM machines m
      LEFT JOIN downtime_entries d ON m.id = d.machine_id AND d.start_time >= $1::date AND d.start_time <= $2::date + interval '1 day'
      ${machine_id ? 'WHERE m.id = $3' : ''}
      GROUP BY m.id, m.name, m.code ORDER BY breakdown_count DESC
    `, machine_id ? [f, t, machine_id] : [f, t]),

    // Breakdown frequency by machine/section (via machine_events)
    pool.query(`
      SELECT ps.id AS "sectionId", ps.name AS section,
             COUNT(me.id) AS event_count,
             COUNT(me.id) FILTER (WHERE me.severity = 'Critical') AS critical_count,
             COALESCE(SUM(me.duration_min), 0) AS total_duration_min
      FROM plant_sections ps
      LEFT JOIN machine_events me ON me.section_id = ps.id AND ${meWhere.replace(/\$1/g, '$1').replace(/\$2/g, '$2')}
      GROUP BY ps.id, ps.name ORDER BY event_count DESC
    `, meParams),

    // Spares consumption tied into maintenance jobs (spare_parts_used jsonb array of {name, qty, cost})
    pool.query(`
      SELECT ml.id AS "logId", ml.date, m.name AS machine,
             spare->>'name' AS "spareName",
             (spare->>'qty')::numeric AS qty,
             (spare->>'cost')::numeric AS cost
      FROM maintenance_logs ml
      JOIN machines m ON m.id = ml.machine_id
      CROSS JOIN LATERAL jsonb_array_elements(COALESCE(ml.spare_parts_used, '[]'::jsonb)) AS spare
      WHERE ml.date BETWEEN $1 AND $2 ${machine_id ? 'AND ml.machine_id = $3' : ''}
      ORDER BY ml.date DESC LIMIT 500
    `, machine_id ? [f, t, machine_id] : [f, t]),

    // Cost per section (maintenance_logs cost, joined via machine -> section_equipment -> plant_sections)
    pool.query(`
      SELECT ps.id AS "sectionId", ps.name AS section,
             COUNT(ml.id) AS jobs,
             COALESCE(SUM(ml.cost), 0) AS "totalCost",
             COALESCE(SUM(ml.duration_hours), 0) AS "totalHours"
      FROM plant_sections ps
      LEFT JOIN section_equipment se ON se.section_id = ps.id
      LEFT JOIN maintenance_logs ml ON ml.machine_id = se.machine_id AND ml.date BETWEEN $1 AND $2
      GROUP BY ps.id, ps.name
      HAVING COUNT(ml.id) > 0
      ORDER BY "totalCost" DESC
    `, [f, t]),

    // Drill-down: downtime entries (transaction level)
    pool.query(`
      SELECT d.id, d.start_time AS "startTime", d.end_time AS "endTime",
             d.duration_min AS "durationMin", d.category AS "reasonCategory",
             d.reason, m.name AS machine, m.code AS "machineCode"
      FROM downtime_entries d JOIN machines m ON m.id = d.machine_id
      WHERE ${dtWhere} ORDER BY d.start_time DESC LIMIT 500
    `, dtParams),

    // Drill-down: maintenance job logs
    pool.query(`
      SELECT ml.id, ml.date, ml.maintenance_type AS "maintenanceType", ml.description,
             ml.work_done AS "workDone", ml.duration_hours AS "durationHours",
             ml.cost, ml.status, m.name AS machine, u.name AS "performedBy"
      FROM maintenance_logs ml
      JOIN machines m ON m.id = ml.machine_id
      LEFT JOIN users u ON u.id = ml.performed_by
      WHERE ml.date BETWEEN $1 AND $2 ${machine_id ? 'AND ml.machine_id = $3' : ''}
      ORDER BY ml.date DESC LIMIT 500
    `, machine_id ? [f, t, machine_id] : [f, t])
  ]);

  if (req.query.format === 'csv') {
    const headers = ['Machine', 'Breakdowns', 'Total Downtime (min)', 'MTTR (min)', 'MTBF (min)'];
    const rows = mttrMtbf.rows.map(r => [r.machine, r.breakdown_count, r.total_downtime_min, r.mttr_min, r.mtbf_min]);
    return sendCSV(res, `maintenance_detailed_${f}_${t}.csv`, headers, rows);
  }

  res.json({
    success: true,
    data: {
      from: f, to: t,
      pmCompletion: pmCompletion.rows[0],
      mttrMtbfByMachine: mttrMtbf.rows,
      breakdownFrequencyBySection: breakdownFreq.rows,
      sparesConsumption: sparesConsumption.rows,
      costPerSection: costPerSection.rows,
      downtimeEntries: breakdownRows.rows,
      maintenanceLogs: logRows.rows
    }
  });
}));

// ── 14. PURCHASE DEPT REPORT (granular) ──────────────────────────────────────
// PO cycle time, vendor performance, pending PO aging, spend by category.
router.get('/purchase-detailed', auth, requireLevel(2), ar(async (req, res) => {
  const { from, to, vendor_id, category_id } = req.query;
  const f = from || new Date(new Date().setDate(new Date().getDate() - 90)).toISOString().slice(0, 10);
  const t = to || new Date().toISOString().slice(0, 10);

  const poConds = [`po.date BETWEEN $1 AND $2`];
  const poParams = [f, t]; let pp = 3;
  if (vendor_id) { poConds.push(`po.vendor_id = $${pp++}`); poParams.push(vendor_id); }
  const poWhere = poConds.join(' AND ');

  const [cycleTime, vendorPerf, agingBuckets, spendByCategory, poRows] = await Promise.all([
    // PO cycle time: raise (indent date) -> approve (PO created) -> GRN (first GRN date)
    pool.query(`
      SELECT po.id AS "poId", po.po_number AS "poNumber",
             i.date AS "indentDate", po.date AS "poDate",
             MIN(g.date) AS "firstGrnDate",
             (po.date - i.date) AS "raiseToApproveDays",
             (MIN(g.date) - po.date) AS "approveToGrnDays",
             (MIN(g.date) - i.date) AS "totalCycleDays"
      FROM purchase_orders po
      LEFT JOIN indents i ON i.id = po.indent_id
      LEFT JOIN grn g ON g.po_id = po.id
      WHERE ${poWhere}
      GROUP BY po.id, po.po_number, i.date, po.date
      ORDER BY po.date DESC LIMIT 500
    `, poParams),

    // Vendor performance: on-time %, price variance
    pool.query(`
      SELECT v.id AS "vendorId", v.name AS vendor, v.rating,
             COUNT(DISTINCT po.id) AS "totalPos",
             COUNT(DISTINCT g.id) AS "totalGrns",
             COUNT(DISTINCT po.id) FILTER (WHERE g.date <= po.delivery_date) AS "onTimeCount",
             ROUND(100.0 * COUNT(DISTINCT po.id) FILTER (WHERE g.date <= po.delivery_date) / NULLIF(COUNT(DISTINCT po.id) FILTER (WHERE g.id IS NOT NULL), 0), 1) AS "onTimePct",
             COALESCE(SUM(po.grand_total), 0) AS "totalSpend"
      FROM vendors v
      LEFT JOIN purchase_orders po ON po.vendor_id = v.id AND po.date BETWEEN $1 AND $2
      LEFT JOIN grn g ON g.po_id = po.id
      ${vendor_id ? 'WHERE v.id = $3' : ''}
      GROUP BY v.id, v.name, v.rating
      HAVING COUNT(DISTINCT po.id) > 0
      ORDER BY "totalSpend" DESC
    `, vendor_id ? [f, t, vendor_id] : [f, t]),

    // Pending PO value aging buckets (based on days since PO date, for non-closed POs)
    pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE (CURRENT_DATE - po.date) <= 15) AS bucket_0_15_count,
        COALESCE(SUM(po.grand_total) FILTER (WHERE (CURRENT_DATE - po.date) <= 15), 0) AS bucket_0_15_value,
        COUNT(*) FILTER (WHERE (CURRENT_DATE - po.date) BETWEEN 16 AND 30) AS bucket_16_30_count,
        COALESCE(SUM(po.grand_total) FILTER (WHERE (CURRENT_DATE - po.date) BETWEEN 16 AND 30), 0) AS bucket_16_30_value,
        COUNT(*) FILTER (WHERE (CURRENT_DATE - po.date) BETWEEN 31 AND 60) AS bucket_31_60_count,
        COALESCE(SUM(po.grand_total) FILTER (WHERE (CURRENT_DATE - po.date) BETWEEN 31 AND 60), 0) AS bucket_31_60_value,
        COUNT(*) FILTER (WHERE (CURRENT_DATE - po.date) > 60) AS bucket_60_plus_count,
        COALESCE(SUM(po.grand_total) FILTER (WHERE (CURRENT_DATE - po.date) > 60), 0) AS bucket_60_plus_value
      FROM purchase_orders po
      WHERE po.status NOT IN ('Closed', 'Cancelled', 'Received')
    `),

    // Spend by category
    pool.query(`
      SELECT mc.name AS category, COUNT(DISTINCT poi.po_id) AS "poCount",
             COALESCE(SUM(poi.total), 0) AS "totalSpend"
      FROM po_items poi
      JOIN purchase_orders po ON po.id = poi.po_id
      JOIN materials mat ON mat.id = poi.material_id
      JOIN material_categories mc ON mc.id = mat.category_id
      WHERE po.date BETWEEN $1 AND $2 ${category_id ? 'AND mc.id = $3' : ''}
      GROUP BY mc.name ORDER BY "totalSpend" DESC
    `, category_id ? [f, t, category_id] : [f, t]),

    // Drill-down: PO transaction rows
    pool.query(`
      SELECT po.id, po.po_number AS "poNumber", po.date, po.status,
             po.grand_total AS "grandTotal", po.delivery_date AS "deliveryDate",
             v.name AS vendor
      FROM purchase_orders po LEFT JOIN vendors v ON v.id = po.vendor_id
      WHERE ${poWhere}
      ORDER BY po.date DESC LIMIT 500
    `, poParams)
  ]);

  if (req.query.format === 'csv') {
    const headers = ['PO No', 'Date', 'Vendor', 'Status', 'Grand Total'];
    const rows = poRows.rows.map(r => [r.poNumber, r.date?.toISOString().slice(0, 10), r.vendor, r.status, r.grandTotal]);
    return sendCSV(res, `purchase_detailed_${f}_${t}.csv`, headers, rows);
  }

  res.json({
    success: true,
    data: {
      from: f, to: t,
      cycleTime: cycleTime.rows,
      vendorPerformance: vendorPerf.rows,
      pendingAging: agingBuckets.rows[0],
      spendByCategory: spendByCategory.rows,
      purchaseOrders: poRows.rows
    }
  });
}));

// ── 15. FINANCE REPORT (granular) ────────────────────────────────────────────
// Payment aging, pending vs confirmed, dept-wise spend rollup, monthly cash outflow trend.
router.get('/finance-detailed', auth, requireLevel(2), ar(async (req, res) => {
  const { from, to, department_id } = req.query;
  const f = from || new Date(new Date().setDate(new Date().getDate() - 90)).toISOString().slice(0, 10);
  const t = to || new Date().toISOString().slice(0, 10);

  const [paymentAging, pendingVsConfirmed, deptSpend, outflowTrend, paymentRows] = await Promise.all([
    // Payment aging buckets (receivables)
    pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE status='Pending' AND (CURRENT_DATE - payment_date) <= 15) AS bucket_0_15_count,
        COALESCE(SUM(amount) FILTER (WHERE status='Pending' AND (CURRENT_DATE - payment_date) <= 15), 0) AS bucket_0_15_value,
        COUNT(*) FILTER (WHERE status='Pending' AND (CURRENT_DATE - payment_date) BETWEEN 16 AND 30) AS bucket_16_30_count,
        COALESCE(SUM(amount) FILTER (WHERE status='Pending' AND (CURRENT_DATE - payment_date) BETWEEN 16 AND 30), 0) AS bucket_16_30_value,
        COUNT(*) FILTER (WHERE status='Pending' AND (CURRENT_DATE - payment_date) BETWEEN 31 AND 60) AS bucket_31_60_count,
        COALESCE(SUM(amount) FILTER (WHERE status='Pending' AND (CURRENT_DATE - payment_date) BETWEEN 31 AND 60), 0) AS bucket_31_60_value,
        COUNT(*) FILTER (WHERE status='Pending' AND (CURRENT_DATE - payment_date) > 60) AS bucket_60_plus_count,
        COALESCE(SUM(amount) FILTER (WHERE status='Pending' AND (CURRENT_DATE - payment_date) > 60), 0) AS bucket_60_plus_value
      FROM payments WHERE payment_date BETWEEN $1 AND $2
    `, [f, t]),

    // Pending vs confirmed payments
    pool.query(`
      SELECT status, COUNT(*) AS count, COALESCE(SUM(amount), 0) AS "totalAmount"
      FROM payments WHERE payment_date BETWEEN $1 AND $2
      GROUP BY status
    `, [f, t]),

    // Department-wise spend rollup (via indents -> POs)
    pool.query(`
      SELECT d.id AS "departmentId", d.name AS department,
             COUNT(DISTINCT po.id) AS "poCount",
             COALESCE(SUM(po.grand_total), 0) AS "totalSpend"
      FROM departments d
      LEFT JOIN indents i ON i.department_id = d.id
      LEFT JOIN purchase_orders po ON po.indent_id = i.id AND po.date BETWEEN $1 AND $2
      ${department_id ? 'WHERE d.id = $3' : ''}
      GROUP BY d.id, d.name
      ORDER BY "totalSpend" DESC
    `, department_id ? [f, t, department_id] : [f, t]),

    // Monthly cash outflow trend (PO grand_total, proxy for procurement outflow)
    pool.query(`
      SELECT TO_CHAR(po.date, 'YYYY-MM') AS month,
             COALESCE(SUM(po.grand_total), 0) AS "outflow",
             COUNT(*) AS "poCount"
      FROM purchase_orders po
      WHERE po.date BETWEEN ($1::date - INTERVAL '6 months') AND $2::date
        AND po.status NOT IN ('Cancelled', 'Draft')
      GROUP BY TO_CHAR(po.date, 'YYYY-MM') ORDER BY month
    `, [f, t]),

    // Drill-down: payment transaction rows
    pool.query(`
      SELECT p.id, p.payment_number AS "paymentNumber", p.payment_date AS "paymentDate",
             p.amount, p.payment_mode AS "paymentMode", p.status,
             p.reference_number AS "referenceNumber", so.so_number AS "soNumber", c.name AS customer
      FROM payments p
      LEFT JOIN sales_orders so ON so.id = p.sales_order_id
      LEFT JOIN customers c ON c.id = so.customer_id
      WHERE p.payment_date BETWEEN $1 AND $2
      ORDER BY p.payment_date DESC LIMIT 500
    `, [f, t])
  ]);

  if (req.query.format === 'csv') {
    const headers = ['Payment No', 'Date', 'Customer', 'Amount', 'Mode', 'Status'];
    const rows = paymentRows.rows.map(r => [r.paymentNumber, r.paymentDate?.toISOString().slice(0, 10), r.customer, r.amount, r.paymentMode, r.status]);
    return sendCSV(res, `finance_detailed_${f}_${t}.csv`, headers, rows);
  }

  res.json({
    success: true,
    data: {
      from: f, to: t,
      paymentAging: paymentAging.rows[0],
      pendingVsConfirmed: pendingVsConfirmed.rows,
      departmentSpend: deptSpend.rows,
      monthlyOutflowTrend: outflowTrend.rows,
      payments: paymentRows.rows
    }
  });
}));

// ── 16. PRODUCTION / EHS REPORT (granular) ───────────────────────────────────
// Near-miss trend, incident rate, specific power consumption trend.
router.get('/ehs-detailed', auth, requireLevel(2), ar(async (req, res) => {
  const { from, to, department_id } = req.query;
  const f = from || new Date(new Date().setDate(new Date().getDate() - 90)).toISOString().slice(0, 10);
  const t = to || new Date().toISOString().slice(0, 10);

  const incConds = [`ei.date BETWEEN $1 AND $2`];
  const incParams = [f, t]; let ip = 3;
  if (department_id) { incConds.push(`ei.department_id = $${ip++}`); incParams.push(department_id); }
  const incWhere = incConds.join(' AND ');

  const [nearMissTrend, incidentRate, specificPowerTrend, byDept, incidentRows] = await Promise.all([
    // Near-miss trend by month
    pool.query(`
      SELECT TO_CHAR(ei.date, 'YYYY-MM') AS month,
             COUNT(*) FILTER (WHERE ei.incident_type = 'Near Miss') AS "nearMisses",
             COUNT(*) AS "totalIncidents"
      FROM ehs_incidents ei
      WHERE ${incWhere}
      GROUP BY TO_CHAR(ei.date, 'YYYY-MM') ORDER BY month
    `, incParams),

    // Incident rate (per month, by severity)
    pool.query(`
      SELECT COUNT(*) AS "totalIncidents",
             COUNT(*) FILTER (WHERE severity IN ('High', 'Critical')) AS "highSeverity",
             COUNT(*) FILTER (WHERE status = 'Open') AS "openCount",
             COUNT(*) FILTER (WHERE status = 'Closed') AS "closedCount",
             ROUND((COUNT(*)::numeric / GREATEST(1, (($2::date - $1::date) / 30.0))), 2) AS "monthlyIncidentRate"
      FROM ehs_incidents ei WHERE ${incWhere}
    `, incParams),

    // Specific power consumption trend (units per MT produced), by day
    pool.query(`
      SELECT ur.date,
             COALESCE(SUM(ur.power_units + ur.dg_units), 0) AS "powerUnits",
             COALESCE((SELECT SUM(weight_kg) / 1000.0 FROM reels WHERE DATE(start_time) = ur.date), 0) AS "producedMt",
             CASE WHEN (SELECT SUM(weight_kg) FROM reels WHERE DATE(start_time) = ur.date) > 0
                  THEN ROUND((COALESCE(SUM(ur.power_units + ur.dg_units), 0) / ((SELECT SUM(weight_kg) FROM reels WHERE DATE(start_time) = ur.date) / 1000.0))::numeric, 2)
                  ELSE 0 END AS "specificPowerPerMt"
      FROM utility_readings ur
      WHERE ur.date BETWEEN $1 AND $2
      GROUP BY ur.date ORDER BY ur.date
    `, [f, t]),

    // By department
    pool.query(`
      SELECT d.id AS "departmentId", d.name AS department,
             COUNT(ei.id) AS "totalIncidents",
             COUNT(ei.id) FILTER (WHERE ei.incident_type = 'Near Miss') AS "nearMisses",
             COUNT(ei.id) FILTER (WHERE ei.status = 'Open') AS "openCount"
      FROM departments d
      LEFT JOIN ehs_incidents ei ON ei.department_id = d.id AND ei.date BETWEEN $1 AND $2
      GROUP BY d.id, d.name
      HAVING COUNT(ei.id) > 0
      ORDER BY "totalIncidents" DESC
    `, [f, t]),

    // Drill-down: incident transaction rows
    pool.query(`
      SELECT ei.id, ei.incident_number AS "incidentNumber", ei.date, ei.incident_type AS "incidentType",
             ei.severity, ei.location, ei.status, ei.description,
             d.name AS department, u.name AS "reportedBy"
      FROM ehs_incidents ei
      LEFT JOIN departments d ON d.id = ei.department_id
      LEFT JOIN users u ON u.id = ei.reported_by
      WHERE ${incWhere}
      ORDER BY ei.date DESC LIMIT 500
    `, incParams)
  ]);

  if (req.query.format === 'csv') {
    const headers = ['Incident No', 'Date', 'Type', 'Severity', 'Department', 'Status', 'Location'];
    const rows = incidentRows.rows.map(r => [r.incidentNumber, r.date?.toISOString().slice(0, 10), r.incidentType, r.severity, r.department, r.status, r.location]);
    return sendCSV(res, `ehs_detailed_${f}_${t}.csv`, headers, rows);
  }

  res.json({
    success: true,
    data: {
      from: f, to: t,
      nearMissTrend: nearMissTrend.rows,
      incidentRate: incidentRate.rows[0],
      specificPowerTrend: specificPowerTrend.rows,
      byDepartment: byDept.rows,
      incidents: incidentRows.rows
    }
  });
}));

// ── P2P PIPELINE & AUDIT REPORT ──────────────────────────────────────────────
router.get('/p2p-pipeline', auth, ar(async (req, res) => {
  const { from: f = '2026-01-01', to: t = new Date().toISOString().slice(0, 10), format } = req.query;
  const { rows } = await pool.query(`
    SELECT
      po.id as "poId",
      po.po_number as "poNumber",
      po.date as "poDate",
      po.status as "poStatus",
      po.grand_total as "poGrandTotal",
      v.name as "vendorName",
      v.code as "vendorCode",
      -- Indent
      ind.indent_number as "indentNumber",
      ind.date as "indentDate",
      ind.total_value as "indentTotalValue",
      dept.name as "deptName",
      -- GRN
      g.grn_number as "grnNumber",
      g.date as "grnDate",
      g.invoice_number as "grnInvoiceNumber",
      g.challan_number as "grnChallanNumber",
      -- Purchase Bill
      vb.bill_number as "billNumber",
      vb.vendor_invoice_number as "vendorInvoiceNumber",
      vb.invoice_date as "billInvoiceDate",
      vb.total_amount as "billTotalAmount",
      vb.paid_amount as "billPaidAmount",
      vb.balance_amount as "billBalanceAmount",
      vb.status as "billStatus",
      -- Payment
      vp.payment_number as "paymentNumber",
      vp.amount as "paymentAmount",
      vp.payment_date as "paymentDate",
      vp.payment_mode as "paymentMode",
      vp.reference_number as "paymentRefNumber"
    FROM purchase_orders po
    LEFT JOIN vendors v ON v.id = po.vendor_id
    LEFT JOIN indents ind ON ind.id = po.indent_id
    LEFT JOIN departments dept ON dept.id = ind.department_id
    LEFT JOIN grn g ON g.po_id = po.id
    LEFT JOIN vendor_bills vb ON vb.po_id = po.id OR vb.grn_id = g.id
    LEFT JOIN vendor_payments vp ON vp.bill_id = vb.id OR vp.po_id = po.id
    WHERE po.date BETWEEN $1 AND $2
    ORDER BY po.created_at DESC
  `, [f, t]);

  if (format === 'csv') {
    const headers = [
      'Indent No', 'Dept', 'PO No', 'PO Date', 'Vendor', 'PO Value',
      'GRN No', 'GRN Date', 'Supplier Inv', 'Bill No', 'Bill Amount',
      'Bill Status', 'Payment No', 'Paid Amount', 'Payment Mode', 'UTR / Ref'
    ];
    const csvRows = rows.map(r => [
      r.indentNumber || '—', r.deptName || '—', r.poNumber, r.poDate ? r.poDate.toISOString().slice(0, 10) : '',
      r.vendorName, r.poGrandTotal, r.grnNumber || '—', r.grnDate ? r.grnDate.toISOString().slice(0, 10) : '',
      r.grnInvoiceNumber || r.vendorInvoiceNumber || '—', r.billNumber || '—', r.billTotalAmount || '0',
      r.billStatus || 'Pending', r.paymentNumber || '—', r.paymentAmount || '0', r.paymentMode || '—', r.paymentRefNumber || '—'
    ]);
    return sendCSV(res, `p2p_pipeline_${f}_${t}.csv`, headers, csvRows);
  }

  res.json({ success: true, data: rows });
}));

// ── 15. PLANT SECTION & GRANULAR LEVEL REPORTING (AGENT 4) ────────────────────
router.get('/plant-sections/detailed', auth, requireLevel(2), ar(async (req, res) => {
  const { section_id, machine_id, category_id, from, to, search, format } = req.query;
  const f = from || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const t = to || new Date().toISOString().slice(0, 10);

  const matConds = [`m.is_active = true`];
  const matParams = [];
  let p = 1;

  if (section_id && /^\d+$/.test(String(section_id))) {
    matConds.push(`m.section_id = $${p}`);
    matParams.push(parseInt(section_id));
    p++;
  }
  if (machine_id && /^\d+$/.test(String(machine_id))) {
    matConds.push(`m.machine_id = $${p}`);
    matParams.push(parseInt(machine_id));
    p++;
  }
  if (category_id && /^\d+$/.test(String(category_id))) {
    matConds.push(`m.category_id = $${p}`);
    matParams.push(parseInt(category_id));
    p++;
  }
  if (search && search.trim()) {
    matConds.push(`(m.name ILIKE $${p} OR m.code ILIKE $${p} OR m.bin_location ILIKE $${p})`);
    matParams.push(`%${search.trim()}%`);
    p++;
  }

  const matWhere = matConds.length ? `WHERE ${matConds.join(' AND ')}` : '';

  // 1. Section Level Aggregates (Valuation, Items, Equipment count, Consumption in date range)
  const { rows: sectionRollups } = await pool.query(`
    SELECT 
      ps.id AS "sectionId",
      ps.section_code AS "sectionCode",
      ps.name AS "sectionName",
      COALESCE(ps.icon, '🏭') AS "sectionIcon",
      d.name AS "departmentName",
      COUNT(DISTINCT m.id)::int AS "materialCount",
      COALESCE(SUM(m.current_stock * m.unit_price), 0)::numeric(15,2) AS "totalValuation",
      COUNT(DISTINCT se.id)::int AS "equipmentCount",
      COALESCE(SUM(moves.consumed_qty), 0)::numeric(12,3) AS "periodConsumedQty",
      COALESCE(SUM(moves.consumed_val), 0)::numeric(15,2) AS "periodConsumedVal",
      COALESCE(SUM(moves.inward_qty), 0)::numeric(12,3) AS "periodInwardQty",
      COALESCE(SUM(moves.inward_val), 0)::numeric(15,2) AS "periodInwardVal"
    FROM plant_sections ps
    LEFT JOIN departments d ON ps.department_id = d.id
    LEFT JOIN section_equipment se ON se.section_id = ps.id AND se.is_active = true
    LEFT JOIN material_sections ms ON ms.section_id = ps.id
    LEFT JOIN materials m ON (m.section_id = ps.id OR ms.material_id = m.id) AND m.is_active = true
    LEFT JOIN LATERAL (
      SELECT 
        COALESCE(SUM(sl.out_qty), 0) AS consumed_qty,
        COALESCE(SUM(sl.value) FILTER (WHERE sl.out_qty > 0), 0) AS consumed_val,
        COALESCE(SUM(sl.in_qty), 0) AS inward_qty,
        COALESCE(SUM(sl.value) FILTER (WHERE sl.in_qty > 0), 0) AS inward_val
      FROM stock_ledger sl
      WHERE sl.material_id = m.id AND sl.date BETWEEN '${f}' AND '${t}'
    ) moves ON true
    GROUP BY ps.id, ps.section_code, ps.name, ps.icon, d.name, ps.sort_order
    ORDER BY ps.sort_order ASC, "totalValuation" DESC
  `);

  // 2. Granular Equipment & Material Level Breakdown
  const { rows: granularItems } = await pool.query(`
    SELECT * FROM (
      SELECT DISTINCT
        m.id AS "materialId",
        m.code AS "materialCode",
        m.name AS "materialName",
        m.uom,
        m.hsn_code AS "hsnCode",
        m.current_stock::numeric(12,3) AS "currentStock",
        m.min_stock::numeric(12,3) AS "minStock",
        m.reorder_level::numeric(12,3) AS "reorderLevel",
        m.unit_price::numeric(12,2) AS "unitPrice",
        (m.current_stock * m.unit_price)::numeric(15,2) AS "stockValuation",
        m.bin_location AS "binLocation",
        mc.name AS "categoryName",
        ps.id AS "sectionId",
        ps.name AS "sectionName",
        ps.section_code AS "sectionCode",
        ps.icon AS "sectionIcon",
        d.name AS "departmentName",
        mac.id AS "machineId",
        mac.name AS "machineName",
        se.id AS "equipmentId",
        se.equipment_name AS "equipmentName",
        se.equipment_type AS "equipmentType",
        se.tag_name AS "tagName",
        se.bearing_size AS "bearingSize",
        se.lock_nut AS "lockNut",
        se.washer,
        se.belt_no AS "beltNo",
        se.shaft_size AS "shaftSize",
        COALESCE(moves.consumed_qty, 0)::numeric(12,3) AS "consumedQty",
        COALESCE(moves.consumed_val, 0)::numeric(15,2) AS "consumedValue",
        COALESCE(moves.inward_qty, 0)::numeric(12,3) AS "inwardQty",
        COALESCE(moves.inward_val, 0)::numeric(15,2) AS "inwardValue",
        moves.last_txn_date AS "lastTxnDate"
      FROM materials m
      LEFT JOIN material_categories mc ON m.category_id = mc.id
      LEFT JOIN material_sections ms ON ms.material_id = m.id
      LEFT JOIN plant_sections ps ON (m.section_id = ps.id OR ms.section_id = ps.id)
      LEFT JOIN departments d ON ps.department_id = d.id
      LEFT JOIN material_equipment me ON me.material_id = m.id
      LEFT JOIN machines mac ON (m.machine_id = mac.id OR me.machine_id = mac.id)
      LEFT JOIN section_equipment se ON (m.section_equipment_id = se.id OR me.section_equipment_id = se.id)
      LEFT JOIN LATERAL (
        SELECT 
          COALESCE(SUM(sl.out_qty), 0) AS consumed_qty,
          COALESCE(SUM(sl.value) FILTER (WHERE sl.out_qty > 0), 0) AS consumed_val,
          COALESCE(SUM(sl.in_qty), 0) AS inward_qty,
          COALESCE(SUM(sl.value) FILTER (WHERE sl.in_qty > 0), 0) AS inward_val,
          MAX(sl.date) AS last_txn_date
        FROM stock_ledger sl
        WHERE sl.material_id = m.id AND sl.date BETWEEN '${f}' AND '${t}'
      ) moves ON true
      ${matWhere}
    ) granular_sub
    ORDER BY "sectionName" ASC NULLS LAST, "machineName" ASC NULLS LAST, "stockValuation" DESC
    LIMIT 2000
  `, matParams);

  // 3. Overview KPIs
  const totalValuation = granularItems.reduce((acc, it) => acc + parseFloat(it.stockValuation || 0), 0);
  const totalConsumptionValue = granularItems.reduce((acc, it) => acc + parseFloat(it.consumedValue || 0), 0);
  const totalInwardValue = granularItems.reduce((acc, it) => acc + parseFloat(it.inwardValue || 0), 0);
  const lowStockCount = granularItems.filter(it => parseFloat(it.currentStock || 0) <= parseFloat(it.minStock || 0)).length;

  if (format === 'csv') {
    const headers = [
      'Plant Section', 'Machine', 'Equipment', 'Material Code', 'Material Name',
      'Category', 'UOM', 'Bin Location', 'Unit Price', 'Current Stock',
      'Stock Valuation', 'Period Consumed Qty', 'Period Consumed Val',
      'Period Inward Qty', 'Period Inward Val', 'Last Txn Date'
    ];
    const csvRows = granularItems.map(r => [
      r.sectionName || 'Unassigned',
      r.machineName || '—',
      r.equipmentName || '—',
      r.materialCode,
      r.materialName,
      r.categoryName || '—',
      r.uom,
      r.binLocation || '—',
      r.unitPrice,
      r.currentStock,
      r.stockValuation,
      r.consumedQty,
      r.consumedValue,
      r.inwardQty,
      r.inwardValue,
      r.lastTxnDate ? r.lastTxnDate.toISOString().slice(0, 10) : '—'
    ]);
    return sendCSV(res, `plant_sections_granular_${f}_${t}.csv`, headers, csvRows);
  }

  res.json({
    success: true,
    data: {
      kpis: {
        totalSections: sectionRollups.length,
        totalMaterials: granularItems.length,
        totalValuation,
        totalConsumptionValue,
        totalInwardValue,
        lowStockCount,
        fromDate: f,
        toDate: t
      },
      sections: sectionRollups,
      granularItems
    }
  });
}));

module.exports = router;

