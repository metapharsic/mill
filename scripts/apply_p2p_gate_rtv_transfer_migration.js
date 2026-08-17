const path = require('path');
const pool = require(path.join(__dirname, '../backend/src/db/pool'));
const fs = require('fs');

async function runMigration() {
  console.log('Applying migration_p2p_gate_rtv_transfer.sql...');
  const sql = fs.readFileSync(path.join(__dirname, '../db/migration_p2p_gate_rtv_transfer.sql'), 'utf8');
  await pool.query(sql);
  console.log('Migration migration_p2p_gate_rtv_transfer.sql applied successfully!');
  await pool.end();
}

runMigration().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
