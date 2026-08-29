const router = require('express').Router();
const pool = require('../db/pool');
const { auth, requireLevel, requireStore } = require('../middleware/auth');
const { computeLineValue } = require('../utils/dcInvoiceMatch');
const { audit } = require('../middleware/helpers');

const ar = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// Inbound Delivery Challan (DC) workflow
// -----------------------------------------------------------------------
// Lets goods be received into stock BEFORE the vendor invoice arrives.
// Lifecycle: received -> invoice_matched -> grn_done (or cancelled).
// Stock is bumped PROVISIONALLY on receipt (transaction_type='provisional_grn'
// in stock_ledger) so store staff can start using material immediately; once
// the invoice is matched, a real PO-independent GRN can be raised, which
// re-tags the ledger row from 'provisional_grn' to 'grn' (no double counting
// -- the material was already added to stock at DC-receipt time).
// -----------------------------------------------------------------------

const seqDcNum = async (client) => {
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [`inbound-dc-${stamp}`]);
  const { rows } = await client.query(
    `SELECT LPAD((COUNT(*)+1)::text,4,'0') AS seq FROM inbound_dc WHERE created_at::date = CURRENT_DATE`
  );
  return `IDC-${stamp}-${rows[0].seq}`;
};

// POST / — create inbound DC + items, and PROVISIONALLY bump stock.
router.post('/', auth, requireStore, ar(async (req, res) => {
  const { vendor_id, dc_no, dc_date, vehicle_number, remarks, items } = req.body;
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ success: false, message: 'At least one item is required' });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const autoDcNo = dc_no && String(dc_no).trim() ? String(dc_no).trim() : await seqDcNum(client);

    const { rows: [dc] } = await client.query(
      `INSERT INTO inbound_dc (dc_no, dc_date, vendor_id, vehicle_number, remarks, status, created_by)
       VALUES ($1, $2, $3, $4, $5, 'received', $6) RETURNING *`,
      [autoDcNo, dc_date || new Date().toISOString().slice(0, 10), vendor_id || null, vehicle_number || null, remarks || null, req.user.id]
    );

    for (const it of items) {
      const materialId = it.material_id;
      const qty = Number(it.qty);
      if (!materialId || !(qty > 0)) continue;

      await client.query(
        `INSERT INTO inbound_dc_items (inbound_dc_id, material_id, qty, unit, batch_no)
         VALUES ($1, $2, $3, $4, $5)`,
        [dc.id, materialId, qty, it.unit || null, it.batch_no || null]
      );

      // PROVISIONAL stock increase -- goods are physically in the store even
      // though the invoice has not yet been matched. This is intentionally
      // symmetrical with the real PO->GRN inward flow in purchase.js so
      // downstream stock reports see the material immediately.
      const { rows: [mat] } = await client.query(
        `SELECT current_stock, unit_price FROM materials WHERE id=$1 FOR UPDATE`, [materialId]
      );
      if (!mat) continue;
      const curStock = parseFloat(mat.current_stock || 0);
      const newStock = curStock + qty;
      await client.query(`UPDATE materials SET current_stock=$1 WHERE id=$2`, [newStock, materialId]);

      await client.query(
        `INSERT INTO stock_ledger (material_id, date, transaction_type, reference_type, reference_id, in_qty, out_qty, balance, unit_price, value, remarks, created_by, vendor_id)
         VALUES ($1, CURRENT_DATE, 'provisional_grn', 'INBOUND_DC', $2, $3, 0, $4, $5, $6, $7, $8, $9)`,
        [materialId, dc.id, qty, newStock, mat.unit_price || 0, qty * (mat.unit_price || 0),
         `Provisional inward against Inbound DC ${autoDcNo} (invoice not yet matched)`, req.user.id, vendor_id || null]
      );
    }

    await audit(client, { userId: req.user.id, module: 'InboundDC', action: 'CREATE', entityId: dc.id, newVal: dc, ip: req.ip });

    await client.query('COMMIT');
    res.json({ success: true, data: dc, message: `Inbound DC ${autoDcNo} received; stock updated provisionally pending invoice match` });
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}));

// GET / — list, filterable by status / vendor_id
router.get('/', auth, ar(async (req, res) => {
  const { status, vendor_id } = req.query;
  const conds = [];
  const params = [];
  let p = 1;
  if (status) { conds.push(`d.status = $${p++}`); params.push(status); }
  if (vendor_id) { conds.push(`d.vendor_id = $${p++}`); params.push(vendor_id); }
  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';

  const { rows } = await pool.query(
    `SELECT d.*, v.name AS vendor_name,
            COALESCE((SELECT COUNT(*) FROM inbound_dc_items i WHERE i.inbound_dc_id = d.id), 0)::int AS "itemCount"
     FROM inbound_dc d
     LEFT JOIN vendors v ON v.id = d.vendor_id
     ${where}
     ORDER BY d.created_at DESC
     LIMIT 500`,
    params
  );
  res.json({ success: true, data: rows });
}));
// GET /summary — live reporting/analytics rollup for Inbound DC + Invoice Match.
// -----------------------------------------------------------------------
// INTENTIONALLY NOT CACHED: every call runs a fresh aggregate SQL query
// against inbound_dc / inbound_dc_items so the numbers always reflect the
// current DB state (this is the "accurate sync" requirement -- the
// dashboard widget that calls this also exposes an explicit manual
// Refresh button that re-hits this endpoint rather than relying on any
// client-side cached snapshot).
router.get('/summary', auth, ar(async (req, res) => {
  const { rows: [counts] } = await pool.query(`
    SELECT
      COUNT(*)::int AS total_dcs,
      COUNT(*) FILTER (WHERE status = 'received')::int AS pending_match,
      COUNT(*) FILTER (WHERE status = 'invoice_matched')::int AS matched_awaiting_grn,
      COUNT(*) FILTER (WHERE status = 'grn_done')::int AS converted_to_grn,
      COUNT(*) FILTER (WHERE status = 'cancelled')::int AS cancelled
    FROM inbound_dc
  `);

  // Provisional stock value still pending reconciliation = the ledger value
  // recorded at DC-receipt time for DCs not yet converted to a GRN
  // (status IN ('received','invoice_matched')).
  const { rows: [provisional] } = await pool.query(`
    SELECT COALESCE(SUM(sl.value), 0)::numeric AS provisional_value
    FROM stock_ledger sl
    JOIN inbound_dc d ON d.id = sl.reference_id AND sl.reference_type = 'INBOUND_DC'
    WHERE sl.transaction_type = 'provisional_grn'
      AND d.status IN ('received', 'invoice_matched')
  `);

  const { rows: [matchedValue] } = await pool.query(`
    SELECT COALESCE(SUM(invoice_total), 0)::numeric AS matched_value
    FROM inbound_dc
    WHERE status IN ('invoice_matched', 'grn_done') AND invoice_total IS NOT NULL
  `);

  // Mismatch flag: invoice_total keyed by the store manager vs the computed
  // total of the DC's items at catalog unit_price (sanity check only -- the
  // authoritative per-line rate/disc/tax overrides are keyed later at GRN
  // time, so this is a coarse "does the paper invoice total roughly agree
  // with what we'd expect" signal, not a hard validation).
  const { rows: mismatchRows } = await pool.query(`
    SELECT d.id, d.dc_no, d.invoice_total,
           COALESCE(SUM(i.qty * COALESCE(m.unit_price, 0)), 0)::numeric AS computed_total
    FROM inbound_dc d
    JOIN inbound_dc_items i ON i.inbound_dc_id = d.id
    LEFT JOIN materials m ON m.id = i.material_id
    WHERE d.status IN ('invoice_matched', 'grn_done') AND d.invoice_total IS NOT NULL
    GROUP BY d.id, d.dc_no, d.invoice_total
    HAVING ABS(d.invoice_total - COALESCE(SUM(i.qty * COALESCE(m.unit_price, 0)), 0)) > 1
  `);

  res.json({
    success: true,
    data: {
      totalDcs: counts.total_dcs,
      pendingMatch: counts.pending_match,
      matchedAwaitingGrn: counts.matched_awaiting_grn,
      convertedToGrn: counts.converted_to_grn,
      cancelled: counts.cancelled,
      provisionalValuePending: Number(provisional.provisional_value),
      matchedValue: Number(matchedValue.matched_value),
      mismatchCount: mismatchRows.length,
      mismatches: mismatchRows.map(r => ({
        id: r.id,
        dcNo: r.dc_no,
        invoiceTotal: Number(r.invoice_total),
        computedTotal: Number(r.computed_total)
      })),
      generatedAt: new Date().toISOString()
    }
  });
}));


// GET /:id — one DC with items
router.get('/:id', auth, ar(async (req, res) => {
  const { rows: [dc] } = await pool.query(
    `SELECT d.*, v.name AS vendor_name FROM inbound_dc d LEFT JOIN vendors v ON v.id = d.vendor_id WHERE d.id = $1`,
    [req.params.id]
  );
  if (!dc) return res.status(404).json({ success: false, message: 'Inbound DC not found' });
  const { rows: items } = await pool.query(
    `SELECT i.*, m.name AS material_name, m.code AS material_code
     FROM inbound_dc_items i LEFT JOIN materials m ON m.id = i.material_id
     WHERE i.inbound_dc_id = $1 ORDER BY i.id ASC`,
    [req.params.id]
  );
  res.json({ success: true, data: { ...dc, items } });
}));

// POST /:id/match-invoice — record the vendor invoice details against a received DC.
// Kept deliberately simple per spec: no fuzzy matching, just records what the
// user confirms (including their explicit confirmation that the party name matches).
router.post('/:id/match-invoice', auth, requireStore, ar(async (req, res) => {
  const { invoice_number, invoice_date, party_name_confirmed, party_name, invoice_total } = req.body;
  if (!invoice_number || !String(invoice_number).trim()) {
    return res.status(400).json({ success: false, message: 'invoice_number is required' });
  }
  if (!party_name_confirmed) {
    return res.status(400).json({ success: false, message: 'Please confirm the vendor/party name on the invoice matches this DC before proceeding' });
  }
  const { rows: [dc] } = await pool.query(`SELECT * FROM inbound_dc WHERE id = $1`, [req.params.id]);
  if (!dc) return res.status(404).json({ success: false, message: 'Inbound DC not found' });
  if (dc.status !== 'received') {
    return res.status(400).json({ success: false, message: `Cannot match invoice: DC status is '${dc.status}', expected 'received'` });
  }

  // party_name / invoice_total are captured from the paper invoice at match
  // time (Store.jsx tick-mark reconciliation UI) so the store manager's keyed
  // value + tax figures can be checked against the computed line totals.
  const { rows: [updated] } = await pool.query(
    `UPDATE inbound_dc
     SET invoice_number = $1, invoice_date = $2, status = 'invoice_matched', matched_by = $3, matched_at = NOW(),
         party_name = COALESCE($5, party_name), invoice_total = COALESCE($6, invoice_total)
     WHERE id = $4 RETURNING *`,
    [invoice_number, invoice_date || null, req.user.id, req.params.id, party_name || null, invoice_total != null && invoice_total !== '' ? Number(invoice_total) : null]
  );
  await audit(null, { userId: req.user.id, module: 'InboundDC', action: 'MATCH_INVOICE', entityId: updated.id, oldVal: dc, newVal: updated, ip: req.ip });
  res.json({ success: true, data: updated, message: 'Invoice matched. DC is now ready for GRN creation.' });
}));

// POST /:id/grn — convert a matched inbound DC into a real GRN (PO optional / absent).
router.post('/:id/grn', auth, requireLevel(2), ar(async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: [dc] } = await client.query(`SELECT * FROM inbound_dc WHERE id = $1 FOR UPDATE`, [req.params.id]);
    if (!dc) throw new Error('Inbound DC not found');
    if (dc.status !== 'invoice_matched') {
      throw new Error(`DC must be in 'invoice_matched' status to raise a GRN (current: '${dc.status}')`);
    }

    const { rows: items } = await client.query(`SELECT * FROM inbound_dc_items WHERE inbound_dc_id = $1`, [dc.id]);
    if (!items.length) throw new Error('DC has no items');

    // Per-line overrides keyed by inbound_dc_items.id, entered by the store
    // manager in the Store.jsx tick-mark invoice-match UI: qty stays whatever
    // was physically received (view-only there), but rate/disc%/tax amount
    // are authoritative as keyed against the paper invoice -- NOT the stale
    // catalog price, which is only the fallback when no override is sent.
    const { items: itemOverrides, party_name: partyNameFromReq } = req.body || {};
    const overrideMap = {};
    if (Array.isArray(itemOverrides)) {
      for (const o of itemOverrides) {
        if (o && o.id != null) overrideMap[o.id] = o;
      }
    }

    const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [`grn-${stamp}`]);
    const { rows: seqRows } = await client.query(`SELECT LPAD((COUNT(*)+1)::text, 4, '0') as seq FROM grn WHERE grn_number LIKE $1`, [`GRN-${stamp}-%`]);
    const grnNum = `GRN-${stamp}-${seqRows[0].seq}`;

    // po_id is nullable on grn (confirmed live: truncate_test_pos.js sets it
    // to NULL), so this DC-originated GRN has no PO -- fully PO-optional.
    // party_name has no dedicated column on grn (checked live schema before
    // writing this -- not present), so it is folded into remarks rather than
    // inventing an unverified column; inbound_dc.party_name (additive,
    // migration not yet run) is the durable place it is actually stored.
    const partyName = partyNameFromReq || dc.party_name || null;
    const grnRemarks = partyName ? `Party Name: ${partyName}${dc.remarks ? ` | ${dc.remarks}` : ''}` : (dc.remarks || null);
    const { rows: [head] } = await client.query(
      `INSERT INTO grn (grn_number, date, vendor_id, po_id, vehicle_number, challan_number, invoice_number, status, received_by, remarks)
       VALUES ($1, CURRENT_DATE, $2, NULL, $3, $4, $5, 'Received', $6, $7) RETURNING *`,
      [grnNum, dc.vendor_id, dc.vehicle_number || null, dc.dc_no || null, dc.invoice_number || null, req.user.id, grnRemarks]
    );
    const grnId = head.id;

    for (const it of items) {
      const override = overrideMap[it.id];
      let uPrice, discPct, gstAmt;
      if (override) {
        uPrice = Number(override.unit_price) || 0;
        discPct = Math.max(0, Math.min(100, Number(override.discount_pct) || 0));
        gstAmt = Number(override.gst_amount) || 0;
      } else {
        const { rows: [mat] } = await client.query(`SELECT unit_price FROM materials WHERE id=$1`, [it.material_id]);
        uPrice = Number(mat?.unit_price || 0);
        discPct = 0;
        gstAmt = 0;
      }
      const qty = Number(it.qty);
      // Shared with the unit-tested pure helper (backend/src/utils/dcInvoiceMatch.js)
      // and Store.jsx's client-side live-preview total, so all three surfaces
      // agree on one formula instead of three hand-copied ones drifting apart.
      const { taxableValue: taxableVal, totalValue: totalVal, gstPct } = computeLineValue(qty, uPrice, discPct, gstAmt);
      await client.query(
        `INSERT INTO grn_items (grn_id, material_id, po_qty, received_qty, accepted_qty, rejected_qty, uom, unit_price, discount_pct, taxable_amount, total_amount, gst_pct, remarks)
         VALUES ($1, $2, $3, $4, $5, 0, $6, $7, $8, $9, $10, $11, $12)`,
        [grnId, it.material_id, qty, qty, qty, it.unit || null, uPrice, discPct, taxableVal, totalVal,
         gstPct,
         `Invoice-matched via Store.jsx DC tick-mark flow (DC ${dc.dc_no})`]
      );

      // Re-tag the earlier provisional ledger entry for this DC/material as a
      // finalized GRN entry -- stock was ALREADY added at receipt time, so we
      // must NOT add it again here, only reclassify the transaction type and
      // point its reference at the new GRN.
      await client.query(
        `UPDATE stock_ledger
         SET transaction_type = 'grn', reference_type = 'GRN', reference_id = $1,
             remarks = $2
         WHERE material_id = $3 AND reference_type = 'INBOUND_DC' AND reference_id = $4 AND transaction_type = 'provisional_grn'`,
        [grnId, `Finalized via GRN ${grnNum} (from Inbound DC ${dc.dc_no})`, it.material_id, dc.id]
      );
    }

    await client.query(
      `UPDATE inbound_dc SET status = 'grn_done', grn_id = $1 WHERE id = $2`,
      [grnId, dc.id]
    );

    await audit(client, { userId: req.user.id, module: 'InboundDC', action: 'GRN_CONVERTED', entityId: dc.id, oldVal: dc, newVal: { ...dc, status: 'grn_done', grn_id: grnId }, ip: req.ip });

    await client.query('COMMIT');
    res.json({ success: true, data: { grn: head, grnId, grnNumber: grnNum }, message: `GRN ${grnNum} created from Inbound DC ${dc.dc_no}` });
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}));


// PUT /:id — edit DC header + items. Only allowed while status='received'
// (before invoice-matched/grn'd) to avoid corrupting a reconciled record.
// Item edits reverse the old provisional stock/ledger effect and reapply the
// new one, so current_stock and stock_ledger stay consistent with the edited
// quantities (mirrors the compensating-ledger-entry pattern used by indent's
// force-delete route).
router.put('/:id', auth, requireStore, ar(async (req, res) => {
  const { vendor_id, dc_no, dc_date, vehicle_number, remarks, items } = req.body;
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ success: false, message: 'At least one item is required' });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: [dc] } = await client.query(`SELECT * FROM inbound_dc WHERE id = $1 FOR UPDATE`, [req.params.id]);
    if (!dc) { await client.query('ROLLBACK'); return res.status(404).json({ success: false, message: 'Inbound DC not found' }); }
    if (dc.status !== 'received') {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: `Cannot edit: DC status is '${dc.status}'. Only DCs still awaiting invoice match ('received') can be edited.` });
    }

    // Reverse the old provisional stock effect for every existing item before re-applying the edited set.
    const { rows: oldItems } = await client.query(`SELECT * FROM inbound_dc_items WHERE inbound_dc_id = $1`, [dc.id]);
    for (const it of oldItems) {
      const qty = parseFloat(it.qty || 0);
      if (qty <= 0) continue;
      const { rows: [mat] } = await client.query(`SELECT current_stock, unit_price FROM materials WHERE id=$1 FOR UPDATE`, [it.material_id]);
      if (!mat) continue;
      const newStock = parseFloat(mat.current_stock || 0) - qty;
      await client.query(`UPDATE materials SET current_stock=$1 WHERE id=$2`, [newStock, it.material_id]);
      await client.query(
        `INSERT INTO stock_ledger (material_id, date, transaction_type, reference_type, reference_id, in_qty, out_qty, balance, unit_price, value, remarks, created_by, vendor_id)
         VALUES ($1, CURRENT_DATE, 'adjustment_minus', 'INBOUND_DC', $2, 0, $3, $4, $5, $6, $7, $8, $9)`,
        [it.material_id, dc.id, qty, newStock, mat.unit_price || 0, qty * (mat.unit_price || 0),
         `Reversed on edit of Inbound DC ${dc.dc_no}`, req.user.id, dc.vendor_id || null]
      );
    }
    // Retag old provisional ledger rows so they no longer double-count against the edited item set.
    await client.query(
      `UPDATE stock_ledger SET transaction_type = 'provisional_grn_superseded'
       WHERE reference_type = 'INBOUND_DC' AND reference_id = $1 AND transaction_type = 'provisional_grn'`,
      [dc.id]
    );
    await client.query(`DELETE FROM inbound_dc_items WHERE inbound_dc_id = $1`, [dc.id]);

    const { rows: [updated] } = await client.query(
      `UPDATE inbound_dc SET vendor_id = $1, dc_no = $2, dc_date = $3, vehicle_number = $4, remarks = $5
       WHERE id = $6 RETURNING *`,
      [vendor_id || null, (dc_no && String(dc_no).trim()) || dc.dc_no, dc_date || dc.dc_date, vehicle_number || null, remarks || null, dc.id]
    );

    for (const it of items) {
      const materialId = it.material_id;
      const qty = Number(it.qty);
      if (!materialId || !(qty > 0)) continue;
      await client.query(
        `INSERT INTO inbound_dc_items (inbound_dc_id, material_id, qty, unit, batch_no)
         VALUES ($1, $2, $3, $4, $5)`,
        [dc.id, materialId, qty, it.unit || null, it.batch_no || null]
      );
      const { rows: [mat] } = await client.query(`SELECT current_stock, unit_price FROM materials WHERE id=$1 FOR UPDATE`, [materialId]);
      if (!mat) continue;
      const newStock = parseFloat(mat.current_stock || 0) + qty;
      await client.query(`UPDATE materials SET current_stock=$1 WHERE id=$2`, [newStock, materialId]);
      await client.query(
        `INSERT INTO stock_ledger (material_id, date, transaction_type, reference_type, reference_id, in_qty, out_qty, balance, unit_price, value, remarks, created_by, vendor_id)
         VALUES ($1, CURRENT_DATE, 'provisional_grn', 'INBOUND_DC', $2, $3, 0, $4, $5, $6, $7, $8, $9)`,
        [materialId, dc.id, qty, newStock, mat.unit_price || 0, qty * (mat.unit_price || 0),
         `Provisional inward against edited Inbound DC ${updated.dc_no}`, req.user.id, vendor_id || null]
      );
    }

    await audit(client, { userId: req.user.id, module: 'InboundDC', action: 'UPDATE', entityId: dc.id, oldVal: dc, newVal: updated, ip: req.ip });

    await client.query('COMMIT');
    res.json({ success: true, data: updated, message: `Inbound DC ${updated.dc_no} updated` });
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}));

// DELETE /:id — cancel (soft-delete) an inbound DC. Only allowed pre-GRN
// (status IN 'received','invoice_matched'); a GRN-converted DC is a
// reconciled financial record and must not be cancelled here (mirrors
// how PO/indent avoid hard-deleting settled records). Reverses the
// provisional stock effect, like the indent force-delete restore pattern.
router.delete('/:id', auth, requireStore, ar(async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: [dc] } = await client.query(`SELECT * FROM inbound_dc WHERE id = $1 FOR UPDATE`, [req.params.id]);
    if (!dc) { await client.query('ROLLBACK'); return res.status(404).json({ success: false, message: 'Inbound DC not found' }); }
    if (dc.status === 'grn_done') {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'Cannot cancel: this DC has already been converted to a GRN. Void the GRN instead.' });
    }
    if (dc.status === 'cancelled') {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'This DC is already cancelled.' });
    }

    const { rows: items } = await client.query(`SELECT * FROM inbound_dc_items WHERE inbound_dc_id = $1`, [dc.id]);
    for (const it of items) {
      const qty = parseFloat(it.qty || 0);
      if (qty <= 0) continue;
      const { rows: [mat] } = await client.query(`SELECT current_stock, unit_price FROM materials WHERE id=$1 FOR UPDATE`, [it.material_id]);
      if (!mat) continue;
      const newStock = parseFloat(mat.current_stock || 0) - qty;
      await client.query(`UPDATE materials SET current_stock=$1 WHERE id=$2`, [newStock, it.material_id]);
      await client.query(
        `INSERT INTO stock_ledger (material_id, date, transaction_type, reference_type, reference_id, in_qty, out_qty, balance, unit_price, value, remarks, created_by, vendor_id)
         VALUES ($1, CURRENT_DATE, 'adjustment_minus', 'INBOUND_DC', $2, 0, $3, $4, $5, $6, $7, $8, $9)`,
        [it.material_id, dc.id, qty, newStock, mat.unit_price || 0, qty * (mat.unit_price || 0),
         `Stock reversed on Cancel of Inbound DC ${dc.dc_no}`, req.user.id, dc.vendor_id || null]
      );
    }
    await client.query(
      `UPDATE stock_ledger SET transaction_type = 'provisional_grn_reversed'
       WHERE reference_type = 'INBOUND_DC' AND reference_id = $1 AND transaction_type = 'provisional_grn'`,
      [dc.id]
    );

    const { rows: [updated] } = await client.query(
      `UPDATE inbound_dc SET status = 'cancelled' WHERE id = $1 RETURNING *`,
      [dc.id]
    );

    await audit(client, { userId: req.user.id, module: 'InboundDC', action: 'CANCEL', entityId: dc.id, oldVal: dc, newVal: updated, ip: req.ip });

    await client.query('COMMIT');
    res.json({ success: true, data: updated, message: `Inbound DC ${dc.dc_no} cancelled; stock reversed` });
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}));

// GET /:id/history — per-record audit trail (reuses the shared audit_log
// table written by helpers.audit(), filtered to this DC's entries).
router.get('/:id/history', auth, ar(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT al.id, al.action, al.old_data, al.new_data, al.created_at, u.name AS user_name
     FROM audit_log al LEFT JOIN users u ON u.id = al.user_id
     WHERE al.module = 'InboundDC' AND al.record_id = $1
     ORDER BY al.created_at DESC`,
    [req.params.id]
  );
  res.json({ success: true, data: rows });
}));

module.exports = router;
