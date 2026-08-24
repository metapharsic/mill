const pool = require('../src/db/pool');

async function main() {
  const { rows: ms } = await pool.query(`
    SELECT conname, contype, pg_get_constraintdef(oid) 
    FROM pg_constraint 
    WHERE conrelid IN ('material_sections'::regclass, 'material_equipment'::regclass)
  `);
  console.log(ms);
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
