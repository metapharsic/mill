const pool = require('../src/db/pool');

async function test() {
  const { rows } = await pool.query(`
    SELECT i.id, i.indent_number as "indentNumber", i.date, i.required_date as "requiredDate",
           i.status, i.priority, i.remarks, i.total_value as "totalValue",
           d.name as "deptName", d.code as "deptCode",
           u.name as "raisedByName", u.employee_code as "raisedByEmpCode",
           po.id as "linkedPoId", po.po_number as "linkedPoNumber", po.status as "linkedPoStatus",
           (SELECT COUNT(*) FROM indent_items ii WHERE ii.indent_id = i.id) as "itemCount",
           COALESCE((
             SELECT json_agg(json_build_object(
               'id', ii.id,
               'material_id', ii.material_id,
               'materialName', m.name,
               'materialCode', m.code,
               'required_qty', ii.required_qty,
               'approved_qty', ii.approved_qty,
               'uom', COALESCE(ii.uom, m.uom),
               'unit_price', COALESCE(m.unit_price, 0),
               'current_stock', COALESCE(m.current_stock, 0),
               'component_position', ii.component_position,
               'reason_code', ii.reason_code,
               'purpose', ii.purpose
             ))
             FROM indent_items ii
             LEFT JOIN materials m ON m.id = ii.material_id
             WHERE ii.indent_id = i.id
           ), '[]'::json) as items
    FROM indents i
    LEFT JOIN departments d ON d.id = i.department_id
    LEFT JOIN users u ON u.id = i.raised_by
    LEFT JOIN purchase_orders po ON po.indent_id = i.id AND po.status != 'Cancelled'
    WHERE i.status NOT IN ('Closed', 'Cancelled', 'Rejected')
    ORDER BY CASE WHEN po.id IS NULL THEN 0 ELSE 1 END ASC, i.created_at DESC
  `);
  console.log('Pending Indents Result:');
  console.log(JSON.stringify(rows, null, 2));
  await pool.end();
}

test().catch(console.error);
