/**
 * Migration & Seeding: Materials Section and Machine Linking
 * Source: Projects_Requirement/MK PAPER MILLS MCN DETAILS (1).xlsx
 */
const fs = require('fs');
const path = require('path');
const pool = require('../backend/src/db/pool');

// Section mapping table from Excel Header to plant_sections code
const SECTION_MAP = {
  'WIRE SECTION': { code: 'WIRE', name: 'Wire Section', icon: '〰️' },
  'PRESS SECTION': { code: 'PRESS', name: 'Press Section', icon: '🔄' },
  'UNIRUN SECTION': { code: 'UNIRUN', name: 'Unirun', icon: '⚙️' },
  'PRE DRYER SECTION': { code: 'PREDRYER', name: 'Pre Dryer', icon: '♨️' },
  'SIZE PRESS SECTION': { code: 'SIZEPRESS', name: 'Size Press', icon: '🗜️' },
  'POST DRYER SECTION': { code: 'POSTDRYER', name: 'Post Dryer', icon: '♨️' },
  'CALENDER SECTION': { code: 'CALENDER', name: 'Calender', icon: '📄' },
  'POP REEL SECTION': { code: 'POPE', name: 'Pope Reel', icon: '🎞️' },
  'REWIDER SECTION': { code: 'REWINDER', name: 'Rewinder', icon: '🌀' },
  'VACCUM SECTION': { code: 'VACUUM', name: 'Vacuum', icon: '💨' },
  'SIZE KITCHEN SECTION': { code: 'SIZEKITCHEN', name: 'Size Kitchen', icon: '🧪' },
  'CENTRI CLEANER SECTION': { code: 'CENTRI', name: 'Centricleaner', icon: '🌪️' },
  'PULP MILL SECTION': { code: 'PULP', name: 'Pulp Mill', icon: '🪵' },
  'ETP SECTION': { code: 'ETP', name: 'ETP', icon: '💧' },
  'BOILER SECTION': { code: 'BOILER', name: 'Boiler', icon: '🔥' },
  'CLOTHING': { code: 'CLOTHING', name: 'Clothing Section', icon: '🧵' },
  'MISCELLANEOUS SECTION': { code: 'MISC', name: 'Miscellaneous Section', icon: '📦' }
};

async function run() {
  const client = await pool.connect();
  try {
    console.log('🚀 Starting Materials Section & Machine Migration...');
    await client.query('BEGIN');

    // 1. Add columns to materials table
    console.log('1. Altering materials table to add section_id, machine_id, section_equipment_id...');
    await client.query(`
      ALTER TABLE materials
        ADD COLUMN IF NOT EXISTS section_id INTEGER REFERENCES plant_sections(id) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS machine_id INTEGER REFERENCES machines(id) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS section_equipment_id INTEGER REFERENCES section_equipment(id) ON DELETE SET NULL;
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_materials_section_id ON materials(section_id);
      CREATE INDEX IF NOT EXISTS idx_materials_machine_id ON materials(machine_id);
      CREATE INDEX IF NOT EXISTS idx_materials_section_equipment_id ON materials(section_equipment_id);
    `);

    // 2. Ensure all plant_sections exist
    console.log('2. Ensuring all plant_sections exist...');
    for (const [secTitle, secMeta] of Object.entries(SECTION_MAP)) {
      const existing = await client.query(
        'SELECT id FROM plant_sections WHERE section_code = $1 OR UPPER(name) = $2',
        [secMeta.code, secMeta.name.toUpperCase()]
      );
      if (existing.rows.length === 0) {
        await client.query(
          `INSERT INTO plant_sections (section_code, name, icon, description, sort_order, is_active)
           VALUES ($1, $2, $3, $4, 50, true)`,
          [secMeta.code, secMeta.name, secMeta.icon, `${secMeta.name} from MK Paper Mill Machinery Registry`]
        );
        console.log(`   + Created plant_section: ${secMeta.code} (${secMeta.name})`);
      }
    }

    // Fetch refreshed plant_sections
    const { rows: allSections } = await client.query('SELECT id, section_code, name FROM plant_sections');
    const secIdByCode = {};
    for (const s of allSections) {
      secIdByCode[s.section_code] = s.id;
    }

    // Fetch machines to map default machine IDs
    const { rows: allMachines } = await client.query('SELECT id, code, name FROM machines');
    const machineIdByCode = {};
    for (const m of allMachines) {
      machineIdByCode[m.code] = m.id;
    }
    const pm1Id = machineIdByCode['PM1'] || allMachines[0]?.id || null;

    // 3. Load MCN data from JSON
    const mcnJsonPath = path.resolve(__dirname, '../scratch_mcn_data.json');
    if (fs.existsSync(mcnJsonPath)) {
      const mcnData = JSON.parse(fs.readFileSync(mcnJsonPath, 'utf8'));
      console.log('3. Seeding equipment/rolls from MCN details into section_equipment...');

      let insertedCount = 0;
      let updatedCount = 0;

      for (const [secKey, equipList] of Object.entries(mcnData)) {
        const secMeta = SECTION_MAP[secKey];
        if (!secMeta) continue;
        const sectionId = secIdByCode[secMeta.code];
        if (!sectionId) continue;

        for (let idx = 0; idx < equipList.length; idx++) {
          const item = equipList[idx];
          const equipName = item.equipment;
          const tagName = `${secMeta.code}-MCN-${String(idx + 1).padStart(3, '0')}`;
          const remarksStr = Object.entries(item.specs || {})
            .map(([k, v]) => `${k}: ${v}`)
            .join(' | ');

          // Check if section_equipment already exists by equipment_name & section_id
          const existing = await client.query(
            'SELECT id FROM section_equipment WHERE section_id = $1 AND LOWER(equipment_name) = LOWER($2)',
            [sectionId, equipName]
          );

          if (existing.rows.length === 0) {
            // Check if tag_name exists
            const tagCheck = await client.query('SELECT id FROM section_equipment WHERE tag_name = $1', [tagName]);
            const finalTag = tagCheck.rows.length > 0 ? `${tagName}-${Date.now().toString().slice(-4)}` : tagName;

            await client.query(
              `INSERT INTO section_equipment (
                section_id, machine_id, tag_name, equipment_name, equipment_type, remarks, is_active
              ) VALUES ($1, $2, $3, $4, 'Roll/Assembly', $5, true)`,
              [sectionId, pm1Id, finalTag, equipName, remarksStr || null]
            );
            insertedCount++;
          } else {
            // Update remarks if helpful
            if (remarksStr) {
              await client.query(
                `UPDATE section_equipment SET remarks = COALESCE(remarks, $1) WHERE id = $2`,
                [remarksStr, existing.rows[0].id]
              );
            }
            updatedCount++;
          }
        }
      }
      console.log(`   + section_equipment sync complete: ${insertedCount} inserted, ${updatedCount} verified/updated.`);
    }

    await client.query('COMMIT');
    console.log('✅ Migration & Seeding completed successfully!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(console.error);
