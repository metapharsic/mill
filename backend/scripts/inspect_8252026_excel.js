const path = require('path');
const xlsx = require('xlsx');

const fp = path.join(__dirname, '../../Projects_Requirement/8252026/Inward.xlsx');
const wb = xlsx.readFile(fp);
console.log('Sheet Names:', wb.SheetNames);
const ws = wb.Sheets['Sheet1'];
const rows = xlsx.utils.sheet_to_json(ws, { header: 1 });

console.log('Total Rows:', rows.length);
console.log('\nHeader Rows:');
console.log('Row 0:', rows[0]);
console.log('Row 1:', rows[1]);
console.log('Row 2:', rows[2]);

console.log('\nAll Data Rows:');
for (let i = 3; i < rows.length; i++) {
  const r = rows[i];
  if (!r || r.length === 0 || r.every(cell => cell === null || cell === undefined || cell === '')) continue;
  console.log(`Row ${i} (len ${r.length}):`, JSON.stringify(r));
}
