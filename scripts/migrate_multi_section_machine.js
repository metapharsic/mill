/**
 * Agent 1: Database & MCN Master Architect
 * Migration: Multi-Section & Multi-Machine Material Provisioning and MCN Sync
 * Source: Projects_Requirement/MK PAPER MILLS MCN DETAILS (1).xlsx
 */
const path = require('path');
let xlsx;
try {
  xlsx = require('xlsx');
} catch {
  xlsx = require('../backend/node_modules/xlsx');
}
const pool = require('../backend/src/db/pool');

const EXCEL_PATH = path.resolve(__dirname, '../Projects_Requirement/MK PAPER MILLS MCN DETAILS (1).xlsx');

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
  'CLOTHING': { code: 'CLOTHING', name: 'Clothing Section', icon: '🧵' }
};

async function run() {
  const client = await pool.connect();
  try {
    console.log('🚀 [Agent 1] Starting Multi-Section & Multi-Machine Database Migration...');
    await client.query('BEGIN');

    // 1. Create junction tables
    console.log('1. Creating material_sections and material_equipment tables...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS material_sections (
        id SERIAL PRIMARY KEY,
        material_id INTEGER NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
        section_id INTEGER NOT NULL REFERENCES plant_sections(id) ON DELETE CASCADE,
        is_primary BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(material_id, section_id)
      );

      CREATE INDEX IF NOT EXISTS idx_mat_sec_mat ON material_sections(material_id);
      CREATE INDEX IF NOT EXISTS idx_mat_sec_sec ON material_sections(section_id);

      CREATE TABLE IF NOT EXISTS material_equipment (
        id SERIAL PRIMARY KEY,
        material_id INTEGER NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
        section_id INTEGER REFERENCES plant_sections(id) ON DELETE SET NULL,
        machine_id INTEGER REFERENCES machines(id) ON DELETE SET NULL,
        section_equipment_id INTEGER NOT NULL REFERENCES section_equipment(id) ON DELETE CASCADE,
        remarks TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(material_id, section_equipment_id)
      );

      CREATE INDEX IF NOT EXISTS idx_mat_eq_mat ON material_equipment(material_id);
      CREATE INDEX IF NOT EXISTS idx_mat_eq_eq ON material_equipment(section_equipment_id);
      CREATE INDEX IF NOT EXISTS idx_mat_eq_sec ON material_equipment(section_id);
      CREATE INDEX IF NOT EXISTS idx_mat_eq_mcn ON material_equipment(machine_id);
    `);

    // 2. Ensure all 16 plant sections exist from MCN Excel
    console.log('2. Syncing 16 Plant Sections from MCN Details Excel...');
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

    const { rows: allPlantSections } = await client.query('SELECT id, section_code, name FROM plant_sections');
    const secIdByCode = {};
    for (const s of allPlantSections) {
      secIdByCode[s.section_code] = s.id;
    }

    // Ensure default machine PM1 exists
    const { rows: allMachines } = await client.query('SELECT id, code, name FROM machines');
    let pm1Id = allMachines.find(m => m.code === 'PM1')?.id;
    if (!pm1Id) {
      if (allMachines.length > 0) {
        pm1Id = allMachines[0].id;
      } else {
        const insMcn = await client.query(`
          INSERT INTO machines (name, code, type, capacity_tpd, is_active)
          VALUES ('Paper Machine 1', 'PM1', 'Fourdrinier', 150, true)
          RETURNING id
        `);
        pm1Id = insMcn.rows[0].id;
      }
    }

    // 3. Read MCN Details Excel and populate section_equipment
    console.log(`3. Reading MCN Excel file: ${EXCEL_PATH}...`);
    const wb = xlsx.readFile(EXCEL_PATH);
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rawRows = xlsx.utils.sheet_to_json(ws, { header: 1 });

    let currentSectionKey = '';
    let equipCount = 0;

    for (let r = 1; r < rawRows.length; r++) {
      const row = rawRows[r];
      if (!row) continue;
      const secCell = row[1] ? String(row[1]).trim() : '';
      const equipCell = row[2] ? String(row[2]).trim() : '';

      if (secCell && SECTION_MAP[secCell.toUpperCase()]) {
        currentSectionKey = secCell.toUpperCase();
      }

      if (equipCell && currentSectionKey && SECTION_MAP[currentSectionKey]) {
        const secMeta = SECTION_MAP[currentSectionKey];
        const sectionId = secIdByCode[secMeta.code];
        if (!sectionId) continue;

        const tagName = `${secMeta.code}-MCN-${String(equipCount + 1).padStart(3, '0')}`;

        // Check if section_equipment exists
        const existingEq = await client.query(
          'SELECT id FROM section_equipment WHERE section_id = $1 AND LOWER(TRIM(equipment_name)) = LOWER(TRIM($2))',
          [sectionId, equipCell]
        );

        if (existingEq.rows.length === 0) {
          const tagCheck = await client.query('SELECT id FROM section_equipment WHERE tag_name = $1', [tagName]);
          const finalTag = tagCheck.rows.length > 0 ? `${tagName}-${equipCount + 1}` : tagName;

          await client.query(`
            INSERT INTO section_equipment (
              section_id, machine_id, tag_name, equipment_name, equipment_type, is_active
            ) VALUES ($1, $2, $3, $4, 'Roll/Assembly', true)
          `, [sectionId, pm1Id, finalTag, equipCell]);
          equipCount++;
        }
      }
    }
    console.log(`   + Verified & seeded section_equipment from MCN Excel (${equipCount} new rolls/equipment added).`);

    // 4. Seed initial relationships from existing materials table into material_sections and material_equipment
    console.log('4. Migrating existing material relationships into material_sections & material_equipment...');
    const seedSectionsRes = await client.query(`
      INSERT INTO material_sections (material_id, section_id, is_primary)
      SELECT m.id, m.section_id, true
      FROM materials m
      WHERE m.section_id IS NOT NULL
      ON CONFLICT (material_id, section_id) DO UPDATE SET is_primary = true;
    `);
    console.log(`   + Migrated ${seedSectionsRes.rowCount || 0} existing section links into material_sections.`);

    const seedEquipRes = await client.query(`
      INSERT INTO material_equipment (material_id, section_id, machine_id, section_equipment_id)
      SELECT m.id, m.section_id, m.machine_id, m.section_equipment_id
      FROM materials m
      WHERE m.section_equipment_id IS NOT NULL
      ON CONFLICT (material_id, section_equipment_id) DO NOTHING;
    `);
    console.log(`   + Migrated ${seedEquipRes.rowCount || 0} existing equipment links into material_equipment.`);

    await client.query('COMMIT');
    console.log('✅ [Agent 1] Database Migration completed successfully!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ [Agent 1] Database Migration failed:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
