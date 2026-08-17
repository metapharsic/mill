-- Links store consumption to the maintenance job that consumed it, so
-- "cost per machine/section" can be computed from real indent_items.line_value
-- instead of the always-NULL maintenance_logs.cost column.
--
-- Design: indent_items already carries machine_id per line (component_position
-- level granularity), and a single maintenance job commonly draws spares
-- across multiple indents (raised at different times as parts are found to be
-- needed) and an indent can carry lines for jobs other than the one it was
-- originally raised for. Attaching the link at the indent_items grain (rather
-- than a whole indent, or a separate join table) is therefore both the
-- minimal and the most correct option: each spare line optionally says which
-- maintenance job it was consumed for, cost rolls up with a plain SUM/JOIN,
-- and nothing prevents one indent from supplying two different jobs.
ALTER TABLE indent_items
  ADD COLUMN IF NOT EXISTS maintenance_log_id INTEGER REFERENCES maintenance_logs(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_indent_items_maintenance_log ON indent_items(maintenance_log_id) WHERE maintenance_log_id IS NOT NULL;
