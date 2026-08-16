const express = require('express')
const router = express.Router()
const { pool, requireAuth, requireLevel, ar } = require('../middleware/helpers')
const { publish, TOPICS } = require('../kafka')

router.get('/samples', requireAuth, ar(async (req, res) => {
  const { from, to, sampleType, result } = req.query
  let where = ['1=1']; const vals = []
  if (from) { vals.push(from); where.push(`ls.date >= $${vals.length}`) }
  if (to)   { vals.push(to);   where.push(`ls.date <= $${vals.length}`) }
  if (sampleType) { vals.push(sampleType); where.push(`ls.sample_type = $${vals.length}`) }
  if (result)     { vals.push(result);     where.push(`ls.result = $${vals.length}`) }
  const { rows } = await pool.query(`
    SELECT ls.*, c.name AS "collectedByName", t.name AS "testedByName"
    FROM lab_samples ls
    LEFT JOIN users c ON ls.collected_by = c.id
    LEFT JOIN users t ON ls.tested_by = t.id
    WHERE ${where.join(' AND ')} ORDER BY ls.created_at DESC LIMIT 200
  `, vals)
  const summary = await pool.query(`
    SELECT COUNT(*) AS total,
           COUNT(*) FILTER (WHERE result='Pending') AS pending,
           COUNT(*) FILTER (WHERE result='Pass') AS passed,
           COUNT(*) FILTER (WHERE result='Fail') AS failed
    FROM lab_samples
  `)
  res.json({ success: true, data: rows, summary: summary.rows[0] })
}))

router.post('/samples', requireAuth, ar(async (req, res) => {
  const { sampleType, sourceRef, brightness, opacity, phValue, ashContent, moisture,
          cod, bod, tss, phWater, concentration, purity, remarks } = req.body
  const d = new Date()
  const seq = await pool.query('SELECT COUNT(*)+1 AS n FROM lab_samples WHERE date::date = CURRENT_DATE')
  const num = `LAB-${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}-${String(seq.rows[0].n).padStart(4,'0')}`
  const { rows } = await pool.query(`
    INSERT INTO lab_samples (sample_number,sample_type,source_ref,collected_by,
      brightness,opacity,ph_value,ash_content,moisture,cod,bod,tss,ph_water,concentration,purity,remarks)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING id
  `, [num, sampleType, sourceRef, req.user.id,
      brightness||null, opacity||null, phValue||null, ashContent||null, moisture||null,
      cod||null, bod||null, tss||null, phWater||null, concentration||null, purity||null, remarks])
  publish(TOPICS.LAB, `lab-${rows[0].id}`, { event: 'laboratory.sample.logged', id: rows[0].id, sampleNumber: num, sampleType, userId: req.user.id })
  res.json({ success: true, data: { id: rows[0].id, sampleNumber: num } })
}))

router.put('/samples/:id/result', requireAuth, requireLevel(2), ar(async (req, res) => {
  const { result, remarks } = req.body
  if (!['Pass','Fail'].includes(result)) return res.status(400).json({ success: false, message: 'Invalid result' })
  await pool.query(
    `UPDATE lab_samples SET result=$1, tested_by=$2, remarks=COALESCE($3, remarks) WHERE id=$4`,
    [result, req.user.id, remarks, req.params.id]
  )
  publish(TOPICS.LAB, `lab-${req.params.id}`, { event: 'laboratory.sample.result', id: req.params.id, result, userId: req.user.id })
  res.json({ success: true })
}))

module.exports = router
