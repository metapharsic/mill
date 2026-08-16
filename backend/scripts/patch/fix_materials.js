/**
 * fix_materials.js
 * ----------------
 * Strategy:
 *   1) Rows where name is a PURE INTEGER (0-9999) AND code is a real bearing/part code
 *      → UPDATE name = code  (restore the proper name from the code field)
 *   2) Rows where name is a pure integer AND code is ALSO just a number or junk
 *      → DELETE (truly useless rows)
 *   3) Rows with name = 'example'
 *      → DELETE
 *
 * Oil-seal dimension specs like "10-22-7", "25-40-8" are VALID — leave them alone.
 *
 * Run: node scripts/fix_materials.js           → DRY RUN
 *      node scripts/fix_materials.js --apply   → APPLY changes
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

const APPLY = process.argv.includes('--apply');

// A "real" code is one that contains letters (bearing codes, SKU codes etc.)
function isRealCode(code) {
  if (!code || code.trim() === '') return false;
  return /[a-zA-Z]/.test(code.trim());
}

async function run() {
  const client = await pool.connect();
  try {
    // Get all rows where name is purely numeric (integer only)
    const { rows } = await client.query(
      "SELECT id, code, name FROM materials WHERE name ~ '^[0-9]+$' ORDER BY id"
    );
    console.log(`\nTotal rows with pure-numeric name: ${rows.length}`);

    const toUpdate = rows.filter(r => isRealCode(r.code));
    const toDelete = rows.filter(r => !isRealCode(r.code));

    console.log(`  → Will UPDATE name=code for: ${toUpdate.length} rows (real part codes)`);
    console.log(`  → Will DELETE:               ${toDelete.length} rows (no real code either)\n`);

    // Also get 'example' rows
    const { rows: exRows } = await client.query(
      "SELECT id, code, name FROM materials WHERE LOWER(TRIM(name)) = 'example'"
    );
    console.log(`  → Will DELETE 'example' rows: ${exRows.length}`);

    console.log('\n=== UPDATE PREVIEW (first 20) ===');
    toUpdate.slice(0, 20).forEach(r =>
      console.log(`  id=${r.id}  name: "${r.name}" → "${r.code}"`)
    );

    console.log('\n=== DELETE PREVIEW ===');
    toDelete.forEach(r =>
      console.log(`  id=${r.id}  code="${r.code}"  name="${r.name}"`)
    );
    exRows.forEach(r =>
      console.log(`  id=${r.id}  code="${r.code}"  name="${r.name}"`)
    );

    if (!APPLY) {
      console.log('\n⚠️  DRY RUN — run with --apply to execute changes.');
      return;
    }

    // ── Apply UPDATEs ──
    let updateCount = 0;
    for (const r of toUpdate) {
      await client.query(
        'UPDATE materials SET name = $1 WHERE id = $2',
        [r.code.trim(), r.id]
      );
      updateCount++;
    }
    console.log(`\n✅ Updated ${updateCount} rows (name set to code).`);

    // ── Apply DELETEs ──
    const deleteIds = [...toDelete, ...exRows].map(r => r.id);
    if (deleteIds.length > 0) {
      const result = await client.query(
        'DELETE FROM materials WHERE id = ANY($1::int[])',
        [deleteIds]
      );
      console.log(`🗑️  Deleted ${result.rowCount} junk rows.`);
    }

    // ── Verify ──
    const { rows: remaining } = await client.query(
      "SELECT COUNT(*) as cnt FROM materials WHERE name ~ '^[0-9]+$'"
    );
    console.log(`\n📊 Remaining pure-numeric-name rows: ${remaining[0].cnt}`);
    const { rows: total } = await client.query('SELECT COUNT(*) as cnt FROM materials');
    console.log(`📊 Total materials in DB: ${total[0].cnt}`);

  } catch (err) {
    console.error('\n❌ Error:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

run().then(() => console.log('\nDone.'));
