/**
 * cleanup_materials.js
 * ---------------------
 * Finds and removes "junk" material records from the materials table.
 * Junk = names that are:
 *   - Pure numbers:              "0", "1", "123", "456" …
 *   - Only whitespace/empty
 *   - Single characters that are not meaningful: "a", "b", "x", "z" …
 *   - Common test/placeholder words: "test", "temp", "dummy", "null", "none", "n/a", "na", "-", ".", "xxx"
 *   - Numbers with dots/dashes only: "0.0", "1-2"
 *   - Very short (≤ 2 chars) non-meaningful strings
 *
 * USAGE:
 *   node scripts/cleanup_materials.js          → DRY RUN (shows what would be deleted)
 *   node scripts/cleanup_materials.js --delete → ACTUALLY deletes them
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

const DO_DELETE = process.argv.includes('--delete');

// --- Junk detection logic ---
const JUNK_WORDS = new Set([
  'test','temp','dummy','null','none','n/a','na','-','.',
  'xxx','abc','sample','example','item','material',
  'zero','one','two','three','four','five','six','seven','eight','nine','ten',
]);

function isJunk(name) {
  if (!name || name.trim() === '') return true;
  const t = name.trim().toLowerCase();

  // Pure number (integer or decimal)
  if (/^\d+(\.\d+)?$/.test(t)) return true;

  // Number-dash-number like "1-2", "0-1"
  if (/^\d[\d.\-]+\d$/.test(t) && !/[a-z]/i.test(t)) return true;

  // Exact junk words
  if (JUNK_WORDS.has(t)) return true;

  // Single character (not a real material code)
  if (t.length === 1) return true;

  // Only special characters / punctuation
  if (/^[\W_]+$/.test(t)) return true;

  return false;
}

async function run() {
  const client = await pool.connect();
  try {
    // Discover which table + name column holds materials
    const tableCheck = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN (
          'materials','raw_materials','store_items','inventory_items',
          'items','spare_parts','chemicals'
        )
      ORDER BY table_name;
    `);

    console.log('\n📋 Found tables:', tableCheck.rows.map(r => r.table_name).join(', ') || '(none)');

    for (const { table_name } of tableCheck.rows) {
      const cols = await client.query(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1
        ORDER BY ordinal_position;
      `, [table_name]);

      const colNames = cols.rows.map(r => r.column_name);
      console.log(`\n🗂️  Table: ${table_name}  →  columns: ${colNames.join(', ')}`);

      const nameCol = colNames.find(c => ['name','material_name','item_name','description','title'].includes(c));
      const idCol   = colNames.find(c => ['id','material_id','item_id'].includes(c));

      if (!nameCol || !idCol) {
        console.log(`   ⚠️  Cannot determine name/id column — skipping.`);
        continue;
      }

      const rows = await client.query(`SELECT ${idCol}, ${nameCol} FROM ${table_name} ORDER BY ${nameCol};`);
      console.log(`   Total rows: ${rows.rows.length}`);

      const toDelete = rows.rows.filter(r => isJunk(r[nameCol]));

      if (toDelete.length === 0) {
        console.log(`   ✅ No junk found in ${table_name}.`);
        continue;
      }

      console.log(`\n   🚮 JUNK FOUND (${toDelete.length} rows):`);
      toDelete.forEach(r => {
        console.log(`      id=${r[idCol]}  name="${r[nameCol]}"`);
      });

      if (DO_DELETE) {
        const ids = toDelete.map(r => r[idCol]);
        const result = await client.query(
          `DELETE FROM ${table_name} WHERE ${idCol} = ANY($1::int[])`,
          [ids]
        );
        console.log(`   🗑️  DELETED ${result.rowCount} rows from ${table_name}.`);
      } else {
        console.log(`\n   ℹ️  DRY RUN — run with --delete to actually remove these rows.`);
      }
    }

  } catch (err) {
    console.error('\n❌ Error:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

run().then(() => {
  console.log('\nDone.');
});
