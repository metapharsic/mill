const path = require('path');
const pool = require(path.join(__dirname, '../backend/src/db/pool'));
const fs = require('fs');

async function runMigration() {
  const sql = fs.readFileSync(path.join(__dirname, '../db/migration_partially_issued_and_ledger_fix.sql'), 'utf8');
  await pool.query(sql);
  console.log('Migration migration_partially_issued_and_ledger_fix.sql applied successfully!');
  await pool.end();
}

runMigration().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
