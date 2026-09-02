import React, { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import ProductDetailModal from '../components/ProductDetailModal'
import {
  Package, FlaskConical, AlertTriangle, ArrowDownRight, ArrowUpRight,
  Plus, RefreshCw, Search, CheckCircle2, Filter, Layers, Clock,
  ShieldCheck, Printer, Check, Copy, ExternalLink, FileText
} from 'lucide-react'

const API = '/api'
const h = () => ({ Authorization: `Bearer ${localStorage.getItem('mk_token')}` })
const json = () => ({ ...h(), 'Content-Type': 'application/json' })

function WhatsAppIcon({ size = 16, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color} style={{ flexShrink: 0 }}>
      <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.816 9.816 0 0012.04 2zm.01 1.67c4.54 0 8.24 3.7 8.24 8.24 0 2.2-.86 4.27-2.42 5.82a8.17 8.17 0 01-5.82 2.42c-1.48 0-2.93-.4-4.2-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.19 8.19 0 01-1.25-4.38c0-4.54 3.7-8.24 8.24-8.24zm4.5 11.66c-.25-.13-1.47-.72-1.7-.81-.23-.08-.39-.13-.56.13-.17.25-.64.81-.79.98-.14.17-.29.19-.54.06-.25-.13-1.06-.39-2.02-1.24-.75-.67-1.26-1.49-1.41-1.74-.14-.25-.02-.39.11-.51.11-.11.25-.29.37-.44.13-.14.17-.25.25-.42.08-.17.04-.31-.02-.44-.06-.13-.56-1.35-.77-1.85-.2-.49-.41-.42-.56-.43h-.48c-.17 0-.44.06-.67.31-.23.25-.88.86-.88 2.1s.9 2.43 1.03 2.6c.13.17 1.77 2.7 4.28 3.79.6.26 1.07.41 1.43.53.6.19 1.15.16 1.58.1.48-.07 1.47-.6 1.68-1.18.21-.58.21-1.08.15-1.18-.06-.11-.23-.17-.48-.29z"/>
    </svg>
  )
}

export default function RawMaterial({ onNavigate }) {
  const { user } = useAuth()
  const { addToast } = useToast()

  const [tab, setTab] = useState('stock') // 'stock' | 'inward' | 'issues'
  const [scopeFilter, setScopeFilter] = useState('') // '' (all) | 'chemical' | 'waste' | 'pulp'
  const [lowStockOnly, setLowStockOnly] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(false)
  const [selectedProductModalId, setSelectedProductModalId] = useState(null)

  const [materials, setMaterials] = useState([])
  const [summary, setSummary] = useState({ totalItems: 0, totalQty: 0, totalValuation: 0, lowStockCount: 0 })
  const [inwardList, setInwardList] = useState([])
  const [issuesList, setIssuesList] = useState([])
  const [depts, setDepts] = useState([])
  const [vendors, setVendors] = useState([])
  const [sections, setSections] = useState([])
  const [machines, setMachines] = useState([])

  // Modal states
  const [inwardModal, setInwardModal] = useState(false)
  const [inwardForm, setInwardForm] = useState({
    material_id: '',
    in_qty: '',
    unit_price: '',
    inward_type: 'grn',
    department_id: '',
    vendor_id: '',
    po_number: '',
    batch_number: '',
    bin_location: 'RM-YARD',
    remarks: ''
  })

  const [issueModal, setIssueModal] = useState(false)
  const [issueForm, setIssueForm] = useState({
    material_id: '',
    department_id: '',
    section_id: '',
    machine_id: '',
    out_qty: '',
    purpose: '',
    remarks: ''
  })

  const loadBaseData = useCallback(async () => {
    setLoading(true)
    try {
      // 1. Raw materials & chemicals query
      const params = new URLSearchParams()
      if (scopeFilter) params.set('category', scopeFilter)
      if (lowStockOnly) params.set('low_stock', 'true')
      if (searchTerm) params.set('search', searchTerm)

      const matRes = await fetch(`${API}/store/rawmaterials?${params}`, { headers: h() }).then(r => r.json())
      if (matRes && matRes.success) {
        const list = matRes.data || []
        setMaterials(list)
        const computedSummary = matRes.summary || {
          totalItems: list.length,
          totalQty: list.reduce((acc, r) => acc + parseFloat(r.current_stock || 0), 0),
          totalValuation: list.reduce((acc, r) => acc + (parseFloat(r.current_stock || 0) * parseFloat(r.unit_price || 0)), 0),
          lowStockCount: list.filter(r => r.lowStock || r.lowstock).length
        }
        setSummary(computedSummary)
      }

      // 2. Inward GRN receipts for chemical/raw store
      const inRes = await fetch(`${API}/store/inward?store_type=raw&limit=100`, { headers: h() }).then(r => r.json())
      if (inRes && inRes.success) setInwardList(inRes.data || [])

      // 3. Outward issues for chemical/raw store
      const outRes = await fetch(`${API}/store/outward?store_type=raw&limit=100`, { headers: h() }).then(r => r.json())
      if (outRes && outRes.success) setIssuesList(outRes.data || [])

      // 4. Auxiliary dropdowns
      const deptRes = await fetch(`${API}/users/departments`, { headers: h() }).then(r => r.json()).catch(() => ({ data: [] }))
      if (deptRes && deptRes.success) setDepts(deptRes.data || [])

      const venRes = await fetch(`${API}/master/vendors?limit=100&is_active=true`, { headers: h() }).then(r => r.json()).catch(() => ({ data: [] }))
      if (venRes && venRes.success) setVendors(venRes.data || [])

      const secRes = await fetch(`${API}/master/sections`, { headers: h() }).then(r => r.json()).catch(() => ({ data: [] }))
      if (secRes && secRes.success) setSections(secRes.data || [])

      const mcnRes = await fetch(`${API}/master/machines`, { headers: h() }).then(r => r.json()).catch(() => ({ data: [] }))
      if (mcnRes && mcnRes.success) setMachines(mcnRes.data || [])
    } catch (e) {
      console.error(e)
      addToast('Error loading raw material records', 'error')
    } finally {
      setLoading(false)
    }
  }, [scopeFilter, lowStockOnly, searchTerm, addToast])

  useEffect(() => {
    loadBaseData()
    const handleRefresh = () => {
      loadBaseData()
    }
    window.addEventListener('mk-inventory-refresh', handleRefresh)
    return () => window.removeEventListener('mk-inventory-refresh', handleRefresh)
  }, [loadBaseData])

  // Handle Fast Inward Entry
  const handleInwardSubmit = async (e) => {
    e.preventDefault()
    if (!inwardForm.material_id || !inwardForm.in_qty) {
      addToast('Please select a material and enter quantity', 'error')
      return
    }

    try {
      const selectedMat = materials.find(m => String(m.id) === String(inwardForm.material_id))
      const vendorObj = vendors.find(v => String(v.id) === String(inwardForm.vendor_id))
      const vendorName = vendorObj ? vendorObj.name : ''
      const deptObj = depts.find(d => String(d.id) === String(inwardForm.department_id))
      const deptName = deptObj ? deptObj.name : ''
      const isReturn = inwardForm.inward_type === 'return'

      const remarksFormatted = [
        isReturn ? (deptName ? `From Dept: ${deptName}` : 'Department Return') : (vendorName ? `Vendor: ${vendorName}` : ''),
        inwardForm.po_number ? `Ref: ${inwardForm.po_number}` : '',
        inwardForm.remarks || ''
      ].filter(Boolean).join(' | ')

      const payload = {
        material_id: parseInt(inwardForm.material_id),
        in_qty: parseFloat(inwardForm.in_qty),
        unit_price: parseFloat(inwardForm.unit_price || selectedMat?.unit_price || 0),
        inward_type: inwardForm.inward_type || 'grn',
        department_id: inwardForm.department_id ? parseInt(inwardForm.department_id) : null,
        reference_type: isReturn ? 'DEPT_RETURN' : (inwardForm.po_number ? 'PO' : 'CHALLAN'),
        reference_id: /^\d+$/.test(inwardForm.po_number) ? parseInt(inwardForm.po_number) : null,
        vendor_id: inwardForm.vendor_id ? parseInt(inwardForm.vendor_id) : null,
        vendor_name: vendorName || undefined,
        batch_number: inwardForm.batch_number || null,
        bin_location: inwardForm.bin_location || 'RM-YARD',
        remarks: remarksFormatted
      }

      const res = await fetch(`${API}/store/inward`, {
        method: 'POST',
        headers: json(),
        body: JSON.stringify(payload)
      }).then(r => r.json())

      if (res.success) {
        addToast(`${isReturn ? 'Department return added back to inventory' : 'Inward GRN logged'} for ${selectedMat?.name || 'material'}`, 'success')
        setInwardModal(false)
        setInwardForm({
          material_id: '',
          in_qty: '',
          unit_price: '',
          inward_type: 'grn',
          department_id: '',
          vendor_id: '',
          po_number: '',
          batch_number: '',
          bin_location: 'RM-YARD',
          remarks: ''
        })
        loadBaseData()
      } else {
        addToast(res.message || 'Failed to log inward entry', 'error')
      }
    } catch (e) {
      addToast('Network error logging inward entry', 'error')
    }
  }

  // Handle Fast Issue / Outward Entry
  const handleIssueSubmit = async (e) => {
    e.preventDefault()
    if (!issueForm.material_id || !issueForm.out_qty) {
      addToast('Please select a material and enter quantity', 'error')
      return
    }

    try {
      const selectedMat = materials.find(m => String(m.id) === String(issueForm.material_id))
      const selectedDept = depts.find(d => String(d.id) === String(issueForm.department_id))
      const selectedSec = sections.find(s => String(s.id) === String(issueForm.section_id))
      const selectedMcn = machines.find(m => String(m.id) === String(issueForm.machine_id))
      const deptName = selectedDept ? selectedDept.name : 'Pulp Mill / Production'
      const secTag = selectedSec ? `${selectedSec.icon || '🏭'} ${selectedSec.name}` : ''
      const mcnTag = selectedMcn ? `Machine: ${selectedMcn.name || selectedMcn.code}` : ''

      const formattedRemarks = [
        deptName,
        secTag,
        mcnTag,
        issueForm.remarks || ''
      ].filter(Boolean).join(' | ')

      const payload = {
        material_id: parseInt(issueForm.material_id),
        department_id: issueForm.department_id ? parseInt(issueForm.department_id) : null,
        section_id: issueForm.section_id ? parseInt(issueForm.section_id) : null,
        machine_id: issueForm.machine_id ? parseInt(issueForm.machine_id) : null,
        out_qty: parseFloat(issueForm.out_qty),
        unit_price: parseFloat(selectedMat?.unit_price || 0),
        outward_type: 'issue',
        purpose: issueForm.purpose || 'Furnish Batch Consumption',
        remarks: formattedRemarks
      }

      const res = await fetch(`${API}/store/outward`, {
        method: 'POST',
        headers: json(),
        body: JSON.stringify(payload)
      }).then(r => r.json())

      if (res.success) {
        addToast(`Material issue logged successfully (${issueForm.out_qty} ${selectedMat?.unit || 'Kgs'})`, 'success')
        setIssueModal(false)
        setIssueForm({
          material_id: '',
          department_id: '',
          section_id: '',
          machine_id: '',
          out_qty: '',
          purpose: '',
          remarks: ''
        })
        loadBaseData()
      } else {
        addToast(res.message || 'Failed to process material issue', 'error')
      }
    } catch (e) {
      addToast('Network error processing material issue', 'error')
    }
  }

  const selectedInwardMat = materials.find(m => String(m.id) === String(inwardForm.material_id))
  const selectedIssueMat = materials.find(m => String(m.id) === String(issueForm.material_id))

  const fmtCur = v => `₹${Number(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
  const fmtN = (v, dec = 2) => Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: dec, maximumFractionDigits: dec })

  return (
    <div style={S.page}>
      {/* ── Top Header ── */}
      <div style={S.hdr}>
        <div>
          <div style={S.title}>Raw Material & Chemical Store</div>
          <div style={S.sub}>
            Waste Paper Furnish · Imported Pulp · Sizing Chemicals · Starch · Retention Additives · Live Stock Ledgers
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            style={{ ...S.btn, background: '#0f172a', color: '#fff', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700 }}
            onClick={() => onNavigate ? onNavigate('store-dashboard') : (window.location.href = '/store-dashboard')}
            title="Open Exclusive Store Management Realtime Dashboard"
          >
            📊 Executive Dashboard
          </button>
          <button
            style={{ ...S.btn, background: '#25D366', color: '#fff', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700 }}
            onClick={() => onNavigate ? onNavigate('reports') : (window.location.href = '/reports')}
            title="Open Master WhatsApp EOD Customization & Dispatch"
          >
            <WhatsAppIcon size={16} color="#fff" /> WhatsApp EOD Report
          </button>
          <button
            style={{ ...S.btn, background: 'linear-gradient(135deg, #0f766e, #0e7490)', color: '#fff', fontWeight: 700 }}
            onClick={() => setSelectedProductModalId('new')}
            title="Create New Raw Material / Chemical Catalog Item"
          >
            <Plus size={15} /> + Add Material
          </button>
          <button
            style={{ ...S.btn, background: '#0f766e', color: '#fff' }}
            onClick={() => setInwardModal(true)}
          >
            <ArrowDownRight size={15} /> + New Inward (GRN)
          </button>
          <button
            style={{ ...S.btn, background: '#d97706', color: '#fff' }}
            onClick={() => setIssueModal(true)}
          >
            <ArrowUpRight size={15} /> + Issue Material
          </button>
          <button style={S.btnGhost} onClick={loadBaseData} title="Refresh Live Data">
            <RefreshCw size={15} /> ↻ Refresh
          </button>
        </div>
      </div>

      {/* ── KPI Metric Cards ── */}
      <div style={S.kpiGrid}>
        <div style={S.kpiCard}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={S.kpiTitle}>Total Stock Valuation</div>
            <div style={{ ...S.iconBox, background: '#ecfdf5', color: '#16a34a' }}><ShieldCheck size={18} /></div>
          </div>
          <div style={{ ...S.kpiVal, color: '#15803d' }}>{fmtCur(summary.totalValuation)}</div>
          <div style={S.kpiSub}>Strictly computed live from PostgreSQL stock ledger</div>
        </div>

        <div style={S.kpiCard}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={S.kpiTitle}>Total Bulk Stock</div>
            <div style={{ ...S.iconBox, background: '#eff6ff', color: '#2563eb' }}><Package size={18} /></div>
          </div>
          <div style={{ ...S.kpiVal, color: '#1e40af' }}>{fmtN(summary.totalQty, 1)} Kgs / MT</div>
          <div style={S.kpiSub}>Raw material furnish & chemical inventory</div>
        </div>

        <div style={S.kpiCard}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={S.kpiTitle}>Tracked Catalog Items</div>
            <div style={{ ...S.iconBox, background: '#fef3c7', color: '#d97706' }}><FlaskConical size={18} /></div>
          </div>
          <div style={S.kpiVal}>{summary.totalItems} Items</div>
          <div style={S.kpiSub}>Active chemical reagents, starches & additives</div>
        </div>

        <div style={S.kpiCard}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={S.kpiTitle}>Low Stock Reorder Alerts</div>
            <div style={{ ...S.iconBox, background: summary.lowStockCount > 0 ? '#fee2e2' : '#f0fdf4', color: summary.lowStockCount > 0 ? '#dc2626' : '#16a34a' }}>
              <AlertTriangle size={18} />
            </div>
          </div>
          <div style={{ ...S.kpiVal, color: summary.lowStockCount > 0 ? '#dc2626' : '#15803d' }}>
            {summary.lowStockCount} Items Below Min
          </div>
          <div style={S.kpiSub}>{summary.lowStockCount > 0 ? 'Requires immediate procurement action' : 'All raw stocks within safe threshold'}</div>
        </div>
      </div>

      {/* ── Category Scoping Chips ── */}
      <div style={S.scopeBar}>
        {[
          { id: '', label: '⚡ All Raw Materials & Chemicals' },
          { id: 'chemical', label: '🧪 Process Chemicals & Additives' },
          { id: 'waste', label: '📦 Waste Paper & OCC Furnish' },
          { id: 'pulp', label: '🌲 Wood Pulp (Virgin / BHKP)' },
        ].map(sc => (
          <button
            key={sc.id}
            style={{ ...S.chip, ...(scopeFilter === sc.id ? S.chipActive : {}) }}
            onClick={() => setScopeFilter(sc.id)}
          >
            {sc.label}
          </button>
        ))}
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: '#dc2626', marginLeft: 'auto', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={lowStockOnly}
            onChange={e => setLowStockOnly(e.target.checked)}
            style={{ accentColor: '#dc2626', cursor: 'pointer' }}
          />
          ⚠️ Below Min Reorder Only
        </label>
      </div>

      {/* ── Navigation Tabs ── */}
      <div style={S.tabs}>
        {[
          { id: 'stock', label: `📦 Live Inventory Register (${materials.length})` },
          { id: 'inward', label: `📥 Inward Receipts / GRN Log (${inwardList.length})` },
          { id: 'issues', label: `📤 Outward Consumption Log (${issuesList.length})` },
        ].map(t => (
          <button
            key={t.id}
            style={{ ...S.tab, ...(tab === t.id ? S.tabA : {}) }}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Search & Actions Filter Bar ── */}
      <div style={S.filterBar}>
        <div style={{ position: 'relative', minWidth: 320 }}>
          <Search size={15} style={{ position: 'absolute', left: 10, top: 10, color: '#9ca3af' }} />
          <input
            style={{ ...S.input, paddingLeft: 32, background: '#fff', width: '100%' }}
            placeholder={`🔍 Search in ${tab === 'stock' ? 'raw materials, chemical name, code...' : tab === 'inward' ? 'GRN receipts, vendor, PO number...' : 'issue requests, department, purpose...'}`}
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
        {searchTerm && (
          <button style={S.btnGhost} onClick={() => setSearchTerm('')}>Clear Search</button>
        )}
      </div>

      {/* ── TAB 1: LIVE INVENTORY REGISTER ── */}
      {tab === 'stock' && (
        <div style={S.card}>
          <table style={S.tbl}>
            <thead>
              <tr>
                <th style={S.th}>Code</th>
                <th style={S.th}>Material & Grade</th>
                <th style={S.th}>Category</th>
                <th style={S.th}>UOM</th>
                <th style={S.th}>Current Stock</th>
                <th style={S.th}>Min Reorder Stock</th>
                <th style={S.th}>Unit Rate</th>
                <th style={S.th}>Total Valuation (₹)</th>
                <th style={S.th}>Stock Status</th>
                <th style={S.th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {materials.length === 0 && (
                <tr>
                  <td colSpan={10} style={S.tdEmpty}>
                    {loading ? 'Compiling live raw material inventory...' : 'No raw materials match the selected filters.'}
                  </td>
                </tr>
              )}
              {materials.map(m => {
                const isLow = m.lowStock || m.lowstock
                const stockVal = parseFloat(m.current_stock || 0) * parseFloat(m.unit_price || 0)
                return (
                  <tr key={m.id} style={{ background: isLow ? '#fef2f2' : 'white' }}>
                    <td style={{ ...S.td, fontFamily: 'monospace', fontWeight: 700 }}>
                      <span
                        onClick={() => setSelectedProductModalId(m.id)}
                        style={{ color: '#0f766e', cursor: 'pointer', textDecoration: 'underline' }}
                        title="Click to open full Product Form & Specifications"
                      >
                        {m.code}
                      </span>
                    </td>
                    <td style={S.td}>
                      <div
                        onClick={() => setSelectedProductModalId(m.id)}
                        style={{ fontWeight: 700, color: '#0f172a', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                        title="Click to open full Product Form & Specifications"
                      >
                        <span>{m.name}</span>
                        <ExternalLink size={12} color="#64748b" style={{ flexShrink: 0 }} />
                      </div>
                    </td>
                    <td style={S.td}>
                      <span style={{ fontSize: 11, background: '#f1f5f9', color: '#334155', padding: '2px 8px', borderRadius: 4, fontWeight: 600 }}>
                        {m.categoryName || m.category_name || 'Chemical'}
                      </span>
                    </td>
                    <td style={S.td}>{m.unit || m.uom || 'Kgs'}</td>
                    <td style={{ ...S.td, fontWeight: 800, color: isLow ? '#dc2626' : '#15803d', fontSize: 14 }}>
                      {fmtN(m.current_stock, 2)}
                    </td>
                    <td style={{ ...S.td, color: '#64748b' }}>
                      {fmtN(m.min_stock, 2)}
                    </td>
                    <td style={S.td}>
                      {fmtCur(m.unit_price)}
                    </td>
                    <td style={{ ...S.td, fontWeight: 700, color: '#0f172a' }}>
                      {fmtCur(stockVal)}
                    </td>
                    <td style={S.td}>
                      <span style={{
                        ...S.badge,
                        background: isLow ? '#fee2e2' : '#dcfce7',
                        color: isLow ? '#dc2626' : '#15803d'
                      }}>
                        {isLow ? '⚠️ Below Min' : '✓ Safe Level'}
                      </span>
                    </td>
                    <td style={S.td}>
                      <div style={{ display: 'flex', gap: 5 }}>
                        <button
                          style={{ ...S.btnSm, background: '#1e293b', display: 'flex', alignItems: 'center', gap: 3 }}
                          onClick={() => setSelectedProductModalId(m.id)}
                          title="Open Product Form, Specifications, and Ledger"
                        >
                          <FileText size={11} /> Form
                        </button>
                        <button
                          style={{ ...S.btnSm, background: '#0f766e' }}
                          onClick={() => {
                            setInwardForm(prev => ({ ...prev, material_id: String(m.id), unit_price: String(m.unit_price || '') }))
                            setInwardModal(true)
                          }}
                          title="Log Inward GRN for this material"
                        >
                          + GRN
                        </button>
                        <button
                          style={{ ...S.btnSm, background: '#d97706' }}
                          onClick={() => {
                            setIssueForm(prev => ({ ...prev, material_id: String(m.id) }))
                            setIssueModal(true)
                          }}
                          title="Issue material to production"
                        >
                          - Issue
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── TAB 2: INWARD RECEIPTS (GRN LOG) ── */}
      {tab === 'inward' && (
        <div style={S.card}>
          <table style={S.tbl}>
            <thead>
              <tr>
                <th style={S.th}>Date</th>
                <th style={S.th}>Material Name</th>
                <th style={S.th}>Category</th>
                <th style={S.th}>Received Qty</th>
                <th style={S.th}>Unit Rate</th>
                <th style={S.th}>Valuation (₹)</th>
                <th style={S.th}>Reference / Vendor</th>
                <th style={S.th}>Batch / Bin</th>
                <th style={S.th}>Logged By</th>
              </tr>
            </thead>
            <tbody>
              {inwardList.length === 0 && (
                <tr>
                  <td colSpan={9} style={S.tdEmpty}>No inward GRN receipts recorded for raw materials.</td>
                </tr>
              )}
              {inwardList.map(inw => (
                <tr key={inw.id}>
                  <td style={{ ...S.td, whiteSpace: 'nowrap', color: '#64748b' }}>
                    {inw.date ? new Date(inw.date).toLocaleDateString() : '—'}
                  </td>
                  <td style={S.td}>
                    <div
                      onClick={() => inw.material_id && setSelectedProductModalId(inw.material_id)}
                      style={{ fontWeight: 700, color: '#0f172a', cursor: inw.material_id ? 'pointer' : 'default', display: 'flex', alignItems: 'center', gap: 4 }}
                      title="Click to open Product Form"
                    >
                      <span>{inw.materialName}</span>
                      {inw.material_id && <ExternalLink size={12} color="#64748b" />}
                    </div>
                    <div style={S.code}>{inw.materialCode}</div>
                  </td>
                  <td style={S.td}>{inw.categoryName || 'Raw Material'}</td>
                  <td style={{ ...S.td, fontWeight: 700, color: '#0f766e' }}>
                    +{fmtN(inw.in_qty, 2)} {inw.uom}
                  </td>
                  <td style={S.td}>{fmtCur(inw.unit_price)}</td>
                  <td style={{ ...S.td, fontWeight: 700, color: '#16a34a' }}>
                    {fmtCur(inw.value || (inw.in_qty * inw.unit_price))}
                  </td>
                  <td style={S.td}>
                    <div style={{ fontSize: 12, color: '#1e293b' }}>{inw.remarks || inw.reference_id || '—'}</div>
                  </td>
                  <td style={S.td}>
                    <span style={{ fontSize: 11, color: '#64748b' }}>
                      {inw.batch_number ? `Batch: ${inw.batch_number}` : ''} {inw.bin_location ? `[${inw.bin_location}]` : ''}
                    </span>
                  </td>
                  <td style={{ ...S.td, fontSize: 11, color: '#64748b' }}>
                    {inw.createdByName || 'Store Desk'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── TAB 3: OUTWARD CONSUMPTION LOG ── */}
      {tab === 'issues' && (
        <div style={S.card}>
          <table style={S.tbl}>
            <thead>
              <tr>
                <th style={S.th}>Date</th>
                <th style={S.th}>Material Name</th>
                <th style={S.th}>Recipient Department</th>
                <th style={S.th}>Issued Quantity</th>
                <th style={S.th}>Unit Rate</th>
                <th style={S.th}>Total Value (₹)</th>
                <th style={S.th}>Purpose & Remarks</th>
                <th style={S.th}>Issued By</th>
              </tr>
            </thead>
            <tbody>
              {issuesList.length === 0 && (
                <tr>
                  <td colSpan={8} style={S.tdEmpty}>No outward material issues logged for raw materials.</td>
                </tr>
              )}
              {issuesList.map(outw => (
                <tr key={outw.id}>
                  <td style={{ ...S.td, whiteSpace: 'nowrap', color: '#64748b' }}>
                    {outw.date ? new Date(outw.date).toLocaleDateString() : '—'}
                  </td>
                  <td style={S.td}>
                    <div
                      onClick={() => outw.material_id && setSelectedProductModalId(outw.material_id)}
                      style={{ fontWeight: 700, color: '#0f172a', cursor: outw.material_id ? 'pointer' : 'default', display: 'flex', alignItems: 'center', gap: 4 }}
                      title="Click to open Product Form"
                    >
                      <span>{outw.materialName}</span>
                      {outw.material_id && <ExternalLink size={12} color="#64748b" />}
                    </div>
                    <div style={S.code}>{outw.materialCode}</div>
                  </td>
                  <td style={S.td}>
                    <span style={{ background: '#f1f5f9', color: '#1e293b', padding: '2px 8px', borderRadius: 4, fontWeight: 600, fontSize: 11.5 }}>
                      {outw.departmentName || 'Pulp Mill / Production'}
                    </span>
                  </td>
                  <td style={{ ...S.td, fontWeight: 700, color: '#d97706' }}>
                    -{fmtN(outw.out_qty, 2)} {outw.uom}
                  </td>
                  <td style={S.td}>{fmtCur(outw.unit_price)}</td>
                  <td style={{ ...S.td, fontWeight: 700, color: '#b45309' }}>
                    {fmtCur(outw.value || (outw.out_qty * outw.unit_price))}
                  </td>
                  <td style={{ ...S.td, fontSize: 12, color: '#475569' }}>
                    {outw.remarks || outw.purpose || 'Production Furnish Consumption'}
                  </td>
                  <td style={{ ...S.td, fontSize: 11, color: '#64748b' }}>
                    {outw.createdByName || 'Store Desk'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── FAST INWARD MODAL (GRN / RETURN) ── */}
      {inwardModal && (
        <div style={S.overlay}>
          <div style={S.modal} onClick={e => e.stopPropagation()}>
            <div style={S.modalHdr}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ background: inwardForm.inward_type === 'return' ? '#d97706' : '#0f766e', color: '#fff', padding: 6, borderRadius: 6 }}>
                  <ArrowDownRight size={16} />
                </div>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a' }}>
                  {inwardForm.inward_type === 'return' ? 'Department Material Return' : 'New Inward Receipt (GRN)'}
                </div>
              </div>
              <button style={S.x} onClick={() => setInwardModal(false)}>✕</button>
            </div>

            <form onSubmit={handleInwardSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <label style={S.label}>
                  Inward Type *
                  <select
                    style={S.input}
                    value={inwardForm.inward_type}
                    onChange={e => setInwardForm(prev => ({ ...prev, inward_type: e.target.value }))}
                  >
                    <option value="grn">GRN (Purchase Inward)</option>
                    <option value="return">Department Return (Unused Stock)</option>
                    <option value="direct">Direct / Emergency Stock</option>
                  </select>
                </label>
                <label style={S.label}>
                  {inwardForm.inward_type === 'return' ? 'Return Slip / Ref #' : 'PO Number / Challan Ref'}
                  <input
                    style={S.input}
                    placeholder={inwardForm.inward_type === 'return' ? 'e.g. RET-PULP-01' : 'e.g. PO-20260813-0001'}
                    value={inwardForm.po_number}
                    onChange={e => setInwardForm(prev => ({ ...prev, po_number: e.target.value }))}
                  />
                </label>
              </div>

              <label style={S.label}>
                Select Raw Material / Chemical *
                <select
                  style={S.input}
                  value={inwardForm.material_id}
                  onChange={e => {
                    const sel = materials.find(m => String(m.id) === e.target.value)
                    setInwardForm(prev => ({
                      ...prev,
                      material_id: e.target.value,
                      unit_price: sel ? String(sel.unit_price || '') : prev.unit_price
                    }))
                  }}
                  required
                >
                  <option value="">-- Choose Material from Catalog --</option>
                  {materials.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.name} [{m.code}] (Stock: {m.current_stock} {m.unit})
                    </option>
                  ))}
                </select>
              </label>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <label style={S.label}>
                  {inwardForm.inward_type === 'return' ? 'Returned Quantity *' : 'Received Quantity *'}
                  <input
                    type="number"
                    step="any"
                    style={S.input}
                    placeholder="e.g. 500.0"
                    value={inwardForm.in_qty}
                    onChange={e => setInwardForm(prev => ({ ...prev, in_qty: e.target.value }))}
                    required
                  />
                </label>
                <label style={S.label}>
                  Unit Price (₹ / {selectedInwardMat?.unit || 'UOM'})
                  <input
                    type="number"
                    step="any"
                    style={S.input}
                    placeholder="Rate in ₹"
                    value={inwardForm.unit_price}
                    onChange={e => setInwardForm(prev => ({ ...prev, unit_price: e.target.value }))}
                  />
                </label>
              </div>

              {inwardForm.inward_type === 'return' ? (
                <label style={S.label}>
                  Returning Department *
                  <select
                    style={S.input}
                    value={inwardForm.department_id}
                    onChange={e => setInwardForm(prev => ({ ...prev, department_id: e.target.value }))}
                    required
                  >
                    <option value="">-- Select Returning Department --</option>
                    {depts.map(d => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </label>
              ) : (
                <label style={S.label}>
                  Vendor Supplier
                  <select
                    style={S.input}
                    value={inwardForm.vendor_id}
                    onChange={e => setInwardForm(prev => ({ ...prev, vendor_id: e.target.value }))}
                  >
                    <option value="">-- Select Vendor --</option>
                    {vendors.map(v => (
                      <option key={v.id} value={v.id}>{v.name}</option>
                    ))}
                  </select>
                </label>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <label style={S.label}>
                  Batch / Lot Number
                  <input
                    style={S.input}
                    placeholder="e.g. LOT-CHEM-2026"
                    value={inwardForm.batch_number}
                    onChange={e => setInwardForm(prev => ({ ...prev, batch_number: e.target.value }))}
                  />
                </label>
                <label style={S.label}>
                  Bin / Storage Location
                  <input
                    style={S.input}
                    placeholder="e.g. RM-YARD / CHEM-ROOM"
                    value={inwardForm.bin_location}
                    onChange={e => setInwardForm(prev => ({ ...prev, bin_location: e.target.value }))}
                  />
                </label>
              </div>

              <label style={S.label}>
                Receipt Remarks
                <input
                  style={S.input}
                  placeholder="e.g. Received intact, test COA verified"
                  value={inwardForm.remarks}
                  onChange={e => setInwardForm(prev => ({ ...prev, remarks: e.target.value }))}
                />
              </label>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 10 }}>
                <button type="button" style={S.btnGhost} onClick={() => setInwardModal(false)}>Cancel</button>
                <button type="submit" style={{ ...S.btn, background: '#0f766e', color: '#fff' }}>
                  ✓ Record Inward GRN
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── FAST OUTWARD / ISSUE MODAL ── */}
      {issueModal && (
        <div style={S.overlay}>
          <div style={S.modal} onClick={e => e.stopPropagation()}>
            <div style={S.modalHdr}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ background: '#d97706', color: '#fff', padding: 6, borderRadius: 6 }}>
                  <ArrowUpRight size={16} />
                </div>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a' }}>Issue Material / Consumption</div>
              </div>
              <button style={S.x} onClick={() => setIssueModal(false)}>✕</button>
            </div>

            <form onSubmit={handleIssueSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <label style={S.label}>
                Select Raw Material / Chemical *
                <select
                  style={S.input}
                  value={issueForm.material_id}
                  onChange={e => setIssueForm(prev => ({ ...prev, material_id: e.target.value }))}
                  required
                >
                  <option value="">-- Choose Material from Catalog --</option>
                  {materials.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.name} (Stock: {m.current_stock} {m.unit})
                    </option>
                  ))}
                </select>
              </label>

              {selectedIssueMat && (
                <div style={{ fontSize: 11.5, background: '#f8fafc', padding: '8px 12px', borderRadius: 6, border: '1px solid #e2e8f0', color: '#334155' }}>
                  📦 Available Stock: <b>{selectedIssueMat.current_stock} {selectedIssueMat.unit}</b> | Valuation: <b>{fmtCur(selectedIssueMat.unit_price)}</b> / {selectedIssueMat.unit}
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <label style={S.label}>
                  Issued Quantity *
                  <input
                    type="number"
                    step="any"
                    style={S.input}
                    placeholder="e.g. 25.0"
                    value={issueForm.out_qty}
                    onChange={e => setIssueForm(prev => ({ ...prev, out_qty: e.target.value }))}
                    required
                  />
                </label>
                <label style={S.label}>
                  Target Department *
                  <select
                    style={S.input}
                    value={issueForm.department_id}
                    onChange={e => setIssueForm(prev => ({ ...prev, department_id: e.target.value }))}
                  >
                    <option value="">-- Choose Recipient Dept --</option>
                    {depts.map(d => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </label>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <label style={S.label}>
                  Plant Section (Target)
                  <select
                    style={S.input}
                    value={issueForm.section_id}
                    onChange={e => setIssueForm(prev => ({ ...prev, section_id: e.target.value }))}
                  >
                    <option value="">-- Choose Target Section --</option>
                    {sections.filter(s => s.sectionCode !== 'ALL' && s.code !== 'ALL').map(s => (
                      <option key={s.id} value={s.id}>{s.icon || '🏭'} {s.name || s.sectionCode} ({s.sectionCode || s.code})</option>
                    ))}
                  </select>
                </label>
                <label style={S.label}>
                  Target Machine / Pulper
                  <select
                    style={S.input}
                    value={issueForm.machine_id}
                    onChange={e => setIssueForm(prev => ({ ...prev, machine_id: e.target.value }))}
                  >
                    <option value="">-- General / Pulper / Any --</option>
                    {machines.map(m => (
                      <option key={m.id} value={m.id}>{m.name || m.code}</option>
                    ))}
                  </select>
                </label>
              </div>

              <label style={S.label}>
                Consumption Purpose
                <input
                  style={S.input}
                  placeholder="e.g. Furnish batching, pulper charge, size press cooking"
                  value={issueForm.purpose}
                  onChange={e => setIssueForm(prev => ({ ...prev, purpose: e.target.value }))}
                />
              </label>

              <label style={S.label}>
                Issuance Notes / Shift
                <input
                  style={S.input}
                  placeholder="e.g. Shift A charge, requested by Shift Incharge"
                  value={issueForm.remarks}
                  onChange={e => setIssueForm(prev => ({ ...prev, remarks: e.target.value }))}
                />
              </label>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 10 }}>
                <button type="button" style={S.btnGhost} onClick={() => setIssueModal(false)}>Cancel</button>
                <button type="submit" style={{ ...S.btn, background: '#d97706', color: '#fff' }}>
                  ✓ Confirm Material Issuance
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── UNIFIED PRODUCT SPECIFICATION & STOCK LEDGER MODAL ── */}
      <ProductDetailModal
        materialId={selectedProductModalId}
        isOpen={!!selectedProductModalId}
        onClose={() => setSelectedProductModalId(null)}
        onUpdated={loadBaseData}
      />
    </div>
  )
}

// ── STYLES ───────────────────────────────────────────────────────────────────
const S = {
  page: { padding: '24px', background: '#f8f8f6', minHeight: '100vh', fontFamily: 'system-ui, -apple-system, sans-serif' },
  hdr: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 12 },
  title: { fontSize: 22, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em' },
  sub: { fontSize: 13, color: '#64748b', marginTop: 4 },
  
  kpiGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginBottom: 20 },
  kpiCard: { background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 4, boxShadow: '0 1px 3px rgba(0,0,0,0.03)' },
  kpiTitle: { fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' },
  kpiVal: { fontSize: 22, fontWeight: 800, color: '#0f172a' },
  kpiSub: { fontSize: 11, color: '#94a3b8' },
  iconBox: { width: 34, height: 34, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' },

  scopeBar: { display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 16, background: '#fff', padding: '10px 14px', borderRadius: 10, border: '1px solid #e2e8f0' },
  chip: { padding: '6px 14px', borderRadius: 999, border: '1px solid #e2e8f0', background: '#f8fafc', fontSize: 12, fontWeight: 600, color: '#475569', cursor: 'pointer', transition: 'all 0.15s' },
  chipActive: { background: '#0f172a', color: '#fff', borderColor: '#0f172a' },

  tabs: { display: 'flex', gap: 6, marginBottom: 16, borderBottom: '2px solid #e2e8f0' },
  tab: { padding: '9px 18px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: '#64748b', borderBottom: '2px solid transparent', marginBottom: -2, fontWeight: 600 },
  tabA: { color: '#0f172a', borderBottomColor: '#0f172a', fontWeight: 800 },

  filterBar: { display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' },
  card: { background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' },
  
  tbl: { width: '100%', borderCollapse: 'collapse', fontSize: 12.5 },
  th: { padding: '11px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' },
  td: { padding: '11px 14px', color: '#1e293b', borderBottom: '1px solid #f1f5f9', verticalAlign: 'middle' },
  tdEmpty: { padding: 40, textAlign: 'center', color: '#94a3b8', fontStyle: 'italic' },
  code: { fontSize: 10.5, color: '#94a3b8', fontFamily: 'monospace' },
  badge: { fontSize: 11, padding: '3px 8px', borderRadius: 999, fontWeight: 700 },

  btn: { display: 'flex', alignItems: 'center', gap: 6, background: '#0f172a', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 15px', cursor: 'pointer', fontSize: 13, fontWeight: 700, boxShadow: '0 1px 2px rgba(0,0,0,0.05)' },
  btnSm: { color: '#fff', border: 'none', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 11, fontWeight: 700 },
  btnGhost: { background: '#fff', color: '#334155', border: '1px solid #cbd5e1', borderRadius: 8, padding: '8px 14px', cursor: 'pointer', fontSize: 12.5, fontWeight: 600 },
  
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 20 },
  modal: { background: '#fff', borderRadius: 14, padding: 24, width: '100%', maxWidth: 520, display: 'flex', flexDirection: 'column', gap: 14, boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)' },
  modalHdr: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  x: { background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#94a3b8' },
  label: { display: 'flex', flexDirection: 'column', gap: 5, fontSize: 12, fontWeight: 600, color: '#334155' },
  input: { width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: 8, fontSize: 13, boxSizing: 'border-box', background: '#f8fafc', color: '#0f172a', outline: 'none' },
}
