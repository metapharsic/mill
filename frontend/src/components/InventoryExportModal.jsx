import React, { useState, useEffect, useMemo } from 'react'
import {
  FileSpreadsheet, Download, Filter, Layers, CheckCircle2, AlertTriangle,
  Zap, Factory, Package, ShieldCheck, X, Settings2, Sparkles, Check,
  ChevronRight, RefreshCw, BarChart3, Clock, DollarSign, Database
} from 'lucide-react'
import { LOGO_SRC } from '../utils/logo'

export default function InventoryExportModal({
  isOpen,
  onClose,
  initialStoreType = 'all',
  initialCategoryId = '',
  categories = [],
  sections = []
}) {
  // Master lists fetched on open if empty
  const [catList, setCatList] = useState(categories)
  const [secList, setSecList] = useState(sections)

  // Configuration state
  const [storeType, setStoreType] = useState(initialStoreType)
  const [categoryId, setCategoryId] = useState(initialCategoryId)
  const [stockStatus, setStockStatus] = useState('all')
  const [criticality, setCriticality] = useState('all')
  const [sectionId, setSectionId] = useState('')
  const [search, setSearch] = useState('')

  // Load master data if not passed
  useEffect(() => {
    if (!isOpen) return
    const token = localStorage.getItem('mk_token') || ''
    const headers = token ? { Authorization: `Bearer ${token}` } : {}

    fetch('/api/master/categories', { headers })
      .then(r => r.json())
      .then(res => {
        if (res.success && Array.isArray(res.data)) setCatList(res.data)
      })
      .catch(() => {})

    fetch('/api/sections', { headers })
      .then(r => r.json())
      .then(res => {
        if (res.success && Array.isArray(res.data)) setSecList(res.data)
      })
      .catch(() => {})
  }, [isOpen])

  // Sync prop changes
  useEffect(() => {
    if (categories && categories.length) setCatList(categories)
  }, [categories])

  useEffect(() => {
    if (sections && sections.length) setSecList(sections)
  }, [sections])

  // Dynamically filter categories based on active store domain
  const availableCategories = useMemo(() => {
    const list = catList.length ? catList : categories
    return list.filter(c => {
      if (!storeType || storeType === 'all') return true
      if (storeType === 'mechanical') return c.type === 'Mechanical' || c.name?.toLowerCase().includes('mech') || c.code?.startsWith('MECH') || [31,36,39,40,41,42,43,44,45,46,47,48,49,50,51,52,53,54,55].includes(c.id)
      if (storeType === 'electrical') return c.type === 'Electrical' || c.name?.toLowerCase().includes('elec') || c.code?.startsWith('ELEC') || [30,56,57,58,59,60].includes(c.id)
      if (storeType === 'consumable') return c.type === 'Consumable' || [29,33,34,35].includes(c.id)
      if (storeType === 'chemical') return c.type === 'Raw Material' || c.id === 28 || c.name?.toLowerCase().includes('chem')
      if (storeType === 'store') return ['Mechanical', 'Electrical', 'Consumable', 'Spare Part'].includes(c.type) || (c.id >= 29 && c.id <= 60)
      return true
    })
  }, [catList, categories, storeType])

  // Reset category if not in available list
  useEffect(() => {
    if (categoryId && !availableCategories.some(c => String(c.id) === String(categoryId))) {
      setCategoryId('')
    }
  }, [storeType, availableCategories, categoryId])

  // Sheet & Column options
  const [includeSummary, setIncludeSummary] = useState(true)
  const [includeMaster, setIncludeMaster] = useState(true)
  const [includeCategorySheets, setIncludeCategorySheets] = useState(true)
  const [includeReorderSheet, setIncludeReorderSheet] = useState(true)
  const [includeHighValueSheet, setIncludeHighValueSheet] = useState(true)
  const [includeSlowMovingSheet, setIncludeSlowMovingSheet] = useState(false)
  const [includePricing, setIncludePricing] = useState(true)
  const [includeMovement, setIncludeMovement] = useState(true)
  const [includeTechnical, setIncludeTechnical] = useState(true)

  // Status & download state
  const [downloading, setDownloading] = useState(false)
  const [downloadSuccess, setDownloadSuccess] = useState(null)
  const [error, setError] = useState('')
  const [activePreset, setActivePreset] = useState('full_master')

  // Apply Quick Presets
  const applyPreset = (presetKey) => {
    setActivePreset(presetKey)
    setError('')
    setDownloadSuccess(null)

    if (presetKey === 'full_master') {
      setStoreType('all')
      setCategoryId('')
      setStockStatus('all')
      setCriticality('all')
      setIncludeSummary(true)
      setIncludeMaster(true)
      setIncludeCategorySheets(true)
      setIncludeReorderSheet(true)
      setIncludeHighValueSheet(true)
      setIncludeSlowMovingSheet(true)
      setIncludePricing(true)
      setIncludeMovement(true)
      setIncludeTechnical(true)
    } else if (presetKey === 'mechanical') {
      setStoreType('mechanical')
      setCategoryId('')
      setStockStatus('all')
      setCriticality('all')
      setIncludeSummary(true)
      setIncludeMaster(true)
      setIncludeCategorySheets(true)
      setIncludeReorderSheet(true)
      setIncludeHighValueSheet(false)
      setIncludeSlowMovingSheet(false)
      setIncludePricing(true)
      setIncludeMovement(true)
      setIncludeTechnical(true)
    } else if (presetKey === 'electrical') {
      setStoreType('electrical')
      setCategoryId('')
      setStockStatus('all')
      setCriticality('all')
      setIncludeSummary(true)
      setIncludeMaster(true)
      setIncludeCategorySheets(true)
      setIncludeReorderSheet(true)
      setIncludeHighValueSheet(false)
      setIncludeSlowMovingSheet(false)
      setIncludePricing(true)
      setIncludeMovement(true)
      setIncludeTechnical(true)
    } else if (presetKey === 'reorder_urgent') {
      setStoreType('all')
      setCategoryId('')
      setStockStatus('low_stock')
      setCriticality('all')
      setIncludeSummary(true)
      setIncludeMaster(true)
      setIncludeCategorySheets(false)
      setIncludeReorderSheet(true)
      setIncludeHighValueSheet(false)
      setIncludeSlowMovingSheet(false)
      setIncludePricing(true)
      setIncludeMovement(true)
      setIncludeTechnical(true)
    } else if (presetKey === 'valuation_audit') {
      setStoreType('all')
      setCategoryId('')
      setStockStatus('all')
      setCriticality('all')
      setIncludeSummary(true)
      setIncludeMaster(true)
      setIncludeCategorySheets(false)
      setIncludeReorderSheet(false)
      setIncludeHighValueSheet(true)
      setIncludeSlowMovingSheet(false)
      setIncludePricing(true)
      setIncludeMovement(true)
      setIncludeTechnical(true)
    } else if (presetKey === 'dead_stock') {
      setStoreType('all')
      setCategoryId('')
      setStockStatus('all')
      setCriticality('all')
      setIncludeSummary(true)
      setIncludeMaster(false)
      setIncludeCategorySheets(false)
      setIncludeReorderSheet(false)
      setIncludeHighValueSheet(false)
      setIncludeSlowMovingSheet(true)
      setIncludePricing(true)
      setIncludeMovement(false)
      setIncludeTechnical(true)
    }
  }

  // Trigger Download
  const handleExport = async () => {
    setDownloading(true)
    setError('')
    setDownloadSuccess(null)

    try {
      const query = new URLSearchParams()
      if (storeType) query.append('store_type', storeType)
      if (categoryId) query.append('category_id', categoryId)
      if (stockStatus) query.append('stock_status', stockStatus)
      if (criticality) query.append('criticality', criticality)
      if (sectionId) query.append('section_id', sectionId)
      if (search) query.append('search', search)

      query.append('include_summary_sheet', String(includeSummary))
      query.append('include_master_sheet', String(includeMaster))
      query.append('include_category_sheets', String(includeCategorySheets))
      query.append('include_reorder_sheet', String(includeReorderSheet))
      query.append('include_high_value_sheet', String(includeHighValueSheet))
      query.append('include_slow_moving_sheet', String(includeSlowMovingSheet))
      query.append('include_pricing', String(includePricing))
      query.append('include_movement', String(includeMovement))
      query.append('include_technical', String(includeTechnical))

      const token = localStorage.getItem('mk_token') || ''
      if (token) {
        query.append('token', token)
      }

      const headers = {}
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }

      const response = await fetch(`/api/inventory/export/excel?${query.toString()}`, {
        headers
      })

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}))
        throw new Error(errJson.message || `Export failed with HTTP status ${response.status}`)
      }

      // Extract filename
      const disposition = response.headers.get('Content-Disposition')
      let filename = 'MK_Mill_Inventory_Master_Export.xlsx'
      if (disposition && disposition.includes('filename=')) {
        const match = disposition.match(/filename="?([^"]+)"?/)
        if (match && match[1]) filename = match[1]
      }

      const totalSKUs = response.headers.get('X-Meta-Total-SKUs') || 'All'
      const totalValuation = response.headers.get('X-Meta-Total-Valuation')

      const blob = await response.blob()
      if (!blob || blob.size === 0) {
        throw new Error('Received empty workbook data from server')
      }

      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.style.display = 'none'
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()

      // Allow browser download manager to begin stream before revoking
      setTimeout(() => {
        try {
          window.URL.revokeObjectURL(url)
          if (a.parentNode) a.parentNode.removeChild(a)
        } catch (_) {}
      }, 3500)

      setDownloadSuccess({
        filename,
        totalSKUs,
        totalValuation: totalValuation ? parseFloat(totalValuation).toLocaleString('en-IN') : null,
        timestamp: new Date().toLocaleTimeString()
      })
    } catch (err) {
      console.error('Inventory Excel export error:', err)
      setError(err.message || 'Failed to generate Excel workbook')
    } finally {
      setDownloading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={S.modal} onClick={e => e.stopPropagation()}>
        {/* Modal Header */}
        <div style={S.header}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <img
              src={LOGO_SRC}
              alt="SRI M.K. Paper Mills"
              style={{ height: 42, width: 'auto', maxWidth: 160, objectFit: 'contain', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', padding: '2px 8px' }}
            />
            <div>
              <div style={S.title}>Enterprise Inventory Master Excel Exporter</div>
              <div style={S.subtitle}>
                SRI M.K. PAPER MILLS PVT. LTD. · Live multi-sheet audit workbooks with official branding &amp; watermark.
              </div>
            </div>
          </div>
          <button style={S.closeBtn} onClick={onClose}>✕</button>
        </div>

        {/* Modal Body */}
        <div style={S.body}>
          {/* Quick Presets Section */}
          <div style={S.sectionBox}>
            <div style={S.sectionLabel}>
              <Sparkles size={14} color="#0f766e" />
              <span>Quick Export Presets</span>
            </div>
            <div style={S.presetGrid}>
              <button
                type="button"
                onClick={() => applyPreset('full_master')}
                style={{ ...S.presetCard, ...(activePreset === 'full_master' ? S.presetCardActive : {}) }}
              >
                <div style={S.presetHeader}>
                  <ShieldCheck size={16} color={activePreset === 'full_master' ? '#0f766e' : '#64748b'} />
                  <span style={S.presetTitle}>Mill Master Suite</span>
                </div>
                <div style={S.presetDesc}>All 33+ category sheets, summary dashboard, reorder alerts, daily rollover</div>
              </button>

              <button
                type="button"
                onClick={() => applyPreset('mechanical')}
                style={{ ...S.presetCard, ...(activePreset === 'mechanical' ? S.presetCardActive : {}) }}
              >
                <div style={S.presetHeader}>
                  <Factory size={16} color={activePreset === 'mechanical' ? '#0f766e' : '#64748b'} />
                  <span style={S.presetTitle}>Mechanical Spares</span>
                </div>
                <div style={S.presetDesc}>Bearings, oil seals, valves, v-belts, couplings, pipes, pump sleeves</div>
              </button>

              <button
                type="button"
                onClick={() => applyPreset('electrical')}
                style={{ ...S.presetCard, ...(activePreset === 'electrical' ? S.presetCardActive : {}) }}
              >
                <div style={S.presetHeader}>
                  <Zap size={16} color={activePreset === 'electrical' ? '#0f766e' : '#64748b'} />
                  <span style={S.presetTitle}>Electrical &amp; VFDs</span>
                </div>
                <div style={S.presetDesc}>Contactors, relays, MCBs, drives, fuses, switchgear, automation</div>
              </button>

              <button
                type="button"
                onClick={() => applyPreset('reorder_urgent')}
                style={{ ...S.presetCard, ...(activePreset === 'reorder_urgent' ? S.presetCardActive : {}) }}
              >
                <div style={S.presetHeader}>
                  <AlertTriangle size={16} color={activePreset === 'reorder_urgent' ? '#dc2626' : '#64748b'} />
                  <span style={S.presetTitle}>Urgent Reorder List</span>
                </div>
                <div style={S.presetDesc}>Items below reorder level with shortfall units &amp; estimated purchase cost</div>
              </button>

              <button
                type="button"
                onClick={() => applyPreset('valuation_audit')}
                style={{ ...S.presetCard, ...(activePreset === 'valuation_audit' ? S.presetCardActive : {}) }}
              >
                <div style={S.presetHeader}>
                  <BarChart3 size={16} color={activePreset === 'valuation_audit' ? '#0f766e' : '#64748b'} />
                  <span style={S.presetTitle}>Class A Valuation</span>
                </div>
                <div style={S.presetDesc}>Top strategic high-value items representing primary mill working capital</div>
              </button>

              <button
                type="button"
                onClick={() => applyPreset('dead_stock')}
                style={{ ...S.presetCard, ...(activePreset === 'dead_stock' ? S.presetCardActive : {}) }}
              >
                <div style={S.presetHeader}>
                  <Clock size={16} color={activePreset === 'dead_stock' ? '#e11d48' : '#64748b'} />
                  <span style={S.presetTitle}>Slow &amp; Dead Stock</span>
                </div>
                <div style={S.presetDesc}>Inactive items (&gt;60 days dormant) with locked capital recovery analysis</div>
              </button>
            </div>
          </div>

          {/* Granular Store Manager Filter Options */}
          <div style={S.sectionBox}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ ...S.sectionLabel, marginBottom: 0 }}>
                <Filter size={14} color="#0f766e" />
                <span>Store Scope &amp; Target Filters</span>
              </div>
              <div style={{ fontSize: 11, color: '#0f766e', background: '#ecfdf5', padding: '2px 8px', borderRadius: 4, fontWeight: 600 }}>
                {availableCategories.length} Categories in Scope
              </div>
            </div>
            <div style={S.grid3}>
              <label style={S.label}>
                Store Domain
                <select
                  style={S.select}
                  value={storeType}
                  onChange={e => { setStoreType(e.target.value); setActivePreset('custom'); }}
                >
                  <option value="all">🏢 Complete Mill (All Stores)</option>
                  <option value="store">📦 General Store (Spares &amp; Consumables)</option>
                  <option value="mechanical">⚙️ Mechanical Store</option>
                  <option value="electrical">⚡ Electrical Store</option>
                  <option value="consumable">📦 Consumables &amp; General</option>
                  <option value="chemical">🧪 Raw Materials &amp; Chemical Store</option>
                </select>
              </label>

              <label style={S.label}>
                Specific Category
                <select
                  style={S.select}
                  value={categoryId}
                  onChange={e => { setCategoryId(e.target.value); setActivePreset('custom'); }}
                >
                  <option value="">-- All Categories in Selected Domain ({availableCategories.length}) --</option>
                  {availableCategories.map(c => (
                    <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
                  ))}
                </select>
              </label>

              <label style={S.label}>
                Stock Condition
                <select
                  style={S.select}
                  value={stockStatus}
                  onChange={e => { setStockStatus(e.target.value); setActivePreset('custom'); }}
                >
                  <option value="all">All Stock Statuses</option>
                  <option value="in_stock">🟢 In Stock Only (&gt; 0)</option>
                  <option value="low_stock">⚠️ Low Stock / Below Reorder Only</option>
                  <option value="out_of_stock">🔴 Zero / Out of Stock Only</option>
                </select>
              </label>

              <label style={S.label}>
                Criticality Class
                <select
                  style={S.select}
                  value={criticality}
                  onChange={e => { setCriticality(e.target.value); setActivePreset('custom'); }}
                >
                  <option value="all">All Classes (A, B, C)</option>
                  <option value="A">Class A (Critical / High Impact)</option>
                  <option value="B">Class B (Essential Operations)</option>
                  <option value="C">Class C (General Items)</option>
                </select>
              </label>

              <label style={S.label}>
                Plant Section
                <select
                  style={S.select}
                  value={sectionId}
                  onChange={e => { setSectionId(e.target.value); setActivePreset('custom'); }}
                >
                  <option value="">-- All Plant Sections ({(secList.length ? secList : sections).length}) --</option>
                  {(secList.length ? secList : sections).map(s => (
                    <option key={s.id} value={s.id}>{s.name} ({s.section_code || s.code})</option>
                  ))}
                </select>
              </label>

              <label style={S.label}>
                Search Filter (Code / Name / Rack)
                <input
                  style={S.input}
                  value={search}
                  onChange={e => { setSearch(e.target.value); setActivePreset('custom'); }}
                  placeholder="e.g. 6205, Contactor, Box 12..."
                />
              </label>
            </div>
          </div>

          {/* Workbook Sheets & Structure Options */}
          <div style={S.sectionBox}>
            <div style={S.sectionLabel}>
              <Settings2 size={14} color="#0f766e" />
              <span>Workbook Sheets &amp; Column Customizations</span>
            </div>
            <div style={S.toggleGrid}>
              <label style={S.toggleItem}>
                <input
                  type="checkbox"
                  checked={includeSummary}
                  onChange={e => setIncludeSummary(e.target.checked)}
                />
                <div>
                  <div style={S.toggleTitle}>📊 Executive Summary &amp; Category Table</div>
                  <div style={S.toggleDesc}>Summary KPIs, category stock distribution, financial value share %</div>
                </div>
              </label>

              <label style={S.toggleItem}>
                <input
                  type="checkbox"
                  checked={includeMaster}
                  onChange={e => setIncludeMaster(e.target.checked)}
                />
                <div>
                  <div style={S.toggleTitle}>📦 Complete Inventory Master Ledger</div>
                  <div style={S.toggleDesc}>Master catalog sheet containing all filtered materials with auto-sizing</div>
                </div>
              </label>

              <label style={S.toggleItem}>
                <input
                  type="checkbox"
                  checked={includeCategorySheets}
                  onChange={e => setIncludeCategorySheets(e.target.checked)}
                />
                <div>
                  <div style={S.toggleTitle}>📑 Dedicated Category Tabs</div>
                  <div style={S.toggleDesc}>Creates separate individual sheets for Bearings, Valves, Drives, etc.</div>
                </div>
              </label>

              <label style={S.toggleItem}>
                <input
                  type="checkbox"
                  checked={includeReorderSheet}
                  onChange={e => setIncludeReorderSheet(e.target.checked)}
                />
                <div>
                  <div style={S.toggleTitle}>⚠️ Reorder &amp; Low Stock Action Sheet</div>
                  <div style={S.toggleDesc}>Shortfall units &amp; estimated replenishment cost for store purchase planning</div>
                </div>
              </label>

              <label style={S.toggleItem}>
                <input
                  type="checkbox"
                  checked={includeHighValueSheet}
                  onChange={e => setIncludeHighValueSheet(e.target.checked)}
                />
                <div>
                  <div style={S.toggleTitle}>💰 Class A Strategic High Value Sheet</div>
                  <div style={S.toggleDesc}>Ranked strategic portfolio items representing 80% of total mill capital</div>
                </div>
              </label>

              <label style={S.toggleItem}>
                <input
                  type="checkbox"
                  checked={includeSlowMovingSheet}
                  onChange={e => setIncludeSlowMovingSheet(e.target.checked)}
                />
                <div>
                  <div style={S.toggleTitle}>⏳ Slow &amp; Dead Stock Audit Sheet</div>
                  <div style={S.toggleDesc}>Items inactive for &gt;60 days with locked capital recovery recommendations</div>
                </div>
              </label>

              <label style={S.toggleItem}>
                <input
                  type="checkbox"
                  checked={includePricing}
                  onChange={e => setIncludePricing(e.target.checked)}
                />
                <div>
                  <div style={S.toggleTitle}>💰 Include Unit Price &amp; Stock Valuation</div>
                  <div style={S.toggleDesc}>Includes live ₹ prices and total stock valuation calculations</div>
                </div>
              </label>

              <label style={S.toggleItem}>
                <input
                  type="checkbox"
                  checked={includeMovement}
                  onChange={e => setIncludeMovement(e.target.checked)}
                />
                <div>
                  <div style={S.toggleTitle}>🔄 Include Daily Rollover Movement</div>
                  <div style={S.toggleDesc}>Opening (Yesterday), Received (Today), Issued (Today), Closing Balance</div>
                </div>
              </label>

              <label style={S.toggleItem}>
                <input
                  type="checkbox"
                  checked={includeTechnical}
                  onChange={e => setIncludeTechnical(e.target.checked)}
                />
                <div>
                  <div style={S.toggleTitle}>🔩 Include Technical Specs &amp; Locations</div>
                  <div style={S.toggleDesc}>HSN Code, Rack/Box No, OEM Supplier, Vendor Name &amp; GSTIN (Last PO), Lifespan, Calibration Protocol</div>
                </div>
              </label>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div style={S.errorBox}>
              <AlertTriangle size={16} color="#dc2626" />
              <span>{error}</span>
            </div>
          )}

          {/* Success Banner */}
          {downloadSuccess && (
            <div style={S.successBox}>
              <CheckCircle2 size={18} color="#16a34a" />
              <div>
                <strong>Excel Download Complete!</strong>
                <div style={{ fontSize: 12, marginTop: 2 }}>
                  File: <code>{downloadSuccess.filename}</code> • {downloadSuccess.totalSKUs} items processed
                  {downloadSuccess.totalValuation ? ` • Live Valuation: ₹${downloadSuccess.totalValuation}` : ''} ({downloadSuccess.timestamp})
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div style={S.footer}>
          <button type="button" style={S.btnSecondary} onClick={onClose} disabled={downloading}>
            Close
          </button>
          <button
            type="button"
            style={{ ...S.btnPrimary, ...(downloading ? { opacity: 0.7, cursor: 'wait' } : {}) }}
            onClick={handleExport}
            disabled={downloading}
          >
            {downloading ? (
              <>
                <RefreshCw size={16} className="animate-spin" />
                <span>Generating Enterprise Excel...</span>
              </>
            ) : (
              <>
                <Download size={16} />
                <span>Generate &amp; Download Excel (.xlsx)</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

const S = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    backdropFilter: 'blur(3px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1050,
    padding: 16
  },
  modal: {
    background: '#ffffff',
    borderRadius: 14,
    width: '100%',
    maxWidth: 900,
    maxHeight: '92vh',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.1)',
    border: '1px solid #e2e8f0',
    overflow: 'hidden'
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 22px',
    borderBottom: '1px solid #e2e8f0',
    background: '#f8fafc'
  },
  headerIcon: {
    width: 42,
    height: 42,
    borderRadius: 10,
    background: '#ccfbf1',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  title: {
    fontSize: 17,
    fontWeight: 800,
    color: '#0f172a'
  },
  subtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2
  },
  closeBtn: {
    background: 'transparent',
    border: 'none',
    fontSize: 18,
    color: '#94a3b8',
    cursor: 'pointer',
    padding: '4px 8px',
    borderRadius: 6
  },
  body: {
    padding: '18px 22px',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: 16
  },
  sectionBox: {
    background: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: 10,
    padding: '14px 16px'
  },
  sectionLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 12,
    fontWeight: 700,
    color: '#0f766e',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    marginBottom: 12
  },
  presetGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
    gap: 10
  },
  presetCard: {
    background: '#f8fafc',
    border: '1px solid #e2e8f0',
    borderRadius: 8,
    padding: '10px 12px',
    textAlign: 'left',
    cursor: 'pointer',
    transition: 'all 0.15s ease'
  },
  presetCardActive: {
    background: '#f0fdfa',
    borderColor: '#0f766e',
    boxShadow: '0 0 0 2px rgba(15, 118, 110, 0.2)'
  },
  presetHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4
  },
  presetTitle: {
    fontSize: 13,
    fontWeight: 700,
    color: '#1e293b'
  },
  presetDesc: {
    fontSize: 11,
    color: '#64748b',
    lineHeight: 1.3
  },
  grid3: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
    gap: 12
  },
  label: {
    display: 'flex',
    flexDirection: 'column',
    gap: 5,
    fontSize: 12,
    fontWeight: 600,
    color: '#334155'
  },
  select: {
    padding: '8px 10px',
    border: '1px solid #cbd5e1',
    borderRadius: 6,
    fontSize: 13,
    color: '#1e293b',
    background: '#ffffff',
    outline: 'none'
  },
  input: {
    padding: '8px 10px',
    border: '1px solid #cbd5e1',
    borderRadius: 6,
    fontSize: 13,
    color: '#1e293b',
    outline: 'none'
  },
  toggleGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
    gap: 10
  },
  toggleItem: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 10,
    background: '#f8fafc',
    border: '1px solid #f1f5f9',
    borderRadius: 8,
    padding: '10px 12px',
    cursor: 'pointer'
  },
  toggleTitle: {
    fontSize: 12,
    fontWeight: 700,
    color: '#1e293b'
  },
  toggleDesc: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2
  },
  errorBox: {
    background: '#fef2f2',
    border: '1px solid #fecaca',
    borderRadius: 8,
    padding: '10px 14px',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 12,
    color: '#dc2626'
  },
  successBox: {
    background: '#f0fdf4',
    border: '1px solid #bbf7d0',
    borderRadius: 8,
    padding: '12px 14px',
    display: 'flex',
    alignItems: 'flex-start',
    gap: 10,
    fontSize: 13,
    color: '#166534'
  },
  footer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 10,
    padding: '14px 22px',
    borderTop: '1px solid #e2e8f0',
    background: '#f8fafc'
  },
  btnSecondary: {
    padding: '9px 16px',
    background: '#ffffff',
    border: '1px solid #cbd5e1',
    borderRadius: 7,
    fontSize: 13,
    fontWeight: 600,
    color: '#475569',
    cursor: 'pointer'
  },
  btnPrimary: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '9px 20px',
    background: '#0f766e',
    border: 'none',
    borderRadius: 7,
    fontSize: 13,
    fontWeight: 700,
    color: '#ffffff',
    cursor: 'pointer',
    boxShadow: '0 2px 4px rgba(15, 118, 110, 0.2)'
  }
}
