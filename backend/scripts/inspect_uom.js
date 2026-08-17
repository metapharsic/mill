const pool = require('../src/db/pool');

async function main() {
  const mCols = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name='materials' ORDER BY ordinal_position");
  console.log('--- MATERIALS COLUMNS ---');
  console.log(mCols.rows.map(r => `${r.column_name} (${r.data_type})`).join(', '));

  const iiCols = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name='indent_items' ORDER BY ordinal_position");
  console.log('\n--- INDENT_ITEMS COLUMNS ---');
  console.log(iiCols.rows.map(r => `${r.column_name} (${r.data_type})`).join(', '));

  const uomList = await pool.query("SELECT uom, count(*) FROM materials GROUP BY uom ORDER BY count(*) DESC");
  console.log('\n--- MATERIALS UOM DISTRIBUTION ---');
  console.table(uomList.rows);

  const sampleMats = await pool.query("SELECT id, name, code, uom, current_stock FROM materials LIMIT 15");
  console.log('\n--- SAMPLE MATERIALS ---');
  console.table(sampleMats.rows);

  const sampleIndItems = await pool.query(`
    SELECT ii.id, ii.indent_id, ii.material_id, m.name as mat_name, m.uom as mat_uom, ii.uom as item_uom, ii.required_qty, ii.issued_qty 
    FROM indent_items ii 
    LEFT JOIN materials m ON ii.material_id = m.id 
    ORDER BY ii.id DESC LIMIT 10
  `);
  console.log('\n--- RECENT INDENT ITEMS UOM CHECK ---');
  console.table(sampleIndItems.rows);

  await pool.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
