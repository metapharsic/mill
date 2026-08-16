-- ============================================================
-- Migration: Production Lifecycle Enhancements (Ph24)
-- Machine speed targets for OEE performance and chemical limit alert logging
-- ============================================================

ALTER TABLE machines 
  ADD COLUMN IF NOT EXISTS design_speed_mpm NUMERIC(8,2) DEFAULT 300.00;

CREATE TABLE IF NOT EXISTS chemical_limit_alerts (
  id             SERIAL PRIMARY KEY,
  alert_date     DATE NOT NULL,
  chemical_id    INTEGER REFERENCES materials(id),
  actual_ratio   NUMERIC(10,3),
  standard_ratio NUMERIC(10,3),
  status         VARCHAR(20) DEFAULT 'Active',
  created_at     TIMESTAMPTZ DEFAULT NOW()
);
