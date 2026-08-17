const pool = require('../src/db/pool');

async function migrate() {
  const client = await pool.connect();
  try {
    console.log('Running cash_purchases DDL migration...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS cash_purchases (
        id SERIAL PRIMARY KEY,
        voucher_number VARCHAR(50) UNIQUE NOT NULL,
        date DATE NOT NULL,
        indent_id INTEGER,
        vendor_name VARCHAR(150) NOT NULL,
        vendor_gstin VARCHAR(20),
        invoice_number VARCHAR(100),
        invoice_date DATE,
        payment_mode VARCHAR(50) DEFAULT 'Cash',
        payment_ref VARCHAR(100),
        taxable_amount NUMERIC(15,2) DEFAULT 0,
        cgst_amount NUMERIC(12,2) DEFAULT 0,
        sgst_amount NUMERIC(12,2) DEFAULT 0,
        igst_amount NUMERIC(12,2) DEFAULT 0,
        total_tax NUMERIC(12,2) DEFAULT 0,
        total_amount NUMERIC(15,2) NOT NULL,
        remarks TEXT,
        created_by INTEGER,
        created_at TIMESTAMP DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS cash_purchase_items (
        id SERIAL PRIMARY KEY,
        cash_purchase_id INTEGER REFERENCES cash_purchases(id) ON DELETE CASCADE,
        material_id INTEGER,
        qty NUMERIC(12,3) NOT NULL,
        uom VARCHAR(20),
        unit_price NUMERIC(12,2) NOT NULL,
        gst_pct NUMERIC(5,2) DEFAULT 18,
        line_taxable NUMERIC(15,2) NOT NULL,
        line_total NUMERIC(15,2) NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_cash_purchases_indent_id ON cash_purchases(indent_id);
    `);
    console.log('✓ Tables cash_purchases and cash_purchase_items created successfully!');
  } catch (err) {
    console.error('Migration error:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
