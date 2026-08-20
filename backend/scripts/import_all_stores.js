// Reusable wrapper delegating to import_all_stores_8152026.js
const { runAll } = require('./import_all_stores_8152026');

if (require.main === module) {
  runAll()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('Import failed:', err);
      process.exit(1);
    });
}

module.exports = { runAll };
