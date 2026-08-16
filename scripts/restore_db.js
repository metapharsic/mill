/**
 * MK Paper Mill ERP - Database Restore Engine
 * Restores full database schema, tables, sequences, constraints, and data from mkmill_complete_dump.sql
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

let pgModule, dotenvModule;
try {
  pgModule = require('pg');
} catch {
  pgModule = require(path.join(__dirname, '../backend/node_modules/pg'));
}
try {
  dotenvModule = require('dotenv');
} catch {
  dotenvModule = require(path.join(__dirname, '../backend/node_modules/dotenv'));
}

const { Client } = pgModule;
dotenvModule.config({ path: path.join(__dirname, '../backend/.env') });

const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = parseInt(process.env.DB_PORT || '5432');
const DB_NAME = process.env.DB_NAME || 'mk_paper_mill';
const DB_USER = process.env.DB_USER || 'postgres';
const DB_PASSWORD = process.env.DB_PASSWORD || 'postgres';

const DUMP_PATH = path.join(__dirname, '../db/backups/mkmill_complete_dump.sql');

async function restoreDatabase() {
  console.log('================================================================');
  console.log('🚀 MK PAPER MILL ERP — DATABASE RESTORATION ENGINE');
  console.log('================================================================');
  console.log(`Target Host:     ${DB_HOST}:${DB_PORT}`);
  console.log(`Database Name:   ${DB_NAME}`);
  console.log(`Database User:   ${DB_USER}`);
  console.log(`Backup File:     ${DUMP_PATH}`);
  console.log('----------------------------------------------------------------');

  if (!fs.existsSync(DUMP_PATH)) {
    console.error(`❌ Backup file not found at: ${DUMP_PATH}`);
    process.exit(1);
  }

  // 1. Ensure target database exists
  const adminClient = new Client({
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    password: DB_PASSWORD,
    database: 'postgres'
  });

  try {
    await adminClient.connect();
    console.log('✅ Connected to PostgreSQL server');

    const checkDb = await adminClient.query(
      `SELECT 1 FROM pg_database WHERE datname = $1`,
      [DB_NAME]
    );

    if (checkDb.rows.length === 0) {
      console.log(`Creating database "${DB_NAME}"...`);
      await adminClient.query(`CREATE DATABASE "${DB_NAME}"`);
      console.log(`✅ Database "${DB_NAME}" created.`);
    } else {
      console.log(`Database "${DB_NAME}" verified.`);
    }
  } catch (err) {
    console.warn(`⚠️ Postgres admin check: ${err.message}`);
  } finally {
    try { await adminClient.end(); } catch {}
  }

  // 2. Method A: Try psql command-line first if available
  let psqlSuccess = false;
  try {
    console.log('Attempting native psql restoration...');
    process.env.PGPASSWORD = DB_PASSWORD;
    const cmd = `psql -U ${DB_USER} -h ${DB_HOST} -p ${DB_PORT} -d ${DB_NAME} -q -f "${DUMP_PATH}"`;
    execSync(cmd, { stdio: 'pipe' });
    psqlSuccess = true;
    console.log('✅ psql restoration completed successfully.');
  } catch (e) {
    console.log('ℹ️ psql CLI not available or errored, falling back to direct node pg driver restoration...');
  }

  // 3. Method B: Direct Node-pg execution if psql wasn't used
  if (!psqlSuccess) {
    const client = new Client({
      host: DB_HOST,
      port: DB_PORT,
      user: DB_USER,
      password: DB_PASSWORD,
      database: DB_NAME
    });

    try {
      await client.connect();
      console.log(`✅ Connected via node pg driver to database "${DB_NAME}"`);
      console.log('Executing filtered restoration SQL (stripping psql meta-commands)...');

      const rawSql = fs.readFileSync(DUMP_PATH, 'utf8');
      // Strip out psql meta commands: \set, \connect, \restrict, \echo, etc.
      const cleanSql = rawSql
        .split('\n')
        .filter(line => !line.trim().startsWith('\\'))
        .join('\n');

      await client.query(cleanSql);
      console.log('✅ Direct node pg restoration completed successfully.');
    } catch (err) {
      console.error(`❌ Restoration error: ${err.message}`);
      process.exit(1);
    } finally {
      try { await client.end(); } catch {}
    }
  }

  // 4. Verify restored state
  const verifyClient = new Client({
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    password: DB_PASSWORD,
    database: DB_NAME
  });

  try {
    await verifyClient.connect();
    const { rows: matCount } = await verifyClient.query('SELECT COUNT(*) FROM materials');
    const { rows: userCount } = await verifyClient.query('SELECT COUNT(*) FROM users');
    const { rows: catCount } = await verifyClient.query('SELECT COUNT(*) FROM material_categories');
    const { rows: valRow } = await verifyClient.query('SELECT COALESCE(SUM(current_stock * unit_price), 0) AS total_val FROM materials WHERE is_active = true');

    console.log('----------------------------------------------------------------');
    console.log('🎉 VERIFICATION SUMMARY:');
    console.log(`📦 Restored Active Materials:  ${matCount[0]?.count || 0}`);
    console.log(`📂 Restored Categories:        ${catCount[0]?.count || 0}`);
    console.log(`👥 Restored ERP Users:         ${userCount[0]?.count || 0}`);
    console.log(`💰 Live Total Stock Valuation: ₹${Number(valRow[0]?.total_val || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`);
    console.log('================================================================\n');
  } catch (e) {
    console.warn('Verification query note:', e.message);
  } finally {
    try { await verifyClient.end(); } catch {}
  }
}

restoreDatabase();
