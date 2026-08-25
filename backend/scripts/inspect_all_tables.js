require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const pool = require('../src/db/pool');

async function main() {
  const { rows } = await pool.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    ORDER BY table_name
  `);
  console.log('All Public Tables (' + rows.length + ' tables):');
  console.log(rows.map(r => r.table_name).join('\n'));
  await pool.end();
}

main().catch(console.error);
