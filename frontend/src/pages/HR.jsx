import React, { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'

const BASE = '/api/hr'
const api = (path, opts) => fetch(BASE + path, {
  headers: { Authorization: `Bearer ${localStorage.getItem('mk_token')}`, 'Content-Type': 'application/json', ...(opts?.headers || {}) },
  ...opts
}).then(r => r.json())

const fmt = {
  money: v => `₹${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
  date:  v => v ? new Date(v).toLocaleDateString('en-IN') : '—',
  month: v => v ? new Date(v + '-01').toLocaleString('en-IN', { month: 'long', year: 'numeric' }) : '—',
}

const ATT_STATUS = ['Present', 'Absent', 'Half Day', 'Leave', 'Holiday', 'OT']
const GENDERS    = ['Male', 'Female', 'Other']
const emptyEmp   = { employee_code:'', name:'', department_id:'', designation:'', doj:'', dob:'', gender:'', mobile:'', email:'', aadhar:'', pan:'', pf_number:'', esic_number:'', bank_account:'', bank_name:'', ifsc:'', basic_salary:'', user_id:'' }

// ─── STATUS BADGE ─────────────────────────────────────────────────────────────
const Badge = ({ v, map }) => {
  const cfg = map[v] || { bg: '#33333322', color: '#888' }
  return <span style={{ ...S.badge, background: cfg.bg, color: cfg.color }}>{v}</span>
}
const ATT_BAD = { Present:{ bg:'#16a34a22', color:'#16a34a' }, Absent:{ bg:'#dc262622', color:'#dc2626' }, 'Half Day':{ bg:'#d9770622', color:'#d97706' }, Leave:{ bg:'#7c3aed22', color:'#7c3aed' }, OT:{ bg:'#0369a122', color:'#0369a1' }, Holiday:{ bg:'#71717a22', color:'#71717a' } }
const PAY_BAD  = { Paid:{ bg:'#16a34a22', color:'#16a34a' }, Draft:{ bg:'#d9770622', color:'#d97706' } }

// ─── SECTION CARD ─────────────────────────────────────────────────────────────
const KPICard = ({ label, value, sub, color = '#1b1b1d' }) => (
  <div style={S.kpiCard}>
    <div style={{ fontSize: 11, color: '#8a8a90', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>{label}</div>
    <div style={{ fontSize: 22, fontWeight: 700, color, marginTop: 4 }}>{value}</div>
    {sub && <div style={{ fontSize: 11, color: '#a0a0a6', marginTop: 2 }}>{sub}</div>}
  </div>
)

// ═══════════════════════════════════════════════════════════════════════════════
export default function HR() {
  const { user } = useAuth()

  const isHRAdmin  = (user?.department === 'HR & Payroll' || user?.dept_code === 'HR') && (user?.role_level || 0) >= 3
  const isSysAdmin = (user?.role_level || 0) >= 5
  const canAdmin   = isHRAdmin || isSysAdmin
  const canSupervise = (user?.role_level || 0) >= 2

  // determine initial tab
  const defaultTab = canAdmin ? 'employees' : 'my-profile'
  const [tab, setTab] = useState(defaultTab)

  const TABS = [
    // Self-service — all L1+
    { key: 'my-profile',    label: '👤 Profile',         show: true },
    { key: 'my-attendance', label: '📅 Attendance',      show: true },
    { key: 'my-leaves',     label: '🌴 Leave Balance',   show: true },
    { key: 'apply-leave',   label: '📝 Apply Leave',     show: true },
    { key: 'my-payslip',    label: '💰 Payslip',         show: true },
    { key: 'my-docs',       label: '📁 Documents',       show: true },
    { key: 'onboarding',    label: '✅ Onboarding',      show: true },
    { key: 'appraisals',    label: '🎯 Appraisals',      show: true },
    { key: 'training',      label: '🎓 Training',        show: true },
    { key: 'separation',    label: '🚪 Separation',      show: true },
    // Supervisor — L2+
    { key: 'team-att',      label: '📋 Team Attendance', show: canSupervise },
    { key: 'team-leaves',   label: '📨 Team Leaves',     show: canSupervise },
    // Admin — HR Admin or L5
    // Available to all
    { key: 'holidays',      label: '📆 Holidays',        show: true },
    { key: 'my-loans',      label: '💳 Loans/Advance',   show: true },
    // Admin — HR Admin or L5
    { key: 'employees',     label: '🏢 Employees',       show: canAdmin },
    { key: 'payroll-runs',  label: '🧮 Payroll Runs',    show: canAdmin },
    { key: 'payroll',       label: '⚙️ Legacy Payroll',  show: canAdmin },
  ].filter(t => t.show)

  return (
    <div style={S.page}>
      <div style={S.header}>
        <div>
          <div style={S.title}>HR & People</div>
          <div style={S.sub}>
            {canAdmin ? 'HR Admin — full access' : isHRAdmin ? 'HR Supervisor' : `Employee — ${user?.department || ''}`}
          </div>
        </div>
      </div>

      <div style={S.tabs}>
        {TABS.map(t => (
          <button key={t.key} style={{ ...S.tabBtn, ...(tab === t.key ? S.tabActive : {}) }} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'my-profile'    && <MyProfile />}
      {tab === 'my-attendance' && <MyAttendance />}
      {tab === 'my-leaves'     && <MyLeaves />}
      {tab === 'apply-leave'   && <ApplyLeave user={user} />}
      {tab === 'my-payslip'    && <MyPayslip />}
      {tab === 'my-docs'       && <MyDocuments user={user} canAdmin={canAdmin} />}
      {tab === 'onboarding'    && <Onboarding user={user} canAdmin={canAdmin} />}
      {tab === 'appraisals'    && <Appraisals user={user} canAdmin={canAdmin} canSupervise={canSupervise} />}
      {tab === 'training'      && <Training user={user} canAdmin={canAdmin} canSupervise={canSupervise} />}
      {tab === 'separation'    && <Separation user={user} canAdmin={canAdmin} />}
      {tab === 'team-att'      && <TeamAttendance user={user} canAdmin={canAdmin} />}
      {tab === 'team-leaves'   && <TeamLeaves user={user} canAdmin={canAdmin} />}
      {tab === 'holidays'      && <HolidayCalendar user={user} canAdmin={canAdmin} />}
      {tab === 'my-loans'      && <LoansAdvance user={user} canAdmin={canAdmin} />}
      {tab === 'employees'     && <EmployeesAdmin />}
      {tab === 'payroll-runs'  && <PayrollRuns user={user} />}
      {tab === 'payroll'       && <PayrollAdmin />}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// MY PROFILE
// ═══════════════════════════════════════════════════════════════════════════════
function MyProfile() {
  const [emp, setEmp]     = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api('/employees/me').then(r => { if (r.success) setEmp(r.data); setLoading(false) })
  }, [])

  if (loading) return <Spinner />
  if (!emp) return (
    <div style={S.empty}>
      No employee record linked to your login.<br />
      <span style={{ fontSize: 12, color: '#a0a0a6' }}>Ask HR Admin to link your employee profile.</span>
    </div>
  )

  const Row = ({ label, value, mask }) => (
    <div style={S.profileRow}>
      <span style={S.profileLabel}>{label}</span>
      <span style={S.profileValue}>{mask ? maskField(value) : (value || '—')}</span>
    </div>
  )

  return (
    <div style={S.card}>
      <div style={{ display: 'flex', gap: 20, alignItems: 'center', marginBottom: 24, paddingBottom: 20, borderBottom: '1px solid #e7e6df' }}>
        <div style={S.avatar}>{(emp.name || '?').charAt(0).toUpperCase()}</div>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#1b1b1d' }}>{emp.name}</div>
          <div style={{ fontSize: 13, color: '#a0a0a6', marginTop: 2 }}>{emp.designation || '—'} · {emp.deptName || '—'}</div>
          {emp.employee_code && <div style={{ fontFamily: 'monospace', fontSize: 11, color: '#8a8a90', marginTop: 4, background: '#f6f5f0', display: 'inline-block', padding: '2px 8px', borderRadius: 4 }}>{emp.employee_code}</div>}
        </div>
      </div>

      <div style={S.grid3}>
        <div>
          <div style={S.sectionLabel}>Personal</div>
          <Row label="Date of Birth"  value={fmt.date(emp.dob)} />
          <Row label="Gender"         value={emp.gender} />
          <Row label="Mobile"         value={emp.mobile} />
          <Row label="Email"          value={emp.email} />
          <Row label="Aadhaar"        value={emp.aadhar}       mask />
          <Row label="PAN"            value={emp.pan}          mask />
        </div>
        <div>
          <div style={S.sectionLabel}>Employment</div>
          <Row label="Date of Joining"    value={fmt.date(emp.doj)} />
          <Row label="Department"         value={emp.deptName} />
          <Row label="Designation"        value={emp.designation} />
          <Row label="Employment Type"    value={emp.employment_type || 'Permanent'} />
          <Row label="Grade"              value={emp.grade || '—'} />
        </div>
        <div>
          <div style={S.sectionLabel}>Banking & Statutory</div>
          <Row label="Bank Account"  value={emp.bank_account}  mask />
          <Row label="Bank Name"     value={emp.bank_name} />
          <Row label="IFSC"          value={emp.ifsc} />
          <Row label="PF Number"     value={emp.pf_number || '—'} />
          <Row label="ESIC Number"   value={emp.esic_number || '—'} />
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// MY ATTENDANCE
// ═══════════════════════════════════════════════════════════════════════════════
function MyAttendance() {
  const now = new Date()
  const [month, setMonth] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`)
  const [records, setRecords] = useState([])
  const [summary, setSummary] = useState({})
  const [loading, setLoading] = useState(true)

  const load = useCallback(() => {
    setLoading(true)
    api(`/attendance/me?month=${month}`).then(r => {
      if (r.success) { setRecords(r.data); setSummary(r.summary || {}) }
      setLoading(false)
    })
  }, [month])

  useEffect(() => { load() }, [load])

  const kpis = [
    { label: 'Present',   value: summary['Present']  || 0, color: '#16a34a' },
    { label: 'Absent',    value: summary['Absent']   || 0, color: '#dc2626' },
    { label: 'Half Day',  value: summary['Half Day'] || 0, color: '#d97706' },
    { label: 'Leave',     value: summary['Leave']    || 0, color: '#7c3aed' },
    { label: 'OT',        value: summary['OT']       || 0, color: '#0369a1' },
    { label: 'Holiday',   value: summary['Holiday']  || 0, color: '#71717a' },
  ]

  return (
    <div>
      <div style={S.filterBar}>
        <input type="month" style={S.input} value={month} onChange={e => setMonth(e.target.value)} />
        <button style={S.btnSecondary} onClick={load}>↻</button>
      </div>

      <div style={S.kpiRow}>
        {kpis.map(k => <KPICard key={k.label} label={k.label} value={k.value} color={k.color} />)}
      </div>

      <div style={{ ...S.card, padding: 0, marginTop: 16 }}>
        {loading ? <Spinner /> : (
          <table style={S.table}>
            <thead>
              <tr style={S.thead}>
                {['Date', 'Day', 'Shift', 'In Time', 'Out Time', 'Hours', 'Status', 'Remarks'].map(h => <th key={h} style={S.th}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {records.length === 0 && <tr><td colSpan={8} style={S.empty}>No attendance records for {fmt.month(month)}</td></tr>}
              {records.map(r => {
                const d = new Date(r.date)
                const dayName = d.toLocaleDateString('en-IN', { weekday: 'short' })
                return (
                  <tr key={r.id} style={S.tr}>
                    <td style={S.td}>{fmt.date(r.date)}</td>
                    <td style={S.td}><span style={{ color: '#8a8a90', fontSize: 12 }}>{dayName}</span></td>
                    <td style={S.td}><span style={S.muted}>{r.shiftType || '—'}</span></td>
                    <td style={S.td}>{r.inTime  ? new Date(r.inTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                    <td style={S.td}>{r.outTime ? new Date(r.outTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                    <td style={S.td}>{r.hoursWorked != null ? `${Number(r.hoursWorked).toFixed(1)}h` : '—'}</td>
                    <td style={S.td}><Badge v={r.status} map={ATT_BAD} /></td>
                    <td style={S.td}><span style={S.muted}>{r.remarks || '—'}</span></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// MY LEAVES
// ═══════════════════════════════════════════════════════════════════════════════
const LEAVE_TYPE_COLOR = { CL: '#0369a1', SL: '#7c3aed', EL: '#16a34a', PL: '#16a34a', CO: '#d97706', ML: '#db2777', HL: '#71717a', LOP: '#dc2626' }

function MyLeaves() {
  const [data, setData]       = useState(null)
  const [leaveTypes, setLeaveTypes] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([api('/leaves/me'), api('/leave-types')]).then(([r, lt]) => {
      if (r.success) setData(r.data)
      if (lt.success) setLeaveTypes(lt.data)
      setLoading(false)
    })
  }, [])

  if (loading) return <Spinner />

  const counts = data?.attendanceCounts || {}
  const balances = data?.balances || []
  const ph16 = data?.ph16Ready

  const LEAVE_TYPES = leaveTypes.map(lt => ({
    code: lt.code,
    name: lt.name,
    quota: lt.annualQuota,
    description: lt.description,
    color: LEAVE_TYPE_COLOR[lt.code] || '#71717a',
  }))

  return (
    <div>
      {!ph16 && (
        <div style={{ ...S.alertBox, background: '#fef9c322', borderColor: '#fbbf24' }}>
          <strong>Ph16 leave module pending.</strong> Showing attendance-derived counts for {data?.year}. Full leave balance ledger activates after Ph16-B migration.
        </div>
      )}

      <div style={S.kpiRow}>
        <KPICard label="Present Days"  value={counts['Present']  || 0} color="#16a34a" />
        <KPICard label="Leave Days"    value={counts['Leave']    || 0} color="#7c3aed" />
        <KPICard label="Absent (LOP)"  value={counts['Absent']   || 0} color="#dc2626" />
        <KPICard label="Overtime Days" value={counts['OT']       || 0} color="#0369a1" />
        <KPICard label="Half Days"     value={counts['Half Day'] || 0} color="#d97706" />
        <KPICard label="Holidays"      value={counts['Holiday']  || 0} color="#71717a" />
      </div>

      {ph16 ? (
        <div style={{ ...S.card, marginTop: 16 }}>
          <div style={S.sectionLabel}>Leave Balances — {data.year}</div>
          <table style={S.table}>
            <thead>
              <tr style={S.thead}>
                {['Type', 'Opening', 'Credited', 'Availed', 'Encashed', 'Lapsed', 'Closing'].map(h => <th key={h} style={S.th}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {balances.map(b => (
                <tr key={b.id} style={S.tr}>
                  <td style={S.td}><strong>{b.code}</strong> — {b.leaveTypeName}</td>
                  <td style={S.td}>{b.opening_balance}</td>
                  <td style={S.td}>{b.credited}</td>
                  <td style={S.td}>{b.availed}</td>
                  <td style={S.td}>{b.encashed}</td>
                  <td style={S.td}>{b.lapsed}</td>
                  <td style={S.td}><strong style={{ color: '#16a34a' }}>{b.closing_balance}</strong></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={{ ...S.card, marginTop: 16 }}>
          <div style={S.sectionLabel}>Leave Policy — {data?.year || new Date().getFullYear()}</div>
          <table style={S.table}>
            <thead>
              <tr style={S.thead}>
                {['Code', 'Leave Type', 'Annual Quota', 'Availed (from Attendance)', 'Balance (Estimated)'].map(h => <th key={h} style={S.th}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {LEAVE_TYPES.map(lt => {
                const availed = lt.code === 'LOP' ? (counts['Absent'] || 0) : (lt.code === 'CL' || lt.code === 'SL' || lt.code === 'EL' ? Math.round((counts['Leave'] || 0) / 3) : 0)
                const balance = lt.quota != null ? Math.max(0, lt.quota - availed) : '—'
                return (
                  <tr key={lt.code} style={S.tr}>
                    <td style={S.td}><span style={{ ...S.badge, background: lt.color + '22', color: lt.color }}>{lt.code}</span></td>
                    <td style={S.td}>{lt.name}</td>
                    <td style={S.td}>{lt.quota ?? 'As earned'}</td>
                    <td style={S.td}>{availed}</td>
                    <td style={S.td}><strong>{balance}</strong></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <div style={{ fontSize: 11, color: '#a0a0a6', marginTop: 12 }}>
            * Estimated from attendance records. Exact ledger available post Ph16-B migration.
          </div>
        </div>
      )}

      <div style={{ ...S.card, marginTop: 16 }}>
        <div style={S.sectionLabel}>Leave Policy Quick Reference</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, fontSize: 12 }}>
          {LEAVE_TYPES.map(lt => (
            <div key={lt.code} style={{ background: '#f6f5f0', borderRadius: 8, padding: 12 }}>
              <div style={{ fontWeight: 700, color: '#1b1b1d', marginBottom: 4 }}>{lt.code} — {lt.name}</div>
              <div style={{ color: '#8a8a90' }}>{lt.description || (lt.quota != null ? `${lt.quota} days/year.` : 'As earned/policy-based.')}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// MY PAYSLIP
// ═══════════════════════════════════════════════════════════════════════════════
function MyPayslip() {
  const [slips, setSlips]       = useState([])
  const [emp, setEmp]           = useState(null)
  const [ytd, setYtd]           = useState(null)
  const [selected, setSelected] = useState(null)
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    api('/payroll/me').then(r => {
      if (r.success) { setSlips(r.data); setEmp(r.employee); setYtd(r.ytd); if (r.data.length) setSelected(r.data[0]) }
      setLoading(false)
    })
  }, [])

  if (loading) return <Spinner />

  return (
    <div>
      {ytd && (
        <div style={S.kpiRow}>
          <KPICard label="YTD Gross"   value={fmt.money(ytd.gross)} />
          <KPICard label="YTD Net Pay" value={fmt.money(ytd.gross - ytd.tds - ytd.pf)} color="#16a34a" />
          <KPICard label="YTD PF"      value={fmt.money(ytd.pf)}   color="#0369a1" />
          <KPICard label="YTD TDS"     value={fmt.money(ytd.tds)}  color="#d97706" />
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 16, marginTop: 16 }}>
        {/* Slip list */}
        <div style={{ ...S.card, padding: 0, height: 'fit-content' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #e7e6df', fontSize: 12, fontWeight: 700, color: '#8a8a90', textTransform: 'uppercase' }}>Pay Slips</div>
          {slips.length === 0 && <div style={{ padding: 20, fontSize: 12, color: '#a0a0a6' }}>No payslips yet. Ask HR to generate payroll.</div>}
          {slips.map(s => (
            <div key={s.id} onClick={() => setSelected(s)}
              style={{ padding: '12px 16px', cursor: 'pointer', borderBottom: '1px solid #f1efe8', background: selected?.id === s.id ? '#f6f5f0' : '#fff', transition: 'background 0.15s' }}>
              <div style={{ fontWeight: 600, fontSize: 13, color: '#1b1b1d' }}>{fmt.month(s.month)}</div>
              <div style={{ fontSize: 12, color: '#16a34a', marginTop: 2 }}>{fmt.money(s.netSalary)}</div>
              <Badge v={s.status} map={PAY_BAD} />
            </div>
          ))}
        </div>

        {/* Slip detail */}
        {selected && emp && (
          <div style={{ ...S.card }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#1b1b1d' }}>Pay Slip — {fmt.month(selected.month)}</div>
                <div style={{ fontSize: 12, color: '#a0a0a6', marginTop: 2 }}>{emp.name} · {emp.employee_code || 'No code'}</div>
              </div>
              <button style={S.btnPrimary} onClick={() => window.print()}>🖨 Print</button>
            </div>

            {/* Employee info strip */}
            <div style={{ background: '#f6f5f0', borderRadius: 8, padding: '12px 16px', fontSize: 12, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 20 }}>
              <div><span style={S.profileLabel}>PF No</span><br /><strong>{emp.pf_number || '—'}</strong></div>
              <div><span style={S.profileLabel}>Bank Account</span><br /><strong>{maskField(emp.bank_account)}</strong></div>
              <div><span style={S.profileLabel}>Bank</span><br /><strong>{emp.bank_name || '—'}</strong></div>
            </div>

            {/* Attendance strip */}
            <div style={{ background: '#f6f5f0', borderRadius: 8, padding: '12px 16px', fontSize: 12, display: 'flex', gap: 24, marginBottom: 20 }}>
              <div><span style={S.profileLabel}>Working Days</span><br /><strong>26</strong></div>
              <div><span style={S.profileLabel}>Present Days</span><br /><strong style={{ color: '#16a34a' }}>{selected.presentDays}</strong></div>
              <div><span style={S.profileLabel}>LOP Days</span><br /><strong style={{ color: '#dc2626' }}>{26 - (selected.presentDays || 0)}</strong></div>
            </div>

            {/* Earnings / Deductions */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
              <div>
                <div style={{ fontWeight: 700, color: '#1b1b1d', marginBottom: 10, paddingBottom: 6, borderBottom: '2px solid #1b1b1d', fontSize: 13 }}>EARNINGS</div>
                <SlipRow label="Basic Salary"        value={selected.basicSalary} />
                <SlipRow label="Allowances (HRA+DA+Conv)" value={selected.allowances} />
                <SlipRow label="Overtime"            value={0} muted />
                <div style={{ borderTop: '1px solid #e7e6df', marginTop: 8, paddingTop: 8, display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
                  <span>Gross Earnings</span>
                  <span style={{ color: '#16a34a' }}>{fmt.money(selected.grossSalary || (parseFloat(selected.basicSalary || 0) + parseFloat(selected.allowances || 0)))}</span>
                </div>
              </div>
              <div>
                <div style={{ fontWeight: 700, color: '#1b1b1d', marginBottom: 10, paddingBottom: 6, borderBottom: '2px solid #dc2626', fontSize: 13 }}>DEDUCTIONS</div>
                <SlipRow label="PF (Employee 12%)"   value={selected.pfEmployee} color="#dc2626" />
                <SlipRow label="Professional Tax"    value={selected.pt}         color="#dc2626" />
                <SlipRow label="TDS (Income Tax)"    value={selected.tdsAmount}  color="#dc2626" />
                <div style={{ borderTop: '1px solid #e7e6df', marginTop: 8, paddingTop: 8, display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
                  <span>Total Deductions</span>
                  <span style={{ color: '#dc2626' }}>{fmt.money(selected.deductions)}</span>
                </div>
              </div>
            </div>

            {/* Net Pay */}
            <div style={{ background: '#1b1b1d', color: '#fff', borderRadius: 10, padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 12, color: '#a0a0a6' }}>NET PAY</div>
                <div style={{ fontSize: 28, fontWeight: 700, color: '#4ade80', letterSpacing: -1 }}>{fmt.money(selected.netSalary)}</div>
              </div>
              <div style={{ fontSize: 12, color: '#a0a0a6', textAlign: 'right' }}>
                {selected.status === 'Paid'
                  ? <><span style={{ color: '#4ade80', fontWeight: 600 }}>✓ Paid</span><br />{fmt.date(selected.paidDate)}</>
                  : <span style={{ color: '#fbbf24' }}>⏳ Pending</span>}
              </div>
            </div>

            {/* TDS Note + Form 16 download */}
            <div style={{ ...S.alertBox, marginTop: 12 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:10 }}>
                <div>
                  <strong>TDS / Form 16:</strong> Annual TDS certificate (Form 16) available after financial year close.
                  YTD TDS deducted: <strong>{fmt.money(ytd?.tds || selected.tdsAmount)}</strong>.
                </div>
                {emp?.id && (() => {
                  const currentYear  = new Date().getFullYear()
                  const currentMonth = new Date().getMonth() + 1
                  // FY ends March; if Jan-Mar we're still in prev FY for Form 16
                  const fyYear = currentMonth <= 3 ? currentYear : currentYear + 1
                  return (
                    <a
                      href={`${import.meta.env.VITE_API_URL || ''}/api/hr/form16/${emp.id}/${fyYear}`}
                      target="_blank"
                      rel="noreferrer"
                      style={{ background:'#1b1b1d', color:'#f4c84b', borderRadius:6, padding:'6px 14px', fontSize:12, fontWeight:700, textDecoration:'none', whiteSpace:'nowrap' }}
                    >
                      ↓ Form 16 FY {fyYear-1}–{fyYear}
                    </a>
                  )
                })()}
              </div>
            </div>

            {/* Employer contribution */}
            <div style={{ fontSize: 12, color: '#8a8a90', marginTop: 12 }}>
              <strong>Employer Contributions:</strong> PF (Employer 12%) — {fmt.money(selected.pfEmployee)} · ESI — ₹0.00 (if gross &gt; ₹21,000)
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

const SlipRow = ({ label, value, muted, color }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: 13, color: muted ? '#a0a0a6' : '#1b1b1d', borderBottom: '1px solid #f6f5f0' }}>
    <span>{label}</span>
    <span style={{ color: color || '#1b1b1d', fontWeight: 500 }}>{fmt.money(value || 0)}</span>
  </div>
)

// ═══════════════════════════════════════════════════════════════════════════════
// TEAM ATTENDANCE (L2+)
// ═══════════════════════════════════════════════════════════════════════════════
function TeamAttendance({ user, canAdmin }) {
  const today = new Date().toISOString().slice(0, 10)
  const [attDate, setAttDate]   = useState(today)
  const [att, setAtt]           = useState([])
  const [summary, setSummary]   = useState(null)
  const [loading, setLoading]   = useState(true)

  const load = useCallback(() => {
    setLoading(true)
    Promise.all([
      fetch(`/api/hr/attendance?date=${attDate}&limit=200`, { headers: { Authorization: `Bearer ${localStorage.getItem('mk_token')}` } }).then(r => r.json()),
      fetch(`/api/hr/attendance/summary?date=${attDate}`,   { headers: { Authorization: `Bearer ${localStorage.getItem('mk_token')}` } }).then(r => r.json()),
    ]).then(([r, s]) => {
      if (r.success) setAtt(r.data)
      if (s.success) setSummary(s.data)
      setLoading(false)
    })
  }, [attDate])

  useEffect(() => { load() }, [load])

  const markAtt = async (emp_id, status) => {
    await fetch('/api/hr/attendance', { method: 'POST', headers: { Authorization: `Bearer ${localStorage.getItem('mk_token')}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ employee_id: emp_id, date: attDate, status }) })
    load()
  }

  return (
    <div>
      <div style={S.filterBar}>
        <input type="date" style={S.input} value={attDate} onChange={e => setAttDate(e.target.value)} />
        <button style={S.btnSecondary} onClick={load}>↻</button>
        {summary && (
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {summary.byStatus?.map(s => (
              <span key={s.status} style={{ ...S.badge, ...ATT_BAD[s.status], fontSize: 12, padding: '4px 10px' }}>{s.status}: {s.count}</span>
            ))}
            <span style={S.muted}>Total active: {summary.totalActive}</span>
          </div>
        )}
      </div>
      <div style={{ ...S.card, padding: 0 }}>
        {loading ? <Spinner /> : (
          <table style={S.table}>
            <thead>
              <tr style={S.thead}>
                {['Code', 'Employee', 'Dept', 'In', 'Out', 'Hours', 'Status'].map(h => <th key={h} style={S.th}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {att.length === 0 && <tr><td colSpan={7} style={S.empty}>No records for {fmt.date(attDate)}</td></tr>}
              {att.map(a => (
                <tr key={a.id} style={S.tr}>
                  <td style={S.td}><span style={S.code}>{a.employeeCode || '—'}</span></td>
                  <td style={S.td}><strong>{a.employeeName}</strong></td>
                  <td style={S.td}><span style={S.muted}>{a.deptName || '—'}</span></td>
                  <td style={S.td}><span style={S.muted}>{a.inTime?.slice(11, 16) || '—'}</span></td>
                  <td style={S.td}><span style={S.muted}>{a.outTime?.slice(11, 16) || '—'}</span></td>
                  <td style={S.td}><span style={S.muted}>{a.hoursWorked != null ? `${Number(a.hoursWorked).toFixed(1)}h` : '—'}</span></td>
                  <td style={S.td}>
                    <select style={{ ...S.select, width: 110, fontSize: 11, padding: '3px 6px' }} value={a.status} onChange={ev => markAtt(a.employee_id, ev.target.value)}>
                      {ATT_STATUS.map(s => <option key={s}>{s}</option>)}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// EMPLOYEES ADMIN (HR Admin + Sys Admin only)
// ═══════════════════════════════════════════════════════════════════════════════
function EmployeesAdmin() {
  const [emps, setEmps]     = useState([])
  const [total, setTotal]   = useState(0)
  const [depts, setDepts]   = useState([])
  const [users, setUsers]   = useState([])
  const [search, setSearch] = useState('')
  const [page, setPage]     = useState(1)
  const [loading, setLoading] = useState(true)
  const [modal, setModal]   = useState(false)
  const [edit, setEdit]     = useState(null)
  const [form, setForm]     = useState(emptyEmp)
  const [empTab, setEmpTab] = useState('basic')
  const [saving, setSaving] = useState(false)
  const [err, setErr]       = useState('')
  const LIMIT = 30

  const load = useCallback(async () => {
    setLoading(true)
    const p = new URLSearchParams({ page, limit: LIMIT })
    if (search) p.set('search', search)
    const r = await api(`/employees?${p}`)
    if (r.success) { setEmps(r.data); setTotal(r.total) }
    setLoading(false)
  }, [page, search])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    const tok = localStorage.getItem('mk_token')
    const h = { Authorization: `Bearer ${tok}` }
    fetch('/api/users/departments', { headers: h }).then(r => r.json()).then(r => { if (r.success) setDepts(r.data) })
    fetch('/api/users', { headers: h }).then(r => r.json()).then(r => { if (r.success) setUsers(r.data) })
  }, [])

  const openAdd  = () => { setForm(emptyEmp); setErr(''); setEdit(null); setEmpTab('basic'); setModal(true); setUserSearch('') }
  const openEdit = e => { setForm({ ...emptyEmp, ...e, department_id: e.department_id || '', user_id: e.user_id || '' }); setErr(''); setEdit(e); setEmpTab('basic'); setModal(true); setUserSearch('') }
  const [userSearch, setUserSearch] = useState('')

  const save = async ev => {
    ev.preventDefault(); if (!form.name) return setErr('Name required')
    setSaving(true); setErr('')
    const r = edit
      ? await api(`/employees/${edit.id}`, { method: 'PUT', body: JSON.stringify(form) })
      : await api('/employees', { method: 'POST', body: JSON.stringify(form) })
    setSaving(false)
    if (r.success) { setModal(false); load() } else setErr(r.message)
  }

  const F = (key, label, type = 'text', ph = '') => (
    <label style={S.label}>{label}
      <input style={S.input} type={type} value={form[key] ?? ''} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} placeholder={ph} />
    </label>
  )

  const totalPages = Math.ceil(total / LIMIT)

  return (
    <div>
      <div style={S.filterBar}>
        <input style={{ ...S.input, maxWidth: 260 }} placeholder="Search name / code…" value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} />
        <button style={S.btnSecondary} onClick={load}>↻</button>
        <button style={S.btnPrimary} onClick={openAdd}>+ Add Employee</button>
        <span style={S.muted}>{total} total</span>
      </div>

      <div style={{ ...S.card, padding: 0 }}>
        {loading ? <Spinner /> : (
          <table style={S.table}>
            <thead>
              <tr style={S.thead}>
                {['Code', 'Name', 'Department', 'Designation', 'Mobile', 'DOJ', 'Basic Salary', 'Active', ''].map(h => <th key={h} style={S.th}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {emps.length === 0 && <tr><td colSpan={9} style={S.empty}>No employees</td></tr>}
              {emps.map(e => (
                <tr key={e.id} style={S.tr}>
                  <td style={S.td}><span style={S.code}>{e.employeeCode || '—'}</span></td>
                  <td style={S.td}><div style={{ fontWeight: 600 }}>{e.name}</div><div style={S.muted}>{e.email || ''}</div></td>
                  <td style={S.td}><span style={S.muted}>{e.deptName || '—'}</span></td>
                  <td style={S.td}>{e.designation || '—'}</td>
                  <td style={S.td}><span style={S.muted}>{e.mobile || '—'}</span></td>
                  <td style={S.td}><span style={S.muted}>{e.doj?.slice(0, 10) || '—'}</span></td>
                  <td style={S.td}>{e.basicSalary ? fmt.money(e.basicSalary) : '—'}</td>
                  <td style={S.td}><Badge v={e.isActive ? 'Active' : 'Inactive'} map={{ Active: { bg: '#16a34a22', color: '#16a34a' }, Inactive: { bg: '#dc262622', color: '#dc2626' } }} /></td>
                  <td style={S.td}><button style={S.btnSecondary} onClick={() => openEdit(e)}>Edit</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {totalPages > 1 && (
        <div style={S.pagination}>
          <button style={S.pgBtn} disabled={page <= 1} onClick={() => setPage(p => p - 1)}>← Prev</button>
          <span style={S.pgInfo}>Page {page} / {totalPages}</span>
          <button style={S.pgBtn} disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next →</button>
        </div>
      )}

      {modal && (
        <div style={S.overlay} onClick={() => setModal(false)}>
          <div style={{ ...S.modal, maxWidth: 660 }} onClick={e => e.stopPropagation()}>
            <div style={S.modalHeader}>
              <div style={S.modalTitle}>{edit ? `Edit: ${edit.name}` : 'Add Employee'}</div>
              <button style={S.close} onClick={() => setModal(false)}>✕</button>
            </div>
            <div style={S.tabs}>
              {[['basic', 'Basic'], ['payroll', 'Payroll & Bank'], ['docs', 'Documents']].map(([k, l]) => (
                <button key={k} style={{ ...S.tabBtn, ...(empTab === k ? S.tabActive : {}) }} onClick={() => setEmpTab(k)}>{l}</button>
              ))}
            </div>
            <form onSubmit={save} style={S.form}>
              {empTab === 'basic' && (
                <div style={S.grid2}>
                  {F('employee_code', 'Employee Code', 'text', 'EMP001')}
                  {F('name', 'Full Name *')}
                  <label style={S.label}>Department
                    <select style={S.select} value={form.department_id} onChange={e => setForm(f => ({ ...f, department_id: e.target.value }))}>
                      <option value="">Select…</option>{depts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                  </label>
                  {F('designation', 'Designation')}
                  <label style={S.label}>Gender
                    <select style={S.select} value={form.gender || ''} onChange={e => setForm(f => ({ ...f, gender: e.target.value }))}>
                      <option value="">Select…</option>{GENDERS.map(g => <option key={g}>{g}</option>)}
                    </select>
                  </label>
                  {F('doj', 'Date of Joining', 'date')}
                  {F('dob', 'Date of Birth', 'date')}
                  {F('mobile', 'Mobile', 'tel')}
                  {F('email', 'Email', 'email')}
                  <label style={S.label}>Link Login Account
                    <input style={{...S.input, marginBottom: 4}} placeholder='Search user...' value={userSearch} onChange={e=>setUserSearch(e.target.value)} />
                    <select style={S.select} value={form.user_id || ''} onChange={e => setForm(f => ({ ...f, user_id: e.target.value }))}>
                      <option value="">— No login linked —</option>
                      {users.filter(u => !userSearch || (u.name||'').toLowerCase().includes(userSearch.toLowerCase()) || (u.email||'').toLowerCase().includes(userSearch.toLowerCase())).map(u => <option key={u.id} value={u.id}>{u.name} ({u.employee_code || u.email})</option>)}
                    </select>
                  </label>
                  <label style={{ ...S.label, flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 22 }}>
                    <input type="checkbox" checked={form.is_active !== false} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} />
                    <span>Active</span>
                  </label>
                </div>
              )}
              {empTab === 'payroll' && (
                <div style={S.grid2}>
                  {F('basic_salary', 'Basic Salary (₹)', 'number')}
                  {F('pf_number', 'PF Number')}
                  {F('esic_number', 'ESIC Number')}
                  {F('bank_account', 'Bank Account No')}
                  {F('bank_name', 'Bank Name')}
                  {F('ifsc', 'IFSC Code')}
                </div>
              )}
              {empTab === 'docs' && (
                <div style={S.grid2}>
                  {F('aadhar', 'Aadhaar Number', 'text', '12-digit')}
                  {F('pan', 'PAN', 'text', 'ABCDE1234F')}
                </div>
              )}
              {err && <div style={S.error}>{err}</div>}
              <div style={S.modalFooter}>
                <button type="button" style={S.btnSecondary} onClick={() => setModal(false)}>Cancel</button>
                <button type="submit" style={S.btnPrimary} disabled={saving}>{saving ? 'Saving…' : (edit ? 'Save Changes' : 'Add Employee')}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// PAYROLL ADMIN (HR Admin + Sys Admin only)
// ═══════════════════════════════════════════════════════════════════════════════
function PayrollAdmin() {
  const now = new Date()
  const [month, setMonth]   = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`)
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [payingId, setPayingId]     = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    const r = await api(`/payroll?month=${month}`)
    if (r.success) setRecords(r.data)
    setLoading(false)
  }, [month])

  useEffect(() => { load() }, [load])

  const generate = async () => {
    setGenerating(true)
    const r = await api('/payroll/generate', { method: 'POST', body: JSON.stringify({ month }) })
    setGenerating(false)
    if (r.success) load(); else alert(r.message || 'Error generating payroll')
  }

  const markPaid = async id => {
    setPayingId(id)
    const r = await api(`/payroll/${id}/pay`, { method: 'PUT' })
    setPayingId(null)
    if (r.success) load(); else alert(r.message || 'Error')
  }

  const totals = records.reduce((a, r) => ({
    gross: a.gross + parseFloat(r.basicSalary || 0) + parseFloat(r.allowances || 0),
    deduct: a.deduct + parseFloat(r.deductions || 0),
    net: a.net + parseFloat(r.netSalary || 0),
  }), { gross: 0, deduct: 0, net: 0 })

  return (
    <div>
      <div style={S.filterBar}>
        <input type="month" style={S.input} value={month} onChange={e => setMonth(e.target.value)} />
        <button style={S.btnPrimary} onClick={generate} disabled={generating}>
          {generating ? 'Calculating…' : '🧮 Calculate Payroll'}
        </button>
        <button style={S.btnSecondary} onClick={load}>↻</button>
      </div>

      {records.length > 0 && (
        <div style={S.kpiRow}>
          <KPICard label="Employees" value={records.length} />
          <KPICard label="Total Gross"   value={fmt.money(totals.gross)}  />
          <KPICard label="Deductions"    value={fmt.money(totals.deduct)} color="#dc2626" />
          <KPICard label="Net Payout"    value={fmt.money(totals.net)}    color="#16a34a" />
          <KPICard label="Paid"   value={records.filter(r => r.status === 'Paid').length} color="#16a34a" />
          <KPICard label="Draft"  value={records.filter(r => r.status === 'Draft').length} color="#d97706" />
        </div>
      )}

      <div style={{ ...S.card, padding: 0, marginTop: 16 }}>
        {loading ? <Spinner /> : (
          <table style={S.table}>
            <thead>
              <tr style={S.thead}>
                {['Code', 'Employee', 'Dept', 'Present Days', 'Basic', 'Allowances', 'Deductions', 'Net Pay', 'Status', ''].map(h => <th key={h} style={S.th}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {records.length === 0 && (
                <tr><td colSpan={10} style={S.empty}>No payroll for {fmt.month(month)}. Click Calculate to generate.</td></tr>
              )}
              {records.map(r => (
                <tr key={r.id} style={S.tr}>
                  <td style={S.td}><span style={S.code}>{r.employeeCode}</span></td>
                  <td style={S.td}><strong>{r.employeeName}</strong></td>
                  <td style={S.td}><span style={S.muted}>{r.deptName}</span></td>
                  <td style={S.td}>{r.presentDays} days</td>
                  <td style={S.td}>{fmt.money(r.basicSalary)}</td>
                  <td style={S.td}>{fmt.money(r.allowances)}</td>
                  <td style={S.td}>{fmt.money(r.deductions)}</td>
                  <td style={S.td}><strong style={{ color: '#16a34a' }}>{fmt.money(r.netSalary)}</strong></td>
                  <td style={S.td}><Badge v={r.status} map={PAY_BAD} /></td>
                  <td style={S.td}>
                    {r.status === 'Draft'
                      ? <button style={{ ...S.btnPrimary, background: '#16a34a', padding: '4px 10px', fontSize: 11 }} onClick={() => markPaid(r.id)} disabled={payingId === r.id}>{payingId === r.id ? '…' : '✓ Mark Paid'}</button>
                      : <span style={S.muted}>{fmt.date(r.paidDate)}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// APPLY LEAVE
// ═══════════════════════════════════════════════════════════════════════════════
const LV_BAD = {
  Pending:   { bg:'#d9770622', color:'#d97706' },
  Approved:  { bg:'#16a34a22', color:'#16a34a' },
  Rejected:  { bg:'#dc262622', color:'#dc2626' },
  Cancelled: { bg:'#71717a22', color:'#71717a' },
}

function ApplyLeave({ user }) {
  const [types, setTypes]   = useState([])
  const [apps, setApps]     = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm]     = useState({ leave_type_id:'', from_date:'', to_date:'', days:'', half_day:false, reason:'' })
  const [saving, setSaving] = useState(false)
  const [err, setErr]       = useState('')
  const [msg, setMsg]       = useState('')

  const load = useCallback(async () => {
    const [t, a] = await Promise.all([api('/leave-types'), api('/leaves/my-applications')])
    if (t.success) setTypes(t.data)
    if (a.success) setApps(a.data)
    setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  const calcDays = (from, to) => {
    if (!from || !to) return ''
    const d = Math.round((new Date(to) - new Date(from)) / 86400000) + 1
    return d > 0 ? String(d) : ''
  }

  const apply = async e => {
    e.preventDefault(); setErr(''); setMsg('')
    if (!form.leave_type_id || !form.from_date || !form.to_date || !form.days)
      return setErr('All fields required')
    setSaving(true)
    const r = await api('/leaves/apply', { method:'POST', body: JSON.stringify(form) })
    setSaving(false)
    if (r.success) { setMsg('Leave applied successfully'); setForm({ leave_type_id:'', from_date:'', to_date:'', days:'', half_day:false, reason:'' }); load() }
    else setErr(r.message || 'Error')
  }

  const cancel = async id => {
    if (!window.confirm('Cancel this leave application?')) return
    const r = await api(`/leaves/${id}/cancel`, { method:'PUT' })
    if (r.success) load(); else alert(r.message)
  }

  if (loading) return <Spinner />
  return (
    <div style={{ display:'grid', gridTemplateColumns:'360px 1fr', gap:16, alignItems:'start' }}>
      {/* Apply form */}
      <div style={S.card}>
        <div style={S.sectionLabel}>New Leave Application</div>
        <form onSubmit={apply} style={{ display:'flex', flexDirection:'column', gap:12 }}>
          <label style={S.label}>Leave Type
            <select style={S.select} value={form.leave_type_id} onChange={e => setForm(f=>({...f,leave_type_id:e.target.value}))}>
              <option value="">Select…</option>
              {types.map(t => <option key={t.id} value={t.id}>{t.code} — {t.name}{t.annual_quota ? ` (${t.annual_quota} days/yr)` : ''}</option>)}
            </select>
          </label>
          <div style={S.grid2}>
            <label style={S.label}>From Date
              <input style={S.input} type="date" value={form.from_date} onChange={e => {
                const from = e.target.value
                setForm(f => ({ ...f, from_date:from, days: calcDays(from, f.to_date) }))
              }} />
            </label>
            <label style={S.label}>To Date
              <input style={S.input} type="date" value={form.to_date} onChange={e => {
                const to = e.target.value
                setForm(f => ({ ...f, to_date:to, days: calcDays(f.from_date, to) }))
              }} />
            </label>
          </div>
          <label style={S.label}>Days
            <input style={S.input} type="number" step="0.5" min="0.5" value={form.days} onChange={e => setForm(f=>({...f,days:e.target.value}))} placeholder="Auto-calculated" />
          </label>
          <label style={{ ...S.label, flexDirection:'row', alignItems:'center', gap:8 }}>
            <input type="checkbox" checked={form.half_day} onChange={e => setForm(f=>({...f,half_day:e.target.checked,days:e.target.checked?'0.5':calcDays(f.from_date,f.to_date)}))} />
            <span>Half Day</span>
          </label>
          <label style={S.label}>Reason
            <textarea style={{ ...S.input, minHeight:60, resize:'vertical' }} value={form.reason} onChange={e => setForm(f=>({...f,reason:e.target.value}))} />
          </label>
          {err && <div style={S.error}>{err}</div>}
          {msg && <div style={{ ...S.alertBox, background:'#f0fdf4', borderColor:'#86efac', color:'#16a34a' }}>{msg}</div>}
          <button style={S.btnPrimary} type="submit" disabled={saving}>{saving ? 'Applying…' : 'Apply Leave'}</button>
        </form>
      </div>

      {/* My applications */}
      <div style={{ ...S.card, padding:0 }}>
        <div style={{ padding:'12px 16px', borderBottom:'1px solid #e7e6df', fontSize:13, fontWeight:700 }}>My Applications</div>
        {apps.length === 0 && <div style={S.empty}>No leave applications yet</div>}
        {apps.map(a => (
          <div key={a.id} style={{ padding:'14px 16px', borderBottom:'1px solid #f1efe8' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
              <div>
                <span style={{ fontWeight:700, fontSize:13 }}>{a.leaveCode} — {a.leaveTypeName}</span>
                <span style={{ ...S.muted, marginLeft:8 }}>{fmt.date(a.fromDate)} → {fmt.date(a.toDate)} ({a.days} days)</span>
              </div>
              <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                <Badge v={a.status} map={LV_BAD} />
                {a.status === 'Pending' && <button style={{ ...S.btnSecondary, padding:'3px 10px', fontSize:11 }} onClick={()=>cancel(a.id)}>Cancel</button>}
              </div>
            </div>
            {a.reason && <div style={{ ...S.muted, marginTop:4 }}>{a.reason}</div>}
            {a.rejectionReason && <div style={{ color:'#dc2626', fontSize:12, marginTop:4 }}>Rejected: {a.rejectionReason}</div>}
            {a.balanceBefore != null && <div style={{ ...S.muted, marginTop:4 }}>Balance before: {a.balanceBefore} days</div>}
          </div>
        ))}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// TEAM LEAVES (L2+)
// ═══════════════════════════════════════════════════════════════════════════════
function TeamLeaves({ user, canAdmin }) {
  const [leaves, setLeaves]   = useState([])
  const [filter, setFilter]   = useState('Pending')
  const [loading, setLoading] = useState(true)
  const [actingId, setActingId] = useState(null)

  const load = useCallback(() => {
    setLoading(true)
    api(`/leaves/team?status=${filter}`).then(r => { if (r.success) setLeaves(r.data); setLoading(false) })
  }, [filter])
  useEffect(() => { load() }, [load])

  const act = async (id, action, reason) => {
    setActingId(id)
    const r = await api(`/leaves/${id}/${action}`, { method:'PUT', body: JSON.stringify({ reason }) })
    setActingId(null)
    if (r.success) load(); else alert(r.message)
  }

  return (
    <div>
      <div style={S.filterBar}>
        {['Pending','Approved','Rejected','All'].map(s => (
          <button key={s} style={{ ...S.btnSecondary, ...(filter===s?{background:'#1b1b1d',color:'#fff'}:{}) }} onClick={() => setFilter(s)}>{s}</button>
        ))}
        <button style={S.btnSecondary} onClick={load}>↻</button>
      </div>
      <div style={{ ...S.card, padding:0 }}>
        {loading ? <Spinner /> : (
          <table style={S.table}>
            <thead><tr style={S.thead}>
              {['Employee','Dept','Type','From','To','Days','Applied On','Status','Actions'].map(h => <th key={h} style={S.th}>{h}</th>)}
            </tr></thead>
            <tbody>
              {leaves.length===0 && <tr><td colSpan={9} style={S.empty}>No {filter.toLowerCase()} leaves</td></tr>}
              {leaves.map(l => (
                <tr key={l.id} style={S.tr}>
                  <td style={S.td}><strong>{l.employeeName}</strong><div style={S.muted}>{l.employeeCode}</div></td>
                  <td style={S.td}><span style={S.muted}>{l.deptName}</span></td>
                  <td style={S.td}><span style={{ ...S.badge, background:'#7c3aed22', color:'#7c3aed' }}>{l.leaveCode}</span></td>
                  <td style={S.td}>{fmt.date(l.fromDate)}</td>
                  <td style={S.td}>{fmt.date(l.toDate)}</td>
                  <td style={S.td}><strong>{l.days}</strong></td>
                  <td style={S.td}><span style={S.muted}>{fmt.date(l.appliedOn)}</span></td>
                  <td style={S.td}><Badge v={l.status} map={LV_BAD} /></td>
                  <td style={S.td}>
                    {l.status==='Pending' && (
                      <div style={{ display:'flex', gap:6 }}>
                        <button style={{ ...S.btnPrimary, background:'#16a34a', padding:'3px 10px', fontSize:11 }}
                          disabled={actingId===l.id} onClick={() => act(l.id,'approve')}>✓ Approve</button>
                        <button style={{ ...S.btnPrimary, background:'#dc2626', padding:'3px 10px', fontSize:11 }}
                          disabled={actingId===l.id} onClick={() => { const r=window.prompt('Rejection reason:'); if(r) act(l.id,'reject',r) }}>✕ Reject</button>
                      </div>
                    )}
                    {l.rejectionReason && <span style={{ color:'#dc2626', fontSize:11 }}>{l.rejectionReason}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// PAYROLL RUNS V2 (HR Admin / L4)
// ═══════════════════════════════════════════════════════════════════════════════
const RUN_BAD = { Draft:{bg:'#d9770622',color:'#d97706'}, Processing:{bg:'#0369a122',color:'#0369a1'}, Approved:{bg:'#7c3aed22',color:'#7c3aed'}, Paid:{bg:'#16a34a22',color:'#16a34a'}, Cancelled:{bg:'#dc262622',color:'#dc2626'} }

function PayrollRuns({ user }) {
  const lvl = user?.role_level || 0
  const now = new Date()
  const [month, setMonth]       = useState(`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`)
  const [runs, setRuns]         = useState([])
  const [selected, setSelected] = useState(null)
  const [detail, setDetail]     = useState(null)
  const [loading, setLoading]   = useState(true)
  const [generating, setGenerating] = useState(false)
  const [acting, setActing]     = useState(false)

  const loadRuns = useCallback(() => {
    setLoading(true)
    api('/payroll/runs').then(r => { if (r.success) setRuns(r.data); setLoading(false) })
  }, [])
  useEffect(() => { loadRuns() }, [loadRuns])

  const loadDetail = async id => {
    setSelected(id); setDetail(null)
    const r = await api(`/payroll/runs/${id}`)
    if (r.success) setDetail(r)
  }

  const generate = async () => {
    setGenerating(true)
    const r = await api('/payroll/runs', { method:'POST', body: JSON.stringify({ month }) })
    setGenerating(false)
    if (r.success) { loadRuns(); alert(`Run generated — ${r.employees} employees, Net: ${fmt.money(r.totalNet)}`) }
    else alert(r.message || 'Error')
  }

  const approve = async id => {
    if (!window.confirm('Approve this payroll run?')) return
    setActing(true)
    const r = await api(`/payroll/runs/${id}/approve`, { method:'PUT' })
    setActing(false)
    if (r.success) { loadRuns(); if (selected===id) loadDetail(id) }
    else alert(r.message)
  }

  const pay = async id => {
    if (!window.confirm('Mark entire payroll run as PAID?')) return
    setActing(true)
    const r = await api(`/payroll/runs/${id}/pay`, { method:'PUT' })
    setActing(false)
    if (r.success) { loadRuns(); if (selected===id) loadDetail(id) }
    else alert(r.message)
  }

  return (
    <div>
      <div style={S.filterBar}>
        <input type="month" style={S.input} value={month} onChange={e => setMonth(e.target.value)} />
        <button style={S.btnPrimary} onClick={generate} disabled={generating}>{generating ? 'Generating…' : '🧮 Generate Run'}</button>
        <button style={S.btnSecondary} onClick={loadRuns}>↻</button>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'280px 1fr', gap:16, alignItems:'start' }}>
        {/* Runs list */}
        <div style={{ ...S.card, padding:0 }}>
          <div style={{ padding:'10px 14px', borderBottom:'1px solid #e7e6df', fontSize:12, fontWeight:700, color:'#8a8a90', textTransform:'uppercase' }}>Payroll Runs</div>
          {loading ? <Spinner /> : runs.length===0 ? <div style={S.empty}>No runs</div> : runs.map(r => (
            <div key={r.id} onClick={() => loadDetail(r.id)}
              style={{ padding:'12px 14px', cursor:'pointer', borderBottom:'1px solid #f1efe8', background: selected===r.id ? '#f6f5f0':'#fff' }}>
              <div style={{ display:'flex', justifyContent:'space-between' }}>
                <span style={{ fontWeight:700, fontSize:13 }}>{fmt.month(r.month?.slice(0,7))}</span>
                <Badge v={r.status} map={RUN_BAD} />
              </div>
              <div style={{ ...S.muted, marginTop:4 }}>{r.totalEmployees} emp · Net {fmt.money(r.totalNet)}</div>
            </div>
          ))}
        </div>

        {/* Run detail */}
        {detail ? (
          <div>
            <div style={{ ...S.kpiRow, marginBottom:12 }}>
              <KPICard label="Employees"   value={detail.run.total_employees} />
              <KPICard label="Gross"       value={fmt.money(detail.run.total_gross)} />
              <KPICard label="Deductions"  value={fmt.money(detail.run.total_deductions)} color="#dc2626" />
              <KPICard label="Net Payout"  value={fmt.money(detail.run.total_net)} color="#16a34a" />
            </div>
            <div style={{ display:'flex', gap:10, marginBottom:12 }}>
              <Badge v={detail.run.status} map={RUN_BAD} />
              {detail.run.status==='Draft' && lvl>=4 &&
                <button style={{ ...S.btnPrimary, background:'#7c3aed' }} disabled={acting} onClick={()=>approve(detail.run.id)}>✓ Approve Run</button>}
              {detail.run.status==='Approved' && lvl>=3 &&
                <button style={{ ...S.btnPrimary, background:'#16a34a' }} disabled={acting} onClick={()=>pay(detail.run.id)}>💳 Mark All Paid</button>}
              <span style={S.muted}>Generated by {detail.run.generatedBy}</span>
            </div>
            <div style={{ ...S.card, padding:0 }}>
              <table style={S.table}>
                <thead><tr style={S.thead}>
                  {['Code','Name','Dept','Present','LOP','Gross','PF','PT','TDS','Net','Status'].map(h=><th key={h} style={S.th}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {detail.data.map(d => (
                    <tr key={d.id} style={S.tr}>
                      <td style={S.td}><span style={S.code}>{d.employeeCode}</span></td>
                      <td style={S.td}><strong>{d.employeeName}</strong></td>
                      <td style={S.td}><span style={S.muted}>{d.deptName}</span></td>
                      <td style={S.td}>{d.present_days}d</td>
                      <td style={S.td}><span style={{ color:'#dc2626' }}>{d.lop_days}d</span></td>
                      <td style={S.td}>{fmt.money(d.gross_salary)}</td>
                      <td style={S.td}>{fmt.money(d.pf_employee)}</td>
                      <td style={S.td}>{fmt.money(d.professional_tax)}</td>
                      <td style={S.td}>{fmt.money(d.tds)}</td>
                      <td style={S.td}><strong style={{ color:'#16a34a' }}>{fmt.money(d.net_salary)}</strong></td>
                      <td style={S.td}><Badge v={d.payment_status} map={RUN_BAD} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : <div style={{ ...S.card, ...S.empty }}>Select a run to view details</div>}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// APPRAISALS
// ═══════════════════════════════════════════════════════════════════════════════
function Appraisals({ user, canAdmin, canSupervise }) {
  const lvl = user?.role_level || 0
  const [cycles, setCycles]       = useState([])
  const [goals, setGoals]         = useState([])
  const [competencies, setComps]  = useState([])
  const [cycleId, setCycleId]     = useState('')
  const [loading, setLoading]     = useState(true)
  const [ratingId, setRatingId]   = useState(null)
  const [selfRating, setSelfRating] = useState('')
  const [compRatingId, setCompRatingId] = useState(null)
  const [compRating, setCompRating]     = useState('')

  useEffect(() => {
    api('/appraisals/cycles').then(r => { if (r.success) { setCycles(r.data); if (r.data.length) setCycleId(String(r.data[0].id)) }; setLoading(false) })
  }, [])

  useEffect(() => {
    if (!cycleId) return
    api(`/appraisals/goals?cycle_id=${cycleId}`).then(r => { if (r.success) setGoals(r.data) })
    api(`/appraisals/competencies?cycle_id=${cycleId}`).then(r => { if (r.success) setComps(r.data) })
  }, [cycleId])

  const submitSelfRating = async (goalId) => {
    if (!selfRating) return alert('Enter rating 1.0–5.0')
    const r = await api(`/appraisals/goals/${goalId}/self-rate`, { method:'PUT', body: JSON.stringify({ self_rating: selfRating }) })
    if (r.success) { setRatingId(null); setSelfRating(''); api(`/appraisals/goals?cycle_id=${cycleId}`).then(r2 => { if (r2.success) setGoals(r2.data) }) }
    else alert(r.message)
  }

  const submitCompRating = async (compId) => {
    if (!compRating) return alert('Enter rating 1.0–5.0')
    const r = await api(`/appraisals/competencies/${compId}/self-rate`, { method:'PUT', body: JSON.stringify({ self_rating: compRating }) })
    if (r.success) { setCompRatingId(null); setCompRating(''); api(`/appraisals/competencies?cycle_id=${cycleId}`).then(r2 => { if (r2.success) setComps(r2.data) }) }
    else alert(r.message)
  }

  if (loading) return <Spinner />

  return (
    <div>
      <div style={S.filterBar}>
        <select style={{ ...S.select, maxWidth:260 }} value={cycleId} onChange={e => setCycleId(e.target.value)}>
          <option value="">Select cycle…</option>
          {cycles.map(c => <option key={c.id} value={c.id}>{c.name} ({c.year})</option>)}
        </select>
      </div>
      {cycles.length===0 && <div style={{ ...S.card, ...S.empty }}>No appraisal cycles created yet. HR Admin can create cycles.</div>}
      {cycleId && goals.length===0 && <div style={{ ...S.card, ...S.empty }}>No goals set for this cycle. Ask your manager to assign goals.</div>}
      {goals.map(g => (
        <div key={g.id} style={{ ...S.card, marginBottom:12 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
            <div>
              <div style={{ fontWeight:700, fontSize:14 }}>{g.goal_title}</div>
              {g.description && <div style={{ ...S.muted, marginTop:4 }}>{g.description}</div>}
              {g.kpi_target && <div style={{ fontSize:12, marginTop:4 }}>Target: <strong>{g.kpi_target}</strong>{g.kpi_actual ? ` → Actual: ${g.kpi_actual}` : ''}</div>}
            </div>
            <span style={{ ...S.muted, fontSize:11 }}>Weight: {g.weightage}%</span>
          </div>
          <div style={{ display:'flex', gap:24, marginTop:12, fontSize:13 }}>
            <div>Self: <strong style={{ color: g.self_rating ? '#7c3aed' : '#a0a0a6' }}>{g.self_rating ?? '—'}</strong> / 5</div>
            <div>Manager: <strong style={{ color: g.manager_rating ? '#0369a1' : '#a0a0a6' }}>{g.manager_rating ?? '—'}</strong> / 5</div>
            <div>Final: <strong style={{ color: g.final_rating ? '#16a34a' : '#a0a0a6' }}>{g.final_rating ?? '—'}</strong> / 5</div>
          </div>
          {!g.self_rating && (
            ratingId===g.id ? (
              <div style={{ display:'flex', gap:8, marginTop:10 }}>
                <input style={{ ...S.input, width:80 }} type="number" step="0.5" min="1" max="5" placeholder="1–5" value={selfRating} onChange={e => setSelfRating(e.target.value)} />
                <button style={S.btnPrimary} onClick={() => submitSelfRating(g.id)}>Submit</button>
                <button style={S.btnSecondary} onClick={() => setRatingId(null)}>Cancel</button>
              </div>
            ) : (
              <button style={{ ...S.btnSecondary, marginTop:10, fontSize:12 }} onClick={() => setRatingId(g.id)}>+ Self Rate</button>
            )
          )}
        </div>
      ))}

      {competencies.length > 0 && (
        <div style={{ marginTop:24 }}>
          <div style={S.sectionLabel}>Behavioural Competencies</div>
          {competencies.map(c => (
            <div key={c.id} style={{ ...S.card, marginBottom:10 }}>
              <div style={{ fontWeight:700, fontSize:14 }}>{c.competency}</div>
              <div style={{ display:'flex', gap:24, marginTop:10, fontSize:13 }}>
                <div>Self: <strong style={{ color: c.selfRating ? '#7c3aed' : '#a0a0a6' }}>{c.selfRating ?? '—'}</strong> / 5</div>
                <div>Manager: <strong style={{ color: c.managerRating ? '#0369a1' : '#a0a0a6' }}>{c.managerRating ?? '—'}</strong> / 5</div>
              </div>
              {c.comments && <div style={{ ...S.muted, marginTop:6 }}>{c.comments}</div>}
              {!c.selfRating && (
                compRatingId===c.id ? (
                  <div style={{ display:'flex', gap:8, marginTop:10 }}>
                    <input style={{ ...S.input, width:80 }} type="number" step="0.5" min="1" max="5" placeholder="1–5" value={compRating} onChange={e => setCompRating(e.target.value)} />
                    <button style={S.btnPrimary} onClick={() => submitCompRating(c.id)}>Submit</button>
                    <button style={S.btnSecondary} onClick={() => setCompRatingId(null)}>Cancel</button>
                  </div>
                ) : (
                  <button style={{ ...S.btnSecondary, marginTop:10, fontSize:12 }} onClick={() => setCompRatingId(c.id)}>+ Self Rate</button>
                )
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// TRAINING
// ═══════════════════════════════════════════════════════════════════════════════
const TRN_BAD = { Planned:{bg:'#0369a122',color:'#0369a1'}, Completed:{bg:'#16a34a22',color:'#16a34a'}, Cancelled:{bg:'#dc262622',color:'#dc2626'} }
const ATT_NOM_BAD = { Nominated:{bg:'#d9770622',color:'#d97706'}, Attended:{bg:'#16a34a22',color:'#16a34a'}, Absent:{bg:'#dc262622',color:'#dc2626'}, Cancelled:{bg:'#71717a22',color:'#71717a'} }

function Training({ user, canAdmin, canSupervise }) {
  const lvl = user?.role_level || 0
  const [programs, setPrograms] = useState([])
  const [selected, setSelected] = useState(null)
  const [nominees, setNominees] = useState([])
  const [loading, setLoading]   = useState(true)
  const [modal, setModal]       = useState(false)
  const [form, setForm]         = useState({ title:'', category:'', trainer_name:'', trainer_type:'Internal', venue:'', scheduled_date:'', duration_hours:'', notes:'' })
  const [saving, setSaving]     = useState(false)

  useEffect(() => {
    api('/training').then(r => { if (r.success) setPrograms(r.data); setLoading(false) })
  }, [])

  const loadNominees = async id => {
    setSelected(id)
    const r = await api(`/training/${id}/attendance`)
    if (r.success) setNominees(r.data)
  }

  const saveProgram = async e => {
    e.preventDefault(); setSaving(true)
    const r = await api('/training', { method:'POST', body: JSON.stringify(form) })
    setSaving(false)
    if (r.success) { setModal(false); api('/training').then(r2 => { if (r2.success) setPrograms(r2.data) }) }
    else alert(r.message)
  }

  if (loading) return <Spinner />

  return (
    <div>
      <div style={S.filterBar}>
        <span style={S.muted}>{programs.length} programs</span>
        {canAdmin && <button style={S.btnPrimary} onClick={() => setModal(true)}>+ New Program</button>}
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'300px 1fr', gap:16, alignItems:'start' }}>
        <div style={{ ...S.card, padding:0 }}>
          {programs.length===0 && <div style={S.empty}>No training programs</div>}
          {programs.map(p => (
            <div key={p.id} onClick={() => loadNominees(p.id)}
              style={{ padding:'12px 14px', cursor:'pointer', borderBottom:'1px solid #f1efe8', background: selected===p.id ? '#f6f5f0':'#fff' }}>
              <div style={{ display:'flex', justifyContent:'space-between' }}>
                <span style={{ fontWeight:700, fontSize:13 }}>{p.title}</span>
                <Badge v={p.status} map={TRN_BAD} />
              </div>
              <div style={{ ...S.muted, marginTop:4 }}>{p.category || '—'} · {p.trainer_type} · {fmt.date(p.scheduled_date)}</div>
              <div style={{ ...S.muted }}>{p.nomineeCount || 0} nominees · {p.duration_hours ? `${p.duration_hours}h` : '—'}</div>
            </div>
          ))}
        </div>
        {selected ? (
          <div style={{ ...S.card, padding:0 }}>
            <div style={{ padding:'10px 14px', borderBottom:'1px solid #e7e6df', fontSize:12, fontWeight:700, color:'#8a8a90', textTransform:'uppercase' }}>Nominees</div>
            {nominees.length===0 && <div style={S.empty}>No nominees yet</div>}
            <table style={S.table}>
              <thead><tr style={S.thead}>
                {['Code','Name','Dept','Status','Attended On','Score'].map(h=><th key={h} style={S.th}>{h}</th>)}
              </tr></thead>
              <tbody>
                {nominees.map(n => (
                  <tr key={n.id} style={S.tr}>
                    <td style={S.td}><span style={S.code}>{n.employeeCode}</span></td>
                    <td style={S.td}><strong>{n.employeeName}</strong></td>
                    <td style={S.td}><span style={S.muted}>{n.deptName}</span></td>
                    <td style={S.td}><Badge v={n.status} map={ATT_NOM_BAD} /></td>
                    <td style={S.td}><span style={S.muted}>{fmt.date(n.attended_on)}</span></td>
                    <td style={S.td}>{n.score ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <div style={{ ...S.card, ...S.empty }}>Select a program to view nominees</div>}
      </div>

      {modal && (
        <div style={S.overlay} onClick={() => setModal(false)}>
          <div style={{ ...S.modal, maxWidth:540 }} onClick={e => e.stopPropagation()}>
            <div style={S.modalHeader}><div style={S.modalTitle}>New Training Program</div><button style={S.close} onClick={() => setModal(false)}>✕</button></div>
            <form onSubmit={saveProgram} style={S.form}>
              <div style={S.grid2}>
                <label style={S.label}>Title *<input style={S.input} value={form.title} onChange={e => setForm(f=>({...f,title:e.target.value}))} /></label>
                <label style={S.label}>Category
                  <select style={S.select} value={form.category} onChange={e => setForm(f=>({...f,category:e.target.value}))}>
                    {['','Safety','Technical','Soft Skills','HR','Compliance'].map(c=><option key={c}>{c}</option>)}
                  </select>
                </label>
                <label style={S.label}>Trainer Name<input style={S.input} value={form.trainer_name} onChange={e => setForm(f=>({...f,trainer_name:e.target.value}))} /></label>
                <label style={S.label}>Trainer Type
                  <select style={S.select} value={form.trainer_type} onChange={e => setForm(f=>({...f,trainer_type:e.target.value}))}>
                    {['Internal','External','Online'].map(t=><option key={t}>{t}</option>)}
                  </select>
                </label>
                <label style={S.label}>Scheduled Date<input style={S.input} type="date" value={form.scheduled_date} onChange={e => setForm(f=>({...f,scheduled_date:e.target.value}))} /></label>
                <label style={S.label}>Duration (hours)<input style={S.input} type="number" step="0.5" value={form.duration_hours} onChange={e => setForm(f=>({...f,duration_hours:e.target.value}))} /></label>
              </div>
              <label style={S.label}>Venue<input style={S.input} value={form.venue} onChange={e => setForm(f=>({...f,venue:e.target.value}))} /></label>
              <label style={S.label}>Notes<textarea style={{ ...S.input, minHeight:50 }} value={form.notes} onChange={e => setForm(f=>({...f,notes:e.target.value}))} /></label>
              <div style={S.modalFooter}>
                <button type="button" style={S.btnSecondary} onClick={() => setModal(false)}>Cancel</button>
                <button type="submit" style={S.btnPrimary} disabled={saving}>{saving ? 'Saving…' : 'Create Program'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// MY DOCUMENTS
// ═══════════════════════════════════════════════════════════════════════════════
function MyDocuments({ user, canAdmin }) {
  const [emp, setEmp]         = useState(null)
  const [docs, setDocs]       = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal]     = useState(false)
  const [form, setForm]       = useState({ doc_type:'', doc_name:'', file_url:'', valid_from:'', valid_to:'', notes:'', is_confidential:false })
  const [fileObj, setFileObj] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving]   = useState(false)
  const [uploadStatus, setUploadStatus] = useState('')

  const loadDocs = (empId) => api(`/documents/${empId}`).then(d => { if (d.success) setDocs(d.data) })

  useEffect(() => {
    api('/employees/me').then(r => {
      if (r.success && r.data) {
        setEmp(r.data)
        loadDocs(r.data.id).finally(() => setLoading(false))
      } else setLoading(false)
    })
  }, [])

  const handleFileChange = e => {
    const f = e.target.files[0]
    if (!f) return
    setFileObj(f)
    setUploadStatus('')
    // Auto-fill doc_name from filename if blank
    if (!form.doc_name) setForm(prev => ({ ...prev, doc_name: f.name.replace(/\.[^.]+$/, '') }))
  }

  const uploadDoc = async e => {
    e.preventDefault()
    if (!form.doc_type || !form.doc_name) return alert('Document type and name required')

    let fileUrl = form.file_url
    if (fileObj) {
      setUploading(true)
      setUploadStatus('Uploading file…')
      const fd = new FormData()
      fd.append('file', fileObj)
      const token = localStorage.getItem('mk_token')
      const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/hr/upload`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: fd,
      })
      const up = await res.json().catch(() => ({ success: false }))
      setUploading(false)
      if (!up.success) { setUploadStatus('Upload failed: ' + (up.message || 'unknown')); return }
      fileUrl = up.url
      setUploadStatus(`Uploaded (${up.sizeKb} KB)`)
    }
    if (!fileUrl) return alert('Choose a file to upload')

    setSaving(true)
    const r = await api(`/documents/${emp.id}`, { method:'POST', body: JSON.stringify({ ...form, file_url: fileUrl }) })
    setSaving(false)
    if (r.success) {
      setModal(false); setFileObj(null); setUploadStatus('')
      setForm({ doc_type:'', doc_name:'', file_url:'', valid_from:'', valid_to:'', notes:'', is_confidential:false })
      loadDocs(emp.id)
    } else alert(r.message)
  }

  const DOC_TYPES = ['Offer Letter','Appointment Letter','Appraisal Letter','PF','ESIC','ID Proof','Educational Certificate','Bank Proof','Salary Revision','Other']

  if (loading) return <Spinner />
  if (!emp) return <div style={S.empty}>No employee record. Ask HR to link your account.</div>

  return (
    <div style={S.card}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
        <div style={S.sectionLabel}>My Documents</div>
        {canAdmin && <button style={S.btnPrimary} onClick={() => setModal(true)}>+ Upload</button>}
      </div>
      {docs.length===0 && <div style={S.empty}>No documents uploaded yet. Ask HR to upload your documents.</div>}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))', gap:12 }}>
        {docs.map(d => (
          <div key={d.id} style={{ background:'#f6f5f0', borderRadius:8, padding:14, border:'1px solid #e7e6df' }}>
            <div style={{ fontWeight:700, fontSize:13, marginBottom:4 }}>{d.docName}</div>
            <span style={{ ...S.badge, background:'#1b1b1d22', color:'#1b1b1d', fontSize:11 }}>{d.docType}</span>
            {d.isConfidential && <span style={{ ...S.badge, background:'#dc262622', color:'#dc2626', fontSize:10, marginLeft:4 }}>Confidential</span>}
            {(d.validFrom || d.validTo) && <div style={{ ...S.muted, marginTop:6 }}>Valid: {fmt.date(d.validFrom)} → {fmt.date(d.validTo)}</div>}
            {d.notes && <div style={{ ...S.muted, marginTop:4 }}>{d.notes}</div>}
            <div style={{ marginTop:8 }}>
              <a href={d.fileUrl} target="_blank" rel="noreferrer" style={{ color:'#0369a1', fontSize:12, textDecoration:'none' }}>↗ View / Download</a>
            </div>
          </div>
        ))}
      </div>

      {modal && (
        <div style={S.overlay} onClick={() => { setModal(false); setFileObj(null); setUploadStatus('') }}>
          <div style={{ ...S.modal, maxWidth:480 }} onClick={e => e.stopPropagation()}>
            <div style={S.modalHeader}><div style={S.modalTitle}>Upload Document</div><button style={S.close} onClick={() => { setModal(false); setFileObj(null); setUploadStatus('') }}>✕</button></div>
            <form onSubmit={uploadDoc} style={S.form}>
              <label style={S.label}>Document Type *
                <select style={S.select} value={form.doc_type} onChange={e => setForm(f=>({...f,doc_type:e.target.value}))}>
                  <option value="">Select…</option>{DOC_TYPES.map(t=><option key={t}>{t}</option>)}
                </select>
              </label>
              <label style={S.label}>Document Name *<input style={S.input} value={form.doc_name} onChange={e => setForm(f=>({...f,doc_name:e.target.value}))} placeholder="e.g. Appointment Letter 2024" /></label>
              <label style={S.label}>
                File *
                <input
                  type="file"
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.xlsx,.csv"
                  style={{ ...S.input, padding:'6px 8px', cursor:'pointer' }}
                  onChange={handleFileChange}
                />
                {uploadStatus && <span style={{ fontSize:11, color: uploadStatus.startsWith('Upload failed') ? '#dc2626' : '#16a34a', marginTop:4 }}>{uploadStatus}</span>}
              </label>
              <div style={S.grid2}>
                <label style={S.label}>Valid From<input style={S.input} type="date" value={form.valid_from} onChange={e => setForm(f=>({...f,valid_from:e.target.value}))} /></label>
                <label style={S.label}>Valid To<input style={S.input} type="date" value={form.valid_to} onChange={e => setForm(f=>({...f,valid_to:e.target.value}))} /></label>
              </div>
              <label style={S.label}>Notes<input style={S.input} value={form.notes} onChange={e => setForm(f=>({...f,notes:e.target.value}))} /></label>
              <label style={{ ...S.label, flexDirection:'row', alignItems:'center', gap:8 }}>
                <input type="checkbox" checked={form.is_confidential} onChange={e => setForm(f=>({...f,is_confidential:e.target.checked}))} />
                <span>Confidential (HR/L4 only)</span>
              </label>
              <div style={S.modalFooter}>
                <button type="button" style={S.btnSecondary} onClick={() => { setModal(false); setFileObj(null); setUploadStatus('') }}>Cancel</button>
                <button type="submit" style={S.btnPrimary} disabled={saving || uploading}>{uploading ? 'Uploading…' : saving ? 'Saving…' : 'Upload'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// ONBOARDING CHECKLIST
// ═══════════════════════════════════════════════════════════════════════════════
const OB_BAD = { Pending:{bg:'#d9770622',color:'#d97706'}, 'In Progress':{bg:'#0369a122',color:'#0369a1'}, Done:{bg:'#16a34a22',color:'#16a34a'}, NA:{bg:'#71717a22',color:'#71717a'} }

function Onboarding({ user, canAdmin }) {
  const [emp, setEmp]       = useState(null)
  const [items, setItems]   = useState([])
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(null)

  useEffect(() => {
    api('/employees/me').then(r => {
      if (r.success && r.data) {
        setEmp(r.data)
        api(`/onboarding/${r.data.id}`).then(ob => { if (ob.success) { setItems(ob.data); setSummary(ob.summary) }; setLoading(false) })
      } else setLoading(false)
    })
  }, [])

  const updateStatus = async (itemId, status) => {
    if (!emp) return
    setUpdating(itemId)
    const r = await api(`/onboarding/${emp.id}/${itemId}`, { method:'PUT', body: JSON.stringify({ status }) })
    setUpdating(null)
    if (r.success) api(`/onboarding/${emp.id}`).then(ob => { if (ob.success) { setItems(ob.data); setSummary(ob.summary) } })
  }

  if (loading) return <Spinner />
  if (!emp) return <div style={S.empty}>No employee record linked. Ask HR to link your account.</div>

  return (
    <div style={S.card}>
      {summary && (
        <div style={{ marginBottom:20 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
            <div style={S.sectionLabel}>Onboarding Progress</div>
            <span style={{ fontWeight:700, fontSize:16, color: summary.pct===100 ? '#16a34a' : '#1b1b1d' }}>{summary.pct}%</span>
          </div>
          <div style={{ height:8, background:'#e7e6df', borderRadius:99 }}>
            <div style={{ height:'100%', width:`${summary.pct}%`, background: summary.pct===100 ? '#16a34a' : '#1b1b1d', borderRadius:99, transition:'width 0.4s' }} />
          </div>
          <div style={{ ...S.kpiRow, marginTop:12 }}>
            <KPICard label="Total"   value={summary.total} />
            <KPICard label="Done"    value={summary.done}    color="#16a34a" />
            <KPICard label="Pending" value={summary.pending} color="#d97706" />
          </div>
        </div>
      )}
      {items.length===0 && <div style={S.empty}>Onboarding checklist not initialised. Ask HR to run onboarding setup.</div>}
      {items.map(it => (
        <div key={it.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 0', borderBottom:'1px solid #f6f5f0' }}>
          <div>
            <span style={{ fontSize:13, fontWeight: it.status==='Done' ? 400 : 600, textDecoration: it.status==='Done' ? 'line-through' : 'none', color: it.status==='Done' ? '#a0a0a6' : '#1b1b1d' }}>{it.taskTitle}</span>
            <div style={{ ...S.muted, marginTop:2 }}>By: {it.responsible} · Due: {fmt.date(it.dueDate)}</div>
          </div>
          <div style={{ display:'flex', gap:6, alignItems:'center' }}>
            <Badge v={it.status} map={OB_BAD} />
            {it.status !== 'Done' && (
              <select style={{ ...S.select, fontSize:11, padding:'3px 6px', width:110 }} value={it.status}
                onChange={e => updateStatus(it.id, e.target.value)} disabled={updating===it.id}>
                {['Pending','In Progress','Done','NA'].map(s=><option key={s}>{s}</option>)}
              </select>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// SEPARATION
// ═══════════════════════════════════════════════════════════════════════════════
const SEP_BAD = { Initiated:{bg:'#d9770622',color:'#d97706'}, 'Clearance Pending':{bg:'#0369a122',color:'#0369a1'}, 'FF Pending':{bg:'#7c3aed22',color:'#7c3aed'}, Completed:{bg:'#16a34a22',color:'#16a34a'}, Revoked:{bg:'#71717a22',color:'#71717a'} }
const CL_BAD  = { Pending:{bg:'#d9770622',color:'#d97706'}, Cleared:{bg:'#16a34a22',color:'#16a34a'}, Rejected:{bg:'#dc262622',color:'#dc2626'} }

function Separation({ user, canAdmin }) {
  const lvl = user?.role_level || 0
  const [seps, setSeps]       = useState([])
  const [selected, setSelected] = useState(null)
  const [clearance, setClearance] = useState([])
  const [clSummary, setClSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [modal, setModal]     = useState(false)
  const [form, setForm]       = useState({ separation_type:'Resignation', resignation_date:'', last_working_date:'', reason:'' })
  const [saving, setSaving]   = useState(false)
  const [emp, setEmp]         = useState(null)

  const load = useCallback(() => {
    api('/employees/me').then(r => { if (r.success) setEmp(r.data) })
    api('/separation').then(r => { if (r.success) setSeps(r.data); setLoading(false) })
  }, [])
  useEffect(() => { load() }, [load])

  const loadClearance = async id => {
    setSelected(id)
    const r = await api(`/separation/${id}/clearance`)
    if (r.success) { setClearance(r.data); setClSummary(r.summary) }
  }

  const submit = async e => {
    e.preventDefault(); setSaving(true)
    const r = await api('/separation', { method:'POST', body: JSON.stringify({ ...form, employee_id: emp?.id }) })
    setSaving(false)
    if (r.success) { setModal(false); load(); alert(`Separation initiated. Gratuity: ${fmt.money(r.gratuity)} (${r.serviceYears} yrs)`) }
    else alert(r.message)
  }

  const approveSep = async id => {
    if (!window.confirm('Approve separation?')) return
    const r = await api(`/separation/${id}/approve`, { method:'PUT' })
    if (r.success) load(); else alert(r.message)
  }

  const clearItem = async (sepId, itemId, status) => {
    const r = await api(`/separation/${sepId}/clearance/${itemId}`, { method:'PUT', body: JSON.stringify({ status }) })
    if (r.success) loadClearance(sepId); else alert(r.message)
  }

  if (loading) return <Spinner />

  return (
    <div>
      <div style={S.filterBar}>
        <button style={S.btnPrimary} onClick={() => setModal(true)}>+ Initiate Separation</button>
        <button style={S.btnSecondary} onClick={load}>↻</button>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'300px 1fr', gap:16, alignItems:'start' }}>
        <div style={{ ...S.card, padding:0 }}>
          {seps.length===0 && <div style={S.empty}>No separations</div>}
          {seps.map(s => (
            <div key={s.id} onClick={() => loadClearance(s.id)}
              style={{ padding:'12px 14px', cursor:'pointer', borderBottom:'1px solid #f1efe8', background: selected===s.id ? '#f6f5f0':'#fff' }}>
              <div style={{ display:'flex', justifyContent:'space-between' }}>
                <span style={{ fontWeight:700, fontSize:13 }}>{s.employeeName}</span>
                <Badge v={s.status} map={SEP_BAD} />
              </div>
              <div style={{ ...S.muted, marginTop:4 }}>{s.separation_type} · {fmt.date(s.last_working_date)}</div>
              <div style={{ ...S.muted }}>Gratuity: {fmt.money(s.gratuity_amount)} · {s.service_years}yr service</div>
              {canAdmin && s.status==='Initiated' && (
                <button style={{ ...S.btnPrimary, background:'#7c3aed', padding:'3px 10px', fontSize:11, marginTop:6 }} onClick={e => { e.stopPropagation(); approveSep(s.id) }}>✓ Approve</button>
              )}
            </div>
          ))}
        </div>

        {selected ? (
          <div style={{ ...S.card, padding:0 }}>
            {clSummary && (
              <div style={{ padding:'12px 16px', borderBottom:'1px solid #e7e6df', display:'flex', gap:16, alignItems:'center' }}>
                <span style={S.sectionLabel}>Clearance Checklist</span>
                <span style={{ fontSize:13 }}>{clSummary.cleared} / {clSummary.total} cleared</span>
              </div>
            )}
            {clearance.length===0 && <div style={S.empty}>No clearance items</div>}
            {clearance.map(c => (
              <div key={c.id} style={{ padding:'10px 16px', borderBottom:'1px solid #f1efe8', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <div>
                  <div style={{ fontSize:13, fontWeight:600 }}>{c.dept_name}</div>
                  <div style={S.muted}>{c.item_description}</div>
                </div>
                <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                  <Badge v={c.status} map={CL_BAD} />
                  {c.status==='Pending' && lvl >= 2 && (
                    <button style={{ ...S.btnPrimary, background:'#16a34a', padding:'3px 8px', fontSize:11 }}
                      onClick={() => clearItem(selected, c.id, 'Cleared')}>✓ Clear</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : <div style={{ ...S.card, ...S.empty }}>Select a separation to view clearance</div>}
      </div>

      {modal && (
        <div style={S.overlay} onClick={() => setModal(false)}>
          <div style={{ ...S.modal, maxWidth:460 }} onClick={e => e.stopPropagation()}>
            <div style={S.modalHeader}><div style={S.modalTitle}>Initiate Separation</div><button style={S.close} onClick={() => setModal(false)}>✕</button></div>
            <form onSubmit={submit} style={S.form}>
              <label style={S.label}>Type
                <select style={S.select} value={form.separation_type} onChange={e => setForm(f=>({...f,separation_type:e.target.value}))}>
                  {['Resignation','Retirement','Contract End'].map(t=><option key={t}>{t}</option>)}
                </select>
              </label>
              <div style={S.grid2}>
                <label style={S.label}>Resignation Date<input style={S.input} type="date" value={form.resignation_date} onChange={e => setForm(f=>({...f,resignation_date:e.target.value}))} /></label>
                <label style={S.label}>Last Working Date<input style={S.input} type="date" value={form.last_working_date} onChange={e => setForm(f=>({...f,last_working_date:e.target.value}))} /></label>
              </div>
              <label style={S.label}>Reason<textarea style={{ ...S.input, minHeight:60 }} value={form.reason} onChange={e => setForm(f=>({...f,reason:e.target.value}))} /></label>
              <div style={{ ...S.alertBox, background:'#fef9c322', borderColor:'#fbbf24' }}>
                Gratuity calculated automatically on submission (min 5 yrs service required).
              </div>
              <div style={S.modalFooter}>
                <button type="button" style={S.btnSecondary} onClick={() => setModal(false)}>Cancel</button>
                <button type="submit" style={S.btnPrimary} disabled={saving}>{saving ? 'Submitting…' : 'Submit'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// HOLIDAY CALENDAR
// ═══════════════════════════════════════════════════════════════════════════════
const TYPE_COLOR = { National:'#dc2626', State:'#d97706', Optional:'#0369a1', Restricted:'#7c3aed' }

function HolidayCalendar({ user, canAdmin }) {
  const lvl = user?.role_level || 0
  const canManage = canAdmin || lvl >= 3
  const [year, setYear]       = useState(new Date().getFullYear())
  const [holidays, setHols]   = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm]       = useState({ holiday_date:'', name:'', holiday_type:'National' })
  const [adding, setAdding]   = useState(false)
  const [saving, setSaving]   = useState(false)
  const [err, setErr]         = useState('')

  const load = () => {
    setLoading(true)
    api(`/holidays?year=${year}`).then(r => { if (r.success) setHols(r.data); setLoading(false) })
  }
  useEffect(load, [year])

  const save = async e => {
    e.preventDefault(); setSaving(true); setErr('')
    const r = await api('/holidays', { method:'POST', body: JSON.stringify(form) })
    if (r.success) { setAdding(false); setForm({ holiday_date:'', name:'', holiday_type:'National' }); load() }
    else setErr(r.message)
    setSaving(false)
  }

  const del = async id => {
    if (!confirm('Delete holiday?')) return
    await api(`/holidays/${id}`, { method:'DELETE' }); load()
  }

  return (
    <div>
      <div style={S.filterBar}>
        <select style={S.select} value={year} onChange={e => setYear(+e.target.value)}>
          {[2024,2025,2026,2027].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        {canManage && <button style={S.btnPrimary} onClick={() => setAdding(true)}>+ Add Holiday</button>}
      </div>

      {adding && (
        <div style={{ ...S.card, marginBottom:16 }}>
          <div style={{ fontWeight:700, marginBottom:12 }}>Add Holiday</div>
          {err && <div style={{ ...S.error, marginBottom:10 }}>{err}</div>}
          <form style={S.form} onSubmit={save}>
            <div style={S.grid3}>
              <label style={S.label}>Date<input style={S.input} type="date" required value={form.holiday_date} onChange={e => setForm(f=>({...f,holiday_date:e.target.value}))}/></label>
              <label style={S.label}>Name<input style={S.input} type="text" required placeholder="e.g. Diwali" value={form.name} onChange={e => setForm(f=>({...f,name:e.target.value}))}/></label>
              <label style={S.label}>Type
                <select style={S.select} value={form.holiday_type} onChange={e => setForm(f=>({...f,holiday_type:e.target.value}))}>
                  <option>National</option><option>State</option><option>Optional</option><option>Restricted</option>
                </select>
              </label>
            </div>
            <div style={S.modalFooter}>
              <button type="button" style={S.btnSecondary} onClick={() => setAdding(false)}>Cancel</button>
              <button type="submit" style={S.btnPrimary} disabled={saving}>{saving?'Saving…':'Save'}</button>
            </div>
          </form>
        </div>
      )}

      {loading ? <Spinner /> : (
        <div style={S.tableWrap}>
          <table style={S.table}>
            <thead style={S.thead}><tr>
              <th style={S.th}>#</th><th style={S.th}>Date</th><th style={S.th}>Holiday</th>
              <th style={S.th}>Type</th><th style={S.th}>Day</th>
              {canManage && <th style={S.th}></th>}
            </tr></thead>
            <tbody>
              {holidays.length===0 && <tr><td colSpan={6} style={{ ...S.td, ...S.empty }}>No holidays for {year}</td></tr>}
              {holidays.map((h,i) => {
                const d = new Date(h.date)
                const day = d.toLocaleDateString('en-IN',{weekday:'long'})
                return (
                  <tr key={h.id} style={{ ...S.tr, opacity: h.isActive ? 1 : 0.4 }}>
                    <td style={S.td}>{i+1}</td>
                    <td style={S.td}>{new Date(h.date).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'})}</td>
                    <td style={S.td}><strong>{h.name}</strong></td>
                    <td style={S.td}><span style={{ ...S.badge, background:(TYPE_COLOR[h.type]||'#666')+'22', color:TYPE_COLOR[h.type]||'#666' }}>{h.type}</span></td>
                    <td style={{ ...S.td, ...S.muted }}>{day}</td>
                    {canManage && <td style={S.td}><button style={{ ...S.btnSecondary, fontSize:11, padding:'3px 8px' }} onClick={() => del(h.id)}>Delete</button></td>}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// LOANS & ADVANCES
// ═══════════════════════════════════════════════════════════════════════════════
const LOAN_BAD = { active:{bg:'#16a34a22',color:'#16a34a'}, closed:{bg:'#71717a22',color:'#71717a'} }

function LoansAdvance({ user, canAdmin }) {
  const lvl = user?.role_level || 0
  const canManage = canAdmin || lvl >= 3
  const [loans, setLoans]     = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal]     = useState(null) // null | 'new' | loan obj
  const [form, setForm]       = useState({ employee_id:'', loan_type:'advance', amount:'', disbursed_date:'', monthly_emi:'', notes:'' })
  const [payAmt, setPayAmt]   = useState('')
  const [saving, setSaving]   = useState(false)
  const [err, setErr]         = useState('')

  const load = () => {
    setLoading(true)
    api('/loans').then(r => { if (r.success) setLoans(r.data); setLoading(false) })
  }
  useEffect(load, [])

  const createLoan = async e => {
    e.preventDefault(); setSaving(true); setErr('')
    const r = await api('/loans', { method:'POST', body: JSON.stringify(form) })
    if (r.success) { setModal(null); setForm({ employee_id:'', loan_type:'advance', amount:'', disbursed_date:'', monthly_emi:'', notes:'' }); load() }
    else setErr(r.message)
    setSaving(false)
  }

  const recordPayment = async id => {
    if (!payAmt) return alert('Enter payment amount')
    setSaving(true)
    const r = await api(`/loans/${id}/pay`, { method:'PUT', body: JSON.stringify({ payment_amount: payAmt }) })
    if (r.success) { setModal(null); setPayAmt(''); load() }
    else alert(r.message)
    setSaving(false)
  }

  const totalOut = loans.filter(l=>l.status==='active').reduce((s,l)=>s+parseFloat(l.outstanding||0),0)

  return (
    <div>
      <div style={{ ...S.kpiRow, marginBottom:16 }}>
        <div style={S.kpiCard}><div style={S.muted}>Active Loans/Advances</div><div style={{ fontSize:22, fontWeight:700 }}>{loans.filter(l=>l.status==='active').length}</div></div>
        <div style={S.kpiCard}><div style={S.muted}>Total Outstanding</div><div style={{ fontSize:22, fontWeight:700 }}>₹{Number(totalOut).toLocaleString('en-IN')}</div></div>
      </div>

      <div style={S.filterBar}>
        {canManage && <button style={S.btnPrimary} onClick={() => { setModal('new'); setErr('') }}>+ New Loan/Advance</button>}
      </div>

      {modal === 'new' && (
        <div style={S.overlay} onClick={() => setModal(null)}>
          <div style={{ ...S.modal, maxWidth:480 }} onClick={e => e.stopPropagation()}>
            <div style={S.modalHeader}><div style={S.modalTitle}>New Loan / Advance</div><button style={S.close} onClick={() => setModal(null)}>✕</button></div>
            {err && <div style={{ ...S.error, marginBottom:10 }}>{err}</div>}
            <form style={S.form} onSubmit={createLoan}>
              <label style={S.label}>Employee ID<input style={S.input} type="number" required placeholder="Employee ID" value={form.employee_id} onChange={e => setForm(f=>({...f,employee_id:e.target.value}))}/></label>
              <div style={S.grid2}>
                <label style={S.label}>Type<select style={S.select} value={form.loan_type} onChange={e => setForm(f=>({...f,loan_type:e.target.value}))}><option value="advance">Advance</option><option value="loan">Loan</option></select></label>
                <label style={S.label}>Amount (₹)<input style={S.input} type="number" required min="1" value={form.amount} onChange={e => setForm(f=>({...f,amount:e.target.value}))}/></label>
              </div>
              <div style={S.grid2}>
                <label style={S.label}>Disburse Date<input style={S.input} type="date" required value={form.disbursed_date} onChange={e => setForm(f=>({...f,disbursed_date:e.target.value}))}/></label>
                <label style={S.label}>Monthly EMI (₹)<input style={S.input} type="number" min="0" placeholder="0 = one-time" value={form.monthly_emi} onChange={e => setForm(f=>({...f,monthly_emi:e.target.value}))}/></label>
              </div>
              <label style={S.label}>Notes<input style={S.input} type="text" placeholder="Optional" value={form.notes} onChange={e => setForm(f=>({...f,notes:e.target.value}))}/></label>
              <div style={S.modalFooter}>
                <button type="button" style={S.btnSecondary} onClick={() => setModal(null)}>Cancel</button>
                <button type="submit" style={S.btnPrimary} disabled={saving}>{saving?'Saving…':'Create'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {modal && modal !== 'new' && (
        <div style={S.overlay} onClick={() => setModal(null)}>
          <div style={{ ...S.modal, maxWidth:380 }} onClick={e => e.stopPropagation()}>
            <div style={S.modalHeader}><div style={S.modalTitle}>Record Payment</div><button style={S.close} onClick={() => setModal(null)}>✕</button></div>
            <div style={{ marginBottom:12, fontSize:13 }}>
              <div>Employee: <strong>{modal.empName}</strong></div>
              <div>Type: <strong style={{ textTransform:'capitalize' }}>{modal.loan_type}</strong></div>
              <div>Outstanding: <strong>₹{Number(modal.outstanding).toLocaleString('en-IN')}</strong></div>
              {modal.monthly_emi > 0 && <div style={S.muted}>EMI: ₹{Number(modal.monthly_emi).toLocaleString('en-IN')}/month</div>}
            </div>
            <label style={S.label}>Payment Amount (₹)
              <input style={S.input} type="number" min="1" value={payAmt} onChange={e => setPayAmt(e.target.value)}/>
            </label>
            <div style={{ ...S.modalFooter, marginTop:14 }}>
              <button style={S.btnSecondary} onClick={() => setModal(null)}>Cancel</button>
              <button style={S.btnPrimary} disabled={saving} onClick={() => recordPayment(modal.id)}>{saving?'Saving…':'Record Payment'}</button>
            </div>
          </div>
        </div>
      )}

      {loading ? <Spinner /> : (
        <div style={S.tableWrap}>
          <table style={S.table}>
            <thead style={S.thead}><tr>
              <th style={S.th}>Employee</th><th style={S.th}>Type</th>
              <th style={S.th}>Amount</th><th style={S.th}>Outstanding</th>
              <th style={S.th}>EMI/mo</th><th style={S.th}>Date</th>
              <th style={S.th}>Status</th><th style={S.th}></th>
            </tr></thead>
            <tbody>
              {loans.length===0 && <tr><td colSpan={8} style={{ ...S.td, ...S.empty }}>No loans or advances</td></tr>}
              {loans.map(l => (
                <tr key={l.id} style={S.tr}>
                  <td style={S.td}><div style={{ fontWeight:600 }}>{l.empName}</div><div style={S.muted}>{l.empCode}</div></td>
                  <td style={S.td}><span style={{ textTransform:'capitalize' }}>{l.loan_type}</span></td>
                  <td style={S.td}>₹{Number(l.amount).toLocaleString('en-IN')}</td>
                  <td style={S.td}><strong>₹{Number(l.outstanding).toLocaleString('en-IN')}</strong></td>
                  <td style={S.td}>{l.monthly_emi > 0 ? `₹${Number(l.monthly_emi).toLocaleString('en-IN')}` : '—'}</td>
                  <td style={S.td}>{l.disbursed_date?.slice(0,10)}</td>
                  <td style={S.td}><span style={{ ...S.badge, ...(LOAN_BAD[l.status]||{bg:'#f6f5f0',color:'#666'}) }}>{l.status}</span></td>
                  <td style={S.td}>
                    {canManage && l.status==='active' && (
                      <button style={{ ...S.btnSecondary, fontSize:11, padding:'3px 8px' }} onClick={() => { setModal(l); setPayAmt(l.monthly_emi > 0 ? String(l.monthly_emi) : '') }}>Pay EMI</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// helper used in Separation component
const canSupervise = lvl => lvl >= 2

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const maskField = v => {
  if (!v) return '—'
  const s = String(v)
  if (s.length <= 4) return '****'
  return '*'.repeat(s.length - 4) + s.slice(-4)
}

const Spinner = () => <div style={{ padding: 40, textAlign: 'center', color: '#8a8a90' }}>Loading…</div>

// ─── STYLES ───────────────────────────────────────────────────────────────────
const S = {
  page:       { padding: 24, background: '#f6f5f0', minHeight: '100vh', color: '#1b1b1d' },
  header:     { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  title:      { fontSize: 22, fontWeight: 700, color: '#1b1b1d' },
  sub:        { fontSize: 13, color: '#8a8a90', marginTop: 2 },
  tabs:       { display: 'flex', gap: 4, marginBottom: 16, borderBottom: '1px solid #e7e6df', flexWrap: 'wrap' },
  tabBtn:     { background: 'none', border: 'none', color: '#8a8a90', padding: '8px 14px', cursor: 'pointer', fontSize: 13, fontWeight: 500, borderBottom: '2px solid transparent', marginBottom: -1 },
  tabActive:  { color: '#1b1b1d', borderBottom: '2px solid #1b1b1d' },
  filterBar:  { display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' },
  card:       { background: '#ffffff', borderRadius: 10, padding: 20, border: '1px solid #e7e6df' },
  kpiRow:     { display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 4 },
  kpiCard:    { background: '#ffffff', border: '1px solid #e7e6df', borderRadius: 10, padding: '14px 18px', minWidth: 130, flex: '1 1 130px' },
  tableWrap:  { background: '#ffffff', borderRadius: 10, overflow: 'auto', border: '1px solid #e7e6df' },
  table:      { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  thead:      { background: '#f6f5f0' },
  th:         { padding: '10px 14px', textAlign: 'left', color: '#8a8a90', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', borderBottom: '1px solid #e7e6df', whiteSpace: 'nowrap' },
  tr:         { borderBottom: '1px solid #f1efe8' },
  td:         { padding: '10px 14px', verticalAlign: 'middle' },
  muted:      { color: '#a0a0a6', fontSize: 12 },
  code:       { fontFamily: 'monospace', background: '#f6f5f0', padding: '2px 6px', borderRadius: 4, fontSize: 11, color: '#a0a0a6' },
  badge:      { fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20, display: 'inline-block' },
  empty:      { padding: 40, textAlign: 'center', color: '#8a8a90', fontSize: 13 },
  pagination: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 },
  pgBtn:      { background: '#ffffff', border: '1px solid #e7e6df', color: '#1b1b1d', borderRadius: 6, padding: '5px 12px', cursor: 'pointer', fontSize: 12 },
  pgInfo:     { fontSize: 12, color: '#a0a0a6', padding: '5px 8px' },
  overlay:    { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modal:      { background: '#ffffff', borderRadius: 12, padding: 24, width: '100%', maxHeight: '90vh', overflowY: 'auto' },
  modalHeader:{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 16, fontWeight: 700, color: '#1b1b1d' },
  close:      { background: 'none', border: 'none', color: '#a0a0a6', fontSize: 18, cursor: 'pointer' },
  form:       { display: 'flex', flexDirection: 'column', gap: 14 },
  grid2:      { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 },
  grid3:      { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 24 },
  label:      { display: 'flex', flexDirection: 'column', gap: 5, fontSize: 12, color: '#a0a0a6', fontWeight: 600 },
  input:      { background: '#f6f5f0', border: '1px solid #e7e6df', borderRadius: 6, padding: '8px 10px', color: '#1b1b1d', fontSize: 13, outline: 'none' },
  select:     { background: '#f6f5f0', border: '1px solid #e7e6df', borderRadius: 6, padding: '8px 10px', color: '#1b1b1d', fontSize: 13 },
  error:      { background: '#ef444422', border: '1px solid #ef444444', color: '#f87171', padding: '8px 12px', borderRadius: 6, fontSize: 13 },
  modalFooter:{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 },
  btnPrimary: { background: '#1b1b1d', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 18px', fontWeight: 600, fontSize: 13, cursor: 'pointer' },
  btnSecondary:{ background: '#e7e6df', color: '#1b1b1d', border: 'none', borderRadius: 8, padding: '8px 18px', fontWeight: 600, fontSize: 13, cursor: 'pointer' },
  avatar:     { width: 56, height: 56, borderRadius: '50%', background: '#1b1b1d', color: '#fff', fontSize: 22, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  profileRow: { display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid #f6f5f0', fontSize: 13 },
  profileLabel:{ color: '#a0a0a6', fontSize: 12 },
  profileValue:{ color: '#1b1b1d', fontWeight: 500 },
  sectionLabel:{ fontWeight: 700, fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, color: '#8a8a90', marginBottom: 12 },
  alertBox:   { background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#0369a1' },
}
