// Ph21-B/C: Machine Events Routes
// POST /api/events         — log an event (paper break, web wrap, e-stop, etc.)
// GET  /api/events         — list events with filters
// PATCH /api/events/:id/resolve — mark event resolved
// GET  /api/events/section/:sectionId — events for one section

const router = require('express').Router();
const { pool, requireAuth, requireLevel, ar } = require('../middleware/helpers');
const { publish, TOPICS } = require('../kafka');

// ── POST: Log machine event ─────────────────────────────────────────────────
// Body: { sectionId, equipmentId, eventType, severity, eventTime, durationMin,
//         rootCauseCode, locationDetail, description, downtimeEntryId }
router.post('/', requireAuth, ar(async (req, res) => {
  const {
    sectionId, equipmentId, eventType, severity = 'Warning',
    eventTime, durationMin, rootCauseCode,
    locationDetail, description, downtimeEntryId
  } = req.body;

  if (!sectionId || !eventType) {
    return res.status(400).json({ success: false, message: 'sectionId and eventType required' });
  }

  const { rows } = await pool.query(
    `INSERT INTO machine_events
       (section_id, equipment_id, event_type, severity,
        event_time, duration_min, root_cause_code,
        location_detail, description, downtime_entry_id, reported_by)
     VALUES ($1,$2,$3,$4, COALESCE($5::timestamptz, NOW()), $6,$7,$8,$9,$10,$11)
     RETURNING *`,
    [sectionId, equipmentId || null, eventType, severity,
     eventTime || null, durationMin || null, rootCauseCode || null,
     locationDetail || null, description || null, downtimeEntryId || null,
     req.user.id]
  );

  const event = rows[0];

  // Kafka: Ph21-D — ALL events → mkpm.events.all; Critical → also mkpm.events.critical
  const kafkaPayload = {
    eventId:      event.id,
    eventType:    event.event_type,
    sectionId:    event.section_id,
    equipmentId:  event.equipment_id,
    severity:     event.severity,
    eventTime:    event.event_time,
    description:  event.description,
    locationDetail: event.location_detail,
    reportedBy:   req.user.id,
  };

  // Broadcast to all-events topic (every severity)
  publish(TOPICS.EVENTS_ALL, event.id, kafkaPayload);

  // Also broadcast to critical topic if Critical
  if (event.severity === 'Critical') {
    publish(TOPICS.EVENTS_CRIT, event.id, kafkaPayload).then(ok => {
      if (ok) pool.query('UPDATE machine_events SET kafka_published=true WHERE id=$1', [event.id]).catch(() => {});
    });
  }

  res.status(201).json({ success: true, data: event });
}));

// ── GET: List events with filters ───────────────────────────────────────────
// Query: sectionId, eventType, severity, fromDate, toDate, unresolved
router.get('/', requireAuth, ar(async (req, res) => {
  const { sectionId, eventType, severity, fromDate, toDate, unresolved } = req.query;

  let where = ['1=1'];
  let params = [];
  let i = 1;

  if (sectionId)  { where.push(`me.section_id=$${i++}`);  params.push(sectionId); }
  if (eventType)  { where.push(`me.event_type=$${i++}`);  params.push(eventType); }
  if (severity)   { where.push(`me.severity=$${i++}`);    params.push(severity); }
  if (fromDate)   { where.push(`me.event_time>=$${i++}`); params.push(fromDate); }
  if (toDate)     { where.push(`me.event_time<=$${i++}`); params.push(toDate); }
  if (unresolved === 'true') { where.push(`me.resumed_at IS NULL`); }

  const { rows } = await pool.query(
    `SELECT me.*,
            ps.name as "sectionName", ps.icon as "sectionIcon",
            se.equipment_name as "equipmentName", se.tag_name as "tagName",
            u.name as "reportedByName"
     FROM machine_events me
     LEFT JOIN plant_sections ps ON ps.id = me.section_id
     LEFT JOIN section_equipment se ON se.id = me.equipment_id
     LEFT JOIN users u ON u.id = me.reported_by
     WHERE ${where.join(' AND ')}
     ORDER BY me.event_time DESC LIMIT 200`,
    params
  );
  res.json({ success: true, data: rows });
}));

// ── GET: Events for a section ───────────────────────────────────────────────
router.get('/section/:sectionId', requireAuth, ar(async (req, res) => {
  const { hours = 24 } = req.query;
  const { rows } = await pool.query(
    `SELECT me.*, se.equipment_name as "equipmentName", u.name as "reportedByName"
     FROM machine_events me
     LEFT JOIN section_equipment se ON se.id = me.equipment_id
     LEFT JOIN users u ON u.id = me.reported_by
     WHERE me.section_id = $1
       AND me.event_time >= NOW() - ($2 || ' hours')::interval
     ORDER BY me.event_time DESC`,
    [req.params.sectionId, hours]
  );
  res.json({ success: true, data: rows });
}));

// ── PATCH: Resolve an event ─────────────────────────────────────────────────
router.patch('/:id/resolve', requireAuth, ar(async (req, res) => {
  const { resolutionNote } = req.body;
  const { rows } = await pool.query(
    `UPDATE machine_events
     SET resumed_at=NOW(), resolved_by=$2, resolution_note=$3
     WHERE id=$1 RETURNING *`,
    [req.params.id, req.user.id, resolutionNote || null]
  );
  if (!rows.length) return res.status(404).json({ success: false, message: 'Event not found' });
  res.json({ success: true, data: rows[0] });
}));

module.exports = router;
