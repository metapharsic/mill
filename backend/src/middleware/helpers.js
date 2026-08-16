const pool = require('../db/pool');
const { auth: requireAuth, requireLevel, requireStore } = require('./auth');

const ar = fn => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(err => {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  });

// Write one row to audit_log. Pass transaction client when inside BEGIN/COMMIT.
async function audit(clientOrNull, { userId, module, action, entityId, oldVal, newVal, ip }) {
  const db = clientOrNull || pool;
  await db.query(
    `INSERT INTO audit_log (user_id, module, action, record_id, old_data, new_data, ip_address)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [userId, module, action, entityId || null,
     oldVal ? JSON.stringify(oldVal) : null,
     newVal ? JSON.stringify(newVal) : null,
     ip || null]
  );
}

// Single source of truth for reading vendor rows. Used by both master.js (GET /api/master/vendors,
// full admin listing) and purchase.js (GET /api/purchase/vendors, dropdown) so the two endpoints can
// never drift on columns, active-filtering, or ordering — they both read through this one query.
// filters: { is_active?: boolean, search?: string, limit?: number, offset?: number }
async function getVendors(filters = {}) {
  const { is_active, search, limit, offset } = filters;
  const w = []; const p = []; let i = 1;
  if (is_active !== undefined) { w.push(`v.is_active=$${i++}`); p.push(is_active); }
  if (search) { w.push(`(v.name ILIKE $${i} OR v.code ILIKE $${i} OR v.gstin ILIKE $${i})`); p.push(`%${search}%`); i++; }
  const where = w.length ? 'WHERE ' + w.join(' AND ') : '';
  let sql = `
    SELECT v.*,
           COALESCE(po_cnt.cnt, 0)::int AS po_count,
           COALESCE(po_cnt.cnt, 0)::int AS "poCount"
    FROM vendors v
    LEFT JOIN (
      SELECT vendor_id, COUNT(*) AS cnt
      FROM purchase_orders
      GROUP BY vendor_id
    ) po_cnt ON po_cnt.vendor_id = v.id
    ${where}
    ORDER BY v.name
  `;
  if (limit !== undefined) { sql += ` LIMIT $${i++}`; p.push(limit); }
  if (offset !== undefined) { sql += ` OFFSET $${i++}`; p.push(offset); }
  const { rows } = await pool.query(sql, p);
  return rows;
}

async function countVendors(filters = {}) {
  const { is_active, search } = filters;
  const w = []; const p = []; let i = 1;
  if (is_active !== undefined) { w.push(`is_active=$${i++}`); p.push(is_active); }
  if (search) { w.push(`(name ILIKE $${i} OR code ILIKE $${i} OR gstin ILIKE $${i})`); p.push(`%${search}%`); i++; }
  const where = w.length ? 'WHERE ' + w.join(' AND ') : '';
  const { rows } = await pool.query(`SELECT COUNT(*) FROM vendors ${where}`, p);
  return parseInt(rows[0].count);
}

module.exports = { pool, requireAuth, requireLevel, requireStore, ar, audit, getVendors, countVendors };
