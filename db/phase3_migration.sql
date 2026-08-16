-- Phase 3 Production MES — Migration
-- Run this against mk_paper_mill database to add missing columns
-- Safe to run multiple times (uses IF NOT EXISTS / DO BLOCK)

-- 1. Add ideal_speed_mpm to machines (needed for OEE Performance calculation)
ALTER TABLE machines ADD COLUMN IF NOT EXISTS ideal_speed_mpm NUMERIC(8,2) DEFAULT 0;

-- 2. Add status to shifts (Open / Closed)
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'Open'
  CHECK (status IN ('Open', 'Closed'));

-- 3. Widen shift_type check to include General shift
ALTER TABLE shifts DROP CONSTRAINT IF EXISTS shifts_shift_type_check;
ALTER TABLE shifts ADD CONSTRAINT shifts_shift_type_check
  CHECK (shift_type IN ('Day', 'Night', 'General'));

-- 4. Make shifts.end_time nullable (shift may still be open)
ALTER TABLE shifts ALTER COLUMN end_time DROP NOT NULL;

-- 5. Add code column to machines if missing (used in reel number generation)
ALTER TABLE machines ADD COLUMN IF NOT EXISTS code VARCHAR(20);

-- Verify
SELECT 'Migration complete — Phase 3' AS result;
