import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import AgentStatusBanner from '../components/AgentStatusBanner'
import SearchableSelect from '../components/SearchableSelect'
import { LOGO_DATA_URI } from '../utils/logo'
import { ExternalLink } from 'lucide-react'
import A3InvoicePrintModal from '../components/A3InvoicePrintModal'
import SequenceEnforcementModal from '../components/SequenceEnforcementModal'

const API = async (path, opts = {}) => {
  try {
    const res = await fetch(`/api${path}`, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('mk_token')}`,
        'Content-Type': 'application/json',
        ...(opts.headers || {})
      },
      ...opts,
    })
    try {
      const data = await res.json()
      return data
    } catch {
      return { success: false, message: `Server error (HTTP ${res.status}). Please try again.` }
    }
  } catch (err) {
    return { success: false, message: 'Network or connection error. Please try again.' }
  }
}

const fmt = v => Number(v || 0).toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 })

// Workflow status badges
const SC = {
  Draft:            '#94a3b8',
  Submitted:        '#3b82f6',
  'L1 Approved':    '#0891b2',
  'L2 Approved':    '#7c3aed',
  Approved:         '#0f766e',
  'PO Created':     '#6366f1',
  'Partially Issued':'#f97316',
  Issued:           '#16a34a',
  Closed:           '#22c55e',
  Rejected:         '#ef4444',
  Cancelled:        '#64748b'
}

// Reason codes with rich visual categories
const REASON_CODES = [
  'Emergency Failure',
  'Scheduled PM',
  'Routine Replacement',
  'Wear & Tear',
  'Vibration/Noise',
  'Corrosion/Erosion',
  'Upgrade/MOC',
  'Misalignment/Damage',
  'Preventive Spare'
]

const CANCELLATION_REASONS = [
  'Double Entry / Duplicate Indent',
  'Wrong Item / Wrong Technical Specifications',
  'Department Cancelled / Requirement Withdrawn',
  'Incorrect Plant Section / Machine Context',
  'Quantity Calculation Error',
  'Store Technical Rejection',
  'Other Technical Reason'
]

const REASON_COLORS = {
  'Emergency Failure':    { bg: '#fee2e2', color: '#dc2626', border: '#fca5a5', icon: '🚨' },
  'Scheduled PM':         { bg: '#e0f2fe', color: '#0369a1', border: '#bae6fd', icon: '📅' },
  'Routine Replacement':  { bg: '#f1f5f9', color: '#475569', border: '#cbd5e1', icon: '🔄' },
  'Wear & Tear':          { bg: '#fef3c7', color: '#b45309', border: '#fde68a', icon: '⚙️' },
  'Vibration/Noise':      { bg: '#fdf4ff', color: '#a21caf', border: '#f5d0fe', icon: '🔊' },
  'Corrosion/Erosion':    { bg: '#fef2f2', color: '#b91c1c', border: '#fecaca', icon: '🧪' },
  'Upgrade/MOC':          { bg: '#f0fdf4', color: '#15803d', border: '#bbf7d0', icon: '✨' },
  'Misalignment/Damage':  { bg: '#fff7ed', color: '#c2410c', border: '#ffedd5', icon: '🛠️' },
  'Preventive Spare':     { bg: '#f0fdfa', color: '#0f766e', border: '#99f6e4', icon: '🛡️' }
}

const ALL_TABS = [
  { key: 'raise',       label: '✨ Request / Raise Indent',   who: u => (u.role_level || 1) >= 1 },
  { key: 'list',        label: '📋 All Indents & Vouchers',   who: () => true },
  { key: 'issue',       label: '📦 Store Issuance Desk',      who: u => u.dept_code === 'STORE' || ['Store Management', 'Store'].includes(u.department) || (u.role_level || 1) >= 3 },
  { key: 'acknowledge', label: '🤝 Fitment Acks',            who: u => (u.role_level || 1) >= 1 },
  { key: 'analytics',   label: '📊 Indent Analytics',         who: u => (u.role_level || 1) >= 2 },
  { key: 'calendar',    label: '📅 Indents Calendar',         who: () => true },
]

// Indian currency number to words generator for Company Invoices
function numberToWords(num) {
  if (!num || isNaN(num)) return 'Zero Rupees Only'
  const a = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen']
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']

  const inWords = (n) => {
    if (n < 20) return a[n] + ' '
    const digit = n % 10
    return b[Math.floor(n / 10)] + (digit ? ' ' + a[digit] : '')
  }

  let str = ''
  let n = Math.floor(num)
  const crore = Math.floor(n / 10000000)
  n %= 10000000
  const lakh = Math.floor(n / 100000)
  n %= 100000
  const thousand = Math.floor(n / 1000)
  n %= 1000
  const hundred = Math.floor(n / 100)
  n %= 100

  if (crore) str += inWords(crore) + 'Crore '
  if (lakh) str += inWords(lakh) + 'Lakh '
  if (thousand) str += inWords(thousand) + 'Thousand '
  if (hundred) str += inWords(hundred) + 'Hundred '
  if (n) str += inWords(n)

  return str.trim() ? `${str.trim()} Rupees Only` : 'Zero Rupees Only'
}

export default function Indent() {
  const { user } = useAuth()
  const visibleTabs = ALL_TABS.filter(t => t.who(user || {}))
  const [tabKey, setTabKey] = useState('raise')
  const printRef = useRef(null)

  const [rows, setRows] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [fStatus, setFStatus] = useState('')
  const [fDept, setFDept] = useState('')
  const [page, setPage] = useState(1)
  const [searchTerm, setSearchTerm] = useState('')
  const [raiseSearch, setRaiseSearch] = useState('')
  const [matSearch, setMatSearch] = useState({})
  const [matDropOpen, setMatDropOpen] = useState({})
  const [depts, setDepts] = useState([])
  const [mats, setMats] = useState([])
  const [sections, setSections] = useState([])
  const [machines, setMachines] = useState([])
  const [sectionEquipment, setSectionEquipment] = useState([])
  const [expandedRow, setExpandedRow] = useState(null)
  const [detail, setDetail] = useState(null)
  const [tier, setTier] = useState(null)
  const [analytics, setAnalytics] = useState(null)
  const [calendar, setCalendar] = useState([])
  const [calMonth, setCalMonth] = useState(new Date().getMonth() + 1)
  const [calYear, setCalYear] = useState(new Date().getFullYear())
  const [myAcks, setMyAcks] = useState([])
  const [ackItem, setAckItem] = useState(null)
  const [ackForm, setAckForm] = useState({ fitment_date: '', observations: '', kpi_before: '', kpi_after: '' })
  const [ackSaving, setAckSaving] = useState(false)
  const [msg, setMsg] = useState(null)
  const LIMIT = 25

  // Append Item State in Detail Modal
  const [appendOpen, setAppendOpen] = useState(false)
  const [appendForm, setAppendForm] = useState({
    material_id: '',
    required_qty: '1',
    uom: 'NOS',
    unit_price: '',
    component_position: '',
    reason_code: 'Routine Replacement',
    purpose: ''
  })
  const [appendSearch, setAppendSearch] = useState('')
  const [appendDrop, setAppendDrop] = useState(false)
  const [appendSaving, setAppendSaving] = useState(false)

  // Store Manager / Admin Cancellation & Deletion Modal State
  const [cancelModal, setCancelModal] = useState(null) // { id, num, deptName }
  const [cancelReason, setCancelReason] = useState('Double Entry / Duplicate Indent')
  const [cancelNotes, setCancelNotes] = useState('')
  const [cancelling, setCancelling] = useState(false)

  // 1-Click Conversion Modals for Existing Indents
  const [vendors, setVendors] = useState([])
  const [poModal, setPoModal] = useState(null)
  const [dcModal, setDcModal] = useState(null)
  const [cashModal, setCashModal] = useState(null)
  const [converting, setConverting] = useState(false)

  // Receiver Signature Modal & A3 Print
  const [a3PrintDoc, setA3PrintDoc] = useState(null)
  const [receiverSignModal, setReceiverSignModal] = useState(null)
  const [receiverSignForm, setReceiverSignForm] = useState({
    receiver_name: user?.name || '',
    receiver_emp_code: user?.employee_code || '',
    receiver_signature_note: 'Received and verified in department',
    fitment_date: new Date().toISOString().slice(0, 10),
    fitment_location: '',
    observations: ''
  })
  const [receiverSignSaving, setReceiverSignSaving] = useState(false)

  const handleReceiverSign = async (e) => {
    e.preventDefault()
    if (!receiverSignModal) return
    setReceiverSignSaving(true)
    try {
      const res = await API(`/indents/${receiverSignModal.id}/receive`, {
        method: 'PUT',
        body: JSON.stringify(receiverSignForm)
      })
      if (res.success) {
        setMsg({ ok: true, text: res.message || 'Receiver signature recorded and indent closed successfully!' })
        setReceiverSignModal(null)
        load()
        if (detail?.id === receiverSignModal.id) {
          openDetail(receiverSignModal.id)
        }
      } else {
        setMsg({ ok: false, text: res.message || 'Failed to sign indent' })
      }
    } catch (err) {
      setMsg({ ok: false, text: err.message })
    } finally {
      setReceiverSignSaving(false)
    }
  }

  // Sequence Violation Modal State
  const [sequenceViolation, setSequenceViolation] = useState(null)

  const openA3IndentPrint = async (indOrId) => {
    let fullDoc = typeof indOrId === 'object' ? indOrId : null
    if (!fullDoc || !fullDoc.items || fullDoc.items.length === 0) {
      const id = typeof indOrId === 'object' ? indOrId.id : indOrId
      const res = await API(`/indent/${id}`)
      if (res.success && res.data) fullDoc = res.data
    }
    if (!fullDoc) return
    const formattedItems = (fullDoc.items || []).map((it, idx) => ({
      materialName: it.materialName || it.material_name,
      materialCode: it.materialCode || it.material_code,
      uom: it.uom || it.matUom || 'NOS',
      in_qty: it.issued_qty || it.required_qty || 1,
      unit_price: it.matPrice || it.unit_price || 0,
      hsnCode: it.hsnCode || it.hsn_code || '84399900',
      gst_pct: it.gst_pct != null ? it.gst_pct : 18,
      batch_number: it.batch_no || it.batch_number || '—',
      pack_size: it.uom || it.matUom || 'NOS',
      mrp: it.matPrice || it.unit_price || 0,
      trade_price: it.matPrice || it.unit_price || 0
    }))
    setA3PrintDoc({
      ...fullDoc,
      invoiceNumber: fullDoc.indent_number || fullDoc.indentNumber,
      grnNumber: fullDoc.indent_number || fullDoc.indentNumber,
      deptName: fullDoc.deptName || fullDoc.departmentName || 'Mechanical Department',
      partyName: fullDoc.deptName || fullDoc.departmentName || 'Mechanical Department',
      sectionName: fullDoc.sectionName || fullDoc.section || '',
      machineName: fullDoc.machineName || fullDoc.machine_id || '',
      raisedByName: fullDoc.raisedBy || fullDoc.raisedByName || fullDoc.createdByName || 'Indent Requester',
      raisedByEmpCode: fullDoc.raisedByEmpCode || fullDoc.emp_code || '',
      createdByName: fullDoc.raisedBy || fullDoc.raisedByName || fullDoc.createdByName || 'Store Officer',
      approvedByName: fullDoc.approvedBy || fullDoc.approvedByName || 'Store Manager',
      itemPurpose: fullDoc.itemPurpose || fullDoc.purpose || fullDoc.remarks || 'Plant Operations & Maintenance',
      items: formattedItems,
      title: 'STORE INDENT / ISSUE VOUCHER'
    })
  }

  // Form state for Raise / Edit with Multi-Mode Fulfillment
  const blankForm = () => ({
    department_id: user?.department_id || '',
    required_date: '',
    remarks: '',
    section: '',
    section_id: '',
    machine_id: '',
    section_equipment_id: '',
    machine_context: '',
    fulfillment_mode: 'pr', // 'pr' | 'po' | 'cash' | 'issue' | 'dc'
    // PO fields
    vendor_id: '',
    payment_terms: 'Net 30 Days',
    delivery_date: '',
    // Cash Purchase fields
    vendor_name: '',
    vendor_gstin: '',
    invoice_number: '',
    payment_mode: 'Cash',
    payment_ref: '',
    // DC fields
    dc_type: 'MATERIAL_OUT',
    vehicle_number: '',
    vehicle_type: 'Truck',
    driver_name: '',
    to_party: '',
    consignee_vendor_id: '',
    dc_purpose: '',
    expected_return_date: '',
    items: [{ material_id: '', required_qty: '', uom: '', unit_price: '', gst_pct: 18, purpose: '', component_position: '', reason_code: 'Routine Replacement' }]
  })
  const [form, setForm] = useState(blankForm())
  const [saving, setSaving] = useState(false)
  const [editId, setEditId] = useState(null)
  const [reviewMode, setReviewMode] = useState(false)
  const [formErrors, setFormErrors] = useState({})
  const [reviewError, setReviewError] = useState(null)

  useEffect(() => {
    if (user && !form.department_id) {
      setForm(f => ({ ...f, department_id: user.department_id || '' }))
    }
  }, [user])

  // Issue form
  const [issueItems, setIssueItems] = useState([])
  const [issueRemarks, setIssueRemarks] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const p = new URLSearchParams({ page, limit: LIMIT })
    if (fStatus) p.set('status', fStatus)
    if (fDept && fDept !== 'undefined') p.set('dept', fDept)
    if (searchTerm) p.set('search', searchTerm)

    const r = await API(`/indent?${p}`)
    if (r.success) { setRows(r.data); setTotal(r.total) }
    setLoading(false)
  }, [page, fStatus, fDept, searchTerm])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    API('/users/departments').then(r => { if (r.success) setDepts(r.data || []) })
    API('/master/materials?limit=2500').then(r => { if (r.success) setMats(r.data || []) })
    API('/sections').then(r => { if (r.success) setSections(r.data || []) })
    API('/master/machines').then(r => { if (r.success) setMachines(r.data || []) })
    API('/master/section-equipment').then(r => { if (r.success) setSectionEquipment(r.data || []) })
    API('/master/vendors').then(r => { if (r.success) setVendors(r.data || []) })

    // Check URL params for direct tab / detail routing
    const params = new URLSearchParams(window.location.search)
    const tabParam = params.get('tab')
    if (tabParam && ['raise', 'list', 'issue', 'acknowledge', 'analytics', 'calendar'].includes(tabParam)) {
      setTabKey(tabParam)
    }
    const indId = params.get('indent_id') || params.get('indentId') || params.get('id')
    if (indId) {
      openDetail(indId)
    }
  }, [])


  useEffect(() => { if (tabKey === 'analytics') loadAnalytics() }, [tabKey])
  useEffect(() => { if (tabKey === 'calendar') loadCalendar() }, [tabKey, calMonth, calYear])
  useEffect(() => { if (tabKey === 'acknowledge') loadMyAcks() }, [tabKey])

  const loadAnalytics = async () => {
    const r = await API('/indent/analytics/summary')
    if (r.success) setAnalytics(r.data)
  }
  const loadCalendar = async () => {
    const r = await API(`/indent/calendar?month=${calMonth}&year=${calYear}`)
    if (r.success) setCalendar(r.data)
  }
  const loadMyAcks = async () => {
    const r = await API('/indent/my-acks')
    if (r.success) setMyAcks(r.data)
  }

  const openAck = (it) => {
    setAckItem(it)
    setAckForm({ fitment_date: '', observations: '', kpi_before: '', kpi_after: '' })
  }
  const submitAck = async () => {
    if (!ackItem) return
    setAckSaving(true)
    const r = await API(`/indent/items/${ackItem.item_id}/acknowledge`, { method: 'PUT', body: JSON.stringify(ackForm) })
    setAckSaving(false)
    if (r.success) {
      flash(true, r.autoClosed ? 'Acknowledged — indent auto-closed' : 'Item acknowledged')
      setAckItem(null)
      loadMyAcks()
      load()
    } else {
      flash(false, r.message || 'Failed')
    }
  }

  const flash = (ok, text) => { setMsg({ ok, text }); setTimeout(() => setMsg(null), 4000) }

  const openDetail = async (id) => {
    const [r, t] = await Promise.all([API(`/indent/${id}`), API(`/indent/${id}/tier`)])
    if (r.success) {
      setDetail(r.data)
      setIssueItems((r.data.items || []).map(it => {
        const remaining = Math.max(0, Number(it.required_qty) - Number(it.issued_qty || 0))
        return {
          ...it,
          selected: remaining > 0,
          issued_qty: remaining > 0 ? remaining : Number(it.required_qty),
          batch_no: it.batch_no || ''
        }
      }))
    }
    if (t.success) setTier(t.data)
  }

  // Form helpers
  const addItem = () => setForm(f => ({
    ...f,
    items: [...f.items, { material_id: '', required_qty: '', uom: '', purpose: '', component_position: '', reason_code: 'Routine Replacement' }]
  }))
  const removeItem = i => setForm(f => ({ ...f, items: f.items.filter((_, j) => j !== i) }))
  const setItem = (i, k, v) => setForm(f => ({ ...f, items: f.items.map((it, j) => j === i ? { ...it, [k]: v } : it) }))
  const matByID = id => mats.find(m => String(m.id) === String(id))
  const matPrice = mat => parseFloat(mat?.unit_price || mat?.unitPrice || 0)
  const lineTotal = it => {
    const hasOverride = it.unit_price !== '' && it.unit_price !== undefined && it.unit_price !== null
    const price = hasOverride ? (parseFloat(it.unit_price) || 0) : matPrice(matByID(it.material_id))
    return (parseFloat(it.required_qty) || 0) * price
  }
  const grandTotal = form.items.reduce((s, it) => s + lineTotal(it), 0)

  // ── Append Item in Detail View ──────────────────────────────────────────────
  const handleAppendItem = async (e) => {
    e.preventDefault()
    if (!detail || !appendForm.material_id || !appendForm.required_qty) {
      return alert('Select material and valid quantity')
    }
    setAppendSaving(true)
    const selMat = matByID(appendForm.material_id)
    const payload = {
      ...appendForm,
      uom: appendForm.uom || selMat?.uom || 'NOS',
      required_qty: Number(appendForm.required_qty)
    }
    const res = await API(`/indent/${detail.id}/items`, { method: 'POST', body: JSON.stringify(payload) })
    setAppendSaving(false)
    if (res.success) {
      setAppendOpen(false)
      setAppendForm({ material_id: '', required_qty: '1', uom: 'NOS', unit_price: '', component_position: '', reason_code: 'Routine Replacement', purpose: '' })
      setAppendSearch('')
      openDetail(detail.id)
      load()
      flash(true, 'Item appended to indent successfully')
    } else {
      alert(res.message || 'Failed to append item')
    }
  }

  const handleDeleteItem = async (itemId) => {
    if (!window.confirm('Remove this line item from indent?')) return
    const res = await API(`/indent/${detail.id}/items/${itemId}`, { method: 'DELETE' })
    if (res.success) {
      openDetail(detail.id)
      load()
      flash(true, 'Line item removed')
    } else {
      alert(res.message || 'Failed to delete item')
    }
  }

  // ── Store Manager Indent Cancellation & Deletion Handlers ─────────────────
  const handleCancelSubmit = async (e) => {
    e.preventDefault()
    if (!cancelModal) return
    setCancelling(true)
    const res = await API(`/indent/${cancelModal.id}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ reason: cancelReason, remarks: cancelNotes })
    })
    setCancelling(false)
    if (res.success) {
      flash(true, `Indent ${cancelModal.num} marked as Cancelled`)
      setCancelModal(null)
      setCancelNotes('')
      if (detail?.id === cancelModal.id) openDetail(cancelModal.id)
      load()
    } else {
      alert(res.message || 'Failed to cancel indent')
    }
  }

  const handleHardDelete = async () => {
    if (!cancelModal) return
    if (!window.confirm(`⚠️ PERMANENT PURGE: Are you sure you want to forcefully and permanently delete Indent ${cancelModal.num} from the database? Any issued stock will be automatically restored. This cannot be undone.`)) return
    setCancelling(true)
    const res = await API(`/indent/${cancelModal.id}?force=true`, { method: 'DELETE' })
    setCancelling(false)
    if (res.success) {
      flash(true, `Indent ${cancelModal.num} permanently deleted`)
      setCancelModal(null)
      if (detail?.id === cancelModal.id) setDetail(null)
      load()
    } else {
      alert(res.message || 'Failed to delete indent')
    }
  }

  // ── Comprehensive CSV / Excel Export ───────────────────────────────────────
  const exportToCSV = () => {
    if (!rows.length) return alert('No indents to export')
    const headers = [
      'Indent Number', 'Date & Time Raised', 'Department', 'Plant Section Code', 'Plant Section Name',
      'Machine Context', 'Raised By (Indentor)', 'Indentor Employee Code', 'Designation / Role',
      'Reason Code', 'Technical Justification / Purpose', 'Work Order / Remarks', 'Status', 'Cancellation Reason',
      'Vendor Name (PO/Cash Purchase)', 'PO Number', 'Total Value (INR)'
    ]
    const csvRows = [headers.join(',')]
    rows.forEach(r => {
      csvRows.push([
        `"${r.indentNumber || ''}"`,
        `"${r.date?.slice(0, 10) || ''} ${r.raisedAt ? new Date(r.raisedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : ''}"`,
        `"${r.deptName || ''}"`,
        `"${r.sectionCode || 'GEN'}"`,
        `"${r.sectionName || 'Plant General'}"`,
        `"${r.machineName ? `[${r.machineCode}] ${r.machineName}` : (r.machine_id || 'General Mill Spares')}"`,
        `"${r.raisedBy || r.raisedByName || ''}"`,
        `"${r.raisedByEmpCode || '—'}"`,
        `"${r.raisedByRole || 'Technical Staff'}"`,
        `"${r.reasonCode || 'Routine Replacement'}"`,
        `"${(r.itemPurpose || '').replace(/"/g, '""')}"`,
        `"${(r.remarks || '').replace(/"/g, '""')}"`,
        `"${r.status || ''}"`,
        `"${(r.cancellationReason || '—').replace(/"/g, '""')}"`,
        `"${r.linkedPoVendorName || r.linkedCpVendorName || ''}"`,
        `"${r.linkedPoNumber || ''}"`,
        Number(r.total_value || 0).toFixed(2)
      ].join(','))
    })
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `MK_Paper_Mill_PIIMAS_Indents_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // ── Company Invoice & Voucher Export & Printing (Unified A3 Landscape) ──────
  const printCompanyInvoice = async (indentId) => {
    openA3IndentPrint(indentId)
  }

  // ── 1-Click PO, DC & Cash Conversion Handlers ─────────────────────────────
  const openConvertPo = async (indRow) => {
    let ind = indRow
    if (!ind.items || !ind.items.length) {
      const r = await API(`/indent/${indRow.id}`)
      if (r.success) ind = r.data
    }
    const items = (ind.items || []).map(it => ({
      id: it.id,
      material_id: it.material_id,
      materialName: it.materialName || it.material_name || '',
      materialCode: it.materialCode || it.material_code || '',
      required_qty: it.required_qty,
      uom: it.uom || it.matUom || 'NOS',
      unit_price: it.matPrice || it.unit_price || 0,
      gst_pct: it.gst_pct != null ? it.gst_pct : 18
    }))
    setPoModal({
      id: ind.id,
      indentNumber: ind.indentNumber || ind.indent_number,
      num: ind.indentNumber || ind.indent_number,
      total_value: ind.total_value,
      vendor_id: '',
      payment_terms: 'Net 30 Days',
      delivery_date: (ind.requiredDate || ind.required_date || '').slice(0, 10),
      remarks: `Direct PO generated from Indent ${ind.indentNumber || ind.indent_number}`,
      items
    })
  }

  const handleConvertPoSubmit = async (e) => {
    e.preventDefault()
    if (!poModal?.vendor_id) return alert('Please select a Vendor for the Purchase Order')
    setConverting(true)
    const res = await API(`/indent/${poModal.id}/convert-to-po`, {
      method: 'POST',
      body: JSON.stringify({
        vendor_id: poModal.vendor_id,
        payment_terms: poModal.payment_terms,
        delivery_date: poModal.delivery_date,
        remarks: poModal.remarks,
        items: poModal.items
      })
    })
    setConverting(false)
    if (res.success) {
      flash(true, res.message || 'Purchase Order generated successfully')
      setPoModal(null)
      if (detail?.id === poModal.id) openDetail(poModal.id)
      load()
    } else {
      alert(res.message || 'Failed to convert Indent to PO')
    }
  }

  const openConvertDc = async (indRow) => {
    let ind = indRow
    if (!ind.items || !ind.items.length) {
      const r = await API(`/indent/${indRow.id}`)
      if (r.success) ind = r.data
    }
    setDcModal({
      id: ind.id,
      indentNumber: ind.indentNumber || ind.indent_number,
      num: ind.indentNumber || ind.indent_number,
      total_value: ind.total_value,
      dc_type: 'MATERIAL_OUT',
      vehicle_number: '',
      vehicle_type: 'Truck',
      driver_name: '',
      to_party: '',
      consignee_vendor_id: '',
      dc_purpose: `Outward Dispatch for Indent ${ind.indentNumber || ind.indent_number}`,
      expected_return_date: '',
      items: (ind.items || []).map(it => ({
        id: it.id,
        material_id: it.material_id,
        materialName: it.materialName || it.material_name || '',
        materialCode: it.materialCode || it.material_code || '',
        component_position: it.component_position || '',
        required_qty: it.required_qty,
        uom: it.uom || it.matUom || 'NOS'
      }))
    })
  }

  const handleConvertDcSubmit = async (e) => {
    e.preventDefault()
    if (!dcModal?.to_party) return alert('Please specify the Consignee / Destination Party Name')
    setConverting(true)
    const res = await API(`/indent/${dcModal.id}/convert-to-dc`, {
      method: 'POST',
      body: JSON.stringify({
        dc_type: dcModal.dc_type,
        vehicle_number: dcModal.vehicle_number,
        vehicle_type: dcModal.vehicle_type,
        driver_name: dcModal.driver_name,
        to_party: dcModal.to_party,
        consignee_vendor_id: dcModal.consignee_vendor_id || null,
        dc_purpose: dcModal.dc_purpose,
        expected_return_date: dcModal.expected_return_date || null
      })
    })
    setConverting(false)
    if (res.success) {
      flash(true, res.message || 'Delivery Challan generated successfully')
      setDcModal(null)
      if (detail?.id === dcModal.id) openDetail(dcModal.id)
      load()
    } else {
      alert(res.message || 'Failed to generate Delivery Challan')
    }
  }

  const openConvertCash = async (indRow) => {
    let ind = indRow
    if (!ind.items || !ind.items.length) {
      const r = await API(`/indent/${indRow.id}`)
      if (r.success) ind = r.data
    }
    setCashModal({
      id: ind.id,
      indentNumber: ind.indentNumber || ind.indent_number,
      num: ind.indentNumber || ind.indent_number,
      total_value: ind.total_value,
      vendor_name: '',
      vendor_gstin: '',
      invoice_number: '',
      payment_mode: 'Cash',
      payment_ref: '',
      remarks: `Spot Cash Purchase against Indent ${ind.indentNumber || ind.indent_number}`,
      items: ind.items || []
    })
  }

  const handleConvertCashSubmit = async (e) => {
    e.preventDefault()
    if (!cashModal?.vendor_name) return alert('Please specify the Supplier / Shop Name')
    setConverting(true)
    const res = await API(`/indent/${cashModal.id}/convert-to-cash-purchase`, {
      method: 'POST',
      body: JSON.stringify({
        vendor_name: cashModal.vendor_name,
        vendor_gstin: cashModal.vendor_gstin || null,
        invoice_number: cashModal.invoice_number,
        payment_mode: cashModal.payment_mode || 'Cash',
        payment_ref: cashModal.payment_ref || null,
        remarks: cashModal.remarks
      })
    })
    setConverting(false)
    if (res.success) {
      flash(true, res.message || 'Cash Purchase Voucher generated & stock updated successfully!')
      setCashModal(null)
      if (detail?.id === cashModal.id) openDetail(cashModal.id)
      load()
    } else {
      alert(res.message || 'Failed to convert Indent to Cash Purchase')
    }
  }

  // ── Form Actions ─────────────────────────────────────────────────────────────
  const validateForm = () => {
    const errs = {}
    if (!form.department_id) errs.department_id = 'Select department'
    if (!form.required_date) errs.required_date = 'Pick required date'
    if (!form.section) errs.section = 'Select plant section / area'
    if (form.fulfillment_mode === 'po' && !form.vendor_id) {
      errs.vendor_id = 'Select a vendor for direct PO creation'
    }
    if (form.fulfillment_mode === 'cash' && !form.vendor_name) {
      errs.vendor_name = 'Supplier / Vendor name is required for Cash Purchase'
    }
    if (form.fulfillment_mode === 'dc' && !form.to_party) {
      errs.to_party = 'Consignee / Destination party is required for DC'
    }
    const itemErrs = form.items.map(it => {
      const e = {}
      if (!it.material_id) e.material_id = 'Pick a material from dropdown'
      if (!it.required_qty || Number(it.required_qty) <= 0) e.required_qty = 'Qty must be > 0'
      if (form.fulfillment_mode === 'issue') {
        const mat = matByID(it.material_id)
        if (mat && Number(mat.current_stock || 0) < Number(it.required_qty)) {
          e.required_qty = `Insufficient stock (Avail: ${mat.current_stock})`
        }
      }
      return e
    })
    if (itemErrs.some(e => Object.keys(e).length)) errs.items = itemErrs
    return errs
  }

  const goToReview = e => {
    e.preventDefault()
    setReviewError(null)
    const errs = validateForm()
    setFormErrors(errs)
    if (Object.keys(errs).length) { flash(false, 'Fix the highlighted fields before review'); return }
    setReviewMode(true)
  }

  const save = async () => {
    setSaving(true)
    setReviewError(null)
    const items = form.items.map(it => {
      const m = matByID(it.material_id)
      return {
        ...it,
        uom: m?.uom || it.uom || 'NOS',
        unit_price: it.unit_price !== '' && it.unit_price !== undefined ? parseFloat(it.unit_price) : parseFloat(m?.unit_price || 0),
        gst_pct: parseFloat(it.gst_pct ?? 18)
      }
    })
    const r = editId
      ? await API(`/indent/${editId}`, { method: 'PUT', body: JSON.stringify({ ...form, items }) })
      : await API('/indent', { method: 'POST', body: JSON.stringify({ ...form, items }) })
    setSaving(false)
    if (r.success) {
      setForm(blankForm()); setEditId(null); setTabKey('list'); setReviewMode(false); setFormErrors({}); setReviewError(null); load()
      flash(true, r.message || (editId ? `Indent updated: ${r.data?.indent_number || editId}` : `Indent created: ${r.data?.indent_number}`))
    } else {
      setReviewError(r.message || 'Failed to save indent')
      flash(false, r.message || 'Failed to save indent')
    }
  }

  const openEdit = async (id) => {
    const r = await API(`/indent/${id}`)
    if (!r.success) return flash(false, r.message)
    const d = r.data
    setEditId(id)
    setForm({
      department_id: d.department_id || '',
      required_date: d.required_date?.slice(0, 10) || '',
      remarks: d.remarks || '',
      section: d.section_id || '',
      machine_id: d.machine_id || '',
      machine_context: '',
      fulfillment_mode: 'pr',
      vendor_id: '',
      payment_terms: 'Net 30 Days',
      delivery_date: '',
      dc_type: 'MATERIAL_OUT',
      vehicle_number: '',
      vehicle_type: 'Truck',
      driver_name: '',
      to_party: '',
      consignee_vendor_id: '',
      dc_purpose: '',
      items: (d.items || []).map(it => ({
        material_id: it.material_id,
        required_qty: it.required_qty,
        uom: it.matUom || it.uom || matByID(it.material_id)?.uom || 'NOS',
        unit_price: it.matPrice || it.unit_price || '',
        gst_pct: 18,
        purpose: it.purpose || '',
        component_position: it.component_position || '',
        reason_code: it.reason_code || 'Routine Replacement'
      }))
    })
    setReviewMode(false)
    setFormErrors({})
    setTabKey('raise')
  }


  const action = async (id, path, body) => {
    const r = await API(`/indent/${id}/${path}`, { method: 'PUT', body: body ? JSON.stringify(body) : undefined })
    if (r.success) {
      load()
      flash(true, 'Done')
      if (detail?.id === id) openDetail(id)
    } else if (r.sequence_violation) {
      setSequenceViolation({
        violationType: r.violationType || 'sm_approval_required',
        currentStep: r.currentStep || 1,
        requiredStep: r.requiredStep || 2,
        indentNumber: r.indentNumber || '',
        deptName: r.deptName || '',
        targetId: id
      })
    } else {
      flash(false, r.message || 'Failed')
    }
  }

  const submitIssue = async (e) => {
    e.preventDefault()
    if (!detail) return
    if (detail.status === 'Submitted') {
      setSequenceViolation({
        violationType: 'sm_approval_required',
        currentStep: 1,
        requiredStep: 2,
        indentNumber: detail.indent_number,
        deptName: detail.deptName,
        targetId: detail.id
      })
      return
    }
    const selectedItems = issueItems.filter(it => it.selected)
    if (!selectedItems.length) {
      return alert('Please select at least one item using the checkbox to issue')
    }
    const invalidQty = selectedItems.find(it => !it.issued_qty || Number(it.issued_qty) <= 0)
    if (invalidQty) {
      return alert(`Please enter a valid issue quantity (> 0) for ${invalidQty.materialName || 'selected items'}`)
    }
    const items = selectedItems.map(it => ({
      id: it.id,
      material_id: it.material_id,
      issued_qty: Number(it.issued_qty),
      batch_no: it.batch_no || null,
      component_position: it.component_position || null,
      purpose: it.purpose || ''
    }))
    const r = await API(`/indent/${detail.id}/issue`, { method: 'POST', body: JSON.stringify({ items, remarks: issueRemarks }) })
    if (r.success) {
      flash(true, `Voucher ${detail.indent_number} issued — stock updated in database (${r.status})`)
      setDetail(null)
      load()
    } else if (r.sequence_violation) {
      setSequenceViolation({
        violationType: r.violationType || 'sm_approval_required',
        currentStep: r.currentStep || 1,
        requiredStep: r.requiredStep || 2,
        indentNumber: detail.indent_number,
        deptName: detail.deptName,
        targetId: detail.id
      })
    } else {
      flash(false, r.message || 'Issuance failed')
    }
  }

  const totalPages = Math.ceil(total / LIMIT)
  const isStore = user?.dept_code === 'STORE' || ['Store Management', 'Store'].includes(user?.department)
  const isElevated = (user?.role_level || 1) >= 4

  return (
    <div style={S.page}>
      {/* ── Top Header ── */}
      <div style={S.hdr}>
        <div>
          <div style={S.title}>🏭 PIIMAS — Material Indent &amp; Issuance System</div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
            Plant Item Indent, Material Approval &amp; Store Issuance System with Live Stock Deductions &amp; Company Invoice Generation
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {tabKey !== 'raise' ? (
            <button style={{ ...S.btnSecondary, background: '#0f766e', color: '#fff', fontWeight: 700 }} onClick={() => setTabKey('raise')}>
              ＋ Raise / Request Indent
            </button>
          ) : (
            <button style={{ ...S.btnSecondary, background: '#1e293b', color: '#fff', fontWeight: 700 }} onClick={() => setTabKey('list')}>
              📋 All Indents Register
            </button>
          )}
          <button style={S.btnSecondary} onClick={exportToCSV} title="Export Indents with Full Specifications to CSV">
            📥 Export CSV
          </button>
        </div>
      </div>

      {msg && <div style={msg.ok ? S.ok : S.err}>{msg.text}</div>}

      {/* ── Navigation Tabs ── */}
      <div style={S.tabs}>
        {visibleTabs.map(t => (
          <button key={t.key} style={S.tab(tabKey === t.key)} onClick={() => setTabKey(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── MULTI-AGENT SYNCHRONIZATION & TELEMETRY BAR ── */}
      <AgentStatusBanner currentModule="indent" />


      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* ── TAB 1: ALL INDENTS LIST (With Detailed Indentor & Equipment Views) ── */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {tabKey === 'list' && (
        <div>
          {/* Filters Bar */}
          <div style={{ ...S.card, padding: '10px 14px', display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
            <input
              style={{ ...S.inp, flex: 1, minWidth: 260 }}
              placeholder="🔍 Search Indent No, Indentor Name, Emp Code, Equipment, Material..."
              value={searchTerm}
              onChange={e => { setSearchTerm(e.target.value); setPage(1) }}
            />
            <select style={{ ...S.sel, width: 170 }} value={fStatus} onChange={e => { setFStatus(e.target.value); setPage(1) }}>
              <option value="">All Statuses</option>
              {Object.keys(SC).map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <select style={{ ...S.sel, width: 180 }} value={fDept} onChange={e => { setFDept(e.target.value); setPage(1) }}>
              <option value="">All Departments</option>
              {depts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            <button style={S.btnSm('#0f766e')} onClick={load} title="Refresh Indents List">↻ Refresh</button>
          </div>

          {/* Indents Table */}
          <div style={{ ...S.card, padding: 0, overflow: 'auto' }}>
            {loading ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>Loading PIIMAS Indents...</div>
            ) : (
              <table style={S.tbl}>
                <thead>
                  <tr>
                    {['', 'Indent No', 'Date & Time', 'Raised By (Indentor)', 'Department & Section', 'Machine / Equipment', 'Reason & Technical Purpose', 'Status', 'Total Value', 'Actions'].map(h => (
                      <th key={h} style={S.th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 && (
                    <tr><td colSpan={10} style={{ ...S.td, textAlign: 'center', color: '#8a8a90', padding: 36 }}>No indents found matching your filter</td></tr>
                  )}
                  {rows.map(r => {
                    const rc = r.reasonCode || 'Routine Replacement'
                    const rcStyle = REASON_COLORS[rc] || { bg: '#f1f5f9', color: '#475569', border: '#cbd5e1', icon: '📝' }
                    const isExp = expandedRow === r.id

                    return (
                      <React.Fragment key={r.id}>
                        <tr>
                          {/* Expand Toggle */}
                          <td style={{ ...S.td, width: 30, textAlign: 'center' }}>
                            <button
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', fontSize: 13 }}
                              onClick={() => setExpandedRow(isExp ? null : r.id)}
                              title="Expand Full Technical Breakdown"
                            >
                              {isExp ? '▾' : '▸'}
                            </button>
                          </td>

                          {/* Indent No & Linked Documents */}
                          <td style={S.td}>
                            <span
                              onClick={() => openDetail(r.id)}
                              style={{ fontFamily: 'monospace', fontSize: 12, color: '#0f766e', fontWeight: 700, cursor: 'pointer', textDecoration: 'underline' }}
                              title="Click to View Full Details & Associated Documents"
                            >
                              {r.indentNumber}
                            </span>
                            {r.linkedPoNumber && (
                              <div style={{ marginTop: 3 }}>
                                <span style={{ fontSize: 10, background: '#e0f2fe', color: '#0369a1', padding: '1px 6px', borderRadius: 4, border: '1px solid #bae6fd', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                                  🛒 PO: {r.linkedPoNumber}
                                </span>
                              </div>
                            )}
                            {r.linkedCpNumber && (
                              <div style={{ marginTop: 3 }}>
                                <span style={{ fontSize: 10, background: '#dcfce7', color: '#15803d', padding: '1px 6px', borderRadius: 4, border: '1px solid #86efac', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                                  💵 CP: {r.linkedCpNumber}
                                </span>
                              </div>
                            )}
                            {r.linkedGpNumber && (
                              <div style={{ marginTop: 3 }}>
                                <span style={{ fontSize: 10, background: '#fef3c7', color: '#b45309', padding: '1px 6px', borderRadius: 4, border: '1px solid #fde68a', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                                  🚛 DC: {r.linkedGpNumber}
                                </span>
                              </div>
                            )}
                            {['Issued', 'Partially Issued'].includes(r.status) && (
                              <div style={{ marginTop: 3 }}>
                                <span style={{ fontSize: 10, background: '#dcfce7', color: '#15803d', padding: '1px 6px', borderRadius: 4, border: '1px solid #bbf7d0', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                                  📦 SIV Issued
                                </span>
                              </div>
                            )}
                          </td>

                          {/* Date & Time Raised */}
                          <td style={S.td}>
                            <div style={{ fontSize: 12, color: '#1e293b', fontWeight: 600 }}>{r.date?.slice(0, 10)}</div>
                            {r.raisedAt && (
                              <div style={{ fontSize: 10, color: '#64748b' }}>
                                {new Date(r.raisedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                              </div>
                            )}
                          </td>

                          {/* Raised By (Indentor Profile) */}
                          <td style={S.td}>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <strong style={{ color: '#0f172a', fontSize: 12 }}>{r.raisedBy || r.raisedByName || '—'}</strong>
                              <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginTop: 1 }}>
                                {r.raisedByEmpCode && (
                                  <span style={{ fontFamily: 'monospace', fontSize: 10, color: '#0f766e', fontWeight: 700, background: '#f0fdfa', padding: '0 4px', borderRadius: 3, border: '1px solid #ccfbf1' }}>
                                    {r.raisedByEmpCode}
                                  </span>
                                )}
                                <span style={{ fontSize: 10, color: '#64748b' }}>
                                  {r.raisedByRole || 'Technical Staff'}
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* Department & Section */}
                          <td style={S.td}>
                            <strong style={{ color: '#1e293b' }}>{r.deptName || '—'}</strong>
                            {r.sectionCode && (
                              <div style={{ marginTop: 2 }}>
                                <span style={{
                                  fontFamily: 'monospace', fontSize: 10, fontWeight: 700,
                                  background: '#f0fdfa', color: '#0f766e', padding: '1px 6px',
                                  borderRadius: 4, border: '1px solid #99f6e4', display: 'inline-block'
                                }}>
                                  [{r.sectionCode}] {r.sectionName || ''}
                                </span>
                              </div>
                            )}
                          </td>

                          {/* Machine / Equipment Context */}
                          <td style={S.td}>
                            {r.machineName ? (
                              <div>
                                <strong style={{ color: '#0f172a', fontSize: 11 }}>{r.machineName}</strong>
                                {r.machineCode && <div style={{ fontSize: 10, color: '#64748b', fontFamily: 'monospace' }}>[{r.machineCode}]</div>}
                              </div>
                            ) : (
                              <span style={{ fontSize: 11, color: '#64748b' }}>{r.machine_id || 'General Spares'}</span>
                            )}
                          </td>

                          {/* Reason & Technical Purpose Display */}
                          <td style={{ ...S.td, maxWidth: 260 }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                              <div>
                                <span style={{
                                  fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 12,
                                  background: rcStyle.bg, color: rcStyle.color, border: `1px solid ${rcStyle.border}`,
                                  display: 'inline-flex', alignItems: 'center', gap: 4
                                }}>
                                  <span>{rcStyle.icon}</span>
                                  <span>{rc}</span>
                                </span>
                                {r.itemCount > 1 && (
                                  <span style={{ fontSize: 10, color: '#64748b', marginLeft: 6, fontWeight: 600 }}>
                                    ({r.itemCount} items)
                                  </span>
                                )}
                              </div>
                              {(r.itemPurpose || r.remarks) && (
                                <div style={{ fontSize: 11, color: '#475569', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.itemPurpose || r.remarks}>
                                  {r.itemPurpose || r.remarks}
                                </div>
                              )}
                            </div>
                          </td>

                          {/* Status */}
                          <td style={S.td}>
                            {r.status === 'Cancelled' ? (
                              <span style={{ ...S.badge('#ef4444'), fontWeight: 700 }} title={r.cancellationReason || 'Cancelled Indent'}>
                                ❌ Cancelled
                              </span>
                            ) : (
                              <span style={S.badge(SC[r.status] || '#8a8a90')}>{r.status}</span>
                            )}
                          </td>

                          {/* Total Value */}
                          <td style={S.td}>
                            <span style={{ fontSize: 12, fontWeight: 700, color: r.status === 'Cancelled' ? '#94a3b8' : '#0f766e', textDecoration: r.status === 'Cancelled' ? 'line-through' : 'none' }}>
                              {r.total_value > 0 ? fmt(r.total_value) : '—'}
                            </span>
                          </td>

                          {/* Full Action Suite */}
                          <td style={S.td}>
                            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                              <button
                                style={{ ...S.btnSm('#0f766e'), padding: '4px 8px', display: 'flex', alignItems: 'center', gap: 4 }}
                                onClick={() => printCompanyInvoice(r.id)}
                                title="Print Official Company Invoice Voucher"
                              >
                                🖨️ Voucher
                              </button>
                              <button style={S.btnSm('#1e293b')} onClick={() => openDetail(r.id)}>View</button>

                              {/* 1-Click Convert to PO */}
                              {!r.linkedPoId && !['Rejected', 'Cancelled', 'Issued', 'Closed'].includes(r.status) && (
                                <button
                                  style={{ ...S.btnSm('#0284c7'), padding: '4px 8px', display: 'flex', alignItems: 'center', gap: 3, fontWeight: 700 }}
                                  onClick={() => openConvertPo(r)}
                                  title="1-Click Convert Indent to Purchase Order (PO)"
                                >
                                  🛒 +PO
                                </button>
                              )}

                              {/* 1-Click Convert to Cash Purchase */}
                              {!r.linkedCpId && !r.linkedPoId && !['Rejected', 'Cancelled', 'Issued', 'Closed'].includes(r.status) && (
                                <button
                                  style={{ ...S.btnSm('#16a34a'), padding: '4px 8px', display: 'flex', alignItems: 'center', gap: 3, fontWeight: 700 }}
                                  onClick={() => openConvertCash(r)}
                                  title="1-Click Convert Indent to Direct Cash Purchase (Instant Stock Intake)"
                                >
                                  💵 +Cash
                                </button>
                              )}

                              {/* 1-Click Convert to DC */}
                              {!r.linkedGpId && !['Rejected', 'Cancelled'].includes(r.status) && (
                                <button
                                  style={{ ...S.btnSm('#d97706'), padding: '4px 8px', display: 'flex', alignItems: 'center', gap: 3, fontWeight: 700 }}
                                  onClick={() => openConvertDc(r)}
                                  title="1-Click Generate Delivery Challan (DC / Gate Pass)"
                                >
                                  🚛 +DC
                                </button>
                              )}

                              {/* Approvals */}
                              {r.status === 'Submitted' && (user?.role_level >= 3) && (
                                <button style={S.btnSm('#0891b2')} onClick={() => action(r.id, 'approve/l1')} title="L1 Approve — Store Head">✓ L1</button>
                              )}
                              {r.status === 'L1 Approved' && (user?.role_level >= 3) && (
                                <button style={S.btnSm('#7c3aed')} onClick={() => action(r.id, 'approve/l2')} title="L2 Approve — Store Manager">✓ L2</button>
                              )}
                              {['L1 Approved', 'L2 Approved'].includes(r.status) && (user?.role_level >= 4) && (
                                <button style={S.btnSm('#065f46')} onClick={() => action(r.id, 'approve/l3')} title="L3 Approve — Plant Head / MD (Final)">✓ L3 MD</button>
                              )}
                              {['Submitted', 'L1 Approved', 'L2 Approved'].includes(r.status) && (user?.role_level >= 3) && (
                                <button
                                  style={{ ...S.btnSm('#dc2626'), padding: '4px 8px' }}
                                  onClick={async () => {
                                    const reason = window.prompt('Enter rejection reason:')
                                    if (!reason) return
                                    await action(r.id, 'reject', { remarks: reason })
                                  }}
                                  title="Reject this indent and notify requester"
                                >✗ Reject</button>
                              )}

                              {/* Edit available for unissued/uncancelled indents */}
                              {!['Issued', 'Closed', 'Rejected', 'Cancelled'].includes(r.status) && (
                                <button style={S.btnSm('#2563eb')} onClick={() => openEdit(r.id)} title="Edit Indent Items & Details">
                                  ✏️ Edit
                                </button>
                              )}

                              {/* Store Issuance */}
                              {['Submitted', 'Approved', 'Partially Issued'].includes(r.status) && visibleTabs.some(t => t.key === 'issue') && (
                                <button style={S.btnSm('#16a34a')} onClick={() => { openDetail(r.id); setTabKey('issue') }}>
                                  📦 Issue
                                </button>
                              )}


                              {/* Store Manager & Admin Cancellation / Force Delete Dialog */}
                              {(isStore || isElevated || r.raised_by === user?.id) && (
                                <button
                                  style={{ ...S.btnSm(r.status === 'Cancelled' ? '#64748b' : (r.status === 'Issued' || r.status === 'Closed' ? '#b91c1c' : '#ef4444')), padding: '4px 8px' }}
                                  onClick={() => {
                                    setCancelModal({ id: r.id, num: r.indentNumber, deptName: r.deptName, status: r.status })
                                    setCancelReason(r.cancellationReason ? r.cancellationReason.split(' — ')[0] : 'Double Entry / Duplicate Indent')
                                    setCancelNotes(r.cancellationReason && r.cancellationReason.includes(' — ') ? r.cancellationReason.split(' — ').slice(1).join(' — ') : '')
                                  }}
                                  title={r.status === 'Issued' || r.status === 'Closed' ? "Force Delete Indent (Admin / Store Manager)" : "Cancel or Delete Indent with Reason"}
                                >
                                  {r.status === 'Cancelled' ? '🗑️ Purge' : (r.status === 'Issued' || r.status === 'Closed' ? '🗑️ Force Delete' : '🚫 Cancel')}
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>

                        {/* Expanded Technical Breakdown Card */}
                        {isExp && (
                          <tr style={{ background: '#f8fafc' }}>
                            <td colSpan={10} style={{ padding: '14px 20px', borderBottom: '2px solid #cbd5e1' }}>
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginBottom: 10 }}>
                                <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 6, padding: 10 }}>
                                  <span style={S.revLabel}>👤 Indentor Profile</span>
                                  <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', marginTop: 2 }}>{r.raisedBy || r.raisedByName}</div>
                                  <div style={{ fontSize: 11, color: '#64748b' }}>Emp Code: <strong>{r.raisedByEmpCode || '—'}</strong> · {r.raisedByRole || 'Technical Staff'}</div>
                                  {r.raisedByEmail && <div style={{ fontSize: 10, color: '#0f766e' }}>✉️ {r.raisedByEmail}</div>}
                                </div>

                                <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 6, padding: 10 }}>
                                  <span style={S.revLabel}>🏭 Plant &amp; Machine Context</span>
                                  <div style={{ fontSize: 12, fontWeight: 700, color: '#0f172a', marginTop: 2 }}>{r.machineName ? `[${r.machineCode}] ${r.machineName}` : (r.machine_id || 'Plant General')}</div>
                                  <div style={{ fontSize: 11, color: '#64748b' }}>Section: <strong>{r.sectionCode ? `[${r.sectionCode}] ${r.sectionName}` : 'General'}</strong></div>
                                </div>

                                <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 6, padding: 10 }}>
                                  <span style={S.revLabel}>📝 Work Order / Technical Remarks</span>
                                  <div style={{ fontSize: 12, color: '#1e293b', marginTop: 2, lineHeight: 1.4 }}>{r.remarks || 'No general remarks provided.'}</div>
                                </div>

                                {r.status === 'Cancelled' && (
                                  <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, padding: 10 }}>
                                    <span style={{ ...S.revLabel, color: '#dc2626' }}>🚫 Cancellation Reason &amp; Store Audit</span>
                                    <div style={{ fontSize: 12, fontWeight: 700, color: '#b91c1c', marginTop: 2 }}>{r.cancellationReason || 'Requirement cancelled / duplicate entry'}</div>
                                    <div style={{ fontSize: 10, color: '#64748b', marginTop: 3 }}>
                                      Cancelled by <strong>{r.cancelledByName || 'Store Officer'}</strong> {r.cancelledByEmpCode ? `[${r.cancelledByEmpCode}]` : ''} {r.cancelledAt ? `on ${new Date(r.cancelledAt).toLocaleString('en-IN')}` : ''}
                                    </div>
                                  </div>
                                )}
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

          {/* Pagination */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
            <span style={{ fontSize: 12, color: '#64748b' }}>Page {page} of {totalPages || 1}</span>
            <div style={{ display: 'flex', gap: 6 }}>
              <button style={S.btnSm('#ffffff')} disabled={page === 1} onClick={() => setPage(p => p - 1)}>‹ Prev</button>
              <button style={S.btnSm('#ffffff')} disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next ›</button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* ── TAB 2: RAISE / EDIT INDENT (Descriptive Reasons & Machine Context) ─ */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {tabKey === 'raise' && (
        <div style={S.card}>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4, color: '#0f766e' }}>
            {editId ? `✏️ Edit Indent (Voucher #${editId})` : '✨ Raise New Material Indent & Issuance Voucher'}
          </div>
          <div style={{ fontSize: 12, color: '#64748b', marginBottom: 16 }}>
            Specify technical department, required date, plant section, machine context, work order reference, and detailed line item technical justifications.
          </div>

          {/* Indentor Info Banner */}
          <div style={{ background: '#f0fdfa', border: '1px solid #99f6e4', borderRadius: 8, padding: '10px 14px', marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <div style={{ fontSize: 18 }}>👤</div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#0f766e' }}>
                  Indentor: {user?.name || 'Authenticated User'}
                </div>
                <div style={{ fontSize: 11, color: '#64748b' }}>
                  {user?.employee_code ? `Employee Code: ${user.employee_code} · ` : ''}Designation: {user?.role || user?.role_name || 'Staff'} · Department: {user?.department || 'Mill Operations'}
                </div>
              </div>
            </div>
            <div style={{ fontSize: 11, color: '#0f766e', fontWeight: 600 }}>
              📅 {new Date().toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}
            </div>
          </div>

          <form onSubmit={goToReview}>
            {/* ── Downstream Fulfillment Workflow Selector ── */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#0f766e', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>⚡</span> Downstream Fulfillment &amp; Workflow Mode
              </div>
              <div style={{ fontSize: 11, color: '#64748b', marginBottom: 12 }}>
                Select whether this indent will follow the standard approval chain, generate an instant Purchase Order, create an outward Delivery Challan, or issue directly from mill stock.
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                {/* Card 1: Standard PR */}
                <div
                  onClick={() => setForm(f => ({ ...f, fulfillment_mode: 'pr' }))}
                  style={{
                    border: form.fulfillment_mode === 'pr' ? '2px solid #0284c7' : '1px solid #e2e8f0',
                    background: form.fulfillment_mode === 'pr' ? '#f0f9ff' : '#ffffff',
                    borderRadius: 8,
                    padding: '12px 14px',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    boxShadow: form.fulfillment_mode === 'pr' ? '0 2px 8px rgba(2, 132, 199, 0.15)' : 'none'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#0369a1' }}>📋 Standard PR</span>
                    {form.fulfillment_mode === 'pr' && <span style={{ background: '#0284c7', color: '#fff', fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 10 }}>SELECTED</span>}
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#1e293b' }}>Plant Requisition Workflow</div>
                  <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                    Standard multi-tier approval hierarchy (L1 Store → L2 Dept Head → L3 Plant Head) before PO issuance.
                  </div>
                </div>

                {/* Card 2: Direct PO */}
                <div
                  onClick={() => setForm(f => ({ ...f, fulfillment_mode: 'po' }))}
                  style={{
                    border: form.fulfillment_mode === 'po' ? '2px solid #0f766e' : '1px solid #e2e8f0',
                    background: form.fulfillment_mode === 'po' ? '#f0fdfa' : '#ffffff',
                    borderRadius: 8,
                    padding: '12px 14px',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    boxShadow: form.fulfillment_mode === 'po' ? '0 2px 8px rgba(15, 118, 110, 0.15)' : 'none'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#0f766e' }}>🛒 Direct PO</span>
                    {form.fulfillment_mode === 'po' && <span style={{ background: '#0f766e', color: '#fff', fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 10 }}>SELECTED</span>}
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#1e293b' }}>1-Click Procurement Gen</div>
                  <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                    Auto-approves indent and directly generates linked PO with Supplier selection and GST matrix.
                  </div>
                </div>

                {/* Card 3: Direct Cash Purchase */}
                <div
                  onClick={() => setForm(f => ({ ...f, fulfillment_mode: 'cash' }))}
                  style={{
                    border: form.fulfillment_mode === 'cash' ? '2px solid #16a34a' : '1px solid #e2e8f0',
                    background: form.fulfillment_mode === 'cash' ? '#f0fdf4' : '#ffffff',
                    borderRadius: 8,
                    padding: '12px 14px',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    boxShadow: form.fulfillment_mode === 'cash' ? '0 2px 8px rgba(22, 163, 74, 0.15)' : 'none'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#15803d' }}>💵 Cash Purchase</span>
                    {form.fulfillment_mode === 'cash' && <span style={{ background: '#16a34a', color: '#fff', fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 10 }}>SELECTED</span>}
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#1e293b' }}>Spot Procurement &amp; Intake</div>
                  <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                    Instantly increases store stock, generates official Cash Purchase Voucher and paid Finance bill.
                  </div>
                </div>

                {/* Card 4: Immediate Store Issuance */}
                <div
                  onClick={() => setForm(f => ({ ...f, fulfillment_mode: 'issue' }))}
                  style={{
                    border: form.fulfillment_mode === 'issue' ? '2px solid #059669' : '1px solid #e2e8f0',
                    background: form.fulfillment_mode === 'issue' ? '#ecfdf5' : '#ffffff',
                    borderRadius: 8,
                    padding: '12px 14px',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    boxShadow: form.fulfillment_mode === 'issue' ? '0 2px 8px rgba(5, 150, 105, 0.15)' : 'none'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#047857' }}>📦 Store Issue (SIV)</span>
                    {form.fulfillment_mode === 'issue' && <span style={{ background: '#059669', color: '#fff', fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 10 }}>SELECTED</span>}
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#1e293b' }}>Immediate In-Stock Issue</div>
                  <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                    Directly deducts stock from mill store, writes to stock ledger, and generates official SIV Voucher.
                  </div>
                </div>

                {/* Card 5: Direct DC */}
                <div
                  onClick={() => setForm(f => ({ ...f, fulfillment_mode: 'dc' }))}
                  style={{
                    border: form.fulfillment_mode === 'dc' ? '2px solid #d97706' : '1px solid #e2e8f0',
                    background: form.fulfillment_mode === 'dc' ? '#fffbeb' : '#ffffff',
                    borderRadius: 8,
                    padding: '12px 14px',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    boxShadow: form.fulfillment_mode === 'dc' ? '0 2px 8px rgba(217, 119, 6, 0.15)' : 'none'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#b45309' }}>🚛 Delivery Challan (DC)</span>
                    {form.fulfillment_mode === 'dc' && <span style={{ background: '#d97706', color: '#fff', fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 10 }}>SELECTED</span>}
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#1e293b' }}>Outward Dispatch Gate Pass</div>
                  <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                    Generates Outward / Returnable Delivery Challan &amp; Gate Pass for job work, repair or transfer.
                  </div>
                </div>
              </div>
            </div>

            {/* ── Contextual Configuration: DIRECT PO ── */}
            {form.fulfillment_mode === 'po' && (
              <div style={{ background: '#f0fdfa', border: '1px solid #99f6e4', borderRadius: 8, padding: 14, marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#0f766e', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>🛒</span> Direct Purchase Order (PO) Details &amp; Commercial Terms
                </div>
                <div style={S.grid3}>
                  <label style={S.lbl}>Assign Vendor / Supplier *</label>
                    <SearchableSelect
                      value={String(form.vendor_id || '')}
                      onChange={v => setForm(f => ({ ...f, vendor_id: v }))}
                      placeholder="-- Select Vendor / Supplier --"
                      searchPlaceholder="Type vendor name, GSTIN, city..."
                      selectStyle={formErrors.vendor_id ? { border: '1px solid #ef4444' } : {}}
                      options={vendors.map(v => ({
                        value: String(v.id),
                        label: v.name,
                        code: v.code,
                        subtext: [v.gstin ? `GST: ${v.gstin}` : '', v.city || ''].filter(Boolean).join(' · ')
                      }))}
                    />
                    {formErrors.vendor_id && <span style={{ fontSize: 10, color: '#ef4444' }}>{formErrors.vendor_id}</span>}
                  <label style={S.lbl}>Payment Terms</label>
                    <SearchableSelect
                      value={form.payment_terms || 'Net 30 Days'}
                      onChange={v => setForm(f => ({ ...f, payment_terms: v }))}
                      placeholder="Select payment terms..."
                      options={[
                        { value: 'Net 30 Days', label: 'Net 30 Days' },
                        { value: 'Net 15 Days', label: 'Net 15 Days' },
                        { value: 'Net 45 Days', label: 'Net 45 Days' },
                        { value: 'Immediate / COD', label: 'Immediate / COD' },
                        { value: '100% Advance', label: '100% Advance' },
                        { value: '50% Advance, 50% on Delivery', label: '50% Advance, 50% on Delivery' }
                      ]}
                    />
                  <label style={S.lbl}>Expected Delivery Date
                    <input
                      type="date"
                      style={S.inp}
                      value={form.delivery_date || form.required_date}
                      onChange={e => setForm(f => ({ ...f, delivery_date: e.target.value }))}
                    />
                  </label>
                </div>
              </div>
            )}

            {/* ── Contextual Configuration: CASH PURCHASE ── */}
            {form.fulfillment_mode === 'cash' && (
              <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8, padding: 14, marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#166534', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>💵</span> Spot Cash Purchase &amp; Local Vendor Details (Direct Stock Intake)
                </div>
                <div style={S.grid3}>
                  <label style={S.lbl}>Supplier / Shop Name *
                    <input
                      style={{ ...S.inp, ...(formErrors.vendor_name ? { border: '1px solid #ef4444' } : {}) }}
                      placeholder="e.g. Local Hardware &amp; Bearing Mart"
                      value={form.vendor_name}
                      onChange={e => setForm(f => ({ ...f, vendor_name: e.target.value }))}
                    />
                    {formErrors.vendor_name && <span style={{ fontSize: 10, color: '#ef4444' }}>{formErrors.vendor_name}</span>}
                  </label>
                  <label style={S.lbl}>Vendor GSTIN (Optional)
                    <input
                      style={S.inp}
                      placeholder="29AAAAA0000A1Z5 (or blank for cash vendor)"
                      value={form.vendor_gstin}
                      onChange={e => setForm(f => ({ ...f, vendor_gstin: e.target.value }))}
                    />
                  </label>
                  <label style={S.lbl}>Cash Memo / Receipt No
                    <input
                      style={S.inp}
                      placeholder="e.g. CASH-MEMO-882"
                      value={form.invoice_number}
                      onChange={e => setForm(f => ({ ...f, invoice_number: e.target.value }))}
                    />
                  </label>
                </div>
                <div style={{ ...S.grid3, marginTop: 8 }}>
                  <label style={S.lbl}>Payment Mode</label>
                    <SearchableSelect
                      value={form.payment_mode || 'Cash'}
                      onChange={v => setForm(f => ({ ...f, payment_mode: v }))}
                      placeholder="Select payment mode..."
                      options={[
                        { value: 'Cash', label: 'Cash' },
                        { value: 'Petty Cash', label: 'Petty Cash' },
                        { value: 'UPI / GPay / PhonePe', label: 'UPI / GPay / PhonePe' },
                        { value: 'Company Debit Card', label: 'Company Debit Card' },
                        { value: 'Bank Transfer (IMPS)', label: 'Bank Transfer (IMPS)' }
                      ]}
                    />
                  <label style={S.lbl}>Payment Ref / Voucher No
                    <input
                      style={S.inp}
                      placeholder="e.g. UPI-REF-992384 or PC-VOUCHER-12"
                      value={form.payment_ref}
                      onChange={e => setForm(f => ({ ...f, payment_ref: e.target.value }))}
                    />
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', padding: '14px 10px', background: '#ffffff', borderRadius: 6, border: '1px solid #bbf7d0', fontSize: 11, color: '#166534', fontWeight: 600 }}>
                    ✓ Materials will be immediately credited to Central Store inventory upon submission.
                  </div>
                </div>
              </div>
            )}

            {/* ── Contextual Configuration: DELIVERY CHALLAN (DC / GATE PASS) ── */}
            {form.fulfillment_mode === 'dc' && (
              <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: 14, marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#b45309', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>🚛</span> Delivery Challan (DC / Gate Pass) Dispatch Details
                </div>
                <div style={S.grid3}>
                  <label style={S.lbl}>Gate Pass / DC Type *</label>
                    <SearchableSelect
                      value={form.dc_type || 'MATERIAL_OUT'}
                      onChange={v => setForm(f => ({ ...f, dc_type: v }))}
                      placeholder="Select DC type..."
                      options={[
                        { value: 'MATERIAL_OUT', label: 'Material Outward DC (Non-Returnable)' },
                        { value: 'RETURNABLE', label: 'Returnable Gate Pass (Job Work / Repair)' },
                        { value: 'OUT', label: 'Outward Vehicle & Goods Dispatch' }
                      ]}
                    />
                  <label style={S.lbl}>Consignee / Destination Party Name *
                    <input
                      style={{ ...S.inp, ...(formErrors.to_party ? { border: '1px solid #ef4444' } : {}) }}
                      placeholder="e.g. Apex Engineering Works, Hubli"
                      value={form.to_party}
                      onChange={e => setForm(f => ({ ...f, to_party: e.target.value }))}
                    />
                    {formErrors.to_party && <span style={{ fontSize: 10, color: '#ef4444' }}>{formErrors.to_party}</span>}
                  </label>
                  <label style={S.lbl}>Vehicle Number
                    <input
                      style={S.inp}
                      placeholder="e.g. KA-25-AB-1234"
                      value={form.vehicle_number}
                      onChange={e => setForm(f => ({ ...f, vehicle_number: e.target.value }))}
                    />
                  </label>
                </div>
                <div style={{ ...S.grid3, marginTop: 8 }}>
                  <label style={S.lbl}>Vehicle Type</label>
                    <SearchableSelect
                      value={form.vehicle_type || 'Truck'}
                      onChange={v => setForm(f => ({ ...f, vehicle_type: v }))}
                      placeholder="Select vehicle type..."
                      options={[
                        { value: 'Truck', label: 'Truck / Lorry' },
                        { value: 'Tempo', label: 'Tempo / Mini Truck' },
                        { value: 'Pickup', label: 'Pickup Van' },
                        { value: 'Tractor', label: 'Tractor' },
                        { value: 'Hand Carry', label: 'Hand Carry / Courier' }
                      ]}
                    />
                  <label style={S.lbl}>Driver / Handover Person
                    <input
                      style={S.inp}
                      placeholder="e.g. Ramesh Kumar"
                      value={form.driver_name}
                      onChange={e => setForm(f => ({ ...f, driver_name: e.target.value }))}
                    />
                  </label>
                  <label style={S.lbl}>DC Technical Purpose
                    <input
                      style={S.inp}
                      placeholder="e.g. Dynamic Roll Balancing & Rubber Lining"
                      value={form.dc_purpose}
                      onChange={e => setForm(f => ({ ...f, dc_purpose: e.target.value }))}
                    />
                  </label>
                </div>
                {form.dc_type === 'RETURNABLE' && (
                  <div style={{ ...S.grid3, marginTop: 8 }}>
                    <label style={S.lbl}>Expected Return Date
                      <input
                        type="date"
                        style={S.inp}
                        value={form.expected_return_date}
                        onChange={e => setForm(f => ({ ...f, expected_return_date: e.target.value }))}
                      />
                    </label>
                    <div style={{ gridColumn: 'span 2', display: 'flex', alignItems: 'center', padding: '10px', background: '#fef3c7', borderRadius: 6, fontSize: 11, color: '#92400e' }}>
                      ⚠ Returnable Gate Pass — track this date to flag overdue job-work / repair returns.
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── Contextual Configuration: IMMEDIATE STORE ISSUANCE ── */}
            {form.fulfillment_mode === 'issue' && (
              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: 14, marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#15803d', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>📦</span> Immediate Store Issuance (SIV) Notice
                </div>
                <div style={{ fontSize: 11, color: '#166534', marginTop: 4 }}>
                  Submitting this form will automatically deduct the required quantities directly from mill store stock and generate an official SIV issue voucher. Ensure sufficient physical stock is verified.
                </div>
              </div>
            )}

            <div style={S.grid3}>
              <div>
                <label style={S.lbl}>Department *</label>
                <SearchableSelect
                  id="raise-dept"
                  value={String(form.department_id || '')}
                  onChange={v => setForm(f => ({ ...f, department_id: v }))}
                  placeholder="-- Select Department --"
                  searchPlaceholder="Type department name or code..."
                  selectStyle={formErrors.department_id ? { border: '1px solid #ef4444' } : {}}
                  disabled={user?.role_level < 4 && user?.dept_code !== 'STORE'}
                  options={depts.map(d => ({ value: String(d.id), label: d.name, code: d.code }))}
                />
                {formErrors.department_id && <span style={{ fontSize: 10, color: '#ef4444' }}>{formErrors.department_id}</span>}
              </div>

              <div>
                <label style={S.lbl}>Required By Date *
                  <input
                    id="raise-required-date"
                    style={{ ...S.inp, ...(formErrors.required_date ? { border: '1px solid #ef4444' } : {}) }}
                    type="date"
                    value={form.required_date}
                    onChange={e => setForm(f => ({ ...f, required_date: e.target.value }))}
                    required
                  />
                </label>
                {formErrors.required_date && <span style={{ fontSize: 10, color: '#ef4444' }}>{formErrors.required_date}</span>}
              </div>

              <div>
                <label style={S.lbl}>General Remarks / Work Order Ref
                  <input
                    id="raise-remarks"
                    style={S.inp}
                    placeholder="e.g. WO-2026-0815: Breakdown / Emergency repair"
                    value={form.remarks}
                    onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))}
                  />
                </label>
              </div>
            </div>

            {/* ── Synchronized Plant Section & Machinery Allocation (Digital Twin Context) ── */}
            <div style={{ background: '#f8fafc', border: formErrors.section ? '1.5px solid #ef4444' : '1px solid #cbd5e1', borderRadius: 8, padding: '14px 16px', marginTop: 14, marginBottom: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#0f766e', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 16 }}>🏭</span>
                  <span>Plant Section &amp; Machinery Allocation (Digital Twin Roll &amp; Bearing Context)</span>
                  <span style={{ color: '#dc2626', fontWeight: 800 }}>*</span>
                </div>
                <span style={{ fontSize: 11, color: '#64748b', fontWeight: 500 }}>
                  Filters 725 roll specs &amp; bearings based on selected plant section
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
                {/* 1. Plant Section */}
                <div>
                  <label style={S.lbl}>Plant Section / Process Area *</label>
                  <SearchableSelect
                    id="raise-section"
                    value={String(form.section || form.section_id || '')}
                    onChange={v => {
                      setForm(f => ({ ...f, section: v, section_id: v }))
                    }}
                    placeholder="-- Select Plant Section --"
                    searchPlaceholder="Type section name or code (Wire/Press/Boiler)..."
                    allowClear={true}
                    selectStyle={formErrors.section ? { border: '1px solid #ef4444' } : {}}
                    options={sections.map(s => {
                      const icon = s.icon || '🏭'
                      return {
                        value: String(s.id),
                        label: `${icon} ${s.name || s.sectionCode || s.code}`,
                        code: s.sectionCode || s.code || '',
                        subtext: s.deptName ? `${s.deptName} [${s.sectionCode || s.code}]` : `[${s.sectionCode || s.code}]`
                      }
                    })}
                  />
                  {formErrors.section && <span style={{ fontSize: 10, color: '#ef4444' }}>{formErrors.section}</span>}
                </div>

                {/* 2. Target Machine Unit */}
                <div>
                  <label style={S.lbl}>Target Machine Unit</label>
                  <SearchableSelect
                    id="raise-machine"
                    value={String(form.machine_id || '')}
                    onChange={v => setForm(f => ({ ...f, machine_id: v }))}
                    placeholder="-- Select Registered Machine --"
                    searchPlaceholder="Type machine name or code (PM1/PM2)..."
                    allowClear={true}
                    options={machines.map(m => ({
                      value: String(m.id),
                      label: `⚡ ${m.name}`,
                      code: m.code,
                      subtext: m.capacity_tpd ? `${m.capacity_tpd} TPD • ${m.type || 'Machine'}` : (m.type || 'Machine')
                    }))}
                  />
                </div>

                {/* 3. Specific Roll / Machinery Equipment */}
                <div>
                  <label style={S.lbl}>Machinery Roll / Equipment</label>
                  <SearchableSelect
                    id="raise-equipment"
                    value={String(form.section_equipment_id || '')}
                    onChange={v => {
                      const eq = sectionEquipment.find(e => String(e.id) === String(v))
                      setForm(f => {
                        const upd = { ...f, section_equipment_id: v }
                        if (eq) {
                          if (eq.sectionId || eq.section_id) {
                            upd.section = String(eq.sectionId || eq.section_id)
                            upd.section_id = String(eq.sectionId || eq.section_id)
                          }
                          if (eq.machineId || eq.machine_id) {
                            upd.machine_id = String(eq.machineId || eq.machine_id)
                          }
                          if (f.items && f.items.length > 0 && !f.items[0].component_position) {
                            const updatedItems = [...f.items]
                            updatedItems[0] = {
                              ...updatedItems[0],
                              component_position: `${eq.tagName ? `[${eq.tagName}] ` : ''}${eq.equipmentName || eq.name}`
                            }
                            upd.items = updatedItems
                          }
                        }
                        return upd
                      })
                    }}
                    placeholder="-- Select Roll / Assembly --"
                    searchPlaceholder="Search roll, bearing (e.g. 23234K), belt..."
                    allowClear={true}
                    options={sectionEquipment
                      .filter(eq => {
                        if (!form.section) return true
                        return String(eq.sectionId || eq.section_id) === String(form.section)
                      })
                      .map(eq => {
                        const specs = [
                          eq.bearingSize ? `Brg: ${eq.bearingSize}` : null,
                          eq.beltNo ? `Belt: ${eq.beltNo}` : null,
                          eq.shaftSize ? `Shaft: ${eq.shaftSize}` : null
                        ].filter(Boolean).join(' | ')
                        return {
                          value: String(eq.id),
                          label: `⚙️ ${eq.equipmentName || eq.name}`,
                          code: eq.tagName || '',
                          subtext: specs || (eq.sectionCode ? `[${eq.sectionCode}]` : '')
                        }
                      })
                    }
                  />
                </div>
              </div>

              {/* Digital Twin Fitment Preview if an equipment is selected */}
              {form.section_equipment_id && (() => {
                const eq = sectionEquipment.find(e => String(e.id) === String(form.section_equipment_id))
                if (!eq) return null
                return (
                  <div style={{ marginTop: 10, background: '#f0fdfa', border: '1px solid #ccfbf1', borderRadius: 6, padding: '8px 12px', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 15 }}>⚙️</span>
                      <div>
                        <strong style={{ color: '#0f766e' }}>{eq.equipmentName}</strong>
                        {eq.tagName && <code style={{ marginLeft: 6, background: '#e0f2fe', color: '#0369a1', padding: '1px 5px', borderRadius: 3, fontWeight: 700 }}>{eq.tagName}</code>}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, fontSize: 11, color: '#334155', flexWrap: 'wrap' }}>
                      {eq.bearingSize && <span style={{ background: '#ffffff', border: '1px solid #99f6e4', padding: '2px 6px', borderRadius: 4 }}>Bearing: <strong>{eq.bearingSize}</strong></span>}
                      {eq.lockNut && <span style={{ background: '#ffffff', border: '1px solid #99f6e4', padding: '2px 6px', borderRadius: 4 }}>Nut: <strong>{eq.lockNut}</strong></span>}
                      {eq.washer && <span style={{ background: '#ffffff', border: '1px solid #99f6e4', padding: '2px 6px', borderRadius: 4 }}>Washer: <strong>{eq.washer}</strong></span>}
                      {eq.beltNo && <span style={{ background: '#ffffff', border: '1px solid #99f6e4', padding: '2px 6px', borderRadius: 4 }}>Belt: <strong>{eq.beltNo}</strong></span>}
                      {eq.shaftSize && <span style={{ background: '#ffffff', border: '1px solid #99f6e4', padding: '2px 6px', borderRadius: 4 }}>Shaft: <strong>{eq.shaftSize}</strong></span>}
                    </div>
                  </div>
                )
              })()}
            </div>

            {/* Line Items Container */}
            <div style={{ fontSize: 13, fontWeight: 700, color: '#0f766e', marginTop: 20, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Line Items &amp; Technical Specifications
            </div>

            {form.items.map((it, i) => {
              const mat = matByID(it.material_id)
              const price = it.unit_price !== '' && it.unit_price !== undefined ? parseFloat(it.unit_price) : matPrice(mat)
              const filtered = mats.filter(m => {
                const q = (matSearch[i] || '').toLowerCase()
                if (!q) return true
                const secMatch = m.sections ? m.sections.some(s => (s.name || s.sectionCode || '').toLowerCase().includes(q)) : false
                const eqMatch = m.equipment ? m.equipment.some(e => (e.equipmentName || e.tagName || '').toLowerCase().includes(q)) : false
                return (
                  (m.name || '').toLowerCase().includes(q) ||
                  (m.code || '').toLowerCase().includes(q) ||
                  (m.sectionName || '').toLowerCase().includes(q) ||
                  (m.machineName || '').toLowerCase().includes(q) ||
                  secMatch ||
                  eqMatch
                )
              }).slice(0, 50)

              return (
                <div key={i} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 14, marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#0f766e' }}>Line Item #{i + 1}</div>
                    {form.items.length > 1 && (
                      <button
                        type="button"
                        style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}
                        onClick={() => removeItem(i)}
                      >
                        ✕ Remove Item
                      </button>
                    )}
                  </div>

                  <div style={S.grid3}>
                    {/* Material Dropdown Search */}
                    <div style={{ position: 'relative' }}>
                      <label style={S.lbl}>Material / Spare Part *
                        <input
                          style={{ ...S.inp, ...(formErrors.items?.[i]?.material_id ? { border: '1px solid #ef4444' } : {}) }}
                          placeholder="🔍 Search name, code, section (Wire/Press/Boiler), machine..."
                          value={matSearch[i] !== undefined ? matSearch[i] : (mat ? `${mat.name} [${mat.code}]` : '')}
                          onFocus={() => setMatDropOpen(d => ({ ...d, [i]: true }))}
                          onChange={e => {
                            setMatSearch(s => ({ ...s, [i]: e.target.value }))
                            setMatDropOpen(d => ({ ...d, [i]: true }))
                          }}
                          onBlur={() => setTimeout(() => setMatDropOpen(d => ({ ...d, [i]: false })), 200)}
                        />
                      </label>
                      {formErrors.items?.[i]?.material_id && <span style={{ fontSize: 10, color: '#ef4444' }}>{formErrors.items[i].material_id}</span>}

                      {matDropOpen[i] && (
                        <div style={{ ...S.dropMenu, maxHeight: 260, overflowY: 'auto' }}>
                          {filtered.length === 0 ? (
                            <div style={{ padding: '10px 14px', fontSize: 12, color: '#94a3b8', textAlign: 'center' }}>
                              No matching materials or parts found
                            </div>
                          ) : filtered.map(m => {
                            const mSecs = Array.isArray(m.sections) && m.sections.length > 0 ? m.sections : []
                            const mEquips = Array.isArray(m.equipment) && m.equipment.length > 0 ? m.equipment : []
                            return (
                              <div
                                key={m.id}
                                onMouseDown={() => {
                                  setItem(i, 'material_id', m.id)
                                  setItem(i, 'uom', m.uom || 'NOS')
                                  setItem(i, 'unit_price', m.unit_price != null ? parseFloat(m.unit_price) : '')
                                  setMatSearch(s => ({ ...s, [i]: `${m.name} [${m.code}]` }))
                                  setMatDropOpen(d => ({ ...d, [i]: false }))

                                  // Auto-sync Plant Section and Machine if currently unset
                                  setForm(f => {
                                    const upd = { ...f }
                                    if (!f.section && m.section_id) {
                                      upd.section = String(m.section_id)
                                      upd.section_id = String(m.section_id)
                                    }
                                    if (!f.machine_id && m.machine_id) {
                                      upd.machine_id = String(m.machine_id)
                                    }
                                    return upd
                                  })

                                  // Auto-set component position if roll mapped
                                  const mEq = Array.isArray(m.equipment) && m.equipment.length > 0 ? m.equipment[0] : null
                                  if (mEq && !it.component_position) {
                                    setItem(i, 'component_position', `${mEq.tagName ? `[${mEq.tagName}] ` : ''}${mEq.equipmentName || mEq.name}`)
                                  }
                                }}
                                style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 12, borderBottom: '1px solid #f1f5f9' }}
                              >
                                <div style={{ fontWeight: 600, color: '#0f172a' }}>{m.name}</div>
                                <div style={{ fontSize: 10, color: '#64748b', display: 'flex', gap: 8, marginTop: 2, flexWrap: 'wrap', alignItems: 'center' }}>
                                  <span style={{ fontFamily: 'monospace', color: '#0f766e', fontWeight: 700 }}>[{m.code}]</span>
                                  <span>Stock: <strong style={{ color: m.current_stock > 0 ? '#16a34a' : '#dc2626' }}>{m.current_stock} {m.uom}</strong></span>
                                  <span>Rate: ₹{Number(m.unit_price || 0).toFixed(2)}</span>
                                  {mSecs.length > 0 ? (
                                    <span style={{ color: '#0f766e', fontWeight: 700, background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '1px 5px', borderRadius: 3 }}>
                                      🏭 {mSecs.map(s => s.sectionCode || s.name).join(', ')}
                                    </span>
                                  ) : m.sectionName ? (
                                    <span style={{ color: '#0f766e', fontWeight: 600, background: '#f0fdf4', padding: '1px 5px', borderRadius: 3 }}>
                                      🏭 {m.sectionName}
                                    </span>
                                  ) : null}
                                  {mEquips.length > 0 && (
                                    <span style={{ color: '#475569', background: '#f8fafc', border: '1px solid #e2e8f0', padding: '1px 5px', borderRadius: 3 }}>
                                      ⚙️ {mEquips.map(e => e.equipmentName).join(', ')}
                                    </span>
                                  )}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>

                    {/* Qty & UOM */}
                    <div style={{ display: 'flex', gap: 6 }}>
                      <label style={{ ...S.lbl, flex: 1 }}>Required Qty *
                        <input
                          style={{ ...S.inp, ...(formErrors.items?.[i]?.required_qty ? { border: '1px solid #ef4444' } : {}) }}
                          type="number"
                          step="0.001"
                          min="0.001"
                          value={it.required_qty}
                          onChange={e => setItem(i, 'required_qty', e.target.value)}
                          placeholder="e.g. 2"
                        />
                      </label>
                      <label style={{ ...S.lbl, width: 80 }}>UOM
                        <input style={{ ...S.inp, background: '#e2e8f0', color: '#334155' }} value={it.uom || mat?.uom || 'NOS'} readOnly />
                      </label>
                    </div>

                    {/* Reason Code */}
                    <label style={S.lbl}>Reason Code</label>
                      <SearchableSelect
                        value={it.reason_code || 'Routine Replacement'}
                        onChange={v => setItem(i, 'reason_code', v)}
                        placeholder="Select reason code..."
                        searchPlaceholder="Type reason (Emergency, PM, etc.)"
                        options={REASON_CODES.map(r => ({ value: r, label: r }))}
                      />
                  </div>

                  <div style={{ ...S.grid3, marginTop: 8 }}>
                    <label style={S.lbl}>Unit Rate (INR)
                      <input
                        style={S.inp}
                        type="number"
                        step="0.01"
                        placeholder="Estimated Unit Price"
                        value={it.unit_price !== undefined ? it.unit_price : (mat?.unit_price || '')}
                        onChange={e => setItem(i, 'unit_price', e.target.value)}
                      />
                    </label>

                    {form.fulfillment_mode === 'po' && (
                      <label style={S.lbl}>GST Rate (%)</label>
                    )}{form.fulfillment_mode === 'po' && (
                        <SearchableSelect
                          value={String(it.gst_pct != null ? it.gst_pct : 18)}
                          onChange={v => setItem(i, 'gst_pct', Number(v))}
                          placeholder="Select GST slab..."
                          options={[
                            { value: '0', label: '0% (Nil / Exempted)' },
                            { value: '5', label: '5% GST (2.5% CGST + 2.5% SGST)' },
                            { value: '12', label: '12% GST (6% CGST + 6% SGST)' },
                            { value: '18', label: '18% GST (9% CGST + 9% SGST)' },
                            { value: '28', label: '28% GST (14% CGST + 14% SGST)' }
                          ]}
                        />
                    )}

                    <label style={S.lbl}>Position / Mechanical Fitment Location
                      <input
                        style={S.inp}
                        placeholder="e.g. [WIRE-MCN-001] Top Wire Guide Roll #1, Drive Side Housing..."
                        value={it.component_position}
                        onChange={e => setItem(i, 'component_position', e.target.value)}
                        list={`equip-pos-list-${i}`}
                      />
                      <datalist id={`equip-pos-list-${i}`}>
                        {sectionEquipment
                          .filter(eq => {
                            if (!form.section) return true
                            return String(eq.sectionId || eq.section_id) === String(form.section)
                          })
                          .map(eq => (
                            <option key={eq.id} value={`${eq.tagName ? `[${eq.tagName}] ` : ''}${eq.equipmentName || eq.name}`}>
                              {eq.bearingSize ? `Bearing: ${eq.bearingSize}` : ''}
                            </option>
                          ))
                        }
                      </datalist>
                    </label>
                  </div>

                  <div style={{ marginTop: 8 }}>
                    <label style={S.lbl}>Technical Purpose / Failure Observations (Descriptive Reason)
                      <textarea
                        style={{ ...S.inp, minHeight: 36, resize: 'vertical' }}
                        placeholder="e.g. High vibration (8.4 mm/s) & unusual screeching noise observed during shift 2. Immediate replacement required."
                        value={it.purpose}
                        onChange={e => setItem(i, 'purpose', e.target.value)}
                        rows={2}
                      />
                    </label>
                  </div>

                  {/* Calculated Line Valuation */}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 14, marginTop: 8, fontSize: 12, color: '#64748b' }}>
                    <div>Unit Rate: <strong style={{ color: '#0f172a' }}>{fmt(price)}</strong></div>
                    <div>Est. Line Value: <strong style={{ color: '#0f766e', fontSize: 13 }}>{fmt(lineTotal(it))}</strong></div>
                  </div>
                </div>
              )
            })}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 14, padding: '12px 0', borderTop: '1px solid #e2e8f0' }}>
              <button
                type="button"
                style={{ background: '#0f766e', color: '#ffffff', border: 'none', borderRadius: 6, padding: '8px 16px', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}
                onClick={addItem}
              >
                ＋ Add Another Item
              </button>
              <div style={{ fontSize: 14, color: '#1e293b' }}>
                Estimated Grand Total: <strong style={{ color: '#0f766e', fontSize: 18 }}>{fmt(grandTotal)}</strong>
                <span style={{ color: '#64748b', fontSize: 12, marginLeft: 8 }}>({form.items.length} items)</span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
              <button
                type="button"
                style={S.btnSecondary}
                onClick={() => { setForm(blankForm()); setEditId(null); setReviewMode(false); setFormErrors({}); setTabKey('list') }}
              >
                Cancel
              </button>
              <button id="btn-submit-raise" type="submit" style={S.btnPrimary}>
                👁 Review &amp; Confirm ({form.fulfillment_mode.toUpperCase()})
              </button>
            </div>
          </form>

          {/* ══════════════════════════════════════════════════════════════════ */}
          {/* ── LIVE RAISED INDENTS HISTORY UNDER RAISE FORM ───────────────── */}
          {/* ══════════════════════════════════════════════════════════════════ */}
          <div style={{ marginTop: 32, borderTop: '2px solid #0f766e', paddingTop: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 800, color: '#0f766e', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>📋</span> Raised Indents &amp; Requisition Register ({total || rows.length} Total)
                </div>
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                  Live tracking of all indents raised across departments with instant PO / DC / Cash conversion and voucher printing.
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <input
                  style={{ ...S.inp, width: 220, fontSize: 12, padding: '6px 10px' }}
                  placeholder="🔍 Quick filter indents..."
                  value={raiseSearch}
                  onChange={e => setRaiseSearch(e.target.value)}
                />
                <button
                  type="button"
                  style={{ ...S.btnSm('#0f766e'), padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 4 }}
                  onClick={load}
                  title="Reload Indents"
                >
                  ↻ Refresh
                </button>
                <button
                  type="button"
                  style={{ ...S.btnSm('#1e293b'), padding: '6px 12px' }}
                  onClick={() => setTabKey('list')}
                  title="Switch to Full Register View"
                >
                  View Full Grid ➔
                </button>
              </div>
            </div>

            <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: 8, background: '#ffffff' }}>
              <table style={S.tbl}>
                <thead>
                  <tr>
                    {['Indent #', 'Date & Time', 'Dept / Section', 'Machine Context', 'Primary Reason & Purpose', 'Items', 'Valuation (₹)', 'Status & Fulfillment', 'Actions'].map(h => (
                      <th key={h} style={S.th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows
                    .filter(r => !raiseSearch || (r.indentNumber||'').toLowerCase().includes(raiseSearch.toLowerCase()) || (r.deptName||'').toLowerCase().includes(raiseSearch.toLowerCase()) || (r.raisedByName||'').toLowerCase().includes(raiseSearch.toLowerCase()) || (r.reasonCode||'').toLowerCase().includes(raiseSearch.toLowerCase()) || (r.machineName||'').toLowerCase().includes(raiseSearch.toLowerCase()))
                    .slice(0, 25)
                    .map((r) => {
                    const rc = REASON_COLORS[r.reasonCode] || { bg: '#f1f5f9', color: '#475569', border: '#cbd5e1', icon: '📝' }
                    return (
                      <tr key={r.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={S.td}>
                          <span
                            style={{ ...S.code, cursor: 'pointer', textDecoration: 'underline', color: '#0f766e', fontWeight: 800 }}
                            onClick={() => openDetail(r.id)}
                            title="Click to view full indent voucher and audit trail"
                          >
                            {r.indentNumber}
                          </span>
                        </td>
                        <td style={S.td}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: '#0f172a' }}>{r.date?.slice(0, 10)}</div>
                          <div style={{ fontSize: 10, color: '#64748b' }}>by {r.raisedByName || r.raisedBy || 'Staff'}</div>
                        </td>
                        <td style={S.td}>
                          <div style={{ fontWeight: 700, color: '#0f172a' }}>{r.deptName || '—'}</div>
                          <div style={{ fontSize: 10, color: '#64748b' }}>{r.sectionCode ? `[${r.sectionCode}] ${r.sectionName || ''}` : 'Plant Area'}</div>
                        </td>
                        <td style={S.td}>
                          <div style={{ fontSize: 11, color: '#334155' }}>
                            {r.machineName ? `[${r.machineCode}] ${r.machineName}` : (r.machine_id || 'General Spares')}
                          </div>
                        </td>
                        <td style={S.td}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: rc.bg, color: rc.color, border: `1px solid ${rc.border}`, borderRadius: 12, padding: '2px 8px', fontSize: 10, fontWeight: 700 }}>
                            <span>{rc.icon}</span> {r.reasonCode || 'Routine Replacement'}
                          </div>
                          {r.itemPurpose && <div style={{ fontSize: 11, color: '#475569', marginTop: 2, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.itemPurpose}</div>}
                        </td>
                        <td style={S.td}>
                          <span style={{ fontWeight: 700, color: '#0f766e' }}>{r.itemCount || 1}</span> <span style={{ fontSize: 11, color: '#64748b' }}>items</span>
                        </td>
                        <td style={S.td}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: '#0f766e' }}>
                            {r.total_value > 0 ? fmt(r.total_value) : '—'}
                          </span>
                        </td>
                        <td style={S.td}>
                          <span style={S.badge(SC[r.status] || '#94a3b8')}>{r.status}</span>
                          {r.linkedPoNumber && <div style={{ fontSize: 10, color: '#0369a1', fontWeight: 600, marginTop: 2 }}>PO: {r.linkedPoNumber}</div>}
                          {r.linkedCpNumber && <div style={{ fontSize: 10, color: '#16a34a', fontWeight: 600, marginTop: 2 }}>Cash: {r.linkedCpNumber}</div>}
                          {r.linkedGpNumber && <div style={{ fontSize: 10, color: '#d97706', fontWeight: 600, marginTop: 2 }}>DC: {r.linkedGpNumber}</div>}
                        </td>
                        <td style={S.td}>
                          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
                            <button
                              type="button"
                              style={{ ...S.btnSm('#0f766e'), padding: '3px 7px', fontSize: 11, fontWeight: 800 }}
                              onClick={() => openA3IndentPrint(r)}
                              title="Print Official A3 GST Commercial Voucher"
                            >
                              🖨️ A3
                            </button>
                            <button
                              type="button"
                              style={{ ...S.btnSm('#1e293b'), padding: '3px 6px', fontSize: 11 }}
                              onClick={() => openDetail(r.id)}
                              title="View Indent Details & Full Audit Trail"
                            >
                              👁 View
                            </button>
                            {['Issued', 'Partially Issued', 'Approved'].includes(r.status) && (
                              <button
                                type="button"
                                style={{ ...S.btnSm('#16a34a'), padding: '3px 7px', fontSize: 11, fontWeight: 800 }}
                                onClick={() => {
                                  setReceiverSignModal(r)
                                  setReceiverSignForm({
                                    receiver_name: user?.name || '',
                                    receiver_emp_code: user?.employee_code || '',
                                    receiver_signature_note: 'Received and verified in department',
                                    fitment_date: new Date().toISOString().slice(0, 10),
                                    fitment_location: '',
                                    observations: ''
                                  })
                                }}
                                title="Department Receiver Sign-off & Handover"
                              >
                                ✍️ Sign
                              </button>
                            )}
                            {['Submitted', 'L1 Approved'].includes(r.status) && ((user?.role_level || 1) >= 3 || user?.dept_code === 'STORE') && (
                              <button
                                type="button"
                                style={{ ...S.btnSm('#7c3aed'), padding: '3px 7px', fontSize: 11, fontWeight: 800 }}
                                onClick={() => action(r.id, 'l2_approve')}
                                title="Store Manager Direct Approval"
                              >
                                🛡️ SM Approve
                              </button>
                            )}
                            {!['Issued', 'Closed', 'Rejected', 'Cancelled'].includes(r.status) && (
                              <button
                                type="button"
                                style={{ ...S.btnSm('#2563eb'), padding: '3px 6px', fontSize: 11 }}
                                onClick={() => openEdit(r.id)}
                                title="Edit this Indent"
                              >
                                ✏️ Edit
                              </button>
                            )}
                            {!r.linkedPoId && !['Rejected', 'Cancelled', 'Issued', 'Closed'].includes(r.status) && (
                              <button
                                type="button"
                                style={{ ...S.btnSm('#0284c7'), padding: '3px 6px', fontSize: 11, fontWeight: 700 }}
                                onClick={() => openConvertPo(r)}
                                title="1-Click Convert Indent to Purchase Order"
                              >
                                🛒 +PO
                              </button>
                            )}
                            {!r.linkedCpId && !r.linkedPoId && !['Rejected', 'Cancelled', 'Issued', 'Closed'].includes(r.status) && (
                              <button
                                type="button"
                                style={{ ...S.btnSm('#16a34a'), padding: '3px 6px', fontSize: 11, fontWeight: 700 }}
                                onClick={() => openConvertCash(r)}
                                title="1-Click Convert Indent to Cash Purchase"
                              >
                                💵 +Cash
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={9} style={{ ...S.td, textAlign: 'center', color: '#64748b', padding: '24px' }}>
                        No indents raised yet. Fill the form above to raise your first requisition!
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* ── REVIEW & CONFIRM MODAL ─────────────────────────────────────────── */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {reviewMode && (
        <div style={S.ovl} onClick={() => setReviewMode(false)}>
          <div style={S.modal} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ fontWeight: 700, fontSize: 16, color: '#0f766e' }}>
                Review Indent &amp; {form.fulfillment_mode === 'po' ? 'Direct Purchase Order' : (form.fulfillment_mode === 'dc' ? 'Delivery Challan' : (form.fulfillment_mode === 'issue' ? 'Immediate Store Issuance' : 'Standard Requisition'))}
              </div>
              <button style={S.close} onClick={() => setReviewMode(false)}>✕</button>
            </div>

            <div style={{ fontSize: 12, color: '#0369a1', background: '#e0f2fe', border: '1px solid #bae6fd', borderRadius: 6, padding: '10px 14px', marginBottom: 16 }}>
              ℹ️ Fulfillment Mode: <strong>{form.fulfillment_mode.toUpperCase()}</strong>.
              {form.fulfillment_mode === 'po' && ' This will auto-approve the indent and generate a formal Purchase Order.'}
              {form.fulfillment_mode === 'dc' && ' This will generate a Delivery Challan / Gate Pass for outward material dispatch.'}
              {form.fulfillment_mode === 'issue' && ' This will immediately deduct stock and generate an official SIV issue voucher.'}
              {form.fulfillment_mode === 'pr' && ' This will submit the indent into the plant multi-tier approval matrix.'}
            </div>

            <div style={S.grid4}>
              <div style={S.revBox}><span style={S.revLabel}>Raised By (Indentor)</span><div style={S.revVal}>{user?.name || 'Indentor'}</div></div>
              <div style={S.revBox}><span style={S.revLabel}>Department</span><div style={S.revVal}>{depts.find(d => String(d.id) === String(form.department_id))?.name || '—'}</div></div>
              <div style={S.revBox}><span style={S.revLabel}>Required Date</span><div style={S.revVal}>{form.required_date || '—'}</div></div>
              <div style={S.revBox}><span style={S.revLabel}>Plant Section</span><div style={S.revVal}>{(() => {
                const s = sections.find(x => String(x.id) === String(form.section) || x.sectionCode === form.section || x.name === form.section)
                return s ? `[${s.sectionCode || s.code}] ${s.name}` : 'Plant General'
              })()}</div></div>
            </div>

            {/* If Direct PO, show Vendor and Terms */}
            {form.fulfillment_mode === 'po' && (
              <div style={{ background: '#f0fdfa', border: '1px solid #99f6e4', borderRadius: 6, padding: 10, marginTop: 10, fontSize: 12, display: 'flex', gap: 20 }}>
                <div><strong>Assigned Vendor:</strong> {vendors.find(v => String(v.id) === String(form.vendor_id))?.name || '—'}</div>
                <div><strong>Payment Terms:</strong> {form.payment_terms}</div>
                <div><strong>Delivery Date:</strong> {form.delivery_date || form.required_date || 'Immediate'}</div>
              </div>
            )}

            {/* If Delivery Challan, show DC info */}
            {form.fulfillment_mode === 'dc' && (
              <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 6, padding: 10, marginTop: 10, fontSize: 12, display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                <div><strong>DC Type:</strong> {form.dc_type}</div>
                <div><strong>Consignee:</strong> {form.to_party}</div>
                <div><strong>Vehicle No:</strong> {form.vehicle_number || '—'}</div>
                <div><strong>Driver:</strong> {form.driver_name || '—'}</div>
              </div>
            )}

            {form.remarks && (
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6, padding: 10, marginTop: 10, fontSize: 12 }}>
                <span style={S.revLabel}>Work Order / Technical Justification</span>
                <div style={{ color: '#1e293b', marginTop: 2, fontWeight: 500 }}>{form.remarks}</div>
              </div>
            )}

            <table style={{ ...S.tbl, marginTop: 14 }}>
              <thead>
                <tr>
                  {['#', 'Material / Part', 'Position', 'Reason Code & Descriptive Purpose', 'Req Qty', 'Unit Rate', 'Total Value'].map(h => (
                    <th key={h} style={S.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {form.items.map((it, idx) => {
                  const mat = matByID(it.material_id)
                  return (
                    <tr key={idx}>
                      <td style={S.td}>{idx + 1}</td>
                      <td style={S.td}>
                        <strong style={{ color: '#0f172a' }}>{mat ? mat.name : '—'}</strong>
                        <div style={{ fontSize: 10, color: '#0f766e', fontFamily: 'monospace' }}>[{mat?.code}]</div>
                      </td>
                      <td style={S.td}>{it.component_position || '—'}</td>
                      <td style={S.td}>
                        <span style={S.badge('#0f766e')}>{it.reason_code}</span>
                        {it.purpose && <div style={{ fontSize: 11, color: '#475569', marginTop: 3, fontWeight: 500 }}>{it.purpose}</div>}
                      </td>
                      <td style={S.td}><strong>{it.required_qty} {mat?.uom}</strong></td>
                      <td style={S.td}>{fmt(it.unit_price !== '' && it.unit_price !== undefined ? parseFloat(it.unit_price) : matPrice(mat))}</td>
                      <td style={S.td}><strong style={{ color: '#0f766e' }}>{fmt(lineTotal(it))}</strong></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, padding: '12px', background: '#f8fafc', borderRadius: 6 }}>
              <div style={{ fontSize: 12, color: '#64748b' }}>Total Items: <strong>{form.items.length}</strong></div>
              <div style={{ fontSize: 14, color: '#0f172a' }}>Grand Total Valuation: <strong style={{ color: '#0f766e', fontSize: 18 }}>{fmt(grandTotal)}</strong></div>
            </div>

            {reviewError && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', padding: '10px 14px', borderRadius: 6, marginTop: 14, fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 16 }}>⚠️</span>
                <div>
                  <strong>Submission Error:</strong> {reviewError}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 18 }}>
              <button type="button" style={S.btnSecondary} onClick={() => { setReviewMode(false); setReviewError(null) }}>← Back &amp; Edit</button>
              <button type="button" style={S.btnPrimary} disabled={saving} onClick={save}>
                {saving ? 'Processing...' : (editId ? '✓ Save Changes' : `✓ Confirm & Submit (${form.fulfillment_mode.toUpperCase()})`)}
              </button>
            </div>
          </div>
        </div>
      )}


      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* ── DETAIL MODAL (With Full Indentor Profile & Append Spares) ───────── */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {detail && tabKey !== 'issue' && (
        <div style={S.ovl} onClick={() => { setDetail(null); setTier(null); setAppendOpen(false) }}>
          <div style={S.modal} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 17, color: '#0f766e' }}>
                  Indent Voucher: {detail.indent_number}
                </div>
                <div style={{ fontSize: 11, color: '#64748b' }}>
                  Created on {detail.date?.slice(0, 10)} {detail.raisedAt ? new Date(detail.raisedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : ''} by <strong>{detail.raisedByName || detail.raisedBy || 'Indentor'}</strong>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button
                  style={{ ...S.btnPrimary, background: '#0f766e', padding: '6px 14px', fontSize: 12, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 6 }}
                  onClick={() => openA3IndentPrint(detail)}
                >
                  🖨️ Print Official A3 GST Voucher
                </button>
                <button
                  style={{ ...S.btnSecondary, padding: '6px 10px', fontSize: 11 }}
                  onClick={() => printCompanyInvoice(detail.id)}
                >
                  📄 Slip
                </button>
                <button style={S.close} onClick={() => { setDetail(null); setTier(null); setAppendOpen(false) }}>✕</button>
              </div>
            </div>

            {/* Cancelled Banner */}
            {detail.status === 'Cancelled' && (
              <div style={{ background: '#fef2f2', border: '2px solid #f87171', borderRadius: 8, padding: '12px 16px', marginBottom: 14, display: 'flex', gap: 12, alignItems: 'center' }}>
                <div style={{ fontSize: 24 }}>🚫</div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 13, color: '#991b1b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    This Indent has been Cancelled by Store Management
                  </div>
                  <div style={{ fontSize: 13, color: '#b91c1c', marginTop: 2, fontWeight: 700 }}>
                    Reason: {detail.cancellationReason || 'Requirement cancelled / duplicate entry'}
                  </div>
                  <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                    Cancelled by <strong>{detail.cancelledByName || 'Store Officer'}</strong> {detail.cancelledByEmpCode ? `[${detail.cancelledByEmpCode}]` : ''} {detail.cancelledAt ? `on ${new Date(detail.cancelledAt).toLocaleString('en-IN')}` : ''}
                  </div>
                </div>
              </div>
            )}

            {/* Indentor & Equipment Cards Grid */}
            <div style={S.grid4}>
              <div style={S.revBox}>
                <span style={S.revLabel}>👤 Raised By (Indentor)</span>
                <div style={{ ...S.revVal, color: '#0f766e' }}>{detail.raisedByName || detail.raisedBy || '—'}</div>
                <div style={{ fontSize: 10, color: '#64748b' }}>{detail.raisedByEmpCode ? `Emp ID: ${detail.raisedByEmpCode} · ` : ''}{detail.raisedByRole || 'Technical Staff'}</div>
              </div>

              <div style={S.revBox}>
                <span style={S.revLabel}>🏭 Plant Section &amp; Machine</span>
                <div style={S.revVal}>{detail.sectionCode ? `[${detail.sectionCode}] ${detail.sectionName || ''}` : detail.sectionName || 'Plant General'}</div>
                <div style={{ fontSize: 10, color: '#64748b' }}>{detail.machineName ? `[${detail.machineCode}] ${detail.machineName}` : detail.machine_id || 'General Spares'}</div>
              </div>

              <div style={S.revBox}>
                <span style={S.revLabel}>🏢 Department &amp; Status</span>
                <div style={S.revVal}>{detail.deptName || '—'}</div>
                <div style={{ marginTop: 2 }}><span style={S.badge(SC[detail.status])}>{detail.status}</span></div>
              </div>

              <div style={S.revBox}>
                <span style={S.revLabel}>💰 Total Valuation</span>
                <div style={{ ...S.revVal, color: '#0f766e', fontSize: 15 }}>{fmt(detail.total_value)}</div>
                <div style={{ fontSize: 10, color: '#64748b' }}>{detail.items?.length || 0} indented items</div>
              </div>
            </div>

            {/* ── 4-Step Full Lifecycle Progress Stepper (Exact Pic 2 Workflow) ── */}
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '12px 14px', marginTop: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: '#0f766e', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>🔄</span> 4-Step Requisition-to-Handover Progress Stepper
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8 }}>
                {/* Step 1: Dept Requisition */}
                <div style={{ background: '#ffffff', border: '1px solid #99f6e4', borderRadius: 6, padding: '8px 10px' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#0f766e' }}>STEP 1: DEPT REQUEST</div>
                  <div style={{ fontSize: 12, fontWeight: 800, color: '#0f172a', marginTop: 2 }}>{detail.deptName || 'Department'}</div>
                  <div style={{ fontSize: 10, color: '#64748b' }}>By {detail.raisedByName || detail.raisedBy || 'Staff'}</div>
                </div>

                {/* Step 2: SM Approval */}
                <div style={{ background: '#ffffff', border: ['L1 Approved', 'L2 Approved', 'Approved', 'Issued', 'Partially Issued', 'Closed'].includes(detail.status) ? '1px solid #bbf7d0' : '1px dashed #cbd5e1', borderRadius: 6, padding: '8px 10px' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: ['L1 Approved', 'L2 Approved', 'Approved', 'Issued', 'Partially Issued', 'Closed'].includes(detail.status) ? '#16a34a' : '#64748b' }}>
                    STEP 2: SM APPROVAL
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 800, color: '#0f172a', marginTop: 2 }}>
                    {['L1 Approved', 'L2 Approved', 'Approved', 'Issued', 'Partially Issued', 'Closed'].includes(detail.status) ? '✓ Approved' : 'Pending SM Gate'}
                  </div>
                  <div style={{ fontSize: 10, color: '#64748b' }}>{detail.l2ApprovedByName || detail.l1ApprovedByName || 'Store Manager'}</div>
                </div>

                {/* Step 3: Store Keeper Issue */}
                <div style={{ background: '#ffffff', border: ['Issued', 'Partially Issued', 'Closed'].includes(detail.status) ? '1px solid #bbf7d0' : '1px dashed #cbd5e1', borderRadius: 6, padding: '8px 10px' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: ['Issued', 'Partially Issued', 'Closed'].includes(detail.status) ? '#16a34a' : '#64748b' }}>
                    STEP 3: STORE ISSUE
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 800, color: '#0f766e', marginTop: 2 }}>
                    {['Issued', 'Partially Issued', 'Closed'].includes(detail.status) ? '✓ Issued' : 'Ready for Issue'}
                  </div>
                  <div style={{ fontSize: 10, color: '#64748b' }}>{detail.issuedByName || 'Store Keeper'}</div>
                </div>

                {/* Step 4: Receiver Sign & Out */}
                <div style={{ background: '#ffffff', border: detail.status === 'Closed' || detail.receiver_name ? '1px solid #16a34a' : '1px dashed #cbd5e1', borderRadius: 6, padding: '8px 10px' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: detail.status === 'Closed' || detail.receiver_name ? '#16a34a' : '#64748b' }}>
                    STEP 4: RECEIVER SIGN &amp; OUT
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 800, color: '#0f172a', marginTop: 2 }}>
                    {detail.status === 'Closed' || detail.receiver_name ? `✓ Signed & Closed` : 'Pending Handover'}
                  </div>
                  <div style={{ fontSize: 10, color: '#64748b' }}>{detail.receiver_name ? `${detail.receiver_name} (${detail.receiver_emp_code || 'Emp'})` : 'Dept Receiver'}</div>
                </div>
              </div>
            </div>

            {detail.remarks && (
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6, padding: 10, marginTop: 10, fontSize: 12 }}>
                <span style={S.revLabel}>Work Order / Technical Remarks</span>
                <div style={{ color: '#1e293b', marginTop: 2, fontWeight: 500 }}>{detail.remarks}</div>
              </div>
            )}

            {/* ── Downstream Linked Documents & Flow Status ── */}
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 12, marginTop: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>🔗</span> Associated Enterprise Documents &amp; Workflow Trace
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
                {/* Linked Purchase Order */}
                <div style={{ background: '#ffffff', border: detail.linkedPoNumber ? '1px solid #bae6fd' : '1px dashed #cbd5e1', borderRadius: 6, padding: 10 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#0369a1', display: 'flex', justifyContent: 'space-between' }}>
                    <span>🛒 Purchase Order</span>
                    {detail.linkedPoNumber && <span style={{ ...S.badge('#0284c7'), fontSize: 9 }}>{detail.linkedPoStatus || 'Active'}</span>}
                  </div>
                  {detail.linkedPoNumber ? (
                    <div style={{ marginTop: 4 }}>
                      <div style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 12, color: '#0f766e' }}>{detail.linkedPoNumber}</div>
                      <div style={{ fontSize: 10, color: '#64748b' }}>Vendor: <strong>{detail.linkedPoVendorName || 'Assigned Vendor'}</strong></div>
                      {detail.linkedPoGrandTotal > 0 && <div style={{ fontSize: 10, color: '#0f766e', fontWeight: 600 }}>Value: {fmt(detail.linkedPoGrandTotal)}</div>}
                      <button
                        style={{ ...S.btnSm('#0284c7'), padding: '2px 8px', fontSize: 10, marginTop: 6 }}
                        onClick={() => { window.location.href = `/purchase` }}
                      >
                        Open PO Desk →
                      </button>
                    </div>
                  ) : (
                    <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>Not converted to PO</span>
                      {!['Rejected', 'Cancelled'].includes(detail.status) && (
                        <button style={{ ...S.btnSm('#0284c7'), padding: '2px 6px', fontSize: 10 }} onClick={() => openConvertPo(detail)}>
                          + Convert
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Linked Delivery Challan / Gate Pass */}
                <div style={{ background: '#ffffff', border: detail.linkedGpNumber ? '1px solid #fde68a' : '1px dashed #cbd5e1', borderRadius: 6, padding: 10 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#b45309', display: 'flex', justifyContent: 'space-between' }}>
                    <span>🚛 Delivery Challan / GP</span>
                    {detail.linkedGpNumber && <span style={{ ...S.badge('#d97706'), fontSize: 9 }}>{detail.linkedGpStatus || 'Generated'}</span>}
                  </div>
                  {detail.linkedGpNumber ? (
                    <div style={{ marginTop: 4 }}>
                      <div style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 12, color: '#b45309' }}>{detail.linkedGpNumber}</div>
                      <div style={{ fontSize: 10, color: '#64748b' }}>Type: <strong>{detail.linkedGpType || 'Material Outward DC'}</strong></div>
                      <button
                        style={{ ...S.btnSm('#d97706'), padding: '2px 8px', fontSize: 10, marginTop: 6 }}
                        onClick={() => { window.location.href = `/security` }}
                      >
                        Open Gate Pass Desk →
                      </button>
                    </div>
                  ) : (
                    <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>Not dispatched via DC</span>
                      {!['Rejected', 'Cancelled'].includes(detail.status) && (
                        <button style={{ ...S.btnSm('#d97706'), padding: '2px 6px', fontSize: 10 }} onClick={() => openConvertDc(detail)}>
                          + Generate DC
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Store Issuance SIV Status */}
                <div style={{ background: '#ffffff', border: ['Issued', 'Partially Issued'].includes(detail.status) ? '1px solid #bbf7d0' : '1px dashed #cbd5e1', borderRadius: 6, padding: 10 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#15803d', display: 'flex', justifyContent: 'space-between' }}>
                    <span>📦 Store Issuance (SIV)</span>
                    <span style={{ ...S.badge(detail.status === 'Issued' ? '#16a34a' : '#64748b'), fontSize: 9 }}>{detail.status}</span>
                  </div>
                  <div style={{ marginTop: 4 }}>
                    <div style={{ fontSize: 11, color: '#334155' }}>
                      {['Issued', 'Partially Issued'].includes(detail.status)
                        ? `Items issued from mill stores with atomic ledger deduction.`
                        : `Stock ready for warehouse dispatch.`}
                    </div>
                    {['Submitted', 'Approved', 'Partially Issued'].includes(detail.status) && visibleTabs.some(t => t.key === 'issue') && (
                      <button
                        style={{ ...S.btnSm('#16a34a'), padding: '2px 8px', fontSize: 10, marginTop: 6 }}
                        onClick={() => { setDetail(null); setTabKey('issue'); }}
                      >
                        Proceed to Issue →
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Line Items Table */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, marginBottom: 8 }}>
              <div style={{ fontWeight: 700, fontSize: 12, color: '#0f766e', textTransform: 'uppercase' }}>
                Indented Items ({detail.items?.length || 0})
              </div>
              {detail.status !== 'Issued' && detail.status !== 'Closed' && (
                <button
                  style={{ background: '#e0f2fe', color: '#0369a1', border: '1px solid #bae6fd', borderRadius: 4, padding: '4px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
                  onClick={() => setAppendOpen(o => !o)}
                >
                  {appendOpen ? '✕ Cancel Append' : '＋ Append Item to Indent'}
                </button>
              )}
            </div>

            {/* Append Item Inline Form */}
            {appendOpen && (
              <form onSubmit={handleAppendItem} style={{ background: '#f0fdfa', border: '1px solid #99f6e4', borderRadius: 8, padding: 14, marginBottom: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#0f766e', marginBottom: 8 }}>
                  ⚡ Append New Item to Active Indent ({detail.indent_number})
                </div>
                <div style={S.grid3}>
                  <label style={S.lbl}>Material / Spare *
                    <div style={{ position: 'relative' }}>
                      <input
                        style={S.inp}
                        placeholder="🔍 Type material name or code..."
                        value={appendSearch !== '' ? appendSearch : (matByID(appendForm.material_id)?.name || '')}
                        onFocus={() => setAppendDrop(true)}
                        onChange={e => { setAppendSearch(e.target.value); setAppendDrop(true) }}
                        onBlur={() => setTimeout(() => setAppendDrop(false), 180)}
                      />
                      {appendDrop && (
                        <div style={S.dropMenu}>
                          {mats.filter(m => !appendSearch || (m.name || '').toLowerCase().includes(appendSearch.toLowerCase()) || (m.code || '').toLowerCase().includes(appendSearch.toLowerCase())).slice(0, 50).map(m => (
                            <div
                              key={m.id}
                              onMouseDown={() => {
                                setAppendForm(f => ({ ...f, material_id: m.id, uom: m.uom, unit_price: m.unit_price != null ? parseFloat(m.unit_price) : '' }))
                                setAppendSearch('')
                                setAppendDrop(false)
                              }}
                              style={{ padding: '7px 10px', cursor: 'pointer', fontSize: 11, borderBottom: '1px solid #f1f5f9' }}
                            >
                              <strong>{m.name}</strong> <span style={{ color: '#0f766e' }}>[{m.code}]</span> · Stock: {m.current_stock}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </label>
                  <label style={S.lbl}>Required Qty *
                    <input style={S.inp} type="number" step="0.001" min="0.001" required value={appendForm.required_qty} onChange={e => setAppendForm(f => ({ ...f, required_qty: e.target.value }))} />
                  </label>
                  <label style={S.lbl}>Reason Code
                    <select style={S.sel} value={appendForm.reason_code} onChange={e => setAppendForm(f => ({ ...f, reason_code: e.target.value }))}>
                      {REASON_CODES.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </label>
                </div>
                <div style={{ ...S.grid3, marginTop: 8 }}>
                  <label style={S.lbl}>Unit Rate (INR)
                    <input
                      style={S.inp}
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="Auto-filled from catalog (editable)"
                      value={appendForm.unit_price !== '' ? appendForm.unit_price : (matByID(appendForm.material_id)?.unit_price || '')}
                      onChange={e => setAppendForm(f => ({ ...f, unit_price: e.target.value }))}
                    />
                  </label>
                  <label style={S.lbl}>Position / Location
                    <input style={S.inp} placeholder="e.g. Drive Side, Press Section..." value={appendForm.component_position} onChange={e => setAppendForm(f => ({ ...f, component_position: e.target.value }))} />
                  </label>
                  <label style={S.lbl}>Technical Purpose / Failure Observations
                    <input style={S.inp} placeholder="Detailed technical reason..." value={appendForm.purpose} onChange={e => setAppendForm(f => ({ ...f, purpose: e.target.value }))} />
                  </label>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10, gap: 8 }}>
                  <button type="button" style={S.btnSecondary} onClick={() => setAppendOpen(false)}>Cancel</button>
                  <button type="submit" style={S.btnPrimary} disabled={appendSaving}>
                    {appendSaving ? 'Appending...' : '＋ Append Item'}
                  </button>
                </div>
              </form>
            )}

            <table style={S.tbl}>
              <thead>
                <tr>
                  {['Part Code & Name', 'Position', 'Reason & Technical Purpose', 'Req Qty', 'Issued', 'Unit Price', 'Line Value', ''].map(h => (
                    <th key={h} style={S.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(detail.items || []).map(it => (
                  <tr key={it.id}>
                    <td style={S.td}>
                      <strong style={{ color: '#0f172a' }}>{it.materialName}</strong>
                      <div style={{ fontSize: 10, color: '#0f766e', fontFamily: 'monospace' }}>[{it.materialCode || it.material_id}]</div>
                    </td>
                    <td style={S.td}>{it.component_position || '—'}</td>
                    <td style={{ ...S.td, maxWidth: 260 }}>
                      <span style={S.badge('#0f766e')}>{it.reason_code || 'Routine'}</span>
                      {it.purpose && <div style={{ fontSize: 11, color: '#334155', marginTop: 3, fontWeight: 500 }}>{it.purpose}</div>}
                    </td>
                    <td style={S.td}>{it.required_qty} {it.uom || it.matUom}</td>
                    <td style={S.td}><strong style={{ color: '#16a34a' }}>{it.issued_qty || 0}</strong></td>
                    <td style={S.td}>{fmt(it.matPrice || it.unit_price)}</td>
                    <td style={S.td}><strong style={{ color: '#0f766e' }}>{fmt(it.lineValue || it.line_value)}</strong></td>
                    <td style={S.td}>
                      {detail.status !== 'Issued' && detail.status !== 'Closed' && (
                        <button
                          style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 13 }}
                          onClick={() => handleDeleteItem(it.id)}
                          title="Delete Item"
                        >
                          🗑️
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16, flexWrap: 'wrap', alignItems: 'center' }}>
              {/* Official A3 GST Voucher Print */}
              <button
                style={{ ...S.btnPrimary, background: '#0f766e', padding: '6px 14px', fontSize: 12, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 4 }}
                onClick={() => openA3IndentPrint(detail)}
              >
                🖨️ Print Official A3 GST Voucher
              </button>

              {/* SM Approval Action */}
              {['Submitted', 'L1 Approved'].includes(detail.status) && ((user?.role_level || 1) >= 3 || user?.dept_code === 'STORE') && (
                <button
                  style={{ ...S.btnPrimary, background: '#7c3aed', padding: '6px 14px', fontSize: 12, fontWeight: 800 }}
                  onClick={() => action(detail.id, 'l2_approve')}
                >
                  🛡️ Store Manager Approval
                </button>
              )}

              {/* Receiver Sign & Handover Action */}
              {['Issued', 'Partially Issued', 'Approved'].includes(detail.status) && (
                <button
                  style={{ ...S.btnPrimary, background: '#16a34a', padding: '6px 14px', fontSize: 12, fontWeight: 800 }}
                  onClick={() => {
                    setReceiverSignModal(detail)
                    setReceiverSignForm({
                      receiver_name: user?.name || '',
                      receiver_emp_code: user?.employee_code || '',
                      receiver_signature_note: 'Received and verified in department',
                      fitment_date: new Date().toISOString().slice(0, 10),
                      fitment_location: detail.sectionName || '',
                      observations: ''
                    })
                  }}
                >
                  ✍️ Receiver Sign &amp; Close Indent
                </button>
              )}

              {/* 1-Click Convert to PO */}
              {!detail.linkedPoId && !['Rejected', 'Cancelled'].includes(detail.status) && (
                <button
                  style={{ ...S.btnSm('#0284c7'), padding: '6px 14px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4, fontWeight: 700 }}
                  onClick={() => openConvertPo(detail)}
                >
                  🛒 1-Click Convert to PO
                </button>
              )}

              {/* 1-Click Convert to DC */}
              {!detail.linkedGpId && !['Rejected', 'Cancelled'].includes(detail.status) && (
                <button
                  style={{ ...S.btnSm('#d97706'), padding: '6px 14px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4, fontWeight: 700 }}
                  onClick={() => openConvertDc(detail)}
                >
                  🚛 1-Click Generate DC
                </button>
              )}

              {(isStore || isElevated || detail.raised_by === user?.id) && (
                <button
                  style={{ ...S.btnSm(detail.status === 'Cancelled' ? '#64748b' : (detail.status === 'Issued' || detail.status === 'Closed' ? '#b91c1c' : '#ef4444')), padding: '6px 14px', fontSize: 12 }}
                  onClick={() => {
                    setCancelModal({ id: detail.id, num: detail.indent_number, deptName: detail.deptName, status: detail.status })
                    setCancelReason(detail.cancellationReason ? detail.cancellationReason.split(' — ')[0] : 'Double Entry / Duplicate Indent')
                    setCancelNotes(detail.cancellationReason && detail.cancellationReason.includes(' — ') ? detail.cancellationReason.split(' — ').slice(1).join(' — ') : '')
                  }}
                >
                  {detail.status === 'Cancelled' ? '🗑️ Purge Indent' : (detail.status === 'Issued' || detail.status === 'Closed' ? '🗑️ Force Delete' : '🚫 Cancel Indent')}
                </button>
              )}
              <button style={S.btnSecondary} onClick={() => { setDetail(null); setTier(null) }}>Close</button>
              {detail.status === 'Issued' && (
                <button style={S.btnPrimary} onClick={() => action(detail.id, 'close')}>Close Indent</button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* ── TAB 3: STORE ISSUE ─────────────────────────────────────────────── */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {tabKey === 'issue' && (
        <div>
          <div style={{ fontSize: 13, color: '#64748b', marginBottom: 12 }}>
            Indents ready for physical warehouse issuance and live stock deduction (Submitted, Approved &amp; Partially Issued)
          </div>
          <div style={{ ...S.card, padding: 0, overflow: 'auto', marginBottom: 16 }}>
            <table style={S.tbl}>
              <thead>
                <tr>
                  {['Indent No', 'Dept', 'Indentor', 'Equipment', 'Reason', 'Status', 'Date', 'Value', 'Action'].map(h => (
                    <th key={h} style={S.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.filter(r => ['Submitted', 'L1 Approved', 'L2 Approved', 'Approved', 'Partially Issued'].includes(r.status)).map(r => (
                  <tr key={r.id} style={{ background: detail?.id === r.id ? '#f0fdf4' : 'transparent' }}>
                    <td style={S.td}><span style={{ fontFamily: 'monospace', fontSize: 11, fontWeight: 700 }}>{r.indentNumber}</span></td>
                    <td style={S.td}>{r.deptName}</td>
                    <td style={S.td}><strong>{r.raisedBy || r.raisedByName}</strong></td>
                    <td style={S.td}>{r.machineName || r.machine_id || 'General Spares'}</td>
                    <td style={S.td}><span style={S.badge('#0f766e')}>{r.reasonCode || 'Routine'}</span></td>
                    <td style={S.td}><span style={S.badge(SC[r.status])}>{r.status}</span></td>
                    <td style={S.td}>{r.date?.slice(0, 10)}</td>
                    <td style={S.td}>{fmt(r.total_value)}</td>
                    <td style={S.td}>
                      <button style={S.btnSm('#16a34a')} onClick={() => openDetail(r.id)}>
                        {detail?.id === r.id ? '✓ Selected' : '📦 Select to Issue'}
                      </button>
                    </td>
                  </tr>
                ))}
                {rows.filter(r => ['Submitted', 'L1 Approved', 'L2 Approved', 'Approved', 'Partially Issued'].includes(r.status)).length === 0 && (
                  <tr><td colSpan={9} style={{ ...S.td, textAlign: 'center', padding: 36, color: '#8a8a90' }}>No indents pending store issuance</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {detail && ['Submitted', 'L1 Approved', 'L2 Approved', 'Approved', 'Partially Issued'].includes(detail.status) && (
            <div style={S.card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15, color: '#0f766e' }}>
                    📦 Physical Store Issuance — Voucher: {detail.indent_number}
                  </div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>
                    Indentor: <strong>{detail.raisedByName || detail.raisedBy}</strong> · Department: <strong>{detail.deptName}</strong> · Section: <strong>{detail.sectionCode ? `[${detail.sectionCode}] ${detail.sectionName}` : 'General'}</strong>
                  </div>
                </div>
                <div style={{ fontSize: 12, background: '#f0fdfa', border: '1px solid #99f6e4', padding: '4px 10px', borderRadius: 6, color: '#0f766e', fontWeight: 600 }}>
                  ☑️ Selected Items to Issue: <strong>{issueItems.filter(x => x.selected).length}</strong> of {issueItems.length}
                </div>
              </div>

              <table style={S.tbl}>
                <thead>
                  <tr>
                    <th style={{ ...S.th, width: 36, textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        style={{ cursor: 'pointer', width: 16, height: 16 }}
                        checked={issueItems.length > 0 && issueItems.every(x => x.selected)}
                        onChange={e => {
                          const checked = e.target.checked
                          setIssueItems(items => items.map(x => ({ ...x, selected: checked })))
                        }}
                        title="Select / Deselect All Items"
                      />
                    </th>
                    {['Part Code & Name', 'Position / Purpose', 'Req Qty', 'Prev Issued', 'Stock in Store', 'Issue Qty', 'Batch / Lot No'].map(h => (
                      <th key={h} style={S.th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {issueItems.map((it, i) => {
                    const currentStock = Number(it.matCurrentStock != null ? it.matCurrentStock : (it.current_stock || 0))
                    const reqQty = Number(it.required_qty || 0)
                    const prevIssued = Number(it.issued_qty != null && it.issued_qty !== it.required_qty ? it.issued_qty : 0)
                    const isOutOfStock = currentStock <= 0
                    const isLowStock = currentStock < reqQty

                    return (
                      <tr key={it.id} style={{ background: it.selected ? '#f0fdfa' : '#ffffff' }}>
                        {/* Checkbox */}
                        <td style={{ ...S.td, textAlign: 'center' }}>
                          <input
                            type="checkbox"
                            style={{ cursor: 'pointer', width: 16, height: 16 }}
                            checked={!!it.selected}
                            onChange={e => {
                              const checked = e.target.checked
                              setIssueItems(items => items.map((x, j) => j === i ? { ...x, selected: checked } : x))
                            }}
                          />
                        </td>

                        {/* Part Code & Name */}
                        <td style={S.td}>
                          <strong style={{ color: it.selected ? '#0f766e' : '#0f172a' }}>{it.materialName}</strong>
                          <div style={{ fontSize: 10, color: '#64748b', fontFamily: 'monospace' }}>[{it.materialCode || it.material_id}]</div>
                          {it.categoryName && <div style={{ fontSize: 9, color: '#94a3b8' }}>{it.categoryName}</div>}
                        </td>

                        {/* Position & Purpose */}
                        <td style={{ ...S.td, maxWidth: 220 }}>
                          {it.component_position && <div style={{ fontSize: 11, fontWeight: 600, color: '#334155' }}>{it.component_position}</div>}
                          {it.purpose && <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>{it.purpose}</div>}
                          <span style={S.badge('#0f766e')}>{it.reason_code || 'Routine'}</span>
                        </td>

                        {/* Required Qty */}
                        <td style={S.td}><strong>{reqQty} {it.uom || it.matUom}</strong></td>

                        {/* Previously Issued Qty */}
                        <td style={S.td}><span style={{ color: '#64748b' }}>{it.issued_qty || 0} {it.uom || it.matUom}</span></td>

                        {/* Live Stock in Store */}
                        <td style={S.td}>
                          <span style={{
                            fontWeight: 700,
                            color: isOutOfStock ? '#dc2626' : (isLowStock ? '#d97706' : '#16a34a'),
                            background: isOutOfStock ? '#fee2e2' : (isLowStock ? '#fef3c7' : '#dcfce7'),
                            padding: '2px 8px',
                            borderRadius: 4,
                            fontSize: 11,
                            display: 'inline-block'
                          }}>
                            {currentStock} {it.uom || it.matUom}
                          </span>
                        </td>

                        {/* Issue Qty Input */}
                        <td style={S.td}>
                          <input
                            style={{
                              ...S.inp, width: 95, fontWeight: 700,
                              color: it.selected ? '#0f766e' : '#94a3b8',
                              border: it.selected ? '2px solid #0f766e' : '1px solid #cbd5e1',
                              background: it.selected ? '#ffffff' : '#f1f5f9'
                            }}
                            type="number"
                            step="0.001"
                            min="0.001"
                            disabled={!it.selected}
                            value={it.issued_qty}
                            onChange={e => setIssueItems(items => items.map((x, j) => j === i ? { ...x, issued_qty: e.target.value } : x))}
                          />
                        </td>

                        {/* Batch / Lot No */}
                        <td style={S.td}>
                          <input
                            style={{
                              ...S.inp, width: 140,
                              background: it.selected ? '#ffffff' : '#f1f5f9'
                            }}
                            placeholder="Batch / Heat / Lot No..."
                            disabled={!it.selected}
                            value={it.batch_no || ''}
                            onChange={e => setIssueItems(items => items.map((x, j) => j === i ? { ...x, batch_no: e.target.value } : x))}
                          />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>

              <div style={{ marginTop: 14 }}>
                <label style={S.lbl}>Issuance Remarks / Delivery Note
                  <input
                    style={S.inp}
                    placeholder="Store delivery notes / gate pass reference / physical store shelf..."
                    value={issueRemarks}
                    onChange={e => setIssueRemarks(e.target.value)}
                  />
                </label>
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
                <button style={S.btnSecondary} onClick={() => setDetail(null)}>Cancel</button>
                <button
                  style={{ ...S.btnPrimary, background: '#16a34a', padding: '10px 20px', fontSize: 13 }}
                  disabled={issueItems.filter(x => x.selected).length === 0}
                  onClick={submitIssue}
                >
                  ✓ Issue {issueItems.filter(x => x.selected).length} Selected Material{issueItems.filter(x => x.selected).length === 1 ? '' : 's'} &amp; Deduct Stock
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── TAB 4: ACKNOWLEDGMENTS ── */}
      {tabKey === 'acknowledge' && (
        <div style={S.card}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8, color: '#0f766e' }}>
            Material Fitment Acknowledgments
          </div>
          <div style={{ fontSize: 12, color: '#64748b', marginBottom: 14 }}>
            Verify physical receipt and log post-fitment machinery KPI improvements
          </div>

          <table style={S.tbl}>
            <thead>
              <tr>
                {['Indent No', 'Department', 'Material', 'Issued Qty', 'Fitment Position', 'Purpose', 'Action'].map(h => (
                  <th key={h} style={S.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {myAcks.map(a => (
                <tr key={a.item_id}>
                  <td style={S.td}><span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{a.indent_number}</span></td>
                  <td style={S.td}>{a.dept}</td>
                  <td style={S.td}>
                    <strong>{a.part_name}</strong>
                    <div style={{ fontSize: 10, color: '#0f766e', fontFamily: 'monospace' }}>[{a.part_code}]</div>
                  </td>
                  <td style={S.td}><strong style={{ color: '#16a34a' }}>{a.issued_qty} {a.uom}</strong></td>
                  <td style={S.td}>{a.component_position || '—'}</td>
                  <td style={S.td}>{a.purpose || '—'}</td>
                  <td style={S.td}>
                    <button style={S.btnSm('#0f766e')} onClick={() => openAck(a)}>Acknowledge Fitment</button>
                  </td>
                </tr>
              ))}
              {myAcks.length === 0 && (
                <tr><td colSpan={7} style={{ ...S.td, textAlign: 'center', padding: 36, color: '#8a8a90' }}>No items awaiting fitment acknowledgment</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Fitment Ack Modal ── */}
      {ackItem && (
        <div style={S.ovl} onClick={() => setAckItem(null)}>
          <div style={{ ...S.modal, maxWidth: 520 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ fontWeight: 700, fontSize: 15, color: '#0f766e' }}>Acknowledge Fitment: {ackItem.part_name}</div>
              <button style={S.close} onClick={() => setAckItem(null)}>✕</button>
            </div>
            <div style={{ fontSize: 11, color: '#64748b', marginBottom: 14 }}>Indent {ackItem.indent_number} · Issued {ackItem.issued_qty} {ackItem.uom}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <label style={S.lbl}>Fitment Date
                <input style={S.inp} type="date" value={ackForm.fitment_date} onChange={e => setAckForm(f => ({ ...f, fitment_date: e.target.value }))} />
              </label>
              <label style={S.lbl}>Fitment Observations
                <input style={S.inp} value={ackForm.observations} onChange={e => setAckForm(f => ({ ...f, observations: e.target.value }))} placeholder="Fitment notes, run condition..." />
              </label>
              <div style={S.grid2}>
                <label style={S.lbl}>KPI Before
                  <input style={S.inp} placeholder="e.g. Vibration 4.2 mm/s" value={ackForm.kpi_before} onChange={e => setAckForm(f => ({ ...f, kpi_before: e.target.value }))} />
                </label>
                <label style={S.lbl}>KPI After
                  <input style={S.inp} placeholder="e.g. Vibration 1.1 mm/s" value={ackForm.kpi_after} onChange={e => setAckForm(f => ({ ...f, kpi_after: e.target.value }))} />
                </label>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 18 }}>
              <button style={S.btnSecondary} onClick={() => setAckItem(null)}>Cancel</button>
              <button style={S.btnPrimary} disabled={ackSaving} onClick={submitAck}>
                {ackSaving ? 'Saving...' : '✓ Confirm Acknowledge'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 5: ANALYTICS ── */}
      {tabKey === 'analytics' && (
        <div>
          {!analytics ? <div style={{ padding: 32, textAlign: 'center', color: '#8a8a90' }}>Loading analytics...</div> : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 16 }}>
                {[
                  { l: 'Total Indents', v: analytics.summary.total, c: '#0f766e' },
                  { l: 'Open / Pending', v: parseInt(analytics.summary.submitted || 0) + parseInt(analytics.summary.approved || 0), c: '#f97316' },
                  { l: 'Issued (Active)', v: analytics.summary.issued || 0, c: '#16a34a' },
                  { l: 'Closed Indents', v: analytics.summary.closed || 0, c: '#22c55e' },
                  { l: 'Total Valuation', v: fmt(analytics.summary.total_value), c: '#0f766e' },
                  { l: 'Pending Acks', v: analytics.pendingAck || 0, c: '#f97316' },
                ].map(k => (
                  <div key={k.l} style={S.kpi(k.c)}>
                    <div style={S.kpiV(k.c)}>{k.v}</div>
                    <div style={S.kpiL}>{k.l}</div>
                  </div>
                ))}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div style={S.card}>
                  <div style={{ fontWeight: 700, fontSize: 12, color: '#0f766e', marginBottom: 10 }}>BY DEPARTMENT</div>
                  <table style={S.tbl}>
                    <thead>
                      <tr>{['Department', 'Indents', 'Value'].map(h => <th key={h} style={S.th}>{h}</th>)}</tr>
                    </thead>
                    <tbody>
                      {analytics.byDept?.map(d => (
                        <tr key={d.dept}>
                          <td style={S.td}>{d.dept}</td>
                          <td style={S.td}>{d.indents}</td>
                          <td style={S.td}><strong>{fmt(d.value)}</strong></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div style={S.card}>
                  <div style={{ fontWeight: 700, fontSize: 12, color: '#0f766e', marginBottom: 10 }}>TOP CONSUMED PARTS</div>
                  <table style={S.tbl}>
                    <thead>
                      <tr>{['Part Name', 'Qty Issued', 'Value'].map(h => <th key={h} style={S.th}>{h}</th>)}</tr>
                    </thead>
                    <tbody>
                      {analytics.topParts?.map((p, i) => (
                        <tr key={i}>
                          <td style={S.td}>{p.part}</td>
                          <td style={S.td}>{parseFloat(p.qty || 0).toFixed(1)}</td>
                          <td style={S.td}><strong style={{ color: '#0f766e' }}>{fmt(p.value)}</strong></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── TAB 6: CALENDAR ── */}
      {tabKey === 'calendar' && (
        <div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 14 }}>
            <button style={S.btnSm('#ffffff')} onClick={() => { const d = new Date(calYear, calMonth - 2, 1); setCalMonth(d.getMonth() + 1); setCalYear(d.getFullYear()) }}>‹</button>
            <strong style={{ color: '#0f766e' }}>{new Date(calYear, calMonth - 1, 1).toLocaleString('default', { month: 'long', year: 'numeric' })}</strong>
            <button style={S.btnSm('#ffffff')} onClick={() => { const d = new Date(calYear, calMonth, 1); setCalMonth(d.getMonth() + 1); setCalYear(d.getFullYear()) }}>›</button>
            <span style={{ fontSize: 12, color: '#64748b', marginLeft: 8 }}>{calendar.length} events logged</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2, marginBottom: 4 }}>
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => <div key={d} style={{ textAlign: 'center', fontSize: 11, color: '#64748b', padding: 4 }}>{d}</div>)}
          </div>
          {(() => {
            const firstDay = new Date(calYear, calMonth - 1, 1).getDay()
            const totalDays = new Date(calYear, calMonth, 0).getDate()
            const cells = [...Array(firstDay).fill(null), ...Array.from({ length: totalDays }, (_, i) => i + 1)]
            while (cells.length % 7) cells.push(null)

            return (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 3 }}>
                {cells.map((d, i) => {
                  const evs = d ? calendar.filter(c => new Date(c.date).getDate() === d) : []
                  return (
                    <div key={i} style={{ background: d ? '#ffffff' : 'transparent', border: d ? '1px solid #e2e8f0' : 'none', borderRadius: 6, padding: 6, minHeight: 75 }}>
                      {d && <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 3 }}>{d}</div>}
                      {evs.map(e => (
                        <div
                          key={e.id}
                          onClick={() => openDetail(e.id)}
                          style={{
                            fontSize: 10, padding: '2px 4px', borderRadius: 3, marginBottom: 2, cursor: 'pointer',
                            background: (SC[e.status] || '#64748b') + '22', color: SC[e.status] || '#0f766e', borderLeft: `3px solid ${SC[e.status] || '#0f766e'}`
                          }}
                        >
                          {e.num}
                        </div>
                      ))}
                    </div>
                  )
                })}
              </div>
            )
          })()}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* ── STORE MANAGER / ADMIN INDENT CANCELLATION & DELETION MODAL ─────── */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {cancelModal && (
        <div style={S.ovl} onClick={() => setCancelModal(null)}>
          <div style={{ ...S.modal, maxWidth: 540 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ fontWeight: 700, fontSize: 16, color: '#dc2626' }}>
                🚫 Cancel / Delete Indent: {cancelModal.num}
              </div>
              <button style={S.close} onClick={() => setCancelModal(null)}>✕</button>
            </div>

            <div style={{ fontSize: 12, color: '#991b1b', background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 6, padding: '10px 14px', marginBottom: 14 }}>
              ⚠️ Please specify the official cancellation reason. It will be recorded permanently in the store audit ledger and displayed across Store Management and Admin reporting.
            </div>

            <form onSubmit={handleCancelSubmit}>
              <label style={S.lbl}>Official Cancellation / Deletion Reason *
                <select
                  style={{ ...S.sel, fontWeight: 600, color: '#b91c1c', border: '1px solid #f87171', background: '#fff5f5' }}
                  value={cancelReason}
                  onChange={e => setCancelReason(e.target.value)}
                  required
                >
                  {CANCELLATION_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </label>

              <label style={{ ...S.lbl, marginTop: 12 }}>Detailed Store Notes / Investigation Remarks
                <textarea
                  style={{ ...S.inp, minHeight: 70 }}
                  placeholder="e.g. Duplicate entry raised by technical staff for same couch roll bearing, earlier voucher IND-20260815-0012 already issued."
                  value={cancelNotes}
                  onChange={e => setCancelNotes(e.target.value)}
                  rows={3}
                />
              </label>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 20, flexWrap: 'wrap', gap: 10 }}>
                <button
                  type="button"
                  style={{ ...S.btnSm('#dc2626'), padding: '8px 14px', fontSize: 12, fontWeight: 700 }}
                  disabled={cancelling}
                  onClick={handleHardDelete}
                  title="Permanently remove record from database"
                >
                  🗑️ Permanently Delete Record
                </button>

                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="button" style={S.btnSecondary} onClick={() => setCancelModal(null)}>Back</button>
                  <button
                    type="submit"
                    style={{ ...S.btnPrimary, background: '#e11d48', padding: '8px 16px', fontSize: 12 }}
                    disabled={cancelling}
                  >
                    {cancelling ? 'Processing...' : '🚫 Mark as Cancelled (Audit Log)'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* ── 1-CLICK CONVERT TO PURCHASE ORDER (PO) MODAL ───────────────────── */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {poModal && (
        <div style={S.ovl} onClick={() => setPoModal(null)}>
          <div style={{ ...S.modal, maxWidth: 640 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ fontWeight: 700, fontSize: 16, color: '#0369a1', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>🛒</span> 1-Click Convert to Purchase Order (PO)
              </div>
              <button style={S.close} onClick={() => setPoModal(null)}>✕</button>
            </div>

            <div style={{ fontSize: 12, color: '#0369a1', background: '#e0f2fe', border: '1px solid #bae6fd', borderRadius: 6, padding: '10px 14px', marginBottom: 16 }}>
              Converting Indent <strong>{poModal.indentNumber}</strong> ({poModal.items?.length || 0} items) into a formal Purchase Order. Procurement and Finance multi-agents will sync this PO automatically.
            </div>

            <form onSubmit={handleConvertPoSubmit}>
              <label style={S.lbl}>Assign Vendor / Supplier *
                <select
                  style={{ ...S.sel, fontSize: 13, fontWeight: 600 }}
                  value={poModal.vendor_id}
                  onChange={e => setPoModal(m => ({ ...m, vendor_id: e.target.value }))}
                  required
                >
                  <option value="">-- Select Registered Vendor --</option>
                  {vendors.map(v => (
                    <option key={v.id} value={v.id}>
                      {v.name} {v.gstin ? `[GSTIN: ${v.gstin}]` : ''} ({v.city || 'Supplier'})
                    </option>
                  ))}
                </select>
              </label>

              <div style={{ ...S.grid2, marginTop: 12 }}>
                <label style={S.lbl}>Payment Terms
                  <select
                    style={S.sel}
                    value={poModal.payment_terms}
                    onChange={e => setPoModal(m => ({ ...m, payment_terms: e.target.value }))}
                  >
                    <option value="Net 30 Days">Net 30 Days</option>
                    <option value="Net 15 Days">Net 15 Days</option>
                    <option value="Net 45 Days">Net 45 Days</option>
                    <option value="Immediate / COD">Immediate / COD</option>
                    <option value="100% Advance">100% Advance</option>
                    <option value="50% Advance, 50% on Delivery">50% Advance, 50% on Delivery</option>
                  </select>
                </label>

                <label style={S.lbl}>Expected Delivery Date
                  <input
                    type="date"
                    style={S.inp}
                    value={poModal.delivery_date}
                    onChange={e => setPoModal(m => ({ ...m, delivery_date: e.target.value }))}
                  />
                </label>
              </div>

              <div style={{ marginTop: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', marginBottom: 6, textTransform: 'uppercase' }}>
                  Items to Include in PO
                </div>
                <div style={{ maxHeight: 180, overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: 6 }}>
                  <table style={S.tbl}>
                    <thead>
                      <tr>
                        <th style={S.th}>Item</th>
                        <th style={S.th}>Req Qty</th>
                        <th style={S.th}>Rate (₹)</th>
                        <th style={S.th}>GST %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(poModal.items || []).map((it, idx) => (
                        <tr key={it.id || idx}>
                          <td style={S.td}>
                            <strong>{it.materialName}</strong>
                            <div style={{ fontSize: 10, color: '#64748b' }}>[{it.materialCode}]</div>
                          </td>
                          <td style={S.td}>{it.required_qty} {it.uom}</td>
                          <td style={S.td}>
                            <input
                              type="number"
                              step="0.01"
                              style={{ ...S.inp, width: 90, padding: '4px 6px' }}
                              value={it.unit_price}
                              onChange={e => {
                                const val = e.target.value
                                setPoModal(m => ({
                                  ...m,
                                  items: m.items.map((x, j) => j === idx ? { ...x, unit_price: val } : x)
                                }))
                              }}
                            />
                          </td>
                          <td style={S.td}>
                            <select
                              style={{ ...S.sel, width: 80, padding: '4px 6px' }}
                              value={it.gst_pct ?? 18}
                              onChange={e => {
                                const val = Number(e.target.value)
                                setPoModal(m => ({
                                  ...m,
                                  items: m.items.map((x, j) => j === idx ? { ...x, gst_pct: val } : x)
                                }))
                              }}
                            >
                              <option value="0">0%</option>
                              <option value="5">5%</option>
                              <option value="12">12%</option>
                              <option value="18">18%</option>
                              <option value="28">28%</option>
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
                <button type="button" style={S.btnSecondary} onClick={() => setPoModal(null)}>Cancel</button>
                <button
                  type="submit"
                  style={{ ...S.btnPrimary, background: '#0284c7' }}
                  disabled={converting}
                >
                  {converting ? 'Generating PO...' : '✓ Generate Purchase Order'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* ── 1-CLICK GENERATE DELIVERY CHALLAN (DC / GATE PASS) MODAL ───────── */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {dcModal && (
        <div style={S.ovl} onClick={() => setDcModal(null)}>
          <div style={{ ...S.modal, maxWidth: 640 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ fontWeight: 700, fontSize: 16, color: '#b45309', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>🚛</span> 1-Click Generate Delivery Challan / Gate Pass
              </div>
              <button style={S.close} onClick={() => setDcModal(null)}>✕</button>
            </div>

            <div style={{ fontSize: 12, color: '#b45309', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 6, padding: '10px 14px', marginBottom: 16 }}>
              Dispatching materials from Indent <strong>{dcModal.indentNumber || dcModal.num}</strong> via Outward Delivery Challan / Gate Pass. Logistics Multi-Agent will track gate verification.
            </div>

            <form onSubmit={handleConvertDcSubmit}>
              <div style={S.grid2}>
                <label style={S.lbl}>Gate Pass / DC Type *
                  <select
                    style={S.sel}
                    value={dcModal.dc_type}
                    onChange={e => setDcModal(m => ({ ...m, dc_type: e.target.value }))}
                  >
                    <option value="MATERIAL_OUT">Material Outward DC (Non-Returnable)</option>
                    <option value="RETURNABLE">Returnable Gate Pass (Job Work / Repair)</option>
                    <option value="OUT">Outward Vehicle &amp; Goods Dispatch</option>
                  </select>
                </label>

                <label style={S.lbl}>Consignee / Destination Party Name *
                  <input
                    style={S.inp}
                    placeholder="e.g. Precision Grinding &amp; Repairs Ltd"
                    value={dcModal.to_party}
                    onChange={e => setDcModal(m => ({ ...m, to_party: e.target.value }))}
                    required
                  />
                </label>
              </div>

              <div style={{ ...S.grid3, marginTop: 12 }}>
                <label style={S.lbl}>Vehicle Number
                  <input
                    style={S.inp}
                    placeholder="e.g. KA-25-AB-1234"
                    value={dcModal.vehicle_number}
                    onChange={e => setDcModal(m => ({ ...m, vehicle_number: e.target.value }))}
                  />
                </label>

                <label style={S.lbl}>Vehicle Type
                  <select
                    style={S.sel}
                    value={dcModal.vehicle_type}
                    onChange={e => setDcModal(m => ({ ...m, vehicle_type: e.target.value }))}
                  >
                    <option value="Truck">Truck / Lorry</option>
                    <option value="Tempo">Tempo / Mini Truck</option>
                    <option value="Pickup">Pickup Van</option>
                    <option value="Tractor">Tractor</option>
                    <option value="Hand Carry">Hand Carry / Courier</option>
                  </select>
                </label>

                <label style={S.lbl}>Driver / Handover Name
                  <input
                    style={S.inp}
                    placeholder="e.g. Ramesh Kumar"
                    value={dcModal.driver_name}
                    onChange={e => setDcModal(m => ({ ...m, driver_name: e.target.value }))}
                  />
                </label>
              </div>

              <label style={{ ...S.lbl, marginTop: 12 }}>Technical Dispatch Purpose
                <input
                  style={S.inp}
                  placeholder="e.g. Urgent machine overhaul and Dynamic Balancing at vendor workshop"
                  value={dcModal.dc_purpose}
                  onChange={e => setDcModal(m => ({ ...m, dc_purpose: e.target.value }))}
                />
              </label>

              {dcModal.dc_type === 'RETURNABLE' && (
                <label style={{ ...S.lbl, marginTop: 12 }}>Expected Return Date
                  <input
                    type="date"
                    style={S.inp}
                    value={dcModal.expected_return_date}
                    onChange={e => setDcModal(m => ({ ...m, expected_return_date: e.target.value }))}
                  />
                </label>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
                <button type="button" style={S.btnSecondary} onClick={() => setDcModal(null)}>Cancel</button>
                <button
                  type="submit"
                  style={{ ...S.btnPrimary, background: '#d97706' }}
                  disabled={converting}
                >
                  {converting ? 'Generating DC...' : '✓ Generate Delivery Challan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── 1-CLICK CONVERT TO CASH PURCHASE MODAL ── */}
      {cashModal && (
        <div style={S.ovl} onClick={() => setCashModal(null)}>
          <div style={{ ...S.modal, maxWidth: 640 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ fontWeight: 700, fontSize: 16, color: '#16a34a', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>💵</span> 1-Click Convert to Direct Cash Purchase (Spot Procurement)
              </div>
              <button style={S.close} onClick={() => setCashModal(null)}>✕</button>
            </div>

            <div style={{ fontSize: 12, color: '#166534', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 6, padding: '10px 14px', marginBottom: 16 }}>
              Fulfilling Indent <strong>{cashModal.num}</strong> via Direct Spot Cash Procurement. Stock will be atomically added to Store Inventory and an official Cash Purchase Voucher recorded.
            </div>

            <form onSubmit={handleConvertCashSubmit}>
              <div style={S.grid2}>
                <label style={S.lbl}>Supplier / Local Vendor Name *
                  <input
                    style={S.inp}
                    placeholder="e.g. Local Hardware &amp; Bearing Mart"
                    value={cashModal.vendor_name}
                    onChange={e => setCashModal(m => ({ ...m, vendor_name: e.target.value }))}
                    required
                  />
                </label>

                <label style={S.lbl}>Vendor GSTIN (Optional)
                  <input
                    style={S.inp}
                    placeholder="29AAAAA0000A1Z5 (or blank for cash vendor)"
                    value={cashModal.vendor_gstin}
                    onChange={e => setCashModal(m => ({ ...m, vendor_gstin: e.target.value }))}
                  />
                </label>
              </div>

              <div style={{ ...S.grid3, marginTop: 12 }}>
                <label style={S.lbl}>Cash Memo / Receipt No
                  <input
                    style={S.inp}
                    placeholder="e.g. CASH-MEMO-882"
                    value={cashModal.invoice_number}
                    onChange={e => setCashModal(m => ({ ...m, invoice_number: e.target.value }))}
                  />
                </label>

                <label style={S.lbl}>Payment Mode
                  <select
                    style={S.sel}
                    value={cashModal.payment_mode}
                    onChange={e => setCashModal(m => ({ ...m, payment_mode: e.target.value }))}
                  >
                    <option value="Cash">Cash</option>
                    <option value="Petty Cash">Petty Cash</option>
                    <option value="UPI / GPay / PhonePe">UPI / GPay / PhonePe</option>
                    <option value="Company Debit Card">Company Debit Card</option>
                    <option value="Bank Transfer (IMPS)">Bank Transfer (IMPS)</option>
                  </select>
                </label>

                <label style={S.lbl}>Payment Ref / Voucher No
                  <input
                    style={S.inp}
                    placeholder="e.g. UPI-REF-992384"
                    value={cashModal.payment_ref}
                    onChange={e => setCashModal(m => ({ ...m, payment_ref: e.target.value }))}
                  />
                </label>
              </div>

              <label style={{ ...S.lbl, marginTop: 12 }}>Remarks / Voucher Justification
                <input
                  style={S.inp}
                  placeholder="Notes for finance and store auditing..."
                  value={cashModal.remarks}
                  onChange={e => setCashModal(m => ({ ...m, remarks: e.target.value }))}
                />
              </label>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
                <button type="button" style={S.btnSecondary} onClick={() => setCashModal(null)}>Cancel</button>
                <button
                  type="submit"
                  style={{ ...S.btnPrimary, background: '#16a34a' }}
                  disabled={converting}
                >
                  {converting ? 'Processing Cash Purchase...' : '✓ Generate Cash Purchase Voucher & Intake Stock'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: DEPARTMENT RECEIVER SIGN & HANDOVER ── */}
      {receiverSignModal && (
        <div style={S.ovl} onClick={() => setReceiverSignModal(null)}>
          <div style={{ ...S.modal, maxWidth: 550 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: 16, color: '#0f766e' }}>
                  ✍️ Department Receiver Sign &amp; Handover
                </div>
                <div style={{ fontSize: 11, color: '#64748b' }}>
                  Indent #{receiverSignModal.indent_number || receiverSignModal.indentNumber} · Dept: {receiverSignModal.deptName}
                </div>
              </div>
              <button style={S.close} onClick={() => setReceiverSignModal(null)}>✕</button>
            </div>
            <form onSubmit={handleReceiverSign}>
              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: 12, marginBottom: 14, fontSize: 12 }}>
                <div style={{ fontWeight: 800, color: '#166534', marginBottom: 4 }}>
                  4-Step Workflow Complete Closure:
                </div>
                <div style={{ color: '#334155' }}>
                  Requisition Raised → SM Approved → Store Keeper Issued → <strong>Receiver Digital Sign &amp; Fitment</strong> → Out.
                </div>
              </div>

              <div style={S.grid2}>
                <label style={S.lbl}>Receiver Name *
                  <input
                    style={S.inp}
                    required
                    value={receiverSignForm.receiver_name}
                    onChange={e => setReceiverSignForm({ ...receiverSignForm, receiver_name: e.target.value })}
                  />
                </label>
                <label style={S.lbl}>Receiver Employee Code
                  <input
                    style={S.inp}
                    placeholder="e.g. EMP-2041"
                    value={receiverSignForm.receiver_emp_code}
                    onChange={e => setReceiverSignForm({ ...receiverSignForm, receiver_emp_code: e.target.value })}
                  />
                </label>
              </div>

              <div style={{ ...S.grid2, marginTop: 10 }}>
                <label style={S.lbl}>Receipt / Fitment Date
                  <input
                    type="date"
                    style={S.inp}
                    value={receiverSignForm.fitment_date}
                    onChange={e => setReceiverSignForm({ ...receiverSignForm, fitment_date: e.target.value })}
                  />
                </label>
                <label style={S.lbl}>Fitment Location / Machine Section
                  <input
                    style={S.inp}
                    placeholder="e.g. PM1 Press Section Roll #2"
                    value={receiverSignForm.fitment_location}
                    onChange={e => setReceiverSignForm({ ...receiverSignForm, fitment_location: e.target.value })}
                  />
                </label>
              </div>

              <label style={{ ...S.lbl, marginTop: 10 }}>Receiver Acknowledgment &amp; Signature Note
                <input
                  style={S.inp}
                  value={receiverSignForm.receiver_signature_note}
                  onChange={e => setReceiverSignForm({ ...receiverSignForm, receiver_signature_note: e.target.value })}
                />
              </label>

              <label style={{ ...S.lbl, marginTop: 10 }}>Fitment Observations / Operational Feedback (Optional)
                <textarea
                  style={{ ...S.inp, height: 60 }}
                  placeholder="e.g. Parts verified against manufacturer specs, installed and tested under normal load."
                  value={receiverSignForm.observations}
                  onChange={e => setReceiverSignForm({ ...receiverSignForm, observations: e.target.value })}
                />
              </label>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
                <button type="button" style={S.btnSecondary} onClick={() => setReceiverSignModal(null)}>Cancel</button>
                <button
                  type="submit"
                  style={{ ...S.btnPrimary, background: '#16a34a' }}
                  disabled={receiverSignSaving}
                >
                  {receiverSignSaving ? 'Signing...' : '✓ Confirm Receiver Signature & Close Indent'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── DEDICATED A3 GRN INVOICE & SIV PRINT MODAL (Pic 1 Exact Format) ── */}
      {a3PrintDoc && (
        <A3InvoicePrintModal
          docData={a3PrintDoc}
          onClose={() => setA3PrintDoc(null)}
          title={a3PrintDoc.title || 'STORE INDENT / ISSUE VOUCHER'}
        />
      )}

      {/* ── SEQUENCE ENFORCEMENT POPUP (Strict 4-Step Maker-Checker Sequence) ── */}
      {sequenceViolation && (
        <SequenceEnforcementModal
          isOpen={!!sequenceViolation}
          onClose={() => setSequenceViolation(null)}
          violationType={sequenceViolation.violationType}
          currentStep={sequenceViolation.currentStep}
          requiredStep={sequenceViolation.requiredStep}
          indentNumber={sequenceViolation.indentNumber}
          deptName={sequenceViolation.deptName}
          onAction={(targetStep) => {
            if (targetStep === 2 && sequenceViolation.targetId) {
              action(sequenceViolation.targetId, 'l2_approve')
            } else if (targetStep === 3) {
              setTabKey('issue')
            } else if (targetStep === 4 && sequenceViolation.targetId) {
              const ind = rows.find(r => r.id === sequenceViolation.targetId) || detail
              if (ind) setReceiverSignModal(ind)
            }
          }}
        />
      )}
    </div>
  )
}

const S = {
  page: { padding: 20, background: '#f6f5f0', minHeight: '100vh', color: '#1b1b1d', fontFamily: 'sans-serif' },
  hdr: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 },
  title: { fontSize: 22, fontWeight: 700, color: '#1b1b1d' },
  tabs: { display: 'flex', gap: 5, marginBottom: 16, flexWrap: 'wrap' },
  tab: a => ({ padding: '8px 16px', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 700, background: a ? '#0f766e' : '#ffffff', color: a ? '#ffffff' : '#64748b', border: a ? '1px solid #0f766e' : '1px solid #e7e6df' }),
  card: { background: '#ffffff', border: '1px solid #e7e6df', borderRadius: 10, padding: 16, marginBottom: 14 },
  tbl: { width: '100%', borderCollapse: 'collapse', fontSize: 12 },
  th: { padding: '9px 12px', textAlign: 'left', color: '#64748b', fontWeight: 600, fontSize: 11, background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textTransform: 'uppercase', letterSpacing: '0.04em' },
  td: { padding: '9px 12px', borderBottom: '1px solid #f1f5f9', verticalAlign: 'middle' },
  badge: (c) => ({ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: c + '22', color: c, border: `1px solid ${c}44`, display: 'inline-block' }),
  btnPrimary: { background: '#0f766e', color: '#ffffff', border: 'none', borderRadius: 6, padding: '8px 16px', fontWeight: 700, fontSize: 12, cursor: 'pointer' },
  btnSecondary: { background: '#ffffff', color: '#0f172a', border: '1px solid #cbd5e1', borderRadius: 6, padding: '8px 16px', fontWeight: 600, fontSize: 12, cursor: 'pointer' },
  btnSm: (c) => ({ background: c || '#0f766e', color: c === '#ffffff' ? '#0f172a' : '#ffffff', border: c === '#ffffff' ? '1px solid #cbd5e1' : 'none', borderRadius: 4, padding: '4px 9px', fontWeight: 600, fontSize: 11, cursor: 'pointer' }),
  lbl: { display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11, color: '#475569', fontWeight: 600 },
  inp: { background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: 6, padding: '7px 10px', color: '#0f172a', fontSize: 12, outline: 'none', width: '100%', boxSizing: 'border-box' },
  sel: { background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: 6, padding: '7px 10px', color: '#0f172a', fontSize: 12, width: '100%', boxSizing: 'border-box' },
  grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },
  grid3: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 },
  grid4: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 },
  ovl: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.75)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 5000, padding: '30px 16px', boxSizing: 'border-box', overflowY: 'auto' },
  modal: { background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: 12, padding: 22, width: '100%', maxWidth: 860, margin: '2vh auto', boxSizing: 'border-box' },
  close: { background: 'none', border: 'none', color: '#94a3b8', fontSize: 18, cursor: 'pointer' },
  kpi: (c) => ({ background: '#ffffff', border: `1px solid ${c}44`, borderRadius: 8, padding: 12, textAlign: 'center' }),
  kpiV: (c) => ({ fontSize: 20, fontWeight: 800, color: c }),
  kpiL: { fontSize: 11, color: '#64748b', marginTop: 2, fontWeight: 600 },
  revBox: { background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6, padding: 10 },
  revLabel: { fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 700, display: 'block', marginBottom: 2 },
  revVal: { fontSize: 12, fontWeight: 700, color: '#0f172a' },
  dropMenu: { position: 'absolute', top: '100%', left: 0, right: 0, maxHeight: 220, overflowY: 'auto', background: '#fff', border: '1px solid #cbd5e1', borderRadius: 6, boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', zIndex: 100 },
  err: { background: '#fee2e2', border: '1px solid #fca5a5', color: '#dc2626', padding: '8px 12px', borderRadius: 6, fontSize: 12, marginBottom: 12 },
  ok: { background: '#dcfce7', border: '1px solid #86efac', color: '#15803d', padding: '8px 12px', borderRadius: 6, fontSize: 12, marginBottom: 12 }
}
