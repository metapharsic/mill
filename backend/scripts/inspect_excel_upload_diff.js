const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');
const pool = require('../src/db/pool');

const dir = path.resolve(__dirname, '../../Projects_Requirement/8192026');

// Map of workbook and sheet to category code / name
const sheetToCategoryMap = {
  // CHEMICAL
  'CHEMICAL.xlsx': {
    'CHEMICAL': { catCode: 'CHEM', uom: 'KGS' }
  },
  // CLOTHING
  'CLOTHING.xlsx': {
    'CLOTHING': { catCode: 'CLOTH', uom: 'NOS', isSerialized: true }
  },
  // ELECTRICAL
  'ELECTRICAL STORES AUGUST-2026.xlsx': {
    'CONTACTOR': { catCode: 'ELEC-CNT', uom: 'NOS' },
    'RELAY': { catCode: 'ELEC-RLY', uom: 'NOS' },
    'MCB': { catCode: 'ELEC-MCB', uom: 'NOS' },
    'ELE GENERAL': { catCode: 'ELEC-GEN', uom: 'NOS' },
    'VFD DRIVE': { catCode: 'ELEC-VFD', uom: 'NOS' }
  },
  // GENERAL
  'GENERAL.xlsx': {
    'GENERAL': { catCode: 'GEN', uom: 'NOS' }
  },
  // HYDRAULIC & PNEUMATIC
  'HYRRAULIC & PENEUMATIC.xlsx': {
    'HYDRAULIC & PENEUMATIC': { catCode: 'HYDPNEU', uom: 'NOS' }
  },
  // MECHANICAL
  'MECHANICAL STORE AUGUST-2026.xlsx': {
    'Bearing ': { catCode: 'MECH-BRG', uom: 'NOS' },
    'OIL SEAL ': { catCode: 'MECH-OSL', uom: 'NOS' },
    'TYRE COUPLING, PIN BUSH': { catCode: 'MECH-TCP', uom: 'NOS' },
    'PUMP SLEEVE': { catCode: 'MECH-PSL', uom: 'NOS' },
    'V-BELT': { catCode: 'MECH-VBT', uom: 'NOS' },
    'WELDING RODS': { catCode: 'MECH-WLD', uom: 'PKT' },
    'BLADE, CUTTING WHEEL & GRINDING': { catCode: 'MECH-BLD', uom: 'NOS' },
    'VALVE': { catCode: 'MECH-VLV', uom: 'NOS' },
    'CHECK NUT & WASHER': { catCode: 'MECH-CNW', uom: 'NOS' },
    'GUAGES': { catCode: 'MECH-GUG', uom: 'NOS' },
    'SHAFT & IMPELLER': { catCode: 'MECH-SFT', uom: 'NOS' },
    'SS,MS PIPE FITTING': { catCode: 'MECH-PIP', uom: 'NOS' },
    'NOZZLES': { catCode: 'MECH-NOZ', uom: 'NOS' },
    'LUBRICANTS': { catCode: 'MECH-LUB', uom: 'LTR' },
    'COMPRESSOR': { catCode: 'MECH-CMP', uom: 'NOS' },
    'PULLEY': { catCode: 'MECH-PUL', uom: 'NOS' },
    'BOLTS & NUTS, WASHERS': { catCode: 'MECH-BNW', uom: 'NOS' }
  },
  // QUALITY CONTROL
  'QUALTY CONTROL.xlsx': {
    'LAB': { catCode: 'GEN', uom: 'NOS' }
  },
  // STATIONERY
  'STATIONERY ITEM.xlsx': {
    'STATIONERY': { catCode: 'STAT', uom: 'NOS' }
  }
};

async function inspectDiff() {
  const { rows: categories } = await pool.query('SELECT id, name, code FROM material_categories');
  const catByCode = {};
  categories.forEach(c => {
    catByCode[c.code.toUpperCase()] = c;
  });

  const { rows: dbMats } = await pool.query(`
    SELECT m.id, m.code, m.name, m.category_id, m.current_stock, m.unit_price, m.uom, m.hsn_code,
           mc.code as cat_code, mc.name as cat_name
    FROM materials m
    LEFT JOIN material_categories mc ON m.category_id = mc.id
  `);

  const dbMatByCode = {};
  const dbMatByName = {};
  dbMats.forEach(m => {
    if (m.code) dbMatByCode[m.code.trim().toUpperCase()] = m;
    if (m.name) dbMatByName[m.name.trim().toUpperCase()] = m;
  });

  console.log(`Database currently has ${dbMats.length} materials across ${categories.length} categories.`);

  let totalItemsToProcess = 0;
  let exactCodeMatches = 0;
  let nameMatches = 0;
  let newItemsToInsert = 0;
  const itemsList = [];

  for (const [fileName, sheetsMap] of Object.entries(sheetToCategoryMap)) {
    const filePath = path.join(dir, fileName);
    if (!fs.existsSync(filePath)) {
      console.warn(`⚠️ File not found: ${filePath}`);
      continue;
    }
    const wb = xlsx.readFile(filePath);

    for (const [sheetName, config] of Object.entries(sheetsMap)) {
      const ws = wb.Sheets[sheetName];
      if (!ws) {
        console.warn(`⚠️ Sheet not found in ${fileName}: ${sheetName}`);
        continue;
      }
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
      if (hIdx === -1) hIdx = 0;

      const headers = (data[hIdx] || []).map(h => h != null ? String(h).trim().toUpperCase() : '');
      
      let codeIdx = headers.findIndex(h => h && (h.includes('ITEM CODE') || (h.includes('CODE') && !h.includes('HSN')) || h === 'SR.NO'));
      let nameIdx = headers.findIndex(h => h && (h.includes('DETAIL') || h.includes('NAME') || h.includes('PARTUCULERS') || h.includes('PARTICULARS') || h.includes('MATERIAL') || h.includes('OIL SEAL')));
      let stockIdx = headers.findIndex(h => h && (h.includes('PHY STOCK') || h.includes('PHY QTY') || h.includes('BALANCE') || h.includes('OPENING') || h === 'STOCK'));
      let recIdx = headers.findIndex(h => h && (h.includes('RECIVED') || h.includes('RECEIVED')));
      let issIdx = headers.findIndex(h => h && (h.includes('ISSUE') || h.includes('CONSUMED')));
      let rateIdx = headers.findIndex(h => h && (h.includes('RATE') || h.includes('UNIT PRICE') || h.includes('PRICE')));
      let hsnIdx = headers.findIndex(h => h && h.includes('HSN'));
      let binIdx = headers.findIndex(h => h && (h.includes('RACK') || h.includes('BOX')));

      // Fallback for sheets where columns are standard
      if (nameIdx === -1 && codeIdx === -1 && data[hIdx].length >= 2) {
        nameIdx = 1;
        codeIdx = 0;
      } else if (nameIdx === -1 && headers.length > 2) {
        nameIdx = 2;
      }

      for (let r = hIdx + 1; r < data.length; r++) {
        const row = data[r];
        if (!row || row.length === 0) continue;

        let rawCode = codeIdx !== -1 ? row[codeIdx] : null;
        let rawName = nameIdx !== -1 ? row[nameIdx] : null;
        let rawStock = stockIdx !== -1 ? row[stockIdx] : 0;
        let rawRec = recIdx !== -1 ? row[recIdx] : 0;
        let rawIss = issIdx !== -1 ? row[issIdx] : 0;
        let rawRate = rateIdx !== -1 ? row[rateIdx] : null;
        let rawHsn = hsnIdx !== -1 ? row[hsnIdx] : null;
        let rawBin = binIdx !== -1 ? row[binIdx] : null;

        if (!rawCode && !rawName) continue;
        if (typeof rawCode === 'string' && (rawCode.toUpperCase().includes('TOTAL') || rawCode.toUpperCase().includes('ITEM CODE'))) continue;
        if (typeof rawName === 'string' && (rawName.toUpperCase().includes('TOTAL') || rawName.toUpperCase().includes('REPORT') || rawName.toUpperCase().includes('STOCK AS ON'))) continue;

        const codeStr = rawCode != null ? String(rawCode).trim() : '';
        const nameStr = rawName != null ? String(rawName).trim() : (codeStr || '');

        if (!nameStr) continue;

        const stockNum = parseFloat(rawStock) || 0;
        const rateNum = rawRate != null && rawRate !== '' ? parseFloat(rawRate) : null;
        const hsnStr = rawHsn != null ? String(rawHsn).trim() : null;
        const binStr = rawBin != null ? String(rawBin).trim() : null;

        const targetCat = catByCode[config.catCode.toUpperCase()];
        if (!targetCat) {
          throw new Error(`Target category code ${config.catCode} not found in DB`);
        }

        // Match in DB
        let matchedDbMat = null;
        if (codeStr && dbMatByCode[codeStr.toUpperCase()]) {
          matchedDbMat = dbMatByCode[codeStr.toUpperCase()];
          exactCodeMatches++;
        } else if (nameStr && dbMatByName[nameStr.toUpperCase()]) {
          matchedDbMat = dbMatByName[nameStr.toUpperCase()];
          nameMatches++;
        } else {
          newItemsToInsert++;
        }

        totalItemsToProcess++;
        itemsList.push({
          fileName,
          sheetName,
          catId: targetCat.id,
          catCode: targetCat.code,
          catName: targetCat.name,
          defaultUom: config.uom || 'NOS',
          isSerialized: Boolean(config.isSerialized),
          code: codeStr,
          name: nameStr,
          stock: stockNum,
          rate: rateNum,
          hsn: hsnStr,
          bin: binStr,
          dbMat: matchedDbMat
        });
      }
    }
  }

  console.log('\n--- MATCHING & DIFF SUMMARY ---');
  console.log(`Total valid items parsed from 8192026 Excel files: ${totalItemsToProcess}`);
  console.log(`Exact Code Matches in DB:   ${exactCodeMatches}`);
  console.log(`Name Matches in DB:         ${nameMatches}`);
  console.log(`New Items to Create in DB:  ${newItemsToInsert}`);

  await pool.end();
}

inspectDiff().catch(err => {
  console.error(err);
  pool.end();
});
