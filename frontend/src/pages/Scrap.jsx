import React, { useState, useEffect } from 'react'
const API = '/api'
const h = () => ({ Authorization: `Bearer ${localStorage.getItem('mk_token')}` })
const TYPES = ['Paper Scrap','Metal Scrap','Plastic','Chemical Waste','Wood','Others']
const METHODS = ['Sale','Recycle','Dispose','Reuse']

export default function Scrap() {
  const [records, setRecords] = useState([])
  const [depts, setDepts] = useState([])
  const [modal, setModal] = useState(false)
  const [editRow, setEditRow] = useState(null)
  const [form, setForm] = useState({ scrapType:'', sourceDepartmentId:'', quantityKg:'', description:'', disposalMethod:'', buyerName:'', saleAmount:'', remarks:'' })
  const [msg, setMsg] = useState('')
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    const [r1, r2] = await Promise.all([
      fetch(`${API}/scrap`, { headers: h() }),
      fetch(`${API}/ehs/departments`, { headers: h() }),
    ])
    setRecords((await r1.json()).data || [])
    setDepts((await r2.json()).data || [])
  }

  async function submit() {
    const url = editRow ? `${API}/scrap/${editRow.id}` : `${API}/scrap`
    const method = editRow ? 'PUT' : 'POST'
    const r = await fetch(url, { method, headers: { ...h(), 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    const d = await r.json()
    if (d.success) { setModal(false); setEditRow(null); resetForm(); load() }
    else setMsg(d.message)
  }

  function openEdit(row) {
    setEditRow(row)
    setForm({ scrapType: row.scrap_type||'', sourceDepartmentId: row.source_department_id||'', quantityKg: row.quantity_kg||'', description: row.description||'', disposalMethod: row.disposal_method||'', buyerName: row.buyer_name||'', saleAmount: row.sale_amount||'', remarks: row.remarks||'' })
    setMsg('')
    setModal(true)
  }

  function resetForm() { setForm({ scrapType:'', sourceDepartmentId:'', quantityKg:'', description:'', disposalMethod:'', buyerName:'', saleAmount:'', remarks:'' }) }

  const totalKg = records.reduce((s,r) => s + parseFloat(r.quantity_kg||0), 0)
  const totalSale = records.reduce((s,r) => s + parseFloat(r.sale_amount||0), 0)

  const q = searchTerm.toLowerCase()
  const fRec = records.filter(r => !q || (r.scrap_number||'').toLowerCase().includes(q) || (r.scrap_type||'').toLowerCase().includes(q) || (r.departmentName||'').toLowerCase().includes(q))

  return (
    <div style={S.page}>
      <div style={S.hdr}>
        <div>
          <div style={S.title}>Scrap Management</div>
          <div style={S.sub}>{records.length} records · {totalKg.toLocaleString('en-IN')} kg total</div>
        </div>
        <button style={S.btn} onClick={() => { resetForm(); setEditRow(null); setMsg(''); setModal(true) }}>+ Add Scrap Record</button>
      </div>

      <div style={S.kpis}>
        {[['Total Records', records.length, '#1b1b1d'], ['Total Weight (kg)', totalKg.toLocaleString('en-IN'), '#1b1b1d'], ['Sale Revenue', `₹${totalSale.toLocaleString('en-IN')}`, '#16a34a'], ['Pending', records.filter(r=>r.status==='Pending').length, '#d97706']].map(([l,v,c]) => (
          <div key={l} style={S.kpi}><div style={{ ...S.kpiVal, color: c }}>{v}</div><div style={S.kpiLbl}>{l}</div></div>
        ))}
      </div>

      <div style={{ marginBottom: 16 }}>
        <input style={{...S.input, maxWidth: 300, background: '#fff'}} placeholder='Search scrap records...' value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} />
      </div>

      <table style={S.tbl}>
        <thead><tr>{['Scrap No','Date','Type','Dept','Qty (kg)','Method','Buyer','Sale Amt','Status',''].map(c=><th key={c} style={S.th}>{c}</th>)}</tr></thead>
        <tbody>
          {fRec.map(r => (
            <tr key={r.id}>
              <td style={S.td}><b>{r.scrap_number}</b></td>
              <td style={S.td}>{new Date(r.date).toLocaleDateString('en-IN')}</td>
              <td style={S.td}>{r.scrap_type}</td>
              <td style={S.td}>{r.departmentName}</td>
              <td style={S.td}>{Number(r.quantity_kg).toLocaleString('en-IN')}</td>
              <td style={S.td}>{r.disposal_method}</td>
              <td style={S.td}>{r.buyer_name||'—'}</td>
              <td style={S.td}>{r.sale_amount > 0 ? `₹${Number(r.sale_amount).toLocaleString('en-IN')}` : '—'}</td>
              <td style={S.td}><span style={{ ...S.badge, background: r.status==='Sold'?'#dcfce7':r.status==='Disposed'?'#e0e7ff':'#fef9c3', color: r.status==='Sold'?'#15803d':r.status==='Disposed'?'#1b1b1d':'#854d0e' }}>{r.status}</span></td>
              <td style={S.td}><button style={S.btnSm} onClick={() => openEdit(r)}>Edit</button></td>
            </tr>
          ))}
          {!fRec.length && <tr><td colSpan={10} style={{ textAlign:'center', padding:32, color:'#a0a0a6' }}>No scrap records</td></tr>}
        </tbody>
      </table>

      {modal && (
        <div style={S.overlay}>
          <div style={S.modal}>
            <div style={S.modalHdr}><b>{editRow ? 'Edit Scrap Record' : 'Add Scrap Record'}</b><button style={S.x} onClick={() => setModal(false)}>✕</button></div>
            {msg && <div style={S.err}>{msg}</div>}
            <div style={S.row2}>
              <select style={S.input} value={form.scrapType} onChange={e => setForm({...form, scrapType: e.target.value})}>
                <option value=''>Scrap Type *</option>
                {TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
              <select style={S.input} value={form.sourceDepartmentId} onChange={e => setForm({...form, sourceDepartmentId: e.target.value})}>
                <option value=''>Source Dept</option>
                {depts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div style={S.row2}>
              <input style={S.input} type='number' placeholder='Quantity (kg) *' value={form.quantityKg} onChange={e => setForm({...form, quantityKg: e.target.value})} />
              <select style={S.input} value={form.disposalMethod} onChange={e => setForm({...form, disposalMethod: e.target.value})}>
                <option value=''>Disposal Method</option>
                {METHODS.map(m => <option key={m}>{m}</option>)}
              </select>
            </div>
            <div style={S.row2}>
              <input style={S.input} placeholder='Buyer Name' value={form.buyerName} onChange={e => setForm({...form, buyerName: e.target.value})} />
              <input style={S.input} type='number' placeholder='Sale Amount (₹)' value={form.saleAmount} onChange={e => setForm({...form, saleAmount: e.target.value})} />
            </div>
            {editRow && <select style={S.input} value={form.status||''} onChange={e => setForm({...form, status: e.target.value})}>
              <option value=''>Status</option>
              {['Pending','Disposed','Sold'].map(s => <option key={s}>{s}</option>)}
            </select>}
            <textarea style={{ ...S.input, height: 60 }} placeholder='Description / Remarks' value={form.description||form.remarks} onChange={e => setForm({...form, description: e.target.value, remarks: e.target.value})} />
            <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
              <button style={S.btnGhost} onClick={() => setModal(false)}>Cancel</button>
              <button style={S.btn} onClick={submit}>{editRow ? 'Update' : 'Save'}</button>
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
  kpis: { display: 'flex', gap: 12, marginBottom: 20 },
  kpi: { background: 'white', borderRadius: 10, padding: '14px 20px', flex: 1, boxShadow: '0 1px 4px rgba(0,0,0,0.07)' },
  kpiVal: { fontSize: 26, fontWeight: 700 },
  kpiLbl: { fontSize: 12, color: '#8a8a90', marginTop: 2 },
  tbl: { width: '100%', borderCollapse: 'collapse', background: 'white', borderRadius: 10, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.07)' },
  th: { padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#8a8a90', textTransform: 'uppercase', background: '#f6f5f0', borderBottom: '1px solid #ecebe5' },
  td: { padding: '10px 14px', fontSize: 13, color: '#1b1b1d', borderBottom: '1px solid #f6f5f0', verticalAlign: 'middle' },
  badge: { fontSize: 11, padding: '2px 8px', borderRadius: 999, fontWeight: 600 },
  btn: { background: '#1b1b1d', color: 'white', border: 'none', borderRadius: 8, padding: '8px 16px', cursor: 'pointer', fontSize: 13, fontWeight: 600 },
  btnSm: { background: '#e0e7ff', color: '#1b1b1d', border: 'none', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 12 },
  btnGhost: { background: 'white', color: '#3a3a3e', border: '1px solid #d8d6cc', borderRadius: 8, padding: '8px 16px', cursor: 'pointer', fontSize: 13 },
  row2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modal: { background: 'white', borderRadius: 12, padding: 24, width: 520, display: 'flex', flexDirection: 'column', gap: 12 },
  modalHdr: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  x: { background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#8a8a90' },
  input: { width: '100%', padding: '8px 12px', border: '1px solid #d8d6cc', borderRadius: 8, fontSize: 13, boxSizing: 'border-box' },
  err: { background: '#fee2e2', color: '#dc2626', padding: '8px 12px', borderRadius: 6, fontSize: 13 },
}
