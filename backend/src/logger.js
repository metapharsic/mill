const fs = require('fs');
const path = require('path');

const LOG_DIR = path.join(__dirname, '../../logs');
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

function appendLine(file, line) {
  fs.appendFile(path.join(LOG_DIR, file), line + '\n', () => {});
}

function logBackendError(context, err) {
  const line = `[${new Date().toISOString()}] ${context} :: ${err?.stack || err?.message || err}`;
  appendLine('backend-error.log', line);
}

function logDbError(context, err) {
  const line = `[${new Date().toISOString()}] ${context} :: ${err?.stack || err?.message || err}`;
  appendLine('db-error.log', line);
}

function logFrontendError(entry) {
  const line = `[${new Date().toISOString()}] [${entry.userAgent || 'unknown-ua'}] [${entry.url || 'unknown-url'}] ${entry.message}${entry.stack ? '\n' + entry.stack : ''}`;
  appendLine('frontend-error.log', line);
}

module.exports = { logBackendError, logDbError, logFrontendError, LOG_DIR };
