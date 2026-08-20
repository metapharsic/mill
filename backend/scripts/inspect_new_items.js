const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');
const pool = require('../src/db/pool');

const dir = path.resolve(__dirname, '../../Projects_Requirement/8192026');

const sheetToCategoryMap = {
  'CHEMICAL.xlsx': { 'CHEMICAL': { catCode: 'CHEM', uom: 'KGS' } },
  'CLOTHING.xlsx': { 'CLOTHING': { catCode: 'CLOTH', uom: 'NOS', isSerialized: true } },
  'ELECTRICAL STORES AUGUST-2026.xlsx': {
    'CONTACTOR': { catCode: 'ELEC-CNT', uom: 'NOS' },
    'RELAY': { catCode: 'ELEC-RLY', uom: 'NOS' },
    'MCB': { catCode: 'ELEC-MCB', uom: 'NOS' },
    'ELE GENERAL': { catCode: 'ELEC-GEN', uom: 'NOS' },
    'VFD DRIVE': { catCode: 'ELEC-VFD', uom: 'NOS' }
  },
  'GENERAL.xlsx': { 'GENERAL': { catCode: 'GEN', uom: 'NOS' } },
  'HYRRAULIC & PENEUMATIC.xlsx': { 'HYDRAULIC & PENEUMATIC': { catCode: 'HYDPNEU', uom: 'NOS' } },
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
  'QUALTY CONTROL.xlsx': { 'LAB': { catCode: 'GEN', uom: 'NOS' } },
  'STATIONERY ITEM.xlsx': { 'STATIONERY': { catCode: 'STAT', uom: 'NOS' } }
};

async function inspectNewItems() {
  const { rows: dbMats } = await pool.query(`SELECT id, code, name FROM materials`);
  const dbMatByCode = {};
  const dbMatByName = {};
  dbMats.forEach(m => {
    if (m.code) dbMatByCode[m.code.trim().toUpperCase()] = m;
    if (m.name) dbMatByName[m.name.trim().toUpperCase()] = m;
  });

  const newItems = [];

  for (const [fileName, sheetsMap] of Object.entries(sheetToCategoryMap)) {
    const filePath = path.join(dir, fileName);
    if (!fs.existsSync(filePath)) continue;
    const wb = xlsx.readFile(filePath);

    for (const [sheetName, config] of Object.entries(sheetsMap)) {
      const ws = wb.Sheets[sheetName];
      if (!ws) continue;
      const data = xlsx.utils.sheet_to_json(ws, { header: 1 });
      if (!data || data.length === 0) continue;

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
      let rateIdx = headers.findIndex(h => h && (h.includes('RATE') || h.includes('UNIT PRICE') || h.includes('PRICE')));
      let hsnIdx = headers.findIndex(h => h && h.includes('HSN'));

      if (nameIdx === -1 && codeIdx === -1 && data[hIdx].length >= 2) {
        nameIdx = 1; codeIdx = 0;
      } else if (nameIdx === -1 && headers.length > 2) {
        nameIdx = 2;
      }

      for (let r = hIdx + 1; r < data.length; r++) {
        const row = data[r];
        if (!row || row.length === 0) continue;

        let rawCode = codeIdx !== -1 ? row[codeIdx] : null;
        let rawName = nameIdx !== -1 ? row[nameIdx] : null;
        let rawStock = stockIdx !== -1 ? row[stockIdx] : 0;
        let rawRate = rateIdx !== -1 ? row[rateIdx] : null;
        let rawHsn = hsnIdx !== -1 ? row[hsnIdx] : null;

        if (!rawCode && !rawName) continue;
        if (typeof rawCode === 'string' && (rawCode.toUpperCase().includes('TOTAL') || rawCode.toUpperCase().includes('ITEM CODE'))) continue;
        if (typeof rawName === 'string' && (rawName.toUpperCase().includes('TOTAL') || rawName.toUpperCase().includes('REPORT') || rawName.toUpperCase().includes('STOCK AS ON'))) continue;

        const codeStr = rawCode != null ? String(rawCode).trim() : '';
        const nameStr = rawName != null ? String(rawName).trim() : '';

        if (!nameStr) continue;

        const matchedByCode = codeStr ? dbMatByCode[codeStr.toUpperCase()] : null;
        const matchedByName = nameStr ? dbMatByName[nameStr.toUpperCase()] : null;

        if (!matchedByCode && !matchedByName) {
          newItems.push({
            file: fileName,
            sheet: sheetName,
            catCode: config.catCode,
            code: codeStr,
            name: nameStr,
            stock: parseFloat(rawStock) || 0,
            rate: rawRate != null && rawRate !== '' ? parseFloat(rawRate) : null,
            hsn: rawHsn != null ? String(rawHsn).trim() : null
          });
        }
      }
    }
  }

  console.log(`Found ${newItems.length} new items to create:\n`);
  newItems.forEach((it, idx) => {
    console.log(`${idx + 1}. [${it.catCode}] Code: "${it.code}" | Name: "${it.name}" | Stock: ${it.stock} | Rate: ${it.rate} | HSN: ${it.hsn}`);
  });

  await pool.end();
}

inspectNewItems().catch(err => {
  console.error(err);
  pool.end();
});
