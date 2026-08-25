import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useAuth } from '../context/AuthContext'
import InventoryExportModal from '../components/InventoryExportModal'
import {
  FileText, Zap, Factory, Boxes, BadgeCheck, Wrench, ShoppingCart,
  Truck, UsersRound, Calendar, Printer, Download, RefreshCw, Send,
  AlertTriangle, CheckCircle2, Search, Filter, Layers, Clock, ArrowRight,
  TrendingUp, BarChart2, ShieldCheck, Flame, Copy, Check, ExternalLink,
  MessageSquare, Share2, FileSpreadsheet
} from 'lucide-react'

function WhatsAppIcon({ size = 16, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color} style={{ flexShrink: 0 }}>
      <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.816 9.816 0 0012.04 2zm.01 1.67c4.54 0 8.24 3.7 8.24 8.24 0 2.2-.86 4.27-2.42 5.82a8.17 8.17 0 01-5.82 2.42c-1.48 0-2.93-.4-4.2-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.19 8.19 0 01-1.25-4.38c0-4.54 3.7-8.24 8.24-8.24zm4.5 11.66c-.25-.13-1.47-.72-1.7-.81-.23-.08-.39-.13-.56.13-.17.25-.64.81-.79.98-.14.17-.29.19-.54.06-.25-.13-1.06-.39-2.02-1.24-.75-.67-1.26-1.49-1.41-1.74-.14-.25-.02-.39.11-.51.11-.11.25-.29.37-.44.13-.14.17-.25.25-.42.08-.17.04-.31-.02-.44-.06-.13-.56-1.35-.77-1.85-.2-.49-.41-.42-.56-.43h-.48c-.17 0-.44.06-.67.31-.23.25-.88.86-.88 2.1s.9 2.43 1.03 2.6c.13.17 1.77 2.7 4.28 3.79.6.26 1.07.41 1.43.53.6.19 1.15.16 1.58.1.48-.07 1.47-.6 1.68-1.18.21-.58.21-1.08.15-1.18-.06-.11-.23-.17-.48-.29z" />
    </svg>
  )
}

export const DEFAULT_WA_CONFIG = {
  template: 'full', // 'full' | 'item_movement' | 'store_focus' | 'indents_focus' | 'procurement_focus' | 'emergency_alert' | 'custom'
  showScorecard: true,
  showProductionPower: true,
  showIndentsSummary: true,
  showIndentsDetailed: true,
  showTopItemIssues: true,
  showCriticalLowStock: true,
  showCategoryStore: true,
  showPurchaseOrders: true,
  showInwardGRN: true,
  showOutwardIssues: true,
  showDowntime: true,
  showCustomRemarks: true,
  showFooter: true,
  customRemarks: '',
  senderSignOff: 'Store & Mill Operations Desk · MK Paper Mill',
  phone: '',
}

export const WA_PRESETS = [
  {
    id: 'full',
    label: '⚡ Full Executive EOD',
    desc: 'Complete 8-section digest: KPIs, Production, Indents, Top Spares, Stock Alerts & Procurement',
    apply: (curr) => ({
      ...curr,
      template: 'full',
      showScorecard: true,
      showProductionPower: true,
      showIndentsSummary: true,
      showIndentsDetailed: true,
      showTopItemIssues: true,
      showCriticalLowStock: true,
      showCategoryStore: true,
      showPurchaseOrders: true,
      showInwardGRN: true,
      showOutwardIssues: true,
      showDowntime: true,
      showCustomRemarks: true,
      showFooter: true,
    })
  },
  {
    id: 'item_movement',
    label: '📦 Item Movement & Spares',
    desc: 'Focus on high-value item issues, department destinations & critical stock replenishment',
    apply: (curr) => ({
      ...curr,
      template: 'item_movement',
      showScorecard: true,
      showProductionPower: false,
      showIndentsSummary: false,
      showIndentsDetailed: false,
      showTopItemIssues: true,
      showCriticalLowStock: true,
      showCategoryStore: true,
      showPurchaseOrders: false,
      showInwardGRN: true,
      showOutwardIssues: true,
      showDowntime: false,
      showCustomRemarks: true,
      showFooter: true,
    })
  },
  {
    id: 'store_focus',
    label: '🏷️ Store Valuation & Inventory',
    desc: 'Category movements, inward receipts, outward consumption & total store valuation',
    apply: (curr) => ({
      ...curr,
      template: 'store_focus',
      showScorecard: true,
      showProductionPower: false,
      showIndentsSummary: true,
      showIndentsDetailed: false,
      showTopItemIssues: true,
      showCriticalLowStock: true,
      showCategoryStore: true,
      showPurchaseOrders: true,
      showInwardGRN: true,
      showOutwardIssues: true,
      showDowntime: false,
      showCustomRemarks: true,
      showFooter: true,
    })
  },
  {
    id: 'indents_focus',
    label: '📑 Indents & Requisitions',
    desc: 'Department-wise store indents, approvals status & individual requisition details',
    apply: (curr) => ({
      ...curr,
      template: 'indents_focus',
      showScorecard: false,
      showProductionPower: false,
      showIndentsSummary: true,
      showIndentsDetailed: true,
      showTopItemIssues: false,
      showCriticalLowStock: false,
      showCategoryStore: false,
      showPurchaseOrders: false,
      showInwardGRN: false,
      showOutwardIssues: false,
      showDowntime: false,
      showCustomRemarks: true,
      showFooter: true,
    })
  },
  {
    id: 'procurement_focus',
    label: '🛒 Procurement & GRNs',
    desc: 'Purchase orders released, supplier terms & inward GRN receipts against POs',
    apply: (curr) => ({
      ...curr,
      template: 'procurement_focus',
      showScorecard: false,
      showProductionPower: false,
      showIndentsSummary: false,
      showIndentsDetailed: false,
      showTopItemIssues: false,
      showCriticalLowStock: true,
      showCategoryStore: false,
      showPurchaseOrders: true,
      showInwardGRN: true,
      showOutwardIssues: false,
      showDowntime: false,
      showCustomRemarks: true,
      showFooter: true,
    })
  },
  {
    id: 'emergency_alert',
    label: '🚨 Critical Alerts & Downtime',
    desc: 'Critical safety stock shortages, machine breakdowns & urgent technical indents',
    apply: (curr) => ({
      ...curr,
      template: 'emergency_alert',
      showScorecard: true,
      showProductionPower: true,
      showIndentsSummary: false,
      showIndentsDetailed: true,
      showTopItemIssues: true,
      showCriticalLowStock: true,
      showCategoryStore: false,
      showPurchaseOrders: false,
      showInwardGRN: false,
      showOutwardIssues: false,
      showDowntime: true,
      showCustomRemarks: true,
      showFooter: true,
    })
  },
]

export const DEFAULT_CONTACTS = [
  { label: '👑 Managing Director', phone: '919876500001' },
  { label: '🏭 Plant Head', phone: '919876500002' },
  { label: '🏢 General Manager', phone: '919876500003' },
  { label: '📦 Store Head', phone: '919876500004' },
  { label: '⚙️ Production HOD', phone: '919876500005' },
  { label: '🔧 Maintenance HOD', phone: '919876500006' },
  { label: '💼 Commercial HOD', phone: '919876500007' },
]

export function generateWhatsAppEodText(data, config = DEFAULT_WA_CONFIG) {
  if (!data) return ''
  const cfg = { ...DEFAULT_WA_CONFIG, ...(config || {}) }
  const d = data.date || today
  const p = data.production || {}
  const u = data.utility || {}
  const c = data.commercial || {}
  const s = data.storeAndIndents || {}
  const m = data.maintenance || {}
  const q = data.quality || {}
  const indentsByDept = data.indentsByDept || []
  const indentsList = data.indentsList || []
  const categoryWise = data.categoryWiseStore || []
  const purchases = data.purchases || []
  const inwardGRNs = data.inwardGRNs || []
  const outwardIssues = data.outwardIssues || []
  const topItemIssues = data.topItemIssues || outwardIssues.slice(0, 5)
  const criticalLowStock = data.criticalLowStock || []

  const fmtCur = v => `₹${Number(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
  const fmtN = (v, dec = 1) => Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: dec, maximumFractionDigits: dec })

  const lines = [
    `╔══════════════════════════════════╗`,
    `🏭 *MK PAPER MILL — EXECUTIVE EOD DIGEST*`,
    `📅 *Date:* ${d} | ⏱️ *Time:* ${new Date(data.compiledAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
    `╚══════════════════════════════════╝`,
  ]

  // Executive Scorecard Callout
  if (cfg.showScorecard) {
    const spPower = u.specificPowerKwhPerMt ? `${fmtN(u.specificPowerKwhPerMt, 0)} kWh/MT` : '—'
    lines.push(``)
    lines.push(`⚡ *EXECUTIVE SCORECARD:*`)
    lines.push(`• Production: *${fmtN(p.totalMt, 2)} MT* (${p.totalReels || 0} Reels · Eff: *${fmtN(p.avgEfficiency, 1)}%*)`)
    lines.push(`• Specific Energy: *${spPower}* | Quality Pass: *${fmtN(q.passRate, 1)}%*`)
    lines.push(`• Indents: *${s.indentsRaised || 0}* (${fmtCur(s.indentsValue)}) | Issued Out: *${fmtCur(s.stockIssueValue)}*`)
  }

  // Section 1: Plant Production & Power
  if (cfg.showProductionPower) {
    lines.push(``)
    lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
    lines.push(`📊 *1. PLANT PRODUCTION & POWER EFFICIENCY*`)
    lines.push(`• Net Production: *${fmtN(p.totalMt, 2)} MT* | Avg GSM: *${fmtN(p.avgGsm, 1)}* | Moisture: *${fmtN(p.avgMoisture, 1)}%*`)
    lines.push(`• Power Consumed: *${fmtN(u.powerUnits, 0)} kWh* | Steam: *${fmtN(u.steamMt, 1)} MT* | Coal: *${fmtN(u.coalKg, 0)} kg*`)
    lines.push(`• Dispatches: *${fmtN(c.dispatchedMt, 2)} MT* | New Orders Booked: *${c.ordersBooked || 0}* (${fmtCur(c.bookedValue)})`)
    lines.push(`• Machine Downtime: *${m.downtimeMin || 0} mins* (${m.breakdowns || 0} breakdown events)`)
  }

  // Section 2: Department Indents
  if (cfg.showIndentsSummary) {
    lines.push(``)
    lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
    lines.push(`📑 *2. DEPARTMENT STORE REQUISITIONS (${s.indentsRaised || 0} Indents · ${fmtCur(s.indentsValue)})*`)
    if (indentsByDept.length > 0) {
      indentsByDept.forEach(dept => {
        lines.push(`• *${dept.dept_name}:* ${dept.total_indents} indents (${fmtCur(dept.total_indent_value)}) — ${dept.issued_count} Issued, ${dept.approved_count} Approved, ${dept.pending_count} Pending`)
      })
    } else {
      lines.push(`• No new indents raised today.`)
    }

    if (cfg.showIndentsDetailed && indentsList.length > 0) {
      lines.push(``)
      lines.push(`📋 *Key Requisition Highlights:*`)
      indentsList.slice(0, 5).forEach(ind => {
        lines.push(`  ▫️ *${ind.indent_number}* (${ind.dept_name}): ${fmtCur(ind.total_value)} [${ind.status}]`)
      })
      if (indentsList.length > 5) lines.push(`  _...and ${indentsList.length - 5} more indents_`)
    }
  }

  // Section 3: Top 5 High-Value Material Movements (Item-Wise Focus)
  if (cfg.showTopItemIssues && topItemIssues.length > 0) {
    lines.push(``)
    lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
    lines.push(`💎 *3. HIGH-VALUE ITEM ISSUES & CONSUMPTION*`)
    topItemIssues.forEach((it, idx) => {
      const remarksText = it.remarks ? ` — _${it.remarks.slice(0, 45)}_` : ''
      const secTag = it.section_name ? ` [🏭 ${it.section_name}${it.machine_name ? ` › ${it.machine_name}` : ''}]` : ''
      lines.push(`  ${idx + 1}. *${it.mat_name}* [${it.mat_code}]${secTag}`)
      lines.push(`     ↳ Qty: *${fmtN(it.out_qty, 1)} ${it.uom}* | Value: *${fmtCur(it.value)}* | Dest: *${it.dept_name}*${remarksText}`)
    })
  }

  // Section 4: Critical Low-Stock Alerts
  if (cfg.showCriticalLowStock && criticalLowStock.length > 0) {
    lines.push(``)
    lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
    lines.push(`🚨 *4. CRITICAL LOW STOCK & SAFETY SHORTAGES*`)
    criticalLowStock.slice(0, 5).forEach(mat => {
      const shortage = Number(mat.reorder_level || 0) - Number(mat.current_stock || 0)
      const secTag = mat.section_name ? ` | 🏭 ${mat.section_name}${mat.machine_name ? ` › ${mat.machine_name}` : ''}` : ''
      lines.push(`• *${mat.name}* [${mat.code}]: Stock: *${fmtN(mat.current_stock, 1)} ${mat.uom}* (Reorder: ${mat.reorder_level} | Shortage: *-${fmtN(shortage, 1)}*)${secTag} [${mat.store_name || mat.category_name}]`)
    })
  }

  // Section 5: Category-Wise Store Movement
  if (cfg.showCategoryStore) {
    lines.push(``)
    lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
    lines.push(`🏷️ *5. CATEGORY-WISE STORE VALUATIONS & MOVEMENT*`)
    if (categoryWise.length > 0) {
      categoryWise.forEach(cat => {
        lines.push(`• *${cat.category_name} (${cat.store_type || 'Store'}):* Outward: ${fmtN(cat.outward_qty, 1)} (${fmtCur(cat.outward_value)}) | Inward: ${fmtN(cat.inward_qty, 1)} (${fmtCur(cat.inward_value)})`)
      })
    } else {
      lines.push(`• No store movement recorded today.`)
    }
  }

  // Section 6: Purchase Orders Done
  if (cfg.showPurchaseOrders) {
    lines.push(``)
    lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
    lines.push(`🛒 *6. PURCHASE ORDERS RELEASED (${purchases.length} POs)*`)
    if (purchases.length > 0) {
      purchases.forEach(po => {
        lines.push(`• *${po.po_number}*: ${po.vendor_name || 'Vendor'} — *${fmtCur(po.grand_total || po.total_value)}* [${po.status}] (${po.items_count} items)`)
      })
    } else {
      lines.push(`• No purchase orders raised today.`)
    }
  }

  // Section 7: Inward GRNs Received Against PO
  if (cfg.showInwardGRN) {
    lines.push(``)
    lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
    lines.push(`📥 *7. INWARD GRN RECEIPTS AGAINST PO (${inwardGRNs.length} GRNs)*`)
    if (inwardGRNs.length > 0) {
      inwardGRNs.slice(0, 6).forEach(grn => {
        const poRef = grn.po_number ? ` [PO: ${grn.po_number}]` : (grn.remarks?.includes('Ref:') ? ` [${grn.remarks.split('|')[1]?.trim() || ''}]` : '')
        const secTag = grn.section_name ? ` [🏭 ${grn.section_name}${grn.machine_name ? ` › ${grn.machine_name}` : ''}]` : ''
        lines.push(`• *${grn.mat_name}* (${fmtN(grn.in_qty, 1)} ${grn.uom}) from *${grn.vendor_name || 'Vendor'}*${secTag} — *${fmtCur(grn.value)}*${poRef}`)
      })
      if (inwardGRNs.length > 6) lines.push(`  _...and ${inwardGRNs.length - 6} more inward receipts_`)
    } else {
      lines.push(`• No inward GRN receipts recorded today.`)
    }
  }

  // Section 8: Outward Store Issues
  if (cfg.showOutwardIssues) {
    lines.push(``)
    lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
    lines.push(`📤 *8. OUTWARD MATERIAL ISSUES (${outwardIssues.length} Items · ${fmtCur(s.stockIssueValue)})*`)
    if (outwardIssues.length > 0) {
      outwardIssues.slice(0, 6).forEach(iss => {
        const secTag = iss.section_name ? ` [🏭 ${iss.section_name}${iss.machine_name ? ` › ${iss.machine_name}` : ''}]` : ''
        lines.push(`• *${iss.mat_name}* (${fmtN(iss.out_qty, 1)} ${iss.uom}) ➔ *${iss.dept_name}*${secTag} (${fmtCur(iss.value)})`)
      })
      if (outwardIssues.length > 6) lines.push(`  _...and ${outwardIssues.length - 6} more outward items_`)
    } else {
      lines.push(`• No outward material issues recorded today.`)
    }
  }

  // Section 9: Maintenance & Downtime
  if (cfg.showDowntime && m.downtimeMin > 0) {
    lines.push(``)
    lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
    lines.push(`🔧 *9. MAINTENANCE & DOWNTIME SUMMARY*`)
    lines.push(`• Total Downtime: *${m.downtimeMin} mins* | Breakdowns: *${m.breakdowns || 0}*`)
    lines.push(`• Affected Machinery: *${m.affectedMachines || 'None'}*`)
  }

  // Section 10: Custom Store Manager Remarks
  if (cfg.showCustomRemarks && cfg.customRemarks && cfg.customRemarks.trim()) {
    lines.push(``)
    lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
    lines.push(`💬 *STORE MANAGER OPERATIONAL NOTES*`)
    lines.push(`${cfg.customRemarks.trim()}`)
  }

  // Section 11: Sign-off & System Footer
  if (cfg.showFooter) {
    lines.push(``)
    lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
    if (cfg.senderSignOff && cfg.senderSignOff.trim()) {
      lines.push(`✍️ _Dispatched by: ${cfg.senderSignOff.trim()}_`)
    }
    lines.push(`_MK Paper Mill ERP · Enterprise Automated Dispatch_`)
  }

  return lines.join('\n')
}

const API = (p, o) => fetch(p, {
  headers: {
    Authorization: `Bearer ${localStorage.getItem('mk_token')}`,
    'Content-Type': 'application/json',
    ...(o?.headers || {})
  },
  ...o
}).then(r => r.json())

const fmt = v => v != null ? `₹${Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—'
const fmtNum = (v, d = 2) => v != null && !isNaN(v) ? Number(v).toLocaleString('en-IN', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—'

const today = new Date().toISOString().slice(0, 10)
const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
const monthStart = today.slice(0, 7) + '-01'
const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10)

// Maps frontend granular module ids -> backend reports.js route slugs
const GRANULAR_ENDPOINTS = {
  plantSectionsDetailed: 'plant-sections/detailed',
  hrDetailed: 'hr-detailed',
  maintenanceDetailed: 'maintenance-detailed',
  purchaseDetailed: 'purchase-detailed',
  financeDetailed: 'finance-detailed',
  ehsDetailed: 'ehs-detailed',
}

const REPORT_MODULES = [
  { id: 'eod', label: 'EOD Activity (WhatsApp)', icon: WhatsAppIcon, desc: 'Complete daily activity, indents by dept, store movements & 1-click WhatsApp routing', group: 'Executive / Daily' },
  { id: 'plantSectionsDetailed', label: 'Plant Section & Granularity', icon: Layers, desc: 'Section & equipment-level inventory, consumption, inward receipts & valuation matrix', group: 'Materials', granular: true },
  { id: 'stores', label: 'Stores & Inventory', icon: Boxes, desc: 'Mechanical, Electrical, Chemicals, stock balances & value', group: 'Materials' },
  { id: 'indents', label: 'Indents & Store Issues', icon: ShoppingCart, desc: 'Department store indents, approvals & fulfillment', group: 'Materials' },
  { id: 'production', label: 'Production & DPR', icon: Factory, desc: 'Reels, machine output, GSM, efficiency & downtime', group: 'Operations' },
  { id: 'quality', label: 'Quality & Lab Tests', icon: BadgeCheck, desc: 'Reel testing, GSM, moisture, burst factor & pass rates', group: 'Operations' },
  { id: 'utility', label: 'Utility, Power & Boiler', icon: Zap, desc: 'Power units, steam generation, coal ratio & water usage', group: 'Operations' },
  { id: 'downtime', label: 'Maintenance & Downtime', icon: Wrench, desc: 'Machine breakdowns, MTTR, MTBF & reason categories', group: 'Operations' },
  { id: 'sales', label: 'Sales & Dispatches', icon: Truck, desc: 'Sales orders, invoiced dispatches & customer fulfillment', group: 'Commercial' },
  { id: 'hr', label: 'HR & Attendance', icon: UsersRound, desc: 'Department headcount, shift attendance & late turnout', group: 'People' },
  // ── Granular department deep-dive reports ──────────────────────────────────
  { id: 'purchaseDetailed', label: 'Purchase Deep Dive', icon: ShoppingCart, desc: 'PO cycle time, vendor performance, pending PO aging & spend by category', group: 'Materials', granular: true },
  { id: 'maintenanceDetailed', label: 'Maintenance Deep Dive', icon: Wrench, desc: 'PM completion, MTTR/MTBF, breakdown frequency, spares consumption & cost/section', group: 'Operations', granular: true },
  { id: 'financeDetailed', label: 'Finance Deep Dive', icon: TrendingUp, desc: 'Payment aging, pending vs confirmed, dept spend rollup & cash outflow trend', group: 'Commercial', granular: true },
  { id: 'hrDetailed', label: 'HR Deep Dive', icon: UsersRound, desc: 'Attendance %, leave utilization, payroll cost & headcount trend by employee', group: 'People', granular: true },
  { id: 'ehsDetailed', label: 'EHS Deep Dive', icon: ShieldCheck, desc: 'Near-miss trend, incident rate & specific power consumption trend', group: 'Operations', granular: true },
]

export default function Reports() {
  const { user } = useAuth()
  const roleLevel = user?.role_level || 1
  const userDept = user?.department || ''

  // Department-scoped report modules — EOD Activity (WhatsApp) is available to all users
  const allowedModules = useMemo(() => {
    // 1. Admin (L5) & Plant Head (L4) see all reports
    if (roleLevel >= 4) return REPORT_MODULES

    // 2. Store Management & Inventory & Raw Material Store & Purchase -> EOD, Stores, Indents + Purchase Deep Dive + Plant Sections
    if (['Store Management', 'Store', 'Inventory', 'Raw Material Store', 'Purchase'].includes(userDept)) {
      return REPORT_MODULES.filter(m => ['eod', 'plantSectionsDetailed', 'stores', 'indents', 'purchaseDetailed'].includes(m.id))
    }

    // 3. Production -> EOD, Production & Downtime + Plant Sections
    if (userDept === 'Production') {
      return REPORT_MODULES.filter(m => ['eod', 'plantSectionsDetailed', 'production', 'downtime'].includes(m.id))
    }

    // 4. Quality & Laboratory -> EOD & Quality
    if (['Quality', 'Laboratory'].includes(userDept)) {
      return REPORT_MODULES.filter(m => ['eod', 'quality'].includes(m.id))
    }

    // 5. Maintenance -> EOD, Downtime, Stores + Maintenance Deep Dive + Plant Sections
    if (userDept === 'Maintenance') {
      return REPORT_MODULES.filter(m => ['eod', 'plantSectionsDetailed', 'downtime', 'stores', 'maintenanceDetailed'].includes(m.id))
    }

    // 6. Utility -> EOD & Utility + Plant Sections
    if (userDept === 'Utility') {
      return REPORT_MODULES.filter(m => ['eod', 'plantSectionsDetailed', 'utility'].includes(m.id))
    }

    // 7. Sales & Dispatch -> EOD, Sales + Finance Deep Dive
    if (['Sales', 'Dispatch', 'Commercial', 'Finished Goods Warehouse'].includes(userDept)) {
      return REPORT_MODULES.filter(m => ['eod', 'sales', 'financeDetailed'].includes(m.id))
    }

    // 7b. Finance -> EOD & Finance Deep Dive
    if (userDept === 'Finance') {
      return REPORT_MODULES.filter(m => ['eod', 'financeDetailed'].includes(m.id))
    }

    // 8. HR -> EOD, HR + HR Deep Dive
    if (['HR & Payroll', 'HR', 'Security'].includes(userDept)) {
      return REPORT_MODULES.filter(m => ['eod', 'hr', 'hrDetailed'].includes(m.id))
    }

    // 8b. EHS -> EOD & EHS Deep Dive
    if (userDept === 'EHS') {
      return REPORT_MODULES.filter(m => ['eod', 'ehsDetailed'].includes(m.id))
    }

    // Fallback: EOD, Stores & Indents
    return REPORT_MODULES.filter(m => ['eod', 'stores', 'indents'].includes(m.id))
  }, [roleLevel, userDept])

  const [activeModule, setActiveModule] = useState(() => allowedModules[0]?.id || 'eod')

  // Auto-switch if activeModule is not in allowed list
  useEffect(() => {
    if (!allowedModules.some(m => m.id === activeModule)) {
      setActiveModule(allowedModules[0]?.id || 'eod')
    }
  }, [allowedModules, activeModule])

  const [from, setFrom] = useState(today)
  const [to, setTo] = useState(today)
  const [datePreset, setDatePreset] = useState('today')
  const [searchTerm, setSearchTerm] = useState('')
  const [storeFilter, setStoreFilter] = useState('')
  const [lowStockOnly, setLowStockOnly] = useState(false)
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState(null)
  const [err, setErr] = useState('')

  // Granular deep-dive report filters
  const [deptList, setDeptList] = useState([])
  const [deptFilter, setDeptFilter] = useState('')
  const [machineFilter, setMachineFilter] = useState('')
  const [vendorFilter, setVendorFilter] = useState('')

  // Load department list once (used by granular reports for slicing)
  useEffect(() => {
    API('/api/admin/departments').then(res => {
      if (res.success) setDeptList(res.data || res.departments || [])
      else if (Array.isArray(res)) setDeptList(res)
    }).catch(() => { })
  }, [])

  // L3 Dept Head default: pre-select own department on granular reports
  useEffect(() => {
    if (roleLevel === 3 && user?.department_id) {
      setDeptFilter(String(user.department_id))
    }
  }, [roleLevel, user])

  // EOD Send Modal state
  const [eodModal, setEodModal] = useState(false)
  const [eodSending, setEodSending] = useState(false)
  const [eodSuccessMsg, setEodSuccessMsg] = useState('')
  const [eodRecipients, setEodRecipients] = useState('Directors / Plant Head / HODs')
  const [eodNotes, setEodNotes] = useState('')
  const [eodHistory, setEodHistory] = useState([])

  // WhatsApp EOD Studio State & Handlers
  const [whatsAppModal, setWhatsAppModal] = useState(false)
  const [waConfig, setWaConfig] = useState(() => {
    try {
      const saved = localStorage.getItem('mk_wa_eod_config')
      if (saved) return JSON.parse(saved)
    } catch (e) { }
    return DEFAULT_WA_CONFIG
  })
  const [isDirectEdit, setIsDirectEdit] = useState(false)
  const [customDraftText, setCustomDraftText] = useState('')
  const [whatsAppCopied, setWhatsAppCopied] = useState(false)
  const [savedSettingsToast, setSavedSettingsToast] = useState(false)
  const [exportModal, setExportModal] = useState(false)

  // Sync draft text when waConfig changes (if not in direct edit mode)
  useEffect(() => {
    if (data && !isDirectEdit) {
      setCustomDraftText(generateWhatsAppEodText(data, waConfig))
    }
  }, [data, waConfig, isDirectEdit])

  const handleApplyPreset = (presetId) => {
    const preset = WA_PRESETS.find(p => p.id === presetId)
    if (preset) {
      setWaConfig(prev => preset.apply(prev))
      setIsDirectEdit(false)
    }
  }

  const handleSaveDefaultSettings = () => {
    try {
      localStorage.setItem('mk_wa_eod_config', JSON.stringify(waConfig))
      setSavedSettingsToast(true)
      setTimeout(() => setSavedSettingsToast(false), 2500)
    } catch (e) {
      alert('Could not save settings to local storage')
    }
  }

  const handleResetDefaultSettings = () => {
    setWaConfig(DEFAULT_WA_CONFIG)
    setIsDirectEdit(false)
    try {
      localStorage.removeItem('mk_wa_eod_config')
    } catch (e) { }
  }

  const activeMessageText = useMemo(() => {
    if (!data) return ''
    if (isDirectEdit) return customDraftText
    return generateWhatsAppEodText(data, waConfig)
  }, [data, waConfig, isDirectEdit, customDraftText])

  const handleOpenWhatsApp = (phoneOverride) => {
    if (!activeMessageText) return
    const phone = phoneOverride !== undefined ? phoneOverride : (waConfig.phone || '')
    const clean = phone ? phone.replace(/[^0-9]/g, '') : ''
    const url = clean
      ? `https://wa.me/${clean}?text=${encodeURIComponent(activeMessageText)}`
      : `https://api.whatsapp.com/send?text=${encodeURIComponent(activeMessageText)}`
    window.open(url, '_blank')
  }

  const handleCopyWhatsAppText = () => {
    if (!activeMessageText) return
    navigator.clipboard.writeText(activeMessageText)
    setWhatsAppCopied(true)
    setTimeout(() => setWhatsAppCopied(false), 2500)
  }

  const triggerOpenWhatsApp = async () => {
    if (activeModule === 'eod' && data) {
      setWhatsAppModal(true)
    } else {
      setLoading(true)
      try {
        const res = await API(`/api/reports/eod?date=${from}`)
        if (res.success) {
          setData(res.data)
          setActiveModule('eod')
          setWhatsAppModal(true)
        } else {
          alert('Could not compile EOD data for WhatsApp')
        }
      } catch (e) {
        alert('Error preparing WhatsApp EOD data')
      }
      setLoading(false)
    }
  }

  const applyPreset = (preset) => {
    setDatePreset(preset)
    if (preset === 'today') {
      setFrom(today); setTo(today)
    } else if (preset === 'yesterday') {
      setFrom(yesterday); setTo(yesterday)
    } else if (preset === 'week') {
      setFrom(sevenDaysAgo); setTo(today)
    } else if (preset === 'month') {
      setFrom(monthStart); setTo(today)
    }
  }

  const loadReport = useCallback(async () => {
    setLoading(true)
    setErr('')
    try {
      let endpoint = ''
      if (activeModule === 'eod') {
        endpoint = `/api/reports/eod?date=${from}`
      } else if (activeModule === 'stores') {
        const params = new URLSearchParams()
        if (storeFilter) params.set('store_type', storeFilter)
        if (lowStockOnly) params.set('low_stock', 'true')
        if (searchTerm) params.set('search', searchTerm)
        endpoint = `/api/reports/stores?${params}`
      } else if (activeModule === 'downtime') {
        endpoint = `/api/reports/downtime?from=${from}&to=${to}`
      } else if (activeModule === 'indents') {
        endpoint = `/api/reports/indents?from=${from}&to=${to}`
      } else if (GRANULAR_ENDPOINTS[activeModule]) {
        const params = new URLSearchParams({ from, to })
        if (deptFilter) params.set('department_id', deptFilter)
        if (activeModule === 'maintenanceDetailed' && machineFilter) params.set('machine_id', machineFilter)
        if (activeModule === 'purchaseDetailed' && vendorFilter) params.set('vendor_id', vendorFilter)
        endpoint = `/api/reports/${GRANULAR_ENDPOINTS[activeModule]}?${params}`
      } else {
        endpoint = `/api/reports/${activeModule}?from=${from}&to=${to}`
      }

      const res = await API(endpoint)
      if (res.success) {
        setData(res.data)
      } else {
        setErr(res.message || 'Failed to generate report')
        setData(null)
      }
    } catch (e) {
      setErr('Network or server error while generating report')
      setData(null)
    }
    setLoading(false)
  }, [activeModule, from, to, storeFilter, lowStockOnly, searchTerm, deptFilter, machineFilter, vendorFilter])

  useEffect(() => {
    loadReport()
  }, [loadReport])

  // Load EOD history when on EOD module
  const loadEodHistory = useCallback(async () => {
    if (activeModule === 'eod') {
      const res = await API('/api/reports/eod/history')
      if (res.success) setEodHistory(res.data)
    }
  }, [activeModule])

  useEffect(() => {
    loadEodHistory()
  }, [loadEodHistory])

  const triggerSendEOD = async () => {
    setEodSending(true)
    setEodSuccessMsg('')
    try {
      const res = await API('/api/reports/eod/send', {
        method: 'POST',
        body: JSON.stringify({
          date: from,
          recipients: eodRecipients,
          notes: eodNotes
        })
      })
      if (res.success) {
        setEodSuccessMsg(res.message)
        loadEodHistory()
        setTimeout(() => setEodModal(false), 2000)
      } else {
        alert(res.message || 'Error dispatching EOD report')
      }
    } catch (e) {
      alert('Error sending EOD report')
    }
    setEodSending(false)
  }

  const downloadCSV = async () => {
    let endpoint = ''
    if (activeModule === 'eod') {
      endpoint = `/api/reports/eod?date=${from}&format=csv`
    } else if (activeModule === 'stores') {
      const p = new URLSearchParams({ format: 'csv' })
      if (storeFilter) p.set('store_type', storeFilter)
      if (lowStockOnly) p.set('low_stock', 'true')
      endpoint = `/api/reports/stores?${p}`
    } else if (activeModule === 'downtime') {
      endpoint = `/api/reports/downtime?from=${from}&to=${to}&format=csv`
    } else if (activeModule === 'indents') {
      endpoint = `/api/reports/indents?from=${from}&to=${to}&format=csv`
    } else if (GRANULAR_ENDPOINTS[activeModule]) {
      const p = new URLSearchParams({ from, to, format: 'csv' })
      if (deptFilter) p.set('department_id', deptFilter)
      if (activeModule === 'maintenanceDetailed' && machineFilter) p.set('machine_id', machineFilter)
      if (activeModule === 'purchaseDetailed' && vendorFilter) p.set('vendor_id', vendorFilter)
      endpoint = `/api/reports/${GRANULAR_ENDPOINTS[activeModule]}?${p}`
    } else {
      endpoint = `/api/reports/${activeModule}?from=${from}&to=${to}&format=csv`
    }

    const res = await fetch(endpoint, {
      headers: { Authorization: `Bearer ${localStorage.getItem('mk_token')}` }
    })
    if (!res.ok) {
      alert('CSV export failed')
      return
    }
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `MKPM_${activeModule.toUpperCase()}_REPORT_${from}_${to}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handlePrint = () => window.print()

  return (
    <div style={S.page}>
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .mk-print-area, .mk-print-area * { visibility: visible; }
          .mk-print-area { position: absolute; left: 0; top: 0; width: 100%; }
          .mk-no-print { display: none !important; }
          table { page-break-inside: auto; }
          tr { page-break-inside: avoid; page-break-after: auto; }
        }
      `}</style>
      {/* Top Main Header */}
      <div style={S.headerBar}>
        <div>
          <div style={S.title}>{userDept ? `${userDept} Reports & Analytics` : 'Reports & Analytics Hub'}</div>
          <div style={S.subtitle}>
            {roleLevel >= 4
              ? 'Complete mill reporting, live store ledgers & one-click End-Of-Day (EOD) WhatsApp dispatch'
              : `${userDept} departmental reports, live movements, store ledgers and WhatsApp EOD`}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }} className="mk-no-print">
          <button
            style={S.btnWhatsApp}
            onClick={triggerOpenWhatsApp}
            title="Send formatted End-of-Day Activity Report via WhatsApp"
          >
            <WhatsAppIcon size={16} color="#fff" /> Send on WhatsApp
          </button>
          {activeModule === 'eod' && (
            <button
              style={S.btnSecondary}
              onClick={handleCopyWhatsAppText}
              title="Copy WhatsApp formatted message"
            >
              {whatsAppCopied ? <Check size={15} color="#16a34a" /> : <Copy size={15} />}
              {whatsAppCopied ? 'Copied!' : 'Copy WA Text'}
            </button>
          )}
          {roleLevel >= 4 && activeModule === 'eod' && (
            <button
              style={S.btnEodAction}
              onClick={() => { setEodModal(true); setEodSuccessMsg('') }}
              title="Compile and dispatch complete End of Day report for the entire mill in one click"
            >
              <Send size={15} /> Archive EOD
            </button>
          )}
          <button
            style={{ ...S.btnSecondary, background: '#f0fdfa', borderColor: '#0f766e', color: '#0f766e', fontWeight: 700 }}
            onClick={() => setExportModal(true)}
            title="Download Comprehensive Multi-Sheet Excel Master"
          >
            <FileSpreadsheet size={15} /> Excel Master Export
          </button>
          <button style={S.btnSecondary} onClick={handlePrint}>
            <Printer size={15} /> Print / PDF
          </button>
          <button style={S.btnSecondary} onClick={downloadCSV}>
            <Download size={15} /> Export CSV
          </button>
          <button style={S.btnIcon} onClick={loadReport} title="Refresh data">
            <RefreshCw size={15} />
          </button>
        </div>
      </div>

      {/* Main Layout: Left Sidebar + Right Content Area */}
      <div style={S.layoutGrid}>
        {/* Left Reports Category Sidebar */}
        <div style={S.sidebar} className="mk-no-print">
          <div style={S.sidebarTitle}>Department Reports</div>
          <div style={S.sidebarNav}>
            {allowedModules.map(m => {
              const Icon = m.icon
              const isActive = activeModule === m.id
              const isWhatsApp = m.id === 'eod'
              return (
                <button
                  key={m.id}
                  style={{
                    ...S.navBtn,
                    ...(isActive ? S.navBtnActive : {}),
                    ...(isWhatsApp && !isActive ? { background: '#f0fdf4', border: '1px solid #bbf7d0' } : {}),
                    ...(isWhatsApp && isActive ? { background: '#166534', color: '#fff' } : {})
                  }}
                  onClick={() => { setActiveModule(m.id); setSearchTerm('') }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                      ...S.iconBox,
                      background: isWhatsApp ? '#25D366' : (isActive ? '#1b1b1d' : '#f0eee6'),
                      color: isWhatsApp ? '#fff' : (isActive ? '#fff' : '#1b1b1d')
                    }}>
                      <Icon size={16} color={isWhatsApp ? '#fff' : 'currentColor'} />
                    </div>
                    <div style={{ textAlign: 'left' }}>
                      <div style={{
                        fontSize: 13,
                        fontWeight: isActive ? 700 : 600,
                        color: isWhatsApp && isActive ? '#fff' : (isActive ? '#1b1b1d' : (isWhatsApp ? '#166534' : '#4b5563')),
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6
                      }}>
                        {m.label}
                        {isWhatsApp && (
                          <span style={{
                            background: isActive ? '#25D366' : '#22c55e',
                            color: '#fff',
                            fontSize: 9,
                            fontWeight: 800,
                            padding: '1px 5px',
                            borderRadius: 4,
                            textTransform: 'uppercase'
                          }}>
                            WA
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 10, color: isWhatsApp && isActive ? '#bbf7d0' : '#8a8a90', lineHeight: 1.2 }}>
                        {m.group}
                      </div>
                    </div>
                  </div>
                  {isActive && <div style={{ ...S.activeIndicator, background: isWhatsApp ? '#25D366' : '#1b1b1d' }} />}
                </button>
              )
            })}
          </div>

          {/* Quick WhatsApp Action Card in Sidebar */}
          <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 10, padding: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: 12, color: '#166534' }}>
              <WhatsAppIcon size={16} color="#25D366" /> WhatsApp EOD Digest
            </div>
            <div style={{ fontSize: 11, color: '#4b5563', lineHeight: 1.4 }}>
              Broadcast full mill activity (indents, inward/outward, POs & production).
            </div>
            <button
              style={{ ...S.btnWhatsApp, width: '100%', justifyContent: 'center', padding: '8px 10px', fontSize: 12, marginTop: 4 }}
              onClick={triggerOpenWhatsApp}
            >
              <WhatsAppIcon size={15} color="#fff" /> Open WhatsApp EOD
            </button>
          </div>

          {/* Quick Info Box in Sidebar */}
          <div style={S.sidebarFooterCard}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: 11, color: '#166534', marginBottom: 4 }}>
              <ShieldCheck size={14} /> LIVE REPOSITORIES
            </div>
            <div style={{ fontSize: 11, color: '#4b5563', lineHeight: 1.4 }}>
              All stores (Mechanical, Electrical, Chemicals) & live telemetry sync with Mill Ledger.
            </div>
          </div>
        </div>

        {/* Right Content Area */}
        <div style={S.contentPane} className="mk-print-area">
          {/* Controls Bar: Presets, Date Pickers, Filters */}
          <div style={S.filterCard} className="mk-no-print">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase' }}>Range:</span>
              <button style={{ ...S.presetBtn, ...(datePreset === 'today' ? S.presetActive : {}) }} onClick={() => applyPreset('today')}>Today</button>
              <button style={{ ...S.presetBtn, ...(datePreset === 'yesterday' ? S.presetActive : {}) }} onClick={() => applyPreset('yesterday')}>Yesterday</button>
              <button style={{ ...S.presetBtn, ...(datePreset === 'week' ? S.presetActive : {}) }} onClick={() => applyPreset('week')}>Last 7 Days</button>
              <button style={{ ...S.presetBtn, ...(datePreset === 'month' ? S.presetActive : {}) }} onClick={() => applyPreset('month')}>Month to Date</button>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
              {activeModule === 'eod' ? (
                <label style={S.filterLabel}>
                  EOD Target Date:
                  <input style={S.dateInput} type="date" value={from} onChange={e => { setFrom(e.target.value); setDatePreset('custom') }} />
                </label>
              ) : (
                <>
                  <label style={S.filterLabel}>
                    From:
                    <input style={S.dateInput} type="date" value={from} onChange={e => { setFrom(e.target.value); setDatePreset('custom') }} />
                  </label>
                  <label style={S.filterLabel}>
                    To:
                    <input style={S.dateInput} type="date" value={to} onChange={e => { setTo(e.target.value); setDatePreset('custom') }} />
                  </label>
                </>
              )}

              {activeModule === 'stores' && (
                <>
                  <select style={S.select} value={storeFilter} onChange={e => setStoreFilter(e.target.value)}>
                    <option value="">All Stores</option>
                    <option value="Mechanical">Mechanical Store</option>
                    <option value="Electrical">Electrical Store</option>
                    <option value="Chemical">Chemical Store</option>
                    <option value="Raw Material">Raw Material</option>
                    <option value="Consumable">General / Consumable</option>
                  </select>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: '#dc2626', cursor: 'pointer' }}>
                    <input type="checkbox" checked={lowStockOnly} onChange={e => setLowStockOnly(e.target.checked)} />
                    Below Reorder Only
                  </label>
                </>
              )}

              {GRANULAR_ENDPOINTS[activeModule] && (
                <select style={S.select} value={deptFilter} onChange={e => setDeptFilter(e.target.value)}>
                  <option value="">{roleLevel >= 4 ? 'All Departments' : 'My Department'}</option>
                  {deptList.map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              )}

              {activeModule === 'maintenanceDetailed' && (
                <input
                  style={S.input}
                  placeholder="Machine ID (optional)"
                  value={machineFilter}
                  onChange={e => setMachineFilter(e.target.value)}
                />
              )}

              {activeModule === 'purchaseDetailed' && (
                <input
                  style={S.input}
                  placeholder="Vendor ID (optional)"
                  value={vendorFilter}
                  onChange={e => setVendorFilter(e.target.value)}
                />
              )}

              <div style={{ position: 'relative', minWidth: 200 }}>
                <Search size={14} style={{ position: 'absolute', left: 8, top: 9, color: '#9ca3af' }} />
                <input
                  style={{ ...S.input, paddingLeft: 28 }}
                  placeholder="Filter table content..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                />
              </div>

              <button style={S.btnPrimary} onClick={loadReport} disabled={loading}>
                {loading ? 'Compiling...' : 'Run Query'}
              </button>
            </div>
          </div>

          {/* Error Message */}
          {err && <div style={S.errorBox}>{err}</div>}

          {/* Loading Indicator */}
          {loading && (
            <div style={S.loadingCard}>
              <RefreshCw size={24} style={{ animation: 'spin 1s linear infinite' }} />
              <div>Compiling data across mill registers...</div>
            </div>
          )}

          {/* Report Views */}
          {!loading && data && (
            <div>
              {activeModule === 'eod' && (
                <EodReportView
                  data={data}
                  history={eodHistory}
                  onOpenSend={() => setEodModal(true)}
                  onOpenWhatsApp={() => setWhatsAppModal(true)}
                  onCopyWhatsApp={handleCopyWhatsAppText}
                  whatsAppCopied={whatsAppCopied}
                />
              )}
              {activeModule === 'production' && <ProductionReportView data={data} search={searchTerm} />}
              {activeModule === 'stores' && <StoresReportView data={data} search={searchTerm} />}
              {activeModule === 'quality' && <QualityReportView data={data} search={searchTerm} />}
              {activeModule === 'utility' && <UtilityReportView data={data} search={searchTerm} />}
              {activeModule === 'downtime' && <DowntimeReportView data={data} search={searchTerm} />}
              {activeModule === 'plantSectionsDetailed' && <PlantSectionsDetailedReportView data={data} search={searchTerm} />}
              {activeModule === 'indents' && <IndentsReportView data={data} search={searchTerm} />}
              {activeModule === 'sales' && <SalesReportView data={data} search={searchTerm} />}
              {activeModule === 'hr' && <HrReportView data={data} search={searchTerm} />}
              {activeModule === 'hrDetailed' && <HrDetailedReportView data={data} search={searchTerm} />}
              {activeModule === 'maintenanceDetailed' && <MaintenanceDetailedReportView data={data} search={searchTerm} />}
              {activeModule === 'purchaseDetailed' && <PurchaseDetailedReportView data={data} search={searchTerm} />}
              {activeModule === 'financeDetailed' && <FinanceDetailedReportView data={data} search={searchTerm} />}
              {activeModule === 'ehsDetailed' && <EhsDetailedReportView data={data} search={searchTerm} />}
            </div>
          )}
        </div>
      </div>

      {/* WhatsApp Customization Studio & Dispatch Modal */}
      {whatsAppModal && (
        <div style={S.modalOverlay} onClick={() => setWhatsAppModal(false)}>
          <div style={{ ...S.modalCard, maxWidth: 980, width: '95vw', maxHeight: '92vh', display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
            {/* Modal Header */}
            <div style={{ ...S.modalHeader, padding: '18px 24px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', margin: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ background: '#25D366', color: '#fff', padding: 9, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 6px rgba(37,211,102,0.3)' }}>
                  <WhatsAppIcon size={24} color="#fff" />
                </div>
                <div>
                  <div style={{ fontSize: 17, fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8 }}>
                    WhatsApp EOD Activity Customization & Dispatch Studio
                    <span style={{ fontSize: 11, fontWeight: 700, background: '#dcfce7', color: '#15803d', padding: '2px 8px', borderRadius: 999 }}>
                      Store Flow
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                    Customize report sections, add store remarks, choose contacts, or edit message before sending.
                  </div>
                </div>
              </div>
              <button style={{ ...S.modalClose, fontSize: 20, padding: 6 }} onClick={() => setWhatsAppModal(false)}>✕</button>
            </div>

            {/* Modal Body: 2-Column Responsive Layout */}
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 1fr) minmax(360px, 1.15fr)', gap: 0, flex: 1, overflow: 'hidden', background: '#fff' }}>

              {/* Left Column: Customization Controls */}
              <div style={{ padding: '20px 24px', borderRight: '1px solid #e2e8f0', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 18, maxHeight: 'calc(92vh - 140px)' }}>

                {/* 1. Presets */}
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: '#475569', letterSpacing: '0.04em', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                    ⚡ 1. Choose Message Template Preset:
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    {WA_PRESETS.map(pr => {
                      const isSel = waConfig.template === pr.id
                      return (
                        <button
                          key={pr.id}
                          type="button"
                          style={{
                            padding: '10px 12px',
                            borderRadius: 8,
                            border: isSel ? '2px solid #16a34a' : '1px solid #e2e8f0',
                            background: isSel ? '#f0fdf4' : '#f8fafc',
                            cursor: 'pointer',
                            textAlign: 'left',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 3,
                            transition: 'all 0.15s'
                          }}
                          onClick={() => handleApplyPreset(pr.id)}
                        >
                          <div style={{ fontSize: 12, fontWeight: isSel ? 700 : 600, color: isSel ? '#166534' : '#1e293b' }}>
                            {pr.label}
                          </div>
                          <div style={{ fontSize: 10, color: '#64748b', lineHeight: 1.2 }}>
                            {pr.desc}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* 2. Granular Sections Toggle */}
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: '#475569', letterSpacing: '0.04em', marginBottom: 8 }}>
                    📋 2. Operational Sections Included:
                  </div>
                  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {[
                      { key: 'showProductionPower', label: 'Plant Production & Power Units', count: `${data?.production?.totalMt || 0} MT`, icon: '📊' },
                      { key: 'showIndentsSummary', label: 'Department Indents Raised & ₹ Values', count: `${data?.indentsByDept?.length || 0} depts`, icon: '📑' },
                      { key: 'showIndentsDetailed', label: 'Itemized Key Indents List', count: `${data?.indentsList?.length || 0} indents`, icon: '📋', indent: true },
                      { key: 'showCategoryStore', label: 'Category-Wise Store Movements (Valuations)', count: `${data?.categoryWiseStore?.length || 0} cats`, icon: '🏷️' },
                      { key: 'showPurchaseOrders', label: 'Purchase Orders Done (POs & Vendors)', count: `${data?.purchases?.length || 0} POs`, icon: '🛒' },
                      { key: 'showInwardGRN', label: 'Inward GRN Received Against POs', count: `${data?.inwardGRNs?.length || 0} GRNs`, icon: '📥' },
                      { key: 'showOutwardIssues', label: 'Store Outward Material Issuance', count: `${data?.outwardIssues?.length || 0} items`, icon: '📤' },
                      { key: 'showFooter', label: 'Sign-off & System Timestamp Footer', count: 'ERP', icon: '✍️' },
                    ].map(sec => (
                      <label
                        key={sec.key}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '6px 8px',
                          borderRadius: 6,
                          background: waConfig[sec.key] ? '#fff' : 'transparent',
                          border: waConfig[sec.key] ? '1px solid #cbd5e1' : '1px solid transparent',
                          marginLeft: sec.indent ? 16 : 0,
                          cursor: 'pointer',
                          fontSize: 12,
                          color: waConfig[sec.key] ? '#0f172a' : '#94a3b8'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <input
                            type="checkbox"
                            checked={!!waConfig[sec.key]}
                            onChange={e => {
                              setWaConfig(prev => ({ ...prev, [sec.key]: e.target.checked, template: 'custom' }))
                              setIsDirectEdit(false)
                            }}
                            style={{ cursor: 'pointer', accentColor: '#16a34a' }}
                          />
                          <span>{sec.icon} {sec.label}</span>
                        </div>
                        <span style={{ fontSize: 10.5, fontWeight: 700, background: waConfig[sec.key] ? '#f1f5f9' : '#e2e8f0', color: '#475569', padding: '2px 6px', borderRadius: 4 }}>
                          {sec.count}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* 3. Store Manager Remarks */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: '#475569', letterSpacing: '0.04em' }}>
                      💬 3. Store Manager Daily Remarks:
                    </span>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#64748b', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={!!waConfig.showCustomRemarks}
                        onChange={e => setWaConfig(prev => ({ ...prev, showCustomRemarks: e.target.checked }))}
                        style={{ accentColor: '#16a34a' }}
                      />
                      Include in WA
                    </label>
                  </div>
                  <textarea
                    rows={3}
                    style={{ ...S.input, width: '100%', resize: 'vertical', fontSize: 12, lineHeight: 1.4, fontFamily: 'inherit' }}
                    placeholder="e.g. Physical inventory check for Mechanical store completed. Urgent boiler chemical PO pending approval."
                    value={waConfig.customRemarks || ''}
                    onChange={e => {
                      setWaConfig(prev => ({ ...prev, customRemarks: e.target.value }))
                      setIsDirectEdit(false)
                    }}
                  />
                  {/* Quick Starter Chips */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 6 }}>
                    {[
                      '✅ Stock audit completed',
                      '⚠️ Urgent PO approval required',
                      '📦 Reorder level reached for chemicals',
                      '🔧 Spares issued for shutdown work',
                    ].map(chip => (
                      <button
                        key={chip}
                        type="button"
                        style={{
                          fontSize: 10.5,
                          background: '#f1f5f9',
                          border: '1px solid #cbd5e1',
                          borderRadius: 999,
                          padding: '3px 8px',
                          color: '#334155',
                          cursor: 'pointer',
                        }}
                        onClick={() => {
                          const existing = waConfig.customRemarks || ''
                          const updated = existing ? `${existing}\n• ${chip}` : `• ${chip}`
                          setWaConfig(prev => ({ ...prev, customRemarks: updated, showCustomRemarks: true }))
                          setIsDirectEdit(false)
                        }}
                      >
                        {chip}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 4. Recipient Phone Book */}
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: '#475569', letterSpacing: '0.04em', marginBottom: 6 }}>
                    📱 4. Recipient Phone Book:
                  </div>
                  <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                    <select
                      style={{ ...S.select, flex: 1, fontSize: 12 }}
                      onChange={e => {
                        if (e.target.value) setWaConfig(prev => ({ ...prev, phone: e.target.value }))
                      }}
                      defaultValue=""
                    >
                      <option value="">-- Select Contact from Phone Book --</option>
                      {DEFAULT_CONTACTS.map(c => (
                        <option key={c.label} value={c.phone}>
                          {c.label} (+{c.phone})
                        </option>
                      ))}
                    </select>
                  </div>
                  <input
                    style={{ ...S.input, width: '100%', fontSize: 12 }}
                    placeholder="Or enter mobile number (e.g. 919876543210)"
                    value={waConfig.phone || ''}
                    onChange={e => setWaConfig(prev => ({ ...prev, phone: e.target.value }))}
                  />
                  <div style={{ fontSize: 10.5, color: '#94a3b8', marginTop: 3 }}>
                    * Leave phone number empty to choose any contact or group inside WhatsApp.
                  </div>
                </div>

                {/* 5. Sender Sign-Off */}
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: '#475569', letterSpacing: '0.04em', marginBottom: 4 }}>
                    ✍️ 5. Sender Sign-off Designation:
                  </div>
                  <input
                    style={{ ...S.input, width: '100%', fontSize: 12 }}
                    value={waConfig.senderSignOff || ''}
                    onChange={e => {
                      setWaConfig(prev => ({ ...prev, senderSignOff: e.target.value }))
                      setIsDirectEdit(false)
                    }}
                    placeholder="e.g. Store Manager · MK Paper Mill"
                  />
                </div>

                {/* Preferences Persistence Bar */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 10, borderTop: '1px solid #f1f5f9' }}>
                  <button
                    type="button"
                    style={{ ...S.btnSecondary, fontSize: 11.5, padding: '6px 10px' }}
                    onClick={handleResetDefaultSettings}
                  >
                    🔄 Reset Defaults
                  </button>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {savedSettingsToast && (
                      <span style={{ fontSize: 11, color: '#16a34a', fontWeight: 700 }}>
                        ✓ Preferences Saved!
                      </span>
                    )}
                    <button
                      type="button"
                      style={{ ...S.btnSecondary, background: '#f8fafc', borderColor: '#cbd5e1', fontSize: 11.5, padding: '6px 12px', fontWeight: 700, color: '#0f172a' }}
                      onClick={handleSaveDefaultSettings}
                      title="Save your current toggle options and remarks as default preset"
                    >
                      💾 Save as My Default
                    </button>
                  </div>
                </div>
              </div>

              {/* Right Column: Live Message Preview & Direct Manual Editor */}
              <div style={{ padding: '20px 24px', background: '#fafaf9', display: 'flex', flexDirection: 'column', gap: 12, maxHeight: 'calc(92vh - 140px)', overflowY: 'auto' }}>

                {/* Mode Switch & Actions */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', gap: 4, background: '#e2e8f0', padding: 3, borderRadius: 8 }}>
                    <button
                      type="button"
                      style={{
                        border: 'none',
                        padding: '5px 12px',
                        borderRadius: 6,
                        fontSize: 11.5,
                        fontWeight: !isDirectEdit ? 700 : 500,
                        background: !isDirectEdit ? '#fff' : 'transparent',
                        color: !isDirectEdit ? '#0f172a' : '#64748b',
                        cursor: 'pointer',
                        boxShadow: !isDirectEdit ? '0 1px 2px rgba(0,0,0,0.08)' : 'none'
                      }}
                      onClick={() => setIsDirectEdit(false)}
                    >
                      👁️ Live Chat Bubble
                    </button>
                    <button
                      type="button"
                      style={{
                        border: 'none',
                        padding: '5px 12px',
                        borderRadius: 6,
                        fontSize: 11.5,
                        fontWeight: isDirectEdit ? 700 : 500,
                        background: isDirectEdit ? '#fff' : 'transparent',
                        color: isDirectEdit ? '#0f172a' : '#64748b',
                        cursor: 'pointer',
                        boxShadow: isDirectEdit ? '0 1px 2px rgba(0,0,0,0.08)' : 'none'
                      }}
                      onClick={() => {
                        setCustomDraftText(generateWhatsAppEodText(data, waConfig))
                        setIsDirectEdit(true)
                      }}
                    >
                      ✏️ Direct Text Editor
                    </button>
                  </div>

                  <button
                    type="button"
                    style={{ ...S.btnSecondary, padding: '5px 10px', fontSize: 11.5 }}
                    onClick={handleCopyWhatsAppText}
                  >
                    {whatsAppCopied ? <Check size={14} color="#16a34a" /> : <Copy size={14} />}
                    {whatsAppCopied ? 'Copied!' : 'Copy WA Text'}
                  </button>
                </div>

                {/* Preview Box / Editor Area */}
                {!isDirectEdit ? (
                  <div style={{ ...S.whatsAppPreviewBox, maxHeight: 380, flex: 1, minHeight: 320 }}>
                    <div style={S.whatsAppBubble}>
                      {activeMessageText}
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, minHeight: 320 }}>
                    <div style={{ fontSize: 11, color: '#64748b', fontStyle: 'italic' }}>
                      ✍️ You can edit and fine-tune any words or numbers directly before routing to WhatsApp:
                    </div>
                    <textarea
                      style={{
                        width: '100%',
                        flex: 1,
                        minHeight: 300,
                        padding: 12,
                        borderRadius: 8,
                        border: '1px solid #cbd5e1',
                        fontSize: 12,
                        lineHeight: 1.5,
                        fontFamily: 'monospace',
                        background: '#fff',
                        color: '#0f172a',
                        resize: 'vertical'
                      }}
                      value={customDraftText}
                      onChange={e => setCustomDraftText(e.target.value)}
                    />
                  </div>
                )}

                {/* Stats & Meta */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, color: '#64748b', padding: '0 4px' }}>
                  <span>
                    📏 <b>{activeMessageText.length}</b> chars · <b>{activeMessageText.split('\n').length}</b> lines
                  </span>
                  <span>
                    ⚡ Formatted with WhatsApp bold (*), italics (_) & emojis
                  </span>
                </div>
              </div>
            </div>

            {/* Modal Bottom Action Footer */}
            <div style={{ padding: '14px 24px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: 0 }}>
              <div style={{ fontSize: 11.5, color: '#64748b', display: 'flex', alignItems: 'center', gap: 6 }}>
                <WhatsAppIcon size={16} color="#25D366" />
                Routes directly to WhatsApp Web, Desktop, or Mobile app.
              </div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <button
                  type="button"
                  style={S.btnSecondary}
                  onClick={() => setWhatsAppModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  style={S.btnSecondary}
                  onClick={handleCopyWhatsAppText}
                >
                  {whatsAppCopied ? <Check size={15} color="#16a34a" /> : <Copy size={15} />}
                  {whatsAppCopied ? 'Copied to Clipboard' : 'Copy Formatted Text'}
                </button>
                <button
                  type="button"
                  style={{ ...S.btnWhatsApp, padding: '10px 20px', fontSize: 13.5 }}
                  onClick={() => handleOpenWhatsApp()}
                >
                  <WhatsAppIcon size={18} color="#fff" /> Open WhatsApp & Send
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Send EOD in One Go Modal */}
      {eodModal && (
        <div style={S.modalOverlay} onClick={() => !eodSending && setEodModal(false)}>
          <div style={S.modalCard} onClick={e => e.stopPropagation()}>
            <div style={S.modalHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ background: '#dcfce7', color: '#166534', padding: 8, borderRadius: 8 }}>
                  <Send size={20} />
                </div>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#1b1b1d' }}>Dispatch Master EOD Mill Report</div>
                  <div style={{ fontSize: 12, color: '#6b7280' }}>Compile full mill report for {from} and broadcast in one go</div>
                </div>
              </div>
              <button style={S.modalClose} onClick={() => setEodModal(false)}>✕</button>
            </div>

            {eodSuccessMsg ? (
              <div style={{ padding: '24px 0', textAlign: 'center' }}>
                <CheckCircle2 size={42} style={{ color: '#16a34a', margin: '0 auto 12px' }} />
                <div style={{ fontSize: 16, fontWeight: 700, color: '#16a34a' }}>{eodSuccessMsg}</div>
                <div style={{ fontSize: 12, color: '#6b7280', marginTop: 6 }}>Report archived to history log.</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={S.eodSummaryBox}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: '#1b1b1d', marginBottom: 6 }}>Included in this EOD compilation:</div>
                  <ul style={{ fontSize: 12, color: '#4b5563', paddingLeft: 18, margin: 0, lineHeight: 1.6 }}>
                    <li><strong>Production:</strong> Total tons produced, reels count, net weight & machine efficiency</li>
                    <li><strong>Utilities:</strong> Power consumption (kWh), steam generated (MT), coal burned (kg) & fresh water</li>
                    <li><strong>Quality:</strong> Pass rate %, inspection log & parameter conformance</li>
                    <li><strong>Maintenance:</strong> Breakdowns logged, total downtime minutes & affected sections</li>
                    <li><strong>Dispatches & Sales:</strong> Finished goods dispatched (MT) & invoice value</li>
                    <li><strong>Stores:</strong> Stock ledger movements (Mechanical, Electrical, Chemicals) & issues value</li>
                  </ul>
                </div>

                <label style={S.label}>Recipients / Distribution List
                  <input
                    style={S.input}
                    value={eodRecipients}
                    onChange={e => setEodRecipients(e.target.value)}
                    placeholder="e.g. Managing Director, GM, Store Head, Production Head"
                  />
                </label>

                <label style={S.label}>Executive Remarks / Operational Notes (Optional)
                  <textarea
                    style={{ ...S.input, minHeight: 60, fontFamily: 'inherit' }}
                    value={eodNotes}
                    onChange={e => setEodNotes(e.target.value)}
                    placeholder="e.g. Machine 1 running at full capacity. Wire change planned for tomorrow."
                  />
                </label>

                <div style={S.modalFooter}>
                  <button type="button" style={S.btnSecondary} onClick={() => setEodModal(false)}>Cancel</button>
                  <button
                    type="button"
                    style={S.btnEodAction}
                    disabled={eodSending}
                    onClick={triggerSendEOD}
                  >
                    {eodSending ? 'Compiling & Sending...' : '🚀 Send Full EOD Report Now'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Enterprise Inventory Excel Exporter Modal */}
      <InventoryExportModal
        isOpen={exportModal}
        onClose={() => setExportModal(false)}
      />
    </div>
  )
}

// ── MODULE VIEWS ─────────────────────────────────────────────────────────────

function EodReportView({ data, history, onOpenSend, onOpenWhatsApp, onCopyWhatsApp, whatsAppCopied }) {
  const p = data.production || {}
  const u = data.utility || {}
  const q = data.quality || {}
  const m = data.maintenance || {}
  const c = data.commercial || {}
  const s = data.storeAndIndents || {}
  const h = data.hr || {}
  const indentsByDept = data.indentsByDept || []
  const indentsList = data.indentsList || []
  const categoryWise = data.categoryWiseStore || []
  const purchases = data.purchases || []
  const inwardGRNs = data.inwardGRNs || []
  const outwardIssues = data.outwardIssues || []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Banner */}
      <div style={S.eodBanner}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#1b1b1d', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ background: '#16a34a', color: '#fff', fontSize: 11, padding: '2px 8px', borderRadius: 4, textTransform: 'uppercase', fontWeight: 800 }}>Master Snapshot</span>
            Daily End-Of-Day Digest — {data.date}
          </div>
          <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>
            Live aggregated mill registers, store movements & procurement activity compiled at {new Date(data.compiledAt).toLocaleTimeString()}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }} className="mk-no-print">
          <button style={S.btnWhatsApp} onClick={onOpenWhatsApp} title="Open WhatsApp EOD Dispatch">
            <WhatsAppIcon size={16} color="#fff" /> Share on WhatsApp
          </button>
          <button style={S.btnSecondary} onClick={onCopyWhatsApp} title="Copy WhatsApp Formatted Text">
            {whatsAppCopied ? <Check size={14} color="#16a34a" /> : <Copy size={14} />}
            {whatsAppCopied ? 'Copied!' : 'Copy WA Text'}
          </button>
          <button style={S.btnEodAction} onClick={onOpenSend} title="Archive EOD Record">
            <Send size={14} /> Archive EOD
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div style={S.kpiGrid}>
        <KpiCard title="Total Production" value={`${fmtNum(p.totalMt, 2)} MT`} sub={`${p.totalReels || 0} reels produced`} icon={Factory} color="#2563eb" />
        <KpiCard title="Machine Efficiency" value={`${fmtNum(p.avgEfficiency, 1)}%`} sub={`Avg GSM: ${fmtNum(p.avgGsm, 1)}`} icon={TrendingUp} color="#16a34a" />
        <KpiCard title="Power Consumed" value={`${fmtNum(u.powerUnits, 0)} kWh`} sub={`Steam: ${fmtNum(u.steamMt, 1)} MT`} icon={Zap} color="#f59e0b" />
        <KpiCard title="Indents Raised" value={`${s.indentsRaised || 0} Indents`} sub={`Total: ${fmt(s.indentsValue)}`} icon={ShoppingCart} color="#8b5cf6" />
        <KpiCard title="Store Issues Value" value={fmt(s.stockIssueValue)} sub={`${fmtNum(s.stockIssuedQty, 0)} items issued`} icon={Boxes} color="#d97706" />
        <KpiCard title="Finished Dispatched" value={`${fmtNum(c.dispatchedMt, 2)} MT`} sub={`Value: ${fmt(c.dispatchedValue)}`} icon={Truck} color="#059669" />
        <KpiCard title="Downtime Lost" value={`${m.downtimeMin || 0} Min`} sub={`${m.breakdowns || 0} breakdowns`} icon={AlertTriangle} color="#ef4444" />
        <KpiCard title="Plant Headcount" value={`${h.present || 0} Present`} sub={`${h.absent || 0} absent / ${h.onLeave || 0} leave`} icon={UsersRound} color="#4b5563" />
      </div>

      {/* Section 1: Indents Raised by Department */}
      <div style={S.card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={S.cardTitle}>📑 1. Department Store Indents & Requisitions ({indentsByDept.length} Departments)</div>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#4b5563' }}>Total Value: {fmt(s.indentsValue)}</span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={S.table}>
            <thead>
              <tr style={S.thead}>
                <th style={S.th}>Department</th>
                <th style={S.th}>Indents Raised</th>
                <th style={S.th}>Total Requisition Value</th>
                <th style={S.th}>Issued</th>
                <th style={S.th}>Approved</th>
                <th style={S.th}>Pending Review</th>
                <th style={S.th}>Status</th>
              </tr>
            </thead>
            <tbody>
              {indentsByDept.length > 0 ? (
                indentsByDept.map(dept => (
                  <tr key={dept.dept_id || dept.dept_name} style={S.tr}>
                    <td style={S.td}><strong>{dept.dept_name}</strong> <span style={{ fontSize: 10.5, color: '#9ca3af' }}>({dept.dept_code})</span></td>
                    <td style={S.td}>{dept.total_indents}</td>
                    <td style={S.td}><strong>{fmt(dept.total_indent_value)}</strong></td>
                    <td style={S.td}><span style={{ color: '#16a34a', fontWeight: 600 }}>{dept.issued_count}</span></td>
                    <td style={S.td}><span style={{ color: '#2563eb', fontWeight: 600 }}>{dept.approved_count}</span></td>
                    <td style={S.td}><span style={{ color: '#d97706', fontWeight: 600 }}>{dept.pending_count}</span></td>
                    <td style={S.td}>
                      <span style={{
                        background: Number(dept.pending_count) > 0 ? '#fef3c7' : '#dcfce7',
                        color: Number(dept.pending_count) > 0 ? '#92400e' : '#166534',
                        padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 700
                      }}>
                        {Number(dept.pending_count) > 0 ? 'Pending Approvals' : 'Actioned'}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan={7} style={S.tdEmpty}>No indents raised on this date</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Key Indents Detail Sub-table */}
        {indentsList.length > 0 && (
          <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid #f3f4f6' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 8 }}>Individual Indent Value Ledger:</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 10 }}>
              {indentsList.map(ind => (
                <div key={ind.id} style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: '10px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 12.5, color: '#1b1b1d' }}>{ind.indent_number}</div>
                    <div style={{ fontSize: 11, color: '#6b7280' }}>{ind.dept_name} · {ind.items_count} items {ind.raised_by_name ? `(${ind.raised_by_name})` : ''}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 800, fontSize: 13, color: '#1b1b1d' }}>{fmt(ind.total_value)}</div>
                    <span style={{
                      fontSize: 10.5, fontWeight: 700, padding: '1px 6px', borderRadius: 4,
                      background: ind.status === 'Issued' ? '#dcfce7' : ind.status === 'Approved' ? '#dbeafe' : '#fef3c7',
                      color: ind.status === 'Issued' ? '#166534' : ind.status === 'Approved' ? '#1e40af' : '#92400e'
                    }}>
                      {ind.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Section 2: Category-Wise Store Movements */}
      <div style={S.card}>
        <div style={S.cardTitle}>🏷️ 2. Store Category-Wise Consumption & Inward Breakdown</div>
        <div style={{ overflowX: 'auto' }}>
          <table style={S.table}>
            <thead>
              <tr style={S.thead}>
                <th style={S.th}>Category</th>
                <th style={S.th}>Store Type</th>
                <th style={S.th}>Outward Issued Items</th>
                <th style={S.th}>Issued Qty</th>
                <th style={S.th}>Outward Valuation</th>
                <th style={S.th}>Inward Receipts</th>
                <th style={S.th}>Received Qty</th>
                <th style={S.th}>Inward Valuation</th>
              </tr>
            </thead>
            <tbody>
              {categoryWise.length > 0 ? (
                categoryWise.map((cat, idx) => (
                  <tr key={idx} style={S.tr}>
                    <td style={S.td}><strong>{cat.category_name}</strong></td>
                    <td style={S.td}><span style={{ background: '#f3f4f6', padding: '2px 6px', borderRadius: 4, fontSize: 10.5 }}>{cat.store_type || 'Store'}</span></td>
                    <td style={S.td}>{cat.items_issued_count || 0}</td>
                    <td style={S.td}>{fmtNum(cat.outward_qty, 1)}</td>
                    <td style={S.td}><strong style={{ color: Number(cat.outward_value) > 0 ? '#b45309' : '#1b1b1d' }}>{fmt(cat.outward_value)}</strong></td>
                    <td style={S.td}>{cat.items_received_count || 0}</td>
                    <td style={S.td}>{fmtNum(cat.inward_qty, 1)}</td>
                    <td style={S.td}><strong style={{ color: Number(cat.inward_value) > 0 ? '#15803d' : '#1b1b1d' }}>{fmt(cat.inward_value)}</strong></td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan={8} style={S.tdEmpty}>No store category movements recorded on this date</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Section 3: Purchase Orders & Inward GRN Receipts Against PO */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Left: Purchase Orders */}
        <div style={S.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={S.cardTitle}>🛒 3. Purchase Orders ({purchases.length})</div>
            <span style={{ fontSize: 11.5, color: '#6b7280' }}>Procurement commitments</span>
          </div>
          <div style={{ overflowX: 'auto', maxHeight: 280 }}>
            <table style={S.table}>
              <thead>
                <tr style={S.thead}>
                  <th style={S.th}>PO Number</th>
                  <th style={S.th}>Vendor</th>
                  <th style={S.th}>Items</th>
                  <th style={S.th}>Grand Total</th>
                  <th style={S.th}>Status</th>
                </tr>
              </thead>
              <tbody>
                {purchases.length > 0 ? (
                  purchases.map(po => (
                    <tr key={po.id} style={S.tr}>
                      <td style={S.td}><strong>{po.po_number}</strong></td>
                      <td style={S.td}>{po.vendor_name || '—'}</td>
                      <td style={S.td}>{po.items_count || 0}</td>
                      <td style={S.td}><strong>{fmt(po.grand_total || po.total_value)}</strong></td>
                      <td style={S.td}>
                        <span style={{
                          fontSize: 10.5, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
                          background: po.status === 'Approved' ? '#dbeafe' : po.status === 'Received' ? '#dcfce7' : '#f3f4f6',
                          color: po.status === 'Approved' ? '#1e40af' : po.status === 'Received' ? '#166534' : '#4b5563'
                        }}>
                          {po.status}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan={5} style={S.tdEmpty}>No purchase orders created on this date</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right: Inward GRN Receipts */}
        <div style={S.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={S.cardTitle}>📥 4. Inward GRN Receipts ({inwardGRNs.length})</div>
            <span style={{ fontSize: 11.5, color: '#16a34a', fontWeight: 600 }}>Received Against PO</span>
          </div>
          <div style={{ overflowX: 'auto', maxHeight: 280 }}>
            <table style={S.table}>
              <thead>
                <tr style={S.thead}>
                  <th style={S.th}>Material</th>
                  <th style={S.th}>Qty</th>
                  <th style={S.th}>Value</th>
                  <th style={S.th}>Vendor / PO Ref</th>
                </tr>
              </thead>
              <tbody>
                {inwardGRNs.length > 0 ? (
                  inwardGRNs.map(grn => (
                    <tr key={grn.id} style={S.tr}>
                      <td style={S.td}>
                        <strong>{grn.mat_name}</strong>
                        <div style={{ fontSize: 10.5, color: '#9ca3af' }}>{grn.mat_code}</div>
                      </td>
                      <td style={S.td}>{fmtNum(grn.in_qty, 1)} {grn.uom}</td>
                      <td style={S.td}><strong>{fmt(grn.value)}</strong></td>
                      <td style={S.td}>
                        <div style={{ fontWeight: 600 }}>{grn.vendor_name || '—'}</div>
                        {grn.po_number ? (
                          <span style={{ fontSize: 10.5, color: '#2563eb', fontWeight: 600 }}>PO: {grn.po_number}</span>
                        ) : (
                          <span style={{ fontSize: 10, color: '#9ca3af' }}>{grn.remarks?.split('|')[0] || ''}</span>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan={4} style={S.tdEmpty}>No inward GRN receipts recorded on this date</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Section 4: Outward Store Issuance to Mill */}
      <div style={S.card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={S.cardTitle}>📤 5. Store Outward Issuance to Mill ({outwardIssues.length} Items)</div>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#d97706' }}>Total Issued Value: {fmt(s.stockIssueValue)}</span>
        </div>
        <div style={{ overflowX: 'auto', maxHeight: 300 }}>
          <table style={S.table}>
            <thead>
              <tr style={S.thead}>
                <th style={S.th}>Material Code</th>
                <th style={S.th}>Material Name</th>
                <th style={S.th}>Issued Qty</th>
                <th style={S.th}>UOM</th>
                <th style={S.th}>Valuation</th>
                <th style={S.th}>Recipient Department / Reference</th>
              </tr>
            </thead>
            <tbody>
              {outwardIssues.length > 0 ? (
                outwardIssues.map(iss => (
                  <tr key={iss.id} style={S.tr}>
                    <td style={S.td}><code>{iss.mat_code}</code></td>
                    <td style={S.td}><strong>{iss.mat_name}</strong></td>
                    <td style={S.td}>{fmtNum(iss.out_qty, 1)}</td>
                    <td style={S.td}>{iss.uom}</td>
                    <td style={S.td}><strong>{fmt(iss.value)}</strong></td>
                    <td style={S.td}>
                      <span style={{ background: '#f3f4f6', padding: '2px 6px', borderRadius: 4, fontWeight: 600, color: '#374151' }}>
                        {iss.dept_name}
                      </span>
                      {iss.remarks && <div style={{ fontSize: 10.5, color: '#9ca3af', marginTop: 2 }}>{iss.remarks}</div>}
                    </td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan={6} style={S.tdEmpty}>No outward material issues on this date</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Section 5: Machine Output & Utility Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div style={S.card}>
          <div style={S.cardTitle}>⚙️ 6. Machine Output Breakdown</div>
          <table style={S.table}>
            <thead>
              <tr style={S.thead}>
                <th style={S.th}>Machine</th>
                <th style={S.th}>Code</th>
                <th style={S.th}>Reels</th>
                <th style={S.th}>Net Production</th>
                <th style={S.th}>Efficiency</th>
              </tr>
            </thead>
            <tbody>
              {p.byMachine?.length > 0 ? (
                p.byMachine.map((bm, i) => (
                  <tr key={i} style={S.tr}>
                    <td style={S.td}><strong>{bm.machine}</strong></td>
                    <td style={S.td}>{bm.code}</td>
                    <td style={S.td}>{bm.reels}</td>
                    <td style={S.td}>{(Number(bm.total_kg || 0) / 1000).toFixed(3)} MT</td>
                    <td style={S.td}>{Number(bm.avg_efficiency || 0).toFixed(1)}%</td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan={5} style={S.tdEmpty}>No machine output recorded for this date</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div style={S.card}>
          <div style={S.cardTitle}>⚡ 7. Utility & Boiler Summary</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, padding: 8 }}>
            <div style={S.metricBlock}>
              <div style={S.metricLabel}>Total Power (Grid + DG)</div>
              <div style={S.metricVal}>{fmtNum(u.powerUnits, 0)} Units</div>
            </div>
            <div style={S.metricBlock}>
              <div style={S.metricLabel}>Steam Generated</div>
              <div style={S.metricVal}>{fmtNum(u.steamMt, 2)} MT</div>
            </div>
            <div style={S.metricBlock}>
              <div style={S.metricLabel}>Coal Consumed</div>
              <div style={S.metricVal}>{fmtNum(u.coalKg, 0)} KG</div>
            </div>
            <div style={S.metricBlock}>
              <div style={S.metricLabel}>Fresh Water Intake</div>
              <div style={S.metricVal}>{fmtNum(u.waterKl, 0)} KL</div>
            </div>
            <div style={S.metricBlock}>
              <div style={S.metricLabel}>Boiler Pressure Avg</div>
              <div style={S.metricVal}>{fmtNum(u.boilerPressure, 1)} Bar</div>
            </div>
            <div style={S.metricBlock}>
              <div style={S.metricLabel}>Boiler Temperature</div>
              <div style={S.metricVal}>{fmtNum(u.boilerTemp, 1)} °C</div>
            </div>
          </div>
        </div>
      </div>

      {/* Section 6: Recent EOD Dispatches History */}
      {history?.length > 0 && (
        <div style={S.card}>
          <div style={S.cardTitle}>📜 Recent EOD Broadcast History</div>
          <table style={S.table}>
            <thead>
              <tr style={S.thead}>
                <th style={S.th}>Report Date</th>
                <th style={S.th}>Dispatched At</th>
                <th style={S.th}>Sent By</th>
                <th style={S.th}>Recipients</th>
                <th style={S.th}>Production MT</th>
                <th style={S.th}>Dispatched MT</th>
                <th style={S.th}>Status</th>
              </tr>
            </thead>
            <tbody>
              {history.slice(0, 5).map(h => (
                <tr key={h.id} style={S.tr}>
                  <td style={S.td}><strong>{new Date(h.reportDate).toLocaleDateString()}</strong></td>
                  <td style={S.td}>{new Date(h.sentAt).toLocaleString()}</td>
                  <td style={S.td}>{h.sentByName || 'System'}</td>
                  <td style={S.td}>{h.recipients}</td>
                  <td style={S.td}>{fmtNum(h.totalMt, 2)} MT</td>
                  <td style={S.td}>{fmtNum(h.dispatchedMt, 2)} MT</td>
                  <td style={S.td}>
                    <span style={{ background: '#dcfce7', color: '#166534', padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 700 }}>
                      ✓ {h.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function StoresReportView({ data, search }) {
  const items = useMemo(() => {
    if (!data?.items) return []
    if (!search) return data.items
    const q = search.toLowerCase()
    return data.items.filter(i =>
      i.code?.toLowerCase().includes(q) ||
      i.name?.toLowerCase().includes(q) ||
      i.storeName?.toLowerCase().includes(q) ||
      i.categoryName?.toLowerCase().includes(q) ||
      i.binLocation?.toLowerCase().includes(q)
    )
  }, [data, search])

  const s = data.summary || {}

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={S.kpiGrid}>
        <KpiCard title="Total Materials Listed" value={s.total_items || items.length} sub="Across all mill stores" icon={Boxes} color="#2563eb" />
        <KpiCard title="Total Inventory Valuation" value={fmt(s.total_value)} sub="Live valuation at unit cost" icon={TrendingUp} color="#16a34a" />
        <KpiCard title="Below Reorder Alert" value={s.low_stock_count || 0} sub="Items requiring purchase indent" icon={AlertTriangle} color="#ef4444" />
      </div>

      <div style={S.card}>
        <div style={{ ...S.cardTitle, display: 'flex', justifyContent: 'space-between' }}>
          <span>Stores & Spares Register ({items.length} items)</span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={S.table}>
            <thead>
              <tr style={S.thead}>
                <th style={S.th}>Code</th>
                <th style={S.th}>Item Details</th>
                <th style={S.th}>Store & Category</th>
                <th style={S.th}>UOM</th>
                <th style={S.th}>HSN</th>
                <th style={S.th}>Rack / Box</th>
                <th style={S.th}>Opening</th>
                <th style={S.th}>Received</th>
                <th style={S.th}>Issued</th>
                <th style={S.th}>Balance</th>
                <th style={S.th}>Unit Price</th>
                <th style={S.th}>Stock Value</th>
              </tr>
            </thead>
            <tbody>
              {items.map((m) => {
                const rec = Number(m.received || 0)
                const iss = Number(m.issued || 0)
                const cur = Number(m.currentStock || 0)
                const op = cur - rec + iss
                const isLow = cur <= Number(m.reorderLevel || 0)
                return (
                  <tr key={m.id} style={S.tr}>
                    <td style={{ ...S.td, fontFamily: 'monospace', fontWeight: 600 }}>{m.code}</td>
                    <td style={{ ...S.td, fontWeight: 600, minWidth: 220 }}>{m.name}</td>
                    <td style={S.td}>
                      <span style={{ fontSize: 11, background: '#f3f4f6', padding: '2px 6px', borderRadius: 4 }}>
                        {m.storeName} › {m.categoryName}
                      </span>
                    </td>
                    <td style={S.td}>{m.uom}</td>
                    <td style={S.td}>{m.hsn_code || '—'}</td>
                    <td style={S.td}>{m.binLocation || '—'}</td>
                    <td style={S.td}>{op.toFixed(3)}</td>
                    <td style={{ ...S.td, color: '#16a34a', fontWeight: 600 }}>{rec.toFixed(3)}</td>
                    <td style={{ ...S.td, color: '#dc2626', fontWeight: 600 }}>{iss.toFixed(3)}</td>
                    <td style={{ ...S.td, fontWeight: 700, color: isLow ? '#dc2626' : '#1b1b1d' }}>
                      {cur.toFixed(3)} {isLow && '⚠️'}
                    </td>
                    <td style={S.td}>{fmt(m.unitPrice)}</td>
                    <td style={{ ...S.td, fontWeight: 600 }}>{fmt(m.stockValue)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function ProductionReportView({ data, search }) {
  const s = data.summary || {}
  const reels = (data.reels || []).filter(r => !search || JSON.stringify(r).toLowerCase().includes(search.toLowerCase()))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={S.kpiGrid}>
        <KpiCard title="Total Production" value={`${fmtNum(s.total_mt, 3)} MT`} sub={`${s.total_reels} reels produced`} icon={Factory} color="#2563eb" />
        <KpiCard title="Avg Efficiency" value={`${fmtNum(s.avg_efficiency, 1)}%`} sub={`Avg GSM: ${fmtNum(s.avg_gsm, 1)}`} icon={TrendingUp} color="#16a34a" />
        <KpiCard title="Avg Moisture" value={`${fmtNum(s.avg_moisture, 2)}%`} sub="Target: 7.0 - 8.5%" icon={Flame} color="#f59e0b" />
        <KpiCard title="Downtime Total" value={`${s.total_downtime_min || 0} Min`} sub="Across paper machines" icon={AlertTriangle} color="#ef4444" />
      </div>

      <div style={S.card}>
        <div style={S.cardTitle}>Reel Production Log ({reels.length} reels)</div>
        <table style={S.table}>
          <thead>
            <tr style={S.thead}>
              <th style={S.th}>Reel No</th>
              <th style={S.th}>Machine</th>
              <th style={S.th}>Grade</th>
              <th style={S.th}>GSM</th>
              <th style={S.th}>Weight (kg)</th>
              <th style={S.th}>Efficiency %</th>
              <th style={S.th}>Moisture %</th>
              <th style={S.th}>Quality</th>
            </tr>
          </thead>
          <tbody>
            {reels.map((r, i) => (
              <tr key={i} style={S.tr}>
                <td style={{ ...S.td, fontFamily: 'monospace', fontWeight: 600 }}>{r.reelNumber}</td>
                <td style={S.td}>{r.machine}</td>
                <td style={S.td}>{r.grade}</td>
                <td style={S.td}>{r.gsm}</td>
                <td style={{ ...S.td, fontWeight: 600 }}>{fmtNum(r.weightKg, 1)}</td>
                <td style={S.td}>{fmtNum(r.efficiencyPct, 1)}%</td>
                <td style={S.td}>{fmtNum(r.moisturePct, 2)}%</td>
                <td style={S.td}>
                  <span style={{ padding: '2px 6px', borderRadius: 4, fontSize: 11, fontWeight: 600, background: r.qualityStatus === 'Pass' ? '#dcfce7' : '#fee2e2', color: r.qualityStatus === 'Pass' ? '#166534' : '#991b1b' }}>
                    {r.qualityStatus || 'Pending'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function QualityReportView({ data, search }) {
  const s = data.summary || {}
  const tests = (data.tests || []).filter(t => !search || JSON.stringify(t).toLowerCase().includes(search.toLowerCase()))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={S.kpiGrid}>
        <KpiCard title="Total Tests Conducted" value={s.total || 0} sub="Quality control tests" icon={BadgeCheck} color="#2563eb" />
        <KpiCard title="Quality Pass Rate" value={`${s.pass_rate || 100}%`} sub={`${s.passed || 0} Passed`} icon={CheckCircle2} color="#16a34a" />
        <KpiCard title="Rejections / Failures" value={s.failed || 0} sub={`${s.held || 0} on hold`} icon={AlertTriangle} color="#ef4444" />
      </div>

      <div style={S.card}>
        <div style={S.cardTitle}>Quality Assurance Inspection Register</div>
        <table style={S.table}>
          <thead>
            <tr style={S.thead}>
              <th style={S.th}>Test No</th>
              <th style={S.th}>Test Type</th>
              <th style={S.th}>Date</th>
              <th style={S.th}>GSM</th>
              <th style={S.th}>Moisture %</th>
              <th style={S.th}>Burst Factor</th>
              <th style={S.th}>Tested By</th>
              <th style={S.th}>Result</th>
            </tr>
          </thead>
          <tbody>
            {tests.map((t, i) => (
              <tr key={i} style={S.tr}>
                <td style={{ ...S.td, fontFamily: 'monospace' }}>{t.testNumber}</td>
                <td style={S.td}>{t.testType}</td>
                <td style={S.td}>{t.testDate ? new Date(t.testDate).toLocaleDateString() : '—'}</td>
                <td style={S.td}>{t.gsm || '—'}</td>
                <td style={S.td}>{t.moisturePct ? `${t.moisturePct}%` : '—'}</td>
                <td style={S.td}>{t.burstFactor || '—'}</td>
                <td style={S.td}>{t.testedBy || 'Lab Tech'}</td>
                <td style={S.td}>
                  <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700, background: t.result === 'Pass' ? '#dcfce7' : '#fee2e2', color: t.result === 'Pass' ? '#166534' : '#991b1b' }}>
                    {t.result}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function UtilityReportView({ data }) {
  const s = data.summary || {}
  const readings = data.byDate || []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={S.kpiGrid}>
        <KpiCard title="Total Power Units" value={`${fmtNum(s.total_power, 0)} kWh`} sub="Grid + DG Power" icon={Zap} color="#f59e0b" />
        <KpiCard title="Steam Generated" value={`${fmtNum(s.total_steam, 2)} MT`} sub={`Boiler Avg: ${fmtNum(s.avg_pressure, 1)} Bar`} icon={Flame} color="#2563eb" />
        <KpiCard title="Coal Consumed" value={`${fmtNum(s.total_coal, 0)} kg`} sub="Fuel consumption" icon={BarChart2} color="#4b5563" />
        <KpiCard title="Fresh Water" value={`${fmtNum(s.total_water, 0)} KL`} sub="Intake volume" icon={TrendingUp} color="#059669" />
      </div>

      <div style={S.card}>
        <div style={S.cardTitle}>Shift-Wise Utility Consumption Register</div>
        <table style={S.table}>
          <thead>
            <tr style={S.thead}>
              <th style={S.th}>Date</th>
              <th style={S.th}>Shift</th>
              <th style={S.th}>Power (Units)</th>
              <th style={S.th}>Steam (MT)</th>
              <th style={S.th}>Coal (kg)</th>
              <th style={S.th}>Fresh Water (KL)</th>
            </tr>
          </thead>
          <tbody>
            {readings.map((r, i) => (
              <tr key={i} style={S.tr}>
                <td style={S.td}>{r.date ? new Date(r.date).toLocaleDateString() : '—'}</td>
                <td style={S.td}><strong>{r.shift_type || 'Shift A'}</strong></td>
                <td style={S.td}>{fmtNum(r.power, 0)}</td>
                <td style={S.td}>{fmtNum(r.steam, 2)}</td>
                <td style={S.td}>{fmtNum(r.coal, 0)}</td>
                <td style={S.td}>{fmtNum(r.water, 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function DowntimeReportView({ data, search }) {
  const s = data.summary || {}
  const entries = (data.entries || []).filter(e => !search || JSON.stringify(e).toLowerCase().includes(search.toLowerCase()))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={S.kpiGrid}>
        <KpiCard title="Total Breakdown Events" value={s.total_events || entries.length} sub={`${s.machines_affected || 0} machines affected`} icon={AlertTriangle} color="#ef4444" />
        <KpiCard title="Total Downtime" value={`${s.total_downtime_min || 0} Min`} sub={`Avg: ${fmtNum(s.avg_duration_min, 1)} min/event`} icon={Clock} color="#f59e0b" />
      </div>

      <div style={S.card}>
        <div style={S.cardTitle}>Downtime & Breakdown Log</div>
        <table style={S.table}>
          <thead>
            <tr style={S.thead}>
              <th style={S.th}>Machine</th>
              <th style={S.th}>Start Time</th>
              <th style={S.th}>End Time</th>
              <th style={S.th}>Duration</th>
              <th style={S.th}>Category</th>
              <th style={S.th}>Reason</th>
              <th style={S.th}>Action Taken</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e, i) => (
              <tr key={i} style={S.tr}>
                <td style={S.td}><strong>{e.machine}</strong></td>
                <td style={S.td}>{e.startTime ? new Date(e.startTime).toLocaleString() : '—'}</td>
                <td style={S.td}>{e.endTime ? new Date(e.endTime).toLocaleString() : 'Ongoing'}</td>
                <td style={{ ...S.td, fontWeight: 700, color: '#ef4444' }}>{e.durationMin} Min</td>
                <td style={S.td}><span style={{ background: '#f3f4f6', padding: '2px 6px', borderRadius: 4, fontSize: 11 }}>{e.reasonCategory || 'General'}</span></td>
                <td style={S.td}>{e.reason}</td>
                <td style={S.td}>{e.actionTaken || 'Under review'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function IndentsReportView({ data, search }) {
  const s = data.summary || {}
  const indents = (data.indents || []).filter(i => !search || JSON.stringify(i).toLowerCase().includes(search.toLowerCase()))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={S.kpiGrid}>
        <KpiCard title="Total Indents Raised" value={s.total_indents || indents.length} sub={`Total Value: ${fmt(s.total_value)}`} icon={ShoppingCart} color="#2563eb" />
        <KpiCard title="Issued & Fulfilled" value={s.issued_count || 0} sub="Items dispatched from store" icon={CheckCircle2} color="#16a34a" />
        <KpiCard title="Pending Approvals" value={s.pending_count || 0} sub="Awaiting HOD / Store action" icon={Clock} color="#f59e0b" />
      </div>

      <div style={S.card}>
        <div style={S.cardTitle}>Department Indents Register</div>
        <table style={S.table}>
          <thead>
            <tr style={S.thead}>
              <th style={S.th}>Indent No</th>
              <th style={S.th}>Date</th>
              <th style={S.th}>Department</th>
              <th style={S.th}>Raised By</th>
              <th style={S.th}>Priority</th>
              <th style={S.th}>Total Value</th>
              <th style={S.th}>Status</th>
            </tr>
          </thead>
          <tbody>
            {indents.map((ind, i) => (
              <tr key={i} style={S.tr}>
                <td style={{ ...S.td, fontFamily: 'monospace', fontWeight: 600 }}>{ind.indentNumber}</td>
                <td style={S.td}>{ind.date ? new Date(ind.date).toLocaleDateString() : '—'}</td>
                <td style={S.td}><strong>{ind.department || 'Plant Store'}</strong></td>
                <td style={S.td}>{ind.raisedBy || 'Staff'}</td>
                <td style={S.td}>{ind.priority || 'Normal'}</td>
                <td style={S.td}>{fmt(ind.totalValue)}</td>
                <td style={S.td}>
                  <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700, background: ind.status === 'Issued' ? '#dcfce7' : '#fef3c7', color: ind.status === 'Issued' ? '#166534' : '#92400e' }}>
                    {ind.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function SalesReportView({ data, search }) {
  const s = data.summary || {}
  const orders = (data.orders || []).filter(o => !search || JSON.stringify(o).toLowerCase().includes(search.toLowerCase()))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={S.kpiGrid}>
        <KpiCard title="Total Sales Orders" value={s.total_orders || orders.length} sub={`${fmtNum(s.total_qty_mt, 2)} MT ordered`} icon={Truck} color="#2563eb" />
        <KpiCard title="Total Fulfilled" value={`${fmtNum(s.total_fulfilled_mt, 2)} MT`} sub="Dispatched to customers" icon={CheckCircle2} color="#16a34a" />
        <KpiCard title="Order Book Value" value={fmt(s.total_value)} sub="Gross revenue value" icon={TrendingUp} color="#059669" />
      </div>

      <div style={S.card}>
        <div style={S.cardTitle}>Sales & Customer Orders Register</div>
        <table style={S.table}>
          <thead>
            <tr style={S.thead}>
              <th style={S.th}>SO Number</th>
              <th style={S.th}>Date</th>
              <th style={S.th}>Customer</th>
              <th style={S.th}>Grade</th>
              <th style={S.th}>Ordered (MT)</th>
              <th style={S.th}>Fulfilled (MT)</th>
              <th style={S.th}>Rate / kg</th>
              <th style={S.th}>Total Value</th>
              <th style={S.th}>Status</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o, i) => (
              <tr key={i} style={S.tr}>
                <td style={{ ...S.td, fontFamily: 'monospace', fontWeight: 600 }}>{o.soNumber}</td>
                <td style={S.td}>{o.date ? new Date(o.date).toLocaleDateString() : '—'}</td>
                <td style={S.td}><strong>{o.customer}</strong></td>
                <td style={S.td}>{o.grade}</td>
                <td style={S.td}>{fmtNum(o.qtyMt, 2)}</td>
                <td style={S.td}>{fmtNum(o.fulfilledMt, 2)}</td>
                <td style={S.td}>{fmt(o.ratePerKg)}</td>
                <td style={{ ...S.td, fontWeight: 600 }}>{fmt(o.totalValue)}</td>
                <td style={S.td}>
                  <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700, background: o.status === 'Completed' ? '#dcfce7' : '#fef3c7', color: o.status === 'Completed' ? '#166534' : '#92400e' }}>
                    {o.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function HrReportView({ data }) {
  const depts = data.byDepartment || []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={S.card}>
        <div style={S.cardTitle}>Department Attendance & Headcount Summary</div>
        <table style={S.table}>
          <thead>
            <tr style={S.thead}>
              <th style={S.th}>Department</th>
              <th style={S.th}>Present</th>
              <th style={S.th}>Absent</th>
              <th style={S.th}>On Leave</th>
              <th style={S.th}>Holiday</th>
              <th style={S.th}>Late Punches</th>
            </tr>
          </thead>
          <tbody>
            {depts.map((d, i) => (
              <tr key={i} style={S.tr}>
                <td style={S.td}><strong>{d.department}</strong></td>
                <td style={{ ...S.td, color: '#16a34a', fontWeight: 700 }}>{d.present_count}</td>
                <td style={{ ...S.td, color: '#dc2626', fontWeight: 600 }}>{d.absent_count}</td>
                <td style={S.td}>{d.leave_count}</td>
                <td style={S.td}>{d.holiday_count}</td>
                <td style={{ ...S.td, color: '#f59e0b' }}>{d.late_count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── GRANULAR DEPT DEEP-DIVE VIEWS (drill-down: summary rows -> transaction rows) ──

function DrillTable({ title, columns, rows, emptyMsg }) {
  return (
    <div style={S.card}>
      <div style={S.cardTitle}>{title} ({rows.length})</div>
      <div style={{ overflowX: 'auto' }}>
        <table style={S.table}>
          <thead>
            <tr style={S.thead}>
              {columns.map(c => <th key={c.key} style={S.th}>{c.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={columns.length} style={S.tdEmpty}>{emptyMsg || 'No records for this filter'}</td></tr>
            ) : rows.map((r, i) => (
              <tr key={i} style={S.tr}>
                {columns.map(c => <td key={c.key} style={S.td}>{c.render ? c.render(r) : (r[c.key] ?? '—')}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function HrDetailedReportView({ data, search }) {
  const byDept = data.byDepartment || []
  const employees = (data.employees || []).filter(e => !search || JSON.stringify(e).toLowerCase().includes(search.toLowerCase()))
  const [expanded, setExpanded] = useState(null)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={S.kpiGrid}>
        <KpiCard title="Departments Covered" value={byDept.length} sub={`${from_to(data)}`} icon={UsersRound} color="#2563eb" />
        <KpiCard title="Total Headcount" value={byDept.reduce((s, d) => s + Number(d.headcount || 0), 0)} sub="Active employees" icon={UsersRound} color="#16a34a" />
        <KpiCard title="Monthly Payroll Cost" value={fmt(byDept.reduce((s, d) => s + Number(d.monthly_payroll_cost || 0), 0))} sub="Sum of basic salary (active)" icon={TrendingUp} color="#f59e0b" />
      </div>

      <div style={S.card}>
        <div style={S.cardTitle}>Department Summary — Attendance %, Leave & Payroll Cost (click a row to drill down)</div>
        <table style={S.table}>
          <thead>
            <tr style={S.thead}>
              <th style={S.th}>Department</th>
              <th style={S.th}>Headcount</th>
              <th style={S.th}>Attendance %</th>
              <th style={S.th}>Present Days</th>
              <th style={S.th}>Absent Days</th>
              <th style={S.th}>Leave Days</th>
              <th style={S.th}>Payroll Cost</th>
            </tr>
          </thead>
          <tbody>
            {byDept.map((d, i) => (
              <tr key={i} style={{ ...S.tr, cursor: 'pointer' }} onClick={() => setExpanded(expanded === d.departmentId ? null : d.departmentId)}>
                <td style={S.td}><strong>{d.department}</strong> <ArrowRight size={11} style={{ display: 'inline', marginLeft: 4, opacity: 0.5 }} /></td>
                <td style={S.td}>{d.headcount}</td>
                <td style={{ ...S.td, fontWeight: 700, color: Number(d.attendance_pct) >= 90 ? '#16a34a' : '#dc2626' }}>{d.attendance_pct ?? '—'}%</td>
                <td style={S.td}>{d.present_days}</td>
                <td style={{ ...S.td, color: '#dc2626' }}>{d.absent_days}</td>
                <td style={S.td}>{d.leave_days}</td>
                <td style={{ ...S.td, fontWeight: 600 }}>{fmt(d.monthly_payroll_cost)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <DrillTable
        title="Employee Drill-Down — Attendance & Leave (transaction-level)"
        columns={[
          { key: 'employeeCode', label: 'Emp Code' },
          { key: 'name', label: 'Name' },
          { key: 'department', label: 'Department' },
          { key: 'designation', label: 'Designation' },
          { key: 'present', label: 'Present' },
          { key: 'absent', label: 'Absent' },
          { key: 'leave', label: 'Leave' },
          { key: 'attendancePct', label: 'Attendance %', render: r => `${r.attendancePct ?? '—'}%` },
          { key: 'basicSalary', label: 'Basic Salary', render: r => fmt(r.basicSalary) },
        ]}
        rows={employees}
      />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <DrillTable
          title="Leave Utilization by Type"
          columns={[
            { key: 'leaveType', label: 'Leave Type' },
            { key: 'applications', label: 'Applications' },
            { key: 'totalDays', label: 'Total Days' },
            { key: 'approved', label: 'Approved' },
            { key: 'pending', label: 'Pending' },
          ]}
          rows={data.leaveUtilization || []}
        />
        <DrillTable
          title="Payroll Cost Trend (Monthly)"
          columns={[
            { key: 'month', label: 'Month' },
            { key: 'status', label: 'Status' },
            { key: 'totalEmployees', label: 'Employees' },
            { key: 'totalGross', label: 'Gross', render: r => fmt(r.totalGross) },
            { key: 'totalNet', label: 'Net', render: r => fmt(r.totalNet) },
          ]}
          rows={data.payrollTrend || []}
        />
      </div>
    </div>
  )
}
const from_to = d => `${d.from} to ${d.to}`

function MaintenanceDetailedReportView({ data, search }) {
  const mttr = data.mttrMtbfByMachine || []
  const logs = (data.maintenanceLogs || []).filter(l => !search || JSON.stringify(l).toLowerCase().includes(search.toLowerCase()))
  const pm = data.pmCompletion || {}

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={S.kpiGrid}>
        <KpiCard title="PM Completion Rate" value={`${pm.completion_pct ?? 0}%`} sub={`${pm.completed || 0} of ${pm.total_scheduled || 0} scheduled`} icon={CheckCircle2} color="#16a34a" />
        <KpiCard title="Overdue PM Jobs" value={pm.overdue || 0} sub="Past due date" icon={AlertTriangle} color="#ef4444" />
        <KpiCard title="Machines Tracked" value={mttr.length} sub="MTTR / MTBF computed" icon={Wrench} color="#2563eb" />
      </div>

      <div style={S.card}>
        <div style={S.cardTitle}>MTTR / MTBF by Machine</div>
        <table style={S.table}>
          <thead>
            <tr style={S.thead}>
              <th style={S.th}>Machine</th>
              <th style={S.th}>Breakdowns</th>
              <th style={S.th}>Total Downtime (min)</th>
              <th style={S.th}>MTTR (min)</th>
              <th style={S.th}>MTBF (min)</th>
            </tr>
          </thead>
          <tbody>
            {mttr.map((m, i) => (
              <tr key={i} style={S.tr}>
                <td style={S.td}><strong>{m.machine}</strong> ({m.code})</td>
                <td style={S.td}>{m.breakdown_count}</td>
                <td style={S.td}>{m.total_downtime_min}</td>
                <td style={{ ...S.td, fontWeight: 700, color: '#f59e0b' }}>{m.mttr_min}</td>
                <td style={{ ...S.td, fontWeight: 700, color: '#2563eb' }}>{m.mtbf_min}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <DrillTable
          title="Breakdown Frequency by Section"
          columns={[
            { key: 'section', label: 'Section' },
            { key: 'event_count', label: 'Events' },
            { key: 'critical_count', label: 'Critical' },
            { key: 'total_duration_min', label: 'Total Min' },
          ]}
          rows={data.breakdownFrequencyBySection || []}
        />
        <DrillTable
          title="Cost per Section"
          columns={[
            { key: 'section', label: 'Section' },
            { key: 'jobs', label: 'Jobs' },
            { key: 'totalCost', label: 'Total Cost', render: r => fmt(r.totalCost) },
            { key: 'totalHours', label: 'Total Hours' },
          ]}
          rows={data.costPerSection || []}
        />
      </div>

      <DrillTable
        title="Spares Consumption (tied to Maintenance Jobs)"
        columns={[
          { key: 'date', label: 'Date', render: r => r.date ? new Date(r.date).toLocaleDateString() : '—' },
          { key: 'machine', label: 'Machine' },
          { key: 'spareName', label: 'Spare Part' },
          { key: 'qty', label: 'Qty' },
          { key: 'cost', label: 'Cost', render: r => fmt(r.cost) },
        ]}
        rows={data.sparesConsumption || []}
      />

      <DrillTable
        title="Maintenance Job Log (transaction-level)"
        columns={[
          { key: 'date', label: 'Date', render: r => r.date ? new Date(r.date).toLocaleDateString() : '—' },
          { key: 'machine', label: 'Machine' },
          { key: 'maintenanceType', label: 'Type' },
          { key: 'description', label: 'Description' },
          { key: 'durationHours', label: 'Hours' },
          { key: 'cost', label: 'Cost', render: r => fmt(r.cost) },
          { key: 'status', label: 'Status' },
          { key: 'performedBy', label: 'Performed By' },
        ]}
        rows={logs}
      />
    </div>
  )
}

function PurchaseDetailedReportView({ data, search }) {
  const vendors = data.vendorPerformance || []
  const pos = (data.purchaseOrders || []).filter(p => !search || JSON.stringify(p).toLowerCase().includes(search.toLowerCase()))
  const aging = data.pendingAging || {}

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={S.kpiGrid}>
        <KpiCard title="POs Tracked" value={pos.length} sub={`${from_to(data)}`} icon={ShoppingCart} color="#2563eb" />
        <KpiCard title="Vendors Evaluated" value={vendors.length} sub="On-time % & spend" icon={Truck} color="#16a34a" />
        <KpiCard title="Pending PO Value (60+ days)" value={fmt(aging.bucket_60_plus_value)} sub={`${aging.bucket_60_plus_count || 0} POs`} icon={AlertTriangle} color="#ef4444" />
      </div>

      <div style={S.card}>
        <div style={S.cardTitle}>Pending PO Value — Aging Buckets</div>
        <table style={S.table}>
          <thead>
            <tr style={S.thead}>
              <th style={S.th}>0-15 Days</th>
              <th style={S.th}>16-30 Days</th>
              <th style={S.th}>31-60 Days</th>
              <th style={S.th}>60+ Days</th>
            </tr>
          </thead>
          <tbody>
            <tr style={S.tr}>
              <td style={S.td}>{fmt(aging.bucket_0_15_value)} ({aging.bucket_0_15_count || 0})</td>
              <td style={S.td}>{fmt(aging.bucket_16_30_value)} ({aging.bucket_16_30_count || 0})</td>
              <td style={{ ...S.td, color: '#f59e0b', fontWeight: 600 }}>{fmt(aging.bucket_31_60_value)} ({aging.bucket_31_60_count || 0})</td>
              <td style={{ ...S.td, color: '#dc2626', fontWeight: 700 }}>{fmt(aging.bucket_60_plus_value)} ({aging.bucket_60_plus_count || 0})</td>
            </tr>
          </tbody>
        </table>
      </div>

      <DrillTable
        title="Vendor Performance — On-Time % & Spend"
        columns={[
          { key: 'vendor', label: 'Vendor' },
          { key: 'rating', label: 'Rating' },
          { key: 'totalPos', label: 'Total POs' },
          { key: 'totalGrns', label: 'GRNs' },
          { key: 'onTimePct', label: 'On-Time %', render: r => r.onTimePct != null ? `${r.onTimePct}%` : '—' },
          { key: 'totalSpend', label: 'Total Spend', render: r => fmt(r.totalSpend) },
        ]}
        rows={vendors}
      />

      <DrillTable
        title="Spend by Material Category"
        columns={[
          { key: 'category', label: 'Category' },
          { key: 'poCount', label: 'PO Count' },
          { key: 'totalSpend', label: 'Total Spend', render: r => fmt(r.totalSpend) },
        ]}
        rows={data.spendByCategory || []}
      />

      <DrillTable
        title="PO Cycle Time — Raise → Approve → GRN"
        columns={[
          { key: 'poNumber', label: 'PO No' },
          { key: 'indentDate', label: 'Indent Date', render: r => r.indentDate ? new Date(r.indentDate).toLocaleDateString() : '—' },
          { key: 'poDate', label: 'PO Date', render: r => r.poDate ? new Date(r.poDate).toLocaleDateString() : '—' },
          { key: 'firstGrnDate', label: 'First GRN', render: r => r.firstGrnDate ? new Date(r.firstGrnDate).toLocaleDateString() : 'Pending' },
          { key: 'raiseToApproveDays', label: 'Raise→Approve (days)' },
          { key: 'approveToGrnDays', label: 'Approve→GRN (days)' },
          { key: 'totalCycleDays', label: 'Total Cycle (days)' },
        ]}
        rows={data.cycleTime || []}
      />

      <DrillTable
        title="Purchase Order Register (transaction-level)"
        columns={[
          { key: 'poNumber', label: 'PO No' },
          { key: 'date', label: 'Date', render: r => r.date ? new Date(r.date).toLocaleDateString() : '—' },
          { key: 'vendor', label: 'Vendor' },
          { key: 'status', label: 'Status' },
          { key: 'grandTotal', label: 'Grand Total', render: r => fmt(r.grandTotal) },
        ]}
        rows={pos}
      />
    </div>
  )
}

function FinanceDetailedReportView({ data, search }) {
  const payments = (data.payments || []).filter(p => !search || JSON.stringify(p).toLowerCase().includes(search.toLowerCase()))
  const aging = data.paymentAging || {}
  const pvc = data.pendingVsConfirmed || []
  const pending = pvc.find(x => x.status === 'Pending')
  const confirmed = pvc.find(x => x.status === 'Confirmed')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={S.kpiGrid}>
        <KpiCard title="Pending Payments" value={fmt(pending?.totalAmount)} sub={`${pending?.count || 0} transactions`} icon={Clock} color="#f59e0b" />
        <KpiCard title="Confirmed Payments" value={fmt(confirmed?.totalAmount)} sub={`${confirmed?.count || 0} transactions`} icon={CheckCircle2} color="#16a34a" />
        <KpiCard title="60+ Day Aging" value={fmt(aging.bucket_60_plus_value)} sub={`${aging.bucket_60_plus_count || 0} pending`} icon={AlertTriangle} color="#ef4444" />
      </div>

      <div style={S.card}>
        <div style={S.cardTitle}>Payment Aging — Pending Receivables</div>
        <table style={S.table}>
          <thead>
            <tr style={S.thead}>
              <th style={S.th}>0-15 Days</th>
              <th style={S.th}>16-30 Days</th>
              <th style={S.th}>31-60 Days</th>
              <th style={S.th}>60+ Days</th>
            </tr>
          </thead>
          <tbody>
            <tr style={S.tr}>
              <td style={S.td}>{fmt(aging.bucket_0_15_value)} ({aging.bucket_0_15_count || 0})</td>
              <td style={S.td}>{fmt(aging.bucket_16_30_value)} ({aging.bucket_16_30_count || 0})</td>
              <td style={{ ...S.td, color: '#f59e0b', fontWeight: 600 }}>{fmt(aging.bucket_31_60_value)} ({aging.bucket_31_60_count || 0})</td>
              <td style={{ ...S.td, color: '#dc2626', fontWeight: 700 }}>{fmt(aging.bucket_60_plus_value)} ({aging.bucket_60_plus_count || 0})</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <DrillTable
          title="Department-Wise Spend Rollup"
          columns={[
            { key: 'department', label: 'Department' },
            { key: 'poCount', label: 'PO Count' },
            { key: 'totalSpend', label: 'Total Spend', render: r => fmt(r.totalSpend) },
          ]}
          rows={data.departmentSpend || []}
        />
        <DrillTable
          title="Monthly Cash Outflow Trend"
          columns={[
            { key: 'month', label: 'Month' },
            { key: 'poCount', label: 'PO Count' },
            { key: 'outflow', label: 'Outflow', render: r => fmt(r.outflow) },
          ]}
          rows={data.monthlyOutflowTrend || []}
        />
      </div>

      <DrillTable
        title="Payment Register (transaction-level)"
        columns={[
          { key: 'paymentNumber', label: 'Payment No' },
          { key: 'paymentDate', label: 'Date', render: r => r.paymentDate ? new Date(r.paymentDate).toLocaleDateString() : '—' },
          { key: 'customer', label: 'Customer' },
          { key: 'amount', label: 'Amount', render: r => fmt(r.amount) },
          { key: 'paymentMode', label: 'Mode' },
          { key: 'status', label: 'Status' },
        ]}
        rows={payments}
      />
    </div>
  )
}

function EhsDetailedReportView({ data, search }) {
  const incidents = (data.incidents || []).filter(i => !search || JSON.stringify(i).toLowerCase().includes(search.toLowerCase()))
  const rate = data.incidentRate || {}

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={S.kpiGrid}>
        <KpiCard title="Total Incidents" value={rate.totalIncidents || 0} sub={`${rate.highSeverity || 0} high/critical`} icon={AlertTriangle} color="#ef4444" />
        <KpiCard title="Open Incidents" value={rate.openCount || 0} sub={`${rate.closedCount || 0} closed`} icon={Clock} color="#f59e0b" />
        <KpiCard title="Monthly Incident Rate" value={rate.monthlyIncidentRate || 0} sub="Incidents / month" icon={ShieldCheck} color="#2563eb" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <DrillTable
          title="Near-Miss Trend (Monthly)"
          columns={[
            { key: 'month', label: 'Month' },
            { key: 'nearMisses', label: 'Near Misses' },
            { key: 'totalIncidents', label: 'Total Incidents' },
          ]}
          rows={data.nearMissTrend || []}
        />
        <DrillTable
          title="Incidents by Department"
          columns={[
            { key: 'department', label: 'Department' },
            { key: 'totalIncidents', label: 'Total' },
            { key: 'nearMisses', label: 'Near Misses' },
            { key: 'openCount', label: 'Open' },
          ]}
          rows={data.byDepartment || []}
        />
      </div>

      <DrillTable
        title="Specific Power Consumption Trend (Units / MT)"
        columns={[
          { key: 'date', label: 'Date', render: r => r.date ? new Date(r.date).toLocaleDateString() : '—' },
          { key: 'powerUnits', label: 'Power Units' },
          { key: 'producedMt', label: 'Produced (MT)', render: r => fmtNum(r.producedMt, 2) },
          { key: 'specificPowerPerMt', label: 'Units / MT' },
        ]}
        rows={data.specificPowerTrend || []}
      />

      <DrillTable
        title="EHS Incident Register (transaction-level)"
        columns={[
          { key: 'incidentNumber', label: 'Incident No' },
          { key: 'date', label: 'Date', render: r => r.date ? new Date(r.date).toLocaleDateString() : '—' },
          { key: 'incidentType', label: 'Type' },
          { key: 'severity', label: 'Severity' },
          { key: 'department', label: 'Department' },
          { key: 'status', label: 'Status' },
          { key: 'location', label: 'Location' },
        ]}
        rows={incidents}
      />
    </div>
  )
}

// ── REUSABLE KPI CARD ────────────────────────────────────────────────────────
function KpiCard({ title, value, sub, icon: Icon, color = '#2563eb' }) {
  return (
    <div style={S.kpiCard}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={S.kpiTitle}>{title}</div>
        <div style={{ ...S.kpiIcon, background: `${color}15`, color }}>
          <Icon size={18} />
        </div>
      </div>
      <div style={S.kpiVal}>{value}</div>
      <div style={S.kpiSub}>{sub}</div>
    </div>
  )
}

// ── STYLES ───────────────────────────────────────────────────────────────────
const S = {
  page: { padding: '20px 24px', background: '#f8f8f6', minHeight: '100vh', color: '#1b1b1d', fontFamily: 'system-ui, -apple-system, sans-serif' },
  headerBar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 },
  title: { fontSize: 22, fontWeight: 800, color: '#1b1b1d', letterSpacing: '-0.02em' },
  subtitle: { fontSize: 13, color: '#6b7280', marginTop: 2 },
  btnEodAction: { display: 'flex', alignItems: 'center', gap: 8, background: '#16a34a', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 16px', fontWeight: 700, fontSize: 13, cursor: 'pointer', boxShadow: '0 2px 4px rgba(22,163,74,0.25)' },
  btnWhatsApp: { display: 'flex', alignItems: 'center', gap: 8, background: '#25D366', color: '#ffffff', border: 'none', borderRadius: 8, padding: '9px 16px', fontWeight: 700, fontSize: 13, cursor: 'pointer', boxShadow: '0 2px 6px rgba(37,211,102,0.35)' },
  btnSecondary: { display: 'flex', alignItems: 'center', gap: 6, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 600, color: '#374151', cursor: 'pointer' },
  btnPrimary: { background: '#1b1b1d', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontWeight: 600, fontSize: 13, cursor: 'pointer' },
  btnIcon: { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 9, cursor: 'pointer', color: '#374151', display: 'flex', alignItems: 'center', justifyContent: 'center' },

  layoutGrid: { display: 'grid', gridTemplateColumns: '260px 1fr', gap: 20, alignItems: 'start' },
  sidebar: { background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: 14, display: 'flex', flexDirection: 'column', gap: 12 },
  sidebarTitle: { fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#9ca3af', padding: '4px 8px' },
  sidebarNav: { display: 'flex', flexDirection: 'column', gap: 4 },
  navBtn: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', padding: '9px 10px', borderRadius: 8, border: 'none', background: 'transparent', cursor: 'pointer', transition: 'all 0.15s' },
  navBtnActive: { background: '#f3f4f6', fontWeight: 700 },
  iconBox: { width: 30, height: 30, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  activeIndicator: { width: 4, height: 20, background: '#1b1b1d', borderRadius: 2 },
  sidebarFooterCard: { background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: 12, marginTop: 10 },

  contentPane: { display: 'flex', flexDirection: 'column', gap: 16 },
  filterCard: { background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14 },
  presetBtn: { background: '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: 6, padding: '5px 10px', fontSize: 12, fontWeight: 600, color: '#4b5563', cursor: 'pointer' },
  presetActive: { background: '#1b1b1d', color: '#fff', borderColor: '#1b1b1d' },
  filterLabel: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: '#4b5563' },
  dateInput: { background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 6, padding: '6px 8px', fontSize: 12, color: '#1b1b1d' },
  input: { background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 6, padding: '6px 10px', fontSize: 13, color: '#1b1b1d', outline: 'none' },
  select: { background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 6, padding: '6px 10px', fontSize: 12, color: '#1b1b1d', outline: 'none' },
  label: { display: 'flex', flexDirection: 'column', gap: 5, fontSize: 12, fontWeight: 600, color: '#374151' },

  kpiGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 },
  kpiCard: { background: '#fff', borderRadius: 10, border: '1px solid #e5e7eb', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 4 },
  kpiTitle: { fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.03em' },
  kpiVal: { fontSize: 20, fontWeight: 800, color: '#1b1b1d' },
  kpiSub: { fontSize: 11, color: '#9ca3af' },
  kpiIcon: { width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' },

  card: { background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: 18, overflow: 'hidden' },
  cardTitle: { fontSize: 14, fontWeight: 700, color: '#1b1b1d', marginBottom: 12 },
  metricBlock: { background: '#f9fafb', border: '1px solid #f3f4f6', borderRadius: 8, padding: 10 },
  metricLabel: { fontSize: 11, color: '#6b7280', textTransform: 'uppercase', fontWeight: 600 },
  metricVal: { fontSize: 16, fontWeight: 800, color: '#1b1b1d', marginTop: 4 },

  table: { width: '100%', borderCollapse: 'collapse', fontSize: 12 },
  thead: { background: '#f9fafb', borderBottom: '1px solid #e5e7eb' },
  th: { textAlign: 'left', padding: '9px 12px', fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em' },
  tr: { borderBottom: '1px solid #f3f4f6' },
  td: { padding: '9px 12px', color: '#1b1b1d' },
  tdEmpty: { padding: 30, textAlign: 'center', color: '#9ca3af', fontStyle: 'italic' },

  eodBanner: { background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 },
  eodSummaryBox: { background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: 14 },

  loadingCard: { background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: 40, textAlign: 'center', color: '#6b7280', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 },
  errorBox: { background: '#fee2e2', border: '1px solid #fca5a5', color: '#991b1b', padding: '10px 14px', borderRadius: 8, fontSize: 13 },

  modalOverlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 20 },
  modalCard: { background: '#fff', borderRadius: 14, padding: 24, width: '100%', maxWidth: 580, boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)' },
  modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalClose: { background: 'none', border: 'none', fontSize: 18, color: '#9ca3af', cursor: 'pointer' },
  modalFooter: { display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 },

  whatsAppPreviewBox: { background: '#efeae2', borderRadius: 10, padding: 14, maxHeight: 280, overflowY: 'auto', border: '1px solid #d1d7db' },
  whatsAppBubble: { background: '#ffffff', borderRadius: 8, padding: '12px 14px', fontSize: 12, lineHeight: 1.6, color: '#111b21', whiteSpace: 'pre-wrap', fontFamily: 'system-ui, sans-serif', boxShadow: '0 1px 2px rgba(0,0,0,0.1)' }
}

function PlantSectionsDetailedReportView({ data, search }) {
  const [selectedSec, setSelectedSec] = useState('')
  const [exportModal, setExportModal] = useState(false)
  const sections = data?.sections || []
  const kpis = data?.kpis || {}
  const rawItems = data?.granularItems || []

  const filteredItems = useMemo(() => {
    return rawItems.filter(it => {
      if (selectedSec && String(it.sectionId) !== String(selectedSec)) return false
      if (search) {
        const s = search.toLowerCase()
        return (
          (it.materialName || '').toLowerCase().includes(s) ||
          (it.materialCode || '').toLowerCase().includes(s) ||
          (it.sectionName || '').toLowerCase().includes(s) ||
          (it.equipmentName || '').toLowerCase().includes(s) ||
          (it.categoryName || '').toLowerCase().includes(s) ||
          (it.binLocation || '').toLowerCase().includes(s)
        )
      }
      return true
    })
  }, [rawItems, selectedSec, search])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* KPI Overview Cards */}
      <div style={S.kpiGrid}>
        <KpiCard
          title="Plant Sections"
          value={sections.length}
          sub="Active mill production sections"
          icon={Layers}
          color="#0284c7"
        />
        <KpiCard
          title="Section Materials Tracked"
          value={kpis.totalMaterials || rawItems.length}
          sub="Granular items provisioned"
          icon={Boxes}
          color="#2563eb"
        />
        <KpiCard
          title="Total Stock Valuation"
          value={`₹${Number(kpis.totalValuation || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          sub="Live computation from stock ledger"
          icon={TrendingUp}
          color="#16a34a"
        />
        <KpiCard
          title="Period Consumption"
          value={`₹${Number(kpis.totalConsumptionValue || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          sub={`${kpis.fromDate || ''} to ${kpis.toDate || ''}`}
          icon={Flame}
          color="#ea580c"
        />
        <KpiCard
          title="Period Inward Receipts"
          value={`₹${Number(kpis.totalInwardValue || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          sub="GRN Inward additions"
          icon={ShoppingCart}
          color="#0f766e"
        />
        <KpiCard
          title="Critical Low Stock"
          value={kpis.lowStockCount || 0}
          sub="Stock ≤ Reorder level"
          icon={AlertTriangle}
          color="#ef4444"
        />
      </div>

      {/* Section Summary Cards */}
      <div style={S.card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div>
            <div style={S.cardTitle}>Plant Sections Rollup & Valuation</div>
            <div style={{ fontSize: 12, color: '#64748b' }}>Click any plant section to filter granular items below</div>
          </div>
          {selectedSec && (
            <button
              style={{ ...S.btnGhost, padding: '4px 10px', fontSize: 12, color: '#0284c7' }}
              onClick={() => setSelectedSec('')}
            >
              ✕ Clear Section Filter
            </button>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
          {sections.map(sec => {
            const isSelected = String(selectedSec) === String(sec.sectionId)
            return (
              <div
                key={sec.sectionId}
                onClick={() => setSelectedSec(isSelected ? '' : sec.sectionId)}
                style={{
                  background: isSelected ? '#eff6ff' : '#f8fafc',
                  border: isSelected ? '2px solid #2563eb' : '1px solid #e2e8f0',
                  borderRadius: 10,
                  padding: 14,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease-in-out',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  boxShadow: isSelected ? '0 4px 12px rgba(37,99,235,0.12)' : 'none'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 20 }}>{sec.sectionIcon}</span>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a' }}>{sec.sectionName}</div>
                      <div style={{ fontSize: 11, color: '#64748b' }}>{sec.sectionCode} · {sec.departmentName || 'General'}</div>
                    </div>
                  </div>
                  <span style={{ fontSize: 11, background: '#e2e8f0', padding: '2px 6px', borderRadius: 4, fontWeight: 600 }}>
                    {sec.materialCount} items
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, paddingTop: 4, borderTop: '1px dashed #cbd5e1', fontSize: 11 }}>
                  <div>
                    <span style={{ color: '#64748b' }}>Stock Valuation:</span>
                    <div style={{ fontWeight: 700, color: '#16a34a' }}>
                      ₹{Number(sec.totalValuation || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                    </div>
                  </div>
                  <div>
                    <span style={{ color: '#64748b' }}>Consumed Val:</span>
                    <div style={{ fontWeight: 700, color: '#ea580c' }}>
                      ₹{Number(sec.periodConsumedVal || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Granular Table */}
      <div style={S.card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={S.cardTitle}>
            Granular Equipment & Material Matrix {selectedSec ? `— (Filtered: ${sections.find(s => String(s.sectionId) === String(selectedSec))?.sectionName || ''})` : ''}
            <span style={{ fontSize: 12, fontWeight: 500, color: '#64748b', marginLeft: 8 }}>({filteredItems.length} records)</span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              style={{ ...S.btnPrimary, background: '#0f766e' }}
              onClick={() => setExportModal(true)}
              title="Download Multi-Sheet Categorized Excel Inventory Master"
            >
              <FileSpreadsheet size={14} /> Excel Master
            </button>
            <button
              style={S.btnPrimary}
              onClick={() => {
                const p = new URLSearchParams({
                  format: 'csv',
                  from: data?.kpis?.fromDate || today,
                  to: data?.kpis?.toDate || today
                })
                if (selectedSec) p.set('section_id', selectedSec)
                window.open(`/api/reports/plant-sections/detailed?${p}`, '_blank')
              }}
            >
              <Download size={14} /> Download Granular CSV
            </button>
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={S.table}>
            <thead>
              <tr style={S.thead}>
                <th style={S.th}>Plant Section</th>
                <th style={S.th}>Machine / Equipment</th>
                <th style={S.th}>Material Item</th>
                <th style={S.th}>Category & Bin</th>
                <th style={{ ...S.th, textAlign: 'right' }}>Unit Price</th>
                <th style={{ ...S.th, textAlign: 'right' }}>Current Stock</th>
                <th style={{ ...S.th, textAlign: 'right' }}>Valuation</th>
                <th style={{ ...S.th, textAlign: 'right' }}>Period Consumed</th>
                <th style={{ ...S.th, textAlign: 'right' }}>Period Inward</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={9} style={S.tdEmpty}>No items match the selected plant section / filter.</td>
                </tr>
              ) : (
                filteredItems.map(it => (
                  <tr key={it.materialId} style={S.tr}>
                    <td style={S.td}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span>{it.sectionIcon || '🏭'}</span>
                        <div>
                          <span style={{ fontWeight: 600, color: '#0f172a' }}>{it.sectionName || 'Unassigned'}</span>
                          <div style={{ fontSize: 10, color: '#64748b' }}>{it.sectionCode || '—'} {it.departmentName ? `· ${it.departmentName}` : ''}</div>
                        </div>
                      </div>
                    </td>
                    <td style={S.td}>
                      <div style={{ fontWeight: 600, color: '#0369a1' }}>{it.machineName ? `⚡ ${it.machineName}` : '—'}</div>
                      {it.equipmentName && (
                        <div style={{ fontSize: 11, color: '#334155', marginTop: 2 }}>
                          <span>⚙️ {it.tagName ? `[${it.tagName}] ` : ''}{it.equipmentName}</span>
                          {(it.bearingSize || it.beltNo) && (
                            <div style={{ fontSize: 10, color: '#0f766e', fontWeight: 600 }}>
                              {[it.bearingSize ? `Brg: ${it.bearingSize}` : null, it.beltNo ? `Belt: ${it.beltNo}` : null].filter(Boolean).join(' | ')}
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                    <td style={S.td}>
                      <div style={{ fontWeight: 600, color: '#1e293b' }}>{it.materialName}</div>
                      <div style={{ fontSize: 11, color: '#64748b', fontFamily: 'monospace' }}>{it.materialCode}</div>
                    </td>
                    <td style={S.td}>
                      <div>{it.categoryName || 'General'}</div>
                      <span style={{ fontSize: 10, background: '#f1f5f9', padding: '1px 5px', borderRadius: 3, color: '#475569' }}>
                        📍 {it.binLocation || '—'}
                      </span>
                    </td>
                    <td style={{ ...S.td, textAlign: 'right' }}>
                      ₹{Number(it.unitPrice || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td style={{ ...S.td, textAlign: 'right' }}>
                      <span style={{ fontWeight: 700, color: Number(it.currentStock) <= Number(it.minStock) ? '#dc2626' : '#0f172a' }}>
                        {Number(it.currentStock || 0).toFixed(2)} {it.uom}
                      </span>
                    </td>
                    <td style={{ ...S.td, textAlign: 'right', fontWeight: 700, color: '#16a34a' }}>
                      ₹{Number(it.stockValuation || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td style={{ ...S.td, textAlign: 'right' }}>
                      <div style={{ fontWeight: 600, color: '#ea580c' }}>
                        {Number(it.consumedQty || 0).toFixed(2)} {it.uom}
                      </div>
                      <div style={{ fontSize: 10, color: '#64748b' }}>
                        ₹{Number(it.consumedValue || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                      </div>
                    </td>
                    <td style={{ ...S.td, textAlign: 'right' }}>
                      <div style={{ fontWeight: 600, color: '#0f766e' }}>
                        {Number(it.inwardQty || 0).toFixed(2)} {it.uom}
                      </div>
                      <div style={{ fontSize: 10, color: '#64748b' }}>
                        ₹{Number(it.inwardValue || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── ENTERPRISE INVENTORY EXCEL EXPORTER MODAL ── */}
      <InventoryExportModal
        isOpen={exportModal}
        onClose={() => setExportModal(false)}
      />
    </div>
  )
}

