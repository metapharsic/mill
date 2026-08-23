const pool = require('../backend/src/db/pool');

async function inspectSectionEquip() {
  const { rows: cols } = await pool.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'section_equipment'
    ORDER BY ordinal_position
  `);
  console.log('Columns in section_equipment:');
  cols.forEach(c => console.log(`  - ${c.column_name} (${c.data_type})`));

  const { rows: samples } = await pool.query(`
    SELECT id, section_id, equipment_name, tag_name, remarks
    FROM section_equipment
    LIMIT 10
  `);
  console.log('\nSample 10 rows in section_equipment:');
  samples.forEach(s => console.log(`  [${s.id}] [Sec: ${s.section_id}] [Tag: ${s.tag_name}] ${s.equipment_name} | Remarks: ${s.remarks}`));

  const { rows: eqCols } = await pool.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'equipment'
    ORDER BY ordinal_position
  `);
  console.log('\nColumns in equipment table:');
  eqCols.forEach(c => console.log(`  - ${c.column_name} (${c.data_type})`));

  await pool.end();
}

inspectSectionEquip().catch(console.error);
