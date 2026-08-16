const pool = require('../src/db/pool');

async function testDailySummary(d) {
  console.log(`Checking daily summary for ${d}...`);

  // 1. Indents by Department
  const indentsByDept = await pool.query(`
    SELECT d.id AS dept_id, d.name AS dept_name, d.code AS dept_code,
           COUNT(i.id) AS total_indents,
           COALESCE(SUM(i.total_value), 0) AS total_indent_value,
           COALESCE(SUM(CASE WHEN i.status IN ('Issued', 'Partially Issued') THEN 1 ELSE 0 END), 0) AS issued_count,
           COALESCE(SUM(CASE WHEN i.status = 'Approved' THEN 1 ELSE 0 END), 0) AS approved_count,
           COALESCE(SUM(CASE WHEN i.status = 'Submitted' THEN 1 ELSE 0 END), 0) AS pending_count
    FROM departments d
    LEFT JOIN indents i ON d.id = i.department_id AND (DATE(i.date) = $1 OR DATE(i.created_at) = $1)
    GROUP BY d.id, d.name, d.code
    HAVING COUNT(i.id) > 0
    ORDER BY total_indent_value DESC, total_indents DESC
  `, [d]);
  console.log('\n--- Indents by Department ---');
  console.table(indentsByDept.rows);

  // 2. Category-Wise Store Issuance & Inward
  const catSummary = await pool.query(`
    SELECT COALESCE(mc.name, 'Uncategorized') AS category_name,
           mc.type AS store_type,
           COALESCE(SUM(sl.in_qty), 0) AS inward_qty,
           COALESCE(SUM(sl.out_qty), 0) AS outward_qty,
           COALESCE(SUM(sl.value) FILTER (WHERE sl.out_qty > 0), 0) AS outward_value,
           COALESCE(SUM(sl.value) FILTER (WHERE sl.in_qty > 0), 0) AS inward_value
    FROM stock_ledger sl
    JOIN materials m ON sl.material_id = m.id
    LEFT JOIN material_categories mc ON m.category_id = mc.id
    WHERE sl.date = $1
    GROUP BY mc.name, mc.type
    ORDER BY outward_value DESC, inward_value DESC
  `, [d]);
  console.log('\n--- Category-Wise Store Movements ---');
  console.table(catSummary.rows);

  // 3. Purchase Orders Done on Date
  const poSummary = await pool.query(`
    SELECT po.id, po.po_number, po.status, po.total_value, po.grand_total,
           v.name AS vendor_name,
           COUNT(poi.id) AS items_count
    FROM purchase_orders po
    LEFT JOIN vendors v ON po.vendor_id = v.id
    LEFT JOIN po_items poi ON po.id = poi.po_id
    WHERE DATE(po.date) = $1 OR DATE(po.created_at) = $1
    GROUP BY po.id, po.po_number, po.status, po.total_value, po.grand_total, v.name
    ORDER BY po.id DESC
  `, [d]);
  console.log('\n--- Purchase Orders ---');
  console.table(poSummary.rows);

  // 4. GRN / Inward received against PO
  const grnSummary = await pool.query(`
    SELECT sl.id, sl.date, sl.in_qty, sl.value, sl.batch_number, sl.remarks,
           m.code AS mat_code, m.name AS mat_name, m.uom,
           v.name AS vendor_name,
           po.po_number
    FROM stock_ledger sl
    JOIN materials m ON sl.material_id = m.id
    LEFT JOIN vendors v ON sl.vendor_id = v.id
    LEFT JOIN purchase_orders po ON sl.reference_type = 'PO' AND sl.reference_id = po.id
    WHERE sl.date = $1 AND sl.transaction_type IN ('grn', 'in')
    ORDER BY sl.id DESC
  `, [d]);
  console.log('\n--- Inward GRN Receipts ---');
  console.table(grnSummary.rows);

  // 5. Outward Issues on Date
  const outwardSummary = await pool.query(`
    SELECT sl.id, sl.date, sl.out_qty, sl.value, sl.remarks,
           m.code AS mat_code, m.name AS mat_name, m.uom,
           d.name AS dept_name
    FROM stock_ledger sl
    JOIN materials m ON sl.material_id = m.id
    LEFT JOIN store_issues si ON sl.reference_type = 'ISSUE' AND sl.reference_id = si.id
    LEFT JOIN departments d ON si.department_id = d.id
    WHERE sl.date = $1 AND sl.transaction_type IN ('issue', 'out')
    ORDER BY sl.id DESC
  `, [d]);
  console.log('\n--- Outward Issues ---');
  console.table(outwardSummary.rows);

  await pool.end();
}

const target = process.argv[2] || new Date().toISOString().slice(0, 10);
testDailySummary(target).catch(console.error);
