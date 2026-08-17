const pool = require('../src/db/pool');

async function test() {
  const page = 1, limit = 25, offset = 0;
  const where = '';
  const params = [];
  const p = 1;

  const { rows } = await pool.query(
    `SELECT i.id, i.indent_number as "indentNumber", i.date, i.priority, i.status,
            i.required_date as "requiredDate", i.remarks, i.raised_by, i.section_id as "sectionId",
            i.machine_id as "machineId", i.created_at as "raisedAt",
            i.cancellation_reason as "cancellationReason", i.cancelled_at as "cancelledAt",
            cu.name as "cancelledByName", cu.employee_code as "cancelledByEmpCode",
            ps.section_code as "sectionCode", ps.name as "sectionName",
            mch.name as "machineName", mch.code as "machineCode", mch.type as "machineType",
            COALESCE(NULLIF(i.total_value, 0), (SELECT SUM(ii.required_qty * COALESCE(m.unit_price, 0)) FROM indent_items ii LEFT JOIN materials m ON m.id = ii.material_id WHERE ii.indent_id = i.id)) as "total_value",
            d.name as "deptName", d.code as "deptCode",
            u.name as "raisedBy", u.name as "raisedByName", u.employee_code as "raisedByEmpCode",
            r.name as "raisedByRole", u.email as "raisedByEmail", u.mobile as "raisedByMobile",
            po.id as "linkedPoId", po.po_number as "linkedPoNumber", po.status as "linkedPoStatus",
            po.grand_total as "linkedPoGrandTotal", v_po.name as "linkedPoVendorName",
            gp.id as "linkedGpId", gp.gp_number as "linkedGpNumber", gp.status as "linkedGpStatus", gp.pass_type as "linkedGpType",
            cp.id as "linkedCpId", cp.voucher_number as "linkedCpNumber", cp.total_amount as "linkedCpTotalAmount", cp.vendor_name as "linkedCpVendorName",
            (SELECT ii.reason_code FROM indent_items ii WHERE ii.indent_id = i.id ORDER BY ii.id ASC LIMIT 1) AS "reasonCode",
            (SELECT ii.purpose FROM indent_items ii WHERE ii.indent_id = i.id ORDER BY ii.id ASC LIMIT 1) AS "itemPurpose",
            (SELECT COUNT(*) FROM indent_items ii WHERE ii.indent_id = i.id)::int AS "itemCount"
     FROM indents i
     LEFT JOIN departments d ON d.id=i.department_id
     LEFT JOIN users u ON u.id=i.raised_by
     LEFT JOIN roles r ON r.id=u.role_id
     LEFT JOIN users cu ON cu.id=i.cancelled_by
     LEFT JOIN plant_sections ps ON ps.id=i.section_id
     LEFT JOIN machines mch ON mch.id=i.machine_id
     LEFT JOIN purchase_orders po ON po.indent_id=i.id
     LEFT JOIN vendors v_po ON v_po.id=po.vendor_id
     LEFT JOIN gate_passes gp ON (gp.remarks ILIKE '%' || i.indent_number || '%' OR (gp.po_id IS NOT NULL AND gp.po_id = po.id))
     LEFT JOIN cash_purchases cp ON cp.indent_id = i.id
     ${where} ORDER BY i.created_at DESC LIMIT $${p} OFFSET $${p+1}`,
    [...params, parseInt(limit), offset]
  );
  console.log(`Returned ${rows.length} rows`);
  rows.forEach(r => console.log(`- ${r.indentNumber} (${r.status}) Dept: ${r.deptName} Value: ${r.total_value}`));
  await pool.end();
}

test().catch(console.error);
