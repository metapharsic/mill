require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const xlsx = require('xlsx');
const path = require('path');
const pool = require('../src/db/pool');

// Clean and normalize strings
const cleanStr = (s) => (s ? String(s).trim().replace(/\s+/g, ' ') : '');
const parseNum = (v) => {
  if (v === null || v === undefined || v === '') return 0;
  const n = parseFloat(String(v).replace(/[^0-9.-]/g, ''));
  return isNaN(n) ? 0 : n;
};

async function validateAndSyncMechanical() {
  console.log('\n================================================================');
  console.log('🔍 VALIDATING MECHANICAL STORE AUGUST-2026.xlsx AGAINST DATABASE');
  console.log('================================================================\n');

  const filePath = path.resolve(__dirname, '../../Projects_Requirement/8152026/MECHANICAL STORE AUGUST-2026.xlsx');
  const wb = xlsx.readFile(filePath);

  // Mapping of official sheets to category codes
  const SHEET_MAPPING = {
    'OIL SEAL ': { code: 'MECH-OSL', name: 'Oil Seal', uom: 'NOS' },
    'Bearing ': { code: 'MECH-BRG', name: 'Bearing', uom: 'NOS' },
    'TYRE COUPLING, PIN BUSH': { code: 'MECH-TCP', name: 'Tyre Coupling & Pin Bush', uom: 'NOS' },
    'PUMP SLEEVE': { code: 'MECH-PSL', name: 'Pump Sleeve', uom: 'NOS' },
    'V-BELT': { code: 'MECH-VBT', name: 'V-Belt', uom: 'NOS' },
    'WELDING RODS': { code: 'MECH-WLD', name: 'Welding Rods', uom: 'PKT' },
    'BLADE, CUTTING WHEEL & GRINDING': { code: 'MECH-BLD', name: 'Blade/Cutting Wheel & Grinding', uom: 'NOS' },
    'VALVE': { code: 'MECH-VLV', name: 'Valve', uom: 'NOS' },
    'CHECK NUT & WASHER': { code: 'MECH-CNW', name: 'Check Nut & Washer', uom: 'NOS' },
    'GUAGES': { code: 'MECH-GUG', name: 'Gauges', uom: 'NOS' },
    'SHAFT & IMPELLER': { code: 'MECH-SFT', name: 'Shaft & Impeller', uom: 'NOS' },
    'SS,MS PIPE FITTING': { code: 'MECH-PIP', name: 'SS/MS Pipe Fitting', uom: 'NOS' },
    'NOZZLES': { code: 'MECH-NOZ', name: 'Nozzles', uom: 'NOS' },
    'LUBRICANTS': { code: 'MECH-LUB', name: 'Lubricants', uom: 'LTR' },
    'COMPRESSOR': { code: 'MECH-CMP', name: 'Compressor', uom: 'NOS' },
    'PULLEY': { code: 'MECH-PUL', name: 'Pulley', uom: 'NOS' },
    'BOLTS & NUTS, WASHERS': { code: 'MECH-BNW', name: 'Bolts & Nuts/Washers', uom: 'KG' }
  };

  const client = await pool.connect();
  let totalExcelItems = 0;
  let matchedItems = 0;
  let newItemsCreated = 0;
  let updatedItems = 0;

  try {
    await client.query('BEGIN');

    // 1. Ensure parent 'Mechanical' category exists
    let { rows: [parentCat] } = await client.query(`SELECT id FROM material_categories WHERE code = 'MECH' OR name = 'Mechanical' LIMIT 1`);
    if (!parentCat) {
      const res = await client.query(
        `INSERT INTO material_categories (name, code, type) VALUES ('Mechanical', 'MECH', 'Spare Part') RETURNING id`
      );
      parentCat = res.rows[0];
    }

    const validationSummary = [];

    for (const [sheetName, catConfig] of Object.entries(SHEET_MAPPING)) {
      if (!wb.Sheets[sheetName]) {
        console.warn(`⚠️ Sheet "${sheetName}" not found in workbook.`);
        continue;
      }

      // Ensure subcategory exists
      let { rows: [subCat] } = await client.query(`SELECT id FROM material_categories WHERE code = $1 OR name = $2 LIMIT 1`, [catConfig.code, catConfig.name]);
      if (!subCat) {
        const res = await client.query(
          `INSERT INTO material_categories (name, code, type, parent_id) VALUES ($1, $2, 'Spare Part', $3) RETURNING id`,
          [catConfig.name, catConfig.code, parentCat.id]
        );
        subCat = res.rows[0];
      }

      const rows = xlsx.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, defval: '' });
      let sheetItems = 0;
      let sheetMatches = 0;

      for (let r = 0; r < rows.length; r++) {
        const row = rows[r];
        if (!row || !row.length) continue;

        // Skip header lines
        const rowStr = row.map(c => String(c).toLowerCase()).join(' ');
        if (rowStr.includes('particular') || rowStr.includes('description') || rowStr.includes('s no') || rowStr.includes('item code')) {
          continue;
        }

        // Find Code, Name, HSN, Stock, Price
        let code = '';
        let name = '';
        let hsn = '';
        let rack = '';
        let opQty = 0;
        let inQty = 0;
        let outQty = 0;
        let curStock = 0;
        let price = 0;

        // Extract code from col 1 or 2
        for (let c = 0; c < Math.min(row.length, 3); c++) {
          const val = cleanStr(row[c]);
          if (/^[A-Z]{2,6}[0-9]{2,6}$/i.test(val) || (val.length >= 4 && val.length <= 15 && /[0-9]/.test(val) && /[A-Z]/i.test(val) && !val.includes(' '))) {
            code = val.toUpperCase();
            break;
          }
        }

        // Extract Name
        for (let c = 0; c < Math.min(row.length, 5); c++) {
          const val = cleanStr(row[c]);
          if (val.length > 2 && val !== code && !/^\d+$/.test(val) && !/^\d{4}/.test(val)) {
            name = val;
            break;
          }
        }

        if (!name && !code) continue;
        if (!name && code) name = `${catConfig.name} ${code}`;
        if (!code) code = `${catConfig.code.replace('MECH-', '')}-${String(r).padStart(4, '0')}`;

        // Find HSN
        for (let c = 2; c < Math.min(row.length, 6); c++) {
          const val = cleanStr(row[c]);
          if (/^\d{4}/.test(val) && val.length <= 12) {
            hsn = val;
            break;
          }
        }

        // Extract numbers (Stock & Price)
        const nums = row.map(cell => parseNum(cell)).filter(n => n > 0);
        if (nums.length >= 1) curStock = nums[0];
        if (nums.length >= 2 && nums[nums.length - 1] > 10) price = nums[nums.length - 1];

        opQty = curStock;
        totalExcelItems++;
        sheetItems++;

        // Check if exists in database
        const { rows: exist } = await client.query(
          `SELECT id, code, name, current_stock, unit_price FROM materials WHERE code = $1 OR name = $2 LIMIT 1`,
          [code, name]
        );

        if (exist.length) {
          matchedItems++;
          sheetMatches++;
          updatedItems++;
          // Update attributes
          await client.query(
            `UPDATE materials SET
               category_id = $1,
               hsn_code = COALESCE(NULLIF($2, ''), hsn_code),
               uom = $3,
               is_active = true
             WHERE id = $4`,
            [subCat.id, hsn, catConfig.uom, exist[0].id]
          );
        } else {
          newItemsCreated++;
          sheetMatches++;
          const { rows: [newMat] } = await client.query(
            `INSERT INTO materials (code, name, category_id, uom, hsn_code, current_stock, unit_price, is_active, reorder_level, min_stock)
             VALUES ($1, $2, $3, $4, $5, $6, $7, true, 2, 1)
             RETURNING id`,
            [code, name, subCat.id, catConfig.uom, hsn || null, curStock, price]
          );

          if (curStock > 0 || price > 0) {
            await client.query(
              `INSERT INTO stock_ledger (material_id, date, transaction_type, in_qty, out_qty, balance, unit_price, value, remarks)
               VALUES ($1, CURRENT_DATE, 'opening', $2, 0, $2, $3, $4, 'Mechanical Excel Import')`,
              [newMat.id, curStock, price, curStock * price]
            );
          }
        }
      }

      validationSummary.push({
        Subcategory: catConfig.name,
        Sheet: sheetName,
        Code: catConfig.code,
        ExcelRows: sheetItems,
        Synchronized: sheetMatches
      });
    }

    await client.query('COMMIT');

    console.table(validationSummary);
    console.log(`\n✅ MECHANICAL STORE VALIDATION & SYNC COMPLETE:`);
    console.log(`  • Total Valid Excel Records Processed: ${totalExcelItems}`);
    console.log(`  • Total Database Matched / Synchronized: ${matchedItems}`);
    console.log(`  • New Materials Registered: ${newItemsCreated}`);
    console.log(`  • Existing Materials Updated: ${updatedItems}\n`);

  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  // Live Query Verification
  const { rows: [postValidation] } = await pool.query(`
    SELECT COUNT(m.id) as count,
           COALESCE(SUM(m.current_stock), 0) as total_stock,
           COALESCE(SUM(m.current_stock * m.unit_price), 0) as total_value
    FROM materials m
    JOIN material_categories mc ON mc.id = m.category_id
    WHERE mc.name ILIKE '%Mech%' OR mc.code ILIKE '%MECH%'
  `);

  console.log(`📊 Live PostgreSQL Verification for Mechanical Store:`);
  console.log(`  • Total Active Items: ${postValidation.count}`);
  console.log(`  • Total Stock Quantity: ${parseFloat(postValidation.total_stock).toFixed(3)} Units`);
  console.log(`  • Total Stock Valuation: ₹${parseFloat(postValidation.total_value).toLocaleString('en-IN', { minimumFractionDigits: 2 })}\n`);

  await pool.end();
}

validateAndSyncMechanical().catch(err => {
  console.error('Validation error:', err);
  pool.end();
  process.exit(1);
});
