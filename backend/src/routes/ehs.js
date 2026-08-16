const express = require('express')
const router = express.Router()
const { pool, requireAuth, requireLevel, ar } = require('../middleware/helpers')
const { publish, TOPICS } = require('../kafka')

router.get('/incidents', requireAuth, ar(async (req, res) => {
  const { from, to, severity, status } = req.query
  let where = ['1=1']; const vals = []
  if (from) { vals.push(from); where.push(`ei.date >= $${vals.length}`) }
  if (to)   { vals.push(to);   where.push(`ei.date <= $${vals.length}`) }
  if (severity) { vals.push(severity); where.push(`ei.severity = $${vals.length}`) }
  if (status)   { vals.push(status);   where.push(`ei.status = $${vals.length}`) }
  const { rows } = await pool.query(`
    SELECT ei.*, d.name AS departmentName, u.name AS reportedByName
    FROM ehs_incidents ei
    LEFT JOIN departments d ON ei.department_id = d.id
    LEFT JOIN users u ON ei.reported_by = u.id
    WHERE ${where.join(' AND ')} ORDER BY ei.created_at DESC LIMIT 200
  `, vals)
  const summary = await pool.query(`
    SELECT COUNT(*) AS total,
           COUNT(*) FILTER (WHERE status='Open') AS open,
           COUNT(*) FILTER (WHERE severity IN ('High','Critical')) AS highSeverity,
           COUNT(*) FILTER (WHERE date >= CURRENT_DATE - INTERVAL '30 days') AS last30Days,
           COUNT(*) FILTER (WHERE incident_type='LTI') AS lti
    FROM ehs_incidents
  `)
  res.json({ success: true, data: rows, summary: summary.rows[0] })
}))

router.post('/incidents', requireAuth, ar(async (req, res) => {
  const { incidentType, severity, location, departmentId, description,
          injuredPerson, incidentTime, rootCause, correctiveAction } = req.body
  const d = new Date()
  const stamp = `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [`ehs-${stamp}`]) // Doc31 #8
    const seq = await client.query('SELECT COUNT(*)+1 AS n FROM ehs_incidents WHERE date::date = CURRENT_DATE')
    const num = `EHS-${stamp}-${String(seq.rows[0].n).padStart(4,'0')}`
    const { rows } = await client.query(`
      INSERT INTO ehs_incidents (incident_number,incident_type,severity,location,department_id,
        description,injured_person,incident_time,root_cause,corrective_action,reported_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id
    `, [num, incidentType, severity, location, departmentId||null, description,
        injuredPerson, incidentTime||null, rootCause, correctiveAction, req.user.id])
    await client.query('COMMIT')
    publish(TOPICS.EVENTS_ALL, `ehs-${rows[0].id}`, { event: 'ehs.incident.reported', id: rows[0].id, incidentNumber: num, severity, type: incidentType, userId: req.user.id })
    if (['High','Critical'].includes(severity)) publish(TOPICS.EVENTS_CRIT, `ehs-${rows[0].id}`, { event: 'ehs.incident.critical', id: rows[0].id, incidentNumber: num, severity, type: incidentType, location, description, userId: req.user.id })
    res.json({ success: true, data: { id: rows[0].id, incidentNumber: num } })
  } catch (e) { await client.query('ROLLBACK'); throw e }
  finally { client.release() }
}))

router.put('/incidents/:id', requireAuth, ar(async (req, res) => {
  const { rootCause, correctiveAction, status, closureDate } = req.body
  const { rows: [cur] } = await pool.query('SELECT status, reported_by FROM ehs_incidents WHERE id=$1', [req.params.id])
  if (!cur) return res.status(404).json({ success: false, message: 'Not found' })
  // Once investigation moves past Open, only level-2+ (supervisor) can edit — reporter can't quietly rewrite root cause/status after review starts
  if (cur.status !== 'Open' && req.user.role_level < 2) {
    return res.status(403).json({ success: false, message: 'Incident under review — supervisor level required to edit' })
  }
  await pool.query(`
    UPDATE ehs_incidents SET root_cause=$1, corrective_action=$2, status=$3, closure_date=$4 WHERE id=$5
  `, [rootCause, correctiveAction, status, closureDate||null, req.params.id])
  publish(TOPICS.EVENTS_ALL, `ehs-${req.params.id}`, { event: 'ehs.incident.updated', id: req.params.id, status, userId: req.user.id })
  res.json({ success: true })
}))

// Departments dropdown
router.get('/departments', requireAuth, ar(async (req, res) => {
  const { rows } = await pool.query('SELECT id, name FROM departments ORDER BY name')
  res.json({ success: true, data: rows })
}))

module.exports = router
