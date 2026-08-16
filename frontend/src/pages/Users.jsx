import React, { useState, useEffect, useCallback } from 'react'

const API = (path, opts) => fetch(path, {
  headers: { Authorization: `Bearer ${localStorage.getItem('mk_token')}`, 'Content-Type': 'application/json', ...(opts?.headers || {}) },
  ...opts,
}).then(r => r.json())

const SHIFTS = ['Day', 'Night', 'General']

const emptyForm = { name: '', email: '', password: '', mobile: '', role_id: '', department_id: '', shift: 'General', employee_code: '', is_active: true }

export default function Users() {
  const [users, setUsers] = useState([])
  const [roles, setRoles] = useState([])
  const [depts, setDepts] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterRole, setFilterRole] = useState('')
  const [filterDept, setFilterDept] = useState('')
  const [filterActive, setFilterActive] = useState('true')
  const [modal, setModal] = useState(null) // null | 'add' | 'edit'
  const [editUser, setEditUser] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [pwModal, setPwModal] = useState(null)
  const [pw, setPw] = useState({ new_password: '', confirm: '' })
  const [pwError, setPwError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (filterActive) params.set('is_active', filterActive)
    const [u, r, d] = await Promise.all([
      API(`/api/users?${params}`),
      API('/api/users/roles'),
      API('/api/users/departments'),
    ])
    if (u.success) setUsers(u.data)
    if (r.success) setRoles(r.data)
    if (d.success) setDepts(d.data)
    setLoading(false)
  }, [filterActive])

  useEffect(() => { load() }, [load])

  const filtered = users.filter(u => {
    const q = search.toLowerCase()
    const matchSearch = !q || u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q) || u.employee_code?.toLowerCase().includes(q)
    const matchRole = !filterRole || String(u.role_level) === filterRole || u.role === filterRole
    const matchDept = !filterDept || u.department === filterDept
    return matchSearch && matchRole && matchDept
  })

  const openAdd = () => { setForm(emptyForm); setFormError(''); setEditUser(null); setModal('add') }
  const openEdit = u => {
    setForm({ name: u.name, email: u.email, password: '', mobile: u.mobile || '', role_id: u.role_id || '', department_id: u.department_id || '', shift: u.shift || 'General', employee_code: u.employee_code || '', is_active: u.is_active })
    setFormError(''); setEditUser(u); setModal('edit')
  }

  const saveUser = async e => {
    e.preventDefault()
    if (!form.name || !form.email || (!editUser && !form.password) || !form.role_id)
      return setFormError('Name, email, role required. Password required for new users.')
    setSaving(true); setFormError('')
    const body = { ...form }
    if (editUser && !body.password) delete body.password
    const res = editUser
      ? await API(`/api/users/${editUser.id}`, { method: 'PUT', body: JSON.stringify(body) })
      : await API('/api/users', { method: 'POST', body: JSON.stringify(body) })
    setSaving(false)
    if (res.success) { setModal(null); load() }
    else setFormError(res.message)
  }

  const resetPw = async e => {
    e.preventDefault()
    if (pw.new_password !== pw.confirm) return setPwError('Passwords do not match')
    if (pw.new_password.length < 6) return setPwError('Min 6 characters')
    setPwError('')
    const res = await API(`/api/users/${pwModal.id}/reset-password`, { method: 'POST', body: JSON.stringify({ new_password: pw.new_password }) })
    if (res.success) { setPwModal(null); setPw({ new_password: '', confirm: '' }) }
    else setPwError(res.message)
  }

  const toggleActive = async u => {
    await API(`/api/users/${u.id}`, { method: 'PUT', body: JSON.stringify({ ...u, is_active: !u.is_active }) })
    load()
  }

  const roleColor = level => ({ 5: '#ef4444', 4: '#f97316', 3: '#eab308', 2: '#1b1b1d', 1: '#8a8a90' }[level] || '#8a8a90')

  return (
    <div style={S.page}>
      {/* Header */}
      <div style={S.header}>
        <div>
          <div style={S.title}>Users</div>
          <div style={S.sub}>Manage system users and access levels</div>
        </div>
        <button style={S.btnPrimary} onClick={openAdd}>+ Add User</button>
      </div>

      {/* Filters */}
      <div style={S.filterBar}>
        <input style={S.input} placeholder="Search name / email / code..." value={search} onChange={e => setSearch(e.target.value)} />
        <select style={S.select} value={filterRole} onChange={e => setFilterRole(e.target.value)}>
          <option value="">All Roles</option>
          {roles.map(r => <option key={r.id} value={r.name}>{r.name}</option>)}
        </select>
        <select style={S.select} value={filterDept} onChange={e => setFilterDept(e.target.value)}>
          <option value="">All Depts</option>
          {depts.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
        </select>
        <select style={S.select} value={filterActive} onChange={e => setFilterActive(e.target.value)}>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
          <option value="">All</option>
        </select>
        <button style={S.btnSecondary} onClick={load}>↻</button>
      </div>

      {/* Table */}
      <div style={S.tableWrap}>
        {loading ? <div style={S.loading}>Loading...</div> : (
          <table style={S.table}>
            <thead>
              <tr style={S.thead}>
                {['Code', 'Name', 'Email', 'Role', 'Department', 'Shift', 'Last Login', 'Status', 'Actions'].map(h => (
                  <th key={h} style={S.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={9} style={S.empty}>No users found</td></tr>
              )}
              {filtered.map(u => (
                <tr key={u.id} style={S.tr}>
                  <td style={S.td}><span style={S.code}>{u.employee_code || '—'}</span></td>
                  <td style={S.td}><div style={S.name}>{u.name}</div></td>
                  <td style={S.td}><span style={S.muted}>{u.email}</span></td>
                  <td style={S.td}>
                    <span style={{ ...S.badge, background: roleColor(u.role_level) + '22', color: roleColor(u.role_level), border: `1px solid ${roleColor(u.role_level)}44` }}>
                      {u.role}
                    </span>
                  </td>
                  <td style={S.td}><span style={S.muted}>{u.department || '—'}</span></td>
                  <td style={S.td}><span style={S.muted}>{u.shift || '—'}</span></td>
                  <td style={S.td}><span style={S.muted}>{u.last_login ? new Date(u.last_login).toLocaleDateString('en-IN') : 'Never'}</span></td>
                  <td style={S.td}>
                    <span style={{ ...S.badge, background: u.is_active ? '#22c55e22' : '#ef444422', color: u.is_active ? '#22c55e' : '#ef4444', border: `1px solid ${u.is_active ? '#22c55e44' : '#ef444444'}` }}>
                      {u.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td style={S.td}>
                    <div style={S.actions}>
                      <button style={S.btnIcon} title="Edit" onClick={() => openEdit(u)}>✏️</button>
                      <button style={S.btnIcon} title="Reset Password" onClick={() => { setPwModal(u); setPw({ new_password: '', confirm: '' }); setPwError('') }}>🔑</button>
                      <button style={{ ...S.btnIcon, opacity: 0.7 }} title={u.is_active ? 'Deactivate' : 'Activate'} onClick={() => toggleActive(u)}>
                        {u.is_active ? '🔴' : '🟢'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <div style={S.count}>{filtered.length} user{filtered.length !== 1 ? 's' : ''}</div>

      {/* Add/Edit Modal */}
      {modal && (
        <div style={S.overlay} onClick={() => setModal(null)}>
          <div style={S.modal} onClick={e => e.stopPropagation()}>
            <div style={S.modalHeader}>
              <div style={S.modalTitle}>{modal === 'add' ? 'Add New User' : `Edit: ${editUser?.name}`}</div>
              <button style={S.close} onClick={() => setModal(null)}>✕</button>
            </div>
            <form onSubmit={saveUser} style={S.form}>
              <div style={S.grid2}>
                <label style={S.label}>Full Name *
                  <input style={S.input} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Full name" />
                </label>
                <label style={S.label}>Email *
                  <input style={S.input} type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="email@mkpapermill.com" />
                </label>
                <label style={S.label}>{modal === 'add' ? 'Password *' : 'New Password (blank = no change)'}
                  <input style={S.input} type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="Min 6 chars" />
                </label>
                <label style={S.label}>Mobile
                  <input style={S.input} value={form.mobile} onChange={e => setForm(f => ({ ...f, mobile: e.target.value }))} placeholder="10-digit mobile" />
                </label>
                <label style={S.label}>Role *
                  <select style={S.select} value={form.role_id} onChange={e => setForm(f => ({ ...f, role_id: e.target.value }))}>
                    <option value="">-- Select Role --</option>
                    {roles.map(r => <option key={r.id} value={r.id}>{r.name} (L{r.level})</option>)}
                  </select>
                </label>
                <label style={S.label}>Department
                  <select style={S.select} value={form.department_id} onChange={e => setForm(f => ({ ...f, department_id: e.target.value }))}>
                    <option value="">-- Select Dept --</option>
                    {depts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </label>
                <label style={S.label}>Employee Code
                  <input style={S.input} value={form.employee_code} onChange={e => setForm(f => ({ ...f, employee_code: e.target.value }))} placeholder="EMP-0001" />
                </label>
                <label style={S.label}>Default Shift
                  <select style={S.select} value={form.shift} onChange={e => setForm(f => ({ ...f, shift: e.target.value }))}>
                    {SHIFTS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </label>
              </div>
              {modal === 'edit' && (
                <label style={{ ...S.label, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <input type="checkbox" checked={form.is_active} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} />
                  <span>Active</span>
                </label>
              )}
              {formError && <div style={S.error}>{formError}</div>}
              <div style={S.modalFooter}>
                <button type="button" style={S.btnSecondary} onClick={() => setModal(null)}>Cancel</button>
                <button type="submit" style={S.btnPrimary} disabled={saving}>{saving ? 'Saving...' : (modal === 'add' ? 'Create User' : 'Save Changes')}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {pwModal && (
        <div style={S.overlay} onClick={() => setPwModal(null)}>
          <div style={{ ...S.modal, maxWidth: 400 }} onClick={e => e.stopPropagation()}>
            <div style={S.modalHeader}>
              <div style={S.modalTitle}>Reset Password — {pwModal.name}</div>
              <button style={S.close} onClick={() => setPwModal(null)}>✕</button>
            </div>
            <form onSubmit={resetPw} style={S.form}>
              <label style={S.label}>New Password
                <input style={S.input} type="password" value={pw.new_password} onChange={e => setPw(p => ({ ...p, new_password: e.target.value }))} />
              </label>
              <label style={S.label}>Confirm Password
                <input style={S.input} type="password" value={pw.confirm} onChange={e => setPw(p => ({ ...p, confirm: e.target.value }))} />
              </label>
              {pwError && <div style={S.error}>{pwError}</div>}
              <div style={S.modalFooter}>
                <button type="button" style={S.btnSecondary} onClick={() => setPwModal(null)}>Cancel</button>
                <button type="submit" style={S.btnPrimary}>Reset Password</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

const S = {
  page: { padding: 24, background: '#f6f5f0', minHeight: '100vh', color: '#1b1b1d' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  title: { fontSize: 22, fontWeight: 700, color: '#1b1b1d' },
  sub: { fontSize: 13, color: '#8a8a90', marginTop: 2 },
  filterBar: { display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' },
  tableWrap: { background: '#ffffff', borderRadius: 10, overflow: 'auto', border: '1px solid #e7e6df' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  thead: { background: '#f6f5f0' },
  th: { padding: '10px 14px', textAlign: 'left', color: '#8a8a90', fontWeight: 600, fontSize: 12, textTransform: 'uppercase', borderBottom: '1px solid #e7e6df', whiteSpace: 'nowrap' },
  tr: { borderBottom: '1px solid #f1efe8', transition: 'background 0.1s' },
  td: { padding: '10px 14px', verticalAlign: 'middle' },
  name: { fontWeight: 600, color: '#1b1b1d' },
  muted: { color: '#a0a0a6', fontSize: 12 },
  code: { fontFamily: 'monospace', background: '#f6f5f0', padding: '2px 6px', borderRadius: 4, fontSize: 11, color: '#a0a0a6' },
  badge: { fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20, display: 'inline-block' },
  actions: { display: 'flex', gap: 4 },
  btnIcon: { background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, padding: '2px 4px', borderRadius: 4 },
  empty: { padding: 40, textAlign: 'center', color: '#8a8a90' },
  loading: { padding: 40, textAlign: 'center', color: '#8a8a90' },
  count: { marginTop: 10, fontSize: 12, color: '#8a8a90' },
  // form
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modal: { background: '#ffffff', borderRadius: 12, padding: 24, width: '100%', maxWidth: 680, border: '1px solid #e7e6df', maxHeight: '90vh', overflowY: 'auto' },
  modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 16, fontWeight: 700, color: '#1b1b1d' },
  close: { background: 'none', border: 'none', color: '#a0a0a6', fontSize: 18, cursor: 'pointer' },
  form: { display: 'flex', flexDirection: 'column', gap: 14 },
  grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 },
  label: { display: 'flex', flexDirection: 'column', gap: 5, fontSize: 12, color: '#a0a0a6', fontWeight: 600 },
  input: { background: '#f6f5f0', border: '1px solid #e7e6df', borderRadius: 6, padding: '8px 10px', color: '#1b1b1d', fontSize: 13, outline: 'none' },
  select: { background: '#f6f5f0', border: '1px solid #e7e6df', borderRadius: 6, padding: '8px 10px', color: '#1b1b1d', fontSize: 13 },
  error: { background: '#ef444422', border: '1px solid #ef444444', color: '#f87171', padding: '8px 12px', borderRadius: 6, fontSize: 13 },
  modalFooter: { display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 },
  btnPrimary: { background: '#1b1b1d', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 18px', fontWeight: 600, fontSize: 13, cursor: 'pointer' },
  btnSecondary: { background: '#e7e6df', color: '#1b1b1d', border: 'none', borderRadius: 8, padding: '8px 18px', fontWeight: 600, fontSize: 13, cursor: 'pointer' },
}
