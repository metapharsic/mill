#!/usr/bin/env node
// Pre-deploy green-light check. Exit 0 = OK. Exit 1 = blocked.
'use strict';
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const ROOT = path.join(__dirname, '..');
let ok = true;

function pass(msg) { console.log(`  [PASS] ${msg}`); }
function fail(msg) { console.error(`  [FAIL] ${msg}`); ok = false; }
function warn(msg) { console.warn(`  [WARN] ${msg}`); }

console.log('\n=== MK Paper Mill ERP — Pre-deploy Preflight ===\n');

// 1. Node version
const [major] = process.versions.node.split('.').map(Number);
major >= 18 ? pass(`Node ${process.version}`) : fail(`Node >=18 required, got ${process.version}`);

// 2. Required env vars
let dotenv;
try { dotenv = require('dotenv'); }
catch { dotenv = require(path.join(ROOT, 'backend', 'node_modules', 'dotenv')); }

const envFile = path.join(ROOT, 'backend', '.env');
if (fs.existsSync(envFile)) {
  dotenv.config({ path: envFile });
  pass('.env loaded');
} else {
  warn('.env not found — using process env');
}
const REQUIRED_ENV = ['DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER', 'DB_PASSWORD', 'JWT_SECRET'];
for (const k of REQUIRED_ENV) {
  process.env[k] ? pass(`env ${k} set`) : fail(`env ${k} missing`);
}
const SECRET = process.env.JWT_SECRET || '';
const DEFAULT = 'change_this_to_a_secure_64_char_random_string';
if (SECRET === DEFAULT) fail('JWT_SECRET is still the default placeholder');
else if (SECRET.length < 32)  fail('JWT_SECRET too short (<32 chars)');

// 3. DB connectivity
try {
  let Pool;
  try { ({ Pool } = require('pg')); }
  catch { ({ Pool } = require(path.join(ROOT, 'backend', 'node_modules', 'pg'))); }

  const pool = new Pool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    connectionTimeoutMillis: 5000,
  });
  pool.query('SELECT 1').then(() => {
    pass('DB connection OK');
    pool.end();
    afterDb();
  }).catch(e => {
    fail(`DB connection failed: ${e.message}`);
    afterDb();
  });
} catch (e) {
  fail(`pg module error: ${e.message}`);
  afterDb();
}

function afterDb() {
  // 4. schema_migrations table exists (migrationss applied)
  try {
    const result = execSync(
      `node "${path.join(__dirname, 'migrate.js')}" --status`,
      { cwd: ROOT, encoding: 'utf8', timeout: 15000 }
    );
    pass('Migration status check passed');
    if (result.includes('PENDING')) warn('Pending migrations exist — run npm run db:migrate first');
  } catch (e) {
    fail(`Migration check failed: ${e.message.split('\n')[0]}`);
  }

  // 5. Frontend build exists (production serve)
  const dist = path.join(ROOT, 'frontend', 'dist', 'index.html');
  fs.existsSync(dist) ? pass('Frontend dist built') : fail('frontend/dist/index.html missing — run: cd frontend && npm run build');

  // 6. CORS_ORIGIN set in production
  if (process.env.NODE_ENV === 'production' && !process.env.CORS_ORIGIN) {
    warn('CORS_ORIGIN not set — all cross-origin requests will be blocked in production');
  }

  // 7. ecosystem.config.js present (pm2)
  const eco = path.join(ROOT, 'ecosystem.config.js');
  fs.existsSync(eco) ? pass('ecosystem.config.js found') : warn('ecosystem.config.js missing (needed for pm2 deploy)');

  // Done
  console.log(`\n${'─'.repeat(48)}`);
  if (ok) {
    console.log('  PREFLIGHT PASSED. Safe to deploy.\n');
    process.exit(0);
  } else {
    console.error('  PREFLIGHT FAILED. Fix above errors before deploying.\n');
    process.exit(1);
  }
}
