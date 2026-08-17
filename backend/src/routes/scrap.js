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
  // Partial update: the edit form does not post `status` at all, so a raw assignment
  // nulled the status column on every edit. COALESCE keeps unsent fields untouched.
  const { rowCount } = await pool.query(`
    UPDATE scrap_records SET
      scrap_type=COALESCE($1,scrap_type),
      quantity_kg=COALESCE($2,quantity_kg),
      description=COALESCE($3,description),
      disposal_method=COALESCE($4,disposal_method),
      buyer_name=COALESCE($5,buyer_name),
      sale_amount=COALESCE($6,sale_amount),
      status=COALESCE($7,status),
      remarks=COALESCE($8,remarks)
    WHERE id=$9
  `, [scrapType ?? null, quantityKg ?? null, description ?? null, disposalMethod ?? null,
      buyerName ?? null, saleAmount ?? null, status ?? null, remarks ?? null, req.params.id])
  if (!rowCount) return res.status(404).json({ success: false, message: 'Scrap record not found' })
  res.json({ success: true })
}))

module.exports = router
