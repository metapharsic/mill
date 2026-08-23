const path = require('path');
const xlsx = require('../backend/node_modules/xlsx');
const pool = require('../backend/src/db/pool');

async function analyzeMcnDetails() {
  const filePath = path.join(__dirname, '../Projects_Requirement/MK PAPER MILLS MCN DETAILS (1).xlsx');
  const workbook = xlsx.readFile(filePath);
  const sheet = workbook.Sheets['MCN SECTION WISE DETAILS'];
  const rawRows = xlsx.utils.sheet_to_json(sheet, { defval: null });

  console.log(`=== FULL PARSE OF MK PAPER MILLS MCN DETAILS (1).xlsx (${rawRows.length} rows) ===\n`);

  // Let's inspect the headers and normalize sections
  let currentSection = 'GENERAL';
  const parsedRecords = [];

  rawRows.forEach((r, idx) => {
    // Check if section is specified
    const rawSection = r['Section'] || r['SECTION'] || r['section'];
    if (rawSection && typeof rawSection === 'string' && rawSection.trim()) {
      currentSection = rawSection.trim();
    }

    const itemEquipment = r['Section/Equepment/Rolls'] || r['Equepment'] || r['Equipment'] || r['Rolls'];
    const bearingSize = r[' Bearing Size'] || r['Bearing Size'] || r['bearing'];
    const lockNut = r['lock Nut'] || r['Lock Nut'] || r['lock_nut'];
    const washer = r['washer'] || r['Washer'];
    const beltNo = r['Belt No'] || r['Belt no'] || r['belt'];
    const shaft = r['Shaft '] || r['Shaft'] || r['shaft'];
    const impeller = r['Impeller'] || r['impeller'];
    const sleeve = r['Sleeve'] || r['sleeve'];
    const couplings = r['Couplings'] || r['couplings'];
    const pulleys = r['Pulleys'] || r['pulleys'];
    const sno = r['S.NO'] || r['S.No'] || r['SNo'] || idx + 1;

    if (itemEquipment || bearingSize || beltNo || shaft || impeller) {
      parsedRecords.push({
        sno,
        section: currentSection,
        equipment: itemEquipment ? String(itemEquipment).trim() : 'General Roll / Part',
        bearing_size: bearingSize ? String(bearingSize).trim() : null,
        lock_nut: lockNut ? String(lockNut).trim() : null,
        washer: washer ? String(washer).trim() : null,
        belt_no: beltNo ? String(beltNo).trim() : null,
        shaft: shaft ? String(shaft).trim() : null,
        impeller: impeller ? String(impeller).trim() : null,
        sleeve: sleeve ? String(sleeve).trim() : null,
        couplings: couplings ? String(couplings).trim() : null,
        pulleys: pulleys ? String(pulleys).trim() : null
      });
    }
  });

  console.log(`Parsed ${parsedRecords.length} valid equipment/roll records across sections.`);

  // Group by section
  const sectionGroups = {};
  parsedRecords.forEach(p => {
    if (!sectionGroups[p.section]) sectionGroups[p.section] = [];
    sectionGroups[p.section].push(p);
  });

  console.log('\n--- SECTIONS BREAKDOWN ---');
  Object.keys(sectionGroups).forEach(sec => {
    console.log(`  Section "${sec}": ${sectionGroups[sec].length} equipment / rolls`);
  });

  console.log('\n--- SAMPLE 20 PARSED RECORDS ---');
  parsedRecords.slice(0, 20).forEach(p => {
    console.log(`[${p.sno}] [${p.section}] ${p.equipment} | Bearing: ${p.bearing_size || '—'} | Nut: ${p.lock_nut || '—'} | Washer: ${p.washer || '—'} | Belt: ${p.belt_no || '—'} | Shaft: ${p.shaft || '—'}`);
  });

  // Check database equipment table
  const { rows: dbEq } = await pool.query('SELECT * FROM equipment');
  console.log(`\nCurrent Database 'equipment' table rows: ${dbEq.length}`);

  await pool.end();
}

analyzeMcnDetails().catch(console.error);
