const pool = require('../src/db/pool');

async function auditDuplicates() {
  const client = await pool.connect();
  try {
    console.log('======================================================================');
    console.log('🔍 MULTI-AGENT AUDIT: 3210 -BD-XL & DUPLICATE MATERIALS INVESTIGATION');
    console.log('======================================================================\n');

    // 1. Check exact search for 3210 -BD-XL
    const { rows: item3210 } = await client.query(`
      SELECT 
        m.id, 
        m.code, 
        m.name, 
        m.uom, 
        m.current_stock, 
        m.min_stock, 
        m.unit_price, 
        m.is_active, 
        m.category_id,
        mc.name AS category_name,
        (SELECT COUNT(*) FROM stock_ledger sl WHERE sl.material_id = m.id) AS ledger_count,
        (SELECT COUNT(*) FROM indent_items ii WHERE ii.material_id = m.id) AS indent_count,
        (SELECT COUNT(*) FROM po_items poi WHERE poi.material_id = m.id) AS po_count,
        (SELECT COUNT(*) FROM grn_items gi WHERE gi.material_id = m.id) AS grn_count
      FROM materials m
      LEFT JOIN material_categories mc ON mc.id = m.category_id
      WHERE m.name ILIKE '%3210%' OR m.code ILIKE '%3210%'
      ORDER BY m.id ASC;
    `);

    console.log('📌 1. ENTRIES MATCHING "3210":');
    console.table(item3210);

    // 2. Check normalized name duplicates (ignoring spaces, dashes, case)
    const { rows: normalizedDups } = await client.query(`
      WITH normalized AS (
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
      ),
      dup_names AS (
        SELECT clean_name, COUNT(*) AS dup_count
        FROM normalized
        GROUP BY clean_name
        HAVING COUNT(*) > 1
      )
      SELECT 
        n.clean_name,
        n.id,
        n.code,
        n.name,
        mc.name AS category_name,
        n.current_stock,
        n.unit_price,
        n.is_active,
        (SELECT COUNT(*) FROM stock_ledger sl WHERE sl.material_id = n.id) AS ledger_count
      FROM normalized n
      JOIN dup_names d ON d.clean_name = n.clean_name
      LEFT JOIN material_categories mc ON mc.id = n.category_id
      ORDER BY n.clean_name, n.id;
    `);

    console.log('\n📌 2. ALL DUPLICATE MATERIAL NAMES IN DATABASE (CLEANED/NORMALIZED):');
    console.log(`Total duplicate instances found: ${normalizedDups.length}`);
    
    // Group duplicates
    const dupGroups = {};
    for (const r of normalizedDups) {
      if (!dupGroups[r.clean_name]) dupGroups[r.clean_name] = [];
      dupGroups[r.clean_name].push(r);
    }

    console.log(`Total distinct duplicate item name groups: ${Object.keys(dupGroups).length}\n`);

    for (const [cleanName, items] of Object.entries(dupGroups)) {
      console.log(`🔷 Group [${cleanName}] (${items.length} records):`);
      for (const it of items) {
        console.log(`   • ID: ${it.id.toString().padEnd(5)} | Code: ${it.code.padEnd(10)} | Name: "${it.name}" | Cat: ${(it.category_name||'N/A').padEnd(16)} | Stock: ${String(it.current_stock).padEnd(8)} | Price: ₹${it.unit_price} | Ledger rows: ${it.ledger_count}`);
      }
    }

    // 3. Exact Code Duplicates check (if any)
    const { rows: dupCodes } = await client.query(`
      SELECT code, COUNT(*) AS count
      FROM materials
      GROUP BY code
      HAVING COUNT(*) > 1;
    `);
    console.log(`\n📌 3. DUPLICATE ITEM CODES: ${dupCodes.length}`);
    if (dupCodes.length > 0) console.table(dupCodes);

  } catch (err) {
    console.error('Audit failed:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

auditDuplicates();
