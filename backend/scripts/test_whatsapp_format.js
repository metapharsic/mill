const pool = require('../src/db/pool');

function formatWhatsAppEOD(data) {
  const d = data.date;
  const p = data.production || {};
  const u = data.utility || {};
  const c = data.commercial || {};
  const s = data.storeAndIndents || {};
  const m = data.maintenance || {};
  const indentsByDept = data.indentsByDept || [];
  const indentsList = data.indentsList || [];
  const categoryWise = data.categoryWiseStore || [];
  const purchases = data.purchases || [];
  const inwardGRNs = data.inwardGRNs || [];
  const outwardIssues = data.outwardIssues || [];

  const fmtCur = v => `Rs. ${Number(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
  const fmtN = (v, dec = 1) => Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: dec, maximumFractionDigits: dec });

  const lines = [
    `*MK PAPER MILL — DAILY EOD DIGEST*`,
    `*Date:* ${d} | *Compiled:* ${new Date(data.compiledAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
    ``,
    `━━━━━━━━━━━━━━━━━━━━`,
    `*1. PLANT PRODUCTION & POWER*`,
    `• Net Production: *${fmtN(p.totalMt, 2)} MT* (${p.totalReels || 0} Reels) | Avg GSM: *${fmtN(p.avgGsm, 1)}*`,
    `• Power Consumed: *${fmtN(u.powerUnits, 0)} kWh* | Steam: *${fmtN(u.steamMt, 1)} MT*`,
    `• Dispatches: *${fmtN(c.dispatchedMt, 2)} MT* | New Orders: *${c.ordersBooked || 0}*`,
    `• Downtime: *${m.downtimeMin || 0} mins* (${m.breakdowns || 0} events)`,
    ``,
    `━━━━━━━━━━━━━━━━━━━━`,
    `*2. INDENTS RAISED BY DEPT (${s.indentsRaised || 0} Indents · ${fmtCur(s.indentsValue)})*`,
  ];

  if (indentsByDept.length > 0) {
    indentsByDept.forEach(dept => {
      lines.push(`• *${dept.dept_name}:* ${dept.total_indents} indents (${fmtCur(dept.total_indent_value)}) — ${dept.issued_count} Issued, ${dept.approved_count} Approved, ${dept.pending_count} Pending`);
    });
  } else {
    lines.push(`• No new indents raised today.`);
  }

  if (indentsList.length > 0) {
    lines.push(``);
    lines.push(`*Key Indents Detail:*`);
    indentsList.slice(0, 5).forEach(ind => {
      lines.push(`  • *${ind.indent_number}* (${ind.dept_name}): ${fmtCur(ind.total_value)} [${ind.status}]`);
    });
    if (indentsList.length > 5) lines.push(`  _...and ${indentsList.length - 5} more indents_`);
  }

  lines.push(``);
  lines.push(`━━━━━━━━━━━━━━━━━━━━`);
  lines.push(`*3. CATEGORY-WISE STORE MOVEMENT*`);
  if (categoryWise.length > 0) {
    categoryWise.forEach(cat => {
      lines.push(`• *${cat.category_name} (${cat.store_type || 'Store'}):* Outward: ${fmtN(cat.outward_qty, 1)} (${fmtCur(cat.outward_value)}) | Inward: ${fmtN(cat.inward_qty, 1)} (${fmtCur(cat.inward_value)})`);
    });
  } else {
    lines.push(`• No store movement recorded today.`);
  }

  lines.push(``);
  lines.push(`━━━━━━━━━━━━━━━━━━━━`);
  lines.push(`*4. PURCHASE ORDERS DONE (${purchases.length} POs)*`);
  if (purchases.length > 0) {
    purchases.forEach(po => {
      lines.push(`• *${po.po_number}*: ${po.vendor_name || 'Vendor'} — ${fmtCur(po.grand_total || po.total_value)} [${po.status}] (${po.items_count} items)`);
    });
  } else {
    lines.push(`• No purchase orders raised today.`);
  }

  lines.push(``);
  lines.push(`━━━━━━━━━━━━━━━━━━━━`);
  lines.push(`*5. INWARD GRN RECEIVED AGAINST PO (${inwardGRNs.length} GRNs)*`);
  if (inwardGRNs.length > 0) {
    inwardGRNs.slice(0, 6).forEach(grn => {
      const poRef = grn.po_number ? ` [PO: ${grn.po_number}]` : (grn.remarks?.includes('Ref:') ? ` [${grn.remarks.split('|')[1]?.trim() || ''}]` : '');
      lines.push(`• *${grn.mat_name}* (${fmtN(grn.in_qty, 1)} ${grn.uom}) from *${grn.vendor_name || 'Vendor'}* — ${fmtCur(grn.value)}${poRef}`);
    });
    if (inwardGRNs.length > 6) lines.push(`  _...and ${inwardGRNs.length - 6} more inward receipts_`);
  } else {
    lines.push(`• No inward GRN receipts recorded today.`);
  }

  lines.push(``);
  lines.push(`━━━━━━━━━━━━━━━━━━━━`);
  lines.push(`*6. OUTWARD ISSUANCE TO MILL (${outwardIssues.length} Items · ${fmtCur(s.stockIssueValue)})*`);
  if (outwardIssues.length > 0) {
    outwardIssues.slice(0, 6).forEach(iss => {
      lines.push(`• *${iss.mat_name}* (${fmtN(iss.out_qty, 1)} ${iss.uom}) -> *${iss.dept_name}* (${fmtCur(iss.value)})`);
    });
    if (outwardIssues.length > 6) lines.push(`  _...and ${outwardIssues.length - 6} more outward items_`);
  } else {
    lines.push(`• No outward material issues recorded today.`);
  }

  lines.push(``);
  lines.push(`━━━━━━━━━━━━━━━━━━━━`);
  lines.push(`_MK Paper Mill ERP · Automated EOD Dispatch_`);

  return lines.join('\n');
}

async function run() {
  const d = '2026-08-13';
  const data = {
    date: d,
    compiledAt: new Date().toISOString(),
    production: { totalMt: 85.4, totalReels: 42, avgGsm: 140.2, avgEfficiency: 92.5 },
    utility: { powerUnits: 34200, steamMt: 142.5 },
    commercial: { dispatchedMt: 78.2, ordersBooked: 3 },
    maintenance: { downtimeMin: 45, breakdowns: 2 },
    storeAndIndents: { indentsRaised: 2, indentsValue: 125000, stockIssueValue: 980 },
    indentsByDept: [
      { dept_name: 'Production', total_indents: 1, total_indent_value: 45000, issued_count: 1, approved_count: 0, pending_count: 0 },
      { dept_name: 'Maintenance', total_indents: 1, total_indent_value: 80000, issued_count: 0, approved_count: 1, pending_count: 0 }
    ],
    indentsList: [
      { indent_number: 'IND-20260813-0001', dept_name: 'Production', total_value: 45000, status: 'Issued' },
      { indent_number: 'IND-20260813-0002', dept_name: 'Maintenance', total_value: 80000, status: 'Approved' }
    ],
    categoryWiseStore: [
      { category_name: 'Mechanical', store_type: 'Mechanical', inward_qty: 10, inward_value: 675, outward_qty: 1, outward_value: 0 },
      { category_name: 'Chemicals', store_type: 'Chemical', inward_qty: 0, inward_value: 0, outward_qty: 23, outward_value: 980 }
    ],
    purchases: [
      { po_number: 'PO-20260813-0001', vendor_name: 'Test Vendor Co', grand_total: 185000, status: 'Approved', items_count: 3 }
    ],
    inwardGRNs: [
      { mat_name: 'C.I BODY S.S DISC BUTTERFLY VALVE 2"', in_qty: 3, uom: 'Nos', value: 75, vendor_name: 'Test Vendor Co', po_number: 'PO-20260813-0001' }
    ],
    outwardIssues: [
      { mat_name: 'STARCH', out_qty: 16, uom: 'Kgs', value: 576, dept_name: 'Production' }
    ]
  };

  const text = formatWhatsAppEOD(data);
  console.log(text);
  console.log('\nURL length:', encodeURIComponent(text).length);
  await pool.end();
}

run().catch(console.error);
