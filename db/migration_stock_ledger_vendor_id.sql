-- Add vendor_id to stock_ledger so direct/Fast-Inward entries (which don't
-- go through the grn/grn_items tables) can be linked to a real vendor row
-- and picked up by GET /api/store/reports/vendor-wise. Nullable — historical
-- rows have no vendor_id and are intentionally left untouched (no fuzzy
-- backfill from the free-text remarks/vendor-name field).
ALTER TABLE stock_ledger ADD COLUMN IF NOT EXISTS vendor_id INTEGER REFERENCES vendors(id);
CREATE INDEX IF NOT EXISTS idx_stock_ledger_vendor ON stock_ledger(vendor_id);
