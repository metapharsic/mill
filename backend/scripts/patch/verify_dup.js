require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { Pool } = require('pg');
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'mk_paper_mill',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'admin123',
});
async function run() {
  const client = await pool.connect();
  // Check if the oil-seal spec rows exist with proper OS codes
  const r1 = await client.query("SELECT id,code,name FROM materials WHERE name='10-22-7'");
  console.log('name=10-22-7:', JSON.stringify(r1.rows));
  const r2 = await client.query("SELECT id,code,name FROM materials WHERE code='OS0001'");
  console.log('code=OS0001:', JSON.stringify(r2.rows));
  client.release();
  await pool.end();
}
run();
