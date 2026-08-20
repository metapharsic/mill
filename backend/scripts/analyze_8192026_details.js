const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');

const dir = path.resolve(__dirname, '../../Projects_Requirement/8192026');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.xlsx') || f.endsWith('.xls'));

console.log('Detailed Analysis of 8192026 Excel Files:\n');

files.forEach(f => {
  const filePath = path.join(dir, f);
  const wb = xlsx.readFile(filePath);
  console.log(`================================================================`);
  console.log(`FILE: ${f}`);
  wb.SheetNames.forEach(sheetName => {
    const ws = wb.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(ws, { header: 1 });
    console.log(`Sheet "${sheetName}" has ${data.length} rows`);
    // Find header row
    let headerRowIdx = -1;
    for (let i = 0; i < Math.min(10, data.length); i++) {
      const row = data[i];
      if (Array.isArray(row) && row.some(cell => typeof cell === 'string' && (cell.includes('ITEM') || cell.includes('CODE') || cell.includes('DETAIL') || cell.includes('STOCK') || cell.includes('BALANCE')))) {
        headerRowIdx = i;
        break;
      }
    }
    console.log(`  Header row at index ${headerRowIdx}:`, data[headerRowIdx]);
    if (headerRowIdx !== -1 && data.length > headerRowIdx + 1) {
      console.log(`  Sample item row:`, data[headerRowIdx + 1]);
    }
  });
});
