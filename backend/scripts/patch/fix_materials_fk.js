/**
 * fix_materials_fk.js
 * -------------------
 * Deletes junk material rows while safely handling FK constraints.
 * For each junk material_id referenced in child tables, we SET material_id = NULL
 * (or delete the child row if NULL is not allowed) before deleting the material.
 *
 * Run: node scripts/fix_materials_fk.js           → DRY RUN
 *      node scripts/fix_materials_fk.js --apply   → APPLY
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

function isRealCode(code) {
  if (!code || code.trim() === '') return false;
  return /[a-zA-Z]/.test(code.trim());
}

async function run() {
  const client = await pool.connect();
  try {
    // Rows to delete: pure-numeric name AND no real alphabetical code
    const { rows: toDelete } = await client.query(`
      SELECT id, code, name FROM materials
      WHERE (name ~ '^[0-9]+$' AND code !~ '[a-zA-Z]')
         OR LOWER(TRIM(name)) = 'example'
      ORDER BY id
    `);

    console.log(`\nJunk rows to delete: ${toDelete.length}`);
    const ids = toDelete.map(r => r.id);

    if (ids.length === 0) {
      console.log('Nothing to do.');
      return;
    }

    // Find all tables that reference materials(id)
    const { rows: fkInfo } = await client.query(`
      SELECT
        tc.table_name AS child_table,
        kcu.column_name AS fk_column,
        rc.delete_rule
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
      JOIN information_schema.referential_constraints rc
        ON tc.constraint_name = rc.constraint_name
      JOIN information_schema.key_column_usage rcu
        ON rc.unique_constraint_name = rcu.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND rcu.table_name = 'materials'
        AND rcu.column_name = 'id'
        AND tc.table_schema = 'public'
    `);

    console.log('\nFK references to materials(id):');
    fkInfo.forEach(f => console.log(`  ${f.child_table}.${f.fk_column}  (ON DELETE ${f.delete_rule})`));

    if (!APPLY) {
      // Show which child rows would be affected
      for (const fk of fkInfo) {
        const { rows: affected } = await client.query(
          `SELECT COUNT(*) as cnt FROM ${fk.child_table} WHERE ${fk.fk_column} = ANY($1::int[])`,
          [ids]
        );
        console.log(`  Affected rows in ${fk.child_table}: ${affected[0].cnt}`);
      }
      console.log('\n⚠️  DRY RUN — run with --apply to execute.');
      return;
    }

    // APPLY
    await client.query('BEGIN');
    try {
      // For each FK child table: try SET NULL, fallback to DELETE
      for (const fk of fkInfo) {
        // Check if the FK column is nullable
        const { rows: colInfo } = await client.query(`
          SELECT is_nullable
          FROM information_schema.columns
          WHERE table_schema='public' AND table_name=$1 AND column_name=$2
        `, [fk.child_table, fk.fk_column]);

        const isNullable = colInfo[0]?.is_nullable === 'YES';
        const { rows: affected } = await client.query(
          `SELECT COUNT(*) as cnt FROM ${fk.child_table} WHERE ${fk.fk_column} = ANY($1::int[])`,
          [ids]
        );
        const cnt = parseInt(affected[0].cnt);

        if (cnt === 0) continue;

        if (isNullable) {
          await client.query(
            `UPDATE ${fk.child_table} SET ${fk.fk_column} = NULL WHERE ${fk.fk_column} = ANY($1::int[])`,
            [ids]
          );
          console.log(`  SET NULL: ${cnt} rows in ${fk.child_table}.${fk.fk_column}`);
        } else {
          await client.query(
            `DELETE FROM ${fk.child_table} WHERE ${fk.fk_column} = ANY($1::int[])`,
            [ids]
          );
          console.log(`  DELETED: ${cnt} orphan rows from ${fk.child_table}`);
        }
      }

      // Now delete the junk materials
      const result = await client.query(
        'DELETE FROM materials WHERE id = ANY($1::int[])',
        [ids]
      );
      console.log(`\n🗑️  Deleted ${result.rowCount} junk material rows.`);

      await client.query('COMMIT');
      console.log('✅ Transaction committed.');

    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    }

    // Final count
    const { rows: total } = await client.query('SELECT COUNT(*) as cnt FROM materials');
    console.log(`\n📊 Total materials remaining: ${total[0].cnt}`);

  } catch (err) {
    console.error('\n❌ Error:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

run().then(() => console.log('\nDone.'));
