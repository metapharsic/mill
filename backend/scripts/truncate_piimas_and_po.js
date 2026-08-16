require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const fs = require('fs');
const path = require('path');
const pool = require('../src/db/pool');

async function main() {
  console.log('====================================================');
  console.log(' MK PAPER MILL — PIIMAS & PO DATA TRUNCATION UTILITY ');
  console.log('====================================================\n');

  const client = await pool.connect();
  try {
    // 1. Snapshot / Backup current data
    console.log('[1/4] Creating backup snapshot of existing PIIMAS & PO tables...');
    const tablesToBackup = [
      'indents',
      'indent_items',
      'indent_audit_log',
      'store_indents',
      'store_indent_log',
      'purchase_orders',
      'po_items',
      'grn',
      'grn_items',
      'vendor_bills',
      'vendor_payments',
      'installed_assets'
    ];

    const snapshot = {
      timestamp: new Date().toISOString(),
      tables: {}
    };

    for (const tbl of tablesToBackup) {
      try {
        const { rows } = await client.query(`SELECT * FROM ${tbl}`);
        snapshot.tables[tbl] = rows;
        console.log(`  - Backed up ${tbl}: ${rows.length} rows`);
      } catch (err) {
        console.warn(`  - Warning backing up ${tbl}:`, err.message);
      }
    }

    const backupDir = path.resolve(__dirname, '../../database_backup');
    if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

    const timestampStr = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(backupDir, `pre_truncate_backup_${timestampStr}.json`);
    const latestBackupPath = path.join(backupDir, `pre_truncate_backup.json`);

    fs.writeFileSync(backupPath, JSON.stringify(snapshot, null, 2), 'utf8');
    fs.writeFileSync(latestBackupPath, JSON.stringify(snapshot, null, 2), 'utf8');
    console.log(`\nBackup saved successfully to:\n  -> ${backupPath}\n  -> ${latestBackupPath}\n`);

    // 2. Perform Atomic Truncation
    console.log('[2/4] Executing atomic TRUNCATE with RESTART IDENTITY CASCADE...');
    await client.query('BEGIN');

    // Remove any asset events linked to indent assets
    await client.query(`
      DELETE FROM asset_events 
      WHERE asset_id IN (SELECT id FROM installed_assets WHERE indent_id IS NOT NULL);
    `);

    // Remove installed assets linked to indents
    await client.query(`
      DELETE FROM installed_assets WHERE indent_id IS NOT NULL;
    `);

    // Truncate PIIMAS, PO, GRN, and P2P tables
    await client.query(`
      TRUNCATE TABLE 
        indents, 
        indent_items, 
        indent_audit_log, 
        store_indents, 
        store_indent_log, 
        purchase_orders, 
        po_items, 
        vendor_bills, 
        vendor_payments, 
        grn, 
        grn_items 
      RESTART IDENTITY CASCADE;
    `);

    // Remove test stock ledger transactions created by indents & POs
    await client.query(`
      DELETE FROM stock_ledger 
      WHERE reference_type IN ('indent', 'PO', 'indent_reversal') 
         OR (transaction_type = 'issue' AND remarks ILIKE 'Indent%');
    `);

    await client.query('COMMIT');
    console.log('Truncate completed and committed successfully!\n');

    // 3. Verify Table Counts
    console.log('[3/4] Verifying table counts post-truncation:');
    const verifyTables = [
      'indents',
      'indent_items',
      'indent_audit_log',
      'store_indents',
      'store_indent_log',
      'purchase_orders',
      'po_items',
      'grn',
      'grn_items',
      'vendor_bills',
      'vendor_payments',
      'installed_assets',
      'materials',
      'departments',
      'users'
    ];

    for (const tbl of verifyTables) {
      const { rows } = await client.query(`SELECT count(*) FROM ${tbl}`);
      console.log(`  - ${tbl.padEnd(20)}: ${rows[0].count} rows`);
    }

    // 4. Confirmation
    console.log('\n[4/4] SUCCESS: PIIMAS & PO data truncated cleanly.');
    console.log('      Next indent will start at IND-<YYYYMMDD>-0001');
    console.log('      Next PO will start at PO-<YYYYMMDD>-0001');
    console.log('      Master data and application logic remain 100% intact.\n');

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('\n[ERROR] Truncation failed, transaction rolled back:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
