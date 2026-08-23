require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const pool = require('../src/db/pool');

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    console.log('🚀 [DB-MIGRATION-AGENT] Starting PO & GRN Schema Migration...');

    // 1. po_items columns
    await client.query(`
      ALTER TABLE po_items
        ADD COLUMN IF NOT EXISTS discount_pct numeric(5,2) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS discount_amount numeric(15,2) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS other_charges numeric(15,2) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS taxable_amount numeric(15,2) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS tax_type character varying(20) DEFAULT 'intra',
        ADD COLUMN IF NOT EXISTS cgst_pct numeric(5,2) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS sgst_pct numeric(5,2) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS igst_pct numeric(5,2) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS cgst_amount numeric(15,2) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS sgst_amount numeric(15,2) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS igst_amount numeric(15,2) DEFAULT 0;
    `);
    console.log('✅ po_items columns updated');

    // 2. purchase_orders columns
    await client.query(`
      ALTER TABLE purchase_orders
        ADD COLUMN IF NOT EXISTS tax_type character varying(20) DEFAULT 'intra',
        ADD COLUMN IF NOT EXISTS discount_value numeric(15,2) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS other_charges numeric(15,2) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS cgst_value numeric(15,2) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS sgst_value numeric(15,2) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS igst_value numeric(15,2) DEFAULT 0;
    `);
    console.log('✅ purchase_orders columns updated');

    // 3. grn_items columns
    await client.query(`
      ALTER TABLE grn_items
        ADD COLUMN IF NOT EXISTS discount_pct numeric(5,2) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS discount_amount numeric(15,2) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS other_charges numeric(15,2) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS taxable_amount numeric(15,2) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS gst_pct numeric(5,2) DEFAULT 18,
        ADD COLUMN IF NOT EXISTS tax_type character varying(20) DEFAULT 'intra',
        ADD COLUMN IF NOT EXISTS cgst_pct numeric(5,2) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS sgst_pct numeric(5,2) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS igst_pct numeric(5,2) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS cgst_amount numeric(15,2) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS sgst_amount numeric(15,2) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS igst_amount numeric(15,2) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS total_amount numeric(15,2) DEFAULT 0;
    `);
    console.log('✅ grn_items columns updated');

    // 4. grn table columns
    await client.query(`
      ALTER TABLE grn
        ADD COLUMN IF NOT EXISTS tax_type character varying(20) DEFAULT 'intra',
        ADD COLUMN IF NOT EXISTS total_value numeric(15,2) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS discount_value numeric(15,2) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS other_charges numeric(15,2) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS cgst_value numeric(15,2) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS sgst_value numeric(15,2) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS igst_value numeric(15,2) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS gst_value numeric(15,2) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS grand_total numeric(15,2) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS updated_at timestamp without time zone DEFAULT now();
    `);
    console.log('✅ grn columns updated');

    // 5. Backfill historical records for consistent numeric defaults
    await client.query(`
      UPDATE po_items
      SET discount_pct = COALESCE(discount_pct, 0),
          discount_amount = COALESCE(discount_amount, 0),
          other_charges = COALESCE(other_charges, 0),
          taxable_amount = COALESCE(taxable_amount, (COALESCE(qty,0) * COALESCE(unit_price,0))),
          tax_type = COALESCE(tax_type, 'intra'),
          cgst_pct = CASE WHEN tax_type = 'inter' THEN 0 ELSE COALESCE(gst_pct, 18) / 2 END,
          sgst_pct = CASE WHEN tax_type = 'inter' THEN 0 ELSE COALESCE(gst_pct, 18) / 2 END,
          igst_pct = CASE WHEN tax_type = 'inter' THEN COALESCE(gst_pct, 18) ELSE 0 END,
          cgst_amount = CASE WHEN tax_type = 'inter' THEN 0 ELSE (COALESCE(qty,0) * COALESCE(unit_price,0)) * (COALESCE(gst_pct, 18) / 200) END,
          sgst_amount = CASE WHEN tax_type = 'inter' THEN 0 ELSE (COALESCE(qty,0) * COALESCE(unit_price,0)) * (COALESCE(gst_pct, 18) / 200) END,
          igst_amount = CASE WHEN tax_type = 'inter' THEN (COALESCE(qty,0) * COALESCE(unit_price,0)) * (COALESCE(gst_pct, 18) / 100) ELSE 0 END
      WHERE taxable_amount IS NULL OR taxable_amount = 0;
    `);

    await client.query(`
      UPDATE grn_items
      SET discount_pct = COALESCE(discount_pct, 0),
          discount_amount = COALESCE(discount_amount, 0),
          other_charges = COALESCE(other_charges, 0),
          taxable_amount = COALESCE(taxable_amount, (COALESCE(accepted_qty, received_qty, 0) * COALESCE(unit_price,0))),
          gst_pct = COALESCE(gst_pct, 18),
          tax_type = COALESCE(tax_type, 'intra'),
          total_amount = COALESCE(total_amount, (COALESCE(accepted_qty, received_qty, 0) * COALESCE(unit_price,0)) * 1.18)
      WHERE taxable_amount IS NULL OR taxable_amount = 0;
    `);

    await client.query('COMMIT');
    console.log('🎉 [DB-MIGRATION-AGENT] Migration completed successfully!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ [DB-MIGRATION-AGENT] Migration failed:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
