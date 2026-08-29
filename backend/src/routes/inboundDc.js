const router = require('express').Router();
const pool = require('../db/pool');
const { auth, requireLevel, requireStore } = require('../middleware/auth');
const { computeLineValue } = require('../utils/dcInvoiceMatch');

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

    await client.query('COMMIT');
    res.json({ success: true, data: { grn: head, grnId, grnNumber: grnNum }, message: `GRN ${grnNum} created from Inbound DC ${dc.dc_no}` });
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}));

module.exports = router;
