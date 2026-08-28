-- Migration: Widen indents_status_check constraint to include all runtime fulfillment modes
-- (DC Generated, Cash Purchased, PO Created, Issued, Closed, etc.)
ALTER TABLE indents DROP CONSTRAINT IF EXISTS indents_status_check;

ALTER TABLE indents ADD CONSTRAINT indents_status_check
  CHECK (status IN (
    'Draft',
    'Submitted',
    'L1 Approved',
    'L2 Approved',
    'L3 Approved',
    'Approved',
    'PO Created',
    'DC Generated',
    'Cash Purchased',
    'Partially Issued',
    'Issued',
    'Closed',
    'Rejected',
    'Cancelled'
  ));
