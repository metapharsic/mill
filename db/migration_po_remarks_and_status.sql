-- Migration: Add line remarks to po_items and widen purchase_orders_status_check
ALTER TABLE po_items ADD COLUMN IF NOT EXISTS remarks TEXT;

ALTER TABLE purchase_orders DROP CONSTRAINT IF EXISTS purchase_orders_status_check;

ALTER TABLE purchase_orders ADD CONSTRAINT purchase_orders_status_check
  CHECK (status IN (
    'Draft',
    'Submitted',
    'Approved',
    'Sent',
    'Partial',
    'Received',
    'Closed',
    'Cancelled',
    'Rejected'
  ));
