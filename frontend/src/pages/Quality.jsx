import React, { useState, useEffect, useCallback } from 'react'
const API = (p, o) => fetch(p, { headers: { Authorization: `Bearer ${localStorage.getItem('mk_token')}`, 'Content-Type': 'application/json', ...(o?.headers || {}) }, ...o }).then(r => r.json())
const RESULT_COLOR = { Pending: '#8a8a90', Pass: '#22c55e', Fail: '#ef4444', Partial: '#ea580c', Hold: '#f97316' }
const TEST_TYPES = ['Incoming', 'Process', 'Final', 'Customer']
const REF_TYPES = ['Reel', 'GRN', 'Batch']
const empty = { test_type: 'Incoming', reference_type: 'Reel', reference_id: '', gsm: '', moisture_pct: '', caliper_micron: '', burst_factor: '', cobb_value: '', brightness_pct: '', thickness_micron: '', width_mm: '', weight_kg: '', tensile_strength: '', tear_strength: '', result: 'Pending', remarks: '' }

export default function Quality() {
  const [rows, setRows] = useState([]), [total, setTotal] = useState(0), [loading, setLoading] = useState(true)
  const [fResult, setFResult] = useState(''), [fType, setFType] = useState(''), [fSearch, setFSearch] = useState(''), [page, setPage] = useState(1)
  const [modal, setModal] = useState(false), [form, setForm] = useState(empty)
  const [saving, setSaving] = useState(false), [err, setErr] = useState('')
  const [pendingGrns, setPendingGrns] = useState([])
  const [grnInspectModal, setGrnInspectModal] = useState(false)
  const [selectedGrn, setSelectedGrn] = useState(null)
  const [inspectItems, setInspectItems] = useState([])
  const [inspectRemarks, setInspectRemarks] = useState('')
  const [inspectResult, setInspectResult] = useState('Pass')

  const LIMIT = 20

  const load = useCallback(async () => {
    setLoading(true)
    const p = new URLSearchParams({ page, limit: LIMIT })
    if (fResult) p.set('result', fResult)
    if (fType) p.set('test_type', fType)
    const r = await API(`/api/quality/tests?${p}`)
    if (r.success) { setRows(r.data); setTotal(r.total) }
    setLoading(false)
  }, [page, fResult, fType])

  const loadPendingGrns = useCallback(async () => {
    const r = await API('/api/finance/grn-bills')
    if (r.success) {
      setPendingGrns(r.data || [])
    }
  }, [])

  useEffect(() => { load(); loadPendingGrns() }, [load, loadPendingGrns])

  const F = (key, label, type = 'text', ph = '') => (
    <label style={S.label}>{label}<input style={S.input} type={type} step="any" value={form[key] ?? ''} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} placeholder={ph} /></label>
  )

  const save = async e => {
    e.preventDefault(); if (!form.test_type) return setErr('Test type required')
    setSaving(true); setErr('')
    const r = form.id
      ? await API(`/api/quality/tests/${form.id}`, { method: 'PUT', body: JSON.stringify(form) })
      : await API('/api/quality/tests', { method: 'POST', body: JSON.stringify(form) })
    setSaving(false); if (r.success) { setModal(false); setForm(empty); load() } else setErr(r.message)
  }

  const openEdit = (r) => {
    setForm({
      id: r.id, test_type: r.testType, reference_type: r.referenceType || '', reference_id: r.referenceId || '',
      gsm: r.gsm ?? '', moisture_pct: r.moisturePct ?? '', caliper_micron: r.caliperMicron ?? '',
      burst_factor: r.burstFactor ?? '', cobb_value: r.cobbValue ?? '', brightness_pct: r.brightnessPct ?? '',
      thickness_micron: r.thicknessMicron ?? '', width_mm: r.widthMm ?? '', weight_kg: r.weightKg ?? '',
      tensile_strength: r.tensileStrength ?? '', tear_strength: r.tearStrength ?? '', result: r.result, remarks: r.remarks || ''
    })
    setErr('')
    setModal(true)
  }

  const action = async (id, path) => {
    const r = await API(`/api/quality/tests/${id}/${path}`, { method: 'PUT' })
    if (r.success) load()
  }

  const openGrnInspection = async (grn) => {
    setSelectedGrn(grn)
    setInspectRemarks(`Incoming QC inspection for GRN #${grn.grnNumber || grn.grn_number}`)
    setInspectResult('Pass')
    const r = await API(`/api/purchase/grn/${grn.id}`)
    if (r.success && r.data?.items?.length) {
      setInspectItems(r.data.items.map(it => ({
        grnItemId: it.id,
        materialId: it.material_id,
        materialName: it.materialName,
        receivedQty: Number(it.received_qty || 0),
        acceptedQty: Number(it.accepted_qty || it.received_qty || 0),
        rejectedQty: Number(it.rejected_qty || 0),
        rejectionReason: it.remarks || '',
        actionRequired: 'Return to Vendor'
      })))
      setGrnInspectModal(true)
    } else {
      // No real grn_items to inspect — don't fabricate a fake line against an unrelated
      // material, that would post an accept/reject decision onto the wrong stock record.
      alert(r.message || 'Could not load GRN line items for inspection — this GRN has no items on record.')
    }
  }

  const submitGrnInspection = async (e) => {
    e.preventDefault()
    if (!selectedGrn) return
    setSaving(true)
    const payload = {
      grnId: selectedGrn.id,
      overallResult: inspectResult,
      remarks: inspectRemarks,
      items: inspectItems.map(it => ({
        grnItemId: it.grnItemId,
        materialId: it.materialId,
        acceptedQty: parseFloat(it.acceptedQty || 0),
        rejectedQty: parseFloat(it.rejectedQty || 0),
        rejectionReason: it.rejectionReason,
        actionRequired: it.actionRequired
      }))
    }
    const r = await API('/api/quality/grn-inspect', { method: 'POST', body: JSON.stringify(payload) })
    setSaving(false)
    if (r.success) {
      setGrnInspectModal(false)
      setSelectedGrn(null)
      load()
      loadPendingGrns()
    } else {
      alert(r.message || 'Inspection submission failed')
    }
  }

  const totalPages = Math.ceil(total / LIMIT)
  return (
    <div style={S.page}>
      <div style={S.header}>
        <div>
          <div style={S.title}>Quality Assurance & Lab Testing (QC Gate)</div>
          <div style={S.sub}>Incoming Material Inspections · Process Controls · Reel Sign-off · NCR & Rejections</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={{ ...S.btnPrimary, background: '#0284c7' }} onClick={() => pendingGrns.length ? openGrnInspection(pendingGrns[0]) : alert('No open GRNs found')}>
            🔍 GRN Incoming Inspection
          </button>
          <button style={S.btnPrimary} onClick={() => { setForm(empty); setErr(''); setModal(true) }}>+ Log Test</button>
        </div>
      </div>

      {pendingGrns.length > 0 && (
        <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, padding: '12px 16px', marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span style={{ fontWeight: 700, color: '#1e40af', fontSize: 13 }}>📥 {pendingGrns.length} Inward GRN Shipments Awaiting Quality Inspection</span>
            <div style={{ fontSize: 12, color: '#3b82f6', marginTop: 2 }}>Conduct lab testing, set Accepted vs Rejected split, and release to Store Stock or RTV.</div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {pendingGrns.slice(0, 3).map(g => (
              <button key={g.id} style={{ ...S.btnPrimary, fontSize: 11, padding: '6px 12px', background: '#2563eb' }} onClick={() => openGrnInspection(g)}>
                Inspect {g.grnNumber}
              </button>
            ))}
          </div>
        </div>
      )}

      <div style={S.filterBar}>
        <select style={S.select} value={fType} onChange={e => { setFType(e.target.value); setPage(1) }}>
          <option value="">All Types</option>{TEST_TYPES.map(t => <option key={t}>{t}</option>)}
        </select>
        <select style={S.select} value={fResult} onChange={e => { setFResult(e.target.value); setPage(1) }}>
          <option value="">All Results</option>
          {['Pending', 'Pass', 'Fail', 'Partial', 'Hold'].map(r => <option key={r}>{r}</option>)}
        </select>
        <input style={{ ...S.input, flex: 1 }} placeholder="Search test number, reference, or type..." value={fSearch} onChange={e => setFSearch(e.target.value)} />
        <button style={S.btnSecondary} onClick={load}>↻ Refresh</button>
      </div>

      <div style={S.tableWrap}>
        {loading ? <div style={S.loading}>Loading quality records...</div> : (
          <table style={S.table}><thead><tr style={S.thead}>
            {['Test No', 'Type', 'Reference', 'Date', 'GSM', 'Moisture', 'Burst', 'Result', 'Actions'].map(h => <th key={h} style={S.th}>{h}</th>)}
          </tr></thead><tbody>
              {rows.filter(r => !fSearch || [r.testNumber, r.testType, r.referenceType, r.referenceId, r.result].join(' ').toLowerCase().includes(fSearch.toLowerCase())).length === 0 && <tr><td colSpan={9} style={S.empty}>No quality tests found</td></tr>}
              {rows.filter(r => !fSearch || [r.testNumber, r.testType, r.referenceType, r.referenceId, r.result].join(' ').toLowerCase().includes(fSearch.toLowerCase())).map(r => (
                <tr key={r.id} style={S.tr}>
                  <td style={S.td}><span style={S.code}>{r.testNumber}</span></td>
                  <td style={S.td}><span style={S.muted}>{r.testType}</span></td>
                  <td style={S.td}><span style={{ fontWeight: 600, color: '#0369a1' }}>{r.referenceType || '—'} #{r.referenceId || ''}</span></td>
                  <td style={S.td}><span style={S.muted}>{r.testDate?.slice(0, 10)}</span></td>
                  <td style={S.td}>{r.gsm || '—'}</td>
                  <td style={S.td}>{r.moisturePct != null ? `${r.moisturePct}%` : '—'}</td>
                  <td style={S.td}>{r.burstFactor || '—'}</td>
                  <td style={S.td}><span style={{ ...S.badge, background: (RESULT_COLOR[r.result] || '#8a8a90') + '22', color: RESULT_COLOR[r.result] || '#8a8a90', border: `1px solid ${(RESULT_COLOR[r.result] || '#8a8a90')}44` }}>{r.result}</span></td>
                  <td style={S.td}>
                    {r.result === 'Pending' && <>
                      <button style={S.btnIcon} onClick={() => action(r.id, 'pass')} title="Pass & Approve">✅</button>
                      <button style={S.btnIcon} onClick={() => action(r.id, 'fail')} title="Fail / Reject">❌</button>
                    </>}
                    <button style={S.btnIcon} onClick={() => openEdit(r)} title="Edit measurements">✎</button>
                  </td>
                </tr>
              ))}
            </tbody></table>
        )}
      </div>

      <div style={S.pagination}>
        <span style={S.count}>Showing {rows.length} of {total}</span>
        <div style={{ display: 'flex', gap: 6 }}>
          <button style={S.pgBtn} disabled={page === 1} onClick={() => setPage(p => p - 1)}>‹ Prev</button>
          <span style={S.pgInfo}>{page}/{totalPages || 1}</span>
          <button style={S.pgBtn} disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next ›</button>
        </div>
      </div>

      {modal && (
        <div style={S.overlay} onClick={() => setModal(false)}>
          <div style={{ ...S.modal, maxWidth: 700 }} onClick={e => e.stopPropagation()}>
            <div style={S.modalHeader}><div style={S.modalTitle}>{form.id ? 'Edit' : 'Log'} QC Test</div><button style={S.close} onClick={() => setModal(false)}>✕</button></div>
            <form onSubmit={save} style={S.form}>
              <div style={S.grid2}>
                <label style={S.label}>Test Type *
                  <select style={S.select} value={form.test_type} onChange={e => setForm(f => ({ ...f, test_type: e.target.value }))}>
                    {TEST_TYPES.map(t => <option key={t}>{t}</option>)}
                  </select>
                </label>
                <label style={S.label}>Reference Type
                  <select style={S.select} value={form.reference_type} onChange={e => setForm(f => ({ ...f, reference_type: e.target.value }))}>
                    <option value="">None</option>{REF_TYPES.map(t => <option key={t}>{t}</option>)}
                  </select>
                </label>
                {F('reference_id', 'Reference ID (Reel/GRN ID)', 'number')}
                <label style={S.label}>Result {form.id && <span style={S.muted}>(use ✅/❌ buttons to change)</span>}
                  <select style={S.select} value={form.result} disabled={!!form.id} onChange={e => setForm(f => ({ ...f, result: e.target.value }))}>
                    {['Pending', 'Pass', 'Fail', 'Partial', 'Hold'].map(r => <option key={r}>{r}</option>)}
                  </select>
                </label>
              </div>
              <div style={{ fontWeight: 600, color: '#a0a0a6', fontSize: 12, marginTop: 4 }}>PAPER & MATERIAL PARAMETERS</div>
              <div style={S.grid3}>
                {F('gsm', 'GSM', 'number')}
                {F('moisture_pct', 'Moisture %', 'number')}
                {F('caliper_micron', 'Caliper (μm)', 'number')}
                {F('burst_factor', 'Burst Factor', 'number')}
                {F('cobb_value', 'Cobb Value', 'number')}
                {F('brightness_pct', 'Brightness %', 'number')}
                {F('thickness_micron', 'Thickness (μm)', 'number')}
                {F('width_mm', 'Width (mm)', 'number')}
                {F('weight_kg', 'Weight (kg)', 'number')}
                {F('tensile_strength', 'Tensile Strength', 'number')}
                {F('tear_strength', 'Tear Strength', 'number')}
              </div>
              <label style={S.label}>Remarks<textarea style={{ ...S.input, height: 60, resize: 'vertical' }} value={form.remarks} onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))} /></label>
              {err && <div style={S.error}>{err}</div>}
              <div style={S.modalFooter}>
                <button type="button" style={S.btnSecondary} onClick={() => setModal(false)}>Cancel</button>
                <button type="submit" style={S.btnPrimary} disabled={saving}>{saving ? 'Saving...' : form.id ? 'Update Test' : 'Save Test'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* GRN Usage Decision Modal */}
      {grnInspectModal && selectedGrn && (
        <div style={S.overlay} onClick={() => setGrnInspectModal(false)}>
          <div style={{ ...S.modal, maxWidth: 680 }} onClick={e => e.stopPropagation()}>
            <div style={S.modalHeader}>
              <div>
                <div style={S.modalTitle}>Incoming GRN Quality Inspection & Usage Decision</div>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>GRN: <b>{selectedGrn.grnNumber}</b> | Vendor: {selectedGrn.vendorName} | PO: {selectedGrn.poNumber || 'Direct'}</div>
              </div>
              <button style={S.close} onClick={() => setGrnInspectModal(false)}>✕</button>
            </div>

            <form onSubmit={submitGrnInspection} style={S.form}>
              <div style={S.grid2}>
                <div>
                  <label style={S.label}>Overall Quality Decision</label>
                  <select style={S.select} value={inspectResult} onChange={e => setInspectResult(e.target.value)}>
                    <option value="Pass">Pass (100% Accepted to Store)</option>
                    <option value="Partial">Partial (Accept & Reject Split)</option>
                    <option value="Fail">Fail (100% Rejected to RTV)</option>
                  </select>
                </div>
                <div>
                  <label style={S.label}>Inspection Remarks</label>
                  <input style={S.input} value={inspectRemarks} onChange={e => setInspectRemarks(e.target.value)} />
                </div>
              </div>

              <div style={{ marginTop: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#1b1b1d', marginBottom: 8 }}>Line Item Acceptance & Rejection Breakdown</div>
                {inspectItems.map((it, idx) => (
                  <div key={idx} style={{ background: '#f8fafc', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, fontSize: 13 }}>
                      <span>Item #{idx + 1}: {it.materialName}</span>
                    </div>
                    <div style={S.grid3}>
                      <div>
                        <label style={{ fontSize: 11, color: '#64748b' }}>Accepted Qty (Store Stock)</label>
                        <input
                          style={S.input}
                          type="number"
                          step="any"
                          value={it.acceptedQty}
                          onChange={e => {
                            const val = parseFloat(e.target.value) || 0
                            const next = [...inspectItems]
                            next[idx].acceptedQty = val
                            setInspectItems(next)
                          }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: 11, color: '#dc2626' }}>Rejected Qty (RTV Debit)</label>
                        <input
                          style={S.input}
                          type="number"
                          step="any"
                          value={it.rejectedQty}
                          onChange={e => {
                            const val = parseFloat(e.target.value) || 0
                            const next = [...inspectItems]
                            next[idx].rejectedQty = val
                            setInspectItems(next)
                          }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: 11, color: '#64748b' }}>Action for Rejected</label>
                        <select
                          style={S.select}
                          value={it.actionRequired}
                          onChange={e => {
                            const next = [...inspectItems]
                            next[idx].actionRequired = e.target.value
                            setInspectItems(next)
                          }}
                        >
                          <option value="Return to Vendor">Return to Vendor (RTV)</option>
                          <option value="Supplier Rework">Supplier Rework</option>
                          <option value="Scrap On Site">Scrap On Site</option>
                        </select>
                      </div>
                    </div>
                    {parseFloat(it.rejectedQty) > 0 && (
                      <div>
                        <label style={{ fontSize: 11, color: '#dc2626', fontWeight: 600 }}>Rejection Reason (For Rejection Note & Debit Note)</label>
                        <input
                          style={{ ...S.input, borderColor: '#fca5a5' }}
                          placeholder="e.g. Moisture > 12%, Burst factor below specification, Off-spec caliper"
                          value={it.rejectionReason}
                          onChange={e => {
                            const next = [...inspectItems]
                            next[idx].rejectionReason = e.target.value
                            setInspectItems(next)
                          }}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div style={S.modalFooter}>
                <button type="button" style={S.btnSecondary} onClick={() => setGrnInspectModal(false)}>Cancel</button>
                <button type="submit" style={{ ...S.btnPrimary, background: '#0284c7' }} disabled={saving}>
                  {saving ? 'Processing Decision...' : 'Confirm Usage Decision & Release Stock'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
const S = { page: { padding: 24, background: '#f6f5f0', minHeight: '100vh', color: '#1b1b1d' }, header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }, title: { fontSize: 22, fontWeight: 700, color: '#1b1b1d' }, sub: { fontSize: 13, color: '#8a8a90', marginTop: 2 }, filterBar: { display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }, tableWrap: { background: '#ffffff', borderRadius: 10, overflow: 'auto', border: '1px solid #e7e6df' }, table: { width: '100%', borderCollapse: 'collapse', fontSize: 13 }, thead: { background: '#f6f5f0' }, th: { padding: '10px 14px', textAlign: 'left', color: '#8a8a90', fontWeight: 600, fontSize: 12, textTransform: 'uppercase', borderBottom: '1px solid #e7e6df', whiteSpace: 'nowrap' }, tr: { borderBottom: '1px solid #f1efe8' }, td: { padding: '10px 14px', verticalAlign: 'middle' }, muted: { color: '#a0a0a6', fontSize: 12 }, code: { fontFamily: 'monospace', background: '#f6f5f0', padding: '2px 6px', borderRadius: 4, fontSize: 11, color: '#a0a0a6' }, badge: { fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20, display: 'inline-block' }, btnIcon: { background: 'none', border: 'none', cursor: 'pointer', fontSize: 14 }, empty: { padding: 40, textAlign: 'center', color: '#8a8a90' }, loading: { padding: 40, textAlign: 'center', color: '#8a8a90' }, pagination: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }, count: { fontSize: 12, color: '#8a8a90' }, pgBtn: { background: '#ffffff', border: '1px solid #e7e6df', color: '#1b1b1d', borderRadius: 6, padding: '5px 12px', cursor: 'pointer', fontSize: 12 }, pgInfo: { fontSize: 12, color: '#a0a0a6', padding: '5px 8px' }, overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }, modal: { background: '#ffffff', borderRadius: 12, padding: 24, width: '100%', border: '1px solid #e7e6df', maxHeight: '90vh', overflowY: 'auto' }, modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }, modalTitle: { fontSize: 16, fontWeight: 700, color: '#1b1b1d' }, close: { background: 'none', border: 'none', color: '#a0a0a6', fontSize: 18, cursor: 'pointer' }, form: { display: 'flex', flexDirection: 'column', gap: 14 }, grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }, grid3: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }, label: { display: 'flex', flexDirection: 'column', gap: 5, fontSize: 12, color: '#a0a0a6', fontWeight: 600 }, input: { background: '#f6f5f0', border: '1px solid #e7e6df', borderRadius: 6, padding: '8px 10px', color: '#1b1b1d', fontSize: 13, outline: 'none' }, select: { background: '#f6f5f0', border: '1px solid #e7e6df', borderRadius: 6, padding: '8px 10px', color: '#1b1b1d', fontSize: 13 }, error: { background: '#ef444422', border: '1px solid #ef444444', color: '#f87171', padding: '8px 12px', borderRadius: 6, fontSize: 13 }, modalFooter: { display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }, btnPrimary: { background: '#1b1b1d', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 18px', fontWeight: 600, fontSize: 13, cursor: 'pointer' }, btnSecondary: { background: '#e7e6df', color: '#1b1b1d', border: 'none', borderRadius: 8, padding: '8px 18px', fontWeight: 600, fontSize: 13, cursor: 'pointer' } }
