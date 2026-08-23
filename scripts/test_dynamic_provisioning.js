const pool = require('../backend/src/db/pool');

async function testDynamicProvisioning() {
  console.log('=== TESTING DYNAMIC PLANT SECTION & MACHINERY PROVISIONING ===\n');

  // 1. Test create plant section & sync with plant_sections
  const testSecName = `Chemical Prep Section ${Date.now()}`;
  const testSecCode = `CHEM_${Date.now().toString().slice(-4)}`;

  const { rows: [createdSec] } = await pool.query(
    'INSERT INTO sections (name, code, is_active) VALUES ($1, $2, true) RETURNING *',
    [testSecName, testSecCode]
  );
  console.log(`1. Created dynamic Section: [ID: ${createdSec.id}] ${createdSec.name} (${createdSec.code})`);

  const { rows: [createdPs] } = await pool.query(`
    INSERT INTO plant_sections (section_code, name, description, is_active)
    VALUES ($1, $2, 'Dynamic Plant Section Test', true)
    RETURNING *
  `, [testSecCode, testSecName]);
  console.log(`   Synced Plant Section: [ID: ${createdPs.id}] ${createdPs.name} (${createdPs.section_code})`);

  // 2. Test create equipment/roll linked to section
  const testEqName = `Chemical Dosing Pump #1`;
  const testTag = `CHEM-MCN-001`;
  const testBearing = `6308-2RS`;

  const { rows: [createdEq] } = await pool.query(`
    INSERT INTO section_equipment (
      section_id, tag_name, equipment_name, equipment_type,
      bearing_size, lock_nut, washer, belt_no, shaft_size, is_active
    ) VALUES ($1, $2, $3, 'Pump/Roll', $4, 'KM 08', 'MB 08', 'A-45', '40 mm', true)
    RETURNING *
  `, [createdPs.id, testTag, testEqName, testBearing]);

  console.log(`2. Created dynamic Equipment: [ID: ${createdEq.id}] ${createdEq.equipment_name} | Bearing: ${createdEq.bearing_size}`);

  // 3. Verify query section-equipment
  const { rows: found } = await pool.query(`
    SELECT se.*, ps.name as "plantSectionName"
    FROM section_equipment se
    LEFT JOIN plant_sections ps ON ps.id = se.section_id
    WHERE se.id = $1
  `, [createdEq.id]);

  if (!found.length || found[0].bearing_size !== '6308-2RS') {
    throw new Error('Verification failed for dynamic equipment query');
  }
  console.log(`3. Verified query result: Plant Section Name: "${found[0].plantSectionName}" | Bearing: "${found[0].bearing_size}"`);

  // Clean up test rows
  await pool.query('DELETE FROM section_equipment WHERE id = $1', [createdEq.id]);
  await pool.query('DELETE FROM plant_sections WHERE id = $1', [createdPs.id]);
  await pool.query('DELETE FROM sections WHERE id = $1', [createdSec.id]);
  console.log('4. Cleaned up test records.');

  console.log('\n=== DYNAMIC PROVISIONING INTEGRITY TEST PASSED 100%! ===');
  await pool.end();
}

testDynamicProvisioning().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
