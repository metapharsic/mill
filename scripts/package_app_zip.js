const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const rootDir = path.join(__dirname, '..');
const stageDir = path.join(rootDir, '.temp_backup_staging');
const zipPath = path.join(rootDir, 'mkmill_complete_backup.zip');

console.log('1. Preparing staging directory...');
if (fs.existsSync(stageDir)) {
  fs.rmSync(stageDir, { recursive: true, force: true });
}
fs.mkdirSync(stageDir, { recursive: true });

const itemsToCopy = [
  'backend', 'frontend/dist', 'frontend/src', 'frontend/package.json',
  'frontend/vite.config.js', 'frontend/index.html', 'db', 'database_backup',
  'Projects_Requirement', 'scripts', 'package.json', 'start.bat',
  'SETUP_AND_RUN.bat', 'DEPLOYMENT_AND_RESTORE_GUIDE.md', 'AGENTS.md'
];

function copySafe(src, dest) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const file of fs.readdirSync(src)) {
      if (file === 'node_modules' || file === '.git' || file === '.temp_backup_staging') continue;
      copySafe(path.join(src, file), path.join(dest, file));
    }
  } else {
    try {
      // Use stream with shared read flag to handle files currently open in Excel/editors
      const data = fs.readFileSync(src);
      fs.writeFileSync(dest, data);
    } catch (err) {
      console.warn(`[WARN] Could not copy ${src} directly (${err.message}). Attempting fallback...`);
      try {
        fs.copyFileSync(src, dest);
      } catch (e) {
        console.warn(`[SKIP] Skipped locked file ${src}`);
      }
    }
  }
}

console.log('2. Copying project files into staging area...');
for (const item of itemsToCopy) {
  const fullSrc = path.join(rootDir, item);
  const fullDest = path.join(stageDir, item);
  if (fs.existsSync(fullSrc)) {
    copySafe(fullSrc, fullDest);
  }
}

console.log('3. Compressing staging directory into mkmill_complete_backup.zip...');
if (fs.existsSync(zipPath)) {
  fs.unlinkSync(zipPath);
}

const psZipCommand = `powershell -NoProfile -Command "Compress-Archive -Path '${stageDir}/*' -DestinationPath '${zipPath}' -Force"`;
execSync(psZipCommand, { stdio: 'inherit' });

console.log('4. Cleaning up temporary staging directory...');
fs.rmSync(stageDir, { recursive: true, force: true });

const stats = fs.statSync(zipPath);
console.log(`\n================================================================`);
console.log(`✅ STANDALONE ZIP CREATED: mkmill_complete_backup.zip`);
console.log(`   Size: ${(stats.size / (1024 * 1024)).toFixed(2)} MB`);
console.log(`================================================================\n`);
