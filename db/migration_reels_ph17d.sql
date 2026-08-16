-- Migration: Ph17-D Reels Schema updates
-- Adds bf, deckle and reject_reason columns to reels table

ALTER TABLE reels
  ADD COLUMN IF NOT EXISTS bf INTEGER,
  ADD COLUMN IF NOT EXISTS deckle NUMERIC(8,2),
  ADD COLUMN IF NOT EXISTS reject_reason TEXT;
