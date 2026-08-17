const router = require('express').Router();
const { pool, requireAuth, requireLevel, ar } = require('../middleware/helpers');

function hasSectionWriteAccess(user, sectionCode) {
  const code = (sectionCode || '').toUpperCase();
  const dept = (user.dept_code || '').toUpperCase();
  
  if ((user.role_level || 0) >= 5 || user.role === 'Admin') {
    return true;
  }

  if (dept === 'PROD') {
    const prodSections = [
      'PULPMILL', 'CENTRICLEANER', 'WIRE', 'PRESS', 'UNIRUN', 
      'PRE_DRYER', 'SIZE_PRESS', 'POST_DRYER', 'CALENDER', 
      'POPE_REEL', 'REWINDER', 'CRANES'
    ];
    return prodSections.includes(code);
  }

  if (dept === 'QC' || dept === 'QA' || dept === 'LAB') {
    const qcSections = [
      'LAB', 'SIZE_PRESS', 'SIZE_KITCHEN', 'STARCH_KITCHEN', 'POPE_REEL'
    ];
    return qcSections.includes(code);
  }

  if (dept === 'UTIL') {
    const utilSections = [
      'BOILER', 'STEAM_COND', 'ETP', 'COMPRESSORS', 'VACUUM'
    ];
    return utilSections.includes(code);
  }

  if (dept === 'MAINT') {
    const maintSections = [
      'CRANES', 'COMPRESSORS', 'BOILER', 'VACUUM'
    ];
    return maintSections.includes(code);
  }

  if (dept === 'STORE') {
    return code === 'STORE';
  }

  return false;
}

// ── LIST ALL SECTIONS ──────────────────────────────────────────────────────
router.get('/', requireAuth, ar(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT ps.id, ps.section_code as "sectionCode", ps.name, ps.icon, ps.description,
            ps.sort_order as "sortOrder", ps.is_active as "isActive",
            d.name as "deptName", d.category as "deptCategory"
     FROM plant_sections ps
     LEFT JOIN departments d ON d.id = ps.department_id
     WHERE ps.is_active=true ORDER BY ps.sort_order`
  );
  res.json({ success: true, data: rows });
}));

// ── ALL-SECTIONS KPI SNAPSHOT (aggregator) ─────────────────────────────────
router.get('/all/kpi-snapshot', requireAuth, ar(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT ps.section_code as "sectionCode", ps.name, ps.icon,
            ks.kpi_data as "kpiData", ks.snapshot_time as "snapshotTime",
            (SELECT COUNT(*) FROM section_alarms sa
             WHERE sa.section_id=ps.id AND sa.resolved_at IS NULL
               AND sa.alarm_type='Critical') as "criticalAlarms",
            (SELECT COUNT(*) FROM section_alarms sa
             WHERE sa.section_id=ps.id AND sa.resolved_at IS NULL
               AND sa.alarm_type='Warning') as "warningAlarms"
     FROM plant_sections ps
     LEFT JOIN LATERAL (
       SELECT kpi_data, snapshot_time FROM section_kpi_snapshots
       WHERE section_id=ps.id ORDER BY snapshot_time DESC LIMIT 1
     ) ks ON true
     WHERE ps.is_active=true ORDER BY ps.sort_order`
  );
  res.json({ success: true, data: rows });
}));

// ── SECTION DETAIL + EQUIPMENT ─────────────────────────────────────────────
router.get('/:code', requireAuth, ar(async (req, res) => {
  const { rows: sec } = await pool.query(
    `SELECT ps.id, ps.section_code as "sectionCode", ps.name, ps.icon, ps.description,
            d.name as "deptName", d.category as "deptCategory"
     FROM plant_sections ps
     LEFT JOIN departments d ON d.id = ps.department_id
     WHERE ps.section_code=$1 AND ps.is_active=true`,
    [req.params.code.toUpperCase()]
  );
  if (!sec.length) return res.status(404).json({ success: false, message: 'Section not found' });

  const { rows: equip } = await pool.query(
    `SELECT se.id, se.tag_name as "tagName", se.equipment_name as "equipmentName",
            se.equipment_type as "equipmentType", se.manufacturer, se.model_number as "modelNumber",
            se.serial_number as "serialNumber", se.rated_capacity as "ratedCapacity",
            se.motor_kw as "motorKw", se.rpm, se.is_critical as "isCritical",
            se.is_active as "isActive", m.name as "machineName"
     FROM section_equipment se
     LEFT JOIN machines m ON m.id=se.machine_id
     WHERE se.section_id=$1 AND se.is_active=true ORDER BY se.tag_name`,
    [sec[0].id]
  );
  const { rows: alarmCounts } = await pool.query(
    `SELECT alarm_type as type, COUNT(*) as count
     FROM section_alarms WHERE section_id=$1 AND resolved_at IS NULL
     GROUP BY alarm_type`,
    [sec[0].id]
  );
  const counts = { critical: 0, warning: 0, info: 0 };
  alarmCounts.forEach(r => { counts[r.type.toLowerCase()] = parseInt(r.count); });

  res.json({ success: true, data: { ...sec[0], equipment: equip, alarmCounts: counts } });
}));

// ── PROCESS READINGS ───────────────────────────────────────────────────────
router.get('/:code/readings', requireAuth, ar(async (req, res) => {
  const { last = '1h', tag, limit = 200 } = req.query;
  const { rows: sec } = await pool.query(
    'SELECT id FROM plant_sections WHERE section_code=$1', [req.params.code.toUpperCase()]);
  if (!sec.length) return res.status(404).json({ success: false, message: 'Section not found' });

  const interval = ['1h','6h','12h','24h','7d'].includes(last) ? last : '1h';
  const params = [sec[0].id, parseInt(limit)];
  let tagCond = '';
  if (tag) { tagCond = `AND r.tag_name=$3`; params.push(tag); }

  const { rows } = await pool.query(
    `SELECT r.id, r.tag_name as "tagName", r.parameter_name as "parameterName",
            r.value, r.uom, r.reading_time as "readingTime", r.source,
            e.equipment_name as "equipmentName", u.name as "recordedBy"
     FROM section_process_readings r
     LEFT JOIN section_equipment e ON e.id=r.equipment_id
     LEFT JOIN users u ON u.id=r.recorded_by
     WHERE r.section_id=$1 AND r.reading_time >= NOW() - INTERVAL '${interval}'
     ${tagCond}
     ORDER BY r.reading_time DESC LIMIT $2`,
    params
  );
  res.json({ success: true, data: rows });
}));

router.post('/:code/readings', requireAuth, ar(async (req, res) => {
  if (!hasSectionWriteAccess(req.user, req.params.code)) {
    return res.status(403).json({ success: false, message: 'Forbidden: Insufficient department permission for this section.' });
  }
  const { equipmentId, tagName, parameterName, value, uom, readingTime, shiftId } = req.body;
  if (!tagName || value === undefined || value === null)
    return res.status(400).json({ success: false, message: 'tagName and value required' });

  const { rows: sec } = await pool.query(
    'SELECT id FROM plant_sections WHERE section_code=$1', [req.params.code.toUpperCase()]);
  if (!sec.length) return res.status(404).json({ success: false, message: 'Section not found' });

  const { rows } = await pool.query(
    `INSERT INTO section_process_readings
       (section_id,equipment_id,tag_name,parameter_name,value,uom,reading_time,shift_id,recorded_by,source)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'Manual') RETURNING id, reading_time as "readingTime"`,
    [sec[0].id, equipmentId||null, tagName, parameterName||tagName, value, uom||null,
     readingTime||new Date(), shiftId||null, req.user.id]
  );
  res.json({ success: true, data: rows[0] });
}));

// ── ALARMS ─────────────────────────────────────────────────────────────────
router.get('/:code/alarms', requireAuth, ar(async (req, res) => {
  const { status = 'active', limit = 50 } = req.query;
  const { rows: sec } = await pool.query(
    'SELECT id FROM plant_sections WHERE section_code=$1', [req.params.code.toUpperCase()]);
  if (!sec.length) return res.status(404).json({ success: false, message: 'Section not found' });

  const activeCond = status === 'active' ? 'AND a.resolved_at IS NULL' : '';
  const { rows } = await pool.query(
    `SELECT a.id, a.tag_name as "tagName", a.alarm_code as "alarmCode",
            a.alarm_type as "alarmType", a.description,
            a.triggered_at as "triggeredAt", a.acknowledged_at as "acknowledgedAt",
            a.resolved_at as "resolvedAt", a.resolution_note as "resolutionNote",
            a.maintenance_log_id as "maintenanceLogId",
            e.equipment_name as "equipmentName",
            ack.name as "acknowledgedBy"
     FROM section_alarms a
     LEFT JOIN section_equipment e ON e.id=a.equipment_id
     LEFT JOIN users ack ON ack.id=a.acknowledged_by
     WHERE a.section_id=$1 ${activeCond}
     ORDER BY a.triggered_at DESC LIMIT $2`,
    [sec[0].id, parseInt(limit)]
  );
  res.json({ success: true, data: rows });
}));

router.post('/:code/alarms', requireAuth, requireLevel(2), ar(async (req, res) => {
  if (!hasSectionWriteAccess(req.user, req.params.code)) {
    return res.status(403).json({ success: false, message: 'Forbidden: Insufficient department permission for this section.' });
  }
  const { equipmentId, tagName, alarmCode, alarmType, description } = req.body;
  if (!alarmType || !description)
    return res.status(400).json({ success: false, message: 'alarmType and description required' });
  if (!['Critical','Warning','Info'].includes(alarmType))
    return res.status(400).json({ success: false, message: 'alarmType must be Critical/Warning/Info' });

  const { rows: sec } = await pool.query(
    'SELECT id FROM plant_sections WHERE section_code=$1', [req.params.code.toUpperCase()]);
  if (!sec.length) return res.status(404).json({ success: false, message: 'Section not found' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: alarm } = await client.query(
      `INSERT INTO section_alarms (section_id,equipment_id,tag_name,alarm_code,alarm_type,description)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      [sec[0].id, equipmentId||null, tagName||null, alarmCode||null, alarmType, description]
    );
    const alarmId = alarm[0].id;

    // Critical alarm → auto-link maintenance_logs + downtime_entries
    if (alarmType === 'Critical' && equipmentId) {
      const { rows: equip } = await client.query(
        'SELECT machine_id FROM section_equipment WHERE id=$1', [equipmentId]);
      const machineId = equip[0]?.machine_id;

      if (machineId) {
        // maintenance_logs actor column is performed_by (there is no created_by).
        const { rows: mlog } = await client.query(
          `INSERT INTO maintenance_logs
             (machine_id, maintenance_type, date, description, status, performed_by)
           VALUES ($1,'Breakdown',CURRENT_DATE,$2,'Open',$3) RETURNING id`,
          [machineId, description, req.user.id]
        );
        // downtime_entries actor column is reported_by (there is no created_by).
        await client.query(
          `INSERT INTO downtime_entries (machine_id, start_time, category, reason, reported_by)
           VALUES ($1,NOW(),'Breakdown',$2,$3)`,
          [machineId, description, req.user.id]
        );
        await client.query(
          'UPDATE section_alarms SET maintenance_log_id=$1 WHERE id=$2',
          [mlog[0].id, alarmId]
        );
      }
    }

    await client.query('COMMIT');
    res.json({ success: true, data: { id: alarmId } });
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally { client.release(); }
}));

router.put('/alarms/:id/ack', requireAuth, requireLevel(2), ar(async (req, res) => {
  const { rows } = await pool.query(
    `UPDATE section_alarms SET acknowledged_at=NOW(), acknowledged_by=$1
     WHERE id=$2 AND acknowledged_at IS NULL RETURNING id`,
    [req.user.id, req.params.id]
  );
  if (!rows.length) return res.status(404).json({ success: false, message: 'Alarm not found or already acknowledged' });
  res.json({ success: true });
}));

router.put('/alarms/:id/resolve', requireAuth, requireLevel(2), ar(async (req, res) => {
  const { resolutionNote } = req.body;
  if (!resolutionNote) return res.status(400).json({ success: false, message: 'resolutionNote required' });
  const { rows } = await pool.query(
    `UPDATE section_alarms SET resolved_at=NOW(), resolution_note=$1
     WHERE id=$2 AND resolved_at IS NULL RETURNING id`,
    [resolutionNote, req.params.id]
  );
  if (!rows.length) return res.status(404).json({ success: false, message: 'Alarm not found or already resolved' });
  res.json({ success: true });
}));

// ── SOPs ───────────────────────────────────────────────────────────────────
router.get('/:code/sops', requireAuth, ar(async (req, res) => {
  const { rows: sec } = await pool.query(
    'SELECT id FROM plant_sections WHERE section_code=$1', [req.params.code.toUpperCase()]);
  if (!sec.length) return res.status(404).json({ success: false, message: 'Section not found' });

  const { rows } = await pool.query(
    `SELECT s.id, s.sop_type as "sopType", s.title, s.version, s.steps,
            s.approved_at as "approvedAt", u.name as "approvedBy"
     FROM section_sops s LEFT JOIN users u ON u.id=s.approved_by
     WHERE s.section_id=$1 AND s.is_active=true ORDER BY s.sop_type`,
    [sec[0].id]
  );
  res.json({ success: true, data: rows });
}));

// ── EQUIPMENT CRUD ─────────────────────────────────────────────────────────
router.get('/:code/equipment', requireAuth, ar(async (req, res) => {
  const { rows: sec } = await pool.query(
    'SELECT id FROM plant_sections WHERE section_code=$1', [req.params.code.toUpperCase()]);
  if (!sec.length) return res.status(404).json({ success: false, message: 'Section not found' });

  const { rows } = await pool.query(
    `SELECT se.id, se.tag_name as "tagName", se.equipment_name as "equipmentName",
            se.equipment_type as "equipmentType", se.manufacturer, se.model_number as "modelNumber",
            se.serial_number as "serialNumber", se.installation_date as "installationDate",
            se.rated_capacity as "ratedCapacity", se.design_pressure as "designPressure",
            se.design_temp as "designTemp", se.motor_kw as "motorKw", se.rpm,
            se.is_critical as "isCritical", se.is_active as "isActive", se.remarks,
            m.name as "machineName"
     FROM section_equipment se
     LEFT JOIN machines m ON m.id=se.machine_id
     WHERE se.section_id=$1 ORDER BY se.tag_name`,
    [sec[0].id]
  );
  res.json({ success: true, data: rows, total: rows.length });
}));

router.post('/:code/equipment', requireAuth, requireLevel(3), ar(async (req, res) => {
  if (!hasSectionWriteAccess(req.user, req.params.code)) {
    return res.status(403).json({ success: false, message: 'Forbidden: Insufficient department permission for this section.' });
  }
  const { tagName, equipmentName, equipmentType, manufacturer, modelNumber, serialNumber,
          installationDate, ratedCapacity, designPressure, designTemp,
          motorKw, rpm, isCritical, machineId, remarks } = req.body;
  if (!tagName || !equipmentName)
    return res.status(400).json({ success: false, message: 'tagName and equipmentName required' });

  const { rows: sec } = await pool.query(
    'SELECT id FROM plant_sections WHERE section_code=$1', [req.params.code.toUpperCase()]);
  if (!sec.length) return res.status(404).json({ success: false, message: 'Section not found' });

  const { rows } = await pool.query(
    `INSERT INTO section_equipment
       (section_id,machine_id,tag_name,equipment_name,equipment_type,manufacturer,
        model_number,serial_number,installation_date,rated_capacity,design_pressure,
        design_temp,motor_kw,rpm,is_critical,remarks)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING id`,
    [sec[0].id, machineId||null, tagName, equipmentName, equipmentType||null,
     manufacturer||null, modelNumber||null, serialNumber||null, installationDate||null,
     ratedCapacity||null, designPressure||null, designTemp||null,
     motorKw||null, rpm||null, isCritical||false, remarks||null]
  );
  res.json({ success: true, data: { id: rows[0].id } });
}));

router.put('/equipment/:id', requireAuth, requireLevel(3), ar(async (req, res) => {
  const { equipmentName, equipmentType, manufacturer, modelNumber, serialNumber,
          installationDate, ratedCapacity, designPressure, designTemp,
          motorKw, rpm, isCritical, isActive, remarks } = req.body;
  await pool.query(
    `UPDATE section_equipment SET
       equipment_name=COALESCE($1,equipment_name),
       equipment_type=COALESCE($2,equipment_type),
       manufacturer=COALESCE($3,manufacturer),
       model_number=COALESCE($4,model_number),
       serial_number=COALESCE($5,serial_number),
       installation_date=COALESCE($6,installation_date),
       rated_capacity=COALESCE($7,rated_capacity),
       design_pressure=COALESCE($8,design_pressure),
       design_temp=COALESCE($9,design_temp),
       motor_kw=COALESCE($10,motor_kw),
       rpm=COALESCE($11,rpm),
       is_critical=COALESCE($12,is_critical),
       is_active=COALESCE($13,is_active),
       remarks=COALESCE($14,remarks)
     WHERE id=$15`,
    [equipmentName,equipmentType,manufacturer,modelNumber,serialNumber,
     installationDate,ratedCapacity,designPressure,designTemp,
     motorKw,rpm,isCritical,isActive,remarks, req.params.id]
  );
  res.json({ success: true });
}));

module.exports = router;
