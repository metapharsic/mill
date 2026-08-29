import React, { useState, useEffect, useCallback } from 'react'

const API = (path, opts) => fetch(path, {
  headers: { Authorization: `Bearer ${localStorage.getItem('mk_token')}`, 'Content-Type': 'application/json', ...(opts?.headers || {}) },
  ...opts,
}).then(r => r.json())

const empty = { name: '', code: '', gsm_min: '', gsm_max: '', description: '', is_active: true }

export default function Grades() {
  const [grades, setGrades] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState(false)
  const [edit, setEdit] = useState(null)
  const [form, setForm] = useState(empty)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const r = await API('/api/master/grades')
    if (r.success) setGrades(r.data)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = grades.filter(g =>
    !search || g.name.toLowerCase().includes(search.toLowerCase()) || g.code?.toLowerCase().includes(search.toLowerCase())
  )

  const openAdd = () => { setForm(empty); setErr(''); setEdit(null); setModal(true) }
  const openEdit = g => { setForm({ ...g }); setErr(''); setEdit(g); setModal(true) }
  const del = async g => { if (!window.confirm(`Deactivate grade "${g.name}"?`)) return; await API(`/api/master/grades/${g.id}`, { method: 'DELETE' }); load() }
  const restore = async g => { await API(`/api/master/grades/${g.id}/restore`, { method: 'PUT' }); load() }

  const save = async e => {
    e.preventDefault()
    if (!form.name || !form.code) return setErr('Name and code required')
    if (form.gsm_min && form.gsm_max && parseFloat(form.gsm_max) < parseFloat(form.gsm_min))
      return setErr('GSM Max must be >= GSM Min')
    setSaving(true); setErr('')
    const res = edit
      ? await API(`/api/master/grades/${edit.id}`, { method: 'PUT', body: JSON.stringify(form) })
      : await API('/api/master/grades', { method: 'POST', body: JSON.stringify(form) })
    setSaving(false)
    if (res.success) { setModal(false); load() }
    else setErr(res.message)
  }

  return (
    <div style={S.page}>
      <div style={S.header}>
        <div>
          <div style={S.title}>Paper Grades</div>
          <div style={S.sub}>Kraft, Writing, Newsprint, Board, Tissue and custom grades</div>
        </div>
        <button style={S.btnPrimary} onClick={openAdd}>+ Add Grade</button>
      </div>

      <div style={S.filterBar}>
        <input style={S.input} placeholder="Search grade name / code..." value={search} onChange={e => setSearch(e.target.value)} />
        <button style={S.btnSecondary} onClick={load}>↻</button>
      </div>

      <div style={S.cardGrid}>
        {loading ? <div style={S.loading}>Loading...</div> : filtered.length === 0 ? <div style={S.loading}>No grades found</div> : filtered.map(g => (
          <div key={g.id} style={{ ...S.card, opacity: g.is_active ? 1 : 0.5 }}>
            <div style={S.cardTop}>
              <div style={S.gradeCode}>{g.code}</div>
              <span style={{ ...S.badge, background: g.is_active ? '#22c55e22' : '#ef444422', color: g.is_active ? '#22c55e' : '#ef4444', border: `1px solid ${g.is_active ? '#22c55e44' : '#ef444444'}` }}>
                {g.is_active ? 'Active' : 'Inactive'}
              </span>
            </div>
            <div style={S.gradeName}>{g.name}</div>
            {(g.gsm_min || g.gsm_max) && (
              <div style={S.gradeGsm}>
                GSM: {g.gsm_min || '—'} – {g.gsm_max || '—'} g/m²
              </div>
            )}
            {g.description && <div style={S.gradeDesc}>{g.description}</div>}
            <div style={{ display:'flex', gap:6, marginTop:8 }}>
              <button style={S.editBtn} onClick={() => openEdit(g)}>✏️ Edit</button>
              {g.is_active
                ? <button style={{ ...S.editBtn, background:'#fee2e2', color:'#dc2626', borderColor:'#fecaca' }} onClick={() => del(g)}>🗑️ Delete</button>
                : <button style={{ ...S.editBtn, background:'#dcfce7', color:'#16a34a', borderColor:'#bbf7d0' }} onClick={() => restore(g)}>♻️ Restore</button>
              }
            </div>
          </div>
        ))}
      </div>

      {modal && (
        <div style={S.overlay}>
          <div style={S.modal} onClick={e => e.stopPropagation()}>
            <div style={S.modalHeader}>
              <div style={S.modalTitle}>{edit ? `Edit: ${edit.name}` : 'Add Grade'}</div>
              <button style={S.close} onClick={() => setModal(false)}>✕</button>
            </div>
            <form onSubmit={save} style={S.form}>
              <div style={S.grid2}>
                <label style={S.label}>Grade Code *
                  <input style={S.input} value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))} placeholder="KFT, WRT..." />
                </label>
                <label style={S.label}>Grade Name *
                  <input style={S.input} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Kraft, Writing Paper..." />
                </label>
                <label style={S.label}>GSM Min (g/m²)
                  <input style={S.input} type="number" step="0.1" value={form.gsm_min} onChange={e => setForm(f => ({ ...f, gsm_min: e.target.value }))} placeholder="40" />
                </label>
                <label style={S.label}>GSM Max (g/m²)
                  <input style={S.input} type="number" step="0.1" value={form.gsm_max} onChange={e => setForm(f => ({ ...f, gsm_max: e.target.value }))} placeholder="200" />
                </label>
              </div>
              <label style={S.label}>Description
                <textarea style={{ ...S.input, height: 70, resize: 'vertical' }} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Grade description and use cases..." />
              </label>
              {edit && (
                <label style={{ ...S.label, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <input type="checkbox" checked={form.is_active} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} />
                  <span>Active</span>
                </label>
              )}
              {err && <div style={S.error}>{err}</div>}
              <div style={S.modalFooter}>
                <button type="button" style={S.btnSecondary} onClick={() => setModal(false)}>Cancel</button>
                <button type="submit" style={S.btnPrimary} disabled={saving}>{saving ? 'Saving...' : (edit ? 'Save Changes' : 'Add Grade')}</button>
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
  filterBar: { display: 'flex', gap: 10, marginBottom: 16 },
  cardGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 },
  card: { background: '#ffffff', border: '1px solid #e7e6df', borderRadius: 10, padding: 18, display: 'flex', flexDirection: 'column', gap: 8 },
  cardTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  gradeCode: { fontFamily: 'monospace', background: '#f6f5f0', padding: '3px 8px', borderRadius: 6, fontSize: 12, color: '#1b1b1d', fontWeight: 700 },
  gradeName: { fontSize: 16, fontWeight: 700, color: '#1b1b1d' },
  gradeGsm: { fontSize: 13, color: '#a0a0a6' },
  gradeDesc: { fontSize: 12, color: '#8a8a90', lineHeight: 1.5 },
  editBtn: { background: '#e7e6df', border: 'none', color: '#1b1b1d', borderRadius: 6, padding: '5px 10px', cursor: 'pointer', fontSize: 12, marginTop: 4, alignSelf: 'flex-start' },
  badge: { fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20, display: 'inline-block' },
  loading: { padding: 40, textAlign: 'center', color: '#8a8a90', gridColumn: '1/-1' },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modal: { background: '#ffffff', borderRadius: 12, padding: 24, width: '100%', maxWidth: 520, border: '1px solid #e7e6df' },
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
