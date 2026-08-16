#!/usr/bin/env node
/**
 * DB MIGRATE — apply incremental SQL migrations in order, once each.
 *
 * Runs every db/*.sql EXCEPT schema.sql (that is the base, use `npm run db:init`).
 * Tracks applied files in table `schema_migrations` so re-running is safe (skips done).
 * Each file runs in its own transaction — one bad statement rolls back that file only.
 *
 * Run:  node scripts/migrate.js          (apply pending)
 *       node scripts/migrate.js --status (list applied vs pending, apply nothing)
 * Exit: 0 ok · 1 a migration failed · 2 DB unreachable
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DB_DIR = path.join(ROOT, 'db');
const ENV_FILE = path.join(ROOT, 'backend', '.env');

let Pool;
try { ({ Pool } = require('pg')); }
catch { ({ Pool } = require(path.join(ROOT, 'backend', 'node_modules', 'pg'))); }

function readEnv() {
  const env = {};
  if (fs.existsSync(ENV_FILE))
    for (const line of fs.readFileSync(ENV_FILE, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
      if (m && !line.trim().startsWith('#')) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  return env;
}

// migration files: all db/*.sql except schema.sql, ordered.
// Explicit priority first (dependencies), then anything else alphabetical.
function migrationFiles() {
  if (!fs.existsSync(DB_DIR)) return [];
  const all = fs.readdirSync(DB_DIR).filter(f => f.endsWith('.sql') && f.toLowerCase() !== 'schema.sql');
  const priority = ['phase3_migration.sql', 'migration_phase14.sql'];
  const head = priority.filter(f => all.includes(f));
  const rest = all.filter(f => !priority.includes(f)).sort();
  return [...head, ...rest];
}

async function main() {
  const env = readEnv();
  const cfg = {
    host: env.DB_HOST || 'localhost',
    port: +(env.DB_PORT || 5432),
    database: env.DB_NAME || 'mk_paper_mill',
    user: env.DB_USER || 'postgres',
    password: env.DB_PASSWORD || 'postgres',
    connectionTimeoutMillis: 4000,
  };
  const statusOnly = process.argv.includes('--status');

  const pool = new Pool(cfg);
  let client;
  try { client = await pool.connect(); }
  catch (e) {
    console.error('❌ DB UNREACHABLE:', e.message);
    console.error('Check PostgreSQL running + backend/.env DB_* values.');
    process.exit(2);
  }

  try {
    await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      filename TEXT PRIMARY KEY,
      applied_at TIMESTAMP DEFAULT NOW()
    )`);

    const applied = new Set(
      (await client.query('SELECT filename FROM schema_migrations')).rows.map(r => r.filename)
    );
    const files = migrationFiles();
    const pending = files.filter(f => !applied.has(f));

    console.log(`DB: ${cfg.user}@${cfg.host}:${cfg.port}/${cfg.database}`);
    console.log(`Migrations: ${files.length} total · ${applied.size} applied · ${pending.length} pending`);
    for (const f of files) console.log(`  ${applied.has(f) ? '✅' : '⬜'} ${f}`);

    if (statusOnly) { console.log('\n(status only — nothing applied)'); return; }
    if (!pending.length) { console.log('\n✅ Nothing to apply. Up to date.'); return; }

    for (const f of pending) {
      const sql = fs.readFileSync(path.join(DB_DIR, f), 'utf8');
      process.stdout.write(`\nApplying ${f} ... `);
      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [f]);
        await client.query('COMMIT');
        console.log('OK');
      } catch (e) {
        await client.query('ROLLBACK');
        console.log('FAILED');
        console.error(`  ↳ ${e.message}`);
        process.exitCode = 1;
        break; // stop on first failure — keep DB consistent
      }
    }
    console.log('\nDone.');
  } finally {
    client.release();
    await pool.end().catch(() => {});
  }
}

main().catch(e => { console.error(e); process.exit(2); });
