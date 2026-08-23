const xlsx = require('../backend/node_modules/xlsx');
const path = require('path');
const pool = require('../backend/src/db/pool');

async function syncMcnDetails() {
  const fp = path.resolve(__dirname, '../Projects_Requirement/MK PAPER MILLS MCN DETAILS (1).xlsx');
  const wb = xlsx.readFile(fp);
  const ws = wb.Sheets['MCN SECTION WISE DETAILS'];
  const rows = xlsx.utils.sheet_to_json(ws, { header: 1 });

  console.log('Total Raw Rows in Excel:', rows.length);

  let currentSection = '';
  const parsedItems = [];
  const sectionCounts = {};

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || r.length === 0) continue;
    const sno = r[0];
    const sec = r[1];
    const mcn = r[2];

    if (sec && String(sec).trim()) {
      currentSection = String(sec).trim().toUpperCase();
    }

    if (!mcn || !String(mcn).trim()) continue;
    const machineName = String(mcn).trim();

    if (!sectionCounts[currentSection]) sectionCounts[currentSection] = 0;
    sectionCounts[currentSection]++;

    parsedItems.push({
      sno: Number(sno) || parsedItems.length + 1,
      section: currentSection,
      machineName
    });
  }

  console.log('\n=== PARSED PLANT SECTIONS FROM EXCEL ===');
  Object.keys(sectionCounts).forEach(sec => {
    console.log(`- "${sec}": ${sectionCounts[sec]} machines/rolls`);
  });
  console.log(`Total Machines/Rolls Parsed: ${parsedItems.length}`);

  // Check database current state
  const { rows: dbPlantSecs } = await pool.query('SELECT id, section_code, name FROM plant_sections');
  console.log(`\nCurrent DB plant_sections count: ${dbPlantSecs.length}`);

  const { rows: dbSecEquip } = await pool.query('SELECT count(*) FROM section_equipment');
  console.log(`Current DB section_equipment count: ${dbSecEquip[0].count}`);

  await pool.end();
}

syncMcnDetails().catch(err => {
  console.error('Sync error:', err);
  process.exit(1);
});
