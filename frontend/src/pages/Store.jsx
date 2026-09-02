import React, { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { ConfirmModal } from '../components/ui/Modal'
import { FormField } from '../components/ui/FormField'
import ProductDetailModal from '../components/ProductDetailModal'
import InventoryExportModal from '../components/InventoryExportModal'
import SearchableSelect from '../components/SearchableSelect'
import { useMinimizedModals } from '../contexts/MinimizedModalsContext'
import AgentStatusBanner from '../components/AgentStatusBanner'
import SortableTh from '../components/SortableTh'
import TableScrollWrapper from '../components/TableScrollWrapper'
import ScrollableTabs from '../components/ScrollableTabs'
import { sortTableData } from '../utils/tableSort'
import { ExternalLink } from 'lucide-react'
import { LOGO_DATA_URI } from '../utils/logo'
import A3InvoicePrintModal from '../components/A3InvoicePrintModal'
import SequenceEnforcementModal from '../components/SequenceEnforcementModal'
import StoreDeptReports from './StoreDeptReports'

const GST_SLABS = [
  { value: 0,  label: '0% (Nil / Exempt)', cgst: 0, sgst: 0, igst: 0 },
  { value: 5,  label: '5% (CGST 2.5% + SGST 2.5% / IGST 5%)', cgst: 2.5, sgst: 2.5, igst: 5 },
  { value: 12, label: '12% (CGST 6% + SGST 6% / IGST 12%)', cgst: 6, sgst: 6, igst: 12 },
  { value: 18, label: '18% (Standard GST — CGST 9% + SGST 9% / IGST 18%)', cgst: 9, sgst: 9, igst: 18 },
  { value: 28, label: '28% (Higher Slab — CGST 14% + SGST 14% / IGST 28%)', cgst: 14, sgst: 14, igst: 28 },
]

const API = '/api'
const h = () => ({ Authorization: `Bearer ${localStorage.getItem('mk_token')}` })
const json = () => ({ ...h(), 'Content-Type': 'application/json' })

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
  if (n) {
    if (str !== '') str += 'and '
    str += inWords(n)
  }
  const paise = Math.round((num - Math.floor(num)) * 100)
  if (paise > 0) {
    str += `and ${inWords(paise)}Paise `
  }
  return str.trim() + ' Rupees Only'
}

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

  const roleLevel = user?.role_level ?? 1
  const dept = (user?.department || '').toLowerCase()
  const deptCode = (user?.dept_code || '').toUpperCase()
  const isStoreManager = (
    (roleLevel >= 3 && (['STORE', 'INV', 'RMS', 'MATERIALS'].includes(deptCode) || dept.includes('store') || dept.includes('inventory') || dept.includes('raw material'))) ||
    roleLevel >= 4
  )

  const [tab, setTab] = useState('inward')
  const [exportModal, setExportModal] = useState(false)
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
  const [batchVendorInvoiceNumber, setBatchVendorInvoiceNumber] = useState('')
  const [batchRemarks, setBatchRemarks] = useState('')

  // Inbound DC -> Invoice Match (tick-mark reconciliation flow)
  const [inboundDcs, setInboundDcs] = useState([])
  const [dcDetails, setDcDetails] = useState({})
  const [dcTicked, setDcTicked] = useState({})
  const [dcLineEdits, setDcLineEdits] = useState({})
  const [dcPartyName, setDcPartyName] = useState('')
  const [dcInvoiceNumber, setDcInvoiceNumber] = useState('')
  const [dcInvoiceTotal, setDcInvoiceTotal] = useState('')
  const [dcMatching, setDcMatching] = useState(false)
  const [inwardMatSearch, setInwardMatSearch] = useState('')
  const [inwardMatDropOpen, setInwardMatDropOpen] = useState(false)
  const [searchLot, setSearchLot] = useState('')
  const [lotTraceData, setLotTraceData] = useState([])
  const [lotSearched, setLotSearched] = useState(false)
  const [lotError, setLotError] = useState(false)

  // Rejections / RTV State
  const [rejectionsList, setRejectionsList] = useState([])
  const [rejectionsSummary, setRejectionsSummary] = useState({})
  const [rejectionsLoading, setRejectionsLoading] = useState(false)
  const [rejectionsStatusFilter, setRejectionsStatusFilter] = useState('')
  const [rtvDispatchModal, setRtvDispatchModal] = useState(null)
  const [rtvDispatchForm, setRtvDispatchForm] = useState({ vehicleNumber: '', driverName: '', remarks: '' })

  // STO Transfers State
  const [transfersList, setTransfersList] = useState([])
  const [transferModal, setTransferModal] = useState(false)
  const [transferForm, setTransferForm] = useState({
    fromWarehouseId: '',
    toWarehouseId: '',
    remarks: '',
    items: [{ materialId: '', qty: '', uom: 'NOS', batchNumber: '', remarks: '' }]
  })
  const [warehouses, setWarehouses] = useState([])

  // SRV Returns State
  const [returnsList, setReturnsList] = useState([])
  const [returnModal, setReturnModal] = useState(false)
  const [returnForm, setReturnForm] = useState({
    departmentId: '',
    indentId: '',
    remarks: '',
    items: [{ materialId: '', qty: '', uom: 'NOS', conditionGrade: 'Good', remarks: '' }]
  })

  // Open Gate Passes for Inward prefill
  const [openGatePasses, setOpenGatePasses] = useState([])
  
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
  const [inwardViewMode, setInwardViewMode] = useState('master') // 'master' (consolidated 1-row-per-GRN) or 'items' (item ledger)
  const [expandedGrns, setExpandedGrns] = useState({}) // { [grnId]: boolean }
  const [inwardStoreType, setInwardStoreType] = useState('')
  const [inwardSearch, setInwardSearch] = useState('')
  const [inwardPage, setInwardPage] = useState(1)
  const [inwardTotal, setInwardTotal] = useState(0)
  const [inwardSortBy, setInwardSortBy] = useState('date')
  const [inwardSortOrder, setInwardSortOrder] = useState('desc')
  const INWARD_LIMIT = 20
  const [inwardModal, setInwardModal] = useState(false)
  const [inwardForm, setInwardForm] = useState({
    material_id: '',
    in_qty: '',
    unit_price: '',
    discount_pct: 0,
    other_charges: 0,
    tax_type: 'intra',
    gst_pct: 18,
    inward_type: 'grn',
    reference_type: 'PO',
    reference_id: '',
    vendor_id: '',
    vendor_name: '',
    bin_location: '',
    batch_number: '',
    quality_status: 'Accepted',
    remarks: '',
    gate_pass_id: ''
  })
  const [inwardVoucher, setInwardVoucher] = useState(null)
  const [vendorPickMode, setVendorPickMode] = useState('list')

  const [outwardList, setOutwardList] = useState([])
  const [outwardSummary, setOutwardSummary] = useState({})
  const [outwardLoading, setOutwardLoading] = useState(false)
  const [outwardStoreType, setOutwardStoreType] = useState('')
  const [outwardDeptFilter, setOutwardDeptFilter] = useState('')
  const [outwardTypeFilter, setOutwardTypeFilter] = useState('')
  const [outwardSearch, setOutwardSearch] = useState('')
  const [outwardPage, setOutwardPage] = useState(1)
  const [outwardTotal, setOutwardTotal] = useState(0)
  const [outwardSortBy, setOutwardSortBy] = useState('date')
  const [outwardSortOrder, setOutwardSortOrder] = useState('desc')
  const [indentSortBy, setIndentSortBy] = useState('createdAt')
  const [indentSortOrder, setIndentSortOrder] = useState('desc')
  const [approvalSortBy, setApprovalSortBy] = useState('priority')
  const [approvalSortOrder, setApprovalSortOrder] = useState('asc')
  const [rejectionSortBy, setRejectionSortBy] = useState('rejection_number')
  const [rejectionSortOrder, setRejectionSortOrder] = useState('desc')
  const [assetSortBy, setAssetSortBy] = useState('daysInService')
  const [assetSortOrder, setAssetSortOrder] = useState('desc')
  const OUTWARD_LIMIT = 20
  const [outwardModal, setOutwardModal] = useState(false)
  const [outwardModalMinimized, setOutwardModalMinimized] = useState(false)
  const { minimize: mmMinimize, close: mmClose } = useMinimizedModals()
  const createBlankOutwardItem = () => ({
    id: Date.now() + Math.random(),
    material_id: '',
    out_qty: '',
    unit_price: '',
    machine_id: '',
    position_id: '',
    section_id: '',
    serial_number: '',
    batch_number: '',
    remarks: '',
    grn_id: '',
    selectedGrnItem: null
  })

  const [vendorGrnMaterials, setVendorGrnMaterials] = useState([])
  const [loadingVendorGrn, setLoadingVendorGrn] = useState(false)
  const [selectedGrnItem, setSelectedGrnItem] = useState(null)
  const [outwardForm, setOutwardForm] = useState({
    outward_type: 'job_work',
    vendor_id: '',
    material_id: '',
    out_qty: '',
    unit_price: '',
    department_id: '',
    machine_id: '',
    section_id: '',
    position_id: '',
    issued_to: '',
    purpose: '',
    serial_number: '',
    batch_number: '',
    reference_type: 'JOB_WORK',
    reference_id: '',
    store_issue_no: '',
    date: new Date().toISOString().slice(0, 10),
    remarks: '',
    grn_id: '',
    items: [createBlankOutwardItem()]
  })
  const [outwardVoucher, setOutwardVoucher] = useState(null)
  const [syncing, setSyncing] = useState(false)

  const addOutwardItem = () => {
    setOutwardForm(prev => ({
      ...prev,
      items: [...(prev.items || []), createBlankOutwardItem()]
    }))
  }

  const removeOutwardItem = (index) => {
    setOutwardForm(prev => {
      const newItems = [...(prev.items || [])]
      if (newItems.length > 1) {
        newItems.splice(index, 1)
      } else {
        newItems[0] = createBlankOutwardItem()
      }
      return { ...prev, items: newItems }
    })
  }

  const updateOutwardItem = (index, field, value) => {
    setOutwardForm(prev => {
      const newItems = [...(prev.items || [])]
      const current = { ...(newItems[index] || createBlankOutwardItem()), [field]: value }
      if (field === 'material_id') {
        const mat = mats.find(m => String(m.id) === String(value))
        if (mat) {
          current.unit_price = mat.unit_price || mat.unitPrice || ''
        }
      }
      newItems[index] = current
      return { ...prev, items: newItems }
    })
  }

  const fetchVendorGrnMaterials = async (vendorId) => {
    if (!vendorId) {
      setVendorGrnMaterials([])
      return
    }
    setLoadingVendorGrn(true)
    try {
      const res = await fetch(`${API}/store/vendors/${vendorId}/grn-materials`, { headers: h() }).then(r => r.json())
      if (res.success) {
        setVendorGrnMaterials(res.data || [])
      } else {
        setVendorGrnMaterials([])
      }
    } catch (err) {
      console.error('Error fetching vendor GRN materials:', err)
      setVendorGrnMaterials([])
    } finally {
      setLoadingVendorGrn(false)
    }
  }

  // Master GRN Viewer & A3 Print & Receiver Sign states
  const [masterGrnModal, setMasterGrnModal] = useState(null)
  const [masterGrnLoading, setMasterGrnLoading] = useState(false)
  const [a3PrintDoc, setA3PrintDoc] = useState(null)
  const [sequenceViolation, setSequenceViolation] = useState(null)
  const [appendGrnModal, setAppendGrnModal] = useState(null)
  const [appendGrnForm, setAppendGrnForm] = useState({
    material_id: '',
    received_qty: '1',
    unit_price: '',
    discount_pct: 0,
    other_charges: 0,
    tax_type: 'intra',
    gst_pct: 18,
    bin_location: '',
    batch_number: '',
    mrp: '',
    trade_price: '',
    remarks: ''
  })
  const [appendGrnSaving, setAppendGrnSaving] = useState(false)
  const [receiverModal, setReceiverModal] = useState(null)
  const [receiverForm, setReceiverForm] = useState({
    receiver_name: user?.name || '',
    receiver_emp_code: user?.employee_code || '',
    receiver_signature_note: 'Received and verified in department',
    fitment_date: new Date().toISOString().slice(0, 10),
    observations: ''
  })
  const [receiverSaving, setReceiverSaving] = useState(false)

  const openMasterGrn = async (grnRef) => {
    if (!grnRef) return
    setMasterGrnLoading(true)
    const targetRef = typeof grnRef === 'object'
      ? (grnRef.grnId || grnRef.grn_id || (grnRef.reference_type === 'GRN' ? grnRef.reference_id : null) || grnRef.grnNumber || grnRef.grn_number || grnRef.invoice_number || grnRef.reference_id || grnRef.id)
      : grnRef
    try {
      const res = await fetch(`${API}/store/grn/${encodeURIComponent(targetRef)}`, { headers: h() })
      const data = await res.json()
      if (data.success && data.data) {
        setMasterGrnModal(data.data)
      } else {
        const res2 = await fetch(`${API}/purchase/grn/${encodeURIComponent(targetRef)}`, { headers: h() })
        const data2 = await res2.json()
        if (data2.success && data2.data) {
          setMasterGrnModal(data2.data)
        } else {
          addToast(data.message || 'Master GRN details not found', 'error')
        }
      }
    } catch {
      addToast('Failed to load Master GRN details', 'error')
    } finally {
      setMasterGrnLoading(false)
    }
  }

  const openA3Invoice = async (docOrRef) => {
    if (!docOrRef) return
    if (typeof docOrRef === 'object' && docOrRef.items && docOrRef.items.length > 0) {
      setA3PrintDoc(docOrRef)
      return
    }
    const grnRef = typeof docOrRef === 'object'
      ? (docOrRef.grnId || docOrRef.grn_id || (docOrRef.reference_type === 'GRN' ? docOrRef.reference_id : null) || docOrRef.grnNumber || docOrRef.grn_number || docOrRef.invoice_number || docOrRef.reference_id || docOrRef.id)
      : docOrRef
    try {
      const res = await fetch(`${API}/store/grn/${encodeURIComponent(grnRef)}`, { headers: h() })
      const data = await res.json()
      if (data.success && data.data) {
        setA3PrintDoc(data.data)
      } else {
        const res2 = await fetch(`${API}/purchase/grn/${encodeURIComponent(grnRef)}`, { headers: h() })
        const data2 = await res2.json()
        if (data2.success && data2.data) {
          setA3PrintDoc(data2.data)
        } else {
          setA3PrintDoc(typeof docOrRef === 'object' ? docOrRef : { grnNumber: grnRef })
        }
      }
    } catch {
      setA3PrintDoc(typeof docOrRef === 'object' ? docOrRef : { grnNumber: grnRef })
    }
  }

  const openA3InwardPrint = (row) => {
    const isInterState = (row.vendorState && row.vendorState.toLowerCase() !== 'karnataka') || (row.vendorGstin && !row.vendorGstin.startsWith('29'))
    const gPct = Number(row.gst_pct ?? 18)
    const p = Number(row.unit_price || 0)
    const q = Number(row.in_qty || row.received_qty || 1)
    const taxable = q * p
    const cgstAmt = isInterState ? 0 : (taxable * (gPct / 2)) / 100
    const sgstAmt = isInterState ? 0 : (taxable * (gPct / 2)) / 100
    const igstAmt = isInterState ? (taxable * gPct) / 100 : 0
    const totalAmount = taxable + cgstAmt + sgstAmt + igstAmt

    setA3PrintDoc({
      invoiceNumber: row.invoice_number || row.grnNumber || row.reference_id || `GRN-${row.id}`,
      invoiceDate: row.date || row.inward_date || row.created_at || new Date().toISOString(),
      orderNumber: row.po_number || row.reference_id || '',
      orderDate: row.po_date || row.poDate || row.date || row.created_at || new Date().toISOString(),
      grnNumber: row.grnNumber || row.reference_id || `GRN-${row.id}`,
      grnDate: row.date || row.inward_date || row.created_at || new Date().toISOString(),
      partyName: row.vendorName || row.partyName || 'Registered Vendor',
      partyAddress: row.vendorAddress || 'Industrial Area, Plant Supply Hub',
      partyGstin: row.vendorGstin || '29AAAAA0000A1Z5',
      partyPan: row.vendorPan || '',
      items: [{
        materialName: row.materialName,
        materialCode: row.materialCode,
        uom: row.uom || 'NOS',
        in_qty: q,
        unit_price: p,
        hsnCode: row.hsnCode || '8439',
        gst_pct: gPct,
        batch_number: row.batch_number || row.batchNo || 'LOT-01',
        pack_size: '1*1',
        mrp: p,
        trade_price: p,
        taxable_amount: taxable,
        cgst_amount: cgstAmt,
        sgst_amount: sgstAmt,
        igst_amount: igstAmt,
        total_amount: totalAmount
      }],
      title: 'GOODS RECEIPT NOTE (GRN) / COMMERCIAL INWARD'
    })
  }

  const openA3OutwardPrint = (row) => {
    const p = Number(row.unit_price || 0)
    const q = Number(row.out_qty || row.qty || 1)
    const taxable = q * p
    const gPct = 18
    const cgstAmt = (taxable * 9) / 100
    const sgstAmt = (taxable * 9) / 100
    const totalAmount = taxable + cgstAmt + sgstAmt

    setA3PrintDoc({
      invoiceNumber: row.issue_number || `SIV-${row.id}`,
      invoiceDate: row.date || row.outward_date || row.created_at || new Date().toISOString(),
      orderNumber: row.reference_id || '',
      orderDate: row.date || row.outward_date || row.created_at || new Date().toISOString(),
      grnNumber: row.issue_number || `SIV-${row.id}`,
      grnDate: row.date || row.outward_date || row.created_at || new Date().toISOString(),
      partyName: row.deptName || 'Plant Department',
      partyAddress: row.machineName ? `Machine: ${row.machineName}` : 'Mill Operations Floor',
      items: [{
        materialName: row.materialName,
        materialCode: row.materialCode,
        uom: row.uom || 'NOS',
        in_qty: q,
        unit_price: p,
        hsnCode: row.hsnCode || '8439',
        gst_pct: gPct,
        batch_number: row.batch_number || 'SIV-LOT-01',
        pack_size: '1*1',
        mrp: p,
        trade_price: p,
        taxable_amount: taxable,
        cgst_amount: cgstAmt,
        sgst_amount: sgstAmt,
        igst_amount: 0,
        total_amount: totalAmount
      }],
      title: 'STORE ISSUE VOUCHER (SIV)'
    })
  }

  const handleAppendGrnItem = async (e) => {
    e.preventDefault()
    if (!appendGrnModal || !appendGrnForm.material_id) {
      addToast('Please select a material', 'error')
      return
    }
    setAppendGrnSaving(true)
    try {
      const res = await fetch(`${API}/store/grn/${appendGrnModal.id}/items`, {
        method: 'POST',
        headers: json(),
        body: JSON.stringify(appendGrnForm)
      })
      const data = await res.json()
      if (data.success) {
        addToast('New line item appended to GRN successfully', 'success')
        setAppendGrnModal(null)
        setAppendGrnForm({
          material_id: '',
          received_qty: '1',
          unit_price: '',
          discount_pct: 0,
          other_charges: 0,
          tax_type: 'intra',
          gst_pct: 18,
          bin_location: '',
          batch_number: '',
          mrp: '',
          trade_price: '',
          remarks: ''
        })
        openMasterGrn(appendGrnModal.id)
        loadInward()
        loadBaseData()
      } else {
        addToast(data.message || 'Failed to append item', 'error')
      }
    } catch (err) {
      addToast('Error appending item: ' + err.message, 'error')
    } finally {
      setAppendGrnSaving(false)
    }
  }

  const handleReceiverSignSubmit = async (e) => {
    e.preventDefault()
    if (!receiverModal) return
    setReceiverSaving(true)
    try {
      const endpoint = receiverModal.isIndent ? `/store/indents/${receiverModal.id}/receive` : `/store/issues/${receiverModal.id}/receive`
      const res = await fetch(`${API}${endpoint}`, {
        method: 'PUT',
        headers: json(),
        body: JSON.stringify(receiverForm)
      })
      const data = await res.json()
      if (data.success) {
        addToast(data.message || 'Receiver signed and acknowledged successfully', 'success')
        setReceiverModal(null)
        loadOutward()
        loadIndents()
        loadBaseData()
      } else {
        addToast(data.message || 'Failed to record signature', 'error')
      }
    } catch (err) {
      addToast('Error recording signature: ' + err.message, 'error')
    } finally {
      setReceiverSaving(false)
    }
  }

  // Inward & Outward DML states
  const [editInwardModal, setEditInwardModal] = useState(null)
  const [editInwardForm, setEditInwardForm] = useState({})
  const [editOutwardModal, setEditOutwardModal] = useState(null)
  const [editOutwardForm, setEditOutwardForm] = useState({})

  const handleUpdateInward = async (e) => {
    e.preventDefault()
    if (!editInwardModal) return
    try {
      const { grn_vehicle_number, grn_challan_number, grn_invoice_number, ...ledgerForm } = editInwardForm
      const res = await fetch(`${API}/store/inward/${editInwardModal.id}`, {
        method: 'PUT',
        headers: json(),
        body: JSON.stringify(ledgerForm)
      })
      if (res.status === 401) {
        addToast('Authentication session expired or invalid token. Please log in again.', 'error')
        return
      }
      const r = await res.json()
      if (!r.success) {
        addToast(r.message || 'Failed to update inward record', 'error')
        return
      }

      // If this receipt is linked to a formal GRN header, sync the vehicle/challan/invoice
      // fields on the GRN itself too (separate atomic PUT — GRN is blocked server-side once
      // it is Cancelled/Closed, so this can fail independently of the line-item update above).
      if (editInwardModal.grnId) {
        const grnRes = await fetch(`${API}/store/grn/${editInwardModal.grnId}`, {
          method: 'PUT',
          headers: json(),
          body: JSON.stringify({
            vehicle_number: grn_vehicle_number || null,
            challan_number: grn_challan_number || null,
            invoice_number: grn_invoice_number || null
          })
        })
        const gr = await grnRes.json()
        if (!gr.success) {
          addToast('Inward quantity/price saved, but GRN header update failed: ' + (gr.message || ''), 'error')
          setEditInwardModal(null)
          loadInward()
          loadBaseData()
          return
        }
      }

      addToast('Inward record updated successfully', 'success')
      setEditInwardModal(null)
      loadInward()
      loadBaseData()
    } catch (err) {
      addToast('Error updating inward entry: ' + err.message, 'error')
    }
  }

  const handleDeleteInward = async (inw) => {
    if (!window.confirm(`Are you sure you want to void / delete GRN receipt for ${inw.materialName} (${inw.in_qty} ${inw.uom})? This will deduct the stock from the store.`)) return
    try {
      const res = await fetch(`${API}/store/inward/${inw.id}`, {
        method: 'DELETE',
        headers: h()
      })
      if (res.status === 401) {
        addToast('Authentication session expired or invalid token. Please log in again.', 'error')
        return
      }
      if (res.status === 403) {
        addToast('Store Manager or Administrator authorization required to delete inward entries.', 'error')
        return
      }
      const r = await res.json()
      if (r.success) {
        addToast(r.message || 'Inward record removed and stock reversed', 'info')
        loadInward()
        loadBaseData()
      } else {
        addToast(r.message || 'Failed to delete inward record', 'error')
      }
    } catch (err) {
      addToast('Error deleting inward record: ' + err.message, 'error')
    }
  }

  const handleDeleteGrn = async (grn) => {
    if (!window.confirm(`Are you sure you want to void / delete entire Master GRN ${grn.grn_number}? This will delete all linked line items and reverse stock from the store.`)) return
    try {
      const res = await fetch(`${API}/store/grn/${grn.id}`, {
        method: 'DELETE',
        headers: h()
      })
      if (res.status === 401) {
        addToast('Authentication session expired. Please log in again.', 'error')
        return
      }
      if (res.status === 403) {
        addToast('Store Manager or Administrator authorization required to delete GRN.', 'error')
        return
      }
      const r = await res.json()
      if (r.success) {
        addToast(r.message || 'GRN deleted and stock reversed', 'info')
        loadInward()
        loadBaseData()
      } else {
        addToast(r.message || 'Failed to delete GRN', 'error')
      }
    } catch (err) {
      addToast('Error deleting GRN: ' + err.message, 'error')
    }
  }

  const handleUpdateOutward = async (e) => {
    e.preventDefault()
    if (!editOutwardModal) return
    try {
      const res = await fetch(`${API}/store/outward/${editOutwardModal.id}`, {
        method: 'PUT',
        headers: json(),
        body: JSON.stringify(editOutwardForm)
      })
      if (res.status === 401) {
        addToast('Authentication session expired or invalid token. Please log in again.', 'error')
        return
      }
      const r = await res.json()
      if (r.success) {
        addToast('Outward issue updated successfully', 'success')
        setEditOutwardModal(null)
        loadOutward()
        loadBaseData()
      } else {
        addToast(r.message || 'Failed to update outward issue', 'error')
      }
    } catch (err) {
      addToast('Error updating outward issue: ' + err.message, 'error')
    }
  }

  const handleDeleteOutward = async (outw) => {
    if (!window.confirm(`Are you sure you want to cancel outward issue for ${outw.materialName} (${outw.out_qty} ${outw.uom})? This will restore the stock back to the store.`)) return
    try {
      const res = await fetch(`${API}/store/outward/${outw.id}`, {
        method: 'DELETE',
        headers: h()
      })
      if (res.status === 401) {
        addToast('Authentication session expired or invalid token. Please log in again.', 'error')
        return
      }
      const r = await res.json()
      if (r.success) {
        addToast(r.message || 'Outward issue cancelled and stock restored', 'info')
        loadOutward()
        loadBaseData()
      } else {
        addToast(r.message || 'Failed to cancel outward issue', 'error')
      }
    } catch (err) {
      addToast('Error cancelling outward issue: ' + err.message, 'error')
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
        const isInter = (po.tax_type === 'inter' || po.tax_type === 'state' || po.tax_type === 'igst') || Boolean(po.vendorGstin && !po.vendorGstin.startsWith('29'))
        const poTaxType = isInter ? 'inter' : 'intra'

        const updated = {
          ...inwardForm,
          reference_type: 'PO',
          reference_id: poNum,
          vendor_id: vId,
          vendor_name: vName,
          tax_type: poTaxType,
          remarks: `Auto-populated from PO ${poNum}`
        }

        // Initialize batch quantities with pending balances
        const batchInit = {}
        if (po.items && po.items.length) {
          po.items.forEach(it => {
            const rem = Math.max(0, parseFloat(it.qty || 0) - parseFloat(it.received_qty || 0))
            batchInit[it.id] = {
              in_qty: rem > 0 ? String(rem) : '',
              unit_price: it.unit_price ? String(it.unit_price) : '',
              discount_pct: it.discount_pct !== undefined ? String(it.discount_pct) : '0',
              other_charges: it.other_charges !== undefined ? String(it.other_charges) : '0',
              tax_type: it.tax_type || poTaxType,
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
          updated.discount_pct = firstPending.discount_pct !== undefined ? Number(firstPending.discount_pct) : 0
          updated.other_charges = firstPending.other_charges !== undefined ? Number(firstPending.other_charges) : 0
          updated.tax_type = firstPending.tax_type || poTaxType
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
      const isInter = (item.tax_type === 'inter' || item.tax_type === 'state' || item.tax_type === 'igst') || Boolean(activePoDetails.vendorGstin && !activePoDetails.vendorGstin.startsWith('29'))
      setInwardForm(prev => ({
        ...prev,
        material_id: String(item.material_id),
        in_qty: remainingQty > 0 ? remainingQty.toString() : (item.qty ? String(item.qty) : ''),
        unit_price: item.unit_price ? item.unit_price.toString() : '',
        discount_pct: item.discount_pct !== undefined ? Number(item.discount_pct) : 0,
        other_charges: item.other_charges !== undefined ? Number(item.other_charges) : 0,
        tax_type: item.tax_type || (isInter ? 'inter' : 'intra'),
        gst_pct: Number(item.gst_pct ?? 18),
        bin_location: item.binLocation || prev.bin_location,
        remarks: `Auto-populated from PO ${activePoDetails.po_number || activePoDetails.poNumber} — ${item.materialName || item.description || ''}`
      }))
    }
  }

  // Batch Inward submit for multi-item PO
  // Load DCs received but not yet invoice-matched, for tick-mark selection
  const loadOpenInboundDcs = async () => {
    try {
      const r = await fetch(`${API}/inbound-dc?status=received`, { headers: h() }).then(res => res.json())
      if (r.success) {
        setInboundDcs(r.data || [])
        const details = await Promise.all((r.data || []).map(dc =>
          fetch(`${API}/inbound-dc/${dc.id}`, { headers: h() }).then(res => res.json()).then(res => res.success ? res.data : null)
        ))
        const map = {}
        const edits = {}
        details.filter(Boolean).forEach(dc => {
          map[dc.id] = dc
          ;(dc.items || []).forEach(it => {
            const mat = mats.find(m => String(m.id) === String(it.material_id))
            edits[it.id] = {
              unit_price: mat?.unit_price != null ? String(mat.unit_price) : '0',
              discount_pct: '0',
              gst_amount: '0'
            }
          })
        })
        setDcDetails(map)
        setDcLineEdits(prev => ({ ...edits, ...prev }))
      }
    } catch (e) {
      console.error('Failed to load open Inbound DCs', e)
    }
  }

  useEffect(() => {
    if (inwardModal && inwardForm.reference_type === 'DC') {
      loadOpenInboundDcs()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inwardModal, inwardForm.reference_type])

  const dcLineTotal = (dcId, itemId, qty) => {
    const e = dcLineEdits[itemId] || {}
    const rate = parseFloat(e.unit_price || 0)
    const disc = parseFloat(e.discount_pct || 0)
    const gstAmt = parseFloat(e.gst_amount || 0)
    const taxable = parseFloat(qty || 0) * rate * (1 - disc / 100)
    return taxable + gstAmt
  }

  const dcSelectedTotal = Object.keys(dcTicked)
    .filter(id => dcTicked[id])
    .reduce((sum, id) => {
      const dc = dcDetails[id]
      if (!dc) return sum
      return sum + (dc.items || []).reduce((s, it) => s + dcLineTotal(id, it.id, it.qty), 0)
    }, 0)

  const handleMatchAndCreateGrn = async () => {
    const ids = Object.keys(dcTicked).filter(id => dcTicked[id])
    if (!ids.length) return addToast('Tick at least one received DC to match against the invoice', 'warning')
    if (!dcPartyName.trim()) return addToast('Party Name is required', 'warning')
    if (!dcInvoiceNumber.trim()) return addToast('Vendor Invoice Number is required', 'warning')
    setDcMatching(true)
    try {
      for (const id of ids) {
        const dc = dcDetails[id]
        const itemsOverride = (dc?.items || []).map(it => {
          const e = dcLineEdits[it.id] || {}
          return {
            id: it.id,
            unit_price: parseFloat(e.unit_price || 0),
            discount_pct: parseFloat(e.discount_pct || 0),
            gst_amount: parseFloat(e.gst_amount || 0)
          }
        })
        const mRes = await fetch(`${API}/inbound-dc/${id}/match-invoice`, {
          method: 'POST', headers: json(),
          body: JSON.stringify({ invoice_number: dcInvoiceNumber, party_name_confirmed: true, party_name: dcPartyName })
        }).then(res => res.json())
        if (!mRes.success) throw new Error(mRes.message || `Invoice match failed for DC ${dc?.dc_no || id}`)
        const gRes = await fetch(`${API}/inbound-dc/${id}/grn`, {
          method: 'POST', headers: json(),
          body: JSON.stringify({ party_name: dcPartyName, items: itemsOverride })
        }).then(res => res.json())
        if (!gRes.success) throw new Error(gRes.message || `GRN creation failed for DC ${dc?.dc_no || id}`)
      }
      addToast('Invoice matched & GRN created from selected DC(s)', 'success')
      setInwardModal(false)
      setDcTicked({})
      setDcLineEdits({})
      setDcPartyName('')
      setDcInvoiceNumber('')
      setDcInvoiceTotal('')
      setInboundDcs([])
      setDcDetails({})
      loadInward()
    } catch (err) {
      addToast(err.message || 'Failed to match invoice / create GRN', 'error')
    } finally {
      setDcMatching(false)
    }
  }

  const handleCreateBatchInward = async (e) => {
    if (e) e.preventDefault()
    if (!activePoDetails || !activePoDetails.items?.length) return
    const validLines = []
    for (const it of activePoDetails.items) {
      const bRow = batchInwardQtys[it.id] || {}
      const q = parseFloat(bRow.in_qty || 0)
      if (q > 0) {
        validLines.push({
          material_id: it.material_id,
          in_qty: q,
          unit_price: parseFloat(bRow.unit_price !== undefined && bRow.unit_price !== '' ? bRow.unit_price : it.unit_price) || 0,
          discount_pct: parseFloat(bRow.discount_pct !== undefined && bRow.discount_pct !== '' ? bRow.discount_pct : (it.discount_pct || 0)) || 0,
          other_charges: parseFloat(bRow.other_charges !== undefined && bRow.other_charges !== '' ? bRow.other_charges : (it.other_charges || 0)) || 0,
          tax_type: bRow.tax_type || it.tax_type || inwardForm.tax_type || 'intra',
          gst_pct: Number(it.gst_pct ?? 18),
          bin_location: bRow.bin_location || it.binLocation || '',
          batch_number: bRow.batch_number || '',
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
        tax_type: inwardForm.tax_type || 'intra',
        quality_status: inwardForm.quality_status || 'Accepted',
        invoice_number: batchVendorInvoiceNumber || undefined,
        remarks: batchRemarks || inwardForm.remarks || `Batch PO Inward`,
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
        setBatchVendorInvoiceNumber('')
        setBatchRemarks('')
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

  const toggleExpandGrn = (grnId) => {
    setExpandedGrns(prev => ({
      ...prev,
      [grnId]: !prev[grnId]
    }))
  }

  const loadInward = useCallback(async () => {
    setInwardLoading(true)
    try {
      const params = new URLSearchParams()
      params.append('view', inwardViewMode)
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
  }, [inwardStoreType, inwardSearch, inwardPage, inwardViewMode])

  const loadOutward = useCallback(async () => {
    setOutwardLoading(true)
    try {
      const params = new URLSearchParams()
      if (outwardStoreType) params.append('store_type', outwardStoreType)
      if (outwardDeptFilter) params.append('department_id', outwardDeptFilter)
      if (outwardTypeFilter) params.append('outward_type', outwardTypeFilter)
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
  }, [outwardStoreType, outwardDeptFilter, outwardTypeFilter, outwardSearch, outwardPage])

  const loadDeptSummary = async () => {
    try {
      const r = await fetch(`${API}/store/issues/dept-summary`, { headers: h() }).then(r => r.json())
      if (r.success) setDeptSummary(r.data)
    } catch (e) {
      console.error(e)
    }
  }

  const loadOpenGatePasses = async () => {
    try {
      const r = await fetch(`${API}/security/open-inward-passes`, { headers: h() }).then(res => res.json())
      if (r.success) setOpenGatePasses(r.data || [])
    } catch (e) {}
  }

  const loadRejections = useCallback(async () => {
    setRejectionsLoading(true)
    try {
      const p = new URLSearchParams()
      if (rejectionsStatusFilter) p.set('status', rejectionsStatusFilter)
      const r = await fetch(`${API}/store/rejections?${p}`, { headers: h() }).then(res => res.json())
      if (r.success) {
        setRejectionsList(r.data || [])
        setRejectionsSummary(r.summary || {})
      }
    } catch (e) {}
    finally { setRejectionsLoading(false) }
  }, [rejectionsStatusFilter])

  const loadTransfers = useCallback(async () => {
    try {
      const r = await fetch(`${API}/store/transfers`, { headers: h() }).then(res => res.json())
      if (r.success) setTransfersList(r.data || [])
    } catch (e) {}
  }, [])

  const loadReturns = useCallback(async () => {
    try {
      const r = await fetch(`${API}/store/returns`, { headers: h() }).then(res => res.json())
      if (r.success) setReturnsList(r.data || [])
    } catch (e) {}
  }, [])

  const loadWarehouses = async () => {
    try {
      const r = await fetch(`${API}/master/warehouses`, { headers: h() }).then(res => res.json())
      if (r.success) setWarehouses(r.data || [])
    } catch (e) {}
  }

  const handleSelectGatePassForInward = (gpId) => {
    if (!gpId) return
    const gp = openGatePasses.find(g => String(g.id) === String(gpId))
    if (gp) {
      setInwardForm(prev => ({
        ...prev,
        gate_pass_id: String(gp.id),
        vendor_id: gp.vendorId ? String(gp.vendorId) : prev.vendor_id,
        vendor_name: gp.vendorName || prev.vendor_name,
        reference_type: gp.poNumber ? 'PO' : 'Gate Pass',
        reference_id: gp.poNumber || gp.gpNumber,
        remarks: `Imported from Inward Gate Pass #${gp.gpNumber} (${gp.vehicleNumber || 'Vehicle'})`
      }))
      if (gp.poId || gp.poNumber) {
        handleSelectPOForInward(gp.poNumber || gp.poId)
      }
      addToast(`Gate Pass #${gp.gpNumber} loaded into Inward GRN`, 'info')
    }
  }

  const handleDispatchRtv = async (e) => {
    e.preventDefault()
    if (!rtvDispatchModal) return
    try {
      const r = await fetch(`${API}/store/rejections/${rtvDispatchModal.id}/dispatch-rtv`, {
        method: 'POST',
        headers: json(),
        body: JSON.stringify(rtvDispatchForm)
      }).then(res => res.json())
      if (r.success) {
        addToast(`RTV Gate Pass #${r.data.gpNumber} generated successfully`, 'success')
        setRtvDispatchModal(null)
        setRtvDispatchForm({ vehicleNumber: '', driverName: '', remarks: '' })
        loadRejections()
      } else {
        addToast(r.message || 'Failed to dispatch RTV', 'error')
      }
    } catch (err) {
      addToast('Error dispatching RTV: ' + err.message, 'error')
    }
  }

  const handleCreateTransfer = async (e) => {
    e.preventDefault()
    if (!transferForm.fromWarehouseId || !transferForm.toWarehouseId) {
      addToast('Please select Source and Destination warehouses', 'warning')
      return
    }
    try {
      const r = await fetch(`${API}/store/transfers`, {
        method: 'POST',
        headers: json(),
        body: JSON.stringify(transferForm)
      }).then(res => res.json())
      if (r.success) {
        addToast(`Transfer Order #${r.data.transfer_number} created`, 'success')
        setTransferModal(false)
        setTransferForm({
          fromWarehouseId: '', toWarehouseId: '', remarks: '',
          items: [{ materialId: '', qty: '', uom: 'NOS', batchNumber: '', remarks: '' }]
        })
        loadTransfers()
      } else {
        addToast(r.message || 'Failed to create transfer', 'error')
      }
    } catch (err) {
      addToast('Error creating transfer: ' + err.message, 'error')
    }
  }

  const handleDispatchTransfer = async (id) => {
    if (!window.confirm('Dispatch this Transfer Order to In-Transit?')) return
    const r = await fetch(`${API}/store/transfers/${id}/dispatch`, {
      method: 'PUT',
      headers: json(),
      body: JSON.stringify({})
    }).then(res => res.json())
    if (r.success) {
      addToast('Transfer dispatched to In-Transit', 'info')
      loadTransfers()
    } else {
      addToast(r.message || 'Dispatch failed', 'error')
    }
  }

  const handleReceiveTransfer = async (id) => {
    if (!window.confirm('Confirm receipt of transfer at destination warehouse?')) return
    const r = await fetch(`${API}/store/transfers/${id}/receive`, {
      method: 'PUT',
      headers: json(),
      body: JSON.stringify({})
    }).then(res => res.json())
    if (r.success) {
      addToast('Transfer completed & stock received', 'success')
      loadTransfers()
    } else {
      addToast(r.message || 'Receive failed', 'error')
    }
  }

  const handleCreateReturn = async (e) => {
    e.preventDefault()
    if (!returnForm.departmentId) {
      addToast('Please select department', 'warning')
      return
    }
    try {
      const r = await fetch(`${API}/store/returns`, {
        method: 'POST',
        headers: json(),
        body: JSON.stringify(returnForm)
      }).then(res => res.json())
      if (r.success) {
        addToast(`Store Return Voucher #${r.data.return_number} raised`, 'success')
        setReturnModal(false)
        setReturnForm({
          departmentId: '', indentId: '', remarks: '',
          items: [{ materialId: '', qty: '', uom: 'NOS', conditionGrade: 'Good', remarks: '' }]
        })
        loadReturns()
      } else {
        addToast(r.message || 'Failed to raise return voucher', 'error')
      }
    } catch (err) {
      addToast('Error raising return: ' + err.message, 'error')
    }
  }

  const handleInspectReturn = async (id) => {
    if (!window.confirm('Inspect and restock items marked Good condition back to store?')) return
    const r = await fetch(`${API}/store/returns/${id}/inspect`, {
      method: 'PUT',
      headers: json(),
      body: JSON.stringify({})
    }).then(res => res.json())
    if (r.success) {
      addToast('Return inspected & good stock restocked to store', 'success')
      loadReturns()
      loadBaseData()
    } else {
      addToast(r.message || 'Inspection failed', 'error')
    }
  }

  useEffect(() => {
    loadBaseData()
    loadOpenGatePasses()
    loadWarehouses()
  }, [])

  useEffect(() => {
    if (tab === 'inward') { loadInward(); loadOpenGatePasses() }
    if (tab === 'outward') loadOutward()
    if (tab === 'rejections') loadRejections()
    if (tab === 'transfers') { loadTransfers(); loadWarehouses() }
    if (tab === 'returns') loadReturns()
  }, [tab, loadInward, loadOutward, loadRejections, loadTransfers, loadReturns])

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

    // Extract valid line items
    const rawItems = (outwardForm.items && outwardForm.items.length > 0)
      ? outwardForm.items
      : [{
          material_id: outwardForm.material_id,
          out_qty: outwardForm.out_qty,
          unit_price: outwardForm.unit_price,
          machine_id: outwardForm.machine_id,
          position_id: outwardForm.position_id,
          section_id: outwardForm.section_id,
          serial_number: outwardForm.serial_number,
          batch_number: outwardForm.batch_number,
          remarks: outwardForm.remarks,
          grn_id: outwardForm.grn_id
        }]

    const validItems = rawItems.filter(it => it.material_id && Number(it.out_qty) > 0)

    if (validItems.length === 0) {
      addToast('Please add at least one material with quantity (> 0)', 'warning')
      return
    }

    // Check stock for all items
    for (const item of validItems) {
      const mat = mats.find(m => String(m.id) === String(item.material_id))
      const available = Number(mat?.current_stock || mat?.currentStock || 0)
      if (Number(item.out_qty) > available) {
        addToast(`Insufficient stock for "${mat?.name || 'Material'}". Available: ${available}, Requested: ${item.out_qty}`, 'error')
        return
      }
    }

    if (outwardForm.outward_type === 'job_work') {
      if (!outwardForm.vendor_id) {
        addToast('Please select Job Worker / Party Name', 'warning')
        return
      }
      if (!outwardForm.department_id) {
        addToast('Please select requesting Plant Department for Job Work', 'warning')
        return
      }
      if (!outwardForm.purpose) {
        addToast('Please enter Job Work Purpose (e.g. Turning, Rewinding, Grinding)', 'warning')
        return
      }
    } else if (outwardForm.outward_type === 'return_to_vendor') {
      if (!outwardForm.vendor_id) {
        addToast('Please select Vendor / Party Name for Return', 'warning')
        return
      }
      if (!outwardForm.purpose) {
        addToast('Please enter Return Reason / Purpose', 'warning')
        return
      }
    } else if (outwardForm.outward_type === 'inter_store_transfer' || outwardForm.outward_type === 'transfer') {
      if (!outwardForm.department_id) {
        addToast('Please select Target Receiving Department / Sub-Store', 'warning')
        return
      }
      if (!outwardForm.purpose) {
        addToast('Please enter Transfer Purpose', 'warning')
        return
      }
    }

    const payload = {
      ...outwardForm,
      items: validItems.map(it => ({
        material_id: it.material_id,
        out_qty: Number(it.out_qty),
        unit_price: it.unit_price ? Number(it.unit_price) : undefined,
        machine_id: it.machine_id || outwardForm.machine_id || undefined,
        position_id: it.position_id || outwardForm.position_id || undefined,
        section_id: it.section_id || outwardForm.section_id || undefined,
        serial_number: it.serial_number || undefined,
        batch_number: it.batch_number || undefined,
        remarks: it.remarks || undefined,
        grn_id: it.grn_id || undefined
      })),
      reference_id: outwardForm.store_issue_no || outwardForm.reference_id || undefined
    }

    const r = await fetch(`${API}/store/outward`, {
      method: 'POST',
      headers: json(),
      body: JSON.stringify(payload)
    }).then(r => r.json())
    if (r.success) {
      addToast(r.message || 'Outward issue recorded successfully', 'success')
      setOutwardModal(false)
      setSelectedGrnItem(null)
      setOutwardForm({
        outward_type: outwardForm.outward_type || 'job_work',
        vendor_id: '',
        material_id: '',
        out_qty: '',
        unit_price: '',
        department_id: '',
        machine_id: '',
        section_id: '',
        position_id: '',
        issued_to: '',
        purpose: '',
        serial_number: '',
        batch_number: '',
        reference_type: outwardForm.outward_type === 'job_work' ? 'JOB_WORK' : outwardForm.outward_type === 'return_to_vendor' ? 'RTV' : 'STO',
        reference_id: '',
        store_issue_no: '',
        date: new Date().toISOString().slice(0, 10),
        remarks: '',
        grn_id: '',
        items: [createBlankOutwardItem()]
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
    { id: 'reports', label: '📈 Store Analytics & Reports' },
    { id: 'rejections', label: '🚫 Rejections & RTV' },
    { id: 'transfers', label: '🔄 Store Transfers (STO)' },
    { id: 'returns', label: '↩️ Store Returns (SRV)' },
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
            style={{ ...S.btn, background: '#f0fdfa', border: '1px solid #0f766e', color: '#0f766e', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700 }}
            onClick={() => setExportModal(true)}
            title="Download Comprehensive Multi-Sheet Excel Master with Categories & Reorder Alerts"
          >
            📊 Excel Master Export
          </button>
          <button
            style={{ ...S.btn, background: '#0f172a', color: '#fff', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700 }}
            onClick={() => onNavigate ? onNavigate('store-dashboard') : (window.location.href = '/store-dashboard')}
            title="Open Exclusive Store Management Realtime Dashboard"
          >
            📊 Executive Dashboard
          </button>
          <button
            style={{ ...S.btn, background: '#0369a1', color: '#fff', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700 }}
            onClick={() => setTab('reports')}
            title="Open In-Depth Store Department Analytics & Consumption Reports"
          >
            📈 Store Analytics &amp; Reports
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
      <div style={{ marginBottom: 20 }}>
        <ScrollableTabs
          tabs={tabs}
          activeTab={tab}
          onSelectTab={setTab}
          style={{ borderBottom: '2px solid #1b1b1d' }}
          tabStyle={{
            padding: '8px 18px',
            border: 'none',
            background: 'transparent',
            color: '#8a8a90',
            fontWeight: 600,
            borderRadius: '4px 4px 0 0',
            marginBottom: -2,
            borderBottom: '2px solid transparent'
          }}
          activeTabStyle={{
            color: '#1b1b1d',
            background: '#ffffff',
            borderBottom: '2px solid #1b1b1d',
            fontWeight: 700
          }}
        />
      </div>

      {/* ── 1. INWARD DESK TAB ── */}
      {tab === 'inward' && (
        <div>
          {/* Multi-Agent Live Orchestration Status */}
          <AgentStatusBanner currentModule="store" />

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

          {/* View Mode & Filter Bar */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', background: '#e2e8f0', borderRadius: 8, padding: 3, gap: 3 }}>
              <button
                style={{
                  padding: '6px 14px',
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                  border: 'none',
                  background: inwardViewMode === 'master' ? '#0f766e' : 'transparent',
                  color: inwardViewMode === 'master' ? '#fff' : '#475569',
                  boxShadow: inwardViewMode === 'master' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6
                }}
                onClick={() => { setInwardViewMode('master'); setInwardPage(1) }}
              >
                📦 Master GRNs (Clubbed View)
              </button>
              <button
                style={{
                  padding: '6px 14px',
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                  border: 'none',
                  background: inwardViewMode === 'items' ? '#0f766e' : 'transparent',
                  color: inwardViewMode === 'items' ? '#fff' : '#475569',
                  boxShadow: inwardViewMode === 'items' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6
                }}
                onClick={() => { setInwardViewMode('items'); setInwardPage(1) }}
              >
                📑 Item Ledger View (Split Entries)
              </button>
            </div>

            <input
              style={{ ...S.input, maxWidth: 300, background: '#fff' }}
              placeholder="🔍 Search GRN, invoice, material, vendor..."
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
          <TableScrollWrapper title={inwardViewMode === 'master' ? 'Consolidated Master GRN Register (Clubbed)' : 'Inward Item Ledger Register'}>
            <table style={S.table}>
              {inwardViewMode === 'master' ? (
                /* ── 1. MASTER GRN CONSOLIDATED VIEW ── */
                <>
                  <thead>
                    <tr style={S.thead}>
                      <th style={{ ...S.th, width: 40, textAlign: 'center' }}></th>
                      <SortableTh label="Date" columnKey="date" currentSortKey={inwardSortBy} currentSortOrder={inwardSortOrder} onSort={(k, o) => { setInwardSortBy(k); setInwardSortOrder(o) }} width={95} />
                      <SortableTh label="GRN Number & Ref" columnKey="grn_number" currentSortKey={inwardSortBy} currentSortOrder={inwardSortOrder} onSort={(k, o) => { setInwardSortBy(k); setInwardSortOrder(o) }} width={140} />
                      <SortableTh label="Vendor / Supplier" columnKey="vendorName" currentSortKey={inwardSortBy} currentSortOrder={inwardSortOrder} onSort={(k, o) => { setInwardSortBy(k); setInwardSortOrder(o) }} width={200} />
                      <th style={{ ...S.th, width: 130 }}>Invoice / PO</th>
                      <th style={S.th}>Clubbed Materials &amp; Spares</th>
                      <SortableTh label="Total Qty" columnKey="totalQty" currentSortKey={inwardSortBy} currentSortOrder={inwardSortOrder} onSort={(k, o) => { setInwardSortBy(k); setInwardSortOrder(o) }} align="right" width={95} />
                      <SortableTh label="Taxable (₹)" columnKey="total_taxable" currentSortKey={inwardSortBy} currentSortOrder={inwardSortOrder} onSort={(k, o) => { setInwardSortBy(k); setInwardSortOrder(o) }} align="right" width={105} />
                      <SortableTh label="Total GST (₹)" columnKey="total_gst" currentSortKey={inwardSortBy} currentSortOrder={inwardSortOrder} onSort={(k, o) => { setInwardSortBy(k); setInwardSortOrder(o) }} align="right" width={100} />
                      <SortableTh label="Grand Total (₹)" columnKey="grand_total" currentSortKey={inwardSortBy} currentSortOrder={inwardSortOrder} onSort={(k, o) => { setInwardSortBy(k); setInwardSortOrder(o) }} align="right" width={120} />
                      <th style={{ ...S.th, width: 85, textAlign: 'center' }}>Status</th>
                      <th style={{ ...S.th, width: 110, textAlign: 'center' }}>Print &amp; Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inwardLoading ? (
                      <tr><td colSpan={12} style={S.loading}>Loading Master GRNs...</td></tr>
                    ) : inwardList.length === 0 ? (
                      <tr><td colSpan={12} style={S.empty}>No Master GRNs found. Click "+ Fast Inward Entry" or "⟳ Sync Inward Excel".</td></tr>
                    ) : sortTableData(inwardList, inwardSortBy, inwardSortOrder).map(grn => {
                      const isExpanded = Boolean(expandedGrns[grn.id]);
                      const count = grn.items?.length || grn.itemCount || 1;
                      return (
                        <React.Fragment key={grn.id}>
                          <tr style={{ ...S.tr, background: isExpanded ? '#f0fdf4' : 'inherit' }}>
                            <td style={{ ...S.td, textAlign: 'center' }}>
                              <button
                                onClick={() => toggleExpandGrn(grn.id)}
                                style={{
                                  background: isExpanded ? '#0f766e' : '#e2e8f0',
                                  color: isExpanded ? '#fff' : '#0f172a',
                                  border: 'none',
                                  borderRadius: 4,
                                  width: 22,
                                  height: 22,
                                  fontSize: 10,
                                  cursor: 'pointer',
                                  fontWeight: 800
                                }}
                                title={isExpanded ? 'Collapse Items' : 'Expand All Line Items'}
                              >
                                {isExpanded ? '▲' : '▼'}
                              </button>
                            </td>
                            <td style={S.td}><span style={S.code}>{new Date(grn.date).toLocaleDateString('en-IN')}</span></td>
                            <td style={S.td}>
                              <div>
                                <span
                                  onClick={() => openMasterGrn(grn)}
                                  style={{
                                    fontWeight: 800,
                                    color: '#0284c7',
                                    textDecoration: 'underline',
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 4
                                  }}
                                  title="Click to view Master GRN details"
                                >
                                  {grn.grn_number || `GRN-${grn.id}`}
                                  <ExternalLink size={12} color="#0284c7" />
                                </span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
                                  <span style={{ fontSize: 9.5, background: '#ccfbf1', color: '#0f766e', padding: '1px 6px', borderRadius: 4, fontWeight: 800 }}>
                                    {count} {count === 1 ? 'item' : 'items'}
                                  </span>
                                </div>
                              </div>
                            </td>
                            <td style={S.td}>
                              {grn.vendorName ? (
                                <div>
                                  <div style={{ fontWeight: 700, color: '#1b1b1d' }}>{grn.vendorName}</div>
                                  <div style={{ fontSize: 10, color: '#64748b', display: 'flex', gap: 4, marginTop: 1 }}>
                                    {grn.vendorCode && <span>Code: <code>{grn.vendorCode}</code></span>}
                                    {grn.vendorGstin && <span>· GSTIN: <strong>{grn.vendorGstin}</strong></span>}
                                  </div>
                                </div>
                              ) : (
                                <span style={S.muted}>Internal Receipt</span>
                              )}
                            </td>
                            <td style={S.td}>
                              <div>
                                {grn.invoice_number ? (
                                  <div style={{ fontWeight: 600, color: '#0f172a' }}>Inv: <strong>{grn.invoice_number}</strong></div>
                                ) : (
                                  <span style={S.muted}>—</span>
                                )}
                                {grn.order_number && (
                                  <div style={{ fontSize: 10, color: '#64748b' }}>PO: {grn.order_number}</div>
                                )}
                              </div>
                            </td>
                            <td style={S.td}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                <span style={{ background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0', padding: '2px 7px', borderRadius: 4, fontWeight: 700, fontSize: 11 }}>
                                  📦 {count} Line {count === 1 ? 'Item' : 'Items'}
                                </span>
                                <span style={{ fontSize: 11, color: '#475569', maxWidth: 260, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {grn.items?.map(it => it.materialName).filter(Boolean).slice(0, 2).join(', ')}{count > 2 ? '…' : ''}
                                </span>
                                <button
                                  onClick={() => toggleExpandGrn(grn.id)}
                                  style={{
                                    fontSize: 10,
                                    padding: '2px 6px',
                                    background: isExpanded ? '#0f766e' : '#e0f2fe',
                                    color: isExpanded ? '#fff' : '#0369a1',
                                    border: 'none',
                                    borderRadius: 4,
                                    cursor: 'pointer',
                                    fontWeight: 700
                                  }}
                                >
                                  {isExpanded ? '▲ Hide' : `▼ View ${count}`}
                                </button>
                              </div>
                            </td>
                            <td style={{ ...S.td, textAlign: 'right' }}>
                              <span style={{ color: '#16a34a', fontWeight: 700 }}>
                                +{Number(grn.totalQty || grn.items?.reduce((s, it) => s + parseFloat(it.received_qty || 0), 0) || 0).toFixed(3)}
                              </span>
                            </td>
                            <td style={{ ...S.td, textAlign: 'right' }}>
                              ₹{Number(grn.total_taxable || grn.items?.reduce((s, it) => s + parseFloat(it.taxable_amount || 0), 0) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </td>
                            <td style={{ ...S.td, textAlign: 'right' }}>
                              ₹{Number(grn.total_gst || grn.items?.reduce((s, it) => s + (parseFloat(it.cgst_amount || 0) + parseFloat(it.sgst_amount || 0) + parseFloat(it.igst_amount || 0)), 0) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </td>
                            <td style={{ ...S.td, textAlign: 'right' }}>
                              <b style={{ color: '#0f766e', fontSize: 13 }}>
                                ₹{Number(grn.grand_total || grn.total_value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                              </b>
                            </td>
                            <td style={{ ...S.td, textAlign: 'center' }}>
                              <span style={{ ...S.badge, background: '#ccfbf1', color: '#0f766e' }}>
                                {grn.status || 'Received'}
                              </span>
                            </td>
                            <td style={S.td}>
                              <div style={{ display: 'flex', gap: 4, alignItems: 'center', justifyContent: 'center' }}>
                                <button
                                  style={{ ...S.btnSm, background: '#0f766e', color: '#fff', fontWeight: 800, padding: '4px 8px', fontSize: 11 }}
                                  onClick={() => openA3Invoice(grn)}
                                  title={`Print Official A3 GST Commercial Invoice with all ${count} items on one slip`}
                                >
                                  🖨️ A3
                                </button>
                                <button
                                  style={{ ...S.btnSm, background: '#0284c7', color: '#fff', padding: '4px 8px', fontSize: 11 }}
                                  onClick={() => openMasterGrn(grn)}
                                  title="View Master GRN details"
                                >
                                  📄
                                </button>
                                <button
                                  style={{ ...S.btnSm, background: '#2563eb', color: '#fff', padding: '4px 7px', fontSize: 11 }}
                                  onClick={() => setAppendGrnModal(grn)}
                                  title="Append Line Item to this GRN"
                                >
                                  +
                                </button>
                                {isStoreManager && (
                                  <button
                                    style={{ ...S.btnSm, background: '#ef4444', color: '#fff', padding: '4px 7px', fontSize: 11 }}
                                    onClick={() => handleDeleteGrn(grn)}
                                    title="Store Manager: Void & Delete entire Master GRN"
                                  >
                                    🗑️
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>

                          {/* ── EXPANDED ACCORDION: INLINE ITEM BREAKDOWN ── */}
                          {isExpanded && (
                            <tr>
                              <td colSpan={12} style={{ background: '#f8fafc', padding: '10px 14px', borderBottom: '2px solid #cbd5e1' }}>
                                <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                                  <div style={{ padding: '8px 12px', background: '#f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0' }}>
                                    <span style={{ fontWeight: 700, fontSize: 12, color: '#0f172a' }}>
                                      📦 Consolidated Items under GRN: <strong>{grn.grn_number}</strong> ({grn.items?.length || count} Line Items)
                                    </span>
                                    <div style={{ display: 'flex', gap: 6 }}>
                                      <button
                                        style={{ ...S.btnSm, background: '#0f766e', color: '#fff', fontSize: 11, fontWeight: 700 }}
                                        onClick={() => openA3Invoice(grn)}
                                      >
                                        🖨️ Print Single A3 Slip ({grn.items?.length || count} Items)
                                      </button>
                                    </div>
                                  </div>
                                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5 }}>
                                    <thead>
                                      <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', textAlign: 'left' }}>
                                        <th style={{ padding: '6px 10px', width: 30 }}>#</th>
                                        <th style={{ padding: '6px 10px', width: 110 }}>Item Code</th>
                                        <th style={{ padding: '6px 10px' }}>Material Description</th>
                                        <th style={{ padding: '6px 10px', width: 90 }}>Category</th>
                                        <th style={{ padding: '6px 10px', width: 75 }}>HSN Code</th>
                                        <th style={{ padding: '6px 10px', textAlign: 'right', width: 90 }}>Received Qty</th>
                                        <th style={{ padding: '6px 10px', textAlign: 'right', width: 85 }}>Unit Price</th>
                                        <th style={{ padding: '6px 10px', textAlign: 'right', width: 95 }}>Taxable (₹)</th>
                                        <th style={{ padding: '6px 10px', textAlign: 'center', width: 60 }}>GST %</th>
                                        <th style={{ padding: '6px 10px', textAlign: 'right', width: 85 }}>GST (₹)</th>
                                        <th style={{ padding: '6px 10px', textAlign: 'right', width: 100 }}>Total (₹)</th>
                                        <th style={{ padding: '6px 10px', width: 90 }}>Batch / Rack</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {grn.items && grn.items.map((it, idx) => (
                                        <tr key={it.id || idx} style={{ borderBottom: '1px solid #f1f5f9', background: idx % 2 === 0 ? '#fff' : '#fafafa' }}>
                                          <td style={{ padding: '6px 10px', color: '#64748b' }}>{idx + 1}</td>
                                          <td style={{ padding: '6px 10px', fontWeight: 700, color: '#0f766e' }}>{it.materialCode || it.code}</td>
                                          <td style={{ padding: '6px 10px', fontWeight: 600 }}>{it.materialName || it.name}</td>
                                          <td style={{ padding: '6px 10px', color: '#64748b' }}>{it.categoryName || '—'}</td>
                                          <td style={{ padding: '6px 10px', color: '#64748b' }}>{it.hsnCode || '—'}</td>
                                          <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 700, color: '#16a34a' }}>
                                            {Number(it.received_qty || 0).toFixed(3)} {it.uom || 'NOS'}
                                          </td>
                                          <td style={{ padding: '6px 10px', textAlign: 'right' }}>₹{Number(it.unit_price || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                          <td style={{ padding: '6px 10px', textAlign: 'right' }}>₹{Number(it.taxable_amount || ((it.received_qty || 0) * (it.unit_price || 0))).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                          <td style={{ padding: '6px 10px', textAlign: 'center' }}>{it.gst_pct || 18}%</td>
                                          <td style={{ padding: '6px 10px', textAlign: 'right' }}>₹{Number((it.cgst_amount || 0) + (it.sgst_amount || 0) + (it.igst_amount || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                          <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>
                                            ₹{Number(it.total_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                          </td>
                                          <td style={{ padding: '6px 10px', color: '#64748b', fontSize: 10.5 }}>
                                            {it.batch_number ? `B: ${it.batch_number}` : ''} {it.bin_location ? `· ${it.bin_location}` : ''}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                    <tfoot>
                                      <tr style={{ background: '#f1f5f9', fontWeight: 800, borderTop: '2px solid #cbd5e1' }}>
                                        <td colSpan={5} style={{ padding: '8px 10px', textAlign: 'right' }}>Total ({grn.items?.length || count} Items):</td>
                                        <td style={{ padding: '8px 10px', textAlign: 'right', color: '#16a34a' }}>
                                          {grn.items?.reduce((s, it) => s + parseFloat(it.received_qty || 0), 0).toFixed(3)}
                                        </td>
                                        <td></td>
                                        <td style={{ padding: '8px 10px', textAlign: 'right' }}>
                                          ₹{Number(grn.total_taxable || grn.items?.reduce((s, it) => s + parseFloat(it.taxable_amount || 0), 0) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                        </td>
                                        <td></td>
                                        <td style={{ padding: '8px 10px', textAlign: 'right' }}>
                                          ₹{Number(grn.total_gst || grn.items?.reduce((s, it) => s + (parseFloat(it.cgst_amount || 0) + parseFloat(it.sgst_amount || 0) + parseFloat(it.igst_amount || 0)), 0) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                        </td>
                                        <td style={{ padding: '8px 10px', textAlign: 'right', color: '#0f766e', fontSize: 12.5 }}>
                                          ₹{Number(grn.grand_total || grn.total_value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                        </td>
                                        <td></td>
                                      </tr>
                                    </tfoot>
                                  </table>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      )
                    })}
                  </tbody>
                </>
              ) : (
                /* ── 2. ITEM LEDGER DETAILED VIEW ── */
                <>
                  <thead>
                    <tr style={S.thead}>
                      <SortableTh label="Date" columnKey="date" currentSortKey={inwardSortBy} currentSortOrder={inwardSortOrder} onSort={(k, o) => { setInwardSortBy(k); setInwardSortOrder(o) }} width={95} />
                      <SortableTh label="Type" columnKey="transaction_type" currentSortKey={inwardSortBy} currentSortOrder={inwardSortOrder} onSort={(k, o) => { setInwardSortBy(k); setInwardSortOrder(o) }} width={90} />
                      <SortableTh label="Ref / PO / Invoice" columnKey="reference_id" currentSortKey={inwardSortBy} currentSortOrder={inwardSortOrder} onSort={(k, o) => { setInwardSortBy(k); setInwardSortOrder(o) }} />
                      <SortableTh label="Vendor / Supplier" columnKey="vendorName" currentSortKey={inwardSortBy} currentSortOrder={inwardSortOrder} onSort={(k, o) => { setInwardSortBy(k); setInwardSortOrder(o) }} />
                      <SortableTh label="Material" columnKey="materialName" currentSortKey={inwardSortBy} currentSortOrder={inwardSortOrder} onSort={(k, o) => { setInwardSortBy(k); setInwardSortOrder(o) }} />
                      <SortableTh label="Category" columnKey="categoryName" currentSortKey={inwardSortBy} currentSortOrder={inwardSortOrder} onSort={(k, o) => { setInwardSortBy(k); setInwardSortOrder(o) }} />
                      <SortableTh label="Inward Qty" columnKey="in_qty" currentSortKey={inwardSortBy} currentSortOrder={inwardSortOrder} onSort={(k, o) => { setInwardSortBy(k); setInwardSortOrder(o) }} align="right" />
                      <SortableTh label="Unit Price" columnKey="unit_price" currentSortKey={inwardSortBy} currentSortOrder={inwardSortOrder} onSort={(k, o) => { setInwardSortBy(k); setInwardSortOrder(o) }} align="right" />
                      <SortableTh label="Total Value" columnKey="value" currentSortKey={inwardSortBy} currentSortOrder={inwardSortOrder} onSort={(k, o) => { setInwardSortBy(k); setInwardSortOrder(o) }} align="right" />
                      <SortableTh label="Batch / Serial" columnKey="batch_number" currentSortKey={inwardSortBy} currentSortOrder={inwardSortOrder} onSort={(k, o) => { setInwardSortBy(k); setInwardSortOrder(o) }} />
                      <SortableTh label="Bin / Rack" columnKey="bin_location" currentSortKey={inwardSortBy} currentSortOrder={inwardSortOrder} onSort={(k, o) => { setInwardSortBy(k); setInwardSortOrder(o) }} />
                      <SortableTh label="Remarks" columnKey="remarks" currentSortKey={inwardSortBy} currentSortOrder={inwardSortOrder} onSort={(k, o) => { setInwardSortBy(k); setInwardSortOrder(o) }} />
                      <SortableTh label="Received By" columnKey="createdByName" currentSortKey={inwardSortBy} currentSortOrder={inwardSortOrder} onSort={(k, o) => { setInwardSortBy(k); setInwardSortOrder(o) }} />
                      <th style={{ ...S.th, width: 85, textAlign: 'center' }}>Voucher</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inwardLoading ? (
                      <tr><td colSpan={14} style={S.loading}>Loading inward entries...</td></tr>
                    ) : inwardList.length === 0 ? (
                      <tr><td colSpan={14} style={S.empty}>No inward records found. Click "+ Fast Inward Entry" to record receipts.</td></tr>
                    ) : sortTableData(inwardList, inwardSortBy, inwardSortOrder).map(inw => (
                      <tr key={inw.id} style={S.tr}>
                        <td style={S.td}><span style={S.code}>{new Date(inw.date).toLocaleDateString('en-IN')}</span></td>
                        <td style={S.td}>
                          <span style={{ ...S.badge, background: inw.transaction_type === 'return' ? '#fef3c7' : '#ccfbf1', color: inw.transaction_type === 'return' ? '#92400e' : '#0f766e' }}>
                            {inw.transaction_type === 'return' ? 'Dept Return' : 'GRN'}
                          </span>
                        </td>
                        <td style={S.td}>
                          <div>
                            <span
                              onClick={() => openMasterGrn(inw.grnId || inw.grnNumber || inw.reference_id || inw.id)}
                              style={{
                                fontWeight: 700,
                                color: '#0284c7',
                                textDecoration: 'underline',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4
                              }}
                              title="Click to view complete Master GRN with all clubbed items"
                            >
                              {inw.grnNumber || inw.reference_id || `GRN-${inw.id}`}
                              <ExternalLink size={11} color="#0284c7" />
                            </span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
                              {inw.grnItemCount > 1 && (
                                <span style={{ fontSize: 9.5, background: '#e0f2fe', color: '#0369a1', padding: '1px 5px', borderRadius: 4, fontWeight: 800 }}>
                                  {inw.grnItemCount} items
                                </span>
                              )}
                              {inw.grnInvoiceNumber && (
                                <span style={{ fontSize: 10, color: '#64748b' }}>
                                  Inv: <strong>{inw.grnInvoiceNumber}</strong>
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td style={S.td}>
                          {inw.vendorName ? (
                            <div>
                              <div style={{ fontWeight: 600, color: '#1b1b1d' }}>{inw.vendorName}</div>
                              <div style={{ fontSize: 10, color: '#64748b', display: 'flex', gap: 4, marginTop: 1 }}>
                                {inw.vendorCode && <span>Code: <code>{inw.vendorCode}</code></span>}
                                {inw.vendorGstin && <span>· GSTIN: <strong>{inw.vendorGstin}</strong></span>}
                              </div>
                            </div>
                          ) : (
                            <span style={S.muted}>—</span>
                          )}
                        </td>
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
                        <td style={{ ...S.td, maxWidth: 200, fontSize: 12 }}>{inw.remarks || '—'}</td>
                        <td style={S.td}><span style={S.muted}>{inw.createdByName || 'Store Keeper'}</span></td>
                        <td style={S.td}>
                          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                            <button
                              style={{ ...S.btnSm, background: '#0f766e', color: '#fff', fontWeight: 800, padding: '3px 7px', fontSize: 11 }}
                              onClick={() => openA3Invoice(inw)}
                              title="Print Official A3 GST Commercial Invoice"
                            >
                              🖨️ A3
                            </button>
                            <button style={S.btnSm} onClick={() => setInwardVoucher(inw)} title="View Voucher Slip">📄</button>
                            <button style={{ ...S.btnSm, background: '#2563eb' }} onClick={() => {
                              setEditInwardForm({
                                in_qty: inw.in_qty,
                                unit_price: inw.unit_price || 0,
                                reference_type: inw.reference_type || 'PO',
                                reference_id: inw.reference_id || '',
                                bin_location: inw.bin_location || '',
                                batch_number: inw.batch_number || '',
                                remarks: inw.remarks || '',
                                date: inw.date ? inw.date.slice(0, 10) : '',
                                grn_vehicle_number: inw.grnVehicleNumber || '',
                                grn_challan_number: inw.grnChallanNumber || '',
                                grn_invoice_number: inw.grnInvoiceNumber || ''
                              })
                              setEditInwardModal(inw)
                            }} title="Edit Inward Record">✏️</button>
                            {isStoreManager && (
                              <button style={{ ...S.btnSm, background: '#ef4444' }} onClick={() => handleDeleteInward(inw)} title="Store Manager: Delete & Reverse Stock">🗑️</button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </>
              )}
            </table>
          </TableScrollWrapper>
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

          {/* Department / Store Scoping & Workflow Chips */}
          <div style={{ ...S.scopeBar, marginBottom: 8 }}>
            {[
              { id: '', label: '⚡ All Outward' },
              { id: 'job_work', label: '🏭 1. Job Work', color: '#7c3aed' },
              { id: 'return_to_vendor', label: '↩️ 2. Return to Party (RTV)', color: '#dc2626' },
              { id: 'transfer', label: '🔄 3. Inter Store Transfer', color: '#0284c7' },
              { id: 'issue', label: '📤 Dept Issue', color: '#d97706' },
            ].map(tc => (
              <button
                key={tc.id}
                style={{
                  ...S.chip,
                  ...(outwardTypeFilter === tc.id ? { ...S.chipActive, background: tc.color || '#1b1b1d', borderColor: tc.color || '#1b1b1d', color: '#fff' } : {})
                }}
                onClick={() => { setOutwardTypeFilter(tc.id); setOutwardPage(1) }}
              >{tc.label}</button>
            ))}
          </div>

          <div style={{ ...S.scopeBar, marginBottom: 12 }}>
            {[
              { id: '', label: '🏢 All Mill Stores' },
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
              placeholder="🔍 Search material, code, party, purpose..."
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
          <TableScrollWrapper title="Outward (SIV / DC / Gate Pass) Register">
            <table style={S.table}>
              <thead>
                <tr style={S.thead}>
                  <SortableTh label="Date" columnKey="date" currentSortKey={outwardSortBy} currentSortOrder={outwardSortOrder} onSort={(k, o) => { setOutwardSortBy(k); setOutwardSortOrder(o) }} width={95} />
                  <SortableTh label="Type / Mode" columnKey="transaction_type" currentSortKey={outwardSortBy} currentSortOrder={outwardSortOrder} onSort={(k, o) => { setOutwardSortBy(k); setOutwardSortOrder(o) }} width={115} />
                  <SortableTh label="Issue / GP / Ref #" columnKey="reference_id" currentSortKey={outwardSortBy} currentSortOrder={outwardSortOrder} onSort={(k, o) => { setOutwardSortBy(k); setOutwardSortOrder(o) }} />
                  <SortableTh label="Material & Code" columnKey="materialName" currentSortKey={outwardSortBy} currentSortOrder={outwardSortOrder} onSort={(k, o) => { setOutwardSortBy(k); setOutwardSortOrder(o) }} />
                  <SortableTh label="Category / Party" columnKey="categoryName" currentSortKey={outwardSortBy} currentSortOrder={outwardSortOrder} onSort={(k, o) => { setOutwardSortBy(k); setOutwardSortOrder(o) }} />
                  <SortableTh label="Issued Qty" columnKey="out_qty" currentSortKey={outwardSortBy} currentSortOrder={outwardSortOrder} onSort={(k, o) => { setOutwardSortBy(k); setOutwardSortOrder(o) }} align="right" />
                  <SortableTh label="Balance After" columnKey="balance" currentSortKey={outwardSortBy} currentSortOrder={outwardSortOrder} onSort={(k, o) => { setOutwardSortBy(k); setOutwardSortOrder(o) }} align="right" />
                  <SortableTh label="Unit Price" columnKey="unit_price" currentSortKey={outwardSortBy} currentSortOrder={outwardSortOrder} onSort={(k, o) => { setOutwardSortBy(k); setOutwardSortOrder(o) }} align="right" />
                  <SortableTh label="Total Value" columnKey="value" currentSortKey={outwardSortBy} currentSortOrder={outwardSortOrder} onSort={(k, o) => { setOutwardSortBy(k); setOutwardSortOrder(o) }} align="right" />
                  <SortableTh label="Purpose / Details" columnKey="purpose" currentSortKey={outwardSortBy} currentSortOrder={outwardSortOrder} onSort={(k, o) => { setOutwardSortBy(k); setOutwardSortOrder(o) }} />
                  <SortableTh label="Issued By" columnKey="createdByName" currentSortKey={outwardSortBy} currentSortOrder={outwardSortOrder} onSort={(k, o) => { setOutwardSortBy(k); setOutwardSortOrder(o) }} />
                  <th style={{ ...S.th, width: 85, textAlign: 'center' }}>Voucher</th>
                </tr>
              </thead>
              <tbody>
                {outwardLoading ? (
                  <tr><td colSpan={12} style={S.loading}>Loading outward issues...</td></tr>
                ) : outwardList.length === 0 ? (
                  <tr><td colSpan={12} style={S.empty}>No outward issues found. Click "+ Fast Outward Issue" to issue materials.</td></tr>
                ) : sortTableData(outwardList, outwardSortBy, outwardSortOrder).map(outw => (
                  <tr key={outw.id} style={S.tr}>
                    <td style={S.td}><span style={S.code}>{new Date(outw.date).toLocaleDateString('en-IN')}</span></td>
                    <td style={S.td}>
                      <span style={{
                        ...S.badge,
                        background: outw.transaction_type === 'job_work' ? '#ede9fe' : outw.transaction_type === 'return_to_vendor' ? '#fee2e2' : outw.transaction_type === 'transfer' ? '#e0f2fe' : '#fef3c7',
                        color: outw.transaction_type === 'job_work' ? '#7c3aed' : outw.transaction_type === 'return_to_vendor' ? '#dc2626' : outw.transaction_type === 'transfer' ? '#0284c7' : '#b45309',
                        fontWeight: 700
                      }}>
                        {outw.transaction_type === 'job_work' ? '🏭 Job Work' : outw.transaction_type === 'return_to_vendor' ? '↩️ Return (RTV)' : outw.transaction_type === 'transfer' ? '🔄 STO Transfer' : '📤 Dept Issue'}
                      </span>
                    </td>
                    <td style={S.td}>
                      <span
                        style={{
                          fontWeight: 700,
                          color: '#0284c7',
                          textDecoration: 'underline',
                          cursor: 'pointer'
                        }}
                        onClick={() => {
                          if (outw.reference_type === 'indent' || outw.reference_id?.startsWith('IND-')) {
                            setReceiverModal({ id: outw.reference_id || outw.id, isIndent: true, name: outw.materialName, qty: outw.out_qty, uom: outw.uom })
                          } else {
                            setOutwardVoucher(outw)
                          }
                        }}
                        title="Click to view issue reference / receiver details"
                      >
                        {outw.reference_id || outw.reference_type || `SIV-${outw.id}`}
                      </span>
                    </td>
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
                    <td style={S.td}>
                      <div>{outw.categoryName || '—'}</div>
                      {outw.vendorName && <div style={{ fontSize: 11, color: '#7c3aed', fontWeight: 600 }}>🏢 {outw.vendorName}</div>}
                    </td>
                    <td style={S.td}><span style={{ color: '#dc2626', fontWeight: 700 }}>-{Number(outw.out_qty).toFixed(3)} {outw.uom}</span></td>
                    <td style={S.td}><span style={{ color: '#1b1b1d', fontWeight: 600 }}>{Number(outw.balance).toFixed(3)} {outw.uom}</span></td>
                    <td style={S.td}>₹{Number(outw.unit_price || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td style={S.td}><b>₹{Number(outw.value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</b></td>
                    <td style={{ ...S.td, maxWidth: 240, fontSize: 12 }}>
                      <div>{outw.remarks || '—'}</div>
                      {outw.receiver_name && (
                        <div style={{ fontSize: 10, color: '#16a34a', fontWeight: 700, marginTop: 2 }}>
                          ✓ Signed: {outw.receiver_name} ({outw.receiver_emp_code || 'Emp'})
                        </div>
                      )}
                    </td>
                    <td style={S.td}><span style={S.muted}>{outw.createdByName || 'Store Keeper'}</span></td>
                    <td style={S.td}>
                      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                        <button
                          style={{ ...S.btnSm, background: '#16a34a', color: '#fff', fontWeight: 800, padding: '3px 6px', fontSize: 10 }}
                          onClick={() => {
                            setReceiverModal({
                              id: outw.id,
                              isIndent: false,
                              name: outw.materialName,
                              qty: outw.out_qty,
                              uom: outw.uom,
                              dept: outw.departmentName || outw.remarks
                            })
                            setReceiverForm({
                              receiver_name: user?.name || '',
                              receiver_emp_code: user?.employee_code || '',
                              receiver_signature_note: 'Received in good condition in department',
                              fitment_date: new Date().toISOString().slice(0, 10),
                              observations: ''
                            })
                          }}
                          title="Department Receiver Sign & Handover"
                        >
                          ✍️ Sign
                        </button>
                        <button
                          style={{ ...S.btnSm, background: '#0f766e', color: '#fff', fontWeight: 800, padding: '3px 6px', fontSize: 10 }}
                          onClick={() => openA3Invoice({
                            ...outw,
                            items: [{
                              materialName: outw.materialName,
                              materialCode: outw.materialCode,
                              uom: outw.uom,
                              in_qty: outw.out_qty,
                              unit_price: outw.unit_price,
                              hsnCode: outw.hsnCode || '8439',
                              gst_pct: 18,
                              batch_number: outw.batch_number || 'SIV-BATCH',
                              mrp: outw.unit_price
                            }],
                            title: 'STORE ISSUE VOUCHER (SIV)'
                          })}
                          title="Print Official A3 SIV Voucher"
                        >
                          🖨️ A3
                        </button>
                        <button style={{ ...S.btnSm, background: '#d97706' }} onClick={() => setOutwardVoucher(outw)} title="View SIV Slip">📄</button>
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
                        }} title="Edit Outward Record">✏️</button>
                        <button style={{ ...S.btnSm, background: '#ef4444' }} onClick={() => handleDeleteOutward(outw)} title="Delete & Reverse Outward Issue">🗑️</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScrollWrapper>
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

          <TableScrollWrapper title="Store Indent Requests">
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
                  <SortableTh label="Issue / Indent No" columnKey="issue_number" currentSortKey={indentSortBy} currentSortOrder={indentSortOrder} onSort={(k, o) => { setIndentSortBy(k); setIndentSortOrder(o) }} width={140} />
                  <SortableTh label="Material" columnKey="materialName" currentSortKey={indentSortBy} currentSortOrder={indentSortOrder} onSort={(k, o) => { setIndentSortBy(k); setIndentSortOrder(o) }} />
                  <SortableTh label="Department" columnKey="departmentName" currentSortKey={indentSortBy} currentSortOrder={indentSortOrder} onSort={(k, o) => { setIndentSortBy(k); setIndentSortOrder(o) }} />
                  <SortableTh label="Quantity" columnKey="quantity" currentSortKey={indentSortBy} currentSortOrder={indentSortOrder} onSort={(k, o) => { setIndentSortBy(k); setIndentSortOrder(o) }} align="right" />
                  <SortableTh label="Purpose" columnKey="purpose" currentSortKey={indentSortBy} currentSortOrder={indentSortOrder} onSort={(k, o) => { setIndentSortBy(k); setIndentSortOrder(o) }} />
                  <SortableTh label="Status" columnKey="status" currentSortKey={indentSortBy} currentSortOrder={indentSortOrder} onSort={(k, o) => { setIndentSortBy(k); setIndentSortOrder(o) }} width={100} align="center" />
                  <SortableTh label="Date" columnKey="createdAt" currentSortKey={indentSortBy} currentSortOrder={indentSortOrder} onSort={(k, o) => { setIndentSortBy(k); setIndentSortOrder(o) }} width={95} />
                  <th style={{ ...S.th, width: 100, textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortTableData(
                  issues.filter(i => {
                    const q = searchTerm.toLowerCase()
                    const num = (i.issue_number || i.issueNumber || '').toLowerCase()
                    const mat = (i.materialName || i.material_name || '').toLowerCase()
                    const matchQ = !q || num.includes(q) || mat.includes(q)
                    const matchDept = !deptFilter || String(i.department_id) === deptFilter
                    return matchQ && matchDept
                  }),
                  indentSortBy,
                  indentSortOrder
                ).map(iss => (
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
          </TableScrollWrapper>
        </div>
      )}

      {/* ── 4. APPROVALS TAB ── */}
      {tab === 'approvals' && (
        <TableScrollWrapper title="Store Approvals">
          <table style={S.table}>
            <thead>
              <tr style={S.thead}>
                <SortableTh label="Indent / Issue No" columnKey="issue_number" currentSortKey={approvalSortBy} currentSortOrder={approvalSortOrder} onSort={(k, o) => { setApprovalSortBy(k); setApprovalSortOrder(o) }} width={140} />
                <SortableTh label="Material" columnKey="materialName" currentSortKey={approvalSortBy} currentSortOrder={approvalSortOrder} onSort={(k, o) => { setApprovalSortBy(k); setApprovalSortOrder(o) }} />
                <SortableTh label="Requested By" columnKey="requestedByName" currentSortKey={approvalSortBy} currentSortOrder={approvalSortOrder} onSort={(k, o) => { setApprovalSortBy(k); setApprovalSortOrder(o) }} />
                <SortableTh label="Department" columnKey="departmentName" currentSortKey={approvalSortBy} currentSortOrder={approvalSortOrder} onSort={(k, o) => { setApprovalSortBy(k); setApprovalSortOrder(o) }} />
                <SortableTh label="Quantity" columnKey="quantity" currentSortKey={approvalSortBy} currentSortOrder={approvalSortOrder} onSort={(k, o) => { setApprovalSortBy(k); setApprovalSortOrder(o) }} align="right" />
                <SortableTh label="Justification / Purpose" columnKey="purpose" currentSortKey={approvalSortBy} currentSortOrder={approvalSortOrder} onSort={(k, o) => { setApprovalSortBy(k); setApprovalSortOrder(o) }} />
                <SortableTh label="Priority" columnKey="priority" currentSortKey={approvalSortBy} currentSortOrder={approvalSortOrder} onSort={(k, o) => { setApprovalSortBy(k); setApprovalSortOrder(o) }} width={80} align="center" />
                <SortableTh label="Status" columnKey="status" currentSortKey={approvalSortBy} currentSortOrder={approvalSortOrder} onSort={(k, o) => { setApprovalSortBy(k); setApprovalSortOrder(o) }} width={95} align="center" />
                <th style={{ ...S.th, width: 120, textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortTableData(
                issues.filter(i => ['Pending', 'Submitted', 'L1 Approved', 'Approved', 'Partially Issued'].includes(i.status)),
                approvalSortBy,
                approvalSortOrder,
                { priority: 'criticality' }
              ).map(iss => (
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
        </TableScrollWrapper>
      )}

      {/* ── 5. ASSETS TAB (DIGITAL TWIN) ── */}
      {tab === 'assets' && (
        <TableScrollWrapper title="Installed Assets">
          <table style={S.table}>
            <thead>
              <tr style={S.thead}>
                <SortableTh label="Asset / Serial No" columnKey="serialNumber" currentSortKey={assetSortBy} currentSortOrder={assetSortOrder} onSort={(k, o) => { setAssetSortBy(k); setAssetSortOrder(o) }} width={140} />
                <SortableTh label="Material" columnKey="materialName" currentSortKey={assetSortBy} currentSortOrder={assetSortOrder} onSort={(k, o) => { setAssetSortBy(k); setAssetSortOrder(o) }} />
                <SortableTh label="Machine" columnKey="machineName" currentSortKey={assetSortBy} currentSortOrder={assetSortOrder} onSort={(k, o) => { setAssetSortBy(k); setAssetSortOrder(o) }} />
                <SortableTh label="Position" columnKey="positionName" currentSortKey={assetSortBy} currentSortOrder={assetSortOrder} onSort={(k, o) => { setAssetSortBy(k); setAssetSortOrder(o) }} />
                <SortableTh label="Status" columnKey="status" currentSortKey={assetSortBy} currentSortOrder={assetSortOrder} onSort={(k, o) => { setAssetSortBy(k); setAssetSortOrder(o) }} width={100} align="center" />
                <SortableTh label="Installed Date" columnKey="installedAt" currentSortKey={assetSortBy} currentSortOrder={assetSortOrder} onSort={(k, o) => { setAssetSortBy(k); setAssetSortOrder(o) }} width={110} />
                <SortableTh label="Operating Life" columnKey="daysInService" currentSortKey={assetSortBy} currentSortOrder={assetSortOrder} onSort={(k, o) => { setAssetSortBy(k); setAssetSortOrder(o) }} width={110} align="right" />
                <SortableTh label="Expected Life" columnKey="expectedLifespanDays" currentSortKey={assetSortBy} currentSortOrder={assetSortOrder} onSort={(k, o) => { setAssetSortBy(k); setAssetSortOrder(o) }} width={110} align="right" />
                <th style={{ ...S.th, width: 120, textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortTableData(assets, assetSortBy, assetSortOrder).map(a => {
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
        </TableScrollWrapper>
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

      {/* ── 7. REJECTIONS & RETURN TO VENDOR (RTV) TAB ── */}
      {tab === 'rejections' && (
        <div>
          {/* KPI Summary Cards */}
          <div style={S.kpiGrid}>
            <div style={S.kpiCard}>
              <div style={S.kpiLbl}>Total Material Rejections</div>
              <div style={{ ...S.kpiVal, color: '#dc2626' }}>{rejectionsSummary.total || 0} Lots</div>
              <div style={S.kpiSub}>QC Rejected & Quarantined</div>
            </div>
            <div style={S.kpiCard}>
              <div style={S.kpiLbl}>Pending RTV Dispatch</div>
              <div style={{ ...S.kpiVal, color: '#ea580c' }}>{rejectionsSummary.pending || 0} Lots</div>
              <div style={S.kpiSub}>Awaiting Vendor Pickup / Truck Exit</div>
            </div>
            <div style={S.kpiCard}>
              <div style={S.kpiLbl}>Pending Debit Amount</div>
              <div style={{ ...S.kpiVal, color: '#b91c1c' }}>₹{Number(rejectionsSummary.pending_debit_amount || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</div>
              <div style={S.kpiSub}>To be deducted from Vendor AP Bills</div>
            </div>
          </div>

          {/* Filter Bar */}
          <div style={S.filterBar}>
            <select
              style={{ ...S.input, maxWidth: 220, background: '#fff' }}
              value={rejectionsStatusFilter}
              onChange={e => setRejectionsStatusFilter(e.target.value)}
            >
              <option value="">All Statuses</option>
              <option value="Pending RTV">Pending RTV</option>
              <option value="Debit Note Raised">Debit Note Raised</option>
              <option value="Dispatched Out">Dispatched Out</option>
            </select>
            <button style={S.btnGhost} onClick={loadRejections}>↻ Refresh Rejections</button>
          </div>

          {/* Rejections Table */}
          <TableScrollWrapper title="Rejections & Return to Vendor">
            <table style={S.table}>
              <thead>
                <tr style={S.thead}>
                  <SortableTh label="Rejection No" columnKey="rejection_number" currentSortKey={rejectionSortBy} currentSortOrder={rejectionSortOrder} onSort={(k, o) => { setRejectionSortBy(k); setRejectionSortOrder(o) }} width={130} />
                  <SortableTh label="GRN / PO Ref" columnKey="grnNumber" currentSortKey={rejectionSortBy} currentSortOrder={rejectionSortOrder} onSort={(k, o) => { setRejectionSortBy(k); setRejectionSortOrder(o) }} />
                  <SortableTh label="Material" columnKey="materialName" currentSortKey={rejectionSortBy} currentSortOrder={rejectionSortOrder} onSort={(k, o) => { setRejectionSortBy(k); setRejectionSortOrder(o) }} />
                  <SortableTh label="Vendor" columnKey="vendorName" currentSortKey={rejectionSortBy} currentSortOrder={rejectionSortOrder} onSort={(k, o) => { setRejectionSortBy(k); setRejectionSortOrder(o) }} />
                  <SortableTh label="Rejected Qty" columnKey="rejected_qty" currentSortKey={rejectionSortBy} currentSortOrder={rejectionSortOrder} onSort={(k, o) => { setRejectionSortBy(k); setRejectionSortOrder(o) }} align="right" />
                  <SortableTh label="Debit Value" columnKey="debit_amount" currentSortKey={rejectionSortBy} currentSortOrder={rejectionSortOrder} onSort={(k, o) => { setRejectionSortBy(k); setRejectionSortOrder(o) }} align="right" />
                  <SortableTh label="Reason" columnKey="rejection_reason" currentSortKey={rejectionSortBy} currentSortOrder={rejectionSortOrder} onSort={(k, o) => { setRejectionSortBy(k); setRejectionSortOrder(o) }} />
                  <SortableTh label="Action Required" columnKey="action_required" currentSortKey={rejectionSortBy} currentSortOrder={rejectionSortOrder} onSort={(k, o) => { setRejectionSortBy(k); setRejectionSortOrder(o) }} />
                  <SortableTh label="Status" columnKey="status" currentSortKey={rejectionSortBy} currentSortOrder={rejectionSortOrder} onSort={(k, o) => { setRejectionSortBy(k); setRejectionSortOrder(o) }} width={120} align="center" />
                  <th style={{ ...S.th, width: 100, textAlign: 'center' }}>Outward GP</th>
                  <th style={{ ...S.th, width: 90, textAlign: 'center' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {rejectionsLoading ? (
                  <tr><td colSpan={11} style={S.loading}>Loading rejections...</td></tr>
                ) : rejectionsList.length === 0 ? (
                  <tr><td colSpan={11} style={S.empty}>No material rejections recorded. Quality inspection passes are in order.</td></tr>
                ) : sortTableData(rejectionsList, rejectionSortBy, rejectionSortOrder).map(rej => (
                  <tr key={rej.id} style={S.tr}>
                    <td style={S.td}><span style={{ ...S.code, color: '#dc2626', fontWeight: 700 }}>{rej.rejection_number}</span></td>
                    <td style={S.td}>
                      <div style={{ fontWeight: 600 }}>{rej.grnNumber || '—'}</div>
                      {rej.poNumber && <div style={S.muted}>PO: {rej.poNumber}</div>}
                    </td>
                    <td style={S.td}>
                      <b>{rej.materialName}</b>
                      <div style={S.muted}>{rej.materialCode}</div>
                    </td>
                    <td style={S.td}>{rej.vendorName || '—'}</td>
                    <td style={S.td}><span style={{ color: '#dc2626', fontWeight: 700 }}>{rej.rejected_qty} {rej.uom}</span></td>
                    <td style={S.td}><b>₹{Number(rej.debit_amount || 0).toLocaleString('en-IN')}</b></td>
                    <td style={{ ...S.td, maxWidth: 220, fontSize: 12 }}>{rej.rejection_reason}</td>
                    <td style={S.td}><span style={S.badge}>{rej.action_required}</span></td>
                    <td style={S.td}>
                      <span style={{
                        ...S.badge,
                        background: rej.status === 'Dispatched Out' ? '#dcfce7' : rej.status === 'Debit Note Raised' ? '#e0f2fe' : '#fee2e2',
                        color: rej.status === 'Dispatched Out' ? '#15803d' : rej.status === 'Debit Note Raised' ? '#0369a1' : '#dc2626'
                      }}>
                        {rej.status}
                      </span>
                    </td>
                    <td style={S.td}>
                      {rej.outwardGatePassNumber ? <span style={{ ...S.code, color: '#16a34a' }}>{rej.outwardGatePassNumber}</span> : '—'}
                    </td>
                    <td style={S.td}>
                      {rej.status !== 'Dispatched Out' && (
                        <button
                          style={{ ...S.btnSm, background: '#ea580c', color: '#fff' }}
                          onClick={() => {
                            setRtvDispatchForm({ vehicleNumber: '', driverName: '', remarks: `RTV ${rej.rejection_number}` })
                            setRtvDispatchModal(rej)
                          }}
                        >
                          🚚 Dispatch RTV
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScrollWrapper>
        </div>
      )}

      {/* ── 8. STORE TRANSFERS (STO) TAB ── */}
      {tab === 'transfers' && (
        <div>
          <div style={{ ...S.filterBar, justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <span style={{ fontWeight: 700, fontSize: 14, color: '#1b1b1d' }}>Inter-Store Transfer Orders (STO)</span>
              <button style={S.btnGhost} onClick={loadTransfers}>↻ Refresh</button>
            </div>
            <button style={{ ...S.btn, background: '#0284c7' }} onClick={() => setTransferModal(true)}>
              + Create Transfer Order (STO)
            </button>
          </div>

          <TableScrollWrapper title="Inter-Store Transfer Orders">
            <table style={S.table}>
              <thead>
                <tr style={S.thead}>
                  {['Transfer No', 'From Warehouse', 'To Warehouse', 'Date', 'Items', 'Requested By', 'Status', 'Actions'].map(h => (
                    <th key={h} style={S.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {transfersList.length === 0 ? (
                  <tr><td colSpan={8} style={S.empty}>No store transfers found. Click "+ Create Transfer Order" to move stock between warehouses.</td></tr>
                ) : transfersList.map(st => (
                  <tr key={st.id} style={S.tr}>
                    <td style={S.td}><span style={{ ...S.code, color: '#0284c7', fontWeight: 700 }}>{st.transfer_number}</span></td>
                    <td style={S.td}><b>{st.fromWarehouseName || 'Main Store'}</b></td>
                    <td style={S.td}><b>{st.toWarehouseName || 'Satellite Store'}</b></td>
                    <td style={S.td}><span style={S.muted}>{new Date(st.transfer_date).toLocaleDateString('en-IN')}</span></td>
                    <td style={S.td}>
                      {st.items?.map((it, i) => (
                        <div key={i} style={{ fontSize: 12 }}>
                          {it.materialName}: <b>{it.qty} {it.uom}</b>
                        </div>
                      ))}
                    </td>
                    <td style={S.td}><span style={S.muted}>{st.requestedByName || 'Staff'}</span></td>
                    <td style={S.td}>
                      <span style={{
                        ...S.badge,
                        background: st.status === 'Completed' ? '#dcfce7' : st.status === 'In Transit' ? '#fef3c7' : '#e0e7ff',
                        color: st.status === 'Completed' ? '#15803d' : st.status === 'In Transit' ? '#92400e' : '#1e40af'
                      }}>
                        {st.status}
                      </span>
                    </td>
                    <td style={S.td}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {(st.status === 'Approved' || st.status === 'Requested') && (
                          <button style={{ ...S.btnSm, background: '#ea580c', color: '#fff' }} onClick={() => handleDispatchTransfer(st.id)}>
                            🚀 Dispatch
                          </button>
                        )}
                        {st.status === 'In Transit' && (
                          <button style={{ ...S.btnSm, background: '#16a34a', color: '#fff' }} onClick={() => handleReceiveTransfer(st.id)}>
                            📥 Receive Stock
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScrollWrapper>
        </div>
      )}

      {/* ── 9. STORE RETURNS (SRV) TAB ── */}
      {tab === 'returns' && (
        <div>
          <div style={{ ...S.filterBar, justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <span style={{ fontWeight: 700, fontSize: 14, color: '#1b1b1d' }}>Store Return Vouchers (SRV)</span>
              <button style={S.btnGhost} onClick={loadReturns}>↻ Refresh</button>
            </div>
            <button style={{ ...S.btn, background: '#16a34a' }} onClick={() => setReturnModal(true)}>
              + Raise Store Return Voucher
            </button>
          </div>

          <TableScrollWrapper title="Store Return Vouchers">
            <table style={S.table}>
              <thead>
                <tr style={S.thead}>
                  {['Return No', 'Department', 'Date', 'Returned Material', 'Qty', 'Condition Grade', 'Returned By', 'Status', 'Actions'].map(h => (
                    <th key={h} style={S.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {returnsList.length === 0 ? (
                  <tr><td colSpan={9} style={S.empty}>No store return vouchers recorded.</td></tr>
                ) : returnsList.map(ret => (
                  <tr key={ret.id} style={S.tr}>
                    <td style={S.td}><span style={{ ...S.code, color: '#16a34a', fontWeight: 700 }}>{ret.return_number}</span></td>
                    <td style={S.td}><b>{ret.departmentName || 'Plant Dept'}</b></td>
                    <td style={S.td}><span style={S.muted}>{new Date(ret.return_date).toLocaleDateString('en-IN')}</span></td>
                    <td style={S.td}>
                      {ret.items?.map((it, i) => (
                        <div key={i} style={{ fontWeight: 600 }}>{it.materialName}</div>
                      ))}
                    </td>
                    <td style={S.td}>
                      {ret.items?.map((it, i) => (
                        <div key={i} style={{ color: '#16a34a', fontWeight: 700 }}>+{it.qty} {it.uom}</div>
                      ))}
                    </td>
                    <td style={S.td}>
                      {ret.items?.map((it, i) => (
                        <span key={i} style={{
                          ...S.badge,
                          background: it.condition_grade === 'Good' ? '#dcfce7' : it.condition_grade === 'Repairable' ? '#fef3c7' : '#fee2e2',
                          color: it.condition_grade === 'Good' ? '#15803d' : it.condition_grade === 'Repairable' ? '#92400e' : '#dc2626'
                        }}>
                          {it.condition_grade || 'Good'}
                        </span>
                      ))}
                    </td>
                    <td style={S.td}><span style={S.muted}>{ret.returnedByName || 'Staff'}</span></td>
                    <td style={S.td}>
                      <span style={{
                        ...S.badge,
                        background: ret.status === 'Restocked' ? '#dcfce7' : '#fef9c3',
                        color: ret.status === 'Restocked' ? '#15803d' : '#854d0e'
                      }}>
                        {ret.status}
                      </span>
                    </td>
                    <td style={S.td}>
                      {ret.status === 'Submitted' && (
                        <button style={{ ...S.btnSm, background: '#16a34a', color: '#fff' }} onClick={() => handleInspectReturn(ret.id)}>
                          ✅ Inspect & Restock
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScrollWrapper>
        </div>
      )}

      {/* ── 10. STORE REPORTS & ANALYTICS TAB ── */}
      {tab === 'reports' && (
        <div style={{ marginTop: 10 }}>
          <StoreDeptReports onNavigate={onNavigate} />
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
                  Direct stock addition with atomic ledger recording & Gate Pass / PO synchronization
                </div>
              </div>

              {/* Multi-Agent Status Pill */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 20, padding: '4px 12px', fontSize: 11, fontWeight: 600, color: '#166534', display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }}></span>
                  ⚡ Gate Pass & PO Agent: Active
                </div>
                <button style={S.x} onClick={() => setInwardModal(false)}>✕</button>
              </div>
            </div>

            {/* 1-Click Load from Inward Security Gate Pass */}
            {openGatePasses.length > 0 && (
              <div style={{ background: '#eff6ff', padding: 12, borderRadius: 8, border: '1px solid #bfdbfe', marginBottom: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#1e40af', textTransform: 'uppercase', marginBottom: 4 }}>
                  🚛 1-Click Import from Security Inward Gate Pass
                </div>
                <SearchableSelect
                  value={inwardForm.gate_pass_id || ''}
                  onChange={(val) => handleSelectGatePassForInward(val)}
                  placeholder="-- Select Gate Pass to Auto-Fill Truck, Weighbridge & PO --"
                  searchPlaceholder="Type gate pass number, vehicle or vendor..."
                  options={openGatePasses.map(gp => ({
                    value: gp.id,
                    label: gp.gpNumber,
                    subtext: `${gp.vehicleNumber} (${gp.vendorName || gp.materialDescription || 'Material'}) · In: ${gp.weightIn ? `${gp.weightIn}T` : 'No Wt'} ${gp.poNumber ? `· PO #${gp.poNumber}` : ''}`
                  }))}
                  selectStyle={{ background: '#fff', borderColor: '#3b82f6', fontWeight: 600 }}
                />
              </div>
            )}

            {/* Inward Type & Document Reference */}
            <div style={{ background: '#f8fafc', padding: 14, borderRadius: 8, border: '1px solid #e2e8f0', marginBottom: 16 }}>
              <div style={S.grid2}>
                <div>
                  <label style={S.label}>Inward Type *</label>
                  <SearchableSelect
                    value={inwardForm.inward_type || 'grn'}
                    onChange={v => setInwardForm({ ...inwardForm, inward_type: v })}
                    placeholder="Select inward type..."
                    searchPlaceholder="Type or press G/D..."
                    options={[
                      { value: 'grn', label: 'GRN (Purchase Inward)', subtext: 'Standard purchase goods receipt' },
                      { value: 'return', label: 'Department Return (Unused Material)', subtext: 'Material returned from plant' },
                      { value: 'direct', label: 'Direct / Emergency Receipt', subtext: 'Immediate receipt without PO' }
                    ]}
                  />
                </div>
                <div>
                  <label style={S.label}>Ref Document *</label>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <SearchableSelect
                      value={inwardForm.reference_type || 'PO'}
                      onChange={v => setInwardForm({ ...inwardForm, reference_type: v })}
                      placeholder="Doc type"
                      options={[
                        { value: 'PO', label: 'PO #' },
                        { value: 'INV', label: 'Invoice' },
                        { value: 'DC', label: 'DC #' },
                        { value: 'GP', label: 'Gate Pass' }
                      ]}
                      style={{ width: 110, flexShrink: 0 }}
                    />
                    {inwardForm.reference_type === 'PO' ? (
                      <SearchableSelect
                        value={inwardForm.reference_id || ''}
                        onChange={poNum => {
                          setInwardForm(prev => ({ ...prev, reference_id: poNum }))
                          handleSelectPOForInward(poNum)
                        }}
                        placeholder="-- Select Approved / Active PO --"
                        searchPlaceholder="Type PO number or vendor name..."
                        options={purchaseOrders.map(po => ({
                          value: po.po_number || po.poNumber,
                          label: po.po_number || po.poNumber,
                          subtext: `${po.vendorName} · ${po.status}`,
                          badge: po.status
                        }))}
                        selectStyle={{ flex: 1, borderColor: '#0f766e', fontWeight: 600 }}
                      />
                    ) : (
                      <input style={S.input} placeholder="Ref Number (e.g. INV-8902)" value={inwardForm.reference_id} onChange={e => setInwardForm({ ...inwardForm, reference_id: e.target.value })} required />
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* ═══════ DC# INVOICE MATCH: tick DCs received, qty view-only, rate/disc/tax editable ═══════ */}
            {inwardForm.reference_type === 'DC' && (
              <div style={{ background: '#fffbeb', border: '1px solid #fde68a', padding: 16, borderRadius: 10, marginBottom: 16 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#92400e', marginBottom: 4 }}>
                  🧾 Match Vendor Invoice Against Received DC(s)
                </div>
                <div style={{ fontSize: 12, color: '#78350f', marginBottom: 12 }}>
                  Tick every DC covered by this invoice. Qty is view-only (as received) — enter Rate, Disc% and GST/Tax Amount from the invoice to match its value.
                </div>

                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
                  <div style={{ flex: '1 1 200px' }}>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#92400e', marginBottom: 4 }}>Party Name *</label>
                    <input style={{ ...S.input, borderColor: '#fde68a' }} placeholder="Party / vendor name as on invoice" value={dcPartyName} onChange={e => setDcPartyName(e.target.value)} />
                  </div>
                  <div style={{ flex: '1 1 200px' }}>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#92400e', marginBottom: 4 }}>Vendor Invoice Number *</label>
                    <input style={{ ...S.input, borderColor: '#fde68a' }} placeholder="e.g. INV-8902" value={dcInvoiceNumber} onChange={e => setDcInvoiceNumber(e.target.value)} />
                  </div>
                  <div style={{ flex: '1 1 200px' }}>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#92400e', marginBottom: 4 }}>Invoice Total (₹) — to match</label>
                    <input type="number" step="0.01" style={{ ...S.input, borderColor: '#fde68a' }} placeholder="0.00" value={dcInvoiceTotal} onChange={e => setDcInvoiceTotal(e.target.value)} />
                  </div>
                </div>

                {inboundDcs.length === 0 ? (
                  <div style={{ fontSize: 12, color: '#92400e', fontStyle: 'italic' }}>No DCs are pending invoice match. Receive stock against a DC first.</div>
                ) : (
                  <div style={{ overflowX: 'auto', background: '#ffffff', borderRadius: 8, border: '1px solid #fde68a' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                      <thead>
                        <tr style={{ background: '#fffbeb', borderBottom: '1px solid #fde68a', textAlign: 'left', color: '#92400e', fontWeight: 700 }}>
                          <th style={{ padding: '8px 10px', width: 30 }}>✓</th>
                          <th style={{ padding: '8px 10px' }}>DC # / Date / Vehicle</th>
                          <th style={{ padding: '8px 10px' }}>Material</th>
                          <th style={{ padding: '8px 10px', textAlign: 'right' }}>Qty (view-only)</th>
                          <th style={{ padding: '8px 10px', textAlign: 'right' }}>Rate</th>
                          <th style={{ padding: '8px 10px', textAlign: 'right' }}>Disc %</th>
                          <th style={{ padding: '8px 10px', textAlign: 'right' }}>Tax Amount</th>
                          <th style={{ padding: '8px 10px', textAlign: 'right' }}>Line Value</th>
                        </tr>
                      </thead>
                      <tbody>
                        {inboundDcs.map(dcRow => {
                          const dc = dcDetails[dcRow.id]
                          const ticked = !!dcTicked[dcRow.id]
                          if (!dc) return null
                          return (dc.items || []).map((it, idx) => {
                            const e = dcLineEdits[it.id] || { unit_price: '0', discount_pct: '0', gst_amount: '0' }
                            const lineVal = dcLineTotal(dcRow.id, it.id, it.qty)
                            return (
                              <tr key={it.id} style={{ borderBottom: '1px solid #fffbeb', background: ticked ? '#fef3c7' : '#fff' }}>
                                {idx === 0 && (
                                  <td rowSpan={dc.items.length} style={{ padding: '8px 10px', verticalAlign: 'top' }}>
                                    <input
                                      type="checkbox"
                                      checked={ticked}
                                      onChange={e2 => setDcTicked(prev => ({ ...prev, [dcRow.id]: e2.target.checked }))}
                                    style={{ width: 16, height: 16, cursor: 'pointer' }}
                                  />
                                  </td>
                                )}
                                {idx === 0 && (
                                  <td rowSpan={dc.items.length} style={{ padding: '8px 10px', verticalAlign: 'top' }}>
                                    <div style={{ fontWeight: 700, color: '#92400e' }}>{dc.dc_no}</div>
                                    <div style={{ fontSize: 11, color: '#78350f' }}>{dc.dc_date ? String(dc.dc_date).slice(0, 10) : ''} {dc.vehicle_number ? `· ${dc.vehicle_number}` : ''}</div>
                                    <div style={{ fontSize: 11, color: '#78350f' }}>{dc.vendor_name || ''}</div>
                                  </td>
                                )}
                                <td style={{ padding: '8px 10px' }}>{it.material_name || it.material_id} {it.material_code ? `[${it.material_code}]` : ''}</td>
                                <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 600, color: '#64748b' }}>{parseFloat(it.qty || 0).toFixed(3)} {it.unit || ''}</td>
                                <td style={{ padding: '4px 6px', textAlign: 'right' }}>
                                  <input
                                    type="number" step="0.01"
                                    style={{ ...S.input, width: 90, padding: '4px 6px', textAlign: 'right', borderColor: '#fde68a' }}
                                    value={e.unit_price}
                                    onChange={ev => setDcLineEdits(prev => ({ ...prev, [it.id]: { ...(prev[it.id] || {}), unit_price: ev.target.value } }))}
                                  />
                                </td>
                                <td style={{ padding: '4px 6px', textAlign: 'right' }}>
                                  <input
                                    type="number" step="0.01"
                                    style={{ ...S.input, width: 70, padding: '4px 6px', textAlign: 'right', borderColor: '#fde68a' }}
                                    value={e.discount_pct}
                                    onChange={ev => setDcLineEdits(prev => ({ ...prev, [it.id]: { ...(prev[it.id] || {}), discount_pct: ev.target.value } }))}
                                  />
                                </td>
                                <td style={{ padding: '4px 6px', textAlign: 'right' }}>
                                  <input
                                    type="number" step="0.01"
                                    style={{ ...S.input, width: 90, padding: '4px 6px', textAlign: 'right', borderColor: '#fde68a' }}
                                    value={e.gst_amount}
                                    onChange={ev => setDcLineEdits(prev => ({ ...prev, [it.id]: { ...(prev[it.id] || {}), gst_amount: ev.target.value } }))}
                                  />
                                </td>
                                <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, color: '#0f766e' }}>₹{lineVal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                              </tr>
                            )
                          })
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Live running total + match indicator against entered Invoice Total */}
                <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fef3c7', padding: '10px 14px', borderRadius: 8, border: '1px solid #fde68a', flexWrap: 'wrap', gap: 8 }}>
                  <div style={{ fontSize: 13, color: '#78350f' }}>
                    <strong>Computed Total (ticked lines):</strong> ₹{dcSelectedTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    {dcInvoiceTotal !== '' && (
                      <span style={{
                        marginLeft: 10, padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 700,
                        background: Math.abs(dcSelectedTotal - parseFloat(dcInvoiceTotal || 0)) < 1 ? '#dcfce7' : '#fee2e2',
                        color: Math.abs(dcSelectedTotal - parseFloat(dcInvoiceTotal || 0)) < 1 ? '#15803d' : '#b91c1c'
                      }}>
                        {Math.abs(dcSelectedTotal - parseFloat(dcInvoiceTotal || 0)) < 1 ? '✓ Matches Invoice' : '✑ Mismatch vs Invoice'}
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={handleMatchAndCreateGrn}
                    disabled={dcMatching}
                    style={{ ...S.btn, background: '#b45309', padding: '8px 18px', fontWeight: 700 }}
                  >
                    {dcMatching ? 'Processing₦' : '🧾 Match Invoice & Create GRN'}
                  </button>
                </div>
              </div>
            )}

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

                {/* Batch GRN-level Reference Fields: Vendor Invoice Number & Remarks */}
                {inwardBatchMode && (
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
                    <div style={{ flex: '1 1 220px' }}>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#0f766e', marginBottom: 4 }}>Vendor Invoice Number</label>
                      <input
                        style={{ ...S.input, borderColor: '#99f6e4' }}
                        placeholder="e.g. INV-8902 (vendor's bill number)"
                        value={batchVendorInvoiceNumber}
                        onChange={e => setBatchVendorInvoiceNumber(e.target.value)}
                      />
                    </div>
                    <div style={{ flex: '2 1 320px' }}>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#0f766e', marginBottom: 4 }}>Remarks (for this GRN)</label>
                      <textarea
                        style={{ ...S.input, borderColor: '#99f6e4', minHeight: 36, resize: 'vertical' }}
                        placeholder="e.g. Partial delivery, 2 boxes damaged in transit…"
                        value={batchRemarks}
                        onChange={e => setBatchRemarks(e.target.value)}
                        rows={1}
                      />
                    </div>
                  </div>
                )}

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
                        <th style={{ padding: '8px 10px', textAlign: 'right' }}>Disc %</th>
                        <th style={{ padding: '8px 10px', textAlign: 'right' }}>Other Chg</th>
                        <th style={{ padding: '8px 10px', textAlign: 'center' }}>GST%</th>
                        {inwardBatchMode ? (
                          <th style={{ padding: '8px 10px', width: 130 }}>Inward Qty</th>
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
                            <td style={{ padding: '8px 10px', textAlign: 'right', color: it.discount_pct > 0 ? '#b45309' : '#64748b', fontWeight: it.discount_pct > 0 ? 700 : 400 }}>
                              {it.discount_pct > 0 ? `${it.discount_pct}%` : '0%'}
                            </td>
                            <td style={{ padding: '8px 10px', textAlign: 'right', color: it.other_charges > 0 ? '#0369a1' : '#64748b', fontWeight: it.other_charges > 0 ? 700 : 400 }}>
                              {it.other_charges > 0 ? `₹${parseFloat(it.other_charges).toFixed(2)}` : '—'}
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
                  <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#e6fffa', padding: '10px 14px', borderRadius: 8, border: '1px solid #99f6e4', flexWrap: 'wrap', gap: 8 }}>
                    <div style={{ fontSize: 12, color: '#134e4a', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 14 }}>🛡️</span>
                      <span><strong>Unified GRN Guarantee:</strong> All items entered below will be grouped and recorded under the exact <strong>same GRN Number</strong> with line-item discounts &amp; charges.</span>
                    </div>
                    <button
                      type="button"
                      onClick={handleCreateBatchInward}
                      disabled={batchSaving}
                      style={{ ...S.btn, background: '#0f766e', padding: '8px 18px', fontWeight: 700 }}
                    >
                      {batchSaving ? 'Recording Batch…' : '📦 Record Batch Inward (Single GRN)'}
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

                {/* GST Supply Mode / Tax Type Selector */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', padding: '8px 12px', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#475569' }}>GST Supply Type / Tax Mode:</span>
                  <div style={{ display: 'flex', gap: 4, background: '#e2e8f0', padding: 2, borderRadius: 6 }}>
                    <button
                      type="button"
                      onClick={() => setInwardForm(f => ({ ...f, tax_type: 'intra' }))}
                      style={{
                        padding: '4px 10px', borderRadius: 4, fontSize: 11, fontWeight: 700, border: 'none', cursor: 'pointer',
                        background: inwardForm.tax_type !== 'inter' && inwardForm.tax_type !== 'state' && inwardForm.tax_type !== 'igst' ? '#059669' : 'transparent',
                        color: inwardForm.tax_type !== 'inter' && inwardForm.tax_type !== 'state' && inwardForm.tax_type !== 'igst' ? '#ffffff' : '#475569'
                      }}
                    >
                      📍 In-State (CGST+SGST)
                    </button>
                    <button
                      type="button"
                      onClick={() => setInwardForm(f => ({ ...f, tax_type: 'inter' }))}
                      style={{
                        padding: '4px 10px', borderRadius: 4, fontSize: 11, fontWeight: 700, border: 'none', cursor: 'pointer',
                        background: inwardForm.tax_type === 'inter' || inwardForm.tax_type === 'state' || inwardForm.tax_type === 'igst' ? '#6366f1' : 'transparent',
                        color: inwardForm.tax_type === 'inter' || inwardForm.tax_type === 'state' || inwardForm.tax_type === 'igst' ? '#ffffff' : '#475569'
                      }}
                    >
                      🌐 State / Inter (IGST)
                    </button>
                  </div>
                </div>

                {/* Material Catalog Selector */}
                <div>
                  <label style={S.label}>Select Material *</label>
                  <SearchableSelect
                    value={String(inwardForm.material_id || '')}
                    onChange={val => {
                      const m = mats.find(x => String(x.id) === String(val))
                      setInwardForm({
                        ...inwardForm,
                        material_id: val,
                        unit_price: m?.unit_price || '',
                        bin_location: m?.binLocation || m?.bin_location || ''
                      })
                    }}
                    placeholder="-- Choose Material (1,075 catalog items) --"
                    searchPlaceholder="Search material name, code, section, machine..."
                    options={mats.map(m => {
                      const sec = m.sections && m.sections.length > 0 ? m.sections.map(s => s.sectionCode || s.name).join(', ') : (m.sectionName || '')
                      const eq = m.equipment && m.equipment.length > 0 ? m.equipment.map(e => e.equipmentName).join(', ') : (m.machineName || '')
                      return {
                        value: String(m.id),
                        label: `${m.name} [${m.code}]`,
                        subtext: `Stock: ${m.current_stock || m.currentStock || 0} ${m.uom} · Rate: ₹${m.unit_price || 0}${sec ? ` · 🏭 ${sec}` : ''}${eq ? ` · ⚙️ ${eq}` : ''}`
                      }
                    })}
                  />
                </div>

                {/* Inward Quantity, Unit Price, Discount %, Other Charges, GST Slab */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10 }}>
                  <div>
                    <label style={S.label}>Inward Qty *</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <input type="number" step="0.001" style={S.input} placeholder="0.000" value={inwardForm.in_qty} onChange={e => setInwardForm({ ...inwardForm, in_qty: e.target.value })} required />
                      <span style={{ fontSize: 11, fontWeight: 600, color: '#8a8a90' }}>{selectedInwardMat?.uom || 'NOS'}</span>
                    </div>
                  </div>
                  <div>
                    <label style={S.label}>Unit Rate (₹)</label>
                    <input type="number" step="0.01" style={S.input} placeholder="₹ 0.00" value={inwardForm.unit_price} onChange={e => setInwardForm({ ...inwardForm, unit_price: e.target.value })} />
                  </div>
                  <div>
                    <label style={S.label}>Discount (%)</label>
                    <input type="number" step="0.01" min="0" max="100" style={{ ...S.input, color: inwardForm.discount_pct > 0 ? '#b45309' : undefined, fontWeight: inwardForm.discount_pct > 0 ? 700 : undefined }} placeholder="0%" value={inwardForm.discount_pct !== undefined ? inwardForm.discount_pct : ''} onChange={e => setInwardForm({ ...inwardForm, discount_pct: e.target.value })} />
                  </div>
                  <div>
                    <label style={S.label}>Other Chg (₹)</label>
                    <input type="number" step="0.01" min="0" style={{ ...S.input, color: inwardForm.other_charges > 0 ? '#0369a1' : undefined, fontWeight: inwardForm.other_charges > 0 ? 700 : undefined }} placeholder="Transport / P&F" value={inwardForm.other_charges !== undefined ? inwardForm.other_charges : ''} onChange={e => setInwardForm({ ...inwardForm, other_charges: e.target.value })} />
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
                  const qty = parseFloat(inwardForm.in_qty) || 0
                  const price = parseFloat(inwardForm.unit_price) || 0
                  const gross = Math.round((qty * price + Number.EPSILON) * 100) / 100
                  const discPct = Math.max(0, Math.min(100, parseFloat(inwardForm.discount_pct || 0) || 0))
                  const discAmt = Math.round((gross * (discPct / 100) + Number.EPSILON) * 100) / 100
                  const discBase = Math.max(0, gross - discAmt)
                  const otherChg = parseFloat(inwardForm.other_charges || 0) || 0
                  const taxable = Math.round((discBase + otherChg + Number.EPSILON) * 100) / 100
                  const gstPct = Number(inwardForm.gst_pct ?? 18)
                  const isInter = inwardForm.tax_type === 'inter' || inwardForm.tax_type === 'state' || inwardForm.tax_type === 'igst'

                  let cgst = 0, sgst = 0, igst = 0
                  if (isInter) {
                    igst = Math.round((taxable * (gstPct / 100) + Number.EPSILON) * 100) / 100
                  } else {
                    cgst = Math.round((taxable * (gstPct / 200) + Number.EPSILON) * 100) / 100
                    sgst = Math.round((taxable * (gstPct / 200) + Number.EPSILON) * 100) / 100
                  }
                  const tax = cgst + sgst + igst
                  const total = Math.round((taxable + tax + Number.EPSILON) * 100) / 100

                  return (
                    <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '10px 14px', borderRadius: 8, fontSize: 12 }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10 }}>
                        <div><span style={{ color: '#64748b' }}>Gross Base:</span> <b style={{ display: 'block', marginTop: 2 }}>₹{gross.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</b></div>
                        {discAmt > 0 && <div><span style={{ color: '#b45309' }}>Discount (-):</span> <b style={{ color: '#b45309', display: 'block', marginTop: 2 }}>-₹{discAmt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</b></div>}
                        {otherChg > 0 && <div><span style={{ color: '#0369a1' }}>Other Chg (+):</span> <b style={{ color: '#0369a1', display: 'block', marginTop: 2 }}>+₹{otherChg.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</b></div>}
                        <div><span style={{ color: '#0f172a', fontWeight: 700 }}>Taxable Base:</span> <b style={{ display: 'block', marginTop: 2 }}>₹{taxable.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</b></div>
                        {!isInter ? (
                          <>
                            <div><span style={{ color: '#059669' }}>CGST ({gstPct / 2}%):</span> <b style={{ color: '#059669', display: 'block', marginTop: 2 }}>₹{cgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</b></div>
                            <div><span style={{ color: '#059669' }}>SGST ({gstPct / 2}%):</span> <b style={{ color: '#059669', display: 'block', marginTop: 2 }}>₹{sgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</b></div>
                          </>
                        ) : (
                          <div><span style={{ color: '#6366f1' }}>IGST ({gstPct}%):</span> <b style={{ color: '#6366f1', display: 'block', marginTop: 2 }}>₹{igst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</b></div>
                        )}
                        <div><span style={{ color: '#166534', fontWeight: 800 }}>Grand Total:</span> <b style={{ color: '#0f766e', fontSize: 14, fontWeight: 900, display: 'block', marginTop: 2 }}>₹{total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</b></div>
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
                        <SearchableSelect
                          value={String(inwardForm.department_id || '')}
                          onChange={v => setInwardForm({ ...inwardForm, department_id: v })}
                          placeholder="-- Select Returning Department --"
                          searchPlaceholder="Type department name..."
                          options={depts.map(d => ({ value: String(d.id), label: d.name, code: d.code }))}
                        />
                      </>
                    ) : (
                      <>
                        <label style={S.label}>Vendor / Supplier Name</label>
                        <SearchableSelect
                          value={vendorPickMode === 'other' ? '__other__' : String(inwardForm.vendor_id || '')}
                          onChange={id => {
                            if (id === '__other__') {
                              setVendorPickMode('other')
                              setInwardForm({ ...inwardForm, vendor_id: '', vendor_name: '' })
                            } else {
                              const v = vendors.find(vv => String(vv.id) === id)
                              setVendorPickMode('list')
                              setInwardForm({ ...inwardForm, vendor_id: id, vendor_name: v ? v.name : '' })
                            }
                          }}
                          placeholder="-- Select registered vendor --"
                          searchPlaceholder="Type vendor name or GSTIN..."
                          options={[
                            ...vendors.map(v => ({
                              value: String(v.id),
                              label: v.name,
                              code: v.code,
                              subtext: v.gstin ? `GST: ${v.gstin}` : undefined,
                              badge: `${v.poCount || v.po_count || 0} POs`
                            })),
                            { value: '__other__', label: 'Other / Direct-OEM (type name below)' }
                          ]}
                        />
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
                    <SearchableSelect
                      value={inwardForm.quality_status || 'Accepted'}
                      onChange={v => setInwardForm({ ...inwardForm, quality_status: v })}
                      placeholder="Select QC status..."
                      options={[
                        { value: 'Accepted', label: 'Accepted (Passed Inspection)', badge: '✅' },
                        { value: 'Conditionally Accepted', label: 'Conditionally Accepted', badge: '⚠️' },
                        { value: 'Under QC Inspection', label: 'Under QC Inspection', badge: '⏳' }
                      ]}
                    />
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
        <div style={{ ...S.overlay, display: outwardModalMinimized ? 'none' : 'flex' }}>
          <div style={{ ...S.modal, maxWidth: 740, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={S.modalHdr}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <b style={{ fontSize: 16 }}>📤 Fast Outward Issue Desk</b>
                  <span style={{
                    fontSize: 11,
                    padding: '2px 8px',
                    borderRadius: 12,
                    fontWeight: 700,
                    background: outwardForm.outward_type === 'job_work' ? '#ede9fe' : outwardForm.outward_type === 'return_to_vendor' ? '#fee2e2' : outwardForm.outward_type === 'inter_store_transfer' || outwardForm.outward_type === 'transfer' ? '#e0f2fe' : '#fef3c7',
                    color: outwardForm.outward_type === 'job_work' ? '#7c3aed' : outwardForm.outward_type === 'return_to_vendor' ? '#dc2626' : outwardForm.outward_type === 'inter_store_transfer' || outwardForm.outward_type === 'transfer' ? '#0284c7' : '#b45309'
                  }}>
                    {outwardForm.outward_type === 'job_work' ? '1. JOB WORK' : outwardForm.outward_type === 'return_to_vendor' ? '2. RETURN TO PARTY' : outwardForm.outward_type === 'inter_store_transfer' || outwardForm.outward_type === 'transfer' ? '3. INTER STORE TRANSFER' : 'DEPT CONSUMPTION'}
                  </span>
                </div>
                <div style={S.muted}>Direct stock deduction with permanent traceability &amp; audit logging</div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  style={{ ...S.x, fontWeight: 800 }}
                  title="Minimize"
                  onClick={() => {
                    setOutwardModalMinimized(true)
                    mmMinimize('store-outward', 'Outward Issue (SIV)', () => setOutwardModalMinimized(false))
                  }}
                >─</button>
                <button style={S.x} onClick={() => { mmClose('store-outward'); setOutwardModalMinimized(false); setOutwardModal(false) }}>✕</button>
              </div>
            </div>

            {/* 3-Mode Workflow Segmented Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8, margin: '12px 0 16px 0' }}>
              {[
                {
                  id: 'job_work',
                  title: '1. 🏭 Job Work',
                  subtitle: 'Outside repair / machining',
                  color: '#7c3aed',
                  bg: '#ede9fe',
                  border: '#c4b5fd'
                },
                {
                  id: 'return_to_vendor',
                  title: '2. ↩️ Return to Party',
                  subtitle: 'RTV against GRN / QC reject',
                  color: '#dc2626',
                  bg: '#fee2e2',
                  border: '#fca5a5'
                },
                {
                  id: 'inter_store_transfer',
                  title: '3. 🔄 Store Transfer',
                  subtitle: 'STO inter-store / sub-store',
                  color: '#0284c7',
                  bg: '#e0f2fe',
                  border: '#7dd3fc'
                },
                {
                  id: 'issue',
                  title: '4. 📤 Dept Issue',
                  subtitle: 'Internal plant consumption',
                  color: '#b45309',
                  bg: '#fef3c7',
                  border: '#fcd34d'
                }
              ].map(m => {
                const isActive = (outwardForm.outward_type === m.id) || (m.id === 'inter_store_transfer' && outwardForm.outward_type === 'transfer')
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      setOutwardForm(prev => ({
                        ...prev,
                        outward_type: m.id,
                        reference_type: m.id === 'job_work' ? 'JOB_WORK' : m.id === 'return_to_vendor' ? 'RTV' : m.id === 'inter_store_transfer' ? 'STO' : 'WORK_ORDER',
                        reference_id: '',
                        unit_price: selectedOutwardMat ? (selectedOutwardMat.unit_price || '') : prev.unit_price
                      }))
                    }}
                    style={{
                      padding: '10px 12px',
                      borderRadius: 8,
                      border: isActive ? `2px solid ${m.color}` : '1px solid #e2e8f0',
                      background: isActive ? m.bg : '#ffffff',
                      color: isActive ? m.color : '#475569',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.15s ease',
                      boxShadow: isActive ? '0 2px 6px rgba(0,0,0,0.06)' : 'none'
                    }}
                  >
                    <div style={{ fontWeight: 800, fontSize: 13 }}>{m.title}</div>
                    <div style={{ fontSize: 10, opacity: 0.85, marginTop: 2 }}>{m.subtitle}</div>
                  </button>
                )
              })}
            </div>

            <form onSubmit={handleCreateOutward} style={S.form}>

              {/* ── WORKFLOW 1: JOB WORK ── */}
              {outwardForm.outward_type === 'job_work' && (
                <>
                  {/* Header: Party Name & Dept Context */}
                  <div style={S.grid2}>
                    <div>
                      <label style={S.label}>1. Select Party Name (Job Worker / Vendor) *</label>
                      <SearchableSelect
                        value={String(outwardForm.vendor_id || '')}
                        onChange={v => setOutwardForm({ ...outwardForm, vendor_id: v })}
                        placeholder="-- Choose Job Worker / Lathe / Motor Repair Vendor --"
                        searchPlaceholder="Search vendor by name, code, city..."
                        required
                        options={vendors.map(v => ({
                          value: String(v.id),
                          label: v.name,
                          code: v.code,
                          subtext: `${v.city ? v.city + ' · ' : ''}${v.gstin ? 'GST: ' + v.gstin : 'Vendor'}`
                        }))}
                      />
                    </div>
                    <div>
                      <label style={S.label}>2. Requesting Department *</label>
                      <SearchableSelect
                        value={String(outwardForm.department_id || '')}
                        onChange={v => setOutwardForm({ ...outwardForm, department_id: v })}
                        placeholder="-- Requesting Department --"
                        searchPlaceholder="Type department name..."
                        required
                        options={depts.map(d => ({ value: String(d.id), label: d.name, code: d.code }))}
                      />
                    </div>
                  </div>

                  <div style={S.grid2}>
                    <div>
                      <label style={S.label}>Job Work Purpose *</label>
                      <input
                        style={S.input}
                        placeholder="e.g. Bearing journal turning & re-sleeving / Motor rewinding..."
                        value={outwardForm.purpose}
                        onChange={e => setOutwardForm({ ...outwardForm, purpose: e.target.value })}
                        required
                      />
                    </div>
                    <div>
                      <label style={S.label}>Plant Machine / Section Context</label>
                      <SearchableSelect
                        value={String(outwardForm.machine_id || '')}
                        onChange={v => setOutwardForm({ ...outwardForm, machine_id: v })}
                        placeholder="-- Select Machine (PM1 / Boiler / ETP) --"
                        searchPlaceholder="Type machine name or code..."
                        allowClear={true}
                        options={machines.map(m => ({ value: String(m.id), label: m.name, code: m.code || m.machine_code, subtext: m.type }))}
                      />
                    </div>
                  </div>

                  {/* Multi-Item Line Entry Section */}
                  <div style={{ marginTop: 12, borderTop: '1px solid #e2e8f0', paddingTop: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <label style={{ ...S.label, margin: 0, fontWeight: 800, fontSize: 13, color: '#7c3aed' }}>
                        📦 Job Work Line Items ({(outwardForm.items || []).length})
                      </label>
                      <button
                        type="button"
                        onClick={addOutwardItem}
                        style={{ ...S.btnGhost, padding: '4px 10px', fontSize: 12, color: '#7c3aed', borderColor: '#c4b5fd', background: '#f5f3ff', fontWeight: 700 }}
                      >
                        + ➕ Add Job Work Item
                      </button>
                    </div>

                    {(outwardForm.items || []).map((item, idx) => {
                      const itemMat = mats.find(m => String(m.id) === String(item.material_id))
                      const curStock = Number(itemMat?.current_stock || itemMat?.currentStock || 0)
                      const lineVal = (Number(item.out_qty || 0) * Number(item.unit_price || 0))

                      return (
                        <div key={item.id || idx} style={{ background: '#faf5ff', border: '1px solid #e9d5ff', borderRadius: 8, padding: 10, marginBottom: 10, position: 'relative' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                            <span style={{ fontSize: 11, fontWeight: 700, color: '#6b21a8', background: '#f3e8ff', padding: '2px 8px', borderRadius: 4 }}>
                              Item #{idx + 1}
                            </span>
                            {(outwardForm.items || []).length > 1 && (
                              <button
                                type="button"
                                onClick={() => removeOutwardItem(idx)}
                                style={{ background: 'none', border: 'none', color: '#ef4444', fontWeight: 700, fontSize: 12, cursor: 'pointer', padding: '2px 6px' }}
                                title="Remove this item"
                              >
                                ✕ Remove
                              </button>
                            )}
                          </div>

                          <div>
                            <label style={{ ...S.label, fontSize: 11 }}>Select Job Work Material *</label>
                            <SearchableSelect
                              value={String(item.material_id || '')}
                              onChange={v => updateOutwardItem(idx, 'material_id', v)}
                              placeholder="-- Choose Spare / Material to send for Job Work --"
                              searchPlaceholder="Type material name, code, category..."
                              required
                              options={mats.map(m => ({
                                value: String(m.id),
                                label: m.name,
                                code: m.code,
                                subtext: `Stock: ${m.current_stock || m.currentStock || 0} ${m.uom} · Price: ₹${m.unit_price || 0} · Bin: ${m.bin_location || m.binLocation || 'Store'}`,
                                badge: Number(m.current_stock || m.currentStock || 0) <= 0 ? '❌ Out' : undefined,
                                group: m.categoryName
                              }))}
                            />
                          </div>

                          {itemMat && (
                            <div style={{ background: curStock > 0 ? '#f5f3ff' : '#fef2f2', border: '1px solid #ddd6fe', padding: '4px 8px', borderRadius: 4, fontSize: 11, color: '#5b21b6', margin: '4px 0', display: 'flex', justifyContent: 'space-between' }}>
                              <span>📦 Store Stock: <b>{curStock} {itemMat.uom}</b></span>
                              <span>Default Price: <b>₹{Number(itemMat.unit_price || 0).toFixed(2)}</b></span>
                            </div>
                          )}

                          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.2fr 1fr', gap: 8, marginTop: 6 }}>
                            <div>
                              <label style={{ ...S.label, fontSize: 11 }}>Job Work Qty *</label>
                              <input
                                type="number"
                                step="0.001"
                                min="0.001"
                                max={itemMat ? curStock : 999999}
                                style={S.input}
                                placeholder="0.000"
                                value={item.out_qty}
                                onChange={e => updateOutwardItem(idx, 'out_qty', e.target.value)}
                                required
                              />
                            </div>
                            <div>
                              <label style={{ ...S.label, fontSize: 11 }}>Rate (₹ / Unit)</label>
                              <input
                                type="number"
                                step="0.01"
                                style={S.input}
                                placeholder="Rate / Unit"
                                value={item.unit_price}
                                onChange={e => updateOutwardItem(idx, 'unit_price', e.target.value)}
                              />
                            </div>
                            <div>
                              <label style={{ ...S.label, fontSize: 11 }}>Line Total</label>
                              <div style={{ padding: '7px 8px', background: '#ede9fe', borderRadius: 6, fontWeight: 700, color: '#6b21a8', fontSize: 12, textAlign: 'right' }}>
                                ₹{lineVal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                              </div>
                            </div>
                          </div>

                          <div style={{ marginTop: 6 }}>
                            <input
                              style={{ ...S.input, fontSize: 11, padding: '4px 8px' }}
                              placeholder="Item specific machining instruction / roll dimensions (optional)..."
                              value={item.remarks || ''}
                              onChange={e => updateOutwardItem(idx, 'remarks', e.target.value)}
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {/* Header Footer Inputs */}
                  <div style={S.grid2}>
                    <div>
                      <label style={S.label}>Delivery / DC / Returnable GP Ref</label>
                      <input
                        style={S.input}
                        placeholder="Auto-generated Returnable GP (or custom ref)"
                        value={outwardForm.reference_id}
                        onChange={e => setOutwardForm({ ...outwardForm, reference_id: e.target.value })}
                      />
                    </div>
                    <div>
                      <label style={S.label}>Issued To / Transporter</label>
                      <input
                        style={S.input}
                        placeholder="e.g. Driver / Courier / Authorized Bearer"
                        value={outwardForm.issued_to}
                        onChange={e => setOutwardForm({ ...outwardForm, issued_to: e.target.value })}
                      />
                    </div>
                  </div>

                  <div>
                    <label style={S.label}>Remarks / Authorization Details</label>
                    <textarea
                      style={S.input}
                      rows={2}
                      placeholder="Shift details, expected return date, special instructions..."
                      value={outwardForm.remarks}
                      onChange={e => setOutwardForm({ ...outwardForm, remarks: e.target.value })}
                    />
                  </div>
                </>
              )}

              {/* ── WORKFLOW 2: RETURN TO PARTY (RTV) ── */}
              {outwardForm.outward_type === 'return_to_vendor' && (
                <>
                  {/* Header: Party Name */}
                  <div style={S.grid2}>
                    <div>
                      <label style={S.label}>1. Select Party Name (Vendor / Supplier) *</label>
                      <SearchableSelect
                        value={String(outwardForm.vendor_id || '')}
                        onChange={v => {
                          setOutwardForm({ ...outwardForm, vendor_id: v })
                          fetchVendorGrnMaterials(v)
                        }}
                        placeholder="-- Select Vendor / Supplier to Return Material --"
                        searchPlaceholder="Search supplier by name, code..."
                        required
                        options={vendors.map(v => ({
                          value: String(v.id),
                          label: v.name,
                          code: v.code,
                          subtext: `${v.city ? v.city + ' · ' : ''}${v.gstin ? 'GST: ' + v.gstin : 'Vendor'}`
                        }))}
                      />
                    </div>
                    <div>
                      <label style={S.label}>Originating Department</label>
                      <SearchableSelect
                        value={String(outwardForm.department_id || '')}
                        onChange={v => setOutwardForm({ ...outwardForm, department_id: v })}
                        placeholder="-- Quality / Store / Originating Dept --"
                        searchPlaceholder="Type department name..."
                        options={depts.map(d => ({ value: String(d.id), label: d.name, code: d.code }))}
                      />
                    </div>
                  </div>

                  <div style={S.grid2}>
                    <div>
                      <label style={S.label}>Purpose / Rejection Reason *</label>
                      <input
                        style={S.input}
                        placeholder="e.g. QC Spec Failure / Dimension Mismatch / Core Cracking..."
                        value={outwardForm.purpose}
                        onChange={e => setOutwardForm({ ...outwardForm, purpose: e.target.value })}
                        required
                      />
                    </div>
                    <div>
                      <label style={S.label}>Debit Note / Rejection Memo Ref</label>
                      <input
                        style={S.input}
                        placeholder="DN # / RTV Ref"
                        value={outwardForm.reference_id}
                        onChange={e => setOutwardForm({ ...outwardForm, reference_id: e.target.value })}
                      />
                    </div>
                  </div>

                  {/* Multi-Item Line Entry Section for RTV */}
                  <div style={{ marginTop: 12, borderTop: '1px solid #e2e8f0', paddingTop: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <div>
                        <label style={{ ...S.label, margin: 0, fontWeight: 800, fontSize: 13, color: '#dc2626' }}>
                          ↩️ Materials to Return ({(outwardForm.items || []).length})
                        </label>
                        {loadingVendorGrn && <span style={{ fontSize: 11, color: '#0284c7', marginLeft: 8 }}>⏳ Fetching vendor GRN records...</span>}
                      </div>
                      <button
                        type="button"
                        onClick={addOutwardItem}
                        style={{ ...S.btnGhost, padding: '4px 10px', fontSize: 12, color: '#dc2626', borderColor: '#fca5a5', background: '#fef2f2', fontWeight: 700 }}
                      >
                        + ➕ Add Return Item
                      </button>
                    </div>

                    {(outwardForm.items || []).map((item, idx) => {
                      const itemMat = mats.find(m => String(m.id) === String(item.material_id))
                      const curStock = Number(itemMat?.current_stock || itemMat?.currentStock || 0)
                      const lineVal = (Number(item.out_qty || 0) * Number(item.unit_price || 0))

                      return (
                        <div key={item.id || idx} style={{ background: '#fff5f5', border: '1px solid #fecaca', borderRadius: 8, padding: 10, marginBottom: 10 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                            <span style={{ fontSize: 11, fontWeight: 700, color: '#991b1b', background: '#fee2e2', padding: '2px 8px', borderRadius: 4 }}>
                              Return Item #{idx + 1}
                            </span>
                            {(outwardForm.items || []).length > 1 && (
                              <button
                                type="button"
                                onClick={() => removeOutwardItem(idx)}
                                style={{ background: 'none', border: 'none', color: '#ef4444', fontWeight: 700, fontSize: 12, cursor: 'pointer', padding: '2px 6px' }}
                                title="Remove this item"
                              >
                                ✕ Remove
                              </button>
                            )}
                          </div>

                          <div>
                            <label style={{ ...S.label, fontSize: 11 }}>Select GRN Material to Return *</label>
                            {vendorGrnMaterials.length > 0 ? (
                              <SearchableSelect
                                value={String(item.material_id || '')}
                                onChange={v => {
                                  const grnIt = vendorGrnMaterials.find(g => String(g.material_id) === String(v))
                                  const matObj = mats.find(mm => String(mm.id) === String(v))
                                  setOutwardForm(prev => {
                                    const newItems = [...(prev.items || [])]
                                    newItems[idx] = {
                                      ...newItems[idx],
                                      material_id: v,
                                      unit_price: grnIt?.unitPrice || matObj?.unit_price || '',
                                      grn_id: grnIt?.grnId || '',
                                      reference_id: grnIt?.grnNumber || '',
                                      batch_number: grnIt?.batchNumber || '',
                                      selectedGrnItem: grnIt || null
                                    }
                                    return { ...prev, items: newItems }
                                  })
                                }}
                                placeholder="-- Choose GRN Material received from this vendor --"
                                searchPlaceholder="Type material name, code, GRN #..."
                                required
                                options={[
                                  ...vendorGrnMaterials.map(g => ({
                                    value: String(g.material_id),
                                    label: `${g.materialName} (${g.materialCode})`,
                                    code: g.grnNumber,
                                    subtext: `GRN: ${g.grnNumber} (${new Date(g.grnDate).toLocaleDateString('en-IN')}) · Rec: ${g.receivedQty} ${g.uom} @ ₹${g.unitPrice} · Stock: ${g.currentStock}`,
                                    badge: `GRN: ₹${g.unitPrice}`
                                  })),
                                  ...mats.filter(m => !vendorGrnMaterials.some(g => String(g.material_id) === String(m.id))).map(m => ({
                                    value: String(m.id),
                                    label: m.name,
                                    code: m.code,
                                    subtext: `Stock: ${m.current_stock || 0} ${m.uom} (Other Store Material)`
                                  }))
                                ]}
                              />
                            ) : (
                              <SearchableSelect
                                value={String(item.material_id || '')}
                                onChange={v => updateOutwardItem(idx, 'material_id', v)}
                                placeholder="-- Choose Material from Store Inventory --"
                                searchPlaceholder="Type material name, code, category..."
                                required
                                options={mats.map(m => ({
                                  value: String(m.id),
                                  label: m.name,
                                  code: m.code,
                                  subtext: `Stock: ${m.current_stock || 0} ${m.uom} · Price: ₹${m.unit_price || 0}`
                                }))}
                              />
                            )}
                          </div>

                          {item.selectedGrnItem && (
                            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', padding: '4px 8px', borderRadius: 4, fontSize: 11, color: '#991b1b', margin: '4px 0', display: 'flex', justifyContent: 'space-between' }}>
                              <span>📄 GRN: <b>{item.selectedGrnItem.grnNumber}</b> ({new Date(item.selectedGrnItem.grnDate).toLocaleDateString('en-IN')})</span>
                              <span>Inward: <b>{item.selectedGrnItem.receivedQty} {item.selectedGrnItem.uom}</b> · Store Stock: <b>{item.selectedGrnItem.currentStock} {item.selectedGrnItem.uom}</b></span>
                            </div>
                          )}

                          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.2fr 1fr', gap: 8, marginTop: 6 }}>
                            <div>
                              <label style={{ ...S.label, fontSize: 11 }}>Return Qty *</label>
                              <input
                                type="number"
                                step="0.001"
                                min="0.001"
                                max={itemMat ? curStock : 999999}
                                style={S.input}
                                placeholder="0.000"
                                value={item.out_qty}
                                onChange={e => updateOutwardItem(idx, 'out_qty', e.target.value)}
                                required
                              />
                            </div>
                            <div>
                              <label style={{ ...S.label, fontSize: 11 }}>Debit Rate (₹ / Unit)</label>
                              <input
                                type="number"
                                step="0.01"
                                style={S.input}
                                placeholder="Debit Price"
                                value={item.unit_price}
                                onChange={e => updateOutwardItem(idx, 'unit_price', e.target.value)}
                              />
                            </div>
                            <div>
                              <label style={{ ...S.label, fontSize: 11 }}>Debit Valuation</label>
                              <div style={{ padding: '7px 8px', background: '#fee2e2', borderRadius: 6, fontWeight: 700, color: '#991b1b', fontSize: 12, textAlign: 'right' }}>
                                ₹{lineVal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  <div style={S.grid2}>
                    <div>
                      <label style={S.label}>Transporter / Courier LR #</label>
                      <input
                        style={S.input}
                        placeholder="Vehicle / Courier tracking details"
                        value={outwardForm.issued_to}
                        onChange={e => setOutwardForm({ ...outwardForm, issued_to: e.target.value })}
                      />
                    </div>
                    <div>
                      <label style={S.label}>Remarks / Settlement Notes</label>
                      <textarea
                        style={S.input}
                        rows={1}
                        placeholder="Debit note adjustments, authorization notes, replacement agreement..."
                        value={outwardForm.remarks}
                        onChange={e => setOutwardForm({ ...outwardForm, remarks: e.target.value })}
                      />
                    </div>
                  </div>
                </>
              )}

              {/* ── WORKFLOW 3: INTER STORE TRANSFER ── */}
              {(outwardForm.outward_type === 'inter_store_transfer' || outwardForm.outward_type === 'transfer') && (
                <>
                  {/* Header: STO Ref & Target Dept */}
                  <div style={S.grid2}>
                    <div>
                      <label style={S.label}>1. Store Issue No (STO / SIV Ref)</label>
                      <input
                        style={S.input}
                        placeholder="Auto-generated STO # (or enter SIV Ref)"
                        value={outwardForm.store_issue_no || outwardForm.reference_id}
                        onChange={e => setOutwardForm({ ...outwardForm, store_issue_no: e.target.value, reference_id: e.target.value })}
                      />
                    </div>
                    <div>
                      <label style={S.label}>Issue Date *</label>
                      <input
                        type="date"
                        style={S.input}
                        value={outwardForm.date}
                        onChange={e => setOutwardForm({ ...outwardForm, date: e.target.value })}
                        required
                      />
                    </div>
                  </div>

                  <div style={S.grid2}>
                    <div>
                      <label style={S.label}>2. Receiving Department / Sub-Store *</label>
                      <SearchableSelect
                        value={String(outwardForm.department_id || '')}
                        onChange={v => setOutwardForm({ ...outwardForm, department_id: v })}
                        placeholder="-- Target / Receiving Dept --"
                        searchPlaceholder="Type department name..."
                        required
                        options={depts.map(d => ({ value: String(d.id), label: d.name, code: d.code }))}
                      />
                    </div>
                    <div>
                      <label style={S.label}>Target Machine / Section Context</label>
                      <SearchableSelect
                        value={String(outwardForm.machine_id || '')}
                        onChange={v => setOutwardForm({ ...outwardForm, machine_id: v })}
                        placeholder="-- Target Equipment / Machine --"
                        searchPlaceholder="Type machine name or code..."
                        allowClear={true}
                        options={machines.map(m => ({ value: String(m.id), label: m.name, code: m.code || m.machine_code, subtext: m.type }))}
                      />
                    </div>
                  </div>

                  <div>
                    <label style={S.label}>Transfer Purpose *</label>
                    <input
                      style={S.input}
                      placeholder="e.g. Shift replenishment to Electrical sub-store / Urgent chemical dosing shift transfer..."
                      value={outwardForm.purpose}
                      onChange={e => setOutwardForm({ ...outwardForm, purpose: e.target.value })}
                      required
                    />
                  </div>

                  {/* Multi-Item Line Entry Section for STO */}
                  <div style={{ marginTop: 12, borderTop: '1px solid #e2e8f0', paddingTop: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <label style={{ ...S.label, margin: 0, fontWeight: 800, fontSize: 13, color: '#0284c7' }}>
                        🔄 Materials to Transfer ({(outwardForm.items || []).length})
                      </label>
                      <button
                        type="button"
                        onClick={addOutwardItem}
                        style={{ ...S.btnGhost, padding: '4px 10px', fontSize: 12, color: '#0284c7', borderColor: '#7dd3fc', background: '#f0f9ff', fontWeight: 700 }}
                      >
                        + ➕ Add Transfer Item
                      </button>
                    </div>

                    {(outwardForm.items || []).map((item, idx) => {
                      const itemMat = mats.find(m => String(m.id) === String(item.material_id))
                      const curStock = Number(itemMat?.current_stock || itemMat?.currentStock || 0)
                      const lineVal = (Number(item.out_qty || 0) * Number(item.unit_price || 0))

                      return (
                        <div key={item.id || idx} style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 8, padding: 10, marginBottom: 10 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                            <span style={{ fontSize: 11, fontWeight: 700, color: '#0369a1', background: '#e0f2fe', padding: '2px 8px', borderRadius: 4 }}>
                              Transfer Item #{idx + 1}
                            </span>
                            {(outwardForm.items || []).length > 1 && (
                              <button
                                type="button"
                                onClick={() => removeOutwardItem(idx)}
                                style={{ background: 'none', border: 'none', color: '#ef4444', fontWeight: 700, fontSize: 12, cursor: 'pointer', padding: '2px 6px' }}
                                title="Remove this item"
                              >
                                ✕ Remove
                              </button>
                            )}
                          </div>

                          <div>
                            <label style={{ ...S.label, fontSize: 11 }}>Select Issue Material *</label>
                            <SearchableSelect
                              value={String(item.material_id || '')}
                              onChange={v => updateOutwardItem(idx, 'material_id', v)}
                              placeholder="-- Choose Material to Transfer --"
                              searchPlaceholder="Type material name, code, category, bin..."
                              required
                              options={mats.map(m => ({
                                value: String(m.id),
                                label: m.name,
                                code: m.code,
                                subtext: `Stock: ${m.current_stock || m.currentStock || 0} ${m.uom} · Bin: ${m.bin_location || m.binLocation || 'Main Store'}`,
                                badge: Number(m.current_stock || m.currentStock || 0) <= 0 ? '❌ Out of Stock' : undefined,
                                group: m.categoryName
                              }))}
                            />
                          </div>

                          {itemMat && (
                            <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', padding: '4px 8px', borderRadius: 4, fontSize: 11, color: '#0369a1', margin: '4px 0', display: 'flex', justifyContent: 'space-between' }}>
                              <span>📦 Source Stock: <b>{curStock} {itemMat.uom}</b></span>
                              <span>Valuation: <b>₹{Number(itemMat.unit_price || 0).toFixed(2)}</b></span>
                            </div>
                          )}

                          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.2fr 1fr', gap: 8, marginTop: 6 }}>
                            <div>
                              <label style={{ ...S.label, fontSize: 11 }}>Issue Qty *</label>
                              <input
                                type="number"
                                step="0.001"
                                min="0.001"
                                max={itemMat ? curStock : 999999}
                                style={S.input}
                                placeholder="0.000"
                                value={item.out_qty}
                                onChange={e => updateOutwardItem(idx, 'out_qty', e.target.value)}
                                required
                              />
                            </div>
                            <div>
                              <label style={{ ...S.label, fontSize: 11 }}>Transfer Rate (₹)</label>
                              <input
                                type="number"
                                step="0.01"
                                style={S.input}
                                placeholder="Rate / Unit"
                                value={item.unit_price}
                                onChange={e => updateOutwardItem(idx, 'unit_price', e.target.value)}
                              />
                            </div>
                            <div>
                              <label style={{ ...S.label, fontSize: 11 }}>Transfer Value</label>
                              <div style={{ padding: '7px 8px', background: '#e0f2fe', borderRadius: 6, fontWeight: 700, color: '#0369a1', fontSize: 12, textAlign: 'right' }}>
                                ₹{lineVal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  <div style={S.grid2}>
                    <div>
                      <label style={S.label}>Receiver Person Name</label>
                      <input
                        style={S.input}
                        placeholder="e.g. Sub-store keeper / Section in-charge"
                        value={outwardForm.issued_to}
                        onChange={e => setOutwardForm({ ...outwardForm, issued_to: e.target.value })}
                      />
                    </div>
                    <div>
                      <label style={S.label}>Remarks / Handover Notes</label>
                      <textarea
                        style={S.input}
                        rows={1}
                        placeholder="Transfer slip details, carrier shift, physical inspection note..."
                        value={outwardForm.remarks}
                        onChange={e => setOutwardForm({ ...outwardForm, remarks: e.target.value })}
                      />
                    </div>
                  </div>
                </>
              )}

              {/* ── WORKFLOW 4: GENERAL DEPT ISSUE ── */}
              {outwardForm.outward_type === 'issue' && (
                <>
                  <div style={S.grid2}>
                    <div>
                      <label style={S.label}>Work Order / Indent Ref #</label>
                      <input
                        style={S.input}
                        placeholder="WO # / Indent Ref"
                        value={outwardForm.reference_id}
                        onChange={e => setOutwardForm({ ...outwardForm, reference_id: e.target.value })}
                      />
                    </div>
                    <div>
                      <label style={S.label}>Issue Date *</label>
                      <input
                        type="date"
                        style={S.input}
                        value={outwardForm.date}
                        onChange={e => setOutwardForm({ ...outwardForm, date: e.target.value })}
                      />
                    </div>
                  </div>

                  <div style={S.grid2}>
                    <div>
                      <label style={S.label}>Plant Department *</label>
                      <SearchableSelect
                        value={String(outwardForm.department_id || '')}
                        onChange={v => setOutwardForm({ ...outwardForm, department_id: v })}
                        placeholder="-- Select Receiving Dept --"
                        searchPlaceholder="Type department name..."
                        required
                        options={depts.map(d => ({ value: String(d.id), label: d.name, code: d.code }))}
                      />
                    </div>
                    <div>
                      <label style={S.label}>Issued To (Person Name) *</label>
                      <input
                        style={S.input}
                        placeholder="e.g. Ramesh Kumar (Operator)"
                        value={outwardForm.issued_to}
                        onChange={e => setOutwardForm({ ...outwardForm, issued_to: e.target.value })}
                        required
                      />
                    </div>
                  </div>

                  <div style={S.grid2}>
                    <div>
                      <label style={S.label}>Purpose *</label>
                      <input
                        style={S.input}
                        placeholder="e.g. PM1 Felt Roll Replacement"
                        value={outwardForm.purpose}
                        onChange={e => setOutwardForm({ ...outwardForm, purpose: e.target.value })}
                        required
                      />
                    </div>
                    <div>
                      <label style={S.label}>Machine / Section Context</label>
                      <SearchableSelect
                        value={String(outwardForm.machine_id || '')}
                        onChange={v => setOutwardForm({ ...outwardForm, machine_id: v })}
                        placeholder="-- Select Machine (Optional) --"
                        searchPlaceholder="Type machine name or code..."
                        allowClear={true}
                        options={machines.map(m => ({ value: String(m.id), label: m.name, code: m.code || m.machine_code, subtext: m.type }))}
                      />
                    </div>
                  </div>

                  {/* Multi-Item Line Entry Section for General Issue */}
                  <div style={{ marginTop: 12, borderTop: '1px solid #e2e8f0', paddingTop: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <label style={{ ...S.label, margin: 0, fontWeight: 800, fontSize: 13, color: '#b45309' }}>
                        📤 Store Items to Issue ({(outwardForm.items || []).length})
                      </label>
                      <button
                        type="button"
                        onClick={addOutwardItem}
                        style={{ ...S.btnGhost, padding: '4px 10px', fontSize: 12, color: '#b45309', borderColor: '#fcd34d', background: '#fef3c7', fontWeight: 700 }}
                      >
                        + ➕ Add Material Issue
                      </button>
                    </div>

                    {(outwardForm.items || []).map((item, idx) => {
                      const itemMat = mats.find(m => String(m.id) === String(item.material_id))
                      const curStock = Number(itemMat?.current_stock || itemMat?.currentStock || 0)

                      return (
                        <div key={item.id || idx} style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: 10, marginBottom: 10 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                            <span style={{ fontSize: 11, fontWeight: 700, color: '#92400e', background: '#fef3c7', padding: '2px 8px', borderRadius: 4 }}>
                              Issue Item #{idx + 1}
                            </span>
                            {(outwardForm.items || []).length > 1 && (
                              <button
                                type="button"
                                onClick={() => removeOutwardItem(idx)}
                                style={{ background: 'none', border: 'none', color: '#ef4444', fontWeight: 700, fontSize: 12, cursor: 'pointer', padding: '2px 6px' }}
                                title="Remove this item"
                              >
                                ✕ Remove
                              </button>
                            )}
                          </div>

                          <div>
                            <label style={{ ...S.label, fontSize: 11 }}>Select Material *</label>
                            <SearchableSelect
                              value={String(item.material_id || '')}
                              onChange={v => updateOutwardItem(idx, 'material_id', v)}
                              placeholder="-- Choose Material --"
                              searchPlaceholder="Type material name, code, category, bin..."
                              required
                              options={mats.map(m => ({
                                value: String(m.id),
                                label: m.name,
                                code: m.code,
                                subtext: `Stock: ${m.current_stock || m.currentStock || 0} ${m.uom} · Bin: ${m.bin_location || m.binLocation || 'Store'}`,
                                badge: Number(m.current_stock || m.currentStock || 0) <= 0 ? '❌ Out' : undefined,
                                group: m.categoryName
                              }))}
                            />
                          </div>

                          {itemMat && (
                            <div style={{ background: curStock > 0 ? '#f0fdf4' : '#fef2f2', padding: '4px 8px', borderRadius: 4, fontSize: 11, color: curStock > 0 ? '#166534' : '#991b1b', fontWeight: 600, margin: '4px 0' }}>
                              📦 Available in Store: {curStock} {itemMat.uom} | Location: {itemMat.binLocation || itemMat.bin_location || 'Main Store'}
                            </div>
                          )}

                          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.5fr', gap: 8, marginTop: 6 }}>
                            <div>
                              <label style={{ ...S.label, fontSize: 11 }}>Issue Quantity *</label>
                              <input
                                type="number"
                                step="0.001"
                                min="0.001"
                                max={itemMat ? curStock : 999999}
                                style={S.input}
                                placeholder="0.000"
                                value={item.out_qty}
                                onChange={e => updateOutwardItem(idx, 'out_qty', e.target.value)}
                                required
                              />
                            </div>
                            <div>
                              <label style={{ ...S.label, fontSize: 11 }}>Serial # / Asset Tag</label>
                              <input
                                style={S.input}
                                placeholder="Scan serial / tag..."
                                value={item.serial_number || ''}
                                onChange={e => updateOutwardItem(idx, 'serial_number', e.target.value)}
                              />
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  <div>
                    <label style={S.label}>Remarks / Shift Details</label>
                    <textarea
                      style={S.input}
                      rows={2}
                      placeholder="Shift A/B/C, authorization notes..."
                      value={outwardForm.remarks}
                      onChange={e => setOutwardForm({ ...outwardForm, remarks: e.target.value })}
                    />
                  </div>
                </>
              )}

              {/* Multi-Item Batch Summary Strip */}
              {(() => {
                const itemsList = outwardForm.items || []
                const validCount = itemsList.filter(it => it.material_id && Number(it.out_qty) > 0).length
                const totalQty = itemsList.reduce((sum, it) => sum + (Number(it.out_qty) || 0), 0)
                const totalVal = itemsList.reduce((sum, it) => sum + ((Number(it.out_qty) || 0) * (Number(it.unit_price) || 0)), 0)

                return (
                  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '10px 14px', marginTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', gap: 14 }}>
                      <div>
                        <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>Total Items</div>
                        <div style={{ fontSize: 14, fontWeight: 800, color: '#1e293b' }}>{validCount} of {itemsList.length} Item(s)</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>Total Quantity</div>
                        <div style={{ fontSize: 14, fontWeight: 800, color: '#0f766e' }}>{totalQty.toFixed(3)} Units</div>
                      </div>
                    </div>
                    {totalVal > 0 && (
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>Combined Valuation</div>
                        <div style={{ fontSize: 15, fontWeight: 900, color: '#7c3aed' }}>₹{totalVal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</div>
                      </div>
                    )}
                  </div>
                )
              })()}

              {/* Dynamic Action Buttons per Mode */}
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 14, paddingTop: 10, borderTop: '1px solid #e2e8f0' }}>
                <button type="button" style={S.btnGhost} onClick={() => setOutwardModal(false)}>Cancel</button>
                <button
                  type="submit"
                  style={{
                    ...S.btn,
                    background: outwardForm.outward_type === 'job_work' ? '#7c3aed' : outwardForm.outward_type === 'return_to_vendor' ? '#dc2626' : outwardForm.outward_type === 'inter_store_transfer' || outwardForm.outward_type === 'transfer' ? '#0284c7' : '#d97706',
                    color: '#fff',
                    fontWeight: 700,
                    padding: '8px 20px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6
                  }}
                >
                  {outwardForm.outward_type === 'job_work' && `🏭 Confirm Stock Issue (Job Work · ${(outwardForm.items || []).filter(it => it.material_id && Number(it.out_qty) > 0).length || 1} Items)`}
                  {outwardForm.outward_type === 'return_to_vendor' && `↩️ Confirm Store Issue to Out (RTV · ${(outwardForm.items || []).filter(it => it.material_id && Number(it.out_qty) > 0).length || 1} Items)`}
                  {(outwardForm.outward_type === 'inter_store_transfer' || outwardForm.outward_type === 'transfer') && `🔄 Confirm Store Received Stock (STO · ${(outwardForm.items || []).filter(it => it.material_id && Number(it.out_qty) > 0).length || 1} Items)`}
                  {outwardForm.outward_type === 'issue' && `📤 Confirm Stock Issue (${(outwardForm.items || []).filter(it => it.material_id && Number(it.out_qty) > 0).length || 1} Items)`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: PRINTABLE A3/A4 INWARD GOODS RECEIPT NOTE (GRN) INVOICE ── */}
      {inwardVoucher && (() => {
        const qty = Number(inwardVoucher.in_qty || 0)
        const price = Number(inwardVoucher.unit_price || 0)
        const discPct = Number(inwardVoucher.discount_pct || 0)
        const grossValue = qty * price
        const discAmt = Number(inwardVoucher.discount_amount || (grossValue * discPct) / 100)
        const taxable = Math.max(0, grossValue - discAmt)
        const gstPct = Number(inwardVoucher.gst_pct ?? 18)

        // Determine Interstate vs Intrastate from Vendor State / GSTIN (Company State Code: 29)
        const vendorState = (inwardVoucher.vendorState || '').toLowerCase()
        const vendorGstin = inwardVoucher.vendorGstin || ''
        const isInterState = (vendorState && vendorState !== 'karnataka') || (vendorGstin && !vendorGstin.startsWith('29'))

        const cgstPct = isInterState ? 0 : gstPct / 2
        const sgstPct = isInterState ? 0 : gstPct / 2
        const igstPct = isInterState ? gstPct : 0

        const cgstAmt = (taxable * cgstPct) / 100
        const sgstAmt = (taxable * sgstPct) / 100
        const igstAmt = (taxable * igstPct) / 100
        const totalGst = cgstAmt + sgstAmt + igstAmt
        const grandTotal = taxable + totalGst

        const grnDisplayNum = inwardVoucher.grnNumber || inwardVoucher.reference_id || `GRN-${inwardVoucher.id}`

        return (
          <div style={S.overlay}>
            <div style={{ ...S.modal, maxWidth: 900, background: '#ffffff', padding: 36, position: 'relative', overflow: 'hidden', color: '#1b1b1d' }} onClick={e => e.stopPropagation()}>
              
              {/* Top Floating Control Bar */}
              <div className="no-print" style={{ background: '#1e293b', color: '#fff', padding: '10px 18px', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 16 }}>📥</span>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>Official Inward GRN Tax Invoice Preview</div>
                    <div style={{ fontSize: 11, color: '#94a3b8' }}>A4 Official Commercial Format · Comprehensive CGST/SGST/IGST breakdown</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => window.print()}
                    style={{ background: '#0f766e', color: '#fff', border: 'none', borderRadius: 6, padding: '7px 16px', fontWeight: 700, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
                  >
                    🖨 Print / Save PDF
                  </button>
                  <button
                    onClick={() => setInwardVoucher(null)}
                    style={{ background: '#334155', color: '#fff', border: 'none', borderRadius: 6, padding: '7px 12px', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}
                  >
                    ✕ Close
                  </button>
                </div>
              </div>

              {/* Document Paper Container */}
              <div id="print-document" className="print-watermark-container" style={{ border: '1px solid #cbd5e1', borderRadius: 8, padding: '24px 28px', background: '#fff', position: 'relative', overflow: 'hidden' }}>
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #0f766e', paddingBottom: 14, marginBottom: 16, position: 'relative', zIndex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <img src={LOGO_DATA_URI} alt="Logo" style={{ height: 48, width: 'auto', maxWidth: 160, objectFit: 'contain', borderRadius: 6, border: '1px solid #cbd5e1', background: '#fff', padding: '2px 6px' }} />
                    <div>
                      <div style={{ fontSize: 22, fontWeight: 900, color: '#0f766e', letterSpacing: 0.5 }}>SRI M.K. PAPER MILLS PRIVATE LIMITED</div>
                      <div style={{ fontSize: 11, color: '#475569', marginTop: 2, fontWeight: 600 }}>
                        Manufacturers of High-Strength Kraft Paper & Multi-Layer Packaging Board
                      </div>
                      <div style={{ fontSize: 11, color: '#475569' }}>
                        Plant: Survey No. 128/1, Industrial Area, Village Gangur, Dist. Dharwad - 580011, Karnataka, India
                      </div>
                      <div style={{ fontSize: 11, color: '#0f172a', fontWeight: 700, marginTop: 4 }}>
                        GSTIN: <code>29AABCS1429B1Z8</code> | PAN: <code>AAICM7429L</code> | State: Karnataka (Code: 29)
                      </div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ background: '#0f766e', color: '#ffffff', padding: '4px 14px', borderRadius: 4, fontWeight: 800, fontSize: 13, display: 'inline-block', textTransform: 'uppercase' }}>
                      GRN IN-WORD
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: '#0f172a', marginTop: 6 }}>
                      GRN #: {grnDisplayNum}
                    </div>
                    <div style={{ fontSize: 11, color: '#64748b' }}>
                      Date: <strong>{inwardVoucher.date || inwardVoucher.inward_date || inwardVoucher.created_at ? new Date(inwardVoucher.date || inwardVoucher.inward_date || inwardVoucher.created_at).toLocaleDateString('en-IN') : new Date().toLocaleDateString('en-IN')}</strong>
                    </div>
                    <div style={{ fontSize: 11, color: '#059669', fontWeight: 700 }}>
                      ✓ ORIGINAL FOR STORE & ACCOUNTS
                    </div>
                  </div>
                </div>

                {/* 2-Column Info Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 14, marginBottom: 16 }}>
                  <div style={{ background: '#f8fafc', padding: 12, borderRadius: 6, border: '1px solid #e2e8f0', fontSize: 12 }}>
                    <div style={{ fontWeight: 800, color: '#0f766e', marginBottom: 6, textTransform: 'uppercase', fontSize: 11 }}>
                      🏢 SUPPLIER / VENDOR PARTICULAR DETAILS
                    </div>
                    <div style={{ fontSize: 11, color: '#334155' }}>
                      Supplier Name: <strong>{inwardVoucher.vendorName || (inwardVoucher.remarks?.includes('Party:') ? inwardVoucher.remarks.split('Party:')[1]?.split('|')[0]?.trim() : 'Registered Vendor')}</strong>
                    </div>
                    <div style={{ fontSize: 11, color: '#334155' }}>
                      Party Name: <strong>{inwardVoucher.partyName || inwardVoucher.vendorName || '—'}</strong>
                    </div>
                    <div style={{ fontSize: 11, color: '#334155' }}>
                      Address: <strong>{inwardVoucher.vendorAddress || '—'}</strong>
                    </div>
                    <div style={{ fontSize: 11, color: '#334155' }}>
                      Cell No: <strong>{inwardVoucher.vendorMobile || inwardVoucher.vendorPhone || '—'}</strong>
                    </div>
                    <div style={{ fontSize: 11, color: '#334155', marginTop: 3 }}>
                      GST No: <strong>{inwardVoucher.vendorGstin || 'Unregistered / Exempt'}</strong>
                    </div>
                    {inwardVoucher.vendorCode && <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>Vendor Code: <code>{inwardVoucher.vendorCode}</code></div>}
                    <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                      GST Mode: <span style={{ fontWeight: 700, color: isInterState ? '#d97706' : '#0f766e' }}>{isInterState ? 'Inter-State (IGST Applicable)' : 'Intra-State (CGST + SGST Applicable)'}</span> · State of Supply: <strong>{inwardVoucher.vendorState || (isInterState ? 'Inter-State' : 'Karnataka (Code 29)')}</strong>
                    </div>
                  </div>

                  <div style={{ background: '#f8fafc', padding: 12, borderRadius: 6, border: '1px solid #e2e8f0', fontSize: 12 }}>
                    <div style={{ fontWeight: 800, color: '#0f766e', marginBottom: 6, textTransform: 'uppercase', fontSize: 11 }}>
                      📋 LOGISTICS & INSPECTION REFERENCES
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 4 }}>
                      <span style={{ color: '#64748b' }}>P.O. No:</span>
                      <strong>{inwardVoucher.poNumber || inwardVoucher.po_number || inwardVoucher.reference_id || '—'}</strong>

                      <span style={{ color: '#64748b' }}>P.O. Date:</span>
                      <strong>{(inwardVoucher.poDate || inwardVoucher.po_date) ? new Date(inwardVoucher.poDate || inwardVoucher.po_date).toLocaleDateString('en-IN') : '—'}</strong>

                      <span style={{ color: '#64748b' }}>P.R. No:</span>
                      <strong>{inwardVoucher.prNumber || inwardVoucher.pr_number || '—'}</strong>

                      <span style={{ color: '#64748b' }}>P.R. Date:</span>
                      <strong>{(inwardVoucher.prDate || inwardVoucher.pr_date) ? new Date(inwardVoucher.prDate || inwardVoucher.pr_date).toLocaleDateString('en-IN') : '—'}</strong>

                      <span style={{ color: '#64748b' }}>Department:</span>
                      <strong>{inwardVoucher.department || inwardVoucher.departmentName || '—'}</strong>

                      <span style={{ color: '#64748b' }}>Payment Period:</span>
                      <strong>{inwardVoucher.paymentPeriod || inwardVoucher.payment_period || inwardVoucher.paymentTerms || '—'}</strong>

                      <span style={{ color: '#64748b' }}>Storage Bin/Rack:</span>
                      <strong>{inwardVoucher.bin_location || 'Main Store Floor (Rack M-1)'}</strong>
                      
                      <span style={{ color: '#64748b' }}>Batch/Serial #:</span>
                      <strong>{inwardVoucher.batch_number || 'LOT-2026-AUG'}</strong>

                      <span style={{ color: '#64748b' }}>QC Inspection:</span>
                      <span style={{ color: '#059669', fontWeight: 700 }}>✓ Passed Quality Inspection</span>
                    </div>
                  </div>
                </div>

                {/* Comprehensive Line Items Table with CGST, SGST, IGST Breakdown */}
                <div style={{ border: '1px solid #cbd5e1', borderRadius: 6, overflow: 'hidden', marginBottom: 16 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                    <thead>
                      <tr style={{ background: '#f1f5f9', borderBottom: '2px solid #0f766e', color: '#0f766e', fontWeight: 800, textAlign: 'left' }}>
                        <th style={{ padding: '8px 6px', width: 40, textAlign: 'center' }}>S.NO</th>
                        <th style={{ padding: '8px 6px', width: 90 }}>Item Code</th>
                        <th style={{ padding: '8px 6px' }}>Product Name</th>
                        <th style={{ padding: '8px 6px', width: 65, textAlign: 'right' }}>Qty</th>
                        <th style={{ padding: '8px 6px', width: 75, textAlign: 'right' }}>Rate/Price</th>
                        <th style={{ padding: '8px 6px', width: 65, textAlign: 'right' }}>Discount %</th>
                        <th style={{ padding: '8px 6px', width: 65, textAlign: 'right' }}>GST %</th>
                        <th style={{ padding: '8px 6px', width: 95, textAlign: 'right' }}>Total Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                        <td style={{ padding: '8px 6px', textAlign: 'center', color: '#64748b' }}>1</td>
                        <td style={{ padding: '8px 6px' }}><code>{inwardVoucher.materialCode}</code></td>
                        <td style={{ padding: '8px 6px' }}>
                          <div style={{ fontWeight: 700, color: '#0f172a' }}>{inwardVoucher.materialName}</div>
                          <div style={{ fontSize: 10, color: '#64748b', display: 'flex', gap: 6, marginTop: 1 }}>
                            {inwardVoucher.categoryName && <span>Cat: {inwardVoucher.categoryName}</span>}
                          </div>
                        </td>
                        <td style={{ padding: '8px 6px', textAlign: 'right', fontWeight: 700, color: '#16a34a' }}>{qty.toFixed(3)} {inwardVoucher.uom}</td>
                        <td style={{ padding: '8px 6px', textAlign: 'right' }}>₹{price.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                        <td style={{ padding: '8px 6px', textAlign: 'right' }}>{discPct > 0 ? discPct.toFixed(2) : '0.00'}</td>
                        <td style={{ padding: '8px 6px', textAlign: 'right' }}>{isInterState ? igstPct : (cgstPct + sgstPct)}%</td>
                        <td style={{ padding: '8px 6px', textAlign: 'right', fontWeight: 800, color: '#0f766e' }}>₹{grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Bank Details & Tax Matrix Summary Box (Bank Details left of Totals, per reference GRN format) */}
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 14, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6, padding: '12px 16px', marginBottom: 16 }}>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 800, color: '#0f766e', textTransform: 'uppercase', marginBottom: 4 }}>
                      🏦 Bank Details
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '2px 10px', fontSize: 12 }}>
                      <span style={{ color: '#64748b' }}>Bank Name:</span>
                      <strong>{inwardVoucher.bankName || 'HDFC Bank Ltd.'}</strong>
                      <span style={{ color: '#64748b' }}>Account Number:</span>
                      <strong>{inwardVoucher.bankAccountNumber || '50200067891234'}</strong>
                      <span style={{ color: '#64748b' }}>IFSC Code:</span>
                      <strong>{inwardVoucher.bankIfsc || 'HDFC0001234'}</strong>
                      <span style={{ color: '#64748b' }}>Branch Name:</span>
                      <strong>{inwardVoucher.bankBranch || 'Main Branch'}</strong>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#64748b' }}>Sub Total:</span>
                      <strong>₹{grossValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                    </div>
                    {discAmt > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#b45309' }}>Discount:</span>
                        <span style={{ color: '#b45309' }}>– ₹{discAmt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#64748b' }}>Sub Total:</span>
                      <strong>₹{taxable.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                    </div>
                    {!isInterState ? (
                      <>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: '#64748b' }}>SGST ({sgstPct}%):</span>
                          <span>₹{sgstAmt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: '#64748b' }}>CGST ({cgstPct}%):</span>
                          <span>₹{cgstAmt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                        </div>
                      </>
                    ) : (
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#d97706' }}>IGST ({igstPct}%):</span>
                        <span style={{ color: '#d97706', fontWeight: 600 }}>₹{igstAmt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '2px solid #0f766e', paddingTop: 4, fontSize: 14 }}>
                      <span style={{ fontWeight: 800, color: '#0f766e' }}>Total Purchase Amount:</span>
                      <span style={{ fontWeight: 900, color: '#0f766e' }}>₹{grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                  </div>
                </div>

                {/* Amount Chargeable in Words (below Bank Details / Totals block, per reference GRN format) */}
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6, padding: '12px 16px', marginBottom: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: '#0f766e', textTransform: 'uppercase', marginBottom: 4 }}>
                    AMOUNT CHARGEABLE IN WORDS:
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', fontStyle: 'italic' }}>
                    {numberToWords(grandTotal)}
                  </div>
                  <div style={{ fontSize: 10, color: '#64748b', marginTop: 8 }}>
                    Certified that all items listed in this Goods Receipt Note have been physically verified, counted, quality inspected, and recorded in live store inventory.
                  </div>
                </div>

                {/* 4 Official Signatures */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, paddingTop: 16, borderTop: '1px solid #cbd5e1', textAlign: 'center', fontSize: 11, marginTop: 24 }}>
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
              </div>
            </div>
          </div>
        )
      })()}

      {/* ── MODAL: PRINTABLE OUTWARD VOUCHER ── */}
      {outwardVoucher && (
        <div style={S.overlay}>
          <div id="print-document" className="print-watermark-container" style={{ ...S.modal, maxWidth: 550, background: '#fff', position: 'relative', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, borderBottom: '2px dashed #e7e6df', paddingBottom: 12, marginBottom: 14, position: 'relative', zIndex: 1 }}>
              <img src={LOGO_DATA_URI} alt="Logo" style={{ height: 38, width: 'auto', maxWidth: 120, objectFit: 'contain', borderRadius: 4, background: '#fff', padding: 2 }} />
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#0f766e' }}>SRI M.K. PAPER MILLS PVT LTD</div>
                <div style={{ fontSize: 12, color: '#475569', fontWeight: 600 }}>STORE ISSUE VOUCHER (SIV SLIP)</div>
                <div style={{ fontSize: 11, color: '#64748b' }}>Date: {outwardVoucher.date || outwardVoucher.outward_date || outwardVoucher.created_at ? new Date(outwardVoucher.date || outwardVoucher.outward_date || outwardVoucher.created_at).toLocaleDateString('en-IN') : new Date().toLocaleDateString('en-IN')} | Ref: {outwardVoucher.reference_id || 'SIV-'+outwardVoucher.id}</div>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13 }}>
              <div className="invoice-line"><b>Material:</b> {outwardVoucher.materialName} ({outwardVoucher.materialCode})</div>
              <div className="invoice-line"><b>Category:</b> {outwardVoucher.categoryName || 'General'}</div>
              <div className="invoice-line"><b>Issued Quantity:</b> <span className="invoice-line-value" style={{ color: '#dc2626', fontWeight: 700 }}>{outwardVoucher.out_qty} {outwardVoucher.uom}</span></div>
              <div className="invoice-line"><b>Store Balance Remaining:</b> <span className="invoice-line-value">{outwardVoucher.balance} {outwardVoucher.uom}</span></div>
              <div className="invoice-line"><b>Valuation:</b> <span className="invoice-line-value">₹{Number(outwardVoucher.value || 0).toLocaleString('en-IN')}</span></div>
              <div className="invoice-line"><b>Issued For / Remarks:</b> {outwardVoucher.remarks || '—'}</div>
              <div className="invoice-line"><b>Issued By:</b> {outwardVoucher.createdByName || 'Store Keeper'}</div>
            </div>
            <div className="no-print" style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
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

              {editInwardModal.grnId && (
                <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#0f766e', textTransform: 'uppercase', marginBottom: 8 }}>
                    GRN {editInwardModal.grnNumber} — Header Details
                    {editInwardModal.grnStatus && (editInwardModal.grnStatus === 'Cancelled' || editInwardModal.grnStatus === 'Closed') && (
                      <span style={{ marginLeft: 8, color: '#dc2626', fontWeight: 600 }}>({editInwardModal.grnStatus} — needs elevated access to edit)</span>
                    )}
                  </div>
                  <div style={S.grid2}>
                    <div>
                      <label style={S.label}>Vehicle Number</label>
                      <input style={S.input} value={editInwardForm.grn_vehicle_number} onChange={e => setEditInwardForm({ ...editInwardForm, grn_vehicle_number: e.target.value })} />
                    </div>
                    <div>
                      <label style={S.label}>Challan Number</label>
                      <input style={S.input} value={editInwardForm.grn_challan_number} onChange={e => setEditInwardForm({ ...editInwardForm, grn_challan_number: e.target.value })} />
                    </div>
                  </div>
                  <div>
                    <label style={S.label}>Invoice Number</label>
                    <input style={S.input} value={editInwardForm.grn_invoice_number} onChange={e => setEditInwardForm({ ...editInwardForm, grn_invoice_number: e.target.value })} />
                  </div>
                </div>
              )}

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
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <input type="number" step="0.01" style={{ ...S.input, flex: 1 }} value={form.quantity} onChange={e => setForm({ ...form, quantity: e.target.value })} required />
                <span style={{ fontSize: 13, fontWeight: 700, color: '#0f766e', minWidth: 45 }}>
                  {mats.find(m => String(m.id) === String(form.materialId))?.uom || 'NOS'}
                </span>
              </div>

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
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <input type="number" step="0.01" style={{ ...S.input, flex: 1 }} value={editForm.quantity} onChange={e => setEditForm({ ...editForm, quantity: e.target.value })} required />
                <span style={{ fontSize: 13, fontWeight: 700, color: '#0f766e', minWidth: 45 }}>
                  {mats.find(m => String(m.id) === String(editForm.materialId))?.uom || 'NOS'}
                </span>
              </div>

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

      {/* RTV Dispatch Outward Gate Pass Modal */}
      {rtvDispatchModal && (
        <div style={S.overlay}>
          <div style={{ ...S.modal, maxWidth: 540 }}>
            <div style={S.modalHdr}>
              <div>
                <b>🚚 Dispatch Return to Vendor (RTV)</b>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                  Rejection #{rtvDispatchModal.rejection_number} | Material: {rtvDispatchModal.materialName} ({rtvDispatchModal.rejected_qty} {rtvDispatchModal.uom})
                </div>
              </div>
              <button style={S.x} onClick={() => setRtvDispatchModal(null)}>✕</button>
            </div>
            <form onSubmit={handleDispatchRtv} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ background: '#fee2e2', padding: 10, borderRadius: 8, fontSize: 12, color: '#991b1b' }}>
                Generating Outward Gate Pass will allow the vendor truck to exit with the rejected goods and close the store quarantine holding.
              </div>
              <div>
                <label style={S.label}>Transport Vehicle Number *</label>
                <input
                  style={S.input}
                  placeholder="e.g. MH 12 AB 9876"
                  value={rtvDispatchForm.vehicleNumber}
                  onChange={e => setRtvDispatchForm({ ...rtvDispatchForm, vehicleNumber: e.target.value })}
                  required
                />
              </div>
              <div>
                <label style={S.label}>Driver Name</label>
                <input
                  style={S.input}
                  placeholder="Driver Name"
                  value={rtvDispatchForm.driverName}
                  onChange={e => setRtvDispatchForm({ ...rtvDispatchForm, driverName: e.target.value })}
                />
              </div>
              <div>
                <label style={S.label}>Dispatch Remarks / E-Way Bill</label>
                <textarea
                  style={{ ...S.input, height: 60 }}
                  placeholder="RTV Dispatch Remarks"
                  value={rtvDispatchForm.remarks}
                  onChange={e => setRtvDispatchForm({ ...rtvDispatchForm, remarks: e.target.value })}
                />
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
                <button type="button" style={S.btnGhost} onClick={() => setRtvDispatchModal(null)}>Cancel</button>
                <button type="submit" style={{ ...S.btn, background: '#ea580c' }}>Generate RTV Outward Gate Pass</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Inter-Store Transfer (STO) Modal */}
      {transferModal && (
        <div style={S.overlay}>
          <div style={{ ...S.modal, maxWidth: 680 }}>
            <div style={S.modalHdr}>
              <b>🔄 Create Inter-Store Transfer Order (STO)</b>
              <button style={S.x} onClick={() => setTransferModal(false)}>✕</button>
            </div>
            <form onSubmit={handleCreateTransfer} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={S.grid2}>
                <div>
                  <label style={S.label}>Source Warehouse (Issuing) *</label>
                  <select
                    style={S.select}
                    value={transferForm.fromWarehouseId}
                    onChange={e => setTransferForm({ ...transferForm, fromWarehouseId: e.target.value })}
                    required
                  >
                    <option value="">-- Select Source Warehouse --</option>
                    {warehouses.map(w => (
                      <option key={w.id} value={w.id}>{w.name || w.code} ({w.type || 'Store'})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={S.label}>Destination Warehouse (Receiving) *</label>
                  <select
                    style={S.select}
                    value={transferForm.toWarehouseId}
                    onChange={e => setTransferForm({ ...transferForm, toWarehouseId: e.target.value })}
                    required
                  >
                    <option value="">-- Select Destination Warehouse --</option>
                    {warehouses.filter(w => String(w.id) !== String(transferForm.fromWarehouseId)).map(w => (
                      <option key={w.id} value={w.id}>{w.name || w.code} ({w.type || 'Store'})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#1b1b1d', marginBottom: 6 }}>Transfer Item(s)</div>
                {transferForm.items.map((it, idx) => (
                  <div key={idx} style={{ background: '#f8fafc', padding: 10, borderRadius: 8, border: '1px solid #e2e8f0', display: 'flex', gap: 8, alignItems: 'center' }}>
                    <select
                      style={{ ...S.select, flex: 2 }}
                      value={it.materialId}
                      onChange={e => {
                        const next = [...transferForm.items]
                        next[idx].materialId = e.target.value
                        const m = mats.find(x => String(x.id) === String(e.target.value))
                        if (m) next[idx].uom = m.uom || m.unit || 'NOS'
                        setTransferForm({ ...transferForm, items: next })
                      }}
                      required
                    >
                      <option value="">-- Select Material --</option>
                      {mats.map(m => (
                        <option key={m.id} value={m.id}>{m.name} ({m.code || 'No Code'}) - Stock: {m.current_stock || 0}</option>
                      ))}
                    </select>
                    <input
                      style={{ ...S.input, width: 100 }}
                      type="number"
                      step="any"
                      placeholder="Qty"
                      value={it.qty}
                      onChange={e => {
                        const next = [...transferForm.items]
                        next[idx].qty = e.target.value
                        setTransferForm({ ...transferForm, items: next })
                      }}
                      required
                    />
                    <span style={{ fontSize: 12, color: '#64748b', minWidth: 40 }}>{it.uom}</span>
                  </div>
                ))}
              </div>

              <div>
                <label style={S.label}>Remarks / Transport Note</label>
                <textarea
                  style={{ ...S.input, height: 50 }}
                  placeholder="Inter-store movement justification"
                  value={transferForm.remarks}
                  onChange={e => setTransferForm({ ...transferForm, remarks: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
                <button type="button" style={S.btnGhost} onClick={() => setTransferModal(false)}>Cancel</button>
                <button type="submit" style={{ ...S.btn, background: '#0284c7' }}>Create Transfer Order</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Raise Store Return Voucher (SRV) Modal */}
      {returnModal && (
        <div style={S.overlay}>
          <div style={{ ...S.modal, maxWidth: 680 }}>
            <div style={S.modalHdr}>
              <b>↩️ Raise Store Return Voucher (SRV)</b>
              <button style={S.x} onClick={() => setReturnModal(false)}>✕</button>
            </div>
            <form onSubmit={handleCreateReturn} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={S.grid2}>
                <div>
                  <label style={S.label}>Returning Department *</label>
                  <select
                    style={S.select}
                    value={returnForm.departmentId}
                    onChange={e => setReturnForm({ ...returnForm, departmentId: e.target.value })}
                    required
                  >
                    <option value="">-- Select Department --</option>
                    {depts.map(d => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={S.label}>Original Indent / Issue Ref (Optional)</label>
                  <select
                    style={S.select}
                    value={returnForm.indentId}
                    onChange={e => setReturnForm({ ...returnForm, indentId: e.target.value })}
                  >
                    <option value="">-- Direct Plant Return --</option>
                    {issues.slice(0, 30).map(iss => (
                      <option key={iss.id} value={iss.id}>{iss.issue_number || iss.issueNumber} — {iss.materialName}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#1b1b1d', marginBottom: 6 }}>Returned Item Details</div>
                {returnForm.items.map((it, idx) => (
                  <div key={idx} style={{ background: '#f8fafc', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <select
                        style={{ ...S.select, flex: 2 }}
                        value={it.materialId}
                        onChange={e => {
                          const next = [...returnForm.items]
                          next[idx].materialId = e.target.value
                          const m = mats.find(x => String(x.id) === String(e.target.value))
                          if (m) next[idx].uom = m.uom || m.unit || 'NOS'
                          setReturnForm({ ...returnForm, items: next })
                        }}
                        required
                      >
                        <option value="">-- Select Material --</option>
                        {mats.map(m => (
                          <option key={m.id} value={m.id}>{m.name} ({m.code || 'No Code'})</option>
                        ))}
                      </select>
                      <input
                        style={{ ...S.input, width: 100 }}
                        type="number"
                        step="any"
                        placeholder="Qty"
                        value={it.qty}
                        onChange={e => {
                          const next = [...returnForm.items]
                          next[idx].qty = e.target.value
                          setReturnForm({ ...returnForm, items: next })
                        }}
                        required
                      />
                      <span style={{ fontSize: 12, color: '#64748b', alignSelf: 'center', minWidth: 40 }}>{it.uom}</span>
                    </div>

                    <div style={S.grid2}>
                      <div>
                        <label style={{ fontSize: 11, color: '#64748b' }}>Condition Grade</label>
                        <select
                          style={S.select}
                          value={it.conditionGrade}
                          onChange={e => {
                            const next = [...returnForm.items]
                            next[idx].conditionGrade = e.target.value
                            setReturnForm({ ...returnForm, items: next })
                          }}
                        >
                          <option value="Good">Good (Restock immediately to Store)</option>
                          <option value="Repairable">Repairable (Quarantine / Workshop)</option>
                          <option value="Scrap">Scrap (Non-reusable)</option>
                        </select>
                      </div>
                      <div>
                        <label style={{ fontSize: 11, color: '#64748b' }}>Item Remarks</label>
                        <input
                          style={S.input}
                          placeholder="e.g. Unused excess from PM2 Maintenance"
                          value={it.remarks}
                          onChange={e => {
                            const next = [...returnForm.items]
                            next[idx].remarks = e.target.value
                            setReturnForm({ ...returnForm, items: next })
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div>
                <label style={S.label}>Overall Return Reason</label>
                <textarea
                  style={{ ...S.input, height: 50 }}
                  placeholder="Department reason for return"
                  value={returnForm.remarks}
                  onChange={e => setReturnForm({ ...returnForm, remarks: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
                <button type="button" style={S.btnGhost} onClick={() => setReturnModal(false)}>Cancel</button>
                <button type="submit" style={{ ...S.btn, background: '#16a34a' }}>Submit Return Voucher</button>
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

      {/* ── ENTERPRISE INVENTORY EXCEL EXPORTER MODAL ── */}
      <InventoryExportModal
        isOpen={exportModal}
        onClose={() => setExportModal(false)}
      />

      {/* ── MODAL: MASTER CONSOLIDATED MULTI-ITEM GRN VIEWER ── */}
      {masterGrnModal && (
        <div style={S.overlay}>
          <div style={{ ...S.modal, maxWidth: 1000, background: '#ffffff', color: '#0f172a', padding: 24 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #0f766e', paddingBottom: 12, marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 24 }}>📥</span>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 900, color: '#0f766e' }}>
                    Master Goods Receipt Note (GRN) — #{masterGrnModal.grnNumber || masterGrnModal.grn_number || `GRN-${masterGrnModal.id}`}
                  </div>
                  <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>
                    Consolidated Receipt · All line items under single receipt voucher
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={() => openA3Invoice(masterGrnModal)}
                  style={{ background: '#0f766e', color: '#fff', border: 'none', borderRadius: 6, padding: '7px 14px', fontSize: 12, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  🖨️ Print Official A3 GRN Invoice
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAppendGrnModal(masterGrnModal)
                    setAppendGrnForm({
                      material_id: '',
                      received_qty: '1',
                      unit_price: '',
                      discount_pct: 0,
                      other_charges: 0,
                      tax_type: 'intra',
                      gst_pct: 18,
                      bin_location: '',
                      batch_number: '',
                      mrp: '',
                      trade_price: '',
                      remarks: ''
                    })
                  }}
                  style={{ background: '#0284c7', color: '#fff', border: 'none', borderRadius: 6, padding: '7px 14px', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}
                >
                  ＋ Append Line Item
                </button>
                <button
                  type="button"
                  onClick={() => setMasterGrnModal(null)}
                  style={{ background: '#e2e8f0', color: '#334155', border: 'none', borderRadius: 6, padding: '7px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                >
                  ✕ Close
                </button>
              </div>
            </div>

            {/* GRN Header Meta */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, background: '#f8fafc', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12, marginBottom: 14 }}>
              <div>
                <span style={{ color: '#64748b' }}>Receipt Date:</span><br />
                <strong>{masterGrnModal.date ? new Date(masterGrnModal.date).toLocaleDateString('en-IN') : '—'}</strong>
              </div>
              <div>
                <span style={{ color: '#64748b' }}>Vendor / Supplier:</span><br />
                <strong>{masterGrnModal.vendorName || 'Registered Vendor'}</strong>
                {masterGrnModal.vendorGstin && <div style={{ fontSize: 10, color: '#0f766e' }}>GSTIN: {masterGrnModal.vendorGstin}</div>}
              </div>
              <div>
                <span style={{ color: '#64748b' }}>PO / Challan / Inv Ref:</span><br />
                <strong>{masterGrnModal.poNumber || masterGrnModal.invoice_number || masterGrnModal.challan_number || 'Direct Inward'}</strong>
              </div>
              <div>
                <span style={{ color: '#64748b' }}>Vehicle / Gate Pass:</span><br />
                <strong>{masterGrnModal.vehicle_number || masterGrnModal.gatePassNumber || 'Mill Gate Entry'}</strong>
              </div>
            </div>

            {/* Complete Line Items Table */}
            <div style={{ fontWeight: 800, fontSize: 12, color: '#0f766e', marginBottom: 6, textTransform: 'uppercase' }}>
              Consolidated Received Items ({(masterGrnModal.items || []).length})
            </div>
            <div style={{ border: '1px solid #cbd5e1', borderRadius: 6, overflow: 'hidden', marginBottom: 14 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                <thead>
                  <tr style={{ background: '#f1f5f9', borderBottom: '2px solid #0f766e', color: '#0f766e', fontWeight: 800, textAlign: 'left' }}>
                    <th style={{ padding: '7px 6px', width: 30, textAlign: 'center' }}>#</th>
                    <th style={{ padding: '7px 6px' }}>Material Description</th>
                    <th style={{ padding: '7px 6px', width: 70 }}>HSN Code</th>
                    <th style={{ padding: '7px 6px', width: 45, textAlign: 'center' }}>UOM</th>
                    <th style={{ padding: '7px 6px', width: 65, textAlign: 'right' }}>Recv Qty</th>
                    <th style={{ padding: '7px 6px', width: 75, textAlign: 'right' }}>Unit Rate</th>
                    <th style={{ padding: '7px 6px', width: 55, textAlign: 'center' }}>GST%</th>
                    <th style={{ padding: '7px 6px', width: 80, textAlign: 'right' }}>Taxable Val</th>
                    <th style={{ padding: '7px 6px', width: 85, textAlign: 'right' }}>Line Total (₹)</th>
                    <th style={{ padding: '7px 6px', width: 80 }}>Batch / Bin</th>
                  </tr>
                </thead>
                <tbody>
                  {(masterGrnModal.items || []).map((it, idx) => {
                    const q = parseFloat(it.received_qty || it.in_qty || it.qty || 0)
                    const p = parseFloat(it.unit_price || it.trade_price || 0)
                    const taxVal = it.taxable_amount ? parseFloat(it.taxable_amount) : (q * p)
                    const lineTot = it.total_amount ? parseFloat(it.total_amount) : (taxVal * (1 + (parseFloat(it.gst_pct || 18) / 100)))
                    return (
                      <tr key={it.id || idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                        <td style={{ padding: '7px 6px', textAlign: 'center', color: '#64748b' }}>{idx + 1}</td>
                        <td style={{ padding: '7px 6px' }}>
                          <strong style={{ color: '#0f172a' }}>{it.materialName}</strong>
                          <div style={{ fontSize: 10, color: '#64748b' }}>Code: {it.materialCode}</div>
                        </td>
                        <td style={{ padding: '7px 6px', fontFamily: 'monospace' }}>{it.hsnCode || it.hsn_code || '8439'}</td>
                        <td style={{ padding: '7px 6px', textAlign: 'center' }}>{it.matUom || it.uom}</td>
                        <td style={{ padding: '7px 6px', textAlign: 'right', fontWeight: 800, color: '#16a34a' }}>{q.toFixed(2)}</td>
                        <td style={{ padding: '7px 6px', textAlign: 'right' }}>₹{p.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                        <td style={{ padding: '7px 6px', textAlign: 'center' }}>{it.gst_pct || 18}%</td>
                        <td style={{ padding: '7px 6px', textAlign: 'right', fontWeight: 700 }}>₹{taxVal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                        <td style={{ padding: '7px 6px', textAlign: 'right', fontWeight: 900, color: '#0f766e' }}>₹{lineTot.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                        <td style={{ padding: '7px 6px', fontSize: 10 }}>
                          <div><code>{it.batch_number || 'LOT-AUTO'}</code></div>
                          <div style={{ color: '#64748b' }}>{it.bin_location || 'Rack 1'}</div>
                        </td>
                      </tr>
                    )
                  })}
                  {(!masterGrnModal.items || masterGrnModal.items.length === 0) && (
                    <tr><td colSpan={10} style={{ padding: 20, textAlign: 'center', color: '#64748b' }}>No line items attached to this GRN header.</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                type="button"
                onClick={() => openA3Invoice(masterGrnModal)}
                style={{ background: '#0f766e', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 18px', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
              >
                🖨️ Open Full A3 Print Preview
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: APPEND LINE ITEM TO ACTIVE GRN ── */}
      {appendGrnModal && (
        <div style={S.overlay}>
          <div style={{ ...S.modal, maxWidth: 650 }} onClick={e => e.stopPropagation()}>
            <div style={S.modalHdr}>
              <b>＋ Append New Line Item to GRN #{appendGrnModal.grnNumber || appendGrnModal.grn_number}</b>
              <button style={S.x} onClick={() => setAppendGrnModal(null)}>✕</button>
            </div>
            <form onSubmit={handleAppendGrnItem} style={S.form}>
              <div>
                <label style={S.label}>Select Material / Item *</label>
                <select
                  style={S.select}
                  value={appendGrnForm.material_id}
                  onChange={e => {
                    const selMat = mats.find(m => String(m.id) === String(e.target.value))
                    setAppendGrnForm({
                      ...appendGrnForm,
                      material_id: e.target.value,
                      unit_price: selMat?.unit_price || appendGrnForm.unit_price,
                      bin_location: selMat?.bin_location || appendGrnForm.bin_location
                    })
                  }}
                  required
                >
                  <option value="">-- Choose Material to Receive --</option>
                  {mats.map(m => (
                    <option key={m.id} value={m.id}>{m.name} [{m.code}] (Stock: {m.current_stock} {m.uom})</option>
                  ))}
                </select>
              </div>

              <div style={S.grid2}>
                <div>
                  <label style={S.label}>Received Qty *</label>
                  <input
                    type="number"
                    step="0.001"
                    min="0.001"
                    style={S.input}
                    value={appendGrnForm.received_qty}
                    onChange={e => setAppendGrnForm({ ...appendGrnForm, received_qty: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label style={S.label}>Unit Rate / Trade Price (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    style={S.input}
                    value={appendGrnForm.unit_price}
                    onChange={e => setAppendGrnForm({ ...appendGrnForm, unit_price: e.target.value })}
                  />
                </div>
              </div>

              <div style={S.grid2}>
                <div>
                  <label style={S.label}>GST Slab</label>
                  <select
                    style={S.select}
                    value={appendGrnForm.gst_pct}
                    onChange={e => setAppendGrnForm({ ...appendGrnForm, gst_pct: Number(e.target.value) })}
                  >
                    {GST_SLABS.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={S.label}>Discount %</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    style={S.input}
                    value={appendGrnForm.discount_pct}
                    onChange={e => setAppendGrnForm({ ...appendGrnForm, discount_pct: e.target.value })}
                  />
                </div>
              </div>

              <div style={S.grid2}>
                <div>
                  <label style={S.label}>Batch / Lot Number</label>
                  <input
                    style={S.input}
                    placeholder="e.g. OPB-ITM-001"
                    value={appendGrnForm.batch_number}
                    onChange={e => setAppendGrnForm({ ...appendGrnForm, batch_number: e.target.value })}
                  />
                </div>
                <div>
                  <label style={S.label}>Storage Bin / Rack Location</label>
                  <input
                    style={S.input}
                    placeholder="e.g. Rack A-12"
                    value={appendGrnForm.bin_location}
                    onChange={e => setAppendGrnForm({ ...appendGrnForm, bin_location: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label style={S.label}>Item Remarks / Inspection Note</label>
                <input
                  style={S.input}
                  placeholder="Remarks..."
                  value={appendGrnForm.remarks}
                  onChange={e => setAppendGrnForm({ ...appendGrnForm, remarks: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 10 }}>
                <button type="button" style={S.btnGhost} onClick={() => setAppendGrnModal(null)}>Cancel</button>
                <button type="submit" style={{ ...S.btn, background: '#0f766e' }} disabled={appendGrnSaving}>
                  {appendGrnSaving ? 'Appending...' : 'Confirm & Append to GRN'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: DEPARTMENT RECEIVER SIGN & HANDOVER ── */}
      {receiverModal && (
        <div style={S.overlay}>
          <div style={{ ...S.modal, maxWidth: 550, color: '#0f172a' }} onClick={e => e.stopPropagation()}>
            <div style={S.modalHdr}>
              <div>
                <b>✍️ Department Receiver Signature &amp; Handover</b>
                <div style={S.muted}>
                  {receiverModal.name} · {receiverModal.qty} {receiverModal.uom}
                </div>
              </div>
              <button style={S.x} onClick={() => setReceiverModal(null)}>✕</button>
            </div>
            <form onSubmit={handleReceiverSignSubmit} style={S.form}>
              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: 12, fontSize: 12 }}>
                <div style={{ fontWeight: 800, color: '#166534', marginBottom: 4 }}>
                  4-Step Lifecycle Step 4: Receiver Sign-off
                </div>
                <div style={{ color: '#334155' }}>
                  Dept Request → Approval SM → Store Keeper Issue → <strong>Receiver Sign &amp; Fitment</strong> → Closed.
                </div>
              </div>

              <div style={S.grid2}>
                <div>
                  <label style={S.label}>Receiver Name *</label>
                  <input
                    style={S.input}
                    required
                    value={receiverForm.receiver_name}
                    onChange={e => setReceiverForm({ ...receiverForm, receiver_name: e.target.value })}
                  />
                </div>
                <div>
                  <label style={S.label}>Receiver Employee Code</label>
                  <input
                    style={S.input}
                    placeholder="e.g. EMP-1042"
                    value={receiverForm.receiver_emp_code}
                    onChange={e => setReceiverForm({ ...receiverForm, receiver_emp_code: e.target.value })}
                  />
                </div>
              </div>

              <div style={S.grid2}>
                <div>
                  <label style={S.label}>Fitment / Receipt Date</label>
                  <input
                    type="date"
                    style={S.input}
                    value={receiverForm.fitment_date}
                    onChange={e => setReceiverForm({ ...receiverForm, fitment_date: e.target.value })}
                  />
                </div>
                <div>
                  <label style={S.label}>Receiver Acknowledgment Note</label>
                  <input
                    style={S.input}
                    value={receiverForm.receiver_signature_note}
                    onChange={e => setReceiverForm({ ...receiverForm, receiver_signature_note: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label style={S.label}>Fitment Observations &amp; Machine Position (Optional)</label>
                <textarea
                  style={{ ...S.input, height: 60 }}
                  placeholder="e.g. Mounted on PM1 Rewinder shaft, running smoothly without vibration."
                  value={receiverForm.observations}
                  onChange={e => setReceiverForm({ ...receiverForm, observations: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
                <button type="button" style={S.btnGhost} onClick={() => setReceiverModal(null)}>Cancel</button>
                <button type="submit" style={{ ...S.btn, background: '#16a34a' }} disabled={receiverSaving}>
                  {receiverSaving ? 'Signing...' : '✓ Confirm Receiver Signature & Close'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: MASTER CONSOLIDATED GRN DETAILS ── */}
      {masterGrnModal && (
        <div style={S.overlay}>
          <div style={{ ...S.modal, maxWidth: 980, color: '#0f172a' }} onClick={e => e.stopPropagation()}>
            <div style={S.modalHdr}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <b style={{ fontSize: 17, color: '#0f766e' }}>
                    📦 Master Goods Receipt Note: {masterGrnModal.grn_number || masterGrnModal.grnNumber}
                  </b>
                  <span style={{ ...S.badge, background: '#ccfbf1', color: '#0f766e', fontWeight: 700 }}>
                    {masterGrnModal.items?.length || masterGrnModal.itemCount || 1} Items Clubbed
                  </span>
                </div>
                <div style={{ ...S.muted, marginTop: 4, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  <span><b>Vendor:</b> {masterGrnModal.vendorName || masterGrnModal.partyName || '—'} {masterGrnModal.vendorCode ? `(${masterGrnModal.vendorCode})` : ''}</span>
                  {masterGrnModal.vendorGstin && <span><b>GSTIN:</b> {masterGrnModal.vendorGstin}</span>}
                  {masterGrnModal.invoice_number && <span><b>Invoice:</b> {masterGrnModal.invoice_number}</span>}
                  <span><b>Date:</b> {masterGrnModal.date ? new Date(masterGrnModal.date).toLocaleDateString('en-IN') : '—'}</span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button
                  style={{ ...S.btnSm, background: '#0f766e', color: '#fff', fontWeight: 800, padding: '6px 12px', fontSize: 12 }}
                  onClick={() => openA3Invoice(masterGrnModal)}
                  title="Print Official A3 GST Commercial Invoice with all items"
                >
                  🖨️ Print A3 Slip ({masterGrnModal.items?.length || masterGrnModal.itemCount || 1} Items)
                </button>
                <button
                  style={{ ...S.btnSm, background: '#2563eb', color: '#fff', padding: '6px 12px', fontSize: 12 }}
                  onClick={() => setAppendGrnModal(masterGrnModal)}
                >
                  + Append Line Item
                </button>
                <button style={S.x} onClick={() => setMasterGrnModal(null)}>✕</button>
              </div>
            </div>

            {/* Items Table */}
            <div style={{ maxHeight: '55vh', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: 8, marginTop: 10 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', textAlign: 'left' }}>
                    <th style={{ padding: '8px 10px', width: 35 }}>#</th>
                    <th style={{ padding: '8px 10px', width: 120 }}>Item Code</th>
                    <th style={{ padding: '8px 10px' }}>Material Description</th>
                    <th style={{ padding: '8px 10px', width: 80 }}>HSN</th>
                    <th style={{ padding: '8px 10px', textAlign: 'right', width: 90 }}>Received Qty</th>
                    <th style={{ padding: '8px 10px', textAlign: 'right', width: 90 }}>Unit Rate</th>
                    <th style={{ padding: '8px 10px', textAlign: 'right', width: 100 }}>Taxable (₹)</th>
                    <th style={{ padding: '8px 10px', textAlign: 'center', width: 65 }}>GST %</th>
                    <th style={{ padding: '8px 10px', textAlign: 'right', width: 90 }}>GST (₹)</th>
                    <th style={{ padding: '8px 10px', textAlign: 'right', width: 110 }}>Total (₹)</th>
                    <th style={{ padding: '8px 10px', width: 100 }}>Batch / Rack</th>
                  </tr>
                </thead>
                <tbody>
                  {masterGrnModal.items && masterGrnModal.items.map((it, idx) => (
                    <tr key={it.id || idx} style={{ borderBottom: '1px solid #f1f5f9', background: idx % 2 === 0 ? '#fff' : '#fafafa' }}>
                      <td style={{ padding: '8px 10px', color: '#64748b' }}>{idx + 1}</td>
                      <td style={{ padding: '8px 10px', fontWeight: 700, color: '#0f766e' }}>{it.materialCode || it.code}</td>
                      <td style={{ padding: '8px 10px', fontWeight: 600 }}>{it.materialName || it.name}</td>
                      <td style={{ padding: '8px 10px', color: '#64748b' }}>{it.hsnCode || it.hsn_code || '—'}</td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, color: '#16a34a' }}>
                        {Number(it.received_qty || it.in_qty || 0).toFixed(3)} {it.uom || it.matUom || 'NOS'}
                      </td>
                      <td style={{ padding: '8px 10px', textAlign: 'right' }}>₹{Number(it.unit_price || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                      <td style={{ padding: '8px 10px', textAlign: 'right' }}>₹{Number(it.taxable_amount || ((it.received_qty || it.in_qty || 0) * (it.unit_price || 0))).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                      <td style={{ padding: '8px 10px', textAlign: 'center' }}>{it.gst_pct || 18}%</td>
                      <td style={{ padding: '8px 10px', textAlign: 'right' }}>₹{Number((it.cgst_amount || 0) + (it.sgst_amount || 0) + (it.igst_amount || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>
                        ₹{Number(it.total_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td style={{ padding: '8px 10px', color: '#64748b', fontSize: 11 }}>
                        {it.batch_number ? `B: ${it.batch_number}` : ''} {it.bin_location ? `· ${it.bin_location}` : ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ background: '#f1f5f9', fontWeight: 800, borderTop: '2px solid #cbd5e1' }}>
                    <td colSpan={4} style={{ padding: '10px 10px', textAlign: 'right' }}>Grand Total ({masterGrnModal.items?.length || 0} Items):</td>
                    <td style={{ padding: '10px 10px', textAlign: 'right', color: '#16a34a' }}>
                      {masterGrnModal.items?.reduce((s, it) => s + parseFloat(it.received_qty || it.in_qty || 0), 0).toFixed(3)}
                    </td>
                    <td></td>
                    <td style={{ padding: '10px 10px', textAlign: 'right' }}>
                      ₹{Number(masterGrnModal.total_taxable || masterGrnModal.items?.reduce((s, it) => s + parseFloat(it.taxable_amount || 0), 0) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td></td>
                    <td style={{ padding: '10px 10px', textAlign: 'right' }}>
                      ₹{Number(masterGrnModal.total_gst || masterGrnModal.items?.reduce((s, it) => s + (parseFloat(it.cgst_amount || 0) + parseFloat(it.sgst_amount || 0) + parseFloat(it.igst_amount || 0)), 0) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td style={{ padding: '10px 10px', textAlign: 'right', color: '#0f766e', fontSize: 14 }}>
                      ₹{Number(masterGrnModal.grand_total || masterGrnModal.total_value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 14 }}>
              <div style={{ fontSize: 11, color: '#64748b' }}>
                {masterGrnModal.remarks && <span><b>Remarks:</b> {masterGrnModal.remarks}</span>}
              </div>
              <button
                style={{ ...S.btn, background: '#0f766e', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                onClick={() => openA3Invoice(masterGrnModal)}
              >
                🖨️ Print Single Official Slip with All {masterGrnModal.items?.length || 0} Items
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: DEDICATED A3 GRN COMMERCIAL INVOICE PRINT MODAL (Pic 1 Exact Layout) ── */}
      {a3PrintDoc && (
        <A3InvoicePrintModal
          docData={a3PrintDoc}
          onClose={() => setA3PrintDoc(null)}
          title={a3PrintDoc.title || 'GRN INVOICE'}
        />
      )}

      {/* ── MODAL: SEQUENCE ENFORCEMENT POPUP ── */}
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
            if (targetStep === 3) {
              setTab('outward')
            }
          }}
        />
      )}
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
