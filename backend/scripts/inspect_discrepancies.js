const pool = require('../src/db/pool');

async function inspect() {
  console.log('--- NEGATIVE STOCK MATERIALS ---');
  const { rows: negRows } = await pool.query(`
    SELECT id, code, name, current_stock, unit_price, is_active FROM materials WHERE current_stock < 0
  `);
  console.table(negRows);

  console.log('\n--- INACTIVE MATERIALS WITH STOCK/VALUATION ---');
  const { rows: inactRows } = await pool.query(`
    SELECT id, code, name, current_stock, unit_price, (current_stock * unit_price) as val, is_active 
    FROM materials 
    WHERE is_active = false AND (current_stock > 0 OR unit_price > 0)
  `);
  console.table(inactRows);

  await pool.end();
}

inspect().catch(console.error);
