const pool = require('../src/db/pool');

async function check() {
  const codes = ['BE0002', 'BE0003', 'OS0047', 'OS0048', 'MSSS005', 'MSSS006', 'MSSS0005', 'GMSB0016', 'GMSB0017', 'GSSFT001', 'GSSFT002'];
  const { rows } = await pool.query(`
    SELECT id, code, name, current_stock FROM materials 
    WHERE code = ANY($1::text[]) 
       OR name ILIKE '%3309B%' 
       OR name ILIKE '%75-100-10%' 
       OR name ILIKE '%2" S.S SOCKET%' 
       OR name ILIKE '%12mmX75mm%' 
       OR name ILIKE '%1 1/4" X 400mm%'
    ORDER BY code ASC
  `, [codes]);
  console.table(rows);
  await pool.end();
}

check().catch(console.error);
