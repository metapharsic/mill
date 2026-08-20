-- migration_section_equipment_machine_map.sql
-- Maps the remaining single-section machines (ids 6-27) into section_equipment
-- so department/section-ownership checks in maintenance.js and production.js
-- no longer fail-open for these machines. Machines 1-5 (Paper Machine 1/2,
-- Rewinder 1, Cutter 1, Test Machine XYZ) are intentionally left unmapped --
-- they are cross-section/composite or test data with no confident 1:1
-- plant_sections match (machines 1-4 already have section_equipment rows
-- from earlier migrations; machine 5 has none at all).

INSERT INTO section_equipment (section_id, machine_id, tag_name, equipment_name) VALUES
  (2,  6,  'SEC2-EQ-6',  'Pulp mill Section'),
  (3,  7,  'SEC3-EQ-7',  'Centricleaner Section'),
  (4,  8,  'SEC4-EQ-8',  'Wire Section'),
  (5,  9,  'SEC5-EQ-9',  'Vacuum Section'),
  (6,  10, 'SEC6-EQ-10', 'Press Section'),
  (7,  11, 'SEC7-EQ-11', 'Unirun Section'),
  (8,  12, 'SEC8-EQ-12', 'Pre Dryer Section'),
  (9,  13, 'SEC9-EQ-13', 'Size Press Section'),
  (10, 14, 'SEC10-EQ-14','Size kitchen Section'),
  (11, 16, 'SEC11-EQ-16','Post Dryer Section'),
  (12, 17, 'SEC12-EQ-17','Calender Section'),
  (13, 18, 'SEC13-EQ-18','Pope Reel Section'),
  (14, 19, 'SEC14-EQ-19','Rewinder Section'),
  (15, 20, 'SEC15-EQ-20','Starch kitchen Section'),
  (16, 21, 'SEC16-EQ-21','Steam & Condensate Section'),
  (17, 22, 'SEC17-EQ-22','ETP Section'),
  (18, 23, 'SEC18-EQ-23','Boiler Section'),
  (19, 24, 'SEC19-EQ-24','Lab Section'),
  (20, 25, 'SEC20-EQ-25','Cranes'),
  (21, 26, 'SEC21-EQ-26','Compressors & Air Dryer'),
  (85, 27, 'SEC85-EQ-27','Store Section');

INSERT INTO schema_migrations (filename) VALUES ('migration_section_equipment_machine_map.sql')
ON CONFLICT (filename) DO NOTHING;
