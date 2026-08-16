-- PIIMAS: Extend indent system for full Issue→Ack→Close workflow
-- Run: psql -U postgres -d mk_paper_mill -f db/migration_piimas.sql

-- 1. Extend indents with new states + issuance tracking
ALTER TABLE indents
  ADD COLUMN IF NOT EXISTS section_id        INTEGER REFERENCES plant_sections(id),
  ADD COLUMN IF NOT EXISTS machine_id        INTEGER REFERENCES machines(id),
  ADD COLUMN IF NOT EXISTS total_value       NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS issued_by         INTEGER REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS issued_at         TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS closed_at         TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS escalated         BOOLEAN DEFAULT FALSE;

-- 2. Extend indent_items: machine position + acknowledgment
ALTER TABLE indent_items
  ADD COLUMN IF NOT EXISTS component_position  VARCHAR(200),
  ADD COLUMN IF NOT EXISTS section_id          INTEGER,
  ADD COLUMN IF NOT EXISTS machine_id          INTEGER,
  ADD COLUMN IF NOT EXISTS unit_price          NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS line_value          NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS issued_qty          NUMERIC(10,3) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS batch_no            VARCHAR(100),
  ADD COLUMN IF NOT EXISTS reason_code         VARCHAR(50),
  ADD COLUMN IF NOT EXISTS ack_by              INTEGER REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS ack_at              TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS fitment_date        DATE,
  ADD COLUMN IF NOT EXISTS observations        TEXT,
  ADD COLUMN IF NOT EXISTS kpi_before          VARCHAR(100),
  ADD COLUMN IF NOT EXISTS kpi_after           VARCHAR(100),
  ADD COLUMN IF NOT EXISTS photo_url           VARCHAR(500),
  ADD COLUMN IF NOT EXISTS ack_status          VARCHAR(20) DEFAULT 'pending';

-- 3. Indent comments table (already exists check)
CREATE TABLE IF NOT EXISTS indent_audit_log (
  id           SERIAL PRIMARY KEY,
  indent_id    INTEGER NOT NULL REFERENCES indents(id),
  action       VARCHAR(50) NOT NULL,
  old_status   VARCHAR(50),
  new_status   VARCHAR(50),
  user_id      INTEGER REFERENCES users(id),
  remarks      TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Index for fast queries
CREATE INDEX IF NOT EXISTS idx_indents_status    ON indents(status);
CREATE INDEX IF NOT EXISTS idx_indents_dept      ON indents(department_id);
CREATE INDEX IF NOT EXISTS idx_indents_date      ON indents(date);
CREATE INDEX IF NOT EXISTS idx_indent_items_ack  ON indent_items(ack_status);
