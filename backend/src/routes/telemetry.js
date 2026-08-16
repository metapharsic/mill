// Ph19-B/C/D + Ph20-B/C/D: Telemetry, Lab & Correlation Routes
// POST /api/telemetry                    — ingest a reading        → Kafka: mkpm.telemetry.readings
// GET  /api/telemetry/:equipId           — fetch recent readings for equipment
// GET  /api/telemetry/section/:sectionId — all readings for a section
// POST /api/telemetry/lab               — ingest a lab result      → Kafka: mkpm.quality.lab
// GET  /api/telemetry/lab/:reelId       — fetch lab results for a reel
// GET  /api/telemetry/correlate         — Ph20-C: freeness↔vacuum ±15min → Kafka: mkpm.analysis.correlation

const router = require('express').Router();
const { pool, requireAuth, ar } = require('../middleware/helpers');
const { publish, TOPICS } = require('../kafka');

// ── POST: Ingest process reading ─────────────────────────────────────────────
router.post('/', requireAuth, ar(async (req, res) => {
  const {
    sectionId, equipmentId, tagName, parameterName,
    value, uom, readingTime, shiftId, source = 'Manual'
  } = req.body;

  if (!sectionId || !tagName || !parameterName || value === undefined) {
    return res.status(400).json({ success: false, message: 'sectionId, tagName, parameterName, value required' });
  }

  const { rows } = await pool.query(
    `INSERT INTO section_process_readings
       (section_id, equipment_id, tag_name, parameter_name, value, uom, reading_time, shift_id, recorded_by, source)
     VALUES ($1,$2,$3,$4,$5,$6, COALESCE($7::timestamptz, NOW()), $8, $9, $10)
     RETURNING *`,
    [sectionId, equipmentId || null, tagName, parameterName, value, uom || null,
     readingTime || null, shiftId || null, req.user.id, source]
  );

  const reading = rows[0];

  // Kafka: Ph19-D — broadcast every telemetry reading (fire-and-forget)
  publish(TOPICS.TELEMETRY, reading.id, {
    id:            reading.id,
    sectionId:     reading.section_id,
    equipmentId:   reading.equipment_id,
    tagName:       reading.tag_name,
    parameterName: reading.parameter_name,
    value:         reading.value,
    uom:           reading.uom,
    readingTime:   reading.reading_time,
    source:        reading.source,
    recordedBy:    req.user.id,
  });

  res.status(201).json({ success: true, data: reading });
}));

// ── GET: Trend for equipment ─────────────────────────────────────────────────
// Route must be before /:equipId to avoid route collision
router.get('/section/:sectionId', requireAuth, ar(async (req, res) => {
  const { sectionId } = req.params;
  const { hours = 8 } = req.query;

  const { rows } = await pool.query(
    `SELECT r.id, r.tag_name as "tagName", r.parameter_name as "parameterName",
            r.value, r.uom, r.reading_time as "readingTime", r.source,
            e.equipment_name as "equipmentName"
     FROM section_process_readings r
     LEFT JOIN section_equipment e ON e.id = r.equipment_id
     WHERE r.section_id = $1
       AND r.reading_time >= NOW() - ($2 || ' hours')::interval
     ORDER BY r.reading_time DESC LIMIT 1000`,
    [sectionId, hours]
  );
  res.json({ success: true, data: rows });
}));

// ── GET: Ph20-C — Correlate freeness_csf ↔ avg wire vacuum (±15 min window) ─
// Query: ?sectionId=&hours=24
router.get('/correlate', requireAuth, ar(async (req, res) => {
  const { sectionId, hours = 24 } = req.query;

  // For each lab test, find average vacuum reading within ±15 minutes
  const { rows } = await pool.query(
    `SELECT
       q.id                                  AS "labId",
       q.reel_id                             AS "reelId",
       q.test_time                           AS "testTime",
       q.freeness_csf                        AS "freeness_csf",
       q.basis_weight_gsm                    AS "basisWeightGsm",
       q.burst_factor                        AS "burstFactor",
       q.moisture_pct                        AS "moisturePct",
       q.dirt_count                          AS "dirtCount",
       ROUND(AVG(r.value)::numeric, 4)       AS "vacuumAvg",
       COUNT(r.id)                           AS "vacuumReadingCount",
       MIN(r.value)                          AS "vacuumMin",
       MAX(r.value)                          AS "vacuumMax"
     FROM quality_lab_tests q
     LEFT JOIN section_process_readings r
       ON (q.section_id = r.section_id OR ($1::int IS NULL))
       AND r.tag_name ILIKE '%VAC%'
       AND r.reading_time BETWEEN q.test_time - INTERVAL '15 minutes'
                               AND q.test_time + INTERVAL '15 minutes'
     WHERE q.test_time >= NOW() - ($2 || ' hours')::interval
       AND ($1::int IS NULL OR q.section_id = $1::int)
     GROUP BY q.id, q.reel_id, q.test_time, q.freeness_csf, q.basis_weight_gsm,
              q.burst_factor, q.moisture_pct, q.dirt_count
     ORDER BY q.test_time DESC
     LIMIT 200`,
    [sectionId || null, hours]
  );

  // Kafka: broadcast correlation results (Ph20-C)
  if (rows.length > 0) {
    publish(TOPICS.CORRELATION, `${sectionId || 'all'}-${Date.now()}`, {
      sectionId:          sectionId || null,
      windowHours:        hours,
      correlationCount:   rows.length,
      computedAt:         new Date().toISOString(),
      sample:             rows.slice(0, 3), // first 3 for preview
    });
  }

  res.json({ success: true, count: rows.length, data: rows });
}));

// ── GET: Trend for specific equipment ────────────────────────────────────────
router.get('/:equipId', requireAuth, ar(async (req, res) => {
  const { equipId } = req.params;
  const { tagName, hours = 24 } = req.query;

  let query = `
    SELECT id, tag_name as "tagName", parameter_name as "parameterName",
           value, uom, reading_time as "readingTime", source, recorded_by as "recordedBy"
    FROM section_process_readings
    WHERE equipment_id = $1
      AND reading_time >= NOW() - ($2 || ' hours')::interval
  `;
  const params = [equipId, hours];

  if (tagName) { query += ` AND tag_name = $3`; params.push(tagName); }
  query += ` ORDER BY reading_time DESC LIMIT 500`;

  const { rows } = await pool.query(query, params);
  res.json({ success: true, data: rows });
}));

// ── POST: Lab result entry ────────────────────────────────────────────────────
router.post('/lab', requireAuth, ar(async (req, res) => {
  const {
    reelId, sectionId, shiftId,
    freeness_csf, consistency_pct, basis_weight_gsm,
    burst_factor, moisture_pct, tensile_md, tensile_cd, cobb_size,
    dirt_count, trim_loss_mm, slit_count, remarks
  } = req.body;

  const { rows } = await pool.query(
    `INSERT INTO quality_lab_tests
       (reel_id, section_id, shift_id,
        freeness_csf, consistency_pct, basis_weight_gsm,
        burst_factor, moisture_pct, tensile_md, tensile_cd, cobb_size,
        dirt_count, trim_loss_mm, slit_count, remarks, lab_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
     RETURNING *`,
    [reelId || null, sectionId || null, shiftId || null,
     freeness_csf || null, consistency_pct || null, basis_weight_gsm || null,
     burst_factor || null, moisture_pct || null, tensile_md || null, tensile_cd || null,
     cobb_size || null, dirt_count || null, trim_loss_mm || null, slit_count || null,
     remarks || null, req.user.id]
  );

  const lab = rows[0];

  // Kafka: Ph20-D — broadcast lab result (fire-and-forget)
  publish(TOPICS.LAB, lab.id, {
    id:               lab.id,
    reelId:           lab.reel_id,
    sectionId:        lab.section_id,
    testTime:         lab.test_time,
    freeness_csf:     lab.freeness_csf,
    basisWeightGsm:   lab.basis_weight_gsm,
    burstFactor:      lab.burst_factor,
    moisturePct:      lab.moisture_pct,
    dirtCount:        lab.dirt_count,
    trimLossMm:       lab.trim_loss_mm,
    slitCount:        lab.slit_count,
    labBy:            req.user.id,
  });

  res.status(201).json({ success: true, data: lab });
}));

// ── GET: Lab results for a reel ───────────────────────────────────────────────
router.get('/lab/:reelId', requireAuth, ar(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT q.*, u.name as "labByName"
     FROM quality_lab_tests q
     LEFT JOIN users u ON u.id = q.lab_by
     WHERE q.reel_id = $1
     ORDER BY q.test_time DESC`,
    [req.params.reelId]
  );
  res.json({ success: true, data: rows });
}));

// ── POST: Log hourly boiler readings ──────────────────────────────────────────
router.post('/boiler', requireAuth, ar(async (req, res) => {
  const {
    log_time,
    steam_flow_kgh,
    steam_pressure_bar,
    feedwater_temp_c,
    flue_gas_temp_c,
    husk_consumed_kg,
    blowdown_rate_pct
  } = req.body;

  if (!log_time || !steam_flow_kgh || !steam_pressure_bar || !feedwater_temp_c || !husk_consumed_kg) {
    return res.status(400).json({ success: false, message: 'Missing required boiler parameters' });
  }

  const steamEnthalpy = 660.0;
  const fuelGCV = 3200.0;
  
  const steamFlow = parseFloat(steam_flow_kgh);
  const feedwaterTemp = parseFloat(feedwater_temp_c);
  const huskQty = parseFloat(husk_consumed_kg);

  let efficiency = 0;
  if (huskQty > 0) {
    efficiency = ((steamFlow * (steamEnthalpy - feedwaterTemp)) / (huskQty * fuelGCV)) * 100;
    efficiency = Math.min(100, Math.max(0, efficiency));
  }

  const { rows } = await pool.query(
    `INSERT INTO boiler_performance_logs
       (log_time, steam_flow_kgh, steam_pressure_bar, feedwater_temp_c, flue_gas_temp_c,
        husk_consumed_kg, blowdown_rate_pct, efficiency_pct, logged_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     ON CONFLICT (log_time)
     DO UPDATE SET
       steam_flow_kgh = EXCLUDED.steam_flow_kgh,
       steam_pressure_bar = EXCLUDED.steam_pressure_bar,
       feedwater_temp_c = EXCLUDED.feedwater_temp_c,
       flue_gas_temp_c = EXCLUDED.flue_gas_temp_c,
       husk_consumed_kg = EXCLUDED.husk_consumed_kg,
       blowdown_rate_pct = EXCLUDED.blowdown_rate_pct,
       efficiency_pct = EXCLUDED.efficiency_pct,
       logged_by = EXCLUDED.logged_by
     RETURNING *`,
    [log_time, steamFlow, parseFloat(steam_pressure_bar), feedwaterTemp, 
     flue_gas_temp_c ? parseFloat(flue_gas_temp_c) : null, huskQty, 
     blowdown_rate_pct ? parseFloat(blowdown_rate_pct) : 0, Number(efficiency.toFixed(2)), req.user.id]
  );

  const logRow = rows[0];

  // Kafka: Publish boiler logged event
  publish('mkpm.telemetry.boiler', String(logRow.id), {
    event: 'boiler.logged',
    id: logRow.id,
    log_time: logRow.log_time,
    efficiency_pct: Number(logRow.efficiency_pct),
    steam_flow_kgh: Number(logRow.steam_flow_kgh),
    husk_consumed_kg: Number(logRow.husk_consumed_kg)
  });

  res.json({ success: true, data: logRow });
}));

// ── GET: Fetch boiler performance logs ─────────────────────────────────────────
router.get('/boiler/logs', requireAuth, ar(async (req, res) => {
  const { limit = 48 } = req.query;
  const { rows } = await pool.query(
    `SELECT b.*, u.name AS "operatorName"
     FROM boiler_performance_logs b
     LEFT JOIN users u ON u.id = b.logged_by
     ORDER BY b.log_time DESC
     LIMIT $1`,
    [parseInt(limit, 10)]
  );
  res.json({ success: true, data: rows });
}));

// ── POST: Record daily energy allocation per section ───────────────────────────
router.post('/energy', requireAuth, ar(async (req, res) => {
  const { allocated_date, section_id, power_kwh, steam_mt, water_kl } = req.body;

  if (!allocated_date || !section_id) {
    return res.status(400).json({ success: false, message: 'allocated_date and section_id required' });
  }

  const { rows } = await pool.query(
    `INSERT INTO section_energy_allocations
       (allocated_date, section_id, power_kwh, steam_mt, water_kl)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (allocated_date, section_id)
     DO UPDATE SET
       power_kwh = EXCLUDED.power_kwh,
       steam_mt = EXCLUDED.steam_mt,
       water_kl = EXCLUDED.water_kl
     RETURNING *`,
    [allocated_date, section_id, power_kwh || 0, steam_mt || 0, water_kl || 0]
  );

  const alloc = rows[0];

  // Kafka: Publish energy allocation event
  publish('mkpm.telemetry.energy', `${allocated_date}-${section_id}`, {
    event: 'energy.allocated',
    id: alloc.id,
    allocated_date: alloc.allocated_date,
    section_id: alloc.section_id,
    power_kwh: Number(alloc.power_kwh),
    steam_mt: Number(alloc.steam_mt),
    water_kl: Number(alloc.water_kl)
  });

  res.json({ success: true, data: alloc });
}));

// ── GET: Fetch energy allocations per section ──────────────────────────────────
router.get('/energy/allocations', requireAuth, ar(async (req, res) => {
  const { date } = req.query;
  const targetDate = date || new Date().toISOString().split('T')[0];

  const { rows } = await pool.query(
    `SELECT 
       ea.*,
       s.name AS "sectionName",
       s.code AS "sectionCode"
     FROM section_energy_allocations ea
     LEFT JOIN sections s ON s.id = ea.section_id
     WHERE ea.allocated_date = $1`,
    [targetDate]
  );
  res.json({ success: true, data: rows, date: targetDate });
}));

module.exports = router;
