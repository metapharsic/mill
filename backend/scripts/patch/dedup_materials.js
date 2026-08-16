/**
 * dedup_materials.js
 * ------------------
 * For each group of duplicate materials (same name, case-insensitive):
 *   1. Pick the BEST row to keep:
 *      - Prefer codes matching known prefixes (BE, OS, CHEM, INW, CHEPS, ELEG …)
 *      - Fall back to lowest id
 *   2. Re-point ALL FK child references from duplicate ids → keeper id
 *   3. Delete the duplicates inside a single transaction
 *
 * Run:   node scripts/dedup_materials.js           → DRY RUN
 *        node scripts/dedup_materials.js --apply   → APPLY
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

// Preferred code prefix order (higher index = more preferred)
const CODE_PRIORITY = ['BE', 'OS', 'CHEM', 'CHEPS', 'INW', 'ELEG', 'BE0'];

function codePriority(code) {
  if (!code) return -1;
  const c = code.trim().toUpperCase();
  // Codes matching known ERP patterns get priority
  for (let i = CODE_PRIORITY.length - 1; i >= 0; i--) {
    if (c.startsWith(CODE_PRIORITY[i])) return i + 10;
  }
  // If code looks like a real part code (has letters) but not a known prefix
  if (/[A-Z]/.test(c)) return 5;
  // Pure numeric / dimension codes — lowest priority
  return 0;
}

function pickKeeper(rows) {
  // Sort: highest code priority first, then lowest id
  return rows.slice().sort((a, b) => {
    const pa = codePriority(a.code);
    const pb = codePriority(b.code);
    if (pb !== pa) return pb - pa;
    return a.id - b.id;
  })[0];
}

// All FK child tables and their material-referencing columns
const FK_REFS = [
  { table: 'adjustment_requests',   col: 'material_id' },
  { table: 'grn_items',             col: 'material_id' },
  { table: 'indent_items',          col: 'material_id' },
  { table: 'installed_assets',      col: 'material_id' },
  { table: 'po_items',              col: 'material_id' },
  { table: 'stock_ledger',          col: 'material_id' },
  { table: 'store_indents',         col: 'material_id' },
  { table: 'store_issues',          col: 'material_id' },
  { table: 'store_issues',          col: 'substitute_material_id' },
  { table: 'chemical_consumption',  col: 'chemical_id' },
  { table: 'chemical_limit_alerts', col: 'chemical_id' },
  { table: 'dpr_chemical_lines',    col: 'chemical_id' },
];

async function tableExists(client, tbl) {
  const { rows } = await client.query(
    `SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=$1`,
    [tbl]
  );
  return rows.length > 0;
}

async function columnExists(client, tbl, col) {
  const { rows } = await client.query(
    `SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 AND column_name=$2`,
    [tbl, col]
  );
  return rows.length > 0;
}

async function run() {
  const client = await pool.connect();
  try {
    // ── 1. Find all duplicate groups ──
    const { rows: groups } = await client.query(`
      SELECT
        LOWER(TRIM(name)) AS norm_name,
        COUNT(*) AS cnt,
        array_agg(id ORDER BY id) AS ids,
        array_agg(code ORDER BY id) AS codes,
        array_agg(name ORDER BY id) AS names
      FROM materials
      GROUP BY LOWER(TRIM(name))
      HAVING COUNT(*) > 1
      ORDER BY LOWER(TRIM(name))
    `);

    console.log(`\n=== DEDUP MATERIALS ===`);
    console.log(`Duplicate groups found: ${groups.length}`);
    const totalExtra = groups.reduce((s, g) => s + parseInt(g.cnt) - 1, 0);
    console.log(`Extra rows to remove:   ${totalExtra}\n`);

    if (groups.length === 0) {
      console.log('Nothing to do — database is clean!');
      return;
    }

    // ── 2. Build merge plan ──
    const plan = groups.map(g => {
      const rows = g.ids.map((id, i) => ({ id, code: g.codes[i], name: g.names[i] }));
      const keeper = pickKeeper(rows);
      const dupes  = rows.filter(r => r.id !== keeper.id);
      return { norm_name: g.norm_name, keeper, dupes };
    });

    // Print plan
    console.log('=== MERGE PLAN ===');
    plan.forEach((p, i) => {
      console.log(`[${i+1}] "${p.norm_name}"`);
      console.log(`     KEEP   id=${p.keeper.id}  code="${p.keeper.code}"`);
      p.dupes.forEach(d => console.log(`     DELETE id=${d.id}  code="${d.code}"`));
    });

    if (!APPLY) {
      console.log('\n⚠️  DRY RUN — run with --apply to execute changes.');
      return;
    }

    // ── 3. Apply inside a transaction ──
    await client.query('BEGIN');
    let totalUpdated = 0;
    let totalDeleted = 0;

    try {
      for (const p of plan) {
        const keepId  = p.keeper.id;
        const dupeIds = p.dupes.map(d => d.id);

        // Re-point every FK reference
        for (const fk of FK_REFS) {
          const tblOk = await tableExists(client, fk.table);
          if (!tblOk) continue;
          const colOk = await columnExists(client, fk.table, fk.col);
          if (!colOk) continue;

          const { rowCount } = await client.query(
            `UPDATE ${fk.table} SET ${fk.col} = $1 WHERE ${fk.col} = ANY($2::int[])`,
            [keepId, dupeIds]
          );
          if (rowCount > 0) {
            console.log(`  Repointed ${rowCount} rows in ${fk.table}.${fk.col} → id=${keepId}`);
            totalUpdated += rowCount;
          }
        }

        // Delete duplicates
        const { rowCount } = await client.query(
          'DELETE FROM materials WHERE id = ANY($1::int[])',
          [dupeIds]
        );
        totalDeleted += rowCount;
      }

      await client.query('COMMIT');
      console.log(`\n✅ Transaction committed.`);
      console.log(`   FK rows re-pointed: ${totalUpdated}`);
      console.log(`   Materials deleted:  ${totalDeleted}`);

    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    }

    // ── 4. Final verification ──
    const { rows: remaining } = await client.query(`
      SELECT COUNT(*) as cnt FROM materials
    `);
    const { rows: stillDups } = await client.query(`
      SELECT COUNT(*) as cnt FROM (
        SELECT LOWER(TRIM(name)) FROM materials
        GROUP BY LOWER(TRIM(name)) HAVING COUNT(*) > 1
      ) x
    `);
    console.log(`\n📊 Materials remaining:       ${remaining[0].cnt}`);
    console.log(`📊 Duplicate groups remaining: ${stillDups[0].cnt}`);
    if (parseInt(stillDups[0].cnt) === 0) {
      console.log('🎉 Database is fully deduplicated!');
    }

  } catch (err) {
    console.error('\n❌ Error:', err.message);
    console.error(err.stack);
  } finally {
    client.release();
    await pool.end();
  }
}

run().then(() => console.log('\nDone.'));
