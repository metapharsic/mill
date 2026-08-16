import React, { useState, useEffect } from 'react'
const API = '/api'
const h = () => ({ Authorization: `Bearer ${localStorage.getItem('mk_token')}` })
const INC_TYPES = ['Near Miss','First Aid','LTI','Fatality','Property Damage','Environmental','Fire','Spill']
const SEVERITIES = ['Low','Medium','High','Critical']

export default function EHS() {
  const [incidents, setIncidents] = useState([])
  const [summary, setSummary] = useState({})
  const [depts, setDepts] = useState([])
  const [modal, setModal] = useState(false)
  const [editRow, setEditRow] = useState(null)
  const [filter, setFilter] = useState({ severity: '', status: '' })
  const [form, setForm] = useState({ incidentType:'Near Miss', severity:'Low', location:'', departmentId:'', description:'', injuredPerson:'', incidentTime:'', rootCause:'', correctiveAction:'' })
  const [editForm, setEditForm] = useState({})
  const [msg, setMsg] = useState('')
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => { load() }, [filter])

  async function load() {
    const params = new URLSearchParams(Object.fromEntries(Object.entries(filter).filter(([,v])=>v))).toString()
    const [r1, r2] = await Promise.all([
      fetch(`${API}/ehs/incidents?${params}`, { headers: h() }),
      fetch(`${API}/ehs/departments`, { headers: h() }),
    ])
    const d1 = await r1.json()
    setIncidents(d1.data || [])
    setSummary(d1.summary || {})
    setDepts((await r2.json()).data || [])
  }

  async function submit() {
    const r = await fetch(`${API}/ehs/incidents`, { method: 'POST', headers: { ...h(), 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    const d = await r.json()
    if (d.success) { setModal(false); resetForm(); load() }
    else setMsg(d.message)
  }

  async function update() {
    await fetch(`${API}/ehs/incidents/${editRow.id}`, { method: 'PUT', headers: { ...h(), 'Content-Type': 'application/json' }, body: JSON.stringify(editForm) })
    setEditRow(null)
    load()
  }

  function resetForm() { setForm({ incidentType:'Near Miss', severity:'Low', location:'', departmentId:'', description:'', injuredPerson:'', incidentTime:'', rootCause:'', correctiveAction:'' }) }

  function openEdit(row) {
    setEditRow(row)
    setEditForm({ rootCause: row.root_cause||'', correctiveAction: row.corrective_action||'', status: row.status, closureDate: row.closure_date||'' })
  }

  const sevColor = { Low:'#dcfce7', Medium:'#fef9c3', High:'#fee2e2', Critical:'#fce7f3' }
  const sevTxt   = { Low:'#15803d', Medium:'#854d0e', High:'#dc2626', Critical:'#9d174d' }

  return (
    <div style={S.page}>
      <div style={S.hdr}>
        <div>
          <div style={S.title}>EHS — Environment, Health & Safety</div>
          <div style={S.sub}>Incident tracking & corrective actions</div>
        </div>
        <button style={S.btn} onClick={() => { resetForm(); setMsg(''); setModal(true) }}>+ Report Incident</button>
      </div>

      <div style={S.kpis}>
        {[
          ['Total Incidents', summary.total||0, '#1b1b1d'],
          ['Open', summary.open||0, '#d97706'],
          ['High/Critical', summary.highseverity||0, '#dc2626'],
          ['Last 30 Days', summary.last30days||0, '#1b1b1d'],
          ['LTI', summary.lti||0, '#be185d'],
        ].map(([l,v,c]) => (
          <div key={l} style={S.kpi}><div style={{ ...S.kpiVal, color: c }}>{v}</div><div style={S.kpiLbl}>{l}</div></div>
        ))}
      </div>

      <div style={{ display:'flex', gap:8, marginBottom:12 }}>
        <input style={{...S.sel, width:200, background: '#fff'}} placeholder='Search incidents...' value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} />
        <select style={S.sel} value={filter.severity} onChange={e => setFilter({...filter, severity: e.target.value})}>
          <option value=''>All Severity</option>
          {SEVERITIES.map(s => <option key={s}>{s}</option>)}
        </select>
        <select style={S.sel} value={filter.status} onChange={e => setFilter({...filter, status: e.target.value})}>
          <option value=''>All Status</option>
          {['Open','Under Review','Closed'].map(s => <option key={s}>{s}</option>)}
        </select>
      </div>

      <table style={S.tbl}>
        <thead><tr>{['Incident No','Date','Type','Severity','Location','Dept','Description','Status',''].map(c=><th key={c} style={S.th}>{c}</th>)}</tr></thead>
        <tbody>
          {incidents.filter(i => !searchTerm || (i.incident_number||'').toLowerCase().includes(searchTerm.toLowerCase()) || (i.location||'').toLowerCase().includes(searchTerm.toLowerCase()) || (i.description||'').toLowerCase().includes(searchTerm.toLowerCase())).map(i => (
            <tr key={i.id}>
              <td style={S.td}><b>{i.incident_number}</b></td>
              <td style={S.td}>{new Date(i.date).toLocaleDateString('en-IN')}</td>
              <td style={S.td}>{i.incident_type}</td>
              <td style={S.td}><span style={{ ...S.badge, background: sevColor[i.severity]||'#f6f5f0', color: sevTxt[i.severity]||'#3a3a3e' }}>{i.severity}</span></td>
              <td style={S.td}>{i.location}</td>
              <td style={S.td}>{i.departmentname||'—'}</td>
              <td style={{ ...S.td, maxWidth:200, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{i.description}</td>
              <td style={S.td}><span style={{ ...S.badge, background: i.status==='Closed'?'#dcfce7':i.status==='Under Review'?'#e0e7ff':'#fef9c3', color: i.status==='Closed'?'#15803d':i.status==='Under Review'?'#1b1b1d':'#854d0e' }}>{i.status}</span></td>
              <td style={S.td}><button style={S.btnSm} onClick={() => openEdit(i)}>Update</button></td>
            </tr>
          ))}
          {incidents.filter(i => !searchTerm || (i.incident_number||'').toLowerCase().includes(searchTerm.toLowerCase()) || (i.location||'').toLowerCase().includes(searchTerm.toLowerCase()) || (i.description||'').toLowerCase().includes(searchTerm.toLowerCase())).length===0 && <tr><td colSpan={9} style={{ textAlign:'center', padding:32, color:'#a0a0a6' }}>No incidents recorded</td></tr>}
        </tbody>
      </table>

      {modal && (
        <div style={S.overlay}>
          <div style={{ ...S.modal, width: 560 }}>
            <div style={S.modalHdr}><b>Report Incident</b><button style={S.x} onClick={() => setModal(false)}>✕</button></div>
            {msg && <div style={S.err}>{msg}</div>}
            <div style={S.row2}>
              <select style={S.input} value={form.incidentType} onChange={e => setForm({...form, incidentType: e.target.value})}>
                {INC_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
              <select style={S.input} value={form.severity} onChange={e => setForm({...form, severity: e.target.value})}>
                {SEVERITIES.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div style={S.row2}>
              <input style={S.input} placeholder='Location *' value={form.location} onChange={e => setForm({...form, location: e.target.value})} />
              <select style={S.input} value={form.departmentId} onChange={e => setForm({...form, departmentId: e.target.value})}>
                <option value=''>Department</option>
                {depts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div style={S.row2}>
              <input style={S.input} placeholder='Injured Person' value={form.injuredPerson} onChange={e => setForm({...form, injuredPerson: e.target.value})} />
              <input style={S.input} type='time' placeholder='Incident Time' value={form.incidentTime} onChange={e => setForm({...form, incidentTime: e.target.value})} />
            </div>
            <textarea style={{ ...S.input, height: 70 }} placeholder='Description *' value={form.description} onChange={e => setForm({...form, description: e.target.value})} />
            <textarea style={{ ...S.input, height: 60 }} placeholder='Root Cause' value={form.rootCause} onChange={e => setForm({...form, rootCause: e.target.value})} />
            <textarea style={{ ...S.input, height: 60 }} placeholder='Corrective Action' value={form.correctiveAction} onChange={e => setForm({...form, correctiveAction: e.target.value})} />
            <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
              <button style={S.btnGhost} onClick={() => setModal(false)}>Cancel</button>
              <button style={{ ...S.btn, background:'#dc2626' }} onClick={submit}>Report Incident</button>
            </div>
          </div>
        </div>
      )}

      {editRow && (
        <div style={S.overlay}>
          <div style={{ ...S.modal, width: 480 }}>
            <div style={S.modalHdr}><b>Update — {editRow.incident_number}</b><button style={S.x} onClick={() => setEditRow(null)}>✕</button></div>
            <textarea style={{ ...S.input, height: 70 }} placeholder='Root Cause' value={editForm.rootCause} onChange={e => setEditForm({...editForm, rootCause: e.target.value})} />
            <textarea style={{ ...S.input, height: 70 }} placeholder='Corrective Action' value={editForm.correctiveAction} onChange={e => setEditForm({...editForm, correctiveAction: e.target.value})} />
            <div style={S.row2}>
              <select style={S.input} value={editForm.status} onChange={e => setEditForm({...editForm, status: e.target.value})}>
                {['Open','Under Review','Closed'].map(s => <option key={s}>{s}</option>)}
              </select>
              {editForm.status==='Closed' && <input style={S.input} type='date' value={editForm.closureDate} onChange={e => setEditForm({...editForm, closureDate: e.target.value})} />}
            </div>
            <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
              <button style={S.btnGhost} onClick={() => setEditRow(null)}>Cancel</button>
              <button style={S.btn} onClick={update}>Update</button>
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
  kpis: { display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' },
  kpi: { background: 'white', borderRadius: 10, padding: '14px 18px', flex: 1, minWidth: 100, boxShadow: '0 1px 4px rgba(0,0,0,0.07)' },
  kpiVal: { fontSize: 26, fontWeight: 700 },
  kpiLbl: { fontSize: 12, color: '#8a8a90', marginTop: 2 },
  sel: { padding: '7px 12px', border: '1px solid #d8d6cc', borderRadius: 8, fontSize: 13 },
  tbl: { width: '100%', borderCollapse: 'collapse', background: 'white', borderRadius: 10, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.07)' },
  th: { padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#8a8a90', textTransform: 'uppercase', background: '#f6f5f0', borderBottom: '1px solid #ecebe5' },
  td: { padding: '10px 14px', fontSize: 13, color: '#1b1b1d', borderBottom: '1px solid #f6f5f0', verticalAlign: 'middle' },
  badge: { fontSize: 11, padding: '2px 8px', borderRadius: 999, fontWeight: 600 },
  btn: { background: '#1b1b1d', color: 'white', border: 'none', borderRadius: 8, padding: '8px 16px', cursor: 'pointer', fontSize: 13, fontWeight: 600 },
  btnSm: { background: '#e0e7ff', color: '#1b1b1d', border: 'none', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 12 },
  btnGhost: { background: 'white', color: '#3a3a3e', border: '1px solid #d8d6cc', borderRadius: 8, padding: '8px 16px', cursor: 'pointer', fontSize: 13 },
  row2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modal: { background: 'white', borderRadius: 12, padding: 24, display: 'flex', flexDirection: 'column', gap: 12 },
  modalHdr: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  x: { background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#8a8a90' },
  input: { width: '100%', padding: '8px 12px', border: '1px solid #d8d6cc', borderRadius: 8, fontSize: 13, boxSizing: 'border-box' },
  err: { background: '#fee2e2', color: '#dc2626', padding: '8px 12px', borderRadius: 6, fontSize: 13 },
}
