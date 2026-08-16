const fs = require('fs');
const path = require('path');
const xlsx = require(path.join(__dirname, '../backend/node_modules/xlsx'));
const { Pool } = require(path.join(__dirname, '../backend/node_modules/pg'));

// Load .env
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

async function runValidation() {
  console.log('========================================================================');
  console.log('🔍 COMPREHENSIVE MATERIALS & STORE MANAGEMENT DATA VALIDATION REPORT');
  console.log('========================================================================\n');

  // 1. WAREHOUSES TABLE CHECK
  console.log('--- 1. DATABASE SCHEMA & TABLE INTEGRITY ---');
  const tableCheck = await pool.query(`
    SELECT table_name FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name IN ('warehouses', 'materials', 'material_categories', 'stock_ledger', 'indents', 'indent_items', 'store_issues', 'grn', 'grn_items', 'purchase_orders', 'po_items', 'installed_assets', 'store_indent_log')
  `);
  const foundTables = new Set(tableCheck.rows.map(r => r.table_name));
  console.log(`Core store/materials tables present: ${foundTables.size}/13`);
  if (!foundTables.has('warehouses')) {
    console.log('⚠️ ALERT: `warehouses` table is missing in DB! (Referenced in master.js)');
  } else {
    console.log('✅ `warehouses` table exists.');
  }

  // 2. MATERIALS MASTER DATA ANALYSIS
  console.log('\n--- 2. MATERIALS MASTER DATA ANALYSIS ---');
  const matStats = await pool.query(`
    SELECT 
      COUNT(*) as total_materials,
      COUNT(*) FILTER (WHERE is_active = true) as active_materials,
      COUNT(*) FILTER (WHERE is_active = false) as inactive_materials,
      COUNT(*) FILTER (WHERE current_stock < 0) as negative_stock_count,
      COUNT(*) FILTER (WHERE current_stock = 0) as zero_stock_count,
      COUNT(*) FILTER (WHERE current_stock > 0) as positive_stock_count,
      COUNT(*) FILTER (WHERE unit_price > 0) as priced_count,
      COUNT(*) FILTER (WHERE unit_price = 0 OR unit_price IS NULL) as unpriced_count,
      COALESCE(SUM(current_stock * unit_price), 0) as total_stock_valuation
    FROM materials
  `);
  console.log('Materials Summary:', matStats.rows[0]);

  // Check categories
  console.log('\n--- Category Distribution & Valuations ---');
  const catStats = await pool.query(`
    SELECT 
      COALESCE(p.name, c.name) as main_category,
      COUNT(m.id) as material_count,
      COUNT(m.id) FILTER (WHERE m.unit_price > 0) as priced_materials,
      COUNT(m.id) FILTER (WHERE m.unit_price = 0 OR m.unit_price IS NULL) as unpriced_materials,
      COALESCE(SUM(m.current_stock), 0) as total_stock_units,
      COALESCE(SUM(m.current_stock * m.unit_price), 0) as category_stock_value
    FROM materials m
    LEFT JOIN material_categories c ON m.category_id = c.id
    LEFT JOIN material_categories p ON c.parent_id = p.id
    WHERE m.is_active = true
    GROUP BY COALESCE(p.name, c.name)
    ORDER BY category_stock_value DESC, material_count DESC
  `);
  console.table(catStats.rows);

  // Check duplicates
  const dupCodes = await pool.query(`
    SELECT code, COUNT(*) as cnt 
    FROM materials 
    GROUP BY code 
    HAVING COUNT(*) > 1
  `);
  console.log(`Duplicate Material Codes: ${dupCodes.rows.length}`);
  if (dupCodes.rows.length > 0) console.log(dupCodes.rows);

  // 3. UNPRICED MATERIALS WITH RECOVERABLE PRICES
  console.log('\n--- 3. PRICE RECOVERABILITY CHECK ---');
  const recoverablePrices = await pool.query(`
    SELECT m.id, m.code, m.name, m.current_stock,
           (SELECT unit_price FROM po_items WHERE material_id = m.id AND unit_price > 0 ORDER BY id DESC LIMIT 1) as po_price,
           (SELECT unit_price FROM stock_ledger WHERE material_id = m.id AND unit_price > 0 ORDER BY id DESC LIMIT 1) as ledger_price,
           (SELECT unit_price FROM grn_items WHERE material_id = m.id AND unit_price > 0 ORDER BY id DESC LIMIT 1) as grn_price
    FROM materials m
    WHERE (m.unit_price = 0 OR m.unit_price IS NULL)
      AND (
        EXISTS (SELECT 1 FROM po_items WHERE material_id = m.id AND unit_price > 0)
        OR EXISTS (SELECT 1 FROM stock_ledger WHERE material_id = m.id AND unit_price > 0)
        OR EXISTS (SELECT 1 FROM grn_items WHERE material_id = m.id AND unit_price > 0)
      )
  `);
  console.log(`Unpriced materials with recoverable price from PO/GRN/Ledger: ${recoverablePrices.rows.length}`);
  if (recoverablePrices.rows.length > 0) {
    console.table(recoverablePrices.rows.slice(0, 10));
  }

  // 4. STOCK LEDGER RECONCILIATION & DRIFT CHECK
  console.log('\n--- 4. STOCK LEDGER RECONCILIATION & DRIFT AUDIT ---');
  const driftCheck = await pool.query(`
    WITH ledger_calc AS (
      SELECT 
        material_id,
        SUM(
          CASE 
            WHEN transaction_type IN ('inward', 'GRN', 'opening', 'Return', 'adjustment_plus', 'adjustment_add', 'initial', 'receipt') THEN in_qty
            WHEN transaction_type IN ('issue', 'Outward', 'adjustment_minus', 'adjustment_sub', 'consumption', 'dispatch') THEN -out_qty
            ELSE (in_qty - out_qty)
          END
        ) as calculated_balance,
        COUNT(*) as transaction_count
      FROM stock_ledger
      GROUP BY material_id
    )
    SELECT 
      m.id, m.code, m.name, m.current_stock,
      COALESCE(l.calculated_balance, 0) as ledger_balance,
      (m.current_stock - COALESCE(l.calculated_balance, 0)) as drift,
      COALESCE(l.transaction_count, 0) as tx_count
    FROM materials m
    LEFT JOIN ledger_calc l ON m.id = l.material_id
    WHERE m.is_active = true AND ABS(m.current_stock - COALESCE(l.calculated_balance, 0)) > 0.001
    ORDER BY ABS(m.current_stock - COALESCE(l.calculated_balance, 0)) DESC
  `);
  console.log(`Materials with Stock Ledger Drift: ${driftCheck.rows.length}`);
  if (driftCheck.rows.length > 0) {
    console.table(driftCheck.rows.slice(0, 15));
  } else {
    console.log('✅ PERFECT MATCH: 0 drift across all active materials.');
  }

  // 5. INDENT & STORE ISSUES CONSISTENCY
  console.log('\n--- 5. INDENT & STORE ISSUES LIFECYCLE AUDIT ---');
  const indentAudit = await pool.query(`
    SELECT 
      status, 
      COUNT(*) as count
    FROM indents
    GROUP BY status
    ORDER BY count DESC
  `);
  console.log('Indent Status Counts:');
  console.table(indentAudit.rows);

  // Inspect the 5 drifted materials
  console.log('\n--- Details of 5 Drifted Materials in Stock Ledger ---');
  for (const mId of [3111, 3112, 3130, 2706, 2128]) {
    const mInfo = await pool.query(`SELECT id, code, name, current_stock FROM materials WHERE id = $1`, [mId]);
    const lRows = await pool.query(`SELECT id, date, transaction_type, in_qty, out_qty, balance, remarks FROM stock_ledger WHERE material_id = $1 ORDER BY id ASC`, [mId]);
    console.log(`\nMaterial ${mInfo.rows[0]?.code} (${mInfo.rows[0]?.name}) - current_stock: ${mInfo.rows[0]?.current_stock}`);
    console.table(lRows.rows);
  }

  const indentItemsOrphans = await pool.query(`
    SELECT COUNT(*) as orphan_items
    FROM indent_items ii
    LEFT JOIN indents i ON ii.indent_id = i.id
    WHERE i.id IS NULL
  `);
  console.log(`Orphan Indent Items: ${indentItemsOrphans.rows[0].orphan_items}`);

  // 6. EXCEL REQUIREMENT FILES VS DATABASE SYNC
  console.log('\n--- 6. EXCEL REQUIREMENTS FILES VS DATABASE MATCHING ---');
  const excelFiles = [
    { file: 'CHEMICAL.xlsx', catName: 'Chemical', codeCol: 1, nameCol: 2, balCol: [9, 7, 5], startRow: 3 },
    { file: 'CLOTHING.xlsx', catName: 'Clothing', codeCol: 1, nameCol: 2, balCol: [10, 7], startRow: 2 },
    { file: 'ELECTRICAL STORES AUGUST-2026.xlsx', catName: 'Electrical', codeCol: 1, nameCol: 2, balCol: [8, 4], startRow: 2 },
    { file: 'GENERAL.xlsx', catName: 'General', codeCol: 1, nameCol: 2, balCol: [7, 4], startRow: 2 },
    { file: 'HYRRAULIC & PENEUMATIC.xlsx', catName: 'Hydraulic & Pneumatic', codeCol: 1, nameCol: 2, balCol: [7, 4], startRow: 2 },
    { file: 'MECHANICAL STORE AUGUST-2026.xlsx', catName: 'Mechanical', codeCol: 1, nameCol: 2, balCol: [7, 4], startRow: 2 },
    { file: 'STATIONERY ITEM.xlsx', catName: 'Stationary', codeCol: 1, nameCol: 2, balCol: [8, 4], startRow: 2 },
  ];

  const dbMatRows = (await pool.query(`SELECT id, code, name, current_stock, unit_price, is_active FROM materials`)).rows;
  const dbMatMap = new Map();
  dbMatRows.forEach(m => dbMatMap.set(m.code?.trim().toUpperCase(), m));

  for (const ef of excelFiles) {
    const filePath = path.join(reqDir, ef.file);
    if (!fs.existsSync(filePath)) {
      console.log(`❌ Missing Excel file: ${ef.file}`);
      continue;
    }
    const wb = xlsx.readFile(filePath);
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows = xlsx.utils.sheet_to_json(sheet, { header: 1 });

    let excelItems = 0;
    let matchedInDb = 0;
    let missingInDb = [];
    let stockMismatches = [];

    for (let i = ef.startRow; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length === 0) continue;
      const code = row[ef.codeCol]?.toString().trim();
      const name = row[ef.nameCol]?.toString().trim();
      if (!code || !name) continue;

      let balance = 0;
      for (const col of ef.balCol) {
        if (row[col] !== undefined && row[col] !== null && row[col] !== '') {
          balance = parseFloat(row[col]) || 0;
          break;
        }
      }

      excelItems++;
      const dbItem = dbMatMap.get(code.toUpperCase());
      if (!dbItem) {
        missingInDb.push({ code, name, balance });
      } else {
        matchedInDb++;
        if (Math.abs(Number(dbItem.current_stock) - balance) > 0.01) {
          stockMismatches.push({
            code,
            nameInExcel: name,
            nameInDb: dbItem.name,
            excelStock: balance,
            dbStock: Number(dbItem.current_stock),
            diff: Number(dbItem.current_stock) - balance
          });
        }
      }
    }

    console.log(`\n📁 File: ${ef.file} (${ef.catName})`);
    console.log(`   - Items in Excel: ${excelItems}`);
    console.log(`   - Matched in DB: ${matchedInDb}`);
    console.log(`   - Missing in DB: ${missingInDb.length}`);
    console.log(`   - Stock Balance Mismatches: ${stockMismatches.length}`);

    if (missingInDb.length > 0) {
      console.log(`   ⚠️ Sample Missing in DB (${missingInDb.length}):`, missingInDb.slice(0, 5));
    }
    if (stockMismatches.length > 0) {
      console.log(`   ⚠️ Sample Stock Mismatches (${stockMismatches.length}):`, stockMismatches.slice(0, 5));
    }
  }

  // 7. INWARD TRANSACTIONS AUDIT
  console.log('\n--- 7. INWARD DESK TRANSACTIONS AUDIT ---');
  const inwFile = path.join(reqDir, 'INWORD AUGUST-2026.xlsx');
  if (fs.existsSync(inwFile)) {
    const wb = xlsx.readFile(inwFile);
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const inwRows = xlsx.utils.sheet_to_json(sheet, { header: 1 });
    console.log(`INWORD AUGUST-2026.xlsx total rows: ${inwRows.length}`);
    let validInwRows = 0;
    let inwMatchedCode = 0;
    let inwUnmatchedCode = [];
    for (let i = 2; i < inwRows.length; i++) {
      const row = inwRows[i];
      if (!row || row.length === 0) continue;
      const date = row[1];
      const code = row[2]?.toString().trim();
      const desc = row[3]?.toString().trim();
      const qty = parseFloat(row[4] ?? 0) || 0;
      if (!code && !desc) continue;
      validInwRows++;
      if (code && dbMatMap.has(code.toUpperCase())) {
        inwMatchedCode++;
      } else {
        inwUnmatchedCode.push({ row: i + 1, date, code, desc, qty });
      }
    }
    console.log(`   - Valid Inward Rows in Excel: ${validInwRows}`);
    console.log(`   - Matched Material Code in DB: ${inwMatchedCode}`);
    console.log(`   - Unmatched / Missing Code in DB: ${inwUnmatchedCode.length}`);
    if (inwUnmatchedCode.length > 0) {
      console.log(`   ⚠️ Sample Unmatched Inward Rows:`, inwUnmatchedCode.slice(0, 5));
    }
  }

  console.log('\n========================================================================');
  console.log('VALIDATION COMPLETE');
  console.log('========================================================================');
  await pool.end();
}

runValidation().catch(err => {
  console.error('Validation error:', err);
  process.exit(1);
});
