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

async function reseedClean() {
  const client = await pool.connect();
  try {
    console.log('=== RESEEDING SECTION_EQUIPMENT & EQUIPMENT EXACTLY 1-TO-1 WITH EXCEL ===\n');
    await client.query('BEGIN');

    // Reset temporary tags and sno
    await client.query("UPDATE section_equipment SET tag_name = 'TEMP-' || id WHERE tag_name LIKE '%-MCN-%'");
    await client.query("UPDATE equipment SET code = 'TEMP-' || id, sno = NULL WHERE sno IS NOT NULL");

    // 1. Fetch plant_sections, sections, machines
    const { rows: plantSections } = await client.query('SELECT id, section_code FROM plant_sections');
    const plantSecMap = {};
    plantSections.forEach(p => { plantSecMap[p.section_code] = p.id; });

    const { rows: legacySections } = await client.query('SELECT id, code FROM sections');
    const legSecMap = {};
    legacySections.forEach(s => { legSecMap[s.code] = s.id; });

    const { rows: machines } = await client.query('SELECT id, code FROM machines');
    const machineMap = {};
    machines.forEach(m => { machineMap[m.code] = m.id; });
    const defaultPm1 = machineMap['PM1'] || 1;

    // 2. Read Excel
    const filePath = path.join(__dirname, '../Projects_Requirement/MK PAPER MILLS MCN DETAILS (1).xlsx');
    const workbook = xlsx.readFile(filePath);
    const sheet = workbook.Sheets['MCN SECTION WISE DETAILS'];
    const rawRows = xlsx.utils.sheet_to_json(sheet, { defval: null });

    let currentSectionTitle = 'WIRE SECTION';
    let processed = 0;

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
      const sno = r['S.NO'] || r['S.No'] || r['SNo'];

      if (!sno || (!itemEquipment && !bearingSize && !beltNo && !shaft)) continue;

      const equipName = itemEquipment ? String(itemEquipment).trim() : `Component #${sno}`;
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

      // Upsert into section_equipment by exact SNO
      const { rows: existingSec } = await client.query('SELECT id FROM section_equipment WHERE sno = $1', [Number(sno)]);

      if (existingSec.length > 0) {
        await client.query(`
          UPDATE section_equipment
          SET section_id = $1,
              machine_id = $2,
              tag_name = $3,
              equipment_name = $4,
              equipment_type = 'Roll/Assembly',
              section_code = $5,
              bearing_size = $6,
              lock_nut = $7,
              washer = $8,
              belt_no = $9,
              shaft_size = $10,
              impeller_size = $11,
              sleeve = $12,
              couplings = $13,
              pulleys = $14,
              remarks = $15,
              is_active = true
          WHERE id = $16
        `, [
          plantSecId, machineId, tagName, equipName, secInfo.plantCode,
          bearingSize ? String(bearingSize).trim() : null,
          lockNut ? String(lockNut).trim() : null, washer ? String(washer).trim() : null,
          beltNo ? String(beltNo).trim() : null, shaft ? String(shaft).trim() : null,
          impeller ? String(impeller).trim() : null, sleeve ? String(sleeve).trim() : null,
          couplings ? String(couplings).trim() : null, pulleys ? String(pulleys).trim() : null,
          remarksSummary || null, existingSec[0].id
        ]);
      } else {
        await client.query(`
          INSERT INTO section_equipment (
            section_id, machine_id, tag_name, equipment_name, equipment_type,
            sno, section_code, bearing_size, lock_nut, washer, belt_no, shaft_size,
            impeller_size, sleeve, couplings, pulleys, remarks, is_active
          ) VALUES ($1, $2, $3, $4, 'Roll/Assembly', $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, true)
        `, [
          plantSecId, machineId, tagName, equipName,
          Number(sno), secInfo.plantCode, bearingSize ? String(bearingSize).trim() : null,
          lockNut ? String(lockNut).trim() : null, washer ? String(washer).trim() : null,
          beltNo ? String(beltNo).trim() : null, shaft ? String(shaft).trim() : null,
          impeller ? String(impeller).trim() : null, sleeve ? String(sleeve).trim() : null,
          couplings ? String(couplings).trim() : null, pulleys ? String(pulleys).trim() : null,
          remarksSummary || null
        ]);
      }

      // Upsert into equipment by exact SNO
      const { rows: existingEq } = await client.query('SELECT id FROM equipment WHERE sno = $1', [Number(sno)]);

      if (existingEq.length > 0) {
        await client.query(`
          UPDATE equipment
          SET name = $1,
              code = $2,
              section_id = $3,
              sno = $4,
              section_code = $5,
              bearing_size = $6,
              lock_nut = $7,
              washer = $8,
              belt_no = $9,
              shaft_size = $10,
              impeller_size = $11,
              sleeve = $12,
              couplings = $13,
              pulleys = $14,
              bearing_no_fs = $6,
              is_active = true
          WHERE id = $15
        `, [
          equipName, tagName, legSecId, Number(sno), secInfo.plantCode,
          bearingSize ? String(bearingSize).trim() : null,
          lockNut ? String(lockNut).trim() : null, washer ? String(washer).trim() : null,
          beltNo ? String(beltNo).trim() : null, shaft ? String(shaft).trim() : null,
          impeller ? String(impeller).trim() : null, sleeve ? String(sleeve).trim() : null,
          couplings ? String(couplings).trim() : null, pulleys ? String(pulleys).trim() : null,
          existingEq[0].id
        ]);
      } else {
        await client.query(`
          INSERT INTO equipment (
            name, code, type, section_id, sno, section_code,
            bearing_size, lock_nut, washer, belt_no, shaft_size,
            impeller_size, sleeve, couplings, pulleys, bearing_no_fs, is_active
          ) VALUES ($1, $2, 'Roll', $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $6, true)
        `, [
          equipName, tagName, legSecId, Number(sno), secInfo.plantCode,
          bearingSize ? String(bearingSize).trim() : null,
          lockNut ? String(lockNut).trim() : null, washer ? String(washer).trim() : null,
          beltNo ? String(beltNo).trim() : null, shaft ? String(shaft).trim() : null,
          impeller ? String(impeller).trim() : null, sleeve ? String(sleeve).trim() : null,
          couplings ? String(couplings).trim() : null, pulleys ? String(pulleys).trim() : null
        ]);
      }

      processed++;
    }

    await client.query('COMMIT');
    console.log(`✅ Reseeded ${processed} rows perfectly 1-to-1 matching Excel S.NO!`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Reseed error:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

reseedClean().catch(console.error);
