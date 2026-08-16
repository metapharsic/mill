import React, { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
const API=(p,o)=>fetch(p,{headers:{Authorization:`Bearer ${localStorage.getItem('mk_token')}`,'Content-Type':'application/json',...(o?.headers||{})},...o}).then(r=>r.json())
const MAINT_TYPES=['Preventive','Predictive','Breakdown','Lubrication']
const STATUS_COLOR={Scheduled:'#1b1b1d','In Progress':'#f97316',Done:'#22c55e',Overdue:'#ef4444',Cancelled:'#8a8a90','Completed':'#22c55e'}
// Doc32 E4f: bearing checklist write access — matches 30_RoleBased_PlantSections_RBAC.md pattern.
// PROD/QC/MAINT/UTIL/STORE dept-code can write; everyone else (incl. no match) is read-only. Admin/L5 always writes.
const BEARING_WRITE_DEPTS = ['PROD','QC','MAINT','UTIL','STORE']
const hasBearingWriteAccess = (user) => !!user && (user.role_level >= 5 || BEARING_WRITE_DEPTS.includes(user.dept_code))

export default function Maintenance() {
  const { user } = useAuth()
  const [tab,setTab]=useState('schedule')
  const [schedules,setSchedules]=useState([]),[logs,setLogs]=useState([])
  const [equipment,setEquipment]=useState([]),[inspections,setInspections]=useState([])
  const [sections,setSections]=useState([])
  const [totalS,setTotalS]=useState(0),[totalL,setTotalL]=useState(0)
  const [loading,setLoading]=useState(true)
  const [machines,setMachines]=useState([]),[users,setUsers]=useState([])
  const [modal,setModal]=useState(null) // 'schedule'|'log'|'breakdown'|'equipment'|'inspection'
  const [form,setForm]=useState({}),[saving,setSaving]=useState(false),[err,setErr]=useState('')
  const [searchTerm,setSearchTerm]=useState('')

  // F2 gap fix — motor electrical specs (KW/RPM/Bearing-No-FS/Bearing-No-BS), separate table
  const [motors,setMotors]=useState([])
  const [motorSections,setMotorSections]=useState([])
  const [motorFilter,setMotorFilter]=useState('')
  const canEditMotors = !!user && user.role_level>=4
  const loadMotors=useCallback(async(sectionLabel)=>{
    const r=await API(`/api/master/motors${sectionLabel?`?section_label=${encodeURIComponent(sectionLabel)}`:''}`)
    if(r.success) setMotors(r.data)
  },[])
  const loadMotorSections=useCallback(async()=>{
    const r=await API('/api/master/motors/sections')
    if(r.success) setMotorSections(r.data)
  },[])
  useEffect(()=>{ if(tab==='motors'){ loadMotors(motorFilter); loadMotorSections() } },[tab,motorFilter,loadMotors,loadMotorSections])
  const openMotor=()=>{ setForm({motor_name:'',kw:'',hp:'',rpm:'',full_amp:'',bearing_no_fs:'',bearing_no_bs:'',section_label:motorFilter||''}); setErr(''); setModal('motor') }
  const openEditMotor=(m)=>{ setForm({...m,id:m.id}); setErr(''); setModal('motor') }
  const saveMotor=async e=>{
    e.preventDefault(); if(!form.motor_name||!form.section_label) return setErr('Motor name + section required')
    setSaving(true);setErr('')
    const r=form.id ? await API(`/api/master/motors/${form.id}`,{method:'PUT',body:JSON.stringify(form)})
                     : await API('/api/master/motors',{method:'POST',body:JSON.stringify(form)})
    setSaving(false); if(r.success){ setModal(null); loadMotors(motorFilter); loadMotorSections() } else setErr(r.message)
  }
  const deleteMotor=async(id)=>{
    if(!window.confirm('Delete this motor spec row?')) return
    const r=await API(`/api/master/motors/${id}`,{method:'DELETE'})
    if(r.success){ loadMotors(motorFilter); loadMotorSections() }
  }

  // Ph32 E4 — bearing check grid
  const [bcSection,setBcSection]=useState('')
  const [bcShift,setBcShift]=useState('Day')
  const [bcGrid,setBcGrid]=useState([])
  const [bcReadings,setBcReadings]=useState({}) // {equipment_id:{fs_status,bs_status,remarks}}
  const [bcSaving,setBcSaving]=useState(false)
  const [bcMsg,setBcMsg]=useState('')
  const loadBcGrid=useCallback(async(sectionId)=>{
    if(!sectionId) return
    const r=await API(`/api/maintenance/inspections/grid/${sectionId}`)
    if(r.success){
      setBcGrid(r.data)
      const seed={}
      r.data.forEach(row=>{ seed[row.id]={fs_status:row.lastFs||'Normal',bs_status:row.lastBs||'Normal',fs_number:row.lastFsNumber||'',bs_number:row.lastBsNumber||'',fs_temp:row.lastFsTemp||'',bs_temp:row.lastBsTemp||'',fs_vibration:row.lastFsVibration||'',bs_vibration:row.lastBsVibration||'',remarks:''} })
      setBcReadings(seed)
    }
  },[])
  useEffect(()=>{ if(bcSection) loadBcGrid(bcSection) },[bcSection,loadBcGrid])
  const patchBc=(eqId,key,val)=>setBcReadings(r=>({...r,[eqId]:{...r[eqId],[key]:val}}))
  const submitBcRound=async()=>{
    if(!bcSection) return setBcMsg('Pick a section first')
    setBcSaving(true);setBcMsg('')
    const readings=Object.entries(bcReadings).map(([equipment_id,v])=>({equipment_id:Number(equipment_id),...v}))
    const r=await API('/api/maintenance/inspections/bearing-check',{method:'POST',body:JSON.stringify({section_id:Number(bcSection),shift:bcShift,readings})})
    setBcSaving(false)
    if(r.success){ setBcMsg(`Saved ${r.count} readings, ${r.criticalCount} critical flagged`); loadBcGrid(bcSection) }
    else setBcMsg(r.message||'Save failed')
  }

  // Scan/photo upload — attach a photo of the filled paper checklist to this round
  const [bcScans,setBcScans]=useState([])
  const loadBcScans=useCallback(async(sectionId)=>{
    if(!sectionId) return
    const r=await API(`/api/maintenance/inspections/bearing-check/scans/${sectionId}`)
    if(r.success) setBcScans(r.data)
  },[])
  useEffect(()=>{ if(bcSection) loadBcScans(bcSection) },[bcSection,loadBcScans])
  const uploadBcScan=async(file)=>{
    if(!bcSection||!file) return
    const fd=new FormData()
    fd.append('file',file); fd.append('section_id',bcSection); fd.append('shift',bcShift)
    setBcMsg('Uploading scan...')
    const res=await fetch('/api/maintenance/inspections/bearing-check/scan',{method:'POST',headers:{Authorization:`Bearer ${localStorage.getItem('mk_token')}`},body:fd})
    const r=await res.json()
    setBcMsg(r.success?'Scan attached':(r.message||'Upload failed'))
    if(r.success) loadBcScans(bcSection)
  }

  // Excel export — download current grid as xlsx, same shape as source checklist. fetch+blob since
  // window.open can't carry an Authorization header.
  const exportBcExcel=async()=>{
    if(!bcSection) return
    const res=await fetch(`/api/maintenance/inspections/bearing-check/export/${bcSection}`,{headers:{Authorization:`Bearer ${localStorage.getItem('mk_token')}`}})
    if(!res.ok){ setBcMsg('Export failed'); return }
    const blob=await res.blob()
    const secName=sections.find(s=>String(s.id)===String(bcSection))?.code||'section'
    const a=document.createElement('a')
    a.href=URL.createObjectURL(blob); a.download=`${secName}_bearing_checklist.xlsx`
    a.click(); URL.revokeObjectURL(a.href)
  }

  // Excel import — upload a filled sheet, bulk-applies matching rows
  const importBcExcel=async(file)=>{
    if(!bcSection||!file) return
    const fd=new FormData()
    fd.append('file',file); fd.append('shift',bcShift)
    setBcSaving(true);setBcMsg('Importing...')
    const res=await fetch(`/api/maintenance/inspections/bearing-check/import/${bcSection}`,{method:'POST',headers:{Authorization:`Bearer ${localStorage.getItem('mk_token')}`},body:fd})
    const r=await res.json()
    setBcSaving(false)
    if(r.success){
      setBcMsg(`Imported ${r.count} rows, ${r.criticalCount} critical${r.unmatched?.length?`, ${r.unmatched.length} unmatched names`:''}`)
      loadBcGrid(bcSection)
    } else setBcMsg(r.message||'Import failed')
  }

  const loadSchedules=useCallback(async()=>{
    const r=await API('/api/maintenance/schedule?limit=50')
    if(r.success){setSchedules(r.data);setTotalS(r.total)}
  },[])
  const loadLogs=useCallback(async()=>{
    setLoading(true)
    const r=await API('/api/maintenance/logs?limit=50')
    if(r.success){setLogs(r.data);setTotalL(r.total)}
    setLoading(false)
  },[])
  const loadEquipmentData=useCallback(async()=>{
    const [eRes, iRes, sRes] = await Promise.all([
      API('/api/maintenance/equipment'),
      API('/api/maintenance/inspections'),
      API('/api/master/sections')
    ])
    if(eRes.success) setEquipment(eRes.data)
    if(iRes.success) setInspections(iRes.data)
    if(sRes.success) setSections(sRes.data)
  },[])

  useEffect(()=>{ loadSchedules(); loadLogs(); loadEquipmentData() },[loadSchedules,loadLogs,loadEquipmentData])
  useEffect(()=>{
    API('/api/production/machines').then(r=>{if(r.success)setMachines(r.data)})
    API('/api/users').then(r=>{if(r.success)setUsers(r.data)})
  },[])

  const [positions, setPositions] = useState([])
  useEffect(()=>{
    if(form.machine_id) API(`/api/master/machines/${form.machine_id}/positions`).then(r=>{if(r.success)setPositions(r.data)})
    else setPositions([])
  },[form.machine_id])

  const F=(key,label,type='text',ph='')=>(
    <label style={S.label}>{label}<input style={S.input} type={type} step="any" value={form[key]??''} onChange={e=>setForm(f=>({...f,[key]:e.target.value}))} placeholder={ph}/></label>
  )

  const openSchedule=()=>{ setForm({machine_id:'',maintenance_type:'Preventive',title:'',frequency_days:30,next_due:'',estimated_hours:'',assigned_to:'',position_id:'',materials_needed:'',priority:'Medium'}); setErr(''); setModal('schedule') }
  const openEditSchedule=(s)=>{ setForm({id:s.id, machine_id:s.machine_id||s.machineId||'', maintenance_type:s.maintenanceType||s.maintenance_type||'Preventive', title:s.title, frequency_days:s.frequencyDays||s.frequency_days||'', next_due:s.nextDue||s.next_due?new Date(s.nextDue||s.next_due).toISOString().slice(0,10):'', estimated_hours:s.estimatedHours||s.estimated_hours||'', assigned_to:s.assigned_to||'', position_id:s.position_id||'', materials_needed:s.materials_needed||'', priority:s.priority||'Medium'}); setErr(''); setModal('schedule') }

  const openLog=()=>{ setForm({machine_id:'',date:'',maintenance_type:'Preventive',description:'',work_done:'',start_time:'',end_time:'',cost:'',performed_by:''}); setErr(''); setModal('log') }
  const openBreakdown=()=>{ setForm({machine_id:'',description:'',start_time:''}); setErr(''); setModal('breakdown') }
  
  const openEquipment=()=>{ setForm({name:'',code:'',type:'Motor',section_id:'',hp:'',amps:''}); setErr(''); setModal('equipment') }
  const openEditEquipment=(e)=>{ setForm({...e, section_id:e.section_id||''}); setErr(''); setModal('equipment') }
  
  const openInspection=()=>{ setForm({equipment_id:'',status:'Normal',check_date:new Date().toISOString().slice(0,10),next_check_date:'',remarks:''}); setErr(''); setModal('inspection') }

  const saveSchedule=async e=>{
    e.preventDefault();if(!form.machine_id||!form.title) return setErr('Machine + title required')
    setSaving(true);setErr('')
    const r=form.id 
      ? await API(`/api/maintenance/schedule/${form.id}`,{method:'PUT',body:JSON.stringify(form)})
      : await API('/api/maintenance/schedule',{method:'POST',body:JSON.stringify(form)})
    setSaving(false);if(r.success){setModal(null);loadSchedules()}else setErr(r.message)
  }
  const saveLog=async e=>{
    e.preventDefault();if(!form.machine_id||!form.date) return setErr('Machine + date required')
    setSaving(true);setErr('')
    const r=await API('/api/maintenance/logs',{method:'POST',body:JSON.stringify(form)})
    setSaving(false);if(r.success){setModal(null);loadLogs()}else setErr(r.message)
  }
  const saveBreakdown=async e=>{
    e.preventDefault();if(!form.machine_id) return setErr('Machine required')
    setSaving(true);setErr('')
    const r=await API('/api/maintenance/breakdown',{method:'POST',body:JSON.stringify(form)})
    setSaving(false);if(r.success){setModal(null);loadLogs()}else setErr(r.message)
  }
  const saveEquipment=async e=>{
    e.preventDefault();if(!form.name||!form.code) return setErr('Name + Code required')
    setSaving(true);setErr('')
    const r=form.id
      ? await API(`/api/maintenance/equipment/${form.id}`,{method:'PUT',body:JSON.stringify(form)})
      : await API('/api/maintenance/equipment',{method:'POST',body:JSON.stringify(form)})
    setSaving(false);if(r.success){setModal(null);loadEquipmentData()}else setErr(r.message)
  }
  const saveInspection=async e=>{
    e.preventDefault();if(!form.equipment_id) return setErr('Equipment selection required')
    setSaving(true);setErr('')
    const r=await API('/api/maintenance/inspections',{method:'POST',body:JSON.stringify(form)})
    setSaving(false);if(r.success){setModal(null);loadEquipmentData()}else setErr(r.message)
  }

  const overdue=schedules.filter(s=>s.status==='Overdue').length
  const due7=schedules.filter(s=>s.nextDue&&new Date(s.nextDue)<=new Date(Date.now()+7*86400000)).length

  const q = searchTerm.toLowerCase()
  const fSched = schedules.filter(s => !q || (s.title||'').toLowerCase().includes(q) || (s.machineName||'').toLowerCase().includes(q))
  const fLogs = logs.filter(l => !q || (l.description||'').toLowerCase().includes(q) || (l.machineName||'').toLowerCase().includes(q))
  const fEquip = equipment.filter(e => !q || (e.name||'').toLowerCase().includes(q) || (e.code||'').toLowerCase().includes(q))
  const fMotors = motors.filter(m => !q || (m.motor_name||'').toLowerCase().includes(q))

  return(
    <div style={S.page}>
      <div style={S.header}>
        <div>
          <div style={S.title}>Maintenance</div>
          <div style={S.sub}>{totalS} scheduled · {totalL} logs</div>
        </div>
        <div style={{display:'flex',gap:8}}>
          <button style={{...S.btnSecondary,borderColor:'#ef4444',color:'#ef4444'}} onClick={openBreakdown}>⚠ Breakdown</button>
          {tab==='equipment' ? (
            <div style={{display:'flex', gap:8, flexWrap:'wrap'}}>
              <button style={S.btnSecondary}>⬇ Export Excel</button>
              <button style={S.btnSecondary}>⬆ Import Excel</button>
              <button style={S.btnSecondary}>📷 Attach Scan</button>
              <button style={S.btnSecondary} onClick={openInspection}>+ Log Inspection</button>
              <button style={S.btnPrimary} onClick={openEquipment}>+ Add Equipment</button>
            </div>
          ) : (
            <>
              <button style={S.btnSecondary} onClick={openLog}>+ Log Work</button>
              <button style={S.btnPrimary} onClick={openSchedule}>+ Schedule PM</button>
            </>
          )}
        </div>
      </div>

      <div style={S.kpiRow}>
        <div style={S.kpi}><div style={S.kpiLabel}>Scheduled</div><div style={S.kpiVal}>{totalS}</div></div>
        <div style={{...S.kpi,borderColor:'#ef444444'}}><div style={S.kpiLabel}>Overdue</div><div style={{...S.kpiVal,color:'#ef4444'}}>{overdue}</div></div>
        <div style={{...S.kpi,borderColor:'#f9731644'}}><div style={S.kpiLabel}>Due in 7 days</div><div style={{...S.kpiVal,color:'#f97316'}}>{due7}</div></div>
        <div style={S.kpi}><div style={S.kpiLabel}>Log Entries</div><div style={S.kpiVal}>{totalL}</div></div>
      </div>

      <div style={S.tabs}>
        {['schedule','logs','equipment','bearing','motors'].map(t=><button key={t} style={{...S.tabBtn,...(tab===t?S.tabActive:{})}} onClick={()=>setTab(t)}>{t==='schedule'?'PM Schedule':t==='logs'?'Work Logs':t==='equipment'?'Equipment & Inspections (F1/F2)':t==='bearing'?'Bearing Checklist':'Motor Specs (F2)'}</button>)}
      </div>

      <div style={{ marginBottom: 16 }}>
        <input style={{...S.input, maxWidth: 300}} placeholder={`Search in ${tab}...`} value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} />
      </div>

      {tab==='schedule'&&(
        <div style={S.tableWrap}>
          {loading?<div style={S.loading}>Loading...</div>:(
            <table style={S.table}><thead><tr style={S.thead}>
              {['Action','Machine','Type','Title','Frequency','Next Due','Est. Hours','Status','Assigned To'].map(h=><th key={h} style={S.th}>{h}</th>)}
            </tr></thead><tbody>
              {fSched.length===0&&<tr><td colSpan={9} style={S.empty}>No schedule found</td></tr>}
              {fSched.map(s=>(
                <tr key={s.id} style={S.tr}>
                  <td style={S.td}>
                    <button style={{ ...S.btnSecondary, padding: '4px 8px', fontSize: 12 }} onClick={() => openEditSchedule(s)}>✏️ Edit</button>
                  </td>
                  <td style={S.td}>{s.machineName}</td>
                  <td style={S.td}><span style={S.muted}>{s.maintenanceType}</span></td>
                  <td style={S.td}>{s.title}</td>
                  <td style={S.td}><span style={S.muted}>{s.frequencyDays||'—'} days</span></td>
                  <td style={S.td}><span style={{color:s.status==='Overdue'?'#ef4444':'#1b1b1d'}}>{s.nextDue?.slice(0,10)||'—'}</span></td>
                  <td style={S.td}>{s.estimatedHours||'—'} hrs</td>
                  <td style={S.td}><span style={{...S.badge,background:STATUS_COLOR[s.status]+'22',color:STATUS_COLOR[s.status],border:`1px solid ${STATUS_COLOR[s.status]}44`}}>{s.status}</span></td>
                  <td style={S.td}><span style={S.muted}>{s.assignedTo||'—'}</span></td>
                </tr>
              ))}
            </tbody></table>
          )}
        </div>
      )}

      {tab==='logs'&&(
        <div style={S.tableWrap}>
          <table style={S.table}><thead><tr style={S.thead}>
            {['Machine','Date','Type','Description','Duration','Cost','Performed By'].map(h=><th key={h} style={S.th}>{h}</th>)}
          </tr></thead><tbody>
            {fLogs.length===0&&<tr><td colSpan={7} style={S.empty}>No work logs found</td></tr>}
            {fLogs.map(l=>(
              <tr key={l.id} style={S.tr}>
                <td style={S.td}>{l.machineName}</td>
                <td style={S.td}><span style={S.muted}>{l.date?.slice(0,10)}</span></td>
                <td style={S.td}><span style={S.muted}>{l.maintenanceType}</span></td>
                <td style={S.td}>{l.description?.slice(0,50)||'—'}</td>
                <td style={S.td}>{l.durationHours!=null?`${Number(l.durationHours).toFixed(1)} hrs`:'—'}</td>
                <td style={S.td}>{l.cost?`₹${Number(l.cost).toLocaleString('en-IN')}`:'—'}</td>
                <td style={S.td}><span style={S.muted}>{l.performedBy}</span></td>
              </tr>
            ))}
          </tbody></table>
        </div>
      )}

      {tab==='equipment'&&(
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div style={{ background: '#ffffff', border: '1px solid #e7e6df', borderRadius: 10, padding: 16 }}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Motors / Pumps Equipment Master</div>
            <div style={S.tableWrap}>
              <table style={S.table}><thead><tr style={S.thead}>
                {['Action','Code','Name','Type','Section','Spec'].map(h=><th key={h} style={S.th}>{h}</th>)}
              </tr></thead><tbody>
                {fEquip.length===0&&<tr><td colSpan={6} style={S.empty}>No equipment found</td></tr>}
                {fEquip.map(e=>(
                  <tr key={e.id} style={S.tr}>
                    <td style={S.td}>
                      <button style={{ ...S.btnSecondary, padding: '4px 8px', fontSize: 12 }} onClick={() => openEditEquipment(e)}>✏️ Edit</button>
                    </td>
                    <td style={S.td}><strong>{e.code}</strong></td>
                    <td style={S.td}>{e.name}</td>
                    <td style={S.td}><span style={S.muted}>{e.type}</span></td>
                    <td style={S.td}><span style={S.muted}>{e.sectionName || '—'}</span></td>
                    <td style={S.td}>{e.hp ? `${e.hp} HP` : ''} {e.amps ? `/ ${e.amps} A` : ''}</td>
                  </tr>
                ))}
              </tbody></table>
            </div>
          </div>
          <div style={{ background: '#ffffff', border: '1px solid #e7e6df', borderRadius: 10, padding: 16 }}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Inspection Log Feed (F1)</div>
            <div style={S.tableWrap}>
              <table style={S.table}><thead><tr style={S.thead}>
                {['Date', 'Equipment', 'Inspector', 'Status', 'Remarks'].map(h=><th key={h} style={S.th}>{h}</th>)}
              </tr></thead><tbody>
                {inspections.length===0 && <tr><td colSpan={5} style={S.empty}>No inspections recorded</td></tr>}
                {inspections.map(ins=>(
                  <tr key={ins.id} style={S.tr}>
                    <td style={S.td}><span style={S.muted}>{ins.check_date?.slice(0, 10)}</span></td>
                    <td style={S.td}>{ins.equipmentName}</td>
                    <td style={S.td}><span style={S.muted}>{ins.inspectorName}</span></td>
                    <td style={S.td}>
                      <span style={{ ...S.badge, background: ins.status==='Normal' ? '#22c55e22' : '#ef444422', color: ins.status==='Normal' ? '#22c55e' : '#ef4444' }}>
                        {ins.status}
                      </span>
                    </td>
                    <td style={S.td}><span style={S.muted}>{ins.remarks || '—'}</span></td>
                  </tr>
                ))}
              </tbody></table>
            </div>
          </div>
        </div>
      )}

      {tab==='bearing'&&(()=>{
        const canWrite = hasBearingWriteAccess(user)
        return (
        <div style={{ background: '#ffffff', border: '1px solid #e7e6df', borderRadius: 10, padding: 16 }}>
          {!canWrite && <div style={{...S.muted, marginBottom:12, fontSize:12}}>View only — your department can't log bearing checks.</div>}
          <div style={{ display:'flex', gap:14, alignItems:'flex-end', marginBottom:16, flexWrap:'wrap' }}>
            <label style={S.label}>Section<select style={S.select} value={bcSection} onChange={e=>setBcSection(e.target.value)}>
              <option value="">Select section...</option>
              {sections.map(s=><option key={s.id} value={s.id}>{s.name} ({s.code})</option>)}
            </select></label>
            {canWrite && <>
              <label style={S.label}>Shift<select style={S.select} value={bcShift} onChange={e=>setBcShift(e.target.value)}>
                <option>Day</option><option>Night</option>
              </select></label>
              <button style={S.btnPrimary} disabled={bcSaving||!bcSection} onClick={submitBcRound}>{bcSaving?'Saving...':'Submit Round'}</button>
            </>}
            <button style={S.btnSecondary} disabled={!bcSection} onClick={exportBcExcel}>⬇ Export Excel</button>
            {canWrite && <>
              <button style={S.btnSecondary} disabled={!bcSection||bcSaving} onClick={()=>document.getElementById('bcImportInput').click()}>⬆ Import Excel</button>
              <input id="bcImportInput" type="file" accept=".xlsx" style={{display:'none'}} onChange={e=>{ if(e.target.files[0]) importBcExcel(e.target.files[0]); e.target.value='' }}/>
              <button style={S.btnSecondary} disabled={!bcSection} onClick={()=>document.getElementById('bcScanInput').click()}>📷 Attach Scan</button>
              <input id="bcScanInput" type="file" accept=".jpg,.jpeg,.png,.pdf" style={{display:'none'}} onChange={e=>{ if(e.target.files[0]) uploadBcScan(e.target.files[0]); e.target.value='' }}/>
            </>}
            {bcMsg&&<span style={{fontSize:13,color:bcMsg.includes('critical')?'#ef4444':'#8a8a90'}}>{bcMsg}</span>}
          </div>
          {bcSection && bcScans.length>0 && (
            <div style={{marginBottom:16, display:'flex', gap:8, flexWrap:'wrap'}}>
              {bcScans.map(s=>(
                <a key={s.id} href={s.file_url} target="_blank" rel="noreferrer" style={{fontSize:12, color:'#1b1b1d', background:'#f6f5f0', border:'1px solid #e7e6df', borderRadius:6, padding:'4px 8px', textDecoration:'none'}}>
                  📎 {s.original_name} ({s.uploadedByName}, {s.uploaded_at?.slice(0,10)})
                </a>
              ))}
            </div>
          )}
          <style>{`
            @media (max-width: 640px) {
              .bearing-grid thead { display: none; }
              .bearing-grid, .bearing-grid tbody, .bearing-grid tr, .bearing-grid td { display: block; width: 100%; }
              .bearing-grid tr { border: 1px solid #e7e6df; border-radius: 8px; margin-bottom: 10px; padding: 8px; }
              .bearing-grid td { border: none !important; padding: 6px 4px !important; }
              .bearing-grid td::before { content: attr(data-label); display: block; font-size: 11px; color: #8a8a90; font-weight: 600; text-transform: uppercase; margin-bottom: 2px; }
            }
          `}</style>
          <div style={S.tableWrap}>
            <table className="bearing-grid" style={S.table}><thead><tr style={S.thead}>
              {['Roll / Component','F/S','B/S','Remarks'].map(h=><th key={h} style={S.th}>{h}</th>)}
            </tr></thead><tbody>
              {!bcSection&&<tr><td colSpan={4} style={S.empty}>Pick a section to load its checklist</td></tr>}
              {bcSection&&bcGrid.length===0&&<tr><td colSpan={4} style={S.empty}>No rolls seeded for this section</td></tr>}
              {bcGrid.map(row=>{
                const r=bcReadings[row.id]||{fs_status:'Normal',bs_status:'Normal',fs_number:'',bs_number:'',fs_temp:'',bs_temp:'',fs_vibration:'',bs_vibration:'',remarks:''}
                const isCrit=r.fs_status==='Critical'||r.bs_status==='Critical'
                return (
                  <tr key={row.id} style={{...S.tr, background: isCrit?'#ef444411':'transparent'}}>
                    <td style={S.td} data-label="Roll"><strong>{row.name}</strong><div style={S.muted}>{row.code}</div></td>
                    <td style={S.td} data-label="F/S">{canWrite ? (
                      <div style={{display:'flex', gap:'4px', flexDirection:'column'}}>
                        <select style={S.select} value={r.fs_status} onChange={e=>patchBc(row.id,'fs_status',e.target.value)}>
                          <option>Normal</option><option>Needs Attention</option><option>Critical</option>
                        </select>
                        <input style={{...S.input, fontSize:'11px', padding:'4px'}} placeholder="Bearing No." value={r.fs_number||''} onChange={e=>patchBc(row.id,'fs_number',e.target.value)} />
                        <div style={{display:'flex', gap:'4px'}}>
                          <input type="number" step="0.1" style={{...S.input, fontSize:'11px', padding:'4px'}} placeholder="Temp °C" value={r.fs_temp||''} onChange={e=>patchBc(row.id,'fs_temp',e.target.value)} />
                          <input type="number" step="0.1" style={{...S.input, fontSize:'11px', padding:'4px'}} placeholder="Vib mm/s" value={r.fs_vibration||''} onChange={e=>patchBc(row.id,'fs_vibration',e.target.value)} />
                        </div>
                      </div>
                    ) : <span style={{color:r.fs_status==='Critical'?'#ef4444':'#1b1b1d'}}>{r.fs_status} {r.fs_number ? `(${r.fs_number})` : ''} {r.fs_temp ? `${r.fs_temp}°C` : ''} {r.fs_vibration ? `${r.fs_vibration}mm/s` : ''}</span>}</td>
                    <td style={S.td} data-label="B/S">{canWrite ? (
                      <div style={{display:'flex', gap:'4px', flexDirection:'column'}}>
                        <select style={S.select} value={r.bs_status} onChange={e=>patchBc(row.id,'bs_status',e.target.value)}>
                          <option>Normal</option><option>Needs Attention</option><option>Critical</option>
                        </select>
                        <input style={{...S.input, fontSize:'11px', padding:'4px'}} placeholder="Bearing No." value={r.bs_number||''} onChange={e=>patchBc(row.id,'bs_number',e.target.value)} />
                        <div style={{display:'flex', gap:'4px'}}>
                          <input type="number" step="0.1" style={{...S.input, fontSize:'11px', padding:'4px'}} placeholder="Temp °C" value={r.bs_temp||''} onChange={e=>patchBc(row.id,'bs_temp',e.target.value)} />
                          <input type="number" step="0.1" style={{...S.input, fontSize:'11px', padding:'4px'}} placeholder="Vib mm/s" value={r.bs_vibration||''} onChange={e=>patchBc(row.id,'bs_vibration',e.target.value)} />
                        </div>
                      </div>
                    ) : <span style={{color:r.bs_status==='Critical'?'#ef4444':'#1b1b1d'}}>{r.bs_status} {r.bs_number ? `(${r.bs_number})` : ''} {r.bs_temp ? `${r.bs_temp}°C` : ''} {r.bs_vibration ? `${r.bs_vibration}mm/s` : ''}</span>}</td>
                    <td style={S.td} data-label="Remarks">{canWrite ? (
                      <input style={S.input} value={r.remarks} onChange={e=>patchBc(row.id,'remarks',e.target.value)} placeholder="—"/>
                    ) : (r.remarks || '—')}</td>
                  </tr>
                )
              })}
            </tbody></table>
          </div>
        </div>
        )
      })()}

      {tab==='motors'&&(
        <div style={{ background: '#ffffff', border: '1px solid #e7e6df', borderRadius: 10, padding: 16 }}>
          <div style={{ display:'flex', gap:14, alignItems:'flex-end', marginBottom:16, flexWrap:'wrap', justifyContent:'space-between' }}>
            <label style={S.label}>Section<select style={S.select} value={motorFilter} onChange={e=>setMotorFilter(e.target.value)}>
              <option value="">All sections</option>
              {motorSections.map(s=><option key={s.section_label} value={s.section_label}>{s.section_label} ({s.count})</option>)}
            </select></label>
            <div style={{ display:'flex', gap: 8, flexWrap: 'wrap' }}>
              <button style={S.btnSecondary}>⬇ Export Excel</button>
              <button style={S.btnSecondary}>⬆ Import Excel</button>
              <button style={S.btnSecondary}>📷 Attach Scan</button>
              {canEditMotors && <button style={S.btnPrimary} onClick={openMotor}>+ Add Motor</button>}
            </div>
          </div>
          <div style={S.tableWrap}>
            <table style={S.table}><thead><tr style={S.thead}>
              {['Sr','Motor Name','KW','HP','RPM','Full-Amp','Bearing No-FS','Bearing No-BS','Section',''].map(h=><th key={h} style={S.th}>{h}</th>)}
            </tr></thead><tbody>
              {motors.length===0&&<tr><td colSpan={10} style={S.empty}>No motors — pick a section or add one</td></tr>}
              {motors.map(m=>(
                <tr key={m.id} style={S.tr}>
                  <td style={S.td}><span style={S.muted}>{m.sr_no}</span></td>
                  <td style={S.td}><strong>{m.motor_name}</strong></td>
                  <td style={S.td}>{m.kw??'—'}</td>
                  <td style={S.td}>{m.hp??'—'}</td>
                  <td style={S.td}>{m.rpm??'—'}</td>
                  <td style={S.td}>{m.full_amp??'—'}</td>
                  <td style={S.td}><span style={S.muted}>{m.bearing_no_fs||'—'}</span></td>
                  <td style={S.td}><span style={S.muted}>{m.bearing_no_bs||'—'}</span></td>
                  <td style={S.td}><span style={S.muted}>{m.section_label}</span></td>
                  <td style={S.td}>{canEditMotors && <>
                    <button style={S.btnIcon} onClick={()=>openEditMotor(m)}>✎</button>
                    <button style={S.btnIcon} onClick={()=>deleteMotor(m.id)}>🗑</button>
                  </>}</td>
                </tr>
              ))}
            </tbody></table>
          </div>
        </div>
      )}

      {modal==='motor'&&(
        <div style={S.overlay} onClick={()=>setModal(null)}>
          <div style={{...S.modal,maxWidth:520}} onClick={e=>e.stopPropagation()}>
            <div style={S.modalHeader}><div style={S.modalTitle}>{form.id?'Edit':'Add'} Motor Electrical Spec</div><button style={S.close} onClick={()=>setModal(null)}>✕</button></div>
            <form onSubmit={saveMotor} style={S.form}>
              <label style={S.label}>Motor Name *<input style={S.input} value={form.motor_name} onChange={e=>setForm(f=>({...f,motor_name:e.target.value}))} required/></label>
              <label style={S.label}>Section *<select style={S.select} value={form.section_label} onChange={e=>setForm(f=>({...f,section_label:e.target.value}))} required>
                <option value="">Select...</option>
                {sections.map(s=><option key={s.id} value={s.name}>{s.name}</option>)}
              </select></label>
              <div style={S.grid2}>
                {F('kw','KW','number')}
                {F('hp','HP','number')}
                {F('rpm','RPM','number')}
                {F('full_amp','Full-Amp','number')}
                {F('bearing_no_fs','Bearing No-FS','text')}
                {F('bearing_no_bs','Bearing No-BS','text')}
              </div>
              {err&&<div style={S.error}>{err}</div>}
              <div style={S.modalFooter}>
                <button type="button" style={S.btnSecondary} onClick={()=>setModal(null)}>Cancel</button>
                <button type="submit" style={S.btnPrimary} disabled={saving}>{saving?'Saving...':(form.id?'Save':'Add Motor')}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {modal==='schedule'&&(
        <div style={S.overlay} onClick={()=>setModal(null)}>
          <div style={{...S.modal,maxWidth:560}} onClick={e=>e.stopPropagation()}>
            <div style={S.modalHeader}><div style={S.modalTitle}>Schedule Preventive Maintenance</div><button style={S.close} onClick={()=>setModal(null)}>✕</button></div>
            <form onSubmit={saveSchedule} style={S.form}>
              <div style={S.grid2}>
                <label style={S.label}>Machine *<select style={S.select} value={form.machine_id} onChange={e=>setForm(f=>({...f,machine_id:e.target.value}))}>
                  <option value="">Select...</option>{machines.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}
                </select></label>
                <label style={S.label}>Type<select style={S.select} value={form.maintenance_type} onChange={e=>setForm(f=>({...f,maintenance_type:e.target.value}))}>
                  {MAINT_TYPES.map(t=><option key={t}>{t}</option>)}
                </select></label>
                <label style={S.label}>Priority<select style={S.select} value={form.priority} onChange={e=>setForm(f=>({...f,priority:e.target.value}))}>
                  <option value="High">High</option>
                  <option value="Medium">Medium</option>
                  <option value="Low">Low</option>
                </select></label>
                <label style={S.label}>Position<select style={S.select} value={form.position_id} onChange={e=>setForm(f=>({...f,position_id:e.target.value}))}>
                  <option value="">Whole Machine</option>{positions.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
                </select></label>
                {F('title','Title *','text','Bearing replacement...')}
                {F('frequency_days','Frequency (days)','number')}
                {F('next_due','Next Due Date','date')}
                {F('estimated_hours','Est. Hours','number')}
                <label style={S.label}>Assigned To<select style={S.select} value={form.assigned_to} onChange={e=>setForm(f=>({...f,assigned_to:e.target.value}))}>
                  <option value="">Select...</option>{users.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}
                </select></label>
                <div style={{ gridColumn: '1 / -1' }}>
                  {F('materials_needed','Materials / Spares Needed','text','e.g. Grease, 2x Bearings')}
                </div>
              </div>
              {err&&<div style={S.error}>{err}</div>}
              <div style={S.modalFooter}>
                <button type="button" style={S.btnSecondary} onClick={()=>setModal(null)}>Cancel</button>
                <button type="submit" style={S.btnPrimary} disabled={saving}>{saving?'Saving...':(form.id?'Save':'Schedule')}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {modal==='log'&&(
        <div style={S.overlay} onClick={()=>setModal(null)}>
          <div style={{...S.modal,maxWidth:600}} onClick={e=>e.stopPropagation()}>
            <div style={S.modalHeader}><div style={S.modalTitle}>Log Maintenance Work</div><button style={S.close} onClick={()=>setModal(null)}>✕</button></div>
            <form onSubmit={saveLog} style={S.form}>
              <div style={S.grid2}>
                <label style={S.label}>Machine *<select style={S.select} value={form.machine_id} onChange={e=>setForm(f=>({...f,machine_id:e.target.value}))}>
                  <option value="">Select...</option>{machines.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}
                </select></label>
                <label style={S.label}>Type<select style={S.select} value={form.maintenance_type} onChange={e=>setForm(f=>({...f,maintenance_type:e.target.value}))}>
                  {MAINT_TYPES.map(t=><option key={t}>{t}</option>)}
                </select></label>
                {F('date','Date *','date')}
                {F('cost','Cost (₹)','number')}
                {F('start_time','Start Time','datetime-local')}
                {F('end_time','End Time','datetime-local')}
              </div>
              <label style={S.label}>Description<textarea style={{...S.input,height:60,resize:'vertical'}} value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))} /></label>
              <label style={S.label}>Work Done<textarea style={{...S.input,height:60,resize:'vertical'}} value={form.work_done} onChange={e=>setForm(f=>({...f,work_done:e.target.value}))} /></label>
              {err&&<div style={S.error}>{err}</div>}
              <div style={S.modalFooter}>
                <button type="button" style={S.btnSecondary} onClick={()=>setModal(null)}>Cancel</button>
                <button type="submit" style={S.btnPrimary} disabled={saving}>{saving?'Saving...':'Log Work'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {modal==='breakdown'&&(
        <div style={S.overlay} onClick={()=>setModal(null)}>
          <div style={{...S.modal,maxWidth:480}} onClick={e=>e.stopPropagation()}>
            <div style={S.modalHeader}><div style={{...S.modalTitle,color:'#ef4444'}}>⚠ Mark Breakdown</div><button style={S.close} onClick={()=>setModal(null)}>✕</button></div>
            <form onSubmit={saveBreakdown} style={S.form}>
              <label style={S.label}>Machine *<select style={S.select} value={form.machine_id} onChange={e=>setForm(f=>({...f,machine_id:e.target.value}))}>
                <option value="">Select...</option>{machines.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}
              </select></label>
              {F('start_time','Breakdown Time','datetime-local')}
              <label style={S.label}>Description<textarea style={{...S.input,height:80,resize:'vertical'}} value={form.description||''} onChange={e=>setForm(f=>({...f,description:e.target.value}))} placeholder="What broke?" /></label>
              {err&&<div style={S.error}>{err}</div>}
              <div style={S.modalFooter}>
                <button type="button" style={S.btnSecondary} onClick={()=>setModal(null)}>Cancel</button>
                <button type="submit" style={{...S.btnPrimary,background:'#ef4444'}} disabled={saving}>{saving?'Logging...':'Log Breakdown'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {modal==='equipment'&&(
        <div style={S.overlay} onClick={()=>setModal(null)}>
          <div style={{...S.modal,maxWidth:480}} onClick={e=>e.stopPropagation()}>
            <div style={S.modalHeader}><div style={S.modalTitle}>{form.id ? 'Edit Equipment' : 'Add Plant Equipment (Motors/Pumps)'}</div><button style={S.close} onClick={()=>setModal(null)}>✕</button></div>
            <form onSubmit={saveEquipment} style={S.form}>
              <label style={S.label}>Name *<input style={S.input} value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} required placeholder="e.g. Pump Motor" /></label>
              <label style={S.label}>Code / Tag *<input style={S.input} value={form.code} onChange={e=>setForm(f=>({...f,code:e.target.value}))} required placeholder="e.g. EQ_PM1_M01" /></label>
              <label style={S.label}>Type<select style={S.select} value={form.type} onChange={e=>setForm(f=>({...f,type:e.target.value}))}>
                <option>Motor</option><option>Pump</option><option>Roll</option><option>Agitator</option><option>Fan</option>
              </select></label>
              <label style={S.label}>Plant Section<select style={S.select} value={form.section_id} onChange={e=>setForm(f=>({...f,section_id:e.target.value}))}>
                <option value="">Select section...</option>
                {sections.map(s=><option key={s.id} value={s.id}>{s.name} ({s.code})</option>)}
              </select></label>
              <div style={S.grid2}>
                {F('hp','HP Rating','number')}
                {F('amps','Amp Rating','number')}
              </div>
              {err&&<div style={S.error}>{err}</div>}
              <div style={S.modalFooter}>
                <button type="button" style={S.btnSecondary} onClick={()=>setModal(null)}>Cancel</button>
                <button type="submit" style={S.btnPrimary} disabled={saving}>{saving?'Saving...':(form.id?'Save':'Add Equipment')}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {modal==='inspection'&&(
        <div style={S.overlay} onClick={()=>setModal(null)}>
          <div style={{...S.modal,maxWidth:480}} onClick={e=>e.stopPropagation()}>
            <div style={S.modalHeader}><div style={S.modalTitle}>Log Equipment Inspection Log (F1)</div><button style={S.close} onClick={()=>setModal(null)}>✕</button></div>
            <form onSubmit={saveInspection} style={S.form}>
              <label style={S.label}>Equipment *<select style={S.select} value={form.equipment_id} onChange={e=>setForm(f=>({...f,equipment_id:e.target.value}))} required>
                <option value="">Select equipment...</option>
                {equipment.map(e=><option key={e.id} value={e.id}>{e.name} ({e.code})</option>)}
              </select></label>
              <label style={S.label}>Status<select style={S.select} value={form.status} onChange={e=>setForm(f=>({...f,status:e.target.value}))}>
                <option>Normal</option><option>Needs Attention</option><option>Critical</option>
              </select></label>
              {F('check_date','Inspection Date','date')}
              {F('next_check_date','Next Due Date','date')}
              <label style={S.label}>Remarks / Observations<textarea style={{...S.input,height:80}} value={form.remarks} onChange={e=>setForm(f=>({...f,remarks:e.target.value}))} /></label>
              {err&&<div style={S.error}>{err}</div>}
              <div style={S.modalFooter}>
                <button type="button" style={S.btnSecondary} onClick={()=>setModal(null)}>Cancel</button>
                <button type="submit" style={S.btnPrimary} disabled={saving}>{saving?'Saving...':'Save Log'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
const S={page:{padding:24,background:'#f6f5f0',minHeight:'100vh',color:'#1b1b1d'},header:{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:20},title:{fontSize:22,fontWeight:700,color:'#1b1b1d'},sub:{fontSize:13,color:'#8a8a90',marginTop:2},kpiRow:{display:'flex',gap:12,marginBottom:16,flexWrap:'wrap'},kpi:{background:'#ffffff',border:'1px solid #e7e6df',borderRadius:8,padding:'12px 20px'},kpiLabel:{fontSize:12,color:'#8a8a90',marginBottom:4},kpiVal:{fontSize:22,fontWeight:700,color:'#1b1b1d'},tabs:{display:'flex',gap:4,marginBottom:16,borderBottom:'1px solid #e7e6df'},tabBtn:{background:'none',border:'none',color:'#8a8a90',padding:'8px 16px',cursor:'pointer',fontSize:13,fontWeight:500,borderBottom:'2px solid transparent',marginBottom:-1},tabActive:{color:'#1b1b1d',borderBottom:'2px solid #1b1b1d'},tableWrap:{background:'#ffffff',borderRadius:10,overflow:'auto',border:'1px solid #e7e6df'},table:{width:'100%',borderCollapse:'collapse',fontSize:13},thead:{background:'#f6f5f0'},th:{padding:'10px 14px',textAlign:'left',color:'#8a8a90',fontWeight:600,fontSize:12,textTransform:'uppercase',borderBottom:'1px solid #e7e6df',whiteSpace:'nowrap'},tr:{borderBottom:'1px solid #f1efe8'},td:{padding:'10px 14px',verticalAlign:'middle'},muted:{color:'#a0a0a6',fontSize:12},badge:{fontSize:11,fontWeight:600,padding:'2px 8px',borderRadius:20,display:'inline-block'},btnIcon:{background:'none',border:'none',cursor:'pointer',fontSize:14},empty:{padding:40,textAlign:'center',color:'#8a8a90'},loading:{padding:40,textAlign:'center',color:'#8a8a90'},overlay:{position:'fixed',inset:0,background:'rgba(0,0,0,0.7)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000},modal:{background:'#ffffff',borderRadius:12,padding:24,width:'100%',border:'1px solid #e7e6df',maxHeight:'90vh',overflowY:'auto'},modalHeader:{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16},modalTitle:{fontSize:16,fontWeight:700,color:'#1b1b1d'},close:{background:'none',border:'none',color:'#a0a0a6',fontSize:18,cursor:'pointer'},form:{display:'flex',flexDirection:'column',gap:14},grid2:{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14},label:{display:'flex',flexDirection:'column',gap:5,fontSize:12,color:'#a0a0a6',fontWeight:600},input:{background:'#f6f5f0',border:'1px solid #e7e6df',borderRadius:6,padding:'8px 10px',color:'#1b1b1d',fontSize:13,outline:'none'},select:{background:'#f6f5f0',border:'1px solid #e7e6df',borderRadius:6,padding:'8px 10px',color:'#1b1b1d',fontSize:13},error:{background:'#ef444422',border:'1px solid #ef444444',color:'#f87171',padding:'8px 12px',borderRadius:6,fontSize:13},modalFooter:{display:'flex',gap:10,justifyContent:'flex-end',marginTop:8},btnPrimary:{background:'#1b1b1d',color:'#fff',border:'none',borderRadius:8,padding:'8px 18px',fontWeight:600,fontSize:13,cursor:'pointer'},btnSecondary:{background:'#e7e6df',color:'#1b1b1d',border:'none',borderRadius:8,padding:'8px 18px',fontWeight:600,fontSize:13,cursor:'pointer'}}
