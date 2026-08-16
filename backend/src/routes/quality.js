const router = require('express').Router();
const pool = require('../db/pool');
const { auth, requireLevel } = require('../middleware/auth');
const ar = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// Doc31 #8: advisory lock, same pattern as indent.js seqNum.
const seqNum = async (client) => {
  const stamp = new Date().toISOString().slice(0,10).replace(/-/g,'');
  await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [`qt-${stamp}`]);
  const { rows } = await client.query(
    `SELECT LPAD((COUNT(*)+1)::text,4,'0') AS seq FROM quality_tests WHERE test_number LIKE $1`,
    [`QT-${stamp}-%`]
  );
  return `QT-${stamp}-${rows[0].seq}`;
};

// Section-ownership: quality_tests -> (Reel) reference_id -> reels.machine_id ->
// section_equipment.machine_id -> plant_sections.department_id. L4+ (Plant Head) sees/acts on all.
const DEPT_JOIN = `
     LEFT JOIN reels rl ON rl.id=qt.reference_id AND qt.reference_type='Reel'
     LEFT JOIN section_equipment se ON se.machine_id=rl.machine_id
     LEFT JOIN plant_sections ps ON ps.id=se.section_id`;

// Returns the owning department_id for a test (via its Reel/machine/section), or null if unresolvable.
async function getTestDeptId(client, id) {
  const { rows } = await client.query(
    `SELECT ps.department_id AS dept
     FROM quality_tests qt ${DEPT_JOIN}
     WHERE qt.id=$1 LIMIT 1`,
    [id]
  );
  return rows[0] ? rows[0].dept : null;
}

// Returns the owning department_id for a (reference_type, reference_id) pair before a test row exists.
async function getRefDeptId(client, referenceType, referenceId) {
  if (referenceType !== 'Reel' || !referenceId) return null;
  const { rows } = await client.query(
    `SELECT ps.department_id AS dept
     FROM reels rl
     LEFT JOIN section_equipment se ON se.machine_id=rl.machine_id
     LEFT JOIN plant_sections ps ON ps.id=se.section_id
     WHERE rl.id=$1 LIMIT 1`,
    [referenceId]
  );
  return rows[0] ? rows[0].dept : null;
}

// LIST
router.get('/tests', auth, ar(async (req, res) => {
  const { result, test_type, page=1, limit=20 } = req.query;
  const conds=[]; const params=[]; let p=1;
  if (result)    { conds.push(`qt.result=$${p++}`); params.push(result); }
  if (test_type) { conds.push(`qt.test_type=$${p++}`); params.push(test_type); }
  const canSeeAll = req.user.role_level >= 4;
  if (!canSeeAll) {
    conds.push(`ps.department_id=$${p++}`);
    params.push(req.user.department_id);
  }
  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
  const offset = (parseInt(page)-1)*parseInt(limit);
  const { rows } = await pool.query(
    `SELECT qt.id, qt.test_number as "testNumber", qt.test_type as "testType",
            qt.reference_type as "referenceType", qt.reference_id as "referenceId",
            qt.test_date as "testDate", qt.result, qt.gsm, qt.moisture_pct as "moisturePct",
            qt.caliper_micron as "caliperMicron", qt.cobb_value as "cobbValue",
            qt.brightness_pct as "brightnessPct", qt.thickness_micron as "thicknessMicron",
            qt.width_mm as "widthMm", qt.weight_kg as "weightKg",
            qt.tensile_strength as "tensileStrength", qt.tear_strength as "tearStrength",
            qt.burst_factor as "burstFactor", qt.remarks,
            u.name as "testedByName"
     FROM quality_tests qt LEFT JOIN users u ON u.id=qt.tested_by
     ${DEPT_JOIN}
     ${where} ORDER BY qt.test_date DESC LIMIT $${p} OFFSET $${p+1}`,
    [...params, parseInt(limit), offset]
  );
  const { rows: cnt } = await pool.query(
    `SELECT COUNT(*) FROM quality_tests qt ${DEPT_JOIN} ${where}`, params
  );
  res.json({ success:true, data:rows, total:parseInt(cnt[0].count) });
}));

// CREATE TEST
router.post('/tests', auth, requireLevel(2), ar(async (req, res) => {
  const {
    test_type, reference_type, reference_id,
    gsm, moisture_pct, caliper_micron, burst_factor, cobb_value,
    brightness_pct, thickness_micron, width_mm, weight_kg,
    tensile_strength, tear_strength, result='Pending', remarks
  } = req.body;
  if (!test_type) return res.json({ success:false, message:'Test type required' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    if (req.user.role_level < 4 && reference_type === 'Reel' && reference_id) {
      const deptId = await getRefDeptId(client, reference_type, reference_id);
      if (deptId === null || deptId !== req.user.department_id) {
        await client.query('ROLLBACK');
        return res.status(403).json({ success: false, message: 'Reel is outside your department/section' });
      }
    }
    const num = await seqNum(client);
    const { rows } = await client.query(
      `INSERT INTO quality_tests
         (test_number,test_type,reference_type,reference_id,tested_by,
          gsm,moisture_pct,caliper_micron,burst_factor,cobb_value,
          brightness_pct,thickness_micron,width_mm,weight_kg,
          tensile_strength,tear_strength,result,remarks)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18) RETURNING *`,
      [num,test_type,reference_type||null,reference_id||null,req.user.id,
       gsm||null,moisture_pct||null,caliper_micron||null,burst_factor||null,cobb_value||null,
       brightness_pct||null,thickness_micron||null,width_mm||null,weight_kg||null,
       tensile_strength||null,tear_strength||null,result,remarks||null]
    );
    await client.query('COMMIT');
    res.json({ success:true, data:rows[0] });
  } catch(e) { await client.query('ROLLBACK'); throw e; }
  finally { client.release(); }
}));

// PASS
router.put('/tests/:id/pass', auth, requireLevel(2), ar(async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: [existing] } = await client.query(`SELECT tested_by FROM quality_tests WHERE id=$1`, [req.params.id]);
    if (existing && existing.tested_by === req.user.id && req.user.role_level < 4) {
      await client.query('ROLLBACK');
      return res.status(403).json({ success: false, message: 'Cannot certify own test — needs different QA/QC user (or level4+ override)' });
    }
    if (req.user.role_level < 4) {
      const deptId = await getTestDeptId(client, req.params.id);
      if (deptId === null || deptId !== req.user.department_id) {
        await client.query('ROLLBACK');
        return res.status(403).json({ success: false, message: 'Test is outside your department/section' });
      }
    }
    const { rows } = await client.query(
      `UPDATE quality_tests SET result='Pass', remarks=COALESCE($1,remarks) WHERE id=$2 RETURNING *`,
      [req.body.remarks||null, req.params.id]
    );
    if (!rows.length) { await client.query('ROLLBACK'); return res.json({ success:false }); }
    const qt = rows[0];
    if (qt.reference_type==='Reel' && qt.reference_id) {
      await client.query(
        `UPDATE reels SET quality_status='Approved', status='In Warehouse' WHERE id=$1`,
        [qt.reference_id]
      );
    }
    if (qt.reference_type==='GRN' && qt.reference_id) {
      await client.query(`UPDATE grn SET status='Approved' WHERE id=$1`, [qt.reference_id]);
    }
    await client.query('COMMIT');
    res.json({ success:true, data:qt });
  } catch(e) { await client.query('ROLLBACK'); throw e; }
  finally { client.release(); }
}));

// Helper: insert audit log row (inside a client transaction)
async function auditLog(client, { userId, action, module, recordId, oldData, newData, ip }) {
  await client.query(
    `INSERT INTO audit_log (user_id, action, module, record_id, old_data, new_data, ip_address)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [userId, action, module, recordId, oldData ? JSON.stringify(oldData) : null,
     newData ? JSON.stringify(newData) : null, ip || null]
  );
}

// FAIL
router.put('/tests/:id/fail', auth, requireLevel(2), ar(async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: [existing] } = await client.query(`SELECT tested_by FROM quality_tests WHERE id=$1`, [req.params.id]);
    if (existing && existing.tested_by === req.user.id && req.user.role_level < 4) {
      await client.query('ROLLBACK');
      return res.status(403).json({ success: false, message: 'Cannot certify own test — needs different QA/QC user (or level4+ override)' });
    }
    if (req.user.role_level < 4) {
      const deptId = await getTestDeptId(client, req.params.id);
      if (deptId === null || deptId !== req.user.department_id) {
        await client.query('ROLLBACK');
        return res.status(403).json({ success: false, message: 'Test is outside your department/section' });
      }
    }
    const { rows } = await client.query(
      `UPDATE quality_tests SET result='Fail', remarks=COALESCE($1,remarks) WHERE id=$2 RETURNING *`,
      [req.body.remarks||null, req.params.id]
    );
    if (!rows.length) { await client.query('ROLLBACK'); return res.json({ success:false }); }
    const qt = rows[0];
    if (qt.reference_type==='Reel' && qt.reference_id) {
      await client.query(
        `UPDATE reels SET quality_status='Rejected', status='Rejected' WHERE id=$1`,
        [qt.reference_id]
      );
    }
    
    // Raise NCR Log inside Audit Feed
    await auditLog(client, {
      userId: req.user.id,
      action: 'NCR_RAISED',
      module: 'Quality',
      recordId: qt.id,
      newData: qt,
      ip: req.ip
    });

    await client.query('COMMIT');
    res.json({ success:true, data:qt });
  } catch(e) { await client.query('ROLLBACK'); throw e; }
  finally { client.release(); }
}));

// RETEST — reset to Pending so QC can run again
router.put('/tests/:id/retest', auth, requireLevel(2), ar(async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: old } = await client.query(
      'SELECT * FROM quality_tests WHERE id=$1 FOR UPDATE', [req.params.id]
    );
    if (!old.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Test not found' });
    }
    if (req.user.role_level < 4) {
      const deptId = await getTestDeptId(client, req.params.id);
      if (deptId === null || deptId !== req.user.department_id) {
        await client.query('ROLLBACK');
        return res.status(403).json({ success: false, message: 'Test is outside your department/section' });
      }
    }
    const { rows } = await client.query(
      `UPDATE quality_tests SET result='Pending', remarks=COALESCE($1,remarks) WHERE id=$2 RETURNING *`,
      [req.body.remarks || null, req.params.id]
    );
    const qt = rows[0];
    if (qt.reference_type === 'Reel' && qt.reference_id) {
      await client.query(`UPDATE reels SET quality_status='Pending' WHERE id=$1`, [qt.reference_id]);
    }
    await client.query('COMMIT');
    res.json({ success: true, data: qt });
  } catch (e) { await client.query('ROLLBACK'); throw e; }
  finally { client.release(); }
}));

// STATS — pass/fail rates by result and test type
router.get('/stats', auth, ar(async (req, res) => {
  const { from, to } = req.query;
  const conds = []; const params = []; let p = 1;
  if (from) { conds.push(`test_date >= $${p++}`); params.push(from); }
  if (to)   { conds.push(`test_date <= $${p++}`); params.push(to); }
  const where     = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
  const wherePass = conds.length
    ? `WHERE result='Pass' AND ${conds.join(' AND ')}`
    : `WHERE result='Pass'`;

  const { rows: byResult } = await pool.query(
    `SELECT result, COUNT(*) as count FROM quality_tests ${where} GROUP BY result`, params
  );
  const { rows: byType } = await pool.query(
    `SELECT test_type, result, COUNT(*) as count FROM quality_tests ${where}
     GROUP BY test_type, result ORDER BY test_type`, params
  );
  const { rows: avgRow } = await pool.query(
    `SELECT AVG(gsm) as "avgGsm", AVG(moisture_pct) as "avgMoisture",
            AVG(burst_factor) as "avgBurst", AVG(cobb_value) as "avgCobb"
     FROM quality_tests ${wherePass}`, params
  );
  res.json({ success: true, data: { byResult, byType, avgParams: avgRow[0] } });
}));

// UPDATE
// Measurement-only edit — result changes must go through /pass /fail /retest (maker-checker gated).
router.put('/tests/:id', auth, requireLevel(2), ar(async (req, res) => {
  const {
    gsm,moisture_pct,caliper_micron,burst_factor,cobb_value,
    brightness_pct,thickness_micron,width_mm,weight_kg,
    tensile_strength,tear_strength,remarks
  } = req.body;
  if (req.user.role_level < 4) {
    const deptId = await getTestDeptId(pool, req.params.id);
    if (deptId === null || deptId !== req.user.department_id) {
      return res.status(403).json({ success: false, message: 'Test is outside your department/section' });
    }
  }
  const { rows } = await pool.query(
    `UPDATE quality_tests SET
       gsm=$1,moisture_pct=$2,caliper_micron=$3,burst_factor=$4,cobb_value=$5,
       brightness_pct=$6,thickness_micron=$7,width_mm=$8,weight_kg=$9,
       tensile_strength=$10,tear_strength=$11,remarks=$12
     WHERE id=$13 RETURNING *`,
    [gsm||null,moisture_pct||null,caliper_micron||null,burst_factor||null,cobb_value||null,
     brightness_pct||null,thickness_micron||null,width_mm||null,weight_kg||null,
     tensile_strength||null,tear_strength||null,remarks||null,req.params.id]
  );
  res.json({ success:!!rows.length, data:rows[0] });
}));

module.exports = router;
