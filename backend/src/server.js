require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const pool = require('./db/pool');
const { logBackendError, logDbError, logFrontendError } = require('./logger');

process.on('uncaughtException', (err) => { console.error('[UNCAUGHT]', err); logBackendError('uncaughtException', err); });
process.on('unhandledRejection', (err) => { console.error('[UNHANDLED REJECTION]', err); logBackendError('unhandledRejection', err); });

const app = express();
const PORT = process.env.PORT || 5000;
const PROD = process.env.NODE_ENV === 'production';

// --- Phase B: JWT secret boot-check (refuse to start unsafe in production) ---
const SECRET = process.env.JWT_SECRET || '';
const DEFAULT_SECRET = 'change_this_to_a_secure_64_char_random_string';
if (PROD && (!SECRET || SECRET === DEFAULT_SECRET || SECRET.length < 32)) {
  console.error('FATAL: JWT_SECRET missing/default/too short. Set a strong 64-char secret in .env. Refusing to start.');
  process.exit(1);
}

// --- Phase B: CORS locked to allowed origins in production ---
const ORIGINS = (process.env.CORS_ORIGIN || '').split(',').map(s => s.trim()).filter(Boolean);
app.use(cors(PROD ? { origin: ORIGINS.length ? ORIGINS : false, credentials: true } : {}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- Prometheus metrics ---
const { register, metricsMiddleware } = require('./metrics');
app.use(metricsMiddleware);
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

// --- Phase B: simple in-memory rate limit on auth (brute-force guard, no deps) ---
const RL_WINDOW = 15 * 60 * 1000;
const RL_MAX = 50;
const rlHits = new Map();
function authLimiter(req, res, next) {
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  const now = Date.now();
  const rec = rlHits.get(ip);
  if (!rec || now > rec.reset) { rlHits.set(ip, { count: 1, reset: now + RL_WINDOW }); return next(); }
  if (rec.count >= RL_MAX)
    return res.status(429).json({ success: false, message: 'Too many attempts. Try again later.' });
  rec.count++; next();
}
setInterval(() => { const t = Date.now(); for (const [k, v] of rlHits) if (t > v.reset) rlHits.delete(k); }, RL_WINDOW).unref();

// API Routes
app.use('/api/auth', authLimiter, require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/production/dpr', require('./routes/dpsImport'));
app.use('/api/production', require('./routes/production'));
app.use('/api/master', require('./routes/master'));
app.use('/api/inventory', require('./routes/inventory'));
app.use('/api/indent', require('./routes/indent'));
app.use('/api/purchase', require('./routes/purchase'));
app.use('/api/inbound-dc', require('./routes/inboundDc'));
app.use('/api/quality', require('./routes/quality'));
app.use('/api/maintenance', require('./routes/maintenance'));
app.use('/api/sales', require('./routes/sales'));
app.use('/api/utility', require('./routes/utility'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/hr', require('./routes/hr'));
app.use('/api/finance', require('./routes/finance'));
app.use('/api/store', require('./routes/store'));
app.use('/api/scrap', require('./routes/scrap'));
app.use('/api/warehouse', require('./routes/warehouse'));
app.use('/api/security', require('./routes/security'));
app.use('/api/laboratory', require('./routes/laboratory'));
app.use('/api/ehs', require('./routes/ehs'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/sections', require('./routes/sections'));
app.use('/api/chemicals', require('./routes/chemicals'));
app.use('/api/telemetry', require('./routes/telemetry'));
app.use('/api/events',    require('./routes/events'));

// --- Dev & Multi-Agent progress dashboard ---
app.use('/api/dev', require('./routes/dev'));
app.get('/dev/progress', (req, res) =>
  res.sendFile(path.join(__dirname, 'public/progress.html')));

// Serve uploaded HR documents (all envs)
app.use('/uploads/hr', express.static(path.join(__dirname, '../uploads/hr')));
// Serve uploaded maintenance scans/photos
app.use('/uploads/maintenance', express.static(path.join(__dirname, '../uploads/maintenance')));

// Serve React frontend (production or if built dist exists)
const distPath = path.join(__dirname, '../../frontend/dist');
if (process.env.NODE_ENV === 'production' || fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) return next();
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// KPI snapshot cron — runs hourly, upserts section_kpi_snapshots
async function computeSectionKPISnapshot() {
  try {
    const { rows: sections } = await pool.query('SELECT id, section_code FROM plant_sections WHERE is_active=true');
    for (const s of sections) {
      const { rows: readings } = await pool.query(
        `SELECT tag_name, parameter_name, AVG(value) as avg_val, uom
         FROM section_process_readings
         WHERE section_id=$1 AND reading_time >= NOW() - INTERVAL '1 hour'
         GROUP BY tag_name, parameter_name, uom`,
        [s.id]
      );
      const kpiData = {};
      readings.forEach(r => { kpiData[r.tag_name] = { avg: parseFloat(r.avg_val), uom: r.uom, param: r.parameter_name }; });

      const { rows: alarmCounts } = await pool.query(
        `SELECT alarm_type, COUNT(*) as cnt FROM section_alarms
         WHERE section_id=$1 AND resolved_at IS NULL GROUP BY alarm_type`,
        [s.id]
      );
      kpiData._alarms = {};
      alarmCounts.forEach(a => { kpiData._alarms[a.alarm_type.toLowerCase()] = parseInt(a.cnt); });

      await pool.query(
        `INSERT INTO section_kpi_snapshots (section_id, snapshot_time, kpi_data)
         VALUES ($1, date_trunc('hour', NOW()), $2)
         ON CONFLICT (section_id, date_trunc('hour', snapshot_time))
         DO UPDATE SET kpi_data=$2`,
        [s.id, JSON.stringify(kpiData)]
      );
    }
  } catch (e) {
    console.error('[KPI Cron] error:', e.message);
  }
}
setInterval(computeSectionKPISnapshot, 3_600_000).unref();
setTimeout(computeSectionKPISnapshot, 5000).unref(); // run once 5s after boot

// ─── NOTIFICATIONS TABLE (auto-create if not exists) ────────────────────────
pool.query(`
  CREATE TABLE IF NOT EXISTS notifications (
    id         SERIAL PRIMARY KEY,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type       VARCHAR(50)  DEFAULT 'info',
    title      VARCHAR(200) NOT NULL,
    message    TEXT,
    ref_table  VARCHAR(50),
    ref_id     INTEGER,
    is_read    BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id, is_read, created_at DESC);
`).catch(e => console.error('[Notifications] table init error:', e.message));

// ─── PIIMAS ESCALATION CRON (P7 completion) ─────────────────────────────────
// Runs every 2h: finds indents pending ack > 24h → creates notifications for dept head
async function runPiimasEscalation() {
  try {
    // Indents issued > 24h ago with pending ack items
    const { rows: stale } = await pool.query(`
      SELECT i.id, i.indent_number, i.department_id,
             d.name AS dept_name,
             COUNT(ii.id) FILTER (WHERE ii.ack_status='pending') AS pending_items,
             COALESCE(i.issued_at, i.created_at) AS last_update
      FROM indents i
      JOIN indent_items ii ON ii.indent_id = i.id
      JOIN departments d ON d.id = i.department_id
      WHERE i.status = 'Issued'
        AND ii.ack_status = 'pending'
        AND COALESCE(i.issued_at, i.created_at) < NOW() - INTERVAL '24 hours'
      GROUP BY i.id, i.indent_number, i.department_id, d.name, i.issued_at, i.created_at
      HAVING COUNT(ii.id) FILTER (WHERE ii.ack_status='pending') > 0
    `);

    for (const indent of stale) {
      // Find dept head (L3 in same dept) or L4+ to notify
      const { rows: heads } = await pool.query(`
        SELECT u.id FROM users u
        JOIN roles r ON r.id = u.role_id
        WHERE u.department_id = $1 AND r.level >= 3 AND u.is_active = true
        UNION
        SELECT u.id FROM users u
        JOIN roles r ON r.id = u.role_id
        WHERE r.level >= 4 AND u.is_active = true
        LIMIT 10
      `, [indent.department_id]);

      for (const head of heads) {
        // Avoid duplicate — check if notified in last 24h for same indent
        const { rows: existing } = await pool.query(
          `SELECT id FROM notifications
           WHERE user_id=$1 AND ref_table='indents' AND ref_id=$2
             AND created_at > NOW() - INTERVAL '24 hours'`,
          [head.id, indent.id]
        );
        if (existing.length) continue;

        await pool.query(`
          INSERT INTO notifications (user_id, type, title, message, ref_table, ref_id)
          VALUES ($1, 'warning', $2, $3, 'indents', $4)
        `, [
          head.id,
          `Pending Ack: ${indent.indent_number}`,
          `${indent.pending_items} item(s) from indent ${indent.indent_number} (${indent.dept_name}) await acknowledgment for >24h.`,
          indent.id
        ]);
      }

      // Auto-escalate indent status after 48h
      const hoursOld = (Date.now() - new Date(indent.last_update)) / 3_600_000;
      if (hoursOld > 48) {
        await pool.query(
          `UPDATE indents SET remarks = COALESCE(remarks,'') || ' [Auto-escalated: ack overdue >48h]'
           WHERE id=$1 AND status='Issued'`,
          [indent.id]
        );
      }
    }

    if (stale.length) console.log(`[PIIMAS Escalation] Processed ${stale.length} overdue indents`);
  } catch (e) {
    console.error('[PIIMAS Escalation] error:', e.message);
  }
}
setInterval(runPiimasEscalation, 2 * 3_600_000).unref();
setTimeout(runPiimasEscalation, 10_000).unref(); // first run 10s after boot

// POST /api/logs/client-error — frontend ships live JS errors here for troubleshooting
app.post('/api/logs/client-error', express.json(), (req, res) => {
  logFrontendError(req.body || {});
  res.json({ success: true });
});

// JSON error handler — must be last middleware, prevents HTML 500 pages
app.use((err, req, res, next) => {
  const status = err.status || err.statusCode || 500;
  const msg = err.message || 'Internal server error';
  if (process.env.NODE_ENV !== 'production') console.error('[ERROR]', req.method, req.path, msg);
  const context = `${req.method} ${req.path}`;
  if (err.code && typeof err.code === 'string' && /^[0-9A-Z]{5}$/.test(err.code)) {
    logDbError(context, err); // Postgres error codes are 5-char SQLSTATE
  } else {
    logBackendError(context, err);
  }
  res.status(status).json({ success: false, message: msg });
});

app.listen(PORT, () => {
  console.log(`MK Paper Mill ERP server running on port ${PORT}`);
});
