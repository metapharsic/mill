const pool = require('../src/db/pool');

async function migrate() {
  const client = await pool.connect();
  try {
    console.log('Starting store_indent_log constraint fix...');
    await client.query('BEGIN');

    // 1. Drop the restrictive foreign key constraint to store_indents
    await client.query(`
      ALTER TABLE IF EXISTS store_indent_log 
      DROP CONSTRAINT IF EXISTS store_indent_log_indent_id_fkey;
    `);
    console.log('✓ Dropped store_indent_log_indent_id_fkey');

    // 2. Ensure qty_issued column exists on store_indent_log
    await client.query(`
      ALTER TABLE IF EXISTS store_indent_log 
      ADD COLUMN IF NOT EXISTS qty_issued NUMERIC(12,2);
    `);
    console.log('✓ Ensured qty_issued column on store_indent_log');

    // 3. Ensure index exists for fast timeline queries
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_store_indent_log_indent_id 
      ON store_indent_log(indent_id);
    `);
    console.log('✓ Ensured index on store_indent_log(indent_id)');

    await client.query('COMMIT');
    console.log('✓ Migration completed successfully!');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', e);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
