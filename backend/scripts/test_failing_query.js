const pool = require('../src/db/pool');

async function testFixedQuery() {
  const f = '2026-08-01', t = '2026-08-26';
  try {
    const res = await pool.query(`
      SELECT DISTINCT
        m.id AS "materialId",
        m.code AS "materialCode",
        m.name AS "materialName",
        m.uom,
        m.hsn_code AS "hsnCode",
        m.current_stock::numeric(12,3) AS "currentStock",
        m.min_stock::numeric(12,3) AS "minStock",
        m.reorder_level::numeric(12,3) AS "reorderLevel",
        m.unit_price::numeric(12,2) AS "unitPrice",
        (m.current_stock * m.unit_price)::numeric(15,2) AS "stockValuation",
        m.bin_location AS "binLocation",
        mc.name AS "categoryName",
        ps.id AS "sectionId",
        ps.name AS "sectionName",
        ps.section_code AS "sectionCode",
        ps.icon AS "sectionIcon",
        d.name AS "departmentName",
        mac.id AS "machineId",
        mac.name AS "machineName",
        se.id AS "equipmentId",
        se.equipment_name AS "equipmentName",
        se.equipment_type AS "equipmentType",
        se.tag_name AS "tagName",
        se.bearing_size AS "bearingSize",
        se.lock_nut AS "lockNut",
        se.washer,
        se.belt_no AS "beltNo",
        se.shaft_size AS "shaftSize",
        COALESCE(moves.consumed_qty, 0)::numeric(12,3) AS "consumedQty",
        COALESCE(moves.consumed_val, 0)::numeric(15,2) AS "consumedValue",
        COALESCE(moves.inward_qty, 0)::numeric(12,3) AS "inwardQty",
        COALESCE(moves.inward_val, 0)::numeric(15,2) AS "inwardValue",
        moves.last_txn_date AS "lastTxnDate"
      FROM materials m
      LEFT JOIN material_categories mc ON m.category_id = mc.id
      LEFT JOIN material_sections ms ON ms.material_id = m.id
      LEFT JOIN plant_sections ps ON (m.section_id = ps.id OR ms.section_id = ps.id)
      LEFT JOIN departments d ON ps.department_id = d.id
      LEFT JOIN material_equipment me ON me.material_id = m.id
      LEFT JOIN machines mac ON (m.machine_id = mac.id OR me.machine_id = mac.id)
      LEFT JOIN section_equipment se ON (m.section_equipment_id = se.id OR me.section_equipment_id = se.id)
      LEFT JOIN LATERAL (
        SELECT 
          COALESCE(SUM(sl.out_qty), 0) AS consumed_qty,
          COALESCE(SUM(sl.value) FILTER (WHERE sl.out_qty > 0), 0) AS consumed_val,
          COALESCE(SUM(sl.in_qty), 0) AS inward_qty,
          COALESCE(SUM(sl.value) FILTER (WHERE sl.in_qty > 0), 0) AS inward_val,
          MAX(sl.date) AS last_txn_date
        FROM stock_ledger sl
        WHERE sl.material_id = m.id AND sl.date BETWEEN '${f}' AND '${t}'
      ) moves ON true
      WHERE m.is_active = true
      ORDER BY "sectionName" ASC NULLS LAST, "machineName" ASC NULLS LAST, "stockValuation" DESC
      LIMIT 2000
    `);
    console.log('✅ FIXED QUERY SUCCEEDED! Total rows returned:', res.rowCount);
  } catch (err) {
    console.error('❌ QUERY STILL FAILED:', err.message);
  } finally {
    process.exit(0);
  }
}

testFixedQuery();
