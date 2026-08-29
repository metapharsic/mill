import React, { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'

const API = (path, opts) => fetch(path, {
  headers: { Authorization: `Bearer ${localStorage.getItem('mk_token')}`, 'Content-Type': 'application/json', ...(opts?.headers || {}) },
  ...opts,
}).then(r => r.json())

const TYPES = ['Paper Machine', 'Rewinder', 'Cutter', 'Pulper', 'Boiler', 'Compressor', 'ETP', 'Other']
const STATUSES = ['Running', 'Idle', 'Down', 'Maintenance']
const empty = { name: '', code: '', type: 'Paper Machine', capacity_tpd: '', ideal_speed_mpm: '', design_speed_mpm: '', is_active: true }

// Section names/codes come live from /api/master/sections (db table `sections`).
// Icon + machine-type classification aren't columns in that table, so they stay
// as small local lookup maps keyed by the stable `code`, not duplicated row data.
const ICON_BY_CODE = {
  PULPMILL: '🪵', CENTRICLEANER: '🌀', WIRE: '🕸️', VACUUM: '💨', PRESS: '🗜️', UNIRUN: '🏃',
  PRE_DRYER: '🔥', SIZE_PRESS: '📏', SIZE_KITCHEN: '🍳', POST_DRYER: '☀️', CALENDER: '🛢️',
  POPE_REEL: '⭕', REWINDER: '🔄', STARCH_KITCHEN: '🧪', STEAM_COND: '💧', ETP: '🍀',
  BOILER: '🌋', LAB: '🔬', CRANES: '🏗️', COMPRESSORS: '🌬️', STORE: '🏪',
}
const TYPE_BY_CODE = {
  PULPMILL: 'Pulper', REWINDER: 'Rewinder', ETP: 'ETP', BOILER: 'Boiler', COMPRESSORS: 'Compressor',
  LAB: 'Other', CRANES: 'Other', STORE: 'Other',
}
const ALL_SECTIONS_OPTION = { name: 'All Sections', code: 'ALL', type: 'All', icon: '🌐' }

export default function Machines() {
  const { user } = useAuth()
  const roleLevel = user?.role_level ?? 1
  const dept = (user?.department || '').toLowerCase()
  const deptCode = (user?.dept_code || '').toUpperCase()
  const isStoreManager = (
    (roleLevel >= 3 && (['STORE', 'INV', 'RMS', 'MATERIALS', 'MAINT', 'ADMIN'].includes(deptCode) || dept.includes('store') || dept.includes('inventory') || dept.includes('raw material') || dept.includes('maintenance') || dept.includes('admin'))) ||
    roleLevel >= 4
  )

  const [machines, setMachines] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [sectionSearch, setSectionSearch] = useState('')
  const [selectedSection, setSelectedSection] = useState('All Sections')
  const [modal, setModal] = useState(null)
  const [edit, setEdit] = useState(null)
  const [form, setForm] = useState(empty)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  // Positions State
  const [posModal, setPosModal] = useState(null) // holds selected machine object
  const [positions, setPositions] = useState([])
  const [posForm, setPosForm] = useState({ name: '', code: '' })
  const [posSaving, setPosSaving] = useState(false)

  const loadPositions = async (m) => {
    const r = await API(`/api/master/machines/${m.id}/positions`)
    if (r.success) setPositions(r.data)
  }

  const openPositions = (m) => {
    setPosModal(m)
    setPositions([])
    loadPositions(m)
  }

  const savePosition = async e => {
    e.preventDefault()
    if (!posForm.name || !posForm.code) return setErr('Name and code required')
    setPosSaving(true)
    const res = await API(`/api/master/machines/${posModal.id}/positions`, { method: 'POST', body: JSON.stringify(posForm) })
    setPosSaving(false)
    if (res.success) { setPosForm({ name: '', code: '' }); loadPositions(posModal) }
  }

  const [sections, setSections] = useState([ALL_SECTIONS_OPTION])

  const load = useCallback(async () => {
    setLoading(true)
    const r = await API('/api/master/machines')
    if (r.success) setMachines(r.data)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    API('/api/master/sections').then(r => {
      if (r.success) setSections([ALL_SECTIONS_OPTION, ...r.data.map(s => ({
        name: s.name, code: s.code,
        icon: ICON_BY_CODE[s.code] || '⚙️',
        type: TYPE_BY_CODE[s.code] || 'Paper Machine',
      }))])
    })
  }, [])

  const filtered = machines.filter(m => {
    const matchesSearch = !search ||
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.code?.toLowerCase().includes(search.toLowerCase())
    if (!matchesSearch) return false

    if (selectedSection === 'All Sections') return true
    const sect = sections.find(s => s.name === selectedSection)
    if (!sect) return true

    if (sect.type === 'Other') {
      return m.type === 'Other' || m.type === 'Cutter'
    }
    return m.type === sect.type
  })

  const openAdd = () => { setForm(empty); setErr(''); setEdit(null); setModal(true) }
  const openEdit = m => { setForm({ name: m.name, code: m.code, type: m.type || '', capacity_tpd: m.capacity_tpd || '', ideal_speed_mpm: m.ideal_speed_mpm || '', design_speed_mpm: m.design_speed_mpm || '', is_active: m.is_active }); setErr(''); setEdit(m); setModal(true) }
  const del = async m => { if (!window.confirm(`Deactivate machine "${m.name}"?`)) return; await API(`/api/master/machines/${m.id}`, { method: 'DELETE' }); load() }
  const restore = async m => { await API(`/api/master/machines/${m.id}/restore`, { method: 'PUT' }); load() }

  const save = async e => {
    e.preventDefault()
    if (!form.name || !form.code) return setErr('Name and code required')
    setSaving(true); setErr('')
    const res = edit
      ? await API(`/api/master/machines/${edit.id}`, { method: 'PUT', body: JSON.stringify(form) })
      : await API('/api/master/machines', { method: 'POST', body: JSON.stringify(form) })
    setSaving(false)
    if (res.success) { setModal(null); load() }
    else setErr(res.message)
  }

  const statusColor = s => ({ Running: '#22c55e', Idle: '#eab308', Down: '#ef4444', Maintenance: '#f97316' }[s] || '#8a8a90')

  return (
    <div style={S.page}>
      <div style={S.header}>
        <div>
          <div style={S.title}>Machines & Plant Sections</div>
          <div style={S.sub}>Paper machines, rewinders, cutters, and utilities grouped by active sections</div>
        </div>
        <button style={S.btnPrimary} onClick={openAdd}>+ Add Machine</button>
      </div>

      <div style={S.layout}>
        {/* Plant Sections Sidebar */}
        <div style={S.sidebar}>
          <div style={S.sidebarTitle}>Plant Sections</div>
          <div style={{ padding: '0 12px 12px 12px' }}>
            <input 
              style={{...S.input, width: '100%', padding: '6px 10px', fontSize: 13}} 
              placeholder="Search sections..." 
              value={sectionSearch} 
              onChange={e => setSectionSearch(e.target.value)} 
            />
          </div>
          <div style={S.sidebarList}>
            {sections.filter(s => !sectionSearch || s.name.toLowerCase().includes(sectionSearch.toLowerCase())).map(s => {
              const active = selectedSection === s.name
              return (
                <button
                  key={s.name}
                  style={{ ...S.sidebarItem, ...(active ? S.sidebarItemActive : {}) }}
                  onClick={() => setSelectedSection(s.name)}
                >
                  <span style={S.sidebarIcon}>{s.icon}</span>
                  <span style={S.sidebarLabel}>{s.name}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Machine Table list */}
        <div style={S.mainContent}>
          <div style={S.filterBar}>
            <input style={S.input} placeholder="Search name / code..." value={search} onChange={e => setSearch(e.target.value)} />
            <button style={S.btnSecondary} onClick={load}>↻ Refresh</button>
          </div>

          {/* KPI strip */}
          <div style={S.kpiRow}>
            {STATUSES.map(s => {
              const count = machines.filter(m => m.status === s).length
              return (
                <div key={s} style={S.kpi}>
                  <div style={{ ...S.kpiDot, background: statusColor(s) }} />
                  <div style={S.kpiLabel}>{s}</div>
                  <div style={S.kpiVal}>{count}</div>
                </div>
              )
            })}
          </div>

          <div style={S.tableWrap}>
            {loading ? <div style={S.loading}>Loading...</div> : (
              <table style={S.table}>
                <thead>
                  <tr style={S.thead}>
                    {['Code', 'Name', 'Type', 'Speed (MPM)', 'Capacity', 'Active', 'Actions'].map(h => (
                      <th key={h} style={S.th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 && <tr><td colSpan={6} style={S.empty}>No machines found in this section</td></tr>}
                  {filtered.map(m => (
                    <tr key={m.id} style={S.tr}>
                      <td style={S.td}><span style={S.code}>{m.code}</span></td>
                      <td style={S.td}><div style={S.name}>{m.name}</div></td>
                      <td style={S.td}><span style={S.muted}>{m.type || '—'}</span></td>
                      <td style={S.td}><span style={S.num}>{m.ideal_speed_mpm ? `${m.ideal_speed_mpm}` : '—'}</span></td>
                      <td style={S.td}><span style={S.num}>{m.capacity_tpd ? `${m.capacity_tpd} MT` : '—'}</span></td>
                      <td style={S.td}>
                        <span style={{ ...S.badge, background: m.is_active ? '#22c55e22' : '#ef444422', color: m.is_active ? '#22c55e' : '#ef4444', border: `1px solid ${m.is_active ? '#22c55e44' : '#ef444444'}` }}>
                          {m.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td style={S.td}>
                        <button style={S.btnIcon} onClick={() => openEdit(m)} title="Edit">✏️</button>
                        <button style={{ ...S.btnIcon, color: '#3b82f6' }} onClick={() => openPositions(m)} title="Positions">📍</button>
                        {m.is_active
                          ? (isStoreManager && <button style={{ ...S.btnIcon, color: '#ef4444' }} onClick={() => del(m)} title="Deactivate">🗑️</button>)
                          : <button style={{ ...S.btnIcon, color: '#22c55e' }} onClick={() => restore(m)} title="Restore">♻️</button>
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <div style={S.count}>{filtered.length} machine{filtered.length !== 1 ? 's' : ''} shown</div>
        </div>
      </div>

      {modal && (
        <div style={S.overlay}>
          <div style={S.modal} onClick={e => e.stopPropagation()}>
            <div style={S.modalHeader}>
              <div style={S.modalTitle}>{edit ? `Edit: ${edit.name}` : 'Add Machine'}</div>
              <button style={S.close} onClick={() => setModal(null)}>✕</button>
            </div>
            <form onSubmit={save} style={S.form}>
              <div style={S.grid2}>
                <label style={S.label}>Machine Code *
                  <input style={S.input} value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} placeholder="PM1, RW1..." />
                </label>
                <label style={S.label}>Machine Name *
                  <input style={S.input} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Paper Machine 1" />
                </label>
                <label style={S.label}>Type
                  <select style={S.select} value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                    {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </label>
                <label style={S.label}>Capacity (MT/day)
                  <input style={S.input} type="number" step="0.01" value={form.capacity_tpd} onChange={e => setForm(f => ({ ...f, capacity_tpd: e.target.value }))} placeholder="30.00" />
                </label>
                <label style={S.label}>Ideal Speed (MPM)
                  <input style={S.input} type="number" step="1" value={form.ideal_speed_mpm} onChange={e => setForm(f => ({ ...f, ideal_speed_mpm: e.target.value }))} placeholder="250" />
                </label>
                <label style={S.label}>Design Speed (MPM)
                  <input style={S.input} type="number" step="1" value={form.design_speed_mpm} onChange={e => setForm(f => ({ ...f, design_speed_mpm: e.target.value }))} placeholder="300" />
                </label>
                <label style={{ ...S.label, flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 22 }}>
                  <input type="checkbox" checked={form.is_active} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} />
                  <span>Active</span>
                </label>
              </div>
              {err && <div style={S.error}>{err}</div>}
              <div style={S.modalFooter}>
                <button type="button" style={S.btnSecondary} onClick={() => setModal(null)}>Cancel</button>
                <button type="submit" style={S.btnPrimary} disabled={saving}>{saving ? 'Saving...' : (edit ? 'Save Changes' : 'Add Machine')}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {posModal && (
        <div style={S.overlay}>
          <div style={S.modal} onClick={e => e.stopPropagation()}>
            <div style={S.modalHeader}>
              <div style={S.modalTitle}>Positions: {posModal.name}</div>
              <button style={S.close} onClick={() => setPosModal(null)}>✕</button>
            </div>
            <div style={{ padding: 24 }}>
              <table style={{ ...S.table, marginBottom: 20 }}>
                <thead>
                  <tr style={S.thead}>
                    <th style={S.th}>Code</th>
                    <th style={S.th}>Name</th>
                  </tr>
                </thead>
                <tbody>
                  {positions.length === 0 && <tr><td colSpan={2} style={S.empty}>No positions found</td></tr>}
                  {positions.map(p => (
                    <tr key={p.id} style={S.tr}>
                      <td style={S.td}><span style={S.code}>{p.code}</span></td>
                      <td style={S.td}>{p.name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              
              <form onSubmit={savePosition} style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
                <label style={S.label}>New Code *
                  <input style={S.input} value={posForm.code} onChange={e => setPosForm(f => ({ ...f, code: e.target.value }))} placeholder="PM1-W1" />
                </label>
                <label style={S.label}>New Name *
                  <input style={S.input} value={posForm.name} onChange={e => setPosForm(f => ({ ...f, name: e.target.value }))} placeholder="Wire Roll 1" />
                </label>
                <button type="submit" style={{ ...S.btnPrimary, height: 42, marginBottom: 2 }} disabled={posSaving}>
                  {posSaving ? 'Saving...' : 'Add'}
                </button>
              </form>
            </div>
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
  layout: { display: 'flex', gap: 20, alignItems: 'flex-start' },
  sidebar: {
    width: 250,
    background: '#ffffff',
    border: '1px solid #e7e6df',
    borderRadius: 12,
    padding: 16,
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    height: 'fit-content',
    maxHeight: 'calc(100vh - 160px)',
    overflowY: 'auto',
    flexShrink: 0
  },
  sidebarTitle: {
    fontSize: 12,
    fontWeight: 700,
    color: '#a0a0a6',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginBottom: 4
  },
  sidebarList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4
  },
  sidebarItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    background: 'none',
    border: 'none',
    color: '#a0a0a6',
    padding: '8px 12px',
    borderRadius: 8,
    cursor: 'pointer',
    textAlign: 'left',
    fontSize: 13,
    fontWeight: 500,
    transition: 'all 0.15s ease'
  },
  sidebarItemActive: {
    background: '#1b1b1d', // Spruce Medium
    color: '#ffffff',
    boxShadow: '0 0 10px rgba(75, 159, 130, 0.15)'
  },
  sidebarIcon: {
    fontSize: 14,
    width: 20,
    textAlign: 'center'
  },
  sidebarLabel: {
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis'
  },
  mainContent: { flex: 1, minWidth: 0 },
  filterBar: { display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' },
  kpiRow: { display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' },
  kpi: { background: '#ffffff', border: '1px solid #e7e6df', borderRadius: 8, padding: '10px 18px', display: 'flex', alignItems: 'center', gap: 10 },
  kpiDot: { width: 8, height: 8, borderRadius: '50%' },
  kpiLabel: { fontSize: 13, color: '#a0a0a6' },
  kpiVal: { fontSize: 18, fontWeight: 700, color: '#1b1b1d' },
  tableWrap: { background: '#ffffff', borderRadius: 10, overflow: 'auto', border: '1px solid #e7e6df' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  thead: { background: '#f6f5f0' },
  th: { padding: '10px 14px', textAlign: 'left', color: '#8a8a90', fontWeight: 600, fontSize: 12, textTransform: 'uppercase', borderBottom: '1px solid #e7e6df', whiteSpace: 'nowrap' },
  tr: { borderBottom: '1px solid #f1efe8' },
  td: { padding: '10px 14px', verticalAlign: 'middle' },
  name: { fontWeight: 600, color: '#1b1b1d' },
  muted: { color: '#a0a0a6', fontSize: 12 },
  num: { color: '#1b1b1d', fontVariantNumeric: 'tabular-nums' },
  code: { fontFamily: 'monospace', background: '#f6f5f0', padding: '2px 6px', borderRadius: 4, fontSize: 11, color: '#a0a0a6' },
  badge: { fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20, display: 'inline-block' },
  btnIcon: { background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, padding: '2px 4px' },
  empty: { padding: 40, textAlign: 'center', color: '#8a8a90' },
  loading: { padding: 40, textAlign: 'center', color: '#8a8a90' },
  count: { marginTop: 10, fontSize: 12, color: '#8a8a90' },
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

