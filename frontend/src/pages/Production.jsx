import React, { useCallback, useEffect, useMemo, useState } from 'react'
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
  weight:   (kg)  => kg != null ? `${Number(kg).toLocaleString('en-IN', { minimumFractionDigits: 2 })} KG` : '—',
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

const CUT_COLORS = ['#4f46e5', '#059669', '#7c3aed', '#0284c7', '#d97706', '#e11d48', '#0d9488', '#475569']

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

// ─── PPC & Slitting Initial States ────────────────────────────────────────────
const initPpcForm = () => ({
  machine_id: '',
  target_date: new Date().toISOString().split('T')[0],
  grade_id: '',
  target_gsm: '120',
  target_bf: '18',
  usable_deckle_mm: '2650',
  planned_tonnage_mt: '25.0',
  patterns: [
    {
      pattern_number: 1,
      sets_planned: 1,
      cuts: [
        { cut_position: 1, width_mm: 900, sales_order_id: '', remarks: 'Customer Reel A' },
        { cut_position: 2, width_mm: 900, sales_order_id: '', remarks: 'Customer Reel B' },
        { cut_position: 3, width_mm: 800, sales_order_id: '', remarks: 'Customer Reel C' },
      ]
    }
  ]
})

const initJumboForm = () => ({
  machine_id: '',
  shift_id: '',
  grade_id: '',
  gsm_actual: '120',
  bf_actual: '18',
  deckle_width_mm: '2650',
  gross_weight_kg: '4850',
  core_tare_weight_kg: '120',
  speed_mpm: '380',
  moisture_pct: '7.5'
})

const initSlitForm = () => ({
  jumbo_reel_id: '',
  pattern_id: '',
  cut_position: 1,
  sales_order_id: '',
  width_mm: '900',
  diameter_cm: '110',
  planned_weight_kg: '',
  actual_weight_kg: '',
})

const initWasteForm = () => ({
  jumbo_reel_id: '',
  edge_trim_kg: '45',
  rewinder_broke_kg: '15',
  core_waste_kg: '10'
})

// ─── Main Component ────────────────────────────────────────────────────────────
export default function Production() {
  const [tab, setTab] = useState('ppc')

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

  // ── PPC & Slitting Data ────────────────────────────────────────────────────
  const [ppcPlans, setPpcPlans]             = useState([])
  const [pendingOrders, setPendingOrders]   = useState([])
  const [jumboReels, setJumboReels]         = useState([])
  const [activePatterns, setActivePatterns] = useState([])
  const [selectedJumboId, setSelectedJumboId] = useState(null)
  const [slitReels, setSlitReels]           = useState([])

  // Filters
  const todayStr = new Date().toISOString().split('T')[0]
  const [filterDate, setFilterDate] = useState(todayStr)
  const [filterMachine, setFilterMachine] = useState('')
  const [oeeDate, setOeeDate] = useState(todayStr)

  // Forms
  const [shiftForm, setShiftForm]       = useState(initShift)
  const [reelForm, setReelForm]         = useState(initReel)
  const [downtimeForm, setDowntimeForm] = useState(initDowntime)
  const [reportForm, setReportForm]     = useState(initShiftReport)
  const [chemForm, setChemForm]         = useState(initChemical)
  const [furnishForm, setFurnishForm]   = useState(initFurnish)

  // PPC & Slitting Forms
  const [ppcForm, setPpcForm]           = useState(initPpcForm)
  const [jumboForm, setJumboForm]       = useState(initJumboForm)
  const [slitForm, setSlitForm]         = useState(initSlitForm)
  const [wasteForm, setWasteForm]       = useState(initWasteForm)

  // Modals & Overlays
  const [printReel, setPrintReel]             = useState(null)
  const [printSlitReel, setPrintSlitReel]     = useState(null)
  const [overrideTarget, setOverrideTarget]   = useState(null)
  const [overrideReason, setOverrideReason]   = useState('')
  const [showGradeCalc, setShowGradeCalc]     = useState(false)
  const [calcMt, setCalcMt]                   = useState('25')
  const [calcWidthMm, setCalcWidthMm]         = useState('900')
  const [calcGsm, setCalcGsm]                 = useState('120')
  const [calcDiaCm, setCalcDiaCm]             = useState('110')

  // UI state
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState({ text: '', ok: true })
  const [busy, setBusy] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [closeShiftTarget, setCloseShiftTarget] = useState(null)

  const toast = (text, ok = true) => {
    setMsg({ text, ok })
    setTimeout(() => setMsg({ text: '', ok: true }), 6000)
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

  // ── PPC & Slitting Loaders ─────────────────────────────────────────────────
  const loadPpcPlans = useCallback(async (date, mid) => {
    const q = new URLSearchParams()
    if (date) q.set('date', date)
    if (mid)  q.set('machine_id', mid)
    const r = await API(`/api/production/ppc/plans?${q}`).catch(() => ({ data: [] }))
    setPpcPlans(r.data || [])
  }, [])

  const loadPendingOrders = useCallback(async () => {
    const r = await API('/api/production/ppc/orders-pending').catch(() => ({ data: [] }))
    setPendingOrders(r.data || [])
  }, [])

  const loadJumboReels = useCallback(async (date, mid) => {
    const q = new URLSearchParams()
    if (date) q.set('date', date)
    if (mid)  q.set('machine_id', mid)
    const r = await API(`/api/production/jumbo-reels?${q}`).catch(() => ({ data: [] }))
    setJumboReels(r.data || [])
    if (r.data && r.data.length > 0 && !selectedJumboId) {
      setSelectedJumboId(r.data[0].id)
    }
  }, [selectedJumboId])

  const loadActivePatterns = useCallback(async () => {
    const r = await API('/api/production/slitting/patterns-active').catch(() => ({ data: [] }))
    setActivePatterns(r.data || [])
  }, [])

  const loadSlitReels = useCallback(async (jumboId) => {
    if (!jumboId) { setSlitReels([]); return }
    const r = await API(`/api/production/slitting/slit-reels?jumbo_reel_id=${jumboId}`).catch(() => ({ data: [] }))
    setSlitReels(r.data || [])
  }, [])

  // Initial load
  useEffect(() => {
    setLoading(true)
    Promise.all([
      loadMaster(),
      loadPpcPlans(filterDate, filterMachine),
      loadPendingOrders(),
      loadJumboReels(filterDate, filterMachine),
      loadActivePatterns(),
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
    if (tab === 'ppc') {
      loadPpcPlans(filterDate, filterMachine)
      loadPendingOrders()
    } else if (tab === 'slitting') {
      loadJumboReels(filterDate, filterMachine)
      loadActivePatterns()
      loadPendingOrders()
    } else if (tab === 'shifts') {
      loadShifts(filterDate, filterMachine)
    } else if (tab === 'reels') {
      loadReels(filterDate, filterMachine)
    } else if (tab === 'downtime') {
      loadDowntime(filterDate, filterMachine)
    } else if (tab === 'reports') {
      loadShiftReports(filterDate)
    } else if (tab === 'chemicals') {
      loadChemicalsLog(filterDate)
    } else if (tab === 'furnish') {
      loadFurnish(filterDate, filterMachine)
    }
  }, [filterDate, filterMachine, tab]) // eslint-disable-line

  useEffect(() => {
    if (selectedJumboId) {
      loadSlitReels(selectedJumboId)
      setSlitForm(f => ({ ...f, jumbo_reel_id: selectedJumboId }))
      setWasteForm(f => ({ ...f, jumbo_reel_id: selectedJumboId }))
    }
  }, [selectedJumboId, loadSlitReels])

  useEffect(() => { loadOee(oeeDate) }, [oeeDate]) // eslint-disable-line

  // ── Selected Jumbo Reel object ─────────────────────────────────────────────
  const currentJumbo = useMemo(() => {
    return jumboReels.find(j => j.id === selectedJumboId) || jumboReels[0] || null
  }, [jumboReels, selectedJumboId])

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

  // ── Pattern Deckle Calculations (Live Preview) ─────────────────────────────
  const currentPattern = ppcForm.patterns[0] || { cuts: [] }
  const totalPatternCutWidth = useMemo(() => {
    return (currentPattern.cuts || []).reduce((sum, c) => sum + (parseFloat(c.width_mm) || 0), 0)
  }, [currentPattern.cuts])

  const usableDeckleNum = parseFloat(ppcForm.usable_deckle_mm) || 2650
  const plannedTrimMm = Math.max(0, usableDeckleNum - totalPatternCutWidth)
  const trimPercentage = usableDeckleNum > 0 ? (plannedTrimMm / usableDeckleNum) * 100 : 0

  // ── Grade Conversion Calculator Live Preview ───────────────────────────────
  const calculatedReelsNeeded = useMemo(() => {
    const mt = parseFloat(calcMt) || 0
    const wMm = parseFloat(calcWidthMm) || 0
    const g = parseFloat(calcGsm) || 0
    const dCm = parseFloat(calcDiaCm) || 0
    if (mt <= 0 || wMm <= 0 || g <= 0 || dCm <= 0) return 0
    // Standard paper reel density rho approx 0.65 g/cm3; single reel approx weight:
    const radiusM = (dCm / 100) / 2
    const coreRadiusM = 0.076 / 2
    const volumeM3 = Math.PI * (radiusM * radiusM - coreRadiusM * coreRadiusM) * (wMm / 1000)
    const reelWeightKg = volumeM3 * 650 // approx 650 kg/m3 density for fluting/kraft
    const totalKg = mt * 1000
    return reelWeightKg > 0 ? Math.ceil(totalKg / reelWeightKg) : 0
  }, [calcMt, calcWidthMm, calcGsm, calcDiaCm])

  // ── Live Mass Balance Computation for Active Slitter ────────────────────────
  const massBalanceStats = useMemo(() => {
    if (!currentJumbo) return { netJumbo: 0, totalOutput: 0, varianceKg: 0, variancePct: 0, isBalanced: false }
    const netJumbo = parseFloat(currentJumbo.netWeightKg) || 0
    const slitTotal = slitReels.reduce((sum, sr) => sum + (parseFloat(sr.actualWeightKg) || 0), 0)
    const trim = parseFloat(wasteForm.edge_trim_kg) || 0
    const broke = parseFloat(wasteForm.rewinder_broke_kg) || 0
    const core = parseFloat(wasteForm.core_waste_kg) || 0
    const totalOutput = slitTotal + trim + broke + core
    const varianceKg = netJumbo - totalOutput
    const variancePct = netJumbo > 0 ? (Math.abs(varianceKg) / netJumbo) * 100 : 0
    const isBalanced = variancePct <= 0.5
    return { netJumbo, slitTotal, trim, broke, core, totalOutput, varianceKg, variancePct, isBalanced }
  }, [currentJumbo, slitReels, wasteForm])

  // ── Live Yield Variance for Slit Reel entry ────────────────────────────────
  const liveYieldVariance = useMemo(() => {
    const act = parseFloat(slitForm.actual_weight_kg) || 0
    let plan = parseFloat(slitForm.planned_weight_kg)
    if (!plan && currentJumbo && currentJumbo.netWeightKg && currentJumbo.deckleWidthMm) {
      plan = (parseFloat(slitForm.width_mm || 0) / parseFloat(currentJumbo.deckleWidthMm)) * parseFloat(currentJumbo.netWeightKg)
    }
    if (!act || !plan) return null
    const diff = act - plan
    const diffPct = (diff / plan) * 100
    return { plan, act, diff, diffPct }
  }, [slitForm.actual_weight_kg, slitForm.planned_weight_kg, slitForm.width_mm, currentJumbo])

  // ── Handlers: Shifts, Reels, Downtime ──────────────────────────────────────
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

  // ── PPC Plan Actions ───────────────────────────────────────────────────────
  const handleAddCut = () => {
    setPpcForm(f => {
      const p = f.patterns[0]
      const nextPos = (p.cuts?.length || 0) + 1
      return {
        ...f,
        patterns: [{
          ...p,
          cuts: [...(p.cuts || []), { cut_position: nextPos, width_mm: 800, sales_order_id: '', remarks: `Cut #${nextPos}` }]
        }]
      }
    })
  }

  const handleRemoveCut = (index) => {
    setPpcForm(f => {
      const p = f.patterns[0]
      const nextCuts = p.cuts.filter((_, i) => i !== index).map((c, i) => ({ ...c, cut_position: i + 1 }))
      return {
        ...f,
        patterns: [{ ...p, cuts: nextCuts }]
      }
    })
  }

  const handleCutChange = (index, field, value) => {
    setPpcForm(f => {
      const p = f.patterns[0]
      const nextCuts = [...p.cuts]
      nextCuts[index] = { ...nextCuts[index], [field]: value }
      // Auto-fill width from Sales Order if selected
      if (field === 'sales_order_id' && value) {
        const so = pendingOrders.find(o => String(o.id) === String(value))
        if (so && so.widthMm) {
          nextCuts[index].width_mm = so.widthMm
          nextCuts[index].remarks = `${so.customerName} (${so.soNumber})`
        }
      }
      return {
        ...f,
        patterns: [{ ...p, cuts: nextCuts }]
      }
    })
  }

  const handleAddOrderToPlan = (so) => {
    setPpcForm(f => {
      const p = f.patterns[0]
      const nextPos = (p.cuts?.length || 0) + 1
      return {
        ...f,
        grade_id: so.gradeId || f.grade_id,
        target_gsm: so.gsm ? String(so.gsm) : f.target_gsm,
        patterns: [{
          ...p,
          cuts: [
            ...(p.cuts || []),
            {
              cut_position: nextPos,
              width_mm: so.widthMm || 900,
              sales_order_id: so.id,
              remarks: `${so.customerName} (${so.soNumber})`
            }
          ]
        }]
      }
    })
    toast(`Added SO ${so.soNumber} (${so.customerName}) as Knife Cut ✓`)
  }

  const handleAutoSuggestCuts = async () => {
    if (!ppcForm.usable_deckle_mm) {
      toast('Please enter Usable Deckle first', false)
      return
    }
    setBusy(true)
    try {
      const q = new URLSearchParams({
        usable_deckle_mm: ppcForm.usable_deckle_mm,
      })
      if (ppcForm.grade_id) q.set('grade_id', ppcForm.grade_id)
      if (ppcForm.target_gsm) q.set('gsm', ppcForm.target_gsm)
      const res = await API(`/api/production/ppc/deckle-optimizer?${q}`)
      if (res.success && res.data.suggestedCuts?.length > 0) {
        setPpcForm(f => {
          const p = f.patterns[0]
          return {
            ...f,
            patterns: [{
              ...p,
              cuts: res.data.suggestedCuts.map((c, i) => ({
                cut_position: i + 1,
                width_mm: c.widthMm,
                sales_order_id: c.salesOrderId,
                remarks: c.remarks || `SO: ${c.soNumber}`
              }))
            }]
          }
        })
        toast(`✨ Deckle Optimized: ${res.data.suggestedCuts.length} cuts matched (${res.data.trimMm}mm / ${res.data.trimPct}% trim) ✓`)
      } else {
        toast('No matching pending sales orders found for this deckle/grade/GSM', false)
      }
    } catch (err) {
      toast(err.message, false)
    } finally {
      setBusy(false)
    }
  }

  const printProductionOrderReport = async (planId) => {
    try {
      const res = await API(`/api/production/reports/production-order`)
      const plan = res.data?.find(p => p.planId === planId) || res.data?.[0]
      if (!plan) { toast('Plan not found', false); return }
      const w = window.open('', '_blank', 'width=900,height=700')
      const patternsHtml = (plan.patterns || []).map(p => `
        <div style="margin-bottom:16px;border:1px solid #ccc;padding:12px;border-radius:6px">
          <h4>Pattern #${p.patternNumber} — Planned Sets: ${p.setsPlanned} | Trim: ${p.plannedTrimMm}mm (${p.trimPercentage}%)</h4>
          <table style="width:100%;border-collapse:collapse;margin-top:8px">
            <thead><tr style="background:#eee">
              <th style="border:1px solid #ccc;padding:6px">Cut #</th>
              <th style="border:1px solid #ccc;padding:6px">Width (mm)</th>
              <th style="border:1px solid #ccc;padding:6px">SO Number</th>
              <th style="border:1px solid #ccc;padding:6px">Customer</th>
              <th style="border:1px solid #ccc;padding:6px">SO Balance MT</th>
              <th style="border:1px solid #ccc;padding:6px">Remarks</th>
            </tr></thead>
            <tbody>
              ${(p.cuts || []).map(c => `
                <tr>
                  <td style="border:1px solid #ccc;padding:6px;text-align:center">K#${c.cutPosition}</td>
                  <td style="border:1px solid #ccc;padding:6px;text-align:center"><b>${c.widthMm} mm</b></td>
                  <td style="border:1px solid #ccc;padding:6px">${c.soNumber || 'Stock'}</td>
                  <td style="border:1px solid #ccc;padding:6px">${c.customerName || '—'}</td>
                  <td style="border:1px solid #ccc;padding:6px;text-align:right">${c.balanceMt != null ? parseFloat(c.balanceMt).toFixed(3) + ' MT' : '—'}</td>
                  <td style="border:1px solid #ccc;padding:6px">${c.remarks || '—'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `).join('')

      w.document.write(`<!DOCTYPE html><html><head><title>Production Order Report — ${plan.planNumber}</title>
      <style>body{font-family:Arial,sans-serif;padding:24px;color:#1a1a1a;font-size:13px}h2{margin:0 0 4px}h4{margin:0 0 6px}
      .head-box{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin:16px 0;padding:12px;background:#f9f9f9;border:1px solid #ddd;border-radius:6px}
      @media print{button{display:none}}</style></head>
      <body>
        <button onclick="window.print()" style="padding:6px 16px;margin-bottom:16px;cursor:pointer">🖨️ Print Production Order</button>
        <h2>MK PAPER MILL — PRODUCTION ORDER REPORT</h2>
        <div style="font-size:14px;color:#555;font-family:monospace"><b>${plan.planNumber}</b> · Target Date: ${plan.targetDate ? new Date(plan.targetDate).toLocaleDateString() : '—'}</div>
        <div class="head-box">
          <div><b>Machine:</b> ${plan.machineName || '—'}</div>
          <div><b>Grade:</b> ${plan.gradeName || '—'} (${plan.gradeCode || '—'})</div>
          <div><b>Target GSM:</b> ${plan.targetGsm} GSM</div>
          <div><b>Target BF:</b> ${plan.targetBf || '—'}</div>
          <div><b>Usable Deckle:</b> ${plan.usableDeckleMm} mm</div>
          <div><b>Planned Tonnage:</b> ${plan.plannedTonnageMt} MT</div>
          <div><b>Status:</b> ${plan.status}</div>
          <div><b>Created By:</b> ${plan.createdBy || 'System'}</div>
          <div><b>Generated At:</b> ${new Date().toLocaleString('en-IN')}</div>
        </div>
        <h3>Slitting Patterns & Knife Configurations</h3>
        ${patternsHtml}
      </body></html>`)
      w.document.close()
    } catch (e) {
      toast(e.message, false)
    }
  }

  const printRewinderCuttingOrder = async (jumboId) => {
    try {
      const res = await API(`/api/production/reports/rewinder-cutting-order/${jumboId}`)
      if (!res.success) { toast('Could not fetch rewinder cutting order', false); return }
      const { jumbo, cuts, trimMm, trimPct, totalCutMm } = res.data
      const w = window.open('', '_blank', 'width=900,height=650')
      const cutsRows = (cuts || []).map(c => `
        <tr>
          <td style="border:1px solid #ccc;padding:8px;text-align:center;font-weight:bold">K#${c.cutPosition}</td>
          <td style="border:1px solid #ccc;padding:8px;text-align:center;font-size:15px"><b>${c.widthMm} mm</b></td>
          <td style="border:1px solid #ccc;padding:8px">${c.soNumber || 'Direct / Stock'}</td>
          <td style="border:1px solid #ccc;padding:8px">${c.customerName || '—'}</td>
          <td style="border:1px solid #ccc;padding:8px;text-align:right"><b>${c.plannedWeightKg ? c.plannedWeightKg + ' KG' : '—'}</b></td>
          <td style="border:1px solid #ccc;padding:8px">${c.balanceMt != null ? parseFloat(c.balanceMt).toFixed(3) + ' MT' : '—'}</td>
          <td style="border:1px solid #ccc;padding:8px;border-left:2px solid #333;width:100px"></td>
        </tr>
      `).join('')

      w.document.write(`<!DOCTYPE html><html><head><title>Rewinder Cutting Order — ${jumbo.jumboNumber}</title>
      <style>body{font-family:Arial,sans-serif;padding:24px;color:#1a1a1a;font-size:13px}h2{margin:0 0 4px}
      .jumbo-box{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:12px 0;padding:12px;background:#f0f7ff;border:2px solid #0284c7;border-radius:6px}
      table{width:100%;border-collapse:collapse;margin-top:16px}th{background:#f0f0f0;font-weight:700;border:1px solid #ccc;padding:8px}
      .notes{margin-top:20px;padding:12px;border:1px dashed #999;border-radius:4px;font-size:12px;color:#555}
      @media print{button{display:none}}</style></head>
      <body>
        <button onclick="window.print()" style="padding:6px 16px;margin-bottom:12px;cursor:pointer">🖨️ Print Rewinder Instruction Sheet</button>
        <h2>MK PAPER MILL — REWINDER CUTTING ORDER</h2>
        <div style="font-size:13px;color:#666">Instruction Sheet for Rewinder Operator</div>
        <div class="jumbo-box">
          <div><b>Mother Jumbo Roll:</b> <span style="font-family:monospace;font-size:15px;font-weight:bold">${jumbo.jumboNumber}</span></div>
          <div><b>Machine:</b> ${jumbo.machineName || '—'}</div>
          <div><b>Grade:</b> ${jumbo.gradeName || '—'} (${jumbo.gradeCode || '—'})</div>
          <div><b>Actual GSM:</b> ${jumbo.gsmActual} GSM</div>
          <div><b>Actual BF:</b> ${jumbo.bfActual || '—'}</div>
          <div><b>Deckle Width:</b> ${jumbo.deckleWidthMm} mm</div>
          <div><b>Net Weight:</b> ${jumbo.netWeightKg} KG</div>
          <div><b>Shift Date:</b> ${jumbo.shiftDate || '—'} (${jumbo.shiftType || '—'})</div>
          <div><b>Printed At:</b> ${new Date().toLocaleString('en-IN')}</div>
        </div>
        <div style="margin:8px 0;font-size:13px"><b>Total Cut Width:</b> ${totalCutMm} mm | <b>Edge Trim:</b> ${trimMm} mm (${trimPct}%)</div>
        <table>
          <thead><tr>
            <th>Knife #</th><th>Cut Width (mm)</th><th>Sales Order #</th><th>Customer / Party</th>
            <th>Planned Wt</th><th>SO Balance</th><th style="background:#e0e7ff">Actual Wt Scale (Operator)</th>
          </tr></thead>
          <tbody>${cutsRows || '<tr><td colspan="7" style="padding:16px;text-align:center">No active slitting pattern cuts configured</td></tr>'}</tbody>
        </table>
        <div class="notes">
          <b>Operator Instructions:</b> 1. Set slitter knives to specified widths. 2. Verify edge trim &ge; 40mm on each side. 3. Log scale weight for each child reel in the MES terminal. 4. Collect edge trim and broke into broke pulper.
        </div>
      </body></html>`)
      w.document.close()
    } catch (e) {
      toast(e.message, false)
    }
  }

  const handlePpcPlanSubmit = async (e) => {
    e.preventDefault()
    if (totalPatternCutWidth > usableDeckleNum) {
      toast(`Total knife cuts (${totalPatternCutWidth}mm) exceed usable deckle (${usableDeckleNum}mm)`, false)
      return
    }
    setBusy(true)
    try {
      const payload = {
        machine_id: ppcForm.machine_id,
        target_date: ppcForm.target_date,
        grade_id: ppcForm.grade_id,
        target_gsm: Number(ppcForm.target_gsm),
        target_bf: Number(ppcForm.target_bf) || 0,
        usable_deckle_mm: Number(ppcForm.usable_deckle_mm),
        planned_tonnage_mt: Number(ppcForm.planned_tonnage_mt),
        patterns: ppcForm.patterns.map(p => ({
          pattern_number: p.pattern_number || 1,
          sets_planned: Number(p.sets_planned) || 1,
          cuts: p.cuts.map(c => ({
            cut_position: Number(c.cut_position),
            width_mm: Number(c.width_mm),
            sales_order_id: c.sales_order_id ? Number(c.sales_order_id) : null,
            remarks: c.remarks || null
          }))
        }))
      }
      const res = await API('/api/production/ppc/plans', { method: 'POST', body: JSON.stringify(payload) })
      toast(`PPC Master Plan ${res.data.plan_number} scheduled successfully ✓`)
      loadPpcPlans(filterDate, filterMachine)
      loadActivePatterns()
    } catch (err) { toast(err.message, false) } finally { setBusy(false) }
  }

  const handlePlanStatusChange = async (planId, newStatus) => {
    setBusy(true)
    try {
      await API(`/api/production/ppc/plans/${planId}/status`, { method: 'PUT', body: JSON.stringify({ status: newStatus }) })
      toast(`Plan status updated to ${newStatus} ✓`)
      loadPpcPlans(filterDate, filterMachine)
    } catch (err) { toast(err.message, false) } finally { setBusy(false) }
  }

  // ── Slitting Actions ───────────────────────────────────────────────────────
  const handleJumboSubmit = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      const payload = {
        machine_id: Number(jumboForm.machine_id),
        shift_id: jumboForm.shift_id ? Number(jumboForm.shift_id) : null,
        grade_id: Number(jumboForm.grade_id),
        gsm_actual: Number(jumboForm.gsm_actual),
        bf_actual: Number(jumboForm.bf_actual) || 0,
        deckle_width_mm: Number(jumboForm.deckle_width_mm),
        gross_weight_kg: Number(jumboForm.gross_weight_kg),
        core_tare_weight_kg: Number(jumboForm.core_tare_weight_kg) || 0,
        speed_mpm: jumboForm.speed_mpm ? Number(jumboForm.speed_mpm) : null,
        moisture_pct: jumboForm.moisture_pct ? Number(jumboForm.moisture_pct) : null
      }
      const res = await API('/api/production/jumbo-reels', { method: 'POST', body: JSON.stringify(payload) })
      toast(`Mother Jumbo Roll ${res.data.jumbo_number} created ✓`)
      loadJumboReels(filterDate, filterMachine)
      setSelectedJumboId(res.data.id)
    } catch (err) { toast(err.message, false) } finally { setBusy(false) }
  }

  const handleSlitReelSubmit = async (e) => {
    e.preventDefault()
    if (!selectedJumboId) {
      toast('Please select a mother jumbo roll first', false)
      return
    }
    setBusy(true)
    try {
      const payload = {
        jumbo_reel_id: selectedJumboId,
        pattern_id: slitForm.pattern_id ? Number(slitForm.pattern_id) : null,
        cut_position: Number(slitForm.cut_position),
        sales_order_id: slitForm.sales_order_id ? Number(slitForm.sales_order_id) : null,
        width_mm: Number(slitForm.width_mm),
        diameter_cm: Number(slitForm.diameter_cm) || null,
        planned_weight_kg: slitForm.planned_weight_kg ? Number(slitForm.planned_weight_kg) : null,
        actual_weight_kg: Number(slitForm.actual_weight_kg)
      }
      const res = await API('/api/production/slitting/slit-reels', { method: 'POST', body: JSON.stringify(payload) })
      toast(`Child Slit Reel ${res.data.reel_number} weighed and scale approved ✓`)
      loadSlitReels(selectedJumboId)
      loadJumboReels(filterDate, filterMachine)
      loadPendingOrders()
      setSlitForm(f => ({
        ...f,
        cut_position: Number(f.cut_position) + 1,
        actual_weight_kg: '',
        planned_weight_kg: ''
      }))
    } catch (err) { toast(err.message, false) } finally { setBusy(false) }
  }

  const handleWasteSubmit = async (e) => {
    e.preventDefault()
    if (!selectedJumboId) {
      toast('Please select a mother jumbo roll first', false)
      return
    }
    setBusy(true)
    try {
      const payload = {
        jumbo_reel_id: selectedJumboId,
        edge_trim_kg: Number(wasteForm.edge_trim_kg) || 0,
        rewinder_broke_kg: Number(wasteForm.rewinder_broke_kg) || 0,
        core_waste_kg: Number(wasteForm.core_waste_kg) || 0
      }
      const res = await API('/api/production/slitting/waste-log', { method: 'POST', body: JSON.stringify(payload) })
      const status = res.jumbo?.reconciliation_status
      if (status === 'BALANCED') {
        toast(`✓ Mass Balance Reconciled (${res.jumbo.variance_pct}% variance) — Edge trim credited to scrap!`)
      } else if (status === 'VARIANCE_HELD') {
        toast(`⚠️ Mass Balance Held: Variance ${res.jumbo.variance_pct}% > 0.5%. Plant Head override required.`, false)
      } else {
        toast('Slitting waste recorded successfully ✓')
      }
      loadJumboReels(filterDate, filterMachine)
    } catch (err) { toast(err.message, false) } finally { setBusy(false) }
  }

  const handleOverrideSubmit = async (e) => {
    e.preventDefault()
    if (!overrideTarget || !overrideReason) {
      toast('Override reason is required', false)
      return
    }
    setActionLoading(true)
    try {
      await API(`/api/production/jumbo-reels/${overrideTarget.id}/override`, {
        method: 'POST',
        body: JSON.stringify({ override_reason: overrideReason })
      })
      toast(`🛡️ Plant Head Override applied for Jumbo Roll ${overrideTarget.jumboNumber} ✓`)
      setOverrideTarget(null)
      setOverrideReason('')
      loadJumboReels(filterDate, filterMachine)
    } catch (err) { toast(err.message, false) } finally { setActionLoading(false) }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={S.page}>
      {/* Header */}
      <div style={S.header}>
        <div>
          <div style={S.title}>⚙️ Production MES & PPC Studio</div>
          <div style={S.sub}>Two-Stage Manufacturing Architecture · Mother-Child Genealogy · ACID Mass Balance Gate</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={S.badge}>Live PM01 Engine</span>
        </div>
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
          { key: 'ppc',       label: '📐 PPC Planning Studio' },
          { key: 'slitting',  label: '✂️ Slitting & Rewinder' },
          { key: 'shifts',    label: '🕐 Shifts' },
          { key: 'reels',     label: '🧻 PM Reels' },
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
          {['shifts', 'reels', 'downtime', 'ppc', 'slitting'].includes(tab) && (
            <label style={S.filterLabel}>Machine
              <select style={S.filterInput} value={filterMachine} onChange={e => setFilterMachine(e.target.value)}>
                <option value="">All Machines</option>
                {machines.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </label>
          )}
          {tab === 'ppc' && (
            <button
              type="button"
              style={{ ...S.btnSecondary, padding: '7px 12px', fontSize: 12, marginLeft: 'auto' }}
              onClick={() => setShowGradeCalc(v => !v)}
            >
              {showGradeCalc ? '✕ Close Grade Calculator' : '🧮 Grade Conversion (MT → Reels)'}
            </button>
          )}
        </div>
      )}

      {/* ══ PPC PLANNING STUDIO TAB ═══════════════════════════════════════════ */}
      {tab === 'ppc' && (
        <div style={S.stackPanel}>
          {/* PPC KPI Overview Header */}
          <div style={S.kpiGrid}>
            <div style={S.kpiCard}>
              <div style={S.kpiLabel}>Open Backlog Orders</div>
              <div style={S.kpiVal}>{pendingOrders.length}</div>
              <div style={S.kpiSub}>
                Pending: {pendingOrders.reduce((sum, o) => sum + (parseFloat(o.pendingMt) || 0), 0).toFixed(2)} MT
              </div>
            </div>
            <div style={S.kpiCard}>
              <div style={S.kpiLabel}>Active PPC Master Plans</div>
              <div style={S.kpiVal}>{ppcPlans.filter(p => p.status === 'SCHEDULED' || p.status === 'IN_PROGRESS').length}</div>
              <div style={S.kpiSub}>Total Planned: {ppcPlans.reduce((sum, p) => sum + (parseFloat(p.plannedTonnageMt) || 0), 0).toFixed(2)} MT</div>
            </div>
            <div style={S.kpiCard}>
              <div style={S.kpiLabel}>Target Deckle Optimization</div>
              <div style={{ ...S.kpiVal, color: trimPercentage <= 2 ? '#10b981' : '#ef4444' }}>
                {trimPercentage.toFixed(2)}% Trim
              </div>
              <div style={S.kpiSub}>Industry Benchmark: &le; 2.0% Usable Deckle</div>
            </div>
          </div>

          {/* Grade Conversion Calculator Drawer */}
          {showGradeCalc && (
            <div style={{ ...S.card, background: '#f8fafc', border: '1px solid #cbd5e1' }}>
              <div style={{ ...S.cardTitle, color: '#0f172a', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>🧮 Grade Conversion Engine — Tonnage to Reels Needed (Gw)</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#64748b' }}>Formula: Gw = ceil( Order MT × 1000 / avg reel weight kg )</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
                <Field label="Order Tonnage (MT)">
                  <input style={S.input} type="number" step="0.1" value={calcMt} onChange={e => setCalcMt(e.target.value)} />
                </Field>
                <Field label="Cut Width (mm)">
                  <input style={S.input} type="number" value={calcWidthMm} onChange={e => setCalcWidthMm(e.target.value)} />
                </Field>
                <Field label="Paper GSM">
                  <input style={S.input} type="number" value={calcGsm} onChange={e => setCalcGsm(e.target.value)} />
                </Field>
                <Field label="Roll Diameter (cm)">
                  <input style={S.input} type="number" value={calcDiaCm} onChange={e => setCalcDiaCm(e.target.value)} />
                </Field>
                <div style={{ background: '#e0f2fe', borderRadius: 8, padding: '10px 14px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#0369a1' }}>ESTIMATED REELS NEEDED</div>
                  <div style={{ fontSize: 22, fontWeight: 900, color: '#0284c7' }}>{calculatedReelsNeeded} Reels</div>
                </div>
              </div>
            </div>
          )}

          {/* Two-Panel: Plan Builder + Sales Backlog */}
          <div style={S.twoPanel}>
            {/* Master Plan & 1D Cutting Stock Pattern Builder */}
            <div style={S.card}>
              <div style={S.cardTitle}>📐 Create PPC Master Plan & Slitting Pattern</div>
              <form onSubmit={handlePpcPlanSubmit} style={S.form}>
                <div style={S.threeCol}>
                  <Field label="Target Date *">
                    <input style={S.input} type="date" value={ppcForm.target_date} onChange={e => setPpcForm(f => ({ ...f, target_date: e.target.value }))} required />
                  </Field>
                  <Field label="Machine *">
                    <select style={S.input} value={ppcForm.machine_id} onChange={e => setPpcForm(f => ({ ...f, machine_id: e.target.value }))} required>
                      <option value="">— Select Machine —</option>
                      {machines.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </select>
                  </Field>
                  <Field label="Grade *">
                    <select style={S.input} value={ppcForm.grade_id} onChange={e => setPpcForm(f => ({ ...f, grade_id: e.target.value }))} required>
                      <option value="">— Select Grade —</option>
                      {grades.map(g => <option key={g.id} value={g.id}>{g.name} ({g.code})</option>)}
                    </select>
                  </Field>
                </div>

                <div style={S.fourCol}>
                  <Field label="Target GSM *">
                    <input style={S.input} type="number" value={ppcForm.target_gsm} onChange={e => setPpcForm(f => ({ ...f, target_gsm: e.target.value }))} required />
                  </Field>
                  <Field label="Target BF">
                    <input style={S.input} type="number" value={ppcForm.target_bf} onChange={e => setPpcForm(f => ({ ...f, target_bf: e.target.value }))} />
                  </Field>
                  <Field label="Usable Deckle (mm) *">
                    <input style={S.input} type="number" value={ppcForm.usable_deckle_mm} onChange={e => setPpcForm(f => ({ ...f, usable_deckle_mm: e.target.value }))} required />
                  </Field>
                  <Field label="Planned Tonnage (MT) *">
                    <input style={S.input} type="number" step="0.1" value={ppcForm.planned_tonnage_mt} onChange={e => setPpcForm(f => ({ ...f, planned_tonnage_mt: e.target.value }))} required />
                  </Field>
                </div>

                {/* Interactive Deckle Visualizer Bar */}
                <div style={{ marginTop: 8, marginBottom: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
                    <span>Live Deckle Cut Configuration ({usableDeckleNum} mm Machine Deckle)</span>
                    <span style={{ color: trimPercentage <= 2 ? '#059669' : '#e11d48' }}>
                      Cuts: {totalPatternCutWidth} mm | Edge Trim: {plannedTrimMm} mm ({trimPercentage.toFixed(2)}%)
                    </span>
                  </div>

                  <div style={{ display: 'flex', width: '100%', height: 44, borderRadius: 8, overflow: 'hidden', border: '2px solid #334155', background: '#f1f5f9' }}>
                    {(currentPattern.cuts || []).map((cut, idx) => {
                      const cutW = parseFloat(cut.width_mm) || 0
                      const pct = usableDeckleNum > 0 ? (cutW / usableDeckleNum) * 100 : 0
                      const color = CUT_COLORS[idx % CUT_COLORS.length]
                      return (
                        <div
                          key={idx}
                          style={{
                            width: `${pct}%`,
                            background: color,
                            color: '#fff',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 11,
                            fontWeight: 700,
                            borderRight: '1px solid rgba(255,255,255,0.4)',
                            padding: '2px 4px',
                            boxSizing: 'border-box',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                          }}
                          title={`Cut #${idx + 1}: ${cutW}mm (${cut.remarks || 'Customer Roll'})`}
                        >
                          <span>K{idx + 1}: {cutW}mm</span>
                          <span style={{ fontSize: 9, opacity: 0.9 }}>{pct.toFixed(1)}%</span>
                        </div>
                      )
                    })}
                    {plannedTrimMm > 0 && (
                      <div
                        style={{
                          width: `${trimPercentage}%`,
                          background: trimPercentage <= 2 ? '#22c55e' : '#ef4444',
                          color: '#fff',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 10,
                          fontWeight: 700,
                          padding: '2px 4px',
                          boxSizing: 'border-box',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden'
                        }}
                        title={`Trim Waste: ${plannedTrimMm}mm (${trimPercentage.toFixed(2)}%)`}
                      >
                        <span>Trim: {plannedTrimMm}mm</span>
                        <span style={{ fontSize: 9 }}>{trimPercentage.toFixed(1)}%</span>
                      </div>
                    )}
                  </div>

                  {totalPatternCutWidth > usableDeckleNum && (
                    <div style={{ marginTop: 6, fontSize: 12, color: '#ef4444', fontWeight: 700 }}>
                      ⚠️ Total cuts ({totalPatternCutWidth} mm) exceed usable deckle ({usableDeckleNum} mm) by {totalPatternCutWidth - usableDeckleNum} mm!
                    </div>
                  )}
                </div>

                {/* Dynamic Knife Cuts Table */}
                <div style={{ marginTop: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>
                      ✂️ Slitting Knives Configuration ({currentPattern.cuts.length} Cuts)
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        type="button"
                        style={{ ...S.btnSecondary, background: '#f59e0b', color: '#fff', border: 'none', padding: '4px 10px', fontSize: 11, fontWeight: 700 }}
                        onClick={handleAutoSuggestCuts}
                        title="Run Best-Fit Decreasing algorithm against pending sales orders"
                      >
                        ✨ Auto-Optimize Knives (BFD)
                      </button>
                      <button type="button" style={{ ...S.btnSecondary, padding: '4px 10px', fontSize: 11 }} onClick={handleAddCut}>
                        + Add Knife Cut
                      </button>
                    </div>
                  </div>

                  <div style={S.tableWrap}>
                    <table style={S.table}>
                      <thead>
                        <tr>
                          <Th>Pos</Th>
                          <Th>Link Sales Order</Th>
                          <Th>Width (mm)</Th>
                          <Th>Description / Customer</Th>
                          <Th>Action</Th>
                        </tr>
                      </thead>
                      <tbody>
                        {currentPattern.cuts.map((cut, idx) => (
                          <tr key={idx} style={S.row}>
                            <Td style={{ fontWeight: 700, color: CUT_COLORS[idx % CUT_COLORS.length] }}>
                              Cut #{idx + 1}
                            </Td>
                            <Td>
                              <select
                                style={{ ...S.input, padding: '4px 8px', fontSize: 12 }}
                                value={cut.sales_order_id || ''}
                                onChange={e => handleCutChange(idx, 'sales_order_id', e.target.value)}
                              >
                                <option value="">— Direct / Stock —</option>
                                {pendingOrders.map(o => (
                                  <option key={o.id} value={o.id}>
                                    {o.soNumber} ({o.customerName} - {o.widthMm}mm, {o.pendingMt} MT)
                                  </option>
                                ))}
                              </select>
                            </Td>
                            <Td>
                              <input
                                type="number"
                                style={{ ...S.input, width: 90, padding: '4px 8px', fontSize: 12 }}
                                value={cut.width_mm}
                                onChange={e => handleCutChange(idx, 'width_mm', e.target.value)}
                                required
                              />
                            </Td>
                            <Td>
                              <input
                                style={{ ...S.input, padding: '4px 8px', fontSize: 12 }}
                                value={cut.remarks || ''}
                                onChange={e => handleCutChange(idx, 'remarks', e.target.value)}
                                placeholder="Customer / Specs"
                              />
                            </Td>
                            <Td>
                              {currentPattern.cuts.length > 1 && (
                                <button
                                  type="button"
                                  style={{ background: '#fee2e2', color: '#b91c1c', border: 'none', borderRadius: 4, padding: '3px 6px', cursor: 'pointer', fontSize: 11 }}
                                  onClick={() => handleRemoveCut(idx)}
                                >
                                  ✕
                                </button>
                              )}
                            </Td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                  <button style={{ ...S.btnPrimary, flex: 1 }} disabled={busy || totalPatternCutWidth > usableDeckleNum}>
                    {busy ? '⏳ Scheduling...' : '🚀 Schedule Master Plan & Commit Knives'}
                  </button>
                  <button type="button" style={S.btnSecondary} onClick={() => setPpcForm(initPpcForm())}>
                    Reset
                  </button>
                </div>
              </form>
            </div>

            {/* Open Sales Order Backlog Table */}
            <div style={S.card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div style={S.cardTitle}>📦 Pending Sales Order Backlog</div>
                <button style={{ ...S.btnSecondary, padding: '4px 10px', fontSize: 11 }} onClick={loadPendingOrders}>
                  ↻ Refresh Backlog
                </button>
              </div>

              <div style={S.tableWrap}>
                <table style={S.table}>
                  <thead>
                    <tr>
                      <Th>SO #</Th>
                      <Th>Customer</Th>
                      <Th>Grade / GSM</Th>
                      <Th>Width</Th>
                      <Th>Pending MT</Th>
                      <Th>Delivery</Th>
                      <Th>Action</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingOrders.length === 0 && (
                      <tr><td colSpan={7} style={S.empty}>No open sales orders in queue</td></tr>
                    )}
                    {pendingOrders.map(so => (
                      <tr key={so.id} style={S.row}>
                        <Td><strong style={{ color: '#0284c7' }}>{so.soNumber}</strong></Td>
                        <Td>{so.customerName}</Td>
                        <Td>{so.gradeCode || so.gradeName || '—'} / {so.gsm} GSM</Td>
                        <Td><strong>{so.widthMm} mm</strong></Td>
                        <Td>
                          <span style={{ fontWeight: 800, color: '#0f172a' }}>
                            {Number(so.pendingMt).toFixed(2)} MT
                          </span>
                        </Td>
                        <Td>{so.deliveryDate ? new Date(so.deliveryDate).toLocaleDateString() : '—'}</Td>
                        <Td>
                          <button
                            type="button"
                            style={{ ...S.btnSm, background: '#0284c7' }}
                            onClick={() => handleAddOrderToPlan(so)}
                            title="Add to current PPC cutting pattern"
                          >
                            ➕ Add as Knife Cut
                          </button>
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Master Production Plans Feed */}
          <div style={S.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={S.cardTitle}>📋 Master Production Plans & Slitting Schedules</div>
              <button style={{ ...S.btnSecondary, padding: '4px 10px', fontSize: 11 }} onClick={() => loadPpcPlans(filterDate, filterMachine)}>
                ↻ Refresh Plans
              </button>
            </div>

            <div style={S.tableWrap}>
              <table style={S.table}>
                <thead>
                  <tr>
                    <Th>Plan #</Th>
                    <Th>Target Date</Th>
                    <Th>Machine</Th>
                    <Th>Grade / GSM</Th>
                    <Th>Usable Deckle</Th>
                    <Th>Planned Tonnage</Th>
                    <Th>Slitting Patterns & Cuts</Th>
                    <Th>Status</Th>
                    <Th>Action</Th>
                  </tr>
                </thead>
                <tbody>
                  {ppcPlans.length === 0 && (
                    <tr><td colSpan={9} style={S.empty}>No production plans found for selected date/machine</td></tr>
                  )}
                  {ppcPlans.map(plan => (
                    <tr key={plan.id} style={S.row}>
                      <Td><strong style={{ color: '#0f172a', fontFamily: 'monospace' }}>{plan.planNumber}</strong></Td>
                      <Td>{plan.targetDate ? new Date(plan.targetDate).toLocaleDateString() : '—'}</Td>
                      <Td>{plan.machineName || '—'}</Td>
                      <Td>{plan.gradeName || plan.gradeCode || '—'} ({plan.targetGsm} GSM)</Td>
                      <Td>{plan.usableDeckleMm} mm</Td>
                      <Td><strong>{fmt.tonnage(plan.plannedTonnageMt)}</strong></Td>
                      <Td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {plan.patterns?.map((pat, pi) => (
                            <div key={pi} style={{ fontSize: 11, background: '#f1f5f9', padding: '4px 8px', borderRadius: 6 }}>
                              <span style={{ fontWeight: 700 }}>Pattern {pat.patternNumber}: </span>
                              <span>{pat.cuts?.map(c => `${c.widthMm}mm`).join(' + ')} </span>
                              <span style={{ color: pat.trimPercentage <= 2 ? '#15803d' : '#b91c1c', fontWeight: 700 }}>
                                (Trim: {pat.plannedTrimMm}mm / {Number(pat.trimPercentage).toFixed(1)}%)
                              </span>
                            </div>
                          ))}
                        </div>
                      </Td>
                      <Td>
                        <span style={{
                          ...S.statusBadge,
                          background: plan.status === 'COMPLETED' ? '#dcfce7' : plan.status === 'IN_PROGRESS' ? '#fef3c7' : '#e0f2fe',
                          color: plan.status === 'COMPLETED' ? '#15803d' : plan.status === 'IN_PROGRESS' ? '#b45309' : '#0369a1'
                        }}>
                          {plan.status}
                        </span>
                      </Td>
                      <Td>
                        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                          <select
                            style={{ ...S.statusSelect, fontSize: 11 }}
                            value={plan.status}
                            onChange={e => handlePlanStatusChange(plan.id, e.target.value)}
                          >
                            <option value="SCHEDULED">SCHEDULED</option>
                            <option value="IN_PROGRESS">IN_PROGRESS</option>
                            <option value="COMPLETED">COMPLETED</option>
                            <option value="CANCELLED">CANCELLED</option>
                          </select>
                          <button
                            type="button"
                            style={{ ...S.btnSm, background: '#0284c7', fontSize: 10, padding: '3px 7px' }}
                            onClick={() => printProductionOrderReport(plan.id)}
                            title="Print Production Order Report"
                          >
                            🖨️ Report
                          </button>
                        </div>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ══ SLITTING & REWINDING CONSOLE TAB ══════════════════════════════════ */}
      {tab === 'slitting' && (
        <div style={S.stackPanel}>
          {/* Slitting Stage 1 & Stage 2 Layout */}
          <div style={S.twoPanel}>
            {/* Stage 1: Register Mother Jumbo Roll */}
            <div style={S.card}>
              <div style={S.cardTitle}>🏭 Stage 1: Log Mother Jumbo Roll off Paper Machine</div>
              <form onSubmit={handleJumboSubmit} style={S.form}>
                <div style={S.twoCol}>
                  <Field label="Machine *">
                    <select style={S.input} value={jumboForm.machine_id} onChange={e => setJumboForm(f => ({ ...f, machine_id: e.target.value }))} required>
                      <option value="">— Select Machine —</option>
                      {machines.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </select>
                  </Field>
                  <Field label="Active Shift">
                    <select style={S.input} value={jumboForm.shift_id} onChange={e => setJumboForm(f => ({ ...f, shift_id: e.target.value }))}>
                      <option value="">— Current Shift —</option>
                      {todayShifts.map(s => <option key={s.id} value={s.id}>{s.shift_type} ({s.machineName || 'PM'})</option>)}
                    </select>
                  </Field>
                </div>

                <div style={S.threeCol}>
                  <Field label="Grade *">
                    <select style={S.input} value={jumboForm.grade_id} onChange={e => setJumboForm(f => ({ ...f, grade_id: e.target.value }))} required>
                      <option value="">— Select Grade —</option>
                      {grades.map(g => <option key={g.id} value={g.id}>{g.name} ({g.code})</option>)}
                    </select>
                  </Field>
                  <Field label="Actual GSM *">
                    <input style={S.input} type="number" value={jumboForm.gsm_actual} onChange={e => setJumboForm(f => ({ ...f, gsm_actual: e.target.value }))} required />
                  </Field>
                  <Field label="Actual BF">
                    <input style={S.input} type="number" value={jumboForm.bf_actual} onChange={e => setJumboForm(f => ({ ...f, bf_actual: e.target.value }))} />
                  </Field>
                </div>

                <div style={S.threeCol}>
                  <Field label="Deckle Width (mm) *">
                    <input style={S.input} type="number" value={jumboForm.deckle_width_mm} onChange={e => setJumboForm(f => ({ ...f, deckle_width_mm: e.target.value }))} required />
                  </Field>
                  <Field label="Gross Weight (KG) *">
                    <input style={S.input} type="number" value={jumboForm.gross_weight_kg} onChange={e => setJumboForm(f => ({ ...f, gross_weight_kg: e.target.value }))} required />
                  </Field>
                  <Field label="Core Spool Tare (KG)">
                    <input style={S.input} type="number" value={jumboForm.core_tare_weight_kg} onChange={e => setJumboForm(f => ({ ...f, core_tare_weight_kg: e.target.value }))} />
                  </Field>
                </div>

                <div style={{ ...S.effPreview, background: '#f8fafc', border: '1px solid #cbd5e1' }}>
                  <strong>Computed Mother Roll Net Weight: </strong>
                  <span style={{ fontSize: 16, fontWeight: 900, color: '#0284c7' }}>
                    {(parseFloat(jumboForm.gross_weight_kg || 0) - parseFloat(jumboForm.core_tare_weight_kg || 0)).toFixed(2)} KG
                  </span>
                  <span style={{ fontSize: 12, color: '#64748b', marginLeft: 8 }}>
                    ({((parseFloat(jumboForm.gross_weight_kg || 0) - parseFloat(jumboForm.core_tare_weight_kg || 0)) / 1000).toFixed(3)} MT)
                  </span>
                </div>

                <div style={S.twoCol}>
                  <Field label="Machine Speed (mpm)">
                    <input style={S.input} type="number" value={jumboForm.speed_mpm} onChange={e => setJumboForm(f => ({ ...f, speed_mpm: e.target.value }))} />
                  </Field>
                  <Field label="Moisture %">
                    <input style={S.input} type="number" step="0.1" value={jumboForm.moisture_pct} onChange={e => setJumboForm(f => ({ ...f, moisture_pct: e.target.value }))} />
                  </Field>
                </div>

                <button style={S.btnPrimary} disabled={busy}>
                  {busy ? '⏳ Registering...' : '🏭 Register Mother Jumbo Roll (MK-JMB-...)'}
                </button>
              </form>
            </div>

            {/* Stage 2: Active Slitting Workbench & Scale Authority */}
            <div style={S.card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div style={S.cardTitle}>✂️ Stage 2: Slitter/Rewinder Workbench</div>
                {currentJumbo && (
                  <span style={{
                    ...S.statusBadge,
                    background: currentJumbo.reconciliationStatus === 'BALANCED' ? '#dcfce7' : currentJumbo.reconciliationStatus === 'VARIANCE_HELD' ? '#fee2e2' : '#fef3c7',
                    color: currentJumbo.reconciliationStatus === 'BALANCED' ? '#15803d' : currentJumbo.reconciliationStatus === 'VARIANCE_HELD' ? '#b91c1c' : '#b45309',
                    fontSize: 12,
                    padding: '4px 10px'
                  }}>
                    {currentJumbo.reconciliationStatus === 'BALANCED' ? '✓ BALANCED (≤ 0.5%)' : currentJumbo.reconciliationStatus === 'VARIANCE_HELD' ? '⚠️ VARIANCE HELD (> 0.5%)' : 'OPEN'}
                  </span>
                )}
              </div>

              {/* Jumbo Selector */}
              <Field label="Select Mother Jumbo Roll to Slit">
                <select
                  style={{ ...S.input, fontWeight: 700 }}
                  value={selectedJumboId || ''}
                  onChange={e => setSelectedJumboId(Number(e.target.value))}
                >
                  <option value="">— Select Jumbo Roll —</option>
                  {jumboReels.map(j => (
                    <option key={j.id} value={j.id}>
                      {j.jumboNumber} — {j.gradeName || j.gradeCode} ({j.gsmActual} GSM, {j.netWeightKg} KG) [{j.reconciliationStatus}]
                    </option>
                  ))}
                </select>
              </Field>

              {currentJumbo ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 8 }}>
                  {/* Jumbo Specs Card */}
                  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 12, fontSize: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 800, color: '#0f172a', marginBottom: 4 }}>
                      <span>Mother Roll: {currentJumbo.jumboNumber}</span>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <span>Net Weight: {currentJumbo.netWeightKg} KG</span>
                        <button
                          type="button"
                          style={{ ...S.btnSm, background: '#0284c7', fontSize: 11, padding: '4px 9px' }}
                          onClick={() => printRewinderCuttingOrder(currentJumbo.id)}
                          title="Print Rewinder Cutting Order Sheet for Operator"
                        >
                          🖨️ Rewinder Sheet
                        </button>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 14, color: '#475569', flexWrap: 'wrap' }}>
                      <span>Grade: <b>{currentJumbo.gradeName || currentJumbo.gradeCode}</b></span>
                      <span>GSM: <b>{currentJumbo.gsmActual}</b></span>
                      <span>Deckle: <b>{currentJumbo.deckleWidthMm} mm</b></span>
                      <span>Child Reels Slit: <b>{slitReels.length}</b></span>
                      <span>Status: <b>{currentJumbo.status}</b></span>
                    </div>
                  </div>

                  {/* Child Slit Reel Scale Capture Form */}
                  <form onSubmit={handleSlitReelSubmit} style={{ ...S.form, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: 14 }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: '#166534' }}>
                      ⚖️ Scale Authority — Weighbridge Child Reel Capture
                    </div>

                    <div style={S.threeCol}>
                      <Field label="Cut Position (1..N) *">
                        <input style={S.input} type="number" value={slitForm.cut_position} onChange={e => setSlitForm(f => ({ ...f, cut_position: e.target.value }))} required />
                      </Field>
                      <Field label="Cut Width (mm) *">
                        <input style={S.input} type="number" value={slitForm.width_mm} onChange={e => setSlitForm(f => ({ ...f, width_mm: e.target.value }))} required />
                      </Field>
                      <Field label="Roll Diameter (cm)">
                        <input style={S.input} type="number" value={slitForm.diameter_cm} onChange={e => setSlitForm(f => ({ ...f, diameter_cm: e.target.value }))} />
                      </Field>
                    </div>

                    <Field label="Link Sales Order (Auto-updates Order Fulfillment)">
                      <select
                        style={S.input}
                        value={slitForm.sales_order_id}
                        onChange={e => {
                          const val = e.target.value
                          setSlitForm(f => ({ ...f, sales_order_id: val }))
                          if (val) {
                            const so = pendingOrders.find(o => String(o.id) === String(val))
                            if (so && so.widthMm) setSlitForm(f => ({ ...f, sales_order_id: val, width_mm: so.widthMm }))
                          }
                        }}
                      >
                        <option value="">— Direct / Stock —</option>
                        {pendingOrders.map(o => (
                          <option key={o.id} value={o.id}>
                            {o.soNumber} ({o.customerName} - {o.widthMm}mm, pending: {o.pendingMt} MT)
                          </option>
                        ))}
                      </select>
                    </Field>

                    <div style={S.twoCol}>
                      <Field label="Planned Weight (KG) (Optional)">
                        <input
                          style={S.input}
                          type="number"
                          value={slitForm.planned_weight_kg}
                          onChange={e => setSlitForm(f => ({ ...f, planned_weight_kg: e.target.value }))}
                          placeholder={currentJumbo ? `${((parseFloat(slitForm.width_mm || 0) / parseFloat(currentJumbo.deckleWidthMm)) * parseFloat(currentJumbo.netWeightKg)).toFixed(1)} KG` : 'Calculated'}
                        />
                      </Field>
                      <Field label="Actual Scale Weight (KG) *">
                        <input
                          style={{ ...S.input, fontWeight: 900, color: '#0f172a', background: '#fff' }}
                          type="number"
                          step="0.1"
                          value={slitForm.actual_weight_kg}
                          onChange={e => setSlitForm(f => ({ ...f, actual_weight_kg: e.target.value }))}
                          placeholder="Scale Reading"
                          required
                        />
                      </Field>
                    </div>

                    {liveYieldVariance && (
                      <div style={{ fontSize: 12, fontWeight: 700, color: Math.abs(liveYieldVariance.diffPct) > 5 ? '#b91c1c' : '#15803d' }}>
                        Yield Variance: {liveYieldVariance.diff > 0 ? '+' : ''}{liveYieldVariance.diff.toFixed(1)} KG ({liveYieldVariance.diffPct.toFixed(2)}%)
                      </div>
                    )}

                    <button style={{ ...S.btnPrimary, background: '#166534' }} disabled={busy}>
                      {busy ? '⏳ Capturing Scale...' : '⚡ Capture Scale & Approve Child Reel (MK-FIN-...)'}
                    </button>
                  </form>
                </div>
              ) : (
                <Empty text="Please select or log a Mother Jumbo roll above to begin slitting" />
              )}
            </div>
          </div>

          {/* Child Slit Reels Table & Mass Balance Gate */}
          {currentJumbo && (
            <div style={S.twoPanel}>
              {/* Finished Child Slit Reels Table */}
              <div style={S.card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div style={S.cardTitle}>🧻 Child Slit Reels Produced ({slitReels.length})</div>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#0284c7' }}>
                    Total Slit: {massBalanceStats.slitTotal.toFixed(2)} KG
                  </span>
                </div>

                <div style={S.tableWrap}>
                  <table style={S.table}>
                    <thead>
                      <tr>
                        <Th>Child Reel #</Th>
                        <Th>Cut</Th>
                        <Th>Width</Th>
                        <Th>Customer / SO</Th>
                        <Th>Actual Wt</Th>
                        <Th>Variance</Th>
                        <Th>Action</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {slitReels.length === 0 && (
                        <tr><td colSpan={7} style={S.empty}>No child slit reels logged yet for this mother roll</td></tr>
                      )}
                      {slitReels.map(sr => (
                        <tr key={sr.id} style={S.row}>
                          <Td><strong style={{ fontFamily: 'monospace', color: '#0f172a' }}>{sr.reelNumber}</strong></Td>
                          <Td>K#{sr.cutPosition}</Td>
                          <Td>{sr.widthMm} mm</Td>
                          <Td>{sr.customerName ? `${sr.customerName} (${sr.soNumber})` : 'Stock'}</Td>
                          <Td><strong>{sr.actualWeightKg} KG</strong></Td>
                          <Td>
                            <span style={{ color: Number(sr.weightVarianceKg) > 0 ? '#15803d' : '#b91c1c', fontSize: 11, fontWeight: 700 }}>
                              {Number(sr.weightVarianceKg) > 0 ? '+' : ''}{Number(sr.weightVarianceKg || 0).toFixed(1)} KG
                            </span>
                          </Td>
                          <Td>
                            <button
                              type="button"
                              style={{ ...S.btnSm, background: '#0f172a' }}
                              onClick={() => setPrintSlitReel(sr)}
                            >
                              🖨️ Barcode
                            </button>
                          </Td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Edge Trim & Broke Scrap Log (Mass Balance Reconciliation Gate) */}
              <div style={S.card}>
                <div style={S.cardTitle}>⚖️ Edge Trim & Mass Balance Reconciliation ($\pm 0.5\%$ Gate)</div>
                <form onSubmit={handleWasteSubmit} style={S.form}>
                  <div style={S.threeCol}>
                    <Field label="Edge Trim (T) (KG) *">
                      <input style={S.input} type="number" step="0.1" value={wasteForm.edge_trim_kg} onChange={e => setWasteForm(f => ({ ...f, edge_trim_kg: e.target.value }))} required />
                    </Field>
                    <Field label="Rewinder Broke (KG)">
                      <input style={S.input} type="number" step="0.1" value={wasteForm.rewinder_broke_kg} onChange={e => setWasteForm(f => ({ ...f, rewinder_broke_kg: e.target.value }))} />
                    </Field>
                    <Field label="Core / Tail Scrap (KG)">
                      <input style={S.input} type="number" step="0.1" value={wasteForm.core_waste_kg} onChange={e => setWasteForm(f => ({ ...f, core_waste_kg: e.target.value }))} />
                    </Field>
                  </div>

                  {/* Mass Balance Reconciliation Gauge */}
                  <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: 8, padding: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 700 }}>
                      <span>Mother Jumbo Net Input:</span>
                      <span>{massBalanceStats.netJumbo.toFixed(2)} KG</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 700, color: '#475569' }}>
                      <span>Total Accounted Output ($\sum H + T + \text{Broke} + \text{Core}$):</span>
                      <span>{massBalanceStats.totalOutput.toFixed(2)} KG</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 900, borderTop: '1px dashed #cbd5e1', paddingTop: 6 }}>
                      <span>Mass Variance ($\Delta$):</span>
                      <span style={{ color: massBalanceStats.isBalanced ? '#15803d' : '#b91c1c' }}>
                        {massBalanceStats.varianceKg.toFixed(2)} KG ({massBalanceStats.variancePct.toFixed(2)}%)
                      </span>
                    </div>

                    <div style={{
                      marginTop: 6,
                      padding: '8px 12px',
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: 700,
                      background: massBalanceStats.isBalanced ? '#dcfce7' : '#fee2e2',
                      color: massBalanceStats.isBalanced ? '#15803d' : '#b91c1c'
                    }}>
                      {massBalanceStats.isBalanced
                        ? `✅ MASS BALANCE RECONCILED: Variance ${massBalanceStats.variancePct.toFixed(2)}% is within ±0.5% tolerance. Edge trim automatically credited to scrap inventory.`
                        : `🚨 MASS BALANCE VARIANCE HELD: Variance ${massBalanceStats.variancePct.toFixed(2)}% exceeds ±0.5% tolerance band. Requires Plant Head override to dispatch.`}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 10 }}>
                    <button style={{ ...S.btnPrimary, flex: 1 }} disabled={busy}>
                      {busy ? '⏳ Reconciling...' : '⚖️ Save Slitting Waste & Reconcile Mass Balance'}
                    </button>
                    {currentJumbo.reconciliationStatus === 'VARIANCE_HELD' && (
                      <button
                        type="button"
                        style={{ ...S.btnSecondary, background: '#ef4444', color: '#fff' }}
                        onClick={() => setOverrideTarget(currentJumbo)}
                      >
                        🛡️ Plant Head Override
                      </button>
                    )}
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Mother Jumbo Rolls Feed */}
          <div style={S.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={S.cardTitle}>📜 Mother Jumbo Rolls Log & Status Feed</div>
              <button style={{ ...S.btnSecondary, padding: '4px 10px', fontSize: 11 }} onClick={() => loadJumboReels(filterDate, filterMachine)}>
                ↻ Refresh Rolls
              </button>
            </div>

            <div style={S.tableWrap}>
              <table style={S.table}>
                <thead>
                  <tr>
                    <Th>Jumbo #</Th>
                    <Th>Machine</Th>
                    <Th>Shift</Th>
                    <Th>Grade / GSM</Th>
                    <Th>Deckle</Th>
                    <Th>Net Weight</Th>
                    <Th>Slit Output</Th>
                    <Th>Waste Log</Th>
                    <Th>Variance</Th>
                    <Th>Status</Th>
                    <Th>Reconciliation</Th>
                  </tr>
                </thead>
                <tbody>
                  {jumboReels.length === 0 && (
                    <tr><td colSpan={11} style={S.empty}>No jumbo rolls found for selected filter</td></tr>
                  )}
                  {jumboReels.map(j => (
                    <tr
                      key={j.id}
                      style={{ ...S.row, cursor: 'pointer', background: selectedJumboId === j.id ? '#f0f9ff' : 'transparent' }}
                      onClick={() => setSelectedJumboId(j.id)}
                    >
                      <Td><strong style={{ fontFamily: 'monospace', color: '#0284c7' }}>{j.jumboNumber}</strong></Td>
                      <Td>{j.machineName || 'PM01'}</Td>
                      <Td>{j.shiftType || '—'}</Td>
                      <Td>{j.gradeName || j.gradeCode} ({j.gsmActual} GSM)</Td>
                      <Td>{j.deckleWidthMm} mm</Td>
                      <Td><strong>{fmt.weight(j.netWeightKg)}</strong></Td>
                      <Td>{j.slitReelCount ?? 0} reels ({fmt.weight(j.slitActualWeightKg)})</Td>
                      <Td>{j.totalWasteKg != null ? fmt.weight(j.totalWasteKg) : '—'}</Td>
                      <Td>
                        <span style={{ fontWeight: 700, color: Number(j.variancePct) <= 0.5 ? '#15803d' : '#b91c1c' }}>
                          {j.variancePct != null ? `${Number(j.variancePct).toFixed(2)}%` : '—'}
                        </span>
                      </Td>
                      <Td>
                        <span style={{ ...S.statusBadge, background: '#f1f5f9', color: '#334155' }}>
                          {j.status}
                        </span>
                      </Td>
                      <Td>
                        <span style={{
                          ...S.statusBadge,
                          background: j.reconciliationStatus === 'BALANCED' ? '#dcfce7' : j.reconciliationStatus === 'VARIANCE_HELD' ? '#fee2e2' : j.reconciliationStatus === 'OVERRIDDEN' ? '#f3e8ff' : '#fef3c7',
                          color: j.reconciliationStatus === 'BALANCED' ? '#15803d' : j.reconciliationStatus === 'VARIANCE_HELD' ? '#b91c1c' : j.reconciliationStatus === 'OVERRIDDEN' ? '#7e22ce' : '#b45309'
                        }}>
                          {j.reconciliationStatus}
                        </span>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
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
                            <button
                              style={{ ...S.btnSm, background: '#ef4444' }}
                              disabled={actionLoading}
                              onClick={() => setCloseShiftTarget(s)}
                            >
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

      {/* ══ REELS TAB ══════════════════════════════════════════════════════════ */}
      {tab === 'reels' && (
        <div style={S.twoPanel}>
          {/* Add Reel Form */}
          <div style={S.card}>
            <div style={S.cardTitle}>Log PM Reel</div>
            <form onSubmit={handleReelSubmit} style={S.form}>
              <div style={S.twoCol}>
                <Field label="Machine *">
                  <select style={S.input} value={reelForm.machine_id} onChange={e => setReelForm(f => ({ ...f, machine_id: e.target.value }))} required>
                    <option value="">— Select Machine —</option>
                    {machines.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                </Field>
                <Field label="Grade *">
                  <select style={S.input} value={reelForm.grade_id} onChange={e => setReelForm(f => ({ ...f, grade_id: e.target.value }))} required>
                    <option value="">— Select Grade —</option>
                    {grades.map(g => <option key={g.id} value={g.id}>{g.name} ({g.code})</option>)}
                  </select>
                </Field>
              </div>

              <div style={S.twoCol}>
                <Field label="Shift">
                  <select style={S.input} value={reelForm.shift_id} onChange={e => setReelForm(f => ({ ...f, shift_id: e.target.value }))}>
                    <option value="">— Current / None —</option>
                    {todayShifts.map(s => <option key={s.id} value={s.id}>{s.shift_type} ({s.machineName || 'PM'})</option>)}
                  </select>
                </Field>
                <Field label="Operator">
                  <select style={S.input} value={reelForm.operator_id} onChange={e => setReelForm(f => ({ ...f, operator_id: e.target.value }))}>
                    <option value="">— Select Operator —</option>
                    {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </Field>
              </div>

              <div style={S.threeCol}>
                <Field label="GSM *">
                  <input style={S.input} type="number" step="0.1" value={reelForm.gsm} onChange={e => setReelForm(f => ({ ...f, gsm: e.target.value }))} required />
                </Field>
                <Field label="BF">
                  <input style={S.input} type="number" step="0.1" value={reelForm.bf} onChange={e => setReelForm(f => ({ ...f, bf: e.target.value }))} />
                </Field>
                <Field label="Deckle (mm)">
                  <input style={S.input} type="number" value={reelForm.deckle} onChange={e => setReelForm(f => ({ ...f, deckle: e.target.value }))} />
                </Field>
              </div>

              <div style={S.threeCol}>
                <Field label="Width (mm) *">
                  <input style={S.input} type="number" value={reelForm.width_mm} onChange={e => setReelForm(f => ({ ...f, width_mm: e.target.value }))} required />
                </Field>
                <Field label="Length (m)">
                  <input style={S.input} type="number" value={reelForm.length_m} onChange={e => setReelForm(f => ({ ...f, length_m: e.target.value }))} />
                </Field>
                <Field label="Weight (kg) *">
                  <input style={S.input} type="number" step="0.1" value={reelForm.weight_kg} onChange={e => setReelForm(f => ({ ...f, weight_kg: e.target.value }))} required />
                </Field>
              </div>

              <div style={S.threeCol}>
                <Field label="Speed (mpm)">
                  <input style={S.input} type="number" value={reelForm.speed_mpm} onChange={e => setReelForm(f => ({ ...f, speed_mpm: e.target.value }))} />
                </Field>
                <Field label="Moisture %">
                  <input style={S.input} type="number" step="0.1" value={reelForm.moisture_pct} onChange={e => setReelForm(f => ({ ...f, moisture_pct: e.target.value }))} />
                </Field>
                <Field label="Steam (bar)">
                  <input style={S.input} type="number" step="0.1" value={reelForm.steam_pressure} onChange={e => setReelForm(f => ({ ...f, steam_pressure: e.target.value }))} />
                </Field>
              </div>

              <div style={S.threeCol}>
                <Field label="Prod Time (min)">
                  <input style={S.input} type="number" value={reelForm.production_time_min} onChange={e => setReelForm(f => ({ ...f, production_time_min: e.target.value }))} />
                </Field>
                <Field label="Break Time (min)">
                  <input style={S.input} type="number" value={reelForm.break_time_min} onChange={e => setReelForm(f => ({ ...f, break_time_min: e.target.value }))} />
                </Field>
                <Field label="Downtime (min)">
                  <input style={S.input} type="number" value={reelForm.downtime_min} onChange={e => setReelForm(f => ({ ...f, downtime_min: e.target.value }))} />
                </Field>
              </div>

              {liveEfficiency && (
                <div style={S.effPreview}>
                  ⚡ Live Machine Efficiency: <strong>{liveEfficiency}%</strong>
                </div>
              )}

              <Field label="Remarks">
                <textarea style={{ ...S.input, minHeight: 50 }} value={reelForm.remarks} onChange={e => setReelForm(f => ({ ...f, remarks: e.target.value }))} />
              </Field>

              <button style={S.btnPrimary} disabled={busy}>
                {busy ? '⏳ Saving...' : '🧻 Save PM Reel'}
              </button>
            </form>
          </div>

          {/* Reels Table */}
          <div style={S.card}>
            <div style={S.cardTitle}>Reels Produced — {filterDate} ({reels.length})</div>
            {loading ? <Spin /> : reels.length === 0
              ? <Empty text="No reels logged" />
              : (
              <div style={S.tableWrap}>
                <table style={S.table}>
                  <thead>
                    <tr>
                      <Th>Reel #</Th><Th>Grade</Th><Th>GSM / BF</Th>
                      <Th>Weight</Th><Th>Moisture</Th><Th>Status</Th><Th>Action</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {reels.map(r => (
                      <tr key={r.id} style={S.row}>
                        <Td><span style={S.reelNum}>{r.reel_number || r.reelNumber}</span></Td>
                        <Td>{r.gradeName || r.gradeCode || '—'}</Td>
                        <Td>{r.gsm} GSM {r.bf ? `/ ${r.bf} BF` : ''}</Td>
                        <Td>{fmt.weight(r.weight_kg || r.weightKg)}</Td>
                        <Td>{fmt.moisture(r.moisture_pct || r.moisturePct)}</Td>
                        <Td>
                          <span style={{ ...S.statusBadge, background: STATUS_COLORS[r.status] ? `${STATUS_COLORS[r.status]}20` : '#f6f5f0', color: STATUS_COLORS[r.status] || '#1b1b1d' }}>
                            {r.status}
                          </span>
                        </Td>
                        <Td>
                          <div style={{ display: 'flex', gap: 6 }}>
                            {VALID_NEXT[r.status]?.length > 0 && (
                              <select
                                style={S.statusSelect}
                                defaultValue=""
                                onChange={e => { if (e.target.value) handleReelStatusChange(r.id, e.target.value) }}
                              >
                                <option value="" disabled>→</option>
                                {VALID_NEXT[r.status].map(s => <option key={s} value={s}>{s}</option>)}
                              </select>
                            )}
                            <button
                              type="button"
                              style={{ ...S.btnSm, background: '#1b1b1d' }}
                              onClick={() => setPrintReel(r)}
                              title="Print Reel QR Code Label"
                            >
                              🖨️ QR
                            </button>
                          </div>
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
            <div style={S.cardTitle}>Log Machine Downtime</div>
            <form onSubmit={handleDowntimeSubmit} style={S.form}>
              <Field label="Machine *">
                <select style={S.input} value={downtimeForm.machine_id} onChange={e => setDowntimeForm(f => ({ ...f, machine_id: e.target.value }))} required>
                  <option value="">— Select Machine —</option>
                  {machines.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
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
              <div style={S.twoCol}>
                <Field label="Duration (min)">
                  <input style={S.input} type="number" value={downtimeForm.duration_min} onChange={e => setDowntimeForm(f => ({ ...f, duration_min: e.target.value }))} />
                </Field>
                <Field label="Category *">
                  <select style={S.input} value={downtimeForm.category} onChange={e => setDowntimeForm(f => ({ ...f, category: e.target.value }))}>
                    <option value="Mechanical">Mechanical</option>
                    <option value="Electrical">Electrical</option>
                    <option value="Operational">Operational</option>
                    <option value="Process">Process</option>
                    <option value="Boiler/Steam">Boiler / Steam</option>
                    <option value="Power Outage">Power Outage</option>
                    <option value="Other">Other</option>
                  </select>
                </Field>
              </div>
              <Field label="Reason Code">
                <select style={S.input} value={downtimeForm.reason_code_id} onChange={e => setDowntimeForm(f => ({ ...f, reason_code_id: e.target.value }))}>
                  <option value="">— Select Reason Code —</option>
                  {reasonCodes.map(rc => <option key={rc.id} value={rc.id}>{rc.code} — {rc.description}</option>)}
                </select>
              </Field>
              <Field label="Reason / Root Cause *">
                <textarea style={{ ...S.input, minHeight: 60 }} value={downtimeForm.reason} onChange={e => setDowntimeForm(f => ({ ...f, reason: e.target.value }))} required />
              </Field>
              <Field label="Corrective Action">
                <textarea style={{ ...S.input, minHeight: 50 }} value={downtimeForm.corrective_action} onChange={e => setDowntimeForm(f => ({ ...f, corrective_action: e.target.value }))} />
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
              ? <Empty text="No downtime events recorded" />
              : (
              <div style={S.tableWrap}>
                <table style={S.table}>
                  <thead>
                    <tr>
                      <Th>Category</Th><Th>Duration</Th><Th>Machine</Th>
                      <Th>Reason</Th><Th>Action Taken</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {downtime.map(d => (
                      <tr key={d.id} style={S.row}>
                        <Td>
                          <span style={{ ...S.statusBadge, background: '#fee2e2', color: '#b91c1c' }}>
                            {d.category}
                          </span>
                        </Td>
                        <Td><strong>{fmt.mins(d.duration_min || d.durationMin)}</strong></Td>
                        <Td>{d.machineName || '—'}</Td>
                        <Td style={{ maxWidth: 200 }}>{d.reason}</Td>
                        <Td style={{ maxWidth: 180, color: '#8a8a90' }}>{d.corrective_action || d.correctiveAction || '—'}</Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══ OEE TAB ══════════════════════════════════════════════════════════════ */}
      {tab === 'oee' && (
        <div style={S.stackPanel}>
          <div style={S.filterBar}>
            <label style={S.filterLabel}>OEE Date
              <input type="date" style={S.filterInput} value={oeeDate} onChange={e => setOeeDate(e.target.value)} />
            </label>
          </div>

          <div style={S.oeeGrid}>
            {oeeData.length === 0 && <Empty text="No OEE data calculated for this date" />}
            {oeeData.map(m => (
              <div key={m.machineId} style={S.oeeCard}>
                <div style={S.oeeTitle}>{m.machineName}</div>
                <div style={{ ...S.oeeBigNum, color: oeeColor(m.oee) }}>
                  {Number(m.oee || 0).toFixed(1)}%
                  <div style={{ fontSize: 11, color: '#8a8a90', fontWeight: 600 }}>OVERALL EQUIPMENT EFFECTIVENESS</div>
                </div>

                <div style={S.oeeRow}>
                  <OeeMeter label="Availability" value={m.availability} color="#3b82f6" />
                  <OeeMeter label="Performance"  value={m.performance}  color="#8b5cf6" />
                  <OeeMeter label="Quality"      value={m.quality}      color="#10b981" />
                </div>

                <div style={S.oeeStats}>
                  <div>Planned: <strong>{fmt.mins(m.plannedTimeMin)}</strong></div>
                  <div>Operating: <strong>{fmt.mins(m.operatingTimeMin)}</strong></div>
                  <div>Downtime: <strong style={{ color: '#ef4444' }}>{fmt.mins(m.downtimeMin)}</strong></div>
                  <div>Good: <strong>{fmt.weight(m.goodProductionKg)}</strong></div>
                  <div>Total: <strong>{fmt.weight(m.totalProductionKg)}</strong></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ══ SHIFT REPORTS TAB ════════════════════════════════════════════════════ */}
      {tab === 'reports' && (
        <div style={S.twoPanel}>
          <div style={S.card}>
            <div style={S.cardTitle}>Daily Shift Report Logging</div>
            <form onSubmit={handleReportSubmit} style={S.form}>
              <div style={S.twoCol}>
                <Field label="Date">
                  <input style={S.input} type="date" value={reportForm.date} onChange={e => setReportForm(f => ({ ...f, date: e.target.value }))} required />
                </Field>
                <Field label="Shift">
                  <select style={S.input} value={reportForm.shift_type} onChange={e => setReportForm(f => ({ ...f, shift_type: e.target.value }))}>
                    <option value="Day">Day</option>
                    <option value="Night">Night</option>
                    <option value="General">General</option>
                  </select>
                </Field>
              </div>

              <Field label="Section">
                <select style={S.input} value={reportForm.section} onChange={e => setReportForm(f => ({ ...f, section: e.target.value }))}>
                  <option value="Machine Room">Machine Room</option>
                  <option value="Pulp Mill / Stock Prep">Pulp Mill / Stock Prep</option>
                  <option value="Finishing & Slitting">Finishing & Slitting</option>
                  <option value="Boiler & Utilities">Boiler & Utilities</option>
                  <option value="ETP">ETP</option>
                </select>
              </Field>

              <div style={S.twoCol}>
                <Field label="Pulp / Chest Level (%)">
                  <input style={S.input} type="number" value={reportForm.data?.pulp_level || ''} onChange={e => setReportForm(f => ({ ...f, data: { ...f.data, pulp_level: e.target.value } }))} />
                </Field>
                <Field label="Avg Machine Speed (mpm)">
                  <input style={S.input} type="number" value={reportForm.data?.machine_speed || ''} onChange={e => setReportForm(f => ({ ...f, data: { ...f.data, machine_speed: e.target.value } }))} />
                </Field>
              </div>

              <Field label="Remarks & Observations">
                <textarea style={{ ...S.input, minHeight: 60 }} value={reportForm.remarks} onChange={e => setReportForm(f => ({ ...f, remarks: e.target.value }))} />
              </Field>

              <button style={S.btnPrimary} disabled={busy}>Submit Shift Report</button>
            </form>
          </div>

          <div style={S.card}>
            <div style={S.cardTitle}>Shift Reports Log</div>
            <div style={S.tableWrap}>
              <table style={S.table}>
                <thead>
                  <tr>
                    <Th>Section</Th><Th>Shift</Th><Th>Pulp Level</Th><Th>Speed</Th><Th>Logged By</Th><Th>Remarks</Th>
                  </tr>
                </thead>
                <tbody>
                  {shiftReports.length === 0 && <tr><td colSpan={6} style={S.empty}>No shift reports logged</td></tr>}
                  {shiftReports.map(sr => (
                    <tr key={sr.id} style={S.row}>
                      <Td><strong>{sr.section}</strong></Td>
                      <Td>{sr.shift_type}</Td>
                      <Td>{sr.data?.pulp_level ? `${sr.data.pulp_level}%` : '—'}</Td>
                      <Td>{sr.data?.machine_speed ? `${sr.data.machine_speed} mpm` : '—'}</Td>
                      <Td>{sr.createdByName || '—'}</Td>
                      <Td style={{ maxWidth: 200, fontSize: 12 }}>{sr.remarks || '—'}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ══ CHEMICAL CONSUMPTION TAB ════════════════════════════════════════════ */}
      {tab === 'chemicals' && (
        <div style={S.twoPanel}>
          <div style={S.card}>
            <div style={S.cardTitle}>Log Chemical Consumption</div>
            <form onSubmit={handleChemSubmit} style={S.form}>
              <div style={S.twoCol}>
                <Field label="Date">
                  <input style={S.input} type="date" value={chemForm.date} onChange={e => setChemForm(f => ({ ...f, date: e.target.value }))} required />
                </Field>
                <Field label="Shift">
                  <select style={S.input} value={chemForm.shift_type} onChange={e => setChemForm(f => ({ ...f, shift_type: e.target.value }))}>
                    <option value="Day">Day</option>
                    <option value="Night">Night</option>
                    <option value="General">General</option>
                  </select>
                </Field>
              </div>

              <Field label="Chemical / Additive *">
                <select style={S.input} value={chemForm.chemical_id} onChange={e => setChemForm(f => ({ ...f, chemical_id: e.target.value }))} required>
                  <option value="">— Select Chemical Item —</option>
                  {chemicals.map(c => <option key={c.id} value={c.id}>{c.name} ({c.code || c.unit})</option>)}
                </select>
              </Field>

              <div style={S.twoCol}>
                <Field label="Qty Consumed (KG/L) *">
                  <input style={S.input} type="number" step="0.1" value={chemForm.qty_consumed} onChange={e => setChemForm(f => ({ ...f, qty_consumed: e.target.value }))} required />
                </Field>
                <Field label="Unit Cost (₹) (Optional)">
                  <input style={S.input} type="number" step="0.01" value={chemForm.unit_cost} onChange={e => setChemForm(f => ({ ...f, unit_cost: e.target.value }))} />
                </Field>
              </div>

              <button style={S.btnPrimary} disabled={busy}>Record Consumption</button>
            </form>
          </div>

          <div style={S.card}>
            <div style={S.cardTitle}>Chemical Usage Feed</div>
            <div style={S.tableWrap}>
              <table style={S.table}>
                <thead>
                  <tr>
                    <Th>Chemical</Th><Th>Shift</Th><Th>Qty</Th><Th>Total Cost</Th><Th>Logged By</Th>
                  </tr>
                </thead>
                <tbody>
                  {chemicalLogs.length === 0 && <tr><td colSpan={5} style={S.empty}>No consumption logged</td></tr>}
                  {chemicalLogs.map(cl => (
                    <tr key={cl.id} style={S.row}>
                      <Td><strong>{cl.chemicalName || cl.chemical_id}</strong></Td>
                      <Td>{cl.shift_type}</Td>
                      <Td>{cl.qty_consumed} {cl.unit || 'KG'}</Td>
                      <Td>{cl.total_cost ? fmt.currency(cl.total_cost) : '—'}</Td>
                      <Td>{cl.createdByName || '—'}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ══ FURNISH MIX TAB ═════════════════════════════════════════════════════ */}
      {tab === 'furnish' && (
        <div style={S.twoPanel}>
          <div style={S.card}>
            <div style={S.cardTitle}>Log Furnish Batch Mix</div>
            <form onSubmit={handleFurnishSubmit} style={S.form}>
              <div style={S.twoCol}>
                <Field label="Batch Number">
                  <input style={S.input} value={furnishForm.batch_number} onChange={e => setFurnishForm(f => ({ ...f, batch_number: e.target.value }))} placeholder="Auto (FURN-YYYYMMDD-X)" />
                </Field>
                <Field label="Report Date">
                  <input style={S.input} type="date" value={furnishForm.report_date} onChange={e => setFurnishForm(f => ({ ...f, report_date: e.target.value }))} />
                </Field>
              </div>

              <div style={S.threeCol}>
                <Field label="Local Furnish (KG)">
                  <input style={S.input} type="number" value={furnishForm.local_furnish_kg} onChange={e => setFurnishForm(f => ({ ...f, local_furnish_kg: e.target.value }))} />
                </Field>
                <Field label="OCC Furnish (KG)">
                  <input style={S.input} type="number" value={furnishForm.occ_furnish_kg} onChange={e => setFurnishForm(f => ({ ...f, occ_furnish_kg: e.target.value }))} />
                </Field>
                <Field label="Other Furnish (KG)">
                  <input style={S.input} type="number" value={furnishForm.other_furnish_kg} onChange={e => setFurnishForm(f => ({ ...f, other_furnish_kg: e.target.value }))} />
                </Field>
              </div>

              <div style={S.twoCol}>
                <Field label="Local Moisture %">
                  <input style={S.input} type="number" step="0.1" value={furnishForm.local_moisture} onChange={e => setFurnishForm(f => ({ ...f, local_moisture: e.target.value }))} />
                </Field>
                <Field label="OCC Moisture %">
                  <input style={S.input} type="number" step="0.1" value={furnishForm.occ_moisture} onChange={e => setFurnishForm(f => ({ ...f, occ_moisture: e.target.value }))} />
                </Field>
              </div>

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

      {/* ══ MODALS ═════════════════════════════════════════════════════════════ */}

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

      {/* Supervisor Mass Balance Override Modal */}
      {overrideTarget && (
        <div style={S.overlay}>
          <div style={{ ...S.modal, maxWidth: 500 }}>
            <div style={S.modalHdr}>
              <b style={{ color: '#b91c1c' }}>🛡️ Plant Head / Supervisor Override — Jumbo {overrideTarget.jumboNumber}</b>
              <button style={S.x} onClick={() => setOverrideTarget(null)}>✕</button>
            </div>
            <form onSubmit={handleOverrideSubmit} style={S.form}>
              <div style={{ background: '#fee2e2', border: '1px solid #fecaca', borderRadius: 8, padding: 12, fontSize: 12, color: '#991b1b' }}>
                <strong>CRITICAL AUDIT NOTICE: </strong>
                This mother roll has a mass balance variance of <b>{overrideTarget.variancePct != null ? `${Number(overrideTarget.variancePct).toFixed(2)}%` : 'exceeding 0.5%'}</b>.
                As Level 4+ Supervisor/Plant Head, your override will be permanently logged in PostgreSQL audit trails.
              </div>

              <Field label="Override Reason / Root Cause Justification *">
                <textarea
                  style={{ ...S.input, minHeight: 80 }}
                  value={overrideReason}
                  onChange={e => setOverrideReason(e.target.value)}
                  placeholder="Document why variance exceeded ±0.5% (e.g., weighbridge tare drift, high moisture trim evaporation, unmeasured spool discrepancy)..."
                  required
                />
              </Field>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 10 }}>
                <button type="button" style={S.btnSecondary} onClick={() => setOverrideTarget(null)}>
                  Cancel
                </button>
                <button type="submit" style={{ ...S.btnPrimary, background: '#b91c1c' }} disabled={actionLoading}>
                  {actionLoading ? '⏳ Overriding...' : '🛡️ Confirm Supervisor Override'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Child Slit Reel Printable QR / Barcode Slip Modal */}
      {printSlitReel && (
        <div style={S.overlay}>
          <div style={{ ...S.modal, maxWidth: 420 }}>
            <div style={S.modalHdr}>
              <b>✂️ Child Slit Reel Identification Slip</b>
              <button style={S.x} onClick={() => setPrintSlitReel(null)}>✕</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center' }}>
              <div id="printable-slit-slip" style={{ border: '2px dashed #334155', borderRadius: 8, padding: 20, width: '100%', background: '#fff', boxSizing: 'border-box' }}>
                <div style={{ textAlign: 'center', borderBottom: '2px solid #1b1b1d', paddingBottom: 10, marginBottom: 12 }}>
                  <div style={{ fontSize: 16, fontWeight: 900, textTransform: 'uppercase', letterSpacing: 1 }}>MK Paper Mill Ltd.</div>
                  <div style={{ fontSize: 10, color: '#64748b' }}>Finished Goods Slit Reel Barcode Slip</div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, color: '#1b1b1d' }}>
                  <div><strong>REEL NO:</strong> <span style={{ fontFamily: 'monospace', fontWeight: 800, color: '#0284c7' }}>{printSlitReel.reelNumber}</span></div>
                  <div><strong>BARCODE:</strong> <span style={{ fontFamily: 'monospace', fontSize: 11 }}>{printSlitReel.barcode}</span></div>
                  <div><strong>CUT POSITION:</strong> Knife #{printSlitReel.cutPosition}</div>
                  <div><strong>WIDTH:</strong> {printSlitReel.widthMm} mm {printSlitReel.diameterCm ? `× ⌀${printSlitReel.diameterCm} cm` : ''}</div>
                  <div><strong>ACTUAL WEIGHT:</strong> <span style={{ fontSize: 16, fontWeight: 900 }}>{printSlitReel.actualWeightKg} KG</span></div>
                  <div><strong>PLANNED WEIGHT:</strong> {printSlitReel.plannedWeightKg} KG</div>
                  <div><strong>CUSTOMER:</strong> {printSlitReel.customerName ? `${printSlitReel.customerName} (${printSlitReel.soNumber})` : 'Stock Reel'}</div>
                  <div><strong>QUALITY STATUS:</strong> <span style={{ color: '#15803d', fontWeight: 800 }}>{printSlitReel.qualityStatus || 'APPROVED'}</span></div>
                  <div><strong>DATE:</strong> {new Date(printSlitReel.createdAt || Date.now()).toLocaleDateString()}</div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'center', margin: '14px 0' }}>
                  <img
                    alt="Slit Reel Barcode"
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(
                      JSON.stringify({
                        reelNumber: printSlitReel.reelNumber,
                        barcode: printSlitReel.barcode,
                        width: printSlitReel.widthMm,
                        weight: printSlitReel.actualWeightKg,
                        customer: printSlitReel.customerName,
                        so: printSlitReel.soNumber,
                        date: printSlitReel.createdAt
                      })
                    )}`}
                    style={{ width: 130, height: 130 }}
                  />
                </div>

                <div style={{ borderTop: '1px dashed #d8d6cc', paddingTop: 8, fontSize: 9, color: '#8a8a90', textAlign: 'center' }}>
                  Authorized Weighbridge Scale Reading · Validated for FG Warehouse Inward
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', width: '100%', marginTop: 8 }}>
                <button type="button" style={S.btnSecondary} onClick={() => setPrintSlitReel(null)}>Close</button>
                <button type="button" style={S.btnPrimary} onClick={() => window.print()}>🖨️ Print Label</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Printable QR Code Slip Modal for PM Jumbo Reel */}
      {printReel && (
        <div style={S.overlay}>
          <div style={{ ...S.modal, maxWidth: 420 }}>
            <div style={S.modalHdr}>
              <b>🧻 PM Reel QR Label</b>
              <button style={S.x} onClick={() => setPrintReel(null)}>✕</button>
            </div>
            
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
                    style={{ width: 130, height: 130 }}
                  />
                </div>

                <div style={{ borderTop: '1px dashed #d8d6cc', paddingTop: 8, fontSize: 9, color: '#8a8a90', textAlign: 'center' }}>
                  Scan code to verify reel specs in MKPM Inventory system.
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', width: '100%', marginTop: 8 }}>
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

  tabs:      { display: 'flex', gap: 4, marginBottom: 16, borderBottom: '2px solid #ecebe5', paddingBottom: 0, overflowX: 'auto' },
  tab:       { padding: '9px 16px', border: 'none', borderRadius: '8px 8px 0 0', cursor: 'pointer', fontSize: 13, fontWeight: 600, background: 'transparent', color: '#8a8a90', transition: 'all .15s', whiteSpace: 'nowrap' },
  tabActive: { background: '#1b1b1d', color: '#fff' },

  filterBar:   { display: 'flex', gap: 16, marginBottom: 16, alignItems: 'flex-end', flexWrap: 'wrap' },
  filterLabel: { display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, fontWeight: 600, color: '#3a3a3e' },
  filterInput: { background: '#fff', border: '1px solid #d8d6cc', borderRadius: 8, padding: '7px 10px', fontSize: 13, color: '#1b1b1d' },

  kpiGrid:   { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 },
  kpiCard:   { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '16px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' },
  kpiLabel:  { fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5 },
  kpiVal:    { fontSize: 26, fontWeight: 900, color: '#0f172a', margin: '4px 0' },
  kpiSub:    { fontSize: 12, color: '#94a3b8' },

  twoPanel:  { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: 16 },
  stackPanel:{ display: 'flex', flexDirection: 'column', gap: 16 },

  card:      { background: '#fff', border: '1px solid #ecebe5', borderRadius: 16, padding: 20, boxShadow: '0 2px 8px rgba(15,23,42,0.06)' },
  cardTitle: { fontSize: 16, fontWeight: 700, color: '#1b1b1d', marginBottom: 16 },

  form:      { display: 'flex', flexDirection: 'column', gap: 12 },
  label:     { display: 'flex', flexDirection: 'column', gap: 4 },
  labelText: { fontSize: 12, fontWeight: 600, color: '#3a3a3e' },
  input:     { background: '#f6f5f0', border: '1px solid #d8d6cc', borderRadius: 8, padding: '9px 12px', color: '#1b1b1d', fontSize: 13, outline: 'none', transition: 'border-color .15s' },
  twoCol:    { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },
  threeCol:  { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 },
  fourCol:   { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12 },

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
  statusBadge: { padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700, display: 'inline-block' },
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
