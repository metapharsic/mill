-- Migration: Add 'Partially Issued' to indents_status_check
ALTER TABLE indents DROP CONSTRAINT IF EXISTS indents_status_check;

ALTER TABLE indents ADD CONSTRAINT indents_status_check
  CHECK (((status)::text = ANY ((ARRAY[
    'Draft'::character varying,
    'Submitted'::character varying,
    'L1 Approved'::character varying,
    'L2 Approved'::character varying,
    'L3 Approved'::character varying,
    'Approved'::character varying,
    'PO Created'::character varying,
    'Partially Issued'::character varying,
    'Issued'::character varying,
    'Closed'::character varying,
    'Rejected'::character varying,
    'Cancelled'::character varying
  ])::text[])));
