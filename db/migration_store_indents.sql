-- M5: Store Indent workflow (Indent → Permission → Issue → Progress)
-- store_indents: one row per indent raised by a department
CREATE TABLE IF NOT EXISTS store_indents (
  id             SERIAL PRIMARY KEY,
  indent_number  VARCHAR(30) UNIQUE,
  indent_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  department_id  INTEGER REFERENCES departments(id),
  material_id    INTEGER REFERENCES materials(id),
  qty_requested  NUMERIC(12,3) NOT NULL,
  qty_issued     NUMERIC(12,3) DEFAULT 0,
  unit           VARCHAR(20),
  purpose        TEXT,
  priority       VARCHAR(20) DEFAULT 'Normal',
  status         VARCHAR(20) DEFAULT 'Requested',
  requested_by   INTEGER REFERENCES users(id),
  approved_by    INTEGER REFERENCES users(id),
  approved_at    TIMESTAMP,
  issued_by      INTEGER REFERENCES users(id),
  issued_at      TIMESTAMP,
  closed_by      INTEGER REFERENCES users(id),
  closed_at      TIMESTAMP,
  reject_reason  TEXT,
  remarks        TEXT,
  created_at     TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_store_indents_status ON store_indents(status);
CREATE INDEX IF NOT EXISTS idx_store_indents_dept   ON store_indents(department_id);
CREATE INDEX IF NOT EXISTS idx_store_indents_date   ON store_indents(indent_date);

-- store_indent_log: one row per state transition — the admin progress feed
CREATE TABLE IF NOT EXISTS store_indent_log (
  id          SERIAL PRIMARY KEY,
  indent_id   INTEGER REFERENCES store_indents(id) ON DELETE CASCADE,
  action      VARCHAR(30),
  from_status VARCHAR(20),
  to_status   VARCHAR(20),
  actor_id    INTEGER REFERENCES users(id),
  actor_name  VARCHAR(100),
  actor_role  VARCHAR(50),
  qty         NUMERIC(12,3),
  note        TEXT,
  created_at  TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_indent_log_indent  ON store_indent_log(indent_id);
CREATE INDEX IF NOT EXISTS idx_indent_log_created ON store_indent_log(created_at);
