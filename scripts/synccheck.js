#!/usr/bin/env node
/**
 * SYNC CHECK — tells developer if FILES and DATABASE TABLES are in sync.
 *
 * Checks:
 *   1. DB connectivity (can we reach mk_paper_mill?)            -> if broken, shout loud
 *   2. Schema vs DB    (CREATE TABLE in db/*.sql  vs  real tables)
 *   3. Route vs DB     (tables used in backend/src/routes/*.js  vs  real tables)
 *   4. Migrations      (did each migration's tables land in DB?)
 *
 * Run:  node scripts/synccheck.js
 * Exit: 0 = in sync · 1 = out of sync · 2 = DB unreachable
 * Side effect: writes SYNC_STATUS.md (so you can read last result without re-running).
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DB_DIR = path.join(ROOT, 'db');
const ROUTES_DIR = path.join(ROOT, 'backend', 'src', 'routes');
const ENV_FILE = path.join(ROOT, 'backend', '.env');
const OUT = path.join(ROOT, 'SYNC_STATUS.md');

// ---- load pg from backend ----
let Pool;
try { ({ Pool } = require('pg')); }
catch { ({ Pool } = require(path.join(ROOT, 'backend', 'node_modules', 'pg'))); }

// ---- minimal .env parse (no dotenv dep) ----
function readEnv() {
  const env = {};
  if (fs.existsSync(ENV_FILE)) {
    for (const line of fs.readFileSync(ENV_FILE, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
      if (m && !line.trim().startsWith('#')) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
  return env;
}

// ---- collect expected tables from db/*.sql CREATE TABLE ----
function expectedTables() {
  const map = {}; // table -> source file
  if (!fs.existsSync(DB_DIR)) return map;
  for (const f of fs.readdirSync(DB_DIR).filter(x => x.endsWith('.sql') && !x.startsWith('backup_'))) {
    const sql = fs.readFileSync(path.join(DB_DIR, f), 'utf8');
    // Strip comments to avoid false matches in comments
    const cleanSql = sql.replace(/--.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
    const re = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:[a-z0-9_]+\.)?([a-z_][a-z0-9_]*)/gi;
    let m; while ((m = re.exec(cleanSql))) map[m[1].toLowerCase()] = f;
  }
  return map;
}

// ---- collect tables referenced by each route file ----
const IGNORE = new Set(['information_schema', 'pg_catalog', 'dual', 'set', 'values']);
function routeTables() {
  const map = {}; // routeFile -> Set(tables)
  if (!fs.existsSync(ROUTES_DIR)) return map;
  for (const f of fs.readdirSync(ROUTES_DIR).filter(x => x.endsWith('.js'))) {
    const js = fs.readFileSync(path.join(ROUTES_DIR, f), 'utf8');
    const set = new Set();
    const re = /\b(?:FROM|JOIN|INTO|UPDATE)\s+([a-z_][a-z0-9_]*)/gi;
    let m; while ((m = re.exec(js))) {
      const t = m[1].toLowerCase();
      if (!IGNORE.has(t)) set.add(t);
    }
    map[f] = set;
  }
  return map;
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

  const out = [];
  const log = (...a) => { const s = a.join(' '); console.log(s); out.push(s); };

  log('# SYNC STATUS — MK Paper Mill ERP');
  log('');
  log(`Generated: ${new Date().toISOString()}`);
  log(`DB target: ${cfg.user}@${cfg.host}:${cfg.port}/${cfg.database}`);
  log('');

  // ---- 1. CONNECTIVITY ----
  const pool = new Pool(cfg);
  let liveTables;
  try {
    const r = await pool.query(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema='public' ORDER BY table_name`
    );
    liveTables = new Set(r.rows.map(x => x.table_name.toLowerCase()));
  } catch (e) {
    log('## ❌ DATABASE CONNECTIVITY: BROKEN');
    log('');
    log('```');
    log(String(e.message));
    log('```');
    log('Check: (1) PostgreSQL service running  (2) backend/.env DB_* values  (3) database exists.');
    fs.writeFileSync(OUT, out.join('\n'));
    await pool.end().catch(() => {});
    console.log(`\nWrote ${path.relative(ROOT, OUT)}  | VERDICT: DB UNREACHABLE`);
    process.exit(2);
  }
  log('## ✅ DATABASE CONNECTIVITY: OK');
  log(`Live tables in DB: ${liveTables.size}`);
  log('');

  const expected = expectedTables();
  const expSet = new Set(Object.keys(expected));
  const META = new Set(['schema_migrations']); // tool-managed, not part of app schema

  // ---- 2. SCHEMA vs DB ----
  const missingInDb = [...expSet].filter(t => !liveTables.has(t)).sort();   // declared, not created
  const extraInDb = [...liveTables].filter(t => !expSet.has(t) && !META.has(t)).sort(); // in DB, not declared

  log('## Schema files ↔ Database');
  log(`Declared in db/*.sql: ${expSet.size}  |  Live in DB: ${liveTables.size}`);
  log('');
  log(`### ${missingInDb.length ? '⚠️' : '✅'} Tables declared but MISSING in DB (run migration): ${missingInDb.length}`);
  for (const t of missingInDb) log(`- ${t}  (from ${expected[t]})`);
  log('');
  log(`### ${extraInDb.length ? 'ℹ️' : '✅'} Tables in DB but NOT in any schema file: ${extraInDb.length}`);
  for (const t of extraInDb) log(`- ${t}`);
  log('');

  // ---- 3. ROUTE vs DB ----
  // Only count a token as a real table if it is DECLARED in schema files OR LIVE in DB.
  // Kills false positives from JS identifiers / SQL aliases (router, so, schedule, ...).
  const routes = routeTables();
  const broken = []; // {route, table}
  const isRealTable = t => expSet.has(t) || liveTables.has(t);
  log('## Route files ↔ Database tables');
  log('| Route file | Tables used | Missing in DB |');
  log('|-----------|-------------|---------------|');
  for (const [f, set] of Object.entries(routes)) {
    const used = [...set].filter(isRealTable).sort();
    const miss = used.filter(t => !liveTables.has(t));   // real table, declared, but not in DB
    miss.forEach(t => broken.push({ route: f, table: t }));
    log(`| ${f} | ${used.length} | ${miss.length ? '❌ ' + miss.join(', ') : '—'} |`);
  }
  log('');

  // ---- 4. VERDICT ----
  const inSync = missingInDb.length === 0 && broken.length === 0;
  log('---');
  log('## VERDICT');
  if (inSync) {
    log('✅ IN SYNC — every declared + code-referenced table exists in DB.');
  } else {
    log('❌ OUT OF SYNC:');
    if (missingInDb.length) log(`  - ${missingInDb.length} declared table(s) not in DB → apply migrations.`);
    if (broken.length) {
      log(`  - ${broken.length} route→table reference(s) point to missing tables:`);
      for (const b of broken) log(`      ${b.route} → ${b.table}`);
    }
  }
  if (extraInDb.length) log(`ℹ️  ${extraInDb.length} extra table(s) in DB not described in schema files (document or drop).`);
  log('');
  log('Re-run: `node scripts/synccheck.js`');

  fs.writeFileSync(OUT, out.join('\n'));
  await pool.end().catch(() => {});
  console.log(`\nWrote ${path.relative(ROOT, OUT)}  | VERDICT: ${inSync ? 'IN SYNC' : 'OUT OF SYNC'}`);
  process.exit(inSync ? 0 : 1);
}

main().catch(e => { console.error(e); process.exit(2); });
