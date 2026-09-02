const fs = require('fs');
const path = require('path');
const pool = require(path.join(__dirname, '../backend/src/db/pool'));

async function compareBackupVsDb() {
  const client = await pool.connect();
  const jsonDir = path.join(__dirname, '../database_backup/json_tables');
  
  console.log('='.repeat(90));
  console.log('🔍 COMPARING JSON BACKUPS vs LIVE DATABASE FOR LAST 5+ DAYS');
  console.log('='.repeat(90));

  const tables = [
    { file: 'purchase_orders.json', table: 'purchase_orders', numCol: 'po_number' },
    { file: 'indents.json', table: 'indents', numCol: 'indent_number' },
    { file: 'gate_passes.json', table: 'gate_passes', numCol: 'gp_number' },
    { file: 'grn.json', table: 'grn', numCol: 'grn_number' },
    { file: 'vendor_bills.json', table: 'vendor_bills', numCol: 'bill_number' },
    { file: 'materials.json', table: 'materials', numCol: 'code' },
    { file: 'stock_ledger.json', table: 'stock_ledger', numCol: 'id' }
  ];

  for (const t of tables) {
    const fp = path.join(jsonDir, t.file);
    if (!fs.existsSync(fp)) continue;
    const backupRows = JSON.parse(fs.readFileSync(fp, 'utf-8'));
    const { rows: dbRows } = await client.query(`SELECT COUNT(*) as count FROM ${t.table}`);
    const dbCount = parseInt(dbRows[0].count);
    
    // Check if any numbers in backup are missing in DB
    const { rows: dbNums } = await client.query(`SELECT ${t.numCol} FROM ${t.table}`);
    const dbSet = new Set(dbNums.map(r => String(r[t.numCol])));
    const missingInDb = backupRows.filter(r => !dbSet.has(String(r[t.numCol])));
    
    console.log(`\n📋 ${t.table.toUpperCase()} (${t.file})`);
    console.log(`   Backup rows: ${backupRows.length} | DB rows: ${dbCount} | Missing in DB: ${missingInDb.length}`);
    if (missingInDb.length > 0) {
      console.log(`   ⚠️ Missing items: ${missingInDb.slice(0, 5).map(m => m[t.numCol]).join(', ')}...`);
    } else {
      console.log(`   ✅ All backup records exist in PostgreSQL!`);
    }
  }

  client.release();
  await pool.end();
}

compareBackupVsDb().catch(console.error);
