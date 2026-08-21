import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import ProductDetailModal from '../components/ProductDetailModal'
import {
  Boxes, TrendingUp, AlertTriangle, ArrowDownRight, ArrowUpRight,
  RefreshCw, Settings, Sliders, CheckCircle2, X, Eye, EyeOff,
  BarChart3, PieChart, Layers, Clock, ShieldCheck, ShoppingCart,
  DollarSign, Package, Factory, Zap, FileText, ChevronRight, ExternalLink,
  Filter, Calendar, Download, Sparkles, Search, ArrowUpDown, ArrowRight,
  Building2, Check
} from 'lucide-react'

const API = '/api'
const h = () => ({ Authorization: `Bearer ${localStorage.getItem('mk_token')}` })

const DEFAULT_CONFIG = {
  layoutDensity: 'balanced', // 'dense' | 'balanced' | 'focus'
  kpis: {
    totalValuation: true,
    totalQty: true,
    lowStock: true,
    todayInward: true,
    todayOutward: true,
    pendingIndents: true,
    outOfStock: true,
    deadStock: true,
  },
  charts: {
    categoryChart: 'donut', // 'donut' | 'pie' | 'bars' | 'table'
    trendChart: 'spline',   // 'spline' | 'bars' | 'net'
    deptChart: 'bars',      // 'bars' | 'donut' | 'table' | 'ranked'
    critChart: 'cards',     // 'cards' | 'dial'
    topMovingChart: 'bars'  // 'bars' | 'table'
  },
  autoRefreshInterval: 60 // in seconds, 0 = off
}

const CATEGORY_COLORS = [
  '#0f766e', '#2563eb', '#d97706', '#7c3aed', '#e11d48',
  '#059669', '#4f46e5', '#ca8a04', '#db2777', '#0891b2',
  '#65a30d', '#9333ea', '#ea580c', '#0284c7', '#475569'
]

export default function StoreDashboard({ onNavigate }) {
  const { user } = useAuth()
  const { addToast } = useToast()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [data, setData] = useState(null)
  const [dateRange, setDateRange] = useState('month') // 'today' | '7d' | 'month' | 'quarter'
  const [globalSearch, setGlobalSearch] = useState('')
  const [filterChip, setFilterChip] = useState('all') // 'all' | 'low_stock' | 'inward' | 'outward' | 'furnish' | 'chemicals'
  
  // Department Consumption filter & sort
  const [deptSearch, setDeptSearch] = useState('')
  const [deptSort, setDeptSort] = useState('value') // 'value' | 'qty' | 'issues' | 'name'
  const [deptChartType, setDeptChartType] = useState('bars') // 'bars' | 'donut' | 'table' | 'ranked'
  const [activeDeptIndex, setActiveDeptIndex] = useState(null)

  // Top moving search
  const [matSearch, setMatSearch] = useState('')

  const [config, setConfig] = useState(() => {
    try {
      const saved = localStorage.getItem('mk_store_dashboard_config')
      return saved ? { ...DEFAULT_CONFIG, ...JSON.parse(saved) } : DEFAULT_CONFIG
    } catch {
      return DEFAULT_CONFIG
    }
  })
  const [studioOpen, setStudioOpen] = useState(false)
  const [selectedProductModalId, setSelectedProductModalId] = useState(null)
  const [activeCategoryIndex, setActiveCategoryIndex] = useState(null)

  const handleNav = (targetPath) => {
    if (onNavigate) {
      onNavigate(targetPath.replace(/^\//, ''))
    } else {
      navigate(targetPath)
    }
  }

  // Save config changes
  const updateConfig = (updater) => {
    setConfig(prev => {
      const next = typeof updater === 'function' ? updater(prev) : { ...prev, ...updater }
      try { localStorage.setItem('mk_store_dashboard_config', JSON.stringify(next)) } catch {}
      return next
    })
  }

  const resetConfig = () => {
    setConfig(DEFAULT_CONFIG)
    try { localStorage.setItem('mk_store_dashboard_config', JSON.stringify(DEFAULT_CONFIG)) } catch {}
    addToast('Dashboard reset to factory settings', 'info')
  }

  // Load live analytics from PostgreSQL
  const loadAnalytics = useCallback(async () => {
    setLoading(true)
    try {
      const token = localStorage.getItem('mk_token')
      const res = await fetch(`${API}/store/dashboard-analytics?range=${dateRange}`, {
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        }
      })
      if (!res.ok) {
        throw new Error(`Server returned HTTP ${res.status}`)
      }
      const json = await res.json()
      if (json.success && json.data) {
        setData(json.data)
      } else {
        addToast(json.message || 'Failed to load store analytics', 'error')
      }
    } catch (e) {
      console.error('Store dashboard load error:', e)
      addToast(`Error loading store dashboard (${e.message}). Click Refresh to retry.`, 'error')
    } finally {
      setLoading(false)
    }
  }, [dateRange, addToast])

  useEffect(() => {
    loadAnalytics()
  }, [loadAnalytics])

  // Auto refresh timer
  useEffect(() => {
    if (!config.autoRefreshInterval || config.autoRefreshInterval <= 0) return
    const timer = setInterval(() => {
      loadAnalytics()
    }, config.autoRefreshInterval * 1000)
    return () => clearInterval(timer)
  }, [config.autoRefreshInterval, loadAnalytics])

  const kpis = data?.kpis || {}
  const categories = data?.categories || []
  const movementTrend = data?.movementTrend || []
  const departments = data?.departments || []
  const criticality = data?.criticality || { A: { count: 0, valuation: 0 }, B: { count: 0, valuation: 0 }, C: { count: 0, valuation: 0 } }
  const topMoving = data?.topMovingMaterials || []

  const fmtCur = (n, maxDec = 0) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: maxDec })}`
  const fmtN = (n, dec = 2) => Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: dec, maximumFractionDigits: dec })

  // ── FILTERED & SORTED DEPARTMENTS ──
  const filteredDepartments = useMemo(() => {
    let list = [...departments]
    if (deptSearch.trim()) {
      const q = deptSearch.toLowerCase()
      list = list.filter(d => (d.departmentName || '').toLowerCase().includes(q))
    }
    list.sort((a, b) => {
      if (deptSort === 'qty') return (b.totalQty || 0) - (a.totalQty || 0)
      if (deptSort === 'issues') return (b.issueCount || 0) - (a.issueCount || 0)
      if (deptSort === 'name') return (a.departmentName || '').localeCompare(b.departmentName || '')
      return (b.totalValue || 0) - (a.totalValue || 0) // default value
    })
    return list
  }, [departments, deptSearch, deptSort])

  const totalDeptConsumptionVal = useMemo(() => {
    return departments.reduce((acc, d) => acc + (parseFloat(d.totalValue) || 0), 0)
  }, [departments])

  const totalDeptConsumptionQty = useMemo(() => {
    return departments.reduce((acc, d) => acc + (parseFloat(d.totalQty) || 0), 0)
  }, [departments])

  // ── DONUT / PIE MATH ──
  const topCategories = useMemo(() => {
    let sorted = [...categories]
    if (globalSearch.trim()) {
      const q = globalSearch.toLowerCase()
      sorted = sorted.filter(c => (c.categoryName || '').toLowerCase().includes(q) || (c.categoryCode || '').toLowerCase().includes(q))
    }
    sorted.sort((a, b) => b.valuation - a.valuation)
    const top = sorted.slice(0, 7)
    const others = sorted.slice(7)
    if (others.length > 0) {
      const otherVal = others.reduce((s, r) => s + r.valuation, 0)
      const otherQty = others.reduce((s, r) => s + r.totalQty, 0)
      const otherCount = others.reduce((s, r) => s + r.itemCount, 0)
      const totalVal = kpis.totalStockValuation || 1
      top.push({
        categoryName: `Other ${others.length} Categories`,
        categoryCode: 'OTHERS',
        valuation: otherVal,
        totalQty: otherQty,
        itemCount: otherCount,
        percentage: parseFloat(((otherVal / totalVal) * 100).toFixed(2))
      })
    }
    return top
  }, [categories, kpis.totalStockValuation, globalSearch])

  // ── FILTERED TOP MOVING ──
  const filteredTopMoving = useMemo(() => {
    let list = [...topMoving]
    if (matSearch.trim() || globalSearch.trim()) {
      const q = (matSearch || globalSearch).toLowerCase()
      list = list.filter(m => (m.name || '').toLowerCase().includes(q) || (m.code || '').toLowerCase().includes(q) || (m.categoryName || '').toLowerCase().includes(q))
    }
    return list
  }, [topMoving, matSearch, globalSearch])

  // SVG Trend Calculations
  const maxTrendVal = useMemo(() => {
    if (!movementTrend.length) return 100
    return Math.max(...movementTrend.map(t => Math.max(t.inwardVal, t.outwardVal)), 100)
  }, [movementTrend])

  return (
    <div style={S.page}>
      {/* ── TOP EXECUTIVE BAR ── */}
      <div style={S.headerBar}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={S.title}>Store Management Executive Dashboard</span>
            <span style={S.liveBadge}>
              <span style={S.liveDot} /> Live PostgreSQL Engine
            </span>
          </div>
          <div style={S.subtitle}>
            Real-time Mill Inventory Valuation, Furnish Stock Ledgers, Department Consumption & Velocity Analytics
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {/* Date range picker */}
          <div style={S.dateToggleWrap}>
            {[
              { id: 'today', label: 'Today' },
              { id: '7d', label: '7 Days' },
              { id: 'month', label: 'This Month' },
              { id: 'quarter', label: 'Quarter' }
            ].map(r => (
              <button
                key={r.id}
                style={{ ...S.dateToggleBtn, ...(dateRange === r.id ? S.dateToggleBtnActive : {}) }}
                onClick={() => setDateRange(r.id)}
              >
                {r.label}
              </button>
            ))}
          </div>

          <button
            style={S.btnSecondary}
            onClick={loadAnalytics}
            disabled={loading}
            title="Refresh live PostgreSQL analytics"
          >
            <RefreshCw size={15} className={loading ? 'spin' : ''} />
            <span>{loading ? 'Refreshing...' : 'Refresh'}</span>
          </button>

          <button
            style={S.btnStudio}
            onClick={() => setStudioOpen(true)}
            title="Customize charts, widgets & layout"
          >
            <Sliders size={15} />
            <span>Customize Studio</span>
          </button>
        </div>
      </div>

      {/* ── ENHANCED SEARCH & MULTI-FILTER BAR ── */}
      <div style={S.searchFilterBar}>
        <div style={S.searchWrap}>
          <Search size={16} color="#64748b" style={{ position: 'absolute', left: 12, top: 11 }} />
          <input
            style={S.searchInput}
            placeholder="🔍 Instant filter across materials, categories, departments, codes..."
            value={globalSearch}
            onChange={e => setGlobalSearch(e.target.value)}
          />
          {globalSearch && (
            <button style={S.clearSearchBtn} onClick={() => setGlobalSearch('')} title="Clear filter">
              <X size={14} />
            </button>
          )}
        </div>

        <div style={S.filterChipsWrap}>
          {[
            { id: 'all', label: '⚡ All Overview', icon: Sparkles },
            { id: 'low_stock', label: `🚨 Low Stock (${kpis.lowStockCount || 0})`, icon: AlertTriangle, target: '/store' },
            { id: 'inward', label: `📥 Inwards (${kpis.todayInwardCount || 0})`, icon: ArrowDownRight, target: '/store' },
            { id: 'outward', label: '📤 Dept Outward', icon: ArrowUpRight, target: '/store' },
            { id: 'furnish', label: '📦 Raw Material Store', icon: Package, target: '/raw-material' },
            { id: 'reports', label: '📊 Reports & Analytics', icon: BarChart3, target: '/reports' },
          ].map(chip => (
            <button
              key={chip.id}
              style={{ ...S.chipBtn, ...(filterChip === chip.id ? S.chipBtnActive : {}) }}
              onClick={() => {
                setFilterChip(chip.id)
                if (chip.target) handleNav(chip.target)
              }}
            >
              <chip.icon size={13} />
              <span>{chip.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── KPI METRICS ROW WITH INTERACTIVE HYPERLINKS ── */}
      <div style={{
        ...S.kpiGrid,
        gridTemplateColumns: config.layoutDensity === 'dense'
          ? 'repeat(auto-fit, minmax(200px, 1fr))'
          : config.layoutDensity === 'focus'
            ? 'repeat(auto-fit, minmax(280px, 1fr))'
            : 'repeat(auto-fit, minmax(230px, 1fr))'
      }}>
        {config.kpis.totalValuation && (
          <div
            style={{ ...S.kpiCard, cursor: 'pointer' }}
            onClick={() => handleNav('/store')}
            title="Click to open Store Management Inventory"
          >
            <div style={S.kpiHead}>
              <span style={S.kpiLabel}>Total Store Valuation</span>
              <div style={{ ...S.kpiIcon, background: '#f0fdf4', color: '#16a34a' }}>
                <TrendingUp size={18} />
              </div>
            </div>
            <div style={{ ...S.kpiVal, color: '#15803d' }}>
              {fmtCur(kpis.totalStockValuation)}
            </div>
            <div style={S.kpiSub}>
              Live valuation across {kpis.totalCatalogItems || 0} tracked catalog items · <b>Click to View →</b>
            </div>
          </div>
        )}

        {config.kpis.totalQty && (
          <div
            style={{ ...S.kpiCard, cursor: 'pointer' }}
            onClick={() => handleNav('/materials')}
            title="Click to open Master Materials Catalog"
          >
            <div style={S.kpiHead}>
              <span style={S.kpiLabel}>Bulk Inventory Weight</span>
              <div style={{ ...S.kpiIcon, background: '#eff6ff', color: '#2563eb' }}>
                <Package size={18} />
              </div>
            </div>
            <div style={{ ...S.kpiVal, color: '#1d4ed8' }}>
              {fmtN(kpis.totalStockQty, 2)} <span style={{ fontSize: 13, fontWeight: 600 }}>Kgs / MT</span>
            </div>
            <div style={S.kpiSub}>
              Active raw furnish, chemicals & plant spares · <b>Click to View →</b>
            </div>
          </div>
        )}

        {config.kpis.lowStock && (
          <div
            style={{ ...S.kpiCard, borderLeft: kpis.lowStockCount > 0 ? '4px solid #ef4444' : undefined, cursor: 'pointer' }}
            onClick={() => handleNav('/store')}
            title="Click to inspect reorder items in Store"
          >
            <div style={S.kpiHead}>
              <span style={S.kpiLabel}>Reorder Buffer Risk</span>
              <div style={{ ...S.kpiIcon, background: '#fef2f2', color: '#dc2626' }}>
                <AlertTriangle size={18} />
              </div>
            </div>
            <div style={{ ...S.kpiVal, color: kpis.lowStockCount > 0 ? '#dc2626' : '#16a34a' }}>
              {kpis.lowStockCount || 0} <span style={{ fontSize: 13, fontWeight: 600 }}>Items</span>
            </div>
            <div style={S.kpiSub}>
              Items currently at or below safety stock · <b>Click to Restock →</b>
            </div>
          </div>
        )}

        {config.kpis.outOfStock && (
          <div
            style={{ ...S.kpiCard, borderLeft: kpis.outOfStockCount > 0 ? '4px solid #b91c1c' : undefined, cursor: 'pointer' }}
            onClick={() => handleNav('/store')}
            title="Click to inspect zero-stock items in Store"
          >
            <div style={S.kpiHead}>
              <span style={S.kpiLabel}>Out of Stock</span>
              <div style={{ ...S.kpiIcon, background: '#fef2f2', color: '#b91c1c' }}>
                <ShieldCheck size={18} />
              </div>
            </div>
            <div style={{ ...S.kpiVal, color: kpis.outOfStockCount > 0 ? '#b91c1c' : '#16a34a' }}>
              {kpis.outOfStockCount || 0} <span style={{ fontSize: 13, fontWeight: 600 }}>Items</span>
            </div>
            <div style={S.kpiSub}>
              Catalog items currently at zero stock · <b>Click to Restock →</b>
            </div>
          </div>
        )}

        {config.kpis.todayInward && (
          <div
            style={{ ...S.kpiCard, cursor: 'pointer' }}
            onClick={() => handleNav('/store')}
            title="Click to open Inward Desk (GRN)"
          >
            <div style={S.kpiHead}>
              <span style={S.kpiLabel}>Today's Inward Receipts</span>
              <div style={{ ...S.kpiIcon, background: '#f0fdfa', color: '#0f766e' }}>
                <ArrowDownRight size={18} />
              </div>
            </div>
            <div style={{ ...S.kpiVal, color: '#0f766e' }}>
              {fmtCur(kpis.todayInwardVal)}
            </div>
            <div style={S.kpiSub}>
              +{fmtN(kpis.todayInwardQty, 2)} units · {kpis.todayInwardCount || 0} GRNs · <b>Open Inward Desk →</b>
            </div>
          </div>
        )}

        {config.kpis.todayOutward && (
          <div
            style={{ ...S.kpiCard, cursor: 'pointer' }}
            onClick={() => handleNav('/store')}
            title="Click to open Outward Desk (Issues)"
          >
            <div style={S.kpiHead}>
              <span style={S.kpiLabel}>Today's Department Issues</span>
              <div style={{ ...S.kpiIcon, background: '#fffbeb', color: '#d97706' }}>
                <ArrowUpRight size={18} />
              </div>
            </div>
            <div style={{ ...S.kpiVal, color: '#b45309' }}>
              {fmtCur(kpis.todayOutwardVal)}
            </div>
            <div style={S.kpiSub}>
              -{fmtN(kpis.todayOutwardQty, 2)} units issued · <b>Open Outward Desk →</b>
            </div>
          </div>
        )}

        {config.kpis.pendingIndents && (
          <div
            style={{ ...S.kpiCard, cursor: 'pointer' }}
            onClick={() => handleNav('/store')}
            title="Click to open Indent Requests & Approvals Queue"
          >
            <div style={S.kpiHead}>
              <span style={S.kpiLabel}>Pending Store Indents</span>
              <div style={{ ...S.kpiIcon, background: '#faf5ff', color: '#7c3aed' }}>
                <FileText size={18} />
              </div>
            </div>
            <div style={{ ...S.kpiVal, color: '#6d28d9' }}>
              {kpis.pendingIndentsCount || 0} <span style={{ fontSize: 13, fontWeight: 600 }}>Requests</span>
            </div>
            <div style={S.kpiSub}>
              Awaiting store issue approval ({fmtCur(kpis.pendingIndentsVal)}) · <b>Approve →</b>
            </div>
          </div>
        )}

        {config.kpis.deadStock && (
          <div
            style={{ ...S.kpiCard, cursor: 'pointer' }}
            onClick={() => handleNav('/reports')}
            title="Click to view Reports & Analytics Hub"
          >
            <div style={S.kpiHead}>
              <span style={S.kpiLabel}>Slow / Dead Stock Capital</span>
              <div style={{ ...S.kpiIcon, background: '#fff1f2', color: '#e11d48' }}>
                <Clock size={18} />
              </div>
            </div>
            <div style={{ ...S.kpiVal, color: '#be123c' }}>
              {fmtCur(kpis.deadStockVal)}
            </div>
            <div style={S.kpiSub}>
              {kpis.deadStockCount || 0} items with 0 movement in &gt;60 days · <b>Analyze →</b>
            </div>
          </div>
        )}
      </div>

      {/* ── MAIN CHARTS & ANALYTICS WORKSPACE ── */}
      <div style={S.chartsWorkspace}>
        {/* ROW 1: CATEGORY VALUATION BREAKDOWN & 14-DAY INWARD/OUTWARD TREND */}
        <div style={S.twoColGrid}>
          {/* ── WIDGET 1: CATEGORY VALUATION ── */}
          <div style={S.card}>
            <div style={S.cardHeader}>
              <div>
                <div style={S.cardTitle}>Category Valuation Distribution</div>
                <div style={S.cardSub}>Live portfolio allocation by material classification (Click item to filter)</div>
              </div>
              <div style={S.chartTypeSelector}>
                {['donut', 'pie', 'bars', 'table'].map(type => (
                  <button
                    key={type}
                    style={{ ...S.typeBtn, ...(config.charts.categoryChart === type ? S.typeBtnActive : {}) }}
                    onClick={() => updateConfig(c => ({ ...c, charts: { ...c.charts, categoryChart: type } }))}
                    title={`Switch to ${type} view`}
                  >
                    {type === 'donut' ? '🍩 Donut' : type === 'pie' ? '🥧 Pie' : type === 'bars' ? '📊 Bars' : '📋 Table'}
                  </button>
                ))}
              </div>
            </div>

            {/* DONUT VIEW */}
            {config.charts.categoryChart === 'donut' && (
              <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 20, alignItems: 'center', minHeight: 260 }}>
                <div style={{ position: 'relative', width: 200, height: 200, margin: '0 auto' }}>
                  <svg width="200" height="200" viewBox="0 0 42 42">
                    <circle cx="21" cy="21" r="15.91549430918954" fill="transparent" stroke="#f1f5f9" strokeWidth="6" />
                    {(() => {
                      let accumulated = 0
                      return topCategories.map((c, i) => {
                        const pct = c.percentage || 0
                        const dash = `${pct} ${100 - pct}`
                        const offset = 100 - accumulated + 25
                        accumulated += pct
                        return (
                          <circle
                            key={c.categoryName}
                            cx="21"
                            cy="21"
                            r="15.91549430918954"
                            fill="transparent"
                            stroke={CATEGORY_COLORS[i % CATEGORY_COLORS.length]}
                            strokeWidth={activeCategoryIndex === i ? '7.5' : '6'}
                            strokeDasharray={dash}
                            strokeDashoffset={offset}
                            style={{ transition: 'all 0.3s ease', cursor: 'pointer' }}
                            onClick={() => handleNav('/materials')}
                            onMouseEnter={() => setActiveCategoryIndex(i)}
                            onMouseLeave={() => setActiveCategoryIndex(null)}
                          />
                        )
                      })
                    })()}
                  </svg>
                  <div style={S.donutCenter}>
                    <div style={{ fontSize: 10, color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Total</div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: '#0f172a' }}>
                      {fmtCur(kpis.totalStockValuation, 0)}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 260, overflowY: 'auto' }}>
                  {topCategories.map((c, i) => (
                    <div
                      key={c.categoryName}
                      style={{
                        ...S.legendItem,
                        background: activeCategoryIndex === i ? '#f8fafc' : 'transparent',
                        borderColor: activeCategoryIndex === i ? '#cbd5e1' : 'transparent'
                      }}
                      onClick={() => handleNav('/materials')}
                      onMouseEnter={() => setActiveCategoryIndex(i)}
                      onMouseLeave={() => setActiveCategoryIndex(null)}
                      title="Click to view category materials"
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 10, height: 10, borderRadius: '50%', background: CATEGORY_COLORS[i % CATEGORY_COLORS.length] }} />
                        <span style={{ fontSize: 12.5, fontWeight: 700, color: '#1e293b' }}>{c.categoryName}</span>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span style={{ fontSize: 12.5, fontWeight: 800, color: '#0f172a' }}>{fmtCur(c.valuation)}</span>
                        <span style={{ fontSize: 11, color: '#64748b', marginLeft: 6 }}>({c.percentage}%)</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* BARS VIEW */}
            {config.charts.categoryChart === 'bars' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minHeight: 260, overflowY: 'auto' }}>
                {topCategories.map((c, i) => (
                  <div key={c.categoryName} style={{ cursor: 'pointer' }} onClick={() => handleNav('/materials')}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
                      <span style={{ color: '#1e293b' }}>{c.categoryName} ({c.itemCount} items)</span>
                      <span style={{ color: '#0f172a' }}>{fmtCur(c.valuation)} ({c.percentage}%)</span>
                    </div>
                    <div style={S.barBg}>
                      <div
                        style={{
                          ...S.barFill,
                          width: `${Math.max(2, c.percentage)}%`,
                          background: CATEGORY_COLORS[i % CATEGORY_COLORS.length]
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* TABLE VIEW */}
            {config.charts.categoryChart === 'table' && (
              <div style={{ maxHeight: 260, overflowY: 'auto' }}>
                <table style={S.table}>
                  <thead>
                    <tr>
                      <th style={S.th}>Category</th>
                      <th style={S.th}>Items</th>
                      <th style={S.th}>Stock Qty</th>
                      <th style={S.th}>Valuation</th>
                      <th style={S.th}>Share</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topCategories.map(c => (
                      <tr key={c.categoryName} style={{ cursor: 'pointer' }} onClick={() => handleNav('/materials')}>
                        <td style={{ ...S.td, fontWeight: 700 }}>{c.categoryName}</td>
                        <td style={S.td}>{c.itemCount}</td>
                        <td style={S.td}>{fmtN(c.totalQty, 1)}</td>
                        <td style={{ ...S.td, fontWeight: 800, color: '#0f766e' }}>{fmtCur(c.valuation)}</td>
                        <td style={S.td}><b>{c.percentage}%</b></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ── WIDGET 2: 14-DAY INWARD/OUTWARD VELOCITY TREND ── */}
          <div style={S.card}>
            <div style={S.cardHeader}>
              <div>
                <div style={S.cardTitle}>14-Day Store Movement Velocity</div>
                <div style={S.cardSub}>Physical stock intake (GRN) vs department issuance flow</div>
              </div>
              <div style={S.chartTypeSelector}>
                {['spline', 'bars', 'net'].map(type => (
                  <button
                    key={type}
                    style={{ ...S.typeBtn, ...(config.charts.trendChart === type ? S.typeBtnActive : {}) }}
                    onClick={() => updateConfig(c => ({ ...c, charts: { ...c.charts, trendChart: type } }))}
                    title={`Switch to ${type} view`}
                  >
                    {type === 'spline' ? '📈 Spline' : type === 'bars' ? '📊 Bars' : '⚖️ Net Delta'}
                  </button>
                ))}
              </div>
            </div>

            {/* SPLINE VIEW */}
            {config.charts.trendChart === 'spline' && (
              <div>
                <div style={{ display: 'flex', gap: 16, marginBottom: 10, fontSize: 12, fontWeight: 700 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 12, height: 3, background: '#0f766e', borderRadius: 2 }} />
                    <span style={{ color: '#0f766e' }}>Inward Receipts (GRN)</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 12, height: 3, background: '#ea580c', borderRadius: 2 }} />
                    <span style={{ color: '#ea580c' }}>Department Issues</span>
                  </div>
                </div>

                <div style={{ width: '100%', height: 180, position: 'relative' }}>
                  <svg width="100%" height="100%" viewBox="0 0 500 180" preserveAspectRatio="none">
                    <defs>
                      <linearGradient id="inwardGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#0f766e" stopOpacity="0.25" />
                        <stop offset="100%" stopColor="#0f766e" stopOpacity="0.0" />
                      </linearGradient>
                      <linearGradient id="outwardGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#ea580c" stopOpacity="0.25" />
                        <stop offset="100%" stopColor="#ea580c" stopOpacity="0.0" />
                      </linearGradient>
                    </defs>

                    {(() => {
                      if (!movementTrend.length) return null
                      const stepX = 500 / (movementTrend.length - 1 || 1)
                      const ptsIn = movementTrend.map((t, idx) => {
                        const x = idx * stepX
                        const y = 170 - (t.inwardVal / (maxTrendVal || 1)) * 150
                        return `${x},${y}`
                      }).join(' ')

                      const ptsOut = movementTrend.map((t, idx) => {
                        const x = idx * stepX
                        const y = 170 - (t.outwardVal / (maxTrendVal || 1)) * 150
                        return `${x},${y}`
                      }).join(' ')

                      return (
                        <>
                          <polygon points={`0,170 ${ptsIn} 500,170`} fill="url(#inwardGrad)" />
                          <polyline points={ptsIn} fill="none" stroke="#0f766e" strokeWidth="2.5" />
                          <polygon points={`0,170 ${ptsOut} 500,170`} fill="url(#outwardGrad)" />
                          <polyline points={ptsOut} fill="none" stroke="#ea580c" strokeWidth="2.5" />
                        </>
                      )
                    })()}
                  </svg>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, color: '#94a3b8', marginTop: 6 }}>
                  {movementTrend.map((t, i) => i % 2 === 0 ? <span key={t.date}>{t.label}</span> : null)}
                </div>
              </div>
            )}

            {/* BARS VIEW */}
            {config.charts.trendChart === 'bars' && (
              <div>
                <div style={{ display: 'flex', gap: 16, marginBottom: 10, fontSize: 12, fontWeight: 700 }}>
                  <span style={{ color: '#0f766e' }}>■ Inward (GRN)</span>
                  <span style={{ color: '#ea580c' }}>■ Outward (Issue)</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 190, paddingTop: 20 }}>
                  {movementTrend.map(t => {
                    const hIn = Math.max(4, (t.inwardVal / (maxTrendVal || 1)) * 150)
                    const hOut = Math.max(4, (t.outwardVal / (maxTrendVal || 1)) * 150)
                    return (
                      <div key={t.date} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                        <div style={{ display: 'flex', gap: 2, alignItems: 'flex-end', height: 160 }}>
                          <div style={{ width: 8, height: hIn, background: '#0f766e', borderRadius: '3px 3px 0 0' }} title={`${t.label} Inward: ${fmtCur(t.inwardVal)}`} />
                          <div style={{ width: 8, height: hOut, background: '#ea580c', borderRadius: '3px 3px 0 0' }} title={`${t.label} Outward: ${fmtCur(t.outwardVal)}`} />
                        </div>
                        <span style={{ fontSize: 9.5, color: '#64748b' }}>{t.label.split(' ')[1]}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* NET DELTA VIEW */}
            {config.charts.trendChart === 'net' && (
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 10 }}>Net Daily Physical Stock Change (Inward Qty - Issue Qty)</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 200, overflowY: 'auto' }}>
                  {movementTrend.map(t => {
                    const isPos = t.netQty >= 0
                    return (
                      <div key={t.date} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 8px', borderRadius: 6, background: isPos ? '#f0fdf4' : '#fff7ed', fontSize: 12 }}>
                        <span style={{ fontWeight: 700, color: '#334155' }}>{t.label}</span>
                        <span style={{ fontWeight: 800, color: isPos ? '#16a34a' : '#ea580c' }}>
                          {isPos ? `+${fmtN(t.netQty, 2)}` : fmtN(t.netQty, 2)} units
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ROW 2: ENHANCED DEPARTMENT CONSUMPTION SHARE & TOP MOVING FAST MATERIALS */}
        <div style={S.twoColGrid}>
          {/* ── WIDGET 3: ENHANCED DEPARTMENT CONSUMPTION SHARE ── */}
          <div style={S.card}>
            <div style={S.cardHeader}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Building2 size={18} color="#0f766e" />
                  <div style={S.cardTitle}>Department Consumption Share</div>
                </div>
                <div style={S.cardSub}>
                  Total: <b>{fmtCur(totalDeptConsumptionVal)}</b> ({fmtN(totalDeptConsumptionQty, 1)} units) across {departments.length} departments
                </div>
              </div>

              {/* View Switcher */}
              <div style={S.chartTypeSelector}>
                {[
                  { id: 'bars', label: '📊 Bars' },
                  { id: 'donut', label: '🍩 Donut' },
                  { id: 'table', label: '📋 Table' },
                  { id: 'ranked', label: '🏆 Ranked' }
                ].map(v => (
                  <button
                    key={v.id}
                    style={{ ...S.typeBtn, ...(deptChartType === v.id ? S.typeBtnActive : {}) }}
                    onClick={() => setDeptChartType(v.id)}
                  >
                    {v.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Department search and sort toolbar */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ position: 'relative', flex: 1, minWidth: 160 }}>
                <Search size={13} color="#94a3b8" style={{ position: 'absolute', left: 9, top: 8 }} />
                <input
                  style={{ ...S.searchInput, height: 30, fontSize: 11.5, paddingLeft: 28 }}
                  placeholder="Filter department name..."
                  value={deptSearch}
                  onChange={e => setDeptSearch(e.target.value)}
                />
                {deptSearch && (
                  <button style={{ ...S.clearSearchBtn, top: 6 }} onClick={() => setDeptSearch('')}>
                    <X size={12} />
                  </button>
                )}
              </div>

              <select
                style={{ ...S.searchInput, height: 30, width: 'auto', fontSize: 11.5, padding: '0 8px', background: '#fff' }}
                value={deptSort}
                onChange={e => setDeptSort(e.target.value)}
              >
                <option value="value">Sort: Value (₹) ↓</option>
                <option value="qty">Sort: Consumed Qty ↓</option>
                <option value="issues">Sort: Indents Count ↓</option>
                <option value="name">Sort: Alphabetical A-Z</option>
              </select>
            </div>

            {/* BARS VIEW */}
            {deptChartType === 'bars' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minHeight: 250, maxHeight: 320, overflowY: 'auto' }}>
                {filteredDepartments.length === 0 ? (
                  <div style={S.empty}>No matching department issues found.</div>
                ) : (
                  filteredDepartments.map((d, i) => (
                    <div
                      key={d.departmentName}
                      style={{
                        padding: '6px 8px',
                        borderRadius: 8,
                        background: activeDeptIndex === i ? '#f1f5f9' : 'transparent',
                        cursor: 'pointer',
                        transition: 'all 0.15s'
                      }}
                      onClick={() => handleNav('/store')}
                      onMouseEnter={() => setActiveDeptIndex(i)}
                      onMouseLeave={() => setActiveDeptIndex(null)}
                      title="Click to view department issue vouchers in Store"
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, fontWeight: 700, marginBottom: 4 }}>
                        <span style={{ color: '#1e293b', display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span>{d.departmentName}</span>
                          <ExternalLink size={11} color="#64748b" />
                        </span>
                        <span style={{ color: '#0f172a' }}>{fmtCur(d.totalValue)} ({d.percentage}%)</span>
                      </div>
                      <div style={S.barBg}>
                        <div
                          style={{
                            ...S.barFill,
                            width: `${Math.max(3, d.percentage)}%`,
                            background: CATEGORY_COLORS[i % CATEGORY_COLORS.length]
                          }}
                        />
                      </div>
                      <div style={{ fontSize: 11, color: '#64748b', marginTop: 3, display: 'flex', justifyContent: 'space-between' }}>
                        <span>{d.issueCount} issue vouchers · {fmtN(d.totalQty, 1)} units consumed</span>
                        <span style={{ color: '#0f766e', fontWeight: 600 }}>Open Indents ↗</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* DONUT VIEW */}
            {deptChartType === 'donut' && (
              <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: 16, alignItems: 'center', minHeight: 250 }}>
                <div style={{ position: 'relative', width: 170, height: 170, margin: '0 auto' }}>
                  <svg width="170" height="170" viewBox="0 0 42 42">
                    <circle cx="21" cy="21" r="15.91549430918954" fill="transparent" stroke="#f1f5f9" strokeWidth="6" />
                    {(() => {
                      let accumulated = 0
                      return filteredDepartments.map((d, i) => {
                        const pct = d.percentage || 0
                        const dash = `${pct} ${100 - pct}`
                        const offset = 100 - accumulated + 25
                        accumulated += pct
                        return (
                          <circle
                            key={d.departmentName}
                            cx="21"
                            cy="21"
                            r="15.91549430918954"
                            fill="transparent"
                            stroke={CATEGORY_COLORS[i % CATEGORY_COLORS.length]}
                            strokeWidth={activeDeptIndex === i ? '7.5' : '6'}
                            strokeDasharray={dash}
                            strokeDashoffset={offset}
                            style={{ transition: 'all 0.3s ease', cursor: 'pointer' }}
                            onClick={() => handleNav('/store')}
                            onMouseEnter={() => setActiveDeptIndex(i)}
                            onMouseLeave={() => setActiveDeptIndex(null)}
                          />
                        )
                      })
                    })()}
                  </svg>
                  <div style={S.donutCenter}>
                    <div style={{ fontSize: 9.5, color: '#64748b', fontWeight: 700 }}>TOTAL</div>
                    <div style={{ fontSize: 12, fontWeight: 800, color: '#0f172a' }}>
                      {fmtCur(totalDeptConsumptionVal, 0)}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 250, overflowY: 'auto' }}>
                  {filteredDepartments.map((d, i) => (
                    <div
                      key={d.departmentName}
                      style={{
                        ...S.legendItem,
                        background: activeDeptIndex === i ? '#f8fafc' : 'transparent',
                        borderColor: activeDeptIndex === i ? '#cbd5e1' : 'transparent'
                      }}
                      onClick={() => handleNav('/store')}
                      onMouseEnter={() => setActiveDeptIndex(i)}
                      onMouseLeave={() => setActiveDeptIndex(null)}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 9, height: 9, borderRadius: '50%', background: CATEGORY_COLORS[i % CATEGORY_COLORS.length] }} />
                        <span style={{ fontSize: 12, fontWeight: 700, color: '#1e293b' }}>{d.departmentName}</span>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span style={{ fontSize: 12, fontWeight: 800, color: '#0f172a' }}>{fmtCur(d.totalValue)}</span>
                        <span style={{ fontSize: 10.5, color: '#64748b', marginLeft: 4 }}>({d.percentage}%)</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TABLE VIEW */}
            {deptChartType === 'table' && (
              <div style={{ maxHeight: 250, overflowY: 'auto' }}>
                <table style={S.table}>
                  <thead>
                    <tr>
                      <th style={S.th}>Department</th>
                      <th style={S.th}>Issues</th>
                      <th style={S.th}>Consumed Qty</th>
                      <th style={S.th}>Valuation</th>
                      <th style={S.th}>Share</th>
                      <th style={S.th}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDepartments.map(d => (
                      <tr key={d.departmentName} style={{ cursor: 'pointer' }} onClick={() => handleNav('/store')}>
                        <td style={{ ...S.td, fontWeight: 700 }}>{d.departmentName}</td>
                        <td style={S.td}>{d.issueCount}</td>
                        <td style={S.td}>{fmtN(d.totalQty, 1)}</td>
                        <td style={{ ...S.td, fontWeight: 800, color: '#0f766e' }}>{fmtCur(d.totalValue)}</td>
                        <td style={S.td}><b>{d.percentage}%</b></td>
                        <td style={S.td}>
                          <span style={{ color: '#0f766e', fontWeight: 700, fontSize: 11 }}>View →</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* RANKED LEADERBOARD VIEW */}
            {deptChartType === 'ranked' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 250, overflowY: 'auto' }}>
                {filteredDepartments.map((d, i) => (
                  <div
                    key={d.departmentName}
                    style={S.topMatItem}
                    onClick={() => handleNav('/store')}
                    title="Click to view department issue vouchers"
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ ...S.rankBadge, background: i === 0 ? '#fef3c7' : i === 1 ? '#e0e7ff' : '#f1f5f9', color: i === 0 ? '#b45309' : i === 1 ? '#4338ca' : '#475569' }}>
                        #{i + 1}
                      </div>
                      <div>
                        <div style={{ fontSize: 12.5, fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span>{d.departmentName}</span>
                          <ExternalLink size={11} color="#64748b" />
                        </div>
                        <div style={{ fontSize: 11, color: '#64748b' }}>
                          {d.issueCount} Indents · {fmtN(d.totalQty, 1)} Units Consumed
                        </div>
                      </div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 12.5, fontWeight: 800, color: '#0f766e' }}>
                        {fmtCur(d.totalValue)}
                      </div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b' }}>
                        {d.percentage}% Share
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── WIDGET 4: TOP FAST-MOVING MATERIALS ── */}
          <div style={S.card}>
            <div style={S.cardHeader}>
              <div>
                <div style={S.cardTitle}>Top Moving & High-Turnover Materials</div>
                <div style={S.cardSub}>Fastest moving inventory items (Click to open product card)</div>
              </div>
              <button
                style={{ ...S.btnSecondary, padding: '4px 10px', fontSize: 11.5 }}
                onClick={() => handleNav('/materials')}
              >
                All Materials ↗
              </button>
            </div>

            <div style={{ position: 'relative', marginBottom: 10 }}>
              <Search size={13} color="#94a3b8" style={{ position: 'absolute', left: 9, top: 8 }} />
              <input
                style={{ ...S.searchInput, height: 30, fontSize: 11.5, paddingLeft: 28 }}
                placeholder="Filter fast moving items..."
                value={matSearch}
                onChange={e => setMatSearch(e.target.value)}
              />
              {matSearch && (
                <button style={{ ...S.clearSearchBtn, top: 6 }} onClick={() => setMatSearch('')}>
                  <X size={12} />
                </button>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 260, overflowY: 'auto' }}>
              {filteredTopMoving.length === 0 ? (
                <div style={S.empty}>No transaction turnover recorded matching filter.</div>
              ) : (
                filteredTopMoving.map((m, i) => (
                  <div
                    key={m.id}
                    style={S.topMatItem}
                    onClick={() => setSelectedProductModalId(m.id)}
                    title="Click to open Product Master Form & Ledger"
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={S.rankBadge}>#{i + 1}</div>
                      <div>
                        <div style={{ fontSize: 12.5, fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span>{m.name}</span>
                          <ExternalLink size={12} color="#64748b" />
                        </div>
                        <div style={{ fontSize: 11, color: '#64748b' }}>
                          Code: <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{m.code}</span> · {m.categoryName}
                        </div>
                      </div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 12.5, fontWeight: 800, color: '#0f766e' }}>
                        {fmtCur(m.valuation)}
                      </div>
                      <div style={{ fontSize: 11, color: '#64748b' }}>
                        Stock: {fmtN(m.currentStock, 2)} {m.uom}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── MANAGER CUSTOMIZATION STUDIO MODAL ── */}
      {studioOpen && (
        <div style={S.modalOverlay} onClick={() => setStudioOpen(false)}>
          <div style={S.studioModal} onClick={e => e.stopPropagation()}>
            <div style={S.studioHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ background: '#0f172a', color: '#fff', padding: 6, borderRadius: 6 }}>
                  <Sliders size={18} />
                </div>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a' }}>Store Manager Customization Studio</div>
                  <div style={{ fontSize: 12, color: '#64748b' }}>Personalize dashboard widgets, charts, and layout grid density</div>
                </div>
              </div>
              <button style={S.closeBtn} onClick={() => setStudioOpen(false)}>
                <X size={20} />
              </button>
            </div>

            <div style={S.studioBody}>
              {/* SECTION 1: LAYOUT DENSITY */}
              <div style={S.studioSec}>
                <div style={S.studioSecTitle}>Layout Grid Density</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                  {[
                    { id: 'dense', label: 'Dense View (4-Col)', desc: 'Maximum information density' },
                    { id: 'balanced', label: 'Standard (3-Col)', desc: 'Balanced executive layout' },
                    { id: 'focus', label: 'Executive Focus', desc: 'Larger charts and cards' }
                  ].map(l => (
                    <button
                      key={l.id}
                      style={{ ...S.densityBtn, ...(config.layoutDensity === l.id ? S.densityBtnActive : {}) }}
                      onClick={() => updateConfig({ layoutDensity: l.id })}
                    >
                      <div style={{ fontWeight: 700, fontSize: 13 }}>{l.label}</div>
                      <div style={{ fontSize: 11, opacity: 0.8, marginTop: 2 }}>{l.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* SECTION 2: TOGGLE KPI TILES */}
              <div style={S.studioSec}>
                <div style={S.studioSecTitle}>Toggle KPI Metric Cards</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {[
                    { key: 'totalValuation', label: '💰 Total Store Valuation' },
                    { key: 'totalQty', label: '📦 Bulk Inventory Weight' },
                    { key: 'lowStock', label: '⚠️ Reorder Risk Alerts' },
                    { key: 'outOfStock', label: '🚫 Out of Stock Items' },
                    { key: 'todayInward', label: '📥 Today Inward GRNs' },
                    { key: 'todayOutward', label: '📤 Today Department Issues' },
                    { key: 'pendingIndents', label: '📋 Pending Store Indents' },
                    { key: 'deadStock', label: '⏳ Slow/Dead Stock Capital' },
                  ].map(k => (
                    <label key={k.key} style={S.toggleRow}>
                      <input
                        type="checkbox"
                        checked={!!config.kpis[k.key]}
                        onChange={e => updateConfig(c => ({ ...c, kpis: { ...c.kpis, [k.key]: e.target.checked } }))}
                        style={{ accentColor: '#0f172a', width: 16, height: 16 }}
                      />
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>{k.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* SECTION 3: AUTO REFRESH RATE */}
              <div style={S.studioSec}>
                <div style={S.studioSecTitle}>Real-time Auto Refresh Interval</div>
                <div style={{ display: 'flex', gap: 10 }}>
                  {[
                    { val: 0, label: 'Manual Only' },
                    { val: 30, label: 'Every 30s' },
                    { val: 60, label: 'Every 60s' },
                    { val: 300, label: 'Every 5 Mins' }
                  ].map(r => (
                    <button
                      key={r.val}
                      style={{ ...S.dateToggleBtn, ...(config.autoRefreshInterval === r.val ? S.dateToggleBtnActive : {}) }}
                      onClick={() => updateConfig({ autoRefreshInterval: r.val })}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div style={S.studioFooter}>
              <button style={S.btnReset} onClick={resetConfig}>
                ↺ Reset to Defaults
              </button>
              <button style={S.btnSave} onClick={() => setStudioOpen(false)}>
                ✓ Apply & Save Dashboard
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── UNIFIED PRODUCT SPECIFICATION & STOCK LEDGER MODAL ── */}
      <ProductDetailModal
        materialId={selectedProductModalId}
        isOpen={!!selectedProductModalId}
        onClose={() => setSelectedProductModalId(null)}
        onUpdated={loadAnalytics}
      />
    </div>
  )
}

const S = {
  page: { padding: '24px', background: '#f8f8f6', minHeight: '100vh', fontFamily: 'system-ui, -apple-system, sans-serif' },
  headerBar: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, flexWrap: 'wrap', gap: 14 },
  title: { fontSize: 22, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em' },
  subtitle: { fontSize: 13, color: '#64748b', marginTop: 4 },

  liveBadge: { display: 'inline-flex', alignItems: 'center', gap: 6, background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0', padding: '3px 9px', borderRadius: 999, fontSize: 11.5, fontWeight: 700 },
  liveDot: { width: 7, height: 7, borderRadius: '50%', background: '#16a34a' },

  dateToggleWrap: { display: 'flex', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 3 },
  dateToggleBtn: { border: 'none', background: 'none', padding: '6px 12px', fontSize: 12, fontWeight: 600, color: '#64748b', borderRadius: 6, cursor: 'pointer', transition: 'all 0.15s' },
  dateToggleBtnActive: { background: '#0f172a', color: '#fff', fontWeight: 700 },

  btnSecondary: { display: 'flex', alignItems: 'center', gap: 6, background: '#fff', color: '#334155', border: '1px solid #cbd5e1', borderRadius: 8, padding: '7px 13px', cursor: 'pointer', fontSize: 12.5, fontWeight: 600 },
  btnStudio: { display: 'flex', alignItems: 'center', gap: 6, background: '#0f172a', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 15px', cursor: 'pointer', fontSize: 13, fontWeight: 700, boxShadow: '0 1px 2px rgba(0,0,0,0.05)' },

  searchFilterBar: { display: 'flex', gap: 12, alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', background: '#fff', padding: 12, borderRadius: 12, border: '1px solid #e2e8f0' },
  searchWrap: { position: 'relative', flex: 1, minWidth: 260 },
  searchInput: { width: '100%', height: 38, padding: '0 32px 0 34px', border: '1px solid #cbd5e1', borderRadius: 8, fontSize: 13, outline: 'none', background: '#f8fafc', color: '#0f172a' },
  clearSearchBtn: { position: 'absolute', right: 8, top: 9, background: '#e2e8f0', border: 'none', borderRadius: '50%', width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748b' },

  filterChipsWrap: { display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' },
  chipBtn: { display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 20, border: '1px solid #e2e8f0', background: '#f8fafc', color: '#475569', fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s' },
  chipBtnActive: { background: '#0f172a', color: '#fff', borderColor: '#0f172a', fontWeight: 700 },

  kpiGrid: { display: 'grid', gap: 12, marginBottom: 20 },
  kpiCard: { background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 4, boxShadow: '0 1px 3px rgba(0,0,0,0.03)', transition: 'transform 0.15s, box-shadow 0.15s' },
  kpiHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  kpiLabel: { fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' },
  kpiIcon: { width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  kpiVal: { fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', marginTop: 2 },
  kpiSub: { fontSize: 11, color: '#94a3b8' },

  chartsWorkspace: { display: 'flex', flexDirection: 'column', gap: 16 },
  twoColGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(460px, 1fr))', gap: 16 },
  card: { background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.03)' },
  cardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14, flexWrap: 'wrap', gap: 10 },
  cardTitle: { fontSize: 15, fontWeight: 800, color: '#0f172a' },
  cardSub: { fontSize: 11.5, color: '#64748b', marginTop: 2 },

  chartTypeSelector: { display: 'flex', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 2 },
  typeBtn: { border: 'none', background: 'none', padding: '4px 9px', fontSize: 11.5, fontWeight: 600, color: '#64748b', borderRadius: 6, cursor: 'pointer' },
  typeBtnActive: { background: '#fff', color: '#0f172a', fontWeight: 800, boxShadow: '0 1px 2px rgba(0,0,0,0.05)' },

  donutCenter: { position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' },
  legendItem: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', borderRadius: 8, border: '1px solid transparent', cursor: 'pointer', transition: 'all 0.15s' },

  barBg: { height: 7, borderRadius: 4, background: '#f1f5f9', overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 4, transition: 'width 0.4s ease' },

  table: { width: '100%', borderCollapse: 'collapse', fontSize: 12 },
  th: { padding: '8px 10px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' },
  td: { padding: '8px 10px', color: '#1e293b', borderBottom: '1px solid #f1f5f9' },

  topMatItem: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 12px', borderRadius: 10, background: '#f8fafc', border: '1px solid #f1f5f9', cursor: 'pointer', transition: 'all 0.15s' },
  rankBadge: { width: 24, height: 24, borderRadius: 6, background: '#e2e8f0', color: '#334155', fontSize: 11, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' },

  empty: { padding: 40, textAlign: 'center', color: '#94a3b8', fontStyle: 'italic', fontSize: 13 },

  modalOverlay: { position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999, padding: 16 },
  studioModal: { background: '#fff', borderRadius: 16, width: '100%', maxWidth: 640, maxHeight: '90vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', padding: 24, boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', border: '1px solid #e2e8f0' },
  studioHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid #f1f5f9', paddingBottom: 14, marginBottom: 16 },
  studioBody: { display: 'flex', flexDirection: 'column', gap: 16 },
  studioSec: { display: 'flex', flexDirection: 'column', gap: 8 },
  studioSecTitle: { fontSize: 13, fontWeight: 800, color: '#0f172a' },
  densityBtn: { padding: '10px 14px', borderRadius: 10, border: '1px solid #cbd5e1', background: '#f8fafc', textAlign: 'left', cursor: 'pointer' },
  densityBtnActive: { background: '#0f172a', color: '#fff', borderColor: '#0f172a' },
  toggleRow: { display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 8, background: '#f8fafc', border: '1px solid #e2e8f0', cursor: 'pointer' },
  studioFooter: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #f1f5f9', paddingTop: 16, marginTop: 16 },
  btnReset: { background: 'none', border: 'none', color: '#64748b', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  btnSave: { background: '#0f172a', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer' },
  closeBtn: { background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }
}
