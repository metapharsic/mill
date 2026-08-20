require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const pool = require('../src/db/pool');

async function migrate() {
  console.log('Running P2P database migration...');

  await pool.query(`
    CREATE TABLE IF NOT EXISTS vendor_bills (
      id SERIAL PRIMARY KEY,
      bill_number VARCHAR(64) UNIQUE NOT NULL,
      vendor_id INTEGER NOT NULL REFERENCES vendors(id),
      po_id INTEGER REFERENCES purchase_orders(id),
      grn_id INTEGER REFERENCES grn(id),
      vendor_invoice_number VARCHAR(128) NOT NULL,
      invoice_date DATE NOT NULL,
      due_date DATE,
      taxable_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
      cgst_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
      sgst_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
      igst_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
      total_tax NUMERIC(15,2) NOT NULL DEFAULT 0,
      roundoff NUMERIC(10,2) DEFAULT 0,
      total_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
      paid_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
      balance_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
      status VARCHAR(32) NOT NULL DEFAULT 'Pending Approval',
      remarks TEXT,
      created_by INTEGER REFERENCES users(id),
      approved_by INTEGER REFERENCES users(id),
      approved_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS vendor_payments (
      id SERIAL PRIMARY KEY,
      payment_number VARCHAR(64) UNIQUE NOT NULL,
      vendor_id INTEGER NOT NULL REFERENCES vendors(id),
      bill_id INTEGER REFERENCES vendor_bills(id),
      po_id INTEGER REFERENCES purchase_orders(id),
      amount NUMERIC(15,2) NOT NULL,
      payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
      payment_mode VARCHAR(64) NOT NULL,
      bank_name VARCHAR(128),
      reference_number VARCHAR(128),
      status VARCHAR(32) NOT NULL DEFAULT 'Paid',
      remarks TEXT,
      recorded_by INTEGER NOT NULL REFERENCES users(id),
      confirmed_by INTEGER REFERENCES users(id),
      confirmed_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);

  await pool.query(`CREATE INDEX IF NOT EXISTS idx_vendor_bills_vendor ON vendor_bills(vendor_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_vendor_bills_status ON vendor_bills(status)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_vendor_payments_vendor ON vendor_payments(vendor_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_vendor_payments_bill ON vendor_payments(bill_id)`);

  console.log('Migration completed successfully!');
  pool.end();
}

migrate().catch(e => {
  console.error('Migration failed:', e);
  pool.end();
  process.exit(1);
});
