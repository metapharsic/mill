const router = require('express').Router();
const pool = require('../db/pool');
const { auth, requireLevel } = require('../middleware/auth');
const { metrics } = require('../metrics');
const kafka = require('../kafka');

const asyncRoute = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// ─── Helper: section/department ownership ──────────────────────────────────
// A user's "own sections" are plant_sections whose department_id matches req.user.department_id.
// role_level >= 4 (Plant Head) can see/act on everything ("canSeeAll").
function canSeeAllSections(req) {
  return (req.user.role_level || 0) >= 4;
}

// Resolve a machine's owning department via section_equipment -> plant_sections.
// Returns null if the machine has no section_equipment mapping (ownership can't be determined).
async function getMachineDepartmentId(client, machineId) {
  const { rows } = await client.query(
    `SELECT ps.department_id
     FROM section_equipment se
     JOIN plant_sections ps ON ps.id = se.section_id
     WHERE se.machine_id = $1
     LIMIT 1`,
    [machineId]
  );
  return rows.length ? rows[0].department_id : null;
}

// Enforce that a non-privileged user may only act on a machine belonging to their own department.
// Returns true (and does not respond) if allowed; sends a 403 and returns false if not.
async function assertMachineOwnership(req, res, client, machineId) {
  if (canSeeAllSections(req)) return true;
  const deptId = await getMachineDepartmentId(client, machineId);
  if (deptId !== null && deptId !== req.user.department_id) {
    res.status(403).json({ success: false, message: 'You do not have access to this section/machine' });
    return false;
  }
  return true;
}

// ─── Helper: insert audit log row (inside a client transaction) ───────────────
async function auditLog(client, { userId, action, module, recordId, oldData, newData, ip }) {
  await client.query(
    `INSERT INTO audit_log (user_id, action, module, record_id, old_data, new_data, ip_address)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [userId, action, module, recordId, oldData ? JSON.stringify(oldData) : null,
     newData ? JSON.stringify(newData) : null, ip || null]
  );
}

// ─── GET /api/production/machines ────────────────────────────────────────────
router.get('/machines', auth, asyncRoute(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT id, name, code, capacity_tpd, ideal_speed_mpm, is_active, 'Paper Machine' as type
     FROM machines WHERE is_active = true ORDER BY name`
  );
  res.json({ success: true, data: rows });
}));

// ─── GET /api/production/grades ───────────────────────────────────────────────
router.get('/grades', auth, asyncRoute(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT id, name, code, gsm_min, gsm_max FROM grades WHERE is_active = true ORDER BY name`
  );
  res.json({ success: true, data: rows });
}));

// ─── GET /api/production/shifts ───────────────────────────────────────────────
router.get('/shifts', auth, asyncRoute(async (req, res) => {
  const { date, machine_id } = req.query;
  const conditions = ['1=1'];
  const params = [];
  let p = 1;
  if (date) { conditions.push(`s.date = $${p++}`); params.push(date); }

  if (canSeeAllSections(req)) {
    if (machine_id) { conditions.push(`s.machine_id = $${p++}`); params.push(machine_id); }
  } else {
    conditions.push(
      `s.machine_id IN (SELECT se.machine_id FROM section_equipment se JOIN plant_sections ps ON ps.id = se.section_id WHERE ps.department_id = $${p++})`
    );
    params.push(req.user.department_id);
  }

  const { rows } = await pool.query(
    `SELECT s.*,
            m.name AS "machineName",
            u.name AS "supervisorName",
            COUNT(r.id)::int AS "reelCount",
            COALESCE(SUM(r.weight_kg),0)::numeric AS "totalKg"
     FROM shifts s
     LEFT JOIN machines m ON s.machine_id = m.id
     LEFT JOIN users u ON s.supervisor_id = u.id
     LEFT JOIN reels r ON r.shift_id = s.id
     WHERE ${conditions.join(' AND ')}
     GROUP BY s.id, m.name, u.name
     ORDER BY s.date DESC, s.start_time DESC`,
    params
  );
  res.json({ success: true, data: rows });
}));

// ─── POST /api/production/shifts — Open Shift ─────────────────────────────────
router.post('/shifts', auth, requireLevel(2), asyncRoute(async (req, res) => {
  const { date, shift_type, start_time, end_time, machine_id, remarks } = req.body;
  if (!date || !shift_type || !start_time || !machine_id)
    return res.status(400).json({ success: false, message: 'date, shift_type, start_time, machine_id required' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `INSERT INTO shifts (date, shift_type, start_time, end_time, machine_id, supervisor_id, remarks, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'Open') RETURNING *`,
      [date, shift_type, start_time, end_time || null, machine_id, req.user.id, remarks || null]
    );
    const shift = rows[0];
    await auditLog(client, { userId: req.user.id, action: 'SHIFT_OPENED', module: 'Production', recordId: shift.id, newData: shift, ip: req.ip });
    await client.query('COMMIT');
    res.status(201).json({ success: true, data: shift });
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally { client.release(); }
}));

// ─── PUT /api/production/shifts/:id — Close Shift ────────────────────────────
router.put('/shifts/:id', auth, requireLevel(2), asyncRoute(async (req, res) => {
  const { id } = req.params;
  const { end_time, remarks } = req.body;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Fetch old shift
    const { rows: old } = await client.query('SELECT * FROM shifts WHERE id=$1', [id]);
    if (!old.length) { await client.query('ROLLBACK'); return res.status(404).json({ success: false, message: 'Shift not found' }); }

    const { rows } = await client.query(
      `UPDATE shifts SET end_time=$1, status='Closed', remarks=COALESCE($2,remarks) WHERE id=$3 RETURNING *`,
      [end_time || new Date().toISOString(), remarks || null, id]
    );
    const shift = rows[0];
    await auditLog(client, { userId: req.user.id, action: 'SHIFT_CLOSED', module: 'Production', recordId: shift.id, oldData: old[0], newData: shift, ip: req.ip });
    await client.query('COMMIT');
    res.json({ success: true, data: shift });
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally { client.release(); }
}));

// ─── GET /api/production/reels ────────────────────────────────────────────────
router.get('/reels', auth, asyncRoute(async (req, res) => {
  const { date, shift, machine_id, status, grade_id, limit = 50, offset = 0 } = req.query;
  const conditions = [];
  const params = [];
  let p = 1;

  if (date)       { conditions.push(`DATE(r.start_time) = $${p++}`); params.push(date); }
  if (shift)      { conditions.push(`s.shift_type = $${p++}`);       params.push(shift); }
  if (status)     { conditions.push(`r.status = $${p++}`);           params.push(status); }
  if (grade_id)   { conditions.push(`r.grade_id = $${p++}`);         params.push(grade_id); }

  if (canSeeAllSections(req)) {
    if (machine_id) { conditions.push(`r.machine_id = $${p++}`); params.push(machine_id); }
  } else {
    // Restrict to machines belonging to the user's own department, regardless of query params.
    conditions.push(
      `r.machine_id IN (SELECT se.machine_id FROM section_equipment se JOIN plant_sections ps ON ps.id = se.section_id WHERE ps.department_id = $${p++})`
    );
    params.push(req.user.department_id);
  }

  const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

  const { rows } = await pool.query(
    `SELECT r.id, r.reel_number AS "reelNumber", r.barcode,
            r.machine_id AS "machineId", m.name AS "machineName",
            r.grade_id AS "gradeId", g.name AS "gradeName", g.code AS "gradeCode",
            r.shift_id AS "shiftId", s.shift_type AS "shiftType", s.date AS "shiftDate",
            r.operator_id AS "operatorId", u.name AS "operatorName",
            r.gsm, r.width_mm AS "widthMm", r.length_m AS "lengthM",
            r.weight_kg AS "weightKg", r.moisture_pct AS "moisturePct",
            r.speed_mpm AS "speedMpm", r.steam_pressure AS "steamPressure",
            r.steam_consumption AS "steamConsumption", r.water_consumption AS "waterConsumption",
            r.start_time AS "startTime", r.end_time AS "endTime",
            r.production_time_min AS "productionTimeMin", r.break_time_min AS "breakTimeMin",
            r.downtime_min AS "downtimeMin", r.efficiency_pct AS "efficiencyPct",
            r.reject_pct AS "rejectPct", r.status, r.quality_status AS "qualityStatus",
            r.sales_order_id AS "salesOrderId", r.remarks, r.created_at AS "createdAt",
            r.bf, r.deckle, r.reject_reason AS "rejectReason"
     FROM reels r
     LEFT JOIN shifts s ON r.shift_id = s.id
     LEFT JOIN machines m ON r.machine_id = m.id
     LEFT JOIN grades g ON r.grade_id = g.id
     LEFT JOIN users u ON r.operator_id = u.id
     ${where}
     ORDER BY r.created_at DESC
     LIMIT $${p++} OFFSET $${p++}`,
    [...params, limit, offset]
  );
  res.json({ success: true, data: rows });
}));

// ─── POST /api/production/reels — Save Reel (ACID) ───────────────────────────
router.post('/reels', auth, asyncRoute(async (req, res) => {
  const {
    shift_id, machine_id, grade_id, gsm, width_mm, length_m,
    weight_kg, moisture_pct, speed_mpm, steam_pressure, steam_consumption,
    water_consumption, start_time, end_time, production_time_min, break_time_min,
    downtime_min, reject_pct, sales_order_id, remarks, operator_id,
    bf, deckle, reject_reason
  } = req.body;

  if (!machine_id || !grade_id)
    return res.status(400).json({ success: false, message: 'machine_id and grade_id are required' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    if (!(await assertMachineOwnership(req, res, client, machine_id))) {
      await client.query('ROLLBACK');
      return;
    }

    // Auto-generate reel number: MK-YYYYMMDD-PM{n}-NNNN
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0].replace(/-/g, '');

    // Get machine code for PM identifier
    const { rows: machRows } = await client.query('SELECT code, name FROM machines WHERE id=$1', [machine_id]);
    const machCode = machRows.length ? (machRows[0].code || 'XX').replace(/[^A-Z0-9]/gi, '').toUpperCase().substring(0, 4) : 'XX';

    const prefix = `MK-${dateStr}-${machCode}`;
    const { rows: seqRows } = await client.query(
      `SELECT LPAD((COUNT(*) + 1)::text, 4, '0') AS seq
       FROM reels
       WHERE reel_number LIKE $1`,
      [`${prefix}-%`]
    );
    const reelNumber = `${prefix}-${seqRows[0].seq}`;

    // Compute efficiency server-side (per §3 rule)
    let efficiencyPct = null;
    const prodMin = Number(production_time_min) || 0;
    const brkMin  = Number(break_time_min)  || 0;
    const dwnMin  = Number(downtime_min)    || 0;
    if (prodMin > 0) {
      efficiencyPct = ((prodMin - brkMin - dwnMin) / prodMin) * 100;
      efficiencyPct = Math.max(0, Math.min(100, Number(efficiencyPct.toFixed(2))));
    }

    const barcode = `MK-${reelNumber}-${Date.now()}`;

    const { rows } = await client.query(
      `INSERT INTO reels (
         reel_number, barcode, shift_id, machine_id, grade_id, operator_id,
         gsm, width_mm, length_m, weight_kg, moisture_pct, speed_mpm,
         steam_pressure, steam_consumption, water_consumption,
         start_time, end_time, production_time_min, break_time_min,
         downtime_min, efficiency_pct, reject_pct, sales_order_id, remarks,
         status, quality_status, bf, deckle, reject_reason
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,'In Production','Pending',$25,$26,$27)
       RETURNING *`,
      [
        reelNumber, barcode, shift_id || null, machine_id, grade_id, operator_id || req.user.id,
        gsm || null, width_mm || null, length_m || null, weight_kg || null,
        moisture_pct || null, speed_mpm || null, steam_pressure || null,
        steam_consumption || null, water_consumption || null,
        start_time || null, end_time || null,
        production_time_min || null, break_time_min || null,
        downtime_min || null, efficiencyPct, reject_pct || null,
        sales_order_id || null, remarks || null,
        bf || null, deckle || null, reject_reason || null
      ]
    );
    const reel = rows[0];
    
    // Auto-deduct raw materials/chemicals (pulp / starch / color) based on reel weight
    const wt = parseFloat(weight_kg || 0);
    if (wt > 0) {
      // 11-category reset merged pulp/starch/chemicals into one 'Chemical' (CHEM) category —
      // no separate RawMaterial type anymore. Split by name keyword: pulp/starch = bulk fiber, rest = additive.
      const { rows: recipeMats } = await client.query(
        `SELECT m.id, m.name, m.current_stock, m.unit_price
         FROM materials m
         JOIN material_categories mc ON m.category_id = mc.id
         WHERE m.is_active = true AND mc.code = 'CHEM'
         ORDER BY m.code`
      );

      // Default consumption factors relative to paper weight:
      // Say 90% is Pulp (first pulp/starch-named material), and 2% is Chemical (first non-pulp additive)
      const pulpMat = recipeMats.find(m => /pulp|starch/i.test(m.name));
      const chemMat = recipeMats.find(m => m.id !== pulpMat?.id);

      const deductions = [];
      if (pulpMat) deductions.push({ material: pulpMat, qty: wt * 0.90, remarks: 'Raw pulp (90% of reel weight)' });
      if (chemMat) deductions.push({ material: chemMat, qty: wt * 0.02, remarks: 'Additive chemical (2% of reel weight)' });

      for (const d of deductions) {
        const consumed = d.qty;
        const matId = d.material.id;
        const currentStock = parseFloat(d.material.current_stock || 0);
        const nextStock = Math.max(0, currentStock - consumed);

        // Update cache inside ACID
        await client.query(
          `UPDATE materials SET current_stock = $1 WHERE id = $2`,
          [nextStock, matId]
        );

        // Record stock ledger entry
        await client.query(
          `INSERT INTO stock_ledger (material_id, date, transaction_type, reference_id, reference_type, out_qty, balance, unit_price, value, remarks, created_by)
           VALUES ($1, CURRENT_DATE, 'Issue', $2, 'Production', $3, $4, $5, $6, $7, $8)`,
          [
            matId,
            reel.id,
            consumed,
            nextStock,
            d.material.unit_price || 0,
            consumed * parseFloat(d.material.unit_price || 0),
            `${d.remarks} for reel ${reelNumber}`,
            req.user.id
          ]
        );
      }
    }

    await auditLog(client, { userId: req.user.id, action: 'REEL_CREATED', module: 'Production', recordId: reel.id, newData: reel, ip: req.ip });
    await client.query('COMMIT');
    res.status(201).json({ success: true, data: reel });
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally { client.release(); }
}));

// ─── PUT /api/production/reels/:id/status — Reel Status Machine ───────────────
const VALID_TRANSITIONS = {
  'In Production': ['QC Pending'],
  'QC Pending':    ['QC Done'],
  'QC Done':       ['In Warehouse', 'Rejected'],
  'In Warehouse':  ['Dispatched'],
};
// Doc31 #18: status transitions feed OEE/quality-release data — supervisor confirm required, not pure self-report.
router.put('/reels/:id/status', auth, requireLevel(2), asyncRoute(async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: old } = await client.query('SELECT * FROM reels WHERE id=$1', [id]);
    if (!old.length) { await client.query('ROLLBACK'); return res.status(404).json({ success: false, message: 'Reel not found' }); }

    const currentStatus = old[0].status;
    const allowed = VALID_TRANSITIONS[currentStatus] || [];
    if (!allowed.includes(status)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: `Cannot transition from '${currentStatus}' to '${status}'` });
    }

    const { rows } = await client.query(
      `UPDATE reels SET status=$1 WHERE id=$2 RETURNING *`,
      [status, id]
    );
    const reel = rows[0];
    await auditLog(client, { userId: req.user.id, action: 'REEL_STATUS_CHANGED', module: 'Production', recordId: reel.id, oldData: { status: currentStatus }, newData: { status }, ip: req.ip });
    await client.query('COMMIT');
    res.json({ success: true, data: reel });
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally { client.release(); }
}));

// ─── GET /api/production/downtime ─────────────────────────────────────────────
router.get('/downtime', auth, asyncRoute(async (req, res) => {
  const { date, machine_id, category, limit = 50, offset = 0 } = req.query;
  const conditions = [];
  const params = [];
  let p = 1;
  if (date)       { conditions.push(`DATE(d.start_time) = $${p++}`); params.push(date); }
  if (category)   { conditions.push(`d.category = $${p++}`);         params.push(category); }

  if (canSeeAllSections(req)) {
    if (machine_id) { conditions.push(`d.machine_id = $${p++}`); params.push(machine_id); }
  } else {
    conditions.push(
      `d.machine_id IN (SELECT se.machine_id FROM section_equipment se JOIN plant_sections ps ON ps.id = se.section_id WHERE ps.department_id = $${p++})`
    );
    params.push(req.user.department_id);
  }

  const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

  const { rows } = await pool.query(
    `SELECT d.id, d.machine_id AS "machineId", m.name AS "machineName",
            d.shift_id AS "shiftId", s.shift_type AS "shiftType",
            d.reel_id AS "reelId", r.reel_number AS "reelNumber",
            d.start_time AS "startTime", d.end_time AS "endTime",
            d.duration_min AS "durationMin", d.category, d.reason,
            d.corrective_action AS "correctiveAction",
            u.name AS "reportedByName", d.created_at AS "createdAt",
            d.reason_code_id AS "reasonCodeId", rc.reason_code AS "reasonCode"
     FROM downtime_entries d
     LEFT JOIN machines m ON d.machine_id = m.id
     LEFT JOIN shifts s ON d.shift_id = s.id
     LEFT JOIN reels r ON d.reel_id = r.id
     LEFT JOIN users u ON d.reported_by = u.id
     LEFT JOIN downtime_reason_codes rc ON d.reason_code_id = rc.id
     ${where}
     ORDER BY d.start_time DESC
     LIMIT $${p++} OFFSET $${p++}`,
    [...params, limit, offset]
  );
  res.json({ success: true, data: rows });
}));

// ─── POST /api/production/downtime ────────────────────────────────────────────
router.post('/downtime', auth, asyncRoute(async (req, res) => {
  const { shift_id, machine_id, reel_id, start_time, end_time, duration_min, category, reason, corrective_action, reason_code_id } = req.body;
  if (!machine_id || !start_time || !category || !reason)
    return res.status(400).json({ success: false, message: 'machine_id, start_time, category, reason required' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    if (!(await assertMachineOwnership(req, res, client, machine_id))) {
      await client.query('ROLLBACK');
      return;
    }

    // Auto-compute duration if both times given
    let dur = duration_min ? Number(duration_min) : null;
    if (!dur && start_time && end_time) {
      const ms = new Date(end_time) - new Date(start_time);
      dur = Math.max(0, Math.round(ms / 60000));
    }
    const { rows } = await client.query(
      `INSERT INTO downtime_entries (shift_id, machine_id, reel_id, start_time, end_time, duration_min, category, reason, corrective_action, reported_by, reason_code_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [shift_id || null, machine_id, reel_id || null, start_time, end_time || null, dur, category, reason, corrective_action || null, req.user.id, reason_code_id || null]
    );
    const entry = rows[0];
    await auditLog(client, { userId: req.user.id, action: 'DOWNTIME_LOGGED', module: 'Production', recordId: entry.id, newData: entry, ip: req.ip });
    await client.query('COMMIT');
    res.status(201).json({ success: true, data: entry });
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally { client.release(); }
}));

// ─── PUT /api/production/downtime/:id/close ───────────────────────────────────
// Doc31 #18: closing/reconciling downtime hours feeds uptime KPI — supervisor confirm required.
router.put('/downtime/:id/close', auth, requireLevel(2), asyncRoute(async (req, res) => {
  const { end_time, corrective_action } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: old } = await client.query(
      'SELECT * FROM downtime_entries WHERE id=$1 FOR UPDATE', [req.params.id]
    );
    if (!old.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Downtime entry not found' });
    }
    if (old[0].end_time) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'Downtime already closed' });
    }
    const endTs = end_time ? new Date(end_time) : new Date();
    const dur = Math.max(0, Math.round((endTs - new Date(old[0].start_time)) / 60000));
    const { rows } = await client.query(
      `UPDATE downtime_entries
         SET end_time=$1, duration_min=$2, corrective_action=COALESCE($3,corrective_action)
       WHERE id=$4 RETURNING *`,
      [endTs.toISOString(), dur, corrective_action || null, req.params.id]
    );
    await auditLog(client, {
      userId: req.user.id, action: 'DOWNTIME_CLOSED', module: 'Production',
      recordId: old[0].id, oldData: old[0], newData: rows[0], ip: req.ip
    });
    await client.query('COMMIT');
    res.json({ success: true, data: rows[0] });
  } catch (e) { await client.query('ROLLBACK'); throw e; }
  finally { client.release(); }
}));

// ─── GET /api/production/oee — OEE per machine for a date ────────────────────
router.get('/oee', auth, asyncRoute(async (req, res) => {
  const { date } = req.query;
  const targetDate = date || new Date().toISOString().split('T')[0];

  const sectionFilter = canSeeAllSections(req)
    ? ''
    : ` AND dpr.machine_id IN (SELECT se.machine_id FROM section_equipment se JOIN plant_sections ps ON ps.id = se.section_id WHERE ps.department_id = $2)`;
  const oeeParams = canSeeAllSections(req) ? [targetDate] : [targetDate, req.user.department_id];

  // 1. Try to fetch from Daily Production Reports (consolidated Daily Performance Statement)
  const { rows: dprRows } = await pool.query(
    `SELECT
       dpr.id AS "dprId",
       dpr.machine_id AS "machineId",
       m.name AS "machineName",
       m.ideal_speed_mpm AS "idealSpeedMpm",
       m.design_speed_mpm AS "designSpeedMpm",
       dpr.pmc_production_mt AS "pmcProductionMt",
       dpr.finish_production_mt AS "finishProductionMt",
       dpr.running_minutes AS "runningMinutes",
       dpr.down_minutes AS "downMinutes",
       dpr.machine_speed_avg AS "speedAvg"
     FROM daily_production_reports dpr
     LEFT JOIN machines m ON m.id = dpr.machine_id
     WHERE dpr.report_date = $1 AND m.is_active = true${sectionFilter}`,
    oeeParams
  );

  if (dprRows.length > 0) {
    const data = dprRows.map(row => {
      const runMin = Number(row.runningMinutes) || 0;
      const downMin = Number(row.downMinutes) || 0;
      const totalMin = runMin + downMin;
      const speed = Number(row.speedAvg) || 0;
      const designSpeed = Number(row.designSpeedMpm || row.idealSpeedMpm) || 300;
      const pmc = Number(row.pmcProductionMt) || 0;
      const finish = Number(row.finishProductionMt) || 0;

      const availability = totalMin > 0 ? (runMin / totalMin) : 0;
      const performance  = designSpeed > 0 ? Math.min(1, speed / designSpeed) : 0;
      const quality      = pmc > 0 ? Math.min(1, finish / pmc) : 0;
      const oee          = availability * performance * quality * 100;

      return {
        machineId: row.machineId,
        machineName: row.machineName,
        oeeSource: 'DailyPerformanceStatement',
        availability: Number((availability * 100).toFixed(2)),
        performance:  Number((performance * 100).toFixed(2)),
        quality:      Number((quality * 100).toFixed(2)),
        oee:          Number(oee.toFixed(2)),
        runningMinutes: runMin,
        downMinutes: downMin,
        speedAvg: speed,
        pmcProductionMt: pmc,
        finishProductionMt: finish
      };
    });
    return res.json({ success: true, data, date: targetDate });
  }

  // 2. Fallback to reel-level aggregates if no daily statement exists
  const { rows } = await pool.query(
    `SELECT
       m.id AS "machineId",
       m.name AS "machineName",
       m.ideal_speed_mpm AS "idealSpeedMpm",
       m.design_speed_mpm AS "designSpeedMpm",
       COUNT(r.id) AS "reelCount",
       COALESCE(SUM(r.weight_kg),0)::numeric AS "totalKg",
       COALESCE(AVG(r.gsm),0)::numeric AS "avgGsm",
       COALESCE(AVG(r.efficiency_pct),0)::numeric AS "avgEfficiency",
       COALESCE(AVG(r.moisture_pct),0)::numeric AS "avgMoisture",
       COALESCE(AVG(r.speed_mpm),0)::numeric AS "avgSpeed",
       COALESCE(AVG(r.reject_pct),0)::numeric AS "avgReject",
       COALESCE(SUM(r.downtime_min),0)::numeric AS "totalDowntimeMin",
       COALESCE(SUM(r.production_time_min),0)::numeric AS "totalProdMin"
     FROM machines m
     LEFT JOIN reels r ON r.machine_id = m.id AND DATE(r.start_time) = $1
     WHERE m.is_active = true${sectionFilter.replace(/dpr\.machine_id/g, 'm.id')}
     GROUP BY m.id, m.name, m.ideal_speed_mpm, m.design_speed_mpm
     ORDER BY m.name`,
    oeeParams
  );

  const data = rows.map(row => {
    const totalProd = Number(row.totalProdMin);
    const totalDown = Number(row.totalDowntimeMin);
    const availableMins = totalProd > 0 ? totalProd - totalDown : 0;
    const idealSpeed = Number(row.designSpeedMpm || row.idealSpeedMpm) || 300;
    const avgSpeed   = Number(row.avgSpeed) || 0;

    const availability  = totalProd > 0 ? (availableMins / totalProd) : 0;
    const performance   = idealSpeed > 0 ? Math.min(1, avgSpeed / idealSpeed) : 0;
    const rejectRate    = Number(row.avgReject) / 100;
    const quality       = Math.max(0, 1 - rejectRate);
    const oee           = availability * performance * quality * 100;

    return {
      machineId: row.machineId,
      machineName: row.machineName,
      oeeSource: 'ReelAverages',
      availability: Number((availability * 100).toFixed(2)),
      performance:  Number((performance * 100).toFixed(2)),
      quality:      Number((quality * 100).toFixed(2)),
      oee:          Number(oee.toFixed(2)),
      reelCount: Number(row.reelCount)
    };
  });

  res.json({ success: true, data, date: targetDate });
}));

// ─── GET /api/production/summary ─────────────────────────────────────────────
router.get('/summary', auth, asyncRoute(async (req, res) => {
  const { from, to } = req.query;
  const today = new Date().toISOString().split('T')[0];
  const params = [from || today, to || today];
  let sectionFilter = '';
  if (!canSeeAllSections(req)) {
    sectionFilter = ` AND ps.machine_id IN (SELECT se.machine_id FROM section_equipment se JOIN plant_sections psec ON psec.id = se.section_id WHERE psec.department_id = $3)`;
    params.push(req.user.department_id);
  }
  const { rows } = await pool.query(
    `SELECT ps.*, m.name AS "machineName"
     FROM production_summary ps
     LEFT JOIN machines m ON ps.machine_id = m.id
     WHERE ps.date BETWEEN $1 AND $2${sectionFilter}
     ORDER BY ps.date DESC, ps.shift_type`,
    params
  );

  res.json({ success: true, data: rows });
}));

// ── SHIFT REPORTS (F3) ────────────────────────────────────────────────────────
router.get('/shift-reports', auth, asyncRoute(async (req, res) => {
  const { date, shift_type, section } = req.query;
  const conds = []; const params = []; let p = 1;
  if (date)       { conds.push(`sr.date = $${p++}`); params.push(date); }
  if (shift_type) { conds.push(`sr.shift_type = $${p++}`); params.push(shift_type); }
  if (section)    { conds.push(`sr.section = $${p++}`); params.push(section); }
  const where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';
  const { rows } = await pool.query(
    `SELECT sr.*, u.name as "operatorName" 
     FROM shift_reports sr 
     LEFT JOIN users u ON u.id = sr.operator_id
     ${where} ORDER BY sr.date DESC, sr.shift_type DESC`, params
  );
  res.json({ success: true, data: rows });
}));

router.post('/shift-reports', auth, requireLevel(1), asyncRoute(async (req, res) => {
  const { date, shift_type, section, data, remarks } = req.body;
  if (!date || !shift_type || !section)
    return res.status(400).json({ success: false, message: 'date, shift_type, section required' });

  // Ownership check: `section` is a free-text label matched (case-insensitive) against
  // plant_sections.name to resolve its owning department. If no match is found the section
  // isn't a modeled plant_sections row, so it can't be attributed to a department and is allowed.
  if (!canSeeAllSections(req)) {
    const { rows: secRows } = await pool.query(
      `SELECT department_id FROM plant_sections WHERE LOWER(name) = LOWER($1) LIMIT 1`,
      [section]
    );
    if (secRows.length && secRows[0].department_id !== req.user.department_id) {
      return res.status(403).json({ success: false, message: 'You do not have access to this section' });
    }
  }

  const { rows } = await pool.query(
    `INSERT INTO shift_reports (date, shift_type, section, operator_id, data, remarks)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (date, shift_type, section) 
     DO UPDATE SET data=EXCLUDED.data, remarks=EXCLUDED.remarks, operator_id=EXCLUDED.operator_id
     RETURNING *`,
    [date, shift_type, section, req.user.id, JSON.stringify(data || {}), remarks || null]
  );
  res.status(201).json({ success: true, data: rows[0] });
}));

// ── CHEMICAL CONSUMPTION (F4) ──────────────────────────────────────────────────
router.get('/chemical-consumption', auth, asyncRoute(async (req, res) => {
  const { date } = req.query;
  const params = [];
  let p = 1;
  let query = `SELECT cc.*, m.name as "chemicalName", u.name as "recordedByName"
               FROM chemical_consumption cc
               LEFT JOIN materials m ON m.id = cc.chemical_id
               LEFT JOIN users u ON u.id = cc.recorded_by`;
  const where = [];
  if (date) {
    where.push(`cc.date = $${p++}`);
    params.push(date);
  }
  // NOTE: chemical_consumption has no machine_id column, so consumption rows cannot be
  // attributed to a section/department. The previous department filter referenced
  // cc.machine_id and threw 42703, making this endpoint a hard 500 for every user below
  // role_level 4. Consumption is a mill-wide figure until the column exists.
  if (where.length) query += ` WHERE ` + where.join(' AND ');
  query += ` ORDER BY cc.date DESC, cc.shift_type`;
  const { rows } = await pool.query(query, params);
  res.json({ success: true, data: rows });
}));

router.post('/chemical-consumption', auth, requireLevel(1), asyncRoute(async (req, res) => {
  const { date, shift_type, chemical_id, qty_consumed, unit_cost, machine_id } = req.body;
  if (!date || !shift_type || !chemical_id || qty_consumed === undefined)
    return res.status(400).json({ success: false, message: 'date, shift_type, chemical_id, qty_consumed required' });

  if (machine_id) {
    const allowed = await assertMachineOwnership(req, res, pool, machine_id);
    if (!allowed) return;
  }

  const unitCost = unit_cost || 0;
  const totalCost = Number(qty_consumed) * Number(unitCost);

  // machine_id is accepted (and ownership-checked above) but NOT persisted: the
  // chemical_consumption table has no machine_id column. Including it in the INSERT made
  // every POST to this endpoint fail with 42703.
  const { rows } = await pool.query(
    `INSERT INTO chemical_consumption (date, shift_type, chemical_id, qty_consumed, unit_cost, total_cost, recorded_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [date, shift_type, chemical_id, qty_consumed, unitCost, totalCost, req.user.id]
  );
  res.status(201).json({ success: true, data: rows[0] });
}));

// ══════════════════════════════════════════════════════════════════════════════
// DAILY PRODUCTION REPORT (DPR) — consolidated daily mill artifact
// Binds PM/C production + GSM-wise + chemicals + furnish + power + boiler.
// All per-ton ratios computed here (server-side), never stored.
// ══════════════════════════════════════════════════════════════════════════════

// round helper — fixed decimals, numeric (not string)
const r3 = (v, d = 3) => {
  const n = Number(v);
  return Number.isFinite(n) ? Number(n.toFixed(d)) : 0;
};
const hhmm = (mins) => {
  const m = Math.max(0, parseInt(mins || 0, 10));
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};

// Map a chemical name to its standard column (normalised, substring match)
function chemStdKey(name) {
  const n = String(name || '').toLowerCase();
  if (n.includes('starch'))    return 'starch_kg_per_ton';
  if (n.includes('pac'))       return 'pac_kg_per_ton';
  if (n.includes('surface'))   return 'surface_size_kg_per_ton';
  if (n.includes('coagul'))    return 'coagulant_kg_per_ton';
  if (n.includes('deform') || n.includes('defoam')) return 'deformer_kg_per_ton';
  if (n.includes('retention')) return 'retention_kg_per_ton';
  if (n.includes('bond') || n.includes('se-bond')) return 'se_bond_kg_per_ton';
  if (n.includes('sigmaexor') || n.includes('etp')) return 'sigmaexor_etp_kg_per_ton';
  return null;
}
// variance status: ALERT if abs(actual-std) > 5% of std (and std > 0)
const vStatus = (actual, std) => (std > 0 && Math.abs(actual - std) > std * 0.05 ? 'ALERT' : 'OK');

// Assemble a full report (header + children + computed ratios + variance vs standards)
async function assembleDPR(header) {
  const denom = Number(header.pmc_production_mt) || 0;
  const perTon = (qty) => (denom > 0 ? r3(Number(qty) / denom, 3) : 0);

  // 1. Detect primary grade code run on this report date & machine
  const primaryGradeQuery = await pool.query(
    `SELECT g.code 
     FROM reels r 
     JOIN grades g ON r.grade_id = g.id 
     WHERE DATE(r.start_time) = $1 AND r.machine_id IS NOT DISTINCT FROM $2
     GROUP BY g.code 
     ORDER BY SUM(r.weight_kg) DESC LIMIT 1`,
    [header.report_date, header.machine_id]
  );
  const gradeCode = primaryGradeQuery.rows.length ? primaryGradeQuery.rows[0].code : 'DEFAULT';

  // 2. Fetch standard with fallback to DEFAULT
  const [gsm, chems, downs, stdRows, hist] = await Promise.all([
    pool.query(`SELECT id, gsm, bf, sets, production_mt FROM dpr_gsm_breakup WHERE report_id=$1 ORDER BY sort_order, id`, [header.id]),
    pool.query(`SELECT id, chemical_name, chemical_id, qty_kg FROM dpr_chemical_lines WHERE report_id=$1 ORDER BY sort_order, id`, [header.id]),
    pool.query(`SELECT id, shift, minutes, reason, reason_code FROM dpr_downtime_lines WHERE report_id=$1 ORDER BY sort_order, id`, [header.id]),
    pool.query(
      `SELECT * FROM dpr_grade_standards 
       WHERE grade_code = $1 AND is_active = true 
       UNION ALL 
       SELECT * FROM dpr_grade_standards 
       WHERE grade_code = 'DEFAULT' AND is_active = true 
       LIMIT 1`,
      [gradeCode]
    ),
    pool.query(`
      SELECT AVG(pmc_production_mt) as avg_pmc, AVG(finish_production_mt) as avg_finish
      FROM daily_production_reports
      WHERE machine_id = $1 AND report_date >= $2::date - INTERVAL '7 days' AND report_date < $2::date
    `, [header.machine_id, header.report_date])
  ]);
  const std = stdRows.rows[0] || {};
  const avg = hist.rows[0] || {};

  const chemicals = chems.rows.map(c => {
    const kg_per_ton = perTon(c.qty_kg);
    const key = chemStdKey(c.chemical_name);
    const stdVal = key ? Number(std[key]) : null;
    return {
      ...c, qty_kg: Number(c.qty_kg), kg_per_ton,
      std_per_ton: stdVal,
      variance: stdVal != null ? r3(kg_per_ton - stdVal, 3) : null,
      status: stdVal != null ? vStatus(kg_per_ton, stdVal) : 'N/A',
    };
  });

  const powerPT = perTon(header.power_units);
  const steamPT = perTon(header.total_steam_mt);
  const huskPT  = perTon(header.rice_husk_mt);
  const finishPct = denom > 0 ? r3((Number(header.finish_production_mt) / denom) * 100, 2) : 0;
  const furnishYield = Number(header.furnish_total_mt) > 0
    ? r3((Number(header.finish_production_mt) / Number(header.furnish_total_mt)) * 100, 2) : 0;

  return {
    ...header,
    running_hhmm: hhmm(header.running_minutes),
    down_hhmm:    hhmm(header.down_minutes),
    gsm_breakup: gsm.rows.map(g => ({ ...g, gsm: Number(g.gsm), bf: g.bf == null ? null : Number(g.bf), sets: Number(g.sets), production_mt: Number(g.production_mt) })),
    chemicals,
    downtime: downs.rows.map(d => ({ ...d, hhmm: hhmm(d.minutes) })),
    standards: std,
    ratios: {
      finish_pct: finishPct,
      power_unit_per_ton: powerPT, power_std: Number(std.power_unit_per_ton) || null, power_status: vStatus(powerPT, Number(std.power_unit_per_ton)),
      steam_mt_per_ton:   steamPT, steam_std: Number(std.steam_mt_per_ton) || null, steam_status: vStatus(steamPT, Number(std.steam_mt_per_ton)),
      husk_mt_per_ton:    huskPT,  husk_std:  Number(std.husk_mt_per_ton) || null,  husk_status:  vStatus(huskPT, Number(std.husk_mt_per_ton)),
      furnish_mt_per_ton: perTon(header.furnish_total_mt),
      furnish_yield_pct:  furnishYield, yield_std: Number(std.yield_pct) || null,
      yield_status:       vStatus(furnishYield, Number(std.yield_pct)),
    },
    weekly_avg: {
      pmc_production_mt: avg.avg_pmc ? r3(Number(avg.avg_pmc), 3) : 0,
      finish_production_mt: avg.avg_finish ? r3(Number(avg.avg_finish), 3) : 0,
    }
  };
}

// GET /api/production/daily-report?date=&machine_id=  — single full report
router.get('/daily-report', auth, asyncRoute(async (req, res) => {
  const date = req.query.date || new Date().toISOString().slice(0, 10);
  const conds = ['report_date = $1']; const params = [date]; let p = 2;
  if (req.query.machine_id) { conds.push(`machine_id = $${p++}`); params.push(req.query.machine_id); }
  const { rows } = await pool.query(
    `SELECT dpr.*, m.name AS "machineName", u.name AS "createdByName"
     FROM daily_production_reports dpr
     LEFT JOIN machines m ON m.id = dpr.machine_id
     LEFT JOIN users u ON u.id = dpr.created_by
     WHERE ${conds.join(' AND ')} ORDER BY dpr.machine_id LIMIT 1`,
    params
  );
  if (!rows.length) return res.json({ success: true, data: null });
  res.json({ success: true, data: await assembleDPR(rows[0]) });
}));

// GET /api/production/daily-report/list?from=&to=  — headers only, with key ratios
router.get('/daily-report/list', auth, asyncRoute(async (req, res) => {
  const to   = req.query.to   || new Date().toISOString().slice(0, 10);
  const from = req.query.from || to;
  const { rows } = await pool.query(
    `SELECT dpr.id, dpr.report_date, dpr.machine_id, m.name AS "machineName",
            dpr.pmc_production_mt, dpr.finish_production_mt, dpr.total_sets,
            dpr.running_minutes, dpr.down_minutes, dpr.power_units,
            dpr.total_steam_mt, dpr.status
     FROM daily_production_reports dpr
     LEFT JOIN machines m ON m.id = dpr.machine_id
     WHERE dpr.report_date BETWEEN $1 AND $2
     ORDER BY dpr.report_date DESC, dpr.machine_id`,
    [from, to]
  );
  res.json({ success: true, data: rows });
}));

// GET /api/production/daily-report/autofill?date=&machine_id=
// Pulls what other modules already captured for the date (no double entry).
router.get('/daily-report/autofill', auth, asyncRoute(async (req, res) => {
  const date = req.query.date || new Date().toISOString().slice(0, 10);

  // production from reels (if shop-floor MES used that day)
  // pmc = all reels · finish = QC-approved reels (Quality dept feed)
  const prod = await pool.query(
    `SELECT COALESCE(SUM(weight_kg),0)/1000.0 AS pmc_mt, COUNT(*) AS sets,
            COALESCE(SUM(weight_kg) FILTER (WHERE quality_status='Approved'),0)/1000.0 AS finish_mt
     FROM reels WHERE DATE(start_time) = $1
       ${req.query.machine_id ? 'AND machine_id = $2' : ''}`,
    req.query.machine_id ? [date, req.query.machine_id] : [date]
  );
  // GSM-wise from reels
  const gsm = await pool.query(
    `SELECT gsm, COUNT(*) AS sets, COALESCE(SUM(weight_kg),0)/1000.0 AS production_mt
     FROM reels WHERE DATE(start_time) = $1
       ${req.query.machine_id ? 'AND machine_id = $2' : ''}
     GROUP BY gsm ORDER BY gsm`,
    req.query.machine_id ? [date, req.query.machine_id] : [date]
  );
  // utility (power + boiler/steam) from utility_readings
  const util = await pool.query(
    `SELECT COALESCE(SUM(power_units),0) AS power_units,
            COALESCE(SUM(dg_units),0) AS dg_units,
            COALESCE(SUM(steam_generated_mt),0) AS total_steam_mt,
            COALESCE(SUM(coal_consumed_kg),0)/1000.0 AS rice_husk_mt
     FROM utility_readings WHERE date = $1`,
    [date]
  );
  // chemicals from chemical_consumption (sum per chemical)
  const chems = await pool.query(
    `SELECT m.name AS chemical_name, cc.chemical_id, COALESCE(SUM(cc.qty_consumed),0) AS qty_kg
     FROM chemical_consumption cc LEFT JOIN materials m ON m.id = cc.chemical_id
     WHERE cc.date = $1 GROUP BY m.name, cc.chemical_id ORDER BY m.name`,
    [date]
  );
  // furnish from furnish_mix_log (Raw Material / Pulp dept batches)
  const furn = await pool.query(
    `SELECT COALESCE(SUM(local_furnish_kg),0)/1000.0 AS local_mt,
            COALESCE(SUM(occ_furnish_kg),0)/1000.0 AS occ_mt,
            COALESCE(SUM(local_furnish_kg+occ_furnish_kg+other_furnish_kg),0)/1000.0 AS total_mt
     FROM furnish_mix_log WHERE report_date = $1
       ${req.query.machine_id ? 'AND machine_id = $2' : ''}`,
    req.query.machine_id ? [date, req.query.machine_id] : [date]
  );
  // downtime from downtime_entries (Production dept) — total + per-event lines
  const dt = await pool.query(
    `SELECT d.duration_min, d.category, d.reason, rc.reason_code
     FROM downtime_entries d
     LEFT JOIN downtime_reason_codes rc ON lower(rc.description) = lower(d.reason)
     WHERE DATE(d.start_time) = $1
       ${req.query.machine_id ? 'AND d.machine_id = $2' : ''}
     ORDER BY d.start_time`,
    req.query.machine_id ? [date, req.query.machine_id] : [date]
  );
  const downMin = dt.rows.reduce((a, r) => a + Number(r.duration_min || 0), 0);
  const runMin = Math.max(0, 1440 - downMin);  // 24h day − downtime (breaks netted by user)

  res.json({
    success: true,
    data: {
      pmc_production_mt: r3(prod.rows[0].pmc_mt),
      finish_production_mt: r3(prod.rows[0].finish_mt),
      total_sets: Number(prod.rows[0].sets),
      running_minutes: runMin,
      down_minutes: downMin,
      gsm_breakup: gsm.rows.map(g => ({ gsm: Number(g.gsm), sets: Number(g.sets), production_mt: r3(g.production_mt) })),
      power_units: r3(util.rows[0].power_units, 2),
      dg_units: r3(util.rows[0].dg_units, 2),
      total_steam_mt: r3(util.rows[0].total_steam_mt),
      rice_husk_mt: r3(util.rows[0].rice_husk_mt),
      furnish_local_mt: r3(furn.rows[0].local_mt),
      furnish_occ_mt: r3(furn.rows[0].occ_mt),
      furnish_total_mt: r3(furn.rows[0].total_mt),
      chemicals: chems.rows.map(c => ({ chemical_name: c.chemical_name, chemical_id: c.chemical_id, qty_kg: Number(c.qty_kg) })),
      downtime: dt.rows.map(d => ({ minutes: Number(d.duration_min || 0), reason: d.reason, reason_code: d.reason_code || null, shift: d.category || null })),
    },
  });
}));

// GET /api/production/downtime-reason-codes — coded downtime master (dropdown)
router.get('/downtime-reason-codes', auth, asyncRoute(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT id, reason_code, category, subcategory, component, description, is_breakdown, severity, typical_minutes
     FROM downtime_reason_codes WHERE is_active=true ORDER BY category, reason_code`
  );
  res.json({ success: true, data: rows });
}));

// GET /api/production/furnish?date=&machine_id= — furnish batches for a day
router.get('/furnish', auth, asyncRoute(async (req, res) => {
  const date = req.query.date || new Date().toISOString().slice(0, 10);
  const params = [date]; let where = 'report_date = $1';
  if (req.query.machine_id) { where += ' AND machine_id = $2'; params.push(req.query.machine_id); }
  const { rows } = await pool.query(
    `SELECT f.*, m.name AS "machineName", u.name AS "preparedByName"
     FROM furnish_mix_log f
     LEFT JOIN machines m ON m.id=f.machine_id
     LEFT JOIN users u ON u.id=f.prepared_by
     WHERE ${where} ORDER BY f.created_at`, params
  );
  const tot = rows.reduce((a, r) => ({
    local: a.local + Number(r.local_furnish_kg || 0),
    occ:   a.occ   + Number(r.occ_furnish_kg || 0),
    other: a.other + Number(r.other_furnish_kg || 0),
  }), { local: 0, occ: 0, other: 0 });
  res.json({ success: true, data: rows, summary: { local_mt: r3(tot.local / 1000), occ_mt: r3(tot.occ / 1000), total_mt: r3((tot.local + tot.occ + tot.other) / 1000) } });
}));

// POST /api/production/furnish — log a furnish batch (Raw Material / Pulp dept)
router.post('/furnish', auth, requireLevel(1), asyncRoute(async (req, res) => {
  const b = req.body || {};
  if (!b.report_date) return res.status(400).json({ success: false, message: 'report_date required' });
  const batch = b.batch_number || `FURN-${String(b.report_date).replace(/-/g, '')}-${Date.now().toString().slice(-4)}`;
  const { rows } = await pool.query(
    `INSERT INTO furnish_mix_log
       (batch_number, report_date, machine_id, shift_type, local_furnish_kg, occ_furnish_kg, other_furnish_kg,
        local_lot, occ_lot, local_moisture, occ_moisture, prepared_by, remarks)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
    [batch, b.report_date, b.machine_id || null, b.shift_type || null,
     b.local_furnish_kg || 0, b.occ_furnish_kg || 0, b.other_furnish_kg || 0,
     b.local_lot || null, b.occ_lot || null, b.local_moisture || null, b.occ_moisture || null,
     req.user.id, b.remarks || null]
  );
  res.status(201).json({ success: true, data: rows[0] });
}));

// POST /api/production/daily-report  — create/update full report (header + children), ACID
router.post('/daily-report', auth, requireLevel(1), asyncRoute(async (req, res) => {
  const b = req.body || {};
  if (!b.report_date) return res.status(400).json({ success: false, message: 'report_date required' });

  // Data-safety guards: never let an empty/auto-fill silently wipe a populated or approved report.
  const existing = await pool.query(
    `SELECT pmc_production_mt, status FROM daily_production_reports
     WHERE report_date=$1 AND machine_id IS NOT DISTINCT FROM $2`,
    [b.report_date, b.machine_id || null]
  );
  if (existing.rows.length) {
    const ex = existing.rows[0];
    if (ex.status === 'Approved' && !b.force)
      return res.status(409).json({ success: false, message: 'Report is Approved and immutable. Pass force=true to override.' });
    if (Number(ex.pmc_production_mt) > 0 && Number(b.pmc_production_mt || 0) <= 0 && !b.force)
      return res.status(409).json({ success: false, message: 'Refusing to overwrite a populated report with empty data (no shop-floor transactions found for this date). Pass force=true to override.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `INSERT INTO daily_production_reports
         (report_date, machine_id, pmc_production_mt, finish_production_mt, total_sets,
          running_minutes, down_minutes, furnish_local_mt, furnish_occ_mt, furnish_total_mt,
          power_units, dg_units, rice_husk_mt, total_steam_mt, status, remarks, created_by, updated_at,
          start_time, end_time, gsm_raw, bf_raw, draw_avg, machine_speed_avg, moisture_pct_avg,
          prv_pressure_temp, pulper_running_minutes, pulper_units, etp_inlet_ppm, etp_outlet_ppm,
          etp_inlet_flow, etp_outlet_flow, fresh_water_mt, feed_water_mt, condensate_water_mt)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,now(),
               $18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34)
       ON CONFLICT (report_date, machine_id) DO UPDATE SET
         pmc_production_mt=EXCLUDED.pmc_production_mt, finish_production_mt=EXCLUDED.finish_production_mt,
         total_sets=EXCLUDED.total_sets, running_minutes=EXCLUDED.running_minutes, down_minutes=EXCLUDED.down_minutes,
         furnish_local_mt=EXCLUDED.furnish_local_mt, furnish_occ_mt=EXCLUDED.furnish_occ_mt, furnish_total_mt=EXCLUDED.furnish_total_mt,
         power_units=EXCLUDED.power_units, dg_units=EXCLUDED.dg_units, rice_husk_mt=EXCLUDED.rice_husk_mt,
         total_steam_mt=EXCLUDED.total_steam_mt, status=EXCLUDED.status, remarks=EXCLUDED.remarks, updated_at=now(),
         start_time=EXCLUDED.start_time, end_time=EXCLUDED.end_time, gsm_raw=EXCLUDED.gsm_raw, bf_raw=EXCLUDED.bf_raw,
         draw_avg=EXCLUDED.draw_avg, machine_speed_avg=EXCLUDED.machine_speed_avg, moisture_pct_avg=EXCLUDED.moisture_pct_avg,
         prv_pressure_temp=EXCLUDED.prv_pressure_temp, pulper_running_minutes=EXCLUDED.pulper_running_minutes, pulper_units=EXCLUDED.pulper_units,
         etp_inlet_ppm=EXCLUDED.etp_inlet_ppm, etp_outlet_ppm=EXCLUDED.etp_outlet_ppm, etp_inlet_flow=EXCLUDED.etp_inlet_flow,
         etp_outlet_flow=EXCLUDED.etp_outlet_flow, fresh_water_mt=EXCLUDED.fresh_water_mt, feed_water_mt=EXCLUDED.feed_water_mt,
         condensate_water_mt=EXCLUDED.condensate_water_mt
       RETURNING *`,
      [b.report_date, b.machine_id || null, b.pmc_production_mt || 0, b.finish_production_mt || 0, b.total_sets || 0,
       b.running_minutes || 0, b.down_minutes || 0, b.furnish_local_mt || 0, b.furnish_occ_mt || 0, Number(b.furnish_local_mt || 0) + Number(b.furnish_occ_mt || 0),
       b.power_units || 0, b.dg_units || 0, b.rice_husk_mt || 0, b.total_steam_mt || 0, b.status || 'Draft', b.remarks || null, req.user.id,
       b.start_time || null, b.end_time || null, b.gsm_raw || null, b.bf_raw || null, b.draw_avg || 0, b.machine_speed_avg || 0, b.moisture_pct_avg || 0,
       b.prv_pressure_temp || null, b.pulper_running_minutes || 0, b.pulper_units || 0, b.etp_inlet_ppm || 0, b.etp_outlet_ppm || 0,
       b.etp_inlet_flow || 0, b.etp_outlet_flow || 0, b.fresh_water_mt || 0, b.feed_water_mt || 0, b.condensate_water_mt || 0]
    );
    const header = rows[0];

    // replace children
    await client.query('DELETE FROM dpr_gsm_breakup WHERE report_id=$1', [header.id]);
    await client.query('DELETE FROM dpr_chemical_lines WHERE report_id=$1', [header.id]);
    await client.query('DELETE FROM dpr_downtime_lines WHERE report_id=$1', [header.id]);

    for (const [i, g] of (b.gsm_breakup || []).entries())
      await client.query(
        `INSERT INTO dpr_gsm_breakup (report_id, gsm, bf, sets, production_mt, sort_order) VALUES ($1,$2,$3,$4,$5,$6)`,
        [header.id, g.gsm, g.bf ?? null, g.sets || 0, g.production_mt || 0, i]
      );
    for (const [i, c] of (b.chemicals || []).entries())
      await client.query(
        `INSERT INTO dpr_chemical_lines (report_id, chemical_name, chemical_id, qty_kg, sort_order) VALUES ($1,$2,$3,$4,$5)`,
        [header.id, c.chemical_name, c.chemical_id ?? null, c.qty_kg || 0, i]
      );
    for (const [i, d] of (b.downtime || []).entries())
      await client.query(
        `INSERT INTO dpr_downtime_lines (report_id, shift, minutes, reason, sort_order) VALUES ($1,$2,$3,$4,$5)`,
        [header.id, d.shift || null, d.minutes || 0, d.reason || null, i]
      );

    await auditLog(client, { userId: req.user.id, action: 'UPSERT', module: 'production', recordId: header.id, newData: { report_date: header.report_date }, ip: req.ip });
    await checkChemicalAlerts(header.id, client);
    await client.query('COMMIT');

    // Prometheus gauge — latest PM/C production (feeds Grafana)
    try { metrics.dprProduction.set({ machine: String(header.machine_id || 'all') }, Number(header.pmc_production_mt) || 0); } catch (_) {}
    // Kafka event — fire-and-forget, never blocks / breaks the response
    kafka.publish(kafka.TOPICS.DPR, header.report_date, {
      event: 'dpr.saved', report_id: header.id, report_date: header.report_date,
      machine_id: header.machine_id, pmc_production_mt: Number(header.pmc_production_mt),
      status: header.status, by: req.user.id, at: new Date().toISOString(),
    });

    res.json({ success: true, data: await assembleDPR(header) });
  } catch (e) { await client.query('ROLLBACK'); throw e; }
  finally { client.release(); }
}));

// PUT /api/production/daily-report/:id/approve — L3+ sign-off
router.put('/daily-report/:id/approve', auth, requireLevel(3), asyncRoute(async (req, res) => {
  const { rows } = await pool.query(
    `UPDATE daily_production_reports SET status='Approved', approved_by=$1, updated_at=now()
     WHERE id=$2 AND status<>'Approved' RETURNING id`,
    [req.user.id, req.params.id]
  );
  res.json({ success: !!rows.length, message: rows.length ? 'Approved' : 'Not found or already approved' });
}));

// Helper: Check chemical consumption limits against grade standard targets
async function checkChemicalAlerts(reportId, client) {
  try {
    const { rows: rRows } = await client.query(
      `SELECT report_date, pmc_production_mt, gsm_raw, bf_raw FROM daily_production_reports WHERE id = $1`,
      [reportId]
    );
    if (!rRows.length) return;
    const rep = rRows[0];
    const pmc = parseFloat(rep.pmc_production_mt) || 0;
    if (pmc <= 0) return;

    // Resolve grade standard. Splitting GSM string to grab first run grade (e.g. '120/140' -> '120')
    const grade = (rep.gsm_raw && rep.bf_raw) ? `${rep.gsm_raw.split('/')[0]}/${rep.bf_raw.split('/')[0]}` : 'DEFAULT';
    let { rows: stdRows } = await client.query(
      `SELECT * FROM dpr_grade_standards WHERE grade_code = $1`, [grade]
    );
    if (!stdRows.length) {
      const fb = await client.query(`SELECT * FROM dpr_grade_standards WHERE grade_code = 'DEFAULT'`);
      stdRows = fb.rows;
    }
    if (!stdRows.length) return;
    const std = stdRows[0];

    // Fetch chemical line items
    const { rows: chemRows } = await client.query(
      `SELECT id, chemical_name, chemical_id, qty_kg FROM dpr_chemical_lines WHERE report_id = $1`,
      [reportId]
    );

    for (const c of chemRows) {
      const name = (c.chemical_name || '').toLowerCase();
      let stdLimit = 0;
      if (name.includes('starch'))      stdLimit = parseFloat(std.starch_kg_per_ton);
      else if (name.includes('pac'))    stdLimit = parseFloat(std.pac_kg_per_ton);
      else if (name.includes('size'))   stdLimit = parseFloat(std.surface_size_kg_per_ton);
      else if (name.includes('coag'))   stdLimit = parseFloat(std.coagulant_kg_per_ton);
      else if (name.includes('deform')) stdLimit = parseFloat(std.deformer_kg_per_ton);
      else if (name.includes('retent')) stdLimit = parseFloat(std.retention_kg_per_ton);

      if (stdLimit <= 0) continue;

      const actualRatio = parseFloat(c.qty_kg) / pmc;

      // Log alert if actual ratio breaches standard target by > 10%
      if (actualRatio > stdLimit * 1.10) {
        await client.query(
          `INSERT INTO chemical_limit_alerts (alert_date, chemical_id, actual_ratio, standard_ratio)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT DO NOTHING`,
          [rep.report_date, c.chemical_id || null, actualRatio, stdLimit]
        );

        // Broadcast critical alarm via Kafka topic events.critical
        kafka.publish(kafka.TOPICS.EVENTS_CRIT, `chem-alert-${reportId}-${c.id}`, {
          eventType: 'chemical_breach',
          severity: 'Critical',
          reportId,
          date: rep.report_date,
          chemical: c.chemical_name,
          actualRatio: Number(actualRatio.toFixed(3)),
          standardLimit: stdLimit,
          excessPct: Number((((actualRatio - stdLimit) / stdLimit) * 100).toFixed(1)),
          description: `ALERT: ${c.chemical_name} consumption ratio is ${actualRatio.toFixed(3)} kg/Ton, which exceeds standard target of ${stdLimit} kg/Ton by >10%.`
        });
      }
    }
  } catch (err) {
    console.error('checkChemicalAlerts error:', err.message);
  }
}

module.exports = router;
