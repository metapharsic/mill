import React, { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'

const API = '/api'
const h = () => ({ Authorization: `Bearer ${localStorage.getItem('mk_token')}` })
const jh = () => ({ ...h(), 'Content-Type': 'application/json' })

const CATEGORY_COLOR = {
  'Production & Operations': '#1b1b1d',
  'Materials & Stores':      '#1b1b1d',
  'Quality & Lab':           '#1b1b1d',
  'Supply Chain':            '#d97706',
  'Commercial & Admin':      '#16a34a',
  'Safety & Compliance':     '#dc2626',
}

export default function Admin() {
  const { user } = useAuth()
  const [tab, setTab] = useState('settings')

  if (!user) return null

  const TABS = [
    ['settings',    'Settings'],
    ['users',       'Users'],
    ['departments', 'Departments'],
    ['footsteps',   'Footsteps'],
    ['roles',       'Roles'],
  ]

  return (
    <div style={S.page}>
      <div style={S.hdr}>
        <div>
          <div style={S.title}>Administration</div>
          <div style={S.sub}>System settings · user accounts · audit trail</div>
        </div>
      </div>

      <StatsBar />

      <div style={S.tabs}>
        {TABS.map(([k, l]) => (
          <button key={k} style={{ ...S.tab, ...(tab === k ? S.tabA : {}) }} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>

      {tab === 'settings'    && <SettingsTab />}
      {tab === 'users'       && <UsersTab currentUser={user} />}
      {tab === 'departments' && <DepartmentsTab />}
      {tab === 'footsteps'   && <FootstepsTab />}
      {tab === 'roles'       && <RolesTab />}
    </div>
  )
}

// ─── Stats bar ────────────────────────────────────────────────────────────────

function StatsBar() {
  const [stats, setStats] = useState({})
  useEffect(() => {
    fetch(`${API}/admin/stats`, { headers: h() }).then(r => r.json()).then(d => setStats(d.data || {}))
  }, [])
  return (
    <div style={S.kpis}>
      {[['Users', stats.users, '#1b1b1d'], ['Materials', stats.materials, '#1b1b1d'], ['Reels', stats.reels, '#16a34a'],
        ['POs', stats.pos, '#d97706'], ['SOs', stats.sos, '#1b1b1d'], ['Employees', stats.employees, '#be185d'],
        ['Indents', stats.indents, '#1b1b1d']].map(([l, v, c]) => (
        <div key={l} style={S.kpi}><div style={{ ...S.kpiVal, color: c }}>{v || 0}</div><div style={S.kpiLbl}>{l}</div></div>
      ))}
    </div>
  )
}

// ─── Settings tab ─────────────────────────────────────────────────────────────

function SettingsTab() {
  const [settings, setSettings] = useState([])
  const [edited, setEdited] = useState({})
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    fetch(`${API}/admin/settings`, { headers: h() }).then(r => r.json()).then(d => setSettings(d.data || []))
  }, [])

  const { addToast } = useToast()

  async function save() {
    const payload = Object.entries(edited).map(([key, value]) => ({ key, value }))
    if (!payload.length) return
    try {
      const res = await fetch(`${API}/admin/settings`, { method: 'PUT', headers: jh(), body: JSON.stringify({ settings: payload }) })
      const data = await res.json()
      if (data.success) {
        addToast('Settings saved successfully', 'success')
        setSaved(true); setTimeout(() => setSaved(false), 2000); setEdited({})
        fetch(`${API}/admin/settings`, { headers: h() }).then(r => r.json()).then(d => setSettings(d.data || []))
      } else {
        addToast(data.message || 'Failed to save settings', 'error')
      }
    } catch (e) {
      addToast('Save request failed', 'error')
    }
  }

  const val = key => edited[key] !== undefined ? edited[key] : (settings.find(s => s.key === key)?.value || '')
  const set = (key, value) => setEdited(e => ({ ...e, [key]: value }))
  const categories = [...new Set(settings.map(s => s.category))]

  return (
    <div style={S.card}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16, gap: 8 }}>
        {saved && <span style={{ color: '#16a34a', fontSize: 13, padding: '8px 0' }}>✓ Saved</span>}
        <button style={S.btn} onClick={save} disabled={!Object.keys(edited).length}>Save Changes</button>
      </div>
      {categories.map(cat => (
        <div key={cat} style={{ marginBottom: 24 }}>
          <div style={S.catLabel}>{cat}</div>
          <div style={S.grid2}>
            {settings.filter(s => s.category === cat).map(s => (
              <div key={s.key}>
                <label style={S.label}>{s.label}</label>
                <input style={{ ...S.input, borderColor: edited[s.key] !== undefined ? '#1b1b1d' : '#d8d6cc' }}
                  value={val(s.key)} onChange={e => set(s.key, e.target.value)} />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Users tab ────────────────────────────────────────────────────────────────

function UsersTab({ currentUser }) {
  const [users, setUsers] = useState([])
  const [roles, setRoles] = useState([])
  const [depts, setDepts] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [resetTarget, setResetTarget] = useState(null)
  const [editTarget, setEditTarget] = useState(null)
  const [msg, setMsg] = useState('')
  const [filterActive, setFilterActive] = useState('all')
  const [filterDept, setFilterDept] = useState('')
  const [searchTerm, setSearchTerm] = useState('')

  const flash = m => { setMsg(m); setTimeout(() => setMsg(''), 3000) }

  const load = useCallback(async () => {
    setLoading(true)
    const [u, r, d] = await Promise.all([
      fetch(`${API}/admin/users`, { headers: h() }).then(x => x.json()),
      fetch(`${API}/admin/roles`, { headers: h() }).then(x => x.json()),
      fetch(`${API}/admin/departments`, { headers: h() }).then(x => x.json()),
    ])
    setUsers(u.data || []); setRoles(r.data || []); setDepts(d.data || [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function deactivate(id) {
    if (!confirm('Deactivate this user?')) return
    await fetch(`${API}/admin/users/${id}/deactivate`, { method: 'PUT', headers: h() })
    flash('User deactivated'); load()
  }
  async function activate(id) {
    await fetch(`${API}/admin/users/${id}/activate`, { method: 'PUT', headers: h() })
    flash('User activated'); load()
  }

  const filtered = users.filter(u => {
    if (filterActive === 'active' && !u.is_active) return false
    if (filterActive === 'inactive' && u.is_active) return false
    if (filterDept && u.department_id !== +filterDept) return false
    if (searchTerm && !(u.name||'').toLowerCase().includes(searchTerm.toLowerCase()) && !(u.email||'').toLowerCase().includes(searchTerm.toLowerCase()) && !(u.employee_code||'').toLowerCase().includes(searchTerm.toLowerCase())) return false
    return true
  })

  const byCategory = filtered.reduce((acc, u) => {
    const cat = u.category || 'Uncategorised'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(u)
    return acc
  }, {})

  const ROLE_BADGE = { 5: '#1b1b1d', 4: '#1b1b1d', 3: '#1b1b1d', 2: '#16a34a', 1: '#a0a0a6' }

  return (
    <div>
      {msg && <div style={S.flash}>{msg}</div>}
      <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <input style={{...S.sel, width:200, background: '#fff'}} placeholder='Search users...' value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} />
        <select style={S.sel} value={filterActive} onChange={e => setFilterActive(e.target.value)}>
          <option value="all">All</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
        <select style={S.sel} value={filterDept} onChange={e => setFilterDept(e.target.value)}>
          <option value="">All departments</option>
          {depts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <span style={{ fontSize: 13, color: '#8a8a90' }}>{filtered.length} users</span>
        {currentUser.role_level >= 5 && (
          <button style={{ ...S.btn, marginLeft: 'auto' }} onClick={() => setShowCreate(true)}>+ New User</button>
        )}
      </div>

      {loading ? <div style={S.empty}>Loading...</div> : (
        Object.entries(byCategory).map(([cat, catUsers]) => (
          <div key={cat} style={{ marginBottom: 24 }}>
            <div style={{ ...S.catLabel, borderLeft: `3px solid ${CATEGORY_COLOR[cat] || '#a0a0a6'}`, paddingLeft: 10 }}>{cat}</div>
            <div style={S.userGrid}>
              {catUsers.map(u => (
                <div key={u.id} style={{ ...S.userCard, opacity: u.is_active ? 1 : 0.55 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 13, color: '#1b1b1d' }}>{u.name}</div>
                      <div style={{ fontSize: 11, color: '#8a8a90', marginTop: 2 }}>{u.email}</div>
                      {u.employee_code && <div style={{ fontSize: 10, color: '#a0a0a6' }}>{u.employee_code}</div>}
                    </div>
                    <span style={{ ...S.badge, background: ROLE_BADGE[u.role_level] + '22', color: ROLE_BADGE[u.role_level] }}>
                      L{u.role_level} {u.role_name}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: '#3a3a3e', marginTop: 8 }}>
                    {u.department_name} {u.shift ? `· ${u.shift}` : ''}
                  </div>
                  {u.must_change_password && (
                    <div style={{ fontSize: 10, color: '#d97706', marginTop: 4 }}>⚠ Must change password</div>
                  )}
                  {u.last_login && (
                    <div style={{ fontSize: 10, color: '#a0a0a6', marginTop: 2 }}>
                      Last login: {new Date(u.last_login).toLocaleDateString()}
                    </div>
                  )}
                  {currentUser.role_level >= 5 && (
                    <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
                      <button style={S.smBtn} onClick={() => setEditTarget(u)}>Edit</button>
                      <button style={S.smBtn} onClick={() => setResetTarget(u)}>Reset pwd</button>
                      {u.is_active
                        ? <button style={{ ...S.smBtn, color: '#dc2626' }} onClick={() => deactivate(u.id)}>Deactivate</button>
                        : <button style={{ ...S.smBtn, color: '#16a34a' }} onClick={() => activate(u.id)}>Activate</button>
                      }
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))
      )}

      {showCreate && (
        <CreateUserModal roles={roles} depts={depts}
          onClose={() => setShowCreate(false)}
          onDone={() => { setShowCreate(false); load(); flash('User created') }} />
      )}
      {editTarget && (
        <EditUserModal user={editTarget} roles={roles} depts={depts}
          onClose={() => setEditTarget(null)}
          onDone={() => { setEditTarget(null); load(); flash('User updated') }} />
      )}
      {resetTarget && (
        <ResetPasswordModal user={resetTarget}
          onClose={() => setResetTarget(null)}
          onDone={() => { setResetTarget(null); flash('Password reset') }} />
      )}
    </div>
  )
}

function CreateUserModal({ roles, depts, onClose, onDone }) {
  const [form, setForm] = useState({ name: '', email: '', password: '', roleId: '', departmentId: '', shift: '', employeeCode: '' })
  const [err, setErr] = useState('')
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }))

  async function submit() {
    setErr('')
    if (!form.name || !form.email || !form.password || !form.roleId || !form.departmentId)
      return setErr('All fields required except shift/code')
    const r = await fetch(`${API}/admin/users`, { method: 'POST', headers: jh(), body: JSON.stringify({
      name: form.name, email: form.email, password: form.password,
      roleId: +form.roleId, departmentId: +form.departmentId,
      shift: form.shift || null, employeeCode: form.employeeCode || null
    }) })
    const d = await r.json()
    if (!d.success) return setErr(d.message || 'Failed')
    onDone()
  }

  return (
    <div style={S.overlay}>
      <div style={S.modal}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
          <b style={{ fontSize: 15 }}>Create User</b>
          <button style={S.xBtn} onClick={onClose}>✕</button>
        </div>
        {err && <div style={S.errMsg}>{err}</div>}
        {[['Name *', 'name', 'text'], ['Email *', 'email', 'email'], ['Password *', 'password', 'password'],
          ['Employee Code', 'employeeCode', 'text']].map(([lbl, key, type]) => (
          <div key={key} style={{ marginBottom: 12 }}>
            <label style={S.label}>{lbl}</label>
            <input style={S.input} type={type} value={form[key]} onChange={set(key)} required />
          </div>
        ))}
        <div style={{ marginBottom: 12 }}>
          <label style={S.label}>Role *</label>
          <select style={S.input} value={form.roleId} onChange={set('roleId')} required>
            <option value="">Select role</option>
            {roles.map(r => <option key={r.id} value={r.id}>L{r.level} — {r.name}</option>)}
          </select>
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={S.label}>Department *</label>
          <select style={S.input} value={form.departmentId} onChange={set('departmentId')} required>
            <option value="">Select department</option>
            {depts.map(d => <option key={d.id} value={d.id}>{d.name} ({d.code})</option>)}
          </select>
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={S.label}>Shift (optional)</label>
          <select style={S.input} value={form.shift} onChange={set('shift')}>
            <option value="">—</option>
            {['Day', 'Night', 'General'].map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button style={S.outBtn} onClick={onClose}>Cancel</button>
          <button style={S.btn} onClick={submit}>Create</button>
        </div>
      </div>
    </div>
  )
}

function EditUserModal({ user, roles, depts, onClose, onDone }) {
  const [form, setForm] = useState({ name: user.name || '', roleId: user.role_id || '', departmentId: user.department_id || '', shift: user.shift || '' })
  const [err, setErr] = useState('')
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }))

  async function submit() {
    setErr('')
    if (!form.name || !form.roleId || !form.departmentId)
      return setErr('Name, Role, and Department required')
    const r = await fetch(`${API}/admin/users/${user.id}`, { method: 'PUT', headers: jh(), body: JSON.stringify({
      name: form.name, roleId: +form.roleId, departmentId: +form.departmentId, shift: form.shift || null
    }) })
    const d = await r.json()
    if (!d.success) return setErr(d.message || 'Failed')
    onDone()
  }

  return (
    <div style={S.overlay}>
      <div style={S.modal}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
          <b style={{ fontSize: 15 }}>Edit User: {user.name}</b>
          <button style={S.xBtn} onClick={onClose}>✕</button>
        </div>
        {err && <div style={S.errMsg}>{err}</div>}
        <div style={{ marginBottom: 12 }}>
          <label style={S.label}>Name</label>
          <input style={S.input} type="text" value={form.name} onChange={set('name')} />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={S.label}>Role</label>
          <select style={S.input} value={form.roleId} onChange={set('roleId')}>
            <option value="">Select role</option>
            {roles.map(r => <option key={r.id} value={r.id}>L{r.level} — {r.name}</option>)}
          </select>
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={S.label}>Department</label>
          <select style={S.input} value={form.departmentId} onChange={set('departmentId')}>
            <option value="">Select department</option>
            {depts.map(d => <option key={d.id} value={d.id}>{d.name} ({d.code})</option>)}
          </select>
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={S.label}>Shift (optional)</label>
          <select style={S.input} value={form.shift} onChange={set('shift')}>
            <option value="">—</option>
            {['Day', 'Night', 'General'].map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button style={S.outBtn} onClick={onClose}>Cancel</button>
          <button style={S.btn} onClick={submit}>Save Changes</button>
        </div>
      </div>
    </div>
  )
}

function ResetPasswordModal({ user, onClose, onDone }) {
  const [pwd, setPwd] = useState('')
  const [confirmPwd, setConfirmPwd] = useState('')
  const [err, setErr] = useState('')
  async function submit() {
    setErr('')
    if (pwd.length < 6) return setErr('Min 6 characters')
    if (pwd !== confirmPwd) return setErr('Passwords do not match')
    const r = await fetch(`${API}/admin/users/${user.id}/reset-password`, {
      method: 'PUT', headers: jh(), body: JSON.stringify({ newPassword: pwd })
    })
    const d = await r.json()
    if (!d.success) return setErr(d.message || 'Failed')
    onDone()
  }
  return (
    <div style={S.overlay}>
      <div style={{ ...S.modal, maxWidth: 380 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
          <b style={{ fontSize: 15 }}>Reset Password</b>
          <button style={S.xBtn} onClick={onClose}>✕</button>
        </div>
        <div style={{ fontSize: 13, color: '#3a3a3e', marginBottom: 14 }}>User: <b>{user.name}</b> ({user.email})</div>
        {err && <div style={S.errMsg}>{err}</div>}
        <label style={S.label}>New Password *</label>
        <input style={{ ...S.input, marginBottom: 12 }} type="password" value={pwd}
          onChange={e => setPwd(e.target.value)} placeholder="Min 6 characters" />
        <label style={S.label}>Confirm New Password *</label>
        <input style={{ ...S.input, marginBottom: 16 }} type="password" value={confirmPwd}
          onChange={e => setConfirmPwd(e.target.value)} placeholder="Re-enter password" />
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button style={S.outBtn} onClick={onClose}>Cancel</button>
          <button style={S.btn} onClick={submit}>Reset Password</button>
        </div>
      </div>
    </div>
  )
}

// ─── Departments tab ───────────────────────────────────────────────────────────

function DepartmentsTab() {
  const [depts, setDepts] = useState([])
  useEffect(() => {
    fetch(`${API}/admin/departments`, { headers: h() }).then(r => r.json()).then(d => setDepts(d.data || []))
  }, [])

  const byCategory = depts.reduce((acc, d) => {
    const cat = d.category || 'Uncategorised'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(d)
    return acc
  }, {})

  return (
    <div>
      {Object.entries(byCategory).map(([cat, items]) => (
        <div key={cat} style={{ marginBottom: 20 }}>
          <div style={{ ...S.catLabel, borderLeft: `3px solid ${CATEGORY_COLOR[cat] || '#a0a0a6'}`, paddingLeft: 10 }}>
            {cat} <span style={{ fontWeight: 400, color: '#a0a0a6' }}>({items.length})</span>
          </div>
          <div style={S.grid4}>
            {items.map(d => (
              <div key={d.id} style={{ ...S.deptCard, borderTop: `3px solid ${CATEGORY_COLOR[cat] || '#ecebe5'}` }}>
                <div style={S.deptCode}>{d.code}</div>
                <div style={S.deptName}>{d.name}</div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Footsteps tab ────────────────────────────────────────────────────────────

function FootstepsTab() {
  const [logs, setLogs] = useState([])
  const [approvers, setApprovers] = useState({ mainApprovers: [], departmentHeads: [] })
  const [view, setView] = useState('feed')
  const [filters, setFilters] = useState({ module: '', from: '', to: '' })
  const [loading, setLoading] = useState(false)

  const loadFeed = useCallback(async () => {
    setLoading(true)
    const q = new URLSearchParams(Object.fromEntries(Object.entries(filters).filter(([, v]) => v)))
    const r = await fetch(`${API}/admin/footsteps?${q}`, { headers: h() })
    const d = await r.json()
    setLogs(d.data || [])
    setLoading(false)
  }, [filters])

  const loadApprovers = useCallback(async () => {
    const r = await fetch(`${API}/admin/approvers`, { headers: h() })
    const d = await r.json()
    setApprovers(d.data || { mainApprovers: [], departmentHeads: [] })
  }, [])

  useEffect(() => {
    if (view === 'feed') loadFeed()
    else loadApprovers()
  }, [view, loadFeed, loadApprovers])

  const MODULE_COLOR = { admin: '#1b1b1d', store: '#1b1b1d', purchase: '#d97706', production: '#16a34a', hr: '#be185d' }

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        <button style={{ ...S.tab, ...(view === 'feed' ? S.tabA : {}) }} onClick={() => setView('feed')}>Audit Feed</button>
        <button style={{ ...S.tab, ...(view === 'approvers' ? S.tabA : {}) }} onClick={() => setView('approvers')}>Approvers</button>
      </div>

      {view === 'feed' && (
        <>
          <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
            <input style={S.sel} placeholder="Filter module..." value={filters.module}
              onChange={e => setFilters(f => ({ ...f, module: e.target.value }))} />
            <input style={S.sel} type="date" value={filters.from}
              onChange={e => setFilters(f => ({ ...f, from: e.target.value }))} />
            <input style={S.sel} type="date" value={filters.to}
              onChange={e => setFilters(f => ({ ...f, to: e.target.value }))} />
            <button style={S.btn} onClick={loadFeed}>Search</button>
          </div>
          {loading ? <div style={S.empty}>Loading...</div>
            : !logs.length ? <div style={S.empty}>No entries found.</div>
            : (
              <div style={S.card}>
                <table style={S.tbl}>
                  <thead>
                    <tr>{['Time', 'Module', 'Action', 'Record', 'User', 'Role', 'Department'].map(c =>
                      <th key={c} style={S.th}>{c}</th>)}</tr>
                  </thead>
                  <tbody>
                    {logs.map(l => (
                      <tr key={l.id}>
                        <td style={S.td}>{new Date(l.created_at).toLocaleString()}</td>
                        <td style={S.td}>
                          <span style={{ ...S.badge, background: (MODULE_COLOR[l.module] || '#a0a0a6') + '20', color: MODULE_COLOR[l.module] || '#8a8a90' }}>
                            {l.module}
                          </span>
                        </td>
                        <td style={S.td}>{l.action}</td>
                        <td style={S.td}>{l.record_id || '—'}</td>
                        <td style={S.td}>{l.user_name || '—'}</td>
                        <td style={S.td}>{l.role_name ? `L${l.role_level} ${l.role_name}` : '—'}</td>
                        <td style={S.td}>{l.department_name || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
        </>
      )}

      {view === 'approvers' && (
        <div>
          <div style={S.catLabel}>Main Approvers (Plant Head + Admin)</div>
          <div style={S.userGrid}>
            {approvers.mainApprovers.map(a => (
              <div key={a.id} style={{ ...S.userCard, borderTop: '3px solid #1b1b1d' }}>
                <div style={{ fontWeight: 700, fontSize: 13 }}>{a.name}</div>
                <div style={{ fontSize: 11, color: '#8a8a90' }}>{a.email}</div>
                <div style={{ fontSize: 11, marginTop: 6 }}>
                  <span style={{ ...S.badge, background: '#dbeafe', color: '#1b1b1d' }}>L{a.role_level} {a.role_name}</span>
                </div>
                <div style={{ fontSize: 12, color: '#3a3a3e', marginTop: 8 }}>
                  {a.approval_actions || 0} approve / reject / issue actions
                </div>
              </div>
            ))}
          </div>
          <div style={{ ...S.catLabel, marginTop: 20 }}>Department Head Managers</div>
          <div style={S.userGrid}>
            {approvers.departmentHeads.map(a => (
              <div key={a.id} style={{ ...S.userCard, borderTop: `3px solid ${CATEGORY_COLOR[a.category] || '#ecebe5'}` }}>
                <div style={{ fontWeight: 700, fontSize: 13 }}>{a.name}</div>
                <div style={{ fontSize: 11, color: '#8a8a90' }}>{a.email}</div>
                <div style={{ fontSize: 11, color: '#3a3a3e', marginTop: 4 }}>{a.department_name}</div>
                <div style={{ fontSize: 10, color: CATEGORY_COLOR[a.category] || '#a0a0a6', marginTop: 2 }}>{a.category}</div>
                <div style={{ fontSize: 12, color: '#3a3a3e', marginTop: 8 }}>
                  {a.approval_actions || 0} approval actions
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Roles tab ────────────────────────────────────────────────────────────────

function RolesTab() {
  const [roles, setRoles] = useState([])
  useEffect(() => {
    fetch(`${API}/admin/roles`, { headers: h() }).then(r => r.json()).then(d => setRoles(d.data || []))
  }, [])
  return (
    <div style={S.card}>
      <table style={S.tbl}>
        <thead>
          <tr>{['Role', 'Level', 'View', 'Entry', 'Approve L1', 'L2', 'L3', 'Manage Users'].map(c =>
            <th key={c} style={S.th}>{c}</th>)}</tr>
        </thead>
        <tbody>
          {roles.map(r => (
            <tr key={r.id}>
              <td style={S.td}><b>{r.name}</b></td>
              <td style={S.td}><span style={{ ...S.badge, background: '#e0e7ff', color: '#1b1b1d' }}>L{r.level}</span></td>
              {['view', 'entry', 'approve_l1', 'approve_l2', 'approve_l3', 'manage_users'].map(p => (
                <td key={p} style={{ ...S.td, textAlign: 'center' }}>{r.permissions?.[p] ? '✅' : '—'}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const S = {
  page:    { padding: 24, background: '#f6f5f0', minHeight: '100vh' },
  hdr:     { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  title:   { fontSize: 22, fontWeight: 700, color: '#1b1b1d' },
  sub:     { fontSize: 13, color: '#8a8a90', marginTop: 4 },
  kpis:    { display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' },
  kpi:     { background: 'white', borderRadius: 10, padding: '12px 16px', flex: 1, minWidth: 80, boxShadow: '0 1px 4px rgba(0,0,0,0.07)' },
  kpiVal:  { fontSize: 24, fontWeight: 700 },
  kpiLbl:  { fontSize: 11, color: '#8a8a90', marginTop: 2 },
  tabs:    { display: 'flex', gap: 4, marginBottom: 16, borderBottom: '2px solid #ecebe5', flexWrap: 'wrap' },
  tab:     { padding: '8px 16px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: '#8a8a90', borderBottom: '2px solid transparent', marginBottom: -2 },
  tabA:    { color: '#1b1b1d', borderBottomColor: '#1b1b1d', fontWeight: 600 },
  card:    { background: 'white', borderRadius: 12, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.07)' },
  catLabel:{ fontSize: 11, fontWeight: 700, color: '#3a3a3e', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10, paddingBottom: 6, borderBottom: '1px solid #ecebe5' },
  grid2:   { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 },
  grid4:   { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 },
  userGrid:{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12, marginBottom: 4 },
  userCard:{ background: 'white', border: '1px solid #ecebe5', borderRadius: 10, padding: 14, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' },
  label:   { display: 'block', fontSize: 12, color: '#3a3a3e', fontWeight: 600, marginBottom: 4 },
  input:   { width: '100%', padding: '8px 10px', border: '1px solid #d8d6cc', borderRadius: 8, fontSize: 13, boxSizing: 'border-box' },
  sel:     { padding: '7px 10px', border: '1px solid #d8d6cc', borderRadius: 8, fontSize: 13, background: 'white' },
  tbl:     { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  th:      { padding: '10px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#8a8a90', textTransform: 'uppercase', background: '#f6f5f0', borderBottom: '1px solid #ecebe5' },
  td:      { padding: '10px 12px', color: '#1b1b1d', borderBottom: '1px solid #f6f5f0', verticalAlign: 'middle' },
  badge:   { fontSize: 11, padding: '2px 8px', borderRadius: 999, fontWeight: 600 },
  btn:     { background: '#1b1b1d', color: 'white', border: 'none', borderRadius: 8, padding: '8px 16px', cursor: 'pointer', fontSize: 13, fontWeight: 600 },
  outBtn:  { background: 'white', color: '#3a3a3e', border: '1px solid #d8d6cc', borderRadius: 8, padding: '8px 16px', cursor: 'pointer', fontSize: 13 },
  smBtn:   { background: '#f6f5f0', color: '#3a3a3e', border: 'none', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 11 },
  deptCard:{ background: '#f6f5f0', border: '1px solid #ecebe5', borderRadius: 8, padding: '10px 12px' },
  deptCode:{ fontSize: 11, fontWeight: 700, color: '#1b1b1d', letterSpacing: '0.05em' },
  deptName:{ fontSize: 12, color: '#1b1b1d', marginTop: 4, fontWeight: 600 },
  flash:   { background: '#dcfce7', color: '#15803d', borderRadius: 8, padding: '10px 14px', marginBottom: 12, fontSize: 13 },
  errMsg:  { background: '#fee2e2', color: '#dc2626', borderRadius: 8, padding: '8px 12px', marginBottom: 12, fontSize: 13 },
  empty:   { color: '#a0a0a6', fontSize: 14, padding: '40px', textAlign: 'center' },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modal:   { background: 'white', borderRadius: 14, padding: 24, width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto' },
  xBtn:    { background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#8a8a90' },
}
