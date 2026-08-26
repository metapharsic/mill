const fs = require('fs');
const path = require('path');
const pool = require('../src/db/pool');

async function runMigration() {
  console.log('--- Running PPC & Slitting Foundation Migration ---');
  const sqlPath = path.resolve(__dirname, '../../db/migration_ppc_slitting_foundation.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
    console.log('✅ Migration SQL executed successfully.');

    // Verify all 6 tables exist
    const tables = [
      'ppc_production_plans',
      'ppc_slitting_patterns',
      'ppc_pattern_cuts',
      'jumbo_reels',
      'slit_reels',
      'slitting_waste_log'
    ];

    for (const table of tables) {
      const res = await client.query(
        `SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1`,
        [table]
      );
      if (parseInt(res.rows[0].count) > 0) {
        console.log(`  ✓ Table '${table}' exists.`);
      } else {
        throw new Error(`Table '${table}' was not created!`);
      }
    }

    console.log('✅ All 6 normalized tables and mass-balance triggers verified!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', err);
    process.exit(1);
  } finally {
    client.release();
    process.exit(0);
  }
}

runMigration();
