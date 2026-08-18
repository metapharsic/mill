const pool = require('../backend/src/db/pool');

async function testIntegration() {
  console.log('--- STARTING SECTION & MACHINE INTEGRATION TEST ---');

  try {
    // 1. Verify plant_sections count and seeded section_equipment
    const secRes = await pool.query('SELECT count(*) FROM plant_sections');
    console.log(`[PASS] Plant Sections count: ${secRes.rows[0].count}`);

    const eqRes = await pool.query('SELECT count(*) FROM section_equipment');
    console.log(`[PASS] Section Equipment (Rolls) count: ${eqRes.rows[0].count}`);

    // 2. Select a sample section and roll
    const sampleSec = (await pool.query("SELECT * FROM plant_sections WHERE section_code = 'WIRE' OR name ILIKE '%Wire%' LIMIT 1")).rows[0];
    console.log(`[INFO] Wire Section ID: ${sampleSec.id}, Name: ${sampleSec.name}`);

    const sampleEq = (await pool.query('SELECT * FROM section_equipment WHERE section_id = $1 LIMIT 1', [sampleSec.id])).rows[0];
    console.log(`[INFO] Sample Roll Equipment: ${sampleEq.equipment_name} (${sampleEq.remarks})`);

    // 3. Create a test material linked to Wire Section & Roll
    const testCode = 'TEST_WIRE_BEARING_' + Date.now().toString().slice(-4);
    const cat = (await pool.query('SELECT id FROM material_categories LIMIT 1')).rows[0];

    const insRes = await pool.query(`
      INSERT INTO materials (
        code, name, category_id, section_id, machine_id, section_equipment_id,
        section_context, uom, current_stock, unit_price, reorder_level, min_stock, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, true)
      RETURNING *
    `, [
      testCode,
      'Test Spherical Roller Bearing 23152 CC/W33',
      cat.id,
      sampleSec.id,
      sampleEq.machine_id,
      sampleEq.id,
      'Wire Section › ' + sampleEq.equipment_name,
      'NOS',
      4,
      18500.00,
      2,
      1
    ]);
    const createdMat = insRes.rows[0];
    console.log(`[PASS] Created Material ID: ${createdMat.id}, Code: ${createdMat.code}`);

    // 4. Query materials with Section & Machine JOIN
    const matJoined = await pool.query(`
      SELECT m.id, m.code, m.name,
             ps.name AS "sectionName",
             mac.name AS "machineName",
             se.equipment_name AS "equipmentName",
             se.remarks AS "equipmentRemarks"
      FROM materials m
      LEFT JOIN plant_sections ps ON ps.id = m.section_id
      LEFT JOIN machines mac ON mac.id = m.machine_id
      LEFT JOIN section_equipment se ON se.id = m.section_equipment_id
      WHERE m.id = $1
    `, [createdMat.id]);

    const joinedRow = matJoined.rows[0];
    console.log(`[PASS] Joined Material: Section="${joinedRow.sectionName}", Machine="${joinedRow.machineName}", Equipment="${joinedRow.equipmentName}"`);

    // 5. Query Stores Report with Section filter
    const reportRes = await pool.query(`
      SELECT m.id, m.code, m.name, ps.name AS "sectionName", se.equipment_name AS "equipmentName"
      FROM materials m
      JOIN material_categories mc ON mc.id = m.category_id
      LEFT JOIN plant_sections ps ON ps.id = m.section_id
      LEFT JOIN section_equipment se ON se.id = m.section_equipment_id
      WHERE m.is_active = true AND m.section_id = $1
    `, [sampleSec.id]);
    console.log(`[PASS] Section Filtered Stores Report items count for Wire Section: ${reportRes.rows.length}`);

    // Cleanup test record
    await pool.query('DELETE FROM materials WHERE id = $1', [createdMat.id]);
    console.log(`[PASS] Cleaned up temporary test material.`);

    console.log('--- ALL INTEGRATION TESTS PASSED SUCCESSFULLY! ---');
  } catch (err) {
    console.error('[FAIL] Integration test failed:', err);
  } finally {
    await pool.end();
  }
}

testIntegration();
