const router = require('express').Router();
const pool = require('../db/pool');
const { auth, requireLevel } = require('../middleware/auth');
const { publish, TOPICS } = require('../kafka');
const ar = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const seqNum = async (client, table, col, prefix) => {
  const stamp = new Date().toISOString().slice(0,10).replace(/-/g,'');
  const { rows } = await client.query(
    `SELECT LPAD((COUNT(*)+1)::text,4,'0') AS seq FROM ${table} WHERE ${col} LIKE $1`,
    [`${prefix}-${stamp}-%`]
  );
  return `${prefix}-${stamp}-${rows[0].seq}`;
};

// CUSTOMERS dropdown
router.get('/customers', auth, ar(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT id,name,code,mobile,email,city,credit_limit as "creditLimit",credit_days as "creditDays",is_active as "isActive"
     FROM customers WHERE is_active=true ORDER BY name`
  );
  res.json({ success:true, data:rows });
}));

// SALES ORDERS LIST
router.get('/orders', auth, ar(async (req, res) => {
  const { status, customer_id, page=1, limit=20 } = req.query;
  const conds=[]; const params=[]; let p=1;
  if (status)      { conds.push(`so.status=$${p++}`); params.push(status); }
  if (customer_id) { conds.push(`so.customer_id=$${p++}`); params.push(customer_id); }
  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
  const offset = (parseInt(page)-1)*parseInt(limit);
  const { rows } = await pool.query(
    `SELECT so.id, so.so_number as "soNumber", so.date, so.delivery_date as "deliveryDate",
            so.gsm, so.width_mm as "widthMm", so.qty_mt as "qtyMt",
            so.fulfilled_mt as "fulfilledMt", so.rate_per_kg as "ratePerKg",
            so.total_value as "totalValue", so.status, so.remarks,
            c.name as "customerName", g.name as "gradeName", g.code as "gradeCode"
     FROM sales_orders so
     LEFT JOIN customers c ON c.id=so.customer_id
     LEFT JOIN grades g ON g.id=so.grade_id
     ${where} ORDER BY so.date DESC LIMIT $${p} OFFSET $${p+1}`,
    [...params, parseInt(limit), offset]
  );
  const { rows: cnt } = await pool.query(`SELECT COUNT(*) FROM sales_orders so ${where}`, params);
  res.json({ success:true, data:rows, total:parseInt(cnt[0].count) });
}));

// CREATE SO
router.post('/orders', auth, requireLevel(3), ar(async (req, res) => {
  const { customer_id, delivery_date, grade_id, gsm, width_mm, qty_mt, rate_per_kg, remarks } = req.body;
  if (!customer_id || !grade_id || !qty_mt || !rate_per_kg) {
    return res.json({ success:false, message:'Customer, grade, qty, rate required' });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const num = await seqNum(client, 'sales_orders', 'so_number', 'SO');
    const totalValue = parseFloat(qty_mt)*1000*parseFloat(rate_per_kg);
    const { rows } = await client.query(
      `INSERT INTO sales_orders
         (so_number,date,customer_id,delivery_date,grade_id,gsm,width_mm,qty_mt,rate_per_kg,total_value,status,created_by,remarks)
       VALUES ($1,NOW(),$2,$3,$4,$5,$6,$7,$8,$9,'Pending',$10,$11) RETURNING *`,
      [num,customer_id,delivery_date||null,grade_id,gsm||null,width_mm||null,qty_mt,rate_per_kg,totalValue,req.user.id,remarks||null]
    );
    await client.query('COMMIT');
    publish(TOPICS.EVENTS_ALL, `so-${rows[0].id}`, { event: 'sales.order.created', id: rows[0].id, soNumber: num, customerId: customer_id, userId: req.user.id });
    res.json({ success:true, data:rows[0] });
  } catch(e) { await client.query('ROLLBACK'); throw e; }
  finally { client.release(); }
}));

// UPDATE SO STATUS
router.put('/orders/:id', auth, requireLevel(3), ar(async (req, res) => {
  const { status, delivery_date, remarks } = req.body;
  const { rows } = await pool.query(
    `UPDATE sales_orders SET status=COALESCE($1,status), delivery_date=COALESCE($2,delivery_date),
       remarks=COALESCE($3,remarks) WHERE id=$4 RETURNING *`,
    [status||null, delivery_date||null, remarks||null, req.params.id]
  );
  publish(TOPICS.EVENTS_ALL, `so-${req.params.id}`, { event: 'sales.order.updated', id: req.params.id, status, userId: req.user.id });
  res.json({ success:!!rows.length, data:rows[0] });
}));

// CONFIRM ORDER — Pending → Confirmed
router.put('/orders/:id/confirm', auth, requireLevel(3), ar(async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: old } = await client.query(
      'SELECT * FROM sales_orders WHERE id=$1 FOR UPDATE', [req.params.id]
    );
    if (!old.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Order not found' });
    }
    if (old[0].status !== 'Pending') {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: `Cannot confirm order in status '${old[0].status}'` });
    }
    const { rows } = await client.query(
      `UPDATE sales_orders SET status='Confirmed' WHERE id=$1 RETURNING *`, [req.params.id]
    );
    await client.query('COMMIT');
    publish(TOPICS.EVENTS_ALL, `so-${req.params.id}`, { event: 'sales.order.confirmed', id: req.params.id, userId: req.user.id });
    res.json({ success: true, data: rows[0] });
  } catch(e) { await client.query('ROLLBACK'); throw e; }
  finally { client.release(); }
}));

// CANCEL ORDER
router.put('/orders/:id/cancel', auth, requireLevel(3), ar(async (req, res) => {
  const { reason } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: old } = await client.query(
      'SELECT * FROM sales_orders WHERE id=$1 FOR UPDATE', [req.params.id]
    );
    if (!old.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Order not found' });
    }
    if (['Dispatched', 'Delivered', 'Cancelled'].includes(old[0].status)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: `Cannot cancel order in status '${old[0].status}'` });
    }
    const { rows } = await client.query(
      `UPDATE sales_orders SET status='Cancelled', remarks=COALESCE($1,remarks) WHERE id=$2 RETURNING *`,
      [reason || null, req.params.id]
    );
    await client.query('COMMIT');
    res.json({ success: true, data: rows[0] });
  } catch (e) { await client.query('ROLLBACK'); throw e; }
  finally { client.release(); }
}));

// ADVANCE DISPATCH STATE — Loading→Loaded→Dispatched→Delivered
const DISPATCH_TRANSITIONS = { Loading: 'Loaded', Loaded: 'Dispatched', Dispatched: 'Delivered' };

router.put('/dispatch/:id/advance', auth, requireLevel(2), ar(async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: old } = await client.query(
      'SELECT * FROM dispatch_orders WHERE id=$1 FOR UPDATE', [req.params.id]
    );
    if (!old.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Dispatch order not found' });
    }
    const nextStatus = DISPATCH_TRANSITIONS[old[0].status];
    if (!nextStatus) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: `No next state from '${old[0].status}'` });
    }
    const { rows } = await client.query(
      `UPDATE dispatch_orders SET status=$1 WHERE id=$2 RETURNING *`,
      [nextStatus, req.params.id]
    );
    await client.query('COMMIT');
    res.json({ success: true, data: rows[0], transitioned: { from: old[0].status, to: nextStatus } });
  } catch (e) { await client.query('ROLLBACK'); throw e; }
  finally { client.release(); }
}));

// DISPATCH LIST
router.get('/dispatch', auth, ar(async (req, res) => {
  const { status, page=1, limit=20 } = req.query;
  const conds=[]; const params=[]; let p=1;
  if (status) { conds.push(`do2.status=$${p++}`); params.push(status); }
  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
  const offset = (parseInt(page)-1)*parseInt(limit);
  const { rows } = await pool.query(
    `SELECT do2.id, do2.do_number as "doNumber", do2.date,
            do2.vehicle_number as "vehicleNumber", do2.driver_name as "driverName",
            do2.transporter, do2.total_weight_kg as "totalWeightKg",
            do2.total_reels as "totalReels", do2.status, do2.invoice_number as "invoiceNumber",
            c.name as "customerName", so.so_number as "soNumber"
     FROM dispatch_orders do2
     LEFT JOIN customers c ON c.id=do2.customer_id
     LEFT JOIN sales_orders so ON so.id=do2.so_id
     ${where} ORDER BY do2.date DESC LIMIT $${p} OFFSET $${p+1}`,
    [...params, parseInt(limit), offset]
  );
  const { rows: cnt } = await pool.query(`SELECT COUNT(*) FROM dispatch_orders do2 ${where}`, params);
  res.json({ success:true, data:rows, total:parseInt(cnt[0].count) });
}));

// Helper: insert audit log row (inside a client transaction)
async function auditLog(client, { userId, action, module, recordId, oldData, newData, ip }) {
  await client.query(
    `INSERT INTO audit_log (user_id, action, module, record_id, old_data, new_data, ip_address)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [userId, action, module, recordId, oldData ? JSON.stringify(oldData) : null,
     newData ? JSON.stringify(newData) : null, ip || null]
  );
}

// CREATE DISPATCH
router.post('/dispatch', auth, requireLevel(2), ar(async (req, res) => {
  const {
    so_id, customer_id, vehicle_number, driver_name, driver_mobile,
    transporter, lr_number, eway_bill, invoice_number, reel_ids=[]
  } = req.body;
  if (!customer_id || !reel_ids.length) return res.json({ success:false, message:'Customer + reels required' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const num = await seqNum(client, 'dispatch_orders', 'do_number', 'DO');
    const { rows: reelData } = await client.query(
      `SELECT id, weight_kg FROM reels WHERE id=ANY($1) AND status='In Warehouse'`,
      [reel_ids]
    );
    if (!reelData.length) { await client.query('ROLLBACK'); return res.json({ success:false, message:'No warehouse reels found' }); }
    const totalKg = reelData.reduce((s,r)=>s+parseFloat(r.weight_kg||0),0);
    const { rows } = await client.query(
      `INSERT INTO dispatch_orders
         (do_number,date,so_id,customer_id,vehicle_number,driver_name,driver_mobile,
          transporter,lr_number,eway_bill,invoice_number,total_weight_kg,total_reels,status,dispatched_by)
       VALUES ($1,NOW(),$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'Loading',$13) RETURNING *`,
      [num,so_id||null,customer_id,vehicle_number||null,driver_name||null,driver_mobile||null,
       transporter||null,lr_number||null,eway_bill||null,invoice_number||null,
       totalKg,reelData.length,req.user.id]
    );
    const doId = rows[0].id;
    for (const r of reelData) {
      await client.query(`INSERT INTO dispatch_items (dispatch_id,reel_id,weight_kg) VALUES ($1,$2,$3)`, [doId,r.id,r.weight_kg]);
      await client.query(`UPDATE reels SET status='Dispatched' WHERE id=$1`, [r.id]);
    }
    if (so_id) {
      await client.query(
        `UPDATE sales_orders SET fulfilled_mt=fulfilled_mt+$1,
           status=CASE WHEN fulfilled_mt+$1 >= qty_mt THEN 'Dispatched' ELSE 'Partial' END
         WHERE id=$2`,
        [totalKg/1000, so_id]
      );
    }
    const dispatchOrder = rows[0];
    await auditLog(client, {
      userId: req.user.id,
      action: 'DISPATCH_CREATED',
      module: 'Sales',
      recordId: doId,
      newData: dispatchOrder,
      ip: req.ip
    });
    await client.query('COMMIT');
    res.json({ success:true, data:dispatchOrder });
  } catch(e) { await client.query('ROLLBACK'); throw e; }
  finally { client.release(); }
}));

// UPDATE DISPATCH STATUS
router.put('/dispatch/:id', auth, requireLevel(2), ar(async (req, res) => {
  const { status, lr_number, eway_bill } = req.body;
  const { rows } = await pool.query(
    `UPDATE dispatch_orders SET status=COALESCE($1,status),lr_number=COALESCE($2,lr_number),
       eway_bill=COALESCE($3,eway_bill) WHERE id=$4 RETURNING *`,
    [status||null, lr_number||null, eway_bill||null, req.params.id]
  );
  res.json({ success:!!rows.length, data:rows[0] });
}));

// GENERATE INVOICE (Gap #16)
router.post('/dispatch/:id/invoice', auth, requireLevel(2), ar(async (req, res) => {
  const doId = req.params.id;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: [dOrder] } = await client.query(
      `SELECT d.id, d.do_number, d.total_weight_kg, d.so_id, d.invoice_number, s.rate_per_kg
       FROM dispatch_orders d
       LEFT JOIN sales_orders s ON s.id = d.so_id
       WHERE d.id=$1`, [doId]
    );
    if (!dOrder) throw new Error('Dispatch not found');
    if (dOrder.invoice_number) throw new Error('Invoice already generated');
    if (!dOrder.so_id) throw new Error('Cannot invoice dispatch without Sales Order link');

    // Simple invoice generation based on dispatched kg * rate_per_kg of SO
    const invoiceNum = `INV-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${doId}`;
    const invoiceAmount = Number(dOrder.total_weight_kg || 0) * Number(dOrder.rate_per_kg || 0);

    // Update DO
    await client.query(`UPDATE dispatch_orders SET invoice_number=$1 WHERE id=$2`, [invoiceNum, doId]);

    await auditLog(client, {
      userId: req.user.id,
      action: 'INVOICE_GENERATED',
      module: 'Sales',
      recordId: doId,
      newData: { invoice_number: invoiceNum, do_id: doId, invoice_amount: invoiceAmount },
      ip: req.ip
    });
    
    await client.query('COMMIT');
    res.json({ success: true, data: { invoice_number: invoiceNum, invoice_amount: invoiceAmount } });
  } catch(e) {
    await client.query('ROLLBACK');
    return res.status(400).json({ success: false, message: e.message });
  } finally {
    client.release();
  }
}));

// IN WAREHOUSE REELS (for dispatch selection)
router.get('/reels/warehouse', auth, ar(async (req, res) => {
  const { grade_id } = req.query;
  const conds=[`r.status='In Warehouse'`]; const params=[]; let p=1;
  if (grade_id) { conds.push(`r.grade_id=$${p++}`); params.push(grade_id); }
  const { rows } = await pool.query(
    `SELECT r.id, r.reel_number as "reelNumber", r.gsm, r.width_mm as "widthMm",
            r.weight_kg as "weightKg", r.rack_location as "rackLocation",
            g.name as "gradeName"
     FROM reels r LEFT JOIN grades g ON g.id=r.grade_id
     WHERE ${conds.join(' AND ')} ORDER BY r.end_time ASC LIMIT 200`,
    params
  );
  res.json({ success:true, data:rows });
}));

module.exports = router;
