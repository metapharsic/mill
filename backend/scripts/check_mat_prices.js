const pool = require('../src/db/pool');

async function check() {
  const { rows } = await pool.query(`
    SELECT m.id, m.code, m.name, m.unit_price, m.current_stock,
           (SELECT unit_price FROM po_items WHERE material_id = m.id AND unit_price > 0 ORDER BY id DESC LIMIT 1) as po_price,
           (SELECT unit_price FROM stock_ledger WHERE material_id = m.id AND unit_price > 0 ORDER BY id DESC LIMIT 1) as ledger_price
    FROM materials m
    WHERE m.unit_price = 0
      AND (
        EXISTS (SELECT 1 FROM po_items WHERE material_id = m.id AND unit_price > 0)
        OR EXISTS (SELECT 1 FROM stock_ledger WHERE material_id = m.id AND unit_price > 0)
      )
    LIMIT 10
  `);
  console.log('Materials with unit_price = 0 but have PO / ledger prices:', rows);
  process.exit(0);
}

check();
