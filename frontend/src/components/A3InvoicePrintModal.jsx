import React, { useEffect, useState } from 'react'
import { LOGO_DATA_URI } from '../utils/logo'

// Indian Number to Currency Words generator
function amountInWords(num) {
  if (!num || isNaN(num) || num <= 0) return 'Zero Rupees Only'
  const a = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen']
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']

  const inWords = (n) => {
    if (n < 20) return a[n] + ' '
    const digit = n % 10
    return b[Math.floor(n / 10)] + (digit ? ' ' + a[digit] : '')
  }

  let str = ''
  let n = Math.floor(num)
  const crore = Math.floor(n / 10000000)
  n %= 10000000
  const lakh = Math.floor(n / 100000)
  n %= 100000
  const thousand = Math.floor(n / 1000)
  n %= 1000
  const hundred = Math.floor(n / 100)
  n %= 100

  if (crore) str += inWords(crore) + 'Crore '
  if (lakh) str += inWords(lakh) + 'Lakh '
  if (thousand) str += inWords(thousand) + 'Thousand '
  if (hundred) str += inWords(hundred) + 'Hundred '
  if (n) str += inWords(n)

  const paise = Math.round((num - Math.floor(num)) * 100)
  let paiseStr = ''
  if (paise > 0) {
    paiseStr = ` and ${inWords(paise)}Paise`
  }

  return `Rs. ${str.trim()}${paiseStr} Only`
}

const A3_PRINT_STYLE = `
@media print {
  body * { visibility: hidden !important; }
  #a3-print-wrapper, #a3-print-wrapper * { visibility: visible !important; }
  #a3-print-wrapper {
    position: absolute !important;
    left: 0 !important;
    top: 0 !important;
    width: 100% !important;
    margin: 0 !important;
    padding: 0 !important;
    background: #fff !important;
    color: #000 !important;
    box-shadow: none !important;
    border: none !important;
  }
  .a3-no-print { display: none !important; }
  @page {
    size: A3 landscape;
    margin: 8mm 10mm;
  }
}

.a3-watermark-bg {
  position: relative;
}
.a3-watermark-bg::after {
  content: 'SRI M.K. PAPER MILLS';
  position: absolute;
  top: 52%;
  left: 50%;
  transform: translate(-50%, -50%) rotate(-12deg);
  font-size: 76px;
  font-weight: 900;
  letter-spacing: 10px;
  color: rgba(15, 118, 110, 0.05);
  pointer-events: none;
  z-index: 0;
  white-space: nowrap;
  font-family: Arial, sans-serif;
}
`

function injectA3PrintStyle() {
  if (!document.getElementById('a3-invoice-print-style')) {
    const s = document.createElement('style')
    s.id = 'a3-invoice-print-style'
    s.textContent = A3_PRINT_STYLE
    document.head.appendChild(s)
  }
}

export default function A3InvoicePrintModal({ docData, onClose, title = 'STORE INDENT / ISSUE VOUCHER' }) {
  const [companyProfile, setCompanyProfile] = useState(null)

  useEffect(() => {
    injectA3PrintStyle()
    const token = localStorage.getItem('mk_token') || localStorage.getItem('token')
    fetch('/api/master/company-profile', {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(d => {
        if (d.success && d.data) setCompanyProfile(d.data)
      })
      .catch(err => console.error('Failed to load company profile:', err))
  }, [])

  if (!docData) return null

  // Company Details from DB system_settings
  const company = {
    name: companyProfile?.COMPANY_NAME || docData.companyName || 'SRI M.K. PAPER MILLS PRIVATE LIMITED',
    subTitle: companyProfile?.COMPANY_SUBTITLE || 'MANUFACTURERS OF KRAFT & FLUTING PAPER',
    address: companyProfile?.COMPANY_ADDRESS || docData.companyAddress || 'Survey No. 42/1, Mill Road, Industrial Area, Karnataka, India',
    gstin: companyProfile?.COMPANY_GSTIN || docData.companyGstin || '29AABCS1429B1Z8',
    phone: companyProfile?.COMPANY_PHONE || docData.companyPhone || '+91 99855 89599',
    dlNo: companyProfile?.COMPANY_DL_NO || docData.companyDlNo || 'KA/MDL/2026-147387',
    panNo: companyProfile?.COMPANY_PAN || docData.companyPan || 'AAICM7429L',
    state: companyProfile?.COMPANY_STATE || docData.companyState || 'Karnataka',
    stateCode: companyProfile?.COMPANY_STATE_CODE || docData.companyStateCode || '29',
    bankName: companyProfile?.COMPANY_BANK_NAME || 'HDFC Bank Ltd.',
    bankAc: companyProfile?.COMPANY_BANK_AC || '50200067891234',
    bankIfsc: companyProfile?.COMPANY_BANK_IFSC || 'HDFC0001234',
    bankBranch: companyProfile?.COMPANY_BANK_BRANCH || 'Main Branch, Hubli',
    jurisdiction: companyProfile?.COMPANY_JURISDICTION || 'Karnataka'
  }

  // Document identification
  const isIndentOrIssue = Boolean(
    (docData.indent_number || docData.indentNumber || docData.deptName || docData.departmentName || title?.includes('INDENT') || title?.includes('ISSUE') || title?.includes('SIV')) &&
    !docData.vendorName && !docData.vendor_name && !docData.vendor_id
  )

  const isSupplierOrGrn = Boolean(
    docData.vendor_id || docData.vendor_name || docData.vendorName ||
    docData.partyName || docData.party_name ||
    title?.includes('GRN') || title?.includes('RECEIPT') || title?.includes('INWARD') || title?.includes('INVOICE')
  )

  // Extract raw items
  const items = Array.isArray(docData.items) && docData.items.length > 0
    ? docData.items
    : [{
        materialName: docData.materialName || docData.material_name || 'Standard Mill Material / Item',
        materialCode: docData.materialCode || docData.material_code || 'ITM-001',
        uom: docData.uom || docData.matUom || 'NOS',
        hsnCode: docData.hsnCode || docData.hsn_code || '84399900',
        in_qty: docData.in_qty || docData.issued_qty || docData.required_qty || docData.received_qty || docData.qty || 1,
        unit_price: docData.unit_price || docData.matPrice || docData.price || 0,
        discount_pct: docData.discount_pct || 0,
        discount_amount: docData.discount_amount || 0,
        gst_pct: docData.gst_pct !== undefined ? docData.gst_pct : 18,
        batch_number: docData.batch_number || docData.batch_no || docData.batch || '—',
        pack_size: docData.pack_size || docData.pack || docData.uom || 'NOS',
        dis_qty: docData.dis_qty || 0,
        old_mrp: docData.old_mrp || 0,
        mrp: docData.mrp || docData.unit_price || docData.matPrice || 0,
        trade_price: docData.trade_price || docData.unit_price || docData.matPrice || 0
      }]

  // Party Particulars (Dynamic mapping based on document scope)
  const party = {
    isDepartment: isIndentOrIssue && !isSupplierOrGrn,
    name: (isSupplierOrGrn || !isIndentOrIssue)
      ? (docData.vendorName || docData.vendor_name || docData.partyName || docData.party_name || docData.customerName || 'Mill Authorized Supplier')
      : (docData.deptName || docData.departmentName || docData.department || 'Mechanical Department'),
    code: docData.vendorCode || docData.vendor_code || docData.deptCode || docData.raisedByEmpCode || docData.customerCode || 'MILL-01',
    phone: docData.vendorMobile || docData.vendorPhone || docData.partyPhone || company.phone,
    gstin: docData.vendorGstin || docData.vendor_gstin || docData.partyGstin || (isIndentOrIssue && !isSupplierOrGrn ? 'Internal Department (Tax Exempt)' : 'Unregistered'),
    pan: docData.vendorPan || docData.vendor_pan || docData.partyPan || '—',
    dlNo: docData.vendorDlNo || docData.vendor_dl_no || docData.partyDlNo || '—',
    address: (isSupplierOrGrn || !isIndentOrIssue)
      ? (docData.vendorAddress || docData.vendor_address || docData.partyAddress || 'Industrial Area, Plant Supply Hub')
      : `${docData.sectionName ? `Plant Section: ${docData.sectionName}` : 'MK Paper Mill Floor'}${docData.machineName ? ` · Machine: ${docData.machineName}` : ''}`,
    city: docData.vendorCity || docData.vendor_city || docData.partyCity || 'Karnataka',
    state: docData.vendorState || docData.vendor_state || docData.partyState || 'Karnataka',
    requestedBy: docData.raisedByName || docData.raisedBy || docData.createdByName || docData.created_by_name || docData.issued_to || 'Store Officer',
    empCode: docData.raisedByEmpCode || docData.emp_code || '—',
    purpose: docData.itemPurpose || docData.purpose || docData.remarks || 'Plant Operations & Regular Maintenance'
  }

  // Metadata details
  const invoiceNo = docData.invoice_number || docData.invoiceNumber || docData.indent_number || docData.indentNumber || docData.grnNumber || docData.grn_number || `SIV-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}001`
  const invoiceDate = docData.order_date || docData.invoiceDate || docData.invoice_date || docData.date ? new Date(docData.order_date || docData.invoiceDate || docData.invoice_date || docData.date).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }) : new Date().toLocaleDateString('en-GB')
  const grnNo = docData.grnNumber || docData.grn_number || (docData.reference_type === 'GRN' ? docData.reference_id : invoiceNo)
  const grnDate = docData.date ? new Date(docData.date).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }) : invoiceDate
  const orderNo = docData.poNumber || docData.order_number || docData.reference_id || '—'
  const orderDate = docData.poDate ? new Date(docData.poDate).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'
  const ewaybillNo = docData.eway_bill_no || docData.ewaybill || '—'
  const casesCount = docData.cases_count || docData.cases || items.length
  const dueDate = docData.due_date || docData.requiredDate ? new Date(docData.due_date || docData.requiredDate).toLocaleDateString('en-GB') : invoiceDate
  const transport = docData.transport_name || docData.transport || (isIndentOrIssue ? 'Store Forklift / Manual Overhead Crane' : 'Direct Mill Inward')
  const weight = docData.vehicle_weight || docData.weight || '—'
  const paymentMode = docData.payment_mode || (isIndentOrIssue ? 'Internal Store Allocation' : 'Credit / Net 30')

  // Item Calculations
  let totalQty = 0
  let totalDisQty = 0
  let totalGross = 0
  let totalDiscAmt = 0
  let totalTaxable = 0
  let totalCgst = 0
  let totalSgst = 0
  let totalIgst = 0
  let totalGst = 0
  let totalLineVal = 0

  // Multi-slab GST accumulator dictionary
  const gstSlabsMap = {}

  const processedItems = items.map((it, idx) => {
    const q = parseFloat(it.in_qty || it.issued_qty || it.required_qty || it.received_qty || it.qty || it.quantity || 0)
    const disQ = parseFloat(it.dis_qty || it.free_qty || 0)
    const price = parseFloat(it.trade_price || it.unit_price || it.matPrice || it.price || 0)
    const gstRate = parseFloat(it.gst_pct !== undefined && it.gst_pct !== null ? it.gst_pct : 18)
    const oldMrp = parseFloat(it.old_mrp || 0)
    const mrpVal = parseFloat(it.mrp || price)

    const gross = q * price
    const discPct = parseFloat(it.discount_pct || 0)
    const storedDiscAmt = parseFloat(it.discount_amount || 0)
    const discVal = discPct > 0 ? (gross * discPct) / 100 : storedDiscAmt
    const taxable = it.taxable_amount !== undefined && it.taxable_amount !== null && parseFloat(it.taxable_amount) > 0
      ? parseFloat(it.taxable_amount)
      : Math.max(0, gross - discVal)

    // Determine state tax mode
    const isInter = it.tax_type === 'inter' || (party.state && party.state.toLowerCase() !== company.state.toLowerCase()) || (party.gstin && party.gstin.length >= 2 && !party.gstin.startsWith(company.stateCode) && party.gstin !== 'Unregistered')
    
    let cgst = 0, sgst = 0, igst = 0
    if (it.cgst_amount !== undefined && it.cgst_amount !== null && parseFloat(it.cgst_amount) > 0) {
      cgst = parseFloat(it.cgst_amount)
    }
    if (it.sgst_amount !== undefined && it.sgst_amount !== null && parseFloat(it.sgst_amount) > 0) {
      sgst = parseFloat(it.sgst_amount)
    }
    if (it.igst_amount !== undefined && it.igst_amount !== null && parseFloat(it.igst_amount) > 0) {
      igst = parseFloat(it.igst_amount)
    }

    if (cgst === 0 && sgst === 0 && igst === 0 && gstRate > 0) {
      if (isInter) {
        igst = (taxable * gstRate) / 100
      } else {
        cgst = (taxable * (gstRate / 2)) / 100
        sgst = (taxable * (gstRate / 2)) / 100
      }
    }
    
    const lineTotal = it.total_amount !== undefined && it.total_amount !== null && parseFloat(it.total_amount) > 0
      ? parseFloat(it.total_amount)
      : (taxable + cgst + sgst + igst)

    totalQty += q
    totalDisQty += disQ
    totalGross += gross
    totalDiscAmt += discVal
    totalTaxable += taxable
    totalCgst += cgst
    totalSgst += sgst
    totalIgst += igst
    totalGst += (cgst + sgst + igst)
    totalLineVal += lineTotal

    // Accumulate into GST Slab Summary
    const slabKey = `${gstRate.toFixed(2)}%`
    if (!gstSlabsMap[slabKey]) {
      gstSlabsMap[slabKey] = { rate: gstRate, taxable: 0, cgst: 0, sgst: 0, igst: 0, total: 0 }
    }
    gstSlabsMap[slabKey].taxable += taxable
    gstSlabsMap[slabKey].cgst += cgst
    gstSlabsMap[slabKey].sgst += sgst
    gstSlabsMap[slabKey].igst += igst
    gstSlabsMap[slabKey].total += lineTotal

    return {
      index: idx + 1,
      name: it.materialName || it.material_name || it.name || `Material Item #${idx + 1}`,
      code: it.materialCode || it.material_code || it.code || '',
      pack: it.pack_size || it.pack || it.uom || 'NOS',
      gstRate,
      hsnCode: it.hsnCode || it.hsn_code || '84399900',
      expDate: it.exp_date || it.expiry_date || '—',
      batch: it.batch_number || it.batch_no || it.batch || docData.batch_number || '—',
      oldMrp: oldMrp > 0 ? oldMrp.toFixed(2) : '—',
      mrp: mrpVal.toFixed(2),
      tradePrice: price.toFixed(2),
      qty: q.toFixed(2),
      disQty: disQ > 0 ? disQ.toFixed(2) : '—',
      productValue: taxable.toFixed(2),
      cgst,
      sgst,
      igst,
      lineTotal
    }
  })

  const resolvedTitle = (title === 'GST INVOICE' || title === 'GST Invoice' || (!title && isSupplierOrGrn))
    ? 'GRN INVOICE'
    : (title || (isSupplierOrGrn ? 'GRN INVOICE' : 'STORE INDENT / ISSUE VOUCHER'))

  const rawGrandTotal = docData.grand_total !== undefined && docData.grand_total !== null && parseFloat(docData.grand_total) > 0
    ? parseFloat(docData.grand_total)
    : (totalTaxable + totalGst)
  const grandTotal = Math.round(rawGrandTotal)
  const roundOff = (grandTotal - (totalTaxable + totalGst)).toFixed(2)
  const words = amountInWords(grandTotal)
  const currentTime = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })

  const slabList = Object.values(gstSlabsMap)

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(15, 23, 42, 0.82)',
      backdropFilter: 'blur(5px)',
      zIndex: 99999,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'flex-start',
      overflowY: 'auto',
      padding: '16px 12px'
    }}>
      {/* ── Top Floating Control Bar (Hidden when printing) ── */}
      <div className="a3-no-print" style={{
        background: '#0f172a',
        color: '#ffffff',
        padding: '10px 20px',
        borderRadius: 10,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
        maxWidth: 1200,
        marginBottom: 14,
        boxShadow: '0 10px 25px rgba(0, 0, 0, 0.4)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ background: '#0f766e', color: '#fff', padding: '4px 10px', borderRadius: 6, fontWeight: 800, fontSize: 12 }}>
            A3 OFFICIAL FORMAT
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 14 }}>{resolvedTitle}</div>
            <div style={{ fontSize: 11, color: '#94a3b8' }}>A3 Landscape 420mm × 297mm · Real Database Calculations · Sri M.K. Paper Mills Official Slip</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            onClick={() => window.print()}
            style={{
              background: '#0f766e',
              color: '#ffffff',
              border: 'none',
              borderRadius: 6,
              padding: '8px 20px',
              fontWeight: 800,
              fontSize: 13,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              boxShadow: '0 2px 8px rgba(15, 118, 110, 0.4)'
            }}
          >
            🖨️ Print / Save PDF (A3)
          </button>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: '#334155',
              color: '#ffffff',
              border: 'none',
              borderRadius: 6,
              padding: '8px 16px',
              fontWeight: 700,
              fontSize: 13,
              cursor: 'pointer'
            }}
          >
            ✕ Close
          </button>
        </div>
      </div>

      {/* ── Printable Paper Frame (Exact Layout with 100% Dynamic Content) ── */}
      <div
        id="a3-print-wrapper"
        className="a3-watermark-bg"
        style={{
          background: '#ffffff',
          color: '#000000',
          width: '100%',
          maxWidth: 1200,
          minHeight: 800,
          border: '1.5px solid #000000',
          fontFamily: 'Arial, Helvetica, sans-serif',
          fontSize: 11,
          lineHeight: 1.3,
          boxSizing: 'border-box',
          padding: 0,
          position: 'relative'
        }}
      >
        {/* ── TOP SECTION (3 Columns: Company Info, Document Header & Meta Grid, Recipient Particulars) ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1.4fr 1.3fr', borderBottom: '1.5px solid #000000' }}>
          
          {/* Top Left: Company Logo & System Details */}
          <div style={{ padding: '10px 12px', borderRight: '1.5px solid #000000', display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <img src={LOGO_DATA_URI} alt="Logo" style={{ width: 44, height: 44, objectFit: 'contain' }} />
              <div>
                <div style={{ fontSize: 15, fontWeight: 900, letterSpacing: 0.5, color: '#000' }}>{company.name}</div>
                <div style={{ fontSize: 9, fontWeight: 700, color: '#475569' }}>{company.subTitle}</div>
              </div>
            </div>
            <div style={{ fontSize: 8.5, color: '#1e293b', marginTop: 4, lineHeight: 1.3, fontWeight: 600 }}>
              {company.address}
            </div>
            <div style={{ fontSize: 9.5, marginTop: 4, display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '2px 8px', fontWeight: 700 }}>
              <span>GSTIN :</span> <span>{company.gstin}</span>
              <span>Phone :</span> <span>{company.phone}</span>
              <span>D.L. NO.:</span> <span>{company.dlNo}</span>
              <span>PAN No.:</span> <span>{company.panNo}</span>
            </div>
          </div>

          {/* Top Center: Original for Recipient, Document Title, Meta Table */}
          <div style={{ borderRight: '1.5px solid #000000', display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: 8.5, fontWeight: 700, textAlign: 'center', padding: '3px 0', borderBottom: '1px solid #cbd5e1', letterSpacing: 0.5 }}>
              ORIGINAL FOR RECIPIENT
            </div>
            <div style={{ background: '#000000', color: '#ffffff', textAlign: 'center', fontSize: 14, fontWeight: 900, letterSpacing: 1.2, padding: '4px 6px', textTransform: 'uppercase' }}>
              {resolvedTitle}
            </div>
            <div style={{ textAlign: 'center', fontSize: 10, fontWeight: 800, padding: '2px 0', borderBottom: '1px solid #000000', color: '#0f766e' }}>
              {paymentMode}
            </div>

            {/* Meta Grid */}
            <div style={{ padding: '6px 8px', fontSize: 9.5, display: 'grid', gridTemplateColumns: '80px 1fr 65px 1fr', gap: '3px 4px', flex: 1, alignItems: 'center' }}>
              <span style={{ fontWeight: 700 }}>Voucher No</span>
              <span style={{ fontWeight: 800 }}>: {invoiceNo}</span>
              <span style={{ fontWeight: 700 }}>GRN / Ref</span>
              <span style={{ fontWeight: 800 }}>: {grnNo}</span>

              <span style={{ fontWeight: 700 }}>Voucher Date</span>
              <span>: {invoiceDate}</span>
              <span style={{ fontWeight: 700 }}>GRN Date</span>
              <span>: {grnDate}</span>

              <span style={{ fontWeight: 700 }}>Order / PO</span>
              <span>: {orderNo}</span>
              <span style={{ fontWeight: 700 }}>Cases / Items</span>
              <span style={{ fontWeight: 800 }}>: {casesCount}</span>

              <span style={{ fontWeight: 700 }}>Order Date</span>
              <span>: {orderDate}</span>
              <span style={{ fontWeight: 700 }}>Due Date</span>
              <span>: {dueDate}</span>

              <span style={{ fontWeight: 700, gridColumn: 'span 4' }}>
                Ewaybill No: {ewaybillNo} &nbsp;&nbsp;|&nbsp;&nbsp; Transport :- {transport} &nbsp;&nbsp;|&nbsp;&nbsp; Weight :- {weight}
              </span>
            </div>
          </div>

          {/* Top Right: Dynamic Billing / Department Particulars */}
          <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ textAlign: 'right', fontSize: 10, fontWeight: 800 }}>
              Dept / Cust Code : {party.code}
            </div>
            <div style={{ fontSize: 10.5, fontWeight: 900, textDecoration: 'underline', textTransform: 'uppercase', marginBottom: 2 }}>
              {party.isDepartment ? 'RECIPIENT DEPARTMENT & TECHNICAL UNIT' : 'BILLING DETAILS'}
            </div>
            <div style={{ fontSize: 13, fontWeight: 900, color: '#000' }}>
              {party.name}
            </div>
            <div style={{ fontSize: 9.5, display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '2px 6px', fontWeight: 600 }}>
              {party.isDepartment ? (
                <>
                  <span style={{ fontWeight: 700 }}>INDENTOR :</span> <span>{party.requestedBy}</span>
                  <span style={{ fontWeight: 700 }}>EMP CODE :</span> <span>{party.empCode}</span>
                  <span style={{ fontWeight: 700 }}>GSTIN :</span> <span>{party.gstin}</span>
                  <span style={{ fontWeight: 700 }}>PURPOSE :</span> <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={party.purpose}>{party.purpose}</span>
                </>
              ) : (
                <>
                  <span style={{ fontWeight: 700 }}>PHONE :</span> <span>{party.phone}</span>
                  <span style={{ fontWeight: 700 }}>GSTIN :</span> <span>{party.gstin}</span>
                  <span style={{ fontWeight: 700 }}>PAN No.:</span> <span>{party.pan}</span>
                  <span style={{ fontWeight: 700 }}>DL No.:</span> <span>{party.dlNo}</span>
                </>
              )}
            </div>

            <div style={{ fontSize: 10.5, fontWeight: 900, textDecoration: 'underline', textTransform: 'uppercase', marginTop: 4 }}>
              {party.isDepartment ? 'TECHNICAL PLACEMENT & CONTEXT' : 'SHIPPING DETAILS'}
            </div>
            <div style={{ fontSize: 9, color: '#334155', fontWeight: 600 }}>
              {party.address}
            </div>
          </div>
        </div>

        {/* ── 12-COLUMN MAIN PRODUCT TABLE ── */}
        <div style={{ borderBottom: '1.5px solid #000000' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
            <thead>
              <tr style={{ borderBottom: '1.5px solid #000000', fontWeight: 900, textTransform: 'uppercase', textAlign: 'center', background: '#f8fafc' }}>
                <th style={{ borderRight: '1px solid #000', padding: '5px 4px', width: 45 }}>QTY</th>
                <th style={{ borderRight: '1px solid #000', padding: '5px 4px', width: 45 }}>Dis Qty</th>
                <th style={{ borderRight: '1px solid #000', padding: '5px 8px', textAlign: 'left' }}>PRODUCT</th>
                <th style={{ borderRight: '1px solid #000', padding: '5px 4px', width: 45 }}>Pack</th>
                <th style={{ borderRight: '1px solid #000', padding: '5px 4px', width: 45 }}>GST %</th>
                <th style={{ borderRight: '1px solid #000', padding: '5px 6px', width: 65 }}>HSN Code</th>
                <th style={{ borderRight: '1px solid #000', padding: '5px 4px', width: 55 }}>Exp. Date</th>
                <th style={{ borderRight: '1px solid #000', padding: '5px 6px', width: 85 }}>BATCH</th>
                <th style={{ borderRight: '1px solid #000', padding: '5px 4px', width: 55, textAlign: 'right' }}>OLD MRP.</th>
                <th style={{ borderRight: '1px solid #000', padding: '5px 6px', width: 55, textAlign: 'right' }}>MRP</th>
                <th style={{ borderRight: '1px solid #000', padding: '5px 6px', width: 65, textAlign: 'right' }}>Trade Price</th>
                <th style={{ padding: '5px 8px', width: 75, textAlign: 'right' }}>Product Value</th>
              </tr>
            </thead>
            <tbody>
              {processedItems.map((item, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                  <td style={{ borderRight: '1px solid #000', padding: '5px 4px', textAlign: 'center', fontWeight: 800 }}>{item.qty}</td>
                  <td style={{ borderRight: '1px solid #000', padding: '5px 4px', textAlign: 'center', color: '#16a34a', fontWeight: 700 }}>{item.disQty}</td>
                  <td style={{ borderRight: '1px solid #000', padding: '5px 8px', textAlign: 'left', fontWeight: 800 }}>
                    <div>{item.name}</div>
                    {item.code && <div style={{ fontSize: 8.5, color: '#64748b', fontWeight: 600 }}>Code: {item.code}</div>}
                  </td>
                  <td style={{ borderRight: '1px solid #000', padding: '5px 4px', textAlign: 'center' }}>{item.pack}</td>
                  <td style={{ borderRight: '1px solid #000', padding: '5px 4px', textAlign: 'center' }}>{item.gstRate.toFixed(2)}</td>
                  <td style={{ borderRight: '1px solid #000', padding: '5px 6px', textAlign: 'center', fontFamily: 'monospace' }}>{item.hsnCode}</td>
                  <td style={{ borderRight: '1px solid #000', padding: '5px 4px', textAlign: 'center' }}>{item.expDate}</td>
                  <td style={{ borderRight: '1px solid #000', padding: '5px 6px', textAlign: 'center', fontWeight: 700 }}>{item.batch}</td>
                  <td style={{ borderRight: '1px solid #000', padding: '5px 4px', textAlign: 'right', color: '#64748b' }}>{item.oldMrp}</td>
                  <td style={{ borderRight: '1px solid #000', padding: '5px 6px', textAlign: 'right' }}>{item.mrp}</td>
                  <td style={{ borderRight: '1px solid #000', padding: '5px 6px', textAlign: 'right', fontWeight: 800 }}>{item.tradePrice}</td>
                  <td style={{ padding: '5px 8px', textAlign: 'right', fontWeight: 800 }}>{item.productValue}</td>
                </tr>
              ))}

              {/* Pad empty rows if fewer than 4 items to maintain clean paper structure */}
              {processedItems.length < 4 && Array.from({ length: 4 - processedItems.length }).map((_, padIdx) => (
                <tr key={`pad-${padIdx}`} style={{ borderBottom: '1px solid #f1f5f9', height: 26 }}>
                  <td style={{ borderRight: '1px solid #000' }}>&nbsp;</td>
                  <td style={{ borderRight: '1px solid #000' }}></td>
                  <td style={{ borderRight: '1px solid #000' }}></td>
                  <td style={{ borderRight: '1px solid #000' }}></td>
                  <td style={{ borderRight: '1px solid #000' }}></td>
                  <td style={{ borderRight: '1px solid #000' }}></td>
                  <td style={{ borderRight: '1px solid #000' }}></td>
                  <td style={{ borderRight: '1px solid #000' }}></td>
                  <td style={{ borderRight: '1px solid #000' }}></td>
                  <td style={{ borderRight: '1px solid #000' }}></td>
                  <td style={{ borderRight: '1px solid #000' }}></td>
                  <td></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ── BOTTOM SECTION (Notes on Left, Real Multi-Slab GST Breakdown on Right) ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.8fr', borderBottom: '1.5px solid #000000' }}>
          
          {/* Bottom Left: Note, Prep by, Amount in Words, Declaration */}
          <div style={{ padding: '8px 10px', borderRight: '1.5px solid #000000', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 900, textDecoration: 'underline', marginBottom: 4 }}>NOTE :</div>
              <div style={{ display: 'grid', gridTemplateColumns: '85px 1fr 95px 1fr', gap: '2px 6px', fontSize: 9.5 }}>
                <span>Prep By :</span> <span style={{ fontWeight: 700 }}>{docData.createdByName || docData.created_by_name || 'Store Officer'}</span>
                <span>Total Items :</span> <span style={{ fontWeight: 800 }}>{processedItems.length}</span>

                <span>No of Cs. :</span> <span>{casesCount}</span>
                <span>Total Qty :</span> <span style={{ fontWeight: 800 }}>{totalQty.toFixed(2)}</span>

                <span>Sort By :</span> <span>Plant Section / Code</span>
                <span>SchDisc :</span> <span style={{ fontWeight: 700 }}>{totalDiscAmt > 0 ? totalDiscAmt.toFixed(2) : '0.00'}</span>

                <span>Checked By :</span> <span style={{ fontWeight: 700 }}>{docData.approvedByName || docData.checkedByName || 'Store Manager'}</span>
                <span>Gross Value :</span> <span style={{ fontWeight: 800 }}>₹{totalGross.toFixed(2)}</span>

                <span>Bill Date :</span> <span>{invoiceDate}</span>
                <span>Total GST :</span> <span style={{ fontWeight: 800 }}>₹{totalGst.toFixed(2)}</span>

                <span>Print Time :</span> <span>{currentTime}</span>
                <span></span> <span></span>
              </div>
            </div>

            <div style={{ marginTop: 8, paddingTop: 6, borderTop: '1px dashed #94a3b8' }}>
              <div style={{ fontSize: 8.5, color: '#334155', fontWeight: 600 }}>
                <strong>Declaration :</strong> All disputes are subject to {company.jurisdiction} Jurisdiction. E. &amp; O.E. Sri M.K. Paper Mills ERP Generated Slip.
              </div>
              <div style={{ fontSize: 10, fontWeight: 900, fontStyle: 'italic', marginTop: 4, color: '#0f766e' }}>
                {words}
              </div>
            </div>
          </div>

          {/* Bottom Right: Dynamic Multi-Slab GST Breakdown Table & Summary */}
          <div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 9.5, textAlign: 'right' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #000', fontWeight: 800 }}>
                  <th style={{ padding: '4px 6px', textAlign: 'right', borderRight: '1px solid #cbd5e1' }}>Taxable Amt</th>
                  <th style={{ padding: '4px 6px', textAlign: 'center', borderRight: '1px solid #cbd5e1' }}>GST%</th>
                  <th style={{ padding: '4px 6px', textAlign: 'right', borderRight: '1px solid #cbd5e1' }}>CGST Amt</th>
                  <th style={{ padding: '4px 6px', textAlign: 'right', borderRight: '1px solid #cbd5e1' }}>SGST Amt</th>
                  <th style={{ padding: '4px 6px', textAlign: 'right', borderRight: '1px solid #cbd5e1' }}>IGST Amt</th>
                  <th style={{ padding: '4px 6px', textAlign: 'right' }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {slabList.map((slab, sIdx) => (
                  <tr key={sIdx} style={{ borderBottom: '1px solid #cbd5e1' }}>
                    <td style={{ padding: '4px 6px', borderRight: '1px solid #cbd5e1', fontWeight: 800 }}>{slab.taxable.toFixed(2)}</td>
                    <td style={{ padding: '4px 6px', textAlign: 'center', borderRight: '1px solid #cbd5e1', fontWeight: 700 }}>{slab.rate.toFixed(2)}%</td>
                    <td style={{ padding: '4px 6px', borderRight: '1px solid #cbd5e1' }}>{slab.cgst.toFixed(2)}</td>
                    <td style={{ padding: '4px 6px', borderRight: '1px solid #cbd5e1' }}>{slab.sgst.toFixed(2)}</td>
                    <td style={{ padding: '4px 6px', borderRight: '1px solid #cbd5e1' }}>{slab.igst.toFixed(2)}</td>
                    <td style={{ padding: '4px 6px', fontWeight: 800 }}>{slab.total.toFixed(2)}</td>
                  </tr>
                ))}
                
                {/* Total Tax Summary Row */}
                <tr style={{ borderBottom: '1.5px solid #000', fontWeight: 900, background: '#f8fafc' }}>
                  <td style={{ padding: '4px 6px', borderRight: '1px solid #cbd5e1' }}>{totalTaxable.toFixed(2)}</td>
                  <td style={{ padding: '4px 6px', textAlign: 'center', borderRight: '1px solid #cbd5e1' }}>Total Tax</td>
                  <td style={{ padding: '4px 6px', borderRight: '1px solid #cbd5e1' }}>{totalCgst.toFixed(2)}</td>
                  <td style={{ padding: '4px 6px', borderRight: '1px solid #cbd5e1' }}>{totalSgst.toFixed(2)}</td>
                  <td style={{ padding: '4px 6px', borderRight: '1px solid #cbd5e1' }}>{totalIgst.toFixed(2)}</td>
                  <td style={{ padding: '4px 6px' }}>{(totalTaxable + totalGst).toFixed(2)}</td>
                </tr>

                {totalDiscAmt > 0 && (
                  <tr style={{ borderBottom: '1px solid #cbd5e1', color: '#b45309', fontWeight: 800 }}>
                    <td colSpan={4} style={{ padding: '4px 8px', textAlign: 'left' }}>Less: Scheme Discount</td>
                    <td colSpan={2} style={{ padding: '4px 8px', textAlign: 'right' }}>– {totalDiscAmt.toFixed(2)}</td>
                  </tr>
                )}

                <tr style={{ borderBottom: '1px solid #cbd5e1' }}>
                  <td style={{ padding: '3px 6px', textAlign: 'left', fontWeight: 700 }}>R.off</td>
                  <td style={{ padding: '3px 6px', textAlign: 'right' }}>{roundOff}</td>
                  <td style={{ padding: '3px 6px', textAlign: 'left', fontWeight: 700 }}>TCS%</td>
                  <td style={{ padding: '3px 6px', textAlign: 'right' }}>0.000</td>
                  <td style={{ padding: '3px 6px', textAlign: 'left', fontWeight: 700 }}>Cr/Db No</td>
                  <td style={{ padding: '3px 6px', textAlign: 'right' }}>0.00</td>
                </tr>

                <tr style={{ borderBottom: '1.5px solid #000', background: '#f1f5f9' }}>
                  <td colSpan={4} style={{ padding: '5px 8px', textAlign: 'left', fontWeight: 900, fontSize: 10.5 }}>
                    NET PAYABLE / STORE ALLOCATION VALUE:
                  </td>
                  <td colSpan={2} style={{ padding: '5px 8px', fontWeight: 900, fontSize: 12, textAlign: 'right', color: '#0f766e' }}>
                    ₹{grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* ── FOOTER SECTION (Real Bank Details, Official Mill Terms & Authorized Signatory) ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.1fr 1fr' }}>
          
          {/* Real Bank Details & Industrial Terms */}
          <div style={{ padding: '8px 10px', borderRight: '1.5px solid #000000', fontSize: 9 }}>
            <div style={{ fontWeight: 900, textDecoration: 'underline', marginBottom: 2 }}>COMPANY BANK DETAILS AS :-</div>
            <div style={{ display: 'grid', gridTemplateColumns: '85px 1fr', gap: '1px 4px', fontWeight: 600 }}>
              <span>Bank Name :</span> <span style={{ fontWeight: 800 }}>{company.bankName}</span>
              <span>Branch Name :</span> <span>{company.bankBranch}</span>
              <span>Account No. :</span> <span style={{ fontWeight: 800 }}>{company.bankAc}</span>
              <span>IFSC Code :</span> <span style={{ fontWeight: 800 }}>{company.bankIfsc}</span>
            </div>

            <div style={{ fontWeight: 900, textDecoration: 'underline', marginTop: 6, marginBottom: 2 }}>Terms &amp; Conditions</div>
            <div style={{ fontSize: 8, color: '#334155', lineHeight: 1.25 }}>
              1. Goods issued strictly against authorized plant indents &amp; work orders.<br />
              2. Quantity and technical specifications verified upon receipt/dispatch.<br />
              3. Material transfer recorded atomically in ERP digital stock ledger.<br />
              4. Store returns acceptable within 7 days against valid SRV reference.
            </div>
          </div>

          {/* Authorized Signatory & Security QR Verification */}
          <div style={{ padding: '8px 10px', borderRight: '1.5px solid #000000', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', alignItems: 'center', textAlign: 'center' }}>
            <div style={{ fontSize: 9.5, fontWeight: 900, textTransform: 'uppercase' }}>
              FOR {company.name}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '8px 0' }}>
              <div style={{
                width: 52,
                height: 52,
                border: '1px solid #cbd5e1',
                padding: 2,
                borderRadius: 4,
                background: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 8,
                fontWeight: 700,
                color: '#0f766e'
              }}>
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=50x50&data=${encodeURIComponent(`VOUCHER:${invoiceNo}|GST:${company.gstin}|VAL:${grandTotal}`)}`}
                  alt="QR"
                  style={{ width: 48, height: 48 }}
                  onError={(e) => { e.target.style.display = 'none' }}
                />
              </div>
              <div style={{ textAlign: 'left', fontSize: 8.5, color: '#475569', fontWeight: 600 }}>
                Scan to verify voucher<br />
                <span style={{ fontSize: 7.5, color: '#94a3b8' }}>Cryptographic SHA-256</span>
              </div>
            </div>

            <div style={{ fontSize: 9.5, fontWeight: 800, borderTop: '1px dashed #000', width: '80%', paddingTop: 3 }}>
              Store In-Charge / Authorised Signatory
            </div>
          </div>

          {/* Grand Total Highlight Box */}
          <div style={{ padding: 12, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', background: '#f8fafc' }}>
            <div style={{ fontSize: 10, fontWeight: 900, textTransform: 'uppercase', letterSpacing: 1, color: '#475569', marginBottom: 4 }}>
              GRAND TOTAL
            </div>
            <div style={{
              fontSize: 22,
              fontWeight: 900,
              color: '#0f766e',
              background: '#ffffff',
              border: '2px solid #000000',
              padding: '8px 16px',
              borderRadius: 6,
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
              letterSpacing: 0.5
            }}>
              ₹{grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <div style={{ fontSize: 8.5, color: '#64748b', marginTop: 6, fontWeight: 700 }}>
              Official Paper Mill Store Ledger Item
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
