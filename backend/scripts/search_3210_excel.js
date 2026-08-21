const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');

const reqDir = path.join(__dirname, '../../Projects_Requirement');

function searchExcelFiles(dir) {
  const files = fs.readdirSync(dir);
  for (const f of files) {
    const full = path.join(dir, f);
    if (fs.statSync(full).isDirectory()) {
      searchExcelFiles(full);
    } else if (f.endsWith('.xlsx')) {
      try {
        const wb = xlsx.readFile(full);
        for (const sheetName of wb.SheetNames) {
          const rows = xlsx.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1 });
          rows.forEach((row, idx) => {
            const rowStr = JSON.stringify(row);
            if (rowStr.toLowerCase().includes('3210')) {
              console.log(`📍 Found in [${path.relative(reqDir, full)}] Sheet: "${sheetName}" Line: ${idx + 1}`);
              console.log(`   Data:`, row);
            }
          });
        }
      } catch (e) {
        console.error(`Error reading ${f}:`, e.message);
      }
    }
  }
}

console.log('🔍 Searching all Excel files in Projects_Requirement for "3210"...');
searchExcelFiles(reqDir);
