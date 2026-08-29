import React, { useState, useEffect, useCallback } from 'react'

const POLL_MS = 30_000
const API_URL = '/api/sections'

const alarmColor = (c, w) => {
  if (c > 0) return '#ef4444'
  if (w > 0) return '#f59e0b'
  return '#22c55e'
}

export default function AllSections({ onNavigate }) {
  const [sections, setSections] = useState([])
  const [loading, setLoading] = useState(true)
  const [lastSync, setLastSync] = useState(null)
  const [search, setSearch] = useState('')
  const [selectedDept, setSelectedDept] = useState('ALL')
  
  // Mapped Materials Modal State
  const [activeSectionMaterials, setActiveSectionMaterials] = useState(null)
  const [mappedMaterials, setMappedMaterials] = useState([])
  const [materialsLoading, setMaterialsLoading] = useState(false)
  const [mapModal, setMapModal] = useState(false)
  const [allMaterialsList, setAllMaterialsList] = useState([])
  const [selectedMaterialToMap, setSelectedMaterialToMap] = useState('')
  const [isPrimaryMap, setIsPrimaryMap] = useState(false)
  const [mapSaving, setMapSaving] = useState(false)
  const [mapErr, setMapErr] = useState('')

  // Section Equipment Drawer State
  const [activeSectionEquip, setActiveSectionEquip] = useState(null)
  const [sectionEquipList, setSectionEquipList] = useState([])
  const [equipLoading, setEquipLoading] = useState(false)

  const fetchSnapshot = useCallback(async () => {
    try {
      const r = await fetch(`${API_URL}/all/kpi-snapshot`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('mk_token')}` }
      })
      const j = await r.json()
      if (j.success) {
        setSections(j.data || [])
        setLastSync(new Date())
      }
    } catch (e) {
      console.error('AllSections fetch error', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSnapshot()
    const id = setInterval(fetchSnapshot, POLL_MS)
    return () => clearInterval(id)
  }, [fetchSnapshot])

  // ── Load Mapped Materials for a Specific Section ──
  const openSectionMaterials = async (sec) => {
    setActiveSectionMaterials(sec)
    setMaterialsLoading(true)
    setMapErr('')
    try {
      const r = await fetch(`/api/master/sections/${sec.id}/materials`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('mk_token')}` }
      }).then(res => res.json())
      if (r.success) setMappedMaterials(r.data || [])
    } catch (e) {
      console.error('Error loading section materials', e)
    } finally {
      setMaterialsLoading(false)
    }
  }

  // ── Load All Master Materials for the Add Mapping Selector ──
  const openAddMappingModal = async () => {
    setMapModal(true)
    setSelectedMaterialToMap('')
    setIsPrimaryMap(false)
    setMapErr('')
    try {
      const r = await fetch('/api/master/materials?limit=2000&is_active=true', {
        headers: { Authorization: `Bearer ${localStorage.getItem('mk_token')}` }
      }).then(res => res.json())
      if (r.success) setAllMaterialsList(r.data || [])
    } catch (e) {
      console.error('Error loading materials list', e)
    }
  }

  // ── Save New Material Mapping to Section ──
  const handleMapMaterial = async (e) => {
    e.preventDefault()
    if (!selectedMaterialToMap) return setMapErr('Please select a material to map')
    setMapSaving(true)
    try {
      const r = await fetch(`/api/master/sections/${activeSectionMaterials.id}/materials`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('mk_token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          material_id: selectedMaterialToMap,
          is_primary: isPrimaryMap
        })
      }).then(res => res.json())

      if (r.success) {
        setMapModal(false)
        openSectionMaterials(activeSectionMaterials)
        fetchSnapshot()
      } else {
        setMapErr(r.message || 'Failed to map material')
      }
    } catch (e) {
      setMapErr('Error mapping material: ' + e.message)
    } finally {
      setMapSaving(false)
    }
  }

  // ── Unmap Material from Section ──
  const handleUnmapMaterial = async (mat) => {
    if (!window.confirm(`Are you sure you want to unmap "${mat.name}" (${mat.code}) from ${activeSectionMaterials.name}?`)) return
    try {
      const r = await fetch(`/api/master/sections/${activeSectionMaterials.id}/materials/${mat.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${localStorage.getItem('mk_token')}` }
      }).then(res => res.json())

      if (r.success) {
        openSectionMaterials(activeSectionMaterials)
        fetchSnapshot()
      } else {
        alert(r.message || 'Failed to unmap material')
      }
    } catch (e) {
      alert('Error unmapping material: ' + e.message)
    }
  }

  // ── Open Section Machinery & Spares Drawer ──
  const openSectionEquipment = async (sec) => {
    setActiveSectionEquip(sec)
    setEquipLoading(true)
    try {
      const r = await fetch(`/api/master/section-equipment?section_id=${sec.id}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('mk_token')}` }
      }).then(res => res.json())
      if (r.success) setSectionEquipList(r.data || [])
    } catch (e) {
      console.error('Error loading equipment', e)
    } finally {
      setEquipLoading(false)
    }
  }

  // ── Department Rollup & Filter ──
  const departments = ['ALL', ...Array.from(new Set(sections.map(s => s.deptName || 'Production / Mill Operations')))]

  const filteredSections = sections.filter(sec => {
    const q = search.toLowerCase()
    const matchesSearch = !q ||
      sec.name?.toLowerCase().includes(q) ||
      sec.sectionCode?.toLowerCase().includes(q) ||
      sec.description?.toLowerCase().includes(q)
    const matchesDept = selectedDept === 'ALL' || (sec.deptName || 'Production / Mill Operations') === selectedDept
    return matchesSearch && matchesDept
  })

  // ── Top Summary Totals ──
  const totalEquip = sections.reduce((acc, s) => acc + (parseInt(s.equipmentCount) || 0), 0)
  const totalMaterials = sections.reduce((acc, s) => acc + (parseInt(s.materialsCount) || 0), 0)
  const totalValuation = sections.reduce((acc, s) => acc + (parseFloat(s.stockValuation) || 0), 0)
  const criticalSections = sections.filter(s => (parseInt(s.criticalAlarms) || 0) > 0).length

  if (loading) return <div style={S.center}>Loading plant &amp; machinery command center...</div>

  return (
    <div style={S.page}>
      {/* ── Header Title & Refresh ── */}
      <div style={S.header}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 26 }}>🏭</span>
            <div>
              <h2 style={S.title}>Plant Process Sections &amp; Machinery Command Center</h2>
              <p style={S.sub}>Mill-wide live overview: digital twin rolls, multi-section inventory spares, process KPIs, and alarm telemetry.</p>
            </div>
          </div>
        </div>
        <div style={S.syncBadge}>
          <span>Sync: {lastSync ? lastSync.toLocaleTimeString('en-IN') : '—'}</span>
          <button onClick={fetchSnapshot} style={S.refreshBtn} title="Force refresh live section metrics">↻ Live Refresh</button>
        </div>
      </div>

      {/* ── Executive KPI Rollup Strip ── */}
      <div style={S.kpiStrip}>
        <div style={S.kpiBox}>
          <div style={S.kpiBoxLabel}>Active Sections</div>
          <div style={{ ...S.kpiBoxVal, color: '#0f766e' }}>{sections.length}</div>
          <div style={S.kpiBoxSub}>Configured Process Units</div>
        </div>
        <div style={S.kpiBox}>
          <div style={S.kpiBoxLabel}>Machinery &amp; Rolls</div>
          <div style={{ ...S.kpiBoxVal, color: '#0284c7' }}>{totalEquip}</div>
          <div style={S.kpiBoxSub}>Digital Twin Bearings/Belts</div>
        </div>
        <div style={S.kpiBox}>
          <div style={S.kpiBoxLabel}>Mapped Inventory Items</div>
          <div style={{ ...S.kpiBoxVal, color: '#16a34a' }}>{totalMaterials}</div>
          <div style={S.kpiBoxSub}>₹ {totalValuation.toLocaleString('en-IN', { maximumFractionDigits: 2 })} Valuation</div>
        </div>
        <div style={S.kpiBox}>
          <div style={S.kpiBoxLabel}>Section Health</div>
          <div style={{ ...S.kpiBoxVal, color: criticalSections > 0 ? '#ef4444' : '#22c55e' }}>
            {criticalSections > 0 ? `⚠️ ${criticalSections} Alarms` : '🟢 100% Normal'}
          </div>
          <div style={S.kpiBoxSub}>Live PLC / Sensor Telemetry</div>
        </div>
      </div>

      {/* ── Filters & Search Toolbar ── */}
      <div style={S.toolbar}>
        <div style={S.deptTabs}>
          {departments.map(d => (
            <button
              key={d}
              style={{ ...S.deptTabBtn, ...(selectedDept === d ? S.deptTabActive : {}) }}
              onClick={() => setSelectedDept(d)}
            >
              {d === 'ALL' ? '🌐 All Sections' : d}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <input
            style={S.searchInput}
            placeholder="🔍 Search plant section, code..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* ── Process Sections Grid ── */}
      <div style={S.grid}>
        {filteredSections.map(sec => {
          const crit = parseInt(sec.criticalAlarms) || 0
          const warn = parseInt(sec.warningAlarms) || 0
          const kpi = sec.kpiData || {}
          const topKeys = Object.keys(kpi).filter(k => k !== '_alarms').slice(0, 3)
          const equipCnt = parseInt(sec.equipmentCount) || 0
          const matCnt = parseInt(sec.materialsCount) || 0
          const val = parseFloat(sec.stockValuation) || 0

          return (
            <div key={sec.sectionCode || sec.id} style={{ ...S.card, borderTop: `4px solid ${alarmColor(crit, warn)}` }}>
              {/* Card Top */}
              <div style={S.cardHeader}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={S.icon}>{sec.icon || '🏭'}</span>
                  <div>
                    <div style={S.cardName}>{sec.name}</div>
                    <div style={S.cardDept}>
                      <span style={S.codeBadge}>{sec.sectionCode}</span>
                      <span>{sec.deptName || 'Production'}</span>
                    </div>
                  </div>
                </div>
                {(crit > 0 || warn > 0) && (
                  <span style={{ ...S.alarmBadge, background: alarmColor(crit, warn) }}>
                    {crit > 0 ? `🔴 ${crit}` : `⚠️ ${warn}`}
                  </span>
                )}
              </div>

              {/* Machinery & Inventory Counters */}
              <div style={S.counterRow}>
                <button
                  style={S.counterBtn}
                  onClick={() => openSectionEquipment(sec)}
                  title="View and inspect all machinery rolls, bearings, and digital twin specs in this section"
                >
                  <span style={{ fontSize: 14 }}>⚙️</span>
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontWeight: 800, color: '#0f766e', fontSize: 13 }}>{equipCnt}</div>
                    <div style={{ fontSize: 10, color: '#64748b' }}>Machinery Rolls</div>
                  </div>
                </button>
                <button
                  style={{ ...S.counterBtn, borderColor: '#0284c7' }}
                  onClick={() => openSectionMaterials(sec)}
                  title="Manage and map multi-section store items, raw materials, and maintenance spares"
                >
                  <span style={{ fontSize: 14 }}>📦</span>
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontWeight: 800, color: '#0284c7', fontSize: 13 }}>{matCnt}</div>
                    <div style={{ fontSize: 10, color: '#64748b' }}>Mapped Spares</div>
                  </div>
                </button>
              </div>

              {/* Valuation preview if items are mapped */}
              {matCnt > 0 && (
                <div style={S.valuationBadge}>
                  <span>💰 Store Stock Valuation:</span>
                  <strong>₹ {val.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</strong>
                </div>
              )}

              {/* Process Readings Preview */}
              <div style={{ marginTop: 10 }}>
                {topKeys.length > 0 ? (
                  <div style={S.kpiList}>
                    {topKeys.map(k => (
                      <div key={k} style={S.kpiRow}>
                        <span style={S.kpiLabel}>{kpi[k].param || k}</span>
                        <span style={S.kpiVal}>{Number(kpi[k].avg).toFixed(2)} {kpi[k].uom || ''}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={S.noData}>Telemetry standing by / no alarms</div>
                )}
              </div>

              {/* Interactive Actions Footer */}
              <div style={S.cardFooter}>
                <button
                  style={S.actionBtnSecondary}
                  onClick={() => openSectionMaterials(sec)}
                >
                  📦 Mapped Items ({matCnt})
                </button>
                <button
                  style={S.actionBtnPrimary}
                  onClick={() => {
                    const navKey = `sections-${(sec.sectionCode || '').toLowerCase()}`
                    if (onNavigate) onNavigate(navKey)
                  }}
                  title="Open dedicated floor telemetry dashboard"
                >
                  🚀 Dashboard ›
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* ── MODAL: SECTION MAPPED MATERIALS MANAGER ── */}
      {activeSectionMaterials && (
        <div style={S.overlay}>
          <div style={{ ...S.modal, maxWidth: 850 }} onClick={e => e.stopPropagation()}>
            <div style={S.modalHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 24 }}>{activeSectionMaterials.icon || '📦'}</span>
                <div>
                  <div style={S.modalTitle}>
                    Mapped Inventory Items: {activeSectionMaterials.name} ({activeSectionMaterials.sectionCode})
                  </div>
                  <div style={{ fontSize: 12, color: '#64748b' }}>
                    One inventory item can be mapped across multiple plant sections &amp; machines simultaneously.
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <button style={S.btnPrimary} onClick={openAddMappingModal}>+ Map Material / Spare</button>
                <button style={S.close} onClick={() => setActiveSectionMaterials(null)}>✕</button>
              </div>
            </div>

            {materialsLoading ? (
              <div style={S.loading}>Loading mapped inventory items...</div>
            ) : (
              <div style={{ maxHeight: 420, overflowY: 'auto' }}>
                <table style={S.table}>
                  <thead>
                    <tr style={S.thead}>
                      {['Material Code', 'Material Name', 'Category', 'Current Stock', 'Unit Price', 'Valuation', 'Role', 'Action'].map(h => <th key={h} style={S.th}>{h}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {mappedMaterials.length === 0 && (
                      <tr>
                        <td colSpan={8} style={S.empty}>
                          No materials mapped to this section yet. Click "+ Map Material / Spare" to link items.
                        </td>
                      </tr>
                    )}
                    {mappedMaterials.map(mat => (
                      <tr key={mat.id} style={S.tr}>
                        <td style={S.td}>
                          <code style={{ background: '#f1f5f9', color: '#0f766e', padding: '2px 6px', borderRadius: 4, fontWeight: 700 }}>
                            {mat.code}
                          </code>
                        </td>
                        <td style={S.td}>
                          <div style={{ fontWeight: 700, color: '#0f172a' }}>{mat.name}</div>
                        </td>
                        <td style={S.td}>{mat.categoryName || 'General Store'}</td>
                        <td style={S.td}>
                          <span style={{ fontWeight: 800, color: Number(mat.currentStock) <= Number(mat.reorderLevel) ? '#dc2626' : '#16a34a' }}>
                            {Number(mat.currentStock || 0).toFixed(3)} {mat.uom}
                          </span>
                        </td>
                        <td style={S.td}>₹ {Number(mat.unitPrice || 0).toFixed(2)}</td>
                        <td style={S.td}>₹ {(Number(mat.currentStock || 0) * Number(mat.unitPrice || 0)).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                        <td style={S.td}>
                          <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 10, background: mat.isPrimary ? '#dcfce7' : '#f1f5f9', color: mat.isPrimary ? '#166534' : '#475569', fontWeight: 700 }}>
                            {mat.isPrimary ? 'Primary Section' : 'Multi-Mapped'}
                          </span>
                        </td>
                        <td style={S.td}>
                          <button
                            style={{ background: '#fef2f2', border: '1px solid #dc2626', color: '#dc2626', borderRadius: 4, padding: '3px 8px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
                            onClick={() => handleUnmapMaterial(mat)}
                            title="Unmap this material from this plant section"
                          >
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

      {/* ── SUB-MODAL: ADD MATERIAL MAPPING SELECTOR ── */}
      {mapModal && (
        <div style={{ ...S.overlay, zIndex: 6100 }}>
          <div style={{ ...S.modal, maxWidth: 520 }} onClick={e => e.stopPropagation()}>
            <div style={S.modalHeader}>
              <div style={S.modalTitle}>+ Map Item to {activeSectionMaterials?.name}</div>
              <button style={S.close} onClick={() => setMapModal(false)}>✕</button>
            </div>
            <form onSubmit={handleMapMaterial} style={S.form}>
              <label style={S.label}>
                Select Catalog Material / Spare *
                <select
                  style={S.select}
                  value={selectedMaterialToMap}
                  onChange={e => setSelectedMaterialToMap(e.target.value)}
                  required
                >
                  <option value="">— Select an inventory material —</option>
                  {allMaterialsList.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.code} — {m.name} ({m.uom} | Stock: {Number(m.current_stock || 0).toFixed(2)})
                    </option>
                  ))}
                </select>
              </label>

              <label style={{ ...S.label, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <input
                  type="checkbox"
                  checked={isPrimaryMap}
                  onChange={e => setIsPrimaryMap(e.target.checked)}
                />
                <span>Set as primary operational section for this item</span>
              </label>

              {mapErr && <div style={S.error}>{mapErr}</div>}

              <div style={S.modalFooter}>
                <button type="button" style={S.btnSecondary} onClick={() => setMapModal(false)}>Cancel</button>
                <button type="submit" style={S.btnPrimary} disabled={mapSaving}>
                  {mapSaving ? 'Mapping...' : 'Confirm Mapping'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: SECTION MACHINERY & SPARES DRAWER ── */}
      {activeSectionEquip && (
        <div style={S.overlay}>
          <div style={{ ...S.modal, maxWidth: 900 }} onClick={e => e.stopPropagation()}>
            <div style={S.modalHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 24 }}>⚙️</span>
                <div>
                  <div style={S.modalTitle}>Machinery &amp; Digital Twin Rolls: {activeSectionEquip.name}</div>
                  <div style={{ fontSize: 12, color: '#64748b' }}>Mechanical specifications, bearings, lock nuts, washers, and drive belts.</div>
                </div>
              </div>
              <button style={S.close} onClick={() => setActiveSectionEquip(null)}>✕</button>
            </div>

            {equipLoading ? (
              <div style={S.loading}>Loading machinery components...</div>
            ) : (
              <div style={{ maxHeight: 420, overflowX: 'auto' }}>
                <table style={S.table}>
                  <thead>
                    <tr style={S.thead}>
                      {['Tag Code', 'Equipment / Roll Name', 'Bearing Size', 'Lock Nut / Washer', 'Belt No', 'Shaft Size', 'Sleeve / Couplings', 'Status'].map(h => <th key={h} style={S.th}>{h}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {sectionEquipList.length === 0 && (
                      <tr>
                        <td colSpan={8} style={S.empty}>No machinery components recorded for this section yet.</td>
                      </tr>
                    )}
                    {sectionEquipList.map(eq => (
                      <tr key={eq.id} style={S.tr}>
                        <td style={S.td}>
                          <code style={{ background: '#f1f5f9', color: '#0f766e', padding: '2px 6px', borderRadius: 4, fontWeight: 700 }}>
                            {eq.tagName || '—'}
                          </code>
                        </td>
                        <td style={S.td}>
                          <div style={{ fontWeight: 700, color: '#0f172a' }}>{eq.equipmentName}</div>
                        </td>
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
                          {[eq.sleeve ? `Slv: ${eq.sleeve}` : null, eq.couplings ? `Cpl: ${eq.couplings}` : null].filter(Boolean).join(' | ') || '—'}
                        </td>
                        <td style={S.td}>
                          <span style={{ ...S.statusBadge, background: '#22c55e22', color: '#16a34a' }}>Active</span>
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
    </div>
  )
}

const S = {
  page: { padding: 24, background: '#f6f5f0', minHeight: '100vh' },
  center: { padding: 40, textAlign: 'center', color: '#8a8a90' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 14 },
  title: { margin: 0, fontSize: 22, fontWeight: 800, color: '#1b1b1d' },
  sub: { margin: '4px 0 0', color: '#64748b', fontSize: 13 },
  syncBadge: { display: 'flex', alignItems: 'center', gap: 10, color: '#64748b', fontSize: 12 },
  refreshBtn: { background: '#0f766e', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 700 },
  kpiStrip: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 18 },
  kpiBox: { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: 14 },
  kpiBoxLabel: { fontSize: 11.5, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' },
  kpiBoxVal: { fontSize: 22, fontWeight: 900, margin: '4px 0' },
  kpiBoxSub: { fontSize: 11, color: '#94a3b8' },
  toolbar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 18 },
  deptTabs: { display: 'flex', gap: 6, flexWrap: 'wrap' },
  deptTabBtn: { background: '#fff', border: '1px solid #e2e8f0', color: '#64748b', padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' },
  deptTabActive: { background: '#0f766e', color: '#fff', borderColor: '#0f766e' },
  searchInput: { width: 240, padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: 8, fontSize: 13, background: '#fff' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 },
  card: { background: '#fff', borderRadius: 10, padding: 18, border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' },
  cardHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  icon: { fontSize: 24, padding: 8, background: '#f8fafc', borderRadius: 8, border: '1px solid #f1f5f9' },
  cardName: { fontWeight: 800, fontSize: 15, color: '#0f172a' },
  cardDept: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#64748b', marginTop: 2 },
  codeBadge: { background: '#f1f5f9', padding: '1px 5px', borderRadius: 4, fontWeight: 700, color: '#0f766e', fontSize: 10 },
  alarmBadge: { fontSize: 11, color: '#fff', borderRadius: 10, padding: '2px 8px', fontWeight: 700 },
  counterRow: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, margin: '8px 0' },
  counterBtn: { display: 'flex', alignItems: 'center', gap: 8, background: '#f8fafc', border: '1px solid #e2e8f0', padding: '8px 10px', borderRadius: 8, cursor: 'pointer', transition: 'background .15s' },
  valuationBadge: { background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534', padding: '4px 8px', borderRadius: 6, fontSize: 11, display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  kpiList: { display: 'flex', flexDirection: 'column', gap: 4, background: '#f8fafc', padding: 8, borderRadius: 6 },
  kpiRow: { display: 'flex', justifyContent: 'space-between', fontSize: 11.5 },
  kpiLabel: { color: '#64748b' },
  kpiVal: { fontWeight: 700, color: '#0f172a' },
  noData: { fontSize: 11.5, color: '#94a3b8', fontStyle: 'italic', padding: '4px 0' },
  cardFooter: { display: 'flex', gap: 8, marginTop: 14, paddingTop: 12, borderTop: '1px solid #f1f5f9' },
  actionBtnPrimary: { flex: 1, background: '#0f766e', color: '#fff', border: 'none', borderRadius: 6, padding: '7px 10px', fontSize: 12, fontWeight: 700, cursor: 'pointer' },
  actionBtnSecondary: { flex: 1, background: '#f8fafc', color: '#0f766e', border: '1px solid #cbd5e1', borderRadius: 6, padding: '7px 10px', fontSize: 12, fontWeight: 700, cursor: 'pointer' },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 6000, padding: 20 },
  modal: { background: '#ffffff', borderRadius: 12, padding: 22, width: '100%', border: '1px solid #e2e8f0', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)' },
  modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 16, fontWeight: 800, color: '#0f172a' },
  close: { background: 'none', border: 'none', color: '#94a3b8', fontSize: 18, cursor: 'pointer' },
  form: { display: 'flex', flexDirection: 'column', gap: 12 },
  modalFooter: { display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 },
  error: { background: '#fee2e2', border: '1px solid #fca5a5', color: '#b91c1c', padding: '8px 12px', borderRadius: 6, fontSize: 12 },
  loading: { padding: 30, textAlign: 'center', color: '#64748b' },
  empty: { padding: 30, textAlign: 'center', color: '#94a3b8' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 12.5 },
  thead: { background: '#f8fafc', borderBottom: '2px solid #0f766e' },
  th: { padding: '9px 10px', textAlign: 'left', color: '#0f766e', fontWeight: 700, fontSize: 11.5, textTransform: 'uppercase' },
  tr: { borderBottom: '1px solid #f1f5f9' },
  td: { padding: '9px 10px', verticalAlign: 'middle' },
  statusBadge: { fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 10 },
  input: { width: '100%', padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 13, background: '#f8fafc', boxSizing: 'border-box' },
  select: { width: '100%', padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 13, background: '#f8fafc', boxSizing: 'border-box' },
  label: { display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, color: '#475569', fontWeight: 600, width: '100%' },
  btnPrimary: { background: '#0f766e', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 14px', fontWeight: 700, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' },
  btnSecondary: { background: '#ffffff', color: '#1b1b1d', border: '1px solid #e2e8f0', borderRadius: 6, padding: '8px 14px', fontWeight: 600, fontSize: 12, cursor: 'pointer' },
}
