require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const pool = require('../src/db/pool');

const REQ_DIR = path.join(__dirname, '../../Projects_Requirement/8152026');

// Utility to parse Excel dates or strings
const excelDateToJS = (serial) => {
  if (!serial) return '2026-08-01';
  if (typeof serial === 'string') {
    const cleaned = serial.replace(/\s+/g, '').replace(/\/0\//g, '/08/').replace(/\/\/+/g, '/');
    const parts = cleaned.split(/[\/\-]/).filter(Boolean);
    if (parts.length === 3) {
      let d, m, y;
      if (parts[0].length === 4) {
        y = parts[0]; m = parts[1]; d = parts[2];
      } else {
        d = parts[0]; m = parts[1]; y = parts[2];
        if (y.length === 2) y = '20' + y;
      }
      return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
    return '2026-08-01';
  }
  const utc_days = Math.floor(serial - 25569);
  const utc_value = utc_days * 86400;
  const date_info = new Date(utc_value * 1000);
  return date_info.toISOString().slice(0, 10);
};

// Ensure category and optional parent category
async function ensureCategory(name, code, type, parentId = null) {
  let { rows: [cat] } = await pool.query(
    `SELECT id, name, code, type, parent_id FROM material_categories WHERE code = $1 OR LOWER(TRIM(name)) = LOWER(TRIM($2))`,
    [code, name]
  );
  if (!cat) {
    const ins = await pool.query(
      `INSERT INTO material_categories (name, code, type, parent_id) VALUES ($1, $2, $3, $4) RETURNING *`,
      [name, code, type, parentId]
    );
    cat = ins.rows[0];
  } else {
    // Update parent_id if provided and not set
    if (parentId && cat.parent_id !== parentId) {
      await pool.query(`UPDATE material_categories SET parent_id = $1 WHERE id = $2`, [parentId, cat.id]);
      cat.parent_id = parentId;
    }
    if (type && cat.type !== type) {
      await pool.query(`UPDATE material_categories SET type = $1 WHERE id = $2`, [type, cat.id]);
      cat.type = type;
    }
  }
  return cat.id;
}

// Clean string
const cleanStr = v => (v === null || v === undefined) ? '' : String(v).trim();
const parseNum = v => {
  if (v === null || v === undefined || v === '') return 0;
  const n = parseFloat(String(v).replace(/,/g, ''));
  return isNaN(n) ? 0 : n;
};

// Master Upsert Material Function
async function upsertMaterial({
  code, name, categoryId, uom = 'NOS', hsn = null, binLocation = null,
  openingStock = 0, currentStock = null, unitPrice = 0, reorderLevel = 0,
  minStock = 0, maxStock = 0, sectionContext = null, criticalityClass = null,
  oemSupplier = null, remarks = 'Excel Import 8152026'
}) {
  if (!code || !name) return null;
  const cStock = currentStock !== null ? currentStock : openingStock;

  const { rows: [existing] } = await pool.query(
    `SELECT id, code, name, category_id, uom, hsn_code, bin_location, current_stock, unit_price FROM materials WHERE code = $1`,
    [code]
  );

  let matId;
  if (existing) {
    matId = existing.id;
    await pool.query(
      `UPDATE materials SET
         name = COALESCE(NULLIF($1, ''), name),
         category_id = COALESCE($2, category_id),
         uom = COALESCE(NULLIF($3, ''), uom),
         hsn_code = COALESCE(NULLIF($4, ''), hsn_code),
         bin_location = COALESCE(NULLIF($5, ''), bin_location),
         current_stock = CASE WHEN current_stock = 0 OR current_stock IS NULL THEN $6 ELSE current_stock END,
         unit_price = CASE WHEN unit_price = 0 OR unit_price IS NULL THEN $7 ELSE unit_price END,
         criticality_class = COALESCE(NULLIF($8, ''), criticality_class),
         section_context = COALESCE(NULLIF($9, ''), section_context),
         oem_supplier = COALESCE(NULLIF($10, ''), oem_supplier),
         is_active = true
       WHERE id = $11`,
      [name, categoryId, uom, hsn, binLocation, cStock, unitPrice, criticalityClass, sectionContext, oemSupplier, matId]
    );
  } else {
    const ins = await pool.query(
      `INSERT INTO materials (
         code, name, category_id, uom, hsn_code, bin_location, current_stock,
         unit_price, reorder_level, min_stock, max_stock, criticality_class,
         section_context, oem_supplier, is_active, expected_lifespan_days
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, true, 365)
       RETURNING id`,
      [code, name, categoryId, uom, hsn, binLocation, cStock, unitPrice, reorderLevel, minStock, maxStock, criticalityClass, sectionContext, oemSupplier]
    );
    matId = ins.rows[0].id;
  }

  // Stock Ledger opening balance sync
  if (openingStock > 0 || cStock > 0) {
    const { rows: [ledger] } = await pool.query(
      `SELECT id FROM stock_ledger WHERE material_id = $1 AND transaction_type = 'opening'`,
      [matId]
    );
    const finalOp = openingStock > 0 ? openingStock : cStock;
    if (!ledger) {
      await pool.query(
        `INSERT INTO stock_ledger (material_id, date, transaction_type, in_qty, out_qty, balance, unit_price, value, remarks)
         VALUES ($1, CURRENT_DATE, 'opening', $2, 0, $3, $4, $5, $6)`,
        [matId, finalOp, cStock, unitPrice, cStock * unitPrice, remarks]
      );
    }
  }

  return matId;
}

// -------------------------------------------------------------
// 1. MECHANICAL STORE (MECHANICAL STORE AUGUST-2026.xlsx)
// -------------------------------------------------------------
const MECH_SHEET_MAP = [
  { sheet: 'OIL SEAL ', code: 'MECH-OSL', name: 'Oil Seal' },
  { sheet: 'Bearing ', code: 'MECH-BRG', name: 'Bearing' },
  { sheet: 'TYRE COUPLING, PIN BUSH', code: 'MECH-TCP', name: 'Tyre Coupling & Pin Bush' },
  { sheet: 'PUMP SLEEVE', code: 'MECH-PSL', name: 'Pump Sleeve' },
  { sheet: 'V-BELT', code: 'MECH-VBT', name: 'V-Belt' },
  { sheet: 'WELDING RODS', code: 'MECH-WLD', name: 'Welding Rods' },
  { sheet: 'BLADE, CUTTING WHEEL & GRINDING', code: 'MECH-BLD', name: 'Blade/Cutting Wheel & Grinding' },
  { sheet: 'VALVE', code: 'MECH-VLV', name: 'Valve' },
  { sheet: 'CHECK NUT & WASHER', code: 'MECH-CNW', name: 'Check Nut & Washer' },
  { sheet: 'GUAGES', code: 'MECH-GUG', name: 'Gauges' },
  { sheet: 'SHAFT & IMPELLER', code: 'MECH-SFT', name: 'Shaft & Impeller' },
  { sheet: 'SS,MS PIPE FITTING', code: 'MECH-PIP', name: 'SS/MS Pipe Fitting' },
  { sheet: 'NOZZLES', code: 'MECH-NOZ', name: 'Nozzles' },
  { sheet: 'LUBRICANTS', code: 'MECH-LUB', name: 'Lubricants' },
  { sheet: 'COMPRESSOR', code: 'MECH-CMP', name: 'Compressor' },
  { sheet: 'PULLEY', code: 'MECH-PUL', name: 'Pulley' },
  { sheet: 'BOLTS & NUTS, WASHERS', code: 'MECH-BNW', name: 'Bolts & Nuts/Washers' }
];

async function importMechanical() {
  console.log('\n--- 1. Processing MECHANICAL STORE AUGUST-2026.xlsx ---');
  const mechFile = path.join(REQ_DIR, 'MECHANICAL STORE AUGUST-2026.xlsx');
  if (!fs.existsSync(mechFile)) throw new Error(`File not found: ${mechFile}`);

  const parentMechId = await ensureCategory('Mechanical', 'MECH', 'Spare Part', null);
  const wb = XLSX.readFile(mechFile);
  let totalMech = 0;

  for (const item of MECH_SHEET_MAP) {
    const ws = wb.Sheets[item.sheet];
    if (!ws) {
      console.log(`  ⚠️ Sheet "${item.sheet}" not found in workbook.`);
      continue;
    }
    const catId = await ensureCategory(item.name, item.code, 'Mechanical', parentMechId);
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });

    // Find header
    let hIdx = -1;
    for (let r = 0; r < Math.min(rows.length, 6); r++) {
      const row = rows[r] || [];
      if (row.some(c => cleanStr(c).toUpperCase().includes('ITEM CODE') || cleanStr(c).toUpperCase().includes('MATERIAL DETAILS') || cleanStr(c).toUpperCase().includes('ITEM DETAILS'))) {
        hIdx = r;
        break;
      }
    }
    if (hIdx === -1) hIdx = 1;

    const header = (rows[hIdx] || []).map(c => cleanStr(c).toUpperCase());
    const codeIdx = header.findIndex(h => h && (h.includes('ITEM CODE') || h.includes('CODE')));
    const nameIdx = header.findIndex(h => h && (h.includes('DETAIL') || h.includes('NAME') || h.includes('SEAL') || h.includes('ROD')));
    const hsnIdx = header.findIndex(h => h && h.includes('HSN'));
    const binIdx = header.findIndex(h => h && (h.includes('RACK') || h.includes('BOX') || h.includes('LOCATION')));
    const stockIdx = header.findIndex(h => h && (h.includes('BALANCE') || h.includes('PHY STOCK') || h.includes('QTY')));

    let count = 0;
    for (let r = hIdx + 1; r < rows.length; r++) {
      const row = rows[r];
      if (!row || row.length === 0) continue;
      const code = codeIdx !== -1 ? cleanStr(row[codeIdx]) : '';
      if (!code || code.toUpperCase() === 'ITEM CODE' || code.toUpperCase() === 'TOTAL') continue;

      let name = nameIdx !== -1 ? cleanStr(row[nameIdx]) : '';
      if (!name) name = cleanStr(row[2] || row[1]);
      if (!name || name.toUpperCase() === 'ITEM WITH DETAIL') continue;

      const hsn = hsnIdx !== -1 ? cleanStr(row[hsnIdx]) : null;
      let bin = binIdx !== -1 ? cleanStr(row[binIdx]) : null;
      if (bin && !bin.toLowerCase().startsWith('rack') && !bin.toLowerCase().startsWith('box')) {
        bin = `Rack ${bin}`;
      }
      const stock = stockIdx !== -1 ? parseNum(row[stockIdx]) : 0;

      await upsertMaterial({
        code,
        name,
        categoryId: catId,
        uom: item.sheet.includes('LUBRICANTS') ? 'LTR' : (item.sheet.includes('WELDING') ? 'PKT' : 'NOS'),
        hsn: hsn || null,
        binLocation: bin || null,
        openingStock: stock,
        currentStock: stock,
        reorderLevel: 2,
        minStock: 1,
        remarks: `Opening Stock / Mechanical Store (${item.name})`
      });
      count++;
    }
    console.log(`  ✅ ${item.name} (${item.code}): ${count} items processed.`);
    totalMech += count;
  }
  return totalMech;
}

// -------------------------------------------------------------
// 2. ELECTRICAL STORE (ELECTRICAL STORES AUGUST-2026.xlsx)
// -------------------------------------------------------------
const ELEC_SHEET_MAP = [
  { sheet: 'CONTACTOR', code: 'ELEC-CNT', name: 'Contactor' },
  { sheet: 'RELAY', code: 'ELEC-RLY', name: 'Relay' },
  { sheet: 'MCB', code: 'ELEC-MCB', name: 'MCB & Fuses' },
  { sheet: 'ELE GENERAL', code: 'ELEC-GEN', name: 'Electrical General' },
  { sheet: 'VFD DRIVE', code: 'ELEC-VFD', name: 'VFD Drive & Spares' }
];

async function importElectrical() {
  console.log('\n--- 2. Processing ELECTRICAL STORES AUGUST-2026.xlsx ---');
  const elecFile = path.join(REQ_DIR, 'ELECTRICAL STORES AUGUST-2026.xlsx');
  if (!fs.existsSync(elecFile)) throw new Error(`File not found: ${elecFile}`);

  const parentElecId = await ensureCategory('Electrical', 'ELEC', 'Spare Part', null);
  const wb = XLSX.readFile(elecFile);
  let totalElec = 0;

  for (const item of ELEC_SHEET_MAP) {
    const ws = wb.Sheets[item.sheet];
    if (!ws) {
      console.log(`  ⚠️ Sheet "${item.sheet}" not found in workbook.`);
      continue;
    }
    const catId = await ensureCategory(item.name, item.code, 'Electrical', parentElecId);
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });

    let hIdx = -1;
    for (let r = 0; r < Math.min(rows.length, 6); r++) {
      const row = rows[r] || [];
      if (row.some(c => cleanStr(c).toUpperCase().includes('ITEM CODE') || cleanStr(c).toUpperCase().includes('ITEM WITH DETAIL'))) {
        hIdx = r;
        break;
      }
    }
    if (hIdx === -1) hIdx = 1;

    const header = (rows[hIdx] || []).map(c => cleanStr(c).toUpperCase());
    const codeIdx = header.findIndex(h => h && (h.includes('ITEM CODE') || h.includes('CODE')));
    const nameIdx = header.findIndex(h => h && (h.includes('DETAIL') || h.includes('NAME')));
    const hsnIdx = header.findIndex(h => h && h.includes('HSN'));
    const binIdx = header.findIndex(h => h && (h.includes('RACK') || h.includes('BOX') || h.includes('LOCATION')));
    const stockIdx = header.findIndex(h => h && (h.includes('BALANCE') || h.includes('PHY STOCK') || h.includes('PHY QTY')));

    let count = 0;
    for (let r = hIdx + 1; r < rows.length; r++) {
      const row = rows[r];
      if (!row || row.length === 0) continue;
      const code = codeIdx !== -1 ? cleanStr(row[codeIdx]) : '';
      if (!code || code.toUpperCase() === 'ITEM CODE' || code.toUpperCase() === 'TOTAL') continue;

      let name = nameIdx !== -1 ? cleanStr(row[nameIdx]) : '';
      if (!name) name = cleanStr(row[2]);
      if (!name || name.toUpperCase() === 'ITEM WITH DETAIL') continue;

      const hsn = hsnIdx !== -1 ? cleanStr(row[hsnIdx]) : null;
      const bin = binIdx !== -1 ? cleanStr(row[binIdx]) : null;
      const stock = stockIdx !== -1 ? parseNum(row[stockIdx]) : 0;

      await upsertMaterial({
        code,
        name,
        categoryId: catId,
        uom: 'NOS',
        hsn: hsn || null,
        binLocation: bin || null,
        openingStock: stock,
        currentStock: stock,
        reorderLevel: 2,
        minStock: 1,
        criticalityClass: item.code === 'ELEC-VFD' || item.code === 'ELEC-CNT' ? 'A' : 'B',
        remarks: `Opening Stock / Electrical Store (${item.name})`
      });
      count++;
    }
    console.log(`  ✅ ${item.name} (${item.code}): ${count} items processed.`);
    totalElec += count;
  }
  return totalElec;
}

// -------------------------------------------------------------
// 3. GENERAL STORE (GENERAL.xlsx)
// -------------------------------------------------------------
async function importGeneral() {
  console.log('\n--- 3. Processing GENERAL.xlsx ---');
  const genFile = path.join(REQ_DIR, 'GENERAL.xlsx');
  if (!fs.existsSync(genFile)) throw new Error(`File not found: ${genFile}`);

  const catId = await ensureCategory('General', 'GEN', 'Consumable', null);
  const wb = XLSX.readFile(genFile);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });

  let count = 0;
  for (let r = 2; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.length === 0) continue;
    const code = cleanStr(row[1]);
    const name = cleanStr(row[2]);
    const hsn = cleanStr(row[3]) || null;
    const stock = parseNum(row[7] ?? row[4] ?? 0);
    if (!code || !name) continue;

    await upsertMaterial({
      code,
      name,
      categoryId: catId,
      uom: 'NOS',
      hsn,
      openingStock: stock,
      currentStock: stock,
      reorderLevel: 2,
      minStock: 1,
      remarks: 'Opening Stock / General Store Excel'
    });
    count++;
  }
  console.log(`  ✅ General Store: ${count} items processed.`);
  return count;
}

// -------------------------------------------------------------
// 4. HYDRAULIC & PNEUMATIC (HYRRAULIC & PENEUMATIC.xlsx)
// -------------------------------------------------------------
async function importHydraulic() {
  console.log('\n--- 4. Processing HYRRAULIC & PENEUMATIC.xlsx ---');
  const hydFile = path.join(REQ_DIR, 'HYRRAULIC & PENEUMATIC.xlsx');
  if (!fs.existsSync(hydFile)) throw new Error(`File not found: ${hydFile}`);

  const catId = await ensureCategory('Hydraulic & Pneumatic', 'HYDPNEU', 'Spare Part', null);
  const wb = XLSX.readFile(hydFile);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });

  let count = 0;
  for (let r = 2; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.length === 0) continue;
    const code = cleanStr(row[1]);
    const name = cleanStr(row[2]);
    const hsn = cleanStr(row[3]) || null;
    const stock = parseNum(row[7] ?? row[4] ?? 0);
    if (!code || !name) continue;

    await upsertMaterial({
      code,
      name,
      categoryId: catId,
      uom: 'NOS',
      hsn,
      openingStock: stock,
      currentStock: stock,
      reorderLevel: 2,
      minStock: 1,
      criticalityClass: 'B',
      remarks: 'Opening Stock / Hydraulic & Pneumatic Excel'
    });
    count++;
  }
  console.log(`  ✅ Hydraulic & Pneumatic: ${count} items processed.`);
  return count;
}

// -------------------------------------------------------------
// 5. CHEMICAL STORE (CHEMICAL.xlsx)
// -------------------------------------------------------------
async function importChemical() {
  console.log('\n--- 5. Processing CHEMICAL.xlsx ---');
  const chemFile = path.join(REQ_DIR, 'CHEMICAL.xlsx');
  if (!fs.existsSync(chemFile)) throw new Error(`File not found: ${chemFile}`);

  const catId = await ensureCategory('Chemical', 'CHEM', 'Raw Material', null);
  const wb = XLSX.readFile(chemFile);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });

  let count = 0;
  for (let r = 3; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.length === 0) continue;
    const code = cleanStr(row[1]);
    const name = cleanStr(row[2]);
    const hsn = cleanStr(row[3]) || null;
    const price = parseNum(row[4] ?? 0);
    const openingStock = parseNum(row[5] ?? 0);
    const closingStock = parseNum(row[9] ?? row[7] ?? openingStock);
    if (!code || !name) continue;

    await upsertMaterial({
      code,
      name,
      categoryId: catId,
      uom: 'KG',
      hsn,
      openingStock,
      currentStock: closingStock,
      unitPrice: price,
      reorderLevel: 500,
      minStock: 200,
      criticalityClass: 'A',
      remarks: 'Opening Stock / Chemical Store Excel'
    });
    count++;
  }
  console.log(`  ✅ Chemical Store: ${count} items processed.`);
  return count;
}

// -------------------------------------------------------------
// 6. CLOTHING STORE (CLOTHING.xlsx)
// -------------------------------------------------------------
async function importClothing() {
  console.log('\n--- 6. Processing CLOTHING.xlsx ---');
  const clothFile = path.join(REQ_DIR, 'CLOTHING.xlsx');
  if (!fs.existsSync(clothFile)) throw new Error(`File not found: ${clothFile}`);

  const catId = await ensureCategory('Clothing', 'CLOTH', 'Consumable', null);
  const wb = XLSX.readFile(clothFile);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });

  let count = 0;
  for (let r = 2; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.length === 0) continue;
    const code = cleanStr(row[1]);
    const name = cleanStr(row[2]);
    const hsn = cleanStr(row[3]) || null;
    const price = parseNum(row[4] ?? 0);
    const stock = parseNum(row[10] ?? row[7] ?? 0);
    if (!code || !name) continue;

    await upsertMaterial({
      code,
      name,
      categoryId: catId,
      uom: 'NOS',
      hsn,
      openingStock: stock,
      currentStock: stock,
      unitPrice: price,
      reorderLevel: 1,
      minStock: 1,
      criticalityClass: 'A',
      remarks: 'Opening Stock / Clothing Store Excel'
    });
    count++;
  }
  console.log(`  ✅ Clothing Store: ${count} items processed.`);
  return count;
}

// -------------------------------------------------------------
// 7. STATIONERY STORE (STATIONERY ITEM.xlsx)
// -------------------------------------------------------------
async function importStationery() {
  console.log('\n--- 7. Processing STATIONERY ITEM.xlsx ---');
  const statFile = path.join(REQ_DIR, 'STATIONERY ITEM.xlsx');
  if (!fs.existsSync(statFile)) throw new Error(`File not found: ${statFile}`);

  const catId = await ensureCategory('Stationary', 'STAT', 'Consumable', null);
  const wb = XLSX.readFile(statFile);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });

  let count = 0;
  for (let r = 2; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.length === 0) continue;
    const code = cleanStr(row[1]);
    const name = cleanStr(row[2]);
    const hsn = cleanStr(row[3]) || null;
    const stock = parseNum(row[8] ?? row[4] ?? 0);
    if (!code || !name) continue;

    await upsertMaterial({
      code,
      name,
      categoryId: catId,
      uom: 'NOS',
      hsn,
      openingStock: stock,
      currentStock: stock,
      reorderLevel: 2,
      minStock: 1,
      remarks: 'Opening Stock / Stationery Excel'
    });
    count++;
  }
  console.log(`  ✅ Stationery Store: ${count} items processed.`);
  return count;
}

// -------------------------------------------------------------
// 8. QUALITY CONTROL / LAB STORE (QUALTY CONTROL.xlsx)
// -------------------------------------------------------------
async function importQualityControl() {
  console.log('\n--- 8. Processing QUALTY CONTROL.xlsx ---');
  const qcFile = path.join(REQ_DIR, 'QUALTY CONTROL.xlsx');
  if (!fs.existsSync(qcFile)) {
    console.log(`  ⚠️ Quality Control Excel not found at ${qcFile}`);
    return 0;
  }

  const catId = await ensureCategory('Quality Control', 'QC', 'Consumable', null);
  const wb = XLSX.readFile(qcFile);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });

  let count = 0;
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.length === 0) continue;
    const code = cleanStr(row[1]);
    const name = cleanStr(row[2]);
    const hsn = cleanStr(row[3]) || null;
    const stock = parseNum(row[7] ?? row[4] ?? 0);
    if (!code || !name) continue;

    await upsertMaterial({
      code,
      name,
      categoryId: catId,
      uom: 'NOS',
      hsn,
      openingStock: stock,
      currentStock: stock,
      reorderLevel: 2,
      minStock: 1,
      criticalityClass: 'B',
      sectionContext: 'Quality Control Laboratory',
      remarks: 'Opening Stock / Quality Control Excel'
    });
    count++;
  }
  console.log(`  ✅ Quality Control Store: ${count} items processed.`);
  return count;
}

// -------------------------------------------------------------
// 9. INWARD AUGUST 2026 (INWORD AUGUST-2026.xlsx)
// -------------------------------------------------------------
async function importInward() {
  console.log('\n--- 9. Processing INWORD AUGUST-2026.xlsx ---');
  const inwFile = path.join(REQ_DIR, 'INWORD AUGUST-2026.xlsx');
  if (!fs.existsSync(inwFile)) {
    console.log(`  ⚠️ Inward Excel not found at ${inwFile}`);
    return 0;
  }

  const wb = XLSX.readFile(inwFile);
  const ws = wb.Sheets['Sheet1'];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });

  let currentIgrn = '', currentDate = '', currentParty = '', currentInvoiceNo = '', currentTransporter = '', currentLrNo = '';
  let updatedCount = 0;

  for (let i = 2; i < rows.length; i++) {
    const r = rows[i];
    if (!r || r.length === 0) continue;

    const igrn = r[1];
    const dateRaw = r[2];
    const itemCode = cleanStr(r[3]);
    const particular = cleanStr(r[4]);
    const hsn = cleanStr(r[5]);
    const qty = parseNum(r[7]);
    const price = parseNum(r[8]);
    const party = cleanStr(r[21]);
    const invNo = cleanStr(r[22]);
    const transporter = cleanStr(r[24]);
    const lrNo = cleanStr(r[25]);

    if (igrn) currentIgrn = cleanStr(igrn);
    if (dateRaw) currentDate = dateRaw;
    if (party) currentParty = party;
    if (invNo) currentInvoiceNo = invNo;
    if (transporter) currentTransporter = transporter;
    if (lrNo) currentLrNo = lrNo;

    if (itemCode && itemCode !== 'ITEM CODE' && itemCode !== 'TOTAL' && qty > 0) {
      const { rows: [mat] } = await pool.query(`SELECT id, unit_price, hsn_code FROM materials WHERE code = $1`, [itemCode]);
      if (mat) {
        if (price > 0 && (!mat.unit_price || Number(mat.unit_price) === 0)) {
          await pool.query(`UPDATE materials SET unit_price = $1 WHERE id = $2`, [price, mat.id]);
        }
        if (hsn && !mat.hsn_code) {
          await pool.query(`UPDATE materials SET hsn_code = $1 WHERE id = $2`, [hsn, mat.id]);
        }

        let vendorId = null;
        if (currentParty) {
          const { rows: [v] } = await pool.query(`SELECT id FROM vendors WHERE LOWER(TRIM(name)) = LOWER(TRIM($1))`, [currentParty]);
          if (v) {
            vendorId = v.id;
          } else {
            const vCode = 'VEN-' + currentParty.replace(/[^a-zA-Z0-9]/g, '').slice(0, 6).toUpperCase();
            const vIns = await pool.query(
              `INSERT INTO vendors (name, code, is_active) VALUES ($1, $2, true) ON CONFLICT DO NOTHING RETURNING id`,
              [currentParty, vCode]
            );
            vendorId = vIns.rows[0]?.id || null;
          }
        }

        const remarksStr = `IGRN: ${currentIgrn} | Inv: ${currentInvoiceNo} | Party: ${currentParty} | Tr: ${currentTransporter} (${currentLrNo})`;
        const { rows: [existLedger] } = await pool.query(
          `SELECT id FROM stock_ledger WHERE material_id = $1 AND transaction_type = 'grn' AND remarks LIKE $2`,
          [mat.id, `%${currentIgrn}%`]
        );
        if (!existLedger && currentIgrn) {
          const txnDate = excelDateToJS(currentDate);
          await pool.query(
            `INSERT INTO stock_ledger (material_id, date, transaction_type, in_qty, out_qty, balance, unit_price, value, remarks, vendor_id)
             VALUES ($1, $2, 'grn', $3, 0, (SELECT current_stock FROM materials WHERE id=$1), $4, $5, $6, $7)`,
            [mat.id, txnDate, qty, price, qty * price, remarksStr, vendorId]
          );
        }
        updatedCount++;
      }
    }
  }
  console.log(`  ✅ Inward Desk: ${updatedCount} transactions matched and synchronized.`);
  return updatedCount;
}

// -------------------------------------------------------------
// MAIN ENTRY POINT
// -------------------------------------------------------------
async function runAll() {
  console.log('================================================================');
  console.log('🚀 MASTER ERP CATALOG & CATEGORY SYNCHRONIZER (8152026)');
  console.log('================================================================');

  const mechCount = await importMechanical();
  const elecCount = await importElectrical();
  const genCount = await importGeneral();
  const hydCount = await importHydraulic();
  const chemCount = await importChemical();
  const clothCount = await importClothing();
  const statCount = await importStationery();
  const qcCount = await importQualityControl();
  const inwCount = await importInward();

  const totalMaterials = await pool.query(`SELECT COUNT(*) as cnt FROM materials WHERE is_active = true`);
  const totalCategories = await pool.query(`SELECT COUNT(*) as cnt FROM material_categories`);
  const totalValuation = await pool.query(`SELECT COALESCE(SUM(current_stock * unit_price), 0) as val FROM materials WHERE is_active = true`);

  console.log('\n================================================================');
  console.log('🎉 ALL 9 STORES & CATEGORIES SYNCHRONIZED SUCCESSFULLY!');
  console.log('================================================================');
  console.log(`📊 Active Materials in DB:    ${totalMaterials.rows[0].cnt}`);
  console.log(`🗂️ Categories & Subcategories: ${totalCategories.rows[0].cnt}`);
  console.log(`💰 Total Stock Valuation:     ₹${Number(totalValuation.rows[0].val).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`);
  console.log('================================================================\n');

  return {
    mechCount, elecCount, genCount, hydCount, chemCount, clothCount, statCount, qcCount, inwCount,
    totalMaterials: parseInt(totalMaterials.rows[0].cnt),
    totalCategories: parseInt(totalCategories.rows[0].cnt),
    totalValuation: parseFloat(totalValuation.rows[0].val)
  };
}

if (require.main === module) {
  runAll()
    .then(() => pool.end().then(() => process.exit(0)))
    .catch(err => {
      console.error('Fatal sync error:', err);
      pool.end().then(() => process.exit(1));
    });
}

module.exports = { runAll, REQ_DIR };
