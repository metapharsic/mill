/**
 * Seed 39 paper mill chemicals into materials table.
 * Run: node scripts/seed_chemicals.js
 */
const path = require('path');
const backendModules = path.join(__dirname, '../backend/node_modules');
const { Pool } = require(path.join(backendModules, 'pg'));
require(path.join(backendModules, 'dotenv')).config({ path: path.join(__dirname, '../backend/.env') });

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost', port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'mk_paper_mill',
  user: process.env.DB_USER || 'postgres', password: process.env.DB_PASSWORD || 'postgres',
});

// category_id=3 = Chemicals
const CHEMICALS = [
  // ── FROM MILL REGISTER (actual branded) ─────────────────────────────────────
  { code:'CHEM-001', name:'Starch',                           hsn:'11081900', uom:'KG',  min:500,  max:5000, reorder:1000, unit_price:45,    section:'Wet-End / Size Press',        criticality:'A', strategy:'Bulk Commodity Purchase',             oem:'Regional Starch Supplier',             audit:'Monthly',  calibration:'Viscosity test before use' },
  { code:'CHEM-002', name:'PAC - Polyaluminium Chloride (Solid)', hsn:'28273990', uom:'KG',  min:200,  max:2000, reorder:500,  unit_price:28,    section:'ETP / Stock Prep',            criticality:'A', strategy:'Bulk Industrial Purchase',            oem:'Aditya Birla / BASF India',            audit:'Monthly',  calibration:'Jar test dosage validation' },
  { code:'CHEM-003', name:'Surface Size 700C',                hsn:'11081900', uom:'KG',  min:300,  max:3000, reorder:600,  unit_price:62,    section:'Size Press',                  criticality:'A', strategy:'OEM Contract Sourcing',               oem:'Hindustan Gum / Roquette India',       audit:'Monthly',  calibration:'Cobb value test post-application' },
  { code:'CHEM-004', name:'Enzyme (Liquid)',                  hsn:'35079090', uom:'LTR', min:50,   max:500,  reorder:100,  unit_price:380,   section:'Size Kitchen / Starch Kitchen', criticality:'B', strategy:'Specialty Chemical Supplier',          oem:'Novozymes / MAPS India',               audit:'Quarterly','calibration':'Viscosity reduction test' },
  { code:'CHEM-005', name:'Retention Aid 2024 (CPAM)',        hsn:'39069090', uom:'KG',  min:50,   max:500,  reorder:100,  unit_price:520,   section:'Wire Section',                criticality:'A', strategy:'OEM Direct Procurement',              oem:'NALCO / SNF India',                    audit:'Monthly',  calibration:'Britt jar retention test' },
  { code:'CHEM-006', name:'Defoamer SE-100',                  hsn:'34029020', uom:'LTR', min:50,   max:500,  reorder:100,  unit_price:220,   section:'Pulp Mill / ETP',             criticality:'B', strategy:'Standard Industrial Distribution',     oem:'Nalco / Ashland India',                audit:'Monthly',  calibration:'Foam cup test validation' },
  { code:'CHEM-007', name:'Coagulant CL-200 (Poly DADMAC)',   hsn:'39061000', uom:'LTR', min:100,  max:1000, reorder:200,  unit_price:185,   section:'ETP / DAF',                   criticality:'A', strategy:'Specialty Chemical Supplier',          oem:'SNF India / NALCO',                    audit:'Monthly',  calibration:'Zeta potential dosage test' },
  { code:'CHEM-008', name:'Krofta 303 (DAF Flotation Aid)',   hsn:'38249990', uom:'LTR', min:100,  max:800,  reorder:200,  unit_price:420,   section:'ETP - Krofta DAF Unit',       criticality:'A', strategy:'OEM Service Exchange Protocol',        oem:'Krofta Engineering',                   audit:'Monthly',  calibration:'DAF effluent TSS check' },
  { code:'CHEM-009', name:'Belt Press SUCHEM-638 (Polymer)',  hsn:'39069090', uom:'LTR', min:50,   max:400,  reorder:100,  unit_price:650,   section:'ETP - Sludge Dewatering',     criticality:'B', strategy:'OEM Contract Sourcing',               oem:'Suchem / NALCO',                       audit:'Quarterly','calibration':'Sludge cake dry solids check' },
  { code:'CHEM-010', name:'Golden Yellow Dye',                hsn:'32041700', uom:'KG',  min:10,   max:100,  reorder:20,   unit_price:1200,  section:'Wire Section / Head Box',     criticality:'C', strategy:'Specialty Chemical Supplier',          oem:'Atul Ltd / Colourtex',                 audit:'Quarterly','calibration':'Shade matching against standard' },
  { code:'CHEM-011', name:'SE-Bond 102 (Cracking Agent)',     hsn:'34021990', uom:'LTR', min:50,   max:300,  reorder:80,   unit_price:890,   section:'Size Press / Post Dryer',     criticality:'B', strategy:'OEM Direct Procurement',              oem:'Senapathy Whiteley / Buckman',         audit:'Monthly',  calibration:'Scott bond / Z-direction test' },
  { code:'CHEM-012', name:'Promask 192',                      hsn:'34021990', uom:'LTR', min:30,   max:200,  reorder:60,   unit_price:750,   section:'Size Press',                  criticality:'B', strategy:'OEM Direct Procurement',              oem:'Senapathy Whiteley',                   audit:'Monthly',  calibration:'Surface pick / IGT test' },
  { code:'CHEM-013', name:'Prosolve 126 (Stickies Control)',  hsn:'34021990', uom:'LTR', min:50,   max:300,  reorder:80,   unit_price:680,   section:'Pulp Mill / Wire Section',    criticality:'B', strategy:'OEM Direct Procurement',              oem:'Senapathy Whiteley / Nalco',           audit:'Monthly',  calibration:'Dirt count before/after' },
  { code:'CHEM-014', name:'Prosolve ADV (Advanced Stickies)', hsn:'34021990', uom:'LTR', min:30,   max:200,  reorder:50,   unit_price:920,   section:'Pulp Mill / Wire Section',    criticality:'B', strategy:'OEM Direct Procurement',              oem:'Senapathy Whiteley',                   audit:'Monthly',  calibration:'Dirt count before/after' },
  { code:'CHEM-015', name:'Bleaching Powder (Calcium Hypochlorite)', hsn:'28281000', uom:'KG',  min:100,  max:1000, reorder:200,  unit_price:32,    section:'Pulp Mill - Bleaching',       criticality:'A', strategy:'Bulk Industrial Purchase',            oem:'Regional Chemical Distributor',        audit:'Monthly',  calibration:'Available Cl₂ test (iodometric)' },
  { code:'CHEM-016', name:'Sodium Hypochlorite [Hypo] (Liquid)', hsn:'28281000', uom:'LTR', min:500,  max:5000, reorder:1000, unit_price:8,     section:'Pulp Mill / ETP',             criticality:'A', strategy:'Bulk Industrial Purchase',            oem:'Regional Chemical Distributor',        audit:'Monthly',  calibration:'Cl₂ concentration test' },
  { code:'CHEM-017', name:'HCL - Hydrochloric Acid [Pulp Mill]', hsn:'28061010', uom:'LTR', min:200,  max:2000, reorder:400,  unit_price:12,    section:'Pulp Mill / DM Plant',        criticality:'A', strategy:'Industrial Acid Supplier',            oem:'GACL / Tata Chemicals',                audit:'Monthly',  calibration:'pH meter calibration before dosing' },
  { code:'CHEM-018', name:'pH Booster 3230 (Liquid)',         hsn:'29211990', uom:'LTR', min:100,  max:800,  reorder:200,  unit_price:340,   section:'Boiler - Condensate Circuit',  criticality:'A', strategy:'OEM Service Contract',                oem:'Nalco / Accepta',                      audit:'Monthly',  calibration:'Condensate pH log (target 8.5-9.5)' },
  { code:'CHEM-019', name:'Anti-Scalen 3220 (Boiler Scale Inhibitor)', hsn:'29313990', uom:'LTR', min:100,  max:800,  reorder:200,  unit_price:560,   section:'Boiler',                      criticality:'A', strategy:'OEM Service Contract',                oem:'Nalco / Accepta',                      audit:'Monthly',  calibration:'Hardness test of boiler water' },
  { code:'CHEM-020', name:'Oxygen Scavenger 3210 (Liquid)',   hsn:'29252900', uom:'LTR', min:100,  max:800,  reorder:200,  unit_price:480,   section:'Boiler - Feed Water',         criticality:'A', strategy:'OEM Service Contract',                oem:'Nalco / Accepta',                      audit:'Monthly',  calibration:'DO meter check (target <10 ppb)' },
  { code:'CHEM-021', name:'RO Anti-Scalen 3291 (Liquid)',     hsn:'38244090', uom:'LTR', min:50,   max:400,  reorder:100,  unit_price:720,   section:'ETP - RO / UF Membranes',     criticality:'B', strategy:'OEM Service Contract',                oem:'Nalco / DuPont Water Solutions',       audit:'Monthly',  calibration:'SDI test + permeate conductivity' },
  { code:'CHEM-022', name:'Caustic Soda Flakes (NaOH)',       hsn:'28151100', uom:'KG',  min:500,  max:5000, reorder:1000, unit_price:38,    section:'Pulp Mill / ETP / DM Plant',  criticality:'A', strategy:'Bulk Industrial Purchase',            oem:'GACL / Reliance Industries',           audit:'Monthly',  calibration:'Titration strength check' },
  { code:'CHEM-023', name:'Descaling Agent 3250 (Liquid)',    hsn:'28070010', uom:'LTR', min:100,  max:600,  reorder:150,  unit_price:390,   section:'Boiler - Tube Descaling',     criticality:'B', strategy:'OEM Service Contract',                oem:'Nalco / Accepta',                      audit:'Quarterly','calibration':'Post-descale inspection + pH neutralization' },
  // ── ADDITIONAL STANDARD CHEMICALS ───────────────────────────────────────────
  { code:'CHEM-024', name:'AKD - Alkyl Ketene Dimer (Internal Sizing)', hsn:'34021900', uom:'KG',  min:100,  max:1000, reorder:200,  unit_price:280,   section:'Wet-End / Size Press',        criticality:'A', strategy:'OEM Direct Procurement',              oem:'Kemira / AkzoNobel',                   audit:'Monthly',  calibration:'Cobb value + contact angle test' },
  { code:'CHEM-025', name:'Sodium Silicate (Na₂SiO₃)',        hsn:'28392000', uom:'KG',  min:200,  max:2000, reorder:400,  unit_price:22,    section:'Pulp Mill - Deinking',        criticality:'B', strategy:'Bulk Industrial Purchase',            oem:'Kiran Global / Shanti Chemicals',      audit:'Monthly',  calibration:'Baumé gravity check' },
  { code:'CHEM-026', name:'Hydrogen Peroxide H₂O₂ (50%)',     hsn:'28470000', uom:'LTR', min:200,  max:2000, reorder:400,  unit_price:58,    section:'Pulp Mill - Bleaching',       criticality:'A', strategy:'Industrial Oxidant Supplier',         oem:'Gujarat Alkalies / Solvay India',      audit:'Monthly',  calibration:'Titration residual H₂O₂ check' },
  { code:'CHEM-027', name:'DTPA Chelating Agent',             hsn:'29224990', uom:'KG',  min:50,   max:400,  reorder:100,  unit_price:320,   section:'Bleach Plant',                criticality:'B', strategy:'Specialty Chemical Supplier',          oem:'BASF India / Kemira',                  audit:'Monthly',  calibration:'Metal ion assay (Fe/Mn ppm)' },
  { code:'CHEM-028', name:'Alum - Aluminium Sulphate',        hsn:'28332200', uom:'KG',  min:500,  max:5000, reorder:1000, unit_price:18,    section:'Wet-End / ETP',               criticality:'B', strategy:'Bulk Industrial Purchase',            oem:'FACT / Regional Distributor',          audit:'Monthly',  calibration:'pH check after dosing (target 4.5-5.5)' },
  { code:'CHEM-029', name:'Rosin Size (Internal Sizing - Acid)', hsn:'38030090', uom:'KG',  min:100,  max:1000, reorder:200,  unit_price:95,    section:'Wet-End',                     criticality:'B', strategy:'Standard Industrial Distribution',     oem:'Arakawa / Pinova',                     audit:'Monthly',  calibration:'Cobb value test' },
  { code:'CHEM-030', name:'Biocide / Slimicide',              hsn:'38089190', uom:'LTR', min:50,   max:400,  reorder:100,  unit_price:650,   section:'Wet-End / Size Kitchen',      criticality:'A', strategy:'OEM Contract Sourcing',               oem:'Nalco / Buckman / Thor',               audit:'Monthly',  calibration:'ATP bioluminescence or plate count' },
  { code:'CHEM-031', name:'OBA / FWA (Optical Brightening Agent)', hsn:'32042090', uom:'KG',  min:50,   max:300,  reorder:80,   unit_price:1800,  section:'Size Press',                  criticality:'B', strategy:'OEM Direct Procurement',              oem:'Clariant / Archroma India',            audit:'Monthly',  calibration:'TAPPI brightness meter check' },
  { code:'CHEM-032', name:'Bentonite (Microparticle System)', hsn:'25081000', uom:'KG',  min:200,  max:2000, reorder:400,  unit_price:25,    section:'Wire Section - Retention',    criticality:'B', strategy:'Bulk Mineral Purchase',               oem:'Imerys / Ashapura Minechem',           audit:'Monthly',  calibration:'Turbidity reduction test' },
  { code:'CHEM-033', name:'Sulphuric Acid H₂SO₄ (98%)',       hsn:'28070010', uom:'LTR', min:200,  max:2000, reorder:400,  unit_price:15,    section:'ETP / DM Plant',              criticality:'A', strategy:'Industrial Acid Supplier',            oem:'GSFC / FACT',                          audit:'Monthly',  calibration:'pH neutralization test' },
  { code:'CHEM-034', name:'Tri-Sodium Phosphate (TSP)',        hsn:'28352990', uom:'KG',  min:50,   max:400,  reorder:100,  unit_price:110,   section:'Boiler',                      criticality:'B', strategy:'Standard Industrial Distribution',     oem:'Aditya Birla Chemicals',               audit:'Monthly',  calibration:'P-alkalinity test boiler water' },
  { code:'CHEM-035', name:'Lime - Calcium Hydroxide Ca(OH)₂', hsn:'28252000', uom:'KG',  min:500,  max:5000, reorder:1000, unit_price:8,     section:'ETP',                         criticality:'A', strategy:'Bulk Mineral Purchase',               oem:'Regional Lime Supplier',               audit:'Monthly',  calibration:'pH correction check (target 7.0-8.0)' },
  { code:'CHEM-036', name:'Felt Wash / Conditioner (Alkaline)', hsn:'34029090', uom:'LTR', min:50,   max:400,  reorder:100,  unit_price:480,   section:'Press Section - Felts',       criticality:'B', strategy:'OEM Contract Sourcing',               oem:'Voith / Andritz / Albany',             audit:'Monthly',  calibration:'Felt permeability test before/after' },
  { code:'CHEM-037', name:'Hydraulic Oil (ISO VG 46)',         hsn:'27101990', uom:'LTR', min:200,  max:2000, reorder:400,  unit_price:185,   section:'Press / Calender Hydraulics', criticality:'A', strategy:'Standard Industrial Distribution',     oem:'Castrol / Servo / Shell',              audit:'Quarterly','calibration':'Viscosity + contamination check' },
  { code:'CHEM-038', name:'Compressor Oil (Screw)',            hsn:'27101990', uom:'LTR', min:100,  max:800,  reorder:200,  unit_price:320,   section:'Compressors',                 criticality:'A', strategy:'OEM Service Contract',                oem:'Atlas Copco / ELGi',                   audit:'Quarterly','calibration':'Oil analysis lab report' },
  { code:'CHEM-039', name:'Grease NLGI-2 (EP Grease)',        hsn:'27100000', uom:'KG',  min:50,   max:400,  reorder:100,  unit_price:220,   section:'All Sections - Bearings',     criticality:'B', strategy:'Standard Industrial Distribution',     oem:'Castrol / SKF / Shell',                audit:'Quarterly','calibration':'Bearing temp monitoring' },
];

async function run() {
  // Get Chemicals category id
  const { rows: cats } = await pool.query(`SELECT id FROM material_categories WHERE code='CHEM'`);
  const chemCatId = cats[0]?.id;
  if (!chemCatId) { console.error('Chemicals category not found'); process.exit(1); }

  let ins = 0, upd = 0, err = 0;

  for (const c of CHEMICALS) {
    try {
      const { rows: ex } = await pool.query('SELECT id FROM materials WHERE code=$1', [c.code]);
      if (ex.length) {
        await pool.query(
          `UPDATE materials SET
             name=$1, category_id=$2, hsn_code=$3, uom=$4,
             min_stock=$5, max_stock=$6, reorder_level=$7, reorder_buffer=$7,
             unit_price=$8, section_context=$9, criticality_class=$10,
             procurement_strategy=$11, oem_supplier=$12, last_audit_cycle=$13,
             calibration_protocol=$14, is_active=true
           WHERE code=$15`,
          [c.name, chemCatId, c.hsn, c.uom, c.min, c.max, c.reorder,
           c.unit_price, c.section, c.criticality, c.strategy, c.oem,
           c.audit, c.calibration, c.code]
        ); upd++;
      } else {
        await pool.query(
          `INSERT INTO materials
             (code,name,category_id,hsn_code,uom,min_stock,max_stock,
              reorder_level,reorder_buffer,unit_price,current_stock,
              section_context,criticality_class,procurement_strategy,
              oem_supplier,last_audit_cycle,calibration_protocol,is_active)
           VALUES($1,$2,$3,$4,$5,$6,$7,$8,$8,$9,$6,$10,$11,$12,$13,$14,$15,true)`,
          [c.code,c.name,chemCatId,c.hsn,c.uom,c.min,c.max,c.reorder,
           c.unit_price,c.section,c.criticality,c.strategy,c.oem,
           c.audit,c.calibration]
        ); ins++;
      }
    } catch(e) { console.error(`ERR ${c.code}:`, e.message); err++; }
  }

  console.log(`Done. Inserted:${ins} Updated:${upd} Errors:${err}`);

  const { rows: s } = await pool.query(`
    SELECT COUNT(*) as cnt, SUM(current_stock*unit_price) as val
    FROM materials WHERE category_id=$1`, [chemCatId]);
  console.log(`Chemicals total: ${s[0].cnt} | Inventory value: ₹${Number(s[0].val||0).toLocaleString('en-IN')}`);

  await pool.end();
}
run().catch(e => { console.error(e); process.exit(1); });
