-- M7: Approval matrix table for value-based indent approval tiers
-- Thresholds: Tier1 <₹10k (L1 only), Tier2 ₹10k-₹1L (L1+L2 dept head), Tier3 >₹1L (L1+L2+L3 plant head)

CREATE TABLE IF NOT EXISTS approval_matrix (
  id              SERIAL PRIMARY KEY,
  tier            INT           NOT NULL,
  label           VARCHAR(30)   NOT NULL,
  min_value       NUMERIC(14,2) NOT NULL DEFAULT 0,
  max_value       NUMERIC(14,2),
  required_level  INT           NOT NULL,
  description     TEXT
);

INSERT INTO approval_matrix (tier, label, min_value, max_value, required_level, description) VALUES
  (1, 'Small',  0,       10000,  2, 'Under Rs 10,000 — L1 supervisor only'),
  (2, 'Medium', 10000,   100000, 3, 'Rs 10k to Rs 1L — L1 + dept head (L2)'),
  (3, 'Large',  100000,  NULL,   4, 'Above Rs 1L — L1 + dept head + plant head (L3)')
ON CONFLICT DO NOTHING;

INSERT INTO schema_migrations (filename) VALUES ('migration_approval_matrix.sql')
ON CONFLICT (filename) DO NOTHING;
