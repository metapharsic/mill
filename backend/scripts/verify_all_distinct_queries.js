const pool = require('../src/db/pool');

async function verifyAllDistinctQueries() {
  console.log('===============================================================');
  console.log('🚀 MULTI-AGENT VERIFICATION OF ALL DISTINCT & ORDER BY QUERIES');
  console.log('===============================================================');

  const f = '2026-08-01', t = '2026-08-26';

  // 1. Plant Sections Detailed Granular Items Query
  try {
    const res1 = await pool.query(`
      SELECT * FROM (
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
      ) granular_sub
      ORDER BY "sectionName" ASC NULLS LAST, "machineName" ASC NULLS LAST, "stockValuation" DESC
      LIMIT 2000
    `);
    console.log(`  ✅ [PASS] [A_SYNTAX] Plant Sections Detailed Query: ${res1.rowCount} rows returned`);
  } catch (err) {
    console.error(`  ❌ [FAIL] [A_SYNTAX] Plant Sections Detailed Query:`, err.message);
    process.exit(1);
  }

  // 2. Plant Sections Materials Query
  try {
    const { rows: secs } = await pool.query('SELECT id FROM plant_sections LIMIT 1');
    const secId = secs[0]?.id || 1;
    const res2 = await pool.query(`
      SELECT * FROM (
        SELECT DISTINCT m.id, m.code, m.name, m.uom, m.current_stock as "currentStock",
               m.unit_price as "unitPrice", m.min_stock as "minStock", m.reorder_level as "reorderLevel",
               m.criticality_class as "criticalityClass", mc.name as "categoryName",
               COALESCE(ms.is_primary, (m.section_id = ps.id)) as "isPrimary",
               ms.created_at as "mappedAt"
        FROM materials m
        LEFT JOIN material_sections ms ON ms.material_id = m.id AND ms.section_id = $1
        LEFT JOIN plant_sections ps ON ps.id = $1
        LEFT JOIN material_categories mc ON mc.id = m.category_id
        WHERE (ms.section_id = $1 OR m.section_id = $1)
          AND m.is_active = true
      ) sec_mats
      ORDER BY name ASC
    `, [secId]);
    console.log(`  ✅ [PASS] [A_ASSET] Plant Section ${secId} Materials Mapping Query: ${res2.rowCount} rows returned`);
  } catch (err) {
    console.error(`  ❌ [FAIL] [A_ASSET] Plant Section Materials Mapping Query:`, err.message);
    process.exit(1);
  }

  // 3. Machine Materials Query
  try {
    const { rows: macs } = await pool.query('SELECT id FROM machines LIMIT 1');
    const macId = macs[0]?.id || 1;
    const res3 = await pool.query(`
      SELECT * FROM (
        SELECT DISTINCT m.id, m.code, m.name, m.uom, m.current_stock as "currentStock",
               m.unit_price as "unitPrice", mc.name as "categoryName",
               se.equipment_name as "equipmentName", se.tag_name as "tagName",
               me.remarks, me.created_at as "mappedAt"
        FROM materials m
        LEFT JOIN material_equipment me ON me.material_id = m.id AND me.machine_id = $1
        LEFT JOIN section_equipment se ON se.id = me.section_equipment_id
        LEFT JOIN material_categories mc ON mc.id = m.category_id
        WHERE (me.machine_id = $1 OR m.machine_id = $1)
          AND m.is_active = true
      ) mac_mats
      ORDER BY name ASC
    `, [macId]);
    console.log(`  ✅ [PASS] [A_ASSET] Machine ${macId} Materials Mapping Query: ${res3.rowCount} rows returned`);
  } catch (err) {
    console.error(`  ❌ [FAIL] [A_ASSET] Machine Materials Mapping Query:`, err.message);
    process.exit(1);
  }

  console.log('===============================================================');
  console.log('🏁 ALL DISTINCT & ORDER BY QUERIES 100% VALIDATED IN POSTGRESQL');
  console.log('===============================================================');
  process.exit(0);
}

verifyAllDistinctQueries();
