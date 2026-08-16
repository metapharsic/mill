-- Migration: Add reason_code_id to downtime_entries
ALTER TABLE downtime_entries
  ADD COLUMN IF NOT EXISTS reason_code_id INTEGER REFERENCES downtime_reason_codes(id);
