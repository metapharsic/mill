import React, { useState, useEffect, useCallback } from 'react'
const API=(p,o)=>fetch(p,{headers:{Authorization:`Bearer ${localStorage.getItem('mk_token')}`,'Content-Type':'application/json',...(o?.headers||{})},...o}).then(r=>r.json())
const RESULT_COLOR={Pending:'#8a8a90',Pass:'#22c55e',Fail:'#ef4444',Hold:'#f97316'}
const TEST_TYPES=['Incoming','Process','Final','Customer']
const REF_TYPES=['Reel','GRN','Batch']
const empty={test_type:'Incoming',reference_type:'Reel',reference_id:'',gsm:'',moisture_pct:'',caliper_micron:'',burst_factor:'',cobb_value:'',brightness_pct:'',thickness_micron:'',width_mm:'',weight_kg:'',tensile_strength:'',tear_strength:'',result:'Pending',remarks:''}

export default function Quality() {
  const [rows,setRows]=useState([]),[total,setTotal]=useState(0),[loading,setLoading]=useState(true)
  const [fResult,setFResult]=useState(''),[fType,setFType]=useState(''),[fSearch,setFSearch]=useState(''),[page,setPage]=useState(1)
  const [modal,setModal]=useState(false),[form,setForm]=useState(empty)
  const [saving,setSaving]=useState(false),[err,setErr]=useState('')
  const LIMIT=20

  const load=useCallback(async()=>{
    setLoading(true)
    const p=new URLSearchParams({page,limit:LIMIT})
    if(fResult) p.set('result',fResult)
    if(fType)   p.set('test_type',fType)
    const r=await API(`/api/quality/tests?${p}`)
    if(r.success){setRows(r.data);setTotal(r.total)}
    setLoading(false)
  },[page,fResult,fType])

  useEffect(()=>{load()},[load])

  const F=(key,label,type='text',ph='')=>(
    <label style={S.label}>{label}<input style={S.input} type={type} step="any" value={form[key]??''} onChange={e=>setForm(f=>({...f,[key]:e.target.value}))} placeholder={ph}/></label>
  )

  const save=async e=>{
    e.preventDefault();if(!form.test_type) return setErr('Test type required')
    setSaving(true);setErr('')
    const r=form.id
      ? await API(`/api/quality/tests/${form.id}`,{method:'PUT',body:JSON.stringify(form)})
      : await API('/api/quality/tests',{method:'POST',body:JSON.stringify(form)})
    setSaving(false);if(r.success){setModal(false);setForm(empty);load()}else setErr(r.message)
  }

  const openEdit=(r)=>{ setForm({id:r.id,test_type:r.testType,reference_type:r.referenceType||'',reference_id:r.referenceId||'',gsm:r.gsm??'',moisture_pct:r.moisturePct??'',caliper_micron:r.caliperMicron??'',burst_factor:r.burstFactor??'',cobb_value:r.cobbValue??'',brightness_pct:r.brightnessPct??'',thickness_micron:r.thicknessMicron??'',width_mm:r.widthMm??'',weight_kg:r.weightKg??'',tensile_strength:r.tensileStrength??'',tear_strength:r.tearStrength??'',result:r.result,remarks:r.remarks||''}); setErr(''); setModal(true) }

  const action=async(id,path)=>{const r=await API(`/api/quality/tests/${id}/${path}`,{method:'PUT'});if(r.success)load()}

  const totalPages=Math.ceil(total/LIMIT)
  return(
    <div style={S.page}>
      <div style={S.header}>
        <div><div style={S.title}>Quality Control</div><div style={S.sub}>{total} tests</div></div>
        <button style={S.btnPrimary} onClick={()=>{setForm(empty);setErr('');setModal(true)}}>+ Log Test</button>
      </div>
      <div style={S.filterBar}>
        <select style={S.select} value={fType} onChange={e=>{setFType(e.target.value);setPage(1)}}>
          <option value="">All Types</option>{TEST_TYPES.map(t=><option key={t}>{t}</option>)}
        </select>
        <select style={S.select} value={fResult} onChange={e=>{setFResult(e.target.value);setPage(1)}}>
          <option value="">All Results</option>
          {['Pending','Pass','Fail','Hold'].map(r=><option key={r}>{r}</option>)}
        </select>
        <input style={{...S.input, flex:1}} placeholder="Search tests..." value={fSearch} onChange={e=>setFSearch(e.target.value)} />
        <button style={S.btnSecondary} onClick={load}>↻</button>
      </div>
      <div style={S.tableWrap}>
        {loading?<div style={S.loading}>Loading...</div>:(
          <table style={S.table}><thead><tr style={S.thead}>
            {['Test No','Type','Reference','Date','GSM','Moisture','Burst','Result','Actions'].map(h=><th key={h} style={S.th}>{h}</th>)}
          </tr></thead><tbody>
            {rows.filter(r=>!fSearch||[r.testNumber,r.testType,r.referenceType,r.referenceId,r.result].join(' ').toLowerCase().includes(fSearch.toLowerCase())).length===0&&<tr><td colSpan={9} style={S.empty}>No tests found</td></tr>}
            {rows.filter(r=>!fSearch||[r.testNumber,r.testType,r.referenceType,r.referenceId,r.result].join(' ').toLowerCase().includes(fSearch.toLowerCase())).map(r=>(
              <tr key={r.id} style={S.tr}>
                <td style={S.td}><span style={S.code}>{r.testNumber}</span></td>
                <td style={S.td}><span style={S.muted}>{r.testType}</span></td>
                <td style={S.td}><span style={S.muted}>{r.referenceType||'—'} {r.referenceId||''}</span></td>
                <td style={S.td}><span style={S.muted}>{r.testDate?.slice(0,10)}</span></td>
                <td style={S.td}>{r.gsm||'—'}</td>
                <td style={S.td}>{r.moisturePct!=null?`${r.moisturePct}%`:'—'}</td>
                <td style={S.td}>{r.burstFactor||'—'}</td>
                <td style={S.td}><span style={{...S.badge,background:RESULT_COLOR[r.result]+'22',color:RESULT_COLOR[r.result],border:`1px solid ${RESULT_COLOR[r.result]}44`}}>{r.result}</span></td>
                <td style={S.td}>
                  {r.result==='Pending'&&<>
                    <button style={S.btnIcon} onClick={()=>action(r.id,'pass')} title="Pass">✅</button>
                    <button style={S.btnIcon} onClick={()=>action(r.id,'fail')} title="Fail">❌</button>
                  </>}
                  <button style={S.btnIcon} onClick={()=>openEdit(r)} title="Edit measurements">✎</button>
                </td>
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

      {modal&&(
        <div style={S.overlay} onClick={()=>setModal(false)}>
          <div style={{...S.modal,maxWidth:700}} onClick={e=>e.stopPropagation()}>
            <div style={S.modalHeader}><div style={S.modalTitle}>{form.id?'Edit':'Log'} QC Test</div><button style={S.close} onClick={()=>setModal(false)}>✕</button></div>
            <form onSubmit={save} style={S.form}>
              <div style={S.grid2}>
                <label style={S.label}>Test Type *
                  <select style={S.select} value={form.test_type} onChange={e=>setForm(f=>({...f,test_type:e.target.value}))}>
                    {TEST_TYPES.map(t=><option key={t}>{t}</option>)}
                  </select>
                </label>
                <label style={S.label}>Reference Type
                  <select style={S.select} value={form.reference_type} onChange={e=>setForm(f=>({...f,reference_type:e.target.value}))}>
                    <option value="">None</option>{REF_TYPES.map(t=><option key={t}>{t}</option>)}
                  </select>
                </label>
                {F('reference_id','Reference ID (Reel/GRN ID)','number')}
                <label style={S.label}>Result {form.id&&<span style={S.muted}>(use ✅/❌ buttons to change)</span>}
                  <select style={S.select} value={form.result} disabled={!!form.id} onChange={e=>setForm(f=>({...f,result:e.target.value}))}>
                    {['Pending','Pass','Fail','Hold'].map(r=><option key={r}>{r}</option>)}
                  </select>
                </label>
              </div>
              <div style={{fontWeight:600,color:'#a0a0a6',fontSize:12,marginTop:4}}>PAPER PARAMETERS</div>
              <div style={S.grid3}>
                {F('gsm','GSM','number')}
                {F('moisture_pct','Moisture %','number')}
                {F('caliper_micron','Caliper (μm)','number')}
                {F('burst_factor','Burst Factor','number')}
                {F('cobb_value','Cobb Value','number')}
                {F('brightness_pct','Brightness %','number')}
                {F('thickness_micron','Thickness (μm)','number')}
                {F('width_mm','Width (mm)','number')}
                {F('weight_kg','Weight (kg)','number')}
                {F('tensile_strength','Tensile Strength','number')}
                {F('tear_strength','Tear Strength','number')}
              </div>
              <label style={S.label}>Remarks<textarea style={{...S.input,height:60,resize:'vertical'}} value={form.remarks} onChange={e=>setForm(f=>({...f,remarks:e.target.value}))} /></label>
              {err&&<div style={S.error}>{err}</div>}
              <div style={S.modalFooter}>
                <button type="button" style={S.btnSecondary} onClick={()=>setModal(false)}>Cancel</button>
                <button type="submit" style={S.btnPrimary} disabled={saving}>{saving?'Saving...':form.id?'Update Test':'Save Test'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
const S={page:{padding:24,background:'#f6f5f0',minHeight:'100vh',color:'#1b1b1d'},header:{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:20},title:{fontSize:22,fontWeight:700,color:'#1b1b1d'},sub:{fontSize:13,color:'#8a8a90',marginTop:2},filterBar:{display:'flex',gap:10,marginBottom:16,flexWrap:'wrap',alignItems:'center'},tableWrap:{background:'#ffffff',borderRadius:10,overflow:'auto',border:'1px solid #e7e6df'},table:{width:'100%',borderCollapse:'collapse',fontSize:13},thead:{background:'#f6f5f0'},th:{padding:'10px 14px',textAlign:'left',color:'#8a8a90',fontWeight:600,fontSize:12,textTransform:'uppercase',borderBottom:'1px solid #e7e6df',whiteSpace:'nowrap'},tr:{borderBottom:'1px solid #f1efe8'},td:{padding:'10px 14px',verticalAlign:'middle'},muted:{color:'#a0a0a6',fontSize:12},code:{fontFamily:'monospace',background:'#f6f5f0',padding:'2px 6px',borderRadius:4,fontSize:11,color:'#a0a0a6'},badge:{fontSize:11,fontWeight:600,padding:'2px 8px',borderRadius:20,display:'inline-block'},btnIcon:{background:'none',border:'none',cursor:'pointer',fontSize:14},empty:{padding:40,textAlign:'center',color:'#8a8a90'},loading:{padding:40,textAlign:'center',color:'#8a8a90'},pagination:{display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:12},count:{fontSize:12,color:'#8a8a90'},pgBtn:{background:'#ffffff',border:'1px solid #e7e6df',color:'#1b1b1d',borderRadius:6,padding:'5px 12px',cursor:'pointer',fontSize:12},pgInfo:{fontSize:12,color:'#a0a0a6',padding:'5px 8px'},overlay:{position:'fixed',inset:0,background:'rgba(0,0,0,0.7)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000},modal:{background:'#ffffff',borderRadius:12,padding:24,width:'100%',border:'1px solid #e7e6df',maxHeight:'90vh',overflowY:'auto'},modalHeader:{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16},modalTitle:{fontSize:16,fontWeight:700,color:'#1b1b1d'},close:{background:'none',border:'none',color:'#a0a0a6',fontSize:18,cursor:'pointer'},form:{display:'flex',flexDirection:'column',gap:14},grid2:{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14},grid3:{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10},label:{display:'flex',flexDirection:'column',gap:5,fontSize:12,color:'#a0a0a6',fontWeight:600},input:{background:'#f6f5f0',border:'1px solid #e7e6df',borderRadius:6,padding:'8px 10px',color:'#1b1b1d',fontSize:13,outline:'none'},select:{background:'#f6f5f0',border:'1px solid #e7e6df',borderRadius:6,padding:'8px 10px',color:'#1b1b1d',fontSize:13},error:{background:'#ef444422',border:'1px solid #ef444444',color:'#f87171',padding:'8px 12px',borderRadius:6,fontSize:13},modalFooter:{display:'flex',gap:10,justifyContent:'flex-end',marginTop:8},btnPrimary:{background:'#1b1b1d',color:'#fff',border:'none',borderRadius:8,padding:'8px 18px',fontWeight:600,fontSize:13,cursor:'pointer'},btnSecondary:{background:'#e7e6df',color:'#1b1b1d',border:'none',borderRadius:8,padding:'8px 18px',fontWeight:600,fontSize:13,cursor:'pointer'}}
