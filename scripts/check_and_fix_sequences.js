const { Pool } = require('../backend/node_modules/pg');
const pool = new Pool({ host: 'localhost', port: 5432, database: 'mk_paper_mill', user: 'postgres', password: 'postgres' });

async function checkAndFixSequences() {
  console.log('================================================================');
  console.log('🔄 AUDITING POSTGRESQL SEQUENCES vs MAX(ID)');
  console.log('================================================================\n');

  // Query all table columns with sequence defaults
  const { rows: seqCols } = await pool.query(`
    SELECT 
      t.table_name,
      c.column_name,
      c.column_default,
      pg_get_serial_sequence(t.table_name, c.column_name) as sequence_name
    FROM information_schema.tables t
    JOIN information_schema.columns c ON t.table_name = c.table_name AND t.table_schema = c.table_schema
    WHERE t.table_schema = 'public' 
      AND t.table_type = 'BASE TABLE'
      AND c.column_default LIKE 'nextval%'
    ORDER BY t.table_name
  `);

  let outOfSync = 0;
  let inSync = 0;
  const fixes = [];

  for (const row of seqCols) {
    const table = row.table_name;
    const col = row.column_name;
    const seq = row.sequence_name;
    if (!seq) continue;

    const { rows: [maxRow] } = await pool.query(`SELECT COALESCE(MAX(${col}), 0) as max_id FROM "${table}"`);
    const maxId = parseInt(maxRow.max_id, 10);

    const { rows: [seqRow] } = await pool.query(`SELECT last_value, is_called FROM ${seq}`);
    const lastVal = parseInt(seqRow.last_value, 10);
    const isCalled = seqRow.is_called;

    const effectiveNext = !isCalled && lastVal === 1 ? 1 : lastVal + 1;

    if (maxId >= effectiveNext) {
      outOfSync++;
      fixes.push({ table, col, seq, maxId, lastVal, effectiveNext });
      console.log(`⚠️ OUT OF SYNC: Table "${table}.${col}" MAX(id)=${maxId} vs Seq "${seq}" nextval=${effectiveNext}`);
      // Fix sequence
      const newSeqVal = maxId === 0 ? 1 : maxId;
      await pool.query(`SELECT setval('${seq}', $1, true)`, [newSeqVal]);
      console.log(`   ✅ Fixed sequence "${seq}" to ${newSeqVal}`);
    } else {
      inSync++;
    }
  }

  console.log('\n================================================================');
  console.log(`Sequences In Sync:  ${inSync}`);
  console.log(`Sequences Fixed:    ${outOfSync}`);
  console.log('================================================================');

  await pool.end();
}

checkAndFixSequences().catch(console.error);
