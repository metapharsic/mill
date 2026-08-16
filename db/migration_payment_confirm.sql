-- Doc31 #6: payment maker-checker — second person must confirm before payment counts as final
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending','Confirmed')),
  ADD COLUMN IF NOT EXISTS confirmed_by INTEGER REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMP;

INSERT INTO schema_migrations (filename) VALUES ('migration_payment_confirm.sql')
ON CONFLICT (filename) DO NOTHING;
