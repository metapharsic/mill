const pool = require('../src/db/pool');

async function inspect() {
  const { rows } = await pool.query(`
    SELECT id, code, name, category_id, current_stock FROM materials 
    WHERE code IN ('BE0002', 'BE0003', 'OS0047', 'OS0048', 'MSTF0002', 'MSTF0001', 'MSSS005', 'MSSS006', 'GMSB0016', 'GMSB0017', 'GSSFT001', 'GSSFT002')
       OR name ILIKE '%3210%'
       OR name ILIKE '%3309B%'
       OR name ILIKE '%75-95-10%'
       OR name ILIKE '%75-100-10%'
       OR name ILIKE '%STEAMLINE 3" FLANGES%'
       OR name ILIKE '%2" S.S SOCKET%'
       OR name ILIKE '%3/4" S.S SOCKET%'
       OR name ILIKE '%12mmX75mm%'
       OR name ILIKE '%3/8"X4"%'
       OR name ILIKE '%FULL THRED%'
    ORDER BY id ASC
  `);
  console.table(rows);
  await pool.end();
}

inspect().catch(console.error);
