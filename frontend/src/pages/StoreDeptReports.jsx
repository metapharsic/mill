import React, { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'

const API = '/api'
const h = () => ({ Authorization: `Bearer ${localStorage.getItem('mk_token')}` })

export default function StoreDeptReports({ onNavigate }) {
  const { user } = useAuth()
  const { addToast } = useToast()
  const isOrgWide = (user?.role_level || 0) >= 4
  const [data, setData] = useState({ departments: [], categoryBreakdown: [], topConsumed: [] })
  const [loading, setLoading] = useState(false)
  const [filterRange, setFilterRange] = useState('month')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [selectedDept, setSelectedDept] = useState('')

  // Granular report tabs
  const [tab, setTab] = useState('dept')
  const [itemData, setItemData] = useState({ items: [], topDepartments: [] })
  const [categoryData, setCategoryData] = useState([])
  const [binData, setBinData] = useState({ byBin: [], items: [] })
  const [vendorData, setVendorData] = useState({ vendors: [], priceTrend: [] })
  const [movementData, setMovementData] = useState({ items: [], summary: { fast: 0, slow: 0, dead: 0, deadStockValue: 0 } })
  const [sectionData, setSectionData] = useState({ kpis: {}, sections: [], granularItems: [] })
  const [selectedSecFilter, setSelectedSecFilter] = useState('')
  const [granularLoading, setGranularLoading] = useState(false)
  const [expandedCategory, setExpandedCategory] = useState(null)
  const [expandedBin, setExpandedBin] = useState(null)
  const [expandedVendor, setExpandedVendor] = useState(null)
  const [selectedItemId, setSelectedItemId] = useState('')

  const loadGranular = useCallback(async () => {
    setGranularLoading(true)
    try {
      const params = new URLSearchParams()
      if (fromDate) params.append('from', fromDate)
      if (toDate) params.append('to', toDate)
      if (tab === 'item') {
        const p2 = new URLSearchParams(params)
        if (selectedItemId) p2.append('materialId', selectedItemId)
        const r = await fetch(`${API}/store/reports/item-wise?${p2}`, { headers: h() }).then(res => res.json())
        if (r.success) setItemData(r.data || { items: [], topDepartments: [] })
        else addToast(r.message || 'Error loading item report', 'error')
      } else if (tab === 'category') {
        const r = await fetch(`${API}/store/reports/category-wise?${params}`, { headers: h() }).then(res => res.json())
        if (r.success) setCategoryData(r.data || [])
        else addToast(r.message || 'Error loading category report', 'error')
      } else if (tab === 'bin') {
        const r = await fetch(`${API}/store/reports/bin-location`, { headers: h() }).then(res => res.json())
        if (r.success) setBinData(r.data || { byBin: [], items: [] })
        else addToast(r.message || 'Error loading bin location report', 'error')
      } else if (tab === 'vendor') {
        const p2 = new URLSearchParams(params)
        if (expandedVendor) p2.append('vendorId', expandedVendor)
        const r = await fetch(`${API}/store/reports/vendor-wise?${p2}`, { headers: h() }).then(res => res.json())
        if (r.success) setVendorData(r.data || { vendors: [], priceTrend: [] })
        else addToast(r.message || 'Error loading vendor report', 'error')
      } else if (tab === 'movement') {
        const r = await fetch(`${API}/store/reports/movement-analysis?${params}`, { headers: h() }).then(res => res.json())
        if (r.success) setMovementData(r.data || { items: [], summary: { fast: 0, slow: 0, dead: 0, deadStockValue: 0 } })
        else addToast(r.message || 'Error loading movement report', 'error')
      } else if (tab === 'section') {
        const p2 = new URLSearchParams(params)
        if (selectedSecFilter) p2.append('section_id', selectedSecFilter)
        const r = await fetch(`${API}/reports/plant-sections/detailed?${p2}`, { headers: h() }).then(res => res.json())
        if (r.success) setSectionData(r.data || { kpis: {}, sections: [], granularItems: [] })
        else addToast(r.message || 'Error loading plant section report', 'error')
      }
    } catch (e) {
      console.error(e)
      addToast('Network error loading granular report', 'error')
    } finally {
      setGranularLoading(false)
    }
  }, [tab, fromDate, toDate, selectedItemId, expandedVendor, selectedSecFilter, addToast])

  useEffect(() => {
    if (tab !== 'dept') loadGranular()
  }, [tab, loadGranular])

  const loadReport = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (fromDate) params.append('from', fromDate)
      if (toDate) params.append('to', toDate)
      const r = await fetch(`${API}/store/reports/department-wise?${params}`, { headers: h() }).then(res => res.json())
      if (r.success) {
        setData(r.data || { departments: [], categoryBreakdown: [], topConsumed: [] })
      } else {
        addToast(r.message || 'Error loading report', 'error')
      }
    } catch (e) {
      console.error(e)
      addToast('Network error loading store report', 'error')
    } finally {
      setLoading(false)
    }
  }, [fromDate, toDate, addToast])

  useEffect(() => {
    loadReport()
  }, [loadReport])

  const handleRangeChange = (range) => {
    setFilterRange(range)
    const now = new Date()
    if (range === 'today') {
      const today = now.toISOString().slice(0, 10)
      setFromDate(today)
      setToDate(today)
    } else if (range === 'month') {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
      const today = now.toISOString().slice(0, 10)
      setFromDate(firstDay)
      setToDate(today)
    } else if (range === 'all') {
      setFromDate('')
      setToDate('')
    }
  }

  const totalMillIssues = data.departments.reduce((acc, d) => acc + parseInt(d.totalIssues || 0), 0)
  const totalMillQty = data.departments.reduce((acc, d) => acc + parseFloat(d.totalQuantity || 0), 0)
  const totalMillVal = data.departments.reduce((acc, d) => acc + parseFloat(d.totalValuation || 0), 0)

  return (
    <div style={S.page}>
      {/* Header */}
      <div style={S.hdr}>
        <div>
          <div style={S.title}>Store Management — Department Consumption Reports</div>
          <div style={S.sub}>Permanent Issue Tracking · Departmental Spend Analysis · High-Consumption Spares</div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            style={{ ...S.btn, background: '#25D366', color: '#fff', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700 }}
            onClick={() => onNavigate ? onNavigate('reports') : (window.location.href = '/reports')}
            title="Open Master EOD Activity Report & Send on WhatsApp"
          >
            📱 Master EOD (WhatsApp)
          </button>
          <button style={S.btnGhost} onClick={loadReport}>↻ Refresh Data</button>
          <button style={S.btn} onClick={() => window.print()}>🖨️ Print Dept Report</button>
        </div>
      </div>

      {!isOrgWide && (
        <div style={S.scopeBanner}>
          🔒 Showing data for your department only — {user?.department || 'Your Department'}
        </div>
      )}

      {/* Filter Bar */}
      <div style={S.filterBar}>
        <div style={{ display: 'flex', gap: 4 }}>
          {[
            { id: 'month', label: 'This Month' },
            { id: 'today', label: 'Today' },
            { id: 'all', label: 'All-Time Historical' },
          ].map(btn => (
            <button
              key={btn.id}
              style={{ ...S.chip, ...(filterRange === btn.id ? S.chipActive : {}) }}
              onClick={() => handleRangeChange(btn.id)}
            >{btn.label}</button>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto' }}>
          <span style={{ fontSize: 12, color: '#8a8a90', fontWeight: 600 }}>Date Range:</span>
          <input type="date" style={S.inputSm} value={fromDate} onChange={e => { setFromDate(e.target.value); setFilterRange('custom') }} />
          <span style={{ color: '#8a8a90' }}>to</span>
          <input type="date" style={S.inputSm} value={toDate} onChange={e => { setToDate(e.target.value); setFilterRange('custom') }} />
        </div>
      </div>

      {/* Granular Report Tabs */}
      <div style={S.tabBar} className="no-print">
        {[
          { id: 'dept', label: '🏢 Department Summary' },
          { id: 'section', label: '🏭 Plant Section & Machine Granularity' },
          { id: 'item', label: '📦 Item-Wise Consumption' },
          { id: 'category', label: '🏷️ Category / Subcategory' },
          { id: 'bin', label: '📍 Bin / Rack Location' },
          { id: 'vendor', label: '🚚 Vendor-Wise Inward (GRN)' },
          { id: 'movement', label: '⚡ Fast / Slow / Dead Stock' },
        ].map(t => (
          <button key={t.id} style={{ ...S.tab, ...(tab === t.id ? S.tabActive : {}) }} onClick={() => setTab(t.id)}>{t.label}</button>
        ))}
      </div>

      {tab === 'section' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Section summary pills */}
          <div style={S.tableWrap}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid #e7e6df', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <b>🏭 Plant Sections Rollup & Valuation</b>
              {selectedSecFilter && (
                <button
                  style={{ ...S.btnGhost, fontSize: 12, padding: '4px 8px' }}
                  onClick={() => setSelectedSecFilter('')}
                >
                  ✕ Clear Section Filter
                </button>
              )}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10, padding: 14 }}>
              {(sectionData.sections || []).map(sec => {
                const isSelected = String(selectedSecFilter) === String(sec.sectionId)
                return (
                  <div
                    key={sec.sectionId}
                    onClick={() => setSelectedSecFilter(isSelected ? '' : sec.sectionId)}
                    style={{
                      padding: 12,
                      borderRadius: 8,
                      border: isSelected ? '2px solid #2563eb' : '1px solid #e2e8f0',
                      background: isSelected ? '#eff6ff' : '#f8fafc',
                      cursor: 'pointer'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: 13 }}>
                      <span>{sec.sectionIcon}</span>
                      <span>{sec.sectionName}</span>
                    </div>
                    <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                      {sec.materialCount} items · Val: <b>₹{Number(sec.totalValuation || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</b>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Granular Items Table */}
          <div style={S.tableWrap}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid #e7e6df', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <b>Granular Plant Section & Machine Level Inventory Matrix</b>
              <button
                style={{ ...S.btnGhost, fontSize: 12, padding: '4px 10px', background: '#0284c7', color: '#fff' }}
                onClick={() => {
                  const p = new URLSearchParams({ format: 'csv', from: fromDate || '', to: toDate || '' })
                  if (selectedSecFilter) p.set('section_id', selectedSecFilter)
                  window.open(`/api/reports/plant-sections/detailed?${p}`, '_blank')
                }}
              >
                📥 Export CSV
              </button>
            </div>
            <table style={S.table}>
              <thead>
                <tr style={S.thead}>
                  {['Section', 'Machine / Equipment', 'Material', 'Category & Bin', 'Current Stock', 'Unit Price', 'Stock Valuation', 'Period Consumed', 'Period Inward'].map(hh => (
                    <th key={hh} style={S.th}>{hh}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {granularLoading ? (
                  <tr><td colSpan={9} style={S.loading}>Loading plant section report...</td></tr>
                ) : (sectionData.granularItems || []).length === 0 ? (
                  <tr><td colSpan={9} style={S.empty}>No plant section items found for selected filter.</td></tr>
                ) : (
                  (sectionData.granularItems || []).map(it => (
                    <tr key={it.materialId} style={S.tr}>
                      <td style={S.td}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span>{it.sectionIcon || '🏭'}</span>
                          <div>
                            <div style={{ fontWeight: 600, color: '#1b1b1d' }}>{it.sectionName || 'Unassigned'}</div>
                            <div style={S.muted}>{it.sectionCode || '—'} {it.departmentName ? `· ${it.departmentName}` : ''}</div>
                          </div>
                        </div>
                      </td>
                      <td style={S.td}>
                        <div style={{ fontWeight: 600, color: '#0369a1' }}>{it.machineName ? `⚡ ${it.machineName}` : '—'}</div>
                        {it.equipmentName && (
                          <div style={{ fontSize: 11, color: '#334155', marginTop: 2 }}>
                            <span>⚙️ {it.tagName ? `[${it.tagName}] ` : ''}{it.equipmentName}</span>
                            {(it.bearingSize || it.beltNo) && (
                              <div style={{ fontSize: 10, color: '#0f766e', fontWeight: 600 }}>
                                {[it.bearingSize ? `Brg: ${it.bearingSize}` : null, it.beltNo ? `Belt: ${it.beltNo}` : null].filter(Boolean).join(' | ')}
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                      <td style={S.td}>
                        <div style={{ fontWeight: 600 }}>{it.materialName}</div>
                        <div style={S.muted}>{it.materialCode}</div>
                      </td>
                      <td style={S.td}>
                        <div>{it.categoryName || 'General'}</div>
                        <div style={S.muted}>📍 {it.binLocation || '—'}</div>
                      </td>
                      <td style={S.td}>
                        <span style={{ fontWeight: 700, color: Number(it.currentStock) <= Number(it.minStock) ? '#dc2626' : '#1b1b1d' }}>
                          {Number(it.currentStock || 0).toFixed(2)} {it.uom}
                        </span>
                      </td>
                      <td style={S.td}>₹{Number(it.unitPrice || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                      <td style={{ ...S.td, fontWeight: 700, color: '#16a34a' }}>
                        ₹{Number(it.stockValuation || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td style={S.td}>
                        <div style={{ fontWeight: 600, color: '#ea580c' }}>{Number(it.consumedQty || 0).toFixed(2)} {it.uom}</div>
                        <div style={S.muted}>₹{Number(it.consumedValue || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</div>
                      </td>
                      <td style={S.td}>
                        <div style={{ fontWeight: 600, color: '#0f766e' }}>{Number(it.inwardQty || 0).toFixed(2)} {it.uom}</div>
                        <div style={S.muted}>₹{Number(it.inwardValue || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'item' && (
        <div style={S.tableWrap}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid #e7e6df', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <b>Item-Wise Consumption Report</b>
            {isOrgWide && <span style={S.muted}>Click a row to see its top-issuing departments</span>}
          </div>
          <table style={S.table}>
            <thead>
              <tr style={S.thead}>
                {['Material', 'Category', 'Bin', 'Current Stock', 'Reorder Pt', 'Issued Qty', 'Issued Value', 'Received Qty', 'Turnover'].map(hh => (
                  <th key={hh} style={S.th}>{hh}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {granularLoading ? (
                <tr><td colSpan={9} style={S.loading}>Loading item report...</td></tr>
              ) : itemData.items.length === 0 ? (
                <tr><td colSpan={9} style={S.empty}>No item consumption data found.</td></tr>
              ) : itemData.items.map(it => (
                <React.Fragment key={it.id}>
                  <tr style={{ ...S.tr, cursor: 'pointer', background: String(selectedItemId) === String(it.id) ? '#fefce8' : 'transparent' }}
                    onClick={() => setSelectedItemId(String(selectedItemId) === String(it.id) ? '' : String(it.id))}>
                    <td style={S.td}><div style={{ fontWeight: 600 }}>{it.name}</div><div style={S.muted}>{it.code}</div></td>
                    <td style={S.td}><span style={S.muted}>{it.categoryName || 'General'}</span></td>
                    <td style={S.td}><span style={S.code}>{it.bin_location || '—'}</span></td>
                    <td style={S.td}>{Number(it.current_stock).toFixed(2)} {it.uom}</td>
                    <td style={S.td}>{Number(it.reorder_level || 0).toFixed(2)}</td>
                    <td style={S.td}>{Number(it.totalIssuedQty).toFixed(2)}</td>
                    <td style={S.td}><b>₹{Number(it.totalIssuedValue).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</b></td>
                    <td style={S.td}>{Number(it.totalReceivedQty).toFixed(2)}</td>
                    <td style={S.td}>{it.turnoverRate}</td>
                  </tr>
                  {String(selectedItemId) === String(it.id) && isOrgWide && (
                    <tr>
                      <td colSpan={9} style={{ ...S.td, background: '#f6f5f0' }}>
                        <div style={{ fontWeight: 600, marginBottom: 6, fontSize: 12 }}>Top Issuing Departments — {it.name}</div>
                        {itemData.topDepartments.length === 0 ? (
                          <div style={S.muted}>No department issue history for this item in range.</div>
                        ) : (
                          <table style={S.table}>
                            <thead><tr style={S.thead}>{['Department', 'Issues', 'Qty', 'Value'].map(hh => <th key={hh} style={S.th}>{hh}</th>)}</tr></thead>
                            <tbody>
                              {itemData.topDepartments.map(d => (
                                <tr key={d.departmentId} style={S.tr}>
                                  <td style={S.td}>{d.departmentName || 'Unassigned'}</td>
                                  <td style={S.td}>{d.issueCount}</td>
                                  <td style={S.td}>{Number(d.totalQty).toFixed(2)}</td>
                                  <td style={S.td}>₹{Number(d.totalValue).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'category' && (
        <div style={S.tableWrap}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid #e7e6df', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <b>Category / Subcategory-Wise Report</b>
            <span style={S.muted}>Click a category to drill into its items</span>
          </div>
          <table style={S.table}>
            <thead>
              <tr style={S.thead}>
                {['Category', 'Parent', 'Items', 'Stock Value', 'Issue Volume', 'Issue Value', 'GRN Inflow Volume', 'GRN Inflow Value'].map(hh => (
                  <th key={hh} style={S.th}>{hh}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {granularLoading ? (
                <tr><td colSpan={8} style={S.loading}>Loading category report...</td></tr>
              ) : categoryData.length === 0 ? (
                <tr><td colSpan={8} style={S.empty}>No category data found.</td></tr>
              ) : categoryData.map(c => (
                <React.Fragment key={c.categoryId}>
                  <tr style={{ ...S.tr, cursor: 'pointer', background: expandedCategory === c.categoryId ? '#fefce8' : 'transparent' }}
                    onClick={() => setExpandedCategory(expandedCategory === c.categoryId ? null : c.categoryId)}>
                    <td style={S.td}><b>{c.categoryName}</b> {c.categoryCode ? <span style={S.code}>{c.categoryCode}</span> : null}</td>
                    <td style={S.td}><span style={S.muted}>{c.parentName || '— (Top Level)'}</span></td>
                    <td style={S.td}>{c.itemCount}</td>
                    <td style={S.td}><b>₹{Number(c.stockValue).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</b></td>
                    <td style={S.td}>{Number(c.issueVolume).toFixed(2)}</td>
                    <td style={S.td}>₹{Number(c.issueValue).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td style={S.td}>{Number(c.grnInflowVolume).toFixed(2)}</td>
                    <td style={S.td}>₹{Number(c.grnInflowValue).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                  </tr>
                  {expandedCategory === c.categoryId && (
                    <tr>
                      <td colSpan={8} style={{ ...S.td, background: '#f6f5f0' }}>
                        <button style={S.btnGhost} onClick={(e) => { e.stopPropagation(); setTab('item'); }}>
                          View item-level rows for this category in the Item-Wise tab →
                        </button>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'bin' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: 18 }}>
          <div style={S.tableWrap}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid #e7e6df', fontWeight: 600 }}>📍 Bin / Rack Summary (for physical stock-take)</div>
            <table style={S.table}>
              <thead><tr style={S.thead}>{['Bin / Rack', 'Items', 'Total Stock', 'Total Value'].map(hh => <th key={hh} style={S.th}>{hh}</th>)}</tr></thead>
              <tbody>
                {granularLoading ? (
                  <tr><td colSpan={4} style={S.loading}>Loading bin report...</td></tr>
                ) : binData.byBin.length === 0 ? (
                  <tr><td colSpan={4} style={S.empty}>No bin location data found.</td></tr>
                ) : binData.byBin.map((b, i) => (
                  <tr key={i} style={{ ...S.tr, cursor: 'pointer', background: expandedBin === b.binLocation ? '#fefce8' : 'transparent' }}
                    onClick={() => setExpandedBin(expandedBin === b.binLocation ? null : b.binLocation)}>
                    <td style={S.td}><span style={S.code}>{b.binLocation}</span></td>
                    <td style={S.td}>{b.itemCount}</td>
                    <td style={S.td}>{Number(b.totalStock).toFixed(2)}</td>
                    <td style={S.td}><b>₹{Number(b.totalValue).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</b></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={S.tableWrap}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid #e7e6df', fontWeight: 600 }}>
              {expandedBin ? `Items in bin "${expandedBin}"` : 'Select a bin to view its items'}
            </div>
            <table style={S.table}>
              <thead><tr style={S.thead}>{['Material', 'Category', 'Stock', 'Value'].map(hh => <th key={hh} style={S.th}>{hh}</th>)}</tr></thead>
              <tbody>
                {(expandedBin ? binData.items.filter(it => (it.bin_location || 'UNASSIGNED') === expandedBin) : binData.items.slice(0, 20)).map(it => (
                  <tr key={it.id} style={S.tr}>
                    <td style={S.td}><div style={{ fontWeight: 600 }}>{it.name}</div><div style={S.muted}>{it.code}</div></td>
                    <td style={S.td}><span style={S.muted}>{it.categoryName || 'General'}</span></td>
                    <td style={S.td}>{Number(it.current_stock).toFixed(2)} {it.uom}</td>
                    <td style={S.td}>₹{Number(it.stockValue).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'vendor' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: 18 }}>
          <div style={S.tableWrap}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid #e7e6df', fontWeight: 600 }}>🚚 Vendor-Wise Inward Summary</div>
            <table style={S.table}>
              <thead><tr style={S.thead}>{['Vendor', 'GRNs', 'Accepted Qty', 'Rejected Qty', 'Inward Value', 'PO Count', 'On-Time'].map(hh => <th key={hh} style={S.th}>{hh}</th>)}</tr></thead>
              <tbody>
                {granularLoading ? (
                  <tr><td colSpan={7} style={S.loading}>Loading vendor report...</td></tr>
                ) : vendorData.vendors.length === 0 ? (
                  <tr><td colSpan={7} style={S.empty}>No GRN inward history found for any vendor in this period.</td></tr>
                ) : vendorData.vendors.map(v => (
                  <tr key={v.vendorId} style={{ ...S.tr, cursor: 'pointer', background: expandedVendor === String(v.vendorId) ? '#fefce8' : 'transparent' }}
                    onClick={() => setExpandedVendor(expandedVendor === String(v.vendorId) ? null : String(v.vendorId))}>
                    <td style={S.td}><b>{v.vendorName}</b> <span style={S.code}>{v.vendorCode}</span></td>
                    <td style={S.td}>{v.grnCount}</td>
                    <td style={S.td}>{Number(v.totalAcceptedQty).toFixed(2)}</td>
                    <td style={S.td}>{Number(v.totalRejectedQty).toFixed(2)}</td>
                    <td style={S.td}><b>₹{Number(v.totalInwardValue).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</b></td>
                    <td style={S.td}>{v.poCount}</td>
                    <td style={S.td}>{v.poCount > 0 ? `${Math.round((v.onTimeDeliveries / v.poCount) * 100)}%` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={S.tableWrap}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid #e7e6df', fontWeight: 600 }}>
              {expandedVendor ? 'Price Trend Per Material' : 'Select a vendor to view its price trend'}
            </div>
            <table style={S.table}>
              <thead><tr style={S.thead}>{['Material', 'GRN Date', 'GRN No.', 'Unit Price', 'Qty'].map(hh => <th key={hh} style={S.th}>{hh}</th>)}</tr></thead>
              <tbody>
                {vendorData.priceTrend.length === 0 ? (
                  <tr><td colSpan={5} style={S.empty}>{expandedVendor ? 'No GRN line items found.' : 'No vendor selected.'}</td></tr>
                ) : vendorData.priceTrend.map((pt, i) => (
                  <tr key={i} style={S.tr}>
                    <td style={S.td}>{pt.materialName}</td>
                    <td style={S.td}>{pt.date}</td>
                    <td style={S.td}><span style={S.code}>{pt.grn_number}</span></td>
                    <td style={S.td}>₹{Number(pt.unit_price).toFixed(2)}</td>
                    <td style={S.td}>{Number(pt.accepted_qty).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'movement' && (
        <div style={S.tableWrap}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid #e7e6df', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <b>Fast / Slow / Dead-Moving Items</b>
            <span style={S.muted}>
              🟢 Fast: {movementData.summary.fast} · 🟡 Slow: {movementData.summary.slow} · 🔴 Dead: {movementData.summary.dead}
              {' · '}Blocked Value: ₹{Number(movementData.summary.deadStockValue || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </span>
          </div>
          <table style={S.table}>
            <thead>
              <tr style={S.thead}>
                {['Material', 'Category', 'Bin', 'Stock', 'Stock Value', 'Movements', 'Moved Qty', 'Last Issue', 'Class'].map(hh => (
                  <th key={hh} style={S.th}>{hh}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {granularLoading ? (
                <tr><td colSpan={9} style={S.loading}>Loading movement analysis...</td></tr>
              ) : movementData.items.length === 0 ? (
                <tr><td colSpan={9} style={S.empty}>No movement data found.</td></tr>
              ) : movementData.items.map(it => (
                <tr key={it.id} style={S.tr}>
                  <td style={S.td}><div style={{ fontWeight: 600 }}>{it.name}</div><div style={S.muted}>{it.code}</div></td>
                  <td style={S.td}><span style={S.muted}>{it.categoryName || 'General'}</span></td>
                  <td style={S.td}><span style={S.code}>{it.bin_location || '—'}</span></td>
                  <td style={S.td}>{Number(it.current_stock).toFixed(2)} {it.uom}</td>
                  <td style={S.td}>₹{Number(it.stockValue).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                  <td style={S.td}>{it.movementCount}</td>
                  <td style={S.td}>{Number(it.movementQty).toFixed(2)}</td>
                  <td style={S.td}>{it.lastIssueDate || 'Never'}</td>
                  <td style={S.td}>
                    <span style={{
                      ...S.badge,
                      background: it.movementClass === 'FAST' ? '#dcfce7' : it.movementClass === 'SLOW' ? '#fef9c3' : '#fee2e2',
                      color: it.movementClass === 'FAST' ? '#166534' : it.movementClass === 'SLOW' ? '#854d0e' : '#991b1b'
                    }}>{it.movementClass}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'dept' && (<>
      {/* KPI Cards */}
      <div style={S.kpiGrid}>
        <div style={S.kpiCard}>
          <div style={S.kpiLbl}>Total Department Issues</div>
          <div style={S.kpiVal}>{totalMillIssues} Store Issues</div>
          <div style={S.kpiSub}>Across {data.departments.filter(d => parseInt(d.totalIssues) > 0).length} Active Plant Sections</div>
        </div>
        <div style={S.kpiCard}>
          <div style={S.kpiLbl}>Total Quantity Issued</div>
          <div style={{ ...S.kpiVal, color: '#d97706' }}>{totalMillQty.toLocaleString('en-IN', { maximumFractionDigits: 2 })} Units</div>
          <div style={S.kpiSub}>Mechanical, Electrical & Consumables</div>
        </div>
        <div style={S.kpiCard}>
          <div style={S.kpiLbl}>Total Department Consumption Value</div>
          <div style={{ ...S.kpiVal, color: '#dc2626' }}>₹{totalMillVal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</div>
          <div style={S.kpiSub}>Strictly computed from actual issue ledgers</div>
        </div>
      </div>

      {/* Main Department Consumption Table */}
      <div style={{ ...S.tableWrap, marginBottom: 20 }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid #e7e6df', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <b>Department-Wise Store Requisition & Spend Summary</b>
          <span style={S.muted}>Click department to highlight</span>
        </div>
        <table style={S.table}>
          <thead>
            <tr style={S.thead}>
              {['Department Name', 'Code', 'Total Issues', 'Total Qty Issued', 'Distinct Materials', 'Total Spend (₹)', '% of Mill Consumption'].map(h => (
                <th key={h} style={S.th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} style={S.loading}>Loading department metrics...</td></tr>
            ) : data.departments.length === 0 ? (
              <tr><td colSpan={7} style={S.empty}>No department issue records found for this period.</td></tr>
            ) : data.departments.map(d => {
              const pct = totalMillVal > 0 ? ((parseFloat(d.totalValuation || 0) / totalMillVal) * 100).toFixed(1) : '0.0'
              const isSel = selectedDept === d.departmentName
              return (
                <tr
                  key={d.departmentId}
                  style={{ ...S.tr, background: isSel ? '#fefce8' : 'transparent', cursor: 'pointer' }}
                  onClick={() => setSelectedDept(isSel ? '' : d.departmentName)}
                >
                  <td style={S.td}><span style={{ fontWeight: 600, color: '#1b1b1d' }}>{d.departmentName}</span></td>
                  <td style={S.td}><span style={S.code}>{d.departmentCode || '—'}</span></td>
                  <td style={S.td}><b>{d.totalIssues}</b></td>
                  <td style={S.td}>{Number(d.totalQuantity).toFixed(2)}</td>
                  <td style={S.td}>{d.distinctMaterials} Items</td>
                  <td style={S.td}><span style={{ color: parseFloat(d.totalValuation) > 0 ? '#1b1b1d' : '#8a8a90', fontWeight: 700 }}>₹{Number(d.totalValuation).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></td>
                  <td style={S.td}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ flex: 1, background: '#e7e6df', height: 6, borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ width: `${Math.min(parseFloat(pct), 100)}%`, background: '#d97706', height: '100%' }} />
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 600, width: 45 }}>{pct}%</span>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Grid: Category Breakdown + Top Consumed Materials */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: 18 }}>
        {/* Top Consumed Materials */}
        <div style={S.tableWrap}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid #e7e6df', fontWeight: 600 }}>
            🔥 Top 15 Most Consumed Store Spares & Materials
          </div>
          <table style={S.table}>
            <thead>
              <tr style={S.thead}>
                {['Material', 'Category', 'Frequency', 'Total Qty', 'Total Cost'].map(h => (
                  <th key={h} style={S.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.topConsumed.length === 0 ? (
                <tr><td colSpan={5} style={S.empty}>No material consumption data available.</td></tr>
              ) : data.topConsumed.map(tc => (
                <tr key={tc.id} style={S.tr}>
                  <td style={S.td}>
                    <div style={{ fontWeight: 600 }}>{tc.name}</div>
                    <div style={S.muted}>{tc.code}</div>
                  </td>
                  <td style={S.td}><span style={S.muted}>{tc.categoryName || 'General'}</span></td>
                  <td style={S.td}>{tc.frequency} Issues</td>
                  <td style={S.td}><span style={{ color: '#dc2626', fontWeight: 600 }}>{Number(tc.totalIssuedQty).toFixed(2)} {tc.uom}</span></td>
                  <td style={S.td}><b>₹{Number(tc.totalCost).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</b></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Category Breakdown */}
        <div style={S.tableWrap}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid #e7e6df', fontWeight: 600 }}>
            🏷️ Store Category Consumption Breakdown
          </div>
          <table style={S.table}>
            <thead>
              <tr style={S.thead}>
                {['Department', 'Store Type', 'Issues', 'Issued Qty', 'Valuation'].map(h => (
                  <th key={h} style={S.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.categoryBreakdown.length === 0 ? (
                <tr><td colSpan={5} style={S.empty}>No category records available.</td></tr>
              ) : data.categoryBreakdown.map((cb, idx) => (
                <tr key={idx} style={S.tr}>
                  <td style={S.td}><b>{cb.departmentName}</b></td>
                  <td style={S.td}><span style={S.code}>{cb.categoryType}</span></td>
                  <td style={S.td}>{cb.issuesCount}</td>
                  <td style={S.td}>{Number(cb.categoryQty).toFixed(2)}</td>
                  <td style={S.td}>₹{Number(cb.categoryValuation).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      </>)}

      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: #fff !important; }
        }
      `}</style>
    </div>
  )
}

const S = {
  page: { padding: 24, background: '#f6f5f0', minHeight: '100vh', color: '#1b1b1d' },
  hdr: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  title: { fontSize: 22, fontWeight: 700, color: '#1b1b1d' },
  sub: { fontSize: 13, color: '#8a8a90', marginTop: 4 },
  kpiGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14, marginBottom: 18 },
  kpiCard: { background: '#ffffff', borderRadius: 10, padding: '16px 20px', border: '1px solid #e7e6df' },
  kpiLbl: { fontSize: 12, fontWeight: 600, color: '#8a8a90', textTransform: 'uppercase' },
  kpiVal: { fontSize: 22, fontWeight: 700, color: '#1b1b1d', marginTop: 4 },
  kpiSub: { fontSize: 12, color: '#a0a0a6', marginTop: 4 },
  scopeBanner: { background: '#fef3c7', color: '#854d0e', border: '1px solid #fde68a', borderRadius: 8, padding: '8px 14px', fontSize: 12, fontWeight: 600, marginBottom: 14 },
  filterBar: { display: 'flex', gap: 10, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' },
  tabBar: { display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 },
  tab: { background: '#ffffff', color: '#1b1b1d', border: '1px solid #e7e6df', borderRadius: 8, padding: '8px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' },
  tabActive: { background: '#1b1b1d', color: '#ffffff', borderColor: '#1b1b1d' },
  badge: { display: 'inline-block', padding: '2px 10px', borderRadius: 12, fontSize: 11, fontWeight: 700 },
  chip: { background: '#e7e6df', color: '#1b1b1d', border: 'none', borderRadius: 20, padding: '6px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' },
  chipActive: { background: '#1b1b1d', color: '#ffffff' },
  inputSm: { background: '#ffffff', border: '1px solid #e7e6df', borderRadius: 6, color: '#1b1b1d', padding: '6px 10px', fontSize: 12, outline: 'none' },
  tableWrap: { background: '#ffffff', borderRadius: 10, overflow: 'auto', border: '1px solid #e7e6df' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  thead: { background: '#f6f5f0' },
  th: { padding: '10px 14px', textAlign: 'left', color: '#8a8a90', fontWeight: 600, fontSize: 12, textTransform: 'uppercase', borderBottom: '1px solid #e7e6df', whiteSpace: 'nowrap' },
  tr: { borderBottom: '1px solid #f1efe8', transition: 'background 0.15s' },
  td: { padding: '10px 14px', verticalAlign: 'middle' },
  muted: { color: '#a0a0a6', fontSize: 12 },
  code: { fontFamily: 'monospace', background: '#f6f5f0', padding: '2px 6px', borderRadius: 4, fontSize: 11, color: '#1b1b1d' },
  empty: { padding: 30, textAlign: 'center', color: '#8a8a90' },
  loading: { padding: 30, textAlign: 'center', color: '#8a8a90' },
  btn: { background: '#1b1b1d', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 18px', fontWeight: 600, fontSize: 13, cursor: 'pointer' },
  btnGhost: { background: '#e7e6df', color: '#1b1b1d', border: 'none', borderRadius: 8, padding: '8px 18px', fontWeight: 600, fontSize: 13, cursor: 'pointer' }
}
