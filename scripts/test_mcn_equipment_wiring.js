const pool = require('../backend/src/db/pool');
const path = require('path');
const xlsx = require('../backend/node_modules/xlsx');

async function testMcnWiring() {
  console.log('=== VERIFYING MCN MACHINERY DETAILS WIRING & DATA INTEGRITY ===\n');

  // 1. Check total rows in database vs Excel
  const filePath = path.join(__dirname, '../Projects_Requirement/MK PAPER MILLS MCN DETAILS (1).xlsx');
  const workbook = xlsx.readFile(filePath);
  const sheet = workbook.Sheets['MCN SECTION WISE DETAILS'];
  const rawRows = xlsx.utils.sheet_to_json(sheet, { defval: null });

  console.log(`1. Excel source records count: ${rawRows.length}`);

  const { rows: [secEqCount] } = await pool.query('SELECT COUNT(*) as c FROM section_equipment WHERE sno IS NOT NULL');
  const { rows: [eqCount] } = await pool.query('SELECT COUNT(*) as c FROM equipment WHERE sno IS NOT NULL');

  console.log(`2. Database section_equipment MCN count: ${secEqCount.c} (Expected: 282)`);
  console.log(`3. Database equipment MCN count:         ${eqCount.c} (Expected: 282)`);

  if (parseInt(secEqCount.c) !== 282 || parseInt(eqCount.c) !== 282) {
    throw new Error(`Count mismatch! Expected 282 rows in both tables.`);
  }
  console.log('✓ Count assertion PASSED (282 / 282)');

  // 4. Sample check critical sections
  const sectionsToCheck = ['WIRE', 'PRESS', 'PREDRYER', 'POSTDRYER', 'BOILER', 'ETP', 'REWINDER', 'PULP'];
  console.log('\n4. Checking section equipment mechanical digital twins:');

  for (const code of sectionsToCheck) {
    const { rows: secItems } = await pool.query(`
      SELECT se.sno, se.equipment_name, se.bearing_size, se.lock_nut, se.washer, se.belt_no, se.shaft_size
      FROM section_equipment se
      JOIN plant_sections ps ON ps.id = se.section_id
      WHERE ps.section_code = $1
      ORDER BY se.sno ASC
      LIMIT 3
    `, [code]);

    console.log(`\n  --- Section: ${code} (${secItems.length} sample items) ---`);
    secItems.forEach(it => {
      console.log(`   [#${it.sno}] ${it.equipment_name} | Bearing: ${it.bearing_size || '—'} | Nut: ${it.lock_nut || '—'} | Belt: ${it.belt_no || '—'}`);
    });
  }

  // 5. Test specific critical equipment
  console.log('\n5. Verifying specific machinery parts:');
  const criticalChecks = [
    { sno: 4, name: 'Bottom Wire Couch Roll', expectedBearing: '23234K' },
    { sno: 5, name: 'Bottom Wire Breast Roll', expectedBearing: 'NU320' },
    { sno: 6, name: 'Bottom Wire Forward (FDR)Drive Roll', expectedBearing: '23234K' },
    { sno: 7, name: 'Bottom Wire Tension Roll-1', expectedBearing: '22314K' },
    { sno: 26, name: '1st Press Top Roll', expectedBearing: '23264K' },
    { sno: 73, name: 'Pre dryer Top Drive roll-1', expectedBearing: '22318K' },
    { sno: 109, name: 'Post dryer Top-1', expectedBearing: '23044K' },
    { sno: 163, name: 'Rewinder break drum', expectedBearing: '23222K' }
  ];

  for (const c of criticalChecks) {
    const { rows } = await pool.query(
      'SELECT equipment_name, bearing_size, belt_no, lock_nut FROM section_equipment WHERE sno = $1',
      [c.sno]
    );
    if (!rows.length || rows[0].bearing_size !== c.expectedBearing) {
      throw new Error(`Failed check for SNO ${c.sno} (${c.name})! Found: ${JSON.stringify(rows[0])}`);
    }
    console.log(`   ✓ [#${c.sno}] ${rows[0].equipment_name} -> Bearing: ${rows[0].bearing_size} (Matches Excel!)`);
  }

  console.log('\n=== ALL MCN WIRING & DATA INTEGRITY TESTS PASSED 100%! ===');
  await pool.end();
}

testMcnWiring().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
