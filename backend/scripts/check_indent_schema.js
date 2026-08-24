const pool = require('../src/db/pool');

async function main() {
  const { rows } = await pool.query(`
    SELECT table_name, column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name IN ('indents', 'indent_items')
    ORDER BY table_name, ordinal_position
  `);
  console.table(rows);
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
