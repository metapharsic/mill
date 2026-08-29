require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const pool = require('../src/db/pool');

async function migrate() {
  console.log('Running Inbound Delivery Challan (DC) migration...');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Confirm vendors table exists before adding an FK to it (it does, per
    // migrate_vendor_bank_details.js, but re-verify live since this is a
    // moving repo shared with another concurrently-editing agent).
    const { rows: vendorTableRows } = await client.query(
      `SELECT to_regclass('public.vendors') AS reg`
    );
    const vendorsExists = !!vendorTableRows[0].reg;

    await client.query(`
      CREATE TABLE IF NOT EXISTS inbound_dc (
        id SERIAL PRIMARY KEY,
        dc_no TEXT,
        dc_date DATE,
        vendor_id INTEGER${vendorsExists ? ' REFERENCES vendors(id)' : ''},
        vehicle_number TEXT,
        remarks TEXT,
        -- status lifecycle: received -> invoice_matched -> grn_done (or cancelled at any point)
        status TEXT NOT NULL DEFAULT 'received',
        invoice_number TEXT,
        invoice_date DATE,
        matched_by INTEGER,
        matched_at TIMESTAMP,
        -- Added for the Store.jsx tick-mark invoice-match refinement (2026-08-29):
        -- store manager keys the party name off the paper invoice, and the
        -- invoice's stated total, for a match/mismatch check against the
        -- computed (edited rate/disc/tax) line totals.
        party_name TEXT,
        invoice_total NUMERIC(14,2),
        grn_id INTEGER,
        created_by INTEGER,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS inbound_dc_items (
        id SERIAL PRIMARY KEY,
        inbound_dc_id INTEGER REFERENCES inbound_dc(id),
        material_id INTEGER REFERENCES materials(id),
        qty NUMERIC(15,3),
        unit TEXT,
        batch_no TEXT
      );
    `);

    // Idempotent column add-ons in case a partial version of this table
    // already exists from a prior run of this same script.
    await client.query(`ALTER TABLE inbound_dc ADD COLUMN IF NOT EXISTS grn_id INTEGER;`);
    await client.query(`ALTER TABLE inbound_dc ADD COLUMN IF NOT EXISTS matched_by INTEGER;`);
    await client.query(`ALTER TABLE inbound_dc ADD COLUMN IF NOT EXISTS matched_at TIMESTAMP;`);
    await client.query(`ALTER TABLE inbound_dc ADD COLUMN IF NOT EXISTS party_name TEXT;`);
    await client.query(`ALTER TABLE inbound_dc ADD COLUMN IF NOT EXISTS invoice_total NUMERIC(14,2);`);

    await client.query('COMMIT');
    console.log('Inbound DC migration committed successfully.');
    console.log('vendors table present:', vendorsExists, '-> inbound_dc.vendor_id FK', vendorsExists ? 'created' : 'SKIPPED (no vendors table found live)');

    const { rows: cols1 } = await pool.query(
      "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'inbound_dc' ORDER BY ordinal_position"
    );
    console.log('inbound_dc columns:', cols1.map(r => r.column_name).join(', '));
    const { rows: cols2 } = await pool.query(
      "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'inbound_dc_items' ORDER BY ordinal_position"
    );
    console.log('inbound_dc_items columns:', cols2.map(r => r.column_name).join(', '));
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

migrate()
  .then(() => pool.end())
  .catch(e => {
    console.error('Inbound DC migration failed:', e);
    pool.end();
    process.exit(1);
  });
