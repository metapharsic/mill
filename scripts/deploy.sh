#!/usr/bin/env bash
# VPS deploy/update script — run as: bash scripts/deploy.sh
# First run: clones repo + installs everything
# Subsequent runs: git pull + rebuild + restart
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/mkerp}"
REPO_URL="${REPO_URL:-}"   # set in env or edit here: REPO_URL=git@github.com:ORG/REPO.git
NODE_ENV=production

# ── helpers ──────────────────────────────────────────────────────────────────
log()  { echo "[DEPLOY] $*"; }
die()  { echo "[DEPLOY][ERR] $*" >&2; exit 1; }

# ── pre-checks ───────────────────────────────────────────────────────────────
command -v node  >/dev/null || die "node not found"
command -v npm   >/dev/null || die "npm not found"
command -v pm2   >/dev/null || die "pm2 not found — run: npm install -g pm2"
command -v nginx >/dev/null || die "nginx not found"

node_major=$(node -e "process.stdout.write(process.versions.node.split('.')[0])")
[ "$node_major" -ge 18 ] || die "Node >=18 required (got $(node -v))"

# ── clone or pull ─────────────────────────────────────────────────────────────
if [ ! -d "$APP_DIR/.git" ]; then
  [ -z "$REPO_URL" ] && die "REPO_URL not set. export REPO_URL=git@github.com:ORG/REPO.git"
  log "Cloning repo to $APP_DIR..."
  git clone "$REPO_URL" "$APP_DIR"
else
  log "Pulling latest..."
  git -C "$APP_DIR" pull --ff-only
fi

cd "$APP_DIR"

# ── install backend deps ──────────────────────────────────────────────────────
log "Installing backend dependencies..."
npm ci --prefix backend --omit=dev

# ── build frontend ────────────────────────────────────────────────────────────
log "Building frontend..."
npm ci --prefix frontend
npm run build --prefix frontend

# ── create runtime dirs ──────────────────────────────────────────────────────
log "Creating runtime directories..."
mkdir -p "$APP_DIR/logs"
mkdir -p "$APP_DIR/backend/uploads/hr"

# ── run migrations ───────────────────────────────────────────────────────────
log "Running DB migrations..."
node scripts/migrate.js

# ── seed leave balances (HRMS Ph16 — idempotent, ON CONFLICT DO NOTHING) ─────
if psql -U "${DB_USER:-postgres}" -d "${DB_NAME:-mk_paper_mill}" -f db/seed_leave_balances.sql -q 2>/dev/null; then
  log "Leave balances seeded."
else
  log "WARNING: seed_leave_balances.sql skipped (Ph16 tables not migrated yet or psql not in PATH)"
fi

# ── preflight ─────────────────────────────────────────────────────────────────
log "Running preflight checks..."
NODE_ENV=production node scripts/preflight.js || die "Preflight failed — fix above errors first"

# ── pm2 start/reload ─────────────────────────────────────────────────────────
log "Starting/reloading PM2..."
if pm2 list | grep -q "mk-erp-backend"; then
  pm2 reload ecosystem.config.js --update-env
else
  pm2 start ecosystem.config.js
  pm2 save
fi

log ""
log "════════════════════════════════════════════════════════"
log "  DEPLOY COMPLETE"
log "  App:     http://127.0.0.1:5000"
log "  Logs:    pm2 logs mk-erp-backend"
log "  Monitor: pm2 monit"
log ""
log "  SMOKE TESTS (run manually after deploy):"
log "  1. L1 login  → HR page → Profile / Leave Balance / Payslip tabs visible"
log "  2. L2 login  → HR page → Team Attendance + Team Leaves tabs visible"
log "  3. HR Admin  → HR page → Employees CRUD + Payroll Runs tab visible"
log "  4. L4 login  → Indent → Acknowledge tab → mobile layout OK"
log "  5. HR Admin  → HR → Documents → Upload a PDF file"
log "  6. HR Admin  → HR → Payslip → Form 16 download link opens PDF"
log "  7. Admin     → Bell icon → unread count shows (after PIIMAS indent aged)"
log "  8. GET /api/health → {status:'ok'}"
log "════════════════════════════════════════════════════════"
