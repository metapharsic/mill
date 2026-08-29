require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const pool = require('../src/db/pool');

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    console.log('🚀 [DB-MIGRATION-AGENT] Adding remarks column to po_items...');

    await client.query(`
      ALTER TABLE po_items
        ADD COLUMN IF NOT EXISTS remarks text;
    `);
    console.log('✅ po_items.remarks column ready');

    await client.query('COMMIT');
    console.log('🎉 [DB-MIGRATION-AGENT] Migration completed successfully!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ [DB-MIGRATION-AGENT] Migration failed:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
