const xlsx = require('../backend/node_modules/xlsx');
const path = require('path');
const pool = require('../backend/src/db/pool');

async function readExcelDetails() {
  const fp = path.resolve(__dirname, '../Projects_Requirement/MK PAPER MILLS MCN DETAILS (1).xlsx');
  const wb = xlsx.readFile(fp);
  console.log('Sheet Names in Workbook:', wb.SheetNames);

  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(ws, { header: 1 });
    console.log(`\n======================================================`);
    console.log(`SHEET: "${sheetName}" | Total Raw Rows: ${data.length}`);
    console.log(`======================================================`);
    for (let i = 0; i < Math.min(15, data.length); i++) {
      console.log(`Row ${i}:`, JSON.stringify(data[i]));
    }
  }

  await pool.end();
}

readExcelDetails().catch(err => {
  console.error('Error reading excel:', err);
  process.exit(1);
});
