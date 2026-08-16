import React, { useState, useEffect } from 'react'
const API = '/api'
const h = () => ({ Authorization: `Bearer ${localStorage.getItem('mk_token')}` })
const TYPES = ['Raw Material','In-Process','Finished Goods','Water','Chemical','Others']

export default function Laboratory() {
  const [samples, setSamples] = useState([])
  const [summary, setSummary] = useState({})
  const [modal, setModal] = useState(false)
  const [detail, setDetail] = useState(null)
  const [filter, setFilter] = useState({ sampleType: '', result: '' })
  const [form, setForm] = useState({ sampleType:'', sourceRef:'', brightness:'', opacity:'', phValue:'', ashContent:'', moisture:'', cod:'', bod:'', tss:'', phWater:'', concentration:'', purity:'', remarks:'' })
  const [msg, setMsg] = useState('')
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => { load() }, [filter])

  async function load() {
    const params = new URLSearchParams(Object.fromEntries(Object.entries(filter).filter(([,v])=>v))).toString()
    const r = await fetch(`${API}/laboratory/samples?${params}`, { headers: h() })
    const d = await r.json()
    setSamples(d.data || [])
    setSummary(d.summary || {})
  }

  async function submit() {
    const r = await fetch(`${API}/laboratory/samples`, { method: 'POST', headers: { ...h(), 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    const d = await r.json()
    if (d.success) { setModal(false); resetForm(); load() }
    else setMsg(d.message)
  }

  async function setResult(id, result) {
    await fetch(`${API}/laboratory/samples/${id}/result`, { method: 'PUT', headers: { ...h(), 'Content-Type': 'application/json' }, body: JSON.stringify({ result }) })
    setDetail(null)
    load()
  }

  function resetForm() { setForm({ sampleType:'', sourceRef:'', brightness:'', opacity:'', phValue:'', ashContent:'', moisture:'', cod:'', bod:'', tss:'', phWater:'', concentration:'', purity:'', remarks:'' }) }

  return (
    <div style={S.page}>
      <div style={S.hdr}>
        <div>
          <div style={S.title}>Laboratory</div>
          <div style={S.sub}>Sample analysis & test records</div>
        </div>
        <button style={S.btn} onClick={() => { resetForm(); setMsg(''); setModal(true) }}>+ Log Sample</button>
      </div>

      <div style={S.kpis}>
        {[
          ['Total Samples', summary.total||0, '#1b1b1d'],
          ['Pending', summary.pending||0, '#d97706'],
          ['Pass', summary.passed||0, '#16a34a'],
          ['Fail', summary.failed||0, '#dc2626'],
        ].map(([l,v,c]) => (
          <div key={l} style={S.kpi}><div style={{ ...S.kpiVal, color: c }}>{v}</div><div style={S.kpiLbl}>{l}</div></div>
        ))}
      </div>

      <div style={{ display:'flex', gap:8, marginBottom:12 }}>
        <input style={{...S.sel, width:200, background: '#fff'}} placeholder='Search samples...' value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} />
        <select style={S.sel} value={filter.sampleType} onChange={e => setFilter({...filter, sampleType: e.target.value})}>
          <option value=''>All Types</option>
          {TYPES.map(t => <option key={t}>{t}</option>)}
        </select>
        <select style={S.sel} value={filter.result} onChange={e => setFilter({...filter, result: e.target.value})}>
          <option value=''>All Results</option>
          {['Pending','Pass','Fail'].map(r => <option key={r}>{r}</option>)}
        </select>
      </div>

      <table style={S.tbl}>
        <thead><tr>{['Sample No','Date','Type','Source Ref','Collected By','Result','Actions'].map(c=><th key={c} style={S.th}>{c}</th>)}</tr></thead>
        <tbody>
          {samples.filter(s => !searchTerm || (s.sample_number||'').toLowerCase().includes(searchTerm.toLowerCase()) || (s.source_ref||'').toLowerCase().includes(searchTerm.toLowerCase())).map(s => (
            <tr key={s.id}>
              <td style={S.td}><b>{s.sample_number}</b></td>
              <td style={S.td}>{new Date(s.date).toLocaleDateString('en-IN')}</td>
              <td style={S.td}>{s.sample_type}</td>
              <td style={S.td}>{s.source_ref||'—'}</td>
              <td style={S.td}>{s.collectedByName}</td>
              <td style={S.td}><span style={{ ...S.badge, background: s.result==='Pass'?'#dcfce7':s.result==='Fail'?'#fee2e2':'#fef9c3', color: s.result==='Pass'?'#15803d':s.result==='Fail'?'#dc2626':'#854d0e' }}>{s.result}</span></td>
              <td style={S.td}>
                <button style={{ ...S.btnSm, marginRight:4 }} onClick={() => setDetail(s)}>View</button>
                {s.result==='Pending' && <>
                  <button style={{ ...S.btnSm, background:'#dcfce7', color:'#15803d', marginRight:4 }} onClick={() => setResult(s.id,'Pass')}>Pass</button>
                  <button style={{ ...S.btnSm, background:'#fee2e2', color:'#dc2626' }} onClick={() => setResult(s.id,'Fail')}>Fail</button>
                </>}
              </td>
            </tr>
          ))}
          {samples.filter(s => !searchTerm || (s.sample_number||'').toLowerCase().includes(searchTerm.toLowerCase()) || (s.source_ref||'').toLowerCase().includes(searchTerm.toLowerCase())).length===0 && <tr><td colSpan={7} style={{ textAlign:'center', padding:32, color:'#a0a0a6' }}>No samples found</td></tr>}
        </tbody>
      </table>

      {modal && (
        <div style={S.overlay}>
          <div style={{ ...S.modal, width: 580, maxHeight: '85vh', overflowY: 'auto' }}>
            <div style={S.modalHdr}><b>Log Lab Sample</b><button style={S.x} onClick={() => setModal(false)}>✕</button></div>
            {msg && <div style={S.err}>{msg}</div>}
            <div style={S.row2}>
              <select style={S.input} value={form.sampleType} onChange={e => setForm({...form, sampleType: e.target.value})}>
                <option value=''>Sample Type *</option>
                {TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
              <input style={S.input} placeholder='Source Ref (Reel/GRN/Batch)' value={form.sourceRef} onChange={e => setForm({...form, sourceRef: e.target.value})} />
            </div>
            <div style={S.section}>📄 Paper Parameters</div>
            <div style={S.row3}>
              {[['brightness','Brightness %'],['opacity','Opacity %'],['phValue','pH Value'],['ashContent','Ash Content %'],['moisture','Moisture %']].map(([k,l]) => (
                <input key={k} style={S.input} type='number' placeholder={l} value={form[k]} onChange={e => setForm({...form, [k]: e.target.value})} />
              ))}
            </div>
            <div style={S.section}>💧 Water / ETP</div>
            <div style={S.row3}>
              {[['cod','COD mg/L'],['bod','BOD mg/L'],['tss','TSS mg/L'],['phWater','pH (Water)']].map(([k,l]) => (
                <input key={k} style={S.input} type='number' placeholder={l} value={form[k]} onChange={e => setForm({...form, [k]: e.target.value})} />
              ))}
            </div>
            <div style={S.section}>🧪 Chemical</div>
            <div style={S.row2}>
              <input style={S.input} type='number' placeholder='Concentration' value={form.concentration} onChange={e => setForm({...form, concentration: e.target.value})} />
              <input style={S.input} type='number' placeholder='Purity %' value={form.purity} onChange={e => setForm({...form, purity: e.target.value})} />
            </div>
            <textarea style={{ ...S.input, height: 60 }} placeholder='Remarks' value={form.remarks} onChange={e => setForm({...form, remarks: e.target.value})} />
            <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
              <button style={S.btnGhost} onClick={() => setModal(false)}>Cancel</button>
              <button style={S.btn} onClick={submit}>Save Sample</button>
            </div>
          </div>
        </div>
      )}

      {detail && (
        <div style={S.overlay}>
          <div style={{ ...S.modal, width: 500, maxHeight: '80vh', overflowY: 'auto' }}>
            <div style={S.modalHdr}><b>{detail.sample_number}</b><button style={S.x} onClick={() => setDetail(null)}>✕</button></div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, fontSize:13 }}>
              {[['Type',detail.sample_type],['Source',detail.source_ref],['Date',new Date(detail.date).toLocaleDateString('en-IN')],
                ['Brightness',detail.brightness],['Opacity',detail.opacity],['pH',detail.ph_value],
                ['Ash %',detail.ash_content],['Moisture %',detail.moisture],
                ['COD',detail.cod],['BOD',detail.bod],['TSS',detail.tss],['pH Water',detail.ph_water],
                ['Concentration',detail.concentration],['Purity %',detail.purity],
              ].map(([l,v]) => v!=null && v!=='' ? (
                <div key={l}><span style={{ color:'#8a8a90' }}>{l}: </span><b>{v}</b></div>
              ) : null)}
            </div>
            {detail.remarks && <div style={{ fontSize:13, color:'#8a8a90', marginTop:8 }}>Remarks: {detail.remarks}</div>}
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
  sel: { padding: '7px 12px', border: '1px solid #d8d6cc', borderRadius: 8, fontSize: 13 },
  section: { fontWeight: 600, fontSize: 12, color: '#3a3a3e', padding: '4px 0' },
  tbl: { width: '100%', borderCollapse: 'collapse', background: 'white', borderRadius: 10, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.07)' },
  th: { padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#8a8a90', textTransform: 'uppercase', background: '#f6f5f0', borderBottom: '1px solid #ecebe5' },
  td: { padding: '10px 14px', fontSize: 13, color: '#1b1b1d', borderBottom: '1px solid #f6f5f0', verticalAlign: 'middle' },
  badge: { fontSize: 11, padding: '2px 8px', borderRadius: 999, fontWeight: 600 },
  btn: { background: '#1b1b1d', color: 'white', border: 'none', borderRadius: 8, padding: '8px 16px', cursor: 'pointer', fontSize: 13, fontWeight: 600 },
  btnSm: { background: '#e0e7ff', color: '#1b1b1d', border: 'none', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 12 },
  btnGhost: { background: 'white', color: '#3a3a3e', border: '1px solid #d8d6cc', borderRadius: 8, padding: '8px 16px', cursor: 'pointer', fontSize: 13 },
  row2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 },
  row3: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modal: { background: 'white', borderRadius: 12, padding: 24, display: 'flex', flexDirection: 'column', gap: 12 },
  modalHdr: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  x: { background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#8a8a90' },
  input: { width: '100%', padding: '8px 12px', border: '1px solid #d8d6cc', borderRadius: 8, fontSize: 13, boxSizing: 'border-box' },
  err: { background: '#fee2e2', color: '#dc2626', padding: '8px 12px', borderRadius: 6, fontSize: 13 },
}
