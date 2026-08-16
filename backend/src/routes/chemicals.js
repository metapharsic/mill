/**
 * /api/chemicals — chemical inventory, picking, and sales integration
 * Columns verified against live DB schema.
 */
const express = require('express')
const router = express.Router()
const { pool, requireAuth, requireLevel, requireStore, ar } = require('../middleware/helpers')

// GET /api/chemicals
router.get('/', requireAuth, ar(async (req, res) => {
  const { search, lowstock, section } = req.query
  let where = [`mc.code = 'CHEM'`, `m.is_active = true`]
  const vals = []

  if (search) {
    vals.push(`%${search}%`)
    where.push(`(m.name ILIKE $${vals.length} OR m.code ILIKE $${vals.length} OR m.hsn_code ILIKE $${vals.length})`)
  }
  if (lowstock === '1') where.push(`m.current_stock <= m.min_stock`)
  if (section) {
    vals.push(`%${section}%`)
    where.push(`m.section_context ILIKE $${vals.length}`)
  }

  const { rows } = await pool.query(`
    SELECT m.id, m.code, m.name, m.uom, m.hsn_code,
           m.current_stock       AS "currentStock",
           m.min_stock           AS "minStock",
           m.max_stock           AS "maxStock",
           m.reorder_level       AS "reorderLevel",
           m.reorder_buffer      AS "reorderBuffer",
           m.unit_price          AS "unitPrice",
           m.section_context     AS "sectionContext",
           m.criticality_class   AS "criticalityClass",
           m.procurement_strategy AS "procurementStrategy",
           m.oem_supplier        AS "oemSupplier",
           m.last_audit_cycle    AS "lastAuditCycle",
           m.calibration_protocol AS "calibrationProtocol",
           (m.current_stock * m.unit_price) AS "stockValue",
           (m.current_stock <= m.min_stock) AS "lowStock",
           (m.current_stock = 0)            AS "outOfStock"
    FROM materials m
    JOIN material_categories mc ON m.category_id = mc.id
    WHERE ${where.join(' AND ')}
    ORDER BY m.criticality_class NULLS LAST, m.name
  `, vals)

  res.json({ success: true, data: rows })
}))

// GET /api/chemicals/summary
router.get('/summary', requireAuth, ar(async (req, res) => {
  const { rows } = await pool.query(`
    SELECT
      COUNT(*)                                                        AS total,
      COUNT(*) FILTER (WHERE current_stock <= min_stock AND current_stock > 0) AS low_stock,
      COUNT(*) FILTER (WHERE current_stock = 0)                      AS out_of_stock,
      COUNT(*) FILTER (WHERE criticality_class = 'A')                AS class_a,
      COALESCE(SUM(current_stock * unit_price), 0)                   AS total_value,
      COUNT(*) FILTER (WHERE current_stock > min_stock)              AS adequate
    FROM materials m
    JOIN material_categories mc ON m.category_id = mc.id
    WHERE mc.code = 'CHEM' AND m.is_active = true
  `)
  res.json({ success: true, data: rows[0] })
}))

// GET /api/chemicals/:id/ledger
// stock_ledger real cols: date, transaction_type, in_qty, out_qty, balance, unit_price, reference_id, reference_type, remarks, created_by
router.get('/:id/ledger', requireAuth, ar(async (req, res) => {
  const { rows } = await pool.query(`
    SELECT sl.id,
           sl.transaction_type                        AS type,
           COALESCE(sl.in_qty, 0)                    AS "inQty",
           COALESCE(sl.out_qty, 0)                   AS "outQty",
           COALESCE(sl.in_qty, 0) - COALESCE(sl.out_qty, 0) AS quantity,
           sl.balance,
           sl.unit_price                             AS price,
           sl.date,
           sl.reference_type                         AS "refType",
           sl.reference_id                           AS "refId",
           sl.remarks,
           u.name                                    AS "createdBy"
    FROM stock_ledger sl
    LEFT JOIN users u ON sl.created_by = u.id
    WHERE sl.material_id = $1
    ORDER BY sl.date DESC, sl.id DESC
    LIMIT 100
  `, [req.params.id])
  res.json({ success: true, data: rows })
}))

// POST /api/chemicals/pick — internal production issue
// store_issues real cols: issue_number, issue_date, material_id, department_id, quantity, unit, purpose, issued_by, status, remarks, indent_type
router.post('/pick', requireAuth, requireStore, ar(async (req, res) => {
  const { materialId, quantity, departmentId, purpose, section, remarks } = req.body
  if (!materialId || !quantity || quantity <= 0)
    return res.status(400).json({ success: false, message: 'materialId and quantity required' })

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const { rows: [mat] } = await client.query(
      `SELECT m.id, m.name, m.current_stock, m.unit_price, m.uom, mc.code AS catCode
       FROM materials m JOIN material_categories mc ON m.category_id = mc.id
       WHERE m.id = $1 AND mc.code = 'CHEM' AND m.is_active = true`, [materialId])
    if (!mat) throw new Error('Chemical not found')
    if (parseFloat(mat.current_stock) < parseFloat(quantity))
      throw new Error(`Insufficient stock. Available: ${mat.current_stock} ${mat.uom}`)

    const issueNo = `CHM-ISS-${Date.now()}`

    // store_issues insert with correct column names
    const { rows: [issue] } = await client.query(`
      INSERT INTO store_issues
        (issue_number, material_id, department_id, quantity, unit,
         purpose, remarks, status, issued_by, issue_date, indent_type)
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'approved', $8, CURRENT_DATE, 'chemical')
      RETURNING id, issue_number
    `, [issueNo, materialId, departmentId || null, quantity, mat.uom,
        purpose || `Chemical pick — ${section || 'Production'}`,
        remarks || null, req.user.id])

    // Deduct stock
    await client.query(
      `UPDATE materials SET current_stock = current_stock - $1 WHERE id = $2`,
      [quantity, materialId])

    // Get current balance after deduction
    const { rows: [balRow] } = await client.query(
      `SELECT current_stock FROM materials WHERE id = $1`, [materialId])
    const newBalance = parseFloat(balRow.current_stock)

    // stock_ledger: real cols — date, in_qty, out_qty, balance, unit_price, value, reference_id, reference_type, remarks, created_by
    await client.query(`
      INSERT INTO stock_ledger
        (material_id, transaction_type, out_qty, balance, unit_price, value,
         date, reference_type, remarks, created_by)
      VALUES ($1, 'issue', $2, $3, $4, $5, CURRENT_DATE, 'store_issue', $6, $7)
    `, [materialId, quantity, newBalance, mat.unit_price,
        parseFloat(quantity) * parseFloat(mat.unit_price),
        `Pick: ${purpose || section || 'Production'} | ${remarks || ''}`.trim(),
        req.user.id])

    await client.query('COMMIT')
    res.json({ success: true, data: { issueId: issue.id, issueNo: issue.issue_number } })
  } catch (e) {
    await client.query('ROLLBACK')
    res.status(400).json({ success: false, message: e.message })
  } finally { client.release() }
}))

// POST /api/chemicals/sales-pick — pick for sales order
// sales_orders real cols: so_number, date, customer_id, status, total_value, remarks, created_by
router.post('/sales-pick', requireAuth, requireLevel(2), requireStore, ar(async (req, res) => {
  const { materialId, quantity, unitPrice, customerId, remarks } = req.body
  if (!materialId || !quantity || quantity <= 0)
    return res.status(400).json({ success: false, message: 'materialId and quantity required' })

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const { rows: [mat] } = await client.query(
      `SELECT m.id, m.name, m.current_stock, m.unit_price, m.uom, m.hsn_code, mc.code AS catCode
       FROM materials m JOIN material_categories mc ON m.category_id = mc.id
       WHERE m.id = $1 AND mc.code = 'CHEM' AND m.is_active = true`, [materialId])
    if (!mat) throw new Error('Chemical not found')
    if (parseFloat(mat.current_stock) < parseFloat(quantity))
      throw new Error(`Insufficient stock. Available: ${mat.current_stock} ${mat.uom}`)

    const salePrice = parseFloat(unitPrice) || parseFloat(mat.unit_price)
    const lineTotal = salePrice * parseFloat(quantity)

    const soNo = `SO-CHM-${Date.now()}`
    const { rows: [so] } = await client.query(`
      INSERT INTO sales_orders
        (so_number, date, customer_id, status, total_value, remarks, created_by)
      VALUES ($1, CURRENT_DATE, $2, 'Pending', $3, $4, $5)
      RETURNING id
    `, [soNo, customerId || null, lineTotal,
        remarks || `Chemical sale: ${mat.name}`, req.user.id])

    // Deduct stock
    await client.query(`UPDATE materials SET current_stock = current_stock - $1 WHERE id = $2`,
      [quantity, materialId])

    const { rows: [balRow] } = await client.query(
      `SELECT current_stock FROM materials WHERE id = $1`, [materialId])
    const newBalance = parseFloat(balRow.current_stock)

    await client.query(`
      INSERT INTO stock_ledger
        (material_id, transaction_type, out_qty, balance, unit_price, value,
         date, reference_type, remarks, created_by)
      VALUES ($1, 'sale', $2, $3, $4, $5, CURRENT_DATE, 'sales_order', $6, $7)
    `, [materialId, quantity, newBalance, salePrice, lineTotal,
        `Sales: ${mat.name} | SO ${soNo}`, req.user.id])

    await client.query('COMMIT')
    res.json({ success: true, data: { salesOrderId: so.id, soNumber: soNo } })
  } catch (e) {
    await client.query('ROLLBACK')
    res.status(400).json({ success: false, message: e.message })
  } finally { client.release() }
}))

// POST /api/chemicals/receipt — restock
router.post('/receipt', requireAuth, requireStore, ar(async (req, res) => {
  const { materialId, quantity, unitPrice, supplierName, invoiceNo, remarks } = req.body
  if (!materialId || !quantity || quantity <= 0)
    return res.status(400).json({ success: false, message: 'materialId and quantity required' })

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const { rows: [mat] } = await client.query(
      `SELECT m.id, m.unit_price FROM materials m
       JOIN material_categories mc ON m.category_id = mc.id
       WHERE m.id = $1 AND mc.code = 'CHEM'`, [materialId])
    if (!mat) throw new Error('Chemical not found')

    const price = parseFloat(unitPrice) || parseFloat(mat.unit_price)
    const refNo = invoiceNo || `CHM-RCT-${Date.now()}`

    await client.query(
      `UPDATE materials SET current_stock = current_stock + $1, unit_price = $2 WHERE id = $3`,
      [quantity, price, materialId])

    const { rows: [balRow] } = await client.query(
      `SELECT current_stock FROM materials WHERE id = $1`, [materialId])
    const newBalance = parseFloat(balRow.current_stock)

    await client.query(`
      INSERT INTO stock_ledger
        (material_id, transaction_type, in_qty, balance, unit_price, value,
         date, reference_type, remarks, created_by)
      VALUES ($1, 'receipt', $2, $3, $4, $5, CURRENT_DATE, 'manual_receipt', $6, $7)
    `, [materialId, quantity, newBalance, price,
        parseFloat(quantity) * price,
        `Receipt: ${supplierName || 'Direct'} | ${refNo} | ${remarks || ''}`.trim(),
        req.user.id])

    await client.query('COMMIT')
    res.json({ success: true, data: { ref: refNo } })
  } catch (e) {
    await client.query('ROLLBACK')
    res.status(400).json({ success: false, message: e.message })
  } finally { client.release() }
}))

// GET /api/chemicals/departments — for pick form dropdown
router.get('/departments', requireAuth, ar(async (req, res) => {
  const { rows } = await pool.query(`SELECT id, name FROM departments ORDER BY name`)
  res.json({ success: true, data: rows })
}))

// GET /api/chemicals/customers — for sales pick dropdown
router.get('/customers', requireAuth, ar(async (req, res) => {
  const { rows } = await pool.query(`SELECT id, name FROM customers WHERE is_active = true ORDER BY name`)
  res.json({ success: true, data: rows })
}))

module.exports = router
