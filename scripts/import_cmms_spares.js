/**
 * Import 2000-row CMMS Spares Ledger into materials table.
 * Run: node scripts/import_cmms_spares.js
 */
const path = require('path');
// Resolve deps from backend node_modules
const backendModules = path.join(__dirname, '../backend/node_modules');
const { Pool } = require(path.join(backendModules, 'pg'));
const xlsx = require(path.join(backendModules, 'xlsx'));
require(path.join(backendModules, 'dotenv')).config({ path: path.join(__dirname, '../backend/.env') });

const pool = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME     || 'mk_paper_mill',
  user:     process.env.DB_USER     || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

const FILE = path.join(__dirname, '../Documentation/Metapharsic_Master_2000_Item_CMMS_Ledger.xlsx');
const SHEET = '2000 Spares Master Ledger';

async function run() {
  const wb = xlsx.readFile(FILE);
  const ws = wb.Sheets[SHEET];
  const rows = xlsx.utils.sheet_to_json(ws, { defval: '' });

  console.log(`Loaded ${rows.length} rows from Excel`);

  // Fetch category map: name → id
  const { rows: cats } = await pool.query('SELECT id, name FROM material_categories');
  const catMap = {};
  cats.forEach(c => { catMap[c.name.trim()] = c.id; });

  let inserted = 0, updated = 0, errors = 0;

  for (const row of rows) {
    const code             = String(row['Material SKU Code'] || '').trim();
    const name             = String(row['Part Name & Complete Technical / Metallurgical Specifications'] || '').trim();
    const sectionContext   = String(row['Section / Machine Context'] || '').trim();
    const componentGroup   = String(row['Asset Component Group'] || '').trim();
    const hsnCode          = String(row['HSN Code'] || '').trim();
    const minStock         = parseFloat(row['Min Stock Level (Safety)']) || 0;
    const maxStock         = parseFloat(row['Max Stock Level (Cap)']) || 0;
    const reorderBuffer    = parseFloat(row['Reorder Dynamic Buffer']) || 0;
    const criticalityClass = String(row['Criticality Class'] || '').trim().toUpperCase();
    const procStrategy     = String(row['Procurement Sourcing Strategy'] || '').trim();
    const oemSupplier      = String(row['Primary OEM / Authorized Sourcing Partner'] || '').trim();
    const lastAudit        = String(row['Last Operational Audit Cycle'] || '').trim();
    const calibProtocol    = String(row['Dynamic Calibration Protocol'] || '').trim();
    const unitCost         = parseFloat(row['Unit Cost (INR Base)']) || 0;

    if (!code) continue;

    const categoryId = catMap[componentGroup] || null;

    try {
      const { rows: existing } = await pool.query(
        'SELECT id FROM materials WHERE code = $1', [code]
      );

      if (existing.length > 0) {
        await pool.query(
          `UPDATE materials SET
             name                = $1,
             category_id         = $2,
             hsn_code            = $3,
             min_stock           = $4,
             max_stock           = $5,
             reorder_level       = $6,
             reorder_buffer      = $7,
             unit_price          = $8,
             uom                 = COALESCE(NULLIF(uom,''), 'Nos'),
             section_context     = $9,
             criticality_class   = $10,
             procurement_strategy= $11,
             oem_supplier        = $12,
             last_audit_cycle    = $13,
             calibration_protocol= $14,
             is_active           = true
           WHERE code = $15`,
          [name, categoryId, hsnCode, minStock, maxStock, reorderBuffer,
           reorderBuffer, unitCost, sectionContext,
           criticalityClass || null, procStrategy, oemSupplier,
           lastAudit, calibProtocol, code]
        );
        updated++;
      } else {
        await pool.query(
          `INSERT INTO materials
             (code, name, category_id, hsn_code, uom,
              min_stock, max_stock, reorder_level, reorder_buffer, unit_price,
              current_stock, section_context, criticality_class,
              procurement_strategy, oem_supplier, last_audit_cycle,
              calibration_protocol, is_active)
           VALUES ($1,$2,$3,$4,'Nos',$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,true)`,
          [code, name, categoryId, hsnCode,
           minStock, maxStock, reorderBuffer, reorderBuffer, unitCost,
           minStock,  // seed current_stock = min_stock as opening stock
           sectionContext, criticalityClass || null,
           procStrategy, oemSupplier, lastAudit, calibProtocol]
        );
        inserted++;
      }
    } catch (e) {
      console.error(`ERROR row ${code}:`, e.message);
      errors++;
    }
  }

  console.log(`\nDone. Inserted: ${inserted} | Updated: ${updated} | Errors: ${errors}`);

  // Summary by criticality
  const { rows: summary } = await pool.query(`
    SELECT criticality_class, COUNT(*) as count, SUM(unit_price * current_stock) as total_value
    FROM materials WHERE criticality_class IS NOT NULL
    GROUP BY criticality_class ORDER BY criticality_class
  `);
  console.log('\nCriticality Summary:');
  summary.forEach(r => console.log(`  ${r.criticality_class}: ${r.count} items | Stock Value: ₹${parseFloat(r.total_value||0).toLocaleString('en-IN')}`));

  await pool.end();
}

run().catch(e => { console.error(e); process.exit(1); });
