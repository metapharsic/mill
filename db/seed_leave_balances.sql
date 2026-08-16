-- ============================================================
-- Seed leave balances for ALL existing active employees
-- Run ONCE after migration_hrms_ph16.sql
-- Safe to re-run: ON CONFLICT DO NOTHING
-- Usage: psql -U postgres -d mk_paper_mill -f db/seed_leave_balances.sql
-- ============================================================

DO $$
DECLARE
  v_year   INTEGER := EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER;
  v_emp_id INTEGER;
  v_lt_id  INTEGER;
  v_quota  NUMERIC;
  v_doj    DATE;
  v_months_served NUMERIC;
  v_credited NUMERIC;
BEGIN
  FOR v_emp_id, v_doj IN
    SELECT id, doj FROM employees WHERE is_active = true
  LOOP
    FOR v_lt_id, v_quota IN
      SELECT id, annual_quota FROM employee_leave_types
      WHERE is_active = true AND annual_quota IS NOT NULL AND code NOT IN ('LOP','HL','CO')
    LOOP
      -- Pro-rate EL by months served in this year if DOJ is current year
      v_months_served := 12;
      IF v_doj IS NOT NULL AND EXTRACT(YEAR FROM v_doj) = v_year THEN
        v_months_served := 12 - EXTRACT(MONTH FROM v_doj)::NUMERIC + 1;
      END IF;
      v_credited := ROUND((v_quota * v_months_served / 12)::NUMERIC, 2);

      INSERT INTO employee_leave_balances
        (employee_id, leave_type_id, year, opening_balance, credited, availed)
      VALUES
        (v_emp_id, v_lt_id, v_year, 0, v_credited, 0)
      ON CONFLICT (employee_id, leave_type_id, year) DO NOTHING;
    END LOOP;
  END LOOP;

  RAISE NOTICE 'Leave balances seeded for year %', v_year;
END $$;

-- Verify
SELECT
  e.name,
  lt.code,
  lb.year,
  lb.credited,
  lb.closing_balance
FROM employee_leave_balances lb
JOIN employees e ON e.id = lb.employee_id
JOIN employee_leave_types lt ON lt.id = lb.leave_type_id
ORDER BY e.name, lt.code
LIMIT 50;
