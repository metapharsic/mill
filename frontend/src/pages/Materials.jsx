import React, { useState, useEffect, useCallback, useRef } from 'react'

const API = (path, opts) => fetch(path, {
  headers: { Authorization: `Bearer ${localStorage.getItem('mk_token')}`, ...(opts?.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }), ...(opts?.headers || {}) },
  ...opts,
}).then(async r => {
  try { return await r.json() }
  catch { return { success: false, message: `Server error (HTTP ${r.status})` } }
})

const UOM_LIST = ['NOS', 'KGS', 'MT', 'LTR', 'MTR', 'PKT', 'BOX', 'SET', 'PAIR', 'ROLL', 'DRUM', 'BAG', 'SHT']
const GST_RATES = [0, 5, 12, 18, 28]
const CRIT_COLORS = {
  A: { bg: '#ef444422', color: '#ef4444', border: '#ef444444', label: '🔴 Class A (Critical)' },
  B: { bg: '#f59e0b22', color: '#f59e0b', border: '#f59e0b44', label: '🟡 Class B (Important)' },
  C: { bg: '#22c55e22', color: '#22c55e', border: '#22c55e44', label: '🟢 Class C (General)' }
}

const emptyForm = {
  code: '',
  name: '',
  category_id: '',
  uom: 'NOS',
  hsn_code: '',
  bin_location: '',
  opening: '0',
  current_stock: '0',
  received: '0',
  issued: '0',
  reorder_level: '2',
  min_stock: '1',
  max_stock: '0',
  reorder_buffer: '0',
  unit_price: '0',
  gst_pct: 18,
  is_active: true,
  criticality_class: '',
  section_context: '',
  procurement_strategy: '',
  oem_supplier: '',
  last_audit_cycle: '',
  calibration_protocol: '',
  is_serialized: false,
  expected_lifespan_days: 365
}

export default function Materials() {
  const [materials, setMaterials] = useState([])
  const [categories, setCategories] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterCat, setFilterCat] = useState('')
  const [filterActive, setFilterActive] = useState('true')
  const [filterAlert, setFilterAlert] = useState(false)
  const [filterCrit, setFilterCrit] = useState('')
  const [expandedRow, setExpandedRow] = useState(null)
  const [page, setPage] = useState(1)
  const [modal, setModal] = useState(false)
  const [catModal, setCatModal] = useState(false)
  const [edit, setEdit] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [catForm, setCatForm] = useState({ name: '', code: '', type: 'Raw Material', parent_id: '' })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const [reorderAlertCount, setReorderAlertCount] = useState(null)

  // ── Universal Excel Upload & Preview State ──
  const [excelModal, setExcelModal] = useState(false)
  const [excelFile, setExcelFile] = useState(null)
  const [excelPreview, setExcelPreview] = useState(null)
  const [excelLoading, setExcelLoading] = useState(false)
  const [excelErr, setExcelErr] = useState('')
  const [excelSuccess, setExcelSuccess] = useState('')
  const fileInputRef = useRef(null)

  // ── Inline Quick-Entry Row State ──
  const [showQuickEntry, setShowQuickEntry] = useState(true)
  const [quickForm, setQuickForm] = useState({
    code: '',
    name: '',
    category_id: '',
    criticality_class: '',
    hsn_code: '',
    bin_location: '',
    opening: '0',
    received: '0',
    issued: '0',
    current_stock: '0',
    unit_price: '0',
    is_active: true,
    uom: 'NOS'
  })
  const [quickSaving, setQuickSaving] = useState(false)
  const [quickErr, setQuickErr] = useState('')

  // KPI totals must reflect the *entire* filtered set, not just the current
  // 30-row page — summing `materials` directly here undercounts badly on any
  // multi-page result (previously showed e.g. "3 below reorder" instead of 263
  // on the analogous inventory bug; same shape of bug applies to these sums).
  const [kpiTotals, setKpiTotals] = useState({ opening: 0, received: 0, issued: 0, valuation: 0, loaded: false })

  const LIMIT = 30

  useEffect(() => {
    API('/api/inventory/reorder-alerts').then(r => {
      if (r.success) setReorderAlertCount(r.count ?? (r.data ? r.data.length : null))
    })
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ page, limit: LIMIT })
    if (filterActive) params.set('is_active', filterActive)
    if (filterCat) params.set('category_id', filterCat)
    if (filterCrit) params.set('criticality_class', filterCrit)
    if (search) params.set('search', search)
    const [m, c] = await Promise.all([
      API(`/api/master/materials?${params}`),
      API('/api/master/categories'),
    ])
    if (m.success) { setMaterials(m.data); setTotal(m.total) }
    if (c.success) setCategories(c.data)
    setLoading(false)
  }, [page, filterActive, filterCat, filterCrit, search])

  useEffect(() => { load() }, [load])

  // Fetch the same filtered set unpaginated (bounded to a large-but-finite limit)
  // purely to compute accurate KPI totals across all matching materials.
  useEffect(() => {
    let cancelled = false
    const params = new URLSearchParams({ page: 1, limit: 100000 })
    if (filterActive) params.set('is_active', filterActive)
    if (filterCat) params.set('category_id', filterCat)
    if (filterCrit) params.set('criticality_class', filterCrit)
    if (search) params.set('search', search)
    API(`/api/master/materials?${params}`).then(r => {
      if (cancelled || !r.success) return
      const rows = r.data || []
      const opening = rows.reduce((acc, m) => {
        const rec = Number(m.received || 0), iss = Number(m.issued || 0), cur = Number(m.current_stock || 0)
        return acc + (cur - rec + iss)
      }, 0)
      const received = rows.reduce((acc, m) => acc + Number(m.received || 0), 0)
      const issued = rows.reduce((acc, m) => acc + Number(m.issued || 0), 0)
      const valuation = rows.reduce((acc, m) => acc + (Number(m.current_stock || 0) * Number(m.unit_price || 0)), 0)
      setKpiTotals({ opening, received, issued, valuation, loaded: true })
    })
    return () => { cancelled = true }
  }, [filterActive, filterCat, filterCrit, search])

  useEffect(() => {
    if (filterCat && !quickForm.category_id) {
      setQuickForm(q => ({ ...q, category_id: filterCat }))
    }
  }, [filterCat])

  // Two-way live stock movement calculator
  const handleStockChange = (field, val) => {
    setForm(f => {
      const next = { ...f, [field]: val }
      const op = parseFloat(next.opening !== '' && next.opening !== undefined ? next.opening : 0) || 0
      const rec = parseFloat(next.received !== '' && next.received !== undefined ? next.received : 0) || 0
      const iss = parseFloat(next.issued !== '' && next.issued !== undefined ? next.issued : 0) || 0
      if (field !== 'current_stock') {
        next.current_stock = parseFloat((op + rec - iss).toFixed(3))
      } else {
        const cur = parseFloat(val || 0) || 0
        next.opening = parseFloat((cur - rec + iss).toFixed(3))
      }
      return next
    })
  }

  const handleQuickStockChange = (field, val) => {
    setQuickForm(q => {
      const next = { ...q, [field]: val }
      const op = parseFloat(next.opening !== '' && next.opening !== undefined ? next.opening : 0) || 0
      const rec = parseFloat(next.received !== '' && next.received !== undefined ? next.received : 0) || 0
      const iss = parseFloat(next.issued !== '' && next.issued !== undefined ? next.issued : 0) || 0
      if (field !== 'current_stock') {
        next.current_stock = parseFloat((op + rec - iss).toFixed(3))
      } else {
        const cur = parseFloat(val || 0) || 0
        next.opening = parseFloat((cur - rec + iss).toFixed(3))
      }
      return next
    })
  }

  const openAdd = () => {
    setForm({
      ...emptyForm,
      category_id: filterCat || ''
    })
    setErr('')
    setEdit(null)
    setModal(true)
  }

  const openEdit = m => {
    const rec = Number(m.received || 0)
    const iss = Number(m.issued || 0)
    const cur = Number(m.current_stock || 0)
    const op = Number((cur - rec + iss).toFixed(3))
    setForm({
      code: m.code ?? '',
      name: m.name ?? '',
      category_id: String(m.categoryId ?? m.category_id ?? ''),
      uom: m.uom ?? 'NOS',
      hsn_code: m.hsn_code ?? '',
      bin_location: m.binLocation ?? m.bin_location ?? '',
      opening: op,
      current_stock: cur,
      received: rec,
      issued: iss,
      reorder_level: m.reorder_level ?? 2,
      min_stock: m.min_stock ?? 1,
      max_stock: m.max_stock ?? 0,
      reorder_buffer: m.reorder_buffer ?? 0,
      unit_price: m.unit_price ?? 0,
      gst_pct: m.gst_pct ?? 18,
      is_active: m.is_active !== undefined ? Boolean(m.is_active) : true,
      criticality_class: m.criticalityClass ?? m.criticality_class ?? '',
      section_context: m.sectionContext ?? m.section_context ?? '',
      procurement_strategy: m.procurementStrategy ?? m.procurement_strategy ?? '',
      oem_supplier: m.oemSupplier ?? m.oem_supplier ?? '',
      last_audit_cycle: m.lastAuditCycle ?? m.last_audit_cycle ?? '',
      calibration_protocol: m.calibrationProtocol ?? m.calibration_protocol ?? '',
      is_serialized: m.isSerialized ?? m.is_serialized ?? false,
      expected_lifespan_days: m.expectedLifespanDays ?? m.expected_lifespan_days ?? 365
    })
    setErr('')
    setEdit(m)
    setModal(true)

    API(`/api/master/materials/${m.id}/stock-summary`).then(r => {
      if (r.success) {
        const curBal = Number(r.data.balance || 0)
        const rRec = Number(r.data.received || 0)
        const rIss = Number(r.data.issued || 0)
        const rOp = r.data.opening !== undefined ? Number(r.data.opening) : Number((curBal - rRec + rIss).toFixed(3))
        setForm(f => ({ ...f, current_stock: curBal, received: rRec, issued: rIss, opening: rOp }))
      }
    })
  }

  const del = async m => {
    if (!window.confirm(`Deactivate "${m.name}"?`)) return
    const res = await API(`/api/master/materials/${m.id}`, { method: 'DELETE' })
    if (res.success) load()
    else alert(res.message || 'Deactivate failed')
  }

  const restore = async m => {
    if (!window.confirm(`Reactivate / Restore "${m.name}" (${m.code})?`)) return
    const res = await API(`/api/master/materials/${m.id}/restore`, {
      method: 'PUT'
    })
    if (res.success) {
      load()
    } else {
      // Fallback: If role or endpoint requires full update payload
      const fullRes = await API(`/api/master/materials/${m.id}`, {
        method: 'PUT',
        body: JSON.stringify({ ...m, is_active: true })
      })
      if (fullRes.success) {
        load()
      } else {
        alert(res.message || fullRes.message || 'Restore failed')
      }
    }
  }

  // Save Add/Edit Modal with Optimistic State Reflection
  const save = async e => {
    e.preventDefault()
    if (!form.code || !form.name || !form.category_id || !form.uom) {
      return setErr('Material Code, Name, Category, and Unit of Measure are required')
    }
    setSaving(true)
    setErr('')
    const payload = {
      ...form,
      category_id: parseInt(form.category_id),
      opening: form.opening === '' ? 0 : Number(form.opening),
      current_stock: form.current_stock === '' ? 0 : Number(form.current_stock),
      balance: form.current_stock === '' ? 0 : Number(form.current_stock),
      received: form.received === '' ? 0 : Number(form.received),
      issued: form.issued === '' ? 0 : Number(form.issued),
      unit_price: form.unit_price === '' ? 0 : Number(form.unit_price),
      reorder_level: form.reorder_level === '' ? 0 : Number(form.reorder_level),
      min_stock: form.min_stock === '' ? 0 : Number(form.min_stock),
      max_stock: form.max_stock === '' ? 0 : Number(form.max_stock),
      reorder_buffer: form.reorder_buffer === '' ? 0 : Number(form.reorder_buffer),
      is_active: Boolean(form.is_active),
      expected_lifespan_days: form.expected_lifespan_days === '' ? 365 : parseInt(form.expected_lifespan_days || 365),
    }
    const res = edit
      ? await API(`/api/master/materials/${edit.id}`, { method: 'PUT', body: JSON.stringify(payload) })
      : await API('/api/master/materials', { method: 'POST', body: JSON.stringify(payload) })
    setSaving(false)
    if (res.success) {
      if (edit && res.data) {
        setMaterials(prev => prev.map(m => m.id === edit.id ? { ...m, ...res.data } : m))
      } else if (!edit && res.data) {
        setMaterials(prev => [res.data, ...prev])
      }
      setModal(false)
      load()
    } else {
      setErr(res.message || 'Save failed — check server connection or validation')
    }
  }

  // Quick Fast Entry Submit
  const handleQuickSubmit = async e => {
    e.preventDefault()
    if (!quickForm.code.trim() || !quickForm.name.trim() || !quickForm.category_id) {
      setQuickErr('Code, Name, and Category are required for entry')
      return
    }
    setQuickSaving(true)
    setQuickErr('')
    const payload = {
      ...quickForm,
      category_id: parseInt(quickForm.category_id),
      opening: quickForm.opening === '' ? 0 : Number(quickForm.opening),
      current_stock: quickForm.current_stock === '' ? 0 : Number(quickForm.current_stock),
      balance: quickForm.current_stock === '' ? 0 : Number(quickForm.current_stock),
      received: quickForm.received === '' ? 0 : Number(quickForm.received),
      issued: quickForm.issued === '' ? 0 : Number(quickForm.issued),
      unit_price: quickForm.unit_price === '' ? 0 : Number(quickForm.unit_price),
      reorder_level: 2,
      min_stock: 1,
      is_active: Boolean(quickForm.is_active)
    }
    const res = await API('/api/master/materials', { method: 'POST', body: JSON.stringify(payload) })
    setQuickSaving(false)
    if (res.success) {
      if (res.data) {
        setMaterials(prev => [res.data, ...prev])
      }
      setQuickForm({
        code: '',
        name: '',
        category_id: filterCat || quickForm.category_id || '',
        criticality_class: '',
        hsn_code: '',
        bin_location: '',
        opening: '0',
        received: '0',
        issued: '0',
        current_stock: '0',
        unit_price: '0',
        is_active: true,
        uom: 'NOS'
      })
      load()
    } else {
      setQuickErr(res.message || 'Failed to add material')
    }
  }

  // ── Universal Excel Upload Handlers ──
  const handleExcelFileChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setExcelFile(file)
    setExcelErr('')
    setExcelSuccess('')
    setExcelLoading(true)

    const formData = new FormData()
    formData.append('file', file)

    const res = await API('/api/master/materials/upload-excel?preview=true', {
      method: 'POST',
      body: formData
    })
    setExcelLoading(false)
    if (res.success) {
      setExcelPreview(res)
    } else {
      setExcelErr(res.message || 'Failed to parse Excel file')
      setExcelPreview(null)
    }
  }

  const handleConfirmExcelSync = async () => {
    if (!excelFile) return
    setExcelLoading(true)
    setExcelErr('')
    setExcelSuccess('')

    const formData = new FormData()
    formData.append('file', excelFile)

    const res = await API('/api/master/materials/upload-excel?preview=false', {
      method: 'POST',
      body: formData
    })
    setExcelLoading(false)
    if (res.success) {
      setExcelSuccess(`✅ ${res.message} (Created: ${res.createdCount}, Updated: ${res.updatedCount})`)
      setExcelPreview(null)
      setExcelFile(null)
      load()
    } else {
      setExcelErr(res.message || 'Failed to import Excel records')
    }
  }

  const handleDownloadTemplate = () => {
    window.open('/api/master/materials/excel-template', '_blank')
  }

  const saveCategory = async e => {
    e.preventDefault()
    if (!catForm.name) return
    const body = { ...catForm, parent_id: catForm.parent_id || null }
    const res = await API('/api/master/categories', { method: 'POST', body: JSON.stringify(body) })
    if (res.success) {
      setCatModal(false)
      setCatForm({ name: '', code: '', type: 'Spare Part', parent_id: '' })
      load()
    } else {
      alert(res.message || 'Category creation failed')
    }
  }

  const topCategories = categories.filter(c => !c.parent_id)
  const childCategories = categories.filter(c => c.parent_id)
  const childrenOf = pid => childCategories.filter(c => String(c.parent_id) === String(pid))

  const categoryLabel = id => {
    const c = categories.find(x => String(x.id) === String(id))
    if (!c) return ''
    if (c.parent_id) {
      const p = categories.find(x => String(x.id) === String(c.parent_id))
      return p ? `${p.name} › ${c.name}` : c.name
    }
    return c.name
  }

  const filtered = filterAlert ? materials.filter(m => Number(m.current_stock) <= Number(m.reorder_level)) : materials
  const totalPages = Math.ceil(total / LIMIT)
  const fmt = v => v != null ? `₹${Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—'

  return (
    <div style={S.page}>
      {/* ── Top Header Toolbar ── */}
      <div style={S.header}>
        <div>
          <div style={S.title}>📦 Materials &amp; Store Inventory Master</div>
          <div style={S.sub}>
            {total} catalog materials — {reorderAlertCount != null ? reorderAlertCount : materials.filter(m => Number(m.current_stock) <= Number(m.reorder_level)).length} below reorder level
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            style={{ ...S.btnSecondary, background: '#0f766e', color: '#fff', fontWeight: 700 }}
            onClick={() => setExcelModal(true)}
            title="Upload and sync custom store Excel file with live preview"
          >
            📤 Upload Store Excel
          </button>
          <button style={S.btnSecondary} onClick={handleDownloadTemplate} title="Download ready-to-fill standard store Excel template">
            📥 Download Template
          </button>
          <button style={S.btnSecondary} onClick={() => setCatModal(true)}>+ Category</button>
          <button
            style={{ ...S.btnSecondary, background: showQuickEntry ? '#e0f2fe' : '#ffffff', color: '#0369a1', borderColor: '#bae6fd' }}
            onClick={() => setShowQuickEntry(s => !s)}
          >
            ⚡ {showQuickEntry ? 'Hide Fast Entry' : 'Show Fast Entry'}
          </button>
          <button style={S.btnPrimary} onClick={openAdd}>+ Add Material</button>
        </div>
      </div>

      {/* ── Summary KPI Stats Cards ── */}
      {(() => {
        // Use the unpaginated kpiTotals (whole filtered set) once loaded; fall back
        // to summing the current page only for the brief instant before it arrives.
        const totalOpening = kpiTotals.loaded ? kpiTotals.opening : materials.reduce((acc, m) => {
          const rec = Number(m.received || 0), iss = Number(m.issued || 0), cur = Number(m.current_stock || 0)
          return acc + (cur - rec + iss)
        }, 0)
        const totalReceived = kpiTotals.loaded ? kpiTotals.received : materials.reduce((acc, m) => acc + Number(m.received || 0), 0)
        const totalIssued = kpiTotals.loaded ? kpiTotals.issued : materials.reduce((acc, m) => acc + Number(m.issued || 0), 0)
        const totalValuation = kpiTotals.loaded ? kpiTotals.valuation : materials.reduce((acc, m) => acc + (Number(m.current_stock || 0) * Number(m.unit_price || 0)), 0)

        return (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginBottom: 16 }}>
            <div style={{ background: '#fff', border: '1px solid #e7e6df', borderRadius: 10, padding: '12px 16px', borderLeft: '4px solid #3b82f6' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#8a8a90', textTransform: 'uppercase', letterSpacing: '0.04em' }}>📦 Total Opening Stock</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#1b1b1d', marginTop: 4 }}>
                {totalOpening.toLocaleString('en-IN', { minimumFractionDigits: 3 })} <span style={{ fontSize: 11, fontWeight: 500, color: '#8a8a90' }}>Units</span>
              </div>
            </div>
            <div style={{ background: '#fff', border: '1px solid #e7e6df', borderRadius: 10, padding: '12px 16px', borderLeft: '4px solid #16a34a' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#8a8a90', textTransform: 'uppercase', letterSpacing: '0.04em' }}>📥 Total Received (GRN)</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#16a34a', marginTop: 4 }}>
                +{totalReceived.toLocaleString('en-IN', { minimumFractionDigits: 3 })} <span style={{ fontSize: 11, fontWeight: 500, color: '#8a8a90' }}>Units</span>
              </div>
            </div>
            <div style={{ background: '#fff', border: '1px solid #e7e6df', borderRadius: 10, padding: '12px 16px', borderLeft: '4px solid #dc2626' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#8a8a90', textTransform: 'uppercase', letterSpacing: '0.04em' }}>📤 Total Issued (Plant)</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#dc2626', marginTop: 4 }}>
                -{totalIssued.toLocaleString('en-IN', { minimumFractionDigits: 3 })} <span style={{ fontSize: 11, fontWeight: 500, color: '#8a8a90' }}>Units</span>
              </div>
            </div>
            <div style={{ background: '#fff', border: '1px solid #e7e6df', borderRadius: 10, padding: '12px 16px', borderLeft: '4px solid #0f766e' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#8a8a90', textTransform: 'uppercase', letterSpacing: '0.04em' }}>💰 Stock Valuation</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#0f766e', marginTop: 4 }}>
                ₹{totalValuation.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
            </div>
          </div>
        )
      })()}

      {/* ── Filters & Category Bar ── */}
      <div style={S.filterBar}>
        <input
          style={{ ...S.input, flex: 1, maxWidth: 280 }}
          placeholder="🔍 Search code, name, OEM supplier..."
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1) }}
        />
        <select style={S.select} value={filterCat} onChange={e => { setFilterCat(e.target.value); setPage(1) }}>
          <option value="">All Categories</option>
          {topCategories.map(c => {
            const kids = childrenOf(c.id)
            return kids.length > 0 ? (
              <optgroup key={c.id} label={c.name}>
                <option value={c.id}>{c.name} (All)</option>
                {kids.map(k => <option key={k.id} value={k.id}>{k.name}</option>)}
              </optgroup>
            ) : <option key={c.id} value={c.id}>{c.name}</option>
          })}
        </select>
        <select style={S.select} value={filterActive} onChange={e => { setFilterActive(e.target.value); setPage(1) }}>
          <option value="true">Active Only</option>
          <option value="false">Inactive Only</option>
          <option value="">All Status</option>
        </select>
        <select style={S.select} value={filterCrit} onChange={e => { setFilterCrit(e.target.value); setPage(1) }}>
          <option value="">All Criticality</option>
          <option value="A">🔴 Class A (Critical)</option>
          <option value="B">🟡 Class B (Important)</option>
          <option value="C">🟢 Class C (General)</option>
        </select>
        <button
          style={{
            ...S.btnSecondary,
            background: filterAlert ? '#ef444422' : '#ffffff',
            color: filterAlert ? '#dc2626' : '#1b1b1d',
            border: filterAlert ? '1px solid #ef4444' : '1px solid #e7e6df'
          }}
          onClick={() => setFilterAlert(f => !f)}
        >
          🔴 Reorder Alerts
        </button>
        <button style={S.btnSecondary} onClick={load} title="Refresh Live Data">↻</button>
      </div>

      {/* Category Chips Bar */}
      {categories.length > 0 && (
        <div style={S.catChips}>
          <button
            style={{ ...S.chip, ...(filterCat === '' ? S.chipActive : {}) }}
            onClick={() => { setFilterCat(''); setPage(1) }}
          >
            All Items ({total})
          </button>
          {topCategories.map(c => {
            const kids = childrenOf(c.id)
            return (
              <button
                key={c.id}
                style={{ ...S.chip, ...(filterCat === String(c.id) ? S.chipActive : {}) }}
                onClick={() => { setFilterCat(String(c.id)); setPage(1) }}
              >
                {c.name}{kids.length > 0 ? ` (${kids.length})` : ''}
              </button>
            )
          })}
        </div>
      )}

      {/* ── Table Container ── */}
      <div style={S.tableWrap}>
        {/* ── Fast Inline Entry Panel ── */}
        {showQuickEntry && (
          <form onSubmit={handleQuickSubmit} style={S.quickEntryBar}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#0f766e', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>⚡</span>
                <span>Fast Material Entry Row (Direct Catalog Addition for Any Category)</span>
              </div>
              <div style={{ fontSize: 11, color: '#64748b' }}>
                Formula: <span style={{ fontWeight: 600, color: '#0284c7' }}>Opening</span> ＋ <span style={{ fontWeight: 600, color: '#16a34a' }}>Received</span> － <span style={{ fontWeight: 600, color: '#dc2626' }}>Issue</span> ＝ <span style={{ fontWeight: 700, color: '#0f766e' }}>Balance</span>
              </div>
            </div>

            <div style={S.quickGrid}>
              {/* Code */}
              <div>
                <span style={S.quickLabel}>Code *</span>
                <input
                  style={S.quickInput}
                  value={quickForm.code}
                  onChange={e => setQuickForm(q => ({ ...q, code: e.target.value.toUpperCase() }))}
                  placeholder="e.g. MV0002"
                  required
                />
              </div>

              {/* Name */}
              <div style={{ minWidth: 200 }}>
                <span style={S.quickLabel}>Material Name / Specs *</span>
                <input
                  style={S.quickInput}
                  value={quickForm.name}
                  onChange={e => setQuickForm(q => ({ ...q, name: e.target.value }))}
                  placeholder="e.g. 0.5'' Piston Valve / Globe Valve"
                  required
                />
              </div>

              {/* Category */}
              <div style={{ minWidth: 160 }}>
                <span style={S.quickLabel}>Category *</span>
                <select
                  style={S.quickSelect}
                  value={String(quickForm.category_id || '')}
                  onChange={e => setQuickForm(q => ({ ...q, category_id: e.target.value }))}
                  required
                >
                  <option value="">-- Select Category --</option>
                  {topCategories.map(c => {
                    const kids = childrenOf(c.id)
                    return kids.length > 0 ? (
                      <optgroup key={c.id} label={c.name}>
                        <option value={String(c.id)}>{c.name} (General)</option>
                        {kids.map(k => <option key={k.id} value={String(k.id)}>{k.name}</option>)}
                      </optgroup>
                    ) : <option key={c.id} value={String(c.id)}>{c.name}</option>
                  })}
                </select>
              </div>

              {/* Crit */}
              <div style={{ width: 75 }}>
                <span style={S.quickLabel}>Crit</span>
                <select
                  style={S.quickSelect}
                  value={quickForm.criticality_class}
                  onChange={e => setQuickForm(q => ({ ...q, criticality_class: e.target.value }))}
                >
                  <option value="">—</option>
                  <option value="A">🔴 A</option>
                  <option value="B">🟡 B</option>
                  <option value="C">🟢 C</option>
                </select>
              </div>

              {/* HSN Code */}
              <div style={{ width: 85 }}>
                <span style={S.quickLabel}>HSN Code</span>
                <input
                  style={S.quickInput}
                  value={quickForm.hsn_code}
                  onChange={e => setQuickForm(q => ({ ...q, hsn_code: e.target.value }))}
                  placeholder="4802"
                />
              </div>

              {/* Rack / Box No */}
              <div style={{ width: 110 }}>
                <span style={S.quickLabel}>Rack / Box No</span>
                <input
                  style={S.quickInput}
                  value={quickForm.bin_location}
                  onChange={e => setQuickForm(q => ({ ...q, bin_location: e.target.value }))}
                  placeholder="Rack 2, Box 4"
                />
              </div>

              {/* Opening */}
              <div style={{ width: 80 }}>
                <span style={S.quickLabel}>Opening</span>
                <input
                  style={{ ...S.quickInput, color: '#0284c7', fontWeight: 600 }}
                  type="number"
                  step="0.001"
                  value={quickForm.opening}
                  onChange={e => handleQuickStockChange('opening', e.target.value)}
                  placeholder="0.000"
                />
              </div>

              {/* Received */}
              <div style={{ width: 80 }}>
                <span style={S.quickLabel}>Received</span>
                <input
                  style={{ ...S.quickInput, color: '#16a34a', fontWeight: 600 }}
                  type="number"
                  step="0.001"
                  value={quickForm.received}
                  onChange={e => handleQuickStockChange('received', e.target.value)}
                  placeholder="0.000"
                />
              </div>

              {/* Issue */}
              <div style={{ width: 80 }}>
                <span style={S.quickLabel}>Issue</span>
                <input
                  style={{ ...S.quickInput, color: '#dc2626', fontWeight: 600 }}
                  type="number"
                  step="0.001"
                  value={quickForm.issued}
                  onChange={e => handleQuickStockChange('issued', e.target.value)}
                  placeholder="0.000"
                />
              </div>

              {/* Balance */}
              <div style={{ width: 85 }}>
                <span style={S.quickLabel}>Balance</span>
                <input
                  style={{ ...S.quickInput, color: '#0f766e', fontWeight: 700, background: '#f0fdf4' }}
                  type="number"
                  step="0.001"
                  value={quickForm.current_stock}
                  onChange={e => handleQuickStockChange('current_stock', e.target.value)}
                  placeholder="0.000"
                />
              </div>

              {/* Unit Price */}
              <div style={{ width: 85 }}>
                <span style={S.quickLabel}>Unit Price</span>
                <input
                  style={S.quickInput}
                  type="number"
                  step="0.01"
                  value={quickForm.unit_price}
                  onChange={e => setQuickForm(q => ({ ...q, unit_price: e.target.value }))}
                  placeholder="0.00"
                />
              </div>

              {/* Status */}
              <div style={{ width: 80 }}>
                <span style={S.quickLabel}>Status</span>
                <select
                  style={S.quickSelect}
                  value={String(quickForm.is_active)}
                  onChange={e => setQuickForm(q => ({ ...q, is_active: e.target.value === 'true' }))}
                >
                  <option value="true">Active</option>
                  <option value="false">Inactive</option>
                </select>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6 }}>
                <button
                  type="submit"
                  disabled={quickSaving}
                  style={S.quickAddBtn}
                >
                  {quickSaving ? 'Adding...' : '＋ Add Entry'}
                </button>
              </div>
            </div>

            {quickErr && <div style={{ fontSize: 12, color: '#ef4444', marginTop: 6 }}>⚠️ {quickErr}</div>}
          </form>
        )}

        {/* ── Table Rows ── */}
        {loading ? <div style={S.loading}>Loading materials catalog...</div> : (
          <table style={S.table}>
            <thead>
              <tr style={S.thead}>
                {['', 'Code', 'Material Name', 'Category', 'Crit', 'HSN Code', 'Rack / Box No', 'Opening Stock', 'Received (+)', 'Issued (-)', 'Closing Balance', 'Unit Price', 'Stock Value', 'Status', 'Actions'].map(h => (
                  <th key={h} style={S.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && <tr><td colSpan={15} style={S.empty}>No materials match your filters</td></tr>}
              {filtered.map(m => {
                const cc = m.criticalityClass || m.criticality_class
                const ccStyle = cc && CRIT_COLORS[cc] ? { ...S.badge, background: CRIT_COLORS[cc].bg, color: CRIT_COLORS[cc].color, border: `1px solid ${CRIT_COLORS[cc].border}` } : S.badge
                const isExp = expandedRow === m.id
                const rec = Number(m.received || 0)
                const iss = Number(m.issued || 0)
                const cur = Number(m.current_stock || 0)
                const opBal = cur - rec + iss
                const reorder = Number(m.reorder_level || 0)

                return (
                  <React.Fragment key={m.id}>
                    <tr style={{ ...S.tr, background: cur === 0 ? '#ef444408' : 'transparent' }}>
                      <td style={S.td}>
                        <button style={S.expandBtn} onClick={() => setExpandedRow(isExp ? null : m.id)} title="Expand Full Specifications">
                          {isExp ? '▾' : '▸'}
                        </button>
                      </td>
                      <td style={S.td}>
                        <span
                          onClick={() => openEdit(m)}
                          style={{ ...S.code, cursor: 'pointer', color: '#0f766e', textDecoration: 'underline' }}
                          title="Click to Edit Material & Stock Details"
                        >
                          {m.code}
                        </span>
                      </td>
                      <td style={{ ...S.td, maxWidth: 240 }}>
                        <div
                          onClick={() => openEdit(m)}
                          style={{ ...S.name, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 230, cursor: 'pointer', color: '#0f172a', fontWeight: 600 }}
                          title={`Click to Edit ${m.name}`}
                        >
                          {m.name}
                        </div>
                      </td>
                      <td style={S.td}>
                        <span style={S.muted}>
                          {categoryLabel(m.categoryId || m.category_id) || m.categoryName || '—'}
                        </span>
                      </td>
                      <td style={S.td}>
                        {cc ? <span style={ccStyle}>{cc}</span> : <span style={S.muted}>—</span>}
                      </td>
                      <td style={S.td}><span style={S.mono}>{m.hsn_code || '—'}</span></td>
                      <td style={S.td}><span style={{ ...S.muted, fontSize: 12 }}>{m.binLocation || m.bin_location || '—'}</span></td>

                      {/* Opening Stock */}
                      <td style={S.td}>
                        <span style={{ background: '#f1f5f9', color: '#334155', padding: '3px 8px', borderRadius: 4, fontWeight: 600, fontVariantNumeric: 'tabular-nums', fontSize: 12 }}>
                          {opBal.toFixed(3)}
                        </span>
                      </td>

                      {/* Received (+) */}
                      <td style={S.td}>
                        <span style={{ background: '#ecfdf5', color: '#059669', padding: '3px 8px', borderRadius: 4, fontWeight: 700, fontVariantNumeric: 'tabular-nums', fontSize: 12 }}>
                          +{rec.toFixed(3)}
                        </span>
                      </td>

                      {/* Issued (-) */}
                      <td style={S.td}>
                        <span style={{ background: '#fff1f2', color: '#e11d48', padding: '3px 8px', borderRadius: 4, fontWeight: 700, fontVariantNumeric: 'tabular-nums', fontSize: 12 }}>
                          -{iss.toFixed(3)}
                        </span>
                      </td>

                      {/* Closing Balance */}
                      <td style={S.td}>
                        <span style={{
                          background: cur === 0 ? '#fee2e2' : cur <= reorder ? '#fef3c7' : '#f0fdf4',
                          color: cur === 0 ? '#dc2626' : cur <= reorder ? '#b45309' : '#15803d',
                          padding: '3px 8px', borderRadius: 4, fontWeight: 700, fontVariantNumeric: 'tabular-nums', fontSize: 12
                        }}>
                          {cur.toFixed(3)}
                        </span>
                      </td>

                      <td style={S.td}><span style={S.num}>{fmt(m.unit_price)}</span></td>
                      <td style={S.td}><span style={{ ...S.num, color: '#0f766e', fontWeight: 600 }}>{fmt(cur * Number(m.unit_price || 0))}</span></td>
                      <td style={S.td}>
                        <span style={{
                          ...S.badge,
                          background: m.is_active ? '#22c55e22' : '#ef444422',
                          color: m.is_active ? '#15803d' : '#dc2626',
                          border: `1px solid ${m.is_active ? '#22c55e44' : '#ef444444'}`
                        }}>
                          {m.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td style={S.td}>
                        <button style={S.btnIcon} onClick={() => openEdit(m)} title="Edit Material">✏️</button>
                        {m.is_active
                          ? <button style={{ ...S.btnIcon, color: '#ef4444' }} onClick={() => del(m)} title="Deactivate">🗑️</button>
                          : <button style={{ ...S.btnIcon, color: '#22c55e' }} onClick={() => restore(m)} title="Restore">♻️</button>
                        }
                      </td>
                    </tr>
                    {isExp && (
                      <tr style={{ background: '#f6f5f0' }}>
                        <td colSpan={15} style={{ padding: '12px 24px' }}>
                          <div style={S.expandGrid}>
                            <div><span style={S.expandLabel}>Full Specification</span><div style={S.expandVal}>{m.name}</div></div>
                            <div><span style={S.expandLabel}>Section / Context</span><div style={S.expandVal}>{m.sectionContext || m.section_context || '—'}</div></div>
                            <div><span style={S.expandLabel}>OEM Supplier</span><div style={S.expandVal}>{m.oemSupplier || m.oem_supplier || '—'}</div></div>
                            <div><span style={S.expandLabel}>Min / Max Stock</span><div style={S.expandVal}>{m.min_stock || 0} / {m.max_stock || 0} {m.uom}</div></div>
                            <div><span style={S.expandLabel}>Reorder Lvl / Buffer</span><div style={S.expandVal}>{m.reorder_level || 0} / {m.reorder_buffer || 0} {m.uom}</div></div>
                            <div><span style={S.expandLabel}>Procurement Strategy</span><div style={S.expandVal}>{m.procurementStrategy || m.procurement_strategy || '—'}</div></div>
                            <div><span style={S.expandLabel}>Last Audit Cycle</span><div style={S.expandVal}>{m.lastAuditCycle || m.last_audit_cycle || '—'}</div></div>
                            <div><span style={S.expandLabel}>Calibration Protocol</span><div style={S.expandVal}>{m.calibrationProtocol || m.calibration_protocol || '—'}</div></div>
                            <div><span style={S.expandLabel}>Stock Value</span><div style={S.expandVal}>{fmt((m.current_stock || 0) * (m.unit_price || 0))}</div></div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Pagination ── */}
      <div style={S.pagination}>
        <span style={S.count}>Showing {filtered.length} of {total} materials</span>
        <div style={{ display: 'flex', gap: 6 }}>
          <button style={S.pgBtn} disabled={page === 1} onClick={() => setPage(p => p - 1)}>‹ Prev</button>
          <span style={S.pgInfo}>{page} / {totalPages || 1}</span>
          <button style={S.pgBtn} disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next ›</button>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* ── UNIVERSAL EXCEL UPLOAD & PREVIEW / SYNC MODAL ─────────────────── */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {excelModal && (
        <div style={S.overlay} onClick={() => setExcelModal(false)}>
          <div style={{ ...S.modal, maxWidth: 860 }} onClick={e => e.stopPropagation()}>
            <div style={S.modalHeader}>
              <div>
                <div style={S.modalTitle}>📤 Universal Store Excel Upload &amp; Sync Engine</div>
                <div style={S.sub}>Upload any store Excel sheet (.xlsx/.xls) to preview and synchronize materials, categories, stock, and prices</div>
              </div>
              <button style={S.close} onClick={() => setExcelModal(false)}>✕</button>
            </div>

            {/* Actions Bar */}
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
              <input
                type="file"
                ref={fileInputRef}
                accept=".xlsx,.xls,.csv"
                style={{ display: 'none' }}
                onChange={handleExcelFileChange}
              />
              <button
                style={{ ...S.btnPrimary, background: '#0f766e' }}
                onClick={() => fileInputRef.current?.click()}
                disabled={excelLoading}
              >
                {excelLoading ? 'Analyzing Workbook...' : '📁 Select Excel File to Upload'}
              </button>
              <button
                style={S.btnSecondary}
                onClick={handleDownloadTemplate}
              >
                📥 Download Standard Store Template (.xlsx)
              </button>
              {excelFile && (
                <span style={{ fontSize: 12, color: '#0f766e', fontWeight: 600 }}>
                  📄 {excelFile.name} ({(excelFile.size / 1024).toFixed(1)} KB)
                </span>
              )}
            </div>

            {excelErr && <div style={S.error}>⚠️ {excelErr}</div>}
            {excelSuccess && <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', color: '#047857', padding: '10px 14px', borderRadius: 6, fontSize: 13, marginBottom: 14 }}>{excelSuccess}</div>}

            {/* Live Data Preview */}
            {excelPreview && (
              <div style={{ marginTop: 10 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, marginBottom: 14 }}>
                  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: 10, borderRadius: 6 }}>
                    <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>Total Rows Parsed</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: '#0f172a' }}>{excelPreview.totalRows}</div>
                  </div>
                  <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', padding: 10, borderRadius: 6 }}>
                    <div style={{ fontSize: 10, color: '#047857', textTransform: 'uppercase', fontWeight: 700 }}>New Items to Create</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: '#047857' }}>+{excelPreview.newItemsCount}</div>
                  </div>
                  <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', padding: 10, borderRadius: 6 }}>
                    <div style={{ fontSize: 10, color: '#1d4ed8', textTransform: 'uppercase', fontWeight: 700 }}>Existing to Update</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: '#1d4ed8' }}>{excelPreview.updateItemsCount}</div>
                  </div>
                  <div style={{ background: '#f0fdfa', border: '1px solid #99f6e4', padding: 10, borderRadius: 6 }}>
                    <div style={{ fontSize: 10, color: '#0f766e', textTransform: 'uppercase', fontWeight: 700 }}>Total Stock Valuation</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: '#0f766e' }}>₹{Number(excelPreview.totalValuation || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</div>
                  </div>
                </div>

                <div style={{ fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 6 }}>
                  Live Data Preview (Showing top {excelPreview.rows.length} rows):
                </div>

                <div style={{ maxHeight: 280, overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: 6, marginBottom: 14 }}>
                  <table style={S.table}>
                    <thead>
                      <tr style={S.thead}>
                        {['Action', 'Code', 'Material Name', 'Category / Subcat', 'HSN / Rack', 'Balance', 'Price'].map(h => (
                          <th key={h} style={S.th}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {excelPreview.rows.map((r, idx) => (
                        <tr key={idx}>
                          <td style={S.td}>
                            <span style={{
                              ...S.badge,
                              background: r.action === 'Create' ? '#22c55e22' : '#3b82f622',
                              color: r.action === 'Create' ? '#15803d' : '#1d4ed8',
                              border: `1px solid ${r.action === 'Create' ? '#22c55e44' : '#3b82f644'}`
                            }}>
                              {r.action === 'Create' ? '＋ New' : '↻ Update'}
                            </span>
                          </td>
                          <td style={S.td}><span style={S.code}>{r.code}</span></td>
                          <td style={S.td}><strong>{r.name}</strong></td>
                          <td style={S.td}><span style={S.muted}>{r.category}</span></td>
                          <td style={S.td}><span style={S.mono}>{r.hsn || r.bin || '—'}</span></td>
                          <td style={S.td}><strong style={{ color: '#0f766e' }}>{r.balance} {r.uom}</strong></td>
                          <td style={S.td}>₹{Number(r.unit_price || 0).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 14 }}>
                  <button style={S.btnSecondary} onClick={() => setExcelModal(false)}>Cancel</button>
                  <button
                    style={{ ...S.btnPrimary, background: '#0f766e' }}
                    onClick={handleConfirmExcelSync}
                    disabled={excelLoading}
                  >
                    {excelLoading ? 'Synchronizing to Database...' : `✓ Confirm & Synchronize ${excelPreview.totalRows} Items`}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* ── MASTER MATERIAL MODAL (100% Identical Parity for Add and Edit) ── */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {modal && (
        <div style={S.overlay} onClick={() => setModal(false)}>
          <div style={S.modal} onClick={e => e.stopPropagation()}>
            <div style={S.modalHeader}>
              <div>
                <div style={S.modalTitle}>
                  {edit ? `✏️ Edit Material: ${edit.code} — ${edit.name}` : '✨ Add New Master Material'}
                </div>
                <div style={S.sub}>
                  {edit ? 'Update product specifications, category mapping, warehouse location & stock' : 'Create a new catalog item with live stock movement formulas'}
                </div>
              </div>
              <button style={S.close} onClick={() => setModal(false)}>✕</button>
            </div>

            <form onSubmit={save} style={S.form}>
              {/* Section 1: Basic Identifiers */}
              <div style={S.grid2}>
                <label style={S.label}>Material Code *
                  <input
                    style={S.input}
                    value={form.code}
                    onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
                    placeholder="e.g. MV0002, MSSS004"
                    required
                  />
                </label>
                <label style={S.label}>Material Name / Full Specification *
                  <input
                    style={S.input}
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="e.g. 0.5'' PISTON VALVES/ BELLOW SEAL GLOBE VALVE"
                    required
                  />
                </label>
              </div>

              <div style={S.grid3}>
                <label style={S.label}>Category &amp; Subcategory *
                  <select
                    style={S.select}
                    value={String(form.category_id || '')}
                    onChange={e => setForm(f => ({ ...f, category_id: e.target.value }))}
                    required
                  >
                    <option value="">-- Select Category --</option>
                    {topCategories.map(c => {
                      const kids = childrenOf(c.id)
                      return kids.length > 0 ? (
                        <optgroup key={c.id} label={c.name}>
                          <option value={String(c.id)}>{c.name} (General)</option>
                          {kids.map(k => <option key={k.id} value={String(k.id)}>{k.name}</option>)}
                        </optgroup>
                      ) : <option key={c.id} value={String(c.id)}>{c.name}</option>
                    })}
                  </select>
                </label>

                <label style={S.label}>Unit of Measure (UOM) *
                  <select
                    style={S.select}
                    value={form.uom || 'NOS'}
                    onChange={e => setForm(f => ({ ...f, uom: e.target.value }))}
                    required
                  >
                    {Array.from(new Set([...UOM_LIST, form.uom].filter(Boolean))).map(u => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                </label>

                <label style={S.label}>Criticality Class
                  <select
                    style={S.select}
                    value={form.criticality_class}
                    onChange={e => setForm(f => ({ ...f, criticality_class: e.target.value }))}
                  >
                    <option value="">— General / Not Classified —</option>
                    <option value="A">🔴 A — Critical (Plant Stop)</option>
                    <option value="B">🟡 B — Important (Sub-system)</option>
                    <option value="C">🟢 C — General Stock</option>
                  </select>
                </label>
              </div>

              <div style={S.grid3}>
                <label style={S.label}>HSN Code
                  <input
                    style={S.input}
                    value={form.hsn_code || ''}
                    onChange={e => setForm(f => ({ ...f, hsn_code: e.target.value }))}
                    placeholder="e.g. 4802, 4016 9330"
                  />
                </label>

                <label style={S.label}>Rack / Box No (Bin Location)
                  <input
                    style={S.input}
                    value={form.bin_location || ''}
                    onChange={e => setForm(f => ({ ...f, bin_location: e.target.value }))}
                    placeholder="e.g. Rack 2, Box 4"
                  />
                </label>

                <label style={S.label}>Catalog Status *
                  <select
                    style={S.select}
                    value={String(form.is_active)}
                    onChange={e => setForm(f => ({ ...f, is_active: e.target.value === 'true' }))}
                  >
                    <option value="true">Active (Listed in ERP)</option>
                    <option value="false">Inactive (Archived)</option>
                  </select>
                </label>
              </div>

              {/* Visual Formula Invariant Banner */}
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '12px 16px', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#334155' }}>
                  📦 Opening: <span style={{ color: '#0284c7' }}>{form.opening || '0.000'}</span>
                </div>
                <span style={{ fontWeight: 800, color: '#16a34a', fontSize: 14 }}>＋</span>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#16a34a' }}>
                  📥 Received: <span>{form.received || '0.000'}</span>
                </div>
                <span style={{ fontWeight: 800, color: '#dc2626', fontSize: 14 }}>－</span>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#dc2626' }}>
                  📤 Issue: <span>{form.issued || '0.000'}</span>
                </div>
                <span style={{ fontWeight: 800, color: '#0f766e', fontSize: 14 }}>＝</span>
                <div style={{ fontSize: 13, fontWeight: 800, color: '#0f766e' }}>
                  💰 Balance: <span>{form.current_stock || '0.000'} {form.uom}</span>
                </div>
              </div>

              {/* Stock Movement row in exact table order */}
              <div style={S.grid4}>
                <label style={S.label}>Opening Stock
                  <input
                    style={{ ...S.input, color: '#0284c7', fontWeight: 600 }}
                    type="number"
                    step="0.001"
                    value={form.opening ?? ''}
                    onChange={e => handleStockChange('opening', e.target.value)}
                    placeholder="0.000"
                  />
                </label>
                <label style={S.label}>Received (+)
                  <input
                    style={{ ...S.input, color: '#16a34a', fontWeight: 600 }}
                    type="number"
                    step="0.001"
                    value={form.received ?? ''}
                    onChange={e => handleStockChange('received', e.target.value)}
                    placeholder="0.000"
                  />
                </label>
                <label style={S.label}>Issue (-)
                  <input
                    style={{ ...S.input, color: '#dc2626', fontWeight: 600 }}
                    type="number"
                    step="0.001"
                    value={form.issued ?? ''}
                    onChange={e => handleStockChange('issued', e.target.value)}
                    placeholder="0.000"
                  />
                </label>
                <label style={S.label}>Closing Balance
                  <input
                    style={{ ...S.input, fontWeight: 700, color: '#0f766e', background: '#f0fdf4' }}
                    type="number"
                    step="0.001"
                    value={form.current_stock ?? ''}
                    onChange={e => handleStockChange('current_stock', e.target.value)}
                    placeholder="0.000"
                  />
                </label>
              </div>

              {/* Commercials & Pricing */}
              <div style={S.grid3}>
                <label style={S.label}>Unit Price (₹)
                  <input
                    style={S.input}
                    type="number"
                    step="0.01"
                    value={form.unit_price}
                    onChange={e => setForm(f => ({ ...f, unit_price: e.target.value }))}
                    placeholder="0.00"
                  />
                </label>
                <label style={S.label}>GST Slab %
                  <select
                    style={S.select}
                    value={Number(form.gst_pct ?? 18)}
                    onChange={e => setForm(f => ({ ...f, gst_pct: Number(e.target.value) }))}
                  >
                    <option value="0">0% (Nil / Exempt)</option>
                    <option value="5">5% (CGST 2.5% + SGST 2.5%)</option>
                    <option value="12">12% (CGST 6% + SGST 6%)</option>
                    <option value="18">18% (Standard 18%)</option>
                    <option value="28">28% (Higher Slab 28%)</option>
                  </select>
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <span style={S.label}>Calculated Stock Valuation</span>
                  <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 6, padding: '8px 10px', fontSize: 14, fontWeight: 700, color: '#0f766e' }}>
                    ₹{(Number(form.current_stock || 0) * Number(form.unit_price || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                </div>
              </div>

              {/* Thresholds */}
              <div style={S.grid4}>
                <label style={S.label}>Reorder Level
                  <input style={S.input} type="number" step="0.001" value={form.reorder_level} onChange={e => setForm(f => ({ ...f, reorder_level: e.target.value }))} placeholder="2.000" />
                </label>
                <label style={S.label}>Min Stock
                  <input style={S.input} type="number" step="0.001" value={form.min_stock} onChange={e => setForm(f => ({ ...f, min_stock: e.target.value }))} placeholder="1.000" />
                </label>
                <label style={S.label}>Max Stock
                  <input style={S.input} type="number" step="0.001" value={form.max_stock} onChange={e => setForm(f => ({ ...f, max_stock: e.target.value }))} placeholder="0.000" />
                </label>
                <label style={S.label}>Reorder Buffer
                  <input style={S.input} type="number" step="0.001" value={form.reorder_buffer} onChange={e => setForm(f => ({ ...f, reorder_buffer: e.target.value }))} placeholder="0" />
                </label>
              </div>

              {/* Plant & Engineering Context */}
              <div style={S.grid2}>
                <label style={S.label}>Section / Machine Context
                  <input style={S.input} value={form.section_context} onChange={e => setForm(f => ({ ...f, section_context: e.target.value }))} placeholder="e.g. Pulp Mill, Boiler House" />
                </label>
                <label style={S.label}>OEM / Authorized Supplier
                  <input style={S.input} value={form.oem_supplier} onChange={e => setForm(f => ({ ...f, oem_supplier: e.target.value }))} placeholder="e.g. SKF India, Siemens" />
                </label>
              </div>

              <div style={S.grid3}>
                <label style={S.label}>Procurement Strategy
                  <input style={S.input} value={form.procurement_strategy} onChange={e => setForm(f => ({ ...f, procurement_strategy: e.target.value }))} placeholder="e.g. Direct OEM" />
                </label>
                <label style={S.label}>Expected Lifespan (days)
                  <input style={S.input} type="number" value={form.expected_lifespan_days} onChange={e => setForm(f => ({ ...f, expected_lifespan_days: e.target.value }))} placeholder="365" />
                </label>
                <label style={{ ...S.label, flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 22 }}>
                  <input type="checkbox" checked={form.is_serialized} onChange={e => setForm(f => ({ ...f, is_serialized: e.target.checked }))} />
                  <span>Serialized / Asset-Tracked</span>
                </label>
              </div>

              {err && <div style={S.error}>{err}</div>}

              <div style={S.modalFooter}>
                <button type="button" style={S.btnSecondary} onClick={() => setModal(false)}>Cancel</button>
                <button type="submit" style={S.btnPrimary} disabled={saving}>
                  {saving ? 'Saving...' : (edit ? 'Save Changes' : '✨ Add Material')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Category Modal ── */}
      {catModal && (
        <div style={S.overlay} onClick={() => setCatModal(false)}>
          <div style={{ ...S.modal, maxWidth: 420 }} onClick={e => e.stopPropagation()}>
            <div style={S.modalHeader}>
              <div style={S.modalTitle}>+ Add Material Category / Subcategory</div>
              <button style={S.close} onClick={() => setCatModal(false)}>✕</button>
            </div>
            <form onSubmit={saveCategory} style={S.form}>
              <label style={S.label}>Category Name *
                <input style={S.input} value={catForm.name} onChange={e => setCatForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Quality Control, Mechanical..." required />
              </label>
              <label style={S.label}>Category Code
                <input style={S.input} value={catForm.code} onChange={e => setCatForm(f => ({ ...f, code: e.target.value.toUpperCase() }))} placeholder="e.g. QC, MECH-NEW..." />
              </label>
              <label style={S.label}>Category Type
                <select style={S.select} value={catForm.type} onChange={e => setCatForm(f => ({ ...f, type: e.target.value }))}>
                  {['Raw Material', 'Consumable', 'Spare Part', 'Asset', 'Electrical', 'Mechanical'].map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </label>
              <label style={S.label}>Parent Category (Leave empty for top-level)
                <select style={S.select} value={catForm.parent_id} onChange={e => setCatForm(f => ({ ...f, parent_id: e.target.value }))}>
                  <option value="">— None (Top-Level Category) —</option>
                  {topCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </label>
              <div style={S.modalFooter}>
                <button type="button" style={S.btnSecondary} onClick={() => setCatModal(false)}>Cancel</button>
                <button type="submit" style={S.btnPrimary}>Add Category</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

const S = {
  page: { padding: 24, background: '#f6f5f0', minHeight: '100vh', color: '#1b1b1d' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 10 },
  title: { fontSize: 22, fontWeight: 700, color: '#1b1b1d' },
  sub: { fontSize: 13, color: '#8a8a90', marginTop: 2 },
  filterBar: { display: 'flex', gap: 10, marginBottom: 10, flexWrap: 'wrap', alignItems: 'center' },
  catChips: { display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' },
  chip: { background: '#ffffff', border: '1px solid #e7e6df', color: '#64748b', borderRadius: 20, padding: '5px 14px', cursor: 'pointer', fontSize: 12, fontWeight: 500 },
  chipActive: { background: '#0f766e', border: '1px solid #0f766e', color: '#ffffff', fontWeight: 700 },
  tableWrap: { background: '#ffffff', borderRadius: 10, overflow: 'auto', border: '1px solid #e7e6df' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  thead: { background: '#f8fafc' },
  th: { padding: '10px 14px', textAlign: 'left', color: '#64748b', fontWeight: 600, fontSize: 12, textTransform: 'uppercase', borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap' },
  tr: { borderBottom: '1px solid #f1efe8' },
  td: { padding: '10px 14px', verticalAlign: 'middle' },
  name: { fontWeight: 600, color: '#1b1b1d' },
  muted: { color: '#64748b', fontSize: 12 },
  mono: { fontFamily: 'monospace', fontSize: 12, color: '#475569' },
  num: { color: '#1b1b1d', fontVariantNumeric: 'tabular-nums' },
  code: { fontFamily: 'monospace', background: '#f1f5f9', padding: '2px 6px', borderRadius: 4, fontSize: 11, fontWeight: 600 },
  badge: { fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20, display: 'inline-block' },
  btnIcon: { background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, padding: '2px 4px' },
  expandBtn: { background: 'none', border: 'none', cursor: 'pointer', color: '#8a8a90', fontSize: 12, padding: '0 4px' },
  expandGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px 20px' },
  expandLabel: { fontSize: 10, color: '#8a8a90', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 2, fontWeight: 700 },
  expandVal: { fontSize: 12, color: '#334155', lineHeight: 1.5 },
  empty: { padding: 40, textAlign: 'center', color: '#8a8a90' },
  loading: { padding: 40, textAlign: 'center', color: '#8a8a90' },
  pagination: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 },
  count: { fontSize: 12, color: '#8a8a90' },
  pgBtn: { background: '#ffffff', border: '1px solid #e7e6df', color: '#1b1b1d', borderRadius: 6, padding: '5px 12px', cursor: 'pointer', fontSize: 12 },
  pgInfo: { fontSize: 12, color: '#8a8a90', padding: '5px 8px' },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 5000, padding: '40px 20px', boxSizing: 'border-box', overflowY: 'auto' },
  modal: { background: '#ffffff', borderRadius: 12, padding: 24, width: '100%', maxWidth: 760, border: '1px solid #e7e6df', margin: '3vh auto', boxSizing: 'border-box' },
  modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  modalTitle: { fontSize: 16, fontWeight: 700, color: '#1b1b1d' },
  close: { background: 'none', border: 'none', color: '#a0a0a6', fontSize: 18, cursor: 'pointer' },
  form: { display: 'flex', flexDirection: 'column', gap: 14 },
  grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 },
  grid3: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 },
  grid4: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 14 },
  label: { display: 'flex', flexDirection: 'column', gap: 5, fontSize: 12, color: '#475569', fontWeight: 600 },
  input: { background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: 6, padding: '8px 10px', color: '#1b1b1d', fontSize: 13, outline: 'none' },
  select: { background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: 6, padding: '8px 10px', color: '#1b1b1d', fontSize: 13 },
  error: { background: '#ef444422', border: '1px solid #ef444444', color: '#dc2626', padding: '8px 12px', borderRadius: 6, fontSize: 13, marginBottom: 12 },
  modalFooter: { display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 },
  btnPrimary: { background: '#0f766e', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 18px', fontWeight: 600, fontSize: 13, cursor: 'pointer' },
  btnSecondary: { background: '#ffffff', color: '#1b1b1d', border: '1px solid #e7e6df', borderRadius: 8, padding: '8px 18px', fontWeight: 600, fontSize: 13, cursor: 'pointer' },

  // Quick Entry Panel Styles
  quickEntryBar: { background: '#f0fdfa', borderBottom: '2px solid #0f766e', padding: '12px 14px' },
  quickGrid: { display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' },
  quickLabel: { display: 'block', fontSize: 10, fontWeight: 700, color: '#0f766e', textTransform: 'uppercase', marginBottom: 3 },
  quickInput: { background: '#ffffff', border: '1px solid #94a3b8', borderRadius: 5, padding: '6px 8px', fontSize: 12, color: '#0f172a', width: '100%', boxSizing: 'border-box', outline: 'none' },
  quickSelect: { background: '#ffffff', border: '1px solid #94a3b8', borderRadius: 5, padding: '6px 6px', fontSize: 12, color: '#0f172a', width: '100%', boxSizing: 'border-box' },
  quickAddBtn: { background: '#0f766e', color: '#ffffff', border: 'none', borderRadius: 5, padding: '6px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer', height: 28, whiteSpace: 'nowrap' }
}
