import React, { useEffect, useState } from 'react'
import StoreDashboardExclusive from './StoreDashboard'
import {
  Factory, Zap, Wrench, ClipboardList, AlertTriangle, Inbox, Truck, Package,
  Flame, ShieldCheck, Users, CalendarDays, Timer, BarChart3, Droplets,
  CheckCircle2, TimerOff, Wallet, AlertCircle, Sparkles, Target, FileText,
  CreditCard, Hourglass, TrendingDown, XCircle, Palmtree, SquarePen, PlugZap,
  Fuel, Siren, Trophy, LayoutGrid,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'

const API = (path, token) =>
  fetch(path, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json())

// emoji prop → elegant lucide line icon
const ICONS = {
  '🏭': Factory, '⚡': Zap, '🔧': Wrench, '📋': ClipboardList, '⚠️': AlertTriangle,
  '📥': Inbox, '🚛': Truck, '📦': Package, '♨️': Flame, '🛡️': ShieldCheck,
  '👥': Users, '📅': CalendarDays, '⏱️': Timer, '📊': BarChart3, '💧': Droplets,
  '✅': CheckCircle2, '⏹️': TimerOff, '💰': Wallet, '🔴': AlertCircle, '✨': Sparkles,
  '🎯': Target, '📄': FileText, '💳': CreditCard, '⏳': Hourglass, '💸': TrendingDown,
  '❌': XCircle, '🏖️': Palmtree, '📝': SquarePen, '🔌': PlugZap, '⬛': Fuel,
  '🚨': Siren, '🏆': Trophy,
}

const INK   = '#18181b'
const ACCENT = '#f4c84b'

const S = {
  page:    { padding: '24px 28px 36px', minHeight: '100%' },
  hero: {
    display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
    gap: 16, marginBottom: 28,
    paddingBottom: 24,
    borderBottom: '1px solid rgba(0,0,0,.07)',
  },
  heroL:   { display: 'flex', flexDirection: 'column', gap: 5 },
  title:   { fontSize: 28, fontWeight: 800, color: INK, margin: 0, letterSpacing: '-.03em', lineHeight: 1.15 },
  sub:     { fontSize: 12.5, color: '#71717a', marginTop: 2, fontWeight: 500 },
  rolePill:{
    display: 'inline-flex', alignItems: 'center', gap: 7,
    background: INK, color: '#ffffff',
    borderRadius: 999, padding: '8px 16px', fontSize: 12, fontWeight: 700,
    boxShadow: '0 4px 14px rgba(0,0,0,.22)',
    letterSpacing: '.01em',
    flexShrink: 0,
  },
  roleDot: { width: 7, height: 7, borderRadius: '50%', background: ACCENT, boxShadow: '0 0 6px rgba(244,200,75,.6)' },
  grid:    (n) => ({ display: 'grid', gridTemplateColumns: `repeat(${n}, minmax(0,1fr))`, gap: 14, marginBottom: 20 }),
  card:    () => ({
    background: '#fff',
    borderRadius: 18,
    padding: '18px 20px',
    boxShadow: '0 1px 3px rgba(0,0,0,.04), 0 6px 20px rgba(0,0,0,.06)',
    border: '1px solid rgba(0,0,0,.04)',
    position: 'relative',
    overflow: 'hidden',
  }),
  cardDark: () => ({
    background: 'linear-gradient(145deg, #1c1c1f 0%, #111113 100%)',
    borderRadius: 18,
    padding: '18px 20px',
    boxShadow: '0 12px 32px rgba(0,0,0,.28)',
    border: '1px solid rgba(244,200,75,.12)',
    position: 'relative',
    overflow: 'hidden',
  }),
  chip:    (c) => ({ width: 40, height: 40, borderRadius: 12, background: c + '18', color: c, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14, border: `1px solid ${c}22` }),
  chipDark: { width: 40, height: 40, borderRadius: 12, background: 'rgba(244,200,75,.14)', color: ACCENT, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14, border: '1px solid rgba(244,200,75,.2)' },
  kval:    () => ({ fontSize: 26, fontWeight: 800, color: INK, margin: '0 0 3px', letterSpacing: '-.04em', lineHeight: 1 }),
  kvalDark: { fontSize: 26, fontWeight: 800, color: '#fff', margin: '0 0 3px', letterSpacing: '-.04em', lineHeight: 1 },
  klbl:    { fontSize: 11, fontWeight: 700, color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: '.05em' },
  klblDark: { fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,.45)', textTransform: 'uppercase', letterSpacing: '.05em' },
  ksub:    { fontSize: 11, color: '#a1a1aa', marginTop: 4, fontWeight: 500 },
  sec:     {
    background: '#fff',
    borderRadius: 18,
    padding: '20px 22px',
    marginBottom: 16,
    boxShadow: '0 1px 3px rgba(0,0,0,.04), 0 6px 20px rgba(0,0,0,.06)',
    border: '1px solid rgba(0,0,0,.04)',
  },
  sTitle:  { fontSize: 13.5, fontWeight: 700, color: INK, marginBottom: 16, letterSpacing: '-.02em', display: 'flex', alignItems: 'center', gap: 8 },
  tbl:     { width: '100%', borderCollapse: 'collapse', fontSize: 12.5 },
  th:      { padding: '10px 12px', textAlign: 'left', color: '#a1a1aa', fontWeight: 700, fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '.05em', borderBottom: '1px solid rgba(0,0,0,.06)', background: '#fafaf9' },
  td:      { padding: '12px 12px', borderBottom: '1px solid rgba(0,0,0,.04)', color: '#3f3f46', fontWeight: 500 },
  badge:   (c) => ({ fontSize: 10.5, fontWeight: 700, padding: '3px 10px', borderRadius: 999, background: c + '18', color: c, display: 'inline-block', border: `1px solid ${c}22` }),
  loading: { padding: 60, textAlign: 'center', color: '#a1a1aa', fontSize: 14 },
  empty:   { padding: 32, textAlign: 'center', color: '#a1a1aa', fontSize: 13 },
}

function KPI({ label, value, sub, color = INK, icon, featured, onClick }) {
  const Icon = ICONS[icon] || LayoutGrid
  const isClickable = typeof onClick === 'function'
  if (featured) {
    return (
      <div
        style={{ ...S.cardDark(), cursor: isClickable ? 'pointer' : 'default' }}
        className="lift"
        onClick={onClick}
      >
        <div style={{ position:'absolute', top:-20, right:-20, width:80, height:80, borderRadius:'50%', background:'rgba(244,200,75,.08)', filter:'blur(20px)', pointerEvents:'none' }} />
        <div style={S.chipDark} className="icon-chip"><Icon size={19} strokeWidth={2.2} /></div>
        <div style={S.kvalDark}>{value ?? '—'}</div>
        <div style={S.klblDark}>{label}</div>
        {sub && <div style={{ ...S.ksub, color: '#71717a', marginTop: 6 }}>{sub}</div>}
      </div>
    )
  }
  return (
    <div
      style={{ ...S.card(), cursor: isClickable ? 'pointer' : 'default' }}
      className="lift"
      onClick={onClick}
    >
      <div style={S.chip(color)} className="icon-chip"><Icon size={19} strokeWidth={2.2} /></div>
      <div style={S.kval()}>{value ?? '—'}</div>
      <div style={S.klbl}>{label}</div>
      {sub && <div style={S.ksub}>{sub}</div>}
    </div>
  )
}

// ── ADMIN / PLANT HEAD — org-wide ─────────────────────────────────────────────
function AdminDashboard({ token }) {
  const navigate = useNavigate()
  const [d, setD] = useState(null)
  const [err, setErr] = useState(false)
  useEffect(() => {
    const load = () => API('/api/dashboard', token).then(r => r.success ? setD(r.data) : setErr(true)).catch(() => setErr(true))
    load()
    const t = setInterval(load, 60000)
    return () => clearInterval(t)
  }, [])
  if (err) return <div style={S.loading}>Couldn't load dashboard data. Retrying…</div>
  if (!d) return <div style={S.loading}>Loading operational telemetry…</div>
  const prod = d.production || {}; const inv = d.inventory || {}
  const pur = d.purchase || {}; const maint = d.maintenance || {}
  const disp = d.dispatch || {}; const sales = d.sales || {}
  const util = d.utility?.today || {}
  return (
    <div>
      <div style={S.grid(4)} className="stagger">
        <KPI label="Today Production" value={`${((prod.today?.total_kg||0)/1000).toFixed(2)} MT`} sub={`${prod.today?.total_reels||0} reels`} color="#1b1b1d" icon="🏭" featured onClick={() => navigate('/production')} />
        <KPI label="Avg Efficiency" value={`${Number(prod.today?.avg_efficiency||0).toFixed(1)}%`} color="#16a34a" icon="⚡" onClick={() => navigate('/production')} />
        <KPI label="Open Breakdowns" value={maint.open_breakdowns||0} color={maint.open_breakdowns>5?'#dc2626':'#16a34a'} icon="🔧" onClick={() => navigate('/maintenance')} />
        <KPI label="Pending Indents" value={pur.pending_indents||0} sub="Awaiting approval" color="#d97706" icon="📋" onClick={() => navigate('/store')} />
        <KPI label="Low Stock Alerts" value={inv.alert_count||0} color="#dc2626" icon="⚠️" onClick={() => navigate('/store')} />
        <KPI label="Pending GRN" value={pur.pending_grn||0} color="#d97706" icon="📥" onClick={() => navigate('/store')} />
        <KPI label="Pending Dispatch" value={disp.pending||0} color="#1b1b1d" icon="🚛" onClick={() => navigate('/sales')} />
        <KPI label="Pending Orders" value={`${Number(sales.pending_mt||0).toFixed(1)} MT`} sub={`${sales.pending_orders||0} orders`} color="#1b1b1d" icon="📦" onClick={() => navigate('/sales')} />
        <KPI label="Power" value={`${Number(util.power||0).toFixed(0)} U`} color="#1b1b1d" icon="⚡" onClick={() => navigate('/utility')} />
        <KPI label="Steam" value={`${Number(util.steam||0).toFixed(1)} MT`} color="#dc2626" icon="♨️" onClick={() => navigate('/utility')} />
        <KPI label="Safety Incidents" value={d.safety?.open_incidents||0} color={d.safety?.critical_incidents>0?'#dc2626':'#16a34a'} icon="🛡️" onClick={() => navigate('/ehs')} />
        <KPI label="Staff Present" value={d.hr?.present_today||0} color="#1b1b1d" icon="👥" onClick={() => navigate('/hr')} />
      </div>
      {inv.low_stock_alerts?.length > 0 && (
        <div style={S.sec}>
          <div style={S.sTitle}>⚠️ Low Stock Alerts</div>
          <table style={S.tbl}><thead><tr><th style={S.th}>Material</th><th style={S.th}>Stock</th><th style={S.th}>Reorder</th><th style={S.th}>%</th></tr></thead>
          <tbody>{inv.low_stock_alerts.slice(0,8).map((it,i) => {
            const pct = it.reorder_level>0?Math.round((it.current_stock/it.reorder_level)*100):0
            return <tr key={i}><td style={S.td}>{it.name}</td><td style={S.td}>{Number(it.current_stock).toFixed(1)} {it.uom}</td><td style={S.td}>{Number(it.reorder_level).toFixed(1)}</td>
              <td style={S.td}><span style={S.badge(pct<50?'#dc2626':'#d97706')}>{pct}%</span></td></tr>
          })}</tbody></table>
        </div>
      )}
    </div>
  )
}

// ── PRODUCTION ────────────────────────────────────────────────────────────────
function ProductionDashboard({ token }) {
  const navigate = useNavigate()
  const [d, setD] = useState(null)
  const [err, setErr] = useState(false)
  useEffect(() => {
    const load = () => API('/api/dashboard', token).then(r => r.success ? setD(r.data) : setErr(true)).catch(() => setErr(true))
    load()
    const t = setInterval(load, 60000)
    return () => clearInterval(t)
  }, [])
  if (err) return <div style={S.loading}>Couldn't load dashboard data. Retrying…</div>
  if (!d) return <div style={S.loading}>Loading...</div>
  const prod = d.production || {}
  return (
    <div>
      <div style={S.grid(3)} className="stagger">
        <KPI label="Today Production" value={`${((prod.today?.total_kg||0)/1000).toFixed(2)} MT`} sub={`${prod.today?.total_reels||0} reels`} color="#1b1b1d" icon="🏭" featured onClick={() => navigate('/production')} />
        <KPI label="Month Production" value={`${((prod.month?.total_kg||0)/1000).toFixed(2)} MT`} color="#1b1b1d" icon="📅" onClick={() => navigate('/production')} />
        <KPI label="Avg Efficiency" value={`${Number(prod.today?.avg_efficiency||0).toFixed(1)}%`} color="#16a34a" icon="⚡" onClick={() => navigate('/production')} />
        <KPI label="Total Downtime" value={`${prod.today?.total_downtime||0} min`} color={(prod.today?.total_downtime||0)>120?'#dc2626':'#d97706'} icon="⏱️" onClick={() => navigate('/maintenance')} />
        <KPI label="Avg GSM" value={Number(prod.today?.avg_gsm||0).toFixed(1)} color="#1b1b1d" icon="📊" onClick={() => navigate('/production')} />
        <KPI label="Avg Moisture" value={`${Number(prod.today?.avg_moisture||0).toFixed(2)}%`} color="#1b1b1d" icon="💧" onClick={() => navigate('/production')} />
      </div>
      {prod.shifts?.length > 0 && (
        <div style={S.sec}>
          <div style={S.sTitle}>Today Shift Breakdown</div>
          <div style={S.grid(3)} className="stagger">
            {prod.shifts.map(s => (
              <div key={s.shift_type} style={{...S.card('#1b1b1d'), textAlign:'center'}}>
                <div style={{fontWeight:700,color:'#334155'}}>{s.shift_type} Shift</div>
                <div style={{fontSize:20,fontWeight:700,color:'#1b1b1d',margin:'8px 0'}}>{((s.production_kg||0)/1000).toFixed(2)} MT</div>
                <div style={{fontSize:11,color:'#64748b'}}>{s.reels} reels · {Number(s.efficiency||0).toFixed(1)}%</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── MAINTENANCE ───────────────────────────────────────────────────────────────
function MaintenanceDashboard({ token }) {
  const navigate = useNavigate()
  const [d, setD] = useState(null)
  const [err, setErr] = useState(false)
  useEffect(() => {
    const load = () => API('/api/dashboard', token).then(r => r.success ? setD(r.data) : setErr(true)).catch(() => setErr(true))
    load()
    const t = setInterval(load, 60000)
    return () => clearInterval(t)
  }, [])
  if (err) return <div style={S.loading}>Couldn't load dashboard data. Retrying…</div>
  if (!d) return <div style={S.loading}>Loading...</div>
  const m = d.maintenance || {}
  return (
    <div>
      <div style={S.grid(3)} className="stagger">
        <KPI label="Open Breakdowns" value={m.open_breakdowns||0} color={m.open_breakdowns>5?'#dc2626':'#16a34a'} icon="🔧" featured onClick={() => navigate('/maintenance')} />
        <KPI label="Pending PM Jobs" value={m.pending_pm||0} color="#d97706" icon="📅" onClick={() => navigate('/maintenance')} />
        <KPI label="Completed This Month" value={m.completed_month||0} color="#16a34a" icon="✅" onClick={() => navigate('/maintenance')} />
        <KPI label="Avg MTTR" value={m.avg_mttr?`${Number(m.avg_mttr).toFixed(1)}h`:'—'} color="#1b1b1d" icon="⏱️" onClick={() => navigate('/maintenance')} />
        <KPI label="Pending Indents" value={d.purchase?.pending_indents||0} sub="Raised by Maintenance" color="#d97706" icon="📋" onClick={() => navigate('/indent')} />
        <KPI label="Downtime Today" value={`${d.production?.today?.total_downtime||0} min`} color="#dc2626" icon="⏹️" onClick={() => navigate('/production')} />
      </div>
    </div>
  )
}

// ── STORE / INVENTORY EXCLUSIVE DASHBOARD ─────────────────────────────────────
function StoreDashboard({ token }) {
  const navigate = useNavigate()
  return <StoreDashboardExclusive onNavigate={navigate} />
}

// ── QUALITY ───────────────────────────────────────────────────────────────────
function QualityDashboard({ token }) {
  const navigate = useNavigate()
  const [d, setD] = useState(null)
  const [err, setErr] = useState(false)
  useEffect(() => {
    const load = () => API('/api/dashboard', token).then(r => r.success ? setD(r.data) : setErr(true)).catch(() => setErr(true))
    load()
    const t = setInterval(load, 60000)
    return () => clearInterval(t)
  }, [])
  if (err) return <div style={S.loading}>Couldn't load dashboard data. Retrying…</div>
  if (!d) return <div style={S.loading}>Loading...</div>
  const prod = d.production || {}
  return (
    <div>
      <div style={S.grid(3)} className="stagger">
        <KPI label="Avg GSM Today" value={Number(prod.today?.avg_gsm||0).toFixed(1)} color="#1b1b1d" icon="📊" featured onClick={() => navigate('/production')} />
        <KPI label="Avg Moisture" value={`${Number(prod.today?.avg_moisture||0).toFixed(2)}%`} color="#1b1b1d" icon="💧" onClick={() => navigate('/production')} />
        <KPI label="Avg Brightness" value={prod.today?.avg_brightness != null ? Number(prod.today.avg_brightness).toFixed(1) : '—'} color="#16a34a" icon="✨" onClick={() => navigate('/production')} />
        <KPI label="Reels Today" value={prod.today?.total_reels||0} color="#1b1b1d" icon="🎯" onClick={() => navigate('/production')} />
        <KPI label="Safety Incidents" value={d.safety?.open_incidents||0} color={d.safety?.critical_incidents>0?'#dc2626':'#16a34a'} icon="🛡️" onClick={() => navigate('/ehs')} />
        <KPI label="Pending GRN QC" value={d.purchase?.pending_grn||0} color="#d97706" icon="📥" onClick={() => navigate('/store')} />
      </div>
    </div>
  )
}

// ── PURCHASE ──────────────────────────────────────────────────────────────────
function PurchaseDashboard({ token }) {
  const navigate = useNavigate()
  const [d, setD] = useState(null)
  const [err, setErr] = useState(false)
  useEffect(() => {
    const load = () => API('/api/dashboard', token).then(r => r.success ? setD(r.data) : setErr(true)).catch(() => setErr(true))
    load()
    const t = setInterval(load, 60000)
    return () => clearInterval(t)
  }, [])
  if (err) return <div style={S.loading}>Couldn't load dashboard data. Retrying…</div>
  if (!d) return <div style={S.loading}>Loading...</div>
  const pur = d.purchase || {}
  const poAgingBuckets = Array.isArray(pur.po_aging)
    ? pur.po_aging
    : pur.po_aging && typeof pur.po_aging === 'object'
      ? [
          { label: '0–15 Days', count: pur.po_aging.bucket_0_15 || 0 },
          { label: '16–30 Days', count: pur.po_aging.bucket_16_30 || 0 },
          { label: '31–60 Days', count: pur.po_aging.bucket_31_60 || 0 },
          { label: '60+ Days', count: pur.po_aging.bucket_60_plus || 0 },
        ]
      : []
  const hasPoAging = poAgingBuckets.length > 0
  const vendorList = pur.vendor_performance || d.inventory?.top_vendors || []
  return (
    <div>
      <div style={S.grid(3)} className="stagger">
        <KPI label="Pending Indents" value={pur.pending_indents||0} color="#d97706" icon="📋" featured onClick={() => navigate('/indent')} />
        <KPI label="Pending GRN" value={pur.pending_grn||0} color="#d97706" icon="📥" onClick={() => navigate('/store')} />
        <KPI label="Open POs" value={pur.open_pos||0} color="#1b1b1d" icon="📄" onClick={() => navigate('/purchase')} />
        <KPI label="POs This Month" value={pur.month_pos||0} color="#16a34a" icon="📅" onClick={() => navigate('/purchase')} />
        <KPI label="Low Stock Alerts" value={d.inventory?.alert_count||0} color="#dc2626" icon="⚠️" onClick={() => navigate('/inventory')} />
        <KPI label="Pending Payments" value={pur.pending_payments||0} color="#1b1b1d" icon="💳" onClick={() => navigate('/purchase')} />
        {pur.open_po_value != null && (
          <KPI label="Open PO Value" value={`₹${Number(pur.open_po_value).toLocaleString('en-IN',{maximumFractionDigits:0})}`} color="#16a34a" icon="💰" onClick={() => navigate('/purchase')} />
        )}
      </div>
      {hasPoAging && (
        <div style={S.sec}>
          <div style={S.sTitle}>⏳ PO Aging</div>
          <div style={S.grid(poAgingBuckets.length)} className="stagger">
            {poAgingBuckets.map((b,i) => (
              <div key={i} style={{...S.card(), textAlign:'center', cursor:'pointer'}} onClick={() => navigate('/purchase')}>
                <div style={{fontSize:20,fontWeight:700,color:'#1b1b1d'}}>{b.count ?? 0}</div>
                <div style={{fontSize:11,color:'#a1a1aa',fontWeight:700,textTransform:'uppercase'}}>{b.bucket || b.label}</div>
              </div>
            ))}
          </div>
        </div>
      )}
      {vendorList.length > 0 && (
        <div style={S.sec}>
          <div style={S.sTitle}>🚚 Vendor Performance</div>
          <table style={S.tbl}><thead><tr><th style={S.th}>Vendor</th><th style={S.th}>Orders</th><th style={S.th}>On-Time %</th><th style={S.th}>Value</th></tr></thead>
          <tbody>{vendorList.slice(0,6).map((v,i) => (
            <tr key={i} style={{cursor:'pointer'}} onClick={() => navigate('/reports')}>
              <td style={S.td}>{v.name || v.vendor_name}</td>
              <td style={S.td}>{v.orders ?? v.order_count ?? '—'}</td>
              <td style={S.td}>{v.on_time_pct != null ? `${Number(v.on_time_pct).toFixed(0)}%` : '—'}</td>
              <td style={S.td}>{v.value != null ? `₹${Number(v.value).toLocaleString('en-IN',{maximumFractionDigits:0})}` : '—'}</td>
            </tr>
          ))}</tbody></table>
        </div>
      )}
    </div>
  )
}

// ── SALES / DISPATCH ──────────────────────────────────────────────────────────
function SalesDashboard({ token }) {
  const navigate = useNavigate()
  const [d, setD] = useState(null)
  const [err, setErr] = useState(false)
  useEffect(() => {
    const load = () => API('/api/dashboard', token).then(r => r.success ? setD(r.data) : setErr(true)).catch(() => setErr(true))
    load()
    const t = setInterval(load, 60000)
    return () => clearInterval(t)
  }, [])
  if (err) return <div style={S.loading}>Couldn't load dashboard data. Retrying…</div>
  if (!d) return <div style={S.loading}>Loading...</div>
  const sales = d.sales || {}; const disp = d.dispatch || {}
  return (
    <div>
      <div style={S.grid(3)} className="stagger">
        <KPI label="Pending Orders" value={sales.pending_orders||0} sub={`${Number(sales.pending_mt||0).toFixed(1)} MT`} color="#1b1b1d" icon="📦" featured onClick={() => navigate('/sales')} />
        <KPI label="Dispatched Today" value={`${Number(disp.today_mt||0).toFixed(1)} MT`} color="#16a34a" icon="🚛" onClick={() => navigate('/sales')} />
        <KPI label="Pending Dispatch" value={disp.pending||0} color="#d97706" icon="⏳" onClick={() => navigate('/sales')} />
        <KPI label="Month Dispatch" value={`${Number(disp.month_mt||0).toFixed(1)} MT`} color="#1b1b1d" icon="📅" onClick={() => navigate('/sales')} />
        <KPI label="Active Customers" value={sales.active_customers||0} color="#1b1b1d" icon="👥" onClick={() => navigate('/sales')} />
        <KPI label="Overdue Payments" value={sales.overdue||0} color="#dc2626" icon="💸" onClick={() => navigate('/sales')} />
      </div>
    </div>
  )
}

// ── HR ────────────────────────────────────────────────────────────────────────
function HRDashboard({ token }) {
  const navigate = useNavigate()
  const [d, setD] = useState(null)
  const [err, setErr] = useState(false)
  useEffect(() => {
    const load = () => API('/api/dashboard', token).then(r => r.success ? setD(r.data) : setErr(true)).catch(() => setErr(true))
    load()
    const t = setInterval(load, 60000)
    return () => clearInterval(t)
  }, [])
  if (err) return <div style={S.loading}>Couldn't load dashboard data. Retrying…</div>
  if (!d) return <div style={S.loading}>Loading...</div>
  const hr = d.hr || {}
  return (
    <div>
      <div style={S.grid(3)} className="stagger">
        <KPI label="Present Today" value={hr.present_today||0} color="#16a34a" icon="✅" featured onClick={() => navigate('/hr')} />
        <KPI label="Absent Today" value={hr.absent_today||0} color="#dc2626" icon="❌" onClick={() => navigate('/hr')} />
        <KPI label="On Leave" value={hr.on_leave||0} color="#d97706" icon="🏖️" onClick={() => navigate('/hr')} />
        <KPI label="Total Employees" value={hr.total_employees||0} color="#1b1b1d" icon="👥" onClick={() => navigate('/hr')} />
        <KPI label="Pending Payroll" value={hr.pending_payroll||0} color="#1b1b1d" icon="💰" onClick={() => navigate('/hr')} />
        <KPI label="Pending Leave Req" value={hr.pending_leaves||0} color="#d97706" icon="📝" onClick={() => navigate('/hr')} />
      </div>
    </div>
  )
}

// ── UTILITY ───────────────────────────────────────────────────────────────────
function UtilityDashboard({ token }) {
  const navigate = useNavigate()
  const [d, setD] = useState(null)
  const [err, setErr] = useState(false)
  useEffect(() => {
    const load = () => API('/api/dashboard', token).then(r => r.success ? setD(r.data) : setErr(true)).catch(() => setErr(true))
    load()
    const t = setInterval(load, 60000)
    return () => clearInterval(t)
  }, [])
  if (err) return <div style={S.loading}>Couldn't load dashboard data. Retrying…</div>
  if (!d) return <div style={S.loading}>Loading...</div>
  const u = d.utility?.today || {}
  return (
    <div>
      <div style={S.grid(3)} className="stagger">
        <KPI label="Power Consumed" value={`${Number(u.power||0).toFixed(0)} Units`} color="#1b1b1d" icon="⚡" featured onClick={() => navigate('/utility')} />
        <KPI label="DG Power" value={`${Number(u.dg_power||0).toFixed(0)} Units`} color="#eab308" icon="🔌" onClick={() => navigate('/utility')} />
        <KPI label="Steam Generated" value={`${Number(u.steam||0).toFixed(2)} MT`} color="#dc2626" icon="♨️" onClick={() => navigate('/utility')} />
        <KPI label="Water Used" value={`${Number(u.water||0).toFixed(2)} KL`} color="#1b1b1d" icon="💧" onClick={() => navigate('/utility')} />
        <KPI label="Coal Consumed" value={`${Number(u.coal||0).toFixed(0)} KG`} color="#374151" icon="⬛" onClick={() => navigate('/utility')} />
        <KPI label="Specific Power" value={u.specific_power?`${Number(u.specific_power).toFixed(2)} U/kg`:'—'} color="#1b1b1d" icon="📊" onClick={() => navigate('/utility')} />
      </div>
    </div>
  )
}

// ── EHS ───────────────────────────────────────────────────────────────────────
function EHSDashboard({ token }) {
  const navigate = useNavigate()
  const [d, setD] = useState(null)
  const [err, setErr] = useState(false)
  useEffect(() => {
    const load = () => API('/api/dashboard', token).then(r => r.success ? setD(r.data) : setErr(true)).catch(() => setErr(true))
    load()
    const t = setInterval(load, 60000)
    return () => clearInterval(t)
  }, [])
  if (err) return <div style={S.loading}>Couldn't load dashboard data. Retrying…</div>
  if (!d) return <div style={S.loading}>Loading...</div>
  const s = d.safety || {}
  return (
    <div>
      <div style={S.grid(3)} className="stagger">
        <KPI label="Open Incidents" value={s.open_incidents||0} color={s.open_incidents>0?'#dc2626':'#16a34a'} icon="🛡️" featured onClick={() => navigate('/ehs')} />
        <KPI label="Critical Incidents" value={s.critical_incidents||0} color={s.critical_incidents>0?'#dc2626':'#16a34a'} icon="🚨" onClick={() => navigate('/ehs')} />
        <KPI label="Near Misses" value={s.near_misses||0} color="#d97706" icon="⚠️" onClick={() => navigate('/ehs')} />
        <KPI label="LTI Free Days" value={s.lti_free_days||0} color="#16a34a" icon="🏆" onClick={() => navigate('/ehs')} />
        <KPI label="Closed This Month" value={s.closed_month||0} color="#1b1b1d" icon="✅" onClick={() => navigate('/ehs')} />
        <KPI label="Open Actions" value={s.open_actions||0} color="#d97706" icon="📋" onClick={() => navigate('/ehs')} />
      </div>
    </div>
  )
}

// ── FINANCE ───────────────────────────────────────────────────────────────────
function FinanceDashboard({ token }) {
  const navigate = useNavigate()
  const [d, setD] = useState(null)
  const [err, setErr] = useState(false)
  useEffect(() => {
    const load = () => API('/api/dashboard', token).then(r => r.success ? setD(r.data) : setErr(true)).catch(() => setErr(true))
    load()
    const t = setInterval(load, 60000)
    return () => clearInterval(t)
  }, [])
  if (err) return <div style={S.loading}>Couldn't load dashboard data. Retrying…</div>
  if (!d) return <div style={S.loading}>Loading...</div>
  const inv = d.inventory || {}; const pur = d.purchase || {}
  return (
    <div>
      <div style={S.grid(3)} className="stagger">
        <KPI label="Stock Value" value={inv.total_value?`₹${Number(inv.total_value).toLocaleString('en-IN',{maximumFractionDigits:0})}`:'—'} color="#16a34a" icon="💰" featured onClick={() => navigate('/reports')} />
        <KPI label="Pending Payments" value={pur.pending_payments||0} color="#dc2626" icon="💳" onClick={() => navigate('/purchase')} />
        <KPI label="Overdue Receivables" value={d.sales?.overdue||0} color="#dc2626" icon="💸" onClick={() => navigate('/sales')} />
        <KPI label="Open POs Value" value={pur.open_po_value?`₹${Number(pur.open_po_value).toLocaleString('en-IN',{maximumFractionDigits:0})}`:'—'} color="#d97706" icon="📄" onClick={() => navigate('/purchase')} />
        <KPI label="Month Production MT" value={`${((d.production?.month?.total_kg||0)/1000).toFixed(1)} MT`} color="#1b1b1d" icon="🏭" onClick={() => navigate('/production')} />
        <KPI label="Pending Indents Value" value={pur.pending_indents_value?`₹${Number(pur.pending_indents_value).toLocaleString('en-IN',{maximumFractionDigits:0})}`:'—'} color="#1b1b1d" icon="📋" onClick={() => navigate('/indent')} />
      </div>
    </div>
  )
}

// ── GENERIC (Security, Lab, Scrap, Packing, FGW, Admin-dept) ─────────────────
function GenericDashboard({ label, token }) {
  const navigate = useNavigate()
  return (
    <div style={S.sec}>
      <div style={{ textAlign: 'center', padding: '32px 16px' }}>
        <div style={{ fontSize: 44, marginBottom: 12 }}>🏢</div>
        <div style={{ fontWeight: 800, fontSize: 18, color: '#18181b', marginBottom: 6 }}>{label || 'Department'} Workspace</div>
        <div style={{ fontSize: 13, color: '#71717a', maxWidth: 460, margin: '0 auto 24px', lineHeight: 1.5 }}>
          Welcome to your operational area. Access your key modules, store requests, and daily reports from the navigation sidebar or quick links below.
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button style={{ padding: '9px 18px', borderRadius: 10, border: 'none', background: '#18181b', color: '#f4c84b', fontSize: 13, fontWeight: 700, cursor: 'pointer' }} onClick={() => navigate('/store')}>
            Store Requests & Indents
          </button>
          <button style={{ padding: '9px 18px', borderRadius: 10, border: '1px solid #d4d4d8', background: '#fff', color: '#3f3f46', fontSize: 13, fontWeight: 600, cursor: 'pointer' }} onClick={() => navigate('/reports')}>
            View Reports
          </button>
        </div>
      </div>
    </div>
  )
}

// ── ROUTER — pick dashboard by dept ──────────────────────────────────────────
const DEPT_MAP = {
  'Production':               ProductionDashboard,
  'Maintenance':              MaintenanceDashboard,
  'Utility':                  UtilityDashboard,
  'Quality':                  QualityDashboard,
  'Raw Material Store':       StoreDashboard,
  'Inventory':                StoreDashboard,
  'Store Management':         StoreDashboard,
  'Indent Management':        StoreDashboard,
  'Packing':                  StoreDashboard,
  'Finished Goods Warehouse': StoreDashboard,
  'Purchase':                 PurchaseDashboard,
  'Sales':                    SalesDashboard,
  'Dispatch':                 SalesDashboard,
  'HR & Payroll':             HRDashboard,
  'Finance':                  FinanceDashboard,
  'EHS':                      EHSDashboard,
}

const TITLES = {
  'Production': { icon: '🏭', title: 'Production Dashboard' },
  'Maintenance': { icon: '🔧', title: 'Maintenance Dashboard' },
  'Utility': { icon: '⚡', title: 'Utility Dashboard' },
  'Quality': { icon: '✅', title: 'Quality Dashboard' },
  'Raw Material Store': { icon: '📦', title: 'Raw Material Store' },
  'Inventory': { icon: '🗄️', title: 'Inventory Dashboard' },
  'Store Management': { icon: '🏪', title: 'Store Dashboard' },
  'Purchase': { icon: '🛒', title: 'Purchase Dashboard' },
  'Sales': { icon: '💼', title: 'Sales Dashboard' },
  'Dispatch': { icon: '🚛', title: 'Dispatch Dashboard' },
  'HR & Payroll': { icon: '👥', title: 'HR Dashboard' },
  'Finance': { icon: '💰', title: 'Finance Dashboard' },
  'EHS': { icon: '🦺', title: 'EHS Dashboard' },
}

export default function Dashboard() {
  const { user, token } = useAuth()
  const lvl = user?.role_level || 1
  const dept = user?.department || ''

  const isAdminLevel = lvl >= 4
  const DeptComp = DEPT_MAP[dept]
  const meta = TITLES[dept] || { icon: '📊', title: `${dept} Dashboard` }

  const { icon, title } = isAdminLevel
    ? { icon: '🏢', title: lvl >= 5 ? 'Admin — Operations Overview' : 'Plant Head — Operations Overview' }
    : meta

  const DashComp = isAdminLevel ? AdminDashboard : (DeptComp || GenericDashboard)

  const firstName = (user?.name || 'there').split(' ')[0]
  return (
    <div style={S.page}>
      <div style={S.hero}>
        <div style={S.heroL}>
          <h1 style={S.title}>Welcome back, {firstName} 👋</h1>
          <p style={S.sub}>
            {title} · {dept || 'All Departments'} · {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <span style={S.rolePill}><span style={S.roleDot} /> {user?.role || 'User'}</span>
      </div>
      <DashComp token={token} label={dept} />
    </div>
  )
}
