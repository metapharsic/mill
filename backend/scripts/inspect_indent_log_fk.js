const pool = require('../src/db/pool');

async function inspect() {
  const { rows: fks } = await pool.query(`
    SELECT
      tc.table_schema, 
      tc.constraint_name, 
      tc.table_name, 
      kcu.column_name, 
      ccu.table_name AS foreign_table_name,
      ccu.column_name AS foreign_column_name 
    FROM information_schema.table_constraints AS tc 
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
    WHERE tc.table_name = 'store_indent_log' OR tc.table_name = 'indent_audit_log';
  `);
  console.log('Foreign keys on store_indent_log & indent_audit_log:');
  console.log(fks);

  const { rows: storeIndentsCount } = await pool.query('SELECT COUNT(*) FROM store_indents');
  const { rows: indentsCount } = await pool.query('SELECT COUNT(*) FROM indents');
  const { rows: indentsSample } = await pool.query('SELECT id, indent_number, status FROM indents LIMIT 5');
  console.log('store_indents count:', storeIndentsCount[0].count);
  console.log('indents count:', indentsCount[0].count);
  console.log('indents sample:', indentsSample);

  await pool.end();
}

inspect().catch(console.error);
