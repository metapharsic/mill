/**
 * Deep Investigation: Missing PO, PR, DC, Inventory, Invoices for last 5+ days
 * Target window: 2026-08-28 → 2026-09-02
 */
const path = require('path');
const pool = require(path.join(__dirname, '../backend/src/db/pool'));

async function investigate() {
  const client = await pool.connect();
  const since = '2026-08-28';
  const today = '2026-09-02';
  
  console.log(`\n${'='.repeat(90)}`);
  console.log(`🔍 DEEP INVESTIGATION: Missing Records (${since} → ${today})`);
  console.log(`${'='.repeat(90)}\n`);

  // ─── 1. Purchase Requisitions / Indents ───
  console.log('━━━ 1. PURCHASE REQUISITIONS / INDENTS ━━━');
  const { rows: allPR } = await client.query(`
    SELECT i.id, i.indent_number, i.status, d.name as department, 
           i.created_at::text as created_at
    FROM indents i
    LEFT JOIN departments d ON d.id = i.department_id
    ORDER BY i.created_at DESC;
  `);
  const totalPR = allPR.length;
  const recentPR = allPR.filter(r => r.created_at >= since);
  console.log(`  Total PR/Indents in DB: ${totalPR}`);
  console.log(`  Records created since ${since}: ${recentPR.length}`);
  if (recentPR.length === 0) {
    console.log('  ⚠️  NO PR/Indents found in last 5 days!');
  } else {
    recentPR.forEach(r => console.log(`    ✅ PR #${r.indent_number} | Status: ${r.status} | Dept: ${r.department} | Created: ${r.created_at.substring(0, 19)}`));
  }
  console.log('  Latest 10 by created_at:');
  allPR.slice(0, 10).forEach(r => console.log(`    ${r.indent_number} | ${r.status} | ${r.created_at.substring(0, 19)}`));

  // ─── 2. Purchase Orders ───
  console.log('\n━━━ 2. PURCHASE ORDERS ━━━');
  const { rows: allPO } = await client.query(`
    SELECT po.id, po.po_number, po.status, po.date::text as po_date, 
           po.created_at::text as created_at, v.name as vendor
    FROM purchase_orders po
    LEFT JOIN vendors v ON v.id = po.vendor_id
    ORDER BY po.created_at DESC;
  `);
  const recentPO = allPO.filter(r => r.created_at >= since);
  console.log(`  Total POs in DB: ${allPO.length}`);
  console.log(`  Records created since ${since}: ${recentPO.length}`);
  if (recentPO.length === 0) {
    console.log('  ⚠️  NO Purchase Orders found in last 5 days!');
  } else {
    recentPO.forEach(r => console.log(`    ✅ PO #${r.po_number} | Status: ${r.status} | Vendor: ${r.vendor} | Created: ${r.created_at.substring(0, 19)}`));
  }
  console.log('  Latest 10 by created_at:');
  allPO.slice(0, 10).forEach(r => console.log(`    ${r.po_number} | ${r.status} | PO Date: ${r.po_date} | Created: ${r.created_at.substring(0, 19)} | ${r.vendor}`));

  // ─── 3. Gate Passes / Delivery Challans ───
  console.log('\n━━━ 3. GATE PASSES / DELIVERY CHALLANS ━━━');
  const { rows: allGP } = await client.query(`
    SELECT gp.id, gp.gp_number, gp.pass_type, gp.status, gp.challan_number, 
           gp.invoice_number, gp.created_at::text as created_at, v.name as vendor,
           po.po_number
    FROM gate_passes gp
    LEFT JOIN vendors v ON v.id = gp.vendor_id
    LEFT JOIN purchase_orders po ON po.id = gp.po_id
    ORDER BY gp.created_at DESC;
  `);
  const recentGP = allGP.filter(r => r.created_at >= since);
  console.log(`  Total Gate Passes in DB: ${allGP.length}`);
  console.log(`  Records created since ${since}: ${recentGP.length}`);
  if (recentGP.length === 0) {
    console.log('  ⚠️  NO Gate Passes/DCs found in last 5 days!');
  } else {
    recentGP.forEach(r => console.log(`    ✅ GP #${r.gp_number} | Type: ${r.pass_type} | Status: ${r.status} | Challan: ${r.challan_number} | Created: ${r.created_at.substring(0, 19)}`));
  }
  console.log('  Latest 10 by created_at:');
  allGP.slice(0, 10).forEach(r => console.log(`    ${r.gp_number} | ${r.pass_type} | ${r.status} | Challan: ${r.challan_number || 'N/A'} | Created: ${r.created_at.substring(0, 19)}`));

  // ─── 4. GRN (Loaded Inventory) ───
  console.log('\n━━━ 4. GRN / LOADED INVENTORY ━━━');
  const { rows: allGRN } = await client.query(`
    SELECT g.id, g.grn_number, g.status, g.date::text as grn_date, 
           g.created_at::text as created_at, v.name as vendor,
           (SELECT COUNT(*) FROM grn_items gi WHERE gi.grn_id = g.id) as item_count,
           gp.gp_number
    FROM grn g
    LEFT JOIN vendors v ON v.id = g.vendor_id
    LEFT JOIN gate_passes gp ON gp.id = g.gate_pass_id
    ORDER BY g.created_at DESC;
  `);
  const recentGRN = allGRN.filter(r => r.created_at >= since);
  console.log(`  Total GRNs in DB: ${allGRN.length}`);
  console.log(`  Records created since ${since}: ${recentGRN.length}`);
  if (recentGRN.length === 0) {
    console.log('  ⚠️  NO GRNs found in last 5 days!');
  } else {
    recentGRN.forEach(r => console.log(`    ✅ GRN #${r.grn_number} | Status: ${r.status} | Items: ${r.item_count} | Vendor: ${r.vendor} | Created: ${r.created_at.substring(0, 19)}`));
  }
  console.log('  Latest 10 by created_at:');
  allGRN.slice(0, 10).forEach(r => console.log(`    ${r.grn_number} | ${r.status} | Date: ${r.grn_date} | Created: ${r.created_at.substring(0, 19)} | ${r.vendor} | Items: ${r.item_count}`));

  // ─── 5. Invoices / Vendor Bills ───
  console.log('\n━━━ 5. INVOICES / VENDOR BILLS ━━━');
  const { rows: allBills } = await client.query(`
    SELECT vb.id, vb.bill_number, vb.status, vb.invoice_date::text as inv_date, 
           vb.created_at::text as created_at, vb.total_amount,
           v.name as vendor, vb.grn_id, vb.vendor_invoice_number
    FROM vendor_bills vb
    LEFT JOIN vendors v ON v.id = vb.vendor_id
    ORDER BY vb.created_at DESC;
  `);
  const recentBills = allBills.filter(r => r.created_at >= since);
  console.log(`  Total Vendor Bills in DB: ${allBills.length}`);
  console.log(`  Records created since ${since}: ${recentBills.length}`);
  if (recentBills.length === 0) {
    console.log('  ⚠️  NO Invoices/Bills found in last 5 days!');
  } else {
    recentBills.forEach(r => console.log(`    ✅ Bill #${r.bill_number} | Status: ${r.status} | Inv: ${r.vendor_invoice_number} | ₹${Number(r.total_amount).toLocaleString('en-IN')} | Created: ${r.created_at.substring(0, 19)}`));
  }
  console.log('  Latest 10 by created_at:');
  allBills.slice(0, 10).forEach(r => console.log(`    ${r.bill_number} | ${r.status} | Inv Date: ${r.inv_date} | Created: ${r.created_at.substring(0, 19)} | ₹${Number(r.total_amount).toLocaleString('en-IN')}`));

  // ─── 6. Stock Ledger Recent Activity ───
  console.log('\n━━━ 6. STOCK LEDGER — RECENT ACTIVITY ━━━');
  const { rows: ledgerByDay } = await client.query(`
    SELECT created_at::date::text as date, 
           COUNT(*) as entries,
           SUM(COALESCE(in_qty, 0)) as inward_qty,
           SUM(COALESCE(out_qty, 0)) as outward_qty,
           COUNT(DISTINCT material_id) as materials_affected
    FROM stock_ledger
    GROUP BY created_at::date
    ORDER BY date DESC
    LIMIT 15;
  `);
  console.log('  Daily breakdown (most recent 15 days):');
  ledgerByDay.forEach(r => {
    const flag = r.date >= since ? '✅' : '  ';
    console.log(`    ${flag} ${r.date} | ${r.entries} entries | Inward: ${Number(r.inward_qty).toFixed(1)} | Outward: ${Number(r.outward_qty).toFixed(1)} | Materials: ${r.materials_affected}`);
  });
  const { rows: totalLedger } = await client.query('SELECT COUNT(*) as total, MIN(created_at)::date::text as earliest, MAX(created_at)::date::text as latest FROM stock_ledger');
  console.log(`  Total ledger: ${totalLedger[0].total} entries | Earliest: ${totalLedger[0].earliest} | Latest: ${totalLedger[0].latest}`);

  // ─── 7. Date Distribution Summary ───
  console.log('\n━━━ 7. DATE DISTRIBUTION ACROSS ALL KEY TABLES ━━━');
  const dateQueries = [
    { name: 'Indents (PR)', query: `SELECT MIN(created_at)::date::text as earliest, MAX(created_at)::date::text as latest, COUNT(*) as total FROM indents` },
    { name: 'Purchase Orders', query: `SELECT MIN(created_at)::date::text as earliest, MAX(created_at)::date::text as latest, COUNT(*) as total FROM purchase_orders` },
    { name: 'Gate Passes', query: `SELECT MIN(created_at)::date::text as earliest, MAX(created_at)::date::text as latest, COUNT(*) as total FROM gate_passes` },
    { name: 'GRN', query: `SELECT MIN(created_at)::date::text as earliest, MAX(created_at)::date::text as latest, COUNT(*) as total FROM grn` },
    { name: 'Vendor Bills', query: `SELECT MIN(created_at)::date::text as earliest, MAX(created_at)::date::text as latest, COUNT(*) as total FROM vendor_bills` },
    { name: 'Stock Ledger', query: `SELECT MIN(created_at)::date::text as earliest, MAX(created_at)::date::text as latest, COUNT(*) as total FROM stock_ledger` },
    { name: 'Materials', query: `SELECT MIN(created_at)::date::text as earliest, MAX(created_at)::date::text as latest, COUNT(*) as total FROM materials` },
    { name: 'Store Issues', query: `SELECT MIN(created_at)::date::text as earliest, MAX(created_at)::date::text as latest, COUNT(*) as total FROM store_issues` },
  ];
  for (const dq of dateQueries) {
    const { rows } = await client.query(dq.query);
    const r = rows[0];
    if (Number(r.total) === 0) {
      console.log(`  ⬜ ${dq.name.padEnd(20)} | 0 records`);
      continue;
    }
    const gap = Math.floor((new Date(today) - new Date(r.latest)) / 86400000);
    const flag = gap > 5 ? '🔴' : gap > 2 ? '🟡' : '🟢';
    console.log(`  ${flag} ${dq.name.padEnd(20)} | ${String(r.total).padStart(5)} records | Earliest: ${r.earliest} | Latest: ${r.latest} | Gap: ${gap} days`);
  }

  // ─── 8. Check JSON backups for newer data ───
  console.log('\n━━━ 8. JSON BACKUP FILES — CHECKING FOR NEWER DATA ━━━');
  const fs = require('fs');
  const jsonDir = path.join(__dirname, '../database_backup/json_tables');
  if (fs.existsSync(jsonDir)) {
    const manifest = path.join(jsonDir, '_manifest.json');
    if (fs.existsSync(manifest)) {
      const m = JSON.parse(fs.readFileSync(manifest, 'utf-8'));
      console.log(`  Manifest export date: ${m.exported_at}`);
      const checkFiles = ['purchase_orders.json', 'indents.json', 'gate_passes.json', 'grn.json', 'vendor_bills.json', 'stock_ledger.json'];
      for (const f of checkFiles) {
        const fp = path.join(jsonDir, f);
        if (fs.existsSync(fp)) {
          const data = JSON.parse(fs.readFileSync(fp, 'utf-8'));
          const dates = data.map(r => r.created_at).filter(Boolean).sort().reverse();
          const latestInBackup = dates[0] ? dates[0].substring(0, 10) : 'N/A';
          const dbCount = f === 'purchase_orders.json' ? allPO.length : f === 'indents.json' ? allPR.length : f === 'gate_passes.json' ? allGP.length : f === 'grn.json' ? allGRN.length : f === 'vendor_bills.json' ? allBills.length : '?';
          const diff = data.length - dbCount;
          const diffFlag = diff > 0 ? `🔴 BACKUP HAS ${diff} MORE RECORDS!` : diff < 0 ? `🟢 DB has ${Math.abs(diff)} more` : '✅ Same count';
          console.log(`  ${f.padEnd(25)} | Backup: ${String(data.length).padStart(5)} | DB: ${String(dbCount).padStart(5)} | ${diffFlag} | Latest in backup: ${latestInBackup}`);
        }
      }
    }
  }

  // ─── 9. Check checkpoint.json ───
  console.log('\n━━━ 9. CHECKPOINT STATUS ━━━');
  const cpFile = path.join(__dirname, '../checkpoint.json');
  if (fs.existsSync(cpFile)) {
    const cp = JSON.parse(fs.readFileSync(cpFile, 'utf-8'));
    console.log(`  Checkpoint date: ${cp.timestamp || cp.created_at || 'unknown'}`);
    if (cp.tables) {
      const keys = Object.keys(cp.tables).slice(0, 15);
      keys.forEach(k => console.log(`    ${k}: ${cp.tables[k]} records`));
    }
  }

  // ─── 10. Check Excel inward register for missing data ───
  console.log('\n━━━ 10. EXCEL INWARD REGISTER — MISSING ENTRIES ━━━');
  let xlsx;
  try { xlsx = require('xlsx'); } catch { xlsx = require(path.join(__dirname, '../backend/node_modules/xlsx')); }
  const xlsDir = path.join(__dirname, '../database_backup');
  const xlsFiles = fs.readdirSync(xlsDir).filter(f => f.endsWith('.xlsx') || f.endsWith('.xls'));
  for (const xf of xlsFiles) {
    const wb = xlsx.readFile(path.join(xlsDir, xf));
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const data = xlsx.utils.sheet_to_json(sheet, { defval: '' });
    console.log(`  File: ${xf} | Sheets: ${wb.SheetNames.join(', ')} | Rows: ${data.length}`);
    // Show last 5 rows to see latest entries
    const headers = Object.keys(data[0] || {});
    console.log(`  Headers: ${headers.slice(0, 8).join(' | ')}`);
    console.log('  Last 5 entries:');
    data.slice(-5).forEach((r, i) => {
      const vals = headers.slice(0, 6).map(h => String(r[h] || '').substring(0, 25));
      console.log(`    [${data.length - 5 + i + 1}] ${vals.join(' | ')}`);
    });
  }

  client.release();
  await pool.end();
  console.log(`\n${'='.repeat(90)}`);
  console.log('🔍 INVESTIGATION COMPLETE');
  console.log(`${'='.repeat(90)}\n`);
}

investigate().catch(e => { console.error('Investigation Error:', e); process.exit(1); });
