import React, { useState, useEffect } from 'react'

const API = async (p, o = {}) => {
  try {
    const res = await fetch(p, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('mk_token')}`,
        'Content-Type': 'application/json',
        ...(o?.headers || {})
      },
      ...o
    })
    try {
      return await res.json()
    } catch {
      return { success: false, message: `Server error (HTTP ${res.status})` }
    }
  } catch (err) {
    return { success: false, message: 'Network connection error' }
  }
}

const fmt = v => v != null ? `₹${Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'

export default function Finance() {
  const [tab, setTab] = useState('summary')
  const [summary, setSummary] = useState(null)
  const [ar, setAr] = useState(null)
  const [ap, setAp] = useState(null)
  const [stock, setStock] = useState(null)
  const [payments, setPayments] = useState([])
  const [salesOrders, setSalesOrders] = useState([])
  
  // Vendor Bills & Disbursements
  const [vendorBills, setVendorBills] = useState([])
  const [billsSummary, setBillsSummary] = useState(null)
  const [vendorPayments, setVendorPayments] = useState([])
  const [billFilterStatus, setBillFilterStatus] = useState('')
  const [billSearch, setBillSearch] = useState('')

  // Payment Disbursal Modal State
  const [disburseModal, setDisburseModal] = useState(null)
  const [disburseForm, setDisburseForm] = useState({
    amount: '',
    payment_mode: 'Bank Transfer (NEFT/RTGS)',
    bank_name: 'HDFC Bank - Main Corporate A/c',
    reference_number: '',
    remarks: ''
  })
  const [disburseSubmitting, setDisburseSubmitting] = useState(false)
  const [disburseMsg, setDisburseMsg] = useState({ err: '', succ: '' })

  const [loading, setLoading] = useState({})
  const [searchTerm, setSearchTerm] = useState('')
  const [soSearch, setSoSearch] = useState('')
  
  // Customer Payment Form State
  const [payForm, setPayForm] = useState({
    sales_order_id: '',
    amount: '',
    payment_mode: 'Bank',
    reference_number: '',
    remarks: ''
  })
  const [submitError, setSubmitError] = useState('')
  const [submitSuccess, setSubmitSuccess] = useState('')
  const [confirmError, setConfirmError] = useState('')

  const load = async key => {
    setLoading(l => ({ ...l, [key]: true }))
    const map = {
      summary: '/api/finance/summary',
      ar: '/api/finance/ar',
      ap: '/api/finance/ap',
      stock: '/api/finance/stock-valuation',
      payments: '/api/finance/payments',
      vendor_bills: `/api/finance/bills?limit=100${billFilterStatus ? `&status=${billFilterStatus}` : ''}`,
      vendor_payments: '/api/finance/payments/vendor?limit=100'
    }
    const r = await API(map[key])
    if (key === 'summary' && r.success) setSummary(r.data)
    if (key === 'ar' && r.success) setAr(r.data)
    if (key === 'ap' && r.success) setAp(r.data)
    if (key === 'stock' && r.success) setStock(r.data)
    if (key === 'payments' && r.success) setPayments(r.data)
    if (key === 'vendor_bills' && r.success) {
      setVendorBills(r.data)
      if (r.summary) setBillsSummary(r.summary)
    }
    if (key === 'vendor_payments' && r.success) setVendorPayments(r.data)
    setLoading(l => ({ ...l, [key]: false }))
  }

  const loadSalesOrders = async () => {
    const r = await API('/api/sales/orders?limit=200')
    if (r.success) {
      setSalesOrders(r.data)
    }
  }

  useEffect(() => {
    load('summary')
  }, [])

  useEffect(() => {
    if (tab === 'ar') load('ar')
    if (tab === 'ap') load('ap')
    if (tab === 'stock') load('stock')
    if (tab === 'payments') {
      load('payments')
      loadSalesOrders()
    }
    if (tab === 'vendor_bills') load('vendor_bills')
    if (tab === 'vendor_payments') load('vendor_payments')
  }, [tab, billFilterStatus])

  const handleApproveBill = async (id) => {
    if (!window.confirm('Approve this vendor bill for payment clearance?')) return
    const r = await API(`/api/finance/bills/${id}/approve`, { method: 'PUT' })
    if (r.success) {
      load('vendor_bills')
      load('summary')
    } else {
      alert(r.message || 'Failed to approve bill')
    }
  }

  const openDisburseModal = (bill) => {
    setDisburseModal(bill)
    setDisburseForm({
      amount: String(bill.balanceAmount || bill.totalAmount || ''),
      payment_mode: 'Bank Transfer (NEFT/RTGS)',
      bank_name: 'HDFC Bank - Corporate A/c',
      reference_number: '',
      remarks: `Payment for Bill ${bill.billNumber} (Inv ${bill.vendorInvoiceNumber})`
    })
    setDisburseMsg({ err: '', succ: '' })
  }

  const handleDisbursePayment = async (e) => {
    e.preventDefault()
    setDisburseMsg({ err: '', succ: '' })
    if (!disburseForm.amount || Number(disburseForm.amount) <= 0) {
      setDisburseMsg({ err: 'Valid payment amount is required', succ: '' })
      return
    }

    setDisburseSubmitting(true)
    const r = await API('/api/finance/payments/vendor', {
      method: 'POST',
      body: JSON.stringify({
        bill_id: disburseModal.id,
        vendor_id: disburseModal.vendorId,
        po_id: disburseModal.poId,
        amount: parseFloat(disburseForm.amount),
        payment_mode: disburseForm.payment_mode,
        bank_name: disburseForm.bank_name,
        reference_number: disburseForm.reference_number,
        remarks: disburseForm.remarks
      })
    })
    setDisburseSubmitting(false)

    if (r.success) {
      setDisburseMsg({ err: '', succ: r.message || 'Payment successfully disbursed!' })
      setTimeout(() => {
        setDisburseModal(null)
        load('vendor_bills')
        load('ap')
        load('summary')
      }, 1200)
    } else {
      setDisburseMsg({ err: r.message || 'Failed to disburse payment', succ: '' })
    }
  }

  const handlePaymentSubmit = async e => {
    e.preventDefault()
    setSubmitError('')
    setSubmitSuccess('')
    if (!payForm.sales_order_id || !payForm.amount) {
      setSubmitError('Order and amount are required')
      return
    }

    const r = await API('/api/finance/payments', {
      method: 'POST',
      body: JSON.stringify({
        sales_order_id: parseInt(payForm.sales_order_id),
        amount: parseFloat(payForm.amount),
        payment_mode: payForm.payment_mode,
        reference_number: payForm.reference_number,
        remarks: payForm.remarks
      })
    })

    if (r.success) {
      setSubmitSuccess('Payment successfully recorded!')
      setPayForm({
        sales_order_id: '',
        amount: '',
        payment_mode: 'Bank',
        reference_number: '',
        remarks: ''
      })
      load('payments')
    } else {
      setSubmitError(r.message || 'Failed to submit payment')
    }
  }

  const handleConfirmPayment = async id => {
    setConfirmError('')
    const r = await API(`/api/finance/payments/${id}/confirm`, { method: 'PUT' })
    if (r.success) {
      load('payments')
    } else {
      setConfirmError(r.message || 'Failed to confirm payment')
    }
  }

  const getBillStatusBadge = (status) => {
    const bgMap = {
      'Pending Approval': '#fef3c7',
      'Approved': '#e0f2fe',
      'Partially Paid': '#ffedd5',
      'Paid': '#dcfce7',
      'Cancelled': '#f1f5f9'
    }
    const colMap = {
      'Pending Approval': '#b45309',
      'Approved': '#0369a1',
      'Partially Paid': '#c2410c',
      'Paid': '#15803d',
      'Cancelled': '#64748b'
    }
    return (
      <span style={{
        background: bgMap[status] || '#f1f5f9',
        color: colMap[status] || '#475569',
        padding: '3px 8px',
        borderRadius: 12,
        fontSize: 11,
        fontWeight: 600
      }}>
        {status}
      </span>
    )
  }

  return (
    <div style={S.page}>
      <div style={S.header}>
        <div>
          <div style={S.title}>Finance & Accounts Management</div>
          <div style={S.sub}>Accounts Payable (AP) · Vendor Bills · Disbursements · Customer Receivables (AR) · Stock Valuation</div>
        </div>
      </div>

      {summary && (
        <div style={S.kpiGrid}>
          <KPI label="Month Revenue" val={fmt(summary.monthRevenue)} color="#22c55e" />
          <KPI label="Month Purchases" val={fmt(summary.monthSpend)} color="#ef4444" />
          <KPI label="Accounts Payable (AP)" val={fmt(summary.totalAccountsPayable)} color="#f97316" />
          <KPI label="Gross Margin" val={fmt(summary.grossMargin)} color={summary.grossMargin >= 0 ? '#22c55e' : '#ef4444'} />
          <KPI label="Live Stock Valuation" val={fmt(summary.stockValue)} color="#1b1b1d" />
        </div>
      )}

      <div style={S.tabs}>
        {[
          ['summary', 'Overview'],
          ['vendor_bills', '🧾 Vendor Bills & AP Clearance'],
          ['vendor_payments', '💳 Vendor Disbursements'],
          ['ap', 'Payables (AP) Ledger'],
          ['ar', 'Receivables (AR)'],
          ['payments', 'Customer Collections'],
          ['stock', 'Stock Valuation']
        ].map(([k, l]) => (
          <button key={k} style={{ ...S.tabBtn, ...(tab === k ? S.tabActive : {}) }} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>

      {/* ── 1. OVERVIEW ── */}
      {tab === 'summary' && summary && (
        <div style={S.section}>
          <div style={S.sTitle}>Month-to-Date Performance</div>
          <div style={S.grid2}>
            <InfoCard label="Total Revenue" val={fmt(summary.monthRevenue)} sub="From verified sales orders" />
            <InfoCard label="Total Purchases" val={fmt(summary.monthSpend)} sub="From approved purchase orders" />
            <InfoCard label="Accounts Payable Balance" val={fmt(summary.totalAccountsPayable)} sub="Outstanding Vendor Bills awaiting payment" />
            <InfoCard label="Gross Margin" val={fmt(summary.grossMargin)} sub="Revenue minus purchase spend" />
            <InfoCard label="Inventory Valuation" val={fmt(summary.stockValue)} sub="Current stock × unit price (Live PostgreSQL)" />
          </div>
        </div>
      )}

      {/* ── 2. VENDOR BILLS & AP CLEARANCE ── */}
      {tab === 'vendor_bills' && (
        <div>
          {billsSummary && (
            <div style={S.kpiGrid}>
              <KPI label="Total Billed" val={fmt(billsSummary.totalBillAmount)} color="#1b1b1d" />
              <KPI label="Total Paid" val={fmt(billsSummary.totalPaidAmount)} color="#22c55e" />
              <KPI label="Outstanding Balance" val={fmt(billsSummary.totalBalanceAmount)} color="#ef4444" />
            </div>
          )}

          <div style={S.tableWrap}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid #e7e6df', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <input
                style={{ ...S.input, maxWidth: 300, background: '#fff' }}
                placeholder="🔍 Search Bill No, Invoice, Vendor, PO, GRN..."
                value={billSearch}
                onChange={e => setBillSearch(e.target.value)}
              />
              <select
                style={{ ...S.input, maxWidth: 200, background: '#fff' }}
                value={billFilterStatus}
                onChange={e => setBillFilterStatus(e.target.value)}
              >
                <option value="">All Statuses</option>
                <option value="Pending Approval">Pending Approval</option>
                <option value="Approved">Approved for Payment</option>
                <option value="Partially Paid">Partially Paid</option>
                <option value="Paid">Fully Paid</option>
              </select>
              <button style={{ ...S.btn, width: 'auto', padding: '8px 14px', marginTop: 0 }} onClick={() => load('vendor_bills')}>
                🔄 Refresh Bills
              </button>
            </div>

            {loading.vendor_bills ? <div style={S.loading}>Loading vendor bills...</div> : (
              <table style={S.table}>
                <thead>
                  <tr style={S.thead}>
                    {['Bill Number', 'Vendor & Invoice No', 'PO & GRN Ref', 'Invoice Date', 'Total Amount', 'Paid Amount', 'Balance Due', 'Status', 'Actions'].map(h => (
                      <th key={h} style={S.th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {vendorBills.filter(b => !billSearch || (b.billNumber||'').toLowerCase().includes(billSearch.toLowerCase()) || (b.vendorName||'').toLowerCase().includes(billSearch.toLowerCase()) || (b.vendorInvoiceNumber||'').toLowerCase().includes(billSearch.toLowerCase()) || (b.poNumber||'').toLowerCase().includes(billSearch.toLowerCase()) || (b.grnNumber||'').toLowerCase().includes(billSearch.toLowerCase())).map(b => (
                    <tr key={b.id} style={S.tr}>
                      <td style={S.td}>
                        <span style={S.code}>{b.billNumber}</span>
                      </td>
                      <td style={S.td}>
                        <div style={{ fontWeight: 600, color: '#1b1b1d' }}>{b.vendorName}</div>
                        <div style={{ fontSize: 11, color: '#64748b' }}>Inv: <strong>{b.vendorInvoiceNumber}</strong> {b.vendorGstin ? `(${b.vendorGstin})` : ''}</div>
                      </td>
                      <td style={S.td}>
                        <div style={{ fontSize: 12 }}>{b.poNumber ? <span style={{ color: '#0369a1', fontWeight: 600 }}>{b.poNumber}</span> : '—'}</div>
                        <div style={{ fontSize: 11, color: '#16a34a' }}>{b.grnNumber ? `GRN: ${b.grnNumber}` : ''}</div>
                      </td>
                      <td style={S.td}>
                        <div>{new Date(b.invoiceDate).toLocaleDateString('en-IN')}</div>
                        {b.dueDate && <div style={{ fontSize: 11, color: '#dc2626' }}>Due: {new Date(b.dueDate).toLocaleDateString('en-IN')}</div>}
                      </td>
                      <td style={S.td}>
                        <span style={{ fontWeight: 700, color: '#1b1b1d' }}>{fmt(b.totalAmount)}</span>
                        {b.totalTax > 0 && <div style={{ fontSize: 10, color: '#64748b' }}>Tax: {fmt(b.totalTax)}</div>}
                      </td>
                      <td style={S.td}>
                        <span style={{ color: '#16a34a', fontWeight: 600 }}>{fmt(b.paidAmount)}</span>
                      </td>
                      <td style={S.td}>
                        <span style={{ color: parseFloat(b.balanceAmount) > 0 ? '#dc2626' : '#16a34a', fontWeight: 700 }}>
                          {fmt(b.balanceAmount)}
                        </span>
                      </td>
                      <td style={S.td}>
                        {getBillStatusBadge(b.status)}
                      </td>
                      <td style={S.td}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          {b.status === 'Pending Approval' && (
                            <button
                              style={{ ...S.btn, width: 'auto', padding: '4px 8px', fontSize: 11, background: '#0284c7', marginTop: 0 }}
                              onClick={() => handleApproveBill(b.id)}
                            >
                              ✅ Approve
                            </button>
                          )}
                          {['Approved', 'Partially Paid'].includes(b.status) && parseFloat(b.balanceAmount) > 0 && (
                            <button
                              style={{ ...S.btn, width: 'auto', padding: '4px 8px', fontSize: 11, background: '#16a34a', marginTop: 0 }}
                              onClick={() => openDisburseModal(b)}
                            >
                              💳 Disburse Payment
                            </button>
                          )}
                          {b.status === 'Paid' && (
                            <span style={{ fontSize: 11, color: '#16a34a', fontWeight: 600 }}>✨ Settled</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {vendorBills.length === 0 && (
                    <tr>
                      <td colSpan={9} style={{ padding: 30, textAlign: 'center', color: '#8a8a90' }}>No vendor bills found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ── 3. VENDOR DISBURSEMENTS LEDGER ── */}
      {tab === 'vendor_payments' && (
        <div>
          <div style={S.tableWrap}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid #e7e6df', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontWeight: 600, color: '#1b1b1d' }}>Official Vendor Payment & Disbursement History</div>
              <button style={{ ...S.btn, width: 'auto', padding: '6px 12px', marginTop: 0 }} onClick={() => load('vendor_payments')}>
                🔄 Refresh
              </button>
            </div>
            {loading.vendor_payments ? <div style={S.loading}>Loading disbursements...</div> : (
              <table style={S.table}>
                <thead>
                  <tr style={S.thead}>
                    {['Payment Voucher No.', 'Vendor', 'Bill / Invoice Ref', 'Amount Paid', 'Payment Date', 'Payment Mode', 'Bank & UTR / Ref No.', 'Recorded By'].map(h => (
                      <th key={h} style={S.th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {vendorPayments.map(p => (
                    <tr key={p.id} style={S.tr}>
                      <td style={S.td}><span style={S.code}>{p.paymentNumber}</span></td>
                      <td style={S.td}><div style={{ fontWeight: 600, color: '#1b1b1d' }}>{p.vendorName}</div></td>
                      <td style={S.td}>
                        <div>{p.billNumber ? <span style={{ color: '#0369a1' }}>{p.billNumber}</span> : '—'}</div>
                        {p.vendorInvoiceNumber && <div style={{ fontSize: 11, color: '#64748b' }}>Inv: {p.vendorInvoiceNumber}</div>}
                      </td>
                      <td style={S.td}><span style={{ color: '#16a34a', fontWeight: 700 }}>{fmt(p.amount)}</span></td>
                      <td style={S.td}>{new Date(p.paymentDate).toLocaleDateString('en-IN')}</td>
                      <td style={S.td}><span style={S.muted}>{p.paymentMode}</span></td>
                      <td style={S.td}>
                        <div>{p.referenceNumber || '—'}</div>
                        {p.bankName && <div style={{ fontSize: 11, color: '#64748b' }}>{p.bankName}</div>}
                      </td>
                      <td style={S.td}><span style={S.muted}>{p.recordedByName || 'Finance Officer'}</span></td>
                    </tr>
                  ))}
                  {vendorPayments.length === 0 && (
                    <tr>
                      <td colSpan={8} style={{ padding: 30, textAlign: 'center', color: '#8a8a90' }}>No vendor payments recorded yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ── 4. ACCOUNTS PAYABLE (AP) ── */}
      {tab === 'ap' && (
        <div>
          {loading.ap ? <div style={S.loading}>Loading...</div> : ap && (
            <>
              <div style={S.kpiGrid}>
                <KPI label="Total Outstanding AP" val={fmt(ap.totalOutstanding)} color="#ef4444" />
                <KPI label="Total Billed" val={fmt(ap.totalBilled)} color="#1b1b1d" />
                <KPI label="Total Paid" val={fmt(ap.totalPaid)} color="#22c55e" />
              </div>
              <div style={S.tableWrap}>
                <div style={{ padding: 16, borderBottom: '1px solid #e7e6df' }}>
                  <input style={{...S.input, maxWidth: 300, background: '#fff'}} placeholder='Search vendors...' value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} />
                </div>
                <table style={S.table}>
                  <thead>
                    <tr style={S.thead}>
                      {['Code', 'Vendor', 'Credit Days', 'Bills Count', 'Billed Amount', 'Paid Amount', 'Outstanding Balance'].map(h => <th key={h} style={S.th}>{h}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {ap.vendors.filter(v => !searchTerm || (v.name||'').toLowerCase().includes(searchTerm.toLowerCase()) || (v.code||'').toLowerCase().includes(searchTerm.toLowerCase())).map(v => (
                      <tr key={v.id} style={S.tr}>
                        <td style={S.td}><span style={S.code}>{v.code}</span></td>
                        <td style={S.td}><div style={{ fontWeight: 600, color: '#1b1b1d' }}>{v.name}</div></td>
                        <td style={S.td}><span style={S.muted}>{v.creditDays || 30} days</span></td>
                        <td style={S.td}>{v.total_bills || 0}</td>
                        <td style={S.td}>{fmt(v.total_billed)}</td>
                        <td style={S.td}><span style={{ color: '#22c55e', fontWeight: 600 }}>{fmt(v.total_paid)}</span></td>
                        <td style={S.td}><span style={{ color: parseFloat(v.outstanding) > 0 ? '#ef4444' : '#22c55e', fontWeight: 700 }}>{fmt(v.outstanding)}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── 5. RECEIVABLES (AR) ── */}
      {tab === 'ar' && (
        <div>
          {loading.ar ? <div style={S.loading}>Loading...</div> : ar && (
            <>
              <div style={S.kpiGrid}>
                <KPI label="Total Outstanding" val={fmt(ar.totalOutstanding)} color="#ef4444" />
                <KPI label="Total Billed (1yr)" val={fmt(ar.totalBilled)} color="#1b1b1d" />
              </div>
              <div style={S.tableWrap}>
                <div style={{ padding: 16, borderBottom: '1px solid #e7e6df' }}>
                  <input style={{...S.input, maxWidth: 300, background: '#fff'}} placeholder='Search customers...' value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} />
                </div>
                <table style={S.table}>
                  <thead>
                    <tr style={S.thead}>
                      {['Code', 'Customer', 'Credit Limit', 'Credit Days', 'Orders', 'Billed (1yr)', 'Outstanding'].map(h => <th key={h} style={S.th}>{h}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {ar.customers.filter(c => !searchTerm || (c.name||'').toLowerCase().includes(searchTerm.toLowerCase()) || (c.code||'').toLowerCase().includes(searchTerm.toLowerCase())).map(c => (
                      <tr key={c.id} style={S.tr}>
                        <td style={S.td}><span style={S.code}>{c.code}</span></td>
                        <td style={S.td}><div style={{ fontWeight: 600, color: '#1b1b1d' }}>{c.name}</div></td>
                        <td style={S.td}>{fmt(c.creditLimit)}</td>
                        <td style={S.td}><span style={S.muted}>{c.creditDays} days</span></td>
                        <td style={S.td}>{c.total_orders}</td>
                        <td style={S.td}>{fmt(c.total_billed)}</td>
                        <td style={S.td}><span style={{ color: parseFloat(c.outstanding) > 0 ? '#ef4444' : '#22c55e', fontWeight: 600 }}>{fmt(c.outstanding)}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── 6. CUSTOMER COLLECTIONS ── */}
      {tab === 'payments' && (
        <div style={S.gridLayout}>
          <div style={S.formCard}>
            <div style={S.formTitle}>Record Customer Collection</div>
            <form onSubmit={handlePaymentSubmit}>
              {submitError && <div style={S.errorMsg}>{submitError}</div>}
              {submitSuccess && <div style={S.successMsg}>{submitSuccess}</div>}

              <div style={S.formGroup}>
                <label style={S.label}>Select Sales Order *</label>
                <input style={{...S.input, marginBottom: 4, background:'#fefce8'}} placeholder='🔍 Filter orders...' value={soSearch} onChange={e => setSoSearch(e.target.value)} />
                <select
                  style={S.input}
                  value={payForm.sales_order_id}
                  onChange={e => setPayForm({ ...payForm, sales_order_id: e.target.value })}
                  required
                >
                  <option value="">-- Select Sales Order --</option>
                  {salesOrders.filter(so => !soSearch || (so.soNumber||'').toLowerCase().includes(soSearch.toLowerCase()) || (so.customerName||'').toLowerCase().includes(soSearch.toLowerCase())).map(so => (
                    <option key={so.id} value={so.id}>
                      {so.soNumber} - {so.customerName} (Billed: {fmt(so.totalValue)} / Status: {so.status})
                    </option>
                  ))}
                </select>
              </div>

              <div style={S.formGroup}>
                <label style={S.label}>Amount Collected (₹) *</label>
                <input
                  type="number"
                  step="0.01"
                  style={S.input}
                  placeholder="e.g. 50000"
                  value={payForm.amount}
                  onChange={e => setPayForm({ ...payForm, amount: e.target.value })}
                  required
                />
              </div>

              <div style={S.formGroup}>
                <label style={S.label}>Payment Mode *</label>
                <select
                  style={S.input}
                  value={payForm.payment_mode}
                  onChange={e => setPayForm({ ...payForm, payment_mode: e.target.value })}
                  required
                >
                  {['Bank', 'Cash', 'Cheque', 'Other'].map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>

              <div style={S.formGroup}>
                <label style={S.label}>Reference Number (UTR / Cheque No.)</label>
                <input
                  type="text"
                  style={S.input}
                  placeholder="Reference/UTR string"
                  value={payForm.reference_number}
                  onChange={e => setPayForm({ ...payForm, reference_number: e.target.value })}
                />
              </div>

              <div style={S.formGroup}>
                <label style={S.label}>Remarks</label>
                <textarea
                  style={S.textarea}
                  rows={3}
                  placeholder="Payment allocation details"
                  value={payForm.remarks}
                  onChange={e => setPayForm({ ...payForm, remarks: e.target.value })}
                />
              </div>

              <button type="submit" style={S.btn}>Record Collection</button>
            </form>
          </div>

          <div style={S.historyWrap}>
            <div style={S.formTitle}>Payment Receipt Ledger</div>
            {confirmError && <div style={S.errorMsg}>{confirmError}</div>}
            {loading.payments ? <div style={S.loading}>Loading receipts...</div> : (
              <div style={S.tableWrap}>
                <table style={S.table}>
                  <thead>
                    <tr style={S.thead}>
                      {['Receipt ID', 'Order Reference', 'Customer', 'Amount', 'Date', 'Mode', 'Ref No.', 'Actions'].map(h => <th key={h} style={S.th}>{h}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {payments.length === 0 ? (
                      <tr>
                        <td colSpan={8} style={{ padding: 20, textAlign: 'center', color: '#8a8a90' }}>No payments recorded yet.</td>
                      </tr>
                    ) : payments.map(p => (
                      <tr key={p.id} style={S.tr}>
                        <td style={S.td}><span style={S.code}>{p.paymentNumber}</span></td>
                        <td style={S.td}>{p.soNumber}</td>
                        <td style={S.td}><div style={{ color: '#1b1b1d' }}>{p.customerName}</div></td>
                        <td style={S.td}><span style={{ color: '#22c55e', fontWeight: 600 }}>{fmt(p.amount)}</span></td>
                        <td style={S.td}>{new Date(p.paymentDate).toLocaleDateString('en-IN')}</td>
                        <td style={S.td}><span style={S.muted}>{p.paymentMode}</span></td>
                        <td style={S.td}>{p.referenceNumber || '—'}</td>
                        <td style={S.td}>
                          {p.status === 'Confirmed'
                            ? <span style={S.muted}>Confirmed</span>
                            : <button style={S.btnIcon} onClick={() => handleConfirmPayment(p.id)} title="Confirm">✅ Confirm</button>}
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

      {/* ── 7. STOCK VALUATION ── */}
      {tab === 'stock' && (
        <div>
          {loading.stock ? <div style={S.loading}>Loading...</div> : stock && (
            <>
              <div style={S.kpiGrid}>
                <KPI label="Total Stock Value" val={fmt(stock.totalValue)} color="#1b1b1d" />
              </div>
              <div style={S.tableWrap}>
                <table style={S.table}>
                  <thead>
                    <tr style={S.thead}>
                      {['Category', 'Type', 'Items', 'Value'].map(h => <th key={h} style={S.th}>{h}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {stock.byCategory.map((c, i) => (
                      <tr key={i} style={S.tr}>
                        <td style={S.td}>{c.category}</td>
                        <td style={S.td}><span style={S.muted}>{c.type}</span></td>
                        <td style={S.td}>{c.items}</td>
                        <td style={S.td}><span style={{ fontWeight: 600, color: '#1b1b1d' }}>{fmt(c.value)}</span></td>
                      </tr>
                    ))}
                    <tr style={{ ...S.tr, background: '#f6f5f0' }}>
                      <td style={{ ...S.td, fontWeight: 700 }} colSpan={3}>TOTAL</td>
                      <td style={{ ...S.td, fontWeight: 700, color: '#1b1b1d' }}>{fmt(stock.totalValue)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── MODAL: DISBURSE VENDOR PAYMENT ── */}
      {disburseModal && (
        <div style={S.modalOverlay}>
          <div style={S.modalBox}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#1b1b1d' }}>💳 Disburse Vendor Payment</div>
                <div style={{ fontSize: 12, color: '#64748b' }}>Bill No: {disburseModal.billNumber} | Vendor: {disburseModal.vendorName}</div>
              </div>
              <button style={S.closeBtn} onClick={() => setDisburseModal(null)}>✕</button>
            </div>

            <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8, marginBottom: 14, border: '1px solid #e2e8f0', fontSize: 13 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ color: '#64748b' }}>Vendor Invoice:</span>
                <strong>{disburseModal.vendorInvoiceNumber}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ color: '#64748b' }}>Total Bill Amount:</span>
                <strong>{fmt(disburseModal.totalAmount)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ color: '#64748b' }}>Already Paid:</span>
                <span style={{ color: '#16a34a', fontWeight: 600 }}>{fmt(disburseModal.paidAmount)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 4, borderTop: '1px dashed #cbd5e1' }}>
                <span style={{ color: '#dc2626', fontWeight: 700 }}>Outstanding Balance Due:</span>
                <span style={{ color: '#dc2626', fontWeight: 700, fontSize: 15 }}>{fmt(disburseModal.balanceAmount)}</span>
              </div>
            </div>

            {/* Vendor Beneficiary Banking Card */}
            <div style={{ background: '#f0fdf4', padding: 12, borderRadius: 8, marginBottom: 16, border: '1px solid #bbf7d0', fontSize: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#16a34a', textTransform: 'uppercase', marginBottom: 6 }}>
                🏦 Vendor Registered Beneficiary A/C Details (Master)
              </div>
              {disburseModal.vendorAccountNumber ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                  <div><span style={{ color: '#64748b' }}>Beneficiary:</span> <strong>{disburseModal.vendorAccountHolderName || disburseModal.vendorName}</strong></div>
                  <div><span style={{ color: '#64748b' }}>Bank:</span> <strong>{disburseModal.vendorBankName || '—'}</strong></div>
                  <div><span style={{ color: '#64748b' }}>A/C No:</span> <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#0f766e' }}>{disburseModal.vendorAccountNumber}</span></div>
                  <div><span style={{ color: '#64748b' }}>IFSC:</span> <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#0f766e' }}>{disburseModal.vendorIfscCode || '—'}</span></div>
                  {disburseModal.vendorBranchName && <div style={{ gridColumn: '1 / -1' }}><span style={{ color: '#64748b' }}>Branch:</span> {disburseModal.vendorBranchName}</div>}
                </div>
              ) : (
                <div style={{ color: '#b45309', fontStyle: 'italic' }}>
                  ⚠️ No bank account registered in vendor master. Please verify payout account with vendor before NEFT transfer.
                </div>
              )}
            </div>

            <form onSubmit={handleDisbursePayment}>
              {disburseMsg.err && <div style={S.errorMsg}>{disburseMsg.err}</div>}
              {disburseMsg.succ && <div style={S.successMsg}>{disburseMsg.succ}</div>}

              <div style={S.formGroup}>
                <label style={S.label}>Disbursement Amount (₹) *</label>
                <input
                  type="number"
                  step="0.01"
                  max={disburseModal.balanceAmount}
                  style={{ ...S.input, fontWeight: 700, fontSize: 15 }}
                  value={disburseForm.amount}
                  onChange={e => setDisburseForm({ ...disburseForm, amount: e.target.value })}
                  required
                />
              </div>

              <div style={S.formGroup}>
                <label style={S.label}>Payment Mode *</label>
                <select
                  style={S.input}
                  value={disburseForm.payment_mode}
                  onChange={e => setDisburseForm({ ...disburseForm, payment_mode: e.target.value })}
                  required
                >
                  <option value="Bank Transfer (NEFT/RTGS)">Bank Transfer (NEFT / RTGS)</option>
                  <option value="Cheque">Bank Cheque</option>
                  <option value="UPI / Online Transfer">UPI / Online Transfer</option>
                  <option value="Demand Draft (DD)">Demand Draft (DD)</option>
                  <option value="Cash Disbursement">Cash Disbursement</option>
                </select>
              </div>

              <div style={S.formGroup}>
                <label style={S.label}>Bank Name / Disbursal Account *</label>
                <input
                  type="text"
                  style={S.input}
                  value={disburseForm.bank_name}
                  onChange={e => setDisburseForm({ ...disburseForm, bank_name: e.target.value })}
                  required
                />
              </div>

              <div style={S.formGroup}>
                <label style={S.label}>UTR / Cheque / Transaction Reference No. *</label>
                <input
                  type="text"
                  style={S.input}
                  placeholder="e.g. UTR-HDFC-991823746 or CHQ-001928"
                  value={disburseForm.reference_number}
                  onChange={e => setDisburseForm({ ...disburseForm, reference_number: e.target.value })}
                  required
                />
              </div>

              <div style={S.formGroup}>
                <label style={S.label}>Remarks</label>
                <textarea
                  style={S.textarea}
                  rows={2}
                  value={disburseForm.remarks}
                  onChange={e => setDisburseForm({ ...disburseForm, remarks: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                <button
                  type="button"
                  style={{ ...S.btn, background: '#94a3b8', width: '50%' }}
                  onClick={() => setDisburseModal(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={disburseSubmitting}
                  style={{ ...S.btn, background: '#16a34a', width: '50%' }}
                >
                  {disburseSubmitting ? 'Processing...' : 'Confirm & Disburse'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

function KPI({ label, val, color }) {
  return (
    <div style={{ background: '#ffffff', border: `1px solid ${color}33`, borderRadius: 8, padding: '12px 20px' }}>
      <div style={{ fontSize: 12, color: '#8a8a90', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color }}>{val}</div>
    </div>
  )
}

function InfoCard({ label, val, sub }) {
  return (
    <div style={{ background: '#ffffff', border: '1px solid #e7e6df', borderRadius: 8, padding: '16px 20px' }}>
      <div style={{ fontSize: 12, color: '#8a8a90', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: '#1b1b1d', marginBottom: 4 }}>{val}</div>
      <div style={{ fontSize: 12, color: '#8a8a90' }}>{sub}</div>
    </div>
  )
}

const S = {
  page: { padding: 24, background: '#f6f5f0', minHeight: '100vh', color: '#1b1b1d' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  title: { fontSize: 22, fontWeight: 700, color: '#1b1b1d' },
  sub: { fontSize: 13, color: '#8a8a90', marginTop: 2 },
  kpiGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 12, marginBottom: 20 },
  tabs: { display: 'flex', gap: 4, marginBottom: 16, borderBottom: '1px solid #e7e6df', overflowX: 'auto' },
  tabBtn: { background: 'none', border: 'none', color: '#8a8a90', padding: '8px 16px', cursor: 'pointer', fontSize: 13, fontWeight: 500, borderBottom: '2px solid transparent', marginBottom: -1, whiteSpace: 'nowrap' },
  tabActive: { color: '#1b1b1d', borderBottom: '2px solid #1b1b1d', fontWeight: 700 },
  section: { marginBottom: 20 },
  sTitle: { fontSize: 13, fontWeight: 700, color: '#8a8a90', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 },
  grid2: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 },
  tableWrap: { background: '#ffffff', borderRadius: 10, overflow: 'auto', border: '1px solid #e7e6df' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  thead: { background: '#f6f5f0' },
  th: { padding: '10px 14px', textAlign: 'left', color: '#8a8a90', fontWeight: 600, fontSize: 12, textTransform: 'uppercase', borderBottom: '1px solid #e7e6df', whiteSpace: 'nowrap' },
  tr: { borderBottom: '1px solid #f1efe8' },
  td: { padding: '10px 14px', verticalAlign: 'middle' },
  muted: { color: '#a0a0a6', fontSize: 12 },
  code: { fontFamily: 'monospace', background: '#f6f5f0', padding: '2px 6px', borderRadius: 4, fontSize: 11, color: '#0369a1', fontWeight: 600 },
  loading: { padding: 40, textAlign: 'center', color: '#8a8a90' },
  gridLayout: { display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 20, alignItems: 'start' },
  formCard: { background: '#ffffff', borderRadius: 10, padding: 20, border: '1px solid #e7e6df' },
  formTitle: { fontSize: 16, fontWeight: 600, color: '#1b1b1d', marginBottom: 15 },
  formGroup: { marginBottom: 14 },
  label: { display: 'block', fontSize: 12, color: '#64748b', marginBottom: 5, fontWeight: 500 },
  input: { width: '100%', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: 6, color: '#1b1b1d', padding: '8px 12px', fontSize: 13, outline: 'none' },
  textarea: { width: '100%', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: 6, color: '#1b1b1d', padding: '8px 12px', fontSize: 13, outline: 'none', resize: 'vertical' },
  btn: { width: '100%', background: '#22c55e', border: 'none', color: '#ffffff', fontWeight: 700, padding: '10px', borderRadius: 6, cursor: 'pointer', fontSize: 13, marginTop: 10 },
  errorMsg: { background: '#fee2e2', color: '#dc2626', padding: '8px 12px', borderRadius: 6, fontSize: 12, marginBottom: 12 },
  successMsg: { background: '#dcfce7', color: '#15803d', padding: '8px 12px', borderRadius: 6, fontSize: 12, marginBottom: 12 },
  historyWrap: { display: 'flex', flexDirection: 'column', gap: 10 },
  btnIcon: { background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, padding: '2px 4px' },
  modalOverlay: { position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 },
  modalBox: { background: '#ffffff', borderRadius: 12, width: '100%', maxWidth: 540, padding: 24, boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)', maxHeight: '90vh', overflowY: 'auto' },
  closeBtn: { background: 'none', border: 'none', fontSize: 18, color: '#64748b', cursor: 'pointer', padding: 4 }
}
