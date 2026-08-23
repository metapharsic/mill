import React, { useState, useEffect, useCallback } from 'react'

const API = (path, opts) => fetch(path, {
  headers: { Authorization: `Bearer ${localStorage.getItem('mk_token')}`, 'Content-Type': 'application/json', ...(opts?.headers || {}) },
  ...opts,
}).then(r => r.json())

export default function MasterData() {
  const [tab, setTab] = useState('summary')
  const [sections, setSections] = useState([])
  const [departments, setDepartments] = useState([])
  const [equipmentList, setEquipmentList] = useState([])
  const [machines, setMachines] = useState([])
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ name: '', code: '', department_id: '' })
  const [modal, setModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const [searchTerm, setSearchTerm] = useState('')

  // Equipment Master State
  const [equipModal, setEquipModal] = useState(false)
  const [equipForm, setEquipForm] = useState({
    id: null,
    equipment_name: '',
    tag_name: '',
    section_id: '',
    machine_id: '',
    bearing_size: '',
    lock_nut: '',
    washer: '',
    belt_no: '',
    shaft_size: '',
    impeller_size: '',
    sleeve: '',
    couplings: '',
    pulleys: '',
    remarks: ''
  })
  const [equipSearch, setEquipSearch] = useState('')
  const [filterEquipSec, setFilterEquipSec] = useState('')

  const loadData = useCallback(async () => {
    setLoading(true)
    const [secRes, deptRes, eqRes, mcnRes] = await Promise.all([
      API('/api/master/sections'),
      API('/api/users/departments'),
      API('/api/master/section-equipment'),
      API('/api/master/machines')
    ])
    if (secRes.success) setSections(secRes.data)
    if (deptRes.success) setDepartments(deptRes.data)
    if (eqRes.success) setEquipmentList(eqRes.data)
    if (mcnRes.success) setMachines(mcnRes.data)
    setLoading(false)
  }, [])

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

  const saveEquip = async (e) => {
    e.preventDefault()
    if (!equipForm.equipment_name) return setErr('Equipment / Roll Name is required')
    setSaving(true)
    const res = equipForm.id
      ? await API(`/api/master/section-equipment/${equipForm.id}`, { method: 'PUT', body: JSON.stringify(equipForm) })
      : await API('/api/master/section-equipment', { method: 'POST', body: JSON.stringify(equipForm) })
    setSaving(false)
    if (res.success) {
      setEquipModal(false)
      setEquipForm({
        id: null, equipment_name: '', tag_name: '', section_id: '', machine_id: '',
        bearing_size: '', lock_nut: '', washer: '', belt_no: '', shaft_size: '',
        impeller_size: '', sleeve: '', couplings: '', pulleys: '', remarks: ''
      })
      loadData()
    } else {
      setErr(res.message || 'Error saving equipment')
    }
  }

  const openEditEquip = (eq) => {
    setEquipForm({
      id: eq.id, equipment_name: eq.equipmentName || '', tag_name: eq.tagName || '',
      section_id: eq.sectionId ? String(eq.sectionId) : '', machine_id: eq.machineId ? String(eq.machineId) : '',
      bearing_size: eq.bearingSize || '', lock_nut: eq.lockNut || '', washer: eq.washer || '',
      belt_no: eq.beltNo || '', shaft_size: eq.shaftSize || '', impeller_size: eq.impellerSize || '',
      sleeve: eq.sleeve || '', couplings: eq.couplings || '', pulleys: eq.pulleys || '', remarks: eq.remarks || ''
    })
    setErr('')
    setEquipModal(true)
  }

  const deleteEquip = async (eq) => {
    if (!window.confirm(`Delete "${eq.equipmentName}" (${eq.tagName || 'no tag'})? This cannot be undone.`)) return
    const res = await API(`/api/master/section-equipment/${eq.id}`, { method: 'DELETE' })
    if (res.success) loadData()
    else alert(res.message || 'Error deleting equipment')
  }

  const MODULES = [
    { title: 'Customers', status: 'Live', color: '#1b1b1d', desc: 'Keep company names, contacts, credit terms, and GST info.', bullets: ['Add and edit customers', 'Search and filter', 'Credit and payment terms'] },
    { title: 'Materials', status: 'Live', color: '#1b1b1d', desc: 'Track raw materials, UOM, stock, reorder points, and GST.', bullets: ['Material master', 'Category setup', 'Reorder alerts'] },
    { title: 'Plant Sections & Spares', status: 'Live', color: '#0f766e', desc: 'Manage 16 plant sections and 282 machinery rolls dynamically.', bullets: ['Add/edit sections', 'Assign rolls & bearings', 'Digital twin link'] },
    { title: 'Vendors', status: 'Live', color: '#1b1b1d', desc: 'Manage supplier details, payment terms, and vendor records.', bullets: ['Vendor list', 'Contact details', 'Terms and status'] },
    { title: 'Grades', status: 'Live', color: '#16a34a', desc: 'Keep paper grades, quality specs, and grade-level metadata.', bullets: ['Grade catalog', 'Quality notes', 'Simple lookup'] },
    { title: 'Machines', status: 'Live', color: '#d97706', desc: 'Record machines, maintenance data, and equipment setup.', bullets: ['Machine master', 'Setup info', 'Status tracking'] },
  ]

  const filteredEquip = equipmentList.filter(eq => {
    const matchesSearch = !equipSearch ||
      (eq.equipmentName && eq.equipmentName.toLowerCase().includes(equipSearch.toLowerCase())) ||
      (eq.tagName && eq.tagName.toLowerCase().includes(equipSearch.toLowerCase())) ||
      (eq.bearingSize && eq.bearingSize.toLowerCase().includes(equipSearch.toLowerCase())) ||
      (eq.beltNo && eq.beltNo.toLowerCase().includes(equipSearch.toLowerCase()))
    const matchesSec = !filterEquipSec || String(eq.sectionId) === String(filterEquipSec)
    return matchesSearch && matchesSec
  })

  return (
    <div style={S.page}>
      <div style={S.header}>
        <div>
          <div style={S.title}>Master Data Management</div>
          <div style={S.sub}>Central registry for Plant Sections, Machinery &amp; Spares Digital Twin, Customers, and Catalog.</div>
        </div>
        <div style={S.tabs}>
          <button style={{ ...S.tabBtn, ...(tab === 'summary' ? S.tabActive : {}) }} onClick={() => setTab('summary')}>Overview</button>
          <button style={{ ...S.tabBtn, ...(tab === 'sections' ? S.tabActive : {}) }} onClick={() => setTab('sections')}>Plant Sections ({sections.length})</button>
          <button style={{ ...S.tabBtn, ...(tab === 'equipment' ? S.tabActive : {}) }} onClick={() => setTab('equipment')}>Machinery &amp; Spares Registry ({equipmentList.length})</button>
        </div>
      </div>

      {tab === 'summary' && (
        <>
          <div style={S.hero}>
            <div style={S.heroTitle}>Master Data Engine &amp; Digital Twin Provisioning</div>
            <div style={S.heroText}>Plant Sections, Machinery, Materials, and Categories are dynamically manageable with live database synchronization.</div>
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

      {/* PLANT SECTIONS TAB */}
      {tab === 'sections' && (
        <div style={S.sectionContainer}>
          <div style={S.card}>
            <div style={{ ...S.header, marginBottom: 16 }}>
              <div style={S.cardTitle}>🏭 Plant Sections Master</div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <input style={{...S.input, maxWidth: 220}} placeholder="🔍 Search sections..." value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} />
                <button style={S.btnPrimary} onClick={() => { setForm({ name: '', code: '', department_id: '' }); setErr(''); setModal(true) }}>+ Add Plant Section</button>
              </div>
            </div>
            
            {loading ? <div style={S.loading}>Loading sections...</div> : (
              <table style={S.table}>
                <thead>
                  <tr style={S.thead}>
                    {['Action', 'Section Code', 'Section Name', 'Department', 'Status'].map(h => <th key={h} style={S.th}>{h}</th>)}
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

      {/* MACHINERY & EQUIPMENT REGISTRY TAB */}
      {tab === 'equipment' && (
        <div style={S.sectionContainer}>
          <div style={S.card}>
            <div style={{ ...S.header, marginBottom: 16 }}>
              <div style={S.cardTitle}>⚙️ Machinery &amp; Spares Registry (282 Digital Twin Rolls &amp; Equipment)</div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <select
                  style={{ ...S.input, maxWidth: 200 }}
                  value={filterEquipSec}
                  onChange={e => setFilterEquipSec(e.target.value)}
                >
                  <option value="">All Plant Sections</option>
                  {sections.map(s => <option key={s.id} value={String(s.id)}>{s.name || s.code}</option>)}
                </select>
                <input
                  style={{ ...S.input, maxWidth: 260 }}
                  placeholder="🔍 Search roll, bearing (e.g. 23234K), belt..."
                  value={equipSearch}
                  onChange={e => setEquipSearch(e.target.value)}
                />
                <button
                  style={S.btnPrimary}
                  onClick={() => {
                    setEquipForm({
                      id: null, equipment_name: '', tag_name: '', section_id: filterEquipSec || '', machine_id: '',
                      bearing_size: '', lock_nut: '', washer: '', belt_no: '', shaft_size: '',
                      impeller_size: '', sleeve: '', couplings: '', pulleys: '', remarks: ''
                    })
                    setErr('')
                    setEquipModal(true)
                  }}
                >
                  + Add Machinery / Roll
                </button>
              </div>
            </div>

            {loading ? <div style={S.loading}>Loading equipment registry...</div> : (
              <div style={{ overflowX: 'auto' }}>
                <table style={S.table}>
                  <thead>
                    <tr style={S.thead}>
                      {['Tag Code', 'Equipment / Roll', 'Plant Section', 'Bearing Size', 'Lock Nut / Washer', 'Belt No', 'Shaft', 'Couplings / Pulleys', 'Action'].map(h => <th key={h} style={S.th}>{h}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEquip.length === 0 && <tr><td colSpan={9} style={S.empty}>No machinery equipment found</td></tr>}
                    {filteredEquip.map((eq, idx) => (
                      <tr key={eq.id || idx} style={S.tr}>
                        <td style={S.td}>
                          <code style={{ background: '#f1f5f9', color: '#0f766e', padding: '2px 6px', borderRadius: 4, fontWeight: 700 }}>
                            {eq.tagName || '—'}
                          </code>
                        </td>
                        <td style={S.td}>
                          <div style={{ fontWeight: 700, color: '#0f172a' }}>{eq.equipmentName}</div>
                          {eq.machineName && <div style={{ fontSize: 11, color: '#64748b' }}>Unit: {eq.machineName}</div>}
                        </td>
                        <td style={S.td}>{eq.sectionName || eq.plantSectionName || '—'}</td>
                        <td style={S.td}>
                          {eq.bearingSize ? (
                            <span style={{ background: '#cffafe', color: '#0891b2', fontWeight: 800, padding: '2px 8px', borderRadius: 12, fontSize: 11 }}>
                              {eq.bearingSize}
                            </span>
                          ) : '—'}
                        </td>
                        <td style={S.td}>
                          {[eq.lockNut ? `Nut: ${eq.lockNut}` : null, eq.washer ? `W: ${eq.washer}` : null].filter(Boolean).join(' | ') || '—'}
                        </td>
                        <td style={S.td}>
                          {eq.beltNo ? (
                            <span style={{ background: '#fef3c7', color: '#d97706', fontWeight: 700, padding: '2px 7px', borderRadius: 10, fontSize: 11 }}>
                              {eq.beltNo}
                            </span>
                          ) : '—'}
                        </td>
                        <td style={S.td}>{eq.shaftSize || '—'}</td>
                        <td style={S.td}>
                          {[eq.couplings ? `Cpl: ${eq.couplings}` : null, eq.pulleys ? `Pul: ${eq.pulleys}` : null].filter(Boolean).join(' | ') || '—'}
                        </td>
                        <td style={S.td}>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button type="button" onClick={() => openEditEquip(eq)}
                              style={{ background: '#eff6ff', border: '1px solid #2563eb', color: '#2563eb', borderRadius: 4, padding: '3px 8px', fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>
                              ✎ Edit
                            </button>
                            <button type="button" onClick={() => deleteEquip(eq)}
                              style={{ background: '#fef2f2', border: '1px solid #dc2626', color: '#dc2626', borderRadius: 4, padding: '3px 8px', fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>
                              🗑 Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SECTION MODAL */}
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
                <input style={S.input} value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} placeholder="e.g. WIRE" />
              </label>
              <label style={S.label}>Responsible Department
                <select style={S.select} value={form.department_id} onChange={e => setForm(f => ({ ...f, department_id: e.target.value }))}>
                  <option value="">Select Department...</option>
                  {departments.map(d => <option key={d.id} value={d.id}>{d.name} ({d.code})</option>)}
                </select>
              </label>
              {err && <div style={S.error}>{err}</div>}
              <div style={S.modalFooter}>
                <button type="button" style={S.btnSecondary} onClick={() => setModal(false)}>Cancel</button>
                <button type="submit" style={S.btnPrimary} disabled={saving}>{saving ? 'Saving...' : 'Save Section'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EQUIPMENT MODAL */}
      {equipModal && (
        <div style={S.overlay} onClick={() => setEquipModal(false)}>
          <div style={{ ...S.modal, maxWidth: 600 }} onClick={e => e.stopPropagation()}>
            <div style={S.modalHeader}>
              <div style={S.modalTitle}>⚙️ {equipForm.id ? 'Edit' : 'Add'} Machinery / Roll Component</div>
              <button style={S.close} onClick={() => setEquipModal(false)}>✕</button>
            </div>
            <form onSubmit={saveEquip} style={S.form}>
              <label style={S.label}>Equipment / Roll Name *
                <input style={S.input} value={equipForm.equipment_name} onChange={e => setEquipForm(f => ({ ...f, equipment_name: e.target.value }))} required placeholder="e.g. Top Wire Guide Roll #3" />
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <label style={S.label}>Tag Code
                  <input style={S.input} value={equipForm.tag_name} onChange={e => setEquipForm(f => ({ ...f, tag_name: e.target.value }))} placeholder="e.g. WIRE-MCN-028" />
                </label>
                <label style={S.label}>Plant Section
                  <select style={S.select} value={equipForm.section_id} onChange={e => setEquipForm(f => ({ ...f, section_id: e.target.value }))}>
                    <option value="">Select Section...</option>
                    {sections.map(s => <option key={s.id} value={s.id}>{s.name || s.code}</option>)}
                  </select>
                </label>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                <label style={S.label}>Bearing Size
                  <input style={S.input} value={equipForm.bearing_size} onChange={e => setEquipForm(f => ({ ...f, bearing_size: e.target.value }))} placeholder="23234K" />
                </label>
                <label style={S.label}>Lock Nut
                  <input style={S.input} value={equipForm.lock_nut} onChange={e => setEquipForm(f => ({ ...f, lock_nut: e.target.value }))} placeholder="KM 34" />
                </label>
                <label style={S.label}>Belt No
                  <input style={S.input} value={equipForm.belt_no} onChange={e => setEquipForm(f => ({ ...f, belt_no: e.target.value }))} placeholder="C-144" />
                </label>
              </div>
              {err && <div style={S.error}>{err}</div>}
              <div style={S.modalFooter}>
                <button type="button" style={S.btnSecondary} onClick={() => setEquipModal(false)}>Cancel</button>
                <button type="submit" style={S.btnPrimary} disabled={saving}>{saving ? 'Saving...' : (equipForm.id ? 'Save Changes' : 'Add Equipment')}</button>
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
  tabs: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  tabBtn: { background: '#ffffff', border: '1px solid #e7e6df', color: '#64748b', borderRadius: 8, padding: '8px 16px', fontWeight: 600, fontSize: 13, cursor: 'pointer' },
  tabActive: { background: '#0f766e', color: '#ffffff', borderColor: '#0f766e' },
  hero: { background: '#ffffff', border: '1px solid #e7e6df', borderRadius: 10, padding: 18, marginBottom: 18 },
  heroTitle: { fontSize: 16, fontWeight: 700, color: '#1b1b1d', marginBottom: 4 },
  heroText: { fontSize: 13, color: '#64748b' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 },
  card: { background: '#ffffff', border: '1px solid #e7e6df', borderRadius: 10, padding: 18 },
  cardTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  cardTitle: { fontSize: 15, fontWeight: 700, color: '#1b1b1d' },
  statusBadge: { fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 12 },
  desc: { fontSize: 12, color: '#64748b', marginBottom: 10 },
  list: { paddingLeft: 16, margin: 0, fontSize: 12, color: '#475569' },
  listItem: { marginBottom: 4 },
  sectionContainer: { marginTop: 10 },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  thead: { background: '#f8fafc', borderBottom: '2px solid #0f766e' },
  th: { padding: '10px 12px', textAlign: 'left', color: '#0f766e', fontWeight: 700, fontSize: 12, textTransform: 'uppercase' },
  tr: { borderBottom: '1px solid #f1efe8' },
  td: { padding: '10px 12px', verticalAlign: 'middle' },
  input: { width: '100%', padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 13, outline: 'none', background: '#f8fafc', boxSizing: 'border-box' },
  select: { width: '100%', padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 13, background: '#f8fafc', boxSizing: 'border-box' },
  label: { display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, color: '#475569', fontWeight: 600, width: '100%' },
  btnPrimary: { background: '#0f766e', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 16px', fontWeight: 700, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' },
  btnSecondary: { background: '#ffffff', color: '#1b1b1d', border: '1px solid #e7e6df', borderRadius: 6, padding: '8px 14px', fontWeight: 600, fontSize: 12, cursor: 'pointer' },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 6000, padding: 20 },
  modal: { background: '#ffffff', borderRadius: 10, padding: 22, width: '100%', maxWidth: 500, border: '1px solid #e7e6df' },
  modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 16, fontWeight: 700, color: '#1b1b1d' },
  close: { background: 'none', border: 'none', color: '#94a3b8', fontSize: 18, cursor: 'pointer' },
  form: { display: 'flex', flexDirection: 'column', gap: 12 },
  modalFooter: { display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 },
  error: { background: '#fee2e2', border: '1px solid #fca5a5', color: '#b91c1c', padding: '8px 12px', borderRadius: 6, fontSize: 12 },
  loading: { padding: 30, textAlign: 'center', color: '#64748b' },
  empty: { padding: 30, textAlign: 'center', color: '#94a3b8' }
}
