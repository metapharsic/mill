import React, { useState, useEffect, useCallback } from 'react'
import SortableTh from '../components/SortableTh'
import TableScrollWrapper from '../components/TableScrollWrapper'
import SearchableSelect from '../components/SearchableSelect'
import { sortTableData } from '../utils/tableSort'

const API = (path, opts) => fetch(path, {
  headers: { Authorization: `Bearer ${localStorage.getItem('mk_token')}`, 'Content-Type': 'application/json', ...(opts?.headers || {}) },
  ...opts,
}).then(r => r.json())

const SHIFTS = ['Day', 'Night', 'General']

const emptyForm = { name: '', email: '', password: '', mobile: '', role_id: '', department_id: '', section_id: '', shift: 'General', employee_code: '', is_active: true }

export default function Users() {
  const [users, setUsers] = useState([])
  const [roles, setRoles] = useState([])
  const [depts, setDepts] = useState([])
  const [sections, setSections] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterRole, setFilterRole] = useState('')
  const [filterDept, setFilterDept] = useState('')
  const [filterActive, setFilterActive] = useState('true')
  const [sortBy, setSortBy] = useState('role_level')
  const [sortOrder, setSortOrder] = useState('desc')
  const [modal, setModal] = useState(null) // null | 'add' | 'edit'
  const [editUser, setEditUser] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [pwModal, setPwModal] = useState(null)
  const [pw, setPw] = useState({ new_password: '', confirm: '' })
  const [pwError, setPwError] = useState('')

  const handleSort = (key, order) => {
    setSortBy(key)
    setSortOrder(order)
  }

  const load = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (filterActive) params.set('is_active', filterActive)
    const [u, r, d, s] = await Promise.all([
      API(`/api/users?${params}`),
      API('/api/users/roles'),
      API('/api/users/departments'),
      API('/api/users/sections'),
    ])
    if (u.success) setUsers(u.data)
    if (r.success) setRoles(r.data)
    if (d.success) setDepts(d.data)
    if (s?.success) setSections(s.data)
    setLoading(false)
  }, [filterActive])

  useEffect(() => { load() }, [load])

  const filtered = sortTableData(
    users.filter(u => {
      const q = search.toLowerCase()
      const matchSearch = !q || u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q) || u.employee_code?.toLowerCase().includes(q)
      const matchRole = !filterRole || String(u.role_level) === filterRole || u.role === filterRole
      const matchDept = !filterDept || u.department === filterDept
      return matchSearch && matchRole && matchDept
    }),
    sortBy,
    sortOrder
  )

  const openAdd = () => { setForm(emptyForm); setFormError(''); setEditUser(null); setModal('add') }
  const openEdit = u => {
    setForm({
      name: u.name,
      email: u.email,
      password: '',
      mobile: u.mobile || '',
      role_id: u.role_id || '',
      department_id: u.department_id || '',
      section_id: u.section_id || '',
      shift: u.shift || 'General',
      employee_code: u.employee_code || '',
      is_active: u.is_active
    })
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

  const deleteUser = async u => {
    if (!window.confirm(`Are you sure you want to deactivate and remove access for ${u.name} (${u.email})?`)) return
    await API(`/api/users/${u.id}`, { method: 'DELETE' })
    load()
  }

  const roleColor = level => ({ 5: '#ef4444', 4: '#f97316', 3: '#eab308', 2: '#0284c7', 1: '#64748b' }[level] || '#8a8a90')

  return (
    <div style={S.page}>
      {/* Header */}
      <div style={S.header}>
        <div>
          <div style={S.title}>👥 Users &amp; Plant Role Allocation Master</div>
          <div style={S.sub}>Manage system users, assigned plant sections, and Store Manager approval hierarchies</div>
        </div>
        <button style={S.btnPrimary} onClick={openAdd}>＋ Add Operator / User</button>
      </div>

      {/* Store Hierarchy & Approval Guidance Banner */}
      <div style={{
        background: '#fff',
        border: '1px solid #e2e8f0',
        borderRadius: 8,
        padding: '12px 16px',
        marginBottom: 16,
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 24 }}>🛡️</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>
                Store Hierarchy &amp; Operator Approval Clause Matrix
              </div>
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                <strong>Store Assistant / Operator (L1/L2):</strong> Authorized for Daily Inward Intake, Outward Issues, Stock Counts &amp; Indent Drafting.
                <span style={{ color: '#ea580c', fontWeight: 600, marginLeft: 6 }}>
                  ⚠️ Clause: High-value PO GRN confirmations, L1 Indent Approvals &amp; Stock adjustments require Store Manager (L3) sign-off.
                </span>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6, fontSize: 11 }}>
            <span style={{ background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0', padding: '3px 8px', borderRadius: 4, fontWeight: 600 }}>✓ Live Store Sync</span>
            <span style={{ background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', padding: '3px 8px', borderRadius: 4, fontWeight: 600 }}>✓ Section Allocated</span>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div style={S.filterBar}>
        <input style={S.input} placeholder="Search name / email / code..." value={search} onChange={e => setSearch(e.target.value)} />
        <SearchableSelect
          value={filterRole}
          onChange={val => setFilterRole(val)}
          placeholder="All Roles"
          searchPlaceholder="Type role name..."
          style={{ width: 190 }}
          options={roles.map(r => ({ value: r.name, label: `${r.name} (L${r.level})` }))}
        />
        <SearchableSelect
          value={filterDept}
          onChange={val => setFilterDept(val)}
          placeholder="All Depts"
          searchPlaceholder="Type department name..."
          style={{ width: 190 }}
          options={depts.map(d => ({ value: d.name, label: d.name }))}
        />
        <select style={S.select} value={filterActive} onChange={e => setFilterActive(e.target.value)}>
          <option value="true">Active Only</option>
          <option value="false">Inactive Only</option>
          <option value="">All Users</option>
        </select>
        <button style={S.btnSecondary} onClick={load} title="Refresh User List">↻ Refresh</button>
      </div>

      {/* Table */}
      {loading ? <div style={S.loading}>Loading system users...</div> : (
        <TableScrollWrapper title="System Users Directory">
          <table style={S.table}>
            <thead>
              <tr style={S.thead}>
                <SortableTh label="Emp Code" columnKey="employee_code" currentSortKey={sortBy} currentSortOrder={sortOrder} onSort={handleSort} width={110} />
                <SortableTh label="Name" columnKey="name" currentSortKey={sortBy} currentSortOrder={sortOrder} onSort={handleSort} />
                <SortableTh label="Email / Mobile" columnKey="email" currentSortKey={sortBy} currentSortOrder={sortOrder} onSort={handleSort} />
                <SortableTh label="Role / Level" columnKey="role_level" currentSortKey={sortBy} currentSortOrder={sortOrder} onSort={handleSort} width={130} />
                <SortableTh label="Department" columnKey="department" currentSortKey={sortBy} currentSortOrder={sortOrder} onSort={handleSort} />
                <SortableTh label="Assigned Section" columnKey="section_name" currentSortKey={sortBy} currentSortOrder={sortOrder} onSort={handleSort} />
                <SortableTh label="Shift" columnKey="shift" currentSortKey={sortBy} currentSortOrder={sortOrder} onSort={handleSort} width={90} />
                <SortableTh label="Status" columnKey="is_active" currentSortKey={sortBy} currentSortOrder={sortOrder} onSort={handleSort} width={90} align="center" />
                <th style={{ ...S.th, width: 100, textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={9} style={S.empty}>No users matching the filter criteria.</td></tr>
              )}
              {filtered.map(u => (
                <tr key={u.id} style={S.tr}>
                  <td style={S.td}><span style={S.code}>{u.employee_code || '—'}</span></td>
                  <td style={S.td}>
                    <div style={S.name}>{u.name}</div>
                    {u.role_level <= 2 && (
                      <span style={{ fontSize: 10, color: '#0284c7', fontWeight: 600 }}>
                        ↳ Reports to: {u.department || 'Store'} Manager
                      </span>
                    )}
                  </td>
                  <td style={S.td}>
                    <div style={S.muted}>{u.email}</div>
                    {u.mobile && <div style={{ fontSize: 11, color: '#8a8a90' }}>📱 {u.mobile}</div>}
                  </td>
                  <td style={S.td}>
                    <span style={{ ...S.badge, background: roleColor(u.role_level) + '22', color: roleColor(u.role_level), border: `1px solid ${roleColor(u.role_level)}44` }}>
                      {u.role} (L{u.role_level})
                    </span>
                  </td>
                  <td style={S.td}><span style={S.muted}>{u.department || '—'}</span></td>
                  <td style={S.td}>
                    {u.section_name ? (
                      <span style={{ background: '#f1f5f9', color: '#0f172a', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, border: '1px solid #cbd5e1' }}>
                        🏭 {u.section_name}
                      </span>
                    ) : (
                      <span style={{ color: '#94a3b8', fontSize: 11 }}>— General / All —</span>
                    )}
                  </td>
                  <td style={S.td}><span style={S.muted}>{u.shift || 'General'}</span></td>
                  <td style={S.td}>
                    <span style={{ ...S.badge, background: u.is_active ? '#22c55e22' : '#ef444422', color: u.is_active ? '#22c55e' : '#ef4444', border: `1px solid ${u.is_active ? '#22c55e44' : '#ef444444'}` }}>
                      {u.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td style={S.td}>
                    <div style={S.actions}>
                      <button style={S.btnIcon} title="Edit User & Section" onClick={() => openEdit(u)}>✏️</button>
                      <button style={S.btnIcon} title="Reset Password" onClick={() => { setPwModal(u); setPw({ new_password: '', confirm: '' }); setPwError('') }}>🔑</button>
                      <button style={{ ...S.btnIcon, opacity: 0.8 }} title={u.is_active ? 'Deactivate User' : 'Activate User'} onClick={() => toggleActive(u)}>
                        {u.is_active ? '🔴' : '🟢'}
                      </button>
                      <button style={{ ...S.btnIcon, color: '#ef4444' }} title="Remove / Soft Delete" onClick={() => deleteUser(u)}>🗑️</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableScrollWrapper>
      )}
      <div style={S.count}>{filtered.length} user{filtered.length !== 1 ? 's' : ''} active in mill directory</div>

      {/* Add/Edit Modal */}
      {modal && (
        <div style={S.overlay} onClick={() => setModal(null)}>
          <div style={S.modal} onClick={e => e.stopPropagation()}>
            <div style={S.modalHeader}>
              <div style={S.modalTitle}>{modal === 'add' ? 'Add New User / Store Operator' : `Edit: ${editUser?.name}`}</div>
              <button style={S.close} onClick={() => setModal(null)}>✕</button>
            </div>
            <form onSubmit={saveUser} style={S.form}>
              <div style={S.grid2}>
                <label style={S.label}>Full Name *
                  <input style={S.input} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Ramesh Kumar (Store Assistant)" required />
                </label>
                <label style={S.label}>Email *
                  <input style={S.input} type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="store.assistant@mkpapermill.com" required />
                </label>
                <label style={S.label}>{modal === 'add' ? 'Password *' : 'New Password (blank = no change)'}
                  <input style={S.input} type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="Min 6 chars" />
                </label>
                <label style={S.label}>Mobile
                  <input style={S.input} value={form.mobile} onChange={e => setForm(f => ({ ...f, mobile: e.target.value }))} placeholder="10-digit mobile" />
                </label>
                <label style={S.label}>Role &amp; Permission Level *
                  <SearchableSelect
                    value={String(form.role_id || '')}
                    onChange={val => setForm(f => ({ ...f, role_id: val }))}
                    placeholder="-- Select Role --"
                    searchPlaceholder="Type role name..."
                    required
                    options={roles.map(r => ({ value: String(r.id), label: `${r.name} (Level ${r.level})` }))}
                  />
                </label>
                <label style={S.label}>Department
                  <SearchableSelect
                    value={String(form.department_id || '')}
                    onChange={val => setForm(f => ({ ...f, department_id: val }))}
                    placeholder="-- Select Dept --"
                    searchPlaceholder="Type department name..."
                    options={depts.map(d => ({ value: String(d.id), label: d.name }))}
                  />
                </label>
                <label style={S.label}>Assigned Plant Section
                  <SearchableSelect
                    value={String(form.section_id || '')}
                    onChange={val => setForm(f => ({ ...f, section_id: val }))}
                    placeholder="-- General / Plant-Wide --"
                    searchPlaceholder="Type section name..."
                    options={sections.map(s => ({ value: String(s.id), label: `${s.name} (${s.code})` }))}
                  />
                </label>
                <label style={S.label}>Employee Code
                  <input style={S.input} value={form.employee_code} onChange={e => setForm(f => ({ ...f, employee_code: e.target.value }))} placeholder="STORE-ASST-01" />
                </label>
                <label style={S.label}>Default Shift
                  <select style={S.select} value={form.shift} onChange={e => setForm(f => ({ ...f, shift: e.target.value }))}>
                    {SHIFTS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </label>
              </div>

              {/* Roles & Responsibility Note */}
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#475569' }}>
                <strong>📌 Roles &amp; Responsibilities:</strong> Basic daily entries (Inward GRN intake, Outward Issue drafting, Indent creation) will be permitted. Final approval clauses remain with the Department / Store Manager.
              </div>

              {modal === 'edit' && (
                <label style={{ ...S.label, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <input type="checkbox" checked={form.is_active} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} />
                  <span>Active Account</span>
                </label>
              )}
              {formError && <div style={S.error}>⚠️ {formError}</div>}
              <div style={S.modalFooter}>
                <button type="button" style={S.btnSecondary} onClick={() => setModal(null)}>Cancel</button>
                <button type="submit" style={S.btnPrimary} disabled={saving}>{saving ? 'Saving...' : (modal === 'add' ? 'Create User / Operator' : 'Save Changes')}</button>
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
                <input style={S.input} type="password" value={pw.new_password} onChange={e => setPw(p => ({ ...p, new_password: e.target.value }))} placeholder="Min 6 characters" required />
              </label>
              <label style={S.label}>Confirm Password
                <input style={S.input} type="password" value={pw.confirm} onChange={e => setPw(p => ({ ...p, confirm: e.target.value }))} placeholder="Re-enter password" required />
              </label>
              {pwError && <div style={S.error}>⚠️ {pwError}</div>}
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
