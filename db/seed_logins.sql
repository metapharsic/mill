-- M6: Seed department head logins + Plant Head + Store desk
-- Passwords: Head@1234 / Plant@1234 / Store@1234
-- All accounts get must_change_password=true — change on first login
-- Run via: node scripts/migrate.js  (this file is a migration, runs once)

-- Plant Head (L4, org-wide, dept=Administration id=16)
INSERT INTO users (employee_code, name, email, mobile, password_hash, role_id, department_id, must_change_password)
VALUES ('PH-001','Plant Head','planthead@mkpapermill.com','9000000099',
  '$2a$10$Xgd5o8ygCKfK0Xvzr.iKyex1cJAAA/5dQQmuuwAYAyx44ImUCvxsu',4,16,true)
ON CONFLICT (email) DO NOTHING;

-- 20 Department Heads (L3 Manager)
-- password_hash = bcrypt('Head@1234', 10)
INSERT INTO users (employee_code, name, email, mobile, password_hash, role_id, department_id, must_change_password) VALUES
  ('DH-PROD',  'Head - Production',           'head.prod@mkpapermill.com',   '9000000001','$2a$10$WO7xwAXQ3SLsYbJsollGKOM7mh5wvT9hJlEbG.dRV7G5DLHM2Ucp2',3,1, true),
  ('DH-RMS',   'Head - Raw Material Store',   'head.rms@mkpapermill.com',    '9000000002','$2a$10$WO7xwAXQ3SLsYbJsollGKOM7mh5wvT9hJlEbG.dRV7G5DLHM2Ucp2',3,2, true),
  ('DH-INV',   'Head - Inventory',            'head.inv@mkpapermill.com',    '9000000003','$2a$10$WO7xwAXQ3SLsYbJsollGKOM7mh5wvT9hJlEbG.dRV7G5DLHM2Ucp2',3,3, true),
  ('DH-STORE', 'Head - Store Management',     'head.store@mkpapermill.com',  '9000000004','$2a$10$WO7xwAXQ3SLsYbJsollGKOM7mh5wvT9hJlEbG.dRV7G5DLHM2Ucp2',3,4, true),
  ('DH-INDENT','Head - Indent Management',    'head.indent@mkpapermill.com', '9000000005','$2a$10$WO7xwAXQ3SLsYbJsollGKOM7mh5wvT9hJlEbG.dRV7G5DLHM2Ucp2',3,5, true),
  ('DH-PUR',   'Head - Purchase',             'head.pur@mkpapermill.com',    '9000000006','$2a$10$WO7xwAXQ3SLsYbJsollGKOM7mh5wvT9hJlEbG.dRV7G5DLHM2Ucp2',3,6, true),
  ('DH-QC',    'Head - Quality',              'head.qc@mkpapermill.com',     '9000000007','$2a$10$WO7xwAXQ3SLsYbJsollGKOM7mh5wvT9hJlEbG.dRV7G5DLHM2Ucp2',3,7, true),
  ('DH-MAINT', 'Head - Maintenance',          'head.maint@mkpapermill.com',  '9000000008','$2a$10$WO7xwAXQ3SLsYbJsollGKOM7mh5wvT9hJlEbG.dRV7G5DLHM2Ucp2',3,8, true),
  ('DH-UTIL',  'Head - Utility',              'head.util@mkpapermill.com',   '9000000009','$2a$10$WO7xwAXQ3SLsYbJsollGKOM7mh5wvT9hJlEbG.dRV7G5DLHM2Ucp2',3,9, true),
  ('DH-DISP',  'Head - Dispatch',             'head.disp@mkpapermill.com',   '9000000010','$2a$10$WO7xwAXQ3SLsYbJsollGKOM7mh5wvT9hJlEbG.dRV7G5DLHM2Ucp2',3,10,true),
  ('DH-SALES', 'Head - Sales',                'head.sales@mkpapermill.com',  '9000000011','$2a$10$WO7xwAXQ3SLsYbJsollGKOM7mh5wvT9hJlEbG.dRV7G5DLHM2Ucp2',3,11,true),
  ('DH-HR',    'Head - HR & Payroll',         'head.hr@mkpapermill.com',     '9000000012','$2a$10$WO7xwAXQ3SLsYbJsollGKOM7mh5wvT9hJlEbG.dRV7G5DLHM2Ucp2',3,12,true),
  ('DH-SEC',   'Head - Security',             'head.sec@mkpapermill.com',    '9000000013','$2a$10$WO7xwAXQ3SLsYbJsollGKOM7mh5wvT9hJlEbG.dRV7G5DLHM2Ucp2',3,13,true),
  ('DH-LAB',   'Head - Laboratory',           'head.lab@mkpapermill.com',    '9000000014','$2a$10$WO7xwAXQ3SLsYbJsollGKOM7mh5wvT9hJlEbG.dRV7G5DLHM2Ucp2',3,14,true),
  ('DH-FIN',   'Head - Finance',              'head.fin@mkpapermill.com',    '9000000015','$2a$10$WO7xwAXQ3SLsYbJsollGKOM7mh5wvT9hJlEbG.dRV7G5DLHM2Ucp2',3,15,true),
  ('DH-ADMIN', 'Head - Administration',       'head.admin@mkpapermill.com',  '9000000016','$2a$10$WO7xwAXQ3SLsYbJsollGKOM7mh5wvT9hJlEbG.dRV7G5DLHM2Ucp2',3,16,true),
  ('DH-EHS',   'Head - EHS',                  'head.ehs@mkpapermill.com',    '9000000017','$2a$10$WO7xwAXQ3SLsYbJsollGKOM7mh5wvT9hJlEbG.dRV7G5DLHM2Ucp2',3,17,true),
  ('DH-SCRAP', 'Head - Scrap Management',     'head.scrap@mkpapermill.com',  '9000000018','$2a$10$WO7xwAXQ3SLsYbJsollGKOM7mh5wvT9hJlEbG.dRV7G5DLHM2Ucp2',3,18,true),
  ('DH-PACK',  'Head - Packing',              'head.pack@mkpapermill.com',   '9000000019','$2a$10$WO7xwAXQ3SLsYbJsollGKOM7mh5wvT9hJlEbG.dRV7G5DLHM2Ucp2',3,19,true),
  ('DH-FGW',   'Head - Finished Goods WH',    'head.fgw@mkpapermill.com',    '9000000020','$2a$10$WO7xwAXQ3SLsYbJsollGKOM7mh5wvT9hJlEbG.dRV7G5DLHM2Ucp2',3,20,true)
ON CONFLICT (email) DO NOTHING;

-- Store Issue Desk (L2 Supervisor, Store dept)
-- password_hash = bcrypt('Store@1234', 10)
INSERT INTO users (employee_code, name, email, mobile, password_hash, role_id, department_id, must_change_password)
VALUES ('STORE-DESK','Store Issue Desk','store@mkpapermill.com','9000000004',
  '$2a$10$Xjz/lecSrKuNuVDmax/K..4uEMrDBqFxz/9XJCY/fAFRK0fbVGSOS',2,4,true)
ON CONFLICT (email) DO NOTHING;
