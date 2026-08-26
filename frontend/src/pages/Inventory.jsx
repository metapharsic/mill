import React, { useEffect, useMemo, useState, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import ProductDetailModal from '../components/ProductDetailModal'
import InventoryExportModal from '../components/InventoryExportModal'
import SearchableSelect from '../components/SearchableSelect'
import SortableTh from '../components/SortableTh'
import TableScrollWrapper from '../components/TableScrollWrapper'
import ScrollableTabs from '../components/ScrollableTabs'
import { sortTableData } from '../utils/tableSort'
import {
  Boxes, Search, Filter, AlertTriangle, ArrowDownRight, ArrowUpRight,
  TrendingUp, RefreshCw, Layers, CheckCircle2, ShieldCheck, Zap,
  Factory, Package, FileText, ShoppingCart, Clock, ExternalLink, FileSpreadsheet
} from 'lucide-react'
import { LOGO_DATA_URI } from '../utils/logo'

const API = (path, opts = {}) => fetch(path, {
  headers: { Authorization: `Bearer ${localStorage.getItem('mk_token')}`, 'Content-Type': 'application/json', ...(opts.headers || {}) },
  ...opts,
}).then(async (r) => {
  const data = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(data.message || 'Request failed')
  return data
})

const STORE_TABS = [
  { id: 'store', label: 'All Store Inventory', icon: Boxes, desc: 'Mechanical, Electrical, Chemical, Spares & Consumables' },
  { id: 'mechanical', label: 'Mechanical Store', icon: Factory, desc: 'Bearings, Oil Seals, Valves, Belts, Couplings, Pipes' },
  { id: 'electrical', label: 'Electrical Store', icon: Zap, desc: 'Contactors, Relays, MCBs, VFDs, Fuses, Cables' },
  { id: 'chemical', label: 'Chemical Store', icon: Layers, desc: 'Alum, Rosin, PAC, Dyes, Sizing Chemicals' },
  { id: 'consumable', label: 'Consumables & General', icon: Package, desc: 'Stationery, General Hardware, Clothing, Tools' },
]

const ADMIN_EXTRA_TABS = [
  { id: 'all', label: 'All Organization', icon: ShieldCheck, desc: 'Complete mill-wide inventory' },
]

export default function Inventory() {
  const { user } = useAuth()
  const roleLevel = user?.role_level ?? 1
  const isStoreDept = ['Store Management', 'Store', 'Inventory', 'Raw Material Store'].includes(user?.department || '')
  const isAdmin = roleLevel >= 4

  const [activeStoreTab, setActiveStoreTab] = useState('store')
  const [activeView, setActiveView] = useState('materials') // 'materials' | 'ledger' | 'operations' | 'shifts'
  const [selectedProductModalId, setSelectedProductModalId] = useState(null)
  const [exportModal, setExportModal] = useState(false)

  // Summary state
  const [summary, setSummary] = useState(null)
  const [summaryLoading, setSummaryLoading] = useState(false)

  // Materials list state
  const [materials, setMaterials] = useState([])
  const [matTotal, setMatTotal] = useState(0)
  const [matPage, setMatPage] = useState(1)
  const [matSearch, setMatSearch] = useState('')
  const [matCategory, setMatCategory] = useState('')
  const [matColSearch, setMatColSearch] = useState({
    code: '',
    name: '',
    section: '',
    category: ''
  })
  const [lowStockOnly, setLowStockOnly] = useState(false)
  const [matLoading, setMatLoading] = useState(false)
  const [matSortBy, setMatSortBy] = useState('current_stock')
  const [matSortOrder, setMatSortOrder] = useState('desc')

  // Categories & Vendors
  const [categories, setCategories] = useState([])
  const [vendors, setVendors] = useState([])

  // Stock Ledger state
  const [ledger, setLedger] = useState([])
  const [ledgerTotal, setLedgerTotal] = useState(0)
  const [ledgerPage, setLedgerPage] = useState(1)
  const [ledgerSearch, setLedgerSearch] = useState('')
  const [ledgerTxnType, setLedgerTxnType] = useState('')
  const [ledgerLoading, setLedgerLoading] = useState(false)
  const [ledgerSortBy, setLedgerSortBy] = useState('date')
  const [ledgerSortOrder, setLedgerSortOrder] = useState('desc')

  // Shift summary state
  const [shiftSummary, setShiftSummary] = useState(null)
  const [shiftFilter, setShiftFilter] = useState('')

  // Operations Forms
  const [grnForm, setGrnForm] = useState({
    date: new Date().toISOString().split('T')[0],
    vendorId: '',
    materialId: '',
    poQty: '',
    receivedQty: '',
    acceptedQty: '',
    unitPrice: '',
    batchNumber: '',
    binLocation: '',
    remarks: '',
  })
  const [issueForm, setIssueForm] = useState({
    date: new Date().toISOString().split('T')[0],
    materialId: '',
    qty: '',
    reason: '',
    batchNumber: '',
    binLocation: '',
    remarks: '',
  })
  const [message, setMessage] = useState('')
  const [grnSaving, setGrnSaving] = useState(false)
  const [issueSaving, setIssueSaving] = useState(false)
  const [lastGrn, setLastGrn] = useState(null)
  const operationsRef = React.useRef(null)

  // Fetch summary
  const loadSummary = useCallback(async () => {
    setSummaryLoading(true)
    try {
      const res = await API(`/api/inventory/summary?store_type=${activeStoreTab}`)
      if (res.success) setSummary(res.data)
    } catch (e) {
      console.error(e)
    }
    setSummaryLoading(false)
  }, [activeStoreTab])

  // Fetch materials
  const loadMaterials = useCallback(async () => {
    setMatLoading(true)
    try {
      const p = new URLSearchParams({
        store_type: activeStoreTab,
        page: matPage,
        limit: 50,
      })
      if (matSearch) p.set('search', matSearch)
      if (matCategory) p.set('categoryId', matCategory)
      if (lowStockOnly) p.set('low_stock', 'true')
      if (matColSearch.code) p.set('col_code', matColSearch.code)
      if (matColSearch.name) p.set('col_name', matColSearch.name)
      if (matColSearch.section) p.set('col_section', matColSearch.section)
      if (matColSearch.category) p.set('col_category', matColSearch.category)

      const res = await API(`/api/inventory/materials?${p}`)
      if (res.success) {
        setMaterials(res.data || [])
        setMatTotal(res.total || 0)
      }
    } catch (e) {
      console.error(e)
    }
    setMatLoading(false)
  }, [activeStoreTab, matPage, matSearch, matCategory, lowStockOnly, matColSearch])

  // Fetch ledger
  const loadLedger = useCallback(async () => {
    setLedgerLoading(true)
    try {
      const p = new URLSearchParams({
        store_type: activeStoreTab,
        page: ledgerPage,
        limit: 25,
      })
      if (ledgerSearch) p.set('search', ledgerSearch)
      if (ledgerTxnType) p.set('transaction_type', ledgerTxnType)

      const res = await API(`/api/inventory/ledger?${p}`)
      if (res.success) {
        setLedger(res.data || [])
        setLedgerTotal(res.total || 0)
      }
    } catch (e) {
      console.error(e)
    }
    setLedgerLoading(false)
  }, [activeStoreTab, ledgerPage, ledgerSearch, ledgerTxnType])

  // Fetch base metadata
  const loadBaseMeta = async () => {
    try {
      const [catRes, venRes] = await Promise.all([
        API('/api/inventory/categories'),
        API('/api/master/vendors?limit=100&is_active=true'),
      ])
      if (catRes.success) setCategories(catRes.data || [])
      if (venRes.success) setVendors(venRes.data || [])
    } catch (e) {
      console.error(e)
    }
  }

  // Fetch shift summary
  const loadShiftSummary = async () => {
    try {
      const p = new URLSearchParams({ store_type: activeStoreTab })
      if (shiftFilter) p.set('shift', shiftFilter)
      const res = await API(`/api/inventory/ledger/shift-summary?${p}`)
      if (res.success) setShiftSummary(res.data)
    } catch (e) {
      console.error(e)
    }
  }

  useEffect(() => { loadBaseMeta() }, [])
  useEffect(() => {
    loadSummary()
    setMatPage(1)
    setLedgerPage(1)
  }, [activeStoreTab, loadSummary])

  useEffect(() => { loadMaterials() }, [loadMaterials])
  useEffect(() => { loadLedger() }, [loadLedger])
  useEffect(() => { if (roleLevel >= 3) loadShiftSummary() }, [activeStoreTab, shiftFilter, roleLevel])

  const availableTabs = useMemo(() => {
    if (isAdmin) return [...STORE_TABS, ...ADMIN_EXTRA_TABS]
    return STORE_TABS
  }, [isAdmin])

  const selectedIssueMat = useMemo(() =>
    materials.find(m => String(m.id) === String(issueForm.materialId)),
    [materials, issueForm.materialId]
  )

  const saveGrn = async (e) => {
    e.preventDefault()
    const recQty = grnForm.receivedQty ? Number(grnForm.receivedQty) : 0
    const accQty = grnForm.acceptedQty ? Number(grnForm.acceptedQty) : recQty
    if (accQty > recQty) {
      setMessage('Validation error: Accepted quantity cannot exceed received quantity.')
      return
    }
    setGrnSaving(true)
    setMessage('')
    try {
      const payload = {
        date: grnForm.date,
        vendorId: grnForm.vendorId,
        materialId: grnForm.materialId,
        poQty: grnForm.poQty ? Number(grnForm.poQty) : 0,
        receivedQty: recQty,
        acceptedQty: accQty,
        unitPrice: grnForm.unitPrice ? Number(grnForm.unitPrice) : 0,
        batchNumber: grnForm.batchNumber,
        binLocation: grnForm.binLocation,
        remarks: grnForm.remarks,
        items: [{
          materialId: grnForm.materialId,
          poQty: grnForm.poQty ? Number(grnForm.poQty) : 0,
          receivedQty: recQty,
          acceptedQty: accQty,
          unitPrice: grnForm.unitPrice ? Number(grnForm.unitPrice) : 0,
          batchNumber: grnForm.batchNumber,
          binLocation: grnForm.binLocation,
          remarks: grnForm.remarks,
        }],
      }
      const res = await API('/api/inventory/grn', { method: 'POST', body: JSON.stringify(payload) })
      setMessage(`✅ GRN successfully saved: ${res.data.grnNumber}`)
      const savedMat = materials.find(m => String(m.id) === String(grnForm.materialId))
      const savedVendor = vendors.find(v => String(v.id) === String(grnForm.vendorId))
      setLastGrn({
        grnNumber: res.data.grnNumber,
        date: grnForm.date,
        vendorName: savedVendor?.name || '—',
        materialCode: savedMat?.code || '—',
        materialName: savedMat?.name || '—',
        poQty: grnForm.poQty || 0,
        receivedQty: recQty,
        acceptedQty: accQty,
        unitPrice: grnForm.unitPrice || 0,
        batchNumber: grnForm.batchNumber,
        binLocation: grnForm.binLocation,
        remarks: grnForm.remarks,
      })
      setGrnForm({
        date: new Date().toISOString().split('T')[0],
        vendorId: '',
        materialId: '',
        poQty: '',
        receivedQty: '',
        acceptedQty: '',
        unitPrice: '',
        batchNumber: '',
        binLocation: '',
        remarks: '',
      })
      loadSummary()
      loadMaterials()
      loadLedger()
    } catch (err) {
      setMessage(`❌ ${err.message}`)
    } finally {
      setGrnSaving(false)
    }
  }

  const printGrnInvoice = (grn) => {
    const w = window.open('', '_blank')
    if (!w) return
    const total = (Number(grn.acceptedQty || 0) * Number(grn.unitPrice || 0)).toLocaleString('en-IN', { maximumFractionDigits: 2 })
    w.document.write(`<!DOCTYPE html><html><head><title>GRN Inward Invoice ${grn.grnNumber}</title>
    <style>
      @page { size: A4; margin: 14mm; }
      * { box-sizing: border-box; font-family: 'Segoe UI', Arial, sans-serif; }
      body { margin: 0; color: #1b1b1d; position: relative; }
      .watermark-img { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 400px; height: 400px; opacity: 0.06; z-index: 0; pointer-events: none; }
      .sheet { position: relative; z-index: 1; }
      .head { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #0f766e; padding-bottom: 14px; margin-bottom: 18px; }
      .logo { font-size: 22px; font-weight: 900; color: #0f766e; letter-spacing: 0.5px; }
      .logo span { color: #1b1b1d; }
      .sub { font-size: 11px; color: #6b7280; margin-top: 2px; }
      .doc-title { text-align: right; }
      .doc-title h2 { margin: 0; color: #0f766e; font-size: 18px; }
      .doc-title .num { font-family: monospace; font-weight: 700; font-size: 14px; }
      table { width: 100%; border-collapse: collapse; margin-top: 14px; }
      th, td { border: 1px solid #d1d5db; padding: 8px 10px; font-size: 12px; text-align: left; }
      th { background: #ecfdf5; color: #0f766e; font-weight: 700; }
      .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 40px; margin-top: 10px; font-size: 12px; }
      .meta-grid b { color: #374151; }
      .totals { text-align: right; margin-top: 16px; font-size: 14px; font-weight: 700; color: #0f766e; }
      .sign { display: flex; justify-content: space-between; margin-top: 60px; font-size: 11px; }
      .sign div { border-top: 1px solid #9ca3af; width: 180px; padding-top: 6px; text-align: center; }
      .footer { margin-top: 30px; font-size: 10px; color: #9ca3af; text-align: center; }
    </style></head><body>
    <img src="${LOGO_DATA_URI}" class="watermark-img" alt="Watermark" />
    <div class="sheet">
      <div class="head">
        <div style="display:flex;align-items:center;gap:12px;">
          <img src="${LOGO_DATA_URI}" style="width:48px;height:48px;object-fit:contain;border-radius:6px;border:1px solid #e2e8f0;background:#fff;padding:2px;" />
          <div>
            <div class="logo">SRI M.K. <span>PAPER MILLS PVT. LTD.</span></div>
            <div class="sub">Store Department — Goods Received Note (Inward Invoice)</div>
          </div>
        </div>
        <div class="doc-title">
          <h2>INWARD GRN INVOICE</h2>
          <div class="num">${grn.grnNumber}</div>
        </div>
      </div>
      <div class="meta-grid">
        <div><b>Date:</b> ${grn.date}</div>
        <div><b>Vendor / Supplier:</b> ${grn.vendorName}</div>
        <div><b>Bin / Rack Location:</b> ${grn.binLocation || '—'}</div>
        <div><b>Batch / Lot No:</b> ${grn.batchNumber || '—'}</div>
      </div>
      <table>
        <thead><tr>
          <th>Material Code</th><th>Material Name</th><th>PO Qty</th><th>Received Qty</th><th>Accepted Qty</th><th>Unit Price (₹)</th><th>Value (₹)</th>
        </tr></thead>
        <tbody><tr>
          <td>${grn.materialCode}</td><td>${grn.materialName}</td><td>${grn.poQty}</td><td>${grn.receivedQty}</td><td>${grn.acceptedQty}</td>
          <td>₹${Number(grn.unitPrice || 0).toLocaleString('en-IN')}</td><td>₹${total}</td>
        </tr></tbody>
      </table>
      <div class="totals">Total Value: ₹${total}</div>
      <div class="meta-grid" style="margin-top:20px;"><div style="grid-column: span 2;"><b>Remarks:</b> ${grn.remarks || '—'}</div></div>
      <div class="sign">
        <div>Store Keeper Signature</div>
        <div>Quality / Received By</div>
        <div>Store Manager Approval</div>
      </div>
      <div class="footer">Generated by MK Paper Mill ERP — Store Module — Printed on ${new Date().toLocaleString('en-IN')}</div>
    </div>
    <script>window.onload = () => window.print()</script>
    </body></html>`)
    w.document.close()
  }

  const saveIssue = async (e) => {
    e.preventDefault()
    const issueQty = Number(issueForm.qty || 0)
    if (selectedIssueMat && issueQty > Number(selectedIssueMat.currentStock || 0)) {
      setMessage(`Validation error: Cannot issue ${issueQty} ${selectedIssueMat.uom || ''}. Only ${selectedIssueMat.currentStock} in stock.`)
      return
    }
    setIssueSaving(true)
    setMessage('')
    try {
      const payload = {
        date: issueForm.date,
        materialId: issueForm.materialId,
        qty: issueQty,
        reason: issueForm.reason,
        batchNumber: issueForm.batchNumber,
        binLocation: issueForm.binLocation,
        remarks: issueForm.remarks,
      }
      const res = await API('/api/inventory/issue', { method: 'POST', body: JSON.stringify(payload) })
      setMessage(`✅ Material issued: ${res.data.issuedQty} unit(s)`)
      setIssueForm({
        date: new Date().toISOString().split('T')[0],
        materialId: '',
        qty: '',
        reason: '',
        batchNumber: '',
        binLocation: '',
        remarks: '',
      })
      loadSummary()
      loadMaterials()
      loadLedger()
    } catch (err) {
      setMessage(`❌ ${err.message}`)
    } finally {
      setIssueSaving(false)
    }
  }

  const activeTabMeta = availableTabs.find(t => t.id === activeStoreTab) || availableTabs[0]

  return (
    <div style={S.page}>
      {/* Top Header */}
      <div style={S.headerBar}>
        <div>
          <div style={S.title}>Store Inventory & Live Stock Ledger</div>
          <div style={S.subtitle}>
            {user?.department ? `${user.department} Departmental Inventory` : 'Plant Inventory Management'} — {activeTabMeta.desc}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button
            style={{ ...S.btnRefresh, background: 'linear-gradient(135deg, #0f766e, #0e7490)', color: '#fff', border: 'none', fontWeight: 700, boxShadow: '0 2px 4px rgba(15,118,110,0.2)' }}
            onClick={() => setSelectedProductModalId('new')}
            title="Create New Store Catalog Material"
          >
            <Boxes size={14} /> <span>+ Add Material</span>
          </button>
          <button
            style={{ ...S.btnRefresh, background: '#f0fdfa', borderColor: '#0f766e', color: '#0f766e', fontWeight: 700 }}
            onClick={() => setExportModal(true)}
            title="Download Comprehensive Multi-Sheet Excel Master"
          >
            <FileSpreadsheet size={14} /> <span>Excel Master Export</span>
          </button>
          <button style={S.btnRefresh} onClick={() => { loadSummary(); loadMaterials(); loadLedger() }}>
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      {/* Store Scoping Tabs (Mechanical, Electrical, Consumable, All Store) */}
      <div style={{ marginBottom: 14 }}>
        <ScrollableTabs
          tabs={availableTabs}
          activeTab={activeStoreTab}
          onSelectTab={setActiveStoreTab}
          renderTab={(t, isActive) => {
            const Icon = t.icon
            return (
              <button
                key={t.id}
                style={{ ...S.tabBtn, ...(isActive ? S.tabBtnActive : {}) }}
                onClick={() => setActiveStoreTab(t.id)}
              >
                <Icon size={16} />
                <span>{t.label}</span>
              </button>
            )
          }}
        />
      </div>

      {message && (
        <div style={{ ...S.message, background: message.startsWith('❌') ? '#fee2e2' : '#ecfeff', color: message.startsWith('❌') ? '#dc2626' : '#0f766e' }}>
          {message}
        </div>
      )}

      {/* Real-Time Store KPIs */}
      <div style={S.statsGrid}>
        <div style={S.statCard}>
          <div style={S.statHeader}>
            <span style={S.statLabel}>Store Catalog Items</span>
            <Boxes size={18} color="#0f766e" />
          </div>
          <div style={S.statValue}>{summary?.totalMaterials?.toLocaleString('en-IN') ?? '—'}</div>
          <div style={S.statSub}>Active items in {activeTabMeta.label}</div>
        </div>

        <div style={{ ...S.statCard, borderLeft: (summary?.lowStock ?? 0) > 0 ? '4px solid #ef4444' : undefined }}>
          <div style={S.statHeader}>
            <span style={S.statLabel}>Low Stock / Reorder</span>
            <AlertTriangle size={18} color={summary?.lowStock > 0 ? '#ef4444' : '#16a34a'} />
          </div>
          <div style={{ ...S.statValue, color: (summary?.lowStock ?? 0) > 0 ? '#ef4444' : '#16a34a' }}>
            {summary?.lowStock?.toLocaleString('en-IN') ?? '0'}
          </div>
          <div style={S.statSub}>Items below safety reorder level</div>
        </div>

        <div style={S.statCard}>
          <div style={S.statHeader}>
            <span style={S.statLabel}>Total Store Valuation</span>
            <TrendingUp size={18} color="#0f766e" />
          </div>
          <div style={{ ...S.statValue, color: '#0f766e' }}>
            ₹{summary?.totalValuation ? Number(summary.totalValuation).toLocaleString('en-IN', { maximumFractionDigits: 0 }) : '0'}
          </div>
          <div style={S.statSub}>Computed live from active stock</div>
        </div>

        <div style={S.statCard}>
          <div style={S.statHeader}>
            <span style={S.statLabel}>Pending Inward GRNs</span>
            <ShoppingCart size={18} color="#854d0e" />
          </div>
          <div style={S.statValue}>{summary?.pendingGrn ?? 0}</div>
          <div style={S.statSub}>Draft or QC verification</div>
        </div>
      </div>

      {/* Sub View Selector: Materials Table | Stock Ledger | Quick GRN / Issue */}
      <div style={S.subViewNav}>
        <button
          style={{ ...S.subViewBtn, ...(activeView === 'materials' ? S.subViewBtnActive : {}) }}
          onClick={() => setActiveView('materials')}
        >
          <Boxes size={15} /> Store Items Catalog ({matTotal})
        </button>
        <button
          style={{ ...S.subViewBtn, ...(activeView === 'ledger' ? S.subViewBtnActive : {}) }}
          onClick={() => setActiveView('ledger')}
        >
          <FileText size={15} /> Live Stock Ledger ({ledgerTotal})
        </button>
        <button
          style={{ ...S.subViewBtn, ...(activeView === 'operations' ? S.subViewBtnActive : {}) }}
          onClick={() => {
            setActiveView('operations')
            setTimeout(() => operationsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
          }}
        >
          <ArrowDownRight size={15} /> Quick GRN & Issue Desks
        </button>
        {roleLevel >= 3 && (
          <button
            style={{ ...S.subViewBtn, ...(activeView === 'shifts' ? S.subViewBtnActive : {}) }}
            onClick={() => setActiveView('shifts')}
          >
            <Clock size={15} /> Shift Movement & High-Txn Audit
          </button>
        )}
      </div>

      {/* VIEW 1: STORE MATERIALS CATALOG */}
      {activeView === 'materials' && (
        <div style={S.card}>
          <div style={S.tableControlBar}>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={S.searchBox}>
                <Search size={15} color="#8a8a90" />
                <input
                  style={S.searchInput}
                  placeholder="Search item code, name, specification..."
                  value={matSearch}
                  onChange={(e) => { setMatSearch(e.target.value); setMatPage(1) }}
                />
              </div>

              <SearchableSelect
                value={String(matCategory || '')}
                onChange={(val) => { setMatCategory(val); setMatPage(1) }}
                placeholder={`All Categories (${categories.length})`}
                searchPlaceholder="Type category name..."
                style={{ minWidth: 200 }}
                options={categories.map(c => ({ value: String(c.id), label: `${c.name} (${c.type || 'Store'})` }))}
              />

              <button
                style={{
                  ...S.filterChip,
                  background: lowStockOnly ? '#fee2e2' : '#f0eee6',
                  color: lowStockOnly ? '#dc2626' : '#4b5563',
                  border: lowStockOnly ? '1px solid #f87171' : '1px solid #d8d6cc'
                }}
                onClick={() => { setLowStockOnly(!lowStockOnly); setMatPage(1) }}
              >
                <AlertTriangle size={13} /> {lowStockOnly ? 'Showing Low Stock Only' : 'Filter Low Stock'}
              </button>
            </div>

            {/* Pagination Controls */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button
                onClick={() => setMatPage(p => Math.max(1, p - 1))}
                disabled={matPage === 1 || matLoading}
                style={{ ...S.btnPage, opacity: matPage === 1 ? 0.5 : 1 }}
              >
                Prev
              </button>
              <span style={{ fontSize: 12, color: '#4b5563', fontWeight: 600 }}>
                Page {matPage} of {Math.max(1, Math.ceil(matTotal / 50))} ({matTotal} items)
              </span>
              <button
                onClick={() => setMatPage(p => p + 1)}
                disabled={matPage >= Math.max(1, Math.ceil(matTotal / 50)) || matLoading}
                style={{ ...S.btnPage, opacity: matPage >= Math.max(1, Math.ceil(matTotal / 50)) ? 0.5 : 1 }}
              >
                Next
              </button>
            </div>
          </div>

          <TableScrollWrapper title="Store Items Catalog">
            <table style={S.table}>
              <thead>
                <tr>
                  <SortableTh label="Code" columnKey="code" currentSortKey={matSortBy} currentSortOrder={matSortOrder} onSort={(k, o) => { setMatSortBy(k); setMatSortOrder(o) }} width={100} />
                  <SortableTh label="Material Name / Specs" columnKey="name" currentSortKey={matSortBy} currentSortOrder={matSortOrder} onSort={(k, o) => { setMatSortBy(k); setMatSortOrder(o) }} />
                  <SortableTh label="Plant Section / Equipment" columnKey="section" currentSortKey={matSortBy} currentSortOrder={matSortOrder} onSort={(k, o) => { setMatSortBy(k); setMatSortOrder(o) }} />
                  <SortableTh label="Category" columnKey="categoryName" currentSortKey={matSortBy} currentSortOrder={matSortOrder} onSort={(k, o) => { setMatSortBy(k); setMatSortOrder(o) }} />
                  <SortableTh label="Current Stock" columnKey="currentStock" currentSortKey={matSortBy} currentSortOrder={matSortOrder} onSort={(k, o) => { setMatSortBy(k); setMatSortOrder(o) }} align="right" />
                  <SortableTh label="Reorder Level" columnKey="reorderLevel" currentSortKey={matSortBy} currentSortOrder={matSortOrder} onSort={(k, o) => { setMatSortBy(k); setMatSortOrder(o) }} align="right" />
                  <SortableTh label="Unit Price (₹)" columnKey="unitPrice" currentSortKey={matSortBy} currentSortOrder={matSortOrder} onSort={(k, o) => { setMatSortBy(k); setMatSortOrder(o) }} align="right" />
                  <SortableTh label="Total Value (₹)" columnKey="totalValue" currentSortKey={matSortBy} currentSortOrder={matSortOrder} onSort={(k, o) => { setMatSortBy(k); setMatSortOrder(o) }} align="right" />
                  <SortableTh label="Stock Status" columnKey="isLow" currentSortKey={matSortBy} currentSortOrder={matSortOrder} onSort={(k, o) => { setMatSortBy(k); setMatSortOrder(o) }} align="center" width={100} />
                  <th style={{ ...S.th, width: 85, textAlign: 'center' }}>Actions</th>
                </tr>
                {/* ── Per-Column Search Row ── */}
                <tr style={{ background: '#f1f5f9', borderBottom: '2px solid #cbd5e1' }}>
                  <th style={{ padding: '4px 6px' }}>
                    <input
                      style={{ background: '#fff', border: '1px solid #cbd5e1', borderRadius: 4, padding: '3px 6px', fontSize: 11, width: '100%', boxSizing: 'border-box' }}
                      placeholder="Filter code..."
                      value={matColSearch.code}
                      onChange={e => { setMatColSearch(s => ({ ...s, code: e.target.value })); setMatPage(1) }}
                    />
                  </th>
                  <th style={{ padding: '4px 6px' }}>
                    <input
                      style={{ background: '#fff', border: '1px solid #cbd5e1', borderRadius: 4, padding: '3px 6px', fontSize: 11, width: '100%', boxSizing: 'border-box' }}
                      placeholder="Filter name..."
                      value={matColSearch.name}
                      onChange={e => { setMatColSearch(s => ({ ...s, name: e.target.value })); setMatPage(1) }}
                    />
                  </th>
                  <th style={{ padding: '4px 6px' }}>
                    <input
                      style={{ background: '#fff', border: '1px solid #cbd5e1', borderRadius: 4, padding: '3px 6px', fontSize: 11, width: '100%', boxSizing: 'border-box' }}
                      placeholder="Filter section..."
                      value={matColSearch.section}
                      onChange={e => { setMatColSearch(s => ({ ...s, section: e.target.value })); setMatPage(1) }}
                    />
                  </th>
                  <th style={{ padding: '4px 6px' }}>
                    <input
                      style={{ background: '#fff', border: '1px solid #cbd5e1', borderRadius: 4, padding: '3px 6px', fontSize: 11, width: '100%', boxSizing: 'border-box' }}
                      placeholder="Filter category..."
                      value={matColSearch.category}
                      onChange={e => { setMatColSearch(s => ({ ...s, category: e.target.value })); setMatPage(1) }}
                    />
                  </th>
                  <th style={{ padding: '4px 6px' }}></th>
                  <th style={{ padding: '4px 6px' }}></th>
                  <th style={{ padding: '4px 6px' }}></th>
                  <th style={{ padding: '4px 6px' }}></th>
                  <th style={{ padding: '4px 6px' }}></th>
                  <th style={{ padding: '4px 6px', textAlign: 'center' }}>
                    {(matColSearch.code || matColSearch.name || matColSearch.section || matColSearch.category) && (
                      <button
                        type="button"
                        onClick={() => {
                          setMatColSearch({ code: '', name: '', section: '', category: '' })
                          setMatPage(1)
                        }}
                        style={{ background: '#ef4444', color: '#fff', border: 'none', borderRadius: 3, padding: '2px 6px', fontSize: 9.5, cursor: 'pointer', fontWeight: 700 }}
                        title="Clear column filters"
                      >
                        ✕
                      </button>
                    )}
                  </th>
                </tr>
              </thead>
              <tbody>
                {matLoading ? (
                  <tr><td colSpan={10} style={S.empty}>Loading catalog items...</td></tr>
                ) : materials.length === 0 ? (
                  <tr><td colSpan={10} style={S.empty}>No materials matching filter in {activeTabMeta.label}</td></tr>
                ) : (
                  sortTableData(
                    materials,
                    matSortBy,
                    matSortOrder,
                    {
                      totalValue: (m) => parseFloat(m.currentStock || m.current_stock || 0) * parseFloat(m.unitPrice || m.unit_price || 0),
                      isLow: (m) => {
                        const s = parseFloat(m.currentStock || m.current_stock || 0)
                        const r = parseFloat(m.reorderLevel || 0)
                        return s <= 0 ? 0 : s <= r ? 1 : 2
                      }
                    }
                  ).map(m => {
                    const stock = parseFloat(m.currentStock || m.current_stock || 0)
                    const reorder = parseFloat(m.reorderLevel || 0)
                    const price = parseFloat(m.unitPrice || m.unit_price || 0)
                    const value = stock * price
                    const isLow = stock <= reorder
                    const isZero = stock <= 0
                    const mSections = Array.isArray(m.sections) && m.sections.length > 0 ? m.sections : []
                    const mEquipment = Array.isArray(m.equipment) && m.equipment.length > 0 ? m.equipment : []
                    const secName = m.sectionName || m.section_name

                    return (
                      <tr key={m.id} style={{ background: isZero ? '#fef2f222' : isLow ? '#fffbeb33' : undefined }}>
                        <td style={{ ...S.td, fontWeight: 700, fontFamily: 'monospace' }}>
                          <span
                            onClick={() => setSelectedProductModalId(m.id)}
                            style={{ color: '#0f766e', cursor: 'pointer', textDecoration: 'underline' }}
                            title="Click to open full Product Form & Specifications"
                          >
                            {m.code}
                          </span>
                        </td>
                        <td style={S.td}>
                          <div
                            onClick={() => setSelectedProductModalId(m.id)}
                            style={{ fontWeight: 600, color: '#1b1b1d', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                            title="Click to open full Product Form & Specifications"
                          >
                            <span>{m.name}</span>
                            <ExternalLink size={12} color="#6b7280" style={{ flexShrink: 0 }} />
                          </div>
                        </td>
                        <td style={S.td}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            {mSections.length > 0 ? (
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                                {mSections.map(sec => (
                                  <span key={sec.id} style={{ fontSize: 10, fontWeight: 700, color: '#0f766e', background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '1px 5px', borderRadius: 3 }}>
                                    🏭 {sec.sectionCode || sec.name}
                                  </span>
                                ))}
                              </div>
                            ) : secName ? (
                              <span style={{ fontSize: 10.5, fontWeight: 700, color: '#0f766e', background: '#f0fdf4', padding: '1px 5px', borderRadius: 3 }}>
                                🏭 {secName}
                              </span>
                            ) : (
                              <span style={{ color: '#9ca3af', fontSize: 11 }}>General</span>
                            )}
                          </div>
                        </td>
                        <td style={S.td}>
                          <span style={S.categoryBadge}>{m.categoryName || 'General'}</span>
                        </td>
                        <td style={{ ...S.td, textAlign: 'right', fontWeight: 700, color: isZero ? '#dc2626' : isLow ? '#d97706' : '#166534' }}>
                          {stock.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 3 })} {m.uom}
                        </td>
                        <td style={{ ...S.td, textAlign: 'right', color: '#6b7280' }}>
                          {reorder.toLocaleString('en-IN', { minimumFractionDigits: 2 })} {m.uom}
                        </td>
                        <td style={{ ...S.td, textAlign: 'right', color: '#374151' }}>
                          ₹{price.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td style={{ ...S.td, textAlign: 'right', fontWeight: 700, color: '#1b1b1d' }}>
                          ₹{value.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td style={S.td}>
                          {isZero ? (
                            <span style={{ ...S.statusBadge, background: '#fee2e2', color: '#dc2626' }}>Out of Stock</span>
                          ) : isLow ? (
                            <span style={{ ...S.statusBadge, background: '#fef3c7', color: '#b45309' }}>Low Stock</span>
                          ) : (
                            <span style={{ ...S.statusBadge, background: '#dcfce7', color: '#15803d' }}>Optimal</span>
                          )}
                        </td>
                        <td style={S.td}>
                          <button
                            style={{ ...S.btnPage, background: '#1e293b', padding: '5px 10px', display: 'inline-flex', alignItems: 'center', gap: 4, borderRadius: 6, fontSize: 11.5 }}
                            onClick={() => setSelectedProductModalId(m.id)}
                            title="Open Product Form, Specifications, and Ledger"
                          >
                            <FileText size={12} /> Form
                          </button>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </TableScrollWrapper>
        </div>
      )}

      {/* VIEW 2: LIVE STOCK LEDGER */}
      {activeView === 'ledger' && (
        <div style={S.card}>
          <div style={S.tableControlBar}>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={S.searchBox}>
                <Search size={15} color="#8a8a90" />
                <input
                  style={S.searchInput}
                  placeholder="Search ledger by material, batch, remark..."
                  value={ledgerSearch}
                  onChange={(e) => { setLedgerSearch(e.target.value); setLedgerPage(1) }}
                />
              </div>

              <SearchableSelect
                value={ledgerTxnType}
                onChange={(val) => { setLedgerTxnType(val); setLedgerPage(1) }}
                placeholder="All Transactions"
                searchPlaceholder="Type transaction type..."
                style={{ minWidth: 200 }}
                options={[
                  { value: 'Issue', label: 'Store Issues (Outward)' },
                  { value: 'GRN', label: 'GRN Receipts (Inward)' },
                  { value: 'Opening', label: 'Opening Balance' },
                  { value: 'Adjustment', label: 'Stock Adjustment' }
                ]}
              />
            </div>

            {/* Pagination Controls */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button
                onClick={() => setLedgerPage(p => Math.max(1, p - 1))}
                disabled={ledgerPage === 1 || ledgerLoading}
                style={{ ...S.btnPage, opacity: ledgerPage === 1 ? 0.5 : 1 }}
              >
                Prev
              </button>
              <span style={{ fontSize: 12, color: '#4b5563', fontWeight: 600 }}>
                Page {ledgerPage} of {Math.max(1, Math.ceil(ledgerTotal / 25))} ({ledgerTotal} entries)
              </span>
              <button
                onClick={() => setLedgerPage(p => p + 1)}
                disabled={ledgerPage >= Math.max(1, Math.ceil(ledgerTotal / 25)) || ledgerLoading}
                style={{ ...S.btnPage, opacity: ledgerPage >= Math.max(1, Math.ceil(ledgerTotal / 25)) ? 0.5 : 1 }}
              >
                Next
              </button>
            </div>
          </div>

          <TableScrollWrapper title="Live Stock Ledger">
            <table style={S.table}>
              <thead>
                <tr>
                  <SortableTh label="Date" columnKey="date" currentSortKey={ledgerSortBy} currentSortOrder={ledgerSortOrder} onSort={(k, o) => { setLedgerSortBy(k); setLedgerSortOrder(o) }} width={100} />
                  <SortableTh label="Material Code & Name" columnKey="materialName" currentSortKey={ledgerSortBy} currentSortOrder={ledgerSortOrder} onSort={(k, o) => { setLedgerSortBy(k); setLedgerSortOrder(o) }} />
                  <SortableTh label="Category" columnKey="categoryName" currentSortKey={ledgerSortBy} currentSortOrder={ledgerSortOrder} onSort={(k, o) => { setLedgerSortBy(k); setLedgerSortOrder(o) }} />
                  <SortableTh label="Txn Type" columnKey="type" currentSortKey={ledgerSortBy} currentSortOrder={ledgerSortOrder} onSort={(k, o) => { setLedgerSortBy(k); setLedgerSortOrder(o) }} width={90} />
                  <SortableTh label="In Qty" columnKey="inQty" currentSortKey={ledgerSortBy} currentSortOrder={ledgerSortOrder} onSort={(k, o) => { setLedgerSortBy(k); setLedgerSortOrder(o) }} align="right" />
                  <SortableTh label="Out Qty" columnKey="outQty" currentSortKey={ledgerSortBy} currentSortOrder={ledgerSortOrder} onSort={(k, o) => { setLedgerSortBy(k); setLedgerSortOrder(o) }} align="right" />
                  <SortableTh label="Balance" columnKey="balance" currentSortKey={ledgerSortBy} currentSortOrder={ledgerSortOrder} onSort={(k, o) => { setLedgerSortBy(k); setLedgerSortOrder(o) }} align="right" />
                  <SortableTh label="Value (₹)" columnKey="value" currentSortKey={ledgerSortBy} currentSortOrder={ledgerSortOrder} onSort={(k, o) => { setLedgerSortBy(k); setLedgerSortOrder(o) }} align="right" />
                  <SortableTh label="Batch / Ref" columnKey="batchNumber" currentSortKey={ledgerSortBy} currentSortOrder={ledgerSortOrder} onSort={(k, o) => { setLedgerSortBy(k); setLedgerSortOrder(o) }} />
                  <SortableTh label="Logged By" columnKey="createdByName" currentSortKey={ledgerSortBy} currentSortOrder={ledgerSortOrder} onSort={(k, o) => { setLedgerSortBy(k); setLedgerSortOrder(o) }} />
                </tr>
              </thead>
              <tbody>
                {ledgerLoading ? (
                  <tr><td colSpan={10} style={S.empty}>Loading ledger records...</td></tr>
                ) : ledger.length === 0 ? (
                  <tr><td colSpan={10} style={S.empty}>No transaction records found for {activeTabMeta.label}</td></tr>
                ) : (
                  sortTableData(ledger, ledgerSortBy, ledgerSortOrder).map(entry => {
                    const isIn = parseFloat(entry.inQty || 0) > 0
                    const isOut = parseFloat(entry.outQty || 0) > 0
                    return (
                      <tr key={entry.id}>
                        <td style={{ ...S.td, whiteSpace: 'nowrap', color: '#6b7280', fontSize: 12 }}>
                          {entry.date ? String(entry.date).slice(0, 10) : '—'}
                        </td>
                        <td style={S.td}>
                          <div
                            onClick={() => (entry.materialId || entry.material_id) && setSelectedProductModalId(entry.materialId || entry.material_id)}
                            style={{ cursor: (entry.materialId || entry.material_id) ? 'pointer' : 'default' }}
                            title="Click to open Product Form"
                          >
                            <div style={{ fontWeight: 700, color: '#0f766e', fontSize: 11.5, fontFamily: 'monospace', textDecoration: (entry.materialId || entry.material_id) ? 'underline' : 'none' }}>
                              {entry.materialCode || '—'}
                            </div>
                            <div style={{ fontWeight: 600, color: '#1b1b1d', display: 'flex', alignItems: 'center', gap: 4 }}>
                              <span>{entry.materialName}</span>
                              {(entry.materialId || entry.material_id) && <ExternalLink size={12} color="#6b7280" />}
                            </div>
                          </div>
                        </td>
                        <td style={S.td}>
                          <span style={S.categoryBadge}>{entry.categoryName || 'Store'}</span>
                        </td>
                        <td style={S.td}>
                          <span style={{
                            ...S.statusBadge,
                            background: isIn ? '#dcfce7' : isOut ? '#fee2e2' : '#f3f4f6',
                            color: isIn ? '#15803d' : isOut ? '#dc2626' : '#4b5563'
                          }}>
                            {entry.type || entry.transaction_type || (isIn ? 'GRN' : isOut ? 'Issue' : 'Txn')}
                          </span>
                        </td>
                        <td style={{ ...S.td, textAlign: 'right', fontWeight: 600, color: '#15803d' }}>
                          {isIn ? `+${parseFloat(entry.inQty).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 3 })}` : '—'}
                        </td>
                        <td style={{ ...S.td, textAlign: 'right', fontWeight: 600, color: '#dc2626' }}>
                          {isOut ? `-${parseFloat(entry.outQty).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 3 })}` : '—'}
                        </td>
                        <td style={{ ...S.td, textAlign: 'right', fontWeight: 700, color: '#1b1b1d' }}>
                          {entry.balance !== undefined ? parseFloat(entry.balance).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 3 }) : '—'}
                        </td>
                        <td style={{ ...S.td, textAlign: 'right', color: '#374151', fontWeight: 600 }}>
                          {entry.value ? `₹${parseFloat(entry.value).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—'}
                        </td>
                        <td style={{ ...S.td, fontSize: 12, color: '#6b7280' }}>
                          {entry.batchNumber || entry.batch_number || entry.reference_id || '—'}
                        </td>
                        <td style={{ ...S.td, fontSize: 12, color: '#6b7280' }}>
                          {entry.createdByName || entry.user_name || 'System'}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </TableScrollWrapper>
        </div>
      )}

      {/* VIEW 3: QUICK OPERATIONS DESKS (GRN & ISSUE) */}
      {activeView === 'operations' && (
        <div style={S.grid} ref={operationsRef}>
          {/* GRN Desk */}
          <div style={S.card}>
            <div style={{ ...S.cardTitle, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Inward GRN Receipt Desk</span>
              {lastGrn && (
                <button type="button" onClick={() => printGrnInvoice(lastGrn)} style={{ ...S.btnPage, background: '#0f766e', color: '#fff' }}>
                  <FileText size={13} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                  Print Last GRN Invoice
                </button>
              )}
            </div>
            <form onSubmit={saveGrn} style={S.form}>
              <label style={S.label}>Date
                <input style={S.input} type="date" value={grnForm.date} onChange={(e) => setGrnForm(f => ({ ...f, date: e.target.value }))} required />
              </label>
              <label style={S.label}>Vendor / Supplier
                <SearchableSelect
                  value={String(grnForm.vendorId || '')}
                  onChange={(val) => setGrnForm(f => ({ ...f, vendorId: val }))}
                  placeholder="-- Select Vendor --"
                  searchPlaceholder="Type vendor name..."
                  required
                  options={vendors.map(v => ({ value: String(v.id), label: v.name }))}
                />
              </label>
              <label style={S.label}>Store Material
                <SearchableSelect
                  value={String(grnForm.materialId || '')}
                  onChange={(val) => setGrnForm(f => ({ ...f, materialId: val }))}
                  placeholder={`-- Select Material (${materials.length} loaded) --`}
                  searchPlaceholder="Type material code or name..."
                  required
                  options={materials.map(m => ({ value: String(m.id), label: m.name, code: m.code }))}
                />
              </label>
              <div style={S.twoCol}>
                <label style={S.label}>Received Qty
                  <input style={S.input} type="number" step="0.01" value={grnForm.receivedQty} onChange={(e) => setGrnForm(f => ({ ...f, receivedQty: e.target.value }))} required />
                </label>
                <label style={S.label}>Accepted Qty
                  <input style={S.input} type="number" step="0.01" value={grnForm.acceptedQty} onChange={(e) => setGrnForm(f => ({ ...f, acceptedQty: e.target.value }))} />
                </label>
              </div>
              <div style={S.twoCol}>
                <label style={S.label}>Unit Price (₹)
                  <input style={S.input} type="number" step="0.01" value={grnForm.unitPrice} onChange={(e) => setGrnForm(f => ({ ...f, unitPrice: e.target.value }))} />
                </label>
                <label style={S.label}>Batch / Lot No
                  <input style={S.input} value={grnForm.batchNumber} onChange={(e) => setGrnForm(f => ({ ...f, batchNumber: e.target.value }))} />
                </label>
              </div>
              <label style={S.label}>Bin / Rack Location
                <input style={S.input} value={grnForm.binLocation} onChange={(e) => setGrnForm(f => ({ ...f, binLocation: e.target.value }))} />
              </label>
              <label style={S.label}>Remarks
                <textarea style={{ ...S.input, minHeight: 60 }} value={grnForm.remarks} onChange={(e) => setGrnForm(f => ({ ...f, remarks: e.target.value }))} />
              </label>
              <button style={S.btnAction} disabled={grnSaving}>
                {grnSaving ? 'Processing Inward...' : 'Record Inward GRN'}
              </button>
            </form>
          </div>

          {/* Issue Desk */}
          <div style={S.card}>
            <div style={S.cardTitle}>Direct Material Issue Desk</div>
            <form onSubmit={saveIssue} style={S.form}>
              <label style={S.label}>Date
                <input style={S.input} type="date" value={issueForm.date} onChange={(e) => setIssueForm(f => ({ ...f, date: e.target.value }))} required />
              </label>
              <label style={S.label}>
                Store Material
                <SearchableSelect
                  value={String(issueForm.materialId || '')}
                  onChange={(val) => setIssueForm(f => ({ ...f, materialId: val }))}
                  placeholder="-- Select Material --"
                  searchPlaceholder="Type material code or name..."
                  required
                  options={materials.map(m => ({ value: String(m.id), label: m.name, code: m.code, subtext: `Stock: ${m.currentStock} ${m.uom || ''}` }))}
                />
                {selectedIssueMat && (
                  <span style={{ fontSize: 12, color: Number(selectedIssueMat.currentStock || 0) < Number(issueForm.qty || 0) ? '#dc2626' : '#15803d', fontWeight: 700, marginTop: 4 }}>
                    Live Balance: {selectedIssueMat.currentStock} {selectedIssueMat.uom || 'units'}
                  </span>
                )}
              </label>
              <label style={S.label}>Issue Quantity
                <input style={S.input} type="number" step="0.01" value={issueForm.qty} onChange={(e) => setIssueForm(f => ({ ...f, qty: e.target.value }))} required />
              </label>
              <label style={S.label}>Purpose / Department Reason
                <input style={S.input} value={issueForm.reason} onChange={(e) => setIssueForm(f => ({ ...f, reason: e.target.value }))} placeholder="e.g. Wire Section Pump Replacement" required />
              </label>
              <label style={S.label}>Batch / Serial No
                <input style={S.input} value={issueForm.batchNumber} onChange={(e) => setIssueForm(f => ({ ...f, batchNumber: e.target.value }))} />
              </label>
              <label style={S.label}>Bin / Rack Location
                <input style={S.input} value={issueForm.binLocation} onChange={(e) => setIssueForm(f => ({ ...f, binLocation: e.target.value }))} />
              </label>
              <label style={S.label}>Remarks
                <textarea style={{ ...S.input, minHeight: 60 }} value={issueForm.remarks} onChange={(e) => setIssueForm(f => ({ ...f, remarks: e.target.value }))} />
              </label>
              <button style={{ ...S.btnAction, background: '#b91c1c' }} disabled={issueSaving}>
                {issueSaving ? 'Issuing Material...' : 'Issue Material from Store'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* VIEW 4: SHIFT MOVEMENT & AUDIT */}
      {activeView === 'shifts' && roleLevel >= 3 && (
        <div style={S.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div style={S.cardTitle}>Shift Movement & High-Transaction Stock Audit</div>
            <SearchableSelect
              value={shiftFilter}
              onChange={(val) => setShiftFilter(val)}
              placeholder="All Shifts"
              searchPlaceholder="Type shift name..."
              style={{ width: 160 }}
              options={[
                { value: 'Day', label: 'Day Shift' },
                { value: 'Night', label: 'Night Shift' }
              ]}
            />
          </div>

          <div style={S.statsGrid}>
            {(shiftSummary?.totals || []).map(t => (
              <div key={t.shift} style={S.statCard}>
                <div style={S.statLabel}>{t.shift} Shift Movement</div>
                <div style={{ ...S.statValue, fontSize: 18 }}>
                  In {Number(t.totalIn).toLocaleString()} / Out {Number(t.totalOut).toLocaleString()}
                </div>
                <div style={{ fontSize: 12, color: '#8a8a90', marginTop: 4 }}>
                  ₹{Number(t.inValue).toLocaleString()} In · ₹{Number(t.outValue).toLocaleString()} Out
                </div>
                {Number(t.highTxnCount) > 0 && (
                  <div style={{ fontSize: 12, color: '#ef4444', fontWeight: 700, marginTop: 4 }}>
                    {t.highTxnCount} High-Value Txn Flagged
                  </div>
                )}
              </div>
            ))}
            {!shiftSummary?.totals?.length && <div style={S.empty}>No shift transactions logged for {activeTabMeta.label}</div>}
          </div>

          <div style={S.tableWrap}>
            <table style={S.table}>
              <thead>
                <tr>
                  <th style={S.th}>Timestamp</th>
                  <th style={S.th}>Shift</th>
                  <th style={S.th}>Material</th>
                  <th style={S.th}>Type</th>
                  <th style={{ ...S.th, textAlign: 'right' }}>In</th>
                  <th style={{ ...S.th, textAlign: 'right' }}>Out</th>
                  <th style={{ ...S.th, textAlign: 'right' }}>Value (₹)</th>
                  <th style={S.th}>Logged By</th>
                  <th style={S.th}>High Txn?</th>
                </tr>
              </thead>
              <tbody>
                {(shiftSummary?.entries || []).length === 0 ? (
                  <tr><td colSpan={9} style={S.empty}>No shift audit logs recorded</td></tr>
                ) : (
                  shiftSummary.entries.map(e => (
                    <tr key={e.id} style={e.isHigh ? { background: '#ef444411' } : undefined}>
                      <td style={{ ...S.td, fontSize: 12 }}>{new Date(e.loggedAt).toLocaleString()}</td>
                      <td style={S.td}>{e.shift || '—'}</td>
                      <td style={{ ...S.td, fontWeight: 600 }}>{e.materialName}</td>
                      <td style={S.td}>
                        <span style={S.categoryBadge}>{e.type}</span>
                      </td>
                      <td style={{ ...S.td, textAlign: 'right', color: '#166534', fontWeight: e.inQty ? 700 : 400 }}>
                        {e.inQty ? `+${Number(e.inQty).toLocaleString()}` : '—'}
                      </td>
                      <td style={{ ...S.td, textAlign: 'right', color: '#dc2626', fontWeight: e.outQty ? 700 : 400 }}>
                        {e.outQty ? `-${Number(e.outQty).toLocaleString()}` : '—'}
                      </td>
                      <td style={{ ...S.td, textAlign: 'right', fontWeight: 700 }}>
                        ₹{Number(e.value || 0).toLocaleString()}
                      </td>
                      <td style={S.td}>{e.loggedBy || '—'}</td>
                      <td style={S.td}>
                        {e.isHigh ? <span style={{ color: '#ef4444', fontWeight: 700 }}>HIGH</span> : '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── UNIFIED PRODUCT SPECIFICATION & STOCK LEDGER MODAL ── */}
      <ProductDetailModal
        materialId={selectedProductModalId}
        isOpen={!!selectedProductModalId}
        onClose={() => setSelectedProductModalId(null)}
        onUpdated={() => {
          loadMaterials()
          loadSummary()
          loadLedger()
        }}
      />

      {/* ── ENTERPRISE INVENTORY EXCEL EXPORTER MODAL ── */}
      <InventoryExportModal
        isOpen={exportModal}
        onClose={() => setExportModal(false)}
        initialStoreType={activeStoreTab}
        categories={categories}
      />
    </div>
  )
}

const S = {
  page: { padding: '24px 32px', background: '#f6f5f0', minHeight: '100vh', fontFamily: "'Outfit', sans-serif" },
  headerBar: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16, marginBottom: 16 },
  title: { fontSize: 24, fontWeight: 700, color: '#1b1b1d', letterSpacing: '-0.02em' },
  subtitle: { fontSize: 13, color: '#6b7280', marginTop: 4 },
  btnRefresh: { display: 'flex', alignItems: 'center', gap: 6, background: '#fff', border: '1px solid #d8d6cc', borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 600, color: '#374151', cursor: 'pointer' },
  
  tabBar: { display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 18, borderBottom: '1px solid #e5e7eb', paddingBottom: 12 },
  tabBtn: { display: 'flex', alignItems: 'center', gap: 8, background: '#fff', border: '1px solid #d8d6cc', borderRadius: 10, padding: '8px 16px', fontSize: 13, fontWeight: 600, color: '#4b5563', cursor: 'pointer', transition: 'all 0.15s ease' },
  tabBtnActive: { background: '#1b1b1d', borderColor: '#1b1b1d', color: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' },

  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginBottom: 18 },
  statCard: { background: '#fff', border: '1px solid #ecebe5', borderRadius: 14, padding: '16px 20px', boxShadow: '0 1px 4px rgba(15,23,42,0.04)' },
  statHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  statLabel: { fontSize: 12, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em' },
  statValue: { fontSize: 24, fontWeight: 800, color: '#1b1b1d', letterSpacing: '-0.02em' },
  statSub: { fontSize: 11.5, color: '#9ca3af', marginTop: 4 },

  subViewNav: { display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 },
  subViewBtn: { display: 'flex', alignItems: 'center', gap: 6, background: '#f0eee6', border: '1px solid #d8d6cc', borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 600, color: '#4b5563', cursor: 'pointer' },
  subViewBtnActive: { background: '#0f766e', borderColor: '#0f766e', color: '#fff' },

  card: { background: '#fff', border: '1px solid #ecebe5', borderRadius: 14, padding: 20, boxShadow: '0 1px 4px rgba(15,23,42,0.04)', marginBottom: 18 },
  cardTitle: { fontSize: 16, fontWeight: 700, color: '#1b1b1d', marginBottom: 14 },
  tableControlBar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 14 },
  searchBox: { display: 'flex', alignItems: 'center', gap: 8, background: '#f6f5f0', border: '1px solid #d8d6cc', borderRadius: 8, padding: '6px 12px', minWidth: 280 },
  searchInput: { border: 'none', background: 'transparent', outline: 'none', fontSize: 13, width: '100%', color: '#1b1b1d' },
  filterSelect: { background: '#f6f5f0', border: '1px solid #d8d6cc', borderRadius: 8, padding: '6px 12px', fontSize: 13, color: '#374151', outline: 'none' },
  filterChip: { display: 'flex', alignItems: 'center', gap: 6, borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer' },
  btnPage: { background: '#0f766e', color: '#fff', border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer' },

  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 16, marginBottom: 18 },
  form: { display: 'flex', flexDirection: 'column', gap: 10 },
  label: { display: 'flex', flexDirection: 'column', gap: 4, color: '#374151', fontSize: 12, fontWeight: 600 },
  input: { background: '#f6f5f0', border: '1px solid #d8d6cc', borderRadius: 8, padding: '8px 12px', color: '#1b1b1d', fontSize: 13, outline: 'none' },
  twoCol: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 },
  btnAction: { background: '#0f766e', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer', marginTop: 6 },
  message: { borderRadius: 10, padding: '10px 14px', fontSize: 13, fontWeight: 600, marginBottom: 14 },

  tableWrap: { overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  th: { textAlign: 'left', padding: '10px 12px', borderBottom: '1px solid #ecebe5', color: '#6b7280', fontWeight: 600, fontSize: 12 },
  td: { padding: '10px 12px', borderBottom: '1px solid #f6f5f0', color: '#374151' },
  empty: { padding: 24, textAlign: 'center', color: '#9ca3af', fontStyle: 'italic' },
  categoryBadge: { fontSize: 11, padding: '2px 8px', borderRadius: 6, background: '#f3f4f6', color: '#4b5563', fontWeight: 600 },
  statusBadge: { fontSize: 11, padding: '2px 8px', borderRadius: 999, fontWeight: 700, display: 'inline-block' },
}
