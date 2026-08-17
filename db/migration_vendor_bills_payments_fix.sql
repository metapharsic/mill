-- Fixes a live-DB drift discovered during P2P chain verification (2026-08-17):
-- finance.js and purchase.js already reference vendor_bills.approved_by / approved_at
-- and a vendor_payments table (finance.js:256-261 bill approve, finance.js:310-373
-- vendor payment disbursal, purchase.js:663-742 p2p-pipeline). Those columns/table exist
-- in database_backup/mk_paper_mill_full_dump.sql (an old reference dump) but were never
-- applied to the live mk_paper_mill DB — so every one of those endpoints 500s today.
BEGIN;

ALTER TABLE vendor_bills
  ADD COLUMN IF NOT EXISTS approved_by INTEGER REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP;

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

CREATE INDEX IF NOT EXISTS idx_vendor_payments_vendor ON vendor_payments(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_payments_bill ON vendor_payments(bill_id);

COMMIT;
