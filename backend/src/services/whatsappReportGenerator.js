/**
 * MK Paper Mill — WhatsApp Multi-Dimensional Enterprise Reporting Engine
 * Formats ultra-descriptive, aesthetic WhatsApp messages with emojis, bold tags, and section dividers.
 */

const fmtCur = (v) => `₹${Number(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
const fmtN = (v, dec = 1) => Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: dec, maximumFractionDigits: dec });

/**
 * 🌟 1. MASTER EXECUTIVE MILL & STORE REPORT
 */
function generateMasterWhatsAppReport(data, config = {}) {
  if (!data) return '';
  const d = data.date || new Date().toISOString().slice(0, 10);
  const p = data.production || {};
  const u = data.utility || {};
  const s = data.storeAndIndents || {};
  const m = data.maintenance || {};
  const q = data.quality || {};
  const indentsByDept = data.indentsByDept || [];
  const indentsList = data.indentsList || [];
  const categoryWise = data.categoryWiseStore || [];
  const inwardGRNs = data.inwardGRNs || [];
  const outwardIssues = data.outwardIssues || [];
  const topItemIssues = data.topItemIssues || outwardIssues.slice(0, 8);
  const criticalLowStock = data.criticalLowStock || [];
  const purchases = data.purchases || [];
  const totalValuation = data.totalMillInventoryValuation || 0;

  const lines = [
    `╔══════════════════════════════════╗`,
    `🏭 *MK PAPER MILL — EXECUTIVE EOD DIGEST*`,
    `📅 *Date:* ${d} | ⏱️ *Time:* ${new Date(data.compiledAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
    `╚══════════════════════════════════╝`,
    ``,
    `⚡ *EXECUTIVE STORE & PLANT SCORECARD:*`,
    `• Net Production: *${fmtN(p.totalMt, 2)} MT* (${p.totalReels || 0} Reels · Eff: *${fmtN(p.avgEfficiency, 1)}%*)`,
    `• Specific Power: *${fmtN(u.specificPowerKwhPerMt, 0)} kWh/MT* | Quality Pass: *${fmtN(q.passRate, 1)}%*`,
    `• Store Inwards (GRN): *${inwardGRNs.length} Receipts* (${fmtCur(s.stockReceivedValue || s.stockReceivedQty ? data.totalReceivedValue : 0)})`,
    `• Store Issues (Outward): *${outwardIssues.length} Items* (${fmtCur(s.stockIssueValue)})`,
    `• Indents Raised: *${s.indentsRaised || 0}* (${fmtCur(s.indentsValue)}) | Active Alerts: *${criticalLowStock.length}*`,
    totalValuation ? `• Total Store Inventory Value: *${fmtCur(totalValuation)}*` : null,
    ``,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `📊 *1. PLANT PRODUCTION & UTILITIES*`,
    `• Net Production: *${fmtN(p.totalMt, 2)} MT* | Avg GSM: *${fmtN(p.avgGsm, 1)}* | Moisture: *${fmtN(p.avgMoisture, 1)}%*`,
    `• Power Consumed: *${fmtN(u.powerUnits, 0)} kWh* | Steam: *${fmtN(u.steamMt, 1)} MT* | Coal: *${fmtN(u.coalKg, 0)} kg*`,
    `• Machine Downtime: *${m.downtimeMin || 0} mins* (${m.breakdowns || 0} breakdown events)`,
    ``,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `📥 *2. INWARD GRN RECEIPTS AGAINST PO (${inwardGRNs.length} Receipts)*`,
  ].filter(Boolean);

  if (inwardGRNs.length > 0) {
    inwardGRNs.slice(0, 8).forEach((grn, idx) => {
      const poRef = grn.po_number ? ` [PO: ${grn.po_number}]` : '';
      const secTag = grn.section_name ? ` [🏭 ${grn.section_name}${grn.machine_name ? ` › ${grn.machine_name}` : ''}]` : '';
      lines.push(`  ${idx + 1}. *${grn.mat_name}* [${grn.mat_code}]`);
      lines.push(`     ↳ Recv: *${fmtN(grn.in_qty, 1)} ${grn.uom}* from *${grn.vendor_name || 'Vendor'}* — *${fmtCur(grn.value)}*${poRef}${secTag}`);
    });
    if (inwardGRNs.length > 8) lines.push(`  _...and ${inwardGRNs.length - 8} more inward receipts_`);
  } else {
    lines.push(`• No inward GRN receipts recorded today.`);
  }

  lines.push(``);
  lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  lines.push(`📑 *3. DEPARTMENT STORE REQUISITIONS & INDENTS (${s.indentsRaised || 0} Indents · ${fmtCur(s.indentsValue)})*`);
  if (indentsByDept.length > 0) {
    indentsByDept.forEach(dept => {
      lines.push(`• *${dept.dept_name}:* ${dept.total_indents} indents (${fmtCur(dept.total_indent_value)}) — *${dept.issued_count} Issued*, *${dept.approved_count} Approved*, *${dept.pending_count} Pending*`);
    });
  } else {
    lines.push(`• No department indents raised today.`);
  }

  if (indentsList.length > 0) {
    lines.push(``);
    lines.push(`📋 *Key Requisition Highlights:*`);
    indentsList.slice(0, 5).forEach(ind => {
      lines.push(`  ▫️ *${ind.indent_number}* (${ind.dept_name}): *${fmtCur(ind.total_value)}* [${ind.status}] ${ind.raised_by_name ? `· By: ${ind.raised_by_name}` : ''}`);
    });
  }

  lines.push(``);
  lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  lines.push(`💎 *4. HIGH-VALUE MATERIAL CONSUMPTION & ISSUES*`);
  if (topItemIssues.length > 0) {
    topItemIssues.forEach((it, idx) => {
      const remarksText = it.remarks ? ` — _${it.remarks.slice(0, 40)}_` : '';
      const secTag = it.section_name ? ` [🏭 ${it.section_name}${it.machine_name ? ` › ${it.machine_name}` : ''}]` : '';
      lines.push(`  ${idx + 1}. *${it.mat_name}* [${it.mat_code}]${secTag}`);
      lines.push(`     ↳ Qty: *${fmtN(it.out_qty, 1)} ${it.uom}* | Value: *${fmtCur(it.value)}* | Dest: *${it.dept_name}*${remarksText}`);
    });
  } else {
    lines.push(`• No material issues recorded today.`);
  }

  lines.push(``);
  lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  lines.push(`🏷️ *5. CATEGORY-WISE STORE VALUATIONS & MOVEMENT*`);
  if (categoryWise.length > 0) {
    categoryWise.forEach(cat => {
      lines.push(`• *${cat.category_name} (${cat.store_type || 'Store'}):* Out: ${fmtN(cat.outward_qty, 1)} (${fmtCur(cat.outward_value)}) | In: ${fmtN(cat.inward_qty, 1)} (${fmtCur(cat.inward_value)})`);
    });
  } else {
    lines.push(`• No store movement recorded today.`);
  }

  if (criticalLowStock.length > 0) {
    lines.push(``);
    lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    lines.push(`🚨 *6. CRITICAL LOW STOCK & SAFETY SHORTAGES*`);
    criticalLowStock.slice(0, 6).forEach(mat => {
      const shortage = Number(mat.reorder_level || 0) - Number(mat.current_stock || 0);
      lines.push(`• *${mat.name}* [${mat.code}]: Stock: *${fmtN(mat.current_stock, 1)} ${mat.uom}* (Reorder: ${mat.reorder_level} | Shortage: *-${fmtN(shortage, 1)}*) [${mat.store_name || mat.category_name}]`);
    });
  }

  if (purchases.length > 0) {
    lines.push(``);
    lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    lines.push(`🛒 *7. PURCHASE ORDERS RELEASED (${purchases.length} POs)*`);
    purchases.forEach(po => {
      lines.push(`• *${po.po_number}*: ${po.vendor_name || 'Vendor'} — *${fmtCur(po.grand_total || po.total_value)}* [${po.status}] (${po.items_count} items)`);
    });
  }

  if (config.customRemarks && config.customRemarks.trim()) {
    lines.push(``);
    lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    lines.push(`💬 *STORE MANAGER OPERATIONAL NOTES*`);
    lines.push(`${config.customRemarks.trim()}`);
  }

  lines.push(``);
  lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  if (config.senderSignOff && config.senderSignOff.trim()) {
    lines.push(`✍️ _Dispatched by: ${config.senderSignOff.trim()}_`);
  }
  lines.push(`_MK Paper Mill ERP · Enterprise Automated Dispatch_`);

  return lines.join('\n');
}

/**
 * 📥 2. DETAILED GRN INWARDS & VENDOR RECEIPTS REPORT
 */
function generateGrnWhatsAppReport(data, config = {}) {
  if (!data) return '';
  const d = data.date || new Date().toISOString().slice(0, 10);
  const inwardGRNs = data.inwardGRNs || [];
  const detailedGrns = data.detailedGrns || [];
  const totalVal = data.totalReceivedValue || inwardGRNs.reduce((acc, g) => acc + parseFloat(g.value || 0), 0);
  const totalQty = data.totalReceivedQty || inwardGRNs.reduce((acc, g) => acc + parseFloat(g.in_qty || 0), 0);

  const lines = [
    `╔══════════════════════════════════╗`,
    `📥 *MK PAPER MILL — INWARD GRN RECEIPTS*`,
    `📅 *Date:* ${d} | ⏱️ *Time:* ${new Date(data.compiledAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
    `╚══════════════════════════════════╝`,
    ``,
    `📊 *INWARD RECEIPT SUMMARY:*`,
    `• Total GRN Inward Receipts: *${detailedGrns.length || inwardGRNs.length}*`,
    `• Total Inward Quantity: *${fmtN(totalQty, 1)} Units*`,
    `• Total Inward Valuation: *${fmtCur(totalVal)}*`,
    `• Registered Vendors: *${new Set(inwardGRNs.map(g => g.vendor_name).filter(Boolean)).size} Vendors*`,
    ``,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `📦 *DETAILED GRN & MATERIAL RECEIPT REGISTER:*`,
  ];

  if (detailedGrns.length > 0) {
    detailedGrns.forEach((grn, idx) => {
      lines.push(``);
      lines.push(`${idx + 1}. 🏷️ *GRN No: ${grn.grn_number}* | 🏢 *Vendor: ${grn.vendor_name || 'Vendor'}*`);
      lines.push(`   📄 PO Ref: *${grn.po_number || 'Direct/Spot'}* | 📑 Inv: *${grn.invoice_number || '—'}* | 💰 Total: *${fmtCur(grn.total_value || grn.grand_total)}*`);
      if (grn.items && grn.items.length > 0) {
        grn.items.forEach(it => {
          const secTag = it.section_name ? ` [🏭 ${it.section_name}]` : '';
          lines.push(`   ▫️ *${it.mat_name}* [${it.mat_code}]${secTag}`);
          lines.push(`      ↳ Recv: *${fmtN(it.received_qty, 1)}* | Acc: *${fmtN(it.accepted_qty, 1)} ${it.uom}* @ *${fmtCur(it.unit_price)}* = *${fmtCur(it.total_amount)}*`);
        });
      }
    });
  } else if (inwardGRNs.length > 0) {
    inwardGRNs.forEach((grn, idx) => {
      const poRef = grn.po_number ? ` [PO: ${grn.po_number}]` : '';
      const secTag = grn.section_name ? ` [🏭 ${grn.section_name}${grn.machine_name ? ` › ${grn.machine_name}` : ''}]` : '';
      lines.push(`  ${idx + 1}. *${grn.mat_name}* [${grn.mat_code}]${secTag}`);
      lines.push(`     ↳ Inward: *${fmtN(grn.in_qty, 1)} ${grn.uom}* @ *${fmtCur(grn.value && grn.in_qty ? grn.value / grn.in_qty : 0)}* = *${fmtCur(grn.value)}*`);
      lines.push(`     ↳ Vendor: *${grn.vendor_name || 'Vendor'}*${poRef}`);
    });
  } else {
    lines.push(`• No GRN inward receipts recorded for ${d}.`);
  }

  lines.push(``);
  lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  if (config.customRemarks && config.customRemarks.trim()) {
    lines.push(`💬 *STORE MANAGER NOTES:*`);
    lines.push(`${config.customRemarks.trim()}`);
    lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  }
  if (config.senderSignOff && config.senderSignOff.trim()) {
    lines.push(`✍️ _Dispatched by: ${config.senderSignOff.trim()}_`);
  }
  lines.push(`_MK Paper Mill ERP · Store Inward Ingestion Ledger_`);

  return lines.join('\n');
}

/**
 * 📑 3. DETAILED DEPARTMENT INDENTS & REQUISITIONS REPORT
 */
function generateIndentWhatsAppReport(data, config = {}) {
  if (!data) return '';
  const d = data.date || new Date().toISOString().slice(0, 10);
  const s = data.storeAndIndents || {};
  const indentsByDept = data.indentsByDept || [];
  const indentsList = data.indentsList || [];
  const detailedIndents = data.detailedIndents || indentsList;

  const lines = [
    `╔══════════════════════════════════╗`,
    `📑 *MK PAPER MILL — DEPARTMENT INDENTS*`,
    `📅 *Date:* ${d} | ⏱️ *Time:* ${new Date(data.compiledAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
    `╚══════════════════════════════════╝`,
    ``,
    `📊 *REQUISITION & INDENT SUMMARY:*`,
    `• Total Indents Raised: *${s.indentsRaised || indentsList.length}*`,
    `• Total Requisition Value: *${fmtCur(s.indentsValue)}*`,
    `• Departments Requesting: *${indentsByDept.length} Departments*`,
    `• Status Breakdown: *${indentsByDept.reduce((a, b) => a + Number(b.issued_count || 0), 0)} Issued*, *${indentsByDept.reduce((a, b) => a + Number(b.approved_count || 0), 0)} Approved*, *${indentsByDept.reduce((a, b) => a + Number(b.pending_count || 0), 0)} Pending*`,
    ``,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `🏢 *DEPARTMENT-WISE REQUISITION SPEND:*`,
  ];

  if (indentsByDept.length > 0) {
    indentsByDept.forEach(dept => {
      lines.push(`• *${dept.dept_name}:* ${dept.total_indents} indents · *${fmtCur(dept.total_indent_value)}*`);
      lines.push(`  ↳ [Issued: *${dept.issued_count}* | Approved: *${dept.approved_count}* | Pending: *${dept.pending_count}*]`);
    });
  } else {
    lines.push(`• No department indents recorded today.`);
  }

  lines.push(``);
  lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  lines.push(`📋 *DETAILED INDENT & ITEM REQUISITION LIST:*`);

  if (detailedIndents.length > 0) {
    detailedIndents.forEach((ind, idx) => {
      lines.push(``);
      lines.push(`${idx + 1}. 📄 *Indent: ${ind.indent_number}* [${ind.dept_name}]`);
      lines.push(`   ⚡ Priority: *${ind.priority || 'Normal'}* | Status: *${ind.status}* | Total: *${fmtCur(ind.total_value)}*`);
      lines.push(`   👤 Raised By: *${ind.raised_by_name || 'Staff'}* ${ind.items_count ? `(${ind.items_count} items)` : ''}`);
      if (ind.items && ind.items.length > 0) {
        ind.items.forEach(it => {
          const pend = Number(it.pending_qty != null ? it.pending_qty : (Number(it.required_qty || 0) - Number(it.issued_qty || 0)));
          const secTag = it.section_name ? ` [🏭 ${it.section_name}]` : '';
          lines.push(`   ▫️ *${it.mat_name}* [${it.mat_code}]${secTag}`);
          lines.push(`      ↳ Req: *${fmtN(it.required_qty, 1)} ${it.uom}* | Issued: *${fmtN(it.issued_qty, 1)}* | Pend: *${fmtN(pend, 1)}* @ *${fmtCur(it.unit_price)}*`);
        });
      }
    });
  } else {
    lines.push(`• No individual indent items listed.`);
  }

  lines.push(``);
  lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  if (config.customRemarks && config.customRemarks.trim()) {
    lines.push(`💬 *STORE MANAGER NOTES:*`);
    lines.push(`${config.customRemarks.trim()}`);
    lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  }
  if (config.senderSignOff && config.senderSignOff.trim()) {
    lines.push(`✍️ _Dispatched by: ${config.senderSignOff.trim()}_`);
  }
  lines.push(`_MK Paper Mill ERP · Department Requisition Register_`);

  return lines.join('\n');
}

/**
 * 📦 4. MATERIAL & ITEM WISE MOVEMENT REPORT
 */
function generateItemWiseWhatsAppReport(data, config = {}) {
  if (!data) return '';
  const d = data.date || new Date().toISOString().slice(0, 10);
  const outwardIssues = data.outwardIssues || [];
  const inwardGRNs = data.inwardGRNs || [];
  const s = data.storeAndIndents || {};

  const lines = [
    `╔══════════════════════════════════╗`,
    `📦 *MK PAPER MILL — MATERIAL & ITEM MOVEMENTS*`,
    `📅 *Date:* ${d} | ⏱️ *Time:* ${new Date(data.compiledAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
    `╚══════════════════════════════════╝`,
    ``,
    `📊 *ITEM TRANSACTION METRICS:*`,
    `• Outward Material Items Issued: *${outwardIssues.length} Items* (${fmtCur(s.stockIssueValue)})`,
    `• Inward Material Items Received: *${inwardGRNs.length} Items* (${fmtCur(data.totalReceivedValue || 0)})`,
    `• Net Store Volume Issued: *${fmtN(s.stockIssuedQty || 0, 1)} Units*`,
    ``,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `📤 *ITEM-BY-ITEM OUTWARD CONSUMPTION LEDGER:*`,
  ];

  if (outwardIssues.length > 0) {
    outwardIssues.forEach((it, idx) => {
      const secTag = it.section_name ? ` [🏭 ${it.section_name}${it.machine_name ? ` › ${it.machine_name}` : ''}]` : '';
      const remarksText = it.remarks ? ` — _${it.remarks.slice(0, 40)}_` : '';
      lines.push(``);
      lines.push(`${idx + 1}. 💎 *${it.mat_name}* [${it.mat_code}]${secTag}`);
      lines.push(`   ↳ Outward Qty: *${fmtN(it.out_qty, 1)} ${it.uom}* | Line Value: *${fmtCur(it.value)}*`);
      lines.push(`   ↳ Issued To: *${it.dept_name || 'General Mill'}*${remarksText}`);
      if (it.current_stock != null) {
        lines.push(`   ↳ Remaining Stock: *${fmtN(it.current_stock, 1)} ${it.uom}* (Reorder: ${it.reorder_level || '—'})`);
      }
    });
  } else {
    lines.push(`• No outward material issues recorded today.`);
  }

  if (inwardGRNs.length > 0) {
    lines.push(``);
    lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    lines.push(`📥 *ITEM-BY-ITEM INWARD RECEIPT LEDGER:*`);
    inwardGRNs.forEach((it, idx) => {
      const secTag = it.section_name ? ` [🏭 ${it.section_name}]` : '';
      lines.push(`  ${idx + 1}. *${it.mat_name}* [${it.mat_code}]${secTag}`);
      lines.push(`     ↳ Inward: *${fmtN(it.in_qty, 1)} ${it.uom}* | Value: *${fmtCur(it.value)}* from *${it.vendor_name || 'Vendor'}*`);
    });
  }

  lines.push(``);
  lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  if (config.customRemarks && config.customRemarks.trim()) {
    lines.push(`💬 *STORE MANAGER NOTES:*`);
    lines.push(`${config.customRemarks.trim()}`);
    lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  }
  if (config.senderSignOff && config.senderSignOff.trim()) {
    lines.push(`✍️ _Dispatched by: ${config.senderSignOff.trim()}_`);
  }
  lines.push(`_MK Paper Mill ERP · Item Level Material Ledger_`);

  return lines.join('\n');
}

/**
 * 🏷️ 5. INVENTORY STORE VALUATION & TOTALS REPORT
 */
function generateInventoryValuationReport(data, config = {}) {
  if (!data) return '';
  const d = data.date || new Date().toISOString().slice(0, 10);
  const categoryWise = data.categoryWiseStore || [];
  const s = data.storeAndIndents || {};
  const totalValuation = data.totalMillInventoryValuation || 0;
  const totalReceivedVal = data.totalReceivedValue || 0;
  const totalIssuedVal = s.stockIssueValue || 0;
  const netChangeVal = totalReceivedVal - totalIssuedVal;

  const lines = [
    `╔══════════════════════════════════╗`,
    `🏷️ *MK PAPER MILL — INVENTORY & STORE VALUATION*`,
    `📅 *Date:* ${d} | ⏱️ *Time:* ${new Date(data.compiledAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
    `╚══════════════════════════════════╝`,
    ``,
    `💰 *MILL-WIDE INVENTORY POSITION:*`,
    totalValuation ? `• *Total Catalog Stock Valuation:* ${fmtCur(totalValuation)}` : null,
    `• *Total Inventory Received Today:* ${fmtN(s.stockReceivedQty || data.totalReceivedQty || 0, 1)} Units (${fmtCur(totalReceivedVal)})`,
    `• *Total Inventory Issued Today:* ${fmtN(s.stockIssuedQty || 0, 1)} Units (${fmtCur(totalIssuedVal)})`,
    `• *Net Daily Inventory Movement:* ${netChangeVal >= 0 ? '+' : ''}${fmtCur(netChangeVal)}`,
    `• *Total Active Catalog Materials:* ${data.totalActiveMaterials || 'Catalog Active'}`,
    ``,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `🏪 *CATEGORY & STORE-TYPE VALUATIONS:*`,
  ].filter(Boolean);

  if (categoryWise.length > 0) {
    categoryWise.forEach((cat, idx) => {
      lines.push(``);
      lines.push(`${idx + 1}. 📁 *${cat.category_name}* [${cat.store_type || 'Store'}]`);
      if (cat.total_stock_valuation) {
        lines.push(`   ↳ On-Hand Stock Value: *${fmtCur(cat.total_stock_valuation)}* (${fmtN(cat.total_stock_qty || 0, 0)} units · ${cat.total_materials_count || 0} items)`);
      }
      lines.push(`   ↳ Today Outward: *${fmtN(cat.outward_qty, 1)}* (${fmtCur(cat.outward_value)}) | Inward: *${fmtN(cat.inward_qty, 1)}* (${fmtCur(cat.inward_value)})`);
    });
  } else {
    lines.push(`• No store movements recorded today.`);
  }

  if (data.criticalLowStock && data.criticalLowStock.length > 0) {
    lines.push(``);
    lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    lines.push(`🚨 *SAFETY REORDER & SHORTAGE ALERTS (${data.criticalLowStock.length} Items):*`);
    data.criticalLowStock.slice(0, 8).forEach(mat => {
      const shortage = Number(mat.reorder_level || 0) - Number(mat.current_stock || 0);
      lines.push(`• *${mat.name}* [${mat.code}]: Current: *${fmtN(mat.current_stock, 1)} ${mat.uom}* (Reorder: ${mat.reorder_level} | Shortage: *-${fmtN(shortage, 1)}*)`);
    });
  }

  lines.push(``);
  lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  if (config.customRemarks && config.customRemarks.trim()) {
    lines.push(`💬 *STORE MANAGER NOTES:*`);
    lines.push(`${config.customRemarks.trim()}`);
    lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  }
  if (config.senderSignOff && config.senderSignOff.trim()) {
    lines.push(`✍️ _Dispatched by: ${config.senderSignOff.trim()}_`);
  }
  lines.push(`_MK Paper Mill ERP · Store Valuation & Inventory Accounting_`);

  return lines.join('\n');
}

module.exports = {
  generateMasterWhatsAppReport,
  generateGrnWhatsAppReport,
  generateIndentWhatsAppReport,
  generateItemWiseWhatsAppReport,
  generateInventoryValuationReport
};
