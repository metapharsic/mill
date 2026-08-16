const express = require('express')
const router = express.Router()
const { pool, requireAuth, ar } = require('../middleware/helpers')
const { publish, TOPICS } = require('../kafka')
// Gate-pass in/out is a guard-desk action — SEC dept staff or level4+ (plant head/admin override)
const requireGuard = (req, res, next) => {
  if (req.user.role_level >= 4) return next()
  if (req.user.dept_code === 'SEC') return next()
  return res.status(403).json({ success: false, message: 'Security desk only' })
}

router.get('/passes', requireAuth, ar(async (req, res) => {
  const { from, to, passType, status } = req.query
  let where = ['1=1']; const vals = []
  if (from) { vals.push(from); where.push(`gp.date >= $${vals.length}`) }
  if (to)   { vals.push(to);   where.push(`gp.date <= $${vals.length}`) }
  if (passType) { vals.push(passType); where.push(`gp.pass_type = $${vals.length}`) }
  if (status)   { vals.push(status);   where.push(`gp.status = $${vals.length}`) }
  const { rows } = await pool.query(`
    SELECT gp.*, u.name AS guardName
    FROM gate_passes gp
    LEFT JOIN users u ON gp.security_guard_id = u.id
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

router.post('/passes', requireAuth, requireGuard, ar(async (req, res) => {
  const { passType, vehicleType, vehicleNumber, driverName, purpose, materialDescription,
          fromParty, toParty, weightIn, remarks } = req.body
  const d = new Date()
  const stamp = `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [`gp-${stamp}`]) // Doc31 #8
    const seq = await client.query('SELECT COUNT(*)+1 AS n FROM gate_passes WHERE date::date = CURRENT_DATE')
    const num = `GP-${stamp}-${String(seq.rows[0].n).padStart(4,'0')}`
    const { rows } = await client.query(`
      INSERT INTO gate_passes (gp_number,pass_type,vehicle_type,vehicle_number,driver_name,purpose,
        material_description,from_party,to_party,weight_in,in_time,security_guard_id,remarks)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW(),$11,$12) RETURNING id
    `, [num, passType, vehicleType, vehicleNumber, driverName, purpose, materialDescription,
        fromParty, toParty, weightIn||null, req.user.id, remarks])
    await client.query('COMMIT')
    publish(TOPICS.EVENTS_ALL, `gp-${rows[0].id}`, { event: 'security.gatepass.created', id: rows[0].id, gpNumber: num, passType, vehicleNumber, userId: req.user.id })
    res.json({ success: true, data: { id: rows[0].id, gpNumber: num } })
  } catch (e) { await client.query('ROLLBACK'); throw e }
  finally { client.release() }
}))

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
