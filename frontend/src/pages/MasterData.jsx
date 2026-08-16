import React, { useState, useEffect, useCallback } from 'react'

const API = (path, opts) => fetch(path, {
  headers: { Authorization: `Bearer ${localStorage.getItem('mk_token')}`, 'Content-Type': 'application/json', ...(opts?.headers || {}) },
  ...opts,
}).then(r => r.json())

export default function MasterData() {
  const [tab, setTab] = useState('summary')
  const [sections, setSections] = useState([])
  const [departments, setDepartments] = useState([])
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ name: '', code: '', department_id: '' })
  const [modal, setModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const [searchTerm, setSearchTerm] = useState('')

  const loadData = useCallback(async () => {
    if (tab !== 'sections') return
    setLoading(true)
    const [secRes, deptRes] = await Promise.all([
      API('/api/master/sections'),
      API('/api/users/departments'),
    ])
    if (secRes.success) setSections(secRes.data)
    if (deptRes.success) setDepartments(deptRes.data)
    setLoading(false)
  }, [tab])

  useEffect(() => { loadData() }, [loadData])

  const saveSection = async (e) => {
    e.preventDefault()
    if (!form.name) return setErr('Name is required')
    setSaving(true)
    const res = form.id 
      ? await API(`/api/master/sections/${form.id}`, { method: 'PUT', body: JSON.stringify(form) })
      : await API('/api/master/sections', { method: 'POST', body: JSON.stringify(form) })
    setSaving(false)
    if (res.success) {
      setModal(false)
      setForm({ name: '', code: '', department_id: '' })
      loadData()
    } else {
      setErr(res.message || 'Error saving')
    }
  }

  const openEditSection = (s) => {
    setForm({ id: s.id, name: s.name, code: s.code || '', department_id: s.department_id || '' })
    setErr('')
    setModal(true)
  }

  const MODULES = [
    { title: 'Customers', status: 'Live', color: '#1b1b1d', desc: 'Keep company names, contacts, credit terms, and GST info.', bullets: ['Add and edit customers', 'Search and filter', 'Credit and payment terms'] },
    { title: 'Materials', status: 'Live', color: '#1b1b1d', desc: 'Track raw materials, UOM, stock, reorder points, and GST.', bullets: ['Material master', 'Category setup', 'Reorder alerts'] },
    { title: 'Vendors', status: 'Live', color: '#1b1b1d', desc: 'Manage supplier details, payment terms, and vendor records.', bullets: ['Vendor list', 'Contact details', 'Terms and status'] },
    { title: 'Grades', status: 'Live', color: '#16a34a', desc: 'Keep paper grades, quality specs, and grade-level metadata.', bullets: ['Grade catalog', 'Quality notes', 'Simple lookup'] },
    { title: 'Machines', status: 'Live', color: '#d97706', desc: 'Record machines, maintenance data, and equipment setup.', bullets: ['Machine master', 'Setup info', 'Status tracking'] },
    { title: 'Users', status: 'Live', color: '#dc2626', desc: 'Control user access, roles, shifts, and departments.', bullets: ['User setup', 'Role and dept', 'Password reset'] },
  ]

  return (
    <div style={S.page}>
      <div style={S.header}>
        <div>
          <div style={S.title}>Phase 2 — Master Data</div>
          <div style={S.sub}>Big bone data. All main master records now have a home.</div>
        </div>
        <div style={S.tabs}>
          <button style={{ ...S.tabBtn, ...(tab === 'summary' ? S.tabActive : {}) }} onClick={() => setTab('summary')}>Overview</button>
          <button style={{ ...S.tabBtn, ...(tab === 'sections' ? S.tabActive : {}) }} onClick={() => setTab('sections')}>Plant Sections (F5)</button>
        </div>
      </div>

      {tab === 'summary' && (
        <>
          <div style={S.hero}>
            <div style={S.heroTitle}>This phase make system strong.</div>
            <div style={S.heroText}>Customers, materials, vendors, grades, machines, and users now have working screens so the ERP can grow from solid base.</div>
          </div>
          <div style={S.grid}>
            {MODULES.map(mod => (
              <div key={mod.title} style={S.card}>
                <div style={S.cardTop}>
                  <div style={{ ...S.cardTitle, color: mod.color }}>{mod.title}</div>
                  <span style={{ ...S.statusBadge, background: `${mod.color}18`, color: mod.color }}>{mod.status}</span>
                </div>
                <div style={S.desc}>{mod.desc}</div>
                <ul style={S.list}>
                  {mod.bullets.map(item => <li key={item} style={S.listItem}>{item}</li>)}
                </ul>
              </div>
            ))}
          </div>
        </>
      )}

      {tab === 'sections' && (
        <div style={S.sectionContainer}>
          <div style={S.card}>
            <div style={{ ...S.header, marginBottom: 16 }}>
              <div style={S.cardTitle}>Sections</div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <input style={{...S.input, maxWidth: 200}} placeholder="Search sections..." value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} />
                <button style={S.btnPrimary} onClick={() => { setForm({ name: '', code: '', department_id: '' }); setErr(''); setModal(true) }}>+ Add Section</button>
              </div>
            </div>
            
            {loading ? <div style={S.loading}>Loading...</div> : (
              <table style={S.table}>
                <thead>
                  <tr style={S.thead}>
                    {['Action', 'Code', 'Name', 'Department', 'Status'].map(h => <th key={h} style={S.th}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {sections.filter(s => !searchTerm || s.name.toLowerCase().includes(searchTerm.toLowerCase()) || (s.code||'').toLowerCase().includes(searchTerm.toLowerCase())).length === 0 && <tr><td colSpan={5} style={S.empty}>No sections found</td></tr>}
                  {sections.filter(s => !searchTerm || s.name.toLowerCase().includes(searchTerm.toLowerCase()) || (s.code||'').toLowerCase().includes(searchTerm.toLowerCase())).map(sec => (
                    <tr key={sec.id} style={S.tr}>
                      <td style={S.td}>
                        <button style={{ ...S.btnSecondary, padding: '4px 8px', fontSize: 12 }} onClick={() => openEditSection(sec)}>✏️ Edit</button>
                      </td>
                      <td style={S.td}><strong>{sec.code || '—'}</strong></td>
                      <td style={S.td}>{sec.name}</td>
                      <td style={S.td}>{sec.departmentName || 'Production'}</td>
                      <td style={S.td}>
                        <span style={{ ...S.statusBadge, background: sec.is_active ? '#22c55e22' : '#ef444422', color: sec.is_active ? '#22c55e' : '#ef4444' }}>
                          {sec.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {modal && (
        <div style={S.overlay} onClick={() => setModal(false)}>
          <div style={S.modal} onClick={e => e.stopPropagation()}>
            <div style={S.modalHeader}>
              <div style={S.modalTitle}>{form.id ? 'Edit Plant Section' : 'Add Plant Section'}</div>
              <button style={S.close} onClick={() => setModal(false)}>✕</button>
            </div>
            <form onSubmit={saveSection} style={S.form}>
              <label style={S.label}>Section Name *
                <input style={S.input} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required placeholder="e.g. Wire Part" />
              </label>
              <label style={S.label}>Section Code
                <input style={S.input} value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} placeholder="e.g. PM1_WIRE" />
              </label>
              <label style={S.label}>Responsible Department
                <select style={S.select} value={form.department_id} onChange={e => setForm(f => ({ ...f, department_id: e.target.value }))}>
                  <option value="">Select...</option>
                  {departments.map(d => <option key={d.id} value={d.id}>{d.name} ({d.code})</option>)}
                </select>
              </label>
              {err && <div style={S.error}>{err}</div>}
              <div style={S.modalFooter}>
                <button type="button" style={S.btnSecondary} onClick={() => setModal(false)}>Cancel</button>
                <button type="submit" style={S.btnPrimary} disabled={saving}>{saving ? 'Saving...' : 'Add Section'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

const S = {
  page: { padding: 24, background: '#f6f5f0', minHeight: '100vh' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap', marginBottom: 18 },
  title: { fontSize: 24, fontWeight: 700, color: '#1b1b1d' },
  sub: { fontSize: 13, color: '#8a8a90', marginTop: 4 },
  tabs: { display: 'flex', gap: 8, background: '#ecebe5', padding: 4, borderRadius: 8 },
  tabBtn: { background: 'none', border: 'none', padding: '6px 12px', fontSize: 13, fontWeight: 600, color: '#3a3a3e', borderRadius: 6, cursor: 'pointer' },
  tabActive: { background: '#fff', color: '#1b1b1d', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' },
  hero: { background: 'linear-gradient(90deg, #eff6ff, #f6f5f0)', border: '1px solid #dbeafe', borderRadius: 16, padding: 20, marginBottom: 18 },
  heroTitle: { fontSize: 18, fontWeight: 700, color: '#1e3a8a' },
  heroText: { fontSize: 14, color: '#3a3a3e', lineHeight: 1.6, marginTop: 4 },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 },
  card: { background: '#fff', border: '1px solid #ecebe5', borderRadius: 14, padding: 16, boxShadow: '0 1px 3px rgba(15,23,42,0.06)' },
  cardTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 8 },
  cardTitle: { fontSize: 16, fontWeight: 700 },
  statusBadge: { fontSize: 11, fontWeight: 700, padding: '4px 8px', borderRadius: 999 },
  desc: { fontSize: 13, color: '#3a3a3e', lineHeight: 1.5, marginBottom: 10 },
  list: { margin: 0, paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 4, color: '#3a3a3e' },
  listItem: { fontSize: 12 },
  sectionContainer: { background: '#fff', border: '1px solid #ecebe5', borderRadius: 16, padding: 20 },
  tableWrap: { overflowX: 'auto', marginTop: 12 },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  thead: { background: '#f6f5f0' },
  th: { textAlign: 'left', padding: '10px 12px', borderBottom: '2px solid #ecebe5', color: '#8a8a90', fontWeight: 700 },
  td: { padding: '10px 12px', borderBottom: '1px solid #f6f5f0', color: '#3a3a3e' },
  tr: { borderBottom: '1px solid #f6f5f0' },
  empty: { padding: 32, color: '#a0a0a6', textAlign: 'center' },
  loading: { padding: 32, color: '#a0a0a6', textAlign: 'center' },
  btnPrimary: { background: '#1b1b1d', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontWeight: 600, cursor: 'pointer', fontSize: 13 },
  btnSecondary: { background: '#ecebe5', color: '#3a3a3e', border: 'none', borderRadius: 8, padding: '8px 16px', fontWeight: 600, cursor: 'pointer', fontSize: 13 },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modal: { background: '#fff', borderRadius: 12, padding: 24, width: '100%', maxWidth: 480 },
  modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 16, fontWeight: 700, color: '#1b1b1d' },
  close: { background: 'none', border: 'none', color: '#a0a0a6', fontSize: 18, cursor: 'pointer' },
  form: { display: 'flex', flexDirection: 'column', gap: 14 },
  label: { display: 'flex', flexDirection: 'column', gap: 5, fontSize: 12, color: '#3a3a3e', fontWeight: 600 },
  input: { border: '1px solid #d8d6cc', borderRadius: 6, padding: '8px 10px', fontSize: 13, outline: 'none' },
  select: { border: '1px solid #d8d6cc', borderRadius: 6, padding: '8px 10px', fontSize: 13 },
  error: { color: '#ef4444', fontSize: 12 },
  modalFooter: { display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }
}
