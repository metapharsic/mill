const path = require('path');
const pool = require(path.join(__dirname, '../backend/src/db/pool'));

async function inspectData() {
  console.log('--- Inspecting Database Dates and Records ---');
  const tablesRes = await pool.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name;
  `);

  for (const row of tablesRes.rows) {
    const t = row.table_name;
    const cntRes = await pool.query(`SELECT count(*) FROM "${t}"`);
    const count = parseInt(cntRes.rows[0].count);
    if (count === 0) continue;

    const colRes = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = $1 
        AND (data_type LIKE '%timestamp%' OR data_type = 'date' OR column_name LIKE '%date%' OR column_name LIKE '%time%')
    `, [t]);

    let dateStats = [];
    for (const col of colRes.rows) {
      try {
        const dRes = await pool.query(`SELECT min("${col.column_name}") as min_d, max("${col.column_name}") as max_d FROM "${t}"`);
        if (dRes.rows[0].max_d) {
          dateStats.push(`${col.column_name}: [${dRes.rows[0].min_d} -> ${dRes.rows[0].max_d}]`);
        }
      } catch (e) {}
    }

    console.log(`${t.padEnd(30)} | Rows: ${String(count).padStart(6)} | ${dateStats.join(' | ')}`);
  }
  await pool.end();
}

inspectData().catch(err => {
  console.error(err);
  process.exit(1);
});
