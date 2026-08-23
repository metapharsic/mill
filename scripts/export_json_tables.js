const fs = require('fs');
const path = require('path');
const pool = require('../backend/src/db/pool');

async function exportJsonTables() {
  const jsonDir = path.join(__dirname, '../database_backup/json_tables');
  if (!fs.existsSync(jsonDir)) {
    fs.mkdirSync(jsonDir, { recursive: true });
  }

  console.log('=== EXPORTING DATABASE TABLES TO PORTABLE JSON ===');
  
  // Get all table names in public schema
  const { rows: tables } = await pool.query(`
    SELECT tablename 
    FROM pg_tables 
    WHERE schemaname = 'public'
    ORDER BY tablename ASC
  `);

  console.log(`Found ${tables.length} tables in PostgreSQL database.`);

  const summary = {};
  for (const t of tables) {
    const tableName = t.tablename;
    try {
      const { rows } = await pool.query(`SELECT * FROM "${tableName}"`);
      const filePath = path.join(jsonDir, `${tableName}.json`);
      fs.writeFileSync(filePath, JSON.stringify(rows, null, 2), 'utf8');
      summary[tableName] = rows.length;
      console.log(`  ✓ Exported ${tableName}: ${rows.length} rows`);
    } catch (err) {
      console.warn(`  ⚠️ Could not export ${tableName}: ${err.message}`);
    }
  }

  const manifestPath = path.join(jsonDir, '_manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify({
    exported_at: new Date().toISOString(),
    total_tables: Object.keys(summary).length,
    table_counts: summary
  }, null, 2), 'utf8');

  console.log(`\n✅ ALL TABLES EXPORTED TO JSON in: ${jsonDir}`);
  await pool.end();
}

exportJsonTables().catch(err => {
  console.error('Export error:', err);
  process.exit(1);
});
