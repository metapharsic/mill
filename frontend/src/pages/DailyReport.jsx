import React, { useState, useEffect, useCallback } from 'react'

const API = '/api/production'
const h = () => ({ Authorization: `Bearer ${localStorage.getItem('mk_token')}`, 'Content-Type': 'application/json' })
const api = (path, opts) => fetch(API + path, { headers: h(), ...opts }).then(r => r.json())

const today = () => new Date().toISOString().slice(0, 10)
const mt = v => Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 3, maximumFractionDigits: 3 })
const n2 = v => Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const VBadge = ({ status }) => {
  const map = { ALERT: { bg: '#fee2e2', c: '#dc2626', t: '🔴 ALERT' }, OK: { bg: '#dcfce7', c: '#15803d', t: '🟢 OK' }, 'N/A': { bg: '#eeede7', c: '#8a8a90', t: '— N/A' } }
  const cfg = map[status] || map['N/A']
  return <span style={{ ...S.badge, background: cfg.bg, color: cfg.c }}>{cfg.t}</span>
}

export default function DailyReport() {
  const [machines, setMachines] = useState([])
  const [machineId, setMachineId] = useState(1)
  const [date, setDate] = useState(today())
  const [rep, setRep] = useState(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => { api('/machines').then(r => { if (r.success) setMachines((r.data || []).filter(m => !m.type || m.type === 'Paper Machine')) }) }, [])

  const load = useCallback(async () => {
    setLoading(true); setMsg('')
    const r = await api(`/daily-report?date=${date}&machine_id=${machineId}`)
    setRep(r.success ? r.data : null)
    setLoading(false)
  }, [date, machineId])
  useEffect(() => { load() }, [load])

  // Pull from shop-floor transactions and save a draft — the "assemble from transactions" flow
  const autofill = async () => {
    setBusy(true); setMsg('')
    const af = await api(`/daily-report/autofill?date=${date}&machine_id=${machineId}`)
    if (!af.success) { setBusy(false); setMsg('Autofill failed'); return }
    const d = af.data
    if (!d.pmc_production_mt) { setBusy(false); setMsg('⚠ No shop-floor transactions for this date — nothing to assemble. Enter reels/utility/chemical/furnish first.'); return }
    const body = {
      report_date: date, machine_id: machineId,
      pmc_production_mt: d.pmc_production_mt, finish_production_mt: d.finish_production_mt, total_sets: d.total_sets,
      running_minutes: d.running_minutes, down_minutes: d.down_minutes,
      power_units: d.power_units, dg_units: d.dg_units, total_steam_mt: d.total_steam_mt, rice_husk_mt: d.rice_husk_mt,
      furnish_local_mt: d.furnish_local_mt, furnish_occ_mt: d.furnish_occ_mt, furnish_total_mt: d.furnish_total_mt,
      gsm_breakup: (d.gsm_breakup || []).map(g => ({ gsm: g.gsm, sets: g.sets, production_mt: g.production_mt })),
      chemicals: d.chemicals || [], downtime: d.downtime || [], status: 'Draft',
    }
    const save = await api('/daily-report', { method: 'POST', body: JSON.stringify(body) })
    setBusy(false)
    setMsg(save.success ? '✓ Assembled from shop-floor transactions' : (save.message || 'Save failed'))
    if (save.success) load()
  }

  const approve = async () => {
    if (!rep?.id) return
    setBusy(true)
    const r = await api(`/daily-report/${rep.id}/approve`, { method: 'PUT' })
    setBusy(false); setMsg(r.success ? '✓ Approved' : (r.message || 'Failed')); if (r.success) load()
  }

  const handleImport = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    setBusy(true)
    setMsg('')
    const fd = new FormData()
    fd.append('file', file)

    try {
      const res = await fetch('/api/production/dpr/import', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('mk_token')}`
        },
        body: fd
      }).then(r => r.json())

      if (res.success) {
        setMsg(`✓ Imported ${res.importedCount} Daily Performance Statement reports successfully.`)
        load()
      } else {
        setMsg(`❌ Import failed: ${res.message}`)
      }
    } catch (err) {
      setMsg(`❌ Import error: ${err.message}`)
    } finally {
      setBusy(false)
      e.target.value = '' // clear input
    }
  }

  const shareWhatsApp = () => {
    if (!rep) return
    
    // Fallbacks for ratios if they don't exist yet
    const r = rep.ratios || {}
    const avg = rep.weekly_avg || {}
    const now = new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
    const user = rep.createdByName || 'System'

    const pmcDiff = avg.pmc_production_mt ? (rep.pmc_production_mt - avg.pmc_production_mt) : 0
    const pmcTrend = pmcDiff > 0 ? `(📈 +${mt(pmcDiff)} MT vs 7-day avg)` : pmcDiff < 0 ? `(📉 ${mt(pmcDiff)} MT vs 7-day avg)` : ''

    const finishDiff = avg.finish_production_mt ? (rep.finish_production_mt - avg.finish_production_mt) : 0
    const finishTrend = finishDiff > 0 ? `(📈 +${mt(finishDiff)} MT vs 7-day avg)` : finishDiff < 0 ? `(📉 ${mt(finishDiff)} MT vs 7-day avg)` : ''

    const txt = `📄 *DAILY PERFORMANCE STATEMENT*
📅 *Date:* ${rep.date}
⚙️ *Machine:* ${rep.machineName}
👤 *Sent By:* ${user}
🕒 *Time:* ${now}

━━━━━━━━━━━━━━━━━━━━
🏭 *PRODUCTION SUMMARY*
━━━━━━━━━━━━━━━━━━━━
• *PM/C Prod:*  ${mt(rep.pmc_production_mt)} MT ${pmcTrend}
• *Finished:*   ${mt(rep.finish_production_mt)} MT (Yield: ${r.finish_pct ?? '-'}%) ${finishTrend}
• *Total Sets:* ${rep.total_sets}
• *Running:*    ⏳ ${rep.running_hhmm}
• *Downtime:*   🛑 ${rep.down_hhmm}

📦 *GSM-WISE BREAKUP*
${rep.gsm_breakup.map(g => `▫️ *${g.gsm} GSM:* ${mt(g.production_mt)} MT (${g.sets} sets)`).join('\n')}

⚡ *UTILITIES & BOILER*
• *Power:* ${n2(rep.power_units)} Units (${r.power_unit_per_ton ?? '-'} U/Ton)
• *Steam:* ${mt(rep.total_steam_mt)} MT (${r.steam_mt_per_ton ?? '-'} MT/Ton)
• *Rice Husk:* ${mt(rep.rice_husk_mt)} MT

♻️ *FURNISH DETAILS*
• *Total Consumed:* ${mt(rep.furnish_total_mt)} MT
  ↳ Local: ${mt(rep.furnish_local_mt)} MT
  ↳ OCC: ${mt(rep.furnish_occ_mt)} MT
• *Yield:* ${r.furnish_yield_pct ?? '-'}%
━━━━━━━━━━━━━━━━━━━━`
    
    window.open(`https://wa.me/?text=${encodeURIComponent(txt)}`, '_blank')
  }

  return (
    <div style={S.page}>
      <div style={S.hdr}>
        <div>
          <div style={S.title}>Daily Performance Statement</div>
          <div style={S.sub}>Auto-assembled from Production · Chemical · Utility · Furnish transactions or imported from Excel</div>
        </div>
        <div style={S.controls}>
          <select style={S.input} value={machineId} onChange={e => setMachineId(Number(e.target.value))}>
            {machines.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
          <input style={S.input} type="date" value={date} onChange={e => setDate(e.target.value)} />
          <button style={S.btnGhost} onClick={load} disabled={busy}>↻</button>
          
          <input type="file" id="dps-excel-upload" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={handleImport} />
          <button style={S.btnGhost} onClick={() => document.getElementById('dps-excel-upload').click()} disabled={busy}>
            📤 Upload Excel log
          </button>

          <button style={S.btn} onClick={autofill} disabled={busy}>{busy ? '…' : '⚡ Assemble from shop floor'}</button>
        </div>
      </div>

      {msg && <div style={S.msg}>{msg}</div>}

      {loading ? <div style={S.empty}>Loading…</div> : !rep ? (
        <div style={S.empty}>
          <p style={{ margin: '0 0 14px 0' }}>
            No report for {date}. Click <b>⚡ Assemble from shop floor</b> to build it from that day's transactions
            (reels, utility readings, chemical consumption, furnish batches).
          </p>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, background: '#f6f5f0', padding: '14px 20px', borderRadius: 10, border: '1px dashed #d8d6cc' }}>
            <span style={{ fontSize: 13, color: '#3a3a3e', fontWeight: 500 }}>Or import the Daily Performance spreadsheet:</span>
            <button style={{ ...S.btn, padding: '6px 12px', fontSize: 12 }} onClick={() => document.getElementById('dps-excel-upload').click()} disabled={busy}>
              Browse File (.xlsx)
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* status strip */}
          <div style={S.statusStrip}>
            <span style={{ ...S.statusPill, background: rep.status === 'Approved' ? '#dcfce7' : '#fbeec4', color: rep.status === 'Approved' ? '#15803d' : '#8a6a12' }}>
              {rep.status}
            </span>
            <span style={S.muted}>Machine: <b>{rep.machineName}</b></span>
            <span style={S.muted}>By: {rep.createdByName || '—'}</span>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 10 }}>
              <button style={{ ...S.btn, padding: '6px 14px', background: '#25D366' }} onClick={shareWhatsApp}>💬 Send on WhatsApp</button>
              {rep.status !== 'Approved' && <button style={{ ...S.btn, padding: '6px 14px' }} onClick={approve} disabled={busy}>✓ Approve</button>}
            </div>
          </div>

          {/* KPI row */}
          <div style={S.kpiRow}>
            <KPI label="PM/C Production" value={`${mt(rep.pmc_production_mt)} MT`} />
            <KPI label="Finished" value={`${mt(rep.finish_production_mt)} MT`} sub={`${rep.ratios.finish_pct}%`} />
            <KPI label="Total Sets" value={rep.total_sets} />
            <KPI label="Running" value={rep.running_hhmm} color="#15803d" />
            <KPI label="Down" value={rep.down_hhmm} color="#dc2626" />
          </div>

          {/* GSM wise */}
          <Section title="GSM-wise Production">
            <table style={S.tbl}>
              <thead><tr>{['Grade', 'Sets', 'Production (MT)'].map(c => <th key={c} style={S.th}>{c}</th>)}</tr></thead>
              <tbody>
                {rep.gsm_breakup.map((g, i) => (
                  <tr key={i}><td style={S.td}><b>{g.gsm}{g.bf != null ? `/${g.bf}` : ''}</b></td><td style={S.td}>{g.sets}</td><td style={S.td}>{mt(g.production_mt)}</td></tr>
                ))}
                <tr style={S.totalRow}>
                  <td style={S.td}>TOTAL</td>
                  <td style={S.td}>{rep.gsm_breakup.reduce((a, g) => a + g.sets, 0)}</td>
                  <td style={S.td}>{mt(rep.gsm_breakup.reduce((a, g) => a + g.production_mt, 0))}</td>
                </tr>
              </tbody>
            </table>
          </Section>

          {/* Downtime */}
          {rep.downtime.length > 0 && (
            <Section title="Downtime">
              <table style={S.tbl}>
                <thead><tr>{['Shift', 'Duration', 'Reason', 'Code'].map(c => <th key={c} style={S.th}>{c}</th>)}</tr></thead>
                <tbody>
                  {rep.downtime.map(d => (
                    <tr key={d.id}><td style={S.td}>{d.shift || '—'}</td><td style={S.td}>{d.hhmm}</td><td style={S.td}>{d.reason}</td><td style={S.td}><span style={S.code}>{d.reason_code || '—'}</span></td></tr>
                  ))}
                </tbody>
              </table>
            </Section>
          )}

          {/* Chemicals with variance */}
          <Section title="Chemical Consumption (vs standard)">
            <table style={S.tbl}>
              <thead><tr>{['Chemical', 'Used (Kg)', 'Kg/Ton', 'Std', 'Variance', 'Status'].map(c => <th key={c} style={S.th}>{c}</th>)}</tr></thead>
              <tbody>
                {rep.chemicals.map(c => (
                  <tr key={c.id}>
                    <td style={S.td}><b>{c.chemical_name}</b></td>
                    <td style={S.td}>{n2(c.qty_kg)}</td>
                    <td style={S.td}>{c.kg_per_ton}</td>
                    <td style={S.td}>{c.std_per_ton ?? '—'}</td>
                    <td style={{ ...S.td, color: c.variance > 0 ? '#dc2626' : '#15803d' }}>{c.variance == null ? '—' : (c.variance > 0 ? '+' : '') + c.variance}</td>
                    <td style={S.td}><VBadge status={c.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>

          {/* Furnish + Power + Boiler */}
          <div style={S.grid3}>
            <Section title="Furnish">
              <Row k="Local" v={`${mt(rep.furnish_local_mt)} MT`} />
              <Row k="OCC" v={`${mt(rep.furnish_occ_mt)} MT`} />
              <Row k="Total" v={`${mt(rep.furnish_total_mt)} MT`} bold />
              <Row k="Yield" v={`${rep.ratios.furnish_yield_pct}%`} sub={`std ${rep.ratios.yield_std ?? '—'}%`} />
            </Section>
            <Section title="Power">
              <Row k="Total Units" v={n2(rep.power_units)} />
              <Row k="Unit/Ton" v={rep.ratios.power_unit_per_ton} status={rep.ratios.power_status} />
              <Row k="Std" v={rep.ratios.power_std ?? '—'} />
            </Section>
            <Section title="Boiler">
              <Row k="Rice Husk" v={`${mt(rep.rice_husk_mt)} MT`} />
              <Row k="Husk/Ton" v={rep.ratios.husk_mt_per_ton} status={rep.ratios.husk_status} />
              <Row k="Steam" v={`${mt(rep.total_steam_mt)} MT`} />
              <Row k="Steam/Ton" v={rep.ratios.steam_mt_per_ton} status={rep.ratios.steam_status} />
            </Section>
          </div>
        </>
      )}
    </div>
  )
}

const KPI = ({ label, value, sub, color = '#1b1b1d' }) => (
  <div style={S.kpi}>
    <div style={S.kpiLabel}>{label}</div>
    <div style={{ ...S.kpiVal, color }}>{value}</div>
    {sub && <div style={S.kpiSub}>{sub}</div>}
  </div>
)
const Section = ({ title, children }) => (
  <div style={S.card}><div style={S.cardTitle}>{title}</div>{children}</div>
)
const Row = ({ k, v, sub, bold, status }) => (
  <div style={S.row}>
    <span style={S.rowK}>{k}</span>
    <span style={{ ...S.rowV, fontWeight: bold ? 700 : 500 }}>
      {v}{sub && <span style={S.muted}> · {sub}</span>}
      {status && <span style={{ marginLeft: 8 }}><VBadge status={status} /></span>}
    </span>
  </div>
)

const S = {
  page: { padding: 24, background: '#f6f5f0', minHeight: '100vh' },
  hdr: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18, flexWrap: 'wrap', gap: 12 },
  title: { fontSize: 22, fontWeight: 700, color: '#1b1b1d' },
  sub: { fontSize: 13, color: '#8a8a90', marginTop: 4 },
  controls: { display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' },
  input: { padding: '8px 12px', border: '1px solid #d8d6cc', borderRadius: 8, fontSize: 13, background: '#fff' },
  btn: { background: '#1b1b1d', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', cursor: 'pointer', fontSize: 13, fontWeight: 600 },
  btnGhost: { background: '#fff', color: '#3a3a3e', border: '1px solid #d8d6cc', borderRadius: 8, padding: '8px 12px', cursor: 'pointer', fontSize: 13 },
  msg: { background: '#1b1b1d', color: '#f4f4ef', padding: '8px 14px', borderRadius: 8, fontSize: 12.5, marginBottom: 14, display: 'inline-block' },
  empty: { background: '#fff', borderRadius: 12, padding: 40, textAlign: 'center', color: '#8a8a90', fontSize: 13, lineHeight: 1.6 },
  statusStrip: { display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16, padding: '10px 14px', background: '#fff', borderRadius: 10, fontSize: 12.5 },
  statusPill: { fontSize: 11, padding: '3px 10px', borderRadius: 999, fontWeight: 700 },
  kpiRow: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 12, marginBottom: 16 },
  kpi: { background: '#fff', borderRadius: 12, padding: '14px 16px', boxShadow: '0 1px 4px rgba(0,0,0,.06)' },
  kpiLabel: { fontSize: 11, color: '#8a8a90', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 },
  kpiVal: { fontSize: 22, fontWeight: 700, marginTop: 4 },
  kpiSub: { fontSize: 11, color: '#a0a0a6', marginTop: 2 },
  card: { background: '#fff', borderRadius: 12, padding: 18, marginBottom: 16, boxShadow: '0 1px 4px rgba(0,0,0,.06)' },
  cardTitle: { fontSize: 14, fontWeight: 700, color: '#1b1b1d', marginBottom: 12 },
  grid3: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 16 },
  tbl: { width: '100%', borderCollapse: 'collapse' },
  th: { padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#8a8a90', textTransform: 'uppercase', borderBottom: '1px solid #ecebe5' },
  td: { padding: '8px 12px', fontSize: 13, color: '#1b1b1d', borderBottom: '1px solid #f6f5f0' },
  totalRow: { fontWeight: 700, background: '#f6f5f0' },
  code: { fontFamily: 'monospace', fontSize: 11, color: '#6b6b70', background: '#f6f5f0', padding: '2px 6px', borderRadius: 4 },
  badge: { fontSize: 11, padding: '2px 8px', borderRadius: 999, fontWeight: 600 },
  row: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: '1px solid #f6f5f0', fontSize: 13 },
  rowK: { color: '#8a8a90' },
  rowV: { color: '#1b1b1d' },
  muted: { color: '#a0a0a6', fontSize: 11 },
}
