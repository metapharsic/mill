const pool = require('../src/db/pool');

async function check() {
  const { rows: cols } = await pool.query(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'store_indent_log'
  `);
  console.log('store_indent_log columns:', cols);

  const { rows: constraints } = await pool.query(`
    SELECT conname, pg_get_constraintdef(c.oid)
    FROM pg_constraint c
    JOIN pg_namespace n ON n.oid = c.connamespace
    WHERE conrelid = 'store_indent_log'::regclass
  `);
  console.log('store_indent_log constraints:', constraints);

  await pool.end();
}

check().catch(console.error);
