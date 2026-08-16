-- Seed the 21 Plant Sections from handwritten document
-- Maps each section to its correct department

DELETE FROM sections;

INSERT INTO sections (name, code, department_id) VALUES
  ('Pulp mill Section', 'PULPMILL', (SELECT id FROM departments WHERE code='PROD')),
  ('Centricleaner Section', 'CENTRICLEANER', (SELECT id FROM departments WHERE code='PROD')),
  ('Wire Section', 'WIRE', (SELECT id FROM departments WHERE code='PROD')),
  ('Vacuum Section', 'VACUUM', (SELECT id FROM departments WHERE code='PROD')),
  ('Press Section', 'PRESS', (SELECT id FROM departments WHERE code='PROD')),
  ('Unirun Section', 'UNIRUN', (SELECT id FROM departments WHERE code='PROD')),
  ('Pre Dryer Section', 'PRE_DRYER', (SELECT id FROM departments WHERE code='PROD')),
  ('Size Press Section', 'SIZE_PRESS', (SELECT id FROM departments WHERE code='PROD')),
  ('Size kitchen Section', 'SIZE_KITCHEN', (SELECT id FROM departments WHERE code='PROD')),
  ('Post Dryer Section', 'POST_DRYER', (SELECT id FROM departments WHERE code='PROD')),
  ('Calender Section', 'CALENDER', (SELECT id FROM departments WHERE code='PROD')),
  ('Pope Reel Section', 'POPE_REEL', (SELECT id FROM departments WHERE code='PROD')),
  ('Rewinder Section', 'REWINDER', (SELECT id FROM departments WHERE code='PROD')),
  ('Starch kitchen Section', 'STARCH_KITCHEN', (SELECT id FROM departments WHERE code='PROD')),
  ('Steam & Condensate Section', 'STEAM_COND', (SELECT id FROM departments WHERE code='PROD')),
  ('ETP Section', 'ETP', (SELECT id FROM departments WHERE code='EHS')),
  ('Boiler Section', 'BOILER', (SELECT id FROM departments WHERE code='UTIL')),
  ('Lab Section', 'LAB', (SELECT id FROM departments WHERE code='LAB')),
  ('Cranes', 'CRANES', (SELECT id FROM departments WHERE code='MAINT')),
  ('Compressors & Air Dryer', 'COMPRESSORS', (SELECT id FROM departments WHERE code='UTIL')),
  ('Store Section', 'STORE', (SELECT id FROM departments WHERE code='STORE'))
ON CONFLICT (name) DO UPDATE SET 
  code = EXCLUDED.code,
  department_id = EXCLUDED.department_id;
