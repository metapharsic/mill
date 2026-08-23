const path = require('path');
const xlsx = require('../backend/node_modules/xlsx');

const filePath = path.join(__dirname, '../Projects_Requirement/MK PAPER MILLS MCN DETAILS (1).xlsx');
const workbook = xlsx.readFile(filePath);

console.log('=== WORKBOOK SHEETS IN MK PAPER MILLS MCN DETAILS (1).xlsx ===');
console.log('Sheet Names:', workbook.SheetNames);

workbook.SheetNames.forEach((sheetName) => {
  console.log(`\n------------------------------------------------------------`);
  console.log(`SHEET: "${sheetName}"`);
  console.log(`------------------------------------------------------------`);
  const sheet = workbook.Sheets[sheetName];
  const jsonData = xlsx.utils.sheet_to_json(sheet, { header: 1 });
  console.log(`Total Rows in sheet: ${jsonData.length}`);
  
  if (jsonData.length > 0) {
    console.log('Top 15 rows:');
    jsonData.slice(0, 15).forEach((r, idx) => {
      console.log(` Row ${idx + 1}:`, JSON.stringify(r));
    });
  }
});
