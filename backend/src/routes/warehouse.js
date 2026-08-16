const express = require('express')
const router = express.Router()
const { pool, requireAuth, requireLevel, ar } = require('../middleware/helpers')

// FG Warehouse — reels in warehouse
router.get('/reels', requireAuth, ar(async (req, res) => {
  const { gradeId, from, to } = req.query
  let where = [`r.status = 'In Warehouse'`]; const vals = []
  if (gradeId) { vals.push(gradeId); where.push(`r.grade_id = $${vals.length}`) }
  if (from) { vals.push(from); where.push(`r.created_at::date >= $${vals.length}`) }
  if (to)   { vals.push(to);   where.push(`r.created_at::date <= $${vals.length}`) }
  const { rows } = await pool.query(`
    SELECT r.*, g.name AS gradeName, m.name AS machineName,
           COALESCE(pr.pack_number, NULL) AS packNumber,
           COALESCE(pr.packing_type, NULL) AS packingType
    FROM reels r
    LEFT JOIN grades g ON r.grade_id = g.id
    LEFT JOIN machines m ON r.machine_id = m.id
    LEFT JOIN packing_records pr ON pr.reel_id = r.id
    WHERE ${where.join(' AND ')} ORDER BY r.created_at DESC LIMIT 500
  `, vals)
  const summary = await pool.query(`
    SELECT COUNT(*) AS totalReels, COALESCE(SUM(r.weight_kg),0) AS totalWeight,
           COUNT(DISTINCT r.grade_id) AS grades
    FROM reels r WHERE r.status = 'In Warehouse'
  `)
  res.json({ success: true, data: rows, summary: summary.rows[0] })
}))

// Packing records
router.get('/packing', requireAuth, ar(async (req, res) => {
  const { from, to } = req.query
  let where = ['1=1']; const vals = []
  if (from) { vals.push(from); where.push(`pr.date >= $${vals.length}`) }
  if (to)   { vals.push(to);   where.push(`pr.date <= $${vals.length}`) }
  const { rows } = await pool.query(`
    SELECT pr.*, r.reel_number, g.name AS gradeName, u.name AS packedByName
    FROM packing_records pr
    LEFT JOIN reels r ON pr.reel_id = r.id
    LEFT JOIN grades g ON r.grade_id = g.id
    LEFT JOIN users u ON pr.packed_by = u.id
    WHERE ${where.join(' AND ')} ORDER BY pr.created_at DESC LIMIT 200
  `, vals)
  res.json({ success: true, data: rows })
}))

router.post('/packing', requireAuth, ar(async (req, res) => {
  const { reelId, packingType, wrapMaterial, netWeightKg, grossWeightKg, remarks } = req.body
  const d = new Date()
  const seq = await pool.query('SELECT COUNT(*)+1 AS n FROM packing_records WHERE date::date = CURRENT_DATE')
  const num = `PACK-${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}-${String(seq.rows[0].n).padStart(4,'0')}`
  const { rows } = await pool.query(`
    INSERT INTO packing_records (pack_number,reel_id,packing_type,wrap_material,net_weight_kg,gross_weight_kg,packed_by,remarks)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id
  `, [num, reelId, packingType, wrapMaterial, netWeightKg, grossWeightKg, req.user.id, remarks])
  res.json({ success: true, data: { id: rows[0].id, packNumber: num } })
}))

router.put('/packing/:id/label', requireAuth, ar(async (req, res) => {
  await pool.query('UPDATE packing_records SET label_printed=true WHERE id=$1', [req.params.id])
  res.json({ success: true })
}))

// Grades dropdown
router.get('/grades', requireAuth, ar(async (req, res) => {
  const { rows } = await pool.query('SELECT id, name, code FROM grades WHERE is_active=true ORDER BY name')
  res.json({ success: true, data: rows })
}))

module.exports = router
