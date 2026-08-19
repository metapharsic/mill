const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');
const pool = require('../src/db/pool');

const dir = path.resolve(__dirname, '../../Projects_Requirement/8192026');

const sheetToCategoryMap = {
  'CHEMICAL.xlsx': {
    'CHEMICAL': { catCode: 'CHEM', uom: 'KGS' }
  },
  'CLOTHING.xlsx': {
    'CLOTHING': { catCode: 'CLOTH', uom: 'NOS', isSerialized: true }
  },
  'ELECTRICAL STORES AUGUST-2026.xlsx': {
    'CONTACTOR': { catCode: 'ELEC-CNT', uom: 'NOS' },
    'RELAY': { catCode: 'ELEC-RLY', uom: 'NOS' },
    'MCB': { catCode: 'ELEC-MCB', uom: 'NOS' },
    'ELE GENERAL': { catCode: 'ELEC-GEN', uom: 'NOS' },
    'VFD DRIVE': { catCode: 'ELEC-VFD', uom: 'NOS' }
  },
  'GENERAL.xlsx': {
    'GENERAL': { catCode: 'GEN', uom: 'NOS' }
  },
  'HYRRAULIC & PENEUMATIC.xlsx': {
    'HYDRAULIC & PENEUMATIC': { catCode: 'HYDPNEU', uom: 'NOS' }
  },
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
  'QUALTY CONTROL.xlsx': {
    'LAB': { catCode: 'GEN', uom: 'NOS' }
  },
  'STATIONERY ITEM.xlsx': {
    'STATIONERY': { catCode: 'STAT', uom: 'NOS' }
  }
};

async function executeUpload() {
  console.log('🚀 ======================================================================');
  console.log('🚀 MULTI-AGENT DATA MIGRATION & EXCEL UPLOAD (DATE: 8/19/2026)');
  console.log('🚀 ======================================================================\n');

  const { rows: categories } = await pool.query('SELECT id, name, code FROM material_categories');
  const catByCode = {};
  categories.forEach(c => {
    catByCode[c.code.toUpperCase()] = c;
  });

  const { rows: [defaultUser] } = await pool.query('SELECT id FROM users ORDER BY id ASC LIMIT 1');
  const userId = defaultUser ? defaultUser.id : 1;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Get current DB materials
    const { rows: dbMats } = await client.query(`
      SELECT m.id, m.code, m.name, m.category_id, m.current_stock, m.unit_price, m.uom, m.hsn_code
      FROM materials m
    `);

    const dbMatById = {};
    const dbMatsByCode = {};
    const dbMatsByCatAndName = {};

    dbMats.forEach(m => {
      dbMatById[m.id] = m;
      if (m.code) {
        const c = m.code.trim().toUpperCase();
        if (!dbMatsByCode[c]) dbMatsByCode[c] = [];
        dbMatsByCode[c].push(m);
      }
      if (m.name && m.category_id) {
        const key = `${m.category_id}:${m.name.trim().toUpperCase()}`;
        if (!dbMatsByCatAndName[key]) dbMatsByCatAndName[key] = [];
        dbMatsByCatAndName[key].push(m);
      }
    });

    const claimedDbIds = new Set();
    let updatedCount = 0;
    let createdCount = 0;
    let processedTotal = 0;

    for (const [fileName, sheetsMap] of Object.entries(sheetToCategoryMap)) {
      const filePath = path.join(dir, fileName);
      if (!fs.existsSync(filePath)) {
        console.warn(`⚠️ Skipping missing file: ${fileName}`);
        continue;
      }
      const wb = xlsx.readFile(filePath);

      for (const [sheetName, config] of Object.entries(sheetsMap)) {
        const ws = wb.Sheets[sheetName];
        if (!ws) {
          console.warn(`⚠️ Skipping missing sheet: ${sheetName} in ${fileName}`);
          continue;
        }
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
        let binIdx = headers.findIndex(h => h && (h.includes('RACK') || h.includes('BOX')));

        if (nameIdx === -1 && codeIdx === -1 && data[hIdx].length >= 2) {
          nameIdx = 1; codeIdx = 0;
        } else if (nameIdx === -1 && headers.length > 2) {
          nameIdx = 2;
        }

        const targetCat = catByCode[config.catCode.toUpperCase()];
        if (!targetCat) {
          throw new Error(`Target category code ${config.catCode} not found in DB`);
        }

        for (let r = hIdx + 1; r < data.length; r++) {
          const row = data[r];
          if (!row || row.length === 0) continue;

          let rawCode = codeIdx !== -1 ? row[codeIdx] : null;
          let rawName = nameIdx !== -1 ? row[nameIdx] : null;
          let rawStock = stockIdx !== -1 ? row[stockIdx] : 0;
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
          const rateNum = rawRate != null && rawRate !== '' ? parseFloat(rawRate) : 0;
          const hsnStr = rawHsn != null ? String(rawHsn).trim() : null;
          const binStr = rawBin != null ? String(rawBin).trim() : null;

          // Exact matching prioritization:
          // 1. Check if both code and name match a DB material in the target category (unclaimed)
          let matchedDbMat = null;
          const nameKey = `${targetCat.id}:${nameStr.toUpperCase()}`;
          const candidateByName = (dbMatsByCatAndName[nameKey] || []).find(m => !claimedDbIds.has(m.id));
          const candidateByCode = codeStr ? (dbMatsByCode[codeStr.toUpperCase()] || []).find(m => !claimedDbIds.has(m.id)) : null;

          if (candidateByName && candidateByCode && candidateByName.id === candidateByCode.id) {
            matchedDbMat = candidateByName;
          } else if (candidateByCode && candidateByCode.name.toUpperCase() === nameStr.toUpperCase()) {
            matchedDbMat = candidateByCode;
          } else if (candidateByName) {
            matchedDbMat = candidateByName;
          } else if (candidateByCode) {
            matchedDbMat = candidateByCode;
          }

          if (matchedDbMat) {
            claimedDbIds.add(matchedDbMat.id);

            // Update existing material
            const priceToSet = rateNum > 0 ? rateNum : (parseFloat(matchedDbMat.unit_price) || 0);
            await client.query(`
              UPDATE materials
              SET current_stock = $1,
                  hsn_code = COALESCE($2, hsn_code),
                  unit_price = CASE WHEN $3::numeric > 0 THEN $3::numeric ELSE unit_price END,
                  category_id = $4,
                  bin_location = COALESCE($5, bin_location),
                  is_active = true
              WHERE id = $6
            `, [stockNum, hsnStr, priceToSet, targetCat.id, binStr, matchedDbMat.id]);

            // Sync opening stock ledger entry
            const { rows: openLedger } = await client.query(`
              SELECT id FROM stock_ledger 
              WHERE material_id = $1 AND transaction_type = 'opening'
              ORDER BY id ASC LIMIT 1
            `, [matchedDbMat.id]);

            if (openLedger.length > 0) {
              await client.query(`
                UPDATE stock_ledger
                SET in_qty = $1,
                    balance = $1,
                    unit_price = $2,
                    value = $1::numeric * $2::numeric,
                    date = CURRENT_DATE
                WHERE id = $3
              `, [stockNum, priceToSet, openLedger[0].id]);
            } else {
              await client.query(`
                INSERT INTO stock_ledger (
                  material_id, date, transaction_type, in_qty, out_qty, balance,
                  unit_price, value, remarks, created_by, bin_location
                ) VALUES (
                  $1, CURRENT_DATE, 'opening', $2, 0, $2,
                  $3, $2::numeric * $3::numeric, 'Initial Opening Balance (Excel 8192026)', $4, $5
                )
              `, [matchedDbMat.id, stockNum, priceToSet, userId, binStr]);
            }
            updatedCount++;
          } else {
            // Check if code is already taken in materials table; if so, append -B or -C
            let finalCode = codeStr || `${config.catCode}-${Math.floor(1000 + Math.random() * 9000)}`;
            const { rows: existingWithCode } = await client.query('SELECT id FROM materials WHERE code = $1', [finalCode]);
            if (existingWithCode.length > 0) {
              finalCode = `${finalCode}-B`;
            }

            const priceToSet = rateNum > 0 ? rateNum : 0;

            const { rows: [newMat] } = await client.query(`
              INSERT INTO materials (
                code, name, category_id, uom, hsn_code, current_stock,
                unit_price, bin_location, is_active, is_serialized
              ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, true, $9
              ) RETURNING id
            `, [
              finalCode, nameStr, targetCat.id, config.uom || 'NOS',
              hsnStr, stockNum, priceToSet, binStr, Boolean(config.isSerialized)
            ]);

            claimedDbIds.add(newMat.id);

            // Insert opening stock ledger row
            await client.query(`
              INSERT INTO stock_ledger (
                material_id, date, transaction_type, in_qty, out_qty, balance,
                unit_price, value, remarks, created_by, bin_location
              ) VALUES (
                $1, CURRENT_DATE, 'opening', $2, 0, $2,
                $3, $2::numeric * $3::numeric, 'Master Opening Balance (Excel 8192026)', $4, $5
              )
            `, [newMat.id, stockNum, priceToSet, userId, binStr]);

            createdCount++;
          }
          processedTotal++;
        }
      }
    }

    await client.query('COMMIT');

    console.log('✅ ======================================================================');
    console.log('✅ 8192026 EXCEL DATA UPLOAD COMPLETED SUCCESSFULLY WITH ATOMIC COMMIT');
    console.log(`✅ Total Excel Records Processed: ${processedTotal}`);
    console.log(`✅ Materials Synchronized:        ${updatedCount}`);
    console.log(`✅ New Materials Registered:      ${createdCount}`);
    console.log('✅ ======================================================================\n');

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed, transaction rolled back:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

executeUpload().catch(err => {
  console.error(err);
  process.exit(1);
});
