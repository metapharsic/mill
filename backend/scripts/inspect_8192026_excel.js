const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');

const dir = path.resolve(__dirname, '../../Projects_Requirement/8192026');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.xlsx') || f.endsWith('.xls'));

console.log(`Found ${files.length} Excel files in ${dir}:\n`);

files.forEach(f => {
  const filePath = path.join(dir, f);
  const wb = xlsx.readFile(filePath);
  console.log(`================================================================`);
  console.log(`FILE: ${f}`);
  console.log(`Sheets: ${wb.SheetNames.join(', ')}`);
  wb.SheetNames.forEach(sheetName => {
    const ws = wb.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(ws, { header: 1 });
    console.log(`\n--- Sheet: "${sheetName}" (${data.length} total rows) ---`);
    if (data.length > 0) {
      console.log('Row 0 (Header/Top):', JSON.stringify(data[0]));
      if (data.length > 1) console.log('Row 1:', JSON.stringify(data[1]));
      if (data.length > 2) console.log('Row 2:', JSON.stringify(data[2]));
      if (data.length > 3) console.log('Row 3:', JSON.stringify(data[3]));
      if (data.length > 4) console.log('Row 4:', JSON.stringify(data[4]));
      console.log('Sample data row:', JSON.stringify(data[Math.min(5, data.length - 1)]));
    }
  });
  console.log(`\n`);
});
