const fs = require('fs');
const path = require('path');
const pool = require('../src/db/pool');

async function exportFullJsonBundle() {
  const outputDir = path.join(__dirname, '../../database_backup/json_tables');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const client = await pool.connect();
  try {
    console.log('🚀 Exporting full PostgreSQL database to JSON bundle...');
    const { rows: tables } = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `);

    const manifest = {
      exportedAt: new Date().toISOString(),
      database: 'mk_paper_mill',
      totalTables: tables.length,
      tables: {}
    };

    for (const t of tables) {
      const tableName = t.table_name;
      const { rows } = await client.query(`SELECT * FROM "${tableName}"`);
      const filePath = path.join(outputDir, `${tableName}.json`);
      fs.writeFileSync(filePath, JSON.stringify(rows, null, 2), 'utf8');
      manifest.tables[tableName] = {
        rowCount: rows.length,
        file: `${tableName}.json`
      };
      console.log(`  ✓ Table [${tableName}]: ${rows.length} rows exported`);
    }

    fs.writeFileSync(path.join(outputDir, '_manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');
    console.log(`\n🎉 Successfully exported all ${tables.length} tables to: ${outputDir}`);
  } catch (err) {
    console.error('❌ Export failed:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

exportFullJsonBundle();
