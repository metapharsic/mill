import React, { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'

const POLL_MS = 30_000

const SOP_TYPES = ['Startup','Shutdown','Emergency','Changeover','Cleaning']
const EQUIP_TYPES = ['Pump','Fan','Compressor','Screen','Cleaner','Refiner','Dryer Cylinder',
  'Press Roll','Felt','Wire/Fabric','Vacuum Pump','Heat Exchanger','Tank/Chest','Agitator',
  'Conveyor','Crane','Boiler','Clarifier','Aerator','Filter','Roll','Reel','Winder','Sensor','Valve','Other']

export default function PlantSection({ sectionCode }) {
  const { user, token } = useAuth()
  const code = (sectionCode || '').toUpperCase()
  const [tab, setTab]           = useState('overview')
  const [section, setSection]   = useState(null)
  const [readings, setReadings] = useState([])
  const [alarms, setAlarms]     = useState([])
  const [sops, setSops]         = useState([])
  const [lastSync, setLastSync] = useState(null)
  const [loading, setLoading]   = useState(true)
  const [readingForm, setReadingForm] = useState({ equipmentId: '', tagName: '', parameterName: '', value: '', uom: '' })
  const [alarmForm, setAlarmForm]     = useState({ equipmentId: '', alarmType: 'Warning', description: '' })
  const [equipForm, setEquipForm]     = useState({ tagName: '', equipmentName: '', equipmentType: '', motorKw: '', isCritical: false })
  const [saving, setSaving]     = useState(false)
  const [resolveId, setResolveId]     = useState(null)
  const [resolutionNote, setResolutionNote] = useState('')

  const api = (path) => fetch(`/api/sections${path}`, {
    headers: { Authorization: `Bearer ${token}` }
  }).then(r => r.json())

  const post = (path, body) => fetch(`/api/sections${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body)
  }).then(r => r.json())

  const put = (path, body) => fetch(`/api/sections${path}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body)
  }).then(r => r.json())

  const hasWriteAccess = () => {
    if (!user) return false;
    if (user.role_level >= 5 || user.role === 'Admin') return true;
    const dept = (user.dept_code || '').toUpperCase();
    const c = code.toUpperCase();
    
    if (dept === 'PROD') {
      return [
        'PULPMILL', 'CENTRICLEANER', 'WIRE', 'PRESS', 'UNIRUN', 
        'PRE_DRYER', 'SIZE_PRESS', 'POST_DRYER', 'CALENDER', 
        'POPE_REEL', 'REWINDER', 'CRANES'
      ].includes(c);
    }
    if (dept === 'QC' || dept === 'QA' || dept === 'LAB') {
      return ['LAB', 'SIZE_PRESS', 'SIZE_KITCHEN', 'STARCH_KITCHEN', 'POPE_REEL'].includes(c);
    }
    if (dept === 'UTIL') {
      return ['BOILER', 'STEAM_COND', 'ETP', 'COMPRESSORS', 'VACUUM'].includes(c);
    }
    if (dept === 'MAINT') {
      return ['CRANES', 'COMPRESSORS', 'BOILER', 'VACUUM'].includes(c);
    }
    if (dept === 'STORE') {
      return c === 'STORE';
    }
    return false;
  };

  const fetchAll = useCallback(async () => {
    if (!code) return
    try {
      const [sec, rdgs, alm] = await Promise.all([
        api(`/${code}`),
        api(`/${code}/readings?last=1h`),
        api(`/${code}/alarms?status=active`)
      ])
      if (sec.success)  setSection(sec.data)
      if (rdgs.success) setReadings(rdgs.data)
      if (alm.success)  setAlarms(alm.data)
      setLastSync(new Date())
    } catch (e) { console.error('PlantSection fetch error', e) }
    finally { setLoading(false) }
  }, [code])

  const fetchSops = useCallback(async () => {
    const r = await api(`/${code}/sops`)
    if (r.success) setSops(r.data)
  }, [code])

  useEffect(() => {
    setLoading(true); fetchAll()
    const id = setInterval(fetchAll, POLL_MS)
    return () => clearInterval(id)
  }, [fetchAll])

  useEffect(() => { if (tab === 'sops') fetchSops() }, [tab, fetchSops])

  const submitReading = async (e) => {
    e.preventDefault(); setSaving(true)
    const r = await post(`/${code}/readings`, readingForm)
    if (r.success) { setReadingForm({ equipmentId: '', tagName: '', parameterName: '', value: '', uom: '' }); fetchAll() }
    else alert(r.message)
    setSaving(false)
  }

  const submitAlarm = async (e) => {
    e.preventDefault(); setSaving(true)
    const r = await post(`/${code}/alarms`, alarmForm)
    if (r.success) { setAlarmForm({ equipmentId: '', alarmType: 'Warning', description: '' }); fetchAll() }
    else alert(r.message)
    setSaving(false)
  }

  const submitEquip = async (e) => {
    e.preventDefault(); setSaving(true)
    const r = await post(`/${code}/equipment`, equipForm)
    if (r.success) { setEquipForm({ tagName: '', equipmentName: '', equipmentType: '', motorKw: '', isCritical: false }); fetchAll() }
    else alert(r.message)
    setSaving(false)
  }

  const ackAlarm = async (id) => {
    const r = await put(`/alarms/${id}/ack`, {})
    if (r.success) fetchAll(); else alert(r.message)
  }

  const resolveAlarm = async (id) => {
    if (!resolutionNote.trim()) return alert('Enter resolution note')
    const r = await put(`/alarms/${id}/resolve`, { resolutionNote })
    if (r.success) { setResolveId(null); setResolutionNote(''); fetchAll() } else alert(r.message)
  }

  if (loading) return <div style={s.center}>Loading {code}...</div>
  if (!section) return <div style={s.center}>Section not found: {code}</div>

  const crit  = section.alarmCounts?.critical || 0
  const warn  = section.alarmCounts?.warning  || 0
  const equip = section.equipment || []

  return (
    <div style={s.page}>
      {/* HEADER */}
      <div style={s.header}>
        <div style={s.headerLeft}>
          <span style={s.bigIcon}>{section.icon}</span>
          <div>
            <h2 style={s.title}>{section.name}</h2>
            <p style={s.sub}>
              {section.description}
              {section.deptName && (
                <span style={{ marginLeft: 8, paddingLeft: 8, borderLeft: '1px solid #4a5568', color: '#a0aec0' }}>
                  Owner: {section.deptName} ({section.deptCategory})
                </span>
              )}
            </p>
          </div>
        </div>
        <div style={s.headerRight}>
          {crit > 0 && <span style={{...s.badge, background:'#ef4444'}}>🔴 {crit} Critical</span>}
          {warn > 0 && <span style={{...s.badge, background:'#f59e0b'}}>⚠️ {warn} Warning</span>}
          {crit===0 && warn===0 && <span style={{...s.badge, background:'#22c55e'}}>✅ All Clear</span>}
          <span style={s.sync}>Synced {lastSync?.toLocaleTimeString('en-IN')}</span>
        </div>
      </div>

      {/* TABS */}
      <div style={s.tabs}>
        {['overview','equipment','readings','alarms','sops'].map(t => (
          <button key={t} style={{...s.tab, ...(tab===t?s.tabActive:{})}} onClick={() => setTab(t)}>
            {t.charAt(0).toUpperCase()+t.slice(1)}
            {t==='alarms' && (crit+warn)>0 && <span style={s.tabBadge}>{crit+warn}</span>}
          </button>
        ))}
      </div>

      {/* OVERVIEW */}
      {tab === 'overview' && (
        <div>
          <div style={s.kpiGrid}>
            {readings.slice(0,8).map(r => (
              <div key={r.id} style={s.kpiCard}>
                <div style={s.kpiParam}>{r.parameterName}</div>
                <div style={s.kpiValue}>{Number(r.value).toFixed(2)}</div>
                <div style={s.kpiUom}>{r.uom || '—'}</div>
                <div style={s.kpiTag}>{r.tagName}</div>
              </div>
            ))}
            {readings.length === 0 && <div style={s.empty}>No readings in last hour. Log one in Readings tab.</div>}
          </div>
          {alarms.filter(a=>a.alarmType==='Critical').length > 0 && (
            <div style={s.critBanner}>
              🔴 <strong>Critical Alarms Active</strong> — Go to Alarms tab to acknowledge and resolve.
            </div>
          )}
        </div>
      )}

      {/* EQUIPMENT */}
      {tab === 'equipment' && (
        <div>
          <table style={s.table}>
            <thead><tr style={s.th}>
              {['Tag','Equipment','Type','Motor kW','Critical','Status'].map(h=><th key={h} style={s.thCell}>{h}</th>)}
            </tr></thead>
            <tbody>
              {equip.map(e => (
                <tr key={e.id} style={s.tr}>
                  <td style={s.td}><code style={s.tag}>{e.tagName}</code></td>
                  <td style={s.td}>{e.equipmentName}<br/><span style={s.muted}>{e.manufacturer}</span></td>
                  <td style={s.td}>{e.equipmentType||'—'}</td>
                  <td style={s.td}>{e.motorKw ? `${e.motorKw} kW` : '—'}</td>
                  <td style={s.td}>{e.isCritical ? <span style={s.critBadge}>Critical</span> : '—'}</td>
                  <td style={s.td}><span style={{...s.statusBadge, background: e.isActive?'#22c55e':'#a0a0a6'}}>
                    {e.isActive?'Active':'Inactive'}
                  </span></td>
                </tr>
              ))}
              {equip.length===0 && <tr><td colSpan={6} style={s.empty}>No equipment registered yet.</td></tr>}
            </tbody>
          </table>

          {hasWriteAccess() && (
            <div style={s.formCard}>
              <h4 style={s.formTitle}>Add Equipment</h4>
              <form onSubmit={submitEquip} style={s.form}>
                <input style={s.input} placeholder="Tag Name (e.g. PULP-HD-001)*" required
                  value={equipForm.tagName} onChange={e=>setEquipForm(f=>({...f,tagName:e.target.value}))} />
                <input style={s.input} placeholder="Equipment Name*" required
                  value={equipForm.equipmentName} onChange={e=>setEquipForm(f=>({...f,equipmentName:e.target.value}))} />
                <select style={s.input} value={equipForm.equipmentType}
                  onChange={e=>setEquipForm(f=>({...f,equipmentType:e.target.value}))}>
                  <option value="">Equipment Type</option>
                  {EQUIP_TYPES.map(t=><option key={t}>{t}</option>)}
                </select>
                <input style={s.input} placeholder="Motor kW" type="number" step="0.01"
                  value={equipForm.motorKw} onChange={e=>setEquipForm(f=>({...f,motorKw:e.target.value}))} />
                <label style={s.checkLabel}>
                  <input type="checkbox" checked={equipForm.isCritical}
                    onChange={e=>setEquipForm(f=>({...f,isCritical:e.target.checked}))} />
                  &nbsp;Is Critical (breakdown = production stop)
                </label>
                <button style={s.btn} disabled={saving}>{saving?'Saving...':'Add Equipment'}</button>
              </form>
            </div>
          )}
        </div>
      )}

      {/* READINGS */}
      {tab === 'readings' && (
        <div>
          {hasWriteAccess() && (
            <div style={s.formCard}>
              <h4 style={s.formTitle}>Log Process Reading</h4>
              <form onSubmit={submitReading} style={s.form}>
                <select style={s.input} value={readingForm.equipmentId}
                  onChange={e=>{
                    const eq = equip.find(x=>x.id===parseInt(e.target.value))
                    setReadingForm(f=>({...f,equipmentId:e.target.value,
                      tagName:eq?.tagName||f.tagName,
                      parameterName:eq?.equipmentName||f.parameterName}))
                  }}>
                  <option value="">Select Equipment/Tag</option>
                  {equip.map(e=><option key={e.id} value={e.id}>{e.tagName} — {e.equipmentName}</option>)}
                </select>
                <input style={s.input} placeholder="Tag Name*" required
                  value={readingForm.tagName} onChange={e=>setReadingForm(f=>({...f,tagName:e.target.value}))} />
                <input style={s.input} placeholder="Parameter Name"
                  value={readingForm.parameterName} onChange={e=>setReadingForm(f=>({...f,parameterName:e.target.value}))} />
                <input style={s.input} placeholder="Value*" type="number" step="any" required
                  value={readingForm.value} onChange={e=>setReadingForm(f=>({...f,value:e.target.value}))} />
                <input style={s.input} placeholder="UOM (bar/°C/%/RPM/A)"
                  value={readingForm.uom} onChange={e=>setReadingForm(f=>({...f,uom:e.target.value}))} />
                <button style={s.btn} disabled={saving}>{saving?'Saving...':'Log Reading'}</button>
              </form>
            </div>
          )}

          <table style={s.table}>
            <thead><tr style={s.th}>
              {['Tag','Parameter','Value','UOM','Time','By'].map(h=><th key={h} style={s.thCell}>{h}</th>)}
            </tr></thead>
            <tbody>
              {readings.map(r=>(
                <tr key={r.id} style={s.tr}>
                  <td style={s.td}><code style={s.tag}>{r.tagName}</code></td>
                  <td style={s.td}>{r.parameterName}</td>
                  <td style={{...s.td,fontWeight:600}}>{Number(r.value).toFixed(3)}</td>
                  <td style={s.td}>{r.uom||'—'}</td>
                  <td style={s.td}>{new Date(r.readingTime).toLocaleTimeString('en-IN')}</td>
                  <td style={s.td}>{r.recordedBy||'—'}</td>
                </tr>
              ))}
              {readings.length===0 && <tr><td colSpan={6} style={s.empty}>No readings in last hour.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {/* ALARMS */}
      {tab === 'alarms' && (
        <div>
          {hasWriteAccess() && (
            <div style={s.formCard}>
              <h4 style={s.formTitle}>Raise Alarm</h4>
              <form onSubmit={submitAlarm} style={s.form}>
                <select style={s.input} value={alarmForm.equipmentId}
                  onChange={e=>setAlarmForm(f=>({...f,equipmentId:e.target.value}))}>
                  <option value="">Select Equipment (optional)</option>
                  {equip.map(e=><option key={e.id} value={e.id}>{e.tagName} — {e.equipmentName}</option>)}
                </select>
                <select style={s.input} value={alarmForm.alarmType}
                  onChange={e=>setAlarmForm(f=>({...f,alarmType:e.target.value}))}>
                  {['Critical','Warning','Info'].map(t=><option key={t}>{t}</option>)}
                </select>
                <textarea style={{...s.input,height:70}} placeholder="Alarm description (min 10 chars)*" required minLength={10}
                  value={alarmForm.description} onChange={e=>setAlarmForm(f=>({...f,description:e.target.value}))} />
                <button style={{...s.btn,background: alarmForm.alarmType==='Critical'?'#ef4444':'#f59e0b'}}
                  disabled={saving}>{saving?'Raising...':'Raise Alarm'}</button>
              </form>
            </div>
          )}

          {alarms.map(a=>(
            <div key={a.id} style={{...s.alarmCard, borderLeft:`4px solid ${a.alarmType==='Critical'?'#ef4444':a.alarmType==='Warning'?'#f59e0b':'#1b1b1d'}`}}>
              <div style={s.alarmTop}>
                <span style={{...s.alarmTypeBadge, background: a.alarmType==='Critical'?'#ef4444':a.alarmType==='Warning'?'#f59e0b':'#1b1b1d'}}>
                  {a.alarmType}
                </span>
                <span style={s.alarmTag}>{a.tagName||a.equipmentName||'—'}</span>
                <span style={s.alarmTime}>{new Date(a.triggeredAt).toLocaleString('en-IN')}</span>
              </div>
              <div style={s.alarmDesc}>{a.description}</div>
              {a.maintenanceLogId && <div style={s.alarmMlog}>🔧 Maintenance Log #{a.maintenanceLogId} auto-created</div>}
              <div style={s.alarmActions}>
                {hasWriteAccess() && (
                  <>
                    {!a.acknowledgedAt && (
                      <button style={s.ackBtn} onClick={()=>ackAlarm(a.id)}>Acknowledge</button>
                    )}
                    {a.acknowledgedAt && !a.resolvedAt && (
                      resolveId === a.id ? (
                        <div style={{display:'flex',gap:8,alignItems:'center'}}>
                          <input style={{...s.input,width:280,margin:0}} placeholder="Resolution note*"
                            value={resolutionNote} onChange={e=>setResolutionNote(e.target.value)} />
                          <button style={s.resolveBtn} onClick={()=>resolveAlarm(a.id)}>Confirm Resolve</button>
                          <button style={s.cancelBtn} onClick={()=>setResolveId(null)}>Cancel</button>
                        </div>
                      ) : (
                        <button style={s.resolveBtn} onClick={()=>setResolveId(a.id)}>Resolve</button>
                      )
                    )}
                  </>
                )}
                {a.acknowledgedAt && <span style={s.ackTime}>Acked {new Date(a.acknowledgedAt).toLocaleTimeString('en-IN')}</span>}
              </div>
            </div>
          ))}
          {alarms.length===0 && <div style={s.empty}>No active alarms. 🟢 All clear.</div>}
        </div>
      )}

      {/* SOPs */}
      {tab === 'sops' && (
        <div>
          {SOP_TYPES.map(type => {
            const typeSops = sops.filter(s=>s.sopType===type)
            return (
              <details key={type} style={s.sopSection} open={type==='Startup'}>
                <summary style={s.sopSummary}>{type} SOPs <span style={s.sopCount}>({typeSops.length})</span></summary>
                {typeSops.length === 0
                  ? <div style={s.empty}>No {type} SOPs added yet.</div>
                  : typeSops.map(sop => (
                    <div key={sop.id} style={s.sopCard}>
                      <div style={s.sopHeader}>
                        <strong>{sop.title}</strong>
                        <span style={s.sopMeta}>v{sop.version} · {sop.approvedBy||'Draft'}</span>
                      </div>
                      <ol style={s.sopSteps}>
                        {(sop.steps||[]).map((step,i) => (
                          <li key={i} style={s.sopStep}>
                            {typeof step === 'string' ? step : step.step}
                            {step.warning && <span style={s.sopWarning}> ⚠️ {step.warning}</span>}
                          </li>
                        ))}
                      </ol>
                    </div>
                  ))
                }
              </details>
            )
          })}
        </div>
      )}
    </div>
  )
}

const s = {
  page:       { padding: 24 },
  center:     { padding: 40, textAlign:'center', color:'#8a8a90' },
  header:     { display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:20, background:'#fff', padding:16, borderRadius:10, boxShadow:'0 1px 4px rgba(0,0,0,0.08)' },
  headerLeft: { display:'flex', alignItems:'center', gap:12 },
  bigIcon:    { fontSize:32 },
  title:      { margin:0, fontSize:20, fontWeight:700, color:'#1b1b1d' },
  sub:        { margin:'4px 0 0', color:'#8a8a90', fontSize:12 },
  headerRight:{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:6 },
  badge:      { fontSize:12, color:'#fff', borderRadius:10, padding:'3px 10px', fontWeight:600 },
  sync:       { fontSize:11, color:'#a0a0a6' },
  tabs:       { display:'flex', gap:4, marginBottom:20, borderBottom:'2px solid #ecebe5', paddingBottom:0 },
  tab:        { background:'transparent', border:'none', padding:'8px 16px', cursor:'pointer', fontSize:13, color:'#8a8a90', borderBottom:'2px solid transparent', marginBottom:'-2px', position:'relative' },
  tabActive:  { color:'#1b1b1d', borderBottomColor:'#1b1b1d', fontWeight:600 },
  tabBadge:   { background:'#ef4444', color:'#fff', borderRadius:10, padding:'1px 6px', fontSize:10, marginLeft:4 },
  kpiGrid:    { display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))', gap:12, marginBottom:20 },
  kpiCard:    { background:'#fff', borderRadius:10, padding:16, boxShadow:'0 1px 4px rgba(0,0,0,0.08)', textAlign:'center' },
  kpiParam:   { fontSize:11, color:'#8a8a90', marginBottom:4 },
  kpiValue:   { fontSize:24, fontWeight:700, color:'#1b1b1d' },
  kpiUom:     { fontSize:11, color:'#a0a0a6' },
  kpiTag:     { fontSize:10, color:'#d8d6cc', marginTop:4 },
  empty:      { padding:'24px', textAlign:'center', color:'#a0a0a6', fontSize:13, fontStyle:'italic' },
  critBanner: { background:'#fef2f2', border:'1px solid #fecaca', borderRadius:8, padding:'12px 16px', color:'#dc2626', fontSize:13 },
  table:      { width:'100%', borderCollapse:'collapse', background:'#fff', borderRadius:10, overflow:'hidden', boxShadow:'0 1px 4px rgba(0,0,0,0.08)', marginBottom:20 },
  th:         { background:'#f6f5f0' },
  thCell:     { padding:'10px 12px', textAlign:'left', fontSize:12, fontWeight:600, color:'#3a3a3e', borderBottom:'1px solid #ecebe5' },
  tr:         { borderBottom:'1px solid #f1efe8' },
  td:         { padding:'10px 12px', fontSize:13, color:'#3a3a3e' },
  tag:        { background:'#f1efe8', padding:'2px 6px', borderRadius:4, fontSize:11, color:'#1b1b1d' },
  muted:      { fontSize:11, color:'#a0a0a6' },
  critBadge:  { background:'#fef2f2', color:'#dc2626', padding:'2px 8px', borderRadius:10, fontSize:11, fontWeight:600 },
  statusBadge:{ color:'#fff', padding:'2px 8px', borderRadius:10, fontSize:11, fontWeight:600 },
  formCard:   { background:'#fff', borderRadius:10, padding:20, boxShadow:'0 1px 4px rgba(0,0,0,0.08)', marginBottom:20 },
  formTitle:  { margin:'0 0 12px', fontSize:15, fontWeight:600, color:'#1b1b1d' },
  form:       { display:'flex', flexDirection:'column', gap:10 },
  input:      { padding:'8px 12px', borderRadius:8, border:'1px solid #ecebe5', fontSize:13, color:'#1b1b1d', width:'100%', boxSizing:'border-box' },
  checkLabel: { fontSize:13, color:'#3a3a3e', display:'flex', alignItems:'center' },
  btn:        { background:'#1b1b1d', color:'#fff', border:'none', borderRadius:8, padding:'9px 20px', fontSize:13, fontWeight:600, cursor:'pointer', alignSelf:'flex-start' },
  alarmCard:  { background:'#fff', borderRadius:10, padding:16, marginBottom:12, boxShadow:'0 1px 4px rgba(0,0,0,0.08)' },
  alarmTop:   { display:'flex', alignItems:'center', gap:10, marginBottom:8 },
  alarmTypeBadge:{ fontSize:11, color:'#fff', borderRadius:10, padding:'2px 8px', fontWeight:600 },
  alarmTag:   { fontSize:12, color:'#8a8a90', flex:1 },
  alarmTime:  { fontSize:11, color:'#a0a0a6' },
  alarmDesc:  { fontSize:13, color:'#3a3a3e', marginBottom:8 },
  alarmMlog:  { fontSize:12, color:'#059669', marginBottom:8 },
  alarmActions:{ display:'flex', gap:8, alignItems:'center' },
  ackBtn:     { background:'#fef3c7', color:'#92400e', border:'none', borderRadius:6, padding:'4px 12px', fontSize:12, cursor:'pointer', fontWeight:600 },
  resolveBtn: { background:'#d1fae5', color:'#065f46', border:'none', borderRadius:6, padding:'4px 12px', fontSize:12, cursor:'pointer', fontWeight:600 },
  cancelBtn:  { background:'#f1efe8', color:'#3a3a3e', border:'none', borderRadius:6, padding:'4px 12px', fontSize:12, cursor:'pointer' },
  ackTime:    { fontSize:11, color:'#a0a0a6' },
  sopSection: { background:'#fff', borderRadius:10, padding:16, marginBottom:12, boxShadow:'0 1px 4px rgba(0,0,0,0.08)' },
  sopSummary: { fontSize:14, fontWeight:600, color:'#1b1b1d', cursor:'pointer', padding:'4px 0' },
  sopCount:   { fontWeight:400, color:'#a0a0a6', fontSize:12 },
  sopCard:    { marginTop:12, borderTop:'1px solid #f1efe8', paddingTop:12 },
  sopHeader:  { display:'flex', justifyContent:'space-between', marginBottom:8 },
  sopMeta:    { fontSize:11, color:'#a0a0a6' },
  sopSteps:   { margin:'0 0 0 20px', padding:0 },
  sopStep:    { fontSize:13, color:'#3a3a3e', marginBottom:6, lineHeight:1.5 },
  sopWarning: { color:'#b45309', fontSize:12 },
}
