import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import AgentStatusBanner from '../components/AgentStatusBanner'
import InventoryExportModal from '../components/InventoryExportModal'
import SortableTh from '../components/SortableTh'
import TableScrollWrapper from '../components/TableScrollWrapper'
import SearchableSelect from '../components/SearchableSelect'
import MultiSearchableSelect from '../components/MultiSearchableSelect'
import SectionMachineAllocator from '../components/SectionMachineAllocator'
import ProductDetailModal from '../components/ProductDetailModal'
import { UOM_CATEGORIES, ALL_UOM_CODES, PRIMARY_UOMS } from '../constants/uom'

const API = (path, opts) => fetch(path, {
  headers: { Authorization: `Bearer ${localStorage.getItem('mk_token')}`, ...(opts?.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }), ...(opts?.headers || {}) },
  ...opts,
}).then(async r => {
  try { return await r.json() }
  catch { return { success: false, message: `Server error (HTTP ${r.status})` } }
})

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
  section_id: '',
  machine_id: '',
  section_equipment_id: '',
  section_ids: [],
  section_equipment_ids: [],
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
  const { user } = useAuth()
  const { addToast } = useToast()

  const roleLevel = user?.role_level ?? 1
  const dept = (user?.department || '').toLowerCase()
  const deptCode = (user?.dept_code || '').toUpperCase()
  const isStoreManager = (
    (roleLevel >= 3 && (['STORE', 'INV', 'RMS', 'MATERIALS'].includes(deptCode) || dept.includes('store') || dept.includes('inventory') || dept.includes('raw material'))) ||
    roleLevel >= 4
  )

  const [materials, setMaterials] = useState([])
  const [categories, setCategories] = useState([])
  const [sections, setSections] = useState([])
  const [sectionEquipment, setSectionEquipment] = useState([])
  const [machines, setMachines] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [colSearch, setColSearch] = useState({
    code: '',
    name: '',
    section: '',
    machine: '',
    category: '',
    crit: '',
    hsn: '',
    bin: '',
    status: ''
  })
  const [showColSearch, setShowColSearch] = useState(true)
  const [filterCat, setFilterCat] = useState('')
  const [filterSection, setFilterSection] = useState('')
  const [filterMachine, setFilterMachine] = useState('')
  const [filterActive, setFilterActive] = useState('true')
  const [filterAlert, setFilterAlert] = useState(false)
  const [filterCrit, setFilterCrit] = useState('')
  const [expandedRow, setExpandedRow] = useState(null)
  const [page, setPage] = useState(1)
  const [sortBy, setSortBy] = useState('criticality')
  const [sortOrder, setSortOrder] = useState('asc')
  const [modal, setModal] = useState(false)
  const [catModal, setCatModal] = useState(false)
  const [exportModal, setExportModal] = useState(false)
  const [edit, setEdit] = useState(null)
  const [selectedProductModalId, setSelectedProductModalId] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [catForm, setCatForm] = useState({ name: '', code: '', type: 'Raw Material', parent_id: '' })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const [reorderAlertCount, setReorderAlertCount] = useState(null)

  // ── Universal Excel Upload & Preview State ──
  const [excelModal, setExcelModal] = useState(false)
  const [excelFile, setExcelFile] = useState(null)
  const [excelTargetCat, setExcelTargetCat] = useState('')
  const [excelPreview, setExcelPreview] = useState(null)
  const [excelLoading, setExcelLoading] = useState(false)
  const [excelErr, setExcelErr] = useState('')
  const [excelSuccess, setExcelSuccess] = useState('')
  const fileInputRef = useRef(null)

  // ── Dynamic Plant Section & Machine Equipment Provisioning Modals ──
  const [secModal, setSecModal] = useState(false)
  const [secForm, setSecForm] = useState({ name: '', code: '', department_id: '', description: '' })
  const [secSaving, setSecSaving] = useState(false)
  const [secErr, setSecErr] = useState('')

  const [equipModal, setEquipModal] = useState(false)
  const [equipFormState, setEquipFormState] = useState({
    equipment_name: '',
    tag_name: '',
    section_id: '',
    machine_id: '',
    bearing_size: '',
    lock_nut: '',
    washer: '',
    belt_no: '',
    shaft_size: '',
    impeller_size: '',
    sleeve: '',
    couplings: '',
    pulleys: '',
    remarks: ''
  })
  const [equipSaving, setEquipSaving] = useState(false)
  const [equipErr, setEquipErr] = useState('')

  // ── Inline Quick-Entry Row State ──
  const [showQuickEntry, setShowQuickEntry] = useState(true)
  const [quickForm, setQuickForm] = useState({
    code: '',
    name: '',
    category_id: '',
    section_id: '',
    machine_id: '',
    section_equipment_id: '',
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
    if (filterSection) params.set('section_id', filterSection)
    // filterMachine now holds a section_equipment_id (from MCN equipment list)
    if (filterMachine) params.set('section_equipment_id', filterMachine)
    if (filterCrit) params.set('criticality_class', filterCrit)
    if (search) params.set('search', search)
    if (colSearch.code) params.set('col_code', colSearch.code)
    if (colSearch.name) params.set('col_name', colSearch.name)
    if (colSearch.section) params.set('col_section', colSearch.section)
    if (colSearch.machine) params.set('col_machine', colSearch.machine)
    if (colSearch.category) params.set('col_category', colSearch.category)
    if (colSearch.hsn) params.set('col_hsn', colSearch.hsn)
    if (colSearch.bin) params.set('col_bin', colSearch.bin)
    if (colSearch.status) params.set('col_status', colSearch.status)
    if (sortBy) {
      params.set('sort_by', sortBy)
      params.set('sort_order', sortOrder)
    }
    const [m, c, s, eq, mc] = await Promise.all([
      API(`/api/master/materials?${params}`),
      API('/api/master/categories'),
      API('/api/master/sections').catch(() => ({ data: [] })),
      API('/api/master/section-equipment').catch(() => ({ data: [] })),
      API('/api/master/machines?is_active=true').catch(() => ({ data: [] })),
    ])
    if (m.success) { setMaterials(m.data); setTotal(m.total) }
    if (c.success) setCategories(c.data)
    if (s.success) setSections(s.data)
    if (eq.success) setSectionEquipment(eq.data)
    if (mc.success) setMachines(mc.data)
    setLoading(false)
  }, [page, filterActive, filterCat, filterSection, filterMachine, filterCrit, search, colSearch, sortBy, sortOrder])

  const handleSort = (key, order) => {
    setSortBy(key)
    setSortOrder(order)
    setPage(1)
  }

  useEffect(() => { load() }, [load])

  // Fetch the same filtered set unpaginated (bounded to a large-but-finite limit)
  // purely to compute accurate KPI totals across all matching materials.
  useEffect(() => {
    let cancelled = false
    const params = new URLSearchParams({ page: 1, limit: 100000 })
    if (filterActive) params.set('is_active', filterActive)
    if (filterCat) params.set('category_id', filterCat)
    if (filterSection) params.set('section_id', filterSection)
    if (filterMachine) params.set('machine_id', filterMachine)
    if (filterCrit) params.set('criticality_class', filterCrit)
    if (search) params.set('search', search)
    if (colSearch.code) params.set('col_code', colSearch.code)
    if (colSearch.name) params.set('col_name', colSearch.name)
    if (colSearch.section) params.set('col_section', colSearch.section)
    if (colSearch.machine) params.set('col_machine', colSearch.machine)
    if (colSearch.category) params.set('col_category', colSearch.category)
    if (colSearch.hsn) params.set('col_hsn', colSearch.hsn)
    if (colSearch.bin) params.set('col_bin', colSearch.bin)
    if (colSearch.status) params.set('col_status', colSearch.status)
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
  }, [filterActive, filterCat, filterSection, filterMachine, filterCrit, search, colSearch])

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
      category_id: filterCat || '',
      section_id: filterSection || '',
      section_ids: filterSection ? [String(filterSection)] : [],
      section_equipment_ids: [],
      machine_id: filterMachine || ''
    })
    setErr('')
    setEdit(null)
    setModal(true)
  }
  const openNew = openAdd

  const openEdit = m => {
    const rec = Number(m.received || 0)
    const iss = Number(m.issued || 0)
    const cur = Number(m.current_stock || 0)
    const op = Number((cur - rec + iss).toFixed(3))
    const secIds = (m.sections && m.sections.length > 0)
      ? m.sections.map(s => String(s.id))
      : (m.sectionId ? [String(m.sectionId)] : [])
    const equipIds = (m.equipment && m.equipment.length > 0)
      ? m.equipment.map(eq => String(eq.id))
      : (m.sectionEquipmentId ? [String(m.sectionEquipmentId)] : [])

    setForm({
      code: m.code ?? '',
      name: m.name ?? '',
      category_id: String(m.categoryId ?? m.category_id ?? ''),
      section_id: String(m.sectionId ?? m.section_id ?? ''),
      machine_id: String(m.machineId ?? m.machine_id ?? ''),
      section_equipment_id: String(m.sectionEquipmentId ?? m.section_equipment_id ?? ''),
      section_ids: secIds,
      section_equipment_ids: equipIds,
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
    if (!window.confirm(`Are you sure you want to delete / deactivate Material "${m.name}" (${m.code})?`)) return
    const res = await API(`/api/master/materials/${m.id}`, { method: 'DELETE' })
    if (res.success) {
      if (addToast) addToast(res.message || `Material ${m.name} deactivated successfully`, 'info')
      else alert(res.message || `Material ${m.name} deactivated successfully`)
      load()
    } else {
      if (addToast) addToast(res.message || 'Deactivation failed', 'error')
      else alert(res.message || 'Deactivation failed')
    }
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

    // Derive section context if empty
    let derivedContext = form.section_context
    if (!derivedContext) {
      const matchedSec = sections.find(s => String(s.id) === String(form.section_id))
      const matchedEq = sectionEquipment.find(eq => String(eq.id) === String(form.section_equipment_id))
      const matchedMcn = machines.find(mc => String(mc.id) === String(form.machine_id))
      if (matchedSec && matchedEq) derivedContext = `${matchedSec.name} › ${matchedEq.equipmentName}`
      else if (matchedSec && matchedMcn) derivedContext = `${matchedSec.name} › ${matchedMcn.name}`
      else if (matchedSec) derivedContext = matchedSec.name
      else if (matchedEq) derivedContext = matchedEq.equipmentName
    }

    const payload = {
      ...form,
      category_id: parseInt(form.category_id),
      section_id: form.section_id ? parseInt(form.section_id) : (form.section_ids?.[0] ? parseInt(form.section_ids[0]) : null),
      section_ids: form.section_ids || [],
      machine_id: form.machine_id ? parseInt(form.machine_id) : null,
      section_equipment_id: form.section_equipment_id ? parseInt(form.section_equipment_id) : (form.section_equipment_ids?.[0] ? parseInt(form.section_equipment_ids[0]) : null),
      section_equipment_ids: form.section_equipment_ids || [],
      section_context: derivedContext || null,
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

    let derivedContext = ''
    if (quickForm.section_id) {
      const matchedSec = sections.find(s => String(s.id) === String(quickForm.section_id))
      const matchedEq = sectionEquipment.find(eq => String(eq.id) === String(quickForm.section_equipment_id))
      if (matchedSec && matchedEq) derivedContext = `${matchedSec.name} › ${matchedEq.equipmentName}`
      else if (matchedSec) derivedContext = matchedSec.name
    }

    const payload = {
      ...quickForm,
      category_id: parseInt(quickForm.category_id),
      section_id: quickForm.section_id ? parseInt(quickForm.section_id) : null,
      machine_id: quickForm.machine_id ? parseInt(quickForm.machine_id) : null,
      section_equipment_id: quickForm.section_equipment_id ? parseInt(quickForm.section_equipment_id) : null,
      section_context: derivedContext || null,
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
        section_id: filterSection || '',
        machine_id: filterMachine || '',
        section_equipment_id: '',
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
    if (excelTargetCat) formData.append('target_category_id', excelTargetCat)

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
    if (excelTargetCat) formData.append('target_category_id', excelTargetCat)

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

  const saveSectionDirect = async e => {
    e.preventDefault()
    if (!secForm.name.trim()) { setSecErr('Section Name required'); return }
    setSecSaving(true)
    setSecErr('')
    const res = await API('/api/master/sections', { method: 'POST', body: JSON.stringify(secForm) })
    setSecSaving(false)
    if (res.success) {
      setSecModal(false)
      const newSec = res.data
      setSections(prev => [...prev, newSec])
      setForm(f => ({ ...f, section_id: String(newSec.id) }))
      setQuickForm(q => ({ ...q, section_id: String(newSec.id) }))
      setSecForm({ name: '', code: '', department_id: '', description: '' })
      load()
    } else {
      setSecErr(res.message || 'Failed to create section')
    }
  }

  const saveEquipDirect = async e => {
    e.preventDefault()
    if (!equipFormState.equipment_name.trim()) { setEquipErr('Equipment / Roll Name required'); return }
    setEquipSaving(true)
    setEquipErr('')
    const res = await API('/api/master/section-equipment', { method: 'POST', body: JSON.stringify(equipFormState) })
    setEquipSaving(false)
    if (res.success) {
      setEquipModal(false)
      const newEq = res.data
      setSectionEquipment(prev => [...prev, newEq])
      setForm(f => ({
        ...f,
        section_equipment_id: String(newEq.id),
        section_id: newEq.sectionId ? String(newEq.sectionId) : f.section_id
      }))
      setQuickForm(q => ({
        ...q,
        section_equipment_id: String(newEq.id),
        section_id: newEq.sectionId ? String(newEq.sectionId) : q.section_id
      }))
      setEquipFormState({
        equipment_name: '',
        tag_name: '',
        section_id: '',
        machine_id: '',
        bearing_size: '',
        lock_nut: '',
        washer: '',
        belt_no: '',
        shaft_size: '',
        impeller_size: '',
        sleeve: '',
        couplings: '',
        pulleys: '',
        remarks: ''
      })
      load()
    } else {
      setEquipErr(res.message || 'Failed to create equipment')
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
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Primary Material Actions */}
          <button
            style={{
              ...S.btnPrimary,
              background: 'linear-gradient(135deg, #0f766e, #0d9488)',
              color: '#ffffff',
              boxShadow: '0 2px 8px rgba(15, 118, 110, 0.35)',
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6
            }}
            onClick={openAdd}
            title="Open comprehensive material catalog entry modal"
          >
            <span style={{ fontSize: 16, lineHeight: 1 }}>+</span>
            <span>Add Material</span>
          </button>

          <button
            style={{
              ...S.btnSecondary,
              background: showQuickEntry ? 'linear-gradient(135deg, #e0f2fe, #bae6fd)' : '#ffffff',
              color: showQuickEntry ? '#0369a1' : '#0284c7',
              borderColor: showQuickEntry ? '#0284c7' : '#bae6fd',
              fontWeight: 700,
              boxShadow: showQuickEntry ? '0 0 0 2px rgba(2, 132, 199, 0.2)' : 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6
            }}
            onClick={() => setShowQuickEntry(s => !s)}
            title="Toggle high-speed spreadsheet fast entry row"
          >
            <span>⚡</span>
            <span>{showQuickEntry ? 'Hide Fast Entry' : 'Fast Material Entry'}</span>
          </button>

          {/* Master Entity Creation Group */}
          <div style={{ display: 'flex', gap: 6, paddingLeft: 4, borderLeft: '1px solid #cbd5e1' }}>
            <button
              style={{ ...S.btnSecondary, background: '#f8fafc', borderColor: '#cbd5e1', color: '#0f766e', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6 }}
              onClick={() => { setSecErr(''); setSecModal(true) }}
              title="Create and provision a new Plant Section on the fly"
            >
              <span>🏭</span>
              <span>+ Plant Section</span>
            </button>

            <button
              style={{ ...S.btnSecondary, background: '#f8fafc', borderColor: '#cbd5e1', color: '#0f766e', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6 }}
              onClick={() => {
                setEquipFormState(eq => ({ ...eq, section_id: filterSection || quickForm.section_id || form.section_id || '' }))
                setEquipErr('')
                setEquipModal(true)
              }}
              title="Create and provision a new Machinery / Roll / Component on the fly"
            >
              <span>⚙️</span>
              <span>+ Machine / Roll</span>
            </button>

            <button
              style={{ ...S.btnSecondary, background: '#f8fafc', borderColor: '#cbd5e1', color: '#475569', fontWeight: 600 }}
              onClick={() => setCatModal(true)}
              title="Create new root or subcategory"
            >
              📁 + Category
            </button>
          </div>

          {/* Data Tools Group */}
          <div style={{ display: 'flex', gap: 6, paddingLeft: 4, borderLeft: '1px solid #cbd5e1' }}>
            <button
              style={{ ...S.btnSecondary, background: '#f0fdfa', borderColor: '#0f766e', color: '#0f766e', fontWeight: 700 }}
              onClick={() => setExportModal(true)}
              title="Download Comprehensive Multi-Sheet Excel Master with Categories & Reorder Alerts"
            >
              📊 Export Excel
            </button>
            <button
              style={{ ...S.btnSecondary, background: '#0f766e', color: '#fff', fontWeight: 700 }}
              onClick={() => { setExcelTargetCat(filterCat || ''); setExcelErr(''); setExcelSuccess(''); setExcelPreview(null); setExcelFile(null); setExcelModal(true) }}
              title="Upload and sync custom store Excel file with live preview into selected category"
            >
              📤 Upload Excel
            </button>
            <button style={S.btnSecondary} onClick={handleDownloadTemplate} title="Download ready-to-fill standard store Excel template">
              📥 Template
            </button>
          </div>
        </div>
      </div>

      {/* ── Multi-Agent Orchestration & Status Banner ── */}
      <AgentStatusBanner currentModule="store" />

      {/* ── Summary KPI Stats Cards ── */}
      {(() => {
        const rawOpening = kpiTotals?.loaded ? kpiTotals.opening : (materials || []).reduce((acc, m) => {
          const rec = Number(m.received || 0), iss = Number(m.issued || 0), cur = Number(m.current_stock || 0)
          return acc + (cur - rec + iss)
        }, 0)
        const rawReceived = kpiTotals?.loaded ? kpiTotals.received : (materials || []).reduce((acc, m) => acc + Number(m.received || 0), 0)
        const rawIssued = kpiTotals?.loaded ? kpiTotals.issued : (materials || []).reduce((acc, m) => acc + Number(m.issued || 0), 0)
        const rawValuation = kpiTotals?.loaded ? kpiTotals.valuation : (materials || []).reduce((acc, m) => acc + (Number(m.current_stock || 0) * Number(m.unit_price || 0)), 0)

        const totalOpening = Number(rawOpening) || 0
        const totalReceived = Number(rawReceived) || 0
        const totalIssued = Number(rawIssued) || 0
        const totalValuation = Number(rawValuation) || 0

        return (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginBottom: 16 }}>
            <div style={{ background: '#fff', border: '1px solid #e7e6df', borderRadius: 10, padding: '12px 16px', borderLeft: '4px solid #3b82f6' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#8a8a90', textTransform: 'uppercase', letterSpacing: '0.04em' }}>📦 Opening Stock (Yesterday)</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#1b1b1d', marginTop: 4 }}>
                {totalOpening.toLocaleString('en-IN', { minimumFractionDigits: 3 })} <span style={{ fontSize: 11, fontWeight: 500, color: '#8a8a90' }}>Units</span>
              </div>
            </div>
            <div style={{ background: '#fff', border: '1px solid #e7e6df', borderRadius: 10, padding: '12px 16px', borderLeft: '4px solid #16a34a' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#8a8a90', textTransform: 'uppercase', letterSpacing: '0.04em' }}>📥 Received (Today)</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#16a34a', marginTop: 4 }}>
                +{totalReceived.toLocaleString('en-IN', { minimumFractionDigits: 3 })} <span style={{ fontSize: 11, fontWeight: 500, color: '#8a8a90' }}>Units</span>
              </div>
            </div>
            <div style={{ background: '#fff', border: '1px solid #e7e6df', borderRadius: 10, padding: '12px 16px', borderLeft: '4px solid #dc2626' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#8a8a90', textTransform: 'uppercase', letterSpacing: '0.04em' }}>📤 Issued (Today)</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#dc2626', marginTop: 4 }}>
                -{totalIssued.toLocaleString('en-IN', { minimumFractionDigits: 3 })} <span style={{ fontSize: 11, fontWeight: 500, color: '#8a8a90' }}>Units</span>
              </div>
            </div>
            <div style={{ background: '#fff', border: '1px solid #e7e6df', borderRadius: 10, padding: '12px 16px', borderLeft: '4px solid #0f766e' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#8a8a90', textTransform: 'uppercase', letterSpacing: '0.04em' }}>💰 Closing Valuation</div>
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
          style={{ ...S.input, flex: 1, maxWidth: 260 }}
          placeholder="🔍 Search code, name, section, roll..."
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1) }}
        />
        <SearchableSelect
          value={filterCat}
          onChange={val => { setFilterCat(val); setPage(1) }}
          placeholder="All Categories"
          searchPlaceholder="Type category name..."
          style={{ width: 200 }}
          options={topCategories.flatMap(c => {
            const kids = childrenOf(c.id)
            return kids.length > 0
              ? [
                  { value: String(c.id), label: `${c.name} (All)` },
                  ...kids.map(k => ({ value: String(k.id), label: k.name, group: c.name }))
                ]
              : [{ value: String(c.id), label: c.name }]
          })}
        />
        <SearchableSelect
          value={filterSection}
          onChange={val => { setFilterSection(val); setPage(1) }}
          placeholder="🏭 All Plant Sections"
          searchPlaceholder="Type section name..."
          style={{ width: 210 }}
          options={sections.filter(s => s.sectionCode !== 'ALL').map(s => ({
            value: String(s.id),
            label: `${s.icon || '🏭'} ${s.name || s.sectionCode}`,
            code: s.sectionCode || ''
          }))}
        />
        <SearchableSelect
          value={filterMachine}
          onChange={val => { setFilterMachine(val); setPage(1) }}
          placeholder="⚙️ All Machines / Rolls"
          searchPlaceholder="Type machine or roll name..."
          style={{ width: 220 }}
          options={sectionEquipment.map(eq => ({
            value: String(eq.id),
            label: eq.equipmentName,
            group: eq.sectionName || eq.sectionCode || '',
            subtext: eq.sectionCode ? `[${eq.sectionCode}]` : '',
            code: eq.tagName || ''
          }))}
        />
        <select style={S.select} value={filterActive} onChange={e => { setFilterActive(e.target.value); setPage(1) }}>
          <option value="true">Active Only</option>
          <option value="false">Inactive Only</option>
          <option value="">All Status</option>
        </select>
        <SearchableSelect
          value={filterCrit}
          onChange={val => { setFilterCrit(val); setPage(1) }}
          placeholder="All Criticality"
          searchPlaceholder="Type A, B, or C..."
          style={{ width: 180 }}
          options={[
            { value: 'A', label: '🔴 Class A (Critical)' },
            { value: 'B', label: '🟡 Class B (Important)' },
            { value: 'C', label: '🟢 Class C (General)' }
          ]}
        />
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
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#0f766e', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 16 }}>⚡</span>
                <span>Fast Material Entry Row — Rapid Catalog Addition with Section &amp; Machinery Linking</span>
              </div>
              
              {/* Dynamic Live Formula & Live Stock Valuation Indicator */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#f8fafc', padding: '4px 10px', borderRadius: 6, border: '1px solid #e2e8f0', fontSize: 12 }}>
                <span style={{ color: '#64748b' }}>Daily Rollover:</span>
                <span style={{ fontWeight: 700, color: '#0284c7' }}>Op: {Number(quickForm.opening || 0).toFixed(3)}</span>
                <span style={{ color: '#94a3b8' }}>＋</span>
                <span style={{ fontWeight: 700, color: '#16a34a' }}>Rec: {Number(quickForm.received || 0).toFixed(3)}</span>
                <span style={{ color: '#94a3b8' }}>－</span>
                <span style={{ fontWeight: 700, color: '#dc2626' }}>Iss: {Number(quickForm.issued || 0).toFixed(3)}</span>
                <span style={{ color: '#94a3b8' }}>＝</span>
                <span style={{ fontWeight: 800, color: '#0f766e', background: '#dcfce7', padding: '2px 6px', borderRadius: 4 }}>
                  Closing: {Number(quickForm.current_stock || 0).toFixed(3)} {quickForm.uom || 'NOS'}
                </span>
                <span style={{ color: '#cbd5e1' }}>|</span>
                <span style={{ fontWeight: 700, color: '#0f766e' }}>
                  Valuation: ₹{(Number(quickForm.current_stock || 0) * Number(quickForm.unit_price || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
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

              {/* Plant Section */}
              <div style={{ minWidth: 160 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
                  <span style={S.quickLabel}>Plant Section</span>
                  <button
                    type="button"
                    onClick={() => { setSecErr(''); setSecModal(true) }}
                    style={{ background: '#0f766e', color: '#fff', border: 'none', borderRadius: 3, fontSize: 10, padding: '1px 5px', cursor: 'pointer', fontWeight: 700 }}
                    title="Add new Plant Section on the fly"
                  >
                    + Add
                  </button>
                </div>
                <select
                  style={S.quickSelect}
                  value={String(quickForm.section_id || '')}
                  onChange={e => setQuickForm(q => ({ ...q, section_id: e.target.value, section_equipment_id: '' }))}
                >
                  <option value="">— General / Any Section —</option>
                  {sections.filter(s => s.sectionCode !== 'ALL').map(s => (
                    <option key={s.id} value={String(s.id)}>{s.icon || '🏭'} {s.name || s.sectionCode}</option>
                  ))}
                </select>
              </div>

              {/* Machine / Equipment */}
              <div style={{ minWidth: 170 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
                  <span style={S.quickLabel}>Machine / Equipment</span>
                  <button
                    type="button"
                    onClick={() => {
                      setEquipFormState(eq => ({ ...eq, section_id: quickForm.section_id || '' }))
                      setEquipErr('')
                      setEquipModal(true)
                    }}
                    style={{ background: '#0f766e', color: '#fff', border: 'none', borderRadius: 3, fontSize: 10, padding: '1px 5px', cursor: 'pointer', fontWeight: 700 }}
                    title="Add new Equipment / Roll on the fly"
                  >
                    + Add
                  </button>
                </div>
                <select
                  style={S.quickSelect}
                  value={String(quickForm.section_equipment_id || '')}
                  onChange={e => {
                    const eqId = e.target.value
                    const eq = sectionEquipment.find(x => String(x.id) === String(eqId))
                    setQuickForm(q => ({
                      ...q,
                      section_equipment_id: eqId,
                      section_id: eq?.sectionId ? String(eq.sectionId) : q.section_id,
                      machine_id: eq?.machineId ? String(eq.machineId) : q.machine_id
                    }))
                  }}
                >
                  <option value="">— Select Equipment / Roll —</option>
                  {(quickForm.section_id
                    ? sectionEquipment.filter(eq => String(eq.sectionId) === String(quickForm.section_id))
                    : sectionEquipment
                  ).slice(0, 100).map(eq => (
                    <option key={eq.id} value={String(eq.id)}>{eq.equipmentName} {eq.bearingSize ? `[${eq.bearingSize}]` : ''}</option>
                  ))}
                </select>
              </div>

              {/* Category */}
              <div style={{ minWidth: 150 }}>
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

              {/* UOM */}
              <div style={{ width: 85 }}>
                <span style={S.quickLabel}>UOM *</span>
                <select
                  style={S.quickSelect}
                  value={quickForm.uom || 'NOS'}
                  onChange={e => setQuickForm(q => ({ ...q, uom: e.target.value }))}
                >
                  {PRIMARY_UOMS.map(u => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </select>
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
                  title="Submit and add to catalog (Enter)"
                >
                  {quickSaving ? 'Adding...' : '＋ Add Material'}
                </button>
                <button
                  type="button"
                  onClick={() => setQuickForm({
                    code: '',
                    name: '',
                    category_id: filterCat || '',
                    section_id: filterSection || '',
                    machine_id: filterMachine || '',
                    section_equipment_id: '',
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
                  })}
                  style={{ ...S.btnSecondary, padding: '5px 8px', fontSize: 11, height: 32 }}
                  title="Clear inputs"
                >
                  ✕
                </button>
              </div>
            </div>

            {quickErr && <div style={{ fontSize: 12, color: '#ef4444', marginTop: 6, fontWeight: 600 }}>⚠️ {quickErr}</div>}
          </form>
        )}

        {/* ── Table Rows ── */}
        {loading ? <div style={S.loading}>Loading materials catalog...</div> : (
          <TableScrollWrapper title="Materials Catalog" style={{ marginBottom: 0 }}>
            <table style={S.table}>
              <thead>
                <tr style={S.thead}>
                  <th style={{ ...S.th, width: 30 }}></th>
                  <SortableTh label="Code" columnKey="code" currentSortKey={sortBy} currentSortOrder={sortOrder} onSort={handleSort} width={100} />
                  <SortableTh label="Material Name" columnKey="name" currentSortKey={sortBy} currentSortOrder={sortOrder} onSort={handleSort} />
                  <SortableTh label="Section / Equipment" columnKey="section" currentSortKey={sortBy} currentSortOrder={sortOrder} onSort={handleSort} />
                  <SortableTh label="Category" columnKey="category" currentSortKey={sortBy} currentSortOrder={sortOrder} onSort={handleSort} />
                  <SortableTh label="Crit" columnKey="criticality" currentSortKey={sortBy} currentSortOrder={sortOrder} onSort={handleSort} width={65} align="center" />
                  <SortableTh label="HSN Code" columnKey="hsn_code" currentSortKey={sortBy} currentSortOrder={sortOrder} onSort={handleSort} width={90} />
                  <SortableTh label="Rack / Box No" columnKey="bin_location" currentSortKey={sortBy} currentSortOrder={sortOrder} onSort={handleSort} width={110} />
                  <SortableTh label="Opening Stock (Yesterday)" columnKey="opening" currentSortKey={sortBy} currentSortOrder={sortOrder} onSort={handleSort} align="right" />
                  <SortableTh label="Received (Today)" columnKey="received" currentSortKey={sortBy} currentSortOrder={sortOrder} onSort={handleSort} align="right" />
                  <SortableTh label="Issued (Today)" columnKey="issued" currentSortKey={sortBy} currentSortOrder={sortOrder} onSort={handleSort} align="right" />
                  <SortableTh label="Closing Balance" columnKey="current_stock" currentSortKey={sortBy} currentSortOrder={sortOrder} onSort={handleSort} align="right" />
                  <SortableTh label="Unit Price" columnKey="unit_price" currentSortKey={sortBy} currentSortOrder={sortOrder} onSort={handleSort} align="right" />
                  <SortableTh label="Stock Value" columnKey="valuation" currentSortKey={sortBy} currentSortOrder={sortOrder} onSort={handleSort} align="right" />
                  <SortableTh label="Status" columnKey="is_active" currentSortKey={sortBy} currentSortOrder={sortOrder} onSort={handleSort} width={75} align="center" />
                  <th style={{ ...S.th, width: 80, textAlign: 'center' }}>Actions</th>
                </tr>
                {/* ── Per-Column Universal Search Filter Row ── */}
                <tr style={{ background: '#f1f5f9', borderBottom: '2px solid #cbd5e1' }}>
                  <th style={{ padding: '4px 6px', textAlign: 'center' }}>
                    <span style={{ fontSize: 10, color: '#64748b' }}>🔍</span>
                  </th>
                  <th style={{ padding: '4px 6px' }}>
                    <input
                      style={S.colSearchInp}
                      placeholder="Filter code..."
                      value={colSearch.code}
                      onChange={e => { setColSearch(s => ({ ...s, code: e.target.value })); setPage(1) }}
                    />
                  </th>
                  <th style={{ padding: '4px 6px' }}>
                    <input
                      style={S.colSearchInp}
                      placeholder="Filter name / specs..."
                      value={colSearch.name}
                      onChange={e => { setColSearch(s => ({ ...s, name: e.target.value })); setPage(1) }}
                    />
                  </th>
                  <th style={{ padding: '4px 6px' }}>
                    <input
                      style={S.colSearchInp}
                      placeholder="Filter section / roll..."
                      value={colSearch.section}
                      onChange={e => { setColSearch(s => ({ ...s, section: e.target.value })); setPage(1) }}
                    />
                  </th>
                  <th style={{ padding: '4px 6px' }}>
                    <input
                      style={S.colSearchInp}
                      placeholder="Filter category..."
                      value={colSearch.category}
                      onChange={e => { setColSearch(s => ({ ...s, category: e.target.value })); setPage(1) }}
                    />
                  </th>
                  <th style={{ padding: '4px 6px' }}>
                    <input
                      style={S.colSearchInp}
                      placeholder="A/B/C..."
                      value={colSearch.crit}
                      onChange={e => { setColSearch(s => ({ ...s, crit: e.target.value })); setPage(1) }}
                    />
                  </th>
                  <th style={{ padding: '4px 6px' }}>
                    <input
                      style={S.colSearchInp}
                      placeholder="HSN..."
                      value={colSearch.hsn}
                      onChange={e => { setColSearch(s => ({ ...s, hsn: e.target.value })); setPage(1) }}
                    />
                  </th>
                  <th style={{ padding: '4px 6px' }}>
                    <input
                      style={S.colSearchInp}
                      placeholder="Rack/Box..."
                      value={colSearch.bin}
                      onChange={e => { setColSearch(s => ({ ...s, bin: e.target.value })); setPage(1) }}
                    />
                  </th>
                  {/* Stock Metrics Columns (Empty Search Spacers) */}
                  <th style={{ padding: '4px 6px' }}></th>
                  <th style={{ padding: '4px 6px' }}></th>
                  <th style={{ padding: '4px 6px' }}></th>
                  <th style={{ padding: '4px 6px' }}></th>
                  <th style={{ padding: '4px 6px' }}></th>
                  <th style={{ padding: '4px 6px' }}></th>
                  <th style={{ padding: '4px 6px' }}>
                    <select
                      style={{ ...S.colSearchInp, padding: '2px 4px', fontSize: 10 }}
                      value={colSearch.status}
                      onChange={e => { setColSearch(s => ({ ...s, status: e.target.value })); setPage(1) }}
                    >
                      <option value="">All</option>
                      <option value="true">Active</option>
                      <option value="false">Inactive</option>
                    </select>
                  </th>
                  <th style={{ padding: '4px 6px', textAlign: 'center' }}>
                    {(colSearch.code || colSearch.name || colSearch.section || colSearch.category || colSearch.crit || colSearch.hsn || colSearch.bin || colSearch.status) && (
                      <button
                        type="button"
                        onClick={() => {
                          setColSearch({ code: '', name: '', section: '', machine: '', category: '', crit: '', hsn: '', bin: '', status: '' })
                          setPage(1)
                        }}
                        style={{ background: '#ef4444', color: '#fff', border: 'none', borderRadius: 3, padding: '2px 6px', fontSize: 9.5, cursor: 'pointer', fontWeight: 700 }}
                        title="Clear all column search filters"
                      >
                        ✕ Clear
                      </button>
                    )}
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && <tr><td colSpan={16} style={S.empty}>No materials match your filters</td></tr>}
                {filtered.map(m => {
                  const cc = m.criticalityClass || m.criticality_class
                  const ccStyle = cc && CRIT_COLORS[cc] ? { ...S.badge, background: CRIT_COLORS[cc].bg, color: CRIT_COLORS[cc].color, border: `1px solid ${CRIT_COLORS[cc].border}` } : S.badge
                  const isExp = expandedRow === m.id
                  const rec = Number(m.received || 0)
                  const iss = Number(m.issued || 0)
                  const cur = Number(m.current_stock || 0)
                  const opBal = cur - rec + iss
                  const reorder = Number(m.reorder_level || 0)
                  const secName = m.sectionName || m.section_name
                  const eqName = m.equipmentName || m.equipment_name || m.machineName || m.machine_name
                  const mSections = Array.isArray(m.sections) && m.sections.length > 0 ? m.sections : []
                  const mEquipment = Array.isArray(m.equipment) && m.equipment.length > 0 ? m.equipment : []

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
                        <td style={{ ...S.td, maxWidth: 220 }}>
                          <div
                            onClick={() => openEdit(m)}
                            style={{ ...S.name, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 210, cursor: 'pointer', color: '#0f172a', fontWeight: 600 }}
                            title={`Click to Edit ${m.name}`}
                          >
                            {m.name}
                          </div>
                        </td>
                        <td style={S.td}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            {mSections.length > 0 ? (
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                                {mSections.map(sec => (
                                  <span
                                    key={sec.id}
                                    style={{
                                      fontSize: 10.5,
                                      fontWeight: 700,
                                      color: '#0f766e',
                                      background: '#f0fdf4',
                                      border: '1px solid #bbf7d0',
                                      padding: '1px 5px',
                                      borderRadius: 3,
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: 2
                                    }}
                                    title={sec.name}
                                  >
                                    🏭 {sec.sectionCode || sec.name}
                                  </span>
                                ))}
                              </div>
                            ) : secName ? (
                              <span style={{ fontSize: 11, fontWeight: 700, color: '#0f766e', background: '#f0fdf4', padding: '1px 6px', borderRadius: 4, width: 'fit-content' }}>
                                🏭 {secName}
                              </span>
                            ) : null}

                            {mEquipment.length > 0 ? (
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2, marginTop: 2 }}>
                                {mEquipment.map(eq => (
                                  <span
                                    key={eq.id}
                                    style={{
                                      fontSize: 10,
                                      color: '#334155',
                                      background: '#f8fafc',
                                      border: '1px solid #e2e8f0',
                                      padding: '1px 5px',
                                      borderRadius: 3
                                    }}
                                    title={eq.remarks ? `${eq.equipmentName} (${eq.remarks})` : eq.equipmentName}
                                  >
                                    ⚙️ {eq.equipmentName}
                                  </span>
                                ))}
                              </div>
                            ) : eqName ? (
                              <span style={{ fontSize: 11, color: '#475569', background: '#f8fafc', padding: '1px 6px', borderRadius: 4, width: 'fit-content' }}>
                                ⚙️ {eqName}
                              </span>
                            ) : null}

                            {mSections.length === 0 && mEquipment.length === 0 && !secName && !eqName && (
                              <span style={S.muted}>—</span>
                            )}
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

                        {/* Unit Price */}
                        <td style={S.td}>
                          <span style={{ ...S.mono, fontSize: 12, color: '#334155', fontWeight: 600 }}>
                            {fmt(m.unit_price)}
                          </span>
                        </td>

                        {/* Total Stock Value */}
                        <td style={S.td}>
                          <span style={{ ...S.mono, fontSize: 12, fontWeight: 700, color: '#0f172a' }}>
                            {fmt(cur * Number(m.unit_price || 0))}
                          </span>
                        </td>

                        {/* Status */}
                        <td style={S.td}>
                          <span style={{ ...S.badge, background: m.is_active ? '#22c55e22' : '#ef444422', color: m.is_active ? '#22c55e' : '#ef4444' }}>
                            {m.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>

                        {/* Actions */}
                        <td style={S.td}>
                          <div style={S.actions}>
                            <button style={S.btnIcon} title="View 360-Degree History & Download Excel" onClick={() => setSelectedProductModalId(m.id)}>📜</button>
                            <button style={S.btnIcon} title="Edit Master Record" onClick={() => openEdit(m)}>✏️</button>
                            <button style={S.btnIcon} title={m.is_active ? 'Deactivate Material' : 'Activate Material'} onClick={() => toggleActive(m)}>
                              {m.is_active ? '⏸' : '▶'}
                            </button>
                            {isStoreManager && (
                              <button style={{ ...S.btnIcon, color: '#dc2626' }} title="Store Manager: Delete / Deactivate Material" onClick={() => del(m)}>
                                🗑️
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>

                      {/* ── Expanded Specifications Panel ── */}
                      {isExp && (
                        <tr style={S.expandRow}>
                          <td colSpan={16} style={S.expandTd}>
                            <div style={S.expandGrid}>
                              <div><span style={S.expandLabel}>Procurement Strategy</span><div style={S.expandVal}>{m.procurementStrategy || m.procurement_strategy || '—'}</div></div>
                              <div><span style={S.expandLabel}>OEM Supplier</span><div style={S.expandVal}>{m.oemSupplier || m.oem_supplier || '—'}</div></div>
                              <div><span style={S.expandLabel}>Reorder Buffer</span><div style={S.expandVal}>{m.reorderBuffer || m.reorder_buffer || 0} {m.uom}</div></div>
                              <div><span style={S.expandLabel}>Min Stock Limit</span><div style={S.expandVal}>{m.minStock || m.min_stock || 0} {m.uom}</div></div>
                              <div><span style={S.expandLabel}>Max Stock Limit</span><div style={S.expandVal}>{m.maxStock || m.max_stock || 0} {m.uom}</div></div>
                              <div><span style={S.expandLabel}>Expected Lifespan</span><div style={S.expandVal}>{m.expectedLifespanDays || m.expected_lifespan_days || 365} days</div></div>
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
          </TableScrollWrapper>
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
        <div style={S.overlay}>
          <div style={{ ...S.modal, maxWidth: 860 }} onClick={e => e.stopPropagation()}>
            <div style={S.modalHeader}>
              <div>
                <div style={S.modalTitle}>📤 Universal Store Excel Upload &amp; Sync Engine</div>
                <div style={S.sub}>Upload any store Excel sheet (.xlsx/.xls) to preview and synchronize materials, categories, stock, and prices</div>
              </div>
              <button style={S.close} onClick={() => setExcelModal(false)}>✕</button>
            </div>

            {/* Target Category Selector */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, background: '#f8fafc', padding: '10px 14px', borderRadius: 8, border: '1px solid #e2e8f0', flexWrap: 'wrap' }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#334155', minWidth: 120 }}>
                Target Category:
              </label>
              <select
                style={{ ...S.select, flex: 1, minWidth: 240, background: '#ffffff', fontWeight: 600 }}
                value={excelTargetCat}
                onChange={e => {
                  setExcelTargetCat(e.target.value)
                  // If preview already loaded, prompt that changing category applies on sync
                }}
              >
                <option value="">✨ Auto-detect from Sheet / Names (Standard Hierarchy)</option>
                {topCategories.map(c => {
                  const kids = childrenOf(c.id)
                  return kids.length > 0 ? (
                    <optgroup key={c.id} label={c.name}>
                      <option value={c.id}>{c.name} (All / Top)</option>
                      {kids.map(k => <option key={k.id} value={k.id}>&nbsp;&nbsp;↳ {k.name}</option>)}
                    </optgroup>
                  ) : <option key={c.id} value={c.id}>{c.name}</option>
                })}
              </select>
              <span style={{ fontSize: 11, color: '#64748b' }}>
                {excelTargetCat ? '⚡ Upload will place items directly in this category' : 'Categorizes into standard mill hierarchy without creating rogue tabs'}
              </span>
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
        <div style={S.overlay}>
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
                  <SearchableSelect
                    value={String(form.category_id || '')}
                    onChange={val => setForm(f => ({ ...f, category_id: val }))}
                    placeholder="-- Select Category --"
                    searchPlaceholder="Type category name..."
                    required
                    options={topCategories.flatMap(c => {
                      const kids = childrenOf(c.id)
                      return kids.length > 0
                        ? [
                            { value: String(c.id), label: `${c.name} (General)` },
                            ...kids.map(k => ({ value: String(k.id), label: k.name, group: c.name }))
                          ]
                        : [{ value: String(c.id), label: c.name }]
                    })}
                  />
                </label>

                <label style={S.label}>Unit of Measure (UOM) *
                  <SearchableSelect
                    value={form.uom || 'NOS'}
                    onChange={val => setForm(f => ({ ...f, uom: val }))}
                    placeholder="-- Select UOM --"
                    searchPlaceholder="Type unit code or name..."
                    required
                    options={[
                      ...UOM_CATEGORIES.flatMap(cat => cat.units.map(u => ({
                        value: u.code,
                        label: u.label,
                        subtext: u.desc,
                        group: cat.category
                      }))),
                      ...(form.uom && !ALL_UOM_CODES.includes(form.uom.toUpperCase())
                        ? [{ value: form.uom, label: `${form.uom} (Custom)` }]
                        : [])
                    ]}
                  />
                </label>

                <label style={S.label}>Criticality Class
                  <SearchableSelect
                    value={form.criticality_class}
                    onChange={val => setForm(f => ({ ...f, criticality_class: val }))}
                    placeholder="— General / Not Classified —"
                    searchPlaceholder="Type A, B, or C..."
                    options={[
                      { value: 'A', label: '🔴 A — Critical (Plant Stop)' },
                      { value: 'B', label: '🟡 B — Important (Sub-system)' },
                      { value: 'C', label: '🟢 C — General Stock' }
                    ]}
                  />
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

              {/* Visual Formula Invariant Banner & Daily Rollover Principle */}
              <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', padding: '14px 18px', borderRadius: 8, display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#334155' }}>
                      📦 Opening: <span style={{ color: '#0284c7', fontWeight: 800 }}>{Number(form.opening || 0).toFixed(3)}</span>
                    </span>
                    <span style={{ fontWeight: 800, color: '#16a34a', fontSize: 14 }}>＋</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#16a34a' }}>
                      📥 Received: <span style={{ fontWeight: 800 }}>+{Number(form.received || 0).toFixed(3)}</span>
                    </span>
                    <span style={{ fontWeight: 800, color: '#dc2626', fontSize: 14 }}>－</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#dc2626' }}>
                      📤 Issue: <span style={{ fontWeight: 800 }}>-{Number(form.issued || 0).toFixed(3)}</span>
                    </span>
                    <span style={{ fontWeight: 800, color: '#0f766e', fontSize: 14 }}>＝</span>
                    <span style={{ fontSize: 13, fontWeight: 800, color: '#0f766e' }}>
                      💰 Closing Balance: <span style={{ textDecoration: 'underline' }}>{Number(form.current_stock || 0).toFixed(3)} {form.uom}</span>
                    </span>
                  </div>

                  <span style={{ fontSize: 11, background: '#e0f2fe', color: '#0369a1', padding: '2px 8px', borderRadius: 12, fontWeight: 600 }}>
                    🔄 Daily Rollover Invariant
                  </span>
                </div>

                <div style={{ fontSize: 11, color: '#64748b', background: '#f1f5f9', padding: '6px 10px', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>ℹ️</span>
                  <span><strong>Rollover Principle:</strong> The Closing Balance of today (Leftover of Receipts &amp; Issues) becomes the exact Opening Balance of tomorrow.</span>
                </div>
              </div>

              {/* Stock Movement row in exact table order */}
              <div style={S.grid4}>
                <label style={S.label}>Opening Stock
                  <input
                    style={{ ...S.input, color: '#0284c7', fontWeight: 700 }}
                    type="number"
                    step="0.001"
                    value={form.opening ?? ''}
                    onChange={e => handleStockChange('opening', e.target.value)}
                    placeholder="0.000"
                  />
                </label>
                <label style={S.label}>Received (+)
                  <input
                    style={{ ...S.input, color: '#16a34a', fontWeight: 700 }}
                    type="number"
                    step="0.001"
                    value={form.received ?? ''}
                    onChange={e => handleStockChange('received', e.target.value)}
                    placeholder="0.000"
                  />
                </label>
                <label style={S.label}>Issue (-)
                  <input
                    style={{ ...S.input, color: '#dc2626', fontWeight: 700 }}
                    type="number"
                    step="0.001"
                    value={form.issued ?? ''}
                    onChange={e => handleStockChange('issued', e.target.value)}
                    placeholder="0.000"
                  />
                </label>
                <label style={S.label}>Closing Balance
                  <input
                    style={{ ...S.input, fontWeight: 800, color: '#0f766e', background: '#f0fdf4', border: '1.5px solid #86efac' }}
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

              {/* Section 2: Universal Plant Section & Machinery Allocation Panel */}
              <SectionMachineAllocator
                sectionIds={form.section_ids || (form.section_id ? [form.section_id] : [])}
                onSectionIdsChange={(vals) => {
                  setForm(f => ({
                    ...f,
                    section_ids: vals,
                    section_id: vals[0] || '',
                    section_equipment_ids: (f.section_equipment_ids || []).filter(eqId => {
                      const eq = sectionEquipment.find(x => String(x.id) === String(eqId))
                      return !eq || !eq.sectionId || vals.includes(String(eq.sectionId))
                    })
                  }))
                }}
                equipmentIds={form.section_equipment_ids || (form.section_equipment_id ? [form.section_equipment_id] : [])}
                onEquipmentIdsChange={(vals) => {
                  setForm(f => ({
                    ...f,
                    section_equipment_ids: vals,
                    section_equipment_id: vals[0] || ''
                  }))
                }}
                machineId={form.machine_id}
                onMachineIdChange={(val) => setForm(f => ({ ...f, machine_id: val }))}
                sectionContext={form.section_context}
                onSectionContextChange={(val) => setForm(f => ({ ...f, section_context: val }))}
                sections={sections}
                sectionEquipment={sectionEquipment}
                machines={machines}
                onAddSection={() => { setSecErr(''); setSecModal(true) }}
                onAddEquipment={() => {
                  setEquipFormState(eq => ({ ...eq, section_id: form.section_id || '' }))
                  setEquipErr('')
                  setEquipModal(true)
                }}
                required={true}
                errors={{ section: (!form.section_ids?.length && !form.section_id && err && err.toLowerCase().includes('section')) ? 'Please select at least one plant section' : null }}
              />

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
                <label style={S.label}>Custom Section / Context Notes
                  <input style={S.input} value={form.section_context} onChange={e => setForm(f => ({ ...f, section_context: e.target.value }))} placeholder="e.g. Pulp Mill, Boiler House, Wire Section" />
                </label>
                <label style={S.label}>OEM / Authorized Supplier
                  <input style={S.input} value={form.oem_supplier} onChange={e => setForm(f => ({ ...f, oem_supplier: e.target.value }))} placeholder="e.g. SKF India, Siemens, Voith" />
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
        <div style={S.overlay}>
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

      {/* ── ADD PLANT SECTION MODAL ── */}
      {secModal && (
        <div style={S.overlay}>
          <div style={{ ...S.modal, maxWidth: 540 }} onClick={e => e.stopPropagation()}>
            <div style={S.modalHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 20 }}>🏭</span>
                <div>
                  <div style={S.modalTitle}>Provision New Plant Section</div>
                  <div style={S.sub}>Register a plant process section with real-time equipment &amp; material routing</div>
                </div>
              </div>
              <button style={S.close} onClick={() => setSecModal(false)}>✕</button>
            </div>
            <form onSubmit={saveSectionDirect} style={S.form}>
              <label style={S.label}>Section Name *
                <input
                  style={S.input}
                  value={secForm.name}
                  onChange={e => {
                    const name = e.target.value
                    const autoCode = name.toUpperCase().replace(/[^A-Z0-9]/g, '_').slice(0, 20)
                    setSecForm(f => ({ ...f, name, code: f.code || autoCode }))
                  }}
                  required
                  placeholder="e.g. Chemical Storage Section"
                />
              </label>

              <div style={S.grid2}>
                <label style={S.label}>Section Code *
                  <input
                    style={S.input}
                    value={secForm.code}
                    onChange={e => setSecForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
                    required
                    placeholder="e.g. CHEM_STORE"
                  />
                </label>

                <label style={S.label}>Owning Department
                  <select
                    style={S.select}
                    value={secForm.department_id || ''}
                    onChange={e => setSecForm(f => ({ ...f, department_id: e.target.value }))}
                  >
                    <option value="">— Select Department —</option>
                    <option value="1">Production</option>
                    <option value="2">Maintenance / Mechanical</option>
                    <option value="3">Electrical &amp; Instrumentation</option>
                    <option value="4">Boiler &amp; Powerhouse</option>
                    <option value="5">Stores &amp; Purchase</option>
                    <option value="6">Quality Control &amp; Lab</option>
                  </select>
                </label>
              </div>

              {/* Icon Picker */}
              <div>
                <span style={S.label}>Process Section Icon</span>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                  {['🏭', '🌀', '🕸️', '💨', '🔄', '☀️', '🔘', '💧', '🌿', '🔬', '📦', '⚡', '⚙️', '🛢️'].map(ic => (
                    <button
                      key={ic}
                      type="button"
                      onClick={() => setSecForm(f => ({ ...f, icon: ic }))}
                      style={{
                        background: (secForm.icon || '🏭') === ic ? '#0f766e' : '#f1f5f9',
                        color: (secForm.icon || '🏭') === ic ? '#ffffff' : '#1e293b',
                        border: '1px solid #cbd5e1',
                        borderRadius: 6,
                        padding: '4px 10px',
                        fontSize: 16,
                        cursor: 'pointer'
                      }}
                    >
                      {ic}
                    </button>
                  ))}
                </div>
              </div>

              <label style={S.label}>Section Description
                <input
                  style={S.input}
                  value={secForm.description || ''}
                  onChange={e => setSecForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="e.g. Storage &amp; dosing for alum, rosin, PAC, polymer and process sizing chemicals"
                />
              </label>

              {secErr && <div style={S.error}>⚠️ {secErr}</div>}

              <div style={S.modalFooter}>
                <button type="button" style={S.btnSecondary} onClick={() => setSecModal(false)}>Cancel</button>
                <button type="submit" style={S.btnPrimary} disabled={secSaving}>
                  {secSaving ? 'Saving...' : '✨ Create & Link Section'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── ADD MACHINE / EQUIPMENT / ROLL MODAL ── */}
      {equipModal && (
        <div style={S.overlay}>
          <div style={{ ...S.modal, maxWidth: 680 }} onClick={e => e.stopPropagation()}>
            <div style={S.modalHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 20 }}>⚙️</span>
                <div>
                  <div style={S.modalTitle}>Add Machinery / Equipment / Roll Component</div>
                  <div style={S.sub}>Provision machine component with complete mechanical digital twin specifications</div>
                </div>
              </div>
              <button style={S.close} onClick={() => setEquipModal(false)}>✕</button>
            </div>
            <form onSubmit={saveEquipDirect} style={S.form}>
              <div style={S.grid2}>
                <label style={S.label}>Equipment / Roll Name *
                  <input
                    style={S.input}
                    value={equipFormState.equipment_name}
                    onChange={e => setEquipFormState(f => ({ ...f, equipment_name: e.target.value }))}
                    required
                    placeholder="e.g. Top Wire Guide Roll #3"
                  />
                </label>

                <label style={S.label}>Tag Code
                  <input
                    style={S.input}
                    value={equipFormState.tag_name}
                    onChange={e => setEquipFormState(f => ({ ...f, tag_name: e.target.value.toUpperCase() }))}
                    placeholder="e.g. WIRE-MCN-028"
                  />
                </label>
              </div>

              <div style={S.grid2}>
                <label style={S.label}>Plant Section
                  <select
                    style={S.select}
                    value={String(equipFormState.section_id || '')}
                    onChange={e => setEquipFormState(f => ({ ...f, section_id: e.target.value }))}
                  >
                    <option value="">— Select Section —</option>
                    {sections.filter(s => s.sectionCode !== 'ALL').map(s => (
                      <option key={s.id} value={String(s.id)}>{s.icon || '🏭'} {s.name || s.sectionCode}</option>
                    ))}
                  </select>
                </label>

                <label style={S.label}>Machine Unit
                  <select
                    style={S.select}
                    value={String(equipFormState.machine_id || '')}
                    onChange={e => setEquipFormState(f => ({ ...f, machine_id: e.target.value }))}
                  >
                    <option value="">— Select Machine —</option>
                    {machines.map(m => <option key={m.id} value={String(m.id)}>{m.name || m.code}</option>)}
                  </select>
                </label>
              </div>

              {/* Mechanical Specs Digital Twin Box */}
              <div style={{ background: '#f8fafc', padding: 14, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#0f766e', textTransform: 'uppercase', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>🔧</span>
                  <span>Mechanical Specifications &amp; Spares Matching (Digital Twin Link)</span>
                </div>
                <div style={S.grid3}>
                  <label style={S.label}>Bearing Size
                    <input
                      style={S.input}
                      value={equipFormState.bearing_size || ''}
                      onChange={e => setEquipFormState(f => ({ ...f, bearing_size: e.target.value }))}
                      placeholder="e.g. 23234K / NU320"
                    />
                  </label>
                  <label style={S.label}>Lock Nut
                    <input
                      style={S.input}
                      value={equipFormState.lock_nut || ''}
                      onChange={e => setEquipFormState(f => ({ ...f, lock_nut: e.target.value }))}
                      placeholder="e.g. KM 34"
                    />
                  </label>
                  <label style={S.label}>Washer
                    <input
                      style={S.input}
                      value={equipFormState.washer || ''}
                      onChange={e => setEquipFormState(f => ({ ...f, washer: e.target.value }))}
                      placeholder="e.g. MB 34 / cc"
                    />
                  </label>
                </div>

                <div style={{ ...S.grid3, marginTop: 8 }}>
                  <label style={S.label}>Belt No
                    <input
                      style={S.input}
                      value={equipFormState.belt_no || ''}
                      onChange={e => setEquipFormState(f => ({ ...f, belt_no: e.target.value }))}
                      placeholder="e.g. C-144 / B-85"
                    />
                  </label>
                  <label style={S.label}>Shaft Size
                    <input
                      style={S.input}
                      value={equipFormState.shaft_size || ''}
                      onChange={e => setEquipFormState(f => ({ ...f, shaft_size: e.target.value }))}
                      placeholder="e.g. 110 mm"
                    />
                  </label>
                  <label style={S.label}>Impeller / Sleeve
                    <input
                      style={S.input}
                      value={equipFormState.impeller_size || ''}
                      onChange={e => setEquipFormState(f => ({ ...f, impeller_size: e.target.value }))}
                      placeholder="e.g. 315 mm / H 2334"
                    />
                  </label>
                </div>

                <div style={{ ...S.grid3, marginTop: 8 }}>
                  <label style={S.label}>Couplings
                    <input
                      style={S.input}
                      value={equipFormState.couplings || ''}
                      onChange={e => setEquipFormState(f => ({ ...f, couplings: e.target.value }))}
                      placeholder="e.g. Lovejoy L-110"
                    />
                  </label>
                  <label style={S.label}>Pulleys
                    <input
                      style={S.input}
                      value={equipFormState.pulleys || ''}
                      onChange={e => setEquipFormState(f => ({ ...f, pulleys: e.target.value }))}
                      placeholder="e.g. 3 Groove 8'' PCD"
                    />
                  </label>
                  <label style={S.label}>Technical Remarks
                    <input
                      style={S.input}
                      value={equipFormState.remarks || ''}
                      onChange={e => setEquipFormState(f => ({ ...f, remarks: e.target.value }))}
                      placeholder="e.g. Drive side assembly"
                    />
                  </label>
                </div>
              </div>

              {equipErr && <div style={S.error}>⚠️ {equipErr}</div>}

              <div style={S.modalFooter}>
                <button type="button" style={S.btnSecondary} onClick={() => setEquipModal(false)}>Cancel</button>
                <button type="submit" style={S.btnPrimary} disabled={equipSaving}>
                  {equipSaving ? 'Saving...' : '✨ Add Machinery Component'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── ENTERPRISE INVENTORY EXCEL EXPORTER MODAL ── */}
      <InventoryExportModal
        isOpen={exportModal}
        onClose={() => setExportModal(false)}
        initialCategoryId={filterCat}
        categories={categories}
        sections={sections}
      />

      {/* ── UNIFIED 360-DEGREE PRODUCT LEDGER & EXCEL EXPORT MODAL ── */}
      <ProductDetailModal
        materialId={selectedProductModalId}
        isOpen={!!selectedProductModalId}
        onClose={() => setSelectedProductModalId(null)}
        onUpdated={fetchMaterials}
      />
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
  quickAddBtn: { background: '#0f766e', color: '#ffffff', border: 'none', borderRadius: 5, padding: '6px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer', height: 28, whiteSpace: 'nowrap' },

  // Universal Column Search Style
  colSearchInp: { background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: 4, padding: '4px 6px', fontSize: 11, color: '#0f172a', width: '100%', boxSizing: 'border-box', outline: 'none' }
}
