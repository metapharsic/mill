const express = require('express')
const router = express.Router()
const { pool, requireAuth, ar } = require('../middleware/helpers')
const { publish, TOPICS } = require('../kafka')
// Gate-pass in/out is a guard-desk action — SEC/STORE dept staff or level3+ (supervisors/plant heads)
const requireGuard = (req, res, next) => {
  if (req.user.role_level >= 3) return next()
  const dept = (req.user.dept_code || req.user.department || '').toUpperCase()
  if (['SEC', 'SECURITY', 'STORE', 'STORES', 'STORE MANAGEMENT'].includes(dept)) return next()
  return res.status(403).json({ success: false, message: 'Security / Store desk authorization required' })
}

router.get('/passes', requireAuth, ar(async (req, res) => {
  const { from, to, passType, status } = req.query
  let where = ['1=1']; const vals = []
  if (from) { vals.push(from); where.push(`gp.date >= $${vals.length}`) }
  if (to)   { vals.push(to);   where.push(`gp.date <= $${vals.length}`) }
  if (passType) { vals.push(passType); where.push(`gp.pass_type = $${vals.length}`) }
  if (status)   { vals.push(status);   where.push(`gp.status = $${vals.length}`) }
  const { rows } = await pool.query(`
    SELECT gp.*, 
           u.name AS guardName,
           po.po_number AS "poNumber",
           v.name AS "vendorName"
    FROM gate_passes gp
    LEFT JOIN users u ON gp.security_guard_id = u.id
    LEFT JOIN purchase_orders po ON gp.po_id = po.id
    LEFT JOIN vendors v ON gp.vendor_id = v.id
    WHERE ${where.join(' AND ')} ORDER BY gp.created_at DESC LIMIT 200
  `, vals)
  const summary = await pool.query(`
    SELECT COUNT(*) FILTER (WHERE status='Open') AS open,
           COUNT(*) FILTER (WHERE date=CURRENT_DATE) AS today,
           COUNT(*) FILTER (WHERE pass_type='IN' AND date=CURRENT_DATE) AS inToday,
           COUNT(*) FILTER (WHERE pass_type='OUT' AND date=CURRENT_DATE) AS outToday
    FROM gate_passes
  `)
  res.json({ success: true, data: rows, summary: summary.rows[0] })
}))

// GET /api/security/open-inward-passes — For Store Inward Desk to load gate-entered trucks
router.get('/open-inward-passes', requireAuth, ar(async (req, res) => {
  const { rows } = await pool.query(`
    SELECT gp.id, gp.gp_number AS "gpNumber", gp.date, gp.vehicle_number AS "vehicleNumber",
           gp.driver_name AS "driverName", gp.weight_in AS "weightIn", gp.in_time AS "inTime",
           gp.challan_number AS "challanNumber", gp.invoice_number AS "invoiceNumber",
           gp.po_id AS "poId", po.po_number AS "poNumber",
           gp.vendor_id AS "vendorId", v.name AS "vendorName",
           gp.material_description AS "materialDescription"
    FROM gate_passes gp
    LEFT JOIN purchase_orders po ON gp.po_id = po.id
    LEFT JOIN vendors v ON gp.vendor_id = v.id
    LEFT JOIN grn g ON g.gate_pass_id = gp.id
    WHERE gp.pass_type = 'IN' AND gp.status = 'Open' AND g.id IS NULL
    ORDER BY gp.created_at DESC
  `)
  res.json({ success: true, data: rows })
}))

router.post('/passes', requireAuth, requireGuard, ar(async (req, res) => {
  const { passType, vehicleType, vehicleNumber, driverName, purpose, materialDescription,
          fromParty, toParty, weightIn, remarks, poId, vendorId, challanNumber, invoiceNumber } = req.body

  // GAP-3 FIX: Validate passType before touching the database
  const VALID_PASS_TYPES = ['IN', 'OUT', 'MATERIAL_OUT', 'VISITOR', 'RETURNABLE']
  if (!passType || !VALID_PASS_TYPES.includes(passType)) {
    return res.status(400).json({
      success: false,
      message: `Invalid pass type '${passType}'. Must be one of: ${VALID_PASS_TYPES.join(', ')}`
    })
  }
  if (passType === 'IN' && !vehicleNumber) {
    return res.status(400).json({ success: false, message: 'Vehicle number is required for Inward Gate Pass' })
  }
  if (!purpose) {
    return res.status(400).json({ success: false, message: 'Purpose is required' })
  }

  // Data-integrity fix: a gate pass linked to a PO must reference a real, non-cancelled PO.
  // The UI dropdown already filters to Approved/Partial POs, but the API itself accepted any
  // po_id (including a Cancelled or nonexistent one) when called directly.
  if (poId) {
    const { rows: [po] } = await pool.query('SELECT id, status FROM purchase_orders WHERE id = $1', [poId])
    if (!po) {
      return res.status(400).json({ success: false, message: `Purchase Order ${poId} not found` })
    }
    if (po.status === 'Cancelled') {
      return res.status(400).json({ success: false, message: `Purchase Order is Cancelled and cannot be linked to a Gate Pass` })
    }
  }

  const d = new Date()
  const stamp = `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [`gp-${stamp}`])
    const seq = await client.query('SELECT COUNT(*)+1 AS n FROM gate_passes WHERE date::date = CURRENT_DATE')
    const num = `GP-${stamp}-${String(seq.rows[0].n).padStart(4,'0')}`
    const isInward = passType === 'IN'
    const { rows } = await client.query(`
      INSERT INTO gate_passes (gp_number,pass_type,vehicle_type,vehicle_number,driver_name,purpose,
        material_description,from_party,to_party,weight_in,in_time,security_guard_id,remarks,
        po_id,vendor_id,challan_number,invoice_number)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,${isInward ? 'NOW()' : 'NULL'},$11,$12,$13,$14,$15,$16) RETURNING id
    `, [num, passType, vehicleType||'Vehicle', vehicleNumber||null, driverName||null, purpose, materialDescription||null,
        fromParty||null, toParty||null, weightIn||null, req.user.id, remarks||null,
        poId||null, vendorId||null, challanNumber||null, invoiceNumber||null])
    await client.query('COMMIT')
    publish(TOPICS.EVENTS_ALL, `gp-${rows[0].id}`, { event: 'security.gatepass.created', id: rows[0].id, gpNumber: num, passType, vehicleNumber, userId: req.user.id })
    res.json({ success: true, data: { id: rows[0].id, gpNumber: num } })
  } catch (e) { await client.query('ROLLBACK'); throw e }
  finally { client.release() }
}))

// POST /api/security/rtv-pass — Generate Outward Gate Pass for Return to Vendor
router.post('/rtv-pass', requireAuth, requireGuard, ar(async (req, res) => {
  const { rejectionId, vehicleNumber, driverName, weightOut, remarks } = req.body
  if (!rejectionId) return res.status(400).json({ success: false, message: 'Rejection ID required' })

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const { rows: [rej] } = await client.query(`
      SELECT mr.*, v.name AS vendor_name, m.name AS material_name
      FROM material_rejections mr
      LEFT JOIN vendors v ON mr.vendor_id = v.id
      LEFT JOIN materials m ON mr.material_id = m.id
      WHERE mr.id = $1 FOR UPDATE
    `, [rejectionId])

    if (!rej) throw new Error('Rejection record not found')

    const d = new Date()
    const stamp = `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`
    await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [`gp-${stamp}`])
    const seq = await client.query('SELECT COUNT(*)+1 AS n FROM gate_passes WHERE date::date = CURRENT_DATE')
    const num = `GP-${stamp}-${String(seq.rows[0].n).padStart(4,'0')}`

    const desc = `RTV Dispatch: ${rej.rejected_qty} ${rej.uom} of ${rej.material_name} (Ref: ${rej.rejection_number})`
    const { rows: [gp] } = await client.query(`
      INSERT INTO gate_passes (gp_number, pass_type, vehicle_type, vehicle_number, driver_name, purpose,
        material_description, from_party, to_party, weight_out, out_time, security_guard_id, remarks,
        po_id, vendor_id, status)
      VALUES ($1, 'OUT', 'Truck', $2, $3, 'Return to Vendor (RTV)',
        $4, 'MK Paper Mill', $5, $6, NOW(), $7, $8,
        $9, $10, 'Closed') RETURNING id, gp_number
    `, [num, vehicleNumber || 'Vendor Vehicle', driverName || 'Vendor Driver',
        desc, rej.vendor_name || 'Vendor', weightOut || null, req.user.id, remarks || `RTV ${rej.rejection_number}`,
        rej.po_id, rej.vendor_id])

    await client.query(`
      UPDATE material_rejections
      SET status = 'Dispatched Out', outward_gate_pass_id = $1
      WHERE id = $2
    `, [gp.id, rejectionId])

    await client.query('COMMIT')
    publish(TOPICS.EVENTS_ALL, `gp-${gp.id}`, { event: 'security.rtv.dispatched', id: gp.id, gpNumber: gp.gp_number, rejectionId, userId: req.user.id })
    res.json({ success: true, data: { gatePassId: gp.id, gpNumber: gp.gp_number } })
  } catch (e) { await client.query('ROLLBACK'); throw e }
  finally { client.release() }
}))

// Edit gate pass details (vehicle number, driver, destination, remarks)
// Guarded the same as create/close: previously this only required requireAuth, so any
// authenticated user in any department could edit gate pass details.
router.put('/passes/:id', requireAuth, requireGuard, ar(async (req, res) => {
  const { vehicle_number, driver_name, to_party, from_party, purpose, material_description, remarks, expected_return_date, status } = req.body;
  const { rows: [gp] } = await pool.query('SELECT * FROM gate_passes WHERE id = $1', [req.params.id]);
  if (!gp) return res.status(404).json({ success: false, message: 'Gate pass not found' });
  if (gp.status === 'Closed' && (req.user?.role_level || 1) < 4) {
    return res.status(400).json({ success: false, message: 'Cannot edit a closed gate pass' });
  }

  const { rows: [updated] } = await pool.query(`
    UPDATE gate_passes SET
      vehicle_number = COALESCE($1, vehicle_number),
      driver_name = COALESCE($2, driver_name),
      to_party = COALESCE($3, to_party),
      from_party = COALESCE($4, from_party),
      purpose = COALESCE($5, purpose),
      material_description = COALESCE($6, material_description),
      remarks = COALESCE($7, remarks),
      expected_return_date = COALESCE($8, expected_return_date),
      status = COALESCE($9, status)
    WHERE id = $10 RETURNING *
  `, [vehicle_number || null, driver_name || null, to_party || null, from_party || null, purpose || null, material_description || null, remarks || null, expected_return_date || null, status || null, req.params.id]);

  res.json({ success: true, data: updated, message: 'Gate pass updated successfully' });
}));

// Close gate pass (vehicle out)
router.put('/passes/:id/out', requireAuth, requireGuard, ar(async (req, res) => {
  const { weightOut } = req.body
  const gp = await pool.query('SELECT weight_in FROM gate_passes WHERE id=$1', [req.params.id])
  const wIn = parseFloat(gp.rows[0]?.weight_in || 0)
  const wOut = parseFloat(weightOut || 0)
  const net = Math.abs(wIn - wOut)
  await pool.query(`
    UPDATE gate_passes SET out_time=NOW(), weight_out=$1, net_weight=$2, status='Closed' WHERE id=$3
  `, [weightOut||null, net||null, req.params.id])
  publish(TOPICS.EVENTS_ALL, `gp-${req.params.id}`, { event: 'security.gatepass.closed', id: req.params.id, userId: req.user.id })
  res.json({ success: true })
}))

module.exports = router
