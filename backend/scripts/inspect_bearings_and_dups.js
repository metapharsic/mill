const pool = require('../src/db/pool');

async function inspectBearings() {
  const client = await pool.connect();
  try {
    const { rows } = await client.query(`
      SELECT 
        m.id, 
        m.code, 
        m.name, 
        m.uom, 
        m.current_stock, 
        m.unit_price, 
        m.category_id,
        mc.name AS category_name
      FROM materials m
      LEFT JOIN material_categories mc ON mc.id = m.category_id
      WHERE m.code IN ('BE0002', 'BE0002-B', 'BE0097') 
         OR m.name ILIKE '%3210%' 
         OR m.name ILIKE '%BD-XL%'
         OR m.name ILIKE '%3309%'
      ORDER BY m.code, m.id;
    `);

    console.log('📌 EXACT BEARING & 3210 / BD-XL / 3309 RECORDS IN DB:');
    console.table(rows);

    // Let's also check all items in the database that have duplicates
    const { rows: allDups } = await client.query(`
      WITH norm AS (
        SELECT 
          id, 
          code, 
          name, 
          category_id,
          current_stock,
          unit_price,
          is_active,
          REGEXP_REPLACE(LOWER(TRIM(name)), '[\\s\\-_]+', '', 'g') AS clean_name
        FROM materials
      )
      SELECT 
        clean_name,
        COUNT(*) as count,
        array_agg(code) as codes,
        array_agg(name) as names,
        array_agg(current_stock) as stocks,
        array_agg(id) as ids
      FROM norm
      GROUP BY clean_name
      HAVING COUNT(*) > 1
      ORDER BY count DESC, clean_name;
    `);

    console.log(`\n📌 ALL DUPLICATE ITEMS IN DB (TOTAL: ${allDups.length} GROUPS):`);
    console.table(allDups.map(d => ({
      clean_name: d.clean_name,
      count: d.count,
      codes: d.codes.join(', '),
      names: d.names.join(' | '),
      stocks: d.stocks.join(', '),
      ids: d.ids.join(', ')
    })));

  } catch (err) {
    console.error('Inspect error:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

inspectBearings();
