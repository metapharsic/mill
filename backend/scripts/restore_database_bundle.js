const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const pool = require('../src/db/pool');

async function restoreDatabase() {
  const sqlDumpPath = path.join(__dirname, '../../database_backup/mk_paper_mill_full_dump.sql');
  if (!fs.existsSync(sqlDumpPath)) {
    console.error(`❌ SQL Dump not found at: ${sqlDumpPath}`);
    process.exit(1);
  }

  console.log('🔄 Restoring MK Paper Mill database from SQL dump...');
  console.log(`📁 Source: ${sqlDumpPath}`);

  try {
    const dbHost = process.env.DB_HOST || 'localhost';
    const dbPort = process.env.DB_PORT || '5432';
    const dbUser = process.env.DB_USER || 'postgres';
    const dbName = process.env.DB_NAME || 'mk_paper_mill';
    const dbPass = process.env.DB_PASSWORD || 'postgres';

    process.env.PGPASSWORD = dbPass;
    const cmd = `psql -h ${dbHost} -p ${dbPort} -U ${dbUser} -d ${dbName} -f "${sqlDumpPath}"`;
    execSync(cmd, { stdio: 'inherit' });

    console.log('\n🎉 Database restore completed successfully!');
  } catch (err) {
    console.error('❌ Restore execution error:', err.message);
  } finally {
    await pool.end();
  }
}

restoreDatabase();
