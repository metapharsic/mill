const pool = require('../src/db/pool');
const XLSX = require('xlsx');
const path = require('path');

async function seedVendors() {
  const filePath = path.join(__dirname, '../../Projects_Requirement/8202026/VENDER NAME.xlsx');
  const wb = XLSX.readFile(filePath);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(ws, { defval: '' });
  
  let added = 0;
  
  for (const row of data) {
    let name = row['VENDER NAME'];
    if (!name) continue;
    name = name.trim();
    
    // Check if exists
    const { rows: existing } = await pool.query('SELECT id FROM vendors WHERE LOWER(name) = LOWER($1)', [name]);
    
    if (existing.length === 0) {
      const code = `VND-${Math.floor(Math.random() * 9000) + 1000}`; // Random code for now, or use sequence
      await pool.query(
        `INSERT INTO vendors (code, name, is_active) VALUES ($1, $2, true)`,
        [code, name]
      );
      added++;
      console.log(`Added: ${name}`);
    }
  }
  
  console.log(`Finished. Added ${added} new vendors.`);
  process.exit(0);
}

seedVendors().catch(e => {
  console.error(e);
  process.exit(1);
});
