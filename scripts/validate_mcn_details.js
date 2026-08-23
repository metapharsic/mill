const path = require('path');
const xlsx = require('../backend/node_modules/xlsx');
const pool = require('../backend/src/db/pool');

async function validateMcnUpload() {
  console.log('================================================================');
  console.log('🔍 MULTI-AGENT AUDIT: VALIDATING "MK PAPER MILLS MCN DETAILS (1).xlsx"');
  console.log('================================================================\n');

  const filePath = path.join(__dirname, '../Projects_Requirement/MK PAPER MILLS MCN DETAILS (1).xlsx');
  const workbook = xlsx.readFile(filePath);
  const sheet = workbook.Sheets['MCN SECTION WISE DETAILS'];
  const rawRows = xlsx.utils.sheet_to_json(sheet, { defval: null });

  console.log(`Excel Total Rows: ${rawRows.length}`);

  let currentSection = 'GENERAL';
  const excelRecords = [];

  rawRows.forEach((r, idx) => {
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
      excelRecords.push({
        sno: Number(sno) || idx + 1,
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

  console.log(`Extracted ${excelRecords.length} equipment entries from Excel.\n`);

  // Query database section_equipment, equipment, plant_sections
  const { rows: plantSections } = await pool.query('SELECT id, section_code, name FROM plant_sections');
  const { rows: dbSecEquip } = await pool.query('SELECT * FROM section_equipment');
  const { rows: dbEquip } = await pool.query('SELECT * FROM equipment');

  console.log(`Database State:`);
  console.log(`  - plant_sections count:   ${plantSections.length}`);
  console.log(`  - section_equipment count: ${dbSecEquip.length}`);
  console.log(`  - equipment count:         ${dbEquip.length}\n`);

  // Match each excel record against section_equipment & equipment
  let matchedInSecEquip = 0;
  let matchedInEquip = 0;
  const missingInSecEquip = [];
  const missingInEquip = [];

  excelRecords.forEach(rec => {
    const normName = rec.equipment.toLowerCase().replace(/\s+/g, ' ');
    
    const foundSecEq = dbSecEquip.find(se => 
      se.equipment_name && se.equipment_name.toLowerCase().replace(/\s+/g, ' ') === normName
    );
    if (foundSecEq) {
      matchedInSecEquip++;
    } else {
      missingInSecEquip.push(rec);
    }

    const foundEq = dbEquip.find(e => 
      e.name && e.name.toLowerCase().replace(/\s+/g, ' ') === normName
    );
    if (foundEq) {
      matchedInEquip++;
    } else {
      missingInEquip.push(rec);
    }
  });

  console.log('--- VALIDATION RESULTS ---');
  console.log(`✓ Matched in section_equipment: ${matchedInSecEquip} / ${excelRecords.length} (${((matchedInSecEquip/excelRecords.length)*100).toFixed(1)}%)`);
  console.log(`✓ Matched in equipment table:   ${matchedInEquip} / ${excelRecords.length} (${((matchedInEquip/excelRecords.length)*100).toFixed(1)}%)`);
  console.log(`❌ Missing in section_equipment: ${missingInSecEquip.length}`);
  console.log(`❌ Missing in equipment:         ${missingInEquip.length}\n`);

  if (missingInSecEquip.length > 0) {
    console.log('Sample 10 items missing in section_equipment:');
    missingInSecEquip.slice(0, 10).forEach(m => {
      console.log(`  - [${m.section}] ${m.equipment} (Bearing: ${m.bearing_size || '—'})`);
    });
  }

  await pool.end();
}

validateMcnUpload().catch(console.error);
