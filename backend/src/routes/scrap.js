const express = require('express')
const router = express.Router()
const { pool, requireAuth, requireLevel, ar } = require('../middleware/helpers')

router.get('/', requireAuth, ar(async (req, res) => {
  const { from, to, status } = req.query
  let where = ['1=1']; const vals = []
  if (from) { vals.push(from); where.push(`date >= $${vals.length}`) }
  if (to)   { vals.push(to);   where.push(`date <= $${vals.length}`) }
  if (status) { vals.push(status); where.push(`status = $${vals.length}`) }
  const { rows } = await pool.query(`
    SELECT s.*, d.name AS "departmentName", u.name AS "recordedByName"
    FROM scrap_records s
    LEFT JOIN departments d ON s.source_department_id = d.id
    LEFT JOIN users u ON s.recorded_by = u.id
    WHERE ${where.join(' AND ')} ORDER BY s.created_at DESC LIMIT 200
  `, vals)
  res.json({ success: true, data: rows })
}))

router.post('/', requireAuth, requireLevel(2), ar(async (req, res) => {
  const { scrapType, sourceDepartmentId, quantityKg, description, disposalMethod, buyerName, saleAmount, remarks } = req.body
  const d = new Date()
  const stamp = `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [`scr-${stamp}`]) // Doc31 #8
    const seq = await client.query('SELECT COUNT(*)+1 AS n FROM scrap_records WHERE date::date = CURRENT_DATE')
    const num = `SCR-${stamp}-${String(seq.rows[0].n).padStart(4,'0')}`
    const { rows } = await client.query(`
      INSERT INTO scrap_records (scrap_number,scrap_type,source_department_id,quantity_kg,description,disposal_method,buyer_name,sale_amount,recorded_by,remarks)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id
    `, [num, scrapType, sourceDepartmentId, quantityKg, description, disposalMethod, buyerName, saleAmount||0, req.user.id, remarks])
    await client.query('COMMIT')
    res.json({ success: true, data: { id: rows[0].id, scrapNumber: num } })
  } catch (e) { await client.query('ROLLBACK'); throw e }
  finally { client.release() }
}))

router.put('/:id', requireAuth, requireLevel(2), ar(async (req, res) => {
  const { scrapType, quantityKg, description, disposalMethod, buyerName, saleAmount, status, remarks } = req.body
  await pool.query(`
    UPDATE scrap_records SET scrap_type=$1,quantity_kg=$2,description=$3,disposal_method=$4,
    buyer_name=$5,sale_amount=$6,status=$7,remarks=$8 WHERE id=$9
  `, [scrapType, quantityKg, description, disposalMethod, buyerName, saleAmount||0, status, remarks, req.params.id])
  res.json({ success: true })
}))

module.exports = router
