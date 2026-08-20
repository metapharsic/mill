import React, { useState, useEffect } from 'react'
const API = '/api'
const h = () => ({ Authorization: `Bearer ${localStorage.getItem('mk_token')}` })

export default function Packing() {
  const [records, setRecords] = useState([])
  const [reels, setReels] = useState([])
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({ reelId:'', packingType:'Single', wrapMaterial:'HDPE', netWeightKg:'', grossWeightKg:'', remarks:'' })
  const [msg, setMsg] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [reelSearch, setReelSearch] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    const [r1, r2] = await Promise.all([
      fetch(`${API}/warehouse/packing`, { headers: h() }),
      fetch(`${API}/warehouse/reels`, { headers: h() }),
    ])
    setRecords((await r1.json()).data || [])
    setReels((await r2.json()).data || [])
  }

  async function submit() {
    const r = await fetch(`${API}/warehouse/packing`, { method: 'POST', headers: { ...h(), 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    const d = await r.json()
    if (d.success) { setModal(false); setForm({ reelId:'', packingType:'Single', wrapMaterial:'HDPE', netWeightKg:'', grossWeightKg:'', remarks:'' }); load() }
    else setMsg(d.message)
  }

  async function markLabel(id) {
    await fetch(`${API}/warehouse/packing/${id}/label`, { method: 'PUT', headers: h() })
    load()
  }

  return (
    <div style={S.page}>
      <div style={S.hdr}>
        <div>
          <div style={S.title}>Packing</div>
          <div style={S.sub}>{records.length} packing records · {reels.length} reels in warehouse</div>
        </div>
        <button style={S.btn} onClick={() => { setMsg(''); setModal(true) }}>+ Pack Reel</button>
      </div>

      <div style={S.kpis}>
        {[
          ['Packed Today', records.filter(r => new Date(r.created_at).toDateString()===new Date().toDateString()).length, '#1b1b1d'],
          ['Labels Printed', records.filter(r=>r.label_printed).length, '#16a34a'],
          ['Pending Label', records.filter(r=>!r.label_printed).length, '#d97706'],
          ['Warehouse Reels', reels.length, '#1b1b1d'],
        ].map(([l,v,c]) => (
          <div key={l} style={S.kpi}><div style={{ ...S.kpiVal, color: c }}>{v}</div><div style={S.kpiLbl}>{l}</div></div>
        ))}
      </div>

      <div style={{ padding: 16, borderBottom: '1px solid #e7e6df', background: 'white', borderTopLeftRadius: 10, borderTopRightRadius: 10 }}>
        <input style={{...S.input, maxWidth: 300, background: '#fff'}} placeholder='Search packing records...' value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} />
      </div>
      <table style={{...S.tbl, borderTopLeftRadius: 0, borderTopRightRadius: 0}}>
        <thead><tr>{['Pack No','Date','Reel No','Grade','Type','Wrap','Net Wt','Gross Wt','Label',''].map(c=><th key={c} style={S.th}>{c}</th>)}</tr></thead>
        <tbody>
          {records.filter(r => !searchTerm || (r.pack_number||'').toLowerCase().includes(searchTerm.toLowerCase()) || (r.reel_number||'').toLowerCase().includes(searchTerm.toLowerCase())).length===0 && <tr><td colSpan={10} style={{ textAlign:'center', padding:32, color:'#a0a0a6' }}>No packing records</td></tr>}
          {records.filter(r => !searchTerm || (r.pack_number||'').toLowerCase().includes(searchTerm.toLowerCase()) || (r.reel_number||'').toLowerCase().includes(searchTerm.toLowerCase())).map(r => (
            <tr key={r.id}>
              <td style={S.td}><b>{r.pack_number}</b></td>
              <td style={S.td}>{new Date(r.date).toLocaleDateString('en-IN')}</td>
              <td style={S.td}>{r.reel_number}</td>
              <td style={S.td}>{r.gradename}</td>
              <td style={S.td}>{r.packing_type}</td>
              <td style={S.td}>{r.wrap_material}</td>
              <td style={S.td}>{r.net_weight_kg} kg</td>
              <td style={S.td}>{r.gross_weight_kg} kg</td>
              <td style={S.td}><span style={{ ...S.badge, background: r.label_printed?'#dcfce7':'#fef9c3', color: r.label_printed?'#15803d':'#854d0e' }}>{r.label_printed?'Printed':'Pending'}</span></td>
              <td style={S.td}>{!r.label_printed && <button style={S.btnSm} onClick={() => markLabel(r.id)}>Print Label</button>}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {modal && (
        <div style={S.overlay}>
          <div style={S.modal}>
            <div style={S.modalHdr}><b>Pack Reel</b><button style={S.x} onClick={() => setModal(false)}>✕</button></div>
            {msg && <div style={S.err}>{msg}</div>}
            <input style={{...S.input, marginBottom: 4, background:'#fefce8'}} placeholder='🔍 Filter reels...' value={reelSearch} onChange={e => setReelSearch(e.target.value)} />
            <select style={S.input} value={form.reelId} onChange={e => setForm({...form, reelId: e.target.value})}>
              <option value=''>Select Reel *</option>
              {reels.filter(r => !reelSearch || (r.reel_number||'').toLowerCase().includes(reelSearch.toLowerCase()) || (r.gradename||'').toLowerCase().includes(reelSearch.toLowerCase())).map(r => <option key={r.id} value={r.id}>{r.reel_number} — {r.gradename} — {r.net_weight_kg || r.weight_kg || 0}kg</option>)}
            </select>
            <div style={S.row2}>
              <select style={S.input} value={form.packingType} onChange={e => setForm({...form, packingType: e.target.value})}>
                {['Single','Bundle','Pallet'].map(t => <option key={t}>{t}</option>)}
              </select>
              <select style={S.input} value={form.wrapMaterial} onChange={e => setForm({...form, wrapMaterial: e.target.value})}>
                {['HDPE','Kraft','Stretch Film','None'].map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div style={S.row2}>
              <input style={S.input} type='number' placeholder='Net Weight (kg)' value={form.netWeightKg} onChange={e => setForm({...form, netWeightKg: e.target.value})} />
              <input style={S.input} type='number' placeholder='Gross Weight (kg)' value={form.grossWeightKg} onChange={e => setForm({...form, grossWeightKg: e.target.value})} />
            </div>
            <textarea style={{ ...S.input, height: 60 }} placeholder='Remarks' value={form.remarks} onChange={e => setForm({...form, remarks: e.target.value})} />
            <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
              <button style={S.btnGhost} onClick={() => setModal(false)}>Cancel</button>
              <button style={S.btn} onClick={submit}>Save Packing Record</button>
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
  row2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 },
  btn: { background: '#1b1b1d', color: 'white', border: 'none', borderRadius: 8, padding: '8px 16px', cursor: 'pointer', fontSize: 13, fontWeight: 600 },
  btnSm: { background: '#e0e7ff', color: '#1b1b1d', border: 'none', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 12 },
  btnGhost: { background: 'white', color: '#3a3a3e', border: '1px solid #d8d6cc', borderRadius: 8, padding: '8px 16px', cursor: 'pointer', fontSize: 13 },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modal: { background: 'white', borderRadius: 12, padding: 24, width: 480, display: 'flex', flexDirection: 'column', gap: 12 },
  modalHdr: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  x: { background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#8a8a90' },
  input: { width: '100%', padding: '8px 12px', border: '1px solid #d8d6cc', borderRadius: 8, fontSize: 13, boxSizing: 'border-box' },
  err: { background: '#fee2e2', color: '#dc2626', padding: '8px 12px', borderRadius: 6, fontSize: 13 },
}
