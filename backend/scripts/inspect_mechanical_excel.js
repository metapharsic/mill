const xlsx = require('xlsx');
const path = require('path');
const pool = require('../src/db/pool');

async function inspectMechanical() {
  const filePath = path.resolve(__dirname, '../../Projects_Requirement/8152026/MECHANICAL STORE AUGUST-2026.xlsx');
  const wb = xlsx.readFile(filePath);

  console.log(`\n======================================================`);
  console.log(`📋 MECHANICAL STORE AUGUST-2026.xlsx Inspection`);
  console.log(`======================================================\n`);
  console.log(`Total Sheets Found: ${wb.SheetNames.length}`);
  console.log(`Sheet Names:`, wb.SheetNames);

  let totalExcelItems = 0;
  const sheetStats = [];

  for (const sheetName of wb.SheetNames) {
    const sheet = wb.Sheets[sheetName];
    const rows = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: '' });
    
    // Find header row
    let headerIdx = -1;
    for (let r = 0; r < Math.min(rows.length, 10); r++) {
      const rowStr = rows[r].map(c => String(c).toLowerCase()).join(' ');
      if (rowStr.includes('item') || rowStr.includes('particular') || rowStr.includes('description') || rowStr.includes('size') || rowStr.includes('code') || rowStr.includes('qty')) {
        headerIdx = r;
        break;
      }
    }

    const dataRows = headerIdx !== -1 ? rows.slice(headerIdx + 1) : rows;
    const validRows = dataRows.filter(r => r.some(cell => String(cell).trim().length > 0));
    totalExcelItems += validRows.length;

    sheetStats.push({
      sheetName,
      headerIdx,
      headers: headerIdx !== -1 ? rows[headerIdx].filter(Boolean) : [],
      rowCount: validRows.length,
      sampleRow: validRows[0] || []
    });
  }

  console.table(sheetStats.map(s => ({ Sheet: s.sheetName, HeaderRow: s.headerIdx, Items: s.rowCount, Sample: JSON.stringify(s.sampleRow).slice(0, 50) })));
  console.log(`\nTotal Valid Items Across All Mechanical Sheets: ${totalExcelItems}`);

  // Now compare with Database
  console.log(`\n======================================================`);
  console.log(`🔍 Database Comparison (PostgreSQL)`);
  console.log(`======================================================\n`);

  const { rows: categories } = await pool.query(`
    SELECT mc.id, mc.name, mc.code, mc.parent_id, p.name AS parent_name,
           COUNT(m.id) AS material_count,
           COALESCE(SUM(m.current_stock), 0) AS total_stock,
           COALESCE(SUM(m.current_stock * m.unit_price), 0) AS total_value
    FROM material_categories mc
    LEFT JOIN material_categories p ON p.id = mc.parent_id
    LEFT JOIN materials m ON m.category_id = mc.id AND m.is_active = true
    WHERE mc.name ILIKE '%Mech%' OR mc.code ILIKE '%MECH%' OR p.name ILIKE '%Mech%'
    GROUP BY mc.id, mc.name, mc.code, mc.parent_id, p.name
    ORDER BY mc.name ASC
  `);

  console.table(categories.map(c => ({
    ID: c.id,
    Category: c.name,
    Code: c.code,
    Parent: c.parent_name || '—',
    Materials: c.material_count,
    Stock: parseFloat(c.total_stock).toFixed(2),
    Valuation: '₹' + parseFloat(c.total_value).toLocaleString('en-IN', { maximumFractionDigits: 2 })
  })));

  const { rows: [mechTotal] } = await pool.query(`
    SELECT COUNT(m.id) as count,
           COALESCE(SUM(m.current_stock), 0) as stock,
           COALESCE(SUM(m.current_stock * m.unit_price), 0) as value
    FROM materials m
    JOIN material_categories mc ON mc.id = m.category_id
    LEFT JOIN material_categories p ON p.id = mc.parent_id
    WHERE mc.name ILIKE '%Mech%' OR mc.code ILIKE '%MECH%' OR p.name ILIKE '%Mech%'
  `);

  console.log(`\nTotal Active Mechanical Materials in Database: ${mechTotal.count}`);
  console.log(`Total Mechanical Stock Quantity: ${parseFloat(mechTotal.stock).toFixed(3)}`);
  console.log(`Total Mechanical Valuation: ₹${parseFloat(mechTotal.value).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`);

  await pool.end();
}

inspectMechanical().catch(err => {
  console.error(err);
  pool.end();
  process.exit(1);
});
