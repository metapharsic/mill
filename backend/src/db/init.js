const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'mk_paper_mill',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

async function init() {
  console.log('Initializing MK Paper Mill database...');
  const schema = fs.readFileSync(path.join(__dirname, '../../../db/schema.sql'), 'utf8');
  await pool.query(schema);
  console.log('Schema created.');

  // Set real admin password
  const hash = await bcrypt.hash('Admin@1234', 10);
  await pool.query(
    `UPDATE users SET password_hash = $1 WHERE email = 'admin@mkpapermill.com'`,
    [hash]
  );
  console.log('Admin password set to: Admin@1234');

  // Seed sample machines
  await pool.query(`
    INSERT INTO machines (name, code, type, capacity_tpd) VALUES
      ('Paper Machine 1', 'PM1', 'Paper Machine', 50),
      ('Paper Machine 2', 'PM2', 'Paper Machine', 60),
      ('Rewinder 1', 'RW1', 'Rewinder', 100),
      ('Cutter 1', 'CT1', 'Cutter', 80)
    ON CONFLICT (code) DO NOTHING
  `);

  // Seed sample grades
  await pool.query(`
    INSERT INTO grades (name, code, gsm_min, gsm_max) VALUES
      ('Kraft Paper', 'KP', 70, 200),
      ('Writing Paper', 'WP', 60, 90),
      ('Newsprint', 'NP', 45, 52),
      ('Board', 'BRD', 200, 400),
      ('Tissue', 'TIS', 15, 35)
    ON CONFLICT (code) DO NOTHING
  `);

  console.log('Seed data inserted.');
  await pool.end();
  console.log('Done.');
}

init().catch((err) => {
  console.error('Init failed:', err.message);
  process.exit(1);
});
