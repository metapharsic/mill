const router = require('express').Router();
const pool = require('../db/pool');
const { auth, requireLevel, requireStoreManager } = require('../middleware/auth');
const { publish, TOPICS } = require('../kafka');
const ar = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// Helper: insert audit log row
async function auditLog(client, { userId, action, module, recordId, oldData, newData, ip }) {
  await client.query(
    `INSERT INTO audit_log (user_id, action, module, record_id, old_data, new_data, ip_address)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [userId, action, module, recordId, oldData ? JSON.stringify(oldData) : null,
     newData ? JSON.stringify(newData) : null, ip || null]
  );
}

// AR OVERVIEW — receivables from customers (accurate computation using sales_orders and payments)
router.get('/ar', auth, requireLevel(3), ar(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT c.id, c.code, c.name, c.credit_limit as "creditLimit", c.credit_days as "creditDays",
            COUNT(so.id) as total_orders,
            COALESCE(SUM(so.total_value),0) as total_billed,
            (COALESCE(SUM(so.total_value),0) - COALESCE((
              SELECT SUM(p.amount)
              FROM payments p
              WHERE p.sales_order_id IN (
                SELECT id FROM sales_orders WHERE customer_id = c.id AND status != 'Cancelled'
              )
            ),0)) as outstanding
     FROM customers c
     LEFT JOIN sales_orders so ON so.customer_id=c.id AND so.status != 'Cancelled'
     WHERE c.is_active=true
     GROUP BY c.id,c.code,c.name,c.credit_limit,c.credit_days
     ORDER BY outstanding DESC`
  );
  const totalOutstanding = rows.reduce((s,r)=>s+parseFloat(r.outstanding||0),0);
  const totalBilled = rows.reduce((s,r)=>s+parseFloat(r.total_billed||0),0);
  res.json({ success:true, data:{ customers:rows, totalOutstanding, totalBilled }});
}));// AP OVERVIEW — payables to vendors (computed live from active vendor bills & POs)
router.get('/ap', auth, requireLevel(2), ar(async (req, res) => {
  // NOTE: bills and POs are both one-to-many off vendors, so joining them directly in one
  // query fans out (N bills x M POs rows per vendor) and multiplies every SUM(). Aggregate
  // each side independently via LATERAL first (same fix pattern already used for the
  // p2p-pipeline GRN/bill/payment fan-out in purchase.js) before combining per vendor.
  const { rows } = await pool.query(
    `SELECT v.id, v.code, v.name, v.credit_days as "creditDays",
            COALESCE(bills.total_bills, 0)::int as total_bills,
            COALESCE(bills.total_billed, 0) as total_billed,
            COALESCE(bills.total_paid, 0) as total_paid,
            COALESCE(bills.outstanding, 0) as outstanding,
            COALESCE(pos.total_pos, 0)::int as total_pos,
            COALESCE(pos.open_po_value, 0) as open_po_value
     FROM vendors v
     LEFT JOIN LATERAL (
       SELECT COUNT(*)::int as total_bills,
              COALESCE(SUM(vb.total_amount), 0) as total_billed,
              COALESCE(SUM(vb.paid_amount), 0) as total_paid,
              COALESCE(SUM(vb.balance_amount), 0) as outstanding
       FROM vendor_bills vb
       WHERE vb.vendor_id = v.id AND vb.status != 'Cancelled'
     ) bills ON TRUE
     LEFT JOIN LATERAL (
       SELECT COUNT(*)::int as total_pos,
              COALESCE(SUM(CASE WHEN po.status IN ('Approved', 'Partial') THEN po.grand_total ELSE 0 END), 0) as open_po_value
       FROM purchase_orders po
       WHERE po.vendor_id = v.id AND po.date >= NOW() - INTERVAL '1 year'
     ) pos ON TRUE
     WHERE v.is_active = true
     ORDER BY outstanding DESC, total_billed DESC`
  );
  const totalOutstanding = rows.reduce((s, r) => s + parseFloat(r.outstanding || 0), 0);
  const totalBilled = rows.reduce((s, r) => s + parseFloat(r.total_billed || 0), 0);
  const totalPaid = rows.reduce((s, r) => s + parseFloat(r.total_paid || 0), 0);
  res.json({ success: true, data: { vendors: rows, totalOutstanding, totalBilled, totalPaid } });
}));

// STOCK VALUATION
router.get('/stock-valuation', auth, requireLevel(2), ar(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT mc.name as category, mc.type,
            COUNT(m.id) as items,
            COALESCE(SUM(m.current_stock*m.unit_price),0) as value
     FROM materials m
     JOIN material_categories mc ON mc.id=m.category_id
     WHERE m.is_active=true
     GROUP BY mc.id,mc.name,mc.type ORDER BY value DESC`
  );
  const total = rows.reduce((s,r)=>s+parseFloat(r.value||0),0);
  res.json({ success:true, data:{ byCategory:rows, totalValue:total }});
}));

// FINANCIAL SUMMARY
router.get('/summary', auth, requireLevel(2), ar(async (req, res) => {
  const monthStart = new Date().toISOString().slice(0,7)+'-01';
  const [sales, purchases, stock, ap] = await Promise.all([
    pool.query(`SELECT COALESCE(SUM(total_value),0) as revenue FROM sales_orders WHERE DATE(date)>=$1 AND status!='Cancelled'`, [monthStart]),
    pool.query(`SELECT COALESCE(SUM(grand_total),0) as spend FROM purchase_orders WHERE DATE(date)>=$1 AND status!='Cancelled'`, [monthStart]),
    pool.query(`SELECT COALESCE(SUM(current_stock*unit_price),0) as value FROM materials WHERE is_active=true`),
    pool.query(`SELECT COALESCE(SUM(balance_amount),0) as total_ap FROM vendor_bills WHERE status IN ('Pending Approval', 'Approved', 'Partially Paid')`),
  ]);
  res.json({ success:true, data:{
    monthRevenue: parseFloat(sales.rows[0].revenue||0),
    monthSpend:   parseFloat(purchases.rows[0].spend||0),
    stockValue:   parseFloat(stock.rows[0].value||0),
    totalAccountsPayable: parseFloat(ap.rows[0].total_ap||0),
    grossMargin:  parseFloat(sales.rows[0].revenue||0) - parseFloat(purchases.rows[0].spend||0),
  }});
}));

// ── VENDOR BILLS (AP INVOICES) ──────────────────────────────────────────────

// GET /api/finance/bills — list all vendor bills
router.get('/bills', auth, requireLevel(2), ar(async (req, res) => {
  const { status, vendor_id, search, page=1, limit=50 } = req.query;
  const conds = []; const params = []; let p = 1;
  if (status)    { conds.push(`vb.status = $${p++}`); params.push(status); }
  if (vendor_id) { conds.push(`vb.vendor_id = $${p++}`); params.push(vendor_id); }
  if (search) {
    conds.push(`(vb.bill_number ILIKE $${p} OR vb.vendor_invoice_number ILIKE $${p} OR v.name ILIKE $${p} OR po.po_number ILIKE $${p} OR g.grn_number ILIKE $${p})`);
    params.push(`%${search}%`);
    p++;
  }
  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
  const offset = (parseInt(page)-1)*parseInt(limit);

  const { rows } = await pool.query(
    `SELECT vb.id, vb.bill_number as "billNumber", vb.vendor_invoice_number as "vendorInvoiceNumber",
            vb.invoice_date as "invoiceDate", vb.due_date as "dueDate",
            vb.taxable_amount as "taxableAmount", vb.cgst_amount as "cgstAmount", vb.sgst_amount as "sgstAmount",
            vb.igst_amount as "igstAmount", vb.total_tax as "totalTax", vb.roundoff,
            vb.total_amount as "totalAmount", vb.paid_amount as "paidAmount", vb.balance_amount as "balanceAmount",
            vb.status, vb.remarks, vb.created_at as "createdAt",
            v.id as "vendorId", v.name as "vendorName", v.code as "vendorCode", v.gstin as "vendorGstin",
            v.bank_name as "vendorBankName", v.account_number as "vendorAccountNumber",
            v.ifsc_code as "vendorIfscCode", v.branch_name as "vendorBranchName",
            v.account_holder_name as "vendorAccountHolderName", v.account_type as "vendorAccountType",
            po.id as "poId", po.po_number as "poNumber", po.grand_total as "poGrandTotal",
            g.id as "grnId", g.grn_number as "grnNumber",
            u.name as "createdByName",
            appr.name as "approvedByName"
     FROM vendor_bills vb
     LEFT JOIN vendors v ON v.id = vb.vendor_id
     LEFT JOIN purchase_orders po ON po.id = vb.po_id
     LEFT JOIN grn g ON g.id = vb.grn_id
     LEFT JOIN users u ON u.id = vb.created_by
     LEFT JOIN users appr ON appr.id = vb.approved_by
     ${where}
     ORDER BY vb.created_at DESC
     LIMIT $${p} OFFSET $${p+1}`,
    [...params, parseInt(limit), offset]
  );
  const { rows: cnt } = await pool.query(
    `SELECT COUNT(*) FROM vendor_bills vb
     LEFT JOIN vendors v ON v.id = vb.vendor_id
     LEFT JOIN purchase_orders po ON po.id = vb.po_id
     LEFT JOIN grn g ON g.id = vb.grn_id
     ${where}`, params
  );

  // NOTE: must join purchase_orders/grn here too — the shared `where` clause references
  // po.po_number / g.grn_number when `search` is set, and without these joins the query
  // 500s with "missing FROM-clause entry for table po" (only reproduces when searching).
  const { rows: [sumRow] } = await pool.query(
    `SELECT COALESCE(SUM(vb.total_amount),0) as "totalBillAmount",
            COALESCE(SUM(vb.paid_amount),0) as "totalPaidAmount",
            COALESCE(SUM(vb.balance_amount),0) as "totalBalanceAmount"
     FROM vendor_bills vb
     LEFT JOIN vendors v ON v.id = vb.vendor_id
     LEFT JOIN purchase_orders po ON po.id = vb.po_id
     LEFT JOIN grn g ON g.id = vb.grn_id
     ${where}`, params
  );

  res.json({
    success: true,
    data: rows,
    total: parseInt(cnt[0].count),
    summary: {
      totalBillAmount: parseFloat(sumRow?.totalBillAmount || 0),
      totalPaidAmount: parseFloat(sumRow?.totalPaidAmount || 0),
      totalBalanceAmount: parseFloat(sumRow?.totalBalanceAmount || 0),
    }
  });
}));

// GET /api/finance/bills/:id — single bill with full details
router.get('/bills/:id', auth, requireLevel(2), ar(async (req, res) => {
  const { rows: [bill] } = await pool.query(
    `SELECT vb.*, vb.bill_number as "billNumber", vb.vendor_invoice_number as "vendorInvoiceNumber",
            vb.invoice_date as "invoiceDate", vb.due_date as "dueDate",
            vb.taxable_amount as "taxableAmount", vb.total_amount as "totalAmount",
            vb.paid_amount as "paidAmount", vb.balance_amount as "balanceAmount",
            v.name as "vendorName", v.code as "vendorCode", v.gstin as "vendorGstin", v.address as "vendorAddress",
            v.bank_name as "vendorBankName", v.account_number as "vendorAccountNumber",
            v.ifsc_code as "vendorIfscCode", v.branch_name as "vendorBranchName",
            v.account_holder_name as "vendorAccountHolderName", v.account_type as "vendorAccountType",
            po.po_number as "poNumber", po.date as "poDate", po.grand_total as "poGrandTotal",
            g.grn_number as "grnNumber", g.date as "grnDate",
            u.name as "createdByName", appr.name as "approvedByName"
     FROM vendor_bills vb
     LEFT JOIN vendors v ON v.id = vb.vendor_id
     LEFT JOIN purchase_orders po ON po.id = vb.po_id
     LEFT JOIN grn g ON g.id = vb.grn_id
     LEFT JOIN users u ON u.id = vb.created_by
     LEFT JOIN users appr ON appr.id = vb.approved_by
     WHERE vb.id = $1`,
    [req.params.id]
  );
  if (!bill) return res.status(404).json({ success: false, message: 'Vendor bill not found' });

  // Get payments made against this bill
  const { rows: payments } = await pool.query(
    `SELECT vp.*, u.name as "recordedByName"
     FROM vendor_payments vp
     LEFT JOIN users u ON u.id = vp.recorded_by
     WHERE vp.bill_id = $1
     ORDER BY vp.payment_date DESC, vp.created_at DESC`,
    [bill.id]
  );

  res.json({ success: true, data: { ...bill, payments } });
}));

// POST /api/finance/bills — manually book a vendor bill
router.post('/bills', auth, requireLevel(2), ar(async (req, res) => {
  const { vendor_id, po_id, grn_id, vendor_invoice_number, invoice_date, due_date, taxable_amount, cgst_amount=0, sgst_amount=0, igst_amount=0, roundoff=0, remarks } = req.body;
  if (!vendor_id || !vendor_invoice_number || !invoice_date || taxable_amount === undefined) {
    return res.status(400).json({ success: false, message: 'Vendor, Invoice Number, Date, and Taxable Amount are required' });
  }

  const taxAmount = Number(taxable_amount || 0);
  const cgst = Number(cgst_amount || 0);
  const sgst = Number(sgst_amount || 0);
  const igst = Number(igst_amount || 0);
  const totalTax = cgst + sgst + igst;
  const rOff = Number(roundoff || 0);
  const totalAmt = taxAmount + totalTax + rOff;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Guard: a bill must be payable against what was actually ACCEPTED at GRN/QC, not the
    // PO's ordered qty — otherwise the mill ends up paying for goods that were rejected or
    // never received. Reject bills whose taxable amount materially exceeds the GRN's accepted
    // value (small tolerance for freight/rounding differences already reflected in remarks).
    if (grn_id) {
      const { rows: [grnVal] } = await client.query(
        `SELECT COALESCE(SUM(gi.accepted_qty * COALESCE(gi.unit_price, 0)), 0) as accepted_value
         FROM grn_items gi WHERE gi.grn_id = $1`,
        [grn_id]
      );
      const acceptedValue = Number(grnVal?.accepted_value || 0);
      if (acceptedValue > 0 && taxAmount > acceptedValue * 1.02) {
        throw new Error(`Bill taxable amount (₹${taxAmount.toFixed(2)}) exceeds the GRN's accepted (post-QC) goods value (₹${acceptedValue.toFixed(2)}). Bills must be booked against ACCEPTED quantity, not ordered quantity.`);
      }
    }

    const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [`bill-${stamp}`]);
    const { rows: seqRows } = await client.query(`SELECT LPAD((COUNT(*)+1)::text, 4, '0') as seq FROM vendor_bills WHERE bill_number LIKE $1`, [`BILL-${stamp}-%`]);
    const billNum = `BILL-${stamp}-${seqRows[0].seq}`;

    const { rows: [bill] } = await client.query(
      `INSERT INTO vendor_bills (
         bill_number, vendor_id, po_id, grn_id, vendor_invoice_number,
         invoice_date, due_date, taxable_amount, cgst_amount, sgst_amount,
         igst_amount, total_tax, roundoff, total_amount, paid_amount,
         balance_amount, status, remarks, created_by
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 0, $14, 'Pending Approval', $15, $16)
       RETURNING *`,
      [billNum, vendor_id, po_id||null, grn_id||null, vendor_invoice_number, invoice_date, due_date||invoice_date, taxAmount, cgst, sgst, igst, totalTax, rOff, totalAmt, remarks||null, req.user.id]
    );

    await client.query('COMMIT');
    res.status(201).json({ success: true, data: bill, message: `Vendor Bill ${billNum} booked successfully` });
  } catch (e) {
    await client.query('ROLLBACK');
    return res.status(400).json({ success: false, message: e.message });
  } finally {
    client.release();
  }
}));

// PUT /api/finance/bills/:id/approve — Finance approves vendor bill for payment
router.put('/bills/:id/approve', auth, requireLevel(3), ar(async (req, res) => {
  const { rows: [bill] } = await pool.query(`SELECT * FROM vendor_bills WHERE id=$1`, [req.params.id]);
  if (!bill) return res.status(404).json({ success: false, message: 'Vendor bill not found' });
  if (bill.status !== 'Pending Approval') {
    return res.status(400).json({ success: false, message: `Bill is already in '${bill.status}' status` });
  }

  const { rows: [updated] } = await pool.query(
    `UPDATE vendor_bills SET status='Approved', approved_by=$1, approved_at=NOW() WHERE id=$2 RETURNING *`,
    [req.user.id, req.params.id]
  );
  await auditLog(pool, { userId: req.user.id, action: 'VENDOR_BILL_APPROVED', module: 'Finance', recordId: updated.id, newData: updated, ip: req.ip });
  res.json({ success: true, data: updated, message: `Vendor Bill ${updated.bill_number} approved for payment` });
}));

// DELETE /api/finance/bills/:id — Delete vendor bill / invoice (Store Manager or Finance Level 3+ Only)
router.delete('/bills/:id', auth, ar(async (req, res) => {
  const roleLevel = req.user.role_level || 0;
  const deptCode = (req.user.dept_code || '').toUpperCase();
  const deptName = (req.user.department || '').toLowerCase();
  const isAuthorized = (roleLevel >= 3 && (['STORE', 'INV', 'RMS', 'FIN', 'PUR'].includes(deptCode) || deptName.includes('store') || deptName.includes('finance') || deptName.includes('inventory'))) || roleLevel >= 4;
  if (!isAuthorized) {
    return res.status(403).json({ success: false, message: 'Store Manager or Finance Manager authorization required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: [bill] } = await client.query(`SELECT * FROM vendor_bills WHERE id=$1 FOR UPDATE`, [req.params.id]);
    if (!bill) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Vendor bill not found' });
    }

    if (bill.status === 'Paid') {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'Cannot delete invoice: bill has already been paid in full. Reverse payments first.' });
    }

    await client.query(`DELETE FROM vendor_payments WHERE bill_id = $1`, [bill.id]);
    await client.query(`DELETE FROM vendor_bills WHERE id = $1`, [bill.id]);

    await auditLog(client, {
      userId: req.user.id,
      action: 'finance.bill.delete',
      module: 'Finance',
      recordId: bill.id,
      oldData: { bill_number: bill.bill_number, vendor_invoice_number: bill.vendor_invoice_number, total_amount: bill.total_amount },
      newData: { deleted: true },
      ip: req.ip
    });

    await client.query('COMMIT');
    res.json({ success: true, message: `Vendor bill / invoice ${bill.bill_number} removed successfully.` });
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(400).json({ success: false, message: e.message });
  } finally {
    client.release();
  }
}));

// ── VENDOR PAYMENTS (DISBURSEMENTS) ────────────────────────────────────────

// GET /api/finance/payments/vendor — list all vendor payments
router.get('/payments/vendor', auth, requireLevel(2), ar(async (req, res) => {
  const { vendor_id, bill_id, search, page=1, limit=50 } = req.query;
  const conds = []; const params = []; let p = 1;
  if (vendor_id) { conds.push(`vp.vendor_id = $${p++}`); params.push(vendor_id); }
  if (bill_id)   { conds.push(`vp.bill_id = $${p++}`); params.push(bill_id); }
  if (search) {
    conds.push(`(vp.payment_number ILIKE $${p} OR v.name ILIKE $${p} OR vb.bill_number ILIKE $${p} OR vp.reference_number ILIKE $${p})`);
    params.push(`%${search}%`);
    p++;
  }
  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
  const offset = (parseInt(page)-1)*parseInt(limit);

  const { rows } = await pool.query(
    `SELECT vp.id, vp.payment_number as "paymentNumber", vp.amount,
            vp.payment_date as "paymentDate", vp.payment_mode as "paymentMode",
            vp.bank_name as "bankName", vp.reference_number as "referenceNumber",
            vp.status, vp.remarks, vp.created_at as "createdAt",
            v.id as "vendorId", v.name as "vendorName", v.code as "vendorCode",
            vb.id as "billId", vb.bill_number as "billNumber", vb.vendor_invoice_number as "vendorInvoiceNumber",
            u.name as "recordedByName", conf.name as "confirmedByName"
     FROM vendor_payments vp
     LEFT JOIN vendors v ON v.id = vp.vendor_id
     LEFT JOIN vendor_bills vb ON vb.id = vp.bill_id
     LEFT JOIN users u ON u.id = vp.recorded_by
     LEFT JOIN users conf ON conf.id = vp.confirmed_by
     ${where}
     ORDER BY vp.payment_date DESC, vp.created_at DESC
     LIMIT $${p} OFFSET $${p+1}`,
    [...params, parseInt(limit), offset]
  );
  const { rows: cnt } = await pool.query(
    `SELECT COUNT(*) FROM vendor_payments vp
     LEFT JOIN vendors v ON v.id = vp.vendor_id
     LEFT JOIN vendor_bills vb ON vb.id = vp.bill_id
     ${where}`, params
  );
  // Must be a full-set SQL aggregate, not a reduce() over `rows` — `rows` is only the current
  // page (LIMIT/OFFSET), so summing it undercounts totalAmount once results exceed one page.
  const { rows: [sumRow] } = await pool.query(
    `SELECT COALESCE(SUM(vp.amount), 0) as "totalAmount"
     FROM vendor_payments vp
     LEFT JOIN vendors v ON v.id = vp.vendor_id
     LEFT JOIN vendor_bills vb ON vb.id = vp.bill_id
     ${where}`, params
  );

  res.json({ success: true, data: rows, total: parseInt(cnt[0].count), totalAmount: parseFloat(sumRow?.totalAmount || 0) });
}));

// POST /api/finance/payments/vendor — record vendor payment disbursal
router.post('/payments/vendor', auth, requireLevel(3), ar(async (req, res) => {
  const { bill_id, vendor_id, po_id, amount, payment_date, payment_mode, bank_name, reference_number, remarks } = req.body;
  if (!amount || Number(amount) <= 0 || !payment_mode) {
    return res.status(400).json({ success: false, message: 'Valid amount and payment mode are required' });
  }

  const payAmt = Number(amount);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    let finalVendorId = vendor_id;
    let finalPoId = po_id;

    if (bill_id) {
      const { rows: [bill] } = await client.query(`SELECT * FROM vendor_bills WHERE id=$1 FOR UPDATE`, [bill_id]);
      if (!bill) throw new Error('Vendor bill not found');
      if (bill.status === 'Paid') throw new Error('Vendor bill is already fully paid');
      if (payAmt > Number(bill.balance_amount) + 0.01) {
        throw new Error(`Payment amount (₹${payAmt}) cannot exceed bill balance (₹${bill.balance_amount})`);
      }
      finalVendorId = bill.vendor_id;
      finalPoId = bill.po_id;

      const newPaid = Number(bill.paid_amount) + payAmt;
      const newBal = Math.max(0, Number(bill.total_amount) - newPaid);
      const newStatus = newBal <= 0.01 ? 'Paid' : 'Partially Paid';

      await client.query(
        `UPDATE vendor_bills SET paid_amount=$1, balance_amount=$2, status=$3 WHERE id=$4`,
        [newPaid, newBal, newStatus, bill.id]
      );
    }

    if (!finalVendorId) throw new Error('Vendor ID is required');

    // Generate Payment Number with advisory lock
    const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [`vpy-${stamp}`]);
    const { rows: seqRows } = await client.query(`SELECT LPAD((COUNT(*)+1)::text, 4, '0') as seq FROM vendor_payments WHERE payment_number LIKE $1`, [`VPY-${stamp}-%`]);
    const payNum = `VPY-${stamp}-${seqRows[0].seq}`;

    const { rows: [payment] } = await client.query(
      `INSERT INTO vendor_payments (
         payment_number, vendor_id, bill_id, po_id, amount,
         payment_date, payment_mode, bank_name, reference_number,
         status, remarks, recorded_by
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'Paid', $10, $11)
       RETURNING *`,
      [payNum, finalVendorId, bill_id || null, finalPoId || null, payAmt, payment_date || new Date(), payment_mode, bank_name || null, reference_number || null, remarks || null, req.user.id]
    );

    await auditLog(client, { userId: req.user.id, action: 'VENDOR_PAYMENT_DISBURSED', module: 'Finance', recordId: payment.id, newData: payment, ip: req.ip });
    await client.query('COMMIT');

    publish(TOPICS.EVENTS_ALL, `vpayment-${payment.id}`, { event: 'finance.vendor_payment.disbursed', id: payment.id, paymentNumber: payNum, amount: payAmt, vendorId: finalVendorId, billId: bill_id, userId: req.user.id });
    res.status(201).json({ success: true, data: payment, message: `Vendor Payment ${payNum} of ₹${payAmt} recorded successfully` });
  } catch (e) {
    await client.query('ROLLBACK');
    return res.status(400).json({ success: false, message: e.message });
  } finally {
    client.release();
  }
}));

// CUSTOMER PAYMENTS
router.get('/payments', auth, requireLevel(2), ar(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT p.id, p.payment_number as "paymentNumber", p.amount, p.payment_date as "paymentDate",
            p.payment_mode as "paymentMode", p.reference_number as "referenceNumber",
            p.remarks, so.so_number as "soNumber", c.name as "customerName",
            p.status, p.recorded_by as "recordedBy"
     FROM payments p
     LEFT JOIN sales_orders so ON p.sales_order_id = so.id
     LEFT JOIN customers c ON so.customer_id = c.id
     ORDER BY p.payment_date DESC, p.created_at DESC`
  );
  res.json({ success: true, data: rows });
}));

router.post('/payments', auth, requireLevel(3), ar(async (req, res) => {
  const { sales_order_id, amount, payment_date, payment_mode, reference_number, remarks } = req.body;
  if (!sales_order_id || !amount || !payment_mode) {
    return res.status(400).json({ success: false, message: 'sales_order_id, amount, and payment_mode are required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const today = new Date();
    const stamp = today.toISOString().slice(0, 10).replace(/-/g, '');
    await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [`py-${stamp}`]);
    const { rows: seqRows } = await client.query(
      `SELECT LPAD((COUNT(*) + 1)::text, 4, '0') AS seq FROM payments WHERE payment_number LIKE $1`,
      [`PY-${stamp}-%`]
    );
    const paymentNumber = `PY-${stamp}-${seqRows[0].seq}`;

    const { rows } = await client.query(
      `INSERT INTO payments (payment_number, sales_order_id, amount, payment_date, payment_mode, reference_number, recorded_by, remarks)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [paymentNumber, sales_order_id, amount, payment_date || today, payment_mode, reference_number || null, req.user.id, remarks || null]
    );

    const payment = rows[0];
    await auditLog(client, { userId: req.user.id, action: 'PAYMENT_RECORDED', module: 'Finance', recordId: payment.id, newData: payment, ip: req.ip });
    await client.query('COMMIT');
    publish(TOPICS.EVENTS_ALL, `payment-${payment.id}`, { event: 'finance.payment.recorded', id: payment.id, paymentNumber, amount, soId: sales_order_id, userId: req.user.id });
    res.status(201).json({ success: true, data: payment });
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}));

router.put('/payments/:id/confirm', auth, requireLevel(3), ar(async (req, res) => {
  const { rows: [pay] } = await pool.query(`SELECT recorded_by, status FROM payments WHERE id=$1`, [req.params.id]);
  if (!pay) return res.status(404).json({ success: false, message: 'Not found' });
  if (pay.status === 'Confirmed') return res.json({ success: false, message: 'Already confirmed' });
  if (pay.recorded_by === req.user.id && req.user.role_level < 5) {
    return res.status(403).json({ success: false, message: 'Cannot confirm your own payment entry — needs different user (or admin override)' });
  }
  const { rows } = await pool.query(
    `UPDATE payments SET status='Confirmed', confirmed_by=$1, confirmed_at=NOW() WHERE id=$2 RETURNING *`,
    [req.user.id, req.params.id]
  );
  await auditLog(pool, { userId: req.user.id, action: 'PAYMENT_CONFIRMED', module: 'Finance', recordId: rows[0].id, newData: rows[0], ip: req.ip });
  publish(TOPICS.EVENTS_ALL, `payment-${rows[0].id}`, { event: 'finance.payment.confirmed', id: rows[0].id, userId: req.user.id });
  res.json({ success: true, data: rows[0] });
}));

// GET /api/finance/grn-bills — received GRN documents for AP bill booking & payment processing
router.get('/grn-bills', auth, requireLevel(2), ar(async (req, res) => {
  const { status, vendor_id, from, to } = req.query;
  const conds = ["g.status IN ('Received', 'Approved')"];
  const params = [];
  let p = 1;
  if (vendor_id) { conds.push(`g.vendor_id = $${p++}`); params.push(vendor_id); }
  if (from) { conds.push(`g.date >= $${p++}`); params.push(from); }
  if (to) { conds.push(`g.date <= $${p++}`); params.push(to); }
  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';

  const { rows } = await pool.query(`
    SELECT g.id,
           g.grn_number AS "grnNumber",
           g.date,
           g.status,
           g.invoice_number AS "invoiceNumber",
           g.challan_number AS "challanNumber",
           g.vehicle_number AS "vehicleNumber",
           g.remarks,
           v.id AS "vendorId",
           v.name AS "vendorName",
           v.code AS "vendorCode",
           v.payment_terms AS "paymentTerms",
           v.credit_days AS "creditDays",
           po.po_number AS "poNumber",
           po.grand_total AS "poGrandTotal",
           u.name AS "receivedByName",
           COUNT(gi.id)::int AS "itemCount",
           COALESCE(SUM(gi.accepted_qty * COALESCE(gi.unit_price, 0)), 0) AS "grnTotalValue"
    FROM grn g
    LEFT JOIN vendors v ON g.vendor_id = v.id
    LEFT JOIN purchase_orders po ON g.po_id = po.id
    LEFT JOIN users u ON g.received_by = u.id
    LEFT JOIN grn_items gi ON gi.grn_id = g.id
    ${where}
    GROUP BY g.id, v.id, v.name, v.code, v.payment_terms, v.credit_days, po.po_number, po.grand_total, u.name
    ORDER BY g.date DESC, g.id DESC
  `, params);

  const totalValue = rows.reduce((s, r) => s + parseFloat(r.grnTotalValue || 0), 0);
  res.json({ success: true, data: rows, summary: { totalCount: rows.length, totalValue } });
}));

// ============================================================================
// DEBIT NOTES & RTV ADJUSTMENTS
// ============================================================================

// GET /api/finance/debit-notes — List all debit notes generated from QC material rejections
router.get('/debit-notes', auth, requireLevel(2), ar(async (req, res) => {
  const { status, vendor_id } = req.query;
  const where = ['1=1'];
  const params = [];

  if (status) {
    params.push(status);
    where.push(`mr.status = $${params.length}`);
  }
  if (vendor_id) {
    params.push(vendor_id);
    where.push(`mr.vendor_id = $${params.length}`);
  }

  const { rows } = await pool.query(`
    SELECT mr.id,
           mr.rejection_number AS "rejectionNumber",
           mr.rejected_qty AS "rejectedQty",
           mr.uom,
           mr.unit_price AS "unitPrice",
           mr.debit_amount AS "debitAmount",
           mr.rejection_reason AS "rejectionReason",
           mr.status,
           mr.created_at AS "createdAt",
           v.id AS "vendorId",
           v.name AS "vendorName",
           v.code AS "vendorCode",
           v.gstin AS "vendorGstin",
           m.id AS "materialId",
           m.name AS "materialName",
           m.code AS "materialCode",
           po.po_number AS "poNumber",
           g.grn_number AS "grnNumber"
    FROM material_rejections mr
    LEFT JOIN vendors v ON mr.vendor_id = v.id
    LEFT JOIN materials m ON mr.material_id = m.id
    LEFT JOIN purchase_orders po ON mr.po_id = po.id
    LEFT JOIN grn g ON mr.grn_id = g.id
    WHERE ${where.join(' AND ')}
    ORDER BY mr.created_at DESC
  `, params);

  const totalDebit = rows.reduce((s, r) => s + parseFloat(r.debitAmount || 0), 0);
  res.json({ success: true, data: rows, totalDebit });
}));

// POST /api/finance/debit-notes/:id/apply — Apply Debit Note to offset a Vendor Bill
router.post('/debit-notes/:id/apply', auth, requireLevel(3), ar(async (req, res) => {
  const { billId } = req.body;
  if (!billId) return res.status(400).json({ success: false, message: 'Vendor Bill ID required' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: [rej] } = await client.query(
      `SELECT * FROM material_rejections WHERE id = $1 FOR UPDATE`,
      [req.params.id]
    );
    if (!rej) throw new Error('Debit Note / Rejection not found');

    const { rows: [bill] } = await client.query(
      `SELECT * FROM vendor_bills WHERE id = $1 FOR UPDATE`,
      [billId]
    );
    if (!bill) throw new Error('Vendor Bill not found');

    const debitAmt = parseFloat(rej.debit_amount || 0);
    const billBal = parseFloat(bill.balance_amount || 0);
    const newBal = Math.max(0, billBal - debitAmt);

    await client.query(
      `UPDATE vendor_bills 
       SET balance_amount = $1, 
           remarks = COALESCE(remarks, '') || ' | Offset by Debit Note #' || $2
       WHERE id = $3`,
      [newBal, rej.rejection_number, billId]
    );

    await client.query(
      `UPDATE material_rejections 
       SET status = 'Debit Note Raised' 
       WHERE id = $1`,
      [req.params.id]
    );

    await client.query('COMMIT');
    res.json({ success: true, message: `Debit Note of ₹${debitAmt} applied against Bill ${bill.bill_number}` });
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}));

module.exports = router;
