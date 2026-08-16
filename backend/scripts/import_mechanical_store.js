// Reusable importer for Projects_Requirement/MECHANICAL STORE AUGUST-2026.xlsx (or any
// re-export with the same sheet layout). Single source of truth for the excel->db column
// mapping — run this any time the excel is updated instead of hand-writing one-off SQL.
//
// Usage: node scripts/import_mechanical_store.js [path-to-xlsx] [--dry-run]
//
// Maps, per real subcategory sheet:
//   ITEM CODE                       -> materials.code (match key, never changed)
//   ITEM WITH DETAIL/ITEM DETAILS/
//   MATERIAL DETAILS (2nd column)   -> materials.name  (EXACT overwrite — this is the field
//                                      that was found wrong: db previously stored a truncated
//                                      model number, excel carries the full brand+spec text)
//   HSN CODE                        -> materials.hsn_code (fill-only, never clobbers existing)
//   RACK/BOX NO                     -> materials.bin_location (fill-only)
//   PHY STOCK / BALANCE / RECEIVED / ISSUE / USED -> intentionally NOT imported.
//     These are stock-snapshot and period-transaction columns. Writing them into
//     materials.current_stock or as stock_ledger rows would corrupt live stock accuracy
//     (real transactions have already happened in the app since this excel was captured).
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const pool = require('../src/db/pool');

const DEFAULT_FILE = path.join(__dirname, '../../Projects_Requirement/MECHANICAL STORE AUGUST-2026.xlsx');

// sheet name (exact, whitespace matters) -> material_categories.code
const SHEET_TO_CATEGORY_CODE = {
  'Bearing ': 'MECH-BRG',
  'OIL SEAL ': 'MECH-OSL',
  'TYRE COUPLING, PIN BUSH': 'MECH-TCP',
  'PUMP SLEEVE': 'MECH-PSL',
  'V-BELT': 'MECH-VBT',
  'WELDING RODS': 'MECH-WLD',
  'BLADE, CUTTING WHEEL & GRINDING': 'MECH-BLD',
  'VALVE': 'MECH-VLV',
  'CHECK NUT & WASHER': 'MECH-CNW',
  'GUAGES': 'MECH-GUG',
  'SHAFT & IMPELLER': 'MECH-SFT',
  'SS,MS PIPE FITTING': 'MECH-PIP',
  'NOZZLES': 'MECH-NOZ',
  'LUBRICANTS': 'MECH-LUB',
  'COMPRESSOR': 'MECH-CMP',
  'PULLEY': 'MECH-PUL',
  'BOLTS & NUTS, WASHERS': 'MECH-BNW',
};

const DETAIL_HEADER_CANDIDATES = ['ITEM WITH DETAIL', 'ITEM DETAILS', 'MATERIAL DETAILS'];

function findHeaderRow(rows) {
  for (let r = 0; r < Math.min(rows.length, 10); r++) {
    const row = rows[r] || [];
    const hasCode = row.some(c => String(c || '').trim().toUpperCase() === 'ITEM CODE');
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

async function importSheet(wb, sheetName, catCode, dryRun) {
  const ws = wb.Sheets[sheetName];
  if (!ws) return { sheetName, error: 'sheet not found in workbook' };
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
  const headerRowIdx = findHeaderRow(rows);
  if (headerRowIdx === -1) return { sheetName, error: 'no ITEM CODE header found' };
  const header = rows[headerRowIdx].map(h => String(h || '').trim());

  const codeIdx = colIndex(header, ['ITEM CODE']);
  const nameIdx = colIndex(header, DETAIL_HEADER_CANDIDATES);
  const hsnIdx = colIndex(header, ['HSN CODE']);
  const binIdx = colIndex(header, ['RACK/BOX NO', 'BOX NO', 'RACK NO']);

  const { rows: [cat] } = await pool.query('SELECT id FROM material_categories WHERE code=$1', [catCode]);
  if (!cat) return { sheetName, error: `category ${catCode} not found` };

  let nameUpdated = 0, hsnFilled = 0, binFilled = 0, matched = 0, unmatched = 0;
  for (let r = headerRowIdx + 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row) continue;
    const code = codeIdx !== -1 ? String(row[codeIdx] || '').trim() : '';
    if (!code || code.toUpperCase() === 'ITEM CODE') continue;
    const excelName = nameIdx !== -1 ? String(row[nameIdx] || '').trim() : '';
    const excelHsn = hsnIdx !== -1 ? String(row[hsnIdx] || '').trim() : '';
    const excelBin = binIdx !== -1 ? String(row[binIdx] || '').trim() : '';

    const { rows: [existing] } = await pool.query('SELECT id, name, hsn_code, bin_location FROM materials WHERE code=$1', [code]);
    if (!existing) { unmatched++; continue; }
    matched++;

    if (excelName && existing.name !== excelName) {
      if (!dryRun) await pool.query('UPDATE materials SET name=$1 WHERE id=$2', [excelName, existing.id]);
      nameUpdated++;
    }
    if (excelHsn && !existing.hsn_code) {
      if (!dryRun) await pool.query('UPDATE materials SET hsn_code=$1 WHERE id=$2', [excelHsn, existing.id]);
      hsnFilled++;
    }
    if (excelBin && !existing.bin_location) {
      if (!dryRun) await pool.query('UPDATE materials SET bin_location=$1 WHERE id=$2', [excelBin, existing.id]);
      binFilled++;
    }
  }
  return { sheetName, matched, unmatched, nameUpdated, hsnFilled, binFilled };
}

function computeTotals(results) {
  return results.reduce((acc, r) => ({
    matched: acc.matched + (r.matched || 0),
    unmatched: acc.unmatched + (r.unmatched || 0),
    nameUpdated: acc.nameUpdated + (r.nameUpdated || 0),
    hsnFilled: acc.hsnFilled + (r.hsnFilled || 0),
    binFilled: acc.binFilled + (r.binFilled || 0),
  }), { matched: 0, unmatched: 0, nameUpdated: 0, hsnFilled: 0, binFilled: 0 });
}

// Reusable entry point — reads the workbook once and imports all 17 sheets.
// Used by both the CLI (main, below) and the Express route
// (POST /api/master/materials/sync-mechanical). Throws if the file is
// missing/unreadable; callers are responsible for catching and reporting.
async function runImport(file = DEFAULT_FILE, dryRun = false) {
  if (!fs.existsSync(file)) {
    const err = new Error(`Excel file not found: ${file}`);
    err.code = 'FILE_NOT_FOUND';
    throw err;
  }
  const wb = XLSX.readFile(file);

  const results = [];
  for (const [sheetName, catCode] of Object.entries(SHEET_TO_CATEGORY_CODE)) {
    const res = await importSheet(wb, sheetName, catCode, dryRun);
    results.push(res);
  }
  const totals = computeTotals(results);
  return { file, dryRun, results, totals };
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const file = args.find(a => !a.startsWith('--')) || DEFAULT_FILE;

  console.log(`Importing from: ${file}${dryRun ? ' (DRY RUN — no writes)' : ''}`);
  const { results, totals } = await runImport(file, dryRun);
  results.forEach(res => console.log(JSON.stringify(res)));
  console.log('TOTALS:', JSON.stringify(totals));
  await pool.end();
}

module.exports = {
  importSheet,
  runImport,
  SHEET_TO_CATEGORY_CODE,
  DEFAULT_FILE,
};

if (require.main === module) {
  main().catch(e => { console.error(e); process.exit(1); });
}
