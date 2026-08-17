import React, { useState, useEffect } from 'react'
const API = '/api'
const h = () => ({ Authorization: `Bearer ${localStorage.getItem('mk_token')}` })
const V_TYPES = ['Truck','Car','Bike','Auto','Tractor','Others']

export default function Security() {
  const [passes, setPasses] = useState([])
  const [summary, setSummary] = useState({})
  const [modal, setModal] = useState(false)
  const [outModal, setOutModal] = useState(null)
  const [filter, setFilter] = useState({ passType: '', status: '' })
  const [purchaseOrders, setPurchaseOrders] = useState([])
  const [vendors, setVendors] = useState([])
  const [form, setForm] = useState({
    passType: 'IN',
    vehicleType: 'Truck',
    vehicleNumber: '',
    driverName: '',
    purpose: '',
    materialDescription: '',
    fromParty: '',
    toParty: 'MK Paper Mill',
    weightIn: '',
    remarks: '',
    poId: '',
    vendorId: '',
    challanNumber: '',
    invoiceNumber: ''
  })
  const [weightOut, setWeightOut] = useState('')
  const [msg, setMsg] = useState('')
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => { load() }, [filter])
  useEffect(() => {
    fetch(`${API}/purchase/po?limit=100`, { headers: h() })
      .then(r => r.json())
      .then(d => setPurchaseOrders(d.data || []))
      .catch(() => {})
    fetch(`${API}/purchase/vendors`, { headers: h() })
      .then(r => r.json())
      .then(d => setVendors(d.data || []))
      .catch(() => {})
  }, [])

  async function load() {
    const params = new URLSearchParams(Object.fromEntries(Object.entries(filter).filter(([,v])=>v))).toString()
    const r = await fetch(`${API}/security/passes?${params}`, { headers: h() })
    const d = await r.json()
    setPasses(d.data || [])
    setSummary(d.summary || {})
  }

  const handleSelectPO = (poId) => {
    if (!poId) {
      setForm(f => ({ ...f, poId: '', vendorId: '', fromParty: '', materialDescription: '', purpose: '' }))
      return
    }
    const po = purchaseOrders.find(p => String(p.id) === String(poId))
    if (po) {
      setForm(f => ({
        ...f,
        poId: String(po.id),
        vendorId: po.vendor_id ? String(po.vendor_id) : '',
        fromParty: po.vendorName || po.vendor_name || '',
        purpose: `Goods Delivery against PO #${po.po_number || po.poNumber}`,
        materialDescription: `PO Items (${po.item_count || 1} lines)`
      }))
    }
  }

  async function submit() {
    if (!form.vehicleNumber) {
      setMsg('Vehicle number is required')
      return
    }
    const r = await fetch(`${API}/security/passes`, {
      method: 'POST',
      headers: { ...h(), 'Content-Type': 'application/json' },
      body: JSON.stringify(form)
    })
    const d = await r.json()
    if (d.success) {
      setModal(false)
      setForm({
        passType: 'IN', vehicleType: 'Truck', vehicleNumber: '', driverName: '', purpose: '',
        materialDescription: '', fromParty: '', toParty: 'MK Paper Mill', weightIn: '', remarks: '',
        poId: '', vendorId: '', challanNumber: '', invoiceNumber: ''
      })
      load()
    } else setMsg(d.message)
  }

  async function closePass() {
    await fetch(`${API}/security/passes/${outModal.id}/out`, {
      method: 'PUT',
      headers: { ...h(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ weightOut })
    })
    setOutModal(null)
    setWeightOut('')
    load()
  }

  return (
    <div style={S.page}>
      <div style={S.hdr}>
        <div>
          <div style={S.title}>Security — Gate Passes & Weighbridge</div>
          <div style={S.sub}>Integrated Inward (PO Sourced) & Outward (RTV & Dispatch) Logistics</div>
        </div>
        <button style={S.btn} onClick={() => { setMsg(''); setModal(true) }}>+ New Gate Pass</button>
      </div>

      <div style={S.kpis}>
        {[
          ['Open Passes', summary.open||0, '#d97706'],
          ['Today Total', summary.today||0, '#1b1b1d'],
          ['IN Today', summary.intoday||0, '#16a34a'],
          ['OUT Today', summary.outtoday||0, '#1b1b1d'],
        ].map(([l,v,c]) => (
          <div key={l} style={S.kpi}><div style={{ ...S.kpiVal, color: c }}>{v}</div><div style={S.kpiLbl}>{l}</div></div>
        ))}
      </div>

      <div style={{ display:'flex', gap:8, marginBottom:12 }}>
        <input style={{...S.sel, width:240, background: '#fff'}} placeholder='Search passes, vehicle, driver...' value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} />
        <select style={S.sel} value={filter.passType} onChange={e => setFilter({...filter, passType: e.target.value})}>
          <option value=''>All Types</option>
          <option>IN</option><option>OUT</option>
        </select>
        <select style={S.sel} value={filter.status} onChange={e => setFilter({...filter, status: e.target.value})}>
          <option value=''>All Status</option>
          <option>Open</option><option>Closed</option>
        </select>
        <button style={S.btnGhost} onClick={load}>↻ Refresh</button>
      </div>

      <div style={S.tableWrap}>
        <table style={S.tbl}>
          <thead><tr>{['GP No','Type','Vehicle','Driver','PO / Ref','Party','Challan / Inv','In Time','Out Time','Net Wt','Status','Action'].map(c=><th key={c} style={S.th}>{c}</th>)}</tr></thead>
          <tbody>
            {passes.filter(p => {
              const q = searchTerm.toLowerCase()
              return !q || (p.gp_number||'').toLowerCase().includes(q) || (p.vehicle_number||'').toLowerCase().includes(q) || (p.driver_name||'').toLowerCase().includes(q) || (p.from_party||'').toLowerCase().includes(q) || (p.poNumber||'').toLowerCase().includes(q)
            }).map(p => (
              <tr key={p.id}>
                <td style={S.td}><b>{p.gp_number}</b></td>
                <td style={S.td}><span style={{ ...S.badge, background: p.pass_type==='IN'?'#dcfce7':'#e0e7ff', color: p.pass_type==='IN'?'#15803d':'#1b1b1d' }}>{p.pass_type}</span></td>
                <td style={S.td}><b>{p.vehicle_number}</b><div style={S.sub2}>{p.vehicle_type}</div></td>
                <td style={S.td}>{p.driver_name || '—'}</td>
                <td style={S.td}>
                  {p.poNumber ? <span style={{ ...S.code, color: '#0284c7' }}>{p.poNumber}</span> : <span style={S.sub2}>{p.purpose}</span>}
                </td>
                <td style={S.td}>{p.from_party || p.vendorName || '—'}</td>
                <td style={S.td}>
                  {p.challan_number && <div style={{ fontSize: 11 }}>DC: {p.challan_number}</div>}
                  {p.invoice_number && <div style={{ fontSize: 11, color: '#64748b' }}>Inv: {p.invoice_number}</div>}
                  {!p.challan_number && !p.invoice_number && '—'}
                </td>
                <td style={S.td}>{p.in_time ? new Date(p.in_time).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'}) : '—'}</td>
                <td style={S.td}>{p.out_time ? new Date(p.out_time).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'}) : '—'}</td>
                <td style={S.td}>{p.net_weight ? `${p.net_weight} T` : p.weight_in ? `In: ${p.weight_in} T` : '—'}</td>
                <td style={S.td}><span style={{ ...S.badge, background: p.status==='Open'?'#fef9c3':'#dcfce7', color: p.status==='Open'?'#854d0e':'#15803d' }}>{p.status}</span></td>
                <td style={S.td}>{p.status==='Open' && <button style={S.btnSm} onClick={() => { setOutModal(p); setWeightOut('') }}>Record OUT</button>}</td>
              </tr>
            ))}
            {passes.length === 0 && <tr><td colSpan={12} style={{ textAlign:'center', padding:32, color:'#a0a0a6' }}>No gate passes found</td></tr>}
          </tbody>
        </table>
      </div>

      {modal && (
        <div style={S.overlay}>
          <div style={{ ...S.modal, width: 620 }}>
            <div style={S.modalHdr}><b>Create Gate Pass & Weighbridge Entry</b><button style={S.x} onClick={() => setModal(false)}>✕</button></div>
            {msg && <div style={S.err}>{msg}</div>}
            
            <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#0369a1', textTransform: 'uppercase' }}>Optional: Link Purchase Order (PO)</div>
              <select style={S.input} value={form.poId} onChange={e => handleSelectPO(e.target.value)}>
                <option value="">-- Direct Gate Entry (No PO) --</option>
                {purchaseOrders.filter(p => ['Approved', 'Partial'].includes(p.status)).map(p => (
                  <option key={p.id} value={p.id}>{p.po_number || p.poNumber} — {p.vendorName || p.vendor_name || 'Vendor'} (₹{Number(p.grand_total||0).toLocaleString('en-IN')})</option>
                ))}
              </select>
            </div>

            <div style={S.row2}>
              <div>
                <label style={S.lbl}>Pass Direction</label>
                <select style={S.input} value={form.passType} onChange={e => setForm({...form, passType: e.target.value})}>
                  <option value="IN">INWARD (Entry to Mill)</option>
                  <option value="OUT">OUTWARD (Exit / Dispatch)</option>
                </select>
              </div>
              <div>
                <label style={S.lbl}>Vehicle Type</label>
                <select style={S.input} value={form.vehicleType} onChange={e => setForm({...form, vehicleType: e.target.value})}>
                  {V_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
            </div>

            <div style={S.row2}>
              <div>
                <label style={S.lbl}>Vehicle Number *</label>
                <input style={S.input} placeholder='e.g. MH 12 AB 1234' value={form.vehicleNumber} onChange={e => setForm({...form, vehicleNumber: e.target.value})} />
              </div>
              <div>
                <label style={S.lbl}>Driver Name</label>
                <input style={S.input} placeholder='Driver Full Name' value={form.driverName} onChange={e => setForm({...form, driverName: e.target.value})} />
              </div>
            </div>

            <div style={S.row2}>
              <div>
                <label style={S.lbl}>From Party / Supplier</label>
                <input style={S.input} placeholder='Supplier / Vendor Name' value={form.fromParty} onChange={e => setForm({...form, fromParty: e.target.value})} />
              </div>
              <div>
                <label style={S.lbl}>To Party</label>
                <input style={S.input} placeholder='Destination' value={form.toParty} onChange={e => setForm({...form, toParty: e.target.value})} />
              </div>
            </div>

            <div style={S.row2}>
              <div>
                <label style={S.lbl}>Delivery Challan (DC) No</label>
                <input style={S.input} placeholder='Vendor DC / E-Way No' value={form.challanNumber} onChange={e => setForm({...form, challanNumber: e.target.value})} />
              </div>
              <div>
                <label style={S.lbl}>Vendor Invoice No</label>
                <input style={S.input} placeholder='Tax Invoice No' value={form.invoiceNumber} onChange={e => setForm({...form, invoiceNumber: e.target.value})} />
              </div>
            </div>

            <div style={S.row2}>
              <div>
                <label style={S.lbl}>Purpose of Visit *</label>
                <input style={S.input} placeholder='e.g. Raw Material Delivery' value={form.purpose} onChange={e => setForm({...form, purpose: e.target.value})} />
              </div>
              <div>
                <label style={S.lbl}>Gross Weighbridge In (Tonnes)</label>
                <input style={S.input} type='number' step="any" placeholder='Weight IN (T)' value={form.weightIn} onChange={e => setForm({...form, weightIn: e.target.value})} />
              </div>
            </div>

            <input style={S.input} placeholder='Material Description' value={form.materialDescription} onChange={e => setForm({...form, materialDescription: e.target.value})} />
            <textarea style={{ ...S.input, height: 50 }} placeholder='Remarks' value={form.remarks} onChange={e => setForm({...form, remarks: e.target.value})} />
            
            <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
              <button style={S.btnGhost} onClick={() => setModal(false)}>Cancel</button>
              <button style={S.btn} onClick={submit}>Create Gate Pass</button>
            </div>
          </div>
        </div>
      )}

      {outModal && (
        <div style={S.overlay}>
          <div style={{ ...S.modal, width: 400 }}>
            <div style={S.modalHdr}><b>Vehicle OUT — {outModal.gp_number}</b><button style={S.x} onClick={() => setOutModal(null)}>✕</button></div>
            <div style={{ fontSize:13, color:'#8a8a90' }}>{outModal.vehicle_number} · {outModal.driver_name || 'Driver'}</div>
            {outModal.weight_in && <div style={{ fontSize:12, color:'#0369a1', fontWeight: 600 }}>Gross In Weight: {outModal.weight_in} Tonnes</div>}
            
            <div>
              <label style={S.lbl}>Tare / Weight OUT (Tonnes)</label>
              <input style={S.input} type='number' step="any" placeholder='Tare Weight OUT (T)' value={weightOut} onChange={e => setWeightOut(e.target.value)} />
            </div>

            {outModal.weight_in && weightOut && (
              <div style={{ background: '#dcfce7', padding: 10, borderRadius: 8, fontSize: 13, color: '#15803d', fontWeight: 700 }}>
                Computed Net Material Weight: {Math.abs(parseFloat(outModal.weight_in) - parseFloat(weightOut)).toFixed(3)} Tonnes
              </div>
            )}

            <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
              <button style={S.btnGhost} onClick={() => setOutModal(null)}>Cancel</button>
              <button style={S.btn} onClick={closePass}>Record OUT & Close Gate Pass</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const S = {
  page: { padding: 24, background: '#f6f5f0', minHeight: '100vh' },
  hdr: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  title: { fontSize: 22, fontWeight: 700, color: '#1b1b1d' },
  sub: { fontSize: 13, color: '#8a8a90', marginTop: 4 },
  sub2: { fontSize: 11, color: '#a0a0a6' },
  kpis: { display: 'flex', gap: 12, marginBottom: 20 },
  kpi: { background: 'white', borderRadius: 10, padding: '14px 20px', flex: 1, boxShadow: '0 1px 4px rgba(0,0,0,0.07)' },
  kpiVal: { fontSize: 26, fontWeight: 700 },
  kpiLbl: { fontSize: 12, color: '#8a8a90', marginTop: 2 },
  sel: { padding: '7px 12px', border: '1px solid #d8d6cc', borderRadius: 8, fontSize: 13 },
  tableWrap: { background: 'white', borderRadius: 10, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.07)' },
  tbl: { width: '100%', borderCollapse: 'collapse' },
  th: { padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#8a8a90', textTransform: 'uppercase', background: '#f6f5f0', borderBottom: '1px solid #ecebe5' },
  td: { padding: '10px 14px', fontSize: 13, color: '#1b1b1d', borderBottom: '1px solid #f6f5f0', verticalAlign: 'middle' },
  badge: { fontSize: 11, padding: '2px 8px', borderRadius: 999, fontWeight: 600 },
  btn: { background: '#1b1b1d', color: 'white', border: 'none', borderRadius: 8, padding: '8px 16px', cursor: 'pointer', fontSize: 13, fontWeight: 600 },
  btnSm: { background: '#0284c7', color: '#fff', border: 'none', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 12, fontWeight: 600 },
  btnGhost: { background: 'white', color: '#3a3a3e', border: '1px solid #d8d6cc', borderRadius: 8, padding: '8px 16px', cursor: 'pointer', fontSize: 13 },
  row2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modal: { background: 'white', borderRadius: 12, padding: 24, display: 'flex', flexDirection: 'column', gap: 12, maxHeight: '90vh', overflowY: 'auto' },
  modalHdr: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  x: { background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#8a8a90' },
  input: { width: '100%', padding: '8px 12px', border: '1px solid #d8d6cc', borderRadius: 8, fontSize: 13, boxSizing: 'border-box' },
  lbl: { fontSize: 11, fontWeight: 600, color: '#64748b', marginBottom: 2, display: 'block' },
  code: { fontFamily: 'monospace', background: '#f1f5f9', padding: '2px 6px', borderRadius: 4, fontSize: 11 },
  err: { background: '#fee2e2', color: '#dc2626', padding: '8px 12px', borderRadius: 6, fontSize: 13 },
}
