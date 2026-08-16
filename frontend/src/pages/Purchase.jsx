import React, { useState, useEffect, useCallback, useRef } from 'react'
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

// Print styles injected into <head> once
const PRINT_STYLE = `@media print{
  body > *:not(#print-root){display:none!important}
  #print-root{display:block!important;position:fixed;inset:0;background:#fff;z-index:99999;padding:32px;font-family:Arial,sans-serif;font-size:12px;color:#000}
  #print-root h2{font-size:18px;margin-bottom:4px}
  #print-root table{width:100%;border-collapse:collapse;margin-top:12px}
  #print-root th,#print-root td{border:1px solid #ccc;padding:6px 10px;text-align:left}
  #print-root th{background:#f5f5f5;font-weight:700}
  #print-root .no-print{display:none!important}
  @page{margin:20mm}
}`

function injectPrintStyle() {
  if (!document.getElementById('po-print-style')) {
    const s = document.createElement('style'); s.id='po-print-style'; s.textContent=PRINT_STYLE;
    document.head.appendChild(s);
  }
}

function PrintFrame({ id, content, onClose }) {
  useEffect(() => { injectPrintStyle(); }, []);
  return (
    <div id="print-root" style={{ display:'none', position:'fixed', inset:0, background:'#fff', zIndex:99999, padding:32, fontFamily:'Arial,sans-serif', overflowY:'auto' }}>
      <button className="no-print" onClick={onClose} style={{ position:'fixed', top:16, right:16, background:'#ef4444', color:'#fff', border:'none', borderRadius:8, padding:'8px 18px', cursor:'pointer', fontWeight:700 }}>✕ Close</button>
      <button className="no-print" onClick={()=>window.print()} style={{ position:'fixed', top:16, right:110, background:'#1b1b1d', color:'#fff', border:'none', borderRadius:8, padding:'8px 18px', cursor:'pointer', fontWeight:700 }}>🖨 Print</button>
      {content}
    </div>
  );
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
  const [editForm,setEditForm]=useState({delivery_date:'',payment_terms:'',remarks:'',items:[]})
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
    if(!window.confirm('Cancel this PO? This cannot be undone.')) return
    const r=await API(`/api/purchase/po/${id}/cancel`,{method:'PUT'})
    if(r.success){load();setDetail(null)}else alert(r.message||'Cancel failed')
  }

  // Edit PO
  const openEdit=async(po)=>{
    const r=await API(`/api/purchase/po/${po.id}`)
    if(!r.success) return
    const d=r.data
    setEditForm({
      delivery_date:d.delivery_date?.slice(0,10)||'',
      payment_terms:d.payment_terms||'',
      remarks:d.remarks||'',
      items:(d.items||[]).map(it=>({material_id:it.material_id,qty:it.qty,uom:it.uom,unit_price:it.unit_price,gst_pct:it.gst_pct||18}))
    })
    setEditModal(po)
    setEditErr('')
  }
  const addEditItem=()=>setEditForm(f=>({...f,items:[...f.items,{material_id:'',qty:'',uom:'',unit_price:'',gst_pct:18}]}))
  const removeEditItem=i=>setEditForm(f=>({...f,items:f.items.filter((_,j)=>j!==i)}))
  const setEditItem=(i,k,v)=>setEditForm(f=>({...f,items:f.items.map((it,j)=>j===i?{...it,[k]:v}:it)}))
  const saveEdit=async e=>{
    e.preventDefault()
    if (!editForm.items.length || editForm.items.some(it=>!it.material_id)) { setEditErr('Every line needs a material selected'); return }
    if (editForm.items.some(it=>!(parseFloat(it.qty)>0))) { setEditErr('Every line needs a quantity greater than 0'); return }
    if (editForm.items.some(it=>!(parseFloat(it.unit_price)>=0))) { setEditErr('Unit price cannot be negative'); return }
    const dupCheck = editForm.items.map(it=>it.material_id)
    if (new Set(dupCheck).size !== dupCheck.length) { setEditErr('Same material added in more than one line — combine quantities instead'); return }
    setEditSaving(true);setEditErr('')
    const items=editForm.items.map(it=>({...it,uom:matUom(it.material_id)||it.uom}))
    const r=await API(`/api/purchase/po/${editModal.id}`,{method:'PUT',body:JSON.stringify({...editForm,items})})
    setEditSaving(false)
    if(r.success){setEditModal(null);load()}else setEditErr(r.message||'Edit failed')
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
      items:(po.items||[]).map(it=>({
        material_id:it.material_id, material_name:it.materialName, uom:it.uom,
        po_qty:it.qty, received_qty:it.qty, accepted_qty:it.qty, rejected_qty:0,
        unit_price:it.unit_price, gst_pct:it.gst_pct, batch_number:'',
      }))
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

  // Print PO
  const printPO=(po)=>{
    const isInter = po.vendorGstin && !po.vendorGstin.startsWith('29')
    const content=(
      <div>
        <div style={{display:'flex',justifyContent:'space-between',marginBottom:16}}>
          <div>
            <h2 style={{margin:0}}>Purchase Order</h2>
            <div style={{fontSize:13,color:'#555'}}>MK Paper Mill ERP</div>
          </div>
          <div style={{textAlign:'right',fontSize:13}}>
            <div><strong>PO No:</strong> {po.po_number || po.poNumber}</div>
            <div><strong>Date:</strong> {po.date?.slice(0,10)}</div>
            <div><strong>Status:</strong> {po.status}</div>
          </div>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginBottom:16,fontSize:13}}>
          <div><strong>Vendor:</strong> {po.vendorName} {po.vendorGstin ? `(GSTIN: ${po.vendorGstin})` : ''}</div>
          <div><strong>Delivery Date:</strong> {po.delivery_date?.slice(0,10)||'—'}</div>
          <div><strong>Payment Terms:</strong> {po.payment_terms||'—'}</div>
          <div><strong>Remarks:</strong> {po.remarks||'—'}</div>
        </div>
        <table>
          <thead><tr><th>#</th><th>Material</th><th>UOM</th><th>Qty</th><th>Unit Price</th><th>GST Slab</th><th>Line Total</th></tr></thead>
          <tbody>
            {(po.items||[]).map((it,i)=>(
              <tr key={i}>
                <td>{i+1}</td>
                <td>{it.materialName || it.description}</td>
                <td>{it.uom}</td>
                <td>{it.qty}</td>
                <td>{fmt(it.unit_price)}</td>
                <td>{it.gst_pct}%</td>
                <td>{fmt(it.total)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={6} style={{textAlign:'right',fontWeight:700}}>Taxable Subtotal (₹):</td>
              <td style={{fontWeight:700}}>{fmt(po.total_value)}</td>
            </tr>
            {isInter ? (
              <tr>
                <td colSpan={6} style={{textAlign:'right',color:'#6366f1'}}>IGST Amount (Inter-State):</td>
                <td>{fmt(po.gst_value)}</td>
              </tr>
            ) : (
              <>
                <tr>
                  <td colSpan={6} style={{textAlign:'right',color:'#059669'}}>CGST Amount (50%):</td>
                  <td>{fmt(Number(po.gst_value || 0) / 2)}</td>
                </tr>
                <tr>
                  <td colSpan={6} style={{textAlign:'right',color:'#059669'}}>SGST Amount (50%):</td>
                  <td>{fmt(Number(po.gst_value || 0) / 2)}</td>
                </tr>
              </>
            )}
            <tr>
              <td colSpan={6} style={{textAlign:'right',fontWeight:700}}>Total Tax Amount (₹):</td>
              <td style={{fontWeight:700}}>{fmt(po.gst_value)}</td>
            </tr>
            <tr style={{background:'#f8fafc'}}>
              <td colSpan={6} style={{textAlign:'right',fontWeight:800,fontSize:14}}>Grand Total (₹):</td>
              <td style={{fontWeight:800,fontSize:14,color:'#0f766e'}}>{fmt(po.grand_total)}</td>
            </tr>
          </tfoot>
        </table>
        <div style={{marginTop:32,display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:32}}>
          <div style={{borderTop:'1px solid #000',paddingTop:8,textAlign:'center',fontSize:12}}>Prepared By</div>
          <div style={{borderTop:'1px solid #000',paddingTop:8,textAlign:'center',fontSize:12}}>Approved By</div>
          <div style={{borderTop:'1px solid #000',paddingTop:8,textAlign:'center',fontSize:12}}>Vendor Acknowledgment</div>
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
                          <span style={{ color: '#16a34a', fontWeight: 600, fontSize: 12 }}>📋 {r.indentNumber}</span>
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
                      <button style={S.btnIcon} onClick={()=>openDetail(r.id)} title="View">👁</button>
                      {r.status==='Draft'&&<button style={S.btnIcon} onClick={()=>approve(r.id)} title="Approve">✅</button>}
                      {r.status==='Draft'&&<button style={S.btnIcon} onClick={async()=>{const d=await API(`/api/purchase/po/${r.id}`);if(d.success)openEdit(d.data)}} title="Edit">✏️</button>}
                      {(r.status==='Draft'||r.status==='Approved')&&<button style={S.btnIcon} onClick={()=>cancelPO(r.id)} title="Cancel">🚫</button>}
                      {(r.status==='Approved'||r.status==='Partial')&&<button style={S.btnIcon} onClick={()=>openGRN(r)} title="Receive GRN">📦</button>}
                      {(r.status==='Received'||r.status==='Partial'||r.status==='Approved')&&<button style={{...S.btnIcon, color: '#0369a1'}} onClick={()=>openBill(r)} title="Book Vendor Bill for Finance">🧾</button>}
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
                    {['GRN Number', 'Date', 'PO Reference', 'Vendor', 'Challan / Invoice', 'Vehicle No', 'Accepted Value', 'Received By', 'Actions'].map(h => (
                      <th key={h} style={S.th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {grnList.map(g => (
                    <tr key={g.id} style={S.tr}>
                      <td style={S.td}><span style={S.code}>{g.grnNumber}</span></td>
                      <td style={S.td}><span style={S.muted}>{g.date?.slice(0, 10)}</span></td>
                      <td style={S.td}><span style={{ color: '#0369a1', fontWeight: 600 }}>{g.poNumber}</span></td>
                      <td style={S.td}><strong>{g.vendorName}</strong></td>
                      <td style={S.td}>
                        <div>{g.invoiceNumber ? `Inv: ${g.invoiceNumber}` : ''}</div>
                        <div style={{ fontSize: 11, color: '#64748b' }}>{g.challanNumber ? `DC: ${g.challanNumber}` : ''}</div>
                      </td>
                      <td style={S.td}><span style={S.muted}>{g.vehicleNumber || '—'}</span></td>
                      <td style={S.td}><span style={{ color: '#15803d', fontWeight: 700 }}>{fmt(g.totalValue)}</span></td>
                      <td style={S.td}><span style={S.muted}>{g.receivedByName || 'Store Clerk'}</span></td>
                      <td style={S.td}>
                        <button
                          style={{ ...S.btnIcon, color: '#0369a1', fontWeight: 600, fontSize: 12 }}
                          onClick={() => openBill({ id: g.poId, poNumber: g.poNumber, vendorName: g.vendorName, grandTotal: g.totalValue })}
                          title="Book Purchase Bill"
                        >
                          🧾 Book Bill
                        </button>
                      </td>
                    </tr>
                  ))}
                  {grnList.length === 0 && (
                    <tr>
                      <td colSpan={9} style={S.empty}>No GRN records found.</td>
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
      {detail&&(
        <div style={S.overlay} onClick={()=>setDetail(null)}>
          <div style={{...S.modal,maxWidth:680}} onClick={e=>e.stopPropagation()}>
            <div style={S.modalHeader}>
              <div style={S.modalTitle}>{detail.po_number}</div>
              <div style={{display:'flex',gap:8,alignItems:'center'}}>
                <button style={{...S.btnSecondary,padding:'5px 12px',fontSize:12}} onClick={()=>printPO(detail)}>🖨 Print</button>
                {detail.status==='Draft'&&<button style={{...S.btnSecondary,padding:'5px 12px',fontSize:12}} onClick={()=>{setDetail(null);openEdit(detail)}}>✏️ Edit</button>}
                {(detail.status==='Draft'||detail.status==='Approved')&&<button style={{...S.btnSecondary,padding:'5px 12px',fontSize:12,color:'#ef4444'}} onClick={()=>cancelPO(detail.id)}>🚫 Cancel</button>}
                <button style={S.close} onClick={()=>setDetail(null)}>✕</button>
              </div>
            </div>
            <div style={S.grid2}>
              <div><span style={S.muted}>Vendor: </span>{detail.vendorName}</div>
              <div><span style={S.muted}>Status: </span>{detail.status}</div>
              <div><span style={S.muted}>Subtotal: </span>{fmt(detail.total_value)}</div>
              <div><span style={S.muted}>GST: </span>{fmt(detail.gst_value)}</div>
              <div><span style={S.muted}>Grand Total: </span><strong>{fmt(detail.grand_total)}</strong></div>
              <div><span style={S.muted}>Delivery: </span>{detail.delivery_date?.slice(0,10)||'—'}</div>
              {detail.payment_terms&&<div><span style={S.muted}>Payment Terms: </span>{detail.payment_terms}</div>}
              {detail.remarks&&<div><span style={S.muted}>Remarks: </span>{detail.remarks}</div>}
            </div>
            <table style={{...S.table,marginTop:12}}><thead><tr style={S.thead}>
              {['Material','Qty','Unit Price','GST%','Total'].map(h=><th key={h} style={S.th}>{h}</th>)}
            </tr></thead><tbody>
              {(detail.items||[]).map(it=>(
                <tr key={it.id} style={S.tr}>
                  <td style={S.td}>{it.materialName}</td>
                  <td style={S.td}>{it.qty} {it.uom}</td>
                  <td style={S.td}>{fmt(it.unit_price)}</td>
                  <td style={S.td}>{it.gst_pct}%</td>
                  <td style={S.td}>{fmt(it.total)}</td>
                </tr>
              ))}
            </tbody></table>
            {detail.status==='Draft'&&(
              <div style={{marginTop:14,display:'flex',justifyContent:'flex-end',gap:8}}>
                <button style={S.btnPrimary} onClick={()=>approve(detail.id)}>✅ Approve PO</button>
              </div>
            )}
            {(detail.status==='Approved'||detail.status==='Partial')&&(
              <div style={{marginTop:14,display:'flex',justifyContent:'flex-end'}}>
                <button style={S.btnPrimary} onClick={()=>{setDetail(null);openGRN(detail)}}>📦 Receive GRN</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Edit PO Modal */}
      {editModal&&(
        <div style={S.overlay} onClick={()=>setEditModal(null)}>
          <div style={{...S.modal,maxWidth:720}} onClick={e=>e.stopPropagation()}>
            <div style={S.modalHeader}><div style={S.modalTitle}>Edit PO — {editModal.po_number||editModal.id}</div><button style={S.close} onClick={()=>setEditModal(null)}>✕</button></div>
            <form onSubmit={saveEdit} style={S.form}>
              <div style={S.grid2}>
                <label style={S.label}>Delivery Date<input style={S.input} type="date" value={editForm.delivery_date} onChange={e=>setEditForm(f=>({...f,delivery_date:e.target.value}))} /></label>
                <label style={S.label}>Payment Terms<input style={S.input} value={editForm.payment_terms} onChange={e=>setEditForm(f=>({...f,payment_terms:e.target.value}))} /></label>
                <label style={{...S.label, gridColumn:'1/-1'}}>Remarks<input style={S.input} value={editForm.remarks} onChange={e=>setEditForm(f=>({...f,remarks:e.target.value}))} /></label>
              </div>
              <div style={{fontWeight:600,color:'#a0a0a6',fontSize:12,marginTop:8}}>LINE ITEMS</div>
              {editForm.items.map((it,i)=>(
                <div key={i} style={{display:'grid',gridTemplateColumns:'2fr 1fr 1fr 1fr auto',gap:8,alignItems:'end'}}>
                  <label style={S.label}>Material *
                    <select style={S.select} value={it.material_id} onChange={e=>setEditItem(i,'material_id',e.target.value)}>
                      <option value="">Select...</option>{mats.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}
                    </select>
                  </label>
                  <label style={S.label}>Qty<input style={S.input} type="number" step="0.001" value={it.qty} onChange={e=>setEditItem(i,'qty',e.target.value)} /></label>
                  <label style={S.label}>Unit Price<input style={S.input} type="number" step="0.01" value={it.unit_price} onChange={e=>setEditItem(i,'unit_price',e.target.value)} /></label>
                  <label style={S.label}>GST Slab
                    <select style={S.select} value={Number(it.gst_pct ?? 18)} onChange={e=>setEditItem(i,'gst_pct',Number(e.target.value))}>
                      {GST_SLABS.map(s=><option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                  </label>
                  <button type="button" style={{...S.btnIcon,paddingBottom:8}} onClick={()=>removeEditItem(i)}>🗑</button>
                </div>
              ))}
              <button type="button" style={S.btnSecondary} onClick={addEditItem}>+ Add Item</button>
              {editErr&&<div style={S.error}>{editErr}</div>}
              <div style={S.modalFooter}>
                <button type="button" style={S.btnSecondary} onClick={()=>setEditModal(null)}>Cancel</button>
                <button type="submit" style={S.btnPrimary} disabled={editSaving}>{editSaving?'Saving...':'Save Changes'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

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
