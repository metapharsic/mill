const fs = require('fs');
const path = require('path');
const pool = require('../src/db/pool');

async function exportFullSql() {
  const outputDir = path.join(__dirname, '../../database_backup');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const client = await pool.connect();
  try {
    console.log('🚀 Exporting full PostgreSQL database to SQL dump file...');
    const { rows: tables } = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `);

    let sql = `-- ======================================================================\n`;
    sql += `-- MK PAPER MILL DATABASE FULL EXPORT & SEED SCRIPT\n`;
    sql += `-- Exported At: ${new Date().toISOString()}\n`;
    sql += `-- Total Tables: ${tables.length}\n`;
    sql += `-- ======================================================================\n\n`;
    sql += `SET statement_timeout = 0;\nSET lock_timeout = 0;\nSET client_encoding = 'UTF8';\nSET standard_conforming_strings = on;\n\n`;

    for (const t of tables) {
      const tableName = t.table_name;
      const { rows } = await client.query(`SELECT * FROM "${tableName}"`);
      if (rows.length === 0) continue;

      sql += `-- Table: ${tableName} (${rows.length} rows)\n`;
      const cols = Object.keys(rows[0]);
      const colList = cols.map(c => `"${c}"`).join(', ');

      for (const row of rows) {
        const valList = cols.map(c => {
          const v = row[c];
          if (v === null || v === undefined) return 'NULL';
          if (typeof v === 'boolean') return v ? 'true' : 'false';
          if (typeof v === 'number') return v;
          if (v instanceof Date) return `'${v.toISOString()}'`;
          if (typeof v === 'object') return `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`;
          return `'${String(v).replace(/'/g, "''")}'`;
        }).join(', ');

        sql += `INSERT INTO "${tableName}" (${colList}) VALUES (${valList}) ON CONFLICT DO NOTHING;\n`;
      }
      sql += `\n`;
      console.log(`  ✓ Table [${tableName}]: ${rows.length} SQL INSERTs generated`);
    }

    const filePath = path.join(outputDir, 'mk_paper_mill_full_dump.sql');
    fs.writeFileSync(filePath, sql, 'utf8');
    console.log(`\n🎉 Full SQL dump generated at: ${filePath} (${(fs.statSync(filePath).size / 1024).toFixed(1)} KB)`);
  } catch (err) {
    console.error('❌ SQL Export failed:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

exportFullSql();
