import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '../context/AuthContext'

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
  { key: 'list',        label: '📋 All Indents & Vouchers',   who: () => true },
  { key: 'raise',       label: '✨ Raise / Edit Indent',      who: u => (u.role_level || 1) >= 1 },
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
  const [tabKey, setTabKey] = useState('list')
  const printRef = useRef(null)

  const [rows, setRows] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [fStatus, setFStatus] = useState('')
  const [fDept, setFDept] = useState('')
  const [page, setPage] = useState(1)
  const [searchTerm, setSearchTerm] = useState('')
  const [matSearch, setMatSearch] = useState({})
  const [matDropOpen, setMatDropOpen] = useState({})
  const [depts, setDepts] = useState([])
  const [mats, setMats] = useState([])
  const [sections, setSections] = useState([])
  const [machines, setMachines] = useState([])
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

  // Form state for Raise / Edit (Priority removed per user requirement)
  const blankForm = () => ({
    department_id: user?.department_id || '',
    required_date: '',
    remarks: '',
    section: '',
    machine_id: '',
    machine_context: '',
    items: [{ material_id: '', required_qty: '', uom: '', purpose: '', component_position: '', reason_code: 'Routine Replacement' }]
  })
  const [form, setForm] = useState(blankForm())
  const [saving, setSaving] = useState(false)
  const [editId, setEditId] = useState(null)
  const [reviewMode, setReviewMode] = useState(false)
  const [formErrors, setFormErrors] = useState({})

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
    if (fDept) p.set('dept', fDept)
    else if (user?.role_level === 3 && user?.dept_code !== 'STORE') p.set('dept', user.department_id)
    if (searchTerm) p.set('search', searchTerm)

    const r = await API(`/indent?${p}`)
    if (r.success) { setRows(r.data); setTotal(r.total) }
    setLoading(false)
  }, [page, fStatus, fDept, searchTerm, user])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    API('/users/departments').then(r => { if (r.success) setDepts(r.data) })
    API('/master/materials?limit=2500').then(r => { if (r.success) setMats(r.data) })
    API('/sections').then(r => { if (r.success) setSections(r.data) })
    API('/master/machines').then(r => { if (r.success) setMachines(r.data) })
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
  const lineTotal = it => (parseFloat(it.required_qty) || 0) * matPrice(matByID(it.material_id))
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
      setAppendForm({ material_id: '', required_qty: '1', uom: 'NOS', component_position: '', reason_code: 'Routine Replacement', purpose: '' })
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
      'Reason Code', 'Technical Justification / Purpose', 'Work Order / Remarks', 'Status', 'Cancellation Reason', 'Total Value (INR)'
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

  // ── Company Invoice Model Export & Printing ──────────────────────────────────
  const printCompanyInvoice = async (indentId) => {
    const win = window.open('', '_blank', 'width=1000,height=800')
    win.document.write('<html><body style="font-family:sans-serif;padding:30px;color:#64748b;"><h2>Loading SRI M.K. Paper Mill Invoice Voucher...</h2></body></html>')
    try {
      const r = await API(`/indent/${indentId}`)
      if (!r.success) return win.document.body.innerHTML = `<h3>Error: ${r.message}</h3>`
      const d = r.data
      const totalAmount = d.items?.reduce((acc, it) => acc + (Number(it.line_value) || (Number(it.required_qty) * Number(it.matPrice || 0))), 0) || Number(d.total_value || 0)
      const words = numberToWords(totalAmount)

      win.document.open()
      win.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>VOUCHER-${d.indent_number} — SRI M.K. PAPER MILLS</title>
          <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 12px; color: #1e293b; padding: 36px; background: #fff; line-height: 1.4; }
            .invoice-box { border: 2px solid #0f766e; padding: 24px; border-radius: 8px; position: relative; }
            
            /* Company Header */
            .company-header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0f766e; padding-bottom: 16px; margin-bottom: 16px; }
            .company-logo-text { font-size: 24px; font-weight: 800; color: #0f766e; letter-spacing: -0.02em; text-transform: uppercase; }
            .company-tagline { font-size: 11px; color: #475569; font-weight: 600; text-transform: uppercase; margin-top: 2px; }
            .company-address { font-size: 11px; color: #64748b; margin-top: 4px; line-height: 1.5; }
            .doc-title-badge { background: #0f766e; color: #ffffff; padding: 6px 14px; border-radius: 4px; font-size: 12px; font-weight: 700; text-align: center; text-transform: uppercase; letter-spacing: 0.05em; display: inline-block; }
            
            /* Metadata Grid */
            .meta-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 14px; margin-bottom: 18px; }
            .meta-item { display: flex; flex-direction: column; }
            .meta-label { font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.04em; }
            .meta-val { font-size: 12px; font-weight: 700; color: #0f172a; margin-top: 2px; }
            
            /* Table Specifications */
            .spec-table { width: 100%; border-collapse: collapse; margin-bottom: 18px; font-size: 11px; }
            .spec-table th { background: #0f766e; color: #ffffff; padding: 8px 10px; text-align: left; font-weight: 700; font-size: 10px; text-transform: uppercase; letter-spacing: 0.03em; border: 1px solid #0f766e; }
            .spec-table td { padding: 8px 10px; border: 1px solid #e2e8f0; vertical-align: top; }
            .spec-table tr:nth-child(even) { background: #f8fafc; }
            .code-pill { font-family: monospace; font-weight: 700; color: #0f766e; background: #f0fdfa; padding: 2px 6px; border-radius: 3px; border: 1px solid #ccfbf1; font-size: 10px; display: inline-block; }
            .reason-pill { font-size: 9px; font-weight: 700; padding: 2px 6px; border-radius: 10px; background: #e0f2fe; color: #0369a1; display: inline-block; }
            
            /* Valuation & Words Summary */
            .summary-wrap { display: flex; justify-content: space-between; align-items: flex-start; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; padding: 14px; margin-bottom: 20px; }
            .words-box { flex: 1; padding-right: 20px; }
            .amount-box { text-align: right; min-width: 220px; }
            
            /* Declaration */
            .declaration { font-size: 10px; color: #64748b; font-style: italic; border-top: 1px dashed #cbd5e1; padding-top: 10px; margin-bottom: 24px; }
            
            /* 4 Signatures Grid */
            .sign-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; border-top: 2px solid #0f766e; padding-top: 16px; margin-top: 20px; }
            .sign-box { text-align: center; border: 1px dashed #cbd5e1; border-radius: 6px; padding: 14px 8px; font-size: 11px; font-weight: 600; color: #334155; }
            .sign-sub { font-size: 9px; color: #64748b; margin-top: 2px; font-weight: normal; }
            
            @media print {
              body { padding: 10px; }
              .invoice-box { border-width: 1px; padding: 16px; }
              @page { size: portrait; margin: 12mm; }
            }
          </style>
        </head>
        <body>
          <div class="invoice-box">
            <!-- Top Header -->
            <div class="company-header">
              <div>
                <div class="company-logo-text">SRI M.K. PAPER MILLS PVT. LTD.</div>
                <div class="company-tagline">Kraft Paper &amp; Packaging Board Manufacturing Division</div>
                <div class="company-address">
                  Factory: Plot No. 12/A, Industrial Corridor, Paper Mill Road<br>
                  GSTIN: <strong>33AAACM1234F1Z5</strong> &nbsp;|&nbsp; CIN: <strong>U21012TN2015PTC099881</strong> &nbsp;|&nbsp; State Code: 33
                </div>
              </div>
              <div style="text-align: right;">
                <div class="doc-title-badge">Material Indent &amp; Issuance Voucher</div>
                <div style="font-size: 11px; color: #64748b; margin-top: 6px;">Voucher No: <strong style="color:#0f766e;">${d.indent_number}</strong></div>
                <div style="font-size: 10px; color: #94a3b8;">Printed: ${new Date().toLocaleString('en-IN')}</div>
              </div>
            </div>

            <!-- Metadata Info Grid -->
            <div class="meta-grid">
              <div class="meta-item">
                <span class="meta-label">Indent / Voucher No</span>
                <span class="meta-val">${d.indent_number}</span>
              </div>
              <div class="meta-item">
                <span class="meta-label">Date &amp; Time Raised</span>
                <span class="meta-val">${d.date?.slice(0, 10) || '—'} ${d.raisedAt ? new Date(d.raisedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : ''}</span>
              </div>
              <div class="meta-item">
                <span class="meta-label">Department</span>
                <span class="meta-val">${d.deptName || '—'}</span>
              </div>
              <div class="meta-item">
                <span class="meta-label">Voucher Status</span>
                <span class="meta-val" style="color:#0f766e;">● ${d.status}</span>
              </div>

              <div class="meta-item">
                <span class="meta-label">Raised By (Indentor)</span>
                <span class="meta-val" style="color:#0f766e;">
                  ${d.raisedByName || d.raisedBy || 'Store Operator'}
                  <div style="font-size: 10px; color: #475569; font-weight: 600;">
                    ${d.raisedByEmpCode ? `[${d.raisedByEmpCode}] ` : ''}${d.raisedByRole || 'Technical Staff'}
                  </div>
                </span>
              </div>
              <div class="meta-item">
                <span class="meta-label">Plant Section</span>
                <span class="meta-val">${d.sectionCode ? `[${d.sectionCode}] ${d.sectionName || ''}` : d.sectionName || 'Plant General'}</span>
              </div>
              <div class="meta-item">
                <span class="meta-label">Machine / Equipment Context</span>
                <span class="meta-val">${d.machineName ? `[${d.machineCode}] ${d.machineName}` : d.machine_id || 'General Mill Spares'}</span>
              </div>
              <div class="meta-item">
                <span class="meta-label">Required By Date</span>
                <span class="meta-val">${d.required_date?.slice(0, 10) || 'Immediate'}</span>
              </div>
            </div>

            <!-- Itemized Specifications Table -->
            <table class="spec-table">
              <thead>
                <tr>
                  <th style="width: 25px;">#</th>
                  <th style="width: 70px;">Code</th>
                  <th>Material Name &amp; Full Specification</th>
                  <th style="width: 80px;">HSN / Rack</th>
                  <th>Position / Fitment</th>
                  <th>Reason &amp; Technical Purpose</th>
                  <th style="text-align: right; width: 65px;">Req Qty</th>
                  <th style="text-align: right; width: 65px;">Issued</th>
                  <th style="text-align: right; width: 75px;">Unit Rate</th>
                  <th style="text-align: right; width: 90px;">Total Value</th>
                </tr>
              </thead>
              <tbody>
                ${(d.items || []).map((it, idx) => {
                  const price = Number(it.matPrice || it.unit_price || 0)
                  const lineVal = Number(it.lineValue || it.line_value || (Number(it.required_qty) * price))
                  return `
                    <tr>
                      <td style="text-align: center;">${idx + 1}</td>
                      <td><span class="code-pill">${it.materialCode || '—'}</span></td>
                      <td>
                        <strong style="color: #0f172a;">${it.materialName || '—'}</strong>
                        ${it.categoryName ? `<div style="font-size: 10px; color: #64748b;">${it.categoryName}</div>` : ''}
                      </td>
                      <td>
                        <div style="font-family: monospace; font-size: 10px;">${it.hsnCode || '4802'}</div>
                        <div style="font-size: 9px; color: #64748b;">${it.binLocation || '—'}</div>
                      </td>
                      <td>${it.component_position || '—'}</td>
                      <td>
                        <span class="reason-pill">${it.reason_code || 'Routine Replacement'}</span>
                        ${it.purpose ? `<div style="font-size: 10px; color: #1e293b; margin-top: 3px; font-weight: 500;">${it.purpose}</div>` : ''}
                      </td>
                      <td style="text-align: right; font-weight: 600;">${it.required_qty} ${it.uom || it.matUom || ''}</td>
                      <td style="text-align: right; font-weight: 700; color: #16a34a;">${it.issued_qty != null ? it.issued_qty : 0} ${it.uom || it.matUom || ''}</td>
                      <td style="text-align: right;">₹${price.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                      <td style="text-align: right; font-weight: 700; color: #0f766e;">₹${lineVal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    </tr>
                  `
                }).join('')}
              </tbody>
            </table>

            <!-- Commercial Summary Box -->
            <div class="summary-wrap">
              <div class="words-box">
                <div style="font-size: 10px; font-weight: 700; color: #047857; text-transform: uppercase;">Amount in Words</div>
                <div style="font-size: 12px; font-weight: 700; color: #065f46; margin-top: 2px;">${words}</div>
                ${d.remarks ? `
                  <div style="font-size: 11px; color: #1e293b; margin-top: 8px; background: #ffffff; padding: 8px 12px; border-radius: 4px; border: 1px solid #bbf7d0;">
                    <strong>Work Order Reference / Technical Justification:</strong><br>${d.remarks}
                  </div>
                ` : ''}
              </div>
              <div class="amount-box">
                <div style="font-size: 10px; font-weight: 700; color: #047857; text-transform: uppercase;">Total Indent Valuation</div>
                <div style="font-size: 18px; font-weight: 800; color: #0f766e; margin-top: 2px;">₹${totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
              </div>
            </div>

            <!-- Declaration -->
            <div class="declaration">
              Declaration: Certified that the materials/spares indented above are strictly required for mill operations, breakdown repair, or scheduled preventive maintenance. Stock ledger adjustments and fitment tracking will be governed per PIIMAS protocol.
            </div>

            <!-- 4 Signatures Block -->
            <div class="sign-grid">
              <div class="sign-box">
                <div style="font-weight: 700; color: #0f172a;">${d.raisedByName || d.raisedBy || 'Technical Staff'}</div>
                <div style="font-size: 10px; color: #0f766e; font-weight: 600;">${d.raisedByEmpCode ? `Emp ID: ${d.raisedByEmpCode}` : 'Indentor'}</div>
                <div class="sign-sub">${d.raisedByRole || 'Technical Staff'}</div>
              </div>
              <div class="sign-box">
                <div>Authorized Signatory</div>
                <div>HOD Approval</div>
                <div class="sign-sub">Department Head</div>
              </div>
              <div class="sign-box">
                <div>Store Incharge</div>
                <div>Store Officer / Issued By</div>
                <div class="sign-sub">Store &amp; Inventory</div>
              </div>
              <div class="sign-box">
                <div>Receiver Signature</div>
                <div>Acknowledged &amp; Fitment</div>
                <div class="sign-sub">Maintenance Eng.</div>
              </div>
            </div>
          </div>
        </body>
        </html>
      `)
      win.document.close()
      win.focus()
      setTimeout(() => { win.print(); win.close() }, 400)
    } catch (e) {
      win.document.body.innerHTML = `<h3>Failed to load Company Invoice: ${e.message}</h3>`
    }
  }

  // ── Form Actions ─────────────────────────────────────────────────────────────
  const validateForm = () => {
    const errs = {}
    if (!form.department_id) errs.department_id = 'Select department'
    if (!form.required_date) errs.required_date = 'Pick required date'
    const itemErrs = form.items.map(it => {
      const e = {}
      if (!it.material_id) e.material_id = 'Pick a material from dropdown'
      if (!it.required_qty || Number(it.required_qty) <= 0) e.required_qty = 'Qty must be > 0'
      return e
    })
    if (itemErrs.some(e => Object.keys(e).length)) errs.items = itemErrs
    return errs
  }

  const goToReview = e => {
    e.preventDefault()
    const errs = validateForm()
    setFormErrors(errs)
    if (Object.keys(errs).length) { flash(false, 'Fix the highlighted fields before review'); return }
    setReviewMode(true)
  }

  const save = async () => {
    setSaving(true)
    const items = form.items.map(it => ({ ...it, uom: matByID(it.material_id)?.uom || it.uom }))
    const r = editId
      ? await API(`/indent/${editId}`, { method: 'PUT', body: JSON.stringify({ ...form, items }) })
      : await API('/indent', { method: 'POST', body: JSON.stringify({ ...form, items }) })
    setSaving(false)
    if (r.success) {
      setForm(blankForm()); setEditId(null); setTabKey('list'); setReviewMode(false); setFormErrors({}); load()
      flash(true, editId ? `Indent updated: ${r.data?.indent_number || editId}` : `Indent created: ${r.data?.indent_number}`)
    } else {
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
      items: (d.items || []).map(it => ({
        material_id: it.material_id,
        required_qty: it.required_qty,
        uom: it.uom,
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
    if (r.success) { load(); flash(true, 'Done'); if (detail?.id === id) openDetail(id) }
    else flash(false, r.message || 'Failed')
  }

  const submitIssue = async (e) => {
    e.preventDefault()
    if (!detail) return
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
          <button style={{ ...S.btnSecondary, background: '#0f766e', color: '#fff', fontWeight: 700 }} onClick={() => setTabKey('raise')}>
            ＋ Raise New Indent
          </button>
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

                          {/* Indent No */}
                          <td style={S.td}>
                            <span
                              onClick={() => openDetail(r.id)}
                              style={{ fontFamily: 'monospace', fontSize: 12, color: '#0f766e', fontWeight: 700, cursor: 'pointer', textDecoration: 'underline' }}
                              title="Click to View Full Details & Append Spares"
                            >
                              {r.indentNumber}
                            </span>
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
                                🖨️ Invoice
                              </button>
                              <button style={S.btnSm('#1e293b')} onClick={() => openDetail(r.id)}>View</button>

                              {/* Edit available for unissued/uncancelled indents */}
                              {r.status !== 'Issued' && r.status !== 'Closed' && r.status !== 'Cancelled' && (
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

                              {/* Approvals */}
                              {r.status === 'Submitted' && (user?.role_level >= 3) && (
                                <button style={S.btnSm('#0891b2')} onClick={() => action(r.id, 'approve/l1')}>✓ L1</button>
                              )}
                              {r.status === 'L1 Approved' && (user?.role_level >= 4) && (
                                <button style={S.btnSm('#7c3aed')} onClick={() => action(r.id, 'approve/l2')}>✓ L2</button>
                              )}

                              {/* Create PO from Approved Indent */}
                              {['Approved', 'L2 Approved'].includes(r.status) && (
                                <button
                                  style={{ ...S.btnSm('#0284c7'), padding: '4px 8px', display: 'flex', alignItems: 'center', gap: 3 }}
                                  onClick={() => {
                                    window.location.href = `/purchase?indent_id=${r.id}`
                                  }}
                                  title="Create Purchase Order against this approved indent"
                                >
                                  🛒 + PO
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
            <div style={S.grid3}>
              <label style={S.lbl}>Department *
                <select
                  id="raise-dept"
                  style={{ ...S.sel, ...(formErrors.department_id ? { border: '1px solid #ef4444' } : {}) }}
                  value={form.department_id}
                  onChange={e => setForm(f => ({ ...f, department_id: e.target.value }))}
                  required
                  disabled={user?.role_level < 4 && user?.dept_code !== 'STORE'}
                >
                  <option value="">-- Select Department --</option>
                  {depts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
                {formErrors.department_id && <span style={{ fontSize: 10, color: '#ef4444' }}>{formErrors.department_id}</span>}
              </label>

              <label style={S.lbl}>Required By Date *
                <input
                  id="raise-required-date"
                  style={{ ...S.inp, ...(formErrors.required_date ? { border: '1px solid #ef4444' } : {}) }}
                  type="date"
                  value={form.required_date}
                  onChange={e => setForm(f => ({ ...f, required_date: e.target.value }))}
                  required
                />
                {formErrors.required_date && <span style={{ fontSize: 10, color: '#ef4444' }}>{formErrors.required_date}</span>}
              </label>

              <label style={S.lbl}>Plant Section / Area *
                <select
                  id="raise-section"
                  style={S.sel}
                  value={String(form.section || '')}
                  onChange={e => setForm(f => ({ ...f, section: e.target.value }))}
                >
                  <option value="">-- Select Plant Section --</option>
                  {sections.map(s => (
                    <option key={s.id} value={s.id}>
                      [{s.sectionCode || s.code}] {s.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div style={{ ...S.grid2, marginTop: 12 }}>
              <label style={S.lbl}>Machine / Equipment Selection &amp; Context
                <div style={{ display: 'flex', gap: 6 }}>
                  <select
                    style={{ ...S.sel, flex: 1 }}
                    value={String(form.machine_id || '')}
                    onChange={e => setForm(f => ({ ...f, machine_id: e.target.value }))}
                  >
                    <option value="">-- Select Registered Machine --</option>
                    {machines.map(m => (
                      <option key={m.id} value={m.id}>
                        [{m.code}] {m.name} ({m.type || 'Machine'})
                      </option>
                    ))}
                  </select>
                </div>
              </label>

              <label style={S.lbl}>General Remarks / Work Order Reference &amp; Justification
                <textarea
                  id="raise-remarks"
                  style={{ ...S.inp, minHeight: 38, resize: 'vertical' }}
                  placeholder="e.g. WO-2026-0815: Emergency breakdown repair due to excessive bearing temperature and vibration on drive roller."
                  value={form.remarks}
                  onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))}
                  rows={2}
                />
              </label>
            </div>

            {/* Line Items Container */}
            <div style={{ fontSize: 13, fontWeight: 700, color: '#0f766e', marginTop: 20, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Line Items &amp; Technical Specifications
            </div>

            {form.items.map((it, i) => {
              const mat = matByID(it.material_id)
              const price = matPrice(mat)
              const filtered = mats.filter(m =>
                !(matSearch[i] || '') ||
                (m.name || '').toLowerCase().includes((matSearch[i] || '').toLowerCase()) ||
                (m.code || '').toLowerCase().includes((matSearch[i] || '').toLowerCase())
              ).slice(0, 40)

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
                          placeholder="🔍 Type material name or code..."
                          value={matSearch[i] !== undefined ? matSearch[i] : (mat ? `${mat.name} [${mat.code}]` : '')}
                          onFocus={() => setMatDropOpen(d => ({ ...d, [i]: true }))}
                          onChange={e => {
                            setMatSearch(s => ({ ...s, [i]: e.target.value }))
                            setMatDropOpen(d => ({ ...d, [i]: true }))
                          }}
                          onBlur={() => setTimeout(() => setMatDropOpen(d => ({ ...d, [i]: false })), 180)}
                        />
                      </label>
                      {formErrors.items?.[i]?.material_id && <span style={{ fontSize: 10, color: '#ef4444' }}>{formErrors.items[i].material_id}</span>}

                      {matDropOpen[i] && (
                        <div style={S.dropMenu}>
                          {filtered.map(m => (
                            <div
                              key={m.id}
                              onMouseDown={() => {
                                setItem(i, 'material_id', m.id)
                                setItem(i, 'uom', m.uom || 'NOS')
                                setMatSearch(s => ({ ...s, [i]: `${m.name} [${m.code}]` }))
                                setMatDropOpen(d => ({ ...d, [i]: false }))
                              }}
                              style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 12, borderBottom: '1px solid #f1f5f9' }}
                            >
                              <div style={{ fontWeight: 600, color: '#0f172a' }}>{m.name}</div>
                              <div style={{ fontSize: 10, color: '#64748b', display: 'flex', gap: 10, marginTop: 2 }}>
                                <span style={{ fontFamily: 'monospace', color: '#0f766e', fontWeight: 700 }}>[{m.code}]</span>
                                <span>Stock: <strong style={{ color: m.current_stock > 0 ? '#16a34a' : '#dc2626' }}>{m.current_stock} {m.uom}</strong></span>
                                <span>Rate: ₹{Number(m.unit_price || 0).toFixed(2)}</span>
                                {m.hsn_code && <span>HSN: {m.hsn_code}</span>}
                              </div>
                            </div>
                          ))}
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
                    <label style={S.lbl}>Reason Code
                      <select
                        style={S.sel}
                        value={it.reason_code || 'Routine Replacement'}
                        onChange={e => setItem(i, 'reason_code', e.target.value)}
                      >
                        {REASON_CODES.map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </label>
                  </div>

                  <div style={{ ...S.grid2, marginTop: 8 }}>
                    <label style={S.lbl}>Position / Mechanical Fitment Location
                      <input
                        style={S.inp}
                        placeholder="e.g. Drive Side Front Bearing Housing, Tender Side Pump Flange..."
                        value={it.component_position}
                        onChange={e => setItem(i, 'component_position', e.target.value)}
                      />
                    </label>

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
                👁 Review &amp; Confirm Indent
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* ── REVIEW & CONFIRM MODAL ─────────────────────────────────────────── */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {reviewMode && (
        <div style={S.ovl} onClick={() => setReviewMode(false)}>
          <div style={S.modal} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ fontWeight: 700, fontSize: 16, color: '#0f766e' }}>Review Indent Voucher Before Submission</div>
              <button style={S.close} onClick={() => setReviewMode(false)}>✕</button>
            </div>

            <div style={{ fontSize: 12, color: '#0369a1', background: '#e0f2fe', border: '1px solid #bae6fd', borderRadius: 6, padding: '10px 14px', marginBottom: 16 }}>
              ℹ️ Please verify the indentor profile, equipment context, line items, and technical justifications below. Once confirmed, this indent will enter the approval workflow.
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
                      <td style={S.td}>{fmt(matPrice(mat))}</td>
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

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 18 }}>
              <button type="button" style={S.btnSecondary} onClick={() => setReviewMode(false)}>← Back &amp; Edit</button>
              <button type="button" style={S.btnPrimary} disabled={saving} onClick={save}>
                {saving ? 'Saving...' : (editId ? '✓ Save Changes' : '✓ Confirm & Raise Indent')}
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
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  style={{ ...S.btnPrimary, background: '#0f766e', padding: '6px 12px', fontSize: 12 }}
                  onClick={() => printCompanyInvoice(detail.id)}
                >
                  🖨️ Print Invoice Model
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

            {detail.remarks && (
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6, padding: 10, marginTop: 10, fontSize: 12 }}>
                <span style={S.revLabel}>Work Order / Technical Remarks</span>
                <div style={{ color: '#1e293b', marginTop: 2, fontWeight: 500 }}>{detail.remarks}</div>
              </div>
            )}

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
                                setAppendForm(f => ({ ...f, material_id: m.id, uom: m.uom }))
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
                <div style={{ ...S.grid2, marginTop: 8 }}>
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

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
              {['Approved', 'L2 Approved'].includes(detail.status) && (
                <button
                  style={{ ...S.btnSm('#0284c7'), padding: '6px 14px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}
                  onClick={() => {
                    window.location.href = `/purchase?indent_id=${detail.id}`
                  }}
                >
                  🛒 Create Purchase Order (PO)
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
