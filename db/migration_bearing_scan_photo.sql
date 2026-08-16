-- Scan/photo attachment for bearing checklist rounds — one photo per round (section+shift+date), not per row
CREATE TABLE IF NOT EXISTS inspection_round_scans (
  id            SERIAL PRIMARY KEY,
  section_id    INTEGER NOT NULL REFERENCES sections(id),
  shift         VARCHAR(10),
  check_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  file_url      VARCHAR(255) NOT NULL,
  original_name VARCHAR(255),
  uploaded_by   INTEGER REFERENCES users(id),
  uploaded_at   TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_round_scans_section ON inspection_round_scans(section_id, check_date);

INSERT INTO schema_migrations (filename) VALUES ('migration_bearing_scan_photo.sql')
ON CONFLICT (filename) DO NOTHING;
