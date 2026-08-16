require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const pool = require('../src/db/pool');

async function migrate() {
  console.log('Running vendor bank details migration...');

  await pool.query(`
    ALTER TABLE vendors ADD COLUMN IF NOT EXISTS bank_name VARCHAR(128);
    ALTER TABLE vendors ADD COLUMN IF NOT EXISTS account_number VARCHAR(64);
    ALTER TABLE vendors ADD COLUMN IF NOT EXISTS ifsc_code VARCHAR(32);
    ALTER TABLE vendors ADD COLUMN IF NOT EXISTS branch_name VARCHAR(128);
    ALTER TABLE vendors ADD COLUMN IF NOT EXISTS account_holder_name VARCHAR(128);
    ALTER TABLE vendors ADD COLUMN IF NOT EXISTS account_type VARCHAR(32) DEFAULT 'Current';
  `);

  console.log('✓ Vendor bank details columns added successfully!');
  
  // Verify columns
  const { rows } = await pool.query(
    "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'vendors' ORDER BY ordinal_position"
  );
  console.log('Current vendors columns:', rows.map(r => r.column_name).join(', '));

  pool.end();
}

migrate().catch(e => {
  console.error('Migration failed:', e);
  pool.end();
  process.exit(1);
});
