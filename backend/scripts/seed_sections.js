require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'mk_paper_mill',
  password: process.env.DB_PASSWORD || 'postgres',
  port: parseInt(process.env.DB_PORT || '5432'),
});

const SECTIONS = [
  { name: 'Pulp mill Section', type: 'Pulper' },
  { name: 'Centricleaner Section', type: 'Paper Machine' },
  { name: 'Wire Section', type: 'Paper Machine' },
  { name: 'Vacuum Section', type: 'Paper Machine' },
  { name: 'Press Section', type: 'Paper Machine' },
  { name: 'Unirun Section', type: 'Paper Machine' },
  { name: 'Pre Dryer Section', type: 'Paper Machine' },
  { name: 'Size Press Section', type: 'Paper Machine' },
  { name: 'Size kitchen Section', type: 'Paper Machine' },
  { name: 'Post Dryer Section', type: 'Paper Machine' },
  { name: 'Calender Section', type: 'Paper Machine' },
  { name: 'Pope Reel Section', type: 'Paper Machine' },
  { name: 'Rewinder Section', type: 'Rewinder' },
  { name: 'Starch kitchen Section', type: 'Paper Machine' },
  { name: 'Steam & Condensate Section', type: 'Paper Machine' },
  { name: 'ETP Section', type: 'ETP' },
  { name: 'Boiler Section', type: 'Boiler' },
  { name: 'Lab Section', type: 'Other' },
  { name: 'Cranes', type: 'Other' },
  { name: 'Compressors & Air Dryer', type: 'Compressor' },
  { name: 'Store Section', type: 'Other' }
];

async function run() {
  let counter = 1;
  for (const sec of SECTIONS) {
    let code = sec.name.split(' ').map(w => w[0]).join('').toUpperCase().substring(0,3);
    code = `${code}${counter++}`; // guarantee unique code
    
    try {
      const res = await pool.query('SELECT id FROM machines WHERE name = $1', [sec.name]);
      if (res.rows.length === 0) {
        console.log('Inserting Machine:', sec.name);
        await pool.query(
          'INSERT INTO machines (name, code, type, capacity_tpd, ideal_speed_mpm, is_active) VALUES ($1, $2, $3, $4, $5, $6)',
          [sec.name, code, sec.type, 100, 300, true]
        );
      }
      
      const secRes = await pool.query('SELECT id FROM sections WHERE name = $1', [sec.name]);
      if (secRes.rows.length === 0) {
        console.log('Inserting Section:', sec.name);
        await pool.query('INSERT INTO sections (name, code) VALUES ($1, $2)', [sec.name, code]);
      }
    } catch(e) {
      console.error('Error on', sec.name, e.message);
    }
  }
  console.log('Done');
  process.exit(0);
}

run().catch(console.error);
