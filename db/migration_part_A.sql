-- ============================================================
-- PART A: UPDATE existing items (wrong current_stock in DB)
-- Total: 51 UPDATE statements
-- ============================================================

-- A1: Bearings (28 items)
UPDATE materials SET current_stock=5 WHERE code='BE0003';
UPDATE materials SET current_stock=10 WHERE code='BE0007';
UPDATE materials SET current_stock=2 WHERE code='BE0008';
UPDATE materials SET current_stock=2 WHERE code='BE0011';
UPDATE materials SET current_stock=6 WHERE code='BE0014';
UPDATE materials SET current_stock=0 WHERE code='BE0015';
UPDATE materials SET current_stock=4 WHERE code='BE0016';
UPDATE materials SET current_stock=4 WHERE code='BE0017';
UPDATE materials SET current_stock=7 WHERE code='BE0018';
UPDATE materials SET current_stock=2 WHERE code='BE0021';
UPDATE materials SET current_stock=13 WHERE code='BE0022';
UPDATE materials SET current_stock=0 WHERE code='BE0023';
UPDATE materials SET current_stock=6 WHERE code='BE0024';
UPDATE materials SET current_stock=10 WHERE code='BE0032';
UPDATE materials SET current_stock=6 WHERE code='BE0034';
UPDATE materials SET current_stock=4 WHERE code='BE0036';
UPDATE materials SET current_stock=2 WHERE code='BE0037';
UPDATE materials SET current_stock=3 WHERE code='BE0038';
UPDATE materials SET current_stock=1 WHERE code='BE0064';
UPDATE materials SET current_stock=1 WHERE code='BE0085';
UPDATE materials SET current_stock=1 WHERE code='BE0095';
UPDATE materials SET current_stock=1 WHERE code='BE0096';
UPDATE materials SET current_stock=10 WHERE code='BE0106';
UPDATE materials SET current_stock=0 WHERE code='BE0118';
UPDATE materials SET current_stock=1 WHERE code='BE0133';
UPDATE materials SET current_stock=1 WHERE code='BE0144';
UPDATE materials SET current_stock=3 WHERE code='BE0168';
UPDATE materials SET current_stock=10 WHERE code='BE0170';

-- A2: Oil Seals (11 items)
UPDATE materials SET current_stock=5 WHERE code='OS0020';
UPDATE materials SET current_stock=0 WHERE code='OS0021';
UPDATE materials SET current_stock=9 WHERE code='OS0022';
UPDATE materials SET current_stock=7 WHERE code='OS0024';
UPDATE materials SET current_stock=3 WHERE code='OS0031';
UPDATE materials SET current_stock=10 WHERE code='OS0034';
UPDATE materials SET current_stock=11 WHERE code='OS0037';
UPDATE materials SET current_stock=12 WHERE code='OS0057';
UPDATE materials SET current_stock=2 WHERE code='OS0064';
UPDATE materials SET current_stock=1 WHERE code='OS0072';
UPDATE materials SET current_stock=1 WHERE code='OS0077';

-- A3: Pump Sleeves (8 items)
UPDATE materials SET current_stock=1 WHERE code='MPS0007';
UPDATE materials SET current_stock=10 WHERE code='MPS0010';
UPDATE materials SET current_stock=3 WHERE code='MPS0012';
UPDATE materials SET current_stock=2 WHERE code='MPS0014';
UPDATE materials SET current_stock=3 WHERE code='MPS0016';
UPDATE materials SET current_stock=3 WHERE code='MPS0020';
UPDATE materials SET current_stock=2 WHERE code='MPS0024';
UPDATE materials SET current_stock=6 WHERE code='MPS0027';

-- A4: Clothing (4 items)
UPDATE materials SET current_stock=1 WHERE code='TW0001';
UPDATE materials SET current_stock=1 WHERE code='BW0001';
UPDATE materials SET current_stock=2 WHERE code='PF0003';
UPDATE materials SET current_stock=1 WHERE code='URG001';
