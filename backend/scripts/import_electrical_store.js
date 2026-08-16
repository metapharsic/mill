require('dotenv').config();
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const pool = require('../src/db/pool');

const DEFAULT_FILE = path.join(__dirname, '../../Projects_Requirement/ELECTRICAL STORES AUGUST-2026.xlsx');

const ELECTRICAL_SUBCATS = [
  { sheet: 'CONTACTOR', code: 'ELEC-CNT', name: 'Contactor', type: 'Electrical' },
  { sheet: 'RELAY', code: 'ELEC-RLY', name: 'Relay', type: 'Electrical' },
  { sheet: 'MCB', code: 'ELEC-MCB', name: 'MCB & Fuses', type: 'Electrical' },
  { sheet: 'ELE GENERAL', code: 'ELEC-GEN', name: 'Electrical General', type: 'Electrical' },
  { sheet: 'VFD DRIVE', code: 'ELEC-VFD', name: 'VFD Drive & Spares', type: 'Electrical' },
];

const DETAIL_HEADER_CANDIDATES = ['ITEM DETAILS', 'ITEM WITH DETAIL', 'MATERIAL DETAILS', 'ITEM DETAIL'];

function findHeaderRow(rows) {
  for (let r = 0; r < Math.min(rows.length, 10); r++) {
    const row = rows[r] || [];
    const hasCode = row.some(c => String(c || '').trim().toUpperCase().includes('ITEM CODE'));
    if (hasCode) return r;
  }
  return -1;
}

function colIndex(headerRow, candidates) {
  for (const cand of candidates) {
    const idx = headerRow.findIndex(h => String(h || '').trim().toUpperCase() === cand.toUpperCase());
    if (idx !== -1) return idx;
  }
  return -1;
}

async function ensureSubcategories() {
  // 1. Get or create parent 'Electrical' category
  let { rows: [parent] } = await pool.query("SELECT id FROM material_categories WHERE code='ELEC' OR name ILIKE 'Electrical' LIMIT 1");
  if (!parent) {
    const ins = await pool.query("INSERT INTO material_categories (name, code, type, parent_id) VALUES ('Electrical', 'ELEC', 'Spare Part', NULL) RETURNING id");
    parent = ins.rows[0];
  }
  const parentId = parent.id;

  // 2. Ensure each subcategory exists under parent
  const subcatMap = {};
  for (const sc of ELECTRICAL_SUBCATS) {
    let { rows: [exist] } = await pool.query("SELECT id FROM material_categories WHERE code=$1 OR (name ILIKE $2 AND parent_id=$3) LIMIT 1", [sc.code, sc.name, parentId]);
    if (!exist) {
      const ins = await pool.query("INSERT INTO material_categories (name, code, type, parent_id) VALUES ($1, $2, $3, $4) RETURNING id", [sc.name, sc.code, sc.type, parentId]);
      exist = ins.rows[0];
    } else {
      // Ensure parent_id is set to Electrical
      await pool.query("UPDATE material_categories SET parent_id=$1 WHERE id=$2", [parentId, exist.id]);
    }
    subcatMap[sc.sheet] = exist.id;
  }
  return { parentId, subcatMap };
}

async function importSheet(wb, scInfo, catId, dryRun) {
  const ws = wb.Sheets[scInfo.sheet];
  if (!ws) return { sheet: scInfo.sheet, error: 'Sheet not found' };

  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
  const headerRowIdx = findHeaderRow(rows);
  if (headerRowIdx === -1) return { sheet: scInfo.sheet, error: 'No ITEM CODE header found' };

  const header = rows[headerRowIdx].map(h => String(h || '').trim());
  const codeIdx = colIndex(header, ['ITEM CODE', 'ITEM CODE ']);
  const nameIdx = colIndex(header, DETAIL_HEADER_CANDIDATES);
  const hsnIdx = colIndex(header, ['HSN CODE', 'HSN']);
  const binIdx = colIndex(header, ['RACK/BOX NO', 'BOX NO', 'RACK NO', 'BIN LOCATION']);
  const stockIdx = colIndex(header, ['PHY STOCK', 'PHY QTY', 'BALANCE', 'PHYSICAL STOCK']);
  const recIdx = colIndex(header, ['RECIVED', 'RECEIVED']);
  const issIdx = colIndex(header, ['ISSUE', 'ISSUED']);

  let matched = 0, inserted = 0, nameUpdated = 0, stockUpdated = 0, skipped = 0;

  for (let r = headerRowIdx + 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row) continue;
    const code = codeIdx !== -1 ? String(row[codeIdx] || '').trim() : '';
    if (!code || code.toUpperCase().includes('ITEM CODE')) continue;

    const excelName = nameIdx !== -1 ? String(row[nameIdx] || '').trim() : '';
    const excelHsn = hsnIdx !== -1 ? String(row[hsnIdx] || '').trim() : '';
    const excelBin = binIdx !== -1 ? String(row[binIdx] || '').trim() : '';
    const excelStock = stockIdx !== -1 && row[stockIdx] != null ? Number(row[stockIdx]) : null;
    const excelRec = recIdx !== -1 && row[recIdx] != null ? Number(row[recIdx]) : 0;
    const excelIss = issIdx !== -1 && row[issIdx] != null ? Number(row[issIdx]) : 0;

    if (!excelName && !code) { skipped++; continue; }

    const { rows: [existing] } = await pool.query('SELECT id, name, category_id, hsn_code, bin_location, current_stock FROM materials WHERE code=$1', [code]);

    if (existing) {
      matched++;
      if (!dryRun) {
        // Update category, name, hsn, and bin location
        await pool.query(
          `UPDATE materials SET
             category_id = $1,
             name = COALESCE(NULLIF($2, ''), name),
             hsn_code = COALESCE(hsn_code, NULLIF($3, '')),
             bin_location = COALESCE(bin_location, NULLIF($4, ''))
           WHERE id = $5`,
          [catId, excelName, excelHsn, excelBin, existing.id]
        );
        if (excelName && existing.name !== excelName) nameUpdated++;

        // Update initial stock if existing stock is 0 and excel has stock
        if ((existing.current_stock == null || Number(existing.current_stock) === 0) && excelStock != null && excelStock > 0) {
          await pool.query('UPDATE materials SET current_stock=$1 WHERE id=$2', [excelStock, existing.id]);
          stockUpdated++;
        }
      }
    } else {
      // Insert new material
      inserted++;
      if (!dryRun) {
        const finalStock = excelStock ?? 0;
        const ins = await pool.query(
          `INSERT INTO materials (code, name, category_id, uom, hsn_code, bin_location, current_stock, reorder_level, min_stock, max_stock, unit_price, is_active, expected_lifespan_days)
           VALUES ($1, $2, $3, 'NOS', $4, $5, $6, 0, 0, 0, 0, true, 365)
           RETURNING id`,
          [code, excelName || code, catId, excelHsn || null, excelBin || null, finalStock]
        );
        const newId = ins.rows[0].id;
        if (finalStock > 0 || excelRec > 0 || excelIss > 0) {
          await pool.query(
            `INSERT INTO stock_ledger (material_id, date, transaction_type, in_qty, out_qty, balance, unit_price, value, remarks)
             VALUES ($1, CURRENT_DATE, 'opening', $2, $3, $4, 0, 0, 'Opening Stock / Electrical Store Excel')`,
            [newId, excelRec, excelIss, finalStock]
          );
        }
      }
    }
  }

  return { sheet: scInfo.sheet, subcategory: scInfo.name, matched, inserted, nameUpdated, stockUpdated, skipped };
}

async function runImport(filePath = DEFAULT_FILE, dryRun = false) {
  if (!fs.existsSync(filePath)) {
    const err = new Error(`File not found: ${filePath}`);
    err.code = 'FILE_NOT_FOUND';
    throw err;
  }

  const { subcatMap } = await ensureSubcategories();
  const wb = XLSX.readFile(filePath);

  const results = [];
  for (const sc of ELECTRICAL_SUBCATS) {
    const catId = subcatMap[sc.sheet];
    const res = await importSheet(wb, sc, catId, dryRun);
    results.push(res);
  }

  const totals = results.reduce((acc, r) => ({
    matched: acc.matched + (r.matched || 0),
    inserted: acc.inserted + (r.inserted || 0),
    nameUpdated: acc.nameUpdated + (r.nameUpdated || 0),
    stockUpdated: acc.stockUpdated + (r.stockUpdated || 0),
  }), { matched: 0, inserted: 0, nameUpdated: 0, stockUpdated: 0 });

  return { results, totals, dryRun };
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const fileArg = args.find(a => !a.startsWith('--')) || DEFAULT_FILE;

  console.log(`Starting Electrical Store import from ${fileArg} (dryRun=${dryRun})...`);
  runImport(fileArg, dryRun)
    .then(({ results, totals }) => {
      console.log('\n--- Electrical Store Import Results ---');
      results.forEach(r => {
        if (r.error) console.log(`  [${r.sheet}] ERROR: ${r.error}`);
        else console.log(`  [${r.sheet} -> ${r.subcategory}] Matched: ${r.matched}, Inserted: ${r.inserted}, NameUpdated: ${r.nameUpdated}, StockUpdated: ${r.stockUpdated}`);
      });
      console.log('\n--- Totals ---');
      console.log(`  Matched existing: ${totals.matched}`);
      console.log(`  Newly inserted:   ${totals.inserted}`);
      console.log(`  Names updated:    ${totals.nameUpdated}`);
      console.log(`  Stocks updated:   ${totals.stockUpdated}`);
      console.log('Import completed successfully!');
      process.exit(0);
    })
    .catch(e => {
      console.error('Import failed:', e);
      process.exit(1);
    });
}

module.exports = { runImport, DEFAULT_FILE, ELECTRICAL_SUBCATS };
