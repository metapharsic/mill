const path = require('path');
const xlsx = require('../backend/node_modules/xlsx');
const pool = require('../backend/src/db/pool');

const SECTION_CODE_MAP = {
  'WIRE SECTION': { plantCode: 'WIRE', secCode: 'WIRE', machineCode: 'PM1' },
  'PRESS SECTION': { plantCode: 'PRESS', secCode: 'PRESS', machineCode: 'PM1' },
  'UNIRUN SECTION': { plantCode: 'UNIRUN', secCode: 'UNIRUN', machineCode: 'PM1' },
  'PRE DRYER SECTION': { plantCode: 'PREDRYER', secCode: 'PRE_DRYER', machineCode: 'PM1' },
  'SIZE PRESS SECTION': { plantCode: 'SIZEPRESS', secCode: 'SIZE_PRESS', machineCode: 'PM1' },
  'POST DRYER SECTION': { plantCode: 'POSTDRYER', secCode: 'POST_DRYER', machineCode: 'PM1' },
  'CALENDER SECTION': { plantCode: 'CALENDER', secCode: 'CALENDER', machineCode: 'PM1' },
  'POP REEL SECTION': { plantCode: 'POPE', secCode: 'POPE_REEL', machineCode: 'PM1' },
  'REWIDER SECTION': { plantCode: 'REWINDER', secCode: 'REWINDER', machineCode: 'REWINDER' },
  'REWINDER SECTION': { plantCode: 'REWINDER', secCode: 'REWINDER', machineCode: 'REWINDER' },
  'VACCUM SECTION': { plantCode: 'VACUUM', secCode: 'VACUUM', machineCode: 'PM1' },
  'VACUUM SECTION': { plantCode: 'VACUUM', secCode: 'VACUUM', machineCode: 'PM1' },
  'SIZE KITCHEN SECTION': { plantCode: 'SIZEKITCHEN', secCode: 'SIZE_KITCHEN', machineCode: 'PM1' },
  'CENTRI CLEANER SECTION': { plantCode: 'CENTRI', secCode: 'CENTRICLEANER', machineCode: 'PULP' },
  'PULP MILL SECTION': { plantCode: 'PULP', secCode: 'PULPMILL', machineCode: 'PULP' },
  'ETP SECTION': { plantCode: 'ETP', secCode: 'ETP', machineCode: 'ETP' },
  'BOILER SECTION': { plantCode: 'BOILER', secCode: 'BOILER', machineCode: 'BOILER' },
  'CLOTHING': { plantCode: 'CLOTHING', secCode: 'WIRE', machineCode: 'PM1' },
  'MISCELLANEOUS SECTION': { plantCode: 'MISC', secCode: 'WIRE', machineCode: 'PM1' }
};

function normalizeName(str) {
  if (!str) return '';
  return str.toLowerCase().replace(/[-_\s]+/g, ' ').trim();
}

async function syncMcnDetails() {
  const client = await pool.connect();
  try {
    console.log('================================================================');
    console.log('⚙️ MULTI-AGENT SYNC & SEEDER: MK PAPER MILLS MCN DETAILS (1).xlsx');
    console.log('================================================================\n');

    await client.query('BEGIN');

    // 1. Fetch plant_sections, sections, and machines mappings
    const { rows: plantSections } = await client.query('SELECT id, section_code, name FROM plant_sections');
    const plantSecMap = {};
    plantSections.forEach(p => { plantSecMap[p.section_code] = p.id; });

    const { rows: legacySections } = await client.query('SELECT id, code, name FROM sections');
    const legSecMap = {};
    legacySections.forEach(s => { legSecMap[s.code] = s.id; });

    const { rows: machines } = await client.query('SELECT id, code, name FROM machines');
    const machineMap = {};
    machines.forEach(m => { machineMap[m.code] = m.id; });
    const defaultPm1 = machineMap['PM1'] || machines[0]?.id || 1;

    // Fetch existing section_equipment & equipment
    const { rows: dbSecEquip } = await client.query('SELECT id, section_id, equipment_name FROM section_equipment');
    const { rows: dbEquip } = await client.query('SELECT id, name FROM equipment');

    // 2. Read and parse Excel file
    const filePath = path.join(__dirname, '../Projects_Requirement/MK PAPER MILLS MCN DETAILS (1).xlsx');
    const workbook = xlsx.readFile(filePath);
    const sheet = workbook.Sheets['MCN SECTION WISE DETAILS'];
    const rawRows = xlsx.utils.sheet_to_json(sheet, { defval: null });

    console.log(`Processing ${rawRows.length} rows from Excel sheet "MCN SECTION WISE DETAILS"...`);

    let currentSectionTitle = 'WIRE SECTION';
    let syncedCount = 0;
    let equipSyncedCount = 0;

    for (let idx = 0; idx < rawRows.length; idx++) {
      const r = rawRows[idx];
      const rawSection = r['Section'] || r['SECTION'] || r['section'];
      if (rawSection && typeof rawSection === 'string' && rawSection.trim()) {
        currentSectionTitle = rawSection.trim();
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

      if (!itemEquipment && !bearingSize && !beltNo && !shaft) continue;

      const equipName = itemEquipment ? String(itemEquipment).trim() : `Component #${sno}`;
      const normEquipName = normalizeName(equipName);
      const secInfo = SECTION_CODE_MAP[currentSectionTitle] || { plantCode: 'MISC', secCode: 'WIRE', machineCode: 'PM1' };
      const plantSecId = plantSecMap[secInfo.plantCode] || plantSecMap['WIRE'] || 4;
      const legSecId = legSecMap[secInfo.secCode] || legSecMap['WIRE'] || 11;
      const machineId = machineMap[secInfo.machineCode] || defaultPm1;

      const tagName = `${secInfo.plantCode}-MCN-${String(sno).padStart(3, '0')}`;
      const remarksSummary = [
        bearingSize ? `Bearing: ${bearingSize}` : null,
        lockNut ? `Lock Nut: ${lockNut}` : null,
        washer ? `Washer: ${washer}` : null,
        beltNo ? `Belt: ${beltNo}` : null,
        shaft ? `Shaft: ${shaft}` : null,
        impeller ? `Impeller: ${impeller}` : null,
        sleeve ? `Sleeve: ${sleeve}` : null,
        couplings ? `Couplings: ${couplings}` : null,
        pulleys ? `Pulleys: ${pulleys}` : null
      ].filter(Boolean).join(' | ');

      // Check in section_equipment (match by normalized name or exact sno)
      const foundSecEq = dbSecEquip.find(se => 
        (se.section_id === plantSecId && normalizeName(se.equipment_name) === normEquipName) ||
        normalizeName(se.equipment_name) === normEquipName
      );

      if (foundSecEq) {
        await client.query(`
          UPDATE section_equipment
          SET sno = $1,
              section_code = $2,
              section_id = $3,
              equipment_name = $4,
              bearing_size = $5,
              lock_nut = $6,
              washer = $7,
              belt_no = $8,
              shaft_size = $9,
              impeller_size = $10,
              sleeve = $11,
              couplings = $12,
              pulleys = $13,
              remarks = COALESCE($14, remarks),
              tag_name = COALESCE(tag_name, $15),
              machine_id = COALESCE(machine_id, $16),
              is_active = true
          WHERE id = $17
        `, [
          Number(sno), secInfo.plantCode, plantSecId, equipName,
          bearingSize ? String(bearingSize).trim() : null,
          lockNut ? String(lockNut).trim() : null, washer ? String(washer).trim() : null,
          beltNo ? String(beltNo).trim() : null, shaft ? String(shaft).trim() : null,
          impeller ? String(impeller).trim() : null, sleeve ? String(sleeve).trim() : null,
          couplings ? String(couplings).trim() : null, pulleys ? String(pulleys).trim() : null,
          remarksSummary || null, tagName, machineId, foundSecEq.id
        ]);
        syncedCount++;
      } else {
        const { rows: inserted } = await client.query(`
          INSERT INTO section_equipment (
            section_id, machine_id, tag_name, equipment_name, equipment_type,
            sno, section_code, bearing_size, lock_nut, washer, belt_no, shaft_size,
            impeller_size, sleeve, couplings, pulleys, remarks, is_active
          ) VALUES ($1, $2, $3, $4, 'Roll/Assembly', $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, true)
          RETURNING id, section_id, equipment_name
        `, [
          plantSecId, machineId, tagName, equipName,
          Number(sno), secInfo.plantCode, bearingSize ? String(bearingSize).trim() : null,
          lockNut ? String(lockNut).trim() : null, washer ? String(washer).trim() : null,
          beltNo ? String(beltNo).trim() : null, shaft ? String(shaft).trim() : null,
          impeller ? String(impeller).trim() : null, sleeve ? String(sleeve).trim() : null,
          couplings ? String(couplings).trim() : null, pulleys ? String(pulleys).trim() : null,
          remarksSummary || null
        ]);
        dbSecEquip.push(inserted[0]);
        syncedCount++;
      }

      // Check in equipment table
      const foundEq = dbEquip.find(e => normalizeName(e.name) === normEquipName);

      if (foundEq) {
        await client.query(`
          UPDATE equipment
          SET sno = $1,
              section_code = $2,
              section_id = $3,
              name = $4,
              bearing_size = $5,
              lock_nut = $6,
              washer = $7,
              belt_no = $8,
              shaft_size = $9,
              impeller_size = $10,
              sleeve = $11,
              couplings = $12,
              pulleys = $13,
              bearing_no_fs = COALESCE($5, bearing_no_fs),
              code = COALESCE(code, $14),
              is_active = true
          WHERE id = $15
        `, [
          Number(sno), secInfo.plantCode, legSecId, equipName,
          bearingSize ? String(bearingSize).trim() : null, lockNut ? String(lockNut).trim() : null,
          washer ? String(washer).trim() : null, beltNo ? String(beltNo).trim() : null,
          shaft ? String(shaft).trim() : null, impeller ? String(impeller).trim() : null,
          sleeve ? String(sleeve).trim() : null, couplings ? String(couplings).trim() : null,
          pulleys ? String(pulleys).trim() : null, tagName, foundEq.id
        ]);
        equipSyncedCount++;
      } else {
        const { rows: insertedEq } = await client.query(`
          INSERT INTO equipment (
            name, code, type, section_id, sno, section_code,
            bearing_size, lock_nut, washer, belt_no, shaft_size,
            impeller_size, sleeve, couplings, pulleys, bearing_no_fs, is_active
          ) VALUES ($1, $2, 'Roll', $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $6, true)
          RETURNING id, name
        `, [
          equipName, tagName, legSecId, Number(sno), secInfo.plantCode,
          bearingSize ? String(bearingSize).trim() : null, lockNut ? String(lockNut).trim() : null,
          washer ? String(washer).trim() : null, beltNo ? String(beltNo).trim() : null,
          shaft ? String(shaft).trim() : null, impeller ? String(impeller).trim() : null,
          sleeve ? String(sleeve).trim() : null, couplings ? String(couplings).trim() : null,
          pulleys ? String(pulleys).trim() : null
        ]);
        dbEquip.push(insertedEq[0]);
        equipSyncedCount++;
      }
    }

    await client.query('COMMIT');
    console.log(`\n✅ SYNC COMPLETE:`);
    console.log(`   - section_equipment updated/inserted: ${syncedCount}`);
    console.log(`   - equipment table updated/inserted:   ${equipSyncedCount}`);
    console.log('================================================================\n');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Sync failed:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

syncMcnDetails().catch(console.error);
