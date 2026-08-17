import React, { useState, useEffect, useCallback, useRef } from 'react'
import AgentStatusBanner from '../components/AgentStatusBanner'
const API=(p,o)=>fetch(p,{headers:{Authorization:`Bearer ${localStorage.getItem('mk_token')}`,'Content-Type':'application/json',...(o?.headers||{})},...o}).then(r=>r.json())
const STATUS_COLOR={Draft:'#8a8a90',Approved:'#22c55e',Sent:'#6366f1',Partial:'#f97316',Received:'#0ea5e9',Closed:'#64748b',Cancelled:'#ef4444'}
const fmt=v=>v?`₹${Number(v).toLocaleString('en-IN',{minimumFractionDigits:2})}`:'—'

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
          <span style={{ fontSize: 18 }}>🖨</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>Purchase Order Document Preview</div>
            <div style={{ fontSize: 11, color: '#94a3b8' }}>A4 Official Mill Format · Ready for direct printing &amp; PDF export</div>
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

  useEffect(() => {
    if (tab === 'orders') load()
    if (tab === 'grn') loadGRNs()
    if (tab === 'bills') loadBills()
    if (tab === 'pipeline') loadPipeline()
  }, [tab, load, loadGRNs, loadBills, loadPipeline])

  const [poMatSearch, setPoMatSearch] = useState({})
  const [poMatDropOpen, setPoMatDropOpen] = useState({})

  const [approvedIndents, setApprovedIndents] = useState([])

  const loadApprovedIndents = useCallback(async () => {
    const r = await API('/api/indent?status=Approved&limit=100')
    if (r.success) setApprovedIndents(r.data)
  }, [])

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
  const blankItem = () => ({ material_id: '', description: '', qty: '', uom: '', unit_price: '', gst_pct: 18, _search: '' })

  const openNew = (preselectedIndent = null) => {
    const items = preselectedIndent?.items?.length
      ? preselectedIndent.items.map(it => ({
          material_id: it.material_id,
          description: it.materialName || it.material_name || '',
          qty: String(it.required_qty || 1),
          uom: it.matUom || it.uom || '',
          unit_price: String(it.matPrice || it.unit_price || 0),
          gst_pct: 18,
          _search: it.materialName || ''
        }))
      : [blankItem()]

    setForm({
      vendor_id: '',
      indent_id: preselectedIndent?.id || '',
      po_date: today(),
      delivery_date: preselectedIndent?.required_date?.slice(0, 10) || '',
      delivery_address: '',
      payment_terms: '',
      payment_terms_custom: '',
      remarks: preselectedIndent
        ? `PO raised against PR ${preselectedIndent.indentNumber || preselectedIndent.indent_number} (${preselectedIndent.deptName || 'Dept'})`
        : '',
      items
    })
    setFormErrors({})
    loadApprovedIndents()
    setModal(true)
  }

  const handleSelectIndent = async (indentId) => {
    if (!indentId) {
      setForm(f => ({ ...f, indent_id: '' }))
      return
    }
    const r = await API(`/api/indent/${indentId}`)
    if (r.success) {
      const ind = r.data
      setForm(f => ({
        ...f,
        indent_id: ind.id,
        delivery_date: f.delivery_date || (ind.required_date ? ind.required_date.slice(0, 10) : ''),
        remarks: f.remarks ? f.remarks : `PO raised against PR ${ind.indent_number} (${ind.deptName || ''})`,
        items: (ind.items || []).length ? ind.items.map(it => ({
          material_id: it.material_id,
          description: it.materialName || '',
          qty: String(it.required_qty || 1),
          uom: it.matUom || it.uom || '',
          unit_price: String(it.matPrice || it.unit_price || 0),
          gst_pct: 18,
          _search: it.materialName || ''
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
        gst_pct: Number(it.gst_pct ?? 18),
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
      description: it.description || matName(it.material_id)
    }))
    const r = await API(`/api/purchase/po/${editModal.id}`, { method: 'PUT', body: JSON.stringify({ ...editForm, items }) })
    setEditSaving(false)
    if (r.success) {
      setEditModal(null)
      load()
    } else {
      setEditErr(r.message || 'Edit failed')
    }
  }

  // GRN
  const openGRN=async(poRow)=>{
    const r=await API(`/api/purchase/po/${poRow.id}`)
    if(!r.success) return
    const po=r.data
    setGrnModal(po)
    setGrnErr('')
    setGrnForm({
      challan_number:'',vehicle_number:'',invoice_number:'',remarks:'',
      items:(po.items||[]).map(it=>{
        const remaining = Math.max(0, parseFloat(it.qty || 0) - parseFloat(it.received_qty || 0))
        return {
          material_id:it.material_id, material_name:it.materialName, uom:it.uom,
          po_qty:it.qty, received_qty:remaining, accepted_qty:remaining, rejected_qty:0,
          unit_price:it.unit_price, gst_pct:it.gst_pct, batch_number:'',
        }
      })
    })
  }

  const saveGRN=async e=>{
    e.preventDefault()
    if(!grnModal) return
    for (const [idx, it] of grnForm.items.entries()) {
      const rq = parseFloat(it.received_qty)||0, aq = parseFloat(it.accepted_qty)||0
      if (rq <= 0) { setGrnErr(`Item ${idx+1} (${it.material_name}): received qty must be greater than 0`); return }
      if (aq > rq) { setGrnErr(`Item ${idx+1} (${it.material_name}): accepted qty (${aq}) cannot exceed received qty (${rq})`); return }
      if (aq < 0) { setGrnErr(`Item ${idx+1} (${it.material_name}): accepted qty cannot be negative`); return }
    }
    setGrnSaving(true);setGrnErr('')
    const payload={
      date:today(), vendorId:grnModal.vendor_id, poId:grnModal.id,
      challanNumber:grnForm.challan_number, vehicleNumber:grnForm.vehicle_number,
      invoiceNumber:grnForm.invoice_number, remarks:grnForm.remarks,
      items:grnForm.items.map(it=>({
        materialId:it.material_id, poQty:parseFloat(it.po_qty)||0, receivedQty:parseFloat(it.received_qty)||0,
        acceptedQty:parseFloat(it.accepted_qty)||0, rejectedQty:parseFloat(it.rejected_qty)||0,
        unitPrice:parseFloat(it.unit_price)||0,
        uom:it.uom, batchNumber:it.batch_number||'',
      }))
    }
    const r=await API('/api/inventory/grn',{method:'POST',body:JSON.stringify(payload)})
    setGrnSaving(false)
    if(r.success){
      // Show GRN receipt
      const receiptContent = (
        <div>
          <div style={{display:'flex',justifyContent:'space-between',marginBottom:16}}>
            <div><h2 style={{margin:0}}>Goods Receipt Note</h2><div style={{color:'#555',fontSize:13}}>MK Paper Mill ERP</div></div>
            <div style={{textAlign:'right',fontSize:13}}><div>PO: {grnModal.po_number}</div><div>Date: {new Date().toLocaleDateString('en-IN')}</div><div>Vendor: {grnModal.vendorName}</div></div>
          </div>
          <table>
            <thead><tr><th>Material</th><th>UOM</th><th>PO Qty</th><th>Received</th><th>Accepted</th><th>Rejected</th><th>Unit Price</th><th>Batch/Lot</th></tr></thead>
            <tbody>
              {grnForm.items.map((it,i)=>(
                <tr key={i}><td>{it.material_name}</td><td>{it.uom}</td><td>{it.po_qty}</td><td>{it.received_qty}</td><td>{it.accepted_qty}</td><td>{it.rejected_qty}</td><td>{fmt(it.unit_price)}</td><td>{it.batch_number||'—'}</td></tr>
              ))}
            </tbody>
          </table>
          {grnForm.challan_number&&<div style={{marginTop:12,fontSize:13}}>Challan: {grnForm.challan_number} | Vehicle: {grnForm.vehicle_number||'—'} | Invoice: {grnForm.invoice_number||'—'}</div>}
          <div style={{marginTop:24,display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:32}}>
            <div style={{borderTop:'1px solid #000',paddingTop:8,textAlign:'center',fontSize:12}}>Received By</div>
            <div style={{borderTop:'1px solid #000',paddingTop:8,textAlign:'center',fontSize:12}}>Store Incharge</div>
            <div style={{borderTop:'1px solid #000',paddingTop:8,textAlign:'center',fontSize:12}}>Vendor Signature</div>
          </div>
        </div>
      )
      setGrnModal(null)
      load()
      setPrintContent(receiptContent)
    }else setGrnErr(r.message||'GRN failed')
  }

  const printGRNDocument = async (grnRow) => {
    const r = await API(`/api/purchase/grn/${grnRow.id}`)
    if (!r.success) return alert(r.message || 'Failed to load GRN details')
    const g = r.data

    const vendorState = (g.vendorState || '').toLowerCase()
    const vendorGstin = g.vendorGstin || ''
    const isInterState = (vendorState && vendorState !== 'karnataka') || (vendorGstin && !vendorGstin.startsWith('29'))

    let totalTaxable = 0
    let totalCgst = 0
    let totalSgst = 0
    let totalIgst = 0

    const itemsCalculated = (g.items || []).map(it => {
      const uPrice = Number(it.unit_price || 0)
      const accQty = Number(it.accepted_qty || 0)
      const lineTaxable = accQty * uPrice
      const gstPct = Number(it.gst_pct ?? 18)

      const cgstPct = isInterState ? 0 : gstPct / 2
      const sgstPct = isInterState ? 0 : gstPct / 2
      const igstPct = isInterState ? gstPct : 0

      const cgstAmt = (lineTaxable * cgstPct) / 100
      const sgstAmt = (lineTaxable * sgstPct) / 100
      const igstAmt = (lineTaxable * igstPct) / 100
      const lineTotal = lineTaxable + cgstAmt + sgstAmt + igstAmt

      totalTaxable += lineTaxable
      totalCgst += cgstAmt
      totalSgst += sgstAmt
      totalIgst += igstAmt

      return {
        ...it,
        uPrice,
        accQty,
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
              GSTIN: <code>29AABCS1234F1Z8</code> | State: Karnataka (Code: 29) | CIN: <code>U21012KA2015PTC081234</code>
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

        {/* Line Items Table with CGST, SGST, IGST Breakdown */}
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 16, fontSize: 11 }}>
          <thead>
            <tr style={{ background: '#f1f5f9', borderTop: '1px solid #0f766e', borderBottom: '2px solid #0f766e', textAlign: 'left', color: '#0f766e', fontWeight: 800 }}>
              <th style={{ padding: '8px 6px', width: 26, textAlign: 'center' }}>#</th>
              <th style={{ padding: '8px 6px' }}>Material Description &amp; Specifications</th>
              <th style={{ padding: '8px 6px', width: 65 }}>HSN/SAC</th>
              <th style={{ padding: '8px 6px', width: 45 }}>UOM</th>
              <th style={{ padding: '8px 6px', textAlign: 'right', width: 60 }}>Accepted</th>
              <th style={{ padding: '8px 6px', textAlign: 'right', width: 75 }}>Unit Rate</th>
              <th style={{ padding: '8px 6px', textAlign: 'right', width: 85 }}>Taxable Val</th>
              {!isInterState ? (
                <>
                  <th style={{ padding: '8px 6px', textAlign: 'right', width: 70 }}>CGST</th>
                  <th style={{ padding: '8px 6px', textAlign: 'right', width: 70 }}>SGST</th>
                </>
              ) : (
                <th style={{ padding: '8px 6px', textAlign: 'right', width: 85 }}>IGST</th>
              )}
              <th style={{ padding: '8px 6px', textAlign: 'right', width: 95 }}>Total Val (₹)</th>
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
                <td style={{ padding: '8px 6px', textAlign: 'right', fontWeight: 700 }}>₹{it.lineTaxable.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                {!isInterState ? (
                  <>
                    <td style={{ padding: '8px 6px', textAlign: 'right', color: '#475569' }}>₹{it.cgstAmt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td style={{ padding: '8px 6px', textAlign: 'right', color: '#475569' }}>₹{it.sgstAmt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
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
              <span style={{ color: '#64748b' }}>Taxable Subtotal:</span>
              <strong>₹{totalTaxable.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
            </div>
            {!isInterState ? (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>CGST Total:</span>
                  <span>₹{totalCgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>SGST Total:</span>
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

  // Print PO with Corporate Letterhead, Tax Breakdowns, and Signatures
  const printPO = async (poRow) => {
    let po = poRow
    if (!po.items || !po.items.length) {
      const r = await API(`/api/purchase/po/${poRow.id}`)
      if (r.success) po = r.data
    }
    const isInter = po.vendorGstin && !po.vendorGstin.startsWith('29')
    const sub = parseFloat(po.total_value || po.totalValue || 0)
    const tax = parseFloat(po.gst_value || po.gstValue || 0)
    const grand = parseFloat(po.grand_total || po.grandTotal || 0)
    const cgst = isInter ? 0 : tax / 2
    const sgst = isInter ? 0 : tax / 2
    const igst = isInter ? tax : 0

    const content = (
      <div>
        {/* Header with MK Paper Mill Official Identity */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #0f766e', paddingBottom: 14, marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 900, color: '#0f766e', letterSpacing: 0.5 }}>
              MK PAPER MILL PRIVATE LIMITED
            </div>
            <div style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>
              Manufacturers of Kraft Paper &amp; Duplex Boards · ISO 9001:2015 Certified
            </div>
            <div style={{ fontSize: 11, color: '#475569' }}>
              Factory: Sy. No. 42/1, Mill Road, Industrial Area, Karnataka - 560001
            </div>
            <div style={{ fontSize: 11, color: '#0f172a', fontWeight: 600, marginTop: 2 }}>
              GSTIN: <code>29AABCM1234F1Z5</code> · PAN: <code>AABCM1234F</code> · CIN: <code>U21012KA2015PTC081234</code>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ display: 'inline-block', background: '#0f766e', color: '#fff', padding: '4px 14px', borderRadius: 4, fontWeight: 800, fontSize: 14, textTransform: 'uppercase' }}>
              PURCHASE ORDER
            </div>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#0f172a', marginTop: 6 }}>
              PO #: {po.po_number || po.poNumber}
            </div>
            <div style={{ fontSize: 11, color: '#64748b' }}>
              Date: <strong>{po.date ? new Date(po.date).toLocaleDateString('en-IN') : new Date().toLocaleDateString('en-IN')}</strong>
            </div>
            <div style={{ fontSize: 11, color: '#64748b' }}>
              Status: <strong style={{ color: '#0f766e' }}>{po.status}</strong>
            </div>
          </div>
        </div>

        {/* 2-Column Vendor & Order Specifications */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
          {/* Vendor Details */}
          <div style={{ border: '1px solid #cbd5e1', borderRadius: 6, padding: '10px 14px', background: '#f8fafc' }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#0f766e', textTransform: 'uppercase', marginBottom: 4 }}>
              SUPPLIER / VENDOR DETAILS
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{po.vendorName}</div>
            {po.vendorCode && <div style={{ fontSize: 11, color: '#64748b' }}>Vendor Code: <code>{po.vendorCode}</code></div>}
            <div style={{ fontSize: 11, color: '#334155', marginTop: 2 }}>
              GSTIN: <strong>{po.vendorGstin || 'Unregistered / Exempt'}</strong> {isInter ? ' (Interstate)' : ' (Intrastate - Karnataka)'}
            </div>
            {po.vendorAddress && <div style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>{po.vendorAddress}</div>}
          </div>

          {/* PO Logistics & Commercials */}
          <div style={{ border: '1px solid #cbd5e1', borderRadius: 6, padding: '10px 14px', background: '#f8fafc' }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#0f766e', textTransform: 'uppercase', marginBottom: 4 }}>
              DELIVERY &amp; COMMERCIAL TERMS
            </div>
            <div style={{ fontSize: 11, color: '#334155', marginBottom: 2 }}>
              Delivery Date: <strong>{po.delivery_date ? new Date(po.delivery_date).toLocaleDateString('en-IN') : (po.deliveryDate?.slice(0, 10) || 'Immediate / As per schedule')}</strong>
            </div>
            <div style={{ fontSize: 11, color: '#334155', marginBottom: 2 }}>
              Payment Terms: <strong>{po.payment_terms || po.paymentTerms || 'Net 30 Days'}</strong>
            </div>
            <div style={{ fontSize: 11, color: '#334155', marginBottom: 2 }}>
              PR / Indent Ref: <strong>{po.indentNumber || po.indent_number || 'Direct Mill Requisition'}</strong>
            </div>
            <div style={{ fontSize: 11, color: '#334155' }}>
              Delivery Location: <strong>MK Paper Mill Central Store / Weighbridge</strong>
            </div>
          </div>
        </div>

        {/* Line Items Table */}
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 16, fontSize: 11 }}>
          <thead>
            <tr style={{ background: '#f1f5f9', borderTop: '1px solid #0f766e', borderBottom: '2px solid #0f766e', textAlign: 'left', color: '#0f766e', fontWeight: 800 }}>
              <th style={{ padding: '8px 6px', width: 26, textAlign: 'center' }}>#</th>
              <th style={{ padding: '8px 6px' }}>Item Description &amp; Specification</th>
              <th style={{ padding: '8px 6px', textAlign: 'center', width: 70 }}>HSN/SAC</th>
              <th style={{ padding: '8px 6px', textAlign: 'right', width: 60 }}>Qty</th>
              <th style={{ padding: '8px 6px', width: 45 }}>UOM</th>
              <th style={{ padding: '8px 6px', textAlign: 'right', width: 80 }}>Unit Rate</th>
              <th style={{ padding: '8px 6px', textAlign: 'center', width: 45 }}>GST%</th>
              <th style={{ padding: '8px 6px', textAlign: 'right', width: 95 }}>Line Total (₹)</th>
            </tr>
          </thead>
          <tbody>
            {(po.items || []).map((it, i) => (
              <tr key={i} style={{ borderBottom: '1px solid #e2e8f0' }}>
                <td style={{ padding: '8px 6px', textAlign: 'center', color: '#64748b' }}>{i + 1}</td>
                <td style={{ padding: '8px 6px' }}>
                  <div style={{ fontWeight: 700, color: '#0f172a' }}>{it.materialName || it.description}</div>
                  <div style={{ fontSize: 10, color: '#64748b' }}>Code: <code>{it.materialCode || it.material_id}</code></div>
                </td>
                <td style={{ padding: '8px 6px', textAlign: 'center', color: '#64748b' }}>{it.hsnCode || '8439'}</td>
                <td style={{ padding: '8px 6px', textAlign: 'right', fontWeight: 700 }}>{parseFloat(it.qty || 0).toFixed(2)}</td>
                <td style={{ padding: '8px 6px', color: '#475569' }}>{it.uom || 'NOS'}</td>
                <td style={{ padding: '8px 6px', textAlign: 'right' }}>₹{parseFloat(it.unit_price || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                <td style={{ padding: '8px 6px', textAlign: 'center' }}>{it.gst_pct || 18}%</td>
                <td style={{ padding: '8px 6px', textAlign: 'right', fontWeight: 700 }}>₹{parseFloat(it.total || (parseFloat(it.qty || 0) * parseFloat(it.unit_price || 0) * (1 + (parseFloat(it.gst_pct || 18)/100)))).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Valuation & Tax Calculation Breakdown */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 16, marginBottom: 20 }}>
          <div style={{ border: '1px solid #e2e8f0', borderRadius: 6, padding: '10px 14px', background: '#f8fafc' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#0f766e', marginBottom: 4 }}>Amount in Words:</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#0f172a', fontStyle: 'italic' }}>
              {numberToWords(grand)}
            </div>
            {po.remarks && (
              <div style={{ marginTop: 8, paddingTop: 6, borderTop: '1px solid #e2e8f0', fontSize: 11, color: '#475569' }}>
                <strong>Remarks / Special Notes:</strong> {po.remarks}
              </div>
            )}
          </div>

          <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse' }}>
            <tbody>
              <tr>
                <td style={{ padding: '4px 6px', color: '#64748b' }}>Taxable Value:</td>
                <td style={{ padding: '4px 6px', textAlign: 'right', fontWeight: 600 }}>₹{sub.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
              </tr>
              {isInter ? (
                <tr>
                  <td style={{ padding: '4px 6px', color: '#6366f1' }}>IGST (Integrated Tax):</td>
                  <td style={{ padding: '4px 6px', textAlign: 'right', fontWeight: 600, color: '#6366f1' }}>₹{igst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                </tr>
              ) : (
                <>
                  <tr>
                    <td style={{ padding: '4px 6px', color: '#059669' }}>CGST (Central Tax):</td>
                    <td style={{ padding: '4px 6px', textAlign: 'right', fontWeight: 600, color: '#059669' }}>₹{cgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '4px 6px', color: '#059669' }}>SGST (State Tax):</td>
                    <td style={{ padding: '4px 6px', textAlign: 'right', fontWeight: 600, color: '#059669' }}>₹{sgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                  </tr>
                </>
              )}
              <tr style={{ borderTop: '1px solid #cbd5e1', borderBottom: '2px solid #0f766e', background: '#f0fdf4' }}>
                <td style={{ padding: '6px 6px', fontWeight: 800, fontSize: 13, color: '#0f766e' }}>Grand Total (INR):</td>
                <td style={{ padding: '6px 6px', textAlign: 'right', fontWeight: 900, fontSize: 14, color: '#0f766e' }}>₹{grand.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Terms & Conditions */}
        <div style={{ border: '1px solid #e2e8f0', borderRadius: 6, padding: '8px 12px', fontSize: 10, color: '#64748b', marginBottom: 24, lineHeight: 1.4 }}>
          <strong>TERMS &amp; CONDITIONS:</strong><br />
          1. Material must strictly conform to technical specifications and is subject to plant QC approval at the time of delivery.<br />
          2. Delivery Challan and Tax Invoice must prominently mention this PO Number.<br />
          3. Rejections, if any, will be lifted back by the supplier at their own cost within 7 days of intimation.<br />
          4. Payment will be released strictly as per agreed credit terms following commercial 3-way matching.
        </div>

        {/* 4 Signatory Blocks */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, textAlign: 'center', fontSize: 11, color: '#334155' }}>
          <div>
            <div style={{ height: 36 }}></div>
            <div style={{ borderTop: '1px solid #94a3b8', paddingTop: 4, fontWeight: 700 }}>Prepared By</div>
            <div style={{ fontSize: 10, color: '#64748b' }}>Store / Purchase Desk</div>
          </div>
          <div>
            <div style={{ height: 36 }}></div>
            <div style={{ borderTop: '1px solid #94a3b8', paddingTop: 4, fontWeight: 700 }}>Verified By</div>
            <div style={{ fontSize: 10, color: '#64748b' }}>Finance / Accounts</div>
          </div>
          <div>
            <div style={{ height: 36 }}></div>
            <div style={{ borderTop: '1px solid #94a3b8', paddingTop: 4, fontWeight: 700 }}>Authorized Signatory</div>
            <div style={{ fontSize: 10, color: '#64748b' }}>Plant Head / Director</div>
          </div>
          <div>
            <div style={{ height: 36 }}></div>
            <div style={{ borderTop: '1px solid #94a3b8', paddingTop: 4, fontWeight: 700 }}>Vendor Acceptance</div>
            <div style={{ fontSize: 10, color: '#64748b' }}>Signature &amp; Stamp</div>
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
      <div style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: '1px solid #e7e6df', overflowX: 'auto' }}>
        {[
          ['orders', '📋 Purchase Orders (PO)'],
          ['grn', '📥 Goods Receipt Notes (GRN)'],
          ['bills', '🧾 Purchase Invoices & Bills (Purchase Entry)'],
          ['pipeline', '📊 P2P Full Lifecycle Pipeline']
        ].map(([k, l]) => (
          <button
            key={k}
            style={{
              background: 'none', border: 'none', color: tab === k ? '#1b1b1d' : '#8a8a90',
              padding: '8px 16px', cursor: 'pointer', fontSize: 13, fontWeight: tab === k ? 700 : 500,
              borderBottom: tab === k ? '2px solid #1b1b1d' : '2px solid transparent',
              marginBottom: -1, whiteSpace: 'nowrap'
            }}
            onClick={() => setTab(k)}
          >
            {l}
          </button>
        ))}
      </div>

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
          <div style={S.tableWrap}>
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
                        {r.status==='Draft'&&<button style={{ ...S.btnIcon, color: '#16a34a' }} onClick={()=>approve(r.id)} title="Approve">✅</button>}
                        {r.status==='Draft'&&<button style={{ ...S.btnIcon, color: '#d97706' }} onClick={async()=>{const d=await API(`/api/purchase/po/${r.id}`);if(d.success)openEdit(d.data)}} title="Edit">✏️</button>}
                        {r.status==='Draft'&&<button style={{ ...S.btnIcon, color: '#dc2626' }} onClick={()=>deletePO(r.id, r.poNumber)} title="Delete Draft PO">🗑</button>}
                        {(r.status==='Approved')&&<button style={{ ...S.btnIcon, color: '#64748b' }} onClick={()=>cancelPO(r.id)} title="Cancel PO">🚫</button>}
                        {(r.status==='Approved'||r.status==='Partial')&&<button style={{ ...S.btnIcon, color: '#0d9488' }} onClick={()=>openGRN(r)} title="Receive GRN">📦</button>}
                        {(r.status==='Received'||r.status==='Partial'||r.status==='Approved')&&<button style={{...S.btnIcon, color: '#0369a1'}} onClick={()=>openBill(r)} title="Book Vendor Bill for Finance">🧾</button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody></table>
            )}
          </div>
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
          <div style={S.tableWrap}>
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
                            🖨️ GRN Note
                          </button>
                          <button
                            style={{ ...S.btnIcon, color: '#0369a1', fontWeight: 600, fontSize: 12 }}
                            onClick={() => openBill({ id: g.poId, poNumber: g.poNumber, vendorName: g.vendorName, grandTotal: g.totalValue })}
                            title="Book Purchase Bill for Finance"
                          >
                            🧾 Bill
                          </button>
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
          </div>
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
          <div style={S.tableWrap}>
            {billLoading ? <div style={S.loading}>Loading Purchase Invoices...</div> : (
              <table style={S.table}>
                <thead>
                  <tr style={S.thead}>
                    {['Bill Number', 'Vendor & Invoice No', 'PO & GRN Ref', 'Invoice Date', 'Taxable Amount', 'Total Amount', 'Paid Amount', 'Balance Due', 'Status'].map(h => (
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
                    </tr>
                  ))}
                  {billList.length === 0 && (
                    <tr>
                      <td colSpan={9} style={S.empty}>No purchase invoices booked yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
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
        const isInterstate = Boolean(vObj?.gstin && !vObj.gstin.startsWith('29'))
        const calcLine = it => {
          const q = parseFloat(it.qty) || 0, p2 = parseFloat(it.unit_price) || 0, g = parseFloat(it.gst_pct) || 0
          const base = q * p2
          const tax = (base * g) / 100
          const cgst = isInterstate ? 0 : tax / 2
          const sgst = isInterstate ? 0 : tax / 2
          const igst = isInterstate ? tax : 0
          return { base, tax, cgst, sgst, igst, total: base + tax }
        }
        const subtotal = form.items.reduce((a, it) => a + calcLine(it).base, 0)
        const totalCgst = form.items.reduce((a, it) => a + calcLine(it).cgst, 0)
        const totalSgst = form.items.reduce((a, it) => a + calcLine(it).sgst, 0)
        const totalIgst = form.items.reduce((a, it) => a + calcLine(it).igst, 0)
        const totalTax = form.items.reduce((a, it) => a + calcLine(it).tax, 0)
        const grandTotal = subtotal + totalTax
        const fmtAmt = v => v > 0 ? `₹${v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'
        const PAYMENT_PRESETS = ['Net 15', 'Net 30', 'Net 45', 'Advance', 'COD', 'Custom']
        const dupIds = form.items.map(it => it.material_id).filter((id, i, arr) => id && arr.indexOf(id) !== i)
        const isDirty = form.vendor_id || form.items.some(it => it.material_id)
        const handleClose = () => { if (isDirty && !window.confirm('Discard changes to this PO?')) return; setModal(false) }
        return (
          <div style={S.overlay} onClick={handleClose}>
            <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e7e6df', width: '96vw', maxWidth: 1180, height: '92vh', maxHeight: '92vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }} onClick={e => e.stopPropagation()}>

              {/* ── Sticky Header ── */}
              <div style={{ padding: '16px 24px 14px', borderBottom: '1px solid #f1efe8', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexShrink: 0, background: '#fff' }}>
                <div>
                  <div style={{ fontSize: 17, fontWeight: 700, color: '#1b1b1d' }}>Create Purchase Order</div>
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

                  {/* ── Vendor & Delivery (3-col) ── */}
                  <div style={{ marginBottom: 20 }}>
                    <div style={SS.sectionLabel}>VENDOR &amp; DELIVERY</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>

                      <div>
                        <label style={S.label}>Vendor *
                          <select style={{ ...S.select, borderColor: formErrors.vendor_id ? '#ef4444' : undefined }}
                            value={form.vendor_id}
                            onChange={e => {
                              const id = e.target.value
                              const v = vendors.find(x => x.id == id)
                              const vpt = v?.payment_terms
                              const presetMatch = vpt && PAYMENT_PRESETS.includes(vpt)
                              setForm(f => ({
                                ...f,
                                vendor_id: id,
                                payment_terms: vpt ? (presetMatch ? vpt : 'Custom') : f.payment_terms,
                                payment_terms_custom: vpt && !presetMatch ? vpt : f.payment_terms_custom
                              }))
                              setFormErrors(fe => ({ ...fe, vendor_id: undefined }))
                            }}>
                            <option value="">Select vendor...</option>
                            {vendors.map(v => (
                              <option key={v.id} value={v.id}>
                                {v.name} ({v.poCount || v.po_count || 0} POs) {v.gstin ? `[GST: ${v.gstin}]` : ''}
                              </option>
                            ))}
                          </select>
                        </label>
                        {vObj?.gstin && <div style={SS.hint}>GST: {vObj.gstin} {isInterstate ? '(Inter-State IGST)' : '(Intra-State CGST+SGST)'}</div>}
                        {formErrors.vendor_id && <div style={SS.fieldErr}>{formErrors.vendor_id}</div>}
                      </div>

                      <div>
                        <label style={S.label}>Link Purchase Request (Indent / PR)
                          <select
                            style={{
                              ...S.select,
                              background: form.indent_id ? '#f0fdf4' : '#f6f5f0',
                              borderColor: form.indent_id ? '#86efac' : undefined
                            }}
                            value={form.indent_id || ''}
                            onChange={e => handleSelectIndent(e.target.value)}
                          >
                            <option value="">-- Direct PO (No PR Linked) --</option>
                            {approvedIndents.map(ind => (
                              <option key={ind.id} value={ind.id}>
                                {ind.indentNumber || ind.indent_number} — {ind.deptName || 'Dept'} ({ind.itemCount || 0} items)
                              </option>
                            ))}
                          </select>
                        </label>
                        {form.indent_id ? (
                          <div style={{ fontSize: 11, color: '#16a34a', marginTop: 3, fontWeight: 600 }}>
                            ✓ Items auto-populated from approved PR
                          </div>
                        ) : (
                          <div style={SS.hint}>Optional: Link approved PR to auto-fill line items</div>
                        )}
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
                        <label style={S.label}>Payment Terms
                          <select style={S.select} value={form.payment_terms}
                            onChange={e => setForm(f => ({ ...f, payment_terms: e.target.value, payment_terms_custom: '' }))}>
                            <option value="">Select terms...</option>
                            {PAYMENT_PRESETS.map(p => <option key={p}>{p}</option>)}
                          </select>
                        </label>
                        {form.payment_terms === 'Custom' && (
                          <input style={{ ...S.input, marginTop: 6, fontSize: 12 }} placeholder="Describe custom terms…"
                            value={form.payment_terms_custom}
                            onChange={e => setForm(f => ({ ...f, payment_terms_custom: e.target.value }))} />
                        )}
                      </div>

                      <div>
                        <label style={S.label}>Delivery Warehouse
                          <select style={S.select} value={form.delivery_address} onChange={e => setForm(f => ({ ...f, delivery_address: e.target.value }))}>
                            <option value="">Select warehouse...</option>
                            {warehouses.map(w => <option key={w.id} value={w.name}>{w.name}</option>)}
                          </select>
                        </label>
                      </div>

                      <div>
                        <label style={S.label}>Remarks / Work Order
                          <input style={S.input} value={form.remarks} placeholder="Optional notes for this PO…"
                            onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))} />
                        </label>
                      </div>

                    </div>
                  </div>

                  {/* ── Line Items Table ── */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                      <span style={SS.sectionLabel}>LINE ITEMS</span>
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
                          <div style={{ flex: '1 1 160px', fontSize: 11, fontWeight: 700, color: '#8a8a90', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Description</div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 20, flexShrink: 0 }} />
                          <div style={{ width: 90, fontSize: 10, fontWeight: 700, color: '#a0a0a6', textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'right' }}>Qty *</div>
                          <div style={{ width: 70, fontSize: 10, fontWeight: 700, color: '#a0a0a6', textTransform: 'uppercase', letterSpacing: '0.04em' }}>UOM</div>
                          <div style={{ width: 100, fontSize: 10, fontWeight: 700, color: '#a0a0a6', textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'right' }}>Unit Price ₹</div>
                          <div style={{ width: 140, fontSize: 10, fontWeight: 700, color: '#a0a0a6', textTransform: 'uppercase', letterSpacing: '0.04em' }}>GST Slab %</div>
                          <div style={{ flex: 1, fontSize: 10, fontWeight: 700, color: '#a0a0a6', textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'right' }}>Line Total</div>
                          <div style={{ width: 32, flexShrink: 0 }} />
                        </div>
                      </div>

                      {/* Rows */}
                      {form.items.map((it, i) => {
                        const lt = calcLine(it)
                        const isDup = dupIds.includes(it.material_id)
                        const selMat = mats.find(m => m.id == it.material_id)
                        const searchVal = poMatSearch[i] !== undefined ? poMatSearch[i] : (selMat ? `${selMat.name} [${selMat.code}]` : '')
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
                                                    uom: m.uom || '',
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
                                  value={it.description || ''} placeholder="Item details…"
                                  onChange={e => setItem(i, 'description', e.target.value)} />
                              </div>
                            </div>

                            {/* Line 2: Qty, UOM, Unit Price, GST Slab, Line Total, Remove */}
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                              <div style={{ width: 20, flexShrink: 0 }} />

                              {/* Qty */}
                              <div style={{ width: 90, flexShrink: 0 }}>
                                <input style={{ ...S.input, fontSize: 12, padding: '6px 8px', textAlign: 'right', width: '100%', ...(itErr.qty ? { border: '1px solid #ef4444', background: '#ef444411' } : {}) }}
                                  type="number" step="0.001" min="0.001"
                                  value={it.qty} placeholder="0"
                                  onChange={e => { setItem(i, 'qty', e.target.value); if (formErrors.itemFields) setFormErrors(fe => ({ ...fe, itemFields: fe.itemFields.map((x,j)=>j===i?{...x,qty:undefined}:x) })) }} />
                                {itErr.qty && <div style={{ fontSize: 9, color: '#ef4444', fontWeight: 600, marginTop: 2 }}>{itErr.qty}</div>}
                              </div>

                              {/* UOM */}
                              <div style={{ width: 70, flexShrink: 0 }}>
                                <input style={{ ...S.input, fontSize: 12, padding: '6px 8px', width: '100%' }}
                                  value={it.uom} placeholder="kg/pcs"
                                  onChange={e => setItem(i, 'uom', e.target.value)} />
                              </div>

                              {/* Unit Price */}
                              <div style={{ width: 100, flexShrink: 0 }}>
                                <input style={{ ...S.input, fontSize: 12, padding: '6px 8px', textAlign: 'right', width: '100%', ...(itErr.unit_price ? { border: '1px solid #ef4444', background: '#ef444411' } : {}) }}
                                  type="number" step="0.01" min="0.01"
                                  value={it.unit_price} placeholder="0.00"
                                  onChange={e => { setItem(i, 'unit_price', e.target.value); if (formErrors.itemFields) setFormErrors(fe => ({ ...fe, itemFields: fe.itemFields.map((x,j)=>j===i?{...x,unit_price:undefined}:x) })) }} />
                                {itErr.unit_price && <div style={{ fontSize: 9, color: '#ef4444', fontWeight: 600, marginTop: 2 }}>{itErr.unit_price}</div>}
                              </div>

                              {/* GST Slab Descriptive Select */}
                              <div style={{ width: 140, flexShrink: 0 }}>
                                <select
                                  style={{ ...S.select, fontSize: 11, padding: '5px 6px', width: '100%', height: 32, background: '#fff' }}
                                  value={Number(it.gst_pct ?? 18)}
                                  onChange={e => setItem(i, 'gst_pct', Number(e.target.value))}
                                >
                                  {GST_SLABS.map(s => (
                                    <option key={s.value} value={s.value}>{s.label}</option>
                                  ))}
                                </select>
                              </div>

                              {/* Line Total */}
                              <div style={{ flex: 1, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontSize: 12, fontWeight: 700, color: lt.total > 0 ? '#16a34a' : '#a0a0a6', paddingTop: 8, paddingRight: 4 }}>
                                {fmtAmt(lt.total)}
                              </div>

                              {/* Remove Button */}
                              <div style={{ width: 32, flexShrink: 0, textAlign: 'center', paddingTop: 4 }}>
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
                <div style={{ display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontSize: 10, color: '#8a8a90', fontWeight: 700, textTransform: 'uppercase' }}>Taxable Subtotal</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#1b1b1d' }}>{fmtAmt(subtotal)}</div>
                  </div>
                  <div style={{ width: 1, height: 28, background: '#e7e6df' }} />
                  {isInterstate ? (
                    <div style={{ textAlign: 'left' }}>
                      <div style={{ fontSize: 10, color: '#6366f1', fontWeight: 700, textTransform: 'uppercase' }}>IGST (Inter-State)</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#6366f1' }}>{fmtAmt(totalIgst)}</div>
                    </div>
                  ) : (
                    <>
                      <div style={{ textAlign: 'left' }}>
                        <div style={{ fontSize: 10, color: '#059669', fontWeight: 700, textTransform: 'uppercase' }}>CGST Amount</div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#059669' }}>{fmtAmt(totalCgst)}</div>
                      </div>
                      <div style={{ textAlign: 'left' }}>
                        <div style={{ fontSize: 10, color: '#059669', fontWeight: 700, textTransform: 'uppercase' }}>SGST Amount</div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#059669' }}>{fmtAmt(totalSgst)}</div>
                      </div>
                    </>
                  )}
                  <div style={{ width: 1, height: 28, background: '#e7e6df' }} />
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontSize: 10, color: '#a0a0a6', fontWeight: 700, textTransform: 'uppercase' }}>Total Tax</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#1b1b1d' }}>{fmtAmt(totalTax)}</div>
                  </div>
                  <div style={{ width: 1, height: 28, background: '#e7e6df' }} />
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontSize: 10, color: '#a0a0a6', fontWeight: 700, textTransform: 'uppercase' }}>Grand Total (₹)</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: '#0f766e' }}>{fmtAmt(grandTotal)}</div>
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
                {detail.status === 'Draft' && (
                  <button
                    style={{ ...S.btnSecondary, padding: '5px 12px', fontSize: 12, color: '#d97706' }}
                    onClick={() => { setDetail(null); openEdit(detail) }}
                  >
                    ✏️ Edit
                  </button>
                )}
                {detail.status === 'Draft' && (
                  <button
                    style={{ ...S.btnSecondary, padding: '5px 12px', fontSize: 12, color: '#dc2626' }}
                    onClick={() => deletePO(detail.id, detail.po_number || detail.poNumber)}
                  >
                    🗑 Delete
                  </button>
                )}
                {(detail.status === 'Approved') && (
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
                  {['#', 'Material & Specification', 'Qty', 'UOM', 'Unit Price', 'GST%', 'Total'].map(h => (
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
                    <td style={{ ...S.td, textAlign: 'center' }}>{it.gst_pct || 18}%</td>
                    <td style={{ ...S.td, textAlign: 'right', fontWeight: 700, color: '#0f766e' }}>{fmt(it.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {detail.status === 'Draft' && (
              <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end', gap: 10, borderTop: '1px solid #e7e6df', paddingTop: 12 }}>
                <button style={{ ...S.btnSecondary, color: '#dc2626' }} onClick={() => deletePO(detail.id, detail.po_number || detail.poNumber)}>
                  🗑 Delete Draft PO
                </button>
                <button style={{ ...S.btnSecondary, color: '#d97706' }} onClick={() => { setDetail(null); openEdit(detail) }}>
                  ✏️ Edit PO
                </button>
                <button style={S.btnPrimary} onClick={() => approve(detail.id)}>
                  ✅ Approve PO
                </button>
              </div>
            )}
            {(detail.status === 'Approved' || detail.status === 'Partial') && (
              <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end', gap: 10, borderTop: '1px solid #e7e6df', paddingTop: 12 }}>
                <button style={{ ...S.btnPrimary, background: '#0f766e' }} onClick={() => { setDetail(null); openGRN(detail) }}>
                  📦 Receive Inward GRN
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══════ REDESIGNED EDIT PO MODAL ═══════ */}
      {editModal && (() => {
        const vObj = vendorObj(editForm.vendor_id)
        const isInterstate = Boolean((editForm.vendorGstin || vObj?.gstin) && !(editForm.vendorGstin || vObj?.gstin || '').startsWith('29'))
        const calcLineEdit = it => {
          const q = parseFloat(it.qty) || 0
          const p = parseFloat(it.unit_price) || 0
          const slab = GST_SLABS.find(s => s.value === Number(it.gst_pct ?? 18)) || GST_SLABS[3]
          const sub = q * p
          const gst = sub * (slab.value / 100)
          return { sub, gst, total: sub + gst, cgst: sub * (slab.cgst / 100), sgst: sub * (slab.sgst / 100), igst: sub * (slab.igst / 100) }
        }
        const lines = editForm.items.map(calcLineEdit)
        const totSub = lines.reduce((s, l) => s + l.sub, 0)
        const totGst = lines.reduce((s, l) => s + l.gst, 0)
        const totCgst = lines.reduce((s, l) => s + l.cgst, 0)
        const totSgst = lines.reduce((s, l) => s + l.sgst, 0)
        const totIgst = lines.reduce((s, l) => s + l.igst, 0)
        const totGrand = totSub + totGst

        const touchedEditIds = editForm.items.map(it => String(it.material_id)).filter(Boolean)
        const dupEditIds = touchedEditIds.filter((id, idx) => touchedEditIds.indexOf(id) !== idx)

        return (
          <div style={S.overlay} onClick={() => setEditModal(null)}>
            <div style={{ ...S.modal, maxWidth: 1020, padding: 24 }} onClick={e => e.stopPropagation()}>
              
              {/* Modal Header with Agent Status */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, borderBottom: '1px solid #e7e6df', paddingBottom: 12 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#1b1b1d' }}>
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

                {/* Agent Status Pill */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 20, padding: '4px 12px', fontSize: 11, fontWeight: 600, color: '#166534', display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }}></span>
                    🤖 Procurement Agent: Live Editing
                  </div>
                  <button style={S.close} onClick={() => setEditModal(null)}>✕</button>
                </div>
              </div>

              <form onSubmit={saveEdit} style={S.form}>
                
                {/* ── Metadata Grid ── */}
                <div style={{ background: '#f8fafc', padding: 14, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
                    <label style={S.label}>
                      Delivery Due Date
                      <input style={S.input} type="date" value={editForm.delivery_date} onChange={e => setEditForm(f => ({ ...f, delivery_date: e.target.value }))} />
                    </label>

                    <label style={S.label}>
                      Payment Terms
                      <input style={S.input} placeholder="e.g. 30 Days Net, Immediate, etc." value={editForm.payment_terms} onChange={e => setEditForm(f => ({ ...f, payment_terms: e.target.value }))} />
                    </label>

                    <label style={{ ...S.label, gridColumn: '1 / -1' }}>
                      Remarks / Work Order Context
                      <input style={S.input} placeholder="Special terms, specifications, or notes..." value={editForm.remarks} onChange={e => setEditForm(f => ({ ...f, remarks: e.target.value }))} />
                    </label>
                  </div>
                </div>

                {/* ── Line Items Header & Table ── */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={SS.sectionLabel}>ENCLOSED LINE ITEMS ({editForm.items.length})</span>
                      <span style={{ fontSize: 11, color: '#64748b' }}>Search catalog materials, adjust quantities and unit rates</span>
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
                        <div style={{ flex: '1 1 160px', fontSize: 11, fontWeight: 700, color: '#8a8a90', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Description</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 22, flexShrink: 0 }} />
                        <div style={{ width: 100, fontSize: 10, fontWeight: 700, color: '#a0a0a6', textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'right' }}>Qty *</div>
                        <div style={{ width: 70, fontSize: 10, fontWeight: 700, color: '#a0a0a6', textTransform: 'uppercase', letterSpacing: '0.04em' }}>UOM</div>
                        <div style={{ width: 110, fontSize: 10, fontWeight: 700, color: '#a0a0a6', textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'right' }}>Unit Price ₹</div>
                        <div style={{ width: 150, fontSize: 10, fontWeight: 700, color: '#a0a0a6', textTransform: 'uppercase', letterSpacing: '0.04em' }}>GST Slab %</div>
                        <div style={{ flex: 1, fontSize: 10, fontWeight: 700, color: '#a0a0a6', textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'right' }}>Line Total</div>
                        <div style={{ width: 32, flexShrink: 0 }} />
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
                          </div>

                          {/* Bottom Row: Qty + UOM + Unit Price + GST + Line Total + Delete */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ width: 22, flexShrink: 0 }} />

                            {/* Qty Input */}
                            <div style={{ width: 100 }}>
                              <input
                                style={{ ...S.input, width: '100%', textAlign: 'right', fontSize: 12, padding: '6px 8px', borderColor: itErr.qty ? '#ef4444' : '#e7e6df' }}
                                type="number"
                                step="0.001"
                                min="0.001"
                                placeholder="0.000"
                                value={it.qty}
                                onChange={e => setEditItem(i, 'qty', e.target.value)}
                              />
                            </div>

                            {/* UOM */}
                            <div style={{ width: 70 }}>
                              <input
                                style={{ ...S.input, width: '100%', fontSize: 11, padding: '6px 6px', background: '#f8fafc', color: '#475569', fontWeight: 600 }}
                                placeholder="UOM"
                                value={it.uom || (it.material_id ? matUom(it.material_id) : '')}
                                onChange={e => setEditItem(i, 'uom', e.target.value)}
                              />
                            </div>

                            {/* Unit Price */}
                            <div style={{ width: 110 }}>
                              <input
                                style={{ ...S.input, width: '100%', textAlign: 'right', fontSize: 12, padding: '6px 8px', borderColor: itErr.unit_price ? '#ef4444' : '#e7e6df' }}
                                type="number"
                                step="0.01"
                                min="0"
                                placeholder="₹ 0.00"
                                value={it.unit_price}
                                onChange={e => setEditItem(i, 'unit_price', e.target.value)}
                              />
                            </div>

                            {/* GST Slab */}
                            <div style={{ width: 150 }}>
                              <select
                                style={{ ...S.select, width: '100%', fontSize: 11, padding: '6px 6px' }}
                                value={Number(it.gst_pct ?? 18)}
                                onChange={e => setEditItem(i, 'gst_pct', Number(e.target.value))}
                              >
                                {GST_SLABS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                              </select>
                            </div>

                            {/* Line Total */}
                            <div style={{ flex: 1, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 700, fontSize: 12, color: '#0f766e' }}>
                              {fmt(lt.total)}
                            </div>

                            {/* Delete button */}
                            <div style={{ width: 32, flexShrink: 0, textAlign: 'center' }}>
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
                  <div style={{ ...SS.summaryBox, minWidth: 320, background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: 8, padding: 14 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <div style={SS.summaryRow}>
                        <span style={{ fontSize: 12, color: '#64748b' }}>Taxable Subtotal:</span>
                        <span style={SS.summaryVal}>{fmt(totSub)}</span>
                      </div>
                      {!isInterstate ? (
                        <>
                          <div style={SS.summaryRow}>
                            <span style={{ fontSize: 11, color: '#64748b' }}>CGST:</span>
                            <span style={{ ...SS.summaryVal, fontSize: 12 }}>{fmt(totCgst)}</span>
                          </div>
                          <div style={SS.summaryRow}>
                            <span style={{ fontSize: 11, color: '#64748b' }}>SGST:</span>
                            <span style={{ ...SS.summaryVal, fontSize: 12 }}>{fmt(totSgst)}</span>
                          </div>
                        </>
                      ) : (
                        <div style={SS.summaryRow}>
                          <span style={{ fontSize: 11, color: '#64748b' }}>IGST (Interstate):</span>
                          <span style={{ ...SS.summaryVal, fontSize: 12 }}>{fmt(totIgst)}</span>
                        </div>
                      )}
                      <div style={{ ...SS.summaryRow, borderTop: '1px solid #cbd5e1', paddingTop: 8, marginTop: 4 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#1b1b1d' }}>Grand Total (INR):</span>
                        <span style={{ fontSize: 16, fontWeight: 800, color: '#0369a1' }}>{fmt(totGrand)}</span>
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
      {grnModal&&(
        <div style={S.overlay} onClick={()=>setGrnModal(null)}>
          <div style={{...S.modal,maxWidth:800}} onClick={e=>e.stopPropagation()}>
            <div style={S.modalHeader}>
              <div style={S.modalTitle}>Receive GRN — {grnModal.po_number}</div>
              <button style={S.close} onClick={()=>setGrnModal(null)}>✕</button>
            </div>
            <form onSubmit={saveGRN} style={S.form}>
              <div style={S.grid2}>
                <label style={S.label}>Challan No<input style={S.input} value={grnForm.challan_number} onChange={e=>setGrnForm(f=>({...f,challan_number:e.target.value}))} placeholder="DC/Challan number" /></label>
                <label style={S.label}>Invoice No<input style={S.input} value={grnForm.invoice_number} onChange={e=>setGrnForm(f=>({...f,invoice_number:e.target.value}))} placeholder="Vendor invoice no" /></label>
                <label style={S.label}>Vehicle No<input style={S.input} value={grnForm.vehicle_number} onChange={e=>setGrnForm(f=>({...f,vehicle_number:e.target.value}))} placeholder="e.g. MH12AB1234" /></label>
                <label style={S.label}>Remarks<input style={S.input} value={grnForm.remarks} onChange={e=>setGrnForm(f=>({...f,remarks:e.target.value}))} /></label>
              </div>
              <div style={{fontWeight:600,color:'#a0a0a6',fontSize:11,marginTop:8,textTransform:'uppercase'}}>Items — Enter received quantities</div>
              <div style={{overflowX:'auto'}}>
                <table style={S.table}><thead><tr style={S.thead}>
                  {['Material','PO Qty','Received','Accepted','Rejected','Batch/Lot'].map(h=><th key={h} style={S.th}>{h}</th>)}
                </tr></thead><tbody>
                  {grnForm.items.map((it,i)=>(
                    <tr key={i} style={S.tr}>
                      <td style={S.td}><span style={{fontSize:12}}>{it.material_name}</span><br/><span style={{...S.muted,fontSize:10}}>{it.uom}</span></td>
                      <td style={S.td}><span style={S.muted}>{it.po_qty}</span></td>
                      <td style={S.td}><input style={{...S.input,width:70,padding:'4px 6px'}} type="number" step="0.001" min="0.001" value={it.received_qty} onChange={e=>{const v=e.target.value;setGrnItem(i,'received_qty',v);setGrnItem(i,'accepted_qty',v)}} /></td>
                      <td style={S.td}>
                        <input style={{...S.input,width:70,padding:'4px 6px',...((parseFloat(it.accepted_qty)||0)>(parseFloat(it.received_qty)||0)?{border:'1px solid #ef4444',background:'#ef444411'}:{})}} type="number" step="0.001" min="0" value={it.accepted_qty} onChange={e=>setGrnItem(i,'accepted_qty',e.target.value)} />
                        {(parseFloat(it.accepted_qty)||0)>(parseFloat(it.received_qty)||0) && <div style={{fontSize:9,color:'#ef4444',fontWeight:600,marginTop:2}}>Exceeds received</div>}
                      </td>
                      <td style={S.td}><input style={{...S.input,width:70,padding:'4px 6px'}} type="number" step="0.001" value={it.rejected_qty} onChange={e=>setGrnItem(i,'rejected_qty',e.target.value)} /></td>
                      <td style={S.td}><input style={{...S.input,width:100,padding:'4px 6px'}} value={it.batch_number} onChange={e=>setGrnItem(i,'batch_number',e.target.value)} placeholder="Batch/Lot" /></td>
                    </tr>
                  ))}
                </tbody></table>
              </div>
              {grnErr&&<div style={S.error}>{grnErr}</div>}
              <div style={S.modalFooter}>
                <button type="button" style={S.btnSecondary} onClick={()=>setGrnModal(null)}>Cancel</button>
                <button type="submit" style={S.btnPrimary} disabled={grnSaving}>{grnSaving?'Saving GRN…':'✓ Save GRN & Print Receipt'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

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
