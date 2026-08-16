const pool = require('../src/db/pool');
const bcrypt = require('bcryptjs');

async function main() {
  const hashStore = await bcrypt.hash('Store@1234', 10);
  const hashAdmin = await bcrypt.hash('Admin@1234', 10);
  const hashPlant = await bcrypt.hash('Plant@1234', 10);
  const hashHead = await bcrypt.hash('Head@1234', 10);

  const res1 = await pool.query('UPDATE users SET password_hash = $1 WHERE email = $2', [hashStore, 'store@mkpapermill.com']);
  console.log('store@mkpapermill.com updated (Store@1234):', res1.rowCount);

  const res2 = await pool.query('UPDATE users SET password_hash = $1 WHERE email = $2', [hashAdmin, 'admin@mkpapermill.com']);
  console.log('admin@mkpapermill.com updated (Admin@1234):', res2.rowCount);

  const res3 = await pool.query('UPDATE users SET password_hash = $1 WHERE email = $2', [hashPlant, 'planthead@mkpapermill.com']);
  console.log('planthead@mkpapermill.com updated (Plant@1234):', res3.rowCount);

  const res4 = await pool.query("UPDATE users SET password_hash = $1 WHERE email LIKE 'head.%'", [hashHead]);
  console.log("head.*@mkpapermill.com updated (Head@1234):", res4.rowCount);

  console.log('All default passwords have been reset successfully!');
  await pool.end();
}

main().catch(err => {
  console.error('Error resetting passwords:', err);
  pool.end();
  process.exit(1);
});
