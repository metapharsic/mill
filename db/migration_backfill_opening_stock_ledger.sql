-- Backfill missing opening-stock stock_ledger rows.
-- Root cause: bulk-seeded materials.current_stock had no corresponding stock_ledger
-- history (806 of 811 stocked materials had zero ledger rows), so inward
-- reports/dashboards showed almost nothing despite the store being full of stock.
-- This inserts one 'opening_stock' row per affected material so the ledger
-- reflects the real on-hand quantity, dated at the material's created_at.

INSERT INTO stock_ledger (material_id, date, transaction_type, in_qty, out_qty, balance, unit_price, value, reference_type, remarks, created_at)
SELECT
  m.id,
  COALESCE(m.created_at::date, CURRENT_DATE),
  'in', -- uses the already-whitelisted 'in' type so every existing inward query/report picks these up without code changes
  m.current_stock,
  0,
  m.current_stock,
  m.unit_price,
  m.current_stock * COALESCE(m.unit_price, 0),
  'Opening Balance',
  'Backfilled opening stock — data migration',
  now()
FROM materials m
WHERE m.current_stock > 0
  AND NOT EXISTS (SELECT 1 FROM stock_ledger sl WHERE sl.material_id = m.id);

INSERT INTO schema_migrations (filename, applied_at)
VALUES ('migration_backfill_opening_stock_ledger.sql', now())
ON CONFLICT DO NOTHING;
