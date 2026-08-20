require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const pool = require('../src/db/pool');

async function diagnose() {
  console.log('--- Diagnosing Database Queries ---');
  
  try {
    console.log('1. Testing GET /api/indent query...');
    const { rows } = await pool.query(`
      SELECT i.id, i.indent_number as "indentNumber", i.date, i.priority, i.status,
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
       ORDER BY i.created_at DESC LIMIT 25 OFFSET 0
    `);
    console.log('  -> SUCCESS: retrieved', rows.length, 'indents');
  } catch (err) {
    console.error('  -> FAILED GET /api/indent:', err.message);
  }

  try {
    console.log('2. Testing GET /api/indent/:id query...');
    const { rows: first } = await pool.query('SELECT id FROM indents LIMIT 1');
    if (first.length) {
      const id = first[0].id;
      const { rows } = await pool.query(`
        SELECT i.*, i.created_at as "raisedAt",
                i.cancellation_reason as "cancellationReason", i.cancelled_at as "cancelledAt",
                cu.name as "cancelledByName", cu.employee_code as "cancelledByEmpCode",
                d.name as "deptName", d.code as "deptCode",
                u.name as "raisedByName", u.name as "raisedBy", u.employee_code as "raisedByEmpCode",
                r.name as "raisedByRole", u.email as "raisedByEmail", u.mobile as "raisedByMobile",
                ps.section_code as "sectionCode", ps.name as "sectionName",
                mch.name as "machineName", mch.code as "machineCode", mch.type as "machineType"
         FROM indents i
         LEFT JOIN departments d ON d.id=i.department_id
         LEFT JOIN users u ON u.id=i.raised_by
         LEFT JOIN roles r ON r.id=u.role_id
         LEFT JOIN users cu ON cu.id=i.cancelled_by
         LEFT JOIN plant_sections ps ON ps.id=i.section_id
         LEFT JOIN machines mch ON mch.id=i.machine_id
         WHERE i.id=$1
      `, [id]);
      console.log('  -> SUCCESS: retrieved indent', rows[0]?.indent_number);
    }
  } catch (err) {
    console.error('  -> FAILED GET /api/indent/:id:', err.message);
  }

  try {
    console.log('3. Testing Analytics query...');
    const [summary, byDept, topParts, pending_ack] = await Promise.all([
      pool.query(`SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER(WHERE status='Draft') AS draft,
        COUNT(*) FILTER(WHERE status='Submitted') AS submitted,
        COUNT(*) FILTER(WHERE status IN('L1 Approved','L2 Approved','Approved')) AS approved,
        COUNT(*) FILTER(WHERE status='Partially Issued') AS partially_issued,
        COUNT(*) FILTER(WHERE status='Issued') AS issued,
        COUNT(*) FILTER(WHERE status='Closed') AS closed,
        COUNT(*) FILTER(WHERE status='Cancelled') AS cancelled,
        COALESCE(SUM(total_value) FILTER(WHERE status='Closed'),0) AS closed_value,
        COALESCE(SUM(total_value),0) AS total_value
        FROM indents i WHERE 1=1`),
      pool.query(`SELECT d.name AS dept, COUNT(*) AS indents,
        COALESCE(SUM(i.total_value),0) AS value
        FROM indents i JOIN departments d ON d.id=i.department_id WHERE 1=1
        GROUP BY d.name ORDER BY value DESC LIMIT 10`),
      pool.query(`SELECT m.name AS part, SUM(ii.issued_qty) AS qty, SUM(ii.line_value) AS value
        FROM indent_items ii JOIN materials m ON m.id=ii.material_id
        JOIN indents i ON i.id=ii.indent_id WHERE i.status IN('Issued','Partially Issued','Closed')
        GROUP BY m.name ORDER BY value DESC LIMIT 10`),
      pool.query(`SELECT COUNT(*) AS cnt FROM indent_items WHERE ack_status='pending'`)
    ]);
    console.log('  -> SUCCESS: summary data', summary.rows[0]);
  } catch (err) {
    console.error('  -> FAILED Analytics:', err.message);
  }

  try {
    console.log('4. Testing Reports Indents query...');
    const indentsRes = await pool.query(`
      SELECT i.id, i.indent_number AS "indentNumber", i.date, i.status, i.priority,
             i.total_value AS "totalValue", i.remarks, i.created_at AS "raisedAt",
             i.cancellation_reason AS "cancellationReason", i.cancelled_at AS "cancelledAt",
             cu.name AS "cancelledByName", cu.employee_code AS "cancelledByEmpCode",
             d.name AS department, d.code AS "deptCode",
             u.name AS "raisedBy", u.employee_code AS "raisedByEmpCode",
             r.name AS "raisedByRole", u.email AS "raisedByEmail",
             ps.section_code AS "sectionCode", ps.name AS "sectionName",
             mch.name AS "machineName", mch.code AS "machineCode",
             (SELECT STRING_AGG(ii.purpose, ' | ') FROM indent_items ii WHERE ii.indent_id = i.id) AS "technicalPurposes",
             (SELECT STRING_AGG(DISTINCT ii.reason_code, ', ') FROM indent_items ii WHERE ii.indent_id = i.id) AS "reasonCodes",
             (SELECT COUNT(*) FROM indent_items ii WHERE ii.indent_id = i.id)::int AS "itemCount"
      FROM indents i
      LEFT JOIN departments d ON d.id = i.department_id
      LEFT JOIN users u ON u.id = i.raised_by
      LEFT JOIN roles r ON r.id = u.role_id
      LEFT JOIN users cu ON cu.id = i.cancelled_by
      LEFT JOIN plant_sections ps ON ps.id = i.section_id
      LEFT JOIN machines mch ON mch.id = i.machine_id
      ORDER BY i.created_at DESC
      LIMIT 500
    `);
    console.log('  -> SUCCESS: reports indents count', indentsRes.rows.length);
  } catch (err) {
    console.error('  -> FAILED Reports query:', err.message);
  }

  try {
    console.log('5. Testing Master Materials query...');
    const { rows: mats } = await pool.query(`
      SELECT m.*, mc.name as "category_name"
      FROM materials m
      LEFT JOIN material_categories mc ON mc.id = m.category_id
      ORDER BY m.name ASC
      LIMIT 100
    `);
    console.log('  -> SUCCESS: materials count', mats.length);
  } catch (err) {
    console.error('  -> FAILED Materials query:', err.message);
  }

  pool.end();
}

diagnose();
