const router = require('express').Router();
const pool = require('../db/pool');
const { auth, requireLevel, requireStoreManager } = require('../middleware/auth');
const { getVendors } = require('../middleware/helpers');
const ar = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// Doc31 #8: advisory lock, same pattern as indent.js seqNum.
const seqNum = async (client) => {
  const stamp = new Date().toISOString().slice(0,10).replace(/-/g,'');
  await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [`po-${stamp}`]);
  const { rows } = await client.query(
    `SELECT LPAD((COUNT(*)+1)::text,4,'0') AS seq FROM purchase_orders WHERE po_number LIKE $1`,
    [`PO-${stamp}-%`]
  );
  return `PO-${stamp}-${rows[0].seq}`;
};

async function auditLog(client, { userId, action, module, recordId, oldData, newData, ip }) {
  try {
    await client.query(
      `INSERT INTO audit_logs (user_id, action, module, record_id, old_data, new_data, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [userId || null, action, module, recordId ? String(recordId) : null,
       oldData ? JSON.stringify(oldData) : null,
       newData ? JSON.stringify(newData) : null,
       ip || null]
    );
  } catch (e) {
    console.error('auditLog error:', e.message);
  }
}

// LIST VENDORS (for purchase order vendor dropdown)
router.get('/vendors', auth, ar(async (req, res) => {
  const rows = await getVendors({ is_active: true });
  res.json({ success: true, data: rows });
}));

// GET ALL PENDING INDENTS / PURCHASE REQUISITIONS (PR)
router.get('/pending-indents', auth, ar(async (req, res) => {
  const { search } = req.query;
  const conds = [`i.status NOT IN ('Closed', 'Cancelled', 'Rejected')`];
  const params = [];
  let p = 1;
  if (search) {
    conds.push(`(i.indent_number ILIKE $${p} OR d.name ILIKE $${p} OR u.name ILIKE $${p} OR i.remarks ILIKE $${p})`);
    params.push(`%${search}%`);
    p++;
  }
  const where = conds.join(' AND ');
  const { rows } = await pool.query(
    `SELECT i.id, i.indent_number as "indentNumber", i.date, i.required_date as "requiredDate",
            i.status, i.priority, i.remarks, i.total_value as "totalValue",
            d.name as "deptName", d.code as "deptCode",
            u.name as "raisedByName", u.employee_code as "raisedByEmpCode",
            po.id as "linkedPoId", po.po_number as "linkedPoNumber", po.status as "linkedPoStatus",
            (SELECT COUNT(*) FROM indent_items ii WHERE ii.indent_id = i.id) as "itemCount",
            COALESCE((
              SELECT json_agg(json_build_object(
                'id', ii.id,
                'material_id', ii.material_id,
                'materialName', m.name,
                'materialCode', m.code,
                'required_qty', ii.required_qty,
                'approved_qty', ii.approved_qty,
                'uom', COALESCE(ii.uom, m.uom),
                'unit_price', COALESCE(m.unit_price, 0),
                'current_stock', COALESCE(m.current_stock, 0),
                'component_position', ii.component_position,
                'reason_code', ii.reason_code,
                'purpose', ii.purpose
              ))
              FROM indent_items ii
              LEFT JOIN materials m ON m.id = ii.material_id
              WHERE ii.indent_id = i.id
            ), '[]'::json) as items
     FROM indents i
     LEFT JOIN departments d ON d.id = i.department_id
     LEFT JOIN users u ON u.id = i.raised_by
     LEFT JOIN purchase_orders po ON po.indent_id = i.id AND po.status != 'Cancelled'
     WHERE ${where}
     ORDER BY CASE WHEN po.id IS NULL THEN 0 ELSE 1 END ASC, i.created_at DESC`,
    params
  );
  res.json({ success: true, data: rows });
}));

// LIST POs WITH FULL LIFECYCLE LINKAGES (PR, GRN, PURCHASE BILLS)
router.get('/po', auth, ar(async (req, res) => {
  const { status, vendor_id, search, page=1, limit=50 } = req.query;
  const conds=[]; const params=[]; let p=1;
  if (status)    { conds.push(`po.status=$${p++}`); params.push(status); }
  if (vendor_id) { conds.push(`po.vendor_id=$${p++}`); params.push(vendor_id); }
  if (search)    { conds.push(`(po.po_number ILIKE $${p} OR v.name ILIKE $${p} OR ind.indent_number ILIKE $${p})`); params.push(`%${search}%`); p++; }
  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
  const offset = (parseInt(page)-1)*parseInt(limit);
  const { rows } = await pool.query(
    `SELECT po.id, po.po_number as "poNumber", po.po_number as "po_number", po.date, po.delivery_date as "deliveryDate",
            po.status, po.total_value as "totalValue", po.grand_total as "grandTotal",
            po.vendor_id as "vendor_id", po.vendor_id as "vendorId", po.indent_id as "indentId",
            v.name as "vendorName", v.code as "vendorCode", v.gstin as "vendorGstin",
            ind.indent_number as "indentNumber", dept.name as "deptName",
            g.grn_number as "grnNumber", g.status as "grnStatus", g.id as "grnId",
            vb.bill_number as "billNumber", vb.status as "billStatus", vb.id as "billId",
            COALESCE((SELECT COUNT(*) FROM po_items pi WHERE pi.po_id = po.id), 0)::int AS "itemCount"
     FROM purchase_orders po
     LEFT JOIN vendors v ON v.id=po.vendor_id
     LEFT JOIN indents ind ON ind.id=po.indent_id
     LEFT JOIN departments dept ON dept.id=ind.department_id
     LEFT JOIN LATERAL (
       SELECT id, grn_number, status FROM grn WHERE po_id = po.id ORDER BY created_at DESC LIMIT 1
     ) g ON TRUE
     LEFT JOIN LATERAL (
       SELECT id, bill_number, status FROM vendor_bills WHERE po_id = po.id OR grn_id = g.id ORDER BY created_at DESC LIMIT 1
     ) vb ON TRUE
     ${where} ORDER BY po.created_at DESC LIMIT $${p} OFFSET $${p+1}`,
    [...params, parseInt(limit), offset]
  );
  const { rows: cnt } = await pool.query(
    `SELECT COUNT(*) FROM purchase_orders po
     LEFT JOIN vendors v ON v.id=po.vendor_id
     LEFT JOIN indents ind ON ind.id=po.indent_id
     ${where}`, params
  );
  res.json({ success:true, data:rows, total:parseInt(cnt[0].count) });
}));

// GET ONE PO (by ID or PO Number)
router.get('/po/:id', auth, ar(async (req, res) => {
  const isNum = /^\d+$/.test(String(req.params.id));
  const where = isNum ? `WHERE po.id=$1` : `WHERE po.po_number=$1`;
  const paramVal = isNum ? parseInt(req.params.id) : req.params.id;

  const { rows } = await pool.query(
    `SELECT po.*, po.po_number as "poNumber", v.name as "vendorName", v.code as "vendorCode", v.gstin as "vendorGstin",
            v.state as "vendorState", v.city as "vendorCity", v.address as "vendorAddress", v.pincode as "vendorPincode",
            v.contact_person as "vendorContactPerson", v.mobile as "vendorMobile", v.email as "vendorEmail",
            v.bank_name as "vendorBankName", v.account_number as "vendorAccountNumber",
            v.ifsc_code as "vendorIfscCode", v.branch_name as "vendorBranchName",
            ind.indent_number as "indentNumber", ind.date as "indentDate", dept.name as "deptName"
     FROM purchase_orders po
     LEFT JOIN vendors v ON v.id=po.vendor_id
     LEFT JOIN indents ind ON ind.id=po.indent_id
     LEFT JOIN departments dept ON dept.id=ind.department_id
     ${where}`, [paramVal]
  );
  if (!rows.length) return res.json({ success:false, message:'Purchase order not found' });
  
  const poId = rows[0].id;
  const { rows: items } = await pool.query(
    `SELECT pi.*, m.name as "materialName", m.code as "materialCode", m.uom,
            m.hsn_code as "hsnCode", m.current_stock as "currentStock", m.bin_location as "binLocation",
            ii.required_qty as "indentRequiredQty"
     FROM po_items pi
     LEFT JOIN materials m ON m.id=pi.material_id
     LEFT JOIN indent_items ii ON ii.indent_id=$2 AND ii.material_id=pi.material_id
     WHERE pi.po_id=$1
     ORDER BY pi.id ASC`, [poId, rows[0].indent_id]
  );
  res.json({ success:true, data:{ ...rows[0], items } });
}));

// CREATE PO
router.post('/po', auth, requireLevel(3), ar(async (req, res) => {
  const { vendor_id, indent_id, delivery_date, payment_terms, remarks, items=[], status } = req.body;
  if (!vendor_id || !items.length) return res.json({ success:false, message:'Vendor + items required' });

  // High-standard validation: every line must be complete and sane before touching the db.
  // Draft saves allow incomplete qty/price (finish later); a real Create must be fully valid.
  const isDraftSave = status === 'Draft';
  const seen = new Set();
  for (const [idx, it] of items.entries()) {
    if (!it.material_id) return res.json({ success:false, message:`Line ${idx+1}: material is required` });
    if (!isDraftSave && !(parseFloat(it.qty) > 0)) return res.json({ success:false, message:`Line ${idx+1}: quantity must be greater than 0` });
    if (it.qty !== undefined && it.qty !== '' && parseFloat(it.qty) < 0) return res.json({ success:false, message:`Line ${idx+1}: quantity cannot be negative` });
    if (!isDraftSave && !(parseFloat(it.unit_price) >= 0)) return res.json({ success:false, message:`Line ${idx+1}: unit price cannot be negative` });
    if (it.unit_price !== undefined && it.unit_price !== '' && parseFloat(it.unit_price) < 0) return res.json({ success:false, message:`Line ${idx+1}: unit price cannot be negative` });
    const gst = parseFloat(it.gst_pct);
    if (it.gst_pct !== undefined && it.gst_pct !== '' && (isNaN(gst) || gst < 0 || gst > 100)) return res.json({ success:false, message:`Line ${idx+1}: GST% must be between 0 and 100` });
    if (seen.has(String(it.material_id))) return res.json({ success:false, message:`Line ${idx+1}: material already added in another line — combine quantities instead` });
    seen.add(String(it.material_id));
  }
  const { rows: [vendorRow] } = await pool.query(`SELECT id, is_active FROM vendors WHERE id=$1`, [vendor_id]);
  if (!vendorRow) return res.json({ success:false, message:'Selected vendor does not exist' });
  if (vendorRow.is_active === false) return res.json({ success:false, message:'Selected vendor is inactive — pick an active vendor' });
  const matIds = items.map(it => it.material_id);
  const { rows: matRows } = await pool.query(`SELECT id, is_active FROM materials WHERE id = ANY($1::int[])`, [matIds]);
  const matById = Object.fromEntries(matRows.map(m => [String(m.id), m]));
  for (const [idx, it] of items.entries()) {
    const m = matById[String(it.material_id)];
    if (!m) return res.json({ success:false, message:`Line ${idx+1}: material does not exist` });
    if (m.is_active === false) return res.json({ success:false, message:`Line ${idx+1}: material is inactive — cannot order` });
  }
  if (delivery_date && req.body.po_date && delivery_date < req.body.po_date) return res.json({ success:false, message:'Delivery date cannot be before PO date' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Guard against raising a PO from an indent that isn't ready, or that already has a live
    // (non-Cancelled) PO linked — without this, the same indent could be silently converted
    // into two different POs. Lock the indent row so a concurrent double-submit can't race past
    // this check either.
    let indentStatusBefore = null;
    if (indent_id) {
      const { rows: [indLock] } = await client.query(`SELECT status FROM indents WHERE id=$1 FOR UPDATE`, [indent_id]);
      if (!indLock) { await client.query('ROLLBACK'); return res.json({ success:false, message:'Linked indent not found' }); }
      if (indLock.status !== 'Approved') {
        await client.query('ROLLBACK');
        return res.json({ success:false, message:`Cannot raise PO — indent status is '${indLock.status}', expected 'Approved'` });
      }
      const { rows: existingPo } = await client.query(`SELECT id, po_number FROM purchase_orders WHERE indent_id=$1 AND status != 'Cancelled'`, [indent_id]);
      if (existingPo.length) {
        await client.query('ROLLBACK');
        return res.json({ success:false, message:`Indent already linked to PO ${existingPo[0].po_number}` });
      }
      indentStatusBefore = indLock.status;
    }
    const num = await seqNum(client);
    let totalTaxable = 0, totalDiscount = 0, totalOtherCharges = 0;
    let totalCgst = 0, totalSgst = 0, totalIgst = 0;
    const globalTaxType = (req.body.tax_type || (vendorRow?.gstin && !vendorRow.gstin.startsWith('29') ? 'inter' : 'intra')).toLowerCase();

    const preparedItems = items.map(it => {
      const q = parseFloat(it.qty) || 0;
      const p = parseFloat(it.unit_price) || 0;
      const gross = q * p;
      const discPct = Math.max(0, Math.min(100, parseFloat(it.discount_pct) || 0));
      const discAmt = gross * (discPct / 100);
      const discBase = Math.max(0, gross - discAmt);
      const otherCharges = parseFloat(it.other_charges) || 0;
      const taxable = Math.max(0, discBase + otherCharges);
      const taxType = (it.tax_type || globalTaxType).toLowerCase();
      const gstPct = it.gst_pct !== undefined && it.gst_pct !== '' ? parseFloat(it.gst_pct) : 18;

      let cgstPct = 0, sgstPct = 0, igstPct = 0;
      let cgstAmt = 0, sgstAmt = 0, igstAmt = 0;

      if (taxType === 'inter' || taxType === 'state' || taxType === 'igst') {
        igstPct = gstPct;
        igstAmt = taxable * (igstPct / 100);
      } else {
        cgstPct = gstPct / 2;
        sgstPct = gstPct / 2;
        cgstAmt = taxable * (cgstPct / 100);
        sgstAmt = taxable * (sgstPct / 100);
      }
      const lineTax = cgstAmt + sgstAmt + igstAmt;
      const lineTotal = taxable + lineTax;

      totalTaxable += taxable;
      totalDiscount += discAmt;
      totalOtherCharges += otherCharges;
      totalCgst += cgstAmt;
      totalSgst += sgstAmt;
      totalIgst += igstAmt;

      return {
        ...it,
        qty: q,
        unit_price: p,
        discount_pct: discPct,
        discount_amount: discAmt,
        other_charges: otherCharges,
        taxable_amount: taxable,
        tax_type: taxType,
        gst_pct: gstPct,
        cgst_pct: cgstPct,
        sgst_pct: sgstPct,
        igst_pct: igstPct,
        cgst_amount: cgstAmt,
        sgst_amount: sgstAmt,
        igst_amount: igstAmt,
        total: lineTotal
      };
    });

    const totalGst = totalCgst + totalSgst + totalIgst;
    const grandTotal = totalTaxable + totalGst;

    const { rows } = await client.query(
      `INSERT INTO purchase_orders (po_number,date,vendor_id,indent_id,delivery_date,payment_terms,
         status,tax_type,total_value,discount_value,other_charges,cgst_value,sgst_value,igst_value,gst_value,grand_total,created_by,remarks)
       VALUES ($1,NOW(),$2,$3,$4,$5,'Draft',$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING *`,
      [num, vendor_id, indent_id||null, delivery_date||null, payment_terms||null,
       globalTaxType, totalTaxable, totalDiscount, totalOtherCharges, totalCgst, totalSgst, totalIgst, totalGst, grandTotal, req.user.id, remarks||null]
    );
    const poId = rows[0].id;
    for (const it of preparedItems) {
      await client.query(
        `INSERT INTO po_items (
           po_id, material_id, qty, uom, unit_price,
           discount_pct, discount_amount, other_charges, taxable_amount,
           tax_type, gst_pct, cgst_pct, sgst_pct, igst_pct,
           cgst_amount, sgst_amount, igst_amount, total
         )
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)`,
        [poId, it.material_id, it.qty, it.uom||'', it.unit_price||0,
         it.discount_pct, it.discount_amount, it.other_charges, it.taxable_amount,
         it.tax_type, it.gst_pct, it.cgst_pct, it.sgst_pct, it.igst_pct,
         it.cgst_amount, it.sgst_amount, it.igst_amount, it.total]
      );
    }
    if (indent_id) {
      await client.query(`UPDATE indents SET status='PO Created' WHERE id=$1`, [indent_id]);
      await client.query(
        `INSERT INTO indent_audit_log (indent_id, action, old_status, new_status, user_id, remarks)
         VALUES ($1, 'PO Created', $2, 'PO Created', $3, $4)`,
        [indent_id, indentStatusBefore, req.user.id, `PO ${num} Created`]
      );
      // GAP-4 FIX: Always write store_indent_log for ALL indent types (removed incorrect store_indents table guard)
      await client.query(
        `INSERT INTO store_indent_log (indent_id,action,from_status,to_status,actor_id,actor_name,actor_role,note)
         VALUES ($1,'PO Created',$2,'PO Created',$3,$4,$5,$6)
         ON CONFLICT DO NOTHING`,
        [indent_id, indentStatusBefore, req.user.id, req.user.name||'System', req.user.role||'Procurement', `PO ${num} Created`]
      );
    }
    await client.query('COMMIT');
    res.json({ success:true, data:rows[0] });
  } catch(e) { await client.query('ROLLBACK'); throw e; }
  finally { client.release(); }
}));

// EDIT PO — Draft, Pending, or Approved prior to goods receipt
router.put('/po/:id', auth, requireLevel(3), ar(async (req, res) => {
  const { vendor_id, vendorId, delivery_date, payment_terms, remarks, items, tax_type } = req.body;
  const { rows: [po] } = await pool.query(`SELECT * FROM purchase_orders WHERE id=$1`, [req.params.id]);
  if (!po) return res.json({ success: false, message: 'Not found' });
  if (['Received', 'Closed', 'Cancelled'].includes(po.status)) {
    return res.status(400).json({ success: false, message: `Cannot edit PO with status '${po.status}'` });
  }

  const isStoreOrPurchase = req.user.dept_code === 'STORE' || req.user.dept_code === 'PURCHASE' || ['Store Management', 'Purchase', 'Store'].includes(req.user.department);
  if (po.created_by !== req.user.id && !isStoreOrPurchase && req.user.role_level < 3)
    return res.status(403).json({ success: false, message: 'Only the creator, store/purchase manager, or admin can edit this PO' });

  if (items && items.length) {
    const seen = new Set();
    for (const [idx, it] of items.entries()) {
      if (!it.material_id) return res.json({ success:false, message:`Line ${idx+1}: material is required` });
      if (!(parseFloat(it.qty) > 0)) return res.json({ success:false, message:`Line ${idx+1}: quantity must be greater than 0` });
      if (!(parseFloat(it.unit_price) >= 0)) return res.json({ success:false, message:`Line ${idx+1}: unit price cannot be negative` });
      if (seen.has(String(it.material_id))) return res.json({ success:false, message:`Line ${idx+1}: material already added in another line` });
      seen.add(String(it.material_id));
    }
    const { rows: matRows } = await pool.query(`SELECT id, is_active FROM materials WHERE id = ANY($1::int[])`, [items.map(it => it.material_id)]);
    const matById = Object.fromEntries(matRows.map(m => [String(m.id), m]));
    for (const [idx, it] of items.entries()) {
      const m = matById[String(it.material_id)];
      if (!m) return res.json({ success:false, message:`Line ${idx+1}: material does not exist` });
      if (m.is_active === false) return res.json({ success:false, message:`Line ${idx+1}: material is inactive — cannot order` });
    }
  }
  if (delivery_date && po.date && new Date(delivery_date) < new Date(po.date)) return res.json({ success:false, message:'Delivery date cannot be before PO date' });

  const targetVendorId = vendor_id || vendorId || po.vendor_id;
  const globalTaxType = (tax_type || po.tax_type || 'intra').toLowerCase();

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    let totalTaxable = 0, totalDiscount = 0, totalOtherCharges = 0;
    let totalCgst = 0, totalSgst = 0, totalIgst = 0;

    if (items && items.length) {
      const preparedItems = items.map(it => {
        const q = parseFloat(it.qty) || 0;
        const p = parseFloat(it.unit_price) || 0;
        const gross = q * p;
        const discPct = Math.max(0, Math.min(100, parseFloat(it.discount_pct) || 0));
        const discAmt = gross * (discPct / 100);
        const discBase = Math.max(0, gross - discAmt);
        const otherCharges = parseFloat(it.other_charges) || 0;
        const taxable = Math.max(0, discBase + otherCharges);
        const itemTaxType = (it.tax_type || globalTaxType).toLowerCase();
        const gstPct = it.gst_pct !== undefined && it.gst_pct !== '' ? parseFloat(it.gst_pct) : 18;

        let cgstPct = 0, sgstPct = 0, igstPct = 0;
        let cgstAmt = 0, sgstAmt = 0, igstAmt = 0;

        if (itemTaxType === 'inter' || itemTaxType === 'state' || itemTaxType === 'igst') {
          igstPct = gstPct;
          igstAmt = taxable * (igstPct / 100);
        } else {
          cgstPct = gstPct / 2;
          sgstPct = gstPct / 2;
          cgstAmt = taxable * (cgstPct / 100);
          sgstAmt = taxable * (sgstPct / 100);
        }
        const lineTax = cgstAmt + sgstAmt + igstAmt;
        const lineTotal = taxable + lineTax;

        totalTaxable += taxable;
        totalDiscount += discAmt;
        totalOtherCharges += otherCharges;
        totalCgst += cgstAmt;
        totalSgst += sgstAmt;
        totalIgst += igstAmt;

        return {
          ...it,
          qty: q,
          unit_price: p,
          discount_pct: discPct,
          discount_amount: discAmt,
          other_charges: otherCharges,
          taxable_amount: taxable,
          tax_type: itemTaxType,
          gst_pct: gstPct,
          cgst_pct: cgstPct,
          sgst_pct: sgstPct,
          igst_pct: igstPct,
          cgst_amount: cgstAmt,
          sgst_amount: sgstAmt,
          igst_amount: igstAmt,
          total: lineTotal
        };
      });

      // Replace items
      await client.query(`DELETE FROM po_items WHERE po_id=$1`, [req.params.id]);
      for (const it of preparedItems) {
        await client.query(
          `INSERT INTO po_items (
             po_id, material_id, qty, uom, unit_price,
             discount_pct, discount_amount, other_charges, taxable_amount,
             tax_type, gst_pct, cgst_pct, sgst_pct, igst_pct,
             cgst_amount, sgst_amount, igst_amount, total
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)`,
          [req.params.id, it.material_id, it.qty, it.uom||'', it.unit_price||0,
           it.discount_pct, it.discount_amount, it.other_charges, it.taxable_amount,
           it.tax_type, it.gst_pct, it.cgst_pct, it.sgst_pct, it.igst_pct,
           it.cgst_amount, it.sgst_amount, it.igst_amount, it.total]
        );
      }
    } else {
      // Keep existing items, recalculate
      const { rows: existItems } = await client.query(`SELECT * FROM po_items WHERE po_id=$1`, [req.params.id]);
      for (const it of existItems) {
        const q = parseFloat(it.qty) || 0;
        const p = parseFloat(it.unit_price) || 0;
        const gross = q * p;
        const discPct = Math.max(0, Math.min(100, parseFloat(it.discount_pct) || 0));
        const discAmt = gross * (discPct / 100);
        const discBase = Math.max(0, gross - discAmt);
        const otherCharges = parseFloat(it.other_charges) || 0;
        const taxable = Math.max(0, discBase + otherCharges);
        const itemTaxType = (it.tax_type || globalTaxType).toLowerCase();
        const gstPct = parseFloat(it.gst_pct || 18);

        let cgstAmt = 0, sgstAmt = 0, igstAmt = 0;
        if (itemTaxType === 'inter' || itemTaxType === 'state' || itemTaxType === 'igst') {
          igstAmt = taxable * (gstPct / 100);
        } else {
          cgstAmt = taxable * (gstPct / 200);
          sgstAmt = taxable * (gstPct / 200);
        }
        totalTaxable += taxable;
        totalDiscount += discAmt;
        totalOtherCharges += otherCharges;
        totalCgst += cgstAmt;
        totalSgst += sgstAmt;
        totalIgst += igstAmt;
      }
    }

    const totalGst = totalCgst + totalSgst + totalIgst;
    const grandTotal = totalTaxable + totalGst;

    const { rows } = await client.query(
      `UPDATE purchase_orders SET
         vendor_id = COALESCE($1, vendor_id),
         delivery_date = COALESCE($2, delivery_date),
         payment_terms = COALESCE($3, payment_terms),
         remarks = COALESCE($4, remarks),
         tax_type = $5,
         total_value = $6,
         discount_value = $7,
         other_charges = $8,
         cgst_value = $9,
         sgst_value = $10,
         igst_value = $11,
         gst_value = $12,
         grand_total = $13
       WHERE id = $14 RETURNING *`,
      [targetVendorId || null, delivery_date || null, payment_terms || null, remarks || null,
       globalTaxType, totalTaxable, totalDiscount, totalOtherCharges, totalCgst, totalSgst, totalIgst, totalGst, grandTotal, req.params.id]
    );
    await client.query('COMMIT');
    res.json({ success: true, data: rows[0], message: 'Purchase Order updated successfully' });
  } catch(e) { await client.query('ROLLBACK'); throw e; }
  finally { client.release(); }
}));

// APPROVE PO — value-tiered per approval_matrix (same table indent.js uses), maker != checker
router.put('/po/:id/approve', auth, requireLevel(3), ar(async (req, res) => {
  const { rows: [po] } = await pool.query(`SELECT grand_total, created_by FROM purchase_orders WHERE id=$1`, [req.params.id]);
  if (!po) return res.json({ success: false, message: 'Not found' });
  const { rows: matrix } = await pool.query(
    `SELECT required_level FROM approval_matrix WHERE min_value <= $1 AND (max_value IS NULL OR max_value > $1) ORDER BY tier ASC LIMIT 1`,
    [po.grand_total]
  );
  const requiredLevel = matrix[0]?.required_level || 4;
  if (req.user.role_level < requiredLevel) {
    return res.status(403).json({ success: false, message: `PO value ₹${po.grand_total} needs level ${requiredLevel}+ approver` });
  }
  if (po.created_by === req.user.id && req.user.role_level < 5) {
    return res.status(403).json({ success: false, message: 'Cannot approve own PO — needs different approver (or admin override)' });
  }
  const { rows } = await pool.query(
    `UPDATE purchase_orders SET status='Approved', approved_by=$1
     WHERE id=$2 AND status='Draft' RETURNING *`,
    [req.user.id, req.params.id]
  );
  res.json({ success:!!rows.length, data:rows[0] });
}));

// CANCEL PO
router.put('/po/:id/cancel', auth, requireLevel(3), ar(async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `UPDATE purchase_orders SET status='Cancelled' WHERE id=$1 AND status IN ('Draft','Approved') RETURNING *`,
      [req.params.id]
    );
    // If linked to an indent, roll back indent status to Approved (same as DELETE PO below) so
    // it isn't left stuck at 'PO Created' forever with no live PO — that would silently block
    // both /po (indent_id guard) and /indent/:id/convert-to-po from ever re-raising a PO for it.
    if (rows.length && rows[0].indent_id) {
      const { rows: [ind] } = await client.query(`SELECT status FROM indents WHERE id=$1`, [rows[0].indent_id]);
      if (ind && ind.status === 'PO Created') {
        await client.query(`UPDATE indents SET status = 'Approved' WHERE id = $1`, [rows[0].indent_id]);
        await client.query(
          `INSERT INTO indent_audit_log (indent_id, action, old_status, new_status, user_id, remarks)
           VALUES ($1, 'PO Cancelled', 'PO Created', 'Approved', $2, $3)`,
          [rows[0].indent_id, req.user.id, `PO ${rows[0].po_number} Cancelled — Reverted to Approved`]
        );
        const { rows: storeInd } = await client.query('SELECT 1 FROM store_indents WHERE id = $1', [rows[0].indent_id]);
        if (storeInd.length) {
          await client.query(
            `INSERT INTO store_indent_log (indent_id,action,from_status,to_status,actor_id,actor_name,actor_role,note)
             VALUES ($1,'PO Cancelled','PO Created','Approved',$2,$3,$4,$5)`,
            [rows[0].indent_id, req.user.id, req.user.name, req.user.role, `PO ${rows[0].po_number} Cancelled — Reverted to Approved`]
          );
        }
      }
    }
    await client.query('COMMIT');
    res.json({ success:!!rows.length, data:rows[0] });
  } catch(e) { await client.query('ROLLBACK'); throw e; }
  finally { client.release(); }
}));

// DELETE PO — Hard delete for Draft or Cancelled POs (and roll back linked PR to Approved)
router.delete('/po/:id', auth, requireLevel(3), ar(async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: [po] } = await client.query('SELECT * FROM purchase_orders WHERE id=$1 FOR UPDATE', [req.params.id]);
    if (!po) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Purchase Order not found' });
    }

    if (!['Draft', 'Cancelled'].includes(po.status) && req.user.role_level < 4) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: `Cannot delete PO in status '${po.status}'. Only Draft or Cancelled POs can be deleted.` });
    }

    // Check if GRN or stock receipts exist for this PO
    const { rows: grns } = await client.query('SELECT id FROM grn WHERE po_id = $1 LIMIT 1', [po.id]);
    if (grns.length) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'Cannot delete PO with recorded Goods Receipt Notes (GRN)' });
    }

    const { rows: ledgers } = await client.query("SELECT id FROM stock_ledger WHERE reference_type = 'PO' AND reference_id = $1 LIMIT 1", [po.id]);
    if (ledgers.length) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'Cannot delete PO with recorded stock ledger entries' });
    }

    // If linked to an indent, roll back indent status to Approved so it can be re-used!
    if (po.indent_id) {
      await client.query("UPDATE indents SET status = 'Approved' WHERE id = $1", [po.indent_id]);
      await client.query(
        `INSERT INTO indent_audit_log (indent_id, action, old_status, new_status, user_id, remarks)
         VALUES ($1, 'PO Deleted', 'PO Created', 'Approved', $2, $3)`,
        [po.indent_id, req.user.id, `PO ${po.po_number} Deleted — Reverted to Approved`]
      );
      const { rows: storeInd } = await client.query('SELECT 1 FROM store_indents WHERE id = $1', [po.indent_id]);
      if (storeInd.length) {
        await client.query(
          `INSERT INTO store_indent_log (indent_id,action,from_status,to_status,actor_id,actor_name,actor_role,note)
           VALUES ($1,'PO Deleted','PO Created','Approved',$2,$3,$4,$5)`,
          [po.indent_id, req.user.id, req.user.name, req.user.role, `PO ${po.po_number} Deleted — Reverted to Approved`]
        );
      }
    }

    await client.query('DELETE FROM po_items WHERE po_id = $1', [po.id]);
    await client.query('DELETE FROM purchase_orders WHERE id = $1', [po.id]);

    await client.query('COMMIT');
    res.json({ success: true, message: `PO ${po.po_number} deleted successfully. Linked indent reverted to Approved.` });
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}));

// LIST GRNs
router.get('/grn', auth, ar(async (req, res) => {
  const { vendor_id, po_id, search, page=1, limit=50 } = req.query;
  const conds = []; const params = []; let p = 1;
  if (vendor_id) { conds.push(`g.vendor_id = $${p++}`); params.push(vendor_id); }
  if (po_id)     { conds.push(`g.po_id = $${p++}`); params.push(po_id); }
  if (search)    {
    conds.push(`(g.grn_number ILIKE $${p} OR po.po_number ILIKE $${p} OR v.name ILIKE $${p} OR g.invoice_number ILIKE $${p} OR g.challan_number ILIKE $${p})`);
    params.push(`%${search}%`);
    p++;
  }
  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
  const offset = (parseInt(page)-1)*parseInt(limit);
  const { rows } = await pool.query(
    `SELECT g.id, g.grn_number as "grnNumber", g.date, g.status,
            g.vehicle_number as "vehicleNumber", g.challan_number as "challanNumber", g.invoice_number as "invoiceNumber",
            g.po_id as "poId", po.po_number as "poNumber",
            g.vendor_id as "vendorId", v.name as "vendorName", v.code as "vendorCode",
            u.name as "receivedByName",
            COALESCE((SELECT COUNT(*) FROM grn_items gi WHERE gi.grn_id = g.id), 0)::int AS "itemCount",
            COALESCE((SELECT SUM(gi.accepted_qty * gi.unit_price) FROM grn_items gi WHERE gi.grn_id = g.id), 0) AS "totalValue"
     FROM grn g
     LEFT JOIN purchase_orders po ON po.id = g.po_id
     LEFT JOIN vendors v ON v.id = g.vendor_id
     LEFT JOIN users u ON u.id = g.received_by
     ${where}
     ORDER BY g.created_at DESC
     LIMIT $${p} OFFSET $${p+1}`,
    [...params, parseInt(limit), offset]
  );
  const { rows: cnt } = await pool.query(
    `SELECT COUNT(*) FROM grn g
     LEFT JOIN purchase_orders po ON po.id = g.po_id
     LEFT JOIN vendors v ON v.id = g.vendor_id
     ${where}`, params
  );
  res.json({ success: true, data: rows, total: parseInt(cnt[0].count) });
}));

// GET ONE GRN
router.get('/grn/:id', auth, ar(async (req, res) => {
  const grnId = String(req.params.id || '').trim();
  const where = `WHERE g.id::text = $1 OR g.grn_number = $1 OR g.grn_number ILIKE $1 OR g.invoice_number = $1 OR g.invoice_number ILIKE $1 OR g.challan_number = $1 OR g.challan_number ILIKE $1`;

  const { rows } = await pool.query(
    `SELECT g.*, g.grn_number as "grnNumber",
            po.po_number as "poNumber", po.date as "poDate", po.grand_total as "poGrandTotal",
            v.name as "vendorName", v.code as "vendorCode", v.gstin as "vendorGstin",
            v.state as "vendorState", v.city as "vendorCity", v.address as "vendorAddress", v.pincode as "vendorPincode",
            u.name as "receivedByName"
     FROM grn g
     LEFT JOIN purchase_orders po ON po.id = g.po_id
     LEFT JOIN vendors v ON v.id = g.vendor_id
     LEFT JOIN users u ON u.id = g.received_by
     ${where}
     ORDER BY g.id DESC
     LIMIT 1`, [grnId]
  );
  if (!rows.length) return res.json({ success: false, message: 'GRN not found' });

  const resolvedGrnId = rows[0].id;
  const { rows: items } = await pool.query(
    `SELECT gi.*, m.name as "materialName", m.code as "materialCode", m.uom as "matUom", m.hsn_code as "hsnCode",
            COALESCE(gi.gst_pct, pi.gst_pct, 18) as "gst_pct",
            COALESCE(gi.taxable_amount, gi.received_qty * gi.unit_price) as taxable_amount,
            COALESCE(gi.total_amount, gi.received_qty * gi.unit_price) as total_amount
     FROM grn_items gi
     LEFT JOIN materials m ON m.id = gi.material_id
     LEFT JOIN grn g ON g.id = gi.grn_id
     LEFT JOIN po_items pi ON pi.po_id = g.po_id AND pi.material_id = gi.material_id
     WHERE gi.grn_id = $1
     ORDER BY gi.id ASC`, [resolvedGrnId]
  );
  res.json({ success: true, data: { ...rows[0], items } });
}));

// PUT /api/purchase/grn/:id — Update GRN header, columns, line item quantities, discounts, charges, and prices with atomic ledger sync
router.put('/grn/:id', auth, requireLevel(2), ar(async (req, res) => {
  const isNum = /^\d+$/.test(String(req.params.id));
  const where = isNum ? `WHERE id=$1` : `WHERE grn_number=$1`;
  const paramVal = isNum ? parseInt(req.params.id) : req.params.id;

  const { vehicle_number, challan_number, invoice_number, remarks, date, tax_type, items: updatedItems, items } = req.body;
  const itemsList = updatedItems || items;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: [grn] } = await client.query(`SELECT * FROM grn ${where} FOR UPDATE`, [paramVal]);
    if (!grn) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'GRN not found' });
    }

    const grnId = grn.id;
    const globalTaxType = (tax_type || grn.tax_type || 'intra').toLowerCase();

    // 1. Update Header columns
    await client.query(
      `UPDATE grn
       SET vehicle_number = COALESCE($1, vehicle_number),
           challan_number = COALESCE($2, challan_number),
           invoice_number = COALESCE($3, invoice_number),
           remarks = COALESCE($4, remarks),
           date = COALESCE($5::date, date),
           tax_type = COALESCE($6, tax_type),
           updated_at = NOW()
       WHERE id = $7`,
      [vehicle_number !== undefined ? vehicle_number : null,
       challan_number !== undefined ? challan_number : null,
       invoice_number !== undefined ? invoice_number : null,
       remarks !== undefined ? remarks : null,
       date || null,
       globalTaxType,
       grnId]
    );

    // 2. Update line items if provided
    if (Array.isArray(itemsList) && itemsList.length > 0) {
      const { rows: existingItems } = await client.query(
        `SELECT * FROM grn_items WHERE grn_id = $1 FOR UPDATE`, [grnId]
      );

      for (const uItem of itemsList) {
        const itemMatch = existingItems.find(x =>
          (uItem.id && String(x.id) === String(uItem.id)) ||
          (uItem.material_id && String(x.material_id) === String(uItem.material_id))
        );

        if (!itemMatch) continue;

        const oldRecQty = parseFloat(itemMatch.received_qty || 0);
        const oldAccQty = parseFloat(itemMatch.accepted_qty || 0);
        const oldRejQty = parseFloat(itemMatch.rejected_qty || 0);
        const oldPrice = parseFloat(itemMatch.unit_price || 0);

        const newRecQty = uItem.received_qty !== undefined ? parseFloat(uItem.received_qty) : oldRecQty;
        const newAccQty = uItem.accepted_qty !== undefined ? parseFloat(uItem.accepted_qty) : oldAccQty;
        const newRejQty = uItem.rejected_qty !== undefined ? parseFloat(uItem.rejected_qty) : (newRecQty - newAccQty);
        const newPrice = uItem.unit_price !== undefined && uItem.unit_price !== '' ? parseFloat(uItem.unit_price) : oldPrice;
        const newDiscPct = uItem.discount_pct !== undefined ? Math.max(0, Math.min(100, parseFloat(uItem.discount_pct))) : parseFloat(itemMatch.discount_pct || 0);
        const newOtherChg = uItem.other_charges !== undefined ? parseFloat(uItem.other_charges) : parseFloat(itemMatch.other_charges || 0);
        const newGstPct = uItem.gst_pct !== undefined ? parseFloat(uItem.gst_pct) : parseFloat(itemMatch.gst_pct || 18);
        const newTaxType = (uItem.tax_type || itemMatch.tax_type || globalTaxType).toLowerCase();

        const grossVal = newAccQty * newPrice;
        const discAmt = grossVal * (newDiscPct / 100);
        const discBase = Math.max(0, grossVal - discAmt);
        const taxableVal = Math.max(0, discBase + newOtherChg);

        let cgstPct = 0, sgstPct = 0, igstPct = 0;
        let cgstAmt = 0, sgstAmt = 0, igstAmt = 0;

        if (newTaxType === 'inter' || newTaxType === 'state' || newTaxType === 'igst') {
          igstPct = newGstPct;
          igstAmt = taxableVal * (igstPct / 100);
        } else {
          cgstPct = newGstPct / 2;
          sgstPct = newGstPct / 2;
          cgstAmt = taxableVal * (cgstPct / 100);
          sgstAmt = taxableVal * (sgstPct / 100);
        }
        const lineTax = cgstAmt + sgstAmt + igstAmt;
        const lineTot = taxableVal + lineTax;

        const newBin = uItem.bin_location !== undefined ? uItem.bin_location : itemMatch.bin_location;
        const newBatch = uItem.batch_number !== undefined ? uItem.batch_number : itemMatch.batch_number;
        const newLineRemarks = uItem.remarks !== undefined ? uItem.remarks : itemMatch.remarks;

        const deltaAcc = newAccQty - oldAccQty;
        const deltaRec = newRecQty - oldRecQty;

        // Fetch and lock material
        const { rows: [mat] } = await client.query(
          `SELECT id, name, code, uom, current_stock, unit_price FROM materials WHERE id = $1 FOR UPDATE`,
          [itemMatch.material_id]
        );
        if (!mat) throw new Error(`Material #${itemMatch.material_id} not found`);

        const curStock = parseFloat(mat.current_stock || 0);
        const newStock = curStock + deltaAcc;

        if (newStock < 0) {
          throw new Error(`Cannot reduce accepted quantity for '${mat.name}': resulting stock would be negative (${newStock.toFixed(2)} ${mat.uom})`);
        }

        // Update materials current_stock and unit_price
        await client.query(
          `UPDATE materials
           SET current_stock = $1,
               unit_price = CASE WHEN $2::numeric > 0 THEN $2::numeric ELSE unit_price END
           WHERE id = $3`,
          [newStock, newPrice, mat.id]
        );

        // Update grn_items row with full calculation fields
        await client.query(
          `UPDATE grn_items
           SET received_qty = $1,
               accepted_qty = $2,
               rejected_qty = $3,
               unit_price = $4,
               discount_pct = $5,
               discount_amount = $6,
               other_charges = $7,
               taxable_amount = $8,
               gst_pct = $9,
               tax_type = $10,
               cgst_pct = $11,
               sgst_pct = $12,
               igst_pct = $13,
               cgst_amount = $14,
               sgst_amount = $15,
               igst_amount = $16,
               total_amount = $17,
               bin_location = $18,
               batch_number = $19,
               remarks = $20
           WHERE id = $21`,
          [newRecQty, newAccQty, newRejQty, newPrice,
           newDiscPct, discAmt, newOtherChg, taxableVal, newGstPct, newTaxType,
           cgstPct, sgstPct, igstPct, cgstAmt, sgstAmt, igstAmt, lineTot,
           newBin, newBatch, newLineRemarks, itemMatch.id]
        );

        // Update / synchronize stock_ledger
        const { rows: ledgerRows } = await client.query(
          `SELECT * FROM stock_ledger 
           WHERE material_id = $1 
             AND (reference_id = $2 OR reference_id = $3 OR remarks ILIKE $4)
           ORDER BY id DESC LIMIT 1 FOR UPDATE`,
          [mat.id, grn.po_id || -1, grnId, `%${grn.grn_number}%`]
        );

        if (ledgerRows.length > 0) {
          const lId = ledgerRows[0].id;
          await client.query(
            `UPDATE stock_ledger
             SET in_qty = $1,
                 balance = balance + $2,
                 unit_price = $3,
                 value = $1::numeric * $3::numeric,
                 remarks = COALESCE($4, remarks)
             WHERE id = $5`,
            [newAccQty, deltaAcc, newPrice, newLineRemarks || `Inward GRN ${grn.grn_number} updated`, lId]
          );
        } else if (deltaAcc !== 0) {
          await client.query(
            `INSERT INTO stock_ledger (material_id, date, transaction_type, reference_type, reference_id, in_qty, out_qty, balance, unit_price, value, remarks, created_by, vendor_id)
             VALUES ($1, CURRENT_DATE, 'grn', 'PO', $2, $3, 0, $4, $5, $6, $7, $8, $9)`,
            [mat.id, grn.po_id || grnId, deltaAcc, newStock, newPrice, deltaAcc * newPrice, `GRN ${grn.grn_number} Qty Adjustment`, req.user.id, grn.vendor_id]
          );
        }

        // Adjust PO items received count if applicable
        if (grn.po_id && deltaRec !== 0) {
          await client.query(
            `UPDATE po_items
             SET received_qty = GREATEST(0, COALESCE(received_qty, 0) + $1)
             WHERE po_id = $2 AND material_id = $3`,
            [deltaRec, grn.po_id, mat.id]
          );
        }

        // Sync material_rejections if rejection qty changed
        if (newRejQty > 0) {
          const { rows: rejRows } = await client.query(
            `SELECT id FROM material_rejections WHERE grn_id = $1 AND material_id = $2 FOR UPDATE`,
            [grnId, mat.id]
          );
          if (rejRows.length > 0) {
            await client.query(
              `UPDATE material_rejections
               SET rejected_qty = $1, unit_price = $2, debit_amount = $1::numeric * $2::numeric, rejection_reason = COALESCE($3, rejection_reason)
               WHERE id = $4`,
              [newRejQty, newPrice, newLineRemarks || 'Rejected during PO Receipt', rejRows[0].id]
            );
          }
        }
      }
    }

    // Recompute GRN Header Totals
    await client.query(
      `UPDATE grn
       SET total_value = (SELECT COALESCE(SUM(taxable_amount), 0) FROM grn_items WHERE grn_id = $1),
           discount_value = (SELECT COALESCE(SUM(discount_amount), 0) FROM grn_items WHERE grn_id = $1),
           other_charges = (SELECT COALESCE(SUM(other_charges), 0) FROM grn_items WHERE grn_id = $1),
           cgst_value = (SELECT COALESCE(SUM(cgst_amount), 0) FROM grn_items WHERE grn_id = $1),
           sgst_value = (SELECT COALESCE(SUM(sgst_amount), 0) FROM grn_items WHERE grn_id = $1),
           igst_value = (SELECT COALESCE(SUM(igst_amount), 0) FROM grn_items WHERE grn_id = $1),
           gst_value = (SELECT COALESCE(SUM(cgst_amount + sgst_amount + igst_amount), 0) FROM grn_items WHERE grn_id = $1),
           grand_total = (SELECT COALESCE(SUM(total_amount), 0) FROM grn_items WHERE grn_id = $1)
       WHERE id = $1`,
      [grnId]
    );

    await auditLog(client, {
      userId: req.user.id,
      action: 'purchase.grn.update',
      module: 'purchase',
      recordId: grnId,
      oldData: { grn_number: grn.grn_number, vehicle_number: grn.vehicle_number, invoice_number: grn.invoice_number },
      newData: { vehicle_number, invoice_number, itemsCount: itemsList?.length },
      ip: req.ip
    });

    await client.query('COMMIT');

    // Fetch full updated GRN with items
    const { rows: fullItems } = await pool.query(
      `SELECT gi.*, m.name as "materialName", m.code as "materialCode", m.uom as "matUom"
       FROM grn_items gi
       LEFT JOIN materials m ON m.id = gi.material_id
       WHERE gi.grn_id = $1
       ORDER BY gi.id ASC`, [grnId]
    );

    res.json({
      success: true,
      message: `GRN ${grn.grn_number} updated successfully with atomic stock ledger sync`,
      data: { ...updatedGrn, items: fullItems }
    });
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(400).json({ success: false, message: e.message });
  } finally {
    client.release();
  }
}));

// DELETE /api/purchase/grn/:id — Void / Delete GRN with atomic stock reversal (Store Manager Only)
router.delete('/grn/:id', auth, requireStoreManager, ar(async (req, res) => {
  const isNum = /^\d+$/.test(String(req.params.id));
  const where = isNum ? `WHERE id=$1` : `WHERE grn_number=$1`;
  const paramVal = isNum ? parseInt(req.params.id) : req.params.id;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: [grn] } = await client.query(`SELECT * FROM grn ${where} FOR UPDATE`, [paramVal]);
    if (!grn) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'GRN not found' });
    }

    const grnId = grn.id;
    const { rows: items } = await client.query(`SELECT * FROM grn_items WHERE grn_id = $1 FOR UPDATE`, [grnId]);

    // Check stock for all items before reverting
    for (const it of items) {
      const accQty = parseFloat(it.accepted_qty || 0);
      if (accQty <= 0) continue;

      const { rows: [mat] } = await client.query(`SELECT id, name, uom, current_stock FROM materials WHERE id = $1 FOR UPDATE`, [it.material_id]);
      if (mat) {
        const curStock = parseFloat(mat.current_stock || 0);
        const newStock = curStock - accQty;
        if (newStock < 0) {
          throw new Error(`Cannot void GRN ${grn.grn_number}: stock for '${mat.name}' already consumed (Remaining: ${curStock} ${mat.uom})`);
        }
        await client.query(`UPDATE materials SET current_stock = $1 WHERE id = $2`, [newStock, mat.id]);
      }

      // Revert PO received count
      if (grn.po_id) {
        const recQty = parseFloat(it.received_qty || accQty);
        await client.query(
          `UPDATE po_items SET received_qty = GREATEST(0, COALESCE(received_qty, 0) - $1) WHERE po_id = $2 AND material_id = $3`,
          [recQty, grn.po_id, it.material_id]
        );
      }
    }

    // Clean up rejections and ledger entries
    await client.query(`DELETE FROM material_rejections WHERE grn_id = $1`, [grnId]);
    await client.query(`DELETE FROM stock_ledger WHERE (reference_id = $1 AND reference_type IN ('PO', 'GRN', 'grn')) OR remarks ILIKE $2`, [grnId, `%${grn.grn_number}%`]);
    await client.query(`DELETE FROM grn_items WHERE grn_id = $1`, [grnId]);
    await client.query(`DELETE FROM grn WHERE id = $1`, [grnId]);

    await auditLog(client, {
      userId: req.user.id,
      action: 'purchase.grn.delete',
      module: 'purchase',
      recordId: grnId,
      oldData: { grn_number: grn.grn_number, po_id: grn.po_id },
      newData: { voided: true },
      ip: req.ip
    });

    await client.query('COMMIT');
    res.json({ success: true, message: `GRN ${grn.grn_number} successfully voided and stock balances reversed` });
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(400).json({ success: false, message: e.message });
  } finally {
    client.release();
  }
}));

// DELETE /api/purchase/bills/:id — Delete vendor bill / invoice (Store Manager Only)
router.delete('/bills/:id', auth, requireStoreManager, ar(async (req, res) => {
  const isNum = /^\d+$/.test(String(req.params.id));
  const where = isNum ? `WHERE id=$1` : `WHERE bill_number=$1`;
  const paramVal = isNum ? parseInt(req.params.id) : req.params.id;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: [bill] } = await client.query(`SELECT * FROM vendor_bills ${where} FOR UPDATE`, [paramVal]);
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
      action: 'purchase.bill.delete',
      module: 'purchase',
      recordId: bill.id,
      oldData: { bill_number: bill.bill_number, vendor_invoice_number: bill.vendor_invoice_number, total_amount: bill.total_amount },
      newData: { deleted: true },
      ip: req.ip
    });

    await client.query('COMMIT');
    res.json({ success: true, message: `Vendor invoice / bill ${bill.bill_number} successfully removed.` });
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(400).json({ success: false, message: e.message });
  } finally {
    client.release();
  }
}));

// GENERATE GRN FROM PO (With QC Inspection & Atomic Stock Increment)
router.post('/po/:id/grn', auth, requireLevel(2), ar(async (req, res) => {
  const poId = req.params.id;
  const { vehicle_number, challan_number, invoice_number, remarks, items: customItems, gate_pass_id, gatePassId } = req.body;
  const targetGatePassId = gate_pass_id || gatePassId || null;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: [po] } = await client.query(`SELECT po_number, vendor_id, status FROM purchase_orders WHERE id=$1 FOR UPDATE`, [poId]);
    if (!po || (po.status !== 'Approved' && po.status !== 'Partial')) {
      throw new Error('PO must be in Approved or Partial status to receive shipments');
    }

    // Generate GRN Number with advisory lock
    const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [`grn-${stamp}`]);
    const { rows: seqRows } = await client.query(`SELECT LPAD((COUNT(*)+1)::text, 4, '0') as seq FROM grn WHERE grn_number LIKE $1`, [`GRN-${stamp}-%`]);
    const grnNum = `GRN-${stamp}-${seqRows[0].seq}`;

    // Create Header
    const { rows: [head] } = await client.query(
      `INSERT INTO grn (grn_number, date, vendor_id, po_id, gate_pass_id, vehicle_number, challan_number, invoice_number, status, received_by, remarks)
       VALUES ($1, CURRENT_DATE, $2, $3, $4, $5, $6, $7, 'Received', $8, $9) RETURNING *`,
      [grnNum, po.vendor_id, poId, targetGatePassId, vehicle_number || null, challan_number || null, invoice_number || null, req.user.id, remarks || null]
    );
    const grnId = head.id;

    if (targetGatePassId) {
      await client.query(`UPDATE gate_passes SET status = 'Closed' WHERE id = $1`, [targetGatePassId]);
    }

    // Get unfulfilled PO items
    const { rows: poItems } = await client.query(
      `SELECT id, material_id, uom, qty, received_qty, unit_price,
              discount_pct, other_charges, tax_type, gst_pct
       FROM po_items WHERE po_id=$1`, [poId]
    );

    let totalItems = 0;
    for (const poIt of poItems) {
      const remaining = Number(poIt.qty) - Number(poIt.received_qty || 0);
      if (remaining <= 0) continue;

      // Find if custom qty passed for this item
      const userIt = Array.isArray(customItems) ? customItems.find(x => String(x.material_id) === String(poIt.material_id) || String(x.po_item_id) === String(poIt.id)) : null;
      const recQty = userIt ? Number(userIt.received_qty ?? remaining) : remaining;
      const accQty = userIt ? Number(userIt.accepted_qty ?? recQty) : recQty;
      const rejQty = userIt ? Number(userIt.rejected_qty ?? (recQty - accQty)) : (recQty - accQty);
      const uPrice = userIt ? Number(userIt.unit_price ?? poIt.unit_price) : Number(poIt.unit_price || 0);
      const discPct = userIt ? Number(userIt.discount_pct ?? poIt.discount_pct ?? 0) : Number(poIt.discount_pct || 0);
      const otherChg = userIt ? Number(userIt.other_charges ?? poIt.other_charges ?? 0) : Number(poIt.other_charges || 0);
      const gstPct = userIt ? Number(userIt.gst_pct ?? poIt.gst_pct ?? 18) : Number(poIt.gst_pct || 18);
      const taxType = (userIt?.tax_type || poIt.tax_type || po.tax_type || 'intra').toLowerCase();

      const grossVal = accQty * uPrice;
      const discAmt = grossVal * (discPct / 100);
      const discBase = Math.max(0, grossVal - discAmt);
      const taxableVal = Math.max(0, discBase + otherChg);

      let cgstPct = 0, sgstPct = 0, igstPct = 0;
      let cgstAmt = 0, sgstAmt = 0, igstAmt = 0;

      if (taxType === 'inter' || taxType === 'state' || taxType === 'igst') {
        igstPct = gstPct;
        igstAmt = taxableVal * (igstPct / 100);
      } else {
        cgstPct = gstPct / 2;
        sgstPct = gstPct / 2;
        cgstAmt = taxableVal * (cgstPct / 100);
        sgstAmt = taxableVal * (sgstPct / 100);
      }
      const lineTot = taxableVal + (cgstAmt + sgstAmt + igstAmt);

      const binLoc = userIt ? (userIt.bin_location || null) : null;
      const lineRemarks = userIt ? (userIt.remarks || null) : null;

      if (recQty <= 0) continue;

      await client.query(
        `INSERT INTO grn_items (
           grn_id, material_id, po_qty, received_qty, accepted_qty, rejected_qty, uom, unit_price,
           discount_pct, discount_amount, other_charges, taxable_amount, gst_pct, tax_type,
           cgst_pct, sgst_pct, igst_pct, cgst_amount, sgst_amount, igst_amount, total_amount,
           bin_location, remarks
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23)`,
        [grnId, poIt.material_id, remaining, recQty, accQty, rejQty, poIt.uom, uPrice,
         discPct, discAmt, otherChg, taxableVal, gstPct, taxType,
         cgstPct, sgstPct, igstPct, cgstAmt, sgstAmt, igstAmt, lineTot,
         binLoc, lineRemarks]
      );

      await client.query(
        `UPDATE po_items SET received_qty = COALESCE(received_qty, 0) + $1 WHERE id=$2`,
        [recQty, poIt.id]
      );

      // If rejection exists, record in material_rejections
      if (rejQty > 0) {
        await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [`rej-${stamp}`]);
        const seqRes = await client.query(`SELECT COUNT(*)+1 AS n FROM material_rejections WHERE created_at::date = CURRENT_DATE`);
        const rejNum = `REJ-${stamp}-${String(seqRes.rows[0].n).padStart(4, '0')}`;
        const debitAmt = rejQty * uPrice;

        await client.query(
          `INSERT INTO material_rejections
             (rejection_number, grn_id, po_id, vendor_id, material_id, rejected_qty, uom, unit_price, debit_amount, rejection_reason, action_required, status, created_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'Return to Vendor', 'Pending RTV', $11)`,
          [rejNum, grnId, poId, po.vendor_id, poIt.material_id, rejQty, poIt.uom || 'Nos', uPrice, debitAmt, lineRemarks || 'Rejected during PO Receipt', req.user.id]
        );
      }

      // Atomic stock increment for ACCEPTED quantity
      if (accQty > 0) {
        const { rows: [mat] } = await client.query(`SELECT current_stock, unit_price FROM materials WHERE id=$1 FOR UPDATE`, [poIt.material_id]);
        const curStock = parseFloat(mat?.current_stock || 0);
        const newStock = curStock + accQty;
        await client.query(
          `UPDATE materials SET current_stock=$1, unit_price=CASE WHEN $2::numeric>0 THEN $2::numeric ELSE unit_price END WHERE id=$3`,
          [newStock, uPrice, poIt.material_id]
        );

        // Insert into stock_ledger
        await client.query(
          `INSERT INTO stock_ledger (material_id, date, transaction_type, reference_type, reference_id, in_qty, out_qty, balance, unit_price, value, remarks, created_by, vendor_id)
           VALUES ($1, CURRENT_DATE, 'grn', 'PO', $2, $3, 0, $4, $5, $6, $7, $8, $9)`,
          [poIt.material_id, poId, accQty, newStock, uPrice, accQty * uPrice, `Inward GRN ${grnNum} against PO ${po.po_number}`, req.user.id, po.vendor_id]
        );

        // Digital Twin & Unique Serialization: Auto-register unique serial numbers for Machine Clothing
        const { rows: [matFull] } = await client.query(
          `SELECT m.id, m.name, m.code, m.is_serialized, m.expected_lifespan_days, mc.name as category_name
           FROM materials m
           LEFT JOIN material_categories mc ON m.category_id = mc.id
           WHERE m.id = $1`,
          [poIt.material_id]
        );
        const isClothing = matFull?.is_serialized || (matFull?.category_name && matFull.category_name.toLowerCase().includes('clothing'));
        if (isClothing && accQty > 0) {
          let rawSerials = userIt ? (userIt.serial_number || userIt.serial_numbers || userIt.batch_number) : null;
          let snList = [];
          if (Array.isArray(rawSerials)) {
            snList = rawSerials.map(s => String(s).trim()).filter(Boolean);
          } else if (typeof rawSerials === 'string' && rawSerials.trim()) {
            snList = rawSerials.split(/[,;\n]+/).map(s => s.trim()).filter(Boolean);
          }

          const countToCreate = Math.floor(accQty);
          while (snList.length < countToCreate) {
            const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
            const rand = Math.floor(1000 + Math.random() * 9000);
            snList.push(`${matFull?.code || 'PMC'}-${stamp}-${rand}`);
          }

          for (let i = 0; i < countToCreate; i++) {
            const sn = snList[i];
            const { rows: dupRows } = await client.query(
              `SELECT id, asset_number, status FROM installed_assets 
               WHERE LOWER(TRIM(serial_number)) = LOWER(TRIM($1)) AND status NOT IN ('retired', 'scrapped')`,
              [sn]
            );
            if (dupRows.length > 0) {
              throw new Error(`Serial number "${sn}" already exists in Mill Asset Registry (Asset #${dupRows[0].asset_number}, Status: ${dupRows[0].status}). All Paper Machine Clothing & Serialized rolls must have unique serial numbers.`);
            }

            const today = new Date();
            const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
            await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [`ast-${dateStr}`]);
            const { rows: assetSeq } = await client.query(`SELECT LPAD((COUNT(*) + 1)::text, 4, '0') AS seq FROM installed_assets WHERE asset_number LIKE $1`, [`AST-${dateStr}-%`]);
            const assetNumber = `AST-${dateStr}-${assetSeq[0].seq}`;

            await client.query(
              `INSERT INTO installed_assets (
                 asset_number, material_id, serial_number, batch_number, grn_id, vendor_id,
                 purchase_price, status, expected_lifespan_days, created_at
               ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'In Stock', $8, NOW())`,
              [
                assetNumber, matFull.id, sn, userIt?.batch_number || null, grnId, po.vendor_id || null,
                uPrice, matFull.expected_lifespan_days || 90
              ]
            );
          }
        }
      }

      totalItems++;
    }

    // Update PO status based on total received vs ordered
    const { rows: updatedPoItems } = await client.query(
      `SELECT qty, received_qty FROM po_items WHERE po_id=$1`, [poId]
    );
    const fullyReceived = updatedPoItems.length > 0 && updatedPoItems.every(r => Number(r.received_qty || 0) >= Number(r.qty));
    const anyReceived = updatedPoItems.some(r => Number(r.received_qty || 0) > 0);
    const newPoStatus = fullyReceived ? 'Received' : (anyReceived ? 'Partial' : 'Approved');
    await client.query(`UPDATE purchase_orders SET status=$1 WHERE id=$2`, [newPoStatus, poId]);

    // Notify Finance Department for AP Bill Processing
    try {
      const { rows: finUsers } = await client.query(`
        SELECT u.id FROM users u
        JOIN departments d ON u.department_id = d.id
        JOIN roles r ON u.role_id = r.id
        WHERE d.code = 'FIN' AND r.level >= 2 AND u.is_active = true
        UNION
        SELECT u.id FROM users u JOIN roles r ON u.role_id = r.id
        WHERE r.level >= 4 AND u.is_active = true
      `);
      for (const f of finUsers) {
        await client.query(
          `INSERT INTO notifications (user_id, type, title, message, ref_table, ref_id)
           VALUES ($1, 'info', $2, $3, 'grn', $4)`,
          [f.id, `GRN Created: ${grnNumber}`, `GRN ${grnNumber} generated for PO ${po.po_number || poId}. Pending vendor bill entry.`, grnId]
        );
      }
    } catch (notifErr) {
      // Non-critical notification failure
    }

    // Recompute GRN Header Totals from items
    await client.query(
      `UPDATE grn
       SET total_value = (SELECT COALESCE(SUM(taxable_amount), 0) FROM grn_items WHERE grn_id = $1),
           discount_value = (SELECT COALESCE(SUM(discount_amount), 0) FROM grn_items WHERE grn_id = $1),
           other_charges = (SELECT COALESCE(SUM(other_charges), 0) FROM grn_items WHERE grn_id = $1),
           cgst_value = (SELECT COALESCE(SUM(cgst_amount), 0) FROM grn_items WHERE grn_id = $1),
           sgst_value = (SELECT COALESCE(SUM(sgst_amount), 0) FROM grn_items WHERE grn_id = $1),
           igst_value = (SELECT COALESCE(SUM(igst_amount), 0) FROM grn_items WHERE grn_id = $1),
           gst_value = (SELECT COALESCE(SUM(cgst_amount + sgst_amount + igst_amount), 0) FROM grn_items WHERE grn_id = $1),
           grand_total = (SELECT COALESCE(SUM(total_amount), 0) FROM grn_items WHERE grn_id = $1)
       WHERE id = $1`,
      [grnId]
    );

    await client.query('COMMIT');
    res.json({ success: true, data: { ...head, items_added: totalItems, po_status: newPoStatus } });
  } catch(e) {
    await client.query('ROLLBACK');
    return res.status(400).json({ success: false, message: e.message });
  } finally {
    client.release();
  }
}));

// BOOK VENDOR BILL FROM PO / GRN (Forward to Finance)
router.post('/po/:id/bill', auth, requireLevel(2), ar(async (req, res) => {
  const poId = req.params.id;
  const { grn_id, vendor_invoice_number, invoice_date, due_date, taxable_amount, cgst_amount, sgst_amount, igst_amount, roundoff=0, remarks } = req.body;
  if (!vendor_invoice_number || !invoice_date || taxable_amount === undefined) {
    return res.status(400).json({ success: false, message: 'Vendor Invoice Number, Invoice Date, and Taxable Amount are required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: [po] } = await client.query(`SELECT po_number, vendor_id, grand_total, total_value, gst_value FROM purchase_orders WHERE id=$1`, [poId]);
    if (!po) throw new Error('Purchase order not found');

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
      if (acceptedValue > 0 && Number(taxable_amount) > acceptedValue * 1.02) {
        throw new Error(`Bill taxable amount (₹${Number(taxable_amount).toFixed(2)}) exceeds the GRN's accepted (post-QC) goods value (₹${acceptedValue.toFixed(2)}). Bills must be booked against ACCEPTED quantity, not ordered quantity.`);
      }
    }

    const taxAmount = Number(taxable_amount);
    const cgst = Number(cgst_amount ?? 0);
    const sgst = Number(sgst_amount ?? 0);
    const igst = Number(igst_amount ?? 0);
    const totalTax = cgst + sgst + igst;
    const rOff = Number(roundoff || 0);
    const totalAmt = taxAmount + totalTax + rOff;

    // Generate Bill Number with advisory lock
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
      [
        billNum, po.vendor_id, poId, grn_id || null, vendor_invoice_number,
        invoice_date, due_date || invoice_date, taxAmount, cgst, sgst,
        igst, totalTax, rOff, totalAmt, remarks || `Bill against PO ${po.po_number}`, req.user.id
      ]
    );

    // Notify Finance Department
    try {
      const { rows: finUsers } = await client.query(`
        SELECT u.id FROM users u
        JOIN departments d ON u.department_id = d.id
        JOIN roles r ON u.role_id = r.id
        WHERE d.code = 'FIN' AND r.level >= 2 AND u.is_active = true
      `);
      for (const f of finUsers) {
        await client.query(
          `INSERT INTO notifications (user_id, type, title, message, ref_table, ref_id)
           VALUES ($1, 'info', $2, $3, 'vendor_bills', $4)`,
          [f.id, `New Vendor Bill ${billNum}`, `Vendor Bill ${billNum} (Invoice ${vendor_invoice_number}, ₹${totalAmt}) booked and awaiting approval/payment.`, bill.id]
        );
      }
    } catch(err) { /* non-blocking */ }

    await client.query('COMMIT');
    res.status(201).json({ success: true, data: bill, message: `Vendor Bill ${billNum} booked successfully and sent to Finance` });
  } catch(e) {
    await client.query('ROLLBACK');
    return res.status(400).json({ success: false, message: e.message });
  } finally {
    client.release();
  }
}));

// P2P END-TO-END LIFECYCLE PIPELINE (Indent -> PO -> GRN -> Purchase Bill -> Payment)
router.get('/p2p-pipeline', auth, ar(async (req, res) => {
  const { search, limit = 100 } = req.query;
  const conds = [];
  const params = [];
  let p = 1;
  if (search) {
    conds.push(`(po.po_number ILIKE $${p} OR ind.indent_number ILIKE $${p} OR v.name ILIKE $${p} OR g.grn_number ILIKE $${p} OR vb.bill_number ILIKE $${p} OR vb.vendor_invoice_number ILIKE $${p})`);
    params.push(`%${search}%`);
    p++;
  }
  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';

  const { rows } = await pool.query(`
    SELECT
      po.id as "poId",
      po.po_number as "poNumber",
      po.date as "poDate",
      po.status as "poStatus",
      po.grand_total as "poGrandTotal",
      v.id as "vendorId",
      v.name as "vendorName",
      v.code as "vendorCode",
      -- Indent
      ind.id as "indentId",
      ind.indent_number as "indentNumber",
      ind.date as "indentDate",
      ind.status as "indentStatus",
      ind.total_value as "indentTotalValue",
      indUser.name as "indentorName",
      dept.name as "deptName",
      -- GRN
      g.id as "grnId",
      g.grn_number as "grnNumber",
      g.date as "grnDate",
      g.status as "grnStatus",
      g.invoice_number as "grnInvoiceNumber",
      g.challan_number as "grnChallanNumber",
      gUser.name as "grnReceivedByName",
      -- Purchase Bill
      vb.id as "billId",
      vb.bill_number as "billNumber",
      vb.vendor_invoice_number as "vendorInvoiceNumber",
      vb.invoice_date as "billInvoiceDate",
      vb.total_amount as "billTotalAmount",
      vb.paid_amount as "billPaidAmount",
      vb.balance_amount as "billBalanceAmount",
      vb.status as "billStatus",
      -- Payment
      vp.id as "paymentId",
      vp.payment_number as "paymentNumber",
      vp.amount as "paymentAmount",
      vp.payment_date as "paymentDate",
      vp.payment_mode as "paymentMode",
      vp.reference_number as "paymentRefNumber"
    FROM purchase_orders po
    LEFT JOIN vendors v ON v.id = po.vendor_id
    LEFT JOIN indents ind ON ind.id = po.indent_id
    LEFT JOIN users indUser ON indUser.id = ind.raised_by
    LEFT JOIN departments dept ON dept.id = ind.department_id
    -- GAP-1 FIX: Use LATERAL to pick the latest GRN per PO (prevents row duplication when multiple GRNs exist)
    LEFT JOIN LATERAL (
      SELECT * FROM grn WHERE po_id = po.id ORDER BY created_at DESC LIMIT 1
    ) g ON TRUE
    LEFT JOIN users gUser ON gUser.id = g.received_by
    -- Use LATERAL for vendor_bills: pick latest bill linked to this PO or its GRN (avoids OR-join fanout)
    LEFT JOIN LATERAL (
      SELECT * FROM vendor_bills
      WHERE po_id = po.id OR grn_id = g.id
      ORDER BY created_at DESC LIMIT 1
    ) vb ON TRUE
    -- GAP-1 FIX: LATERAL for payments — prevents N-row duplication when multiple partial payments exist
    LEFT JOIN LATERAL (
      SELECT * FROM vendor_payments
      WHERE bill_id = vb.id OR po_id = po.id
      ORDER BY payment_date DESC LIMIT 1
    ) vp ON TRUE
    ${where}
    ORDER BY po.created_at DESC
    LIMIT $${p}
  `, [...params, parseInt(limit)]);

  // Compute descriptive status and stage progression
  const mapped = rows.map(r => {
    let stageCode = 'PO_CREATED';
    let stageTitle = '1. Purchase Order Created';
    let stageDesc = `PO ${r.poNumber} issued to ${r.vendorName} for ₹${Number(r.poGrandTotal||0).toLocaleString('en-IN')}`;
    let stageBadgeBg = '#e0f2fe';
    let stageBadgeColor = '#0369a1';

    if (r.paymentNumber) {
      stageCode = 'PAYMENT_DISBURSED';
      stageTitle = '5. Payment Disbursed (Settled)';
      stageDesc = `Disbursed ₹${Number(r.paymentAmount||0).toLocaleString('en-IN')} via ${r.paymentMode} (${r.paymentRefNumber||'Ref'})`;
      stageBadgeBg = '#dcfce7';
      stageBadgeColor = '#15803d';
    } else if (r.billStatus === 'Approved') {
      stageCode = 'BILL_APPROVED';
      stageTitle = '4b. Bill Approved by Finance';
      stageDesc = `Bill ${r.billNumber} approved for payment of ₹${Number(r.billTotalAmount||0).toLocaleString('en-IN')}`;
      stageBadgeBg = '#ede9fe';
      stageBadgeColor = '#6d28d9';
    } else if (r.billNumber) {
      stageCode = 'BILL_BOOKED';
      stageTitle = '4a. Purchase Bill Booked (Pending AP)';
      stageDesc = `Vendor Bill ${r.billNumber} (Inv: ${r.vendorInvoiceNumber}) booked, awaiting Finance approval`;
      stageBadgeBg = '#fef3c7';
      stageBadgeColor = '#b45309';
    } else if (r.grnNumber) {
      stageCode = 'GRN_RECEIVED';
      stageTitle = '3. GRN Received (Stock Updated)';
      stageDesc = `Shipment received under ${r.grnNumber} at Store. Inventory updated.`;
      stageBadgeBg = '#ffedd5';
      stageBadgeColor = '#c2410c';
    } else if (r.poStatus === 'Approved') {
      stageCode = 'PO_APPROVED';
      stageTitle = '2. PO Approved & Dispatched to Vendor';
      stageDesc = `PO ${r.poNumber} approved and awaiting material delivery`;
      stageBadgeBg = '#f1f5f9';
      stageBadgeColor = '#334155';
    }

    return {
      ...r,
      stageCode,
      stageTitle,
      stageDesc,
      stageBadgeBg,
      stageBadgeColor
    };
  });

  res.json({ success: true, data: mapped, total: mapped.length });
}));

// ══════════════════════════════════════════════════════════════════════
// CASH PURCHASES / SPOT PROCUREMENT (BRANCH 2: INDENT -> CASH PURCHASE -> PURCHASE)
// ══════════════════════════════════════════════════════════════════════

// Auto-ensure cash_purchases tables exist
const ensureCashPurchaseTable = async (client) => {
  await client.query(`
    CREATE TABLE IF NOT EXISTS cash_purchases (
      id SERIAL PRIMARY KEY,
      voucher_number VARCHAR(50) UNIQUE NOT NULL,
      date DATE NOT NULL,
      indent_id INTEGER,
      vendor_name VARCHAR(150) NOT NULL,
      vendor_gstin VARCHAR(20),
      invoice_number VARCHAR(100),
      invoice_date DATE,
      payment_mode VARCHAR(50) DEFAULT 'Cash',
      payment_ref VARCHAR(100),
      taxable_amount NUMERIC(15,2) DEFAULT 0,
      cgst_amount NUMERIC(12,2) DEFAULT 0,
      sgst_amount NUMERIC(12,2) DEFAULT 0,
      igst_amount NUMERIC(12,2) DEFAULT 0,
      total_tax NUMERIC(12,2) DEFAULT 0,
      total_amount NUMERIC(15,2) NOT NULL,
      remarks TEXT,
      created_by INTEGER,
      created_at TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS cash_purchase_items (
      id SERIAL PRIMARY KEY,
      cash_purchase_id INTEGER REFERENCES cash_purchases(id) ON DELETE CASCADE,
      material_id INTEGER,
      qty NUMERIC(12,3) NOT NULL,
      uom VARCHAR(20),
      unit_price NUMERIC(12,2) NOT NULL,
      gst_pct NUMERIC(5,2) DEFAULT 18,
      line_taxable NUMERIC(15,2) NOT NULL,
      line_total NUMERIC(15,2) NOT NULL
    );
  `);
};

// LIST CASH PURCHASES
router.get('/cash-purchases', auth, ar(async (req, res) => {
  const { search, page = 1, limit = 50 } = req.query;
  const client = await pool.connect();
  try {
    await ensureCashPurchaseTable(client);
    const conds = [];
    const params = [];
    let p = 1;
    if (search) {
      conds.push(`(cp.voucher_number ILIKE $${p} OR cp.vendor_name ILIKE $${p} OR cp.invoice_number ILIKE $${p} OR ind.indent_number ILIKE $${p})`);
      params.push(`%${search}%`);
      p++;
    }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const { rows } = await client.query(
      `SELECT cp.*, cp.voucher_number as "voucherNumber", cp.vendor_name as "vendorName",
              cp.vendor_gstin as "vendorGstin", cp.invoice_number as "invoiceNumber",
              cp.taxable_amount as "taxableAmount", cp.total_amount as "totalAmount",
              ind.indent_number as "indentNumber", dept.name as "deptName", u.name as "createdByName",
              COALESCE((SELECT COUNT(*) FROM cash_purchase_items cpi WHERE cpi.cash_purchase_id = cp.id), 0)::int AS "itemCount"
       FROM cash_purchases cp
       LEFT JOIN indents ind ON ind.id = cp.indent_id
       LEFT JOIN departments dept ON dept.id = ind.department_id
       LEFT JOIN users u ON u.id = cp.created_by
       ${where}
       ORDER BY cp.created_at DESC
       LIMIT $${p} OFFSET $${p + 1}`,
      [...params, parseInt(limit), offset]
    );
    const { rows: cnt } = await client.query(`SELECT COUNT(*) FROM cash_purchases cp LEFT JOIN indents ind ON ind.id = cp.indent_id ${where}`, params);
    res.json({ success: true, data: rows, total: parseInt(cnt[0].count) });
  } finally {
    client.release();
  }
}));

// GET ONE CASH PURCHASE
router.get('/cash-purchases/:id', auth, ar(async (req, res) => {
  const client = await pool.connect();
  try {
    await ensureCashPurchaseTable(client);
    const isNum = /^\d+$/.test(String(req.params.id));
    const where = isNum ? `WHERE cp.id = $1` : `WHERE cp.voucher_number = $1`;
    const paramVal = isNum ? parseInt(req.params.id) : req.params.id;

    const { rows } = await client.query(
      `SELECT cp.*, cp.voucher_number as "voucherNumber", cp.vendor_name as "vendorName",
              cp.vendor_gstin as "vendorGstin", cp.invoice_number as "invoiceNumber",
              ind.indent_number as "indentNumber", dept.name as "deptName", u.name as "createdByName"
       FROM cash_purchases cp
       LEFT JOIN indents ind ON ind.id = cp.indent_id
       LEFT JOIN departments dept ON dept.id = ind.department_id
       LEFT JOIN users u ON u.id = cp.created_by
       ${where}`,
      [paramVal]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: 'Cash purchase voucher not found' });

    const cpId = rows[0].id;
    const { rows: items } = await client.query(
      `SELECT cpi.*, m.name as "materialName", m.code as "materialCode", m.uom as "matUom", m.hsn_code as "hsnCode"
       FROM cash_purchase_items cpi
       LEFT JOIN materials m ON m.id = cpi.material_id
       WHERE cpi.cash_purchase_id = $1
       ORDER BY cpi.id ASC`,
      [cpId]
    );
    res.json({ success: true, data: { ...rows[0], items } });
  } finally {
    client.release();
  }
}));

// CREATE CASH PURCHASE (ATOMIC STOCK INCREMENT + STOCK LEDGER + BILL ENTRY)
router.post('/cash-purchase', auth, requireLevel(2), ar(async (req, res) => {
  const { indent_id, vendor_name, vendor_gstin, invoice_number, invoice_date, payment_mode, payment_ref, remarks, items = [] } = req.body;
  if (!vendor_name || !items.length) {
    return res.status(400).json({ success: false, message: 'Vendor / Supplier name and items are required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await ensureCashPurchaseTable(client);

    const isInter = vendor_gstin && !vendor_gstin.startsWith('29');
    let totalTaxable = 0, totalCgst = 0, totalSgst = 0, totalIgst = 0;

    for (const it of items) {
      if (!it.material_id) throw new Error('Material is required on each line item');
      const qty = parseFloat(it.qty || 0);
      const unitPrice = parseFloat(it.unit_price || 0);
      const gstPct = parseFloat(it.gst_pct ?? 18);
      if (qty <= 0) throw new Error(`Invalid quantity ${qty} for item`);
      const lineTaxable = qty * unitPrice;
      const lineGst = lineTaxable * (gstPct / 100);
      totalTaxable += lineTaxable;
      if (isInter) {
        totalIgst += lineGst;
      } else {
        totalCgst += lineGst / 2;
        totalSgst += lineGst / 2;
      }
    }

    const totalTax = totalCgst + totalSgst + totalIgst;
    const grandTotal = totalTaxable + totalTax;

    // Sequence Generator for Cash Purchase (CP-YYYYMMDD-XXXX)
    const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [`cp-${stamp}`]);
    const { rows: seqRows } = await client.query(
      `SELECT LPAD((COUNT(*) + 1)::text, 4, '0') as seq FROM cash_purchases WHERE voucher_number LIKE $1`,
      [`CP-${stamp}-%`]
    );
    const cpNum = `CP-${stamp}-${seqRows[0].seq}`;

    // Insert Header
    const { rows: [cpHead] } = await client.query(
      `INSERT INTO cash_purchases (
         voucher_number, date, indent_id, vendor_name, vendor_gstin, invoice_number,
         invoice_date, payment_mode, payment_ref, taxable_amount, cgst_amount, sgst_amount,
         igst_amount, total_tax, total_amount, remarks, created_by
       ) VALUES ($1, CURRENT_DATE, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
       RETURNING *`,
      [
        cpNum, indent_id || null, vendor_name, vendor_gstin || null, invoice_number || null,
        invoice_date || new Date().toISOString().slice(0, 10), payment_mode || 'Cash',
        payment_ref || null, totalTaxable, totalCgst, totalSgst, totalIgst, totalTax, grandTotal,
        remarks || null, req.user.id
      ]
    );

    const cpId = cpHead.id;

    // Process Line Items + Stock Increment + Stock Ledger
    for (const it of items) {
      const qty = parseFloat(it.qty);
      const unitPrice = parseFloat(it.unit_price || 0);
      const gstPct = parseFloat(it.gst_pct ?? 18);
      const lineTaxable = qty * unitPrice;
      const lineTotal = lineTaxable * (1 + gstPct / 100);

      await client.query(
        `INSERT INTO cash_purchase_items (cash_purchase_id, material_id, qty, uom, unit_price, gst_pct, line_taxable, line_total)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [cpId, it.material_id, qty, it.uom || 'NOS', unitPrice, gstPct, lineTaxable, lineTotal]
      );

      // Atomically update materials stock
      const { rows: [mat] } = await client.query(
        `SELECT current_stock FROM materials WHERE id = $1 FOR UPDATE`,
        [it.material_id]
      );
      const curStock = parseFloat(mat?.current_stock || 0);
      const newStock = curStock + qty;

      await client.query(
        `UPDATE materials SET current_stock = $1, unit_price = CASE WHEN $2::numeric > 0 THEN $2::numeric ELSE unit_price END WHERE id = $3`,
        [newStock, unitPrice, it.material_id]
      );

      // Record in stock_ledger
      await client.query(
        `INSERT INTO stock_ledger (material_id, date, transaction_type, reference_type, reference_id, in_qty, out_qty, balance, unit_price, value, remarks, created_by)
         VALUES ($1, CURRENT_DATE, 'cash_purchase', 'cash_purchase', $2, $3, 0, $4, $5, $6, $7, $8)`,
        [it.material_id, cpId, qty, newStock, unitPrice, lineTaxable, `Cash Purchase ${cpNum} from ${vendor_name}`, req.user.id]
      );
    }

    // If linked to an Indent, update indent status to 'Cash Purchased'
    if (indent_id) {
      const { rows: [ind] } = await client.query(`SELECT status, indent_number FROM indents WHERE id = $1`, [indent_id]);
      await client.query(`UPDATE indents SET status = 'Cash Purchased' WHERE id = $1`, [indent_id]);
      await client.query(
        `INSERT INTO indent_audit_log (indent_id, action, old_status, new_status, user_id, remarks)
         VALUES ($1, 'Cash Purchased', $2, 'Cash Purchased', $3, $4)`,
        [indent_id, ind?.status || null, req.user.id, `Fulfilled via Cash Purchase Voucher ${cpNum}`]
      );
      await client.query(
        `INSERT INTO store_indent_log (indent_id, action, from_status, to_status, actor_id, actor_name, actor_role, note)
         VALUES ($1, 'Cash Purchased', $2, 'Cash Purchased', $3, $4, $5, $6)
         ON CONFLICT DO NOTHING`,
        [indent_id, ind?.status || null, req.user.id, req.user.name || 'Purchaser', req.user.role || 'Staff', `Fulfilled via Cash Purchase ${cpNum}`]
      );
    }

    // Auto-record paid vendor bill for Finance synchronization
    try {
      await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [`bill-${stamp}`]);
      const { rows: seqRowsBill } = await client.query(`SELECT LPAD((COUNT(*)+1)::text, 4, '0') as seq FROM vendor_bills WHERE bill_number LIKE $1`, [`BILL-${stamp}-%`]);
      const billNum = `BILL-${stamp}-${seqRowsBill[0].seq}`;

      await client.query(
        `INSERT INTO vendor_bills (
           bill_number, vendor_id, po_id, grn_id, vendor_invoice_number,
           invoice_date, due_date, taxable_amount, cgst_amount, sgst_amount,
           igst_amount, total_tax, roundoff, total_amount, paid_amount,
           balance_amount, status, remarks, created_by
         ) VALUES ($1, NULL, NULL, NULL, $2, CURRENT_DATE, CURRENT_DATE, $3, $4, $5, $6, $7, 0, $8, $8, 0, 'Paid', $9, $10)`,
        [
          billNum, invoice_number || cpNum, totalTaxable, totalCgst, totalSgst, totalIgst,
          totalTax, grandTotal, `Cash Purchase ${cpNum} (${payment_mode || 'Cash'}) - ${vendor_name}`, req.user.id
        ]
      );
    } catch(err) { /* non-blocking */ }

    await client.query('COMMIT');
    res.status(201).json({
      success: true,
      data: { ...cpHead, items_count: items.length },
      message: `Cash Purchase Voucher ${cpNum} generated successfully! Stock incremented and recorded in ledger.`
    });
  } catch (e) {
    await client.query('ROLLBACK');
    return res.status(400).json({ success: false, message: e.message });
  } finally {
    client.release();
  }
}));

module.exports = router;

