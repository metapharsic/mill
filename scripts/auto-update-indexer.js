// MK Paper Mill — Automated Index & Documentation Sync Daemon
// Run via PM2: pm2 start scripts/auto-update-indexer.js --name "mk-erp-indexer"
// Periodically updates the GitNexus & CodeGraph MCP code intelligence databases every 1 hour.

const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

const INTERVAL_MS = 3600000; // 1 hour
const ROOT_DIR = path.resolve(__dirname, '..');
const LOG_FILE = path.join(ROOT_DIR, 'logs', 'indexer-update.log');

// Ensure logs directory exists
const logsDir = path.join(ROOT_DIR, 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

function log(msg) {
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] ${msg}\n`;
  console.log(msg);
  fs.appendFileSync(LOG_FILE, line, 'utf8');
}

function runIndexer() {
  log('🚀 Starting scheduled code intelligence index update...');
  const startTime = Date.now();

  // Exec run.cjs analyze from project root
  exec('node .gitnexus/run.cjs analyze', { cwd: ROOT_DIR }, (error, stdout, stderr) => {
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);

    if (error) {
      log(`❌ Indexing failed after ${duration}s: ${error.message}`);
      if (stderr) log(`Stderr: ${stderr.trim()}`);
      return;
    }

    log(`✅ Indexing completed successfully in ${duration}s.`);
    if (stdout) {
      // Log index updates count summary (nodes, edges, etc.)
      const lines = stdout.split('\n')
        .map(l => l.trim())
        .filter(l => l.includes('nodes') || l.includes('Incremental') || l.includes('indexed successfully'));
      lines.forEach(line => log(`   → ${line}`));
    }
  });
}

// Start immediately on boot
runIndexer();

// Run every 1 hour
setInterval(runIndexer, INTERVAL_MS);

log(`📶 Indexer daemon initialized. Scheduling sync every 1 hour (${INTERVAL_MS}ms).`);
