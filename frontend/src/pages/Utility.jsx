import React, { useState, useEffect, useCallback } from 'react'
const API=(p,o)=>fetch(p,{headers:{Authorization:`Bearer ${localStorage.getItem('mk_token')}`,'Content-Type':'application/json',...(o?.headers||{})},...o}).then(r=>r.json())
const n=(v,d=2)=>v!=null?Number(v).toFixed(d):'—'
const empty={date:'',shift_type:'Day',reading_time:'',power_units:'',dg_units:'',steam_generated_mt:'',coal_consumed_kg:'',boiler_pressure:'',boiler_temp:'',fresh_water_kl:'',process_water_kl:'',air_pressure:'',etp_inlet_kl:'',etp_outlet_kl:''}
const emptyETP={date:'',reading_time:'',ph:'',cod:'',bod:'',tss:'',tds:'',flow_rate:'',remarks:''}
const emptyBoiler={log_time:'',steam_flow_kgh:'',steam_pressure_bar:'',feedwater_temp_c:'',flue_gas_temp_c:'',husk_consumed_kg:'',blowdown_rate_pct:''}
const emptyEnergy={allocated_date:'',section_id:'',power_kwh:'',steam_mt:'',water_kl:''}

export default function Utility() {
  const [tab, setTab] = useState('utility')
  const [rows,setRows]=useState([]),[total,setTotal]=useState(0),[loading,setLoading]=useState(true)
  const [etpRows,setEtpRows]=useState([])
  const [boilerRows,setBoilerRows]=useState([])
  const [energyRows,setEnergyRows]=useState([])
  const [sections,setSections]=useState([])
  const [summary,setSummary]=useState(null)
  const [fDate,setFDate]=useState(new Date().toISOString().slice(0,10))
  const [fShift,setFShift]=useState(''),[page,setPage]=useState(1)
  const [modal,setModal]=useState(false) // 'utility' | 'etp' | 'boiler' | 'energy'
  const [form,setForm]=useState(empty)
  const [etpForm,setEtpForm]=useState(emptyETP)
  const [boilerForm,setBoilerForm]=useState(emptyBoiler)
  const [energyForm,setEnergyForm]=useState(emptyEnergy)
  const [saving,setSaving]=useState(false),[err,setErr]=useState('')
  const LIMIT=30

  const load=useCallback(async()=>{
    setLoading(true)
    const p=new URLSearchParams({page,limit:LIMIT})
    if(fDate)  p.set('date',fDate)
    if(fShift) p.set('shift_type',fShift)
    
    const [r,s,e,b,ea,sc] = await Promise.all([
      API(`/api/utility/readings?${p}`),
      API(`/api/utility/summary?date=${fDate||new Date().toISOString().slice(0,10)}`),
      API(`/api/utility/etp-readings${fDate ? `?date=${fDate}` : ''}`),
      API('/api/telemetry/boiler/logs'),
      API(`/api/telemetry/energy/allocations?date=${fDate||new Date().toISOString().slice(0,10)}`),
      API('/api/sections')
    ])
    if(r.success){setRows(r.data);setTotal(r.total)}
    if(s.success) setSummary(s.data)
    if(e.success) setEtpRows(e.data)
    if(b.success) setBoilerRows(b.data)
    if(ea.success) setEnergyRows(ea.data)
    if(sc.success) setSections(sc.data || sc.rows || [])
    setLoading(false)
  },[page,fDate,fShift])

  useEffect(()=>{load()},[load])

  const F=(key,label,ph='')=>(
    <label style={S.label}>{label}<input style={S.input} type="number" step="any" value={form[key]??''} onChange={e=>setForm(f=>({...f,[key]:e.target.value}))} placeholder={ph}/></label>
  )
  const FE=(key,label,type="number",ph='')=>(
    <label style={S.label}>{label}<input style={S.input} type={type} step="any" value={etpForm[key]??''} onChange={e=>setEtpForm(f=>({...f,[key]:e.target.value}))} placeholder={ph}/></label>
  )
  const FB=(key,label,type="number",ph='')=>(
    <label style={S.label}>{label}<input style={S.input} type={type} step="any" value={boilerForm[key]??''} onChange={e=>setBoilerForm(f=>({...f,[key]:e.target.value}))} placeholder={ph}/></label>
  )
  const FEN=(key,label,ph='')=>(
    <label style={S.label}>{label}<input style={S.input} type="number" step="any" value={energyForm[key]??''} onChange={e=>setEnergyForm(f=>({...f,[key]:e.target.value}))} placeholder={ph}/></label>
  )

  const openNew=()=>{ setForm({...empty,date:fDate,reading_time:`${fDate}T${new Date().toTimeString().slice(0,5)}`}); setErr(''); setModal('utility') }
  const openEdit=(r)=>{ setForm({id:r.id,date:r.date?.slice(0,10)||fDate,shift_type:r.shiftType||'Day',reading_time:r.readingTime?.slice(0,16)||'',power_units:r.powerUnits??'',dg_units:r.dgUnits??'',steam_generated_mt:r.steamGeneratedMt??'',coal_consumed_kg:r.coalConsumedKg??'',boiler_pressure:r.boilerPressure??'',boiler_temp:r.boilerTemp??'',fresh_water_kl:r.freshWaterKl??'',process_water_kl:r.processWaterKl??'',air_pressure:r.airPressure??'',etp_inlet_kl:r.etpInletKl??'',etp_outlet_kl:r.etpOutletKl??''}); setErr(''); setModal('utility') }
  const openNewETP=()=>{ setEtpForm({...emptyETP,date:fDate,reading_time:new Date().toTimeString().slice(0,5)}); setErr(''); setModal('etp') }
  const openNewBoiler=()=>{ setBoilerForm({...emptyBoiler,log_time:`${fDate}T${new Date().toTimeString().slice(0,5)}`}); setErr(''); setModal('boiler') }
  const openNewEnergy=()=>{ setEnergyForm({...emptyEnergy,allocated_date:fDate,section_id:sections[0]?.id||''}); setErr(''); setModal('energy') }

  const save=async e=>{
    e.preventDefault();if(!form.date||!form.reading_time) return setErr('Date + reading time required')
    setSaving(true);setErr('')
    const r=form.id
      ? await API(`/api/utility/readings/${form.id}`,{method:'PUT',body:JSON.stringify(form)})
      : await API('/api/utility/readings',{method:'POST',body:JSON.stringify(form)})
    setSaving(false);if(r.success){setModal(false);load()}else setErr(r.message)
  }
  const saveETP=async e=>{
    e.preventDefault();if(!etpForm.reading_time) return setErr('Reading time required')
    setSaving(true);setErr('')
    const r=await API('/api/utility/etp-readings',{method:'POST',body:JSON.stringify(etpForm)})
    setSaving(false);if(r.success){setModal(false);load()}else setErr(r.message)
  }
  const saveBoiler=async e=>{
    e.preventDefault();if(!boilerForm.log_time) return setErr('Log time is required')
    setSaving(true);setErr('')
    const r=await API('/api/telemetry/boiler',{method:'POST',body:JSON.stringify(boilerForm)})
    setSaving(false);if(r.success){setModal(false);load()}else setErr(r.message)
  }
  const saveEnergy=async e=>{
    e.preventDefault();if(!energyForm.allocated_date||!energyForm.section_id) return setErr('Date and Section are required')
    setSaving(true);setErr('')
    const r=await API('/api/telemetry/energy',{method:'POST',body:JSON.stringify(energyForm)})
    setSaving(false);if(r.success){setModal(false);load()}else setErr(r.message)
  }

  const totalPages=Math.ceil(total/LIMIT)
  return(
    <div style={S.page}>
      <div style={S.header}>
        <div><div style={S.title}>Utility & Effluent Logs</div><div style={S.sub}>{total} records</div></div>
        <div style={{ display: 'flex', gap: 8 }}>
          {tab === 'utility' && <button style={S.btnPrimary} onClick={openNew}>+ Log Boiler/Utility Reading</button>}
          {tab === 'etp' && <button style={S.btnSecondary} onClick={openNewETP}>+ Log ETP Effluent (F6)</button>}
          {tab === 'boiler' && <button style={S.btnPrimary} onClick={openNewBoiler}>+ Log Boiler Stats (Hourly)</button>}
          {tab === 'energy' && <button style={S.btnPrimary} onClick={openNewEnergy}>+ Allocate Energy</button>}
        </div>
      </div>

      {summary&&(
        <div style={S.kpiGrid}>
          <KPI label="Grid Power (units)" val={n(summary.totalPower,0)} color="#1b1b1d"/>
          <KPI label="DG Power (units)" val={n(summary.totalDg,0)} color="#1b1b1d"/>
          <KPI label="Steam (MT)" val={n(summary.totalSteam,3)} color="#f97316"/>
          <KPI label="Coal (kg)" val={n(summary.totalCoal,0)} color="#eab308"/>
          <KPI label="Fresh Water (KL)" val={n(summary.totalFreshWater,3)} color="#1b1b1d"/>
          <KPI label="Process Water (KL)" val={n(summary.totalProcessWater,3)} color="#22c55e"/>
          <KPI label="Avg Boiler Pressure" val={n(summary.avgBoilerPressure)} color="#f43f5e"/>
          <KPI label="Avg Boiler Temp (°C)" val={n(summary.avgBoilerTemp,1)} color="#f43f5e"/>
        </div>
      )}

      <div style={S.tabs}>
        <button style={{ ...S.tabBtn, ...(tab === 'utility' ? S.tabActive : {}) }} onClick={() => setTab('utility')}>Utility & Boiler Logs</button>
        <button style={{ ...S.tabBtn, ...(tab === 'etp' ? S.tabActive : {}) }} onClick={() => setTab('etp')}>ETP Effluent Readings (F6)</button>
        <button style={{ ...S.tabBtn, ...(tab === 'boiler' ? S.tabActive : {}) }} onClick={() => setTab('boiler')}>🌋 Boiler Efficiency</button>
        <button style={{ ...S.tabBtn, ...(tab === 'energy' ? S.tabActive : {}) }} onClick={() => setTab('energy')}>⚡ Section Energy</button>
      </div>

      <div style={S.filterBar}>
        <input style={{...S.input,width:160}} type="date" value={fDate} onChange={e=>{setFDate(e.target.value);setPage(1)}} />
        {tab === 'utility' && (
          <select style={S.select} value={fShift} onChange={e=>{setFShift(e.target.value);setPage(1)}}>
            <option value="">All Shifts</option>
            <option>Day</option><option>Night</option>
          </select>
        )}
        <button style={S.btnSecondary} onClick={load}>↻</button>
      </div>

      {tab === 'utility' && (
        <>
          <div style={S.tableWrap}>
            {loading?<div style={S.loading}>Loading...</div>:(
              <table style={S.table}><thead><tr style={S.thead}>
                {['Time','Shift','Grid(u)','DG(u)','Steam(MT)','Coal(kg)','Boiler°','FreshWater','ProcWater','AirPsi','ETP In','ETP Out','By',''].map(h=><th key={h} style={S.th}>{h}</th>)}
              </tr></thead><tbody>
                {rows.length===0&&<tr><td colSpan={14} style={S.empty}>No readings for this date</td></tr>}
                {rows.map(r=>(
                  <tr key={r.id} style={S.tr}>
                    <td style={S.td}><span style={S.muted}>{r.readingTime?.slice(11,16)}</span></td>
                    <td style={S.td}><span style={S.muted}>{r.shiftType||'—'}</span></td>
                    <td style={S.td}>{n(r.powerUnits,0)}</td>
                    <td style={S.td}>{n(r.dgUnits,0)}</td>
                    <td style={S.td}>{n(r.steamGeneratedMt,3)}</td>
                    <td style={S.td}>{n(r.coalConsumedKg,0)}</td>
                    <td style={S.td}>{r.boilerTemp!=null?`${n(r.boilerTemp,1)}°`:'—'}</td>
                    <td style={S.td}>{n(r.freshWaterKl,3)}</td>
                    <td style={S.td}>{n(r.processWaterKl,3)}</td>
                    <td style={S.td}>{r.airPressure!=null?n(r.airPressure):'—'}</td>
                    <td style={S.td}>{n(r.etpInletKl,3)}</td>
                    <td style={S.td}>{n(r.etpOutletKl,3)}</td>
                    <td style={S.td}><span style={S.muted}>{r.recordedBy}</span></td>
                    <td style={S.td}><button style={{...S.btnSecondary,padding:'4px 10px',fontSize:11}} onClick={()=>openEdit(r)}>Edit</button></td>
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
        </>
      )}

      {tab === 'etp' && (
        <div style={S.tableWrap}>
          {loading ? <div style={S.loading}>Loading...</div> : (
            <table style={S.table}>
              <thead>
                <tr style={S.thead}>
                  {['Date', 'Time', 'pH', 'COD (mg/L)', 'BOD (mg/L)', 'TSS (mg/L)', 'TDS (mg/L)', 'Flow Rate (m³/h)', 'Logged By', 'Remarks'].map(h => <th key={h} style={S.th}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {etpRows.length === 0 && <tr><td colSpan={10} style={S.empty}>No effluent readings logged for this date</td></tr>}
                {etpRows.map(er => (
                  <tr key={er.id} style={S.tr}>
                    <td style={S.td}>{er.date?.slice(0, 10)}</td>
                    <td style={S.td}><strong>{er.reading_time}</strong></td>
                    <td style={S.td}><span style={{ color: er.ph > 8.5 || er.ph < 6.5 ? '#ef4444' : '#22c55e', fontWeight: 'bold' }}>{er.ph}</span></td>
                    <td style={S.td}>{er.cod}</td>
                    <td style={S.td}>{er.bod}</td>
                    <td style={S.td}>{er.tss}</td>
                    <td style={S.td}>{er.tds}</td>
                    <td style={S.td}>{er.flow_rate}</td>
                    <td style={S.td}><span style={S.muted}>{er.loggedByName}</span></td>
                    <td style={S.td}>{er.remarks || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === 'boiler' && (
        <div style={S.tableWrap}>
          {loading ? <div style={S.loading}>Loading...</div> : (
            <table style={S.table}>
              <thead>
                <tr style={S.thead}>
                  {['Log Time', 'Steam Flow (kg/h)', 'Steam Pressure (bar)', 'Feedwater Temp (°C)', 'Flue Gas Temp (°C)', 'Husk Consumed (kg)', 'Blowdown (%)', 'Efficiency (%)', 'Logged By'].map(h => <th key={h} style={S.th}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {boilerRows.length === 0 && <tr><td colSpan={9} style={S.empty}>No boiler hourly logs recorded</td></tr>}
                {boilerRows.map(br => {
                  const eff = Number(br.efficiency_pct || 0);
                  const color = eff >= 80 ? '#22c55e' : eff >= 70 ? '#eab308' : '#ef4444';
                  return (
                    <tr key={br.id} style={S.tr}>
                      <td style={S.td}><strong>{new Date(br.log_time).toLocaleString()}</strong></td>
                      <td style={S.td}>{br.steam_flow_kgh}</td>
                      <td style={S.td}>{br.steam_pressure_bar}</td>
                      <td style={S.td}>{br.feedwater_temp_c}</td>
                      <td style={S.td}>{br.flue_gas_temp_c || '—'}</td>
                      <td style={S.td}>{br.husk_consumed_kg}</td>
                      <td style={S.td}>{br.blowdown_rate_pct}%</td>
                      <td style={S.td}><span style={{ color, fontWeight: 'bold', fontSize: 14 }}>{eff}%</span></td>
                      <td style={S.td}><span style={S.muted}>{br.operatorName || '—'}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === 'energy' && (() => {
        const totalPowerAlloc = energyRows.reduce((a, b) => a + Number(b.power_kwh || 0), 0);
        return (
          <div style={S.tableWrap}>
            {loading ? <div style={S.loading}>Loading...</div> : (
              <table style={S.table}>
                <thead>
                  <tr style={S.thead}>
                    {['Section Code', 'Section Name', 'Power (kWh)', 'Power Share', 'Steam (MT)', 'Water (KL)'].map(h => <th key={h} style={S.th}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {energyRows.length === 0 && <tr><td colSpan={6} style={S.empty}>No energy allocations posted for this date</td></tr>}
                  {energyRows.map(er => {
                    const pct = totalPowerAlloc > 0 ? (Number(er.power_kwh || 0) / totalPowerAlloc) * 100 : 0;
                    return (
                      <tr key={er.id} style={S.tr}>
                        <td style={S.td}><strong>{er.sectionCode}</strong></td>
                        <td style={S.td}>{er.sectionName}</td>
                        <td style={S.td}>{n(er.power_kwh, 0)} kWh</td>
                        <td style={S.td}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ background: '#e7e6df', borderRadius: 4, height: 6, width: 80, overflow: 'hidden' }}>
                              <div style={{ background: '#1b1b1d', height: '100%', width: `${pct}%` }} />
                            </div>
                            <span style={S.muted}>{pct.toFixed(1)}%</span>
                          </div>
                        </td>
                        <td style={S.td}>{n(er.steam_mt, 2)} MT</td>
                        <td style={S.td}>{n(er.water_kl, 1)} KL</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        );
      })()}

      {modal === 'utility' && (
        <div style={S.overlay}>
          <div style={{...S.modal,maxWidth:700}} onClick={e=>e.stopPropagation()}>
            <div style={S.modalHeader}><div style={S.modalTitle}>{form.id?'Edit':'Log'} Utility Reading</div><button style={S.close} onClick={()=>setModal(false)}>✕</button></div>
            <form onSubmit={save} style={S.form}>
              <div style={S.grid2}>
                <label style={S.label}>Date *<input style={S.input} type="date" value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))} /></label>
                <label style={S.label}>Shift<select style={S.select} value={form.shift_type} onChange={e=>setForm(f=>({...f,shift_type:e.target.value}))}>
                  <option>Day</option><option>Night</option>
                </select></label>
                <label style={{...S.label,gridColumn:'1/-1'}}>Reading Time *<input style={S.input} type="datetime-local" value={form.reading_time} onChange={e=>setForm(f=>({...f,reading_time:e.target.value}))} /></label>
              </div>
              <div style={{fontWeight:600,color:'#a0a0a6',fontSize:12}}>⚡ POWER</div>
              <div style={S.grid3}>{F('power_units','Grid Power (units)')}{F('dg_units','DG Power (units)')}</div>
              <div style={{fontWeight:600,color:'#a0a0a6',fontSize:12}}>🔥 STEAM / BOILER</div>
              <div style={S.grid3}>
                {F('steam_generated_mt','Steam Generated (MT)')}
                {F('coal_consumed_kg','Coal Consumed (kg)')}
                {F('boiler_pressure','Boiler Pressure (bar)')}
                {F('boiler_temp','Boiler Temp (°C)')}
              </div>
              <div style={{fontWeight:600,color:'#a0a0a6',fontSize:12}}>💧 WATER</div>
              <div style={S.grid3}>
                {F('fresh_water_kl','Fresh Water (KL)')}
                {F('process_water_kl','Process Water (KL)')}
                {F('air_pressure','Air Pressure (bar)')}
              </div>
              <div style={{fontWeight:600,color:'#a0a0a6',fontSize:12}}>🌊 ETP</div>
              <div style={S.grid3}>{F('etp_inlet_kl','ETP Inlet (KL)')}{F('etp_outlet_kl','ETP Outlet (KL)')}</div>
              {err&&<div style={S.error}>{err}</div>}
              <div style={S.modalFooter}>
                <button type="button" style={S.btnSecondary} onClick={()=>setModal(false)}>Cancel</button>
                <button type="submit" style={S.btnPrimary} disabled={saving}>{saving?'Saving...':form.id?'Update Reading':'Log Reading'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {modal === 'etp' && (
        <div style={S.overlay}>
          <div style={{...S.modal,maxWidth:520}} onClick={e=>e.stopPropagation()}>
            <div style={S.modalHeader}><div style={S.modalTitle}>Log ETP Effluent Readings (F6)</div><button style={S.close} onClick={()=>setModal(false)}>✕</button></div>
            <form onSubmit={saveETP} style={S.form}>
              <div style={S.grid2}>
                {FE('date','Date','date')}
                {FE('reading_time','Reading Time *','time')}
              </div>
              <div style={S.grid3}>
                {FE('ph','pH Value')}
                {FE('cod','COD (mg/L)')}
                {FE('bod','BOD (mg/L)')}
              </div>
              <div style={S.grid3}>
                {FE('tss','TSS (mg/L)')}
                {FE('tds','TDS (mg/L)')}
                {FE('flow_rate','Flow Rate (m³/h)')}
              </div>
              <label style={S.label}>Remarks / Observations<textarea style={{...S.input,height:60}} value={etpForm.remarks} onChange={e=>setEtpForm(f=>({...f,remarks:e.target.value}))} /></label>
              {err&&<div style={S.error}>{err}</div>}
              <div style={S.modalFooter}>
                <button type="button" style={S.btnSecondary} onClick={()=>setModal(false)}>Cancel</button>
                <button type="submit" style={S.btnPrimary} disabled={saving}>{saving?'Saving...':'Log ETP Reading'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {modal === 'boiler' && (
        <div style={S.overlay}>
          <div style={{...S.modal,maxWidth:550}} onClick={e=>e.stopPropagation()}>
            <div style={S.modalHeader}><div style={S.modalTitle}>Log Boiler Stats (Hourly)</div><button style={S.close} onClick={()=>setModal(false)}>✕</button></div>
            <form onSubmit={saveBoiler} style={S.form}>
              <label style={S.label}>Log Time *<input style={S.input} type="datetime-local" value={boilerForm.log_time} onChange={e=>setBoilerForm(f=>({...f,log_time:e.target.value}))} /></label>
              <div style={S.grid2}>
                {FB('steam_flow_kgh', 'Steam Flow (kg/h)')}
                {FB('steam_pressure_bar', 'Steam Pressure (bar)')}
              </div>
              <div style={S.grid2}>
                {FB('feedwater_temp_c', 'Feedwater Temp (°C)')}
                {FB('flue_gas_temp_c', 'Flue Gas Temp (°C)')}
              </div>
              <div style={S.grid2}>
                {FB('husk_consumed_kg', 'Husk Consumed (kg)')}
                {FB('blowdown_rate_pct', 'Blowdown Rate (%)')}
              </div>
              {err&&<div style={S.error}>{err}</div>}
              <div style={S.modalFooter}>
                <button type="button" style={S.btnSecondary} onClick={()=>setModal(false)}>Cancel</button>
                <button type="submit" style={S.btnPrimary} disabled={saving}>{saving?'Saving...':'Calculate & Log Boiler'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {modal === 'energy' && (
        <div style={S.overlay}>
          <div style={{...S.modal,maxWidth:520}} onClick={e=>e.stopPropagation()}>
            <div style={S.modalHeader}><div style={S.modalTitle}>Allocate Daily Section Energy</div><button style={S.close} onClick={()=>setModal(false)}>✕</button></div>
            <form onSubmit={saveEnergy} style={S.form}>
              <div style={S.grid2}>
                <label style={S.label}>Allocated Date *<input style={S.input} type="date" value={energyForm.allocated_date} onChange={e=>setEnergyForm(f=>({...f,allocated_date:e.target.value}))} /></label>
                <label style={S.label}>Plant Section *
                  <select style={S.select} value={energyForm.section_id} onChange={e=>setEnergyForm(f=>({...f,section_id:e.target.value}))}>
                    {sections.map(s => <option key={s.id} value={s.id}>{s.name} ({s.code})</option>)}
                  </select>
                </label>
              </div>
              <div style={S.grid3}>
                {FEN('power_kwh', 'Power (kWh)')}
                {FEN('steam_mt', 'Steam (MT)')}
                {FEN('water_kl', 'Water (KL)')}
              </div>
              {err&&<div style={S.error}>{err}</div>}
              <div style={S.modalFooter}>
                <button type="button" style={S.btnSecondary} onClick={()=>setModal(false)}>Cancel</button>
                <button type="submit" style={S.btnPrimary} disabled={saving}>{saving?'Saving...':'Post Allocation'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
function KPI({label,val,color}){
  return <div style={{background:'#ffffff',border:`1px solid ${color}33`,borderRadius:8,padding:'10px 16px'}}>
    <div style={{fontSize:11,color:'#8a8a90',marginBottom:4}}>{label}</div>
    <div style={{fontSize:18,fontWeight:700,color}}>{val}</div>
  </div>
}
const S={
  page:{padding:24,background:'#f6f5f0',minHeight:'100vh',color:'#1b1b1d'},
  header:{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:20},
  title:{fontSize:22,fontWeight:700,color:'#1b1b1d'},
  sub:{fontSize:13,color:'#8a8a90',marginTop:2},
  kpiGrid:{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12,marginBottom:20},
  filterBar:{display:'flex',gap:10,marginBottom:16,flexWrap:'wrap',alignItems:'center'},
  tabs:{display:'flex',gap:4,marginBottom:16,borderBottom:'1px solid #e7e6df'},
  tabBtn:{background:'none',border:'none',color:'#8a8a90',padding:'8px 16px',cursor:'pointer',fontSize:13,fontWeight:500,borderBottom:'2px solid transparent',marginBottom:-1},
  tabActive:{color:'#1b1b1d',borderBottom:'2px solid #1b1b1d'},
  tableWrap:{background:'#ffffff',borderRadius:10,overflow:'auto',border:'1px solid #e7e6df'},
  table:{width:'100%',borderCollapse:'collapse',fontSize:13},
  thead:{background:'#f6f5f0'},
  th:{padding:'10px 14px',textAlign:'left',color:'#8a8a90',fontWeight:600,fontSize:12,textTransform:'uppercase',borderBottom:'1px solid #e7e6df',whiteSpace:'nowrap'},
  tr:{borderBottom:'1px solid #f1efe8'},
  td:{padding:'10px 14px',verticalAlign:'middle'},
  muted:{color:'#a0a0a6',fontSize:12},
  empty:{padding:40,textAlign:'center',color:'#8a8a90'},
  loading:{padding:40,textAlign:'center',color:'#8a8a90'},
  pagination:{display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:12},
  count:{fontSize:12,color:'#8a8a90'},
  pgBtn:{background:'#ffffff',border:'1px solid #e7e6df',color:'#1b1b1d',borderRadius:6,padding:'5px 12px',cursor:'pointer',fontSize:12},
  pgInfo:{fontSize:12,color:'#a0a0a6',padding:'5px 8px'},
  overlay:{position:'fixed',inset:0,background:'rgba(0,0,0,0.7)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000},
  modal:{background:'#ffffff',borderRadius:12,padding:24,width:'100%',border:'1px solid #e7e6df',maxHeight:'90vh',overflowY:'auto'},
  modalHeader:{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16},
  modalTitle:{fontSize:16,fontWeight:700,color:'#1b1b1d'},
  close:{background:'none',border:'none',color:'#a0a0a6',fontSize:18,cursor:'pointer'},
  form:{display:'flex',flexDirection:'column',gap:14},
  grid2:{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14},
  grid3:{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10},
  label:{display:'flex',flexDirection:'column',gap:5,fontSize:12,color:'#a0a0a6',fontWeight:600},
  input:{background:'#f6f5f0',border:'1px solid #e7e6df',borderRadius:6,padding:'8px 10px',color:'#1b1b1d',fontSize:13,outline:'none'},
  select:{background:'#f6f5f0',border:'1px solid #e7e6df',borderRadius:6,padding:'8px 10px',color:'#1b1b1d',fontSize:13},
  error:{background:'#ef444422',border:'1px solid #ef444444',color:'#f87171',padding:'8px 12px',borderRadius:6,fontSize:13},
  modalFooter:{display:'flex',gap:10,justifyContent:'flex-end',marginTop:8},
  btnPrimary:{background:'#1b1b1d',color:'#fff',border:'none',borderRadius:8,padding:'8px 18px',fontWeight:600,fontSize:13,cursor:'pointer'},
  btnSecondary:{background:'#e7e6df',color:'#1b1b1d',border:'none',borderRadius:8,padding:'8px 18px',fontWeight:600,fontSize:13,cursor:'pointer'}
}
