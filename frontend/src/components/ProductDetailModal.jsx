import React, { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import {
  Package, FileText, ArrowDownRight, ArrowUpRight, X,
  Save, AlertTriangle, CheckCircle2, Clock, MapPin, Tag,
  Layers, ShieldCheck, DollarSign, History, Printer, ExternalLink
} from 'lucide-react'
import { UOM_CATEGORIES, ALL_UOM_CODES } from '../constants/uom'
import SectionMachineAllocator from './SectionMachineAllocator'

const API = '/api'
const h = () => ({ Authorization: `Bearer ${localStorage.getItem('mk_token')}` })
const json = () => ({ ...h(), 'Content-Type': 'application/json' })

export default function ProductDetailModal({
  materialId,
  isOpen,
  onClose,
  onUpdated,
  onOpenInward,
  onOpenIssue
}) {
  const { user } = useAuth()
  const roleLevel = user?.role_level ?? 1
  const dept = (user?.department || '').toLowerCase()
  const deptCode = (user?.dept_code || '').toUpperCase()
  const isStoreManager = (
    (roleLevel >= 3 && (['STORE', 'INV', 'RMS', 'MATERIALS'].includes(deptCode) || dept.includes('store') || dept.includes('inventory') || dept.includes('raw material'))) ||
    roleLevel >= 4
  )

  const [activeTab, setActiveTab] = useState('specs') // 'specs' | 'ledger' | 'quick_ops'
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [data, setData] = useState(null)
  const [categories, setCategories] = useState([])
  const [departments, setDepartments] = useState([])
  const [vendors, setVendors] = useState([])
  const [sections, setSections] = useState([])
  const [sectionEquipment, setSectionEquipment] = useState([])
  const [machines, setMachines] = useState([])
  const [toastMsg, setToastMsg] = useState({ text: '', type: '' })

  // Specification edit form state
  const [form, setForm] = useState({
    name: '',
    code: '',
    category_id: '',
    section_id: '',
    section_ids: [],
    machine_id: '',
    section_equipment_id: '',
    section_equipment_ids: [],
    uom: 'NOS',
    unit_price: '',
    min_stock: '',
    max_stock: '',
    reorder_level: '',
    reorder_buffer: '',
    bin_location: '',
    hsn_code: '',
    criticality_class: 'C',
    procurement_strategy: '',
    oem_supplier: '',
    section_context: '',
    is_active: true
  })

  // Quick Inward Form
  const [inwardForm, setInwardForm] = useState({
    in_qty: '',
    unit_price: '',
    vendor_id: '',
    po_number: '',
    batch_number: '',
    bin_location: '',
    remarks: ''
  })
  const [inwardLoading, setInwardLoading] = useState(false)

  // Quick Issue Form
  const [issueForm, setIssueForm] = useState({
    out_qty: '',
    department_id: '',
    purpose: '',
    remarks: ''
  })
  const [issueLoading, setIssueLoading] = useState(false)

  const showToast = (text, type = 'success') => {
    setToastMsg({ text, type })
    setTimeout(() => setToastMsg({ text: '', type: '' }), 4000)
  }

  const loadMaterialDetail = useCallback(async () => {
    if (!materialId || !isOpen) return
    setLoading(true)
    try {
      const isNew = materialId === 'new'
      const [matRes, catRes, deptRes, venRes, secRes, eqRes, mcnRes] = await Promise.all([
        !isNew ? fetch(`${API}/master/materials/${materialId}`, { headers: h() }).then(r => r.json()) : Promise.resolve({ success: true, data: null }),
        fetch(`${API}/master/categories`, { headers: h() }).then(r => r.json()).catch(() => ({ data: [] })),
        fetch(`${API}/admin/departments`, { headers: h() }).then(r => r.json()).catch(() => ({ data: [] })),
        fetch(`${API}/master/vendors?limit=2500`, { headers: h() }).then(r => r.json()).catch(() => ({ data: [] })),
        fetch(`${API}/master/sections`, { headers: h() }).then(r => r.json()).catch(() => ({ data: [] })),
        fetch(`${API}/master/section-equipment`, { headers: h() }).then(r => r.json()).catch(() => ({ data: [] })),
        fetch(`${API}/master/machines`, { headers: h() }).then(r => r.json()).catch(() => ({ data: [] }))
      ])

      if (isNew) {
        setData({ isNew: true, name: 'New Material Item', code: '' })
        setForm({
          name: '',
          code: '',
          category_id: catRes.data?.[0]?.id ? String(catRes.data[0].id) : '',
          section_id: '',
          section_ids: [],
          machine_id: '',
          section_equipment_id: '',
          section_equipment_ids: [],
          uom: 'NOS',
          unit_price: '',
          min_stock: '',
          max_stock: '',
          reorder_level: '',
          reorder_buffer: '',
          bin_location: '',
          hsn_code: '',
          criticality_class: 'C',
          procurement_strategy: '',
          oem_supplier: '',
          section_context: '',
          is_active: true
        })
      } else if (matRes.success && matRes.data) {
        const d = matRes.data
        setData(d)
        const secIds = (d.sections && d.sections.length > 0)
          ? d.sections.map(s => String(s.id))
          : (d.sectionId ?? d.section_id ? [String(d.sectionId ?? d.section_id)] : [])
        const equipIds = (d.equipment && d.equipment.length > 0)
          ? d.equipment.map(eq => String(eq.id))
          : (d.sectionEquipmentId ?? d.section_equipment_id ? [String(d.sectionEquipmentId ?? d.section_equipment_id)] : [])

        setForm({
          name: d.name || '',
          code: d.code || '',
          category_id: String(d.category_id || ''),
          section_id: String(d.sectionId ?? d.section_id ?? ''),
          section_ids: secIds,
          machine_id: String(d.machineId ?? d.machine_id ?? ''),
          section_equipment_id: String(d.sectionEquipmentId ?? d.section_equipment_id ?? ''),
          section_equipment_ids: equipIds,
          uom: d.uom || 'Kgs',
          unit_price: String(d.unit_price ?? ''),
          min_stock: String(d.min_stock ?? ''),
          max_stock: String(d.max_stock ?? ''),
          reorder_level: String(d.reorder_level ?? ''),
          reorder_buffer: String(d.reorder_buffer ?? ''),
          bin_location: d.bin_location || '',
          hsn_code: d.hsn_code || '',
          criticality_class: d.criticality_class || 'C',
          procurement_strategy: d.procurement_strategy || '',
          oem_supplier: d.oem_supplier || '',
          section_context: d.section_context || '',
          is_active: d.is_active !== undefined ? d.is_active : true
        })
        setInwardForm(prev => ({
          ...prev,
          unit_price: String(d.unit_price || ''),
          bin_location: d.bin_location || ''
        }))
      }

      if (catRes.success) setCategories(catRes.data || [])
      if (deptRes.success) setDepartments(deptRes.data || [])
      if (venRes.success) setVendors(venRes.data || [])
      if (secRes.success) setSections(secRes.data || [])
      if (eqRes.success) setSectionEquipment(eqRes.data || [])
      if (mcnRes.success) setMachines(mcnRes.data || [])
    } catch (e) {
      console.error(e)
      showToast('Error loading material product details', 'error')
    } finally {
      setLoading(false)
    }
  }, [materialId, isOpen])

  useEffect(() => {
    loadMaterialDetail()
  }, [loadMaterialDetail])

  // Save changes to specifications
  const handleSaveSpecs = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const isNew = materialId === 'new'
      const payload = {
        ...form,
        category_id: form.category_id ? parseInt(form.category_id) : null,
        section_id: form.section_id ? parseInt(form.section_id) : (form.section_ids?.[0] ? parseInt(form.section_ids[0]) : null),
        section_ids: form.section_ids || [],
        machine_id: form.machine_id ? parseInt(form.machine_id) : null,
        section_equipment_id: form.section_equipment_id ? parseInt(form.section_equipment_id) : (form.section_equipment_ids?.[0] ? parseInt(form.section_equipment_ids[0]) : null),
        section_equipment_ids: form.section_equipment_ids || [],
        section_context: form.section_context || null,
        unit_price: parseFloat(form.unit_price || 0),
        min_stock: parseFloat(form.min_stock || 0),
        max_stock: parseFloat(form.max_stock || 0),
        reorder_level: parseFloat(form.reorder_level || 0),
        reorder_buffer: parseFloat(form.reorder_buffer || 0)
      }

      const res = await fetch(isNew ? `${API}/master/materials` : `${API}/master/materials/${materialId}`, {
        method: isNew ? 'POST' : 'PUT',
        headers: json(),
        body: JSON.stringify(payload)
      }).then(r => r.json())

      if (res.success) {
        showToast(isNew ? 'New material created successfully!' : 'Product specifications updated successfully!', 'success')
        if (isNew) {
          if (onUpdated) onUpdated()
          onClose()
        } else {
          loadMaterialDetail()
          if (onUpdated) onUpdated()
        }
      } else {
        showToast(res.message || 'Failed to save product specs', 'error')
      }
    } catch (e) {
      showToast('Network error saving specifications', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteMaterial = async () => {
    if (!window.confirm(`Are you sure you want to delete / deactivate "${form.name}" (${form.code})?`)) return
    try {
      const res = await fetch(`${API}/master/materials/${materialId}`, {
        method: 'DELETE',
        headers: h()
      })
      const r = await res.json()
      if (r.success) {
        showToast('Material deactivated successfully', 'success')
        if (onUpdated) onUpdated()
        setTimeout(() => onClose(), 600)
      } else {
        showToast(r.message || 'Failed to delete material', 'error')
      }
    } catch (err) {
      showToast('Error deleting material: ' + err.message, 'error')
    }
  }

  // Quick Inward Submit
  const handleQuickInward = async (e) => {
    e.preventDefault()
    if (!inwardForm.in_qty || Number(inwardForm.in_qty) <= 0) {
      showToast('Please enter a valid positive inward quantity', 'error')
      return
    }
    setInwardLoading(true)
    try {
      const vendorObj = vendors.find(v => String(v.id) === String(inwardForm.vendor_id))
      const vendorName = vendorObj ? vendorObj.name : ''
      const remarksFormatted = [
        vendorName ? `Vendor: ${vendorName}` : '',
        inwardForm.po_number ? `PO: ${inwardForm.po_number}` : '',
        inwardForm.remarks || ''
      ].filter(Boolean).join(' | ')

      const payload = {
        material_id: parseInt(materialId),
        in_qty: parseFloat(inwardForm.in_qty),
        unit_price: parseFloat(inwardForm.unit_price || data?.unit_price || 0),
        inward_type: 'grn',
        reference_type: inwardForm.po_number ? 'PO' : 'CHALLAN',
        reference_id: /^\d+$/.test(inwardForm.po_number) ? parseInt(inwardForm.po_number) : null,
        vendor_id: inwardForm.vendor_id ? parseInt(inwardForm.vendor_id) : null,
        vendor_name: vendorName || undefined,
        batch_number: inwardForm.batch_number || null,
        bin_location: inwardForm.bin_location || data?.bin_location || 'RM-YARD',
        remarks: remarksFormatted
      }

      const res = await fetch(`${API}/store/inward`, {
        method: 'POST',
        headers: json(),
        body: JSON.stringify(payload)
      }).then(r => r.json())

      if (res.success) {
        showToast(`Logged Inward of ${inwardForm.in_qty} ${data?.uom || ''} successfully!`, 'success')
        setInwardForm({
          in_qty: '',
          unit_price: String(data?.unit_price || ''),
          vendor_id: '',
          po_number: '',
          batch_number: '',
          bin_location: data?.bin_location || '',
          remarks: ''
        })
        loadMaterialDetail()
        if (onUpdated) onUpdated()
      } else {
        showToast(res.message || 'Inward transaction failed', 'error')
      }
    } catch (e) {
      showToast('Network error processing inward', 'error')
    } finally {
      setInwardLoading(false)
    }
  }

  // Quick Issue Submit
  const handleQuickIssue = async (e) => {
    e.preventDefault()
    if (!issueForm.out_qty || Number(issueForm.out_qty) <= 0) {
      showToast('Please enter a valid positive issue quantity', 'error')
      return
    }
    setIssueLoading(true)
    try {
      const selectedDept = departments.find(d => String(d.id) === String(issueForm.department_id))
      const deptName = selectedDept ? selectedDept.name : 'Store Consumption'

      const payload = {
        material_id: parseInt(materialId),
        department_id: issueForm.department_id ? parseInt(issueForm.department_id) : null,
        out_qty: parseFloat(issueForm.out_qty),
        unit_price: parseFloat(data?.unit_price || 0),
        outward_type: 'issue',
        purpose: issueForm.purpose || 'Departmental Material Issue',
        remarks: issueForm.remarks ? `${deptName} | ${issueForm.remarks}` : deptName
      }

      const res = await fetch(`${API}/store/outward`, {
        method: 'POST',
        headers: json(),
        body: JSON.stringify(payload)
      }).then(r => r.json())

      if (res.success) {
        showToast(`Issued ${issueForm.out_qty} ${data?.uom || ''} to ${deptName}!`, 'success')
        setIssueForm({
          out_qty: '',
          department_id: '',
          purpose: '',
          remarks: ''
        })
        loadMaterialDetail()
        if (onUpdated) onUpdated()
      } else {
        showToast(res.message || 'Issue transaction failed', 'error')
      }
    } catch (e) {
      showToast('Network error processing issue', 'error')
    } finally {
      setIssueLoading(false)
    }
  }

  if (!isOpen) return null

  const currentStock = parseFloat(data?.current_stock || 0)
  const minStock = parseFloat(data?.min_stock || 0)
  const unitPrice = parseFloat(data?.unit_price || 0)
  const totalValuation = currentStock * unitPrice
  const isLowStock = currentStock <= minStock
  const isOutOfStock = currentStock <= 0

  const fmtCur = v => `₹${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  const fmtN = (v, dec = 2) => Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: dec, maximumFractionDigits: dec })

  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={S.card} onClick={e => e.stopPropagation()}>
        {/* ── Modal Header ── */}
        <div style={S.header}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ ...S.iconBox, background: isLowStock ? '#fee2e2' : '#f0fdf4', color: isLowStock ? '#dc2626' : '#16a34a' }}>
              <Package size={22} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={S.title}>{data?.name || 'Material Product Form'}</span>
                <span style={S.codeBadge}>{data?.code || 'NO-CODE'}</span>
                <span style={S.catBadge}>{data?.category_name || data?.categoryName || 'General Store'}</span>
                {isOutOfStock ? (
                  <span style={{ ...S.statusBadge, background: '#fee2e2', color: '#dc2626' }}>❌ Out of Stock</span>
                ) : isLowStock ? (
                  <span style={{ ...S.statusBadge, background: '#fef3c7', color: '#b45309' }}>⚠️ Below Reorder Level</span>
                ) : (
                  <span style={{ ...S.statusBadge, background: '#dcfce7', color: '#15803d' }}>✓ Safe Stock</span>
                )}
              </div>
              <div style={S.subtitle}>
                Material ID: #{data?.id} · Store Classification: {data?.category_type || 'Inventory'} · Location: {data?.bin_location || 'Not Assigned'}
              </div>
            </div>
          </div>
          <button style={S.closeBtn} onClick={onClose} title="Close product form">
            <X size={20} />
          </button>
        </div>

        {/* ── Toast notification inside modal ── */}
        {toastMsg.text && (
          <div style={{
            ...S.toast,
            background: toastMsg.type === 'error' ? '#fee2e2' : '#dcfce7',
            color: toastMsg.type === 'error' ? '#991b1b' : '#166534',
            border: `1px solid ${toastMsg.type === 'error' ? '#fecaca' : '#bbf7d0'}`
          }}>
            {toastMsg.text}
          </div>
        )}

        {/* ── Key Metrics Strip ── */}
        <div style={S.metricsGrid}>
          <div style={S.metricCard}>
            <div style={S.metricLabel}>Current Physical Stock</div>
            <div style={{ ...S.metricVal, color: isOutOfStock ? '#dc2626' : isLowStock ? '#d97706' : '#15803d' }}>
              {fmtN(currentStock, 2)} {data?.uom || 'UOM'}
            </div>
            <div style={S.metricSub}>Live stock in warehouse</div>
          </div>

          <div style={S.metricCard}>
            <div style={S.metricLabel}>Min Safety Threshold</div>
            <div style={{ ...S.metricVal, color: '#475569' }}>
              {fmtN(minStock, 2)} {data?.uom || 'UOM'}
            </div>
            <div style={S.metricSub}>Automated reorder buffer</div>
          </div>

          <div style={S.metricCard}>
            <div style={S.metricLabel}>Unit Valuation Rate</div>
            <div style={{ ...S.metricVal, color: '#0f172a' }}>
              {fmtCur(unitPrice)}
            </div>
            <div style={S.metricSub}>Per {data?.uom || 'unit'} cost</div>
          </div>

          <div style={S.metricCard}>
            <div style={S.metricLabel}>Total Stock Valuation</div>
            <div style={{ ...S.metricVal, color: '#16a34a' }}>
              {fmtCur(totalValuation)}
            </div>
            <div style={S.metricSub}>Current × Unit Rate</div>
          </div>
        </div>

        {/* ── Visual Stock Rollover Formula Banner ── */}
        <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', padding: '10px 14px', borderRadius: 8, margin: '0 0 14px 0', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
              <span style={{ fontWeight: 700, color: '#334155' }}>
                📦 Opening (Yesterday): <span style={{ color: '#0284c7', fontWeight: 800 }}>{fmtN(data?.opening_stock ?? Math.max(0, currentStock - (data?.today_received || 0) + (data?.today_issued || 0)), 2)}</span>
              </span>
              <span style={{ fontWeight: 800, color: '#16a34a' }}>＋</span>
              <span style={{ fontWeight: 700, color: '#16a34a' }}>
                📥 Received (Today): <span style={{ fontWeight: 800 }}>+{fmtN(data?.today_received || 0, 2)}</span>
              </span>
              <span style={{ fontWeight: 800, color: '#dc2626' }}>－</span>
              <span style={{ fontWeight: 700, color: '#dc2626' }}>
                📤 Issued (Today): <span style={{ fontWeight: 800 }}>-{fmtN(data?.today_issued || 0, 2)}</span>
              </span>
              <span style={{ fontWeight: 800, color: '#0f766e' }}>＝</span>
              <span style={{ fontWeight: 800, color: '#0f766e' }}>
                💰 Closing Balance: <span style={{ textDecoration: 'underline' }}>{fmtN(currentStock, 2)} {data?.uom}</span>
              </span>
            </div>
            <span style={{ fontSize: 11, background: '#e0f2fe', color: '#0369a1', padding: '1px 7px', borderRadius: 10, fontWeight: 600 }}>
              🔄 Day-to-Day Rollover Active
            </span>
          </div>
        </div>

        {/* ── Tabs Navigation ── */}
        <div style={S.navTabs}>
          {[
            { id: 'specs', label: '📋 Product Specifications & Master Data' },
            { id: 'ledger', label: `📜 Transaction Ledger & History (${data?.recent_transactions?.length || 0})` },
            { id: 'quick_ops', label: '⚡ Fast Inward / Issue Desks' }
          ].map(t => (
            <button
              key={t.id}
              style={{ ...S.tabBtn, ...(activeTab === t.id ? S.tabBtnActive : {}) }}
              onClick={() => setActiveTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ── TAB 1: PRODUCT SPECIFICATIONS & MASTER DATA ── */}
        {activeTab === 'specs' && (
          <form onSubmit={handleSaveSpecs} style={S.formBody}>
            <div style={S.grid2}>
              <label style={S.label}>
                Product Name / Grade Description *
                <input
                  style={S.input}
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  required
                />
              </label>
              <label style={S.label}>
                Item Code / ERP SKU *
                <input
                  style={{ ...S.input, fontFamily: 'monospace', fontWeight: 700 }}
                  value={form.code}
                  onChange={e => setForm({ ...form, code: e.target.value })}
                  required
                />
              </label>
            </div>

            <div style={S.grid3}>
              <label style={S.label}>
                Category *
                <select
                  style={S.input}
                  value={form.category_id}
                  onChange={e => setForm({ ...form, category_id: e.target.value })}
                  required
                >
                  <option value="">-- Select Category --</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.name} ({c.type})</option>
                  ))}
                </select>
              </label>
              <label style={S.label}>
                Unit of Measure (UOM) *
                <select
                  style={S.input}
                  value={form.uom || 'NOS'}
                  onChange={e => setForm({ ...form, uom: e.target.value })}
                >
                  {UOM_CATEGORIES.map(cat => (
                    <optgroup key={cat.category} label={`── ${cat.category} ──`}>
                      {cat.units.map(u => (
                        <option key={u.code} value={u.code}>{u.label} — {u.desc}</option>
                      ))}
                    </optgroup>
                  ))}
                  {form.uom && !ALL_UOM_CODES.includes(form.uom.toUpperCase()) && (
                    <optgroup label="── Custom Unit ──">
                      <option value={form.uom}>{form.uom} (Custom)</option>
                    </optgroup>
                  )}
                </select>
              </label>
              <label style={S.label}>
                Unit Rate (₹ / {form.uom})
                <input
                  type="number"
                  step="any"
                  style={S.input}
                  value={form.unit_price}
                  onChange={e => setForm({ ...form, unit_price: e.target.value })}
                />
              </label>
            </div>

            <div style={S.grid3}>
              <label style={S.label}>
                Min Reorder Stock ({form.uom})
                <input
                  type="number"
                  step="any"
                  style={S.input}
                  value={form.min_stock}
                  onChange={e => setForm({ ...form, min_stock: e.target.value })}
                />
              </label>
              <label style={S.label}>
                Max Warehouse Capacity ({form.uom})
                <input
                  type="number"
                  step="any"
                  style={S.input}
                  value={form.max_stock}
                  onChange={e => setForm({ ...form, max_stock: e.target.value })}
                />
              </label>
              <label style={S.label}>
                Storage Bin / Yard Location
                <input
                  style={S.input}
                  placeholder="e.g. RM-YARD-A / CHEM-BAY-2"
                  value={form.bin_location}
                  onChange={e => setForm({ ...form, bin_location: e.target.value })}
                />
              </label>
            </div>

            <div style={S.grid3}>
              <label style={S.label}>
                HSN / SAC Code
                <input
                  style={S.input}
                  placeholder="e.g. 47079000"
                  value={form.hsn_code}
                  onChange={e => setForm({ ...form, hsn_code: e.target.value })}
                />
              </label>
              <label style={S.label}>
                Criticality Class
                <select
                  style={S.input}
                  value={form.criticality_class}
                  onChange={e => setForm({ ...form, criticality_class: e.target.value })}
                >
                  <option value="A">A — High Criticality (Mill Shutdown Risk)</option>
                  <option value="B">B — Medium (Standard Process Material)</option>
                  <option value="C">C — Low / General Consumable</option>
                </select>
              </label>
              <label style={S.label}>
                OEM / Preferred Supplier
                <input
                  style={S.input}
                  placeholder="e.g. ITC / Suchem / Century"
                  value={form.oem_supplier}
                  onChange={e => setForm({ ...form, oem_supplier: e.target.value })}
                />
              </label>
            </div>

            {/* Universal Section & Machine Allocation Panel */}
            <SectionMachineAllocator
              sectionIds={form.section_ids || (form.section_id ? [String(form.section_id)] : [])}
              onSectionIdsChange={(vals) => setForm(f => ({ ...f, section_ids: vals, section_id: vals[0] || '' }))}
              equipmentIds={form.section_equipment_ids || (form.section_equipment_id ? [String(form.section_equipment_id)] : [])}
              onEquipmentIdsChange={(vals) => setForm(f => ({ ...f, section_equipment_ids: vals, section_equipment_id: vals[0] || '' }))}
              machineId={form.machine_id}
              onMachineIdChange={(val) => setForm(f => ({ ...f, machine_id: val }))}
              sectionContext={form.section_context}
              onSectionContextChange={(val) => setForm(f => ({ ...f, section_context: val }))}
              sections={sections}
              sectionEquipment={sectionEquipment}
              machines={machines}
            />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: '#334155', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={form.is_active}
                    onChange={e => setForm({ ...form, is_active: e.target.checked })}
                    style={{ accentColor: '#0f172a', cursor: 'pointer' }}
                  />
                  Active in Store Catalog
                </label>

                {isStoreManager && (
                  <button
                    type="button"
                    onClick={handleDeleteMaterial}
                    style={{ background: '#fef2f2', border: '1px solid #dc2626', color: '#dc2626', borderRadius: 6, padding: '5px 10px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                    title="Store Manager: Deactivate / Delete this material item"
                  >
                    🗑️ Delete Item
                  </button>
                )}
              </div>

              <button
                type="submit"
                style={{ ...S.btnPrimary, opacity: saving ? 0.7 : 1 }}
                disabled={saving}
              >
                <Save size={16} /> {saving ? 'Saving...' : '💾 Save Product Specifications'}
              </button>
            </div>
          </form>
        )}

        {/* ── TAB 2: LIVE TRANSACTION LEDGER & HISTORY ── */}
        {activeTab === 'ledger' && (
          <div style={{ overflowY: 'auto', maxHeight: 420 }}>
            <table style={S.tbl}>
              <thead>
                <tr>
                  <th style={S.th}>Date</th>
                  <th style={S.th}>Transaction Type</th>
                  <th style={S.th}>In Qty</th>
                  <th style={S.th}>Out Qty</th>
                  <th style={S.th}>Balance Stock</th>
                  <th style={S.th}>Rate (₹)</th>
                  <th style={S.th}>Total Value (₹)</th>
                  <th style={S.th}>Reference / Remarks</th>
                </tr>
              </thead>
              <tbody>
                {(!data?.recent_transactions || data.recent_transactions.length === 0) ? (
                  <tr>
                    <td colSpan={8} style={S.tdEmpty}>No transaction ledger history recorded for this material.</td>
                  </tr>
                ) : (
                  data.recent_transactions.map(txn => {
                    const isIn = parseFloat(txn.in_qty || 0) > 0
                    return (
                      <tr key={txn.id}>
                        <td style={{ ...S.td, whiteSpace: 'nowrap', color: '#64748b' }}>
                          {txn.date ? new Date(txn.date).toLocaleDateString() : '—'}
                        </td>
                        <td style={S.td}>
                          <span style={{
                            ...S.txnBadge,
                            background: isIn ? '#dcfce7' : '#fee2e2',
                            color: isIn ? '#15803d' : '#dc2626'
                          }}>
                            {txn.transaction_type?.toUpperCase()}
                          </span>
                        </td>
                        <td style={{ ...S.td, fontWeight: 700, color: '#16a34a' }}>
                          {isIn ? `+${fmtN(txn.in_qty, 2)}` : '—'}
                        </td>
                        <td style={{ ...S.td, fontWeight: 700, color: '#dc2626' }}>
                          {parseFloat(txn.out_qty || 0) > 0 ? `-${fmtN(txn.out_qty, 2)}` : '—'}
                        </td>
                        <td style={{ ...S.td, fontWeight: 700, color: '#0f172a' }}>
                          {fmtN(txn.balance, 2)} {data?.uom}
                        </td>
                        <td style={S.td}>{fmtCur(txn.unit_price)}</td>
                        <td style={{ ...S.td, fontWeight: 600 }}>{fmtCur(txn.value)}</td>
                        <td style={{ ...S.td, fontSize: 11.5, color: '#475569' }}>
                          {txn.remarks || txn.reference_type || '—'}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* ── TAB 3: FAST INWARD & ISSUE DESKS ── */}
        {activeTab === 'quick_ops' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {/* Quick Inward GRN Box */}
            <div style={S.opBox}>
              <div style={{ ...S.opHead, color: '#0f766e', borderBottomColor: '#ccfbf1' }}>
                <ArrowDownRight size={18} /> + Quick Inward Receipt (GRN)
              </div>
              <form onSubmit={handleQuickInward} style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
                <label style={S.label}>
                  Received Quantity ({data?.uom}) *
                  <input
                    type="number"
                    step="any"
                    style={S.input}
                    placeholder="Quantity to add"
                    value={inwardForm.in_qty}
                    onChange={e => setInwardForm({ ...inwardForm, in_qty: e.target.value })}
                    required
                  />
                </label>

                <label style={S.label}>
                  Unit Rate (₹ / {data?.uom})
                  <input
                    type="number"
                    step="any"
                    style={S.input}
                    value={inwardForm.unit_price}
                    onChange={e => setInwardForm({ ...inwardForm, unit_price: e.target.value })}
                  />
                </label>

                <label style={S.label}>
                  Supplier / Vendor
                  <select
                    style={S.input}
                    value={inwardForm.vendor_id}
                    onChange={e => setInwardForm({ ...inwardForm, vendor_id: e.target.value })}
                  >
                    <option value="">-- Choose Vendor --</option>
                    {vendors.map(v => (
                      <option key={v.id} value={v.id}>{v.name}</option>
                    ))}
                  </select>
                </label>

                <label style={S.label}>
                  PO Number / Challan
                  <input
                    style={S.input}
                    placeholder="e.g. PO-20260814-01"
                    value={inwardForm.po_number}
                    onChange={e => setInwardForm({ ...inwardForm, po_number: e.target.value })}
                  />
                </label>

                <button
                  type="submit"
                  style={{ ...S.btnPrimary, background: '#0f766e', marginTop: 6 }}
                  disabled={inwardLoading}
                >
                  ✓ Record Inward GRN
                </button>
              </form>
            </div>

            {/* Quick Issue Consumption Box */}
            <div style={S.opBox}>
              <div style={{ ...S.opHead, color: '#d97706', borderBottomColor: '#fef3c7' }}>
                <ArrowUpRight size={18} /> + Quick Issue (Consumption)
              </div>
              <form onSubmit={handleQuickIssue} style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
                <label style={S.label}>
                  Issue Quantity ({data?.uom}) *
                  <input
                    type="number"
                    step="any"
                    style={S.input}
                    placeholder={`Max: ${currentStock} ${data?.uom}`}
                    value={issueForm.out_qty}
                    onChange={e => setIssueForm({ ...issueForm, out_qty: e.target.value })}
                    required
                  />
                </label>

                <label style={S.label}>
                  Target Department *
                  <select
                    style={S.input}
                    value={issueForm.department_id}
                    onChange={e => setIssueForm({ ...issueForm, department_id: e.target.value })}
                    required
                  >
                    <option value="">-- Select Recipient Dept --</option>
                    {departments.map(d => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </label>

                <label style={S.label}>
                  Purpose / Shift Batch
                  <input
                    style={S.input}
                    placeholder="e.g. Wire change, size kitchen, boiler"
                    value={issueForm.purpose}
                    onChange={e => setIssueForm({ ...issueForm, purpose: e.target.value })}
                  />
                </label>

                <label style={S.label}>
                  Remarks / Notes
                  <input
                    style={S.input}
                    placeholder="e.g. Shift A batch requisition"
                    value={issueForm.remarks}
                    onChange={e => setIssueForm({ ...issueForm, remarks: e.target.value })}
                  />
                </label>

                <button
                  type="submit"
                  style={{ ...S.btnPrimary, background: '#d97706', marginTop: 6 }}
                  disabled={issueLoading}
                >
                  ✓ Confirm Material Issuance
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

const S = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999, padding: 16 },
  card: { background: '#fff', borderRadius: 16, width: '100%', maxWidth: 840, maxHeight: '90vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', padding: 24, boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', border: '1px solid #e2e8f0' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid #f1f5f9', paddingBottom: 16, marginBottom: 16 },
  iconBox: { width: 44, height: 44, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 18, fontWeight: 800, color: '#0f172a' },
  codeBadge: { fontSize: 12, fontFamily: 'monospace', fontWeight: 800, background: '#f1f5f9', color: '#334155', padding: '2px 8px', borderRadius: 6 },
  catBadge: { fontSize: 11.5, fontWeight: 700, background: '#eff6ff', color: '#1e40af', padding: '2px 8px', borderRadius: 6 },
  statusBadge: { fontSize: 11.5, fontWeight: 700, padding: '2px 8px', borderRadius: 6 },
  subtitle: { fontSize: 12, color: '#64748b', marginTop: 4 },
  closeBtn: { background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 4, borderRadius: 6 },

  toast: { padding: '8px 14px', borderRadius: 8, fontSize: 12.5, fontWeight: 600, marginBottom: 12 },

  metricsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10, marginBottom: 16 },
  metricCard: { background: '#f8fafc', borderRadius: 10, border: '1px solid #e2e8f0', padding: '12px 14px' },
  metricLabel: { fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' },
  metricVal: { fontSize: 18, fontWeight: 800, marginTop: 2 },
  metricSub: { fontSize: 10.5, color: '#94a3b8' },

  navTabs: { display: 'flex', gap: 6, borderBottom: '2px solid #e2e8f0', marginBottom: 16 },
  tabBtn: { padding: '8px 16px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#64748b', borderBottom: '2px solid transparent', marginBottom: -2 },
  tabBtnActive: { color: '#0f172a', borderBottomColor: '#0f172a', fontWeight: 800 },

  formBody: { display: 'flex', flexDirection: 'column', gap: 12 },
  grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },
  grid3: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 },
  label: { display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, fontWeight: 600, color: '#334155' },
  input: { width: '100%', padding: '7px 11px', border: '1px solid #cbd5e1', borderRadius: 7, fontSize: 12.5, background: '#f8fafc', color: '#0f172a', boxSizing: 'border-box' },

  btnPrimary: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: '#0f172a', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 18px', cursor: 'pointer', fontSize: 13, fontWeight: 700 },

  tbl: { width: '100%', borderCollapse: 'collapse', fontSize: 12 },
  th: { padding: '9px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' },
  td: { padding: '9px 12px', color: '#1e293b', borderBottom: '1px solid #f1f5f9' },
  tdEmpty: { padding: 30, textAlign: 'center', color: '#94a3b8', fontStyle: 'italic' },
  txnBadge: { fontSize: 10.5, fontWeight: 800, padding: '2px 6px', borderRadius: 4 },

  opBox: { background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16 },
  opHead: { fontSize: 14, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 6, borderBottom: '1px solid #e2e8f0', paddingBottom: 8 }
}
