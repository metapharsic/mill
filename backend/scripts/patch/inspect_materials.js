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

  // Look at numeric-sequence names (possible bearing codes)
  const r1 = await client.query(
    "SELECT id, code, name, category_id FROM materials WHERE name ~ '^[0-9]+[\\-\\.][0-9]' ORDER BY name LIMIT 30"
  );
  console.log('\n=== Numeric-sequence names (sample) ===');
  r1.rows.forEach(x => console.log(JSON.stringify(x)));

  // Look at pure integer names
  const r2 = await client.query(
    "SELECT id, code, name, category_id FROM materials WHERE name ~ '^[0-9]+$' ORDER BY name LIMIT 30"
  );
  console.log('\n=== Pure integer names (sample) ===');
  r2.rows.forEach(x => console.log(JSON.stringify(x)));

  // Category breakdown of junk rows
  const r3 = await client.query(`
    SELECT c.name as category, COUNT(*) as junk_count
    FROM materials m
    LEFT JOIN material_categories c ON m.category_id = c.id
    WHERE m.name ~ '^[0-9]'
    GROUP BY c.name ORDER BY junk_count DESC
  `);
  console.log('\n=== Category breakdown of numeric-name rows ===');
  r3.rows.forEach(x => console.log(JSON.stringify(x)));

  client.release();
  await pool.end();
}
run().catch(e => { console.error(e.message); process.exit(1); });
