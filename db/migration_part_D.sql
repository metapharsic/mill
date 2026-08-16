BEGIN;

-- D: STATIONERY ITEM (32 items — STA codes)
INSERT INTO materials (code,name,category_id,uom,hsn_code,current_stock,unit_price,reorder_level,is_active,created_at) VALUES ('STA001','REGISTRES 100 PAGE',33,'Nos',NULL,18,0,0,true,NOW()) ON CONFLICT (code) DO NOTHING;
INSERT INTO materials (code,name,category_id,uom,hsn_code,current_stock,unit_price,reorder_level,is_active,created_at) VALUES ('STA002','REGISTRES 200 PAGE',33,'Nos',NULL,0,0,0,true,NOW()) ON CONFLICT (code) DO NOTHING;
INSERT INTO materials (code,name,category_id,uom,hsn_code,current_stock,unit_price,reorder_level,is_active,created_at) VALUES ('STA003','REGISTRES NO 6',33,'Nos',NULL,0,0,0,true,NOW()) ON CONFLICT (code) DO NOTHING;
INSERT INTO materials (code,name,category_id,uom,hsn_code,current_stock,unit_price,reorder_level,is_active,created_at) VALUES ('STA004','REGISTRES NO 6',33,'Nos',NULL,0,0,0,true,NOW()) ON CONFLICT (code) DO NOTHING;
INSERT INTO materials (code,name,category_id,uom,hsn_code,current_stock,unit_price,reorder_level,is_active,created_at) VALUES ('STA005','BIG BOX FILES',33,'Nos',NULL,0,0,0,true,NOW()) ON CONFLICT (code) DO NOTHING;
INSERT INTO materials (code,name,category_id,uom,hsn_code,current_stock,unit_price,reorder_level,is_active,created_at) VALUES ('STA006','SMALL BOX FILE',33,'Nos',NULL,0,0,0,true,NOW()) ON CONFLICT (code) DO NOTHING;
INSERT INTO materials (code,name,category_id,uom,hsn_code,current_stock,unit_price,reorder_level,is_active,created_at) VALUES ('STA007','SPRING FILES',33,'Nos',NULL,0,0,0,true,NOW()) ON CONFLICT (code) DO NOTHING;
INSERT INTO materials (code,name,category_id,uom,hsn_code,current_stock,unit_price,reorder_level,is_active,created_at) VALUES ('STA008','L FOLDERS',33,'Nos',NULL,0,0,0,true,NOW()) ON CONFLICT (code) DO NOTHING;
INSERT INTO materials (code,name,category_id,uom,hsn_code,current_stock,unit_price,reorder_level,is_active,created_at) VALUES ('STA009','A4 COVER FOLDERS',33,'Nos',NULL,0,0,0,true,NOW()) ON CONFLICT (code) DO NOTHING;
INSERT INTO materials (code,name,category_id,uom,hsn_code,current_stock,unit_price,reorder_level,is_active,created_at) VALUES ('STA010','BLUE PENS',33,'Nos',NULL,0,0,0,true,NOW()) ON CONFLICT (code) DO NOTHING;
INSERT INTO materials (code,name,category_id,uom,hsn_code,current_stock,unit_price,reorder_level,is_active,created_at) VALUES ('STA011','BLACK PENS',33,'Nos',NULL,0,0,0,true,NOW()) ON CONFLICT (code) DO NOTHING;
INSERT INTO materials (code,name,category_id,uom,hsn_code,current_stock,unit_price,reorder_level,is_active,created_at) VALUES ('STA012','RED PENS',33,'Nos',NULL,0,0,0,true,NOW()) ON CONFLICT (code) DO NOTHING;
INSERT INTO materials (code,name,category_id,uom,hsn_code,current_stock,unit_price,reorder_level,is_active,created_at) VALUES ('STA013','BLUE MARKER',33,'Nos',NULL,0,0,0,true,NOW()) ON CONFLICT (code) DO NOTHING;
INSERT INTO materials (code,name,category_id,uom,hsn_code,current_stock,unit_price,reorder_level,is_active,created_at) VALUES ('STA014','BLACK MARKER',33,'Nos',NULL,0,0,0,true,NOW()) ON CONFLICT (code) DO NOTHING;
INSERT INTO materials (code,name,category_id,uom,hsn_code,current_stock,unit_price,reorder_level,is_active,created_at) VALUES ('STA015','RED MARKER',33,'Nos',NULL,0,0,0,true,NOW()) ON CONFLICT (code) DO NOTHING;
INSERT INTO materials (code,name,category_id,uom,hsn_code,current_stock,unit_price,reorder_level,is_active,created_at) VALUES ('STA016','BLUE PEN MARKER',33,'Nos',NULL,0,0,0,true,NOW()) ON CONFLICT (code) DO NOTHING;
INSERT INTO materials (code,name,category_id,uom,hsn_code,current_stock,unit_price,reorder_level,is_active,created_at) VALUES ('STA017','BLACK PEN MARKER',33,'Nos',NULL,0,0,0,true,NOW()) ON CONFLICT (code) DO NOTHING;
INSERT INTO materials (code,name,category_id,uom,hsn_code,current_stock,unit_price,reorder_level,is_active,created_at) VALUES ('STA018','RED PEN MARKER',33,'Nos',NULL,0,0,0,true,NOW()) ON CONFLICT (code) DO NOTHING;
INSERT INTO materials (code,name,category_id,uom,hsn_code,current_stock,unit_price,reorder_level,is_active,created_at) VALUES ('STA019','GEM CLIPS',33,'Nos',NULL,0,0,0,true,NOW()) ON CONFLICT (code) DO NOTHING;
INSERT INTO materials (code,name,category_id,uom,hsn_code,current_stock,unit_price,reorder_level,is_active,created_at) VALUES ('STA020','BALL NIDELS',33,'Nos',NULL,0,0,0,true,NOW()) ON CONFLICT (code) DO NOTHING;
INSERT INTO materials (code,name,category_id,uom,hsn_code,current_stock,unit_price,reorder_level,is_active,created_at) VALUES ('STA021','STAPELER NO10',33,'Nos',NULL,0,0,0,true,NOW()) ON CONFLICT (code) DO NOTHING;
INSERT INTO materials (code,name,category_id,uom,hsn_code,current_stock,unit_price,reorder_level,is_active,created_at) VALUES ('STA022','STAPELER PINS BOX',33,'Nos',NULL,0,0,0,true,NOW()) ON CONFLICT (code) DO NOTHING;
INSERT INTO materials (code,name,category_id,uom,hsn_code,current_stock,unit_price,reorder_level,is_active,created_at) VALUES ('STA023','HOLE PUNCHING MEHINE BIG',33,'Nos',NULL,0,0,0,true,NOW()) ON CONFLICT (code) DO NOTHING;
INSERT INTO materials (code,name,category_id,uom,hsn_code,current_stock,unit_price,reorder_level,is_active,created_at) VALUES ('STA024','HOLE PUNCHING MEHINE SMALL',33,'Nos',NULL,0,0,0,true,NOW()) ON CONFLICT (code) DO NOTHING;
INSERT INTO materials (code,name,category_id,uom,hsn_code,current_stock,unit_price,reorder_level,is_active,created_at) VALUES ('STA025','AA BATTERY',33,'Nos',NULL,0,0,0,true,NOW()) ON CONFLICT (code) DO NOTHING;
INSERT INTO materials (code,name,category_id,uom,hsn_code,current_stock,unit_price,reorder_level,is_active,created_at) VALUES ('STA026','AAA BATTERY',33,'Nos',NULL,0,0,0,true,NOW()) ON CONFLICT (code) DO NOTHING;
INSERT INTO materials (code,name,category_id,uom,hsn_code,current_stock,unit_price,reorder_level,is_active,created_at) VALUES ('STA027','9 VOLT BATTERY',33,'Nos',NULL,0,0,0,true,NOW()) ON CONFLICT (code) DO NOTHING;
INSERT INTO materials (code,name,category_id,uom,hsn_code,current_stock,unit_price,reorder_level,is_active,created_at) VALUES ('STA028','BINDER CKIPS 41 MM',33,'Nos',NULL,0,0,0,true,NOW()) ON CONFLICT (code) DO NOTHING;
INSERT INTO materials (code,name,category_id,uom,hsn_code,current_stock,unit_price,reorder_level,is_active,created_at) VALUES ('STA029','BINDER CKIPS 51 MM',33,'Nos',NULL,0,0,0,true,NOW()) ON CONFLICT (code) DO NOTHING;
INSERT INTO materials (code,name,category_id,uom,hsn_code,current_stock,unit_price,reorder_level,is_active,created_at) VALUES ('STA030','CALCULATER CASIO',33,'Nos',NULL,0,0,0,true,NOW()) ON CONFLICT (code) DO NOTHING;
INSERT INTO materials (code,name,category_id,uom,hsn_code,current_stock,unit_price,reorder_level,is_active,created_at) VALUES ('STA031','A4 PAPER BUNDELS',33,'Nos',NULL,0,0,0,true,NOW()) ON CONFLICT (code) DO NOTHING;
INSERT INTO materials (code,name,category_id,uom,hsn_code,current_stock,unit_price,reorder_level,is_active,created_at) VALUES ('STA032','A4 CLOTH COVERS',33,'Nos',NULL,0,0,0,true,NOW()) ON CONFLICT (code) DO NOTHING;

-- D count: 32
COMMIT;