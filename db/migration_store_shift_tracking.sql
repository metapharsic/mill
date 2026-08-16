-- Store manager inward/outward: shift tracking + high-txn flag on stock_ledger.
ALTER TABLE stock_ledger
  ADD COLUMN IF NOT EXISTS shift VARCHAR(10) CHECK (shift IN ('Day','Night')),
  ADD COLUMN IF NOT EXISTS is_high_txn BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_stock_ledger_shift ON stock_ledger(shift, date);

INSERT INTO schema_migrations (filename) VALUES ('migration_store_shift_tracking.sql')
ON CONFLICT (filename) DO NOTHING;
