const pool = require('../backend/src/db/pool');
const path = require('path');
const xlsx = require('../backend/node_modules/xlsx');

async function findDiff() {
  const filePath = path.join(__dirname, '../Projects_Requirement/MK PAPER MILLS MCN DETAILS (1).xlsx');
  const workbook = xlsx.readFile(filePath);
  const sheet = workbook.Sheets['MCN SECTION WISE DETAILS'];
  const rawRows = xlsx.utils.sheet_to_json(sheet, { defval: null });

  const { rows: secEq } = await pool.query('SELECT sno, equipment_name FROM section_equipment WHERE sno IS NOT NULL');
  const existingSno = new Set(secEq.map(s => s.sno));

  console.log('Total Excel rows:', rawRows.length);
  console.log('Total section_equipment rows with sno:', secEq.length);

  rawRows.forEach((r, idx) => {
    const sno = r['S.NO'] || r['S.No'] || r['SNo'] || idx + 1;
    const name = r['Section/Equepment/Rolls'] || r['Equepment'] || r['Equipment'] || r['Rolls'];
    if (!existingSno.has(Number(sno))) {
      console.log(`Missing in section_equipment -> S.NO: ${sno}, Name: "${name}", Row: ${JSON.stringify(r)}`);
    }
  });

  // Check if any sno has multiple entries in Excel
  const counts = {};
  rawRows.forEach((r, idx) => {
    const sno = r['S.NO'] || r['S.No'] || r['SNo'] || idx + 1;
    counts[sno] = (counts[sno] || 0) + 1;
  });
  Object.keys(counts).forEach(k => {
    if (counts[k] > 1) {
      console.log(`Duplicate S.NO in Excel: ${k} occurs ${counts[k]} times`);
    }
  });

  await pool.end();
}

findDiff().catch(console.error);
