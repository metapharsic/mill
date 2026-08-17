const pool = require('../src/db/pool');

async function main() {
  const res = await pool.query(`
    SELECT table_name, column_name, data_type 
    FROM information_schema.columns 
    WHERE (column_name ILIKE '%uom%' OR column_name ILIKE '%unit%')
      AND table_schema = 'public'
    ORDER BY table_name, column_name
  `);
  console.log('--- ALL UOM / UNIT COLUMNS IN POSTGRESQL ---');
  console.table(res.rows);

  await pool.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
