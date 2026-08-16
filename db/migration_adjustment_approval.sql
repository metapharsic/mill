-- Doc31 #20: full 2-step approval workflow for stock adjustments (was single-person level4 direct write)
CREATE TABLE IF NOT EXISTS adjustment_requests (
  id            SERIAL PRIMARY KEY,
  material_id   INTEGER NOT NULL REFERENCES materials(id),
  qty           NUMERIC(12,3) NOT NULL,
  reason        TEXT NOT NULL,
  bin_location  VARCHAR(30),
  batch_number  VARCHAR(50),
  status        VARCHAR(20) NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending','Approved','Rejected')),
  requested_by  INTEGER NOT NULL REFERENCES users(id),
  approved_by   INTEGER REFERENCES users(id),
  approved_at   TIMESTAMP,
  created_at    TIMESTAMP DEFAULT NOW()
);

-- Doc31 #22: track who deleted, so restore can require a different person than the delete actor
ALTER TABLE machines   ADD COLUMN IF NOT EXISTS deleted_by INTEGER REFERENCES users(id);
ALTER TABLE grades     ADD COLUMN IF NOT EXISTS deleted_by INTEGER REFERENCES users(id);
ALTER TABLE materials  ADD COLUMN IF NOT EXISTS deleted_by INTEGER REFERENCES users(id);
ALTER TABLE vendors    ADD COLUMN IF NOT EXISTS deleted_by INTEGER REFERENCES users(id);
ALTER TABLE customers  ADD COLUMN IF NOT EXISTS deleted_by INTEGER REFERENCES users(id);

INSERT INTO schema_migrations (filename) VALUES ('migration_adjustment_approval.sql')
ON CONFLICT (filename) DO NOTHING;
