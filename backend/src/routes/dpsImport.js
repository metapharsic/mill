const router = require('express').Router();
const multer = require('multer');
const xlsx = require('xlsx');
const pool = require('../db/pool');
const { auth, requireLevel } = require('../middleware/auth');
const kafka = require('../kafka');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// Helper: Parse duration string or Excel decimal time to minutes
function parseDurationToMinutes(val) {
  if (val === null || val === undefined || val === '') return 0;
  
  // 1. If it's a number (Excel decimal time, e.g. 0.5 = 12:00)
  if (typeof val === 'number') {
    return Math.round(val * 24 * 60);
  }

  const str = String(val).trim();
  if (!str) return 0;

  // 2. If it's HH:MM:SS or HH:MM
  const parts = str.split(':');
  if (parts.length >= 2) {
    const hh = parseInt(parts[0], 10) || 0;
    const mm = parseInt(parts[1], 10) || 0;
    const ss = parts[2] ? parseInt(parts[2], 10) || 0 : 0;
    return hh * 60 + mm + Math.round(ss / 60);
  }

  // 3. If it's a raw decimal number represented as string (e.g., "18.4" hours)
  const num = parseFloat(str);
  if (!isNaN(num)) {
    return Math.round(num * 60);
  }

  return 0;
}

// Helper: Parse Excel date value safely
function parseExcelDate(val) {
  if (val === null || val === undefined || val === '') return null;
  
  // 1. If it's a number (Excel serial date)
  if (typeof val === 'number') {
    // Excel base date is 30/12/1899 due to leap year bug
    const date = new Date((val - 25569) * 86400 * 1000);
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  // 2. If it's a string
  const str = String(val).trim();
  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  // Fallback for dd/mm/yyyy
  const m = str.match(/^(\d{1,2})[/\-](\d{1,2})[/\-](\d{4})$/);
  if (m) {
    const day = m[1].padStart(2, '0');
    const month = m[2].padStart(2, '0');
    const year = m[3];
    return `${year}-${month}-${day}`;
  }

  return null;
}

// Helper: Map object keys case-insensitively and trim spaces
function normalizeKeys(obj) {
  const norm = {};
  for (const k in obj) {
    if (obj[k] !== undefined) {
      norm[k.toLowerCase().trim().replace(/\s+/g, ' ')] = obj[k];
    }
  }
  return norm;
}

// Same async wrapper the other route files use. Without it, anything that throws before
// the try/catch below (the machines lookup, pool.connect(), sheet_to_json) rejects with
// no response at all — on Express 4 that leaves the browser hanging forever.
const ar = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// ─── POST /api/production/dpr/import — Import DPS spreadsheet ────────────────
router.post('/import', auth, requireLevel(2), upload.single('file'), ar(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'No spreadsheet file uploaded' });
  }

  let workbook;
  try {
    workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
  } catch (err) {
    return res.status(400).json({ success: false, message: 'Invalid Excel file format: ' + err.message });
  }

  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  // Parse rows (ignoring blank rows)
  const rows = xlsx.utils.sheet_to_json(sheet, { defval: null });

  if (rows.length === 0) {
    return res.status(400).json({ success: false, message: 'Uploaded sheet contains no data' });
  }

  // Fetch active machines to map machine_id. Default to the first active machine.
  const { rows: machines } = await pool.query('SELECT id, name, code FROM machines WHERE is_active = true');
  const defaultMachineId = machines.length > 0 ? machines[0].id : null;

  const imported = [];
  const skipped = [];
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    for (let idx = 0; idx < rows.length; idx++) {
      const rawRow = rows[idx];
      const row = normalizeKeys(rawRow);

      // We need at least a Date to process the row
      const dateVal = row['date'];
      const reportDate = parseExcelDate(dateVal);
      if (!reportDate) {
        skipped.push({ rowNumber: idx + 2, reason: 'Missing or invalid Date value' });
        continue;
      }

      // Production / Machine mapping
      // If machine name/code is present in spreadsheet, try to map it. Else default.
      let machineId = defaultMachineId;
      const machName = row['machine'] || row['machine name'] || row['machine_name'];
      if (machName) {
        const matched = machines.find(m => 
          m.name.toLowerCase() === String(machName).toLowerCase().trim() ||
          m.code.toLowerCase() === String(machName).toLowerCase().trim()
        );
        if (matched) machineId = matched.id;
      }

      // Extracted numeric variables (fallback to 0)
      const pmcProduction = parseFloat(row['machine production (ton) avg'] || row['production'] || row['pmc production'] || 0);
      const drawAvg = parseFloat(row['draw avg'] || row['draw'] || 0);
      const speedAvg = parseFloat(row['avg machine speed'] || row['machine speed'] || row['speed'] || 0);
      const moistureAvg = parseFloat(row['moisture (avg)'] || row['moisture'] || 0);
      const pulperUnits = parseFloat(row['pulper units'] || row['pulper energy'] || 0);
      const etpInletPpm = parseFloat(row['etp inlet ppm'] || row['etp inlet tss'] || 0);
      const etpOutletPpm = parseFloat(row['etp outlet ppm'] || row['etp outlet tss'] || 0);
      const etpInletFlow = parseFloat(row['mega cell inlet flow'] || row['etp inlet flow'] || 0);
      const etpOutletFlow = parseFloat(row['mega cell outlet flow'] || row['etp outlet flow'] || 0);
      const freshWater = parseFloat(row['fresh water (etp + machine + pulpmill)'] || row['fresh water'] || 0);
      const feedWater = parseFloat(row['feed water total (condensate + ro)'] || row['feed water'] || 0);
      const condensateWater = parseFloat(row['condensate water'] || 0);
      const riceHusk = parseFloat(row['rice husk consumption (mt)'] || row['rice husk'] || row['coal consumption'] || 0);
      const totalSteam = parseFloat(row['total steam (tons)'] || row['total steam'] || 0);
      const powerUnits = parseFloat(row['total energy consumption'] || row['power units'] || row['electricity units'] || 0);
      const furnishOCC = parseFloat(row['imported raw material (ton)'] || row['imported occ'] || 0);
      const furnishLocal = parseFloat(row['indian raw material (ton)'] || row['local occ'] || 0);

      // Duration conversions
      const runningMin = parseDurationToMinutes(row['running hrs'] || row['running hours']);
      const downMin = parseDurationToMinutes(row['break down (hr)'] || row['breakdown hours']);
      const pulperMin = parseDurationToMinutes(row['pulper running hr'] || row['pulper hours']);

      // String fields
      const startTime = String(row['start time'] || '').trim() || null;
      const endTime = String(row['end time'] || '').trim() || null;
      const gsmRaw = String(row['gsm'] || '').trim() || null;
      const bfRaw = String(row['bf'] || '').trim() || null;
      const prvPressureTemp = String(row['prv pressure / prv temp'] || row['prv pressure'] || '').trim() || null;

      // Upsert report header inside transaction
      const { rows: headerResult } = await client.query(
        `INSERT INTO daily_production_reports 
           (report_date, machine_id, pmc_production_mt, finish_production_mt, total_sets, 
            running_minutes, down_minutes, furnish_local_mt, furnish_occ_mt, furnish_total_mt,
            power_units, rice_husk_mt, total_steam_mt, status, created_by, 
            start_time, end_time, gsm_raw, bf_raw, draw_avg, machine_speed_avg, moisture_pct_avg,
            prv_pressure_temp, pulper_running_minutes, pulper_units, etp_inlet_ppm, etp_outlet_ppm,
            etp_inlet_flow, etp_outlet_flow, fresh_water_mt, feed_water_mt, condensate_water_mt)
         VALUES 
           ($1, $2, $3, $3, 0, $4, $5, $6, $7, $6::numeric + $7::numeric, $8, $9, $10, 'Draft', $11,
            $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28)
         ON CONFLICT (report_date, machine_id) 
         DO UPDATE SET
           pmc_production_mt = EXCLUDED.pmc_production_mt,
           finish_production_mt = EXCLUDED.pmc_production_mt,
           running_minutes = EXCLUDED.running_minutes,
           down_minutes = EXCLUDED.down_minutes,
           furnish_local_mt = EXCLUDED.furnish_local_mt,
           furnish_occ_mt = EXCLUDED.furnish_occ_mt,
           furnish_total_mt = EXCLUDED.furnish_total_mt,
           power_units = EXCLUDED.power_units,
           rice_husk_mt = EXCLUDED.rice_husk_mt,
           total_steam_mt = EXCLUDED.total_steam_mt,
           start_time = EXCLUDED.start_time,
           end_time = EXCLUDED.end_time,
           gsm_raw = EXCLUDED.gsm_raw,
           bf_raw = EXCLUDED.bf_raw,
           draw_avg = EXCLUDED.draw_avg,
           machine_speed_avg = EXCLUDED.machine_speed_avg,
           moisture_pct_avg = EXCLUDED.moisture_pct_avg,
           prv_pressure_temp = EXCLUDED.prv_pressure_temp,
           pulper_running_minutes = EXCLUDED.pulper_running_minutes,
           pulper_units = EXCLUDED.pulper_units,
           etp_inlet_ppm = EXCLUDED.etp_inlet_ppm,
           etp_outlet_ppm = EXCLUDED.etp_outlet_ppm,
           etp_inlet_flow = EXCLUDED.etp_inlet_flow,
           etp_outlet_flow = EXCLUDED.etp_outlet_flow,
           fresh_water_mt = EXCLUDED.fresh_water_mt,
           feed_water_mt = EXCLUDED.feed_water_mt,
           condensate_water_mt = EXCLUDED.condensate_water_mt,
           updated_at = NOW()
         RETURNING id, report_date`,
        [reportDate, machineId, pmcProduction, runningMin, downMin, furnishLocal, furnishOCC,
         powerUnits, riceHusk, totalSteam, req.user.id, startTime, endTime, gsmRaw, bfRaw,
         drawAvg, speedAvg, moistureAvg, prvPressureTemp, pulperMin, pulperUnits,
         etpInletPpm, etpOutletPpm, etpInletFlow, etpOutletFlow, freshWater, feedWater, condensateWater]
      );

      const reportId = headerResult[0].id;

      // Parse GSM / BF list items and insert/upsert into dpr_gsm_breakup
      await client.query('DELETE FROM dpr_gsm_breakup WHERE report_id = $1', [reportId]);
      
      const gsms = gsmRaw ? gsmRaw.split('/') : [];
      const bfs = bfRaw ? bfRaw.split('/') : [];

      for (let i = 0; i < gsms.length; i++) {
        const gsmVal = parseFloat(gsms[i].trim());
        const bfVal = bfs[i] ? parseFloat(bfs[i].trim()) : (bfs[0] ? parseFloat(bfs[0].trim()) : null);
        if (!isNaN(gsmVal)) {
          await client.query(
            `INSERT INTO dpr_gsm_breakup (report_id, gsm, bf, sets, production_mt, sort_order)
             VALUES ($1, $2, $3, 0, 0, $4)`,
            [reportId, gsmVal, bfVal, i]
          );
        }
      }

      imported.push({ reportId, date: reportDate });

      // Kafka: Ph23-B — Broadcast DPR update (fire-and-forget)
      kafka.publish(kafka.TOPICS.DPR, reportDate, {
        event: 'dpr.saved',
        report_id: reportId,
        report_date: reportDate,
        machine_id: machineId,
        source: 'ExcelImport',
        importedBy: req.user.id
      });
    }

    await client.query('COMMIT');
    res.json({
      success: true,
      message: `Successfully processed file. Imported ${imported.length} reports.`,
      importedCount: imported.length,
      skippedCount: skipped.length,
      imported,
      skipped
    });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ success: false, message: 'DPR import database error: ' + err.message });
  } finally {
    client.release();
  }
}));

module.exports = router;
