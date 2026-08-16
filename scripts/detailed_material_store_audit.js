const fs = require('fs');
const path = require('path');
const xlsx = require(path.join(__dirname, '../backend/node_modules/xlsx'));
const { Pool } = require(path.join(__dirname, '../backend/node_modules/pg'));

const envFile = path.join(__dirname, '../backend/.env');
const env = {};
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (m && !line.trim().startsWith('#')) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

const pool = new Pool({
  host: env.DB_HOST || 'localhost',
  port: +(env.DB_PORT || 5432),
  database: env.DB_NAME || 'mk_paper_mill',
  user: env.DB_USER || 'postgres',
  password: env.DB_PASSWORD || 'postgres',
});

const reqDir = path.join(__dirname, '../Projects_Requirement');

async function auditAll() {
  console.log('========================================================================');
  console.log('📊 DEEP AUDIT: EXCEL MASTER SHEETS VS LIVE DATABASE');
  console.log('========================================================================\n');

  const { rows: dbMats } = await pool.query(`
    SELECT m.id, m.code, m.name, m.current_stock, m.unit_price, m.category_id, 
           c.name as cat_name, c.code as cat_code, p.name as parent_cat_name
    FROM materials m
    LEFT JOIN material_categories c ON m.category_id = c.id
    LEFT JOIN material_categories p ON c.parent_id = p.id
    WHERE m.is_active = true
  `);
  const dbMatMap = new Map();
  dbMats.forEach(m => dbMatMap.set(m.code?.trim().toUpperCase(), m));
  console.log(`Total Active Materials in DB: ${dbMats.length}`);

  // 1. MECHANICAL STORE (17 Sheets)
  console.log('\n--- 1. MECHANICAL STORE (17 Sheets) ---');
  const mechFile = path.join(reqDir, 'MECHANICAL STORE AUGUST-2026.xlsx');
  const mechWb = xlsx.readFile(mechFile);
  let totalMechExcel = 0;
  let totalMechMatched = 0;
  let mechMissing = [];

  for (const sheetName of mechWb.SheetNames) {
    const ws = mechWb.Sheets[sheetName];
    const rows = xlsx.utils.sheet_to_json(ws, { header: 1, defval: null });
    
    // Find header
    let headerIdx = -1;
    for (let r = 0; r < Math.min(rows.length, 10); r++) {
      if ((rows[r] || []).some(c => String(c || '').trim().toUpperCase().includes('ITEM CODE'))) {
        headerIdx = r;
        break;
      }
    }
    if (headerIdx === -1) continue;

    const header = rows[headerIdx].map(h => String(h || '').trim().toUpperCase());
    const codeIdx = header.findIndex(h => h.includes('ITEM CODE'));
    const nameIdx = header.findIndex(h => h.includes('ITEM WITH DETAIL') || h.includes('ITEM DETAILS') || h.includes('MATERIAL DETAILS') || h.includes('ITEM DETAIL'));

    let sheetCount = 0;
    let sheetMatched = 0;

    for (let r = headerIdx + 1; r < rows.length; r++) {
      const row = rows[r];
      if (!row) continue;
      const code = codeIdx !== -1 ? String(row[codeIdx] || '').trim() : '';
      if (!code || code.toUpperCase().includes('ITEM CODE') || code.toUpperCase() === 'TOTAL') continue;
      const name = nameIdx !== -1 ? String(row[nameIdx] || '').trim() : '';

      sheetCount++;
      totalMechExcel++;
      if (dbMatMap.has(code.toUpperCase())) {
        sheetMatched++;
        totalMechMatched++;
      } else {
        mechMissing.push({ sheet: sheetName, code, name });
      }
    }
    console.log(`   [Sheet: ${sheetName.padEnd(32)}] Excel Items: ${String(sheetCount).padStart(3)} | Matched in DB: ${String(sheetMatched).padStart(3)} | Missing: ${sheetCount - sheetMatched}`);
  }
  console.log(`\n⚙️ Mechanical Summary: Excel Total: ${totalMechExcel} | Matched: ${totalMechMatched} | Missing in DB: ${mechMissing.length}`);
  if (mechMissing.length > 0) console.log('Sample Missing Mechanical Items:', mechMissing.slice(0, 5));

  // 2. ELECTRICAL STORE (5 Sheets)
  console.log('\n--- 2. ELECTRICAL STORE (5 Sheets) ---');
  const elecFile = path.join(reqDir, 'ELECTRICAL STORES AUGUST-2026.xlsx');
  const elecWb = xlsx.readFile(elecFile);
  let totalElecExcel = 0;
  let totalElecMatched = 0;
  let elecMissing = [];

  for (const sheetName of elecWb.SheetNames) {
    const ws = elecWb.Sheets[sheetName];
    const rows = xlsx.utils.sheet_to_json(ws, { header: 1, defval: null });
    
    let headerIdx = -1;
    for (let r = 0; r < Math.min(rows.length, 10); r++) {
      if ((rows[r] || []).some(c => String(c || '').trim().toUpperCase().includes('ITEM CODE'))) {
        headerIdx = r;
        break;
      }
    }
    if (headerIdx === -1) continue;

    const header = rows[headerIdx].map(h => String(h || '').trim().toUpperCase());
    const codeIdx = header.findIndex(h => h.includes('ITEM CODE'));
    const nameIdx = header.findIndex(h => h.includes('ITEM DETAILS') || h.includes('ITEM WITH DETAIL') || h.includes('MATERIAL DETAILS') || h.includes('ITEM DETAIL'));

    let sheetCount = 0;
    let sheetMatched = 0;

    for (let r = headerIdx + 1; r < rows.length; r++) {
      const row = rows[r];
      if (!row) continue;
      const code = codeIdx !== -1 ? String(row[codeIdx] || '').trim() : '';
      if (!code || code.toUpperCase().includes('ITEM CODE') || code.toUpperCase() === 'TOTAL') continue;
      const name = nameIdx !== -1 ? String(row[nameIdx] || '').trim() : '';

      sheetCount++;
      totalElecExcel++;
      if (dbMatMap.has(code.toUpperCase())) {
        sheetMatched++;
        totalElecMatched++;
      } else {
        elecMissing.push({ sheet: sheetName, code, name });
      }
    }
    console.log(`   [Sheet: ${sheetName.padEnd(20)}] Excel Items: ${String(sheetCount).padStart(3)} | Matched in DB: ${String(sheetMatched).padStart(3)} | Missing: ${sheetCount - sheetMatched}`);
  }
  console.log(`\n⚡ Electrical Summary: Excel Total: ${totalElecExcel} | Matched: ${totalElecMatched} | Missing in DB: ${elecMissing.length}`);

  // 3. OTHER STORE SHEETS
  console.log('\n--- 3. OTHER STORES AUDIT ---');
  const simpleStores = [
    { file: 'CHEMICAL.xlsx', name: 'Chemical' },
    { file: 'CLOTHING.xlsx', name: 'Clothing' },
    { file: 'HYRRAULIC & PENEUMATIC.xlsx', name: 'Hydraulic & Pneumatic' },
    { file: 'STATIONERY ITEM.xlsx', name: 'Stationery' },
    { file: 'GENERAL.xlsx', name: 'General' },
  ];

  for (const s of simpleStores) {
    const ws = xlsx.readFile(path.join(reqDir, s.file)).Sheets[xlsx.readFile(path.join(reqDir, s.file)).SheetNames[0]];
    const rows = xlsx.utils.sheet_to_json(ws, { header: 1, defval: null });
    let matched = 0, missing = 0;
    let missingList = [];
    for (let r = 2; r < rows.length; r++) {
      const row = rows[r];
      if (!row) continue;
      const code = row[1]?.toString().trim();
      const name = row[2]?.toString().trim();
      if (!code || code.toUpperCase() === 'ITEM CODE' || code.toUpperCase() === 'TOTAL') continue;
      if (dbMatMap.has(code.toUpperCase())) {
        matched++;
      } else {
        missing++;
        missingList.push({ code, name });
      }
    }
    console.log(`📦 ${s.name.padEnd(25)}: Matched: ${matched} | Missing in DB: ${missing}`);
    if (missingList.length > 0) {
      console.log(`   Missing codes in DB:`, missingList.slice(0, 5));
    }
  }

  // 4. INWARD DESK TRANSACTIONS AUDIT
  console.log('\n--- 4. INWARD DESK TRANSACTIONS AUDIT ---');
  const inwWb = xlsx.readFile(path.join(reqDir, 'INWORD AUGUST-2026.xlsx'));
  const inwRows = xlsx.utils.sheet_to_json(inwWb.Sheets['Sheet1'], { header: 1, defval: null });
  let inwTotal = 0, inwMatched = 0, inwUnmatched = [];
  for (let r = 2; r < inwRows.length; r++) {
    const row = inwRows[r];
    if (!row) continue;
    const code = row[3]?.toString().trim();
    const name = row[4]?.toString().trim();
    const qty = parseFloat(row[7] || 0);
    if (!code || code.toUpperCase() === 'ITEM CODE' || code.toUpperCase() === 'TOTAL' || qty <= 0) continue;
    inwTotal++;
    if (dbMatMap.has(code.toUpperCase())) {
      inwMatched++;
    } else {
      inwUnmatched.push({ row: r + 1, code, name, qty });
    }
  }
  console.log(`📥 Inward Transactions: Total: ${inwTotal} | Matched Code in DB: ${inwMatched} | Unmatched: ${inwUnmatched.length}`);
  if (inwUnmatched.length > 0) {
    console.log('Sample Unmatched Inward Items:', inwUnmatched);
  }

  // 5. INVESTIGATE THE 5 STOCK LEDGER DRIFT ITEMS
  console.log('\n--- 5. INVESTIGATE 5 STOCK LEDGER DRIFT ITEMS ---');
  const driftItems = [
    { code: 'CHSTP001', name: 'STARCH', current_stock: 31287 },
    { code: 'CHPAS003', name: 'POLY ALUMINIUM CHLORIDE ( SOLID)', current_stock: 2578 },
    { code: 'CHASL018', name: 'ANTI SCALEN [3220] (L)', current_stock: 38 },
    { code: 'MV0002', name: '0.5" PISTON VALVES/ BELLOW SEAL GLOBE VALVE', current_stock: 27 },
    { code: 'BE0001', name: '2213-K-TVH-C3', current_stock: 5 }
  ];

  for (const it of driftItems) {
    const { rows: [mat] } = await pool.query(`SELECT id, code, name, current_stock FROM materials WHERE code = $1`, [it.code]);
    if (!mat) continue;
    const { rows: entries } = await pool.query(`SELECT id, date, transaction_type, in_qty, out_qty, balance, remarks FROM stock_ledger WHERE material_id = $1 ORDER BY id ASC`, [mat.id]);
    console.log(`\nCode: ${mat.code} (${mat.name}) - DB current_stock: ${mat.current_stock}`);
    console.table(entries);
  }

  await pool.end();
}

auditAll().catch(e => {
  console.error('Audit failed:', e);
  process.exit(1);
});
