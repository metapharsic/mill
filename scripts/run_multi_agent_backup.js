#!/usr/bin/env node
/**
 * MK PAPER MILL ERP — MULTI-AGENT BACKUP & REPORTING RUNNER
 * 
 * Target Directory: C:\Users\MKKANTA\MK_Mill\Backup_Database
 * Executes the MultiAgentBackupOrchestrator to generate:
 * 1. Full PostgreSQL SQL Dump (schema + data)
 * 2. Formatted Multi-Sheet Excel Reports (Inventory, Procurement, Movements, Finance, Operations)
 * 3. Cryptographic SHA-256 Manifest & Verification Logs
 */

const path = require('path');

// Ensure environment variables are loaded
try {
  require('dotenv').config({ path: path.join(__dirname, '../backend/.env') });
} catch {
  try {
    require(path.join(__dirname, '../backend/node_modules/dotenv')).config({ path: path.join(__dirname, '../backend/.env') });
  } catch (_) {}
}

const { MultiAgentBackupOrchestrator } = require('../backend/src/services/multiAgentBackupEngine');

async function main() {
  const orchestrator = new MultiAgentBackupOrchestrator();
  try {
    const result = await orchestrator.run();
    if (result.success) {
      console.log(`🎉 [SUCCESS] Backup completed successfully at ${result.targetDir}`);
      process.exit(0);
    } else {
      console.error(`❌ [FAILED] Backup encountered issues.`);
      process.exit(1);
    }
  } catch (err) {
    console.error(`💥 [FATAL] Multi-agent backup execution error:`, err);
    process.exit(1);
  }
}

main();
