const router = require('express').Router();
const pool = require('../db/pool');
const { auth, requireLevel } = require('../middleware/auth');
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
            (
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
            ) as items
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
            m.hsn_code as "hsnCode", m.current_stock as "currentStock", m.bin_location as "binLocation"
     FROM po_items pi
     LEFT JOIN materials m ON m.id=pi.material_id
     WHERE pi.po_id=$1
     ORDER BY pi.id ASC`, [poId]
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
    const num = await seqNum(client);
    let total=0, gst=0;
    for (const it of items) {
      const lineTotal = (parseFloat(it.qty)||0)*(parseFloat(it.unit_price)||0);
      total += lineTotal;
      gst += lineTotal * (parseFloat(it.gst_pct)||18) / 100;
    }
    const { rows } = await client.query(
      `INSERT INTO purchase_orders (po_number,date,vendor_id,indent_id,delivery_date,payment_terms,
         status,total_value,gst_value,grand_total,created_by,remarks)
       VALUES ($1,NOW(),$2,$3,$4,$5,'Draft',$6,$7,$8,$9,$10) RETURNING *`,
      [num, vendor_id, indent_id||null, delivery_date||null, payment_terms||null,
       total, gst, total+gst, req.user.id, remarks||null]
    );
    const poId = rows[0].id;
    for (const it of items) {
      const lineTotal = (it.qty||0)*(it.unit_price||0);
      await client.query(
        `INSERT INTO po_items (po_id,material_id,qty,uom,unit_price,gst_pct,total)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [poId, it.material_id, it.qty, it.uom||'', it.unit_price||0, it.gst_pct||18, lineTotal]
      );
    }
    if (indent_id) {
      const { rows: [ind] } = await client.query(`SELECT status FROM indents WHERE id=$1`, [indent_id]);
      await client.query(`UPDATE indents SET status='PO Created' WHERE id=$1`, [indent_id]);
      await client.query(
        `INSERT INTO indent_audit_log (indent_id, action, old_status, new_status, user_id, remarks)
         VALUES ($1, 'PO Created', $2, 'PO Created', $3, $4)`,
        [indent_id, ind?.status || null, req.user.id, `PO ${num} Created`]
      );
      // GAP-4 FIX: Always write store_indent_log for ALL indent types (removed incorrect store_indents table guard)
      await client.query(
        `INSERT INTO store_indent_log (indent_id,action,from_status,to_status,actor_id,actor_name,actor_role,note)
         VALUES ($1,'PO Created',$2,'PO Created',$3,$4,$5,$6)
         ON CONFLICT DO NOTHING`,
        [indent_id, ind?.status||null, req.user.id, req.user.name||'System', req.user.role||'Procurement', `PO ${num} Created`]
      );
    }
    await client.query('COMMIT');
    res.json({ success:true, data:rows[0] });
  } catch(e) { await client.query('ROLLBACK'); throw e; }
  finally { client.release(); }
}));

// EDIT PO — only Draft status, only by creator or level 4+
router.put('/po/:id', auth, requireLevel(3), ar(async (req, res) => {
  const { delivery_date, payment_terms, remarks, items } = req.body;
  const { rows: [po] } = await pool.query(`SELECT * FROM purchase_orders WHERE id=$1`, [req.params.id]);
  if (!po) return res.json({ success: false, message: 'Not found' });
  if (po.status !== 'Draft') return res.status(400).json({ success: false, message: 'Only Draft POs can be edited' });
  if (po.created_by !== req.user.id && req.user.role_level < 4)
    return res.status(403).json({ success: false, message: 'Only the creator or admin can edit this PO' });

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

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Recalculate totals
    let total = 0;
    let gst = 0;
    if (items && items.length) {
      for (const it of items) {
        const lineTotal = (parseFloat(it.qty)||0) * (parseFloat(it.unit_price)||0);
        total += lineTotal;
        gst += lineTotal * (parseFloat(it.gst_pct)||18) / 100;
      }
      // Replace items
      await client.query(`DELETE FROM po_items WHERE po_id=$1`, [req.params.id]);
      for (const it of items) {
        const lineTotal = (parseFloat(it.qty)||0) * (parseFloat(it.unit_price)||0);
        await client.query(
          `INSERT INTO po_items (po_id,material_id,qty,uom,unit_price,gst_pct,total) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [req.params.id, it.material_id, it.qty, it.uom||'', it.unit_price||0, it.gst_pct||18, lineTotal]
        );
      }
    } else {
      // Keep existing items, recalculate
      const { rows: existItems } = await client.query(`SELECT qty, unit_price, gst_pct FROM po_items WHERE po_id=$1`, [req.params.id]);
      for (const it of existItems) {
        const lineTotal = parseFloat(it.qty) * parseFloat(it.unit_price);
        total += lineTotal;
        gst += lineTotal * parseFloat(it.gst_pct||18) / 100;
      }
    }
    const { rows } = await client.query(
      `UPDATE purchase_orders SET delivery_date=COALESCE($1,delivery_date), payment_terms=COALESCE($2,payment_terms),
         remarks=COALESCE($3,remarks), total_value=$4, gst_value=$5, grand_total=$6
       WHERE id=$7 RETURNING *`,
      [delivery_date||null, payment_terms||null, remarks||null, total, gst, total+gst, req.params.id]
    );
    await client.query('COMMIT');
    res.json({ success: true, data: rows[0] });
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
  const { rows } = await pool.query(
    `UPDATE purchase_orders SET status='Cancelled' WHERE id=$1 AND status IN ('Draft','Approved') RETURNING *`,
    [req.params.id]
  );
  res.json({ success:!!rows.length, data:rows[0] });
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
  const isNum = /^\d+$/.test(String(req.params.id));
  const where = isNum ? `WHERE g.id=$1` : `WHERE g.grn_number=$1`;
  const paramVal = isNum ? parseInt(req.params.id) : req.params.id;

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
     ${where}`, [paramVal]
  );
  if (!rows.length) return res.json({ success: false, message: 'GRN not found' });

  const grnId = rows[0].id;
  const { rows: items } = await pool.query(
    `SELECT gi.*, m.name as "materialName", m.code as "materialCode", m.uom as "matUom", m.hsn_code as "hsnCode",
            COALESCE(pi.gst_pct, 18) as "gst_pct"
     FROM grn_items gi
     LEFT JOIN materials m ON m.id = gi.material_id
     LEFT JOIN grn g ON g.id = gi.grn_id
     LEFT JOIN po_items pi ON pi.po_id = g.po_id AND pi.material_id = gi.material_id
     WHERE gi.grn_id = $1
     ORDER BY gi.id ASC`, [grnId]
  );
  res.json({ success: true, data: { ...rows[0], items } });
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
      `SELECT id, material_id, uom, qty, received_qty, unit_price FROM po_items WHERE po_id=$1`, [poId]
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
      const binLoc = userIt ? (userIt.bin_location || null) : null;
      const lineRemarks = userIt ? (userIt.remarks || null) : null;

      if (recQty <= 0) continue;

      await client.query(
        `INSERT INTO grn_items (grn_id, material_id, po_qty, received_qty, accepted_qty, rejected_qty, uom, unit_price, bin_location, remarks)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [grnId, poIt.material_id, remaining, recQty, accQty, rejQty, poIt.uom, uPrice, binLoc, lineRemarks]
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
          `UPDATE materials SET current_stock=$1, unit_price=CASE WHEN $2>0 THEN $2 ELSE unit_price END, updated_at=NOW() WHERE id=$3`,
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
          [f.id, `GRN ${grnNum} Received`, `GRN ${grnNum} against PO ${po.po_number} accepted & stock updated. Ready for AP bill processing.`, grnId]
        );
      }
    } catch(err) { /* non-blocking */ }

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
  if (!vendor_invoice_number || !invoice_date) {
    return res.status(400).json({ success: false, message: 'Vendor Invoice Number and Invoice Date are required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: [po] } = await client.query(`SELECT po_number, vendor_id, grand_total, total_value, gst_value FROM purchase_orders WHERE id=$1`, [poId]);
    if (!po) throw new Error('Purchase order not found');

    const taxAmount = Number(taxable_amount ?? po.total_value ?? 0);
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
        `UPDATE materials SET current_stock = $1, unit_price = CASE WHEN $2 > 0 THEN $2 ELSE unit_price END, updated_at = NOW() WHERE id = $3`,
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

