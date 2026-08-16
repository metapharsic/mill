const pool = require('../src/db/pool');

async function testAll() {
  const d = '2026-08-13';
  const indentsByDeptRes = await pool.query(`
    SELECT d.id AS dept_id, d.name AS dept_name, d.code AS dept_code,
           COUNT(i.id) AS total_indents,
           COALESCE(SUM(i.total_value), 0) AS total_indent_value,
           COALESCE(SUM(CASE WHEN i.status IN ('Issued', 'Partially Issued') THEN 1 ELSE 0 END), 0) AS issued_count,
           COALESCE(SUM(CASE WHEN i.status = 'Approved' THEN 1 ELSE 0 END), 0) AS approved_count,
           COALESCE(SUM(CASE WHEN i.status = 'Submitted' THEN 1 ELSE 0 END), 0) AS pending_count
    FROM departments d
    JOIN indents i ON d.id = i.department_id AND (DATE(i.date) = $1 OR DATE(i.created_at) = $1)
    GROUP BY d.id, d.name, d.code
    ORDER BY total_indent_value DESC, total_indents DESC
  `, [d]);

  const indentsListRes = await pool.query(`
    SELECT i.id, i.indent_number, i.status, i.priority, i.total_value, i.date, i.created_at,
           d.name AS dept_name, d.code AS dept_code,
           u.name AS raised_by_name,
           COUNT(ii.id) AS items_count
    FROM indents i
    JOIN departments d ON i.department_id = d.id
    LEFT JOIN users u ON i.raised_by = u.id
    LEFT JOIN indent_items ii ON i.id = ii.indent_id
    WHERE DATE(i.date) = $1 OR DATE(i.created_at) = $1
    GROUP BY i.id, i.indent_number, i.status, i.priority, i.total_value, i.date, i.created_at, d.name, d.code, u.name
    ORDER BY i.id DESC
  `, [d]);

  const categoryStoreRes = await pool.query(`
    SELECT COALESCE(mc.name, 'General / Consumables') AS category_name,
           COALESCE(mc.type, 'Store') AS store_type,
           COUNT(sl.id) FILTER (WHERE sl.out_qty > 0) AS items_issued_count,
           COALESCE(SUM(sl.out_qty), 0) AS outward_qty,
           COALESCE(SUM(sl.value) FILTER (WHERE sl.out_qty > 0), 0) AS outward_value,
           COUNT(sl.id) FILTER (WHERE sl.in_qty > 0) AS items_received_count,
           COALESCE(SUM(sl.in_qty), 0) AS inward_qty,
           COALESCE(SUM(sl.value) FILTER (WHERE sl.in_qty > 0), 0) AS inward_value
    FROM stock_ledger sl
    JOIN materials m ON sl.material_id = m.id
    LEFT JOIN material_categories mc ON m.category_id = mc.id
    WHERE sl.date = $1
    GROUP BY mc.name, mc.type
    ORDER BY outward_value DESC, inward_value DESC
  `, [d]);

  const purchaseOrdersRes = await pool.query(`
    SELECT po.id, po.po_number, po.status, po.total_value, po.grand_total, po.date,
           v.name AS vendor_name, v.code AS vendor_code,
           COUNT(poi.id) AS items_count
    FROM purchase_orders po
    LEFT JOIN vendors v ON po.vendor_id = v.id
    LEFT JOIN po_items poi ON po.id = poi.po_id
    WHERE DATE(po.date) = $1 OR DATE(po.created_at) = $1
    GROUP BY po.id, po.po_number, po.status, po.total_value, po.grand_total, po.date, v.name, v.code
    ORDER BY po.id DESC
  `, [d]);

  const inwardGrnRes = await pool.query(`
    SELECT sl.id, sl.date, sl.in_qty, sl.value, sl.batch_number, sl.remarks,
           m.code AS mat_code, m.name AS mat_name, m.uom,
           v.name AS vendor_name,
           po.po_number, po.id AS po_id
    FROM stock_ledger sl
    JOIN materials m ON sl.material_id = m.id
    LEFT JOIN vendors v ON sl.vendor_id = v.id
    LEFT JOIN purchase_orders po ON sl.reference_type = 'PO' AND sl.reference_id = po.id
    WHERE sl.date = $1 AND sl.transaction_type IN ('grn', 'in')
    ORDER BY sl.id DESC
  `, [d]);

  const outwardIssuesRes = await pool.query(`
    SELECT sl.id, sl.date, sl.out_qty, sl.value, sl.remarks,
           m.code AS mat_code, m.name AS mat_name, m.uom,
           COALESCE(d.name, (
             SELECT d2.name FROM indents ind JOIN departments d2 ON ind.department_id = d2.id
             WHERE ind.id = sl.reference_id AND sl.reference_type = 'INDENT' LIMIT 1
           ), 'General Mill') AS dept_name
    FROM stock_ledger sl
    JOIN materials m ON sl.material_id = m.id
    LEFT JOIN store_issues si ON sl.reference_type = 'ISSUE' AND sl.reference_id = si.id
    LEFT JOIN departments d ON si.department_id = d.id
    WHERE sl.date = $1 AND sl.transaction_type IN ('issue', 'out')
    ORDER BY sl.id DESC
  `, [d]);

  console.log('Indents by dept count:', indentsByDeptRes.rows.length);
  console.log('Indents list count:', indentsListRes.rows.length);
  console.log('Category store count:', categoryStoreRes.rows.length);
  console.log('Purchase orders count:', purchaseOrdersRes.rows.length);
  console.log('Inward GRN count:', inwardGrnRes.rows.length);
  console.log('Outward issues count:', outwardIssuesRes.rows.length);
  await pool.end();
}

testAll().catch(e => { console.error(e); pool.end(); });
