/**
 * AGENT 1 — MCN Data Master Script
 * Normalizes plant_sections and section_equipment tables
 * directly from MK PAPER MILLS MCN DETAILS (1).xlsx
 */
'use strict';
require('dotenv').config();
const xlsx = require('xlsx');
const { Pool } = require('pg');
const path = require('path');

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'mk_paper_mill',
  password: process.env.DB_PASSWORD || 'yourpassword',
  port: parseInt(process.env.DB_PORT || '5432'),
});

// ── MCN Authoritative Section Map ────────────────────────────────────────────
const CANONICAL_SECTIONS = [
  { name: 'WIRE SECTION',           code: 'WIRE',         sort: 1,  icon: '🔗' },
  { name: 'PRESS SECTION',          code: 'PRESS',        sort: 2,  icon: '🔩' },
  { name: 'UNIRUN SECTION',         code: 'UNIRUN',       sort: 3,  icon: '⚙️'  },
  { name: 'PRE DRYER SECTION',      code: 'PREDRYER',     sort: 4,  icon: '🔥' },
  { name: 'SIZE PRESS SECTION',     code: 'SIZEPRESS',    sort: 5,  icon: '📐' },
  { name: 'POST DRYER SECTION',     code: 'POSTDRYER',    sort: 6,  icon: '♨️'  },
  { name: 'CALENDER SECTION',       code: 'CALENDER',     sort: 7,  icon: '🗓️' },
  { name: 'POPE REEL SECTION',      code: 'POPEREEL',     sort: 8,  icon: '🎞️' },
  { name: 'REWINDER SECTION',       code: 'REWINDER',     sort: 9,  icon: '🔄' },
  { name: 'VACUUM SECTION',         code: 'VACUUM',       sort: 10, icon: '💨' },
  { name: 'SIZE KITCHEN SECTION',   code: 'SIZEKITCHEN',  sort: 11, icon: '🍳' },
  { name: 'CENTRI CLEANER SECTION', code: 'CENTRI',       sort: 12, icon: '🌀' },
  { name: 'PULP MILL SECTION',      code: 'PULPMILL',     sort: 13, icon: '🏭' },
  { name: 'ETP SECTION',            code: 'ETP',          sort: 14, icon: '🌿' },
  { name: 'BOILER SECTION',         code: 'BOILER',       sort: 15, icon: '🔥' },
  { name: 'CLOTHING',               code: 'CLOTHING',     sort: 16, icon: '🧵' },
];

// Old alias codes => canonical code (for deduplication)
const ALIASES = {
  'PULP':          'PULPMILL',
  'PULP_MILL':     'PULPMILL',
  'PULPMILL_OLD':  'PULPMILL',
  'CENTRICLEANER': 'CENTRI',
  'VACCUM':        'VACUUM',
  'VACUUM_OLD':    'VACUUM',
  'PRE_DRYER':     'PREDRYER',
  'SIZE_PRESS':    'SIZEPRESS',
  'POST_DRYER':    'POSTDRYER',
  'POPE':          'POPEREEL',
  'POPE_REEL':     'POPEREEL',
  'REWIDER':       'REWINDER',
  'SIZE_KITCHEN':  'SIZEKITCHEN',
  'STARCHKITCHEN': 'SIZEKITCHEN',
  'STARCH_KITCHEN':'SIZEKITCHEN',
  'STEAMCOND':     null, // keep as-is or skip
};

async function readMCN() {
  const wb = xlsx.readFile(
    path.join(__dirname, '../../Projects_Requirement/MK PAPER MILLS MCN DETAILS (1).xlsx')
  );
  const ws = wb.Sheets[wb.SheetNames[0]];
  const data = xlsx.utils.sheet_to_json(ws, { defval: '' });

  const sectionMap = {};
  let curSection = '';
  data.forEach(r => {
    const ps = (r['Plant Section'] || '').trim();
    if (ps) curSection = ps.toUpperCase();
    if (!sectionMap[curSection]) sectionMap[curSection] = [];
    const machineName = (r['Machines'] || '').trim();
    const sno = r['S.NO'];
    if (machineName && sno !== '') {
      sectionMap[curSection].push({ sno: parseInt(sno), name: machineName });
    }
  });
  return sectionMap;
}

async function run() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    console.log('\n🤖 AGENT 1 — MCN Data Master: Starting...\n');

    const sectionMap = await readMCN();
    console.log('MCN Sections found:', Object.keys(sectionMap));

    // Step 1: Ensure sort_order column exists on plant_sections
    await client.query(`ALTER TABLE plant_sections ADD COLUMN IF NOT EXISTS sort_order integer DEFAULT 0`);
    await client.query(`ALTER TABLE plant_sections ADD COLUMN IF NOT EXISTS icon varchar(10) DEFAULT ''`);

    // Step 2: Upsert canonical sections
    const canonicalIdMap = {};
    for (const sec of CANONICAL_SECTIONS) {
      const res = await client.query(
        `INSERT INTO plant_sections (name, section_code, icon, sort_order, is_active)
         VALUES ($1, $2, $3, $4, true)
         ON CONFLICT (section_code) DO UPDATE 
           SET name=$1, icon=$3, sort_order=$4, is_active=true
         RETURNING id`,
        [sec.name, sec.code, sec.icon, sec.sort]
      );
      canonicalIdMap[sec.code] = res.rows[0].id;
      console.log(`  ✅ Canonical: ${sec.name} (${sec.code}) → id ${res.rows[0].id}`);
    }

    // Step 3: Merge alias/duplicate sections into canonical
    for (const [oldCode, canonicalCode] of Object.entries(ALIASES)) {
      if (!canonicalCode) continue;
      const oldRes = await client.query(
        `SELECT id FROM plant_sections WHERE section_code = $1`, [oldCode]);
      if (oldRes.rows.length === 0) continue;

      const oldId = oldRes.rows[0].id;
      const canonId = canonicalIdMap[canonicalCode];
      if (!canonId || oldId === canonId) continue;

      console.log(`  🔀 Merging ${oldCode}(${oldId}) → ${canonicalCode}(${canonId})`);

      // For tables with unique constraints on (section_id + something), delete conflicting rows first
      // section_kpi_snapshots has unique on (section_id, date_trunc('hour', snapshot_time))
      await client.query(`
        DELETE FROM section_kpi_snapshots old_kpi
        WHERE old_kpi.section_id = $1
        AND EXISTS (
          SELECT 1 FROM section_kpi_snapshots canon_kpi
          WHERE canon_kpi.section_id = $2
          AND date_trunc('hour', canon_kpi.snapshot_time) = date_trunc('hour', old_kpi.snapshot_time)
        )
      `, [oldId, canonId]);
      // Simple re-parent all other tables
      const reparentTables = [
        'section_equipment',
        'section_kpi_snapshots',
        'section_process_readings',
        'section_alarms',
        'section_sops',
        'machine_events',
        'quality_lab_tests',
        'material_equipment',
        'indents',
        'materials',
      ];
      for (const tbl of reparentTables) {
        try {
          await client.query(`UPDATE ${tbl} SET section_id=$1 WHERE section_id=$2`, [canonId, oldId]);
        } catch(upErr) {
          console.warn(`    ⚠️  ${tbl} update skipped: ${upErr.message}`);
        }
      }
      // material_sections: delete conflicts, then update
      await client.query(`
        DELETE FROM material_sections WHERE section_id=$1
        AND EXISTS (
          SELECT 1 FROM material_sections ms2
          WHERE ms2.material_id = material_sections.material_id AND ms2.section_id = $2
        )
      `, [oldId, canonId]);
      await client.query(`UPDATE material_sections SET section_id=$1 WHERE section_id=$2`, [canonId, oldId]);
      // Delete the old duplicate section
      await client.query(`DELETE FROM plant_sections WHERE id=$1`, [oldId]);
    }

    // Step 4: Upsert equipment from MCN under canonical sections
    let inserted = 0, updated = 0, skipped = 0;
    for (const [mcnSectionName, machines] of Object.entries(sectionMap)) {
      // Match MCN section name to canonical
      const canonical = CANONICAL_SECTIONS.find(c => {
        const cn = c.name.toUpperCase();
        const mn = mcnSectionName.toUpperCase();
        if (mn === cn) return true;
        // Fuzzy: "REWIDER" → "REWINDER", "VACCUM" → "VACUUM", "POP REEL" → "POPE REEL"
        const base = cn.replace(' SECTION', '').replace('POPE REEL', 'POP REEL');
        return mn.replace(' SECTION','') === base ||
               mn.startsWith(c.code) ||
               mn.includes(c.name.replace(' SECTION',''));
      });

      if (!canonical) {
        console.warn(`  ⚠️  No canonical match for MCN section: "${mcnSectionName}"`);
        skipped += machines.length;
        continue;
      }

      const secId = canonicalIdMap[canonical.code];

      for (const m of machines) {
        const tag = `${canonical.code}-${String(m.sno).padStart(3, '0')}`;
        // Upsert by tag_name
        const res = await client.query(`
          INSERT INTO section_equipment (tag_name, equipment_name, section_id, sno, is_active)
          VALUES ($1, $2, $3, $4, true)
          ON CONFLICT (tag_name) DO UPDATE
            SET equipment_name=$2, section_id=$3, sno=$4
          RETURNING (xmax = 0) AS is_insert
        `, [tag, m.name, secId, m.sno]);
        if (res.rows[0]?.is_insert) inserted++; else updated++;
      }
      console.log(`  📦 "${mcnSectionName}" → ${canonical.name}: ${machines.length} machines`);
    }

    await client.query('COMMIT');
    console.log(`\n✅ AGENT 1 COMPLETE:`);
    console.log(`   Canonical sections: ${CANONICAL_SECTIONS.length}`);
    console.log(`   Equipment: ${inserted} inserted, ${updated} updated, ${skipped} skipped`);
    console.log(`\n   Sections now in DB:`);
    const r = await pool.query(`SELECT id,name,section_code,sort_order,icon FROM plant_sections WHERE section_code != 'ALL' ORDER BY sort_order,id`);
    r.rows.forEach(row => console.log(`     ${row.icon||'•'} [${row.section_code}] ${row.name} (id:${row.id})`));

  } catch (e) {
    await client.query('ROLLBACK');
    console.error('❌ AGENT 1 FAILED:', e.message, e.stack);
    throw e;
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(e => { console.error(e); process.exit(1); });
