import React, { useState, useEffect, useCallback } from 'react'
const API=(p,o)=>fetch(p,{headers:{Authorization:`Bearer ${localStorage.getItem('mk_token')}`,'Content-Type':'application/json',...(o?.headers||{})},...o}).then(r=>r.json())
const SO_COLOR={Pending:'#1b1b1d','In Production':'#f97316',Ready:'#1b1b1d',Partial:'#eab308',Dispatched:'#22c55e',Cancelled:'#ef4444'}
const DO_COLOR={Loading:'#f97316',Loaded:'#eab308',Dispatched:'#22c55e',Delivered:'#1b1b1d',Returned:'#ef4444'}
const fmt=v=>v?`₹${Number(v).toLocaleString('en-IN',{minimumFractionDigits:2})}`:'—'
const emptyOrder={customer_id:'',grade_id:'',delivery_date:'',gsm:'',width_mm:'',qty_mt:'',rate_per_kg:'',remarks:''}
const emptyDispatch={so_id:'',customer_id:'',vehicle_number:'',driver_name:'',driver_mobile:'',transporter:'',invoice_number:'',reel_ids:[]}

export default function Sales() {
  const [tab,setTab]=useState('orders')
  const [orders,setOrders]=useState([]),[dispatch,setDispatch]=useState([])
  const [totalO,setTotalO]=useState(0),[totalD,setTotalD]=useState(0),[loading,setLoading]=useState(true)
  const [fStatus,setFStatus]=useState(''),[page,setPage]=useState(1)
  const [searchTerm,setSearchTerm]=useState('')
  const [modal,setModal]=useState(null) // 'order'|'dispatch'
  const [custSearch,setCustSearch]=useState('')
  const [gradeSearch,setGradeSearch]=useState('')
  const [customers,setCustomers]=useState([]),[grades,setGrades]=useState([]),[warehouseReels,setWarehouseReels]=useState([])
  const [form,setForm]=useState({}),[saving,setSaving]=useState(false),[err,setErr]=useState('')
  const LIMIT=20

  const loadOrders=useCallback(async()=>{
    setLoading(true)
    const p=new URLSearchParams({page,limit:LIMIT});if(fStatus)p.set('status',fStatus)
    const r=await API(`/api/sales/orders?${p}`)
    if(r.success){setOrders(r.data);setTotalO(r.total)}
    setLoading(false)
  },[page,fStatus])
  const loadDispatch=useCallback(async()=>{
    const r=await API('/api/sales/dispatch?limit=50')
    if(r.success){setDispatch(r.data);setTotalD(r.total)}
  },[])

  useEffect(()=>{ if(tab==='orders') loadOrders(); else loadDispatch() },[tab,loadOrders,loadDispatch])
  useEffect(()=>{
    API('/api/sales/customers').then(r=>{if(r.success)setCustomers(r.data)})
    API('/api/production/grades').then(r=>{if(r.success)setGrades(r.data)})
  },[])

  const openOrder=()=>{ setForm(emptyOrder); setErr(''); setModal('order') }
  const openDispatch=async()=>{
    const r=await API('/api/sales/reels/warehouse')
    if(r.success) setWarehouseReels(r.data)
    setForm({...emptyDispatch,reel_ids:[]}); setErr(''); setModal('dispatch')
  }

  const toggleReel=id=>setForm(f=>({...f,reel_ids:f.reel_ids.includes(id)?f.reel_ids.filter(x=>x!==id):[...f.reel_ids,id]}))

  const saveOrder=async e=>{
    e.preventDefault()
    if(!form.customer_id||!form.grade_id||!form.qty_mt||!form.rate_per_kg) return setErr('Customer, grade, qty, rate required')
    setSaving(true);setErr('')
    const r=await API('/api/sales/orders',{method:'POST',body:JSON.stringify(form)})
    setSaving(false);if(r.success){setModal(null);loadOrders()}else setErr(r.message)
  }
  const saveDispatch=async e=>{
    e.preventDefault()
    if(!form.customer_id||!form.reel_ids.length) return setErr('Customer + at least 1 reel required')
    setSaving(true);setErr('')
    const r=await API('/api/sales/dispatch',{method:'POST',body:JSON.stringify(form)})
    setSaving(false);if(r.success){setModal(null);loadDispatch()}else setErr(r.message)
  }

  const F=(key,label,type='text',ph='')=>(
    <label style={S.label}>{label}<input style={S.input} type={type} step="any" value={form[key]??''} onChange={e=>setForm(f=>({...f,[key]:e.target.value}))} placeholder={ph}/></label>
  )

  const totalPages=Math.ceil(totalO/LIMIT)
  const selWeight=warehouseReels.filter(r=>form.reel_ids?.includes(r.id)).reduce((s,r)=>s+parseFloat(r.weightKg||0),0)

  const q=searchTerm.toLowerCase()
  const fOrders=orders.filter(o=>!q||(o.soNumber||'').toLowerCase().includes(q)||(o.customerName||'').toLowerCase().includes(q))
  const fDispatch=dispatch.filter(d=>!q||(d.doNumber||'').toLowerCase().includes(q)||(d.customerName||'').toLowerCase().includes(q)||(d.vehicleNumber||'').toLowerCase().includes(q))

  return(
    <div style={S.page}>
      <div style={S.header}>
        <div><div style={S.title}>Sales & Dispatch</div><div style={S.sub}>{totalO} orders · {totalD} dispatches</div></div>
        <div style={{display:'flex',gap:8}}>
          <button style={S.btnSecondary} onClick={openDispatch}>+ Dispatch</button>
          <button style={S.btnPrimary} onClick={openOrder}>+ Sales Order</button>
        </div>
      </div>

      <div style={S.tabs}>
        {[['orders','Sales Orders'],['dispatch','Dispatch']].map(([k,l])=>(
          <button key={k} style={{...S.tabBtn,...(tab===k?S.tabActive:{})}} onClick={()=>{setTab(k);setPage(1);setFStatus('')}}>{l}</button>
        ))}
      </div>

      {tab==='orders'&&(
        <>
          <div style={S.filterBar}>
            <input style={{...S.input, width:200, background:'#fff'}} placeholder="Search orders..." value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} />
            <select style={S.select} value={fStatus} onChange={e=>{setFStatus(e.target.value);setPage(1)}}>
              <option value="">All Status</option>
              {Object.keys(SO_COLOR).map(s=><option key={s}>{s}</option>)}
            </select>
            <button style={S.btnSecondary} onClick={loadOrders}>↻</button>
          </div>
          <div style={S.tableWrap}>
            {loading?<div style={S.loading}>Loading...</div>:(
              <table style={S.table}><thead><tr style={S.thead}>
                {['SO No','Customer','Grade','GSM','Qty (MT)','Fulfilled','Rate/kg','Value','Delivery','Status'].map(h=><th key={h} style={S.th}>{h}</th>)}
              </tr></thead><tbody>
                {fOrders.length===0&&<tr><td colSpan={10} style={S.empty}>No orders</td></tr>}
                {fOrders.map(o=>(
                  <tr key={o.id} style={S.tr}>
                    <td style={S.td}><span style={S.code}>{o.soNumber}</span></td>
                    <td style={S.td}>{o.customerName}</td>
                    <td style={S.td}><span style={S.muted}>{o.gradeName} ({o.gradeCode})</span></td>
                    <td style={S.td}>{o.gsm||'—'}</td>
                    <td style={S.td}><span style={S.num}>{o.qtyMt}</span></td>
                    <td style={S.td}><span style={S.num}>{o.fulfilledMt||0}</span></td>
                    <td style={S.td}>{fmt(o.ratePerKg)}</td>
                    <td style={S.td}>{fmt(o.totalValue)}</td>
                    <td style={S.td}><span style={S.muted}>{o.deliveryDate?.slice(0,10)||'—'}</span></td>
                    <td style={S.td}><span style={{...S.badge,background:SO_COLOR[o.status]+'22',color:SO_COLOR[o.status],border:`1px solid ${SO_COLOR[o.status]}44`}}>{o.status}</span></td>
                  </tr>
                ))}
              </tbody></table>
            )}
          </div>
          <div style={S.pagination}>
            <span style={S.count}>Showing {orders.length} of {totalO}</span>
            <div style={{display:'flex',gap:6}}>
              <button style={S.pgBtn} disabled={page===1} onClick={()=>setPage(p=>p-1)}>‹ Prev</button>
              <span style={S.pgInfo}>{page}/{totalPages||1}</span>
              <button style={S.pgBtn} disabled={page>=totalPages} onClick={()=>setPage(p=>p+1)}>Next ›</button>
            </div>
          </div>
        </>
      )}

      {tab==='dispatch'&&(
        <>
          <div style={S.filterBar}>
            <input style={{...S.input, width:200, background:'#fff'}} placeholder="Search dispatches..." value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} />
            <button style={S.btnSecondary} onClick={loadDispatch}>↻</button>
          </div>
          <div style={S.tableWrap}>
            {loading?<div style={S.loading}>Loading...</div>:(
              <table style={S.table}><thead><tr style={S.thead}>
                {['Dispatch No','Date','Customer','Vehicle','Invoice','Reels','Weight (MT)','Status'].map(h=><th key={h} style={S.th}>{h}</th>)}
              </tr></thead><tbody>
                {fDispatch.length===0&&<tr><td colSpan={8} style={S.empty}>No dispatch records</td></tr>}
                {fDispatch.map(d=>(
                  <tr key={d.id} style={S.tr}>
                    <td style={S.td}><span style={S.code}>{d.doNumber}</span></td>
                    <td style={S.td}>{d.date?new Date(d.date).toLocaleDateString():'—'}</td>
                    <td style={S.td}>{d.customerName}</td>
                    <td style={S.td}>{d.vehicleNumber||'—'}</td>
                    <td style={S.td}>{d.invoiceNumber||'—'}</td>
                    <td style={S.td}>{d.totalReels}</td>
                    <td style={S.td}><span style={S.num}>{Number(d.totalWeightKg/1000).toLocaleString('en-IN',{minimumFractionDigits:3})}</span></td>
                    <td style={S.td}><span style={{...S.badge,background:DO_COLOR[d.status]+'22',color:DO_COLOR[d.status],border:`1px solid ${DO_COLOR[d.status]}44`}}>{d.status}</span></td>
                  </tr>
                ))}
              </tbody></table>
            )}
          </div>
        </>
      )}

      {modal==='order'&&(
        <div style={S.overlay} onClick={()=>setModal(null)}>
          <div style={{...S.modal,maxWidth:600}} onClick={e=>e.stopPropagation()}>
            <div style={S.modalHeader}><div style={S.modalTitle}>New Sales Order</div><button style={S.close} onClick={()=>setModal(null)}>✕</button></div>
            <form onSubmit={saveOrder} style={{display:'flex',flexDirection:'column',gap:12}}>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                <label style={S.label}>Customer *
                  <input style={{...S.input,marginBottom:4,background:'#fefce8'}} placeholder='🔍 Filter customers...' value={custSearch} onChange={e=>setCustSearch(e.target.value)} />
                  <select style={S.select} value={form.customer_id} onChange={e=>setForm(f=>({...f,customer_id:e.target.value}))} required>
                    <option value="">Select Customer</option>
                    {customers.filter(c=>!custSearch||c.name.toLowerCase().includes(custSearch.toLowerCase())).map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </label>
                <label style={S.label}>Grade *
                  <input style={{...S.input,marginBottom:4,background:'#fefce8'}} placeholder='🔍 Filter grades...' value={gradeSearch} onChange={e=>setGradeSearch(e.target.value)} />
                  <select style={S.select} value={form.grade_id} onChange={e=>setForm(f=>({...f,grade_id:e.target.value}))} required>
                    <option value="">Select Grade</option>
                    {grades.filter(g=>!gradeSearch||g.name.toLowerCase().includes(gradeSearch.toLowerCase())).map(g=><option key={g.id} value={g.id}>{g.name} ({g.gsm_min}-{g.gsm_max} GSM)</option>)}
                  </select>
                </label>
                {F('delivery_date','Delivery Date','date')}
                {F('gsm','GSM','number')}
                {F('width_mm','Width (mm)','number')}
                {F('qty_mt','Qty (MT) *','number','0.000')}
                {F('rate_per_kg','Rate (₹/kg) *','number','0.00')}
              </div>
              <label style={S.label}>Remarks<textarea style={{...S.input,height:60,resize:'vertical'}} value={form.remarks||''} onChange={e=>setForm(f=>({...f,remarks:e.target.value}))} /></label>
              {err&&<div style={S.error}>{err}</div>}
              <div style={S.modalFooter}>
                <button type="button" style={S.btnSecondary} onClick={()=>setModal(null)}>Cancel</button>
                <button type="submit" style={S.btnPrimary} disabled={saving}>{saving?'Saving...':'Create SO'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {modal==='dispatch'&&(
        <div style={S.overlay} onClick={()=>setModal(null)}>
          <div style={{...S.modal,maxWidth:720}} onClick={e=>e.stopPropagation()}>
            <div style={S.modalHeader}>
              <div style={S.modalTitle}>Create Dispatch Order</div>
              <button style={S.close} onClick={()=>setModal(null)}>✕</button>
            </div>
            <form onSubmit={saveDispatch} style={{display:'flex',flexDirection:'column',gap:12}}>
              <label style={S.label}>Customer / Consignee *
                <input style={{...S.input,marginBottom:4,background:'#fefce8'}} placeholder='🔍 Filter customers...' value={custSearch} onChange={e=>setCustSearch(e.target.value)} />
                <select style={S.select} value={form.customer_id} onChange={e=>setForm(f=>({...f,customer_id:e.target.value}))} required>
                  <option value="">Select Customer</option>{customers.filter(c=>!custSearch||c.name.toLowerCase().includes(custSearch.toLowerCase())).map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </label>
              <div style={S.grid2}>
                <label style={S.label}>Sales Order (opt)<select style={S.select} value={form.so_id||''} onChange={e=>setForm(f=>({...f,so_id:e.target.value}))}>
                  <option value="">None</option>{orders.map(o=><option key={o.id} value={o.id}>{o.soNumber}</option>)}
                </select></label>
                <label style={S.label}>Vehicle No<input style={S.input} value={form.vehicle_number||''} onChange={e=>setForm(f=>({...f,vehicle_number:e.target.value}))} /></label>
                <label style={S.label}>Driver Name<input style={S.input} value={form.driver_name||''} onChange={e=>setForm(f=>({...f,driver_name:e.target.value}))} /></label>
                <label style={S.label}>Transporter<input style={S.input} value={form.transporter||''} onChange={e=>setForm(f=>({...f,transporter:e.target.value}))} /></label>
                <label style={S.label}>Invoice No<input style={S.input} value={form.invoice_number||''} onChange={e=>setForm(f=>({...f,invoice_number:e.target.value}))} /></label>
              </div>
              <div style={{fontWeight:600,color:'#a0a0a6',fontSize:12,marginTop:4}}>
                SELECT REELS (Warehouse) — {form.reel_ids?.length||0} selected · {selWeight.toFixed(3)} kg
              </div>
              <div style={{maxHeight:200,overflowY:'auto',background:'#f6f5f0',borderRadius:8,padding:8,border:'1px solid #e7e6df'}}>
                {warehouseReels.length===0&&<div style={{color:'#8a8a90',fontSize:13,padding:8}}>No reels in warehouse</div>}
                {warehouseReels.map(r=>(
                  <label key={r.id} style={{display:'flex',gap:10,padding:'5px 8px',cursor:'pointer',borderRadius:4,alignItems:'center',background:form.reel_ids?.includes(r.id)?'#1e3a5f':'transparent'}}>
                    <input type="checkbox" checked={form.reel_ids?.includes(r.id)||false} onChange={()=>toggleReel(r.id)} />
                    <span style={{fontSize:12,color:'#1b1b1d'}}>{r.reelNumber}</span>
                    <span style={{fontSize:11,color:'#8a8a90'}}>{r.gradeName} · {r.gsm}GSM · {r.widthMm}mm · {r.weightKg}kg · {r.rackLocation||'—'}</span>
                  </label>
                ))}
              </div>
              {err&&<div style={S.error}>{err}</div>}
              <div style={S.modalFooter}>
                <button type="button" style={S.btnSecondary} onClick={()=>setModal(null)}>Cancel</button>
                <button type="submit" style={S.btnPrimary} disabled={saving}>{saving?'Saving...':'Create Dispatch'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
const S={page:{padding:24,background:'#f6f5f0',minHeight:'100vh',color:'#1b1b1d'},header:{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:20},title:{fontSize:22,fontWeight:700,color:'#1b1b1d'},sub:{fontSize:13,color:'#8a8a90',marginTop:2},filterBar:{display:'flex',gap:10,marginBottom:16,flexWrap:'wrap',alignItems:'center'},tabs:{display:'flex',gap:4,marginBottom:16,borderBottom:'1px solid #e7e6df'},tabBtn:{background:'none',border:'none',color:'#8a8a90',padding:'8px 16px',cursor:'pointer',fontSize:13,fontWeight:500,borderBottom:'2px solid transparent',marginBottom:-1},tabActive:{color:'#1b1b1d',borderBottom:'2px solid #1b1b1d'},tableWrap:{background:'#ffffff',borderRadius:10,overflow:'auto',border:'1px solid #e7e6df'},table:{width:'100%',borderCollapse:'collapse',fontSize:13},thead:{background:'#f6f5f0'},th:{padding:'10px 14px',textAlign:'left',color:'#8a8a90',fontWeight:600,fontSize:12,textTransform:'uppercase',borderBottom:'1px solid #e7e6df',whiteSpace:'nowrap'},tr:{borderBottom:'1px solid #f1efe8'},td:{padding:'10px 14px',verticalAlign:'middle'},muted:{color:'#a0a0a6',fontSize:12},num:{color:'#1b1b1d',fontVariantNumeric:'tabular-nums'},code:{fontFamily:'monospace',background:'#f6f5f0',padding:'2px 6px',borderRadius:4,fontSize:11,color:'#a0a0a6'},badge:{fontSize:11,fontWeight:600,padding:'2px 8px',borderRadius:20,display:'inline-block'},empty:{padding:40,textAlign:'center',color:'#8a8a90'},loading:{padding:40,textAlign:'center',color:'#8a8a90'},pagination:{display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:12},count:{fontSize:12,color:'#8a8a90'},pgBtn:{background:'#ffffff',border:'1px solid #e7e6df',color:'#1b1b1d',borderRadius:6,padding:'5px 12px',cursor:'pointer',fontSize:12},pgInfo:{fontSize:12,color:'#a0a0a6',padding:'5px 8px'},overlay:{position:'fixed',inset:0,background:'rgba(0,0,0,0.7)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000},modal:{background:'#ffffff',borderRadius:12,padding:24,width:'100%',border:'1px solid #e7e6df',maxHeight:'90vh',overflowY:'auto'},modalHeader:{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16},modalTitle:{fontSize:16,fontWeight:700,color:'#1b1b1d'},close:{background:'none',border:'none',color:'#a0a0a6',fontSize:18,cursor:'pointer'},form:{display:'flex',flexDirection:'column',gap:14},grid2:{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14},label:{display:'flex',flexDirection:'column',gap:5,fontSize:12,color:'#a0a0a6',fontWeight:600},input:{background:'#f6f5f0',border:'1px solid #e7e6df',borderRadius:6,padding:'8px 10px',color:'#1b1b1d',fontSize:13,outline:'none'},select:{background:'#f6f5f0',border:'1px solid #e7e6df',borderRadius:6,padding:'8px 10px',color:'#1b1b1d',fontSize:13},error:{background:'#ef444422',border:'1px solid #ef444444',color:'#f87171',padding:'8px 12px',borderRadius:6,fontSize:13},modalFooter:{display:'flex',gap:10,justifyContent:'flex-end',marginTop:8},btnPrimary:{background:'#1b1b1d',color:'#fff',border:'none',borderRadius:8,padding:'8px 18px',fontWeight:600,fontSize:13,cursor:'pointer'},btnSecondary:{background:'#e7e6df',color:'#1b1b1d',border:'none',borderRadius:8,padding:'8px 18px',fontWeight:600,fontSize:13,cursor:'pointer'}}
