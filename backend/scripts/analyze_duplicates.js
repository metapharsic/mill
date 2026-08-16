/**
 * analyze_duplicates.js
 * ---------------------
 * Finds duplicate materials by name (case-insensitive, trimmed).
 * Shows all groups, affected child-table references, and a summary.
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { Pool } = require('pg');
const pool = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME     || 'mk_paper_mill',
  user:     process.env.DB_USER     || 'postgres',
  password: process.env.DB_PASSWORD || 'admin123',
});

async function run() {
  const client = await pool.connect();
  try {
    console.log('\n=== DUPLICATE MATERIALS ANALYSIS ===\n');

    // 1. Find all groups of duplicates (by normalized name)
    const { rows: dupGroups } = await client.query(`
      SELECT
        LOWER(TRIM(name)) AS norm_name,
        COUNT(*) AS cnt,
        array_agg(id ORDER BY id) AS ids,
        array_agg(code ORDER BY id) AS codes,
        array_agg(name ORDER BY id) AS names
      FROM materials
      GROUP BY LOWER(TRIM(name))
      HAVING COUNT(*) > 1
      ORDER BY COUNT(*) DESC, LOWER(TRIM(name))
    `);

    console.log(`Total duplicate groups: ${dupGroups.length}`);
    const totalDupRows = dupGroups.reduce((s, g) => s + parseInt(g.cnt) - 1, 0);
    console.log(`Total extra rows to remove: ${totalDupRows}\n`);

    // 2. Show all groups
    dupGroups.forEach((g, i) => {
      console.log(`[${i+1}] "${g.norm_name}"  (${g.cnt} copies)`);
      for (let j = 0; j < g.ids.length; j++) {
        console.log(`     id=${g.ids[j]}  code="${g.codes[j]}"  name="${g.names[j]}"`);
      }
    });

    // 3. Check FK references for all duplicate IDs
    const allIds = dupGroups.flatMap(g => g.ids.slice(1)); // all non-keeper IDs

    const childTables = [
      'adjustment_requests',
      'grn_items',
      'indent_items',
      'installed_assets',
      'po_items',
      'stock_ledger',
      'store_indents',
      'store_issues',
    ];

    console.log('\n=== FK REFERENCE CHECK (for rows that would be deleted) ===');
    for (const tbl of childTables) {
      try {
        const { rows } = await client.query(
          `SELECT COUNT(*) as cnt FROM ${tbl} WHERE material_id = ANY($1::int[])`,
          [allIds]
        );
        if (parseInt(rows[0].cnt) > 0) {
          console.log(`  ${tbl}.material_id: ${rows[0].cnt} references`);
        }
      } catch (_) {}
    }

    // 4. Summary of which "keeper" we'd pick for each group
    console.log('\n=== MERGE PLAN (keep lowest id, delete rest) ===');
    dupGroups.slice(0, 30).forEach(g => {
      const keepId = g.ids[0];
      const dropIds = g.ids.slice(1);
      console.log(`  Keep id=${keepId} ("${g.names[0]}"), DELETE ids: [${dropIds.join(', ')}]`);
    });
    if (dupGroups.length > 30) console.log(`  ... and ${dupGroups.length - 30} more groups`);

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

run().then(() => console.log('\nDone.'));
