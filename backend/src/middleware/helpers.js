const pool = require('../db/pool');
const { auth: requireAuth, requireLevel, requireStore, requireStoreManager } = require('./auth');

// IMPORTANT: forward to next(err) — do NOT respond here. Several routers that import this ar()
// (master.js, store.js) define their own `router.use((err,req,res,next) => ...)` error middleware
// at the bottom of the file to translate specific DB errors (e.g. Postgres 23505 unique-violation
// -> a friendly 409 "Duplicate record"/"Record already exists"). Responding directly from ar()
// swallows the error before it ever reaches that middleware, making it permanently dead code and
// downgrading every conflict to a generic 500. This matches the `.catch(next)` convention already
// used by the local `ar`/`asyncRoute` helpers in purchase.js, finance.js, and inventory.js.
const ar = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

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

module.exports = { pool, requireAuth, requireLevel, requireStore, requireStoreManager, ar, audit, getVendors, countVendors };
