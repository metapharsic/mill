import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ConfirmModal } from '../components/ui/Modal'

// ─── API helper ───────────────────────────────────────────────────────────────
const API = (path, opts = {}) =>
  fetch(path, {
    headers: {
      Authorization: `Bearer ${localStorage.getItem('mk_token')}`,
      'Content-Type': 'application/json',
      ...(opts.headers || {}),
    },
    ...opts,
  }).then(async (r) => {
    const data = await r.json().catch(() => ({}))
    if (!r.ok) throw new Error(data.message || 'Request failed')
    return data
  })

// ─── Number formatters per §13 ────────────────────────────────────────────────
const fmt = {
  weight:   (kg)  => kg != null ? `${Number(kg).toLocaleString('en-IN', { minimumFractionDigits: 3 })} KG` : '—',
  tonnage:  (mt)  => mt != null ? `${Number(mt).toFixed(3)} MT` : '—',
  currency: (rs)  => rs != null ? `₹${Number(rs).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—',
  gsm:      (g)   => g  != null ? `${Number(g).toFixed(1)} GSM` : '—',
  pct:      (p)   => p  != null ? `${Number(p).toFixed(2)}%` : '—',
  speed:    (s)   => s  != null ? `${Number(s).toFixed(0)} mpm` : '—',
  pressure: (p)   => p  != null ? `${Number(p).toFixed(2)} bar` : '—',
  moisture: (m)   => m  != null ? `${Number(m).toFixed(2)}%` : '—',
  mins:     (m)   => m  != null ? `${Number(m).toFixed(0)} min` : '—',
}

// ─── Reel status config ───────────────────────────────────────────────────────
const STATUS_COLORS = {
  'In Production': '#f59e0b',
  'QC Pending':    '#1b1b1d',
  'QC Done':       '#1b1b1d',
  'In Warehouse':  '#10b981',
  'Dispatched':    '#8a8a90',
  'Rejected':      '#ef4444',
}

const VALID_NEXT = {
  'In Production': ['QC Pending'],
  'QC Pending':    ['QC Done'],
  'QC Done':       ['In Warehouse', 'Rejected'],
  'In Warehouse':  ['Dispatched'],
  'Dispatched':    [],
  'Rejected':      [],
}

// ─── Initial form states ──────────────────────────────────────────────────────
const initShift = () => ({
  date: new Date().toISOString().split('T')[0],
  shift_type: 'Day',
  start_time: '',
  end_time: '',
  machine_id: '',
  remarks: '',
})

const initReel = () => ({
  machine_id: '', grade_id: '', shift_id: '', operator_id: '',
  gsm: '', width_mm: '', length_m: '', weight_kg: '',
  moisture_pct: '', speed_mpm: '', steam_pressure: '', steam_consumption: '',
  water_consumption: '', start_time: '', end_time: '',
  production_time_min: '', break_time_min: '', downtime_min: '',
  reject_pct: '', sales_order_id: '', remarks: '',
  bf: '', deckle: '', reject_reason: ''
})

const initDowntime = () => ({
  machine_id: '', shift_id: '', reel_id: '',
  start_time: '', end_time: '', duration_min: '',
  category: 'Mechanical', reason: '', corrective_action: '',
  reason_code_id: '',
})

const initShiftReport = () => ({
  date: new Date().toISOString().split('T')[0],
  shift_type: 'Day',
  section: 'Machine Room',
  data: { pulp_level: '', machine_speed: '', remarks: '' },
  remarks: '',
})

const initChemical = () => ({
  date: new Date().toISOString().split('T')[0],
  shift_type: 'Day',
  chemical_id: '',
  qty_consumed: '',
  unit_cost: '',
})

const initFurnish = () => ({
  batch_number: '',
  report_date: new Date().toISOString().split('T')[0],
  machine_id: '',
  shift_type: 'Day',
  local_furnish_kg: '',
  occ_furnish_kg: '',
  other_furnish_kg: '',
  local_lot: '',
  occ_lot: '',
  local_moisture: '',
  occ_moisture: '',
  remarks: '',
})

// ─── Main Component ────────────────────────────────────────────────────────────
export default function Production() {
  const [tab, setTab] = useState('shifts')

  // Master data
  const [machines, setMachines] = useState([])
  const [grades, setGrades]     = useState([])
  const [users, setUsers]       = useState([])
  const [chemicals, setChemicals] = useState([])

  // Module data
  const [shifts, setShifts]   = useState([])
  const [reels, setReels]     = useState([])
  const [downtime, setDowntime] = useState([])
  const [oeeData, setOeeData] = useState([])
  const [shiftReports, setShiftReports] = useState([])
  const [chemicalLogs, setChemicalLogs] = useState([])
  const [reasonCodes, setReasonCodes] = useState([])
  const [furnishLogs, setFurnishLogs] = useState([])

  // Filters
  const todayStr = new Date().toISOString().split('T')[0]
  const [filterDate, setFilterDate] = useState(todayStr)
  const [filterMachine, setFilterMachine] = useState('')
  const [oeeDate, setOeeDate] = useState(todayStr)

  // Forms
  const [shiftForm, setShiftForm]     = useState(initShift)
  const [reelForm, setReelForm]       = useState(initReel)
  const [downtimeForm, setDowntimeForm] = useState(initDowntime)
  const [reportForm, setReportForm]   = useState(initShiftReport)
  const [chemForm, setChemForm]       = useState(initChemical)
  const [furnishForm, setFurnishForm] = useState(initFurnish)
  const [printReel, setPrintReel]     = useState(null)

  // UI state
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState({ text: '', ok: true })
  const [busy, setBusy] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [closeShiftTarget, setCloseShiftTarget] = useState(null)

  const toast = (text, ok = true) => {
    setMsg({ text, ok })
    setTimeout(() => setMsg({ text: '', ok: true }), 5000)
  }

  // ── Load master data once ──────────────────────────────────────────────────
  const loadMaster = useCallback(async () => {
    const [mRes, gRes, uRes] = await Promise.all([
      API('/api/production/machines'),
      API('/api/production/grades'),
      API('/api/users'),
    ])
    setMachines(mRes.data || [])
    setGrades(gRes.data || [])
    setUsers((uRes.data || []).filter(u => u.is_active !== false))

    // Fallback/Get materials for chemical select
    const matRes = await API('/api/master/materials').catch(() => ({ data: [] }))
    setChemicals(matRes.data || [])
  }, [])

  // ── Load tab-specific data ─────────────────────────────────────────────────
  const loadShifts = useCallback(async (date, mid) => {
    const q = new URLSearchParams()
    if (date) q.set('date', date)
    if (mid)  q.set('machine_id', mid)
    const r = await API(`/api/production/shifts?${q}`)
    setShifts(r.data || [])
  }, [])

  const loadReels = useCallback(async (date, mid) => {
    const q = new URLSearchParams()
    if (date) q.set('date', date)
    if (mid)  q.set('machine_id', mid)
    q.set('limit', '50')
    const r = await API(`/api/production/reels?${q}`)
    setReels(r.data || [])
  }, [])

  const loadDowntime = useCallback(async (date, mid) => {
    const q = new URLSearchParams()
    if (date) q.set('date', date)
    if (mid)  q.set('machine_id', mid)
    q.set('limit', '50')
    const [r, rc] = await Promise.all([
      API(`/api/production/downtime?${q}`),
      API('/api/production/downtime-reason-codes').catch(() => ({ data: [] }))
    ])
    setDowntime(r.data || [])
    setReasonCodes(rc.data || [])
  }, [])

  const loadOee = useCallback(async (date) => {
    const r = await API(`/api/production/oee?date=${date}`)
    setOeeData(r.data || [])
  }, [])

  const loadShiftReports = useCallback(async (date) => {
    const q = new URLSearchParams()
    if (date) q.set('date', date)
    const r = await API(`/api/production/shift-reports?${q}`).catch(() => ({ data: [] }))
    setShiftReports(r.data || [])
  }, [])

  const loadChemicalsLog = useCallback(async (date) => {
    const q = new URLSearchParams()
    if (date) q.set('date', date)
    const r = await API(`/api/production/chemical-consumption?${q}`).catch(() => ({ data: [] }))
    setChemicalLogs(r.data || [])
  }, [])

  const loadFurnish = useCallback(async (date, mid) => {
    const q = new URLSearchParams()
    if (date) q.set('date', date)
    if (mid)  q.set('machine_id', mid)
    const r = await API(`/api/production/furnish?${q}`).catch(() => ({ data: [] }))
    setFurnishLogs(r.data || [])
  }, [])

  // Initial load
  useEffect(() => {
    setLoading(true)
    Promise.all([
      loadMaster(),
      loadShifts(filterDate, filterMachine),
      loadReels(filterDate, filterMachine),
      loadDowntime(filterDate, filterMachine),
      loadOee(oeeDate),
      loadShiftReports(filterDate),
      loadChemicalsLog(filterDate),
      loadFurnish(filterDate, filterMachine)
    ]).catch(e => toast(e.message, false)).finally(() => setLoading(false))
  }, []) // eslint-disable-line

  // Reload when filters change
  useEffect(() => {
    if (tab === 'shifts')   loadShifts(filterDate, filterMachine)
    if (tab === 'reels')    loadReels(filterDate, filterMachine)
    if (tab === 'downtime') loadDowntime(filterDate, filterMachine)
    if (tab === 'reports')  loadShiftReports(filterDate)
    if (tab === 'chemicals') loadChemicalsLog(filterDate)
    if (tab === 'furnish')   loadFurnish(filterDate, filterMachine)
  }, [filterDate, filterMachine, tab]) // eslint-disable-line

  useEffect(() => { loadOee(oeeDate) }, [oeeDate]) // eslint-disable-line

  // ── Shifts today for dropdowns ─────────────────────────────────────────────
  const todayShifts = useMemo(() => shifts.filter(s => s.status === 'Open' || !s.status), [shifts])

  // ── Efficiency live-preview ────────────────────────────────────────────────
  const liveEfficiency = useMemo(() => {
    const p = Number(reelForm.production_time_min) || 0
    const b = Number(reelForm.break_time_min) || 0
    const d = Number(reelForm.downtime_min)   || 0
    if (p > 0) return Math.max(0, Math.min(100, ((p - b - d) / p) * 100)).toFixed(2)
    return null
  }, [reelForm.production_time_min, reelForm.break_time_min, reelForm.downtime_min])

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleShiftSubmit = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      await API('/api/production/shifts', { method: 'POST', body: JSON.stringify(shiftForm) })
      toast('Shift opened successfully ✓')
      setShiftForm(initShift)
      loadShifts(filterDate, filterMachine)
    } catch (err) { toast(err.message, false) } finally { setBusy(false) }
  }

  const confirmCloseShift = async () => {
    if (!closeShiftTarget) return
    setActionLoading(true)
    try {
      await API(`/api/production/shifts/${closeShiftTarget.id}`, { method: 'PUT', body: JSON.stringify({ end_time: new Date().toISOString() }) })
      toast('Shift closed ✓')
      setCloseShiftTarget(null)
      loadShifts(filterDate, filterMachine)
    } catch (err) { toast(err.message, false) } finally { setActionLoading(false) }
  }

  const handleReelSubmit = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      const payload = Object.fromEntries(
        Object.entries(reelForm).map(([k, v]) => [k, v === '' ? null : (
          ['gsm','width_mm','length_m','weight_kg','moisture_pct','speed_mpm',
           'steam_pressure','steam_consumption','water_consumption',
           'production_time_min','break_time_min','downtime_min','reject_pct',
           'bf','deckle'].includes(k)
          ? Number(v) : v
        )])
      )
      const r = await API('/api/production/reels', { method: 'POST', body: JSON.stringify(payload) })
      toast(`Reel saved: ${r.data.reel_number} ✓`)
      setReelForm(initReel)
      loadReels(filterDate, filterMachine)
    } catch (err) { toast(err.message, false) } finally { setBusy(false) }
  }

  const handleReelStatusChange = async (reelId, newStatus) => {
    setBusy(true)
    try {
      await API(`/api/production/reels/${reelId}/status`, { method: 'PUT', body: JSON.stringify({ status: newStatus }) })
      toast(`Reel status → ${newStatus} ✓`)
      loadReels(filterDate, filterMachine)
    } catch (err) { toast(err.message, false) } finally { setBusy(false) }
  }

  const handleDowntimeSubmit = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      const payload = {
        ...downtimeForm,
        duration_min: downtimeForm.duration_min ? Number(downtimeForm.duration_min) : null,
        reason_code_id: downtimeForm.reason_code_id ? Number(downtimeForm.reason_code_id) : null,
      }
      await API('/api/production/downtime', { method: 'POST', body: JSON.stringify(payload) })
      toast('Downtime logged ✓')
      setDowntimeForm(initDowntime)
      loadDowntime(filterDate, filterMachine)
    } catch (err) { toast(err.message, false) } finally { setBusy(false) }
  }

  const handleReportSubmit = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      await API('/api/production/shift-reports', { method: 'POST', body: JSON.stringify(reportForm) })
      toast('Daily Shift Report logged successfully ✓')
      setReportForm(initShiftReport)
      loadShiftReports(filterDate)
    } catch (err) { toast(err.message, false) } finally { setBusy(false) }
  }

  const handleChemSubmit = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      await API('/api/production/chemical-consumption', { method: 'POST', body: JSON.stringify(chemForm) })
      toast('Chemical consumption logged ✓')
      setChemForm(initChemical)
      loadChemicalsLog(filterDate)
    } catch (err) { toast(err.message, false) } finally { setBusy(false) }
  }

  const handleFurnishSubmit = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      const payload = {
        ...furnishForm,
        local_furnish_kg: furnishForm.local_furnish_kg ? Number(furnishForm.local_furnish_kg) : 0,
        occ_furnish_kg: furnishForm.occ_furnish_kg ? Number(furnishForm.occ_furnish_kg) : 0,
        other_furnish_kg: furnishForm.other_furnish_kg ? Number(furnishForm.other_furnish_kg) : 0,
        local_moisture: furnishForm.local_moisture ? Number(furnishForm.local_moisture) : null,
        occ_moisture: furnishForm.occ_moisture ? Number(furnishForm.occ_moisture) : null,
        machine_id: furnishForm.machine_id ? Number(furnishForm.machine_id) : null,
      }
      await API('/api/production/furnish', { method: 'POST', body: JSON.stringify(payload) })
      toast('Furnish log saved ✓')
      setFurnishForm(initFurnish)
      loadFurnish(filterDate, filterMachine)
    } catch (err) { toast(err.message, false) } finally { setBusy(false) }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={S.page}>
      {/* Header */}
      <div style={S.header}>
        <div>
          <div style={S.title}>⚙️ Production MES</div>
          <div style={S.sub}>Phase 3 — Shifts · Reels · Downtime · OEE · Shift Reports · Chemical Costing</div>
        </div>
        <span style={S.badge}>Live</span>
      </div>

      {/* Toast */}
      {msg.text && (
        <div style={{ ...S.toast, background: msg.ok ? '#dcfce7' : '#fee2e2', color: msg.ok ? '#15803d' : '#b91c1c', border: `1px solid ${msg.ok ? '#bbf7d0' : '#fecaca'}` }}>
          {msg.text}
        </div>
      )}

      {/* Tabs */}
      <div style={S.tabs}>
        {[
          { key: 'shifts',    label: '🕐 Shifts' },
          { key: 'reels',     label: '🧻 Reels' },
          { key: 'downtime',  label: '⚠️ Downtime' },
          { key: 'oee',       label: '📊 OEE' },
          { key: 'reports',   label: '📝 Shift Reports (F3)' },
          { key: 'chemicals', label: '🧪 Chemical Consum. (F4)' },
          { key: 'furnish',   label: '🌾 Furnish Mix' }
        ].map(t => (
          <button key={t.key} style={{ ...S.tab, ...(tab === t.key ? S.tabActive : {}) }} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Global Filters (not OEE tab) */}
      {tab !== 'oee' && (
        <div style={S.filterBar}>
          <label style={S.filterLabel}>Date
            <input type="date" style={S.filterInput} value={filterDate} onChange={e => setFilterDate(e.target.value)} />
          </label>
          {['shifts', 'reels', 'downtime'].includes(tab) && (
            <label style={S.filterLabel}>Machine
              <select style={S.filterInput} value={filterMachine} onChange={e => setFilterMachine(e.target.value)}>
                <option value="">All Machines</option>
                {machines.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </label>
          )}
        </div>
      )}

      {/* ══ SHIFTS TAB ══════════════════════════════════════════════════════════ */}
      {tab === 'shifts' && (
        <div style={S.twoPanel}>
          {/* Open Shift Form */}
          <div style={S.card}>
            <div style={S.cardTitle}>Open Shift</div>
            <form onSubmit={handleShiftSubmit} style={S.form}>
              <Field label="Date">
                <input style={S.input} type="date" value={shiftForm.date} onChange={e => setShiftForm(f => ({ ...f, date: e.target.value }))} required />
              </Field>
              <Field label="Shift Type">
                <select style={S.input} value={shiftForm.shift_type} onChange={e => setShiftForm(f => ({ ...f, shift_type: e.target.value }))}>
                  <option value="Day">Day (06:00–14:00)</option>
                  <option value="Night">Night (22:00–06:00)</option>
                  <option value="General">General (09:00–17:00)</option>
                </select>
              </Field>
              <Field label="Machine *">
                <select style={S.input} value={shiftForm.machine_id} onChange={e => setShiftForm(f => ({ ...f, machine_id: e.target.value }))} required>
                  <option value="">— Select Machine —</option>
                  {machines.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </Field>
              <div style={S.twoCol}>
                <Field label="Start Time *">
                  <input style={S.input} type="datetime-local" value={shiftForm.start_time} onChange={e => setShiftForm(f => ({ ...f, start_time: e.target.value }))} required />
                </Field>
                <Field label="End Time">
                  <input style={S.input} type="datetime-local" value={shiftForm.end_time} onChange={e => setShiftForm(f => ({ ...f, end_time: e.target.value }))} />
                </Field>
              </div>
              <Field label="Remarks">
                <textarea style={{ ...S.input, minHeight: 60 }} value={shiftForm.remarks} onChange={e => setShiftForm(f => ({ ...f, remarks: e.target.value }))} />
              </Field>
              <button style={S.btnPrimary} disabled={busy}>
                {busy ? '⏳ Opening...' : '▶ Open Shift'}
              </button>
            </form>
          </div>

          {/* Shift List */}
          <div style={S.card}>
            <div style={S.cardTitle}>Shifts — {filterDate}</div>
            {loading ? <Spin /> : shifts.length === 0
              ? <Empty text="No shifts found" />
              : (
              <div style={S.tableWrap}>
                <table style={S.table}>
                  <thead>
                    <tr>
                      <Th>Type</Th><Th>Machine</Th><Th>Supervisor</Th>
                      <Th>Reels</Th><Th>Production</Th><Th>Status</Th><Th>Action</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {shifts.map(s => (
                      <tr key={s.id} style={S.row}>
                        <Td><span style={S.shiftBadge}>{s.shift_type}</span></Td>
                        <Td>{s.machineName || '—'}</Td>
                        <Td>{s.supervisorName || '—'}</Td>
                        <Td>{s.reelCount ?? 0}</Td>
                        <Td>{fmt.weight(s.totalKg)}</Td>
                        <Td>
                          <span style={{ ...S.statusBadge, background: s.status === 'Open' ? '#dcfce7' : '#f6f5f0', color: s.status === 'Open' ? '#15803d' : '#8a8a90' }}>
                            {s.status || 'Open'}
                          </span>
                        </Td>
                        <Td>
                          {s.status !== 'Closed' && (
                            <button style={S.btnSm} onClick={() => setCloseShiftTarget(s)} disabled={busy}>
                              Close
                            </button>
                          )}
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══ REELS TAB ═══════════════════════════════════════════════════════════ */}
      {tab === 'reels' && (
        <div style={S.twoPanel}>
          {/* Form */}
          <div style={S.card}>
            <div style={S.cardTitle}>Log Finished Reel</div>
            <form onSubmit={handleReelSubmit} style={S.form}>
              <div style={S.twoCol}>
                <Field label="Machine *">
                  <select style={S.input} value={reelForm.machine_id} onChange={e => setReelForm(f => ({ ...f, machine_id: e.target.value }))} required>
                    <option value="">— Select —</option>
                    {machines.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                </Field>
                <Field label="Active Shift *">
                  <select style={S.input} value={reelForm.shift_id} onChange={e => setReelForm(f => ({ ...f, shift_id: e.target.value }))} required>
                    <option value="">— Select —</option>
                    {todayShifts.map(s => <option key={s.id} value={s.id}>{s.shiftType || s.shift_type} · {s.machineName}</option>)}
                  </select>
                </Field>
              </div>

              <div style={S.twoCol}>
                <Field label="Grade *">
                  <select style={S.input} value={reelForm.grade_id} onChange={e => setReelForm(f => ({ ...f, grade_id: e.target.value }))} required>
                    <option value="">— Select —</option>
                    {grades.map(g => <option key={g.id} value={g.id}>{g.name} ({g.code})</option>)}
                  </select>
                </Field>
                <Field label="Operator *">
                  <select style={S.input} value={reelForm.operator_id} onChange={e => setReelForm(f => ({ ...f, operator_id: e.target.value }))} required>
                    <option value="">— Select —</option>
                    {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </Field>
              </div>

              <div style={S.threeCol}>
                <Field label="GSM Spec *">
                  <input style={S.input} type="number" step="0.1" value={reelForm.gsm} onChange={e => setReelForm(f => ({ ...f, gsm: e.target.value }))} required />
                </Field>
                <Field label="Width (mm) *">
                  <input style={S.input} type="number" step="1" value={reelForm.width_mm} onChange={e => setReelForm(f => ({ ...f, width_mm: e.target.value }))} required />
                </Field>
                <Field label="Length (m)">
                  <input style={S.input} type="number" step="1" value={reelForm.length_m} onChange={e => setReelForm(f => ({ ...f, length_m: e.target.value }))} />
                </Field>
              </div>

              <div style={S.threeCol}>
                <Field label="BF Spec *">
                  <input style={S.input} type="number" step="1" value={reelForm.bf} onChange={e => setReelForm(f => ({ ...f, bf: e.target.value }))} required />
                </Field>
                <Field label="Deckle (mm)">
                  <input style={S.input} type="number" step="1" value={reelForm.deckle} onChange={e => setReelForm(f => ({ ...f, deckle: e.target.value }))} />
                </Field>
                <Field label="Reject/Trim Reason">
                  <input style={S.input} type="text" value={reelForm.reject_reason} onChange={e => setReelForm(f => ({ ...f, reject_reason: e.target.value }))} placeholder="Formation, trim, etc." />
                </Field>
              </div>

              <div style={S.threeCol}>
                <Field label="Net Weight (kg) *">
                  <input style={S.input} type="number" step="0.001" value={reelForm.weight_kg} onChange={e => setReelForm(f => ({ ...f, weight_kg: e.target.value }))} required />
                </Field>
                <Field label="Moisture % *">
                  <input style={S.input} type="number" step="0.01" value={reelForm.moisture_pct} onChange={e => setReelForm(f => ({ ...f, moisture_pct: e.target.value }))} required />
                </Field>
                <Field label="Reject %">
                  <input style={S.input} type="number" step="0.01" value={reelForm.reject_pct} onChange={e => setReelForm(f => ({ ...f, reject_pct: e.target.value }))} />
                </Field>
              </div>

              <div style={S.threeCol}>
                <Field label="Speed (mpm)">
                  <input style={S.input} type="number" value={reelForm.speed_mpm} onChange={e => setReelForm(f => ({ ...f, speed_mpm: e.target.value }))} />
                </Field>
                <Field label="Steam Pressure">
                  <input style={S.input} type="number" step="0.1" value={reelForm.steam_pressure} onChange={e => setReelForm(f => ({ ...f, steam_pressure: e.target.value }))} />
                </Field>
                <Field label="Steam Consum.">
                  <input style={S.input} type="number" step="0.1" value={reelForm.steam_consumption} onChange={e => setReelForm(f => ({ ...f, steam_consumption: e.target.value }))} />
                </Field>
              </div>

              <div style={S.threeCol}>
                <Field label="Total Mins *">
                  <input style={S.input} type="number" value={reelForm.production_time_min} onChange={e => setReelForm(f => ({ ...f, production_time_min: e.target.value }))} required />
                </Field>
                <Field label="Break Mins">
                  <input style={S.input} type="number" value={reelForm.break_time_min} onChange={e => setReelForm(f => ({ ...f, break_time_min: e.target.value }))} />
                </Field>
                <Field label="Downtime Mins">
                  <input style={S.input} type="number" value={reelForm.downtime_min} onChange={e => setReelForm(f => ({ ...f, downtime_min: e.target.value }))} />
                </Field>
              </div>

              {liveEfficiency && (
                <div style={S.effPreview}>
                  Calculated Efficiency: <strong>{liveEfficiency}%</strong>
                </div>
              )}

              <Field label="Remarks">
                <textarea style={{ ...S.input, minHeight: 40 }} value={reelForm.remarks} onChange={e => setReelForm(f => ({ ...f, remarks: e.target.value }))} />
              </Field>

              <button style={S.btnPrimary} disabled={busy}>
                {busy ? '⏳ Saving...' : '💾 Save Reel'}
              </button>
            </form>
          </div>

          {/* Reels List */}
          <div style={S.card}>
            <div style={S.cardTitle}>Reels — {filterDate}</div>
            {loading ? <Spin /> : reels.length === 0
              ? <Empty text="No reels found" />
              : (
              <div style={S.tableWrap}>
                <table style={S.table}>
                  <thead>
                    <tr>
                      <Th>Reel No</Th><Th>Machine</Th><Th>Grade/BF</Th>
                      <Th>GSM</Th><Th>Deckle</Th><Th>Weight</Th><Th>Efficiency</Th>
                      <Th>Status</Th><Th>Next Status</Th><Th>Action</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {reels.map(r => (
                      <tr key={r.id} style={S.row}>
                        <Td><span style={S.reelNum}>{r.reelNumber}</span></Td>
                        <Td>{r.machineName || '—'}</Td>
                        <Td>{r.gradeName ? `${r.gradeName} (${r.gradeCode})` : '—'}{r.bf ? ` / ${r.bf} BF` : ''}</Td>
                        <Td>{fmt.gsm(r.gsm)}</Td>
                        <Td>{r.deckle ? `${r.deckle} mm` : '—'}</Td>
                        <Td>
                          {fmt.weight(r.weightKg)}
                          {Number(r.rejectPct) > 0 && (
                            <div style={{ fontSize: 10, color: '#ef4444', marginTop: 2 }}>
                              Rej: {r.rejectPct}% {r.rejectReason ? `(${r.rejectReason})` : ''}
                            </div>
                          )}
                        </Td>
                        <Td>{fmt.pct(r.efficiencyPct)}</Td>
                        <Td>
                          <span style={{ ...S.statusBadge, background: (STATUS_COLORS[r.status] || '#a0a0a6') + '22', color: STATUS_COLORS[r.status] || '#8a8a90' }}>
                            {r.status || 'In Production'}
                          </span>
                        </Td>
                        <Td>
                          {(VALID_NEXT[r.status] || []).length > 0 && (
                            <select style={S.statusSelect} defaultValue="" onChange={e => { if (e.target.value) handleReelStatusChange(r.id, e.target.value) }}>
                              <option value="">Move to…</option>
                              {(VALID_NEXT[r.status] || []).map(ns => <option key={ns} value={ns}>{ns}</option>)}
                            </select>
                          )}
                        </Td>
                        <Td>
                          <button
                            type="button"
                            style={{ ...S.btnSm, background: '#0284c7' }}
                            onClick={() => setPrintReel(r)}
                          >
                            🖨️ Print
                          </button>
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══ DOWNTIME TAB ════════════════════════════════════════════════════════ */}
      {tab === 'downtime' && (
        <div style={S.twoPanel}>
          {/* Log Downtime Form */}
          <div style={S.card}>
            <div style={S.cardTitle}>Log Downtime</div>
            <form onSubmit={handleDowntimeSubmit} style={S.form}>
              <Field label="Machine *">
                <select style={S.input} value={downtimeForm.machine_id} onChange={e => setDowntimeForm(f => ({ ...f, machine_id: e.target.value }))} required>
                  <option value="">— Select —</option>
                  {machines.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </Field>
              <Field label="Shift">
                <select style={S.input} value={downtimeForm.shift_id} onChange={e => setDowntimeForm(f => ({ ...f, shift_id: e.target.value }))}>
                  <option value="">— Optional —</option>
                  {todayShifts.map(s => <option key={s.id} value={s.id}>{s.shiftType || s.shift_type} · {s.machineName}</option>)}
                </select>
              </Field>
              <Field label="Related Reel">
                <select style={S.input} value={downtimeForm.reel_id} onChange={e => setDowntimeForm(f => ({ ...f, reel_id: e.target.value }))}>
                  <option value="">— Optional —</option>
                  {reels.map(r => <option key={r.id} value={r.id}>{r.reelNumber}</option>)}
                </select>
              </Field>
              <Field label="Category *">
                <select style={S.input} value={downtimeForm.category} onChange={e => setDowntimeForm(f => ({ ...f, category: e.target.value }))}>
                  {['Mechanical','Electrical','Process','Quality','Break','Changeover','Utility','Other'].map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </Field>
              <div style={S.twoCol}>
                <Field label="Start Time *">
                  <input style={S.input} type="datetime-local" value={downtimeForm.start_time} onChange={e => setDowntimeForm(f => ({ ...f, start_time: e.target.value }))} required />
                </Field>
                <Field label="End Time">
                  <input style={S.input} type="datetime-local" value={downtimeForm.end_time} onChange={e => setDowntimeForm(f => ({ ...f, end_time: e.target.value }))} />
                </Field>
              </div>
              <Field label="Duration (min) — auto if both times given">
                <input style={S.input} type="number" min="0" value={downtimeForm.duration_min} onChange={e => setDowntimeForm(f => ({ ...f, duration_min: e.target.value }))} />
              </Field>
              {(() => {
                const filtered = reasonCodes.filter(rc => (rc.category || '').toLowerCase() === (downtimeForm.category || '').toLowerCase());
                return filtered.length > 0 ? (
                  <Field label="Reason Code *">
                    <select 
                      style={S.input} 
                      value={downtimeForm.reason_code_id} 
                      onChange={e => {
                        const rcId = e.target.value;
                        const rcObj = reasonCodes.find(x => x.id === parseInt(rcId));
                        setDowntimeForm(f => ({ 
                          ...f, 
                          reason_code_id: rcId, 
                          reason: rcObj ? rcObj.description : '' 
                        }));
                      }}
                      required
                    >
                      <option value="">— Select Reason Code —</option>
                      {filtered.map(rc => (
                        <option key={rc.id} value={rc.id}>{rc.reason_code} — {rc.description}</option>
                      ))}
                    </select>
                  </Field>
                ) : (
                  <Field label="Reason Code (Optional)">
                    <select 
                      style={S.input} 
                      value={downtimeForm.reason_code_id} 
                      onChange={e => {
                        const rcId = e.target.value;
                        const rcObj = reasonCodes.find(x => x.id === parseInt(rcId));
                        setDowntimeForm(f => ({ 
                          ...f, 
                          reason_code_id: rcId, 
                          reason: rcObj ? rcObj.description : '' 
                        }));
                      }}
                    >
                      <option value="">— Optional —</option>
                      {reasonCodes.map(rc => (
                        <option key={rc.id} value={rc.id}>{rc.category} · {rc.reason_code} — {rc.description}</option>
                      ))}
                    </select>
                  </Field>
                );
              })()}
              <Field label="Reason Details / Remarks *">
                <textarea style={{ ...S.input, minHeight: 70 }} value={downtimeForm.reason} onChange={e => setDowntimeForm(f => ({ ...f, reason: e.target.value }))} required />
              </Field>
              <Field label="Corrective Action">
                <textarea style={{ ...S.input, minHeight: 60 }} value={downtimeForm.corrective_action} onChange={e => setDowntimeForm(f => ({ ...f, corrective_action: e.target.value }))} />
              </Field>
              <button style={S.btnPrimary} disabled={busy}>
                {busy ? '⏳ Logging...' : '⚠️ Log Downtime'}
              </button>
            </form>
          </div>

          {/* Downtime List */}
          <div style={S.card}>
            <div style={S.cardTitle}>Downtime Events — {filterDate}</div>
            {loading ? <Spin /> : downtime.length === 0
              ? <Empty text="No downtime events" />
              : (
              <div style={S.tableWrap}>
                <table style={S.table}>
                  <thead>
                    <tr>
                      <Th>Machine</Th><Th>Category</Th><Th>Start</Th>
                      <Th>Duration</Th><Th>Reason Code / Detail</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {downtime.map(d => (
                      <tr key={d.id} style={S.row}>
                        <Td>{d.machineName || '—'}</Td>
                        <Td>
                          <span style={{ ...S.statusBadge, background: '#fff7ed', color: '#c2410c' }}>{d.category}</span>
                        </Td>
                        <Td style={{ fontSize: 11 }}>{d.startTime ? new Date(d.startTime).toLocaleString('en-IN') : '—'}</Td>
                        <Td>{fmt.mins(d.durationMin)}</Td>
                        <Td style={{ maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis' }} title={d.reason}>
                          {d.reasonCode && <strong style={{ color: '#0ea5e9', display: 'block', marginBottom: 2 }}>{d.reasonCode}</strong>}
                          {d.reason || '—'}
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══ OEE TAB ═════════════════════════════════════════════════════════════ */}
      {tab === 'oee' && (
        <div style={S.stackPanel}>
          <div style={S.filterBar}>
            <label style={S.filterLabel}>Date
              <input type="date" style={S.filterInput} value={oeeDate} onChange={e => setOeeDate(e.target.value)} />
            </label>
          </div>

          <div style={S.oeeGrid}>
            {oeeData.map(m => (
              <div key={m.machineId} style={S.oeeCard}>
                <div style={S.oeeTitle}>{m.machineName}</div>
                <div style={S.oeeRow}>
                  <OeeMeter label="Availability" value={m.availability} color="#1b1b1d" />
                  <OeeMeter label="Performance"  value={m.performance}  color="#1b1b1d" />
                  <OeeMeter label="Quality"      value={m.quality}      color="#10b981" />
                </div>
                <div style={{ ...S.oeeBigNum, color: oeeColor(m.oee) }}>
                  OEE: {m.oee}%
                </div>
                <div style={S.oeeStats}>
                  <span>Reels: <strong>{m.reelCount}</strong></span>
                  <span>Production: <strong>{fmt.weight(m.totalKg)}</strong></span>
                  <span>Avg GSM: <strong>{fmt.gsm(m.avgGsm)}</strong></span>
                  <span>Downtime: <strong>{fmt.mins(m.totalDowntimeMin)}</strong></span>
                </div>
              </div>
            ))}
            {oeeData.length === 0 && <Empty text="No production data for this date" />}
          </div>
        </div>
      )}

      {/* ══ SHIFT REPORTS TAB (F3) ══════════════════════════════════════════════ */}
      {tab === 'reports' && (
        <div style={S.twoPanel}>
          <div style={S.card}>
            <div style={S.cardTitle}>Log Daily Shift Log (Machine/Pulp/ETP)</div>
            <form onSubmit={handleReportSubmit} style={S.form}>
              <Field label="Date">
                <input style={S.input} type="date" value={reportForm.date} onChange={e => setReportForm(f => ({ ...f, date: e.target.value }))} required />
              </Field>
              <div style={S.twoCol}>
                <Field label="Shift Type">
                  <select style={S.input} value={reportForm.shift_type} onChange={e => setReportForm(f => ({ ...f, shift_type: e.target.value }))}>
                    <option value="Day">Day</option>
                    <option value="Night">Night</option>
                  </select>
                </Field>
                <Field label="Plant Section Area">
                  <select style={S.input} value={reportForm.section} onChange={e => setReportForm(f => ({ ...f, section: e.target.value }))}>
                    <option value="Machine Room">Machine Room</option>
                    <option value="Pulp Mill">Pulp Mill</option>
                    <option value="ETP">ETP Plant</option>
                  </select>
                </Field>
              </div>
              <div style={S.twoCol}>
                <Field label="Pulp Level (Metric)">
                  <input style={S.input} type="number" placeholder="e.g. 85%" value={reportForm.data.pulp_level} onChange={e => setReportForm(f => ({ ...f, data: { ...f.data, pulp_level: e.target.value } }))} />
                </Field>
                <Field label="Target Machine Speed">
                  <input style={S.input} type="number" placeholder="mpm" value={reportForm.data.machine_speed} onChange={e => setReportForm(f => ({ ...f, data: { ...f.data, machine_speed: e.target.value } }))} />
                </Field>
              </div>
              <Field label="Remarks / Logs Remarks">
                <textarea style={{ ...S.input, minHeight: 80 }} value={reportForm.remarks} onChange={e => setReportForm(f => ({ ...f, remarks: e.target.value }))} />
              </Field>
              <button style={S.btnPrimary} disabled={busy}>Log Shift Report</button>
            </form>
          </div>

          <div style={S.card}>
            <div style={S.cardTitle}>Logged Shift Logs Feed</div>
            <div style={S.tableWrap}>
              <table style={S.table}>
                <thead>
                  <tr>
                    <Th>Date</Th><Th>Shift</Th><Th>Section</Th><Th>Speed</Th><Th>Pulp</Th><Th>Operator</Th>
                  </tr>
                </thead>
                <tbody>
                  {shiftReports.length === 0 && <tr><td colSpan={6} style={S.empty}>No shift reports logged</td></tr>}
                  {shiftReports.map(sr => (
                    <tr key={sr.id} style={S.tr}>
                      <Td>{sr.date?.slice(0, 10)}</Td>
                      <Td><span style={S.shiftBadge}>{sr.shift_type}</span></Td>
                      <Td><strong>{sr.section}</strong></Td>
                      <Td>{sr.data?.machine_speed ? `${sr.data.machine_speed} mpm` : '—'}</Td>
                      <Td>{sr.data?.pulp_level ? `${sr.data.pulp_level}%` : '—'}</Td>
                      <Td>{sr.operatorName}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ══ CHEMICAL CONSUMPTION TAB (F4) ══════════════════════════════════════ */}
      {tab === 'chemicals' && (
        <div style={S.twoPanel}>
          <div style={S.card}>
            <div style={S.cardTitle}>Log Chemical Consumption & Costing</div>
            <form onSubmit={handleChemSubmit} style={S.form}>
              <Field label="Date">
                <input style={S.input} type="date" value={chemForm.date} onChange={e => setChemForm(f => ({ ...f, date: e.target.value }))} required />
              </Field>
              <Field label="Shift Type">
                <select style={S.input} value={chemForm.shift_type} onChange={e => setChemForm(f => ({ ...f, shift_type: e.target.value }))}>
                  <option value="Day">Day</option>
                  <option value="Night">Night</option>
                </select>
              </Field>
              <Field label="Chemical Material *">
                <select style={S.input} value={chemForm.chemical_id} onChange={e => setChemForm(f => ({ ...f, chemical_id: e.target.value }))} required>
                  <option value="">Select chemical...</option>
                  {chemicals.map(c => <option key={c.id} value={c.id}>{c.name} ({c.code})</option>)}
                </select>
              </Field>
              <div style={S.twoCol}>
                <Field label="Qty Consumed *">
                  <input style={S.input} type="number" step="any" value={chemForm.qty_consumed} onChange={e => setChemForm(f => ({ ...f, qty_consumed: e.target.value }))} required />
                </Field>
                <Field label="Unit Cost (₹) *">
                  <input style={S.input} type="number" step="any" value={chemForm.unit_cost} onChange={e => setChemForm(f => ({ ...f, unit_cost: e.target.value }))} required />
                </Field>
              </div>
              <button style={S.btnPrimary} disabled={busy}>Log Chemical Consumption</button>
            </form>
          </div>

          <div style={S.card}>
            <div style={S.cardTitle}>Chemical Cost Analysis Feed</div>
            <div style={S.tableWrap}>
              <table style={S.table}>
                <thead>
                  <tr>
                    <Th>Date</Th><Th>Chemical</Th><Th>Qty</Th><Th>Unit Cost</Th><Th>Total Cost</Th><Th>Logged By</Th>
                  </tr>
                </thead>
                <tbody>
                  {chemicalLogs.length === 0 && <tr><td colSpan={6} style={S.empty}>No logs recorded</td></tr>}
                  {chemicalLogs.map(cl => (
                    <tr key={cl.id} style={S.tr}>
                      <Td>{cl.date?.slice(0, 10)}</Td>
                      <Td><strong>{cl.chemicalName}</strong></Td>
                      <Td>{cl.qty_consumed}</Td>
                      <Td>₹{Number(cl.unit_cost).toFixed(2)}</Td>
                      <Td><strong>₹{Number(cl.total_cost).toFixed(2)}</strong></Td>
                      <Td>{cl.recordedByName}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ══ FURNISH TAB ═════════════════════════════════════════════════════════ */}
      {tab === 'furnish' && (
        <div style={S.twoPanel}>
          <div style={S.card}>
            <div style={S.cardTitle}>Log Furnish Batch</div>
            <form onSubmit={handleFurnishSubmit} style={S.form}>
              <div style={S.twoCol}>
                <Field label="Date *">
                  <input style={S.input} type="date" value={furnishForm.report_date} onChange={e => setFurnishForm(f => ({ ...f, report_date: e.target.value }))} required />
                </Field>
                <Field label="Shift Type *">
                  <select style={S.input} value={furnishForm.shift_type} onChange={e => setFurnishForm(f => ({ ...f, shift_type: e.target.value }))} required>
                    <option value="Day">Day</option>
                    <option value="Night">Night</option>
                  </select>
                </Field>
              </div>

              <div style={S.twoCol}>
                <Field label="Machine (Optional)">
                  <select style={S.input} value={furnishForm.machine_id} onChange={e => setFurnishForm(f => ({ ...f, machine_id: e.target.value }))}>
                    <option value="">— Optional —</option>
                    {machines.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                </Field>
                <Field label="Batch Number (Auto-Gen if empty)">
                  <input style={S.input} type="text" value={furnishForm.batch_number} onChange={e => setFurnishForm(f => ({ ...f, batch_number: e.target.value }))} placeholder="e.g. FURN-01" />
                </Field>
              </div>

              <div style={S.threeCol}>
                <Field label="Local Furnish (kg)">
                  <input style={S.input} type="number" value={furnishForm.local_furnish_kg} onChange={e => setFurnishForm(f => ({ ...f, local_furnish_kg: e.target.value }))} placeholder="0" />
                </Field>
                <Field label="Local Lot Number">
                  <input style={S.input} type="text" value={furnishForm.local_lot} onChange={e => setFurnishForm(f => ({ ...f, local_lot: e.target.value }))} placeholder="Lot#" />
                </Field>
                <Field label="Local Moisture %">
                  <input style={S.input} type="number" step="0.1" value={furnishForm.local_moisture} onChange={e => setFurnishForm(f => ({ ...f, local_moisture: e.target.value }))} placeholder="%" />
                </Field>
              </div>

              <div style={S.threeCol}>
                <Field label="OCC Furnish (kg)">
                  <input style={S.input} type="number" value={furnishForm.occ_furnish_kg} onChange={e => setFurnishForm(f => ({ ...f, occ_furnish_kg: e.target.value }))} placeholder="0" />
                </Field>
                <Field label="OCC Lot Number">
                  <input style={S.input} type="text" value={furnishForm.occ_lot} onChange={e => setFurnishForm(f => ({ ...f, occ_lot: e.target.value }))} placeholder="Lot#" />
                </Field>
                <Field label="OCC Moisture %">
                  <input style={S.input} type="number" step="0.1" value={furnishForm.occ_moisture} onChange={e => setFurnishForm(f => ({ ...f, occ_moisture: e.target.value }))} placeholder="%" />
                </Field>
              </div>

              <Field label="Other Furnish (kg)">
                <input style={S.input} type="number" value={furnishForm.other_furnish_kg} onChange={e => setFurnishForm(f => ({ ...f, other_furnish_kg: e.target.value }))} placeholder="0" />
              </Field>

              <Field label="Remarks">
                <textarea style={{ ...S.input, minHeight: 40 }} value={furnishForm.remarks} onChange={e => setFurnishForm(f => ({ ...f, remarks: e.target.value }))} />
              </Field>

              <button style={S.btnPrimary} disabled={busy}>Save Furnish Batch</button>
            </form>
          </div>

          <div style={S.card}>
            <div style={S.cardTitle}>Furnish Batch Log Feed</div>
            <div style={S.tableWrap}>
              <table style={S.table}>
                <thead>
                  <tr>
                    <Th>Batch #</Th><Th>Shift</Th><Th>Local (kg)</Th><Th>OCC (kg)</Th><Th>Total (kg)</Th><Th>Logged By</Th>
                  </tr>
                </thead>
                <tbody>
                  {furnishLogs.length === 0 && <tr><td colSpan={6} style={S.empty}>No logs recorded</td></tr>}
                  {furnishLogs.map(fl => {
                    const totalKg = Number(fl.local_furnish_kg || 0) + Number(fl.occ_furnish_kg || 0) + Number(fl.other_furnish_kg || 0);
                    return (
                      <tr key={fl.id} style={S.row}>
                        <Td>
                          <strong style={{ color: '#0ea5e9' }}>{fl.batch_number}</strong>
                          {fl.remarks && <div style={{ fontSize: 10, color: '#a0a0a6', marginTop: 2 }}>{fl.remarks}</div>}
                        </Td>
                        <Td>{fl.shift_type || '—'}</Td>
                        <Td>{fl.local_furnish_kg ? `${fl.local_furnish_kg} kg` : '—'}{fl.local_moisture ? ` (${fl.local_moisture}%)` : ''}</Td>
                        <Td>{fl.occ_furnish_kg ? `${fl.occ_furnish_kg} kg` : '—'}{fl.occ_moisture ? ` (${fl.occ_moisture}%)` : ''}</Td>
                        <Td><strong>{totalKg} kg</strong></Td>
                        <Td>{fl.preparedByName || '—'}</Td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
      {/* Printable QR Code Slip Modal */}
      {printReel && (
        <div style={S.overlay}>
          <div style={{ ...S.modal, maxWidth: 420 }}>
            <div style={S.modalHdr}>
              <b>🧻 Finished Reel QR Label</b>
              <button style={S.x} onClick={() => setPrintReel(null)}>✕</button>
            </div>
            
            <style>{`
              @media print {
                body * {
                  visibility: hidden !important;
                }
                #printable-slip, #printable-slip * {
                  visibility: visible !important;
                }
                #printable-slip {
                  position: fixed !important;
                  left: 0 !important;
                  top: 0 !important;
                  width: 4in !important;
                  height: 6in !important;
                  padding: 0.3in !important;
                  margin: 0 !important;
                  background: white !important;
                  color: black !important;
                  font-family: monospace !important;
                  font-size: 13px !important;
                  box-sizing: border-box !important;
                  display: flex !important;
                  flex-direction: column !important;
                  justify-content: space-between !important;
                }
                .no-print {
                  display: none !important;
                }
              }
            `}</style>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center' }}>
              <div id="printable-slip" style={{ border: '1px dashed #d8d6cc', borderRadius: 8, padding: 20, width: '100%', background: '#fff', boxSizing: 'border-box' }}>
                <div style={{ textAlign: 'center', borderBottom: '2px solid #1b1b1d', paddingBottom: 10, marginBottom: 12 }}>
                  <div style={{ fontSize: 16, fontWeight: 900, textTransform: 'uppercase', letterSpacing: 1 }}>MK Paper Mill Ltd.</div>
                  <div style={{ fontSize: 10, color: '#8a8a90' }}>PM Jumbo Reel Identification Slip</div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, color: '#1b1b1d' }}>
                  <div><strong>REEL NO:</strong> <span style={{ fontFamily: 'monospace', fontWeight: 800 }}>{printReel.reelNumber}</span></div>
                  <div><strong>GRADE:</strong> {printReel.gradeName || printReel.gradeCode || '—'}</div>
                  <div><strong>GSM / BF:</strong> {printReel.gsm} GSM {printReel.bf ? `/ ${printReel.bf} BF` : ''}</div>
                  <div><strong>DECKLE:</strong> {printReel.deckle || printReel.width_mm || '—'} mm</div>
                  <div><strong>NET WEIGHT:</strong> <span style={{ fontSize: 15, fontWeight: 850 }}>{printReel.weightKg || '—'} KG</span></div>
                  <div><strong>MOISTURE:</strong> {printReel.moisturePct || '—'}%</div>
                  <div><strong>MACHINE:</strong> {printReel.machineName || 'PM1'}</div>
                  <div><strong>DATE:</strong> {new Date(printReel.start_time).toLocaleDateString()}</div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'center', margin: '14px 0' }}>
                  <img
                    alt="Reel QR Code"
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(
                      JSON.stringify({
                        reelNumber: printReel.reelNumber,
                        gsm: printReel.gsm,
                        bf: printReel.bf,
                        weight: printReel.weightKg,
                        machine: printReel.machineName,
                        date: printReel.start_time
                      })
                    )}`}
                    onError={(e) => {
                      e.target.style.display = 'none';
                      if (e.target.nextSibling) e.target.nextSibling.style.display = 'flex';
                    }}
                    style={{ width: 130, height: 130 }}
                  />
                  <div style={{ display: 'none', width: 130, height: 130, border: '2px dashed #333', borderRadius: 8, flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, padding: 8, textAlign: 'center' }}>
                    <div>[{printReel.reelNumber || 'REEL QR'}]</div>
                    <div style={{ fontSize: 9, color: '#666', marginTop: 4 }}>Offline Mode</div>
                  </div>
                </div>

                <div style={{ borderTop: '1px dashed #d8d6cc', paddingTop: 8, fontSize: 9, color: '#8a8a90', textAlign: 'center' }}>
                  Scan code to verify reel specs in MKPM Inventory system.
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', width: '100%', marginTop: 8 }} className="no-print">
                <button type="button" style={S.btnSecondary} onClick={() => setPrintReel(null)}>Close</button>
                <button type="button" style={S.btnPrimary} onClick={() => window.print()}>🖨️ Print Label</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Sub-components ────────────────────────────────────────────────────────────
function Field({ label, children }) {
  return (
    <label style={S.label}>
      <span style={S.labelText}>{label}</span>
      {children}
    </label>
  )
}
function Th({ children }) {
  return <th style={S.th}>{children}</th>
}
function Td({ children, style = {} }) {
  return <td style={{ ...S.td, ...style }}>{children}</td>
}
function Spin() {
  return <div style={S.empty}>Loading…</div>
}
function Empty({ text }) {
  return <div style={S.empty}>{text}</div>
}

function OeeMeter({ label, value, color }) {
  const v = Math.min(100, Math.max(0, Number(value) || 0))
  return (
    <div style={S.meter}>
      <div style={S.meterLabel}>{label}</div>
      <div style={S.meterBar}>
        <div style={{ ...S.meterFill, width: `${v}%`, background: color }} />
      </div>
      <div style={{ ...S.meterVal, color }}>{v.toFixed(1)}%</div>
      {/* Shift Close Confirm Modal */}
      <ConfirmModal
        open={!!closeShiftTarget}
        onClose={() => setCloseShiftTarget(null)}
        onConfirm={confirmCloseShift}
        title={`Close Shift — ${closeShiftTarget?.shift_type || ''}`}
        message={`Are you sure you want to close this ${closeShiftTarget?.shift_type || ''} shift for ${closeShiftTarget?.machineName || 'machine'}? Total reels recorded: ${closeShiftTarget?.reelCount ?? 0}, Total weight: ${fmt.weight(closeShiftTarget?.totalKg)}.`}
        confirmLabel="Close Shift"
        danger
        loading={actionLoading}
      />
    </div>
  )
}

function oeeColor(v) {
  const n = Number(v) || 0
  if (n >= 85) return '#10b981'
  if (n >= 65) return '#f59e0b'
  return '#ef4444'
}

// ─── Styles ────────────────────────────────────────────────────────────────────
const S = {
  page:      { padding: '24px 28px', background: '#f6f5f0', minHeight: '100vh', fontFamily: 'Inter, system-ui, sans-serif' },
  header:    { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  title:     { fontSize: 26, fontWeight: 800, color: '#1b1b1d' },
  sub:       { fontSize: 13, color: '#8a8a90', marginTop: 4 },
  badge:     { background: '#1b1b1d', color: '#fff', borderRadius: 999, padding: '5px 14px', fontSize: 12, fontWeight: 700, alignSelf: 'center' },

  toast:     { borderRadius: 10, padding: '10px 16px', marginBottom: 16, fontSize: 13, fontWeight: 600 },

  tabs:      { display: 'flex', gap: 4, marginBottom: 16, borderBottom: '2px solid #ecebe5', paddingBottom: 0 },
  tab:       { padding: '9px 18px', border: 'none', borderRadius: '8px 8px 0 0', cursor: 'pointer', fontSize: 13, fontWeight: 600, background: 'transparent', color: '#8a8a90', transition: 'all .15s' },
  tabActive: { background: '#1b1b1d', color: '#fff' },

  filterBar:   { display: 'flex', gap: 16, marginBottom: 16, alignItems: 'flex-end', flexWrap: 'wrap' },
  filterLabel: { display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, fontWeight: 600, color: '#3a3a3e' },
  filterInput: { background: '#fff', border: '1px solid #d8d6cc', borderRadius: 8, padding: '7px 10px', fontSize: 13, color: '#1b1b1d' },

  twoPanel:  { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 16 },
  stackPanel:{ display: 'flex', flexDirection: 'column', gap: 16 },

  card:      { background: '#fff', border: '1px solid #ecebe5', borderRadius: 16, padding: 20, boxShadow: '0 2px 8px rgba(15,23,42,0.06)' },
  cardTitle: { fontSize: 16, fontWeight: 700, color: '#1b1b1d', marginBottom: 16 },

  form:      { display: 'flex', flexDirection: 'column', gap: 12 },
  label:     { display: 'flex', flexDirection: 'column', gap: 4 },
  labelText: { fontSize: 12, fontWeight: 600, color: '#3a3a3e' },
  input:     { background: '#f6f5f0', border: '1px solid #d8d6cc', borderRadius: 8, padding: '9px 12px', color: '#1b1b1d', fontSize: 13, outline: 'none', transition: 'border-color .15s' },
  twoCol:    { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },
  threeCol:  { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 },

  btnPrimary:  { background: '#1b1b1d', color: '#fff', border: 'none', borderRadius: 10, padding: '11px 16px', fontWeight: 700, cursor: 'pointer', fontSize: 14, letterSpacing: 0.3 },
  btnSecondary:{ background: '#d8d6cc', color: '#3a3a3e', border: 'none', borderRadius: 10, padding: '11px 16px', fontWeight: 700, cursor: 'pointer', fontSize: 14 },
  btnSm:       { background: '#1b1b1d', color: '#fff', border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer' },

  effPreview:  { background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '8px 12px', fontSize: 13, color: '#1b1b1d' },

  tableWrap: { overflowX: 'auto' },
  table:     { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  th:        { textAlign: 'left', padding: '10px 12px', borderBottom: '2px solid #ecebe5', color: '#8a8a90', fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 },
  td:        { padding: '10px 12px', borderBottom: '1px solid #f6f5f0', color: '#3a3a3e', verticalAlign: 'middle' },
  tr:        { borderBottom: '1px solid #f6f5f0' },
  row:       { transition: 'background .1s' },

  shiftBadge:  { background: '#dbeafe', color: '#1b1b1d', padding: '2px 8px', borderRadius: 6, fontWeight: 700, fontSize: 12 },
  statusBadge: { padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700 },
  statusSelect:{ border: '1px solid #d8d6cc', borderRadius: 6, padding: '3px 6px', fontSize: 11, cursor: 'pointer' },
  reelNum:     { fontFamily: 'monospace', fontWeight: 700, fontSize: 12, color: '#1b1b1d' },

  empty: { padding: 32, color: '#a0a0a6', textAlign: 'center', fontSize: 14 },

  // OEE
  oeeGrid:   { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 },
  oeeCard:   { background: '#fff', border: '1px solid #ecebe5', borderRadius: 16, padding: 20, boxShadow: '0 2px 8px rgba(15,23,42,0.06)' },
  oeeTitle:  { fontSize: 16, fontWeight: 800, color: '#1b1b1d', marginBottom: 16 },
  oeeRow:    { display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 },
  oeeBigNum: { fontSize: 28, fontWeight: 900, textAlign: 'center', marginBottom: 12 },
  oeeStats:  { display: 'flex', flexWrap: 'wrap', gap: 12, fontSize: 12, color: '#8a8a90' },

  meter:     { display: 'flex', alignItems: 'center', gap: 10 },
  meterLabel:{ width: 90, fontSize: 12, color: '#8a8a90', fontWeight: 600 },
  meterBar:  { flex: 1, height: 10, background: '#f6f5f0', borderRadius: 99, overflow: 'hidden' },
  meterFill: { height: '100%', borderRadius: 99, transition: 'width .4s ease' },
  meterVal:  { width: 48, textAlign: 'right', fontWeight: 700, fontSize: 13 },
  overlay:   { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modal:     { background: '#ffffff', borderRadius: 12, padding: 24, width: '100%', border: '1px solid #e7e6df', maxHeight: '90vh', overflowY: 'auto' },
  modalHdr:  { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  x:         { background: 'none', border: 'none', color: '#a0a0a6', fontSize: 18, cursor: 'pointer' },
}
