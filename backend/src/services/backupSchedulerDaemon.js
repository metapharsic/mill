/**
 * MK PAPER MILL ERP — DAILY 9:00 PM BACKUP SCHEDULER DAEMON
 * 
 * Runs continuously inside the Node.js backend.
 * Automatically triggers the Multi-Agent Backup Engine daily at 21:00:00 (9:00 PM IST).
 */

const { MultiAgentBackupOrchestrator } = require('./multiAgentBackupEngine');

let timerHandle = null;
let isRunning = false;
let nextScheduledDate = null;
let lastExecutionResult = null;

/**
 * Calculates milliseconds remaining until next 21:00:00 (9:00 PM)
 */
function getMsUntilNext9PM() {
  const now = new Date();
  const next9PM = new Date();
  next9PM.setHours(21, 0, 0, 0); // 9:00:00.000 PM

  // If 9:00 PM has already passed today, target tomorrow's 9:00 PM
  if (now.getTime() >= next9PM.getTime()) {
    next9PM.setDate(next9PM.getDate() + 1);
  }

  nextScheduledDate = next9PM;
  return next9PM.getTime() - now.getTime();
}

async function triggerDailyBackup() {
  if (isRunning) {
    console.log('[BACKUP SCHEDULER] ⚠️ Backup is already in progress, skipping duplicate trigger.');
    return;
  }

  isRunning = true;
  console.log('\n' + '🔔'.repeat(40));
  console.log(`[BACKUP SCHEDULER] ⏰ 9:00 PM DAILY TRIGGER FIRED — STARTING MULTI-AGENT BACKUP`);
  console.log('🔔'.repeat(40) + '\n');

  try {
    const orchestrator = new MultiAgentBackupOrchestrator();
    lastExecutionResult = await orchestrator.run();
    console.log(`[BACKUP SCHEDULER] ✅ Daily backup completed successfully at ${lastExecutionResult.targetDir}`);
  } catch (err) {
    console.error(`[BACKUP SCHEDULER] ❌ Error executing scheduled backup:`, err);
    lastExecutionResult = { success: false, error: err.message, timestamp: new Date().toISOString() };
  } finally {
    isRunning = false;
    // Schedule next run for 24 hours later
    scheduleNextRun();
  }
}

function scheduleNextRun() {
  const ms = getMsUntilNext9PM();
  const hours = (ms / (1000 * 60 * 60)).toFixed(2);
  console.log(`[BACKUP SCHEDULER] ⏰ Next daily backup scheduled for: ${nextScheduledDate.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} (in ${hours} hours)`);

  if (timerHandle) clearTimeout(timerHandle);
  timerHandle = setTimeout(() => {
    triggerDailyBackup();
  }, ms);
  
  if (timerHandle.unref) timerHandle.unref();
}

function startBackupScheduler() {
  console.log('[BACKUP SCHEDULER] 🚀 Initializing Daily 9:00 PM Multi-Agent Backup Scheduler Daemon...');
  scheduleNextRun();
}

function stopBackupScheduler() {
  if (timerHandle) {
    clearTimeout(timerHandle);
    timerHandle = null;
    console.log('[BACKUP SCHEDULER] 🛑 Backup scheduler daemon stopped.');
  }
}

function getSchedulerStatus() {
  return {
    daemonActive: timerHandle !== null,
    inProgress: isRunning,
    nextScheduledRun: nextScheduledDate ? nextScheduledDate.toISOString() : null,
    nextScheduledFormatted: nextScheduledDate ? nextScheduledDate.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : null,
    lastExecutionResult
  };
}

module.exports = {
  startBackupScheduler,
  stopBackupScheduler,
  triggerDailyBackup,
  getSchedulerStatus
};
