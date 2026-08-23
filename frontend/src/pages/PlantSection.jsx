import React, { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'

const POLL_MS = 30_000

const SOP_TYPES = ['Startup','Shutdown','Emergency','Changeover','Cleaning']
const EQUIP_TYPES = ['Pump','Fan','Compressor','Screen','Cleaner','Refiner','Dryer Cylinder',
  'Press Roll','Felt','Wire/Fabric','Vacuum Pump','Heat Exchanger','Tank/Chest','Agitator',
  'Conveyor','Crane','Boiler','Clarifier','Aerator','Filter','Roll','Reel','Winder','Sensor','Valve','Other']

export default function PlantSection({ sectionCode }) {
  const { user, token } = useAuth()
  const navigate = useNavigate()
  const code = (sectionCode || '').toUpperCase()
  const [tab, setTab]           = useState('equipment')
  const [section, setSection]   = useState(null)
  const [readings, setReadings] = useState([])
  const [alarms, setAlarms]     = useState([])
  const [sops, setSops]         = useState([])
  const [lastSync, setLastSync] = useState(null)
  const [loading, setLoading]   = useState(true)
  const [readingForm, setReadingForm] = useState({ equipmentId: '', tagName: '', parameterName: '', value: '', uom: '' })
  const [alarmForm, setAlarmForm]     = useState({ equipmentId: '', alarmType: 'Warning', description: '' })
  const [equipForm, setEquipForm]     = useState({ tagName: '', equipmentName: '', equipmentType: '', motorKw: '', isCritical: false })
  const [editingEquipId, setEditingEquipId] = useState(null)
  const [saving, setSaving]     = useState(false)
  const [resolveId, setResolveId]     = useState(null)
  const [resolutionNote, setResolutionNote] = useState('')
  const [equipSearch, setEquipSearch] = useState('')

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

  const del = (path) => fetch(`/api/sections${path}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` }
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
        'POPE_REEL', 'REWINDER', 'CRANES', 'CLOTHING'
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
    return true;
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

  const resetEquipForm = () => {
    setEquipForm({ tagName: '', equipmentName: '', equipmentType: '', motorKw: '', isCritical: false })
    setEditingEquipId(null)
  }

  const submitEquip = async (e) => {
    e.preventDefault(); setSaving(true)
    const r = editingEquipId
      ? await put(`/equipment/${editingEquipId}`, equipForm)
      : await post(`/${code}/equipment`, equipForm)
    if (r.success) { resetEquipForm(); fetchAll() }
    else alert(r.message)
    setSaving(false)
  }

  const startEditEquip = (eq) => {
    setEditingEquipId(eq.id)
    setEquipForm({
      tagName: eq.tagName || '', equipmentName: eq.equipmentName || '',
      equipmentType: eq.equipmentType || '', motorKw: eq.motorKw ?? '',
      isCritical: !!eq.isCritical,
    })
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })
  }

  const deleteEquip = async (eq) => {
    if (!window.confirm(`Delete "${eq.equipmentName}" (${eq.tagName})? This cannot be undone.`)) return
    const r = await del(`/equipment/${eq.id}`)
    if (r.success) { if (editingEquipId === eq.id) resetEquipForm(); fetchAll() }
    else alert(r.message)
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

  const filteredEquip = equip.filter(e => {
    if (!equipSearch) return true
    const q = equipSearch.toLowerCase()
    return (
      (e.equipmentName && e.equipmentName.toLowerCase().includes(q)) ||
      (e.tagName && e.tagName.toLowerCase().includes(q)) ||
      (e.bearingSize && e.bearingSize.toLowerCase().includes(q)) ||
      (e.beltNo && e.beltNo.toLowerCase().includes(q)) ||
      (e.shaftSize && e.shaftSize.toLowerCase().includes(q)) ||
      (e.lockNut && e.lockNut.toLowerCase().includes(q)) ||
      (e.impellerSize && e.impellerSize.toLowerCase().includes(q))
    )
  })

  return (
    <div style={s.page}>
      {/* HEADER */}
      <div style={s.header}>
        <div style={s.headerLeft}>
          <span style={s.bigIcon}>{section.icon}</span>
          <div>
            <h2 style={s.title}>{section.name} — Machinery &amp; Digital Twin Registry</h2>
            <p style={s.sub}>
              {section.description}
              {section.deptName && (
                <span style={{ marginLeft: 8, paddingLeft: 8, borderLeft: '1px solid #cbd5e1', color: '#64748b' }}>
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
        {['equipment','overview','readings','alarms','sops'].map(t => (
          <button key={t} style={{...s.tab, ...(tab===t?s.tabActive:{})}} onClick={() => setTab(t)}>
            {t === 'equipment' ? `⚙️ Equipment & Spares (${equip.length})` : t.charAt(0).toUpperCase()+t.slice(1)}
            {t==='alarms' && (crit+warn)>0 && <span style={s.tabBadge}>{crit+warn}</span>}
          </button>
        ))}
      </div>

      {/* EQUIPMENT TAB (FULL MECHANICAL SPECS MATCHING EXCEL REGISTRY) */}
      {tab === 'equipment' && (
        <div>
          {/* Search & Filter Bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <input
                type="text"
                placeholder="🔍 Search roll, bearing (e.g. 23234K), belt, lock nut, shaft..."
                value={equipSearch}
                onChange={e => setEquipSearch(e.target.value)}
                style={{
                  padding: '8px 14px',
                  borderRadius: 6,
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  fontSize: 13,
                  width: 380,
                  outline: 'none'
                }}
              />
              <span style={{ fontSize: 12, color: '#64748b' }}>
                Showing <strong>{filteredEquip.length}</strong> of {equip.length} machine parts
              </span>
            </div>

            <button
              type="button"
              onClick={() => navigate(`/indent`)}
              style={{
                background: '#0f766e',
                color: '#ffffff',
                border: 'none',
                borderRadius: 6,
                padding: '8px 16px',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6
              }}
            >
              📋 Raise Store Indent for Section
            </button>
          </div>

          <div style={{ background: '#ffffff', borderRadius: 8, border: '1px solid #e2e8f0', overflowX: 'auto', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, textAlign: 'left' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '2px solid #0f766e', color: '#0f766e', textTransform: 'uppercase', fontSize: 11 }}>
                  <th style={{ padding: '10px 12px', width: 45, textAlign: 'center' }}>#</th>
                  <th style={{ padding: '10px 12px', width: 110 }}>Tag Code</th>
                  <th style={{ padding: '10px 12px' }}>Equipment / Roll Description</th>
                  <th style={{ padding: '10px 12px', width: 130 }}>Bearing Size</th>
                  <th style={{ padding: '10px 12px', width: 90 }}>Lock Nut</th>
                  <th style={{ padding: '10px 12px', width: 80 }}>Washer</th>
                  <th style={{ padding: '10px 12px', width: 100 }}>Belt No</th>
                  <th style={{ padding: '10px 12px', width: 90 }}>Shaft</th>
                  <th style={{ padding: '10px 12px' }}>Impeller / Sleeve</th>
                  <th style={{ padding: '10px 12px' }}>Couplings / Pulleys</th>
                  <th style={{ padding: '10px 12px', width: 90, textAlign: 'center' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredEquip.map((e, idx) => (
                  <tr key={e.id || idx} style={{ borderBottom: '1px solid #f1f5f9', background: idx % 2 === 0 ? '#ffffff' : '#fcfcfc' }}>
                    <td style={{ padding: '9px 12px', textAlign: 'center', fontWeight: 700, color: '#64748b' }}>
                      {e.sno || idx + 1}
                    </td>
                    <td style={{ padding: '9px 12px' }}>
                      <span style={{ fontFamily: 'monospace', fontWeight: 700, background: '#f1f5f9', color: '#0f766e', padding: '2px 6px', borderRadius: 4, fontSize: 11 }}>
                        {e.tagName || '—'}
                      </span>
                    </td>
                    <td style={{ padding: '9px 12px' }}>
                      <div style={{ fontWeight: 700, color: '#0f172a' }}>{e.equipmentName}</div>
                      {e.equipmentType && e.equipmentType !== 'Roll/Assembly' && (
                        <div style={{ fontSize: 10, color: '#64748b' }}>{e.equipmentType}</div>
                      )}
                    </td>
                    <td style={{ padding: '9px 12px' }}>
                      {e.bearingSize ? (
                        <span style={{ background: '#cffafe', color: '#0891b2', fontWeight: 800, padding: '2px 8px', borderRadius: 12, border: '1px solid #a5f3fc', fontSize: 11 }}>
                          {e.bearingSize}
                        </span>
                      ) : <span style={{ color: '#cbd5e1' }}>—</span>}
                    </td>
                    <td style={{ padding: '9px 12px' }}>
                      {e.lockNut ? <strong style={{ color: '#475569' }}>{e.lockNut}</strong> : <span style={{ color: '#cbd5e1' }}>—</span>}
                    </td>
                    <td style={{ padding: '9px 12px' }}>
                      {e.washer ? <span style={{ color: '#475569' }}>{e.washer}</span> : <span style={{ color: '#cbd5e1' }}>—</span>}
                    </td>
                    <td style={{ padding: '9px 12px' }}>
                      {e.beltNo ? (
                        <span style={{ background: '#fef3c7', color: '#d97706', fontWeight: 700, padding: '2px 7px', borderRadius: 10, border: '1px solid #fde68a', fontSize: 11 }}>
                          {e.beltNo}
                        </span>
                      ) : <span style={{ color: '#cbd5e1' }}>—</span>}
                    </td>
                    <td style={{ padding: '9px 12px' }}>
                      {e.shaftSize ? <span>{e.shaftSize}</span> : <span style={{ color: '#cbd5e1' }}>—</span>}
                    </td>
                    <td style={{ padding: '9px 12px', fontSize: 11, color: '#334155' }}>
                      {[e.impellerSize ? `Imp: ${e.impellerSize}` : null, e.sleeve ? `Slv: ${e.sleeve}` : null].filter(Boolean).join(' | ') || '—'}
                    </td>
                    <td style={{ padding: '9px 12px', fontSize: 11, color: '#334155' }}>
                      {[e.couplings ? `Cpl: ${e.couplings}` : null, e.pulleys ? `Pul: ${e.pulleys}` : null].filter(Boolean).join(' | ') || '—'}
                    </td>
                    <td style={{ padding: '9px 12px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: 4, justifyContent: 'center', flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          onClick={() => navigate(`/indent`)}
                          style={{ background: '#f0fdfa', border: '1px solid #0f766e', color: '#0f766e', borderRadius: 4, padding: '3px 8px', fontSize: 10, fontWeight: 700, cursor: 'pointer' }}
                          title={`Raise Indent for ${e.equipmentName}`}
                        >
                          ⚡ Indent
                        </button>
                        {hasWriteAccess() && (
                          <>
                            <button
                              type="button"
                              onClick={() => startEditEquip(e)}
                              style={{ background: '#eff6ff', border: '1px solid #2563eb', color: '#2563eb', borderRadius: 4, padding: '3px 8px', fontSize: 10, fontWeight: 700, cursor: 'pointer' }}
                              title={`Edit ${e.equipmentName}`}
                            >
                              ✎ Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteEquip(e)}
                              style={{ background: '#fef2f2', border: '1px solid #dc2626', color: '#dc2626', borderRadius: 4, padding: '3px 8px', fontSize: 10, fontWeight: 700, cursor: 'pointer' }}
                              title={`Delete ${e.equipmentName}`}
                            >
                              🗑 Delete
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredEquip.length === 0 && (
                  <tr>
                    <td colSpan={12} style={{ padding: 30, textAlign: 'center', color: '#64748b' }}>
                      No machinery components match your search.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {hasWriteAccess() && (
            <div style={{ ...s.formCard, marginTop: 18 }}>
              <h4 style={s.formTitle}>{editingEquipId ? 'Edit Roll / Assembly Component' : 'Add Custom Roll / Assembly Component'}</h4>
              <form onSubmit={submitEquip} style={s.form}>
                <input style={s.input} placeholder="Tag Name (e.g. WIRE-MCN-026)*" required
                  value={equipForm.tagName} onChange={e=>setEquipForm(f=>({...f,tagName:e.target.value}))} />
                <input style={s.input} placeholder="Equipment / Roll Name*" required
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
                <button style={s.btn} disabled={saving}>{saving?'Saving...':(editingEquipId?'Save Changes':'Add Component')}</button>
                {editingEquipId && (
                  <button type="button" onClick={resetEquipForm} style={{ ...s.btn, background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1' }}>
                    Cancel
                  </button>
                )}
              </form>
            </div>
          )}
        </div>
      )}

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
        </div>
      )}

      {/* ALARMS */}
      {tab === 'alarms' && (
        <div>
          {alarms.map(a => (
            <div key={a.id} style={{ ...s.kpiCard, marginBottom: 10, borderLeft: a.alarmType === 'Critical' ? '4px solid #ef4444' : '4px solid #f59e0b' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <strong>{a.alarmType}: {a.description}</strong>
                  <div style={{ fontSize: 11, color: '#64748b', marginTop: 3 }}>Equipment: {a.equipmentName || a.tagName || 'Section General'}</div>
                </div>
                <div>
                  {!a.acknowledgedAt ? (
                    <button style={s.btnSm} onClick={() => ackAlarm(a.id)}>Acknowledge</button>
                  ) : (
                    <button style={{ ...s.btnSm, background: '#0284c7' }} onClick={() => setResolveId(a.id)}>Resolve</button>
                  )}
                </div>
              </div>
              {resolveId === a.id && (
                <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
                  <input style={s.input} placeholder="Resolution note..." value={resolutionNote} onChange={e => setResolutionNote(e.target.value)} />
                  <button style={s.btnSm} onClick={() => resolveAlarm(a.id)}>Confirm Resolution</button>
                </div>
              )}
            </div>
          ))}
          {alarms.length === 0 && <div style={s.empty}>No active alarms for this section.</div>}
        </div>
      )}

      {/* SOPS */}
      {tab === 'sops' && (
        <div>
          {sops.map(sop => (
            <div key={sop.id} style={{ ...s.kpiCard, marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <strong>{sop.title}</strong>
                <span style={{ fontSize: 11, color: '#64748b' }}>Rev {sop.revision_number}</span>
              </div>
              <p style={{ fontSize: 12, color: '#334155', marginTop: 4 }}>{sop.content}</p>
            </div>
          ))}
          {sops.length === 0 && <div style={s.empty}>No SOPs registered for this section.</div>}
        </div>
      )}
    </div>
  )
}

const s = {
  page: { padding: 24, background: '#f6f5f0', minHeight: '100vh', color: '#1b1b1d', fontFamily: 'sans-serif' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 12 },
  headerLeft: { display: 'flex', alignItems: 'center', gap: 14 },
  bigIcon: { fontSize: 36, background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: 8, padding: 8 },
  title: { fontSize: 22, fontWeight: 800, color: '#0f172a', margin: 0 },
  sub: { fontSize: 13, color: '#64748b', margin: '4px 0 0 0' },
  headerRight: { display: 'flex', alignItems: 'center', gap: 8 },
  badge: { color: '#fff', padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700 },
  sync: { fontSize: 11, color: '#94a3b8' },
  tabs: { display: 'flex', gap: 6, marginBottom: 16, borderBottom: '1px solid #cbd5e1', paddingBottom: 6 },
  tab: { background: 'none', border: 'none', padding: '8px 16px', fontSize: 13, fontWeight: 700, color: '#64748b', cursor: 'pointer', borderRadius: 6 },
  tabActive: { background: '#0f766e', color: '#ffffff' },
  tabBadge: { background: '#ef4444', color: '#fff', borderRadius: 10, padding: '1px 6px', fontSize: 10, marginLeft: 6 },
  kpiGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 16 },
  kpiCard: { background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 14 },
  kpiParam: { fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase' },
  kpiValue: { fontSize: 20, fontWeight: 800, color: '#0f172a', marginTop: 4 },
  kpiUom: { fontSize: 11, color: '#94a3b8' },
  kpiTag: { fontSize: 10, fontFamily: 'monospace', color: '#0f766e', marginTop: 4 },
  critBanner: { background: '#fee2e2', border: '1px solid #f87171', color: '#991b1b', padding: '10px 14px', borderRadius: 6, fontSize: 12, marginBottom: 14 },
  empty: { padding: 30, textAlign: 'center', color: '#94a3b8', fontSize: 13 },
  formCard: { background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 16 },
  formTitle: { fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 12 },
  form: { display: 'flex', flexDirection: 'column', gap: 10 },
  input: { width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 12, background: '#f8fafc', outline: 'none' },
  checkLabel: { fontSize: 12, color: '#334155', display: 'flex', alignItems: 'center' },
  btn: { background: '#0f766e', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 16px', fontWeight: 700, fontSize: 12, cursor: 'pointer' },
  btnSm: { background: '#16a34a', color: '#fff', border: 'none', borderRadius: 4, padding: '4px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer' },
  center: { padding: 40, textAlign: 'center', color: '#64748b', fontSize: 14 }
}
