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
// NOTE: one machine maps to MANY section_equipment rows (PM1 alone has 12), so a plain
// join here fans a single test out into one row per equipment row — duplicating the list
// and multiplying COUNT(*). LATERAL ... LIMIT 1 collapses it to at most one owning dept,
// which matches getTestDeptId()'s own LIMIT 1 semantics.
const DEPT_JOIN = `
     LEFT JOIN reels rl ON rl.id=qt.reference_id AND qt.reference_type='Reel'
     LEFT JOIN LATERAL (
       SELECT ps2.department_id
       FROM section_equipment se
       JOIN plant_sections ps2 ON ps2.id=se.section_id
       WHERE se.machine_id = rl.machine_id
       LIMIT 1
     ) ps ON true`;

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
  if (!rows.length) return res.json({ success: false, message: 'Test not found' });
  res.json({ success: true, data: rows[0] });
}));

// POST /api/quality/grn-inspect — Complete Quality Inspection Usage Decision for Inward GRN
router.post('/grn-inspect', auth, requireLevel(2), ar(async (req, res) => {
  const { grnId, overallResult = 'Pass', remarks, items = [] } = req.body;
  if (!grnId) return res.status(400).json({ success: false, message: 'grnId is required' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Lock GRN
    const { rows: [grn] } = await client.query(
      `SELECT g.*, po.po_number, v.id AS vendor_id, v.name AS vendor_name
       FROM grn g
       LEFT JOIN purchase_orders po ON g.po_id = po.id
       LEFT JOIN vendors v ON g.vendor_id = v.id
       WHERE g.id = $1 FOR UPDATE`,
      [grnId]
    );
    if (!grn) throw new Error('GRN record not found');

    // 2. Create Quality Test Record
    const testNum = await seqNum(client);
    const { rows: [qt] } = await client.query(
      `INSERT INTO quality_tests
         (test_number, test_type, reference_type, reference_id, tested_by, result, remarks)
       VALUES ($1, 'Incoming', 'GRN', $2, $3, $4, $5) RETURNING *`,
      [testNum, grnId, req.user.id, overallResult, remarks || `GRN Incoming Inspection: ${grn.grn_number}`]
    );

    const d = new Date();
    const stamp = `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;
    const rejectionsCreated = [];

    // 3. Process each inspected item
    for (const item of items) {
      const { grnItemId, materialId, acceptedQty = 0, rejectedQty = 0, rejectionReason, actionRequired = 'Return to Vendor' } = item;
      const accQty = parseFloat(acceptedQty) || 0;
      const rejQty = parseFloat(rejectedQty) || 0;

      // Update grn_items
      if (grnItemId) {
        await client.query(
          `UPDATE grn_items 
           SET accepted_qty = $1, rejected_qty = $2, remarks = COALESCE($3, remarks)
           WHERE id = $4`,
          [accQty, rejQty, rejectionReason || null, grnItemId]
        );
      }

      // Fetch material details
      const { rows: [mat] } = await client.query(
        `SELECT id, name, uom, current_stock, unit_price FROM materials WHERE id = $1 FOR UPDATE`,
        [materialId]
      );
      if (!mat) continue;

      const unitPrice = parseFloat(mat.unit_price || 0);

      // A. Credit Accepted Stock
      if (accQty > 0) {
        await client.query(
          `UPDATE materials SET current_stock = current_stock + $1 WHERE id = $2`,
          [accQty, materialId]
        );

        const { rows: [balRow] } = await client.query(`SELECT current_stock FROM materials WHERE id = $1`, [materialId]);
        const newBal = parseFloat(balRow.current_stock);

        await client.query(
          `INSERT INTO stock_ledger 
             (material_id, transaction_type, in_qty, out_qty, balance, unit_price, value, date, reference_type, reference_id, remarks, created_by, vendor_id)
           VALUES ($1, 'grn', $2, 0, $3, $4, $5, CURRENT_DATE, 'grn', $6, $7, $8, $9)`,
          [materialId, accQty, newBal, unitPrice, accQty * unitPrice, grnId,
           `QC Accepted | GRN #${grn.grn_number} | PO #${grn.po_number || 'Direct'}`, req.user.id, grn.vendor_id]
        );

        // Update PO items received qty if PO exists
        if (grn.po_id) {
          await client.query(
            `UPDATE po_items SET received_qty = COALESCE(received_qty, 0) + $1 
             WHERE po_id = $2 AND material_id = $3`,
            [accQty, grn.po_id, materialId]
          );
        }
      }

      // B. Create Rejection Note for Rejected Stock
      if (rejQty > 0) {
        await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [`rej-${stamp}`]);
        const seqRes = await client.query(`SELECT COUNT(*)+1 AS n FROM material_rejections WHERE created_at::date = CURRENT_DATE`);
        const rejNum = `REJ-${stamp}-${String(seqRes.rows[0].n).padStart(4, '0')}`;
        const debitAmt = rejQty * unitPrice;

        const { rows: [rej] } = await client.query(
          `INSERT INTO material_rejections
             (rejection_number, grn_id, po_id, vendor_id, material_id, qc_test_id,
              rejected_qty, uom, unit_price, debit_amount, rejection_reason, action_required, status, created_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'Pending RTV', $13)
           RETURNING *`,
          [rejNum, grnId, grn.po_id || null, grn.vendor_id || null, materialId, qt.id,
           rejQty, mat.uom || 'Nos', unitPrice, debitAmt,
           rejectionReason || 'Quality parameters failed', actionRequired, req.user.id]
        );

        rejectionsCreated.push(rej);

        // Notify Finance of Debit Note requirement
        // users has no role_level column — the level lives on roles.level. Referencing
        // role_level directly threw 42703 and aborted the whole grn-inspect transaction
        // for every GRN that had any rejected qty.
        await client.query(
          `INSERT INTO notifications (user_id, title, message, is_read, created_at)
           SELECT u.id, 'Debit Note Required: ' || $1, 'Material rejection of ₹' || $2 || ' against vendor ' || $3, false, NOW()
           FROM users u JOIN roles r ON r.id = u.role_id
           WHERE u.is_active = true
             AND (r.level >= 4
                  OR (r.level >= 3 AND u.department_id = (SELECT id FROM departments WHERE name ILIKE '%Finance%' LIMIT 1)))`,
          [rejNum, debitAmt.toFixed(2), grn.vendor_name || 'Vendor']
        );
      }
    }

    // 4. Update GRN status
    const finalStatus = overallResult === 'Pass' ? 'Approved' : (overallResult === 'Partial' ? 'Partial' : 'Rejected');
    await client.query(`UPDATE grn SET status = $1 WHERE id = $2`, [finalStatus, grnId]);

    // 5. Update PO status if linked
    if (grn.po_id) {
      const { rows: poCheck } = await client.query(
        `SELECT SUM(qty) as total_ordered, SUM(COALESCE(received_qty,0)) as total_received 
         FROM po_items WHERE po_id = $1`,
        [grn.po_id]
      );
      if (poCheck.length && parseFloat(poCheck[0].total_received) >= parseFloat(poCheck[0].total_ordered)) {
        await client.query(`UPDATE purchase_orders SET status = 'Received' WHERE id = $1`, [grn.po_id]);
      } else if (poCheck.length && parseFloat(poCheck[0].total_received) > 0) {
        await client.query(`UPDATE purchase_orders SET status = 'Partial' WHERE id = $1`, [grn.po_id]);
      }
    }

    await client.query('COMMIT');
    res.json({
      success: true,
      data: {
        qualityTestId: qt.id,
        testNumber: qt.test_number,
        grnStatus: finalStatus,
        rejections: rejectionsCreated
      }
    });
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}));

module.exports = router;
