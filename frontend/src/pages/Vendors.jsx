import React, { useState, useEffect, useCallback } from 'react'

const API = (path, opts) => fetch(path, {
  headers: { Authorization: `Bearer ${localStorage.getItem('mk_token')}`, 'Content-Type': 'application/json', ...(opts?.headers || {}) },
  ...opts,
}).then(r => r.json())

const PAYMENT_TERMS = ['Immediate', '7 days', '15 days', '30 days', '45 days', '60 days', '90 days']
const ACCOUNT_TYPES = ['Current', 'Savings', 'Cash Credit (CC)', 'Overdraft (OD)']
// Schema: code,name,gstin,pan,address,city,state,pincode,contact_person,mobile,email,payment_terms,credit_days,rating,is_active,bank_name,account_number,ifsc_code,branch_name,account_holder_name,account_type
const empty = {
  name: '', contact_person: '', mobile: '', email: '',
  address: '', city: '', state: '', pincode: '',
  gstin: '', pan: '',
  bank_name: '', account_number: '', ifsc_code: '', branch_name: '', account_holder_name: '', account_type: 'Current',
  payment_terms: '30 days', credit_days: 30, rating: 3, is_active: true
}

export default function Vendors() {
  const [vendors, setVendors] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterActive, setFilterActive] = useState('true')
  const [page, setPage] = useState(1)
  const [modal, setModal] = useState(false)
  const [detailModal, setDetailModal] = useState(null)
  const [edit, setEdit] = useState(null)
  const [form, setForm] = useState(empty)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const [tab, setTab] = useState('basic')
  const [syncing, setSyncing] = useState(false)
  const LIMIT = 20

  const load = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ page, limit: LIMIT })
    if (filterActive) params.set('is_active', filterActive)
    if (search) params.set('search', search)
    const r = await API(`/api/master/vendors?${params}`)
    if (r.success) { setVendors(r.data); setTotal(r.total) }
    setLoading(false)
  }, [page, filterActive, search])

  useEffect(() => { load() }, [load])

  const openAdd = () => { setForm(empty); setErr(''); setEdit(null); setTab('basic'); setModal(true) }
  const openEdit = v => {
    setForm({
      name: v.name,
      contact_person: v.contact_person || '',
      mobile: v.mobile || '',
      email: v.email || '',
      address: v.address || '',
      city: v.city || '',
      state: v.state || '',
      pincode: v.pincode || '',
      gstin: v.gstin || '',
      pan: v.pan || '',
      bank_name: v.bank_name || '',
      account_number: v.account_number || '',
      ifsc_code: v.ifsc_code || '',
      branch_name: v.branch_name || '',
      account_holder_name: v.account_holder_name || '',
      account_type: v.account_type || 'Current',
      payment_terms: v.payment_terms || '30 days',
      credit_days: v.credit_days || 30,
      rating: v.rating || 3,
      is_active: v.is_active ?? true
    })
    setErr('')
    setEdit(v)
    setTab('basic')
    setModal(true)
  }
  const del = async v => { if (!window.confirm(`Deactivate "${v.name}"?`)) return; await API(`/api/master/vendors/${v.id}`, { method: 'DELETE' }); load() }
  const restore = async v => { await API(`/api/master/vendors/${v.id}/restore`, { method: 'PUT' }); load() }

  // Sync from Excel: preview (dry-run) first, then only write after explicit confirm.
  const syncFromExcel = async () => {
    setSyncing(true)
    try {
      const preview = await API('/api/master/vendors/sync-excel', { method: 'POST', body: JSON.stringify({ dryRun: true }) })
      if (!preview.success) { window.alert(preview.message || 'Vendor excel sync preview failed'); return }
      const { toInsert = 0, alreadyInDb = 0, duplicatesInFile = 0 } = preview.data.totals
      if (toInsert === 0) { window.alert(`No new vendors to import. (${alreadyInDb} already in system, ${duplicatesInFile} duplicate rows in file)`); return }
      const names = preview.data.toInsert.slice(0, 10).map(v => `  • ${v.name}`).join('\n')
      const more = toInsert > 10 ? `\n  ...and ${toInsert - 10} more` : ''
      if (!window.confirm(`Import ${toInsert} new vendor(s) from Excel?\n${names}${more}\n\n(${alreadyInDb} already exist and will be skipped)`)) return
      const res = await API('/api/master/vendors/sync-excel', { method: 'POST', body: JSON.stringify({ dryRun: false }) })
      if (res.success) { window.alert(`Imported ${res.data.totals.inserted} new vendor(s).`); load() }
      else window.alert(res.message || 'Vendor excel sync failed')
    } catch (e) {
      window.alert('Vendor excel sync failed: ' + e.message)
    } finally {
      setSyncing(false)
    }
  }

  const save = async e => {
    e.preventDefault()
    if (!form.name) return setErr('Vendor name required')
    if (form.ifsc_code && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(form.ifsc_code.trim().toUpperCase())) {
      return setErr('IFSC Code must follow standard 11-character Indian banking format (e.g. HDFC0001234)')
    }
    setSaving(true); setErr('')
    const payload = {
      ...form,
      ifsc_code: form.ifsc_code ? form.ifsc_code.trim().toUpperCase() : '',
      gstin: form.gstin ? form.gstin.trim().toUpperCase() : '',
      pan: form.pan ? form.pan.trim().toUpperCase() : ''
    }
    const res = edit
      ? await API(`/api/master/vendors/${edit.id}`, { method: 'PUT', body: JSON.stringify(payload) })
      : await API('/api/master/vendors', { method: 'POST', body: JSON.stringify(payload) })
    setSaving(false)
    if (res.success) { setModal(false); load() }
    else setErr(res.message)
  }

  const F = (key, label, type = 'text', ph = '', uppercase = false) => (
    <label style={S.label}>{label}
      <input
        style={S.input}
        type={type}
        value={form[key] ?? ''}
        onChange={e => setForm(f => ({ ...f, [key]: uppercase ? e.target.value.toUpperCase() : e.target.value }))}
        placeholder={ph}
      />
    </label>
  )

  const totalPages = Math.ceil(total / LIMIT)

  return (
    <div style={S.page}>
      <div style={S.header}>
        <div>
          <div style={S.title}>Vendor Master Management</div>
          <div style={S.sub}>{total} registered suppliers · Master Records &amp; Bank Routing</div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button style={S.btnSecondary} onClick={syncFromExcel} disabled={syncing}>{syncing ? 'Syncing...' : '⇪ Sync from Excel'}</button>
          <button style={S.btnPrimary} onClick={openAdd}>+ Add Vendor</button>
        </div>
      </div>

      <div style={S.filterBar}>
        <input style={{ ...S.input, flex: 1, maxWidth: 320 }} placeholder="Search name / code / GSTIN / Bank..." value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} />
        <select style={S.select} value={filterActive} onChange={e => { setFilterActive(e.target.value); setPage(1) }}>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
          <option value="">All</option>
        </select>
        <button style={S.btnSecondary} onClick={load}>↻</button>
      </div>

      <div style={S.tableWrap}>
        {loading ? <div style={S.loading}>Loading...</div> : (
          <table style={S.table}>
            <thead>
              <tr style={S.thead}>
                {['Code', 'Name', 'Mobile & Email', 'City / State', 'GSTIN & PAN', 'Bank Details', 'Credit Days', 'Rating', 'Status', 'Actions'].map(h => (
                  <th key={h} style={S.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {vendors.length === 0 && <tr><td colSpan={10} style={S.empty}>No vendors found</td></tr>}
              {vendors.map(v => (
                <tr key={v.id} style={S.tr}>
                  <td style={S.td}><span style={S.code}>{v.code}</span></td>
                  <td style={S.td}>
                    <div style={S.name}>{v.name}</div>
                    {v.contact_person && <div style={{ fontSize: 11, color: '#64748b' }}>CP: {v.contact_person}</div>}
                  </td>
                  <td style={S.td}>
                    <div>{v.mobile || '—'}</div>
                    <div style={S.muted}>{v.email || ''}</div>
                  </td>
                  <td style={S.td}><span style={S.muted}>{v.city || '—'}{v.state ? `, ${v.state}` : ''}</span></td>
                  <td style={S.td}>
                    <div style={S.mono}>{v.gstin || '—'}</div>
                    {v.pan && <div style={{ fontSize: 11, color: '#64748b' }}>PAN: {v.pan}</div>}
                  </td>
                  <td style={S.td}>
                    {v.account_number ? (
                      <div>
                        <div style={{ fontWeight: 600, color: '#0f766e', fontSize: 12 }}>🏦 {v.bank_name || 'Bank'}</div>
                        <div style={{ fontSize: 11, fontFamily: 'monospace', color: '#475569' }}>
                          A/C: ••••{String(v.account_number).slice(-4)} | {v.ifsc_code || 'IFSC'}
                        </div>
                      </div>
                    ) : (
                      <span style={{ fontSize: 11, color: '#94a3b8', fontStyle: 'italic' }}>No Bank Info</span>
                    )}
                  </td>
                  <td style={S.td}><span style={S.muted}>{v.credit_days || '—'} days</span></td>
                  <td style={S.td}><Stars n={v.rating} /></td>
                  <td style={S.td}>
                    <span style={{ ...S.badge, background: v.is_active ? '#22c55e22' : '#ef444422', color: v.is_active ? '#22c55e' : '#ef4444', border: `1px solid ${v.is_active ? '#22c55e44' : '#ef444444'}` }}>
                      {v.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td style={S.td}>
                    <button style={S.btnIcon} onClick={() => setDetailModal(v)} title="View Full Details">👁</button>
                    <button style={S.btnIcon} onClick={() => openEdit(v)} title="Edit">✏️</button>
                    {v.is_active
                      ? <button style={{ ...S.btnIcon, color: '#ef4444' }} onClick={() => del(v)} title="Deactivate">🗑️</button>
                      : <button style={{ ...S.btnIcon, color: '#22c55e' }} onClick={() => restore(v)} title="Restore">♻️</button>
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <div style={S.pagination}>
        <span style={S.count}>Showing {vendors.length} of {total}</span>
        <div style={{ display: 'flex', gap: 6 }}>
          <button style={S.pgBtn} disabled={page === 1} onClick={() => setPage(p => p - 1)}>‹ Prev</button>
          <span style={S.pgInfo}>{page} / {totalPages || 1}</span>
          <button style={S.pgBtn} disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next ›</button>
        </div>
      </div>

      {/* ── View Vendor Details Modal ── */}
      {detailModal && (
        <div style={S.overlay}>
          <div style={{ ...S.modal, maxWidth: 580 }} onClick={e => e.stopPropagation()}>
            <div style={S.modalHeader}>
              <div>
                <div style={S.modalTitle}>{detailModal.name}</div>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>Supplier Code: {detailModal.code}</div>
              </div>
              <button style={S.close} onClick={() => setDetailModal(null)}>✕</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, fontSize: 13 }}>
              <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#0f766e', textTransform: 'uppercase', marginBottom: 6 }}>Contact &amp; Location</div>
                <div><strong>Contact:</strong> {detailModal.contact_person || '—'} | 📞 {detailModal.mobile || '—'} | ✉️ {detailModal.email || '—'}</div>
                <div style={{ marginTop: 4 }}><strong>Address:</strong> {detailModal.address ? `${detailModal.address}, ` : ''}{detailModal.city || ''}{detailModal.state ? `, ${detailModal.state}` : ''} {detailModal.pincode ? `- ${detailModal.pincode}` : ''}</div>
              </div>
              <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#0f766e', textTransform: 'uppercase', marginBottom: 6 }}>Tax &amp; Commercial Terms</div>
                <div><strong>GSTIN:</strong> {detailModal.gstin || '—'} | <strong>PAN:</strong> {detailModal.pan || '—'}</div>
                <div style={{ marginTop: 4 }}><strong>Payment Terms:</strong> {detailModal.payment_terms || '30 days'} ({detailModal.credit_days || 30} days credit)</div>
              </div>
              <div style={{ background: '#f0fdf4', padding: 12, borderRadius: 8, border: '1px solid #bbf7d0' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#16a34a', textTransform: 'uppercase', marginBottom: 6 }}>🏦 Bank &amp; Settlement Routing (NEFT/RTGS)</div>
                {detailModal.account_number ? (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <div><strong>Beneficiary:</strong> {detailModal.account_holder_name || detailModal.name}</div>
                    <div><strong>Bank Name:</strong> {detailModal.bank_name || '—'}</div>
                    <div><strong>A/C Number:</strong> <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{detailModal.account_number}</span></div>
                    <div><strong>IFSC Code:</strong> <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{detailModal.ifsc_code || '—'}</span></div>
                    <div><strong>Branch:</strong> {detailModal.branch_name || '—'}</div>
                    <div><strong>A/C Type:</strong> {detailModal.account_type || 'Current'}</div>
                  </div>
                ) : (
                  <div style={{ color: '#64748b', fontStyle: 'italic' }}>No bank account details recorded yet. Click Edit to add banking information for AP disbursements.</div>
                )}
              </div>
            </div>
            <div style={{ marginTop: 18, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button style={S.btnSecondary} onClick={() => setDetailModal(null)}>Close</button>
              <button style={S.btnPrimary} onClick={() => { const v = detailModal; setDetailModal(null); openEdit(v); }}>Edit Vendor</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add / Edit Vendor Modal ── */}
      {modal && (
        <div style={S.overlay}>
          <div style={S.modal} onClick={e => e.stopPropagation()}>
            <div style={S.modalHeader}>
              <div style={S.modalTitle}>{edit ? `Edit Vendor: ${edit.name}` : 'Add New Vendor'}</div>
              <button style={S.close} onClick={() => setModal(false)}>✕</button>
            </div>
            {/* Tabs */}
            <div style={S.tabs}>
              {['basic', 'address', 'bank', 'terms'].map(t => (
                <button key={t} style={{ ...S.tabBtn, ...(tab === t ? S.tabActive : {}) }} onClick={() => setTab(t)}>
                  {{ basic: 'Basic Info', address: 'Address', bank: '🏦 Bank & Tax', terms: 'Terms & Rating' }[t]}
                </button>
              ))}
            </div>
            <form onSubmit={save} style={S.form}>
              {tab === 'basic' && (
                <div style={S.grid2}>
                  {F('name', 'Vendor / Supplier Name *', 'text', 'Company / Firm name')}
                  {F('contact_person', 'Contact Person', 'text', 'Mr. / Ms. Name')}
                  {F('mobile', 'Mobile Number', 'tel', '10-digit mobile')}
                  {F('email', 'Email Address', 'email', 'vendor@example.com')}
                </div>
              )}
              {tab === 'address' && (
                <>
                  <label style={S.label}>Street Address
                    <textarea style={{ ...S.input, height: 60, resize: 'vertical' }} value={form.address || ''} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="Plot/Survey No, Street, Industrial Area" />
                  </label>
                  <div style={S.grid2}>
                    {F('city', 'City', 'text', 'City / Town')}
                    {F('state', 'State', 'text', 'State (e.g. Tamil Nadu, Karnataka)')}
                    {F('pincode', 'PIN Code', 'text', '6-digit postal PIN')}
                  </div>
                </>
              )}
              {tab === 'bank' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#0f766e', textTransform: 'uppercase', borderBottom: '1px solid #e7e6df', paddingBottom: 4 }}>1. Statutory &amp; Tax Registration</div>
                  <div style={S.grid2}>
                    {F('gstin', 'GSTIN (15 Digits)', 'text', 'e.g. 29ABCDE1234F1Z5', true)}
                    {F('pan', 'PAN Number (10 Digits)', 'text', 'e.g. ABCDE1234F', true)}
                  </div>

                  <div style={{ fontSize: 11, fontWeight: 700, color: '#0f766e', textTransform: 'uppercase', borderBottom: '1px solid #e7e6df', paddingBottom: 4, marginTop: 6 }}>2. Banking &amp; Payout Details (for AP Settlement)</div>
                  <div style={S.grid2}>
                    {F('account_holder_name', 'Beneficiary / Account Holder Name', 'text', 'As per bank records')}
                    <label style={S.label}>Bank Name
                      <input
                        style={S.input}
                        list="bank-suggestions"
                        value={form.bank_name || ''}
                        onChange={e => setForm(f => ({ ...f, bank_name: e.target.value }))}
                        placeholder="Select or enter bank name"
                      />
                      <datalist id="bank-suggestions">
                        <option value="State Bank of India" />
                        <option value="HDFC Bank" />
                        <option value="ICICI Bank" />
                        <option value="Axis Bank" />
                        <option value="Punjab National Bank" />
                        <option value="Canara Bank" />
                        <option value="Bank of Baroda" />
                        <option value="Union Bank of India" />
                        <option value="Indian Bank" />
                        <option value="Kotak Mahindra Bank" />
                        <option value="Federal Bank" />
                      </datalist>
                    </label>
                    {F('account_number', 'Bank Account Number', 'text', 'Enter bank account number')}
                    {F('ifsc_code', 'IFSC Code (11 Characters)', 'text', 'e.g. SBIN0001234', true)}
                    {F('branch_name', 'Branch Name', 'text', 'City / Branch locality')}
                    <label style={S.label}>Account Type
                      <select style={S.select} value={form.account_type} onChange={e => setForm(f => ({ ...f, account_type: e.target.value }))}>
                        {ACCOUNT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </label>
                  </div>
                </div>
              )}
              {tab === 'terms' && (
                <div style={S.grid2}>
                  <label style={S.label}>Standard Payment Terms
                    <select style={S.select} value={form.payment_terms} onChange={e => setForm(f => ({ ...f, payment_terms: e.target.value }))}>
                      {PAYMENT_TERMS.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </label>
                  <label style={S.label}>Credit Days Allowed
                    <input style={S.input} type="number" min="0" value={form.credit_days || ''} onChange={e => setForm(f => ({ ...f, credit_days: parseInt(e.target.value) || 0 }))} placeholder="30" />
                  </label>
                  <label style={S.label}>Vendor Rating (1-5 Stars)
                    <select style={S.select} value={form.rating} onChange={e => setForm(f => ({ ...f, rating: parseInt(e.target.value) }))}>
                      {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{'★'.repeat(n)} ({n})</option>)}
                    </select>
                  </label>
                  <label style={{ ...S.label, flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 22 }}>
                    <input type="checkbox" checked={form.is_active} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} />
                    <span style={{ fontWeight: 600, color: '#1b1b1d' }}>Active Supplier</span>
                  </label>
                </div>
              )}
              {err && <div style={S.error}>{err}</div>}
              <div style={S.modalFooter}>
                <button type="button" style={S.btnSecondary} onClick={() => setModal(false)}>Cancel</button>
                <button type="submit" style={S.btnPrimary} disabled={saving}>{saving ? 'Saving...' : (edit ? 'Save Changes' : 'Add Vendor')}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

function Stars({ n }) {
  return <span style={{ color: '#eab308', fontSize: 14 }}>{'★'.repeat(n || 0)}{'☆'.repeat(5 - (n || 0))}</span>
}

const S = {
  page: { padding: 24, background: '#f6f5f0', minHeight: '100vh', color: '#1b1b1d' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  title: { fontSize: 22, fontWeight: 700, color: '#1b1b1d' },
  sub: { fontSize: 13, color: '#8a8a90', marginTop: 2 },
  filterBar: { display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' },
  tableWrap: { background: '#ffffff', borderRadius: 10, overflow: 'auto', border: '1px solid #e7e6df' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  thead: { background: '#f6f5f0' },
  th: { padding: '10px 14px', textAlign: 'left', color: '#8a8a90', fontWeight: 600, fontSize: 12, textTransform: 'uppercase', borderBottom: '1px solid #e7e6df', whiteSpace: 'nowrap' },
  tr: { borderBottom: '1px solid #f1efe8' },
  td: { padding: '10px 14px', verticalAlign: 'middle' },
  name: { fontWeight: 600, color: '#1b1b1d' },
  muted: { color: '#a0a0a6', fontSize: 12 },
  mono: { fontFamily: 'monospace', fontSize: 12, color: '#a0a0a6' },
  code: { fontFamily: 'monospace', background: '#f6f5f0', padding: '2px 6px', borderRadius: 4, fontSize: 11, color: '#a0a0a6' },
  badge: { fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20, display: 'inline-block' },
  btnIcon: { background: 'none', border: 'none', cursor: 'pointer', fontSize: 14 },
  empty: { padding: 40, textAlign: 'center', color: '#8a8a90' },
  loading: { padding: 40, textAlign: 'center', color: '#8a8a90' },
  pagination: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 },
  count: { fontSize: 12, color: '#8a8a90' },
  pgBtn: { background: '#ffffff', border: '1px solid #e7e6df', color: '#1b1b1d', borderRadius: 6, padding: '5px 12px', cursor: 'pointer', fontSize: 12 },
  pgInfo: { fontSize: 12, color: '#a0a0a6', padding: '5px 8px' },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modal: { background: '#ffffff', borderRadius: 12, padding: 24, width: '100%', maxWidth: 640, border: '1px solid #e7e6df', maxHeight: '90vh', overflowY: 'auto' },
  modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 16, fontWeight: 700, color: '#1b1b1d' },
  close: { background: 'none', border: 'none', color: '#a0a0a6', fontSize: 18, cursor: 'pointer' },
  tabs: { display: 'flex', gap: 4, marginBottom: 16, borderBottom: '1px solid #e7e6df', paddingBottom: 0 },
  tabBtn: { background: 'none', border: 'none', color: '#8a8a90', padding: '8px 14px', cursor: 'pointer', fontSize: 13, fontWeight: 500, borderBottom: '2px solid transparent', marginBottom: -1 },
  tabActive: { color: '#1b1b1d', borderBottom: '2px solid #1b1b1d' },
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
