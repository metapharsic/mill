const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const zipPath = path.join(__dirname, '../mkmill_complete_backup.zip');
if (fs.existsSync(zipPath)) {
  fs.unlinkSync(zipPath);
}

const candidates = [
  'backend', 'frontend/dist', 'frontend/src', 'frontend/package.json',
  'frontend/vite.config.js', 'frontend/index.html', 'db', 'database_backup',
  'Projects_Requirement', 'scripts', 'package.json', 'start.bat',
  'SETUP_AND_RUN.bat', 'DEPLOYMENT_AND_RESTORE_GUIDE.md', 'AGENTS.md'
];

const existingPaths = candidates
  .filter(p => fs.existsSync(path.join(__dirname, '..', p)))
  .map(p => `'${p}'`)
  .join(', ');

console.log('Archiving existing MK Mill project assets...');
const psCommand = `powershell -NoProfile -Command "Compress-Archive -Path ${existingPaths} -DestinationPath 'mkmill_complete_backup.zip' -Force"`;
execSync(psCommand, { stdio: 'inherit' });

const stats = fs.statSync(zipPath);
console.log(`✅ mkmill_complete_backup.zip updated successfully: ${(stats.size / (1024 * 1024)).toFixed(2)} MB`);
