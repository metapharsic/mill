const router = require('express').Router();
const pool = require('../db/pool');
const { auth, requireLevel, requireStore } = require('../middleware/auth');
const { publish, TOPICS } = require('../kafka');
const ar = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// Best-effort machine -> department lookup (machines has no direct section/department FK;
// section_equipment.machine_id -> plant_sections.department_id is the only mapping available).
// Fails OPEN (returns null = "unknown, allow") when no mapping exists, since most machines
// are not yet linked via section_equipment — a fail-closed check would block nearly everyone.
async function machineDeptId(machineId) {
  if (!machineId) return null;
  const { rows } = await pool.query(
    `SELECT ps.department_id FROM section_equipment se
     JOIN plant_sections ps ON ps.id = se.section_id
     WHERE se.machine_id = $1 AND ps.department_id IS NOT NULL
     LIMIT 1`,
    [machineId]
  );
  return rows.length ? rows[0].department_id : null;
}
async function checkMachineOwnership(req, res, machineId) {
  if ((req.user.role_level || 0) >= 4) return true;
  const deptId = await machineDeptId(machineId);
  if (deptId !== null && deptId !== req.user.department_id) {
    res.status(403).json({ success: false, message: 'Not authorized for this machine\'s section' });
    return false;
  }
  return true;
}
// Equipment -> section -> department ownership check (equipment.section_id -> sections.department_id)
async function checkEquipmentOwnership(req, res, equipmentId) {
  if ((req.user.role_level || 0) >= 4) return true;
  const { rows } = await pool.query(
    `SELECT s.department_id FROM equipment eq LEFT JOIN sections s ON s.id = eq.section_id WHERE eq.id=$1`,
    [equipmentId]
  );
  if (!rows.length) {
    res.status(404).json({ success: false, message: 'Equipment not found' });
    return false;
  }
  if (rows[0].department_id !== req.user.department_id) {
    res.status(403).json({ success: false, message: 'Not authorized for this equipment\'s section' });
    return false;
  }
  return true;
}
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const XLSX = require('xlsx');

// ─── Scan/photo upload for a bearing-check round (same disk-storage pattern as hr.js /upload) ──
const SCAN_DIR = path.join(__dirname, '../../uploads/maintenance');
if (!fs.existsSync(SCAN_DIR)) fs.mkdirSync(SCAN_DIR, { recursive: true });
const scanStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, SCAN_DIR),
  filename: (_req, file, cb) => cb(null, `${Date.now()}_${file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, '_')}`),
});
const scanUpload = multer({
  storage: scanStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = /jpg|jpeg|png|pdf/.test(file.originalname.toLowerCase());
    cb(ok ? null : new Error('Only jpg/png/pdf allowed'), ok);
  },
});
// Excel import upload (memory, not disk — parsed then discarded)
const xlsxUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// SCHEDULE LIST
router.get('/schedule', auth, ar(async (req, res) => {
  const { machine_id, status, page=1, limit=20 } = req.query;
  const conds=[]; const params=[]; let p=1;
  if (machine_id) { conds.push(`ms.machine_id=$${p++}`); params.push(machine_id); }
  if (status)     { conds.push(`ms.status=$${p++}`); params.push(status); }
  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
  const offset = (parseInt(page)-1)*parseInt(limit);
  const { rows } = await pool.query(
    `SELECT ms.id, ms.maintenance_type as "maintenanceType", ms.title,
            ms.frequency_days as "frequencyDays", ms.last_done as "lastDone",
            ms.next_due as "nextDue", ms.estimated_hours as "estimatedHours",
            ms.status, ms.machine_id, ms.position_id, ms.materials_needed, ms.priority,
            m.name as "machineName", ms.assigned_to, u.name as "assignedTo"
     FROM maintenance_schedule ms
     LEFT JOIN machines m ON m.id=ms.machine_id
     LEFT JOIN users u ON u.id=ms.assigned_to
     ${where} ORDER BY ms.next_due ASC LIMIT $${p} OFFSET $${p+1}`,
    [...params, parseInt(limit), offset]
  );
  const { rows: cnt } = await pool.query(`SELECT COUNT(*) FROM maintenance_schedule ms ${where}`, params);
  res.json({ success:true, data:rows, total:parseInt(cnt[0].count) });
}));

// CREATE SCHEDULE
router.post('/schedule', auth, requireLevel(3), ar(async (req, res) => {
  const { machine_id, maintenance_type, title, frequency_days, next_due, estimated_hours, assigned_to, position_id, materials_needed, priority } = req.body;
  if (!machine_id || !title) return res.json({ success:false, message:'Machine + title required' });
  if (!(await checkMachineOwnership(req, res, machine_id))) return;
  const { rows } = await pool.query(
    `INSERT INTO maintenance_schedule (machine_id,maintenance_type,title,frequency_days,next_due,estimated_hours,assigned_to,status,position_id,materials_needed,priority)
     VALUES ($1,$2,$3,$4,$5,$6,$7,'Scheduled',$8,$9,$10) RETURNING *`,
    [machine_id, maintenance_type||'Preventive', title, frequency_days||null, next_due||null, estimated_hours||null, assigned_to||null, position_id||null, materials_needed||null, priority||'Medium']
  );
  publish(TOPICS.EVENTS_ALL, `schedule-${rows[0].id}`, { event: 'maintenance.schedule.created', id: rows[0].id, title, userId: req.user.id, timestamp: new Date() });
  res.json({ success:true, data:rows[0] });
}));

// UPDATE SCHEDULE
router.put('/schedule/:id', auth, requireLevel(3), ar(async (req, res) => {
  const { title, maintenance_type, frequency_days, next_due, estimated_hours, assigned_to, status, position_id, materials_needed, priority } = req.body;
  const { rows: existing } = await pool.query('SELECT machine_id FROM maintenance_schedule WHERE id=$1', [req.params.id]);
  if (!existing.length) return res.status(404).json({ success:false, message:'Schedule not found' });
  if (!(await checkMachineOwnership(req, res, existing[0].machine_id))) return;
  const { rows } = await pool.query(
    `UPDATE maintenance_schedule SET title=$1,maintenance_type=$2,frequency_days=$3,
       next_due=$4,estimated_hours=$5,assigned_to=$6,status=$7,position_id=$8,materials_needed=$9,priority=$10
     WHERE id=$11 RETURNING *`,
    [title, maintenance_type||'Preventive', frequency_days||null, next_due||null,
     estimated_hours||null, assigned_to||null, status||'Scheduled', position_id||null, materials_needed||null, priority||'Medium', req.params.id]
  );
  if (rows.length) publish(TOPICS.EVENTS_ALL, `schedule-${rows[0].id}`, { event: 'maintenance.schedule.updated', id: rows[0].id, title: rows[0].title, userId: req.user.id, timestamp: new Date() });
  res.json({ success:!!rows.length, data:rows[0] });
}));

// COMPLETE SCHEDULE — marks done, pushes next_due, creates log entry
router.put('/schedule/:id/complete', auth, requireLevel(2), ar(async (req, res) => {
  const { done_date, work_done, cost, spare_parts_used = [] } = req.body;
  const completedDate = done_date || new Date().toISOString().slice(0, 10);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: sched } = await client.query(
      'SELECT * FROM maintenance_schedule WHERE id=$1 FOR UPDATE', [req.params.id]
    );
    if (!sched.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Schedule not found' });
    }
    const s = sched[0];
    const freq = Number(s.frequency_days) || 30;
    const nextDue = new Date(completedDate);
    nextDue.setDate(nextDue.getDate() + freq);
    const nextDueStr = nextDue.toISOString().slice(0, 10);
    await client.query(
      `UPDATE maintenance_schedule SET last_done=$1, next_due=$2, status='Scheduled' WHERE id=$3`,
      [completedDate, nextDueStr, s.id]
    );
    const { rows: log } = await client.query(
      `INSERT INTO maintenance_logs
         (schedule_id,machine_id,date,maintenance_type,description,work_done,spare_parts_used,cost,performed_by,status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'Completed') RETURNING *`,
      [s.id, s.machine_id, completedDate, s.maintenance_type, s.title,
       work_done || null, JSON.stringify(spare_parts_used), cost || null, req.user.id]
    );
    await client.query('COMMIT');
    res.json({ success: true, data: { ...s, last_done: completedDate, next_due: nextDueStr }, log: log[0] });
  } catch (e) { await client.query('ROLLBACK'); throw e; }
  finally { client.release(); }
}));

// SKIP SCHEDULE — skips this occurrence, pushes next_due by frequency_days
router.put('/schedule/:id/skip', auth, requireLevel(3), ar(async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: sched } = await client.query(
      'SELECT * FROM maintenance_schedule WHERE id=$1 FOR UPDATE', [req.params.id]
    );
    if (!sched.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Schedule not found' });
    }
    const s = sched[0];
    const freq = Number(s.frequency_days) || 30;
    const base = s.next_due ? new Date(s.next_due) : new Date();
    base.setDate(base.getDate() + freq);
    const newNextDue = base.toISOString().slice(0, 10);
    const { rows } = await client.query(
      `UPDATE maintenance_schedule SET next_due=$1 WHERE id=$2 RETURNING *`,
      [newNextDue, s.id]
    );
    await client.query('COMMIT');
    res.json({ success: true, data: rows[0], skippedTo: newNextDue });
  } catch (e) { await client.query('ROLLBACK'); throw e; }
  finally { client.release(); }
}));

// COST PER MACHINE/SECTION — real spend, computed from indent_items linked to a
// maintenance_log via indent_items.maintenance_log_id (migration_maintenance_spares_link.sql),
// since maintenance_logs.cost is always NULL in live data (nothing ever wrote it back from Store).
router.get('/cost-by-machine', auth, ar(async (req, res) => {
  const { machine_id, from, to } = req.query;
  const conds = [];
  const params = [];
  let p = 1;
  if (machine_id) { conds.push(`ml.machine_id=$${p++}`); params.push(machine_id); }
  if (from && to) { conds.push(`ml.date BETWEEN $${p++} AND $${p++}`); params.push(from, to); }
  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
  const { rows } = await pool.query(
    `SELECT ml.machine_id, m.name AS "machineName", m.code AS "machineCode",
            ps.id AS "sectionId", ps.name AS "sectionName",
            COUNT(DISTINCT ml.id) AS "jobCount",
            COALESCE(SUM(ii.line_value), 0) AS "sparesCost",
            COALESCE(SUM(ml.cost), 0) AS "loggedCost",
            COALESCE(SUM(ii.line_value), 0) + COALESCE(SUM(ml.cost), 0) AS "totalCost"
     FROM maintenance_logs ml
     LEFT JOIN machines m ON m.id = ml.machine_id
     LEFT JOIN section_equipment se ON se.machine_id = ml.machine_id
     LEFT JOIN plant_sections ps ON ps.id = se.section_id
     LEFT JOIN indent_items ii ON ii.maintenance_log_id = ml.id
     ${where}
     GROUP BY ml.machine_id, m.name, m.code, ps.id, ps.name
     ORDER BY "totalCost" DESC`,
    params
  );
  res.json({ success: true, data: rows });
}));

// COST FOR A SINGLE MAINTENANCE LOG — spares actually consumed for this job via linked indent_items
router.get('/logs/:id/cost', auth, ar(async (req, res) => {
  const { rows: [log] } = await pool.query(`SELECT id, machine_id, cost FROM maintenance_logs WHERE id=$1`, [req.params.id]);
  if (!log) return res.status(404).json({ success: false, message: 'Log not found' });
  const { rows: items } = await pool.query(
    `SELECT ii.id, ii.indent_id, i.indent_number AS "indentNumber", ii.material_id,
            m.name AS "materialName", ii.required_qty, ii.issued_qty, ii.unit_price, ii.line_value
     FROM indent_items ii
     JOIN indents i ON i.id = ii.indent_id
     LEFT JOIN materials m ON m.id = ii.material_id
     WHERE ii.maintenance_log_id = $1
     ORDER BY ii.id`,
    [req.params.id]
  );
  const sparesCost = items.reduce((sum, it) => sum + parseFloat(it.line_value || 0), 0);
  res.json({ success: true, data: { logId: log.id, machineId: log.machine_id, loggedCost: parseFloat(log.cost || 0), sparesCost, totalCost: sparesCost + parseFloat(log.cost || 0), items } });
}));

// LOGS LIST
router.get('/logs', auth, ar(async (req, res) => {
  const { machine_id, maintenance_type, page=1, limit=20 } = req.query;
  const conds=[]; const params=[]; let p=1;
  if (machine_id)       { conds.push(`ml.machine_id=$${p++}`); params.push(machine_id); }
  if (maintenance_type) { conds.push(`ml.maintenance_type=$${p++}`); params.push(maintenance_type); }
  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
  const offset = (parseInt(page)-1)*parseInt(limit);
  const { rows } = await pool.query(
    `SELECT ml.id, ml.date, ml.maintenance_type as "maintenanceType",
            ml.description, ml.work_done as "workDone", ml.duration_hours as "durationHours",
            ml.cost, ml.status, ml.spare_parts_used as "sparePartsUsed",
            m.name as "machineName", u.name as "performedBy"
     FROM maintenance_logs ml
     LEFT JOIN machines m ON m.id=ml.machine_id
     LEFT JOIN users u ON u.id=ml.performed_by
     ${where} ORDER BY ml.date DESC LIMIT $${p} OFFSET $${p+1}`,
    [...params, parseInt(limit), offset]
  );
  const { rows: cnt } = await pool.query(`SELECT COUNT(*) FROM maintenance_logs ml ${where}`, params);
  res.json({ success:true, data:rows, total:parseInt(cnt[0].count) });
}));

// LOG MAINTENANCE
router.post('/logs', auth, requireLevel(2), ar(async (req, res) => {
  const {
    schedule_id, machine_id, date, maintenance_type, description,
    work_done, spare_parts_used=[], start_time, end_time, cost, performed_by
  } = req.body;
  if (!machine_id || !date) return res.json({ success:false, message:'Machine + date required' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    let hours = null;
    if (start_time && end_time) {
      hours = (new Date(end_time) - new Date(start_time)) / 3600000;
    }
    const { rows } = await client.query(
      `INSERT INTO maintenance_logs
         (schedule_id,machine_id,date,maintenance_type,description,work_done,
          spare_parts_used,start_time,end_time,duration_hours,cost,performed_by,status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'Completed') RETURNING *`,
      [schedule_id||null,machine_id,date,maintenance_type||'Preventive',description||null,
       work_done||null,JSON.stringify(spare_parts_used),start_time||null,end_time||null,
       hours,cost||null,performed_by||req.user.id]
    );
    if (schedule_id) {
      const nextDue = new Date(date);
      nextDue.setDate(nextDue.getDate() + (req.body.frequency_days || 30));
      await client.query(
        `UPDATE maintenance_schedule SET last_done=$1, next_due=$2, status='Scheduled' WHERE id=$3`,
        [date, nextDue.toISOString().slice(0,10), schedule_id]
      );
    }
    await client.query('COMMIT');
    publish(TOPICS.EVENTS_ALL, `log-${rows[0].id}`, { event: 'maintenance.log.created', id: rows[0].id, machine_id, userId: req.user.id, timestamp: new Date() });
    res.json({ success:true, data:rows[0] });
  } catch(e) { await client.query('ROLLBACK'); throw e; }
  finally { client.release(); }
}));

// COMPLETE LOG — close an In Progress log, update schedule if linked
router.put('/logs/:id/complete', auth, requireLevel(2), ar(async (req, res) => {
  const { work_done, end_time, cost, spare_parts_used } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: old } = await client.query(
      'SELECT * FROM maintenance_logs WHERE id=$1 FOR UPDATE', [req.params.id]
    );
    if (!old.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Log not found' });
    }
    const log = old[0];
    const endTs = end_time || new Date().toISOString();
    let hours = log.duration_hours;
    if (log.start_time && !hours) {
      hours = (new Date(endTs) - new Date(log.start_time)) / 3600000;
    }
    const { rows } = await client.query(
      `UPDATE maintenance_logs
         SET status='Completed', end_time=$1, duration_hours=$2,
             work_done=COALESCE($3,work_done), cost=COALESCE($4,cost),
             spare_parts_used=COALESCE($5,spare_parts_used)
       WHERE id=$6 RETURNING *`,
      [endTs, hours, work_done || null, cost || null,
       spare_parts_used ? JSON.stringify(spare_parts_used) : null, log.id]
    );
    if (log.schedule_id) {
      const { rows: sched } = await client.query(
        'SELECT frequency_days FROM maintenance_schedule WHERE id=$1', [log.schedule_id]
      );
      if (sched.length) {
        const freq = Number(sched[0].frequency_days) || 30;
        const base = new Date(log.date);
        base.setDate(base.getDate() + freq);
        await client.query(
          `UPDATE maintenance_schedule SET last_done=$1, next_due=$2, status='Scheduled' WHERE id=$3`,
          [log.date, base.toISOString().slice(0, 10), log.schedule_id]
        );
      }
    }
    await client.query('COMMIT');
    res.json({ success: true, data: rows[0] });
  } catch (e) { await client.query('ROLLBACK'); throw e; }
  finally { client.release(); }
}));

// BREAKDOWN (log + downtime in ACID)
router.post('/breakdown', auth, requireLevel(1), ar(async (req, res) => {
  const { machine_id, shift_id, description, start_time } = req.body;
  if (!machine_id) return res.json({ success:false, message:'Machine required' });
  if (!(await checkMachineOwnership(req, res, machine_id))) return;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: log } = await client.query(
      `INSERT INTO maintenance_logs (machine_id,date,maintenance_type,description,start_time,status,performed_by)
       VALUES ($1,NOW(),'Breakdown',$2,$3,'In Progress',$4) RETURNING *`,
      [machine_id, description||null, start_time||null, req.user.id]
    );
    await client.query(
      `INSERT INTO downtime_entries (machine_id,shift_id,start_time,category,reason,reported_by)
       VALUES ($1,$2,$3,'Mechanical',$4,$5)`,
      [machine_id, shift_id||null, start_time||new Date(), description||'Breakdown', req.user.id]
    );

    await client.query('COMMIT');
    publish(TOPICS.EVENTS_CRIT, `machine-${machine_id}`, { event: 'maintenance.breakdown', machine_id, description, userId: req.user.id, timestamp: new Date() });
    res.json({ success:true, data:log[0] });
  } catch(e) { await client.query('ROLLBACK'); throw e; }
  finally { client.release(); }
}));

// ── EQUIPMENT ─────────────────────────────────────────────────────────────────
router.get('/equipment', auth, ar(async (req, res) => {
  const canSeeAll = (req.user.role_level || 0) >= 4;
  const conds = [];
  const params = [];
  if (!canSeeAll) { conds.push(`s.department_id=$1`); params.push(req.user.department_id); }
  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
  const { rows } = await pool.query(
    `SELECT eq.*, s.name as "sectionName"
     FROM equipment eq
     LEFT JOIN sections s ON s.id=eq.section_id
     ${where}
     ORDER BY eq.name`,
    params
  );
  res.json({ success: true, data: rows });
}));

router.post('/equipment', auth, requireLevel(3), ar(async (req, res) => {
  const { name, code, type, section_id, hp, amps } = req.body;
  if (!name || !code || !type) return res.status(400).json({ success: false, message: 'name, code, type required' });
  if ((req.user.role_level || 0) < 4) {
    const { rows: sec } = await pool.query('SELECT department_id FROM sections WHERE id=$1', [section_id]);
    if (!sec.length || sec[0].department_id !== req.user.department_id) {
      return res.status(403).json({ success: false, message: 'Not authorized for this section' });
    }
  }
  const { rows } = await pool.query(
    `INSERT INTO equipment (name, code, type, section_id, hp, amps)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [name, code, type, section_id || null, hp || null, amps || null]
  );
  publish(TOPICS.EVENTS_ALL, `equipment-${rows[0].id}`, { event: 'equipment.created', id: rows[0].id, name, userId: req.user.id, timestamp: new Date() });
  res.status(201).json({ success: true, data: rows[0] });
}));

router.put('/equipment/:id', auth, requireLevel(3), ar(async (req, res) => {
  const { name, code, type, section_id, hp, amps, is_active } = req.body;
  if (!(await checkEquipmentOwnership(req, res, req.params.id))) return;
  const { rows } = await pool.query(
    `UPDATE equipment SET name=COALESCE($1, name), code=COALESCE($2, code), type=COALESCE($3, type),
                          section_id=COALESCE($4, section_id), hp=COALESCE($5, hp), amps=COALESCE($6, amps),
                          is_active=COALESCE($7, is_active)
     WHERE id=$8 RETURNING *`,
    [name, code, type, section_id, hp, amps, is_active, req.params.id]
  );
  if (rows.length) publish(TOPICS.EVENTS_ALL, `equipment-${rows[0].id}`, { event: 'equipment.updated', id: rows[0].id, name: rows[0].name, userId: req.user.id, timestamp: new Date() });
  res.json({ success: !!rows.length, data: rows[0] });
}));

router.delete('/equipment/:id', auth, requireLevel(3), ar(async (req, res) => {
  if (!(await checkEquipmentOwnership(req, res, req.params.id))) return;
  await pool.query('UPDATE equipment SET is_active=false WHERE id=$1', [req.params.id]);
  res.json({ success: true });
}));

// ── EQUIPMENT INSPECTION ──────────────────────────────────────────────────────
router.get('/inspections', auth, ar(async (req, res) => {
  const canSeeAll = (req.user.role_level || 0) >= 4;
  const conds = [];
  const params = [];
  if (!canSeeAll) { conds.push(`s.department_id=$1`); params.push(req.user.department_id); }
  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
  const { rows } = await pool.query(
    `SELECT ei.*, eq.name as "equipmentName", eq.code as "equipmentCode", u.name as "inspectorName"
     FROM equipment_inspection ei
     LEFT JOIN equipment eq ON eq.id=ei.equipment_id
     LEFT JOIN sections s ON s.id=eq.section_id
     ${where}
     ORDER BY ei.check_date DESC`,
    params
  );
  res.json({ success: true, data: rows });
}));

router.post('/inspections', auth, requireLevel(1), ar(async (req, res) => {
  const { equipment_id, status, check_date, next_check_date, remarks } = req.body;
  if (!equipment_id) return res.status(400).json({ success: false, message: 'equipment_id required' });
  if (!(await checkEquipmentOwnership(req, res, equipment_id))) return;
  const { rows } = await pool.query(
    `INSERT INTO equipment_inspection (equipment_id, inspector_id, status, check_date, next_check_date, remarks)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [equipment_id, req.user.id, status || 'Normal', check_date || new Date(), next_check_date || null, remarks || null]
  );
  res.status(201).json({ success: true, data: rows[0] });
}));

// Ph32 E3 — GRID: equipment list + last F/S,B/S reading for a section, feeds bearing-check grid form
router.get('/inspections/grid/:sectionId', auth, ar(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT e.id, e.name, e.code,
            (SELECT fs_status FROM equipment_inspection WHERE equipment_id=e.id AND fs_status IS NOT NULL ORDER BY check_date DESC LIMIT 1) AS "lastFs",
            (SELECT bs_status FROM equipment_inspection WHERE equipment_id=e.id AND bs_status IS NOT NULL ORDER BY check_date DESC LIMIT 1) AS "lastBs",
            (SELECT fs_number FROM equipment_inspection WHERE equipment_id=e.id AND fs_number IS NOT NULL ORDER BY check_date DESC LIMIT 1) AS "lastFsNumber",
            (SELECT bs_number FROM equipment_inspection WHERE equipment_id=e.id AND bs_number IS NOT NULL ORDER BY check_date DESC LIMIT 1) AS "lastBsNumber",
            (SELECT fs_temp FROM equipment_inspection WHERE equipment_id=e.id AND fs_temp IS NOT NULL ORDER BY check_date DESC LIMIT 1) AS "lastFsTemp",
            (SELECT bs_temp FROM equipment_inspection WHERE equipment_id=e.id AND bs_temp IS NOT NULL ORDER BY check_date DESC LIMIT 1) AS "lastBsTemp",
            (SELECT fs_vibration FROM equipment_inspection WHERE equipment_id=e.id AND fs_vibration IS NOT NULL ORDER BY check_date DESC LIMIT 1) AS "lastFsVibration",
            (SELECT bs_vibration FROM equipment_inspection WHERE equipment_id=e.id AND bs_vibration IS NOT NULL ORDER BY check_date DESC LIMIT 1) AS "lastBsVibration"
     FROM equipment e WHERE e.section_id=$1 AND e.is_active=true ORDER BY e.id`,
    [req.params.sectionId]
  );
  res.json({ success: true, data: rows });
}));

// Ph32 E3 — BULK SUBMIT: whole walkaround round in one call, broadcasts Critical rows to kafka
router.post('/inspections/bearing-check', auth, requireLevel(1), ar(async (req, res) => {
  const { section_id, shift, readings = [] } = req.body;
  if (!section_id || !readings.length) return res.status(400).json({ success: false, message: 'section_id + readings required' });

  const client = await pool.connect();
  const criticals = [];
  try {
    await client.query('BEGIN');
    for (const r of readings) {
      const { rows } = await client.query(
        `INSERT INTO equipment_inspection (equipment_id, inspector_id, fs_status, bs_status, fs_number, bs_number, fs_temp, bs_temp, fs_vibration, bs_vibration, shift, check_date, remarks)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,CURRENT_DATE,$12) RETURNING id, equipment_id`,
        [r.equipment_id, req.user.id, r.fs_status || null, r.bs_status || null, r.fs_number || null, r.bs_number || null, r.fs_temp || null, r.bs_temp || null, r.fs_vibration || null, r.bs_vibration || null, shift || null, r.remarks || null]
      );
      if (r.fs_status === 'Critical' || r.bs_status === 'Critical') {
        criticals.push({ equipment_id: r.equipment_id, fs_status: r.fs_status, bs_status: r.bs_status, inspection_id: rows[0].id });
      }
    }
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }

  // fire-and-forget broadcast, never blocks the response — publish() is fail-safe by design
  publish(TOPICS.EVENTS_ALL, `section-${section_id}`, {
    event: 'maintenance.bearing_check.submitted',
    section_id, shift, count: readings.length, userId: req.user.id, timestamp: new Date()
  });
  for (const c of criticals) {
    publish(TOPICS.EVENTS_CRIT, `equipment-${c.equipment_id}`, {
      event: 'maintenance.bearing_check.critical',
      ...c, section_id, userId: req.user.id, timestamp: new Date()
    });
  }

  // Ph32 E5 — critical rows also land as in-app notifications for MAINT dept heads + plant head, not just kafka
  if (criticals.length) {
    const { rows: heads } = await pool.query(`
      SELECT u.id FROM users u
        JOIN departments d ON u.department_id = d.id
        JOIN roles r ON u.role_id = r.id
      WHERE d.code = 'MAINT' AND r.level >= 3 AND u.is_active = true
      UNION
      SELECT u.id FROM users u JOIN roles r ON u.role_id = r.id
      WHERE r.level >= 4 AND u.is_active = true
    `);
    const { rows: eqRows } = await pool.query(
      `SELECT id, name FROM equipment WHERE id = ANY($1::int[])`,
      [criticals.map(c => c.equipment_id)]
    );
    const nameOf = id => eqRows.find(e => e.id === id)?.name || `equipment #${id}`;
    for (const head of heads) {
      for (const c of criticals) {
        await pool.query(`
          INSERT INTO notifications (user_id, type, title, message, ref_table, ref_id)
          VALUES ($1, 'critical', $2, $3, 'equipment_inspection', $4)
        `, [
          head.id,
          `Critical bearing: ${nameOf(c.equipment_id)}`,
          `${nameOf(c.equipment_id)} flagged Critical (${c.fs_status === 'Critical' ? 'F/S' : ''}${c.fs_status === 'Critical' && c.bs_status === 'Critical' ? '+' : ''}${c.bs_status === 'Critical' ? 'B/S' : ''}) during ${shift || ''} shift bearing check.`,
          c.inspection_id
        ]);
      }
    }
  }

  res.json({ success: true, count: readings.length, criticalCount: criticals.length });
}));

// Ph32 E6 — dashboard tile: sections with open Critical bearings + today's round coverage
router.get('/inspections/bearing-check/summary', auth, ar(async (req, res) => {
  const { rows: critical } = await pool.query(`
    SELECT s.id AS section_id, s.name AS "sectionName", s.code, COUNT(*) AS "criticalCount"
    FROM equipment_inspection ei
    JOIN equipment e ON e.id = ei.equipment_id
    JOIN sections s ON s.id = e.section_id
    WHERE ei.check_date = (SELECT MAX(check_date) FROM equipment_inspection ei2 WHERE ei2.equipment_id = ei.equipment_id)
      AND (ei.fs_status = 'Critical' OR ei.bs_status = 'Critical')
    GROUP BY s.id, s.name, s.code ORDER BY "criticalCount" DESC
  `);
  const { rows: coverage } = await pool.query(`
    SELECT s.id AS section_id, s.name AS "sectionName",
           COUNT(DISTINCT e.id) AS "totalRolls",
           COUNT(DISTINCT ei.equipment_id) FILTER (WHERE ei.check_date = CURRENT_DATE) AS "checkedToday"
    FROM sections s
    LEFT JOIN equipment e ON e.section_id = s.id AND e.is_active = true
    LEFT JOIN equipment_inspection ei ON ei.equipment_id = e.id
    GROUP BY s.id, s.name HAVING COUNT(DISTINCT e.id) > 0 ORDER BY s.name
  `);
  res.json({ success: true, data: { critical, coverage } });
}));

// ─── SCAN/PHOTO UPLOAD — attach a photo of the paper checklist (or filled printout) to a round ──
router.post('/inspections/bearing-check/scan', auth, requireLevel(1), scanUpload.single('file'), ar(async (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, message: 'No file received' });
  const { section_id, shift, check_date } = req.body;
  if (!section_id) return res.status(400).json({ success: false, message: 'section_id required' });
  const url = `/uploads/maintenance/${req.file.filename}`;
  const { rows } = await pool.query(
    `INSERT INTO inspection_round_scans (section_id, shift, check_date, file_url, original_name, uploaded_by)
     VALUES ($1,$2,COALESCE($3,CURRENT_DATE),$4,$5,$6) RETURNING *`,
    [section_id, shift || null, check_date || null, url, req.file.originalname, req.user.id]
  );
  res.json({ success: true, data: rows[0] });
}));

// GET scans for a section (list attached photos/scans per round)
router.get('/inspections/bearing-check/scans/:sectionId', auth, ar(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT s.*, u.name AS "uploadedByName" FROM inspection_round_scans s
     LEFT JOIN users u ON u.id = s.uploaded_by
     WHERE s.section_id=$1 ORDER BY s.uploaded_at DESC LIMIT 50`,
    [req.params.sectionId]
  );
  res.json({ success: true, data: rows });
}));

// ─── EXCEL EXPORT — download current grid for a section, same shape as the source machine.xlsx sheets ──
router.get('/inspections/bearing-check/export/:sectionId', auth, ar(async (req, res) => {
  const { rows: sec } = await pool.query(`SELECT name, code FROM sections WHERE id=$1`, [req.params.sectionId]);
  if (!sec.length) return res.status(404).json({ success: false, message: 'Section not found' });
  const { rows } = await pool.query(
    `SELECT e.id, e.name,
            (SELECT fs_status FROM equipment_inspection WHERE equipment_id=e.id AND fs_status IS NOT NULL ORDER BY check_date DESC LIMIT 1) AS "lastFs",
            (SELECT bs_status FROM equipment_inspection WHERE equipment_id=e.id AND bs_status IS NOT NULL ORDER BY check_date DESC LIMIT 1) AS "lastBs",
            (SELECT remarks FROM equipment_inspection WHERE equipment_id=e.id ORDER BY check_date DESC LIMIT 1) AS "lastRemarks"
     FROM equipment e WHERE e.section_id=$1 AND e.is_active=true ORDER BY e.id`,
    [req.params.sectionId]
  );

  const sheetData = [
    [`Check list ${sec[0].name}`],
    ['Sr.No', 'Section/Equepment/Rolls', 'F/S', 'B/S', 'Remarks'],
    ...rows.map((r, i) => [i + 1, r.name, r.lastFs || '', r.lastBs || '', r.lastRemarks || '']),
  ];
  const ws = XLSX.utils.aoa_to_sheet(sheetData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sec[0].code.slice(0, 31));
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${sec[0].code}_bearing_checklist.xlsx"`);
  res.send(buf);
}));

// ─── EXCEL IMPORT — upload a filled sheet, match rows by name to this section's equipment, bulk-submit ──
// Expected columns (same shape as export/source excel): Sr.No | Section/Equepment/Rolls | F/S | B/S | Remarks
router.post('/inspections/bearing-check/import/:sectionId', auth, requireLevel(1), xlsxUpload.single('file'), ar(async (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, message: 'No file received' });
  const { shift } = req.body;
  const wb = XLSX.read(req.file.buffer, { type: 'buffer' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json(ws, { header: 1 });

  const { rows: equipRows } = await pool.query(
    `SELECT id, name FROM equipment WHERE section_id=$1 AND is_active=true`, [req.params.sectionId]
  );
  const byName = new Map(equipRows.map(e => [(e.name?.trim() || '').toLowerCase(), e.id]));

  const VALID = ['Normal', 'Needs Attention', 'Critical'];
  const readings = [];
  const unmatched = [];
  // rows[0] = title, rows[1] = header, data starts rows[2]
  for (let i = 2; i < raw.length; i++) {
    const [, name, fs, bs, remarks] = raw[i] || [];
    if (!name) continue;
    const eqId = byName.get(String(name).trim().toLowerCase());
    if (!eqId) { unmatched.push(name); continue; }
    readings.push({
      equipment_id: eqId,
      fs_status: VALID.includes(fs) ? fs : 'Normal',
      bs_status: VALID.includes(bs) ? bs : 'Normal',
      remarks: remarks || null,
    });
  }

  if (!readings.length) {
    return res.status(400).json({ success: false, message: 'No matching rolls found in this section — check the "Section/Equepment/Rolls" column matches roll names exactly', unmatched });
  }

  // reuse the same bulk-submit logic as the manual grid — one transaction, kafka + notifications on Critical
  const client = await pool.connect();
  const criticals = [];
  try {
    await client.query('BEGIN');
    for (const r of readings) {
      const { rows: ins } = await client.query(
        `INSERT INTO equipment_inspection (equipment_id, inspector_id, fs_status, bs_status, shift, check_date, remarks)
         VALUES ($1,$2,$3,$4,$5,CURRENT_DATE,$6) RETURNING id, equipment_id`,
        [r.equipment_id, req.user.id, r.fs_status, r.bs_status, shift || null, r.remarks]
      );
      if (r.fs_status === 'Critical' || r.bs_status === 'Critical') {
        criticals.push({ equipment_id: r.equipment_id, fs_status: r.fs_status, bs_status: r.bs_status, inspection_id: ins[0].id });
      }
    }
    await client.query('COMMIT');
  } catch (e) { await client.query('ROLLBACK'); throw e; }
  finally { client.release(); }

  publish(TOPICS.EVENTS_ALL, `section-${req.params.sectionId}`, {
    event: 'maintenance.bearing_check.imported', section_id: req.params.sectionId, shift,
    count: readings.length, userId: req.user.id, timestamp: new Date()
  });
  for (const c of criticals) {
    publish(TOPICS.EVENTS_CRIT, `equipment-${c.equipment_id}`, {
      event: 'maintenance.bearing_check.critical', ...c, section_id: req.params.sectionId, userId: req.user.id, timestamp: new Date()
    });
  }

  res.json({ success: true, count: readings.length, criticalCount: criticals.length, unmatched });
}));

module.exports = router;
