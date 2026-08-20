// Reusable importer for Projects_Requirement/8202026/VENDER NAME.xlsx (or any re-export with
// the same one-column layout). Single source of truth for the excel->db column mapping — run
// this any time the excel is updated instead of hand-writing one-off SQL.
//
// Usage: node scripts/import_vendors.js [path-to-xlsx] [--dry-run]
//
// The source sheet ("Inword  AUGUST-26") only carries two columns:
//   S.No          -> not imported (just the excel row ordinal)
//   VENDER NAME   -> vendors.name  (the only field this sheet actually has)
// There is no GSTIN, address, contact, or bank data in this file, so every new vendor is
// inserted with the same defaults the Vendors UI / POST /api/master/vendors route uses
// (payment_terms '30 days', credit_days 30, rating 3, account_type 'Current', is_active true)
// and an auto-generated VND-#### code. Existing vendors are matched by name and left alone —
// this script only ever adds rows to `vendors`, it never touches purchase_orders, grn, or any
// other table.
//
// Natural key: GSTIN when the sheet has a non-blank one for a row, else the vendor name
// normalized (trim + collapse internal whitespace + uppercase) so that case/spacing-only
// re-typing of the same vendor (e.g. "Unified Paper Machine Pvt Ltd" vs
// "UNIFIED PAPER MACHINE PVT LTD") is treated as the same vendor and not re-inserted.
// Rows that are exact-normalized duplicates of an earlier row in the SAME file are also
// skipped (reported separately from "already in DB"). Note this is exact-match dedup only —
// genuine typos in the source sheet (e.g. "SHANKAR ENGINEERING CO" vs "SHANKAR ENGNEERING CO")
// will NOT be merged automatically; those show up as separate new-vendor rows in the dry-run
// output for a human to review before confirming.
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const pool = require('../src/db/pool');

const DEFAULT_FILE = path.join(__dirname, '../../Projects_Requirement/8202026/VENDER NAME.xlsx');

const NAME_HEADER_CANDIDATES = ['VENDER NAME', 'VENDOR NAME', 'VENDOR', 'VENDER'];
const GSTIN_HEADER_CANDIDATES = ['GSTIN', 'GST NO', 'GST NUMBER'];

function normalizeName(name) {
  return String(name || '').trim().replace(/\s+/g, ' ').toUpperCase();
}

function findHeaderRow(rows) {
  for (let r = 0; r < Math.min(rows.length, 10); r++) {
    const row = rows[r] || [];
    const hasName = row.some(c => NAME_HEADER_CANDIDATES.includes(String(c || '').trim().toUpperCase()));
    if (hasName) return r;
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

// Reads the workbook and returns the parsed, deduped row list without touching the DB.
// Exported separately so a --dry-run and a real run always see identical parsing.
function parseWorkbook(file, sheetNameOverride) {
  if (!fs.existsSync(file)) {
    const err = new Error(`Excel file not found: ${file}`);
    err.code = 'FILE_NOT_FOUND';
    throw err;
  }
  const wb = XLSX.readFile(file);
  const sheetName = sheetNameOverride || wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  if (!ws) {
    const err = new Error(`Sheet "${sheetName}" not found. Sheets in file: ${wb.SheetNames.join(', ')}`);
    err.code = 'SHEET_NOT_FOUND';
    throw err;
  }
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
  const headerRowIdx = findHeaderRow(rows);
  if (headerRowIdx === -1) {
    const err = new Error(`No vendor-name header (${NAME_HEADER_CANDIDATES.join('/')}) found in sheet "${sheetName}"`);
    err.code = 'HEADER_NOT_FOUND';
    throw err;
  }
  const header = rows[headerRowIdx].map(h => String(h || '').trim());
  const nameIdx = colIndex(header, NAME_HEADER_CANDIDATES);
  const gstinIdx = colIndex(header, GSTIN_HEADER_CANDIDATES); // -1 if this sheet never has one

  const seen = new Map(); // normalizedName -> first-seen excel row number (1-based, human-friendly)
  const parsed = [];
  const duplicatesInFile = [];
  for (let r = headerRowIdx + 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row) continue;
    const rawName = nameIdx !== -1 ? row[nameIdx] : null;
    const name = String(rawName || '').trim();
    if (!name) continue;
    const gstin = gstinIdx !== -1 ? String(row[gstinIdx] || '').trim().toUpperCase() : '';
    const normalizedName = normalizeName(name);
    const naturalKey = gstin ? `gstin:${gstin}` : `name:${normalizedName}`;
    const excelRow = r + 1;

    if (seen.has(naturalKey)) {
      duplicatesInFile.push({ excelRow, name, firstSeenRow: seen.get(naturalKey) });
      continue;
    }
    seen.set(naturalKey, excelRow);
    parsed.push({ excelRow, name, gstin: gstin || null, normalizedName, naturalKey });
  }
  return { sheetName, headerRowIdx, parsed, duplicatesInFile };
}

// Reusable entry point — parses the excel, then diffs against the live `vendors` table and
// either reports (dryRun) or performs (dryRun=false) the inserts. Used by both the CLI (main,
// below) and the Express route (POST /api/master/vendors/sync-excel). Throws if the file is
// missing/unreadable; callers are responsible for catching and reporting.
async function runImport(file = DEFAULT_FILE, dryRun = false, sheetNameOverride) {
  const { sheetName, parsed, duplicatesInFile } = parseWorkbook(file, sheetNameOverride);

  const toInsert = [];
  const alreadyExists = [];
  // Sequential per-run counter for VND-#### codes, seeded from the current table count —
  // mirrors the code-generation logic in POST /api/master/vendors so codes stay unique and
  // in the same numbering scheme whether a vendor is added via the UI or this script.
  const { rows: countRows } = await pool.query('SELECT COUNT(*) FROM vendors');
  let nextCodeSeq = parseInt(countRows[0].count, 10) + 1;

  for (const v of parsed) {
    const { rows: existing } = await pool.query(
      `SELECT id, code, name FROM vendors
       WHERE ($1::text IS NOT NULL AND UPPER(gstin) = $1)
          OR UPPER(REGEXP_REPLACE(TRIM(name), '\\s+', ' ', 'g')) = $2
       LIMIT 1`,
      [v.gstin, v.normalizedName]
    );
    if (existing.length) {
      alreadyExists.push({ excelRow: v.excelRow, name: v.name, matchedVendorId: existing[0].id, matchedVendorCode: existing[0].code, matchedVendorName: existing[0].name });
      continue;
    }
    const code = `VND-${String(nextCodeSeq).padStart(4, '0')}`;
    nextCodeSeq++;
    toInsert.push({ excelRow: v.excelRow, name: v.name, gstin: v.gstin, code });
  }

  if (!dryRun) {
    for (const v of toInsert) {
      await pool.query(
        `INSERT INTO vendors (code, name, gstin, payment_terms, credit_days, rating, account_type, is_active)
         VALUES ($1, $2, $3, '30 days', 30, 3, 'Current', true)`,
        [v.code, v.name, v.gstin]
      );
    }
  }

  return {
    file,
    sheetName,
    dryRun,
    totals: {
      parsedRows: parsed.length,
      duplicatesInFile: duplicatesInFile.length,
      alreadyInDb: alreadyExists.length,
      toInsert: toInsert.length,
      inserted: dryRun ? 0 : toInsert.length,
    },
    toInsert,
    alreadyExists,
    duplicatesInFile,
  };
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const file = args.find(a => !a.startsWith('--')) || DEFAULT_FILE;

  console.log(`Importing vendors from: ${file}${dryRun ? ' (DRY RUN — no writes)' : ''}`);
  const result = await runImport(file, dryRun);
  console.log(`Sheet: ${result.sheetName}`);
  console.log('--- To insert ---');
  result.toInsert.forEach(v => console.log(`  [row ${v.excelRow}] ${v.code}  ${v.name}${v.gstin ? '  GSTIN=' + v.gstin : ''}`));
  console.log('--- Already in DB (skipped) ---');
  result.alreadyExists.forEach(v => console.log(`  [row ${v.excelRow}] "${v.name}" matches existing ${v.matchedVendorCode} "${v.matchedVendorName}" (id=${v.matchedVendorId})`));
  console.log('--- Duplicate rows within the excel file (skipped) ---');
  result.duplicatesInFile.forEach(v => console.log(`  [row ${v.excelRow}] "${v.name}" duplicates row ${v.firstSeenRow}`));
  console.log('TOTALS:', JSON.stringify(result.totals));
  await pool.end();
}

module.exports = {
  parseWorkbook,
  runImport,
  normalizeName,
  DEFAULT_FILE,
};

if (require.main === module) {
  main().catch(e => { console.error(e); process.exit(1); });
}
