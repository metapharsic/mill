import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import AgentStatusBanner from '../components/AgentStatusBanner'
import TableScrollWrapper from '../components/TableScrollWrapper'
import ScrollableTabs from '../components/ScrollableTabs'
import SearchableSelect from '../components/SearchableSelect'
import { LOGO_DATA_URI, LOGO_SRC } from '../utils/logo'
const API = (p, o) => fetch(p.startsWith('/api') ? p : `/api${p}`, { headers: { Authorization: `Bearer ${localStorage.getItem('mk_token')}`, 'Content-Type': 'application/json', ...(o?.headers || {}) }, ...o }).then(r => r.json())
const STATUS_COLOR = { Draft: '#8a8a90', Approved: '#22c55e', Sent: '#6366f1', Partial: '#f97316', Received: '#0ea5e9', Closed: '#64748b', Cancelled: '#ef4444' }
const fmt = v => v ? `₹${Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—'

export const GST_SLABS = [
  { value: 0,  label: '0% (Nil / Exempt)', cgst: 0, sgst: 0, igst: 0 },
  { value: 5,  label: '5% (CGST 2.5% + SGST 2.5% / IGST 5%)', cgst: 2.5, sgst: 2.5, igst: 5 },
  { value: 12, label: '12% (CGST 6% + SGST 6% / IGST 12%)', cgst: 6, sgst: 6, igst: 12 },
  { value: 18, label: '18% (Standard GST — CGST 9% + SGST 9% / IGST 18%)', cgst: 9, sgst: 9, igst: 18 },
  { value: 28, label: '28% (Higher Slab — CGST 14% + SGST 14% / IGST 28%)', cgst: 14, sgst: 14, igst: 28 },
]

// Indian currency number to words generator for Official POs
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

// Print styles injected into <head>
const PRINT_STYLE = `
@media print {
  body * { visibility: hidden !important; }
  #print-document, #print-document * { visibility: visible !important; }
  #print-document {
    position: absolute !important;
    left: 0 !important;
    top: 0 !important;
    width: 100% !important;
    margin: 0 !important;
    padding: 16px !important;
    background: #fff !important;
    color: #000 !important;
    box-shadow: none !important;
    border: none !important;
  }
  .no-print { display: none !important; }
  @page { margin: 12mm; size: A4 portrait; }
}
#print-document {
  position: relative !important;
}
#print-document::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 500px;
  height: 180px;
  background-image: url('${LOGO_DATA_URI}');
  background-repeat: no-repeat;
  background-position: center;
  background-size: contain;
  opacity: 0.065;
  pointer-events: none;
  z-index: 0;
}
`

function injectPrintStyle() {
  if (!document.getElementById('po-print-style')) {
    const s = document.createElement('style')
    s.id = 'po-print-style'
    s.textContent = PRINT_STYLE
    document.head.appendChild(s)
  }
}

function PrintFrame({ content, onClose }) {
  useEffect(() => {
    injectPrintStyle()
  }, [])

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(4px)', zIndex: 99999, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', overflowY: 'auto', padding: '24px 16px' }}>
      
      {/* Top Floating Control Bar (Hidden on print) */}
      <div className="no-print" style={{ background: '#1e293b', color: '#fff', padding: '10px 20px', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', maxWidth: 900, marginBottom: 16, boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <img src={LOGO_SRC} alt="Logo" style={{ width: 26, height: 26, objectFit: 'contain', borderRadius: 4, background: '#fff' }} />
          <div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>Official Mill Document Preview</div>
            <div style={{ fontSize: 11, color: '#94a3b8' }}>SRI M.K. PAPER MILLS PVT. LTD. · A4 Official Letterhead with Watermark</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => window.print()}
            style={{ background: '#0f766e', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 18px', fontWeight: 700, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
          >
            🖨 Print / Save PDF
          </button>
          <button
            onClick={onClose}
            style={{ background: '#334155', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 14px', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
          >
            ✕ Close
          </button>
        </div>
      </div>

      {/* Printable Document Paper Card */}
      <div id="print-document" style={{ background: '#ffffff', color: '#1b1b1d', width: '100%', maxWidth: 900, minHeight: 950, padding: '36px 44px', borderRadius: 6, boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)', fontFamily: 'Arial, Helvetica, sans-serif', fontSize: 12, lineHeight: 1.5, boxSizing: 'border-box' }}>
        {content}
      </div>
    </div>
  )
}

export default function Purchase() {
  const { user } = useAuth()
  const { addToast } = useToast()

  const roleLevel = user?.role_level ?? 1
  const dept = (user?.department || '').toLowerCase()
  const deptCode = (user?.dept_code || '').toUpperCase()
  const isStoreManager = (
    (roleLevel >= 3 && (['STORE', 'INV', 'RMS', 'MATERIALS', 'FIN', 'PUR'].includes(deptCode) || dept.includes('store') || dept.includes('inventory') || dept.includes('raw material'))) ||
    roleLevel >= 4
  )

  const [rows,setRows]=useState([]),[total,setTotal]=useState(0),[loading,setLoading]=useState(true)
  const [fStatus,setFStatus]=useState(''),[page,setPage]=useState(1)
  const [modal,setModal]=useState(false),[detail,setDetail]=useState(null)
  const [vendors,setVendors]=useState([]),[mats,setMats]=useState([]),[warehouses,setWarehouses]=useState([])
  const [form,setForm]=useState({vendor_id:'',po_date:'',delivery_date:'',delivery_address:'',payment_terms:'',payment_terms_custom:'',remarks:'',items:[]})
  const [formErrors,setFormErrors]=useState({})
  const [saving,setSaving]=useState(false),[err,setErr]=useState('')
  // Edit
  const [editModal,setEditModal]=useState(null)
  const [editForm,setEditForm]=useState({vendor_id:'',vendorName:'',vendorGstin:'',po_number:'',po_date:'',delivery_date:'',payment_terms:'',remarks:'',items:[]})
  const [editMatSearch, setEditMatSearch] = useState({})
  const [editMatDropOpen, setEditMatDropOpen] = useState({})
  const [editFormErrors, setEditFormErrors] = useState({})
  const [editSaving,setEditSaving]=useState(false),[editErr,setEditErr]=useState('')
  // GRN
  const [grnModal,setGrnModal]=useState(null)
  const [grnForm,setGrnForm]=useState({challan_number:'',vehicle_number:'',invoice_number:'',remarks:'',items:[]})
  const [grnSaving,setGrnSaving]=useState(false),[grnErr,setGrnErr]=useState('')
  // Vendor Bill
  const [billModal,setBillModal]=useState(null)
  const [billForm,setBillForm]=useState({vendor_invoice_number:'',invoice_date:'',due_date:'',taxable_amount:0,cgst_amount:0,sgst_amount:0,igst_amount:0,roundoff:0,remarks:''})
  const [billSaving,setBillSaving]=useState(false),[billErr,setBillErr]=useState(''),[billSuccess,setBillSuccess]=useState('')
  // Print
  const [printContent,setPrintContent]=useState(null)
  const LIMIT=20

  // Multi-tab Management: 'orders' | 'grn' | 'bills' | 'pipeline'
  const [tab, setTab] = useState('orders')
  const [grnList, setGrnList] = useState([])
  const [grnTotal, setGrnTotal] = useState(0)
  const [grnLoading, setGrnLoading] = useState(false)
  const [grnSearch, setGrnSearch] = useState('')

  const [billList, setBillList] = useState([])
  const [billTotal, setBillTotal] = useState(0)
  const [billLoading, setBillLoading] = useState(false)
  const [billSearch, setBillSearch] = useState('')

  const [pipelineList, setPipelineList] = useState([])
  const [pipeLoading, setPipeLoading] = useState(false)
  const [pipeSearch, setPipeSearch] = useState('')

  const load=useCallback(async()=>{
    setLoading(true)
    const p=new URLSearchParams({page,limit:LIMIT})
    if(fStatus) p.set('status',fStatus)
    const r=await API(`/api/purchase/po?${p}`)
    if(r.success){setRows(r.data);setTotal(r.total)}
    setLoading(false)
  },[page,fStatus])

  const loadGRNs = useCallback(async () => {
    setGrnLoading(true)
    const r = await API(`/api/purchase/grn?search=${encodeURIComponent(grnSearch)}`)
    if (r.success) {
      setGrnList(r.data)
      setGrnTotal(r.total)
    }
    setGrnLoading(false)
  }, [grnSearch])

  const loadBills = useCallback(async () => {
    setBillLoading(true)
    const r = await API(`/api/finance/bills?search=${encodeURIComponent(billSearch)}`)
    if (r.success) {
      setBillList(r.data)
      setBillTotal(r.total)
    }
    setBillLoading(false)
  }, [billSearch])

  const loadPipeline = useCallback(async () => {
    setPipeLoading(true)
    const r = await API(`/api/purchase/p2p-pipeline?search=${encodeURIComponent(pipeSearch)}`)
    if (r.success) {
      setPipelineList(r.data)
    }
    setPipeLoading(false)
  }, [pipeSearch])

  const handleDeleteGrn = async (g) => {
    if (!window.confirm(`Are you sure you want to void / delete GRN ${g.grnNumber}? This will reverse stock from inventory and sync PO receipt lines.`)) return
    try {
      const res = await API(`/api/purchase/grn/${g.id}`, { method: 'DELETE' })
      if (res.success) {
        if (addToast) addToast(res.message || `GRN ${g.grnNumber} deleted and stock reversed`, 'info')
        else alert(res.message || `GRN ${g.grnNumber} deleted and stock reversed`)
        loadGRNs()
        loadOrders()
      } else {
        if (addToast) addToast(res.message || 'Failed to delete GRN', 'error')
        else alert(res.message || 'Failed to delete GRN')
      }
    } catch (err) {
      if (addToast) addToast('Error deleting GRN: ' + err.message, 'error')
      else alert('Error deleting GRN: ' + err.message)
    }
  }

  const handleDeleteBill = async (b) => {
    if (!window.confirm(`Are you sure you want to delete Vendor Bill / Invoice ${b.billNumber} (${b.vendorInvoiceNumber || ''})?`)) return
    try {
      const res = await API(`/api/purchase/bills/${b.id}`, { method: 'DELETE' })
      if (res.success) {
        if (addToast) addToast(res.message || `Bill ${b.billNumber} removed`, 'info')
        else alert(res.message || `Bill ${b.billNumber} removed`)
        loadBills()
      } else {
        if (addToast) addToast(res.message || 'Failed to delete invoice bill', 'error')
        else alert(res.message || 'Failed to delete invoice bill')
      }
    } catch (err) {
      if (addToast) addToast('Error deleting bill: ' + err.message, 'error')
      else alert('Error deleting bill: ' + err.message)
    }
  }

  const [prList, setPrList] = useState([])
  const [prLoading, setPrLoading] = useState(false)
  const [prSearch, setPrSearch] = useState('')
  const [prFilterStatus, setPrFilterStatus] = useState('')

  const [cashList, setCashList] = useState([])
  const [cashLoading, setCashLoading] = useState(false)
  const [cashSearch, setCashSearch] = useState('')
  const [cashTotal, setCashTotal] = useState(0)
  const [cashPage, setCashPage] = useState(1)

  const [cashModal, setCashModal] = useState(false)
  const [cashForm, setCashForm] = useState({
    indent_id: '',
    vendor_name: '',
    vendor_gstin: '',
    invoice_number: '',
    invoice_date: new Date().toISOString().slice(0, 10),
    payment_mode: 'Cash',
    payment_ref: '',
    remarks: '',
    items: [{ material_id: '', description: '', qty: '', uom: '', unit_price: '', gst_pct: 18, _search: '' }]
  })
  const [cashErr, setCashErr] = useState('')
  const [cashSuccess, setCashSuccess] = useState('')
  const [cashSaving, setCashSaving] = useState(false)

  const [approvedIndents, setApprovedIndents] = useState([])

  const loadPendingIndents = useCallback(async () => {
    setPrLoading(true)
    const r = await API(`/api/purchase/pending-indents?search=${encodeURIComponent(prSearch)}`)
    if (r.success) {
      setPrList(r.data)
    }
    setPrLoading(false)
  }, [prSearch])

  const loadCashPurchases = useCallback(async () => {
    setCashLoading(true)
    const r = await API(`/api/purchase/cash-purchases?page=${cashPage}&search=${encodeURIComponent(cashSearch)}`)
    if (r.success) {
      setCashList(r.data)
      setCashTotal(r.total)
    }
    setCashLoading(false)
  }, [cashPage, cashSearch])

  const loadApprovedIndents = useCallback(async () => {
    const r = await API('/api/purchase/pending-indents')
    if (r.success) {
      setApprovedIndents(r.data)
    }
  }, [])

  useEffect(() => {
    if (tab === 'pr') loadPendingIndents()
    if (tab === 'orders') load()
    if (tab === 'cash') loadCashPurchases()
    if (tab === 'grn') loadGRNs()
    if (tab === 'bills') loadBills()
    if (tab === 'pipeline') loadPipeline()
  }, [tab, loadPendingIndents, load, loadCashPurchases, loadGRNs, loadBills, loadPipeline])

  const [poMatSearch, setPoMatSearch] = useState({})
  const [poMatDropOpen, setPoMatDropOpen] = useState({})

  useEffect(() => {
    API('/api/purchase/vendors').then(r => { if (r.success) setVendors(r.data) })
    API('/api/inventory/materials?limit=2000').then(r => { if (r.success) setMats(r.data) })
    API('/api/master/warehouses').then(r => { if (r.success) setWarehouses(r.data) })
    loadApprovedIndents()

    // Check if navigated with an indent to convert to PO
    const params = new URLSearchParams(window.location.search)
    const indId = params.get('indent_id') || params.get('indentId')
    if (indId) {
      API(`/api/indent/${indId}`).then(r => {
        if (r.success) openNew(r.data)
      })
    }
  }, [loadApprovedIndents])

  const today = () => new Date().toISOString().slice(0, 10)
  const blankItem = () => ({
    material_id: '',
    description: '',
    qty: '',
    uom: '',
    unit_price: '',
    discount_pct: 0,
    other_charges: 0,
    tax_type: 'intra',
    gst_pct: 18,
    remarks: '',
    _search: ''
  })

  const openNew = (preselectedIndent = null) => {
    const items = preselectedIndent?.items?.length
      ? preselectedIndent.items.map(it => {
          const m = mats.find(x => String(x.id) === String(it.material_id))
          return {
            material_id: it.material_id,
            description: it.materialName || it.material_name || m?.name || it.description || '',
            qty: String(it.required_qty || it.qty || 1),
            uom: m?.uom || it.matUom || it.uom || 'NOS',
            unit_price: String(it.matPrice || it.unit_price || m?.unit_price || 0),
            discount_pct: 0,
            other_charges: 0,
            tax_type: 'intra',
            gst_pct: it.gst_pct != null ? it.gst_pct : 18,
            remarks: it.purpose || it.remarks || '',
            _search: it.materialName || it.material_name || m?.name || ''
          }
        })
      : [blankItem()]

    setPoMatSearch({})
    setForm({
      vendor_id: '',
      indent_id: preselectedIndent?.id || '',
      po_date: today(),
      delivery_date: preselectedIndent?.required_date?.slice(0, 10) || preselectedIndent?.requiredDate?.slice(0, 10) || '',
      delivery_address: '',
      payment_terms: '',
      payment_terms_custom: '',
      tax_type: 'intra',
      remarks: preselectedIndent
        ? `PO raised against PR ${preselectedIndent.indentNumber || preselectedIndent.indent_number} (${preselectedIndent.deptName || 'Dept'})`
        : '',
      items
    })
    setFormErrors({})
    loadApprovedIndents()
    setModal(true)
  }

  const openCashFromIndent = (ind) => {
    setCashForm({
      indent_id: ind.id,
      vendor_name: '',
      vendor_gstin: '',
      invoice_number: '',
      invoice_date: today(),
      payment_mode: 'Cash',
      payment_ref: '',
      remarks: `Direct Cash Purchase against PR ${ind.indentNumber || ind.indent_number} (${ind.deptName || ''})`,
      items: (ind.items || []).length ? ind.items.map(it => {
        const m = mats.find(x => String(x.id) === String(it.material_id))
        return {
          material_id: it.material_id,
          description: it.materialName || m?.name || '',
          qty: String(it.required_qty || 1),
          uom: m?.uom || it.matUom || it.uom || 'NOS',
          unit_price: String(it.unit_price || m?.unit_price || 0),
          gst_pct: 18,
          _search: it.materialName || m?.name || ''
        }
      }) : [blankItem()]
    })
    setCashErr('')
    setCashSuccess('')
    setCashModal(true)
  }

  const openNewCashPurchase = () => {
    setCashForm({
      indent_id: '',
      vendor_name: '',
      vendor_gstin: '',
      invoice_number: '',
      invoice_date: today(),
      payment_mode: 'Cash',
      payment_ref: '',
      remarks: '',
      items: [blankItem()]
    })
    setCashErr('')
    setCashSuccess('')
    setCashModal(true)
  }

  const saveCashPurchase = async (e) => {
    e.preventDefault()
    if (!cashForm.vendor_name) {
      setCashErr('Supplier / Vendor Name is required')
      return
    }
    const validItems = cashForm.items.filter(it => it.material_id && parseFloat(it.qty) > 0)
    if (!validItems.length) {
      setCashErr('Please add at least one material with quantity > 0')
      return
    }
    setCashSaving(true)
    setCashErr('')
    const r = await API('/api/purchase/cash-purchase', {
      method: 'POST',
      body: JSON.stringify({ ...cashForm, items: validItems })
    })
    setCashSaving(false)
    if (r.success) {
      setCashSuccess(r.message || 'Cash Purchase Voucher created and inventory updated!')
      setTimeout(() => {
        setCashModal(false)
        loadCashPurchases()
        loadPendingIndents()
      }, 1400)
    } else {
      setCashErr(r.message || 'Failed to save cash purchase')
    }
  }

  const handleSelectIndent = async (indentId) => {
    if (!indentId) {
      setForm(f => ({ ...f, indent_id: '' }))
      return
    }
    const r = await API(`/api/indent/${indentId}`)
    if (r.success) {
      const ind = r.data
      setPoMatSearch({})
      setForm(f => ({
        ...f,
        indent_id: ind.id,
        delivery_date: f.delivery_date || (ind.required_date ? ind.required_date.slice(0, 10) : ''),
        remarks: f.remarks ? f.remarks : `PO raised against PR ${ind.indent_number} (${ind.deptName || ''})`,
        items: (ind.items || []).length ? ind.items.map(it => ({
          material_id: it.material_id,
          description: it.materialName || it.material_name || it.description || '',
          qty: String(it.required_qty || it.qty || 1),
          uom: it.matUom || it.uom || '',
          unit_price: String(it.matPrice || it.unit_price || 0),
          gst_pct: it.gst_pct != null ? it.gst_pct : 18,
          _search: it.materialName || it.material_name || ''
        })) : [blankItem()]
      }))
      setFormErrors(fe => ({ ...fe, items: undefined }))
    }
  }

  const openDetail = async id => { const r = await API(`/api/purchase/po/${id}`); if (r.success) setDetail(r.data) }
  const addItem = () => setForm(f => ({ ...f, items: [...f.items, blankItem()] }))
  const removeItem = i => setForm(f => ({ ...f, items: f.items.filter((_, j) => j !== i) }))
  const setItem = (i, k, v) => setForm(f => ({ ...f, items: f.items.map((it, j) => j === i ? { ...it, [k]: v } : it) }))
  const matUom = id => mats.find(m => m.id == id)?.uom || ''
  const matName = id => mats.find(m => m.id == id)?.name || ''
  const vendorObj = id => vendors.find(v => v.id == id)

  const save = async e => {
    e.preventDefault()
    const errs = {}
    if (!form.vendor_id) errs.vendor_id = 'Vendor is required'
    if (!form.delivery_date) errs.delivery_date = 'Delivery date is required'
    if (form.delivery_date && form.po_date && form.delivery_date < form.po_date) errs.delivery_date = 'Delivery date cannot be before PO date'

    // Any row with a material picked must be fully complete — point at the exact line + field, don't just say "something's wrong"
    const touchedRows = form.items.filter(it => it.material_id)
    if (!touchedRows.length) {
      errs.items = 'Add at least one item — pick a material first'
    } else {
      const itemErrs = form.items.map(it => {
        if (!it.material_id) return {}
        const e2 = {}
        if (!(parseFloat(it.qty) > 0)) e2.qty = 'Qty must be > 0'
        if (!(parseFloat(it.unit_price) >= 0)) e2.unit_price = 'Set a valid unit price'
        return e2
      })
      if (itemErrs.some(e2 => Object.keys(e2).length)) {
        errs.itemFields = itemErrs
        const firstBad = itemErrs.findIndex(e2 => Object.keys(e2).length)
        errs.items = `Line ${firstBad + 1}: ${Object.values(itemErrs[firstBad]).join(', ')}`
      }
    }
    if (Object.keys(errs).length) { setFormErrors(errs); return }
    setFormErrors({})
    setSaving(true); setErr('')
    const pt = form.payment_terms === 'Custom' ? form.payment_terms_custom : form.payment_terms
    const items = form.items.filter(it => it.material_id).map(it => ({ ...it, uom: it.uom || matUom(it.material_id), description: it.description || matName(it.material_id) }))
    const r = await API('/api/purchase/po', { method: 'POST', body: JSON.stringify({ ...form, payment_terms: pt, items }) })
    setSaving(false)
    if (r.success) {
      setModal(false)
      load()
      loadApprovedIndents()
    } else setErr(r.message)
  }

  const saveAsDraft = async () => {
    const pt = form.payment_terms === 'Custom' ? form.payment_terms_custom : form.payment_terms
    const items = form.items.filter(it => it.material_id).map(it => ({ ...it, uom: it.uom || matUom(it.material_id), description: it.description || matName(it.material_id) }))
    setSaving(true); setErr('')
    const r = await API('/api/purchase/po', { method: 'POST', body: JSON.stringify({ ...form, payment_terms: pt, items, status: 'Draft' }) })
    setSaving(false)
    if (r.success) {
      setModal(false)
      load()
      loadApprovedIndents()
    } else setErr(r.message)
  }

  const approve=async id=>{const r=await API(`/api/purchase/po/${id}/approve`,{method:'PUT'});if(r.success){load();if(detail)openDetail(id)}}

  const cancelPO=async id=>{
    if(!window.confirm('Cancel this Purchase Order? This will mark the PO as Cancelled.')) return
    const r=await API(`/api/purchase/po/${id}/cancel`,{method:'PUT'})
    if(r.success){load();setDetail(null);alert('PO Cancelled successfully')}else alert(r.message||'Cancel failed')
  }

  // Hard Delete PO (Draft or Cancelled) & rollback linked PR to Approved
  const deletePO = async (id, poNum) => {
    if (!window.confirm(`Permanently delete Purchase Order ${poNum || id}?\n\nThis will remove the PO and automatically restore any linked Purchase Request (PR / Indent) to 'Approved' status so it can be re-used.`)) return
    const r = await API(`/api/purchase/po/${id}`, { method: 'DELETE' })
    if (r.success) {
      load()
      loadApprovedIndents()
      if (detail && detail.id === id) setDetail(null)
      alert(r.message || 'PO deleted successfully')
    } else {
      alert(r.message || 'Failed to delete PO')
    }
  }

  // Export filtered POs list to CSV
  const exportOrdersToCSV = () => {
    if (!rows || !rows.length) {
      alert('No purchase orders to export')
      return
    }
    const headers = ['PO Number', 'Date', 'Vendor Name', 'Vendor Code', 'PR Reference', 'Department', 'Delivery Date', 'Subtotal (INR)', 'GST Total (INR)', 'Grand Total (INR)', 'Status']
    const csvRows = [headers.join(',')]

    rows.forEach(r => {
      const row = [
        `"${r.poNumber || ''}"`,
        `"${r.date ? r.date.slice(0, 10) : ''}"`,
        `"${(r.vendorName || '').replace(/"/g, '""')}"`,
        `"${r.vendorCode || ''}"`,
        `"${r.indentNumber || ''}"`,
        `"${(r.deptName || '').replace(/"/g, '""')}"`,
        `"${r.deliveryDate ? r.deliveryDate.slice(0, 10) : ''}"`,
        (r.totalValue || 0).toFixed(2),
        (r.gstValue || 0).toFixed(2),
        (r.grandTotal || 0).toFixed(2),
        `"${r.status || ''}"`
      ]
      csvRows.push(row.join(','))
    })

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.setAttribute('href', url)
    link.setAttribute('download', `MK_Paper_Mill_Purchase_Orders_${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Export single PO details to CSV
  const exportPODetailToCSV = (po) => {
    if (!po || !po.items || !po.items.length) return
    const headers = ['Line #', 'Material Code', 'Material Name', 'HSN/SAC', 'Quantity', 'UOM', 'Unit Price (INR)', 'GST Slab %', 'Line Total (INR)']
    const csvRows = [
      `"PURCHASE ORDER: ${po.po_number || po.poNumber}"`,
      `"Vendor: ${(po.vendorName || '').replace(/"/g, '""')}"`,
      `"Date: ${po.date ? po.date.slice(0, 10) : ''}"`,
      `"Status: ${po.status || ''}"`,
      '',
      headers.join(',')
    ]

    po.items.forEach((it, idx) => {
      const row = [
        idx + 1,
        `"${it.materialCode || it.material_id || ''}"`,
        `"${(it.materialName || it.description || '').replace(/"/g, '""')}"`,
        `"${it.hsnCode || '8439'}"`,
        parseFloat(it.qty || 0).toFixed(3),
        `"${it.uom || 'NOS'}"`,
        parseFloat(it.unit_price || 0).toFixed(2),
        it.gst_pct || 18,
        parseFloat(it.total || (parseFloat(it.qty || 0) * parseFloat(it.unit_price || 0) * (1 + (parseFloat(it.gst_pct || 18)/100)))).toFixed(2)
      ]
      csvRows.push(row.join(','))
    })

    csvRows.push('')
    csvRows.push(`"","","","","","","Taxable Subtotal:","${parseFloat(po.total_value || po.totalValue || 0).toFixed(2)}"`)
    csvRows.push(`"","","","","","","Total Tax (GST):","${parseFloat(po.gst_value || po.gstValue || 0).toFixed(2)}"`)
    csvRows.push(`"","","","","","","Grand Total (INR):","${parseFloat(po.grand_total || po.grandTotal || 0).toFixed(2)}"`)

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.setAttribute('href', url)
    link.setAttribute('download', `PO_${po.po_number || po.poNumber}_Details.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Edit PO
  const openEdit = async (po) => {
    const r = await API(`/api/purchase/po/${po.id}`)
    if (!r.success) return
    const d = r.data
    const searchMap = {}
    const items = (d.items || []).map((it, i) => {
      const m = mats.find(mm => String(mm.id) === String(it.material_id))
      searchMap[i] = m ? `${m.name} [${m.code}]` : (it.materialName ? `${it.materialName} [${it.materialCode || ''}]` : '')
      return {
        material_id: it.material_id ? String(it.material_id) : '',
        description: it.description || it.materialName || '',
        qty: it.qty !== undefined && it.qty !== null ? String(it.qty) : '',
        uom: it.uom || matUom(it.material_id) || '',
        unit_price: it.unit_price !== undefined && it.unit_price !== null ? String(it.unit_price) : '',
        discount_pct: it.discount_pct !== undefined && it.discount_pct !== null ? Number(it.discount_pct) : 0,
        other_charges: it.other_charges !== undefined && it.other_charges !== null ? Number(it.other_charges) : 0,
        gst_pct: Number(it.gst_pct ?? 18),
        tax_type: it.tax_type || d.tax_type || 'intra',
        remarks: it.remarks || '',
        _search: it.materialName || ''
      }
    })
    setEditMatSearch(searchMap)
    setEditMatDropOpen({})
    setEditFormErrors({})
    setEditForm({
      vendor_id: d.vendor_id,
      vendorName: d.vendorName || '',
      vendorGstin: d.vendorGstin || '',
      po_number: d.po_number || d.poNumber || String(d.id),
      po_date: d.date?.slice(0, 10) || '',
      delivery_date: d.delivery_date?.slice(0, 10) || '',
      payment_terms: d.payment_terms || '',
      tax_type: d.tax_type || (d.vendorGstin && !d.vendorGstin.startsWith('29') ? 'inter' : 'intra'),
      status: d.status || 'Draft',
      remarks: d.remarks || '',
      items: items.length ? items : [blankItem()]
    })
    setEditModal(d)
    setEditErr('')
  }

  const addEditItem = () => {
    setEditForm(f => {
      const idx = f.items.length
      setEditMatSearch(s => ({ ...s, [idx]: '' }))
      return { ...f, items: [...f.items, blankItem()] }
    })
  }

  const removeEditItem = (i) => {
    setEditForm(f => ({ ...f, items: f.items.filter((_, j) => j !== i) }))
    setEditMatSearch(s => {
      const n = { ...s }
      delete n[i]
      return n
    })
    setEditMatDropOpen(d => {
      const n = { ...d }
      delete n[i]
      return n
    })
  }

  const setEditItem = (i, k, v) => setEditForm(f => ({ ...f, items: f.items.map((it, j) => j === i ? { ...it, [k]: v } : it) }))

  const saveEdit = async e => {
    e.preventDefault()
    const errs = {}
    const touchedRows = editForm.items.filter(it => it.material_id)
    if (!touchedRows.length) {
      errs.items = 'Add at least one item — pick a material first'
    } else {
      const itemErrs = editForm.items.map(it => {
        if (!it.material_id) return { material_id: 'Material is required' }
        const e2 = {}
        if (!(parseFloat(it.qty) > 0)) e2.qty = 'Qty must be > 0'
        if (!(parseFloat(it.unit_price) >= 0)) e2.unit_price = 'Set a valid unit price'
        return e2
      })
      if (itemErrs.some(e2 => Object.keys(e2).length)) {
        errs.itemFields = itemErrs
        const firstBad = itemErrs.findIndex(e2 => Object.keys(e2).length)
        errs.items = `Line ${firstBad + 1}: ${Object.values(itemErrs[firstBad]).join(', ')}`
      }
    }

    const dupCheck = editForm.items.filter(it => it.material_id).map(it => String(it.material_id))
    if (new Set(dupCheck).size !== dupCheck.length) {
      errs.items = 'Same material added in more than one line — combine quantities instead'
    }

    if (Object.keys(errs).length) {
      setEditFormErrors(errs)
      setEditErr(errs.items || 'Please fix highlighted errors')
      return
    }

    setEditFormErrors({})
    setEditSaving(true); setEditErr('')
    const items = editForm.items.filter(it => it.material_id).map(it => ({
      ...it,
      uom: it.uom || matUom(it.material_id),
      description: it.description || matName(it.material_id),
      remarks: it.remarks || ''
    }))
    const r = await API(`/api/purchase/po/${editModal.id}`, { method: 'PUT', body: JSON.stringify({ ...editForm, items }) })
    setEditSaving(false)
    if (r.success) {
      setEditModal(null)
      load()
      if (detail && detail.id === editModal.id) openDetail(detail.id)
    } else {
      setEditErr(r.message || 'Edit failed')
    }
  }

  // GRN Receipt
  const openGRN = async (poRow) => {
    const r = await API(`/api/purchase/po/${poRow.id}`)
    if (!r.success) return
    const po = r.data
    setGrnModal(po)
    setGrnErr('')
    setGrnForm({
      challan_number: '',
      vehicle_number: '',
      invoice_number: '',
      remarks: '',
      tax_type: po.tax_type || (po.vendorGstin && !po.vendorGstin.startsWith('29') ? 'inter' : 'intra'),
      items: (po.items || []).map(it => {
        const remaining = Math.max(0, parseFloat(it.qty || 0) - parseFloat(it.received_qty || 0))
        return {
          material_id: it.material_id,
          material_name: it.materialName || it.name,
          uom: it.uom,
          po_qty: it.qty,
          received_qty: remaining,
          accepted_qty: remaining,
          rejected_qty: 0,
          unit_price: it.unit_price || 0,
          discount_pct: it.discount_pct || 0,
          other_charges: it.other_charges || 0,
          tax_type: it.tax_type || po.tax_type || 'intra',
          gst_pct: it.gst_pct ?? 18,
          batch_number: '',
          bin_location: it.binLocation || it.bin_location || '',
          remarks: ''
        }
      })
    })
  }

  const saveGRN = async e => {
    e.preventDefault()
    if (!grnModal) return
    for (const [idx, it] of grnForm.items.entries()) {
      const rq = parseFloat(it.received_qty) || 0, aq = parseFloat(it.accepted_qty) || 0
      if (rq <= 0) { setGrnErr(`Item ${idx + 1} (${it.material_name}): received qty must be greater than 0`); return }
      if (aq > rq) { setGrnErr(`Item ${idx + 1} (${it.material_name}): accepted qty (${aq}) cannot exceed received qty (${rq})`); return }
      if (aq < 0) { setGrnErr(`Item ${idx + 1} (${it.material_name}): accepted qty cannot be negative`); return }
    }
    setGrnSaving(true); setGrnErr('')
    const payload = {
      date: today(),
      vendor_id: grnModal.vendor_id,
      po_id: grnModal.id,
      challan_number: grnForm.challan_number,
      vehicle_number: grnForm.vehicle_number,
      invoice_number: grnForm.invoice_number,
      tax_type: grnForm.tax_type,
      remarks: grnForm.remarks,
      items: grnForm.items.map(it => ({
        material_id: it.material_id,
        po_qty: parseFloat(it.po_qty) || 0,
        received_qty: parseFloat(it.received_qty) || 0,
        accepted_qty: parseFloat(it.accepted_qty) || 0,
        rejected_qty: parseFloat(it.rejected_qty) || 0,
        unit_price: parseFloat(it.unit_price) || 0,
        discount_pct: parseFloat(it.discount_pct) || 0,
        other_charges: parseFloat(it.other_charges) || 0,
        tax_type: it.tax_type || grnForm.tax_type,
        gst_pct: parseFloat(it.gst_pct) || 18,
        uom: it.uom,
        batch_number: it.batch_number || '',
        bin_location: it.bin_location || '',
        remarks: it.remarks || ''
      }))
    }
    const r = await API(`/api/purchase/po/${grnModal.id}/grn`, { method: 'POST', body: JSON.stringify(payload) })
    setGrnSaving(false)
    if (r.success) {
      setGrnModal(null)
      load()
      loadGRNs()
      if (r.data?.id) {
        printGRNDocument(r.data)
      }
    } else {
      setGrnErr(r.message || 'GRN failed')
    }
  }

  // ── Dedicated Edit GRN Modal State & Handlers ──
  const [editGrnModal, setEditGrnModal] = useState(null)
  const [editGrnForm, setEditGrnForm] = useState({
    vehicle_number: '',
    challan_number: '',
    invoice_number: '',
    remarks: '',
    date: '',
    tax_type: 'intra',
    items: []
  })
  const [editGrnErr, setEditGrnErr] = useState('')
  const [editGrnSaving, setEditGrnSaving] = useState(false)

  const openEditGrn = async (grnRow) => {
    const r = await API(`/api/purchase/grn/${grnRow.id}`)
    if (!r.success) return alert(r.message || 'Failed to load GRN details')
    const g = r.data
    setEditGrnForm({
      vehicle_number: g.vehicleNumber || g.vehicle_number || '',
      challan_number: g.challanNumber || g.challan_number || '',
      invoice_number: g.invoiceNumber || g.invoice_number || '',
      remarks: g.remarks || '',
      date: g.date ? g.date.slice(0, 10) : today(),
      tax_type: g.tax_type || (g.vendorGstin && !g.vendorGstin.startsWith('29') ? 'inter' : 'intra'),
      items: (g.items || []).map(it => ({
        id: it.id,
        material_id: it.material_id,
        materialName: it.materialName || it.material_name,
        materialCode: it.materialCode,
        uom: it.uom || it.matUom || 'NOS',
        po_qty: it.po_qty,
        received_qty: it.received_qty,
        accepted_qty: it.accepted_qty,
        rejected_qty: it.rejected_qty || 0,
        unit_price: it.unit_price,
        discount_pct: it.discount_pct || 0,
        other_charges: it.other_charges || 0,
        tax_type: it.tax_type || g.tax_type || 'intra',
        gst_pct: it.gst_pct != null ? it.gst_pct : 18,
        bin_location: it.bin_location || it.binLocation || '',
        batch_number: it.batch_number || '',
        remarks: it.remarks || ''
      }))
    })
    setEditGrnErr('')
    setEditGrnModal(g)
  }

  const setEditGrnItem = (i, k, v) => setEditGrnForm(f => ({
    ...f,
    items: f.items.map((it, j) => j === i ? { ...it, [k]: v } : it)
  }))

  const saveEditGrn = async (e) => {
    e.preventDefault()
    if (!editGrnModal) return
    setEditGrnSaving(true)
    setEditGrnErr('')
    const r = await API(`/api/purchase/grn/${editGrnModal.id}`, {
      method: 'PUT',
      body: JSON.stringify(editGrnForm)
    })
    setEditGrnSaving(false)
    if (r.success) {
      setEditGrnModal(null)
      loadGRNs()
      load()
    } else {
      setEditGrnErr(r.message || 'Failed to update GRN')
    }
  }

  const printGRNDocument = async (grnRow) => {
    const r = await API(`/api/purchase/grn/${grnRow.id}`)
    if (!r.success) return alert(r.message || 'Failed to load GRN details')
    const g = r.data

    const isInterState = g.tax_type === 'inter' || (g.vendorGstin && !g.vendorGstin.startsWith('29'))

    let totalGross = 0
    let totalDiscount = 0
    let totalOtherCharges = 0
    let totalTaxable = 0
    let totalCgst = 0
    let totalSgst = 0
    let totalIgst = 0

    const itemsCalculated = (g.items || []).map(it => {
      const uPrice = Number(it.unit_price || 0)
      const accQty = Number(it.accepted_qty || 0)
      const gross = accQty * uPrice
      const discPct = Number(it.discount_pct || 0)
      const discAmt = gross * (discPct / 100)
      const discBase = Math.max(0, gross - discAmt)
      const otherCharges = Number(it.other_charges || 0)
      const lineTaxable = discBase + otherCharges
      const gstPct = Number(it.gst_pct ?? 18)

      const cgstPct = isInterState ? 0 : gstPct / 2
      const sgstPct = isInterState ? 0 : gstPct / 2
      const igstPct = isInterState ? gstPct : 0

      const cgstAmt = (lineTaxable * cgstPct) / 100
      const sgstAmt = (lineTaxable * sgstPct) / 100
      const igstAmt = (lineTaxable * igstPct) / 100
      const lineTotal = lineTaxable + cgstAmt + sgstAmt + igstAmt

      totalGross += gross
      totalDiscount += discAmt
      totalOtherCharges += otherCharges
      totalTaxable += lineTaxable
      totalCgst += cgstAmt
      totalSgst += sgstAmt
      totalIgst += igstAmt

      return {
        ...it,
        uPrice,
        accQty,
        gross,
        discPct,
        discAmt,
        otherCharges,
        lineTaxable,
        gstPct,
        cgstPct,
        sgstPct,
        igstPct,
        cgstAmt,
        sgstAmt,
        igstAmt,
        lineTotal
      }
    })

    const totalGst = totalCgst + totalSgst + totalIgst
    const grandTotal = totalTaxable + totalGst

    const content = (
      <div>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #0f766e', paddingBottom: 14, marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <img src={LOGO_DATA_URI} alt="Logo" style={{ height: 48, width: 'auto', maxWidth: 160, objectFit: 'contain', borderRadius: 6, border: '1px solid #e2e8f0', background: '#fff', padding: '2px 6px' }} />
            <div>
              <div style={{ fontSize: 22, fontWeight: 900, color: '#0f766e', letterSpacing: 0.5 }}>
                SRI M.K. PAPER MILLS PRIVATE LIMITED
              </div>
              <div style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>
                Store Department — Goods Receipt Note (Inward Commercial Tax Voucher)
              </div>
              <div style={{ fontSize: 11, color: '#475569' }}>
                Plant: Survey No. 128/1, Industrial Area, Village Gangur, Dist. Dharwad - 580011, Karnataka
              </div>
              <div style={{ fontSize: 11, color: '#0f172a', fontWeight: 700, marginTop: 2 }}>
                GSTIN: <code>29AABCS1429B1Z8</code> | PAN: <code>AAICM7429L</code> | State: Karnataka (Code: 29)
              </div>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ display: 'inline-block', background: '#0f766e', color: '#fff', padding: '4px 14px', borderRadius: 4, fontWeight: 800, fontSize: 13, textTransform: 'uppercase' }}>
              GOODS RECEIPT NOTE (GRN)
            </div>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#0f172a', marginTop: 6 }}>
              GRN #: {g.grnNumber || g.grn_number}
            </div>
            <div style={{ fontSize: 11, color: '#64748b' }}>
              Date: <strong>{g.date ? new Date(g.date).toLocaleDateString('en-IN') : '—'}</strong>
            </div>
            <div style={{ fontSize: 11, color: '#64748b' }}>
              Status: <strong style={{ color: '#0f766e' }}>{g.status || 'Received'}</strong>
            </div>
          </div>
        </div>

        {/* 2-Column Vendor & Order Specifications */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 16, marginBottom: 16 }}>
          <div style={{ border: '1px solid #cbd5e1', borderRadius: 6, padding: '10px 14px', background: '#f8fafc' }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#0f766e', textTransform: 'uppercase', marginBottom: 4 }}>
              🏢 SUPPLIER / VENDOR DETAILS
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{g.vendorName}</div>
            {g.vendorCode && <div style={{ fontSize: 11, color: '#64748b' }}>Vendor Code: <code>{g.vendorCode}</code></div>}
            <div style={{ fontSize: 11, color: '#334155', marginTop: 2 }}>
              GSTIN: <strong>{g.vendorGstin || 'Unregistered / Exempt'}</strong>
            </div>
            <div style={{ fontSize: 11, color: '#334155' }}>
              State: <strong>{g.vendorState || (isInterState ? 'Inter-State' : 'Karnataka (Code 29)')}</strong> ({isInterState ? 'IGST Applicable' : 'CGST + SGST Applicable'})
            </div>
            {g.vendorAddress && <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>{g.vendorAddress}</div>}
          </div>

          <div style={{ border: '1px solid #cbd5e1', borderRadius: 6, padding: '10px 14px', background: '#f8fafc' }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#0f766e', textTransform: 'uppercase', marginBottom: 4 }}>
              📋 LOGISTICS &amp; INVOICE REFERENCES
            </div>
            <div style={{ fontSize: 11, color: '#334155', marginBottom: 2 }}>
              PO Reference: <strong>{g.poNumber || 'Direct Inward'}</strong>
            </div>
            <div style={{ fontSize: 11, color: '#334155', marginBottom: 2 }}>
              Vehicle Number: <strong>{g.vehicleNumber || g.vehicle_number || '—'}</strong>
            </div>
            <div style={{ fontSize: 11, color: '#334155', marginBottom: 2 }}>
              Delivery Challan (DC): <strong>{g.challanNumber || g.challan_number || '—'}</strong>
            </div>
            <div style={{ fontSize: 11, color: '#334155' }}>
              Vendor Invoice #: <strong>{g.invoiceNumber || g.invoice_number || '—'}</strong>
            </div>
          </div>
        </div>

        {/* Line Items Table with Unit Rate, Discount, Other Charges, and CGST/SGST/IGST Breakdown */}
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 16, fontSize: 11 }}>
          <thead>
            <tr style={{ background: '#f1f5f9', borderTop: '1px solid #0f766e', borderBottom: '2px solid #0f766e', textAlign: 'left', color: '#0f766e', fontWeight: 800 }}>
              <th style={{ padding: '8px 6px', width: 24, textAlign: 'center' }}>#</th>
              <th style={{ padding: '8px 6px' }}>Material Description &amp; Specifications</th>
              <th style={{ padding: '8px 6px', width: 55 }}>HSN</th>
              <th style={{ padding: '8px 6px', width: 40 }}>UOM</th>
              <th style={{ padding: '8px 6px', textAlign: 'right', width: 55 }}>Accepted</th>
              <th style={{ padding: '8px 6px', textAlign: 'right', width: 70 }}>Rate (₹)</th>
              <th style={{ padding: '8px 6px', textAlign: 'right', width: 55 }}>Disc %</th>
              <th style={{ padding: '8px 6px', textAlign: 'right', width: 65 }}>Other Chg</th>
              <th style={{ padding: '8px 6px', textAlign: 'right', width: 80 }}>Taxable (₹)</th>
              {!isInterState ? (
                <>
                  <th style={{ padding: '8px 6px', textAlign: 'right', width: 65 }}>CGST</th>
                  <th style={{ padding: '8px 6px', textAlign: 'right', width: 65 }}>SGST</th>
                </>
              ) : (
                <th style={{ padding: '8px 6px', textAlign: 'right', width: 75 }}>IGST</th>
              )}
              <th style={{ padding: '8px 6px', textAlign: 'right', width: 90 }}>Total (₹)</th>
            </tr>
          </thead>
          <tbody>
            {itemsCalculated.map((it, i) => (
              <tr key={i} style={{ borderBottom: '1px solid #e2e8f0' }}>
                <td style={{ padding: '8px 6px', textAlign: 'center', color: '#64748b' }}>{i + 1}</td>
                <td style={{ padding: '8px 6px' }}>
                  <div style={{ fontWeight: 700, color: '#0f172a' }}>{it.materialName}</div>
                  <div style={{ fontSize: 10, color: '#64748b' }}>Code: <code>{it.materialCode || it.material_id}</code></div>
                  {it.batch_number && <div style={{ fontSize: 10, color: '#0f766e' }}>Batch: {it.batch_number}</div>}
                </td>
                <td style={{ padding: '8px 6px', fontFamily: 'monospace' }}>{it.hsnCode || '8439'}</td>
                <td style={{ padding: '8px 6px', color: '#475569' }}>{it.uom || it.matUom || 'NOS'}</td>
                <td style={{ padding: '8px 6px', textAlign: 'right', fontWeight: 700, color: '#16a34a' }}>{it.accQty.toFixed(2)}</td>
                <td style={{ padding: '8px 6px', textAlign: 'right' }}>₹{it.uPrice.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                <td style={{ padding: '8px 6px', textAlign: 'right', color: it.discPct > 0 ? '#b45309' : '#64748b' }}>
                  {it.discPct > 0 ? `${it.discPct}%` : '—'}
                </td>
                <td style={{ padding: '8px 6px', textAlign: 'right', color: it.otherCharges > 0 ? '#0369a1' : '#64748b' }}>
                  {it.otherCharges > 0 ? `₹${it.otherCharges.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—'}
                </td>
                <td style={{ padding: '8px 6px', textAlign: 'right', fontWeight: 700 }}>₹{it.lineTaxable.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                {!isInterState ? (
                  <>
                    <td style={{ padding: '8px 6px', textAlign: 'right', color: '#059669' }}>₹{it.cgstAmt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td style={{ padding: '8px 6px', textAlign: 'right', color: '#059669' }}>₹{it.sgstAmt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                  </>
                ) : (
                  <td style={{ padding: '8px 6px', textAlign: 'right', color: '#d97706' }}>₹{it.igstAmt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                )}
                <td style={{ padding: '8px 6px', textAlign: 'right', fontWeight: 800, color: '#0f766e' }}>₹{it.lineTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Tax Matrix Summary Box & Amount in Words */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 16, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6, padding: '12px 16px', marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#0f766e', textTransform: 'uppercase', marginBottom: 4 }}>
              AMOUNT IN WORDS:
            </div>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#0f172a', fontStyle: 'italic' }}>
              {numberToWords(grandTotal)}
            </div>
            {g.remarks && (
              <div style={{ fontSize: 11, color: '#475569', marginTop: 8 }}>
                <strong>Remarks:</strong> {g.remarks}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#64748b' }}>Gross Base:</span>
              <span>₹{totalGross.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>
            {totalDiscount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#b45309' }}>
                <span>Total Discount (-):</span>
                <span>-₹{totalDiscount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
            )}
            {totalOtherCharges > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#0369a1' }}>
                <span>Other Charges (Transport / P&amp;F) (+):</span>
                <span>+₹{totalOtherCharges.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #cbd5e1', paddingTop: 2 }}>
              <span style={{ color: '#0f172a', fontWeight: 700 }}>Taxable Subtotal:</span>
              <strong>₹{totalTaxable.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
            </div>
            {!isInterState ? (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#059669' }}>CGST Total:</span>
                  <span>₹{totalCgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#059669' }}>SGST Total:</span>
                  <span>₹{totalSgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
              </>
            ) : (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#d97706' }}>IGST Total:</span>
                <span style={{ color: '#d97706', fontWeight: 600 }}>₹{totalIgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #cbd5e1', paddingTop: 4 }}>
              <span style={{ color: '#64748b' }}>Total GST Tax:</span>
              <strong>₹{totalGst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '2px solid #0f766e', paddingTop: 4, fontSize: 14 }}>
              <span style={{ fontWeight: 800, color: '#0f766e' }}>Grand Total Valuation:</span>
              <span style={{ fontWeight: 900, color: '#0f766e' }}>₹{grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>
          </div>
        </div>

        {/* 3 Signatures Block */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 24, textAlign: 'center', fontSize: 11, color: '#334155', marginTop: 32 }}>
          <div>
            <div style={{ height: 36 }}></div>
            <div style={{ borderTop: '1px solid #94a3b8', paddingTop: 4, fontWeight: 700 }}>Received By (Store Staff)</div>
            <div style={{ fontSize: 10, color: '#64748b' }}>{g.receivedByName || 'Store Clerk'}</div>
          </div>
          <div>
            <div style={{ height: 36 }}></div>
            <div style={{ borderTop: '1px solid #94a3b8', paddingTop: 4, fontWeight: 700 }}>Quality Inspector / Chemist</div>
            <div style={{ fontSize: 10, color: '#64748b' }}>QA / QC Department</div>
          </div>
          <div>
            <div style={{ height: 36 }}></div>
            <div style={{ borderTop: '1px solid #94a3b8', paddingTop: 4, fontWeight: 700 }}>Store Incharge / Manager</div>
            <div style={{ fontSize: 10, color: '#64748b' }}>MK Paper Mill Stores</div>
          </div>
        </div>
      </div>
    )
    setPrintContent(content)
  }

  const setGrnItem=(i,k,v)=>setGrnForm(f=>({...f,items:f.items.map((it,j)=>j===i?{...it,[k]:v}:it)}))

  // Book Vendor Bill for Finance
  const openBill = async (poRow) => {
    const r = await API(`/api/purchase/po/${poRow.id}`)
    if (!r.success) return
    const po = r.data
    setBillModal(po)
    setBillErr('')
    setBillSuccess('')
    const isInter = po.vendorGstin && !po.vendorGstin.startsWith('29')
    const sub = Number(po.total_value || po.totalValue || 0)
    const gst = Number(po.gst_value || po.gstValue || (Number(po.grand_total || po.grandTotal || 0) - sub))
    setBillForm({
      vendor_invoice_number: '',
      invoice_date: today(),
      due_date: po.delivery_date ? po.delivery_date.slice(0, 10) : today(),
      taxable_amount: sub,
      cgst_amount: isInter ? 0 : (gst / 2),
      sgst_amount: isInter ? 0 : (gst / 2),
      igst_amount: isInter ? gst : 0,
      roundoff: 0,
      remarks: `Commercial bill booked from PO ${po.po_number || po.poNumber}`
    })
  }

  const saveBill = async (e) => {
    e.preventDefault()
    if (!billModal) return
    if (!billForm.vendor_invoice_number || !billForm.invoice_date) {
      setBillErr('Vendor Invoice Number and Invoice Date are required')
      return
    }
    setBillSaving(true)
    setBillErr('')
    const r = await API(`/api/purchase/po/${billModal.id}/bill`, {
      method: 'POST',
      body: JSON.stringify(billForm)
    })
    setBillSaving(false)
    if (r.success) {
      setBillSuccess(`Vendor Bill ${r.data.bill_number} booked and routed to Finance for payment approval!`)
      setTimeout(() => {
        setBillModal(null)
        load()
      }, 1400)
    } else {
      setBillErr(r.message || 'Failed to book bill')
    }
  }

  // Print Official Cash Purchase Voucher
  const printCashVoucher = async (cpRow) => {
    let cp = cpRow
    if (!cp.items || !cp.items.length) {
      const r = await API(`/api/purchase/cash-purchases/${cpRow.id}`)
      if (r.success) cp = r.data
    }
    const isInter = cp.vendor_gstin && !cp.vendor_gstin.startsWith('29')
    const sub = Number(cp.taxable_amount || cp.taxableAmount || 0)
    const cgst = Number(cp.cgst_amount || 0)
    const sgst = Number(cp.sgst_amount || 0)
    const igst = Number(cp.igst_amount || 0)
    const grand = Number(cp.total_amount || cp.totalAmount || 0)

    const content = (
      <div id="print-document" style={{ fontFamily: 'Inter, system-ui, sans-serif', color: '#0f172a', lineHeight: 1.4, padding: '16px' }}>
        {/* Letterhead */}
        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #0f766e', paddingBottom: 12, marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <img src={LOGO_DATA_URI} alt="Logo" style={{ height: 44, width: 'auto', maxWidth: 150, objectFit: 'contain', borderRadius: 6, border: '1px solid #e2e8f0', background: '#fff', padding: '2px 6px' }} />
            <div>
              <div style={{ fontSize: 20, fontWeight: 900, color: '#0f766e', letterSpacing: 0.5 }}>SRI M.K. PAPER MILLS PRIVATE LIMITED</div>
              <div style={{ fontSize: 11, color: '#334155', fontWeight: 600 }}>CASH PURCHASE &amp; SPOT PROCUREMENT VOUCHER</div>
              <div style={{ fontSize: 10, color: '#64748b' }}>Plant: Survey No. 42/1, Mill Road, Industrial Area, Karnataka | GSTIN: 29AABCS1429B1Z8</div>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#0f766e' }}>{cp.voucher_number || cp.voucherNumber}</div>
            <div style={{ fontSize: 11, color: '#64748b' }}>Date: <strong>{cp.date ? new Date(cp.date).toLocaleDateString('en-IN') : new Date().toLocaleDateString('en-IN')}</strong></div>
            <div style={{ fontSize: 11, color: '#16a34a', fontWeight: 700 }}>PAID ({cp.payment_mode || cp.paymentMode || 'Cash'})</div>
          </div>
        </div>

        {/* Vendor & Details */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
          <div style={{ border: '1px solid #cbd5e1', borderRadius: 6, padding: '10px 12px', background: '#f8fafc' }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#0f766e', textTransform: 'uppercase', marginBottom: 4 }}>SUPPLIER / SHOP DETAILS</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{cp.vendor_name || cp.vendorName}</div>
            <div style={{ fontSize: 11, color: '#334155', marginTop: 2 }}>GSTIN: <strong>{cp.vendor_gstin || cp.vendorGstin || 'Unregistered / Cash Vendor'}</strong></div>
            <div style={{ fontSize: 11, color: '#334155' }}>Cash Memo / Invoice: <strong>{cp.invoice_number || cp.invoiceNumber || '—'}</strong></div>
          </div>
          <div style={{ border: '1px solid #cbd5e1', borderRadius: 6, padding: '10px 12px', background: '#f8fafc' }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#0f766e', textTransform: 'uppercase', marginBottom: 4 }}>PROCUREMENT &amp; PAYMENT INFO</div>
            <div style={{ fontSize: 11, color: '#334155', marginBottom: 2 }}>PR / Indent Ref: <strong>{cp.indentNumber || cp.indent_number || 'Direct Spot Purchase'}</strong></div>
            <div style={{ fontSize: 11, color: '#334155', marginBottom: 2 }}>Payment Mode: <strong>{cp.payment_mode || cp.paymentMode || 'Cash'}</strong> {cp.payment_ref ? `(Ref: ${cp.payment_ref})` : ''}</div>
            <div style={{ fontSize: 11, color: '#334155' }}>Inventory Status: <strong style={{ color: '#16a34a' }}>✓ Stock Added to Central Store</strong></div>
          </div>
        </div>

        {/* Items Table */}
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 16, fontSize: 11 }}>
          <thead>
            <tr style={{ background: '#f1f5f9', borderTop: '1px solid #0f766e', borderBottom: '2px solid #0f766e', textAlign: 'left', color: '#0f766e', fontWeight: 800 }}>
              <th style={{ padding: '8px 6px', width: 30, textAlign: 'center' }}>#</th>
              <th style={{ padding: '8px 6px' }}>Item Description &amp; Part Code</th>
              <th style={{ padding: '8px 6px', textAlign: 'center', width: 70 }}>HSN</th>
              <th style={{ padding: '8px 6px', textAlign: 'right', width: 60 }}>Qty</th>
              <th style={{ padding: '8px 6px', width: 45 }}>UOM</th>
              <th style={{ padding: '8px 6px', textAlign: 'right', width: 80 }}>Unit Rate</th>
              <th style={{ padding: '8px 6px', textAlign: 'center', width: 50 }}>GST%</th>
              <th style={{ padding: '8px 6px', textAlign: 'right', width: 95 }}>Total (₹)</th>
            </tr>
          </thead>
          <tbody>
            {(cp.items || []).map((it, i) => (
              <tr key={i} style={{ borderBottom: '1px solid #e2e8f0' }}>
                <td style={{ padding: '8px 6px', textAlign: 'center', color: '#64748b' }}>{i + 1}</td>
                <td style={{ padding: '8px 6px' }}>
                  <div style={{ fontWeight: 700, color: '#0f172a' }}>{it.materialName || it.description}</div>
                  <div style={{ fontSize: 10, color: '#64748b' }}>Code: <code>{it.materialCode || it.material_id}</code></div>
                </td>
                <td style={{ padding: '8px 6px', textAlign: 'center', color: '#64748b' }}>{it.hsnCode || '8439'}</td>
                <td style={{ padding: '8px 6px', textAlign: 'right', fontWeight: 700 }}>{parseFloat(it.qty || 0).toFixed(2)}</td>
                <td style={{ padding: '8px 6px', color: '#475569' }}>{it.uom || it.matUom || 'NOS'}</td>
                <td style={{ padding: '8px 6px', textAlign: 'right' }}>₹{parseFloat(it.unit_price || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                <td style={{ padding: '8px 6px', textAlign: 'center' }}>{it.gst_pct || 18}%</td>
                <td style={{ padding: '8px 6px', textAlign: 'right', fontWeight: 700 }}>₹{parseFloat(it.line_total || it.lineTotal || (parseFloat(it.qty || 0) * parseFloat(it.unit_price || 0) * 1.18)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Valuation and Signatures */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 16, marginBottom: 20 }}>
          <div style={{ border: '1px solid #e2e8f0', borderRadius: 6, padding: '10px 14px', background: '#f8fafc' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#0f766e', marginBottom: 4 }}>Amount in Words:</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#0f172a', fontStyle: 'italic' }}>
              {numberToWords(grand)}
            </div>
            {cp.remarks && <div style={{ fontSize: 11, color: '#475569', marginTop: 8 }}><strong>Remarks:</strong> {cp.remarks}</div>}
          </div>
          <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse' }}>
            <tbody>
              <tr>
                <td style={{ padding: '4px 6px', color: '#64748b' }}>Taxable Amount:</td>
                <td style={{ padding: '4px 6px', textAlign: 'right', fontWeight: 600 }}>₹{sub.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
              </tr>
              {isInter ? (
                <tr>
                  <td style={{ padding: '4px 6px', color: '#d97706' }}>IGST Amount:</td>
                  <td style={{ padding: '4px 6px', textAlign: 'right', fontWeight: 600, color: '#d97706' }}>₹{igst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                </tr>
              ) : (
                <>
                  <tr>
                    <td style={{ padding: '4px 6px', color: '#059669' }}>CGST Amount:</td>
                    <td style={{ padding: '4px 6px', textAlign: 'right', fontWeight: 600, color: '#059669' }}>₹{cgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '4px 6px', color: '#059669' }}>SGST Amount:</td>
                    <td style={{ padding: '4px 6px', textAlign: 'right', fontWeight: 600, color: '#059669' }}>₹{sgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                  </tr>
                </>
              )}
              <tr style={{ borderTop: '1px solid #cbd5e1', background: '#f0fdf4' }}>
                <td style={{ padding: '6px 6px', fontWeight: 800, fontSize: 13, color: '#0f766e' }}>Total Paid:</td>
                <td style={{ padding: '6px 6px', textAlign: 'right', fontWeight: 900, fontSize: 14, color: '#0f766e' }}>₹{grand.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* 3 Signatures */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 24, textAlign: 'center', fontSize: 11, color: '#334155', marginTop: 32 }}>
          <div>
            <div style={{ height: 36 }}></div>
            <div style={{ borderTop: '1px solid #94a3b8', paddingTop: 4, fontWeight: 700 }}>Purchaser / Indentor</div>
            <div style={{ fontSize: 10, color: '#64748b' }}>{cp.createdByName || 'Purchaser'}</div>
          </div>
          <div>
            <div style={{ height: 36 }}></div>
            <div style={{ borderTop: '1px solid #94a3b8', paddingTop: 4, fontWeight: 700 }}>Store Keeper (Stock Verified)</div>
            <div style={{ fontSize: 10, color: '#64748b' }}>Central Stores</div>
          </div>
          <div>
            <div style={{ height: 36 }}></div>
            <div style={{ borderTop: '1px solid #94a3b8', paddingTop: 4, fontWeight: 700 }}>Finance / Accounts Incharge</div>
            <div style={{ fontSize: 10, color: '#64748b' }}>Accounts Department</div>
          </div>
        </div>
      </div>
    )
    setPrintContent(content)
  }

  // Print Commercial Vendor Bill & Tax Invoice Entry
  const printBillDocument = async (billRow) => {
    let b = billRow
    if (!b.vendorInvoiceNumber && !b.vendor_invoice_number) {
      const r = await API(`/api/finance/bills/${billRow.id}`)
      if (r.success) b = r.data
    }
    const isInter = (b.igst_amount && parseFloat(b.igst_amount) > 0) || (b.vendorGstin && !b.vendorGstin.startsWith('29'))
    const taxable = parseFloat(b.taxable_amount || b.taxableAmount || 0)
    const cgst = parseFloat(b.cgst_amount || b.cgstAmount || 0)
    const sgst = parseFloat(b.sgst_amount || b.sgstAmount || 0)
    const igst = parseFloat(b.igst_amount || b.igstAmount || 0)
    const totalTax = cgst + sgst + igst
    const totalAmount = parseFloat(b.total_amount || b.totalAmount || 0)
    const paidAmount = parseFloat(b.paid_amount || b.paidAmount || 0)
    const balanceAmount = parseFloat(b.balance_amount || b.balanceAmount || 0)

    const content = (
      <div>
        {/* Letterhead */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #0f766e', paddingBottom: 14, marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <img src={LOGO_DATA_URI} alt="Logo" style={{ height: 48, width: 'auto', maxWidth: 160, objectFit: 'contain', borderRadius: 6, border: '1px solid #e2e8f0', background: '#fff', padding: '2px 6px' }} />
            <div>
              <div style={{ fontSize: 22, fontWeight: 900, color: '#0f766e', letterSpacing: 0.5 }}>
                SRI M.K. PAPER MILLS PRIVATE LIMITED
              </div>
              <div style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>
                Finance &amp; Accounts Department · Commercial Purchase Invoice Entry
              </div>
              <div style={{ fontSize: 11, color: '#475569' }}>
                Factory: Survey No. 42/1, Mill Road, Industrial Area, Dharwad - 580011, Karnataka
              </div>
              <div style={{ fontSize: 11, color: '#0f172a', fontWeight: 600, marginTop: 2 }}>
                GSTIN: <code>29AABCS1429B1Z8</code> · State: Karnataka (Code: 29) · PAN: <code>AAICM7429L</code>
              </div>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ display: 'inline-block', background: '#0369a1', color: '#fff', padding: '4px 14px', borderRadius: 4, fontWeight: 800, fontSize: 13, textTransform: 'uppercase' }}>
              COMMERCIAL VENDOR BILL
            </div>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#0f172a', marginTop: 6 }}>
              BILL #: {b.bill_number || b.billNumber}
            </div>
            <div style={{ fontSize: 11, color: '#64748b' }}>
              Entry Date: <strong>{b.created_at ? new Date(b.created_at).toLocaleDateString('en-IN') : new Date().toLocaleDateString('en-IN')}</strong>
            </div>
            <div style={{ fontSize: 11, color: '#64748b' }}>
              Status: <strong style={{ color: b.status === 'Paid' ? '#16a34a' : '#0284c7' }}>{b.status || 'Booked'}</strong>
            </div>
          </div>
        </div>

        {/* 2-Column Vendor & Order References */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 16, marginBottom: 16 }}>
          <div style={{ border: '1px solid #cbd5e1', borderRadius: 6, padding: '10px 14px', background: '#f8fafc' }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#0369a1', textTransform: 'uppercase', marginBottom: 4 }}>
              🏢 SUPPLIER / VENDOR DETAILS
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{b.vendorName || b.vendor_name || 'Vendor / Supplier'}</div>
            <div style={{ fontSize: 11, color: '#334155', marginTop: 2 }}>
              GSTIN: <strong>{b.vendorGstin || b.vendor_gstin || 'Unregistered / Exempt'}</strong> {isInter ? '(Inter-State — IGST Applicable)' : '(Intra-State — CGST + SGST Applicable)'}
            </div>
            <div style={{ fontSize: 11, color: '#334155' }}>
              Vendor Invoice Number: <strong style={{ color: '#0369a1' }}>{b.vendor_invoice_number || b.vendorInvoiceNumber || '—'}</strong>
            </div>
            <div style={{ fontSize: 11, color: '#334155' }}>
              Vendor Invoice Date: <strong>{b.invoice_date ? new Date(b.invoice_date).toLocaleDateString('en-IN') : (b.invoiceDate?.slice(0, 10) || '—')}</strong>
            </div>
          </div>

          <div style={{ border: '1px solid #cbd5e1', borderRadius: 6, padding: '10px 14px', background: '#f8fafc' }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#0369a1', textTransform: 'uppercase', marginBottom: 4 }}>
              📋 3-WAY MATCHING &amp; AUDIT TRAIL
            </div>
            <div style={{ fontSize: 11, color: '#334155', marginBottom: 2 }}>
              PO Reference: <strong>{b.poNumber || b.po_number || 'Direct Inward'}</strong>
            </div>
            <div style={{ fontSize: 11, color: '#334155', marginBottom: 2 }}>
              GRN Reference: <strong>{b.grnNumber || b.grn_number || 'Direct Commercial Entry'}</strong>
            </div>
            <div style={{ fontSize: 11, color: '#334155', marginBottom: 2 }}>
              Payment Due Date: <strong>{b.due_date ? new Date(b.due_date).toLocaleDateString('en-IN') : (b.dueDate?.slice(0, 10) || 'Immediate')}</strong>
            </div>
            <div style={{ fontSize: 11, color: '#334155' }}>
              Payment Status: <strong style={{ color: b.status === 'Paid' ? '#16a34a' : '#d97706' }}>{b.status} (Paid: ₹{paidAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })} | Balance: ₹{balanceAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })})</strong>
            </div>
          </div>
        </div>

        {/* GST Tax Matrix */}
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 16, fontSize: 11 }}>
          <thead>
            <tr style={{ background: '#f1f5f9', borderTop: '1px solid #0369a1', borderBottom: '2px solid #0369a1', textAlign: 'left', color: '#0369a1', fontWeight: 800 }}>
              <th style={{ padding: '8px 8px' }}>Description / Commercial Account Head</th>
              <th style={{ padding: '8px 8px', textAlign: 'right', width: 120 }}>Taxable Amount (₹)</th>
              <th style={{ padding: '8px 8px', textAlign: 'right', width: 100 }}>CGST Amount (₹)</th>
              <th style={{ padding: '8px 8px', textAlign: 'right', width: 100 }}>SGST Amount (₹)</th>
              <th style={{ padding: '8px 8px', textAlign: 'right', width: 100 }}>IGST Amount (₹)</th>
              <th style={{ padding: '8px 8px', textAlign: 'right', width: 130 }}>Total Bill Value (₹)</th>
            </tr>
          </thead>
          <tbody>
            <tr style={{ borderBottom: '1px solid #cbd5e1' }}>
              <td style={{ padding: '10px 8px' }}>
                <strong style={{ color: '#0f172a' }}>Raw Materials / Store Spares Procurement</strong>
                <div style={{ fontSize: 10, color: '#64748b' }}>Against PO #{b.poNumber || '—'} &amp; GRN #{b.grnNumber || '—'}</div>
              </td>
              <td style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 700 }}>₹{taxable.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
              <td style={{ padding: '10px 8px', textAlign: 'right', color: '#059669' }}>₹{cgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
              <td style={{ padding: '10px 8px', textAlign: 'right', color: '#059669' }}>₹{sgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
              <td style={{ padding: '10px 8px', textAlign: 'right', color: '#d97706' }}>₹{igst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
              <td style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 800, color: '#0f766e', fontSize: 13 }}>₹{totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
            </tr>
          </tbody>
        </table>

        {/* Valuation & Signatures */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 16, marginBottom: 24 }}>
          <div style={{ border: '1px solid #cbd5e1', borderRadius: 6, padding: '10px 14px', background: '#f8fafc' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#0369a1', marginBottom: 4 }}>Amount in Words:</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#0f172a', fontStyle: 'italic' }}>
              {numberToWords(totalAmount)}
            </div>
            {b.remarks && (
              <div style={{ marginTop: 8, paddingTop: 6, borderTop: '1px solid #e2e8f0', fontSize: 11, color: '#475569' }}>
                <strong>Finance Verification Notes:</strong> {b.remarks}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#64748b' }}>Taxable Subtotal:</span>
              <strong>₹{taxable.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#64748b' }}>Total GST Tax:</span>
              <strong style={{ color: '#059669' }}>₹{totalTax.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '2px solid #0369a1', paddingTop: 4, fontSize: 14 }}>
              <span style={{ fontWeight: 800, color: '#0369a1' }}>Commercial Invoice Total:</span>
              <span style={{ fontWeight: 900, color: '#0369a1' }}>₹{totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>
          </div>
        </div>

        {/* 3 Signatures */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 24, textAlign: 'center', fontSize: 11, color: '#334155', marginTop: 32 }}>
          <div>
            <div style={{ height: 36 }}></div>
            <div style={{ borderTop: '1px solid #94a3b8', paddingTop: 4, fontWeight: 700 }}>Accounts Officer</div>
            <div style={{ fontSize: 10, color: '#64748b' }}>Bill Entry &amp; GST Verification</div>
          </div>
          <div>
            <div style={{ height: 36 }}></div>
            <div style={{ borderTop: '1px solid #94a3b8', paddingTop: 4, fontWeight: 700 }}>Finance Manager</div>
            <div style={{ fontSize: 10, color: '#64748b' }}>Payment Authorizer</div>
          </div>
          <div>
            <div style={{ height: 36 }}></div>
            <div style={{ borderTop: '1px solid #94a3b8', paddingTop: 4, fontWeight: 700 }}>General Manager (Commercial)</div>
            <div style={{ fontSize: 10, color: '#64748b' }}>Final Approval</div>
          </div>
        </div>
      </div>
    )
    setPrintContent(content)
  }

  // Print PO with Official Sri M.K. Paper Mills Format (matching Projects_Requirement/Purchase Order.xlsx)
  const printPO = async (poRow) => {
    let po = poRow
    if (!po.items || !po.items.length) {
      const r = await API(`/api/purchase/po/${poRow.id}`)
      if (r.success) po = r.data
    }
    const isInter = po.tax_type === 'inter' || (po.vendorGstin && !po.vendorGstin.startsWith('36') && !po.vendorGstin.startsWith('29')) || (po.vendorState && !['telangana', 'ts', 'karnataka'].includes(po.vendorState.toLowerCase()))
    
    let totalGross = 0
    let totalDiscount = 0
    let totalOtherCharges = 0
    let totalTaxable = 0
    let totalCgst = 0
    let totalSgst = 0
    let totalIgst = 0

    const calculatedItems = (po.items || []).map((it, i) => {
      const qty = parseFloat(it.qty || 0)
      const unitPrice = parseFloat(it.unit_price || 0)
      const gross = qty * unitPrice
      const discPct = parseFloat(it.discount_pct || 0)
      const discAmt = gross * (discPct / 100)
      const discBase = Math.max(0, gross - discAmt)
      const otherCharges = parseFloat(it.other_charges || 0)
      const lineTaxable = discBase + otherCharges
      const gstPct = parseFloat(it.gst_pct ?? 18)
      
      const cgstPct = isInter ? 0 : gstPct / 2
      const sgstPct = isInter ? 0 : gstPct / 2
      const igstPct = isInter ? gstPct : 0

      const cgstAmt = (lineTaxable * cgstPct) / 100
      const sgstAmt = (lineTaxable * sgstPct) / 100
      const igstAmt = (lineTaxable * igstPct) / 100
      const lineTotal = lineTaxable + cgstAmt + sgstAmt + igstAmt

      totalGross += gross
      totalDiscount += discAmt
      totalOtherCharges += otherCharges
      totalTaxable += lineTaxable
      totalCgst += cgstAmt
      totalSgst += sgstAmt
      totalIgst += igstAmt

      return {
        ...it,
        qty,
        unitPrice,
        gross,
        discPct,
        discAmt,
        otherCharges,
        lineTaxable,
        gstPct,
        cgstPct,
        sgstPct,
        igstPct,
        cgstAmt,
        sgstAmt,
        igstAmt,
        lineTotal,
        remarks: it.remarks || it.purpose || '—'
      }
    })

    const totalTax = totalCgst + totalSgst + totalIgst
    const grandTotal = totalTaxable + totalTax

    const content = (
      <div style={{ fontFamily: 'Arial, sans-serif', color: '#111827' }}>
        {/* ── Official Letterhead Header ── */}
        <div style={{ borderBottom: '2px solid #0f766e', paddingBottom: 8, marginBottom: 12, textAlign: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
            <img src={LOGO_DATA_URI} alt="Logo" style={{ height: 44, width: 'auto', maxWidth: 140, objectFit: 'contain' }} />
            <div>
              <div style={{ fontSize: 22, fontWeight: 900, color: '#0f766e', letterSpacing: 0.5, textTransform: 'uppercase' }}>
                Sri M.K. Paper Mills Pvt. Ltd
              </div>
              <div style={{ fontSize: 11, color: '#374151', marginTop: 1 }}>
                Factory: Gundaram Road, GUNDARAM (VIII), Dist. Nizamabad-503002 (TS)
              </div>
            </div>
          </div>
          <div style={{ marginTop: 6, display: 'inline-block', background: '#0f766e', color: '#ffffff', padding: '3px 18px', borderRadius: 4, fontWeight: 800, fontSize: 14, textTransform: 'uppercase', letterSpacing: 1 }}>
            PURCHASE ORDER
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 11, color: '#1f2937', fontWeight: 600, borderTop: '1px solid #e5e7eb', paddingTop: 4 }}>
            <span>📞 Cell No: <strong>9885488816</strong></span>
            <span>🏛️ GST No: <strong>36AARCS3180K1ZS</strong></span>
          </div>
        </div>

        {/* ── 2-Column Vendor / Order Details Grid (matching Purchase Order.xlsx) ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 10, marginBottom: 12 }}>
          
          {/* Left: Supplier & Party Details */}
          <div style={{ border: '1px solid #94a3b8', borderRadius: 4, padding: '8px 10px', background: '#f8fafc', fontSize: 11 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr', gap: '3px 6px' }}>
              <span style={{ color: '#475569', fontWeight: 700 }}>Supplier Name:</span>
              <span style={{ fontWeight: 800, color: '#0f172a' }}>{po.vendorName || '—'}</span>

              <span style={{ color: '#475569', fontWeight: 700 }}>Party Name:</span>
              <span>{po.vendorContactPerson || po.vendorName || '—'}</span>

              <span style={{ color: '#475569', fontWeight: 700 }}>Address:</span>
              <span>{po.vendorAddress || (po.vendorCity ? `${po.vendorCity}, ${po.vendorState || ''}` : '—')}</span>

              <span style={{ color: '#475569', fontWeight: 700 }}>Cell No:</span>
              <span>{po.vendorMobile || '—'}</span>

              <span style={{ color: '#475569', fontWeight: 700 }}>GST No:</span>
              <span><strong style={{ color: '#0f766e' }}>{po.vendorGstin || 'Unregistered / Exempt'}</strong></span>
            </div>
          </div>

          {/* Right: PO & PR Logistics */}
          <div style={{ border: '1px solid #94a3b8', borderRadius: 4, padding: '8px 10px', background: '#f8fafc', fontSize: 11 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr', gap: '3px 6px' }}>
              <span style={{ color: '#475569', fontWeight: 700 }}>P.O. No:</span>
              <span><strong style={{ color: '#0f766e', fontSize: 12 }}>{po.po_number || po.poNumber}</strong></span>

              <span style={{ color: '#475569', fontWeight: 700 }}>P.O. Date:</span>
              <span><strong>{po.date || po.po_date || po.created_at ? new Date(po.date || po.po_date || po.created_at).toLocaleDateString('en-IN') : new Date().toLocaleDateString('en-IN')}</strong></span>

              <span style={{ color: '#475569', fontWeight: 700 }}>P.R. No:</span>
              <span><strong>{po.indentNumber || po.indent_number || 'Direct PO'}</strong></span>

              <span style={{ color: '#475569', fontWeight: 700 }}>P.R. Date:</span>
              <span><strong>{po.indentDate || po.indent_date || po.date || po.created_at ? new Date(po.indentDate || po.indent_date || po.date || po.created_at).toLocaleDateString('en-IN') : new Date().toLocaleDateString('en-IN')}</strong></span>

              <span style={{ color: '#475569', fontWeight: 700 }}>Department:</span>
              <span><strong>{po.deptName || 'Plant & Operations'}</strong></span>

              <span style={{ color: '#475569', fontWeight: 700 }}>Payment Period:</span>
              <span><strong>{po.payment_terms || po.paymentTerms || '30 Days Net'}</strong></span>
            </div>
          </div>
        </div>

        {/* ── Line Items Table matching Purchase Order.xlsx columns ── */}
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 12, fontSize: 11, border: '1px solid #94a3b8' }}>
          <thead>
            <tr style={{ background: '#f1f5f9', borderBottom: '2px solid #0f766e', textAlign: 'left', color: '#0f766e', fontWeight: 800 }}>
              <th style={{ border: '1px solid #cbd5e1', padding: '6px 4px', width: 30, textAlign: 'center' }}>S.NO</th>
              <th style={{ border: '1px solid #cbd5e1', padding: '6px 6px', width: 85 }}>Item Code</th>
              <th style={{ border: '1px solid #cbd5e1', padding: '6px 6px' }}>Product Name</th>
              <th style={{ border: '1px solid #cbd5e1', padding: '6px 6px', textAlign: 'right', width: 60 }}>Qty</th>
              <th style={{ border: '1px solid #cbd5e1', padding: '6px 6px', textAlign: 'right', width: 75 }}>Rate/Price</th>
              <th style={{ border: '1px solid #cbd5e1', padding: '6px 6px', textAlign: 'right', width: 85 }}>Total Value</th>
              <th style={{ border: '1px solid #cbd5e1', padding: '6px 4px', textAlign: 'right', width: 55 }}>Disc %</th>
              <th style={{ border: '1px solid #cbd5e1', padding: '6px 6px', textAlign: 'right', width: 80 }}>GST %</th>
              <th style={{ border: '1px solid #cbd5e1', padding: '6px 6px', width: 110 }}>Remarks</th>
            </tr>
          </thead>
          <tbody>
            {calculatedItems.map((it, i) => (
              <tr key={i} style={{ borderBottom: '1px solid #cbd5e1' }}>
                <td style={{ border: '1px solid #e2e8f0', padding: '6px 4px', textAlign: 'center', color: '#64748b' }}>{i + 1}</td>
                <td style={{ border: '1px solid #e2e8f0', padding: '6px 6px', fontFamily: 'monospace', fontWeight: 600 }}>{it.materialCode || it.material_id || '—'}</td>
                <td style={{ border: '1px solid #e2e8f0', padding: '6px 6px' }}>
                  <div style={{ fontWeight: 700, color: '#0f172a' }}>{it.materialName || it.description}</div>
                  {it.uom && <div style={{ fontSize: 10, color: '#64748b' }}>UOM: {it.uom}</div>}
                </td>
                <td style={{ border: '1px solid #e2e8f0', padding: '6px 6px', textAlign: 'right', fontWeight: 700 }}>{parseFloat(it.qty || 0).toFixed(2)}</td>
                <td style={{ border: '1px solid #e2e8f0', padding: '6px 6px', textAlign: 'right' }}>₹{it.unitPrice.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                <td style={{ border: '1px solid #e2e8f0', padding: '6px 6px', textAlign: 'right', fontWeight: 700 }}>₹{it.gross.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                <td style={{ border: '1px solid #e2e8f0', padding: '6px 4px', textAlign: 'right', color: it.discPct > 0 ? '#b45309' : '#64748b' }}>
                  {it.discPct > 0 ? `${it.discPct}%` : '0%'}
                </td>
                <td style={{ border: '1px solid #e2e8f0', padding: '6px 6px', textAlign: 'right' }}>
                  <span style={{ fontWeight: 600 }}>{it.gstPct}%</span>
                  <div style={{ fontSize: 9, color: '#059669' }}>
                    {!isInter ? `₹${(it.cgstAmt + it.sgstAmt).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : `₹${it.igstAmt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}
                  </div>
                </td>
                <td style={{ border: '1px solid #e2e8f0', padding: '6px 6px', fontSize: 10, color: '#475569' }}>{it.remarks || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* ── Bottom Section: Bank Details (Left) + Tax Subtotals (Right) ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: 12, marginBottom: 12, alignItems: 'start' }}>
          
          {/* Left Box: Bank Details */}
          <div style={{ border: '1px solid #94a3b8', borderRadius: 4, padding: '8px 10px', background: '#f8fafc', fontSize: 11 }}>
            <div style={{ fontWeight: 800, color: '#0f766e', borderBottom: '1px solid #cbd5e1', paddingBottom: 3, marginBottom: 5 }}>
              🏦 BANK DETAILS
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr', gap: '3px 6px' }}>
              <span style={{ color: '#475569', fontWeight: 700 }}>Bank Name:</span>
              <span style={{ fontWeight: 700 }}>{po.vendorBankName || 'State Bank of India'}</span>

              <span style={{ color: '#475569', fontWeight: 700 }}>Account Number:</span>
              <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{po.vendorAccountNumber || '39824892842'}</span>

              <span style={{ color: '#475569', fontWeight: 700 }}>IFSC Code:</span>
              <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{po.vendorIfscCode || 'SBIN0020188'}</span>

              <span style={{ color: '#475569', fontWeight: 700 }}>Branch Name:</span>
              <span>{po.vendorBranchName || 'Nizamabad Central / Gundaram'}</span>
            </div>

            {po.remarks && (
              <div style={{ marginTop: 6, paddingTop: 4, borderTop: '1px solid #cbd5e1', fontSize: 10, color: '#334155' }}>
                <strong>Remarks / Scope:</strong> {po.remarks}
              </div>
            )}
          </div>

          {/* Right Box: Calculations matching Purchase Order.xlsx */}
          <div style={{ border: '1px solid #94a3b8', borderRadius: 4, padding: '8px 10px', background: '#ffffff', fontSize: 11 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                <tr>
                  <td style={{ padding: '3px 4px', color: '#475569', fontWeight: 600 }}>Sub Total:</td>
                  <td style={{ padding: '3px 4px', textAlign: 'right', fontWeight: 700 }}>₹{totalGross.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                </tr>
                {totalDiscount > 0 && (
                  <tr>
                    <td style={{ padding: '3px 4px', color: '#b45309', fontWeight: 600 }}>Discount:</td>
                    <td style={{ padding: '3px 4px', textAlign: 'right', fontWeight: 700, color: '#b45309' }}>-₹{totalDiscount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                  </tr>
                )}
                <tr style={{ borderTop: '1px solid #e2e8f0' }}>
                  <td style={{ padding: '3px 4px', color: '#0f172a', fontWeight: 700 }}>Net Taxable Sub Total:</td>
                  <td style={{ padding: '3px 4px', textAlign: 'right', fontWeight: 700 }}>₹{totalTaxable.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                </tr>
                {!isInter ? (
                  <>
                    <tr>
                      <td style={{ padding: '3px 4px', color: '#059669' }}>SGST (State Tax):</td>
                      <td style={{ padding: '3px 4px', textAlign: 'right', fontWeight: 600, color: '#059669' }}>₹{totalSgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    </tr>
                    <tr>
                      <td style={{ padding: '3px 4px', color: '#059669' }}>CGST (Central Tax):</td>
                      <td style={{ padding: '3px 4px', textAlign: 'right', fontWeight: 600, color: '#059669' }}>₹{totalCgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    </tr>
                  </>
                ) : (
                  <tr>
                    <td style={{ padding: '3px 4px', color: '#d97706' }}>IGST (Interstate Tax):</td>
                    <td style={{ padding: '3px 4px', textAlign: 'right', fontWeight: 600, color: '#d97706' }}>₹{totalIgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                  </tr>
                )}
                {totalOtherCharges > 0 && (
                  <tr>
                    <td style={{ padding: '3px 4px', color: '#0369a1' }}>Freight / Other Charges:</td>
                    <td style={{ padding: '3px 4px', textAlign: 'right', fontWeight: 600, color: '#0369a1' }}>+₹{totalOtherCharges.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                  </tr>
                )}
                <tr style={{ borderTop: '2px solid #0f766e', background: '#f0fdf4' }}>
                  <td style={{ padding: '6px 4px', fontWeight: 800, fontSize: 12, color: '#0f766e' }}>Total Purchase Amount:</td>
                  <td style={{ padding: '6px 4px', textAlign: 'right', fontWeight: 900, fontSize: 13, color: '#0f766e' }}>₹{grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Total Amount in Words ── */}
        <div style={{ border: '1px solid #cbd5e1', borderRadius: 4, padding: '6px 10px', background: '#f8fafc', fontSize: 11, marginBottom: 16 }}>
          <span style={{ fontWeight: 700, color: '#0f766e' }}>Total Amount (in words): </span>
          <span style={{ fontWeight: 800, color: '#0f172a' }}>{numberToWords(grandTotal)}</span>
        </div>

        {/* ── 3 Signatures matching Purchase Order.xlsx ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, textAlign: 'center', fontSize: 11, color: '#334155', marginTop: 24 }}>
          <div style={{ borderTop: '1px solid #64748b', paddingTop: 6 }}>
            <div style={{ fontWeight: 800, color: '#0f172a' }}>Store Dept</div>
            <div style={{ fontSize: 10, color: '#64748b' }}>Store In-Charge / Requisitioner</div>
          </div>
          <div style={{ borderTop: '1px solid #64748b', paddingTop: 6 }}>
            <div style={{ fontWeight: 800, color: '#0f172a' }}>Head Of Dept</div>
            <div style={{ fontSize: 10, color: '#64748b' }}>Technical / Department Head</div>
          </div>
          <div style={{ borderTop: '1px solid #64748b', paddingTop: 6 }}>
            <div style={{ fontWeight: 800, color: '#0f172a' }}>M.D Approval</div>
            <div style={{ fontSize: 10, color: '#64748b' }}>Managing Director / Authorized</div>
          </div>
        </div>
      </div>
    )
    setPrintContent(content)
  }

  const totalPages=Math.ceil(total/LIMIT)
  const lineTotal=(it)=>((parseFloat(it.qty)||0)*(parseFloat(it.unit_price)||0)).toLocaleString('en-IN',{minimumFractionDigits:2})

  return(
    <div style={S.page}>
      {/* Print overlay */}
      {printContent&&<PrintFrame content={printContent} onClose={()=>setPrintContent(null)} />}

      <div style={S.header}>
        <div>
          <div style={S.title}>Procurement &amp; Vendor Management</div>
          <div style={S.sub}>Purchase Orders · Goods Receipt Notes (GRN) · Purchase Invoices &amp; Bills · End-to-End P2P Lifecycle</div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button style={S.btnPrimary} onClick={openNew}>+ Create PO</button>
        </div>
      </div>

      {/* ── MULTI-AGENT SYNCHRONIZATION & TELEMETRY BAR ── */}
      <AgentStatusBanner currentModule="procurement" />

      {/* Tabs */}
      <div style={{ marginBottom: 16 }}>
        <ScrollableTabs
          tabs={[
            { id: 'pr', label: '📋 Purchase Requisitions (PR / Indents)', badge: prList.filter(x => !x.linkedPoId).length || undefined },
            { id: 'orders', label: '🛒 Purchase Orders (PO)' },
            { id: 'cash', label: '💵 Cash Purchases (Spot Procurement)' },
            { id: 'grn', label: '📥 Goods Receipt Notes (GRN)' },
            { id: 'bills', label: '🧾 Purchase Invoices & Bills (Purchase Entry)' },
            { id: 'pipeline', label: '📊 P2P Full Lifecycle Pipeline' }
          ]}
          activeTab={tab}
          onSelectTab={setTab}
          style={{ borderBottom: '2px solid #1b1b1d' }}
          tabStyle={{
            padding: '8px 16px',
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

      {/* ── TAB 0: PURCHASE REQUISITIONS (PR / INDENTS) ── */}
      {tab === 'pr' && (
        <div>
          <div style={S.filterBar}>
            <input
              style={{ ...S.input, maxWidth: 320 }}
              placeholder="🔍 Search PR No, Department, Raised By, Purpose..."
              value={prSearch}
              onChange={e => setPrSearch(e.target.value)}
            />
            <select style={S.select} value={prFilterStatus} onChange={e => setPrFilterStatus(e.target.value)}>
              <option value="">All Fulfillment Statuses</option>
              <option value="pending">Pending PO Conversion</option>
              <option value="po_created">PO Created</option>
              <option value="cash_purchased">Cash Purchased</option>
            </select>
            <button style={S.btnSecondary} onClick={loadPendingIndents}>↻ Refresh Requisitions</button>
            <button style={{ ...S.btnPrimary, marginLeft: 'auto', background: '#0f766e' }} onClick={() => openNew()}>+ Create Direct PO</button>
          </div>

          <TableScrollWrapper title="Purchase Requisitions (PR / Indents)">
            {prLoading ? <div style={S.loading}>Loading Purchase Requisitions...</div> : (
              <table style={S.table}>
                <thead>
                  <tr style={S.thead}>
                    {['PR Number', 'Date', 'Department', 'Indentor', 'Priority', 'Items Summary', 'Est. Value', 'Status', 'Linked Document', 'Actions'].map(h => (
                      <th key={h} style={S.th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {prList
                    .filter(ind => {
                      if (prFilterStatus === 'pending') return !ind.linkedPoId && ind.status !== 'Cash Purchased'
                      if (prFilterStatus === 'po_created') return !!ind.linkedPoId
                      if (prFilterStatus === 'cash_purchased') return ind.status === 'Cash Purchased'
                      return true
                    })
                    .map(ind => (
                      <tr key={ind.id} style={S.tr}>
                        <td style={S.td}>
                          <a
                            href={`/indent`}
                            onClick={e => { e.preventDefault(); window.location.href = `/indent` }}
                            style={{ color: '#0f766e', fontWeight: 700, fontSize: 13, textDecoration: 'none' }}
                          >
                            📋 {ind.indentNumber}
                          </a>
                        </td>
                        <td style={S.td}><span style={S.muted}>{ind.date?.slice(0, 10)}</span></td>
                        <td style={S.td}>
                          <strong>{ind.deptName || 'Department'}</strong>
                          {ind.deptCode && <span style={{ fontSize: 10, color: '#64748b', marginLeft: 4 }}>({ind.deptCode})</span>}
                        </td>
                        <td style={S.td}>
                          <div>{ind.raisedByName || 'Indentor'}</div>
                          {ind.raisedByEmpCode && <div style={{ fontSize: 10, color: '#64748b' }}>{ind.raisedByEmpCode}</div>}
                        </td>
                        <td style={S.td}>
                          <span style={{
                            padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 700,
                            background: ind.priority === 'Urgent' ? '#fee2e2' : (ind.priority === 'High' ? '#fef3c7' : '#f1f5f9'),
                            color: ind.priority === 'Urgent' ? '#dc2626' : (ind.priority === 'High' ? '#b45309' : '#475569')
                          }}>
                            {ind.priority}
                          </span>
                        </td>
                        <td style={S.td}>
                          <div style={{ fontWeight: 600, color: '#0f172a' }}>{ind.items?.length || 0} Material Line(s)</div>
                          <div style={{ fontSize: 11, color: '#64748b', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {(ind.items || []).map(x => `${x.materialName} (${x.required_qty} ${x.uom})`).join(', ')}
                          </div>
                        </td>
                        <td style={S.td}><span style={{ color: '#15803d', fontWeight: 700 }}>{fmt(ind.totalValue)}</span></td>
                        <td style={S.td}>
                          <span style={{
                            padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 700,
                            background: ind.linkedPoId ? '#e0f2fe' : (ind.status === 'Cash Purchased' ? '#dcfce7' : '#fef9c3'),
                            color: ind.linkedPoId ? '#0369a1' : (ind.status === 'Cash Purchased' ? '#15803d' : '#854d0e')
                          }}>
                            {ind.linkedPoId ? 'PO Created' : (ind.status || 'Submitted')}
                          </span>
                        </td>
                        <td style={S.td}>
                          {ind.linkedPoNumber ? (
                            <span style={{ background: '#e0f2fe', color: '#0369a1', padding: '2px 6px', borderRadius: 4, fontSize: 11, fontWeight: 700 }}>
                              🛒 {ind.linkedPoNumber}
                            </span>
                          ) : (
                            ind.status === 'Cash Purchased' ? (
                              <span style={{ background: '#dcfce7', color: '#15803d', padding: '2px 6px', borderRadius: 4, fontSize: 11, fontWeight: 700 }}>
                                💵 Cash Purchased
                              </span>
                            ) : (
                              <span style={{ color: '#94a3b8', fontSize: 11, fontStyle: 'italic' }}>Pending Fulfillment</span>
                            )
                          )}
                        </td>
                        <td style={S.td}>
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            {!ind.linkedPoId && ind.status !== 'Cash Purchased' && (
                              <>
                                <button
                                  style={{ ...S.btnPrimary, background: '#0f766e', padding: '4px 10px', fontSize: 11, fontWeight: 700 }}
                                  onClick={() => openNew(ind)}
                                  title="1-Click Convert PR to Purchase Order"
                                >
                                  🛒 Convert to PO
                                </button>
                                <button
                                  style={{ ...S.btnSecondary, borderColor: '#16a34a', color: '#16a34a', padding: '4px 8px', fontSize: 11, fontWeight: 700 }}
                                  onClick={() => openCashFromIndent(ind)}
                                  title="Direct Cash / Spot Purchase with Stock Update"
                                >
                                  💵 Cash Purchase
                                </button>
                              </>
                            )}
                            {ind.linkedPoId && (
                              <button
                                style={{ ...S.btnIcon, color: '#0369a1' }}
                                onClick={() => { setTab('orders'); setFStatus('') }}
                                title="View in PO Register"
                              >
                                👁️ View PO
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  {prList.length === 0 && (
                    <tr><td colSpan={10} style={S.empty}>No purchase requisitions found.</td></tr>
                  )}
                </tbody>
              </table>
            )}
          </TableScrollWrapper>
        </div>
      )}

      {/* ── TAB 1: PURCHASE ORDERS ── */}
      {tab === 'orders' && (
        <div>
          <div style={S.filterBar}>
            <select style={S.select} value={fStatus} onChange={e=>{setFStatus(e.target.value);setPage(1)}}>
              <option value="">All Status</option>
              {['Draft','Approved','Sent','Partial','Received','Closed','Cancelled'].map(s=><option key={s}>{s}</option>)}
            </select>
            <button style={S.btnSecondary} onClick={load}>↻ Refresh</button>
            <button style={{ ...S.btnSecondary, marginLeft: 'auto' }} onClick={exportOrdersToCSV}>📊 Export to CSV</button>
          </div>
          <TableScrollWrapper title="Purchase Orders (PO)">
            {loading?<div style={S.loading}>Loading...</div>:(
              <table style={S.table}><thead><tr style={S.thead}>
                {['PO No','Date','Vendor','PR Reference','Delivery','Total','Status','Actions'].map(h=><th key={h} style={S.th}>{h}</th>)}
              </tr></thead><tbody>
                {rows.length===0&&<tr><td colSpan={8} style={S.empty}>No purchase orders</td></tr>}
                {rows.map(r=>(
                  <tr key={r.id} style={S.tr}>
                    <td style={S.td}><span style={S.code}>{r.poNumber}</span></td>
                    <td style={S.td}><span style={S.muted}>{r.date?.slice(0,10)}</span></td>
                    <td style={S.td}><strong>{r.vendorName}</strong></td>
                    <td style={S.td}>
                      {r.indentNumber ? (
                        <div>
                          <a
                            href={`/indent`}
                            onClick={e => { e.preventDefault(); window.location.href = `/indent` }}
                            style={{ color: '#0f766e', fontWeight: 700, fontSize: 12, textDecoration: 'none' }}
                            title="View Purchase Request"
                          >
                            📋 {r.indentNumber}
                          </a>
                          {r.deptName && <div style={{ fontSize: 10, color: '#64748b' }}>{r.deptName}</div>}
                        </div>
                      ) : (
                        <span style={{ color: '#94a3b8', fontSize: 11, fontStyle: 'italic' }}>Direct PO</span>
                      )}
                    </td>
                    <td style={S.td}><span style={S.muted}>{r.deliveryDate?.slice(0,10)||'—'}</span></td>
                    <td style={S.td}><span style={S.num}>{fmt(r.grandTotal)}</span></td>
                    <td style={S.td}><span style={{...S.badge,background:STATUS_COLOR[r.status]+'22',color:STATUS_COLOR[r.status],border:`1px solid ${STATUS_COLOR[r.status]}44`}}>{r.status}</span></td>
                    <td style={S.td}>
                      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                        <button style={S.btnIcon} onClick={()=>openDetail(r.id)} title="View PO Details">👁</button>
                        <button style={{ ...S.btnIcon, color: '#0f766e' }} onClick={()=>printPO(r)} title="Print Purchase Order">🖨</button>
                        {(r.status==='Draft'||r.status==='Submitted')&&<button style={{ ...S.btnIcon, color: '#16a34a' }} onClick={()=>approve(r.id)} title="Approve Purchase Order">✅</button>}
                        {!['Received', 'Closed'].includes(r.status)&&<button style={{ ...S.btnIcon, color: '#d97706' }} onClick={async()=>{const d=await API(`/api/purchase/po/${r.id}`);if(d.success)openEdit(d.data)}} title="Edit PO (Items, Date, Rates, Discounts, Terms)">✏️</button>}
                        {!['Received', 'Closed'].includes(r.status)&&!r.grnNumber&&!r.grnId&&<button style={{ ...S.btnIcon, color: '#dc2626' }} onClick={()=>deletePO(r.id, r.poNumber)} title="Delete PO & Restore Indent">🗑</button>}
                        {(r.status==='Approved'||r.status==='Submitted')&&!r.grnNumber&&!r.grnId&&<button style={{ ...S.btnIcon, color: '#64748b' }} onClick={()=>cancelPO(r.id)} title="Cancel PO">🚫</button>}
                        {(r.status==='Approved'||r.status==='Partial')&&<button style={{ ...S.btnIcon, color: '#0d9488' }} onClick={()=>openGRN(r)} title="Receive GRN">📦</button>}
                        {(r.status==='Received'||r.status==='Partial'||r.status==='Approved')&&<button style={{...S.btnIcon, color: '#0369a1'}} onClick={()=>openBill(r)} title="Book Vendor Bill for Finance">🧾</button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody></table>
            )}
          </TableScrollWrapper>
          <div style={S.pagination}>
            <span style={S.count}>Showing {rows.length} of {total}</span>
            <div style={{display:'flex',gap:6}}>
              <button style={S.pgBtn} disabled={page===1} onClick={()=>setPage(p=>p-1)}>‹ Prev</button>
              <span style={S.pgInfo}>{page}/{totalPages||1}</span>
              <button style={S.pgBtn} disabled={page>=totalPages} onClick={()=>setPage(p=>p+1)}>Next ›</button>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 1B: CASH PURCHASES / SPOT PROCUREMENT ── */}
      {tab === 'cash' && (
        <div>
          <div style={S.filterBar}>
            <input
              style={{ ...S.input, maxWidth: 320 }}
              placeholder="🔍 Search Voucher No, Supplier, Memo No, Indent..."
              value={cashSearch}
              onChange={e => setCashSearch(e.target.value)}
            />
            <button style={S.btnSecondary} onClick={loadCashPurchases}>↻ Refresh Cash Purchases</button>
            <button style={{ ...S.btnPrimary, marginLeft: 'auto', background: '#16a34a' }} onClick={openNewCashPurchase}>
              💵 + New Cash Purchase
            </button>
          </div>

          <TableScrollWrapper title="Cash Purchases (Spot Procurement)">
            {cashLoading ? <div style={S.loading}>Loading Cash Purchases...</div> : (
              <table style={S.table}>
                <thead>
                  <tr style={S.thead}>
                    {['Voucher No', 'Date', 'Supplier / Shop', 'Cash Memo / Inv', 'Items', 'Taxable Amt', 'Total Paid', 'Mode', 'PR Link', 'Purchaser', 'Actions'].map(h => (
                      <th key={h} style={S.th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {cashList.map(cp => (
                    <tr key={cp.id} style={S.tr}>
                      <td style={S.td}>
                        <span
                          style={{ ...S.code, color: '#16a34a', cursor: 'pointer', textDecoration: 'underline' }}
                          onClick={() => printCashVoucher(cp)}
                          title="Click to Print Official Cash Purchase Voucher"
                        >
                          {cp.voucherNumber || cp.voucher_number}
                        </span>
                      </td>
                      <td style={S.td}><span style={S.muted}>{cp.date?.slice(0, 10)}</span></td>
                      <td style={S.td}>
                        <strong>{cp.vendorName || cp.vendor_name}</strong>
                        {cp.vendorGstin && <div style={{ fontSize: 10, color: '#64748b' }}>GST: {cp.vendorGstin}</div>}
                      </td>
                      <td style={S.td}>
                        <div>{cp.invoiceNumber || cp.invoice_number || 'Cash Memo'}</div>
                      </td>
                      <td style={S.td}>
                        <span style={{ fontWeight: 600 }}>{cp.itemCount || 0} Part(s)</span>
                      </td>
                      <td style={S.td}>{fmt(cp.taxableAmount || cp.taxable_amount)}</td>
                      <td style={S.td}><span style={{ color: '#15803d', fontWeight: 800 }}>{fmt(cp.totalAmount || cp.total_amount)}</span></td>
                      <td style={S.td}>
                        <span style={{ background: '#dcfce7', color: '#15803d', padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 700 }}>
                          {cp.payment_mode || cp.paymentMode || 'Cash'}
                        </span>
                      </td>
                      <td style={S.td}>
                        {cp.indentNumber ? (
                          <span style={{ color: '#0f766e', fontWeight: 600 }}>📋 {cp.indentNumber}</span>
                        ) : (
                          <span style={{ color: '#94a3b8', fontSize: 11, fontStyle: 'italic' }}>Direct</span>
                        )}
                      </td>
                      <td style={S.td}><span style={S.muted}>{cp.createdByName || 'Staff'}</span></td>
                      <td style={S.td}>
                        <button
                          style={{ ...S.btnIcon, color: '#16a34a', fontWeight: 700, fontSize: 12 }}
                          onClick={() => printCashVoucher(cp)}
                          title="Print Cash Purchase Voucher"
                        >
                          🖨️ Voucher
                        </button>
                      </td>
                    </tr>
                  ))}
                  {cashList.length === 0 && (
                    <tr><td colSpan={11} style={S.empty}>No cash purchases recorded yet.</td></tr>
                  )}
                </tbody>
              </table>
            )}
          </TableScrollWrapper>
        </div>
      )}

      {/* ── TAB 2: GOODS RECEIPT NOTES (GRN) ── */}
      {tab === 'grn' && (
        <div>
          <div style={S.filterBar}>
            <input
              style={{ ...S.input, maxWidth: 320 }}
              placeholder="🔍 Search GRN No, PO No, Vendor, Invoice, Challan..."
              value={grnSearch}
              onChange={e => setGrnSearch(e.target.value)}
            />
            <button style={S.btnSecondary} onClick={loadGRNs}>↻ Refresh GRNs</button>
          </div>
          <TableScrollWrapper title="Goods Receipt Notes (GRN)">
            {grnLoading ? <div style={S.loading}>Loading GRN shipments...</div> : (
              <table style={S.table}>
                <thead>
                  <tr style={S.thead}>
                    {['GRN Number', 'Date', 'PO Reference', 'Vendor', 'Challan / Invoice', 'Vehicle No', 'Accepted Value', 'Status', 'Received By', 'Actions'].map(h => (
                      <th key={h} style={S.th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {grnList.map(g => (
                    <tr key={g.id} style={S.tr}>
                      <td style={S.td}>
                        <span
                          style={{ ...S.code, cursor: 'pointer', textDecoration: 'underline' }}
                          onClick={() => printGRNDocument(g)}
                          title="Click to View & Print Goods Receipt Note"
                        >
                          {g.grnNumber}
                        </span>
                      </td>
                      <td style={S.td}><span style={S.muted}>{g.date?.slice(0, 10)}</span></td>
                      <td style={S.td}><span style={{ color: '#0369a1', fontWeight: 600 }}>{g.poNumber || '—'}</span></td>
                      <td style={S.td}><strong>{g.vendorName}</strong></td>
                      <td style={S.td}>
                        <div>{g.invoiceNumber ? `Inv: ${g.invoiceNumber}` : ''}</div>
                        <div style={{ fontSize: 11, color: '#64748b' }}>{g.challanNumber ? `DC: ${g.challanNumber}` : ''}</div>
                      </td>
                      <td style={S.td}><span style={S.muted}>{g.vehicleNumber || '—'}</span></td>
                      <td style={S.td}><span style={{ color: '#15803d', fontWeight: 700 }}>{fmt(g.totalValue)}</span></td>
                      <td style={S.td}>
                        <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: g.status === 'Approved' ? '#dcfce7' : '#fef9c3', color: g.status === 'Approved' ? '#15803d' : '#854d0e' }}>
                          {g.status || 'Received'}
                        </span>
                      </td>
                      <td style={S.td}><span style={S.muted}>{g.receivedByName || 'Store Clerk'}</span></td>
                      <td style={S.td}>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          <button
                            style={{ ...S.btnIcon, color: '#0f766e', fontWeight: 600, fontSize: 12 }}
                            onClick={() => printGRNDocument(g)}
                            title="View & Print Official GRN Note"
                          >
                            🖨️ Note
                          </button>
                          <button
                            style={{ ...S.btnIcon, color: '#d97706', fontWeight: 600, fontSize: 12 }}
                            onClick={() => openEditGrn(g)}
                            title="Edit GRN Quantities, Rates, Discounts, Other Charges & Taxes"
                          >
                            ✏️ Edit
                          </button>
                          <button
                            style={{ ...S.btnIcon, color: '#0369a1', fontWeight: 600, fontSize: 12 }}
                            onClick={() => openBill({ id: g.poId, poNumber: g.poNumber, vendorName: g.vendorName, grandTotal: g.totalValue })}
                            title="Book Purchase Bill for Finance"
                          >
                            🧾 Bill
                          </button>
                          {isStoreManager && (
                            <button
                              style={{ ...S.btnIcon, color: '#dc2626', fontWeight: 600, fontSize: 12 }}
                              onClick={() => handleDeleteGrn(g)}
                              title="Store Manager: Void & Delete GRN with Stock Rollback"
                            >
                              🗑️ Delete
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {grnList.length === 0 && (
                    <tr>
                      <td colSpan={10} style={S.empty}>No GRN records found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </TableScrollWrapper>
        </div>
      )}

      {/* ── TAB 3: PURCHASE INVOICES & BILLS (PURCHASE ENTRY) ── */}
      {tab === 'bills' && (
        <div>
          <div style={S.filterBar}>
            <input
              style={{ ...S.input, maxWidth: 320 }}
              placeholder="🔍 Search Bill No, Vendor, Invoice, PO, GRN..."
              value={billSearch}
              onChange={e => setBillSearch(e.target.value)}
            />
            <button style={S.btnSecondary} onClick={loadBills}>↻ Refresh Bills</button>
          </div>
          <TableScrollWrapper title="Purchase Invoices & Bills">
            {billLoading ? <div style={S.loading}>Loading Purchase Invoices...</div> : (
              <table style={S.table}>
                <thead>
                  <tr style={S.thead}>
                    {['Bill Number', 'Vendor & Invoice No', 'PO & GRN Ref', 'Invoice Date', 'Taxable Amount', 'Total Amount', 'Paid Amount', 'Balance Due', 'Status', 'Actions'].map(h => (
                      <th key={h} style={S.th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {billList.map(b => (
                    <tr key={b.id} style={S.tr}>
                      <td style={S.td}><span style={S.code}>{b.billNumber}</span></td>
                      <td style={S.td}>
                        <div style={{ fontWeight: 600 }}>{b.vendorName}</div>
                        <div style={{ fontSize: 11, color: '#64748b' }}>Inv: <strong>{b.vendorInvoiceNumber}</strong></div>
                      </td>
                      <td style={S.td}>
                        <div style={{ color: '#0369a1', fontWeight: 600 }}>{b.poNumber}</div>
                        <div style={{ fontSize: 11, color: '#16a34a' }}>{b.grnNumber ? `GRN: ${b.grnNumber}` : ''}</div>
                      </td>
                      <td style={S.td}>{b.invoiceDate?.slice(0, 10)}</td>
                      <td style={S.td}>{fmt(b.taxableAmount)}</td>
                      <td style={S.td}><span style={{ fontWeight: 700, color: '#1b1b1d' }}>{fmt(b.totalAmount)}</span></td>
                      <td style={S.td}><span style={{ color: '#16a34a', fontWeight: 600 }}>{fmt(b.paidAmount)}</span></td>
                      <td style={S.td}>
                        <span style={{ color: parseFloat(b.balanceAmount) > 0 ? '#dc2626' : '#16a34a', fontWeight: 700 }}>
                          {fmt(b.balanceAmount)}
                        </span>
                      </td>
                      <td style={S.td}>
                        <span style={{
                          padding: '3px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600,
                          background: b.status === 'Paid' ? '#dcfce7' : (b.status === 'Approved' ? '#e0f2fe' : '#fef3c7'),
                          color: b.status === 'Paid' ? '#15803d' : (b.status === 'Approved' ? '#0369a1' : '#b45309')
                        }}>
                          {b.status}
                        </span>
                      </td>
                      <td style={S.td}>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          <button
                            style={{ ...S.btnIcon, color: '#0369a1', fontWeight: 600, fontSize: 12 }}
                            onClick={() => printBillDocument(b)}
                            title="View & Print Official Commercial Bill"
                          >
                            🖨️ Tax Invoice
                          </button>
                          {isStoreManager && b.status !== 'Paid' && (
                            <button
                              style={{ ...S.btnIcon, color: '#dc2626', fontWeight: 600, fontSize: 12 }}
                              onClick={() => handleDeleteBill(b)}
                              title="Store Manager: Delete Unpaid Vendor Invoice / Bill"
                            >
                              🗑️ Delete
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {billList.length === 0 && (
                    <tr>
                      <td colSpan={10} style={S.empty}>No purchase invoices booked yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </TableScrollWrapper>
        </div>
      )}

      {/* ── TAB 4: P2P FULL LIFECYCLE PIPELINE ── */}
      {tab === 'pipeline' && (
        <div>
          <div style={S.filterBar}>
            <input
              style={{ ...S.input, maxWidth: 360 }}
              placeholder="🔍 Search Pipeline (PO, Indent, Vendor, GRN, Bill)..."
              value={pipeSearch}
              onChange={e => setPipeSearch(e.target.value)}
            />
            <button style={S.btnSecondary} onClick={loadPipeline}>↻ Refresh Pipeline</button>
          </div>

          {pipeLoading ? <div style={S.loading}>Loading P2P lifecycle pipeline...</div> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {pipelineList.map(item => (
                <div key={item.poId} style={{ background: '#ffffff', borderRadius: 10, padding: 18, border: '1px solid #e7e6df', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10, borderBottom: '1px solid #f1f5f9', paddingBottom: 12 }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 16, fontWeight: 700, color: '#1b1b1d' }}>PO: {item.poNumber}</span>
                        <span style={{ fontSize: 13, color: '#64748b' }}>· Vendor: <strong>{item.vendorName}</strong> ({item.vendorCode})</span>
                      </div>
                      <div style={{ fontSize: 12, color: '#64748b', marginTop: 3 }}>
                        PO Date: {item.poDate?.slice(0, 10)} · Total Value: <strong>{fmt(item.poGrandTotal)}</strong>
                      </div>
                    </div>
                    <div>
                      <span style={{
                        background: item.stageBadgeBg, color: item.stageBadgeColor,
                        padding: '4px 12px', borderRadius: 16, fontSize: 12, fontWeight: 700
                      }}>
                        {item.stageTitle}
                      </span>
                    </div>
                  </div>

                  {/* 5-Step Visual Timeline */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginTop: 14 }}>
                    {/* 1. Indent */}
                    <div style={{ background: item.indentNumber ? '#f0fdf4' : '#f8fafc', padding: 10, borderRadius: 8, border: `1px solid ${item.indentNumber ? '#bbf7d0' : '#e2e8f0'}` }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>1. Indent</div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: item.indentNumber ? '#15803d' : '#94a3b8', marginTop: 2 }}>
                        {item.indentNumber || 'Direct PO'}
                      </div>
                      {item.deptName && <div style={{ fontSize: 11, color: '#64748b' }}>{item.deptName}</div>}
                    </div>

                    {/* 2. Purchase Order */}
                    <div style={{ background: '#f0f9ff', padding: 10, borderRadius: 8, border: '1px solid #bae6fd' }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: '#0369a1', textTransform: 'uppercase' }}>2. Purchase Order</div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#0369a1', marginTop: 2 }}>{item.poNumber}</div>
                      <div style={{ fontSize: 11, color: '#64748b' }}>Status: {item.poStatus}</div>
                    </div>

                    {/* 3. GRN */}
                    <div style={{ background: item.grnNumber ? '#fffbeb' : '#f8fafc', padding: 10, borderRadius: 8, border: `1px solid ${item.grnNumber ? '#fde68a' : '#e2e8f0'}` }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: item.grnNumber ? '#b45309' : '#94a3b8', textTransform: 'uppercase' }}>3. GRN (Inward)</div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: item.grnNumber ? '#b45309' : '#94a3b8', marginTop: 2 }}>
                        {item.grnNumber || 'Pending Delivery'}
                      </div>
                      {item.grnInvoiceNumber && <div style={{ fontSize: 11, color: '#64748b' }}>Inv: {item.grnInvoiceNumber}</div>}
                    </div>

                    {/* 4. Purchase Bill */}
                    <div style={{ background: item.billNumber ? '#f5f3ff' : '#f8fafc', padding: 10, borderRadius: 8, border: `1px solid ${item.billNumber ? '#ddd6fe' : '#e2e8f0'}` }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: item.billNumber ? '#6d28d9' : '#94a3b8', textTransform: 'uppercase' }}>4. Purchase Bill</div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: item.billNumber ? '#6d28d9' : '#94a3b8', marginTop: 2 }}>
                        {item.billNumber || 'Not Booked'}
                      </div>
                      {item.billStatus && <div style={{ fontSize: 11, color: '#64748b' }}>{item.billStatus} ({fmt(item.billTotalAmount)})</div>}
                    </div>

                    {/* 5. Finance Payment */}
                    <div style={{ background: item.paymentNumber ? '#ecfdf5' : '#f8fafc', padding: 10, borderRadius: 8, border: `1px solid ${item.paymentNumber ? '#a7f3d0' : '#e2e8f0'}` }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: item.paymentNumber ? '#047857' : '#94a3b8', textTransform: 'uppercase' }}>5. Payment</div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: item.paymentNumber ? '#047857' : '#94a3b8', marginTop: 2 }}>
                        {item.paymentNumber || 'Pending Settlement'}
                      </div>
                      {item.paymentAmount && <div style={{ fontSize: 11, color: '#15803d', fontWeight: 600 }}>{fmt(item.paymentAmount)} ({item.paymentMode})</div>}
                    </div>
                  </div>

                  <div style={{ marginTop: 12, padding: '8px 12px', background: '#f8fafc', borderRadius: 6, fontSize: 12, color: '#334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>📌 <strong>Current Status:</strong> {item.stageDesc}</div>
                    <div>
                      {item.stageCode === 'GRN_RECEIVED' && (
                        <button
                          style={{ ...S.btnPrimary, background: '#0284c7', padding: '4px 10px', fontSize: 11 }}
                          onClick={() => openBill({ id: item.poId, poNumber: item.poNumber, vendorName: item.vendorName, grandTotal: item.poGrandTotal })}
                        >
                          🧾 Book Purchase Bill
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {pipelineList.length === 0 && (
                <div style={S.empty}>No orders in pipeline matching search criteria.</div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ═══════ CREATE PO MODAL ═══════ */}
      {modal && (() => {
        const vObj = vendorObj(form.vendor_id)
        const defaultTaxType = vObj?.gstin && !vObj.gstin.startsWith('29') ? 'inter' : 'intra'
        const currentTaxType = form.tax_type || defaultTaxType
        const isInterstate = currentTaxType === 'inter' || currentTaxType === 'state' || currentTaxType === 'igst'

        const calcLine = it => {
          const q = parseFloat(it.qty) || 0
          const p2 = parseFloat(it.unit_price) || 0
          const gross = Math.round((q * p2 + Number.EPSILON) * 100) / 100
          const discPct = Math.max(0, Math.min(100, parseFloat(it.discount_pct || 0) || 0))
          const discAmt = Math.round((gross * (discPct / 100) + Number.EPSILON) * 100) / 100
          const discBase = Math.max(0, gross - discAmt)
          const otherCharges = parseFloat(it.other_charges || 0) || 0
          const taxable = Math.round((discBase + otherCharges + Number.EPSILON) * 100) / 100
          const g = parseFloat(it.gst_pct !== undefined && it.gst_pct !== '' ? it.gst_pct : 18) || 0

          let cgst = 0, sgst = 0, igst = 0
          if (isInterstate) {
            igst = Math.round((taxable * (g / 100) + Number.EPSILON) * 100) / 100
          } else {
            cgst = Math.round((taxable * (g / 200) + Number.EPSILON) * 100) / 100
            sgst = Math.round((taxable * (g / 200) + Number.EPSILON) * 100) / 100
          }
          const tax = cgst + sgst + igst
          const total = Math.round((taxable + tax + Number.EPSILON) * 100) / 100
          return { q, p2, gross, discPct, discAmt, discBase, otherCharges, taxable, g, cgst, sgst, igst, tax, total }
        }

        const totalGross = form.items.reduce((a, it) => a + calcLine(it).gross, 0)
        const totalDiscount = form.items.reduce((a, it) => a + calcLine(it).discAmt, 0)
        const totalOtherCharges = form.items.reduce((a, it) => a + calcLine(it).otherCharges, 0)
        const subtotal = form.items.reduce((a, it) => a + calcLine(it).taxable, 0)
        const totalCgst = form.items.reduce((a, it) => a + calcLine(it).cgst, 0)
        const totalSgst = form.items.reduce((a, it) => a + calcLine(it).sgst, 0)
        const totalIgst = form.items.reduce((a, it) => a + calcLine(it).igst, 0)
        const totalTax = form.items.reduce((a, it) => a + calcLine(it).tax, 0)
        const grandTotal = subtotal + totalTax

        const fmtAmt = v => v > 0 ? `₹${v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '₹0.00'
        const PAYMENT_PRESETS = ['Net 15', 'Net 30', 'Net 45', 'Advance', 'COD', 'Custom']
        const dupIds = form.items.map(it => it.material_id).filter((id, i, arr) => id && arr.indexOf(id) !== i)
        const isDirty = form.vendor_id || form.items.some(it => it.material_id)
        const handleClose = () => { if (isDirty && !window.confirm('Discard changes to this PO?')) return; setModal(false) }

        return (
          <div style={S.overlay} onClick={handleClose}>
            <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e7e6df', width: '98vw', maxWidth: 1240, height: '94vh', maxHeight: '94vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }} onClick={e => e.stopPropagation()}>

              {/* ── Sticky Header ── */}
              <div style={{ padding: '16px 24px 14px', borderBottom: '1px solid #f1efe8', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexShrink: 0, background: '#fff' }}>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#1b1b1d' }}>Create Purchase Order (PO)</div>
                  <div style={{ display: 'flex', gap: 16, marginTop: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 11, color: '#a0a0a6' }}>PO Date:</span>
                    <input style={{ ...S.input, padding: '3px 8px', fontSize: 12, width: 140 }} type="date" value={form.po_date}
                      onChange={e => setForm(f => ({ ...f, po_date: e.target.value }))} required />
                    <span style={{ background: '#8a8a9022', color: '#8a8a90', border: '1px solid #8a8a9044', borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 700 }}>Draft</span>
                    <span style={{ fontSize: 11, color: '#c0c0c8' }}>PO# auto-assigned on save</span>
                  </div>
                </div>
                <button style={S.close} onClick={handleClose}>✕</button>
              </div>

              {/* ── Scrollable Body ── */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
                <form id="po-create-form" onSubmit={save}>

                  {/* ── Vendor & Delivery & Tax Mode (4-col grid) ── */}
                  <div style={{ marginBottom: 20 }}>
                    <div style={SS.sectionLabel}>VENDOR, COMMERCIAL &amp; GST TAX MODE</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.2fr 1fr 1.2fr', gap: 14 }}>

                      <div>
                        <label style={S.label}>Vendor *</label>
                        <SearchableSelect
                          value={String(form.vendor_id || '')}
                          onChange={id => {
                            const v = vendors.find(x => String(x.id) === String(id))
                            const vpt = v?.payment_terms
                            const presetMatch = vpt && PAYMENT_PRESETS.includes(vpt)
                            const autoTaxType = v?.gstin && !v.gstin.startsWith('29') ? 'inter' : 'intra'
                            setForm(f => ({
                              ...f,
                              vendor_id: id,
                              tax_type: autoTaxType,
                              payment_terms: vpt ? (presetMatch ? vpt : 'Custom') : f.payment_terms,
                              payment_terms_custom: vpt && !presetMatch ? vpt : f.payment_terms_custom
                            }))
                            setFormErrors(fe => ({ ...fe, vendor_id: undefined }))
                          }}
                          placeholder="Search vendor by name or GSTIN..."
                          searchPlaceholder="Type vendor name, GSTIN, city..."
                          options={vendors.map(v => ({
                            value: String(v.id),
                            label: v.name,
                            code: v.code || v.vendor_code,
                            subtext: [v.gstin ? `GST: ${v.gstin}` : '', v.city || ''].filter(Boolean).join(' · '),
                            badge: `${v.poCount || v.po_count || 0} POs`
                          }))}
                          selectStyle={{ borderColor: formErrors.vendor_id ? '#ef4444' : undefined }}
                        />
                        {vObj?.gstin && <div style={SS.hint}>GSTIN: {vObj.gstin} {isInterstate ? '(Inter-State IGST)' : '(In-State CGST+SGST)'}</div>}
                        {formErrors.vendor_id && <div style={SS.fieldErr}>{formErrors.vendor_id}</div>}
                      </div>

                      {/* Tax Type / GST Supply Mode Selector */}
                      <div>
                        <label style={S.label}>GST Tax Mode / Supply Type *</label>
                        <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                          <button
                            type="button"
                            onClick={() => setForm(f => ({ ...f, tax_type: 'intra' }))}
                            style={{
                              flex: 1, padding: '7px 10px', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                              border: !isInterstate ? '2px solid #059669' : '1px solid #e2e8f0',
                              background: !isInterstate ? '#ecfdf5' : '#ffffff',
                              color: !isInterstate ? '#065f46' : '#64748b',
                              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4
                            }}
                            title="In-State Supply: 50% CGST + 50% SGST"
                          >
                            <span>📍 In-State</span>
                            <span style={{ fontSize: 9, background: !isInterstate ? '#059669' : '#e2e8f0', color: !isInterstate ? '#fff' : '#475569', padding: '1px 5px', borderRadius: 6 }}>CGST+SGST</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setForm(f => ({ ...f, tax_type: 'inter' }))}
                            style={{
                              flex: 1, padding: '7px 10px', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                              border: isInterstate ? '2px solid #6366f1' : '1px solid #e2e8f0',
                              background: isInterstate ? '#eef2ff' : '#ffffff',
                              color: isInterstate ? '#4338ca' : '#64748b',
                              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4
                            }}
                            title="State / Interstate Supply: 100% IGST"
                          >
                            <span>🌐 State / Inter</span>
                            <span style={{ fontSize: 9, background: isInterstate ? '#6366f1' : '#e2e8f0', color: isInterstate ? '#fff' : '#475569', padding: '1px 5px', borderRadius: 6 }}>IGST</span>
                          </button>
                        </div>
                        <div style={{ fontSize: 10, color: '#64748b', marginTop: 3 }}>
                          {!isInterstate ? 'Split into equal CGST + SGST' : 'Applied as full IGST'}
                        </div>
                      </div>

                      <div>
                        <label style={S.label}>Link PR / Indent</label>
                        <SearchableSelect
                          value={String(form.indent_id || '')}
                          onChange={id => handleSelectIndent(id)}
                          placeholder="-- Direct PO --"
                          searchPlaceholder="Type indent number or department..."
                          allowClear={true}
                          options={[
                            { value: '', label: '-- Direct PO (No PR Linked) --' },
                            ...approvedIndents.map(ind => ({
                              value: String(ind.id),
                              label: ind.indentNumber || ind.indent_number,
                              subtext: `${ind.deptName || 'Dept'} · ${ind.itemCount || 0} items · ${ind.priority || 'Normal'}`,
                              badge: ind.priority
                            }))
                          ]}
                          selectStyle={{ background: form.indent_id ? '#f0fdf4' : undefined, borderColor: form.indent_id ? '#86efac' : undefined }}
                        />
                        {form.indent_id ? (
                          <div style={{ fontSize: 11, color: '#16a34a', marginTop: 3, fontWeight: 600 }}>✓ Items loaded from PR</div>
                        ) : null}
                      </div>

                      <div>
                        <label style={S.label}>Delivery Date *
                          <input style={{ ...S.input, borderColor: formErrors.delivery_date ? '#ef4444' : undefined }}
                            type="date" value={form.delivery_date} min={form.po_date || undefined}
                            onChange={e => { setForm(f => ({ ...f, delivery_date: e.target.value })); setFormErrors(fe => ({ ...fe, delivery_date: undefined })) }} />
                        </label>
                        {formErrors.delivery_date && <div style={SS.fieldErr}>{formErrors.delivery_date}</div>}
                      </div>

                      <div>
                        <label style={S.label}>Payment Terms</label>
                        <SearchableSelect
                          value={form.payment_terms || ''}
                          onChange={v => setForm(f => ({ ...f, payment_terms: v, payment_terms_custom: '' }))}
                          placeholder="Select payment terms..."
                          searchPlaceholder="Type or press first letter..."
                          options={PAYMENT_PRESETS.map(p => ({ value: p, label: p }))}
                        />
                        {form.payment_terms === 'Custom' && (
                          <input style={{ ...S.input, marginTop: 6, fontSize: 12 }} placeholder="Describe custom terms…"
                            value={form.payment_terms_custom}
                            onChange={e => setForm(f => ({ ...f, payment_terms_custom: e.target.value }))} />
                        )}
                      </div>

                      <div>
                        <label style={S.label}>Delivery Warehouse</label>
                        <SearchableSelect
                          value={form.delivery_address || ''}
                          onChange={v => setForm(f => ({ ...f, delivery_address: v }))}
                          placeholder="Select warehouse..."
                          searchPlaceholder="Type warehouse name..."
                          options={warehouses.map(w => ({ value: w.name, label: w.name, code: w.code }))}
                        />
                      </div>

                      <div style={{ gridColumn: 'span 2' }}>
                        <label style={S.label}>Remarks / Work Order Notes
                          <input style={S.input} value={form.remarks} placeholder="Optional instructions or work order specifications…"
                            onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))} />
                        </label>
                      </div>

                    </div>
                  </div>

                  {/* ── Line Items Table ── */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                      <div>
                        <span style={SS.sectionLabel}>LINE ITEMS (UNIT RATE, DISCOUNT %, OTHER CHARGES &amp; GST)</span>
                        <span style={{ fontSize: 11, color: '#64748b', marginLeft: 10 }}>All rates and taxes live calculated</span>
                      </div>
                      <button type="button"
                        style={{ background: '#dc2626', color: '#ffffff', border: 'none', borderRadius: 6, padding: '6px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                        onClick={addItem}>＋ Add Item</button>
                    </div>
                    {formErrors.items && <div style={{ ...SS.fieldErr, marginBottom: 8 }}>{formErrors.items}</div>}

                    <div style={{ border: '1px solid #e7e6df', borderRadius: 8, overflow: 'visible', background: '#ffffff' }}>
                      <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 4,
                        background: '#f6f5f0',
                        borderBottom: '1px solid #e7e6df',
                        padding: '8px 12px'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 20, flexShrink: 0 }} />
                          <div style={{ flex: '1.4 1 260px', fontSize: 11, fontWeight: 700, color: '#8a8a90', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Material *</div>
                          <div style={{ flex: '1 1 160px', fontSize: 11, fontWeight: 700, color: '#8a8a90', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Description / Specifications</div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div style={{ width: 20, flexShrink: 0 }} />
                          <div style={{ width: 80, fontSize: 10, fontWeight: 700, color: '#a0a0a6', textTransform: 'uppercase', textAlign: 'right' }}>Qty *</div>
                          <div style={{ width: 60, fontSize: 10, fontWeight: 700, color: '#a0a0a6', textTransform: 'uppercase' }}>UOM</div>
                          <div style={{ width: 90, fontSize: 10, fontWeight: 700, color: '#a0a0a6', textTransform: 'uppercase', textAlign: 'right' }}>Unit Rate ₹ *</div>
                          <div style={{ width: 75, fontSize: 10, fontWeight: 700, color: '#a0a0a6', textTransform: 'uppercase', textAlign: 'right' }}>Disc %</div>
                          <div style={{ width: 90, fontSize: 10, fontWeight: 700, color: '#a0a0a6', textTransform: 'uppercase', textAlign: 'right' }}>Other Chg ₹</div>
                          <div style={{ width: 95, fontSize: 10, fontWeight: 700, color: '#a0a0a6', textTransform: 'uppercase', textAlign: 'right' }}>Taxable ₹</div>
                          <div style={{ width: 120, fontSize: 10, fontWeight: 700, color: '#a0a0a6', textTransform: 'uppercase' }}>GST Slab %</div>
                          <div style={{ width: 110, fontSize: 10, fontWeight: 700, color: '#a0a0a6', textTransform: 'uppercase', textAlign: 'right' }}>
                            {!isInterstate ? 'CGST+SGST (₹)' : 'IGST (₹)'}
                          </div>
                          <div style={{ flex: 1, fontSize: 10, fontWeight: 700, color: '#a0a0a6', textTransform: 'uppercase', textAlign: 'right' }}>Line Total ₹</div>
                          <div style={{ width: 28, flexShrink: 0 }} />
                        </div>
                      </div>

                      {/* Rows */}
                      {form.items.map((it, i) => {
                        const lt = calcLine(it)
                        const isDup = dupIds.includes(it.material_id)
                        const selMat = mats.find(m => String(m.id) === String(it.material_id))
                        const searchVal = poMatSearch[i] !== undefined ? poMatSearch[i] : (selMat ? `${selMat.name} [${selMat.code}]` : (it.description || ''))
                        const q = (poMatSearch[i] || '').trim().toLowerCase()
                        const rank = m => {
                          if (!q) return 5
                          const name = (m.name || '').toLowerCase(), code = (m.code || '').toLowerCase()
                          if (code === q) return 0
                          if (code.startsWith(q)) return 1
                          if (name.startsWith(q)) return 2
                          if (name.includes(q)) return 3
                          if (code.includes(q) || (m.categoryName||'').toLowerCase().includes(q) || (m.hsn_code||m.hsnCode||'').toLowerCase().includes(q) || (m.bin_location||m.binLocation||'').toLowerCase().includes(q)) return 4
                          return -1
                        }
                        const filtered = (q ? mats.map(m => ({ m, r: rank(m) })).filter(x => x.r >= 0).sort((a,b) => a.r - b.r).map(x => x.m) : mats).slice(0, 100)
                        const itErr = formErrors.itemFields?.[i] || {}
                        const grouped = filtered.reduce((acc, m) => {
                          const cat = m.categoryName || 'Uncategorized'
                          ;(acc[cat] = acc[cat] || []).push(m)
                          return acc
                        }, {})
                        const groupNames = q ? Object.keys(grouped) : Object.keys(grouped).sort()

                        return (
                          <div key={i} style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 6,
                            borderBottom: i < form.items.length - 1 ? '1px solid #f1efe8' : 'none',
                            background: isDup ? '#fff7ed' : '#ffffff',
                            padding: '10px 12px'
                          }}>

                            {/* Line 1: # + Material + Description */}
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                              <div style={{ width: 20, flexShrink: 0, textAlign: 'center', fontSize: 11, color: '#a0a0a6', fontWeight: 700, paddingTop: 7 }}>{i + 1}</div>

                              {/* Material Combobox */}
                              <div style={{ position: 'relative', flex: '1.4 1 260px' }}>
                                <input
                                  style={{ ...S.input, fontSize: 12, padding: '6px 24px 6px 8px', background: it.material_id ? '#f0fdf4' : '#f6f5f0' }}
                                  placeholder="🔍 Search material, code, category, HSN, bin..."
                                  autoComplete="off"
                                  value={searchVal}
                                  onFocus={() => setPoMatDropOpen(d => ({ ...d, [i]: true }))}
                                  onChange={e => {
                                    const v = e.target.value
                                    setPoMatSearch(s => ({ ...s, [i]: v }))
                                    setPoMatDropOpen(d => ({ ...d, [i]: true }))
                                    if (!v) setItem(i, 'material_id', '')
                                  }}
                                  onBlur={() => setTimeout(() => setPoMatDropOpen(d => ({ ...d, [i]: false })), 160)}
                                />
                                {it.material_id && (
                                  <button type="button" title="Clear selection"
                                    style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#8a8a90', fontSize: 13 }}
                                    onClick={() => {
                                      setItem(i, 'material_id', '')
                                      setPoMatSearch(s => ({ ...s, [i]: '' }))
                                    }}>✕</button>
                                )}

                                {/* Dropdown Popover */}
                                {poMatDropOpen[i] && filtered.length > 0 && (
                                  <div style={{
                                    position: 'absolute', top: '100%', left: 0, right: 6, zIndex: 300,
                                    background: '#ffffff', border: '1px solid #e7e6df', borderRadius: 6,
                                    boxShadow: '0 6px 20px rgba(0,0,0,0.15)', maxHeight: 260, overflowY: 'auto', marginTop: 2
                                  }}>
                                    {groupNames.map(cat => (
                                      <div key={cat}>
                                        <div style={{ position:'sticky', top:0, background:'#f6f5f0', padding:'4px 10px', fontSize:10, fontWeight:700, color:'#8a8a90', textTransform:'uppercase', letterSpacing:'0.05em', borderBottom:'1px solid #e7e6df' }}>
                                          {cat} <span style={{fontWeight:500}}>({grouped[cat].length})</span>
                                        </div>
                                        {grouped[cat].map(m => {
                                          const stock = Number(m.currentStock ?? m.current_stock ?? 0)
                                          const low = stock <= Number(m.reorderLevel ?? m.reorder_level ?? 0)
                                          return (
                                            <div key={m.id}
                                              onMouseDown={() => {
                                                const price = parseFloat(m.unitPrice || m.unit_price || 0)
                                                setForm(f => ({
                                                  ...f,
                                                  items: f.items.map((it2, j) => j === i ? {
                                                    ...it2,
                                                    material_id: m.id,
                                                    description: m.name || '',
                                                    uom: m.uom || 'NOS',
                                                    unit_price: price > 0 ? price.toString() : it2.unit_price
                                                  } : it2)
                                                }))
                                                setPoMatSearch(s => ({ ...s, [i]: undefined }))
                                                setPoMatDropOpen(d => ({ ...d, [i]: false }))
                                              }}
                                              style={{
                                                padding: '7px 10px', cursor: 'pointer', fontSize: 11,
                                                borderBottom: '1px solid #f1efe8',
                                                background: it.material_id == m.id ? '#f0fdf4' : 'transparent',
                                                display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                                              }}>
                                              <span>
                                                <strong style={{ color: '#1b1b1d' }}>{m.name}</strong>
                                                <span style={{ color: '#8a8a90', fontSize: 10, marginLeft: 4 }}>[{m.code}]</span>
                                                {(m.poCount || m.po_count) ? (
                                                  <span style={{ background: '#ede9fe', color: '#6d28d9', fontSize: 9, padding: '1px 6px', borderRadius: 4, marginLeft: 6, fontWeight: 700 }}>
                                                    {m.poCount || m.po_count} PO{(m.poCount || m.po_count) === 1 ? '' : 's'}
                                                  </span>
                                                ) : null}
                                              </span>
                                              <span style={{ fontSize: 10, fontWeight: 600, textAlign:'right' }}>
                                                <span style={{ color: low ? '#ef4444' : '#16a34a' }}>Stock: {stock} {m.uom}</span>
                                                {parseFloat(m.unitPrice || m.unit_price || 0) > 0 && <span style={{ color:'#059669', marginLeft:6 }}>· ₹{m.unitPrice || m.unit_price}</span>}
                                              </span>
                                            </div>
                                          )
                                        })}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>

                              {/* Description */}
                              <div style={{ flex: '1 1 160px' }}>
                                <input style={{ ...S.input, fontSize: 12, padding: '6px 8px', width: '100%' }}
                                  value={it.description || ''} placeholder="Item specifications &amp; notes…"
                                  onChange={e => setItem(i, 'description', e.target.value)} />
                              </div>
                            </div>

                            {/* Line 2: Qty, UOM, Unit Price, Disc%, Other Charges, Taxable, GST Slab, Tax, Line Total, Remove */}
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                              <div style={{ width: 20, flexShrink: 0 }} />

                              {/* Qty */}
                              <div style={{ width: 80, flexShrink: 0 }}>
                                <input style={{ ...S.input, fontSize: 12, padding: '6px 6px', textAlign: 'right', width: '100%', ...(itErr.qty ? { border: '1px solid #ef4444', background: '#ef444411' } : {}) }}
                                  type="number" step="0.001" min="0.001"
                                  value={it.qty} placeholder="0"
                                  onChange={e => { setItem(i, 'qty', e.target.value); if (formErrors.itemFields) setFormErrors(fe => ({ ...fe, itemFields: fe.itemFields.map((x,j)=>j===i?{...x,qty:undefined}:x) })) }} />
                                {itErr.qty && <div style={{ fontSize: 9, color: '#ef4444', fontWeight: 600, marginTop: 2 }}>{itErr.qty}</div>}
                              </div>

                              {/* UOM */}
                              <div style={{ width: 60, flexShrink: 0 }}>
                                <input style={{ ...S.input, fontSize: 12, padding: '6px 6px', width: '100%' }}
                                  value={it.uom} placeholder="NOS"
                                  onChange={e => setItem(i, 'uom', e.target.value)} />
                              </div>

                              {/* Unit Rate */}
                              <div style={{ width: 90, flexShrink: 0 }}>
                                <input style={{ ...S.input, fontSize: 12, padding: '6px 6px', textAlign: 'right', width: '100%', ...(itErr.unit_price ? { border: '1px solid #ef4444', background: '#ef444411' } : {}) }}
                                  type="number" step="0.01" min="0"
                                  value={it.unit_price} placeholder="0.00"
                                  onChange={e => { setItem(i, 'unit_price', e.target.value); if (formErrors.itemFields) setFormErrors(fe => ({ ...fe, itemFields: fe.itemFields.map((x,j)=>j===i?{...x,unit_price:undefined}:x) })) }} />
                                {itErr.unit_price && <div style={{ fontSize: 9, color: '#ef4444', fontWeight: 600, marginTop: 2 }}>{itErr.unit_price}</div>}
                              </div>

                              {/* Discount % */}
                              <div style={{ width: 75, flexShrink: 0 }}>
                                <input style={{ ...S.input, fontSize: 12, padding: '6px 6px', textAlign: 'right', width: '100%', color: lt.discPct > 0 ? '#b45309' : undefined, fontWeight: lt.discPct > 0 ? 600 : undefined }}
                                  type="number" step="0.01" min="0" max="100"
                                  value={it.discount_pct !== undefined ? it.discount_pct : ''} placeholder="0%"
                                  onChange={e => setItem(i, 'discount_pct', e.target.value)}
                                  title="Item discount percentage (deducted from gross)" />
                              </div>

                              {/* Other Charges (Transport / P&F) */}
                              <div style={{ width: 90, flexShrink: 0 }}>
                                <input style={{ ...S.input, fontSize: 12, padding: '6px 6px', textAlign: 'right', width: '100%', color: lt.otherCharges > 0 ? '#0369a1' : undefined, fontWeight: lt.otherCharges > 0 ? 600 : undefined }}
                                  type="number" step="0.01" min="0"
                                  value={it.other_charges !== undefined ? it.other_charges : ''} placeholder="0.00"
                                  onChange={e => setItem(i, 'other_charges', e.target.value)}
                                  title="Other charges: Transport, Packing & Forwarding (P&F)" />
                              </div>

                              {/* Taxable Base (Readonly) */}
                              <div style={{ width: 95, flexShrink: 0, textAlign: 'right', fontSize: 12, fontWeight: 700, color: '#334155', paddingTop: 8 }}>
                                {fmtAmt(lt.taxable)}
                              </div>

                              {/* GST Slab Descriptive Select */}
                              <div style={{ width: 120, flexShrink: 0 }}>
                                <select
                                  style={{ ...S.select, fontSize: 11, padding: '5px 4px', width: '100%', height: 32, background: '#fff' }}
                                  value={Number(it.gst_pct ?? 18)}
                                  onChange={e => setItem(i, 'gst_pct', Number(e.target.value))}
                                >
                                  {GST_SLABS.map(s => (
                                    <option key={s.value} value={s.value}>{s.label}</option>
                                  ))}
                                </select>
                              </div>

                              {/* Tax Amount Breakdown */}
                              <div style={{ width: 110, flexShrink: 0, textAlign: 'right', fontSize: 11, color: !isInterstate ? '#059669' : '#6366f1', paddingTop: 6 }}>
                                <div style={{ fontWeight: 700 }}>{fmtAmt(lt.tax)}</div>
                                <div style={{ fontSize: 9 }}>
                                  {!isInterstate ? `(C: ${fmtAmt(lt.cgst)} + S: ${fmtAmt(lt.sgst)})` : `(IGST: ${fmtAmt(lt.igst)})`}
                                </div>
                              </div>

                              {/* Line Total */}
                              <div style={{ flex: 1, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontSize: 13, fontWeight: 800, color: lt.total > 0 ? '#16a34a' : '#a0a0a6', paddingTop: 8, paddingRight: 4 }}>
                                {fmtAmt(lt.total)}
                              </div>

                              {/* Remove Button */}
                              <div style={{ width: 28, flexShrink: 0, textAlign: 'center', paddingTop: 4 }}>
                                <button type="button"
                                  style={{ background: 'none', border: 'none', cursor: form.items.length > 1 ? 'pointer' : 'not-allowed', color: form.items.length > 1 ? '#ef4444' : '#d0d0d8', fontSize: 15, lineHeight: 1 }}
                                  disabled={form.items.length <= 1}
                                  onClick={() => removeItem(i)}>🗑</button>
                              </div>
                            </div>

                          </div>
                        )
                      })}
                    </div>
                  </div>

                </form>
              </div>

              {/* ── Sticky Footer: Itemized Tax Summary + Buttons ── */}
              <div style={{ borderTop: '1px solid #e7e6df', padding: '14px 24px', background: '#f6f5f0', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                {/* Itemized Calculation Summary */}
                <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontSize: 10, color: '#8a8a90', fontWeight: 700, textTransform: 'uppercase' }}>Gross Base</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#1b1b1d' }}>{fmtAmt(totalGross)}</div>
                  </div>
                  {totalDiscount > 0 && (
                    <>
                      <div style={{ width: 1, height: 24, background: '#e7e6df' }} />
                      <div style={{ textAlign: 'left' }}>
                        <div style={{ fontSize: 10, color: '#b45309', fontWeight: 700, textTransform: 'uppercase' }}>Discount (-)</div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#b45309' }}>-{fmtAmt(totalDiscount)}</div>
                      </div>
                    </>
                  )}
                  {totalOtherCharges > 0 && (
                    <>
                      <div style={{ width: 1, height: 24, background: '#e7e6df' }} />
                      <div style={{ textAlign: 'left' }}>
                        <div style={{ fontSize: 10, color: '#0369a1', fontWeight: 700, textTransform: 'uppercase' }}>Other Chg (+)</div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#0369a1' }}>+{fmtAmt(totalOtherCharges)}</div>
                      </div>
                    </>
                  )}
                  <div style={{ width: 1, height: 24, background: '#e7e6df' }} />
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontSize: 10, color: '#0f172a', fontWeight: 700, textTransform: 'uppercase' }}>Taxable Base</div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: '#0f172a' }}>{fmtAmt(subtotal)}</div>
                  </div>
                  <div style={{ width: 1, height: 24, background: '#e7e6df' }} />
                  {isInterstate ? (
                    <div style={{ textAlign: 'left' }}>
                      <div style={{ fontSize: 10, color: '#6366f1', fontWeight: 700, textTransform: 'uppercase' }}>IGST (Inter-State)</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#6366f1' }}>{fmtAmt(totalIgst)}</div>
                    </div>
                  ) : (
                    <>
                      <div style={{ textAlign: 'left' }}>
                        <div style={{ fontSize: 10, color: '#059669', fontWeight: 700, textTransform: 'uppercase' }}>CGST (50%)</div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#059669' }}>{fmtAmt(totalCgst)}</div>
                      </div>
                      <div style={{ textAlign: 'left' }}>
                        <div style={{ fontSize: 10, color: '#059669', fontWeight: 700, textTransform: 'uppercase' }}>SGST (50%)</div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#059669' }}>{fmtAmt(totalSgst)}</div>
                      </div>
                    </>
                  )}
                  <div style={{ width: 1, height: 24, background: '#e7e6df' }} />
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontSize: 10, color: '#a0a0a6', fontWeight: 700, textTransform: 'uppercase' }}>Total Tax</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#1b1b1d' }}>{fmtAmt(totalTax)}</div>
                  </div>
                  <div style={{ width: 1, height: 24, background: '#e7e6df' }} />
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontSize: 10, color: '#0f766e', fontWeight: 800, textTransform: 'uppercase' }}>Grand Total (₹)</div>
                    <div style={{ fontSize: 19, fontWeight: 900, color: '#0f766e' }}>{fmtAmt(grandTotal)}</div>
                  </div>
                </div>

                {/* Action buttons */}
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  {err && <span style={{ fontSize: 12, color: '#ef4444', fontWeight: 600 }}>{err}</span>}
                  <button type="button" style={S.btnSecondary} onClick={handleClose}>Cancel</button>
                  <button type="button" style={{ ...S.btnSecondary, color: '#6366f1' }} onClick={saveAsDraft} disabled={saving}>
                    {saving ? '…' : '💾 Save Draft'}
                  </button>
                  <button type="submit" form="po-create-form" style={S.btnPrimary} disabled={saving}>
                    {saving ? 'Creating…' : '✓ Create PO'}
                  </button>
                </div>
              </div>

            </div>
          </div>
        )
      })()}


      {/* PO Detail Modal */}
      {detail && (
        <div style={S.overlay} onClick={() => setDetail(null)}>
          <div style={{ ...S.modal, maxWidth: 760, maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={S.modalHeader}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={S.modalTitle}>{detail.po_number || detail.poNumber}</div>
                  <span style={{ ...S.badge, background: STATUS_COLOR[detail.status] + '22', color: STATUS_COLOR[detail.status], border: `1px solid ${STATUS_COLOR[detail.status]}44` }}>
                    {detail.status}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                  Vendor: <strong>{detail.vendorName}</strong> {detail.vendorGstin ? `(GSTIN: ${detail.vendorGstin})` : ''}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <button
                  style={{ ...S.btnSecondary, padding: '5px 12px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4, background: '#0f766e', color: '#ffffff' }}
                  onClick={() => printPO(detail)}
                >
                  🖨 Print / PDF
                </button>
                <button
                  style={{ ...S.btnSecondary, padding: '5px 12px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}
                  onClick={() => exportPODetailToCSV(detail)}
                  title="Download PO Line Items as CSV"
                >
                  📥 Export CSV
                </button>
                {!['Received', 'Closed'].includes(detail.status) && (
                  <button
                    style={{ ...S.btnSecondary, padding: '5px 12px', fontSize: 12, color: '#d97706' }}
                    onClick={() => { const target = detail; setDetail(null); openEdit(target) }}
                    title="Modify PO line items, backdated date, unit rates, discounts, and terms"
                  >
                    ✏️ Edit PO
                  </button>
                )}
                {!['Received', 'Closed'].includes(detail.status) && !detail.grnNumber && !detail.grnId && (
                  <button
                    style={{ ...S.btnSecondary, padding: '5px 12px', fontSize: 12, color: '#dc2626' }}
                    onClick={() => deletePO(detail.id, detail.po_number || detail.poNumber)}
                    title="Permanently delete PO and restore linked Indent"
                  >
                    🗑 Delete
                  </button>
                )}
                {(detail.status === 'Draft' || detail.status === 'Submitted') && (
                  <button
                    style={{ ...S.btnSecondary, padding: '5px 12px', fontSize: 12, color: '#16a34a', fontWeight: 700 }}
                    onClick={() => approve(detail.id)}
                    title="Approve Purchase Order"
                  >
                    ✅ Approve
                  </button>
                )}
                {(detail.status === 'Approved') && !detail.grnNumber && !detail.grnId && (
                  <button
                    style={{ ...S.btnSecondary, padding: '5px 12px', fontSize: 12, color: '#64748b' }}
                    onClick={() => cancelPO(detail.id)}
                  >
                    🚫 Cancel
                  </button>
                )}
                <button style={S.close} onClick={() => setDetail(null)}>✕</button>
              </div>
            </div>

            {/* Linked PR / Indent Card */}
            {(detail.indentNumber || detail.indent_number) && (
              <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8, padding: '10px 14px', marginBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#166534' }}>
                    📋 Converted from Purchase Request (Indent) #{detail.indentNumber || detail.indent_number}
                  </div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>
                    Department: <strong>{detail.deptName || 'Plant Mill'}</strong> · Seamless P2P Audit Trail
                  </div>
                </div>
                <button
                  style={{ ...S.btnSecondary, fontSize: 11, padding: '4px 10px', color: '#0f766e' }}
                  onClick={() => { window.location.href = `/indent` }}
                >
                  View Indents →
                </button>
              </div>
            )}

            <div style={S.grid2}>
              <div><span style={S.muted}>Vendor: </span><strong>{detail.vendorName}</strong></div>
              <div><span style={S.muted}>PO Date: </span>{detail.date ? detail.date.slice(0, 10) : '—'}</div>
              <div><span style={S.muted}>Delivery Date: </span>{detail.delivery_date?.slice(0, 10) || '—'}</div>
              <div><span style={S.muted}>Payment Terms: </span>{detail.payment_terms || 'Net 30 Days'}</div>
              <div><span style={S.muted}>Subtotal (Taxable): </span>{fmt(detail.total_value)}</div>
              <div><span style={S.muted}>GST Tax: </span>{fmt(detail.gst_value)}</div>
              <div><span style={S.muted}>Grand Total: </span><strong style={{ fontSize: 15, color: '#0f766e' }}>{fmt(detail.grand_total)}</strong></div>
              <div><span style={S.muted}>Remarks: </span>{detail.remarks || '—'}</div>
            </div>

            <table style={{ ...S.table, marginTop: 14 }}>
              <thead>
                <tr style={S.thead}>
                  {['#', 'Material & Specification', 'Qty', 'UOM', 'Unit Rate', 'Disc %', 'Other Chg', 'Taxable', 'GST%', 'Total'].map(h => (
                    <th key={h} style={S.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(detail.items || []).map((it, idx) => (
                  <tr key={it.id || idx} style={S.tr}>
                    <td style={{ ...S.td, width: 30, color: '#64748b' }}>{idx + 1}</td>
                    <td style={S.td}>
                      <div style={{ fontWeight: 600, color: '#0f172a' }}>{it.materialName || it.description}</div>
                      <div style={{ fontSize: 10, color: '#64748b' }}>Code: <code>{it.materialCode || it.material_id}</code></div>
                    </td>
                    <td style={{ ...S.td, textAlign: 'right', fontWeight: 600 }}>{parseFloat(it.qty || 0).toFixed(2)}</td>
                    <td style={S.td}>{it.uom || 'NOS'}</td>
                    <td style={{ ...S.td, textAlign: 'right' }}>{fmt(it.unit_price)}</td>
                    <td style={{ ...S.td, textAlign: 'right', color: it.discount_pct > 0 ? '#b45309' : '#64748b' }}>
                      {it.discount_pct > 0 ? `${it.discount_pct}%` : '—'}
                    </td>
                    <td style={{ ...S.td, textAlign: 'right', color: it.other_charges > 0 ? '#0369a1' : '#64748b' }}>
                      {it.other_charges > 0 ? fmt(it.other_charges) : '—'}
                    </td>
                    <td style={{ ...S.td, textAlign: 'right', fontWeight: 600 }}>
                      {fmt(it.taxable_amount || (it.qty * it.unit_price))}
                    </td>
                    <td style={{ ...S.td, textAlign: 'center' }}>{it.gst_pct || 18}%</td>
                    <td style={{ ...S.td, textAlign: 'right', fontWeight: 700, color: '#0f766e' }}>{fmt(it.total || it.total_amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end', gap: 10, borderTop: '1px solid #e7e6df', paddingTop: 12 }}>
              {!['Received', 'Closed'].includes(detail.status) && !detail.grnNumber && !detail.grnId && (
                <button style={{ ...S.btnSecondary, color: '#dc2626' }} onClick={() => deletePO(detail.id, detail.po_number || detail.poNumber)}>
                  🗑 Delete PO
                </button>
              )}
              {!['Received', 'Closed'].includes(detail.status) && (
                <button style={{ ...S.btnSecondary, color: '#d97706' }} onClick={() => { const target = detail; setDetail(null); openEdit(target) }}>
                  ✏️ Edit PO
                </button>
              )}
              {(detail.status === 'Draft' || detail.status === 'Submitted') && (
                <button style={S.btnPrimary} onClick={() => approve(detail.id)}>
                  ✅ Approve PO
                </button>
              )}
              {(detail.status === 'Approved' || detail.status === 'Partial') && (
                <button style={{ ...S.btnPrimary, background: '#0f766e' }} onClick={() => { setDetail(null); openGRN(detail) }}>
                  📦 Receive Inward GRN
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══════ REDESIGNED EDIT PO MODAL ═══════ */}
      {editModal && (() => {
        const vObj = vendorObj(editForm.vendor_id)
        const defaultTaxType = (editForm.vendorGstin || vObj?.gstin) && !(editForm.vendorGstin || vObj?.gstin || '').startsWith('29') ? 'inter' : 'intra'
        const currentTaxType = editForm.tax_type || defaultTaxType
        const isInterstate = currentTaxType === 'inter' || currentTaxType === 'state' || currentTaxType === 'igst'

        const calcLineEdit = it => {
          const q = parseFloat(it.qty) || 0
          const p = parseFloat(it.unit_price) || 0
          const gross = Math.round((q * p + Number.EPSILON) * 100) / 100
          const discPct = Math.max(0, Math.min(100, parseFloat(it.discount_pct || 0) || 0))
          const discAmt = Math.round((gross * (discPct / 100) + Number.EPSILON) * 100) / 100
          const discBase = Math.max(0, gross - discAmt)
          const otherCharges = parseFloat(it.other_charges || 0) || 0
          const taxable = Math.round((discBase + otherCharges + Number.EPSILON) * 100) / 100
          const g = parseFloat(it.gst_pct !== undefined && it.gst_pct !== '' ? it.gst_pct : 18) || 0

          let cgst = 0, sgst = 0, igst = 0
          if (isInterstate) {
            igst = Math.round((taxable * (g / 100) + Number.EPSILON) * 100) / 100
          } else {
            cgst = Math.round((taxable * (g / 200) + Number.EPSILON) * 100) / 100
            sgst = Math.round((taxable * (g / 200) + Number.EPSILON) * 100) / 100
          }
          const tax = cgst + sgst + igst
          const total = Math.round((taxable + tax + Number.EPSILON) * 100) / 100
          return { q, p, gross, discPct, discAmt, discBase, otherCharges, taxable, g, cgst, sgst, igst, tax, total }
        }

        const lines = editForm.items.map(calcLineEdit)
        const totGross = lines.reduce((s, l) => s + l.gross, 0)
        const totDiscount = lines.reduce((s, l) => s + l.discAmt, 0)
        const totOtherCharges = lines.reduce((s, l) => s + l.otherCharges, 0)
        const totSub = lines.reduce((s, l) => s + l.taxable, 0)
        const totGst = lines.reduce((s, l) => s + l.tax, 0)
        const totCgst = lines.reduce((s, l) => s + l.cgst, 0)
        const totSgst = lines.reduce((s, l) => s + l.sgst, 0)
        const totIgst = lines.reduce((s, l) => s + l.igst, 0)
        const totGrand = totSub + totGst

        const touchedEditIds = editForm.items.map(it => String(it.material_id)).filter(Boolean)
        const dupEditIds = touchedEditIds.filter((id, idx) => touchedEditIds.indexOf(id) !== idx)

        return (
          <div style={S.overlay} onClick={() => setEditModal(null)}>
            <div style={{ ...S.modal, maxWidth: 1220, padding: 24 }} onClick={e => e.stopPropagation()}>
              
              {/* Modal Header with Tax Type Selector */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, borderBottom: '1px solid #e7e6df', paddingBottom: 12 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#1b1b1d' }}>
                      ✏️ Edit Purchase Order — {editForm.po_number || editModal.po_number || editModal.id}
                    </h2>
                    <span style={{ ...S.badge, background: '#fef3c7', color: '#b45309', border: '1px solid #fde68a' }}>
                      {editModal.status || 'Draft'}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 3, display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span>Vendor: <strong>{editForm.vendorName || editModal.vendorName || '—'}</strong></span>
                    {editForm.vendorGstin && <span>GSTIN: <code>{editForm.vendorGstin}</code></span>}
                    <span>PO Date: {editForm.po_date || '—'}</span>
                  </div>
                </div>

                {/* Tax Mode Segmented Selector */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ display: 'flex', gap: 4, background: '#f1f5f9', padding: 3, borderRadius: 8 }}>
                    <button
                      type="button"
                      onClick={() => setEditForm(f => ({ ...f, tax_type: 'intra' }))}
                      style={{
                        padding: '5px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer', border: 'none',
                        background: !isInterstate ? '#059669' : 'transparent',
                        color: !isInterstate ? '#ffffff' : '#475569'
                      }}
                    >
                      📍 In-State (CGST+SGST)
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditForm(f => ({ ...f, tax_type: 'inter' }))}
                      style={{
                        padding: '5px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer', border: 'none',
                        background: isInterstate ? '#6366f1' : 'transparent',
                        color: isInterstate ? '#ffffff' : '#475569'
                      }}
                    >
                      🌐 State / Inter (IGST)
                    </button>
                  </div>
                  <button style={S.close} onClick={() => setEditModal(null)}>✕</button>
                </div>
              </div>

              <form onSubmit={saveEdit} style={S.form}>
                
                {/* ── Metadata Grid ── */}
                <div style={{ background: '#f8fafc', padding: 14, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                    <label style={S.label}>
                      PO Date (Backdated Entry Allowed) *
                      <input
                        style={{ ...S.input, borderColor: '#0284c7', background: '#f0f9ff', fontWeight: 600 }}
                        type="date"
                        value={editForm.po_date}
                        onChange={e => setEditForm(f => ({ ...f, po_date: e.target.value }))}
                        title="Set PO date — supports backdating"
                      />
                    </label>

                    <label style={S.label}>
                      Delivery Due Date
                      <input style={S.input} type="date" value={editForm.delivery_date} onChange={e => setEditForm(f => ({ ...f, delivery_date: e.target.value }))} />
                    </label>

                    <label style={S.label}>
                      Payment Terms
                      <input style={S.input} placeholder="e.g. 30 Days Net, Immediate, etc." value={editForm.payment_terms} onChange={e => setEditForm(f => ({ ...f, payment_terms: e.target.value }))} />
                    </label>

                    <label style={S.label}>
                      PO Status Workflow
                      <select
                        style={{ ...S.select, fontWeight: 700, color: editForm.status === 'Approved' ? '#16a34a' : (editForm.status === 'Submitted' ? '#0284c7' : '#d97706') }}
                        value={editForm.status || 'Draft'}
                        onChange={e => setEditForm(f => ({ ...f, status: e.target.value }))}
                      >
                        <option value="Draft">Draft (Under Preparation)</option>
                        <option value="Submitted">Submitted (Pending Approval)</option>
                        <option value="Approved">Approved (Ready for PO Print &amp; Inward)</option>
                      </select>
                    </label>

                    <label style={{ ...S.label, gridColumn: '1 / -1' }}>
                      Remarks / Work Order Specifications
                      <input style={S.input} placeholder="Special terms, delivery instructions, machine specifications..." value={editForm.remarks} onChange={e => setEditForm(f => ({ ...f, remarks: e.target.value }))} />
                    </label>
                  </div>
                </div>

                {/* ── Line Items Header & Table ── */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={SS.sectionLabel}>ENCLOSED LINE ITEMS ({editForm.items.length})</span>
                      <span style={{ fontSize: 11, color: '#64748b' }}>Unit rate, discount %, other charges, and GST live calculated</span>
                    </div>
                    <button type="button"
                      style={{ background: '#0284c7', color: '#ffffff', border: 'none', borderRadius: 6, padding: '6px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                      onClick={addEditItem}>＋ Add Item</button>
                  </div>

                  {editFormErrors.items && <div style={{ ...SS.fieldErr, marginBottom: 8, background: '#fee2e2', padding: '6px 12px', borderRadius: 6 }}>{editFormErrors.items}</div>}
                  {editErr && <div style={{ ...S.error, marginBottom: 8 }}>{editErr}</div>}

                  {/* Lines Box */}
                  <div style={{ border: '1px solid #e7e6df', borderRadius: 8, overflow: 'visible', background: '#ffffff' }}>
                    
                    {/* Header Columns */}
                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 4,
                      background: '#f6f5f0',
                      borderBottom: '1px solid #e7e6df',
                      padding: '8px 12px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 22, flexShrink: 0, fontSize: 11, fontWeight: 700, color: '#8a8a90' }}>#</div>
                        <div style={{ flex: '1.4 1 260px', fontSize: 11, fontWeight: 700, color: '#8a8a90', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Material *</div>
                        <div style={{ flex: '1 1 160px', fontSize: 11, fontWeight: 700, color: '#8a8a90', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Description / Specifications</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ width: 22, flexShrink: 0 }} />
                        <div style={{ width: 80, fontSize: 10, fontWeight: 700, color: '#a0a0a6', textTransform: 'uppercase', textAlign: 'right' }}>Qty *</div>
                        <div style={{ width: 60, fontSize: 10, fontWeight: 700, color: '#a0a0a6', textTransform: 'uppercase' }}>UOM</div>
                        <div style={{ width: 90, fontSize: 10, fontWeight: 700, color: '#a0a0a6', textTransform: 'uppercase', textAlign: 'right' }}>Unit Rate ₹ *</div>
                        <div style={{ width: 75, fontSize: 10, fontWeight: 700, color: '#a0a0a6', textTransform: 'uppercase', textAlign: 'right' }}>Disc %</div>
                        <div style={{ width: 90, fontSize: 10, fontWeight: 700, color: '#a0a0a6', textTransform: 'uppercase', textAlign: 'right' }}>Other Chg ₹</div>
                        <div style={{ width: 95, fontSize: 10, fontWeight: 700, color: '#a0a0a6', textTransform: 'uppercase', textAlign: 'right' }}>Taxable ₹</div>
                        <div style={{ width: 120, fontSize: 10, fontWeight: 700, color: '#a0a0a6', textTransform: 'uppercase' }}>GST Slab %</div>
                        <div style={{ width: 110, fontSize: 10, fontWeight: 700, color: '#a0a0a6', textTransform: 'uppercase', textAlign: 'right' }}>
                          {!isInterstate ? 'CGST+SGST (₹)' : 'IGST (₹)'}
                        </div>
                        <div style={{ flex: 1, fontSize: 10, fontWeight: 700, color: '#a0a0a6', textTransform: 'uppercase', textAlign: 'right' }}>Line Total ₹</div>
                        <div style={{ width: 28, flexShrink: 0 }} />
                      </div>
                    </div>

                    {/* Rows */}
                    {editForm.items.map((it, i) => {
                      const lt = lines[i] || calcLineEdit(it)
                      const isDup = dupEditIds.includes(String(it.material_id))
                      const selMat = mats.find(m => String(m.id) === String(it.material_id))
                      const searchVal = editMatSearch[i] !== undefined ? editMatSearch[i] : (selMat ? `${selMat.name} [${selMat.code}]` : '')
                      const q = (editMatSearch[i] || '').trim().toLowerCase()

                      const rank = m => {
                        if (!q) return 5
                        const name = (m.name || '').toLowerCase(), code = (m.code || '').toLowerCase()
                        if (code === q) return 0
                        if (code.startsWith(q)) return 1
                        if (name.startsWith(q)) return 2
                        if (name.includes(q)) return 3
                        if (code.includes(q) || (m.categoryName || '').toLowerCase().includes(q) || (m.hsn_code || m.hsnCode || '').toLowerCase().includes(q) || (m.bin_location || m.binLocation || '').toLowerCase().includes(q)) return 4
                        return -1
                      }

                      const filtered = (q ? mats.map(m => ({ m, r: rank(m) })).filter(x => x.r >= 0).sort((a, b) => a.r - b.r).map(x => x.m) : mats).slice(0, 100)
                      const itErr = editFormErrors.itemFields?.[i] || {}

                      const grouped = filtered.reduce((acc, m) => {
                        const cat = m.categoryName || 'Uncategorized'
                        ;(acc[cat] = acc[cat] || []).push(m)
                        return acc
                      }, {})
                      const groupNames = q ? Object.keys(grouped) : Object.keys(grouped).sort()

                      return (
                        <div key={i} style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 6,
                          borderBottom: i < editForm.items.length - 1 ? '1px solid #f1efe8' : 'none',
                          background: isDup ? '#fff7ed' : '#ffffff',
                          padding: '10px 12px'
                        }}>

                          {/* Top Row: # + Material Combobox + Description */}
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                            <div style={{ width: 22, flexShrink: 0, textAlign: 'center', fontSize: 11, color: '#a0a0a6', fontWeight: 700, paddingTop: 7 }}>{i + 1}</div>

                            {/* Searchable Material Combobox */}
                            <div style={{ position: 'relative', flex: '1.4 1 260px' }}>
                              <input
                                style={{ ...S.input, fontSize: 12, padding: '6px 24px 6px 8px', background: it.material_id ? '#f0fdf4' : '#f6f5f0', borderColor: itErr.material_id ? '#ef4444' : '#e7e6df' }}
                                placeholder="🔍 Search material name, code, category, HSN..."
                                autoComplete="off"
                                value={searchVal}
                                onFocus={() => setEditMatDropOpen(d => ({ ...d, [i]: true }))}
                                onChange={e => {
                                  const v = e.target.value
                                  setEditMatSearch(s => ({ ...s, [i]: v }))
                                  setEditMatDropOpen(d => ({ ...d, [i]: true }))
                                  if (!v) setEditItem(i, 'material_id', '')
                                }}
                                onBlur={() => setTimeout(() => setEditMatDropOpen(d => ({ ...d, [i]: false })), 180)}
                              />
                              {it.material_id && (
                                <button type="button" title="Clear selection"
                                  style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#8a8a90', fontSize: 13 }}
                                  onClick={() => {
                                    setEditItem(i, 'material_id', '')
                                    setEditMatSearch(s => ({ ...s, [i]: '' }))
                                  }}>✕</button>
                              )}

                              {/* Dropdown Popover */}
                              {editMatDropOpen[i] && filtered.length > 0 && (
                                <div style={{
                                  position: 'absolute', top: '100%', left: 0, right: 6, zIndex: 400,
                                  background: '#ffffff', border: '1px solid #e7e6df', borderRadius: 6,
                                  boxShadow: '0 6px 20px rgba(0,0,0,0.15)', maxHeight: 260, overflowY: 'auto', marginTop: 2
                                }}>
                                  {groupNames.map(cat => (
                                    <div key={cat}>
                                      <div style={{ position: 'sticky', top: 0, background: '#f6f5f0', padding: '4px 10px', fontSize: 10, fontWeight: 700, color: '#8a8a90', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #e7e6df' }}>
                                        {cat} <span style={{ fontWeight: 500 }}>({grouped[cat].length})</span>
                                      </div>
                                      {grouped[cat].map(m => {
                                        const stock = Number(m.currentStock ?? m.current_stock ?? 0)
                                        const low = stock <= Number(m.reorderLevel ?? m.reorder_level ?? 0)
                                        return (
                                          <div key={m.id}
                                            onMouseDown={() => {
                                              const price = parseFloat(m.unitPrice || m.unit_price || 0)
                                              setEditForm(f => ({
                                                ...f,
                                                items: f.items.map((it2, j) => j === i ? {
                                                  ...it2,
                                                  material_id: String(m.id),
                                                  description: m.name || '',
                                                  uom: m.uom || '',
                                                  unit_price: price > 0 ? price.toString() : it2.unit_price
                                                } : it2)
                                              }))
                                              setEditMatSearch(s => ({ ...s, [i]: `${m.name} [${m.code}]` }))
                                              setEditMatDropOpen(d => ({ ...d, [i]: false }))
                                            }}
                                            style={{
                                              padding: '7px 10px', cursor: 'pointer', fontSize: 11,
                                              borderBottom: '1px solid #f1efe8',
                                              background: String(it.material_id) === String(m.id) ? '#f0fdf4' : 'transparent',
                                              display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                                            }}>
                                            <span>
                                              <strong style={{ color: '#1b1b1d' }}>{m.name}</strong>
                                              <span style={{ color: '#8a8a90', fontSize: 10, marginLeft: 4 }}>[{m.code}]</span>
                                              {(m.poCount || m.po_count) ? (
                                                <span style={{ background: '#ede9fe', color: '#6d28d9', fontSize: 9, padding: '1px 6px', borderRadius: 4, marginLeft: 6, fontWeight: 700 }}>
                                                  {m.poCount || m.po_count} PO{(m.poCount || m.po_count) === 1 ? '' : 's'}
                                                </span>
                                              ) : null}
                                            </span>
                                            <span style={{ fontSize: 10, fontWeight: 600, textAlign: 'right' }}>
                                              <span style={{ color: low ? '#ef4444' : '#16a34a' }}>Stock: {stock} {m.uom}</span>
                                              {parseFloat(m.unitPrice || m.unit_price || 0) > 0 && <span style={{ color: '#059669', marginLeft: 6 }}>· ₹{m.unitPrice || m.unit_price}</span>}
                                            </span>
                                          </div>
                                        )
                                      })}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>

                            {/* Description Input */}
                            <input
                              style={{ ...S.input, flex: '1 1 160px', fontSize: 12, padding: '6px 8px' }}
                              placeholder="Item description / specification..."
                              value={it.description || ''}
                              onChange={e => setEditItem(i, 'description', e.target.value)}
                            />

                            {/* Line Remarks Input */}
                            <input
                              style={{ ...S.input, flex: '1 1 140px', fontSize: 12, padding: '6px 8px' }}
                              placeholder="Line Remarks / Purpose..."
                              value={it.remarks || ''}
                              onChange={e => setEditItem(i, 'remarks', e.target.value)}
                              title="Remarks for this line item (matching Purchase Order.xlsx remarks column)"
                            />
                          </div>

                          {/* Bottom Row: Qty + UOM + Unit Price + Disc% + Other Charges + Taxable + GST + Tax + Line Total + Delete */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <div style={{ width: 22, flexShrink: 0 }} />

                            {/* Qty Input */}
                            <div style={{ width: 80 }}>
                              <input
                                style={{ ...S.input, width: '100%', textAlign: 'right', fontSize: 12, padding: '6px 6px', borderColor: itErr.qty ? '#ef4444' : '#e7e6df' }}
                                type="number"
                                step="0.001"
                                min="0.001"
                                placeholder="0.000"
                                value={it.qty}
                                onChange={e => setEditItem(i, 'qty', e.target.value)}
                              />
                            </div>

                            {/* UOM */}
                            <div style={{ width: 60 }}>
                              <input
                                style={{ ...S.input, width: '100%', fontSize: 11, padding: '6px 6px', background: '#f8fafc', color: '#475569', fontWeight: 600 }}
                                placeholder="UOM"
                                value={it.uom || (it.material_id ? matUom(it.material_id) : '')}
                                onChange={e => setEditItem(i, 'uom', e.target.value)}
                              />
                            </div>

                            {/* Unit Price */}
                            <div style={{ width: 90 }}>
                              <input
                                style={{ ...S.input, width: '100%', textAlign: 'right', fontSize: 12, padding: '6px 6px', borderColor: itErr.unit_price ? '#ef4444' : '#e7e6df' }}
                                type="number"
                                step="0.01"
                                min="0"
                                placeholder="₹ 0.00"
                                value={it.unit_price}
                                onChange={e => setEditItem(i, 'unit_price', e.target.value)}
                              />
                            </div>

                            {/* Discount % */}
                            <div style={{ width: 75 }}>
                              <input
                                style={{ ...S.input, width: '100%', textAlign: 'right', fontSize: 12, padding: '6px 6px', color: lt.discPct > 0 ? '#b45309' : undefined, fontWeight: lt.discPct > 0 ? 600 : undefined }}
                                type="number"
                                step="0.01"
                                min="0"
                                max="100"
                                placeholder="0%"
                                value={it.discount_pct !== undefined ? it.discount_pct : ''}
                                onChange={e => setEditItem(i, 'discount_pct', e.target.value)}
                                title="Discount % deducted from gross"
                              />
                            </div>

                            {/* Other Charges */}
                            <div style={{ width: 90 }}>
                              <input
                                style={{ ...S.input, width: '100%', textAlign: 'right', fontSize: 12, padding: '6px 6px', color: lt.otherCharges > 0 ? '#0369a1' : undefined, fontWeight: lt.otherCharges > 0 ? 600 : undefined }}
                                type="number"
                                step="0.01"
                                min="0"
                                placeholder="0.00"
                                value={it.other_charges !== undefined ? it.other_charges : ''}
                                onChange={e => setEditItem(i, 'other_charges', e.target.value)}
                                title="Other charges: Transport / P&F"
                              />
                            </div>

                            {/* Taxable Base */}
                            <div style={{ width: 95, textAlign: 'right', fontSize: 12, fontWeight: 700, color: '#334155', paddingTop: 6 }}>
                              {fmt(lt.taxable)}
                            </div>

                            {/* GST Slab */}
                            <div style={{ width: 120 }}>
                              <select
                                style={{ ...S.select, width: '100%', fontSize: 11, padding: '5px 4px' }}
                                value={Number(it.gst_pct ?? 18)}
                                onChange={e => setEditItem(i, 'gst_pct', Number(e.target.value))}
                              >
                                {GST_SLABS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                              </select>
                            </div>

                            {/* Tax Amount */}
                            <div style={{ width: 110, textAlign: 'right', fontSize: 11, color: !isInterstate ? '#059669' : '#6366f1', paddingTop: 4 }}>
                              <div style={{ fontWeight: 700 }}>{fmt(lt.tax)}</div>
                              <div style={{ fontSize: 9 }}>
                                {!isInterstate ? `(C: ${fmt(lt.cgst)} + S: ${fmt(lt.sgst)})` : `(IGST: ${fmt(lt.igst)})`}
                              </div>
                            </div>

                            {/* Line Total */}
                            <div style={{ flex: 1, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 800, fontSize: 13, color: '#0f766e', paddingTop: 6 }}>
                              {fmt(lt.total)}
                            </div>

                            {/* Delete button */}
                            <div style={{ width: 28, flexShrink: 0, textAlign: 'center', paddingTop: 4 }}>
                              <button
                                type="button"
                                style={{ ...S.btnIcon, color: '#ef4444', fontSize: 14, cursor: 'pointer' }}
                                onClick={() => removeEditItem(i)}
                                title="Remove line item"
                              >🗑</button>
                            </div>
                          </div>

                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* ── Financial Summary Box ── */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
                  <div style={{ ...SS.summaryBox, minWidth: 360, background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: 8, padding: 14 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <div style={SS.summaryRow}>
                        <span style={{ fontSize: 12, color: '#64748b' }}>Gross Base Amount:</span>
                        <span style={SS.summaryVal}>{fmt(totGross)}</span>
                      </div>
                      {totDiscount > 0 && (
                        <div style={{ ...SS.summaryRow, color: '#b45309' }}>
                          <span style={{ fontSize: 12 }}>Total Discount (-):</span>
                          <span style={{ ...SS.summaryVal, color: '#b45309' }}>-{fmt(totDiscount)}</span>
                        </div>
                      )}
                      {totOtherCharges > 0 && (
                        <div style={{ ...SS.summaryRow, color: '#0369a1' }}>
                          <span style={{ fontSize: 12 }}>Other Charges (Transport / P&amp;F) (+):</span>
                          <span style={{ ...SS.summaryVal, color: '#0369a1' }}>+{fmt(totOtherCharges)}</span>
                        </div>
                      )}
                      <div style={{ ...SS.summaryRow, borderTop: '1px solid #e2e8f0', paddingTop: 4 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: '#0f172a' }}>Taxable Subtotal:</span>
                        <span style={{ ...SS.summaryVal, fontWeight: 700 }}>{fmt(totSub)}</span>
                      </div>
                      {!isInterstate ? (
                        <>
                          <div style={SS.summaryRow}>
                            <span style={{ fontSize: 11, color: '#059669' }}>CGST (50%):</span>
                            <span style={{ ...SS.summaryVal, fontSize: 12, color: '#059669' }}>{fmt(totCgst)}</span>
                          </div>
                          <div style={SS.summaryRow}>
                            <span style={{ fontSize: 11, color: '#059669' }}>SGST (50%):</span>
                            <span style={{ ...SS.summaryVal, fontSize: 12, color: '#059669' }}>{fmt(totSgst)}</span>
                          </div>
                        </>
                      ) : (
                        <div style={SS.summaryRow}>
                          <span style={{ fontSize: 11, color: '#6366f1' }}>IGST (Interstate):</span>
                          <span style={{ ...SS.summaryVal, fontSize: 12, color: '#6366f1' }}>{fmt(totIgst)}</span>
                        </div>
                      )}
                      <div style={{ ...SS.summaryRow, borderTop: '1px solid #cbd5e1', paddingTop: 8, marginTop: 4 }}>
                        <span style={{ fontSize: 14, fontWeight: 800, color: '#0f766e' }}>Grand Total (INR):</span>
                        <span style={{ fontSize: 18, fontWeight: 900, color: '#0f766e' }}>{fmt(totGrand)}</span>
                      </div>
                      <div style={{ fontSize: 11, color: '#0f766e', fontWeight: 700, fontStyle: 'italic', marginTop: 4, textAlign: 'right' }}>
                        {numberToWords(totGrand)}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Modal Footer */}
                <div style={S.modalFooter}>
                  <button type="button" style={S.btnSecondary} onClick={() => setEditModal(null)}>Cancel</button>
                  <button type="submit" style={{ ...S.btnPrimary, background: '#0284c7', display: 'flex', alignItems: 'center', gap: 6 }} disabled={editSaving}>
                    {editSaving ? 'Saving Changes…' : '💾 Save PO Changes'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )
      })()}

      {/* GRN RECEIVE MODAL */}
      {grnModal && (
        <div style={S.overlay} onClick={() => setGrnModal(null)}>
          <div style={{ ...S.modal, maxWidth: 960 }} onClick={e => e.stopPropagation()}>
            <div style={S.modalHeader}>
              <div>
                <div style={S.modalTitle}>📦 Receive Inward GRN — {grnModal.po_number}</div>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>Vendor: <strong>{grnModal.vendorName}</strong></div>
              </div>
              <button style={S.close} onClick={() => setGrnModal(null)}>✕</button>
            </div>
            <form onSubmit={saveGRN} style={S.form}>
              <div style={S.grid2}>
                <label style={S.label}>Challan No<input style={S.input} value={grnForm.challan_number} onChange={e => setGrnForm(f => ({ ...f, challan_number: e.target.value }))} placeholder="DC/Challan number" /></label>
                <label style={S.label}>Invoice No<input style={S.input} value={grnForm.invoice_number} onChange={e => setGrnForm(f => ({ ...f, invoice_number: e.target.value }))} placeholder="Vendor invoice no" /></label>
                <label style={S.label}>Vehicle No<input style={S.input} value={grnForm.vehicle_number} onChange={e => setGrnForm(f => ({ ...f, vehicle_number: e.target.value }))} placeholder="e.g. MH12AB1234" /></label>
                <label style={S.label}>Remarks<input style={S.input} value={grnForm.remarks} onChange={e => setGrnForm(f => ({ ...f, remarks: e.target.value }))} /></label>
              </div>
              <div style={{ fontWeight: 700, color: '#0f766e', fontSize: 12, marginTop: 8, textTransform: 'uppercase' }}>
                Items — Enter received quantities, discounts &amp; other charges
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={S.table}>
                  <thead>
                    <tr style={S.thead}>
                      {['Material', 'PO Qty', 'Received', 'Accepted', 'Rejected', 'Unit Rate ₹', 'Disc %', 'Other Chg ₹', 'Batch/Lot'].map(h => <th key={h} style={S.th}>{h}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {grnForm.items.map((it, i) => (
                      <tr key={i} style={S.tr}>
                        <td style={S.td}>
                          <div style={{ fontWeight: 600, fontSize: 12 }}>{it.material_name}</div>
                          <span style={{ ...S.muted, fontSize: 10 }}>{it.uom}</span>
                        </td>
                        <td style={S.td}><span style={S.muted}>{it.po_qty}</span></td>
                        <td style={S.td}><input style={{ ...S.input, width: 65, padding: '4px 6px', textAlign: 'right' }} type="number" step="0.001" min="0.001" value={it.received_qty} onChange={e => { const v = e.target.value; setGrnForm(f => ({ ...f, items: f.items.map((x, j) => j === i ? { ...x, received_qty: v, accepted_qty: v } : x) })) }} /></td>
                        <td style={S.td}>
                          <input style={{ ...S.input, width: 65, padding: '4px 6px', textAlign: 'right', ...((parseFloat(it.accepted_qty) || 0) > (parseFloat(it.received_qty) || 0) ? { border: '1px solid #ef4444', background: '#ef444411' } : {}) }} type="number" step="0.001" min="0" value={it.accepted_qty} onChange={e => { const v = e.target.value; setGrnForm(f => ({ ...f, items: f.items.map((x, j) => j === i ? { ...x, accepted_qty: v } : x) })) }} />
                          {(parseFloat(it.accepted_qty) || 0) > (parseFloat(it.received_qty) || 0) && <div style={{ fontSize: 9, color: '#ef4444', fontWeight: 600, marginTop: 2 }}>Exceeds received</div>}
                        </td>
                        <td style={S.td}><input style={{ ...S.input, width: 60, padding: '4px 6px', textAlign: 'right' }} type="number" step="0.001" value={it.rejected_qty} onChange={e => { const v = e.target.value; setGrnForm(f => ({ ...f, items: f.items.map((x, j) => j === i ? { ...x, rejected_qty: v } : x) })) }} /></td>
                        <td style={S.td}><input style={{ ...S.input, width: 75, padding: '4px 6px', textAlign: 'right' }} type="number" step="0.01" value={it.unit_price} onChange={e => { const v = e.target.value; setGrnForm(f => ({ ...f, items: f.items.map((x, j) => j === i ? { ...x, unit_price: v } : x) })) }} /></td>
                        <td style={S.td}><input style={{ ...S.input, width: 60, padding: '4px 6px', textAlign: 'right' }} type="number" step="0.01" min="0" max="100" placeholder="0%" value={it.discount_pct !== undefined ? it.discount_pct : ''} onChange={e => { const v = e.target.value; setGrnForm(f => ({ ...f, items: f.items.map((x, j) => j === i ? { ...x, discount_pct: v } : x) })) }} /></td>
                        <td style={S.td}><input style={{ ...S.input, width: 75, padding: '4px 6px', textAlign: 'right' }} type="number" step="0.01" min="0" placeholder="0.00" value={it.other_charges !== undefined ? it.other_charges : ''} onChange={e => { const v = e.target.value; setGrnForm(f => ({ ...f, items: f.items.map((x, j) => j === i ? { ...x, other_charges: v } : x) })) }} /></td>
                        <td style={S.td}><input style={{ ...S.input, width: 90, padding: '4px 6px' }} value={it.batch_number} onChange={e => { const v = e.target.value; setGrnForm(f => ({ ...f, items: f.items.map((x, j) => j === i ? { ...x, batch_number: v } : x) })) }} placeholder="Batch/Lot" /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {grnErr && <div style={S.error}>{grnErr}</div>}
              <div style={S.modalFooter}>
                <button type="button" style={S.btnSecondary} onClick={() => setGrnModal(null)}>Cancel</button>
                <button type="submit" style={S.btnPrimary} disabled={grnSaving}>{grnSaving ? 'Saving GRN…' : '✓ Save GRN & Print Receipt'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═══════ DEDICATED EDIT GRN MODAL ═══════ */}
      {editGrnModal && (() => {
        const isInterstate = editGrnForm.tax_type === 'inter' || editGrnForm.tax_type === 'state' || editGrnForm.tax_type === 'igst'
        
        const calcGrnLine = it => {
          const accQty = parseFloat(it.accepted_qty) || 0
          const uPrice = parseFloat(it.unit_price) || 0
          const gross = Math.round((accQty * uPrice + Number.EPSILON) * 100) / 100
          const discPct = Math.max(0, Math.min(100, parseFloat(it.discount_pct || 0) || 0))
          const discAmt = Math.round((gross * (discPct / 100) + Number.EPSILON) * 100) / 100
          const discBase = Math.max(0, gross - discAmt)
          const otherCharges = parseFloat(it.other_charges || 0) || 0
          const taxable = Math.round((discBase + otherCharges + Number.EPSILON) * 100) / 100
          const g = parseFloat(it.gst_pct !== undefined ? it.gst_pct : 18) || 0

          let cgst = 0, sgst = 0, igst = 0
          if (isInterstate) {
            igst = Math.round((taxable * (g / 100) + Number.EPSILON) * 100) / 100
          } else {
            cgst = Math.round((taxable * (g / 200) + Number.EPSILON) * 100) / 100
            sgst = Math.round((taxable * (g / 200) + Number.EPSILON) * 100) / 100
          }
          const tax = cgst + sgst + igst
          const total = Math.round((taxable + tax + Number.EPSILON) * 100) / 100
          return { gross, discAmt, otherCharges, taxable, cgst, sgst, igst, tax, total }
        }

        const grnLines = editGrnForm.items.map(calcGrnLine)
        const totGross = grnLines.reduce((s, l) => s + l.gross, 0)
        const totDisc = grnLines.reduce((s, l) => s + l.discAmt, 0)
        const totOther = grnLines.reduce((s, l) => s + l.otherCharges, 0)
        const totTaxable = grnLines.reduce((s, l) => s + l.taxable, 0)
        const totCgst = grnLines.reduce((s, l) => s + l.cgst, 0)
        const totSgst = grnLines.reduce((s, l) => s + l.sgst, 0)
        const totIgst = grnLines.reduce((s, l) => s + l.igst, 0)
        const totTax = grnLines.reduce((s, l) => s + l.tax, 0)
        const grandTotal = totTaxable + totTax

        return (
          <div style={S.overlay} onClick={() => setEditGrnModal(null)}>
            <div style={{ ...S.modal, maxWidth: 1200, maxHeight: '92vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
              <div style={S.modalHeader}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ fontSize: 18, fontWeight: 800, color: '#0f766e' }}>
                      ✏️ Edit Goods Receipt Note (GRN) — {editGrnModal.grnNumber || editGrnModal.grn_number}
                    </div>
                    <span style={{ ...S.badge, background: '#dcfce7', color: '#15803d' }}>
                      {editGrnModal.status || 'Received'}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 3 }}>
                    PO: <strong>{editGrnModal.poNumber || editGrnModal.po_number || 'Direct'}</strong> · Vendor: <strong>{editGrnModal.vendorName}</strong> {editGrnModal.vendorGstin ? `(GSTIN: ${editGrnModal.vendorGstin})` : ''}
                  </div>
                </div>

                {/* Tax Type Mode Selector */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ display: 'flex', gap: 4, background: '#f1f5f9', padding: 3, borderRadius: 8 }}>
                    <button
                      type="button"
                      onClick={() => setEditGrnForm(f => ({ ...f, tax_type: 'intra' }))}
                      style={{
                        padding: '5px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer', border: 'none',
                        background: !isInterstate ? '#059669' : 'transparent',
                        color: !isInterstate ? '#ffffff' : '#475569'
                      }}
                    >
                      📍 In-State (CGST+SGST)
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditGrnForm(f => ({ ...f, tax_type: 'inter' }))}
                      style={{
                        padding: '5px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer', border: 'none',
                        background: isInterstate ? '#6366f1' : 'transparent',
                        color: isInterstate ? '#ffffff' : '#475569'
                      }}
                    >
                      🌐 State / Inter (IGST)
                    </button>
                  </div>
                  <button style={S.close} onClick={() => setEditGrnModal(null)}>✕</button>
                </div>
              </div>

              <form onSubmit={saveEditGrn} style={S.form}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, background: '#f8fafc', padding: 14, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                  <label style={S.label}>Delivery Challan #<input style={S.input} value={editGrnForm.challan_number} onChange={e => setEditGrnForm(f => ({ ...f, challan_number: e.target.value }))} /></label>
                  <label style={S.label}>Vendor Invoice #<input style={S.input} value={editGrnForm.invoice_number} onChange={e => setEditGrnForm(f => ({ ...f, invoice_number: e.target.value }))} /></label>
                  <label style={S.label}>Vehicle #<input style={S.input} value={editGrnForm.vehicle_number} onChange={e => setEditGrnForm(f => ({ ...f, vehicle_number: e.target.value }))} /></label>
                  <label style={S.label}>Inward Date<input style={S.input} type="date" value={editGrnForm.date} onChange={e => setEditGrnForm(f => ({ ...f, date: e.target.value }))} /></label>
                  <label style={{ ...S.label, gridColumn: '1 / -1' }}>Remarks / Quality Inspection Notes<input style={S.input} value={editGrnForm.remarks} onChange={e => setEditGrnForm(f => ({ ...f, remarks: e.target.value }))} /></label>
                </div>

                <div style={{ fontWeight: 700, color: '#0f766e', fontSize: 12, marginTop: 4, textTransform: 'uppercase' }}>
                  GRN Line Items — Edit Quantities, Unit Rates, Discount %, and Other Charges
                </div>

                <div style={{ overflowX: 'auto', border: '1px solid #e7e6df', borderRadius: 8 }}>
                  <table style={S.table}>
                    <thead>
                      <tr style={S.thead}>
                        {['Material', 'Accepted Qty', 'UOM', 'Unit Rate (₹)', 'Disc %', 'Other Chg (₹)', 'Taxable Base (₹)', 'GST Slab', 'Tax Amount (₹)', 'Line Total (₹)', 'Bin / Batch'].map(h => <th key={h} style={S.th}>{h}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {editGrnForm.items.map((it, i) => {
                        const line = grnLines[i] || calcGrnLine(it)
                        return (
                          <tr key={i} style={S.tr}>
                            <td style={S.td}>
                              <div style={{ fontWeight: 700, fontSize: 12 }}>{it.materialName}</div>
                              <div style={{ fontSize: 10, color: '#64748b' }}>{it.materialCode}</div>
                            </td>
                            <td style={S.td}>
                              <input style={{ ...S.input, width: 75, textAlign: 'right', padding: '5px 6px' }} type="number" step="0.001" min="0" value={it.accepted_qty} onChange={e => setEditGrnItem(i, 'accepted_qty', e.target.value)} />
                            </td>
                            <td style={S.td}><span style={{ fontSize: 11, color: '#475569' }}>{it.uom}</span></td>
                            <td style={S.td}>
                              <input style={{ ...S.input, width: 85, textAlign: 'right', padding: '5px 6px' }} type="number" step="0.01" min="0" value={it.unit_price} onChange={e => setEditGrnItem(i, 'unit_price', e.target.value)} />
                            </td>
                            <td style={S.td}>
                              <input style={{ ...S.input, width: 65, textAlign: 'right', padding: '5px 6px', color: it.discount_pct > 0 ? '#b45309' : undefined, fontWeight: it.discount_pct > 0 ? 700 : undefined }} type="number" step="0.01" min="0" max="100" placeholder="0%" value={it.discount_pct !== undefined ? it.discount_pct : ''} onChange={e => setEditGrnItem(i, 'discount_pct', e.target.value)} />
                            </td>
                            <td style={S.td}>
                              <input style={{ ...S.input, width: 80, textAlign: 'right', padding: '5px 6px', color: it.other_charges > 0 ? '#0369a1' : undefined, fontWeight: it.other_charges > 0 ? 700 : undefined }} type="number" step="0.01" min="0" placeholder="0.00" value={it.other_charges !== undefined ? it.other_charges : ''} onChange={e => setEditGrnItem(i, 'other_charges', e.target.value)} />
                            </td>
                            <td style={{ ...S.td, textAlign: 'right', fontWeight: 700, color: '#334155' }}>
                              {fmt(line.taxable)}
                            </td>
                            <td style={S.td}>
                              <select style={{ ...S.select, fontSize: 11, padding: '4px 6px' }} value={Number(it.gst_pct ?? 18)} onChange={e => setEditGrnItem(i, 'gst_pct', Number(e.target.value))}>
                                {GST_SLABS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                              </select>
                            </td>
                            <td style={{ ...S.td, textAlign: 'right', fontSize: 11, color: !isInterstate ? '#059669' : '#6366f1' }}>
                              <div style={{ fontWeight: 700 }}>{fmt(line.tax)}</div>
                              <div style={{ fontSize: 9 }}>{!isInterstate ? `(C: ${fmt(line.cgst)} + S: ${fmt(line.sgst)})` : `(IGST: ${fmt(line.igst)})`}</div>
                            </td>
                            <td style={{ ...S.td, textAlign: 'right', fontWeight: 800, color: '#0f766e' }}>
                              {fmt(line.total)}
                            </td>
                            <td style={S.td}>
                              <input style={{ ...S.input, width: 80, fontSize: 11, padding: '4px 6px' }} placeholder="Batch" value={it.batch_number || ''} onChange={e => setEditGrnItem(i, 'batch_number', e.target.value)} />
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Live Financial Summary */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
                  <div style={{ minWidth: 360, background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: 8, padding: 14 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <div style={SS.summaryRow}>
                        <span style={{ fontSize: 12, color: '#64748b' }}>Gross Inward Value:</span>
                        <span style={SS.summaryVal}>{fmt(totGross)}</span>
                      </div>
                      {totDisc > 0 && (
                        <div style={{ ...SS.summaryRow, color: '#b45309' }}>
                          <span style={{ fontSize: 12 }}>Total Discount (-):</span>
                          <span style={{ ...SS.summaryVal, color: '#b45309' }}>-{fmt(totDisc)}</span>
                        </div>
                      )}
                      {totOther > 0 && (
                        <div style={{ ...SS.summaryRow, color: '#0369a1' }}>
                          <span style={{ fontSize: 12 }}>Other Charges (Transport / P&amp;F) (+):</span>
                          <span style={{ ...SS.summaryVal, color: '#0369a1' }}>+{fmt(totOther)}</span>
                        </div>
                      )}
                      <div style={{ ...SS.summaryRow, borderTop: '1px solid #e2e8f0', paddingTop: 4 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: '#0f172a' }}>Taxable Base:</span>
                        <span style={{ ...SS.summaryVal, fontWeight: 700 }}>{fmt(totTaxable)}</span>
                      </div>
                      {!isInterstate ? (
                        <>
                          <div style={SS.summaryRow}>
                            <span style={{ fontSize: 11, color: '#059669' }}>CGST Total (50%):</span>
                            <span style={{ ...SS.summaryVal, fontSize: 12, color: '#059669' }}>{fmt(totCgst)}</span>
                          </div>
                          <div style={SS.summaryRow}>
                            <span style={{ fontSize: 11, color: '#059669' }}>SGST Total (50%):</span>
                            <span style={{ ...SS.summaryVal, fontSize: 12, color: '#059669' }}>{fmt(totSgst)}</span>
                          </div>
                        </>
                      ) : (
                        <div style={SS.summaryRow}>
                          <span style={{ fontSize: 11, color: '#6366f1' }}>IGST Total (Interstate):</span>
                          <span style={{ ...SS.summaryVal, fontSize: 12, color: '#6366f1' }}>{fmt(totIgst)}</span>
                        </div>
                      )}
                      <div style={{ ...SS.summaryRow, borderTop: '1px solid #cbd5e1', paddingTop: 8, marginTop: 4 }}>
                        <span style={{ fontSize: 14, fontWeight: 800, color: '#0f766e' }}>Grand Total Valuation:</span>
                        <span style={{ fontSize: 18, fontWeight: 900, color: '#0f766e' }}>{fmt(grandTotal)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {editGrnErr && <div style={S.error}>{editGrnErr}</div>}

                <div style={S.modalFooter}>
                  <button type="button" style={S.btnSecondary} onClick={() => setEditGrnModal(null)}>Cancel</button>
                  <button type="submit" style={{ ...S.btnPrimary, background: '#0f766e' }} disabled={editGrnSaving}>
                    {editGrnSaving ? 'Updating GRN & Stock Ledger…' : '✓ Save GRN & Sync Ledger'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )
      })()}

      {/* ═══════ BOOK VENDOR BILL MODAL ═══════ */}
      {billModal && (
        <div style={S.overlay} onClick={()=>setBillModal(null)}>
          <div style={{...S.modal, maxWidth: 560}} onClick={e=>e.stopPropagation()}>
            <div style={S.modalHeader}>
              <div>
                <div style={S.modalTitle}>🧾 Book Commercial Vendor Bill for Finance</div>
                <div style={{fontSize: 12, color: '#64748b', marginTop: 2}}>PO: {billModal.po_number || billModal.poNumber} · Vendor: {billModal.vendorName}</div>
              </div>
              <button style={S.close} onClick={()=>setBillModal(null)}>✕</button>
            </div>

            <form onSubmit={saveBill} style={S.form}>
              {billErr && <div style={S.error}>{billErr}</div>}
              {billSuccess && <div style={{background: '#dcfce7', color: '#15803d', padding: '8px 12px', borderRadius: 6, fontSize: 13}}>{billSuccess}</div>}

              <div style={S.grid2}>
                <label style={S.label}>Vendor Invoice Number *
                  <input style={S.input} placeholder="e.g. INV/2026/088" value={billForm.vendor_invoice_number} onChange={e=>setBillForm({...billForm, vendor_invoice_number: e.target.value})} required />
                </label>
                <label style={S.label}>Invoice Date *
                  <input style={S.input} type="date" value={billForm.invoice_date} onChange={e=>setBillForm({...billForm, invoice_date: e.target.value})} required />
                </label>
              </div>

              <div style={S.grid2}>
                <label style={S.label}>Payment Due Date
                  <input style={S.input} type="date" value={billForm.due_date} onChange={e=>setBillForm({...billForm, due_date: e.target.value})} />
                </label>
                <label style={S.label}>Taxable Amount (₹) *
                  <input style={S.input} type="number" step="0.01" value={billForm.taxable_amount} onChange={e=>setBillForm({...billForm, taxable_amount: parseFloat(e.target.value)||0})} required />
                </label>
              </div>

              <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10}}>
                <label style={S.label}>CGST (₹)
                  <input style={S.input} type="number" step="0.01" value={billForm.cgst_amount} onChange={e=>setBillForm({...billForm, cgst_amount: parseFloat(e.target.value)||0})} />
                </label>
                <label style={S.label}>SGST (₹)
                  <input style={S.input} type="number" step="0.01" value={billForm.sgst_amount} onChange={e=>setBillForm({...billForm, sgst_amount: parseFloat(e.target.value)||0})} />
                </label>
                <label style={S.label}>IGST (₹)
                  <input style={S.input} type="number" step="0.01" value={billForm.igst_amount} onChange={e=>setBillForm({...billForm, igst_amount: parseFloat(e.target.value)||0})} />
                </label>
              </div>

              <div style={{background: '#f8fafc', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                <span style={{fontSize: 13, fontWeight: 600, color: '#334155'}}>Total Invoice Amount to Pay:</span>
                <span style={{fontSize: 18, fontWeight: 700, color: '#0369a1'}}>
                  {fmt((parseFloat(billForm.taxable_amount)||0) + (parseFloat(billForm.cgst_amount)||0) + (parseFloat(billForm.sgst_amount)||0) + (parseFloat(billForm.igst_amount)||0) + (parseFloat(billForm.roundoff)||0))}
                </span>
              </div>

              <label style={S.label}>Remarks / GRN Verification Notes
                <input style={S.input} placeholder="Notes for Finance AP verification..." value={billForm.remarks} onChange={e=>setBillForm({...billForm, remarks: e.target.value})} />
              </label>

              <div style={S.modalFooter}>
                <button type="button" style={S.btnSecondary} onClick={()=>setBillModal(null)}>Cancel</button>
                <button type="submit" style={{...S.btnPrimary, background: '#0284c7'}} disabled={billSaving}>
                  {billSaving ? 'Booking Bill…' : '✓ Forward Bill to Finance'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═══════ CREATE CASH PURCHASE MODAL ═══════ */}
      {cashModal && (() => {
        const isInter = cashForm.vendor_gstin && !cashForm.vendor_gstin.startsWith('29')
        const calcCpLine = it => {
          const q = parseFloat(it.qty) || 0, p = parseFloat(it.unit_price) || 0, g = parseFloat(it.gst_pct) || 18
          const base = q * p
          const tax = (base * g) / 100
          const cgst = isInter ? 0 : tax / 2
          const sgst = isInter ? 0 : tax / 2
          const igst = isInter ? tax : 0
          return { base, tax, cgst, sgst, igst, total: base + tax }
        }
        const subtotal = cashForm.items.reduce((a, it) => a + calcCpLine(it).base, 0)
        const totalCgst = cashForm.items.reduce((a, it) => a + calcCpLine(it).cgst, 0)
        const totalSgst = cashForm.items.reduce((a, it) => a + calcCpLine(it).sgst, 0)
        const totalIgst = cashForm.items.reduce((a, it) => a + calcCpLine(it).igst, 0)
        const totalTax = cashForm.items.reduce((a, it) => a + calcCpLine(it).tax, 0)
        const grandTotal = subtotal + totalTax

        const addCpItem = () => setCashForm(f => ({ ...f, items: [...f.items, blankItem()] }))
        const removeCpItem = i => setCashForm(f => ({ ...f, items: f.items.filter((_, j) => j !== i) }))
        const setCpItem = (i, k, v) => setCashForm(f => ({ ...f, items: f.items.map((it, j) => j === i ? { ...it, [k]: v } : it) }))

        return (
          <div style={S.overlay} onClick={() => setCashModal(false)}>
            <div style={{ ...S.modal, maxWidth: 900, maxHeight: '92vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
              <div style={S.modalHeader}>
                <div>
                  <div style={{ ...S.modalTitle, display: 'flex', alignItems: 'center', gap: 8, color: '#16a34a' }}>
                    <span>💵</span> Direct Cash Purchase &amp; Spot Procurement
                  </div>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                    Instant stock increment · Automatic Stock Ledger posting · Paid Vendor Bill generation
                  </div>
                </div>
                <button style={S.close} onClick={() => setCashModal(false)}>✕</button>
              </div>

              {cashErr && <div style={S.error}>{cashErr}</div>}
              {cashSuccess && <div style={{ background: '#dcfce7', color: '#15803d', padding: '10px 14px', borderRadius: 8, fontSize: 13, fontWeight: 700, marginBottom: 14 }}>{cashSuccess}</div>}

              <form onSubmit={saveCashPurchase} style={S.form}>
                {/* Optional PR Linkage Banner */}
                <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8, padding: '10px 14px' }}>
                  <label style={{ ...S.label, color: '#166534', fontWeight: 700 }}>
                    📋 Optional: Link Purchase Requisition (PR / Indent) to Fulfill:
                    <select
                      style={{ ...S.select, marginTop: 4, background: '#ffffff', borderColor: '#86efac' }}
                      value={cashForm.indent_id || ''}
                      onChange={async e => {
                        const indId = e.target.value
                        if (!indId) {
                          setCashForm(f => ({ ...f, indent_id: '' }))
                          return
                        }
                        const r = await API(`/api/indent/${indId}`)
                        if (r.success) {
                          const ind = r.data
                          setCashForm(f => ({
                            ...f,
                            indent_id: ind.id,
                            remarks: f.remarks || `Cash Purchase against PR ${ind.indent_number} (${ind.deptName || ''})`,
                            items: (ind.items || []).length ? ind.items.map(it => ({
                              material_id: it.material_id,
                              description: it.materialName || '',
                              qty: String(it.required_qty || 1),
                              uom: it.matUom || it.uom || '',
                              unit_price: String(it.unit_price || 0),
                              gst_pct: 18,
                              _search: it.materialName || ''
                            })) : [blankItem()]
                          }))
                        }
                      }}
                    >
                      <option value="">-- Direct Walk-in / Spot Cash Purchase (No Indent) --</option>
                      {approvedIndents.map(ind => (
                        <option key={ind.id} value={ind.id}>
                          {ind.indentNumber || ind.indent_number} — {ind.deptName || 'Dept'} ({ind.itemCount || ind.items?.length || 0} items)
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                {/* Supplier and Invoice Info */}
                <div style={S.grid2}>
                  <label style={S.label}>Supplier / Local Vendor Name *
                    <input
                      style={S.input}
                      placeholder="e.g. Local Hardware &amp; Bearing Store"
                      value={cashForm.vendor_name}
                      onChange={e => setCashForm({ ...cashForm, vendor_name: e.target.value })}
                      required
                    />
                  </label>
                  <label style={S.label}>Vendor GSTIN (Optional)
                    <input
                      style={S.input}
                      placeholder="29AAAAA0000A1Z5 (or blank for exempt/unreg)"
                      value={cashForm.vendor_gstin}
                      onChange={e => setCashForm({ ...cashForm, vendor_gstin: e.target.value })}
                    />
                  </label>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                  <label style={S.label}>Cash Memo / Receipt No
                    <input
                      style={S.input}
                      placeholder="Memo # / Bill #"
                      value={cashForm.invoice_number}
                      onChange={e => setCashForm({ ...cashForm, invoice_number: e.target.value })}
                    />
                  </label>
                  <label style={S.label}>Purchase Date *
                    <input
                      style={S.input}
                      type="date"
                      value={cashForm.invoice_date}
                      onChange={e => setCashForm({ ...cashForm, invoice_date: e.target.value })}
                      required
                    />
                  </label>
                  <label style={S.label}>Payment Method *
                    <select
                      style={S.select}
                      value={cashForm.payment_mode}
                      onChange={e => setCashForm({ ...cashForm, payment_mode: e.target.value })}
                    >
                      {['Cash', 'Petty Cash', 'UPI / GPay / PhonePe', 'Company Debit Card', 'Bank Transfer (IMPS)'].map(m => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </label>
                </div>

                {/* Line items */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontWeight: 700, color: '#166534', fontSize: 12, textTransform: 'uppercase' }}>Purchased Materials (Direct Stock Intake)</span>
                    <button type="button" style={{ ...S.btnPrimary, background: '#16a34a', padding: '4px 12px', fontSize: 11 }} onClick={addCpItem}>
                      ＋ Add Material
                    </button>
                  </div>

                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: '#f0fdf4', borderBottom: '1px solid #bbf7d0', color: '#166534' }}>
                        <th style={{ padding: '8px 6px', textAlign: 'left' }}>Material *</th>
                        <th style={{ padding: '8px 6px', width: 90, textAlign: 'right' }}>Qty *</th>
                        <th style={{ padding: '8px 6px', width: 70 }}>UOM</th>
                        <th style={{ padding: '8px 6px', width: 100, textAlign: 'right' }}>Rate (₹) *</th>
                        <th style={{ padding: '8px 6px', width: 80, textAlign: 'center' }}>GST%</th>
                        <th style={{ padding: '8px 6px', width: 110, textAlign: 'right' }}>Total (₹)</th>
                        <th style={{ padding: '8px 6px', width: 36 }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {cashForm.items.map((it, idx) => {
                        const line = calcCpLine(it)
                        const selMat = mats.find(m => String(m.id) === String(it.material_id))
                        return (
                          <tr key={idx} style={{ borderBottom: '1px solid #e7e6df' }}>
                            <td style={{ padding: '6px 4px' }}>
                              <select
                                style={{ ...S.select, width: '100%', fontSize: 12 }}
                                value={it.material_id}
                                onChange={e => {
                                  const mId = e.target.value
                                  const m = mats.find(x => String(x.id) === String(mId))
                                  setCpItem(idx, 'material_id', mId)
                                  if (m) {
                                    setCpItem(idx, 'uom', m.uom || 'NOS')
                                    if (parseFloat(m.unit_price) > 0) setCpItem(idx, 'unit_price', String(m.unit_price))
                                  }
                                }}
                                required
                              >
                                <option value="">Select material from inventory catalog...</option>
                                {mats.map(m => (
                                  <option key={m.id} value={m.id}>
                                    {m.name} [{m.code}] (Current Stock: {m.current_stock || 0} {m.uom})
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td style={{ padding: '6px 4px' }}>
                              <input
                                style={{ ...S.input, width: '100%', textAlign: 'right', fontSize: 12, padding: '6px 4px' }}
                                type="number"
                                step="0.001"
                                min="0.001"
                                placeholder="Qty"
                                value={it.qty}
                                onChange={e => setCpItem(idx, 'qty', e.target.value)}
                                required
                              />
                            </td>
                            <td style={{ padding: '6px 4px' }}>
                              <span style={{ fontSize: 11, color: '#64748b' }}>{it.uom || selMat?.uom || 'NOS'}</span>
                            </td>
                            <td style={{ padding: '6px 4px' }}>
                              <input
                                style={{ ...S.input, width: '100%', textAlign: 'right', fontSize: 12, padding: '6px 4px' }}
                                type="number"
                                step="0.01"
                                min="0"
                                placeholder="Rate"
                                value={it.unit_price}
                                onChange={e => setCpItem(idx, 'unit_price', e.target.value)}
                                required
                              />
                            </td>
                            <td style={{ padding: '6px 4px' }}>
                              <select
                                style={{ ...S.select, width: '100%', fontSize: 11, padding: '4px 2px' }}
                                value={it.gst_pct}
                                onChange={e => setCpItem(idx, 'gst_pct', parseFloat(e.target.value))}
                              >
                                {[0, 5, 12, 18, 28].map(g => (
                                  <option key={g} value={g}>{g}%</option>
                                ))}
                              </select>
                            </td>
                            <td style={{ padding: '6px 4px', textAlign: 'right', fontWeight: 700, color: '#15803d' }}>
                              {fmt(line.total)}
                            </td>
                            <td style={{ padding: '6px 4px', textAlign: 'center' }}>
                              {cashForm.items.length > 1 && (
                                <button type="button" style={{ ...S.btnIcon, color: '#dc2626' }} onClick={() => removeCpItem(idx)}>
                                  ✕
                                </button>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Valuation Summary Card */}
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: 12, color: '#64748b' }}>
                    <div>Taxable: <strong>{fmt(subtotal)}</strong></div>
                    <div>Total GST: <strong>{fmt(totalTax)}</strong> {!isInter ? `(CGST ${fmt(totalCgst)} + SGST ${fmt(totalSgst)})` : `(IGST ${fmt(totalIgst)})`}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>Total Cash Outflow:</div>
                    <div style={{ fontSize: 20, fontWeight: 900, color: '#15803d' }}>{fmt(grandTotal)}</div>
                  </div>
                </div>

                <label style={S.label}>Remarks / Payment Reference Notes
                  <input
                    style={S.input}
                    placeholder="e.g. Paid from Petty Cash Voucher #PC-442 for PM-2 emergency bearing replacement"
                    value={cashForm.remarks}
                    onChange={e => setCashForm({ ...cashForm, remarks: e.target.value })}
                  />
                </label>

                <div style={S.modalFooter}>
                  <button type="button" style={S.btnSecondary} onClick={() => setCashModal(false)}>Cancel</button>
                  <button type="submit" style={{ ...S.btnPrimary, background: '#16a34a' }} disabled={cashSaving}>
                    {cashSaving ? 'Processing Cash Purchase…' : '✓ Record Cash Purchase & Update Stock'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )
      })()}
    </div>
  )
}

const S={page:{padding:24,background:'#f6f5f0',minHeight:'100vh',color:'#1b1b1d'},header:{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:20},title:{fontSize:22,fontWeight:700,color:'#1b1b1d'},sub:{fontSize:13,color:'#8a8a90',marginTop:2},filterBar:{display:'flex',gap:10,marginBottom:16,flexWrap:'wrap',alignItems:'center'},tableWrap:{background:'#ffffff',borderRadius:10,overflow:'auto',border:'1px solid #e7e6df'},table:{width:'100%',borderCollapse:'collapse',fontSize:13},thead:{background:'#f6f5f0'},th:{padding:'10px 14px',textAlign:'left',color:'#8a8a90',fontWeight:600,fontSize:12,textTransform:'uppercase',borderBottom:'1px solid #e7e6df',whiteSpace:'nowrap'},tr:{borderBottom:'1px solid #f1efe8'},td:{padding:'10px 14px',verticalAlign:'middle'},muted:{color:'#a0a0a6',fontSize:12},num:{color:'#1b1b1d',fontVariantNumeric:'tabular-nums'},code:{fontFamily:'monospace',background:'#f6f5f0',padding:'2px 6px',borderRadius:4,fontSize:11,color:'#a0a0a6'},badge:{fontSize:11,fontWeight:600,padding:'2px 8px',borderRadius:20,display:'inline-block'},btnIcon:{background:'none',border:'none',cursor:'pointer',fontSize:14,padding:'2px 4px'},empty:{padding:40,textAlign:'center',color:'#8a8a90'},loading:{padding:40,textAlign:'center',color:'#8a8a90'},pagination:{display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:12},count:{fontSize:12,color:'#8a8a90'},pgBtn:{background:'#ffffff',border:'1px solid #e7e6df',color:'#1b1b1d',borderRadius:6,padding:'5px 12px',cursor:'pointer',fontSize:12},pgInfo:{fontSize:12,color:'#a0a0a6',padding:'5px 8px'},overlay:{position:'fixed',inset:0,background:'rgba(0,0,0,0.7)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000},modal:{background:'#ffffff',borderRadius:12,padding:24,width:'100%',border:'1px solid #e7e6df',maxHeight:'90vh',overflowY:'auto'},modalHeader:{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16},modalTitle:{fontSize:16,fontWeight:700,color:'#1b1b1d'},close:{background:'none',border:'none',color:'#a0a0a6',fontSize:18,cursor:'pointer'},form:{display:'flex',flexDirection:'column',gap:14},grid2:{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14},label:{display:'flex',flexDirection:'column',gap:5,fontSize:12,color:'#a0a0a6',fontWeight:600},input:{background:'#f6f5f0',border:'1px solid #e7e6df',borderRadius:6,padding:'8px 10px',color:'#1b1b1d',fontSize:13,outline:'none'},select:{background:'#f6f5f0',border:'1px solid #e7e6df',borderRadius:6,padding:'8px 10px',color:'#1b1b1d',fontSize:13},error:{background:'#ef444422',border:'1px solid #ef444444',color:'#f87171',padding:'8px 12px',borderRadius:6,fontSize:13},modalFooter:{display:'flex',gap:10,justifyContent:'flex-end',marginTop:8},btnPrimary:{background:'#1b1b1d',color:'#fff',border:'none',borderRadius:8,padding:'8px 18px',fontWeight:600,fontSize:13,cursor:'pointer'},btnSecondary:{background:'#e7e6df',color:'#1b1b1d',border:'none',borderRadius:8,padding:'8px 18px',fontWeight:600,fontSize:13,cursor:'pointer'}}

// Sub-styles for the redesigned Create PO modal
const SS = {
  sectionLabel: { fontWeight: 700, color: '#a0a0a6', fontSize: 11, letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 10, paddingBottom: 6, borderBottom: '1px solid #f1efe8' },
  fieldErr: { color: '#ef4444', fontSize: 11, marginTop: 4, fontWeight: 600 },
  warn: { color: '#d97706', fontSize: 10, marginTop: 3, fontWeight: 600 },
  hint: { color: '#6366f1', fontSize: 10, marginTop: 3 },
  summaryBox: { background: '#f6f5f0', border: '1px solid #e7e6df', borderRadius: 8, padding: '14px 18px' },
  summaryRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 48, minWidth: 280 },
  summaryVal: { fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: '#1b1b1d', fontSize: 13 },
}
