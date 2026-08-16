/**
 * MK Paper Mill ERP - Database Backup Engine
 * Generates an instantaneous SQL dump with schema & data in db/backups/
 */
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

try {
  require('dotenv').config({ path: path.join(__dirname, '../backend/.env') });
} catch {
  require(path.join(__dirname, '../backend/node_modules/dotenv')).config({ path: path.join(__dirname, '../backend/.env') });
}

const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = process.env.DB_PORT || '5432';
const DB_NAME = process.env.DB_NAME || 'mk_paper_mill';
const DB_USER = process.env.DB_USER || 'postgres';
const DB_PASSWORD = process.env.DB_PASSWORD || 'postgres';

const backupDir = path.join(__dirname, '../db/backups');
if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir, { recursive: true });
}

const timeStamp = new Date().toISOString().replace(/[:.]/g, '-');
const stampedDump = path.join(backupDir, `mkmill_dump_${timeStamp}.sql`);
const latestDump = path.join(backupDir, `mkmill_complete_dump.sql`);

console.log('================================================================');
console.log('📦 CREATING COMPLETE POSTGRESQL BACKUP...');
console.log('================================================================');

process.env.PGPASSWORD = DB_PASSWORD;
const cmd = `pg_dump -U ${DB_USER} -h ${DB_HOST} -p ${DB_PORT} -d ${DB_NAME} --clean --if-exists --inserts -f "${stampedDump}"`;

try {
  execSync(cmd, { stdio: 'inherit' });
  // Copy as latest dump
  fs.copyFileSync(stampedDump, latestDump);
  console.log(`✅ Snapshot saved to: ${stampedDump}`);
  console.log(`✅ Default latest dump updated: ${latestDump}`);
  console.log('================================================================\n');
} catch (err) {
  console.error('❌ Backup failed:', err.message);
  process.exit(1);
}
