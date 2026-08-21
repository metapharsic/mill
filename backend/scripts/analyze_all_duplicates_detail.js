const pool = require('../src/db/pool');

async function analyzeAllDuplicates() {
  const client = await pool.connect();
  try {
    const { rows: dups } = await client.query(`
      WITH norm AS (
        SELECT 
          m.id, 
          m.code, 
          m.name, 
          m.category_id,
          mc.name AS category_name,
          m.uom,
          m.current_stock, 
          m.unit_price, 
          m.is_active,
          REGEXP_REPLACE(LOWER(TRIM(m.name)), '[\\s\\-_]+', '', 'g') AS clean_name,
          (SELECT COUNT(*) FROM stock_ledger sl WHERE sl.material_id = m.id) AS ledger_count,
          (SELECT COUNT(*) FROM indent_items ii WHERE ii.material_id = m.id) AS indent_count,
          (SELECT COUNT(*) FROM po_items poi WHERE poi.material_id = m.id) AS po_count,
          (SELECT COUNT(*) FROM grn_items gi WHERE gi.material_id = m.id) AS grn_count
        FROM materials m
        LEFT JOIN material_categories mc ON mc.id = m.category_id
      ),
      dup_names AS (
        SELECT clean_name, COUNT(*) AS count
        FROM norm
        GROUP BY clean_name
        HAVING COUNT(*) > 1
      )
      SELECT n.*
      FROM norm n
      JOIN dup_names d ON d.clean_name = n.clean_name
      ORDER BY n.clean_name, n.id;
    `);

    console.log('======================================================================');
    console.log('📊 DETAILED AUDIT OF ALL 13 DUPLICATE MATERIAL GROUPS');
    console.log('======================================================================\n');

    const groups = {};
    for (const d of dups) {
      if (!groups[d.clean_name]) groups[d.clean_name] = [];
      groups[d.clean_name].push(d);
    }

    let groupIdx = 1;
    for (const [cleanName, items] of Object.entries(groups)) {
      console.log(`🔷 #${groupIdx++} GROUP: "${items[0].name}" [normalized: "${cleanName}"] (${items.length} records)`);
      items.forEach(it => {
        console.log(`   ID: ${it.id.toString().padEnd(5)} | Code: ${it.code.padEnd(12)} | Category: ${it.category_name.padEnd(20)} | Stock: ${String(it.current_stock).padStart(6)} ${it.uom} | Ledger: ${it.ledger_count} | Indents: ${it.indent_count} | POs: ${it.po_count} | GRNs: ${it.grn_count}`);
      });
      console.log('----------------------------------------------------------------------');
    }

  } catch (err) {
    console.error('Analysis error:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

analyzeAllDuplicates();
