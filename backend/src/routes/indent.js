const router = require('express').Router();
const pool = require('../db/pool');
const { auth, requireLevel, requireStore } = require('../middleware/auth');
const { publish } = require('../kafka');
const ar = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const isStoreManager = (user) =>
  user?.role_level >= 3 && (user?.dept_code === 'STORE' || user?.department === 'Store Management');

const logStoreIndent = async (clientOrPool, indentId, action, fromStatus, toStatus, actorId, actorName, actorRole, note = null) => {
  try {
    await clientOrPool.query(
      `INSERT INTO store_indent_log (indent_id,action,from_status,to_status,actor_id,actor_name,actor_role,note)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [indentId, action, fromStatus, toStatus, actorId, actorName, actorRole, note]
    );
  } catch (err) {
    console.error('store_indent_log write error:', err.message);
  }
};

// Doc31 #8: advisory lock serializes concurrent seqNum calls within same date+prefix — prevents
// two simultaneous submits landing on the same IND-YYYYMMDD-NNNN number. Caller must already be in a transaction.
//
// IMPORTANT: this MUST derive the next number from the highest suffix actually in use
// (MAX), never from a row COUNT. Indents can be hard-deleted (see the force-delete route
// in this file and the delete route in store.js), which leaves a gap in the sequence —
// COUNT(*)+1 then reissues a number that's already taken by a surviving later row and
// the INSERT fails with "duplicate key value violates unique constraint
// indents_indent_number_key". store.js's own indent-creation route already used the
// correct MAX-based approach; this one didn't, which is why the two could disagree.
const seqNum = async (client) => {
  const stamp = new Date().toISOString().slice(0,10).replace(/-/g,'');
  await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [`indent-${stamp}`]);
  const { rows } = await client.query(
    `SELECT LPAD((COALESCE(MAX(NULLIF(regexp_replace(indent_number, '^IND-[0-9]+-', ''), '')), '0')::int + 1)::text, 4, '0') AS seq
     FROM indents WHERE indent_number LIKE $1`,
    [`IND-${stamp}-%`]
  );
  return `IND-${stamp}-${rows[0].seq}`;
};

// LIST
router.get('/', auth, ar(async (req, res) => {
  const { status, dept, search, page=1, limit=25 } = req.query;
  const conds = []; const params = []; let p=1;
  if (status) { conds.push(`i.status=$${p++}`); params.push(status); }
  if (dept)   { conds.push(`i.department_id=$${p++}`); params.push(dept); }
  if (search) {
    conds.push(`(i.indent_number ILIKE $${p} OR d.name ILIKE $${p} OR i.remarks ILIKE $${p} OR i.cancellation_reason ILIKE $${p} OR u.name ILIKE $${p} OR u.employee_code ILIKE $${p} OR mch.name ILIKE $${p} OR ps.section_code ILIKE $${p} OR ps.name ILIKE $${p} OR po.po_number ILIKE $${p} OR po.vendor_name ILIKE $${p} OR gp.gp_number ILIKE $${p} OR EXISTS (SELECT 1 FROM indent_items ii JOIN materials m ON m.id=ii.material_id WHERE ii.indent_id=i.id AND (m.name ILIKE $${p} OR m.code ILIKE $${p} OR ii.purpose ILIKE $${p} OR ii.reason_code ILIKE $${p})))`);
    params.push(`%${search}%`);
    p++;
  }
  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
  const offset = (parseInt(page)-1)*parseInt(limit);
  const { rows } = await pool.query(
    `SELECT i.id, i.indent_number as "indentNumber", i.date, i.priority, i.status,
            i.required_date as "requiredDate", i.remarks, i.raised_by, i.section_id as "sectionId",
            i.machine_id as "machineId", i.created_at as "raisedAt",
            i.cancellation_reason as "cancellationReason", i.cancelled_at as "cancelledAt",
            cu.name as "cancelledByName", cu.employee_code as "cancelledByEmpCode",
            ps.section_code as "sectionCode", ps.name as "sectionName",
            mch.name as "machineName", mch.code as "machineCode", mch.type as "machineType",
            COALESCE(NULLIF(i.total_value, 0), (SELECT SUM(ii.required_qty * COALESCE(m.unit_price, 0)) FROM indent_items ii LEFT JOIN materials m ON m.id = ii.material_id WHERE ii.indent_id = i.id)) as "total_value",
            d.name as "deptName", d.code as "deptCode",
            u.name as "raisedBy", u.name as "raisedByName", u.employee_code as "raisedByEmpCode",
            r.name as "raisedByRole", u.email as "raisedByEmail", u.mobile as "raisedByMobile",
            po.id as "linkedPoId", po.po_number as "linkedPoNumber", po.status as "linkedPoStatus",
            po.grand_total as "linkedPoGrandTotal", po.vendor_name as "linkedPoVendorName",
            gp.id as "linkedGpId", gp.gp_number as "linkedGpNumber", gp.status as "linkedGpStatus", gp.pass_type as "linkedGpType",
            cp.id as "linkedCpId", cp.voucher_number as "linkedCpNumber", cp.total_amount as "linkedCpTotalAmount", cp.vendor_name as "linkedCpVendorName",
            (SELECT ii.reason_code FROM indent_items ii WHERE ii.indent_id = i.id ORDER BY ii.id ASC LIMIT 1) AS "reasonCode",
            (SELECT ii.purpose FROM indent_items ii WHERE ii.indent_id = i.id ORDER BY ii.id ASC LIMIT 1) AS "itemPurpose",
            (SELECT COUNT(*) FROM indent_items ii WHERE ii.indent_id = i.id)::int AS "itemCount"
     FROM indents i
     LEFT JOIN departments d ON d.id=i.department_id
     LEFT JOIN users u ON u.id=i.raised_by
     LEFT JOIN roles r ON r.id=u.role_id
     LEFT JOIN users cu ON cu.id=i.cancelled_by
     LEFT JOIN plant_sections ps ON ps.id=i.section_id
     LEFT JOIN machines mch ON mch.id=i.machine_id
     LEFT JOIN LATERAL (
       SELECT po.id, po.po_number, po.status, po.grand_total, v.name as "vendor_name"
       FROM purchase_orders po
       LEFT JOIN vendors v ON v.id = po.vendor_id
       WHERE po.indent_id = i.id
       ORDER BY po.id DESC LIMIT 1
     ) po ON TRUE
     LEFT JOIN LATERAL (
       SELECT gp.id, gp.gp_number, gp.status, gp.pass_type
       FROM gate_passes gp
       WHERE gp.remarks ILIKE '%' || i.indent_number || '%' OR (po.id IS NOT NULL AND gp.po_id = po.id)
       ORDER BY gp.id DESC LIMIT 1
     ) gp ON TRUE
     LEFT JOIN LATERAL (
       SELECT cp.id, cp.voucher_number, cp.total_amount, cp.vendor_name
       FROM cash_purchases cp
       WHERE cp.indent_id = i.id
       ORDER BY cp.id DESC LIMIT 1
     ) cp ON TRUE
     ${where} ORDER BY i.created_at DESC LIMIT $${p} OFFSET $${p+1}`,
    [...params, parseInt(limit), offset]
  );
  const { rows: cnt } = await pool.query(
    `SELECT COUNT(DISTINCT i.id) FROM indents i
     LEFT JOIN departments d ON d.id=i.department_id
     LEFT JOIN users u ON u.id=i.raised_by
     LEFT JOIN plant_sections ps ON ps.id=i.section_id
     LEFT JOIN machines mch ON mch.id=i.machine_id
     LEFT JOIN LATERAL (
       SELECT po.id, po.po_number, po.status, po.grand_total, v.name as "vendor_name"
       FROM purchase_orders po
       LEFT JOIN vendors v ON v.id = po.vendor_id
       WHERE po.indent_id = i.id
       ORDER BY po.id DESC LIMIT 1
     ) po ON TRUE
     LEFT JOIN LATERAL (
       SELECT gp.id, gp.gp_number, gp.status, gp.pass_type
       FROM gate_passes gp
       WHERE gp.remarks ILIKE '%' || i.indent_number || '%' OR (po.id IS NOT NULL AND gp.po_id = po.id)
       ORDER BY gp.id DESC LIMIT 1
     ) gp ON TRUE
     LEFT JOIN LATERAL (
       SELECT cp.id, cp.voucher_number, cp.total_amount, cp.vendor_name
       FROM cash_purchases cp
       WHERE cp.indent_id = i.id
       ORDER BY cp.id DESC LIMIT 1
     ) cp ON TRUE
     ${where}`, params
  );
  res.json({ success:true, data:rows, total:parseInt(cnt[0].count) });
}));

// ANALYTICS — admin dashboard
router.get('/analytics/summary', auth, requireLevel(2), ar(async (req, res) => {
  const { from, to } = req.query;
  const hasDate = Boolean(from && to);
  const dateFilter = hasDate ? `AND i.date BETWEEN $1 AND $2` : '';
  const params = hasDate ? [from, to] : [];

  const [summary, byDept, topParts, pending_ack] = await Promise.all([
    pool.query(`SELECT
      COUNT(*) AS total,
      COUNT(*) FILTER(WHERE status='Draft') AS draft,
      COUNT(*) FILTER(WHERE status='Submitted') AS submitted,
      COUNT(*) FILTER(WHERE status IN('L1 Approved','L2 Approved','Approved')) AS approved,
      COUNT(*) FILTER(WHERE status='Partially Issued') AS partially_issued,
      COUNT(*) FILTER(WHERE status='Issued') AS issued,
      COUNT(*) FILTER(WHERE status='Closed') AS closed,
      COUNT(*) FILTER(WHERE status='Cancelled') AS cancelled,
      COALESCE(SUM(total_value) FILTER(WHERE status='Closed'),0) AS closed_value,
      COALESCE(SUM(total_value),0) AS total_value
      FROM indents i WHERE 1=1 ${dateFilter}`, params),
    pool.query(`SELECT d.name AS dept, COUNT(*) AS indents,
      COALESCE(SUM(i.total_value),0) AS value
      FROM indents i JOIN departments d ON d.id=i.department_id WHERE 1=1 ${dateFilter}
      GROUP BY d.name ORDER BY value DESC LIMIT 10`, params),
    pool.query(`SELECT m.name AS part, SUM(ii.issued_qty) AS qty, SUM(ii.line_value) AS value
      FROM indent_items ii JOIN materials m ON m.id=ii.material_id
      JOIN indents i ON i.id=ii.indent_id WHERE i.status IN('Issued','Partially Issued','Closed') ${dateFilter}
      GROUP BY m.name ORDER BY value DESC LIMIT 10`, params),
    pool.query(`SELECT COUNT(*) AS cnt FROM indent_items WHERE ack_status='pending'`)
  ]);
  res.json({ success:true, data:{
    summary: summary.rows[0],
    byDept: byDept.rows,
    topParts: topParts.rows,
    pendingAck: pending_ack.rows[0].cnt
  }});
}));

// CALENDAR — events for calendar view
router.get('/calendar', auth, ar(async (req, res) => {
  const { month, year } = req.query;
  const { rows } = await pool.query(`
    SELECT i.id, i.indent_number AS num, i.status, i.date, i.total_value,
           d.name AS dept, u.name AS raised_by
    FROM indents i
    LEFT JOIN departments d ON d.id=i.department_id
    LEFT JOIN users u ON u.id=i.raised_by
    WHERE EXTRACT(MONTH FROM i.date)=$1 AND EXTRACT(YEAR FROM i.date)=$2
    ORDER BY i.date`,
    [month||new Date().getMonth()+1, year||new Date().getFullYear()]
  );
  res.json({ success:true, data:rows });
}));

// PENDING ACKNOWLEDGMENTS for a user
router.get('/my-acks', auth, ar(async (req, res) => {
  const { rows } = await pool.query(`
    SELECT ii.id AS item_id, ii.material_id, ii.required_qty, ii.issued_qty, ii.uom,
           ii.component_position, ii.purpose, ii.batch_no,
           m.name AS part_name, m.code AS part_code,
           i.id AS indent_id, i.indent_number, i.date,
           d.name AS dept
    FROM indent_items ii
    JOIN indents i ON i.id=ii.indent_id
    JOIN materials m ON m.id=ii.material_id
    JOIN departments d ON d.id=i.department_id
    WHERE i.status IN ('Issued', 'Partially Issued') AND ii.ack_status='pending'
      AND (i.department_id = (SELECT department_id FROM users WHERE id=$1) OR i.raised_by=$1)
    ORDER BY i.issued_at DESC`,
    [req.user.id]
  );
  res.json({ success:true, data:rows });
}));

// GET ONE WITH FULL DETAILS & ITEMS
// GET ONE WITH FULL DETAILS & ITEMS & TIMELINE
router.get('/:id', auth, ar(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT i.*, i.created_at as "raisedAt",
            i.cancellation_reason as "cancellationReason", i.cancelled_at as "cancelledAt",
            cu.name as "cancelledByName", cu.employee_code as "cancelledByEmpCode",
            d.name as "deptName", d.code as "deptCode", d.category as "deptCategory",
            u.name as "raisedByName", u.name as "raisedBy", u.employee_code as "raisedByEmpCode",
            r.name as "raisedByRole", u.email as "raisedByEmail", u.mobile as "raisedByMobile",
            l1_u.name as "l1ApprovedByName", l1_u.employee_code as "l1ApprovedByEmpCode",
            l2_u.name as "l2ApprovedByName", l2_u.employee_code as "l2ApprovedByEmpCode",
            iss_u.name as "issuedByName", iss_u.employee_code as "issuedByEmpCode",
            rec_u.name as "receiverSignedByName", rec_u.employee_code as "receiverSignedByEmpCode",
            ps.section_code as "sectionCode", ps.name as "sectionName",
            mch.name as "machineName", mch.code as "machineCode", mch.type as "machineType",
            po.id as "linkedPoId", po.po_number as "linkedPoNumber", po.status as "linkedPoStatus",
            po.grand_total as "linkedPoGrandTotal", po.vendor_name as "linkedPoVendorName",
            gp.id as "linkedGpId", gp.gp_number as "linkedGpNumber", gp.status as "linkedGpStatus", gp.pass_type as "linkedGpType",
            cp.id as "linkedCpId", cp.voucher_number as "linkedCpNumber", cp.total_amount as "linkedCpTotalAmount", cp.vendor_name as "linkedCpVendorName"
     FROM indents i
     LEFT JOIN departments d ON d.id=i.department_id
     LEFT JOIN users u ON u.id=i.raised_by
     LEFT JOIN roles r ON r.id=u.role_id
     LEFT JOIN users cu ON cu.id=i.cancelled_by
     LEFT JOIN users l1_u ON l1_u.id=i.l1_approved_by
     LEFT JOIN users l2_u ON l2_u.id=i.l2_approved_by
     LEFT JOIN users iss_u ON iss_u.id=i.issued_by
     LEFT JOIN users rec_u ON rec_u.id=i.receiver_signed_by
     LEFT JOIN plant_sections ps ON ps.id=i.section_id
     LEFT JOIN machines mch ON mch.id=i.machine_id
     LEFT JOIN LATERAL (
       SELECT po.id, po.po_number, po.status, po.grand_total, v.name as "vendor_name"
       FROM purchase_orders po
       LEFT JOIN vendors v ON v.id = po.vendor_id
       WHERE po.indent_id = i.id
       ORDER BY po.id DESC LIMIT 1
     ) po ON TRUE
     LEFT JOIN LATERAL (
       SELECT gp.id, gp.gp_number, gp.status, gp.pass_type
       FROM gate_passes gp
       WHERE gp.remarks ILIKE '%' || i.indent_number || '%' OR (po.id IS NOT NULL AND gp.po_id = po.id)
       ORDER BY gp.id DESC LIMIT 1
     ) gp ON TRUE
     LEFT JOIN LATERAL (
       SELECT cp.id, cp.voucher_number, cp.total_amount, cp.vendor_name
       FROM cash_purchases cp
       WHERE cp.indent_id = i.id
       ORDER BY cp.id DESC LIMIT 1
     ) cp ON TRUE
     WHERE i.id=$1`,
    [req.params.id]
  );
  if (!rows.length) return res.json({ success:false, message:'Not found' });
  const { rows: items } = await pool.query(
    `SELECT ii.*, m.name as "materialName", m.code as "materialCode", m.uom as "matUom", m.current_stock as "matCurrentStock",
            m.hsn_code as "hsnCode", m.bin_location as "binLocation",
            mc.name as "categoryName",
            COALESCE(ii.unit_price, m.unit_price, 0) as "matPrice",
            COALESCE(ii.line_value, (ii.required_qty * COALESCE(m.unit_price, 0))) as "lineValue"
     FROM indent_items ii
     LEFT JOIN materials m ON m.id=ii.material_id
     LEFT JOIN material_categories mc ON mc.id=m.category_id
     WHERE ii.indent_id=$1
     ORDER BY ii.id ASC`,
    [req.params.id]
  );

  const { rows: timeline } = await pool.query(
    `SELECT id, action, from_status AS "fromStatus", to_status AS "toStatus",
            actor_id AS "actorId", actor_name AS "actorName", actor_role AS "actorRole",
            qty_issued AS "qtyIssued", note, created_at AS "createdAt"
     FROM store_indent_log
     WHERE indent_id = $1
     ORDER BY created_at ASC`,
    [req.params.id]
  );

  res.json({ success:true, data:{ ...rows[0], items, timeline } });
}));

// CREATE INDENT (Supports Multi-Mode Fulfillment: PR, Direct PO, Direct DC / Gate Pass, Immediate Store Issuance)
router.post('/', auth, requireLevel(1), ar(async (req, res) => {
  const { department_id, required_date, priority='Normal', remarks, items=[], section, machine_id,
          fulfillment_mode = 'pr', vendor_id, payment_terms, delivery_date,
          dc_type = 'MATERIAL_OUT', vehicle_number, vehicle_type, driver_name, to_party, consignee_vendor_id, dc_purpose,
          expected_return_date } = req.body;
  if (!department_id || !items.length) return res.json({ success:false, message:'Department and items are required' });
  if (!required_date) return res.json({ success:false, message:'Required By Date is required' });
  if (!section) return res.json({ success:false, message:'Plant Section / Area is required' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const num = await seqNum(client);
    let totalVal = 0;

    let secId = null;
    if (section !== undefined && section !== null && section !== '') {
      if (!isNaN(parseInt(section))) {
        const { rows: pRows } = await client.query('SELECT id FROM plant_sections WHERE id = $1', [parseInt(section)]);
        if (pRows.length) secId = pRows[0].id;
      }
      if (!secId) {
        const { rows: pRows } = await client.query('SELECT id FROM plant_sections WHERE section_code ILIKE $1 OR name ILIKE $1 LIMIT 1', [String(section).trim()]);
        if (pRows.length) secId = pRows[0].id;
      }
    }
    let machId = null;
    if (machine_id && !isNaN(parseInt(machine_id))) machId = parseInt(machine_id);

    let initialStatus = 'Submitted';
    if (fulfillment_mode === 'po') initialStatus = 'PO Created';
    else if (fulfillment_mode === 'dc') initialStatus = 'DC Generated';
    else if (fulfillment_mode === 'issue') initialStatus = 'Issued';
    else if (fulfillment_mode === 'cash') initialStatus = 'Cash Purchased';

    const { rows } = await client.query(
      `INSERT INTO indents (indent_number,date,department_id,required_date,priority,status,raised_by,remarks,section_id,machine_id)
       VALUES ($1,NOW(),$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [num, department_id, required_date||null, priority||'Normal', initialStatus, req.user.id, remarks||null, secId, machId]
    );
    const id = rows[0].id;

    const insertedItems = [];
    for (const it of items) {
      const { rows: mat } = await client.query(`SELECT current_stock, unit_price, uom, is_serialized, expected_lifespan_days FROM materials WHERE id=$1`, [it.material_id]);
      const price = it.unit_price !== undefined && it.unit_price !== '' ? parseFloat(it.unit_price) : parseFloat(mat[0]?.unit_price || 0);
      const qty = parseFloat(it.required_qty || 0);
      const lVal = qty * price;
      totalVal += lVal;

      const itemUom = mat[0]?.uom || it.uom || 'NOS';
      const { rows: [iItem] } = await client.query(
        `INSERT INTO indent_items (indent_id,material_id,required_qty,uom,purpose,current_stock,component_position,reason_code,unit_price,line_value,maintenance_log_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
        [id, it.material_id, qty, itemUom, it.purpose||'', mat[0]?.current_stock||0, it.component_position||null, it.reason_code||'Routine Replacement', price, lVal, it.maintenance_log_id ? parseInt(it.maintenance_log_id) : null]
      );
      insertedItems.push({ ...iItem, uom: itemUom, current_stock: mat[0]?.current_stock, is_serialized: mat[0]?.is_serialized, expected_lifespan_days: mat[0]?.expected_lifespan_days });
    }

    await client.query(`UPDATE indents SET total_value = $1 WHERE id = $2`, [totalVal, id]);

    let createdPo = null;
    let createdGp = null;
    let createdCp = null;

    // ── Fulfillment Branch 1: DIRECT PURCHASE ORDER (PO) ──
    if (fulfillment_mode === 'po') {
      if (!vendor_id) throw new Error('Vendor is required for Direct Purchase Order generation');
      const d = new Date();
      const stamp = d.toISOString().slice(0, 10).replace(/-/g, '');
      await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [`po-${stamp}`]);
      const seqRes = await client.query(`SELECT LPAD((COUNT(*)+1)::text,4,'0') as seq FROM purchase_orders WHERE po_number LIKE $1`, [`PO-${stamp}-%`]);
      const poNum = `PO-${stamp}-${seqRes.rows[0].seq}`;

      let poTotalVal = 0;
      let poGstVal = 0;
      for (const it of items) {
        const p = it.unit_price !== undefined && it.unit_price !== '' ? parseFloat(it.unit_price) : (insertedItems.find(x => x.material_id === it.material_id)?.unit_price || 0);
        const q = parseFloat(it.required_qty || 0);
        const lineBase = p * q;
        const gstPct = parseFloat(it.gst_pct ?? 18);
        const lineGst = (lineBase * gstPct) / 100;
        poTotalVal += lineBase;
        poGstVal += lineGst;
      }
      const poGrandTotal = poTotalVal + poGstVal;

      const { rows: [po] } = await client.query(
        `INSERT INTO purchase_orders (po_number, date, vendor_id, indent_id, delivery_date, payment_terms, status, total_value, gst_value, grand_total, created_by, remarks)
         VALUES ($1, CURRENT_DATE, $2, $3, $4, $5, 'Approved', $6, $7, $8, $9, $10) RETURNING *`,
        [poNum, vendor_id, id, delivery_date || required_date || null, payment_terms || 'Net 30 Days', poTotalVal, poGstVal, poGrandTotal, req.user.id, remarks ? `Direct PO from Indent ${num}: ${remarks}` : `Direct PO from Indent ${num}`]
      );
      createdPo = po;

      for (const it of items) {
        const matched = insertedItems.find(x => x.material_id === it.material_id);
        const p = it.unit_price !== undefined && it.unit_price !== '' ? parseFloat(it.unit_price) : (matched?.unit_price || 0);
        const q = parseFloat(it.required_qty || 0);
        const gstPct = parseFloat(it.gst_pct ?? 18);
        const lineTot = (p * q) * (1 + gstPct / 100);
        const lineUom = matched?.uom || it.uom || 'NOS';

        await client.query(
          `INSERT INTO po_items (po_id, material_id, qty, received_qty, uom, unit_price, gst_pct, total)
           VALUES ($1, $2, $3, 0, $4, $5, $6, $7)`,
          [po.id, it.material_id, q, lineUom, p, gstPct, lineTot]
        );
      }

      await client.query(
        `INSERT INTO indent_audit_log (indent_id, action, old_status, new_status, user_id, remarks)
         VALUES ($1, 'create_po', 'Submitted', 'PO Created', $2, $3)`,
        [id, req.user.id, `Direct Purchase Order ${poNum} created with Vendor ID ${vendor_id}`]
      );

      await logStoreIndent(client, id, 'Direct PO Generated', 'Draft', 'PO Created', req.user.id, req.user.name, req.user.role, `Direct Purchase Order ${poNum} created`);
    }

    // ── Fulfillment Branch 2: DIRECT DELIVERY CHALLAN (DC / GATE PASS) ──
    else if (fulfillment_mode === 'dc') {
      const d = new Date();
      const stamp = `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;
      await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [`gp-${stamp}`]);
      const seq = await client.query('SELECT COUNT(*)+1 AS n FROM gate_passes WHERE date::date = CURRENT_DATE');
      const gpNum = `GP-${stamp}-${String(seq.rows[0].n).padStart(4,'0')}`;

      const matDesc = items.map(it => {
        const mat = insertedItems.find(x => x.material_id === it.material_id);
        return `${it.required_qty} ${mat?.uom || it.uom || 'NOS'} of ${it.material_id}`;
      }).join(', ');

      const { rows: [gp] } = await client.query(`
        INSERT INTO gate_passes (gp_number, pass_type, vehicle_type, vehicle_number, driver_name, purpose,
          material_description, from_party, to_party, security_guard_id, remarks, vendor_id, status, expected_return_date)
        VALUES ($1, $2, $3, $4, $5, $6, $7, 'SRI M.K. PAPER MILLS', $8, $9, $10, $11, 'Open', $12) RETURNING *
      `, [gpNum, dc_type || 'MATERIAL_OUT', vehicle_type || 'Truck', vehicle_number || null, driver_name || null,
          dc_purpose || remarks || 'Indent Delivery Challan / Material Dispatch',
          matDesc, to_party || 'Outward Consignee', req.user.id, `Delivery Challan generated from Indent ${num}`, consignee_vendor_id || null,
          dc_type === 'RETURNABLE' ? (expected_return_date || null) : null]);
      createdGp = gp;

      await client.query(
        `INSERT INTO indent_audit_log (indent_id, action, old_status, new_status, user_id, remarks)
         VALUES ($1, 'create_dc', 'Submitted', 'DC Generated', $2, $3)`,
        [id, req.user.id, `Outward Delivery Challan / Gate Pass ${gpNum} generated`]
      );

      await logStoreIndent(client, id, 'Delivery Challan Generated', 'Draft', 'DC Generated', req.user.id, req.user.name, req.user.role, `Outward Gate Pass ${gpNum} generated`);
    }

    // ── Fulfillment Branch 3: IMMEDIATE STORE ISSUANCE (SIV) ──
    else if (fulfillment_mode === 'issue') {
      for (const it of insertedItems) {
        const qty = parseFloat(it.required_qty || 0);
        // Lock the material row and re-check stock at issue time (not the pre-transaction
        // snapshot captured when the item was inserted) — prevents two concurrent SIV submissions
        // from both passing a stale availability check and driving current_stock negative.
        const { rows: [matLocked] } = await client.query(`SELECT current_stock FROM materials WHERE id = $1 FOR UPDATE`, [it.material_id]);
        const avail = parseFloat(matLocked?.current_stock || 0);
        if (avail < qty) {
          throw new Error(`Insufficient stock for material ID ${it.material_id} (Available: ${avail}, Requested: ${qty})`);
        }

        await client.query(`UPDATE materials SET current_stock = current_stock - $1 WHERE id = $2`, [qty, it.material_id]);

        const { rows: [matAfter] } = await client.query(`SELECT current_stock, unit_price FROM materials WHERE id = $1`, [it.material_id]);
        const price = (it.unit_price !== undefined && it.unit_price !== '' && it.unit_price !== null)
          ? parseFloat(it.unit_price)
          : parseFloat(matAfter?.unit_price || 0);

        await client.query(
          `INSERT INTO stock_ledger (material_id, transaction_type, out_qty, balance, unit_price, value, date, reference_type, reference_id, remarks, created_by)
           VALUES ($1, 'issue', $2, $3, $4, $5, CURRENT_DATE, 'indent', $6, $7, $8)`,
          [it.material_id, qty, matAfter.current_stock, price, qty * price, id, `Immediate Issuance from Indent ${num}`, req.user.id]
        );

        await client.query(
          `UPDATE indent_items SET issued_qty = $1, unit_price = $2, line_value = $3, ack_status = 'pending' WHERE id = $4`,
          [qty, price, qty * price, it.id]
        );
      }

      await client.query(
        `UPDATE indents SET status = 'Issued', issued_by = $1, issued_at = NOW() WHERE id = $2`,
        [req.user.id, id]
      );

      await client.query(
        `INSERT INTO indent_audit_log (indent_id, action, old_status, new_status, user_id, remarks)
         VALUES ($1, 'issue', 'Submitted', 'Issued', $2, $3)`,
        [id, req.user.id, `Immediate store issuance executed on indent creation`]
      );

      await logStoreIndent(client, id, 'Immediate Store Issuance', 'Draft', 'Issued', req.user.id, req.user.name, req.user.role, 'Immediate store issuance executed on creation');
    }

    // ── Fulfillment Branch 4: DIRECT CASH PURCHASE (SPOT PROCUREMENT) ──
    else if (fulfillment_mode === 'cash') {
      const d = new Date();
      const stamp = d.toISOString().slice(0, 10).replace(/-/g, '');
      await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [`cp-${stamp}`]);
      const seqRes = await client.query(`SELECT LPAD((COUNT(*)+1)::text,4,'0') as seq FROM cash_purchases WHERE voucher_number LIKE $1`, [`CP-${stamp}-%`]);
      const cpNum = `CP-${stamp}-${seqRes.rows[0].seq}`;

      let cpTaxable = 0, cpTax = 0;
      for (const it of items) {
        const p = parseFloat(it.unit_price || 0);
        const q = parseFloat(it.required_qty || 0);
        const lineBase = p * q;
        const gstPct = parseFloat(it.gst_pct ?? 18);
        cpTaxable += lineBase;
        cpTax += lineBase * (gstPct / 100);
      }
      const cpGrandTotal = cpTaxable + cpTax;

      const { rows: [cp] } = await client.query(
        `INSERT INTO cash_purchases (
           voucher_number, date, indent_id, vendor_name, vendor_gstin, invoice_number,
           invoice_date, payment_mode, payment_ref, taxable_amount, cgst_amount, sgst_amount,
           igst_amount, total_tax, total_amount, remarks, created_by
         ) VALUES ($1, CURRENT_DATE, $2, $3, $4, $5, CURRENT_DATE, $6, $7, $8, $9, $9, 0, $10, $11, $12, $13)
         RETURNING *`,
        [
          cpNum, id, req.body.vendor_name || 'Cash Supplier / Local Vendor', req.body.vendor_gstin || null,
          req.body.invoice_number || cpNum, req.body.payment_mode || 'Cash', req.body.payment_ref || null,
          cpTaxable, cpTax / 2, cpTax, cpGrandTotal, remarks || `Direct Cash Purchase for Indent ${num}`, req.user.id
        ]
      );
      createdCp = cp;

      for (const it of items) {
        const p = parseFloat(it.unit_price || 0);
        const q = parseFloat(it.required_qty || 0);
        const gstPct = parseFloat(it.gst_pct ?? 18);
        const lineTaxable = p * q;
        const lineTot = lineTaxable * (1 + gstPct / 100);

        const matched = insertedItems.find(x => x.material_id === it.material_id);
        const itemUom = matched?.uom || it.uom || 'NOS';
        await client.query(
          `INSERT INTO cash_purchase_items (cash_purchase_id, material_id, qty, uom, unit_price, gst_pct, line_taxable, line_total)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [cp.id, it.material_id, q, itemUom, p, gstPct, lineTaxable, lineTot]
        );

        // Atomically increment stock
        const { rows: [mat] } = await client.query(`SELECT current_stock FROM materials WHERE id = $1 FOR UPDATE`, [it.material_id]);
        const curStock = parseFloat(mat?.current_stock || 0);
        const newStock = curStock + q;
        await client.query(`UPDATE materials SET current_stock = $1, unit_price = CASE WHEN $2::numeric > 0 THEN $2::numeric ELSE unit_price END WHERE id = $3`, [newStock, p, it.material_id]);

        // Record in stock_ledger
        await client.query(
          `INSERT INTO stock_ledger (material_id, date, transaction_type, reference_type, reference_id, in_qty, out_qty, balance, unit_price, value, remarks, created_by)
           VALUES ($1, CURRENT_DATE, 'cash_purchase', 'cash_purchase', $2, $3, 0, $4, $5, $6, $7, $8)`,
          [it.material_id, cp.id, q, newStock, p, lineTaxable, `Cash Purchase ${cpNum} for Indent ${num}`, req.user.id]
        );
      }

      await client.query(`UPDATE indents SET status = 'Cash Purchased' WHERE id = $1`, [id]);
      await client.query(
        `INSERT INTO indent_audit_log (indent_id, action, old_status, new_status, user_id, remarks)
         VALUES ($1, 'cash_purchase', 'Submitted', 'Cash Purchased', $2, $3)`,
        [id, req.user.id, `Direct Cash Purchase ${cpNum} generated and stock incremented`]
      );

      await logStoreIndent(client, id, 'Cash Purchased', 'Draft', 'Cash Purchased', req.user.id, req.user.name, req.user.role, `Direct Cash Purchase ${cpNum} generated`);

      // Auto-record paid vendor bill for Finance synchronization (mirrors /convert-to-cash-purchase)
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
           ) VALUES ($1, NULL, NULL, NULL, $2, CURRENT_DATE, CURRENT_DATE, $3, $4, $5, 0, $6, 0, $7, $7, 0, 'Paid', $8, $9)`,
          [
            billNum, req.body.invoice_number || cpNum, cpTaxable, cpTax / 2, cpTax / 2,
            cpTax, cpGrandTotal, `Cash Purchase ${cpNum} for Indent ${num}`, req.user.id
          ]
        );
      } catch(err) { /* non-blocking */ }
    }

    // ── Fulfillment Branch 5: STANDARD PR / INDENT WORKFLOW ──
    else {
      await logStoreIndent(client, id, 'Submitted', 'Draft', 'Submitted', req.user.id, req.user.name, req.user.role, 'Indent submitted for multi-tier approval');
    }

    await client.query('COMMIT');

    publish('mkpm.indent.events', String(id), {
      event: 'indent.created',
      id: id,
      indentNumber: num,
      status: initialStatus,
      fulfillmentMode: fulfillment_mode,
      userId: req.user.id,
      timestamp: new Date()
    });

    res.json({
      success: true,
      data: rows[0],
      po: createdPo,
      gatePass: createdGp,
      cashPurchase: createdCp,
      fulfillmentMode: fulfillment_mode,
      message: fulfillment_mode === 'po'
        ? `Indent ${num} created & Purchase Order ${createdPo?.po_number} generated successfully!`
        : (fulfillment_mode === 'dc'
            ? `Indent ${num} created & Delivery Challan ${createdGp?.gp_number} generated!`
            : (fulfillment_mode === 'issue'
                ? `Indent ${num} created & immediate stock issuance recorded!`
                : (fulfillment_mode === 'cash'
                    ? `Indent ${num} created & Cash Purchase Voucher ${createdCp?.voucher_number} generated!`
                    : `Indent ${num} submitted for approval workflow!`)))
    });
  } catch(e) { await client.query('ROLLBACK'); throw e; }
  finally { client.release(); }
}));


// EDIT / UPDATE INDENT (Supports Draft, Submitted, L1 Approved before issuance)
router.put('/:id', auth, ar(async (req, res) => {
  const { department_id, required_date, priority, remarks, section, machine_id, items } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: [ind] } = await client.query(`SELECT * FROM indents WHERE id=$1 FOR UPDATE`, [req.params.id]);
    if (!ind) { await client.query('ROLLBACK'); return res.status(404).json({ success:false, message:'Indent not found' }); }
    if (['Issued', 'Closed', 'Rejected', 'Cancelled'].includes(ind.status)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success:false, message:'Cannot edit an already issued, closed, rejected or cancelled indent' });
    }

    const isStore = req.user.dept_code === 'STORE' || ['Store Management', 'Store'].includes(req.user.department);
    if (ind.raised_by !== req.user.id && !isStore && (req.user.role_level || 1) < 4) {
      await client.query('ROLLBACK');
      return res.status(403).json({ success:false, message:'Permission denied to edit this indent' });
    }

    let secId = ind.section_id;
    if (section !== undefined) {
      if (!section) secId = null;
      else if (!isNaN(parseInt(section))) {
        const { rows: pRows } = await client.query('SELECT id FROM plant_sections WHERE id = $1', [parseInt(section)]);
        if (pRows.length) secId = pRows[0].id;
      } else {
        const { rows: pRows } = await client.query('SELECT id FROM plant_sections WHERE section_code ILIKE $1 OR name ILIKE $1 LIMIT 1', [String(section).trim()]);
        if (pRows.length) secId = pRows[0].id;
      }
    }
    let machId = ind.machine_id;
    if (machine_id !== undefined) {
      machId = machine_id && !isNaN(parseInt(machine_id)) ? parseInt(machine_id) : null;
    }

    let totalVal = 0;
    const { rows } = await client.query(
      `UPDATE indents SET
         department_id=COALESCE($1,department_id),
         required_date=COALESCE($2,required_date),
         priority=COALESCE($3,priority),
         remarks=COALESCE($4,remarks),
         section_id=$5,
         machine_id=$6
       WHERE id=$7 RETURNING *`,
      [department_id||null, required_date||null, priority||'Normal', remarks, secId, machId, req.params.id]
    );

    if (Array.isArray(items) && items.length) {
      await client.query(`DELETE FROM indent_items WHERE indent_id=$1`, [req.params.id]);
      for (const it of items) {
        const { rows: mat } = await client.query(`SELECT current_stock, unit_price, uom FROM materials WHERE id=$1`, [it.material_id]);
        const price = (it.unit_price !== undefined && it.unit_price !== '' && it.unit_price !== null)
          ? parseFloat(it.unit_price)
          : parseFloat(mat[0]?.unit_price || 0);
        const qty = parseFloat(it.required_qty || 0);
        const lVal = qty * price;
        totalVal += lVal;

        const itemUom = mat[0]?.uom || it.uom || 'NOS';
        await client.query(
          `INSERT INTO indent_items (indent_id,material_id,required_qty,uom,purpose,current_stock,component_position,reason_code,unit_price,line_value,maintenance_log_id)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
          [req.params.id, it.material_id, qty, itemUom, it.purpose||'', mat[0]?.current_stock||0, it.component_position||null, it.reason_code||'Routine Replacement', price, lVal, it.maintenance_log_id ? parseInt(it.maintenance_log_id) : null]
        );
      }
      await client.query(`UPDATE indents SET total_value = $1 WHERE id = $2`, [totalVal, req.params.id]);
    }

    await logStoreIndent(client, req.params.id, 'Edited', ind.status, ind.status, req.user.id, req.user.name, req.user.role, 'Indent line items and details updated');

    await client.query('COMMIT');
    res.json({ success:true, data:rows[0] });
  } catch(e) { await client.query('ROLLBACK'); throw e; }
  finally { client.release(); }
}));

// APPEND ITEM TO EXISTING INDENT
router.post('/:id/items', auth, ar(async (req, res) => {
  const { material_id, required_qty, uom, purpose, component_position, reason_code, unit_price: reqUnitPrice, maintenance_log_id } = req.body;
  if (!material_id || !required_qty || Number(required_qty) <= 0) {
    return res.status(400).json({ success: false, message: 'Material and valid required_qty are required' });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: [ind] } = await client.query('SELECT * FROM indents WHERE id=$1 FOR UPDATE', [req.params.id]);
    if (!ind) { await client.query('ROLLBACK'); return res.status(404).json({ success: false, message: 'Indent not found' }); }
    if (['Issued', 'Closed', 'Rejected', 'Cancelled'].includes(ind.status)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'Cannot append items to an already issued, closed, rejected or cancelled indent' });
    }

    const { rows: mat } = await client.query('SELECT current_stock, unit_price, uom FROM materials WHERE id=$1', [material_id]);
    const price = (reqUnitPrice !== undefined && reqUnitPrice !== '' && reqUnitPrice !== null)
      ? parseFloat(reqUnitPrice)
      : parseFloat(mat[0]?.unit_price || 0);
    const qty = parseFloat(required_qty || 0);
    const finalUom = mat[0]?.uom || uom || 'NOS';
    const lVal = qty * price;

    const { rows: [inserted] } = await client.query(
      `INSERT INTO indent_items (indent_id, material_id, required_qty, uom, purpose, current_stock, component_position, reason_code, unit_price, line_value, maintenance_log_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
      [req.params.id, material_id, qty, finalUom, purpose||'', mat[0]?.current_stock||0, component_position||null, reason_code||'Routine Replacement', price, lVal, maintenance_log_id ? parseInt(maintenance_log_id) : null]
    );

    // Recompute total value
    await client.query(
      `UPDATE indents SET total_value = (SELECT COALESCE(SUM(line_value), 0) FROM indent_items WHERE indent_id=$1) WHERE id=$1`,
      [req.params.id]
    );

    await client.query('COMMIT');
    res.json({ success: true, data: inserted });
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}));

// DELETE ITEM FROM INDENT
router.delete('/:id/items/:itemId', auth, ar(async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: [ind] } = await client.query('SELECT * FROM indents WHERE id=$1 FOR UPDATE', [req.params.id]);
    if (!ind) { await client.query('ROLLBACK'); return res.status(404).json({ success: false, message: 'Indent not found' }); }
    if (['Issued', 'Closed', 'Rejected', 'Cancelled'].includes(ind.status)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'Cannot remove items from an issued, closed, rejected or cancelled indent' });
    }

    await client.query('DELETE FROM indent_items WHERE id=$1 AND indent_id=$2', [req.params.itemId, req.params.id]);
    await client.query(
      `UPDATE indents SET total_value = (SELECT COALESCE(SUM(line_value), 0) FROM indent_items WHERE indent_id=$1) WHERE id=$1`,
      [req.params.id]
    );
    await client.query('COMMIT');
    res.json({ success: true, message: 'Item deleted successfully' });
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}));

// SUBMIT
router.put('/:id/submit', auth, ar(async (req, res) => {
  const { rows } = await pool.query(
    `UPDATE indents SET status='Submitted' WHERE id=$1 AND status='Draft' AND raised_by=$2 RETURNING *`,
    [req.params.id, req.user.id]
  );
  if (rows.length) {
    await logStoreIndent(pool, rows[0].id, 'Submitted', 'Draft', 'Submitted', req.user.id, req.user.name, req.user.role);
    publish('mkpm.indent.events', String(req.params.id), {
      event: 'indent.submitted',
      id: rows[0].id,
      indentNumber: rows[0].indent_number,
      status: 'Submitted',
      userId: req.user.id,
      timestamp: new Date()
    });
  }
  res.json({ success:!!rows.length, data:rows[0] });
}));

// ─── P4: Tier helper ─────────────────────────────────────────────────────────
// Returns { tier:1|2|3, totalValue, emergency, requiredLevel }
// Tier 1 (<₹10k OR urgent+2h): L1 only → auto-Approved after L1
// Tier 2 (₹10k–₹1L)         : L1 + dept-head L2 → auto-Approved after L2
// Tier 3 (>₹1L)              : L1 + L2 + plant-head L3 → Approved after L3
async function getIndentTier(client, indentId) {
  const { rows: val } = await client.query(
    `SELECT COALESCE(SUM(ii.required_qty * COALESCE(m.unit_price, 0)), 0) AS total_value
     FROM indent_items ii
     LEFT JOIN materials m ON m.id = ii.material_id
     WHERE ii.indent_id = $1`,
    [indentId]
  );
  const totalValue = Number(val[0].total_value);

  const { rows: ind } = await client.query(
    `SELECT priority, created_at FROM indents WHERE id = $1`, [indentId]
  );
  if (!ind.length) return { tier: 3, totalValue, emergency: false, requiredLevel: 4 };
  const ageHours = (Date.now() - new Date(ind[0].created_at)) / 3600000;
  const emergency = ind[0].priority === 'Urgent' && ageHours > 2;
  if (emergency) return { tier: 1, totalValue, emergency: true, requiredLevel: 2 };

  const { rows: matrix } = await client.query(
    `SELECT tier, required_level FROM approval_matrix
     WHERE min_value <= $1 AND (max_value IS NULL OR max_value > $1)
     ORDER BY tier ASC LIMIT 1`,
    [totalValue]
  );
  const row = matrix[0] || { tier: 3, required_level: 4 };
  return { tier: row.tier, totalValue, emergency: false, requiredLevel: row.required_level };
}

// TIER INFO — GET /api/indent/:id/tier
router.get('/:id/tier', auth, ar(async (req, res) => {
  const client = await pool.connect();
  try {
    const info = await getIndentTier(client, req.params.id);
    const { rows: matrix } = await client.query('SELECT * FROM approval_matrix ORDER BY tier');
    res.json({ success: true, data: info, matrix });
  } finally { client.release(); }
}));

// APPROVE L1 — Store Head (dept code STORE, level 3) OR Admin/PlantHead (level 4+)
// Submitted → L1 Approved
router.put('/:id/approve/l1', auth, requireLevel(3), ar(async (req, res) => {
  // Must be Store dept OR level 4+
  if (req.user.role_level < 4 && req.user.dept_code !== 'STORE') {
    return res.status(403).json({ success: false, message: 'L1 approval: Store Head only' });
  }
  const { rows: [ind] } = await pool.query(`SELECT raised_by FROM indents WHERE id=$1`, [req.params.id]);
  if (ind && ind.raised_by === req.user.id && req.user.role_level < 4) {
    return res.status(403).json({ success: false, message: 'Cannot approve own indent — needs different approver (or level4+ override)' });
  }
  let { rows } = await pool.query(
    `UPDATE indents SET status='L1 Approved', l1_approved_by=$1, l1_approved_at=NOW()
     WHERE id=$2 AND status='Submitted' RETURNING *`,
    [req.user.id, req.params.id]
  );
  if (rows.length) {
    await logStoreIndent(pool, rows[0].id, 'L1 Approved', 'Submitted', 'L1 Approved', req.user.id, req.user.name, req.user.role);
    publish('mkpm.indent.events', String(req.params.id), {
      event: 'indent.approved_l1',
      id: rows[0].id,
      indentNumber: rows[0].indent_number,
      status: 'L1 Approved',
      userId: req.user.id,
      timestamp: new Date()
    });

    // Tier 1 (small-value) indents are L1-only per approval_matrix (required_level<=3, i.e. no
    // dept-head/plant-head sign-off needed) — auto-advance to Approved so they're issuable
    // immediately, matching the design comment above getIndentTier(). Without this, a Tier 1
    // indent gets stuck at 'L1 Approved' forever since /issue only accepts Submitted/Approved.
    const client = await pool.connect();
    try {
      const tier = await getIndentTier(client, req.params.id);
      if (tier.tier === 1) {
        const { rows: approvedRows } = await client.query(
          `UPDATE indents SET status='Approved', l2_approved_by=$1, l2_approved_at=NOW()
           WHERE id=$2 AND status='L1 Approved' RETURNING *`,
          [req.user.id, req.params.id]
        );
        if (approvedRows.length) {
          rows = approvedRows;
          await logStoreIndent(client, rows[0].id, 'Approved', 'L1 Approved', 'Approved', req.user.id, req.user.name, req.user.role, 'Auto-approved: Tier 1 (L1-only)');
          publish('mkpm.indent.events', String(req.params.id), {
            event: 'indent.approved',
            id: rows[0].id,
            indentNumber: rows[0].indent_number,
            status: 'Approved',
            userId: req.user.id,
            timestamp: new Date()
          });
        }
      }
    } finally { client.release(); }
  }
  res.json({ success: !!rows.length, data: rows[0], message: rows.length ? undefined : 'Indent must be Submitted' });
}));

// APPROVE L2 — Store Manager (level 3+) or Admin/PlantHead (level 4+)
// L1 Approved → Approved (ready to issue). GAP-2 FIX: was requireLevel(4), now requireLevel(3).
router.put('/:id/approve/l2', auth, requireLevel(3), ar(async (req, res) => {
  const client0 = await pool.connect();
  let tier;
  try { tier = await getIndentTier(client0, req.params.id); } finally { client0.release(); }
  if (req.user.role_level < tier.requiredLevel) {
    return res.status(403).json({ success: false, message: `Indent value ₹${tier.totalValue} needs level ${tier.requiredLevel}+ approver (Tier ${tier.tier})` });
  }
  const { rows: [ind] } = await pool.query(`SELECT raised_by, l1_approved_by FROM indents WHERE id=$1`, [req.params.id]);
  if (ind && (ind.raised_by === req.user.id || ind.l1_approved_by === req.user.id) && req.user.role_level < 5) {
    return res.status(403).json({ success: false, message: 'Cannot L2-approve own indent or your own L1 approval — needs different approver (or admin override)' });
  }
  const { rows } = await pool.query(
    `UPDATE indents SET status='Approved', l2_approved_by=$1, l2_approved_at=NOW()
     WHERE id=$2 AND status='L1 Approved' RETURNING *`,
    [req.user.id, req.params.id]
  );
  if (rows.length) {
    await logStoreIndent(pool, rows[0].id, 'Approved', 'L1 Approved', 'Approved', req.user.id, req.user.name, req.user.role);
    publish('mkpm.indent.events', String(req.params.id), {
      event: 'indent.approved',
      id: rows[0].id,
      indentNumber: rows[0].indent_number,
      status: 'Approved',
      userId: req.user.id,
      timestamp: new Date()
    });
  }
  res.json({ success: !!rows.length, data: rows[0], message: rows.length ? undefined : 'Indent must be L1 Approved' });
}));

// APPROVE DIRECT — general approval route for indents (supports L1/L2/Admin direct approval)
router.put('/:id/approve', auth, requireLevel(2), ar(async (req, res) => {
  const { rows: [ind] } = await pool.query(
    `SELECT id, indent_number, status, raised_by, department_id FROM indents WHERE id=$1`,
    [req.params.id]
  );
  if (!ind) return res.status(404).json({ success: false, message: 'Indent not found' });
  if (ind.status === 'Approved') return res.json({ success: true, message: 'Indent is already Approved', data: ind });

  const userRole = (req.user.role || '').toLowerCase();
  const isAdmin = userRole.includes('admin') || userRole.includes('director') || userRole.includes('md') || (req.user.role_level || 1) >= 4;

  if (!isAdmin && ind.raised_by === req.user.id && (req.user.role_level || 1) < 4) {
    return res.status(403).json({ success: false, message: 'Cannot approve own indent — approver must be different from requester' });
  }

  const { rows } = await pool.query(
    `UPDATE indents SET 
       status = 'Approved',
       l1_approved_by = COALESCE(l1_approved_by, $1),
       l1_approved_at = COALESCE(l1_approved_at, NOW()),
       l2_approved_by = $1,
       l2_approved_at = NOW()
     WHERE id = $2 RETURNING *`,
    [req.user.id, req.params.id]
  );

  if (rows.length) {
    await logStoreIndent(pool, rows[0].id, 'Approved', ind.status, 'Approved', req.user.id, req.user.name, req.user.role, 'Indent approved');
    await pool.query(
      `INSERT INTO indent_audit_log (indent_id, action, old_status, new_status, user_id, remarks)
       VALUES ($1, 'approve', $2, 'Approved', $3, 'Indent approved')`,
      [rows[0].id, ind.status, req.user.id]
    ).catch(() => {});

    publish('mkpm.indent.events', String(req.params.id), {
      event: 'indent.approved',
      id: rows[0].id,
      indentNumber: rows[0].indent_number,
      status: 'Approved',
      userId: req.user.id,
      timestamp: new Date()
    });
  }

  res.json({ success: !!rows.length, data: rows[0], message: `Indent ${rows[0]?.indent_number} approved successfully` });
}));

// APPROVE L3 — kept for compatibility (no-op redirect to L2)
router.put('/:id/approve/l3', auth, requireLevel(4), ar(async (req, res) => {
  const { rows } = await pool.query(
    `UPDATE indents SET status='Approved', l2_approved_by=$1, l2_approved_at=NOW()
     WHERE id=$2 AND status IN ('L1 Approved','L2 Approved') RETURNING *`,
    [req.user.id, req.params.id]
  );
  if (rows.length) {
    publish('mkpm.indent.events', String(req.params.id), {
      event: 'indent.approved',
      id: rows[0].id,
      indentNumber: rows[0].indent_number,
      status: 'Approved',
      userId: req.user.id,
      timestamp: new Date()
    });
  }
  res.json({ success: !!rows.length, data: rows[0] });
}));

// REJECT — approver (level 2+) in the SAME department as the indent, or level4+ org-wide
router.put('/:id/reject', auth, requireLevel(2), ar(async (req, res) => {
  const { rows: [ind] } = await pool.query(`SELECT status, department_id FROM indents WHERE id=$1`, [req.params.id]);
  if (ind && req.user.role_level < 4 && ind.department_id !== req.user.department_id) {
    return res.status(403).json({ success: false, message: 'Can only reject indents from your own department (or level4+ override)' });
  }
  const { rows } = await pool.query(
    `UPDATE indents SET status='Rejected', remarks=COALESCE($1,remarks)
     WHERE id=$2 AND status IN ('Submitted','L1 Approved','L2 Approved') RETURNING *`,
    [req.body.remarks||null, req.params.id]
  );
  if (rows.length) {
    await logStoreIndent(pool, rows[0].id, 'Rejected', ind ? ind.status : null, 'Rejected', req.user.id, req.user.name, req.user.role, req.body.remarks || null);
    publish('mkpm.indent.events', String(req.params.id), {
      event: 'indent.rejected',
      id: rows[0].id,
      indentNumber: rows[0].indent_number,
      status: 'Rejected',
      userId: req.user.id,
      timestamp: new Date()
    });
  }
  res.json({ success:!!rows.length, data:rows[0] });
}));

// ISSUE — Store officer issues physical stock (requireStore guard enforced, supports both POST and PUT)
const issueHandler = ar(async (req, res) => {
  const { items = [], remarks } = req.body; // items: [{id, material_id, issued_qty, batch_no}]
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: [ind] } = await client.query(
      `SELECT * FROM indents WHERE id=$1 FOR UPDATE`, [req.params.id]
    );
    if (!ind) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Indent not found' });
    }

    // Sequence Guard 1: Must not be in Submitted state without SM approval
    if (ind.status === 'Submitted') {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        sequence_violation: true,
        violationType: 'sm_approval_required',
        currentStep: 1,
        requiredStep: 2,
        indentNumber: ind.indent_number,
        deptName: ind.department_id,
        message: 'Store Manager (SM) approval gate is required before Store Keeper can physically issue stock.'
      });
    }

    if (!['L1 Approved', 'L2 Approved', 'Approved', 'Partially Issued'].includes(ind.status)) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        sequence_violation: true,
        violationType: 'custom',
        currentStep: 1,
        requiredStep: 2,
        indentNumber: ind.indent_number,
        message: `Indent is in '${ind.status}' state and cannot be issued.`
      });
    }

    for (const it of items) {
      let item = null;
      if (it.id) {
        const { rows: [r] } = await client.query(`SELECT * FROM indent_items WHERE id=$1 AND indent_id=$2`, [it.id, req.params.id]);
        item = r;
      } else if (it.item_id) {
        const { rows: [r] } = await client.query(`SELECT * FROM indent_items WHERE id=$1 AND indent_id=$2`, [it.item_id, req.params.id]);
        item = r;
      } else if (it.material_id) {
        const { rows: [r] } = await client.query(`SELECT * FROM indent_items WHERE material_id=$1 AND indent_id=$2 LIMIT 1`, [it.material_id, req.params.id]);
        item = r;
      }
      if (!item) continue;

      const { rows: [matBefore] } = await client.query(`SELECT current_stock FROM materials WHERE id=$1 FOR UPDATE`, [item.material_id]);
      const availQty = parseFloat(matBefore?.current_stock || 0);
      const issQty = Math.min(parseFloat(it.issued_qty || 0), parseFloat(item.required_qty), availQty);
      if (issQty <= 0) continue;

      // Deduct stock
      await client.query(`UPDATE materials SET current_stock=current_stock-$1 WHERE id=$2`, [issQty, item.material_id]);
      const { rows: [mat] } = await client.query(`SELECT current_stock,unit_price,is_serialized,expected_lifespan_days FROM materials WHERE id=$1`, [item.material_id]);

      // stock_ledger — reference_id MUST be the indent id: reports.js's department-consumption
      // and material-ledger queries join `indents ind ON sl.reference_type='indent' AND
      // sl.reference_id=ind.id` to resolve the issuing department. Without it those joins can
      // never match (found live: 9 of 10 'indent'/'issue' ledger rows had reference_id NULL),
      // silently collapsing every department's consumption into "General Mill Operations".
      await client.query(`INSERT INTO stock_ledger(material_id,transaction_type,out_qty,balance,unit_price,value,date,reference_type,reference_id,remarks,created_by)
        VALUES($1,'issue',$2,$3,$4,$5,CURRENT_DATE,'indent',$6,$7,$8)`,
        [item.material_id, issQty, mat.current_stock, mat.unit_price, issQty * parseFloat(mat.unit_price || 0),
         ind.id, `Indent ${ind.indent_number}`, req.user.id]);

      await client.query(`UPDATE indent_items SET issued_qty=$1,batch_no=$2,unit_price=$3,line_value=$4,ack_status='pending' WHERE id=$5`,
        [issQty, it.batch_no || null, mat.unit_price, issQty * parseFloat(mat.unit_price || 0), item.id]);

      // Digital Twin: Auto-create Installed Assets row if material is serialized or batch is provided
      if (mat.is_serialized || it.batch_no || it.serial_no) {
        const today = new Date();
        const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
        const { rows: assetSeq } = await client.query(
          `SELECT LPAD((COUNT(*) + 1)::text, 4, '0') AS seq FROM installed_assets`
        );
        const assetNumber = `AST-${dateStr}-${assetSeq[0].seq}`;
        await client.query(
          `INSERT INTO installed_assets (
            asset_number, material_id, serial_number, batch_number, machine_id,
            indent_id, requested_by, approved_by, issued_by, purchase_price, installed_at, status, expected_lifespan_days
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW(),'active',$11)`,
          [
            assetNumber, item.material_id, it.serial_no || it.batch_no || `SN-${Date.now()}`, it.batch_no || null,
            ind.machine_id || null, ind.id, ind.raised_by || req.user.id, ind.l1_approved_by || req.user.id,
            req.user.id, parseFloat(mat.unit_price || 0), mat.expected_lifespan_days || 365
          ]
        );
      }
    }

    // Check if all items in indent are fully issued
    const { rows: allItems } = await client.query(
      `SELECT required_qty, issued_qty FROM indent_items WHERE indent_id=$1`, [req.params.id]
    );
    const isFullyIssued = allItems.length > 0 && allItems.every(it => parseFloat(it.issued_qty || 0) >= parseFloat(it.required_qty || 0));
    const finalStatus = isFullyIssued ? 'Issued' : 'Partially Issued';

    const { rows: [totRow] } = await client.query(
      `SELECT SUM(line_value) AS tv FROM indent_items WHERE indent_id=$1`, [req.params.id]);
    await client.query(
      `UPDATE indents SET status=$1,issued_by=$2,issued_at=NOW(),total_value=$3,remarks=COALESCE($4,remarks) WHERE id=$5`,
      [finalStatus, req.user.id, totRow.tv || 0, remarks || null, req.params.id]);

    await logStoreIndent(client, req.params.id, finalStatus, ind.status, finalStatus, req.user.id, req.user.name, req.user.role, remarks || null);

    await client.query(`INSERT INTO indent_audit_log(indent_id,action,old_status,new_status,user_id,remarks)
      VALUES($1,'issue',$2,$3,$4,$5)`, [req.params.id, ind.status, finalStatus, req.user.id, remarks || null]);
    await client.query('COMMIT');

    publish('mkpm.indent.events', String(req.params.id), {
      event: isFullyIssued ? 'indent.issued' : 'indent.partially_issued',
      id: req.params.id,
      indentNumber: ind.indent_number,
      status: finalStatus,
      userId: req.user.id,
      timestamp: new Date()
    });

    res.json({ success: true, status: finalStatus });
  } catch (e) { await client.query('ROLLBACK'); throw e; }
  finally { client.release(); }
});

router.post('/:id/issue', auth, requireLevel(2), requireStore, issueHandler);
router.put('/:id/issue', auth, requireLevel(2), requireStore, issueHandler);

// ACKNOWLEDGE — HOD acknowledges fitment per item
router.put('/items/:itemId/acknowledge', auth, ar(async (req, res) => {
  const { fitment_date, observations, kpi_before, kpi_after, photo_url } = req.body;
  const client = await pool.connect();
  let item, chk;
  try {
    await client.query('BEGIN');

    ({ rows:[item] } = await client.query(
      `UPDATE indent_items SET ack_by=$1,ack_at=NOW(),fitment_date=$2,observations=$3,
         kpi_before=$4,kpi_after=$5,photo_url=$6,ack_status='done'
       WHERE id=$7 RETURNING *`,
      [req.user.id,fitment_date||null,observations||null,kpi_before||null,kpi_after||null,photo_url||null,req.params.itemId]
    ));
    if (!item) {
      await client.query('ROLLBACK');
      return res.json({ success:false, message:'Item not found' });
    }

    // Check if all items acked → auto-close indent
    ({ rows:[chk] } = await client.query(
      `SELECT COUNT(*) FILTER(WHERE ack_status='pending') AS pending FROM
         (SELECT ack_status FROM indent_items WHERE indent_id=$1 FOR UPDATE) sub`,[item.indent_id]));
    if (parseInt(chk.pending)===0) {
      await client.query(`UPDATE indents SET status='Closed',closed_at=NOW() WHERE id=$1 AND status IN ('Issued', 'Partially Issued')`,[item.indent_id]);
      await client.query(`INSERT INTO indent_audit_log(indent_id,action,old_status,new_status,user_id) VALUES($1,'close','Issued','Closed',$2)`,[item.indent_id,req.user.id]);
    }

    await client.query('COMMIT');
  } catch(e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }

  publish('mkpm.indent.events', String(item.indent_id), {
    event: parseInt(chk.pending) === 0 ? 'indent.closed' : 'indent.item_acknowledged',
    id: item.indent_id,
    itemId: item.id,
    status: parseInt(chk.pending) === 0 ? 'Closed' : 'Issued',
    userId: req.user.id,
    timestamp: new Date()
  });

  res.json({ success:true, data:item, autoClosed: parseInt(chk.pending)===0 });
}));

// RECEIVER SIGN & HANDOVER — Department receiver signs & acknowledges physical receipt of entire indent
const receiverSignHandler = ar(async (req, res) => {
  const { receiver_name, receiver_emp_code, receiver_signature_note, fitment_date, fitment_location, observations } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: [ind] } = await client.query(
      `SELECT * FROM indents WHERE id = $1 FOR UPDATE`,
      [req.params.id]
    );
    if (!ind) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Indent not found' });
    }

    if (['Draft', 'Submitted'].includes(ind.status)) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        sequence_violation: true,
        violationType: 'sm_approval_required',
        currentStep: 1,
        requiredStep: 2,
        indentNumber: ind.indent_number,
        message: 'Indent must be approved by Store Manager and physically issued by Store Keeper before Receiver sign-off.'
      });
    }

    if (ind.status === 'Approved') {
      const { rows: [issuedCheck] } = await client.query(
        `SELECT COALESCE(SUM(issued_qty), 0) as total_issued FROM indent_items WHERE indent_id = $1`,
        [ind.id]
      );
      if (parseFloat(issuedCheck?.total_issued || 0) <= 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          success: false,
          sequence_violation: true,
          violationType: 'stock_issue_required',
          currentStep: 2,
          requiredStep: 3,
          indentNumber: ind.indent_number,
          message: 'Materials must be physically issued by Store Keeper before Department Receiver can sign handover.'
        });
      }
    }

    if (!['Issued', 'Partially Issued', 'Approved'].includes(ind.status)) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        sequence_violation: true,
        violationType: 'custom',
        currentStep: 3,
        requiredStep: 4,
        indentNumber: ind.indent_number,
        message: `Indent is currently in '${ind.status}' state and cannot be signed.`
      });
    }

    const recName = receiver_name || req.user.name;
    const recEmpCode = receiver_emp_code || req.user.employee_code || null;
    const note = receiver_signature_note || observations || 'Received and verified in department';

    // Update master indent
    const { rows: [updatedInd] } = await client.query(
      `UPDATE indents
       SET receiver_name = $1,
           receiver_emp_code = $2,
           receiver_signature_note = $3,
           receiver_signed_at = NOW(),
           receiver_signed_by = $4,
           fitment_date = $5,
           fitment_location = $6,
           observations = $7,
           status = 'Closed',
           closed_at = NOW()
       WHERE id = $8 RETURNING *`,
      [recName, recEmpCode, note, req.user.id, fitment_date || null, fitment_location || null, observations || null, ind.id]
    );

    // Update all items under this indent
    await client.query(
      `UPDATE indent_items
       SET ack_by = $1,
           ack_at = NOW(),
           ack_status = 'done',
           receiver_name = $2,
           receiver_emp_code = $3,
           receiver_signed_at = NOW(),
           fitment_date = $4,
           observations = $5
       WHERE indent_id = $6`,
      [req.user.id, recName, recEmpCode, fitment_date || null, observations || null, ind.id]
    );

    await logStoreIndent(client, ind.id, 'Receiver Signed & Closed', ind.status, 'Closed', req.user.id, recName, req.user.role || 'Receiver', note);
    await client.query(
      `INSERT INTO indent_audit_log (indent_id, action, old_status, new_status, user_id, remarks)
       VALUES ($1, 'receiver_sign_close', $2, 'Closed', $3, $4)`,
      [ind.id, ind.status, req.user.id, `Receiver signed by ${recName} (${recEmpCode || 'Emp'}): ${note}`]
    );

    await client.query('COMMIT');

    publish('mkpm.indent.events', String(ind.id), {
      event: 'indent.closed',
      id: ind.id,
      indentNumber: ind.indent_number,
      status: 'Closed',
      receiverName: recName,
      userId: req.user.id,
      timestamp: new Date()
    });

    res.json({ success: true, message: `Indent ${ind.indent_number} signed by receiver & closed successfully`, data: updatedInd });
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
});

router.put('/:id/receive', auth, receiverSignHandler);
router.put('/:id/sign', auth, receiverSignHandler);

// CLOSE — manual close by admin
router.put('/:id/close', auth, requireLevel(3), ar(async (req, res) => {
  const { rows } = await pool.query(
    `UPDATE indents SET status='Closed',closed_at=NOW() WHERE id=$1 AND status IN ('Issued', 'Partially Issued') RETURNING *`,
    [req.params.id]
  );
  if (rows.length) {
    await logStoreIndent(pool, rows[0].id, 'Closed', rows[0].status, 'Closed', req.user.id, req.user.name, req.user.role);
    await pool.query(`INSERT INTO indent_audit_log(indent_id,action,old_status,new_status,user_id) VALUES($1,'close',$2,'Closed',$3)`,[req.params.id,rows[0].status,req.user.id]);
    publish('mkpm.indent.events', String(req.params.id), {
      event: 'indent.closed',
      id: rows[0].id,
      indentNumber: rows[0].indent_number,
      status: 'Closed',
      userId: req.user.id,
      timestamp: new Date()
    });
    res.json({ success: !!rows.length, data: rows[0] });
  } else {
    res.json({ success: false, message: 'Indent not found or not in eligible status' });
  }
}));

// CANCEL — Store manager / Admin / Creator cancels indent with structured reason
const cancelHandler = ar(async (req, res) => {
  const { reason, remarks } = req.body;
  if (!reason && !remarks) {
    return res.status(400).json({ success: false, message: 'Cancellation reason is required' });
  }
  const isStore = req.user.dept_code === 'STORE' || ['Store Management', 'Raw Material Store', 'Inventory', 'Store'].includes(req.user.department);
  const isElevated = (req.user.role_level || 1) >= 3;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: [ind] } = await client.query('SELECT * FROM indents WHERE id = $1 FOR UPDATE', [req.params.id]);
    if (!ind) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Indent not found' });
    }

    if (ind.status === 'Issued' || ind.status === 'Closed') {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'Cannot cancel an already issued or closed indent' });
    }

    if (!isStore && !isElevated && ind.raised_by !== req.user.id) {
      await client.query('ROLLBACK');
      return res.status(403).json({ success: false, message: 'Only Store Manager, Admin, or creator can cancel this indent' });
    }

    const fullReason = reason ? `${reason}${remarks ? ' — ' + remarks : ''}` : remarks;

    const { rows: [updated] } = await client.query(
      `UPDATE indents SET
         status = 'Cancelled',
         cancellation_reason = $1,
         cancelled_by = $2,
         cancelled_at = NOW()
       WHERE id = $3 RETURNING *`,
      [fullReason, req.user.id, req.params.id]
    );

    await client.query(
      `INSERT INTO indent_audit_log (indent_id, action, old_status, new_status, user_id, remarks)
       VALUES ($1, 'cancel', $2, 'Cancelled', $3, $4)`,
      [req.params.id, ind.status, req.user.id, fullReason]
    );

    await logStoreIndent(client, req.params.id, 'Cancelled', ind.status, 'Cancelled', req.user.id, req.user.name, req.user.role, fullReason);

    await client.query('COMMIT');

    publish('mkpm.indent.events', String(req.params.id), {
      event: 'indent.cancelled',
      id: req.params.id,
      indentNumber: ind.indent_number,
      status: 'Cancelled',
      reason: fullReason,
      userId: req.user.id,
      timestamp: new Date()
    });

    res.json({ success: true, message: `Indent ${ind.indent_number} marked as Cancelled`, data: updated });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

router.put('/:id/cancel', auth, cancelHandler);
router.post('/:id/cancel', auth, cancelHandler);

// DELETE /api/indent/:id — Full DML Force Delete / Purge Indent
router.delete('/:id', auth, ar(async (req, res) => {
  const isStore = req.user.dept_code === 'STORE' || ['Store Management', 'Raw Material Store', 'Inventory', 'Store'].includes(req.user.department);
  const isElevated = (req.user.role_level || 1) >= 4;
  const isStoreManager = (req.user.role_level || 1) >= 3 && isStore;
  const isForce = req.query.force === 'true' || req.body?.force === true || isElevated || isStoreManager;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: [ind] } = await client.query('SELECT * FROM indents WHERE id = $1 FOR UPDATE', [req.params.id]);
    if (!ind) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Indent not found' });
    }

    // Permission check: store manager, admin, or creator
    if (!isStore && !isElevated && ind.raised_by !== req.user.id) {
      await client.query('ROLLBACK');
      return res.status(403).json({ success: false, message: 'Only Store Manager, Admin, or creator can delete this indent' });
    }

    // If already Issued or Closed, regular users cannot delete without force/admin authorization
    if ((ind.status === 'Issued' || ind.status === 'Closed' || ind.status === 'Partially Issued') && !isForce) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'Cannot delete an issued/closed indent without forceful admin authorization' });
    }

    // If forceful deletion on issued/partially issued indent, restore material stock and write compensating ledger entry
    if (ind.status === 'Issued' || ind.status === 'Partially Issued' || ind.status === 'Closed') {
      const { rows: issuedItems } = await client.query(
        'SELECT id, material_id, issued_qty FROM indent_items WHERE indent_id = $1 AND issued_qty > 0',
        [req.params.id]
      );
      for (const item of issuedItems) {
        const qty = parseFloat(item.issued_qty || 0);
        if (qty > 0) {
          await client.query('UPDATE materials SET current_stock = current_stock + $1 WHERE id = $2', [qty, item.material_id]);
          const { rows: [mat] } = await client.query('SELECT current_stock, unit_price FROM materials WHERE id = $1', [item.material_id]);
          await client.query(
            `INSERT INTO stock_ledger (material_id, transaction_type, in_qty, balance, unit_price, value, date, reference_type, remarks, created_by)
             VALUES ($1, 'adjustment_plus', $2, $3, $4, $5, CURRENT_DATE, 'indent_reversal', $6, $7)`,
            [
              item.material_id,
              qty,
              mat?.current_stock || 0,
              mat?.unit_price || 0,
              qty * parseFloat(mat?.unit_price || 0),
              `Stock restored on Force Delete of Indent ${ind.indent_number}`,
              req.user.id
            ]
          );
        }
      }

      // Delete linked asset events and installed assets
      await client.query(
        'DELETE FROM asset_events WHERE asset_id IN (SELECT id FROM installed_assets WHERE indent_id = $1)',
        [req.params.id]
      );
      await client.query('DELETE FROM installed_assets WHERE indent_id = $1', [req.params.id]);
    }

    // Unlink any purchase orders that reference this indent
    await client.query('UPDATE purchase_orders SET indent_id = NULL WHERE indent_id = $1', [req.params.id]);

    // Delete child tables in transaction
    await client.query('DELETE FROM indent_items WHERE indent_id = $1', [req.params.id]);
    await client.query('DELETE FROM indent_audit_log WHERE indent_id = $1', [req.params.id]);
    await client.query('DELETE FROM store_indent_log WHERE indent_id = $1', [req.params.id]);
    await client.query('DELETE FROM indents WHERE id = $1', [req.params.id]);

    await client.query('COMMIT');
    publish('mkpm.indent.events', String(req.params.id), {
      event: 'indent.deleted',
      id: req.params.id,
      indentNumber: ind.indent_number,
      userId: req.user.id
    });

    res.json({ success: true, message: `Indent ${ind.indent_number} permanently deleted successfully` });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}));

// CONVERT EXISTING INDENT TO PO
router.post('/:id/convert-to-po', auth, requireLevel(2), ar(async (req, res) => {
  const { vendor_id, payment_terms = 'Net 30 Days', delivery_date, remarks } = req.body;
  if (!vendor_id) return res.status(400).json({ success: false, message: 'Vendor is required' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: [ind] } = await client.query(`SELECT * FROM indents WHERE id = $1 FOR UPDATE`, [req.params.id]);
    if (!ind) throw new Error('Indent not found');

    const { rows: existingPo } = await client.query(`SELECT id, po_number FROM purchase_orders WHERE indent_id = $1`, [ind.id]);
    if (existingPo.length > 0) {
      throw new Error(`A Purchase Order (${existingPo[0].po_number}) is already linked to this Indent.`);
    }

    const { rows: items } = await client.query(`SELECT * FROM indent_items WHERE indent_id = $1`, [ind.id]);
    if (!items.length) throw new Error('Indent has no line items');

    const d = new Date();
    const stamp = d.toISOString().slice(0, 10).replace(/-/g, '');
    await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [`po-${stamp}`]);
    const seqRes = await client.query(`SELECT LPAD((COUNT(*)+1)::text,4,'0') as seq FROM purchase_orders WHERE po_number LIKE $1`, [`PO-${stamp}-%`]);
    const poNum = `PO-${stamp}-${seqRes.rows[0].seq}`;

    let poTotalVal = 0;
    let poGstVal = 0;
    for (const it of items) {
      const p = parseFloat(it.unit_price || 0);
      const q = parseFloat(it.required_qty || 0);
      const lineBase = p * q;
      const gstPct = 18;
      const lineGst = (lineBase * gstPct) / 100;
      poTotalVal += lineBase;
      poGstVal += lineGst;
    }
    const poGrandTotal = poTotalVal + poGstVal;

    const { rows: [po] } = await client.query(
      `INSERT INTO purchase_orders (po_number, date, vendor_id, indent_id, delivery_date, payment_terms, status, total_value, gst_value, grand_total, created_by, remarks)
       VALUES ($1, CURRENT_DATE, $2, $3, $4, $5, 'Approved', $6, $7, $8, $9, $10) RETURNING *`,
      [poNum, vendor_id, ind.id, delivery_date || ind.required_date || null, payment_terms, poTotalVal, poGstVal, poGrandTotal, req.user.id, remarks || `PO converted from Indent ${ind.indent_number}`]
    );

    for (const it of items) {
      const p = parseFloat(it.unit_price || 0);
      const q = parseFloat(it.required_qty || 0);
      const gstPct = 18;
      const lineTot = (p * q) * 1.18;

      const itemUom = it.uom || it.matUom || 'NOS';
      await client.query(
        `INSERT INTO po_items (po_id, material_id, qty, received_qty, uom, unit_price, gst_pct, total)
         VALUES ($1, $2, $3, 0, $4, $5, $6, $7)`,
        [po.id, it.material_id, q, itemUom, p, gstPct, lineTot]
      );
    }

    await client.query(`UPDATE indents SET status = 'PO Created' WHERE id = $1`, [ind.id]);
    await client.query(
      `INSERT INTO indent_audit_log (indent_id, action, old_status, new_status, user_id, remarks)
       VALUES ($1, 'convert_to_po', $2, 'PO Created', $3, $4)`,
      [ind.id, ind.status, req.user.id, `Converted to Purchase Order ${poNum}`]
    );

    await client.query('COMMIT');
    res.json({ success: true, message: `Indent ${ind.indent_number} converted to PO ${poNum}`, data: po });
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(400).json({ success: false, message: e.message });
  } finally {
    client.release();
  }
}));

// CONVERT EXISTING INDENT TO DELIVERY CHALLAN (DC / GATE PASS)
router.post('/:id/convert-to-dc', auth, requireLevel(2), ar(async (req, res) => {
  const { dc_type = 'MATERIAL_OUT', vehicle_number, vehicle_type = 'Truck', driver_name, to_party, consignee_vendor_id, dc_purpose, expected_return_date } = req.body;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: [ind] } = await client.query(`SELECT * FROM indents WHERE id = $1 FOR UPDATE`, [req.params.id]);
    if (!ind) throw new Error('Indent not found');

    const { rows: items } = await client.query(`
      SELECT ii.*, m.name as "materialName", m.code as "materialCode" 
      FROM indent_items ii 
      JOIN materials m ON ii.material_id = m.id 
      WHERE ii.indent_id = $1
    `, [ind.id]);
    if (!items.length) throw new Error('Indent has no line items');

    const d = new Date();
    const stamp = `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;
    await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [`gp-${stamp}`]);
    const seq = await client.query('SELECT COUNT(*)+1 AS n FROM gate_passes WHERE date::date = CURRENT_DATE');
    const gpNum = `GP-${stamp}-${String(seq.rows[0].n).padStart(4,'0')}`;

    const matDesc = items.map(it => `${it.required_qty} ${it.uom || 'NOS'} of ${it.materialName} (${it.materialCode})`).join(', ');

    const { rows: [gp] } = await client.query(`
      INSERT INTO gate_passes (gp_number, pass_type, vehicle_type, vehicle_number, driver_name, purpose,
        material_description, from_party, to_party, security_guard_id, remarks, vendor_id, status, expected_return_date)
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'SRI M.K. PAPER MILLS', $8, $9, $10, $11, 'Open', $12) RETURNING *
    `, [gpNum, dc_type, vehicle_type, vehicle_number || null, driver_name || null,
        dc_purpose || `Outward Dispatch for Indent ${ind.indent_number}`,
        matDesc, to_party || 'Outward Consignee', req.user.id, `Delivery Challan for Indent ${ind.indent_number}`, consignee_vendor_id || null,
        dc_type === 'RETURNABLE' ? (expected_return_date || null) : null]);

    await client.query(`UPDATE indents SET status = 'DC Generated' WHERE id = $1`, [ind.id]);
    await client.query(
      `INSERT INTO indent_audit_log (indent_id, action, old_status, new_status, user_id, remarks)
       VALUES ($1, 'convert_to_dc', $2, 'DC Generated', $3, $4)`,
      [ind.id, ind.status, req.user.id, `Delivery Challan / Gate Pass ${gpNum} generated`]
    );

    await client.query('COMMIT');
    res.json({ success: true, message: `Delivery Challan ${gpNum} generated for Indent ${ind.indent_number}`, data: gp });
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(400).json({ success: false, message: e.message });
  } finally {
    client.release();
  }
}));

// 1-CLICK CONVERT INDENT TO CASH PURCHASE (SPOT PROCUREMENT)
router.post('/:id/convert-to-cash-purchase', auth, requireLevel(2), ar(async (req, res) => {
  const { vendor_name, vendor_gstin, invoice_number, payment_mode, payment_ref, remarks } = req.body;
  if (!vendor_name) return res.status(400).json({ success: false, message: 'Vendor / Supplier Name is required' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: [ind] } = await client.query(`SELECT * FROM indents WHERE id = $1 FOR UPDATE`, [req.params.id]);
    if (!ind) throw new Error('Indent not found');

    const { rows: items } = await client.query(`
      SELECT ii.*, m.name as "materialName", m.code as "materialCode", COALESCE(ii.unit_price, m.unit_price, 0) as price
      FROM indent_items ii
      JOIN materials m ON ii.material_id = m.id
      WHERE ii.indent_id = $1
    `, [ind.id]);
    if (!items.length) throw new Error('Indent has no line items');

    const d = new Date();
    const stamp = d.toISOString().slice(0, 10).replace(/-/g, '');
    await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [`cp-${stamp}`]);
    const seqRes = await client.query(`SELECT LPAD((COUNT(*)+1)::text,4,'0') as seq FROM cash_purchases WHERE voucher_number LIKE $1`, [`CP-${stamp}-%`]);
    const cpNum = `CP-${stamp}-${seqRes.rows[0].seq}`;

    let cpTaxable = 0, cpTax = 0;
    for (const it of items) {
      const p = parseFloat(it.price || 0);
      const q = parseFloat(it.required_qty || 0);
      const lineBase = p * q;
      const gstPct = 18;
      cpTaxable += lineBase;
      cpTax += lineBase * (gstPct / 100);
    }
    const cpGrandTotal = cpTaxable + cpTax;

    const { rows: [cp] } = await client.query(
      `INSERT INTO cash_purchases (
         voucher_number, date, indent_id, vendor_name, vendor_gstin, invoice_number,
         invoice_date, payment_mode, payment_ref, taxable_amount, cgst_amount, sgst_amount,
         igst_amount, total_tax, total_amount, remarks, created_by
       ) VALUES ($1, CURRENT_DATE, $2, $3, $4, $5, CURRENT_DATE, $6, $7, $8, $9, $9, 0, $10, $11, $12, $13)
       RETURNING *`,
      [
        cpNum, ind.id, vendor_name, vendor_gstin || null, invoice_number || cpNum,
        payment_mode || 'Cash', payment_ref || null, cpTaxable, cpTax / 2, cpTax,
        cpGrandTotal, remarks || `Cash Purchase against Indent ${ind.indent_number}`, req.user.id
      ]
    );

    for (const it of items) {
      const p = parseFloat(it.price || 0);
      const q = parseFloat(it.required_qty || 0);
      const lineTaxable = p * q;
      const lineTot = lineTaxable * 1.18;

      const itemUom = it.uom || it.matUom || 'NOS';
      await client.query(
        `INSERT INTO cash_purchase_items (cash_purchase_id, material_id, qty, uom, unit_price, gst_pct, line_taxable, line_total)
         VALUES ($1, $2, $3, $4, $5, 18, $6, $7)`,
        [cp.id, it.material_id, q, itemUom, p, lineTaxable, lineTot]
      );

      // Atomically increment stock
      const { rows: [mat] } = await client.query(`SELECT current_stock FROM materials WHERE id = $1 FOR UPDATE`, [it.material_id]);
      const curStock = parseFloat(mat?.current_stock || 0);
      const newStock = curStock + q;
      await client.query(`UPDATE materials SET current_stock = $1, unit_price = CASE WHEN $2::numeric > 0 THEN $2::numeric ELSE unit_price END WHERE id = $3`, [newStock, p, it.material_id]);

      // Stock ledger
      await client.query(
        `INSERT INTO stock_ledger (material_id, date, transaction_type, reference_type, reference_id, in_qty, out_qty, balance, unit_price, value, remarks, created_by)
         VALUES ($1, CURRENT_DATE, 'cash_purchase', 'cash_purchase', $2, $3, 0, $4, $5, $6, $7, $8)`,
        [it.material_id, cp.id, q, newStock, p, lineTaxable, `Cash Purchase ${cpNum} against Indent ${ind.indent_number}`, req.user.id]
      );
    }

    await client.query(`UPDATE indents SET status = 'Cash Purchased' WHERE id = $1`, [ind.id]);
    await client.query(
      `INSERT INTO indent_audit_log (indent_id, action, old_status, new_status, user_id, remarks)
       VALUES ($1, 'convert_to_cash_purchase', $2, 'Cash Purchased', $3, $4)`,
      [ind.id, ind.status, req.user.id, `Converted to Cash Purchase Voucher ${cpNum}`]
    );

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
         ) VALUES ($1, NULL, NULL, NULL, $2, CURRENT_DATE, CURRENT_DATE, $3, $4, $5, 0, $6, 0, $7, $7, 0, 'Paid', $8, $9)`,
        [
          billNum, invoice_number || cpNum, cpTaxable, cpTax / 2, cpTax / 2,
          cpTax, cpGrandTotal, `Cash Purchase ${cpNum} against Indent ${ind.indent_number}`, req.user.id
        ]
      );
    } catch(err) { /* non-blocking */ }

    await client.query('COMMIT');
    res.json({ success: true, message: `Cash Purchase Voucher ${cpNum} generated and stock updated!`, data: cp });
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(400).json({ success: false, message: e.message });
  } finally {
    client.release();
  }
}));

module.exports = router;
// Exported so scripts (tests, migrations) generate indent numbers via the one real
// implementation instead of reimplementing their own copy that can drift out of sync
// with the fix above — that drift is exactly how test_indent_issue_wiring.js ended up
// with its own inline COUNT(*)-based generator carrying the same bug this file just fixed.
module.exports.seqNum = seqNum;


