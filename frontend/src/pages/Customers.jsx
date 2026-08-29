import React, { useState, useEffect, useCallback } from 'react'

const API = (path, opts) => fetch(path, {
  headers: { Authorization: `Bearer ${localStorage.getItem('mk_token')}`, 'Content-Type': 'application/json', ...(opts?.headers || {}) },
  ...opts,
}).then(r => r.json())

// Schema: code,name,gstin,pan,address,city,state,pincode,contact_person,mobile,email,credit_limit,credit_days,is_active
const empty = { name: '', contact_person: '', mobile: '', email: '', address: '', city: '', state: '', pincode: '', gstin: '', pan: '', credit_limit: '', credit_days: 30, is_active: true }

export default function Customers() {
  const [customers, setCustomers] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterActive, setFilterActive] = useState('true')
  const [page, setPage] = useState(1)
  const [modal, setModal] = useState(false)
  const [edit, setEdit] = useState(null)
  const [form, setForm] = useState(empty)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const [tab, setTab] = useState('basic')
  const LIMIT = 20

  const load = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ page, limit: LIMIT })
    if (filterActive) params.set('is_active', filterActive)
    if (search) params.set('search', search)
    const r = await API(`/api/master/customers?${params}`)
    if (r.success) { setCustomers(r.data); setTotal(r.total) }
    setLoading(false)
  }, [page, filterActive, search])

  useEffect(() => { load() }, [load])

  const openAdd = () => { setForm(empty); setErr(''); setEdit(null); setTab('basic'); setModal(true) }
  const openEdit = c => { setForm({ name: c.name, contact_person: c.contact_person||'', mobile: c.mobile||'', email: c.email||'', address: c.address||'', city: c.city||'', state: c.state||'', pincode: c.pincode||'', gstin: c.gstin||'', pan: c.pan||'', credit_limit: c.credit_limit||'', credit_days: c.credit_days||30, is_active: c.is_active }); setErr(''); setEdit(c); setTab('basic'); setModal(true) }
  const del = async c => { if (!window.confirm(`Deactivate "${c.name}"?`)) return; await API(`/api/master/customers/${c.id}`, { method: 'DELETE' }); load() }
  const restore = async c => { await API(`/api/master/customers/${c.id}/restore`, { method: 'PUT' }); load() }

  const save = async e => {
    e.preventDefault()
    if (!form.name) return setErr('Customer name required')
    setSaving(true); setErr('')
    const res = edit
      ? await API(`/api/master/customers/${edit.id}`, { method: 'PUT', body: JSON.stringify(form) })
      : await API('/api/master/customers', { method: 'POST', body: JSON.stringify(form) })
    setSaving(false)
    if (res.success) { setModal(false); load() }
    else setErr(res.message)
  }

  const F = (key, label, type = 'text', ph = '') => (
    <label style={S.label}>{label}
      <input style={S.input} type={type} value={form[key]??''} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} placeholder={ph} />
    </label>
  )

  const totalPages = Math.ceil(total / LIMIT)
  const fmt = v => v ? `₹${Number(v).toLocaleString('en-IN')}` : '—'

  return (
    <div style={S.page}>
      <div style={S.header}>
        <div>
          <div style={S.title}>Customers</div>
          <div style={S.sub}>{total} customers registered</div>
        </div>
        <button style={S.btnPrimary} onClick={openAdd}>+ Add Customer</button>
      </div>

      <div style={S.filterBar}>
        <input style={{ ...S.input, flex: 1, maxWidth: 320 }} placeholder="Search name / code / GSTIN..." value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} />
        <select style={S.select} value={filterActive} onChange={e => { setFilterActive(e.target.value); setPage(1) }}>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
          <option value="">All</option>
        </select>
        <button style={S.btnSecondary} onClick={load}>↻</button>
      </div>

      <div style={S.tableWrap}>
        {loading ? <div style={S.loading}>Loading...</div> : (
          <table style={S.table}>
            <thead>
              <tr style={S.thead}>
                {['Code', 'Name', 'Mobile', 'City', 'GSTIN', 'Credit Limit', 'Credit Days', 'Status', 'Actions'].map(h => (
                  <th key={h} style={S.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {customers.length === 0 && <tr><td colSpan={9} style={S.empty}>No customers found</td></tr>}
              {customers.map(c => (
                <tr key={c.id} style={S.tr}>
                  <td style={S.td}><span style={S.code}>{c.code}</span></td>
                  <td style={S.td}><div style={S.name}>{c.name}</div><div style={S.muted}>{c.email||''}</div></td>
                  <td style={S.td}><span style={S.muted}>{c.mobile||'—'}</span></td>
                  <td style={S.td}><span style={S.muted}>{c.city||'—'}{c.state ? `, ${c.state}` : ''}</span></td>
                  <td style={S.td}><span style={S.mono}>{c.gstin||'—'}</span></td>
                  <td style={S.td}><span style={S.num}>{fmt(c.credit_limit)}</span></td>
                  <td style={S.td}><span style={S.muted}>{c.credit_days||'—'} days</span></td>
                  <td style={S.td}>
                    <span style={{ ...S.badge, background: c.is_active ? '#22c55e22' : '#ef444422', color: c.is_active ? '#22c55e' : '#ef4444', border: `1px solid ${c.is_active ? '#22c55e44' : '#ef444444'}` }}>
                      {c.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td style={S.td}>
                    <button style={S.btnIcon} onClick={() => openEdit(c)} title="Edit">✏️</button>
                    {c.is_active
                      ? <button style={{ ...S.btnIcon, color: '#ef4444' }} onClick={() => del(c)} title="Deactivate">🗑️</button>
                      : <button style={{ ...S.btnIcon, color: '#22c55e' }} onClick={() => restore(c)} title="Restore">♻️</button>
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <div style={S.pagination}>
        <span style={S.count}>Showing {customers.length} of {total}</span>
        <div style={{ display: 'flex', gap: 6 }}>
          <button style={S.pgBtn} disabled={page === 1} onClick={() => setPage(p => p - 1)}>‹ Prev</button>
          <span style={S.pgInfo}>{page} / {totalPages || 1}</span>
          <button style={S.pgBtn} disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next ›</button>
        </div>
      </div>

      {modal && (
        <div style={S.overlay}>
          <div style={S.modal} onClick={e => e.stopPropagation()}>
            <div style={S.modalHeader}>
              <div style={S.modalTitle}>{edit ? `Edit: ${edit.name}` : 'Add Customer'}</div>
              <button style={S.close} onClick={() => setModal(false)}>✕</button>
            </div>
            <div style={S.tabs}>
              {['basic', 'address', 'tax', 'terms'].map(t => (
                <button key={t} style={{ ...S.tabBtn, ...(tab === t ? S.tabActive : {}) }} onClick={() => setTab(t)}>
                  {{ basic: 'Basic Info', address: 'Address', tax: 'Tax / Compliance', terms: 'Credit & Terms' }[t]}
                </button>
              ))}
            </div>
            <form onSubmit={save} style={S.form}>
              {tab === 'basic' && (
                <div style={S.grid2}>
                  {F('name', 'Customer Name *', 'text', 'Company name')}
                  {F('contact_person', 'Contact Person')}
                  {F('mobile', 'Mobile', 'tel', '10-digit')}
                  {F('email', 'Email', 'email')}
                </div>
              )}
              {tab === 'address' && (
                <>
                  <label style={S.label}>Address
                    <textarea style={{ ...S.input, height: 70, resize: 'vertical' }} value={form.address||''} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="Full address" />
                  </label>
                  <div style={S.grid2}>
                    {F('city','City')} {F('state','State')} {F('pincode','PIN Code')}
                  </div>
                </>
              )}
              {tab === 'tax' && (
                <div style={S.grid2}>
                  {F('gstin','GSTIN','text','15-char')} {F('pan','PAN','text','10-char')}
                </div>
              )}
              {tab === 'terms' && (
                <div style={S.grid2}>
                  <label style={S.label}>Credit Limit (₹)
                    <input style={S.input} type="number" step="0.01" value={form.credit_limit||''} onChange={e => setForm(f => ({ ...f, credit_limit: e.target.value }))} placeholder="1000000" />
                  </label>
                  <label style={S.label}>Credit Days
                    <input style={S.input} type="number" value={form.credit_days||''} onChange={e => setForm(f => ({ ...f, credit_days: e.target.value }))} placeholder="30" />
                  </label>
                  <label style={{ ...S.label, flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 22 }}>
                    <input type="checkbox" checked={form.is_active} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} />
                    <span>Active</span>
                  </label>
                </div>
              )}
              {err && <div style={S.error}>{err}</div>}
              <div style={S.modalFooter}>
                <button type="button" style={S.btnSecondary} onClick={() => setModal(false)}>Cancel</button>
                <button type="submit" style={S.btnPrimary} disabled={saving}>{saving ? 'Saving...' : (edit ? 'Save Changes' : 'Add Customer')}</button>
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
  tr: { borderBottom: '1px solid #f1efe8' },
  td: { padding: '10px 14px', verticalAlign: 'middle' },
  name: { fontWeight: 600, color: '#1b1b1d' },
  muted: { color: '#a0a0a6', fontSize: 12 },
  mono: { fontFamily: 'monospace', fontSize: 12, color: '#a0a0a6' },
  num: { color: '#1b1b1d', fontVariantNumeric: 'tabular-nums' },
  code: { fontFamily: 'monospace', background: '#f6f5f0', padding: '2px 6px', borderRadius: 4, fontSize: 11, color: '#a0a0a6' },
  badge: { fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20, display: 'inline-block' },
  btnIcon: { background: 'none', border: 'none', cursor: 'pointer', fontSize: 14 },
  empty: { padding: 40, textAlign: 'center', color: '#8a8a90' },
  loading: { padding: 40, textAlign: 'center', color: '#8a8a90' },
  pagination: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 },
  count: { fontSize: 12, color: '#8a8a90' },
  pgBtn: { background: '#ffffff', border: '1px solid #e7e6df', color: '#1b1b1d', borderRadius: 6, padding: '5px 12px', cursor: 'pointer', fontSize: 12 },
  pgInfo: { fontSize: 12, color: '#a0a0a6', padding: '5px 8px' },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modal: { background: '#ffffff', borderRadius: 12, padding: 24, width: '100%', maxWidth: 640, border: '1px solid #e7e6df', maxHeight: '90vh', overflowY: 'auto' },
  modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 16, fontWeight: 700, color: '#1b1b1d' },
  close: { background: 'none', border: 'none', color: '#a0a0a6', fontSize: 18, cursor: 'pointer' },
  tabs: { display: 'flex', gap: 4, marginBottom: 16, borderBottom: '1px solid #e7e6df' },
  tabBtn: { background: 'none', border: 'none', color: '#8a8a90', padding: '8px 14px', cursor: 'pointer', fontSize: 13, fontWeight: 500, borderBottom: '2px solid transparent', marginBottom: -1 },
  tabActive: { color: '#1b1b1d', borderBottom: '2px solid #1b1b1d' },
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
