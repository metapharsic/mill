const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');
const pool = require('../src/db/pool');

const dir = path.resolve(__dirname, '../../Projects_Requirement/8192026');

async function parseAndValidate() {
  const { rows: categories } = await pool.query('SELECT id, name, code FROM material_categories');
  const catByName = {};
  categories.forEach(c => {
    catByName[c.name.toLowerCase()] = c.id;
    catByName[c.code.toLowerCase()] = c.id;
  });

  const { rows: dbMats } = await pool.query('SELECT id, code, name, category_id, current_stock, unit_price, uom FROM materials');
  const dbMatByCode = {};
  const dbMatByName = {};
  dbMats.forEach(m => {
    if (m.code) dbMatByCode[m.code.trim().toUpperCase()] = m;
    if (m.name) dbMatByName[m.name.trim().toUpperCase()] = m;
  });

  console.log(`Current DB materials: ${dbMats.length}`);

  const files = fs.readdirSync(dir).filter(f => f.endsWith('.xlsx') || f.endsWith('.xls'));
  let totalExcelItems = 0;
  const parsedItems = [];
  const unmatchedCategories = new Set();
  const summaryByFile = {};

  for (const f of files) {
    const filePath = path.join(dir, f);
    const wb = xlsx.readFile(filePath);
    summaryByFile[f] = { totalSheets: wb.SheetNames.length, items: 0, sheets: {} };

    for (const sheetName of wb.SheetNames) {
      const ws = wb.Sheets[sheetName];
      const data = xlsx.utils.sheet_to_json(ws, { header: 1 });
      if (!data || data.length === 0) continue;

      // Find header row index
      let hIdx = -1;
      for (let i = 0; i < Math.min(10, data.length); i++) {
        const row = data[i];
        if (Array.isArray(row) && row.some(cell => typeof cell === 'string' && (
          cell.toUpperCase().includes('ITEM') ||
          cell.toUpperCase().includes('CODE') ||
          cell.toUpperCase().includes('DETAIL') ||
          cell.toUpperCase().includes('PARTUCULERS') ||
          cell.toUpperCase().includes('PARTICULARS') ||
          cell.toUpperCase().includes('MATERIAL') ||
          cell.toUpperCase().includes('PHY STOCK') ||
          cell.toUpperCase().includes('BALANCE')
        ))) {
          hIdx = i;
          break;
        }
      }

      if (hIdx === -1) {
        // Special case: check if row 0 has data directly
        hIdx = 0;
      }

      const headers = (data[hIdx] || []).map(h => h != null ? String(h).trim().toUpperCase() : '');
      
      // Map columns
      let codeIdx = headers.findIndex(h => h && (h.includes('ITEM CODE') || h.includes('CODE') || h === 'SR.NO'));
      let nameIdx = headers.findIndex(h => h && (h.includes('DETAIL') || h.includes('NAME') || h.includes('PARTUCULERS') || h.includes('PARTICULARS') || h.includes('MATERIAL') || h.includes('OIL SEAL')));
      let stockIdx = headers.findIndex(h => h && (h.includes('PHY STOCK') || h.includes('PHY QTY') || h.includes('BALANCE') || h.includes('OPENING') || h === 'STOCK'));
      let recIdx = headers.findIndex(h => h && (h.includes('RECIVED') || h.includes('RECEIVED')));
      let issIdx = headers.findIndex(h => h && (h.includes('ISSUE') || h.includes('CONSUMED')));
      let rateIdx = headers.findIndex(h => h && (h.includes('RATE') || h.includes('UNIT PRICE') || h.includes('PRICE')));
      let hsnIdx = headers.findIndex(h => h && h.includes('HSN'));

      let sheetItemCount = 0;
      for (let r = hIdx + 1; r < data.length; r++) {
        const row = data[r];
        if (!row || row.length === 0) continue;

        let code = codeIdx !== -1 ? row[codeIdx] : null;
        let name = nameIdx !== -1 ? row[nameIdx] : null;
        let stock = stockIdx !== -1 ? row[stockIdx] : 0;
        let received = recIdx !== -1 ? row[recIdx] : 0;
        let issued = issIdx !== -1 ? row[issIdx] : 0;
        let rate = rateIdx !== -1 ? row[rateIdx] : null;
        let hsn = hsnIdx !== -1 ? row[hsnIdx] : null;

        // Skip rows that look like headers or totals or empty
        if (!code && !name) continue;
        if (typeof code === 'string' && (code.toUpperCase().includes('TOTAL') || code.toUpperCase().includes('ITEM CODE'))) continue;
        if (typeof name === 'string' && (name.toUpperCase().includes('TOTAL') || name.toUpperCase().includes('PAGE') || name.toUpperCase().includes('REPORT') || name.toUpperCase().includes('STOCK AS ON'))) continue;

        code = code != null ? String(code).trim() : '';
        name = name != null ? String(name).trim() : '';

        // If code is numeric S.No and name is missing or swapped
        if (!name && code) {
          name = code;
          code = '';
        }

        const numStock = parseFloat(stock) || 0;
        const numRec = parseFloat(received) || 0;
        const numIss = parseFloat(issued) || 0;
        const numRate = parseFloat(rate) || 0;

        parsedItems.push({
          file: f,
          sheet: sheetName,
          rowIdx: r,
          code,
          name,
          rawStock: stock,
          numStock,
          numRec,
          numIss,
          numRate,
          hsn: hsn != null ? String(hsn).trim() : '',
          rawRow: row
        });
        sheetItemCount++;
        totalExcelItems++;
      }
      summaryByFile[f].sheets[sheetName] = sheetItemCount;
      summaryByFile[f].items += sheetItemCount;
    }
  }

  console.log(`\nParsed ${totalExcelItems} total rows across 8 files:`);
  console.dir(summaryByFile, { depth: null });

  await pool.end();
}

parseAndValidate().catch(err => {
  console.error(err);
  pool.end();
});
