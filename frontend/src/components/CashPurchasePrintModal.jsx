import React, { useEffect } from 'react'
import { Printer, X, CheckCircle2, Building2, Calendar, FileText, UserCheck } from 'lucide-react'
import { LOGO_SRC, LOGO_DATA_URI } from '../utils/logo'

function numberToWords(num) {
  if (!num || isNaN(num)) return 'Zero Rupees Only'
  const a = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen']
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']

  const inWords = (n) => {
    if (n < 20) return a[n] + ' '
    const digit = n % 10
    if (n < 100) return b[Math.floor(n / 10)] + (digit ? ' ' + a[digit] : '') + ' '
    if (n < 1000) return a[Math.floor(n / 100)] + ' Hundred ' + (n % 100 ? inWords(n % 100) : '')
    if (n < 100000) return inWords(Math.floor(n / 1000)) + 'Thousand ' + (n % 1000 ? inWords(n % 1000) : '')
    if (n < 10000000) return inWords(Math.floor(n / 100000)) + 'Lakh ' + (n % 100000 ? inWords(n % 100000) : '')
    return inWords(Math.floor(n / 10000000)) + 'Crore ' + (n % 10000000 ? inWords(n % 10000000) : '')
  }

  const main = Math.floor(num)
  const paise = Math.round((num - main) * 100)
  let str = 'Rupees ' + inWords(main).trim()
  if (paise > 0) {
    str += ' and ' + inWords(paise).trim() + ' Paise'
  }
  return str + ' Only'
}

export default function CashPurchasePrintModal({ data, isOpen, onClose }) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.()
    }
    if (isOpen) window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen || !data) return null

  const cp = data
  const isInter = cp.vendor_gstin && !cp.vendor_gstin.startsWith('29')
  const sub = Number(cp.taxable_amount || cp.taxableAmount || 0)
  const cgst = Number(cp.cgst_amount || cp.cgstAmount || 0)
  const sgst = Number(cp.sgst_amount || cp.sgstAmount || 0)
  const igst = Number(cp.igst_amount || cp.igstAmount || 0)
  const grand = Number(cp.total_amount || cp.totalAmount || 0)
  const items = cp.items || []

  return (
    <div style={styles.overlay}>
      {/* Top Floating Control Bar */}
      <div className="no-print" style={styles.controlBar}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <img src={LOGO_SRC} alt="Logo" style={{ width: 24, height: 24, objectFit: 'contain', background: '#fff', borderRadius: 4 }} />
          <div>
            <div style={{ fontWeight: 700, fontSize: 13 }}>Official Cash Purchase Voucher Preview</div>
            <div style={{ fontSize: 11, color: '#94a3b8' }}>SRI M.K. PAPER MILLS PVT. LTD. · Spot Procurement Voucher</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => window.print()} style={styles.btnPrint}>
            <Printer size={15} /> Print / Save PDF
          </button>
          <button onClick={onClose} style={styles.btnClose}>
            <X size={16} /> Close
          </button>
        </div>
      </div>

      {/* Print Document Body */}
      <div id="print-document" style={styles.document}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #0f766e', paddingBottom: 12, marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <img src={LOGO_DATA_URI || LOGO_SRC} alt="Logo" style={{ height: 44, width: 'auto', maxWidth: 140, objectFit: 'contain' }} />
            <div>
              <div style={{ fontSize: 18, fontWeight: 900, color: '#0f766e', letterSpacing: '0.02em' }}>SRI M.K. PAPER MILLS PRIVATE LIMITED</div>
              <div style={{ fontSize: 11, color: '#334155', fontWeight: 700 }}>SPOT PROCUREMENT &amp; CASH PURCHASE VOUCHER</div>
              <div style={{ fontSize: 10, color: '#64748b' }}>Plant: Survey No. 42/1, Mill Road, Industrial Area, Karnataka | GSTIN: 29AABCS1429B1Z8</div>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#0f766e' }}>{cp.voucher_number || cp.voucherNumber || 'CP-VOUCHER'}</div>
            <div style={{ fontSize: 11, color: '#64748b' }}>Date: <strong>{cp.date ? String(cp.date).slice(0, 10) : new Date().toLocaleDateString('en-IN')}</strong></div>
            <div style={{ fontSize: 11, color: '#15803d', fontWeight: 700, marginTop: 2 }}>PAID ({cp.payment_mode || cp.paymentMode || 'Cash'})</div>
          </div>
        </div>

        {/* Vendor & Details Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
          <div style={{ border: '1px solid #cbd5e1', borderRadius: 6, padding: '10px 12px', background: '#f8fafc' }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#0f766e', textTransform: 'uppercase', marginBottom: 4 }}>SUPPLIER / VENDOR DETAILS</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{cp.vendor_name || cp.vendorName || 'Spot Vendor / Walk-in Shop'}</div>
            <div style={{ fontSize: 11, color: '#334155', marginTop: 2 }}>GSTIN: <strong>{cp.vendor_gstin || cp.vendorGstin || 'Unregistered Cash Vendor'}</strong></div>
            <div style={{ fontSize: 11, color: '#334155' }}>Cash Memo / Invoice: <strong>{cp.invoice_number || cp.invoiceNumber || '—'}</strong></div>
          </div>
          <div style={{ border: '1px solid #cbd5e1', borderRadius: 6, padding: '10px 12px', background: '#f8fafc' }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#0f766e', textTransform: 'uppercase', marginBottom: 4 }}>PROCUREMENT &amp; INVENTORY INFO</div>
            <div style={{ fontSize: 11, color: '#334155', marginBottom: 2 }}>PR / Indent Ref: <strong>{cp.indentNumber || cp.indent_number || 'Direct Spot Cash Purchase'}</strong></div>
            <div style={{ fontSize: 11, color: '#334155', marginBottom: 2 }}>Payment Mode: <strong>{cp.payment_mode || cp.paymentMode || 'Cash'}</strong></div>
            <div style={{ fontSize: 11, color: '#15803d', fontWeight: 700 }}>✓ Stock Atomic Intake to Central Store Active</div>
          </div>
        </div>

        {/* Items Table */}
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 16, fontSize: 11 }}>
          <thead>
            <tr style={{ background: '#f1f5f9', borderTop: '1px solid #0f766e', borderBottom: '2px solid #0f766e', textAlign: 'left', color: '#0f766e', fontWeight: 800 }}>
              <th style={{ padding: '8px 6px', width: 30, textAlign: 'center' }}>#</th>
              <th style={{ padding: '8px 6px' }}>Item Description &amp; Code</th>
              <th style={{ padding: '8px 6px', textAlign: 'center', width: 70 }}>HSN</th>
              <th style={{ padding: '8px 6px', textAlign: 'right', width: 60 }}>Qty</th>
              <th style={{ padding: '8px 6px', width: 45 }}>UOM</th>
              <th style={{ padding: '8px 6px', textAlign: 'right', width: 80 }}>Unit Rate (₹)</th>
              <th style={{ padding: '8px 6px', textAlign: 'center', width: 50 }}>GST%</th>
              <th style={{ padding: '8px 6px', textAlign: 'right', width: 95 }}>Total Amount (₹)</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ padding: 14, textAlign: 'center', color: '#64748b' }}>No item line details recorded.</td>
              </tr>
            ) : (
              items.map((it, i) => {
                const q = parseFloat(it.qty || it.in_qty || 0)
                const r = parseFloat(it.unit_price || it.rate || 0)
                const gst = it.gst_pct != null && it.gst_pct !== '' ? parseFloat(it.gst_pct) : 18
                const lineTot = parseFloat(it.line_total || it.lineTotal || (q * r * (1 + (gst / 100))))
                return (
                  <tr key={i} style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '8px 6px', textAlign: 'center', color: '#64748b' }}>{i + 1}</td>
                    <td style={{ padding: '8px 6px' }}>
                      <div style={{ fontWeight: 700, color: '#0f172a' }}>{it.materialName || it.description || it.material_name}</div>
                      <div style={{ fontSize: 10, color: '#64748b' }}>Code: <code>{it.materialCode || it.code || it.material_id}</code></div>
                    </td>
                    <td style={{ padding: '8px 6px', textAlign: 'center', color: '#64748b' }}>{it.hsnCode || it.hsn_code || '8439'}</td>
                    <td style={{ padding: '8px 6px', textAlign: 'right', fontWeight: 700 }}>{q.toFixed(2)}</td>
                    <td style={{ padding: '8px 6px', color: '#475569' }}>{it.uom || it.matUom || 'NOS'}</td>
                    <td style={{ padding: '8px 6px', textAlign: 'right' }}>₹{r.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td style={{ padding: '8px 6px', textAlign: 'center' }}>{gst}%</td>
                    <td style={{ padding: '8px 6px', textAlign: 'right', fontWeight: 700 }}>₹{lineTot.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>

        {/* Valuation & Signatures */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 16, marginBottom: 20 }}>
          <div style={{ border: '1px solid #e2e8f0', borderRadius: 6, padding: '10px 14px', background: '#f8fafc' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#0f766e', marginBottom: 4 }}>Amount in Words:</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#0f172a', fontStyle: 'italic' }}>
              {numberToWords(grand)}
            </div>
            {cp.remarks && <div style={{ fontSize: 11, color: '#475569', marginTop: 8 }}><strong>Remarks:</strong> {cp.remarks}</div>}
          </div>
          <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse' }}>
            <tbody>
              <tr>
                <td style={{ padding: '4px 6px', color: '#64748b' }}>Subtotal / Taxable:</td>
                <td style={{ padding: '4px 6px', textAlign: 'right', fontWeight: 600 }}>₹{sub.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
              </tr>
              {isInter ? (
                <tr>
                  <td style={{ padding: '4px 6px', color: '#d97706' }}>IGST Amount:</td>
                  <td style={{ padding: '4px 6px', textAlign: 'right', fontWeight: 600, color: '#d97706' }}>₹{igst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                </tr>
              ) : (
                <>
                  <tr>
                    <td style={{ padding: '4px 6px', color: '#059669' }}>CGST Amount:</td>
                    <td style={{ padding: '4px 6px', textAlign: 'right', fontWeight: 600, color: '#059669' }}>₹{cgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '4px 6px', color: '#059669' }}>SGST Amount:</td>
                    <td style={{ padding: '4px 6px', textAlign: 'right', fontWeight: 600, color: '#059669' }}>₹{sgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                  </tr>
                </>
              )}
              <tr style={{ borderTop: '1px solid #cbd5e1', background: '#f0fdf4' }}>
                <td style={{ padding: '6px 6px', fontWeight: 800, fontSize: 13, color: '#0f766e' }}>Total Amount Paid:</td>
                <td style={{ padding: '6px 6px', textAlign: 'right', fontWeight: 900, fontSize: 14, color: '#0f766e' }}>₹{grand.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* 3 Signatures */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 24, textAlign: 'center', fontSize: 11, color: '#334155', marginTop: 28 }}>
          <div>
            <div style={{ height: 32 }}></div>
            <div style={{ borderTop: '1px solid #94a3b8', paddingTop: 4, fontWeight: 700 }}>Purchaser / Indentor Signature</div>
            <div style={{ fontSize: 10, color: '#64748b' }}>{cp.createdByName || 'Purchaser'}</div>
          </div>
          <div>
            <div style={{ height: 32 }}></div>
            <div style={{ borderTop: '1px solid #94a3b8', paddingTop: 4, fontWeight: 700 }}>Store Incharge (Stock Received)</div>
            <div style={{ fontSize: 10, color: '#64748b' }}>Central Stores</div>
          </div>
          <div>
            <div style={{ height: 32 }}></div>
            <div style={{ borderTop: '1px solid #94a3b8', paddingTop: 4, fontWeight: 700 }}>Accounts / Finance Approval</div>
            <div style={{ fontSize: 10, color: '#64748b' }}>Accounts Department</div>
          </div>
        </div>
      </div>
    </div>
  )
}

const styles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(15, 23, 42, 0.75)',
    backdropFilter: 'blur(4px)',
    zIndex: 99999,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'flex-start',
    overflowY: 'auto',
    padding: '24px 16px'
  },
  controlBar: {
    background: '#1e293b',
    color: '#fff',
    padding: '10px 20px',
    borderRadius: 12,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    maxWidth: 880,
    marginBottom: 16,
    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3)'
  },
  btnPrint: {
    background: '#0f766e',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    padding: '8px 16px',
    fontWeight: 700,
    fontSize: 13,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 6
  },
  btnClose: {
    background: '#334155',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    padding: '8px 14px',
    fontWeight: 600,
    fontSize: 13,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 6
  },
  document: {
    background: '#fff',
    border: '1px solid #cbd5e1',
    borderRadius: 8,
    padding: '24px 28px',
    width: '100%',
    maxWidth: 880,
    boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
    boxSizing: 'border-box'
  }
}
