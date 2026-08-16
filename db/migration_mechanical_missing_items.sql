-- 16 items from Projects_Requirement/MECHANICAL STORE AUGUST-2026.xlsx (Compressor, Pulley,
-- one Nozzle) that were never provisioned in `materials` at all — confirmed via exact + fuzzy
-- code match, genuinely absent, not a formatting mismatch. Stock starts at 0 (no real GRN
-- history exists for these; using the excel snapshot value would be dishonest).
INSERT INTO materials (code, name, category_id, uom, current_stock, is_active) VALUES
('COM0001','OIL FILTER CPB-40',53,'Nos',0,true),
('COM0002','AIR FILTER CPB-40',53,'Nos',0,true),
('COM0003','VALVE REGULATOR CPB-40',53,'Nos',0,true),
('COM0004','ASSEMBLE CPB-60',53,'Nos',0,true),
('COM0005','SOLENOID VALVE CPB-60',53,'Nos',0,true),
('COM0006','AIR FILTER CPB-7',53,'Nos',0,true),
('COM0007','OIL SEPRATOR CPB-7',53,'Nos',0,true),
('COM0008','OIL FILTER CPB-7',53,'Nos',0,true),
('COM0009','ELEMENT CPB-7',53,'Nos',0,true),
('PULL0001','TLP 200X3C/2517 FENNER',54,'Nos',0,true),
('PULL0002','TLP 200X4C/3020 FENNER',54,'Nos',0,true),
('PULL0003','TLP 375X7C/4040 FENNER',54,'Nos',0,true),
('PULL0004','TLP 375X5C/3535 FENNER',54,'Nos',0,true),
('PULL0005','TLP 425X5C/4040 FENNER',54,'Nos',0,true),
('PULL0006','TLP 900X4C/ FENNER',54,'Nos',0,true),
('MNO006','NOZZLE IN CERAMIC (BIG THREADED) L 80MM X CL 60MM X HOLE 14MM',51,'Nos',0,true)
ON CONFLICT (code) DO NOTHING;

-- Second batch: 10 more genuinely-absent items found on a follow-up pass (Bearing, Valve,
-- Bolts & Nuts/Washers sheets) — same reasoning, same fill pattern.
INSERT INTO materials (code, name, category_id, uom, current_stock, is_active) VALUES
('BE0174','UJ CROSS (49 X 155) 4018',39,'Nos',0,true),
('BE0175','UJ CROSS (47 X 134)',39,'Nos',0,true),
('BE0176','UJ CROSS (72 X 185)',39,'Nos',0,true),
('BE0177','UJ CROSS (74 X 244)',39,'Nos',0,true),
('BE0178','UJ CROSS (57 X 152) 4113A OLD',39,'Nos',0,true),
('MV0044','200NB STOP VALVE PISTON TYPE',46,'Nos',0,true),
('GHTBN0005','3/8 X 2 HT BOLT and NUT, SPRING WASHER',55,'Nos',0,true),
('GSSAB0010','5/16 X 25 MM SS ALLEN BOLT',55,'Nos',0,true),
('GSSBN0024','10 X 40 MM SS BOLT and LOCK NUT, WASHER',55,'Nos',0,true),
('GSSBN0025','12 X 65 MM SS BOLT and LOCK NUT, WASHER',55,'Nos',0,true)
ON CONFLICT (code) DO NOTHING;
