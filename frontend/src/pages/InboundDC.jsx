import React, { useState, useEffect, useCallback } from 'react'
import SearchableSelect from '../components/SearchableSelect'
import { useToast } from '../context/ToastContext'

const API = '/api'
const h = () => ({ Authorization: `Bearer ${localStorage.getItem('mk_token')}` })
const json = () => ({ ...h(), 'Content-Type': 'application/json' })

const TABS = [
  { key: 'receive', label: 'Receive DC' },
  { key: 'pending', label: 'Pending Invoice Match' },
  { key: 'ready', label: 'Matched — Ready for GRN' },
]

const btnStyle = {
  padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
  background: '#18181b', color: '#f4c84b', fontSize: 13, fontWeight: 700,
}
const inputStyle = {
  width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #d4d4d8',
  fontSize: 13, boxSizing: 'border-box',
}
const cardStyle = {
  background: '#fff', border: '1px solid #e4e4e7', borderRadius: 12, padding: 20, marginBottom: 20,
}
const thStyle = { textAlign: 'left', padding: '10px 12px', fontSize: 12, color: '#71717a', fontWeight: 700, borderBottom: '1px solid #e4e4e7' }
const tdStyle = { padding: '10px 12px', fontSize: 13, borderBottom: '1px solid #f4f4f5' }

export default function InboundDC() {
  const { addToast } = useToast()
  const [tab, setTab] = useState('receive')
  const [vendors, setVendors] = useState([])
  const [materials, setMaterials] = useState([])
  const [pendingList, setPendingList] = useState([])
  const [readyList, setReadyList] = useState([])
  const [loading, setLoading] = useState(false)

  const [form, setForm] = useState({
    vendor_id: '', dc_no: '', dc_date: new Date().toISOString().slice(0, 10),
    vehicle_number: '', remarks: '',
    items: [{ material_id: '', qty: '', unit: '', batch_no: '' }],
  })

  const [matchModal, setMatchModal] = useState(null) // { id, invoice_number, invoice_date, party_name_confirmed }

  const notify = (r, okMsg) => {
    if (r && r.success) addToast(okMsg || r.message || 'Done', 'success')
    else addToast((r && r.message) || 'Something went wrong', 'error')
    return !!(r && r.success)
  }

  const loadLookups = useCallback(() => {
    fetch(`${API}/purchase/vendors`, { headers: h() }).then(r => r.json()).then(r => { if (r.success) setVendors(r.data || []) })
    fetch(`${API}/master/materials?limit=5000`, { headers: h() }).then(r => r.json()).then(r => { if (r.success) setMaterials(r.data || []) })
  }, [])

  const loadPending = useCallback(() => {
    setLoading(true)
    fetch(`${API}/inbound-dc?status=received`, { headers: h() }).then(r => r.json())
      .then(r => setPendingList(r.success ? (r.data || []) : []))
      .finally(() => setLoading(false))
  }, [])

  const loadReady = useCallback(() => {
    setLoading(true)
    fetch(`${API}/inbound-dc?status=invoice_matched`, { headers: h() }).then(r => r.json())
      .then(r => setReadyList(r.success ? (r.data || []) : []))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { loadLookups() }, [loadLookups])
  useEffect(() => {
    if (tab === 'pending') loadPending()
    if (tab === 'ready') loadReady()
  }, [tab, loadPending, loadReady])

  const addItemRow = () => setForm(f => ({ ...f, items: [...f.items, { material_id: '', qty: '', unit: '', batch_no: '' }] }))
  const removeItemRow = (idx) => setForm(f => ({ ...f, items: f.items.filter((_, i) => i !== idx) }))
  const updateItemRow = (idx, key, val) => setForm(f => ({ ...f, items: f.items.map((it, i) => i === idx ? { ...it, [key]: val } : it) }))

  const submitReceive = async (e) => {
    e.preventDefault()
    const items = form.items.filter(it => it.material_id && Number(it.qty) > 0)
    if (!items.length) { addToast('Add at least one item with material and quantity', 'error'); return }
    const res = await fetch(`${API}/inbound-dc`, {
      method: 'POST', headers: json(),
      body: JSON.stringify({ ...form, items }),
    }).then(r => r.json())
    if (notify(res, 'Inbound DC received and stock updated provisionally')) {
      setForm({
        vendor_id: '', dc_no: '', dc_date: new Date().toISOString().slice(0, 10),
        vehicle_number: '', remarks: '',
        items: [{ material_id: '', qty: '', unit: '', batch_no: '' }],
      })
      setTab('pending')
    }
  }

  const submitMatch = async () => {
    if (!matchModal) return
    const res = await fetch(`${API}/inbound-dc/${matchModal.id}/match-invoice`, {
      method: 'POST', headers: json(),
      body: JSON.stringify({
        invoice_number: matchModal.invoice_number,
        invoice_date: matchModal.invoice_date,
        party_name_confirmed: matchModal.party_name_confirmed,
      }),
    }).then(r => r.json())
    if (notify(res, 'Invoice matched')) {
      setMatchModal(null)
      loadPending()
    }
  }

  const createGrn = async (id) => {
    if (!window.confirm('Create GRN from this matched Inbound DC?')) return
    const res = await fetch(`${API}/inbound-dc/${id}/grn`, { method: 'POST', headers: json() }).then(r => r.json())
    if (notify(res, res && res.message)) loadReady()
  }

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 4 }}>Inbound Delivery Challan</h2>
      <div style={{ color: '#71717a', fontSize: 13, marginBottom: 20 }}>
        Receive goods into stock before the vendor invoice arrives, match the invoice later, then formalize into a GRN.
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20, borderBottom: '1px solid #e4e4e7' }}>
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: '10px 16px', border: 'none', background: 'none', cursor: 'pointer',
              fontSize: 13, fontWeight: 700,
              color: tab === t.key ? '#18181b' : '#a1a1aa',
              borderBottom: tab === t.key ? '2px solid #f4c84b' : '2px solid transparent',
            }}
          >{t.label}</button>
        ))}
      </div>

      {tab === 'receive' && (
        <form onSubmit={submitReceive} style={cardStyle}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
            <div>
              <label style={{ fontSize: 12, color: '#71717a', display: 'block', marginBottom: 4 }}>Vendor</label>
              <SearchableSelect
                value={form.vendor_id}
                onChange={(v) => setForm(f => ({ ...f, vendor_id: v }))}
                options={vendors.map(v => ({ value: v.id, label: v.name }))}
                placeholder="-- Select Vendor --"
              />
            </div>
            <div>
              <label style={{ fontSize: 12, color: '#71717a', display: 'block', marginBottom: 4 }}>DC No (optional, auto-generated if blank)</label>
              <input style={inputStyle} value={form.dc_no} onChange={e => setForm(f => ({ ...f, dc_no: e.target.value }))} placeholder="Vendor's challan number" />
            </div>
            <div>
              <label style={{ fontSize: 12, color: '#71717a', display: 'block', marginBottom: 4 }}>DC Date</label>
              <input type="date" style={inputStyle} value={form.dc_date} onChange={e => setForm(f => ({ ...f, dc_date: e.target.value }))} />
            </div>
            <div>
              <label style={{ fontSize: 12, color: '#71717a', display: 'block', marginBottom: 4 }}>Vehicle Number</label>
              <input style={inputStyle} value={form.vehicle_number} onChange={e => setForm(f => ({ ...f, vehicle_number: e.target.value }))} />
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, color: '#71717a', display: 'block', marginBottom: 4 }}>Remarks</label>
            <input style={inputStyle} value={form.remarks} onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))} />
          </div>

          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Items</div>
          {form.items.map((it, idx) => (
            <div key={idx} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr auto', gap: 8, marginBottom: 8, alignItems: 'center' }}>
              <SearchableSelect
                value={it.material_id}
                onChange={(v) => updateItemRow(idx, 'material_id', v)}
                options={materials.map(m => ({ value: m.id, label: `${m.name}${m.code ? ' (' + m.code + ')' : ''}` }))}
                placeholder="-- Material --"
              />
              <input style={inputStyle} type="number" step="0.001" min="0" placeholder="Qty" value={it.qty} onChange={e => updateItemRow(idx, 'qty', e.target.value)} />
              <input style={inputStyle} placeholder="Unit" value={it.unit} onChange={e => updateItemRow(idx, 'unit', e.target.value)} />
              <input style={inputStyle} placeholder="Batch No" value={it.batch_no} onChange={e => updateItemRow(idx, 'batch_no', e.target.value)} />
              <button type="button" onClick={() => removeItemRow(idx)} disabled={form.items.length === 1}
                style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #e4e4e7', background: '#fff', cursor: 'pointer', color: '#dc2626' }}>✕</button>
            </div>
          ))}
          <button type="button" onClick={addItemRow} style={{ ...btnStyle, background: '#fff', color: '#18181b', border: '1px solid #d4d4d8', marginBottom: 16 }}>+ Add Item</button>

          <div>
            <button type="submit" style={btnStyle}>Submit — Receive Into Stock</button>
          </div>
        </form>
      )}

      {tab === 'pending' && (
        <div style={cardStyle}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={thStyle}>DC No</th>
                  <th style={thStyle}>Date</th>
                  <th style={thStyle}>Vendor</th>
                  <th style={thStyle}>Vehicle</th>
                  <th style={thStyle}>Items</th>
                  <th style={thStyle}></th>
                </tr>
              </thead>
              <tbody>
                {pendingList.length === 0 && !loading && (
                  <tr><td style={tdStyle} colSpan={6}>No DCs pending invoice match.</td></tr>
                )}
                {pendingList.map(d => (
                  <tr key={d.id}>
                    <td style={tdStyle}>{d.dc_no}</td>
                    <td style={tdStyle}>{d.dc_date ? String(d.dc_date).slice(0, 10) : ''}</td>
                    <td style={tdStyle}>{d.vendor_name || '—'}</td>
                    <td style={tdStyle}>{d.vehicle_number || '—'}</td>
                    <td style={tdStyle}>{d.itemCount}</td>
                    <td style={tdStyle}>
                      <button style={btnStyle} onClick={() => setMatchModal({ id: d.id, invoice_number: '', invoice_date: '', party_name_confirmed: false, dc_no: d.dc_no })}>
                        Match Invoice
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'ready' && (
        <div style={cardStyle}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={thStyle}>DC No</th>
                  <th style={thStyle}>Vendor</th>
                  <th style={thStyle}>Invoice No</th>
                  <th style={thStyle}>Invoice Date</th>
                  <th style={thStyle}>Items</th>
                  <th style={thStyle}></th>
                </tr>
              </thead>
              <tbody>
                {readyList.length === 0 && !loading && (
                  <tr><td style={tdStyle} colSpan={6}>No DCs ready for GRN.</td></tr>
                )}
                {readyList.map(d => (
                  <tr key={d.id}>
                    <td style={tdStyle}>{d.dc_no}</td>
                    <td style={tdStyle}>{d.vendor_name || '—'}</td>
                    <td style={tdStyle}>{d.invoice_number}</td>
                    <td style={tdStyle}>{d.invoice_date ? String(d.invoice_date).slice(0, 10) : ''}</td>
                    <td style={tdStyle}>{d.itemCount}</td>
                    <td style={tdStyle}>
                      <button style={btnStyle} onClick={() => createGrn(d.id)}>Create GRN</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {matchModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 24, width: 400 }}>
            <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 16 }}>Match Invoice — DC {matchModal.dc_no}</div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, color: '#71717a', display: 'block', marginBottom: 4 }}>Invoice Number</label>
              <input style={inputStyle} value={matchModal.invoice_number} onChange={e => setMatchModal(m => ({ ...m, invoice_number: e.target.value }))} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, color: '#71717a', display: 'block', marginBottom: 4 }}>Invoice Date</label>
              <input type="date" style={inputStyle} value={matchModal.invoice_date} onChange={e => setMatchModal(m => ({ ...m, invoice_date: e.target.value }))} />
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, marginBottom: 20 }}>
              <input type="checkbox" checked={matchModal.party_name_confirmed} onChange={e => setMatchModal(m => ({ ...m, party_name_confirmed: e.target.checked }))} />
              Party name on invoice matches this DC
            </label>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setMatchModal(null)} style={{ ...btnStyle, background: '#fff', color: '#18181b', border: '1px solid #d4d4d8' }}>Cancel</button>
              <button onClick={submitMatch} style={btnStyle}>Confirm Match</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
