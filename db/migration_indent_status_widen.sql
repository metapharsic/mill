-- Widen indents.status CHECK constraint to include statuses the app actually
-- writes at runtime (Approved, Issued, Closed) alongside the tiered approval
-- labels (L1/L2/L3 Approved). Without this, indent.js approve/issue/close
-- routes throw a check-constraint violation on every call.
ALTER TABLE indents DROP CONSTRAINT IF EXISTS indents_status_check;
ALTER TABLE indents ADD CONSTRAINT indents_status_check
  CHECK (status IN ('Draft','Submitted','L1 Approved','L2 Approved','L3 Approved','Approved','PO Created','Issued','Closed','Rejected','Cancelled'));
