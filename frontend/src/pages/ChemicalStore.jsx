import { useState, useEffect, useCallback } from 'react'
import ProductDetailModal from '../components/ProductDetailModal'

const API = '/api'
const h  = () => ({ Authorization: `Bearer ${localStorage.getItem('mk_token')}` })
const jh = () => ({ ...h(), 'Content-Type': 'application/json' })

const fmt    = n => Number(n || 0).toLocaleString('en-IN')
const fmtCur = n => `₹${Number(n || 0).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`

const CRIT_STYLE = {
  A: { background: '#fee2e2', color: '#991b1b', label: 'A — Critical' },
  B: { background: '#fef3c7', color: '#92400e', label: 'B — Important' },
  C: { background: '#dcfce7', color: '#166534', label: 'C — General' },
}

const TABS = ['Stock Board', 'Pick / Issue', 'Sales Pick', 'Receive Stock', 'Ledger']

const s = {
  page:      { display:'flex', height:'calc(100vh - 64px)', overflow:'hidden', background:'#f6f5f0', fontFamily:'sans-serif' },
  sidebar:   { width:300, minWidth:260, display:'flex', flexDirection:'column', borderRight:'1px solid #ecebe5', background:'#fff' },
  sideHead:  { padding:'12px', borderBottom:'1px solid #ecebe5' },
  title:     { fontWeight:700, fontSize:14, color:'#1b1b1d', marginBottom:8 },
  input:     { width:'100%', border:'1px solid #d8d6cc', borderRadius:6, padding:'6px 10px', fontSize:12, boxSizing:'border-box', outline:'none' },
  chemList:  { flex:1, overflowY:'auto' },
  chemItem:  (active) => ({ width:'100%', textAlign:'left', padding:'10px 12px', borderBottom:'1px solid #f6f5f0', background: active?'#eff6ff':'#fff', borderLeft: active?'3px solid #1b1b1d':'3px solid transparent', cursor:'pointer' }),
  chemName:  { fontSize:12, fontWeight:600, color:'#1b1b1d', lineHeight:1.4 },
  chemSub:   { fontSize:10, color:'#a0a0a6', marginTop:2 },
  stockVal:  (low, out) => ({ fontSize:10, fontWeight:700, color: out?'#dc2626': low?'#d97706':'#16a34a' }),
  footer:    { padding:'8px 12px', borderTop:'1px solid #ecebe5', background:'#f6f5f0', display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:4 },
  footCell:  { textAlign:'center', fontSize:10, color:'#8a8a90' },
  footVal:   (c) => ({ fontWeight:700, fontSize:14, color: c||'#1b1b1d' }),
  main:      { flex:1, display:'flex', flexDirection:'column', overflow:'hidden' },
  tabBar:    { display:'flex', borderBottom:'1px solid #ecebe5', background:'#fff', padding:'8px 16px 0', gap:4 },
  tab:       (active) => ({ padding:'6px 14px', fontSize:12, fontWeight:500, borderRadius:'6px 6px 0 0', border:'none', cursor:'pointer', background: active?'#1b1b1d':'transparent', color: active?'#fff':'#8a8a90' }),
  content:   { flex:1, overflowY:'auto', padding:16 },
  kpiGrid:   { display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:16 },
  kpiCard:   { background:'#fff', border:'1px solid #ecebe5', borderRadius:8, padding:12 },
  kpiVal:    (c) => ({ fontSize:20, fontWeight:700, color:c }),
  kpiLabel:  { fontSize:11, color:'#a0a0a6', marginTop:2 },
  detCard:   { background:'#fff', border:'1px solid #ecebe5', borderRadius:8, padding:16 },
  detGrid:   { display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10, marginTop:12 },
  detCell:   { background:'#f6f5f0', borderRadius:6, padding:8 },
  detKey:    { fontSize:10, color:'#a0a0a6' },
  detVal:    { fontSize:12, fontWeight:500, color:'#1b1b1d', marginTop:2, wordBreak:'break-word' },
  form:      { maxWidth:520, background:'#fff', border:'1px solid #ecebe5', borderRadius:8, padding:16 },
  label:     { fontSize:11, color:'#8a8a90', display:'block', marginBottom:4 },
  finput:    { width:'100%', border:'1px solid #d8d6cc', borderRadius:6, padding:'6px 10px', fontSize:12, boxSizing:'border-box', marginBottom:12 },
  fselect:   { width:'100%', border:'1px solid #d8d6cc', borderRadius:6, padding:'6px 10px', fontSize:12, boxSizing:'border-box', marginBottom:12 },
  ftextarea: { width:'100%', border:'1px solid #d8d6cc', borderRadius:6, padding:'6px 10px', fontSize:12, boxSizing:'border-box', marginBottom:12, resize:'none' },
  grid2:     { display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 },
  btn:       (c) => ({ width:'100%', background:c, color:'#fff', border:'none', borderRadius:6, padding:'9px 0', fontSize:12, fontWeight:600, cursor:'pointer' }),
  msg:       (ok) => ({ padding:'8px 12px', borderRadius:6, fontSize:12, marginBottom:12, background: ok?'#dcfce7':'#fee2e2', color: ok?'#166534':'#dc2626' }),
  badge:     (st) => ({ fontSize:10, padding:'2px 8px', borderRadius:999, fontWeight:700, ...st }),
  table:     { width:'100%', borderCollapse:'collapse', fontSize:12 },
  th:        { padding:'8px 12px', textAlign:'left', fontWeight:600, color:'#8a8a90', background:'#f6f5f0', borderBottom:'1px solid #ecebe5' },
  td:        { padding:'8px 12px', borderBottom:'1px solid #f6f5f0' },
  bar:       { height:4, borderRadius:2, background:'#ecebe5', marginTop:4 },
  barFill:   (pct, low, out) => ({ height:4, borderRadius:2, width:`${pct}%`, background: out?'#ef4444': low?'#f59e0b':'#22c55e' }),
  empty:     { padding:40, textAlign:'center', color:'#a0a0a6', fontSize:13 },
}

export default function ChemicalStore() {
  const [tab, setTab]               = useState(0)
  const [chemicals, setChemicals]   = useState([])
  const [summary, setSummary]       = useState({})
  const [search, setSearch]         = useState('')
  const [filterLow, setFilterLow]   = useState(false)
  const [loading, setLoading]       = useState(true)
  const [selected, setSelected]     = useState(null)
  const [selectedProductModalId, setSelectedProductModalId] = useState(null)
  const [ledger, setLedger]         = useState([])
  const [ledgerLoading, setLedgerLoading] = useState(false)
  const [departments, setDepartments] = useState([])
  const [customers, setCustomers]   = useState([])

  const [pickForm, setPickForm]     = useState({ materialId:'', quantity:'', departmentId:'', purpose:'', section:'', remarks:'' })
  const [pickMsg, setPickMsg]       = useState(null)
  const [pickLoading, setPickLoading] = useState(false)

  const [salesForm, setSalesForm]   = useState({ materialId:'', quantity:'', unitPrice:'', customerId:'', remarks:'' })
  const [salesMsg, setSalesMsg]     = useState(null)
  const [salesLoading, setSalesLoading] = useState(false)

  const [rctForm, setRctForm]       = useState({ materialId:'', quantity:'', unitPrice:'', supplierName:'', invoiceNo:'', remarks:'' })
  const [rctMsg, setRctMsg]         = useState(null)
  const [rctLoading, setRctLoading] = useState(false)

  const fetchChemicals = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (filterLow) params.set('lowstock', '1')
      const d = await fetch(`${API}/chemicals?${params}`, { headers: h() }).then(r => r.json())
      if (d.success) setChemicals(d.data)
      else setChemicals([])
    } catch(_) { setChemicals([]) }
    finally { setLoading(false) }
  }, [search, filterLow])

  useEffect(() => {
    fetch(`${API}/chemicals/summary`, { headers: h() }).then(r => r.json()).then(d => { if (d.success) setSummary(d.data) }).catch(()=>{})
    fetch(`${API}/chemicals/departments`, { headers: h() }).then(r => r.json()).then(d => { if (d.success) setDepartments(d.data||[]) }).catch(()=>{})
    fetch(`${API}/chemicals/customers`, { headers: h() }).then(r => r.json()).then(d => { if (d.success) setCustomers(d.data||[]) }).catch(()=>{})
  }, [])

  useEffect(() => { fetchChemicals() }, [fetchChemicals])

  const fetchLedger = async (id) => {
    setLedgerLoading(true)
    try {
      const d = await fetch(`${API}/chemicals/${id}/ledger`, { headers: h() }).then(r => r.json())
      if (d.success) setLedger(d.data)
    } finally { setLedgerLoading(false) }
  }

  const selectChem = (c) => {
    setSelected(c)
    setPickForm(f => ({ ...f, materialId: c.id, quantity:'' }))
    setSalesForm(f => ({ ...f, materialId: c.id, quantity:'', unitPrice: c.unitPrice||'' }))
    setRctForm(f => ({ ...f, materialId: c.id, quantity:'', unitPrice: c.unitPrice||'' }))
    if (tab === 4) fetchLedger(c.id)
  }

  const handleTab = (t) => { setTab(t); if (t === 4 && selected) fetchLedger(selected.id) }

  const post = async (url, body) => fetch(`${API}${url}`, { method:'POST', headers:jh(), body:JSON.stringify(body) }).then(r => r.json())

  const submitPick = async (e) => {
    e.preventDefault(); setPickLoading(true); setPickMsg(null)
    const d = await post('/chemicals/pick', { ...pickForm, quantity: Number(pickForm.quantity) }).catch(e => ({ success:false, message:e.message }))
    setPickMsg({ ok: d.success, text: d.success ? `Issued. Ref: ${d.data.issueNo}` : d.message })
    if (d.success) { setPickForm(f => ({ ...f, quantity:'', purpose:'', remarks:'' })); fetchChemicals() }
    setPickLoading(false)
  }

  const submitSales = async (e) => {
    e.preventDefault(); setSalesLoading(true); setSalesMsg(null)
    const d = await post('/chemicals/sales-pick', { ...salesForm, quantity: Number(salesForm.quantity), unitPrice: Number(salesForm.unitPrice)||undefined }).catch(e => ({ success:false, message:e.message }))
    setSalesMsg({ ok: d.success, text: d.success ? `SO created: ${d.data.soNumber}` : d.message })
    if (d.success) { setSalesForm(f => ({ ...f, quantity:'', remarks:'' })); fetchChemicals() }
    setSalesLoading(false)
  }

  const submitRct = async (e) => {
    e.preventDefault(); setRctLoading(true); setRctMsg(null)
    const d = await post('/chemicals/receipt', { ...rctForm, quantity: Number(rctForm.quantity), unitPrice: Number(rctForm.unitPrice)||undefined }).catch(e => ({ success:false, message:e.message }))
    setRctMsg({ ok: d.success, text: d.success ? `Received. Ref: ${d.data.ref}` : d.message })
    if (d.success) { setRctForm(f => ({ ...f, quantity:'', supplierName:'', invoiceNo:'', remarks:'' })); fetchChemicals() }
    setRctLoading(false)
  }

  const stockBar = (c) => {
    const pct = c.maxStock > 0 ? Math.min(100, (c.currentStock / c.maxStock) * 100) : 0
    return (
      <div style={s.bar}>
        <div style={s.barFill(pct, c.lowStock, c.outOfStock)} />
      </div>
    )
  }

  const ChemSelect = ({ value, onChange, required }) => (
    <select style={s.fselect} value={value} onChange={onChange} required={required}>
      <option value="">Select chemical...</option>
      {chemicals.map(c => <option key={c.id} value={c.id}>{c.name} ({fmt(c.currentStock)} {c.uom})</option>)}
    </select>
  )

  return (
    <div style={s.page}>
      {/* ── Left sidebar ── */}
      <div style={s.sidebar}>
        <div style={s.sideHead}>
          <div style={s.title}>⚗️ Chemical Store</div>
          <input style={s.input} placeholder="Search chemical / HSN..." value={search} onChange={e => setSearch(e.target.value)} />
          <label style={{ display:'flex', alignItems:'center', gap:6, marginTop:8, fontSize:12, color:'#8a8a90', cursor:'pointer' }}>
            <input type="checkbox" checked={filterLow} onChange={e => setFilterLow(e.target.checked)} />
            Show low-stock only
          </label>
        </div>

        <div style={s.chemList}>
          {loading ? (
            <div style={s.empty}>Loading...</div>
          ) : chemicals.length === 0 ? (
            <div style={s.empty}>No chemicals found</div>
          ) : chemicals.map(c => (
            <button key={c.id} style={s.chemItem(selected?.id === c.id)} onClick={() => selectChem(c)}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:4 }}>
                <div style={s.chemName}>{c.name}</div>
                {c.criticalityClass && <span style={{ ...s.badge(CRIT_STYLE[c.criticalityClass]||{}), flexShrink:0 }}>{c.criticalityClass}</span>}
              </div>
              <div style={{ display:'flex', justifyContent:'space-between', marginTop:2 }}>
                <span style={s.chemSub}>{c.code} · {c.uom}</span>
                <span style={s.stockVal(c.lowStock, c.outOfStock)}>{fmt(c.currentStock)} {c.uom}</span>
              </div>
              {stockBar(c)}
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, color:'#d8d6cc', marginTop:2 }}>
                <span>Min {fmt(c.minStock)}</span><span>Max {fmt(c.maxStock)}</span>
              </div>
            </button>
          ))}
        </div>

        <div style={s.footer}>
          <div style={s.footCell}><div style={s.footVal()}>{summary.total||0}</div>Total</div>
          <div style={s.footCell}><div style={s.footVal('#d97706')}>{summary.low_stock||0}</div>Low Stock</div>
          <div style={s.footCell}><div style={s.footVal('#dc2626')}>{summary.out_of_stock||0}</div>Out of Stock</div>
        </div>
      </div>

      {/* ── Right main ── */}
      <div style={s.main}>
        <div style={s.tabBar}>
          {TABS.map((t, i) => <button key={i} style={s.tab(tab===i)} onClick={() => handleTab(i)}>{t}</button>)}
        </div>

        <div style={s.content}>

          {/* TAB 0: Stock Board */}
          {tab === 0 && (
            <>
              <div style={s.kpiGrid}>
                {[
                  { label:'Total Chemicals',  val: summary.total||0,              color:'#1b1b1d' },
                  { label:'Inventory Value',  val: fmtCur(summary.total_value),   color:'#059669' },
                  { label:'Class A Critical', val: summary.class_a||0,            color:'#dc2626' },
                  { label:'Adequate Stock',   val: summary.adequate||0,           color:'#16a34a' },
                ].map(k => (
                  <div key={k.label} style={s.kpiCard}>
                    <div style={s.kpiVal(k.color)}>{k.val}</div>
                    <div style={s.kpiLabel}>{k.label}</div>
                  </div>
                ))}
              </div>

              {selected ? (
                <div style={s.detCard}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                    <div>
                      <div style={{ fontWeight:700, fontSize:15, color:'#1b1b1d' }}>{selected.name}</div>
                      <div style={{ fontSize:11, color:'#a0a0a6', marginTop:2 }}>{selected.code} · HSN {selected.hsn_code||selected.hsnCode||'—'}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {selected.criticalityClass && (
                        <span style={s.badge(CRIT_STYLE[selected.criticalityClass]||{})}>
                          {CRIT_STYLE[selected.criticalityClass]?.label||selected.criticalityClass}
                        </span>
                      )}
                      <button
                        onClick={() => setSelectedProductModalId(selected.id)}
                        style={{ background: '#0f172a', color: '#fff', border: 'none', borderRadius: 6, padding: '5px 12px', fontSize: 11.5, fontWeight: 700, cursor: 'pointer' }}
                        title="Open Full Product Specification & Ledger Form"
                      >
                        📄 Product Form
                      </button>
                    </div>
                  </div>
                  <div style={s.detGrid}>
                    {[
                      ['Current Stock', `${fmt(selected.currentStock)} ${selected.uom}`],
                      ['Min Stock',     `${fmt(selected.minStock)} ${selected.uom}`],
                      ['Max Stock',     `${fmt(selected.maxStock)} ${selected.uom}`],
                      ['Unit Price',    fmtCur(selected.unitPrice)],
                      ['Stock Value',   fmtCur(selected.stockValue)],
                      ['Reorder Buffer',`${fmt(selected.reorderBuffer)} ${selected.uom}`],
                      ['Section',       selected.sectionContext||'—'],
                      ['OEM Supplier',  selected.oemSupplier||'—'],
                      ['Procurement',   selected.procurementStrategy||'—'],
                      ['Audit Cycle',   selected.lastAuditCycle||'—'],
                      ['Calibration',   selected.calibrationProtocol||'—'],
                    ].map(([k,v]) => (
                      <div key={k} style={s.detCell}>
                        <div style={s.detKey}>{k}</div>
                        <div style={s.detVal}>{v}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div style={{ ...s.detCard, ...s.empty }}>Select a chemical from the left to view details</div>
              )}
            </>
          )}

          {/* TAB 1: Pick / Issue */}
          {tab === 1 && (
            <div>
              <div style={{ fontWeight:600, fontSize:14, color:'#1b1b1d', marginBottom:12 }}>Issue Chemical — Internal Production Use</div>
              {pickMsg && <div style={s.msg(pickMsg.ok)}>{pickMsg.text}</div>}
              <form onSubmit={submitPick} style={s.form}>
                <label style={s.label}>Chemical *</label>
                <ChemSelect value={pickForm.materialId} onChange={e => setPickForm(f=>({...f,materialId:e.target.value}))} required />
                {pickForm.materialId && (() => {
                  const chem = chemicals.find(c => String(c.id) === String(pickForm.materialId))
                  if (!chem) return null
                  const over = Number(pickForm.quantity || 0) > Number(chem.currentStock || 0)
                  return (
                    <div style={{ fontSize: 11.5, fontWeight: 600, color: over ? '#dc2626' : '#166534', background: over ? '#fef2f2' : '#f0fdf4', padding: '6px 10px', borderRadius: 6, marginBottom: 10 }}>
                      Stock Available: {fmt(chem.currentStock)} {chem.uom} {over && '⚠️ Exceeds stock!'}
                    </div>
                  )
                })()}
                <div style={s.grid2}>
                  <div>
                    <label style={s.label}>Quantity *</label>
                    <input type="number" min="0.001" step="0.001" required style={s.finput} placeholder="0" value={pickForm.quantity} onChange={e=>setPickForm(f=>({...f,quantity:e.target.value}))} />
                  </div>
                  <div>
                    <label style={s.label}>Department *</label>
                    <select style={s.fselect} value={pickForm.departmentId} onChange={e=>setPickForm(f=>({...f,departmentId:e.target.value}))} required>
                      <option value="">Select department...</option>
                      {departments.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                  </div>
                </div>
                <label style={s.label}>Section / Machine</label>
                <input type="text" style={s.finput} placeholder="e.g. Wet-End, Boiler, ETP..." value={pickForm.section} onChange={e=>setPickForm(f=>({...f,section:e.target.value}))} />
                <label style={s.label}>Purpose *</label>
                <input type="text" required style={s.finput} placeholder="e.g. Retention aid dosing..." value={pickForm.purpose} onChange={e=>setPickForm(f=>({...f,purpose:e.target.value}))} />
                <label style={s.label}>Remarks</label>
                <textarea rows={2} style={s.ftextarea} placeholder="Optional notes..." value={pickForm.remarks} onChange={e=>setPickForm(f=>({...f,remarks:e.target.value}))} />
                <button type="submit" disabled={pickLoading} style={s.btn('#1b1b1d')}>{pickLoading?'Issuing...':'Issue Chemical'}</button>
              </form>
            </div>
          )}

          {/* TAB 2: Sales Pick */}
          {tab === 2 && (
            <div>
              <div style={{ fontWeight:600, fontSize:14, color:'#1b1b1d', marginBottom:12 }}>Chemical Sales — Pick for Invoice</div>
              {salesMsg && <div style={s.msg(salesMsg.ok)}>{salesMsg.text}</div>}
              <form onSubmit={submitSales} style={s.form}>
                <label style={s.label}>Chemical *</label>
                <ChemSelect value={salesForm.materialId} onChange={e=>{const c=chemicals.find(x=>x.id==e.target.value);setSalesForm(f=>({...f,materialId:e.target.value,unitPrice:c?.unitPrice||''}))}} required />
                {salesForm.materialId && (() => {
                  const chem = chemicals.find(c => String(c.id) === String(salesForm.materialId))
                  if (!chem) return null
                  const over = Number(salesForm.quantity || 0) > Number(chem.currentStock || 0)
                  return (
                    <div style={{ fontSize: 11.5, fontWeight: 600, color: over ? '#dc2626' : '#166534', background: over ? '#fef2f2' : '#f0fdf4', padding: '6px 10px', borderRadius: 6, marginBottom: 10 }}>
                      Stock Available: {fmt(chem.currentStock)} {chem.uom} {over && '⚠️ Exceeds stock!'}
                    </div>
                  )
                })()}
                <div style={s.grid2}>
                  <div>
                    <label style={s.label}>Quantity *</label>
                    <input type="number" min="0.001" step="0.001" required style={s.finput} placeholder="0" value={salesForm.quantity} onChange={e=>setSalesForm(f=>({...f,quantity:e.target.value}))} />
                  </div>
                  <div>
                    <label style={s.label}>Sale Price (₹/unit)</label>
                    <input type="number" min="0" step="0.01" style={s.finput} placeholder="Blank = cost price" value={salesForm.unitPrice} onChange={e=>setSalesForm(f=>({...f,unitPrice:e.target.value}))} />
                  </div>
                </div>
                <label style={s.label}>Customer *</label>
                <select style={s.fselect} value={salesForm.customerId} onChange={e=>setSalesForm(f=>({...f,customerId:e.target.value}))} required>
                  <option value="">Select customer...</option>
                  {customers.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <label style={s.label}>Remarks</label>
                <textarea rows={2} style={s.ftextarea} placeholder="Notes for invoice..." value={salesForm.remarks} onChange={e=>setSalesForm(f=>({...f,remarks:e.target.value}))} />
                {salesForm.materialId && salesForm.quantity && (
                  <div style={{ background:'#eff6ff', color:'#1b1b1d', padding:'8px 12px', borderRadius:6, fontSize:12, marginBottom:12 }}>
                    Line total: {fmtCur((Number(salesForm.unitPrice)||chemicals.find(c=>c.id==salesForm.materialId)?.unitPrice||0)*salesForm.quantity)}
                  </div>
                )}
                <button type="submit" disabled={salesLoading} style={s.btn('#059669')}>{salesLoading?'Creating...':'Create Sales Pick'}</button>
              </form>
            </div>
          )}

          {/* TAB 3: Receive Stock */}
          {tab === 3 && (
            <div>
              <div style={{ fontWeight:600, fontSize:14, color:'#1b1b1d', marginBottom:12 }}>Receive Chemical Stock</div>
              {rctMsg && <div style={s.msg(rctMsg.ok)}>{rctMsg.text}</div>}
              <form onSubmit={submitRct} style={s.form}>
                <label style={s.label}>Chemical *</label>
                <ChemSelect value={rctForm.materialId} onChange={e=>setRctForm(f=>({...f,materialId:e.target.value}))} required />
                <div style={s.grid2}>
                  <div>
                    <label style={s.label}>Quantity *</label>
                    <input type="number" min="0.001" step="0.001" required style={s.finput} placeholder="0" value={rctForm.quantity} onChange={e=>setRctForm(f=>({...f,quantity:e.target.value}))} />
                  </div>
                  <div>
                    <label style={s.label}>Unit Price (₹)</label>
                    <input type="number" min="0" step="0.01" style={s.finput} placeholder="Blank = existing price" value={rctForm.unitPrice} onChange={e=>setRctForm(f=>({...f,unitPrice:e.target.value}))} />
                  </div>
                </div>
                <div style={s.grid2}>
                  <div>
                    <label style={s.label}>Supplier Name</label>
                    <input type="text" style={s.finput} placeholder="Supplier..." value={rctForm.supplierName} onChange={e=>setRctForm(f=>({...f,supplierName:e.target.value}))} />
                  </div>
                  <div>
                    <label style={s.label}>Invoice / DC No.</label>
                    <input type="text" style={s.finput} placeholder="Invoice number..." value={rctForm.invoiceNo} onChange={e=>setRctForm(f=>({...f,invoiceNo:e.target.value}))} />
                  </div>
                </div>
                <label style={s.label}>Remarks</label>
                <textarea rows={2} style={s.ftextarea} placeholder="Optional notes..." value={rctForm.remarks} onChange={e=>setRctForm(f=>({...f,remarks:e.target.value}))} />
                <button type="submit" disabled={rctLoading} style={s.btn('#1b1b1d')}>{rctLoading?'Receiving...':'Receive Stock'}</button>
              </form>
            </div>
          )}

          {/* TAB 4: Ledger */}
          {tab === 4 && (
            <div>
              <div style={{ fontWeight:600, fontSize:14, color:'#1b1b1d', marginBottom:12 }}>
                Stock Ledger {selected ? `— ${selected.name}` : ''}
              </div>
              {!selected ? (
                <div style={s.empty}>Select a chemical from the left first</div>
              ) : ledgerLoading ? (
                <div style={s.empty}>Loading...</div>
              ) : ledger.length === 0 ? (
                <div style={s.empty}>No transactions yet</div>
              ) : (
                <div style={{ background:'#fff', border:'1px solid #ecebe5', borderRadius:8, overflowX:'auto' }}>
                  <table style={s.table}>
                    <thead>
                      <tr>{['Date','Type','In','Out','Balance','Price','Ref','Remarks','By'].map(h=>(
                        <th key={h} style={s.th}>{h}</th>
                      ))}</tr>
                    </thead>
                    <tbody>
                      {ledger.map(r => {
                        const isIn = parseFloat(r.inQty) > 0
                        return (
                          <tr key={r.id} style={{ background:'#fff' }}>
                            <td style={s.td}>{r.date ? new Date(r.date).toLocaleDateString('en-IN') : '—'}</td>
                            <td style={s.td}>
                              <span style={{ fontSize:10, padding:'2px 8px', borderRadius:999, fontWeight:600, background: isIn?'#dcfce7':'#fee2e2', color: isIn?'#166534':'#dc2626' }}>
                                {r.type}
                              </span>
                            </td>
                            <td style={{ ...s.td, fontWeight:600, color:'#16a34a' }}>{parseFloat(r.inQty)>0 ? `+${fmt(r.inQty)}` : '—'}</td>
                            <td style={{ ...s.td, fontWeight:600, color:'#dc2626' }}>{parseFloat(r.outQty)>0 ? `-${fmt(r.outQty)}` : '—'}</td>
                            <td style={{ ...s.td, fontWeight:600, color:'#1b1b1d' }}>{fmt(r.balance)}</td>
                            <td style={s.td}>{fmtCur(r.price)}</td>
                            <td style={{ ...s.td, fontSize:10, color:'#a0a0a6' }}>{r.refType||'—'}</td>
                            <td style={{ ...s.td, maxWidth:160, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{r.remarks||'—'}</td>
                            <td style={s.td}>{r.createdBy||'—'}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── UNIFIED PRODUCT SPECIFICATION & STOCK LEDGER MODAL ── */}
      <ProductDetailModal
        materialId={selectedProductModalId}
        isOpen={!!selectedProductModalId}
        onClose={() => setSelectedProductModalId(null)}
        onUpdated={fetchChemicals}
      />
    </div>
  )
}
