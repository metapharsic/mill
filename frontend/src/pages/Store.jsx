import React, { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { ConfirmModal } from '../components/ui/Modal'
import { FormField } from '../components/ui/FormField'
import ProductDetailModal from '../components/ProductDetailModal'
import { ExternalLink } from 'lucide-react'
import { GST_SLABS } from './Purchase'

const API = '/api'
const h = () => ({ Authorization: `Bearer ${localStorage.getItem('mk_token')}` })
const json = () => ({ ...h(), 'Content-Type': 'application/json' })

const STATUS_COLOR = {
  Requested:        { bg: '#fef9c3', color: '#854d0e' },
  Submitted:        { bg: '#fef9c3', color: '#854d0e' },
  'L1 Approved':    { bg: '#e0e7ff', color: '#3730a3' },
  'L2 Approved':    { bg: '#dbeafe', color: '#1e40af' },
  Approved:         { bg: '#dbeafe', color: '#1e40af' },
  Rejected:         { bg: '#fee2e2', color: '#dc2626' },
  'Partially Issued':{ bg: '#ffedd5', color: '#c2410c' },
  Issued:           { bg: '#dcfce7', color: '#15803d' },
  'In Service':     { bg: '#dcfce7', color: '#15803d' },
  active:           { bg: '#dcfce7', color: '#15803d' },
  Failed:           { bg: '#fee2e2', color: '#dc2626' },
  Retired:          { bg: '#f3f4f6', color: '#4b5563' },
  Closed:           { bg: '#f3f4f6', color: '#4b5563' },
  Cancelled:        { bg: '#f3f4f6', color: '#9ca3af' },
  Pending:          { bg: '#fef9c3', color: '#854d0e' },
}

function Badge({ status }) {
  const s = STATUS_COLOR[status] || { bg: '#1b1b1d', color: '#8a8a90' }
  return <span style={{ fontSize:11, padding:'2px 8px', borderRadius:999, fontWeight:600, background:s.bg, color:s.color }}>{status}</span>
}

function Msg({ msg, ok }) {
  if (!msg) return null
  return <div style={{ background: ok?'#dcfce7':'#fee2e2', color: ok?'#15803d':'#dc2626', padding:'8px 12px', borderRadius:6, fontSize:13, marginBottom:8 }}>{msg}</div>
}

export default function Store({ onNavigate }) {
  const { user } = useAuth()
  const { addToast } = useToast()
  const [tab, setTab] = useState('inward')
  const [mats, setMats] = useState([])
  const [depts, setDepts] = useState([])
  const [machines, setMachines] = useState([])
  const [positions, setPositions] = useState([])
  const [assets, setAssets] = useState([])
  const [vendors, setVendors] = useState([])
  const [purchaseOrders, setPurchaseOrders] = useState([])
  const [activePoDetails, setActivePoDetails] = useState(null)
  const [selectedPoLineId, setSelectedPoLineId] = useState('')
  const [inwardBatchMode, setInwardBatchMode] = useState(false)
  const [batchInwardQtys, setBatchInwardQtys] = useState({})
  const [batchSaving, setBatchSaving] = useState(false)
  const [inwardMatSearch, setInwardMatSearch] = useState('')
  const [inwardMatDropOpen, setInwardMatDropOpen] = useState(false)
  const [searchLot, setSearchLot] = useState('')
  const [lotTraceData, setLotTraceData] = useState([])
  const [lotSearched, setLotSearched] = useState(false)
  const [lotError, setLotError] = useState(false)
  
  // Issue desks state
  const [issues, setIssues] = useState([])
  const [msg, setMsg] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [matSearch, setMatSearch] = useState('')
  const [subMatSearch, setSubMatSearch] = useState('')
  const [deptFilter, setDeptFilter] = useState('')
  const [deptSummary, setDeptSummary] = useState([])
  const [editModal, setEditModal] = useState(null)
  const [editForm, setEditForm] = useState(null)
  const [selectedProductModalId, setSelectedProductModalId] = useState(null)

  // Inward & Outward States
  const [inwardList, setInwardList] = useState([])
  const [inwardSummary, setInwardSummary] = useState({})
  const [inwardLoading, setInwardLoading] = useState(false)
  const [inwardStoreType, setInwardStoreType] = useState('')
  const [inwardSearch, setInwardSearch] = useState('')
  const [inwardPage, setInwardPage] = useState(1)
  const [inwardTotal, setInwardTotal] = useState(0)
  const INWARD_LIMIT = 20
  const [inwardModal, setInwardModal] = useState(false)
  const [inwardForm, setInwardForm] = useState({
    material_id: '',
    in_qty: '',
    unit_price: '',
    gst_pct: 18,
    inward_type: 'grn',
    reference_type: 'PO',
    reference_id: '',
    vendor_id: '',
    vendor_name: '',
    bin_location: '',
    batch_number: '',
    quality_status: 'Accepted',
    remarks: ''
  })
  const [inwardVoucher, setInwardVoucher] = useState(null)
  const [vendorPickMode, setVendorPickMode] = useState('list')

  const [outwardList, setOutwardList] = useState([])
  const [outwardSummary, setOutwardSummary] = useState({})
  const [outwardLoading, setOutwardLoading] = useState(false)
  const [outwardStoreType, setOutwardStoreType] = useState('')
  const [outwardDeptFilter, setOutwardDeptFilter] = useState('')
  const [outwardSearch, setOutwardSearch] = useState('')
  const [outwardPage, setOutwardPage] = useState(1)
  const [outwardTotal, setOutwardTotal] = useState(0)
  const OUTWARD_LIMIT = 20
  const [outwardModal, setOutwardModal] = useState(false)
  const [outwardForm, setOutwardForm] = useState({
    material_id: '',
    out_qty: '',
    department_id: '',
    machine_id: '',
    position_id: '',
    outward_type: 'issue',
    issued_to: '',
    purpose: '',
    serial_number: '',
    batch_number: '',
    reference_type: 'WORK_ORDER',
    reference_id: '',
    remarks: ''
  })
  const [outwardVoucher, setOutwardVoucher] = useState(null)
  const [syncing, setSyncing] = useState(false)

  // Inward & Outward DML states
  const [editInwardModal, setEditInwardModal] = useState(null)
  const [editInwardForm, setEditInwardForm] = useState({})
  const [editOutwardModal, setEditOutwardModal] = useState(null)
  const [editOutwardForm, setEditOutwardForm] = useState({})

  const handleUpdateInward = async (e) => {
    e.preventDefault()
    if (!editInwardModal) return
    const r = await fetch(`${API}/store/inward/${editInwardModal.id}`, {
      method: 'PUT',
      headers: json(),
      body: JSON.stringify(editInwardForm)
    }).then(res => res.json())
    if (r.success) {
      addToast('Inward record updated successfully', 'success')
      setEditInwardModal(null)
      loadInward()
      loadBaseData()
    } else {
      addToast(r.message || 'Failed to update inward record', 'error')
    }
  }

  const handleDeleteInward = async (inw) => {
    if (!window.confirm(`Are you sure you want to void / delete GRN receipt for ${inw.materialName} (${inw.in_qty} ${inw.uom})? This will deduct the stock from the store.`)) return
    const r = await fetch(`${API}/store/inward/${inw.id}`, {
      method: 'DELETE',
      headers: h()
    }).then(res => res.json())
    if (r.success) {
      addToast(r.message || 'Inward record removed and stock reversed', 'info')
      loadInward()
      loadBaseData()
    } else {
      addToast(r.message || 'Failed to delete inward record', 'error')
    }
  }

  const handleUpdateOutward = async (e) => {
    e.preventDefault()
    if (!editOutwardModal) return
    const r = await fetch(`${API}/store/outward/${editOutwardModal.id}`, {
      method: 'PUT',
      headers: json(),
      body: JSON.stringify(editOutwardForm)
    }).then(res => res.json())
    if (r.success) {
      addToast('Outward issue updated successfully', 'success')
      setEditOutwardModal(null)
      loadOutward()
      loadBaseData()
    } else {
      addToast(r.message || 'Failed to update outward issue', 'error')
    }
  }

  const handleDeleteOutward = async (outw) => {
    if (!window.confirm(`Are you sure you want to cancel outward issue for ${outw.materialName} (${outw.out_qty} ${outw.uom})? This will restore the stock back to the store.`)) return
    const r = await fetch(`${API}/store/outward/${outw.id}`, {
      method: 'DELETE',
      headers: h()
    }).then(res => res.json())
    if (r.success) {
      addToast(r.message || 'Outward issue cancelled and stock restored to store', 'info')
      loadOutward()
      loadBaseData()
    } else {
      addToast(r.message || 'Failed to cancel outward issue', 'error')
    }
  }

  const handleSyncInward = async () => {
    setSyncing(true)
    try {
      const r = await fetch(`${API}/master/materials/sync-all-stores`, {
        method: 'POST',
        headers: json()
      }).then(r => r.json())
      if (r.success) {
        addToast('All store Excels and Inward receipts synchronized strictly by code!', 'success')
        loadInward()
        loadBaseData()
      } else {
        addToast(r.message || 'Sync failed', 'error')
      }
    } catch (e) {
      addToast('Sync failed: ' + e.message, 'error')
    } finally {
      setSyncing(false)
    }
  }

  // Reject / Retire modals state
  const [rejectModal, setRejectModal] = useState(null)
  const [retireModal, setRetireModal] = useState(null)
  const [actionLoading, setActionLoading] = useState(false)
  
  // Modal for issue creation
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({
    materialId: '',
    departmentId: '',
    quantity: '',
    purpose: '',
    remarks: '',
    indent_type: 'Consumable',
    machine_id: '',
    position_id: '',
    justification: '',
    required_by_date: new Date().toISOString().slice(0, 10),
    estimated_value: ''
  })

  // Issue processing dialog
  const [issueProcessModal, setIssueProcessModal] = useState(false)
  const [activeIssue, setActiveIssue] = useState(null)
  const [issueForm, setIssueForm] = useState({
    serial_number: '',
    batch_number: '',
    issue_option: 'full',
    substitute_material_id: ''
  })

  const handleCreateIssue = async (e) => {
    e.preventDefault()
    if (!form.materialId || !form.quantity || Number(form.quantity) <= 0) {
      addToast('Please select material and enter valid quantity', 'warning')
      return
    }
    setActionLoading(true)
    try {
      const res = await fetch(`${API}/store/issues`, {
        method: 'POST',
        headers: json(),
        body: JSON.stringify(form)
      }).then(r => r.json())
      if (res.success) {
        addToast(`Indent ${res.data?.indentNumber || res.data?.issueNumber || ''} raised successfully`, 'success')
        setModal(false)
        setForm({
          materialId: '',
          departmentId: '',
          quantity: '',
          purpose: '',
          remarks: '',
          indent_type: 'Consumable',
          machine_id: '',
          position_id: '',
          justification: '',
          required_by_date: new Date().toISOString().slice(0, 10),
          estimated_value: ''
        })
        loadBaseData()
      } else {
        addToast(res.message || 'Failed to raise indent', 'error')
      }
    } catch (err) {
      addToast('Network error while raising indent', 'error')
    } finally {
      setActionLoading(false)
    }
  }

  const handleEditIssue = async (e) => {
    e.preventDefault()
    if (!editModal) return
    setActionLoading(true)
    try {
      const res = await fetch(`${API}/store/issues/${editModal.id}`, {
        method: 'PUT',
        headers: json(),
        body: JSON.stringify(editForm)
      }).then(r => r.json())
      if (res.success) {
        addToast('Indent updated successfully', 'success')
        setEditModal(null)
        loadBaseData()
      } else {
        addToast(res.message || 'Failed to update indent', 'error')
      }
    } catch (err) {
      addToast('Network error while updating indent', 'error')
    } finally {
      setActionLoading(false)
    }
  }

  const handleDeleteIndent = async (indent) => {
    const num = indent.issue_number || indent.issueNumber || indent.indent_number || `Indent #${indent.id}`
    if (!window.confirm(`Are you sure you want to permanently delete ${num}? This will remove the indent and all associated line items.`)) {
      return
    }
    setActionLoading(true)
    try {
      const res = await fetch(`${API}/store/issues/${indent.id}`, {
        method: 'DELETE',
        headers: h()
      }).then(r => r.json())
      if (res.success) {
        addToast(res.message || `${num} deleted successfully`, 'success')
        loadBaseData()
      } else {
        addToast(res.message || 'Failed to delete indent', 'error')
      }
    } catch (err) {
      addToast('Network error while deleting indent', 'error')
    } finally {
      setActionLoading(false)
    }
  }

  const loadBaseData = async () => {
    try {
      const [mRes, dRes, machRes, posRes, assRes, issRes, venRes, poRes] = await Promise.all([
        fetch(`${API}/master/materials?limit=5000`, { headers: h() }).then(r => r.json()),
        fetch(`${API}/admin/departments`, { headers: h() }).then(r => r.json()),
        fetch(`${API}/master/machines`, { headers: h() }).then(r => r.json()),
        fetch(`${API}/store/positions`, { headers: h() }).then(r => r.json()),
        fetch(`${API}/store/assets`, { headers: h() }).then(r => r.json()),
        fetch(`${API}/store/issues`, { headers: h() }).then(r => r.json()),
        fetch(`${API}/purchase/vendors`, { headers: h() }).then(r => r.json()),
        fetch(`${API}/purchase/po?limit=200`, { headers: h() }).then(r => r.json())
      ])
      if (mRes.success) setMats(mRes.data)
      if (dRes.success) setDepts(dRes.data)
      if (machRes.success) setMachines(machRes.data)
      if (posRes.success) setPositions(posRes.data)
      if (assRes.success) setAssets(assRes.data)
      if (issRes.success) setIssues(issRes.data)
      if (venRes.success) setVendors(venRes.data || [])
      if (poRes.success) setPurchaseOrders(poRes.data || [])
      loadDeptSummary()
    } catch (e) {
      console.error(e)
    }
  }

  // Auto-populate PO details & items into Inward form
  const handleSelectPOForInward = async (poIdentifier) => {
    if (!poIdentifier) {
      setActivePoDetails(null)
      setSelectedPoLineId('')
      setBatchInwardQtys({})
      return
    }
    try {
      const res = await fetch(`${API}/purchase/po/${poIdentifier}`, { headers: h() }).then(r => r.json())
      if (res.success && res.data) {
        const po = res.data
        setActivePoDetails(po)
        const vId = po.vendor_id ? String(po.vendor_id) : ''
        const vName = po.vendorName || ''
        const poNum = po.po_number || po.poNumber || poIdentifier

        const updated = {
          ...inwardForm,
          reference_type: 'PO',
          reference_id: poNum,
          vendor_id: vId,
          vendor_name: vName,
          remarks: `Auto-populated from PO ${poNum}`
        }

        // Initialize batch quantities with pending balances
        const batchInit = {}
        if (po.items && po.items.length) {
          po.items.forEach(it => {
            const rem = Math.max(0, parseFloat(it.qty || 0) - parseFloat(it.received_qty || 0))
            batchInit[it.id] = {
              in_qty: rem > 0 ? String(rem) : '',
              batch_number: '',
              bin_location: it.binLocation || ''
            }
          })
          setBatchInwardQtys(batchInit)

          // Pick the first item with pending balance (or item 0)
          const firstPending = po.items.find(it => Math.max(0, parseFloat(it.qty || 0) - parseFloat(it.received_qty || 0)) > 0) || po.items[0]
          const remainingQty = Math.max(0, parseFloat(firstPending.qty || 0) - parseFloat(firstPending.received_qty || 0))
          updated.material_id = String(firstPending.material_id)
          updated.in_qty = remainingQty > 0 ? remainingQty.toString() : (firstPending.qty ? String(firstPending.qty) : '')
          updated.unit_price = firstPending.unit_price ? firstPending.unit_price.toString() : ''
          updated.gst_pct = Number(firstPending.gst_pct ?? 18)
          updated.bin_location = firstPending.binLocation || ''
          setSelectedPoLineId(String(firstPending.id))
        }

        setInwardForm(updated)
        addToast(`PO ${poNum} loaded (${po.items?.length || 0} line items)`, 'info')
      }
    } catch (e) {
      addToast('Error fetching PO: ' + e.message, 'error')
    }
  }

  // Handle line item pick for multi-item PO
  const handleSelectPoLineItem = (lineItemId) => {
    setSelectedPoLineId(String(lineItemId))
    if (!activePoDetails || !lineItemId) return
    const item = activePoDetails.items?.find(it => String(it.id) === String(lineItemId))
    if (item) {
      const remainingQty = Math.max(0, parseFloat(item.qty || 0) - parseFloat(item.received_qty || 0))
      setInwardForm(prev => ({
        ...prev,
        material_id: String(item.material_id),
        in_qty: remainingQty > 0 ? remainingQty.toString() : (item.qty ? String(item.qty) : ''),
        unit_price: item.unit_price ? item.unit_price.toString() : '',
        gst_pct: Number(item.gst_pct ?? 18),
        bin_location: item.binLocation || prev.bin_location,
        remarks: `Auto-populated from PO ${activePoDetails.po_number || activePoDetails.poNumber} — ${item.materialName || item.description || ''}`
      }))
    }
  }

  // Batch Inward submit for multi-item PO
  const handleCreateBatchInward = async (e) => {
    if (e) e.preventDefault()
    if (!activePoDetails || !activePoDetails.items?.length) return
    const validLines = []
    for (const it of activePoDetails.items) {
      const q = parseFloat(batchInwardQtys[it.id]?.in_qty || 0)
      if (q > 0) {
        validLines.push({
          material_id: it.material_id,
          in_qty: q,
          unit_price: parseFloat(it.unit_price) || 0,
          bin_location: batchInwardQtys[it.id]?.bin_location || it.binLocation || '',
          batch_number: batchInwardQtys[it.id]?.batch_number || '',
          quality_status: inwardForm.quality_status || 'Accepted',
          remarks: inwardForm.remarks || `Batch PO inward ${activePoDetails.po_number || activePoDetails.poNumber}`
        })
      }
    }
    if (!validLines.length) {
      addToast('Please enter at least one line quantity greater than 0', 'warning')
      return
    }
    setBatchSaving(true)
    try {
      const payload = {
        inward_type: 'grn',
        reference_type: 'PO',
        reference_id: activePoDetails.po_number || activePoDetails.poNumber,
        vendor_id: activePoDetails.vendor_id,
        vendor_name: activePoDetails.vendorName,
        quality_status: inwardForm.quality_status || 'Accepted',
        remarks: inwardForm.remarks || `Batch PO Inward`,
        items: validLines
      }
      const r = await fetch(`${API}/store/inward`, {
        method: 'POST',
        headers: json(),
        body: JSON.stringify(payload)
      }).then(res => res.json())
      setBatchSaving(false)
      if (r.success) {
        addToast(r.message || 'Batch inward recorded successfully', 'success')
        setInwardModal(false)
        setInwardForm({
          material_id: '', in_qty: '', unit_price: '', gst_pct: 18, inward_type: 'grn',
          reference_type: 'PO', reference_id: '', vendor_id: '', vendor_name: '', bin_location: '',
          batch_number: '', quality_status: 'Accepted', remarks: ''
        })
        setActivePoDetails(null)
        setSelectedPoLineId('')
        setBatchInwardQtys({})
        loadInward()
        loadBaseData()
      } else {
        addToast(r.message || 'Failed to record batch inward', 'error')
      }
    } catch (err) {
      setBatchSaving(false)
      addToast('Error saving batch inward: ' + err.message, 'error')
    }
  }

  const loadInward = useCallback(async () => {
    setInwardLoading(true)
    try {
      const params = new URLSearchParams()
      if (inwardStoreType) params.append('store_type', inwardStoreType)
      if (inwardSearch) params.append('search', inwardSearch)
      params.append('limit', String(INWARD_LIMIT))
      params.append('page', String(inwardPage))
      const r = await fetch(`${API}/store/inward?${params}`, { headers: h() }).then(r => r.json())
      if (r.success) {
        setInwardList(r.data || [])
        setInwardSummary(r.summary || {})
        setInwardTotal(parseInt(r.total || 0))
      }
    } catch (e) {
      console.error(e)
    } finally {
      setInwardLoading(false)
    }
  }, [inwardStoreType, inwardSearch, inwardPage])

  const loadOutward = useCallback(async () => {
    setOutwardLoading(true)
    try {
      const params = new URLSearchParams()
      if (outwardStoreType) params.append('store_type', outwardStoreType)
      if (outwardDeptFilter) params.append('department_id', outwardDeptFilter)
      if (outwardSearch) params.append('search', outwardSearch)
      params.append('limit', String(OUTWARD_LIMIT))
      params.append('page', String(outwardPage))
      const r = await fetch(`${API}/store/outward?${params}`, { headers: h() }).then(r => r.json())
      if (r.success) {
        setOutwardList(r.data || [])
        setOutwardSummary(r.summary || {})
        setOutwardTotal(parseInt(r.total || 0))
      }
    } catch (e) {
      console.error(e)
    } finally {
      setOutwardLoading(false)
    }
  }, [outwardStoreType, outwardDeptFilter, outwardSearch, outwardPage])

  const loadDeptSummary = async () => {
    try {
      const r = await fetch(`${API}/store/issues/dept-summary`, { headers: h() }).then(r => r.json())
      if (r.success) setDeptSummary(r.data)
    } catch (e) {
      console.error(e)
    }
  }

  useEffect(() => {
    loadBaseData()
  }, [])

  useEffect(() => {
    if (tab === 'inward') loadInward()
    if (tab === 'outward') loadOutward()
  }, [tab, loadInward, loadOutward])

  const handleCreateInward = async (e) => {
    e.preventDefault()
    if (!inwardForm.material_id || !inwardForm.in_qty || Number(inwardForm.in_qty) <= 0) {
      addToast('Please select material and enter valid quantity', 'warning')
      return
    }
    const r = await fetch(`${API}/store/inward`, {
      method: 'POST',
      headers: json(),
      body: JSON.stringify(inwardForm)
    }).then(r => r.json())
    if (r.success) {
      addToast(r.message || 'Inward recorded successfully', 'success')
      setInwardModal(false)
      setInwardForm({
        material_id: '', in_qty: '', unit_price: '', inward_type: 'grn',
        reference_type: 'PO', reference_id: '', vendor_id: '', vendor_name: '', bin_location: '',
        batch_number: '', quality_status: 'Accepted', remarks: ''
      })
      setVendorPickMode('list')
      loadInward()
      loadBaseData()
    } else {
      addToast(r.message || 'Failed to record inward', 'error')
    }
  }

  const handleCreateOutward = async (e) => {
    e.preventDefault()
    if (!outwardForm.material_id || !outwardForm.out_qty || Number(outwardForm.out_qty) <= 0) {
      addToast('Please select material and enter valid quantity', 'warning')
      return
    }
    const r = await fetch(`${API}/store/outward`, {
      method: 'POST',
      headers: json(),
      body: JSON.stringify(outwardForm)
    }).then(r => r.json())
    if (r.success) {
      addToast(r.message || 'Outward issue recorded successfully', 'success')
      setOutwardModal(false)
      setOutwardForm({
        material_id: '', out_qty: '', department_id: '', machine_id: '',
        position_id: '', outward_type: 'issue', issued_to: '', purpose: '',
        serial_number: '', batch_number: '', reference_type: 'WORK_ORDER',
        reference_id: '', remarks: ''
      })
      loadOutward()
      loadBaseData()
    } else {
      addToast(r.message || 'Failed to record outward issue', 'error')
    }
  }

  const handleIssueApprove = async (e) => {
    e.preventDefault()
    setMsg('')
    const r = await fetch(`${API}/store/issues/${activeIssue.id}/approve`, {
      method: 'PUT',
      headers: json(),
      body: JSON.stringify(issueForm)
    }).then(r => r.json())
    if (r.success) {
      setIssueProcessModal(false)
      addToast('Issue processed successfully', 'success')
      loadBaseData()
    } else {
      addToast(r.message || 'Error processing issue', 'error')
    }
  }

  const handleRejectIssue = async (reason) => {
    if (!rejectModal) return
    setActionLoading(true)
    try {
      const r = await fetch(`${API}/store/issues/${rejectModal.id}/reject`, {
        method: 'PUT',
        headers: json(),
        body: JSON.stringify({ rejection_reason: reason })
      }).then(r => r.json())
      if (r.success) {
        addToast('Request rejected', 'info')
        setRejectModal(null)
        loadBaseData()
      } else {
        addToast(r.message || 'Error rejecting request', 'error')
      }
    } catch (e) {
      addToast('Request failed', 'error')
    } finally {
      setActionLoading(false)
    }
  }

  const handleRetireAssetConfirm = async (reason) => {
    if (!retireModal) return
    setActionLoading(true)
    try {
      const r = await fetch(`${API}/store/assets/${retireModal.id}/retire`, {
        method: 'POST',
        headers: json(),
        body: JSON.stringify({ status: 'Failed', failure_reason: reason || 'Part failed in service' })
      }).then(r => r.json())
      if (r.success) {
        addToast('Asset retired successfully', 'success')
        setRetireModal(null)
        loadBaseData()
      } else {
        addToast(r.message || 'Error retiring asset', 'error')
      }
    } catch (e) {
      addToast('Failed to retire asset', 'error')
    } finally {
      setActionLoading(false)
    }
  }

  const handleLotTrace = async (e) => {
    e.preventDefault()
    if (!searchLot) return;
    setLotSearched(true)
    setLotError(false)
    try {
      const r = await fetch(`${API}/store/lots/${searchLot}/trace`, { headers: h() }).then(r => r.json())
      if (r.success) {
        setLotTraceData(r.data || [])
      } else {
        setLotTraceData([])
        setLotError(true)
      }
    } catch (err) {
      setLotTraceData([])
      setLotError(true)
    }
  }

  if (!user) return null

  const isApprover = user.role_level >= 2
  const isStore = user.dept_code === 'STORE' || user.role_level >= 5
  const isAdmin = user.role_level >= 4

  const tabs = [
    { id: 'inward', label: '📥 Inward Desk (GRN)' },
    { id: 'outward', label: '📤 Outward Desk (Issues)' },
    { id: 'indents', label: '📋 Indent Requests' },
    isApprover && { id: 'approvals', label: '🛡️ Approvals' },
    { id: 'assets', label: '⚙️ Installed Assets (Digital Twin)' },
    { id: 'lots', label: '🔍 Root Cause Investigator' },
  ].filter(Boolean)

  const selectedInwardMat = mats.find(m => String(m.id) === String(inwardForm.material_id))
  const selectedOutwardMat = mats.find(m => String(m.id) === String(outwardForm.material_id))

  return (
    <div style={S.page}>
      <div style={S.hdr}>
        <div>
          <div style={S.title}>Store Management</div>
          <div style={S.sub}>Full Inward (GRN) · Outward (Issues) · Permanent Traceability · Digital Twin Assets</div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            style={{ ...S.btn, background: '#0f172a', color: '#fff', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700 }}
            onClick={() => onNavigate ? onNavigate('store-dashboard') : (window.location.href = '/store-dashboard')}
            title="Open Exclusive Store Management Realtime Dashboard"
          >
            📊 Executive Dashboard
          </button>
          <button
            style={{ ...S.btn, background: '#25D366', color: '#fff', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700 }}
            onClick={() => onNavigate ? onNavigate('reports') : (window.location.href = '/reports')}
            title="Open Master EOD Activity Report & Send on WhatsApp"
          >
            📱 WhatsApp EOD Report
          </button>
          <button style={{ ...S.btn, background: '#0f766e' }} onClick={() => setInwardModal(true)}>+ New Inward (GRN)</button>
          <button style={{ ...S.btn, background: '#d97706' }} onClick={() => setOutwardModal(true)}>+ New Outward (Issue)</button>
          <button style={S.btn} onClick={() => setModal(true)}>+ Raise Indent Request</button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 2, borderBottom: '2px solid #1b1b1d', marginBottom: 20 }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: '8px 18px', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
            background: 'transparent', borderBottom: tab === t.id ? '2px solid #1b1b1d' : '2px solid transparent',
            color: tab === t.id ? '#1b1b1d' : '#8a8a90', marginBottom: -2,
          }}>{t.label}</button>
        ))}
      </div>

      {/* ── 1. INWARD DESK TAB ── */}
      {tab === 'inward' && (
        <div>
          {/* Inward KPI Cards */}
          <div style={S.kpiGrid}>
            <div style={S.kpiCard}>
              <div style={S.kpiLbl}>Today's Inward Receipts</div>
              <div style={S.kpiVal}>{inwardSummary.todayCount || 0} GRNs</div>
              <div style={S.kpiSub}>Qty: {(inwardSummary.todayQty || 0).toFixed(2)} | Value: ₹{Number(inwardSummary.todayValue || 0).toLocaleString('en-IN')}</div>
            </div>
            <div style={S.kpiCard}>
              <div style={S.kpiLbl}>Total Inward Logged</div>
              <div style={{ ...S.kpiVal, color: '#0f766e' }}>{inwardSummary.totalCount || 0} Receipts</div>
              <div style={S.kpiSub}>Total Qty: {(inwardSummary.totalQty || 0).toFixed(2)}</div>
            </div>
            <div style={S.kpiCard}>
              <div style={S.kpiLbl}>Inward Valuation (Total)</div>
              <div style={{ ...S.kpiVal, color: '#16a34a' }}>₹{Number(inwardSummary.totalValue || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</div>
              <div style={S.kpiSub}>Strictly computed live from stock ledger</div>
            </div>
          </div>

          {/* Department / Store Scoping Chips */}
          <div style={S.scopeBar}>
            {[
              { id: '', label: '⚡ All Inward' },
              { id: 'mechanical', label: '⚙️ Mechanical Store' },
              { id: 'electrical', label: '💡 Electrical Store' },
              { id: 'chemical', label: '🧪 Chemical Store' },
              { id: 'consumable', label: '📦 Consumables & General' },
            ].map(sc => (
              <button
                key={sc.id}
                style={{ ...S.chip, ...(inwardStoreType === sc.id ? S.chipActive : {}) }}
                onClick={() => { setInwardStoreType(sc.id); setInwardPage(1) }}
              >{sc.label}</button>
            ))}
          </div>

          {/* Filter & Search Bar */}
          <div style={S.filterBar}>
            <input
              style={{ ...S.input, maxWidth: 320, background: '#fff' }}
              placeholder="🔍 Search material, code, batch, vendor..."
              value={inwardSearch}
              onChange={e => { setInwardSearch(e.target.value); setInwardPage(1) }}
            />
            <button style={S.btnGhost} onClick={loadInward}>↻ Refresh Log</button>
            <button style={{ ...S.btnGhost, background: '#fef3c7', color: '#92400e' }} disabled={syncing} onClick={handleSyncInward}>
              {syncing ? '⏳ Syncing...' : '⟳ Sync Inward Excel'}
            </button>
            <button style={{ ...S.btn, marginLeft: 'auto', background: '#0f766e' }} onClick={() => setInwardModal(true)}>+ Fast Inward Entry</button>
          </div>

          {/* Inward Register Table */}
          <div style={S.tableWrap}>
            <table style={S.table}>
              <thead>
                <tr style={S.thead}>
                  {['Date', 'Type', 'Ref / PO / Invoice', 'Material', 'Category', 'Inward Qty', 'Unit Price', 'Total Value', 'Batch / Serial', 'Bin / Rack', 'Remarks / Party', 'Received By', 'Voucher'].map(h => (
                    <th key={h} style={S.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {inwardLoading ? (
                  <tr><td colSpan={13} style={S.loading}>Loading inward entries...</td></tr>
                ) : inwardList.length === 0 ? (
                  <tr><td colSpan={13} style={S.empty}>No inward records found. Click "+ Fast Inward Entry" to record receipts.</td></tr>
                ) : inwardList.map(inw => (
                  <tr key={inw.id} style={S.tr}>
                    <td style={S.td}><span style={S.code}>{new Date(inw.date).toLocaleDateString('en-IN')}</span></td>
                    <td style={S.td}>
                      <span style={{ ...S.badge, background: inw.transaction_type === 'return' ? '#fef3c7' : '#ccfbf1', color: inw.transaction_type === 'return' ? '#92400e' : '#0f766e' }}>
                        {inw.transaction_type === 'return' ? 'Dept Return' : 'Vendor GRN'}
                      </span>
                    </td>
                    <td style={S.td}><span style={{ fontWeight: 600 }}>{inw.reference_id || inw.reference_type || '—'}</span></td>
                    <td style={S.td}>
                      <div
                        onClick={() => (inw.material_id || inw.materialId) && setSelectedProductModalId(inw.material_id || inw.materialId)}
                        style={{ fontWeight: 600, color: '#0f766e', cursor: (inw.material_id || inw.materialId) ? 'pointer' : 'default', display: 'flex', alignItems: 'center', gap: 4 }}
                        title="Click to open Product Form"
                      >
                        <span>{inw.materialName}</span>
                        {(inw.material_id || inw.materialId) && <ExternalLink size={12} color="#0f766e" />}
                      </div>
                      <div style={S.muted}>{inw.materialCode}</div>
                    </td>
                    <td style={S.td}><span style={S.muted}>{inw.categoryName || '—'}</span></td>
                    <td style={S.td}><span style={{ color: '#16a34a', fontWeight: 700 }}>+{Number(inw.in_qty).toFixed(3)} {inw.uom}</span></td>
                    <td style={S.td}>₹{Number(inw.unit_price || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td style={S.td}><b>₹{Number(inw.value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</b></td>
                    <td style={S.td}><span style={S.code}>{inw.batch_number || '—'}</span></td>
                    <td style={S.td}>{inw.bin_location || '—'}</td>
                    <td style={{ ...S.td, maxWidth: 220, fontSize: 12 }}>{inw.remarks || '—'}</td>
                    <td style={S.td}><span style={S.muted}>{inw.createdByName || 'Store Keeper'}</span></td>
                    <td style={S.td}>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button style={S.btnSm} onClick={() => setInwardVoucher(inw)}>📄</button>
                        <button style={{ ...S.btnSm, background: '#2563eb' }} onClick={() => {
                          setEditInwardForm({
                            in_qty: inw.in_qty,
                            unit_price: inw.unit_price || 0,
                            reference_type: inw.reference_type || 'PO',
                            reference_id: inw.reference_id || '',
                            bin_location: inw.bin_location || '',
                            batch_number: inw.batch_number || '',
                            remarks: inw.remarks || '',
                            date: inw.date ? inw.date.slice(0, 10) : ''
                          })
                          setEditInwardModal(inw)
                        }}>✏️</button>
                        <button style={{ ...S.btnSm, background: '#ef4444' }} onClick={() => handleDeleteInward(inw)}>🗑️</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
            <span style={{ fontSize: 11, color: '#8a8a90' }}>
              Showing {inwardList.length ? ((inwardPage - 1) * INWARD_LIMIT + 1) : 0}–{(inwardPage - 1) * INWARD_LIMIT + inwardList.length} of {inwardTotal}
            </span>
            <div style={{ display: 'flex', gap: 6 }}>
              <button style={S.btnGhost} disabled={inwardPage === 1} onClick={() => setInwardPage(p => p - 1)}>‹ Prev</button>
              <span style={{ fontSize: 11, color: '#a0a0a6', padding: '6px 8px' }}>{inwardPage} / {Math.max(1, Math.ceil(inwardTotal / INWARD_LIMIT))}</span>
              <button style={S.btnGhost} disabled={inwardPage >= Math.ceil(inwardTotal / INWARD_LIMIT)} onClick={() => setInwardPage(p => p + 1)}>Next ›</button>
            </div>
          </div>
        </div>
      )}

      {/* ── 2. OUTWARD DESK TAB ── */}
      {tab === 'outward' && (
        <div>
          {/* Outward KPI Cards */}
          <div style={S.kpiGrid}>
            <div style={S.kpiCard}>
              <div style={S.kpiLbl}>Today's Outward Issues</div>
              <div style={S.kpiVal}>{outwardSummary.todayCount || 0} Issues</div>
              <div style={S.kpiSub}>Qty: {(outwardSummary.todayQty || 0).toFixed(2)} | Value: ₹{Number(outwardSummary.todayValue || 0).toLocaleString('en-IN')}</div>
            </div>
            <div style={S.kpiCard}>
              <div style={S.kpiLbl}>Total Outward Issued</div>
              <div style={{ ...S.kpiVal, color: '#d97706' }}>{outwardSummary.totalCount || 0} Transactions</div>
              <div style={S.kpiSub}>Total Qty: {(outwardSummary.totalQty || 0).toFixed(2)}</div>
            </div>
            <div style={S.kpiCard}>
              <div style={S.kpiLbl}>Outward Consumption Value</div>
              <div style={{ ...S.kpiVal, color: '#dc2626' }}>₹{Number(outwardSummary.totalValue || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</div>
              <div style={S.kpiSub}>Deducted directly from mill stock</div>
            </div>
          </div>

          {/* Department / Store Scoping Chips */}
          <div style={S.scopeBar}>
            {[
              { id: '', label: '⚡ All Outward' },
              { id: 'mechanical', label: '⚙️ Mechanical Store' },
              { id: 'electrical', label: '💡 Electrical Store' },
              { id: 'chemical', label: '🧪 Chemical Store' },
              { id: 'consumable', label: '📦 Consumables & General' },
            ].map(sc => (
              <button
                key={sc.id}
                style={{ ...S.chip, ...(outwardStoreType === sc.id ? S.chipActive : {}) }}
                onClick={() => { setOutwardStoreType(sc.id); setOutwardPage(1) }}
              >{sc.label}</button>
            ))}
          </div>

          {/* Filter & Search Bar */}
          <div style={S.filterBar}>
            <input
              style={{ ...S.input, maxWidth: 280, background: '#fff' }}
              placeholder="🔍 Search material, code, to, purpose..."
              value={outwardSearch}
              onChange={e => { setOutwardSearch(e.target.value); setOutwardPage(1) }}
            />
            <select style={{ ...S.input, maxWidth: 200, background: '#fff' }} value={outwardDeptFilter} onChange={e => { setOutwardDeptFilter(e.target.value); setOutwardPage(1) }}>
              <option value="">All Plant Departments</option>
              {depts.map(d => <option key={d.id} value={String(d.id)}>{d.name}</option>)}
            </select>
            <button style={S.btnGhost} onClick={loadOutward}>↻ Refresh Log</button>
            <button style={{ ...S.btn, marginLeft: 'auto', background: '#d97706' }} onClick={() => setOutwardModal(true)}>+ Fast Outward Issue</button>
          </div>

          {/* Outward Register Table */}
          <div style={S.tableWrap}>
            <table style={S.table}>
              <thead>
                <tr style={S.thead}>
                  {['Date', 'Type', 'Issue / WO Ref', 'Material', 'Category', 'Issued Qty', 'Balance After', 'Unit Price', 'Total Value', 'Purpose / Dept / To', 'Issued By', 'Voucher'].map(h => (
                    <th key={h} style={S.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {outwardLoading ? (
                  <tr><td colSpan={12} style={S.loading}>Loading outward issues...</td></tr>
                ) : outwardList.length === 0 ? (
                  <tr><td colSpan={12} style={S.empty}>No outward issues found. Click "+ Fast Outward Issue" to issue materials.</td></tr>
                ) : outwardList.map(outw => (
                  <tr key={outw.id} style={S.tr}>
                    <td style={S.td}><span style={S.code}>{new Date(outw.date).toLocaleDateString('en-IN')}</span></td>
                    <td style={S.td}>
                      <span style={{ ...S.badge, background: outw.transaction_type === 'return_to_vendor' ? '#fee2e2' : '#fef3c7', color: outw.transaction_type === 'return_to_vendor' ? '#dc2626' : '#b45309' }}>
                        {outw.transaction_type === 'return_to_vendor' ? 'RTV Outward' : 'Store Issue'}
                      </span>
                    </td>
                    <td style={S.td}><span style={{ fontWeight: 600 }}>{outw.reference_id || outw.reference_type || '—'}</span></td>
                    <td style={S.td}>
                      <div
                        onClick={() => (outw.material_id || outw.materialId) && setSelectedProductModalId(outw.material_id || outw.materialId)}
                        style={{ fontWeight: 600, color: '#0f766e', cursor: (outw.material_id || outw.materialId) ? 'pointer' : 'default', display: 'flex', alignItems: 'center', gap: 4 }}
                        title="Click to open Product Form"
                      >
                        <span>{outw.materialName}</span>
                        {(outw.material_id || outw.materialId) && <ExternalLink size={12} color="#0f766e" />}
                      </div>
                      <div style={S.muted}>{outw.materialCode}</div>
                    </td>
                    <td style={S.td}><span style={S.muted}>{outw.categoryName || '—'}</span></td>
                    <td style={S.td}><span style={{ color: '#dc2626', fontWeight: 700 }}>-{Number(outw.out_qty).toFixed(3)} {outw.uom}</span></td>
                    <td style={S.td}><span style={{ color: '#1b1b1d', fontWeight: 600 }}>{Number(outw.balance).toFixed(3)} {outw.uom}</span></td>
                    <td style={S.td}>₹{Number(outw.unit_price || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td style={S.td}><b>₹{Number(outw.value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</b></td>
                    <td style={{ ...S.td, maxWidth: 240, fontSize: 12 }}>{outw.remarks || '—'}</td>
                    <td style={S.td}><span style={S.muted}>{outw.createdByName || 'Store Keeper'}</span></td>
                    <td style={S.td}>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button style={{ ...S.btnSm, background: '#d97706' }} onClick={() => setOutwardVoucher(outw)}>📄</button>
                        <button style={{ ...S.btnSm, background: '#2563eb' }} onClick={() => {
                          setEditOutwardForm({
                            out_qty: outw.out_qty,
                            department_id: outw.department_id || '',
                            issued_to: outw.issued_to || '',
                            purpose: outw.purpose || '',
                            remarks: outw.remarks || '',
                            date: outw.date ? outw.date.slice(0, 10) : ''
                          })
                          setEditOutwardModal(outw)
                        }}>✏️</button>
                        <button style={{ ...S.btnSm, background: '#ef4444' }} onClick={() => handleDeleteOutward(outw)}>🗑️</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
            <span style={{ fontSize: 11, color: '#8a8a90' }}>
              Showing {outwardList.length ? ((outwardPage - 1) * OUTWARD_LIMIT + 1) : 0}–{(outwardPage - 1) * OUTWARD_LIMIT + outwardList.length} of {outwardTotal}
            </span>
            <div style={{ display: 'flex', gap: 6 }}>
              <button style={S.btnGhost} disabled={outwardPage === 1} onClick={() => setOutwardPage(p => p - 1)}>‹ Prev</button>
              <span style={{ fontSize: 11, color: '#a0a0a6', padding: '6px 8px' }}>{outwardPage} / {Math.max(1, Math.ceil(outwardTotal / OUTWARD_LIMIT))}</span>
              <button style={S.btnGhost} disabled={outwardPage >= Math.ceil(outwardTotal / OUTWARD_LIMIT)} onClick={() => setOutwardPage(p => p + 1)}>Next ›</button>
            </div>
          </div>
        </div>
      )}

      {/* ── 3. INDENTS TAB ── */}
      {tab === 'indents' && (
        <div>
          <div style={{ ...S.tableWrap, marginBottom: 16 }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #e7e6df', fontWeight: 600, fontSize: 13, color: '#1b1b1d' }}>
              Dept-wise Material Issued (This Month)
            </div>
            <table style={S.table}>
              <thead>
                <tr style={S.thead}>
                  {['Department', 'Issues', 'Total Qty', 'Est. Value'].map(h => <th key={h} style={S.th}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {deptSummary.map(d => (
                  <tr key={d.departmentId || 'none'} style={S.tr}>
                    <td style={S.td}>
                      <button style={{ ...S.code, background: 'none', border: 'none', cursor: 'pointer', textDecoration: deptFilter === String(d.departmentId) ? 'underline' : 'none' }}
                        onClick={() => setDeptFilter(deptFilter === String(d.departmentId) ? '' : String(d.departmentId))}>
                        {d.departmentName || 'Unassigned'}
                      </button>
                    </td>
                    <td style={S.td}>{d.issueCount}</td>
                    <td style={S.td}>{d.totalQuantity}</td>
                    <td style={S.td}>₹{Number(d.totalValue).toLocaleString('en-IN')}</td>
                  </tr>
                ))}
                {!deptSummary.length && <tr><td colSpan={4} style={S.empty}>No issues recorded this month.</td></tr>}
              </tbody>
            </table>
          </div>

          <div style={S.tableWrap}>
            <div style={{ padding: 16, borderBottom: '1px solid #e7e6df', display: 'flex', gap: 10, justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                <input style={{...S.input, maxWidth: 300, background: '#fff'}} placeholder='Search requests/issues...' value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} />
                <select style={{ ...S.input, maxWidth: 220, background: '#fff' }} value={deptFilter} onChange={e => setDeptFilter(e.target.value)}>
                  <option value="">All Departments</option>
                  {depts.map(d => <option key={d.id} value={String(d.id)}>{d.name}</option>)}
                </select>
                <button style={{ ...S.btnSm, background: '#f1f5f9', color: '#0f172a' }} onClick={loadBaseData}>↻ Refresh</button>
              </div>
              <button style={{ ...S.btn, background: '#0f766e', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700 }} onClick={() => setModal(true)}>
                + Raise Store Indent
              </button>
            </div>
            <table style={S.table}>
              <thead>
                <tr style={S.thead}>
                  {['Issue / Indent No', 'Material', 'Department', 'Quantity', 'Purpose', 'Status', 'Date', 'Actions'].map(h => <th key={h} style={S.th}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {issues.filter(i => {
                  const q = searchTerm.toLowerCase()
                  const num = (i.issue_number || i.issueNumber || '').toLowerCase()
                  const mat = (i.materialName || i.material_name || '').toLowerCase()
                  const matchQ = !q || num.includes(q) || mat.includes(q)
                  const matchDept = !deptFilter || String(i.department_id) === deptFilter
                  return matchQ && matchDept
                }).map(iss => (
                  <tr key={iss.id} style={S.tr}>
                    <td style={S.td}><span style={S.code}>{iss.issue_number || iss.issueNumber}</span></td>
                    <td style={S.td}>
                      <span
                        onClick={() => (iss.material_id || iss.materialId) && setSelectedProductModalId(iss.material_id || iss.materialId)}
                        style={{ color: (iss.material_id || iss.materialId) ? '#0f766e' : '#1b1b1d', fontWeight: 600, cursor: (iss.material_id || iss.materialId) ? 'pointer' : 'default', textDecoration: (iss.material_id || iss.materialId) ? 'underline' : 'none' }}
                        title="Click to open Product Form"
                      >
                        {iss.materialName || iss.material_name}
                      </span>
                      {iss.item_count > 1 && <span style={{ fontSize: 11, color: '#8a8a90', marginLeft: 4 }}>({iss.item_count} items)</span>}
                    </td>
                    <td style={S.td}>{iss.departmentName || iss.department_name}</td>
                    <td style={S.td}>{iss.quantity} {iss.unit}</td>
                    <td style={S.td}>{iss.purpose}</td>
                    <td style={S.td}><Badge status={iss.status} /></td>
                    <td style={S.td}>{new Date(iss.issue_date || iss.createdAt).toLocaleDateString('en-IN')}</td>
                    <td style={S.td}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {iss.status !== 'Issued' && iss.status !== 'Closed' && (
                          <button style={S.btnSm} onClick={() => {
                            setEditForm({
                              materialId: iss.material_id || iss.materialId, departmentId: iss.department_id, quantity: iss.quantity,
                              purpose: iss.purpose || '', remarks: iss.remarks || '', indent_type: iss.indent_type || 'Consumable',
                              machine_id: iss.machine_id || '', position_id: iss.position_id || '',
                              justification: iss.justification || '', required_by_date: iss.required_by_date ? iss.required_by_date.slice(0,10) : new Date().toISOString().slice(0,10),
                              estimated_value: iss.estimated_value || ''
                            })
                            setEditModal(iss)
                          }}>Edit</button>
                        )}
                        {iss.status !== 'Issued' && iss.status !== 'Closed' && (
                          <button style={{ ...S.btnSm, background: '#ef4444' }} onClick={() => handleDeleteIndent(iss)}>🗑️ Delete</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {!issues.length && (
                  <tr>
                    <td colSpan={8} style={{ ...S.empty, padding: 32 }}>
                      <div style={{ marginBottom: 10, fontSize: 14, fontWeight: 600 }}>No department indents found</div>
                      <button style={{ ...S.btn, background: '#0f766e', margin: '0 auto' }} onClick={() => setModal(true)}>
                        + Raise First Store Indent
                      </button>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── 4. APPROVALS TAB ── */}
      {tab === 'approvals' && (
        <div style={S.tableWrap}>
          <table style={S.table}>
            <thead>
              <tr style={S.thead}>
                {['Indent / Issue No', 'Material', 'Requested By', 'Department', 'Quantity', 'Justification / Purpose', 'Priority', 'Status', 'Actions'].map(h => <th key={h} style={S.th}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {issues.filter(i => ['Pending', 'Submitted', 'L1 Approved', 'Approved', 'Partially Issued'].includes(i.status)).map(iss => (
                <tr key={iss.id} style={S.tr}>
                  <td style={S.td}><span style={S.code}>{iss.issue_number || iss.issueNumber}</span></td>
                  <td style={S.td}>
                    <strong
                      onClick={() => (iss.material_id || iss.materialId) && setSelectedProductModalId(iss.material_id || iss.materialId)}
                      style={{ color: (iss.material_id || iss.materialId) ? '#0f766e' : '#1b1b1d', cursor: (iss.material_id || iss.materialId) ? 'pointer' : 'default', textDecoration: (iss.material_id || iss.materialId) ? 'underline' : 'none' }}
                      title="Click to open Product Form"
                    >
                      {iss.materialName || iss.material_name}
                    </strong>
                    {iss.item_count > 1 && <span style={{ fontSize: 11, color: '#8a8a90', marginLeft: 4 }}>({iss.item_count} items)</span>}
                  </td>
                  <td style={S.td}>{iss.requestedByName || iss.requested_by_name || 'Staff'}</td>
                  <td style={S.td}>{iss.departmentName || iss.department_name}</td>
                  <td style={S.td}>{iss.quantity} {iss.unit || ''}</td>
                  <td style={S.td}>{iss.justification || iss.purpose || '—'}</td>
                  <td style={S.td}><span style={{ fontSize: 11, fontWeight: 600, color: iss.priority === 'Emergency' ? '#dc2626' : iss.priority === 'Urgent' ? '#ea580c' : '#4b5563' }}>{iss.priority || 'Normal'}</span></td>
                  <td style={S.td}><Badge status={iss.status} /></td>
                  <td style={S.td}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {(iss.status === 'Submitted' || iss.status === 'L1 Approved' || iss.status === 'Pending') && (
                        <button style={S.btnSm} onClick={async () => {
                          const r = await fetch(`${API}/store/issues/${iss.id}/approve`, {
                            method: 'PUT',
                            headers: json(),
                            body: JSON.stringify({})
                          }).then(res => res.json())
                          if (r.success) {
                            addToast('Approved successfully', 'success')
                            loadBaseData()
                          } else {
                            addToast(r.message || 'Approval failed', 'error')
                          }
                        }}>Approve</button>
                      )}
                      {(iss.status === 'Approved' || iss.status === 'Partially Issued') && (
                        <button style={{ ...S.btnSm, background: '#0f766e' }} onClick={() => {
                          setActiveIssue(iss)
                          setIssueForm({ serial_number: '', batch_number: '', issue_option: 'full', substitute_material_id: '' })
                          setIssueProcessModal(true)
                        }}>Pick & Issue</button>
                      )}
                      <button style={{ ...S.btnSm, background: '#ea580c' }} onClick={() => setRejectModal(iss)}>Reject</button>
                      <button style={{ ...S.btnSm, background: '#ef4444' }} onClick={() => handleDeleteIndent(iss)} title="Delete / Void Indent">🗑️ Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
              {!issues.filter(i => ['Pending', 'Submitted', 'L1 Approved', 'Approved', 'Partially Issued'].includes(i.status)).length && (
                <tr><td colSpan={9} style={S.empty}>No pending approvals or issues awaiting fulfillment.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ── 5. ASSETS TAB (DIGITAL TWIN) ── */}
      {tab === 'assets' && (
        <div style={S.tableWrap}>
          <table style={S.table}>
            <thead>
              <tr style={S.thead}>
                {['Asset / Serial No', 'Material', 'Machine', 'Position', 'Status', 'Installed Date', 'Operating Life', 'Expected Life', 'Actions'].map(h => <th key={h} style={S.th}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {assets.map(a => {
                const days = a.daysInService !== undefined ? a.daysInService : Math.floor((new Date() - new Date(a.installedAt)) / (1000*60*60*24))
                const expDays = a.expectedLifespanDays || 365
                const isOverdue = days >= expDays
                return (
                  <tr key={a.id} style={S.tr}>
                    <td style={S.td}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <span style={S.code}>{a.serialNumber || a.assetNumber}</span>
                        {a.assetNumber && a.serialNumber && <span style={{ fontSize: 10, color: '#8a8a90' }}>{a.assetNumber}</span>}
                      </div>
                    </td>
                    <td style={S.td}>
                      <div>{a.materialName}</div>
                      {a.materialCode && <span style={{ fontSize: 11, color: '#8a8a90' }}>Code: {a.materialCode}</span>}
                    </td>
                    <td style={S.td}><strong>{a.machineName || '—'}</strong></td>
                    <td style={S.td}>{a.positionName || '—'}</td>
                    <td style={S.td}><Badge status={a.status === 'active' || a.status === 'In Service' ? 'In Service' : a.status} /></td>
                    <td style={S.td}>{new Date(a.installedAt).toLocaleDateString('en-IN')}</td>
                    <td style={S.td}>
                      <span style={{ fontWeight: 600, color: isOverdue ? '#dc2626' : '#15803d' }}>
                        {days} days
                      </span>
                    </td>
                    <td style={S.td}>{expDays} days</td>
                    <td style={S.td}>
                      {(a.status === 'active' || a.status === 'In Service') && (
                        <button style={{ ...S.btnSm, background: '#ef4444' }} onClick={() => setRetireModal(a)}>Retire / Failure</button>
                      )}
                    </td>
                  </tr>
                )
              })}
              {!assets.length && <tr><td colSpan={9} style={S.empty}>No installed assets recorded.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {/* ── 6. ROOT CAUSE INVESTIGATOR ── */}
      {tab === 'lots' && (
        <div>
          <div style={{ ...S.formCard, marginBottom: 20 }}>
            <div style={S.formTitle}>Root Cause Batch & Lot Investigator</div>
            <form onSubmit={handleLotTrace} style={{ display: 'flex', gap: 10 }}>
              <input
                style={{ ...S.input, maxWidth: 350, background: '#fff' }}
                placeholder="Scan or enter Batch # or Serial #..."
                value={searchLot}
                onChange={e => setSearchLot(e.target.value)}
                required
              />
              <button type="submit" style={S.btn}>Trace Batch History</button>
            </form>
          </div>

          {lotSearched && (
            <div style={S.tableWrap}>
              <div style={{ padding: 14, borderBottom: '1px solid #e7e6df', fontWeight: 600, fontSize: 13 }}>
                Traceability Results for: <span style={S.code}>{searchLot}</span>
              </div>
              <table style={S.table}>
                <thead>
                  <tr style={S.thead}>
                    {['Event Date', 'Transaction Type', 'Material', 'Machine Context', 'Position', 'Operator / Guard', 'Details'].map(h => <th key={h} style={S.th}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {lotTraceData.map((t, idx) => (
                    <tr key={idx} style={S.tr}>
                      <td style={S.td}>{new Date(t.date || t.created_at).toLocaleString('en-IN')}</td>
                      <td style={S.td}><span style={S.badge}>{t.type || t.transaction_type}</span></td>
                      <td style={S.td}>{t.material_name || t.materialName}</td>
                      <td style={S.td}>{t.machine_name || t.machineName || '—'}</td>
                      <td style={S.td}>{t.position_name || t.positionName || '—'}</td>
                      <td style={S.td}>{t.user_name || t.actor_name || 'System'}</td>
                      <td style={S.td}>{t.notes || t.remarks || '—'}</td>
                    </tr>
                  ))}
                  {!lotTraceData.length && (
                    <tr><td colSpan={7} style={S.empty}>No historical events found for this lot/serial number.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── MODAL: FAST INWARD (GRN / RETURN) ── */}
      {inwardModal && (
        <div style={S.overlay}>
          <div style={{ ...S.modal, maxWidth: activePoDetails ? 1020 : 720, maxHeight: '92vh', overflowY: 'auto', padding: 24 }}>
            
            {/* Modal Header & Multi-Agent Status */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, borderBottom: '1px solid #e7e6df', paddingBottom: 12 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <b style={{ fontSize: 18, color: '#1b1b1d' }}>📥 Fast Inward Entry (GRN / Return)</b>
                  <span style={{ ...S.badge, background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0' }}>
                    Live Stock Addition
                  </span>
                </div>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 3 }}>
                  Direct stock addition with atomic ledger recording & PO synchronization
                </div>
              </div>

              {/* Multi-Agent Status Pill */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 20, padding: '4px 12px', fontSize: 11, fontWeight: 600, color: '#166534', display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }}></span>
                  ⚡ Ledger & PO Agent: Active
                </div>
                <button style={S.x} onClick={() => setInwardModal(false)}>✕</button>
              </div>
            </div>

            {/* Inward Type & Document Reference */}
            <div style={{ background: '#f8fafc', padding: 14, borderRadius: 8, border: '1px solid #e2e8f0', marginBottom: 16 }}>
              <div style={S.grid2}>
                <div>
                  <label style={S.label}>Inward Type *</label>
                  <select style={S.select} value={inwardForm.inward_type} onChange={e => setInwardForm({ ...inwardForm, inward_type: e.target.value })}>
                    <option value="grn">Vendor GRN (Purchase Inward)</option>
                    <option value="return">Department Return (Unused Material)</option>
                    <option value="direct">Direct / Emergency Receipt</option>
                  </select>
                </div>
                <div>
                  <label style={S.label}>Ref Document *</label>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <select style={{ ...S.select, width: 90 }} value={inwardForm.reference_type} onChange={e => setInwardForm({ ...inwardForm, reference_type: e.target.value })}>
                      <option value="PO">PO #</option>
                      <option value="INV">Invoice</option>
                      <option value="DC">DC #</option>
                      <option value="GP">Gate Pass</option>
                    </select>
                    {inwardForm.reference_type === 'PO' ? (
                      <select
                        style={{ ...S.select, flex: 1, borderColor: '#0f766e', fontWeight: 600 }}
                        value={inwardForm.reference_id}
                        onChange={e => {
                          const poNum = e.target.value
                          setInwardForm(prev => ({ ...prev, reference_id: poNum }))
                          handleSelectPOForInward(poNum)
                        }}
                      >
                        <option value="">-- Select Approved / Active PO --</option>
                        {purchaseOrders.map(po => (
                          <option key={po.id} value={po.po_number || po.poNumber}>
                            {po.po_number || po.poNumber} — {po.vendorName} ({po.status})
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input style={S.input} placeholder="Ref Number (e.g. INV-8902)" value={inwardForm.reference_id} onChange={e => setInwardForm({ ...inwardForm, reference_id: e.target.value })} required />
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* ═══════ TOTAL PO CONTENT BREAKDOWN & LINE ITEM PICKER ═══════ */}
            {activePoDetails && activePoDetails.items && activePoDetails.items.length > 0 && (
              <div style={{ background: '#f0fdfa', border: '1px solid #99f6e4', padding: 16, borderRadius: 10, marginBottom: 16 }}>
                
                {/* PO Header Summary Card */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10, borderBottom: '1px solid #ccfbf1', paddingBottom: 12, marginBottom: 12 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 15, fontWeight: 700, color: '#0f766e' }}>
                        📦 PO Contents: {activePoDetails.po_number || activePoDetails.poNumber}
                      </span>
                      <span style={{ background: '#ccfbf1', color: '#0f766e', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 12 }}>
                        {activePoDetails.status}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: '#134e4a', marginTop: 3 }}>
                      Vendor: <strong>{activePoDetails.vendorName}</strong> {activePoDetails.vendorCode ? `(${activePoDetails.vendorCode})` : ''} · Total Value: <strong>₹{Number(activePoDetails.grand_total || activePoDetails.grandTotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                    </div>
                  </div>

                  {/* Mode Toggle: Single Item vs Batch Multi-Item */}
                  <div style={{ display: 'flex', gap: 6, background: '#e6fffa', padding: 3, borderRadius: 8, border: '1px solid #99f6e4' }}>
                    <button
                      type="button"
                      onClick={() => setInwardBatchMode(false)}
                      style={{
                        padding: '5px 12px', borderRadius: 6, fontSize: 11, fontWeight: 700, border: 'none', cursor: 'pointer',
                        background: !inwardBatchMode ? '#0f766e' : 'transparent',
                        color: !inwardBatchMode ? '#ffffff' : '#0f766e'
                      }}
                    >
                      ⚡ Single Item Inward
                    </button>
                    <button
                      type="button"
                      onClick={() => setInwardBatchMode(true)}
                      style={{
                        padding: '5px 12px', borderRadius: 6, fontSize: 11, fontWeight: 700, border: 'none', cursor: 'pointer',
                        background: inwardBatchMode ? '#0f766e' : 'transparent',
                        color: inwardBatchMode ? '#ffffff' : '#0f766e'
                      }}
                    >
                      📦 Batch Multi-Item Inward
                    </button>
                  </div>
                </div>

                {/* Line Items Table */}
                <div style={{ overflowX: 'auto', background: '#ffffff', borderRadius: 8, border: '1px solid #ccfbf1' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: '#f0fdfa', borderBottom: '1px solid #ccfbf1', textAlign: 'left', color: '#0f766e', fontWeight: 700 }}>
                        <th style={{ padding: '8px 10px', width: 30 }}>#</th>
                        <th style={{ padding: '8px 10px' }}>Material & Specification</th>
                        <th style={{ padding: '8px 10px', textAlign: 'right' }}>Ordered</th>
                        <th style={{ padding: '8px 10px', textAlign: 'right' }}>Received</th>
                        <th style={{ padding: '8px 10px', textAlign: 'right' }}>Balance</th>
                        <th style={{ padding: '8px 10px', textAlign: 'right' }}>Unit Rate</th>
                        <th style={{ padding: '8px 10px', textAlign: 'center' }}>GST%</th>
                        {inwardBatchMode ? (
                          <th style={{ padding: '8px 10px', width: 140 }}>Inward Qty</th>
                        ) : (
                          <th style={{ padding: '8px 10px', textAlign: 'center', width: 130 }}>Action</th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {activePoDetails.items.map((it, idx) => {
                        const ord = parseFloat(it.qty || 0)
                        const rec = parseFloat(it.received_qty || 0)
                        const rem = Math.max(0, ord - rec)
                        const isSelected = String(selectedPoLineId) === String(it.id)
                        const isFulfilled = rem === 0

                        return (
                          <tr
                            key={it.id || idx}
                            onClick={() => {
                              if (!inwardBatchMode) handleSelectPoLineItem(it.id)
                            }}
                            style={{
                              borderBottom: '1px solid #f0fdf4',
                              cursor: !inwardBatchMode ? 'pointer' : 'default',
                              background: isSelected && !inwardBatchMode ? '#ccfbf1' : (isFulfilled ? '#f8fafc' : '#ffffff'),
                              transition: 'background 0.15s ease'
                            }}
                          >
                            <td style={{ padding: '8px 10px', fontWeight: 700, color: '#64748b' }}>{idx + 1}</td>
                            <td style={{ padding: '8px 10px' }}>
                              <div style={{ fontWeight: 600, color: '#1b1b1d' }}>{it.materialName || it.description}</div>
                              <div style={{ fontSize: 11, color: '#64748b', display: 'flex', gap: 6, marginTop: 2 }}>
                                <span>Code: <code>{it.materialCode || it.material_id}</code></span>
                                <span>· UOM: <strong>{it.uom}</strong></span>
                              </div>
                            </td>
                            <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 600 }}>{ord.toFixed(3)} {it.uom}</td>
                            <td style={{ padding: '8px 10px', textAlign: 'right', color: '#16a34a', fontWeight: 600 }}>{rec.toFixed(3)} {it.uom}</td>
                            <td style={{ padding: '8px 10px', textAlign: 'right' }}>
                              <span style={{
                                padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 700,
                                background: rem > 0 ? '#dcfce7' : '#e2e8f0',
                                color: rem > 0 ? '#15803d' : '#64748b'
                              }}>
                                {rem.toFixed(3)} {it.uom}
                              </span>
                            </td>
                            <td style={{ padding: '8px 10px', textAlign: 'right', color: '#0f766e', fontWeight: 600 }}>
                              ₹{parseFloat(it.unit_price || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </td>
                            <td style={{ padding: '8px 10px', textAlign: 'center' }}>{it.gst_pct || 18}%</td>

                            {/* Column action or batch quantity */}
                            <td style={{ padding: '8px 10px' }}>
                              {inwardBatchMode ? (
                                <input
                                  type="number"
                                  step="0.001"
                                  min="0"
                                  max={rem > 0 ? rem : undefined}
                                  style={{ ...S.input, width: '100%', padding: '4px 6px', fontSize: 11, textAlign: 'right', borderColor: '#0f766e' }}
                                  placeholder="0.000"
                                  value={batchInwardQtys[it.id]?.in_qty || ''}
                                  onChange={e => {
                                    const val = e.target.value
                                    setBatchInwardQtys(b => ({ ...b, [it.id]: { ...(b[it.id] || {}), in_qty: val } }))
                                  }}
                                />
                              ) : (
                                <button
                                  type="button"
                                  onClick={e => {
                                    e.stopPropagation()
                                    handleSelectPoLineItem(it.id)
                                  }}
                                  style={{
                                    width: '100%',
                                    padding: '4px 8px',
                                    borderRadius: 6,
                                    fontSize: 11,
                                    fontWeight: 700,
                                    border: isSelected ? '2px solid #0f766e' : '1px solid #99f6e4',
                                    background: isSelected ? '#0f766e' : '#f0fdfa',
                                    color: isSelected ? '#ffffff' : '#0f766e',
                                    cursor: 'pointer'
                                  }}
                                >
                                  {isSelected ? '✓ Selected' : '👉 Receive Line'}
                                </button>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Batch Action Footer if in Batch Mode */}
                {inwardBatchMode && (
                  <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#e6fffa', padding: '10px 14px', borderRadius: 8, border: '1px solid #99f6e4' }}>
                    <div style={{ fontSize: 12, color: '#134e4a' }}>
                      💡 Enter received quantities in the table above and record inward for all lines simultaneously.
                    </div>
                    <button
                      type="button"
                      onClick={handleCreateBatchInward}
                      disabled={batchSaving}
                      style={{ ...S.btn, background: '#0f766e', padding: '8px 18px', fontWeight: 700 }}
                    >
                      {batchSaving ? 'Recording Batch…' : '📦 Record Batch Inward'}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* ═══════ SINGLE ITEM FORM (FOR SINGLE PO LINE OR DIRECT/RETURN) ═══════ */}
            {!inwardBatchMode && (
              <form onSubmit={handleCreateInward} style={S.form}>
                
                {/* Active Selected PO Item Alert Pill */}
                {activePoDetails && selectedPoLineId && (() => {
                  const selItem = activePoDetails.items?.find(it => String(it.id) === String(selectedPoLineId))
                  if (!selItem) return null
                  const rem = Math.max(0, parseFloat(selItem.qty || 0) - parseFloat(selItem.received_qty || 0))
                  return (
                    <div style={{ background: '#f0fdf4', border: '1px solid #86efac', padding: '8px 14px', borderRadius: 8, fontSize: 12, color: '#166534', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>📌 <strong>Currently Receiving:</strong> {selItem.materialName || selItem.description} [{selItem.materialCode || selItem.material_id}]</span>
                      <span>Pending Balance: <strong>{rem.toFixed(3)} {selItem.uom}</strong> @ ₹{selItem.unit_price}</span>
                    </div>
                  )
                })()}

                {/* Material Catalog Selector */}
                <div>
                  <label style={S.label}>Select Material *</label>
                  <select style={S.select} value={inwardForm.material_id} onChange={e => {
                    const m = mats.find(x => String(x.id) === String(e.target.value))
                    setInwardForm({
                      ...inwardForm,
                      material_id: e.target.value,
                      unit_price: m?.unit_price || '',
                      bin_location: m?.binLocation || m?.bin_location || ''
                    })
                  }} required>
                    <option value="">-- Choose Material (1,075 catalog items) --</option>
                    {mats.map(m => (
                      <option key={m.id} value={m.id}>
                        {m.name} [{m.code}] { (m.poCount || m.po_count) ? `[${m.poCount || m.po_count} POs]` : '' } (Stock: {m.current_stock || m.currentStock || 0} {m.uom})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Inward Quantity, Unit Price, GST Slab */}
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1.4fr', gap: 12 }}>
                  <div>
                    <label style={S.label}>Inward Quantity *</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <input type="number" step="0.001" style={S.input} placeholder="0.000" value={inwardForm.in_qty} onChange={e => setInwardForm({ ...inwardForm, in_qty: e.target.value })} required />
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#8a8a90' }}>{selectedInwardMat?.uom || 'NOS'}</span>
                    </div>
                  </div>
                  <div>
                    <label style={S.label}>Unit Price (₹)</label>
                    <input type="number" step="0.01" style={S.input} placeholder="₹ 0.00" value={inwardForm.unit_price} onChange={e => setInwardForm({ ...inwardForm, unit_price: e.target.value })} />
                  </div>
                  <div>
                    <label style={S.label}>GST Slab %</label>
                    <select style={S.select} value={Number(inwardForm.gst_pct ?? 18)} onChange={e => setInwardForm({ ...inwardForm, gst_pct: Number(e.target.value) })}>
                      {GST_SLABS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                  </div>
                </div>

                {/* Live Tax & Grand Total Computation */}
                {inwardForm.in_qty && inwardForm.unit_price && (() => {
                  const taxable = Number(inwardForm.in_qty) * Number(inwardForm.unit_price)
                  const gstPct = Number(inwardForm.gst_pct ?? 18)
                  const tax = (taxable * gstPct) / 100
                  const total = taxable + tax
                  return (
                    <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '10px 14px', borderRadius: 8, fontSize: 12 }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
                        <div><span style={{ color: '#64748b' }}>Taxable Base:</span> <b style={{ display: 'block', marginTop: 2 }}>₹{taxable.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</b></div>
                        <div><span style={{ color: '#64748b' }}>CGST ({gstPct / 2}%):</span> <b style={{ display: 'block', marginTop: 2 }}>₹{(tax / 2).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</b></div>
                        <div><span style={{ color: '#64748b' }}>SGST ({gstPct / 2}%):</span> <b style={{ display: 'block', marginTop: 2 }}>₹{(tax / 2).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</b></div>
                        <div><span style={{ color: '#166534', fontWeight: 700 }}>Grand Total:</span> <b style={{ color: '#0f766e', fontSize: 13, display: 'block', marginTop: 2 }}>₹{total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</b></div>
                      </div>
                    </div>
                  )
                })()}

                {/* Department or Vendor Selector */}
                <div style={S.grid2}>
                  <div>
                    {inwardForm.inward_type === 'return' ? (
                      <>
                        <label style={S.label}>Returning Department *</label>
                        <select
                          style={S.select}
                          value={inwardForm.department_id || ''}
                          onChange={e => setInwardForm({ ...inwardForm, department_id: e.target.value })}
                          required
                        >
                          <option value="">-- Select Returning Department --</option>
                          {depts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                        </select>
                      </>
                    ) : (
                      <>
                        <label style={S.label}>Vendor / Supplier Name</label>
                        <select style={S.input}
                          value={vendorPickMode === 'other' ? '__other__' : inwardForm.vendor_id}
                          onChange={e => {
                            if (e.target.value === '__other__') {
                              setVendorPickMode('other')
                              setInwardForm({ ...inwardForm, vendor_id: '', vendor_name: '' })
                            } else {
                              const v = vendors.find(vv => String(vv.id) === e.target.value)
                              setVendorPickMode('list')
                              setInwardForm({ ...inwardForm, vendor_id: e.target.value, vendor_name: v ? v.name : '' })
                            }
                          }}>
                          <option value="">-- Select registered vendor --</option>
                          {vendors.map(v => (
                            <option key={v.id} value={v.id}>
                              {v.name} ({v.poCount || v.po_count || 0} POs)
                            </option>
                          ))}
                          <option value="__other__">Other / Direct-OEM (type name below)</option>
                        </select>
                        {vendorPickMode === 'other' && (
                          <input style={{ ...S.input, marginTop: 6 }} placeholder="e.g. SKF India / Voith / Shell (not in master vendor list)"
                            value={inwardForm.vendor_name} onChange={e => setInwardForm({ ...inwardForm, vendor_name: e.target.value })} />
                        )}
                      </>
                    )}
                  </div>
                  <div>
                    <label style={S.label}>Target Rack / Bin Location</label>
                    <input style={S.input} placeholder="e.g. Rack 2, Box 4" value={inwardForm.bin_location} onChange={e => setInwardForm({ ...inwardForm, bin_location: e.target.value })} />
                  </div>
                </div>

                {/* Batch & QC Status */}
                <div style={S.grid2}>
                  <div>
                    <label style={S.label}>Batch / Heat / Serial #</label>
                    <input style={S.input} placeholder="Barcode / Batch # for tracing" value={inwardForm.batch_number} onChange={e => setInwardForm({ ...inwardForm, batch_number: e.target.value })} />
                  </div>
                  <div>
                    <label style={S.label}>QC Inspection Status</label>
                    <select style={S.select} value={inwardForm.quality_status} onChange={e => setInwardForm({ ...inwardForm, quality_status: e.target.value })}>
                      <option value="Accepted">Accepted (Passed Inspection)</option>
                      <option value="Conditionally Accepted">Conditionally Accepted</option>
                      <option value="Under QC Inspection">Under QC Inspection</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label style={S.label}>Remarks / Inspection Note</label>
                  <textarea style={S.input} rows={2} placeholder="Any delivery notes or inspection details..." value={inwardForm.remarks} onChange={e => setInwardForm({ ...inwardForm, remarks: e.target.value })} />
                </div>

                {/* Footer Buttons */}
                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 10 }}>
                  <button type="button" style={S.btnGhost} onClick={() => setInwardModal(false)}>Cancel</button>
                  <button type="submit" style={{ ...S.btn, background: '#0f766e', fontWeight: 700 }}>Record Inward GRN</button>
                </div>
              </form>
            )}

          </div>
        </div>
      )}

      {/* ── MODAL: FAST OUTWARD (ISSUE) ── */}
      {outwardModal && (
        <div style={S.overlay}>
          <div style={{ ...S.modal, maxWidth: 680 }}>
            <div style={S.modalHdr}>
              <div>
                <b>📤 Fast Outward Issue (Plant Requisition / RTV)</b>
                <div style={S.muted}>Direct stock deduction with audit logging</div>
              </div>
              <button style={S.x} onClick={() => setOutwardModal(false)}>✕</button>
            </div>
            <form onSubmit={handleCreateOutward} style={S.form}>
              <div style={S.grid2}>
                <div>
                  <label style={S.label}>Outward Type *</label>
                  <select style={S.select} value={outwardForm.outward_type} onChange={e => setOutwardForm({ ...outwardForm, outward_type: e.target.value })}>
                    <option value="issue">Department Issue (Production / Maintenance)</option>
                    <option value="return_to_vendor">Return to Vendor (RTV)</option>
                    <option value="transfer">Inter-Store Transfer</option>
                  </select>
                </div>
                <div>
                  <label style={S.label}>Work Order / Ref #</label>
                  <input style={S.input} placeholder="WO # / Indent Ref" value={outwardForm.reference_id} onChange={e => setOutwardForm({ ...outwardForm, reference_id: e.target.value })} />
                </div>
              </div>

              <div>
                <label style={S.label}>Select Material *</label>
                <select style={S.select} value={outwardForm.material_id} onChange={e => setOutwardForm({ ...outwardForm, material_id: e.target.value })} required>
                  <option value="">-- Choose Material --</option>
                  {mats.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.name} [{m.code}] { (m.poCount || m.po_count) ? `[${m.poCount || m.po_count} POs]` : '' } — Available Stock: {m.current_stock || m.currentStock || 0} {m.uom}
                    </option>
                  ))}
                </select>
              </div>

              {selectedOutwardMat && (
                <div style={{ background: Number(selectedOutwardMat.current_stock||0) > 0 ? '#f0fdf4' : '#fef2f2', padding: '8px 12px', borderRadius: 6, fontSize: 13, color: Number(selectedOutwardMat.current_stock||0) > 0 ? '#166534' : '#991b1b', fontWeight: 600 }}>
                  📦 Available in Store: {selectedOutwardMat.current_stock || 0} {selectedOutwardMat.uom} | Location: {selectedOutwardMat.binLocation || selectedOutwardMat.bin_location || 'Main Store'}
                </div>
              )}

              <div style={S.grid2}>
                <div>
                  <label style={S.label}>Issue Quantity *</label>
                  <input type="number" step="0.001" max={selectedOutwardMat?.current_stock || 999999} style={S.input} placeholder="0.000" value={outwardForm.out_qty} onChange={e => setOutwardForm({ ...outwardForm, out_qty: e.target.value })} required />
                </div>
                <div>
                  <label style={S.label}>Plant Department *</label>
                  <select style={S.select} value={outwardForm.department_id} onChange={e => setOutwardForm({ ...outwardForm, department_id: e.target.value })} required>
                    <option value="">-- Select Receiving Dept --</option>
                    {depts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
              </div>

              <div style={S.grid2}>
                <div>
                  <label style={S.label}>Machine / Section Context</label>
                  <select style={S.select} value={outwardForm.machine_id} onChange={e => setOutwardForm({ ...outwardForm, machine_id: e.target.value })}>
                    <option value="">-- Select Machine (Optional) --</option>
                    {machines.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={S.label}>Issued To (Person Name) *</label>
                  <input style={S.input} placeholder="e.g. Ramesh Kumar (Operator)" value={outwardForm.issued_to} onChange={e => setOutwardForm({ ...outwardForm, issued_to: e.target.value })} required />
                </div>
              </div>

              <div style={S.grid2}>
                <div>
                  <label style={S.label}>Serial # / Asset Tag (For Traceability)</label>
                  <input style={S.input} placeholder="Scan motor / bearing serial..." value={outwardForm.serial_number} onChange={e => setOutwardForm({ ...outwardForm, serial_number: e.target.value })} />
                </div>
                <div>
                  <label style={S.label}>Purpose *</label>
                  <input style={S.input} placeholder="e.g. PM1 Felt Roll Replacement" value={outwardForm.purpose} onChange={e => setOutwardForm({ ...outwardForm, purpose: e.target.value })} required />
                </div>
              </div>

              <div>
                <label style={S.label}>Remarks / Shift Details</label>
                <textarea style={S.input} rows={2} placeholder="Shift A/B/C, authorization notes..." value={outwardForm.remarks} onChange={e => setOutwardForm({ ...outwardForm, remarks: e.target.value })} />
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 10 }}>
                <button type="button" style={S.btnGhost} onClick={() => setOutwardModal(false)}>Cancel</button>
                <button type="submit" style={{ ...S.btn, background: '#d97706' }}>Confirm Stock Issue</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: PRINTABLE A3/A4 INWARD GOODS RECEIPT NOTE (GRN) INVOICE ── */}
      {inwardVoucher && (
        <div style={S.overlay} onClick={() => setInwardVoucher(null)}>
          <div style={{ ...S.modal, maxWidth: 840, background: '#ffffff', padding: 32, position: 'relative', overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
            
            {/* Diagonal Watermark */}
            <div style={{
              position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%) rotate(-35deg)',
              fontSize: 48, fontWeight: 900, color: 'rgba(0,0,0,0.035)', pointerEvents: 'none',
              whiteSpace: 'nowrap', textTransform: 'uppercase', letterSpacing: 8, userSelect: 'none', zIndex: 0
            }}>
              SRI M.K. PAPER MILLS — VERIFIED GRN
            </div>

            {/* Document Container */}
            <div style={{ position: 'relative', zIndex: 1 }}>
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #1b1b1d', paddingBottom: 14, marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: '#1b1b1d', letterSpacing: 0.5 }}>SRI M.K. PAPER MILLS PRIVATE LIMITED</div>
                  <div style={{ fontSize: 12, color: '#4b5563', marginTop: 2, fontWeight: 500 }}>
                    Manufacturers of High-Strength Kraft Paper & Multi-Layer Packaging Board
                  </div>
                  <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>
                    Plant: Survey No. 128/1, Industrial Area, Village Gangur, Dist. Dharwad - 580011, Karnataka, India
                  </div>
                  <div style={{ fontSize: 11, color: '#1b1b1d', fontWeight: 600, marginTop: 4 }}>
                    GSTIN: 29AABCS1234F1Z8 | CIN: U21012KA2015PTC081234 | State Code: 29
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ background: '#0f766e', color: '#ffffff', padding: '4px 12px', borderRadius: 4, fontWeight: 700, fontSize: 12, display: 'inline-block', textTransform: 'uppercase' }}>
                    GOODS RECEIPT NOTE (GRN)
                  </div>
                  <div style={{ fontSize: 11, color: '#059669', fontWeight: 700, marginTop: 6 }}>
                    ✓ ORIGINAL FOR STORE & ACCOUNTS
                  </div>
                </div>
              </div>

              {/* 2-Column Info Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
                <div style={{ background: '#f8fafc', padding: 12, borderRadius: 6, border: '1px solid #e2e8f0', fontSize: 12 }}>
                  <div style={{ fontWeight: 700, color: '#0f766e', marginBottom: 6, textTransform: 'uppercase', fontSize: 11 }}>
                    🏢 Vendor & Consignor Particulars
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#1b1b1d' }}>
                    {inwardVoucher.remarks?.includes('Party:') ? inwardVoucher.remarks.split('Party:')[1]?.split('|')[0]?.trim() : (inwardVoucher.vendor_name || 'Direct / OEM Supplier')}
                  </div>
                  <div style={{ marginTop: 4, color: '#64748b' }}>
                    Supplier Reference: <b>{inwardVoucher.reference_id || 'PO-REGULAR'}</b>
                  </div>
                  <div style={{ color: '#64748b', marginTop: 2 }}>
                    {inwardVoucher.remarks?.includes('Inv:') ? `Invoice Ref: ${inwardVoucher.remarks.split('Inv:')[1]?.split('|')[0]?.trim()}` : `Ref Type: ${inwardVoucher.reference_type || 'Vendor Invoice'}`}
                  </div>
                  <div style={{ color: '#64748b', marginTop: 2 }}>
                    {inwardVoucher.remarks?.includes('Transport:') ? `Transporter: ${inwardVoucher.remarks.split('Transport:')[1]?.split('|')[0]?.trim()}` : 'Dispatch: Mill Store Inward Gate'}
                  </div>
                </div>

                <div style={{ background: '#f8fafc', padding: 12, borderRadius: 6, border: '1px solid #e2e8f0', fontSize: 12 }}>
                  <div style={{ fontWeight: 700, color: '#0f766e', marginBottom: 6, textTransform: 'uppercase', fontSize: 11 }}>
                    📋 Receipt & Inspection Details
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 4 }}>
                    <span style={{ color: '#64748b' }}>IGRN Number:</span>
                    <b>{inwardVoucher.reference_id && String(inwardVoucher.reference_id).startsWith('2026') ? `IGRN-${inwardVoucher.reference_id}` : `IGRN-${inwardVoucher.id.toString().padStart(5, '0')}`}</b>
                    
                    <span style={{ color: '#64748b' }}>Inward Date:</span>
                    <b>{new Date(inwardVoucher.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</b>
                    
                    <span style={{ color: '#64748b' }}>Storage Bin/Rack:</span>
                    <b>{inwardVoucher.bin_location || 'Main Store Floor (Rack M-1)'}</b>
                    
                    <span style={{ color: '#64748b' }}>Batch/Serial #:</span>
                    <b>{inwardVoucher.batch_number || 'LOT-2026-AUG'}</b>

                    <span style={{ color: '#64748b' }}>QC Status:</span>
                    <span style={{ color: '#059669', fontWeight: 700 }}>✓ Passed Quality Inspection</span>
                  </div>
                </div>
              </div>

              {/* Line Items Table */}
              <div style={{ border: '1px solid #cbd5e1', borderRadius: 6, overflow: 'hidden', marginBottom: 16 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #cbd5e1', color: '#475569', fontWeight: 700, textAlign: 'left' }}>
                      <th style={{ padding: '8px 10px', width: 40 }}>S.No</th>
                      <th style={{ padding: '8px 10px', width: 100 }}>Material Code</th>
                      <th style={{ padding: '8px 10px' }}>Material Description & Specification</th>
                      <th style={{ padding: '8px 10px', width: 90 }}>Category</th>
                      <th style={{ padding: '8px 10px', width: 60, textAlign: 'center' }}>UOM</th>
                      <th style={{ padding: '8px 10px', width: 80, textAlign: 'right' }}>Recv Qty</th>
                      <th style={{ padding: '8px 10px', width: 90, textAlign: 'right' }}>Unit Rate (₹)</th>
                      <th style={{ padding: '8px 10px', width: 100, textAlign: 'right' }}>Net Value (₹)</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '10px' }}>1</td>
                      <td style={{ padding: '10px' }}><span style={S.code}>{inwardVoucher.materialCode}</span></td>
                      <td style={{ padding: '10px' }}>
                        <div style={{ fontWeight: 700, color: '#0f172a' }}>{inwardVoucher.materialName}</div>
                        <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{inwardVoucher.remarks || 'Standard Plant Store Inward'}</div>
                      </td>
                      <td style={{ padding: '10px', color: '#475569' }}>{inwardVoucher.categoryName || 'General'}</td>
                      <td style={{ padding: '10px', textAlign: 'center', fontWeight: 600 }}>{inwardVoucher.uom}</td>
                      <td style={{ padding: '10px', textAlign: 'right', fontWeight: 700, color: '#059669' }}>{Number(inwardVoucher.in_qty).toFixed(3)}</td>
                      <td style={{ padding: '10px', textAlign: 'right' }}>₹{Number(inwardVoucher.unit_price || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                      <td style={{ padding: '10px', textAlign: 'right', fontWeight: 800 }}>₹{Number(inwardVoucher.value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    </tr>
                  </tbody>
                  <tfoot>
                    <tr style={{ background: '#f8fafc', fontWeight: 800, borderTop: '2px solid #cbd5e1' }}>
                      <td colSpan={5} style={{ padding: '10px', textAlign: 'right' }}>GRAND TOTAL VALUATION (₹):</td>
                      <td style={{ padding: '10px', textAlign: 'right', color: '#059669' }}>{Number(inwardVoucher.in_qty).toFixed(3)}</td>
                      <td style={{ padding: '10px' }}></td>
                      <td style={{ padding: '10px', textAlign: 'right', fontSize: 13, color: '#0f766e' }}>
                        ₹{Number(inwardVoucher.value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Quality & Terms Note */}
              <div style={{ background: '#f8fafc', padding: '10px 12px', borderRadius: 6, border: '1px solid #e2e8f0', fontSize: 11, color: '#475569', marginBottom: 24 }}>
                <b>Store & Quality Certification:</b> Certified that the materials listed above have been physically inspected, counted, weight-verified, checked against Purchase Order specifications, and taken into store inventory records at the specified bin location.
              </div>

              {/* 4-Column Signatures */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, paddingTop: 16, borderTop: '1px solid #cbd5e1', textAlign: 'center', fontSize: 11 }}>
                <div>
                  <div style={{ height: 36 }}></div>
                  <div style={{ borderTop: '1px dashed #94a3b8', paddingTop: 4, fontWeight: 700 }}>{inwardVoucher.createdByName || 'Store Clerk'}</div>
                  <div style={{ color: '#64748b' }}>Received By</div>
                </div>
                <div>
                  <div style={{ height: 36 }}></div>
                  <div style={{ borderTop: '1px dashed #94a3b8', paddingTop: 4, fontWeight: 700 }}>QC Lead Inspector</div>
                  <div style={{ color: '#64748b' }}>Inspected & Verified</div>
                </div>
                <div>
                  <div style={{ height: 36 }}></div>
                  <div style={{ borderTop: '1px dashed #94a3b8', paddingTop: 4, fontWeight: 700 }}>Head of Stores</div>
                  <div style={{ color: '#64748b' }}>Store In-Charge</div>
                </div>
                <div>
                  <div style={{ height: 36 }}></div>
                  <div style={{ borderTop: '1px dashed #94a3b8', paddingTop: 4, fontWeight: 700 }}>Accounts & Finance</div>
                  <div style={{ color: '#64748b' }}>Authorized Signatory</div>
                </div>
              </div>

              {/* Modal Footer Controls */}
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 24, borderTop: '1px solid #e2e8f0', paddingTop: 14 }}>
                <button type="button" style={S.btnGhost} onClick={() => setInwardVoucher(null)}>Close Slip</button>
                <button type="button" style={{ ...S.btn, background: '#0f766e' }} onClick={() => window.print()}>
                  🖨️ Print A3 / A4 Official Invoice
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: PRINTABLE OUTWARD VOUCHER ── */}
      {outwardVoucher && (
        <div style={S.overlay}>
          <div style={{ ...S.modal, maxWidth: 550, background: '#fff' }}>
            <div style={{ textAlign: 'center', borderBottom: '2px dashed #e7e6df', paddingBottom: 12, marginBottom: 14 }}>
              <div style={{ fontSize: 18, fontWeight: 700 }}>SRI M.K. PAPER MILLS PVT LTD</div>
              <div style={{ fontSize: 13, color: '#8a8a90' }}>STORE ISSUE VOUCHER (SIV)</div>
              <div style={{ fontSize: 12, marginTop: 4 }}>Date: {new Date(outwardVoucher.date).toLocaleDateString('en-IN')} | Ref: {outwardVoucher.reference_id || 'SIV-'+outwardVoucher.id}</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13 }}>
              <div><b>Material:</b> {outwardVoucher.materialName} ({outwardVoucher.materialCode})</div>
              <div><b>Category:</b> {outwardVoucher.categoryName || 'General'}</div>
              <div><b>Issued Quantity:</b> <span style={{ color: '#dc2626', fontWeight: 700 }}>{outwardVoucher.out_qty} {outwardVoucher.uom}</span></div>
              <div><b>Store Balance Remaining:</b> {outwardVoucher.balance} {outwardVoucher.uom}</div>
              <div><b>Valuation:</b> ₹{Number(outwardVoucher.value || 0).toLocaleString('en-IN')}</div>
              <div><b>Issued For / Remarks:</b> {outwardVoucher.remarks || '—'}</div>
              <div><b>Issued By:</b> {outwardVoucher.createdByName || 'Store Keeper'}</div>
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
              <button style={S.btnGhost} onClick={() => setOutwardVoucher(null)}>Close</button>
              <button style={S.btn} onClick={() => window.print()}>🖨️ Print SIV Slip</button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: EDIT INWARD ENTRY ── */}
      {editInwardModal && (
        <div style={S.overlay}>
          <div style={{ ...S.modal, maxWidth: 600 }}>
            <div style={S.modalHdr}>
              <div>
                <b>✏️ Edit Inward Entry — {editInwardModal.materialName}</b>
                <div style={S.muted}>Update quantity, unit rate, or receipt details</div>
              </div>
              <button style={S.x} onClick={() => setEditInwardModal(null)}>✕</button>
            </div>
            <form onSubmit={handleUpdateInward} style={S.form}>
              <div style={S.grid2}>
                <div>
                  <label style={S.label}>Inward Qty *</label>
                  <input type="number" step="0.001" style={S.input} value={editInwardForm.in_qty} onChange={e => setEditInwardForm({ ...editInwardForm, in_qty: e.target.value })} required />
                </div>
                <div>
                  <label style={S.label}>Unit Price (₹)</label>
                  <input type="number" step="0.01" style={S.input} value={editInwardForm.unit_price} onChange={e => setEditInwardForm({ ...editInwardForm, unit_price: e.target.value })} />
                </div>
              </div>

              <div style={S.grid2}>
                <div>
                  <label style={S.label}>Receipt Date</label>
                  <input type="date" style={S.input} value={editInwardForm.date} onChange={e => setEditInwardForm({ ...editInwardForm, date: e.target.value })} />
                </div>
                <div>
                  <label style={S.label}>Ref Number (PO / Inv)</label>
                  <input style={S.input} value={editInwardForm.reference_id} onChange={e => setEditInwardForm({ ...editInwardForm, reference_id: e.target.value })} />
                </div>
              </div>

              <div style={S.grid2}>
                <div>
                  <label style={S.label}>Target Bin Location</label>
                  <input style={S.input} value={editInwardForm.bin_location} onChange={e => setEditInwardForm({ ...editInwardForm, bin_location: e.target.value })} />
                </div>
                <div>
                  <label style={S.label}>Batch / Serial #</label>
                  <input style={S.input} value={editInwardForm.batch_number} onChange={e => setEditInwardForm({ ...editInwardForm, batch_number: e.target.value })} />
                </div>
              </div>

              <div>
                <label style={S.label}>Remarks / Party Info</label>
                <textarea style={S.input} rows={2} value={editInwardForm.remarks} onChange={e => setEditInwardForm({ ...editInwardForm, remarks: e.target.value })} />
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 10 }}>
                <button type="button" style={S.btnGhost} onClick={() => setEditInwardModal(null)}>Cancel</button>
                <button type="submit" style={{ ...S.btn, background: '#2563eb' }}>Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: EDIT OUTWARD ENTRY ── */}
      {editOutwardModal && (
        <div style={S.overlay}>
          <div style={{ ...S.modal, maxWidth: 600 }}>
            <div style={S.modalHdr}>
              <div>
                <b>✏️ Edit Outward Issue — {editOutwardModal.materialName}</b>
                <div style={S.muted}>Update issued quantity, receiving department or purpose</div>
              </div>
              <button style={S.x} onClick={() => setEditOutwardModal(null)}>✕</button>
            </div>
            <form onSubmit={handleUpdateOutward} style={S.form}>
              <div style={S.grid2}>
                <div>
                  <label style={S.label}>Issued Qty *</label>
                  <input type="number" step="0.001" style={S.input} value={editOutwardForm.out_qty} onChange={e => setEditOutwardForm({ ...editOutwardForm, out_qty: e.target.value })} required />
                </div>
                <div>
                  <label style={S.label}>Receiving Department</label>
                  <select style={S.select} value={editOutwardForm.department_id} onChange={e => setEditOutwardForm({ ...editOutwardForm, department_id: e.target.value })}>
                    <option value="">-- Select Department --</option>
                    {depts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
              </div>

              <div style={S.grid2}>
                <div>
                  <label style={S.label}>Issue Date</label>
                  <input type="date" style={S.input} value={editOutwardForm.date} onChange={e => setEditOutwardForm({ ...editOutwardForm, date: e.target.value })} />
                </div>
                <div>
                  <label style={S.label}>Issued To (Person Name)</label>
                  <input style={S.input} value={editOutwardForm.issued_to} onChange={e => setEditOutwardForm({ ...editOutwardForm, issued_to: e.target.value })} />
                </div>
              </div>

              <div>
                <label style={S.label}>Purpose</label>
                <input style={S.input} value={editOutwardForm.purpose} onChange={e => setEditOutwardForm({ ...editOutwardForm, purpose: e.target.value })} />
              </div>

              <div>
                <label style={S.label}>Remarks</label>
                <textarea style={S.input} rows={2} value={editOutwardForm.remarks} onChange={e => setEditOutwardForm({ ...editOutwardForm, remarks: e.target.value })} />
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 10 }}>
                <button type="button" style={S.btnGhost} onClick={() => setEditOutwardModal(null)}>Cancel</button>
                <button type="submit" style={{ ...S.btn, background: '#2563eb' }}>Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {rejectModal && (
        <ConfirmModal
          isOpen={true}
          title="Reject Store Request"
          message={`Please provide a reason for rejecting request ${rejectModal.issue_number || rejectModal.issueNumber}:`}
          confirmLabel="Confirm Rejection"
          confirmVariant="danger"
          promptMode={true}
          promptPlaceholder="Reason for rejection (required)..."
          isLoading={actionLoading}
          onConfirm={handleRejectIssue}
          onCancel={() => setRejectModal(null)}
        />
      )}

      {/* Retire Asset Modal */}
      {retireModal && (
        <ConfirmModal
          isOpen={true}
          title="Retire Asset from Service"
          message={`Are you sure you want to retire asset "${retireModal.serialNumber}" (${retireModal.materialName})? Enter reason / failure note:`}
          confirmLabel="Retire Asset"
          confirmVariant="danger"
          promptMode={true}
          promptPlaceholder="e.g. Bearing race cracked / Worn beyond tolerance..."
          isLoading={actionLoading}
          onConfirm={handleRetireAssetConfirm}
          onCancel={() => setRetireModal(null)}
        />
      )}

      {/* Indent / Issue Request Modal */}
      {modal && (
        <div style={S.overlay}>
          <div style={S.modal}>
            <div style={S.modalHdr}><b>Raise Store Request / Indent</b><button style={S.x} onClick={() => setModal(false)}>✕</button></div>
            <form onSubmit={handleCreateIssue} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              
              <label style={S.label}>Select Material *</label>
              <input style={{...S.input, marginBottom: 4, background:'#fefce8'}} placeholder='🔍 Filter materials...' value={matSearch} onChange={e => setMatSearch(e.target.value)} />
              <select style={S.input} value={form.materialId} onChange={e => setForm({ ...form, materialId: e.target.value })} required>
                <option value="">-- Choose Material --</option>
                {mats.filter(m => !matSearch || (m.name||'').toLowerCase().includes(matSearch.toLowerCase()) || (m.code||'').toLowerCase().includes(matSearch.toLowerCase())).map(m => (
                  <option key={m.id} value={m.id}>{m.name} ({m.code}) - Stock: {m.current_stock||m.currentStock||0}</option>
                ))}
              </select>

              <label style={S.label}>Requesting Department *</label>
              <select style={S.input} value={form.departmentId} onChange={e => setForm({ ...form, departmentId: e.target.value })} required>
                <option value="">-- Choose Department --</option>
                {depts.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>

              <label style={S.label}>Machine / Plant Section Context</label>
              <select style={S.input} value={form.machine_id} onChange={e => setForm({ ...form, machine_id: e.target.value })}>
                <option value="">-- Choose Machine (Optional) --</option>
                {machines.map(m => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>

              <label style={S.label}>Machine Assembly Position</label>
              <select style={S.input} value={form.position_id} onChange={e => setForm({ ...form, position_id: e.target.value })}>
                <option value="">-- Choose Assembly Position --</option>
                {positions.filter(p => !form.machine_id || p.machineId === parseInt(form.machine_id)).map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>

              <label style={S.label}>Quantity *</label>
              <input type="number" step="0.01" style={S.input} value={form.quantity} onChange={e => setForm({ ...form, quantity: e.target.value })} required />

              <label style={S.label}>Justification / Reason (min 10 chars) *</label>
              <textarea style={S.input} rows={2} placeholder="Explain why this item is needed..." value={form.justification} onChange={e => setForm({ ...form, justification: e.target.value })} required minLength={10} />

              <label style={S.label}>Purpose *</label>
              <input type="text" style={S.input} value={form.purpose} onChange={e => setForm({ ...form, purpose: e.target.value })} required />

              <label style={S.label}>Required By Date</label>
              <input type="date" style={S.input} value={form.required_by_date} onChange={e => setForm({ ...form, required_by_date: e.target.value })} />

              <label style={S.label}>Estimated Value</label>
              <input type="number" step="0.01" style={S.input} placeholder="₹ 0.00" value={form.estimated_value} onChange={e => setForm({ ...form, estimated_value: e.target.value })} />

              <label style={S.label}>Remarks</label>
              <textarea style={S.input} rows={2} value={form.remarks} onChange={e => setForm({ ...form, remarks: e.target.value })} />

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 10 }}>
                <button type="button" style={S.btnGhost} onClick={() => setModal(false)}>Cancel</button>
                <button type="submit" style={S.btn}>Submit Request</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Issue Modal */}
      {editModal && (
        <div style={S.overlay}>
          <div style={S.modal}>
            <div style={S.modalHdr}><b>Edit Store Request</b><button style={S.x} onClick={() => setEditModal(null)}>✕</button></div>
            <form onSubmit={handleEditIssue} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <label style={S.label}>Material</label>
              <select style={S.input} value={editForm.materialId} onChange={e => setEditForm({ ...editForm, materialId: e.target.value })} required>
                {mats.map(m => (
                  <option key={m.id} value={m.id}>{m.name} ({m.code})</option>
                ))}
              </select>

              <label style={S.label}>Department</label>
              <select style={S.input} value={editForm.departmentId} onChange={e => setEditForm({ ...editForm, departmentId: e.target.value })} required>
                {depts.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>

              <label style={S.label}>Quantity *</label>
              <input type="number" step="0.01" style={S.input} value={editForm.quantity} onChange={e => setEditForm({ ...editForm, quantity: e.target.value })} required />

              <label style={S.label}>Justification</label>
              <textarea style={S.input} rows={2} value={editForm.justification} onChange={e => setEditForm({ ...editForm, justification: e.target.value })} minLength={10} />

              <label style={S.label}>Purpose</label>
              <input type="text" style={S.input} value={editForm.purpose} onChange={e => setEditForm({ ...editForm, purpose: e.target.value })} required />

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 10 }}>
                <button type="button" style={S.btnGhost} onClick={() => setEditModal(null)}>Cancel</button>
                <button type="submit" style={S.btn}>Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Issue Process Modal */}
      {issueProcessModal && (
        <div style={S.overlay}>
          <div style={S.modal}>
            <div style={S.modalHdr}><b>Process Picking & Stock Issue</b><button style={S.x} onClick={() => setIssueProcessModal(false)}>✕</button></div>
            {msg && <div style={S.err}>{msg}</div>}
            <form onSubmit={handleIssueApprove} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <label style={S.label}>Issuance Option</label>
              <select style={S.input} value={issueForm.issue_option} onChange={e => setIssueForm({ ...issueForm, issue_option: e.target.value })}>
                <option value="full">Full Issue</option>
                <option value="partial">Partial Issue</option>
                <option value="substitute">Substitute Equivalent</option>
              </select>

              <label style={S.label}>Scan/Enter Serial Number (For Motors/Bearings/PLCs)</label>
              <input type="text" style={S.input} placeholder="Scan barcode serial..." value={issueForm.serial_number} onChange={e => setIssueForm({ ...issueForm, serial_number: e.target.value })} />

              <label style={S.label}>Scan/Enter Batch/Lot Number (For Oils/Grease)</label>
              <input type="text" style={S.input} placeholder="Lot/Batch number..." value={issueForm.batch_number} onChange={e => setIssueForm({ ...issueForm, batch_number: e.target.value })} />

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 10 }}>
                <button type="button" style={S.btnGhost} onClick={() => setIssueProcessModal(false)}>Cancel</button>
                <button type="submit" style={S.btn}>Record Stock Issue</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── UNIFIED PRODUCT SPECIFICATION & STOCK LEDGER MODAL ── */}
      <ProductDetailModal
        materialId={selectedProductModalId}
        isOpen={!!selectedProductModalId}
        onClose={() => setSelectedProductModalId(null)}
        onUpdated={loadBaseData}
      />
    </div>
  )
}

const S = {
  page: { padding: 24, background: '#f6f5f0', minHeight: '100vh', color: '#1b1b1d' },
  hdr: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  title: { fontSize: 22, fontWeight: 700, color: '#1b1b1d' },
  sub: { fontSize: 13, color: '#8a8a90', marginTop: 4 },
  kpiGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14, marginBottom: 18 },
  kpiCard: { background: '#ffffff', borderRadius: 10, padding: '16px 20px', border: '1px solid #e7e6df' },
  kpiLbl: { fontSize: 12, fontWeight: 600, color: '#8a8a90', textTransform: 'uppercase' },
  kpiVal: { fontSize: 22, fontWeight: 700, color: '#1b1b1d', marginTop: 4 },
  kpiSub: { fontSize: 12, color: '#a0a0a6', marginTop: 4 },
  scopeBar: { display: 'flex', gap: 8, marginBottom: 14, overflowX: 'auto', paddingBottom: 4 },
  chip: { background: '#e7e6df', color: '#1b1b1d', border: 'none', borderRadius: 20, padding: '6px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' },
  chipActive: { background: '#1b1b1d', color: '#ffffff' },
  filterBar: { display: 'flex', gap: 10, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' },
  tableWrap: { background: '#ffffff', borderRadius: 10, overflow: 'auto', border: '1px solid #e7e6df' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  thead: { background: '#f6f5f0' },
  th: { padding: '10px 14px', textAlign: 'left', color: '#8a8a90', fontWeight: 600, fontSize: 12, textTransform: 'uppercase', borderBottom: '1px solid #e7e6df', whiteSpace: 'nowrap' },
  tr: { borderBottom: '1px solid #f1efe8' },
  td: { padding: '10px 14px', verticalAlign: 'middle' },
  muted: { color: '#a0a0a6', fontSize: 12 },
  code: { fontFamily: 'monospace', background: '#f6f5f0', padding: '2px 6px', borderRadius: 4, fontSize: 11, color: '#1b1b1d' },
  badge: { fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20, display: 'inline-block' },
  empty: { padding: 40, textAlign: 'center', color: '#8a8a90' },
  loading: { padding: 40, textAlign: 'center', color: '#8a8a90' },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modal: { background: '#ffffff', borderRadius: 12, padding: 24, width: '100%', border: '1px solid #e7e6df', maxHeight: '90vh', overflowY: 'auto' },
  modalHdr: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  x: { background: 'none', border: 'none', color: '#a0a0a6', fontSize: 18, cursor: 'pointer' },
  form: { display: 'flex', flexDirection: 'column', gap: 14 },
  grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 },
  label: { display: 'flex', flexDirection: 'column', gap: 5, fontSize: 12, color: '#1b1b1d', fontWeight: 600 },
  input: { width: '100%', background: '#f6f5f0', border: '1px solid #e7e6df', borderRadius: 6, color: '#1b1b1d', padding: '8px 12px', fontSize: 13, outline: 'none' },
  select: { width: '100%', background: '#f6f5f0', border: '1px solid #e7e6df', borderRadius: 6, padding: '8px 10px', color: '#1b1b1d', fontSize: 13 },
  err: { background: '#ef444422', border: '1px solid #ef444444', color: '#f87171', padding: '8px 12px', borderRadius: 6, fontSize: 13 },
  btn: { background: '#1b1b1d', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 18px', fontWeight: 600, fontSize: 13, cursor: 'pointer' },
  btnSm: { background: '#10b981', color: '#fff', border: 'none', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 12 },
  btnGhost: { background: '#e7e6df', color: '#1b1b1d', border: 'none', borderRadius: 8, padding: '8px 18px', fontWeight: 600, fontSize: 13, cursor: 'pointer' },
  formCard: { background: '#ffffff', borderRadius: 10, padding: 20, border: '1px solid #e7e6df' },
  formTitle: { fontSize: 16, fontWeight: 600, color: '#1b1b1d', marginBottom: 15 }
}
