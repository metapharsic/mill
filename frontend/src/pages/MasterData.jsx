import React, { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'

const API = (path, opts) => fetch(path, {
  headers: { Authorization: `Bearer ${localStorage.getItem('mk_token')}`, 'Content-Type': 'application/json', ...(opts?.headers || {}) },
  ...opts,
}).then(r => r.json())

export default function MasterData() {
  const { user } = useAuth()
  const roleLevel = user?.role_level ?? 1
  const dept = (user?.department || '').toLowerCase()
  const deptCode = (user?.dept_code || '').toUpperCase()
  const isStoreManager = (
    (roleLevel >= 3 && (['STORE', 'INV', 'RMS', 'MATERIALS', 'MAINT', 'ADMIN'].includes(deptCode) || dept.includes('store') || dept.includes('inventory') || dept.includes('raw material') || dept.includes('maintenance') || dept.includes('admin'))) ||
    roleLevel >= 4
  )

  const [tab, setTab] = useState('summary')
  const [sections, setSections] = useState([])
  const [departments, setDepartments] = useState([])
  const [equipmentList, setEquipmentList] = useState([])
  const [machines, setMachines] = useState([])
  const [categories, setCategories] = useState([])
  const [catalogMaterials, setCatalogMaterials] = useState([])
  const [loading, setLoading] = useState(false)
  
  // Section Form State
  const [form, setForm] = useState({ id: null, name: '', code: '', department_id: '', description: '' })
  const [modal, setModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const [searchTerm, setSearchTerm] = useState('')

  // Section Mapped Items Modal State
  const [activeSecMap, setActiveSecMap] = useState(null)
  const [secMappedItems, setSecMappedItems] = useState([])
  const [secMapLoading, setSecMapLoading] = useState(false)
  const [secAddMapModal, setSecAddMapModal] = useState(false)
  const [selectedSecMatId, setSelectedSecMatId] = useState('')
  const [isPrimarySecMat, setIsPrimarySecMat] = useState(false)
  const [secMapSaving, setSecMapSaving] = useState(false)
  const [secMapErr, setSecMapErr] = useState('')

  // Machine Master State
  const [mcnModal, setMcnModal] = useState(false)
  const [mcnForm, setMcnForm] = useState({ id: null, name: '', code: '', type: 'Paper Machine', capacity_tpd: '', ideal_speed_mpm: '', design_speed_mpm: '', is_active: true })
  const [mcnSearch, setMcnSearch] = useState('')

  // Machine Mapped Items Modal State
  const [activeMcnMap, setActiveMcnMap] = useState(null)
  const [mcnMappedItems, setMcnMappedItems] = useState([])
  const [mcnMapLoading, setMcnMapLoading] = useState(false)
  const [mcnAddMapModal, setMcnAddMapModal] = useState(false)
  const [selectedMcnMatId, setSelectedMcnMatId] = useState('')
  const [mcnRemarks, setMcnRemarks] = useState('')
  const [mcnMapSaving, setMcnMapSaving] = useState(false)
  const [mcnMapErr, setMcnMapErr] = useState('')

  // Category Master State
  const [catModal, setCatModal] = useState(false)
  const [catForm, setCatForm] = useState({ id: null, name: '', code: '', type: 'Raw Material', parent_id: '' })
  const [catSearch, setCatSearch] = useState('')

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
    const [secRes, deptRes, eqRes, mcnRes, catRes] = await Promise.all([
      API('/api/master/sections'),
      API('/api/users/departments'),
      API('/api/master/section-equipment'),
      API('/api/master/machines'),
      API('/api/master/categories')
    ])
    if (secRes.success) setSections(secRes.data)
    if (deptRes.success) setDepartments(deptRes.data)
    if (eqRes.success) setEquipmentList(eqRes.data)
    if (mcnRes.success) setMachines(mcnRes.data)
    if (catRes.success) setCategories(catRes.data)
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const loadCatalogMaterials = async () => {
    if (catalogMaterials.length > 0) return
    const res = await API('/api/master/materials?limit=2000&is_active=true')
    if (res.success) setCatalogMaterials(res.data || [])
  }

  // ── Section Actions & Mappings ──
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
      setForm({ id: null, name: '', code: '', department_id: '', description: '' })
      loadData()
    } else {
      setErr(res.message || 'Error saving section')
    }
  }

  const openEditSection = (s) => {
    setForm({ id: s.id, name: s.name, code: s.code || s.sectionCode || '', department_id: s.department_id || '', description: s.description || '' })
    setErr('')
    setModal(true)
  }

  const deleteSection = async (s) => {
    if (!window.confirm(`Are you sure you want to deactivate plant section "${s.name}" (${s.code || s.sectionCode || ''})?`)) return
    const res = await API(`/api/master/sections/${s.id}`, { method: 'DELETE' })
    if (res.success) loadData()
    else alert(res.message || 'Error deactivating section')
  }

  const openSectionMaterialsModal = async (sec) => {
    setActiveSecMap(sec)
    setSecMapLoading(true)
    setSecMapErr('')
    try {
      const res = await API(`/api/master/sections/${sec.id}/materials`)
      if (res.success) setSecMappedItems(res.data || [])
    } catch (e) {
      console.error(e)
    } finally {
      setSecMapLoading(false)
    }
  }

  const handleSaveSecMap = async (e) => {
    e.preventDefault()
    if (!selectedSecMatId) return setSecMapErr('Please select a material')
    setSecMapSaving(true)
    try {
      const res = await API(`/api/master/sections/${activeSecMap.id}/materials`, {
        method: 'POST',
        body: JSON.stringify({ material_id: selectedSecMatId, is_primary: isPrimarySecMat })
      })
      if (res.success) {
        setSecAddMapModal(false)
        setSelectedSecMatId('')
        openSectionMaterialsModal(activeSecMap)
      } else {
        setSecMapErr(res.message || 'Failed to map material')
      }
    } catch (e) {
      setSecMapErr('Error mapping material: ' + e.message)
    } finally {
      setSecMapSaving(false)
    }
  }

  const handleUnmapSecMaterial = async (mat) => {
    if (!window.confirm(`Unmap "${mat.name}" from ${activeSecMap.name}?`)) return
    const res = await API(`/api/master/sections/${activeSecMap.id}/materials/${mat.id}`, { method: 'DELETE' })
    if (res.success) openSectionMaterialsModal(activeSecMap)
    else alert(res.message || 'Error unmapping material')
  }

  // ── Machine Actions & Mappings ──
  const saveMachine = async (e) => {
    e.preventDefault()
    if (!mcnForm.name || !mcnForm.code) return setErr('Machine name and code required')
    setSaving(true)
    const res = mcnForm.id
      ? await API(`/api/master/machines/${mcnForm.id}`, { method: 'PUT', body: JSON.stringify(mcnForm) })
      : await API('/api/master/machines', { method: 'POST', body: JSON.stringify(mcnForm) })
    setSaving(false)
    if (res.success) {
      setMcnModal(false)
      setMcnForm({ id: null, name: '', code: '', type: 'Paper Machine', capacity_tpd: '', ideal_speed_mpm: '', design_speed_mpm: '', is_active: true })
      loadData()
    } else {
      setErr(res.message || 'Error saving machine')
    }
  }

  const openEditMachine = (m) => {
    setMcnForm({
      id: m.id, name: m.name, code: m.code, type: m.type || 'Paper Machine',
      capacity_tpd: m.capacity_tpd || '', ideal_speed_mpm: m.ideal_speed_mpm || '',
      design_speed_mpm: m.design_speed_mpm || '', is_active: m.is_active !== false
    })
    setErr('')
    setMcnModal(true)
  }

  const deleteMachine = async (m) => {
    if (!window.confirm(`Are you sure you want to deactivate machine "${m.name}" (${m.code})?`)) return
    const res = await API(`/api/master/machines/${m.id}`, { method: 'DELETE' })
    if (res.success) loadData()
    else alert(res.message || 'Error deactivating machine')
  }

  const openMachineMaterialsModal = async (mcn) => {
    setActiveMcnMap(mcn)
    setMcnMapLoading(true)
    setMcnMapErr('')
    try {
      const res = await API(`/api/master/machines/${mcn.id}/materials`)
      if (res.success) setMcnMappedItems(res.data || [])
    } catch (e) {
      console.error(e)
    } finally {
      setMcnMapLoading(false)
    }
  }

  const handleSaveMcnMap = async (e) => {
    e.preventDefault()
    if (!selectedMcnMatId) return setMcnMapErr('Please select a material')
    setMcnMapSaving(true)
    try {
      const res = await API(`/api/master/machines/${activeMcnMap.id}/materials`, {
        method: 'POST',
        body: JSON.stringify({ material_id: selectedMcnMatId, remarks: mcnRemarks })
      })
      if (res.success) {
        setMcnAddMapModal(false)
        setSelectedMcnMatId('')
        setMcnRemarks('')
        openMachineMaterialsModal(activeMcnMap)
      } else {
        setMcnMapErr(res.message || 'Failed to map material')
      }
    } catch (e) {
      setMcnMapErr('Error mapping material: ' + e.message)
    } finally {
      setMcnMapSaving(false)
    }
  }

  const handleUnmapMcnMaterial = async (mat) => {
    if (!window.confirm(`Unmap "${mat.name}" from machine ${activeMcnMap.name}?`)) return
    const res = await API(`/api/master/machines/${activeMcnMap.id}/materials/${mat.id}`, { method: 'DELETE' })
    if (res.success) openMachineMaterialsModal(activeMcnMap)
    else alert(res.message || 'Error unmapping material')
  }

  // ── Category Actions ──
  const saveCategory = async (e) => {
    e.preventDefault()
    if (!catForm.name) return setErr('Category name is required')
    setSaving(true)
    const res = catForm.id
      ? await API(`/api/master/categories/${catForm.id}`, { method: 'PUT', body: JSON.stringify(catForm) })
      : await API('/api/master/categories', { method: 'POST', body: JSON.stringify(catForm) })
    setSaving(false)
    if (res.success) {
      setCatModal(false)
      setCatForm({ id: null, name: '', code: '', type: 'Raw Material', parent_id: '' })
      loadData()
    } else {
      setErr(res.message || 'Error saving category')
    }
  }

  const openEditCategory = (c) => {
    setCatForm({
      id: c.id, name: c.name, code: c.code || '',
      type: c.type || 'Raw Material', parent_id: c.parent_id || ''
    })
    setErr('')
    setCatModal(true)
  }

  const deleteCategory = async (c) => {
    if (!window.confirm(`Are you sure you want to delete category "${c.name}"?`)) return
    const res = await API(`/api/master/categories/${c.id}`, { method: 'DELETE' })
    if (res.success) loadData()
    else alert(res.message || 'Error deleting category')
  }

  // ── Equipment Actions ──
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
    if (!window.confirm(`Delete "${eq.equipmentName}" (${eq.tagName || 'no tag'})? This will deactivate the component in digital twin.`)) return
    const res = await API(`/api/master/section-equipment/${eq.id}`, { method: 'DELETE' })
    if (res.success) loadData()
    else alert(res.message || 'Error deleting equipment')
  }

  const MODULES = [
    { title: 'Plant Sections & Spares', status: 'Live', color: '#0f766e', desc: 'Manage 23 plant sections, assign owning departments, and map inventory items.', bullets: ['Add/edit/delete sections', 'Map & unmap inventory items', 'Digital twin roll linkage'] },
    { title: 'Machine Units', status: 'Live', color: '#d97706', desc: 'Record machines, speed capabilities, and map dedicated inventory spares.', bullets: ['Machine master', 'Map spares to machine', 'Status tracking & deletion'] },
    { title: 'Material Categories', status: 'Live', color: '#0284c7', desc: 'Multi-level category hierarchy across Store, Spares, RM, and Chemicals.', bullets: ['Root & sub-categories', 'Type allocation', 'Safe dependency deletion'] },
    { title: 'Materials', status: 'Live', color: '#1b1b1d', desc: 'Track raw materials, UOM, stock, reorder points, and GST.', bullets: ['Material master', 'Category setup', 'Reorder alerts'] },
    { title: 'Vendors', status: 'Live', color: '#1b1b1d', desc: 'Manage supplier details, payment terms, and vendor records.', bullets: ['Vendor list', 'Contact details', 'Terms and status'] },
    { title: 'Grades', status: 'Live', color: '#16a34a', desc: 'Keep paper grades, quality specs, and grade-level metadata.', bullets: ['Grade catalog', 'Quality notes', 'Simple lookup'] },
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
          <div style={S.sub}>Central registry for Plant Sections, Machinery &amp; Spares Digital Twin, Machine Units, and Catalog Categories.</div>
        </div>
        <div style={S.tabs}>
          <button style={{ ...S.tabBtn, ...(tab === 'summary' ? S.tabActive : {}) }} onClick={() => setTab('summary')}>Overview</button>
          <button style={{ ...S.tabBtn, ...(tab === 'sections' ? S.tabActive : {}) }} onClick={() => setTab('sections')}>🏭 Plant Sections ({sections.length})</button>
          <button style={{ ...S.tabBtn, ...(tab === 'equipment' ? S.tabActive : {}) }} onClick={() => setTab('equipment')}>⚙️ Machinery &amp; Spares ({equipmentList.length})</button>
          <button style={{ ...S.tabBtn, ...(tab === 'machines' ? S.tabActive : {}) }} onClick={() => setTab('machines')}>⚡ Machine Units ({machines.length})</button>
          <button style={{ ...S.tabBtn, ...(tab === 'categories' ? S.tabActive : {}) }} onClick={() => setTab('categories')}>📁 Material Categories ({categories.length})</button>
        </div>
      </div>

      {tab === 'summary' && (
        <>
          <div style={S.hero}>
            <div style={S.heroTitle}>Master Data Engine &amp; Multi-Section / Machine Provisioning</div>
            <div style={S.heroText}>Plant Sections, Machinery Units, Rolls, Materials, and Categories are dynamically configurable with multi-section item mapping and delete guards.</div>
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
              <div style={S.cardTitle}>🏭 Plant Sections Master &amp; Item Allocations</div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <input style={{...S.input, maxWidth: 220}} placeholder="🔍 Search sections..." value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} />
                <button style={S.btnPrimary} onClick={() => { setForm({ id: null, name: '', code: '', department_id: '', description: '' }); setErr(''); setModal(true) }}>+ Add Plant Section</button>
              </div>
            </div>
            
            {loading ? <div style={S.loading}>Loading sections...</div> : (
              <table style={S.table}>
                <thead>
                  <tr style={S.thead}>
                    {['Action', 'Section Code', 'Section Name', 'Owning Department', 'Status'].map(h => <th key={h} style={S.th}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {sections.filter(s => !searchTerm || s.name?.toLowerCase().includes(searchTerm.toLowerCase()) || (s.code || s.sectionCode || '').toLowerCase().includes(searchTerm.toLowerCase())).length === 0 && <tr><td colSpan={5} style={S.empty}>No sections found</td></tr>}
                  {sections.filter(s => !searchTerm || s.name?.toLowerCase().includes(searchTerm.toLowerCase()) || (s.code || s.sectionCode || '').toLowerCase().includes(searchTerm.toLowerCase())).map(sec => (
                    <tr key={sec.id} style={S.tr}>
                      <td style={S.td}>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          <button style={{ ...S.btnSecondary, padding: '4px 8px', fontSize: 11, fontWeight: 700, color: '#0f766e', borderColor: '#0f766e', background: '#f0fdfa' }} onClick={() => openSectionMaterialsModal(sec)}>📦 Mapped Items</button>
                          <button style={{ ...S.btnSecondary, padding: '4px 8px', fontSize: 11, fontWeight: 700, color: '#0284c7', borderColor: '#0284c7' }} onClick={() => openEditSection(sec)}>✏️ Edit</button>
                          <button style={{ ...S.btnSecondary, padding: '4px 8px', fontSize: 11, fontWeight: 700, color: '#dc2626', borderColor: '#dc2626', background: '#fef2f2' }} onClick={() => deleteSection(sec)}>🗑️ Deactivate</button>
                        </div>
                      </td>
                      <td style={S.td}><strong>{sec.code || sec.sectionCode || '—'}</strong></td>
                      <td style={S.td}>
                        <div style={{ fontWeight: 700, color: '#0f172a' }}>{sec.name}</div>
                        {sec.description && <div style={{ fontSize: 11, color: '#64748b' }}>{sec.description}</div>}
                      </td>
                      <td style={S.td}>
                        <span style={{ background: '#f1f5f9', color: '#334155', padding: '2px 8px', borderRadius: 4, fontWeight: 600, fontSize: 11 }}>
                          {sec.departmentName || 'Production / Mill Operations'}
                        </span>
                      </td>
                      <td style={S.td}>
                        <span style={{ ...S.statusBadge, background: sec.is_active !== false ? '#22c55e22' : '#ef444422', color: sec.is_active !== false ? '#22c55e' : '#ef4444' }}>
                          {sec.is_active !== false ? 'Active' : 'Inactive'}
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
              <div style={S.cardTitle}>⚙️ Machinery &amp; Spares Registry ({equipmentList.length} Digital Twin Rolls &amp; Equipment)</div>
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

      {/* MACHINE UNITS TAB */}
      {tab === 'machines' && (
        <div style={S.sectionContainer}>
          <div style={S.card}>
            <div style={{ ...S.header, marginBottom: 16 }}>
              <div style={S.cardTitle}>⚡ Machine Units Master &amp; Mapped Spares</div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <input style={{...S.input, maxWidth: 220}} placeholder="🔍 Search machines..." value={mcnSearch} onChange={e=>setMcnSearch(e.target.value)} />
                <button style={S.btnPrimary} onClick={() => { setMcnForm({ id: null, name: '', code: '', type: 'Paper Machine', capacity_tpd: '', ideal_speed_mpm: '', design_speed_mpm: '', is_active: true }); setErr(''); setMcnModal(true) }}>+ Add Machine Unit</button>
              </div>
            </div>
            
            {loading ? <div style={S.loading}>Loading machines...</div> : (
              <table style={S.table}>
                <thead>
                  <tr style={S.thead}>
                    {['Action', 'Machine Code', 'Machine Name', 'Type', 'Capacity (TPD)', 'Ideal Speed', 'Design Speed', 'Status'].map(h => <th key={h} style={S.th}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {machines.filter(m => !mcnSearch || m.name?.toLowerCase().includes(mcnSearch.toLowerCase()) || m.code?.toLowerCase().includes(mcnSearch.toLowerCase())).length === 0 && <tr><td colSpan={8} style={S.empty}>No machine units found</td></tr>}
                  {machines.filter(m => !mcnSearch || m.name?.toLowerCase().includes(mcnSearch.toLowerCase()) || m.code?.toLowerCase().includes(mcnSearch.toLowerCase())).map(mcn => (
                    <tr key={mcn.id} style={S.tr}>
                      <td style={S.td}>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          <button style={{ ...S.btnSecondary, padding: '4px 8px', fontSize: 11, fontWeight: 700, color: '#0f766e', borderColor: '#0f766e', background: '#f0fdfa' }} onClick={() => openMachineMaterialsModal(mcn)}>📦 Mapped Spares</button>
                          <button style={{ ...S.btnSecondary, padding: '4px 8px', fontSize: 11, fontWeight: 700, color: '#0284c7', borderColor: '#0284c7' }} onClick={() => openEditMachine(mcn)}>✏️ Edit</button>
                          {isStoreManager && (
                            <button style={{ ...S.btnSecondary, padding: '4px 8px', fontSize: 11, fontWeight: 700, color: '#dc2626', borderColor: '#dc2626', background: '#fef2f2' }} onClick={() => deleteMachine(mcn)}>🗑️ Deactivate</button>
                          )}
                        </div>
                      </td>
                      <td style={S.td}><strong>{mcn.code}</strong></td>
                      <td style={S.td}>{mcn.name}</td>
                      <td style={S.td}>{mcn.type || 'Paper Machine'}</td>
                      <td style={S.td}>{mcn.capacity_tpd || '—'} TPD</td>
                      <td style={S.td}>{mcn.ideal_speed_mpm ? `${mcn.ideal_speed_mpm} mpm` : '—'}</td>
                      <td style={S.td}>{mcn.design_speed_mpm ? `${mcn.design_speed_mpm} mpm` : '—'}</td>
                      <td style={S.td}>
                        <span style={{ ...S.statusBadge, background: mcn.is_active !== false ? '#22c55e22' : '#ef444422', color: mcn.is_active !== false ? '#22c55e' : '#ef4444' }}>
                          {mcn.is_active !== false ? 'Active' : 'Inactive'}
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

      {/* MATERIAL CATEGORIES TAB */}
      {tab === 'categories' && (
        <div style={S.sectionContainer}>
          <div style={S.card}>
            <div style={{ ...S.header, marginBottom: 16 }}>
              <div style={S.cardTitle}>📁 Material Categories Master</div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <input style={{...S.input, maxWidth: 220}} placeholder="🔍 Search categories..." value={catSearch} onChange={e=>setCatSearch(e.target.value)} />
                <button style={S.btnPrimary} onClick={() => { setCatForm({ id: null, name: '', code: '', type: 'Raw Material', parent_id: '' }); setErr(''); setCatModal(true) }}>+ Add Category</button>
              </div>
            </div>
            
            {loading ? <div style={S.loading}>Loading categories...</div> : (
              <table style={S.table}>
                <thead>
                  <tr style={S.thead}>
                    {['Action', 'Category Name', 'Code', 'Classification Type', 'Parent Category'].map(h => <th key={h} style={S.th}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {categories.filter(c => !catSearch || c.name?.toLowerCase().includes(catSearch.toLowerCase()) || (c.code || '').toLowerCase().includes(catSearch.toLowerCase())).length === 0 && <tr><td colSpan={5} style={S.empty}>No categories found</td></tr>}
                  {categories.filter(c => !catSearch || c.name?.toLowerCase().includes(catSearch.toLowerCase()) || (c.code || '').toLowerCase().includes(catSearch.toLowerCase())).map(cat => (
                    <tr key={cat.id} style={S.tr}>
                      <td style={S.td}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button style={{ ...S.btnSecondary, padding: '4px 8px', fontSize: 11, fontWeight: 700, color: '#0284c7', borderColor: '#0284c7' }} onClick={() => openEditCategory(cat)}>✏️ Edit</button>
                          {isStoreManager && (
                            <button style={{ ...S.btnSecondary, padding: '4px 8px', fontSize: 11, fontWeight: 700, color: '#dc2626', borderColor: '#dc2626', background: '#fef2f2' }} onClick={() => deleteCategory(cat)}>🗑️ Delete</button>
                          )}
                        </div>
                      </td>
                      <td style={S.td}><strong>{cat.name}</strong></td>
                      <td style={S.td}><code>{cat.code || '—'}</code></td>
                      <td style={S.td}>
                        <span style={{ ...S.statusBadge, background: '#f0fdfa', color: '#0f766e', border: '1px solid #ccfbf1' }}>
                          {cat.type || 'Store'}
                        </span>
                      </td>
                      <td style={S.td}>{cat.parentName || '— (Root)'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ── SECTION MAPPED MATERIALS MODAL ── */}
      {activeSecMap && (
        <div style={S.overlay} onClick={() => setActiveSecMap(null)}>
          <div style={{ ...S.modal, maxWidth: 850 }} onClick={e => e.stopPropagation()}>
            <div style={S.modalHeader}>
              <div>
                <div style={S.modalTitle}>📦 Mapped Inventory Items: {activeSecMap.name} ({activeSecMap.code || activeSecMap.sectionCode})</div>
                <div style={{ fontSize: 12, color: '#64748b' }}>Inventory items mapped to this plant section for maintenance and operations consumption.</div>
              </div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <button style={S.btnPrimary} onClick={() => { loadCatalogMaterials(); setSecAddMapModal(true); setSecMapErr(''); setSelectedSecMatId('') }}>+ Map Item / Spare</button>
                <button style={S.close} onClick={() => setActiveSecMap(null)}>✕</button>
              </div>
            </div>

            {secMapLoading ? <div style={S.loading}>Loading mapped items...</div> : (
              <div style={{ maxHeight: 400, overflowY: 'auto' }}>
                <table style={S.table}>
                  <thead>
                    <tr style={S.thead}>
                      {['Material Code', 'Material Name', 'Category', 'Current Stock', 'Unit Price', 'Role', 'Action'].map(h => <th key={h} style={S.th}>{h}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {secMappedItems.length === 0 && <tr><td colSpan={7} style={S.empty}>No inventory materials mapped to this section yet.</td></tr>}
                    {secMappedItems.map(mat => (
                      <tr key={mat.id} style={S.tr}>
                        <td style={S.td}><code style={{ background: '#f1f5f9', color: '#0f766e', padding: '2px 6px', borderRadius: 4, fontWeight: 700 }}>{mat.code}</code></td>
                        <td style={S.td}><strong>{mat.name}</strong></td>
                        <td style={S.td}>{mat.categoryName || 'General Store'}</td>
                        <td style={S.td}>{Number(mat.currentStock || 0).toFixed(3)} {mat.uom}</td>
                        <td style={S.td}>₹ {Number(mat.unitPrice || 0).toFixed(2)}</td>
                        <td style={S.td}>
                          <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 10, background: mat.isPrimary ? '#dcfce7' : '#f1f5f9', color: mat.isPrimary ? '#166534' : '#475569', fontWeight: 700 }}>
                            {mat.isPrimary ? 'Primary Section' : 'Multi-Mapped'}
                          </span>
                        </td>
                        <td style={S.td}>
                          <button style={{ background: '#fef2f2', border: '1px solid #dc2626', color: '#dc2626', borderRadius: 4, padding: '3px 8px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }} onClick={() => handleUnmapSecMaterial(mat)}>
                            🗑️ Unmap
                          </button>
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

      {/* ── SUB-MODAL: MAP ITEM TO SECTION ── */}
      {secAddMapModal && (
        <div style={{ ...S.overlay, zIndex: 6100 }} onClick={() => setSecAddMapModal(false)}>
          <div style={{ ...S.modal, maxWidth: 500 }} onClick={e => e.stopPropagation()}>
            <div style={S.modalHeader}>
              <div style={S.modalTitle}>+ Map Material to {activeSecMap?.name}</div>
              <button style={S.close} onClick={() => setSecAddMapModal(false)}>✕</button>
            </div>
            <form onSubmit={handleSaveSecMap} style={S.form}>
              <label style={S.label}>Select Catalog Material *
                <select style={S.select} value={selectedSecMatId} onChange={e => setSelectedSecMatId(e.target.value)} required>
                  <option value="">— Select an inventory material —</option>
                  {catalogMaterials.map(m => (
                    <option key={m.id} value={m.id}>{m.code} — {m.name} ({m.uom} | Stock: {Number(m.current_stock || 0).toFixed(2)})</option>
                  ))}
                </select>
              </label>
              <label style={{ ...S.label, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <input type="checkbox" checked={isPrimarySecMat} onChange={e => setIsPrimarySecMat(e.target.checked)} />
                <span>Mark as primary section for this item</span>
              </label>
              {secMapErr && <div style={S.error}>{secMapErr}</div>}
              <div style={S.modalFooter}>
                <button type="button" style={S.btnSecondary} onClick={() => setSecAddMapModal(false)}>Cancel</button>
                <button type="submit" style={S.btnPrimary} disabled={secMapSaving}>{secMapSaving ? 'Mapping...' : 'Confirm Mapping'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MACHINE MAPPED MATERIALS MODAL ── */}
      {activeMcnMap && (
        <div style={S.overlay} onClick={() => setActiveMcnMap(null)}>
          <div style={{ ...S.modal, maxWidth: 850 }} onClick={e => e.stopPropagation()}>
            <div style={S.modalHeader}>
              <div>
                <div style={S.modalTitle}>⚡ Mapped Spares: {activeMcnMap.name} ({activeMcnMap.code})</div>
                <div style={{ fontSize: 12, color: '#64748b' }}>Catalog materials and spare components dedicated to this machine unit.</div>
              </div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <button style={S.btnPrimary} onClick={() => { loadCatalogMaterials(); setMcnAddMapModal(true); setMcnMapErr(''); setSelectedMcnMatId('') }}>+ Map Spare to Machine</button>
                <button style={S.close} onClick={() => setActiveMcnMap(null)}>✕</button>
              </div>
            </div>

            {mcnMapLoading ? <div style={S.loading}>Loading mapped machine spares...</div> : (
              <div style={{ maxHeight: 400, overflowY: 'auto' }}>
                <table style={S.table}>
                  <thead>
                    <tr style={S.thead}>
                      {['Material Code', 'Material Name', 'Category', 'Current Stock', 'Unit Price', 'Equipment/Tag', 'Action'].map(h => <th key={h} style={S.th}>{h}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {mcnMappedItems.length === 0 && <tr><td colSpan={7} style={S.empty}>No spares mapped to this machine unit yet.</td></tr>}
                    {mcnMappedItems.map(mat => (
                      <tr key={mat.id} style={S.tr}>
                        <td style={S.td}><code style={{ background: '#f1f5f9', color: '#0f766e', padding: '2px 6px', borderRadius: 4, fontWeight: 700 }}>{mat.code}</code></td>
                        <td style={S.td}><strong>{mat.name}</strong></td>
                        <td style={S.td}>{mat.categoryName || 'Spare Part'}</td>
                        <td style={S.td}>{Number(mat.currentStock || 0).toFixed(3)} {mat.uom}</td>
                        <td style={S.td}>₹ {Number(mat.unitPrice || 0).toFixed(2)}</td>
                        <td style={S.td}>{mat.equipmentName || mat.tagName || 'Machine General'}</td>
                        <td style={S.td}>
                          <button style={{ background: '#fef2f2', border: '1px solid #dc2626', color: '#dc2626', borderRadius: 4, padding: '3px 8px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }} onClick={() => handleUnmapMcnMaterial(mat)}>
                            🗑️ Unmap
                          </button>
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

      {/* ── SUB-MODAL: MAP ITEM TO MACHINE ── */}
      {mcnAddMapModal && (
        <div style={{ ...S.overlay, zIndex: 6100 }} onClick={() => setMcnAddMapModal(false)}>
          <div style={{ ...S.modal, maxWidth: 500 }} onClick={e => e.stopPropagation()}>
            <div style={S.modalHeader}>
              <div style={S.modalTitle}>+ Map Spare to {activeMcnMap?.name}</div>
              <button style={S.close} onClick={() => setMcnAddMapModal(false)}>✕</button>
            </div>
            <form onSubmit={handleSaveMcnMap} style={S.form}>
              <label style={S.label}>Select Catalog Material / Spare *
                <select style={S.select} value={selectedMcnMatId} onChange={e => setSelectedMcnMatId(e.target.value)} required>
                  <option value="">— Select an inventory spare —</option>
                  {catalogMaterials.map(m => (
                    <option key={m.id} value={m.id}>{m.code} — {m.name} ({m.uom} | Stock: {Number(m.current_stock || 0).toFixed(2)})</option>
                  ))}
                </select>
              </label>
              <label style={S.label}>Fitment Notes / Position
                <input style={S.input} value={mcnRemarks} onChange={e => setMcnRemarks(e.target.value)} placeholder="e.g. Drive side bearing / Main pump spare" />
              </label>
              {mcnMapErr && <div style={S.error}>{mcnMapErr}</div>}
              <div style={S.modalFooter}>
                <button type="button" style={S.btnSecondary} onClick={() => setMcnAddMapModal(false)}>Cancel</button>
                <button type="submit" style={S.btnPrimary} disabled={mcnMapSaving}>{mcnMapSaving ? 'Mapping...' : 'Confirm Mapping'}</button>
              </div>
            </form>
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

      {/* MACHINE MODAL */}
      {mcnModal && (
        <div style={S.overlay} onClick={() => setMcnModal(false)}>
          <div style={S.modal} onClick={e => e.stopPropagation()}>
            <div style={S.modalHeader}>
              <div style={S.modalTitle}>{mcnForm.id ? 'Edit Machine Unit' : 'Add Machine Unit'}</div>
              <button style={S.close} onClick={() => setMcnModal(false)}>✕</button>
            </div>
            <form onSubmit={saveMachine} style={S.form}>
              <label style={S.label}>Machine Name *
                <input style={S.input} value={mcnForm.name} onChange={e => setMcnForm(f => ({ ...f, name: e.target.value }))} required placeholder="e.g. Paper Machine 1 (PM-1)" />
              </label>
              <label style={S.label}>Machine Code *
                <input style={S.input} value={mcnForm.code} onChange={e => setMcnForm(f => ({ ...f, code: e.target.value }))} required placeholder="e.g. PM1" />
              </label>
              <label style={S.label}>Machine Type
                <input style={S.input} value={mcnForm.type} onChange={e => setMcnForm(f => ({ ...f, type: e.target.value }))} placeholder="e.g. Fourdrinier / Kraft Paper Machine" />
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                <label style={S.label}>Capacity (TPD)
                  <input style={S.input} type="number" value={mcnForm.capacity_tpd} onChange={e => setMcnForm(f => ({ ...f, capacity_tpd: e.target.value }))} placeholder="150" />
                </label>
                <label style={S.label}>Ideal Speed (mpm)
                  <input style={S.input} type="number" value={mcnForm.ideal_speed_mpm} onChange={e => setMcnForm(f => ({ ...f, ideal_speed_mpm: e.target.value }))} placeholder="350" />
                </label>
                <label style={S.label}>Design Speed (mpm)
                  <input style={S.input} type="number" value={mcnForm.design_speed_mpm} onChange={e => setMcnForm(f => ({ ...f, design_speed_mpm: e.target.value }))} placeholder="400" />
                </label>
              </div>
              {err && <div style={S.error}>{err}</div>}
              <div style={S.modalFooter}>
                <button type="button" style={S.btnSecondary} onClick={() => setMcnModal(false)}>Cancel</button>
                <button type="submit" style={S.btnPrimary} disabled={saving}>{saving ? 'Saving...' : 'Save Machine'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CATEGORY MODAL */}
      {catModal && (
        <div style={S.overlay} onClick={() => setCatModal(false)}>
          <div style={S.modal} onClick={e => e.stopPropagation()}>
            <div style={S.modalHeader}>
              <div style={S.modalTitle}>{catForm.id ? 'Edit Category' : 'Add Category'}</div>
              <button style={S.close} onClick={() => setCatModal(false)}>✕</button>
            </div>
            <form onSubmit={saveCategory} style={S.form}>
              <label style={S.label}>Category Name *
                <input style={S.input} value={catForm.name} onChange={e => setCatForm(f => ({ ...f, name: e.target.value }))} required placeholder="e.g. Mechanical Spares" />
              </label>
              <label style={S.label}>Category Code
                <input style={S.input} value={catForm.code} onChange={e => setCatForm(f => ({ ...f, code: e.target.value }))} placeholder="e.g. MECH_SPARE" />
              </label>
              <label style={S.label}>Classification Type
                <select style={S.select} value={catForm.type} onChange={e => setCatForm(f => ({ ...f, type: e.target.value }))}>
                  {['Raw Material', 'Chemical', 'Spare Part', 'Consumable', 'Finished Goods', 'General', 'Electrical'].map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </label>
              <label style={S.label}>Parent Category (Optional for subcategory)
                <select style={S.select} value={catForm.parent_id} onChange={e => setCatForm(f => ({ ...f, parent_id: e.target.value }))}>
                  <option value="">None (Top-level Category)</option>
                  {categories.filter(c => !catForm.id || c.id !== catForm.id).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </label>
              {err && <div style={S.error}>{err}</div>}
              <div style={S.modalFooter}>
                <button type="button" style={S.btnSecondary} onClick={() => setCatModal(false)}>Cancel</button>
                <button type="submit" style={S.btnPrimary} disabled={saving}>{saving ? 'Saving...' : 'Save Category'}</button>
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
