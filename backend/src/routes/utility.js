const router = require('express').Router();
const pool = require('../db/pool');
const { auth, requireLevel } = require('../middleware/auth');
const ar = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// LIST
router.get('/readings', auth, ar(async (req, res) => {
  const { date, shift_type, page=1, limit=30 } = req.query;
  const conds=[]; const params=[]; let p=1;
  if (date)       { conds.push(`ur.date=$${p++}`); params.push(date); }
  if (shift_type) { conds.push(`ur.shift_type=$${p++}`); params.push(shift_type); }
  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
  const offset = (parseInt(page)-1)*parseInt(limit);
  const { rows } = await pool.query(
    `SELECT ur.id, ur.date, ur.shift_type as "shiftType", ur.reading_time as "readingTime",
            ur.power_units as "powerUnits", ur.dg_units as "dgUnits",
            ur.steam_generated_mt as "steamGeneratedMt", ur.coal_consumed_kg as "coalConsumedKg",
            ur.boiler_pressure as "boilerPressure", ur.boiler_temp as "boilerTemp",
            ur.fresh_water_kl as "freshWaterKl", ur.process_water_kl as "processWaterKl",
            ur.air_pressure as "airPressure",
            ur.etp_inlet_kl as "etpInletKl", ur.etp_outlet_kl as "etpOutletKl",
            u.name as "recordedBy"
     FROM utility_readings ur LEFT JOIN users u ON u.id=ur.recorded_by
     ${where} ORDER BY ur.reading_time DESC LIMIT $${p} OFFSET $${p+1}`,
    [...params, parseInt(limit), offset]
  );
  const { rows: cnt } = await pool.query(`SELECT COUNT(*) FROM utility_readings ur ${where}`, params);
  res.json({ success:true, data:rows, total:parseInt(cnt[0].count) });
}));

// DAILY SUMMARY
router.get('/summary', auth, ar(async (req, res) => {
  const { date } = req.query;
  const d = date || new Date().toISOString().slice(0,10);
  const { rows } = await pool.query(
    `SELECT
       COALESCE(SUM(power_units),0) as "totalPower",
       COALESCE(SUM(dg_units),0) as "totalDg",
       COALESCE(SUM(steam_generated_mt),0) as "totalSteam",
       COALESCE(SUM(coal_consumed_kg),0) as "totalCoal",
       COALESCE(SUM(fresh_water_kl),0) as "totalFreshWater",
       COALESCE(SUM(process_water_kl),0) as "totalProcessWater",
       AVG(boiler_pressure) as "avgBoilerPressure",
       AVG(boiler_temp) as "avgBoilerTemp"
     FROM utility_readings WHERE date=$1`, [d]
  );
  const { rows: prodRows } = await pool.query(
    `SELECT COALESCE(SUM(net_weight_kg),0) as "prodKg" FROM reels WHERE status != 'Rejected' AND DATE(end_time)=$1`, [d]
  );

  const data = rows[0];
  const prodKg = Number(prodRows[0].prodKg) || 0;
  const prodMt = prodKg / 1000;

  const totalSteamMt = Number(data.totalSteam);
  const totalCoalKg = Number(data.totalCoal);
  const totalPower = Number(data.totalPower);
  const totalDg = Number(data.totalDg);
  const totalFreshWater = Number(data.totalFreshWater);

  data.steam_efficiency = totalCoalKg > 0 ? ((totalSteamMt * 1000) / totalCoalKg).toFixed(2) : 0;
  data.power_intensity = prodKg > 0 ? ((totalPower + totalDg) / prodKg).toFixed(2) : 0;
  data.specific_water = prodMt > 0 ? (totalFreshWater / prodMt).toFixed(2) : 0;
  data.production_mt = prodMt;

  res.json({ success:true, data });
}));

// LOG READING
router.post('/readings', auth, requireLevel(1), ar(async (req, res) => {
  const {
    date, shift_type, reading_time,
    power_units, dg_units,
    steam_generated_mt, coal_consumed_kg, boiler_pressure, boiler_temp,
    fresh_water_kl, process_water_kl,
    air_pressure, etp_inlet_kl, etp_outlet_kl
  } = req.body;
  if (!date || !reading_time) return res.json({ success:false, message:'Date + reading time required' });
  const { rows } = await pool.query(
    `INSERT INTO utility_readings
       (date,shift_type,reading_time,power_units,dg_units,
        steam_generated_mt,coal_consumed_kg,boiler_pressure,boiler_temp,
        fresh_water_kl,process_water_kl,air_pressure,etp_inlet_kl,etp_outlet_kl,recorded_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`,
    [date,shift_type||null,reading_time,
     power_units||0,dg_units||0,
     steam_generated_mt||0,coal_consumed_kg||0,boiler_pressure||null,boiler_temp||null,
     fresh_water_kl||0,process_water_kl||0,air_pressure||null,etp_inlet_kl||0,etp_outlet_kl||0,
     req.user.id]
  );
  res.json({ success:true, data:rows[0] });
}));

// UPDATE
router.put('/readings/:id', auth, requireLevel(2), ar(async (req, res) => {
  const {
    power_units,dg_units,steam_generated_mt,coal_consumed_kg,
    boiler_pressure,boiler_temp,fresh_water_kl,process_water_kl,
    air_pressure,etp_inlet_kl,etp_outlet_kl
  } = req.body;
  const { rows } = await pool.query(
    `UPDATE utility_readings SET
       power_units=$1,dg_units=$2,steam_generated_mt=$3,coal_consumed_kg=$4,
       boiler_pressure=$5,boiler_temp=$6,fresh_water_kl=$7,process_water_kl=$8,
       air_pressure=$9,etp_inlet_kl=$10,etp_outlet_kl=$11
     WHERE id=$12 RETURNING *`,
    [power_units||0,dg_units||0,steam_generated_mt||0,coal_consumed_kg||0,
     boiler_pressure||null,boiler_temp||null,fresh_water_kl||0,process_water_kl||0,
     air_pressure||null,etp_inlet_kl||0,etp_outlet_kl||0,req.params.id]
  );

  res.json({ success:!!rows.length, data:rows[0] });
}));

// ── ETP READINGS (F6) ─────────────────────────────────────────────────────────
router.get('/etp-readings', auth, ar(async (req, res) => {
  const { date } = req.query;
  const conds = []; const params = []; let p = 1;
  if (date) { conds.push(`er.date=$${p++}`); params.push(date); }
  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
  const { rows } = await pool.query(
    `SELECT er.*, u.name as "loggedByName"
     FROM etp_readings er
     LEFT JOIN users u ON u.id = er.logged_by
     ${where} ORDER BY er.date DESC, er.reading_time DESC`,
    params
  );
  res.json({ success: true, data: rows });
}));

router.post('/etp-readings', auth, requireLevel(1), ar(async (req, res) => {
  const { date, reading_time, ph, cod, bod, tss, tds, flow_rate, remarks } = req.body;
  if (!reading_time) return res.status(400).json({ success: false, message: 'Reading time required' });
  const { rows } = await pool.query(
    `INSERT INTO etp_readings (date, reading_time, ph, cod, bod, tss, tds, flow_rate, logged_by, remarks)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
    [date || new Date(), reading_time, ph || null, cod || null, bod || null, tss || null, tds || null, flow_rate || null, req.user.id, remarks || null]
  );
  res.status(201).json({ success: true, data: rows[0] });
}));

module.exports = router;
